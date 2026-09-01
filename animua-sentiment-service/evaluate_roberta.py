import argparse
import csv
import hashlib
import json
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

from sklearn.metrics import accuracy_score, classification_report, confusion_matrix


SERVICE_DIR = Path(__file__).resolve().parent
DEFAULT_DATA_PATH = SERVICE_DIR / "evaluation" / "surrender_evaluation.csv"
DEFAULT_OUTPUT_DIR = SERVICE_DIR / "evaluation" / "results"

SENTIMENT_LABELS = ("Negative", "Neutral", "Urgent")
CATEGORY_LABELS = (
    "Abandonment Risk",
    "Behavioral",
    "Financial",
    "Medical",
    "Other",
    "Overcrowding",
    "Owner Incapacity",
    "Relocation",
)

REQUIRED_COLUMNS = (
    "evaluation_id",
    "reason",
    "source_group",
    "language_mix",
    "annotator_1_id",
    "annotator_1_sentiment",
    "annotator_1_category",
    "annotator_2_id",
    "annotator_2_sentiment",
    "annotator_2_category",
    "adjudicator_id",
    "final_sentiment",
    "final_category",
    "label_status",
    "notes",
)


def clean(value):
    return str(value or "").strip()


def normalize_reason(value):
    return " ".join(clean(value).casefold().split())


def file_sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def validate_label(value, allowed, field_name, row_number):
    if value not in allowed:
        raise ValueError(
            f"Row {row_number}: {field_name} must be one of {list(allowed)}; "
            f"received {value!r}."
        )


def load_locked_rows(path):
    path = Path(path)
    if not path.is_file():
        raise ValueError(f"Evaluation dataset was not found: {path}")

    with open(path, "r", encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)
        headers = tuple(reader.fieldnames or ())
        missing = [column for column in REQUIRED_COLUMNS if column not in headers]
        if missing:
            raise ValueError(f"Evaluation dataset is missing columns: {missing}")

        locked_rows = []
        seen_ids = set()
        seen_reasons = set()

        for row_number, raw_row in enumerate(reader, start=2):
            row = {column: clean(raw_row.get(column)) for column in REQUIRED_COLUMNS}
            if not any(row.values()):
                continue

            status = row["label_status"].casefold()
            if status not in {"pending", "locked"}:
                raise ValueError(
                    f"Row {row_number}: label_status must be 'pending' or 'locked'."
                )
            if status == "pending":
                continue

            required_locked = (
                "evaluation_id",
                "reason",
                "source_group",
                "annotator_1_id",
                "annotator_1_sentiment",
                "annotator_1_category",
                "annotator_2_id",
                "annotator_2_sentiment",
                "annotator_2_category",
                "final_sentiment",
                "final_category",
            )
            blank = [column for column in required_locked if not row[column]]
            if blank:
                raise ValueError(
                    f"Row {row_number}: locked row has blank required fields: {blank}"
                )

            if row["annotator_1_id"].casefold() == row["annotator_2_id"].casefold():
                raise ValueError(
                    f"Row {row_number}: independent annotators must use different IDs."
                )

            for prefix in ("annotator_1", "annotator_2"):
                validate_label(
                    row[f"{prefix}_sentiment"],
                    SENTIMENT_LABELS,
                    f"{prefix}_sentiment",
                    row_number,
                )
                validate_label(
                    row[f"{prefix}_category"],
                    CATEGORY_LABELS,
                    f"{prefix}_category",
                    row_number,
                )
            validate_label(
                row["final_sentiment"],
                SENTIMENT_LABELS,
                "final_sentiment",
                row_number,
            )
            validate_label(
                row["final_category"],
                CATEGORY_LABELS,
                "final_category",
                row_number,
            )

            disagreement = (
                row["annotator_1_sentiment"] != row["annotator_2_sentiment"]
                or row["annotator_1_category"] != row["annotator_2_category"]
            )
            final_differs = (
                row["final_sentiment"] != row["annotator_1_sentiment"]
                or row["final_category"] != row["annotator_1_category"]
            )
            if (disagreement or final_differs) and not row["adjudicator_id"]:
                raise ValueError(
                    f"Row {row_number}: adjudicator_id is required when labels differ."
                )

            normalized = normalize_reason(row["reason"])
            if row["evaluation_id"] in seen_ids:
                raise ValueError(
                    f"Row {row_number}: duplicate evaluation_id "
                    f"{row['evaluation_id']!r}."
                )
            if normalized in seen_reasons:
                raise ValueError(
                    f"Row {row_number}: duplicate normalized surrender reason."
                )

            seen_ids.add(row["evaluation_id"])
            seen_reasons.add(normalized)
            locked_rows.append(row)

    if not locked_rows:
        raise ValueError(
            "No locked evaluation rows were found. Add independently reviewed "
            "rows and set label_status to 'locked'."
        )
    return locked_rows


