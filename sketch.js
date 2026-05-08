/* ============================================================
   sketch.js — FaceRun 메인 게임 로직
   구성:
     1. 전역 상태 & 상수 정의
     2. p5.js setup() / draw()
     3. 게임 상태별 드로잉 함수
     4. 장애물(Obstacle) 클래스
     5. FaceMesh 초기화 & 콜백
     6. 게임 유틸리티 (타이머, 랭킹 저장 등)
     7. UI 이벤트 리스너
   ============================================================ */

// ─────────────────────────────────────────────────────────────
// 1. 전역 상태 & 상수
// ─────────────────────────────────────────────────────────────

/** 게임 상태 Enum */
const STATE = {
  HOME: "home",
  START: "start", // 닉네임 입력 & 카운트다운
  PLAYING: "playing",
  GAMEOVER: "gameover",
  RANKING: "ranking",
};

let currentState = STATE.HOME;

// ── 플레이어 데이터 ──
let playerNick = ""; // 현재 플레이어 닉네임
let startTime = 0; // 게임 시작 밀리초
let elapsedMs = 0; // 경과 시간 (밀리초)
let finalTimeMs = 0; // 최종 기록 (게임오버 시점)

// ── 웹캠 & FaceMesh ──
let capture; // p5.js createCapture() 객체
let faceMesh; // ml5.js FaceMesh 인스턴스
let faces = []; // 감지된 얼굴 배열

// 코 랜드마크 인덱스 (FaceMesh 468개 중 코 끝 = 4번)
const NOSE_IDX = 4;

// ── 캐릭터 ──
let charX, charY; // 캐릭터 위치
let targetY; // 부드러운 이동을 위한 목표 Y
const CHAR_SIZE = 28; // 캐릭터 반지름

// ── 장애물 ──
let obstacles = []; // Obstacle 인스턴스 배열
const OBS_WIDTH = 52; // 기둥 두께
const GAP_SIZE = 180; // 상하 기둥 사이 간격 (고정)
const OBS_SPEED_INI = 3.5; // 초기 이동 속도 (px/frame)
const OBS_SPAWN_INT = 90; // 장애물 생성 간격 (프레임)
let obsSpawnCounter = 0; // 스폰 카운터
let obsSpeed = OBS_SPEED_INI;

// ── 배경 파티클 (분위기용) ──
let particles = [];
const PARTICLE_COUNT = 40;

// ── UI DOM 참조 ──
// (초기화는 windowLoaded 이후 이벤트 리스너에서 처리)

// ─────────────────────────────────────────────────────────────
// 2. p5.js 핵심 함수: setup / draw
// ─────────────────────────────────────────────────────────────

/**
 * setup():
 *  - 캔버스 생성
 *  - 웹캠 캡처 초기화
 *  - FaceMesh 초기화
 *  - 배경 파티클 초기화
 */
function setup() {
  // 브라우저 창 전체를 캔버스로 사용
  const cnv = createCanvas(windowWidth, windowHeight);
  cnv.position(0, 0); // 캔버스를 화면 좌상단에 고정
  cnv.style("z-index", "0");

  // 캐릭터 초기 위치 (화면 왼쪽 1/4 지점, Y는 화면 중앙)
  charX = width * 0.22;
  charY = height / 2;
  targetY = charY;

  // 웹캠 캡처 생성 (숨김 처리 후 캔버스에 직접 그림)
  capture = createCapture(VIDEO, () => {
    console.log("[FaceRun] 웹캠 연결 완료");
    // ml5.js FaceMesh 초기화 (웹캠 스트림 준비 후 호출)
    initFaceMesh();
  });
  capture.hide(); // <video> DOM 요소 숨김 (캔버스로만 표시)

  // 배경 파티클 초기화
  initParticles();

  // 프레임레이트 설정
  frameRate(60);
}

/**
 * draw():
 *  - 매 프레임 호출 (60fps)
 *  - 현재 상태(currentState)에 따라 다른 장면 렌더링
 */
function draw() {
  // ── 배경: 웹캠 미러 출력 ──
  drawWebcamBackground();

  // ── 배경 파티클 (항상 렌더) ──
  updateAndDrawParticles();

  // ── 상태별 렌더링 ──
  switch (currentState) {
    case STATE.PLAYING:
      drawPlaying();
      break;
    default:
      // HOME, START, GAMEOVER, RANKING은 UI 레이어에서 처리
      // 캔버스에는 배경만 그림
      break;
  }
}

