let whoState = {
  usedNumbers: [],
  scoreA: 0,
  scoreB: 0,
  currentPoints: 0,
  activeTeam: null,
  manualStartDone: false,
  lastAnsweredTeam: null
}

window.whoState = whoState

let whoDoubleState = {
  used: { A: false, B: false },
  activeTeam: null
}

let currentWhoAnswer = null
let currentWhoImage = null
let whoQuestionLocked = false
let whoCurrentNumber = null
let whoLastTickPlayed = null
let whoTimerStarted = false
let whoCompensationMode = false
let whoScoringLocked = false
let whoMaxNumber = Number(
  window.whoMaxNumber ||
  localStorage.getItem("who_max_number") ||
  15
)
const WHO_STORAGE_KEY = "who_state_v1"

/* =========================
   Persistence
========================= */

function getWhoState() {
  try {
    return JSON.parse(localStorage.getItem(WHO_STORAGE_KEY) || "null")
  } catch {
    return null
  }
}
function syncWhoGlobals() {
  window.whoState = whoState
  window.whoCurrentNumber = whoCurrentNumber

  window.currentSegmentScores = {
    A: Number(whoState?.scoreA || 0),
    B: Number(whoState?.scoreB || 0)
  }
}

function saveWhoState() {
  const timerBox = document.getElementById("timer")

  const state = {
    whoState: JSON.parse(JSON.stringify(whoState)),
    whoDoubleState: JSON.parse(JSON.stringify(whoDoubleState)),
    currentWhoAnswer,
    currentWhoImage,
    whoQuestionLocked,
    whoCurrentNumber,
    whoTimerStarted,
    whoCompensationMode,
    timerValue: timerBox ? Number(timerBox.innerText || 0) : 0
  }

  localStorage.setItem(WHO_STORAGE_KEY, JSON.stringify(state))
  localStorage.setItem("active_segment", "who")

  syncWhoGlobals()

  if (typeof saveUnifiedGameState === "function") {
    saveUnifiedGameState()
  }

  if (typeof syncDisplayStateToSession === "function") {
    syncDisplayStateToSession()
  }
}

function restoreWhoState(saved) {
  if (!saved) return

  whoState = saved.whoState || whoState

  whoDoubleState = saved.whoDoubleState || {
    used: { A: false, B: false },
    activeTeam: null
  }

  currentWhoAnswer = saved.currentWhoAnswer || null
  currentWhoImage = saved.currentWhoImage || null
  whoQuestionLocked = !!saved.whoQuestionLocked
  whoCurrentNumber = saved.whoCurrentNumber || null
  whoTimerStarted = !!saved.whoTimerStarted
  whoCompensationMode = !!saved.whoCompensationMode
  whoLastTickPlayed = null

  syncWhoGlobals()
  if (whoState.activeTeam) {
  setWhoActiveTeam(whoState.activeTeam, { sync:false })
} else {
  setWhoActiveTeam(null)
}

  const scoreABox = document.getElementById("whoScoreA")
  const scoreBBox = document.getElementById("whoScoreB")

  if (scoreABox) scoreABox.innerText = whoState.scoreA
  if (scoreBBox) scoreBBox.innerText = whoState.scoreB

  highlightWhoPoints()
  highlightWhoTurnTeam()
  updateWhoTurnBox()
  updateWhoDoubleButton()

  const grid = document.querySelector(".whoGrid")
  if (grid) {
    grid.innerHTML = createWhoGrid()
  }

  updateWhoCompensationButton()

  if (currentWhoImage) {
    showWhoImageFullscreen(currentWhoImage)
  }

  const timerValue = Number(saved.timerValue || 0)

  if (whoTimerStarted && timerValue > 0) {
    resumeWhoTimer(timerValue)
  }
}

/* =========================
   Render
========================= */

