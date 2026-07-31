# Tagalog RoBERTa Surrender Classifier

This service fine-tunes
[`jcblaise/roberta-tagalog-base`](https://huggingface.co/jcblaise/roberta-tagalog-base)
for Tagalog and mixed Tagalog-English surrender text analysis.

It trains two classifiers from `surrender_sentiment_dataset.csv`:

- `sentiment`: predicts `Urgent`, `Neutral`, or `Negative`
- `category`: predicts labels such as `Medical`, `Financial`, `Relocation`, `Behavioral`, and the other categories already present in the dataset

## Install Dependencies

```bash
uv venv --python 3.12
uv pip install torch --index-url https://download.pytorch.org/whl/cpu
uv pip install -r requirements.txt
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

The metrics include accuracy, weighted precision, weighted recall, weighted F1, and macro F1.
Only the best final task models are retained; temporary optimizer checkpoints
are removed after each task to save disk space.

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
