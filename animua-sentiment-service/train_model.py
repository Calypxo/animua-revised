import pandas as pd
import joblib

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline


DATASET_PATH = "surrender_sentiment_dataset.csv"


def train_sentiment_model(data):
    sentiment_pipeline = Pipeline([
        ("tfidf", TfidfVectorizer(
            lowercase=True,
            ngram_range=(1, 2)
        )),
        ("classifier", LogisticRegression(
            max_iter=1000,
            class_weight="balanced"
        ))
    ])

    sentiment_pipeline.fit(data["reason"], data["sentiment"])

    joblib.dump(sentiment_pipeline, "sentiment_model.pkl")

    print("Sentiment model saved as sentiment_model.pkl")


def train_category_model(data):
    category_pipeline = Pipeline([
        ("tfidf", TfidfVectorizer(
            lowercase=True,
            ngram_range=(1, 2)
        )),
        ("classifier", LogisticRegression(
            max_iter=1000,
            class_weight="balanced"
        ))
    ])

    category_pipeline.fit(data["reason"], data["category"])

    joblib.dump(category_pipeline, "category_model.pkl")

    print("Category model saved as category_model.pkl")


def main():
    print("Loading dataset...")

    data = pd.read_csv(DATASET_PATH)

    print("Dataset loaded.")
    print("Total rows:", len(data))
    print("Columns:", list(data.columns))

    if "reason" not in data.columns:
        raise ValueError("Dataset must have a 'reason' column.")

    if "sentiment" not in data.columns:
        raise ValueError("Dataset must have a 'sentiment' column.")

    if "category" not in data.columns:
        raise ValueError("Dataset must have a 'category' column.")

    print("Training sentiment model...")
    train_sentiment_model(data)

    print("Training category model...")
    train_category_model(data)

    print("Training completed successfully.")


if __name__ == "__main__":
    main()