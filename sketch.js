// ===== Идеальный блин v10 — брендбук + стабильная логика (Start -> Draw -> Result) =====

/* ====== БРЕНДБУК ====== */
const THEME = {
  bg: [239, 231, 221],        // фон
  primary: [44, 72, 48],      // основной тёмно-зелёный (тексты, заголовки, UI)
  pancake: [229, 200, 126],   // блинно-жёлтый (блин, успех, идеальное состояние)
  error: [188, 79, 60],       // красно-оранжевый (ошибка, эмоция)
  secondary: [39, 76, 119],   // сине-зелёный (вторичные элементы, иконки)
  hint: [96, 153, 74],        // светло-зелёный (подсказки, нейтраль)
  light: [255, 255, 255],     // белый
};

// Алиас (на случай если где-то осталось background(...BG))
const BG = THEME.bg;

/* ====== НАСТРОЙКИ ЛОГИКИ ====== */
const MIN_POINTS = 80;
const MIN_PATH_LEN = 500;

const AUTO_CLOSE_GAP = 160;   // насколько можно "не дотянуть" до начала
const AUTO_CLOSE_STEP = 6;    // шаг автозамыкания

// Ты уже ставил 180 — оставляю как текущее
const CALIBRATION_K = 225;

/* ====== НАСТРОЙКИ КИСТИ ====== */
let STROKE_W = 20;   // толщина блина
let FILL_STEP = 1.7; // плотность штампов

/* ====== СОСТОЯНИЕ ====== */
let points = [];
let prevPoint = null;

let blinMaskedImg = null;

let logoImg = null;

let cnv;
let isDrawing = false;
let lastPointer = { x: 0, y: 0 };
let rafId = null;

let state = "idle"; // idle | ready | drawing | result | message
let resetTimerId = null;

let startBtn = null;
let headerText = "";

// таймеры
const RESULT_MS = 4500;
const COUNTUP_MS = 850; // скорость набегания (600–1200 обычно ок)
const MSG_MS = 3000;


function setup() {
  cnv = createCanvas(windowWidth, windowHeight);
  pixelDensity(Math.min(2, window.devicePixelRatio || 1));
  smooth();

  const el = cnv.elt;
  el.style.touchAction = "none";

  el.addEventListener("pointerdown", onPointerDown, { passive: false });
  el.addEventListener("pointermove", onPointerMove, { passive: false });
  window.addEventListener("pointerup", onPointerUp, { passive: false });

  resetToIdle();
 loadImage(
  "assets/logo.png",
  (img) => {
    logoImg = img;

    // ВАЖНО: drawIdleScreen() внутри ставит state="ready".
    // Поэтому перерисовываем старт ТОЛЬКО если мы сейчас на старте.
    if (state === "idle" || state === "ready") {
      drawIdleScreen();
    }
  },
  () => { logoImg = null; }
);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  if (state === "idle" || state === "ready") {
    drawIdleScreen();
  } else if (state === "drawing") {
    redrawHeader();
  }
}

