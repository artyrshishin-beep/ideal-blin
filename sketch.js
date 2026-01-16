// ===== Идеальный блин — мягкое замыкание + проще старт =====
let points = [];
let isDrawing = false;
let prevPoint = null;

const BG = [255, 248, 230];

// Пороги
const MIN_POINTS = 80;
const MIN_PATH_LEN = 500;

// Мягкое замыкание:
// если конец близко к началу — замыкаем сами
const AUTO_CLOSE_GAP = 140; // допустимый "недоход" до старта (px)
const AUTO_CLOSE_STEP = 6;  // шаг штампов при автозамыкании

const CALIBRATION_K = 140;

// Кисть
let STROKE_W = 20;
let FILL_STEP = 1.7;

let cnv;

// антиобрыв
let lastPointer = { x: 0, y: 0 };
let rafId = null;

function setup() {
  cnv = createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  resetToIdle();

  const el = cnv.elt;
  el.style.touchAction = "none";

  el.addEventListener("pointerdown", onPointerDown, { passive: false });
  el.addEventListener("pointermove", onPointerMove, { passive: false });
  window.addEventListener("pointerup", onPointerUp, { passive: false });
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  resetToIdle();
}

function onPointerDown(e) {
  e.preventDefault();
  const p = getCanvasPoint(e);
  lastPointer = p;
  clearForDrawing(p.x, p.y);
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

function getCanvasPoint(e) {
  const rect = cnv.elt.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

// ===== ЭКРАН ОЖИДАНИЯ =====
function resetToIdle() {
  points = [];
  isDrawing = false;
  prevPoint = null;
  stopRafDrawing();

  background(...BG);

  const lines = [
    "Нарисуй идеальный блин 🥞",
    "Коснись и веди пальцем"
  ];

  const base = min(width, height);
  let titleSize = clamp(base * 0.09, 24, 42);
  let subSize = clamp(base * 0.055, 14, 26);

  fitAndDrawCenteredBlock(lines, width / 2, height / 2, titleSize, subSize, height * 0.85);
}

function clearForDrawing(x, y) {
  background(...BG);
  points = [];
  isDrawing = true;

  prevPoint = { x, y };
  points.push(prevPoint);
  stampBrush(x, y);
}

// ===== РИСОВАНИЕ (штампы) =====
function addPointAndDraw(x, y) {
  if (!isDrawing) return;

  const curr = { x, y };

  if (!prevPoint) {
    prevPoint = curr;
    points.push(curr);
    stampBrush(x, y);
    return;
  }

  if (dist(prevPoint.x, prevPoint.y, curr.x, curr.y) < 0.5) return;

  stampSegment(prevPoint, curr);

  points.push(curr);
  prevPoint = curr;
}

function stampSegment(a, b) {
  const d = dist(a.x, a.y, b.x, b.y);
  const steps = max(1, Math.ceil(d / FILL_STEP));

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const ix = lerp(a.x, b.x, t);
    const iy = lerp(a.y, b.y, t);
    stampBrush(ix, iy);
  }
}

function stampBrush(x, y) {
  noStroke();
  fill(80);
  circle(x, y, STROKE_W);
}

// ===== ФИНИШ =====
function finishDrawing() {
  isDrawing = false;

  // Анти-случайный тап: маловато точек — просим попробовать снова
  if (points.length < MIN_POINTS) {
    showMessage(["Слишком мало движения 😄", "Нарисуй блин побольше"], 4500);
    return;
  }

  const len = pathLength(points);
  if (len < MIN_PATH_LEN) {
    showMessage(["Слишком коротко 😈", "Сделай блин побольше"], 4500);
    return;
  }

  // Мягкое замыкание: если конец близко к началу — замыкаем сами
  const start = points[0];
  const end = points[points.length - 1];
  const gap = dist(start.x, start.y, end.x, end.y);

  if (gap <= AUTO_CLOSE_GAP) {
    autoClosePath(end, start);
  } else {
    // Если разрыв большой — честно скажем, что не замкнулось
    showMessage(["Блин не замкнулся 😅", "Доведи круг до конца"], 4500);
    return;
  }

  const roundness = calculateRoundness(points);
  showResult(roundness, 9000);
}

// Автозамыкание: дорисовываем от end до start штампами и добавляем точки
function autoClosePath(from, to) {
  const d = dist(from.x, from.y, to.x, to.y);
  const steps = max(1, Math.ceil(d / AUTO_CLOSE_STEP));

  let last = { x: from.x, y: from.y };

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const ix = lerp(from.x, to.x, t);
    const iy = lerp(from.y, to.y, t);

    stampBrush(ix, iy);
    const p = { x: ix, y: iy };
    points.push(p);
    last = p;
  }

  prevPoint = last;
}

