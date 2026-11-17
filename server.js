// penguintype server: serves the site plus accounts, run history and the leaderboard.
// No dependencies (needs Node 22.13+ for node:sqlite). Run: node server.js [port]
// Env: PORT, DB_PATH (default ./scores.db), SECURE_COOKIE=1 when served over https without a proxy header.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const { DatabaseSync } = require('node:sqlite');

const scrypt = promisify(crypto.scrypt);
const PORT = Number(process.env.PORT || process.argv[2] || 5179);
const ROOT = __dirname;
const LANGS = ['python', 'javascript', 'cpp', 'java', 'go', 'rust'];
const MODES = ['time', 'snippet', 'pick', 'zen', 'custom'];
const BOARD_SNIPPET = 'time60-all'; // the one run type that counts for the leaderboard: 60s, all content
const SESSION_DAYS = 30;
// Only these files are public, so the database and server code are never served.
const PUBLIC = {
  'index.html': 'text/html', 'style.css': 'text/css', 'app.js': 'text/javascript', 'account.js': 'text/javascript',
  'engine.js': 'text/javascript', 'snippets.js': 'text/javascript', 'snippets-more.js': 'text/javascript',
  'generators.js': 'text/javascript', 'projects.js': 'text/javascript', 'favicon.svg': 'image/svg+xml',
};

const db = new DatabaseSync(process.env.DB_PATH || path.join(ROOT, 'scores.db'));
db.exec(`
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    salt TEXT NOT NULL,
    hash TEXT NOT NULL,
    created INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS runs (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lang TEXT NOT NULL,
    mode TEXT NOT NULL,
    snippet TEXT NOT NULL,
    wpm REAL NOT NULL,
    raw REAL NOT NULL,
    acc REAL NOT NULL,
    seconds REAL NOT NULL,
    created INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS runs_board ON runs (lang, snippet, wpm);
  CREATE INDEX IF NOT EXISTS runs_user ON runs (user_id, created);
`);

const q = {
  addUser: db.prepare('INSERT INTO users (username, salt, hash, created) VALUES (?, ?, ?, ?)'),
  userByName: db.prepare('SELECT id, username, salt, hash, created FROM users WHERE username = ?'), // NOCASE column
  addSession: db.prepare('INSERT INTO sessions (token_hash, user_id, expires) VALUES (?, ?, ?)'),
  session: db.prepare(`SELECT u.id, u.username, u.created FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires > ?`),
  dropSession: db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
  dropExpired: db.prepare('DELETE FROM sessions WHERE expires <= ?'),
  addRun: db.prepare(`INSERT INTO runs (user_id, lang, mode, snippet, wpm, raw, acc, seconds, created)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`),
  // Best run per user. SQLite fills the bare columns from the row that has MAX(wpm).
  board: db.prepare(`SELECT u.username AS name, MAX(r.wpm) AS wpm, r.raw, r.acc, r.created
    FROM runs r JOIN users u ON u.id = r.user_id
    WHERE r.lang = ? AND r.snippet = '${BOARD_SNIPPET}' AND r.acc >= 75
    GROUP BY r.user_id ORDER BY wpm DESC LIMIT 50`),
  boardBest: db.prepare(`SELECT MAX(wpm) AS wpm FROM runs WHERE user_id = ? AND lang = ? AND snippet = '${BOARD_SNIPPET}' AND acc >= 75`),
  boardAhead: db.prepare(`SELECT COUNT(*) AS n FROM (SELECT MAX(wpm) AS w FROM runs
    WHERE lang = ? AND snippet = '${BOARD_SNIPPET}' AND acc >= 75 GROUP BY user_id) WHERE w > ?`),
  pbs: db.prepare('SELECT snippet, lang, MAX(wpm) AS wpm, acc FROM runs WHERE user_id = ? GROUP BY snippet, lang'),
  perLang: db.prepare(`SELECT lang, COUNT(*) AS tests, AVG(wpm) AS avg, MAX(wpm) AS best,
    MAX(CASE WHEN snippet = '${BOARD_SNIPPET}' THEN wpm END) AS best60
    FROM runs WHERE user_id = ? GROUP BY lang ORDER BY tests DESC`),
  recent: db.prepare('SELECT lang, mode, snippet, wpm, acc, seconds, created FROM runs WHERE user_id = ? ORDER BY created DESC LIMIT 25'),
  totals: db.prepare('SELECT COUNT(*) AS tests, COALESCE(SUM(seconds), 0) AS seconds FROM runs WHERE user_id = ?'),
};

