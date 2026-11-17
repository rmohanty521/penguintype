// UI: mode bar, rendering and key handling. Engine in engine.js, snippets in snippets*.js, accounts in account.js.
const $ = (s) => document.querySelector(s);

// Small line icons (stroke = currentColor), drawn for this site.
const ICON = {
  time: '<circle cx="8" cy="8" r="6.2"/><path d="M8 4.6V8l2.4 1.6"/>',
  snippet: '<path d="M5.8 2.5c-1.4 0-1.6.8-1.6 2.2S3.8 7.4 2.4 8c1.4.6 1.8 1.6 1.8 3.1s.2 2.4 1.6 2.4M10.2 2.5c1.4 0 1.6.8 1.6 2.2s.4 2.7 1.8 3.3c-1.4.6-1.8 1.6-1.8 3.1s-.2 2.4-1.6 2.4"/>',
  pick: '<circle cx="8" cy="8" r="6.2"/><circle cx="8" cy="8" r="3"/><circle cx="8" cy="8" r=".6"/>',
  zen: '<path d="M2 10.5c2-2.6 4-2.6 6 0s4 2.6 6 0M4 6.5c1.4-1.6 2.8-1.6 4 0s2.6 1.6 4 0"/>',
  custom: '<path d="M10.8 2.6l2.6 2.6-7.6 7.6-3.2.6.6-3.2z"/>',
  globe: '<circle cx="8" cy="8" r="6.2"/><path d="M1.8 8h12.4M8 1.8c2.2 2.4 2.2 10 0 12.4M8 1.8c-2.2 2.4-2.2 10 0 12.4"/>',
  restart: '<path d="M13.2 8.4A5.2 5.2 0 1 1 11.6 4.3M13.4 2.4v2.9h-2.9"/>',
  next: '<path d="M2.8 8h9.6M8.6 4.2 12.4 8l-3.8 3.8"/>',
};
const icon = (name) => `<svg viewBox="0 0 16 16" aria-hidden="true">${ICON[name]}</svg>`;

const MODES = ['time', 'snippet', 'pick', 'zen', 'custom'];
const TIMES = [15, 30, 60, 120];
const CONTENTS = ['all', 'algorithms', 'everyday'];
const CHARS_PER_SECOND = 50; // timed tests get more text than anyone can type (~600 wpm)
const CUSTOM_MAX = 20000;

const cfg = { lang: 'python', mode: 'snippet', time: 60, content: 'all', algo: ALGOS[0].id, custom: '' };
try { Object.assign(cfg, JSON.parse(localStorage.getItem('penguintype') || '{}')); } catch {}
// settings saved by older versions: mode was random/algorithms/pick plus a separate length
if (cfg.mode === 'random' || cfg.mode === 'algorithms') {
  cfg.content = cfg.mode === 'random' ? 'all' : 'algorithms';
  cfg.mode = cfg.length === 'time' ? 'time' : 'snippet';
}
delete cfg.length;
delete cfg.name;
if (!LANGS[cfg.lang]) cfg.lang = 'python';
if (!MODES.includes(cfg.mode)) cfg.mode = 'snippet';
if (!TIMES.includes(cfg.time)) cfg.time = 60;
if (!CONTENTS.includes(cfg.content)) cfg.content = 'all';
const save = () => { try { localStorage.setItem('penguintype', JSON.stringify(cfg)); } catch {} };

