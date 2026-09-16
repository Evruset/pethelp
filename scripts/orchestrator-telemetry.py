#!/usr/bin/env python3
"""Build privacy-safe telemetry envelopes from supported Codex JSONL events."""
from __future__ import annotations
import argparse, hashlib, json, math, time, uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
POLICY_FILES = [
    ROOT / ".agents/skills/adaptive-orchestrator/SKILL.md",
    ROOT / ".agents/skills/adaptive-orchestrator/references/routing.md",
    ROOT / ".agents/skills/adaptive-orchestrator/references/validation.md",
    ROOT / ".codex/policies/context-budgets.toml",
    ROOT / ".codex/policies/model-catalog.toml",
]
USAGE_FIELDS = {
    "input_tokens":"tokens.input",
    "cached_input_tokens":"tokens.cached_input",
    "cache_write_input_tokens":"tokens.cache_write_input",
    "output_tokens":"tokens.output",
    "reasoning_output_tokens":"tokens.reasoning_output",
}
SENSITIVE_KEYS = {"prompt","text","command","aggregated_output","response","credentials","authorization"}

def stable_fingerprint(value):
    payload=json.dumps(value,sort_keys=True,separators=(",",":"),ensure_ascii=True).encode()
    return "sha256:"+hashlib.sha256(payload).hexdigest()

def policy_fingerprint():
    digest=hashlib.sha256()
    for path in POLICY_FILES:
        digest.update(str(path.relative_to(ROOT)).encode()+b"\0")
        digest.update(path.read_bytes()+b"\0")
    return "sha256:"+digest.hexdigest()

def deduplicate_envelopes(envelopes):
    seen=set(); result=[]
    for envelope in envelopes:
        run_id=envelope["run_id"]["value"]
        key=(run_id,envelope["route_id"])
        if run_id is None: key=("NOT_OBSERVED",envelope["route_id"])
        if key in seen: raise ValueError(f"duplicate telemetry envelope: {key}")
        seen.add(key); result.append(envelope)
    return result

def metric(value, unit, source, availability, method):
    return {"value":value,"unit":unit,"source":source,"availability":availability,"measurement_method":method}

def unavailable(unit, source, availability="NOT_OBSERVED"):
    return metric(None,unit,source,availability,"no supported observation in supplied runtime events")

def parse_events(lines):
    events=[]
    for number,line in enumerate(lines,1):
        if not line.strip(): continue
        event=json.loads(line)
        if any(key in event for key in SENSITIVE_KEYS):
            raise ValueError(f"top-level sensitive field at line {number}")
        events.append(event)
    return events

