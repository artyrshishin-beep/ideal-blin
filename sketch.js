// ===== Идеальный блин (полный рабочий код) =====
let prevPoint = null;
let points = [];
let isDrawing = false;

// Настройки (можно крутить под экран/ощущения)
const BG = [255, 248, 230];     // тёплый "блинный" фон
const MIN_POINTS = 80;          // минимум точек, чтобы считать
const MIN_PATH_LEN = 600;       // минимум длины линии (античит)
const MAX_END_GAP = 80;         // насколько близко должен закончиться к началу (античит)
const CALIBRATION_K = 180;      // калибровка процентов (200-260 обычно норм)

function setup() {
  createCanvas(windowWidth, windowHeight);
  resetCanvas();
}

function draw() {
  if (!isDrawing) return;

  // Рисуем линию
if (!isDrawing) return;

const current = { x: mouseX, y: mouseY };

if (prevPoint) {
  stroke(80);
  strokeWeight(14);
  strokeCap(ROUND);
  line(prevPoint.x, prevPoint.y, current.x, current.y);
}

points.push(current);
prevPoint = current;

  // Собираем точки
  points.push({ x: mouseX, y: mouseY });
}

function mousePressed() {
  // очищаем экран и убираем подсказку
  background(...BG);

  points = [];
  isDrawing = true;

  prevPoint = { x: mouseX, y: mouseY };
  points.push(prevPoint);
}

function mouseReleased() {
  isDrawing = false;

  // Базовая проверка
  if (points.length < MIN_POINTS) {
    showMessage("Слишком мало теста 😄\nНарисуй блин побольше");
    return;
  }

  // Античит: длина линии
  const len = pathLength(points);
  if (len < MIN_PATH_LEN) {
    showMessage("Это не блин, это мазок 😈\nПопробуй кругом");
    return;
  }

  // Античит: замкнутость
  const start = points[0];
  const end = points[points.length - 1];
  if (dist(start.x, start.y, end.x, end.y) > MAX_END_GAP) {
    showMessage("Блин не замкнулся 😅\nДоведи круг до конца");
    return;
  }

  const roundness = calculateRoundness(points);
  showResult(roundness);
}

function calculateRoundness(pts) {
  // 1) центр (среднее)
  let cx = 0, cy = 0;
  for (const p of pts) {
    cx += p.x; cy += p.y;
  }
  cx /= pts.length;
  cy /= pts.length;

  // 2) радиусы
  const radii = pts.map(p => dist(p.x, p.y, cx, cy));

  // 3) средний радиус
  const avgR = radii.reduce((a, b) => a + b, 0) / radii.length;

  // 4) стандартное отклонение
  const variance = radii.reduce((sum, r) => sum + (r - avgR) ** 2, 0) / radii.length;
  const sd = Math.sqrt(variance);

  // 5) проценты
  let roundness = 100 - (sd / avgR) * CALIBRATION_K;
  roundness = Math.max(0, Math.min(100, roundness));

  return roundness;
}

function pathLength(pts) {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += dist(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
  }
  return len;
}

function showResult(value) {
  background(...BG);
  noStroke();
  fill(50);

  textAlign(CENTER, CENTER);
  textSize(76);
  text(`🥞 ${Math.round(value)}%`, width / 2, height / 2 - 30);

  textSize(30);
  text(getComment(value), width / 2, height / 2 + 45);

  // авто-сброс
  setTimeout(() => resetCanvas(), 9000);
}

function getComment(v) {
  if (v >= 95) return "Легенда блина 👑";
  if (v >= 85) return "Очень ровно! 🔥";
  if (v >= 70) return "Почти идеально 🙂";
  if (v >= 55) return "Норм, но можно круглее";
  if (v >= 40) return "Первый блин комом 😅";
  return "Это арт-объект, не блин 😈";
}

function showMessage(msg) {
  background(...BG);
  noStroke();
  fill(50);

  textAlign(CENTER, CENTER);
  textSize(44);
  text(msg, width / 2, height / 2);

  setTimeout(() => resetCanvas(), 5000);
}

function resetCanvas() {
  points = [];
  isDrawing = false;
  prevPoint = null;
  background(...BG);

  // Небольшая подсказка на старте
  noStroke();
  fill(80);
  textAlign(CENTER, CENTER);
  textSize(42);
  text("Нарисуй идеальный блин 🥞", width / 2, height / 2);
  textSize(24);
  text("Коснись и веди пальцем по экрану", width / 2, height / 2 + 55);
}

// Чтобы на тач-экране не скроллило страницу
function touchStarted() { return false; }
function touchMoved() { return false; }
function touchEnded() { return false; }

// Под размер экрана (если окно поменяли)
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  resetCanvas();
}