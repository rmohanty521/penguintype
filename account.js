// Accounts, run history and the leaderboard, backed by Supabase (schema in supabase.sql).
// Everything here stays hidden until SUPABASE_URL / SUPABASE_KEY are filled in.
const SUPABASE_URL = 'https://coqextotxuhozvqkpcdd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_YH0p9pg9-86JdXJkFs0qMQ_r2FAra_a'; // publishable key, safe to ship (RLS guards the data)
// Usernames sign in as <username>@this domain. No mail is ever sent ("Confirm email" is off).
const USER_EMAIL_DOMAIN = 'users.penguintype.com';

let me = null; // { username, created } when signed in
let serverOk = false;
let pendingRun = null; // a finished run waiting for the player to sign in
const sb = SUPABASE_URL && window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;
const userEmail = (username) => `${username.toLowerCase()}@${USER_EMAIL_DOMAIN}`;

// Unwrap a supabase-js result, turning its errors into the short messages the UI shows.
function ok({ data, error }) {
  if (!error) return data;
  const m = error.message || '';
  if (/already registered/i.test(m)) throw new Error('that username is taken');
  if (/invalid login/i.test(m)) throw new Error('wrong username or password');
  if (/rate limit/i.test(m)) throw new Error('too many attempts, try again later');
  throw new Error(m || 'something went wrong');
}

async function loadMe(user) {
  const p = ok(await sb.from('profiles').select('username, created').eq('id', user.id).single());
  return { username: p.username, created: p.created };
}

const fmtDate = (ms) => new Date(ms).toLocaleDateString();
const fmtDuration = (s) => (s < 3600 ? `${Math.round(s / 60)} min` : `${(s / 3600).toFixed(1)} h`);

function fillRows(tbody, rows, empty, cols) {
  tbody.textContent = '';
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="${cols}" class="empty"></td></tr>`;
    tbody.querySelector('td').textContent = empty;
    return;
  }
  for (const row of rows) {
    const tr = document.createElement('tr');
    if (row.me) tr.className = 'me';
    for (const v of row.cells) {
      const td = document.createElement('td');
      td.textContent = v;
      tr.append(td);
    }
    tbody.append(tr);
  }
}

function renderAccount() {
  $('#account').hidden = !serverOk;
  $('#signInBtn').hidden = !!me;
  $('#userBtn').hidden = !me;
  if (me) $('#userBtn').textContent = me.username;
}

// Pull the account's personal bests into this browser so pb labels match across devices.
async function syncPbs() {
  try {
    const p = ok(await sb.rpc('my_profile'));
    for (const r of p.pbs) {
      const key = `${r.snippet}:${r.lang}`;
      if (!pbs[key] || r.wpm > pbs[key].wpm) pbs[key] = { wpm: r.wpm, acc: r.acc, date: Date.now() };
    }
    savePbs();
  } catch {}
}

const isBoardRun = (s) => cfg.mode === 'time' && cfg.time === 60 && cfg.content === 'all' && s.seconds >= 59.5;

async function onRunFinished(s) {
  const lb = $('#lb');
  lb.hidden = true;
  $('#lbSignIn').hidden = true;
  pendingRun = null;
  if (!serverOk || !test.start) return;

  const run = { lang: cfg.lang, mode: cfg.mode, snippet: snip.id, wpm: s.wpm, raw: s.raw, acc: s.acc, seconds: s.seconds };
  if (!me) {
    pendingRun = run;
    lb.hidden = false;
    $('#lbMsg').textContent = isBoardRun(s)
      ? 'sign in to save this run and join the leaderboard'
      : 'sign in to save your runs and track progress';
    $('#lbSignIn').hidden = false;
    return;
  }
  saveRun(run, isBoardRun(s));
}

async function saveRun(run, boardRun) {
  const lb = $('#lb');
  lb.hidden = false;
  $('#lbMsg').textContent = 'saving...';
  try {
    ok(await sb.from('runs').insert(run));
    const r = boardRun && run.acc >= 75 ? ok(await sb.rpc('board_rank', { p_lang: run.lang }))[0] || {} : {};
    $('#lbMsg').textContent = r.rank
      ? `saved · leaderboard rank #${r.rank} in ${LANGS[run.lang]} (best ${Math.round(r.best)})`
      : boardRun ? 'saved · the leaderboard needs at least 75% accuracy' : 'saved to your profile';
  } catch (e) {
    $('#lbMsg').textContent = `not saved: ${e.message}`;
  }
}

// --- sign in / create account ---
let authMode = 'login';

function openAuth(mode = 'login') {
  authMode = mode;
  $('#authErr').textContent = '';
  renderAuth();
  $('#auth').hidden = false;
  $('#authUser').focus();
}

