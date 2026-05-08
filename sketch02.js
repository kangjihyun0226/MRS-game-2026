// 왼쪽에서 날아오는 공 장애물 클래스
class Ball {
  constructor(speed) {
    this.r = 30; // 공의 반지름
    this.x = -this.r; // 화면 왼쪽 밖에서 시작
    this.y = random(50, height - 50); // 랜덤한 높이
    this.speed = speed * 1.2; // 파이프보다 약간 더 빠르게 설정
  }

  update() {
    this.x += this.speed; // 오른쪽으로 이동
  }

  show() {
    push();
    stroke(0);
    strokeWeight(3);
    fill(255, 100, 100); // 파이프와 구분되도록 붉은색 틴트 (원하시는 대로 변경 가능)
    ellipse(this.x, this.y, this.r, this.r);
    pop();
  }

  offscreen() {
    return this.x > width + this.r; // 화면 오른쪽으로 완전히 나가면 삭제
  }

  hits(px, py) {
    // 캐릭터와의 거리 계산 (캐릭터 반지름 약 20 + 공 반지름 15)
    let d = dist(px, py, this.x, this.y);
    return d < 35;
  }
}
