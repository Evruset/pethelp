#!/usr/bin/env python3
import importlib.util
import unittest
from pathlib import Path

PATH = Path(__file__).with_name("orchestrator-route.py")
SPEC = importlib.util.spec_from_file_location("orchestrator_route", PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)

# Client-confirmed inventory, limited to the efforts exercised in these tests.
SOL = "gpt-6.2-sol"
ASTRA = "gpt-6.2-astra"
LUNA = "gpt-6-luna"
TERRA = "gpt-6.1-terra"
MODELS = {SOL: ["medium", "high"], ASTRA: ["high"], LUNA: ["high"], TERRA: ["medium"]}
ROLES = list(MODULE.ROLE_MODEL)
FP = {"scope_diff": "tree-a", "command_config": "cmd-a", "environment": "env-a"}


def decision(complexity, risk, **extra):
    return MODULE.route({
        "complexity": complexity,
        "risk": risk,
        "available_models": MODELS,
        "available_roles": ROLES,
        **extra,
    })


class RoutingContractTest(unittest.TestCase):
    def assert_plan(self, result, validation, experts):
        self.assertEqual("READY", result["status"], result)
        self.assertEqual(validation, result["validation"])
        self.assertEqual(experts, [
            (step["role"], step["phase"], step["model"], step["reasoning_effort"])
            for step in result["experts"]
        ])

    def test_c0_r0_minimal_workflow(self):
        result = decision("C0", "R0")
        self.assertEqual("small", result["context"])
        self.assert_plan(result, "deterministic", [("root", "implementation", SOL, "medium")])

    def test_c1_r1_normal_implementation(self):
        result = decision("C1", "R1", available_roles=["root"])
        self.assertEqual("standard", result["context"])
        self.assert_plan(result, "deterministic", [("root", "implementation", SOL, "medium")])

    def test_c2_r2_cross_module(self):
        result = decision("C2", "R2", dependency_graph=True)
        self.assertEqual("complex", result["context"])
        self.assert_plan(result, "tier_b", [
            ("planner_terra", "planning", SOL, "medium"),
            ("root", "implementation", SOL, "medium"),
            ("validator_spec_luna", "validation", LUNA, "high"),
        ])

    def test_c3_r3_uses_astra_for_architecture(self):
        result = decision("C3", "R3", risk_domains=["concurrency"], architecture_ambiguous=True)
        self.assert_plan(result, "tier_c", [
            ("architect_sol", "architecture", ASTRA, "high"),
            ("complex_implementer_sol", "implementation", ASTRA, "high"),
            ("reviewer_sol", "validation", SOL, "high"),
        ])

    def test_astra_unavailable_blocks_without_fallback(self):
        for inventory in (
            {model: efforts for model, efforts in MODELS.items() if model != ASTRA},
            {**MODELS, ASTRA: ["medium"]},
        ):
            with self.subTest(inventory=inventory):
                result = decision("C3", "R3", architecture_ambiguous=True, available_models=inventory)
                self.assertEqual("BLOCKED_ARCHITECTURE", result["status"])
                self.assertIn("BLOCKED_MODEL_AVAILABILITY", result["reason"])
                self.assertIn("architect_sol", result["reason"])
                self.assertFalse(result["fallback_used"])
                self.assertEqual([], result["experts"])

    def test_validator_unavailable_degrades_safely(self):
        for overrides in (
            {"available_roles": [role for role in ROLES if role != "security_reviewer_sol"]},
            {"available_models": {model: efforts for model, efforts in MODELS.items() if model != ASTRA}},
        ):
            with self.subTest(overrides=overrides):
                result = decision("C3", "R3", risk_domains=["authorization"], **overrides)
                self.assertEqual("BLOCKED_VALIDATION", result["status"])
                self.assertIn("security_reviewer_sol", result["reason"])
                self.assertFalse(result["fallback_used"])
                self.assertEqual(["root"], [step["role"] for step in result["experts"]])

    def test_failure_routes_only_targeted_repair(self):
        result = decision(
            "C2", "R2", failed_checks=["routing:test"], specializations=["browser"],
            passed_evidence={"lint": FP, "schema": FP},
            current_fingerprints={"lint": FP, "schema": FP},
        )
        self.assertEqual("REPAIR", result["status"])
        self.assertEqual(["routing:test"], result["rerun_checks"])
        self.assertEqual(["lint", "schema"], result["preserve_pass"])
        self.assertEqual([{
            "role": "implementer_terra", "phase": "targeted_repair",
            "model": SOL, "reasoning_effort": "medium",
        }], result["experts"])

    def test_sticky_pass_does_not_repeat_checks(self):
        changed = {**FP, "scope_diff": "tree-b"}
        result = decision(
            "C1", "R1",
            passed_evidence={"routing:test": FP, "diff-check": FP},
            current_fingerprints={"routing:test": FP, "diff-check": changed},
        )
        self.assertEqual("READY", result["status"], result)
        self.assertEqual(["diff-check"], result["rerun_checks"])
        self.assertEqual(["routing:test"], result["preserve_pass"])

    def test_incomplete_fingerprint_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "fingerprints require"):
            decision("C1", "R1", passed_evidence={"x": {"scope_diff": "a"}}, current_fingerprints={})

    def test_all_complexity_risk_pairs_have_total_safe_routing(self):
        self.assertEqual(set(MODELS), set(MODULE.MODEL_CATALOG))
        self.assertEqual(
            {"C3", "R3"}, set(MODULE.MODEL_CATALOG[ASTRA]["reserved_for"])
        )
        # Codex applies the concurrency and nesting limits to the serial plan.
        self.assertEqual(2, MODULE.CONFIG["agents"]["max_concurrent_threads_per_session"])
        self.assertEqual(1, MODULE.CONFIG["agents"]["max_depth"])
        tiers = (
            ("small", "small", "complex", "complex"),
            ("standard", "standard", "complex", "complex"),
            ("standard", "standard", "complex", "complex"),
            ("complex", "complex", "complex", "complex"),
        )
        for c, contexts in enumerate(tiers):
            for risk, expected in enumerate(contexts):
                with self.subTest(complexity=c, risk=risk):
                    result = decision(f"C{c}", f"R{risk}")
                    self.assertEqual("READY", result["status"], result)
                    self.assertEqual(expected, result["context"])

    def test_c3_low_risk_still_uses_complex_budget(self):
        for risk in ("R0", "R1"):
            with self.subTest(risk=risk):
                result = decision("C3", risk)
                self.assertEqual("complex", result["context"])
                self.assert_plan(result, "tier_c", [
                    ("root", "implementation", SOL, "medium"),
                    ("reviewer_sol", "validation", SOL, "high"),
                ])

    def test_veto_domain_raises_every_pair_to_safe_tier(self):
        for c in range(4):
            for risk in range(4):
                with self.subTest(complexity=c, risk=risk):
                    result = decision(f"C{c}", f"R{risk}", risk_domains=["authorization"])
                    self.assertEqual("R3", result["risk"])
                    self.assertEqual("complex", result["context"])
                    self.assert_plan(result, "tier_c", [
                        ("root", "implementation", SOL, "medium"),
                        ("security_reviewer_sol", "validation", ASTRA, "high"),
                    ])

    def test_missing_required_roles_block_each_phase(self):
        cases = [
            ("C1", "R1", {}, "root", "BLOCKED_EXECUTION"),
            ("C2", "R2", {"dependency_graph": True}, "planner_terra", "BLOCKED_PLANNING"),
            ("C2", "R2", {}, "validator_spec_luna", "BLOCKED_VALIDATION"),
            ("C2", "R1", {"specializations": ["integration"]}, "integrator_terra", "BLOCKED_INTEGRATION"),
            ("C3", "R3", {"architecture_ambiguous": True}, "architect_sol", "BLOCKED_ARCHITECTURE"),
            ("C2", "R2", {"failed_checks": ["x"]}, "implementer_terra", "BLOCKED_REPAIR"),
        ]
        for c, risk, inputs, missing, status in cases:
            with self.subTest(missing=missing):
                roles = [role for role in ROLES if role != missing]
                result = decision(c, risk, available_roles=roles, **inputs)
                self.assertEqual(status, result["status"], result)
                self.assertIn(missing, result["reason"])

    def test_uncertainty_specialization_cost_and_context_are_executable(self):
        low = decision("C3", "R3", uncertainty=0)
        self.assert_plan(low, "tier_c", [
            ("root", "implementation", SOL, "medium"),
            ("reviewer_sol", "validation", SOL, "high"),
        ])
        high = decision("C3", "R3", uncertainty=2)
        self.assert_plan(high, "tier_c", [
            ("architect_sol", "architecture", ASTRA, "high"),
            ("root", "implementation", SOL, "medium"),
            ("reviewer_sol", "validation", SOL, "high"),
        ])
        browser = decision("C1", "R1", specializations=["browser"])
        self.assert_plan(browser, "deterministic", [
            ("browser_debugger_terra", "discovery", TERRA, "medium"),
            ("root", "implementation", SOL, "medium"),
        ])
        blocked = decision("C2", "R2", available_context="standard")
        self.assertEqual("BLOCKED_CONTEXT", blocked["status"])
        capped = decision("C3", "R3", uncertainty=2, max_cost_rank=3)
        self.assertEqual("BLOCKED_ARCHITECTURE", capped["status"])
        self.assertIn("cost rank budget", capped["reason"])
        self.assertFalse(capped["fallback_used"])
        self.assertEqual([], capped["experts"])

    def test_uncertainty_raises_effective_complexity(self):
        for c, risk, options in (
            ("C0", "R0", {"uncertainty": 3}),
            ("C1", "R1", {"architecture_ambiguous": True}),
        ):
            with self.subTest(complexity=c, risk=risk):
                result = decision(c, risk, **options)
                self.assertEqual("C3", result["complexity"])
                self.assertEqual("complex", result["context"])
                self.assert_plan(result, "tier_c", [
                    ("architect_sol", "architecture", ASTRA, "high"),
                    ("root", "implementation", SOL, "medium"),
                    ("reviewer_sol", "validation", SOL, "high"),
                ])

    def test_integration_precedes_final_validation(self):
        result = decision("C2", "R1", specializations=["integration"])
        self.assert_plan(result, "tier_b", [
            ("root", "implementation", SOL, "medium"),
            ("integrator_terra", "integration", SOL, "medium"),
            ("validator_tests_terra", "validation", SOL, "medium"),
        ])
        roles = [role for role in ROLES if role != "validator_tests_terra"]
        blocked = decision("C2", "R1", specializations=["integration"], available_roles=roles)
        self.assertEqual("BLOCKED_VALIDATION", blocked["status"])
        self.assertIn("validator_tests_terra", blocked["reason"])


