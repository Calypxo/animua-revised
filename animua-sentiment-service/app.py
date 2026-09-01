import json
import os
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

RULES_VERSION = "2026-09-02-context-confidence-rules-v5"
INSUFFICIENT_SOURCE_LABEL = "Input validation (insufficient text)"
CATEGORY_OVERRIDE_MAX_CONFIDENCE = float(
    os.getenv("ANIMUA_CATEGORY_OVERRIDE_MAX_CONFIDENCE", "0.80")
)

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
            "dataset": metadata.get("dataset") or {},
            "split": metadata.get("split") or {},
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
        loaded_task = transformer_models.get(task_name)
        task_metadata = loaded_task if isinstance(loaded_task, dict) else {}
        dataset_metadata = task_metadata.get("dataset") or {}
        split_metadata = task_metadata.get("split") or {}
        tasks[task_name] = {
            "modelLoaded": loaded_task is not None,
            "assetsAvailable": not missing_assets,
            "missingAssets": missing_assets,
            "datasetSha256": dataset_metadata.get("canonicalSha256"),
            "datasetRows": dataset_metadata.get("effectiveRows"),
            "splitStrategy": split_metadata.get("strategy"),
        }

    dataset_hashes = {
        task["datasetSha256"]
        for task in tasks.values()
        if task["datasetSha256"]
    }
    provenance_presence = [
        bool(task["datasetSha256"])
        for task in tasks.values()
    ]
    provenance_consistent = (
        all(provenance_presence) or not any(provenance_presence)
    ) and len(dataset_hashes) <= 1
    ready = all(
        task["modelLoaded"] and task["assetsAvailable"]
        for task in tasks.values()
    ) and provenance_consistent
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

OWNER_INCAPACITY_SUBJECT_PHRASES = [
    "owner", "may-ari", "primary caregiver", "caregiver",
    "ako", "i am", "i was", "my mother", "my father",
    "nanay ko", "tatay ko", "lolo ko", "lola ko",
]

OWNER_INCAPACITY_CONDITION_PHRASES = [
    "naospital", "hospitalized", "in hospital", "may sakit",
    "is sick", "is ill", "bedridden", "disabled",
    "health condition", "cannot provide daily care",
    "cannot care for", "hindi na kaya ang daily pet care",
    "hindi na kayang mag-alaga", "hindi na kayang alagaan",
]

ABANDONMENT_PHRASES = [
    *URGENT_ABANDONMENT_PHRASES,
    *CAREGIVER_ABSENCE_PHRASES,
]

RELOCATION_PHRASES = [
    "moving", "move out", "relocate", "relocating", "migration", "migrate",
    "moving abroad", "leaving the country", "leaving philippines",
    "aalis kami", "aalis na kami", "lilipat", "lumipat", "paglipat",
    "kami ay aalis", "ako ay aalis", "pamilya namin ay aalis",
    "may-ari ay aalis", "aalis ng angeles city",
    "mag-aabroad", "ibang bansa", "ibang lugar", "hindi madadala",
    "hindi maisama", "hindi kayang dalhin", "hindi namin kayang dalhin",
    "papuntang ibang bansa", "bawal sa bagong tirahan",
]

