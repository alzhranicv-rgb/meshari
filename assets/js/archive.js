let archiveRevealState = {
  1: {},
  2: {},
  3: {},
  4: {}
}

let archiveRemainingPoints = 0
let archiveLastTeam = null
let archiveTimer = null
let archiveTurnLocked = false
let archiveTimerStarted = false
let archiveLastTickPlayed = null

let archiveState = {
  round: 1,
  scores: { A: 0, B: 0 },
  activeTeam: null,
  errors: {
    1: { A: 0, B: 0 },
    2: { A: 0, B: 0 },
    3: { A: 0, B: 0 },
    4: { A: 0, B: 0 }
  }
}

window.archiveState = archiveState

let archiveRoundCache = {
  1: { box: null, items: [] },
  2: { box: null, items: [] },
  3: { box: null, items: [] },
  4: { box: null, items: [] }
}

window.archiveRevealState = archiveRevealState
window.archiveRoundCache = archiveRoundCache

const ARCHIVE_STORAGE_KEY = "archive_state_v1"

let archiveHistory = []
const ARCHIVE_HISTORY_LIMIT = 80

/* =========================
   Helpers
========================= */

function getArchiveRoundReveal(round) {
  if (!archiveRevealState[round]) archiveRevealState[round] = {}
  return archiveRevealState[round]
}

function isArchiveItemRevealed(round, position) {
  return !!getArchiveRoundReveal(round)[position]
}

function setArchiveItemRevealed(round, position, value = true) {
  getArchiveRoundReveal(round)[position] = value
}

function revealAllArchiveRoundItems(round) {
  const items = archiveRoundCache[round]?.items || []
  items.forEach(item => {
    setArchiveItemRevealed(round, item.position, true)
  })
}

function isArchiveRoundFinished(round) {
  const items = archiveRoundCache[round]?.items || []
  if (!items.length) return false
  return items.every(item => isArchiveItemRevealed(round, item.position))
}

function syncArchiveGlobals() {
  window.archiveState = archiveState
  window.archiveRevealState = archiveRevealState
  window.archiveRoundCache = archiveRoundCache
  window.currentSegmentScores = {
    A: archiveState.scores.A,
    B: archiveState.scores.B
  }
}

function getArchiveItemParentPosition(item) {
  return Number(item.parent_position || item.column_group || 3)
}

function getArchiveRequiredPosition(round) {
  const items = archiveRoundCache[round]?.items || []

  const requiredItem = items.find(item => {
    return String(item.label || "").trim() === "المطلوب"
  })

  return requiredItem ? Number(requiredItem.position) : ""
}

function updateArchiveRequestedInput() {
  const requestedInput = document.getElementById("archiveManualInput1")
  if (!requestedInput) return

  requestedInput.value = getArchiveRequiredPosition(archiveState.round)
}

/* =========================
   Undo
========================= */

function cloneArchiveData(data) {
  return JSON.parse(JSON.stringify(data))
}

function createArchiveSnapshot() {
  return {
    archiveRevealState: cloneArchiveData(archiveRevealState),
    archiveRemainingPoints,
    archiveLastTeam,
    archiveTurnLocked,
    archiveTimerStarted,
    archiveLastTickPlayed,
    archiveState: cloneArchiveData(archiveState)
  }
}

function pushArchiveHistory() {
  archiveHistory.push(createArchiveSnapshot())

  if (archiveHistory.length > ARCHIVE_HISTORY_LIMIT) {
    archiveHistory.shift()
  }

  updateArchiveUndoButtonState()
}

