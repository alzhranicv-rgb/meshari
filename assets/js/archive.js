/* =========================
   ARCHIVE
========================= */

function createDefaultArchiveRevealState() {
  return {
    1: {},
    2: {},
    3: {},
    4: {}
  }
}

function createDefaultArchiveErrors() {
  return {
    1: { A: 0, B: 0 },
    2: { A: 0, B: 0 },
    3: { A: 0, B: 0 },
    4: { A: 0, B: 0 }
  }
}

function createDefaultArchiveRoundCache() {
  return {
    1: { box: null, items: [] },
    2: { box: null, items: [] },
    3: { box: null, items: [] },
    4: { box: null, items: [] }
  }
}

let archiveRevealState = createDefaultArchiveRevealState()
let archiveRoundCache = createDefaultArchiveRoundCache()

let archiveRemainingPoints = 0
let archiveLastTeam = null
let archiveTimer = null
let archiveTurnLocked = false
let archiveTimerStarted = false
let archiveLastTickPlayed = null

let archiveDoubleState = {
  used: { A: false, B: false },
  activeTeam: null
}

let archiveState = {
  round: 1,
  scores: { A: 0, B: 0 },
  activeTeam: null,
  errors: createDefaultArchiveErrors()
}

window.archiveState = archiveState
window.archiveRevealState = archiveRevealState
window.archiveRoundCache = archiveRoundCache

const ARCHIVE_STORAGE_KEY = "archive_state_v1"

let archiveHistory = []

window.archiveMaxRound = Number(window.archiveMaxRound || localStorage.getItem("archive_max_round") || 4)
var archiveMaxRound = window.archiveMaxRound

const ARCHIVE_HISTORY_LIMIT = 80

/* =========================
   Helpers
========================= */

async function loadArchiveMaxRound() {
  if (!currentModel) {
    archiveMaxRound = 4
    window.archiveMaxRound = archiveMaxRound
    localStorage.setItem("archive_max_round", String(archiveMaxRound))
    return archiveMaxRound
  }

  const { data, error } = await db
    .from("segment_settings")
    .select("item_count")
    .eq("model", Number(currentModel))
    .eq("segment", "archive")
    .maybeSingle()

  if (error) {
    console.log(error)
    archiveMaxRound = 4
  } else {
    archiveMaxRound = Math.min(Math.max(Number(data?.item_count || 4), 1), 4)
  }

  window.archiveMaxRound = archiveMaxRound
  localStorage.setItem("archive_max_round", String(archiveMaxRound))

  return archiveMaxRound
}

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

  return items.every(item => {
    return isArchiveItemRevealed(round, item.position)
  })
}

function syncArchiveGlobals() {
  window.archiveState = archiveState
  window.archiveRevealState = archiveRevealState
  window.archiveRoundCache = archiveRoundCache
  window.archiveMaxRound = archiveMaxRound

  window.currentSegmentScores = {
    A: archiveState.scores.A,
    B: archiveState.scores.B
  }
}

function updateArchiveEndState() {
  if (typeof updateArchiveNavButtons === "function") {
    updateArchiveNavButtons()
  }

  if (typeof window.updateEndRoundButtonState === "function") {
    window.updateEndRoundButtonState()
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

function getArchiveDisplayThemeClass(round) {
  if (round === 1) return "archiveThemeRound1"
  if (round === 2) return "archiveThemeRound2"
  if (round === 3) return "archiveThemeRound3"
  return "archiveThemeRound4"
}

/* =========================
   Load round data
========================= */

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
    archiveRevealState: JSON.parse(JSON.stringify(archiveRevealState || {})),
    archiveRemainingPoints,
    archiveLastTeam,
    archiveTurnLocked,
    archiveTimerStarted,
    archiveLastTickPlayed,
    archiveState: JSON.parse(JSON.stringify(archiveState || {})),
    archiveDoubleState: JSON.parse(JSON.stringify(archiveDoubleState || {})),
    archiveMaxRound,
    timerValue: timerBox ? Number(timerBox.innerText || 0) : 30,
    archiveHistory: JSON.parse(JSON.stringify(archiveHistory || []))
  }

  localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(state))
  localStorage.setItem("active_segment", "archive")

  if (typeof saveUnifiedGameState === "function") {
    saveUnifiedGameState()
  }

  if (typeof syncDisplayStateToSession === "function") {
    syncDisplayStateToSession()
  }
}

