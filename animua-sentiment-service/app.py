import json
import re

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

RULES_VERSION = "2026-08-29-context-rules-v3"
INSUFFICIENT_SOURCE_LABEL = "Input validation (insufficient text)"

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
    normalized = str(text or "").casefold()
    for phrase in phrases:
        words = [re.escape(word) for word in str(phrase).casefold().split()]
        if not words:
            continue
        pattern = r"(?<!\w)" + r"\s+".join(words) + r"(?!\w)"
        if re.search(pattern, normalized):
            return True
    return False


CRITICAL_MEDICAL_PHRASES = [
    "bleeding", "dying", "cannot stand", "hit by",
    "dumudugo", "namamatay", "hindi makatayo", "nabangga",
    "nahihirapang huminga", "walang malay",
]

FINANCIAL_PHRASES = [
    "cannot afford", "can't afford", "no money", "no budget",
    "lost my job", "financial problem", "financial difficulty",
    "walang pera", "wala akong pera", "wala kaming pera",
    "walang budget", "hindi afford", "di afford",
    "nawalan ng trabaho", "nawalan ako ng trabaho",
    "wala akong trabaho", "wala kaming trabaho", "walang trabaho",
    "hindi kaya ang gastos", "hindi kayang bumili",
]

URGENT_ABANDONMENT_PHRASES = [
    "abandon", "leave on the street", "nowhere to stay",
    "iiwan sa kalsada", "iwan sa kalsada", "ayoko na",
    "ipapamigay na lang", "walang matutuluyan",
]

CAREGIVER_ABSENCE_PHRASES = [
    "wala nang mag-aalaga", "walang mag-aalaga",
]

ABANDONMENT_PHRASES = [
    *URGENT_ABANDONMENT_PHRASES,
    *CAREGIVER_ABSENCE_PHRASES,
]

RELOCATION_PHRASES = [
    "moving", "relocate", "relocating", "migration", "migrate",
    "moving abroad", "leaving the country", "leaving philippines",
    "aalis kami", "aalis na kami", "lilipat", "lumipat", "paglipat",
    "kami ay aalis", "ako ay aalis", "pamilya namin ay aalis",
    "may-ari ay aalis", "aalis ng angeles city",
    "mag-aabroad", "ibang bansa", "ibang lugar", "hindi madadala",
    "hindi maisama", "hindi kayang dalhin", "hindi namin kayang dalhin",
    "papuntang ibang bansa", "bawal sa bagong tirahan",
]

MEDICAL_PHRASES = [
    "sick", "injured", "bleeding", "dying", "cancer",
    "not eating", "won't eat", "will not eat", "no appetite",
    "vomiting", "needs a vet", "need a vet", "needs medicine",
    "may sakit", "sugatan", "dumudugo", "namamatay",
    "kailangan ng gamot", "kailangan niya ng gamot",
    "hindi kumakain", "hindi na kumakain", "ayaw kumain",
    "walang gana", "nanghihina", "nagsusuka", "kailangan ng vet",
    "kailangan niya ng vet", "nahihirapang huminga", "walang malay",
    "hindi makatayo", "nabangga", "malubha",
]

MEANINGFUL_SHORT_PHRASES = [
    *CRITICAL_MEDICAL_PHRASES,
    *FINANCIAL_PHRASES,
    *ABANDONMENT_PHRASES,
    *RELOCATION_PHRASES,
    *MEDICAL_PHRASES,
    "nangangagat", "aggressive", "sobrang dami", "walang space",
    "naospital", "bedridden", "disabled",
]


def is_insufficient_reason(reason):
    text = re.sub(r"\s+", " ", str(reason or "").strip())
    if not text:
        return True

    lowered = text.casefold()
    known_placeholders = {
        "n/a", "na", "none", "test", "testing", "sample",
        "asdf", "qwerty", "xxx", "xsx",
    }
    if lowered in known_placeholders:
        return True

    letters = re.findall(r"[^\W\d_]", lowered, flags=re.UNICODE)
    words = re.findall(r"[^\W\d_]+", lowered, flags=re.UNICODE)
    if len(letters) < 4:
        return True
    if len(words) < 2 and not contains_phrase(lowered, MEANINGFUL_SHORT_PHRASES):
        return True

    return False


def has_medical_signal(reason):
    return contains_phrase(reason, MEDICAL_PHRASES)


def resolve_category(reason, predicted_category):
    if contains_phrase(reason, CRITICAL_MEDICAL_PHRASES):
        return "Medical", "Explicit critical medical symptom"
    if contains_phrase(reason, FINANCIAL_PHRASES):
        return "Financial", "Explicit financial constraint"
    has_relocation = contains_phrase(reason, RELOCATION_PHRASES)
    has_abandonment = contains_phrase(reason, ABANDONMENT_PHRASES)
    if (
        has_relocation and
        contains_phrase(reason, CAREGIVER_ABSENCE_PHRASES) and
        not contains_phrase(reason, URGENT_ABANDONMENT_PHRASES)
    ):
        return "Relocation", "Explicit relocation constraint"
    if has_abandonment:
        return "Abandonment Risk", "Explicit abandonment risk"
    if has_relocation:
        return "Relocation", "Explicit relocation constraint"
    if has_medical_signal(reason):
        return "Medical", "Explicit medical symptom"
    return predicted_category, ""


def apply_category_override(reason, predicted_category):
    category, _ = resolve_category(reason, predicted_category)
    return category


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
        if contains_phrase(text, [word]):
            detected.append(word)

    return detected[:5]


def map_urgency(sentiment, category, reason):
    text = reason.lower()

    critical_phrases = [
        *CRITICAL_MEDICAL_PHRASES,
        "emergency", "attacked", "inatake",
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

    if is_insufficient_reason(reason):
        return {
            "sentiment": "Neutral",
            "category": "Other",
            "urgencyLabel": "Low",
            "urgencyScore": 10,
            "confidence": 0.0,
            "sentimentConfidence": 0.0,
            "categoryConfidence": 0.0,
            "modelCategory": "Other",
            "categoryAdjusted": False,
            "categoryAdjustmentReason": "Insufficient meaningful text",
            "keywords": [],
            "suggestedPriority": "Normal Priority",
            "rulesVersion": RULES_VERSION,
            "source": INSUFFICIENT_SOURCE_LABEL,
        }

    predictions = predict_sentiment_and_category(reason)
    sentiment, sentiment_confidence = predictions["sentiment"]
    model_category, category_confidence = predictions["category"]

    category, adjustment_reason = resolve_category(reason, model_category)
    category_adjusted = category != model_category
    if not category_adjusted:
        adjustment_reason = ""

    urgency_label, urgency_score = map_urgency(
        sentiment,
        category,
        reason
    )

    return {
        "sentiment": sentiment,
        "category": category,
        "urgencyLabel": urgency_label,
        "urgencyScore": urgency_score,
        "confidence": category_confidence,
        "sentimentConfidence": sentiment_confidence,
        "categoryConfidence": category_confidence,
        "modelCategory": model_category,
        "categoryAdjusted": category_adjusted,
        "categoryAdjustmentReason": adjustment_reason,
        "keywords": extract_keywords(reason),
        "suggestedPriority": suggested_priority_from_urgency(urgency_label),
        "rulesVersion": RULES_VERSION,
        "source": predictions["source"],
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
