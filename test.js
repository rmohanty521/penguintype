// Run: node test.js
const assert = require('assert');
const { createTest, press, backspace, stats, stop, history } = require('./engine.js');

const t = createTest('if x:\n    y\nz');
press(t, '\n', 500);
assert.strictEqual(t.typed.length + t.keys + t.start, 0, 'enter before typing anything is ignored');
for (const c of 'if x:\n') press(t, c, 1000);
assert.strictEqual(t.typed.length, 10, 'indent after newline is auto-filled');

press(t, 'q', 2000);
assert.strictEqual(t.typed[10], false, 'wrong char marked');
backspace(t);
press(t, 'y', 2000);
press(t, '\n', 2000);
press(t, 'z', 61000);
assert.ok(t.end, 'test ends on last char');

const s = stats(t, 99999);
assert.strictEqual(s.correct, 9, 'auto indent not counted as typed');
assert.strictEqual(s.seconds, 60);
assert.strictEqual(Math.round(s.acc), 90, '1 wrong key out of 10');

const b = createTest('a:\n  b');
for (const c of 'a:\n') press(b, c, 1);
backspace(b);
assert.strictEqual(b.typed.length, 2, 'backspace jumps over auto indent and the newline');

// timed: 10 correct keys in second 1, 5 correct + 1 wrong in second 2, stopped at 2s
const h = createTest('x'.repeat(100));
for (let i = 0; i < 10; i++) press(h, 'x', 1000 + i * 90);
for (let i = 0; i < 5; i++) press(h, 'x', 2050 + i * 150);
press(h, 'q', 2900);
stop(h, 2000);
press(h, 'x', 3500);
assert.strictEqual(h.keys, 16, 'no typing after stop');
const pts = history(h);
assert.strictEqual(pts.length, 2);
assert.strictEqual(pts[0].raw, 10 / 5 * 60, 'second 1 raw = 120');
assert.strictEqual(pts[1].errors, 1);
assert.strictEqual(pts[1].wpm, 15 / 5 / (2 / 60), 'running wpm at 2s counts correct keys only');
assert.strictEqual(Math.round(stats(h).wpm), 90);

// zen: whatever you type is the text, Enter keeps the previous line's indentation, backspace undoes it
const z = createTest('', true);
for (const c of '  ab\n') press(z, c, 10);
assert.strictEqual(z.text, '  ab\n  ', 'zen copies indentation');
press(z, 'c', 20);
backspace(z);
backspace(z);
assert.strictEqual(z.text, '  ab', 'backspace removes the char, then the auto indent and newline');
assert.strictEqual(z.end, 0, 'zen never ends by itself');
assert.strictEqual(stats(z, 1000).acc, 100);

console.log('ok');