// ===== МАТЕМАТИКА =====
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
  background(...BG);

  const base = min(width, height);
  const big = clamp(base * 0.16, 42, 88);
  const mid = clamp(base * 0.065, 16, 34);

  noStroke();
  fill(50);
  textAlign(CENTER, CENTER);

  textSize(big);
  text(`🥞 ${Math.round(value)}%`, width / 2, height * 0.45);

  textSize(mid);
  drawWrappedText(getComment(value), width / 2, height * 0.60, width * 0.86, mid * 1.25);

  setTimeout(resetToIdle, ms);
}

function showMessage(lines, ms) {
  background(...BG);

  const base = min(width, height);
  let size = clamp(base * 0.07, 18, 36);

  fitAndDrawCenteredBlock(lines, width / 2, height / 2, size, size * 0.95, height * 0.85);

  setTimeout(resetToIdle, ms);
}

function getComment(v) {
  if (v >= 95) return "Легенда блина 👑";
  if (v >= 85) return "Очень ровно! 🔥";
  if (v >= 70) return "Почти идеально 🙂";
  if (v >= 55) return "Норм, но можно круглее";
  if (v >= 40) return "Первый блин комом 😅";
  return "Это арт-объект, не блин 😈";
}

// ===== ТЕКСТ: авто-влезание + перенос =====
function fitAndDrawCenteredBlock(lines, x, y, titleSize, subSize, maxBlockHeight) {
  let t = titleSize;
  let s = subSize;

  for (let i = 0; i < 30; i++) {
    const h = estimateBlockHeight(lines, t, s);
    if (h <= maxBlockHeight) break;
    t *= 0.92;
    s *= 0.92;
  }

  drawCenteredTextBlock(lines, x, y, t, s);
}

function estimateBlockHeight(lines, titleSize, subSize) {
  if (lines.length === 0) return 0;
  const titleH = titleSize * 1.1;
  const subH = (lines.length - 1) * (subSize * 1.35);
  return titleH + subH;
}

function drawCenteredTextBlock(lines, x, y, titleSize, subSize) {
  noStroke();
  fill(80);
  textAlign(CENTER, CENTER);

  const totalH = estimateBlockHeight(lines, titleSize, subSize);
  let yy = y - totalH / 2;

  textSize(titleSize);
  text(lines[0], x, yy + titleSize * 0.55);

  textSize(subSize);
  for (let i = 1; i < lines.length; i++) {
    yy += (i === 1 ? titleSize * 1.1 : subSize * 1.35);
    text(lines[i], x, yy + subSize * 0.55);
  }
}

function drawWrappedText(str, x, y, maxW, lineH) {
  noStroke();
  fill(50);
  textAlign(CENTER, TOP);

  const words = str.split(" ");
  let line = "";
  let lines = [];

  for (let w of words) {
    const test = line ? line + " " + w : w;
    if (textWidth(test) > maxW) {
      if (line) lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);

  const blockH = lines.length * lineH;
  let yy = y - blockH / 2;

  for (let i = 0; i < lines.length; i++) {
    text(lines[i], x, yy + i * lineH);
  }
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}