window.renderWho = function () {
    whoMaxNumber = Number(
    window.whoMaxNumber ||
    localStorage.getItem("who_max_number") ||
    15
  )

  whoMaxNumber = Math.min(Math.max(whoMaxNumber, 10), 15)
  const saved = getWhoState()

  whoState = {
    usedNumbers: [],
    scoreA: 0,
    scoreB: 0,
    currentPoints: 0,
    activeTeam: null,
    manualStartDone: false,
    lastAnsweredTeam: null
  }

  whoDoubleState = {
    used: { A: false, B: false },
    activeTeam: null
  }

  window.whoState = whoState
  window.currentSegmentScores = { A: 0, B: 0 }

  currentWhoAnswer = null
  currentWhoImage = null
  selectedTeam = null
  whoQuestionLocked = false
  whoCurrentNumber = null
  whoLastTickPlayed = null
  whoTimerStarted = false
  whoCompensationMode = false

openSegment("من هو", `
  <div class="whoWrap" data-segment-key="who">

    <header class="whoHeader">

      <button class="whoDockBtn" type="button" onclick="goHome()">
        رجوع
      </button>

      <div
        class="whoTeamMini teamA"
        onclick="selectWhoTeam('A')"
        id="whoTeamABox"
      >
        <div class="whoTeamName">
          <strong>${escapeDisplayHtml(teamAName || "الفريق الأول")}</strong>
        </div>

        <b id="whoScoreA">${whoState.scoreA}</b>
      </div>

      <div class="whoTitle">
  <h1>من هو</h1>
  <span id="timer" class="whoTimerHidden">0</span>
</div>

      <div
        class="whoTeamMini teamB"
        onclick="selectWhoTeam('B')"
        id="whoTeamBBox"
      >
        <b id="whoScoreB">${whoState.scoreB}</b>

        <div class="whoTeamName">
          <strong>${escapeDisplayHtml(teamBName || "الفريق الثاني")}</strong>
        </div>
      </div>

      <button
        id="endRoundBtn"
        class="whoDockBtn"
        type="button"
        onclick="endCurrentSegment()"
        disabled
      >
        إنهاء
      </button>

    </header>

    <section class="whoPointsCard">

      <div class="whoTurnSide" id="whoTurnInline">
        الدور: ${getWhoTurnName()}
      </div>

      <div class="whoPointsSide">
        <span class="whoPointsLabel">اختر النقاط</span>

        <button onclick="setWhoPoints(1)" class="whoPointBtn" id="whoPoint1">1</button>
        <button onclick="setWhoPoints(2)" class="whoPointBtn" id="whoPoint2">2</button>
        <button onclick="setWhoPoints(3)" class="whoPointBtn" id="whoPoint3">3</button>
        <button onclick="setWhoPoints(4)" class="whoPointBtn" id="whoPoint4">4</button>
        <button onclick="setWhoPoints(5)" class="whoPointBtn" id="whoPoint5">5</button>
      </div>

    </section>

    <section id="whoImageStage" class="whoImageStage whoImageStageEmpty"></section>

    <section class="whoGrid">
      ${createWhoGrid()}
    </section>

    <footer class="whoActionBar">

      <button
        onclick="activateWhoDouble()"
        class="whoActionBtn whoDoubleBtn"
        id="whoDoubleBtn"
      >
        دبل
      </button>

      <button
        onclick="startWhoCompensation()"
        class="whoActionBtn whoCompensationBtn"
        id="whoCompensationBtn"
        disabled
      >
        التعويض
      </button>

      <button onclick="whoCorrect()" class="whoActionBtn btnCorrect">
        صح
      </button>

      <button onclick="whoWrong()" class="whoActionBtn btnWrong">
        خطأ
      </button>

    </footer>

  </div>
`)

  if (saved) {
    restoreWhoState(saved)
  } else {
    saveWhoState()
  }
  if (whoState.activeTeam) {
  setWhoActiveTeam(whoState.activeTeam, { sync:false })
}

  updateWhoDoubleButton()
updateWhoCompensationButton()
}

/* =========================
   Double
========================= */

function activateWhoDouble() {
  const team = whoState.activeTeam

  if (!team) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  if (whoQuestionLocked || whoCurrentNumber) {
    showGameToast("الدبويلا قبل اختيار السؤال فقط")
    return
  }

  if (whoDoubleState.used[team]) {
    showGameToast("هذا الفريق استخدم الدوبيلا مسبقًا")
    return
  }

  if (whoDoubleState.used.A && whoDoubleState.used.B) {
    showGameToast("تم استخدام الدوبيلا من الفريقين")
    return
  }

  whoDoubleState.used[team] = true
  whoDoubleState.activeTeam = team

  showGameToast(`تم تفعيل الدوبيلا  لفريق ${team === "A" ? teamAName : teamBName}`)

  updateWhoDoubleButton()
  saveWhoState()
}

function getWhoScoreValue(team) {
  const base = Number(whoState.currentPoints || 0)
  return whoDoubleState.activeTeam === team ? base * 2 : base
}

