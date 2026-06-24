import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { readSandboxEvidence, redactEvidence, ScenarioEvidence } from '../src/certification/sandbox-cert.evidence';

const outputPath = path.resolve(process.cwd(), 'artifacts/SANDBOX_CERTIFICATION_REPORT.md');
const jestPath = path.resolve(process.cwd(), 'artifacts/sandbox-certification/jest-results.json');

interface JestResult {
  success?: boolean;
  numFailedTests?: number;
  testResults?: Array<{ assertionResults?: Array<{ fullName?: string; status?: string; failureMessages?: string[] }> }>;
}

async function main(): Promise<void> {
  const evidence = await readSandboxEvidence();
  const jest = await readJestResult();
  const normalized = mergeJestOutcome(evidence, jest);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, render(normalized, jest), 'utf8');
  console.log(`Sandbox certification report written to ${outputPath}`);
  if (normalized.length === 0 || normalized.some((item) => item.result !== 'PASS')) process.exitCode = 1;
}

async function readJestResult(): Promise<JestResult | undefined> {
  try {
    return JSON.parse(await readFile(jestPath, 'utf8')) as JestResult;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

function mergeJestOutcome(records: ScenarioEvidence[], jest: JestResult | undefined): ScenarioEvidence[] {
  const allAssertions = jest?.testResults?.flatMap((suite) => suite.assertionResults ?? []) ?? [];
  return records.map((record) => {
    const assertion = allAssertions.find((candidate) => candidate.fullName?.includes(record.scenario));
    if (assertion?.status === 'failed') {
      return { ...record, result: 'FAIL' as const, observations: [...record.observations, ...assertion.failureMessages?.map((message) => redactFailure(message)) ?? []] };
    }
    return record;
  });
}

function redactFailure(message: string): string {
  return JSON.stringify(redactEvidence(message));
}

function render(records: ScenarioEvidence[], jest: JestResult | undefined): string {
  const rows = records.map((record) => `| ${escape(record.scenario)} | ${record.result} | \`${record.correlationId}\` | ${escape(record.observations.join(' ')) || '-'} |`).join('\n');
  const details = records.map((record) => [
    `## ${record.scenario}`,
    '',
    `Correlation ID: \`${record.correlationId}\``,
    '',
    '```json',
    JSON.stringify(redactEvidence(record.exchanges), null, 2),
    '```',
  ].join('\n')).join('\n\n');
  const jestStatus = jest ? (jest.success ? 'PASS' : `FAIL (${jest.numFailedTests ?? 0} failed tests)`) : 'NOT_FOUND';
  return [
    '# VetHelp External Sandbox Certification Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Jest execution: **${jestStatus}**`,
    '',
    '| Scenario | Status | Correlation ID | Evidence summary |',
    '|---|---|---|---|',
    rows || '| No certification scenarios wrote evidence | FAIL | - | Evidence file missing |',
    '',
    details || 'No evidence records were generated.',
    '',
  ].join('\n');
}

function escape(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, '<br>');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
