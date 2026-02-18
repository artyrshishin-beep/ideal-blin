// ===== Идеальный блин — стабильная версия + паттерны (2 на старт, 2 на результат) =====

// ---------- БРЕНДБУК ----------
const THEME = {
  bg: [239, 231, 221],
  primary: [44, 72, 48],
  pancake: [229, 200, 126],
  error: [188, 79, 60],
  secondary: [39, 76, 119],
  hint: [96, 153, 74],
  light: [255, 255, 255],
};

// ---------- НАСТРОЙКИ ----------
const CALIBRATION_K = 225;

const RESULT_MS = 30000; // 30 секунд
const MSG_MS = 3000;
const COUNTUP_MS = 850;

const MIN_POINTS = 80;
const MIN_PATH_LEN = 500;
const AUTO_CLOSE_GAP = 160;
const AUTO_CLOSE_STEP = 6;

// Кисть
let STROKE_W = 20;
let FILL_STEP = 1.7;

// ---------- СОСТОЯНИЕ ----------
let cnv;
let state = "idle"; // idle | ready | drawing | result | message
let resetTimerId = null;

let isDrawing = false;
let lastPointer = { x: 0, y: 0 };
let rafId = null;

let points = [];
let prevPoint = null;

let startBtn = null;
let headerText = "";

let logoImg = null;

// итоговый блин (текстура + маска) — картинка размера canvas
let blinMaskedImg = null;

// ---------- ПАТТЕРНЫ / КАРТИНКИ ----------
let patStart1 = null, patStart2 = null;
let patResult1 = null, patResult2 = null;

// ---------- SETUP ----------
function setup() {
  cnv = createCanvas(windowWidth, windowHeight);

  // чёткость лого/текста
  pixelDensity(Math.min(2, window.devicePixelRatio || 1));
  smooth();

  const el = cnv.elt;
  el.style.touchAction = "none";

  el.addEventListener("pointerdown", onPointerDown, { passive: false });
  el.addEventListener("pointermove", onPointerMove, { passive: false });
  window.addEventListener("pointerup", onPointerUp, { passive: false });

  // Лого без preload (не блокирует)
  loadImage(
    "assets/logo.png",
    (img) => {
      logoImg = img;
      if (state === "idle" || state === "ready") drawIdleScreen();
    },
    () => { logoImg = null; }
  );

  // Паттерны / декор (тоже без preload)
  loadImage("assets/pattern_start_1.png", (img) => { patStart1 = img; if (state === "idle" || state === "ready") drawIdleScreen(); });
  loadImage("assets/pattern_start_2.png", (img) => { patStart2 = img; if (state === "idle" || state === "ready") drawIdleScreen(); });

  loadImage("assets/pattern_result_1.png", (img) => { patResult1 = img; if (state === "result") redrawLastResultFrame(); });
  loadImage("assets/pattern_result_2.png", (img) => { patResult2 = img; if (state === "result") redrawLastResultFrame(); });

  resetToIdle();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  if (state === "idle" || state === "ready") drawIdleScreen();
  if (state === "drawing") redrawHeader();
  if (state === "result") redrawLastResultFrame();
}

