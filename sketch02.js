class Ball {
  constructor(speed) {
    this.img = random(moveImages);
    let targetSize = 76;
    let aspect = this.img.width / this.img.height;
    if (aspect >= 1) {
      this.w = targetSize;
      this.h = targetSize / aspect;
    } else {
      this.h = targetSize;
      this.w = targetSize * aspect;
    }

    this.r = targetSize * 0.5;
    this.x = -this.w;
    this.y = random(100, height - 100);
    this.speed = speed * 1.15;

    // 초고성능 최적화 핵심: 생성 시점에 단 한 번만 loadPixels()를 호출
    this.img.loadPixels();
  }

  update() {
    this.x += this.speed;
  }

  show() {
    image(this.img, this.x, this.y, this.w, this.h);
  }

  offscreen() {
    return this.x > width + this.w;
  }

  hits(px, py) {
    let pr = PLAYER_HITBOX_RADIUS;

    // 최적화 단계 1: AABB (바운딩 박스) 충돌 확인 검사
    if (
      px + pr < this.x ||
      px - pr > this.x + this.w ||
      py + pr < this.y ||
      py - pr > this.y + this.h
    ) {
      return false;
    }

    let overlapLeft = max(px - pr, this.x);
    let overlapRight = min(px + pr, this.x + this.w);
    let overlapTop = max(py - pr, this.y);
    let overlapBottom = min(py + pr, this.y + this.h);
    let step = 4;

    // [성능 향상 포인트]: 매 프레임 수백만 픽셀 데이터를 로드하던 무거운 기존 코드 lines 제거함 (이미 생성자에서 수행 완료)

    for (let y = overlapTop; y < overlapBottom; y += step) {
      for (let x = overlapLeft; x < overlapRight; x += step) {
        // 거리를 연산할 때 무거운 내장 dist()대신 거듭제곱 비교 방식을 통해 루트 연산 생략으로 극한의 경량화 달성
        let dx = x - px;
        let dy = y - py;
        if (dx * dx + dy * dy < pr * pr) {
          let imgX = floor(map(x, this.x, this.x + this.w, 0, this.img.width));
          let imgY = floor(map(y, this.y, this.y + this.h, 0, this.img.height));

          if (
            imgX >= 0 &&
            imgX < this.img.width &&
            imgY >= 0 &&
            imgY < this.img.height
          ) {
            let alphaIdx = (imgX + imgY * this.img.width) * 4 + 3;
            if (this.img.pixels[alphaIdx] > 50) return true;
          }
        }
      }
    }
    return false;
  }
}

