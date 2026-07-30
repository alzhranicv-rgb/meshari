/* =========================================================
   RANDOM CHALLENGE / التحدي
   DISPLAY ONLY - CLEAN FINAL
========================================================= */

/* =========================
   1) CONSTANTS
========================= */

const RANDOM_CHALLENGE_STORAGE_KEY = "random_challenge_state_v1"
const RANDOM_MEDIA_CACHE_KEY = "random_media_cache_v1"
const RANDOM_MEDIA_CACHE_TTL = 24 * 60 * 60 * 1000

const RANDOM_CHALLENGE_BOXES = Object.freeze([1, 2, 3, 4, 5])

const RANDOM_BOX2_QUESTIONS_COUNT = 2
const RANDOM_BOX2_TIMER_SECONDS = 30

const RANDOM_BOX3_QUESTIONS_COUNT = 2
const RANDOM_BOX3_TIMER_SECONDS = 5

const RANDOM_BOX4_QUESTIONS_COUNT = 10
const RANDOM_BOX4_TIMER_SECONDS = 10
const RANDOM_BOX4_TEAM_QUESTIONS_COUNT = 5

const RANDOM_BOX1_RECENT_TEAMS_LIMIT = 4
const RANDOM_BOX5_BLOCK_TIMER_SECONDS = 20

/* =========================
   2) RUNTIME
========================= */

let randomChallengeState = createDefaultRandomChallengeState()
window.randomChallengeState = randomChallengeState

let randomChallengeSettings = {
  box1: true,
  box2: true,
  box3: true,
  box4: true,
  box5: true,
  fatblaCount: 5,
}

let randomChallengeQuestions = {
  auction: [],
  whatDoYouKnow: [],
  trueFalse: [],
}

let randomFatblaItems = []

let randomChallengeDataLoaded = false
let randomChallengeDataPromise = null

let randomMediaItems = []
let randomBox1PreloadedImages = []
let randomMediaLoaded = false
let randomMediaLoadPromise = null

let randomBox1RouletteTimer = null
let randomBox2Timer = null
let randomBox3Timer = null
let randomBox4Timer = null
let randomBox5BlockTimer = null
let randomBox5ReturnTimer = null
let randomBox5CompensationPressTimer = null
let randomBox5CompensationPressActivated = false

/* =========================
   3) DEFAULT STATE
========================= */

function createRandomTimerSync() {
  return {
    startedAt: 0,
    endsAt: 0,
    duration: 0,
  }
}

function createDefaultRandomChallengeState() {
  const createBoxResult = () => ({
    scores: {
      A: 0,
      B: 0,
    },
    winner: null,
    finishedAt: null,
  })

  return {
    scores: {
      A: 0,
      B: 0,
    },

    boxWins: {
      A: 0,
      B: 0,
    },

    segmentWinner: null,
    activeTeam: null,
    currentBox: null,
    completed: false,
    usedMediaIds: [],

    box1: {
      ...createBoxResult(),
      active: false,
      started: false,
      rolling: false,
      flashing: false,
      finished: false,
      pool: "",
      images: [],
      recentTeamKeys: [],
    },

    box2: {
      ...createBoxResult(),
      active: false,
      finished: false,
      currentQuestionNumber: 1,
      question: "",
      answer: "",
      numberInput: "",
      currentCount: 0,
      points: 0,
      calculatedPoints: 0,
      timer: RANDOM_BOX2_TIMER_SECONDS,
      timerRunning: false,
      started: false,
      timerSync: createRandomTimerSync(),
    },

    box3: {
      ...createBoxResult(),
      active: false,
      finished: false,
      currentQuestionNumber: 1,
      question: "",
      activeTeam: null,
      scoringTeam: null,
      scoringBoth: false,
      errors: {
        A: 0,
        B: 0,
      },
      passUsed: {
        A: false,
        B: false,
      },
      lastAction: null,
      timer: RANDOM_BOX3_TIMER_SECONDS,
      timerRunning: false,
      choosingPoints: false,
      timerSync: createRandomTimerSync(),
    },

    box4: {
      ...createBoxResult(),
      active: false,
      finished: false,
      started: false,
      startingTeam: null,
      activeTeam: null,
      secondTeamBreak: false,
      currentQuestionNumber: 1,
      timer: RANDOM_BOX4_TIMER_SECONDS,
      timerRunning: false,
      timerSync: createRandomTimerSync(),
      revealed: false,
      reviewMode: false,
      selectedAnswer: "",
      currentWasCorrect: null,
      results: [],
    },

    box5: {
      ...createBoxResult(),
      active: false,
      finished: false,
      currentNumber: null,
      openedNumbers: [],
      revealedAnswer: false,
      compensationActive: false,
      compensationNumber: null,
      blockTimerVisible: false,
      blockTimerRunning: false,
      blockArmed: false,
      blockTimer: RANDOM_BOX5_BLOCK_TIMER_SECONDS,
      blockTimerSync: createRandomTimerSync(),
    },
  }
}

/* =========================
   4) BASIC HELPERS
========================= */

function isValidRandomChallengeTeam(team) {
  return team === "A" || team === "B"
}

function getOtherRandomChallengeTeam(team) {
  if (team === "A") return "B"
  if (team === "B") return "A"
  return null
}

function normalizeRandomChallengeBoxNumber(number) {
  const value = Number(number || 0)
  return RANDOM_CHALLENGE_BOXES.includes(value) ? value : 0
}

function getRandomChallengeBoxKey(number) {
  const boxNumber = normalizeRandomChallengeBoxNumber(number)
  return boxNumber ? `box${boxNumber}` : ""
}

function getRandomChallengeBoxState(number) {
  const key = getRandomChallengeBoxKey(number)
  return key ? randomChallengeState[key] || null : null
}

function getRandomChallengeBoxTitle(number) {
  const titles = {
    1: "اللاعب المشترك",
    2: "المزاد",
    3: "ماذا تعرف",
    4: "صح أو خطأ",
    5: "فتبلة",
  }

  return titles[normalizeRandomChallengeBoxNumber(number)] || "التحدي"
}

function getRandomChallengeTeamName(team) {
  if (team === "A") return teamAName || "الفريق الأول"
  if (team === "B") return teamBName || "الفريق الثاني"
  return ""
}

function getRandomChallengeBoxScores(number = randomChallengeState.currentBox) {
  const boxState = getRandomChallengeBoxState(number)

  return {
    A: Number(boxState?.scores?.A || 0),
    B: Number(boxState?.scores?.B || 0),
  }
}

function getRandomChallengeTeamScore(team, number = randomChallengeState.currentBox) {
  if (!isValidRandomChallengeTeam(team)) return 0

  const boxState = getRandomChallengeBoxState(number)
  return Number(boxState?.scores?.[team] || 0)
}

function setRandomChallengeTeamScore(team, value, number = randomChallengeState.currentBox) {
  if (!isValidRandomChallengeTeam(team)) return

  const boxState = getRandomChallengeBoxState(number)
  if (!boxState) return

  if (!boxState.scores || typeof boxState.scores !== "object") {
    boxState.scores = {
      A: 0,
      B: 0,
    }
  }

  boxState.scores[team] = Number(value || 0)
}

function addRandomChallengeTeamScore(team, points, number = randomChallengeState.currentBox) {
  if (!isValidRandomChallengeTeam(team)) return

  setRandomChallengeTeamScore(
    team,
    getRandomChallengeTeamScore(team, number) + Number(points || 0),
    number,
  )
}

function calculateRandomChallengeBoxWinner(number) {
  const scores = getRandomChallengeBoxScores(number)

  if (scores.A > scores.B) return "A"
  if (scores.B > scores.A) return "B"
  return "draw"
}

function calculateRandomChallengeBoxWins() {
  const wins = {
    A: 0,
    B: 0,
  }

  RANDOM_CHALLENGE_BOXES.forEach(number => {
    if (!isRandomChallengeBoxEnabled(number)) return

    const boxState = getRandomChallengeBoxState(number)
    if (!boxState?.finished) return

    if (boxState.winner === "A") wins.A += 1
    if (boxState.winner === "B") wins.B += 1
  })

  randomChallengeState.boxWins = {
    A: wins.A,
    B: wins.B,
  }

  window.currentSegmentScores = {
    A: wins.A,
    B: wins.B,
  }

  return randomChallengeState.boxWins
}

function calculateRandomChallengeSegmentWinner() {
  const wins = calculateRandomChallengeBoxWins()

  let winner = "draw"

  if (wins.A > wins.B) {
    winner = "A"
  } else if (wins.B > wins.A) {
    winner = "B"
  }

  randomChallengeState.segmentWinner = winner
  return winner
}

function getRandomChallengeBoxWinnerText(number) {
  const boxState = getRandomChallengeBoxState(number)

  if (!boxState?.finished) return ""

  if (boxState.winner === "A" || boxState.winner === "B") {
    return `الفائز: ${getRandomChallengeTeamName(boxState.winner)}`
  }

  return "تعادل"
}

function getRandomChallengeEnabledCount() {
  return RANDOM_CHALLENGE_BOXES.filter(number => {
    return isRandomChallengeBoxEnabled(number)
  }).length
}

function getRandomChallengeCompletedCount() {
  return RANDOM_CHALLENGE_BOXES.reduce((total, number) => {
    if (!isRandomChallengeBoxEnabled(number)) return total
    return total + (getRandomChallengeBoxState(number)?.finished ? 1 : 0)
  }, 0)
}

function isRandomChallengeBoxEnabled(number) {
  const boxNumber = normalizeRandomChallengeBoxNumber(number)
  if (!boxNumber) return false

  return randomChallengeSettings[`box${boxNumber}`] !== false
}

function playRandomChallengeFeedback(type) {
  if (typeof flashScreen === "function") {
    flashScreen(type)
  }

  if (typeof playGameSound === "function") {
    playGameSound(type)
  }
}

function renderRandomChallengeUI(options = {}) {
  const {
    header = true,
    scores = true,
    stage = true,
    controls = true,
  } = options

  if (header) renderRandomChallengeHeader()
  if (scores) renderRandomChallengeScores()
  if (stage) renderRandomChallengeStage()
  if (controls) renderRandomChallengeControls()
}

/* =========================
   5) TIMER HELPERS
========================= */

function normalizeRandomTimerSync(value) {
  return {
    startedAt: Number(value?.startedAt || 0),
    endsAt: Number(value?.endsAt || 0),
    duration: Number(value?.duration || 0),
  }
}

function setRandomTimerSync(target, duration, key = "timerSync") {
  if (!target) return

  const seconds = Math.max(0, Number(duration || 0))
  const startedAt = Date.now()

  target[key] = {
    startedAt,
    endsAt: seconds > 0 ? startedAt + seconds * 1000 : 0,
    duration: seconds,
  }
}

function clearRandomTimerSync(target, key = "timerSync") {
  if (!target) return
  target[key] = createRandomTimerSync()
}

function stopRandomBox1Roulette() {
  if (!randomBox1RouletteTimer) return

  clearInterval(randomBox1RouletteTimer)
  randomBox1RouletteTimer = null
}

function stopRandomBox2Timer() {
  if (randomBox2Timer) {
    clearInterval(randomBox2Timer)
    randomBox2Timer = null
  }

  if (randomChallengeState?.box2) {
    randomChallengeState.box2.timerRunning = false
    clearRandomTimerSync(randomChallengeState.box2)
  }
}

function stopRandomBox3Timer() {
  if (randomBox3Timer) {
    clearInterval(randomBox3Timer)
    randomBox3Timer = null
  }

  if (randomChallengeState?.box3) {
    randomChallengeState.box3.timerRunning = false
    clearRandomTimerSync(randomChallengeState.box3)
  }
}

function stopRandomBox4Timer() {
  if (randomBox4Timer) {
    clearInterval(randomBox4Timer)
    randomBox4Timer = null
  }

  if (randomChallengeState?.box4) {
    randomChallengeState.box4.timerRunning = false
    clearRandomTimerSync(randomChallengeState.box4)
  }
}

function stopRandomBox5ReturnTimer() {
  if (!randomBox5ReturnTimer) return

  clearTimeout(randomBox5ReturnTimer)
  randomBox5ReturnTimer = null
}

function stopRandomBox5BlockTimer() {
  if (randomBox5BlockTimer) {
    clearInterval(randomBox5BlockTimer)
    randomBox5BlockTimer = null
  }

  if (randomChallengeState?.box5) {
    randomChallengeState.box5.blockTimerRunning = false
    clearRandomTimerSync(randomChallengeState.box5, "blockTimerSync")
  }
}

function stopAllRandomChallengeTimers() {
  stopRandomBox1Roulette()
  stopRandomBox2Timer()
  stopRandomBox3Timer()
  stopRandomBox4Timer()
  stopRandomBox5BlockTimer()
  stopRandomBox5ReturnTimer()
  clearRandomBox5CompensationPress()
}

/* =========================
   6) STORAGE
========================= */