function restoreArchiveSnapshot(snapshot) {
  if (!snapshot) return

  clearInterval(archiveTimer)
  archiveTimer = null

  archiveRevealState = cloneArchiveData(snapshot.archiveRevealState || {
    1: {},
    2: {},
    3: {},
    4: {}
  })

  archiveRemainingPoints = Number(snapshot.archiveRemainingPoints || 0)
  archiveLastTeam = snapshot.archiveLastTeam || null
  archiveTurnLocked = !!snapshot.archiveTurnLocked
  archiveTimerStarted = false
  archiveLastTickPlayed = null
  archiveState = cloneArchiveData(snapshot.archiveState || archiveState)

  syncArchiveGlobals()
  renderArchiveRoundUI()
  setArchiveTimerValue(30)
  updateArchiveUndoButtonState()
  saveArchiveState()
  updateEndRoundButtonState()
}

function undoArchiveAction() {
  if (!archiveHistory.length) {
    showGameToast("لا يوجد خطوة للتراجع")
    return
  }

  const snapshot = archiveHistory.pop()
  restoreArchiveSnapshot(snapshot)
}

function updateArchiveUndoButtonState() {
  const btns = document.querySelectorAll(".archiveUndoBtn")
  btns.forEach(btn => {
    btn.disabled = archiveHistory.length === 0
  })
}

/* =========================
   Persistence
========================= */

function getArchiveState() {
  try {
    return JSON.parse(localStorage.getItem(ARCHIVE_STORAGE_KEY) || "null")
  } catch {
    return null
  }
}

function saveArchiveState() {
  const timerBox = document.getElementById("archiveTimerValue")

  const state = {
    archiveRevealState,
    archiveRemainingPoints,
    archiveLastTeam,
    archiveTurnLocked,
    archiveTimerStarted,
    archiveState,
    timerValue: timerBox ? Number(timerBox.innerText || 0) : 30
  }

  localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(state))
  localStorage.setItem("active_segment", "archive")
}

function clearArchiveState() {
  localStorage.removeItem(ARCHIVE_STORAGE_KEY)
  localStorage.removeItem("active_segment")
}

function restoreArchiveState(saved) {
  if (!saved) return

  archiveRevealState = saved.archiveRevealState || archiveRevealState
  archiveRemainingPoints = Number(saved.archiveRemainingPoints || 0)
  archiveLastTeam = saved.archiveLastTeam || null
  archiveTurnLocked = !!saved.archiveTurnLocked
  archiveTimerStarted = !!saved.archiveTimerStarted
  archiveState = saved.archiveState || archiveState
  archiveLastTickPlayed = null

  syncArchiveGlobals()
  renderArchiveRoundUI()

  updateArchiveRequestedInput()

  const timerValue = Number(saved.timerValue || 30)
  if (archiveTimerStarted && timerValue > 0) {
    resumeArchiveTimer(timerValue)
  }

  updateEndRoundButtonState()
}

/* =========================
   Round data
========================= */

function getArchiveDisplayThemeClass(round) {
  if (round === 1) return "archiveThemeRound1"
  if (round === 2) return "archiveThemeRound2"
  if (round === 3) return "archiveThemeRound3"
  return "archiveThemeRound4"
}

window.renderArchive = async function () {
  const saved = getArchiveState()
  archiveHistory = []

  archiveRevealState = {
    1: {},
    2: {},
    3: {},
    4: {}
  }
  archiveRemainingPoints = 0
  archiveLastTeam = null
  archiveTurnLocked = false
  archiveTimerStarted = false
  archiveLastTickPlayed = null
  clearInterval(archiveTimer)
  archiveTimer = null

  archiveState = {
    round: 1,
    scores: { A: 0, B: 0 },
    activeTeam: null,
    errors: {
      1: { A: 0, B: 0 },
      2: { A: 0, B: 0 },
      3: { A: 0, B: 0 },
      4: { A: 0, B: 0 }
    }
  }

  window.archiveState = archiveState
  window.currentSegmentScores = { A: 0, B: 0 }

  archiveRoundCache[1] = await loadArchiveRoundData(1) || { box: null, items: [] }
  syncArchiveGlobals()

  openSegment("الأرشيف - الجولة 1", buildArchiveShell())

  if (saved) {
    restoreArchiveState(saved)
  } else {
    renderArchiveRoundUI()
    saveArchiveState()
    updateEndRoundButtonState()
  }

  loadArchiveRoundData(2).then(data => {
    archiveRoundCache[2] = data || { box: null, items: [] }
    syncArchiveGlobals()
  })

  loadArchiveRoundData(3).then(data => {
    archiveRoundCache[3] = data || { box: null, items: [] }
    syncArchiveGlobals()
  })

  loadArchiveRoundData(4).then(data => {
    archiveRoundCache[4] = data || { box: null, items: [] }
    syncArchiveGlobals()
  })
}

