import hashlib
import json
import os
import re
import shutil
from collections import Counter
from pathlib import Path

import numpy as np
import pandas as pd
from datasets import Dataset
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import accuracy_score, precision_recall_fscore_support
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.model_selection import StratifiedGroupKFold
from transformers import (
    AutoModelForSequenceClassification,
    AutoTokenizer,
    DataCollatorWithPadding,
    Trainer,
    TrainingArguments,
)

from model_config import (
    EXPECTED_TASK_LABELS,
    MODEL_NAME,
    TRAINING_DATASET_PATHS,
    TRANSFORMER_MODEL_DIR,
)


OUTPUT_DIR = TRANSFORMER_MODEL_DIR
TEXT_COLUMN = "reason"
TASKS = {
    "sentiment": "sentiment",
    "category": "category",
}


TRAIN_BATCH_SIZE = int(os.getenv("ANIMUA_TRAIN_BATCH_SIZE", "4"))
EVAL_BATCH_SIZE = int(os.getenv("ANIMUA_EVAL_BATCH_SIZE", "8"))
GRADIENT_ACCUMULATION_STEPS = int(
    os.getenv("ANIMUA_GRADIENT_ACCUMULATION_STEPS", "2")
)
NUM_TRAIN_EPOCHS = float(os.getenv("ANIMUA_TRAIN_EPOCHS", "4"))
EVAL_FOLDS = int(os.getenv("ANIMUA_EVAL_FOLDS", "5"))
NEAR_DUPLICATE_THRESHOLD = float(
    os.getenv("ANIMUA_NEAR_DUPLICATE_THRESHOLD", "0.82")
)


def normalize_text(value):
    return str(value or "").strip()


def normalize_reason_key(value):
    return " ".join(normalize_text(value).casefold().split())


def normalize_for_similarity(value):
    return re.sub(r"[^\w]+", " ", normalize_reason_key(value)).strip()


def file_sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def canonical_dataset_sha256(data):
    digest = hashlib.sha256()
    records = data[[TEXT_COLUMN, *TASKS.values()]].to_dict(orient="records")
    encoded = json.dumps(
        records,
        ensure_ascii=False,
        separators=(",", ":"),
    ).encode("utf-8")
    digest.update(encoded)
    return digest.hexdigest()


def load_clean_data(dataset_paths=None):
    selected_paths = (
        TRAINING_DATASET_PATHS if dataset_paths is None else dataset_paths
    )
    paths = tuple(Path(path) for path in selected_paths)
    if not paths:
        raise ValueError("At least one training dataset path is required.")

    frames = []
    source_files = []
    for path in paths:
        if not path.is_file():
            raise ValueError(f"Training dataset was not found: {path}")

        frame = pd.read_csv(path)
        required = {TEXT_COLUMN, *TASKS.values()}
        missing = required.difference(frame.columns)
        if missing:
            raise ValueError(
                f"Training dataset {path.name} is missing required columns: "
                f"{sorted(missing)}"
            )

        frame = frame[[TEXT_COLUMN, *TASKS.values()]].copy()
        frame["__source_file"] = path.name
        frames.append(frame)
        source_files.append(
            {
                "file": path.name,
                "sha256": file_sha256(path),
                "rows": int(len(frame)),
            }
        )

    data = pd.concat(frames, ignore_index=True)

    for column in (TEXT_COLUMN, *TASKS.values()):
        data[column] = data[column].map(normalize_text)

    blank_rows = data.index[data[TEXT_COLUMN] == ""].tolist()
    if blank_rows:
        raise ValueError(
            "Training datasets contain blank surrender reasons at merged row "
            f"indexes: {blank_rows[:10]}"
        )

    for task_name, label_column in TASKS.items():
        blank_labels = data.index[data[label_column] == ""].tolist()
        if blank_labels:
            raise ValueError(
                f"Training datasets contain blank {label_column} labels at "
                f"merged row indexes: {blank_labels[:10]}"
            )
        unexpected = sorted(
            set(data[label_column]).difference(EXPECTED_TASK_LABELS[task_name])
        )
        if unexpected:
            raise ValueError(
                f"Training datasets contain unsupported {label_column} labels: "
                f"{unexpected}"
            )

    data["__reason_key"] = data[TEXT_COLUMN].map(normalize_reason_key)
    conflicts = []
    for reason_key, rows in data.groupby("__reason_key", sort=False):
        label_pairs = {
            (row["sentiment"], row["category"])
            for _, row in rows.iterrows()
        }
        if len(label_pairs) > 1:
            conflicts.append(
                {
                    "reason": rows.iloc[0][TEXT_COLUMN],
                    "labels": sorted(label_pairs),
                    "sources": sorted(set(rows["__source_file"])),
                }
            )
    if conflicts:
        raise ValueError(
            "Conflicting labels were found for duplicate surrender reasons: "
            f"{conflicts[:5]}"
        )

    input_rows = len(data)
    duplicate_reasons = int(data.duplicated(subset=["__reason_key"]).sum())
    source_memberships = (
        data.groupby("__reason_key", sort=False)["__source_file"]
        .apply(lambda values: "+".join(sorted(set(values))))
        .value_counts()
        .sort_index()
        .to_dict()
    )

    data = data.drop_duplicates(subset=["__reason_key"], keep="first").copy()
    data = data[[TEXT_COLUMN, *TASKS.values()]].reset_index(drop=True)

    provenance = {
        "sourceFiles": source_files,
        "inputRows": int(input_rows),
        "effectiveRows": int(len(data)),
        "duplicateNormalizedReasonsRemoved": duplicate_reasons,
        "sourceMemberships": {
            key: int(value) for key, value in source_memberships.items()
        },
        "canonicalSha256": canonical_dataset_sha256(data),
        "labelDistributions": {
            task_name: {
                str(label): int(count)
                for label, count in sorted(Counter(data[column]).items())
            }
            for task_name, column in TASKS.items()
        },
    }
    data.attrs["provenance"] = provenance

    return data


