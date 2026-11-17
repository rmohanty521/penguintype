// Build-mode projects: each part is one typing test; parts run joined in order as one classic script.
// Pattern: part 1 owns the canvas, a loop and two lists (updates/steps and draws); later parts push into them.
// A few hooks (ballLost) are plain functions that a later part redeclares; the last declaration wins.
// Code must not contain backticks or "${".
const PROJECTS = [
  {
    id: 'snake',
    name: 'snake',
    blurb: 'eat, grow longer, and do not bite your own tail.',
    parts: [
      {
        name: 'canvas and game loop',
        code: String.raw`
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const CELL = 20;
const COLS = canvas.width / CELL;
const ROWS = canvas.height / CELL;
const steps = [];
const draws = [];
let running = true;
let tickMs = 150;
let nextStep = 0;

function loop(time) {
  if (time >= nextStep) {
    nextStep = time + tickMs;
    if (running) steps.forEach((step) => step());
  }
  ctx.fillStyle = THEME.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  draws.forEach((draw) => draw());
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);`,
      },
      {
        name: 'draw the board',
        code: String.raw`
function drawBoard() {
  ctx.fillStyle = THEME.panel;
  for (let y = 0; y < ROWS; y++) {
    for (let x = y % 2; x < COLS; x += 2) {
      ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
    }
  }
}

draws.push(drawBoard);`,
      },
      {
        name: 'draw the snake',
        code: String.raw`
let snake = [
  { x: 10, y: 10 },
  { x: 9, y: 10 },
  { x: 8, y: 10 },
];

function drawSnake() {
  snake.forEach((part, i) => {
    ctx.fillStyle = i === 0 ? THEME.text : THEME.main;
    ctx.fillRect(part.x * CELL + 1, part.y * CELL + 1, CELL - 2, CELL - 2);
  });
}

draws.push(drawSnake);`,
      },
      {
        name: 'move the snake',
        code: String.raw`
let dir = { x: 1, y: 0 };

function wrap(value, size) {
  return (value + size) % size;
}

function moveSnake() {
  const head = snake[0];
  snake.unshift({
    x: wrap(head.x + dir.x, COLS),
    y: wrap(head.y + dir.y, ROWS),
  });
  snake.pop();
}

steps.push(moveSnake);`,
      },
      {
        name: 'steer with the keys',
        code: String.raw`
const KEY_DIRS = {
  arrowup: { x: 0, y: -1 },
  arrowdown: { x: 0, y: 1 },
  arrowleft: { x: -1, y: 0 },
  arrowright: { x: 1, y: 0 },
};
KEY_DIRS.w = KEY_DIRS.arrowup;
KEY_DIRS.s = KEY_DIRS.arrowdown;
KEY_DIRS.a = KEY_DIRS.arrowleft;
KEY_DIRS.d = KEY_DIRS.arrowright;

window.addEventListener('keydown', (event) => {
  const next = KEY_DIRS[event.key.toLowerCase()];
  if (!next) return;
  event.preventDefault();
  const head = snake[0];
  const neck = snake[1];
  const x = wrap(head.x + next.x, COLS);
  const y = wrap(head.y + next.y, ROWS);
  if (x !== neck.x || y !== neck.y) dir = next;
});`,
      },
      {
        name: 'eat food and grow',
        code: String.raw`
function sameCell(a, b) {
  return a.x === b.x && a.y === b.y;
}

function randomCell() {
  return { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
}
let food = randomCell();

function eatFood() {
  if (!sameCell(snake[0], food)) return;
  snake.push({ ...snake[snake.length - 1] });
  food = randomCell();
}

function drawFood() {
  ctx.fillStyle = THEME.error;
  ctx.fillRect(food.x * CELL + 4, food.y * CELL + 4, CELL - 8, CELL - 8);
}

steps.push(eatFood);
draws.push(drawFood);`,
      },
      {
        name: 'crash into yourself',
        code: String.raw`
function checkCrash() {
  const head = snake[0];
  if (snake.slice(1).some((part) => sameCell(part, head))) running = false;
}

function drawGameOver() {
  if (running) return;
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = THEME.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalAlpha = 1;
  ctx.fillStyle = THEME.error;
  ctx.font = 'bold 32px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('game over', canvas.width / 2, canvas.height / 2);
}

steps.push(checkCrash);
draws.push(drawGameOver);`,
      },
      {
        name: 'score and restart',
        code: String.raw`
const score = () => snake.length - 3;

function restart() {
  snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
  dir = { x: 1, y: 0 };
  food = randomCell();
  running = true;
}

window.addEventListener('keydown', (event) => {
  if (!running && (event.key === ' ' || event.key === 'Enter')) restart();
});

function drawScore() {
  ctx.fillStyle = THEME.text;
  ctx.font = '16px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('score ' + score(), 10, 22);
}

draws.push(drawScore);`,
      },
      {
        name: 'speed up and best score',
        code: String.raw`
let best = 0;

function speedUp() {
  tickMs = Math.max(55, 150 - score() * 5);
  best = Math.max(best, score());
}

function drawBest() {
  ctx.fillStyle = THEME.sub;
  ctx.font = '16px monospace';
  ctx.textAlign = 'right';
  ctx.fillText('best ' + best, canvas.width - 10, 22);
  if (running) return;
  ctx.textAlign = 'center';
  ctx.fillText('space to play again', canvas.width / 2, canvas.height / 2 + 36);
}

steps.push(speedUp);
draws.push(drawBest);`,
      },
    ],
  },
  {
    id: 'breakout',
    name: 'breakout',
    blurb: 'bounce the ball off your paddle and clear every brick.',
    parts: [
      {
        name: 'canvas and game loop',
        code: String.raw`
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;
const updates = [];
const draws = [];
let running = true;
let lag = 0;
let last = 0;

function loop(time) {
  lag = Math.min(lag + time - last, 100);
  last = time;
  for (; lag >= 16; lag -= 16) {
    if (running) updates.forEach((update) => update());
  }
  ctx.fillStyle = THEME.bg;
  ctx.fillRect(0, 0, W, H);
  draws.forEach((draw) => draw());
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);`,
      },
      {
        name: 'the paddle',
        code: String.raw`
const paddle = { x: W / 2 - 40, y: H - 30, w: 80, h: 12 };
const held = {};

function onKey(event) {
  held[event.key.toLowerCase()] = event.type === 'keydown';
}
window.addEventListener('keydown', onKey);
window.addEventListener('keyup', onKey);

function movePaddle() {
  if (held.arrowleft || held.a) paddle.x -= 7;
  if (held.arrowright || held.d) paddle.x += 7;
  paddle.x = Math.max(0, Math.min(W - paddle.w, paddle.x));
}

function drawPaddle() {
  ctx.fillStyle = THEME.main;
  ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);
}

updates.push(movePaddle);
draws.push(drawPaddle);`,
      },
      {
        name: 'the ball',
        code: String.raw`
const ball = { x: W / 2, y: H - 80, r: 6, vx: 3, vy: -4 };

function moveBall() {
  ball.x += ball.vx;
  ball.y += ball.vy;
  if (ball.x < ball.r) ball.vx = Math.abs(ball.vx);
  if (ball.x > W - ball.r) ball.vx = -Math.abs(ball.vx);
  if (ball.y < ball.r) ball.vy = Math.abs(ball.vy);
  if (ball.y > H - ball.r) ball.vy = -Math.abs(ball.vy);
}

function drawBall() {
  ctx.fillStyle = THEME.text;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.fill();
}

updates.push(moveBall);
draws.push(drawBall);`,
      },
      {
        name: 'bounce off the paddle',
        code: String.raw`
function hitPaddle() {
  const overX = ball.x + ball.r > paddle.x && ball.x - ball.r < paddle.x + paddle.w;
  const overY = ball.y + ball.r > paddle.y && ball.y - ball.r < paddle.y + paddle.h;
  if (!overX || !overY || ball.vy < 0) return;
  const speed = Math.hypot(ball.vx, ball.vy);
  const offset = (ball.x - paddle.x) / paddle.w - 0.5;
  ball.vx = speed * Math.sin(offset * 2.2);
  ball.vy = -speed * Math.cos(offset * 2.2);
}

updates.push(hitPaddle);`,
      },
      {
        name: 'lose the ball',
        code: String.raw`
let ballSpeed = 5;

function resetBall() {
  ball.x = paddle.x + paddle.w / 2;
  ball.y = paddle.y - 40;
  ball.vx = ballSpeed * (Math.random() < 0.5 ? -0.6 : 0.6);
  ball.vy = -ballSpeed * 0.8;
}

function ballLost() {
  resetBall();
}

function checkLost() {
  if (ball.y > paddle.y + paddle.h) ballLost();
}

updates.push(checkLost);`,
      },
      {
        name: 'build the bricks',
        code: String.raw`
const ROW_COLORS = [THEME.error, THEME.main, THEME.text, THEME.main, THEME.sub];
const BRICK_W = W / 8;
const BRICK_H = 18;
let bricks = [];

function buildBricks() {
  bricks = [];
  for (let i = 0; i < 8 * ROW_COLORS.length; i++) {
    const row = Math.floor(i / 8);
    bricks.push({ x: (i % 8) * BRICK_W, y: 50 + row * BRICK_H, color: ROW_COLORS[row] });
  }
}

function drawBricks() {
  bricks.forEach((brick) => {
    ctx.fillStyle = brick.color;
    ctx.fillRect(brick.x + 2, brick.y + 2, BRICK_W - 4, BRICK_H - 4);
  });
}

buildBricks();
draws.push(drawBricks);`,
      },
      {
        name: 'smash the bricks',
        code: String.raw`
let score = 0;

function touches(brick) {
  return ball.x + ball.r > brick.x && ball.x - ball.r < brick.x + BRICK_W &&
    ball.y + ball.r > brick.y && ball.y - ball.r < brick.y + BRICK_H;
}

function hitBricks() {
  const index = bricks.findIndex(touches);
  if (index === -1) return;
  const brick = bricks[index];
  bricks.splice(index, 1);
  score += 10;
  if (ball.x < brick.x || ball.x > brick.x + BRICK_W) ball.vx *= -1;
  else ball.vy *= -1;
}

updates.push(hitBricks);`,
      },
      {
        name: 'lives and game over',
        code: String.raw`
let lives = 3;

function ballLost() {
  lives -= 1;
  if (lives <= 0) running = false;
  resetBall();
}

function drawHud() {
  ctx.fillStyle = THEME.text;
  ctx.font = '16px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('score ' + score + '   lives ' + lives, 10, 30);
  if (running) return;
  ctx.fillStyle = THEME.error;
  ctx.textAlign = 'center';
  ctx.fillText('game over, space to restart', W / 2, H / 2 + 40);
}

draws.push(drawHud);`,
      },
      {
        name: 'restart and next level',
        code: String.raw`
function restart() {
  score = 0;
  lives = 3;
  ballSpeed = 5;
  buildBricks();
  resetBall();
  running = true;
}

function nextLevel() {
  if (bricks.length > 0) return;
  ballSpeed = Math.min(10, ballSpeed + 1);
  buildBricks();
  resetBall();
}

window.addEventListener('keydown', (event) => {
  if (!running && (event.key === ' ' || event.key === 'Enter')) restart();
});

updates.push(nextLevel);`,
      },
    ],
  },
  {
    id: 'flyer',
    name: 'flyer',
    blurb: 'flap through the gaps in the walls for as long as you can.',
    parts: [
      {
        name: 'canvas and game loop',
        code: String.raw`
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;
const updates = [];
const draws = [];
let running = true;
let lag = 0;
let last = 0;

function loop(time) {
  lag = Math.min(lag + time - last, 100);
  last = time;
  for (; lag >= 16; lag -= 16) {
    if (running) updates.forEach((update) => update());
  }
  ctx.fillStyle = THEME.bg;
  ctx.fillRect(0, 0, W, H);
  draws.forEach((draw) => draw());
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);`,
      },
      {
        name: 'ground and bird',
        code: String.raw`
const GROUND = H - 40;
const bird = { x: 90, y: H / 2, r: 12, vy: 0 };

function drawGround() {
  ctx.fillStyle = THEME.panel;
  ctx.fillRect(0, GROUND, W, H - GROUND);
}

function drawBird() {
  ctx.fillStyle = THEME.main;
  ctx.beginPath();
  ctx.arc(bird.x, bird.y, bird.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = THEME.bg;
  ctx.fillRect(bird.x + 3, bird.y - 6, 4, 4);
}

draws.push(drawGround);
draws.push(drawBird);`,
      },
      {
        name: 'gravity and flap',
        code: String.raw`
const GRAVITY = 0.35;
let started = false;

function flap() {
  if (!running) return;
  started = true;
  bird.vy = -6.5;
}

window.addEventListener('keydown', (event) => {
  if ([' ', 'arrowup', 'w'].includes(event.key.toLowerCase())) flap();
});
canvas.addEventListener('mousedown', flap);

function fall() {
  if (!started) return;
  bird.vy += GRAVITY;
  bird.y += bird.vy;
  bird.y = Math.max(bird.r, Math.min(GROUND - bird.r, bird.y));
}

updates.push(fall);`,
      },
      {
        name: 'the walls',
        code: String.raw`
const PIPE_W = 52;
let pipes = [];
let pipeGap = 130;

function addPipe(x) {
  const top = 40 + Math.random() * (GROUND - pipeGap - 80);
  pipes.push({ x, top, gap: pipeGap, passed: false });
}

function drawPipes() {
  ctx.fillStyle = THEME.sub;
  pipes.forEach((pipe) => {
    ctx.fillRect(pipe.x, 0, PIPE_W, pipe.top);
    ctx.fillRect(pipe.x, pipe.top + pipe.gap, PIPE_W, GROUND - pipe.top - pipe.gap);
  });
}

addPipe(W - 100);
draws.push(drawPipes);`,
      },
      {
        name: 'scroll the walls',
        code: String.raw`
let pipeSpeed = 2.2;
let nextPipe = 0;

function movePipes() {
  if (!started) return;
  nextPipe -= pipeSpeed;
  if (nextPipe <= 0) {
    addPipe(W);
    nextPipe = 200;
  }
  pipes.forEach((pipe) => {
    pipe.x -= pipeSpeed;
  });
  pipes = pipes.filter((pipe) => pipe.x > -PIPE_W);
}

updates.push(movePipes);`,
      },
      {
        name: 'crash',
        code: String.raw`
function hitsPipe(pipe) {
  const overX = bird.x + bird.r > pipe.x && bird.x - bird.r < pipe.x + PIPE_W;
  const inGap = bird.y - bird.r > pipe.top && bird.y + bird.r < pipe.top + pipe.gap;
  return overX && !inGap;
}

function checkCrash() {
  if (bird.y + bird.r >= GROUND || pipes.some(hitsPipe)) running = false;
}

function drawCrash() {
  if (running) return;
  ctx.fillStyle = THEME.error;
  ctx.font = 'bold 32px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('crashed', W / 2, H / 2 - 20);
}

updates.push(checkCrash);
draws.push(drawCrash);`,
      },
      {
        name: 'keep score',
        code: String.raw`
let score = 0;

function countScore() {
  pipes.forEach((pipe) => {
    if (!pipe.passed && pipe.x + PIPE_W < bird.x - bird.r) {
      pipe.passed = true;
      score += 1;
    }
  });
}

function drawScore() {
  ctx.fillStyle = THEME.text;
  ctx.font = 'bold 40px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(score, W / 2, 70);
}

updates.push(countScore);
draws.push(drawScore);`,
      },
      {
        name: 'restart and best',
        code: String.raw`
let best = 0;
function restart() {
  best = Math.max(best, score);
  bird.y = H / 2;
  pipes = [];
  score = 0;
  started = false;
  running = true;
}

window.addEventListener('keydown', (event) => {
  if (!running && (event.key === ' ' || event.key === 'Enter')) restart();
});

function drawHints() {
  ctx.fillStyle = THEME.text;
  ctx.font = '16px monospace';
  ctx.textAlign = 'center';
  if (!started) ctx.fillText('space or click to flap', W / 2, H / 2 + 50);
  if (!running) ctx.fillText('best ' + Math.max(best, score) + ', space to retry', W / 2, H / 2 + 20);
}
draws.push(drawHints);`,
      },
      {
        name: 'faster and tighter',
        code: String.raw`
let groundShift = 0;

function speedUp() {
  pipeSpeed = 2.2 + score * 0.08;
  pipeGap = Math.max(95, 130 - score * 2);
  if (started) groundShift = (groundShift + pipeSpeed) % 24;
}

function drawStripes() {
  ctx.fillStyle = THEME.sub;
  for (let x = -groundShift; x < W; x += 24) {
    ctx.fillRect(x, GROUND, 12, 4);
  }
}

updates.push(speedUp);
draws.push(drawStripes);`,
      },
    ],
  },
];
