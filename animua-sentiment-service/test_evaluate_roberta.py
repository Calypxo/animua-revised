import csv
import tempfile
import unittest
from pathlib import Path

from evaluate_roberta import (
    REQUIRED_COLUMNS,
    evaluate_rows,
    find_exact_training_overlaps,
    load_locked_rows,
)


def evaluation_row(identifier, reason, sentiment, category, **overrides):
    row = {
        "evaluation_id": identifier,
        "reason": reason,
        "source_group": "independent-pilot",
        "language_mix": "Taglish",
        "annotator_1_id": "R1",
        "annotator_1_sentiment": sentiment,
        "annotator_1_category": category,
        "annotator_2_id": "R2",
        "annotator_2_sentiment": sentiment,
        "annotator_2_category": category,
        "adjudicator_id": "",
        "final_sentiment": sentiment,
        "final_category": category,
        "label_status": "locked",
        "notes": "",
    }
    row.update(overrides)
    return row


def write_csv(path, rows, fieldnames=REQUIRED_COLUMNS):
    with open(path, "w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


class EvaluationDatasetTests(unittest.TestCase):
    def test_only_complete_locked_rows_are_loaded(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "evaluation.csv"
            pending = evaluation_row(
                "SE-0002",
                "Pending independent reason.",
                "Neutral",
                "Other",
                label_status="pending",
                final_sentiment="",
                final_category="",
            )
            write_csv(
                path,
                [
                    evaluation_row(
                        "SE-0001",
                        "Independent overcrowding wording.",
                        "Negative",
                        "Overcrowding",
                    ),
                    pending,
                ],
            )

            rows = load_locked_rows(path)

        self.assertEqual([row["evaluation_id"] for row in rows], ["SE-0001"])

    def test_disagreement_requires_an_adjudicator(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "evaluation.csv"
            write_csv(
                path,
                [
                    evaluation_row(
                        "SE-0001",
                        "A disputed independent reason.",
                        "Negative",
                        "Other",
                        annotator_2_category="Financial",
                    )
                ],
            )

            with self.assertRaisesRegex(ValueError, "adjudicator_id"):
                load_locked_rows(path)

    def test_exact_training_overlap_is_reported(self):
        with tempfile.TemporaryDirectory() as directory:
            evaluation_path = Path(directory) / "evaluation.csv"
            training_path = Path(directory) / "training.csv"
            write_csv(
                evaluation_path,
                [
                    evaluation_row(
                        "SE-0001",
                        "The same surrender reason.",
                        "Neutral",
                        "Other",
                    )
                ],
            )
            with open(training_path, "w", encoding="utf-8", newline="") as file:
                writer = csv.DictWriter(
                    file,
                    fieldnames=("reason", "sentiment", "category"),
                )
                writer.writeheader()
                writer.writerow(
                    {
                        "reason": "  THE SAME   surrender reason. ",
                        "sentiment": "Neutral",
                        "category": "Other",
                    }
                )

            rows = load_locked_rows(evaluation_path)
            overlaps = find_exact_training_overlaps(rows, training_path)

        self.assertEqual(overlaps, ["SE-0001"])

    def test_overlap_check_reads_every_training_source(self):
        with tempfile.TemporaryDirectory() as directory:
            evaluation_path = Path(directory) / "evaluation.csv"
            primary_path = Path(directory) / "primary.csv"
            additional_path = Path(directory) / "additional.csv"
            write_csv(
                evaluation_path,
                [
                    evaluation_row(
                        "SE-0001",
                        "Only present in the additional source.",
                        "Neutral",
                        "Other",
                    )
                ],
            )
            for path, reason in (
                (primary_path, "A primary training reason."),
                (additional_path, "Only present in the additional source."),
            ):
                with open(path, "w", encoding="utf-8", newline="") as file:
                    writer = csv.DictWriter(
                        file,
                        fieldnames=("reason", "sentiment", "category"),
                    )
                    writer.writeheader()
                    writer.writerow(
                        {
                            "reason": reason,
                            "sentiment": "Neutral",
                            "category": "Other",
                        }
                    )

            rows = load_locked_rows(evaluation_path)
            overlaps = find_exact_training_overlaps(
                rows,
                (primary_path, additional_path),
            )

        self.assertEqual(overlaps, ["SE-0001"])


class EvaluationMetricsTests(unittest.TestCase):
    def test_raw_and_end_to_end_category_metrics_are_separate(self):
        rows = [
            evaluation_row(
                "SE-0001",
                "Independent overcrowding reason.",
                "Negative",
                "Overcrowding",
            ),
            evaluation_row(
                "SE-0002",
                "Independent medical emergency.",
                "Urgent",
                "Medical",
            ),
            evaluation_row(
                "SE-0003",
                "Independent neutral reason.",
                "Neutral",
                "Other",
            ),
        ]
        outputs = {
            "Independent overcrowding reason.": {
                "sentiment": "Negative",
                "modelCategory": "Other",
                "category": "Overcrowding",
                "categoryAdjustmentReason": "Explicit overcrowding constraint",
                "sentimentConfidence": 0.91,
                "categoryConfidence": 0.72,
                "source": "Tagalog RoBERTa Transformer",
                "rulesVersion": "test-rules",
            },
            "Independent medical emergency.": {
                "sentiment": "Urgent",
                "modelCategory": "Medical",
                "category": "Medical",
                "categoryAdjustmentReason": "",
                "sentimentConfidence": 0.95,
                "categoryConfidence": 0.94,
                "source": "Tagalog RoBERTa Transformer",
                "rulesVersion": "test-rules",
            },
            "Independent neutral reason.": {
                "sentiment": "Neutral",
                "modelCategory": "Other",
                "category": "Other",
                "categoryAdjustmentReason": "",
                "sentimentConfidence": 0.88,
                "categoryConfidence": 0.86,
                "source": "Tagalog RoBERTa Transformer",
                "rulesVersion": "test-rules",
            },
        }

        result = evaluate_rows(
            rows,
            analyzer=lambda reason: outputs[reason],
            expected_source="Tagalog RoBERTa Transformer",
        )

        self.assertEqual(result["metrics"]["categoryRawModel"]["correct"], 2)
        self.assertEqual(result["metrics"]["categoryEndToEnd"]["correct"], 3)
        self.assertEqual(result["metrics"]["sentimentRawModel"]["accuracy"], 1.0)
        self.assertEqual(result["categoryRuleImpact"]["corrected"], 1)
        self.assertEqual(result["categoryRuleImpact"]["harmed"], 0)


if __name__ == "__main__":
    unittest.main()