// ponytail: in-memory sliding-window limits, reset on restart; move to the DB or a proxy if abused.
function limiter(max, windowMs) {
  const hits = new Map();
  return (key) => {
    const now = Date.now();
    const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
    recent.push(now);
    hits.set(key, recent);
    return recent.length > max;
  };
}
const tooManyLogins = limiter(10, 15 * 60 * 1000);
const tooManySignups = limiter(10, 60 * 60 * 1000); // per network; a classroom may share one IP
const tooManyRuns = limiter(30, 60 * 1000);

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const publicUser = (u) => ({ username: u.username, created: u.created });

async function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: (await scrypt(password, salt, 64)).toString('hex') };
}
const DUMMY = { salt: '0'.repeat(32), hash: '0'.repeat(128) }; // so unknown usernames take as long as wrong passwords

function checkCreds(b, signup) {
  if (!b || typeof b.username !== 'string' || typeof b.password !== 'string') return 'username and password required';
  if (b.password.length > 200) return 'password must be at most 200 characters';
  if (!signup) return null;
  if (!/^[A-Za-z0-9_.-]{3,20}$/.test(b.username)) return 'username must be 3-20 letters, numbers, _ . or -';
  if (b.password.length < 8) return 'password must be at least 8 characters';
  return null;
}

// Runs come from the browser, so a technical user can fake one. These checks only stop obvious junk.
function checkRun(b) {
  if (!b || typeof b !== 'object') return 'bad request';
  if (!LANGS.includes(b.lang)) return 'unknown language';
  if (!MODES.includes(b.mode)) return 'unknown mode';
  if (typeof b.snippet !== 'string' || !/^[\w-]{1,60}$/.test(b.snippet)) return 'bad snippet';
  for (const k of ['wpm', 'raw', 'acc', 'seconds']) if (typeof b[k] !== 'number' || !Number.isFinite(b[k])) return `bad ${k}`;
  if (b.wpm < 0 || b.wpm > 250) return 'wpm out of range';
  if (b.raw < b.wpm - 0.01 || b.raw > 300) return 'raw out of range';
  if (b.acc < 0 || b.acc > 100) return 'accuracy out of range';
  if (b.seconds < 1 || b.seconds > 3600) return 'time out of range';
  if (b.snippet === BOARD_SNIPPET && (b.mode !== 'time' || Math.abs(b.seconds - 60) > 0.5)) return 'a 60s run must last 60 seconds';
  return null;
}

