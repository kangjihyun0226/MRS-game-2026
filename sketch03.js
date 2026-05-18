function runGame() {
  let elapsed = millis() - gameStartTime;
  score = elapsed / 1000;

  currentSpeed = min(16, 6.5 + score * 0.045);
  spawnInterval = max(42, 85 - score * 0.2);

  if (frameCount % floor(spawnInterval) === 0) {
    pipes.push(new Pipe(currentSpeed, spawnInterval));
  }
  for (let i = pipes.length - 1; i >= 0; i--) {
    pipes[i].update();
    pipes[i].show();
    if (pipes[i].hits(playerX, playerY)) {
      playerDie();
      return;
    }
    if (pipes[i].offscreen()) pipes.splice(i, 1);
  }

  // 60초 경과 후부터 공 스폰
  if (score >= 60.0) {
    let ballSpawnRate = max(55, 95 - floor((score - 60) * 0.2));
    if (frameCount % floor(ballSpawnRate) === 0) {
      balls.push(new Ball(currentSpeed));
    }
  }

  for (let i = balls.length - 1; i >= 0; i--) {
    balls[i].update();
    balls[i].show();
    if (balls[i].hits(playerX, playerY)) {
      playerDie();
      return;
    }
    if (balls[i].offscreen()) balls.splice(i, 1);
  }

  // UI 출력
  fill(0);
  noStroke();
  textSize(25);
  textAlign(LEFT);
  text("TIME: " + score.toFixed(3) + "s", 30, 40);

  let heartString = "";
  for (let i = 1; i <= 3; i++) {
    heartString += i <= lives ? "♥" : "♡";
  }
  textAlign(RIGHT);
  textSize(28);
  fill(0);
  text(heartString, width - 30, 45);
}

class Pipe {
  constructor(speed, currentSpawnInterval) {
    this.x = width;
    this.w = 70;
    this.speed = speed;

    this.topImg = random(longImages);
    this.bottomImg = random(longImages);

    this.spacing = max(190, 240 - score * 0.6);
    let minTop = 60;
    let maxTop = height - this.spacing - 60;

    if (lastPipeTop === -1) {
      this.top = random(minTop, maxTop);
    } else {
      let estimatedFrames = currentSpawnInterval;
      let maxUserSpeedPerFrame = 8;
      let safeDeltaY = estimatedFrames * maxUserSpeedPerFrame;
      let lastCenter = lastPipeTop + lastPipeSpacing / 2;

      let allowedCenterMin = max(
        minTop + this.spacing / 2,
        lastCenter - safeDeltaY,
      );
      let allowedCenterMax = min(
        maxTop + this.spacing / 2,
        lastCenter + safeDeltaY,
      );

      let chosenCenter;
      let attempts = 0;
      do {
        chosenCenter = random(allowedCenterMin, allowedCenterMax);
        attempts++;
      } while (abs(chosenCenter - lastCenter) < 60 && attempts < 10);

      this.top = chosenCenter - this.spacing / 2;
      this.top = constrain(this.top, minTop, maxTop);
    }

    lastPipeTop = this.top;
    lastPipeSpacing = this.spacing;

    this.bottomY = this.top + this.spacing;
    this.bottomH = height - this.bottomY;
  }

  show() {
    stroke(0); // 검은색 테두리
    strokeWeight(3); // 테두리 두께
    fill(255); // 흰색 사각형 배경

    // 1. 상단 파이프 그리기 (틀 + 이미지)
    // 흰색 사각형 바탕 먼저 깔기
    rect(this.x, 0, this.w, this.top);

    push();
    translate(this.x + this.w / 2, this.top / 2);
    rotate(PI);
    imageMode(CENTER);
    image(this.topImg, 0, 0, this.w, this.top); // 바탕 위에 이미지 얹기
    pop();

    // 2. 하단 파이프 그리기 (틀 + 이미지)
    // 흰색 사각형 바탕 먼저 깔기
    rect(this.x, this.bottomY, this.w, this.bottomH);

    imageMode(CORNER);
    image(this.bottomImg, this.x, this.bottomY, this.w, this.bottomH); // 바탕 위에 이미지 얹기
  }

  update() {
    this.x -= this.speed;
  }

  offscreen() {
    return this.x < -this.w;
  }

  hits(px, py) {
    let pr = PLAYER_HITBOX_RADIUS;

    // 1. 상단 기둥 박스형 충돌 검사
    let closestX1 = constrain(px, this.x, this.x + this.w);
    let closestY1 = constrain(py, 0, this.top);
    if (dist(px, py, closestX1, closestY1) < pr) return true;

    // 2. 하단 기둥 박스형 충돌 검사
    let closestX2 = constrain(px, this.x, this.x + this.w);
    let closestY2 = constrain(py, this.bottomY, height);
    if (dist(px, py, closestX2, closestY2) < pr) return true;

    return false;
  }
}