// Themes: [background, panel, muted text, text, accent, error]. Add one here and it shows in the picker.
const THEMES = {
  penguin: ['#15181e', '#20242c', '#586070', '#e4e7ec', '#6fc3ff', '#ff6b7f'],
  glacier: ['#e8f1f5', '#d3e3ea', '#7d98a6', '#1f3440', '#2a7fab', '#d6455d'],
  paper: ['#f3efe6', '#e6e0d2', '#9a9282', '#2b2a27', '#d0602f', '#c0392b'],
  matcha: ['#1c2420', '#26302a', '#5f7266', '#dde8df', '#9bd18b', '#e8737a'],
  sunset: ['#221a26', '#2e2333', '#75607a', '#f2e4ea', '#ff9a62', '#ff5e7a'],
  terminal: ['#0b0f0b', '#141a14', '#3c5a3c', '#b8f5b8', '#39ff6a', '#ff4d4d'],
  sakura: ['#fbeff2', '#f2dde3', '#b58a97', '#4a2e38', '#e06a91', '#c23b3b'],
  ocean: ['#0f1d2b', '#17293b', '#4f6b85', '#d8e6f2', '#4fd1c5', '#ff7a85'],
  grape: ['#1e1a2e', '#2a2440', '#6c6290', '#e6e1f5', '#b69cff', '#ff6e8a'],
  mono: ['#111111', '#1d1d1d', '#5c5c5c', '#eeeeee', '#ffffff', '#ff5555'],
};
// Palettes from popular code editor themes, mapped onto the same six slots.
const EDITOR_THEMES = {
  dracula: ['#282a36', '#343746', '#6272a4', '#f8f8f2', '#bd93f9', '#ff5555'],
  monokai: ['#272822', '#3e3d32', '#75715e', '#f8f8f2', '#a6e22e', '#f92672'],
  'one dark': ['#282c34', '#2f343e', '#5c6370', '#abb2bf', '#61afef', '#e06c75'],
  nord: ['#2e3440', '#3b4252', '#616e88', '#eceff4', '#88c0d0', '#bf616a'],
  'tokyo night': ['#1a1b26', '#24283b', '#565f89', '#c0caf5', '#7aa2f7', '#f7768e'],
  'catppuccin mocha': ['#1e1e2e', '#313244', '#6c7086', '#cdd6f4', '#cba6f7', '#f38ba8'],
  'gruvbox dark': ['#282828', '#3c3836', '#7c6f64', '#ebdbb2', '#fabd2f', '#fb4934'],
  'solarized dark': ['#002b36', '#073642', '#586e75', '#93a1a1', '#268bd2', '#dc322f'],
  'solarized light': ['#fdf6e3', '#eee8d5', '#93a1a1', '#586e75', '#268bd2', '#dc322f'],
  'github dark': ['#0d1117', '#161b22', '#6e7681', '#e6edf3', '#58a6ff', '#ff7b72'],
  'github light': ['#ffffff', '#f0f2f5', '#8c959f', '#1f2328', '#0969da', '#cf222e'],
};
const ALL_THEMES = { ...THEMES, ...EDITOR_THEMES };
if (!ALL_THEMES[cfg.theme]) cfg.theme = 'penguin';

function applyTheme(name) {
  const vars = ['--bg', '--sub-bg', '--sub', '--text', '--main', '--error'];
  ALL_THEMES[name].forEach((c, i) => document.documentElement.style.setProperty(vars[i], c));
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', ALL_THEMES[name][0]);
}
applyTheme(cfg.theme);

let test, snip, spans, ticker; // snip = { id, name, code } for the current language

// Personal bests per test + language. Kept in this browser; account.js merges in the account's bests.
let pbs = {};
try { pbs = JSON.parse(localStorage.getItem('penguintype-pbs') || '{}'); } catch {}
const pbKey = () => `${snip.id}:${cfg.lang}`;
const savePbs = () => { try { localStorage.setItem('penguintype-pbs', JSON.stringify(pbs)); } catch {} };

function algoSnips() {
  return ALGOS.filter((a) => a.code[cfg.lang]).map((a) => ({ id: a.id, name: a.name, code: a.code[cfg.lang] }));
}

function pool() {
  if (cfg.content === 'algorithms') return algoSnips();
  if (cfg.content === 'everyday') return MISC[cfg.lang] || algoSnips();
  return [...algoSnips(), ...(MISC[cfg.lang] || [])];
}

function randomSnip(prevId) {
  const all = pool();
  let next;
  do next = all[Math.floor(Math.random() * all.length)];
  while (all.length > 1 && next.id === prevId);
  return next;
}

// Display name for a saved test id (used by the profile page too).
function snipName(id) {
  if (/^time\d+-/.test(id)) return id.replace(/^time(\d+)-/, '$1s ');
  const all = [...ALGOS, ...Object.values(MISC).flat()];
  return all.find((s) => s.id === id)?.name || id;
}

function clean(code) {
  return code.trim().replace(/\t/g, '    ').split('\n').map((l) => l.trimEnd()).join('\n');
}

function makeSnip() {
  switch (cfg.mode) {
    case 'zen':
      return { id: 'zen', name: 'zen', code: '' };
    case 'custom':
      return { id: 'custom', name: 'custom', code: cfg.custom || 'print("paste your own code with the custom button above")' };
    case 'pick': {
      const all = algoSnips();
      return all.find((s) => s.id === cfg.algo) || all[0];
    }
    case 'time': {
      // Chain snippets into one long text; the clock ends the test, not the text.
      const parts = [];
      let s, len = 0;
      while (len < cfg.time * CHARS_PER_SECOND) {
        s = randomSnip(s?.id);
        parts.push(clean(s.code));
        len += parts[parts.length - 1].length;
      }
      return { id: `time${cfg.time}-${cfg.content}`, name: `${cfg.time}s ${cfg.content}`, code: parts.join('\n\n') };
    }
    default:
      return randomSnip(snip?.id);
  }
}