async function loadArchiveRoundData(round) {
  const { data: boxData, error: boxError } = await db
    .from("archive_boxes")
    .select("*")
    .eq("model", currentModel)
    .eq("round", round)
    .limit(1)

  const { data: itemsData, error: itemsError } = await db
    .from("archive_items")
    .select("*")
    .eq("model", currentModel)
    .eq("round", round)
    .order("position", { ascending: true })

  if (boxError) console.log(boxError)
  if (itemsError) console.log(itemsError)

  return {
    box: boxData?.[0] || null,
    items: itemsData || []
  }
}

/* =========================
   UI
========================= */

function buildArchiveShell() {
  return `
    <div class="archiveMainWrap">

      <div class="archiveBoardArea">
        <div class="archiveBoardWrap">
          <div class="archiveBoard archiveModernBoard ${getArchiveDisplayThemeClass(archiveState.round)}" id="archiveBoardTheme">

            <div class="archiveModernTop">
              <div class="archiveModernInfoCard">
                <div class="archiveModernInfoLabel">البطولة</div>
                <div class="archiveModernInfoValue archiveWhiteHidden" id="archivePos1" data-number="1" onclick="toggleArchiveItem(1)"></div>
              </div>

              <div class="archiveModernInfoCard">
                <div class="archiveModernInfoLabel">الموسم</div>
                <div class="archiveModernInfoValue archiveWhiteHidden" id="archivePos2" data-number="2" onclick="toggleArchiveItem(2)"></div>
              </div>
            </div>

            <div class="archiveModernMiddle">
              <div class="archiveModernBigCard archiveWhiteHidden" id="archivePos4" data-number="4" onclick="toggleArchiveItem(4)"></div>

              <div class="archiveModernScoreCard">
                <div class="archiveModernScoreLabel">النتيجة</div>
                <div class="archiveModernScoreValue" id="archiveScoreValue">-</div>
              </div>

              <div class="archiveModernBigCard archiveWhiteHidden" id="archivePos3" data-number="3" onclick="toggleArchiveItem(3)"></div>
            </div>

            <div class="archiveBottomGrid hidden" id="archiveBottomGrid">
              <div class="archiveBottomCol" id="archiveLeftColumn"></div>
              <div class="archiveBottomCol" id="archiveRightColumn"></div>
            </div>

          </div>
        </div>
      </div>

      <div class="archiveSidePanel">

        <div class="archiveSideRound" id="archiveRoundLabel">الجولة 1</div>

        <div class="archiveSideTeamCard" id="archiveTeamA" onclick="selectArchiveTeam('A')">
          <div class="archiveSideTeamRow">
            <div class="archiveSideTeamScore" id="archiveScoreA">0</div>
            <div class="archiveSideTeamName">${teamAName}</div>
          </div>
          <div class="archiveSideErrors" id="archiveErrorsA"></div>
        </div>

        <div class="archiveSideTimerBox">
          <div class="archiveSideTimerLabel">المؤقت</div>
          <div class="archiveSideTimerValue" id="archiveTimerValue">30</div>
          <button onclick="startArchiveTimer()" class="archiveCtrlBtn archiveTimerBtn">بدء المؤقت</button>
        </div>

        <div class="archiveSideTeamCard" id="archiveTeamB" onclick="selectArchiveTeam('B')">
          <div class="archiveSideTeamRow">
            <div class="archiveSideTeamScore" id="archiveScoreB">0</div>
            <div class="archiveSideTeamName">${teamBName}</div>
          </div>
          <div class="archiveSideErrors" id="archiveErrorsB"></div>
        </div>

       <div class="archiveControlButtons">
  <button onclick="addArchiveError()" class="archiveCtrlBtn archiveErrorBtn">خطأ</button>
  <button onclick="showArchiveAnswer()" class="archiveCtrlBtn archiveAnswerBtn">إظهار الإجابة</button>
  <button onclick="undoArchiveAction()" class="archiveCtrlBtn archiveUndoBtn" id="archiveUndoBtn">تراجع</button>
  <button onclick="nextArchiveRound()" class="archiveCtrlBtn archiveNextBtn">الجولة التالية</button>
  
</div>

        <div class="archiveInputsInline">
          <div class="archiveInputRow archiveInputHalf">
            <label class="archiveInputLabel">النقاط</label>
            <input id="archiveManualInput2" class="archiveMiniInput archiveMiniInputStrong" type="text" readonly>
          </div>

          <div class="archiveInputRow archiveInputHalf">
            <label class="archiveInputLabel">المطلوب</label>
            <input id="archiveManualInput1" class="archiveMiniInput archiveMiniInputStrong" type="text" inputmode="numeric" placeholder="رقم" readonly>
          </div>
        </div>

      </div>

    </div>
  `
}

