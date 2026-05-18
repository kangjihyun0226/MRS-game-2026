let video;
let faceMesh;
let faces = [];
let gameState = 'HOME';
let pipes = [];
let balls = [];
let score = 0.0;
let countdown = 3;
let userNickname = '';
let playerAvatar = null;
let playerFrameImages = [];
let lives = 3;
let attemptScores = [];
let bgImg;
let longImages = [];
let moveImages = [];
let bgX = 0;

const FACE_OVAL_INDICES = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378,
  400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21,
  54, 103, 67, 109,
];

const PLAYER_FRAME_ANIMATION_MS = 140;
const PLAYER_FRAME_ASSETS = [
  {
    path: 'doodle_run (1).svg',
    viewBox: { width: 128.46, height: 163.38 },
    circle: { cx: 64.23, cy: 82.26, r: 64.23 },
  },
  {
    path: 'doodle_run (2).svg',
    viewBox: { width: 178.97, height: 154.98 },
    circle: { cx: 86.42, cy: 82.13, r: 64.23 },
  },
];

let gameStartTime,
  currentSpeed = 6,
  spawnInterval = 80,
  playerX,
  playerY;
const PLAYER_HITBOX_RADIUS = 42;
const PLAYER_VISUAL_SIZE = 100;
const PREVIEW_HOLE_SIZE_RATIO = 0.62;
let lastPipeTop = -1,
  lastPipeSpacing = -1;

const options = { maxFaces: 1, refineLandmarks: false, flipHorizontal: true };

function preload() {
  faceMesh = ml5.faceMesh(options);
  playerFrameImages = PLAYER_FRAME_ASSETS.map((frame) => loadImage(frame.path));
  bgImg = loadImage('background.svg');
  for (let i = 1; i <= 8; i++) longImages.push(loadImage(`svg/long${i}.svg`));
  for (let i = 1; i <= 30; i++) moveImages.push(loadImage(`svg/move${i}.svg`));
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  frameRate(60);
  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();
  faceMesh.detectStart(video, gotFaces);
  updateFacePreview();
}

function gotFaces(results) {
  faces = results;
}

