from math import sqrt
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="Animua Python Matcher")
SCORING_VERSION = "behavior-care-status-v2"

RAW_QUESTION_KEYS = [
    "energyLevel",
    "exerciseNeeds",
    "independenceLevel",
    "attentionNeeds",
    "playfulness",
    "adaptability",
    "friendlinessToHumans",
    "goodWithKids",
    "goodWithOtherPets",
    "strangerTolerance",
    "noiseLevel",
    "spaceNeeds",
    "climateTolerance",
    "groomingNeeds",
    "trainingDifficulty",
    "healthRiskLevel",
    "affectionLevel",
    "separationAnxiety",
]

# Keep this ordered contract mathematically equivalent to the Node fallback.
# Climate readiness and vet budget remain questionnaire context, not scores.
# Special needs use a separate care status and eligibility filter in Node.
SCORING_DIMENSIONS = [
    ("energyLevel", ["energyLevel"]),
    ("exerciseNeeds", ["exerciseNeeds"]),
    ("independenceLevel", ["independenceLevel"]),
    ("attentionNeeds", ["attentionNeeds", "groomingNeeds"]),
    ("playfulness", ["playfulness"]),
    ("adaptability", ["adaptability"]),
    ("friendlinessToHumans", ["friendlinessToHumans"]),
    ("goodWithKids", ["goodWithKids"]),
    ("goodWithOtherPets", ["goodWithOtherPets"]),
    ("strangerTolerance", ["strangerTolerance"]),
    ("noiseLevel", ["noiseLevel"]),
    ("spaceNeeds", ["spaceNeeds"]),
    ("trainingDifficulty", ["trainingDifficulty"]),
    ("affectionLevel", ["affectionLevel"]),
    ("separationAnxiety", ["separationAnxiety"]),
]

class MatchRequest(BaseModel):
    preferences: Dict[str, Any]
    animals: List[Dict[str, Any]]
    top_k: Optional[int] = 5

def safe_num(value: Any, default: float = 3.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default

def build_vector(data: Dict[str, Any], keys: List[str]) -> List[float]:
    return [safe_num(data.get(key), 3.0) for key in keys]

def validate_preferences(preferences: Dict[str, Any]) -> Dict[str, int]:
    validated = {}
    for key in RAW_QUESTION_KEYS:
        value = preferences.get(key)
        if isinstance(value, bool):
            raise ValueError(f"{key} must be a whole number from 1 to 5.")
        try:
            numeric = float(value)
        except (TypeError, ValueError):
            raise ValueError(f"{key} must be a whole number from 1 to 5.")
        if not numeric.is_integer() or numeric < 1 or numeric > 5:
            raise ValueError(f"{key} must be a whole number from 1 to 5.")
        validated[key] = int(numeric)
    return validated

def build_user_profile(preferences: Dict[str, Any]) -> Dict[str, float]:
    validated = validate_preferences(preferences)
    return {
        key: sum(validated[source] for source in sources) / len(sources)
        for key, sources in SCORING_DIMENSIONS
    }

def dot_product(a: List[float], b: List[float]) -> float:
    return sum(x * y for x, y in zip(a, b))

def magnitude(vec: List[float]) -> float:
    return sqrt(sum(v * v for v in vec))

def cosine_similarity(a: List[float], b: List[float]) -> float:
    mag_a = magnitude(a)
    mag_b = magnitude(b)

    if mag_a == 0 or mag_b == 0:
        return 0.0

    return dot_product(a, b) / (mag_a * mag_b)

def score_pet(user_vector: List[float], pet_vector: List[float]) -> Dict[str, float]:
    cosine = cosine_similarity(user_vector, pet_vector)

    diff = 0.0
    for u, p in zip(user_vector, pet_vector):
        diff += abs(u - p)

    max_diff = len(user_vector) * 4.0
    penalty = diff / max_diff
    final_score = cosine * (1 - penalty)

    return {
        "matchScore": round(final_score, 4),
        "matchPercent": round(final_score * 100, 2),
    }

@app.get("/")
def root():
    return {
        "status": "online",
        "message": "ANIMUA Python compatibility matcher is up and running.",
        "service": "Animua Python Matcher",
        "health": "/health",
        "documentation": "/docs",
        "scoreEndpoint": "/score",
    }


@app.get("/health")
def health():
    return {"ok": True}

@app.post("/score")
def score_matches(payload: MatchRequest):
    try:
        user_profile = build_user_profile(payload.preferences)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    score_keys = [key for key, _sources in SCORING_DIMENSIONS]
    user_vector = build_vector(user_profile, score_keys)
    results = []

    for animal in payload.animals:
        assessment = animal.get("behavioralAssessment", {}) or {}

        pet_vector = build_vector(assessment, score_keys)
        score = score_pet(user_vector, pet_vector)

        results.append({
            "id": animal.get("id"),
            "petId": animal.get("petId"),
            "name": animal.get("name"),
            "species": animal.get("species"),
            "breed": animal.get("breed"),
            "sex": animal.get("sex"),
            "size": animal.get("size"),
            "status": animal.get("status"),
            "photoURL": animal.get("photoURL"),
            "photoUrl": animal.get("photoUrl") or animal.get("photoURL"),
            "ageEstimate": animal.get("ageEstimate"),
            "age": animal.get("age") or animal.get("ageEstimate"),
            "allergyFriendly": animal.get("allergyFriendly"),
            "aggressive": assessment.get("aggressive", animal.get("aggressive")),
            **assessment,
            "specialNeedsStatus": animal.get("specialNeedsStatus", "unknown"),
            "specialNeedsNotes": animal.get("specialNeedsNotes", ""),
            **score,
        })

    results.sort(key=lambda x: x["matchScore"], reverse=True)

    return {
        "engine": "python",
        "scoringVersion": SCORING_VERSION,
        "matches": results[: payload.top_k]
    }
