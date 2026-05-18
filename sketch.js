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

let bgImg; // 배경화면 SVG 이미지 변수
let longImages = []; // long1~8 장애물 SVG 이미지 배열
let moveImages = []; // move1~30 장애물 SVG 이미지 배열
let bgX = 0; // 배경 무한 스크롤 X축 위치 변수

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

// 최적화: maxFaces를 1로 고정하여 추적 부하 최소화
const options = { maxFaces: 1, refineLandmarks: false, flipHorizontal: true };

// 최적화: DOM 탐색 비용 최소화를 위해 캐싱 변수 선언
let previewCanvasCache = null;
let previewLabelCache = null;

function preload() {
  faceMesh = ml5.faceMesh(options);
  playerFrameImages = PLAYER_FRAME_ASSETS.map((frame) => loadImage(frame.path));

  bgImg = loadImage("background.svg");
  for (let i = 1; i <= 8; i++) {
    longImages.push(loadImage(`svg/long${i}.svg`));
  }
  for (let i = 1; i <= 30; i++) {
    moveImages.push(loadImage(`svg/move${i}.svg`));
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  frameRate(60);
  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();
  faceMesh.detectStart(video, gotFaces);

  // DOM 요소 최초 캐싱
  previewCanvasCache = document.getElementById("face-preview");
  previewLabelCache = document.getElementById("face-preview-label");

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
  const len = face.keypoints.length;
  for (let i = 0; i < len; i++) {
    const pt = face.keypoints[i];
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
  }
  return {
    centerX: (minX + maxX) * 0.5,
    centerY: (minY + maxY) * 0.5,
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

  let ctx = avatarGraphic.drawingContext;
  ctx.save();
  ctx.beginPath();

  const len = ovalPoints.length;
  for (let i = 0; i < len; i++) {
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
  if (!playerAvatar) return;

  let source = playerAvatar.canvas || playerAvatar.elt;
  let targetSize = size * 1.12;
  let scale = max(targetSize / source.width, targetSize / source.height);
  let drawWidth = source.width * scale;
  let drawHeight = source.height * scale;

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
  let drawWidth = source.width * avatarScale;
  let drawHeight = source.height * avatarScale;
  let centerX = targetCanvas.width * 0.5;
  let centerY = targetCanvas.height * 0.5;

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
  // 최적화: 캐싱된 DOM 변수 활용하여 매 프레임 탐색을 방지
  if (previewCanvasCache) {
    drawAvatarToCanvas(previewCanvasCache);
  }
  if (previewLabelCache) {
    previewLabelCache.innerText = playerAvatar
      ? "FACE READY"
      : "NO FACE SCANNED";
  }
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
  let bw = width * zoom;
  let bh = height * zoom;
  let by = (height - bh) * 0.5;
  image(bgImg, bgX, by, bw, bh);
  image(bgImg, bgX + bw, by, bw, bh);
  bgX -= currentSpeed * 0.4;
  if (bgX <= -bw) {
    bgX = 0;
  }
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

  if (gameState === "COUNT") drawCountdown();
  else if (gameState === "PLAY") runGame();

  drawCharacter();

  // 중요 고효율 최적화: 대기화면이나 카메라 스캔 완료 시점에만 돌리던 로직이 draw()에 반복 실행되던 것을 조건부 렌더링으로 방지 가능하지만,
  // UX 완전 유지를 요구했으므로 캐싱 최적화된 상태로 유지합니다.
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
    localStorage.removeItem("doodle_rank");
    showRanking();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
