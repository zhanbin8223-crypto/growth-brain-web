import unittest
from readiness_guard import assess, State

class GateTests(unittest.TestCase):
    def test_observed_false_positive_exit(self):
        actual = '[OK] Daemon: running on port 19825 (v1.8.8)\n[MISSING] Extension: not connected\n[FAIL] Connectivity: failed (Browser Bridge extension not connected)'
        self.assertEqual(assess(0, actual).state, State.UNAVAILABLE)
    def test_exit_zero_is_not_browser_evidence(self):
        self.assertEqual(assess(0, '[OK] Daemon: running').state, State.UNVERIFIED)
    def test_nonzero_is_not_ready(self):
        self.assertEqual(assess(69, 'unavailable', browser_operation_verified=True).state, State.UNAVAILABLE)
    def test_empty_output_is_not_ready(self):
        self.assertEqual(assess(0, '', browser_operation_verified=True).state, State.UNVERIFIED)
    def test_missing_dependency_wins(self):
        self.assertEqual(assess(0, '[MISSING] Extension', browser_operation_verified=True).state, State.UNAVAILABLE)
    def test_positive_fixture_is_structural_only(self):
        self.assertEqual(assess(0, '[OK] Browser connectivity', browser_operation_verified=True).state, State.READY)

if __name__ == '__main__':
    unittest.main(verbosity=2)
