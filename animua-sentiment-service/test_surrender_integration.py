import unittest
from unittest.mock import patch

import app
import model_config


REQUIRED_NLP_FIELDS = {
    "sentiment",
    "category",
    "urgencyLabel",
    "urgencyScore",
    "confidence",
    "sentimentConfidence",
    "categoryConfidence",
    "modelCategory",
    "categoryAdjusted",
    "categoryAdjustmentReason",
    "keywords",
    "suggestedPriority",
    "rulesVersion",
    "source",
}


class SurrenderIntegrationTests(unittest.TestCase):
    def test_service_is_configured_for_tagalog_roberta(self):
        status = app.home()

        self.assertEqual(
            model_config.DEFAULT_MODEL_NAME,
            "jcblaise/roberta-tagalog-base",
        )
        self.assertEqual(status["configuredModel"], model_config.MODEL_NAME)
        self.assertEqual(
            set(status["loadedTasks"]),
            {"sentiment", "category"},
        )

    def test_fallback_preserves_surrender_nlp_contract(self):
        with patch.dict(
            app.transformer_models,
            {"sentiment": None, "category": None},
            clear=True,
        ):
            result = app.analyze_reason(
                "May sakit po ang aso ko at kailangan niya ng tulong agad."
            )

        self.assertEqual(set(result), REQUIRED_NLP_FIELDS)
        self.assertIn(
            result["sentiment"],
            app.EXPECTED_TASK_LABELS["sentiment"],
        )
        self.assertIn(
            result["category"],
            app.EXPECTED_TASK_LABELS["category"],
        )
        self.assertEqual(result["source"], app.FALLBACK_SOURCE_LABEL)

    def test_tagalog_transformer_preserves_surrender_nlp_contract(self):
        predictions = {
            "sentiment": ("Urgent", 0.91),
            "category": ("Medical", 0.87),
        }

        with (
            patch.dict(
                app.transformer_models,
                {"sentiment": object(), "category": object()},
                clear=True,
            ),
            patch.object(
                app,
                "get_transformer_prediction",
                side_effect=lambda task, _text: predictions[task],
            ),
        ):
            result = app.analyze_reason(
                "May sakit po ang aso ko at kailangan niya ng tulong agad."
            )

        self.assertEqual(set(result), REQUIRED_NLP_FIELDS)
        self.assertEqual(result["sentiment"], "Urgent")
        self.assertEqual(result["category"], "Medical")
        self.assertEqual(result["source"], app.MODEL_SOURCE_LABEL)

    def test_explicit_tagalog_medical_emergency_is_critical(self):
        urgency, score = app.map_urgency(
            "Negative",
            "Medical",
            "Dumudugo ang aso at kailangan ng agarang gamutan.",
        )

        self.assertEqual(urgency, "Critical")
        self.assertEqual(score, 95)

    def test_short_tagalog_appetite_symptom_is_corrected_after_prediction(self):
        with patch.object(
            app,
            "predict_sentiment_and_category",
            return_value={
                "sentiment": ("Negative", 0.88),
                "category": ("Overcrowding", 0.58),
                "source": app.MODEL_SOURCE_LABEL,
            },
        ):
            result = app.analyze_reason("Ang aso ko ay hindi kumakain.")

        self.assertEqual(result["category"], "Medical")
        self.assertEqual(result["urgencyLabel"], "High")
        self.assertEqual(result["urgencyScore"], 75)
        self.assertEqual(result["modelCategory"], "Overcrowding")
        self.assertTrue(result["categoryAdjusted"])
        self.assertEqual(result["confidence"], 0.58)

    def test_imperfect_english_overcrowding_reason_is_corrected_after_prediction(self):
        with patch.object(
            app,
            "predict_sentiment_and_category",
            return_value={
                "sentiment": ("Negative", 0.89),
                "category": ("Other", 0.60),
                "source": app.MODEL_SOURCE_LABEL,
            },
        ):
            result = app.analyze_reason("Too much Cat needed space.")

        self.assertEqual(result["category"], "Overcrowding")
        self.assertEqual(result["urgencyLabel"], "Medium")
        self.assertEqual(result["urgencyScore"], 55)
        self.assertEqual(result["modelCategory"], "Other")
        self.assertTrue(result["categoryAdjusted"])
        self.assertEqual(
            result["categoryAdjustmentReason"],
            "Explicit overcrowding or space constraint",
        )
        self.assertEqual(result["confidence"], 0.60)

    def test_ambiguous_space_wording_does_not_force_overcrowding(self):
        reasons = [
            "My cat needs more space to exercise.",
            "I have many questions about cats.",
            "Too much work; my cat needed space.",
            "The owner has no space in the schedule for a vet visit.",
        ]

        for reason in reasons:
            with self.subTest(reason=reason):
                category, adjustment_reason = app.resolve_category(
                    reason,
                    "Other",
                )

                self.assertEqual(category, "Other")
                self.assertEqual(adjustment_reason, "")

    def test_clear_english_and_tagalog_overcrowding_phrases_are_recognized(self):
        reasons = [
            "Too many cats, we need more space.",
            "We have no space for all our pets.",
            "Sobrang dami ng mga pusa namin at kulang ang space.",
        ]

        for reason in reasons:
            with self.subTest(reason=reason):
                self.assertEqual(
                    app.apply_category_override(reason, "Other"),
                    "Overcrowding",
                )

    def test_meaningless_reason_does_not_receive_a_model_guess(self):
        with patch.object(
            app,
            "predict_sentiment_and_category",
        ) as predictor:
            result = app.analyze_reason("xsx")

        predictor.assert_not_called()
        self.assertEqual(result["sentiment"], "Neutral")
        self.assertEqual(result["category"], "Other")
        self.assertEqual(result["urgencyLabel"], "Low")
        self.assertEqual(result["urgencyScore"], 10)
        self.assertEqual(result["confidence"], 0.0)
        self.assertEqual(
            result["categoryAdjustmentReason"],
            "Insufficient meaningful text",
        )

    def test_financial_and_abandonment_conflicts_keep_the_intended_category(self):
        financial = app.resolve_category(
            "Wala na akong pera para sa pagkain at gamot niya.",
            "Financial",
        )
        abandonment = app.resolve_category(
            "Wala nang mag-aalaga sa kanya kapag umalis ako.",
            "Abandonment Risk",
        )

        self.assertEqual(financial[0], "Financial")
        self.assertEqual(abandonment[0], "Abandonment Risk")

    def test_health_exposes_rules_version_for_deployment_verification(self):
        status = app.health()
        self.assertEqual(status["rulesVersion"], app.RULES_VERSION)


if __name__ == "__main__":
    unittest.main()
