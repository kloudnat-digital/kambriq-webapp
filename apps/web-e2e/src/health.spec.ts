import { test, expect } from '@playwright/test';

test.describe('Health', () => {
  test('web /health returns 200 with status ok', async ({ request }) => {
    const response = await request.get('/health');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ok');
  });
});