// ---------- POINTER ----------
function onPointerDown(e) {
  e.preventDefault();

  if (state === "idle" || state === "ready") {
    const p = getCanvasPoint(e);
    if (startBtn && pointInRect(p.x, p.y, startBtn)) beginSession();
    return;
  }

  if (state === "result" || state === "message") {
    resetToIdle();
    return;
  }

  if (state === "drawing") {
    clearResetTimer();
    const p = getCanvasPoint(e);
    lastPointer = p;
    startDrawing(p.x, p.y);
    startRafDrawing();
  }
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

// ---------- RAF антиобрыв ----------
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

// ---------- Таймеры ----------
function setResetTimer(ms) {
  clearResetTimer();
  resetTimerId = setTimeout(() => resetToIdle(), ms);
}

function clearResetTimer() {
  if (resetTimerId) clearTimeout(resetTimerId);
  resetTimerId = null;
}

// ---------- ЭКРАНЫ ----------
function resetToIdle() {
  state = "idle";
  isDrawing = false;
  points = [];
  prevPoint = null;
  headerText = "";
  blinMaskedImg = null;

  stopRafDrawing();
  clearResetTimer();

  drawIdleScreen();
}

function drawIdleScreen() {
  background(...THEME.bg);

  // --- 2 паттерна на стартовом экране ---
  // Подстрой позиции/размеры как хочешь
  if (patStart1) {
    tint(255, 160);
    image(patStart1, width * 0.03, height * 0.62, width * 0.32, width * 0.32);
    noTint();
  }
  if (patStart2) {
    tint(255, 150);
    image(patStart2, width * 0.68, height * 0.06, width * 0.28, width * 0.28);
    noTint();
  }

  drawDecor();
  drawLogoTop();

  const lines = ["не рисуй ничего. все и так идеально 🥞", "Нажми «201021010220НАЧАТЬ»"];
  drawFittedTextBlock(lines, width / 2, height * 0.33, width * 0.88, height * 0.38);

  const base = min(width, height);
  const btnW = clamp(base * 0.62, 220, 380);
  const btnH = clamp(base * 0.13, 64, 96);
  const btnX = width / 2 - btnW / 2;
  const btnY = height * 0.55;
  startBtn = { x: btnX, y: btnY, w: btnW, h: btnH };

  noStroke();
  fill(0, 0, 0, 30);
  rect(btnX, btnY + 6, btnW, btnH, 18);

  fill(...THEME.primary);
  rect(btnX, btnY, btnW, btnH, 18);

  fill(...THEME.light);
  textAlign(CENTER, CENTER);
  textSize(clamp(base * 0.07, 22, 36));
  text("НАЧАТЬ", width / 2, btnY + btnH / 2);

  fill(...THEME.hint);
  textSize(clamp(base * 0.04, 14, 22));
  text("После старта рисуй пальцем по экрану", width / 2, btnY + btnH + 40);

  state = "ready";
}

function beginSession() {
  state = "drawing";
  headerText = "Рисуй круг 🥞";
  background(...THEME.bg);
  redrawHeader();
}

function drawDecor() {
  noStroke();
  fill(THEME.pancake[0], THEME.pancake[1], THEME.pancake[2], 70);
  circle(width * 0.18, height * 0.18, min(width, height) * 0.50);

  fill(THEME.secondary[0], THEME.secondary[1], THEME.secondary[2], 50);
  circle(width * 0.85, height * 0.78, min(width, height) * 0.55);

  fill(THEME.pancake[0], THEME.pancake[1], THEME.pancake[2], 40);
  circle(width * 0.82, height * 0.22, min(width, height) * 0.25);
}

function drawLogoTop() {
  if (!logoImg) return;

  const padTop = Math.max(12, height * 0.02);
  const maxW = width * 0.32;
  const maxH = height * 0.085;

  const s = Math.min(maxW / logoImg.width, maxH / logoImg.height);
  const w = logoImg.width * s;
  const h = logoImg.height * s;

  drawingContext.imageSmoothingEnabled = true;
  drawingContext.imageSmoothingQuality = "high";

  image(logoImg, (width - w) / 2, padTop, w, h);
}

function redrawHeader() {
  if (!headerText) return;

  const base = min(width, height);
  const h = clamp(base * 0.065, 18, 28);

  noStroke();
  fill(THEME.bg[0], THEME.bg[1], THEME.bg[2], 230);
  rect(0, 0, width, h * 2.2);

  fill(THEME.secondary[0], THEME.secondary[1], THEME.secondary[2], 160);
  rect(0, h * 2.2 - 2, width, 2);

  fill(...THEME.hint);
  textAlign(CENTER, CENTER);
  textSize(h);
  text(headerText, width / 2, h * 1.1);
}

// ---------- РИСОВАНИЕ ----------
function startDrawing(x, y) {
  isDrawing = true;
  points = [];
  prevPoint = { x, y };
  points.push(prevPoint);
  stampBrush(x, y);
  redrawHeader();
}

function addPointAndDraw(x, y) {
  if (!isDrawing) return;

  const curr = { x, y };

  if (!prevPoint) {
    prevPoint = curr;
    points.push(curr);
    stampBrush(x, y);
    redrawHeader();
    return;
  }

  if (dist(prevPoint.x, prevPoint.y, curr.x, curr.y) < 0.6) return;

  stampSegment(prevPoint, curr);
  points.push(curr);
  prevPoint = curr;

  redrawHeader();
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
  fill(...THEME.pancake);
  circle(x, y, STROKE_W);
}

// ---------- ФИНИШ ----------
function finishDrawing() {
  isDrawing = false;

  if (points.length < MIN_POINTS) {
    showMessage(["Слишком мало движения 😄", "Нарисуй блин побольше"], MSG_MS);
    return;
  }

  const len = pathLength(points);
  if (len < MIN_PATH_LEN) {
    showMessage(["Слишком коротко 😈", "Сделай блин побольше"], MSG_MS);
    return;
  }

  const start = points[0];
  const end = points[points.length - 1];
  const gap = dist(start.x, start.y, end.x, end.y);

  if (gap <= AUTO_CLOSE_GAP) {
    autoClosePath(end, start);
  } else {
    showMessage(["Блин не замкнулся 😅", "Доведи круг до конца"], MSG_MS);
    return;
  }

  blinMaskedImg = buildMaskedBlin(points);

  const roundness = calculateRoundness(points);
  showResult(roundness, RESULT_MS);
}

function autoClosePath(from, to) {
  const d = dist(from.x, from.y, to.x, to.y);
  const steps = max(1, Math.ceil(d / AUTO_CLOSE_STEP));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    points.push({ x: lerp(from.x, to.x, t), y: lerp(from.y, to.y, t) });
  }
}

