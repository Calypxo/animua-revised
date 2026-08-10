import unittest

from app import (
    MatchRequest,
    RAW_QUESTION_KEYS,
    SCORING_DIMENSIONS,
    build_user_profile,
    root,
    score_matches,
    validate_preferences,
)


def preferences(value=3):
    return {key: value for key in RAW_QUESTION_KEYS}


def animal(identifier, value=3):
    assessment = {key: value for key, _sources in SCORING_DIMENSIONS}
    return {
        "id": identifier,
        "name": identifier,
        "status": "Ready for Adoption",
        "behavioralAssessment": assessment,
    }


class CompatibilityScoringTests(unittest.TestCase):
    def test_root_reports_that_the_matcher_is_running(self):
        status = root()
        self.assertEqual(status["status"], "online")
        self.assertIn("up and running", status["message"])
        self.assertEqual(status["scoreEndpoint"], "/score")

    def test_minimum_and_maximum_values_are_valid(self):
        self.assertEqual(validate_preferences(preferences(1)), preferences(1))
        self.assertEqual(validate_preferences(preferences(5)), preferences(5))

    def test_missing_and_invalid_values_are_rejected(self):
        missing = preferences()
        del missing["sheddingLevel"]
        with self.assertRaisesRegex(ValueError, "sheddingLevel"):
            validate_preferences(missing)

        invalid = preferences()
        invalid["energyLevel"] = 6
        with self.assertRaisesRegex(ValueError, "energyLevel"):
            validate_preferences(invalid)

    def test_aggregation_matches_node_contract(self):
        answers = preferences()
        answers["attentionNeeds"] = 1
        answers["groomingNeeds"] = 5
        answers["healthRiskLevel"] = 4
        profile = build_user_profile(answers)
        self.assertEqual(profile["attentionNeeds"], 3)
        self.assertEqual(profile["specialNeeds"], 4)
        self.assertNotIn("climateTolerance", profile)
        self.assertNotIn("sheddingLevel", profile)

    def test_exact_and_poor_matches_have_equivalent_ranking(self):
        payload = MatchRequest(
            preferences=preferences(2),
            animals=[animal("far", 5), animal("exact", 2), animal("close", 3)],
            top_k=3,
        )
        result = score_matches(payload)
        self.assertEqual([item["id"] for item in result["matches"]], ["exact", "close", "far"])
        self.assertEqual(result["matches"][0]["matchPercent"], 100)
        self.assertLess(result["matches"][-1]["matchPercent"], 100)


if __name__ == "__main__":
    unittest.main()
