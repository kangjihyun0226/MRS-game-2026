// 게임 플레이 실시간 루프
function runGame() {
  let elapsed = millis() - gameStartTime;
  // 밀리초 실시간 동기화로 타이머 점수 부여
  score = elapsed / 1000;

  currentSpeed = min(16, 6.5 + score * 0.045);
  spawnInterval = max(42, 85 - score * 0.2);

  // 💡 [전체 간격 문제 해결의 핵심]: 물리적 거리 기반 스폰 제어
  // 단순히 시간(프레임)만 체크하는 것이 아니라, 화면에 존재하는 가장 최근 파이프의 우측 끝(꼬리) 위치를 추적합니다.
  let canSpawnPipe = false;
  if (pipes.length === 0) {
    // 화면에 파이프가 하나도 없다면 정해진 프레임 주기에 맞춰 스폰
    if (frameCount % floor(spawnInterval) === 0) {
      canSpawnPipe = true;
    }
  } else {
    // 가장 마지막에 생성되어 들어온 파이프를 가져옵니다.
    let lastPipe = pipes[pipes.length - 1];

    // 이전 파이프의 실제 가로폭 중 더 넓은 쪽을 기준으로 꼬리 위치(x + width)를 계산합니다.
    let lastPipeMaxW = max(lastPipe.topW, lastPipe.bottomW);
    let lastPipeRightEdge = lastPipe.x + lastPipeMaxW;

    // 플레이어가 통과 후 다음 파이프를 준비할 수 있는 수평 안전 간격 (최소 260px ~ 스코어에 따라 유동적 조절)
    let dynamicSafeGap = max(260, 340 - score * 0.5);

    // 다음 파이프가 스폰될 위치(width = 화면 오른쪽 끝)와 이전 파이프 꼬리 사이의 거리가 안전 간격보다 멀어졌을 때만 스폰을 허용합니다.
    if (width - lastPipeRightEdge >= dynamicSafeGap) {
      // 안전거리가 확보된 상태에서 기본 스폰 주기 타이밍까지 맞았다면 스폰 요청
      if (frameCount % floor(spawnInterval) === 0) {
        canSpawnPipe = true;
      }
    }
  }

  // 허가가 떨어졌을 때만 새로운 파이프를 배열에 추가합니다.
  if (canSpawnPipe) {
    pipes.push(new Pipe(currentSpeed, spawnInterval));
  }

  for (let i = pipes.length - 1; i >= 0; i--) {
    pipes[i].update();
    pipes[i].show();
    if (pipes[i].hits(playerX, playerY)) playerDie();
    if (pipes[i].offscreen()) pipes.splice(i, 1);
  }

  // 정확히 60초(1분) 경과 후부터 공 습격 개시
  if (score >= 10) {
    let ballSpawnRate = max(55, 95 - floor((score - 60) * 0.2));
    if (frameCount % floor(ballSpawnRate) === 0) {
      balls.push(new Ball(currentSpeed));
    }
  }

  for (let i = balls.length - 1; i >= 0; i--) {
    balls[i].update();
    balls[i].show();
    if (balls[i].hits(playerX, playerY)) playerDie();
    if (balls[i].offscreen()) balls.splice(i, 1);
  }

  // 좌상단 타이머 UI 표출 (소수점 셋째 자리 고정)
  fill(0);
  noStroke();
  textSize(25);
  textAlign(LEFT);
  text('TIME: ' + score.toFixed(3) + 's', 30, 40);

  // 우상단 동적 하트 상태 스트링 바인딩 (♥♥♥ -> ♥♥♡ -> ♥♡♡)
  let heartString = '';
  for (let i = 1; i <= 3; i++) {
    if (i <= lives) heartString += '♥';
    else heartString += '♡';
  }
  textAlign(RIGHT);
  textSize(28);
  fill(0, 0, 0);
  text(heartString, width - 30, 45);
}

