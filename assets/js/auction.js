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

let auctionDoubleState = {
  used: { A: false, B: false },
  activeTeam: null
}

let currentAuctionAnswer = ""
let currentAuctionImage = ""
let currentAuctionNote = ""
let auctionMaxNumber = 4

window.auctionMaxNumber = auctionMaxNumber

let auctionHistory = []
const AUCTION_HISTORY_LIMIT = 50

let auctionTimerStarted = false
let auctionLastTickPlayed = null

const AUCTION_STORAGE_KEY = "auction_state_v2"

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
  const timerBox = document.getElementById("auctionTimer")

  const safe = {
    auctionState: JSON.parse(JSON.stringify(auctionState)),
    auctionDoubleState: JSON.parse(JSON.stringify(auctionDoubleState)),
    currentAuctionAnswer,
    currentAuctionImage,
    currentAuctionNote,
    auctionMaxNumber,
    auctionTimerStarted,
    timerValue: timerBox ? Number(timerBox.innerText || 0) : 0
  }

  localStorage.setItem(AUCTION_STORAGE_KEY, JSON.stringify(safe))
  localStorage.setItem("active_segment", "auction")

  window.auctionState = auctionState
  window.auctionMaxNumber = auctionMaxNumber
  window.currentSegmentScores = {
    A: auctionState.scoreA,
    B: auctionState.scoreB
  }

  if (typeof syncDisplayStateToSession === "function") {
    syncDisplayStateToSession()
  }
}

function restoreAuctionState(saved) {
  if (!saved) return

  auctionState = saved.auctionState || {
    usedNumbers: [],
    scoreA: 0,
    scoreB: 0,
    currentQuestionNumber: null,
    pendingScore: false,
    answerShown: false,
    activeTeam: null
  }

  auctionDoubleState = saved.auctionDoubleState || {
    used: { A: false, B: false },
    activeTeam: null
  }

  window.auctionState = auctionState

  currentAuctionAnswer = saved.currentAuctionAnswer || ""
  currentAuctionImage = saved.currentAuctionImage || ""
  currentAuctionNote = saved.currentAuctionNote || ""
  auctionMaxNumber = Number(saved.auctionMaxNumber || 4)
  window.auctionMaxNumber = auctionMaxNumber

  auctionTimerStarted = !!saved.auctionTimerStarted
  auctionLastTickPlayed = null

  window.currentSegmentScores = {
    A: auctionState.scoreA,
    B: auctionState.scoreB
  }
}

/* =========================
   Double
========================= */

let auctionDoublePickMode = false

function selectAuctionTeam(team) {
  if (auctionDoublePickMode) {
    if (auctionState.currentQuestionNumber || auctionState.pendingScore) {
      showGameToast("الدوبيلا قبل اختيار الرقم فقط")
      auctionDoublePickMode = false
      updateAuctionDoubleButton()
      return
    }

    if (auctionDoubleState.used[team]) {
      showGameToast("هذا الفريق استخدم الدوبيلا مسبقًا")
      return
    }

    pushAuctionHistory()

    auctionState.activeTeam = team
    auctionDoubleState.used[team] = true
    auctionDoubleState.activeTeam = team
    auctionDoublePickMode = false

    showGameToast(`تم تفعيل الدوبيلا لفريق ${team === "A" ? teamAName : teamBName}`)

    highlightAuctionActiveTeam()
    renderAuctionContent()
    updateAuctionDoubleButton()
    updateAuctionUndoButtonState()
    saveAuctionState()
    return
  }

  if (!auctionState.currentQuestionNumber || !auctionState.pendingScore) {
    showGameToast("اختر الرقم أولاً")
    return
  }

  pushAuctionHistory()

  auctionState.activeTeam = auctionState.activeTeam === team ? null : team

  highlightAuctionActiveTeam()
  renderAuctionContent()
  updateAuctionDoubleButton()
  updateAuctionUndoButtonState()
  saveAuctionState()
}

function activateAuctionDouble() {
  if (auctionState.currentQuestionNumber || auctionState.pendingScore) {
    showGameToast("الدوبيلا قبل اختيار الرقم فقط")
    return
  }

  if (auctionDoubleState.used.A && auctionDoubleState.used.B) {
    showGameToast("تم استخدام الدوبيلا من الفريقين")
    return
  }

  auctionDoublePickMode = true
  showGameToast("اختر الفريق لتفعيل الدوبيلا")
  updateAuctionDoubleButton()
}