// 게임 플레이 실시간 루프
function runGame() {
  let elapsed = millis() - gameStartTime;
  score = elapsed / 1000;

  currentSpeed = min(16, 6.5 + score * 0.045);
  spawnInterval = max(42, 85 - score * 0.2);

  let canSpawnPipe = false;
  if (pipes.length === 0) {
    if (frameCount % floor(spawnInterval) === 0) {
      canSpawnPipe = true;
    }
  } else {
    let lastPipe = pipes[pipes.length - 1];
    let lastPipeMaxW = max(lastPipe.topW, lastPipe.bottomW);
    let lastPipeRightEdge = lastPipe.x + lastPipeMaxW;
    let dynamicSafeGap = max(260, 340 - score * 0.5);

    if (width - lastPipeRightEdge >= dynamicSafeGap) {
      if (frameCount % floor(spawnInterval) === 0) {
        canSpawnPipe = true;
      }
    }
  }

  if (canSpawnPipe) {
    pipes.push(new Pipe(currentSpeed, spawnInterval));
  }

  // 역순 루프로 배열 요소 안전 삭제 보장 및 렌더링 최적화
  for (let i = pipes.length - 1; i >= 0; i--) {
    let p = pipes[i];
    p.update();
    p.show();
    if (p.hits(playerX, playerY)) {
      playerDie();
      return; // 불필요한 연산 즉시 중단
    }
    if (p.offscreen()) pipes.splice(i, 1);
  }

  if (score >= 60) {
    let ballSpawnRate = max(55, 95 - floor((score - 60) * 0.2));
    if (frameCount % floor(ballSpawnRate) === 0) {
      balls.push(new Ball(currentSpeed));
    }
  }

  for (let i = balls.length - 1; i >= 0; i--) {
    let b = balls[i];
    b.update();
    b.show();
    if (b.hits(playerX, playerY)) {
      playerDie();
      return; // 불필요한 연산 즉시 중단
    }
    if (b.offscreen()) balls.splice(i, 1);
  }

  // UI 표출
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
    this.speed = speed;

    this.topImg = random(longImages);
    this.bottomImg = random(longImages);

    this.spacing = max(190, 240 - score * 0.6);
    let minTop = 60;
    let maxTop = height - this.spacing - 60;

    let tempTop = random(minTop, maxTop);
    let tempTopW = tempTop * (this.topImg.width / this.topImg.height);
    let tempBottomH = height - (tempTop + this.spacing);
    let tempBottomW =
      tempBottomH * (this.bottomImg.width / this.bottomImg.height);
    let currentMaxW = max(tempTopW, tempBottomW);

    if (lastPipeTop === -1) {
      this.top = tempTop;
    } else {
      let moveDistance = currentSpawnInterval * speed;
      let lastMaxW = max(
        lastPipeTop * (this.topImg.width / this.topImg.height),
        (height - (lastPipeTop + lastPipeSpacing)) *
          (this.bottomImg.width / this.bottomImg.height),
      );
      if (isNaN(lastMaxW) || lastMaxW <= 0) lastMaxW = 70;

      let minRequiredHorizontalGap = lastMaxW * 0.5 + currentMaxW * 0.5 + 80;
      let estimatedFrames = currentSpawnInterval;
      if (moveDistance < minRequiredHorizontalGap) {
        estimatedFrames += (minRequiredHorizontalGap - moveDistance) / speed;
      }

      let maxUserSpeedPerFrame = 8;
      let framesToPassPipe = currentMaxW / speed;
      let effectiveFrames = max(15, estimatedFrames - framesToPassPipe);
      let safeDeltaY = effectiveFrames * maxUserSpeedPerFrame;
      let lastCenter = lastPipeTop + lastPipeSpacing * 0.5;

      let allowedCenterMin = max(
        minTop + this.spacing * 0.5,
        lastCenter - safeDeltaY,
      );
      let allowedCenterMax = min(
        maxTop + this.spacing * 0.5,
        lastCenter + safeDeltaY,
      );

      let chosenCenter;
      let attempts = 0;
      do {
        chosenCenter = random(allowedCenterMin, allowedCenterMax);
        attempts++;
      } while (abs(chosenCenter - lastCenter) < 60 && attempts < 10);

      this.top = chosenCenter - this.spacing * 0.5;
      this.top = constrain(this.top, minTop, maxTop);
    }

    lastPipeTop = this.top;
    lastPipeSpacing = this.spacing;

    this.bottomY = this.top + this.spacing;
    this.bottomH = height - this.bottomY;

    this.topW = this.top * (this.topImg.width / this.topImg.height);
    this.bottomW =
      this.bottomH * (this.bottomImg.width / this.bottomImg.height);

    // 이미지별 일회성 loadPixels 처리로 연산 최적화 연계
    this.topImg.loadPixels();
    this.bottomImg.loadPixels();
  }

  show() {
    push();
    translate(this.x + this.topW * 0.5, this.top * 0.5);
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

    // 1. 상단 기둥 충돌 검사
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
      for (let y = overlapTop; y < overlapBottom; y += step) {
        for (let x = overlapLeft; x < overlapRight; x += step) {
          let dx = x - px,
            dy = y - py;
          if (dx * dx + dy * dy < pr * pr) {
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
              )
                return true;
            }
          }
        }
      }
    }

    // 2. 하단 기둥 충돌 검사
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
      for (let y = overlapTop; y < overlapBottom; y += step) {
        for (let x = overlapLeft; x < overlapRight; x += step) {
          let dx = x - px,
            dy = y - py;
          if (dx * dx + dy * dy < pr * pr) {
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
