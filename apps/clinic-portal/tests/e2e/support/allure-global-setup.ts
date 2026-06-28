import { mkdir, writeFile } from 'node:fs/promises';

export default async function globalSetup(): Promise<void> {
  await mkdir('allure-results', { recursive: true });
  await writeFile(
    'allure-results/environment.properties',
    [
      'Application=VetHelp Clinic Portal',
      'Test framework=Playwright',
      'Browser=Chromium',
      `CI=${process.env.CI ?? 'false'}`,
      `Git SHA=${process.env.GITHUB_SHA ?? 'local'}`,
    ].join('\n') + '\n',
    'utf8',
  );
}
