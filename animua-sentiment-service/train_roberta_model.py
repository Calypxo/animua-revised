import json
import os
import shutil

import numpy as np
import pandas as pd
from datasets import Dataset
from sklearn.metrics import accuracy_score, precision_recall_fscore_support
from sklearn.model_selection import train_test_split
from transformers import (
    AutoModelForSequenceClassification,
    AutoTokenizer,
    DataCollatorWithPadding,
    Trainer,
    TrainingArguments,
)

from model_config import DATASET_PATH, MODEL_NAME, TRANSFORMER_MODEL_DIR


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


def normalize_text(value):
    return str(value or "").strip()


def load_clean_data():
    data = pd.read_csv(DATASET_PATH)

    required = {TEXT_COLUMN, *TASKS.values()}
    missing = required.difference(data.columns)
    if missing:
        raise ValueError(f"Dataset is missing required columns: {sorted(missing)}")

    data[TEXT_COLUMN] = data[TEXT_COLUMN].map(normalize_text)
    data = data[data[TEXT_COLUMN] != ""].copy()
    data = data.drop_duplicates(subset=[TEXT_COLUMN])
    return data


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


def train_task(data, task_name, label_column):
    task_dir = OUTPUT_DIR / task_name
    task_dir.mkdir(parents=True, exist_ok=True)

    label2id, id2label = build_label_maps(data[label_column].dropna().unique())

    task_data = data[[TEXT_COLUMN, label_column]].copy()
    task_data["label"] = task_data[label_column].map(lambda value: label2id[str(value)])

    train_df, eval_df = train_test_split(
        task_data,
        test_size=0.2,
        random_state=42,
        stratify=task_data["label"],
    )

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
                "metrics": metrics,
            },
            file,
            indent=2,
        )

    return metrics


def main():
    data = load_clean_data()
    print(f"Loaded {len(data)} clean rows from {DATASET_PATH}")
    print(f"Fine-tuning Tagalog RoBERTa checkpoint: {MODEL_NAME}")

    results = {}
    for task_name, label_column in TASKS.items():
        print(f"\nTraining Tagalog RoBERTa {task_name} classifier...")
        results[task_name] = train_task(data, task_name, label_column)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_DIR / "training_results.json", "w", encoding="utf-8") as file:
        json.dump(results, file, indent=2)

    print("\nTraining complete.")
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
