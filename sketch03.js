function runGame() {
  score = (millis() - gameStartTime) / 1000;
  currentSpeed = min(16, 6.5 + score * 0.045);
  spawnInterval = max(42, 85 - score * 0.2);

  let canSpawnPipe = false;
  if (pipes.length === 0) {
    if (frameCount % floor(spawnInterval) === 0) canSpawnPipe = true;
  } else {
    let lastPipe = pipes[pipes.length - 1];
    let lastPipeRightEdge = lastPipe.x + max(lastPipe.topW, lastPipe.bottomW);
    if (
      width - lastPipeRightEdge >= max(260, 340 - score * 0.5) &&
      frameCount % floor(spawnInterval) === 0
    ) {
      canSpawnPipe = true;
    }
  }
  if (canSpawnPipe) pipes.push(new Pipe(currentSpeed, spawnInterval));

  for (let i = pipes.length - 1; i >= 0; i--) {
    pipes[i].update();
    pipes[i].show();
    if (pipes[i].hits(playerX, playerY)) playerDie();
    if (pipes[i].offscreen()) pipes.splice(i, 1);
  }

  if (score >= 10) {
    let ballSpawnRate = max(55, 95 - floor((score - 60) * 0.2));
    if (frameCount % floor(ballSpawnRate) === 0)
      balls.push(new Ball(currentSpeed));
  }

  for (let i = balls.length - 1; i >= 0; i--) {
    balls[i].update();
    balls[i].show();
    if (balls[i].hits(playerX, playerY)) playerDie();
    if (balls[i].offscreen()) balls.splice(i, 1);
  }

  fill(0);
  noStroke();
  textSize(25);
  textAlign(LEFT);
  text(`TIME: ${score.toFixed(3)}s`, 30, 40);

  let heartString = '♥'.repeat(max(0, lives)) + '♡'.repeat(max(0, 3 - lives));
  textAlign(RIGHT);
  textSize(28);
  fill(0);
  text(heartString, width - 30, 45);
}

class Pipe {
  constructor(speed, currentSpawnInterval) {
    this.x = width;
    this.speed = speed;
    this.topImg = random(longImages);
    this.bottomImg = random(longImages);
    this.spacing = max(190, 240 - score * 0.6);
    let minTop = 60,
      maxTop = height - this.spacing - 60;

    ```
let tempTop = random(minTop, maxTop);
let tempTopW = tempTop * (this.topImg.width / this.topImg.height);
let tempBottomH = height - (tempTop + this.spacing);
let tempBottomW = tempBottomH * (this.bottomImg.width / this.bottomImg.height);
let currentMaxW = max(tempTopW, tempBottomW);

if (lastPipeTop === -1) {
  this.top = tempTop;
} else {
  let moveDistance = currentSpawnInterval * speed;
  let lastMaxW = max(
    lastPipeTop * (this.topImg.width / this.topImg.height),
    (height - (lastPipeTop + lastPipeSpacing)) * (this.bottomImg.width / this.bottomImg.height)
  );
  if (isNaN(lastMaxW) || lastMaxW <= 0) lastMaxW = 70;

  let minRequiredHorizontalGap = lastMaxW / 2 + currentMaxW / 2 + 80;
  let estimatedFrames = currentSpawnInterval;
  if (moveDistance < minRequiredHorizontalGap) estimatedFrames += (minRequiredHorizontalGap - moveDistance) / speed;

  let safeDeltaY = max(15, estimatedFrames - (currentMaxW / speed)) * 8;
  let lastCenter = lastPipeTop + lastPipeSpacing / 2;
  let allowedCenterMin = max(minTop + this.spacing / 2, lastCenter - safeDeltaY);
  let allowedCenterMax = min(maxTop + this.spacing / 2, lastCenter + safeDeltaY);

  let chosenCenter, attempts = 0;
  do {
    chosenCenter = random(allowedCenterMin, allowedCenterMax);
    attempts++;
  } while (abs(chosenCenter - lastCenter) < 60 && attempts < 10);

  this.top = constrain(chosenCenter - this.spacing / 2, minTop, maxTop);
}

lastPipeTop = this.top;
lastPipeSpacing = this.spacing;
this.bottomY = this.top + this.spacing;
this.bottomH = height - this.bottomY;
this.topW = this.top * (this.topImg.width / this.topImg.height);
this.bottomW = this.bottomH * (this.bottomImg.width / this.bottomImg.height);

```;
  }

