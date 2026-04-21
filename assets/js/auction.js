let auctionState = {
  usedNumbers: [],
  scoreA: 0,
  scoreB: 0,
  currentQuestionNumber: null,
  pendingScore: false,
  answerShown: false,
  activeTeam: null
}

window.auctionState = auctionState

let currentAuctionAnswer = ""
let currentAuctionImage = ""
let currentAuctionNote = ""
let auctionMaxNumber = 4

window.auctionMaxNumber = auctionMaxNumber

let auctionHistory = []
const AUCTION_HISTORY_LIMIT = 50

let auctionTimerStarted = false
let auctionLastTickPlayed = null

/* =========================
   Undo
========================= */

function cloneAuctionData(data) {
  return JSON.parse(JSON.stringify(data))
}

function createAuctionSnapshot() {
  const timerBox = document.getElementById("auctionTimer")
  return {
    auctionState: cloneAuctionData(auctionState),
    currentAuctionAnswer,
    currentAuctionImage,
    currentAuctionNote,
    auctionTimerStarted,
    timerValue: timerBox ? Number(timerBox.innerText || 0) : 0
  }
}

function pushAuctionHistory() {
  auctionHistory.push(createAuctionSnapshot())

  if (auctionHistory.length > AUCTION_HISTORY_LIMIT) {
    auctionHistory.shift()
  }

  updateAuctionUndoButtonState()
}

function restoreAuctionSnapshot(snapshot) {
  if (!snapshot) return

  clearInterval(timer)
  timer = null

  auctionState = cloneAuctionData(snapshot.auctionState)
  window.auctionState = auctionState

  currentAuctionAnswer = snapshot.currentAuctionAnswer || ""
  currentAuctionImage = snapshot.currentAuctionImage || ""
  currentAuctionNote = snapshot.currentAuctionNote || ""

  auctionTimerStarted = !!snapshot.auctionTimerStarted
  auctionLastTickPlayed = null

  updateAuctionScoresOnly()
  updateAuctionGridOnly()
  highlightAuctionActiveTeam()
  renderAuctionContent()
  updateAuctionTurnBox()
  updateAuctionUndoButtonState()
  updateEndRoundButtonState()

  const timerValue = Number(snapshot.timerValue || 0)
  const timerBox = document.getElementById("auctionTimer")
  if (auctionTimerStarted && timerValue > 0) {
    resumeAuctionTimer(timerValue)
  } else if (timerBox) {
    timerBox.innerText = timerValue || 0
  }
}

function undoAuctionAction() {
  if (!auctionHistory.length) {
    showGameToast("لا يوجد خطوة للتراجع")
    return
  }

  const snapshot = auctionHistory.pop()
  restoreAuctionSnapshot(snapshot)
}

function updateAuctionUndoButtonState() {
  const btn = document.getElementById("auctionUndoBtn")
  if (!btn) return
  btn.disabled = auctionHistory.length === 0
}

/* =========================
   Render
========================= */

window.renderAuction = async function () {
  auctionState = {
    usedNumbers: [],
    scoreA: 0,
    scoreB: 0,
    currentQuestionNumber: null,
    pendingScore: false,
    answerShown: false,
    activeTeam: null
  }

  window.auctionState = auctionState
  window.currentSegmentScores = { A: 0, B: 0 }

  currentAuctionAnswer = ""
  currentAuctionImage = ""
  currentAuctionNote = ""

  auctionHistory = []
  auctionTimerStarted = false
  auctionLastTickPlayed = null

  clearInterval(timer)
  timer = null

  await loadAuctionMaxNumber()

  openSegment("فتبلة", buildAuctionHTML())
  updateAuctionUndoButtonState()
  updateAuctionTurnBox()
  updateEndRoundButtonState()
}

async function loadAuctionMaxNumber() {
  const { data, error } = await db
    .from("segment_settings")
    .select("item_count")
    .eq("model", currentModel)
    .eq("segment", "auction")
    .maybeSingle()

  if (error) {
    console.log(error)
    auctionMaxNumber = 8
    window.auctionMaxNumber = auctionMaxNumber
    return
  }

  auctionMaxNumber = Math.min(
    Math.max(Number(data?.item_count || 8), 1),
    8
  )

  window.auctionMaxNumber = auctionMaxNumber
}

/* =========================
   Helpers
========================= */

function getAuctionTurnName() {
  if (auctionState.activeTeam === "A") return teamAName
  if (auctionState.activeTeam === "B") return teamBName
  return "اختر فريق"
}

/* =========================
   HTML
========================= */