function setArchiveTimerValue(value) {
  const timerBox = document.getElementById("archiveTimerValue")
  if (timerBox) timerBox.innerText = value
}

function resetArchiveTimer() {
  clearInterval(archiveTimer)
  archiveTimer = null
  archiveTimerStarted = false
  archiveLastTickPlayed = null
  setArchiveTimerValue(30)
  saveArchiveState()
}

function startArchiveTimer() {
  runArchiveTimer(30)
}

function resumeArchiveTimer(time) {
  runArchiveTimer(time)
}

function runArchiveTimer(startValue) {
  clearInterval(archiveTimer)
  archiveTimer = null

  let time = Number(startValue || 30)
  archiveTimerStarted = true
  archiveLastTickPlayed = null
  setArchiveTimerValue(time)
  saveArchiveState()

  archiveTimer = setInterval(() => {
    time--
    setArchiveTimerValue(time)

    if (time > 0 && time <= 5 && archiveLastTickPlayed !== time) {
      archiveLastTickPlayed = time
      playGameSound("tick")
    }

    saveArchiveState()

    if (time <= 0) {
      clearInterval(archiveTimer)
      archiveTimer = null
      archiveTimerStarted = false
      archiveLastTickPlayed = null
      setArchiveTimerValue(0)
      playGameSound("timeout")
      saveArchiveState()
    }
  }, 1000)
}

function updateArchivePointsUI() {
  const inputBox = document.getElementById("archiveManualInput2")
  if (inputBox) inputBox.value = archiveRemainingPoints
}

function recalcArchiveRemainingPoints(items = []) {
  const round = archiveState.round
  const existing = items.filter(item => !!item).length
  const opened = items.filter(item => isArchiveItemRevealed(round, item.position)).length
  archiveRemainingPoints = Math.max(0, existing - opened)
  updateArchivePointsUI()
}

function getOtherArchiveTeam(team) {
  return team === "A" ? "B" : "A"
}

function canTeamPlay(team) {
  const round = archiveState.round
  const otherTeam = getOtherArchiveTeam(team)

  if (!archiveLastTeam) return true

  if (archiveLastTeam === team) {
    if (archiveState.errors[round][otherTeam] >= 3) return true
    return false
  }

  return true
}

function advanceArchiveTurn() {
  if (!archiveState.activeTeam) return

  const currentTeam = archiveState.activeTeam
  const otherTeam = getOtherArchiveTeam(currentTeam)
  const round = archiveState.round

  archiveLastTeam = currentTeam

  if (archiveState.errors[round][otherTeam] >= 3) {
    archiveState.activeTeam = currentTeam
  } else {
    archiveState.activeTeam = otherTeam
  }

  highlightArchiveTeam()
}

