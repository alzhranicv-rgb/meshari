let auctionState = {
  usedNumbers: [],
  currentBid: 0,
  currentIncrement: 1,
  bidTeam: null,
  scoreA: 0,
  scoreB: 0,
  currentQuestionNumber: null,
  questionOpened: false
}

window.auctionState = auctionState

let currentAuctionAnswer = null
let currentAuctionQuestion = null
let auctionMaxNumber = 4
let auctionTimerStarted = false
let auctionLastTickPlayed = null
let auctionQuestionLocked = false

window.auctionMaxNumber = auctionMaxNumber

const AUCTION_STORAGE_KEY = "auction_state_v1"

/* =========================
   Persistence
========================= */

function getAuctionState() {
  try {
    return JSON.parse(localStorage.getItem(AUCTION_STORAGE_KEY) || "null")
  } catch {
    return null
  }
}

function saveAuctionState() {
  const timerBox = document.getElementById("timer")

  const state = {
    auctionState,
    currentAuctionAnswer,
    currentAuctionQuestion,
    auctionMaxNumber,
    auctionTimerStarted,
    auctionQuestionLocked,
    timerValue: timerBox ? Number(timerBox.innerText || 0) : 0
  }

  localStorage.setItem(AUCTION_STORAGE_KEY, JSON.stringify(state))
  localStorage.setItem("active_segment", "auction")
}

function clearAuctionState() {
  localStorage.removeItem(AUCTION_STORAGE_KEY)
  localStorage.removeItem("active_segment")
}

function restoreAuctionState(saved) {
  if (!saved) return

  auctionState = saved.auctionState || auctionState
  window.auctionState = auctionState

  currentAuctionAnswer = saved.currentAuctionAnswer || null
  currentAuctionQuestion = saved.currentAuctionQuestion || null
  auctionMaxNumber = Number(saved.auctionMaxNumber || 8)
  window.auctionMaxNumber = auctionMaxNumber
  auctionTimerStarted = !!saved.auctionTimerStarted
  auctionQuestionLocked = !!saved.auctionQuestionLocked
  auctionLastTickPlayed = null

  const box = document.getElementById("auctionQuestionBox")
  if (box) {
    box.innerText = currentAuctionQuestion || "اختر رقم المزاد"
  }

  updateAuctionScoresOnly()
  updateAuctionGridOnly()
  updateAuctionBidInfo()
  highlightAuctionBidTeam()

  const timerValue = Number(saved.timerValue || 0)
  if (auctionTimerStarted && timerValue > 0) {
    resumeAuctionTimer(timerValue)
  }

  updateEndRoundButtonState()
}

/* =========================
   Render
========================= */

window.renderAuction = async function () {
  const saved = getAuctionState()

  auctionState = {
    usedNumbers: [],
    currentBid: 0,
    currentIncrement: 1,
    bidTeam: null,
    scoreA: 0,
    scoreB: 0,
    currentQuestionNumber: null,
    questionOpened: false
  }

  window.auctionState = auctionState
  window.currentSegmentScores = { A: 0, B: 0 }

  currentAuctionAnswer = null
  currentAuctionQuestion = null
  auctionTimerStarted = false
  auctionLastTickPlayed = null
  auctionQuestionLocked = false

  await loadAuctionMaxNumber()

  openSegment("المزاد", buildAuctionHTML())

  if (saved) {
    restoreAuctionState(saved)
  } else {
    saveAuctionState()
    updateEndRoundButtonState()
  }
}

async function loadAuctionMaxNumber() {
  auctionMaxNumber = 8
  window.auctionMaxNumber = auctionMaxNumber
}

/* =========================
   HTML
========================= */

