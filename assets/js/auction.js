/* =========================
   Auction - Display
========================= */

let auctionState = {
  usedNumbers: [],
  scoreA: 0,
  scoreB: 0,
  currentQuestionNumber: null,
  pendingScore: false,
  answerShown: false,
  activeTeam: null,
  resultType: ""
}

window.auctionState = auctionState

let auctionDoubleState = {
  used: { A: false, B: false },
  activeTeam: null
}

let currentAuctionAnswer = ""
let currentAuctionImage = ""
let currentAuctionVideo = ""
let currentAuctionNote = ""

window.auctionMaxNumber = Number(
  window.auctionMaxNumber ||
  localStorage.getItem("auction_max_number") ||
  8
)

var auctionMaxNumber = window.auctionMaxNumber

let auctionHistory = []
const AUCTION_HISTORY_LIMIT = 50

let auctionTimerStarted = false
let auctionLastTickPlayed = null
let auctionDoublePickMode = false

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

function syncAuctionGlobals() {
  window.auctionState = auctionState
  window.auctionMaxNumber = auctionMaxNumber
  localStorage.setItem("auction_max_number", String(auctionMaxNumber))

  window.currentSegmentScores = {
    A: Number(auctionState.scoreA || 0),
    B: Number(auctionState.scoreB || 0)
  }
}

function saveAuctionState() {
  const timerBox = document.getElementById("auctionTimer")

  auctionMaxNumber = Math.min(Math.max(Number(auctionMaxNumber || 8), 1), 8)

  const safe = {
    auctionState: JSON.parse(JSON.stringify(auctionState)),
    auctionDoubleState: JSON.parse(JSON.stringify(auctionDoubleState)),
    currentAuctionAnswer,
    currentAuctionImage,
    currentAuctionVideo,
    currentAuctionNote,
    auctionMaxNumber,
    auctionTimerStarted,
    timerValue: timerBox ? Number(timerBox.innerText || 0) : 0
  }

  localStorage.setItem(AUCTION_STORAGE_KEY, JSON.stringify(safe))
  localStorage.setItem("active_segment", "auction")
  localStorage.setItem("auction_max_number", String(auctionMaxNumber))

  syncAuctionGlobals()

  if (typeof saveUnifiedGameState === "function") {
    saveUnifiedGameState()
  }

  if (typeof syncDisplayStateToSession === "function") {
    syncDisplayStateToSession()
  }
}

function restoreAuctionState(saved) {
  if (!saved) return

  auctionMaxNumber = Math.min(
    Math.max(
      Number(
        window.auctionMaxNumber ||
        localStorage.getItem("auction_max_number") ||
        saved.auctionMaxNumber ||
        auctionMaxNumber ||
        8
      ),
      1
    ),
    8
  )

  window.auctionMaxNumber = auctionMaxNumber
  localStorage.setItem("auction_max_number", String(auctionMaxNumber))

  auctionState = saved.auctionState || {
    usedNumbers: [],
    scoreA: 0,
    scoreB: 0,
    currentQuestionNumber: null,
    pendingScore: false,
    answerShown: false,
    activeTeam: null,
    resultType: ""
  }

  if (!Array.isArray(auctionState.usedNumbers)) {
    auctionState.usedNumbers = []
  }

  auctionState.usedNumbers = auctionState.usedNumbers
    .map(n => Number(n))
    .filter(n => n >= 1 && n <= auctionMaxNumber)

  auctionState.scoreA = Number(auctionState.scoreA || 0)
  auctionState.scoreB = Number(auctionState.scoreB || 0)
  auctionState.resultType = String(auctionState.resultType || "")

  auctionDoubleState = saved.auctionDoubleState || {
    used: { A: false, B: false },
    activeTeam: null
  }

  if (!auctionDoubleState.used) {
    auctionDoubleState.used = { A: false, B: false }
  }

  currentAuctionAnswer = saved.currentAuctionAnswer || ""
  currentAuctionImage = saved.currentAuctionImage || ""
  currentAuctionVideo = saved.currentAuctionVideo || ""
  currentAuctionNote = saved.currentAuctionNote || ""

  auctionTimerStarted = !!saved.auctionTimerStarted
  auctionLastTickPlayed = null
  auctionDoublePickMode = false

  syncAuctionGlobals()
}

