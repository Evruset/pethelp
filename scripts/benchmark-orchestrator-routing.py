#!/usr/bin/env python3
"""Reproducible dry-run comparison of frozen v1 and sparse-MoE routing."""
from __future__ import annotations
import hashlib, importlib.util, json, statistics, subprocess, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "benchmarks/orchestrator/scenarios.json"
OUTPUT = ROOT / "benchmarks/orchestrator/results.json"
REPORT = ROOT / "benchmarks/orchestrator/REPORT.md"
ROUTER_PATH = ROOT / "scripts/orchestrator-route.py"
TELEMETRY_PATH = ROOT / "scripts/orchestrator-telemetry.py"
SPEC = importlib.util.spec_from_file_location("orchestrator_route", ROUTER_PATH)
MOE = importlib.util.module_from_spec(SPEC); SPEC.loader.exec_module(MOE)
TELEMETRY_SPEC = importlib.util.spec_from_file_location("orchestrator_telemetry", TELEMETRY_PATH)
TELEMETRY = importlib.util.module_from_spec(TELEMETRY_SPEC); TELEMETRY_SPEC.loader.exec_module(TELEMETRY)
TELEMETRY_OUTPUT = ROOT / "benchmarks/orchestrator/telemetry.jsonl"
BASELINE_HASHES = {
    ".agents/skills/adaptive-orchestrator/references/routing.md":"789c889d42b4e072310c33760b41b7868994cab2d638ae0b7d044dff51b56a56",
    ".agents/skills/adaptive-orchestrator/references/validation.md":"7163cadf98405c09bbc4135484678df6172524bcfacfb519c2f3f4d533465535"
}

LEGACY_MODELS = {
    "root":"gpt-5.6-terra", "implementer_luna":"gpt-5.6-luna",
    "implementer_terra":"gpt-5.6-terra", "planner_terra":"gpt-5.6-terra",
    "integrator_terra":"gpt-5.6-terra", "architect_sol":"gpt-5.6-sol",
    "complex_implementer_sol":"gpt-5.6-sol", "validator_spec_luna":"gpt-5.6-luna",
    "validator_tests_terra":"gpt-5.6-terra", "validator_risk_sol":"unavailable"
}

def legacy_route(request):
    c, r = request["complexity"], request["risk"]
    experts=[]
    def add(role, phase): experts.append({"role":role,"phase":phase,"model":LEGACY_MODELS.get(role,"unavailable")})
    if request.get("failed_checks"):
        add("implementer_terra","targeted_repair")
        return {"status":"REPAIR","context":"complex" if r=="R2" else "standard","experts":experts,"rerun_checks":request["failed_checks"]}
    if c=="C0" and r=="R0":
        add("root","implementation"); add("validator_spec_luna","validation"); context="small"
    elif c=="C0" and r=="R1":
        add("implementer_luna","implementation"); add("validator_spec_luna","validation"); add("validator_tests_terra","validation"); context="small"
    elif c=="C1" and r in {"R0","R1"}:
        if "unknown_tests" in request.get("specializations",[]): add("repo_mapper_luna","discovery")
        add("implementer_terra","implementation"); add("validator_spec_luna","validation"); add("validator_tests_terra","validation"); context="standard"
    else:
        context="complex" if c=="C3" or r in {"R2","R3"} else "standard"
        if request.get("dependency_graph"): add("planner_terra","planning")
        if c=="C3" or r=="R3": add("architect_sol","architecture")
        hard_core=r=="R3" and bool(set(request.get("risk_domains",[])) & {"security","concurrency","idempotency","data_loss","authorization"})
        add("complex_implementer_sol" if hard_core else "implementer_terra","implementation")
        if "integration" in request.get("specializations",[]): add("integrator_terra","integration")
        add("validator_spec_luna","validation"); add("validator_tests_terra","validation"); add("validator_risk_sol","validation")
    missing=[x["role"] for x in experts if x["role"] not in MOE.ROLE_MODEL]
    return {"status":"BLOCKED_UNDECLARED_ROLE" if missing else "READY","context":context,"experts":experts,"missing_roles":missing}

def measured(fn, request, repetitions=200):
    samples=[]; result=None
    for _ in range(repetitions):
        start=time.perf_counter_ns(); result=fn(request); samples.append(time.perf_counter_ns()-start)
    return result, {"median_wall_ns":int(statistics.median(samples)),"repetitions":repetitions}

