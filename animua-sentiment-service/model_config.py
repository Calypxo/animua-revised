import os
from pathlib import Path


SERVICE_DIR = Path(__file__).resolve().parent

DEFAULT_MODEL_NAME = "jcblaise/roberta-tagalog-base"
MODEL_NAME = (
    os.getenv("ANIMUA_ROBERTA_MODEL", DEFAULT_MODEL_NAME).strip()
    or DEFAULT_MODEL_NAME
)

DATASET_PATH = SERVICE_DIR / "surrender_sentiment_dataset.csv"
ADDITIONAL_DATASET_PATH = SERVICE_DIR / "additional_training.csv"
TRAINING_DATASET_PATHS = (DATASET_PATH, ADDITIONAL_DATASET_PATH)
TRANSFORMER_MODEL_DIR = SERVICE_DIR / "models" / "roberta"

MODEL_SOURCE_LABEL = "Tagalog RoBERTa Transformer"
FALLBACK_SOURCE_LABEL = "TF-IDF + Logistic Regression"

EXPECTED_TASK_LABELS = {
    "sentiment": {"Urgent", "Neutral", "Negative"},
    "category": {
        "Medical",
        "Financial",
        "Relocation",
        "Behavioral",
        "Overcrowding",
        "Abandonment Risk",
        "Owner Incapacity",
        "Other",
    },
}