function clearArchiveState() {
  localStorage.removeItem(ARCHIVE_STORAGE_KEY)
  localStorage.removeItem("active_segment")
}

function restoreArchiveState(saved) {
  if (!saved) return

  archiveMaxRound = Math.min(
    Math.max(Number(window.archiveMaxRound || localStorage.getItem("archive_max_round") || saved.archiveMaxRound || archiveMaxRound || 4), 1),
    4
  )

  window.archiveMaxRound = archiveMaxRound
  localStorage.setItem("archive_max_round", String(archiveMaxRound))

  archiveRevealState = saved.archiveRevealState || createDefaultArchiveRevealState()
  archiveRemainingPoints = Number(saved.archiveRemainingPoints || 0)
  archiveLastTeam = saved.archiveLastTeam || null
  archiveTurnLocked = !!saved.archiveTurnLocked
  archiveTimerStarted = !!saved.archiveTimerStarted
  archiveState = saved.archiveState || archiveState

  archiveState.round = Math.min(
    Math.max(Number(archiveState.round || 1), 1),
    archiveMaxRound
  )

  if (!archiveState.errors) {
    archiveState.errors = createDefaultArchiveErrors()
  }

  for (let r = 1; r <= 4; r++) {
    if (!archiveState.errors[r]) archiveState.errors[r] = { A: 0, B: 0 }
    if (!archiveRevealState[r]) archiveRevealState[r] = {}
  }

  archiveDoubleState = saved.archiveDoubleState || {
    used: { A: false, B: false },
    activeTeam: null
  }

  archiveLastTickPlayed = null
  archiveHistory = Array.isArray(saved.archiveHistory) ? saved.archiveHistory : []

  syncArchiveGlobals()
  renderArchiveRoundUI()
  updateArchiveRequestedInput()

  const timerValue = Number(saved.timerValue || 30)

  if (archiveTimerStarted && timerValue > 0) {
    resumeArchiveTimer(timerValue)
  } else {
    setArchiveTimerValue(timerValue)
  }

  updateArchiveDoubleButton()
  updateArchiveUndoButtonState()
  updateArchiveEndState()
}

/* =========================
   Render
========================= */

window.renderArchive = async function () {
  await loadArchiveMaxRound()

  const saved = getArchiveState()

  archiveHistory = []
  archiveRevealState = createDefaultArchiveRevealState()
  archiveRoundCache = createDefaultArchiveRoundCache()

  archiveRemainingPoints = 0
  archiveLastTeam = null
  archiveTurnLocked = false
  archiveTimerStarted = false
  archiveLastTickPlayed = null

  archiveDoubleState = {
    used: { A: false, B: false },
    activeTeam: null
  }

  clearInterval(archiveTimer)
  archiveTimer = null

  archiveState = {
    round: 1,
    scores: { A: 0, B: 0 },
    activeTeam: null,
    errors: createDefaultArchiveErrors()
  }

  window.archiveState = archiveState
  window.currentSegmentScores = { A: 0, B: 0 }

  for (let r = 1; r <= archiveMaxRound; r++) {
    archiveRoundCache[r] = await loadArchiveRoundData(r) || { box: null, items: [] }
  }

  syncArchiveGlobals()

  openSegment("الأرشيف - الجولة 1", buildArchiveShell())

  if (saved) {
    restoreArchiveState(saved)
  } else {
    renderArchiveRoundUI()
    saveArchiveState()
    updateArchiveEndState()
  }
}

