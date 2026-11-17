// Endless everyday code: templates that fill themed vocabularies into realistic snippets.
// GENERATORS[lang] = [{ id, name, make(rand) }]; make returns 6-25 lines, 2-space js, 4-space elsewhere.
// Same id in two languages means the same shape, so it keeps the same name.
const GENERATORS = (() => {
  const THEMES = [
    { entity: 'product', label: 'name', machine: 'order', extra: 'cancelled',
      labels: ['desk lamp', 'coffee mug', 'yoga mat', 'water bottle', 'phone case', 'throw pillow'],
      states: ['pending', 'paid', 'packed', 'shipped', 'delivered'],
      fields: [['price', 'float', 2, 200], ['quantity', 'int', 1, 100], ['discount', 'int', 5, 50],
        ['rating', 'float', 1, 5], ['category', 'str', ['kitchen', 'garden', 'toys', 'books']], ['in_stock', 'bool']] },
    { entity: 'player', label: 'username', machine: 'match', extra: 'abandoned',
      labels: ['shadowfox', 'pixelknight', 'lunarbyte', 'turbo_tim', 'quietstorm'],
      states: ['lobby', 'countdown', 'playing', 'paused', 'finished'],
      fields: [['score', 'int', 0, 5000], ['level', 'int', 1, 60], ['health', 'int', 1, 100],
        ['speed', 'float', 1, 10], ['team', 'str', ['red', 'blue', 'green']], ['is_online', 'bool']] },
    { entity: 'track', label: 'title', machine: 'playback', extra: 'failed',
      labels: ['midnight drive', 'paper planes', 'golden hour', 'low tide', 'neon rain'],
      states: ['queued', 'loading', 'playing', 'paused', 'stopped'],
      fields: [['duration', 'int', 90, 420], ['plays', 'int', 0, 90000], ['bpm', 'int', 60, 180],
        ['volume', 'float', 0, 1], ['artist', 'str', ['nova', 'the static', 'mira lane']], ['is_explicit', 'bool']] },
    { entity: 'reading', label: 'station', machine: 'sensor', extra: 'offline',
      labels: ['harbor point', 'ridge station', 'airport east', 'oslo-3', 'mill creek'],
      states: ['idle', 'sampling', 'uploading', 'sleeping', 'error'],
      fields: [['humidity', 'int', 0, 100], ['pressure', 'int', 980, 1040], ['temperature', 'float', -20, 45],
        ['wind_speed', 'float', 0, 30], ['region', 'str', ['north', 'coast', 'valley']], ['is_calibrated', 'bool']] },
    { entity: 'student', label: 'name', machine: 'enrollment', extra: 'withdrawn',
      labels: ['maya chen', 'leo park', 'ana silva', 'sam okafor', 'ivy brooks'],
      states: ['applied', 'admitted', 'enrolled', 'suspended', 'graduated'],
      fields: [['grade', 'int', 1, 12], ['credits', 'int', 0, 120], ['gpa', 'float', 0, 4],
        ['attendance', 'float', 0, 1], ['house', 'str', ['oak', 'maple', 'cedar']], ['enrolled', 'bool']] },
    { entity: 'satellite', label: 'callsign', machine: 'mission', extra: 'aborted',
      labels: ['aurora-1', 'kestrel', 'vanguard 7', 'polaris', 'halcyon'],
      states: ['grounded', 'fueling', 'launching', 'orbiting', 'returning', 'landed'],
      fields: [['crew', 'int', 0, 7], ['mass', 'int', 100, 9000], ['altitude', 'float', 200, 36000],
        ['fuel', 'float', 0, 100], ['orbit', 'str', ['leo', 'meo', 'geo']], ['is_active', 'bool']] },
    { entity: 'ticket', label: 'subject', machine: 'ticket', extra: 'reopened',
      labels: ['login broken', 'refund request', 'slow dashboard', 'missing invoice', 'export fails'],
      states: ['open', 'triaged', 'in_progress', 'waiting', 'closed'],
      fields: [['priority', 'int', 1, 5], ['age_hours', 'int', 1, 240], ['replies', 'int', 0, 40],
        ['satisfaction', 'float', 1, 5], ['assignee', 'str', ['dana', 'raj', 'kim']], ['is_urgent', 'bool']] },
    { entity: 'book', label: 'title', machine: 'loan', extra: 'lost',
      labels: ['the quiet sea', 'iron garden', 'small hours', 'north of nowhere', 'salt and ash'],
      states: ['available', 'reserved', 'borrowed', 'overdue', 'returned'],
      fields: [['pages', 'int', 80, 900], ['year', 'int', 1950, 2024], ['copies', 'int', 1, 12],
        ['price', 'float', 5, 40], ['genre', 'str', ['fantasy', 'history', 'poetry', 'mystery']], ['available', 'bool']] },
  ].map((t) => {
    const fields = t.fields.map(([n, ty, a, b]) => ty === 'str' ? { n, t: ty, opts: a } : { n, t: ty, lo: a, hi: b });
    return { ...t, plural: t.entity + 's', fields,
      lab: { n: t.label, t: 'str', opts: t.labels },
      ints: fields.filter((f) => f.t === 'int'),
      nums: fields.filter((f) => f.t === 'int' || f.t === 'float'),
      strs: fields.filter((f) => f.t === 'str'),
      bools: fields.filter((f) => f.t === 'bool') };
  });

  const SETTINGS = [['timeout_seconds', 5, 60], ['max_retries', 1, 6], ['cache_minutes', 1, 120],
    ['page_size', 10, 100], ['batch_size', 50, 500], ['worker_count', 2, 16], ['rate_limit', 30, 600]];
  const PREDICATES = ['ready', 'eligible', 'flagged', 'premium', 'critical', 'stale', 'featured'];
  const OPS = ['>', '>=', '<', '<='];
  const T = {
    python: { int: 'int', float: 'float', str: 'str', bool: 'bool' },
    java: { int: 'int', float: 'double', str: 'String', bool: 'boolean' },
    cpp: { int: 'int', float: 'double', str: 'std::string', bool: 'bool' },
    go: { int: 'int', float: 'float64', str: 'string', bool: 'bool' },
    rust: { int: 'u32', float: 'f64', str: 'String', bool: 'bool' },
  };

  const camel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  const pascal = (s) => camel(s)[0].toUpperCase() + camel(s).slice(1);
  const upper = (s) => s.toUpperCase();
  const q = (s) => '"' + s + '"';
  const out = (...parts) => parts.flat(Infinity).filter((l) => l != null && l !== false).join('\n');
  const ind = (n, ...parts) => parts.flat(Infinity).filter((l) => l != null && l !== false)
    .map((l) => (l === '' ? '' : ' '.repeat(n) + l));
  // blank lines between groups of lines, the way methods are spaced in a class
  const spaced = (groups) => groups.flatMap((g, i) => (i ? ['', ...g] : g));
  const align = (rows) => { // gofmt-style column alignment
    const w = rows.map((r) => r.map((c) => c.length));
    return rows.map((r) => r.map((c, i) => (i < r.length - 1 ? c.padEnd(Math.max(...w.map((x) => x[i] || 0))) : c)).join(' '));
  };
  const fmtF = (x) => { const v = Math.round(x * 10) / 10; return Number.isInteger(v) ? v + '.0' : String(v); };
  const isNum = (f) => f.t === 'int' || f.t === 'float';
  const zero = (lang, f) => ({ int: '0', float: '0.0', str: lang === 'rust' ? 'String::new()' : '""',
    bool: lang === 'python' ? 'False' : 'false' })[f.t];

  function kit(rand) {
    const int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
    const pick = (arr) => arr[Math.floor(rand() * arr.length)];
    const chance = (p = 0.5) => rand() < p;
    const shuffle = (arr) => {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      return a;
    };
    const sample = (arr, n) => shuffle(arr).slice(0, n);
    const th = pick(THEMES);
    const value = (f) => {
      if (f.t === 'int') return int(f.lo, f.hi);
      if (f.t === 'float') return fmtF(f.lo + rand() * (f.hi - f.lo));
      if (f.t === 'str') return pick(f.opts);
      return chance();
    };
    // a threshold away from the edges of the field's range
    const thr = (f) => {
      const span = f.hi - f.lo;
      const x = f.lo + span * (0.2 + 0.6 * rand());
      return f.t === 'int' ? String(Math.round(x)) : fmtF(x);
    };
    const lit = (lang, f, v = value(f)) => {
      if (f.t === 'str') return lang === 'rust' ? q(v) + '.to_string()' : q(v);
      if (f.t === 'bool') return lang === 'python' ? (v ? 'True' : 'False') : String(v);
      return String(v);
    };
    // label first, then k fields (at least one int) in random order
    const fields = (k) => {
      const first = pick(th.ints);
      return [th.lab, ...shuffle([first, ...sample(th.fields.filter((f) => f !== first), k - 1)])];
    };
    // a lifecycle prefix, sometimes with the theme's off-ramp state; never more than 5
    const states = () => {
      const st = th.states.slice(0, int(3, Math.min(5, th.states.length)));
      return st.length < 5 && chance(0.4) ? [...st, th.extra] : st;
    };
    return { int, pick, chance, shuffle, sample, th, value, thr, lit, fields, states,
      op: () => pick(OPS), pred: () => pick(PREDICATES), settings: (n) => sample(SETTINGS, n) };
  }

  const python = [
    { id: 'gen-class', name: 'class', make(rand) {
      const r = kit(rand), th = r.th, fs = r.fields(r.int(2, 4));
      const nDef = r.int(0, fs.length - 2);
      const n = r.pick(fs.filter((f) => f.t === 'int')), g = r.pick(fs.filter(isNum));
      const methods = {
        add: [`def add_${n.n}(self, amount: int) -> None:`, '    if amount <= 0:',
          '        raise ValueError("amount must be positive")', `    self.${n.n} += amount`],
        check: [`def is_${r.pred()}(self) -> bool:`, `    return self.${g.n} ${r.op()} ${r.thr(g)}`],
        str: ['def __str__(self) -> str:', `    return f"{self.${th.label}} (${g.n}: {self.${g.n}})"`],
      };
      return out('from dataclasses import dataclass', '',
        r.pick(['@dataclass', '@dataclass(slots=True)', '@dataclass(order=True)']), `class ${pascal(th.entity)}:`,
        ind(4, fs.map((f, i) => `${f.n}: ${T.python[f.t]}` + (i >= fs.length - nDef ? ' = ' + r.lit('python', f) : ''))),
        '', ind(4, spaced(r.sample(Object.values(methods), r.int(1, 2)))));
    } },
    { id: 'gen-aggregate', name: 'data aggregation', make(rand) {
      const r = kit(rand), th = r.th, e = th.entity, P = th.plural;
      const f = r.pick(th.nums), g = r.pick(th.nums.filter((x) => x !== f)), s = r.pick(th.strs), b = r.pick(th.bools);
      const mode = r.pick(['avg', 'group', 'top']);
      if (mode === 'avg') {
        const op = r.op(), lim = (op[0] === '>' ? 'min_' : 'max_') + g.n;
        return out(`def average_${f.n}(${P}, ${lim}=${r.thr(g)}):`,
          `    selected = [${e} for ${e} in ${P} if ${e}["${g.n}"] ${op} ${lim}]`,
          '    if not selected:', '        return 0.0',
          `    total = sum(${e}["${f.n}"] for ${e} in selected)`,
          `    return round(total / len(selected), ${r.int(1, 3)})`);
      }
      if (mode === 'group') {
        return out('from collections import defaultdict', '', `def ${f.n}_by_${s.n}(${P}):`,
          `    totals = defaultdict(${T.python[f.t]})`, `    for ${e} in ${P}:`,
          r.chance() && [`        if not ${e}["${b.n}"]:`, '            continue'],
          `        totals[${e}["${s.n}"]] += ${e}["${f.n}"]`, '    return dict(totals)');
      }
      return out(`def top_${P}(${P}, n=${r.int(3, 10)}):`,
        `    ranked = sorted(${P}, key=lambda ${e}: ${e}["${f.n}"], reverse=${r.pick(['True', 'False'])})`,
        '    result = []', `    for ${e} in ranked[:n]:`,
        `        result.append({"${th.label}": ${e}["${th.label}"], "${f.n}": ${e}["${f.n}"]})`, '    return result');
    } },
    { id: 'gen-flask-route', name: 'flask route', make(rand) {
      const r = kit(rand), th = r.th, e = th.entity, P = th.plural, s = r.pick(th.strs);
      const head = ['from flask import Flask, jsonify, request', '', 'app = Flask(__name__)', ''];
      const mode = r.pick(['get', 'list', 'create']);
      if (mode === 'get') {
        return out(head, `@app.get("/api/${P}/<int:${e}_id>")`, `def get_${e}(${e}_id):`,
          `    ${e} = db.${P}.find_one(${e}_id)`, `    if ${e} is None:`,
          `        return jsonify({"error": "${e} not found"}), 404`, `    return jsonify(${e})`);
      }
      if (mode === 'list') {
        return out(head, `@app.get("/api/${P}")`, `def list_${P}():`,
          `    limit = request.args.get("limit", ${r.int(10, 100)}, type=int)`, `    ${s.n} = request.args.get("${s.n}")`,
          `    ${P} = db.${P}.all()`, `    if ${s.n}:`, `        ${P} = [x for x in ${P} if x["${s.n}"] == ${s.n}]`,
          `    return jsonify(${P}[:limit])`);
      }
      const req = r.fields(r.int(1, 3)).map((f) => q(f.n));
      return out(head, `@app.post("/api/${P}")`, `def create_${e}():`, '    payload = request.get_json(silent=True) or {}',
        `    missing = [key for key in (${req.join(', ')}${req.length === 1 ? ',' : ''}) if key not in payload]`,
        '    if missing:', '        return jsonify({"error": "missing fields", "fields": missing}), 400',
        `    ${e} = db.${P}.insert(payload)`, `    return jsonify(${e}), 201`);
    } },
    { id: 'gen-config', name: 'config', make(rand) {
      const r = kit(rand), th = r.th;
      const consts = r.sample(th.fields, r.int(2, 3)).map((f) => `DEFAULT_${upper(f.n)} = ${r.lit('python', f)}`);
      const settings = r.settings(r.int(2, 4)).map(([k, lo, hi]) => `    "${k}": int(os.getenv("${upper(k)}", "${r.int(lo, hi)}")),`);
      return out('import os', '', `MAX_${upper(th.plural)} = ${r.int(5, 500)}`, consts,
        'DEBUG = os.getenv("DEBUG", "false").lower() == "true"', '',
        `${upper(th.machine)}_SETTINGS = {`, `    "host": os.getenv("HOST", "${r.pick(['127.0.0.1', '0.0.0.0', 'localhost'])}"),`,
        settings, `    "log_level": "${r.pick(['info', 'debug', 'warning'])}",`, '}');
    } },
    { id: 'gen-unit-test', name: 'unit test', make(rand) {
      const r = kit(rand), th = r.th, e = th.entity, C = pascal(e), n = r.pick(th.ints);
      const name = r.value(th.lab), start = r.int(n.lo, n.hi), add = r.int(1, 20);
      const tests = [
        [`def test_add_${n.n}(self):`, `    self.${e}.add_${n.n}(${add})`, `    self.assertEqual(self.${e}.${n.n}, ${start + add})`],
        ['def test_rejects_negative_amount(self):', '    with self.assertRaises(ValueError):', `        self.${e}.add_${n.n}(-${add})`],
        ['def test_str_includes_' + th.label + '(self):', `    self.assertIn("${name}", str(self.${e}))`],
      ];
      return out('import unittest', '', `from ${r.pick(['models', 'app.models', e + 's'])} import ${C}`, '', '',
        `class Test${C}(unittest.TestCase):`, '    def setUp(self):',
        `        self.${e} = ${C}(${th.label}="${name}", ${n.n}=${start})`, '',
        ind(4, spaced(r.sample(tests, r.int(1, 3)))),
        r.chance() && ['', '', 'if __name__ == "__main__":', '    unittest.main()']);
    } },
    { id: 'gen-validate', name: 'validation', make(rand) {
      const r = kit(rand), th = r.th, e = th.entity;
      const checks = r.sample(th.fields, r.int(2, 4)).map((f) => {
        if (isNum(f)) {
          return [`${f.n} = data.get("${f.n}", 0)`, `if not ${f.lo} <= ${f.n} <= ${f.hi}:`,
            `    errors.append("${f.n} must be between ${f.lo} and ${f.hi}")`];
        }
        if (f.t === 'str') {
          return [`if data.get("${f.n}") not in {${r.sample(f.opts, 2).map(q).join(', ')}}:`,
            `    errors.append(f"unknown ${f.n}: {data.get('${f.n}')}")`];
        }
        return [`if not isinstance(data.get("${f.n}"), bool):`, `    errors.append("${f.n} must be true or false")`];
      });
      return out(`def validate_${e}(data):`, '    errors = []', `    if not data.get("${th.label}"):`,
        `        errors.append("${th.label} is required")`, ind(4, checks), '    return errors');
    } },
    { id: 'gen-state-machine', name: 'state machine', make(rand) {
      const r = kit(rand), th = r.th, st = r.states(), E = pascal(th.machine) + 'State';
      const cancel = !st.includes(th.extra) && r.chance() ? th.extra : null, all = cancel ? [...st, cancel] : st;
      const fn = r.pick(['advance', 'transition', 'move_to']);
      return out('from enum import Enum', '', '', `class ${E}(Enum):`, all.map((s) => `    ${upper(s)} = "${s}"`), '', '',
        'TRANSITIONS = {',
        st.slice(0, -1).map((s, i) => `    ${E}.${upper(s)}: {${E}.${upper(st[i + 1])}${cancel && i < 2 ? `, ${E}.${upper(cancel)}` : ''}},`),
        '}', '', '', `def ${fn}(state, target):`, '    if target not in TRANSITIONS.get(state, set()):',
        '        raise ValueError(f"cannot go from {state.value} to {target.value}")', '    return target');
    } },
    { id: 'gen-recursion', name: 'recursion', make(rand) {
      const r = kit(rand), th = r.th, e = th.entity, f = r.pick(th.nums);
      const kids = r.pick(['children', 'items', 'nodes']);
      return r.pick([
        () => out(`def total_${f.n}(node):`, `    """Sum ${f.n.replace(/_/g, ' ')} over a node and everything below it."""`,
          `    total = node.get("${f.n}", 0)`, `    for child in node.get("${kids}", []):`,
          `        total += total_${f.n}(child)`, '    return total'),
        () => out(`def find_${e}(node, ${th.label}):`, `    if node.get("${th.label}") == ${th.label}:`, '        return node',
          `    for child in node.get("${kids}", []):`, `        found = find_${e}(child, ${th.label})`,
          '        if found is not None:', '            return found', '    return None'),
        () => out('def max_depth(node, depth=0):', `    """How many levels deep the ${e} tree goes."""`,
          `    children = node.get("${kids}", [])`, '    if not children:',
          '        return depth', '    return max(max_depth(child, depth + 1) for child in children)',
          r.chance() && ['', '', `print(max_depth(${e}_tree))`]),
        () => out(`def collect_${th.plural}(node, threshold=${r.thr(f)}):`, '    found = []',
          `    if node.get("${f.n}", 0) ${r.op()} threshold:`, '        found.append(node)',
          `    for child in node.get("${kids}", []):`, '        found.extend(collect_' + th.plural + '(child, threshold))',
          '    return found'),
      ])();
    } },
  ];

  const javascript = [
    { id: 'gen-class', name: 'class', make(rand) {
      const r = kit(rand), th = r.th, fs = r.fields(r.int(2, 3)), C = pascal(th.entity);
      const n = r.pick(fs.filter((f) => f.t === 'int')), g = r.pick(fs.filter(isNum));
      const destructure = r.chance();
      const params = fs.map((f, i) => (i === 0 ? camel(f.n) : `${camel(f.n)} = ${r.lit('javascript', f)}`)).join(', ');
      const methods = [
        [`add${pascal(n.n)}(amount) {`, '  if (amount <= 0) throw new Error("amount must be positive");',
          `  this.${camel(n.n)} += amount;`, r.chance() && '  return this;', '}'],
        [`is${pascal(r.pred())}() {`, `  return this.${camel(g.n)} ${r.op()} ${r.thr(g)};`, '}'],
        ['toString() {', `  return this.${camel(th.label)} + " (" + this.${camel(g.n)} + ")";`, '}'],
      ];
      return out(`class ${C} {`, `  constructor(${destructure ? '{ ' + params + ' } = {}' : params}) {`,
        fs.map((f) => `    this.${camel(f.n)} = ${camel(f.n)};`), '  }', '',
        ind(2, spaced(r.sample(methods, r.int(1, 2)))), '}');
    } },
    { id: 'gen-aggregate', name: 'data aggregation', make(rand) {
      const r = kit(rand), th = r.th, e = th.entity, P = th.plural;
      const f = camel(r.pick(th.nums).n), gf = r.pick(th.nums.filter((x) => camel(x.n) !== f)), g = camel(gf.n);
      const s = camel(r.pick(th.strs).n), b = camel(r.pick(th.bools).n);
      const mode = r.pick(['avg', 'group', 'top']);
      if (mode === 'avg') {
        const op = r.op(), lim = (op[0] === '>' ? 'min' : 'max') + pascal(gf.n);
        return out(`function average${pascal(f)}(${P}, ${lim} = ${r.thr(gf)}) {`,
          `  const selected = ${P}.filter((${e}) => ${e}.${g} ${op} ${lim});`,
          '  if (selected.length === 0) return 0;',
          `  const total = selected.reduce((sum, ${e}) => sum + ${e}.${f}, 0);`,
          `  return Number((total / selected.length).toFixed(${r.int(1, 3)}));`, '}');
      }
      if (mode === 'group') {
        return out(`function ${f}By${pascal(s)}(${P}) {`, '  const totals = {};', `  for (const ${e} of ${P}) {`,
          r.chance() && `    if (!${e}.${b}) continue;`,
          `    totals[${e}.${s}] = (totals[${e}.${s}] || 0) + ${e}.${f};`, '  }', '  return totals;', '}');
      }
      const desc = r.chance();
      return out(`const top${pascal(P)} = (${P}, n = ${r.int(3, 10)}) =>`, `  [...${P}]`,
        `    .filter((${e}) => ${r.chance() ? '' : '!'}${e}.${b})`,
        `    .sort((a, b) => ${desc ? `b.${f} - a.${f}` : `a.${f} - b.${f}`})`, '    .slice(0, n)',
        `    .map((${e}) => ({ ${camel(th.label)}: ${e}.${camel(th.label)}, ${f}: ${e}.${f} }));`);
    } },
    { id: 'gen-express-route', name: 'express route', make(rand) {
      const r = kit(rand), th = r.th, e = th.entity, P = th.plural, s = camel(r.pick(th.strs).n);
      const mode = r.pick(['get', 'list', 'create']);
      const wrap = (method, path, body) => out(`router.${method}("/${P}${path}", async (req, res) => {`, '  try {',
        ind(4, body), '  } catch (err) {', r.chance() && '    console.error(err);',
        '    res.status(500).json({ error: err.message });', '  }', '});');
      if (mode === 'get') {
        return wrap('get', '/:id', [`const ${e} = await db.${P}.findById(req.params.id);`, `if (!${e}) {`,
          `  return res.status(404).json({ error: "${e} not found" });`, '}', `res.json(${e});`]);
      }
      if (mode === 'list') {
        return wrap('get', '', [`const limit = Math.min(Number(req.query.limit) || ${r.int(10, 50)}, ${r.int(100, 500)});`,
          `const filter = req.query.${s} ? { ${s}: req.query.${s} } : {};`,
          `const ${P} = await db.${P}.find(filter).limit(limit);`, `res.json({ count: ${P}.length, ${P} });`]);
      }
      const req = r.fields(r.int(1, 3)).map((f) => camel(f.n));
      return wrap('post', '', [`const { ${req.join(', ')} } = req.body;`, `if (!${req.join(' || !')}) {`,
        '  return res.status(400).json({ error: "missing fields" });', '}',
        `const ${e} = await db.${P}.create({ ${req.join(', ')} });`, `res.status(201).json(${e});`]);
    } },
    { id: 'gen-config', name: 'config', make(rand) {
      const r = kit(rand), th = r.th;
      return out('const config = {', `  port: Number(process.env.PORT) || ${r.pick([3000, 4000, 5173, 8080])},`,
        `  env: process.env.NODE_ENV || "${r.pick(['development', 'production'])}",`,
        r.settings(r.int(1, 3)).map(([k, lo, hi]) => `  ${camel(k)}: ${r.int(lo, hi)},`),
        `  ${th.plural}: {`, `    max${pascal(th.plural)}: ${r.int(5, 500)},`,
        r.sample(th.fields, r.int(1, 3)).map((f) => `    default${pascal(f.n)}: ${r.lit('javascript', f)},`), '  },',
        r.chance() && `  features: [${r.sample(['"search"', '"export"', '"dark-mode"', '"beta-ui"', '"alerts"'], r.int(1, 3)).join(', ')}],`,
        '};', '', r.pick(['module.exports = Object.freeze(config);', 'module.exports = config;']));
    } },
    { id: 'gen-unit-test', name: 'unit test', make(rand) {
      const r = kit(rand), th = r.th, e = th.entity, C = pascal(e), n = r.pick(th.ints), N = pascal(n.n);
      const start = r.int(n.lo, n.hi), add = r.int(1, 20), name = r.value(th.lab);
      const tests = [
        [`test("add${N} increases ${camel(n.n)}", () => {`, `  ${e}.add${N}(${add});`,
          `  expect(${e}.${camel(n.n)}).toBe(${start + add});`, '});'],
        ['test("rejects negative amounts", () => {', `  expect(() => ${e}.add${N}(-${add})).toThrow();`, '});'],
        [`test("keeps the ${th.label}", () => {`, `  expect(${e}.${camel(th.label)}).toBe("${name}");`, '});'],
      ];
      return out(`const { ${C} } = require("./${e}");`, '', `describe("${C}", () => {`, `  let ${e};`, '',
        '  beforeEach(() => {', `    ${e} = new ${C}("${name}", ${start});`, '  });', '',
        ind(2, spaced(r.sample(tests, r.int(1, 3)))), '});');
    } },
    { id: 'gen-validate', name: 'validation', make(rand) {
      const r = kit(rand), th = r.th, e = th.entity;
      const checks = r.sample(th.fields, r.int(2, 4)).map((f) => {
        const k = camel(f.n);
        if (isNum(f)) {
          return [`if (typeof data.${k} !== "number" || data.${k} < ${f.lo} || data.${k} > ${f.hi}) {`,
            `  errors.push("${k} must be between ${f.lo} and ${f.hi}");`, '}'];
        }
        if (f.t === 'str') {
          return [`if (![${r.sample(f.opts, 2).map(q).join(', ')}].includes(data.${k})) {`,
            `  errors.push("unknown ${k}: " + data.${k});`, '}'];
        }
        return `if (typeof data.${k} !== "boolean") errors.push("${k} must be a boolean");`;
      });
      return out(`function validate${pascal(e)}(data) {`, '  const errors = [];',
        `  if (!data.${camel(th.label)}) errors.push("${camel(th.label)} is required");`, ind(2, checks),
        r.pick(['  return errors;', '  return { valid: errors.length === 0, errors };']), '}');
    } },
    { id: 'gen-reducer', name: 'reducer', make(rand) {
      const r = kit(rand), th = r.th, m = th.machine, st = r.states(), n = camel(r.pick(th.ints).n);
      const stamp = r.chance();
      return out(`function ${m}Reducer(state, action) {`, '  switch (action.type) {',
        st.slice(1).map((s) => [`    case "${m}/${camel(s)}":`,
          `      return { ...state, status: "${s}"${stamp ? ', updatedAt: action.at' : ''} };`]),
        r.chance() && [`    case "${m}/add${pascal(n)}":`, `      return { ...state, ${n}: state.${n} + action.amount };`],
        `    case "${m}/reset":`, `      return { status: "${st[0]}", ${n}: 0 };`,
        '    default:', '      return state;', '  }', '}');
    } },
    { id: 'gen-recursion', name: 'recursion', make(rand) {
      const r = kit(rand), th = r.th, e = th.entity, f = camel(r.pick(th.nums).n), lab = camel(th.label);
      const kids = r.pick(['children', 'items', 'nodes']);
      return r.pick([
        () => out(`function total${pascal(f)}(node) {`, `  let total = node.${f} || 0;`,
          `  for (const child of node.${kids} || []) {`, `    total += total${pascal(f)}(child);`, '  }', '  return total;', '}'),
        () => out(`function find${pascal(e)}(node, ${lab}) {`, `  if (node.${lab} === ${lab}) return node;`,
          `  for (const child of node.${kids} || []) {`, `    const found = find${pascal(e)}(child, ${lab});`,
          '    if (found) return found;', '  }', '  return null;', '}'),
        () => out('function depth(node) {', `  const children = node.${kids} || [];`, '  if (children.length === 0) return 1;',
          '  return 1 + Math.max(...children.map(depth));', '}', '', `console.log(depth(${e}Tree));`),
        () => out(`function collect${pascal(th.plural)}(node, threshold = ${r.thr(th.nums.find((x) => camel(x.n) === f))}, found = []) {`,
          `  if (node.${f} ${r.op()} threshold) found.push(node.${lab});`,
          `  for (const child of node.${kids} || []) {`, `    collect${pascal(th.plural)}(child, threshold, found);`, '  }',
          '  return found;', '}'),
      ])();
    } },
  ];

  const cppStruct = (r, fs, name) => [`struct ${name} {`,
    fs.map((f) => `    ${T.cpp[f.t]} ${camel(f.n)}${r.chance(0.4) ? ' = ' + (f.t === 'str' ? '"' + r.value(f) + '"' : r.lit('cpp', f)) : ''};`), '};'];

  const cpp = [
    { id: 'gen-struct', name: 'struct', make(rand) {
      const r = kit(rand), th = r.th, fs = r.fields(r.int(2, 4)), C = pascal(th.entity);
      const n = r.pick(fs.filter((f) => f.t === 'int')), g = r.pick(fs.filter(isNum));
      const methods = [
        [`void add${pascal(n.n)}(int amount) {`, `    if (amount > 0) ${camel(n.n)} += amount;`, '}'],
        [`bool is${pascal(r.pred())}() const {`, `    return ${camel(g.n)} ${r.op()} ${r.thr(g)};`, '}'],
        ['std::string describe() const {', `    return ${camel(th.label)} + " (" + std::to_string(${camel(g.n)}) + ")";`, '}'],
      ];
      return out('#include <string>', '', `struct ${C} {`,
        fs.map((f) => `    ${T.cpp[f.t]} ${camel(f.n)}${f.t === 'str' ? '' : ' = ' + (r.chance() ? zero('cpp', f) : r.lit('cpp', f))};`), '',
        ind(4, spaced(r.sample(methods, r.int(1, 2)))), '};');
    } },
    { id: 'gen-aggregate', name: 'data aggregation', make(rand) {
      const r = kit(rand), th = r.th, C = pascal(th.entity), e = th.entity, P = th.plural;
      const f = r.pick(th.nums), g = r.pick(th.nums.filter((x) => x !== f)), s = r.pick(th.strs);
      const fs = [th.lab, ...r.shuffle([f, g, s])];
      const head = ['#include <string>', '#include <vector>', '', cppStruct(r, fs, C), ''];
      const op = r.op();
      if (r.chance()) {
        return out(head, `double average${pascal(f.n)}(const std::vector<${C}>& ${P}, ${T.cpp[g.t]} limit) {`,
          '    double total = 0.0;', '    int count = 0;', `    for (const auto& ${e} : ${P}) {`,
          `        if (!(${e}.${camel(g.n)} ${op} limit)) continue;`, `        total += ${e}.${camel(f.n)};`, '        ++count;',
          '    }', '    return count == 0 ? 0.0 : total / count;', '}');
      }
      return out('#include <map>', head,
        `std::map<std::string, ${T.cpp[f.t]}> ${camel(f.n)}By${pascal(s.n)}(const std::vector<${C}>& ${P}) {`,
        `    std::map<std::string, ${T.cpp[f.t]}> totals;`, `    for (const auto& ${e} : ${P}) {`,
        r.chance() && `        if (${e}.${camel(g.n)} ${op} ${r.thr(g)}) continue;`,
        `        totals[${e}.${camel(s.n)}] += ${e}.${camel(f.n)};`, '    }', '    return totals;', '}');
    } },
    { id: 'gen-cli', name: 'command line tool', make(rand) {
      const r = kit(rand), th = r.th, n = r.pick(th.ints), lab = camel(th.label);
      const flag = r.pick(['verbose', 'dry_run', 'quiet', 'force']);
      return out('#include <iostream>', '#include <string>', '', 'int main(int argc, char* argv[]) {',
        `    std::string ${lab} = "${r.value(th.lab)}";`, `    int ${camel(n.n)} = ${r.value(n)};`, `    bool ${camel(flag)} = false;`,
        '    for (int i = 1; i < argc; ++i) {', '        std::string arg = argv[i];',
        `        if (arg == "--${n.n.replace(/_/g, '-')}" && i + 1 < argc) {`, `            ${camel(n.n)} = std::stoi(argv[++i]);`,
        `        } else if (arg == "--${flag.replace(/_/g, '-')}") {`, `            ${camel(flag)} = true;`,
        '        } else {', `            ${lab} = arg;`, '        }', '    }',
        `    if (${camel(flag)}) std::cerr << "${th.label}: " << ${lab} << "\\n";`,
        `    std::cout << ${lab} << " " << ${camel(n.n)} << std::endl;`, '    return 0;', '}');
    } },
    { id: 'gen-config', name: 'config', make(rand) {
      const r = kit(rand), th = r.th;
      const rows = [`constexpr int kMax${pascal(th.plural)} = ${r.int(5, 500)};`,
        ...r.settings(r.int(1, 3)).map(([k, lo, hi]) => `constexpr int k${pascal(k)} = ${r.int(lo, hi)};`),
        ...r.sample(th.fields, r.int(2, 3)).map((f) => (f.t === 'str'
          ? `constexpr const char* kDefault${pascal(f.n)} = "${r.value(f)}";`
          : `constexpr ${T.cpp[f.t]} kDefault${pascal(f.n)} = ${r.lit('cpp', f)};`)),
        `constexpr bool kDebug = ${r.pick(['true', 'false'])};`];
      const log = r.chance() && `inline const std::string kLogLevel = "${r.pick(['info', 'debug', 'warning'])}";`;
      return out(log && ['#include <string>', ''], `namespace ${th.machine}::config {`, '', rows, log,
        '', `}  // namespace ${th.machine}::config`);
    } },
    { id: 'gen-unit-test', name: 'unit test', make(rand) {
      const r = kit(rand), th = r.th, C = pascal(th.entity), e = th.entity, n = r.pick(th.ints), N = pascal(n.n);
      const start = r.int(n.lo, n.hi), add = r.int(1, 20), name = r.value(th.lab);
      const tests = [
        [`void testAdd${N}() {`, `    ${C} ${e}{"${name}", ${start}};`, `    ${e}.add${N}(${add});`,
          `    assert(${e}.${camel(n.n)} == ${start + add});`, '}'],
        ['void testIgnoresNegative() {', `    ${C} ${e}{"${name}", ${start}};`, `    ${e}.add${N}(-${add});`,
          `    assert(${e}.${camel(n.n)} == ${start});`, '}'],
      ];
      const picked = r.sample(tests, r.int(1, 2));
      return out('#include <cassert>', '#include <string>', '', `struct ${C} {`, `    std::string ${camel(th.label)};`,
        `    int ${camel(n.n)} = 0;`, `    void add${N}(int amount) { if (amount > 0) ${camel(n.n)} += amount; }`, '};', '',
        spaced(picked), '', 'int main() {', picked.map((t) => '    ' + t[0].slice(5, -2) + ';'), '}');
    } },
    { id: 'gen-validate', name: 'validation', make(rand) {
      const r = kit(rand), th = r.th, fs = r.fields(r.int(1, 3)), C = pascal(th.entity);
      const params = fs.map((f) => (f.t === 'str' ? `const std::string& ${camel(f.n)}` : `${T.cpp[f.t]} ${camel(f.n)}`));
      const checks = fs.map((f, i) => {
        const k = camel(f.n);
        if (i === 0) return `if (${k}.empty()) return "${f.n.replace(/_/g, ' ')} is required";`;
        if (isNum(f)) return [`if (${k} < ${f.lo} || ${k} > ${f.hi}) {`, `    return "${f.n.replace(/_/g, ' ')} out of range";`, '}'];
        if (f.t === 'str') return [`if (${f.opts.map((o) => `${k} != "${o}"`).join(' && ')}) {`, `    return "unknown ${f.n}";`, '}'];
        return `if (!${k}) return "${th.entity} must be ${f.n.replace(/^is_/, '').replace(/_/g, ' ')}";`;
      });
      return out('#include <optional>', '#include <string>', '',
        `std::optional<std::string> validate${C}(${params.join(', ')}) {`, ind(4, checks), '    return std::nullopt;', '}');
    } },
    { id: 'gen-enum-switch', name: 'enum switch', make(rand) {
      const r = kit(rand), th = r.th, st = r.states(), E = pascal(th.machine) + 'State';
      if (r.chance()) {
        return out(`enum class ${E} { ${st.map(pascal).join(', ')} };`, '', `${E} next(${E} state) {`, '    switch (state) {',
          st.map((s, i) => `        case ${E}::${pascal(s)}: return ${E}::${pascal(st[Math.min(i + 1, st.length - 1)])};`),
          '    }', '    return state;', '}');
      }
      return out(`enum class ${E} {`, st.map((s) => `    ${pascal(s)},`), '};', '', `const char* toString(${E} state) {`,
        '    switch (state) {', st.map((s) => [`        case ${E}::${pascal(s)}:`, `            return "${s}";`]),
        '    }', '    return "unknown";', '}');
    } },
    { id: 'gen-recursion', name: 'recursion', make(rand) {
      const r = kit(rand), th = r.th, f = r.pick(th.nums), N = r.pick(['Node', 'TreeNode', pascal(th.entity) + 'Node']);
      const k = camel(f.n), ty = T.cpp[f.t];
      const head = ['#include <string>', '#include <vector>', '', `struct ${N} {`, `    std::string ${camel(th.label)};`,
        `    ${ty} ${k} = ${zero('cpp', f)};`, `    std::vector<${N}> children;`, '};', ''];
      return r.pick([
        () => out(head, `${ty} total${pascal(f.n)}(const ${N}& node) {`, `    ${ty} total = node.${k};`,
          `    for (const auto& child : node.children) total += total${pascal(f.n)}(child);`, '    return total;', '}'),
        () => out(head, `int depth(const ${N}& node) {`, '    int deepest = 0;', '    for (const auto& child : node.children) {',
          '        deepest = std::max(deepest, depth(child));', '    }', '    return deepest + 1;', '}'),
        () => out(head, `int count${pascal(f.n)}Over(const ${N}& node, ${ty} limit) {`, `    int count = node.${k} ${r.op()} limit ? 1 : 0;`,
          '    for (const auto& child : node.children) {', `        count += count${pascal(f.n)}Over(child, limit);`, '    }',
          '    return count;', '}'),
      ])();
    } },
  ];

  const java = [
    { id: 'gen-class', name: 'class', make(rand) {
      const r = kit(rand), th = r.th, fs = r.fields(r.int(2, 3)), C = pascal(th.entity);
      const n = r.pick(fs.filter((f) => f.t === 'int')), g = r.pick(fs.filter(isNum));
      const decl = (f) => `${T.java[f.t]} ${camel(f.n)}`;
      const methods = [
        [`public ${T.java[g.t]} get${pascal(g.n)}() {`, `    return ${camel(g.n)};`, '}'],
        [`public void add${pascal(n.n)}(int amount) {`, '    if (amount <= 0) {',
          '        throw new IllegalArgumentException("amount must be positive");', '    }', `    ${camel(n.n)} += amount;`, '}'],
        [`public boolean is${pascal(r.pred())}() {`, `    return ${camel(g.n)} ${r.op()} ${r.thr(g)};`, '}'],
      ];
      return out(`public class ${C} {`, fs.map((f, i) => `    private ${i === 0 ? 'final ' : ''}${decl(f)};`), '',
        `    public ${C}(${fs.map(decl).join(', ')}) {`, fs.map((f) => `        this.${camel(f.n)} = ${camel(f.n)};`), '    }', '',
        ind(4, spaced(r.sample(methods, 2))), '}');
    } },
    { id: 'gen-stream', name: 'stream pipeline', make(rand) {
      const r = kit(rand), th = r.th, C = pascal(th.entity), P = th.plural, e = th.entity[0];
      const f = r.pick(th.nums), g = r.pick(th.nums.filter((x) => x !== f)), s = r.pick(th.strs), b = r.pick(th.bools);
      const acc = (x) => `${camel(x.n)}()`;
      const mode = r.pick(['avg', 'group', 'top']);
      if (mode === 'avg') {
        return out('import java.util.List;', '', `public static double average${pascal(f.n)}(List<${C}> ${P}, ${T.java[g.t]} limit) {`,
          `    return ${P}.stream()`, `        .filter(${e} -> ${e}.${acc(g)} ${r.op()} limit)`,
          `        .mapTo${f.t === 'int' ? 'Int' : 'Double'}(${C}::${camel(f.n)})`, '        .average()', '        .orElse(0.0);', '}');
      }
      if (mode === 'group') {
        return out('import java.util.List;', 'import java.util.Map;', 'import java.util.stream.Collectors;', '',
          `public static Map<String, ${f.t === 'int' ? 'Integer' : 'Double'}> ${camel(f.n)}By${pascal(s.n)}(List<${C}> ${P}) {`,
          `    return ${P}.stream()`, r.chance() && `        .filter(${C}::${camel(b.n)})`,
          `        .collect(Collectors.groupingBy(${C}::${camel(s.n)}, Collectors.summing${f.t === 'int' ? 'Int' : 'Double'}(${C}::${camel(f.n)})));`, '}');
      }
      return out('import java.util.Comparator;', 'import java.util.List;', '',
        `public static List<String> top${pascal(P)}(List<${C}> ${P}, int n) {`, `    return ${P}.stream()`,
        `        .sorted(Comparator.comparing${f.t === 'int' ? 'Int' : 'Double'}(${C}::${camel(f.n)})${r.chance() ? '.reversed()' : ''})`,
        '        .limit(n)', `        .map(${C}::${camel(th.label)})`, '        .toList();', '}');
    } },
    { id: 'gen-spring-controller', name: 'spring controller', make(rand) {
      const r = kit(rand), th = r.th, C = pascal(th.entity), e = th.entity, P = th.plural, s = r.pick(th.strs);
      const eps = {
        get: ['@GetMapping("/{id}")', `public ResponseEntity<${C}> get${C}(@PathVariable long id) {`,
          '    return repository.findById(id)', '        .map(ResponseEntity::ok)', '        .orElse(ResponseEntity.notFound().build());', '}'],
        list: ['@GetMapping', `public List<${C}> list${pascal(P)}(@RequestParam(required = false) String ${camel(s.n)}) {`,
          `    return ${camel(s.n)} == null ? repository.findAll() : repository.findBy${pascal(s.n)}(${camel(s.n)});`, '}'],
        create: ['@PostMapping', '@ResponseStatus(HttpStatus.CREATED)',
          `public ${C} create${C}(@Valid @RequestBody ${C} ${e}) {`, `    return repository.save(${e});`, '}'],
      };
      return out('@RestController', `@RequestMapping("/api/${P}")`, `public class ${C}Controller {`,
        `    private final ${C}Repository repository;`, '', `    public ${C}Controller(${C}Repository repository) {`,
        '        this.repository = repository;', '    }', '', ind(4, spaced(r.sample(Object.values(eps), r.int(1, 2)))), '}');
    } },
    { id: 'gen-config', name: 'config', make(rand) {
      const r = kit(rand), th = r.th, C = pascal(th.machine) + 'Config';
      return out(`public final class ${C} {`, `    public static final int MAX_${upper(th.plural)} = ${r.int(5, 500)};`,
        r.settings(r.int(1, 3)).map(([k, lo, hi]) => `    public static final int ${upper(k)} = ${r.int(lo, hi)};`),
        r.sample(th.fields, r.int(2, 3)).map((f) => `    public static final ${T.java[f.t]} DEFAULT_${upper(f.n)} = ${r.lit('java', f)};`),
        r.chance() && `    public static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(${r.int(5, 60)});`,
        '', `    private ${C}() {`, '    }', '}');
    } },
    { id: 'gen-unit-test', name: 'unit test', make(rand) {
      const r = kit(rand), th = r.th, C = pascal(th.entity), e = th.entity, n = r.pick(th.ints), N = pascal(n.n);
      const start = r.int(n.lo, n.hi), add = r.int(1, 20), name = r.value(th.lab);
      const tests = [
        ['@Test', `void add${N}IncreasesTotal() {`, `    ${e}.add${N}(${add});`, `    assertEquals(${start + add}, ${e}.get${N}());`, '}'],
        ['@Test', 'void rejectsNegativeAmount() {',
          `    assertThrows(IllegalArgumentException.class, () -> ${e}.add${N}(-${add}));`, '}'],
        ['@Test', `void keeps${pascal(th.label)}() {`, `    assertEquals("${name}", ${e}.get${pascal(th.label)}());`, '}'],
      ];
      return out('import static org.junit.jupiter.api.Assertions.*;', '', 'import org.junit.jupiter.api.BeforeEach;',
        'import org.junit.jupiter.api.Test;', '', `class ${C}Test {`, `    private ${C} ${e};`, '', '    @BeforeEach',
        '    void setUp() {', `        ${e} = new ${C}("${name}", ${start});`, '    }', '',
        ind(4, spaced(r.sample(tests, r.int(1, 2)))), '}');
    } },
    { id: 'gen-validate', name: 'validation', make(rand) {
      const r = kit(rand), th = r.th, C = pascal(th.entity), e = th.entity;
      const checks = r.sample(th.fields.filter((f) => f.t !== 'bool'), r.int(1, 3)).map((f) => {
        const a = `${e}.${camel(f.n)}()`;
        if (isNum(f)) return [`if (${a} < ${f.lo} || ${a} > ${f.hi}) {`, `    errors.add("${camel(f.n)} must be between ${f.lo} and ${f.hi}");`, '}'];
        return [`if (!Set.of(${r.sample(f.opts, 2).map(q).join(', ')}).contains(${a})) {`, `    errors.add("unknown ${camel(f.n)}: " + ${a});`, '}'];
      });
      return out('import java.util.ArrayList;', 'import java.util.List;', 'import java.util.Set;', '',
        `public static List<String> validate(${C} ${e}) {`, '    List<String> errors = new ArrayList<>();',
        `    if (${e}.${camel(th.label)}() == null || ${e}.${camel(th.label)}().isBlank()) {`,
        `        errors.add("${camel(th.label)} is required");`, '    }', ind(4, checks), '    return errors;', '}');
    } },
    { id: 'gen-enum-switch', name: 'enum switch', make(rand) {
      const r = kit(rand), th = r.th, st = r.states(), E = pascal(th.machine) + 'State';
      const body = r.chance()
        ? ['public boolean isTerminal() {', `    return this == ${upper(st[st.length - 1])};`, '}']
        : ['public String label() {', '    return name().toLowerCase().replace(\'_\', \' \');', '}'];
      return out(`public enum ${E} {`, `    ${st.map(upper).join(', ')};`, '', `    public ${E} next() {`, '        return switch (this) {',
        st.map((s, i) => `            case ${upper(s)} -> ${upper(st[Math.min(i + 1, st.length - 1)])};`), '        };', '    }', '',
        ind(4, body), '}');
    } },
    { id: 'gen-recursion', name: 'recursion', make(rand) {
      const r = kit(rand), th = r.th, f = r.pick(th.nums), N = r.pick(['Node', 'TreeNode', pascal(th.entity) + 'Node']);
      const ty = T.java[f.t], k = camel(f.n);
      const head = ['import java.util.List;', '', `record ${N}(String ${camel(th.label)}, ${ty} ${k}, List<${N}> children) {}`, ''];
      return r.pick([
        () => out(head, `static ${ty} total${pascal(f.n)}(${N} node) {`, `    ${ty} total = node.${k}();`,
          `    for (${N} child : node.children()) {`, `        total += total${pascal(f.n)}(child);`, '    }', '    return total;', '}'),
        () => out(head, `static int depth(${N} node) {`, '    int deepest = 0;', `    for (${N} child : node.children()) {`,
          '        deepest = Math.max(deepest, depth(child));', '    }', '    return deepest + 1;', '}'),
        () => out(head, `static Optional<${N}> find(${N} node, String ${camel(th.label)}) {`,
          `    if (node.${camel(th.label)}().equals(${camel(th.label)})) {`, '        return Optional.of(node);', '    }',
          `    for (${N} child : node.children()) {`, `        Optional<${N}> found = find(child, ${camel(th.label)});`,
          '        if (found.isPresent()) {', '            return found;', '        }', '    }', '    return Optional.empty();', '}'),
      ])();
    } },
  ];

  const goStruct = (fs, C, extra = []) => [`type ${C} struct {`,
    ind(4, align([...fs.map((f) => [pascal(f.n), T.go[f.t]]), ...extra])), '}'];

  const go = [
    { id: 'gen-struct', name: 'struct', make(rand) {
      const r = kit(rand), th = r.th, fs = r.fields(r.int(2, 4)), C = pascal(th.entity), rc = th.entity[0];
      const n = r.pick(fs.filter((f) => f.t === 'int')), g = r.pick(fs.filter(isNum));
      const methods = [
        [`func (${rc} *${C}) Add${pascal(n.n)}(amount int) error {`, '    if amount <= 0 {',
          `        return ${r.pick(['errors.New("amount must be positive")', 'fmt.Errorf("invalid amount %d", amount)'])}`, '    }',
          `    ${rc}.${pascal(n.n)} += amount`, '    return nil', '}'],
        [`func (${rc} ${C}) Is${pascal(r.pred())}() bool {`, `    return ${rc}.${pascal(g.n)} ${r.op()} ${r.thr(g)}`, '}'],
        [`func (${rc} ${C}) String() string {`, `    return fmt.Sprintf("%s (%v)", ${rc}.${pascal(th.label)}, ${rc}.${pascal(g.n)})`, '}'],
      ];
      return out(goStruct(fs, C), '', spaced(r.sample(methods, r.int(1, 2))));
    } },
    { id: 'gen-aggregate', name: 'data aggregation', make(rand) {
      const r = kit(rand), th = r.th, C = pascal(th.entity), P = th.plural, e = th.entity[0];
      const f = r.pick(th.nums), g = r.pick(th.nums.filter((x) => x !== f)), s = r.pick(th.strs), b = r.pick(th.bools);
      const F = pascal(f.n), G = pascal(g.n);
      if (r.chance()) {
        const op = r.op();
        return out(`func Average${F}(${P} []${C}, limit ${T.go[g.t]}) float64 {`, '    total, count := 0.0, 0',
          `    for _, ${e} := range ${P} {`, `        if !(${e}.${G} ${op} limit) {`, '            continue', '        }',
          `        total += ${f.t === 'int' ? `float64(${e}.${F})` : `${e}.${F}`}`, '        count++', '    }',
          '    if count == 0 {', '        return 0', '    }', '    return total / float64(count)', '}');
      }
      return out(`func ${F}By${pascal(s.n)}(${P} []${C}) map[string]${T.go[f.t]} {`,
        `    totals := make(map[string]${T.go[f.t]})`, `    for _, ${e} := range ${P} {`,
        r.chance() && [`        if !${e}.${pascal(b.n)} {`, '            continue', '        }'],
        `        totals[${e}.${pascal(s.n)}] += ${e}.${F}`, '    }', '    return totals', '}');
    } },
    { id: 'gen-http-handler', name: 'http handler', make(rand) {
      const r = kit(rand), th = r.th, C = pascal(th.entity), e = th.entity, P = th.plural;
      const json = ['    w.Header().Set("Content-Type", "application/json")'];
      const mode = r.pick(['get', 'list', 'create']);
      if (mode === 'get') {
        return out(`func (s *Server) handleGet${C}(w http.ResponseWriter, r *http.Request) {`, '    id := r.PathValue("id")',
          `    ${e}, err := s.store.Find${C}(r.Context(), id)`, '    if err != nil {',
          `        http.Error(w, "${e} not found", http.StatusNotFound)`, '        return', '    }', json,
          `    json.NewEncoder(w).Encode(${e})`, '}');
      }
      if (mode === 'list') {
        return out(`func (s *Server) handleList${pascal(P)}(w http.ResponseWriter, r *http.Request) {`,
          `    limit := ${r.int(10, 50)}`, '    if v, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil && v > 0 {',
          '        limit = v', '    }', `    ${P}, err := s.store.List${pascal(P)}(r.Context(), limit)`, '    if err != nil {',
          '        http.Error(w, err.Error(), http.StatusInternalServerError)', '        return', '    }', json,
          `    json.NewEncoder(w).Encode(${P})`, '}');
      }
      return out(`func (s *Server) handleCreate${C}(w http.ResponseWriter, r *http.Request) {`, `    var input ${C}`,
        '    if err := json.NewDecoder(r.Body).Decode(&input); err != nil {',
        '        http.Error(w, "invalid json", http.StatusBadRequest)', '        return', '    }',
        `    if err := s.store.Save${C}(r.Context(), &input); err != nil {`,
        '        http.Error(w, err.Error(), http.StatusInternalServerError)', '        return', '    }', json,
        '    w.WriteHeader(http.StatusCreated)', '    json.NewEncoder(w).Encode(input)', '}');
    } },
    { id: 'gen-config', name: 'config', make(rand) {
      const r = kit(rand), th = r.th;
      const consts = [[`Max${pascal(th.plural)}`, '=', String(r.int(5, 500))],
        ...r.settings(r.int(1, 3)).map(([k, lo, hi]) => [pascal(k), '=', String(r.int(lo, hi))]),
        ...r.sample(th.fields.filter((f) => f.t !== 'bool'), r.int(1, 2)).map((f) => [`Default${pascal(f.n)}`, '=', r.lit('go', f)])];
      return out('package config', '', 'import "time"', '', 'const (', ind(4, align(consts)), ')', '',
        `var RequestTimeout = ${r.int(2, 60)} * time.${r.pick(['Second', 'Millisecond'])}`,
        r.chance() && `var Debug = ${r.pick(['true', 'false'])}`);
    } },
    { id: 'gen-unit-test', name: 'unit test', make(rand) {
      const r = kit(rand), th = r.th, C = pascal(th.entity), g = r.pick(th.ints), G = pascal(g.n), p = r.pred();
      const t = Number(r.thr(g)), op = r.pick(['>=', '>']);
      const cases = r.sample([[q('well below'), String(g.lo), 'false'], [q('at threshold'), String(t), String(op === '>=')],
        [q('just above'), String(t + 1), 'true'], [q('maximum'), String(g.hi), 'true']], r.int(2, 4));
      return out(`func TestIs${pascal(p)}(t *testing.T) {`, '    tests := []struct {',
        ind(8, align([['name', 'string'], [camel(g.n), 'int'], ['want', 'bool']])), '    }{',
        cases.map((c) => `        {${c.join(', ')}},`), '    }', '    for _, tt := range tests {',
        `        got := ${C}{${G}: tt.${camel(g.n)}}.Is${pascal(p)}()`, '        if got != tt.want {',
        '            t.Errorf("%s: got %v, want %v", tt.name, got, tt.want)', '        }', '    }', '}');
    } },
    { id: 'gen-validate', name: 'validation', make(rand) {
      const r = kit(rand), th = r.th, C = pascal(th.entity), e = th.entity[0];
      const checks = r.sample(th.fields.filter((f) => f.t !== 'bool'), r.int(1, 3)).map((f) => {
        const a = `${e}.${pascal(f.n)}`;
        if (isNum(f)) return [`if ${a} < ${f.lo} || ${a} > ${f.hi} {`, `    return fmt.Errorf("${f.n} must be between ${f.lo} and ${f.hi}, got %v", ${a})`, '}'];
        return [`if ${f.opts.map((o) => `${a} != "${o}"`).join(' && ')} {`, `    return fmt.Errorf("unknown ${f.n} %q", ${a})`, '}'];
      });
      return out(`func Validate${C}(${e} ${C}) error {`, `    if strings.TrimSpace(${e}.${pascal(th.label)}) == "" {`,
        `        return errors.New("${th.label} is required")`, '    }', ind(4, checks), '    return nil', '}');
    } },
    { id: 'gen-enum-switch', name: 'enum switch', make(rand) {
      const r = kit(rand), th = r.th, st = r.states(), E = pascal(th.machine) + 'State', M = pascal(th.machine);
      const head = [`type ${E} int`, '', 'const (', `    ${M}${pascal(st[0])} ${E} = iota`, st.slice(1).map((s) => `    ${M}${pascal(s)}`), ')', ''];
      if (st.length <= 4 && r.chance()) {
        return out(head, `func (s ${E}) String() string {`, '    switch s {',
          st.map((s) => [`    case ${M}${pascal(s)}:`, `        return "${s}"`]), '    default:', '        return "unknown"', '    }', '}');
      }
      return out(head, `var ${th.machine}StateNames = [...]string{${st.map(q).join(', ')}}`, '',
        `func (s ${E}) String() string {`, `    if s < 0 || int(s) >= len(${th.machine}StateNames) {`, '        return "unknown"', '    }',
        `    return ${th.machine}StateNames[s]`, '}');
    } },
    { id: 'gen-recursion', name: 'recursion', make(rand) {
      const r = kit(rand), th = r.th, f = r.pick(th.nums), N = r.pick(['Node', 'TreeNode', pascal(th.entity) + 'Node']);
      const F = pascal(f.n), ty = T.go[f.t];
      const head = [goStruct([th.lab, f], N, [['Children', `[]*${N}`]]), ''];
      return r.pick([
        () => out(head, `func Total${F}(n *${N}) ${ty} {`, '    if n == nil {', '        return 0', '    }', `    total := n.${F}`,
          '    for _, child := range n.Children {', `        total += Total${F}(child)`, '    }', '    return total', '}'),
        () => out(head, `func Depth(n *${N}) int {`, '    deepest := 0', '    for _, child := range n.Children {',
          '        if d := Depth(child); d > deepest {', '            deepest = d', '        }', '    }', '    return deepest + 1', '}'),
        () => out(head, `func Find(n *${N}, ${camel(th.label)} string) *${N} {`, `    if n.${pascal(th.label)} == ${camel(th.label)} {`,
          '        return n', '    }', '    for _, child := range n.Children {',
          `        if found := Find(child, ${camel(th.label)}); found != nil {`, '            return found', '        }', '    }',
          '    return nil', '}'),
      ])();
    } },
  ];

  const rsAs = (f) => (f.t === 'int' ? ' as f64' : '');
  const rustStruct = (fs, C, derive) => [`#[derive(${derive})]`, `pub struct ${C} {`,
    fs.map((f) => `    pub ${f.n}: ${T.rust[f.t]},`), '}'];

  const rust = [
    { id: 'gen-struct', name: 'struct', make(rand) {
      const r = kit(rand), th = r.th, fs = r.fields(r.int(2, 3)), C = pascal(th.entity);
      const n = r.pick(fs.filter((f) => f.t === 'int')), g = r.pick(fs.filter(isNum));
      const methods = [
        [`pub fn add_${n.n}(&mut self, amount: u32) {`, `    self.${n.n} = self.${n.n}.saturating_add(amount);`, '}'],
        [`pub fn is_${r.pred()}(&self) -> bool {`, `    self.${g.n} ${r.op()} ${r.thr(g)}`, '}'],
      ];
      return out(rustStruct(fs, C, r.pick(['Debug, Clone', 'Debug, Clone, PartialEq', 'Debug, Default'])), '', `impl ${C} {`,
        `    pub fn new(${th.label}: &str) -> Self {`, '        Self {',
        fs.map((f, i) => `            ${f.n}: ${i === 0 ? th.label + '.to_string()' : r.chance() ? zero('rust', f) : r.lit('rust', f)},`),
        '        }', '    }', '', ind(4, spaced(r.sample(methods, fs.length > 3 ? 1 : r.int(1, 2)))), '}');
    } },
    { id: 'gen-aggregate', name: 'data aggregation', make(rand) {
      const r = kit(rand), th = r.th, C = pascal(th.entity), P = th.plural, e = th.entity[0];
      const f = r.pick(th.nums), g = r.pick(th.nums.filter((x) => x !== f)), s = r.pick(th.strs), b = r.pick(th.bools);
      const mode = r.pick(['avg', 'group', 'top']);
      if (mode === 'avg') {
        return out(`pub fn average_${f.n}(${P}: &[${C}], limit: ${T.rust[g.t]}) -> f64 {`,
          `    let selected: Vec<&${C}> = ${P}.iter().filter(|${e}| ${e}.${g.n} ${r.op()} limit).collect();`,
          '    if selected.is_empty() {', '        return 0.0;', '    }',
          `    let total: f64 = selected.iter().map(|${e}| ${e}.${f.n}${rsAs(f)}).sum();`, '    total / selected.len() as f64', '}');
      }
      if (mode === 'group') {
        return out('use std::collections::HashMap;', '',
          `pub fn ${f.n}_by_${s.n}(${P}: &[${C}]) -> HashMap<String, ${T.rust[f.t]}> {`, '    let mut totals = HashMap::new();',
          `    for ${e} in ${P}${r.chance() ? `.iter().filter(|${e}| ${e}.${b.n})` : ''} {`,
          `        *totals.entry(${e}.${s.n}.clone()).or_insert(${zero('rust', f)}) += ${e}.${f.n};`, '    }', '    totals', '}');
      }
      const cmp = f.t === 'int' ? `b.${f.n}.cmp(&a.${f.n})` : `b.${f.n}.total_cmp(&a.${f.n})`;
      return out(`pub fn top_${P}(${P}: &[${C}], n: usize) -> Vec<&str> {`, `    let mut sorted: Vec<&${C}> = ${P}.iter().collect();`,
        `    sorted.sort_by(|a, b| ${cmp});`, `    sorted.into_iter().take(n).map(|${e}| ${e}.${th.label}.as_str()).collect()`, '}', '',
        r.chance() ? `// top_${P}(&all, ${r.int(3, 10)})` : `// keeps the input order for equal ${f.n.replace(/_/g, ' ')}`);
    } },
    { id: 'gen-axum-handler', name: 'axum handler', make(rand) {
      const r = kit(rand), th = r.th, C = pascal(th.entity), e = th.entity, P = th.plural;
      const mode = r.pick(['get', 'list', 'create']);
      const use = (ex, more = '') => `use axum::{extract::{${ex}}, ${more}Json};`;
      if (mode === 'get') {
        return out(use('Path, State', 'http::StatusCode, '), '', `pub async fn get_${e}(`, '    State(db): State<Db>,', '    Path(id): Path<u64>,',
          `) -> Result<Json<${C}>, StatusCode> {`, `    let ${e} = db`, `        .find_${e}(id)`, '        .await',
          '        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;', `    ${e}.map(Json).ok_or(StatusCode::NOT_FOUND)`, '}');
      }
      if (mode === 'list') {
        return out(use('Query, State'), 'use serde::Deserialize;', '', '#[derive(Deserialize)]', 'pub struct ListParams {', '    limit: Option<usize>,', '}', '',
          `pub async fn list_${P}(State(db): State<Db>, Query(params): Query<ListParams>) -> Json<Vec<${C}>> {`,
          `    let limit = params.limit.unwrap_or(${r.int(10, 50)}).min(${r.int(100, 500)});`,
          `    Json(db.list_${P}(limit).await)`, '}');
      }
      return out(use('State', 'http::StatusCode, '), '', `pub async fn create_${e}(`, '    State(db): State<Db>,', `    Json(input): Json<New${C}>,`,
        `) -> Result<(StatusCode, Json<${C}>), StatusCode> {`, `    if input.${th.label}.trim().is_empty() {`,
        '        return Err(StatusCode::UNPROCESSABLE_ENTITY);', '    }',
        `    let ${e} = db.insert_${e}(input).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;`,
        `    Ok((StatusCode::CREATED, Json(${e})))`, '}');
    } },
    { id: 'gen-config', name: 'config', make(rand) {
      const r = kit(rand), th = r.th;
      return out('use std::time::Duration;', '', `pub const MAX_${upper(th.plural)}: usize = ${r.int(5, 500)};`,
        r.settings(r.int(1, 3)).map(([k, lo, hi]) => `pub const ${upper(k)}: u32 = ${r.int(lo, hi)};`),
        r.sample(th.fields, r.int(2, 3)).map((f) => (f.t === 'str'
          ? `pub const DEFAULT_${upper(f.n)}: &str = "${r.value(f)}";`
          : `pub const DEFAULT_${upper(f.n)}: ${T.rust[f.t]} = ${r.lit('rust', f)};`)),
        `pub const REQUEST_TIMEOUT: Duration = Duration::from_${r.pick(['secs', 'millis'])}(${r.int(2, 60)});`,
        r.chance() && `pub static LOG_LEVEL: &str = "${r.pick(['info', 'debug', 'warn'])}";`);
    } },
    { id: 'gen-unit-test', name: 'unit test', make(rand) {
      const r = kit(rand), th = r.th, C = pascal(th.entity), e = th.entity, n = r.pick(th.ints);
      const start = r.int(n.lo, n.hi), add = r.int(1, 20), name = r.value(th.lab);
      const tests = [
        ['#[test]', `fn add_${n.n}_increases_total() {`, `    let mut ${e} = ${C}::new("${name}", ${start});`,
          `    ${e}.add_${n.n}(${add});`, `    assert_eq!(${e}.${n.n}, ${start + add});`, '}'],
        ['#[test]', `fn keeps_${th.label}() {`, `    let ${e} = ${C}::new("${name}", ${start});`,
          `    assert_eq!(${e}.${th.label}, "${name}");`, '}'],
        ['#[test]', 'fn saturates_instead_of_overflowing() {', `    let mut ${e} = ${C}::new("${name}", u32::MAX);`,
          `    ${e}.add_${n.n}(${add});`, `    assert_eq!(${e}.${n.n}, u32::MAX);`, '}'],
      ];
      return out('#[cfg(test)]', 'mod tests {', '    use super::*;', '', ind(4, spaced(r.sample(tests, r.int(1, 3)))), '}');
    } },
    { id: 'gen-validate', name: 'validation', make(rand) {
      const r = kit(rand), th = r.th, C = pascal(th.entity), e = th.entity;
      const checks = r.sample(th.fields.filter((f) => f.t !== 'bool'), r.int(1, 3)).map((f) => {
        const a = `${e}.${f.n}`;
        if (isNum(f)) {
          const rng = f.t === 'int' ? `${Math.max(0, f.lo)}..=${f.hi}` : `${fmtF(f.lo)}..=${fmtF(f.hi)}`;
          return [`if !(${rng}).contains(&${a}) {`, `    return Err(format!("${f.n} out of range: {}", ${a}));`, '}'];
        }
        return [`if ![${r.sample(f.opts, 2).map(q).join(', ')}].contains(&${a}.as_str()) {`,
          `    return Err(format!("unknown ${f.n}: {}", ${a}));`, '}'];
      });
      return out(`pub fn validate_${e}(${e}: &${C}) -> Result<(), String> {`, `    if ${e}.${th.label}.trim().is_empty() {`,
        `        return Err("${th.label} is required".to_string());`, '    }', ind(4, checks), '    Ok(())', '}');
    } },
    { id: 'gen-enum-match', name: 'enum match', make(rand) {
      const r = kit(rand), th = r.th, st = r.states(), E = pascal(th.machine) + 'State', S = r.pick(['Self', E]);
      const fn = r.chance()
        ? ['pub fn next(self) -> Self {', '    match self {',
          st.map((s, i) => `        ${S}::${pascal(s)} => ${S}::${pascal(st[Math.min(i + 1, st.length - 1)])},`), '    }', '}']
        : ['pub fn label(&self) -> &\'static str {', '    match self {', st.map((s) => `        ${S}::${pascal(s)} => "${s}",`), '    }', '}'];
      return out('#[derive(Debug, Clone, Copy, PartialEq, Eq)]', `pub enum ${E} {`, st.map((s) => `    ${pascal(s)},`), '}', '',
        `impl ${E} {`, ind(4, fn), '}');
    } },
    { id: 'gen-recursion', name: 'recursion', make(rand) {
      const r = kit(rand), th = r.th, f = r.pick(th.nums), N = r.pick(['Node', 'TreeNode', pascal(th.entity) + 'Node']);
      const ty = T.rust[f.t];
      const head = ['pub struct ' + N + ' {', `    pub ${th.label}: String,`, `    pub ${f.n}: ${ty},`, `    pub children: Vec<${N}>,`, '}', ''];
      return r.pick([
        () => out(head, `pub fn total_${f.n}(node: &${N}) -> ${ty} {`,
          `    node.${f.n} + node.children.iter().map(total_${f.n}).sum::<${ty}>()`, '}'),
        () => out(head, `pub fn depth(node: &${N}) -> usize {`, '    1 + node.children.iter().map(depth).max().unwrap_or(0)', '}'),
        () => out(head, `pub fn find<'a>(node: &'a ${N}, ${th.label}: &str) -> Option<&'a ${N}> {`,
          `    if node.${th.label} == ${th.label} {`, '        return Some(node);', '    }',
          `    node.children.iter().find_map(|child| find(child, ${th.label}))`, '}'),
      ])();
    } },
  ];

  return { python, javascript, cpp, java, go, rust };
})();
