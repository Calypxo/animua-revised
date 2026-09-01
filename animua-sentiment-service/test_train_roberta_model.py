import csv
import tempfile
import unittest
from pathlib import Path

import pandas as pd

from train_roberta_model import (
    TEXT_COLUMN,
    build_label_maps,
    build_near_duplicate_groups,
    load_clean_data,
    split_task_data,
)


def write_training_csv(path, rows):
    with open(path, "w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(
            file,
            fieldnames=("reason", "sentiment", "category"),
        )
        writer.writeheader()
        writer.writerows(rows)


class TrainingDataTests(unittest.TestCase):
    def test_both_sources_are_loaded_and_normalized_duplicates_are_removed(self):
        with tempfile.TemporaryDirectory() as directory:
            primary_path = Path(directory) / "primary.csv"
            additional_path = Path(directory) / "additional.csv"
            write_training_csv(
                primary_path,
                [
                    {
                        "reason": "A medical surrender reason.",
                        "sentiment": "Negative",
                        "category": "Medical",
                    },
                    {
                        "reason": "A neutral surrender reason.",
                        "sentiment": "Neutral",
                        "category": "Other",
                    },
                ],
            )
            write_training_csv(
                additional_path,
                [
                    {
                        "reason": "  A MEDICAL  surrender reason. ",
                        "sentiment": "Negative",
                        "category": "Medical",
                    },
                    {
                        "reason": "An urgent surrender reason.",
                        "sentiment": "Urgent",
                        "category": "Abandonment Risk",
                    },
                ],
            )

            data = load_clean_data((primary_path, additional_path))
            provenance = data.attrs["provenance"]

        self.assertEqual(len(data), 3)
        self.assertEqual(provenance["inputRows"], 4)
        self.assertEqual(provenance["effectiveRows"], 3)
        self.assertEqual(provenance["duplicateNormalizedReasonsRemoved"], 1)
        self.assertEqual(len(provenance["canonicalSha256"]), 64)
        self.assertEqual(
            [source["rows"] for source in provenance["sourceFiles"]],
            [2, 2],
        )

    def test_conflicting_duplicate_labels_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            primary_path = Path(directory) / "primary.csv"
            additional_path = Path(directory) / "additional.csv"
            write_training_csv(
                primary_path,
                [
                    {
                        "reason": "The same reason.",
                        "sentiment": "Neutral",
                        "category": "Other",
                    }
                ],
            )
            write_training_csv(
                additional_path,
                [
                    {
                        "reason": "THE SAME reason.",
                        "sentiment": "Negative",
                        "category": "Other",
                    }
                ],
            )

            with self.assertRaisesRegex(ValueError, "Conflicting labels"):
                load_clean_data((primary_path, additional_path))

    def test_current_additional_rows_are_all_in_the_effective_dataset(self):
        service_dir = Path(__file__).resolve().parent
        data = load_clean_data()
        additional = pd.read_csv(service_dir / "additional_training.csv")

        effective = {
            " ".join(str(reason).strip().casefold().split())
            for reason in data[TEXT_COLUMN]
        }
        additional_reasons = {
            " ".join(str(reason).strip().casefold().split())
            for reason in additional[TEXT_COLUMN]
        }

        self.assertEqual(len(data), 493)
        self.assertEqual(len(additional_reasons), 400)
        self.assertTrue(additional_reasons.issubset(effective))

    def test_template_variants_share_a_near_duplicate_group(self):
        texts = [
            "Dahil po aso ko ay may sakit at hindi na namin kaya ang gamutan.",
            "Dahil po pusa namin ay may sakit at hindi na namin kaya ang gamutan.",
            "We are moving abroad and cannot bring the cat.",
        ]

        groups = build_near_duplicate_groups(texts)

        self.assertEqual(groups[0], groups[1])
        self.assertNotEqual(groups[0], groups[2])

    def test_grouped_split_has_no_template_overlap(self):
        data = load_clean_data()
        label2id, _ = build_label_maps(data["category"].unique())
        task_data = data[[TEXT_COLUMN, "category"]].copy()
        task_data["label"] = task_data["category"].map(label2id)
        all_groups = build_near_duplicate_groups(task_data[TEXT_COLUMN])

        train, evaluation, metadata = split_task_data(task_data)
        train_groups = set(all_groups[train.index])
        evaluation_groups = set(all_groups[evaluation.index])

        self.assertFalse(train_groups.intersection(evaluation_groups))
        self.assertEqual(len(train) + len(evaluation), len(data))
        self.assertEqual(metadata["strategy"], "stratified-group-k-fold")


if __name__ == "__main__":
    unittest.main()
