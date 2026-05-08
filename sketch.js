let video;
let faceMesh;
let faces = [];
let gameState = "HOME";
let pipes = [];
let balls = []; // 추가: 왼쪽에서 오는 공 배열
let score = 0;
let countdown = 3;
let userNickname = "";

let gameStartTime;
let currentSpeed = 6;
let spawnInterval = 80;
let playerX, playerY;

const options = { maxFaces: 1, refineLandmarks: false, flipHorizontal: true };

function preload() {
  faceMesh = ml5.faceMesh(options);
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  frameRate(60);
  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();
  faceMesh.detectStart(video, gotFaces);
}

function gotFaces(results) {
  faces = results;
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
}

function drawCharacter() {
  if (faces.length > 0) {
    let face = faces[0];
    let nose = face.keypoints[1];
    let x = map(nose.x, 0, 640, 0, width);
    let y = map(nose.y, 0, 480, 0, height);
    stroke(0);
    strokeWeight(3);
    fill(255);
    ellipse(x, y, 40, 40);
    playerX = x;
    playerY = y;
  }
}

function runGame() {
  let elapsed = millis() - gameStartTime;
  let passedSeconds = floor(elapsed / 1000);
  score = passedSeconds;

  currentSpeed = 6 + passedSeconds * 0.023;
  spawnInterval = max(40, 80 - passedSeconds * 0.1);

  // --- 기존 파이프 로직 ---
  if (frameCount % floor(spawnInterval) === 0) {
    pipes.push(new Pipe(currentSpeed));
  }
  for (let i = pipes.length - 1; i >= 0; i--) {
    pipes[i].update();
    pipes[i].show();
    if (pipes[i].hits(playerX, playerY)) endGame();
    if (pipes[i].offscreen()) pipes.splice(i, 1);
  }

  // --- 추가: 3분(180초) 이후 공 장애물 생성 ---
  if (passedSeconds >= 1) {
    // 약 1.5초마다 하나씩 생성 (90프레임)
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

// 나머지 Pipe 클래스 및 UI 함수는 이전과 동일 (startGame 시 balls = [] 초기화만 추가)
class Pipe {
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
    if (px + 20 > this.x && px - 20 < this.x + this.w) {
      if (py - 20 < this.top || py + 20 > this.top + this.spacing) return true;
    }
    return false;
  }
}

function startGame() {
  userNickname = document.getElementById("nickname").value || "ANON";
  document.getElementById("home-screen").style.display = "none";
  gameState = "COUNT";
  let timer = setInterval(() => {
    countdown--;
    if (countdown <= 0) {
      clearInterval(timer);
      gameState = "PLAY";
      score = 0;
      pipes = [];
      balls = []; // 게임 시작 시 공 배열 초기화
      countdown = 3;
      gameStartTime = millis();
    }
  }, 1000);
}

function drawCountdown() {
  fill(0);
  textSize(64);
  textAlign(CENTER, CENTER);
  text(countdown, width / 2, height / 2);
}

function endGame() {
  gameState = "GAMEOVER";
  saveScore(userNickname, score);
  document.getElementById("gameover-screen").style.display = "block";
  document.getElementById("final-score").innerText = `SURVIVED: ${score}s`;
  showMyRank(score);
}

function saveScore(name, score) {
  let ranking = JSON.parse(localStorage.getItem("doodle_rank")) || [];
  ranking.push({ name, score });
  ranking.sort((a, b) => b.score - a.score);
  localStorage.setItem("doodle_rank", JSON.stringify(ranking.slice(0, 10)));
}

function showRanking() {
  document.getElementById("home-screen").style.display = "none";
  document.getElementById("ranking-screen").style.display = "block";
  let ranking = JSON.parse(localStorage.getItem("doodle_rank")) || [];
  let listHTML = ranking
    .map((i, idx) => `<div>${idx + 1}. ${i.name} - ${i.score}s</div>`)
    .join("");
  document.getElementById("ranking-list").innerHTML = listHTML || "NO DATA";
}

function showMyRank(score) {
  let ranking = JSON.parse(localStorage.getItem("doodle_rank")) || [];
  let rank = ranking.findIndex((i) => i.score === score) + 1;
  document.getElementById("my-rank").innerText = `YOUR RANK: ${rank}`;
}

function showHome() {
  gameState = "HOME";
  document
    .querySelectorAll(".screen")
    .forEach((s) => (s.style.display = "none"));
  document.getElementById("home-screen").style.display = "block";
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