function getRandomChallengeState() {
  try {
    const raw = localStorage.getItem(RANDOM_CHALLENGE_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch (error) {
    console.log("RANDOM CHALLENGE STATE READ ERROR:", error)
    return null
  }
}

function normalizeRandomChallengeState(savedState) {
  const defaults = createDefaultRandomChallengeState()

  if (!savedState || typeof savedState !== "object") {
    return defaults
  }

  const normalized = {
    ...defaults,
    ...savedState,
    scores: {
      ...defaults.scores,
      ...(savedState.scores || {}),
    },
    boxWins: {
      ...defaults.boxWins,
      ...(savedState.boxWins || {}),
    },
    box1: {
      ...defaults.box1,
      ...(savedState.box1 || {}),
    },
    box2: {
      ...defaults.box2,
      ...(savedState.box2 || {}),
    },
    box3: {
      ...defaults.box3,
      ...(savedState.box3 || {}),
      errors: {
        ...defaults.box3.errors,
        ...(savedState.box3?.errors || {}),
      },
      passUsed: {
        ...defaults.box3.passUsed,
        ...(savedState.box3?.passUsed || {}),
      },
    },
    box4: {
      ...defaults.box4,
      ...(savedState.box4 || {}),
    },
    box5: {
      ...defaults.box5,
      ...(savedState.box5 || {}),
    },
  }

  normalized.scores.A = Number(normalized.scores.A || 0)
  normalized.scores.B = Number(normalized.scores.B || 0)

  normalized.boxWins.A = Number(normalized.boxWins.A || 0)
  normalized.boxWins.B = Number(normalized.boxWins.B || 0)

  normalized.segmentWinner = ["A", "B", "draw"].includes(savedState.segmentWinner)
    ? savedState.segmentWinner
    : null

  normalized.activeTeam = isValidRandomChallengeTeam(normalized.activeTeam)
    ? normalized.activeTeam
    : null

  normalized.currentBox = normalizeRandomChallengeBoxNumber(normalized.currentBox) || null
  normalized.completed = !!normalized.completed
  normalized.usedMediaIds = Array.isArray(normalized.usedMediaIds) ? normalized.usedMediaIds : []

  RANDOM_CHALLENGE_BOXES.forEach(number => {
    const key = getRandomChallengeBoxKey(number)
    const boxState = normalized[key]
    const savedBox = savedState[key] || {}

    boxState.scores = {
      A: Number(savedBox?.scores?.A || 0),
      B: Number(savedBox?.scores?.B || 0),
    }

    boxState.winner = ["A", "B", "draw"].includes(savedBox?.winner)
      ? savedBox.winner
      : null

    boxState.finishedAt = savedBox?.finishedAt || null
    boxState.finished = !!savedBox?.finished
    boxState.active = !!savedBox?.active
  })

  normalized.box1.started = !!normalized.box1.started
  normalized.box1.rolling = false
  normalized.box1.flashing = false
  normalized.box1.pool = normalizeRandomBox1Pool(normalized.box1.pool)
  normalized.box1.images = Array.isArray(normalized.box1.images) ? normalized.box1.images : []
  normalized.box1.recentTeamKeys = Array.isArray(normalized.box1.recentTeamKeys)
    ? normalized.box1.recentTeamKeys.slice(0, RANDOM_BOX1_RECENT_TEAMS_LIMIT)
    : []

  normalized.box2.currentQuestionNumber = Math.min(
    Math.max(Number(normalized.box2.currentQuestionNumber || 1), 1),
    RANDOM_BOX2_QUESTIONS_COUNT,
  )
  normalized.box2.question = String(normalized.box2.question || "")
  normalized.box2.answer = String(normalized.box2.answer || "")
  normalized.box2.numberInput = String(normalized.box2.numberInput || "").replace(/\D/g, "").slice(0, 5)
  normalized.box2.currentCount = Math.max(0, Number(normalized.box2.currentCount || 0))
  normalized.box2.points = Math.max(0, Number(normalized.box2.points || 0))
  normalized.box2.calculatedPoints = Math.max(0, Number(normalized.box2.calculatedPoints || 0))
  normalized.box2.timer = Math.max(0, Number(normalized.box2.timer ?? RANDOM_BOX2_TIMER_SECONDS))
  normalized.box2.timerRunning = false
  normalized.box2.started = !!normalized.box2.started
  normalized.box2.timerSync = normalizeRandomTimerSync(normalized.box2.timerSync)
  clearRandomTimerSync(normalized.box2)

  normalized.box3.currentQuestionNumber = Math.min(
    Math.max(Number(normalized.box3.currentQuestionNumber || 1), 1),
    RANDOM_BOX3_QUESTIONS_COUNT,
  )
  normalized.box3.question = String(normalized.box3.question || "")
  normalized.box3.activeTeam = isValidRandomChallengeTeam(normalized.box3.activeTeam) ? normalized.box3.activeTeam : null
  normalized.box3.scoringTeam = isValidRandomChallengeTeam(normalized.box3.scoringTeam) ? normalized.box3.scoringTeam : null
  normalized.box3.scoringBoth = !!normalized.box3.scoringBoth
  normalized.box3.errors.A = Math.min(3, Math.max(0, Number(normalized.box3.errors.A || 0)))
  normalized.box3.errors.B = Math.min(3, Math.max(0, Number(normalized.box3.errors.B || 0)))
  normalized.box3.passUsed.A = !!normalized.box3.passUsed.A
  normalized.box3.passUsed.B = !!normalized.box3.passUsed.B
  normalized.box3.lastAction = normalized.box3.lastAction === "pass" || normalized.box3.lastAction === "wrong"
    ? normalized.box3.lastAction
    : null
  normalized.box3.timer = Math.max(0, Number(normalized.box3.timer ?? RANDOM_BOX3_TIMER_SECONDS))
  normalized.box3.timerRunning = false
  normalized.box3.choosingPoints = !!normalized.box3.choosingPoints
  normalized.box3.timerSync = normalizeRandomTimerSync(normalized.box3.timerSync)
  clearRandomTimerSync(normalized.box3)

  normalized.box4.started = !!normalized.box4.started
  normalized.box4.startingTeam = isValidRandomChallengeTeam(normalized.box4.startingTeam)
    ? normalized.box4.startingTeam
    : null
  normalized.box4.currentQuestionNumber = Math.min(
    Math.max(Number(normalized.box4.currentQuestionNumber || 1), 1),
    RANDOM_BOX4_QUESTIONS_COUNT,
  )
  normalized.box4.activeTeam = isValidRandomChallengeTeam(normalized.box4.activeTeam)
    ? normalized.box4.activeTeam
    : null
  normalized.box4.secondTeamBreak = !!normalized.box4.secondTeamBreak
  normalized.box4.timer = Math.max(0, Number(normalized.box4.timer ?? RANDOM_BOX4_TIMER_SECONDS))
  normalized.box4.timerRunning = false
  normalized.box4.timerSync = normalizeRandomTimerSync(normalized.box4.timerSync)
  clearRandomTimerSync(normalized.box4)
  normalized.box4.revealed = !!normalized.box4.revealed
  normalized.box4.reviewMode = !!normalized.box4.reviewMode
  normalized.box4.selectedAnswer = String(normalized.box4.selectedAnswer || "")
  normalized.box4.currentWasCorrect = typeof normalized.box4.currentWasCorrect === "boolean"
    ? normalized.box4.currentWasCorrect
    : null
  normalized.box4.results = Array.isArray(normalized.box4.results)
    ? normalized.box4.results
        .map(result => ({
          number: Number(result?.number || 0),
          team: result?.team === "B" ? "B" : "A",
          question: String(result?.question || ""),
          selectedAnswer: String(result?.selectedAnswer || ""),
          correctAnswer: String(result?.correctAnswer || ""),
          explanation: String(result?.explanation || ""),
          isCorrect: !!result?.isCorrect,
          timedOut: !!result?.timedOut,
        }))
        .filter(result => result.number >= 1 && result.number <= RANDOM_BOX4_QUESTIONS_COUNT)
    : []

  if (normalized.box4.started && !normalized.box4.activeTeam && !normalized.box4.reviewMode) {
    normalized.box4.activeTeam = getRandomBox4CurrentTeamFromState(normalized.box4)
  }

  normalized.box5.currentNumber = Number(normalized.box5.currentNumber || 0) || null
  normalized.box5.openedNumbers = Array.isArray(normalized.box5.openedNumbers)
    ? [...new Set(normalized.box5.openedNumbers.map(Number).filter(number => number >= 1 && number <= 9))]
    : []
  normalized.box5.revealedAnswer = !!normalized.box5.revealedAnswer
  normalized.box5.compensationActive = !!normalized.box5.compensationActive
  normalized.box5.compensationNumber = Number(normalized.box5.compensationNumber || 0) || null

  if (!normalized.box5.compensationActive) {
    normalized.box5.compensationNumber = null
  }

  normalized.box5.blockTimerVisible = !!normalized.box5.blockTimerVisible
  normalized.box5.blockTimerRunning = false
  normalized.box5.blockTimerSync = normalizeRandomTimerSync(normalized.box5.blockTimerSync)
  normalized.box5.blockArmed =
  !!normalized.box5.blockArmed

if (normalized.box5.blockTimerRunning) {
  normalized.box5.blockArmed = true
}
  clearRandomTimerSync(normalized.box5, "blockTimerSync")
  normalized.box5.blockTimer = Math.max(
    0,
    Math.min(
      RANDOM_BOX5_BLOCK_TIMER_SECONDS,
      Number(normalized.box5.blockTimer ?? RANDOM_BOX5_BLOCK_TIMER_SECONDS),
    ),
  )

  if (normalized.box5.blockTimerVisible && normalized.box5.blockTimer <= 0) {
    normalized.box5.blockTimerVisible = false
    normalized.box5.blockTimer = RANDOM_BOX5_BLOCK_TIMER_SECONDS
  }

  randomChallengeState = normalized
  calculateRandomChallengeBoxWins()

  return normalized
}

function updateRandomChallengeWindowState() {
  window.randomChallengeState = randomChallengeState

  const boxWins = calculateRandomChallengeBoxWins()

  window.currentSegmentScores = {
    A: Number(boxWins.A || 0),
    B: Number(boxWins.B || 0),
  }
}

function saveRandomChallengeState(options = {}) {
  const shouldSync = options.sync !== false
  const immediate = options.immediate === true

  try {
    localStorage.setItem(
      RANDOM_CHALLENGE_STORAGE_KEY,
      JSON.stringify(randomChallengeState),
    )
  } catch (error) {
    console.log("RANDOM CHALLENGE STATE SAVE ERROR:", error)
  }

  updateRandomChallengeWindowState()

  if (shouldSync) {
    if (typeof saveUnifiedGameState === "function") {
      saveUnifiedGameState()
    }

    if (typeof syncDisplayStateToSession === "function") {
      syncDisplayStateToSession({ immediate })
    }
  }

  if (typeof updateEndRoundButtonState === "function") {
    updateEndRoundButtonState()
  }
}

function restoreRandomChallengeState() {
  stopAllRandomChallengeTimers()
  randomChallengeState = normalizeRandomChallengeState(getRandomChallengeState())
  updateRandomChallengeWindowState()
}

function resetRandomChallengeState(options = {}) {
  stopAllRandomChallengeTimers()
  randomChallengeState = createDefaultRandomChallengeState()
  updateRandomChallengeWindowState()
  saveRandomChallengeState({ sync: options.sync !== false })
}

/* =========================
   7) SETTINGS AND DATA
========================= */

function normalizeRandomChallengeFatblaCount(value) {
  const count = Number(value || 5)

  if (count === 9) return 9
  if (count === 7) return 7
  return 5
}

function getRandomChallengeModelId() {
  return Number(
    window.currentModel ||
    window.gameModel ||
    localStorage.getItem("game_model") ||
    0,
  )
}

function normalizeRandomChallengeQuestionKey(value) {
  const key = String(value || "").trim()

  const aliases = {
    auction: "auction",
    randomChallengeAuction: "auction",
    whatDoYouKnow: "whatDoYouKnow",
    what_do_you_know: "whatDoYouKnow",
    randomChallengeWhatDoYouKnow: "whatDoYouKnow",
    trueFalse: "trueFalse",
    true_false: "trueFalse",
    randomChallengeTrueFalse: "trueFalse",
  }

  return aliases[key] || key
}

function getRandomChallengeQuestion(boxKey, number) {
  const key = normalizeRandomChallengeQuestionKey(boxKey)
  const rows = randomChallengeQuestions[key]

  if (!Array.isArray(rows)) {
    console.warn("RANDOM QUESTION GROUP NOT FOUND:", key)
    return null
  }

  const questionNumber = Number(number || 0)

  return rows.find(row => Number(row.number || 0) === questionNumber) || null
}

function getRandomFatblaItem(number) {
  const target = Number(number || 0)

  return randomFatblaItems.find(row => Number(row.number || 0) === target) || null
}

function createRandomChallengeSettingsMap(rows) {
  const map = {}

  ;(Array.isArray(rows) ? rows : []).forEach(row => {
    const key = String(row?.segment || "").trim()
    if (!key) return

    map[key] = Number(row?.item_count || 0)
  })

  return map
}

function applyRandomChallengeSettings(rows) {
  const settingsMap = createRandomChallengeSettingsMap(rows)

  randomChallengeSettings = {
    box1: settingsMap.randomChallengeBox1 !== 0,
    box2: settingsMap.randomChallengeBox2 !== 0,
    box3: settingsMap.randomChallengeBox3 !== 0,
    box4: settingsMap.randomChallengeBox4 !== 0,
    box5: settingsMap.randomChallengeAuction !== 0,
    fatblaCount: normalizeRandomChallengeFatblaCount(settingsMap.auction || 5),
  }
}

function applyRandomChallengeQuestions(rows) {
  randomChallengeQuestions = {
    auction: [],
    whatDoYouKnow: [],
    trueFalse: [],
  }

  ;(Array.isArray(rows) ? rows : []).forEach(row => {
    const key = normalizeRandomChallengeQuestionKey(row?.box_key)

    if (!Array.isArray(randomChallengeQuestions[key])) {
      console.warn("UNKNOWN RANDOM BOX KEY:", key, row)
      return
    }

    randomChallengeQuestions[key].push({
      ...row,
      box_key: key,
      number: Number(row?.number || 0),
      question: String(row?.question || "").trim(),
      answer: String(row?.answer || "").trim(),
      explanation: String(row?.explanation || row?.note || "").trim(),
    })
  })

  Object.values(randomChallengeQuestions).forEach(rowsList => {
    rowsList.sort((a, b) => Number(a.number || 0) - Number(b.number || 0))
  })
}

function applyRandomFatblaItems(rows) {
  const total = normalizeRandomChallengeFatblaCount(randomChallengeSettings.fatblaCount)

  randomFatblaItems = (Array.isArray(rows) ? rows : [])
    .map(row => ({
      ...row,
      number: Number(row?.number || 0),
      question: String(row?.question || "").trim(),
      answer: String(row?.answer || "").trim(),
      image: String(row?.image || "").trim(),
      video: String(row?.video || "").trim(),
      note: String(row?.note || "").trim(),
    }))
    .filter(row => row.number >= 1 && row.number <= total)
    .sort((a, b) => a.number - b.number)
    .slice(0, total)
}

async function loadRandomChallengeGameData(options = {}) {
  const forceRefresh = options.forceRefresh === true

  if (randomChallengeDataLoaded && !forceRefresh) return true
  if (randomChallengeDataPromise && !forceRefresh) return randomChallengeDataPromise

  const modelId = getRandomChallengeModelId()

  if (!modelId) {
    showGameToast("تعذر تحديد النموذج")
    return false
  }

  randomChallengeDataPromise = (async () => {
    try {
      const [settingsResult, questionsResult, fatblaResult] = await Promise.all([
        db
          .from("segment_settings")
          .select("segment,item_count")
          .eq("model", modelId)
          .in("segment", [
            "randomChallengeBox1",
            "randomChallengeBox2",
            "randomChallengeBox3",
            "randomChallengeBox4",
            "randomChallengeAuction",
            "auction",
          ]),

        db
          .from("random_challenge_questions")
          .select("id,box_key,number,question,answer,explanation")
          .eq("model", modelId)
          .order("box_key", { ascending: true })
          .order("number", { ascending: true }),

        db
          .from("auction_questions")
          .select("id,number,question,answer,image,video,note")
          .eq("model", modelId)
          .order("number", { ascending: true }),
      ])

      if (settingsResult.error) throw settingsResult.error
      if (questionsResult.error) throw questionsResult.error
      if (fatblaResult.error) throw fatblaResult.error

      applyRandomChallengeSettings(settingsResult.data)
      applyRandomChallengeQuestions(questionsResult.data)
      applyRandomFatblaItems(fatblaResult.data)

      randomChallengeDataLoaded = true
      return true
    } catch (error) {
      console.log("LOAD RANDOM CHALLENGE DATA ERROR:", error)
      randomChallengeDataLoaded = false
      showGameToast("تعذر تحميل بيانات التحدي")
      return false
    } finally {
      randomChallengeDataPromise = null
    }
  })()

  return randomChallengeDataPromise
}

/* =========================
   8) MEDIA CACHE
========================= */

function readRandomMediaCache() {
  try {
    const raw = localStorage.getItem(RANDOM_MEDIA_CACHE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw)

    if (!parsed || !Array.isArray(parsed.data)) {
      localStorage.removeItem(RANDOM_MEDIA_CACHE_KEY)
      return null
    }

    const savedAt = Number(parsed.savedAt || 0)
    const age = Date.now() - savedAt

    if (age < 0 || age >= RANDOM_MEDIA_CACHE_TTL) {
      localStorage.removeItem(RANDOM_MEDIA_CACHE_KEY)
      return null
    }

    return parsed.data
  } catch (error) {
    console.log("RANDOM MEDIA CACHE READ ERROR:", error)
    return null
  }
}

function writeRandomMediaCache(data) {
  try {
    localStorage.setItem(
      RANDOM_MEDIA_CACHE_KEY,
      JSON.stringify({
        data: Array.isArray(data) ? data : [],
        savedAt: Date.now(),
      }),
    )
  } catch (error) {
    console.log("RANDOM MEDIA CACHE WRITE ERROR:", error)
  }
}

async function loadRandomMediaItems(options = {}) {
  const forceRefresh = options.forceRefresh === true

  if (randomMediaLoaded && !forceRefresh) {
    return {
      data: randomMediaItems,
      error: null,
      source: "memory",
    }
  }

  if (randomMediaLoadPromise && !forceRefresh) return randomMediaLoadPromise

  const cachedData = forceRefresh ? null : readRandomMediaCache()

  if (Array.isArray(cachedData) && cachedData.length) {
    randomMediaItems = cachedData
    randomMediaLoaded = true
    preloadRandomBox1Images()

    return {
      data: randomMediaItems,
      error: null,
      source: "cache",
    }
  }

  randomMediaLoadPromise = (async () => {
    try {
      const response = await fetch("assets/data/random_media.json", {
        cache: "force-cache",
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const json = await response.json()

      randomMediaItems = Array.isArray(json)
        ? json.filter(item => item && item.image)
        : []

      randomMediaLoaded = true
      writeRandomMediaCache(randomMediaItems)
      preloadRandomBox1Images()

      return {
        data: randomMediaItems,
        error: null,
        source: "network",
      }
    } catch (error) {
      console.log("RANDOM MEDIA JSON ERROR:", error)

      randomMediaItems = []
      randomMediaLoaded = false

      return {
        data: [],
        error,
        source: "error",
      }
    } finally {
      randomMediaLoadPromise = null
    }
  })()

  return randomMediaLoadPromise
}

/* =========================
   9) BOX 1 MEDIA HELPERS
========================= */

function preloadRandomBox1Images() {
  randomBox1PreloadedImages = []

  randomMediaItems.forEach(item => {
    const source = String(item?.image || "").trim()
    if (!source) return

    const image = new Image()
    image.src = source

    randomBox1PreloadedImages.push({
      ...item,
      image: source,
      preloadedSrc: source,
    })
  })
}

function normalizeRandomBox1Pool(pool) {
  return pool === "world" ? "world" : "saudi"
}

function getRandomBox1PoolTitle(pool) {
  return normalizeRandomBox1Pool(pool) === "world" ? "عالمي" : "الدوري السعودي"
}

function getRandomBox1PoolItems(pool = "saudi") {
  const safePool = normalizeRandomBox1Pool(pool)
  const shared = window.randomSharedPlayerMedia || {}
  const sharedList = Array.isArray(shared[safePool]) ? shared[safePool] : []

  if (sharedList.length >= 2) {
    return sharedList.filter(Boolean).map((source, index) => ({
      id: `${safePool}_${index + 1}`,
      image: String(source),
    }))
  }

  if (randomBox1PreloadedImages.length >= 2) return randomBox1PreloadedImages
  return randomMediaItems
}

function getRandomBox1ImageName(item) {
  const raw = item?.image || item?.name || item?.title || ""

  return String(raw)
    .split("/")
    .pop()
    .split("\\")
    .pop()
    .replace(/\.[a-z0-9]+$/i, "")
    .trim()
}

function randomBox1ImageNameHasNumber(item) {
  return /[0-9٠-٩]/.test(getRandomBox1ImageName(item))
}

function isSpecialImage(item) {
  return randomBox1ImageNameHasNumber(item)
}

function getRandomFromList(list) {
  if (!Array.isArray(list) || !list.length) return null
  return list[Math.floor(Math.random() * list.length)] || null
}

function getRandomBox1ItemKey(item) {
  if (!item) return ""
  if (item.id !== undefined && item.id !== null) return String(item.id)
  return String(item.image || "")
}

function getRandomBox1TeamKey(item) {
  return getRandomBox1ImageName(item)
    .toLowerCase()
    .replace(/[0-9٠-٩]/g, "")
    .replace(/[()]/g, "")
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function pairHasSameRandomBox1Team(pair = []) {
  if (!Array.isArray(pair) || pair.length < 2) return false

  const firstKey = getRandomBox1TeamKey(pair[0])
  const secondKey = getRandomBox1TeamKey(pair[1])

  return !!firstKey && !!secondKey && firstKey === secondKey
}

function pairHasTwoNumberedRandomBox1Images(pair = []) {
  if (!Array.isArray(pair) || pair.length < 2) return false
  return randomBox1ImageNameHasNumber(pair[0]) && randomBox1ImageNameHasNumber(pair[1])
}

function getRandomBox1RecentTeamKeys() {
  if (!Array.isArray(randomChallengeState.box1.recentTeamKeys)) {
    randomChallengeState.box1.recentTeamKeys = []
  }

  return randomChallengeState.box1.recentTeamKeys
}

function rememberRandomBox1Teams(pair = []) {
  const recent = getRandomBox1RecentTeamKeys()

  pair.forEach(item => {
    const key = getRandomBox1TeamKey(item)
    if (!key) return

    const existingIndex = recent.indexOf(key)

    if (existingIndex !== -1) {
      recent.splice(existingIndex, 1)
    }

    recent.unshift(key)
  })

  randomChallengeState.box1.recentTeamKeys = recent.slice(0, RANDOM_BOX1_RECENT_TEAMS_LIMIT)
}

function pairHasRecentRandomBox1Team(pair = []) {
  const recent = getRandomBox1RecentTeamKeys()

  return pair.some(item => {
    const key = getRandomBox1TeamKey(item)
    return !!key && recent.includes(key)
  })
}

function getPoolWithoutIds(source, excludedIds = []) {
  const excluded = excludedIds.map(String)

  return (Array.isArray(source) ? source : []).filter(item => {
    const key = getRandomBox1ItemKey(item)
    return item && item.image && !excluded.includes(key)
  })
}

function pickRandomPairWithRules(source = []) {
  const validSource = (Array.isArray(source) ? source : []).filter(item => item && item.image)

  if (validSource.length < 2) return []

  const specialPool = validSource.filter(isSpecialImage)
  const normalPool = validSource.filter(item => !isSpecialImage(item))

  let first = null

  if (specialPool.length && normalPool.length) {
    first = Math.random() < 0.5
      ? getRandomFromList(specialPool)
      : getRandomFromList(normalPool)
  } else {
    first = getRandomFromList(validSource)
  }

  if (!first) return []

  const remaining = getPoolWithoutIds(validSource, [getRandomBox1ItemKey(first)])
  const preferredRemaining = isSpecialImage(first)
    ? remaining.filter(item => !isSpecialImage(item))
    : remaining

  const second = getRandomFromList(preferredRemaining.length ? preferredRemaining : remaining)

  if (!second) return []
  return [first, second]
}

function pickRandomPairWithTeamVariety(source = []) {
  let fallback = []

  for (let attempt = 0; attempt < 60; attempt++) {
    const pair = pickRandomPairWithRules(source)

    if (pair.length < 2) continue
    if (!fallback.length) fallback = pair
    if (pairHasSameRandomBox1Team(pair)) continue
    if (pairHasTwoNumberedRandomBox1Images(pair)) continue
    if (pairHasRecentRandomBox1Team(pair)) continue

    return pair
  }

  for (let attempt = 0; attempt < 60; attempt++) {
    const pair = pickRandomPairWithRules(source)

    if (pair.length < 2) continue
    if (pairHasSameRandomBox1Team(pair)) continue
    if (pairHasTwoNumberedRandomBox1Images(pair)) continue

    return pair
  }

  return fallback.length ? fallback : pickRandomPairWithRules(source)
}

/* =========================
   10) MAIN RENDER
========================= */

async function renderRandomChallenge() {
  restoreRandomChallengeState()

  const [mediaResult, challengeDataReady] = await Promise.all([
    loadRandomMediaItems(),
    loadRandomChallengeGameData(),
  ])

  if (!challengeDataReady) {
    showGameToast("تعذر تحميل بيانات التحدي")
    return
  }

  const savedCurrentBox = normalizeRandomChallengeBoxNumber(randomChallengeState.currentBox)

  if (savedCurrentBox && !isRandomChallengeBoxEnabled(savedCurrentBox)) {
    randomChallengeState.currentBox = null
    clearRandomChallengeTeamSelection()
  }

  const sharedMedia = window.randomSharedPlayerMedia || {}
  const hasSharedMedia =
    Array.isArray(sharedMedia.saudi) &&
    sharedMedia.saudi.length >= 2 &&
    Array.isArray(sharedMedia.world) &&
    sharedMedia.world.length >= 2

  if (
    randomChallengeSettings.box1 !== false &&
    mediaResult.error &&
    !mediaResult.data.length &&
    !hasSharedMedia
  ) {
    showGameToast("تعذر تحميل صور اللاعب المشترك")
    return
  }

  localStorage.setItem("active_segment", "randomChallenge")

  openSegment("التحدي", buildRandomChallengeHTML())

  renderRandomChallengeUI()
  highlightRandomChallengeTeam(randomChallengeState.activeTeam)
  saveRandomChallengeState()

  if (
    randomChallengeState.currentBox === 4 &&
    randomChallengeState.box4.started &&
    !randomChallengeState.box4.revealed &&
    !randomChallengeState.box4.reviewMode &&
    !randomChallengeState.box4.secondTeamBreak
  ) {
    setTimeout(startRandomBox4Timer, 80)
  }
}

function buildRandomChallengeHTML() {
  return `
    <div
      class="randomChallengeWrap"
      data-segment-key="randomChallenge"
    >
      <header
        id="randomChallengeHeader"
        class="megaHeader randomChallengeDynamicHeader"
      ></header>

      <section
        id="randomMainStage"
        class="randomMainStage"
      ></section>

      <footer
        id="randomControlsBar"
        class="actionBar randomControlsBar"
      ></footer>
    </div>
  `
}

function renderRandomChallengeScores() {
  const wins = calculateRandomChallengeBoxWins()
  const currentBox = normalizeRandomChallengeBoxNumber(randomChallengeState.currentBox)

  const scoreA = currentBox
    ? getRandomChallengeTeamScore("A", currentBox)
    : Number(wins.A || 0)

  const scoreB = currentBox
    ? getRandomChallengeTeamScore("B", currentBox)
    : Number(wins.B || 0)

  const scoreAElement = document.getElementById("randomScoreA")
  const scoreBElement = document.getElementById("randomScoreB")

  if (scoreAElement) scoreAElement.innerText = scoreA
  if (scoreBElement) scoreBElement.innerText = scoreB

  updateRandomChallengeWindowState()
}

function renderRandomChallengeHeader() {
  const header = document.getElementById("randomChallengeHeader")
  if (!header) return

  const currentBox = normalizeRandomChallengeBoxNumber(randomChallengeState.currentBox)

  if (!currentBox) {
    const wins = calculateRandomChallengeBoxWins()

    header.className = "megaHeader randomChallengeDynamicHeader randomChallengeHomeHeader"

    header.innerHTML = `
      <button
        class="dockBtn dockBtnNav"
        type="button"
        onclick="handleRandomChallengeBack()"
      >
        رجوع
      </button>

      <div class="randomChallengeHomeTeam randomChallengeHomeTeamA">
        <strong>${escapeDisplayHtml(teamAName || "الفريق الأول")}</strong>
        <b>${wins.A}</b>
      </div>

      <div class="randomChallengeHomeTitle">
        <h1>التحدي</h1>
      </div>

      <div class="randomChallengeHomeTeam randomChallengeHomeTeamB">
        <b>${wins.B}</b>
        <strong>${escapeDisplayHtml(teamBName || "الفريق الثاني")}</strong>
      </div>

      <button
        id="endRoundBtn"
        class="dockBtn dockBtnNav"
        type="button"
        onclick="handleRandomChallengeEnd()"
      >
        إنهاء
      </button>
    `

    return
  }

  const title = getRandomChallengeBoxTitle(currentBox)

  header.className = "megaHeader randomChallengeDynamicHeader randomChallengeBoxHeader"

  header.innerHTML = `
    <button
      class="dockBtn dockBtnNav"
      type="button"
      onclick="handleRandomChallengeBack()"
    >
      رجوع
    </button>

    <div
      class="teamMini teamA"
      id="randomTeamABox"
      onclick="selectRandomChallengeTeam('A')"
    >
      <div class="teamNameBlock">
        <strong>${escapeDisplayHtml(teamAName || "الفريق الأول")}</strong>
      </div>
      <b id="randomScoreA">${getRandomChallengeTeamScore("A", currentBox)}</b>
    </div>

    <div class="segmentTitlePlain">
      <h1>${escapeDisplayHtml(title)}</h1>
    </div>

    <div
      class="teamMini teamB"
      id="randomTeamBBox"
      onclick="selectRandomChallengeTeam('B')"
    >
      <b id="randomScoreB">${getRandomChallengeTeamScore("B", currentBox)}</b>
      <div class="teamNameBlock">
        <strong>${escapeDisplayHtml(teamBName || "الفريق الثاني")}</strong>
      </div>
    </div>

    <button
      class="dockBtn dockBtnNav"
      type="button"
      onclick="finishRandomChallengeCurrentBox()"
    >
      إنهاء المربع
    </button>
  `

  highlightRandomChallengeTeam(randomChallengeState.activeTeam)
}

/* =========================
   11) TEAM
========================= */

function setRandomChallengeGameActiveTeam(team) {
  if (!isValidRandomChallengeTeam(team)) return

  if (typeof setGameActiveTeam === "function") {
    setGameActiveTeam(team, {
      sync: false,
    })
  }
}

function clearRandomChallengeGameActiveTeam() {
  if (typeof clearGameActiveTeam === "function") {
    clearGameActiveTeam({
      sync: false,
    })
  }
}

function selectRandomChallengeTeam(team) {
  if (!isValidRandomChallengeTeam(team)) return

  const currentBox = normalizeRandomChallengeBoxNumber(randomChallengeState.currentBox)

  if (currentBox === 4) {
    const box4 = randomChallengeState.box4

    if (box4.reviewMode) return

    if (box4.started) {
      showGameToast("الفريق يتغير تلقائيًا أثناء الأسئلة")
      highlightRandomChallengeTeam(getRandomBox4CurrentTeam())
      return
    }

    const selectedTeam = box4.startingTeam === team ? null : team

    box4.startingTeam = selectedTeam
    box4.activeTeam = selectedTeam
    randomChallengeState.activeTeam = selectedTeam

    if (selectedTeam) {
      setRandomChallengeGameActiveTeam(selectedTeam)
    } else {
      clearRandomChallengeGameActiveTeam()
    }

    highlightRandomChallengeTeam(selectedTeam)
    renderRandomChallengeStage()
    renderRandomChallengeControls()
    saveRandomChallengeState()
    return
  }

  const selectedTeam = randomChallengeState.activeTeam === team ? null : team

  randomChallengeState.activeTeam = selectedTeam

  if (currentBox === 3) {
    randomChallengeState.box3.activeTeam = selectedTeam
  }

  if (selectedTeam) {
    setRandomChallengeGameActiveTeam(selectedTeam)
  } else {
    clearRandomChallengeGameActiveTeam()
  }

  highlightRandomChallengeTeam(selectedTeam)
  renderRandomChallengeControls()
  saveRandomChallengeState()

  if (
    currentBox === 3 &&
    selectedTeam &&
    !randomChallengeState.box3.choosingPoints
  ) {
    setTimeout(startRandomBox3Timer, 80)
  }
}

function highlightRandomChallengeTeam(team) {
  const a = document.getElementById("randomTeamABox")
  const b = document.getElementById("randomTeamBBox")

  if (a) a.classList.remove("active")
  if (b) b.classList.remove("active")

  if (team === "A" && a) a.classList.add("active")
  if (team === "B" && b) b.classList.add("active")
}

function clearRandomChallengeTeamSelection() {
  randomChallengeState.activeTeam = null

  if (randomChallengeState.box3) {
    randomChallengeState.box3.activeTeam = null
  }

  clearRandomChallengeGameActiveTeam()
  highlightRandomChallengeTeam(null)
}

function setRandomChallengePresenterTeam(team) {
  if (!isValidRandomChallengeTeam(team)) {
    randomChallengeState.activeTeam = null

    if (randomChallengeState.box3) {
      randomChallengeState.box3.activeTeam = null
    }

    clearRandomChallengeGameActiveTeam()
    highlightRandomChallengeTeam(null)
    renderRandomChallengeControls()
    saveRandomChallengeState()
    return true
  }

  randomChallengeState.activeTeam = team

  if (randomChallengeState.currentBox === 3) {
    randomChallengeState.box3.activeTeam = team
  }

  if (randomChallengeState.currentBox === 4 && !randomChallengeState.box4.started) {
    randomChallengeState.box4.startingTeam = team
    randomChallengeState.box4.activeTeam = team
  }

  setRandomChallengeGameActiveTeam(team)
  highlightRandomChallengeTeam(team)
  renderRandomChallengeControls()
  saveRandomChallengeState()

  return true
}

/* =========================
   12) STAGE
========================= */

function buildRandomChallengeChoiceBox(number) {
  if (!isRandomChallengeBoxEnabled(number)) return ""

  const state = getRandomChallengeBoxState(number)
  const finished = !!state?.finished
  const scoreA = Number(state?.scores?.A || 0)
  const scoreB = Number(state?.scores?.B || 0)
  const winnerText = getRandomChallengeBoxWinnerText(number)

  const winnerClass =
    state?.winner === "A"
      ? "winnerA"
      : state?.winner === "B"
        ? "winnerB"
        : state?.winner === "draw"
          ? "winnerDraw"
          : ""

  return `
    <button
      type="button"
      class="randomMainBox randomChallengeChoiceBox ${finished ? "locked" : ""} ${winnerClass}"
      onclick="openRandomChallengeBox(${Number(number)})"
      ${finished ? "disabled" : ""}
    >
      <strong class="randomMainBoxTitle">
        ${escapeDisplayHtml(getRandomChallengeBoxTitle(number))}
      </strong>

      ${
        finished
          ? `
            <div class="randomMainBoxFinalScore">
              <span>
                ${escapeDisplayHtml(teamAName || "الفريق الأول")}
                <b>${scoreA}</b>
              </span>
              <i>—</i>
              <span>
                ${escapeDisplayHtml(teamBName || "الفريق الثاني")}
                <b>${scoreB}</b>
              </span>
            </div>
            <span class="randomBoxFinishedLabel">
              ${escapeDisplayHtml(winnerText)}
            </span>
          `
          : ""
      }
    </button>
  `
}

function renderRandomChallengeStage() {
  const stage = document.getElementById("randomMainStage")
  const controls = document.getElementById("randomControlsBar")
  const wrap = document.querySelector(".randomChallengeWrap")

  if (!stage) return

  const currentBox = normalizeRandomChallengeBoxNumber(randomChallengeState.currentBox)

  if (!currentBox) {
    if (wrap) {
      wrap.classList.remove("randomChallengeInsideBox")
      wrap.classList.add("randomChallengeBoxesScreen")
      wrap.removeAttribute("data-current-box")
    }

    if (controls) {
      controls.innerHTML = ""
      controls.hidden = true
    }

    const enabledBoxes = RANDOM_CHALLENGE_BOXES.filter(number => {
      return isRandomChallengeBoxEnabled(number)
    })

    const boxesHtml = enabledBoxes.map(buildRandomChallengeChoiceBox).join("")

    stage.innerHTML = `
      <div
        class="randomChallengeBoxesHome"
        data-box-count="${enabledBoxes.length}"
      >
        <div class="randomBoxesGrid randomBoxesGridClean randomBoxesGridCentered">
          ${
            boxesHtml ||
            `
              <div class="randomPlaceholder">
                لا توجد مربعات مفعّلة
              </div>
            `
          }
        </div>
      </div>
    `

    return
  }

  if (wrap) {
    wrap.classList.remove("randomChallengeBoxesScreen")
    wrap.classList.add("randomChallengeInsideBox")
    wrap.dataset.currentBox = String(currentBox)
  }

  if (!isRandomChallengeBoxEnabled(currentBox)) {
    randomChallengeState.currentBox = null

    if (controls) {
      controls.innerHTML = ""
      controls.hidden = true
    }

    renderRandomChallengeUI({ scores: false })
    saveRandomChallengeState()
    return
  }

  const renderers = {
    1: renderRandomChallengeBox1,
    2: renderRandomChallengeBox2,
    3: renderRandomChallengeBox3,
    4: renderRandomChallengeBox4,
    5: renderRandomChallengeBox5,
  }

  renderers[currentBox]?.()
}

/* =========================
   13) BOX 1
========================= */

function renderRandomChallengeBox1() {
  const stage = document.getElementById("randomMainStage")
  if (!stage) return

  const box1 = randomChallengeState.box1
  const images = box1.images || []
  const img1 = images[0]?.image || ""
  const img2 = images[1]?.image || ""
  const poolTitle = getRandomBox1PoolTitle(box1.pool || "saudi")

  if (!box1.started) {
    stage.innerHTML = `
      <div class="randomBoxView randomBox1View">
        <section class="randomStartBox randomSharedPlayerStartBox">
          <button
            type="button"
            class="randomStartBtn randomSaudiBtn"
            onclick="startRandomChallengeBox1('saudi')"
          >
            الدوري السعودي
          </button>

          <button
            type="button"
            class="randomStartBtn randomWorldBtn"
            onclick="startRandomChallengeBox1('world')"
          >
            عالمي
          </button>
        </section>
      </div>
    `

    return
  }

  stage.innerHTML = `
    <div class="randomBoxView randomBox1View">
      <div class="randomBox1CategoryTitle">
        <span>${escapeDisplayHtml(poolTitle)}</span>
      </div>

      <section class="randomImagesDuel">
        <div class="randomImageCard">
          <img
            id="randomRouletteImg1"
            src="${escapeDisplayHtml(img1)}"
            alt=""
          >
        </div>

        <div class="randomVs">VS</div>

        <div class="randomImageCard">
          <img
            id="randomRouletteImg2"
            src="${escapeDisplayHtml(img2)}"
            alt=""
          >
        </div>
      </section>
    </div>
  `
}

function startRandomChallengeBox1(pool = "saudi") {
  if (randomChallengeState.currentBox !== 1) {
    showGameToast("افتح المربع أولاً")
    return
  }

  if (randomChallengeState.box1.rolling) return

  const safePool = normalizeRandomBox1Pool(pool)
  const source = getRandomBox1PoolItems(safePool)

  if (!Array.isArray(source) || source.length < 2) {
    showGameToast(`لا توجد صور كافية في ${getRandomBox1PoolTitle(safePool)}`)
    return
  }

  stopRandomBox1Roulette()
  clearRandomChallengeTeamSelection()

  const firstPair = pickRandomPairWithTeamVariety(source)

  if (firstPair.length < 2) {
    showGameToast("تعذر تجهيز الصورتين")
    return
  }

  Object.assign(randomChallengeState.box1, {
    pool: safePool,
    started: true,
    rolling: true,
    flashing: false,
    images: firstPair,
  })

  renderRandomChallengeUI({ scores: false })
  saveRandomChallengeState({ sync: false })

  if (typeof playGameSound === "function") {
    playGameSound("open")
  }

  let ticks = 0
  const maxTicks = 65

  randomBox1RouletteTimer = setInterval(() => {
    ticks += 1

    const pair = pickRandomPairWithTeamVariety(source)

    if (pair.length >= 2) {
      updateRandomBox1RouletteImages(pair[0], pair[1])
    }

    if (ticks < maxTicks) return

    stopRandomBox1Roulette()

    const finalImages = pickRandomPairWithTeamVariety(source)

    if (finalImages.length < 2) {
      showGameToast("تعذر اختيار الصور")

      Object.assign(randomChallengeState.box1, {
        started: false,
        rolling: false,
        flashing: false,
        pool: "",
        images: [],
      })

      renderRandomChallengeUI({ scores: false })
      saveRandomChallengeState()
      return
    }

    Object.assign(randomChallengeState.box1, {
      rolling: false,
      flashing: false,
      images: finalImages,
    })

    rememberRandomBox1Teams(finalImages)
    updateRandomBox1RouletteImages(finalImages[0], finalImages[1])
    renderRandomChallengeControls()
    saveRandomChallengeState()
  }, 10)
}

function updateRandomBox1RouletteImages(img1, img2) {
  const el1 = document.getElementById("randomRouletteImg1")
  const el2 = document.getElementById("randomRouletteImg2")

  if (el1 && img1?.image) el1.src = img1.image
  if (el2 && img2?.image) el2.src = img2.image
}

function resetRandomChallengeBox1() {
  if (randomChallengeState.currentBox !== 1) return

  stopRandomBox1Roulette()

  Object.assign(randomChallengeState.box1, {
    started: false,
    rolling: false,
    flashing: false,
    pool: "",
    images: [],
  })

  clearRandomChallengeTeamSelection()
  renderRandomChallengeUI({ scores: false })
  saveRandomChallengeState({ immediate: true })
}

/* =========================
   14) BOX 2
========================= */

function getRandomBox2QuestionNumber() {
  return Math.min(
    Math.max(Number(randomChallengeState.box2.currentQuestionNumber || 1), 1),
    RANDOM_BOX2_QUESTIONS_COUNT,
  )
}

function loadRandomBox2CurrentQuestion() {
  const number = getRandomBox2QuestionNumber()
  const row = getRandomChallengeQuestion("auction", number)

  randomChallengeState.box2.question = String(row?.question || "")
  randomChallengeState.box2.answer = String(row?.answer || "")

  return row
}

function renderRandomChallengeBox2() {
  const stage = document.getElementById("randomMainStage")
  if (!stage) return

  const box2 = randomChallengeState.box2
  const questionNumber = getRandomBox2QuestionNumber()
  const question = String(box2.question || "")
  const numberValue = String(box2.numberInput || "")
  const points = Math.max(0, Number(box2.calculatedPoints || 0))
  const count = Math.max(0, Number(box2.currentCount || box2.numberInput || 0))
  const timer = Math.max(0, Number(box2.timer ?? RANDOM_BOX2_TIMER_SECONDS))
  const started = !!box2.started
  const timerDanger = started && timer <= 5
  const timerProgress = Math.max(0, Math.min(100, (timer / RANDOM_BOX2_TIMER_SECONDS) * 100))

  const questionHtml = `
    <section class="randomAuctionQuestionCard">
      <div class="randomAuctionQuestionTop">
        <span class="randomAuctionQuestionLabel">السؤال</span>
        <span class="randomAuctionQuestionNumber">${questionNumber} / ${RANDOM_BOX2_QUESTIONS_COUNT}</span>
      </div>

      <div class="randomAuctionQuestionText">
        ${question ? escapeDisplayHtml(question) : "لا يوجد سؤال محفوظ"}
      </div>
    </section>
  `

  if (!started) {
    stage.innerHTML = `
      <div class="randomBoxView randomBox2View">
        ${questionHtml}

        <section class="randomAuctionEntryRow">
          <div class="randomAuctionEntryCard">
            <span class="randomAuctionEntryLabel">العدد</span>
            <input
              id="randomBox2NumberInput"
              class="randomAuctionEntryInput"
              type="text"
              inputmode="numeric"
              value="${escapeDisplayHtml(numberValue)}"
              placeholder="0"
              autocomplete="off"
              oninput="updateRandomBox2Number(this.value)"
            >
          </div>

          <div class="randomAuctionEntryCard">
            <span class="randomAuctionEntryLabel">النقاط</span>
            <strong
              id="randomBox2PointsText"
              class="randomAuctionEntryValue"
            >${points}</strong>
          </div>
        </section>

        <section class="randomAuctionKeypad">
          ${[1, 2, 3, 4, 5, 6, 7, 8, 9]
            .map(number => `
              <button
                type="button"
                onclick="appendRandomBox2Digit(${number})"
              >${number}</button>
            `)
            .join("")}

          <button
            type="button"
            class="randomAuctionKeyClear"
            onclick="clearRandomBox2Number()"
          >مسح</button>

          <button
            type="button"
            onclick="appendRandomBox2Digit(0)"
          >0</button>

          <button
            type="button"
            class="randomAuctionKeyDelete"
            onclick="deleteRandomBox2Digit()"
          >حذف</button>
        </section>
      </div>
    `

    return
  }

  stage.innerHTML = `
    <div class="randomBoxView randomBox2View randomBox2LiveView">
      ${questionHtml}

      <section class="randomAuctionStatusRow">
        <button
          id="randomBox2CountButton"
          type="button"
          class="randomAuctionStatusCard randomAuctionCountCard"
          onclick="decreaseRandomBox2Count()"
          ${count <= 0 ? "disabled" : ""}
        >
          <span>العدد</span>
          <strong id="randomBox2CountText">${count}</strong>
        </button>

        <div class="randomAuctionStatusCard randomAuctionTimerCard ${timerDanger ? "danger" : ""}">
          <div class="randomAuctionTimerProgress">
            <i
              id="randomBox2TimerProgressBar"
              style="width:${timerProgress}%"
            ></i>
          </div>
          <span class="randomAuctionTimerLabel">الوقت</span>
          <strong id="randomBox2TimerText">${timer}</strong>
        </div>

        <div class="randomAuctionStatusCard randomAuctionPointsCard">
          <span>النقاط</span>
          <strong id="randomBox2PointsText">${points}</strong>
        </div>
      </section>
    </div>
  `
}

function setRandomBox2NumberValue(value) {
  if (randomChallengeState.currentBox !== 2) return
  if (randomChallengeState.box2.started) return

  const cleanValue = String(value || "").replace(/\D/g, "").slice(0, 5)
  const numberValue = Number(cleanValue || 0)
  const calculatedPoints = numberValue <= 0 ? 0 : numberValue < 10 ? 1 : Math.floor(numberValue / 10)

  Object.assign(randomChallengeState.box2, {
    numberInput: cleanValue,
    currentCount: numberValue,
    points: numberValue,
    calculatedPoints,
  })

  const input = document.getElementById("randomBox2NumberInput")
  const pointsText = document.getElementById("randomBox2PointsText")

  if (input && input.value !== cleanValue) input.value = cleanValue

  if (pointsText) {
    const oldPoints = Number(pointsText.innerText || 0)
    pointsText.innerText = calculatedPoints

    if (oldPoints !== calculatedPoints) {
      shakeRandomAuctionMetric(pointsText)
    }
  }

  saveRandomChallengeState({ sync: false })
}

function updateRandomBox2Number(value) {
  setRandomBox2NumberValue(value)
}

function appendRandomBox2Digit(digit) {
  const d = String(digit ?? "").replace(/\D/g, "")
  if (d === "") return

  const current = String(randomChallengeState.box2.numberInput || "")
  setRandomBox2NumberValue(current + d)
}

function deleteRandomBox2Digit() {
  const current = String(randomChallengeState.box2.numberInput || "")
  setRandomBox2NumberValue(current.slice(0, -1))
}

function clearRandomBox2Number() {
  setRandomBox2NumberValue("")
}

function increaseRandomBox2Number(step = 10) {
  const current = Number(randomChallengeState.box2.numberInput || 0)
  setRandomBox2NumberValue(String(current + Number(step || 10)))
}

function decreaseRandomBox2Number(step = 10) {
  const current = Number(randomChallengeState.box2.numberInput || 0)
  const next = Math.max(0, current - Number(step || 10))
  setRandomBox2NumberValue(String(next))
}

function shakeRandomAuctionMetric(el) {
  if (!el) return

  const box =
    el.closest(".randomAuctionStatusCard") ||
    el.closest(".randomAuctionEntryCard") ||
    el

  box.classList.remove("randomAuctionShake")
  void box.offsetWidth
  box.classList.add("randomAuctionShake")

  setTimeout(() => {
    box.classList.remove("randomAuctionShake")
  }, 360)
}

function startRandomBox2Timer() {
  if (randomChallengeState.currentBox !== 2) {
    showGameToast("افتح المزاد أولاً")
    return
  }

  const box2 = randomChallengeState.box2

  if (box2.started) return

  const selectedTeam = randomChallengeState.activeTeam

  if (!isValidRandomChallengeTeam(selectedTeam)) {
    showGameToast("اختر الفريق من الهيدر أولاً")
    return
  }

  const numberValue = Number(box2.numberInput || 0)

  if (numberValue <= 0) {
    showGameToast("اكتب العدد أولاً")
    return
  }

  stopRandomBox2Timer()

  Object.assign(box2, {
    currentCount: numberValue,
    points: numberValue,
    calculatedPoints: numberValue < 10 ? 1 : Math.floor(numberValue / 10),
    timer: RANDOM_BOX2_TIMER_SECONDS,
    timerRunning: true,
    started: true,
  })

  setRandomTimerSync(box2, RANDOM_BOX2_TIMER_SECONDS)

  renderRandomChallengeStage()
  renderRandomChallengeControls()
  saveRandomChallengeState({ immediate: true })

  randomBox2Timer = setInterval(() => {
    box2.timer = Math.max(0, Number(box2.timer || 0) - 1)

    const timer = box2.timer
    const timerText = document.getElementById("randomBox2TimerText")
    const timerBox = document.querySelector(".randomAuctionTimerCard")
    const timerFill = document.getElementById("randomBox2TimerProgressBar")

    if (timerText) timerText.textContent = String(timer)

    if (timerFill) {
      timerFill.style.width = `${Math.max(0, Math.min(100, (timer / RANDOM_BOX2_TIMER_SECONDS) * 100))}%`
    }

    if (timerBox) {
      timerBox.classList.toggle("danger", timer > 0 && timer <= 5)
      timerBox.classList.remove("randomAuctionTimerBeat")
      void timerBox.offsetWidth
      timerBox.classList.add("randomAuctionTimerBeat")
    }

    if (timer > 0) {
      saveRandomChallengeState({ sync: false })
      return
    }

    stopRandomBox2Timer()
    box2.timerRunning = false

    if (timerBox) {
      timerBox.classList.remove("danger", "randomAuctionTimerBeat")
    }

    renderRandomChallengeControls()
    saveRandomChallengeState({ immediate: true })

    if (typeof playGameSound === "function") {
      playGameSound("timeout")
    }
  }, 1000)
}

function decreaseRandomBox2Count() {
  if (randomChallengeState.currentBox !== 2) return

  const box2 = randomChallengeState.box2

  if (!box2.started) return

  const currentCount = Math.max(0, Number(box2.currentCount || 0))

  if (currentCount <= 0) return

  const nextCount = currentCount - 1
  box2.currentCount = nextCount

  const countText = document.getElementById("randomBox2CountText")

  if (countText) {
    countText.textContent = String(nextCount)
    shakeRandomAuctionMetric(countText)
  }

  const countButton = document.getElementById("randomBox2CountButton")

  if (countButton && nextCount <= 0) {
    countButton.disabled = true
  }

  saveRandomChallengeState({ sync: false })
}

function getRandomBox2Points() {
  return Math.max(0, Number(randomChallengeState.box2.calculatedPoints || 0))
}

function resetRandomBox2AfterScore() {
  stopRandomBox2Timer()

  Object.assign(randomChallengeState.box2, {
    timerRunning: false,
    started: false,
  })

  nextRandomBox2Question()
}

function nextRandomBox2Question() {
  if (randomChallengeState.currentBox !== 2) return

  stopRandomBox2Timer()

  const current = getRandomBox2QuestionNumber()

  if (current >= RANDOM_BOX2_QUESTIONS_COUNT) {
    finishRandomChallengeCurrentBox()
    return
  }

  Object.assign(randomChallengeState.box2, {
    currentQuestionNumber: current + 1,
    question: "",
    answer: "",
    numberInput: "",
    currentCount: 0,
    points: 0,
    calculatedPoints: 0,
    timer: RANDOM_BOX2_TIMER_SECONDS,
    timerRunning: false,
    started: false,
  })

  loadRandomBox2CurrentQuestion()
  clearRandomChallengeTeamSelection()
  renderRandomChallengeUI({ scores: false })
  saveRandomChallengeState()
}

/* =========================
   15) BOX 3
========================= */

function getRandomBox3QuestionNumber() {
  return Math.min(
    Math.max(Number(randomChallengeState.box3.currentQuestionNumber || 1), 1),
    RANDOM_BOX3_QUESTIONS_COUNT,
  )
}

function loadRandomBox3CurrentQuestion() {
  const number = getRandomBox3QuestionNumber()
  const row = getRandomChallengeQuestion("whatDoYouKnow", number)

  randomChallengeState.box3.question = String(row?.question || "")
  return row
}

function renderErrorMarks(errorsCount) {
  return [1, 2, 3]
    .map(i => `
      <span class="${i <= errorsCount ? "used" : ""}">×</span>
    `)
    .join("")
}

function renderRandomChallengeBox3() {
  const stage = document.getElementById("randomMainStage")
  if (!stage) return

  const box3 = randomChallengeState.box3
  const activeTeam = box3.activeTeam || randomChallengeState.activeTeam || null
  const timer = Math.max(0, Number(box3.timer ?? RANDOM_BOX3_TIMER_SECONDS))
  const questionValue = String(box3.question || "")
  const errorsA = Math.max(0, Number(box3.errors?.A || 0))
  const errorsB = Math.max(0, Number(box3.errors?.B || 0))
  const errorsAHtml = renderErrorMarks(errorsA)
  const errorsBHtml = renderErrorMarks(errorsB)

  if (box3.choosingPoints) {
    const scoringBoth = !!box3.scoringBoth
    const scoringTeam = box3.scoringTeam || getRandomBox3ScoringInfo().team
    const scoringTeamName = scoringBoth
      ? "الفريقين"
      : getRandomChallengeTeamName(scoringTeam)

    const resultTeamAClass = scoringBoth || scoringTeam === "A" ? "active" : ""
    const resultTeamBClass = scoringBoth || scoringTeam === "B" ? "active" : ""

    stage.innerHTML = `
      <div class="randomBoxView randomBox3View randomBox3ResultView">
        <section class="randomBox3ResultPanel">
          <div class="randomBox3ResultTitle">
            <span>تسجيل النتيجة</span>
            <strong>${escapeDisplayHtml(scoringTeamName || "غير محدد")}</strong>
          </div>

          <div class="randomBox3ResultTeams">
            <article class="randomBox3ResultTeamCard ${resultTeamAClass}">
              <strong>${escapeDisplayHtml(teamAName || "الفريق الأول")}</strong>
              <div class="randomBox3ResultErrorMarks">${errorsAHtml}</div>
            </article>

            <article class="randomBox3ResultTeamCard ${resultTeamBClass}">
              <strong>${escapeDisplayHtml(teamBName || "الفريق الثاني")}</strong>
              <div class="randomBox3ResultErrorMarks">${errorsBHtml}</div>
            </article>
          </div>

          <div class="randomBox3ResultPoints">
            <span>اختر النقاط</span>
            <div class="randomBox3ResultPointsButtons">
              <button
                type="button"
                onclick="scoreRandomBox3Points(1)"
              >
                <small>نقطة</small>
                <strong>1</strong>
              </button>

              <button
                type="button"
                onclick="scoreRandomBox3Points(2)"
              >
                <small>نقطتان</small>
                <strong>2</strong>
              </button>
            </div>
          </div>
        </section>
      </div>
    `

    return
  }

  stage.innerHTML = `
    <div class="randomBoxView randomBox3View randomBox3LiveView">
      <section class="randomAuctionQuestionCard">
        <div class="randomAuctionQuestionTop">
          <span class="randomAuctionQuestionLabel">السؤال</span>
          <span class="randomAuctionQuestionNumber">${getRandomBox3QuestionNumber()} / ${RANDOM_BOX3_QUESTIONS_COUNT}</span>
        </div>

        <div class="randomAuctionQuestionText">
          ${questionValue ? escapeDisplayHtml(questionValue) : "لا يوجد سؤال محفوظ"}
        </div>
      </section>

      <section class="randomBox3StatusRow">
        <article class="randomSpeedTeam randomBox3TeamCard ${activeTeam === "A" ? "active" : ""}">
          <strong class="randomSpeedTeamName">${escapeDisplayHtml(teamAName || "الفريق الأول")}</strong>
          <div class="randomTeamErrors">${errorsAHtml}</div>
        </article>

        <div class="randomAuctionStatusCard randomAuctionTimerCard randomBox3TimerCard">
          <div
            id="randomBox3TimerFill"
            class="randomAuctionTimerFill"
          ></div>
          <span class="randomAuctionTimerLabel">المؤقت</span>
          <strong id="randomBox3TimerText">${timer}</strong>
        </div>

        <article class="randomSpeedTeam randomBox3TeamCard ${activeTeam === "B" ? "active" : ""}">
          <strong class="randomSpeedTeamName">${escapeDisplayHtml(teamBName || "الفريق الثاني")}</strong>
          <div class="randomTeamErrors">${errorsBHtml}</div>
        </article>
      </section>
    </div>
  `
}

function resetRandomBox3RoundState() {
  stopRandomBox3Timer()

  Object.assign(randomChallengeState.box3, {
    activeTeam: null,
    scoringTeam: null,
    scoringBoth: false,
    errors: {
      A: 0,
      B: 0,
    },
    passUsed: {
      A: false,
      B: false,
    },
    lastAction: null,
    timer: RANDOM_BOX3_TIMER_SECONDS,
    timerRunning: false,
    choosingPoints: false,
  })
}

function nextRandomBox3Question() {
  const current = getRandomBox3QuestionNumber()

  if (current >= RANDOM_BOX3_QUESTIONS_COUNT) {
    finishRandomChallengeCurrentBox()
    return
  }

  randomChallengeState.box3.currentQuestionNumber = current + 1

  resetRandomBox3RoundState()
  loadRandomBox3CurrentQuestion()
  clearRandomChallengeTeamSelection()
  renderRandomChallengeUI({ scores: false })
  saveRandomChallengeState()
}

function startRandomBox3Timer() {
  if (randomChallengeState.currentBox !== 3) return

  const box3 = randomChallengeState.box3

  if (box3.choosingPoints || box3.timerRunning) return

  const selectedTeam = box3.activeTeam || randomChallengeState.activeTeam

  if (!isValidRandomChallengeTeam(selectedTeam)) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  stopRandomBox3Timer()

  box3.activeTeam = selectedTeam
  randomChallengeState.activeTeam = selectedTeam
  box3.timer = RANDOM_BOX3_TIMER_SECONDS
  box3.timerRunning = true

  setRandomTimerSync(box3, RANDOM_BOX3_TIMER_SECONDS)
  highlightRandomChallengeTeam(selectedTeam)
  renderRandomChallengeUI({ scores: false })
  saveRandomChallengeState()

  randomBox3Timer = setInterval(() => {
    box3.timer = Math.max(0, Number(box3.timer || 0) - 1)

    const timer = box3.timer
    const timerText = document.getElementById("randomBox3TimerText")

    if (timerText) timerText.innerText = timer

    if (timer > 0) {
      saveRandomChallengeState({ sync: false })
      return
    }

    stopRandomBox3Timer()
    box3.timerRunning = false
    saveRandomChallengeState()

    if (typeof playGameSound === "function") {
      playGameSound("timeout")
    }
  }, 1000)
}

function switchRandomBox3Team() {
  if (randomChallengeState.currentBox !== 3) return
  if (randomChallengeState.box3.choosingPoints) return

  const currentTeam = randomChallengeState.box3.activeTeam || randomChallengeState.activeTeam

  if (!isValidRandomChallengeTeam(currentTeam)) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  stopRandomBox3Timer()

  const nextTeam = getOtherRandomChallengeTeam(currentTeam)

  randomChallengeState.box3.activeTeam = nextTeam
  randomChallengeState.activeTeam = nextTeam
  randomChallengeState.box3.timer = RANDOM_BOX3_TIMER_SECONDS
  randomChallengeState.box3.timerRunning = false

  highlightRandomChallengeTeam(nextTeam)
  renderRandomChallengeUI({ scores: false })
  saveRandomChallengeState()
  setTimeout(startRandomBox3Timer, 80)
}

function randomBox3Wrong() {
  if (randomChallengeState.currentBox !== 3) return
  if (randomChallengeState.box3.choosingPoints) return

  const team = randomChallengeState.box3.activeTeam || randomChallengeState.activeTeam

  if (!isValidRandomChallengeTeam(team)) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  const errors = randomChallengeState.box3.errors || {
    A: 0,
    B: 0,
  }

  errors[team] = Math.min(3, Number(errors[team] || 0) + 1)

  randomChallengeState.box3.errors = errors
  randomChallengeState.box3.lastAction = "wrong"

  playRandomChallengeFeedback("wrong")
  saveRandomChallengeState()
  renderRandomChallengeUI({ scores: false })

  if (errors[team] >= 3) {
    finishRandomBox3ToPoints()
    return
  }

  switchRandomBox3Team()
}

function randomBox3Pass() {
  if (randomChallengeState.currentBox !== 3) return
  if (randomChallengeState.box3.choosingPoints) return

  const team = randomChallengeState.box3.activeTeam || randomChallengeState.activeTeam

  if (!isValidRandomChallengeTeam(team)) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  const errors = randomChallengeState.box3.errors || {
    A: 0,
    B: 0,
  }

  const passUsed = randomChallengeState.box3.passUsed || {
    A: false,
    B: false,
  }

  if (Number(errors[team] || 0) !== 2) {
    showGameToast("الباس متاح فقط إذا كان على الفريق خطأين")
    return
  }

  if (passUsed[team]) {
    showGameToast("الفريق استخدم الباس")
    return
  }

  if (randomChallengeState.box3.lastAction === "pass") {
    showGameToast("ما ينفع باس مرتين ورا بعض")
    return
  }

  passUsed[team] = true
  randomChallengeState.box3.passUsed = passUsed
  randomChallengeState.box3.lastAction = "pass"

  switchRandomBox3Team()
}

function getRandomBox3ScoringInfo() {
  const errorsA = Number(randomChallengeState.box3.errors?.A || 0)
  const errorsB = Number(randomChallengeState.box3.errors?.B || 0)

  if (errorsA === 0 && errorsB === 0) {
    return {
      team: null,
      both: true,
    }
  }

  if (errorsA < errorsB) {
    return {
      team: "A",
      both: false,
    }
  }

  if (errorsB < errorsA) {
    return {
      team: "B",
      both: false,
    }
  }

  return {
    team: randomChallengeState.box3.activeTeam || randomChallengeState.activeTeam || null,
    both: false,
  }
}

function finishRandomBox3ToPoints() {
  if (randomChallengeState.currentBox !== 3) return
  if (randomChallengeState.box3.choosingPoints) return

  stopRandomBox3Timer()

  const scoringInfo = getRandomBox3ScoringInfo()

  Object.assign(randomChallengeState.box3, {
    scoringTeam: scoringInfo.team,
    scoringBoth: scoringInfo.both,
    timer: RANDOM_BOX3_TIMER_SECONDS,
    timerRunning: false,
    choosingPoints: true,
  })

  if (scoringInfo.both) {
    randomChallengeState.activeTeam = null
    randomChallengeState.box3.activeTeam = null
  } else if (scoringInfo.team) {
    randomChallengeState.activeTeam = scoringInfo.team
    randomChallengeState.box3.activeTeam = scoringInfo.team
  }

  renderRandomChallengeUI({ scores: false })

  if (scoringInfo.both) {
    document.getElementById("randomTeamABox")?.classList.add("active")
    document.getElementById("randomTeamBBox")?.classList.add("active")
  } else {
    highlightRandomChallengeTeam(scoringInfo.team)
  }

  saveRandomChallengeState()
}

function scoreRandomBox3Points(points) {
  const value = Number(points || 0)

  if (![1, 2].includes(value)) return
  if (!randomChallengeState.box3.choosingPoints) return

  const scoringBoth = !!randomChallengeState.box3.scoringBoth
  const team = randomChallengeState.box3.scoringTeam || getRandomBox3ScoringInfo().team

  if (scoringBoth) {
    addRandomChallengeTeamScore("A", value)
    addRandomChallengeTeamScore("B", value)
  } else {
    if (!isValidRandomChallengeTeam(team)) {
      showGameToast("لا يوجد فريق لتسجيل النقاط")
      return
    }

    addRandomChallengeTeamScore(team, value)
  }

  playRandomChallengeFeedback("correct")
  clearRandomChallengeTeamSelection()
  resetRandomBox3RoundState()

  if (getRandomBox3QuestionNumber() >= RANDOM_BOX3_QUESTIONS_COUNT) {
    finishRandomChallengeCurrentBox()
    return
  }

  nextRandomBox3Question()
}

/* =========================
   16) BOX 4
========================= */

function getRandomBox4QuestionNumber() {
  return Math.min(
    Math.max(Number(randomChallengeState.box4.currentQuestionNumber || 1), 1),
    RANDOM_BOX4_QUESTIONS_COUNT,
  )
}

function getRandomBox4CurrentTeamFromState(box4) {
  const startingTeam = isValidRandomChallengeTeam(box4.startingTeam)
    ? box4.startingTeam
    : "A"

  const questionNumber = Math.min(
    Math.max(Number(box4.currentQuestionNumber || 1), 1),
    RANDOM_BOX4_QUESTIONS_COUNT,
  )

  if (questionNumber <= RANDOM_BOX4_TEAM_QUESTIONS_COUNT) {
    return startingTeam
  }

  return getOtherRandomChallengeTeam(startingTeam)
}

function getRandomBox4CurrentTeam() {
  return getRandomBox4CurrentTeamFromState(randomChallengeState.box4)
}

function getRandomBox4CurrentRow() {
  return getRandomChallengeQuestion("trueFalse", getRandomBox4QuestionNumber())
}

function renderRandomChallengeBox4() {
  const stage = document.getElementById("randomMainStage")
  if (!stage) return

  const box4 = randomChallengeState.box4

  if (!box4.started) {
    const startingTeam = box4.startingTeam || randomChallengeState.activeTeam || null

    stage.innerHTML = `
      <div class="randomBoxView randomTrueFalseView randomTrueFalseStartView">
        <section class="randomTrueFalseStartPanel">
          <div class="randomTrueFalseStartHeading">
            <span>صح أو خطأ</span>
            <strong>اختر الفريق الذي يبدأ</strong>
            <p>لكل فريق 5 أسئلة ومدة كل سؤال 10 ثوانٍ</p>
          </div>

          <div class="randomTrueFalseStartTeams">
            <button
              type="button"
              class="randomTrueFalseStartTeam ${startingTeam === "A" ? "active" : ""}"
              onclick="selectRandomChallengeTeam('A')"
            >
              <span>الفريق الأول</span>
              <strong>${escapeDisplayHtml(teamAName || "الفريق الأول")}</strong>
              <b>يبدأ</b>
            </button>

            <button
              type="button"
              class="randomTrueFalseStartTeam ${startingTeam === "B" ? "active" : ""}"
              onclick="selectRandomChallengeTeam('B')"
            >
              <span>الفريق الثاني</span>
              <strong>${escapeDisplayHtml(teamBName || "الفريق الثاني")}</strong>
              <b>يبدأ</b>
            </button>
          </div>
        </section>
      </div>
    `

    highlightRandomChallengeTeam(startingTeam)
    return
  }

  if (box4.secondTeamBreak) {
    const firstTeam = box4.startingTeam || "A"
    const secondTeam = getOtherRandomChallengeTeam(firstTeam)

    stage.innerHTML = `
      <div class="randomBoxView randomTrueFalseView randomTrueFalseBreakView">
        <section class="randomTrueFalseBreakPanel">
          <div class="randomTrueFalseBreakHeading">
            <span>انتهى الدور الأول</span>
            <strong>${escapeDisplayHtml(getRandomChallengeTeamName(firstTeam))}</strong>
            <p>تم الانتهاء من الأسئلة الخمسة</p>
          </div>

          <div class="randomTrueFalseBreakDivider">
            <i></i>
            <span>انتقال الدور</span>
            <i></i>
          </div>

          <div class="randomTrueFalseBreakNext">
            <span>الفريق التالي</span>
            <strong>${escapeDisplayHtml(getRandomChallengeTeamName(secondTeam))}</strong>
            <p>سيبدأ الآن بخمسة أسئلة</p>
          </div>
        </section>
      </div>
    `

    highlightRandomChallengeTeam(secondTeam)
    return
  }

  if (box4.reviewMode) {
    renderRandomBox4Review(stage)
    return
  }

  const number = getRandomBox4QuestionNumber()
  const row = getRandomBox4CurrentRow()
  const question = String(row?.question || "")
  const correctAnswer = String(row?.answer || "")
  const revealed = !!box4.revealed
  const timedOut = box4.selectedAnswer === "انتهى الوقت"
  const activeTeam = getRandomBox4CurrentTeam()
  const activeTeamName = getRandomChallengeTeamName(activeTeam)
  const teamQuestionNumber = ((number - 1) % RANDOM_BOX4_TEAM_QUESTIONS_COUNT) + 1
  const timer = Math.max(0, Number(box4.timer ?? RANDOM_BOX4_TIMER_SECONDS))
  const timerProgress = Math.max(0, Math.min(100, (timer / RANDOM_BOX4_TIMER_SECONDS) * 100))

  stage.innerHTML = `
    <div class="randomBoxView randomTrueFalseView randomTrueFalseLiveView">
      <section class="randomAuctionQuestionCard">
        <div class="randomAuctionQuestionTop">
          <span class="randomAuctionQuestionLabel">${escapeDisplayHtml(activeTeamName)}</span>
          <span class="randomAuctionQuestionNumber">${teamQuestionNumber} / ${RANDOM_BOX4_TEAM_QUESTIONS_COUNT}</span>
        </div>

        <div class="randomAuctionQuestionText">
          ${question ? escapeDisplayHtml(question) : "لا توجد عبارة محفوظة"}
        </div>
      </section>

      <section class="randomTrueFalseStatusRow">
        <article class="randomSpeedTeam randomTrueFalseTeamCard ${activeTeam === "A" ? "active" : ""}">
          <strong class="randomSpeedTeamName">${escapeDisplayHtml(teamAName || "الفريق الأول")}</strong>
          <span>${getRandomChallengeTeamScore("A", 4)} / 5</span>
        </article>

        <div class="randomAuctionStatusCard randomAuctionTimerCard randomTrueFalseTimerCard ${timer > 0 && timer <= 3 && !revealed ? "danger" : ""}">
          <div class="randomAuctionTimerProgress">
            <i
              id="randomBox4TimerProgressBar"
              style="width:${timerProgress}%"
            ></i>
          </div>
          <span class="randomAuctionTimerLabel">الوقت</span>
          <strong id="randomBox4TimerText">${timer}</strong>
        </div>

        <article class="randomSpeedTeam randomTrueFalseTeamCard ${activeTeam === "B" ? "active" : ""}">
          <strong class="randomSpeedTeamName">${escapeDisplayHtml(teamBName || "الفريق الثاني")}</strong>
          <span>${getRandomChallengeTeamScore("B", 4)} / 5</span>
        </article>
      </section>

      ${
        revealed
          ? timedOut
            ? `
              <section class="randomTrueFalseCurrentResult timeout">
                <span>انتهى الوقت</span>
                <strong>اضغط السؤال التالي</strong>
              </section>
            `
            : `
              <section class="randomTrueFalseCurrentResult ${box4.currentWasCorrect ? "correct" : "wrong"}">
                <span>${box4.currentWasCorrect ? "إجابة صحيحة" : "إجابة خاطئة"}</span>
                <strong>الإجابة الصحيحة: ${escapeDisplayHtml(correctAnswer || "غير محددة")}</strong>
              </section>
            `
          : ""
      }
    </div>
  `

  highlightRandomChallengeTeam(activeTeam)
}

function renderRandomBox4Review(stage) {
  const box4 = randomChallengeState.box4
  const results = Array.isArray(box4.results)
    ? [...box4.results].sort((a, b) => Number(a.number || 0) - Number(b.number || 0))
    : []

  const teamAResults = results.filter(result => result.team === "A")
  const teamBResults = results.filter(result => result.team === "B")

  const buildReviewItem = (result, displayNumber) => {
    const resultClass = result.isCorrect ? "correct" : "wrong"
    const statusText = result.isCorrect ? "صحيح" : result.timedOut ? "انتهى الوقت" : "خطأ"

    return `
      <article class="randomTrueFalseReviewItem ${resultClass}">
        <div class="randomTrueFalseReviewItemNumber">${displayNumber}</div>

        <div class="randomTrueFalseReviewItemContent">
          <div class="randomTrueFalseReviewQuestion">
            ${escapeDisplayHtml(result.question || "لا توجد عبارة")}
          </div>

          <div class="randomTrueFalseReviewDetails">
            <div class="randomTrueFalseReviewAnswer">
              <span>الإجابة الصحيحة</span>
              <strong>${escapeDisplayHtml(result.correctAnswer || "غير محددة")}</strong>
            </div>

            <div class="randomTrueFalseReviewExplanation">
              <span>التوضيح</span>
              <p>${escapeDisplayHtml(result.explanation || "لا يوجد توضيح")}</p>
            </div>
          </div>
        </div>

        <div class="randomTrueFalseReviewStatus ${resultClass}">
          ${statusText}
        </div>
      </article>
    `
  }

  const buildTeamColumn = (team, teamResults) => {
    const teamName = team === "A"
      ? teamAName || "الفريق الأول"
      : teamBName || "الفريق الثاني"

    const teamScore = getRandomChallengeTeamScore(team, 4)

    return `
      <section class="randomTrueFalseReviewColumn randomTrueFalseReviewColumn${team}">
        <header class="randomTrueFalseReviewColumnHeader">
          <strong>${escapeDisplayHtml(teamName)}</strong>
          <span>${teamScore} من ${RANDOM_BOX4_TEAM_QUESTIONS_COUNT}</span>
        </header>

        <div class="randomTrueFalseReviewColumnItems">
          ${teamResults.map((result, index) => buildReviewItem(result, index + 1)).join("")}
        </div>
      </section>
    `
  }

  stage.innerHTML = `
    <div class="randomBoxView randomTrueFalseView randomTrueFalseReviewView">
      <div class="randomTrueFalseReviewBoard">
        ${buildTeamColumn("A", teamAResults)}
        ${buildTeamColumn("B", teamBResults)}
      </div>
    </div>
  `
}

function saveRandomBox4Result({ selectedAnswer, isCorrect, timedOut = false }) {
  const box4 = randomChallengeState.box4
  const number = getRandomBox4QuestionNumber()
  const team = getRandomBox4CurrentTeam()
  const row = getRandomBox4CurrentRow()
  const results = Array.isArray(box4.results) ? box4.results : []

  const nextResult = {
    number,
    team,
    question: String(row?.question || ""),
    selectedAnswer: String(selectedAnswer || ""),
    correctAnswer: String(row?.answer || ""),
    explanation: String(row?.explanation || row?.note || ""),
    isCorrect: !!isCorrect,
    timedOut: !!timedOut,
  }

  const existingIndex = results.findIndex(result => Number(result?.number || 0) === number)

  if (existingIndex >= 0) {
    results[existingIndex] = nextResult
  } else {
    results.push(nextResult)
  }

  box4.results = results
}

function startRandomBox4Game() {
  if (randomChallengeState.currentBox !== 4) return

  const box4 = randomChallengeState.box4

  if (box4.started) return

  const selectedTeam = box4.startingTeam || randomChallengeState.activeTeam

  if (!isValidRandomChallengeTeam(selectedTeam)) {
    showGameToast("اختر الفريق الذي يبدأ أولاً")
    return
  }

  stopRandomBox4Timer()

  Object.assign(box4, {
    started: true,
    startingTeam: selectedTeam,
    activeTeam: selectedTeam,
    secondTeamBreak: false,
    currentQuestionNumber: 1,
    timer: RANDOM_BOX4_TIMER_SECONDS,
    timerRunning: false,
    revealed: false,
    reviewMode: false,
    selectedAnswer: "",
    currentWasCorrect: null,
    results: [],
  })

  randomChallengeState.activeTeam = selectedTeam
  setRandomChallengeGameActiveTeam(selectedTeam)
  renderRandomChallengeUI()
  saveRandomChallengeState()
  setTimeout(startRandomBox4Timer, 80)
}

function startRandomBox4Timer() {
  if (randomChallengeState.currentBox !== 4) return

  const box4 = randomChallengeState.box4

  if (
    !box4.started ||
    box4.reviewMode ||
    box4.secondTeamBreak ||
    box4.revealed ||
    box4.timerRunning
  ) {
    return
  }

  stopRandomBox4Timer()

  const activeTeam = getRandomBox4CurrentTeam()

  box4.activeTeam = activeTeam
  randomChallengeState.activeTeam = activeTeam
  box4.timer = RANDOM_BOX4_TIMER_SECONDS
  box4.timerRunning = true

  setRandomTimerSync(box4, RANDOM_BOX4_TIMER_SECONDS)
  highlightRandomChallengeTeam(activeTeam)
  renderRandomChallengeStage()
  renderRandomChallengeControls()
  renderRandomChallengeScores()
  saveRandomChallengeState()

  randomBox4Timer = setInterval(() => {
    box4.timer = Math.max(0, Number(box4.timer || 0) - 1)

    const timer = box4.timer
    const timerText = document.getElementById("randomBox4TimerText")
    const progressBar = document.getElementById("randomBox4TimerProgressBar")
    const timerCard = document.querySelector(".randomTrueFalseTimerCard")

    if (timerText) timerText.textContent = String(timer)

    if (progressBar) {
      progressBar.style.width = `${Math.max(0, Math.min(100, (timer / RANDOM_BOX4_TIMER_SECONDS) * 100))}%`
    }

    if (timerCard) {
      timerCard.classList.toggle("danger", timer > 0 && timer <= 2)
    }

    if (timer > 0) {
      saveRandomChallengeState({ sync: false })
      return
    }

    stopRandomBox4Timer()
    box4.timerRunning = false
    handleRandomBox4Timeout()
  }, 1000)
}

function handleRandomBox4Timeout() {
  if (randomChallengeState.currentBox !== 4) return

  const box4 = randomChallengeState.box4

  if (!box4.started || box4.reviewMode || box4.secondTeamBreak || box4.revealed) return

  stopRandomBox4Timer()

  box4.timer = 0
  box4.timerRunning = false
  box4.revealed = true
  box4.selectedAnswer = "انتهى الوقت"
  box4.currentWasCorrect = false

  saveRandomBox4Result({
    selectedAnswer: "انتهى الوقت",
    isCorrect: false,
    timedOut: true,
  })

  playRandomChallengeFeedback("wrong")
  renderRandomChallengeUI()
  saveRandomChallengeState()
}

function answerRandomBox4(selectedAnswer) {
  if (randomChallengeState.currentBox !== 4) return

  const box4 = randomChallengeState.box4

  if (!box4.started || box4.reviewMode || box4.secondTeamBreak) return

  if (box4.revealed) {
    showGameToast("تم تسجيل نتيجة العبارة")
    return
  }

  const row = getRandomBox4CurrentRow()

  if (!row) {
    showGameToast("لا توجد عبارة محفوظة")
    return
  }

  stopRandomBox4Timer()

  const selected = selectedAnswer === "خطأ" ? "خطأ" : "صح"
  const correctAnswer = String(row.answer || "").trim()
  const isCorrect = selected === correctAnswer
  const team = getRandomBox4CurrentTeam()

  box4.activeTeam = team
  randomChallengeState.activeTeam = team
  box4.timerRunning = false
  box4.revealed = true
  box4.selectedAnswer = selected
  box4.currentWasCorrect = isCorrect

  saveRandomBox4Result({
    selectedAnswer: selected,
    isCorrect,
    timedOut: false,
  })

  if (isCorrect) {
    addRandomChallengeTeamScore(team, 1, 4)
  }

  playRandomChallengeFeedback(isCorrect ? "correct" : "wrong")
  renderRandomChallengeUI()
  saveRandomChallengeState()
}

function startRandomBox4SecondTeam() {
  if (randomChallengeState.currentBox !== 4) return

  const box4 = randomChallengeState.box4

  if (!box4.secondTeamBreak) return

  stopRandomBox4Timer()

  const secondTeam = getOtherRandomChallengeTeam(box4.startingTeam || "A")

  Object.assign(box4, {
    secondTeamBreak: false,
    currentQuestionNumber: RANDOM_BOX4_TEAM_QUESTIONS_COUNT + 1,
    activeTeam: secondTeam,
    timer: RANDOM_BOX4_TIMER_SECONDS,
    timerRunning: false,
    revealed: false,
    selectedAnswer: "",
    currentWasCorrect: null,
  })

  randomChallengeState.activeTeam = secondTeam
  setRandomChallengeGameActiveTeam(secondTeam)
  renderRandomChallengeUI()
  saveRandomChallengeState()
  setTimeout(startRandomBox4Timer, 80)
}

function nextRandomBox4Question() {
  if (randomChallengeState.currentBox !== 4) return

  const box4 = randomChallengeState.box4

  if (box4.reviewMode || box4.secondTeamBreak) return

  if (!box4.revealed) {
    showGameToast("سجّل نتيجة العبارة أولاً")
    return
  }

  stopRandomBox4Timer()

  const current = getRandomBox4QuestionNumber()

  if (current === RANDOM_BOX4_TEAM_QUESTIONS_COUNT) {
    const secondTeam = getOtherRandomChallengeTeam(box4.startingTeam || "A")

    Object.assign(box4, {
      secondTeamBreak: true,
      timer: 0,
      timerRunning: false,
      activeTeam: secondTeam,
    })

    randomChallengeState.activeTeam = secondTeam
    setRandomChallengeGameActiveTeam(secondTeam)
    renderRandomChallengeUI()
    saveRandomChallengeState()
    return
  }

  if (current >= RANDOM_BOX4_QUESTIONS_COUNT) {
    Object.assign(box4, {
      reviewMode: true,
      secondTeamBreak: false,
      timer: 0,
      timerRunning: false,
      revealed: true,
      activeTeam: null,
    })

    randomChallengeState.activeTeam = null
    clearRandomChallengeGameActiveTeam()
    renderRandomChallengeUI()
    saveRandomChallengeState()
    return
  }

  const nextNumber = current + 1

  box4.currentQuestionNumber = nextNumber

  const nextTeam = getRandomBox4CurrentTeam()

  Object.assign(box4, {
    currentQuestionNumber: nextNumber,
    activeTeam: nextTeam,
    secondTeamBreak: false,
    timer: RANDOM_BOX4_TIMER_SECONDS,
    timerRunning: false,
    revealed: false,
    selectedAnswer: "",
    currentWasCorrect: null,
  })

  randomChallengeState.activeTeam = nextTeam
  setRandomChallengeGameActiveTeam(nextTeam)
  renderRandomChallengeUI()
  saveRandomChallengeState()
  setTimeout(startRandomBox4Timer, 80)
}

/* =========================
   17) BOX 5
========================= */

function getRandomBox5CompensationNumber() {
  const total = normalizeRandomChallengeFatblaCount(randomChallengeSettings.fatblaCount || 5)
  return [5, 7, 9].includes(total) ? total : 0
}

function isRandomBox5CompensationNumber(number) {
  const n = Number(number || 0)
  return n > 0 && n === getRandomBox5CompensationNumber()
}

function isRandomBox5CompensationActive() {
  const box5 = randomChallengeState.box5

  return (
    box5?.compensationActive === true &&
    Number(box5?.compensationNumber || 0) === Number(box5?.currentNumber || 0) &&
    isRandomBox5CompensationNumber(box5?.currentNumber)
  )
}

function clearRandomBox5CompensationState() {
  const box5 = randomChallengeState.box5
  if (!box5) return false

  box5.compensationActive = false
  box5.compensationNumber = null
  return true
}

function renderRandomBox5CompensationBadge() {
  document.getElementById("randomBox5CompensationBadge")?.remove()

  const box5 = randomChallengeState.box5

  if (box5?.compensationActive !== true) return

  const wrap = document.querySelector(".randomChallengeWrap")
  if (!wrap) return

  wrap.insertAdjacentHTML(
    "afterbegin",
    `
      <div
        id="randomBox5CompensationBadge"
        class="segmentCompensationBadge randomBox5CompensationBadge"
      >
        التعويض
      </div>
    `,
  )
}

function clearRandomBox5CompensationPress() {
  clearTimeout(randomBox5CompensationPressTimer)
  randomBox5CompensationPressTimer = null

  document
    .querySelectorAll(".segmentCompensationPressing")
    .forEach(el => el.classList.remove("segmentCompensationPressing"))
}

function startRandomBox5CompensationPress(event, number) {
  event.preventDefault()
  event.stopPropagation()

  if (typeof unlockAudioContext === "function") {
    unlockAudioContext()
  }

  clearRandomBox5CompensationPress()

  const n = Number(number || 0)

  if (!isRandomBox5CompensationNumber(n)) return false

  randomBox5CompensationPressActivated = false

  const button = event.currentTarget

  if (event.pointerId && typeof button?.setPointerCapture === "function") {
    button.setPointerCapture(event.pointerId)
  }

  button?.classList.add("segmentCompensationPressing")

  randomBox5CompensationPressTimer = setTimeout(() => {
    randomBox5CompensationPressActivated = true
    button?.classList.remove("segmentCompensationPressing")

    openRandomBox5Number(n, {
      compensation: true,
    })
  }, 700)

  return false
}

function blockRandomBox5CompensationNormalClick(event) {
  event.preventDefault()
  event.stopPropagation()
  clearRandomBox5CompensationPress()

  if (!randomBox5CompensationPressActivated) {
    showGameToast("اضغط مطولاً لتفعيل التعويض")
  }

  randomBox5CompensationPressActivated = false
  return false
}

function renderRandomChallengeBox5() {
  const stage =
    document.getElementById(
      "randomMainStage",
    )

  if (!stage) return

  const box5 =
    randomChallengeState.box5

  const total =
    normalizeRandomChallengeFatblaCount(
      randomChallengeSettings
        .fatblaCount || 5,
    )

  const currentNumber =
    Number(box5.currentNumber || 0)

  const openedNumbers =
    Array.isArray(box5.openedNumbers)
      ? box5.openedNumbers
      : []

  const buildNumberCard = number => {
    const current =
      currentNumber === number

    const opened =
      openedNumbers.includes(number)

    const locked =
      !!currentNumber && !current

    const disabled =
      (opened && !current) || locked || current

    const isCompensation =
      isRandomBox5CompensationNumber(number)

    return `
      <button
        type="button"
        class="
          randomFatblaNumberCard
          ${opened ? "used" : ""}
          ${current ? "active" : ""}
          ${locked ? "locked" : ""}
          ${
            isCompensation && !opened
              ? "segmentCompensationNumber"
              : ""
          }
        "
        ${disabled ? "disabled" : ""}
        ${
          disabled
            ? ""
            : isCompensation
              ? `
                onpointerdown="startRandomBox5CompensationPress(event, ${number})"
                onpointerup="clearRandomBox5CompensationPress()"
                onpointerleave="clearRandomBox5CompensationPress()"
                onpointercancel="clearRandomBox5CompensationPress()"
                oncontextmenu="return false"
                onselectstart="return false"
                onclick="blockRandomBox5CompensationNormalClick(event)"
              `
              : `onclick="openRandomBox5Number(${number})"`
        }
      >
        ${opened && !current ? "" : number}
      </button>
    `
  }

  let grid = ""

  for (let i = 1; i <= total; i++) {
    grid += buildNumberCard(i)
  }

  stage.innerHTML = `
    <div class="randomFatblaWrap">

      <div class="randomFatblaStageWrap">
        <div
          class="randomFatblaStage"
          id="randomFatblaStage"
        >
          ${buildRandomFatblaContent()}
        </div>
      </div>

      <div class="randomFatblaNumbersBar">
        <div
          class="randomFatblaNumbersGrid"
          style="grid-template-columns:repeat(${total},minmax(0,1fr));"
        >
          ${grid}
        </div>
      </div>

    </div>
  `

  renderRandomBox5CompensationBadge()
  const item =
  currentNumber
    ? getRandomFatblaItem(currentNumber)
    : null

const hasImage =
  !!String(item?.image || "").trim() &&
  !String(item?.video || "").trim()

if (
  currentNumber &&
  hasImage &&
  box5.blockArmed &&
  !box5.blockTimerRunning &&
  !box5.revealedAnswer
) {
  setTimeout(() => {
    handleRandomBox5ImageReady()
  }, 150)
}
}
function buildRandomFatblaContent() {
  const box5 =
    randomChallengeState.box5

  const currentNumber =
    Number(box5.currentNumber || 0)

  if (!currentNumber) {
    return `
      <div class="randomFatblaEmptyState">
        اختر الرقم
      </div>
    `
  }

  const item =
    getRandomFatblaItem(currentNumber)

  const revealed =
    !!box5.revealedAnswer

  const blockTimerVisible =
    !!box5.blockTimerVisible

  const blockTimer =
    Math.max(
      0,
      Number(
        box5.blockTimer ??
        RANDOM_BOX5_BLOCK_TIMER_SECONDS,
      ),
    )

  const isVideo =
    !!String(item?.video || "").trim()

  const isImage =
    !!String(item?.image || "").trim() &&
    !isVideo

  const hasMedia =
    isVideo || isImage

  let mediaHTML = ""

  if (isVideo) {
    mediaHTML = `
      <div class="randomFatblaFrame randomFatblaVideoFrame">
        <video
          id="randomBox5InlineVideo"
          src="${escapeDisplayHtml(item.video)}"
          class="randomFatblaVideo"
          playsinline
          controls
          preload="metadata"
          onplay="handleRandomBox5VideoStarted()"
        ></video>
      </div>
    `
  } else if (isImage) {
    mediaHTML = `
      <div class="randomFatblaFrame randomFatblaImageFrame">
        <img
          src="${escapeDisplayHtml(item.image)}"
          class="randomFatblaImage"
          alt=""
          onload="handleRandomBox5ImageReady()"
        >
      </div>
    `
  }

  if (!hasMedia && !revealed) {
    mediaHTML = `
      <div class="randomFatblaEmptyState">
        لا توجد صورة أو فيديو
      </div>
    `
  }

  const answerHTML =
    revealed
      ? `
        <div class="randomFatblaResultBox">
          <div class="randomFatblaAnswerText">
            ${
              escapeDisplayHtml(
                item?.answer ||
                "لا توجد إجابة",
              )
            }
          </div>
        </div>
      `
      : ""

  const blockTimerHTML =
    blockTimerVisible
      ? `
        <div
          id="randomBox5BlockTimer"
          class="
            randomFatblaBlockTimer
            ${blockTimer <= 5 ? "danger" : ""}
          "
        >
          <span>الانتظار</span>

          <strong id="randomBox5BlockTimerText">
            ${blockTimer}
          </strong>
        </div>
      `
      : ""

  const classes = [
    "randomFatblaContent",

    hasMedia && !revealed
      ? "randomFatblaHasMedia"
      : "",

    revealed
      ? "randomFatblaHasAnswer"
      : "",

    !hasMedia && revealed
      ? "randomFatblaTextOnly"
      : "",

    hasMedia && revealed
      ? "randomFatblaMediaHiddenText"
      : "",
  ].filter(Boolean).join(" ")

  return `
    <div class="${classes}">
      ${blockTimerHTML}

      ${
        revealed
          ? ""
          : mediaHTML
      }

      <div class="randomFatblaTextRow">
        ${answerHTML}
      </div>
    </div>
  `
}

function playRandomBox5Video() {
  if (randomChallengeState.currentBox !== 5) return

  const video =
    document.querySelector(
      ".randomChallengeWrap video",
    )

  if (!video) {
    showGameToast("لا يوجد فيديو للتشغيل")
    return
  }

  try {
    video.currentTime = 0
    video.muted = false

    const playResult =
      video.play()

    if (
      playResult &&
      typeof playResult.then === "function"
    ) {
      playResult
        .then(() => {
          handleRandomBox5VideoStarted()
        })
        .catch(error => {
          console.log(
            "RANDOM BOX5 VIDEO PLAY ERROR:",
            error,
          )
        })
    } else {
      handleRandomBox5VideoStarted()
    }
  } catch (error) {
    console.log(
      "RANDOM BOX5 VIDEO PLAY ERROR:",
      error,
    )
  }
}

function renderRandomBox5BlockTimerOnly() {
  const box5 =
    randomChallengeState.box5

  if (!box5) return

  const oldTimer =
    document.getElementById(
      "randomBox5BlockTimer",
    )

  if (
    !box5.blockTimerVisible ||
    !box5.currentNumber
  ) {
    oldTimer?.remove()
    return
  }

  const timer =
    Math.max(
      0,
      Number(
        box5.blockTimer ??
        RANDOM_BOX5_BLOCK_TIMER_SECONDS,
      ),
    )

  if (oldTimer) {
    oldTimer.classList.toggle(
      "danger",
      timer > 0 && timer <= 5,
    )

    const text =
      oldTimer.querySelector(
        "#randomBox5BlockTimerText",
      )

    if (text) {
      text.textContent = String(timer)
    }

    return
  }

  const content =
    document.querySelector(
      ".randomFatblaContent",
    )

  if (!content) return

  content.insertAdjacentHTML(
    "afterbegin",
    `
      <div
        id="randomBox5BlockTimer"
        class="
          randomFatblaBlockTimer
          ${timer <= 5 ? "danger" : ""}
        "
      >
        <span>الانتظار</span>

        <strong id="randomBox5BlockTimerText">
          ${timer}
        </strong>
      </div>
    `,
  )
}

function toggleRandomBox5BlockMode() {
  if (randomChallengeState.currentBox !== 5) return

  const box5 =
    randomChallengeState.box5

  if (!box5 || box5.revealedAnswer) return
  if (box5.blockTimerRunning) return

  box5.blockArmed =
    !box5.blockArmed

  if (!box5.blockArmed) {
    box5.blockTimerVisible = false
    box5.blockTimerRunning = false
    box5.blockTimer =
      RANDOM_BOX5_BLOCK_TIMER_SECONDS

    renderRandomBox5BlockTimerOnly()
  }

  renderRandomChallengeControls()

  saveRandomChallengeState({
    sync: false,
  })
}

function handleRandomBox5BlockAutoStart() {
  if (randomChallengeState.currentBox !== 5) return

  const box5 =
    randomChallengeState.box5

  if (!box5) return
  if (!box5.currentNumber) return
  if (!box5.blockArmed) return
  if (box5.blockTimerRunning) return
  if (box5.revealedAnswer) return

  startRandomBox5BlockTimer()
}

function handleRandomBox5VideoStarted() {
  handleRandomBox5BlockAutoStart()
}

function handleRandomBox5ImageReady() {
  handleRandomBox5BlockAutoStart()
}

function startRandomBox5BlockTimer() {
  if (randomChallengeState.currentBox !== 5) return

  const box5 =
    randomChallengeState.box5

  if (!box5.currentNumber) return
  if (box5.revealedAnswer) return
  if (box5.blockTimerRunning) return

  stopRandomBox5BlockTimer()

  box5.blockArmed = true
  box5.blockTimerVisible = true
  box5.blockTimerRunning = true
  box5.blockTimer =
    RANDOM_BOX5_BLOCK_TIMER_SECONDS

  setRandomTimerSync(
    box5,
    RANDOM_BOX5_BLOCK_TIMER_SECONDS,
    "blockTimerSync",
  )

  renderRandomBox5BlockTimerOnly()
  renderRandomChallengeControls()

  saveRandomChallengeState({
    sync: false,
  })

  randomBox5BlockTimer =
    setInterval(() => {
      box5.blockTimer =
        Math.max(
          0,
          Number(box5.blockTimer || 0) - 1,
        )

      const timer =
        box5.blockTimer

      renderRandomBox5BlockTimerOnly()

      if (timer > 0) {
        saveRandomChallengeState({
          sync: false,
        })

        return
      }

      stopRandomBox5BlockTimer()

      box5.blockArmed = false
      box5.blockTimerVisible = false
      box5.blockTimerRunning = false
      box5.blockTimer =
        RANDOM_BOX5_BLOCK_TIMER_SECONDS

      renderRandomBox5BlockTimerOnly()
      renderRandomChallengeControls()

      saveRandomChallengeState({
        sync: false,
      })
    }, 1000)
}

function openRandomBox5Number(number, options = {}) {
  if (randomChallengeState.currentBox !== 5) return

  const total = normalizeRandomChallengeFatblaCount(randomChallengeSettings.fatblaCount || 5)
  const n = Number(number || 0)

  if (n < 1 || n > total) return

  const isCompensation = isRandomBox5CompensationNumber(n)
  const compensationMode = options.compensation === true

  if (isCompensation && !compensationMode) {
    showGameToast("اضغط مطولاً لتفعيل التعويض")
    return
  }

  const box5 = randomChallengeState.box5

  if (box5.currentNumber) {
    showGameToast("أنهِ الرقم الحالي أولاً")
    return
  }

  const openedNumbers = Array.isArray(box5.openedNumbers) ? box5.openedNumbers : []

  if (openedNumbers.includes(n)) {
    showGameToast("هذا الرقم مستخدم")
    return
  }

  const item = getRandomFatblaItem(n)

  if (!item) {
    showGameToast("لا توجد بيانات لهذا الرقم")
    return
  }

  stopRandomBox5ReturnTimer()
  stopRandomBox5BlockTimer()

  box5.currentNumber = n
  box5.revealedAnswer = false
  box5.compensationActive = isCompensation && compensationMode
  box5.compensationNumber = box5.compensationActive ? n : null
  box5.blockTimerVisible = false
  box5.blockTimerRunning = false
  box5.blockTimer = RANDOM_BOX5_BLOCK_TIMER_SECONDS

  clearRandomChallengeTeamSelection()
  renderRandomChallengeStage()
  renderRandomChallengeControls()
  renderRandomBox5CompensationBadge()
  saveRandomChallengeState()

  if (typeof playGameSound === "function") {
    playGameSound("open")
  }
}

function getRandomBox5SelectedTeam() {
  return randomChallengeState.activeTeam || null
}

function triggerRandomBox5WrongEffect() {
  if (
    randomChallengeState.currentBox !== 5 ||
    !randomChallengeState.box5.currentNumber ||
    randomChallengeState.box5.revealedAnswer
  ) {
    return
  }

  const stage = document.getElementById("randomMainStage")

  if (typeof playGameSound === "function") {
    playGameSound("wrong")
  }

  if (!stage) return

  stage.classList.remove("randomBox5WrongFlash")
  void stage.offsetWidth
  stage.classList.add("randomBox5WrongFlash")

  setTimeout(() => {
    stage.classList.remove("randomBox5WrongFlash")
  }, 650)
}

function revealRandomBox5Answer() {
  if (randomChallengeState.currentBox !== 5) return

  const box5 = randomChallengeState.box5

  if (!box5.currentNumber) {
    showGameToast("اختر رقمًا أولاً")
    return
  }

  if (box5.revealedAnswer) return

  box5.revealedAnswer = true
  renderRandomChallengeStage()
  renderRandomBox5CompensationBadge()
  renderRandomChallengeControls()
  saveRandomChallengeState({ immediate: true })
}

function closeRandomBox5NumberAfterDelay(delay, total) {
  randomBox5ReturnTimer = setTimeout(() => {
    randomBox5ReturnTimer = null

    const latestBox = normalizeRandomChallengeBoxNumber(randomChallengeState.currentBox)
    if (latestBox !== 5) return

    const latestBox5 = randomChallengeState.box5

    latestBox5.currentNumber = null
    latestBox5.revealedAnswer = false
    clearRandomChallengeTeamSelection()

    const openedCount = Array.isArray(latestBox5.openedNumbers)
      ? latestBox5.openedNumbers.length
      : 0

    if (openedCount >= total) {
      finishRandomChallengeCurrentBox()
      return
    }

    renderRandomChallengeStage()
    renderRandomChallengeControls()
    saveRandomChallengeState()
  }, delay)
}

function completeRandomBox5Number(isCorrect) {
  if (normalizeRandomChallengeBoxNumber(randomChallengeState.currentBox) !== 5) return

  const box5 = randomChallengeState.box5
  const currentNumber = Number(box5.currentNumber || 0)

  if (!currentNumber || box5.revealedAnswer) return

  const compensationActive = isRandomBox5CompensationActive()
  const total = normalizeRandomChallengeFatblaCount(randomChallengeSettings.fatblaCount || 5)

  if (isCorrect !== true) {
    triggerRandomBox5WrongEffect()

    if (!compensationActive) return

    stopRandomBox5BlockTimer()
    box5.blockArmed = false
    stopRandomBox5ReturnTimer()

    if (!Array.isArray(box5.openedNumbers)) {
      box5.openedNumbers = []
    }

    if (!box5.openedNumbers.includes(currentNumber)) {
      box5.openedNumbers.push(currentNumber)
    }

    box5.revealedAnswer = true
    box5.blockTimerVisible = false
    box5.blockTimerRunning = false
    box5.blockTimer = RANDOM_BOX5_BLOCK_TIMER_SECONDS

    clearRandomBox5CompensationState()
    renderRandomChallengeStage()
    renderRandomChallengeControls()
    renderRandomBox5CompensationBadge()
    saveRandomChallengeState({ immediate: true })
    closeRandomBox5NumberAfterDelay(3000, total)
    return
  }

  const selectedTeam = getRandomBox5SelectedTeam()

  if (!isValidRandomChallengeTeam(selectedTeam)) {
    showGameToast("اختر الفريق ")
    return
  }

  stopRandomBox5BlockTimer()
  box5.blockArmed = false
  stopRandomBox5ReturnTimer()

  if (!box5.scores || typeof box5.scores !== "object") {
    box5.scores = {
      A: 0,
      B: 0,
    }
  }

  if (!Array.isArray(box5.openedNumbers)) {
    box5.openedNumbers = []
  }

  const scoreA = Number(box5.scores.A || 0)
  const scoreB = Number(box5.scores.B || 0)
  const remainingNumbersCount = total - box5.openedNumbers.length
  const isFinalNumber = remainingNumbersCount === 1
  const isTie = scoreA === scoreB

  const points = compensationActive
    ? 2
    : isFinalNumber && isTie
      ? 2
      : 1

  box5.scores[selectedTeam] = Number(box5.scores[selectedTeam] || 0) + points

  if (!box5.openedNumbers.includes(currentNumber)) {
    box5.openedNumbers.push(currentNumber)
  }

  box5.revealedAnswer = true
  box5.blockTimerVisible = false
  box5.blockTimerRunning = false
  box5.blockTimer = RANDOM_BOX5_BLOCK_TIMER_SECONDS

  clearRandomBox5CompensationState()

  if (typeof playGameSound === "function") {
    playGameSound("correct")
  }

  renderRandomChallengeStage()
  renderRandomBox5CompensationBadge()
  renderRandomChallengeControls()
  saveRandomChallengeState()
  closeRandomBox5NumberAfterDelay(6000, total)
}

function cancelRandomBox5Number() {
  if (randomChallengeState.currentBox !== 5) return

  stopRandomBox5ReturnTimer()
  stopRandomBox5BlockTimer()

  Object.assign(randomChallengeState.box5, {
    currentNumber: null,
    revealedAnswer: false,
    compensationActive: false,
    compensationNumber: null,
    blockTimerVisible: false,
    blockTimerRunning: false,
    blockArmed: false,
    blockTimer: RANDOM_BOX5_BLOCK_TIMER_SECONDS,
  })

  clearRandomTimerSync(randomChallengeState.box5, "blockTimerSync")
  clearRandomChallengeTeamSelection()
  renderRandomChallengeStage()
  renderRandomChallengeControls()
  saveRandomChallengeState({ immediate: true })
}

/* =========================
   18) BOX ACTIONS
========================= */

function openRandomChallengeBox(number) {
  const boxNumber = normalizeRandomChallengeBoxNumber(number)

  if (!boxNumber) return

  if (!isRandomChallengeBoxEnabled(boxNumber)) {
    showGameToast("هذا المربع معطّل")
    return
  }

  if (randomChallengeState.currentBox) {
    showGameToast("أنهِ المربع الحالي أولاً")
    return
  }

  const boxState = getRandomChallengeBoxState(boxNumber)

  if (boxState?.finished) {
    showGameToast("هذا المربع منتهي")
    return
  }

  stopAllRandomChallengeTimers()

  boxState.active = true
  randomChallengeState.currentBox = boxNumber

  if (!boxState.scores) {
    boxState.scores = {
      A: 0,
      B: 0,
    }
  }

  if (boxNumber === 2) {
    Object.assign(randomChallengeState.box2, {
      currentQuestionNumber: 1,
      question: "",
      answer: "",
      numberInput: "",
      currentCount: 0,
      points: 0,
      calculatedPoints: 0,
      timer: RANDOM_BOX2_TIMER_SECONDS,
      timerRunning: false,
      started: false,
    })

    loadRandomBox2CurrentQuestion()
  }

  if (boxNumber === 3 && !randomChallengeState.box3.question) {
    loadRandomBox3CurrentQuestion()
  }

  if (boxNumber === 4) {
    stopRandomBox4Timer()

    Object.assign(randomChallengeState.box4, {
      started: false,
      startingTeam: null,
      activeTeam: null,
      secondTeamBreak: false,
      currentQuestionNumber: 1,
      timer: RANDOM_BOX4_TIMER_SECONDS,
      timerRunning: false,
      revealed: false,
      reviewMode: false,
      selectedAnswer: "",
      currentWasCorrect: null,
      results: [],
    })

    randomChallengeState.activeTeam = null
    clearRandomChallengeGameActiveTeam()
  }

  if (boxNumber !== 4) {
    clearRandomChallengeTeamSelection()
  }

  renderRandomChallengeUI()
  saveRandomChallengeState()

  if (typeof playGameSound === "function") {
    playGameSound("open")
  }
}

function finishRandomChallengeCurrentBox() {
  const boxNumber = normalizeRandomChallengeBoxNumber(randomChallengeState.currentBox)

  if (!boxNumber) return

  const boxState = getRandomChallengeBoxState(boxNumber)

  if (!boxState || boxState.finished) return

  stopAllRandomChallengeTimers()

  const winner = calculateRandomChallengeBoxWinner(boxNumber)

  boxState.active = false
  boxState.finished = true
  boxState.blockArmed = false
  boxState.winner = winner
  boxState.finishedAt = new Date().toISOString()

  if (boxNumber === 1) {
    Object.assign(boxState, {
      started: false,
      rolling: false,
      flashing: false,
      pool: "",
      images: [],
    })
  }

  if (boxNumber === 2) {
    boxState.timerRunning = false
    boxState.started = false
  }

  if (boxNumber === 3) {
    boxState.timerRunning = false
    boxState.choosingPoints = false
    boxState.activeTeam = null
    boxState.scoringTeam = null
    boxState.scoringBoth = false
  }

  if (boxNumber === 4) {
    stopRandomBox4Timer()
    boxState.timerRunning = false
    boxState.activeTeam = null
    boxState.secondTeamBreak = false
  }

  if (boxNumber === 5) {
    stopRandomBox5BlockTimer()
    boxState.currentNumber = null
    boxState.revealedAnswer = false
    boxState.compensationActive = false
    boxState.compensationNumber = null
    boxState.blockTimerVisible = false
    boxState.blockTimerRunning = false
    boxState.blockTimer = RANDOM_BOX5_BLOCK_TIMER_SECONDS
  }

  randomChallengeState.currentBox = null
  clearRandomChallengeTeamSelection()
  calculateRandomChallengeBoxWins()
  calculateRandomChallengeSegmentWinner()
  checkRandomChallengeCompleted()
  renderRandomChallengeUI()
  saveRandomChallengeState()

  if (winner === "A" || winner === "B") {
    showGameToast(`فاز بالجولة ${getRandomChallengeTeamName(winner)}`)
  } else {
    showGameToast("انتهى المربع بالتعادل")
  }
}

function randomChallengeCorrect() {
  const currentBox = normalizeRandomChallengeBoxNumber(randomChallengeState.currentBox)
  const team = randomChallengeState.activeTeam

  if (!currentBox) {
    showGameToast("افتح مربع أولاً")
    return
  }

  if (!isValidRandomChallengeTeam(team)) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  if (currentBox === 1) {
    if (!randomChallengeState.box1.started) {
      showGameToast("اضغط بدء أولاً")
      return
    }

    if (randomChallengeState.box1.rolling) {
      showGameToast("انتظر انتهاء القرعة")
      return
    }

    addRandomChallengeTeamScore(team, 1, 1)
    playRandomChallengeFeedback("correct")

    Object.assign(randomChallengeState.box1, {
      started: false,
      rolling: false,
      flashing: false,
      pool: "",
      images: [],
    })

    clearRandomChallengeTeamSelection()
    renderRandomChallengeUI()
    saveRandomChallengeState()
    return
  }

  if (currentBox === 2) {
    const box2 = randomChallengeState.box2

    if (!box2.started) {
      showGameToast("ابدأ المزاد أولاً")
      return
    }

    const points = getRandomBox2Points()

    if (points <= 0) {
      showGameToast("لا توجد نقاط")
      return
    }

    addRandomChallengeTeamScore(team, points, 2)
    playRandomChallengeFeedback("correct")
    resetRandomBox2AfterScore()
    return
  }

  playRandomChallengeFeedback("correct")
  finishRandomChallengeCurrentBox()
}

function randomChallengeWrong() {
  const currentBox = normalizeRandomChallengeBoxNumber(randomChallengeState.currentBox)

  if (!currentBox) {
    showGameToast("افتح مربع أولاً")
    return
  }

  if (currentBox === 1) {
    if (!randomChallengeState.box1.started || randomChallengeState.box1.rolling) {
      playRandomChallengeFeedback("wrong")
      return
    }

    playRandomChallengeFeedback("wrong")
    resetRandomChallengeBox1()
    return
  }

  if (currentBox === 2) {
    const box2 = randomChallengeState.box2
    const scoringTeam = randomChallengeState.activeTeam

    if (!isValidRandomChallengeTeam(scoringTeam)) {
      showGameToast("اختر الفريق من الهيدر أولاً")
      return
    }

    if (!box2.started) {
      showGameToast("ابدأ المزاد أولاً")
      return
    }

    const originalNumber = Number(box2.numberInput || 0)
    const points = getRandomBox2Points()

    if (points <= 0) {
      showGameToast("لا توجد نقاط")
      return
    }

    if (originalNumber >= 10) {
      const otherTeam = getOtherRandomChallengeTeam(scoringTeam)
      addRandomChallengeTeamScore(otherTeam, points, 2)
    }

    playRandomChallengeFeedback("wrong")
    resetRandomBox2AfterScore()
    return
  }

  playRandomChallengeFeedback("wrong")
}

function checkRandomChallengeCompleted() {
  const enabledCount = getRandomChallengeEnabledCount()
  const completedCount = getRandomChallengeCompletedCount()

  randomChallengeState.completed = enabledCount > 0 && completedCount >= enabledCount

  calculateRandomChallengeBoxWins()

  if (randomChallengeState.completed) {
    calculateRandomChallengeSegmentWinner()
  } else {
    randomChallengeState.segmentWinner = null
  }

  return randomChallengeState.completed
}

/* =========================
   19) CONTROLS
========================= */

function renderRandomChallengeControls() {
  const controls = document.getElementById("randomControlsBar")
  if (!controls) return

  const currentBox = normalizeRandomChallengeBoxNumber(randomChallengeState.currentBox)

  controls.className = "actionBar randomControlsBar randomChallengeActions"

  if (!currentBox) {
    controls.innerHTML = ""
    controls.hidden = true
    return
  }

  controls.hidden = false

  const setControls = (buttonsHtml, options = {}) => {
    const {
      count = 1,
      extraClass = "",
    } = options

    controls.className = `
      actionBar
      randomControlsBar
      randomChallengeActions
      randomChallengeActionsCount${count}
      ${extraClass}
    `.replace(/\s+/g, " ").trim()

    controls.hidden = false
    controls.innerHTML = buttonsHtml
  }

  if (currentBox === 1) {
    const box1 = randomChallengeState.box1

    if (!box1.started) {
      controls.innerHTML = ""
      controls.hidden = true
      return
    }

    setControls(
      `
        <button
          type="button"
          class="randomCtrlBtn randomChallengeActionBtn randomChallengeCorrectBtn"
          onclick="randomChallengeCorrect()"
          ${box1.rolling ? "disabled" : ""}
        >صح</button>

        <button
          type="button"
          class="randomCtrlBtn randomChallengeActionBtn randomChallengeWrongBtn"
          onclick="randomChallengeWrong()"
          ${box1.rolling ? "disabled" : ""}
        >خطأ</button>

        <button
          type="button"
          class="randomCtrlBtn randomChallengeActionBtn randomChallengePrimaryBtn"
          onclick="startRandomChallengeBox1(randomChallengeState.box1.pool || 'saudi')"
          ${box1.rolling ? "disabled" : ""}
        >${box1.rolling ? "جاري الاختيار" : "إعادة القرعة"}</button>
      `,
      {
        count: 3,
        extraClass: "randomChallengeBox1Actions",
      },
    )

    return
  }

  if (currentBox === 2) {
    const box2 = randomChallengeState.box2

    if (!box2.started) {
      setControls(
        `
          <button
            type="button"
            class="randomCtrlBtn randomChallengeActionBtn randomChallengePrimaryBtn"
            onclick="startRandomBox2Timer()"
          >بدء</button>
        `,
        {
          count: 1,
          extraClass: "randomChallengeBox2Actions",
        },
      )

      return
    }

    setControls(
      `
        <button
          type="button"
          class="randomCtrlBtn randomChallengeActionBtn randomChallengeCorrectBtn"
          onclick="randomChallengeCorrect()"
        >صح</button>

        <button
          type="button"
          class="randomCtrlBtn randomChallengeActionBtn randomChallengeWrongBtn"
          onclick="randomChallengeWrong()"
        >خطأ</button>
      `,
      {
        count: 2,
        extraClass: `randomChallengeBox2Actions ${box2.timerRunning ? "timerRunning" : ""}`,
      },
    )

    return
  }

  if (currentBox === 3) {
    const box3 = randomChallengeState.box3

    if (box3.choosingPoints) {
      controls.innerHTML = ""
      controls.hidden = true
      return
    }

    const activeTeam = box3.activeTeam || randomChallengeState.activeTeam
    const errors = box3.errors || { A: 0, B: 0 }
    const passUsed = box3.passUsed || { A: false, B: false }

    const canPass =
      isValidRandomChallengeTeam(activeTeam) &&
      Number(errors[activeTeam] || 0) === 2 &&
      !passUsed[activeTeam] &&
      box3.lastAction !== "pass"

    setControls(
      `
        <button
          type="button"
          class="randomCtrlBtn randomChallengeActionBtn randomChallengePrimaryBtn"
          onclick="switchRandomBox3Team()"
          ${activeTeam ? "" : "disabled"}
        >تبديل الفريق</button>

        <button
          type="button"
          class="randomCtrlBtn randomChallengeActionBtn randomChallengeWrongBtn"
          onclick="randomBox3Wrong()"
          ${activeTeam ? "" : "disabled"}
        >خطأ</button>

        <button
          type="button"
          class="randomCtrlBtn randomChallengeActionBtn randomChallengeSecondaryBtn"
          onclick="randomBox3Pass()"
          ${canPass ? "" : "disabled"}
        >باس</button>

        <button
          type="button"
          class="randomCtrlBtn randomChallengeActionBtn randomChallengeFinishBtn"
          onclick="finishRandomBox3ToPoints()"
        >إنهاء</button>
      `,
      {
        count: 4,
        extraClass: "randomChallengeBox3Actions",
      },
    )

    return
  }

  if (currentBox === 4) {
    const box4 = randomChallengeState.box4

    if (!box4.started) {
      setControls(
        `
          <button
            type="button"
            class="randomCtrlBtn randomChallengeActionBtn randomChallengePrimaryBtn"
            onclick="startRandomBox4Game()"
            ${box4.startingTeam ? "" : "disabled"}
          >بدء</button>
        `,
        {
          count: 1,
          extraClass: "randomChallengeBox4Actions",
        },
      )

      return
    }

    if (box4.secondTeamBreak) {
      setControls(
        `
          <button
            type="button"
            class="randomCtrlBtn randomChallengeActionBtn randomChallengePrimaryBtn"
            onclick="startRandomBox4SecondTeam()"
          >بدء دور الفريق الثاني</button>
        `,
        {
          count: 1,
          extraClass: "randomChallengeBox4Actions",
        },
      )

      return
    }

    if (box4.reviewMode) {
      setControls(
        `
          <button
            type="button"
            class="randomCtrlBtn randomChallengeActionBtn randomChallengeFinishBtn"
            onclick="finishRandomChallengeCurrentBox()"
          >إنهاء المربع</button>
        `,
        {
          count: 1,
          extraClass: "randomChallengeBox4Actions",
        },
      )

      return
    }

    setControls(
      `
        <button
          type="button"
          class="randomCtrlBtn randomChallengeActionBtn randomChallengeCorrectBtn"
          onclick="answerRandomBox4('صح')"
          ${box4.revealed ? "disabled" : ""}
        >صح</button>

        <button
          type="button"
          class="randomCtrlBtn randomChallengeActionBtn randomChallengeWrongBtn"
          onclick="answerRandomBox4('خطأ')"
          ${box4.revealed ? "disabled" : ""}
        >خطأ</button>

        <button
          type="button"
          class="randomCtrlBtn randomChallengeActionBtn randomChallengePrimaryBtn"
          onclick="nextRandomBox4Question()"
          ${box4.revealed ? "" : "disabled"}
        >السؤال التالي</button>
      `,
      {
        count: 3,
        extraClass: "randomChallengeBox4Actions",
      },
    )

    return
  }

if (currentBox === 5) {
  const box5 =
    randomChallengeState.box5 || {}

  const hasNumber =
    !!box5.currentNumber

  const revealed =
    !!box5.revealedAnswer

  const blockArmed =
    !!box5.blockArmed

  const blockRunning =
    !!box5.blockTimerRunning

  const canToggleBlock =
    !revealed &&
    !blockRunning

  controls.innerHTML = `
    <button
      type="button"
      onclick="toggleRandomBox5BlockMode()"
      class="actionBtn randomFatblaBlockButton ${blockArmed ? "active" : ""}"
      ${canToggleBlock ? "" : "disabled"}
    >
      ${
        blockRunning
          ? "البلوك يعمل"
          : blockArmed
            ? "البلوك مفعل"
            : "بلوك"
      }
    </button>

    <button
      type="button"
      onclick="completeRandomBox5Number(true)"
      class="actionBtn btnCorrect"
      ${hasNumber && !revealed ? "" : "disabled"}
    >
      إجابة صحيحة
    </button>

    <button
      type="button"
      onclick="completeRandomBox5Number(false)"
      class="actionBtn btnWrong"
      ${hasNumber && !revealed ? "" : "disabled"}
    >
      خطأ
    </button>

    <button
      type="button"
      onclick="cancelRandomBox5Number()"
      class="actionBtn undoBtn"
      ${hasNumber && !revealed ? "" : "disabled"}
    >
      إلغاء الرقم
    </button>
  `

  return
}
}

/* =========================
   20) HEADER ACTIONS
========================= */

function hasRandomChallengeProgress() {
  return RANDOM_CHALLENGE_BOXES.some(number => {
    if (!isRandomChallengeBoxEnabled(number)) return false

    const boxState = getRandomChallengeBoxState(number)
    const hasScore =
      Number(boxState?.scores?.A || 0) !== 0 ||
      Number(boxState?.scores?.B || 0) !== 0

    return !!boxState?.finished || hasScore
  })
}

function goRandomChallengeHome() {
  if (typeof goHome === "function") {
    goHome()
    return
  }

  if (typeof showSegmentsScreen === "function") {
    showSegmentsScreen()
    return
  }

  if (typeof goBackToSegments === "function") {
    goBackToSegments()
    return
  }

  if (typeof backToSegments === "function") {
    backToSegments()
    return
  }

  if (typeof showDisplayHome === "function") {
    showDisplayHome()
  }
}

function handleRandomChallengeBack() {
  const currentBox = normalizeRandomChallengeBoxNumber(randomChallengeState.currentBox)

  if (!currentBox) {
    goRandomChallengeHome()
    return
  }

  stopAllRandomChallengeTimers()

  const boxState = getRandomChallengeBoxState(currentBox)

  if (boxState) {
    boxState.active = false

    if (currentBox === 1) boxState.rolling = false
    if (currentBox === 2) boxState.timerRunning = false
    if (currentBox === 3) boxState.timerRunning = false

    if (currentBox === 4) {
      stopRandomBox4Timer()
      boxState.timerRunning = false
    }

    if (currentBox === 5) {
      boxState.blockTimerRunning = false
      boxState.compensationActive = false
      boxState.compensationNumber = null
    }
  }

  randomChallengeState.currentBox = null
  clearRandomChallengeTeamSelection()
  renderRandomChallengeUI()
  saveRandomChallengeState()
}

function handleRandomChallengeEnd() {
  if (randomChallengeState.currentBox) {
    showGameToast("أنهِ المربع الحالي أو ارجع للمربعات")
    return
  }

  const completedCount = getRandomChallengeCompletedCount()

  if (completedCount < 1) {
    showGameToast("أنهِ مربعًا واحدًا على الأقل")
    return
  }

  stopAllRandomChallengeTimers()

  const wins = calculateRandomChallengeBoxWins()
  const winner = calculateRandomChallengeSegmentWinner()

  randomChallengeState.completed = true
  randomChallengeState.segmentWinner = winner
  randomChallengeState.activeTeam = null
  randomChallengeState.scores = {
    A: wins.A,
    B: wins.B,
  }

  clearRandomChallengeGameActiveTeam()
  highlightRandomChallengeTeam(null)
  updateRandomChallengeWindowState()
  saveRandomChallengeState()

  if (winner === "A" || winner === "B") {
    showGameToast(`فاز بالتحدي ${getRandomChallengeTeamName(winner)} بعدد ${wins[winner]} مربعات`)
  } else {
    showGameToast("انتهت فقرة التحدي بالتعادل")
  }

  if (typeof endCurrentSegment === "function") {
    endCurrentSegment()
  }
}

/* =========================
   21) WINDOW EXPORTS
========================= */

window.renderRandomChallenge = renderRandomChallenge
window.saveRandomChallengeState = saveRandomChallengeState
window.renderRandomChallengeScores = renderRandomChallengeScores
window.renderRandomChallengeStage = renderRandomChallengeStage
window.renderRandomChallengeControls = renderRandomChallengeControls
window.renderRandomChallengeHeader = renderRandomChallengeHeader

window.highlightRandomChallengeTeam = highlightRandomChallengeTeam
window.clearRandomChallengeTeamSelection = clearRandomChallengeTeamSelection
window.setRandomChallengePresenterTeam = setRandomChallengePresenterTeam
window.selectRandomChallengeTeam = selectRandomChallengeTeam

window.openRandomChallengeBox = openRandomChallengeBox
window.finishRandomChallengeCurrentBox = finishRandomChallengeCurrentBox
window.randomChallengeCorrect = randomChallengeCorrect
window.randomChallengeWrong = randomChallengeWrong

window.startRandomChallengeBox1 = startRandomChallengeBox1
window.resetRandomChallengeBox1 = resetRandomChallengeBox1

window.setRandomBox2NumberValue = setRandomBox2NumberValue
window.updateRandomBox2Number = updateRandomBox2Number
window.appendRandomBox2Digit = appendRandomBox2Digit
window.deleteRandomBox2Digit = deleteRandomBox2Digit
window.clearRandomBox2Number = clearRandomBox2Number
window.increaseRandomBox2Number = increaseRandomBox2Number
window.decreaseRandomBox2Number = decreaseRandomBox2Number
window.startRandomBox2Timer = startRandomBox2Timer
window.nextRandomBox2Question = nextRandomBox2Question
window.decreaseRandomBox2Count = decreaseRandomBox2Count

window.startRandomBox3Timer = startRandomBox3Timer
window.switchRandomBox3Team = switchRandomBox3Team
window.randomBox3Wrong = randomBox3Wrong
window.randomBox3Pass = randomBox3Pass
window.finishRandomBox3ToPoints = finishRandomBox3ToPoints
window.scoreRandomBox3Points = scoreRandomBox3Points
window.nextRandomBox3Question = nextRandomBox3Question

window.startRandomBox4Game = startRandomBox4Game
window.startRandomBox4Timer = startRandomBox4Timer
window.handleRandomBox4Timeout = handleRandomBox4Timeout
window.answerRandomBox4 = answerRandomBox4
window.nextRandomBox4Question = nextRandomBox4Question
window.startRandomBox4SecondTeam = startRandomBox4SecondTeam

window.startRandomBox5CompensationPress = startRandomBox5CompensationPress
window.clearRandomBox5CompensationPress = clearRandomBox5CompensationPress
window.blockRandomBox5CompensationNormalClick = blockRandomBox5CompensationNormalClick
window.openRandomBox5Number = openRandomBox5Number
window.completeRandomBox5Number = completeRandomBox5Number
window.startRandomBox5BlockTimer = startRandomBox5BlockTimer
window.cancelRandomBox5Number = cancelRandomBox5Number
window.revealRandomBox5Answer = revealRandomBox5Answer
window.playRandomBox5Video = playRandomBox5Video

window.hasRandomChallengeProgress = hasRandomChallengeProgress
window.checkRandomChallengeCompleted = checkRandomChallengeCompleted
window.handleRandomChallengeBack = handleRandomChallengeBack
window.handleRandomChallengeEnd = handleRandomChallengeEnd
window.goRandomChallengeHome = goRandomChallengeHome

window.getRandomChallengeBoxScores = getRandomChallengeBoxScores
window.calculateRandomChallengeBoxWinner = calculateRandomChallengeBoxWinner
window.calculateRandomChallengeBoxWins = calculateRandomChallengeBoxWins
window.calculateRandomChallengeSegmentWinner = calculateRandomChallengeSegmentWinner
window.toggleRandomBox5BlockMode =
  toggleRandomBox5BlockMode

window.handleRandomBox5VideoStarted =
  handleRandomBox5VideoStarted
  window.handleRandomBox5BlockAutoStart =
  handleRandomBox5BlockAutoStart

window.handleRandomBox5VideoStarted =
  handleRandomBox5VideoStarted

window.handleRandomBox5ImageReady =
  handleRandomBox5ImageReady