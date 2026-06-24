import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { readSandboxEvidence, redactEvidence, ScenarioEvidence } from '../src/certification/sandbox-cert.evidence';
import { redactSensitiveData } from '../src/certification/redact-util';

const outputPath = path.resolve(process.cwd(), 'artifacts/SANDBOX_CERTIFICATION_REPORT.md');
const jestPath = path.resolve(process.cwd(), 'artifacts/sandbox-certification/jest-results.json');

interface JestResult { success?: boolean; numFailedTests?: number; testResults?: Array<{ assertionResults?: Array<{ fullName?: string; status?: string; failureMessages?: string[] }> }>; }

async function main(): Promise<void> {
  const records = mergeJestOutcome(await readSandboxEvidence(), await readJestResult());
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, render(records), 'utf8');
  if (!records.length || records.some((record) => record.result !== 'PASS')) process.exitCode = 1;
}

async function readJestResult(): Promise<JestResult | undefined> {
  try { return JSON.parse(await readFile(jestPath, 'utf8')) as JestResult; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error; }
}

function mergeJestOutcome(records: ScenarioEvidence[], result: JestResult | undefined): ScenarioEvidence[] {
  const assertions = result?.testResults?.flatMap((suite) => suite.assertionResults ?? []) ?? [];
  return records.map((record) => {
    const assertion = assertions.find((item) => item.fullName?.includes(record.scenario));
    if (assertion?.status !== 'failed') return record;
    return { ...record, result: 'FAIL' as const, observations: [...record.observations, ...(assertion.failureMessages ?? []).map(redactSensitiveData)] };
  });
}

function render(records: ScenarioEvidence[]): string {
  const table = records.map((record) => `| ${escape(record.scenario)} | ${escape(record.scenario)} | ${record.result} | \`${record.correlationId}\` |`).join('\n');
  const evidence = records.map((record) => `### ${record.scenario}\n\n\`\`\`text\n${redactSensitiveData(JSON.stringify(redactEvidence(record.exchanges), null, 2))}\n\`\`\``).join('\n\n');
  return [
    '# VETHELP - EXTERNAL SANDBOX CERTIFICATION REPORT', '',
    `Generated: ${new Date().toISOString()}`, '',
    '| Scenario ID | Description | Status | Correlation ID |', '|---|---|---|---|',
    table || '| - | No certification evidence | FAIL | - |', '',
    '## Evidence Logs', '', evidence || 'No evidence records were generated.', '',
  ].join('\n');
}

function escape(value: string): string { return value.replace(/\|/g, '\\|').replace(/\n/g, '<br>'); }

main().catch((error) => { console.error(error); process.exitCode = 1; });
