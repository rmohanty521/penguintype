// Checks generators.js: format rules, variety, and syntax via whatever compilers exist. Run: node test-gen.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { execSync, spawnSync } = require('child_process');

const GENERATORS = vm.runInThisContext(fs.readFileSync(path.join(__dirname, 'generators.js'), 'utf8') + '\nGENERATORS');
const RUNS = 300, EXTERNAL = 20;

function seeded(seed) { // mulberry32
  let h = seed >>> 0;
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let failures = 0;
const fail = (msg, code) => { failures++; console.error('FAIL ' + msg + (code ? '\n' + code + '\n' : '')); };

// brackets balance outside of string literals
function balanced(code, lang) {
  const stack = [], pairs = { ')': '(', ']': '[', '}': '{' };
  const quotes = lang === 'rust' ? '"' : lang === 'python' || lang === 'javascript' ? '"\'' : '"\'';
  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    if (quotes.includes(c)) {
      for (i++; i < code.length && code[i] !== c; i++) if (code[i] === '\\') i++;
    } else if ('([{'.includes(c)) stack.push(c);
    else if (pairs[c] && stack.pop() !== pairs[c]) return false;
  }
  return stack.length === 0;
}

const names = {};
const samples = {}; // lang -> [{ id, code }]
for (const [lang, gens] of Object.entries(GENERATORS)) {
  if (gens.length < 6) fail(`${lang}: only ${gens.length} templates`);
  const ids = new Set();
  samples[lang] = [];
  gens.forEach((g, gi) => {
    if (!/^gen-[a-z-]+$/.test(g.id)) fail(`${lang}: bad id ${g.id}`);
    if (ids.has(g.id)) fail(`${lang}: duplicate id ${g.id}`);
    ids.add(g.id);
    if (names[g.id] && names[g.id] !== g.name) fail(`${g.id} has names "${names[g.id]}" and "${g.name}"`);
    names[g.id] = g.name;
    const seen = new Set();
    for (let i = 0; i < RUNS; i++) {
      const code = g.make(seeded(gi * 100003 + i * 7919 + lang.length));
      seen.add(code);
      const lines = code.split('\n');
      const where = `${lang}/${g.id}#${i}`;
      if (typeof code !== 'string') { fail(`${where}: not a string`); break; }
      if (lines.length < 6 || lines.length > 25) fail(`${where}: ${lines.length} lines`, code);
      else if (/\t/.test(code)) fail(`${where}: tab`, code);
      else if (/[ ]+$/m.test(code)) fail(`${where}: trailing whitespace`, code);
      else if (!lines[0].trim() || !lines[lines.length - 1].trim()) fail(`${where}: leading/trailing blank line`, code);
      else if (/[^\x20-\x7e\n]/.test(code)) fail(`${where}: non-ascii`, code);
      else if (/`|\$\{/.test(code)) fail(`${where}: backtick or \${`, code);
      else if (/undefined|NaN|\[object/.test(code)) fail(`${where}: template leak`, code);
      else if (/\n\n\n/.test(code) && lang !== 'python') fail(`${where}: double blank line`, code);
      else if (!balanced(code, lang)) fail(`${where}: unbalanced brackets`, code);
      else if (lang === 'javascript') {
        try { new Function(code); } catch (e) { fail(`${where}: ${e.message}`, code); }
      }
      if (i < EXTERNAL) samples[lang].push({ id: g.id, code });
    }
    if (seen.size < 30) fail(`${lang}/${g.id}: only ${seen.size} distinct outputs of ${RUNS}`);
  });
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'penguintype-gen-'));
const has = (cmd) => { try { execSync(`where ${cmd}`, { stdio: 'ignore' }); return true; } catch { return false; } };
const ran = [];
const report = (tool, r, file) => {
  ran.push(tool);
  if (r.status !== 0) fail(`${tool} rejected ${file}\n${(r.stdout || '') + (r.stderr || '')}`.slice(0, 4000));
};

// python: ast.parse each sample, print the ones that fail
if (has('python')) {
  const script = 'import ast,json,sys\nfor i,c in enumerate(json.load(sys.stdin)):\n'
    + '    try: ast.parse(c)\n    except SyntaxError as e: print(i, e); print(c); print()\n';
  const r = spawnSync('python', ['-c', script], { input: JSON.stringify(samples.python.map((s) => s.code)), encoding: 'utf8' });
  ran.push('python ast');
  if (r.status !== 0 || r.stdout.trim()) fail('python ast\n' + r.stdout + r.stderr);
}

// split off #include / import lines so many samples can share one file
const hoist = (list, re) => {
  const heads = new Set(), bodies = [];
  for (const s of list) {
    const keep = [];
    for (const l of s.code.split('\n')) (re.test(l) ? heads.add(l) : keep.push(l));
    bodies.push(keep.join('\n'));
  }
  return { heads: [...heads], bodies };
};

// first g++ whose standard library actually compiles (a partial msys2 mingw64 install ships broken headers)
const gxx = ['g++', 'C:/msys64/ucrt64/bin/g++.exe', 'C:/msys64/clang64/bin/g++.exe'].find((cmd) => {
  const probe = path.join(tmp, 'probe.cpp');
  fs.writeFileSync(probe, '#include <string>\n#include <vector>\n');
  const r = spawnSync(cmd, ['-std=c++17', '-fsyntax-only', probe], { env: gxxEnv(cmd) });
  return r.status === 0;
});
function gxxEnv(cmd) { return cmd.includes('/') ? { ...process.env, PATH: path.dirname(cmd) + path.delimiter + process.env.PATH } : process.env; }
const skipped = ['gofmt', 'rustc'].filter((t) => !has(t));
if (!gxx) skipped.push('a working g++');
else {
  const { heads, bodies } = hoist(samples.cpp, /^#include /);
  const file = path.join(tmp, 'cpp_check.cpp');
  fs.writeFileSync(file, ['#include <algorithm>', '#include <map>', '#include <string>', '#include <vector>', ...heads, '',
    ...bodies.map((b, i) => `namespace s${i} {\n${b}\n}`)].join('\n'));
  report(gxx + ' -fsyntax-only', spawnSync(gxx, ['-std=c++17', '-fsyntax-only', '-Wall', file], { encoding: 'utf8', env: gxxEnv(gxx) }), file);
}

if (has('javac')) {
  const { heads, bodies } = hoist(samples.java, /^import /);
  const file = path.join(tmp, 'JavaCheck.java');
  fs.writeFileSync(file, [...heads, '', ...bodies.map((b, i) => `class W${i} {\n${b}\n}`)].join('\n'));
  // parse only: the snippets reference app types (repositories, models) that don't exist here
  report('javac (parse)', spawnSync('javac', ['-XDshould-stop.ifNoError=PARSE', '-XDshould-stop.ifError=PARSE', '-d', tmp, file],
    { encoding: 'utf8' }), file);
}

if (has('gofmt')) {
  samples.go.forEach((s, i) => {
    const file = path.join(tmp, `g${i}.go`);
    fs.writeFileSync(file, (s.code.startsWith('package ') ? '' : 'package main\n\n') + s.code + '\n');
    const r = spawnSync('gofmt', ['-e', file], { encoding: 'utf8' });
    if (r.status !== 0) fail(`gofmt ${s.id}\n${r.stderr}`, s.code);
  });
  ran.push('gofmt -e');
}

if (has('rustc')) {
  samples.rust.forEach((s, i) => {
    const file = path.join(tmp, `r${i}.rs`);
    fs.writeFileSync(file, s.code + '\n');
    // -Z parse-only needs nightly; on stable fall back to expanding macros only, which still parses everything
    const r = spawnSync('rustc', ['--edition', '2021', '-Zunpretty=expanded', file], { encoding: 'utf8', env: { ...process.env, RUSTC_BOOTSTRAP: '1' } });
    if (r.status !== 0) fail(`rustc ${s.id}\n${r.stderr}`, s.code);
  });
  ran.push('rustc parse');
}

console.log(`templates: ${Object.entries(GENERATORS).map(([l, g]) => `${l} ${g.length}`).join(', ')}`);
console.log(`syntax checks: javascript new Function, ${ran.join(', ')}${skipped.length ? ` (not installed: ${skipped.join(', ')})` : ''}`);
if (failures) { console.error(`${failures} failure(s), temp files in ${tmp}`); process.exit(1); }
fs.rmSync(tmp, { recursive: true, force: true });
console.log('ok');
