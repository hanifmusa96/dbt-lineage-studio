import { expect, test } from '@playwright/test';
import type { Locator } from '@playwright/test';

async function expectReadableText(locator: Locator) {
  const contrast = await locator.evaluate((element) => {
    const color = (value: string) => {
      const channels = value.match(/[\d.]+/g)?.map(Number);
      if (!channels || channels.length < 3) throw new Error(`Unsupported color: ${value}`);
      return channels;
    };
    const foreground = color(getComputedStyle(element).color);
    let background: number[] | undefined;
    for (let current: Element | null = element; current; current = current.parentElement) {
      const candidate = color(getComputedStyle(current).backgroundColor);
      if ((candidate[3] ?? 1) === 1) { background = candidate; break; }
      if (candidate[3] !== 0) throw new Error('Cannot measure a translucent background');
    }
    if (!background) throw new Error('No opaque background found');
    const luminance = (channels: number[]) => channels.slice(0, 3).reduce((sum, channel, index) => {
      const value = channel / 255;
      return sum + [0.2126, 0.7152, 0.0722][index] * (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    }, 0);
    const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    return (values[0] + 0.05) / (values[1] + 0.05);
  });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
}

test('imports a manifest, renders lineage, and exports it', async ({ page }) => {
  await page.route('**/api/artifacts/*', (route) => route.fulfill({ status: 404 }));
  await page.goto('/');

  const manifest = {
    metadata: { project_name: 'example' },
    nodes: {
      'model.example.orders': {
        resource_type: 'model', name: 'orders', package_name: 'example',
        depends_on: { nodes: ['model.example.staging'] },
      },
      'model.example.staging': {
        resource_type: 'model', name: 'staging', package_name: 'example',
      },
    },
  };
  await page.getByLabel('Manifest Required').setInputFiles({
    name: 'manifest.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(manifest)),
  });
  await page.getByRole('button', { name: 'Explore lineage' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.locator('.graph-node')).toHaveCount(2);
  await page.locator('.graph-node').filter({ hasText: 'orders' }).click();
  await expect(page.getByRole('heading', { name: 'orders' })).toBeVisible();
  await page.getByTitle('Hide explorer').click();
  await expect(page.getByRole('heading', { name: 'Explore', exact: true })).toBeHidden();
  await page.getByTitle('Browse resources').click();
  await expect(page.getByRole('heading', { name: 'Explore', exact: true })).toBeVisible();

  for (const theme of ['light', 'dark']) {
    if (theme === 'dark') await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    for (const selector of ['.list-heading', '.resource-item.active .resource-name small', '.graph-title small', '.canvas-overlay', '.canvas-hint', '.graph-legend', '.details-description', '.details-note', '.details-tabs button[aria-selected="false"]']) {
      await expectReadableText(page.locator(selector));
    }
    await page.getByRole('button', { name: 'Import artifacts', exact: true }).click();
    for (const selector of ['.modal > p', '.import-divider', '.file-label span', '.modal > small']) {
      await expectReadableText(page.locator(selector).first());
    }
    await page.getByRole('button', { name: 'Close import dialog' }).click();
  }
  await page.getByLabel('Export format').selectOption('json');
  const exportButton = page.getByRole('button', { name: 'Export', exact: true });
  await expect(exportButton).toBeEnabled();
  const download = page.waitForEvent('download');
  await exportButton.click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('lineage.json');
  const stream = await file.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const snapshot = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  expect(snapshot.nodes.map((node: { name: string }) => node.name).sort()).toEqual(['orders', 'staging']);
  expect(snapshot.edges).toEqual([{ source: 'model.example.staging', target: 'model.example.orders' }]);
});
