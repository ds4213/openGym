import unittest
import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location("build_program_catalog", Path(__file__).with_name("build-program-catalog.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
normalise_detail = module.normalise_detail


class ProgramDetailTest(unittest.TestCase):
    def test_groups_and_orders_source_workouts_without_losing_set_fields(self):
        source = {
            "id": "p1",
            "name": "Example",
            "number_of_weeks": 1,
            "workouts": [
                {"id": "d2", "name": "Day 2", "week": 1, "exercises": []},
                {"id": "d1", "name": "Day 1", "week": 1, "exercises": [{
                    "id": "e1", "category": "Push", "exerciseSets": [
                        {"id": "s2", "order": 1, "type": "pr", "reps": 5, "percentage": .85},
                        {"id": "s1", "order": 0, "type": "warmup", "reps": 5, "percentage": .4},
                    ],
                }]},
            ],
        }
        detail = normalise_detail(source, "community")
        self.assertEqual([day["name"] for day in detail["schedule"][0]["days"]], ["Day 1", "Day 2"])
        sets = detail["schedule"][0]["days"][0]["exercises"][0]["sets"]
        self.assertEqual([(row["type"], row["percentage"]) for row in sets], [("warmup", .4), ("pr", .85)])
        self.assertEqual(detail["compatibilityIssues"], [])
        self.assertEqual(len(detail["contentVersion"]), 64)

    def test_marks_ambiguous_exercises_and_week_count_mismatches(self):
        source = {
            "id": "p2", "name": "Broken", "number_of_weeks": 1,
            "workouts": [
                {"week": 1, "exercises": []},
                {"week": 2, "exercises": [{"exerciseSets": [{"reps": 10}]}]},
            ],
        }
        detail = normalise_detail(source, "community")
        self.assertEqual(detail["compatibilityIssues"], ["exercise-without-name-or-category", "week-count-mismatch"])


if __name__ == "__main__":
    unittest.main()