function buildAuctionHTML() {
  return `
    <div class="auctionWrap">

      <div class="auctionTopBar">

        <div class="auctionTeamCard ${auctionState.bidTeam === "A" ? "activeTeam" : ""}" onclick="bid('A')" id="teamABox">
          <div class="auctionTeamName">${teamAName}</div>
          <div class="auctionTeamScore" id="auctionScoreA">${auctionState.scoreA}</div>
        </div>

        <div class="auctionTimerBox">
          <div class="auctionTimerLabel">المؤقت</div>
          <div class="auctionTimerValue" id="timer">0</div>
        </div>

        <div class="auctionTeamCard ${auctionState.bidTeam === "B" ? "activeTeam" : ""}" onclick="bid('B')" id="teamBBox">
          <div class="auctionTeamName">${teamBName}</div>
          <div class="auctionTeamScore" id="auctionScoreB">${auctionState.scoreB}</div>
        </div>

      </div>

      <div class="auctionQuestionBox" id="auctionQuestionBox">
        ${currentAuctionQuestion || "اختر رقم المزاد"}
      </div>

      <div class="auctionGrid" id="auctionGrid">
        ${createAuctionGrid()}
      </div>

      <div class="auctionInfoRow">
        <div class="auctionInfoCard">
          <div class="auctionInfoLabel">آخر مزايدة</div>
          <div class="auctionInfoValue" id="bidTeam">
            ${auctionState.bidTeam === "A" ? teamAName : auctionState.bidTeam === "B" ? teamBName : "لا يوجد"}
          </div>
        </div>

        <div class="auctionInfoCard">
          <div class="auctionInfoLabel">القيمة</div>
          <div class="auctionInfoValue" id="bidValue">${auctionState.currentBid}</div>
        </div>
      </div>

      <div class="auctionControlPanel">
        <button onclick="startAuctionTimer()" class="btnTimer">بدء المؤقت</button>
        <button onclick="auctionCorrect()" class="btnCorrect">✓ صح</button>
        <button onclick="auctionWrong()" class="btnWrong">✕ خطأ</button>
      </div>

    </div>
  `
}

function createAuctionGrid() {
  let html = ""

  for (let i = 1; i <= auctionMaxNumber; i++) {
    if (!auctionState.usedNumbers.includes(i)) {
      html += `<button onclick="openAuction(${i})" class="auctionBtn">${i}</button>`
    } else {
      html += `<button class="auctionBtn used" disabled></button>`
    }
  }

  return html
}

/* =========================
   Open Question
========================= */

async function openAuction(num) {
  if (auctionQuestionLocked) {
    showGameToast("سجل النتيجة أولاً")
    return
  }

  if (auctionState.usedNumbers.includes(num)) return

  auctionState.usedNumbers.push(num)
  auctionState.currentBid = 0
  auctionState.currentIncrement = 1
  auctionState.bidTeam = null
  auctionState.currentQuestionNumber = num
  auctionState.questionOpened = true

  clearInterval(timer)
  timer = null
  setAuctionTimerValue(0)
  auctionTimerStarted = false
  auctionLastTickPlayed = null

  const { data, error } = await db
    .from("auction_questions")
    .select("*")
    .eq("model", currentModel)
    .eq("number", num)
    .single()

  if (error) {
    console.log(error)
    showGameToast("تعذر تحميل سؤال المزاد")
    return
  }

  if (!data) return

  currentAuctionQuestion = data.question || "لا يوجد نص سؤال"
  currentAuctionAnswer = data.answer || ""
  auctionState.currentIncrement = Number(data.increment || 1)
  auctionQuestionLocked = true

  const box = document.getElementById("auctionQuestionBox")
  if (box) box.innerText = currentAuctionQuestion

  updateAuctionGridOnly()
  updateAuctionBidInfo()
  highlightAuctionBidTeam()
  saveAuctionState()
  updateEndRoundButtonState()
}

/* =========================
   Bidding
========================= */

function bid(team) {
  if (!auctionState.questionOpened) {
    showGameToast("اختر رقم المزاد أولاً")
    return
  }

  if (auctionState.currentQuestionNumber === null) {
    showGameToast("اختر رقم المزاد أولاً")
    return
  }

  auctionState.currentBid += Number(auctionState.currentIncrement || 1)
  auctionState.bidTeam = team

  playGameSound("bid")

  updateAuctionBidInfo()
  highlightAuctionBidTeam()
  saveAuctionState()
}

function highlightAuctionBidTeam() {
  const a = document.getElementById("teamABox")
  const b = document.getElementById("teamBBox")

  if (!a || !b) return

  a.classList.remove("activeTeam")
  b.classList.remove("activeTeam")

  a.style.border = "2px solid var(--border-soft)"
  a.style.boxShadow = "var(--shadow-soft)"
  b.style.border = "2px solid var(--border-soft)"
  b.style.boxShadow = "var(--shadow-soft)"

  if (auctionState.bidTeam === "A") {
    a.classList.add("activeTeam")
    a.style.border = "3px solid #000"
    a.style.boxShadow = "0 0 0 4px rgba(0,0,0,.12), var(--shadow-soft)"
  }

  if (auctionState.bidTeam === "B") {
    b.classList.add("activeTeam")
    b.style.border = "3px solid #000"
    b.style.boxShadow = "0 0 0 4px rgba(0,0,0,.12), var(--shadow-soft)"
  }
}