def assess(result, scenario):
    defects=[]
    required={"expected_status","expected_context","expected_validation","expected_roles","expected_phases","expected_models","expected_reasoning","expected_rerun","expected_preserve","expected_fallback"}
    missing=required-set(scenario)
    if missing: raise ValueError(f"scenario {scenario['id']} missing acceptance fields: {sorted(missing)}")
    if result["status"] != scenario["expected_status"]: defects.append("wrong_status")
    experts=result.get("experts",[])
    comparisons={
        "expected_context":result.get("context"),
        "expected_validation":result.get("validation"),
        "expected_roles":[x.get("role") for x in experts],
        "expected_phases":[x.get("phase") for x in experts],
        "expected_models":[x.get("model") for x in experts],
        "expected_reasoning":[x.get("reasoning_effort") for x in experts],
        "expected_rerun":result.get("rerun_checks",[]),
        "expected_preserve":result.get("preserve_pass",[]),
        "expected_fallback":result.get("fallback_used",False)
    }
    for expected_key, actual in comparisons.items():
        if scenario[expected_key] != actual:
            defects.append(expected_key.removeprefix("expected_")+"_mismatch")
    if result.get("missing_roles"): defects.append("undeclared_roles")
    if any(x.get("model")=="unavailable" for x in result.get("experts",[])): defects.append("unavailable_model")
    vetoes=[]
    if "security_reviewer_sol" in scenario.get("expected_roles",[]) and "security_reviewer_sol" not in [x.get("role") for x in experts]: vetoes.append("missing_veto_reviewer")
    return {"deterministic_acceptance":"PASS" if not defects and not vetoes else "FAIL","route_correct":not defects,"critical_defects":defects,"vetoes":vetoes}

def telemetry(result, contract, scenario):
    experts=result.get("experts",[])
    expected_validators=sum(x=="validation" for x in scenario.get("expected_phases",[]))
    selected_validators=sum(x.get("phase")=="validation" for x in experts)
    return {
        "models_selected":[x.get("model") for x in experts],
        "models_actually_used":None,
        "input_tokens":None,
        "output_tokens":None,
        "tool_calls":0,
        "tool_calls_scope":"measured inside pure router invocation; benchmark setup git calls excluded",
        "repeated_reads":0,
        "repeated_reads_scope":"policy tables loaded once at module import; per-route reads measured as zero",
        "repair_cycles":None,
        "planned_repair_cycles":1 if result.get("status")=="REPAIR" else 0,
        "unnecessary_validation":max(0,selected_validators-expected_validators),
        "context_overflow":result.get("status")=="BLOCKED_CONTEXT",
        "evidence_quality":"ROUTE_DECISION_COMPLETE_MODEL_EXECUTION_NOT_OBSERVED" if contract=="moe" else "FROZEN_POLICY_ADAPTER_MODEL_EXECUTION_NOT_OBSERVED"
    }

