#!/usr/bin/env python3
"""Deterministic sparse router for the VetHelp adaptive orchestrator."""
from __future__ import annotations
import argparse, json, os, sys, tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / ".codex/policies/model-catalog.toml"
BUDGETS = ROOT / ".codex/policies/context-budgets.toml"
with CATALOG.open("rb") as _catalog_handle:
    MODEL_CATALOG = tomllib.load(_catalog_handle)["models"]
with BUDGETS.open("rb") as _budget_handle:
    CONTEXT_BUDGETS = tomllib.load(_budget_handle)
ROLE_MODEL = {
    "root": ("gpt-5.6-terra", "low"),
    "implementer_luna": ("gpt-5.6-luna", "low"),
    "implementer_terra": ("gpt-5.6-terra", "medium"),
    "planner_terra": ("gpt-5.6-terra", "medium"),
    "architect_sol": ("gpt-6-astra", "high"),
    "complex_implementer_sol": ("gpt-5.6-sol", "high"),
    "validator_spec_luna": ("gpt-5.6-luna", "low"),
    "validator_tests_terra": ("gpt-5.6-terra", "medium"),
    "reviewer_sol": ("gpt-5.6-sol", "high"),
    "security_reviewer_sol": ("gpt-5.6-sol", "high"),
    "browser_debugger_terra": ("gpt-5.6-terra", "medium"),
    "docs_researcher_terra": ("gpt-5.6-terra", "medium"),
    "affected_tests_luna": ("gpt-5.6-luna", "low"),
    "integrator_terra": ("gpt-5.6-terra", "medium"),
}
FALLBACKS = {
    "gpt-6-astra": ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.5"],
    "gpt-5.6-sol": ["gpt-5.6-terra", "gpt-5.5"],
    "gpt-5.6-terra": ["gpt-5.6-luna", "gpt-5.5"],
    "gpt-5.6-luna": ["gpt-5.6-terra", "gpt-5.5"],
}
VETO_DOMAINS = {"security", "data_loss", "authorization", "concurrency", "idempotency"}
FINGERPRINT_FIELDS = {"scope_diff", "command_config", "environment"}

def _inventory_from_env():
    return [x.strip() for x in os.environ.get("CODEX_AVAILABLE_MODELS", "").split(",") if x.strip()]

def _choose_model(preferred, effort, available, catalog, max_cost):
    for candidate in [preferred, *FALLBACKS.get(preferred, [])]:
        info = catalog.get(candidate)
        if candidate in available and info and info["cost_rank"] <= max_cost:
            supported = info["reasoning"]
            selected = effort if effort in supported else supported[-1]
            return candidate, selected, candidate != preferred
    raise ValueError(f"no available model for {preferred}")

def _valid_fingerprint(value):
    return isinstance(value, dict) and set(value)==FINGERPRINT_FIELDS and all(isinstance(value[k],str) and value[k] for k in FINGERPRINT_FIELDS)