  show() {
    push();
    translate(this.x + this.topW / 2, this.top / 2);
    rotate(PI);
    imageMode(CENTER);
    image(this.topImg, 0, 0, this.topW, this.top);
    pop();
    imageMode(CORNER);
    image(this.bottomImg, this.x, this.bottomY, this.bottomW, this.bottomH);
  }

  update() {
    this.x -= this.speed;
  }
  offscreen() {
    return this.x < -max(this.topW, this.bottomW);
  }

  hits(px, py) {
    let pr = PLAYER_HITBOX_RADIUS;
    if (
      py - pr < this.top &&
      px + pr >= this.x &&
      px - pr <= this.x + this.topW
    ) {
      let overlapLeft = max(px - pr, this.x),
        overlapRight = min(px + pr, this.x + this.topW);
      let overlapTop = max(py - pr, 0),
        overlapBottom = min(py + pr, this.top);
      this.topImg.loadPixels();
      for (let y = overlapTop; y < overlapBottom; y += 4) {
        for (let x = overlapLeft; x < overlapRight; x += 4) {
          if (dist(x, y, px, py) < pr) {
            let imgX =
              this.topImg.width -
              1 -
              floor(map(x, this.x, this.x + this.topW, 0, this.topImg.width));
            let imgY =
              this.topImg.height -
              1 -
              floor(map(y, 0, this.top, 0, this.topImg.height));
            if (
              imgX >= 0 &&
              imgX < this.topImg.width &&
              imgY >= 0 &&
              imgY < this.topImg.height
            ) {
              if (
                this.topImg.pixels[(imgX + imgY * this.topImg.width) * 4 + 3] >
                50
              )
                return true;
            }
          }
        }
      }
    }
    if (
      py + pr > this.bottomY &&
      px + pr >= this.x &&
      px - pr <= this.x + this.bottomW
    ) {
      let overlapLeft = max(px - pr, this.x),
        overlapRight = min(px + pr, this.x + this.bottomW);
      let overlapTop = max(py - pr, this.bottomY),
        overlapBottom = min(py + pr, height);
      this.bottomImg.loadPixels();
      for (let y = overlapTop; y < overlapBottom; y += 4) {
        for (let x = overlapLeft; x < overlapRight; x += 4) {
          if (dist(x, y, px, py) < pr) {
            let imgX = floor(
              map(x, this.x, this.x + this.bottomW, 0, this.bottomImg.width),
            );
            let imgY = floor(
              map(y, this.bottomY, height, 0, this.bottomImg.height),
            );
            if (
              imgX >= 0 &&
              imgX < this.bottomImg.width &&
              imgY >= 0 &&
              imgY < this.bottomImg.height
            ) {
              if (
                this.bottomImg.pixels[
                  (imgX + imgY * this.bottomImg.width) * 4 + 3
                ] > 50
              )
                return true;
            }
          }
        }
      }
    }
    return false;
  }
}

function startGame() {
  userNickname = document.getElementById('nickname').value || 'ANON';
  if (!playerAvatar)
    return window.alert('먼저 SCAN FACE 버튼으로 얼굴을 스캔해주세요.');
  lives = 3;
  attemptScores = [];
  prepareNextAttempt();
}

function prepareNextAttempt() {
  document.getElementById('home-screen').style.display = 'none';
  document.getElementById('gameover-screen').style.display = 'none';
  gameState = 'COUNT';
  countdown = 3;
  lastPipeTop = -1;
  lastPipeSpacing = -1;
  pipes = [];
  balls = [];

  let timer = setInterval(() => {
    countdown--;
    if (countdown <= 0) {
      clearInterval(timer);
      gameState = 'PLAY';
      gameStartTime = millis();
    }
  }, 1000);
}