function clearWhoActiveDouble() {
  whoDoubleState.activeTeam = null
}

function updateWhoDoubleButton() {
  const btn = document.getElementById("whoDoubleBtn")
  if (!btn) return

  const team = whoState.activeTeam

  btn.classList.remove("activeDouble")

  if (whoQuestionLocked || whoCurrentNumber) {
    btn.disabled = true
    btn.innerText = "دبل"
    return
  }

  if (!team) {
    btn.disabled = whoDoubleState.used.A && whoDoubleState.used.B
    btn.innerText = "دوبيلا"
    return
  }

  if (whoDoubleState.activeTeam === team) {
    btn.disabled = true
    btn.innerText = "الدوبيلا مفعّل"
    btn.classList.add("activeDouble")
    return
  }

  if (whoDoubleState.used[team]) {
    btn.disabled = true
    btn.innerText = " الدوبيلا"
    return
  }

  if (whoDoubleState.used.A && whoDoubleState.used.B) {
    btn.disabled = true
    btn.innerText = "الدوبيلا مقفل"
    return
  }

  btn.disabled = false
  btn.innerText = "دوبيلا"
}

/* =========================
   Grid / Points
========================= */

function createWhoGrid() {
  let html = ""

  const maxNumber = Number(whoMaxNumber || window.whoMaxNumber || 15)
  const used = (whoState.usedNumbers || []).map(Number)

  const lock15 =
    maxNumber === 15 &&
    !used.includes(15) &&
    used.length < 14

  const waitCompensation =
    maxNumber === 15 &&
    !used.includes(15) &&
    used.length === 14 &&
    !whoCompensationMode

  for (let i = 1; i <= maxNumber; i++) {
    const isUsed = used.includes(i)
    const isLocked15 = i === 15 && (lock15 || waitCompensation)

    html += `
      <button
        onclick="${isLocked15 ? "" : `chooseWho(${i})`}"
        class="whoBtn ${isUsed ? "used" : ""} ${isLocked15 ? "whoBtnLocked15" : ""}"
        ${(isUsed || isLocked15) ? "disabled" : ""}
      >
        ${isUsed ? "" : i}
      </button>
    `
  }

  return html
}

function setWhoPoints(p) {
  if (whoCompensationMode) {
    showGameToast("في التعويض النقاط ثابتة 5")
    return
  }

  if (whoQuestionLocked) {
    showGameToast("لا يمكن تغيير النقاط بعد اختيار السؤال")
    return
  }

  whoState.currentPoints = p
  highlightWhoPoints()
  saveWhoState()
}

function highlightWhoPoints() {
  for (let i = 1; i <= 5; i++) {
    const btn = document.getElementById(`whoPoint${i}`)
    if (!btn) continue

    btn.classList.remove("selectedWhoPoint")

    if (whoState.currentPoints === i) {
      btn.classList.add("selectedWhoPoint")
    }
  }
}

function resetWhoPoints() {
  whoState.currentPoints = 0
  highlightWhoPoints()
}

function getWhoOtherTeam(team) {
  return team === "A" ? "B" : "A"
}

function getWhoTurnName() {
  if (whoState.activeTeam === "A") return teamAName
  if (whoState.activeTeam === "B") return teamBName
  return "اختر فريق"
}

function setWhoActiveTeam(team, options = {}) {
  if (team !== "A" && team !== "B") {
    whoState.activeTeam = null
    selectedTeam = null

    if (typeof clearGameActiveTeam === "function") {
      clearGameActiveTeam()
    } else {
      delete document.body.dataset.activeTeam
    }

    highlightWhoTurnTeam()
    updateWhoTurnBox()
    updateWhoDoubleButton()
    return
  }

  whoState.activeTeam = team
  selectedTeam = team

  if (typeof setGameActiveTeam === "function") {
    setGameActiveTeam(team, options)
  } else {
    document.body.dataset.activeTeam = team
  }

  highlightWhoTurnTeam()
  updateWhoTurnBox()
  updateWhoDoubleButton()
}

function updateWhoTurnBox() {
  const inline = document.getElementById("whoTurnInline")
  if (inline) {
    inline.innerText = "الدور: " + getWhoTurnName()
  }

  updateWhoDoubleButton()
}

