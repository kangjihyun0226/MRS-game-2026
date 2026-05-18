class Ball {
  constructor(speed) {
    this.img = random(moveImages); // [추가] move 계열의 30개 파일 중 무작위 랜덤 할당
    let targetSize = 76; // [추가] 기존 공 직경(38*2) 크기와 일치하도록 크기 규격 지정
    let aspect = this.img.width / this.img.height; // [추가] 불러온 SVG 파일 고유의 원본 가로세로 비율 추출
    if (aspect >= 1) {
      this.w = targetSize;
      this.h = targetSize / aspect;
    } // [추가] 비율에 맞춘 가로 고정 세로 가변 연산 처리
    else {
      this.h = targetSize;
      this.w = targetSize * aspect;
    } // [추가] 비율에 맞춘 세로 고정 가로 가변 연산 처리

    this.r = targetSize / 2; // [수정] 기존 고정값 38을 SVG 종횡비 기반 동적 반지름 변수로 대체 전환
    this.x = -this.w; // [수정] 스폰 위치 가로폭 여백을 고정 반지름 대신 산출된 동적 너비값으로 교체
    this.y = random(100, height - 100);
    this.speed = speed * 1.15;
  }

  update() {
    this.x += this.speed;
  }

  show() {
    image(this.img, this.x, this.y, this.w, this.h); // [수정] 기존 단색 타원형(ellipse) 드로잉을 원본 SVG 이미지 출력문으로 교체
  }

  offscreen() {
    return this.x > width + this.w; // [수정] 화면 탈출 체크 영역을 기존 고정 r 값에서 동적 너비 w 기준으로 변경
  }

  hits(px, py) {
    let pr = PLAYER_HITBOX_RADIUS; // [추가] 가독성을 위해 플레이어의 전역 히트박스 반지름 로드

    if (
      px + pr < this.x ||
      px - pr > this.x + this.w ||
      py + pr < this.y ||
      py - pr > this.y + this.h
    ) {
      return false;
    } // [추가] 최적화: 사각형 경계가 아예 안 겹치면 연산 취소

    let overlapLeft = max(px - pr, this.x); // [추가] 두 객체가 겹치는 충돌 영역 좌측 좌표 연산
    let overlapRight = min(px + pr, this.x + this.w); // [추가] 두 객체가 겹치는 충돌 영역 우측 좌표 연산
    let overlapTop = max(py - pr, this.y); // [추가] 두 객체가 겹치는 충돌 영역 상단 좌표 연산
    let overlapBottom = min(py + pr, this.y + this.h); // [추가] 두 객체가 겹치는 충돌 영역 하단 좌표 연산
    let step = 4;
    this.img.loadPixels(); // [추가] 고유 픽셀 투명도 분석을 위해 이미지 알파 메모리 로드

    for (let y = overlapTop; y < overlapBottom; y += step) {
      // [추가] 겹친 영역 세로 스캔 루프 (속도를 위해 4픽셀 간격 지정)

      for (let x = overlapLeft; x < overlapRight; x += step) {
        // [추가] 겹친 영역 가로 스캔 루프 (속도를 위해 4픽셀 간격 지정)

        if (dist(x, y, px, py) < pr) {
          // [추가] 현재 체크 중인 픽셀점이 플레이어 원형 피격 범위 내부인지 판단
          let imgX = floor(map(x, this.x, this.x + this.w, 0, this.img.width)); // [추가] 화면 좌표를 SVG 원본 이미지상의 가로 픽셀 인덱스로 매핑
          let imgY = floor(map(y, this.y, this.y + this.h, 0, this.img.height)); // [추가] 화면 좌표를 SVG 원본 이미지상의 세로 픽셀 인덱스로 매핑

          if (
            imgX >= 0 &&
            imgX < this.img.width &&
            imgY >= 0 &&
            imgY < this.img.height
          ) {
            // [추가] 유효 배열 경계 범위 안정성 확인 검사
            let pixelIndex = (imgX + imgY * this.img.width) * 4 + 3; // [추가] RGBA 픽셀 어레이 데이터에서 알파(Alpha) 투명도 채널 값의 위치 인덱스 역산
            if (this.img.pixels[pixelIndex] > 50) {
              return true;
            } // [추가] 알파 채널 밀도가 50을 초과하면 실제 벡터 선에 닿은 것으로 충돌 리턴
          }
        }
      }
    }
    return false; // [수정] 단순 거리 공식 d 연산문을 들어내고 벡터 컬러 영역 매칭 알파 충돌 결과값으로 교체 리턴
  }
}
