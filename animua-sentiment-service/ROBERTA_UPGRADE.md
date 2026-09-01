# Tagalog RoBERTa Surrender Classifier

This service fine-tunes
[`jcblaise/roberta-tagalog-base`](https://huggingface.co/jcblaise/roberta-tagalog-base)
for Tagalog and mixed Tagalog-English surrender text analysis.

It trains two classifiers from the validated union of:

- `surrender_sentiment_dataset.csv`
- `additional_training.csv`

The loader normalizes surrender reasons, removes duplicate reasons found in
both files, and fails before training if a duplicate has conflicting labels or
if a row contains a blank/unsupported label. You do not need to run
`combine_training_data.py` before training.

The classifiers are:

- `sentiment`: predicts `Urgent`, `Neutral`, or `Negative`
- `category`: predicts labels such as `Medical`, `Financial`, `Relocation`, `Behavioral`, and the other categories already present in the dataset

## Install Dependencies

```bash
uv venv --python 3.12
uv pip install torch --index-url https://download.pytorch.org/whl/cpu
uv pip install -r requirements-training.txt
```

On Windows PowerShell, use `.venv\Scripts\python.exe` for the remaining
commands. The separate PyTorch command installs the smaller CPU-only build used
on machines without an NVIDIA GPU.

## Train RoBERTa

Run this from the `animua-sentiment-service` folder:

```bash
.venv\Scripts\python.exe train_roberta_model.py
```

The first run downloads `jcblaise/roberta-tagalog-base` from Hugging Face, then
saves the fine-tuned models to:

```text
models/roberta/sentiment
models/roberta/category
```

Training/evaluation metrics are saved to:

```text
models/roberta/training_results.json
models/roberta/sentiment/labels.json
models/roberta/category/labels.json
```

Every `labels.json` records both source-file SHA-256 hashes, the canonical
deduplicated dataset hash, row counts, class distributions, and split details.
`training_results.json` records the same provenance for the complete run. This
makes it possible to verify exactly which dataset version produced an artifact.

The validation split uses stratified group folds. Near-duplicate sentence
templates are grouped using character n-gram similarity, and a complete group
is assigned to either training or validation. This prevents variants such as
the same sentence with `aso` and `pusa` from appearing on opposite sides of the
split and inflating validation performance.

The metrics include accuracy, weighted precision, weighted recall, weighted F1, and macro F1.
Only the best final task models are retained; temporary optimizer checkpoints
are removed after each task to save disk space.

Optional training controls:

```text
ANIMUA_EVAL_FOLDS=5
ANIMUA_NEAR_DUPLICATE_THRESHOLD=0.82
```

Keep the default similarity threshold unless a reviewed data audit shows that
the template grouping is too broad or too narrow.

## Evaluate on a locked independent test set

Training metrics are validation metrics, not final independent test results.
For paper-ready evaluation, add independently reviewed rows to
`evaluation/surrender_evaluation.csv` using the protocol in
`evaluation/README.md`, then run:

```powershell
.\.venv\Scripts\python.exe .\evaluate_roberta.py `
  --data .\evaluation\surrender_evaluation.csv `
  --minimum-per-class 20 `
  --strict-coverage
```

This command does not retrain or modify the saved models. It reports raw
sentiment, raw category, and final rule-adjusted category metrics separately,
including per-class precision, recall, F1, macro and weighted averages, and
confusion matrices. It also rejects exact training-data overlap and records the
evaluation dataset's SHA-256 hash.

## Run the API

```bash
.venv\Scripts\python.exe -m uvicorn app:app --reload --port 8002
```

The API uses Tagalog RoBERTa only when both task folders exist, their label sets
match the surrender API contract, and `labels.json` confirms they were trained
from the configured Tagalog checkpoint. Missing, incomplete, or stale English
artifacts safely fall back to the existing TF-IDF + Logistic Regression models.

The service resolves model and data files relative to its own folder, so it can
be started either from this directory or from the repository root.

From the repository root, use:

```bash
animua-sentiment-service\.venv\Scripts\python.exe -m uvicorn --app-dir animua-sentiment-service app:app --port 8002
```

## Endpoint

```http
POST /analyze-surrender-sentiment
```

Example body:

```json
{
  "reason": "My dog is very sick and needs help immediately."
}
```

Example response:

```json
{
  "sentiment": "Urgent",
  "category": "Medical",
  "urgencyLabel": "Critical",
  "urgencyScore": 95,
  "confidence": 0.94,
  "keywords": ["sick", "immediately"],
  "suggestedPriority": "High Priority",
  "source": "Tagalog RoBERTa Transformer"
}
```

## Verify the surrender integration

After training, start the service and check its status:

```bash
.venv\Scripts\python.exe -m uvicorn app:app --port 8002
curl http://127.0.0.1:8002/
```

`transformerReady` must be `true`, both entries in `loadedTasks` must be
`true`, and `activeSource` must be `Tagalog RoBERTa Transformer`. The Node
backend sends surrender reasons to:

```text
http://127.0.0.1:8002/analyze-surrender-sentiment
```

To intentionally use a different compatible checkpoint for both training and
runtime validation, set `ANIMUA_ROBERTA_MODEL` before training and starting the
service.

## Category rules and confidence

RoBERTa's raw category is returned as `modelCategory`. The displayed `category`
may be adjusted by a high-precision context rule. Non-critical keyword rules do
not override a non-`Other` model prediction at or above confidence `0.80`.
Critical medical phrases can still override regardless of confidence. Owner or
caregiver illness is treated as `Owner Incapacity`, rather than pet `Medical`,
when the context supports that interpretation.

The threshold can be changed for a controlled evaluation with:

```text
ANIMUA_CATEGORY_OVERRIDE_MAX_CONFIDENCE=0.80
```

Do not tune this value against the locked independent evaluation set. The API
returns `sentiment` (message tone) separately from `urgencyLabel` (review
priority); those values are not expected to use the same label names.
