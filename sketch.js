// ===== Идеальный блин — mobile-friendly + без разрывов =====
let points = [];
let isDrawing = false;
let prevPoint = null;

const BG = [255, 248, 230];

// Пороги (могут отличаться на телефоне/планшете — подстроим)
const MIN_POINTS = 80;
const MIN_PATH_LEN = 500;
const MAX_END_GAP = 90;

// Калибровка (меньше => выше проценты)
const CALIBRATION_K = 140;

// Кисть (если всё равно рвётся — STROKE_W вверх, FILL_STEP вниз)
let STROKE_W = 18;   // на телефоне обычно лучше толще
let FILL_STEP = 2;   // шаг штампов (меньше => плотнее, но тяжелее)

let cnv;

function setup() {
  cnv = createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  resetToIdle();

  const el = cnv.elt;

  // Pointer Events — единый механизм для мыши/пальца/стилуса
  el.addEventListener("pointerdown", onPointerDown, { passive: false });
  el.addEventListener("pointermove", onPointerMove, { passive: false });
  window.addEventListener("pointerup", onPointerUp, { passive: false });

  // Чтобы жесты не мешали рисованию
  el.style.touchAction = "none";
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  resetToIdle();
}

function onPointerDown(e) {
  e.preventDefault();
  const p = getCanvasPoint(e);
  clearForDrawing(p.x, p.y);
}

function onPointerMove(e) {
  if (!isDrawing) return;
  e.preventDefault();
  const p = getCanvasPoint(e);
  addPointAndDraw(p.x, p.y);
}

function onPointerUp(e) {
  if (!isDrawing) return;
  e.preventDefault();
  finishDrawing();
}

function getCanvasPoint(e) {
  const rect = cnv.elt.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
}

// ===== ЭКРАН ОЖИДАНИЯ =====
function resetToIdle() {
  points = [];
  isDrawing = false;
  prevPoint = null;

  background(...BG);

  const base = min(width, height);
  const titleSize = clamp(base * 0.08, 28, 44);
  const subSize = clamp(base * 0.045, 16, 26);

  drawCenteredTextBlock(
    [
      "Нарисуй идеальный блин 🥞",
      "Коснись и веди пальцем"
    ],
    width / 2,
    height / 2,
    titleSize,
    subSize
  );
}

function clearForDrawing(x, y) {
  background(...BG);
  points = [];
  isDrawing = true;

  prevPoint = { x, y };
  points.push(prevPoint);

  // “Точка старта”, чтобы не было дырки в начале
  stampBrush(x, y);
}

// ===== РИСОВАНИЕ (штампами, чтобы не было разрывов) =====
function addPointAndDraw(x, y) {
  const curr = { x, y };

  if (!prevPoint) {
    prevPoint = curr;
    points.push(curr);
    stampBrush(x, y);
    return;
  }

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

  if (points.length < MIN_POINTS) {
    showMessage(["Слишком мало теста 😄", "Нарисуй блин побольше"], 4500);
    return;
  }

  const len = pathLength(points);
  if (len < MIN_PATH_LEN) {
    showMessage(["Это не блин, это мазок 😈", "Попробуй кругом"], 4500);
    return;
  }

  const start = points[0];
  const end = points[points.length - 1];
  if (dist(start.x, start.y, end.x, end.y) > MAX_END_GAP) {
    showMessage(["Блин не замкнулся 😅", "Доведи круг до конца"], 4500);
    return;
  }

  const roundness = calculateRoundness(points);
  showResult(roundness, 9000);
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
  const big = clamp(base * 0.14, 42, 84);
  const mid = clamp(base * 0.06, 18, 34);

  noStroke();
  fill(50);
  textAlign(CENTER, CENTER);

  textSize(big);
  text(`🥞 ${Math.round(value)}%`, width / 2, height * 0.45);

  textSize(mid);
  const comment = getComment(value);
  drawWrappedText(comment, width / 2, height * 0.58, width * 0.86, mid * 1.25);

  setTimeout(resetToIdle, ms);
}

function showMessage(lines, ms) {
  background(...BG);

  const base = min(width, height);
  const mid = clamp(base * 0.065, 18, 34);

  drawCenteredTextBlock(lines, width / 2, height / 2, mid, mid * 0.85);

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

// ===== ТЕКСТ: перенос и масштаб =====
function drawCenteredTextBlock(lines, x, y, titleSize, subSize) {
  noStroke();
  fill(80);
  textAlign(CENTER, CENTER);

  // Первая строка крупнее, остальные меньше
  let totalH = titleSize * 1.1 + (lines.length - 1) * (subSize * 1.35);
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

  // центрируем блок по y
  const blockH = lines.length * lineH;
  let yy = y - blockH / 2;

  for (let i = 0; i < lines.length; i++) {
    text(lines[i], x, yy + i * lineH);
  }
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}