def find_exact_training_overlaps(rows, training_paths):
    if isinstance(training_paths, (str, Path)):
        training_paths = (training_paths,)

    training_reasons = set()
    for training_path in (Path(path) for path in training_paths):
        if not training_path.is_file():
            raise ValueError(f"Training dataset was not found: {training_path}")

        with open(training_path, "r", encoding="utf-8-sig", newline="") as file:
            reader = csv.DictReader(file)
            if "reason" not in (reader.fieldnames or []):
                raise ValueError(
                    f"Training dataset {training_path.name} is missing the "
                    "reason column."
                )
            training_reasons.update(
                normalize_reason(row.get("reason"))
                for row in reader
                if normalize_reason(row.get("reason"))
            )

    return [
        row["evaluation_id"]
        for row in rows
        if normalize_reason(row["reason"]) in training_reasons
    ]


def rounded(value):
    return round(float(value), 6)


def classification_metrics(actual, predicted, labels):
    report = classification_report(
        actual,
        predicted,
        labels=list(labels),
        output_dict=True,
        zero_division=0,
    )
    matrix = confusion_matrix(actual, predicted, labels=list(labels))

    return {
        "count": len(actual),
        "correct": sum(left == right for left, right in zip(actual, predicted)),
        "accuracy": rounded(accuracy_score(actual, predicted)),
        "macro": {
            "precision": rounded(report["macro avg"]["precision"]),
            "recall": rounded(report["macro avg"]["recall"]),
            "f1": rounded(report["macro avg"]["f1-score"]),
        },
        "weighted": {
            "precision": rounded(report["weighted avg"]["precision"]),
            "recall": rounded(report["weighted avg"]["recall"]),
            "f1": rounded(report["weighted avg"]["f1-score"]),
        },
        "perClass": {
            label: {
                "precision": rounded(report[label]["precision"]),
                "recall": rounded(report[label]["recall"]),
                "f1": rounded(report[label]["f1-score"]),
                "support": int(report[label]["support"]),
            }
            for label in labels
        },
        "confusionMatrix": {
            "labels": list(labels),
            "orientation": "rows=actual, columns=predicted",
            "values": matrix.astype(int).tolist(),
        },
    }


def validate_prediction(label, allowed, field_name, evaluation_id):
    if label not in allowed:
        raise ValueError(
            f"{evaluation_id}: model returned unsupported {field_name} {label!r}."
        )


def evaluate_rows(rows, analyzer, expected_source=None):
    predictions = []
    source_counts = Counter()
    rules_versions = set()

    impact = {
        "adjusted": 0,
        "corrected": 0,
        "harmed": 0,
        "changedButStillWrong": 0,
        "unchanged": 0,
    }

    for row in rows:
        result = analyzer(row["reason"])
        sentiment = clean(result.get("sentiment"))
        raw_category = clean(result.get("modelCategory"))
        final_category = clean(result.get("category"))
        source = clean(result.get("source"))
        rules_version = clean(result.get("rulesVersion"))

        validate_prediction(
            sentiment,
            SENTIMENT_LABELS,
            "sentiment",
            row["evaluation_id"],
        )
        validate_prediction(
            raw_category,
            CATEGORY_LABELS,
            "raw category",
            row["evaluation_id"],
        )
        validate_prediction(
            final_category,
            CATEGORY_LABELS,
            "final category",
            row["evaluation_id"],
        )
        if expected_source and source != expected_source:
            raise ValueError(
                f"{row['evaluation_id']}: expected source {expected_source!r}, "
                f"received {source!r}."
            )

        raw_correct = raw_category == row["final_category"]
        final_correct = final_category == row["final_category"]
        if raw_category != final_category:
            impact["adjusted"] += 1
            if not raw_correct and final_correct:
                impact["corrected"] += 1
            elif raw_correct and not final_correct:
                impact["harmed"] += 1
            else:
                impact["changedButStillWrong"] += 1
        else:
            impact["unchanged"] += 1

        source_counts[source] += 1
        if rules_version:
            rules_versions.add(rules_version)
        predictions.append(
            {
                "evaluation_id": row["evaluation_id"],
                "reason": row["reason"],
                "source_group": row["source_group"],
                "language_mix": row["language_mix"],
                "actual_sentiment": row["final_sentiment"],
                "predicted_sentiment": sentiment,
                "actual_category": row["final_category"],
                "raw_model_category": raw_category,
                "final_pipeline_category": final_category,
                "category_adjusted": raw_category != final_category,
                "category_adjustment_reason": clean(
                    result.get("categoryAdjustmentReason")
                ),
                "sentiment_confidence": result.get("sentimentConfidence"),
                "category_confidence": result.get("categoryConfidence"),
                "source": source,
                "rules_version": rules_version,
            }
        )

    actual_sentiment = [row["final_sentiment"] for row in rows]
    actual_category = [row["final_category"] for row in rows]
    predicted_sentiment = [row["predicted_sentiment"] for row in predictions]
    raw_categories = [row["raw_model_category"] for row in predictions]
    final_categories = [row["final_pipeline_category"] for row in predictions]

    return {
        "metrics": {
            "sentimentRawModel": classification_metrics(
                actual_sentiment,
                predicted_sentiment,
                SENTIMENT_LABELS,
            ),
            "categoryRawModel": classification_metrics(
                actual_category,
                raw_categories,
                CATEGORY_LABELS,
            ),
            "categoryEndToEnd": classification_metrics(
                actual_category,
                final_categories,
                CATEGORY_LABELS,
            ),
        },
        "categoryRuleImpact": impact,
        "sourceCounts": dict(sorted(source_counts.items())),
        "rulesVersions": sorted(rules_versions),
        "predictions": predictions,
    }


