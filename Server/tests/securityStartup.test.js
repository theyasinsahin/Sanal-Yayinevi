import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
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
        RENDER_GIT_COMMIT: 'a'.repeat(40),
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
    expect(response.headers.get('x-app-revision')).toBe('a'.repeat(40));
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

const testEnv = overrides => ({
  PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP,
  NODE_ENV: 'test', JWT_SECRET: 'isolated-startup-synthetic-signing-secret',
  CLIENT_URL: 'http://localhost:3000', PRINT_SYSTEM_ENABLED: 'false', PRINT_PAYMENTS_MODE: 'DISABLED',
  ...overrides,
});

test('missing startup settings fail promptly and test processes never load local secrets', async () => {
  const error = await promisify(execFile)(process.execPath, ['index.js'], {
    env: testEnv(), windowsHide: true, timeout: 15000,
  }).catch(error => error);
  expect(error.code).toBe(1);
  expect(error.killed).toBe(false);
  expect(error.stderr).toMatch(/STARTUP_CONFIG_INVALID/);
  expect(error.stderr).toMatch(/MONGO_URI/);
  expect(error.stderr).not.toMatch(/MongoDB bağlantısı başarılı/);
}, 20000);

test('occupied ports and standalone print databases report their cause and release startup handles', async () => {
  const mongo = await MongoMemoryServer.create();
  await connect();
  const reservation = createServer();
  try {
    // Match the regular entry point's wildcard bind (Windows permits a separate
    // IPv6 wildcard listener beside an IPv4 loopback-only reservation).
    reservation.listen(0); await once(reservation, 'listening');
    const env = testEnv({ MONGO_URI: mongo.getUri(), PORT: String(reservation.address().port) });
    for (const [overrides, expected] of [
      [{ MONGO_URI: getTestDatabaseUri('occupied_port') }, 'PORT_IN_USE'],
      [{ PRINT_SYSTEM_ENABLED: 'true' }, 'MONGO_REPLICA_SET_REQUIRED'],
      [{ PRINT_SYSTEM_ENABLED: 'false' }, 'MONGO_REPLICA_SET_REQUIRED'],
    ]) {
      const error = await promisify(execFile)(process.execPath, ['index.js'], {
        env: { ...env, ...overrides }, windowsHide: true, timeout: 20000,
      }).catch(error => error);
      expect(error.code).toBe(1);
      expect(error.killed).toBe(false);
      expect(error.stderr).toContain(expected);
      expect(error.stderr).not.toContain(mongo.getUri());
      expect(error.stderr).not.toContain(env.JWT_SECRET);
    }
    const doctor = await promisify(execFile)(process.execPath, ['src/scripts/doctor.js'], {
      env: { ...env, MONGO_URI: mongo.getUri('doctor_only') }, windowsHide: true, timeout: 15000,
    }).catch(error => error);
    expect(doctor.code).toBe(1);
    expect(doctor.killed).toBe(false);
    expect(doctor.stderr).toContain('PORT_IN_USE');
    expect(doctor.stdout).toContain('[OK] MongoDB bağlantısı');
    const client = new mongoose.mongo.MongoClient(mongo.getUri('doctor_only'));
    try {
      await client.connect();
      expect(await client.db().listCollections().toArray()).toEqual([]);
    } finally { await client.close(); }
  } finally {
    await new Promise(resolve => reservation.close(resolve));
    await mongo.stop();
    await closeDatabase();
  }
}, 60000);