class Pipe {
  constructor(speed, currentSpawnInterval) {
    this.x = width;
    this.speed = speed;

    this.topImg = random(longImages);
    this.bottomImg = random(longImages);

    this.spacing = max(190, 240 - score * 0.6);
    let minTop = 60;
    let maxTop = height - this.spacing - 60;

    // 1. 임시 높이를 기준으로 현재 스폰될 파이프들의 유동적인 가로폭을 먼저 계산합니다.
    let tempTop = random(minTop, maxTop);
    let tempTopW = tempTop * (this.topImg.width / this.topImg.height);
    let tempBottomH = height - (tempTop + this.spacing);
    let tempBottomW =
      tempBottomH * (this.bottomImg.width / this.bottomImg.height);
    let currentMaxW = max(tempTopW, tempBottomW);

    if (lastPipeTop === -1) {
      this.top = tempTop;
    } else {
      // Y축 이동 가능 범위 계산 및 억까 방지
      let moveDistance = currentSpawnInterval * speed;
      let lastMaxW = max(
        lastPipeTop * (this.topImg.width / this.topImg.height),
        (height - (lastPipeTop + lastPipeSpacing)) *
          (this.bottomImg.width / this.bottomImg.height),
      );
      if (isNaN(lastMaxW) || lastMaxW <= 0) lastMaxW = 70;

      let minRequiredHorizontalGap = lastMaxW / 2 + currentMaxW / 2 + 80;

      let estimatedFrames = currentSpawnInterval;
      if (moveDistance < minRequiredHorizontalGap) {
        estimatedFrames += (minRequiredHorizontalGap - moveDistance) / speed;
      }

      let maxUserSpeedPerFrame = 8;
      let framesToPassPipe = currentMaxW / speed;
      let effectiveFrames = max(15, estimatedFrames - framesToPassPipe);
      let safeDeltaY = effectiveFrames * maxUserSpeedPerFrame;

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

    // 최종 확정된 높이에 맞춰 실제 이미지 가로폭 최종 할당
    this.topW = this.top * (this.topImg.width / this.topImg.height);
    this.bottomW =
      this.bottomH * (this.bottomImg.width / this.bottomImg.height);
  }

  show() {
    // 1. 상단 파이프 (회전 및 변환)
    push();
    translate(this.x + this.topW / 2, this.top / 2);
    rotate(PI);
    imageMode(CENTER);
    image(this.topImg, 0, 0, this.topW, this.top);
    pop();

    // 2. 하단 파이프
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

    // 1. 상단 기둥 픽셀 충돌 검사
    if (
      py - pr < this.top &&
      px + pr >= this.x &&
      px - pr <= this.x + this.topW
    ) {
      let overlapLeft = max(px - pr, this.x);
      let overlapRight = min(px + pr, this.x + this.topW);
      let overlapTop = max(py - pr, 0);
      let overlapBottom = min(py + pr, this.top);

      let step = 4;
      this.topImg.loadPixels();
      for (let y = overlapTop; y < overlapBottom; y += step) {
        for (let x = overlapLeft; x < overlapRight; x += step) {
          if (dist(x, y, px, py) < pr) {
            let originalImgX = floor(
              map(x, this.x, this.x + this.topW, 0, this.topImg.width),
            );
            let originalImgY = floor(
              map(y, 0, this.top, 0, this.topImg.height),
            );

            let imgX = this.topImg.width - 1 - originalImgX;
            let imgY = this.topImg.height - 1 - originalImgY;

            if (
              imgX >= 0 &&
              imgX < this.topImg.width &&
              imgY >= 0 &&
              imgY < this.topImg.height
            ) {
              if (
                this.topImg.pixels[(imgX + imgY * this.topImg.width) * 4 + 3] >
                50
              ) {
                return true;
              }
            }
          }
        }
      }
    }

    // 2. 하단 기둥 픽셀 충돌 검사
    if (
      py + pr > this.bottomY &&
      px + pr >= this.x &&
      px - pr <= this.x + this.bottomW
    ) {
      let overlapLeft = max(px - pr, this.x);
      let overlapRight = min(px + pr, this.x + this.bottomW);
      let overlapTop = max(py - pr, this.bottomY);
      let overlapBottom = min(py + pr, height);

      let step = 4;
      this.bottomImg.loadPixels();
      for (let y = overlapTop; y < overlapBottom; y += step) {
        for (let x = overlapLeft; x < overlapRight; x += step) {
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
              ) {
                return true;
              }
            }
          }
        }
      }
    }
    return false;
  }
}