def build_near_duplicate_groups(texts, threshold=NEAR_DUPLICATE_THRESHOLD):
    if not 0 < threshold <= 1:
        raise ValueError(
            "Near-duplicate threshold must be greater than 0 and at most 1."
        )

    normalized = [normalize_for_similarity(text) for text in texts]
    if len(normalized) < 2:
        return np.arange(len(normalized), dtype=int)

    vectors = TfidfVectorizer(
        analyzer="char_wb",
        ngram_range=(3, 5),
        sublinear_tf=True,
    ).fit_transform(normalized)
    similarities = cosine_similarity(
        vectors,
        dense_output=False,
    ).tocoo()

    parents = list(range(len(normalized)))

    def find(index):
        while parents[index] != index:
            parents[index] = parents[parents[index]]
            index = parents[index]
        return index

    def union(left, right):
        left_root = find(left)
        right_root = find(right)
        if left_root != right_root:
            parents[right_root] = left_root

    for left, right, similarity in zip(
        similarities.row,
        similarities.col,
        similarities.data,
    ):
        if left > right and similarity >= threshold:
            union(int(left), int(right))

    root_to_group = {}
    groups = []
    for index in range(len(normalized)):
        root = find(index)
        if root not in root_to_group:
            root_to_group[root] = len(root_to_group)
        groups.append(root_to_group[root])
    return np.asarray(groups, dtype=int)


def split_task_data(task_data):
    if EVAL_FOLDS < 2:
        raise ValueError("ANIMUA_EVAL_FOLDS must be at least 2.")

    groups = build_near_duplicate_groups(task_data[TEXT_COLUMN].tolist())
    splitter = StratifiedGroupKFold(
        n_splits=EVAL_FOLDS,
        shuffle=True,
        random_state=42,
    )
    try:
        train_indexes, eval_indexes = next(
            splitter.split(task_data, task_data["label"], groups)
        )
    except ValueError as error:
        raise ValueError(
            "Unable to create a leakage-resistant grouped split. Add more "
            "independent template groups for each label."
        ) from error

    train_groups = set(groups[train_indexes])
    eval_groups = set(groups[eval_indexes])
    if train_groups.intersection(eval_groups):
        raise RuntimeError("Near-duplicate groups leaked across the data split.")

    split_metadata = {
        "strategy": "stratified-group-k-fold",
        "folds": EVAL_FOLDS,
        "selectedFold": 0,
        "randomSeed": 42,
        "nearDuplicateMethod": "TF-IDF character 3-5 grams + cosine similarity",
        "nearDuplicateThreshold": NEAR_DUPLICATE_THRESHOLD,
        "totalGroups": int(len(set(groups))),
        "trainGroups": int(len(train_groups)),
        "evalGroups": int(len(eval_groups)),
        "trainRows": int(len(train_indexes)),
        "evalRows": int(len(eval_indexes)),
    }
    return (
        task_data.iloc[train_indexes].copy(),
        task_data.iloc[eval_indexes].copy(),
        split_metadata,
    )