/**
 * windowResized():
 *  - 브라우저 창 크기 변경 시 캔버스 재조정
 */
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  charX = width * 0.22;
  initParticles(); // 파티클 재초기화
}

// ─────────────────────────────────────────────────────────────
// 3. 배경 & 파티클 시스템
// ─────────────────────────────────────────────────────────────

/**
 * drawWebcamBackground():
 *  웹캠 영상을 캔버스 배경에 좌우 반전(Mirror)으로 출력
 *  - push/pop으로 변환 행렬 격리
 *  - translate + scale(-1, 1) 로 좌우 반전
 */
function drawWebcamBackground() {
  if (!capture || !capture.elt.readyState) {
    // 웹캠 미준비 시 단색 배경
    background(10, 10, 10);
    return;
  }

  push();
  // 화면 우상단 기준으로 반전 (x축만 뒤집기)
  translate(width, 0);
  scale(-1, 1);

  // 웹캠 영상을 캔버스 크기에 맞게 늘려서 출력
  // 살짝 어둡게 처리하여 게임 요소가 잘 보이도록
  tint(160, 160, 160, 240); // 밝기 감소
  image(capture, 0, 0, width, height);
  noTint();
  pop();

  // 상태별 오버레이 농도 조정
  // HOME/GAMEOVER 등 UI 화면일 때는 CSS backdrop-filter가 담당하므로
  // PLAYING 상태에서만 가벼운 어두운 그라디언트 추가
  if (currentState === STATE.PLAYING) {
    // 상하단 그라디언트 (HUD 가독성 향상)
    const topGrad = drawingContext.createLinearGradient(0, 0, 0, 120);
    topGrad.addColorStop(0, "rgba(10,10,10,0.6)");
    topGrad.addColorStop(1, "rgba(10,10,10,0)");
    drawingContext.fillStyle = topGrad;
    drawingContext.fillRect(0, 0, width, 120);
  }
}

/**
 * initParticles():
 *  배경에 떠다니는 점(파티클) 초기화
 */
function initParticles() {
  particles = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push({
      x: random(width),
      y: random(height),
      sz: random(1, 3.5),
      spd: random(0.2, 0.8),
      alpha: random(30, 100),
    });
  }
}

/**
 * updateAndDrawParticles():
 *  파티클 이동 & 렌더링 (게임 분위기용 미세한 움직임)
 */
