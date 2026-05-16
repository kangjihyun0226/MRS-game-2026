class Ball {
  constructor(speed) {
    this.r = 38;
    this.x = -this.r;
    this.y = random(100, height - 100);
    this.speed = speed * 1.15;
  }

  update() {
    this.x += this.speed;
  }

  show() {
    push();
    stroke(0);
    strokeWeight(3);
    fill(255, 225, 225);
    ellipse(this.x, this.y, this.r, this.r);
    pop();
  }

  offscreen() {
    return this.x > width + this.r;
  }

  hits(px, py) {
    let d = dist(px, py, this.x, this.y);
    return d < PLAYER_HITBOX_RADIUS + this.r / 2;
  }
}
