class Ball {
  constructor(speed) {
    this.img = random(moveImages);
    let targetSize = 76,
      aspect = this.img.width / this.img.height;
    this.w = aspect >= 1 ? targetSize : targetSize * aspect;
    this.h = aspect >= 1 ? targetSize / aspect : targetSize;
    this.r = targetSize / 2;
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

  hits(px, py) {
    let pr = PLAYER_HITBOX_RADIUS;
    if (
      px + pr < this.x ||
      px - pr > this.x + this.w ||
      py + pr < this.y ||
      py - pr > this.y + this.h
    )
      return false;

    let overlapLeft = max(px - pr, this.x),
      overlapRight = min(px + pr, this.x + this.w);
    let overlapTop = max(py - pr, this.y),
      overlapBottom = min(py + pr, this.y + this.h);
    let step = 4;
    this.img.loadPixels();

    for (let y = overlapTop; y < overlapBottom; y += step) {
      for (let x = overlapLeft; x < overlapRight; x += step) {
        if (dist(x, y, px, py) < pr) {
          let imgX = floor(map(x, this.x, this.x + this.w, 0, this.img.width));
          let imgY = floor(map(y, this.y, this.y + this.h, 0, this.img.height));
          if (
            imgX >= 0 &&
            imgX < this.img.width &&
            imgY >= 0 &&
            imgY < this.img.height
          ) {
            if (this.img.pixels[(imgX + imgY * this.img.width) * 4 + 3] > 50)
              return true;
          }
        }
      }
    }
    return false;
  }
}