function updateAndDrawParticles() {
  noStroke();
  for (const p of particles) {
    // 색상: 네온 그린 (#c8ff00 → RGB: 200, 255, 0)
    fill(200, 255, 0, p.alpha);
    ellipse(p.x, p.y, p.sz);

    // 위로 천천히 이동
    p.y -= p.spd;
    if (p.y < -5) {
      p.y = height + 5;
      p.x = random(width);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// 4. 게임 플레이 렌더링 (PLAYING 상태)
// ─────────────────────────────────────────────────────────────

/**
 * drawPlaying():
 *  게임 중 매 프레임 실행:
 *    1. 경과 시간 업데이트
 *    2. 캐릭터 위치 업데이트 (얼굴 추적)
 *    3. 장애물 스폰 & 업데이트
 *    4. 충돌 검사
 *    5. 렌더링
 */
function drawPlaying() {
  // 1. 경과 시간 계산
  elapsedMs = millis() - startTime;
  updateHudTimer(elapsedMs);

  // 2. 캐릭터 Y 업데이트: 코 위치 → targetY
  updateCharPosition();

  // 3. 장애물 속도 점진적 증가 (시간에 따라 난이도 상승)
  obsSpeed = OBS_SPEED_INI + (elapsedMs / 1000) * 0.15;

  // 4. 장애물 스폰
  obsSpawnCounter++;
  if (obsSpawnCounter >= OBS_SPAWN_INT) {
    spawnObstacle();
    obsSpawnCounter = 0;
  }

  // 5. 장애물 업데이트 & 렌더
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const obs = obstacles[i];
    obs.update();
    obs.draw();

    // 화면 밖으로 나간 장애물 제거
    if (obs.x + OBS_WIDTH < 0) {
      obstacles.splice(i, 1);
    }
  }

  // 6. 캐릭터 렌더
  drawCharacter();

  // 7. 충돌 검사
  if (checkCollision()) {
    triggerGameOver();
  }
}

/**
 * updateCharPosition():
 *  FaceMesh에서 감지된 코 위치 → 캐릭터 Y 좌표로 변환
 *  - 좌우 반전 때문에 실제 nose.x 방향도 반전됨 (시각적으로 맞게)
 *  - lerp()로 부드러운 추적 (관성 효과)
 */
function updateCharPosition() {
  if (faces.length > 0) {
    const nose = faces[0].keypoints[NOSE_IDX];

    if (nose) {
      // 웹캠 해상도 → 캔버스 해상도 비율 보정
      const scaleY = height / capture.height;

      // 목표 Y: 코 Y좌표를 캔버스 비율에 맞게 스케일
      targetY = nose.y * scaleY;

      // 화면 경계 클램핑 (캐릭터가 화면 밖으로 나가지 않도록)
      targetY = constrain(targetY, CHAR_SIZE, height - CHAR_SIZE);
    }
  }

  // lerp: 현재 Y에서 목표 Y로 부드럽게 이동 (속도 계수: 0.12)
  charY = lerp(charY, targetY, 0.12);
}

/**
 * drawCharacter():
 *  캐릭터를 원형 + 글로우 효과로 렌더링
 */
function drawCharacter() {
  const x = charX;
  const y = charY;

  // 외부 글로우 (그림자로 표현)
  drawingContext.shadowBlur = 28;
  drawingContext.shadowColor = "rgba(200, 255, 0, 0.8)";

  // 캐릭터 몸체 (채움)
  noStroke();
  fill(200, 255, 0); // 네온 그린
  ellipse(x, y, CHAR_SIZE * 2, CHAR_SIZE * 2);

  // 내부 밝은 점 (하이라이트)
  fill(255, 255, 255, 200);
  ellipse(x - CHAR_SIZE * 0.25, y - CHAR_SIZE * 0.25, CHAR_SIZE * 0.5);

  // 글로우 초기화
  drawingContext.shadowBlur = 0;
  drawingContext.shadowColor = "transparent";
}

/**
 * spawnObstacle():
 *  화면 오른쪽 끝에 새 장애물(Obstacle 인스턴스) 생성
 *  - gapY: 간격 중앙의 Y 위치 (랜덤)
 */
function spawnObstacle() {
  // 간격 중앙이 화면 내에 있도록 랜덤 배치
  const minGapCenter = GAP_SIZE / 2 + 40;
  const maxGapCenter = height - GAP_SIZE / 2 - 40;
  const gapY = random(minGapCenter, maxGapCenter);
  obstacles.push(new Obstacle(width + OBS_WIDTH, gapY));
}

/**
 * checkCollision():
 *  캐릭터와 모든 장애물의 충돌 여부 반환
 *  - 원(캐릭터) vs 사각형(기둥) 충돌 검사
 *  @returns {boolean}
 */
function checkCollision() {
  for (const obs of obstacles) {
    const halfW = OBS_WIDTH / 2;
    const r = CHAR_SIZE * 0.85; // 약간 관대한 판정 (0.85 계수)

    // 기둥 X 범위와 겹치는지 확인
    if (charX + r > obs.x && charX - r < obs.x + OBS_WIDTH) {
      // 상단 기둥과 충돌?
      if (charY - r < obs.gapTop) return true;
      // 하단 기둥과 충돌?
      if (charY + r > obs.gapBottom) return true;
    }
  }

  // 화면 상/하단 경계 이탈 시에도 게임오버
  if (charY - CHAR_SIZE < 0 || charY + CHAR_SIZE > height) return true;

  return false;
}

// ─────────────────────────────────────────────────────────────
// 5. Obstacle 클래스
// ─────────────────────────────────────────────────────────────

/**
 * Obstacle:
 *  화면 오른쪽에서 왼쪽으로 이동하는 상하 기둥 쌍
 *  @param {number} x       - 초기 X 위치
 *  @param {number} gapY    - 간격(Gap) 중앙 Y 위치
 */
class Obstacle {
  constructor(x, gapY) {
    this.x = x;
    this.gapY = gapY;
    this.gapTop = gapY - GAP_SIZE / 2; // 간격 상단 Y
    this.gapBottom = gapY + GAP_SIZE / 2; // 간격 하단 Y
  }

  /** 매 프레임 왼쪽으로 이동 */
  update() {
    this.x -= obsSpeed;
  }

  /** 기둥 렌더링 */
  draw() {
    const x = this.x;

    // ── 상단 기둥 ──
    // 기둥 본체
    fill(30, 30, 35);
    stroke(60, 60, 70);
    strokeWeight(1.5);
    rect(x, 0, OBS_WIDTH, this.gapTop, 0, 0, 6, 6);

    // 기둥 끝단 강조 (네온 그린 테두리)
    noStroke();
    fill(200, 255, 0, 180);
    rect(x - 3, this.gapTop - 16, OBS_WIDTH + 6, 16, 4, 4, 0, 0);

    // ── 하단 기둥 ──
    fill(30, 30, 35);
    stroke(60, 60, 70);
    strokeWeight(1.5);
    rect(x, this.gapBottom, OBS_WIDTH, height - this.gapBottom, 6, 6, 0, 0);

    // 기둥 끝단 강조
    noStroke();
    fill(200, 255, 0, 180);
    rect(x - 3, this.gapBottom, OBS_WIDTH + 6, 16, 0, 0, 4, 4);

    // ── 기둥 내부 줄무늬 (디테일) ──
    stroke(255, 255, 255, 12);
    strokeWeight(1);
    const stripeInterval = 18;
    // 상단 기둥 줄무늬
    for (let sy = stripeInterval; sy < this.gapTop; sy += stripeInterval) {
      line(x + 4, sy, x + OBS_WIDTH - 4, sy);
    }
    // 하단 기둥 줄무늬
    for (
      let sy = this.gapBottom + stripeInterval;
      sy < height;
      sy += stripeInterval
    ) {
      line(x + 4, sy, x + OBS_WIDTH - 4, sy);
    }

    noStroke();
  }
}

// ─────────────────────────────────────────────────────────────
// 6. ml5.js FaceMesh 초기화
// ─────────────────────────────────────────────────────────────

/**
 * initFaceMesh():
 *  ml5.FaceMesh를 초기화하고 웹캠 스트림을 연결
 *  - maxFaces: 1 (한 명만 추적하여 성능 최적화)
 *  - flipped: false (p5.js에서 직접 반전 처리)
 */
function initFaceMesh() {
  const options = {
    maxFaces: 1,
    refineLandmarks: false, // 정밀 랜드마크 OFF (성능 향상)
    flipHorizontal: false, // 반전은 draw()에서 처리
  };

  faceMesh = ml5.faceMesh(options, () => {
    console.log("[FaceRun] FaceMesh 모델 로드 완료");
    // 웹캠 스트림 전달 및 실시간 감지 시작
    faceMesh.detectStart(capture, onFaceDetected);
  });
}

/**
 * onFaceDetected():
 *  FaceMesh 감지 결과 콜백 (매 프레임 호출)
 *  @param {Array} results - 감지된 얼굴 배열
 */
function onFaceDetected(results) {
  faces = results;
}

// ─────────────────────────────────────────────────────────────
// 7. 게임 흐름 제어 함수
// ─────────────────────────────────────────────────────────────

/**
 * startCountdown():
 *  3초 카운트다운 후 게임 시작
 *  @param {string} nick - 플레이어 닉네임
 */
function startCountdown(nick) {
  playerNick = nick.trim() || "PLAYER";

  // HUD 닉네임 업데이트
  document.getElementById("hud-nickname").textContent = playerNick;

  // 닉네임 입력 phase 숨기고 카운트다운 phase 표시
  document.getElementById("phase-nickname").classList.add("hidden");
  document.getElementById("phase-countdown").classList.remove("hidden");

  let count = 3;
  const numEl = document.getElementById("countdown-number");
  numEl.textContent = count;

  const timer = setInterval(() => {
    count--;
    if (count > 0) {
      numEl.textContent = count;
    } else {
      clearInterval(timer);
      beginGame(); // 카운트다운 완료 → 게임 시작
    }
  }, 1000);
}

/**
 * beginGame():
 *  실제 게임 시작 처리
 *  - 상태 전환, 변수 초기화
 */
function beginGame() {
  // 게임 변수 초기화
  obstacles = [];
  obsSpawnCounter = 0;
  obsSpeed = OBS_SPEED_INI;
  charY = height / 2;
  targetY = height / 2;
  elapsedMs = 0;
  startTime = millis(); // 타이머 시작

  // 화면 전환: START → PLAYING
  switchScreen(STATE.HOME); // 모든 UI 숨김
  showScreen("screen-playing");
  currentState = STATE.PLAYING;
}

/**
 * triggerGameOver():
 *  충돌 감지 시 게임오버 처리
 */
function triggerGameOver() {
  finalTimeMs = elapsedMs;
  currentState = STATE.GAMEOVER;

  // 랭킹에 기록 저장
  const rank = saveRecord(playerNick, finalTimeMs);

  // 게임오버 화면 데이터 업데이트
  document.getElementById("result-nickname").textContent = playerNick;
  document.getElementById("result-time").textContent = formatTime(finalTimeMs);
  document.getElementById("result-rank").textContent = `#${rank}`;

  // 화면 전환
  switchScreen(STATE.GAMEOVER);
}

/**
 * goHome():
 *  홈 화면으로 돌아가기 (게임 리셋 포함)
 */
function goHome() {
  currentState = STATE.HOME;
  obstacles = [];
  obsSpawnCounter = 0;
  faces = [];

  // 카운트다운 phase 초기화
  document.getElementById("phase-nickname").classList.remove("hidden");
  document.getElementById("phase-countdown").classList.add("hidden");
  document.getElementById("nickname-input").value = "";

  switchScreen(STATE.HOME);
}

/**
 * showRanking():
 *  랭킹 화면 렌더링 & 표시
 */
function showRanking() {
  renderRankingList();
  switchScreen(STATE.RANKING);
  currentState = STATE.RANKING;
}

// ─────────────────────────────────────────────────────────────
// 8. 화면 전환 헬퍼
// ─────────────────────────────────────────────────────────────

/**
 * switchScreen():
 *  상태에 맞는 화면으로 전환 (CSS .active 클래스 토글)
 *  @param {string} newState - STATE 상수 값
 */
function switchScreen(newState) {
  // 모든 .screen에서 .active 제거
  document
    .querySelectorAll(".screen")
    .forEach((el) => el.classList.remove("active"));

  // 상태에 맞는 화면만 활성화
  const screenMap = {
    [STATE.HOME]: "screen-home",
    [STATE.START]: "screen-start",
    [STATE.GAMEOVER]: "screen-gameover",
    [STATE.RANKING]: "screen-ranking",
    // PLAYING은 UI 오버레이 없이 HUD만 표시
  };

  const targetId = screenMap[newState];
  if (targetId) {
    document.getElementById(targetId).classList.add("active");
  }

  currentState = newState;
}

/**
 * showScreen():
 *  특정 ID의 화면만 활성화
 *  @param {string} id - 화면 요소 ID
 */
function showScreen(id) {
  document
    .querySelectorAll(".screen")
    .forEach((el) => el.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
}

// ─────────────────────────────────────────────────────────────
// 9. 랭킹 & localStorage 관리
// ─────────────────────────────────────────────────────────────

const STORAGE_KEY = "facerun_rankings";
const MAX_RECORDS = 20; // 최대 저장 기록 수

/**
 * saveRecord():
 *  플레이 기록을 localStorage에 저장하고 순위 반환
 *  @param {string} nick    - 닉네임
 *  @param {number} timeMs  - 기록 (밀리초)
 *  @returns {number}       - 최종 순위 (1-based)
 */
function saveRecord(nick, timeMs) {
  const records = loadRecords();

  // 새 기록 추가
  records.push({ nick, timeMs, date: new Date().toLocaleDateString("ko-KR") });

  // 내림차순 정렬 (오래 살아남을수록 높은 순위)
  records.sort((a, b) => b.timeMs - a.timeMs);

  // 최대 기록 수 제한
  if (records.length > MAX_RECORDS) records.splice(MAX_RECORDS);

  // localStorage 저장
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));

  // 현재 기록의 순위 반환 (같은 timeMs 중 첫 번째 위치)
  const rank =
    records.findIndex((r) => r.nick === nick && r.timeMs === timeMs) + 1;
  return rank;
}

/**
 * loadRecords():
 *  localStorage에서 랭킹 데이터 로드
 *  @returns {Array} 랭킹 배열
 */
function loadRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn("[FaceRun] 랭킹 데이터 파싱 오류:", e);
    return [];
  }
}

