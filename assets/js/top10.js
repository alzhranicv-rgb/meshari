let top10MaxRound = Number(window.top10MaxRound || localStorage.getItem("top10_max_round") || 3)
window.top10MaxRound = top10MaxRound

let top10State = {
  round: 1,
  scores: { A: 0, B: 0 },
  activeTeam: null,
  lastTeam: null,
  question: { 1: "", 2: "", 3: "", 4: "" },
  errors: {
    1: { A: 0, B: 0 },
    2: { A: 0, B: 0 },
    3: { A: 0, B: 0 },
    4: { A: 0, B: 0 }
  },
  opened: { 1: [], 2: [], 3: [], 4: [] },
  answers: { 1: {}, 2: {}, 3: {}, 4: {} }
}

window.top10State = top10State

let top10DoubleState = {
  used: { A: false, B: false },
  activeTeam: null
}

let currentTop10Answer = null
let currentTop10Number = null
let top10TimerStarted = false
let top10LastTickPlayed = null
let top10AnimatingNumber = null

let top10History = []
const TOP10_HISTORY_LIMIT = 50
const TOP10_STORAGE_KEY = "top10_state_v1"
const TOP10_TIMER_SECONDS = 35

/* =========================
   Persistence
========================= */

function getTop10State() {
  try {
    return JSON.parse(localStorage.getItem(TOP10_STORAGE_KEY) || "null")
  } catch {
    return null
  }
}

function syncTop10Globals() {
  top10MaxRound = Math.min(Math.max(Number(top10MaxRound || 3), 1), 4)

  window.top10MaxRound = top10MaxRound
  window.top10State = top10State

  localStorage.setItem("top10_max_round", String(top10MaxRound))

  window.currentSegmentScores = {
    A: Number(top10State.scores?.A || 0),
    B: Number(top10State.scores?.B || 0)
  }
}

function createEmptyTop10State(maxRound = top10MaxRound) {
  const safeMax = Math.min(Math.max(Number(maxRound || 3), 1), 4)

  const question = {}
  const errors = {}
  const opened = {}
  const answers = {}

  for (let r = 1; r <= safeMax; r++) {
    question[r] = ""
    errors[r] = { A: 0, B: 0 }
    opened[r] = []
    answers[r] = {}
  }

  return {
    round: 1,
    scores: { A: 0, B: 0 },
    activeTeam: null,
    lastTeam: null,
    question,
    errors,
    opened,
    answers
  }
}

function ensureTop10RoundState() {
  top10MaxRound = Math.min(Math.max(Number(top10MaxRound || 3), 1), 4)

  if (!top10State.question) top10State.question = {}
  if (!top10State.errors) top10State.errors = {}
  if (!top10State.opened) top10State.opened = {}
  if (!top10State.answers) top10State.answers = {}

  for (let r = 1; r <= top10MaxRound; r++) {
    if (typeof top10State.question[r] !== "string") {
      top10State.question[r] = ""
    }

    if (!top10State.errors[r]) {
      top10State.errors[r] = { A: 0, B: 0 }
    }

    if (typeof top10State.errors[r].A !== "number") {
      top10State.errors[r].A = 0
    }

    if (typeof top10State.errors[r].B !== "number") {
      top10State.errors[r].B = 0
    }

    if (!Array.isArray(top10State.opened[r])) {
      top10State.opened[r] = []
    }

    if (!top10State.answers[r]) {
      top10State.answers[r] = {}
    }
  }

  top10State.round = Math.min(
    Math.max(Number(top10State.round || 1), 1),
    top10MaxRound
  )

  syncTop10Globals()
}

function saveTop10State() {
  ensureTop10RoundState()

  const timerBox = document.getElementById("timer")

  const state = {
    top10State,
    top10DoubleState,
    currentTop10Answer,
    currentTop10Number,
    top10TimerStarted,
    top10MaxRound,
    timerValue: timerBox ? Number(timerBox.innerText || 0) : 0,
    top10History
  }

  localStorage.setItem(TOP10_STORAGE_KEY, JSON.stringify(state))
  localStorage.setItem("top10_max_round", String(top10MaxRound))
  localStorage.setItem("active_segment", "top10")

  syncTop10Globals()

  if (typeof syncDisplayStateToSession === "function") {
    syncDisplayStateToSession()
  }
}