// 최초 게임 실행 시작 단추
function startGame() {
  userNickname = document.getElementById('nickname').value || 'ANON';
  if (!playerAvatar) {
    window.alert('먼저 SCAN FACE 버튼으로 얼굴을 스캔해주세요.');
    return;
  }

  lives = 3;
  attemptScores = [];

  prepareNextAttempt();
}

// 각각의 시도 단계 진입 카운트다운 빌더
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

// 사망 시 기회 잔여 연산 로직
function playerDie() {
  lives--;
  attemptScores.push(score);

  if (lives > 0) {
    gameState = 'GAMEOVER';
    document.getElementById('gameover-screen').style.display = 'block';
    document.getElementById('final-score').innerText =
      '도전 기록: ' + score.toFixed(3) + 's';
    document.getElementById('my-rank').innerText = '남은 목숨: ' + lives + '';

    // 일반 사망 시 폰트 원래대로 스타일 환원
    document.getElementById('final-score').style.fontSize = '20px';
    document.getElementById('final-score').style.color = '#000';
    document.getElementById('final-score').style.fontWeight = 'normal';

    let actionBtn = document.querySelector('#gameover-screen button');
    if (actionBtn) {
      actionBtn.innerText = 'Replay';
      actionBtn.setAttribute('onclick', 'prepareNextAttempt()');
    }
  } else {
    // 목숨 소진 최종 게임아웃 마감처리
    endGame();
  }
}

function drawCountdown() {
  fill(0);
  textSize(64);
  textAlign(CENTER, CENTER);
  text(countdown, width / 2, height / 2);
}

// 최종 3회 기회 소진 시 마감 처리 함수
function endGame() {
  gameState = 'GAMEOVER';

  let bestScore = max(attemptScores);

  // [기능 추가]: 새로운 기록이 로컬 스토리지 내 TOP 8위 안에 진입하는지 실시간 검증
  let ranking = JSON.parse(localStorage.getItem('doodle_rank')) || [];
  let isTop8 = false;

  if (ranking.length < 8) {
    isTop8 = true;
  } else {
    let thresholdScore = ranking[7].score;
    if (bestScore > thresholdScore) {
      isTop8 = true;
    }
  }

  // 스코어 로컬 저장소 업데이트 실행
  saveScore(userNickname, bestScore);

  document.getElementById('gameover-screen').style.display = 'block';

  if (isTop8) {
    let finalScoreElement = document.getElementById('final-score');
    finalScoreElement.innerText =
      '🎉 !!순위권!! 진입 🎉\n최종 최고 기록: ' + bestScore.toFixed(3) + 's';

    finalScoreElement.style.fontSize = '32px';
    finalScoreElement.style.color = '#ff3366';
    finalScoreElement.style.fontWeight = 'bold';
    finalScoreElement.style.lineHeight = '1.5';
  } else {
    let finalScoreElement = document.getElementById('final-score');
    finalScoreElement.innerText =
      '최종 최고 기록: ' + bestScore.toFixed(3) + 's';
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
  ranking.push({ name: name, score: parseFloat(finalBestScore.toFixed(3)) });
  ranking.sort((a, b) => b.score - a.score);
  localStorage.setItem('doodle_rank', JSON.stringify(ranking.slice(0, 10)));
}

function showRanking() {
  document.getElementById('home-screen').style.display = 'none';
  document.getElementById('ranking-screen').style.display = 'block';
  let ranking = JSON.parse(localStorage.getItem('doodle_rank')) || [];
  let listHTML = ranking
    .map(
      (i, idx) =>
        '<div>' +
        (idx + 1) +
        '. ' +
        i.name +
        ' - ' +
        i.score.toFixed(3) +
        's</div>',
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

  if (rank <= 0) {
    rank = ranking.findIndex((i) => formattedScore >= i.score) + 1;
  }

  if (rank > 0 && rank <= ranking.length) {
    document.getElementById('my-rank').innerText = 'YOUR RANK: ' + rank + '위';
  } else {
    document.getElementById('my-rank').innerText = 'YOUR RANK: 순위권 외';
  }
}

function showHome() {
  gameState = 'HOME';
  resetPlayerAvatar();
  document
    .querySelectorAll('.screen')
    .forEach((s) => (s.style.display = 'none'));
  document.getElementById('home-screen').style.display = 'block';
}