function getAuctionScoreValue(team) {
  return auctionDoubleState.activeTeam === team ? 2 : 1
}

function clearAuctionActiveDouble(team) {
  if (auctionDoubleState.activeTeam === team) {
    auctionDoubleState.activeTeam = null
  }
}

function updateAuctionDoubleButton() {
  const btn = document.getElementById("auctionDoubleBtn")
  if (!btn) return

  const team = auctionState.activeTeam

  btn.classList.remove("activeDouble")

  if (auctionDoublePickMode) {
    btn.disabled = false
    btn.innerText = "اختر الفريق"
    btn.classList.add("activeDouble")
    return
  }

  if (auctionState.currentQuestionNumber || auctionState.pendingScore) {
    btn.disabled = true
    btn.innerText = "دوبيلا"
    return
  }

  if (auctionDoubleState.used.A && auctionDoubleState.used.B) {
    btn.disabled = true
    btn.innerText = "الدوبيلا مقفل"
    return
  }

  if (team && auctionDoubleState.activeTeam === team) {
    btn.disabled = true
    btn.innerText = "الدوبيلا مفعّل"
    btn.classList.add("activeDouble")
    return
  }

  btn.disabled = false
  btn.innerText = "دوبيلا"
}
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
    auctionDoubleState: cloneAuctionData(auctionDoubleState),
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
  auctionDoubleState = cloneAuctionData(snapshot.auctionDoubleState || {
    used: { A: false, B: false },
    activeTeam: null
  })

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
  updateAuctionAnswerButton()
  updateAuctionDoubleButton()
  updateAuctionUndoButtonState()
  updateEndRoundButtonState()



  saveAuctionState()
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
  auctionHistory = []
  auctionTimerStarted = false
  auctionLastTickPlayed = null

  clearInterval(timer)
  timer = null

  await loadAuctionMaxNumber()

  const saved = getAuctionState()

  if (saved) {
    restoreAuctionState(saved)
  } else {
    auctionState = {
      usedNumbers: [],
      scoreA: 0,
      scoreB: 0,
      currentQuestionNumber: null,
      pendingScore: false,
      answerShown: false,
      activeTeam: null
    }

    auctionDoubleState = {
      used: { A: false, B: false },
      activeTeam: null
    }

    window.auctionState = auctionState
    window.currentSegmentScores = { A: 0, B: 0 }

    currentAuctionAnswer = ""
    currentAuctionImage = ""
    currentAuctionNote = ""
  }

  openSegment("فتبلة", buildAuctionHTML())

  updateAuctionScoresOnly()
  updateAuctionGridOnly()
  highlightAuctionActiveTeam()
  renderAuctionContent()
  updateAuctionTurnBox()
  updateAuctionAnswerButton()
  updateAuctionDoubleButton()
  updateAuctionUndoButtonState()
  updateEndRoundButtonState()



  saveAuctionState()
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

function updateAuctionAnswerButton() {}

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
  <div class="auctionTurnLabel" id="auctionTurnText">
    ${auctionState.activeTeam ? ` ${getAuctionTurnName()}` : "بدون فريق"}
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
        <button onclick="activateAuctionDouble()" id="auctionDoubleBtn" class="auctionDoubleBtn">دبل</button>
        

        

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
    turnBox.innerText = auctionState.activeTeam
      ? " " + getAuctionTurnName()
      : "بدون فريق"
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
  updateAuctionAnswerButton()
  updateAuctionDoubleButton()
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

  currentAuctionAnswer = ""
  currentAuctionImage = ""
  currentAuctionNote = ""

  clearInterval(timer)
  timer = null
  auctionTimerStarted = false
  auctionLastTickPlayed = null

  updateAuctionGridOnly()
  highlightAuctionActiveTeam()
  renderAuctionContent()
  updateAuctionDoubleButton()
  updateAuctionUndoButtonState()
  updateEndRoundButtonState()
  saveAuctionState()

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
  saveAuctionState()
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

  updateAuctionDoubleButton()
}

