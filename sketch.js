// ===== Идеальный блин — Pointer Events (работает на телефонах стабильно) =====
let points = [];
let isDrawing = false;
let prevPoint = null;

const BG = [255, 248, 230];
const MIN_POINTS = 80;
const MIN_PATH_LEN = 600;
const MAX_END_GAP = 80;

const CALIBRATION_K = 160;

const STROKE_W = 14;
const FILL_STEP = 3;

let cnv;

function setup() {
  cnv = createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  resetToIdle();

  // Вешаем pointer-события на сам canvas
  const el = cnv.elt;

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

// ===== ЭКРАНЫ =====
function resetToIdle() {
  points = [];
  isDrawing = false;
  prevPoint = null;

  background(...BG);
  noStroke();
  fill(80);
  textAlign(CENTER, CENTER);
  textSize(42);
  text("Нарисуй идеальный блин 🥞", width / 2, height / 2);
  textSize(24);
  text("Коснись и веди пальцем по экрану", width / 2, height / 2 + 55);
}

function clearForDrawing(x, y) {
  background(...BG);
  points = [];
  isDrawing = true;

  prevPoint = { x, y };
  points.push(prevPoint);
}

// ===== РИСОВАНИЕ =====
function addPointAndDraw(x, y) {
  const curr = { x, y };

  if (!prevPoint) {
    prevPoint = curr;
    points.push(curr);
    return;
  }

  drawSmoothSegment(prevPoint, curr);

  points.push(curr);
  prevPoint = curr;
}

function drawSmoothSegment(a, b) {
  stroke(80);
  strokeWeight(STROKE_W);
  strokeCap(ROUND);

  const d = dist(a.x, a.y, b.x, b.y);

  if (d > FILL_STEP) {
    const steps = Math.ceil(d / FILL_STEP);
    let last = { x: a.x, y: a.y };
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const ix = lerp(a.x, b.x, t);
      const iy = lerp(a.y, b.y, t);
      line(last.x, last.y, ix, iy);
      last = { x: ix, y: iy };
    }
  } else {
    line(a.x, a.y, b.x, b.y);
  }
}

// ===== ФИНИШ =====
function finishDrawing() {
  isDrawing = false;

  if (points.length < MIN_POINTS) {
    showMessage("Слишком мало теста 😄\nНарисуй блин побольше", 5000);
    return;
  }

  const len = pathLength(points);
  if (len < MIN_PATH_LEN) {
    showMessage("Это не блин, это мазок 😈\nПопробуй кругом", 5000);
    return;
  }

  const start = points[0];
  const end = points[points.length - 1];
  if (dist(start.x, start.y, end.x, end.y) > MAX_END_GAP) {
    showMessage("Блин не замкнулся 😅\nДоведи круг до конца", 5000);
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
  noStroke();
  fill(50);
  textAlign(CENTER, CENTER);

  textSize(76);
  text(`🥞 ${Math.round(value)}%`, width / 2, height / 2 - 30);

  textSize(30);
  text(getComment(value), width / 2, height / 2 + 45);

  setTimeout(resetToIdle, ms);
}

function showMessage(msg, ms) {
  background(...BG);
  noStroke();
  fill(50);
  textAlign(CENTER, CENTER);
  textSize(44);
  text(msg, width / 2, height / 2);
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