/**
 * renderRankingList():
 *  랭킹 데이터를 HTML로 렌더링
 */
function renderRankingList() {
  const records = loadRecords();
  const container = document.getElementById("ranking-list");
  container.innerHTML = "";

  if (records.length === 0) {
    container.innerHTML =
      '<p class="rank-empty">아직 기록이 없습니다.<br>첫 번째 도전자가 되어보세요!</p>';
    return;
  }

  records.forEach((rec, idx) => {
    const row = document.createElement("div");
    const rankClass =
      idx === 0 ? "top-1" : idx === 1 ? "top-2" : idx === 2 ? "top-3" : "";
    row.className = `rank-row ${rankClass}`;

    const rankIcon =
      idx === 0 ? "1st" : idx === 1 ? "2nd" : idx === 2 ? "3rd" : `${idx + 1}`;

    row.innerHTML = `
      <span class="rank-num">${rankIcon}</span>
      <span class="rank-name">${escapeHtml(rec.nick)}</span>
      <span class="rank-time">${formatTime(rec.timeMs)}</span>
    `;
    container.appendChild(row);
  });
}

/**
 * escapeHtml():
 *  XSS 방지용 HTML 이스케이핑
 *  @param {string} str
 *  @returns {string}
 */
function escapeHtml(str) {
  return str.replace(
    /[&<>"']/g,
    (m) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[m],
  );
}

// ─────────────────────────────────────────────────────────────
// 10. 유틸리티: 시간 포맷 & HUD 업데이트
// ─────────────────────────────────────────────────────────────

/**
 * formatTime():
 *  밀리초 → "MM:SS.d" 형식 문자열 변환
 *  예) 75432 → "01:15.4"
 *  @param {number} ms
 *  @returns {string}
 */
function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  const tenths = Math.floor((ms % 1000) / 100);

  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return `${mm}:${ss}.${tenths}`;
}

