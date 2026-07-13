import { test } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';

function safeFileName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'step';
}

export async function captureEvidence(page: Page, testInfo: TestInfo, label: string): Promise<void> {
  const ordinal = testInfo.attachments.filter((item) => item.name.startsWith('Screenshot ·')).length + 1;
  const fileName = `${String(ordinal).padStart(2, '0')}-${safeFileName(label)}.png`;
  const filePath = testInfo.outputPath(fileName);
  await page.screenshot({ path: filePath, fullPage: true, animations: 'disabled' });
  await testInfo.attach(`Screenshot · ${label}`, { path: filePath, contentType: 'image/png' });
}

export async function uiStep<T>(
  page: Page,
  testInfo: TestInfo,
  label: string,
  action: () => Promise<T>,
): Promise<T> {
  return test.step(label, async () => {
    const result = await action();
    await captureEvidence(page, testInfo, label);
    return result;
  });
}