function selectWhoTeam(team) {
  if (team !== "A" && team !== "B") return

  if (whoCompensationMode && whoQuestionLocked) {
    setWhoActiveTeam(team)
    saveWhoState()

    setTimeout(() => {
      highlightWhoTurnTeam()
    }, 80)

    return
  }

  /*
    مهم:
    لو الفقرة بدأت قبل كذا لكن ما فيه فريق نشط،
    نسمح بالاختيار عشان ما يعلق بدون تحديد.
  */
  if (whoState.manualStartDone && whoState.activeTeam) {
    showGameToast("بعد البداية الأولى ينتقل الدور تلقائيًا")
    return
  }

  whoState.manualStartDone = true
  setWhoActiveTeam(team)
  saveWhoState()

  setTimeout(() => {
    highlightWhoTurnTeam()
  }, 80)
}

function getWhoTeamBox(team) {
  const letter = team === "A" ? "A" : "B"

  return (
    document.getElementById(`whoTeam${letter}Box`) ||
    document.getElementById(`whoTeam${letter}`) ||
    document.getElementById(`whoScore${letter}Box`) ||
    document.getElementById(`whoScorePanel${letter}`) ||
    document.querySelector(`[onclick="selectWhoTeam('${letter}')"]`) ||
    document.querySelector(`[onclick='selectWhoTeam("${letter}")']`) ||
    document.querySelector(`[data-team="${letter}"]`) ||
    document.querySelector(`.whoTeamBox.team${letter}`) ||
    document.querySelector(`.whoTeamCard.team${letter}`) ||
    document.querySelector(`.whoScorePanel.team${letter}`)
  )
}

function highlightWhoTurnTeam() {
  const team = whoState.activeTeam || selectedTeam || null

  const a = document.getElementById("whoTeamABox")
  const b = document.getElementById("whoTeamBBox")

  if (team === "A" || team === "B") {
    document.body.setAttribute("data-active-team", team)
  } else {
    document.body.removeAttribute("data-active-team")
  }

  if (a) {
    a.classList.remove(
      "activeTeam",
      "selectedPresenterTeam",
      "finalTurnActiveTeam",
      "whoTeamCurrent"
    )
  }

  if (b) {
    b.classList.remove(
      "activeTeam",
      "selectedPresenterTeam",
      "finalTurnActiveTeam",
      "whoTeamCurrent"
    )
  }

  if (team === "A" && a) {
    a.classList.add("whoTeamCurrent")
    a.setAttribute("data-current-team", "true")
  } else if (a) {
    a.removeAttribute("data-current-team")
  }

  if (team === "B" && b) {
    b.classList.add("whoTeamCurrent")
    b.setAttribute("data-current-team", "true")
  } else if (b) {
    b.removeAttribute("data-current-team")
  }

  console.log("WHO ACTIVE TEAM:", {
    team,
    bodyTeam: document.body.getAttribute("data-active-team"),
    aClass: a ? a.className : null,
    bClass: b ? b.className : null
  })
}

function switchWhoTurn() {
  if (!whoState.activeTeam) return

  whoState.lastAnsweredTeam = whoState.activeTeam
setWhoActiveTeam(getWhoOtherTeam(whoState.activeTeam))
}


function canUseWhoCompensation() {
  const maxNumber = Number(whoMaxNumber || window.whoMaxNumber || 15)

  if (maxNumber !== 15) return false

  const used = (whoState.usedNumbers || []).map(Number)
  const remaining = []

  for (let i = 1; i <= maxNumber; i++) {
    if (!used.includes(i)) remaining.push(i)
  }

  return (
    !whoQuestionLocked &&
    !whoCurrentNumber &&
    remaining.length === 1 &&
    remaining[0] === 15
  )
}

function updateWhoCompensationButton() {
  const btn = document.getElementById("whoCompensationBtn")
  if (!btn) return

  const active = canUseWhoCompensation()

  btn.disabled = !active
  btn.classList.toggle("activeCompensation", active)
}

async function startWhoCompensation() {
  if (!canUseWhoCompensation()) {
    showGameToast("التعويض يتفعل فقط إذا بقي الرقم 15")
    return
  }

  whoCompensationMode = true
  whoState.currentPoints = 5

  setWhoActiveTeam(null)

highlightWhoPoints()

  const grid = document.querySelector(".whoGrid")
  if (grid) {
    grid.innerHTML = createWhoGrid()
  }

  updateWhoCompensationButton()
  saveWhoState()

  showGameToast("تم تفعيل التعويض، افتح رقم 15")
}
/* =========================
   Question
========================= */

