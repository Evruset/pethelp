#!/usr/bin/env python3
import importlib.util, json, math, unittest
from pathlib import Path
PATH=Path(__file__).with_name("orchestrator-telemetry.py")
SPEC=importlib.util.spec_from_file_location("orchestrator_telemetry",PATH)
T=importlib.util.module_from_spec(SPEC); SPEC.loader.exec_module(T)

EVENTS=[
 {"type":"thread.started","thread_id":"run-1"},
 {"type":"item.started","item":{"id":"tool-1","type":"command_execution","command":"secret"}},
 {"type":"item.completed","item":{"id":"tool-1","type":"command_execution","aggregated_output":"private"}},
 {"type":"turn.completed","usage":{"input_tokens":10,"cached_input_tokens":3,"cache_write_input_tokens":0,"output_tokens":2,"reasoning_output_tokens":1}},
]
def envelope(events=EVENTS,**extra):
 return T.build_envelope(events=events,route_id="route-1",scenario_id="fixture-1",planned_model="gpt-5.6-luna",route_input={"complexity":"C0","risk":"R0"},route_result={"experts":[{"role":"root"}]},acceptance_evidence=[{"id":"routing","verdict":"PASS"}],**extra)

class TelemetryTest(unittest.TestCase):
 def test_supported_usage_run_id_and_tool_dedup(self):
  e=envelope(route_elapsed_ms=1.25,execution_elapsed_ms=9.5,outcome="PASS")
  self.assertEqual("run-1",e["run_id"]["value"]); self.assertEqual(1,e["metrics"]["tool_calls"]["value"])
  self.assertEqual(10,e["metrics"]["tokens.input"]["value"]); self.assertEqual("ms",e["metrics"]["execution_wall_time"]["unit"])
 def test_missing_data_is_not_observed_not_zero(self):
  e=envelope(events=[])
  for key in ["tokens.input","tokens.output","agent_invocations","repair_cycles","execution_wall_time"]:
   self.assertIsNone(e["metrics"][key]["value"]); self.assertEqual("NOT_OBSERVED",e["metrics"][key]["availability"])
  self.assertIsNone(e["run_id"]["value"]); self.assertIsNone(e["route"]["observed_model"]["value"])
  self.assertIsNone(e["metrics"]["tool_calls"]["value"]); self.assertEqual("NOT_OBSERVED",e["metrics"]["tool_calls"]["availability"])
 def test_privacy_excludes_payloads(self):
  raw=json.dumps(envelope())
  self.assertNotIn("secret",raw); self.assertNotIn("private",raw)
  self.assertTrue(all(e is False for e in envelope()["privacy"].values()))
 def test_clock_boundaries_fail_closed(self):
  with self.assertRaisesRegex(ValueError,"negative route"):
   envelope(route_elapsed_ms=-1)
  with self.assertRaisesRegex(ValueError,"negative execution"):
   envelope(execution_elapsed_ms=-1)
  with self.assertRaisesRegex(ValueError,"exceeds full execution"):
   envelope(route_elapsed_ms=10,execution_elapsed_ms=1)
  for value in (math.nan,math.inf,-math.inf):
   with self.assertRaisesRegex(ValueError,"non-finite"):
    envelope(route_elapsed_ms=value)
   with self.assertRaisesRegex(ValueError,"non-finite"):
    envelope(execution_elapsed_ms=value)
 def test_fingerprints_are_stable_and_sensitive(self):
  a=envelope(); b=envelope(); self.assertEqual(a["policy"],b["policy"]); self.assertEqual(a["route"]["fingerprint"],b["route"]["fingerprint"])
  changed=T.build_envelope(events=EVENTS,route_id="route-1",scenario_id="fixture-1",planned_model="gpt-5.6-luna",route_input={"complexity":"C1","risk":"R0"},route_result={"experts":[{"role":"root"}]})
  self.assertNotEqual(a["route"]["fingerprint"],changed["route"]["fingerprint"])
 def test_multiple_runs_cannot_be_double_counted(self):
  with self.assertRaisesRegex(ValueError,"multiple thread IDs"):
   envelope(events=[{"type":"thread.started","thread_id":"a"},{"type":"thread.started","thread_id":"b"}])
  with self.assertRaisesRegex(ValueError,"duplicate telemetry"):
   T.deduplicate_envelopes([envelope(),envelope()])
 def test_top_level_sensitive_event_fails_closed(self):
  with self.assertRaisesRegex(ValueError,"sensitive"):
   T.parse_events([json.dumps({"type":"x","prompt":"do not store"})])
 def test_negative_token_metric_fails_closed(self):
  with self.assertRaisesRegex(ValueError,"negative token"):
   envelope(events=[{"type":"turn.completed","usage":{"input_tokens":-1}}])
 def test_boolean_token_metric_is_not_observed(self):
  e=envelope(events=[{"type":"turn.completed","usage":{"input_tokens":True}}])
  self.assertIsNone(e["metrics"]["tokens.input"]["value"])
  self.assertEqual("NOT_OBSERVED",e["metrics"]["tokens.input"]["availability"])
 def test_malformed_tool_ids_fail_closed(self):
  for item_id in (None,"",True,7):
   e=envelope(events=[{"type":"item.completed","item":{"type":"command_execution","id":item_id}},{"type":"turn.completed","usage":{}}])
   self.assertIsNone(e["metrics"]["tool_calls"]["value"])
   self.assertEqual("NOT_OBSERVED",e["metrics"]["tool_calls"]["availability"])

if __name__=="__main__": unittest.main(verbosity=2)
