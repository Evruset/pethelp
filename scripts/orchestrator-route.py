#!/usr/bin/env python3
"""Plan ordered VetHelp execution steps. The router does not launch agents."""
from __future__ import annotations

import argparse
import json
import os
import sys
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / ".codex/policies/model-catalog.toml"
BUDGETS = ROOT / ".codex/policies/context-budgets.toml"
with CATALOG.open("rb") as _catalog_handle:
    MODEL_CATALOG = tomllib.load(_catalog_handle)["models"]
with BUDGETS.open("rb") as _budget_handle:
    CONTEXT_BUDGETS = tomllib.load(_budget_handle)
CONFIG = tomllib.loads((ROOT / ".codex/config.toml").read_text())
ROLE_MODEL = {"root": (CONFIG["model"], CONFIG["model_reasoning_effort"])}
for profile_path in sorted((ROOT / ".codex/agents").glob("*.toml")):
    profile = tomllib.loads(profile_path.read_text())
    ROLE_MODEL[profile["name"]] = (profile["model"], profile["model_reasoning_effort"])

CHILDREN_ENABLED = (
    CONFIG["agents"]["enabled"]
    and CONFIG["agents"]["max_concurrent_threads_per_session"] > 0
    and CONFIG["agents"]["max_depth"] > 0
)
DISCOVERY_ROLES = {
    "browser": "browser_debugger_terra",
    "external_docs": "docs_researcher_terra",
    "unknown_tests": "affected_tests_luna",
}
VETO_DOMAINS = {"security", "data_loss", "authorization", "concurrency", "idempotency"}
SECURITY_REVIEW_DOMAINS = {"security", "data_loss", "authorization"}
FINGERPRINT_FIELDS = {"scope_diff", "command_config", "environment"}

def _inventory_from_env():
    return [x.strip() for x in os.environ.get("CODEX_AVAILABLE_MODELS", "").split(",") if x.strip()]

def _model_blocker(model, effort, available, max_cost, complexity, risk):
    info = MODEL_CATALOG.get(model)
    if model not in available or not info or effort not in info["reasoning"]:
        return "BLOCKED_MODEL_AVAILABILITY"
    if isinstance(available, dict) and effort not in available[model]:
        return "BLOCKED_MODEL_AVAILABILITY"
    if info["cost_rank"] > max_cost:
        return "model exceeds cost rank budget"
    allowed = info.get("reserved_for")
    if allowed and complexity not in allowed and risk not in allowed:
        return "model reserved for higher complexity or risk"
    return None

def _valid_fingerprint(value):
    return isinstance(value, dict) and set(value)==FINGERPRINT_FIELDS and all(isinstance(value[k],str) and value[k] for k in FINGERPRINT_FIELDS)

