// Run: node test-api.js
// Starts server.js on a spare port with a throwaway database and checks accounts, runs and the leaderboard.
const assert = require('assert');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PORT = 5199;
const DB = path.join(os.tmpdir(), `penguintype-test-${process.pid}.db`);
const B = `http://localhost:${PORT}`;

async function call(method, url, body, cookie) {
  const r = await fetch(B + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookie = r.headers.get('set-cookie');
  return { status: r.status, data: await r.json(), cookie: setCookie && setCookie.split(';')[0], rawCookie: setCookie };
}

const run60 = (wpm, acc = 98) => ({ lang: 'go', mode: 'time', snippet: 'time60-all', wpm, raw: wpm + 5, acc, seconds: 60 });

async function main() {
  // signup validation
  assert.strictEqual((await call('POST', '/api/signup', { username: 'a', password: 'longenough' })).status, 400);
  assert.strictEqual((await call('POST', '/api/signup', { username: 'alice', password: 'short' })).status, 400);
  assert.strictEqual((await call('POST', '/api/signup', { username: 'al<ice>', password: 'longenough' })).status, 400);

  const alice = await call('POST', '/api/signup', { username: 'Alice', password: 'correct horse' });
  assert.strictEqual(alice.status, 201);
  assert.match(alice.rawCookie, /HttpOnly/);
  assert.match(alice.rawCookie, /SameSite=Lax/);
  assert.strictEqual((await call('POST', '/api/signup', { username: 'alice', password: 'whatever123' })).status, 409, 'usernames are case-insensitive');

  // login
  assert.strictEqual((await call('POST', '/api/login', { username: 'alice', password: 'wrong password' })).status, 401);
  assert.strictEqual((await call('POST', '/api/login', { username: 'nobody', password: 'wrong password' })).status, 401);
  const login = await call('POST', '/api/login', { username: 'ALICE', password: 'correct horse' });
  assert.strictEqual(login.status, 200);
  assert.strictEqual((await call('GET', '/api/me', undefined, login.cookie)).data.user.username, 'Alice');
  assert.strictEqual((await call('GET', '/api/me')).data.user, null);

  // runs
  assert.strictEqual((await call('POST', '/api/runs', run60(80))).status, 401, 'runs need a session');
  assert.strictEqual((await call('POST', '/api/runs', { ...run60(80), seconds: 20 }, login.cookie)).status, 400, '60s runs must last 60s');
  assert.strictEqual((await call('POST', '/api/runs', run60(400), login.cookie)).status, 400);
  const saved = await call('POST', '/api/runs', run60(80), login.cookie);
  assert.deepStrictEqual(saved.data, { rank: 1, best: 80 });
  await call('POST', '/api/runs', { lang: 'go', mode: 'snippet', snippet: 'bfs', wpm: 70, raw: 72, acc: 95, seconds: 30 }, login.cookie);
  assert.deepStrictEqual((await call('POST', '/api/runs', run60(90, 60), login.cookie)).data, {}, 'low accuracy is saved but not ranked');

  const bob = await call('POST', '/api/signup', { username: 'bob', password: 'bobs password' });
  assert.strictEqual((await call('POST', '/api/runs', run60(100), bob.cookie)).data.rank, 1);
  const board = (await call('GET', '/api/leaderboard?lang=go')).data;
  assert.deepStrictEqual(board.map((r) => [r.name, r.wpm]), [['bob', 100], ['Alice', 80]]);

  // profile
  const prof = (await call('GET', '/api/profile', undefined, login.cookie)).data;
  assert.strictEqual(prof.totals.tests, 3);
  assert.strictEqual(prof.recent.length, 3);
  assert.strictEqual(prof.perLang[0].best60, 90, 'profile best60 includes low-accuracy runs');
  assert.strictEqual((await call('GET', '/api/profile')).status, 401);

  // logout kills the session
  await call('POST', '/api/logout', {}, login.cookie);
  assert.strictEqual((await call('GET', '/api/me', undefined, login.cookie)).data.user, null);

  // plain form posts (CSRF) and private files are refused
  const form = await fetch(`${B}/api/runs`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'x=1' });
  assert.strictEqual(form.status, 415);
  for (const f of ['server.js', 'scores.db', 'test-api.js']) assert.strictEqual((await fetch(`${B}/${f}`)).status, 404, f);
}

const server = spawn(process.execPath, ['server.js', String(PORT)], { cwd: __dirname, env: { ...process.env, DB_PATH: DB } });
server.stderr.on('data', (d) => { if (!/ExperimentalWarning|trace-warnings/.test(d)) process.stderr.write(d); });
server.stdout.once('data', () => {
  main()
    .then(() => console.log('ok'))
    .catch((e) => { console.error(e); process.exitCode = 1; })
    .finally(() => {
      server.kill();
      server.once('exit', () => { for (const f of [DB, `${DB}-wal`, `${DB}-shm`]) fs.rmSync(f, { force: true }); });
    });
});