function renderArchiveRoundUI() {
  const round = archiveState.round
  const roundData = archiveRoundCache[round] || { box: null, items: [] }
  const box = roundData.box
  const items = roundData.items || []
  const map = {}

  items.forEach(item => {
    map[item.position] = item
  })

  const board = document.getElementById("archiveBoardTheme")
  if (board) {
    board.classList.remove(
      "archiveThemeRound1",
      "archiveThemeRound2",
      "archiveThemeRound3",
      "archiveThemeRound4"
    )
    board.classList.add(getArchiveDisplayThemeClass(round))
  }

  const title = document.querySelector(".segmentTitle")
  if (title) title.innerText = `الأرشيف - الجولة ${round}`

  const roundLabel = document.getElementById("archiveRoundLabel")
  if (roundLabel) roundLabel.innerText = `الجولة ${round}`

  const scoreValue = document.getElementById("archiveScoreValue")
  if (scoreValue) scoreValue.innerText = box?.score || "-"

  renderArchivePrimaryBox(1, map[1])
  renderArchivePrimaryBox(2, map[2])
  renderArchiveImageBox(3, map[3])
  renderArchiveImageBox(4, map[4])

  const leftCol = document.getElementById("archiveLeftColumn")
  const rightCol = document.getElementById("archiveRightColumn")
  const bottomGrid = document.getElementById("archiveBottomGrid")

  const textItems = items
    .filter(item => Number(item.position) >= 5)
    .sort((a, b) => Number(a.position) - Number(b.position))

  const under3Items = textItems.filter(item => getArchiveItemParentPosition(item) === 3)
  const under4Items = textItems.filter(item => getArchiveItemParentPosition(item) === 4)

  const hasBottomItems = textItems.length > 0

  if (bottomGrid) {
    if (hasBottomItems) bottomGrid.classList.remove("hidden")
    else bottomGrid.classList.add("hidden")
  }

  if (leftCol) {
    leftCol.innerHTML = under4Items.map(item => renderArchiveBottomItem(item, item.position)).join("")
  }

  if (rightCol) {
    rightCol.innerHTML = under3Items.map(item => renderArchiveBottomItem(item, item.position)).join("")
  }

  recalcArchiveRemainingPoints(items)
  updateArchiveRequestedInput()
  updateArchiveScoresUI()
  updateArchiveErrorsUI()
  highlightArchiveTeam()

  if (!archiveTimerStarted) {
    clearInterval(archiveTimer)
    archiveTimer = null
    setArchiveTimerValue(30)
  }

  syncArchiveGlobals()
  saveArchiveState()
  updateArchiveUndoButtonState()
  updateEndRoundButtonState()
}

function renderArchivePrimaryBox(position, item) {
  const el = document.getElementById(`archivePos${position}`)
  if (!el) return

  const round = archiveState.round
  const revealed = isArchiveItemRevealed(round, position)

  if (!item) {
    el.className = "archiveModernInfoValue archiveWhiteHidden"
    el.setAttribute("data-number", String(position))
    el.innerHTML = ""
    return
  }

  if (!revealed) {
    el.className = "archiveModernInfoValue archiveWhiteHidden"
    el.setAttribute("data-number", String(position))
    el.innerHTML = ""
    return
  }

  el.className = "archiveModernInfoValue"
  el.innerHTML = `<span>${item.text || "-"}</span>`
}

function renderArchiveImageBox(position, item) {
  const el = document.getElementById(`archivePos${position}`)
  if (!el) return

  const round = archiveState.round
  const revealed = isArchiveItemRevealed(round, position)

  if (!item) {
    el.className = "archiveModernBigCard archiveWhiteHidden"
    el.setAttribute("data-number", String(position))
    el.innerHTML = ""
    return
  }

  if (!revealed) {
    el.className = "archiveModernBigCard archiveWhiteHidden"
    el.setAttribute("data-number", String(position))
    el.innerHTML = ""
    return
  }

  el.className = "archiveModernBigCard revealed"
  el.innerHTML = item.image ? `<img src="${item.image}" alt="">` : `<span>${position}</span>`
}