function renderAuth() {
  const signup = authMode === 'signup';
  for (const b of document.querySelectorAll('#authForm [data-tab]')) b.classList.toggle('active', b.dataset.tab === authMode);
  $('#authTitle').textContent = signup ? 'create account' : 'sign in';
  $('#authSubmit').textContent = signup ? 'create account' : 'sign in';
  $('#authPass').autocomplete = signup ? 'new-password' : 'current-password';
  $('#authHint').textContent = signup ? 'username: 3-20 letters, numbers, _ . or -. password: at least 8 characters.' : '';
}

for (const b of document.querySelectorAll('#authForm [data-tab]')) {
  b.onclick = () => { authMode = b.dataset.tab; $('#authErr').textContent = ''; renderAuth(); };
}

$('#authForm').onsubmit = async (e) => {
  e.preventDefault();
  $('#authErr').textContent = '';
  $('#authSubmit').disabled = true;
  try {
    const username = $('#authUser').value.trim();
    const password = $('#authPass').value;
    if (authMode === 'signup') {
      if (!/^[A-Za-z0-9_.-]{3,20}$/.test(username)) throw new Error('username must be 3-20 letters, numbers, _ . or -');
      if (password.length < 8) throw new Error('password must be at least 8 characters');
      ok(await sb.auth.signUp({ email: userEmail(username), password, options: { data: { username } } }));
      me = { username, created: Date.now() };
    } else {
      if (!username || !password) throw new Error('username and password required');
      me = await loadMe(ok(await sb.auth.signInWithPassword({ email: userEmail(username), password })).user);
    }
    $('#authPass').value = '';
    $('#auth').hidden = true;
    renderAccount();
    syncPbs();
    // save the run they just finished, if its results are still on screen
    if (pendingRun && !$('#result').hidden) {
      $('#lbSignIn').hidden = true;
      saveRun(pendingRun, pendingRun.snippet === 'time60-all');
    }
    pendingRun = null;
  } catch (err) {
    $('#authErr').textContent = err.message;
  } finally {
    $('#authSubmit').disabled = false;
  }
};

// --- profile ---
async function openProfile() {
  $('#profName').textContent = me.username;
  $('#profTotals').textContent = 'loading...';
  fillRows($('#profLangs'), [], '', 5);
  fillRows($('#profRecent'), [], '', 5);
  $('#profile').hidden = false;
  try {
    const p = ok(await sb.rpc('my_profile'));
    $('#profTotals').textContent = `joined ${fmtDate(me.created)} · ${p.totals.tests} test${p.totals.tests === 1 ? '' : 's'} ·${fmtDuration(p.totals.seconds)} typing`;
    fillRows($('#profLangs'), p.perLang.map((l) => ({
      cells: [LANGS[l.lang] || l.lang, l.best60 == null ? '-' : Math.round(l.best60), Math.round(l.best), Math.round(l.avg), l.tests],
    })), 'no tests yet', 5);
    fillRows($('#profRecent'), p.recent.map((r) => ({
      cells: [fmtDate(r.created), snipName(r.snippet), LANGS[r.lang] || r.lang, Math.round(r.wpm), `${Math.round(r.acc)}%`],
    })), 'no tests yet', 5);
  } catch (e) {
    $('#profTotals').textContent = e.message;
  }
}

$('#signOut').onclick = async () => {
  try { await sb.auth.signOut(); } catch {}
  me = null;
  $('#profile').hidden = true;
  renderAccount();
};

// --- leaderboard ---
let boardLang = cfg.lang;

function openBoard() {
  boardLang = cfg.lang;
  $('#board').hidden = false;
  loadBoard();
}

async function loadBoard() {
  const tabs = $('#boardLangs');
  tabs.textContent = '';
  for (const [value, label] of Object.entries(LANGS)) {
    tabs.append(button(label, value === boardLang, () => { boardLang = value; loadBoard(); }));
  }
  fillRows($('#boardRows'), [], 'loading...', 6);
  try {
    const data = ok(await sb.rpc('leaderboard', { p_lang: boardLang }));
    fillRows($('#boardRows'), data.map((r, i) => ({
      me: me && r.name.toLowerCase() === me.username.toLowerCase(),
      cells: [i + 1, r.name, Math.round(r.wpm), `${Math.round(r.acc)}%`, Math.round(r.raw), fmtDate(r.created)],
    })), 'no scores yet. finish a 60s test with "all" content to be first', 6);
  } catch {
    fillRows($('#boardRows'), [], 'could not load the leaderboard', 6);
  }
}

$('#boardBtn').onclick = (e) => { e.currentTarget.blur(); openBoard(); };
$('#signInBtn').onclick = (e) => { e.currentTarget.blur(); openAuth('login'); };
$('#lbSignIn').onclick = (e) => { e.currentTarget.blur(); openAuth('login'); };
$('#userBtn').onclick = (e) => { e.currentTarget.blur(); openProfile(); };

(async () => {
  if (!sb) return;
  serverOk = true;
  try {
    const { data } = await sb.auth.getSession();
    if (data.session) me = await loadMe(data.session.user);
  } catch {}
  renderAccount();
  if (me) syncPbs();
})();