/* =========================
   Settings
========================= */

async function loadAuctionMaxNumber() {
  if (!currentModel) {
    auctionMaxNumber = 8
    window.auctionMaxNumber = auctionMaxNumber
    localStorage.setItem("auction_max_number", String(auctionMaxNumber))
    return auctionMaxNumber
  }

  const { data, error } = await db
    .from("segment_settings")
    .select("item_count")
    .eq("model", Number(currentModel))
    .eq("segment", "auction")
    .maybeSingle()

  if (error) {
    console.log(error)
    auctionMaxNumber = 8
  } else {
    auctionMaxNumber = Math.min(
      Math.max(Number(data?.item_count || 8), 1),
      8
    )
  }

  window.auctionMaxNumber = auctionMaxNumber
  localStorage.setItem("auction_max_number", String(auctionMaxNumber))

  return auctionMaxNumber
}

/* =========================
   Double
========================= */

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
    currentAuctionVideo,
    currentAuctionNote,
    auctionMaxNumber,
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

  closeAuctionZoomOverlays()

  auctionState = cloneAuctionData(snapshot.auctionState)
  auctionDoubleState = cloneAuctionData(snapshot.auctionDoubleState || {
    used: { A: false, B: false },
    activeTeam: null
  })

  auctionMaxNumber = Math.min(
    Math.max(Number(snapshot.auctionMaxNumber || auctionMaxNumber || 8), 1),
    8
  )

  currentAuctionAnswer = snapshot.currentAuctionAnswer || ""
  currentAuctionImage = snapshot.currentAuctionImage || ""
  currentAuctionVideo = snapshot.currentAuctionVideo || ""
  currentAuctionNote = snapshot.currentAuctionNote || ""

  auctionTimerStarted = !!snapshot.auctionTimerStarted
  auctionLastTickPlayed = null
  auctionDoublePickMode = false

  syncAuctionGlobals()

  updateAuctionScoresOnly()
  updateAuctionGridOnly()
  highlightAuctionActiveTeam()
  renderAuctionContent()
  updateAuctionTurnBox()
  updateAuctionAnswerButton()
  updateAuctionDoubleButton()
  updateAuctionUndoButtonState()

  if (typeof updateEndRoundButtonState === "function") {
    updateEndRoundButtonState()
  }

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
  auctionDoublePickMode = false

  clearInterval(timer)
  timer = null

  closeAuctionZoomOverlays()

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
      activeTeam: null,
      resultType: ""
    }

    auctionDoubleState = {
      used: { A: false, B: false },
      activeTeam: null
    }

    currentAuctionAnswer = ""
    currentAuctionImage = ""
    currentAuctionVideo = ""
    currentAuctionNote = ""

    syncAuctionGlobals()
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

  if (typeof updateEndRoundButtonState === "function") {
    updateEndRoundButtonState()
  }

  saveAuctionState()
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

function resetAuctionTimer() {
  clearInterval(timer)
  timer = null
  auctionTimerStarted = false
  auctionLastTickPlayed = null
}

function isAuctionFinished() {
  const maxNumber = Math.min(
    Math.max(Number(window.auctionMaxNumber || auctionMaxNumber || 8), 1),
    8
  )

  return (window.auctionState?.usedNumbers || []).length >= maxNumber &&
    !window.auctionState?.pendingScore &&
    !window.auctionState?.currentQuestionNumber
}

/* =========================
   HTML
========================= */

function buildAuctionHTML() {
  return `
    <div class="auctionWrap">

      <div class="auctionTopBar">

        <div
          class="auctionTeamCard ${auctionState.activeTeam === "A" ? "activeTeam" : ""}"
          onclick="selectAuctionTeam('A')"
          id="auctionTeamABox"
        >
          <div class="auctionTeamName">${teamAName}</div>
          <div class="auctionTeamScore" id="auctionScoreA">${auctionState.scoreA}</div>
        </div>

        <div class="auctionMiddleCard">
          <div class="auctionTurnLabel" id="auctionTurnText">
            ${auctionState.activeTeam ? getAuctionTurnName() : "بدون فريق"}
          </div>
        </div>

        <div
          class="auctionTeamCard ${auctionState.activeTeam === "B" ? "activeTeam" : ""}"
          onclick="selectAuctionTeam('B')"
          id="auctionTeamBBox"
        >
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
        <button onclick="activateAuctionDouble()" id="auctionDoubleBtn" class="auctionDoubleBtn">دوبيلا</button>
        <button onclick="auctionCorrect()" class="btnCorrect">✓ إجابة صحيحة</button>
        <button onclick="auctionWrong()" class="btnWrong">✕ خطأ</button>
        <button onclick="undoAuctionAction()" id="auctionUndoBtn" class="undoBtn">تراجع</button>
      </div>

    </div>
  `
}

