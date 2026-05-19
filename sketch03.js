// 1. 파이어베이스 초기화 설정 (제공해주신 주소 연동)

const firebaseConfig = {
  databaseURL: "https://msg-game-2026-c370e-default-rtdb.firebaseio.com/",
};

// 파이어베이스 중복 초기화 방지 및 생성
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const database = firebase.database();

// 2. 게임 시작 및 준비 함수들

function startGame() {
  userNickname = (document.getElementById("nickname").value || "").trim();
  // 닉네임이 비어있으면 시작 불가
  if (!userNickname) {
    window.alert("게임을 시작하려면 닉네임을 입력해주세요.");
    return;
  }
  // 전화번호와 게임 이름 입력값을 전역 변수에 저장
  userPhone =
    (document.getElementById("phone") || { value: "" }).value.trim() || "";
  gameName =
    (document.getElementById("game-name") || { value: "" }).value.trim() || "";
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

// 3. 게임 오버 및 라운드 종료 처리

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

  // [버그 수정]: 네트워크 상태와 상관없이 "무조건" 게임오버 화면 창부터 먼저 즉시 띄웁니다!
  document.getElementById("gameover-screen").style.display = "block";
  document.getElementById("final-score").innerText = "기록 정산 중... ";
  document.getElementById("my-rank").innerText = "잠시만 기다려주세요.";

  let actionBtn = document.querySelector("#gameover-screen button");
  if (actionBtn) {
    actionBtn.innerText = "HOME";
    actionBtn.setAttribute("onclick", "showHome()");
  }

  // 화면을 먼저 열어둔 상태에서, 파이어베이스 데이터를 안전하게 가져와 연산합니다.
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

    // 서버(파이어베이스)에 내 점수를 등록하고 최종 등수를 UI에 출력합니다.
    saveScore(userNickname, bestScore);
  });
}

// 4. 파이어베이스 실시간 데이터 연동 함수들

// 4-1. 실시간 데이터베이스에 점수 업로드
function saveScore(name, finalBestScore) {
  let formattedScore = parseFloat(finalBestScore.toFixed(3));
  let ranksRef = database.ref("doodle_rank");

  // 동일 닉네임의 기존 레코드를 찾아서 최고기록만 남기도록 처리
  // 성능: 전체 스냅샷을 가져오는 대신 이름으로 필터링된 쿼리만 요청합니다.
  ranksRef
    .orderByChild("name")
    .equalTo(name)
    .once("value")
    .then((snapshot) => {
      let matches = [];
      snapshot.forEach((childSnapshot) => {
        let v = childSnapshot.val();
        if (v && v.name === name) {
          matches.push({ key: childSnapshot.key, score: v.score });
        }
      });

      if (matches.length === 0) {
        // 해당 닉네임의 기록이 없으면 새로 추가 (전화번호와 게임명 포함)
        return ranksRef.push({
          name: name,
          score: formattedScore,
          phone: typeof userPhone !== "undefined" ? userPhone : "",
          game: typeof gameName !== "undefined" ? gameName : "",
          timestamp: Date.now(),
        });
      }

      // 이미 여러 레코드가 있을 수 있으므로 최고점 레코드를 찾아 비교
      matches.sort((a, b) => b.score - a.score);
      const best = matches[0];

      // 항상 최고 레코드에는 최신 전화번호/게임명을 반영
      let updates = {
        phone: typeof userPhone !== "undefined" ? userPhone : "",
        game: typeof gameName !== "undefined" ? gameName : "",
        timestamp: Date.now(),
      };

      if (formattedScore > best.score + 0.0001) {
        // 새 점수가 더 높으면 점수도 갱신
        updates.score = formattedScore;
      }

      return ranksRef
        .child(best.key)
        .update(updates)
        .then(() => {
          // 중복 레코드 삭제
          let removals = [];
          for (let i = 1; i < matches.length; i++) {
            removals.push(ranksRef.child(matches[i].key).remove());
          }
          return Promise.all(removals.length ? removals : [Promise.resolve()]);
        });
    })
    .then(() => {
      console.log("파이어베이스 서버에 실시간 점수 등록(또는 갱신) 완료!");
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

    // 닉네임과 점수 오차값 검사를 통해 내 데이터 인덱스 확인
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

// 5. 대기실 복귀

function showHome() {
  gameState = "HOME";
  resetPlayerAvatar();
  document
    .querySelectorAll(".screen")
    .forEach((s) => (s.style.display = "none"));
  document.getElementById("home-screen").style.display = "block";
}