async function chooseWho(num) {
  if (whoQuestionLocked) {
    showGameToast("سجل النتيجة أولاً")
    return
  }

  if (!whoState.activeTeam && !whoCompensationMode) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  if (whoState.currentPoints === 0 && !whoCompensationMode) {
    showGameToast("اختر النقاط أولاً")
    return
  }

  if (whoState.usedNumbers.includes(num)) return

  whoState.usedNumbers.push(num)
  window.whoState = whoState

  whoQuestionLocked = true
  whoCurrentNumber = num

  updateWhoDoubleButton()

  const grid = document.querySelector(".whoGrid")
  if (grid) {
    grid.innerHTML = createWhoGrid()
  }

  const { data, error } = await db
  .from("who_images")
  .select("*")
  .eq("model", Number(currentModel))
  .eq("number", Number(num))
  .maybeSingle()

  if (error || !data) {
    console.log(error)

    showGameToast("تعذر تحميل الصورة")

    whoState.usedNumbers = whoState.usedNumbers.filter(n => Number(n) !== Number(num))
    window.whoState = whoState

    whoQuestionLocked = false
    whoCurrentNumber = null
    currentWhoAnswer = null
    currentWhoImage = null

    if (grid) {
      grid.innerHTML = createWhoGrid()
    }

    updateWhoDoubleButton()
    updateWhoCompensationButton()
    saveWhoState()
    return
  }

  currentWhoAnswer = data.answer || ""
  currentWhoImage = data.image || ""

  showWhoImageFullscreen(currentWhoImage)
  openWhoImageOverlay()
  startWhoTimer()

  updateWhoCompensationButton()
  saveWhoState()
}

function showWhoImageFullscreen(imageUrl) {
  const stage = document.getElementById("whoImageStage")
  if (!stage || !imageUrl) return

  stage.innerHTML = `
    <div class="whoImageFrame" onclick="toggleWhoImageOverlay()">
      <img src="${escapeDisplayHtml(imageUrl)}" class="whoImageFull" alt="">
    </div>
  `

  stage.classList.remove("whoImageStageEmpty")

  if (typeof protectDisplayMedia === "function") {
    protectDisplayMedia(stage)
  }

  if (typeof applyDisplayMediaRevealFx === "function") {
    applyDisplayMediaRevealFx(stage)
  }
}

function hideWhoImage() {
  const stage = document.getElementById("whoImageStage")
  if (!stage) return

  stage.innerHTML = ""
  stage.classList.add("whoImageStageEmpty")
}

function showWhoAnswer(resultType = "") {
  if (!whoQuestionLocked || !currentWhoAnswer) {
    showGameToast("اختر سؤالاً أولاً")
    return
  }

  const oldOverlay = document.getElementById("whoImageOverlay")
  if (oldOverlay) oldOverlay.remove()

  document.body.classList.remove("whoOverlayActive")

  const stage = document.getElementById("whoImageStage")
  if (!stage) return

  const resultClass =
    resultType === "correct"
      ? "correctResult"
      : resultType === "wrong"
      ? "wrongResult"
      : ""

  const resultLabel =
    resultType === "correct"
      ? "إجابة صحيحة"
      : resultType === "wrong"
      ? "إجابة خاطئة"
      : "الإجابة"

  stage.innerHTML = `
    <div class="whoResultView ${resultClass}">

      <div class="whoResultImageBox" onclick="toggleWhoImageOverlay()">
        <img src="${currentWhoImage || ""}" class="whoResultImage" alt="">
      </div>

      <div class="whoResultAnswerBox">
        <div class="whoResultAnswerLabel">${escapeDisplayHtml(resultLabel)}</div>
        <div class="whoResultAnswerText">${escapeDisplayHtml(currentWhoAnswer)}</div>
      </div>

    </div>
  `

  stage.classList.remove("whoImageStageEmpty")

  if (typeof protectDisplayMedia === "function") {
    protectDisplayMedia(stage)
  }

  if (typeof applyDisplayMediaRevealFx === "function") {
    applyDisplayMediaRevealFx(stage)
  }

  saveWhoState()
}

function clearWhoStage() {
  const stage = document.getElementById("whoImageStage")
  if (!stage) return

  const oldOverlay = document.getElementById("whoImageOverlay")
  if (oldOverlay) oldOverlay.remove()

  document.body.classList.remove("whoOverlayActive")

  stage.innerHTML = ""
  stage.classList.add("whoImageStageEmpty")

  currentWhoAnswer = null
  currentWhoImage = null
}