/* =========================
   UI Shell
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

        <div class="archiveRoundTabs" id="archiveRoundTabs"></div>

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
          <button onclick="activateArchiveDouble()" class="archiveCtrlBtn archiveDoubleBtn" id="archiveDoubleBtn">دوبيلا</button>
          <button onclick="addArchiveError()" class="archiveCtrlBtn archiveErrorBtn">خطأ</button>
          <button onclick="showArchiveAnswer()" class="archiveCtrlBtn archiveAnswerBtn">إظهار الإجابة</button>
          <button onclick="undoArchiveAction()" class="archiveCtrlBtn archiveUndoBtn" id="archiveUndoBtn">تراجع</button>
          <button onclick="prevArchiveRound()" class="archiveCtrlBtn archivePrevBtn">الجولة السابقة</button>
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

function renderArchiveRoundTabs() {
  const tabs = document.getElementById("archiveRoundTabs")
  if (!tabs) return

  tabs.innerHTML = Array.from({ length: archiveMaxRound }, (_, i) => {
    const r = i + 1

    return `
      <button
        type="button"
        class="${archiveState.round === r ? "active" : ""}"
        onclick="setArchiveRound(${r})"
      >
        ${r}
      </button>
    `
  }).join("")
}

/* =========================
   Timer
========================= */

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

/* =========================
   Score / Turn
========================= */

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

function selectArchiveTeam(team) {
  if (!canTeamPlay(team)) {
    showGameToast("لا يمكن لهذا الفريق اللعب الآن")
    return
  }

  archiveState.activeTeam = team
  selectedTeam = team
  archiveTurnLocked = false

  highlightArchiveTeam()
  saveArchiveState()

  setTimeout(() => {
    highlightArchiveTeam()
  }, 80)
}

function getArchiveTeamBox(team) {
  const letter = team === "A" ? "A" : "B"

  return (
    document.getElementById(`archiveTeam${letter}Box`) ||
    document.getElementById(`archiveTeam${letter}`) ||
    document.getElementById(`archiveScore${letter}Box`) ||
    document.getElementById(`archiveScorePanel${letter}`) ||
    document.querySelector(`[onclick="selectArchiveTeam('${letter}')"]`) ||
    document.querySelector(`[onclick='selectArchiveTeam("${letter}")']`) ||
    document.querySelector(`[data-team="${letter}"]`) ||
    document.querySelector(`.archiveTeamBox.team${letter}`) ||
    document.querySelector(`.archiveTeamCard.team${letter}`) ||
    document.querySelector(`.archiveScorePanel.team${letter}`)
  )
}

function highlightArchiveTeam() {
  const team = archiveState.activeTeam || null

  document.querySelectorAll(".archiveTeamCurrent").forEach(el => {
    el.classList.remove("archiveTeamCurrent")
  })

  const a = getArchiveTeamBox("A")
  const b = getArchiveTeamBox("B")

  if (a) {
    a.classList.remove("activeTeam", "selectedPresenterTeam", "finalTurnActiveTeam")
  }

  if (b) {
    b.classList.remove("activeTeam", "selectedPresenterTeam", "finalTurnActiveTeam")
  }

  if (team === "A" && a) {
    a.classList.add("archiveTeamCurrent")
  }

  if (team === "B" && b) {
    b.classList.add("archiveTeamCurrent")
  }

  if (!a || !b) {
    console.log("ARCHIVE TEAM BOX NOT FOUND:", { team, a, b })
  }
}

/* =========================
   Double
========================= */

function activateArchiveDouble() {
  const team = archiveState.activeTeam

  if (!team) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  if (archiveDoubleState.used[team]) {
    showGameToast("هذا الفريق استخدم الدبل مسبقًا")
    return
  }

  if (archiveDoubleState.used.A && archiveDoubleState.used.B) {
    showGameToast("تم استخدام الدوبيلا من الفريقين")
    return
  }

  pushArchiveHistory()

  archiveDoubleState.used[team] = true
  archiveDoubleState.activeTeam = team

  showGameToast(`تم تفعيل الدوبيلا لفريق ${team === "A" ? teamAName : teamBName}`)

  updateArchiveDoubleButton()
  saveArchiveState()
}

