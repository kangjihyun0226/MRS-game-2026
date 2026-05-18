// 게임 플레이 실시간 루프
function runGame() {
  let elapsed = millis() - gameStartTime;
  // 밀리초 실시간 동기화로 타이머 점수 부여
  score = elapsed / 1000;

  currentSpeed = min(16, 6.5 + score * 0.045);
  spawnInterval = max(42, 85 - score * 0.2);

  if (frameCount % floor(spawnInterval) === 0) {
    pipes.push(new Pipe(currentSpeed, spawnInterval));
  }
  for (let i = pipes.length - 1; i >= 0; i--) {
    pipes[i].update();
    pipes[i].show();
    if (pipes[i].hits(playerX, playerY)) playerDie();
    if (pipes[i].offscreen()) pipes.splice(i, 1);
  }

  // 정확히 60초(1분) 경과 후부터 공 습격 개시
  if (score >= 60.0) {
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
    this.w = 70; // 기본 파이프 폭 기준값
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

    // [수정 완료] long6.svg(인덱스 5)만 비율 유지, 나머지는 가로폭 70 고정
    if (longImages.indexOf(this.topImg) === 5) {
      this.topW = this.top * (this.topImg.width / this.topImg.height);
    } else {
      this.topW = 70;
    }

    if (longImages.indexOf(this.bottomImg) === 5) {
      this.bottomW =
        this.bottomH * (this.bottomImg.width / this.bottomImg.height);
    } else {
      this.bottomW = 70;
    }
  }

  show() {
    // 1. 상단 파이프 (회전 및 변환)
    push();
    translate(this.x + this.topW / 2, this.top / 2);
    rotate(PI);
    imageMode(CENTER);
    image(this.topImg, 0, 0, this.topW, this.top);
    pop();

    // 💡 [누락 수정] p5.js의 그래픽 상태 복구 후, 하단 파이프 드로잉을 위해 모드를 CORNER로 안전하게 리셋
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
            // 💡 [정합성 수정] 상단 파이프가 180도 회전(rotate(PI))되어 그려지므로,
            // 픽셀을 매핑할 때도 이미지의 반대편 좌표(width - 원래좌표, height - 원래좌표)를 매핑해야 정확합니다!
            let originalImgX = floor(
              map(x, this.x, this.x + this.topW, 0, this.topImg.width),
            );
            let originalImgY = floor(
              map(y, 0, this.top, 0, this.topImg.height),
            );

            // 상하좌우가 뒤집힌 상태의 픽셀 좌표 매칭
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
    // 랭킹 데이터가 아직 8개 미만으로 등록되어 있다면 무조건 순위권
    isTop8 = true;
  } else {
    // 8번째 순위의 기존 데이터 점수와 비교
    let thresholdScore = ranking[7].score;
    if (bestScore > thresholdScore) {
      isTop8 = true;
    }
  }

  // 스코어 로컬 저장소 업데이트 실행
  saveScore(userNickname, bestScore);

  document.getElementById('gameover-screen').style.display = 'block';

  // [조건 반영]: 8등 안에 안착했을 때의 대형 이벤트 연출 분기문
  if (isTop8) {
    let finalScoreElement = document.getElementById('final-score');
    finalScoreElement.innerText =
      '🎉 !!순위권!! 진입 🎉\n최종 최고 기록: ' + bestScore.toFixed(3) + 's';

    // 큰 폰트 크기 및 눈에 띄는 하이라이트 스타일 세팅 추가
    finalScoreElement.style.fontSize = '32px';
    finalScoreElement.style.color = '#ff3366';
    finalScoreElement.style.fontWeight = 'bold';
    finalScoreElement.style.lineHeight = '1.5';
  } else {
    // 일반 순위권 밖 최종 출력 폰트
    let finalScoreElement = document.getElementById('final-score');
    finalScoreElement.innerText =
      '최종 최고 기록: ' + bestScore.toFixed(3) + 's';
    finalScoreElement.style.fontSize = '20px';
    finalScoreElement.style.color = '#000';
    finalScoreElement.style.fontWeight = 'normal';
  }

  // [조건 반영]: 밑에 홈 화면으로 나가는 전용 리셋 버튼 바인딩
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

  // 💡 저장할 때와 동일하게 소수점 3째짜리 실수형태로 포맷팅을 똑같이 맞춰줍니다.
  let formattedScore = parseFloat(finalBestScore.toFixed(3));

  // 이름과 점수가 모두 일치하는 위치를 찾습니다. (동점자 오류 방지)
  let rank =
    ranking.findIndex(
      (i) => i.name === userNickname && abs(i.score - formattedScore) < 0.0001,
    ) + 1;

  // 만약 정확 매칭을 못 찾았을 경우를 대비한 안전 장치
  if (rank <= 0) {
    rank = ranking.findIndex((i) => formattedScore >= i.score) + 1;
  }

  // 최종 화면 표출
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
