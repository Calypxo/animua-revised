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
            {
                "sentiment", "category", "urgencyLabel", "urgencyScore",
                "confidence", "sentimentConfidence", "categoryConfidence",
                "modelCategory", "categoryAdjusted", "categoryAdjustmentReason",
                "keywords", "suggestedPriority", "rulesVersion", "source",
            },
        )

    def test_scenario_2_mag_aabroad_overrides_other_to_relocation(self):
        self.assertEqual(app.apply_category_override("Kami ay mag-aabroad.", "Other"), "Relocation")

    def test_scenario_3_bleeding_and_urgent_treatment_are_critical_95(self):
        self.assertEqual(app.map_urgency("Negative", "Medical", "Dumudugo at kailangan ng agarang gamutan."), ("Critical", 95))
        self.assertIn("dumudugo", app.extract_keywords("Dumudugo at kailangan ng agarang gamutan."))

    def test_scenario_4_neutral_relocation_is_low_25(self):
        self.assertEqual(app.map_urgency("Neutral", "Relocation", "Lilipat kami."), ("Low", 25))
        self.assertEqual(app.suggested_priority_from_urgency("Low"), "Normal Priority")

    def test_scenario_5_confidence_represents_the_category_prediction(self):
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
        self.assertEqual(result["confidence"], 0.87)
        self.assertEqual(result["categoryConfidence"], 0.87)
        self.assertEqual(result["sentimentConfidence"], 0.91)
        self.assertFalse(result["categoryAdjusted"])
        self.assertEqual(result["sentiment"], "Urgent")
        self.assertEqual(result["category"], "Medical")
        self.assertEqual(result["source"], app.MODEL_SOURCE_LABEL)

    def test_short_not_eating_message_overrides_wrong_category_to_medical(self):
        self.assertEqual(
            app.apply_category_override(
                "Ang aso ko ay hindi kumakain.",
                "Overcrowding",
            ),
            "Medical",
        )

    def test_not_eating_alone_is_high_not_critical(self):
        self.assertEqual(
            app.map_urgency(
                "Negative",
                "Medical",
                "Ang aso ko ay hindi kumakain.",
            ),
            ("High", 75),
        )

    def test_breathing_difficulty_remains_critical(self):
        self.assertEqual(
            app.map_urgency(
                "Negative",
                "Medical",
                "Nahihirapang huminga at nanghihina ang aso.",
            ),
            ("Critical", 95),
        )

    def test_lumipat_overrides_non_medical_prediction_to_relocation(self):
        self.assertEqual(
            app.apply_category_override(
                "Kumakain naman siya pero kailangan naming lumipat.",
                "Other",
            ),
            "Relocation",
        )

    def test_financial_constraint_wins_over_standalone_gamot(self):
        self.assertEqual(
            app.apply_category_override(
                "Wala na akong pera para sa pagkain at gamot niya.",
                "Financial",
            ),
            "Financial",
        )

    def test_abandonment_phrase_wins_over_umalis(self):
        self.assertEqual(
            app.apply_category_override(
                "Wala nang mag-aalaga sa kanya kapag umalis ako.",
                "Abandonment Risk",
            ),
            "Abandonment Risk",
        )

    def test_explicit_relocation_with_caregiver_absence_stays_relocation(self):
        self.assertEqual(
            app.apply_category_override(
                "Kami ay aalis ng Angeles City at walang mag-aalaga.",
                "Relocation",
            ),
            "Relocation",
        )

    def test_bare_alis_does_not_match_inside_umalis(self):
        self.assertFalse(app.contains_phrase("Kapag umalis ako.", ["alis"]))

    def test_uninformative_short_reason_is_detected(self):
        self.assertTrue(app.is_insufficient_reason("xsx"))
        self.assertTrue(app.is_insufficient_reason("testing"))
        self.assertFalse(app.is_insufficient_reason("May sakit"))
        self.assertFalse(app.is_insufficient_reason("Nangangagat"))


if __name__ == "__main__":
    unittest.main()
