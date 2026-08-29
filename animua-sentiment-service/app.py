import json

import joblib

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel

try:
    import torch
    from transformers import AutoModelForSequenceClassification, AutoTokenizer
except ImportError:
    torch = None
    AutoModelForSequenceClassification = None
    AutoTokenizer = None

from model_config import (
    EXPECTED_TASK_LABELS,
    FALLBACK_SOURCE_LABEL,
    MODEL_NAME,
    MODEL_SOURCE_LABEL,
    SERVICE_DIR,
    TRANSFORMER_MODEL_DIR,
)


app = FastAPI(
    title="ANIMUA Surrender Sentiment Service",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

RULES_VERSION = "2026-08-29-medical-triage-v2"

sentiment_model = joblib.load(SERVICE_DIR / "sentiment_model.pkl")
category_model = joblib.load(SERVICE_DIR / "category_model.pkl")
transformer_models = {}

REQUIRED_TRANSFORMER_ASSETS = (
    "config.json",
    "labels.json",
    "merges.txt",
    "model.safetensors",
    "special_tokens_map.json",
    "tokenizer.json",
    "tokenizer_config.json",
    "vocab.json",
)


class SentimentRequest(BaseModel):
    reason: str


def missing_transformer_assets(task_name):
    task_dir = TRANSFORMER_MODEL_DIR / task_name
    return [
        filename
        for filename in REQUIRED_TRANSFORMER_ASSETS
        if not (task_dir / filename).is_file()
    ]


def load_transformer_task(task_name):
    task_dir = TRANSFORMER_MODEL_DIR / task_name

    missing_assets = missing_transformer_assets(task_name)
    if missing_assets:
        print(
            f"Unable to load Tagalog RoBERTa {task_name} model: "
            f"missing required assets {missing_assets}"
        )
        return None

    if not torch or not AutoTokenizer or not AutoModelForSequenceClassification:
        return None

    try:
        metadata_path = task_dir / "labels.json"
        if not metadata_path.exists():
            raise ValueError("labels.json is missing")

        with open(metadata_path, "r", encoding="utf-8") as file:
            metadata = json.load(file)

        source_model = metadata.get("source_model")
        if source_model != MODEL_NAME:
            raise ValueError(
                f"model was trained from {source_model!r}; expected {MODEL_NAME!r}"
            )

        tokenizer = AutoTokenizer.from_pretrained(task_dir)
        model = AutoModelForSequenceClassification.from_pretrained(task_dir)

        configured_labels = {
            str(label) for label in model.config.id2label.values()
        }
        expected_labels = EXPECTED_TASK_LABELS[task_name]
        if configured_labels != expected_labels:
            raise ValueError(
                f"unexpected labels {sorted(configured_labels)}; "
                f"expected {sorted(expected_labels)}"
            )

        model.eval()
        return {
            "tokenizer": tokenizer,
            "model": model,
            "id2label": model.config.id2label,
            "source_model": source_model,
        }
    except Exception as error:
        print(f"Unable to load Tagalog RoBERTa {task_name} model:", error)
        return None


def load_transformer_models():
    return {
        "sentiment": load_transformer_task("sentiment"),
        "category": load_transformer_task("category"),
    }


transformer_models = load_transformer_models()


def transformer_status():
    tasks = {}
    for task_name in EXPECTED_TASK_LABELS:
        missing_assets = missing_transformer_assets(task_name)
        tasks[task_name] = {
            "modelLoaded": transformer_models.get(task_name) is not None,
            "assetsAvailable": not missing_assets,
            "missingAssets": missing_assets,
        }

    ready = all(
        task["modelLoaded"] and task["assetsAvailable"]
        for task in tasks.values()
    )
    return ready, tasks


def get_prediction_with_confidence(model, text):
    prediction = model.predict([text])[0]

    if hasattr(model, "predict_proba"):
        probabilities = model.predict_proba([text])[0]
        confidence = max(probabilities)
    else:
        confidence = 0.70

    return prediction, round(float(confidence), 2)


def get_transformer_prediction(task_name, text):
    task = transformer_models.get(task_name)

    if not task:
        return None

    tokenizer = task["tokenizer"]
    model = task["model"]

    inputs = tokenizer(
        text,
        truncation=True,
        max_length=160,
        return_tensors="pt"
    )

    with torch.no_grad():
        outputs = model(**inputs)
        probabilities = torch.softmax(outputs.logits, dim=-1)[0]

    confidence, predicted_id = torch.max(probabilities, dim=-1)
    prediction_key = int(predicted_id)
    label = task["id2label"].get(
        prediction_key,
        task["id2label"].get(str(prediction_key)),
    )
    if label is None:
        raise ValueError(
            f"Tagalog RoBERTa returned unknown {task_name} label id "
            f"{prediction_key}"
        )

    return label, round(float(confidence), 2)


def predict_sentiment_and_category(reason):
    if all(transformer_models.values()):
        return {
            "sentiment": get_transformer_prediction("sentiment", reason),
            "category": get_transformer_prediction("category", reason),
            "source": MODEL_SOURCE_LABEL,
        }

    sentiment_result = get_prediction_with_confidence(sentiment_model, reason)
    category_result = get_prediction_with_confidence(category_model, reason)

    return {
        "sentiment": sentiment_result,
        "category": category_result,
        "source": FALLBACK_SOURCE_LABEL,
    }


def contains_phrase(text, phrases):
    return any(phrase in text for phrase in phrases)


def has_medical_signal(reason):
    text = reason.lower()
    medical_phrases = [
        "sick", "injured", "bleeding", "dying", "cancer",
        "not eating", "won't eat", "will not eat", "no appetite",
        "vomiting", "weak", "needs a vet", "need a vet",
        "may sakit", "sugatan", "dumudugo", "namamatay", "gamot",
        "hindi kumakain", "hindi na kumakain", "ayaw kumain",
        "walang gana", "nanghihina", "nagsusuka", "kailangan ng vet",
        "kailangan niya ng vet", "nahihirapang huminga", "walang malay",
        "hindi makatayo", "nabangga", "malubha",
    ]
    return contains_phrase(text, medical_phrases)


def apply_category_override(reason, predicted_category):
    text = reason.lower()

    # Explicit symptoms are safer and more precise than a low-confidence
    # category prediction from short or informal owner messages.
    if has_medical_signal(reason):
        return "Medical"

    relocation_words = [
        "moving", "relocate", "relocating", "migration", "migrate",
        "abroad", "leaving the country", "leaving philippines",
        "alis", "aalis", "lilipat", "mag-aabroad", "ibang bansa",
        "pilipinas", "france", "paris", "documents", "madadala",
        "dalhin", "isama", "maisama", "hindi kayang dalhin",
        "hindi namin kayang dalhin", "hindi madala", "hindi maisama",
        "papuntang", "ibang lugar", "lumipat", "paglipat"
    ]

    if any(word in text for word in relocation_words):
        return "Relocation"

    return predicted_category


def extract_keywords(reason):
    important_words = [
        "sick", "injured", "bleeding", "dying", "terminal", "cancer",
        "afford", "money", "financial", "job", "unemployed", "income",
        "moving", "relocating", "abroad", "landlord", "apartment", "condo",
        "aggressive", "biting", "attack", "dangerous",
        "too many", "puppies", "kittens", "overwhelmed",
        "abandon", "street", "nowhere",
        "hospitalized", "bedridden", "elderly", "disabled",

        "may sakit", "sugatan", "nabangga", "namamatay", "gamot",
        "dumudugo", "malubha", "agarang", "nahihirapang huminga",
        "walang malay", "hindi kumakain", "hindi na kumakain",
        "ayaw kumain", "walang gana", "nanghihina", "nagsusuka",
        "walang budget", "hindi afford", "nawalan", "trabaho",
        "lilipat", "bawal", "mag-aabroad", "condo",
        "nangangagat", "inatake", "delikado",
        "sobrang dami", "kuting", "tuta", "walang space",
        "kalsada", "maiwan", "walang mag-aalaga", "naospital",

        "aalis", "alis", "pilipinas", "france", "paris", "documents",
        "dalhin", "isama", "maisama", "madadala", "migrate", "migration"
    ]

    text = reason.lower()
    detected = []

    for word in important_words:
        if word in text:
            detected.append(word)

    return detected[:5]


def map_urgency(sentiment, category, reason):
    text = reason.lower()

    critical_phrases = [
        "emergency", "immediately", "bleeding", "dying", "critical",
        "cannot stand", "hit by", "attacked",
        "nabangga", "namamatay", "hindi makatayo", "inatake",
        "dumudugo", "nahihirapang huminga", "walang malay",
    ]

    if contains_phrase(text, critical_phrases):
        return "Critical", 95

    # Relocation should usually not become High Priority
    # unless the text also contains abandonment/emergency words.
    if category == "Relocation" and sentiment == "Neutral":
        return "Low", 25

    if category == "Relocation" and sentiment == "Negative":
        return "Medium", 45

    if sentiment == "Urgent":
        return "High", 80

    if category in ["Medical", "Abandonment Risk", "Behavioral"]:
        return "High", 75

    if sentiment == "Negative":
        return "Medium", 55

    return "Low", 25


def suggested_priority_from_urgency(urgency_label):
    if urgency_label in ["Critical", "High"]:
        return "High Priority"

    if urgency_label == "Medium":
        return "Medium Priority"

    return "Normal Priority"


def analyze_reason(reason):
    reason = reason.strip()

    if not reason:
        return {
            "sentiment": "Neutral",
            "category": "Other",
            "urgencyLabel": "Low",
            "urgencyScore": 10,
            "confidence": 0.0,
            "keywords": [],
            "suggestedPriority": "Normal Priority",
            "source": (
                MODEL_SOURCE_LABEL
                if all(transformer_models.values())
                else FALLBACK_SOURCE_LABEL
            ),
        }

    predictions = predict_sentiment_and_category(reason)
    sentiment, sentiment_confidence = predictions["sentiment"]
    category, category_confidence = predictions["category"]

    category = apply_category_override(reason, category)

    urgency_label, urgency_score = map_urgency(
        sentiment,
        category,
        reason
    )

    confidence = round((sentiment_confidence + category_confidence) / 2, 2)

    return {
        "sentiment": sentiment,
        "category": category,
        "urgencyLabel": urgency_label,
        "urgencyScore": urgency_score,
        "confidence": confidence,
        "keywords": extract_keywords(reason),
        "suggestedPriority": suggested_priority_from_urgency(urgency_label),
        "source": predictions["source"]
    }


@app.get("/")
def home():
    ready, tasks = transformer_status()
    return {
        "message": "ANIMUA surrender sentiment service is running.",
        "configuredModel": MODEL_NAME,
        "rulesVersion": RULES_VERSION,
        "transformerReady": ready,
        "loadedTasks": {
            task_name: task["modelLoaded"]
            for task_name, task in tasks.items()
        },
        "modelAssets": tasks,
        "activeSource": (
            MODEL_SOURCE_LABEL
            if ready
            else FALLBACK_SOURCE_LABEL
        ),
    }


@app.get("/health")
def health():
    ready, tasks = transformer_status()
    payload = {
        "ok": ready,
        "transformerReady": ready,
        "tasks": tasks,
        "activeSource": MODEL_SOURCE_LABEL if ready else FALLBACK_SOURCE_LABEL,
        "rulesVersion": RULES_VERSION,
    }
    if not ready:
        return JSONResponse(status_code=503, content=payload)
    return payload


@app.post("/analyze-surrender-sentiment")
def analyze_surrender_sentiment(data: SentimentRequest):
    return analyze_reason(data.reason)
