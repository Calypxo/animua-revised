# Locked Surrender Evaluation Dataset

This folder is for the independent, manually labeled test set used to report
Tagalog RoBERTa performance. It must not be used for training, rule writing,
threshold selection, or debugging individual model errors.

## Workflow

1. Add anonymized surrender reasons that do not appear in either
   `surrender_sentiment_dataset.csv` or `additional_training.csv`.
2. Assign each row to two independent reviewers. Use reviewer codes rather than
   personal names when the paper does not require names.
3. Each reviewer labels sentiment and category without seeing the model output
   or the other reviewer's labels.
4. If the reviewers disagree, an adjudicator selects the final labels and their
   code is recorded in `adjudicator_id`.
5. Set `label_status` to `locked` only after the final labels are approved.
   Incomplete rows must remain `pending`.
6. Never change a locked label after viewing evaluation results. Corrections
   should be documented as a new dataset version.

Remove names, phone numbers, addresses, email addresses, tracking numbers, and
other personally identifying information from `reason` before labeling.

## Required columns

- `evaluation_id`: Stable, non-identifying ID such as `SE-0001`.
- `reason`: Anonymized owner-written surrender reason.
- `source_group`: Collection batch or source family used to detect leakage,
  such as `real-2026-q3` or `expert-authored-pilot`.
- `language_mix`: Suggested values are `Tagalog`, `English`, or `Taglish`.
- `annotator_1_id`, `annotator_2_id`: Different reviewer codes.
- `annotator_1_sentiment`, `annotator_2_sentiment`: Independent sentiment
  labels.
- `annotator_1_category`, `annotator_2_category`: Independent category labels.
- `adjudicator_id`: Required whenever the reviewers disagree.
- `final_sentiment`, `final_category`: Approved ground-truth labels.
- `label_status`: `pending` or `locked`.
- `notes`: Optional annotation note; do not include personal information.

## Allowed labels

Sentiment:

- `Urgent`: Immediate safety, abandonment, or time-critical welfare concern.
- `Negative`: A negative surrender situation without an immediate critical
  threat.
- `Neutral`: Primarily factual or non-urgent wording.

Category:

- `Medical`
- `Financial`
- `Relocation`
- `Behavioral`
- `Overcrowding`
- `Abandonment Risk`
- `Owner Incapacity`
- `Other`

When more than one category appears possible, reviewers should label the main
reason for surrender stated by the owner and explain the decision in `notes`.

## Coverage target

For a pilot, collect at least 20 locked examples for every category. Fifty or
more per category is stronger. Include natural Tagalog, English, and Taglish
wording and avoid creating many rows from the same sentence template.

## Evaluation command

From this service folder:

```powershell
.\.venv\Scripts\python.exe .\evaluate_roberta.py `
  --data .\evaluation\surrender_evaluation.csv `
  --minimum-per-class 20 `
  --strict-coverage
```

The command does not train or modify either model. It rejects exact overlap
with every configured training source and writes the evaluation dataset hash,
the training-source hashes, JSON metrics, and a prediction-level CSV to
`evaluation/results/`.
