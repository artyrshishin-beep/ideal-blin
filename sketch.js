// ===== Идеальный блин v8 — кнопка "НАЧАТЬ" =====

let points = [];
let prevPoint = null;

const BG = [255, 248, 230];

const MIN_POINTS = 80;
const MIN_PATH_LEN = 500;

const AUTO_CLOSE_GAP = 160;
const AUTO_CLOSE_STEP = 6;

const CALIBRATION_K = 140;

// Кисть
let STROKE_W = 20;
let FILL_STEP = 1.7;

let cnv;

// антиобрыв
let isDrawing = false;
let lastPointer = { x: 0, y: 0 };
let rafId = null;

// состояния
let state = "idle"; // idle | ready | drawing | result | message
let resetTimerId = null;

// кнопка
let startBtn = null;

function setup() {
  cnv = createCanvas(windowWidth, windowHeight);
  pixelDensity(1);

  const el = cnv.elt;
  el.style.touchAction = "none";

  el.addEventListener("pointerdown", onPointerDown, { passive: false });
  el.addEventListener("pointermove", onPointerMove, { passive: false });
  window.addEventListener("pointerup", onPointerUp, { passive: false });

  resetToIdle();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  if (state === "idle" || state === "ready") {
    drawIdleScreen();
  }
}

// ===== Pointer =====
function onPointerDown(e) {
  e.preventDefault();

  // Если на экране есть кнопка — обрабатываем только её
  if (state === "idle" || state === "ready") {
    const p = getCanvasPoint(e);
    if (startBtn && pointInRect(p.x, p.y, startBtn)) {
      beginSession();
    }
    return;
  }

  // Во всех остальных состояниях: start рисования
  clearResetTimer();
  const p = getCanvasPoint(e);
  lastPointer = p;

  startDrawing(p.x, p.y);
  startRafDrawing();
}

function onPointerMove(e) {
  if (!isDrawing) return;
  e.preventDefault();

  const p = getCanvasPoint(e);
  lastPointer = p;
  addPointAndDraw(p.x, p.y);
}

function onPointerUp(e) {
  if (!isDrawing) return;
  e.preventDefault();

  stopRafDrawing();
  finishDrawing();
}

function getCanvasPoint(e) {
  const rect = cnv.elt.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

// ===== RAF антиобрыв =====
function startRafDrawing() {
  stopRafDrawing();
  const tick = () => {
    if (!isDrawing) return;
    addPointAndDraw(lastPointer.x, lastPointer.y);
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
}

function stopRafDrawing() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
}

// ===== Таймеры =====
function setResetTimer(ms) {
  clearResetTimer();
  resetTimerId = setTimeout(() => resetToIdle(), ms);
}

function clearResetTimer() {
  if (resetTimerId) clearTimeout(resetTimerId);
  resetTimerId = null;
}

// ===== Экран ожидания + кнопка =====
function resetToIdle() {
  state = "idle";
  isDrawing = false;
  prevPoint = null;
  points = [];

  stopRafDrawing();
  clearResetTimer();

  drawIdleScreen();
}

function drawIdleScreen() {
  background(...BG);

  const lines = [
    "Нарисуй идеальный блин 🥞",
    "Нажми «НАЧАТЬ»"
  ];

  drawFittedTextBlock(lines, width / 2, height * 0.35, width * 0.88, height * 0.35);

  // рисуем кнопку
  const base = min(width, height);
  const btnW = clamp(base * 0.60, 220, 360);
  const btnH = clamp(base * 0.13, 64, 92);
  const btnX = width / 2 - btnW / 2;
  const btnY = height * 0.55;

  startBtn = { x: btnX, y: btnY, w: btnW, h: btnH };

  // кнопка (рисуем сами, без CSS)
  noStroke();
  fill(60);
  rect(btnX, btnY, btnW, btnH, 18);

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(clamp(base * 0.07, 22, 34));
  text("НАЧАТЬ", width / 2, btnY + btnH / 2);

  // подсказка
  fill(80);
  textSize(clamp(base * 0.04, 14, 22));
  text("После старта рисуй пальцем по экрану", width / 2, btnY + btnH + 40);

  state = "ready";
}

function beginSession() {
  // стартовая “сессия”: чистый экран и ждём касания для рисования
  state = "drawing";
  background(...BG);

  // маленькая подсказка на 1 секунду (можно убрать)
  const base = min(width, height);
  noStroke();
  fill(120);
  textAlign(CENTER, CENTER);
  textSize(clamp(base * 0.045, 14, 22));
  text("Рисуй круг 🥞", width / 2, height * 0.12);

  setTimeout(() => {
    if (state === "drawing" && !isDrawing) {
      // очищаем подсказку, если ещё не начали рисовать
      background(...BG);
    }
  }, 900);
}

// ===== Рисование =====
function startDrawing(x, y) {
  // если мы только что нажали "НАЧАТЬ", мы уже в drawing и фон чистый
  // но на всякий случай: если вдруг не в drawing — не начинаем
  if (state !== "drawing") return;

  // при первом касании начинаем реальное рисование
  isDrawing = true;

  points = [];
  prevPoint = { x, y };
  points.push(prevPoint);

  stampBrush(x, y);
}

function addPointAndDraw(x, y) {
  if (!isDrawing) return;

  const curr = { x, y };

  if (!prevPoint) {
    prevPoint = curr;
    points.push(curr);
    stampBrush(x, y);
    return;
  }

  if (dist(prevPoint.x, prevPoint.y, curr.x, curr.y) < 0.6) return;

  stampSegment(prevPoint, curr);
  points.push(curr);
  prevPoint = curr;
}

function stampSegment(a, b) {
  const d = dist(a.x, a.y, b.x, b.y);
  const steps = max(1, Math.ceil(d / FILL_STEP));

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    stampBrush(lerp(a.x, b.x, t), lerp(a.y, b.y, t));
  }
}

