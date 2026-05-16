let video;
let faceMesh;
let faces = [];
let gameState = "HOME";
let pipes = [];
let balls = [];
let score = 0.0;
let countdown = 3;
let userNickname = "";
let playerAvatar = null;
let playerFrameImages = [];

// 하트(목숨) 및 기회 저장 제어 변수
let lives = 3;
let attemptScores = [];

const FACE_OVAL_INDICES = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378,
  400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21,
  54, 103, 67, 109,
];

const PLAYER_FRAME_ANIMATION_MS = 140;
const PLAYER_FRAME_ASSETS = [
  {
    path: "doodle_run (1).svg",
    viewBox: { width: 128.46, height: 163.38 },
    circle: { cx: 64.23, cy: 82.26, r: 64.23 },
  },
  {
    path: "doodle_run (2).svg",
    viewBox: { width: 178.97, height: 154.98 },
    circle: { cx: 86.42, cy: 82.13, r: 64.23 },
  },
];

let gameStartTime;
let currentSpeed = 6;
let spawnInterval = 80;
let playerX, playerY;

// 설정된 플레이어 스케일 유지
const PLAYER_HITBOX_RADIUS = 42;
const PLAYER_VISUAL_SIZE = 100;
const PREVIEW_HOLE_SIZE_RATIO = 0.62;

let lastPipeTop = -1;
let lastPipeSpacing = -1;

const options = { maxFaces: 1, refineLandmarks: false, flipHorizontal: true };

function preload() {
  faceMesh = ml5.faceMesh(options);
  playerFrameImages = PLAYER_FRAME_ASSETS.map((frame) => loadImage(frame.path));
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
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

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
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (let point of points) {
    let mirroredX = videoWidth - point.x;
    minX = min(minX, mirroredX);
    minY = min(minY, point.y);
    maxX = max(maxX, mirroredX);
    maxY = max(maxY, point.y);
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function capturePlayerAvatar() {
  if (faces.length === 0 || !video) return null;

  let face = faces[0];
  let ovalPoints = getFaceOvalPoints(face);
  let bounds = getBoundsFromPoints(ovalPoints, video.width);
  let paddingX = bounds.width * 0.08;
  let paddingY = bounds.height * 0.08;
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
  avatarGraphic.drawingContext.save();
  avatarGraphic.drawingContext.beginPath();

  for (let i = 0; i < ovalPoints.length; i++) {
    let point = ovalPoints[i];
    let pointX = video.width - point.x - sourceX;
    let pointY = point.y - sourceY;

    if (i === 0) avatarGraphic.drawingContext.moveTo(pointX, pointY);
    else avatarGraphic.drawingContext.lineTo(pointX, pointY);
  }

  avatarGraphic.drawingContext.closePath();
  avatarGraphic.drawingContext.clip();
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
  avatarGraphic.drawingContext.restore();

  return avatarGraphic;
}

function drawAvatarCircle(x, y, size) {
  if (!playerAvatar) return;

  let source = playerAvatar.canvas || playerAvatar.elt;
  let targetSize = size * 1.12;
  let scale = max(targetSize / source.width, targetSize / source.height);
  let drawWidth = source.width * scale;
  let drawHeight = source.height * scale;
  let offsetX = x - drawWidth / 2;
  let offsetY = y - drawHeight / 2;

  push();
  drawingContext.save();
  drawingContext.beginPath();
  drawingContext.arc(x, y, size / 2, 0, TWO_PI);
  drawingContext.clip();
  image(playerAvatar, offsetX, offsetY, drawWidth, drawHeight);
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
  if (!frame) return;

  let frameImage = frame.image;
  let frameMeta = frame.meta;
  if (!frameImage) return;

  let frameScale = holeSize / (frameMeta.circle.r * 2);
  let frameWidth = frameMeta.viewBox.width * frameScale;
  let frameHeight = frameMeta.viewBox.height * frameScale;
  let frameX = x - frameMeta.circle.cx * frameScale;
  let frameY = y - frameMeta.circle.cy * frameScale;

  image(frameImage, frameX, frameY, frameWidth, frameHeight);
}

function drawAvatarToCanvas(targetCanvas) {
  if (!targetCanvas) return;

  let context = targetCanvas.getContext("2d");
  context.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
  if (!playerAvatar) return;

  let frame = getCurrentPlayerFrame();
  if (!frame || !frame.image) return;

  let source = playerAvatar.canvas || playerAvatar.elt;
  let frameSource = frame.image.canvas || frame.image.elt;
  let frameMeta = frame.meta;
  let holeSize =
    min(targetCanvas.width, targetCanvas.height) * PREVIEW_HOLE_SIZE_RATIO;
  let frameScale = holeSize / (frameMeta.circle.r * 2);
  let targetSize = holeSize * 1.12;
  let avatarScale = max(targetSize / source.width, targetSize / source.height);
  let drawWidth = source.width * avatarScale;
  let drawHeight = source.height * avatarScale;
  let centerX = targetCanvas.width / 2;
  let centerY = targetCanvas.height / 2;
  let avatarX = centerX - drawWidth / 2;
  let avatarY = centerY - drawHeight / 2;
  let frameWidth = frameMeta.viewBox.width * frameScale;
  let frameHeight = frameMeta.viewBox.height * frameScale;
  let frameX = centerX - frameMeta.circle.cx * frameScale;
  let frameY = centerY - frameMeta.circle.cy * frameScale;

  context.save();
  context.beginPath();
  context.arc(centerX, centerY, holeSize / 2, 0, Math.PI * 2);
  context.clip();
  context.drawImage(source, avatarX, avatarY, drawWidth, drawHeight);
  context.restore();
  context.drawImage(frameSource, frameX, frameY, frameWidth, frameHeight);
}

function updateFacePreview() {
  let previewCanvas = document.getElementById("face-preview");
  let previewLabel = document.getElementById("face-preview-label");

  drawAvatarToCanvas(previewCanvas);
  if (previewLabel)
    previewLabel.innerText = playerAvatar ? "FACE READY" : "NO FACE SCANNED";
}

function scanFace() {
  let nextAvatar = capturePlayerAvatar();
  if (!nextAvatar) {
    window.alert(
      "얼굴이 아직 감지되지 않았습니다. 카메라 정면을 보고 다시 스캔해주세요.",
    );
    return;
  }
  playerAvatar = nextAvatar;
  updateFacePreview();
}

function resetPlayerAvatar() {
  playerAvatar = null;
  updateFacePreview();
}

function draw() {
  background(255);
  push();
  translate(width, 0);
  scale(-1, 1);
  tint(255, 50);
  image(video, 0, 0, width, height);
  pop();

  if (gameState === "COUNT") drawCountdown();
  else if (gameState === "PLAY") runGame();

  drawCharacter();
  updateFacePreview();
}

function drawCharacter() {
  if (faces.length > 0) {
    let face = faces[0];
    let nose = face.keypoints[1];
    let x = map(nose.x, 0, 640, 0, width);
    let y = map(nose.y, 0, 480, 0, height);
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
}

function clearRanking() {
  if (confirm("진짜로 모든 랭킹 기록을 싹 다 지우실 건가요? 🧙‍♂️")) {
    localStorage.removeItem("doodle_rank"); // 로컬스토리지 데이터 삭제
    showRanking(); // 지워진 상태(NO DATA)로 랭킹 화면 실시간 새로고침
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