function buildAuctionHTML() {
  return `
    <div class="auctionWrap">

      <div class="auctionTopBar">

        <div class="auctionTeamCard ${auctionState.activeTeam === "A" ? "activeTeam" : ""}" onclick="selectAuctionTeam('A')" id="auctionTeamABox">
          <div class="auctionTeamName">${teamAName}</div>
          <div class="auctionTeamScore" id="auctionScoreA">${auctionState.scoreA}</div>
        </div>

        <div class="auctionMiddleCard">
          <div class="auctionTimerLabel">المؤقت</div>
          <div class="auctionTimerValue" id="auctionTimer">0</div>
          <div class="auctionTurnLabel" id="auctionTurnText">
            الدور: ${getAuctionTurnName()}
          </div>
        </div>

        <div class="auctionTeamCard ${auctionState.activeTeam === "B" ? "activeTeam" : ""}" onclick="selectAuctionTeam('B')" id="auctionTeamBBox">
          <div class="auctionTeamName">${teamBName}</div>
          <div class="auctionTeamScore" id="auctionScoreB">${auctionState.scoreB}</div>
        </div>

      </div>

      <div class="auctionQuestionBox auctionQuestionBoxCompact auctionQuestionBoxEmpty" id="auctionQuestionBox">
        ${buildAuctionContentHTML()}
      </div>

      <div class="auctionGrid" id="auctionGrid">
        ${createAuctionGrid()}
      </div>

      <div class="auctionControlPanel">
        <button onclick="startAuctionTimerButton()" class="startBtn">بدء المؤقت</button>
        <button onclick="showAuctionAnswer()" class="btnAnswer">إظهار الإجابة</button>
        <button onclick="auctionCorrect()" class="btnCorrect">✓ إجابة صحيحة</button>
        <button onclick="auctionWrong()" class="btnWrong">✕ خطأ</button>
        <button onclick="undoAuctionAction()" id="auctionUndoBtn" class="undoBtn">تراجع</button>
      </div>

    </div>
  `
}

function createAuctionGrid() {
  let html = ""

  for (let i = 1; i <= auctionMaxNumber; i++) {
    const used = auctionState.usedNumbers.includes(i)

    html += `
      <button
        onclick="openAuction(${i})"
        class="auctionBtn ${used ? "used" : ""}"
        ${used ? "disabled" : ""}
      >
        ${used ? "" : i}
      </button>
    `
  }

  return html
}

function buildAuctionContentHTML() {
  if (!auctionState.currentQuestionNumber) {
    return `<div class="auctionPlaceholder">اختر رقمًا لعرض الصورة</div>`
  }

  let html = ""

  if (currentAuctionImage) {
    html += `
      <div class="auctionImageFrame" onclick="toggleAuctionImageOverlay()">
        <img class="auctionBigImage" src="${currentAuctionImage}" alt="">
      </div>
    `
  } else {
    html += `<div class="auctionPlaceholder">لا توجد صورة</div>`
  }

  if (currentAuctionNote) {
    html += `
      <div class="auctionTopNote">
        ${currentAuctionNote}
      </div>
    `
  }

  if (auctionState.answerShown && currentAuctionAnswer) {
    html += `
      <div class="auctionBottomAnswer">
        ${currentAuctionAnswer}
      </div>
    `
  }

  return html
}

function updateAuctionTurnBox() {
  const turnBox = document.getElementById("auctionTurnText")
  if (turnBox) {
    turnBox.innerText = "الدور: " + getAuctionTurnName()
  }
}

function renderAuctionContent() {
  const box = document.getElementById("auctionQuestionBox")
  if (box) {
    box.innerHTML = buildAuctionContentHTML()

    box.classList.remove("auctionQuestionBoxEmpty", "auctionQuestionBoxFilled")

    if (!auctionState.currentQuestionNumber) {
      box.classList.add("auctionQuestionBoxEmpty")
    } else {
      box.classList.add("auctionQuestionBoxFilled")
    }
  }

  updateAuctionTurnBox()
}

/* =========================
   Open Card
========================= */

async function openAuction(number) {
  if (auctionState.pendingScore) {
    showGameToast("أنهِ الدور الحالي أولاً")
    return
  }

  if (auctionState.usedNumbers.includes(number)) return

  pushAuctionHistory()

  auctionState.currentQuestionNumber = number
  auctionState.usedNumbers.push(number)
  auctionState.pendingScore = true
  auctionState.answerShown = false
  auctionState.activeTeam = null

  currentAuctionAnswer = ""
  currentAuctionImage = ""
  currentAuctionNote = ""

  clearInterval(timer)
  timer = null
  auctionTimerStarted = false
  auctionLastTickPlayed = null
  const timerBox = document.getElementById("auctionTimer")
  if (timerBox) timerBox.innerText = 0

  updateAuctionGridOnly()
  highlightAuctionActiveTeam()
  renderAuctionContent()
  updateAuctionUndoButtonState()
  updateEndRoundButtonState()

  await loadAuctionCurrent()
}

async function loadAuctionCurrent() {
  const number = auctionState.currentQuestionNumber
  if (!number) return

  const { data, error } = await db
    .from("auction_questions")
    .select("*")
    .eq("model", currentModel)
    .eq("number", number)
    .single()

  if (error) {
    console.log(error)
    showGameToast("تعذر تحميل بيانات الفقرة")
    return
  }

  currentAuctionAnswer = data?.answer || ""
  currentAuctionImage = data?.image || ""
  currentAuctionNote = data?.note || ""

  renderAuctionContent()
}

/* =========================
   Team Select
========================= */