def build_envelope(*,events,route_id,scenario_id,planned_model,route_input,route_result,
                   route_elapsed_ms=None,execution_elapsed_ms=None,outcome="UNKNOWN",veto=None,
                   acceptance_evidence=None,policy_version="ORCH-MOE-03"):
    if route_elapsed_ms is not None and not math.isfinite(route_elapsed_ms): raise ValueError("non-finite route elapsed time")
    if execution_elapsed_ms is not None and not math.isfinite(execution_elapsed_ms): raise ValueError("non-finite execution elapsed time")
    if route_elapsed_ms is not None and route_elapsed_ms < 0: raise ValueError("negative route elapsed time")
    if execution_elapsed_ms is not None and execution_elapsed_ms < 0: raise ValueError("negative execution elapsed time")
    if route_elapsed_ms is not None and execution_elapsed_ms is not None and route_elapsed_ms > execution_elapsed_ms:
        raise ValueError("routing decision time exceeds full execution time")
    thread_ids={e.get("thread_id") for e in events if e.get("type")=="thread.started" and e.get("thread_id")}
    if len(thread_ids)>1: raise ValueError("multiple thread IDs in one envelope")
    run_id=next(iter(thread_ids),None)
    completed=[e for e in events if e.get("type")=="turn.completed" and isinstance(e.get("usage"),dict)]
    usage=completed[-1]["usage"] if completed else {}
    metrics={}
    for source_field,name in USAGE_FIELDS.items():
        value=usage.get(source_field)
        if type(value) is int and value < 0: raise ValueError(f"negative token metric: {source_field}")
        metrics[name]=metric(value,"tokens","codex.exec.jsonl", "VERIFIED_SUPPORTED", f"turn.completed.usage.{source_field}") if type(value) is int else unavailable("tokens","codex.exec.jsonl")
    tool_items={}; malformed_tool_item=False
    for e in events:
        item=e.get("item")
        if not isinstance(item,dict) or item.get("type") not in {"command_execution","mcp_tool_call","tool_call"}: continue
        item_id=item.get("id")
        if not isinstance(item_id,str) or not item_id:
            malformed_tool_item=True
        else:
            tool_items[item_id]=item.get("type")
    completed_turn=any(e.get("type")=="turn.completed" for e in events)
    metrics["tool_calls"]=metric(len(tool_items),"calls","codex.exec.jsonl","VERIFIED_SUPPORTED","unique non-empty string item.id within a completed turn") if completed_turn and not malformed_tool_item else unavailable("calls","codex.exec.jsonl")
    metrics["routing_decision_time"]=metric(route_elapsed_ms,"ms","orchestrator.monotonic_clock","VERIFIED_SUPPORTED" if route_elapsed_ms is not None else "NOT_OBSERVED","monotonic boundary around route()") if route_elapsed_ms is not None else unavailable("ms","orchestrator.monotonic_clock")
    metrics["execution_wall_time"]=metric(execution_elapsed_ms,"ms","wrapper.monotonic_clock","VERIFIED_SUPPORTED" if execution_elapsed_ms is not None else "NOT_OBSERVED","monotonic boundary around codex exec process") if execution_elapsed_ms is not None else unavailable("ms","wrapper.monotonic_clock")
    metrics["agent_invocations"]=unavailable("invocations","codex.exec.jsonl")
    metrics["repair_cycles"]=unavailable("cycles","orchestrator.runtime")
    envelope={
        "schema_version":1,
        "run_id":{"value":run_id,"source":"codex.exec.jsonl:thread.started.thread_id","availability":"VERIFIED_SUPPORTED" if run_id else "NOT_OBSERVED"},
        "route_id":route_id,
        "scenario_id":scenario_id,
        "policy":{"version":policy_version,"fingerprint":policy_fingerprint()},
        "route":{"fingerprint":stable_fingerprint({"input":route_input,"result":route_result}),"planned_model":planned_model,"observed_model":{"value":None,"source":"codex.exec.jsonl","availability":"NOT_OBSERVED"}},
        "metrics":metrics,
        "execution":{"planned_invocations":len(route_result.get("experts",[])),"observed_invocations":None,"outcome":outcome,"veto":veto,"repair_count":{"value":None,"availability":"NOT_OBSERVED"}},
        "acceptance_evidence":[{"id":x["id"],"fingerprint":stable_fingerprint(x)} for x in (acceptance_evidence or [])],
        "privacy":{"raw_events_stored":False,"prompts_stored":False,"responses_stored":False,"commands_stored":False,"credentials_stored":False},
    }
    serialized=json.dumps(envelope,sort_keys=True)
    for forbidden in SENSITIVE_KEYS:
        if f'"{forbidden}"' in serialized: raise ValueError(f"sensitive key in envelope: {forbidden}")
    return envelope

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--events",type=Path,required=True)
    parser.add_argument("--route-id")
    parser.add_argument("--scenario-id",required=True)
    parser.add_argument("--planned-model",required=True)
    parser.add_argument("--route-input",type=Path,required=True)
    parser.add_argument("--route-result",type=Path,required=True)
    parser.add_argument("--route-elapsed-ms",type=float)
    parser.add_argument("--execution-elapsed-ms",type=float)
    parser.add_argument("--outcome",default="UNKNOWN")
    args=parser.parse_args()
    envelope=build_envelope(events=parse_events(args.events.read_text().splitlines()),route_id=args.route_id or str(uuid.uuid4()),scenario_id=args.scenario_id,planned_model=args.planned_model,route_input=json.loads(args.route_input.read_text()),route_result=json.loads(args.route_result.read_text()),route_elapsed_ms=args.route_elapsed_ms,execution_elapsed_ms=args.execution_elapsed_ms,outcome=args.outcome)
    print(json.dumps(envelope,indent=2,sort_keys=True))
if __name__=="__main__": main()