function updateAuctionBidInfo() {
  const bidValue = document.getElementById("bidValue")
  const bidTeam = document.getElementById("bidTeam")

  if (bidValue) bidValue.innerText = auctionState.currentBid

  if (bidTeam) {
    if (auctionState.bidTeam === "A") bidTeam.innerText = teamAName
    else if (auctionState.bidTeam === "B") bidTeam.innerText = teamBName
    else bidTeam.innerText = "لا يوجد"
  }
}

/* =========================
   Scores / Grid / Timer
========================= */

function updateAuctionScoresOnly() {
  const a = document.getElementById("auctionScoreA")
  const b = document.getElementById("auctionScoreB")

  if (a) a.innerText = auctionState.scoreA
  if (b) b.innerText = auctionState.scoreB

  window.currentSegmentScores = {
    A: auctionState.scoreA,
    B: auctionState.scoreB
  }
}

function updateAuctionGridOnly() {
  const grid = document.getElementById("auctionGrid")
  if (grid) {
    grid.innerHTML = createAuctionGrid()
  }
}

function setAuctionTimerValue(value) {
  const timerBox = document.getElementById("timer")
  if (timerBox) timerBox.innerText = value
}

function startAuctionTimer() {
  if (!auctionState.questionOpened || auctionState.currentQuestionNumber === null) {
    showGameToast("اختر رقم المزاد أولاً")
    return
  }

  auctionTimerStarted = true
  runAuctionTimer(30)
}

function resumeAuctionTimer(seconds) {
  auctionTimerStarted = true
  runAuctionTimer(seconds)
}

function runAuctionTimer(seconds) {
  clearInterval(timer)
  timer = null

  let time = Number(seconds || 0)
  auctionLastTickPlayed = null
  setAuctionTimerValue(time)
  saveAuctionState()

  timer = setInterval(() => {
    time--
    setAuctionTimerValue(time)

    if (time > 0 && time <= 5 && auctionLastTickPlayed !== time) {
      auctionLastTickPlayed = time
      playGameSound("tick")
    }

    saveAuctionState()

    if (time <= 0) {
      clearInterval(timer)
      timer = null
      setAuctionTimerValue(0)
      auctionTimerStarted = false
      auctionLastTickPlayed = null
      playGameSound("timeout")
      saveAuctionState()
    }
  }, 1000)
}

/* =========================
   Result Buttons
========================= */

function auctionCorrect() {
  if (!auctionState.questionOpened || auctionState.currentQuestionNumber === null) {
    showGameToast("اختر رقم المزاد أولاً")
    return
  }

  if (!auctionState.bidTeam) {
    showGameToast("ابدأ المزايدة أولاً")
    return
  }

  let points = 1

  if (auctionState.currentBid >= 10) {
    points = Math.floor(auctionState.currentBid / 10)
  }

  if (auctionState.bidTeam === "A") {
    auctionState.scoreA += points
  } else if (auctionState.bidTeam === "B") {
    auctionState.scoreB += points
  }

  playGameSound("correct")
  updateAuctionScoresOnly()
  finishAuctionRound()
}

function auctionWrong() {
  if (!auctionState.questionOpened || auctionState.currentQuestionNumber === null) {
    showGameToast("اختر رقم المزاد أولاً")
    return
  }

  if (!auctionState.bidTeam) {
    showGameToast("ابدأ المزايدة أولاً")
    return
  }

  const otherTeam = auctionState.bidTeam === "A" ? "B" : "A"

  if (otherTeam === "A") {
    auctionState.scoreA += 1
  } else if (otherTeam === "B") {
    auctionState.scoreB += 1
  }

  playGameSound("wrong")
  updateAuctionScoresOnly()
  finishAuctionRound()
}

function finishAuctionRound() {
  clearInterval(timer)
  timer = null
  setAuctionTimerValue(0)
  auctionTimerStarted = false
  auctionLastTickPlayed = null
  auctionQuestionLocked = false

  auctionState.currentBid = 0
  auctionState.currentIncrement = 1
  auctionState.bidTeam = null
  auctionState.currentQuestionNumber = null
  auctionState.questionOpened = false

  currentAuctionAnswer = null
  currentAuctionQuestion = null

  const box = document.getElementById("auctionQuestionBox")
  if (box) box.innerText = "اختر رقم المزاد"

  updateAuctionBidInfo()
  highlightAuctionBidTeam()
  saveAuctionState()
  updateEndRoundButtonState()
}