function getFaceBounds(face) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (let point of face.keypoints) {
    minX = min(minX, point.x);
    minY = min(minY, point.y);
    maxX = max(maxX, point.x);
    maxY = max(maxY, point.y);
  }
  return {
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function getFaceOvalPoints(face) {
  return FACE_OVAL_INDICES.map((index) => face.keypoints[index]);
}

function getBoundsFromPoints(points, videoWidth) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (let point of points) {
    let mirroredX = videoWidth - point.x;
    minX = min(minX, mirroredX);
    minY = min(minY, point.y);
    maxX = max(maxX, mirroredX);
    maxY = max(maxY, point.y);
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

function capturePlayerAvatar() {
  if (faces.length === 0 || !video) return null;
  let ovalPoints = getFaceOvalPoints(faces[0]);
  let bounds = getBoundsFromPoints(ovalPoints, video.width);
  let paddingX = bounds.width * 0.08,
    paddingY = bounds.height * 0.08;
  let sourceX = floor(constrain(bounds.minX - paddingX, 0, video.width - 1));
  let sourceY = floor(constrain(bounds.minY - paddingY, 0, video.height - 1));
  let sourceW = ceil(
    constrain(bounds.width + paddingX * 2, 1, video.width - sourceX),
  );
  let sourceH = ceil(
    constrain(bounds.height + paddingY * 2, 1, video.height - sourceY),
  );

  let avatarGraphic = createGraphics(sourceW, sourceH);
  avatarGraphic.clear();
  let ctx = avatarGraphic.drawingContext;
  ctx.save();
  ctx.beginPath();
  ovalPoints.forEach((p, i) => {
    let px = video.width - p.x - sourceX,
      py = p.y - sourceY;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  });
  ctx.closePath();
  ctx.clip();
  avatarGraphic.image(
    video,
    0,
    0,
    sourceW,
    sourceH,
    sourceX,
    sourceY,
    sourceW,
    sourceH,
  );
  ctx.restore();
  return avatarGraphic;
}

function drawAvatarCircle(x, y, size) {
  if (!playerAvatar) return;
  let source = playerAvatar.canvas || playerAvatar.elt;
  let scale = max((size * 1.12) / source.width, (size * 1.12) / source.height);
  let drawWidth = source.width * scale,
    drawHeight = source.height * scale;

  push();
  drawingContext.save();
  drawingContext.beginPath();
  drawingContext.arc(x, y, size / 2, 0, TWO_PI);
  drawingContext.clip();
  image(
    playerAvatar,
    x - drawWidth / 2,
    y - drawHeight / 2,
    drawWidth,
    drawHeight,
  );
  drawingContext.restore();
  pop();
}

function getCurrentPlayerFrame() {
  if (playerFrameImages.length === 0) return null;
  let frameIndex =
    floor(millis() / PLAYER_FRAME_ANIMATION_MS) % PLAYER_FRAME_ASSETS.length;
  return {
    image: playerFrameImages[frameIndex],
    meta: PLAYER_FRAME_ASSETS[frameIndex],
  };
}

function drawPlayerFrame(x, y, holeSize) {
  let frame = getCurrentPlayerFrame();
  if (!frame || !frame.image) return;
  let frameScale = holeSize / (frame.meta.circle.r * 2);
  image(
    frame.image,
    x - frame.meta.circle.cx * frameScale,
    y - frame.meta.circle.cy * frameScale,
    frame.meta.viewBox.width * frameScale,
    frame.meta.viewBox.height * frameScale,
  );
}

function drawAvatarToCanvas(targetCanvas) {
  if (!targetCanvas) return;
  let context = targetCanvas.getContext('2d');
  context.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
  if (!playerAvatar) return;
  let frame = getCurrentPlayerFrame();
  if (!frame || !frame.image) return;

  let source = playerAvatar.canvas || playerAvatar.elt,
    frameSource = frame.image.canvas || frame.image.elt,
    m = frame.meta;
  let holeSize =
    min(targetCanvas.width, targetCanvas.height) * PREVIEW_HOLE_SIZE_RATIO;
  let frameScale = holeSize / (m.circle.r * 2),
    avatarScale = max(
      (holeSize * 1.12) / source.width,
      (holeSize * 1.12) / source.height,
    );
  let cx = targetCanvas.width / 2,
    cy = targetCanvas.height / 2;

  context.save();
  context.beginPath();
  context.arc(cx, cy, holeSize / 2, 0, Math.PI * 2);
  context.clip();
  context.drawImage(
    source,
    cx - (source.width * avatarScale) / 2,
    cy - (source.height * avatarScale) / 2,
    source.width * avatarScale,
    source.height * avatarScale,
  );
  context.restore();
  context.drawImage(
    frameSource,
    cx - m.circle.cx * frameScale,
    cy - m.circle.cy * frameScale,
    m.viewBox.width * frameScale,
    m.viewBox.height * frameScale,
  );
}

function updateFacePreview() {
  let previewCanvas = document.getElementById('face-preview'),
    previewLabel = document.getElementById('face-preview-label');
  drawAvatarToCanvas(previewCanvas);
  if (previewLabel)
    previewLabel.innerText = playerAvatar ? 'FACE READY' : 'NO FACE SCANNED';
}

function scanFace() {
  let nextAvatar = capturePlayerAvatar();
  if (!nextAvatar)
    return window.alert(
      '얼굴이 아직 감지되지 않았습니다. 카메라 정면을 보고 다시 스캔해주세요.',
    );
  playerAvatar = nextAvatar;
  updateFacePreview();
}

function resetPlayerAvatar() {
  playerAvatar = null;
  updateFacePreview();
}

function drawBackground() {
  background(255);
  tint(255, 30);
  let bw = width * 1.5,
    bh = height * 1.5,
    by = (height - bh) / 2;
  image(bgImg, bgX, by, bw, bh);
  image(bgImg, bgX + bw, by, bw, bh);
  bgX -= currentSpeed * 0.4;
  if (bgX <= -bw) bgX = 0;
  noTint();
}

function draw() {
  drawBackground();
  push();
  translate(width, 0);
  scale(-1, 1);
  tint(255, 50);
  image(video, 0, 0, width, height);
  pop();

  if (gameState === 'COUNT') drawCountdown();
  else if (gameState === 'PLAY') runGame();

  drawCharacter();
  updateFacePreview();
}

function drawCharacter() {
  if (faces.length === 0) return;
  let nose = faces[0].keypoints[1];
  let x = map(nose.x, 0, 640, 0, width),
    y = map(nose.y, 0, 480, 0, height);
  if (playerAvatar) {
    drawAvatarCircle(x, y, PLAYER_VISUAL_SIZE);
  } else {
    stroke(0);
    strokeWeight(3);
    fill(255);
    ellipse(x, y, PLAYER_VISUAL_SIZE, PLAYER_VISUAL_SIZE);
  }
  drawPlayerFrame(x, y, PLAYER_VISUAL_SIZE);
  noStroke();
  fill(255, 0, 0, 70);
  ellipse(x, y, PLAYER_HITBOX_RADIUS * 2, PLAYER_HITBOX_RADIUS * 2);
  playerX = x;
  playerY = y;
}

function clearRanking() {
  if (confirm('진짜로 모든 랭킹 기록을 싹 다 지우실 건가요? 🧙‍♂️')) {
    localStorage.removeItem('doodle_rank');
    showRanking();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