function cookie(req, token, maxAge) {
  const secure = process.env.SECURE_COOKIE === '1' || req.headers['x-forwarded-proto'] === 'https';
  return `pt_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}

function startSession(req, user) {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  q.dropExpired.run(now);
  q.addSession.run(sha256(token), user.id, now + SESSION_DAYS * 86400000);
  return cookie(req, token, SESSION_DAYS * 86400);
}

function sessionToken(req) {
  const m = /(?:^|;\s*)pt_session=([\w-]+)/.exec(req.headers.cookie || '');
  return m ? m[1] : null;
}

function currentUser(req) {
  const token = sessionToken(req);
  return token ? q.session.get(sha256(token), Date.now()) || null : null;
}

function send(res, status, body, setCookie) {
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  if (setCookie) headers['Set-Cookie'] = setCookie;
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 4000) { reject(new Error('request too large')); req.destroy(); }
    });
    req.on('end', () => { try { resolve(JSON.parse(data)); } catch { reject(new Error('bad json')); } });
  });
}

const routes = {
  'GET /api/me': (req) => {
    const user = currentUser(req);
    return [200, { user: user && publicUser(user) }];
  },

  'GET /api/leaderboard': (req, url) => {
    const lang = url.searchParams.get('lang');
    if (!LANGS.includes(lang)) return [400, { error: 'unknown language' }];
    return [200, q.board.all(lang)];
  },

  'POST /api/signup': async (req, url, body) => {
    const err = checkCreds(body, true);
    if (err) return [400, { error: err }];
    if (tooManySignups(req.socket.remoteAddress)) return [429, { error: 'too many sign ups, try later' }];
    const { salt, hash } = await hashPassword(body.password);
    let id;
    try {
      id = Number(q.addUser.run(body.username, salt, hash, Date.now()).lastInsertRowid);
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) return [409, { error: 'that username is taken' }];
      throw e;
    }
    const user = { id, username: body.username, created: Date.now() };
    return [201, { user: publicUser(user) }, startSession(req, user)];
  },

  'POST /api/login': async (req, url, body) => {
    if (tooManyLogins(req.socket.remoteAddress)) return [429, { error: 'too many attempts, try again in 15 minutes' }];
    const err = checkCreds(body, false);
    if (err) return [400, { error: err }];
    const user = q.userByName.get(body.username);
    const { hash } = await hashPassword(body.password, (user || DUMMY).salt);
    const ok = crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from((user || DUMMY).hash, 'hex'));
    if (!user || !ok) return [401, { error: 'wrong username or password' }];
    return [200, { user: publicUser(user) }, startSession(req, user)];
  },

  'POST /api/logout': (req) => {
    const token = sessionToken(req);
    if (token) q.dropSession.run(sha256(token));
    return [200, { ok: true }, cookie(req, '', 0)];
  },

  'POST /api/runs': (req, url, body) => {
    const user = currentUser(req);
    if (!user) return [401, { error: 'sign in to save runs' }];
    if (tooManyRuns(user.id)) return [429, { error: 'too many runs, slow down' }];
    const err = checkRun(body);
    if (err) return [400, { error: err }];
    q.addRun.run(user.id, body.lang, body.mode, body.snippet, body.wpm, body.raw, body.acc, body.seconds, Date.now());
    if (body.snippet !== BOARD_SNIPPET || body.acc < 75) return [201, {}];
    const best = q.boardBest.get(user.id, body.lang).wpm;
    return [201, { rank: q.boardAhead.get(body.lang, best).n + 1, best }];
  },

  'GET /api/profile': (req) => {
    const user = currentUser(req);
    if (!user) return [401, { error: 'sign in first' }];
    return [200, {
      user: publicUser(user),
      totals: q.totals.get(user.id),
      perLang: q.perLang.all(user.id),
      recent: q.recent.all(user.id),
      pbs: q.pbs.all(user.id),
    }];
  },
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    const route = routes[`${req.method} ${url.pathname}`];
    if (route) {
      let body;
      if (req.method === 'POST') {
        // JSON only: plain cross-site form posts can't send this content type, which blocks CSRF with SameSite=Lax.
        if (!String(req.headers['content-type']).startsWith('application/json')) return send(res, 415, { error: 'send json' });
        try { body = await readJson(req); } catch (e) { return send(res, 400, { error: e.message }); }
      }
      const [status, out, setCookie] = await route(req, url, body);
      return send(res, status, out, setCookie);
    }

    const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    if (req.method === 'GET' && Object.hasOwn(PUBLIC, file)) {
      res.writeHead(200, { 'Content-Type': `${PUBLIC[file]}; charset=utf-8` });
      return fs.createReadStream(path.join(ROOT, file)).pipe(res);
    }
    return send(res, 404, { error: 'not found' });
  } catch (e) {
    console.error(e);
    send(res, 500, { error: 'server error' });
  }
}).listen(PORT, () => console.log(`penguintype running at http://localhost:${PORT}`));