BEHAVIORAL_PHRASES = [
    "aggressive", "violent behavior", "biting people", "keeps biting",
    "attacked", "attacking", "dangerous and difficult to control",
    "difficult to control", "nangangagat", "nangangalmot",
    "inatake", "delikado", "hindi makontrol",
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

OVERCROWDING_DIRECT_PHRASES = [
    "overcrowded", "overcrowding",
]

OVERCROWDING_COUNT_PHRASES = [
    "too many cats", "too many dogs", "too many pets",
    "too many animals", "too many kittens", "too many puppies",
    "sobrang dami ng alaga", "sobrang dami ng mga alaga",
    "sobrang dami ng pusa", "sobrang dami ng mga pusa",
    "sobrang dami ng aso", "sobrang dami ng mga aso",
    "maraming alaga", "maraming pusa", "maraming aso",
    "madaming alaga", "madaming pusa", "madaming aso",
]

ANIMAL_GROUP_PHRASES = [
    "cats", "dogs", "pets", "animals", "mga pusa", "mga aso",
    "mga alaga", "kittens", "puppies", "mga kuting", "mga tuta",
]

SPACE_CONSTRAINT_PHRASES = [
    "no space", "not enough space", "need more space",
    "needs more space", "needed space", "walang space",
    "kulang ang space", "masikip",
]

MALFORMED_OVERCROWDING_PATTERN = re.compile(
    r"(?<!\w)too\s+much\s+(?:cats?|dogs?|pets?|animals?)\s+"
    r"(?:need(?:s|ed)?|requir(?:e|es|ed))\s+(?:more\s+)?space(?!\w)",
    flags=re.IGNORECASE,
)

MEANINGFUL_SHORT_PHRASES = [
    *CRITICAL_MEDICAL_PHRASES,
    *FINANCIAL_PHRASES,
    *ABANDONMENT_PHRASES,
    *RELOCATION_PHRASES,
    *MEDICAL_PHRASES,
    *BEHAVIORAL_PHRASES,
    *OVERCROWDING_DIRECT_PHRASES,
    *OVERCROWDING_COUNT_PHRASES,
    *SPACE_CONSTRAINT_PHRASES,
    "nangangagat", "aggressive", "sobrang dami",
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


def has_owner_incapacity_signal(reason):
    return contains_phrase(
        reason,
        OWNER_INCAPACITY_SUBJECT_PHRASES,
    ) and contains_phrase(
        reason,
        OWNER_INCAPACITY_CONDITION_PHRASES,
    )


def has_overcrowding_signal(reason):
    if contains_phrase(
        reason,
        [*OVERCROWDING_DIRECT_PHRASES, *OVERCROWDING_COUNT_PHRASES],
    ):
        return True

    has_group = contains_phrase(reason, ANIMAL_GROUP_PHRASES)
    has_space_constraint = contains_phrase(reason, SPACE_CONSTRAINT_PHRASES)

    if has_group and has_space_constraint:
        return True

    # Handles short, imperfect input such as "Too much Cat needed space"
    # without treating every single-animal request for more space as crowding.
    return bool(MALFORMED_OVERCROWDING_PATTERN.search(str(reason or "")))


def should_keep_confident_category(
    predicted_category,
    proposed_category,
    predicted_confidence,
):
    if predicted_category in {proposed_category, "Other"}:
        return False
    if predicted_confidence is None:
        return False

    try:
        confidence = float(predicted_confidence)
    except (TypeError, ValueError):
        return False

    return confidence >= CATEGORY_OVERRIDE_MAX_CONFIDENCE


def resolve_category(reason, predicted_category, predicted_confidence=None):
    if contains_phrase(reason, CRITICAL_MEDICAL_PHRASES):
        return "Medical", "Explicit critical medical symptom"

    proposed_category = None
    adjustment_reason = ""
    if (
        has_owner_incapacity_signal(reason)
        and predicted_category in {"Owner Incapacity", "Other"}
    ):
        proposed_category = "Owner Incapacity"
        adjustment_reason = "Explicit owner or caregiver incapacity"
    elif contains_phrase(reason, FINANCIAL_PHRASES):
        proposed_category = "Financial"
        adjustment_reason = "Explicit financial constraint"

    has_relocation = contains_phrase(reason, RELOCATION_PHRASES)
    has_abandonment = contains_phrase(reason, ABANDONMENT_PHRASES)
    if (
        proposed_category is None and
        has_relocation and
        contains_phrase(reason, CAREGIVER_ABSENCE_PHRASES) and
        not contains_phrase(reason, URGENT_ABANDONMENT_PHRASES)
    ):
        proposed_category = "Relocation"
        adjustment_reason = "Explicit relocation constraint"
    elif proposed_category is None and has_abandonment:
        proposed_category = "Abandonment Risk"
        adjustment_reason = "Explicit abandonment risk"
    elif proposed_category is None and has_relocation:
        proposed_category = "Relocation"
        adjustment_reason = "Explicit relocation constraint"
    elif proposed_category is None and contains_phrase(
        reason,
        BEHAVIORAL_PHRASES,
    ):
        proposed_category = "Behavioral"
        adjustment_reason = "Explicit dangerous or uncontrolled behavior"
    elif proposed_category is None and has_medical_signal(reason):
        proposed_category = "Medical"
        adjustment_reason = "Explicit medical symptom"
    elif proposed_category is None and has_overcrowding_signal(reason):
        proposed_category = "Overcrowding"
        adjustment_reason = "Explicit overcrowding or space constraint"

    if proposed_category is None or proposed_category == predicted_category:
        return predicted_category, ""
    if should_keep_confident_category(
        predicted_category,
        proposed_category,
        predicted_confidence,
    ):
        return predicted_category, ""
    return proposed_category, adjustment_reason


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

    category, adjustment_reason = resolve_category(
        reason,
        model_category,
        category_confidence,
    )
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
        "categoryOverrideMaxConfidence": CATEGORY_OVERRIDE_MAX_CONFIDENCE,
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
        "categoryOverrideMaxConfidence": CATEGORY_OVERRIDE_MAX_CONFIDENCE,
    }
    if not ready:
        return JSONResponse(status_code=503, content=payload)
    return payload


@app.post("/analyze-surrender-sentiment")
def analyze_surrender_sentiment(data: SentimentRequest):
    return analyze_reason(data.reason)