function getArchiveScoreMultiplier(team) {
  return archiveDoubleState.activeTeam === team ? 2 : 1
}

function clearArchiveActiveDouble(team) {
  if (archiveDoubleState.activeTeam === team) {
    archiveDoubleState.activeTeam = null
  }
}

function updateArchiveDoubleButton() {
  const btn = document.getElementById("archiveDoubleBtn")
  if (!btn) return

  const team = archiveState.activeTeam

  btn.classList.remove("activeDouble")

  if (!team) {
    btn.disabled = archiveDoubleState.used.A && archiveDoubleState.used.B
    btn.innerText = "دوبيلا"
    return
  }

  if (archiveDoubleState.activeTeam === team) {
    btn.disabled = true
    btn.innerText = "الدوبيلا مفعّل"
    btn.classList.add("activeDouble")
    return
  }

  if (archiveDoubleState.used[team]) {
    btn.disabled = true
    btn.innerText = "استخدم الدوبيلا"
    return
  }

  if (archiveDoubleState.used.A && archiveDoubleState.used.B) {
    btn.disabled = true
    btn.innerText = "الدوبيلا مقفل"
    return
  }

  btn.disabled = false
  btn.innerText = "دوبيلا"
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
    archiveState: cloneArchiveData(archiveState),
    archiveDoubleState: cloneArchiveData(archiveDoubleState),
    archiveMaxRound
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

  archiveRevealState = cloneArchiveData(snapshot.archiveRevealState || createDefaultArchiveRevealState())
  archiveRemainingPoints = Number(snapshot.archiveRemainingPoints || 0)
  archiveLastTeam = snapshot.archiveLastTeam || null
  archiveTurnLocked = !!snapshot.archiveTurnLocked
  archiveTimerStarted = false
  archiveLastTickPlayed = null
  archiveState = cloneArchiveData(snapshot.archiveState || archiveState)
  archiveDoubleState = cloneArchiveData(snapshot.archiveDoubleState || {
    used: { A: false, B: false },
    activeTeam: null
  })

  archiveMaxRound = Math.min(Math.max(Number(snapshot.archiveMaxRound || archiveMaxRound || 4), 1), 4)
  archiveState.round = Math.min(Math.max(Number(archiveState.round || 1), 1), archiveMaxRound)

  syncArchiveGlobals()
  renderArchiveRoundUI()
  setArchiveTimerValue(30)
  updateArchiveUndoButtonState()
  saveArchiveState()
  updateArchiveEndState()
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
   Render Round UI
========================= */

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

  renderArchiveRoundTabs()

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

  updateArchiveDoubleButton()
  syncArchiveGlobals()
  saveArchiveState()
  updateArchiveUndoButtonState()
  updateArchiveEndState()
}

