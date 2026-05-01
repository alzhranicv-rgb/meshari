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

function saveWhoState() {
  const timerBox = document.getElementById("timer")

  const state = {
    whoState,
    whoDoubleState,
    currentWhoAnswer,
    currentWhoImage,
    whoQuestionLocked,
    whoCurrentNumber,
    whoTimerStarted,
    timerValue: timerBox ? Number(timerBox.innerText || 0) : 0
  }

  localStorage.setItem(WHO_STORAGE_KEY, JSON.stringify(state))
  localStorage.setItem("active_segment", "who")
}

function clearWhoState() {
  localStorage.removeItem(WHO_STORAGE_KEY)
  localStorage.removeItem("active_segment")
}

function restoreWhoState(saved) {
  if (!saved) return

  whoState = saved.whoState || whoState
  whoDoubleState = saved.whoDoubleState || {
    used: { A: false, B: false },
    activeTeam: null
  }

  window.whoState = whoState

  currentWhoAnswer = saved.currentWhoAnswer || null
  currentWhoImage = saved.currentWhoImage || null
  whoQuestionLocked = !!saved.whoQuestionLocked
  whoCurrentNumber = saved.whoCurrentNumber || null
  whoTimerStarted = !!saved.whoTimerStarted
  whoLastTickPlayed = null

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

  if (currentWhoImage) {
    showWhoImageFullscreen(currentWhoImage)
  }

  window.currentSegmentScores = {
    A: whoState.scoreA,
    B: whoState.scoreB
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

  openSegment("من هو", `
    <div class="whoWrap">

      <div class="whoTopBar">

        <div class="whoTeamCard" onclick="selectWhoTeam('A')" id="whoTeamABox">
          <div class="whoTeamName">${teamAName}</div>
          <div class="whoTeamScore" id="whoScoreA">${whoState.scoreA}</div>
        </div>

        <div class="whoTimerBox">
          <div class="whoTimerLabel">المؤقت</div>
          <div class="whoTimerValue" id="timer">0</div>
        </div>

        <div class="whoTeamCard" onclick="selectWhoTeam('B')" id="whoTeamBBox">
          <div class="whoTeamName">${teamBName}</div>
          <div class="whoTeamScore" id="whoScoreB">${whoState.scoreB}</div>
        </div>

      </div>

      <div id="whoImageStage" class="whoImageStage hidden"></div>

      <div class="whoBottomRow">

        <div class="whoPointsSelect">
          <span class="whoPointsLabel" id="whoTurnInline">الدور: ${getWhoTurnName()}</span>
          <span class="whoPointsLabel">اختر النقاط:</span>
          <button onclick="setWhoPoints(1)" class="whoPointBtn" id="whoPoint1">1</button>
          <button onclick="setWhoPoints(2)" class="whoPointBtn" id="whoPoint2">2</button>
          <button onclick="setWhoPoints(3)" class="whoPointBtn" id="whoPoint3">3</button>
          <button onclick="setWhoPoints(4)" class="whoPointBtn" id="whoPoint4">4</button>
          <button onclick="setWhoPoints(5)" class="whoPointBtn" id="whoPoint5">5</button>
        </div>

        <div class="whoControlPanel">
          <button onclick="activateWhoDouble()" class="whoDoubleBtn" id="whoDoubleBtn">دبل</button>
          
          <button onclick="whoCorrect()" class="btnCorrect">✓ صح</button>
          <button onclick="whoWrong()" class="btnWrong">✕ خطأ</button>
        </div>

      </div>

      <div class="whoGrid">
        ${createWhoGrid()}
      </div>

    </div>
  `)

  if (saved) {
    restoreWhoState(saved)
  } else {
    saveWhoState()
  }

  updateWhoDoubleButton()
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

  for (let i = 1; i <= 15; i++) {
    if (!whoState.usedNumbers.includes(i)) {
      html += `<button onclick="chooseWho(${i})" class="whoBtn">${i}</button>`
    } else {
      html += `<button class="whoBtn used"></button>`
    }
  }

  return html
}

function setWhoPoints(p) {
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

function updateWhoTurnBox() {
  const inline = document.getElementById("whoTurnInline")
  if (inline) {
    inline.innerText = "الدور: " + getWhoTurnName()
  }

  updateWhoDoubleButton()
}

function selectWhoTeam(team) {
  if (whoState.manualStartDone) {
    showGameToast("بعد البداية الأولى ينتقل الدور تلقائيًا")
    return
  }

  whoState.activeTeam = team
  whoState.manualStartDone = true
  selectedTeam = team

  highlightWhoTurnTeam()
  updateWhoTurnBox()
  updateWhoDoubleButton()
  saveWhoState()
}

function highlightWhoTurnTeam() {
  const a = document.getElementById("whoTeamABox")
  const b = document.getElementById("whoTeamBBox")

  if (!a || !b) return

  a.classList.remove("activeTeam")
  b.classList.remove("activeTeam")

  if (whoState.activeTeam === "A") a.classList.add("activeTeam")
  if (whoState.activeTeam === "B") b.classList.add("activeTeam")

  updateWhoDoubleButton()
}

function switchWhoTurn() {
  if (!whoState.activeTeam) return

  whoState.lastAnsweredTeam = whoState.activeTeam
  whoState.activeTeam = getWhoOtherTeam(whoState.activeTeam)
  selectedTeam = whoState.activeTeam

  highlightWhoTurnTeam()
  updateWhoTurnBox()
  updateWhoDoubleButton()
}

/* =========================
   Question
========================= */

async function chooseWho(num) {
  if (whoQuestionLocked) {
    showGameToast("سجل النتيجة أولاً")
    return
  }

  if (!whoState.activeTeam) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  if (whoState.currentPoints === 0) {
    showGameToast("اختر النقاط أولاً")
    return
  }

  if (whoState.usedNumbers.includes(num)) return

  whoState.usedNumbers.push(num)
  window.whoState = whoState
  whoQuestionLocked = true
  whoCurrentNumber = num

  updateWhoDoubleButton()

  const { data, error } = await db
    .from("who_images")
    .select("*")
    .eq("model", currentModel)
    .eq("number", num)
    .single()

  if (error) {
    console.log(error)
    showGameToast("تعذر تحميل الصورة")
    whoQuestionLocked = false
    whoCurrentNumber = null
    updateWhoDoubleButton()
    return
  }

  if (data) {
    currentWhoAnswer = data.answer || ""
    currentWhoImage = data.image || ""

    showWhoImageFullscreen(currentWhoImage)
    startWhoTimer()
  }

  const grid = document.querySelector(".whoGrid")
  if (grid) {
    grid.innerHTML = createWhoGrid()
  }

  saveWhoState()
}

function showWhoImageFullscreen(imageUrl) {
  const stage = document.getElementById("whoImageStage")
  if (!stage || !imageUrl) return

  stage.innerHTML = `
    <div class="whoImageFrame" onclick="toggleWhoImageOverlay()">
      <img src="${imageUrl}" class="whoImageFull" alt="">
    </div>
  `
  stage.classList.remove("hidden")
}

function hideWhoImage() {
  const stage = document.getElementById("whoImageStage")
  if (!stage) return

  stage.innerHTML = ""
  stage.classList.add("hidden")
}

function showWhoAnswer() {
  if (!whoQuestionLocked || !currentWhoAnswer) {
    showGameToast("اختر سؤالاً أولاً")
    return
  }

  const stage = document.getElementById("whoImageStage")
  if (!stage) return

  stage.innerHTML = `<div class="whoAnswer">${currentWhoAnswer}</div>`
  stage.classList.remove("hidden")
  saveWhoState()
}

function clearWhoStage() {
  const stage = document.getElementById("whoImageStage")
  if (!stage) return

  stage.innerHTML = ""
  stage.classList.add("hidden")

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
  saveWhoState()

  timer = setInterval(() => {
    time--
    timerBox.innerText = time

    if (time > 0 && time <= 5 && whoLastTickPlayed !== time) {
      whoLastTickPlayed = time
      playGameSound("tick")
    }

    saveWhoState()

    if (time <= 0) {
      clearInterval(timer)
      timer = null
      timerBox.innerText = 0
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

    updateWhoDoubleButton()
    saveWhoState()
  }, 5000)
}

function whoCorrect() {
  if (!whoState.activeTeam) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  if (!whoQuestionLocked) {
    showGameToast("اختر رقمًا أولاً")
    return
  }

  if (whoState.currentPoints === 0) {
    showGameToast("اختر النقاط أولاً")
    return
  }

  const team = whoState.activeTeam
  const points = getWhoScoreValue(team)

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
  showWhoAnswer()

  window.whoState = whoState
  window.currentSegmentScores = {
    A: whoState.scoreA,
    B: whoState.scoreB
  }

  saveWhoState()
  finishWhoAfterAnswerDelay()
}

function whoWrong() {
  if (!whoState.activeTeam) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  if (!whoQuestionLocked) {
    showGameToast("اختر رقمًا أولاً")
    return
  }

  if (whoState.currentPoints === 0) {
    showGameToast("اختر النقاط أولاً")
    return
  }

  const team = whoState.activeTeam
  const points = getWhoScoreValue(team)

  if (team === "A") {
    whoState.scoreA -= points
    document.getElementById("whoScoreA").innerText = whoState.scoreA
  } else {
    whoState.scoreB -= points
    document.getElementById("whoScoreB").innerText = whoState.scoreB
  }

  clearWhoActiveDouble()

  playGameSound("wrong")
  flashScreen("wrong")
  showWhoAnswer()

  window.whoState = whoState
  window.currentSegmentScores = {
    A: whoState.scoreA,
    B: whoState.scoreB
  }

  saveWhoState()
  finishWhoAfterAnswerDelay()
}

/* =========================
   Image Overlay
========================= */

function toggleWhoImageOverlay() {
  const oldOverlay = document.getElementById("whoImageOverlay")

  if (oldOverlay) {
    oldOverlay.remove()
    return
  }

  if (!currentWhoImage) return

  const overlay = document.createElement("div")
  overlay.id = "whoImageOverlay"
  overlay.className = "whoImageOverlay"
  overlay.innerHTML = `
    <div class="whoImageOverlayInner">
      <img src="${currentWhoImage}" class="whoImageOverlayImg" alt="">
    </div>
  `

  overlay.onclick = function () {
    overlay.remove()
  }

  document.body.appendChild(overlay)
}