function createAuctionGrid() {
  let html = ""

  const maxNumber = Math.min(Math.max(Number(auctionMaxNumber || 8), 1), 8)

  for (let i = 1; i <= maxNumber; i++) {
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

/* =========================
   Content
========================= */

function buildAuctionContentHTML() {
  if (!auctionState.currentQuestionNumber) {
    return `<div class="auctionPlaceholder">اختر رقمًا لعرض الصورة أو الفيديو</div>`
  }

  if (auctionState.answerShown) {
    return buildAuctionResultHTML(auctionState.resultType || "")
  }

  let html = ""

  if (currentAuctionVideo) {
    html += `
      <div class="auctionVideoPreviewBox" onclick="openAuctionVideoFullscreen(event)">
        <video
          class="auctionVideoPreview"
          src="${currentAuctionVideo}"
          muted
          playsinline
          preload="metadata"
          controlslist="nodownload noplaybackrate"
          disablepictureinpicture
        ></video>

        <button
          type="button"
          class="auctionVideoPlayBtn"
          onclick="openAuctionVideoFullscreen(event)"
        >
          ▶
        </button>
      </div>
    `
  } else if (currentAuctionImage) {
    html += `
      <div class="auctionImagePreviewBox" onclick="toggleAuctionImageOverlay()">
        <img
          class="auctionImagePreview"
          src="${currentAuctionImage}"
          alt=""
        >
      </div>
    `
  } else {
    html += `<div class="auctionPlaceholder">لا توجد صورة أو فيديو</div>`
  }

  if (currentAuctionNote) {
    html += `
      <div class="auctionTopNote">
        ${currentAuctionNote}
      </div>
    `
  }

  return html
}

function buildAuctionResultHTML(resultType = "") {
  const resultClass =
    resultType === "correct"
      ? "correctResult"
      : resultType === "wrong"
      ? "wrongResult"
      : ""

  let mediaHTML = ""

  if (currentAuctionVideo) {
    mediaHTML = `
      <div class="auctionResultVideoBox" onclick="openAuctionVideoFullscreen(event)">
        <video
          class="auctionResultVideo"
          src="${currentAuctionVideo}"
          muted
          playsinline
          preload="metadata"
          controlslist="nodownload noplaybackrate"
          disablepictureinpicture
        ></video>

        <button
          type="button"
          class="auctionResultVideoPlay"
          onclick="openAuctionVideoFullscreen(event)"
        >
          ▶
        </button>
      </div>
    `
  } else if (currentAuctionImage) {
    mediaHTML = `
      <div class="auctionResultImageBoxClean" onclick="toggleAuctionImageOverlay()">
        <img
          src="${currentAuctionImage}"
          class="auctionResultImageClean"
          alt=""
        >
      </div>
    `
  } else {
    mediaHTML = `<div class="auctionResultEmpty">لا توجد صورة أو فيديو</div>`
  }

  return `
    <div class="auctionResultView ${resultClass}">
      <div class="auctionResultMediaBox">
        ${mediaHTML}
      </div>

      <div class="auctionResultAnswerBox">
        ${currentAuctionNote ? `<div class="auctionResultNote">${currentAuctionNote}</div>` : ""}

        <div class="auctionResultAnswerLabel">الإجابة</div>

        <div class="auctionResultAnswerText">
          ${currentAuctionAnswer || "لا توجد إجابة"}
        </div>
      </div>
    </div>
  `
}

function showAuctionAnswer(resultType = "") {
  auctionState.answerShown = true
  auctionState.resultType = resultType

  closeAuctionZoomOverlays()
  renderAuctionContent()
  saveAuctionState()
}

function updateAuctionTurnBox() {
  const turnBox = document.getElementById("auctionTurnText")
  if (!turnBox) return

  turnBox.innerText = auctionState.activeTeam
    ? getAuctionTurnName()
    : "بدون فريق"
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
  auctionState.resultType = ""

  currentAuctionAnswer = ""
  currentAuctionImage = ""
  currentAuctionVideo = ""
  currentAuctionNote = ""

  resetAuctionTimer()

  updateAuctionGridOnly()
  highlightAuctionActiveTeam()
  renderAuctionContent()
  updateAuctionDoubleButton()
  updateAuctionUndoButtonState()

  if (typeof updateEndRoundButtonState === "function") {
    updateEndRoundButtonState()
  }

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
  currentAuctionVideo = data?.video || ""
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

  if (auctionState.activeTeam === "A") a.classList.add("activeTeam")
  if (auctionState.activeTeam === "B") b.classList.add("activeTeam")

  updateAuctionDoubleButton()
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

  const videoOverlay = document.getElementById("auctionVideoFullscreenOverlay")
  if (videoOverlay) closeAuctionVideoFullscreen()

  const displayOverlay = document.getElementById("displayImageZoomOverlay")
  if (displayOverlay) displayOverlay.remove()

  document.body.classList.remove("auctionOverlayActive")
}

function flashAuctionZoomOverlayWrong() {
  const auctionOverlay = document.getElementById("auctionImageOverlay")
  const displayOverlay = document.getElementById("displayImageZoomOverlay")
  const videoOverlay = document.getElementById("auctionVideoFullscreenOverlay")

  const hasOverlay = auctionOverlay || displayOverlay || videoOverlay

  if (!hasOverlay) {
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

  const media =
    document.getElementById("auctionFullscreenVideo") ||
    document.querySelector("#auctionVideoFullscreenOverlay video") ||
    document.querySelector("#auctionImageOverlay img") ||
    document.getElementById("displayImageZoomImg")

  if (media) {
    media.classList.remove("mediaWrongShake")
    void media.offsetWidth
    media.classList.add("mediaWrongShake")
  }

  if (videoOverlay) {
    videoOverlay.classList.remove("auctionVideoWrongPulse")
    void videoOverlay.offsetWidth
    videoOverlay.classList.add("auctionVideoWrongPulse")
  }

  setTimeout(() => {
    flashLayer.classList.remove("auctionZoomFlashRun")

    if (videoOverlay) {
      videoOverlay.classList.remove("auctionVideoWrongPulse")
    }
  }, 850)

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

  pushAuctionHistory()

  auctionState.pendingScore = false
  auctionState.answerShown = true
  auctionState.resultType = "correct"

  const points = getAuctionScoreValue(team)

  if (team === "A") auctionState.scoreA += points
  if (team === "B") auctionState.scoreB += points

  clearAuctionActiveDouble(team)
  auctionDoublePickMode = false

  playGameSound("correct")
  flashScreen("correct")

 
  closeAuctionZoomOverlays()

  showAuctionAnswer("correct")

  updateAuctionScoresOnly()
  updateAuctionDoubleButton()
  updateAuctionUndoButtonState()

  saveAuctionState()

  setTimeout(() => {
    finalizeAuctionTurn()
  }, 10000)
}

function auctionWrong() {
  if (!auctionState.currentQuestionNumber) {
    showGameToast("اختر رقمًا أولاً")
    return
  }

  pushAuctionHistory()

  auctionDoubleState.activeTeam = null
  auctionDoublePickMode = false

  playGameSound("wrong")


  flashAuctionZoomOverlayWrong()
  flashScreen("wrong")

  updateAuctionDoubleButton()
  updateAuctionUndoButtonState()
  saveAuctionState()
}

function finalizeAuctionTurn() {
  auctionState.pendingScore = false
  auctionState.currentQuestionNumber = null
  auctionState.answerShown = false
  auctionState.resultType = ""
  auctionState.activeTeam = null

  currentAuctionAnswer = ""
  currentAuctionImage = ""
  currentAuctionVideo = ""
  currentAuctionNote = ""

  resetAuctionTimer()
  closeAuctionZoomOverlays()
  highlightAuctionActiveTeam()
  renderAuctionContent()
  updateAuctionTurnBox()
  updateAuctionDoubleButton()

  if (typeof updateEndRoundButtonState === "function") {
    updateEndRoundButtonState()
  }

  saveAuctionState()
}

/* =========================
   Image Overlay
========================= */

function toggleAuctionImageOverlay() {
  const oldOverlay = document.getElementById("auctionImageOverlay")

  if (oldOverlay) {
    oldOverlay.classList.add("closing")

    setTimeout(() => {
      oldOverlay.remove()
    }, 160)

    return
  }

  if (!currentAuctionImage) return

  const overlay = document.createElement("div")
  overlay.id = "auctionImageOverlay"
  overlay.className = "auctionImageOverlay"

  overlay.innerHTML = `
    <div class="auctionImageOverlayInner" onclick="event.stopPropagation()">
      <img
        src="${currentAuctionImage}"
        class="auctionImageOverlayImg"
        alt=""
        onclick="toggleAuctionImageOverlay()"
      >
    </div>
  `

  overlay.onclick = function () {
    toggleAuctionImageOverlay()
  }

  document.body.appendChild(overlay)
}

/* =========================
   Video Fullscreen
========================= */
function openAuctionVideoFullscreen(e) {
  if (e) {
    e.preventDefault()
    e.stopPropagation()
  }

  if (!currentAuctionVideo) return

  const oldOverlay = document.getElementById("auctionVideoFullscreenOverlay")
  if (oldOverlay) oldOverlay.remove()

  const overlay = document.createElement("div")
  overlay.id = "auctionVideoFullscreenOverlay"
  overlay.className = "auctionVideoFullscreenOverlay"

  overlay.innerHTML = `
    <button
      type="button"
      class="auctionVideoFullscreenClose"
      onclick="closeAuctionVideoFullscreen(event)"
    >
      ×
    </button>

    <div class="auctionVideoFullscreenInner" onclick="event.stopPropagation()">
      <video
        id="auctionFullscreenVideo"
        class="auctionFullscreenVideo"
        src="${currentAuctionVideo}"
        controls
        autoplay
        loop
        playsinline
        preload="auto"
        controlslist="nodownload noplaybackrate"
        disablepictureinpicture
      ></video>
    </div>
  `

  overlay.onclick = function () {
    closeAuctionVideoFullscreen()
  }

  document.body.appendChild(overlay)

  const video = document.getElementById("auctionFullscreenVideo")

  if (video) {
    video.loop = true
    video.currentTime = 0
    video.muted = false
    video.volume = 1

    video.onended = () => {
      try {
        video.currentTime = 0
        video.play().catch(() => {})
      } catch (e) {
        console.log("auction video replay error:", e)
      }
    }

    const playPromise = video.play()

    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {
        showGameToast("اضغط تشغيل مرة أخرى")
      })
    }
  }
}

function closeAuctionVideoFullscreen(e) {
  if (e) {
    e.preventDefault()
    e.stopPropagation()
  }

  const overlay = document.getElementById("auctionVideoFullscreenOverlay")
  if (!overlay) return

  const video = document.getElementById("auctionFullscreenVideo")

  if (video) {
    video.pause()
    video.removeAttribute("src")
    video.load()
  }

  overlay.remove()
}


/* =========================
   Auction - Presenter Video Commands
   تشغيل فيديو الفتبلة من المقدم
========================= */

function playCurrentAuctionVideo() {
  if (!auctionState.currentQuestionNumber) {
    showGameToast("افتح رقم أولاً")
    return
  }

  if (!currentAuctionVideo) {
    showGameToast("لا يوجد فيديو حالي")
    return
  }

  openAuctionVideoFullscreen()
}

function restartCurrentAuctionVideo() {
  if (!auctionState.currentQuestionNumber) {
    showGameToast("افتح رقم أولاً")
    return
  }

  if (!currentAuctionVideo) {
    showGameToast("لا يوجد فيديو حالي")
    return
  }

  closeAuctionVideoFullscreen()
  openAuctionVideoFullscreen()
}

function stopCurrentAuctionVideo() {
  const video = document.getElementById("auctionFullscreenVideo")

  if (video) {
    video.pause()
    video.currentTime = 0
  }

  closeAuctionVideoFullscreen()
}

window.playCurrentAuctionVideo = playCurrentAuctionVideo
window.restartCurrentAuctionVideo = restartCurrentAuctionVideo
window.stopCurrentAuctionVideo = stopCurrentAuctionVideo