function renderArchivePrimaryBox(position, item) {
  const el = document.getElementById(`archivePos${position}`)
  if (!el) return

  const round = archiveState.round
  const revealed = isArchiveItemRevealed(round, position)

  if (!item || !revealed) {
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

  if (!item || !revealed) {
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
      <div
        class="archiveModernSmallCard ${styleClass}"
        ${hasLabel ? "" : `onclick="toggleArchiveItem(${position})"`}
      >
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

/* =========================
   Errors / Score
========================= */

function renderArchiveErrors(team) {
  const count = archiveState.errors?.[archiveState.round]?.[team] || 0
  let html = ""

  for (let i = 0; i < 3; i++) {
    html += `<span class="errorMark ${i < count ? "active" : ""}">✕</span>`
  }

  return html
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

/* =========================
   Actions
========================= */

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
  updateArchiveEndState()
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

  clearArchiveActiveDouble(team)

  archiveState.errors[round][team] += 1
  archiveTurnLocked = true

  playGameSound("wrong")
  flashScreen("wrong")

  updateArchiveErrorsUI()
  updateArchiveDoubleButton()
  resetArchiveTimer()
  advanceArchiveTurn()
  syncArchiveGlobals()
  renderArchiveRoundUI()
  saveArchiveState()
  updateArchiveEndState()
}

function showArchiveAnswer() {
  const requested = Number((document.getElementById("archiveManualInput1")?.value || "").trim())

  if (!requested) {
    showGameToast("لا يوجد رقم مطلوب")
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
  const team = archiveState.activeTeam
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
    const multiplier = getArchiveScoreMultiplier(team)
    const finalPoints = currentRemaining * multiplier

    if (team === "A") archiveState.scores.A += finalPoints
    if (team === "B") archiveState.scores.B += finalPoints

    clearArchiveActiveDouble(team)
    revealAllArchiveRoundItems(round)
  } else {
    setArchiveItemRevealed(round, requested, true)
  }

  archiveTurnLocked = true

  playGameSound("answer")
  flashScreen("correct")

  recalcArchiveRemainingPoints(items)
  updateArchiveScoresUI()
  updateArchiveDoubleButton()
  resetArchiveTimer()
  advanceArchiveTurn()
  syncArchiveGlobals()
  renderArchiveRoundUI()
  saveArchiveState()
  updateArchiveEndState()
}

/* =========================
   Round Navigation
========================= */

async function ensureArchiveRoundLoaded(round) {
  if (!archiveRoundCache[round]) {
    archiveRoundCache[round] = { box: null, items: [] }
  }

  const hasLoaded =
    archiveRoundCache[round].box ||
    (Array.isArray(archiveRoundCache[round].items) && archiveRoundCache[round].items.length)

  if (!hasLoaded) {
    archiveRoundCache[round] = await loadArchiveRoundData(round) || { box: null, items: [] }
  }
}

async function setArchiveRound(round) {
  const safeRound = Math.min(Math.max(Number(round || 1), 1), archiveMaxRound)

  if (safeRound === archiveState.round) return

  pushArchiveHistory()

  archiveState.round = safeRound
  archiveState.activeTeam = null
  archiveLastTeam = null
  archiveTurnLocked = false
  archiveRemainingPoints = 0
  archiveTimerStarted = false
  archiveLastTickPlayed = null
  archiveDoubleState.activeTeam = null

  clearInterval(archiveTimer)
  archiveTimer = null

  await ensureArchiveRoundLoaded(safeRound)

  syncArchiveGlobals()
  renderArchiveRoundUI()
  saveArchiveState()
  updateArchiveEndState()
}

async function nextArchiveRound() {
  if (!isArchiveRoundFinished(archiveState.round)) {
    showGameToast("أنهِ الجولة الحالية أولاً")
    return
  }

  if (archiveState.round >= archiveMaxRound) {
    showGameToast("هذه آخر جولة")
    return
  }

  await setArchiveRound(Number(archiveState.round) + 1)
}

async function prevArchiveRound() {
  if (archiveState.round <= 1) {
    showGameToast("هذه أول جولة")
    return
  }

  await setArchiveRound(Number(archiveState.round) - 1)
}

/* =========================
   Navigation Buttons
========================= */

function updateArchiveNavButtons() {
  const currentRound = Number(archiveState.round || 1)

  const nextBtns = document.querySelectorAll(".archiveNextBtn")
  nextBtns.forEach(btn => {
    btn.disabled =
      currentRound >= archiveMaxRound ||
      !isArchiveRoundFinished(currentRound)
  })

  const prevBtns = document.querySelectorAll(".archivePrevBtn")
  prevBtns.forEach(btn => {
    btn.disabled = currentRound <= 1
  })
}