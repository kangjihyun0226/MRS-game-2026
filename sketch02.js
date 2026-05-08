// 왼쪽에서 날아오는 공 장애물 클래스
class Ball {
  constructor(speed) {
    this.r = 30; 
    this.x = -this.r; 
    this.y = random(50, height - 50); 
    this.speed = speed * 1.2; 
  }

  update() {
    this.x += this.speed; // 오른쪽으로 이동
  }

  show() {
    push();
    stroke(0);
    strokeWeight(3);
    fill(255, 225, 225); // 파이프와 구분되도록
    ellipse(this.x, this.y, this.r, this.r);
    pop();
  }

  offscreen() {
    return this.x > width + this.r; // 화면 오른쪽으로 완전히 나가면 삭제
  }

  hits(px, py) {
    // 캐릭터와의 거리 계산
    let d = dist(px, py, this.x, this.y);
    return d < 35;
  }
}