/* ====== POINTER EVENTS ====== */
function onPointerDown(e) {
  e.preventDefault();

  // Стартовый экран: нажимаем только кнопку
  if (state === "idle" || state === "ready") {
    const p = getCanvasPoint(e);
    if (startBtn && pointInRect(p.x, p.y, startBtn)) {
      beginSession();
    }
    return;
  }

  // На результате/сообщении — тап = мгновенный сброс
  if (state === "result" || state === "message") {
    resetToIdle();
    return;
  }

  // Режим рисования — начинаем штрих
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

/* ====== RAF (антиобрыв) ====== */
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

/* ====== ТАЙМЕРЫ ====== */
function setResetTimer(ms) {
  clearResetTimer();
  resetTimerId = setTimeout(() => resetToIdle(), ms);
}

function clearResetTimer() {
  if (resetTimerId) clearTimeout(resetTimerId);
  resetTimerId = null;
}

/* ====== ЭКРАНЫ ====== */
function resetToIdle() {
  state = "idle";
  isDrawing = false;
  prevPoint = null;
  points = [];
  headerText = "";

  stopRafDrawing();
  clearResetTimer();

  drawIdleScreen();
}

function drawIdleScreen() {
  // фон
  background(...THEME.bg);

  // лёгкий декор (не мешает бренду)
  drawDecor();
  drawLogoTop();
  
  const lines = [
    "Нарисуй идеальный блин 🥞",
    "Нажми «НАЧАТЬ»"
  ];

  // заголовок/подзаголовок — primary/hint
  drawFittedTextBlock(lines, width / 2, height * 0.33, width * 0.88, height * 0.38);

  // кнопка
  const base = min(width, height);
  const btnW = clamp(base * 0.62, 220, 380);
  const btnH = clamp(base * 0.13, 64, 96);
  const btnX = width / 2 - btnW / 2;
  const btnY = height * 0.55;

  startBtn = { x: btnX, y: btnY, w: btnW, h: btnH };

  // тень
  noStroke();
  fill(0, 0, 0, 30);
  rect(btnX, btnY + 6, btnW, btnH, 18);

  // кнопка — primary
  fill(...THEME.primary);
  rect(btnX, btnY, btnW, btnH, 18);

  // текст на кнопке — light
  fill(...THEME.light);
  textAlign(CENTER, CENTER);
  textSize(clamp(base * 0.07, 22, 36));
  text("НАЧАТЬ", width / 2, btnY + btnH / 2);

  // подсказка — hint
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

/* ====== ДЕКОР ====== */
function drawDecor() {
  noStroke();

  // мягкие круги-пятна (вторичный + блинный)
  fill(...THEME.pancake, 80);
  circle(width * 0.18, height * 0.18, min(width, height) * 0.50);

  fill(...THEME.secondary, 55);
  circle(width * 0.85, height * 0.78, min(width, height) * 0.55);

  fill(...THEME.pancake, 45);
  circle(width * 0.82, height * 0.22, min(width, height) * 0.25);
}

/* ====== ХЕДЕР ====== */
function redrawHeader() {
  if (!headerText) return;

  const base = min(width, height);
  const h = clamp(base * 0.065, 18, 28);

  // плашка (чтобы читаемо на любом фоне)
  noStroke();
  fill(...THEME.bg, 220);
  rect(0, 0, width, h * 2.2);

  // тонкая линия (secondary)
  fill(...THEME.secondary, 160);
  rect(0, h * 2.2 - 2, width, 2);

  // текст (hint)
  fill(...THEME.hint);
  textAlign(CENTER, CENTER);
  textSize(h);
  text(headerText, width / 2, h * 1.1);
}

/* ====== РИСОВАНИЕ (блинно-жёлтая кисть) ====== */
function startDrawing(x, y) {
  // при первом касании начинаем
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

  // чтобы RAF не плодил точки, когда палец почти стоит
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
  // блинная “краска”
  noStroke();
  fill(...THEME.pancake);
  circle(x, y, STROKE_W);

  // лёгкий “поджар” по краю (акцент) — очень тонко
  noFill();
  stroke(...THEME.error, 55);
  strokeWeight(1.2);
  circle(x, y, STROKE_W * 0.92);
  noStroke();
}

/* ====== ФИНИШ ====== */
function finishDrawing() {
  isDrawing = false;

  if (points.length < MIN_POINTS) {
    showMessage(["Слишком мало движения 😄", "Нарисуй блин побольше"], MSG_MS, "error");
    return;
  }

  const len = pathLength(points);
  if (len < MIN_PATH_LEN) {
    showMessage(["Слишком коротко 😈", "Сделай блин побольше"], MSG_MS, "error");
    return;
  }

  const start = points[0];
  const end = points[points.length - 1];
  const gap = dist(start.x, start.y, end.x, end.y);

  if (gap <= AUTO_CLOSE_GAP) {
    autoClosePath(end, start);
  } else {
    showMessage(["Блин не замкнулся 😅", "Доведи круг до конца"], MSG_MS, "error");
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
    const ix = lerp(from.x, to.x, t);
    const iy = lerp(from.y, to.y, t);
    stampBrush(ix, iy);
    points.push({ x: ix, y: iy });
  }

  prevPoint = { x: to.x, y: to.y };
}

/* ====== МАТЕМАТИКА ====== */
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

/* ====== UI: РЕЗУЛЬТАТ / СООБЩЕНИЯ ====== */
function showResult(value, ms) {
  state = "result";
  headerText = "";

  // сбросим таймер на всякий случай
  clearResetTimer();

  const startTime = performance.now();
  const startVal = 0;          // можно сделать value - 20, если хочешь “мягче”
  const endVal = value;

  const frame = (now) => {
    const t = Math.min(1, (now - startTime) / COUNTUP_MS);
    const eased = easeOutCubic(t);
    const current = startVal + (endVal - startVal) * eased;

    // перерисовываем кадр результата
    drawResultScreen(current, endVal);

    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      // в конце фиксируем финальное значение и ставим авто-сброс
      drawResultScreen(endVal, endVal);
      setResetTimer(ms);
    }
  };

  requestAnimationFrame(frame);
}

function showMessage(lines, ms, kind = "info") {
  state = "message";
  headerText = "";

  background(...THEME.bg);

  // Текст ошибок — error, иначе primary
  const color = (kind === "error") ? THEME.error : THEME.primary;
  drawFittedTextBlock(lines, width / 2, height / 2, width * 0.88, height * 0.70, color);

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

/* ====== ТЕКСТ: ВЛЕЗАЕТ ВСЕГДА ====== */
// Если colorArr не передан — использует primary/hint по смыслу
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
      // первая строка — primary, остальные — hint (если colorArr не задан)
      let y = cy - blockH / 2 + lineH / 2;

      for (let j = 0; j < wrapped.length; j++) {
        if (colorArr) {
          fill(...colorArr);
        } else {
          fill(...(j === 0 ? THEME.primary : THEME.hint));
        }
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

/* ====== UTILS ====== */
function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function pointInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}
function drawResultScreen(displayValue, finalValue) {
  background(...THEME.bg);
  if (blinMaskedImg) {
  image(blinMaskedImg, 0, 0, width, height);
}

  const base = min(width, height);
  const big = clamp(base * 0.18, 44, 92);
  const mid = clamp(base * 0.065, 16, 34);

  textAlign(CENTER, CENTER);
  noStroke();

  // цвет процента — по финальному результату (чтобы не мигал)
  const pctColor = finalValue >= 85 ? THEME.pancake : (finalValue < 45 ? THEME.error : THEME.primary);

  fill(...pctColor);
  textSize(big);
  text(`🥞 ${Math.round(displayValue)}%`, width / 2, height * 0.43);

  fill(...THEME.primary);
  textSize(mid);
  drawWrappedText(getComment(finalValue), width / 2, height * 0.58, width * 0.86, mid * 1.25);

  fill(...THEME.hint);
  textSize(clamp(base * 0.04, 12, 20));
  text("Тапни по экрану — новый блин", width / 2, height * 0.78);
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function drawLogoTop() {
  if (!logoImg) return;

  const padTop = Math.max(12, height * 0.025);

  // ~ на 30% меньше
  const maxW = width * 0.32;
  const maxH = height * 0.085;

  const s = Math.min(maxW / logoImg.width, maxH / logoImg.height);
  const w = logoImg.width * s;
  const h = logoImg.height * s;

  drawingContext.imageSmoothingEnabled = true;
  drawingContext.imageSmoothingQuality = "high";

  image(logoImg, (width - w) / 2, padTop, w, h);
}
function buildMaskedBlin(pts) {
  // 1) Текстура блина (offscreen)
  const tex = createGraphics(width, height);
  const d = pixelDensity();              // ✅ берём плотность основного canvas

  const tex = createGraphics(width, height);
  tex.pixelDensity(d);                   // ✅ синхронизируем

  const maskG = createGraphics(width, height);
  maskG.pixelDensity(d);                 // ✅ синхронизируем
  tex.clear();

  // базовый цвет "блина"
  tex.noStroke();
  tex.fill(...THEME.pancake);
  tex.rect(0, 0, width, height);

  // лёгкая "поджарка" (пятна/крап)
  // (дёшево по CPU и выглядит вкусно)
  tex.noStroke();
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const s = 2 + Math.random() * 6;
    tex.fill(THEME.error[0], THEME.error[1], THEME.error[2], 18); // полупрозрачный
    tex.circle(x, y, s);
  }

  // небольшой градиент "объёма" (центр светлее)
  // делаем мягко, чтобы не было каши
  tex.noFill();
  tex.stroke(255, 255, 255, 18);
  tex.strokeWeight(1);
  for (let r = 0; r < 90; r++) {
    const k = r / 90;
    tex.ellipse(width * 0.5, height * 0.55, width * (0.25 + k * 0.9), height * (0.12 + k * 0.55));
  }

  // 2) Маска по контуру (offscreen)
  const maskG = createGraphics(width, height);
  maskG.clear();          // прозрачный фон
  maskG.noStroke();
  maskG.fill(255);        // белое = видно

  // Чтобы не рисовать 5000 вершин — прорежаем точки
    const step = 3;
  maskG.beginShape();
  for (let i = 0; i < pts.length; i += step) {
    maskG.vertex(pts[i].x, pts[i].y);
  }
  maskG.endShape(CLOSE);

  // 3) Применяем маску
  const texImg = tex.get();
  const maskImg = maskG.get();

  texImg.loadPixels();
  maskImg.loadPixels();
  texImg.mask(maskImg);

  return texImg;
}