// Typing engine: pure state, no DOM. Loaded as a classic script (works from file://) and by node for the check.
// typed[i]: true = correct, false = wrong, 'auto' = indentation filled in for you after a newline.
// free = zen mode: no target text, whatever you type becomes the text and is always correct.

function createTest(text, free = false) {
  return { text, free, typed: [], start: 0, end: 0, keys: 0, correctKeys: 0, log: [] }; // log: [msSinceStart, ok] per key
}

function press(t, key, now) {
  if (t.end) return;
  if (!t.typed.length && key === '\n') return; // snippets never start with a newline; lets tab+enter flow work
  if (!t.start) t.start = now;
  if (t.free) t.text += key;
  const expected = t.text[t.typed.length];
  const ok = key === expected;
  t.keys++;
  if (ok) t.correctKeys++;
  t.log.push([now - t.start, ok]);
  t.typed.push(ok);
  if (t.free && key === '\n') {
    // like an editor: keep the previous line's indentation
    const prev = t.text.slice(0, -1).split('\n').pop();
    const indent = prev.length - prev.trimStart().length;
    for (let i = 0; i < indent; i++) { t.text += ' '; t.typed.push('auto'); }
  } else if (expected === '\n') {
    while (t.text[t.typed.length] === ' ') t.typed.push('auto');
  }
  if (!t.free && t.typed.length === t.text.length) t.end = now;
}

function backspace(t) {
  if (t.end) return;
  const pop = () => { t.typed.pop(); if (t.free) t.text = t.text.slice(0, -1); };
  while (t.typed[t.typed.length - 1] === 'auto') pop();
  if (t.typed.length) pop();
}

function stats(t, now) {
  const typed = t.typed.filter((x) => x !== 'auto');
  const correct = typed.filter((x) => x === true).length;
  const ms = t.start ? (t.end || now) - t.start : 0;
  const min = ms / 60000;
  return {
    wpm: min ? correct / 5 / min : 0,
    raw: min ? typed.length / 5 / min : 0,
    acc: t.keys ? (t.correctKeys / t.keys) * 100 : 100,
    correct,
    incorrect: typed.length - correct,
    seconds: ms / 1000,
  };
}

// Ends a running test early (timed mode). The end is pinned to start + limit so the time is exact.
function stop(t, limitMs) {
  if (t.start && !t.end) t.end = t.start + limitMs;
}

// One point per second of a finished test: running wpm, raw speed within that second, errors within it.
// The last bucket stretches or shrinks to cover the leftover fraction of a second.
function history(t) {
  const total = (t.end - t.start) / 1000;
  const n = Math.max(1, Math.round(total));
  const points = [];
  for (let s = 1; s <= n; s++) {
    const from = (s - 1) * 1000;
    const len = s === n ? total - (s - 1) : 1;
    const to = from + len * 1000;
    const upto = t.log.filter(([ms]) => ms <= to);
    const inside = upto.filter(([ms]) => ms > from || (s === 1 && ms === 0));
    points.push({
      s,
      wpm: upto.filter(([, ok]) => ok).length / 5 / ((s - 1 + len) / 60),
      raw: inside.length / 5 / (len / 60),
      errors: inside.filter(([, ok]) => !ok).length,
    });
  }
  return points;
}

if (typeof module !== 'undefined') module.exports = { createTest, press, backspace, stats, stop, history };