def route(request):
    budgets = CONTEXT_BUDGETS
    declared_complexity, declared_risk = request["complexity"], request["risk"]
    if declared_complexity not in {"C0", "C1", "C2", "C3"} or declared_risk not in {"R0", "R1", "R2", "R3"}:
        raise ValueError("complexity and risk must be C0..C3 and R0..R3")
    uncertainty = int(request.get("uncertainty", 0))
    if uncertainty not in range(4):
        raise ValueError("uncertainty must be 0..3")
    complexity_number = int(declared_complexity[1])
    if request.get("architecture_ambiguous") or uncertainty == 3:
        complexity_number = 3
    elif uncertainty == 2:
        complexity_number = max(complexity_number, 2)
    complexity = f"C{complexity_number}"
    max_cost = int(request.get("max_cost_rank", 5))
    risk_domains = set(request.get("risk_domains", []))
    risk = "R3" if risk_domains & VETO_DOMAINS else declared_risk
    available_models = request.get("available_models")
    if available_models is None:
        available_models = _inventory_from_env()
    if not isinstance(available_models, dict):
        available_models = set(available_models)
    available_roles = set(request.get("available_roles", ROLE_MODEL))
    failed = set(request.get("failed_checks", []))
    passed_evidence = request.get("passed_evidence", {})
    current_fingerprints = request.get("current_fingerprints", {})
    if any(not _valid_fingerprint(value) for value in [*passed_evidence.values(), *current_fingerprints.values()]):
        raise ValueError("fingerprints require non-empty scope_diff, command_config, and environment fields")
    passed = {
        check for check, fingerprint in passed_evidence.items()
        if check not in failed and current_fingerprints.get(check) == fingerprint
    }
    stale = {check for check, fingerprint in passed_evidence.items() if current_fingerprints.get(check) != fingerprint}
    if not available_models:
        return {"status": "BLOCKED_MODEL_INVENTORY", "reason": "runtime model inventory is required"}
    tier = "small" if complexity == "C0" and risk in {"R0", "R1"} else ("complex" if complexity == "C3" or risk in {"R2", "R3"} else "standard")
    if tier not in budgets:
        raise ValueError(f"unknown context budget: {tier}")
    context_order = {"small": 0, "standard": 1, "complex": 2}
    available_context = request.get("available_context", "complex")
    if available_context not in context_order or context_order[available_context] < context_order[tier]:
        return {"status": "BLOCKED_CONTEXT", "context": tier, "reason": f"requires {tier}, only {available_context} available"}
    tags = set(request.get("specializations", []))
    high_risk = complexity == "C3" or risk == "R3"
    if failed:
        plan = [("implementer_terra", "targeted_repair", "BLOCKED_REPAIR")]
    else:
        plan = [
            (role, "discovery", "BLOCKED_SPECIALIST")
            for tag, role in DISCOVERY_ROLES.items()
            if tag in tags
        ]
        if request.get("dependency_graph"):
            plan.append(("planner_terra", "planning", "BLOCKED_PLANNING"))
        if high_risk and (request.get("architecture_ambiguous") or uncertainty >= 2):
            plan.append(("architect_sol", "architecture", "BLOCKED_ARCHITECTURE"))
        implementer = "root"
        if high_risk and risk_domains & {"concurrency", "idempotency"}:
            implementer = "complex_implementer_sol"
        plan.append((implementer, "implementation", "BLOCKED_EXECUTION"))
        if "integration" in tags:
            plan.append(("integrator_terra", "integration", "BLOCKED_INTEGRATION"))

        validation, validator = "deterministic", None
        if high_risk:
            validation = "tier_c"
            validator = "security_reviewer_sol" if risk_domains & SECURITY_REVIEW_DOMAINS else "reviewer_sol"
        elif complexity == "C2" or risk == "R2":
            validation = "tier_b"
            validator = "validator_spec_luna" if risk == "R2" else "validator_tests_terra"
        if validator:
            plan.append((validator, "validation", "BLOCKED_VALIDATION"))

    # The executor processes steps in order, including consecutive discovery
    # entries. A plan can use multiple children over time without overlap.
    result = {
        "complexity": complexity, "risk": risk, "context": tier,
        "experts": [], "preserve_pass": sorted(passed), "fallback_used": False,
    }
    for role, phase, blocked_status in plan:
        if role not in available_roles or role not in ROLE_MODEL:
            return {**result, "status": blocked_status, "reason": f"required role unavailable: {role}"}
        if role != "root" and not CHILDREN_ENABLED:
            return {**result, "status": blocked_status, "reason": f"child agents disabled: {role}"}
        model, effort = ROLE_MODEL[role]
        blocker = _model_blocker(model, effort, available_models, max_cost, complexity, risk)
        if blocker:
            return {**result, "status": blocked_status, "reason": f"{blocker}: {role} ({model}/{effort})"}
        result["experts"].append({"role": role, "phase": phase, "model": model, "reasoning_effort": effort})
    if failed:
        return {**result, "status": "REPAIR", "rerun_checks": sorted(failed | stale)}
    return {**result, "status": "READY", "validation": validation, "rerun_checks": sorted(stale)}

def main():
    parser = argparse.ArgumentParser(); parser.add_argument("--request")
    args = parser.parse_args()
    try:
        request = json.loads(args.request if args.request is not None else sys.stdin.read())
        print(json.dumps(route(request), indent=2, sort_keys=True)); return 0
    except (KeyError, ValueError, json.JSONDecodeError) as exc:
        print(json.dumps({"status": "INVALID_REQUEST", "reason": str(exc)}), file=sys.stderr); return 2
if __name__ == "__main__": raise SystemExit(main())