function clearTop10State() {
  localStorage.removeItem(TOP10_STORAGE_KEY)
  localStorage.removeItem("top10_max_round")
  localStorage.removeItem("active_segment")
}

function restoreTop10State(saved) {
  if (!saved || !saved.top10State) return

  top10MaxRound = Math.min(
    Math.max(
      Number(
        window.top10MaxRound ||
        localStorage.getItem("top10_max_round") ||
        saved.top10MaxRound ||
        top10MaxRound ||
        3
      ),
      1
    ),
    4
  )

  window.top10MaxRound = top10MaxRound
  localStorage.setItem("top10_max_round", String(top10MaxRound))

  const loadedQuestions = top10State?.question ? { ...top10State.question } : {}

  top10State = saved.top10State

  if (!top10State.question) top10State.question = {}
  if (!top10State.errors) top10State.errors = {}
  if (!top10State.opened) top10State.opened = {}
  if (!top10State.answers) top10State.answers = {}

  for (let r = 1; r <= top10MaxRound; r++) {
    if (!top10State.question[r]) {
      top10State.question[r] = loadedQuestions[r] || "السؤال يظهر هنا"
    }

    if (!top10State.errors[r]) {
      top10State.errors[r] = { A: 0, B: 0 }
    }

    if (typeof top10State.errors[r].A !== "number") {
      top10State.errors[r].A = 0
    }

    if (typeof top10State.errors[r].B !== "number") {
      top10State.errors[r].B = 0
    }

    if (!Array.isArray(top10State.opened[r])) {
      top10State.opened[r] = []
    }

    if (!top10State.answers[r]) {
      top10State.answers[r] = {}
    }
  }

  top10State.round = Math.min(
    Math.max(Number(top10State.round || 1), 1),
    top10MaxRound
  )

  top10DoubleState = saved.top10DoubleState || {
    used: { A: false, B: false },
    activeTeam: null
  }

  currentTop10Answer = saved.currentTop10Answer || null
  currentTop10Number = saved.currentTop10Number || null
  top10TimerStarted = !!saved.top10TimerStarted
  top10AnimatingNumber = null
  top10History = Array.isArray(saved.top10History) ? saved.top10History : []

  syncTop10Globals()
  renderCurrentRoundTop10UI()

  const timerValue = Number(saved.timerValue || 0)

  if (top10TimerStarted && timerValue > 0) {
    resumeTop10Timer(timerValue)
  } else {
    const timerBox = document.getElementById("timer")
    if (timerBox) timerBox.innerText = timerValue || 0
  }

  updateTop10UndoButtonState()
  updateTop10DoubleButton()
  saveTop10State()

  if (typeof updateEndRoundButtonState === "function") {
    updateEndRoundButtonState()
  }
}

/* =========================
   Double
========================= */

function activateTop10Double() {
  const team = top10State.activeTeam

  if (!team) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  if (top10DoubleState.used[team]) {
    showGameToast("هذا الفريق استخدم الدوبيلا مسبقًا")
    return
  }

  if (top10DoubleState.used.A && top10DoubleState.used.B) {
    showGameToast("تم استخدام الدوبيلا من الفريقين")
    return
  }

  pushTop10History()

  top10DoubleState.used[team] = true
  top10DoubleState.activeTeam = team

  showGameToast(`تم تفعيل الدوبيلا لفريق ${team === "A" ? teamAName : teamBName}`)

  updateTop10DoubleButton()
  saveTop10State()
}

function getTop10ScoreValue(team, num) {
  return top10DoubleState.activeTeam === team ? num * 2 : num
}

function clearTop10ActiveDouble() {
  top10DoubleState.activeTeam = null
}

