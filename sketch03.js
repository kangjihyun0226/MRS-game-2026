// =================================================================
// 1. 파이어베이스 초기화 설정 (제공해주신 주소 연동)
// =================================================================
const firebaseConfig = {
  databaseURL: "https://msg-game-2026-c370e-default-rtdb.firebaseio.com/",
};

// 파이어베이스 중복 초기화 방지 및 생성
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const database = firebase.database();

// =================================================================
// 2. 게임 시작 및 준비 함수들
// =================================================================
function startGame() {
  userNickname = document.getElementById("nickname").value || "ANON";
  if (!playerAvatar) {
    window.alert("먼저 SCAN FACE 버튼으로 얼굴을 스캔해주세요.");
    return;
  }
  lives = 3;
  attemptScores = [];
  prepareNextAttempt();
}

function prepareNextAttempt() {
  document.getElementById("home-screen").style.display = "none";
  document.getElementById("gameover-screen").style.display = "none";
  gameState = "COUNT";
  countdown = 3;

  lastPipeTop = -1;
  lastPipeSpacing = -1;
  pipes = [];
  balls = [];

  let timer = setInterval(() => {
    countdown--;
    if (countdown <= 0) {
      clearInterval(timer);
      gameState = "PLAY";
      gameStartTime = millis();
    }
  }, 1000);
}

// =================================================================
// 3. 게임 오버 및 라운드 종료 처리
// =================================================================
function playerDie() {
  lives--;
  attemptScores.push(score);

  if (lives > 0) {
    gameState = "GAMEOVER";
    document.getElementById("gameover-screen").style.display = "block";
    document.getElementById("final-score").innerText =
      "도전 기록: " + score.toFixed(3) + "s";
    document.getElementById("my-rank").innerText = "남은 목숨: " + lives;

    let finalScoreStyle = document.getElementById("final-score").style;
    finalScoreStyle.fontSize = "20px";
    finalScoreStyle.color = "#000";
    finalScoreStyle.fontWeight = "normal";

    let actionBtn = document.querySelector("#gameover-screen button");
    if (actionBtn) {
      actionBtn.innerText = "Replay";
      actionBtn.setAttribute("onclick", "prepareNextAttempt()");
    }
  } else {
    endGame();
  }
}

function drawCountdown() {
  fill(0);
  textSize(64);
  textAlign(CENTER, CENTER);
  text(countdown, width * 0.5, height * 0.5);
}

function endGame() {
  gameState = "GAMEOVER";
  let bestScore = max(attemptScores);

  // 파이어베이스에서 기존 전체 데이터를 임시로 읽어와 Top 8 여부 확인 및 랭킹 갱신 진행
  let ranksRef = database.ref("doodle_rank");
  ranksRef.once("value", (snapshot) => {
    let rankingArray = [];
    snapshot.forEach((childSnapshot) => {
      rankingArray.push(childSnapshot.val());
    });

    // 점수 높은 순 정렬
    rankingArray.sort((a, b) => b.score - a.score);
    let isTop8 = rankingArray.length < 8 || bestScore > rankingArray[7].score;

    let finalScoreElement = document.getElementById("final-score");
    let fsStyle = finalScoreElement.style;

    if (isTop8) {
      finalScoreElement.innerText =
        "🎉 !!순위권!! 진입 🎉\n최종 최고 기록: " + bestScore.toFixed(3) + "s";
      fsStyle.fontSize = "32px";
      fsStyle.color = "#ff3366";
      fsStyle.fontWeight = "bold";
      fsStyle.lineHeight = "1.5";
    } else {
      finalScoreElement.innerText =
        "최종 최고 기록: " + bestScore.toFixed(3) + "s";
      fsStyle.fontSize = "20px";
      fsStyle.color = "#000";
      fsStyle.fontWeight = "normal";
    }

    let actionBtn = document.querySelector("#gameover-screen button");
    if (actionBtn) {
      actionBtn.innerText = "HOME";
      actionBtn.setAttribute("onclick", "showHome()");
    }

    // 서버(파이어베이스)에 점수 저장 후, 내 등수 실시간 조회
    saveScore(userNickname, bestScore);
  });
}