function playerDie() {
  lives--;
  attemptScores.push(score);
  if (lives > 0) {
    gameState = 'GAMEOVER';
    document.getElementById('gameover-screen').style.display = 'block';
    document.getElementById('final-score').innerText =
      `도전 기록: ${score.toFixed(3)}s`;
    document.getElementById('my-rank').innerText = `남은 목숨: ${lives}`;

    ```
let fs = document.getElementById('final-score').style;
fs.fontSize = '20px'; fs.color = '#000'; fs.fontWeight = 'normal';

let actionBtn = document.querySelector('#gameover-screen button');
if (actionBtn) {
  actionBtn.innerText = 'Replay'; actionBtn.setAttribute('onclick', 'prepareNextAttempt()');
}

```;
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
  gameState = 'GAMEOVER';
  let bestScore = max(attemptScores),
    ranking = JSON.parse(localStorage.getItem('doodle_rank')) || [];
  let isTop8 = ranking.length < 8 || bestScore > ranking[7].score;

  saveScore(userNickname, bestScore);
  document.getElementById('gameover-screen').style.display = 'block';

  let finalScoreElement = document.getElementById('final-score');
  if (isTop8) {
    finalScoreElement.innerText = `🎉 !!순위권!! 진입 🎉\n최종 최고 기록: ${bestScore.toFixed(3)}s`;
    finalScoreElement.style.fontSize = '32px';
    finalScoreElement.style.color = '#ff3366';
    finalScoreElement.style.fontWeight = 'bold';
    finalScoreElement.style.lineHeight = '1.5';
  } else {
    finalScoreElement.innerText = `최종 최고 기록: ${bestScore.toFixed(3)}s`;
    finalScoreElement.style.fontSize = '20px';
    finalScoreElement.style.color = '#000';
    finalScoreElement.style.fontWeight = 'normal';
  }

  let actionBtn = document.querySelector('#gameover-screen button');
  if (actionBtn) {
    actionBtn.innerText = 'HOME';
    actionBtn.setAttribute('onclick', 'showHome()');
  }
  showMyRank(bestScore);
}

function saveScore(name, finalBestScore) {
  let ranking = JSON.parse(localStorage.getItem('doodle_rank')) || [];
  ranking.push({ name, score: parseFloat(finalBestScore.toFixed(3)) });
  ranking.sort((a, b) => b.score - a.score);
  localStorage.setItem('doodle_rank', JSON.stringify(ranking.slice(0, 10)));
}

function showRanking() {
  document.getElementById('home-screen').style.display = 'none';
  document.getElementById('ranking-screen').style.display = 'block';
  let ranking = JSON.parse(localStorage.getItem('doodle_rank')) || [];
  let listHTML = ranking
    .map(
      (i, idx) => `<div>${idx + 1}. ${i.name} - ${i.score.toFixed(3)}s</div>`,
    )
    .join('');
  document.getElementById('ranking-list').innerHTML = listHTML || 'NO DATA';
}

function showMyRank(finalBestScore) {
  let ranking = JSON.parse(localStorage.getItem('doodle_rank')) || [];
  let formattedScore = parseFloat(finalBestScore.toFixed(3));
  let rank =
    ranking.findIndex(
      (i) => i.name === userNickname && abs(i.score - formattedScore) < 0.0001,
    ) + 1;
  if (rank <= 0) rank = ranking.findIndex((i) => formattedScore >= i.score) + 1;

  document.getElementById('my-rank').innerText =
    rank > 0 && rank <= ranking.length
      ? `YOUR RANK: ${rank}위`
      : 'YOUR RANK: 순위권 외';
}

function showHome() {
  gameState = 'HOME';
  resetPlayerAvatar();
  document
    .querySelectorAll('.screen')
    .forEach((s) => (s.style.display = 'none'));
  document.getElementById('home-screen').style.display = 'block';
}