function resetAuctionTimer() {
  clearInterval(timer)
  timer = null
  auctionTimerStarted = false
  auctionLastTickPlayed = null
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
function closeAuctionZoomOverlays() {
  const auctionOverlay = document.getElementById("auctionImageOverlay")
  if (auctionOverlay) auctionOverlay.remove()

  const displayOverlay = document.getElementById("displayImageZoomOverlay")
  if (displayOverlay) {
    displayOverlay.classList.add("hidden")
    displayOverlay.classList.remove("auctionWrongFlash", "auctionZoomWrongFlash")

    const img = document.getElementById("displayImageZoomImg")
    if (img) {
      img.classList.remove("auctionWrongFlash", "auctionZoomWrongFlash")
      img.removeAttribute("src")
    }
  }

  if (typeof closeCurrentDisplayImageZoom === "function") {
    closeCurrentDisplayImageZoom()
  }
}

function flashAuctionZoomOverlayWrong() {
  const auctionOverlay = document.getElementById("auctionImageOverlay")
  const displayOverlay = document.getElementById("displayImageZoomOverlay")

  const auctionVisible = auctionOverlay && !auctionOverlay.classList.contains("hidden")
  const displayVisible = displayOverlay && !displayOverlay.classList.contains("hidden")

  if (!auctionVisible && !displayVisible) {
    return false
  }

  let flashLayer = document.getElementById("auctionZoomFlashLayer")

  if (!flashLayer) {
    flashLayer = document.createElement("div")
    flashLayer.id = "auctionZoomFlashLayer"
    flashLayer.className = "auctionZoomFlashLayer"
    document.body.appendChild(flashLayer)
  }

  flashLayer.classList.remove("auctionZoomFlashRun")
  void flashLayer.offsetWidth
  flashLayer.classList.add("auctionZoomFlashRun")

  const img =
    document.querySelector("#auctionImageOverlay img") ||
    document.getElementById("displayImageZoomImg")

  if (img) {
    img.classList.remove("auctionZoomImageShake")
    void img.offsetWidth
    img.classList.add("auctionZoomImageShake")
  }

  setTimeout(() => {
    flashLayer.classList.remove("auctionZoomFlashRun")
  }, 800)

  return true
}

function auctionCorrect() {
  const team = auctionState.activeTeam

  if (!auctionState.pendingScore || auctionState.currentQuestionNumber === null) {
    showGameToast("اختر رقمًا أولاً")
    return
  }

  if (!team) {
    showGameToast("اختر الفريق أولاً لتسجيل النقطة")
    return
  }

  closeAuctionZoomOverlays()

  pushAuctionHistory()

  auctionState.pendingScore = false
  auctionState.answerShown = true

  const points = getAuctionScoreValue(team)

  if (team === "A") auctionState.scoreA += points
  if (team === "B") auctionState.scoreB += points

  auctionDoubleState.activeTeam = null

  renderAuctionContent()
  playGameSound("correct")
  flashScreen("correct")

  updateAuctionScoresOnly()
  updateAuctionDoubleButton()
  updateAuctionUndoButtonState()
  saveAuctionState()

  setTimeout(() => {
    auctionState.currentQuestionNumber = null
    auctionState.answerShown = false
    auctionState.activeTeam = null

    currentAuctionAnswer = ""
    currentAuctionImage = ""
    currentAuctionNote = ""

    highlightAuctionActiveTeam()
    renderAuctionContent()
    updateAuctionTurnBox()
    updateAuctionDoubleButton()
    updateEndRoundButtonState()
    saveAuctionState()
  }, 10000)
}

function auctionWrong() {
  if (!auctionState.currentQuestionNumber) {
    showGameToast("اختر رقمًا أولاً")
    return
  }

  pushAuctionHistory()

  auctionDoubleState.activeTeam = null

  playGameSound("wrong")

  const flashedOverlay = flashAuctionZoomOverlayWrong()

  if (!flashedOverlay) {
    flashScreen("wrong")
  }

  updateAuctionDoubleButton()
  saveAuctionState()
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
  updateAuctionDoubleButton()
  updateEndRoundButtonState()
  saveAuctionState()
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