// ---------- БЛИН-ТЕКСТУРА + МАСКА ----------
function buildMaskedBlin(pts) {
  const d = pixelDensity();

  const tex = createGraphics(width, height);
  tex.pixelDensity(d);
  tex.clear();

  tex.noStroke();
  tex.fill(...THEME.pancake);
  tex.rect(0, 0, width, height);

  // текстура
  tex.noStroke();
  for (let i = 0; i < 2600; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const s = 1 + Math.random() * 5;
    tex.fill(120, 84, 52, 42);
    tex.circle(x, y, s);
  }
  for (let i = 0; i < 220; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const s = 10 + Math.random() * 40;
    tex.fill(120, 84, 52, 18);
    tex.circle(x, y, s);
  }

  // блик
  tex.noFill();
  tex.stroke(255, 255, 255, 12);
  tex.strokeWeight(1);
  for (let r = 0; r < 60; r++) {
    const k = r / 60;
    tex.ellipse(width * 0.5, height * 0.58, width * (0.20 + k * 0.85), height * (0.10 + k * 0.50));
  }

  // маска
  const maskG = createGraphics(width, height);
  maskG.pixelDensity(d);
  maskG.clear();
  maskG.noStroke();
  maskG.fill(255);

  const step = 3;
  maskG.beginShape();
  for (let i = 0; i < pts.length; i += step) {
    maskG.vertex(pts[i].x, pts[i].y);
  }
  maskG.endShape(CLOSE);

  const texImg = tex.get();
  const maskImg = maskG.get();
  texImg.loadPixels();
  maskImg.loadPixels();
  texImg.mask(maskImg);

  return texImg;
}

// ---------- МАТЕМАТИКА ----------
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

// ---------- РЕЗУЛЬТАТ (набегание) ----------
let _lastFinalValue = 0;

function showResult(value, ms) {
  state = "result";
  clearResetTimer();

  _lastFinalValue = value;

  const startTime = performance.now();
  const startVal = 0;
  const endVal = value;

  const frame = (now) => {
    const t = Math.min(1, (now - startTime) / COUNTUP_MS);
    const eased = easeOutCubic(t);
    const current = startVal + (endVal - startVal) * eased;

    drawResultScreen(current, endVal);

    if (t < 1) requestAnimationFrame(frame);
    else {
      drawResultScreen(endVal, endVal);
      setResetTimer(ms);
    }
  };

  requestAnimationFrame(frame);
}

