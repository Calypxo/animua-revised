import unittest
from unittest.mock import patch

import app


class UT014PythonSurrenderAnalysisRules(unittest.TestCase):
    """Formal UT-014 scenarios; execution is reserved for Test Cycle 1."""

    def test_scenario_1_empty_reason_returns_complete_low_other_contract(self):
        result = app.analyze_reason("   ")
        self.assertEqual(result["sentiment"], "Neutral")
        self.assertEqual(result["category"], "Other")
        self.assertEqual(result["urgencyLabel"], "Low")
        self.assertEqual(result["urgencyScore"], 10)
        self.assertEqual(
            set(result),
            {"sentiment", "category", "urgencyLabel", "urgencyScore", "confidence", "keywords", "suggestedPriority", "source"},
        )

    def test_scenario_2_mag_aabroad_overrides_other_to_relocation(self):
        self.assertEqual(app.apply_category_override("Kami ay mag-aabroad.", "Other"), "Relocation")

    def test_scenario_3_bleeding_and_urgent_treatment_are_critical_95(self):
        self.assertEqual(app.map_urgency("Negative", "Medical", "Dumudugo at kailangan ng agarang gamutan."), ("Critical", 95))
        self.assertIn("dumudugo", app.extract_keywords("Dumudugo at kailangan ng agarang gamutan."))

    def test_scenario_4_neutral_relocation_is_low_25(self):
        self.assertEqual(app.map_urgency("Neutral", "Relocation", "Lilipat kami."), ("Low", 25))
        self.assertEqual(app.suggested_priority_from_urgency("Low"), "Normal Priority")

    def test_scenario_5_confidence_is_the_rounded_average_of_both_models(self):
        with patch.object(
            app,
            "predict_sentiment_and_category",
            return_value={
                "sentiment": ("Urgent", 0.91),
                "category": ("Medical", 0.87),
                "source": app.MODEL_SOURCE_LABEL,
            },
        ):
            result = app.analyze_reason("May sakit ang alaga.")
        self.assertEqual(result["confidence"], 0.89)
        self.assertEqual(result["sentiment"], "Urgent")
        self.assertEqual(result["category"], "Medical")
        self.assertEqual(result["source"], app.MODEL_SOURCE_LABEL)


if __name__ == "__main__":
    unittest.main()
