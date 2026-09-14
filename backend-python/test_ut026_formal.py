import unittest

from app import (
    MatchRequest,
    RAW_QUESTION_KEYS,
    SCORING_DIMENSIONS,
    build_user_profile,
    cosine_similarity,
    safe_num,
    score_pet,
    score_matches,
    validate_preferences,
)


def preferences(value=3):
    return {key: value for key in RAW_QUESTION_KEYS}


def animal(identifier, value=3, missing_key=None):
    assessment = {key: value for key, _sources in SCORING_DIMENSIONS}
    if missing_key:
        assessment.pop(missing_key, None)
    return {"id": identifier, "name": identifier, "status": "Ready", "behavioralAssessment": assessment}


class UT026PythonMatcherParity(unittest.TestCase):
    """Formal UT-026 scenarios; execution is reserved for Test Cycle 1."""

    def test_scenario_1_minimum_and_maximum_answers_are_valid(self):
        self.assertEqual(validate_preferences(preferences(1)), preferences(1))
        self.assertEqual(validate_preferences(preferences(5)), preferences(5))

    def test_scenario_2_missing_out_of_range_and_boolean_answers_are_rejected(self):
        for key, value in (("climateTolerance", None), ("energyLevel", 6), ("energyLevel", True)):
            values = preferences()
            if value is None:
                del values[key]
            else:
                values[key] = value
            with self.assertRaisesRegex(ValueError, key):
                validate_preferences(values)

    def test_scenario_3_profile_aggregation_matches_node(self):
        values = preferences()
        values.update(attentionNeeds=1, groomingNeeds=5, healthRiskLevel=4)
        profile = build_user_profile(values)
        self.assertEqual(profile["attentionNeeds"], 3)
        self.assertNotIn("specialNeeds", profile)
        self.assertNotIn("climateTolerance", profile)

    def test_scenario_4_exact_close_far_ranking_matches_node(self):
        self.assertEqual(cosine_similarity([4.0] * 16, [4.0] * 16), 1.0)
        self.assertEqual(score_pet([4.0] * 16, [4.0] * 16), {"matchScore": 1.0, "matchPercent": 100.0})
        result = score_matches(MatchRequest(
            preferences=preferences(4),
            animals=[animal("far", 1), animal("close", 3), animal("exact", 4)],
            top_k=3,
        ))
        self.assertEqual([item["id"] for item in result["matches"]], ["exact", "close", "far"])
        self.assertEqual(result["matches"][0]["matchPercent"], 100)

    def test_scenario_5_missing_animal_traits_default_to_three(self):
        self.assertEqual(safe_num(None), 3.0)
        baseline = score_matches(MatchRequest(
            preferences=preferences(3),
            animals=[animal("complete", 3), animal("missing", 3, "energyLevel")],
            top_k=2,
        ))
        by_id = {item["id"]: item for item in baseline["matches"]}
        self.assertEqual(by_id["complete"]["matchScore"], 1)
        self.assertEqual(by_id["missing"]["matchScore"], 1)


if __name__ == "__main__":
    unittest.main()