function newTest(sameSnippet) {
  if (!sameSnippet || !snip) snip = makeSnip();
  test = createTest(cfg.mode === 'zen' ? '' : clean(snip.code), cfg.mode === 'zen');
  clearInterval(ticker);
  ticker = null;

  const code = $('#code');
  code.textContent = '';
  code.classList.toggle('zen', test.free);
  spans = [...test.text].map((ch) => {
    const s = document.createElement('span');
    if (ch === '\n') { s.textContent = '↵'; s.className = 'nl'; }
    else s.textContent = ch;
    code.append(s);
    if (ch === '\n') code.append('\n');
    return s;
  });

  const pb = pbs[pbKey()];
  const hint = cfg.mode === 'zen' ? ' · type anything, shift+enter to finish' : '';
  $('#algoName').textContent = `${snip.name}${pb ? ` · pb ${Math.round(pb.wpm)}` : ''}${hint}`;
  $('#langBtn').innerHTML = `${icon('globe')}<span></span>`;
  $('#langBtn span').textContent = LANGS[cfg.lang];
  $('#liveWpm').textContent = cfg.mode === 'time' ? cfg.time : '';
  code.scrollTop = 0;
  $('#result').hidden = true;
  $('#test').hidden = false;
  update();
}

function update() {
  const code = $('#code');
  let caret;
  if (test.free) {
    // zen: the text is whatever was typed, followed by the caret
    code.textContent = test.text;
    caret = document.createElement('span');
    caret.className = 'cur';
    caret.textContent = ' ';
    code.append(caret);
  } else {
    const n = test.typed.length;
    spans.forEach((s, i) => {
      const ch = test.text[i];
      let cls = ch === '\n' ? 'nl' : '';
      if (i < n) cls += test.typed[i] === false ? ' bad' : ' ok';
      if (i < n && test.typed[i] === false && (ch === ' ' || ch === '\n')) cls += ' ws';
      if (i === n) cls += ' cur';
      if (s.className !== cls.trim()) s.className = cls.trim();
    });
    caret = spans[n];
  }
  code.classList.toggle('idle', !test.start);
  // keep the caret about 3 lines from the top once the text is taller than the box
  const lineH = parseFloat(getComputedStyle(code).lineHeight);
  if (caret) code.scrollTop = Math.max(0, caret.offsetTop - lineH * 3);

  if (test.start && !ticker && !test.end) ticker = setInterval(tick, 100);
  if (test.end) finish();
}

// Live counter: seconds left in time mode, running wpm otherwise. Also ends timed tests.
function tick() {
  const now = performance.now();
  if (cfg.mode === 'time') {
    const left = cfg.time * 1000 - (now - test.start);
    if (left <= 0) { stop(test, cfg.time * 1000); return update(); }
    $('#liveWpm').textContent = Math.ceil(left / 1000);
  } else {
    $('#liveWpm').textContent = Math.round(stats(test, now).wpm);
  }
}

function finish() {
  clearInterval(ticker);
  const s = stats(test);
  $('#rWpm').textContent = Math.round(s.wpm);
  $('#rAcc').textContent = `${Math.round(s.acc)}%`;
  $('#rRaw').textContent = Math.round(s.raw);
  $('#rChars').textContent = `${s.correct}/${s.incorrect}`;
  $('#rTime').textContent = `${s.seconds.toFixed(1)}s`;
  $('#rAlgo').textContent = `${snip.name} · ${LANGS[cfg.lang]}`;

  const old = pbs[pbKey()];
  const isPb = !old || s.wpm > old.wpm;
  if (isPb) {
    pbs[pbKey()] = { wpm: s.wpm, acc: s.acc, date: Date.now() };
    savePbs();
  }
  $('#rPb').textContent = isPb
    ? old ? `new personal best! (was ${Math.round(old.wpm)})` : 'first run, personal best set'
    : `personal best ${Math.round(old.wpm)}`;
  $('#rPb').classList.toggle('new', isPb);

  $('#test').hidden = true;
  $('#result').hidden = false;
  drawGraph(history(test));
  if (typeof onRunFinished === 'function') onRunFinished(s); // account.js: save the run, leaderboard rank
}