function selectAuctionTeam(team) {
  if (!auctionState.pendingScore || !auctionState.currentQuestionNumber) {
    showGameToast("اختر رقمًا أولاً")
    return
  }

  if (auctionState.activeTeam === team) return

  pushAuctionHistory()

  auctionState.activeTeam = team
  highlightAuctionActiveTeam()
  renderAuctionContent()
  updateAuctionUndoButtonState()
}

function highlightAuctionActiveTeam() {
  const a = document.getElementById("auctionTeamABox")
  const b = document.getElementById("auctionTeamBBox")

  if (!a || !b) return

  a.classList.remove("activeTeam")
  b.classList.remove("activeTeam")

  if (auctionState.activeTeam === "A") {
    a.classList.add("activeTeam")
  }

  if (auctionState.activeTeam === "B") {
    b.classList.add("activeTeam")
  }
}

/* =========================
   Timer
========================= */

function startAuctionTimerButton() {
  if (!auctionState.pendingScore || auctionState.currentQuestionNumber === null) {
    showGameToast("اختر رقمًا أولاً")
    return
  }

  if (!auctionState.activeTeam) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  if (auctionTimerStarted) return

  pushAuctionHistory()
  auctionTimerStarted = true
  runAuctionTimer(30)
  updateAuctionUndoButtonState()
}

function resumeAuctionTimer(seconds) {
  runAuctionTimer(seconds)
}

function runAuctionTimer(seconds) {
  const timerBox = document.getElementById("auctionTimer")
  if (!timerBox) return

  clearInterval(timer)
  timer = null

  let time = Number(seconds || 0)
  auctionLastTickPlayed = null
  timerBox.innerText = time

  timer = setInterval(() => {
    time--
    timerBox.innerText = time

    if (time > 0 && time <= 5 && auctionLastTickPlayed !== time) {
      auctionLastTickPlayed = time
      playGameSound("tick")
    }

    if (time <= 0) {
      clearInterval(timer)
      timer = null
      timerBox.innerText = 0
      auctionTimerStarted = false
      auctionLastTickPlayed = null
      playGameSound("timeout")
    }
  }, 1000)
}

function resetAuctionTimer() {
  clearInterval(timer)
  timer = null
  auctionTimerStarted = false
  auctionLastTickPlayed = null

  const timerBox = document.getElementById("auctionTimer")
  if (timerBox) timerBox.innerText = 0
}

/* =========================
   Scores / Grid
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

/* =========================
   Answer / Result Buttons
========================= */

function showAuctionAnswer() {
  if (!auctionState.pendingScore || !auctionState.currentQuestionNumber) {
    showGameToast("اختر رقمًا أولاً")
    return
  }

  pushAuctionHistory()

  if (!auctionState.answerShown) {
    auctionState.answerShown = true
    renderAuctionContent()
  }

  playGameSound("answer")
  updateAuctionUndoButtonState()

  setTimeout(() => {
    finalizeAuctionTurn()
  }, 4000)
}

function auctionCorrect() {
  const team = auctionState.activeTeam

  if (!auctionState.pendingScore || auctionState.currentQuestionNumber === null) {
    showGameToast("اختر رقمًا أولاً")
    return
  }

  if (!team) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  pushAuctionHistory()

  if (!auctionState.answerShown) {
    auctionState.answerShown = true
    renderAuctionContent()
  }

  if (team === "A") {
    auctionState.scoreA += 1
  } else if (team === "B") {
    auctionState.scoreB += 1
  }

  playGameSound("correct")
  updateAuctionScoresOnly()
  updateAuctionUndoButtonState()

  setTimeout(() => {
    finalizeAuctionTurn()
  }, 4000)
}

function auctionWrong() {
  const team = auctionState.activeTeam

  if (!auctionState.pendingScore || auctionState.currentQuestionNumber === null) {
    showGameToast("اختر رقمًا أولاً")
    return
  }

  if (!team) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  pushAuctionHistory()

  playGameSound("wrong")
  updateAuctionUndoButtonState()

  setTimeout(() => {
    finalizeAuctionTurn()
  }, 1500)
}

function finalizeAuctionTurn() {
  auctionState.pendingScore = false
  auctionState.currentQuestionNumber = null
  auctionState.answerShown = false
  auctionState.activeTeam = null

  currentAuctionAnswer = ""
  currentAuctionImage = ""
  currentAuctionNote = ""

  resetAuctionTimer()
  highlightAuctionActiveTeam()
  renderAuctionContent()
  updateAuctionTurnBox()
  updateEndRoundButtonState()
}

/* =========================
   Image Overlay
========================= */

function toggleAuctionImageOverlay() {
  const oldOverlay = document.getElementById("auctionImageOverlay")

  if (oldOverlay) {
    oldOverlay.remove()
    return
  }

  if (!currentAuctionImage) return

  const overlay = document.createElement("div")
  overlay.id = "auctionImageOverlay"
  overlay.className = "auctionImageOverlay"
  overlay.innerHTML = `
    <div class="auctionImageOverlayInner">
      <img src="${currentAuctionImage}" class="auctionImageOverlayImg" alt="">
    </div>
  `

  overlay.onclick = function () {
    overlay.remove()
  }

  document.body.appendChild(overlay)
}