/* =========================
   Timer
========================= */

function startWhoTimer() {
  runWhoTimer(30)
}

function resumeWhoTimer(time) {
  runWhoTimer(time)
}

function runWhoTimer(startValue) {
  const timerBox = document.getElementById("timer")
  if (!timerBox) return

  clearInterval(timer)
  timer = null
  whoTimerStarted = true
  whoLastTickPlayed = null

  let time = Number(startValue || 0)

  timerBox.innerText = time

  let overlayTimer = document.getElementById("whoOverlayTimer")
  if (overlayTimer) {
    overlayTimer.innerText = time
    overlayTimer.classList.toggle("timerDanger", time > 0 && time <= 5)
  }

  const timerPill = timerBox.closest(".whoTimerPill")
  if (timerPill) {
    timerPill.classList.toggle("timerDanger", time > 0 && time <= 5)
  }

  saveWhoState()

  timer = setInterval(() => {
    time--

    timerBox.innerText = time

    overlayTimer = document.getElementById("whoOverlayTimer")
    if (overlayTimer) {
      overlayTimer.innerText = time
      overlayTimer.classList.toggle("timerDanger", time > 0 && time <= 5)
    }

    const currentTimerPill = timerBox.closest(".whoTimerPill")
    if (currentTimerPill) {
      currentTimerPill.classList.toggle("timerDanger", time > 0 && time <= 5)
    }

    if (time > 0 && time <= 5 && whoLastTickPlayed !== time) {
      whoLastTickPlayed = time
      playGameSound("tick")
    }

    saveWhoState()

    if (time <= 0) {
      clearInterval(timer)
      timer = null

      timerBox.innerText = 0

      overlayTimer = document.getElementById("whoOverlayTimer")
      if (overlayTimer) {
        overlayTimer.innerText = 0
        overlayTimer.classList.remove("timerDanger")
      }

      const lastTimerPill = timerBox.closest(".whoTimerPill")
      if (lastTimerPill) {
        lastTimerPill.classList.remove("timerDanger")
      }

      whoTimerStarted = false
      whoLastTickPlayed = null

      playGameSound("timeout")
      saveWhoState()
    }
  }, 1000)
}

function resetWhoTimer() {
  clearInterval(timer)
  timer = null
  whoTimerStarted = false
  whoLastTickPlayed = null

  const timerBox = document.getElementById("timer")
  if (timerBox) timerBox.innerText = 0

  saveWhoState()
}
/* =========================
   Score Buttons Guard
   حماية أزرار التسجيل من التكرار
========================= */

function setWhoScoreButtonsLocked(isLocked) {
  whoScoringLocked = !!isLocked

  const buttons = [
    document.querySelector(".btnCorrect"),
    document.querySelector(".btnWrong")
  ]

  buttons.forEach(btn => {
    if (!btn) return

    btn.disabled = whoScoringLocked
    btn.classList.toggle("whoScoreBtnLocked", whoScoringLocked)
  })
}

function canScoreWhoNow() {
  if (whoScoringLocked) {
    return false
  }

  whoScoringLocked = true
  setWhoScoreButtonsLocked(true)

  return true
}

/* =========================
   Result
========================= */

function finishWhoAfterAnswerDelay() {
  resetWhoTimer()

  setTimeout(() => {
    clearWhoStage()
    switchWhoTurn()
    resetWhoPoints()

    whoQuestionLocked = false
    whoCurrentNumber = null
    whoScoringLocked = false

    setWhoScoreButtonsLocked(false)
    updateWhoDoubleButton()
    updateWhoCompensationButton()
    saveWhoState()
  }, 10000)
}

function whoCorrect() {
  if (!canScoreWhoNow()) return

  if (!whoQuestionLocked) {
    setWhoScoreButtonsLocked(false)
    showGameToast("اختر رقمًا أولاً")
    return
  }

  if (whoCompensationMode && !whoState.activeTeam) {
    setWhoScoreButtonsLocked(false)
    showGameToast("اختر الفريق الذي يأخذ التعويض ثم اضغط صح")
    return
  }

  if (!whoState.activeTeam) {
    setWhoScoreButtonsLocked(false)
    showGameToast("اختر الفريق أولاً")
    return
  }

  const team = whoState.activeTeam
  const points = whoCompensationMode ? 5 : getWhoScoreValue(team)

  if (team === "A") {
    whoState.scoreA += points
    document.getElementById("whoScoreA").innerText = whoState.scoreA
  } else {
    whoState.scoreB += points
    document.getElementById("whoScoreB").innerText = whoState.scoreB
  }

  clearWhoActiveDouble()

  playGameSound("correct")
  flashScreen("correct")
  showWhoAnswer("correct")

  window.whoState = whoState
  window.currentSegmentScores = {
    A: whoState.scoreA,
    B: whoState.scoreB
  }

  whoCompensationMode = false
  updateWhoCompensationButton()

  saveWhoState()
  finishWhoAfterAnswerDelay()
}