def build_coverage(rows, minimum_per_class):
    sentiment_counts = Counter(row["final_sentiment"] for row in rows)
    category_counts = Counter(row["final_category"] for row in rows)

    def task_coverage(labels, counts):
        below = [label for label in labels if counts[label] < minimum_per_class]
        return {
            "minimumPerClass": minimum_per_class,
            "counts": {label: counts[label] for label in labels},
            "belowMinimum": below,
        }

    return {
        "sentiment": task_coverage(SENTIMENT_LABELS, sentiment_counts),
        "category": task_coverage(CATEGORY_LABELS, category_counts),
    }


def write_predictions(path, predictions):
    fieldnames = list(predictions[0])
    with open(path, "w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(predictions)


def parse_args(argv=None):
    parser = argparse.ArgumentParser(
        description=(
            "Evaluate the installed Tagalog RoBERTa models and final category "
            "rules on a locked, manually labeled dataset without retraining."
        )
    )
    parser.add_argument("--data", type=Path, default=DEFAULT_DATA_PATH)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--minimum-per-class", type=int, default=20)
    parser.add_argument(
        "--strict-coverage",
        action="store_true",
        help="Fail when any sentiment or category has fewer than the minimum rows.",
    )
    return parser.parse_args(argv)


def run(argv=None):
    args = parse_args(argv)
    if args.minimum_per_class < 1:
        raise ValueError("minimum-per-class must be at least 1.")

    from app import MODEL_SOURCE_LABEL, analyze_reason, transformer_status
    from model_config import TRAINING_DATASET_PATHS

    ready, task_status = transformer_status()
    if not ready:
        raise ValueError(
            "Tagalog RoBERTa is not ready; refusing to report fallback-model "
            f"metrics. Task status: {task_status}"
        )

    rows = load_locked_rows(args.data)
    overlaps = find_exact_training_overlaps(rows, TRAINING_DATASET_PATHS)
    if overlaps:
        raise ValueError(
            "Evaluation rows overlap the training dataset: "
            f"{overlaps}. Replace them before evaluating."
        )

    evaluation = evaluate_rows(
        rows,
        analyzer=analyze_reason,
        expected_source=MODEL_SOURCE_LABEL,
    )
    coverage = build_coverage(rows, args.minimum_per_class)
    below_minimum = {
        task: details["belowMinimum"]
        for task, details in coverage.items()
        if details["belowMinimum"]
    }
    if args.strict_coverage and below_minimum:
        raise ValueError(
            "Strict coverage failed. Labels below the minimum: "
            f"{below_minimum}"
        )

    args.output_dir.mkdir(parents=True, exist_ok=True)
    json_path = args.output_dir / "roberta_evaluation_results.json"
    predictions_path = args.output_dir / "roberta_evaluation_predictions.csv"

    report = {
        "metadata": {
            "evaluatedAtUtc": datetime.now(timezone.utc).isoformat(),
            "dataset": str(args.data.resolve()),
            "datasetSha256": file_sha256(args.data),
            "lockedRows": len(rows),
            "trainingOverlapCount": 0,
            "trainingDatasets": [
                {
                    "file": path.name,
                    "sha256": file_sha256(path),
                }
                for path in TRAINING_DATASET_PATHS
            ],
            "minimumPerClass": args.minimum_per_class,
            "strictCoverage": args.strict_coverage,
        },
        "coverage": coverage,
        **{key: value for key, value in evaluation.items() if key != "predictions"},
    }

    with open(json_path, "w", encoding="utf-8") as file:
        json.dump(report, file, ensure_ascii=False, indent=2)
    write_predictions(predictions_path, evaluation["predictions"])

    print(f"Evaluated {len(rows)} locked rows without retraining.")
    print(f"Dataset SHA-256: {report['metadata']['datasetSha256']}")
    for key, label in (
        ("sentimentRawModel", "Sentiment raw model"),
        ("categoryRawModel", "Category raw model"),
        ("categoryEndToEnd", "Category end-to-end"),
    ):
        metric = report["metrics"][key]
        print(
            f"{label}: accuracy={metric['accuracy']:.4f}, "
            f"macro_f1={metric['macro']['f1']:.4f}, "
            f"weighted_f1={metric['weighted']['f1']:.4f}"
        )
    if below_minimum:
        print(
            f"Coverage warning (minimum {args.minimum_per_class}): "
            f"{below_minimum}"
        )
    print(f"JSON results: {json_path.resolve()}")
    print(f"Prediction details: {predictions_path.resolve()}")
    return 0


def main():
    try:
        return run()
    except ValueError as error:
        print(f"Evaluation failed: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
