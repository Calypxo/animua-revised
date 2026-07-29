# RoBERTa Surrender Classifier

This service now supports a Hugging Face RoBERTa transformer for surrender text analysis.

It trains two classifiers from `surrender_sentiment_dataset.csv`:

- `sentiment`: predicts `Urgent`, `Neutral`, or `Negative`
- `category`: predicts labels such as `Medical`, `Financial`, `Relocation`, `Behavioral`, and the other categories already present in the dataset

## Install Dependencies

```bash
pip install -r requirements.txt
```

## Train RoBERTa

Run this from the `animua-sentiment-service` folder:

```bash
python train_roberta_model.py
```

The first run downloads `roberta-base` from Hugging Face, then saves trained models to:

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

## Run the API

```bash
uvicorn app:app --reload
```

The API automatically uses the RoBERTa models when the `models/roberta` folders exist. If they are missing, it falls back to the existing TF-IDF + Logistic Regression models.

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
  "source": "RoBERTa Transformer"
}
```

## Model Note

`roberta-base` is an English model. If you want stronger Tagalog or mixed Tagalog-English predictions, use `xlm-roberta-base` in `train_roberta_model.py`.
