let video;
let faceMesh;
let faces = [];
let gameState = "HOME"; // HOME, COUNT, PLAY, GAMEOVER
let pipes = [];
let score = 0;
let countdown = 3;
let userNickname = "";

// 성능 최적화: ml5 옵션 설정
const options = { maxFaces: 1, refineLandmarks: false, flipHorizontal: true };

function preload() {
  faceMesh = ml5.faceMesh(options);
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();
  faceMesh.detectStart(video, gotFaces);
  frameRate(60);
}

function gotFaces(results) {
  faces = results;
}

function draw() {
  background(255);

  // 웹캠 배경 출력 (Mirror 효과)
  push();
  translate(width, 0);
  scale(-1, 1);
  // 성능을 위해 영상 불투명도를 낮춰 배경처럼 처리
  tint(255, 50);
  image(video, 0, 0, width, height);
  pop();

  if (gameState === "COUNT") drawCountdown();
  else if (gameState === "PLAY") runGame();

  drawCharacter();
}

function drawCharacter() {
  // 1. 얼굴 데이터가 있는지 먼저 확인
  if (faces.length > 0) {
    let face = faces[0];
    let nose = face.keypoints[1]; // 코 끝 지점

    // [중요 수정] 640, 480 대신 실제 비디오의 가로/세로 크기를 사용합니다.
    // 이렇게 하면 어떤 노트북 웹캠에서도 공이 화면 좌표에 정확히 매핑됩니다.
    let x = map(nose.x, 0, video.width, 0, width);
    let y = map(nose.y, 0, video.height, 0, height);

    // 2. 혹시 모를 오차를 방지하기 위해 화면 안으로 좌표를 강제 제한(constrain)
    x = constrain(x, 0, width);
    y = constrain(y, 0, height);

    // Doodle 스타일 캐릭터 그리기
    stroke(0);
    strokeWeight(3);
    fill(255);
    ellipse(x, y, 40, 40);

    // 전역 변수에 현재 위치 저장 (장애물 충돌 판정용)
    playerX = x;
    playerY = y;
  }
}

function runGame() {
  if (frameCount % 80 === 0) pipes.push(new Pipe());

  for (let i = pipes.length - 1; i >= 0; i--) {
    pipes[i].update();
    pipes[i].show();

    if (pipes[i].hits(playerX, playerY)) endGame();
    if (pipes[i].offscreen()) {
      pipes.splice(i, 1);
      score++;
    }
  }

  // 타이머/스코어 표시
  fill(0);
  noStroke();
  textSize(20);
  textAlign(LEFT);
  text(`SCORE: ${score}`, 30, 40);
}

class Pipe {
  constructor() {
    this.spacing = 180; // 간격
    this.top = random(100, height - this.spacing - 100);
    this.x = width;
    this.w = 50;
    this.speed = 6;
  }

  show() {
    stroke(0);
    strokeWeight(3);
    fill(255);
    // 상단 기둥
    rect(this.x, 0, this.w, this.top);
    // 하단 기둥
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

// UI 컨트롤 함수들
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
      countdown = 3;
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
  document.getElementById("final-score").innerText = `SCORE: ${score}`;
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
    .map((i, idx) => `<div>${idx + 1}. ${i.name} - ${i.score}</div>`)
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
  // 공이 화면 밖으로 나가지 않도록 보정
  playerX = constrain(playerX, 0, width);
  playerY = constrain(playerY, 0, height);
}