/**
 * updateHudTimer():
 *  게임 중 HUD 타이머 텍스트 업데이트
 *  @param {number} ms - 경과 시간 (밀리초)
 */
function updateHudTimer(ms) {
  const timerEl = document.getElementById("hud-timer");
  if (timerEl) timerEl.textContent = formatTime(ms);
}

// ─────────────────────────────────────────────────────────────
// 11. UI 이벤트 리스너 등록
// ─────────────────────────────────────────────────────────────

// DOM 로드 완료 후 이벤트 연결
document.addEventListener("DOMContentLoaded", () => {
  // ── HOME 화면 ──
  // [게임 시작] 버튼
  document.getElementById("btn-start").addEventListener("click", () => {
    switchScreen(STATE.START);
  });

  // [랭킹 보기] 버튼
  document.getElementById("btn-ranking").addEventListener("click", () => {
    showRanking();
  });

  // ── START 화면 ──
  // [확인] 버튼: 닉네임 확인 후 카운트다운 시작
  document.getElementById("btn-confirm-nick").addEventListener("click", () => {
    const nick = document.getElementById("nickname-input").value.trim();
    if (!nick) {
      document.getElementById("nickname-input").focus();
      document.getElementById("nickname-input").style.borderColor = "#ff4455";
      setTimeout(() => {
        document.getElementById("nickname-input").style.borderColor = "";
      }, 800);
      return;
    }
    startCountdown(nick);
  });

  // Enter 키로도 확인 가능
  document.getElementById("nickname-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      document.getElementById("btn-confirm-nick").click();
    }
  });

  // [뒤로] 버튼
  document.getElementById("btn-back-home").addEventListener("click", () => {
    goHome();
  });

  // ── GAMEOVER 화면 ──
  // [다시 하기] 버튼
  document.getElementById("btn-retry").addEventListener("click", () => {
    // 닉네임 유지한 채로 다시 카운트다운
    switchScreen(STATE.START);
    document.getElementById("phase-nickname").classList.add("hidden");
    document.getElementById("phase-countdown").classList.remove("hidden");
    startCountdown(playerNick);
  });

  // [홈으로] 버튼
  document
    .getElementById("btn-home-from-gameover")
    .addEventListener("click", () => {
      goHome();
    });

  // ── RANKING 화면 ──
  // [홈으로] 버튼
  document
    .getElementById("btn-home-from-ranking")
    .addEventListener("click", () => {
      goHome();
    });

  // ── 초기 화면 표시: HOME ──
  switchScreen(STATE.HOME);
});
