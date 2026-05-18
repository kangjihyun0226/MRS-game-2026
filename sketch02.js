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

    this.r = targetSize / 2;
    this.x = -this.w;
    this.y = random(100, height - 100);
    this.speed = speed * 1.15;
  }

  update() {
    this.x += this.speed;
  }

  show() {
    push();
    // 공의 중심 좌표 계산
    let centerX = this.x + this.w / 2;
    let centerY = this.y + this.h / 2;

    // 1. 기본 틀: 흰색 바탕에 검정색 스트로크를 가진 원 그리기
    stroke(0); // 검은색 테두리
    strokeWeight(3); // 테두리 두께
    fill(255); // 흰색 채우기

    // 가로나 세로 중 더 큰 쪽을 기준으로 원형 배경 크기 지정 (여백 6px 추가해서 이쁘게 포장)
    let bgDiameter = max(this.w, this.h) + 6;
    ellipse(centerX, centerY, bgDiameter, bgDiameter);

    // 2. 그 위에 SVG 이미지 얹기
    imageMode(CENTER);
    image(this.img, centerX, centerY, this.w, this.h);
    pop();
  }

  offscreen() {
    return this.x > width + this.w;
  }

  hits(px, py) {
    let pr = PLAYER_HITBOX_RADIUS;
    let ballCenterX = this.x + this.w / 2;
    let ballCenterY = this.y + this.h / 2;
    let ballRadius = this.r * 0.85;

    return dist(px, py, ballCenterX, ballCenterY) < pr + ballRadius;
  }
}
