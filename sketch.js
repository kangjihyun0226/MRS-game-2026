let video;
let faceMesh;
let faces = [];
let gameState = "HOME";
let pipes = [];
let balls = [];
let score = 0;
let countdown = 3;
let userNickname = "";
let playerAvatar = null;
let playerFrameImages = [];

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

const PLAYER_HITBOX_RADIUS = 20;
const PLAYER_VISUAL_SIZE = 52;
const PREVIEW_HOLE_SIZE_RATIO = 0.62;

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
//
function gotFaces(results) {
  // 감지된 얼굴 데이터 저장
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
// 캐릭터 그리기
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
// 게임 플레이 로직
function runGame() {
  let elapsed = millis() - gameStartTime;
  let passedSeconds = floor(elapsed / 1000);
  score = passedSeconds;

  currentSpeed = 6 + passedSeconds * 0.023;
  spawnInterval = max(40, 80 - passedSeconds * 0.1);

  if (frameCount % floor(spawnInterval) === 0) {
    pipes.push(new Pipe(currentSpeed));
  }
  for (let i = pipes.length - 1; i >= 0; i--) {
    pipes[i].update();
    pipes[i].show();
    if (pipes[i].hits(playerX, playerY)) endGame();
    if (pipes[i].offscreen()) pipes.splice(i, 1);
  }

  if (passedSeconds >= 1) {
    if (frameCount % 90 === 0) {
      balls.push(new Ball(currentSpeed));
    }
  }

  // 공 업데이트 및 충돌 체크
  for (let i = balls.length - 1; i >= 0; i--) {
    balls[i].update();
    balls[i].show();
    if (balls[i].hits(playerX, playerY)) endGame();
    if (balls[i].offscreen()) balls.splice(i, 1);
  }

  fill(0);
  noStroke();
  textSize(25);
  textAlign(LEFT);
  text(`TIME: ${score}s`, 30, 40);
  if (passedSeconds >= 180) {
    fill(255, 0, 0);
    text(`WARNING: FAST BALLS!`, 30, 70);
  }
}

class Pipe {
  // 오른쪽에서 날아오는 파이프 클래스
  constructor(speed) {
    this.spacing = 180;
    this.top = random(100, height - this.spacing - 100);
    this.x = width;
    this.w = 50;
    this.speed = speed;
  }
  show() {
    stroke(0);
    strokeWeight(3);
    fill(255);
    rect(this.x, 0, this.w, this.top);
    rect(this.x, this.top + this.spacing, this.w, height);
  }
  update() {
    this.x -= this.speed;
  }
  offscreen() {
    return this.x < -this.w;
  }
  hits(px, py) {
    if (
      px + PLAYER_HITBOX_RADIUS > this.x &&
      px - PLAYER_HITBOX_RADIUS < this.x + this.w
    ) {
      if (
        py - PLAYER_HITBOX_RADIUS < this.top ||
        py + PLAYER_HITBOX_RADIUS > this.top + this.spacing
      ) {
        return true;
      }
    }
    return false;
  }
}

function startGame() {
  // 닉네임 입력받고 게임 시작
  userNickname = document.getElementById("nickname").value || "ANON";
  if (!playerAvatar) {
    window.alert("먼저 SCAN FACE 버튼으로 얼굴을 스캔해주세요.");
    return;
  }

  document.getElementById("home-screen").style.display = "none";
  document.getElementById("gameover-screen").style.display = "none";
  gameState = "COUNT";
  let timer = setInterval(() => {
    countdown--;
    if (countdown <= 0) {
      clearInterval(timer);
      gameState = "PLAY";
      score = 0;
      pipes = [];
      balls = [];
      countdown = 3;
      gameStartTime = millis();
    }
  }, 1000);
}
// 게임 오버 화면에서 재시작
function drawCountdown() {
  fill(0);
  textSize(64);
  textAlign(CENTER, CENTER);
  text(countdown, width / 2, height / 2);
}
// 게임 종료 처리
function endGame() {
  gameState = "GAMEOVER";
  saveScore(userNickname, score);
  document.getElementById("gameover-screen").style.display = "block";
  document.getElementById("final-score").innerText = `SURVIVED: ${score}s`;
  showMyRank(score);
}
// 점수 저장하기
function saveScore(name, score) {
  let ranking = JSON.parse(localStorage.getItem("doodle_rank")) || [];
  ranking.push({ name, score });
  ranking.sort((a, b) => b.score - a.score);
  localStorage.setItem("doodle_rank", JSON.stringify(ranking.slice(0, 10)));
}
// 랭킹 화면 보여주기
function showRanking() {
  document.getElementById("home-screen").style.display = "none";
  document.getElementById("ranking-screen").style.display = "block";
  let ranking = JSON.parse(localStorage.getItem("doodle_rank")) || [];
  let listHTML = ranking
    .map((i, idx) => `<div>${idx + 1}. ${i.name} - ${i.score}s</div>`)
    .join("");
  document.getElementById("ranking-list").innerHTML = listHTML || "NO DATA";
}
// 내 랭킹 보여주기
function showMyRank(score) {
  let ranking = JSON.parse(localStorage.getItem("doodle_rank")) || [];
  let rank = ranking.findIndex((i) => i.score === score) + 1;
  document.getElementById("my-rank").innerText = `YOUR RANK: ${rank}`;
}
// 홈 화면으로 돌아가기
function showHome() {
  gameState = "HOME";
  resetPlayerAvatar();
  document
    .querySelectorAll(".screen")
    .forEach((s) => (s.style.display = "none"));
  document.getElementById("home-screen").style.display = "block";
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
