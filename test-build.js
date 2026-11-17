// node test-build.js: checks projects.js format and runs every prefix of every project in a stubbed browser.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const src = fs.readFileSync(path.join(__dirname, 'projects.js'), 'utf8');
const PROJECTS = vm.runInNewContext(src + '\nPROJECTS;');
const THEME = { bg: '#15181e', panel: '#20242c', sub: '#586070', text: '#e4e7ec', main: '#6fc3ff', error: '#ff6b7f' };

assert(PROJECTS.length >= 3, 'need 3 projects');
for (const p of PROJECTS) {
  assert(p.id && p.name && p.blurb, p.id + ': id/name/blurb');
  assert(p.parts.length >= 6 && p.parts.length <= 9, p.id + ': 6-9 parts');
  for (const part of p.parts) {
    const where = p.id + ' / ' + part.name;
    const code = part.code.replace(/^\n/, '');
    const lines = code.split('\n');
    assert(lines.length >= 8 && lines.length <= 22, where + ': ' + lines.length + ' lines');
    assert(!/[^\x20-\x7e\n]/.test(code), where + ': non-ASCII, tab or CR');
    assert(!code.includes('`') && !code.includes('${'), where + ': backtick or ${');
    assert(!lines.some((l) => / $/.test(l)), where + ': trailing whitespace');
  }
}

function makeEnv() {
  const listeners = {};
  const frames = [];
  let calls = 0;
  const ctx = new Proxy({}, {
    get: (t, k) => (k in t ? t[k] : () => { calls++; }),
    set: (t, k, v) => { t[k] = v; return true; },
  });
  const on = (target) => (type, fn) => (listeners[target + type] = listeners[target + type] || []).push(fn);
  const canvas = {
    width: 400, height: 400, style: {},
    getContext: () => ctx,
    addEventListener: on('canvas:'),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 400 }),
  };
  const sandbox = {
    THEME, Math, console,
    performance: { now: () => now },
    document: { getElementById: () => canvas },
    requestAnimationFrame: (fn) => frames.push(fn),
    setInterval: (fn) => frames.push(fn),
    setTimeout: (fn) => frames.push(fn),
  };
  sandbox.window = sandbox;
  sandbox.addEventListener = on('window:');
  let now = 1000;
  return {
    sandbox,
    calls: () => calls,
    frame() {
      now += 1000 / 60;
      const due = frames.splice(0);
      due.forEach((fn) => fn(now));
    },
    fire(target, type, extra) {
      const event = { type, preventDefault() {}, clientX: 200, clientY: 200, ...extra };
      (listeners[target + ':' + type] || []).forEach((fn) => fn(event));
    },
  };
}

const KEYS = ['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'w', 'a', 's', 'd', ' ', 'Enter'];
for (const p of PROJECTS) {
  for (let n = 1; n <= p.parts.length; n++) {
    const env = makeEnv();
    const where = p.id + ' parts 1..' + n;
    const code = p.parts.slice(0, n).map((part) => part.code).join('\n\n');
    try {
      vm.runInNewContext(code, env.sandbox);
      const frames = n === p.parts.length ? 3000 : 120;
      for (let i = 0; i < frames; i++) {
        if (i % 10 === 5) {
          const key = KEYS[Math.floor(Math.random() * KEYS.length)];
          env.fire('window', 'keydown', { key });
          if (i % 20 === 5) env.fire('window', 'keyup', { key });
          env.fire('canvas', 'mousedown');
          env.fire('canvas', 'mousemove', { clientX: Math.random() * 400 });
        }
        env.frame();
      }
    } catch (err) {
      console.error('FAIL ' + where + ': ' + err.stack);
      process.exit(1);
    }
    assert(env.calls() > 0, where + ': drew nothing');
  }
}
console.log('ok');
