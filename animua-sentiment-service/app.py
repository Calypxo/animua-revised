import json
from pathlib import Path

import joblib

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

try:
    import torch
    from transformers import AutoModelForSequenceClassification, AutoTokenizer
except ImportError:
    torch = None
    AutoModelForSequenceClassification = None
    AutoTokenizer = None


app = FastAPI(title="ANIMUA Surrender Sentiment Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
        "http://localhost:5176",
        "http://127.0.0.1:5176",
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "https://animua-angelescity.web.app",
        "https://animua-admin.web.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


TRANSFORMER_MODEL_DIR = Path("models/roberta")

sentiment_model = joblib.load("sentiment_model.pkl")
category_model = joblib.load("category_model.pkl")
transformer_models = {}

REQUESTS_FILE = Path("surrender_requests.json")

ANGELES_BARANGAYS = [
    "Agapito del Rosario", "Amsic", "Anunas", "Balibago", "Capaya", "Claro M. Recto",
    "Cuayan", "Cutcut", "Cutud", "Lourdes Norte", "Lourdes Sur", "Lourdes Sur Este",
    "Malabanias", "Margot", "Mining", "Ninoy Aquino", "Pampang", "Pandan", "Plaridel",
    "Pulung Cacutud", "Pulung Maragul", "Pulungbulu", "Salapungan", "San Jose",
    "San Nicolas", "Santa Teresita", "Santa Trinidad", "Santo Cristo", "Santo Domingo",
    "Santo Rosario", "Sapalibutad", "Sapangbato", "Sergio Bernal", "Silangan",
    "Tabun", "Virgen Delos Remedios",
]


class SentimentRequest(BaseModel):
    reason: str


class SurrenderRequest(BaseModel):
    id: str
    status: str
    submittedAt: str
    account: dict | None = None
    owner: dict
    pet: dict
    surrenderReason: str
    agreement: dict | None = None
    nlp: dict | None = None


def load_transformer_task(task_name):
    task_dir = TRANSFORMER_MODEL_DIR / task_name

    if not task_dir.exists() or not torch or not AutoTokenizer or not AutoModelForSequenceClassification:
        return None

    try:
        tokenizer = AutoTokenizer.from_pretrained(task_dir)
        model = AutoModelForSequenceClassification.from_pretrained(task_dir)
        model.eval()
        return {
            "tokenizer": tokenizer,
            "model": model,
            "id2label": model.config.id2label,
        }
    except Exception as error:
        print(f"Unable to load RoBERTa {task_name} model:", error)
        return None


def load_transformer_models():
    return {
        "sentiment": load_transformer_task("sentiment"),
        "category": load_transformer_task("category"),
    }


transformer_models = load_transformer_models()


def load_requests():
    if not REQUESTS_FILE.exists():
        return []

    try:
        with open(REQUESTS_FILE, "r", encoding="utf-8") as file:
            return json.load(file)
    except json.JSONDecodeError:
        return []


def save_requests(requests):
    with open(REQUESTS_FILE, "w", encoding="utf-8") as file:
        json.dump(requests, file, indent=2, ensure_ascii=False)


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
    label = task["id2label"][int(predicted_id)]

    return label, round(float(confidence), 2)


def predict_sentiment_and_category(reason):
    sentiment_result = get_transformer_prediction("sentiment", reason)
    category_result = get_transformer_prediction("category", reason)

    if sentiment_result and category_result:
        return {
            "sentiment": sentiment_result,
            "category": category_result,
            "source": "RoBERTa Transformer"
        }

    sentiment_result = get_prediction_with_confidence(sentiment_model, reason)
    category_result = get_prediction_with_confidence(category_model, reason)

    return {
        "sentiment": sentiment_result,
        "category": category_result,
        "source": "TF-IDF + Logistic Regression"
    }


def apply_category_override(reason, predicted_category):
    text = reason.lower()

    relocation_words = [
        "moving", "relocate", "relocating", "migration", "migrate",
        "abroad", "leaving the country", "leaving philippines",
        "alis", "aalis", "lilipat", "mag-aabroad", "ibang bansa",
        "pilipinas", "france", "paris", "documents", "madadala",
        "dalhin", "isama", "maisama", "hindi kayang dalhin",
        "hindi namin kayang dalhin", "hindi madala", "hindi maisama",
        "papuntang", "ibang lugar"
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

    emergency_words = [
        "emergency", "immediately", "bleeding", "dying", "critical",
        "cannot stand", "not eating", "hit by", "attacked", "bit",
        "agad", "sugatan", "nabangga", "namamatay", "hindi makatayo",
        "inatake", "nangangagat", "delikado", "kalsada"
    ]

    has_emergency_word = any(word in text for word in emergency_words)

    # Relocation should usually not become High Priority
    # unless the text also contains abandonment/emergency words.
    if category == "Relocation" and sentiment == "Neutral":
        return "Low", 25

    if category == "Relocation" and sentiment == "Negative":
        return "Medium", 45

    if sentiment == "Urgent" and has_emergency_word:
        return "Critical", 95

    if sentiment == "Urgent":
        return "High", 80

    if sentiment == "Negative":
        return "Medium", 55

    if category in ["Medical", "Abandonment Risk", "Behavioral"]:
        return "High", 75

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
            "source": "RoBERTa Transformer" if all(transformer_models.values()) else "TF-IDF + Logistic Regression"
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
    return {
        "message": "ANIMUA surrender sentiment service is running."
    }


@app.post("/analyze-surrender-sentiment")
def analyze_surrender_sentiment(data: SentimentRequest):
    return analyze_reason(data.reason)


@app.post("/submit-surrender-request")
def submit_surrender_request(data: SurrenderRequest):
    request_data = data.model_dump()

    owner = request_data.get("owner", {})
    barangay = owner.get("barangay", "")
    city = owner.get("city", "")

    if barangay not in ANGELES_BARANGAYS or city != "Angeles City":
        raise HTTPException(
            status_code=403,
            detail="Only residents of Angeles City can submit a surrender request."
        )

    agreement = request_data.get("agreement", {})

    if not agreement.get("agreedToTerms"):
        raise HTTPException(
            status_code=400,
            detail="User must agree to the surrender terms before submitting."
        )

    request_data["nlp"] = analyze_reason(request_data["surrenderReason"])
    request_data["source"] = "Public Form"

    requests = load_requests()
    requests.append(request_data)
    save_requests(requests)

    return {
        "message": "Surrender request submitted successfully.",
        "request": request_data
    }



@app.get("/surrender-requests")
def get_surrender_requests():
    return {
        "requests": load_requests()
    }