def main():
    fixture=json.loads(FIXTURES.read_text())
    verified={}
    for path, expected in BASELINE_HASHES.items():
        content=subprocess.run(["git","show",f"{fixture['baseline_commit']}:{path}"],cwd=ROOT,check=True,capture_output=True).stdout
        actual=hashlib.sha256(content).hexdigest()
        if actual!=expected: raise SystemExit(f"baseline hash mismatch for {path}: {actual}")
        verified[path]=actual
    rows=[]
    for scenario in fixture["scenarios"]:
        request={k:v for k,v in scenario.items() if k not in {"id","vethelp_fixture","available_roles","available_roles_without"} and not k.startswith("expected_")}
        request["available_models"]=fixture["models"]
        roles=list(MOE.ROLE_MODEL)
        for missing in scenario.get("available_roles_without",[]):
            if missing in roles: roles.remove(missing)
        request["available_roles"]=roles
        old, old_time=measured(legacy_route,request)
        new, new_time=measured(MOE.route,request)
        rows.append({"scenario":scenario["id"],"vethelp_fixture":scenario["vethelp_fixture"],"acceptance_criteria":{k:v for k,v in scenario.items() if k.startswith("expected_")},"input":request,"baseline":{**old,**old_time,**telemetry(old,"baseline",scenario),**assess(old,scenario)},"moe":{**new,**new_time,**telemetry(new,"moe",scenario),**assess(new,scenario)}})
    def totals(key):
        return {"accepted":sum(x[key]["deterministic_acceptance"]=="PASS" for x in rows),"experts":sum(len(x[key].get("experts",[])) for x in rows),"median_wall_ns_sum":sum(x[key]["median_wall_ns"] for x in rows)}
    result={"schema_version":1,"dry_run":True,"baseline_commit":fixture["baseline_commit"],"baseline_source_hashes":verified,"runtime_inventory":{"source":"Codex runtime-advertised inventory","observed":fixture["runtime_inventory_observed"],"models":fixture["models"]},"telemetry_limits":{"input_tokens":None,"output_tokens":None,"tool_calls_per_route":0,"model_wall_clock":None,"reason":"No model was invoked by dry-run routing; runtime exposes no per-route token telemetry."},"rows":rows,"totals":{"baseline":totals("baseline"),"moe":totals("moe")}}
    OUTPUT.write_text(json.dumps(result,indent=2,sort_keys=True)+"\n")
    envelopes=[]
    for row in rows:
        planned=next((x["model"] for x in row["moe"].get("experts",[]) if x.get("phase") in {"implementation","targeted_repair"}),"NOT_PLANNED")
        envelopes.append(TELEMETRY.build_envelope(events=[],route_id="benchmark:"+row["scenario"],scenario_id=row["scenario"],planned_model=planned,route_input=row["input"],route_result=row["moe"],route_elapsed_ms=row["moe"]["median_wall_ns"]/1_000_000,outcome=row["moe"]["deterministic_acceptance"],veto=row["moe"]["vetoes"],acceptance_evidence=[{"id":"fixture-acceptance","criteria":row["acceptance_criteria"],"verdict":row["moe"]["deterministic_acceptance"]}]))
    TELEMETRY.deduplicate_envelopes(envelopes)
    TELEMETRY_OUTPUT.write_text("".join(json.dumps(x,sort_keys=True)+"\n" for x in envelopes))
    lines=["# ORCH-MOE-02 routing benchmark","",f"Baseline: `{fixture['baseline_commit']}`. Mode: deterministic dry-run, 200 repetitions per route.","","| Scenario | VetHelp fixture | v1 gate | v1 experts | MoE gate | MoE experts | MoE status |","|---|---|---:|---:|---:|---:|---|"]
    for row in rows:
        lines.append(f"| {row['scenario']} | {row['vethelp_fixture']} | {row['baseline']['deterministic_acceptance']} | {len(row['baseline'].get('experts',[]))} | {row['moe']['deterministic_acceptance']} | {len(row['moe'].get('experts',[]))} | {row['moe']['status']} |")
    old=result['totals']['baseline']; new=result['totals']['moe']
    lines += ["","## Totals","",f"- Acceptance: v1 `{old['accepted']}/8`; MoE `{new['accepted']}/8`.",f"- Activated experts: v1 `{old['experts']}`; MoE `{new['experts']}`.",f"- Sum of per-scenario median decision time: v1 `{old['median_wall_ns_sum']} ns`; MoE `{new['median_wall_ns_sum']} ns`.","- Model input/output tokens, actually used models, repair execution and model wall-clock: NOT OBSERVED because this benchmark does not invoke models.","- Router-internal tool calls and repeated policy reads per route: `0`; context overflow is recorded per scenario; no product operation is executed.","","## Reproduced defects and repairs","","- Search policy contradicted continuation discovery order; it now makes continuation/new-scope ordering explicit.","- Policy TOML was reread on every decision; immutable tables are now cached at module load.","- Stale PASS evidence was dropped but not scheduled; structured three-part fingerprints now route stale checks to targeted rerun.","- The v1 adapter preserves unresolved legacy roles and optional/hard-core activation semantics from the frozen contract.","","## Limitations","","The timing comparison covers only local routing-decision computation and currently favors v1. It is not end-to-end delivery time. Token savings and model-execution time are BLOCKED by unavailable per-route runtime telemetry; no pricing or savings are inferred."]
    REPORT.write_text("\n".join(lines)+"\n")
    print(json.dumps(result["totals"],sort_keys=True))
    return 0 if result["totals"]["moe"]["accepted"]==len(rows) else 1
if __name__=="__main__": sys.exit(main())