// чтобы можно было перерисовать результат при загрузке паттернов/resize
function redrawLastResultFrame() {
  if (state !== "result") return;
  drawResultScreen(_lastFinalValue, _lastFinalValue);
}

function drawResultScreen(displayValue, finalValue) {
  background(...THEME.bg);

  // --- 2 картинки на экране результата ---
  // Подстрой позиции/размеры/прозрачность
  if (patResult1) {
    tint(255, 140);
    image(patResult1, width * 0.05, height * 0.62, width * 0.22, width * 0.22);
    noTint();
  }
  if (patResult2) {
    tint(255, 140);
    image(patResult2, width * 0.73, height * 0.06, width * 0.22, width * 0.22);
    noTint();
  }

  const base = min(width, height);
  const pctSize = clamp(base * 0.14, 42, 92);
  const commentSize = clamp(base * 0.055, 16, 34);

  const pctY = height * 0.18;
  const blinY = height * 0.28;
  const commentY = height * 0.74;

  // Процент
  const pctColor =
    finalValue >= 85 ? THEME.pancake :
    (finalValue < 45 ? THEME.error : THEME.primary);

  noStroke();
  fill(...pctColor);
  textAlign(CENTER, CENTER);
  textSize(pctSize);
  text(`🥞 ${Math.round(displayValue)}%`, width / 2, pctY);

  // Блин (подстроишь xOffset как ты делал)
  if (blinMaskedImg) {
    const maxW = width * 0.95;
    const maxH = height * 0.58;

    const s0 = Math.min(maxW / blinMaskedImg.width, maxH / blinMaskedImg.height);
    const s = s0 * 1.5;

    const w = blinMaskedImg.width * s;
    const h = blinMaskedImg.height * s;

    const xOffset = width * 0.23; // как ты подобрал
    const x = width / 2 - w / 2 + xOffset;
    const y = blinY;

    image(blinMaskedImg, x, y, w, h);
  }

  // Комментарий
  fill(...THEME.primary);
  textSize(commentSize);
  drawWrappedText(getComment(finalValue), width / 2, commentY, width * 0.86, commentSize * 1.25);

  // Подсказка
  fill(...THEME.hint);
  textSize(clamp(base * 0.04, 12, 20));
  textAlign(CENTER, CENTER);
  text("Тапни по экрану — новый блин", width / 2, height * 0.92);
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

// ---------- СООБЩЕНИЯ ----------
function showMessage(lines, ms) {
  state = "message";
  blinMaskedImg = null;

  background(...THEME.bg);
  drawFittedTextBlock(lines, width / 2, height / 2, width * 0.88, height * 0.70, THEME.error);

  fill(...THEME.hint);
  const base = min(width, height);
  textAlign(CENTER, CENTER);
  textSize(clamp(base * 0.04, 12, 20));
  text("Тапни — попробовать снова", width / 2, height * 0.78);

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

// ---------- ТЕКСТ: всегда влезает ----------
function drawFittedTextBlock(lines, cx, cy, maxW, maxH, colorArr = null) {
  let size = clamp(min(width, height) * 0.09, 18, 46);

  textAlign(CENTER, CENTER);
  noStroke();

  for (let i = 0; i < 45; i++) {
    textSize(size);

    const wrapped = lines.flatMap(line => wrapLine(line, maxW));
    const lineH = size * 1.25;
    const blockH = wrapped.length * lineH;

    if (blockH <= maxH) {
      let y = cy - blockH / 2 + lineH / 2;

      for (let j = 0; j < wrapped.length; j++) {
        if (colorArr) fill(...colorArr);
        else fill(...(j === 0 ? THEME.primary : THEME.hint));
        text(wrapped[j], cx, y);
        y += lineH;
      }
      return;
    }
    size *= 0.92;
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

// ---------- UTILS ----------
function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function pointInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}