def build_label_maps(labels):
    label_list = sorted(str(label) for label in labels)
    label2id = {label: idx for idx, label in enumerate(label_list)}
    id2label = {idx: label for label, idx in label2id.items()}
    return label2id, id2label


def tokenize_dataset(dataset, tokenizer):
    def tokenize(batch):
        return tokenizer(batch[TEXT_COLUMN], truncation=True, max_length=160)

    return dataset.map(tokenize, batched=True)


def compute_metrics(eval_prediction):
    logits, labels = eval_prediction
    predictions = np.argmax(logits, axis=-1)
    precision_weighted, recall_weighted, f1_weighted, _ = (
        precision_recall_fscore_support(
            labels,
            predictions,
            average="weighted",
            zero_division=0,
        )
    )
    _, _, f1_macro, _ = precision_recall_fscore_support(
        labels,
        predictions,
        average="macro",
        zero_division=0,
    )

    return {
        "accuracy": accuracy_score(labels, predictions),
        "precision_weighted": precision_weighted,
        "recall_weighted": recall_weighted,
        "f1_weighted": f1_weighted,
        "f1_macro": f1_macro,
    }


def train_task(data, task_name, label_column, dataset_provenance):
    task_dir = OUTPUT_DIR / task_name
    task_dir.mkdir(parents=True, exist_ok=True)

    label2id, id2label = build_label_maps(data[label_column].dropna().unique())

    task_data = data[[TEXT_COLUMN, label_column]].copy()
    task_data["label"] = task_data[label_column].map(lambda value: label2id[str(value)])

    train_df, eval_df, split_metadata = split_task_data(task_data)

    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    model = AutoModelForSequenceClassification.from_pretrained(
        MODEL_NAME,
        num_labels=len(label2id),
        id2label=id2label,
        label2id=label2id,
    )

    train_dataset = tokenize_dataset(Dataset.from_pandas(train_df), tokenizer)
    eval_dataset = tokenize_dataset(Dataset.from_pandas(eval_df), tokenizer)
    data_collator = DataCollatorWithPadding(tokenizer=tokenizer)

    training_args = TrainingArguments(
        output_dir=str(task_dir / "checkpoints"),
        eval_strategy="epoch",
        save_strategy="epoch",
        learning_rate=2e-5,
        per_device_train_batch_size=TRAIN_BATCH_SIZE,
        per_device_eval_batch_size=EVAL_BATCH_SIZE,
        gradient_accumulation_steps=GRADIENT_ACCUMULATION_STEPS,
        num_train_epochs=NUM_TRAIN_EPOCHS,
        weight_decay=0.01,
        load_best_model_at_end=True,
        metric_for_best_model="f1_weighted",
        save_total_limit=1,
        dataloader_pin_memory=False,
        logging_steps=10,
        report_to="none",
        seed=42,
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
        processing_class=tokenizer,
        data_collator=data_collator,
        compute_metrics=compute_metrics,
    )

    trainer.train()
    metrics = trainer.evaluate()

    trainer.save_model(task_dir)
    tokenizer.save_pretrained(task_dir)
    shutil.rmtree(task_dir / "checkpoints", ignore_errors=True)

    with open(task_dir / "labels.json", "w", encoding="utf-8") as file:
        json.dump(
            {
                "task": task_name,
                "source_model": MODEL_NAME,
                "label2id": label2id,
                "id2label": id2label,
                "train_rows": len(train_df),
                "eval_rows": len(eval_df),
                "dataset": dataset_provenance,
                "split": split_metadata,
                "metrics": metrics,
            },
            file,
            indent=2,
        )

    return {
        "metrics": metrics,
        "split": split_metadata,
    }


def main():
    data = load_clean_data()
    dataset_provenance = data.attrs["provenance"]
    print(
        f"Loaded {len(data)} unique clean rows from "
        f"{len(dataset_provenance['sourceFiles'])} source files"
    )
    print(f"Canonical dataset SHA-256: {dataset_provenance['canonicalSha256']}")
    print(f"Fine-tuning Tagalog RoBERTa checkpoint: {MODEL_NAME}")

    results = {}
    for task_name, label_column in TASKS.items():
        print(f"\nTraining Tagalog RoBERTa {task_name} classifier...")
        results[task_name] = train_task(
            data,
            task_name,
            label_column,
            dataset_provenance,
        )

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_DIR / "training_results.json", "w", encoding="utf-8") as file:
        json.dump(
            {
                "sourceModel": MODEL_NAME,
                "dataset": dataset_provenance,
                "tasks": results,
            },
            file,
            ensure_ascii=False,
            indent=2,
        )

    print("\nTraining complete.")
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
