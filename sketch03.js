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
  let ranking = JSON.parse(localStorage.getItem("doodle_rank")) || [];
  let isTop8 = ranking.length < 8 || bestScore > ranking[7].score;

  saveScore(userNickname, bestScore);
  document.getElementById("gameover-screen").style.display = "block";

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
  showMyRank(bestScore);
}

function saveScore(name, finalBestScore) {
  let ranking = JSON.parse(localStorage.getItem("doodle_rank")) || [];
  ranking.push({ name: name, score: parseFloat(finalBestScore.toFixed(3)) });
  ranking.sort((a, b) => b.score - a.score);
  localStorage.setItem("doodle_rank", JSON.stringify(ranking.slice(0, 10)));
}

function showRanking() {
  document.getElementById("home-screen").style.display = "none";
  document.getElementById("ranking-screen").style.display = "block";
  let ranking = JSON.parse(localStorage.getItem("doodle_rank")) || [];
  let listHTML = ranking
    .map(
      (i, idx) => `<div>${idx + 1}. ${i.name} - ${i.score.toFixed(3)}s</div>`,
    )
    .join("");
  document.getElementById("ranking-list").innerHTML = listHTML || "NO DATA";
}

function showMyRank(finalBestScore) {
  let ranking = JSON.parse(localStorage.getItem("doodle_rank")) || [];
  let formattedScore = parseFloat(finalBestScore.toFixed(3));
  let rank =
    ranking.findIndex(
      (i) => i.name === userNickname && abs(i.score - formattedScore) < 0.0001,
    ) + 1;

  if (rank <= 0) rank = ranking.findIndex((i) => formattedScore >= i.score) + 1;

  document.getElementById("my-rank").innerText =
    rank > 0 && rank <= ranking.length
      ? `YOUR RANK: ${rank}위`
      : "YOUR RANK: 순위권 외";
}

function showHome() {
  gameState = "HOME";
  resetPlayerAvatar();
  document
    .querySelectorAll(".screen")
    .forEach((s) => (s.style.display = "none"));
  document.getElementById("home-screen").style.display = "block";
}