function renderArchiveBottomItem(item, position) {
  if (!item) return ""

  const round = archiveState.round
  const revealed = isArchiveItemRevealed(round, position)
  const labelText = (item.label || "").trim()
  const hasLabel = labelText.length > 0
  const promptStyle = String(item.prompt_style || "shoe").trim().toLowerCase()
  const emoji = promptStyle === "ball" ? "⚽️" : "👟"
  const styleClass = promptStyle === "ball" ? "archivePromptBall" : "archivePromptShoe"

  if (!revealed) {
    return `
      <div class="archiveModernSmallCard ${styleClass}" ${hasLabel ? "" : `onclick="toggleArchiveItem(${position})"`}>
        <div class="archiveModernSmallMain">
          <div class="archiveModernSmallNumber">${position}</div>
          ${hasLabel ? `<div class="archiveModernSmallLabel ${labelText === "المطلوب" ? "archiveRequiredLabel" : ""}">${labelText}</div>` : ""}
        </div>
        <div class="archiveModernSmallEmoji">${emoji}</div>
      </div>
    `
  }

  return `
    <div class="archiveModernSmallCard ${styleClass}">
      <div class="archiveModernSmallMain">
        <div class="archiveModernSmallText">${item.text || "-"}</div>
      </div>
      <div class="archiveModernSmallEmoji">${emoji}</div>
    </div>
  `
}

function renderArchiveErrors(team) {
  const count = archiveState.errors[archiveState.round][team]
  let html = ""

  for (let i = 0; i < 3; i++) {
    html += `<span class="errorMark ${i < count ? "active" : ""}">✕</span>`
  }

  return html
}

function selectArchiveTeam(team) {
  if (!canTeamPlay(team)) {
    showGameToast("لا يمكن لهذا الفريق اللعب الآن")
    return
  }

  archiveState.activeTeam = team
  archiveTurnLocked = false
  highlightArchiveTeam()
  saveArchiveState()
}

function highlightArchiveTeam() {
  const a = document.getElementById("archiveTeamA")
  const b = document.getElementById("archiveTeamB")

  if (!a || !b) return

  a.classList.remove("activeTeam")
  b.classList.remove("activeTeam")

  if (archiveState.activeTeam === "A") a.classList.add("activeTeam")
  if (archiveState.activeTeam === "B") b.classList.add("activeTeam")
}

function toggleArchiveItem(position) {
  const round = archiveState.round
  const items = archiveRoundCache[round]?.items || []
  const item = items.find(x => Number(x.position) === Number(position))

  if (!item) return
  if (isArchiveItemRevealed(round, position)) return

  if (!archiveState.activeTeam) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  if (!canTeamPlay(archiveState.activeTeam)) {
    showGameToast("لا يمكن لهذا الفريق اللعب الآن")
    return
  }

  const hasLabel = !!(item.label || "").trim()

  if (Number(position) >= 5 && hasLabel) return

  pushArchiveHistory()

  setArchiveItemRevealed(round, position, true)
  archiveTurnLocked = true

  playGameSound("open")

  recalcArchiveRemainingPoints(items)
  resetArchiveTimer()
  advanceArchiveTurn()
  syncArchiveGlobals()
  renderArchiveRoundUI()
  saveArchiveState()
  updateEndRoundButtonState()
}

function updateArchiveScoresUI() {
  const a = document.getElementById("archiveScoreA")
  const b = document.getElementById("archiveScoreB")

  if (a) a.innerText = archiveState.scores.A
  if (b) b.innerText = archiveState.scores.B

  window.currentSegmentScores = {
    A: archiveState.scores.A,
    B: archiveState.scores.B
  }
}

