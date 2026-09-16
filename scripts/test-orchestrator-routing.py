#!/usr/bin/env python3
import importlib.util, unittest
from pathlib import Path
PATH = Path(__file__).with_name("orchestrator-route.py")
SPEC = importlib.util.spec_from_file_location("orchestrator_route", PATH)
MODULE = importlib.util.module_from_spec(SPEC); SPEC.loader.exec_module(MODULE)
MODELS = ["gpt-6-astra", "gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna", "gpt-5.5"]
ROLES = list(MODULE.ROLE_MODEL)
FP = {"scope_diff":"tree-a","command_config":"cmd-a","environment":"env-a"}
def decision(complexity, risk, **extra):
    return MODULE.route({"complexity": complexity, "risk": risk, "available_models": MODELS, "available_roles": ROLES, **extra})
class RoutingContractTest(unittest.TestCase):
    def test_c0_r0_minimal_workflow(self):
        r=decision("C0","R0"); self.assertEqual(["root"],[x["role"] for x in r["experts"]]); self.assertEqual("small",r["context"])
    def test_c1_r1_normal_implementation(self):
        r=decision("C1","R1"); self.assertEqual(["implementer_terra","validator_spec_luna"],[x["role"] for x in r["experts"]])
    def test_c2_r2_cross_module(self):
        r=decision("C2","R2",dependency_graph=True); self.assertEqual("complex",r["context"]); self.assertEqual(["planner_terra","implementer_terra","validator_tests_terra"],[x["role"] for x in r["experts"]])
    def test_c3_r3_uses_astra_for_architecture(self):
        r=decision("C3","R3",risk_domains=["concurrency"],architecture_ambiguous=True); self.assertEqual("gpt-6-astra",r["experts"][0]["model"]); self.assertEqual("security_reviewer_sol",r["experts"][-1]["role"])
    def test_astra_unavailable_falls_back_to_sol(self):
        r=MODULE.route({"complexity":"C3","risk":"R3","architecture_ambiguous":True,"available_models":MODELS[1:],"available_roles":ROLES}); self.assertEqual("gpt-5.6-sol",r["experts"][0]["model"]); self.assertTrue(r["fallback_used"])
    def test_validator_unavailable_degrades_safely(self):
        roles=[x for x in ROLES if x not in {"reviewer_sol","security_reviewer_sol"}]; r=MODULE.route({"complexity":"C3","risk":"R3","risk_domains":["authorization"],"available_models":MODELS,"available_roles":roles}); self.assertEqual("BLOCKED_VALIDATION",r["status"])
    def test_failure_routes_only_targeted_repair(self):
        r=decision("C2","R2",failed_checks=["routing:test"],passed_evidence={"lint":FP,"schema":FP},current_fingerprints={"lint":FP,"schema":FP}); self.assertEqual("REPAIR",r["status"]); self.assertEqual(["routing:test"],r["rerun_checks"]); self.assertEqual(["lint","schema"],r["preserve_pass"])
    def test_sticky_pass_does_not_repeat_checks(self):
        changed={**FP,"scope_diff":"tree-b"}
        r=decision("C1","R1",passed_evidence={"routing:test":FP,"diff-check":FP},current_fingerprints={"routing:test":FP,"diff-check":changed}); self.assertEqual(["diff-check"],r["rerun_checks"]); self.assertEqual(["routing:test"],r["preserve_pass"])

    def test_incomplete_fingerprint_is_rejected(self):
        with self.assertRaisesRegex(ValueError,"fingerprints require"):
            decision("C1","R1",passed_evidence={"x":{"scope_diff":"a"}},current_fingerprints={})

    def test_all_complexity_risk_pairs_have_total_safe_routing(self):
        for c in range(4):
            for risk in range(4):
                r=decision(f"C{c}",f"R{risk}")
                expected="complex" if c==3 or risk>=2 else ("small" if c==0 else "standard")
                self.assertEqual(expected,r["context"],(c,risk,r))

    def test_c3_low_risk_still_uses_complex_budget(self):
        for risk in ("R0","R1"):
            r=decision("C3",risk)
            self.assertEqual("complex",r["context"])

    def test_veto_domain_raises_every_pair_to_safe_tier(self):
        for c in range(4):
            for risk in range(4):
                r=decision(f"C{c}",f"R{risk}",risk_domains=["authorization"])
                self.assertEqual("R3",r["risk"],(c,risk,r))
                self.assertEqual("complex",r["context"],(c,risk,r))
                self.assertEqual("tier_c",r["validation"],(c,risk,r))
                self.assertEqual("security_reviewer_sol",r["experts"][-1]["role"],(c,risk,r))

    def test_missing_required_roles_block_each_phase(self):
        cases=[
            ({"complexity":"C1","risk":"R1"},"implementer_terra","BLOCKED_EXECUTION"),
            ({"complexity":"C1","risk":"R1"},"validator_spec_luna","BLOCKED_VALIDATION"),
            ({"complexity":"C2","risk":"R2","failed_checks":["x"]},"implementer_terra","BLOCKED_REPAIR"),
        ]
        for request,missing,status in cases:
            r=MODULE.route({**request,"available_models":MODELS,"available_roles":[x for x in ROLES if x!=missing]})
            self.assertEqual(status,r["status"])

    def test_uncertainty_specialization_cost_and_context_are_executable(self):
        low=decision("C3","R3",uncertainty=0)
        self.assertNotIn("architect_sol",[x["role"] for x in low["experts"]])
        high=decision("C3","R3",uncertainty=2)
        self.assertEqual("gpt-6-astra",high["experts"][0]["model"])
        browser=decision("C1","R1",specializations=["browser"])
        self.assertEqual("browser_debugger_terra",browser["experts"][0]["role"])
        blocked=decision("C2","R2",available_context="standard")
        self.assertEqual("BLOCKED_CONTEXT",blocked["status"])
        capped=decision("C3","R3",uncertainty=2,max_cost_rank=3)
        self.assertEqual("gpt-5.6-sol",capped["experts"][0]["model"])

    def test_uncertainty_raises_effective_complexity(self):
        r=decision("C0","R0",uncertainty=3)
        self.assertEqual("C3",r["complexity"]); self.assertEqual("complex",r["context"])
        r=decision("C1","R1",architecture_ambiguous=True)
        self.assertEqual("C3",r["complexity"]); self.assertEqual("architect_sol",r["experts"][0]["role"])

    def test_integration_precedes_final_validation(self):
        r=decision("C2","R1",specializations=["integration"])
        self.assertEqual(["implementation","integration","validation"],[x["phase"] for x in r["experts"]])
        roles=[x for x in ROLES if x!="validator_tests_terra"]
        blocked=MODULE.route({"complexity":"C2","risk":"R1","specializations":["integration"],"available_models":MODELS,"available_roles":roles})
        self.assertEqual("BLOCKED_VALIDATION",blocked["status"])
if __name__ == "__main__": unittest.main(verbosity=2)