function startGame() {
  userNickname = document.getElementById("nickname").value || "ANON";
  if (!playerAvatar) {
    window.alert("먼저 SCAN FACE 버튼으로 얼굴을 스캔해주세요.");
    return;
  }
  lives = 3;
  attemptScores = [];
  prepareNextAttempt();
}

function prepareNextAttempt() {
  document.getElementById("home-screen").style.display = "none";
  document.getElementById("gameover-screen").style.display = "none";
  gameState = "COUNT";
  countdown = 3;

  lastPipeTop = -1;
  lastPipeSpacing = -1;
  pipes = [];
  balls = [];

  let timer = setInterval(() => {
    countdown--;
    if (countdown <= 0) {
      clearInterval(timer);
      gameState = "PLAY";
      gameStartTime = millis();
    }
  }, 1000);
}

function playerDie() {
  lives--;
  attemptScores.push(score);

  if (lives > 0) {
    gameState = "GAMEOVER";
    document.getElementById("gameover-screen").style.display = "block";
    document.getElementById("final-score").innerText =
      "도전 기록: " + score.toFixed(3) + "s";
    document.getElementById("my-rank").innerText = "남은 목숨: " + lives;

    let finalScoreStyle = document.getElementById("final-score").style;
    finalScoreStyle.fontSize = "20px";
    finalScoreStyle.color = "#000";
    finalScoreStyle.fontWeight = "normal";

    let actionBtn = document.querySelector("#gameover-screen button");
    if (actionBtn) {
      actionBtn.innerText = "Replay";
      actionBtn.setAttribute("onclick", "prepareNextAttempt()");
    }
  } else {
    endGame();
  }
}

function drawCountdown() {
  fill(0);
  textSize(64);
  textAlign(CENTER, CENTER);
  text(countdown, width / 2, height / 2);
}

function endGame() {
  gameState = "GAMEOVER";
  let bestScore = max(attemptScores);

  let ranking = JSON.parse(localStorage.getItem("doodle_rank")) || [];
  let isTop8 = ranking.length < 8 || bestScore > ranking[7].score;

  saveScore(userNickname, bestScore);
  document.getElementById("gameover-screen").style.display = "block";

  let finalScoreElement = document.getElementById("final-score");
  if (isTop8) {
    finalScoreElement.innerText =
      "🎉 !!순위권!! 진입 🎉\n최종 최고 기록: " + bestScore.toFixed(3) + "s";
    finalScoreElement.style.fontSize = "32px";
    finalScoreElement.style.color = "#ff3366";
    finalScoreElement.style.fontWeight = "bold";
    finalScoreElement.style.lineHeight = "1.5";
  } else {
    finalScoreElement.innerText =
      "최종 최고 기록: " + bestScore.toFixed(3) + "s";
    finalScoreElement.style.fontSize = "20px";
    finalScoreElement.style.color = "#000";
    finalScoreElement.style.fontWeight = "normal";
  }

  let actionBtn = document.querySelector("#gameover-screen button");
  if (actionBtn) {
    actionBtn.innerText = "HOME";
    actionBtn.setAttribute("onclick", "showHome()");
  }

  showMyRank(bestScore);
}

function saveScore(name, finalBestScore) {
  let ranking = JSON.parse(localStorage.getItem("doodle_rank")) || [];
  ranking.push({ name: name, score: parseFloat(finalBestScore.toFixed(3)) });
  ranking.sort((a, b) => b.score - a.score);
  localStorage.setItem("doodle_rank", JSON.stringify(ranking.slice(0, 10)));
}

function showRanking() {
  document.getElementById("home-screen").style.display = "none";
  document.getElementById("ranking-screen").style.display = "block";
  let ranking = JSON.parse(localStorage.getItem("doodle_rank")) || [];
  let listHTML = ranking
    .map(
      (i, idx) => `<div>${idx + 1}. ${i.name} - ${i.score.toFixed(3)}s</div>`,
    )
    .join("");
  document.getElementById("ranking-list").innerHTML = listHTML || "NO DATA";
}

function showMyRank(finalBestScore) {
  let ranking = JSON.parse(localStorage.getItem("doodle_rank")) || [];
  let formattedScore = parseFloat(finalBestScore.toFixed(3));

  let rank =
    ranking.findIndex(
      (i) => i.name === userNickname && abs(i.score - formattedScore) < 0.0001,
    ) + 1;
  if (rank <= 0) {
    rank = ranking.findIndex((i) => formattedScore >= i.score) + 1;
  }

  let myRankText =
    rank > 0 && rank <= ranking.length
      ? `YOUR RANK: ${rank}위`
      : "YOUR RANK: 순위권 외";
  document.getElementById("my-rank").innerText = myRankText;
}

function showHome() {
  gameState = "HOME";
  resetPlayerAvatar();
  document
    .querySelectorAll(".screen")
    .forEach((s) => (s.style.display = "none"));
  document.getElementById("home-screen").style.display = "block";
}