class EvidenceReconciliationTest(unittest.TestCase):
    def test_failed_check_invalidates_previous_pass(self):
        changed = {**FP, "scope_diff": "tree-b"}
        for current in (FP, changed):
            with self.subTest(fingerprint_matches=current == FP):
                result = decision(
                    "C2", "R2", available_models=["gpt-6.2-sol"],
                    failed_checks=["routing:test"],
                    passed_evidence={"routing:test": FP, "lint": FP, "schema": FP},
                    current_fingerprints={"routing:test": current, "lint": FP, "schema": changed},
                )
                self.assertEqual("REPAIR", result["status"])
                self.assertEqual(["routing:test", "schema"], result["rerun_checks"])
                self.assertEqual(set(), set(result["rerun_checks"]) & set(result["preserve_pass"]))
                self.assertEqual(["lint"], result["preserve_pass"])

    def test_matching_pass_is_kept_without_current_failure(self):
        result = decision(
            "C1", "R1", available_models=["gpt-6.2-sol"],
            passed_evidence={"routing:test": FP},
            current_fingerprints={"routing:test": FP},
        )
        self.assertEqual("READY", result["status"])
        self.assertEqual([], result["rerun_checks"])
        self.assertEqual(["routing:test"], result["preserve_pass"])

    def test_required_failure_blocks_when_repair_role_is_unavailable(self):
        result = decision(
            "C2", "R2", available_models=["gpt-6.2-sol"], available_roles=["root"],
            failed_checks=["routing:test"],
            passed_evidence={"routing:test": FP, "lint": FP},
            current_fingerprints={"routing:test": FP, "lint": FP},
        )
        self.assertEqual("BLOCKED_REPAIR", result["status"])
        self.assertEqual(["lint"], result["preserve_pass"])


if __name__ == "__main__": unittest.main(verbosity=2)