function updateTop10DoubleButton() {
  const btn = document.getElementById("top10DoubleBtn")
  if (!btn) return

  const team = top10State.activeTeam

  btn.classList.remove("activeDouble")

  if (!team) {
    btn.disabled = top10DoubleState.used.A && top10DoubleState.used.B
    btn.innerText = "دوبيلا"
    return
  }

  if (top10DoubleState.activeTeam === team) {
    btn.disabled = true
    btn.innerText = "الدوبيلا مفعّل"
    btn.classList.add("activeDouble")
    return
  }

  if (top10DoubleState.used[team]) {
    btn.disabled = true
    btn.innerText = "الدوبيلا"
    return
  }

  if (top10DoubleState.used.A && top10DoubleState.used.B) {
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

function cloneTop10Data(data) {
  return JSON.parse(JSON.stringify(data))
}

function createTop10Snapshot() {
  const timerBox = document.getElementById("timer")

  return {
    top10State: cloneTop10Data(top10State),
    top10DoubleState: cloneTop10Data(top10DoubleState),
    currentTop10Answer,
    currentTop10Number,
    top10TimerStarted,
    top10MaxRound,
    timerValue: timerBox ? Number(timerBox.innerText || 0) : 0
  }
}

function pushTop10History() {
  top10History.push(createTop10Snapshot())

  if (top10History.length > TOP10_HISTORY_LIMIT) {
    top10History.shift()
  }

  updateTop10UndoButtonState()
}

function restoreTop10Snapshot(snapshot) {
  if (!snapshot) return

  clearInterval(timer)
  timer = null

  top10MaxRound = Math.min(
    Math.max(Number(snapshot.top10MaxRound || top10MaxRound || 3), 1),
    4
  )

  top10State = cloneTop10Data(snapshot.top10State)
  ensureTop10RoundState()

  top10DoubleState = cloneTop10Data(snapshot.top10DoubleState || {
    used: { A: false, B: false },
    activeTeam: null
  })

  currentTop10Answer = snapshot.currentTop10Answer || null
  currentTop10Number = snapshot.currentTop10Number || null
  top10TimerStarted = !!snapshot.top10TimerStarted
  top10LastTickPlayed = null
  top10AnimatingNumber = null

  syncTop10Globals()
  renderCurrentRoundTop10UI()

  const timerValue = Number(snapshot.timerValue || 0)

  if (top10TimerStarted && timerValue > 0) {
    resumeTop10Timer(timerValue)
  } else {
    const timerBox = document.getElementById("timer")
    if (timerBox) timerBox.innerText = timerValue || 0
  }

  updateTop10UndoButtonState()
  updateTop10DoubleButton()
  saveTop10State()

  if (typeof updateEndRoundButtonState === "function") {
    updateEndRoundButtonState()
  }
}

function undoTop10Action() {
  if (!top10History.length) {
    showGameToast("لا يوجد خطوة للتراجع")
    return
  }

  const snapshot = top10History.pop()
  restoreTop10Snapshot(snapshot)
}

function updateTop10UndoButtonState() {
  const btn = document.getElementById("top10UndoBtn")
  if (!btn) return

  btn.disabled = top10History.length === 0
}

/* =========================
   Settings
========================= */

async function loadTop10MaxRound() {
  if (!currentModel) {
    top10MaxRound = 3
    window.top10MaxRound = top10MaxRound
    localStorage.setItem("top10_max_round", String(top10MaxRound))
    return top10MaxRound
  }

  const { data, error } = await db
    .from("segment_settings")
    .select("item_count")
    .eq("model", Number(currentModel))
    .eq("segment", "top10")
    .maybeSingle()

  if (error) {
    console.log(error)
    top10MaxRound = 3
  } else {
    top10MaxRound = Math.min(Math.max(Number(data?.item_count || 3), 1), 4)
  }

  window.top10MaxRound = top10MaxRound
  localStorage.setItem("top10_max_round", String(top10MaxRound))

  return top10MaxRound
}

/* =========================
   Render
========================= */

window.renderTop10 = async function () {
  await loadTop10MaxRound()

  const saved = getTop10State()

  top10State = createEmptyTop10State(top10MaxRound)
  ensureTop10RoundState()

  top10DoubleState = {
    used: { A: false, B: false },
    activeTeam: null
  }

  syncTop10Globals()

  currentTop10Answer = null
  currentTop10Number = null
  top10TimerStarted = false
  top10LastTickPlayed = null
  top10AnimatingNumber = null
  top10History = []

  for (let r = 1; r <= top10MaxRound; r++) {
    await loadTop10RoundQuestion(r)
  }

  openSegment(`Top 10 - الجولة ${top10State.round}`, buildTop10HTML())

  if (saved) {
    restoreTop10State(saved)
  } else {
    highlightTop10TurnTeam()
    updateTop10TurnLabel()
    updateTop10UndoButtonState()
    updateTop10DoubleButton()
    saveTop10State()
  }

  if (typeof updateEndRoundButtonState === "function") {
    updateEndRoundButtonState()
  }
}

function autoStartTop10Timer() {
  if (!top10State.activeTeam) return

  clearInterval(timer)
  timer = null

  top10TimerStarted = true
  runTop10Timer(TOP10_TIMER_SECONDS)
}

async function loadTop10RoundQuestion(round) {
  const { data, error } = await db
    .from("top10_questions")
    .select("*")
    .eq("model", currentModel)
    .eq("round", round)
    .order("position", { ascending: true })

  if (error) {
    console.log(error)
    top10State.question[round] = "السؤال يظهر هنا"
    return
  }

  top10State.question[round] =
    data && data.length > 0
      ? data[0].question || "السؤال يظهر هنا"
      : "السؤال يظهر هنا"
}

function buildTop10HTML() {
  ensureTop10RoundState()

  const round = top10State.round
  const opened = top10State.opened[round] || []

  const rightSide = [1, 2, 3, 4, 5]
  const leftSide = [6, 7, 8, 9, 10]

  return `
    <div class="top10Wrap">
      <div class="top10MainBoard">

        <div class="top10HeaderBar">

          <div
            class="top10ScoreCard ${top10State.activeTeam === "A" ? "activeTeam" : ""}"
            id="top10TeamA"
            onclick="selectTop10Team('A')"
          >
            <div class="top10ScoreName top10ScoreNameLeft">
              ${teamAName}
            </div>

            <div class="top10ScoreErrors" id="top10ErrorsA">
              ${renderTop10Errors("A")}
            </div>

            <div class="top10ScoreValue top10ScoreValueRight" id="top10ScoreA">
              ${top10State.scores.A}
            </div>
          </div>

          <div class="top10MiddleCard">
            <div class="top10MiddleTimer" id="timer">0</div>

            <div class="top10MiddleTurn" id="top10TurnLabel">
              ${
                top10State.activeTeam === "A"
                  ? teamAName
                  : top10State.activeTeam === "B"
                  ? teamBName
                  : "اختر فريق"
              }
            </div>
          </div>

          <div
            class="top10ScoreCard ${top10State.activeTeam === "B" ? "activeTeam" : ""}"
            id="top10TeamB"
            onclick="selectTop10Team('B')"
          >
            <div class="top10ScoreValue top10ScoreValueLeft" id="top10ScoreB">
              ${top10State.scores.B}
            </div>

            <div class="top10ScoreErrors" id="top10ErrorsB">
              ${renderTop10Errors("B")}
            </div>

            <div class="top10ScoreName top10ScoreNameRight">
              ${teamBName}
            </div>
          </div>

        </div>

        <div class="top10QuestionBox" id="top10QuestionBox">
          ${top10State.question[round] || "السؤال يظهر هنا"}
        </div>

        <div class="top10ControlPanel">
          <button
            onclick="activateTop10Double()"
            id="top10DoubleBtn"
            class="top10DoubleBtn"
          >
            دوبيلا
          </button>

          <button onclick="showTop10Answer()" class="btnAnswer">
            إظهار الإجابات
          </button>

          <button onclick="addTop10Error()" class="top10ErrorBtnSingle">
            خطأ
          </button>

          <button onclick="undoTop10Action()" id="top10UndoBtn" class="undoBtn">
            تراجع
          </button>

          <button onclick="switchTop10Turn()" class="roundNavBtn switchTurnBtn">
            تبديل الدور
          </button>

          <button onclick="nextTop10Round()" class="roundNavBtn">
            الجولة التالية
          </button>
        </div>

        <div class="top10NumbersShell">
          <div class="top10NumbersArea">

            <div class="top10Side top10RightSide">
              ${rightSide.map(num => renderTop10Rect(num, opened)).join("")}
            </div>

            <div class="top10Side top10LeftSide">
              ${leftSide.map(num => renderTop10Rect(num, opened)).join("")}
            </div>

          </div>
        </div>

      </div>
    </div>
  `
}

function renderTop10Rect(num, opened) {
  const round = top10State.round
  const isOpened = opened.includes(num)
  const isAnimating = top10AnimatingNumber === num
  const answer = top10State.answers?.[round]?.[num] || num

  if (isOpened) {
    return `
      <button
        class="top10Rect opened${isAnimating ? " top10RevealFx" : ""}"
        data-num="${num}"
        disabled
      >
        <span class="top10RectInner">${answer}</span>
      </button>
    `
  }

  return `
    <button
      onclick="openTop10Number(${num})"
      data-num="${num}"
      class="top10Rect"
    >
      <span class="top10RectInner">${num}</span>
    </button>
  `
}

function renderTop10Errors(team) {
  ensureTop10RoundState()

  const count = Number(top10State.errors?.[top10State.round]?.[team] || 0)
  let html = ""

  for (let i = 0; i < 3; i++) {
    html += `<span class="errorMark ${i < count ? "active" : ""}">✕</span>`
  }

  return html
}

function getOtherTeam(team) {
  return team === "A" ? "B" : "A"
}

/* =========================
   Game Actions
========================= */

function selectTop10Team(team) {
  ensureTop10RoundState()

  const round = top10State.round
  const otherTeam = getOtherTeam(team)
  const teamErrors = Number(top10State.errors?.[round]?.[team] || 0)
  const otherErrors = Number(top10State.errors?.[round]?.[otherTeam] || 0)

  if (teamErrors >= 3) {
    showGameToast("هذا الفريق أكمل أخطاءه الثلاث")
    return
  }

  if (top10State.lastTeam === team && teamErrors < 3) {
    showGameToast("لا يمكن لنفس الفريق اللعب مرتين متتاليتين قبل اكتمال أخطائه الثلاث")
    return
  }

  if (teamErrors > otherErrors && otherErrors < 3) {
    showGameToast("الدور للفريق الذي لديه أخطاء أقل")
    return
  }

  if (top10State.activeTeam === team) return

  pushTop10History()

  top10State.activeTeam = team
  autoStartTop10Timer()
  highlightTop10TurnTeam()
  updateTop10TurnLabel()
  updateTop10DoubleButton()
  saveTop10State()
}

function highlightTop10TurnTeam() {
  const a = document.getElementById("top10TeamA")
  const b = document.getElementById("top10TeamB")

  if (!a || !b) return

  a.classList.remove("activeTeam")
  b.classList.remove("activeTeam")

  if (top10State.activeTeam === "A") a.classList.add("activeTeam")
  if (top10State.activeTeam === "B") b.classList.add("activeTeam")

  updateTop10DoubleButton()
}

function updateTop10TurnLabel() {
  const label = document.getElementById("top10TurnLabel")
  if (!label) return

  label.innerText =
    top10State.activeTeam === "A"
      ? teamAName
      : top10State.activeTeam === "B"
      ? teamBName
      : "اختر فريق"
}

async function openTop10Number(num) {
  ensureTop10RoundState()

  const round = top10State.round

  if (!top10State.activeTeam) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  if (top10State.opened[round].includes(num)) return

  const { data, error } = await db
    .from("top10_questions")
    .select("*")
    .eq("model", currentModel)
    .eq("round", round)
    .eq("position", num)
    .single()

  if (error) {
    console.log(error)
    showGameToast("تعذر تحميل الإجابة")
    return
  }

  if (!data) {
    showGameToast("لا توجد إجابة لهذا الرقم")
    return
  }

  pushTop10History()

  currentTop10Number = num
  currentTop10Answer = data.answer || ""

  top10State.opened[round].push(num)
  top10State.answers[round][num] = data.answer || ""

  const team = top10State.activeTeam
  const points = getTop10ScoreValue(team, num)

  if (team === "A") top10State.scores.A += points
  if (team === "B") top10State.scores.B += points

  clearTop10ActiveDouble()

  playGameSound("correct")
  top10AnimatingNumber = num
  top10State.lastTeam = team

  const otherTeam = getOtherTeam(team)

  if (top10State.errors[round][otherTeam] < 3) {
    top10State.activeTeam = otherTeam
  } else if (top10State.errors[round][team] >= 3) {
    top10State.activeTeam = null
  }

  syncTop10Globals()

  if (top10State.activeTeam) {
    autoStartTop10Timer()
  } else {
    clearInterval(timer)
    timer = null
    top10TimerStarted = false
    top10LastTickPlayed = null

    const timerBox = document.getElementById("timer")
    if (timerBox) timerBox.innerText = 0
  }

  updateTop10UIOnly()
  saveTop10State()

  if (typeof updateEndRoundButtonState === "function") {
    updateEndRoundButtonState()
  }

  setTimeout(() => {
    top10AnimatingNumber = null
    updateTop10UIOnly()
    saveTop10State()

    if (typeof updateEndRoundButtonState === "function") {
      updateEndRoundButtonState()
    }
  }, 1400)
}

function showTop10Answer() {
  ensureTop10RoundState()

  const round = top10State.round
  const errorsA = Number(top10State.errors?.[round]?.A || 0)
  const errorsB = Number(top10State.errors?.[round]?.B || 0)

  if (errorsA < 3 || errorsB < 3) {
    showGameToast("لا يمكن إظهار جميع الإجابات إلا بعد اكتمال أخطاء الفريقين")
    return
  }

  revealAllTop10Answers()
}

async function revealAllTop10Answers() {
  ensureTop10RoundState()

  const round = top10State.round

  const { data, error } = await db
    .from("top10_questions")
    .select("*")
    .eq("model", currentModel)
    .eq("round", round)
    .order("position", { ascending: true })

  if (error) {
    console.log(error)
    showGameToast("تعذر إظهار الإجابات")
    return
  }

  pushTop10History()

  ;(data || []).forEach(item => {
    if (!top10State.opened[round].includes(item.position)) {
      top10State.opened[round].push(item.position)
    }

    top10State.answers[round][item.position] = item.answer || ""
  })

  top10AnimatingNumber = null

  syncTop10Globals()
  updateTop10UIOnly()
  saveTop10State()

  if (typeof updateEndRoundButtonState === "function") {
    updateEndRoundButtonState()
  }
}

function addTop10Error() {
  ensureTop10RoundState()

  const round = top10State.round
  const team = top10State.activeTeam

  if (!team) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  const current = Number(top10State.errors?.[round]?.[team] || 0)

  if (current >= 3) {
    showGameToast("هذا الفريق أكمل أخطاءه الثلاث")
    return
  }

  pushTop10History()

  clearTop10ActiveDouble()

  top10State.errors[round][team] += 1

  playGameSound("wrong")
  flashScreen("wrong")

  const otherTeam = getOtherTeam(team)

  if (top10State.errors[round][team] >= 3) {
    top10State.activeTeam =
      top10State.errors[round][otherTeam] < 3 ? otherTeam : null
  } else {
    top10State.activeTeam =
      top10State.errors[round][otherTeam] < 3 ? otherTeam : team
  }

  syncTop10Globals()
  updateTop10UIOnly()

  if (top10State.activeTeam) {
    autoStartTop10Timer()
  } else {
    clearInterval(timer)
    timer = null
    top10TimerStarted = false
    top10LastTickPlayed = null

    const timerBox = document.getElementById("timer")
    if (timerBox) timerBox.innerText = 0
  }

  saveTop10State()

  if (typeof updateEndRoundButtonState === "function") {
    updateEndRoundButtonState()
  }
}

/* =========================
   Timer
========================= */

function startTop10TimerButton() {
  if (!top10State.activeTeam) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  if (top10TimerStarted) return

  pushTop10History()

  top10TimerStarted = true
  startTop10Timer(TOP10_TIMER_SECONDS)
}

function startTop10Timer(seconds) {
  runTop10Timer(seconds)
}

function resumeTop10Timer(seconds) {
  runTop10Timer(seconds)
}

function runTop10Timer(seconds) {
  const timerBox = document.getElementById("timer")
  if (!timerBox) return

  clearInterval(timer)
  timer = null

  let time = Number(seconds || 0)
  top10LastTickPlayed = null
  timerBox.innerText = time
  saveTop10State()

  timer = setInterval(() => {
    time--
    timerBox.innerText = time

    if (time > 0 && time <= 5 && top10LastTickPlayed !== time) {
      top10LastTickPlayed = time
      playGameSound("tick")
    }

    saveTop10State()

    if (time <= 0) {
      clearInterval(timer)
      timer = null
      timerBox.innerText = 0
      top10TimerStarted = false
      top10LastTickPlayed = null
      playGameSound("timeout")
      saveTop10State()
    }
  }, 1000)
}

/* =========================
   UI Updates
========================= */

function updateTop10Scores() {
  const a = document.getElementById("top10ScoreA")
  const b = document.getElementById("top10ScoreB")

  if (a) a.innerText = top10State.scores.A
  if (b) b.innerText = top10State.scores.B

  syncTop10Globals()
}

function updateTop10UIOnly() {
  ensureTop10RoundState()

  const round = top10State.round

  updateTop10Scores()

  const errorsA = document.getElementById("top10ErrorsA")
  const errorsB = document.getElementById("top10ErrorsB")

  if (errorsA) errorsA.innerHTML = renderTop10Errors("A")
  if (errorsB) errorsB.innerHTML = renderTop10Errors("B")

  highlightTop10TurnTeam()
  updateTop10TurnLabel()
  updateTop10DoubleButton()

  const questionBox = document.getElementById("top10QuestionBox")
  if (questionBox) {
    questionBox.innerText = top10State.question[round] || "السؤال يظهر هنا"
  }

  const roundLabel = document.getElementById("top10RoundLabel")
  if (roundLabel) {
    roundLabel.innerText = `الجولة ${round}`
  }

  const pageTitle = document.querySelector(".segmentTitle")
  if (pageTitle) {
    pageTitle.innerText = `Top 10 - الجولة ${round}`
  }

  const rightSide = [1, 2, 3, 4, 5]
  const leftSide = [6, 7, 8, 9, 10]

  const rightCol = document.querySelector(".top10RightSide")
  const leftCol = document.querySelector(".top10LeftSide")

  if (rightCol) {
    rightCol.innerHTML = rightSide
      .map(num => renderTop10Rect(num, top10State.opened[round]))
      .join("")
  }

  if (leftCol) {
    leftCol.innerHTML = leftSide
      .map(num => renderTop10Rect(num, top10State.opened[round]))
      .join("")
  }

  updateTop10UndoButtonState()
}

function renderCurrentRoundTop10UI() {
  ensureTop10RoundState()

  const round = top10State.round

  const roundLabel = document.getElementById("top10RoundLabel")
  if (roundLabel) roundLabel.innerText = `الجولة ${round}`

  const pageTitle = document.querySelector(".segmentTitle")
  if (pageTitle) pageTitle.innerText = `Top 10 - الجولة ${round}`

  const questionBox = document.getElementById("top10QuestionBox")
  if (questionBox) {
    questionBox.innerText = top10State.question[round] || "السؤال يظهر هنا"
  }

  const timerBox = document.getElementById("timer")
  if (timerBox && !top10TimerStarted) timerBox.innerText = 0

  updateTop10Scores()
  highlightTop10TurnTeam()
  updateTop10TurnLabel()
  updateTop10DoubleButton()

  const errorsA = document.getElementById("top10ErrorsA")
  const errorsB = document.getElementById("top10ErrorsB")

  if (errorsA) errorsA.innerHTML = renderTop10Errors("A")
  if (errorsB) errorsB.innerHTML = renderTop10Errors("B")

  const rightSide = [1, 2, 3, 4, 5]
  const leftSide = [6, 7, 8, 9, 10]

  const rightCol = document.querySelector(".top10RightSide")
  const leftCol = document.querySelector(".top10LeftSide")

  if (rightCol) {
    rightCol.innerHTML = rightSide
      .map(num => renderTop10Rect(num, top10State.opened[round]))
      .join("")
  }

  if (leftCol) {
    leftCol.innerHTML = leftSide
      .map(num => renderTop10Rect(num, top10State.opened[round]))
      .join("")
  }

  updateTop10UndoButtonState()
}

/* =========================
   Round Navigation
========================= */

function playTop10RoundTransition(callback) {
  callback()
}

async function nextTop10Round() {
  ensureTop10RoundState()

  const currentOpened = top10State.opened[top10State.round] || []

  if (currentOpened.length < 10) {
    showGameToast("افتح جميع الأرقام أولاً")
    return
  }

  if (top10State.round >= top10MaxRound) {
    showGameToast("هذه آخر جولة")
    return
  }

  pushTop10History()

  playTop10RoundTransition(async () => {
    top10State.round += 1
    top10State.activeTeam = null
    top10State.lastTeam = null
    currentTop10Answer = null
    currentTop10Number = null
    top10TimerStarted = false
    top10LastTickPlayed = null
    top10AnimatingNumber = null
    top10DoubleState.activeTeam = null

    clearInterval(timer)
    timer = null

    await loadTop10RoundQuestion(top10State.round)

    syncTop10Globals()
    renderCurrentRoundTop10UI()
    saveTop10State()

    if (typeof updateEndRoundButtonState === "function") {
      updateEndRoundButtonState()
    }
  })
}

async function prevTop10Round() {
  ensureTop10RoundState()

  if (top10State.round <= 1) {
    showGameToast("هذه أول جولة")
    return
  }

  pushTop10History()

  playTop10RoundTransition(async () => {
    top10State.round -= 1
    top10State.activeTeam = null
    top10State.lastTeam = null
    currentTop10Answer = null
    currentTop10Number = null
    top10TimerStarted = false
    top10LastTickPlayed = null
    top10AnimatingNumber = null
    top10DoubleState.activeTeam = null

    clearInterval(timer)
    timer = null

    await loadTop10RoundQuestion(top10State.round)

    syncTop10Globals()
    renderCurrentRoundTop10UI()
    saveTop10State()

    if (typeof updateEndRoundButtonState === "function") {
      updateEndRoundButtonState()
    }
  })
}

function switchTop10Turn() {
  ensureTop10RoundState()

  if (!top10State.activeTeam) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  const otherTeam = getOtherTeam(top10State.activeTeam)

  if (top10State.errors[top10State.round][otherTeam] >= 3) {
    showGameToast("الفريق الآخر أكمل أخطاءه الثلاث")
    return
  }

  pushTop10History()

  top10State.activeTeam = otherTeam
  autoStartTop10Timer()
  highlightTop10TurnTeam()
  updateTop10TurnLabel()
  updateTop10DoubleButton()
  saveTop10State()
}