// Inline SVG line chart: running wpm (accent), raw speed per second (muted), errors as red x marks.
// Hovering shows a guide line and a tooltip for the nearest second (see the pointer handlers below).
const W = 800, H = 220, L = 40, R = 40, T = 12, B = 28;
let graphPoints = [], graphX = () => 0;

function drawGraph(points) {
  const maxY = Math.max(20, Math.ceil(Math.max(...points.flatMap((p) => [p.wpm, p.raw])) / 20) * 20);
  const maxErr = Math.max(1, ...points.map((p) => p.errors));
  const x = (s) => (points.length === 1 ? L + (W - L - R) / 2 : L + ((s - 1) / (points.length - 1)) * (W - L - R));
  const y = (v) => T + (1 - v / maxY) * (H - T - B);
  const yErr = (v) => T + (1 - v / maxErr) * (H - T - B);
  const line = (key) => points.map((p) => `${x(p.s).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ');

  let svg = '';
  for (let v = 0; v <= maxY; v += maxY / 4) {
    svg += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/>`;
    svg += `<text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
  }
  svg += `<text x="${W - R + 8}" y="${yErr(maxErr) + 4}">${maxErr}</text><text x="${W - R + 8}" y="${yErr(0) + 4}">0</text>`;
  const step = Math.max(1, Math.ceil(points.length / 10));
  for (const p of points) {
    if (p.s % step === 0 || p.s === 1) svg += `<text x="${x(p.s)}" y="${H - 8}" text-anchor="middle">${p.s}</text>`;
  }
  svg += `<line id="guide" x1="0" x2="0" y1="${T}" y2="${H - B}" visibility="hidden"/>`;
  svg += `<polyline class="raw" points="${line('raw')}"/><polyline class="wpm" points="${line('wpm')}"/>`;
  for (const p of points) {
    svg += `<circle class="dot" cx="${x(p.s)}" cy="${y(p.wpm)}" r="3"/>`;
    if (p.errors) {
      const cx = x(p.s), cy = yErr(p.errors);
      svg += `<path class="err" d="M${cx - 4} ${cy - 4}L${cx + 4} ${cy + 4}M${cx + 4} ${cy - 4}L${cx - 4} ${cy + 4}"/>`;
    }
  }
  $('#graph').innerHTML = svg;
  $('#graph').setAttribute('viewBox', `0 0 ${W} ${H}`);
  graphPoints = points;
  graphX = x;
}

function showTip(e) {
  if (!graphPoints.length) return;
  const svg = $('#graph');
  const box = svg.getBoundingClientRect();
  const vx = ((e.clientX - box.left) / box.width) * W;
  let i = 0;
  graphPoints.forEach((p, j) => { if (Math.abs(graphX(p.s) - vx) < Math.abs(graphX(graphPoints[i].s) - vx)) i = j; });
  const p = graphPoints[i];
  const gx = graphX(p.s);

  const guide = $('#guide');
  guide.setAttribute('x1', gx);
  guide.setAttribute('x2', gx);
  guide.setAttribute('visibility', 'visible');
  svg.querySelectorAll('.dot').forEach((d, j) => d.classList.toggle('on', j === i));

  const tip = $('#tip');
  tip.innerHTML = `<b>${p.s}s</b><div><span class="k-wpm">wpm</span>${Math.round(p.wpm)}</div>`
    + `<div><span class="k-raw">raw</span>${Math.round(p.raw)}</div><div><span class="k-err">errors</span>${p.errors}</div>`;
  tip.hidden = false;
  const px = (gx / W) * box.width;
  const flip = px > box.width * 0.6; // keep the tooltip inside the chart near the right edge
  tip.style.left = `${flip ? px - tip.offsetWidth - 12 : px + 12}px`;
}

function hideTip() {
  $('#tip').hidden = true;
  $('#guide')?.setAttribute('visibility', 'hidden');
  $('#graph').querySelectorAll('.dot.on').forEach((d) => d.classList.remove('on'));
}

// Mode bar: [content] | [mode] | [options for the mode]
function button(label, active, onclick, iconName) {
  const b = document.createElement('button');
  b.innerHTML = iconName ? `${icon(iconName)}<span></span>` : '<span></span>';
  b.querySelector('span').textContent = label;
  b.classList.toggle('active', active);
  b.onclick = () => { b.blur(); onclick(); };
  return b;
}

function setCfg(key, value) {
  cfg[key] = value;
  save();
  buildBar();
  newTest(false);
}

function buildBar() {
  const contents = $('#contents');
  contents.textContent = '';
  for (const c of CONTENTS) contents.append(button(c, cfg.content === c, () => setCfg('content', c)));
  contents.hidden = !['time', 'snippet'].includes(cfg.mode);

  const modes = $('#modes');
  modes.textContent = '';
  for (const m of MODES) modes.append(button(m, cfg.mode === m, () => setCfg('mode', m), m));

  const sub = $('#sub');
  sub.textContent = '';
  if (cfg.mode === 'time') {
    for (const t of TIMES) sub.append(button(String(t), cfg.time === t, () => setCfg('time', t)));
  } else if (cfg.mode === 'pick') {
    const sel = document.createElement('select');
    sel.setAttribute('aria-label', 'algorithm');
    for (const a of ALGOS) sel.add(new Option(a.name, a.id));
    sel.value = cfg.algo;
    sel.onchange = () => { sel.blur(); setCfg('algo', sel.value); };
    sub.append(sel);
  } else if (cfg.mode === 'custom') {
    sub.append(button('edit code', false, openCustom));
  }
  sub.hidden = !sub.children.length;
}

function openCustom() {
  $('#customText').value = cfg.custom;
  $('#customPop').hidden = false;
  $('#customText').focus();
}

$('#customSave').onclick = () => {
  cfg.custom = $('#customText').value.slice(0, CUSTOM_MAX);
  save();
  $('#customPop').hidden = true;
  newTest(false);
};

function openLangs() {
  const list = $('#langList');
  list.textContent = '';
  for (const [value, label] of Object.entries(LANGS)) {
    list.append(button(label, cfg.lang === value, () => { $('#langPop').hidden = true; setCfg('lang', value); }));
  }
  $('#langPop').hidden = false;
  list.querySelector('.active')?.focus();
}

// Popups close on Esc, a click outside the panel, or any [data-close] button.
for (const o of document.querySelectorAll('.overlay')) {
  o.addEventListener('click', (e) => { if (e.target === o || e.target.closest('[data-close]')) o.hidden = true; });
}

document.addEventListener('keydown', (e) => {
  const popup = document.querySelector('.overlay:not([hidden])');
  if (popup) { if (e.key === 'Escape') popup.hidden = true; return; }
  if (e.key === 'Escape') { e.preventDefault(); return newTest(true); }
  // Tab focuses the next-test button, Enter (native button click) then switches, like Monkeytype.
  if (e.key === 'Tab') { e.preventDefault(); return $(test.end ? '#next' : '#skip').focus(); }
  if (e.target.tagName === 'BUTTON') {
    if (e.key === 'Enter' || e.key === ' ') return;
    e.target.blur(); // any other key goes back to typing
  }
  if (['SELECT', 'INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
  if (e.metaKey || e.ctrlKey !== e.altKey) return; // ignore shortcuts, allow AltGr (ctrl+alt) chars
  if (test.end) { if (e.key === 'Enter') { e.preventDefault(); newTest(false); } return; }
  if (test.free && e.key === 'Enter' && e.shiftKey) {
    e.preventDefault();
    if (test.start) { test.end = performance.now(); update(); }
    return;
  }

  const key = e.key === 'Enter' ? '\n' : e.key;
  if (e.key === 'Backspace') backspace(test);
  else if (key.length === 1) press(test, key, performance.now());
  else return;
  e.preventDefault();
  update();
});

$('#next').onclick = () => newTest(false);
$('#restart').innerHTML = icon('restart');
$('#restart').onclick = (e) => { e.currentTarget.blur(); newTest(true); };
$('#skip').innerHTML = icon('next');
$('#skip').onclick = (e) => { e.currentTarget.blur(); newTest(false); };
$('#langBtn').onclick = (e) => { e.currentTarget.blur(); openLangs(); };

const themeSel = $('#theme');
for (const [label, list] of [['penguintype', THEMES], ['editor themes', EDITOR_THEMES]]) {
  const group = document.createElement('optgroup');
  group.label = label;
  for (const name of Object.keys(list)) group.append(new Option(name, name));
  themeSel.append(group);
}
themeSel.value = cfg.theme;
themeSel.onchange = () => { cfg.theme = themeSel.value; save(); applyTheme(cfg.theme); themeSel.blur(); };
$('#graph').addEventListener('pointermove', showTip);
$('#graph').addEventListener('pointerleave', hideTip);

buildBar();
newTest(false);
