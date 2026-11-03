import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { connect, closeDatabase, getTestDatabaseUri } from './db.js';

test('the actual server entry point starts with isolated credentials and serves the hardened HTTP stack', async () => {
  await connect();
  let child;
  try {
    const reservation = createServer(); reservation.listen(0, '127.0.0.1'); await once(reservation, 'listening');
    const port = reservation.address().port; await new Promise(resolve => reservation.close(resolve));
    child = spawn(process.execPath, ['index.js'], {
      cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
      env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP,
        NODE_ENV: 'development', BETIK_ISOLATED_PRINT_SANDBOX: 'true',
        MONGO_URI: getTestDatabaseUri(`betik_print_sandbox_${randomBytes(12).toString('hex')}`),
        PORT: String(port), JWT_SECRET: 'isolated-startup-synthetic-signing-secret', CLIENT_URL: 'http://localhost:3000',
        PRINT_SYSTEM_ENABLED: 'false', PRINT_PAYMENTS_MODE: 'DISABLED',
      },
    });
    // Consume output without copying any logs or configuration to test output.
    child.stdout.resume(); child.stderr.resume();
    let response;
    for (let attempt = 0; attempt < 150; attempt++) {
      if (child.exitCode != null) throw new Error('Isolated server exited before readiness.');
      try { response = await fetch(`http://127.0.0.1:${port}`, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' }, body: JSON.stringify({ query: '{ healthCheck }' }) }); if (response.ok) break; } catch { /* startup in progress */ }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    expect(response?.status).toBe(200);
    expect((await response.json()).data.healthCheck).toContain('running');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
    expect(response.headers.get('content-security-policy')).toContain("default-src 'none'");
    expect(response.headers.get('x-powered-by')).toBeNull();
    const rejected = await fetch(`http://127.0.0.1:${port}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify([{ query: '{ healthCheck }' }]) });
    expect(rejected.status).toBeGreaterThanOrEqual(400);
    const foreign = await fetch(`http://127.0.0.1:${port}`, { method: 'OPTIONS', headers: { origin: 'https://attacker.example.test', 'access-control-request-method': 'POST' } });
    expect(foreign.headers.get('access-control-allow-origin')).toBeNull();
  } finally {
    if (child && child.exitCode == null) { const stopped = once(child, 'exit'); child.kill(); await stopped; }
    await closeDatabase();
  }
}, 60000);