function stampBrush(x, y) {
  noStroke();
  fill(80);
  circle(x, y, STROKE_W);
}

// ===== Финиш =====
function finishDrawing() {
  isDrawing = false;

  if (points.length < MIN_POINTS) {
    showMessage(["Слишком мало движения 😄", "Нарисуй блин побольше"], 4500);
    return;
  }

  const len = pathLength(points);
  if (len < MIN_PATH_LEN) {
    showMessage(["Слишком коротко 😈", "Сделай блин побольше"], 4500);
    return;
  }

  const start = points[0];
  const end = points[points.length - 1];
  const gap = dist(start.x, start.y, end.x, end.y);

  if (gap <= AUTO_CLOSE_GAP) {
    autoClosePath(end, start);
  } else {
    showMessage(["Блин не замкнулся 😅", "Доведи круг до конца"], 4500);
    return;
  }

  const roundness = calculateRoundness(points);
  showResult(roundness, 9000);
}

function autoClosePath(from, to) {
  const d = dist(from.x, from.y, to.x, to.y);
  const steps = max(1, Math.ceil(d / AUTO_CLOSE_STEP));

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const ix = lerp(from.x, to.x, t);
    const iy = lerp(from.y, to.y, t);
    stampBrush(ix, iy);
    points.push({ x: ix, y: iy });
  }

  prevPoint = { x: to.x, y: to.y };
}

// ===== Математика =====
function calculateRoundness(pts) {
  let cx = 0, cy = 0;
  for (const p of pts) { cx += p.x; cy += p.y; }
  cx /= pts.length; cy /= pts.length;

  const radii = pts.map(p => dist(p.x, p.y, cx, cy));
  const avgR = radii.reduce((a, b) => a + b, 0) / radii.length;

  const variance = radii.reduce((sum, r) => sum + (r - avgR) ** 2, 0) / radii.length;
  const sd = Math.sqrt(variance);

  let roundness = 100 - (sd / avgR) * CALIBRATION_K;
  return Math.max(0, Math.min(100, roundness));
}

function pathLength(pts) {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += dist(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
  }
  return len;
}

// ===== UI =====
function showResult(value, ms) {
  state = "result";
  background(...BG);

  const base = min(width, height);
  const big = clamp(base * 0.16, 40, 86);
  const mid = clamp(base * 0.065, 16, 34);

  noStroke();
  fill(50);
  textAlign(CENTER, CENTER);

  textSize(big);
  text(`🥞 ${Math.round(value)}%`, width / 2, height * 0.45);

  textSize(mid);
  drawWrappedText(getComment(value), width / 2, height * 0.60, width * 0.86, mid * 1.25);

  setResetTimer(ms);
}

function showMessage(lines, ms) {
  state = "message";
  background(...BG);
  drawFittedTextBlock(lines, width / 2, height / 2, width * 0.88, height * 0.75);
  setResetTimer(ms);
}

function getComment(v) {
  if (v >= 95) return "Легенда блина 👑";
  if (v >= 85) return "Очень ровно! 🔥";
  if (v >= 70) return "Почти идеально 🙂";
  if (v >= 55) return "Норм, но можно круглее";
  if (v >= 40) return "Первый блин комом 😅";
  return "Это арт-объект, не блин 😈";
}

// ===== Текст: гарантированно влезает =====
function drawFittedTextBlock(lines, cx, cy, maxW, maxH) {
  let size = clamp(min(width, height) * 0.09, 18, 44);

  textAlign(CENTER, CENTER);
  noStroke();
  fill(80);

  for (let i = 0; i < 45; i++) {
    textSize(size);

    const wrapped = lines.flatMap(line => wrapLine(line, maxW));
    const lineH = size * 1.25;
    const blockH = wrapped.length * lineH;

    if (blockH <= maxH) {
      let y = cy - blockH / 2 + lineH / 2;
      for (const ln of wrapped) {
        text(ln, cx, y);
        y += lineH;
      }
      return;
    }
    size *= 0.92;
  }

  textSize(16);
  let y = cy;
  for (const ln of lines) {
    text(ln, cx, y);
    y += 20;
  }
}

function wrapLine(str, maxW) {
  const words = str.split(" ");
  let line = "";
  const out = [];

  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (textWidth(test) > maxW) {
      if (line) out.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) out.push(line);
  return out;
}

function drawWrappedText(str, x, y, maxW, lineH) {
  textAlign(CENTER, TOP);
  const lines = wrapLine(str, maxW);
  const blockH = lines.length * lineH;
  let yy = y - blockH / 2;

  for (let i = 0; i < lines.length; i++) {
    text(lines[i], x, yy + i * lineH);
  }
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function pointInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}