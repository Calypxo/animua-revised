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
    "keywords",
    "suggestedPriority",
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


if __name__ == "__main__":
    unittest.main()