// =================================================================
// 4. [온라인 변경] 파이어베이스 실시간 데이터 연동 함수들
// =================================================================

// 4-1. 실시간 데이터베이스에 점수 업로드
function saveScore(name, finalBestScore) {
  let formattedScore = parseFloat(finalBestScore.toFixed(3));
  let ranksRef = database.ref("doodle_rank");

  // 파이어베이스에 데이터 밀어넣기
  ranksRef
    .push({
      name: name,
      score: formattedScore,
      timestamp: Date.now(),
    })
    .then(() => {
      console.log("파이어베이스 서버에 실시간 점수 등록 성공!");
      // 저장이 완료된 뒤 최신 데이터를 기반으로 내 등수를 화면에 그려줍니다.
      showMyRank(finalBestScore);
    })
    .catch((error) => {
      console.error("점수 저장 실패:", error);
    });
}

// 4-2. 실시간 데이터베이스 전체 순위 보드 로드 및 탑텐 출력
function showRanking() {
  document.getElementById("home-screen").style.display = "none";
  document.getElementById("ranking-screen").style.display = "block";

  let ranksRef = database.ref("doodle_rank");
  ranksRef.once("value", (snapshot) => {
    let rankingArray = [];
    snapshot.forEach((childSnapshot) => {
      rankingArray.push(childSnapshot.val());
    });

    // 높은 점수(시간이 긴 순) 정렬
    rankingArray.sort((a, b) => b.score - a.score);

    // 상위 10개만 슬라이싱하여 HTML 출력 생성
    let top10 = rankingArray.slice(0, 10);
    let listHTML = top10
      .map(
        (i, idx) => `<div>${idx + 1}. ${i.name} - ${i.score.toFixed(3)}s</div>`,
      )
      .join("");
    document.getElementById("ranking-list").innerHTML = listHTML || "NO DATA";
  });
}

// 4-3. 파이어베이스 데이터 기반 실시간 '내 등수' 계산
function showMyRank(finalBestScore) {
  let formattedScore = parseFloat(finalBestScore.toFixed(3));
  let ranksRef = database.ref("doodle_rank");

  ranksRef.once("value", (snapshot) => {
    let rankingArray = [];
    snapshot.forEach((childSnapshot) => {
      rankingArray.push(childSnapshot.val());
    });

    rankingArray.sort((a, b) => b.score - a.score);

    // 닉네임과 정확한 점수 오차값 검사를 통해 내 데이터 인덱스 확인
    let rank =
      rankingArray.findIndex(
        (i) =>
          i.name === userNickname && abs(i.score - formattedScore) < 0.0001,
      ) + 1;

    if (rank <= 0) {
      rank = rankingArray.findIndex((i) => formattedScore >= i.score) + 1;
    }

    document.getElementById("my-rank").innerText =
      rank > 0 && rank <= rankingArray.length
        ? `YOUR RANK: ${rank}위`
        : "YOUR RANK: 순위권 외";
  });
}

// 4-4. [전체 리셋 변경] 모든 노트북의 데이터를 초기화 (주의 필요!)
function clearRanking() {
  if (
    confirm(
      "진짜로 '전 세계 모든 노트북'의 온라인 랭킹 기록을 싹 다 지우실 건가요? 🧙‍♂️",
    )
  ) {
    database
      .ref("doodle_rank")
      .remove()
      .then(() => {
        alert("온라인 랭킹이 성공적으로 초기화되었습니다.");
        showRanking();
      })
      .catch((error) => {
        console.error("초기화 실패:", error);
      });
  }
}

// =================================================================
// 5. 대기실 복귀
// =================================================================
function showHome() {
  gameState = "HOME";
  resetPlayerAvatar();
  document
    .querySelectorAll(".screen")
    .forEach((s) => (s.style.display = "none"));
  document.getElementById("home-screen").style.display = "block";
}
