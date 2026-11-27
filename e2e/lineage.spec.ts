import { expect, test } from '@playwright/test';

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