function updateArchiveErrorsUI() {
  const a = document.getElementById("archiveErrorsA")
  const b = document.getElementById("archiveErrorsB")

  if (a) a.innerHTML = renderArchiveErrors("A")
  if (b) b.innerHTML = renderArchiveErrors("B")
}

function addArchiveError() {
  if (!archiveState.activeTeam) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  if (!canTeamPlay(archiveState.activeTeam)) {
    showGameToast("لا يمكن لهذا الفريق اللعب الآن")
    return
  }

  const round = archiveState.round
  const team = archiveState.activeTeam

  if (archiveState.errors[round][team] >= 3) {
    showGameToast("هذا الفريق أكمل أخطاءه الثلاث")
    return
  }

  pushArchiveHistory()

  archiveState.errors[round][team] += 1
  archiveTurnLocked = true

  playGameSound("wrong")
  flashScreen("wrong")

  updateArchiveErrorsUI()
  resetArchiveTimer()
  advanceArchiveTurn()
  syncArchiveGlobals()
  renderArchiveRoundUI()
  saveArchiveState()
  updateEndRoundButtonState()
}

function showArchiveAnswer() {
  const requested = Number((document.getElementById("archiveManualInput1")?.value || "").trim())

  if (!requested) {
    showGameToast("أدخل رقم المطلوب")
    return
  }

  if (!archiveState.activeTeam) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  if (!canTeamPlay(archiveState.activeTeam)) {
    showGameToast("لا يمكن لهذا الفريق اللعب الآن")
    return
  }

  const round = archiveState.round
  const items = archiveRoundCache[round]?.items || []
  const item = items.find(x => Number(x.position) === requested)

  if (!item) {
    showGameToast("الرقم غير موجود")
    return
  }

  if (isArchiveItemRevealed(round, requested)) {
    showGameToast("هذا الرقم مفتوح مسبقًا")
    return
  }

  const hasLabel = !!(item.label || "").trim()

  pushArchiveHistory()

  if (hasLabel) {
    const currentRemaining = archiveRemainingPoints

    if (archiveState.activeTeam === "A") archiveState.scores.A += currentRemaining
    if (archiveState.activeTeam === "B") archiveState.scores.B += currentRemaining

    revealAllArchiveRoundItems(round)
  } else {
    setArchiveItemRevealed(round, requested, true)
  }

  archiveTurnLocked = true

  playGameSound("answer")
  flashScreen("correct")

  recalcArchiveRemainingPoints(items)
  updateArchiveScoresUI()
  resetArchiveTimer()
  advanceArchiveTurn()
  syncArchiveGlobals()
  renderArchiveRoundUI()
  saveArchiveState()
  updateEndRoundButtonState()
}

async function nextArchiveRound() {
  if (!isArchiveRoundFinished(archiveState.round)) {
    showGameToast("أنهِ الجولة الحالية أولاً")
    return
  }

  if (archiveState.round >= 4) {
    showGameToast("هذه آخر جولة")
    return
  }

  pushArchiveHistory()

  archiveState.round += 1
  archiveState.activeTeam = null
  archiveLastTeam = null
  archiveTurnLocked = false
  archiveRemainingPoints = 0
  archiveTimerStarted = false
  archiveLastTickPlayed = null

  clearInterval(archiveTimer)
  archiveTimer = null

  syncArchiveGlobals()
  renderArchiveRoundUI()
  saveArchiveState()
  updateEndRoundButtonState()
}

async function prevArchiveRound() {
  if (archiveState.round <= 1) {
    showGameToast("هذه أول جولة")
    return
  }

  pushArchiveHistory()

  archiveState.round -= 1
  archiveState.activeTeam = null
  archiveLastTeam = null
  archiveTurnLocked = false
  archiveRemainingPoints = 0
  archiveTimerStarted = false
  archiveLastTickPlayed = null

  clearInterval(archiveTimer)
  archiveTimer = null

  syncArchiveGlobals()
  renderArchiveRoundUI()
  saveArchiveState()
  updateEndRoundButtonState()
}