def route(request):
    catalog = MODEL_CATALOG
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
    available_models = set(request.get("available_models") or _inventory_from_env())
    available_roles = set(request.get("available_roles", ROLE_MODEL))
    failed = list(request.get("failed_checks", []))
    passed_evidence = request.get("passed_evidence", {})
    current_fingerprints = request.get("current_fingerprints", {})
    if any(not _valid_fingerprint(value) for value in [*passed_evidence.values(), *current_fingerprints.values()]):
        raise ValueError("fingerprints require non-empty scope_diff, command_config, and environment fields")
    passed = {check for check, fingerprint in passed_evidence.items() if current_fingerprints.get(check) == fingerprint}
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
    experts, fallback_used = [], False
    def add(role, phase, preferred=None, effort=None):
        nonlocal fallback_used
        if role not in available_roles:
            return False
        default_model, default_effort = ROLE_MODEL[role]
        try:
            model, selected, fell_back = _choose_model(preferred or default_model, effort or default_effort, available_models, catalog, max_cost)
        except ValueError:
            return False
        fallback_used = fallback_used or fell_back
        experts.append({"role": role, "phase": phase, "model": model, "reasoning_effort": selected})
        return True
    def add_integration():
        return "integration" not in tags or add("integrator_terra", "integration")
    if failed:
        if not add("implementer_terra", "targeted_repair"):
            return {"status": "BLOCKED_REPAIR", "context": tier, "reason": "repair implementer unavailable", "preserve_pass": sorted(passed)}
        return {"status": "REPAIR", "complexity": complexity, "risk": risk, "context": tier, "experts": experts, "rerun_checks": sorted(set(failed) | stale), "preserve_pass": sorted(passed), "fallback_used": fallback_used}

    tags = set(request.get("specializations", []))
    for tag, role in (("browser", "browser_debugger_terra"), ("external_docs", "docs_researcher_terra"), ("unknown_tests", "affected_tests_luna")):
        if tag in tags and not add(role, "discovery"):
            return {"status": "BLOCKED_SPECIALIST", "context": tier, "reason": f"required specialist unavailable: {role}"}

    if complexity == "C0" and risk in {"R0", "R1"}:
        if not add("root", "implementation", "gpt-5.6-luna", "low"):
            return {"status": "BLOCKED_EXECUTION", "context": tier, "reason": "root execution model unavailable"}
        if not add_integration():
            return {"status": "BLOCKED_INTEGRATION", "context": tier, "experts": experts, "reason": "required integrator unavailable"}
        validation = "deterministic"
    elif complexity == "C1" and risk in {"R0", "R1"}:
        if not add("implementer_terra", "implementation"):
            return {"status": "BLOCKED_EXECUTION", "context": tier, "reason": "implementer unavailable"}
        if not add_integration():
            return {"status": "BLOCKED_INTEGRATION", "context": tier, "experts": experts, "reason": "required integrator unavailable"}
        validation = "tier_b"
        if not add("validator_spec_luna", "validation"):
            return {"status": "BLOCKED_VALIDATION", "context": tier, "experts": experts, "reason": "independent validator unavailable"}
    elif complexity == "C3" or risk == "R3":
        hard_architecture = bool(request.get("architecture_ambiguous")) or uncertainty >= 2
        if hard_architecture and not add("architect_sol", "architecture", "gpt-6-astra", "high"):
            return {"status": "BLOCKED_ARCHITECTURE", "context": tier, "reason": "architecture expert/model unavailable"}
        if not add("complex_implementer_sol", "implementation"):
            return {"status": "BLOCKED_EXECUTION", "context": tier, "experts": experts, "reason": "high-risk implementer unavailable"}
        if not add_integration():
            return {"status": "BLOCKED_INTEGRATION", "context": tier, "experts": experts, "reason": "required integrator unavailable"}
        validation = "tier_c"
        validator = "security_reviewer_sol" if risk_domains & VETO_DOMAINS else "reviewer_sol"
        if not add(validator, "validation"):
            return {"status": "BLOCKED_VALIDATION", "complexity": complexity, "risk": risk, "context": tier, "experts": experts, "reason": "independent veto-domain validator unavailable", "fallback_used": fallback_used}
    else:
        if request.get("dependency_graph") and not add("planner_terra", "planning"):
            return {"status": "BLOCKED_PLANNING", "context": tier, "reason": "required planner unavailable"}
        if not add("implementer_terra", "implementation"):
            return {"status": "BLOCKED_EXECUTION", "context": tier, "reason": "implementer unavailable"}
        if not add_integration():
            return {"status": "BLOCKED_INTEGRATION", "context": tier, "experts": experts, "reason": "required integrator unavailable"}
        validation = "tier_c" if risk_domains & VETO_DOMAINS else "tier_b"
        validator = "security_reviewer_sol" if risk_domains & VETO_DOMAINS else "validator_tests_terra"
        if not add(validator, "validation"):
            return {"status": "BLOCKED_VALIDATION", "complexity": complexity, "risk": risk, "context": tier, "experts": experts, "reason": "independent veto-domain validator unavailable", "fallback_used": fallback_used}
    return {"status": "READY", "complexity": complexity, "risk": risk, "context": tier, "validation": validation, "experts": experts, "rerun_checks": sorted(stale), "preserve_pass": sorted(passed), "fallback_used": fallback_used}

def main():
    parser = argparse.ArgumentParser(); parser.add_argument("--request")
    args = parser.parse_args()
    try:
        request = json.loads(args.request if args.request is not None else sys.stdin.read())
        print(json.dumps(route(request), indent=2, sort_keys=True)); return 0
    except (KeyError, ValueError, json.JSONDecodeError) as exc:
        print(json.dumps({"status": "INVALID_REQUEST", "reason": str(exc)}), file=sys.stderr); return 2
if __name__ == "__main__": raise SystemExit(main())
