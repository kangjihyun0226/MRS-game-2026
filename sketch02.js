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

  // 픽셀 검사를 완전히 걷어내고 그램 맞춤형 고성능 수학 연산으로 처리
  hits(px, py) {
    let pr = PLAYER_HITBOX_RADIUS;
    let closestX = constrain(px, this.x, this.x + this.w);
    let closestY = constrain(py, this.y, this.y + this.h);
    let dx = px - closestX;
    let dy = py - closestY;
    return dx * dx + dy * dy < pr * pr;
  }
}

function runGame() {
  let elapsed = millis() - gameStartTime;
  score = elapsed / 1000;

  currentSpeed = min(16, 6.5 + score * 0.045);
  spawnInterval = max(42, 85 - score * 0.2);

  let canSpawnPipe = false;
  if (pipes.length === 0) {
    if (frameCount % floor(spawnInterval) === 0) canSpawnPipe = true;
  } else {
    let lastPipe = pipes[pipes.length - 1];
    let lastPipeMaxW = max(lastPipe.topW, lastPipe.bottomW);
    let lastPipeRightEdge = lastPipe.x + lastPipeMaxW;
    let dynamicSafeGap = max(260, 340 - score * 0.5);

    if (width - lastPipeRightEdge >= dynamicSafeGap) {
      if (frameCount % floor(spawnInterval) === 0) canSpawnPipe = true;
    }
  }

  if (canSpawnPipe) {
    pipes.push(new Pipe(currentSpeed, spawnInterval));
  }

  for (let i = pipes.length - 1; i >= 0; i--) {
    let p = pipes[i];
    p.update();
    p.show();
    if (p.hits(playerX, playerY)) {
      playerDie();
      return;
    }
    if (p.offscreen()) pipes.splice(i, 1);
  }

  // [수정 사항 반영]: 정확히 60초(1분) 경과 후부터 공 습격 개시!
  if (score >= 60.0) {
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
      return;
    }
    if (b.offscreen()) balls.splice(i, 1);
  }

  fill(0);
  noStroke();
  textSize(25);
  textAlign(LEFT);
  text("TIME: " + score.toFixed(3) + "s", 30, 40);

  let heartString = "";
  for (let i = 1; i <= 3; i++) heartString += i <= lives ? "♥" : "♡";
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
  }

  show() {
    // 그램 노트북을 위해 push/pop 연산 내부의 이미지 그리기 비용 최적화
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

  // 기둥 장애물 역시 수천 개 픽셀 서치를 제거하고 고속 경계면 연산으로 압축
  hits(px, py) {
    let pr = PLAYER_HITBOX_RADIUS;

    // 상단 기둥 박스 검사
    let closestX1 = constrain(px, this.x, this.x + this.topW);
    let closestY1 = constrain(py, 0, this.top);
    let dx1 = px - closestX1;
    let dy1 = py - closestY1;
    if (dx1 * dx1 + dy1 * dy1 < pr * pr) return true;

    // 하단 기둥 박스 검사
    let closestX2 = constrain(px, this.x, this.x + this.bottomW);
    let closestY2 = constrain(py, this.bottomY, height);
    let dx2 = px - closestX2;
    let dy2 = py - closestY2;
    if (dx2 * dx2 + dy2 * dy2 < pr * pr) return true;

    return false;
  }
}
