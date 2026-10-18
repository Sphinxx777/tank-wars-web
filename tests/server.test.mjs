import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createStaticServer } from '../tools/serve.mjs';

test('development server serves ES modules and bilingual pages without exposing repository files', async (context) => {
  const server = createStaticServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  context.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const root = `http://127.0.0.1:${server.address().port}`;
  for (const page of ['/', '/guide.html', '/accuracy.html']) {
    const response = await fetch(root + page);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /data-language="en"/);
  }
  const module = await fetch(root + '/app.js', { method: 'HEAD' });
  assert.match(module.headers.get('content-type'), /text\/javascript/);
  assert.equal(await module.text(), '');
  for (const path of ['/.git/config', '/%2e%2e%2fpackage.json', '/not-found']) {
    assert.equal((await fetch(root + path)).status, 404);
  }
  assert.equal((await fetch(root + '/', { method: 'POST' })).status, 405);
});