function whoWrong() {
  if (!canScoreWhoNow()) return

  if (!whoState.activeTeam) {
    setWhoScoreButtonsLocked(false)
    showGameToast("اختر الفريق أولاً")
    return
  }

  if (!whoQuestionLocked) {
    setWhoScoreButtonsLocked(false)
    showGameToast("اختر رقمًا أولاً")
    return
  }

  if (whoState.currentPoints === 0 && !whoCompensationMode) {
    setWhoScoreButtonsLocked(false)
    showGameToast("اختر النقاط أولاً")
    return
  }

  const team = whoState.activeTeam
  const points = whoCompensationMode ? 5 : getWhoScoreValue(team)

  if (team === "A") {
    whoState.scoreA -= points
    document.getElementById("whoScoreA").innerText = whoState.scoreA
  } else {
    whoState.scoreB -= points
    document.getElementById("whoScoreB").innerText = whoState.scoreB
  }

  clearWhoActiveDouble()

  playGameSound("wrong")
  flashWhoZoomOverlayWrong()
  flashScreen("wrong")
  showWhoAnswer("wrong")

  window.whoState = whoState
  window.currentSegmentScores = {
    A: whoState.scoreA,
    B: whoState.scoreB
  }

  whoCompensationMode = false
  updateWhoCompensationButton()

  saveWhoState()
  finishWhoAfterAnswerDelay()
}

function flashWhoZoomOverlayWrong() {
  const whoOverlay = document.getElementById("whoImageOverlay")

  const whoVisible = whoOverlay && !whoOverlay.classList.contains("hidden")

  if (!whoVisible) {
    return false
  }

  let flashLayer = document.getElementById("whoZoomFlashLayer")

  if (!flashLayer) {
    flashLayer = document.createElement("div")
    flashLayer.id = "whoZoomFlashLayer"
    flashLayer.className = "whoZoomFlashLayer"
    document.body.appendChild(flashLayer)
  }

  flashLayer.classList.remove("whoZoomFlashRun")
  void flashLayer.offsetWidth
  flashLayer.classList.add("whoZoomFlashRun")

  const img = whoOverlay.querySelector("img")

  if (img) {
    img.classList.remove("whoZoomImageShake")
    void img.offsetWidth
    img.classList.add("whoZoomImageShake")
  }

  setTimeout(() => {
    flashLayer.classList.remove("whoZoomFlashRun")
  }, 800)

  return true
}

/* =========================
   Image Overlay
========================= */

function openWhoImageOverlay() {
  const oldOverlay = document.getElementById("whoImageOverlay")
  if (oldOverlay) oldOverlay.remove()

  if (!currentWhoImage) return

  document.body.classList.add("whoOverlayActive")

  const timerBox = document.getElementById("timer")
  const time = timerBox ? Number(timerBox.innerText || 0) : 0
const dangerClass = time > 0 && time <= 5 ? "timerDanger" : ""

  const overlay = document.createElement("div")
  overlay.id = "whoImageOverlay"
  overlay.className = "whoImageOverlay"
  overlay.innerHTML = `
    <div class="whoImageOverlayTimer ${dangerClass}" id="whoOverlayTimer">${time}</div>

    <div class="whoImageOverlayInner">
      <img src="${escapeDisplayHtml(currentWhoImage)}" class="whoImageOverlayImg" alt="">
    </div>
  `

  overlay.onclick = function () {
    overlay.remove()
    document.body.classList.remove("whoOverlayActive")
  }

  document.body.appendChild(overlay)
}

function toggleWhoImageOverlay() {
  const oldOverlay = document.getElementById("whoImageOverlay")

  if (oldOverlay) {
    oldOverlay.remove()
    document.body.classList.remove("whoOverlayActive")
    return
  }

  openWhoImageOverlay()
}