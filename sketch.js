let video;
let faceMesh;
let faces = [];
let gameState = "HOME";
let pipes = [];
let balls = [];
let score = 0.0;
let countdown = 3;
let userNickname = "";
let userPhone = "";
let gameName = "";
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

const PLAYER_HITBOX_RADIUS = 32;
const PLAYER_VISUAL_SIZE = 100;
const PREVIEW_HOLE_SIZE_RATIO = 0.62;

let lastPipeTop = -1;
let lastPipeSpacing = -1;

const options = { maxFaces: 1, refineLandmarks: false, flipHorizontal: true };

// DOM 캐싱 변수
let previewCanvasCache = null;
let previewLabelCache = null;

function preload() {
  // ml5.js의 FaceMesh 모델을 초기화하고, 게임에 필요한 이미지 자원들을 미리 로드합니다.
  faceMesh = ml5.faceMesh(options);
  playerFrameImages = PLAYER_FRAME_ASSETS.map((frame) => loadImage(frame.path));
  bgImg = loadImage("background.svg");
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

  previewCanvasCache = document.getElementById("face-preview");
  previewLabelCache = document.getElementById("face-preview-label");
  updateFacePreview();
}

function gotFaces(results) {
  faces = results;
}

function getFaceOvalPoints(face) {
  return FACE_OVAL_INDICES.map((index) => face.keypoints[index]);
}

function getBoundsFromPoints(points, videoWidth) {
  // 얼굴 랜드마크 포인트 배열과 비디오 너비를 받아서 얼굴 영역의 경계 사각형 정보를 계산합니다.
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  const len = points.length;
  for (let i = 0; i < len; i++) {
    let mirroredX = videoWidth - points[i].x;
    let ptY = points[i].y;
    if (mirroredX < minX) minX = mirroredX;
    if (mirroredX > maxX) maxX = mirroredX;
    if (ptY < minY) minY = ptY;
    if (ptY > maxY) maxY = ptY;
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

function capturePlayerAvatar() {
  // 현재 감지된 얼굴에서 타원형 영역을 추출하여 플레이어 아바타로 사용할 그래픽 객체를 생성합니다.
  if (faces.length === 0 || !video) return null;
  let face = faces[0];
  let ovalPoints = getFaceOvalPoints(face);
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
  const len = ovalPoints.length;
  for (let i = 0; i < len; i++) {
    // 얼굴 랜드마크 포인트를 순회하면서 타원형 클리핑 경로를 생성합니다. X 좌표는 미러링되어야 하므로 비디오 너비에서 빼줍니다.
    let pointX = video.width - ovalPoints[i].x - sourceX;
    let pointY = ovalPoints[i].y - sourceY;
    if (i === 0) ctx.moveTo(pointX, pointY);
    else ctx.lineTo(pointX, pointY);
  }
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
  // 플레이어 아바타를 얼굴 타원형 영역에 맞춰 원형으로 렌더링하는 함수입니다. 아바타 이미지가 준비되지 않았으면 아무 것도 그리지 않습니다.
  if (!playerAvatar) return;
  let source = playerAvatar.canvas || playerAvatar.elt;
  let targetSize = size * 1.12;
  let scale = max(targetSize / source.width, targetSize / source.height);
  let drawWidth = source.width * scale,
    drawHeight = source.height * scale;

  push();
  let ctx = drawingContext;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, size * 0.5, 0, TWO_PI);
  ctx.clip();
  image(
    playerAvatar,
    x - drawWidth * 0.5,
    y - drawHeight * 0.5,
    drawWidth,
    drawHeight,
  );
  ctx.restore();
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
  let frameMeta = frame.meta;
  let frameScale = holeSize / (frameMeta.circle.r * 2);
  image(
    frame.image,
    x - frameMeta.circle.cx * frameScale,
    y - frameMeta.circle.cy * frameScale,
    frameMeta.viewBox.width * frameScale,
    frameMeta.viewBox.height * frameScale,
  );
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
  let drawWidth = source.width * avatarScale,
    drawHeight = source.height * avatarScale;
  let centerX = targetCanvas.width * 0.5,
    centerY = targetCanvas.height * 0.5;

  context.save();
  context.beginPath();
  context.arc(centerX, centerY, holeSize * 0.5, 0, Math.PI * 2);
  context.clip();
  context.drawImage(
    source,
    centerX - drawWidth * 0.5,
    centerY - drawHeight * 0.5,
    drawWidth,
    drawHeight,
  );
  context.restore();
  context.drawImage(
    frameSource,
    centerX - frameMeta.circle.cx * frameScale,
    centerY - frameMeta.circle.cy * frameScale,
    frameMeta.viewBox.width * frameScale,
    frameMeta.viewBox.height * frameScale,
  );
}

function updateFacePreview() {
  if (previewCanvasCache) drawAvatarToCanvas(previewCanvasCache);
  if (previewLabelCache)
    previewLabelCache.innerText = playerAvatar
      ? "FACE READY"
      : "NO FACE SCANNED";
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

function drawBackground() {
  background(255);
  tint(255, 30);
  let zoom = 1.5;
  let bw = width * zoom,
    bh = height * zoom;
  let by = (height - bh) * 0.5;
  image(bgImg, bgX, by, bw, bh);
  image(bgImg, bgX + bw, by, bw, bh);
  bgX -= currentSpeed * 0.4;
  if (bgX <= -bw) bgX = 0;
  noTint();
}

function draw() {
  drawBackground();

  if (gameState === "HOME" || gameState === "GAMEOVER") {
    push();
    translate(width, 0);
    scale(-1, 1);
    tint(255, 50);
    image(video, 0, 0, width, height);
    pop();
  }

  if (gameState === "COUNT") drawCountdown();
  else if (gameState === "PLAY") runGame();

  drawCharacter();

  if (gameState === "HOME" || gameState === "GAMEOVER") {
    updateFacePreview();
  }
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
    fill(255, 0, 0, 0);
    ellipse(x, y, PLAYER_HITBOX_RADIUS * 2, PLAYER_HITBOX_RADIUS * 2);
    playerX = x;
    playerY = y;
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
