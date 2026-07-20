/* =========================================================
   RANDOM CHALLENGE / التحدي
   DISPLAY ONLY - CLEAN VERSION
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

/* =========================
   3) DEFAULT STATE
========================= */

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
    /*
      موجودة للتوافق مع النسخ القديمة فقط.
      نتيجة الفقرة الفعلية أصبحت عدد المربعات.
    */
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

  blockTimerVisible: false,
  blockTimerRunning: false,
  blockTimer: RANDOM_BOX5_BLOCK_TIMER_SECONDS,
},
  }
}

/* =========================
   4) BASIC HELPERS
========================= */

function getRandomChallengeBoxScores(number = randomChallengeState.currentBox) {
  const boxState = getRandomChallengeBoxState(number)

  return {
    A: Number(boxState?.scores?.A || 0),
    B: Number(boxState?.scores?.B || 0),
  }
}

function getRandomChallengeTeamScore(
  team,
  number = randomChallengeState.currentBox,
) {
  if (!isValidRandomChallengeTeam(team)) {
    return 0
  }

  const boxState = getRandomChallengeBoxState(number)

  return Number(boxState?.scores?.[team] || 0)
}

function setRandomChallengeTeamScore(
  team,
  value,
  number = randomChallengeState.currentBox,
) {
  if (!isValidRandomChallengeTeam(team)) {
    return
  }

  const boxState = getRandomChallengeBoxState(number)

  if (!boxState) {
    return
  }

  if (!boxState.scores || typeof boxState.scores !== "object") {
    boxState.scores = {
      A: 0,
      B: 0,
    }
  }

  boxState.scores[team] = Number(value || 0)
}

function addRandomChallengeTeamScore(
  team,
  points,
  number = randomChallengeState.currentBox,
) {
  if (!isValidRandomChallengeTeam(team)) {
    return
  }

  setRandomChallengeTeamScore(
    team,
    getRandomChallengeTeamScore(team, number) + Number(points || 0),
    number,
  )
}

function getRandomChallengeTeamName(team) {
  if (team === "A") {
    return teamAName || "الفريق الأول"
  }

  if (team === "B") {
    return teamBName || "الفريق الثاني"
  }

  return ""
}

function calculateRandomChallengeBoxWinner(number) {
  const scores = getRandomChallengeBoxScores(number)

  if (scores.A > scores.B) {
    return "A"
  }

  if (scores.B > scores.A) {
    return "B"
  }

  return "draw"
}

function calculateRandomChallengeBoxWins() {
  const wins = {
    A: 0,
    B: 0,
  }

  RANDOM_CHALLENGE_BOXES.forEach((number) => {
    if (!isRandomChallengeBoxEnabled(number)) {
      return
    }

    const boxState = getRandomChallengeBoxState(number)

    if (!boxState?.finished) {
      return
    }

    if (boxState.winner === "A") {
      wins.A += 1
    }

    if (boxState.winner === "B") {
      wins.B += 1
    }
  })

  randomChallengeState.boxWins = wins

  return wins
}

function calculateRandomChallengeSegmentWinner() {
  const wins = calculateRandomChallengeBoxWins()

  if (wins.A > wins.B) {
    return "A"
  }

  if (wins.B > wins.A) {
    return "B"
  }

  return "draw"
}

function getRandomChallengeBoxWinnerText(number) {
  const boxState = getRandomChallengeBoxState(number)

  if (!boxState?.finished) {
    return ""
  }

  if (boxState.winner === "A" || boxState.winner === "B") {
    return `الفائز: ${getRandomChallengeTeamName(boxState.winner)}`
  }

  return "تعادل"
}

function getOtherRandomChallengeTeam(team) {
  if (team === "A") return "B"
  if (team === "B") return "A"

  return null
}

function isValidRandomChallengeTeam(team) {
  return team === "A" || team === "B"
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

function getRandomChallengeCompletedCount() {
  return RANDOM_CHALLENGE_BOXES.reduce((total, number) => {
    if (!isRandomChallengeBoxEnabled(number)) {
      return total
    }

    return total + (getRandomChallengeBoxState(number)?.finished ? 1 : 0)
  }, 0)
}

function getRandomChallengeEnabledCount() {
  return RANDOM_CHALLENGE_BOXES.filter((number) => {
    return isRandomChallengeBoxEnabled(number)
  }).length
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

function playRandomChallengeFeedback(type) {
  if (typeof flashScreen === "function") {
    flashScreen(type)
  }

  if (typeof playGameSound === "function") {
    playGameSound(type)
  }
}

function resetRandomChallengeBoxRuntime(number, options = {}) {
  const boxNumber = normalizeRandomChallengeBoxNumber(number)
  const key = getRandomChallengeBoxKey(boxNumber)

  if (!key) return null

  const current = randomChallengeState[key] || {}
  const defaults = createDefaultRandomChallengeState()[key]

  const preserveScores = options.preserveScores !== false
  const preserveWinner = options.preserveWinner !== false

  const next = {
    ...defaults,
    active: options.active === true,

    finished:
      options.finished === undefined
        ? !!current.finished
        : !!options.finished,

    scores: preserveScores
      ? {
          A: Number(current?.scores?.A || 0),
          B: Number(current?.scores?.B || 0),
        }
      : {
          A: 0,
          B: 0,
        },

    winner: preserveWinner ? current.winner || null : null,

    finishedAt: preserveWinner
      ? current.finishedAt || null
      : null,
  }

  if (boxNumber === 1) {
    next.recentTeamKeys = Array.isArray(current.recentTeamKeys)
      ? current.recentTeamKeys.slice(0, RANDOM_BOX1_RECENT_TEAMS_LIMIT)
      : []
  }

  if (boxNumber === 5 && options.preserveOpenedNumbers !== false) {
    next.openedNumbers = Array.isArray(current.openedNumbers)
      ? [...new Set(current.openedNumbers.map(Number).filter(Boolean))]
      : []
  }

  randomChallengeState[key] = next

  return next
}

/* =========================
   5) TIMER HELPERS
========================= */

function stopRandomBox1Roulette() {
  if (!randomBox1RouletteTimer) {
    return
  }

  clearInterval(randomBox1RouletteTimer)

  randomBox1RouletteTimer = null
}

function stopRandomBox2Timer() {
  if (!randomBox2Timer) {
    return
  }

  clearInterval(randomBox2Timer)
  randomBox2Timer = null
}

function stopRandomBox3Timer() {
  if (!randomBox3Timer) {
    return
  }

  clearInterval(randomBox3Timer)
  randomBox3Timer = null
}

function stopRandomBox4Timer() {
  if (!randomBox4Timer) {
    return
  }

  clearInterval(randomBox4Timer)
  randomBox4Timer = null
}
function stopRandomBox5ReturnTimer() {
  if (!randomBox5ReturnTimer) {
    return
  }

  clearTimeout(randomBox5ReturnTimer)
  randomBox5ReturnTimer = null
}

function stopRandomBox5BlockTimer() {
  if (!randomBox5BlockTimer) {
    return
  }

  clearInterval(randomBox5BlockTimer)
  randomBox5BlockTimer = null
}

function stopAllRandomChallengeTimers() {
  stopRandomBox1Roulette()
  stopRandomBox2Timer()
  stopRandomBox3Timer()
  stopRandomBox4Timer()
  stopRandomBox5BlockTimer()
  stopRandomBox5ReturnTimer()
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

    normalized.boxWins = {
    A: Number(savedState.boxWins?.A || 0),
    B: Number(savedState.boxWins?.B || 0),
  }

  normalized.segmentWinner = ["A", "B", "draw"].includes(
    savedState.segmentWinner,
  )
    ? savedState.segmentWinner
    : null

  RANDOM_CHALLENGE_BOXES.forEach((number) => {
    const key = getRandomChallengeBoxKey(number)
    const boxState = normalized[key]

    boxState.scores = {
      A: Number(savedState[key]?.scores?.A || 0),
      B: Number(savedState[key]?.scores?.B || 0),
    }

    boxState.winner = ["A", "B", "draw"].includes(
      savedState[key]?.winner,
    )
      ? savedState[key].winner
      : null

    boxState.finishedAt = savedState[key]?.finishedAt || null
  })

  normalized.scores.A = Number(normalized.scores.A || 0)

  normalized.scores.B = Number(normalized.scores.B || 0)

  normalized.activeTeam = isValidRandomChallengeTeam(normalized.activeTeam)
    ? normalized.activeTeam
    : null

  normalized.currentBox =
    normalizeRandomChallengeBoxNumber(normalized.currentBox) || null

  normalized.completed = !!normalized.completed

  normalized.usedMediaIds = Array.isArray(normalized.usedMediaIds)
    ? normalized.usedMediaIds
    : []

  normalized.box1.images = Array.isArray(normalized.box1.images)
    ? normalized.box1.images
    : []

  normalized.box1.recentTeamKeys = Array.isArray(normalized.box1.recentTeamKeys)
    ? normalized.box1.recentTeamKeys.slice(0, RANDOM_BOX1_RECENT_TEAMS_LIMIT)
    : []

  normalized.box2.currentQuestionNumber = Math.min(
  Math.max(
    Number(
      normalized.box2.currentQuestionNumber || 1,
    ),
    1,
  ),
  RANDOM_BOX2_QUESTIONS_COUNT,
)

normalized.box2.question = String(
  normalized.box2.question || "",
)

normalized.box2.answer = String(
  normalized.box2.answer || "",
)

normalized.box2.numberInput = String(
  normalized.box2.numberInput || "",
)
  .replace(/\D/g, "")
  .slice(0, 5)

normalized.box2.currentCount = Math.max(
  0,
  Number(normalized.box2.currentCount || 0),
)

normalized.box2.points = Math.max(
  0,
  Number(normalized.box2.points || 0),
)

normalized.box2.calculatedPoints = Math.max(
  0,
  Number(normalized.box2.calculatedPoints || 0),
)

normalized.box2.timer = Math.max(
  0,
  Number(
    normalized.box2.timer ??
      RANDOM_BOX2_TIMER_SECONDS,
  ),
)


normalized.box2.timerRunning = false
normalized.box2.started =
  !!normalized.box2.started

  normalized.box3.currentQuestionNumber = Math.min(
    Math.max(Number(normalized.box3.currentQuestionNumber || 1), 1),
    RANDOM_BOX3_QUESTIONS_COUNT,
  )

  normalized.box3.question = String(normalized.box3.question || "")

  normalized.box3.activeTeam = isValidRandomChallengeTeam(normalized.box3.activeTeam)
    ? normalized.box3.activeTeam
    : null

  normalized.box3.scoringTeam = isValidRandomChallengeTeam(normalized.box3.scoringTeam)
    ? normalized.box3.scoringTeam
    : null

  normalized.box3.scoringBoth = !!normalized.box3.scoringBoth

  normalized.box3.errors.A = Math.min(
    3,
    Math.max(0, Number(normalized.box3.errors.A || 0)),
  )

  normalized.box3.errors.B = Math.min(
    3,
    Math.max(0, Number(normalized.box3.errors.B || 0)),
  )

  normalized.box3.passUsed.A = !!normalized.box3.passUsed.A

  normalized.box3.passUsed.B = !!normalized.box3.passUsed.B

  normalized.box3.timer = Math.max(
    0,
    Number(normalized.box3.timer ?? RANDOM_BOX3_TIMER_SECONDS),
  )

  normalized.box3.timerRunning = false

  normalized.box3.choosingPoints = !!normalized.box3.choosingPoints

normalized.box4.started =
  !!normalized.box4.started

normalized.box4.startingTeam =
  isValidRandomChallengeTeam(
    normalized.box4.startingTeam,
  )
    ? normalized.box4.startingTeam
    : null

normalized.box4.currentQuestionNumber =
  Math.min(
    Math.max(
      Number(
        normalized.box4.currentQuestionNumber ||
        1,
      ),
      1,
    ),
    RANDOM_BOX4_QUESTIONS_COUNT,
  )

normalized.box4.activeTeam =
  isValidRandomChallengeTeam(
    normalized.box4.activeTeam,
  )
    ? normalized.box4.activeTeam
    : null

if (
  normalized.box4.started &&
  !normalized.box4.activeTeam
) {
  const startingTeam =
    normalized.box4.startingTeam ||
    "A"

  normalized.box4.activeTeam =
    normalized.box4.currentQuestionNumber <=
    RANDOM_BOX4_TEAM_QUESTIONS_COUNT
      ? startingTeam
      : getOtherRandomChallengeTeam(
          startingTeam,
        )
}

normalized.box4.timer =
  Math.max(
    0,
    Number(
      normalized.box4.timer ??
      RANDOM_BOX4_TIMER_SECONDS,
    ),
  )

normalized.box4.timerRunning = false

normalized.box4.revealed =
  !!normalized.box4.revealed

normalized.box4.reviewMode =
  !!normalized.box4.reviewMode

  normalized.box4.secondTeamBreak =
  !!normalized.box4.secondTeamBreak

normalized.box4.selectedAnswer =
  String(
    normalized.box4.selectedAnswer || "",
  )

normalized.box4.currentWasCorrect =
  typeof normalized.box4
    .currentWasCorrect === "boolean"
    ? normalized.box4.currentWasCorrect
    : null

normalized.box4.results =
  Array.isArray(
    normalized.box4.results,
  )
    ? normalized.box4.results
        .map((result) => {
          return {
            number: Number(
              result?.number || 0,
            ),

            team:
              result?.team === "B"
                ? "B"
                : "A",

            question: String(
              result?.question || "",
            ),

            selectedAnswer: String(
              result?.selectedAnswer || "",
            ),

            correctAnswer: String(
              result?.correctAnswer || "",
            ),

            explanation: String(
              result?.explanation || "",
            ),

            isCorrect:
              !!result?.isCorrect,

            timedOut:
              !!result?.timedOut,
          }
        })
        .filter((result) => {
          return (
            result.number >= 1 &&
            result.number <=
              RANDOM_BOX4_QUESTIONS_COUNT
          )
        })
    : []

  normalized.box5.revealedAnswer = !!normalized.box5.revealedAnswer

  normalized.box5.blockTimerVisible =
  !!normalized.box5.blockTimerVisible

normalized.box5.blockTimerRunning = false

normalized.box5.blockTimer =
  Math.max(
    0,
    Math.min(
      RANDOM_BOX5_BLOCK_TIMER_SECONDS,
      Number(
        normalized.box5.blockTimer ??
        RANDOM_BOX5_BLOCK_TIMER_SECONDS
      ),
    ),
  )

if (
  normalized.box5.blockTimerVisible &&
  normalized.box5.blockTimer <= 0
) {
  normalized.box5.blockTimerVisible = false
  normalized.box5.blockTimer =
    RANDOM_BOX5_BLOCK_TIMER_SECONDS
}


    const oldScoreA = Number(savedState.scores?.A || 0)
  const oldScoreB = Number(savedState.scores?.B || 0)

  const hasNewBoxScores = RANDOM_CHALLENGE_BOXES.some((number) => {
    const boxState = normalized[getRandomChallengeBoxKey(number)]

    return Number(boxState?.scores?.A || 0) !== 0 ||
      Number(boxState?.scores?.B || 0) !== 0
  })


  if (!hasNewBoxScores && normalized.currentBox) {
    const currentBoxState = normalized[
      getRandomChallengeBoxKey(normalized.currentBox)
    ]

    if (currentBoxState) {
      currentBoxState.scores = {
        A: oldScoreA,
        B: oldScoreB,
      }
    }
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

  try {
    localStorage.setItem(
      RANDOM_CHALLENGE_STORAGE_KEY,
      JSON.stringify(randomChallengeState),
    )
  } catch (error) {
    console.log("RANDOM CHALLENGE STATE SAVE ERROR:", error)
  }

  updateRandomChallengeWindowState()

  if (shouldSync && typeof syncDisplayStateToSession === "function") {
    syncDisplayStateToSession()
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

  saveRandomChallengeState({
    sync: options.sync !== false,
  })
}

/* =========================
   7) SETTINGS AND DATA
========================= */

function normalizeRandomChallengeFatblaCount(value) {
  const count = Number(value || 5)

  if (count === 3) return 3
  if (count === 7) return 7

  return 5
}

function getRandomChallengeModelId() {
  return Number(
    window.currentModel || window.gameModel || localStorage.getItem("game_model") || 0,
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

  return (
    rows.find((row) => {
      return Number(row.number || 0) === questionNumber
    }) || null
  )
}

function getRandomFatblaItem(number) {
  const target = Number(number || 0)

  return (
    randomFatblaItems.find((row) => {
      return Number(row.number || 0) === target
    }) || null
  )
}

function createRandomChallengeSettingsMap(rows) {
  const map = {}

  ;(Array.isArray(rows) ? rows : []).forEach((row) => {
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

  ;(Array.isArray(rows) ? rows : []).forEach((row) => {
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
      explanation: String(
  row?.explanation ||
  row?.note ||
  "",
).trim(),
    })
  })

  Object.values(randomChallengeQuestions).forEach((rowsList) => {
    rowsList.sort((a, b) => {
      return Number(a.number || 0) - Number(b.number || 0)
    })
  })
}

function applyRandomFatblaItems(rows) {
  const total = normalizeRandomChallengeFatblaCount(randomChallengeSettings.fatblaCount)

  randomFatblaItems = (Array.isArray(rows) ? rows : [])
    .map((row) => {
      return {
        ...row,

        number: Number(row?.number || 0),

        question: String(row?.question || "").trim(),

        answer: String(row?.answer || "").trim(),
      }
    })
    .filter((row) => {
      return row.number >= 1 && row.number <= total
    })
    .sort((a, b) => {
      return a.number - b.number
    })
    .slice(0, total)
}

async function loadRandomChallengeGameData(options = {}) {
  const forceRefresh = options.forceRefresh === true

  if (randomChallengeDataLoaded && !forceRefresh) {
    return true
  }

  if (randomChallengeDataPromise && !forceRefresh) {
    return randomChallengeDataPromise
  }

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
          .select(
            "id,box_key,number,question,answer,explanation"
           )
          .eq("model", modelId)
          .order("box_key", {
            ascending: true,
          })
          .order("number", {
            ascending: true,
          }),

        db
          .from("auction_questions")
          .select("id,number,question,answer,image,video,note")
          .eq("model", modelId)
          .order("number", {
            ascending: true,
          }),
      ])

      if (settingsResult.error) {
        throw settingsResult.error
      }

      if (questionsResult.error) {
        throw questionsResult.error
      }

      if (fatblaResult.error) {
        throw fatblaResult.error
      }

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

  if (randomMediaLoadPromise && !forceRefresh) {
    return randomMediaLoadPromise
  }

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

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const json = await response.json()

      randomMediaItems = Array.isArray(json)
        ? json.filter((item) => {
            return item && item.image
          })
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
   9) BOX 1 MEDIA
========================= */

function preloadRandomBox1Images() {
  randomBox1PreloadedImages = []

  randomMediaItems.forEach((item) => {
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
    return sharedList.filter(Boolean).map((source, index) => {
      return {
        id: `${safePool}_${index + 1}`,

        image: String(source),
      }
    })
  }

  if (randomBox1PreloadedImages.length >= 2) {
    return randomBox1PreloadedImages
  }

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
  if (!Array.isArray(list) || !list.length) {
    return null
  }

  const index = Math.floor(Math.random() * list.length)

  return list[index] || null
}

function getRandomBox1ItemKey(item) {
  if (!item) return ""

  if (item.id !== undefined && item.id !== null) {
    return String(item.id)
  }

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
  if (!Array.isArray(pair) || pair.length < 2) {
    return false
  }

  const firstKey = getRandomBox1TeamKey(pair[0])

  const secondKey = getRandomBox1TeamKey(pair[1])

  return !!firstKey && !!secondKey && firstKey === secondKey
}

function pairHasTwoNumberedRandomBox1Images(pair = []) {
  if (!Array.isArray(pair) || pair.length < 2) {
    return false
  }

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

  pair.forEach((item) => {
    const key = getRandomBox1TeamKey(item)

    if (!key) return

    const existingIndex = recent.indexOf(key)

    if (existingIndex !== -1) {
      recent.splice(existingIndex, 1)
    }

    recent.unshift(key)
  })

  randomChallengeState.box1.recentTeamKeys = recent.slice(
    0,
    RANDOM_BOX1_RECENT_TEAMS_LIMIT,
  )
}

function pairHasRecentRandomBox1Team(pair = []) {
  const recent = getRandomBox1RecentTeamKeys()

  return pair.some((item) => {
    const key = getRandomBox1TeamKey(item)

    return !!key && recent.includes(key)
  })
}

function getPoolWithoutIds(source, excludedIds = []) {
  const excluded = excludedIds.map(String)

  return (Array.isArray(source) ? source : []).filter((item) => {
    const key = getRandomBox1ItemKey(item)

    return item && item.image && !excluded.includes(key)
  })
}

function pickRandomPairWithRules(source = []) {
  const validSource = (Array.isArray(source) ? source : []).filter((item) => {
    return item && item.image
  })

  if (validSource.length < 2) {
    return []
  }

  const specialPool = validSource.filter(isSpecialImage)

  const normalPool = validSource.filter((item) => {
    return !isSpecialImage(item)
  })

  let first = null
  let second = null

  if (specialPool.length && normalPool.length) {
    const useSpecialFirst = Math.random() < 0.5

    first = useSpecialFirst
      ? getRandomFromList(specialPool)
      : getRandomFromList(normalPool)
  } else {
    first = getRandomFromList(validSource)
  }

  if (!first) return []

  const remaining = getPoolWithoutIds(validSource, [getRandomBox1ItemKey(first)])

  const preferredRemaining = isSpecialImage(first)
    ? remaining.filter((item) => {
        return !isSpecialImage(item)
      })
    : remaining

  second = getRandomFromList(preferredRemaining.length ? preferredRemaining : remaining)

  if (!second) return []

  return [first, second]
}

function pickRandomPairWithTeamVariety(source = []) {
  let fallback = []

  for (let attempt = 0; attempt < 60; attempt++) {
    const pair = pickRandomPairWithRules(source)

    if (pair.length < 2) {
      continue
    }

    if (!fallback.length) {
      fallback = pair
    }

    if (pairHasSameRandomBox1Team(pair)) {
      continue
    }

    if (pairHasTwoNumberedRandomBox1Images(pair)) {
      continue
    }

    if (pairHasRecentRandomBox1Team(pair)) {
      continue
    }

    return pair
  }

  for (let attempt = 0; attempt < 60; attempt++) {
    const pair = pickRandomPairWithRules(source)

    if (pair.length < 2) {
      continue
    }

    if (pairHasSameRandomBox1Team(pair)) {
      continue
    }

    if (pairHasTwoNumberedRandomBox1Images(pair)) {
      continue
    }

    return pair
  }

  return fallback.length ? fallback : pickRandomPairWithRules(source)
}
/* =========================
   MAIN RENDER
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

  const savedCurrentBox = normalizeRandomChallengeBoxNumber(
    randomChallengeState.currentBox,
  )

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
  setTimeout(
    startRandomBox4Timer,
    80,
  )
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
  const currentBox = normalizeRandomChallengeBoxNumber(
    randomChallengeState.currentBox,
  )

  if (!currentBox) {
    updateRandomChallengeWindowState()
    return
  }

  const scoreA = getRandomChallengeTeamScore("A", currentBox)
  const scoreB = getRandomChallengeTeamScore("B", currentBox)

  const scoreAElement = document.getElementById("randomScoreA")
  const scoreBElement = document.getElementById("randomScoreB")

  if (scoreAElement) {
    scoreAElement.innerText = scoreA
  }

  if (scoreBElement) {
    scoreBElement.innerText = scoreB
  }

  updateRandomChallengeWindowState()
}

function renderRandomChallengeHeader() {
  const header = document.getElementById("randomChallengeHeader")

  if (!header) return

  const currentBox = normalizeRandomChallengeBoxNumber(
    randomChallengeState.currentBox,
  )


  if (!currentBox) {
  const wins = calculateRandomChallengeBoxWins()

  header.className =
    "megaHeader randomChallengeDynamicHeader randomChallengeHomeHeader"

  header.innerHTML = `
    <button
      class="dockBtn dockBtnNav"
      type="button"
      onclick="handleRandomChallengeBack()"
    >
      رجوع
    </button>

    <div class="randomChallengeHomeTeam randomChallengeHomeTeamA">
      <strong>
        ${escapeDisplayHtml(teamAName || "الفريق الأول")}
      </strong>

      <b>
        ${wins.A}
      </b>
    </div>

    <div class="randomChallengeHomeTitle">
      <h1>التحدي</h1>
    </div>

    <div class="randomChallengeHomeTeam randomChallengeHomeTeamB">
      <b>
        ${wins.B}
      </b>

      <strong>
        ${escapeDisplayHtml(teamBName || "الفريق الثاني")}
      </strong>
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

  header.className =
    "megaHeader randomChallengeDynamicHeader randomChallengeBoxHeader"

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
        <strong>
          ${escapeDisplayHtml(teamAName || "الفريق الأول")}
        </strong>
      </div>

      <b id="randomScoreA">
        ${getRandomChallengeTeamScore("A", currentBox)}
      </b>
    </div>

    <div class="segmentTitlePlain">
      <h1>
        ${escapeDisplayHtml(title)}
      </h1>
    </div>

    <div
      class="teamMini teamB"
      id="randomTeamBBox"
      onclick="selectRandomChallengeTeam('B')"
    >
      <b id="randomScoreB">
        ${getRandomChallengeTeamScore("B", currentBox)}
      </b>

      <div class="teamNameBlock">
        <strong>
          ${escapeDisplayHtml(teamBName || "الفريق الثاني")}
        </strong>
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
   TEAM
========================= */

function selectRandomChallengeTeam(team) {
  if (!isValidRandomChallengeTeam(team)) return

  if (
  randomChallengeState.currentBox === 4
) {
  const box4 =
    randomChallengeState.box4

  if (box4.reviewMode) {
    return
  }

  if (box4.started) {
    showGameToast(
      "الفريق يتغير تلقائيًا أثناء الأسئلة",
    )

    highlightRandomChallengeTeam(
      getRandomBox4CurrentTeam(),
    )

    return
  }

  const selectedTeam =
    box4.startingTeam === team
      ? null
      : team

  box4.startingTeam =
    selectedTeam

  box4.activeTeam =
    selectedTeam

  randomChallengeState.activeTeam =
    selectedTeam

  if (selectedTeam) {
    if (
      typeof setGameActiveTeam ===
      "function"
    ) {
      setGameActiveTeam(
        selectedTeam,
      )
    }
  } else if (
    typeof clearGameActiveTeam ===
    "function"
  ) {
    clearGameActiveTeam()
  }

  highlightRandomChallengeTeam(
    selectedTeam,
  )

  renderRandomChallengeStage()
  renderRandomChallengeControls()

  saveRandomChallengeState()

  return
}


  const selectedTeam = randomChallengeState.activeTeam === team ? null : team

  randomChallengeState.activeTeam = selectedTeam

  if (selectedTeam) {
    if (typeof setGameActiveTeam === "function") {
      setGameActiveTeam(selectedTeam)
    }
  } else if (typeof clearGameActiveTeam === "function") {
    clearGameActiveTeam()
  }

  const shouldStartBox3Timer =
    randomChallengeState.currentBox === 3 &&
    selectedTeam &&
    !randomChallengeState.box3.choosingPoints

  if (shouldStartBox3Timer) {
    randomChallengeState.box3.activeTeam = selectedTeam

    highlightRandomChallengeTeam(selectedTeam)
    renderRandomChallengeUI({
      scores: false,
    })
    saveRandomChallengeState()

    setTimeout(startRandomBox3Timer, 80)
    return
  }

  if (!selectedTeam && randomChallengeState.currentBox === 3) {
    randomChallengeState.box3.activeTeam = null
  }

  highlightRandomChallengeTeam(selectedTeam)
  saveRandomChallengeState()
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

  if (typeof clearGameActiveTeam === "function") {
    clearGameActiveTeam()
  }

  highlightRandomChallengeTeam(null)
}

function shakeRandomAuctionMetric(el) {
  if (!el) return

  const box =
    el.closest(".randomAuctionLiveCircle") ||
    el.closest(".randomAuctionPointsPro") ||
    el.closest(".randomAuctionInputPro") ||
    el

  box.classList.remove("randomAuctionShake")
  void box.offsetWidth
  box.classList.add("randomAuctionShake")

  setTimeout(() => {
    box.classList.remove("randomAuctionShake")
  }, 360)
}

function setRandomBox2NumberValue(value) {
  if (randomChallengeState.currentBox !== 2) {
    return
  }

  if (randomChallengeState.box2.started) {
  return
}

  const cleanValue = String(value || "")
    .replace(/\D/g, "")
    .slice(0, 5)

  const numberValue = Number(cleanValue || 0)

  const calculatedPoints =
    numberValue <= 0
      ? 0
      : numberValue < 10
        ? 1
        : Math.floor(numberValue / 10)

  Object.assign(randomChallengeState.box2, {
    numberInput: cleanValue,
    currentCount: numberValue,
    points: numberValue,
    calculatedPoints,
  })

  const input = document.getElementById(
    "randomBox2NumberInput",
  )

  const pointsText = document.getElementById(
    "randomBox2PointsText",
  )

  if (input && input.value !== cleanValue) {
    input.value = cleanValue
  }

  if (pointsText) {
    const oldPoints = Number(
      pointsText.innerText || 0,
    )

    pointsText.innerText = calculatedPoints

    if (oldPoints !== calculatedPoints) {
      shakeRandomAuctionMetric(pointsText)
    }
  }

  saveRandomChallengeState({
    sync: false,
  })
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

/* =========================
   STAGE
========================= */

function isRandomChallengeBoxEnabled(number) {
  const boxNumber = normalizeRandomChallengeBoxNumber(number)

  if (!boxNumber) return false

  return randomChallengeSettings[`box${boxNumber}`] !== false
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

function buildRandomChallengeChoiceBox(number) {
  if (!isRandomChallengeBoxEnabled(number)) {
    return ""
  }

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
      class="
        randomMainBox
        randomChallengeChoiceBox
        ${finished ? "locked" : ""}
        ${winnerClass}
      "
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
  const stage =
    document.getElementById(
      "randomMainStage",
    )

  const controls =
    document.getElementById(
      "randomControlsBar",
    )

  const wrap =
    document.querySelector(
      ".randomChallengeWrap",
    )

  if (!stage) return

  const currentBox =
    normalizeRandomChallengeBoxNumber(
      randomChallengeState.currentBox,
    )

  /* =========================
     شاشة المربعات الرئيسية
  ========================= */

  if (!currentBox) {
    if (wrap) {
      wrap.classList.remove(
        "randomChallengeInsideBox",
      )

      wrap.classList.add(
        "randomChallengeBoxesScreen",
      )

      wrap.removeAttribute(
        "data-current-box",
      )
    }

    /*
      إخفاء مربع التحكم نهائيًا
      في شاشة اختيار المربعات
    */

    if (controls) {
      controls.innerHTML = ""
      controls.hidden = true
      controls.style.display = "none"
    }

    const enabledBoxes =
      RANDOM_CHALLENGE_BOXES.filter(
        (number) => {
          return isRandomChallengeBoxEnabled(
            number,
          )
        },
      )

    const boxesHtml =
      enabledBoxes
        .map(
          buildRandomChallengeChoiceBox,
        )
        .join("")

    stage.innerHTML = `
      <div
        class="randomChallengeBoxesHome"
        data-box-count="${
          enabledBoxes.length
        }"
      >
        <div
          class="
            randomBoxesGrid
            randomBoxesGridClean
            randomBoxesGridCentered
          "
        >
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

  /* =========================
     داخل أحد المربعات
  ========================= */

  if (wrap) {
    wrap.classList.remove(
      "randomChallengeBoxesScreen",
    )

    wrap.classList.add(
      "randomChallengeInsideBox",
    )

    wrap.dataset.currentBox =
      String(currentBox)
  }

  if (
    !isRandomChallengeBoxEnabled(
      currentBox,
    )
  ) {
    randomChallengeState.currentBox =
      null

    if (controls) {
      controls.innerHTML = ""
      controls.hidden = true
      controls.style.display = "none"
    }

    renderRandomChallengeUI({
      scores: false,
    })

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

function renderRandomChallengeBox1() {
  const stage = document.getElementById("randomMainStage")

  if (!stage) return

  const images = randomChallengeState.box1.images || []

  const img1 = images[0]?.image || ""
  const img2 = images[1]?.image || ""

  const poolTitle = getRandomBox1PoolTitle(
    randomChallengeState.box1.pool || "saudi"
  )

  /* =========================
     اختيار الفئة
  ========================= */

  if (!randomChallengeState.box1.started) {
    stage.innerHTML = `
      <div class="randomBoxView randomBox1View">

        <div class="randomStartBox randomSharedPlayerStartBox">
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
        </div>

      </div>
    `

    return
  }

  /* =========================
     عرض الصور
  ========================= */

  stage.innerHTML = `
    <div class="randomBoxView randomBox1View">

      <div class="randomBox1CategoryTitle">
        <span>${escapeDisplayHtml(poolTitle)}</span>
      </div>

      <div class="randomImagesDuel">

        <div class="randomImageCard">
          <img
            id="randomRouletteImg1"
            src="${escapeDisplayHtml(img1)}"
            alt=""
          >
        </div>

        <div class="randomVs">
          VS
        </div>

        <div class="randomImageCard">
          <img
            id="randomRouletteImg2"
            src="${escapeDisplayHtml(img2)}"
            alt=""
          >
        </div>

      </div>

    </div>
  `
}

function renderRandomChallengeBox2() {
  const stage =
    document.getElementById(
      "randomMainStage",
    )

  if (!stage) return

  const box2 =
    randomChallengeState.box2

  const questionNumber =
    getRandomBox2QuestionNumber()

  const question =
    String(box2.question || "")

  const numberValue =
    String(box2.numberInput || "")

  const points =
    Math.max(
      0,
      Number(
        box2.calculatedPoints || 0,
      ),
    )

  const count =
    Math.max(
      0,
      Number(
        box2.currentCount ||
        box2.numberInput ||
        0,
      ),
    )

  const timer =
    Math.max(
      0,
      Number(
        box2.timer ??
        RANDOM_BOX2_TIMER_SECONDS,
      ),
    )

  const started =
    !!box2.started

  const timerDanger =
    started && timer <= 5

  const timerProgress =
    Math.max(
      0,
      Math.min(
        100,
        (
          timer /
          RANDOM_BOX2_TIMER_SECONDS
        ) * 100,
      ),
    )

  /* =========================
     قبل البدء
  ========================= */

  if (!started) {
    stage.innerHTML = `
      <div class="randomBoxView randomBox2View">

        <section class="randomAuctionQuestionCard">

          <div class="randomAuctionQuestionTop">

            <span class="randomAuctionQuestionLabel">
              السؤال
            </span>

            <span class="randomAuctionQuestionNumber">
              ${questionNumber}
              /
              ${RANDOM_BOX2_QUESTIONS_COUNT}
            </span>

          </div>

          <div class="randomAuctionQuestionText">
            ${
              question
                ? escapeDisplayHtml(question)
                : "لا يوجد سؤال محفوظ"
            }
          </div>

        </section>

        <section class="randomAuctionEntryRow">

          <div class="randomAuctionEntryCard">

            <span class="randomAuctionEntryLabel">
              العدد
            </span>

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

            <span class="randomAuctionEntryLabel">
              النقاط
            </span>

            <strong
              id="randomBox2PointsText"
              class="randomAuctionEntryValue"
            >
              ${points}
            </strong>

          </div>

        </section>

        <section class="randomAuctionKeypad">

          ${
            [1, 2, 3, 4, 5, 6, 7, 8, 9]
              .map((number) => {
                return `
                  <button
                    type="button"
                    onclick="
                      appendRandomBox2Digit(
                        ${number}
                      )
                    "
                  >
                    ${number}
                  </button>
                `
              })
              .join("")
          }

          <button
            type="button"
            class="randomAuctionKeyClear"
            onclick="clearRandomBox2Number()"
          >
            مسح
          </button>

          <button
            type="button"
            onclick="appendRandomBox2Digit(0)"
          >
            0
          </button>

          <button
            type="button"
            class="randomAuctionKeyDelete"
            onclick="deleteRandomBox2Digit()"
          >
            حذف
          </button>

        </section>

      </div>
    `

    return
  }

  /* =========================
     بعد البدء
  ========================= */

  stage.innerHTML = `
    <div
      class="
        randomBoxView
        randomBox2View
        randomBox2LiveView
      "
    >

      <section class="randomAuctionQuestionCard">

        <div class="randomAuctionQuestionTop">

          <span class="randomAuctionQuestionLabel">
            السؤال
          </span>

          <span class="randomAuctionQuestionNumber">
            ${questionNumber}
            /
            ${RANDOM_BOX2_QUESTIONS_COUNT}
          </span>

        </div>

        <div class="randomAuctionQuestionText">
          ${
            question
              ? escapeDisplayHtml(question)
              : "لا يوجد سؤال محفوظ"
          }
        </div>

      </section>

      <section class="randomAuctionStatusRow">

        <button
          id="randomBox2CountButton"
          type="button"
          class="
            randomAuctionStatusCard
            randomAuctionCountCard
          "
          onclick="decreaseRandomBox2Count()"
          ${count <= 0 ? "disabled" : ""}
        >
          <span>
            العدد
          </span>

          <strong id="randomBox2CountText">
            ${count}
          </strong>
        </button>

        <div
          class="
            randomAuctionStatusCard
            randomAuctionTimerCard
            ${timerDanger ? "danger" : ""}
          "
        >

          <div class="randomAuctionTimerProgress">
            <i
              id="randomBox2TimerProgressBar"
              style="width:${timerProgress}%"
            ></i>
          </div>

          <span class="randomAuctionTimerLabel">
            الوقت
          </span>

          <strong id="randomBox2TimerText">
            ${timer}
          </strong>

        </div>

        <div
          class="
            randomAuctionStatusCard
            randomAuctionPointsCard
          "
        >

          <span>
            النقاط
          </span>

          <strong id="randomBox2PointsText">
            ${points}
          </strong>

        </div>

      </section>

    </div>
  `
}



function decreaseRandomBox2Count() {
  if (randomChallengeState.currentBox !== 2) {
    return
  }

  const box2 = randomChallengeState.box2

  if (!box2.started) {
    return
  }

  const currentCount = Math.max(
    0,
    Number(box2.currentCount || 0),
  )

  if (currentCount <= 0) {
    return
  }

  const nextCount = currentCount - 1

  box2.currentCount = nextCount

  const countText = document.getElementById(
    "randomBox2CountText",
  )

  if (countText) {
    countText.textContent = String(nextCount)
    shakeRandomAuctionMetric(countText)
  }

  const countButton = document.getElementById(
    "randomBox2CountButton",
  )

  if (countButton && nextCount <= 0) {
    countButton.disabled = true
  }

  saveRandomChallengeState({
    sync: false,
  })
}

function renderRandomChallengeBox3() {
  const stage =
    document.getElementById(
      "randomMainStage",
    )

  if (!stage) return

  const box3 =
    randomChallengeState.box3

  const activeTeam =
    box3.activeTeam ||
    randomChallengeState.activeTeam ||
    null

  const timer =
    Math.max(
      0,
      Number(
        box3.timer ??
        RANDOM_BOX3_TIMER_SECONDS,
      ),
    )

  const questionValue =
    String(box3.question || "")

  const errorsA =
    Math.max(
      0,
      Number(box3.errors?.A || 0),
    )

  const errorsB =
    Math.max(
      0,
      Number(box3.errors?.B || 0),
    )

  const teamAActive =
    activeTeam === "A"
      ? "active"
      : ""

  const teamBActive =
    activeTeam === "B"
      ? "active"
      : ""

  const errorsAHtml =
    [1, 2, 3]
      .map((i) => {
        return `
          <span
            class="${i <= errorsA ? "used" : ""}"
          >
            ×
          </span>
        `
      })
      .join("")

  const errorsBHtml =
    [1, 2, 3]
      .map((i) => {
        return `
          <span
            class="${i <= errorsB ? "used" : ""}"
          >
            ×
          </span>
        `
      })
      .join("")

/* =========================
   تسجيل النتيجة
========================= */

if (box3.choosingPoints) {
  const scoringBoth =
    !!box3.scoringBoth

  const scoringTeam =
    box3.scoringTeam ||
    getRandomBox3ScoringInfo().team

  const scoringTeamName =
    scoringBoth
      ? "الفريقين"
      : scoringTeam === "A"
        ? teamAName || "الفريق الأول"
        : teamBName || "الفريق الثاني"

        const resultTeamAClass =
  scoringBoth || scoringTeam === "A"
    ? "active"
    : ""

const resultTeamBClass =
  scoringBoth || scoringTeam === "B"
    ? "active"
    : ""

  stage.innerHTML = `
    <div
      class="
        randomBoxView
        randomBox3View
        randomBox3ResultView
      "
    >

      <section class="randomBox3ResultPanel">

        <div class="randomBox3ResultTitle">

          <span>
            تسجيل النتيجة
          </span>

          <strong>
            ${
              escapeDisplayHtml(
                scoringTeamName,
              )
            }
          </strong>

        </div>

        <div class="randomBox3ResultTeams">

          <article
  class="
    randomBox3ResultTeamCard
    ${resultTeamAClass}
  "
>

            <strong>
              ${
                escapeDisplayHtml(
                  teamAName ||
                  "الفريق الأول",
                )
              }
            </strong>

            <div class="randomBox3ResultErrorMarks">
              ${errorsAHtml}
            </div>

          </article>

          <article
  class="
    randomBox3ResultTeamCard
    ${resultTeamBClass}
  "
>

            <strong>
              ${
                escapeDisplayHtml(
                  teamBName ||
                  "الفريق الثاني",
                )
              }
            </strong>

            <div class="randomBox3ResultErrorMarks">
              ${errorsBHtml}
            </div>

          </article>

        </div>

        <div class="randomBox3ResultPoints">

          <span>
            اختر النقاط
          </span>

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
/* =========================
   السؤال
========================= */

stage.innerHTML = `
  <div
    class="
      randomBoxView
      randomBox3View
      randomBox3LiveView
    "
  >

    <section class="randomAuctionQuestionCard">

  <div class="randomAuctionQuestionTop">

    <span class="randomAuctionQuestionLabel">
      السؤال
    </span>

    <span class="randomAuctionQuestionNumber">
      ${getRandomBox3QuestionNumber()}
      /
      ${RANDOM_BOX3_QUESTIONS_COUNT}
    </span>

  </div>

  <div class="randomAuctionQuestionText">
    ${
      questionValue
        ? escapeDisplayHtml(
            questionValue,
          )
        : "لا يوجد سؤال محفوظ"
    }
  </div>

</section>

    <section class="randomBox3StatusRow">

      <article
        class="
          randomSpeedTeam
          randomBox3TeamCard
          ${teamAActive}
        "
      >

        <strong class="randomSpeedTeamName">
          ${
            escapeDisplayHtml(
              teamAName ||
              "الفريق الأول",
            )
          }
        </strong>

        <div class="randomTeamErrors">
          ${errorsAHtml}
        </div>

      </article>

      <div
        class="
          randomAuctionStatusCard
          randomAuctionTimerCard
          randomBox3TimerCard
        "
      >

        <div
          id="randomBox3TimerFill"
          class="randomAuctionTimerFill"
        ></div>

        <span class="randomAuctionTimerLabel">
          المؤقت
        </span>

        <strong id="randomBox3TimerText">
          ${timer}
        </strong>

      </div>

      <article
        class="
          randomSpeedTeam
          randomBox3TeamCard
          ${teamBActive}
        "
      >

        <strong class="randomSpeedTeamName">
          ${
            escapeDisplayHtml(
              teamBName ||
              "الفريق الثاني",
            )
          }
        </strong>

        <div class="randomTeamErrors">
          ${errorsBHtml}
        </div>

      </article>

    </section>

  </div>
`
}

function renderRandomChallengeBox4() {
  const stage =
    document.getElementById(
      "randomMainStage",
    )

  if (!stage) return

  const box4 =
    randomChallengeState.box4

  /* =========================
     شاشة البداية
  ========================= */

  if (!box4.started) {
    const startingTeam =
      box4.startingTeam ||
      randomChallengeState.activeTeam ||
      null

    stage.innerHTML = `
      <div
        class="
          randomBoxView
          randomTrueFalseView
          randomTrueFalseStartView
        "
      >

        <section class="randomTrueFalseStartPanel">

          <div class="randomTrueFalseStartHeading">

            <span>
              صح أو خطأ
            </span>

            <strong>
              اختر الفريق الذي يبدأ
            </strong>

            <p>
              لكل فريق 5 أسئلة
              ومدة كل سؤال 10 ثوانٍ
            </p>

          </div>

          <div class="randomTrueFalseStartTeams">

            <button
              type="button"
              class="
                randomTrueFalseStartTeam
                ${
                  startingTeam === "A"
                    ? "active"
                    : ""
                }
              "
              onclick="
                selectRandomChallengeTeam('A')
              "
            >

              <span>
                الفريق الأول
              </span>

              <strong>
                ${
                  escapeDisplayHtml(
                    teamAName ||
                    "الفريق الأول",
                  )
                }
              </strong>

              <b>
                يبدأ
              </b>

            </button>

            <button
              type="button"
              class="
                randomTrueFalseStartTeam
                ${
                  startingTeam === "B"
                    ? "active"
                    : ""
                }
              "
              onclick="
                selectRandomChallengeTeam('B')
              "
            >

              <span>
                الفريق الثاني
              </span>

              <strong>
                ${
                  escapeDisplayHtml(
                    teamBName ||
                    "الفريق الثاني",
                  )
                }
              </strong>

              <b>
                يبدأ
              </b>

            </button>

          </div>

        </section>

      </div>
    `

    highlightRandomChallengeTeam(
      startingTeam,
    )

    return
  }

  /* =========================
   فاصل انتقال الفريق
========================= */

if (box4.secondTeamBreak) {
  const firstTeam =
    box4.startingTeam || "A"

  const secondTeam =
    getOtherRandomChallengeTeam(
      firstTeam,
    )

  stage.innerHTML = `
    <div
      class="
        randomBoxView
        randomTrueFalseView
        randomTrueFalseBreakView
      "
    >

      <section class="randomTrueFalseBreakPanel">

        <div class="randomTrueFalseBreakHeading">

          <span>
            انتهى الدور الأول
          </span>

          <strong>
            ${
              escapeDisplayHtml(
                getRandomChallengeTeamName(
                  firstTeam,
                ),
              )
            }
          </strong>

          <p>
            تم الانتهاء من الأسئلة الخمسة
          </p>

        </div>

        <div class="randomTrueFalseBreakDivider">

          <i></i>

          <span>
            انتقال الدور
          </span>

          <i></i>

        </div>

        <div class="randomTrueFalseBreakNext">

          <span>
            الفريق التالي
          </span>

          <strong>
            ${
              escapeDisplayHtml(
                getRandomChallengeTeamName(
                  secondTeam,
                ),
              )
            }
          </strong>

          <p>
            سيبدأ الآن بخمسة أسئلة
          </p>

        </div>

      </section>

    </div>
  `

  highlightRandomChallengeTeam(
    secondTeam,
  )

  return
}

  /* =========================
     لوحة النتائج
  ========================= */

  if (box4.reviewMode) {
    const results =
      Array.isArray(box4.results)
        ? [...box4.results].sort(
            (a, b) => {
              return (
                Number(a.number || 0) -
                Number(b.number || 0)
              )
            },
          )
        : []

    const teamAResults =
      results.filter((result) => {
        return result.team === "A"
      })

    const teamBResults =
      results.filter((result) => {
        return result.team === "B"
      })

    const buildReviewItem = (
      result,
      displayNumber,
    ) => {
      const resultClass =
        result.isCorrect
          ? "correct"
          : "wrong"

      const statusText =
        result.isCorrect
          ? "صحيح"
          : result.timedOut
            ? "انتهى الوقت"
            : "خطأ"

      return `
        <article
          class="
            randomTrueFalseReviewItem
            ${resultClass}
          "
        >

          <div class="randomTrueFalseReviewItemNumber">
            ${displayNumber}
          </div>

          <div class="randomTrueFalseReviewItemContent">

            <div class="randomTrueFalseReviewQuestion">
              ${
                escapeDisplayHtml(
                  result.question ||
                  "لا توجد عبارة",
                )
              }
            </div>

            <div class="randomTrueFalseReviewDetails">

              <div class="randomTrueFalseReviewAnswer">

                <span>
                  الإجابة الصحيحة
                </span>

                <strong>
                  ${
                    escapeDisplayHtml(
                      result.correctAnswer ||
                      "غير محددة",
                    )
                  }
                </strong>

              </div>

              <div class="randomTrueFalseReviewExplanation">

                <span>
                  التوضيح
                </span>

                <p>
                  ${
                    escapeDisplayHtml(
                      result.explanation ||
                      "لا يوجد توضيح",
                    )
                  }
                </p>

              </div>

            </div>

          </div>

          <div
            class="
              randomTrueFalseReviewStatus
              ${resultClass}
            "
          >
            ${statusText}
          </div>

        </article>
      `
    }

    const buildTeamColumn = (
      team,
      teamResults,
    ) => {
      const teamName =
        team === "A"
          ? teamAName ||
            "الفريق الأول"
          : teamBName ||
            "الفريق الثاني"

      const teamScore =
        getRandomChallengeTeamScore(
          team,
          4,
        )

      return `
        <section
          class="
            randomTrueFalseReviewColumn
            randomTrueFalseReviewColumn${team}
          "
        >

          <header class="randomTrueFalseReviewColumnHeader">

            <strong>
              ${
                escapeDisplayHtml(
                  teamName,
                )
              }
            </strong>

            <span>
              ${teamScore}
              من
              ${RANDOM_BOX4_TEAM_QUESTIONS_COUNT}
            </span>

          </header>

          <div class="randomTrueFalseReviewColumnItems">

            ${
              teamResults
                .map((result, index) => {
                  return buildReviewItem(
                    result,
                    index + 1,
                  )
                })
                .join("")
            }

          </div>

        </section>
      `
    }

    stage.innerHTML = `
      <div
        class="
          randomBoxView
          randomTrueFalseView
          randomTrueFalseReviewView
        "
      >

        <div class="randomTrueFalseReviewBoard">

          ${buildTeamColumn(
            "A",
            teamAResults,
          )}

          ${buildTeamColumn(
            "B",
            teamBResults,
          )}

        </div>

      </div>
    `

    return
  }

  /* =========================
     السؤال الحالي
  ========================= */

  const number =
    getRandomBox4QuestionNumber()

  const row =
    getRandomBox4CurrentRow()

  const question =
    String(row?.question || "")

  const correctAnswer =
    String(row?.answer || "")

  const revealed =
    !!box4.revealed

  const timedOut =
    box4.selectedAnswer ===
    "انتهى الوقت"

  const activeTeam =
    getRandomBox4CurrentTeam()

  const activeTeamName =
    getRandomChallengeTeamName(
      activeTeam,
    )

  const teamQuestionNumber =
    ((number - 1) %
      RANDOM_BOX4_TEAM_QUESTIONS_COUNT) +
    1

  const timer =
    Math.max(
      0,
      Number(
        box4.timer ??
        RANDOM_BOX4_TIMER_SECONDS,
      ),
    )

  const timerProgress =
    Math.max(
      0,
      Math.min(
        100,
        (
          timer /
          RANDOM_BOX4_TIMER_SECONDS
        ) * 100,
      ),
    )

  stage.innerHTML = `
    <div
      class="
        randomBoxView
        randomTrueFalseView
        randomTrueFalseLiveView
      "
    >

      <section class="randomAuctionQuestionCard">

        <div class="randomAuctionQuestionTop">

          <span class="randomAuctionQuestionLabel">
            ${
              escapeDisplayHtml(
                activeTeamName,
              )
            }
          </span>

          <span class="randomAuctionQuestionNumber">
            ${teamQuestionNumber}
            /
            ${RANDOM_BOX4_TEAM_QUESTIONS_COUNT}
          </span>

        </div>

        <div class="randomAuctionQuestionText">
          ${
            question
              ? escapeDisplayHtml(question)
              : "لا توجد عبارة محفوظة"
          }
        </div>

      </section>

      <section class="randomTrueFalseStatusRow">

        <article
          class="
            randomSpeedTeam
            randomTrueFalseTeamCard
            ${
              activeTeam === "A"
                ? "active"
                : ""
            }
          "
        >

          <strong class="randomSpeedTeamName">
            ${
              escapeDisplayHtml(
                teamAName ||
                "الفريق الأول",
              )
            }
          </strong>

          <span>
            ${
              getRandomChallengeTeamScore(
                "A",
                4,
              )
            }
            / 5
          </span>

        </article>

        <div
          class="
            randomAuctionStatusCard
            randomAuctionTimerCard
            randomTrueFalseTimerCard
            ${
              timer > 0 &&
              timer <= 3 &&
              !revealed
                ? "danger"
                : ""
            }
          "
        >

          <div class="randomAuctionTimerProgress">

            <i
              id="randomBox4TimerProgressBar"
              style="width:${timerProgress}%"
            ></i>

          </div>

          <span class="randomAuctionTimerLabel">
            الوقت
          </span>

          <strong id="randomBox4TimerText">
            ${timer}
          </strong>

        </div>

        <article
          class="
            randomSpeedTeam
            randomTrueFalseTeamCard
            ${
              activeTeam === "B"
                ? "active"
                : ""
            }
          "
        >

          <strong class="randomSpeedTeamName">
            ${
              escapeDisplayHtml(
                teamBName ||
                "الفريق الثاني",
              )
            }
          </strong>

          <span>
            ${
              getRandomChallengeTeamScore(
                "B",
                4,
              )
            }
            / 5
          </span>

        </article>

      </section>

      ${
        revealed
          ? timedOut
            ? `
              <section
                class="
                  randomTrueFalseCurrentResult
                  timeout
                "
              >

                <span>
                  انتهى الوقت
                </span>

                <strong>
                  اضغط السؤال التالي
                </strong>

              </section>
            `
            : `
              <section
                class="
                  randomTrueFalseCurrentResult
                  ${
                    box4.currentWasCorrect
                      ? "correct"
                      : "wrong"
                  }
                "
              >

                <span>
                  ${
                    box4.currentWasCorrect
                      ? "إجابة صحيحة"
                      : "إجابة خاطئة"
                  }
                </span>

                <strong>
                  الإجابة الصحيحة:
                  ${
                    escapeDisplayHtml(
                      correctAnswer ||
                      "غير محددة",
                    )
                  }
                </strong>

              </section>
            `
          : ""
      }

    </div>
  `

  highlightRandomChallengeTeam(
    activeTeam,
  )
}

function getRandomBox4QuestionNumber() {
  return Math.min(
    Math.max(
      Number(
        randomChallengeState.box4
          .currentQuestionNumber || 1,
      ),
      1,
    ),
    RANDOM_BOX4_QUESTIONS_COUNT,
  )
}

function getRandomBox4CurrentTeam() {
  const startingTeam =
    isValidRandomChallengeTeam(
      randomChallengeState.box4.startingTeam,
    )
      ? randomChallengeState.box4.startingTeam
      : "A"

  const questionNumber =
    getRandomBox4QuestionNumber()

  if (
    questionNumber <=
    RANDOM_BOX4_TEAM_QUESTIONS_COUNT
  ) {
    return startingTeam
  }

  return getOtherRandomChallengeTeam(
    startingTeam,
  )
}

function getRandomBox4CurrentRow() {
  return getRandomChallengeQuestion(
    "trueFalse",
    getRandomBox4QuestionNumber(),
  )
}

function saveRandomBox4Result({
  selectedAnswer,
  isCorrect,
  timedOut = false,
}) {
  const box4 =
    randomChallengeState.box4

  const number =
    getRandomBox4QuestionNumber()

  const team =
    getRandomBox4CurrentTeam()

  const row =
    getRandomBox4CurrentRow()

  const results =
    Array.isArray(box4.results)
      ? box4.results
      : []

  const nextResult = {
    number,
    team,

    question: String(
      row?.question || "",
    ),

    selectedAnswer: String(
      selectedAnswer || "",
    ),

    correctAnswer: String(
      row?.answer || "",
    ),

    explanation: String(
      row?.explanation ||
      row?.note ||
      "",
    ),

    isCorrect: !!isCorrect,
    timedOut: !!timedOut,
  }

  const existingIndex =
    results.findIndex((result) => {
      return (
        Number(result?.number || 0) ===
        number
      )
    })

  if (existingIndex >= 0) {
    results[existingIndex] =
      nextResult
  } else {
    results.push(nextResult)
  }

  box4.results = results
}

function startRandomBox4Game() {
  if (
    randomChallengeState.currentBox !== 4
  ) {
    return
  }

  const box4 =
    randomChallengeState.box4

  if (box4.started) {
    return
  }

  const selectedTeam =
    box4.startingTeam ||
    randomChallengeState.activeTeam

  if (
    !isValidRandomChallengeTeam(
      selectedTeam,
    )
  ) {
    showGameToast(
      "اختر الفريق الذي يبدأ أولاً",
    )

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

  randomChallengeState.activeTeam =
    selectedTeam

  if (
    typeof setGameActiveTeam ===
    "function"
  ) {
    setGameActiveTeam(
      selectedTeam,
    )
  }

  renderRandomChallengeUI()
  saveRandomChallengeState()

  setTimeout(
    startRandomBox4Timer,
    80,
  )
}

function startRandomBox4Timer() {
  if (
    randomChallengeState.currentBox !== 4
  ) {
    return
  }

  const box4 =
    randomChallengeState.box4

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

  const activeTeam =
    getRandomBox4CurrentTeam()

  box4.activeTeam = activeTeam

  randomChallengeState.activeTeam =
    activeTeam

  box4.timer =
    RANDOM_BOX4_TIMER_SECONDS

  box4.timerRunning = true

  highlightRandomChallengeTeam(
    activeTeam,
  )

  renderRandomChallengeStage()
  renderRandomChallengeControls()
  renderRandomChallengeScores()

  saveRandomChallengeState()

  randomBox4Timer = setInterval(() => {
    box4.timer = Math.max(
      0,
      Number(box4.timer || 0) - 1,
    )

    const timer =
      box4.timer

    const timerText =
      document.getElementById(
        "randomBox4TimerText",
      )

    const progressBar =
      document.getElementById(
        "randomBox4TimerProgressBar",
      )

    const timerCard =
      document.querySelector(
        ".randomTrueFalseTimerCard",
      )

    if (timerText) {
      timerText.textContent =
        String(timer)
    }

    if (progressBar) {
      const progress =
        Math.max(
          0,
          Math.min(
            100,
            (
              timer /
              RANDOM_BOX4_TIMER_SECONDS
            ) * 100,
          ),
        )

      progressBar.style.width =
        `${progress}%`
    }

    if (timerCard) {
      timerCard.classList.toggle(
        "danger",
        timer > 0 && timer <= 2,
      )
    }

    if (timer > 0) {
      saveRandomChallengeState({
        sync: false,
      })

      return
    }

    stopRandomBox4Timer()

    box4.timerRunning = false

    handleRandomBox4Timeout()
  }, 1000)
}

function handleRandomBox4Timeout() {
  if (
    randomChallengeState.currentBox !== 4
  ) {
    return
  }

  const box4 =
    randomChallengeState.box4

  if (
  !box4.started ||
  box4.reviewMode ||
  box4.secondTeamBreak ||
  box4.revealed
) {
  return
}

  stopRandomBox4Timer()

  box4.timer = 0
  box4.timerRunning = false
  box4.revealed = true
  box4.selectedAnswer =
    "انتهى الوقت"

  box4.currentWasCorrect = false

  saveRandomBox4Result({
    selectedAnswer: "انتهى الوقت",
    isCorrect: false,
    timedOut: true,
  })

  playRandomChallengeFeedback(
    "wrong",
  )

  renderRandomChallengeUI()
  saveRandomChallengeState()
}

function answerRandomBox4(
  selectedAnswer,
) {
  if (
    randomChallengeState.currentBox !== 4
  ) {
    return
  }

  const box4 =
    randomChallengeState.box4

  if (
  !box4.started ||
  box4.reviewMode ||
  box4.secondTeamBreak
) {
  return
}

  if (box4.revealed) {
    showGameToast(
      "تم تسجيل نتيجة العبارة",
    )

    return
  }

  const row =
    getRandomBox4CurrentRow()

  if (!row) {
    showGameToast(
      "لا توجد عبارة محفوظة",
    )

    return
  }

  stopRandomBox4Timer()

  const selected =
    selectedAnswer === "خطأ"
      ? "خطأ"
      : "صح"

  const correctAnswer =
    String(row.answer || "").trim()

  const isCorrect =
    selected === correctAnswer

  const team =
    getRandomBox4CurrentTeam()

  box4.activeTeam = team

  randomChallengeState.activeTeam =
    team

  box4.timerRunning = false
  box4.revealed = true
  box4.selectedAnswer = selected

  box4.currentWasCorrect =
    isCorrect

  saveRandomBox4Result({
    selectedAnswer: selected,
    isCorrect,
    timedOut: false,
  })

  if (isCorrect) {
    addRandomChallengeTeamScore(
      team,
      1,
      4,
    )
  }

  playRandomChallengeFeedback(
    isCorrect
      ? "correct"
      : "wrong",
  )

  renderRandomChallengeUI()
  saveRandomChallengeState()
}

function startRandomBox4SecondTeam() {
  if (
    randomChallengeState.currentBox !== 4
  ) {
    return
  }

  const box4 =
    randomChallengeState.box4

  if (!box4.secondTeamBreak) {
    return
  }

  stopRandomBox4Timer()

  const secondTeam =
    getOtherRandomChallengeTeam(
      box4.startingTeam || "A",
    )

  Object.assign(box4, {
    secondTeamBreak: false,

    currentQuestionNumber:
      RANDOM_BOX4_TEAM_QUESTIONS_COUNT +
      1,

    activeTeam: secondTeam,

    timer:
      RANDOM_BOX4_TIMER_SECONDS,

    timerRunning: false,

    revealed: false,

    selectedAnswer: "",

    currentWasCorrect: null,
  })

  randomChallengeState.activeTeam =
    secondTeam

  if (
    typeof setGameActiveTeam ===
    "function"
  ) {
    setGameActiveTeam(secondTeam)
  }

  renderRandomChallengeUI()
  saveRandomChallengeState()

  setTimeout(
    startRandomBox4Timer,
    80,
  )
}

function nextRandomBox4Question() {
  if (
    randomChallengeState.currentBox !== 4
  ) {
    return
  }

  const box4 =
    randomChallengeState.box4

  if (
    box4.reviewMode ||
    box4.secondTeamBreak
  ) {
    return
  }

  if (!box4.revealed) {
    showGameToast(
      "سجّل نتيجة العبارة أولاً",
    )

    return
  }

  stopRandomBox4Timer()

  const current =
    getRandomBox4QuestionNumber()

  /* =========================
     نهاية دور الفريق الأول
  ========================= */

  if (
    current ===
    RANDOM_BOX4_TEAM_QUESTIONS_COUNT
  ) {
    const secondTeam =
      getOtherRandomChallengeTeam(
        box4.startingTeam || "A",
      )

    Object.assign(box4, {
      secondTeamBreak: true,

      timer: 0,
      timerRunning: false,

      activeTeam: secondTeam,
    })

    randomChallengeState.activeTeam =
      secondTeam

    if (
      typeof setGameActiveTeam ===
      "function"
    ) {
      setGameActiveTeam(secondTeam)
    }

    renderRandomChallengeUI()
    saveRandomChallengeState()

    return
  }

  /* =========================
     نهاية الأسئلة
  ========================= */

  if (
    current >=
    RANDOM_BOX4_QUESTIONS_COUNT
  ) {
    Object.assign(box4, {
      reviewMode: true,
      secondTeamBreak: false,

      timer: 0,
      timerRunning: false,

      revealed: true,
      activeTeam: null,
    })

    randomChallengeState.activeTeam =
      null

    if (
      typeof clearGameActiveTeam ===
      "function"
    ) {
      clearGameActiveTeam()
    }

    renderRandomChallengeUI()
    saveRandomChallengeState()

    return
  }

  /* =========================
     السؤال التالي
  ========================= */

  const nextNumber =
    current + 1

  box4.currentQuestionNumber =
    nextNumber

  const nextTeam =
    getRandomBox4CurrentTeam()

  Object.assign(box4, {
    currentQuestionNumber:
      nextNumber,

    activeTeam:
      nextTeam,

    secondTeamBreak: false,

    timer:
      RANDOM_BOX4_TIMER_SECONDS,

    timerRunning: false,

    revealed: false,

    selectedAnswer: "",

    currentWasCorrect: null,
  })

  randomChallengeState.activeTeam =
    nextTeam

  if (
    typeof setGameActiveTeam ===
    "function"
  ) {
    setGameActiveTeam(nextTeam)
  }

  renderRandomChallengeUI()
  saveRandomChallengeState()

  setTimeout(
    startRandomBox4Timer,
    80,
  )
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

  /* =========================
     اختيار الرقم
  ========================= */

  if (!currentNumber) {
  stage.innerHTML = `
    <div
      class="
        randomBoxView
        randomFatblaView
      "
    >
      <div class="randomFatblaNumbers">
        ${
          Array.from(
            {
              length: total,
            },
            (_, index) => {
              const number =
                index + 1

              const opened =
                openedNumbers.includes(
                  number,
                )

              return `
                <button
                  type="button"
                  class="
                    randomFatblaNumber
                    ${
                      opened
                        ? "opened"
                        : ""
                    }
                  "
                  onclick="
                    openRandomBox5Number(
                      ${number}
                    )
                  "
                  ${
                    opened
                      ? "disabled"
                      : ""
                  }
                >
                  ${number}
                </button>
              `
            },
          ).join("")
        }
      </div>
    </div>
  `

  return
}

  const item =
  getRandomFatblaItem(
    currentNumber,
  )

const revealed =
  !!box5.revealedAnswer

stage.innerHTML = `
  <div
    class="
      randomBoxView
      randomFatblaQuestionView
      ${revealed ? "answerVisible" : ""}
    "
  >

    <div class="randomFatblaMedia">

      ${
        item?.video
          ? `
            <video
              src="${
                escapeDisplayHtml(
                  item.video,
                )
              }"
              controls
              autoplay
              playsinline
            ></video>
          `
          : item?.image
            ? `
              <img
                src="${
                  escapeDisplayHtml(
                    item.image,
                  )
                }"
                alt=""
              >
            `
            : `
              <div class="randomPlaceholder">
                لا توجد صورة أو فيديو
              </div>
            `
      }

      ${
        revealed
          ? `
            <div class="randomFatblaAnswerReveal">

              <span class="randomFatblaAnswerLabel">
                الإجابة الصحيحة
              </span>

              <strong class="randomFatblaAnswerText">
                ${
                  escapeDisplayHtml(
                    item?.answer ||
                    "لا توجد إجابة",
                  )
                }
              </strong>

            </div>
          `
          : ""
      }

    </div>

    ${
      blockTimerVisible
        ? `
          <section
            class="
              randomFatblaBlockTimer
              ${
                blockTimer <= 5
                  ? "danger"
                  : ""
              }
            "
          >

            <span>
              بلوك
            </span>

            <strong
              id="randomBox5BlockTimerText"
            >
              ${blockTimer}
            </strong>

          </section>
        `
        : ""
    }

  </div>
`
}

function startRandomBox5BlockTimer() {
  if (
    randomChallengeState.currentBox !== 5
  ) {
    return
  }

  const box5 =
    randomChallengeState.box5

  if (!box5.currentNumber) {
    showGameToast(
      "اختر رقمًا أولاً",
    )

    return
  }

  if (box5.blockTimerRunning) {
    return
  }

  stopRandomBox5BlockTimer()

  box5.blockTimerVisible = true
  box5.blockTimerRunning = true
  box5.blockTimer =
    RANDOM_BOX5_BLOCK_TIMER_SECONDS

  renderRandomChallengeStage()
  renderRandomChallengeControls()

  saveRandomChallengeState()

  if (
    typeof playGameSound ===
    "function"
  ) {
    playGameSound("open")
  }

  randomBox5BlockTimer =
    setInterval(() => {
      box5.blockTimer =
        Math.max(
          0,
          Number(
            box5.blockTimer || 0,
          ) - 1,
        )

      const timer =
        box5.blockTimer

      const timerText =
        document.getElementById(
          "randomBox5BlockTimerText",
        )

      const timerCard =
        document.querySelector(
          ".randomFatblaBlockTimer",
        )

      if (timerText) {
        timerText.textContent =
          String(timer)
      }

      if (timerCard) {
        timerCard.classList.toggle(
          "danger",
          timer > 0 &&
          timer <= 5,
        )
      }

      if (timer > 0) {
        saveRandomChallengeState({
          sync: false,
        })

        return
      }

      stopRandomBox5BlockTimer()

      box5.blockTimerVisible = false
      box5.blockTimerRunning = false
      box5.blockTimer =
        RANDOM_BOX5_BLOCK_TIMER_SECONDS

      renderRandomChallengeStage()
      renderRandomChallengeControls()

      saveRandomChallengeState()

      if (
        typeof playGameSound ===
        "function"
      ) {
        playGameSound("timeout")
      }
    }, 1000)
}

function openRandomBox5Number(number) {
  if (
    randomChallengeState.currentBox !== 5
  ) {
    return
  }

  const total =
    normalizeRandomChallengeFatblaCount(
      randomChallengeSettings
        .fatblaCount || 5,
    )

  const n =
    Number(number || 0)

  if (
    n < 1 ||
    n > total
  ) {
    return
  }

  const box5 =
    randomChallengeState.box5

  const openedNumbers =
    Array.isArray(box5.openedNumbers)
      ? box5.openedNumbers
      : []

  if (
    openedNumbers.includes(n)
  ) {
    showGameToast(
      "هذا الرقم مستخدم",
    )

    return
  }

  const item =
    getRandomFatblaItem(n)

  if (!item) {
    showGameToast(
      "لا توجد بيانات لهذا الرقم",
    )

    return
  }

  stopRandomBox5ReturnTimer()
  stopRandomBox5BlockTimer()

  box5.currentNumber = n
  box5.revealedAnswer = false

  box5.blockTimerVisible = false
  box5.blockTimerRunning = false
  box5.blockTimer =
    RANDOM_BOX5_BLOCK_TIMER_SECONDS

  clearRandomChallengeTeamSelection()

  renderRandomChallengeStage()
  renderRandomChallengeControls()
  saveRandomChallengeState()

  if (
    typeof playGameSound ===
    "function"
  ) {
    playGameSound("open")
  }
}


function getRandomBox5SelectedTeam() {
  if (
    typeof getRandomChallengeSelectedTeam ===
    "function"
  ) {
    return getRandomChallengeSelectedTeam()
  }

  return (
    randomChallengeState.selectedTeam ||
    randomChallengeState.activeTeam ||
    null
  )
}
function triggerRandomBox5WrongEffect() {
  if (
    randomChallengeState.currentBox !== 5 ||
    !randomChallengeState.box5.currentNumber ||
    randomChallengeState.box5.revealedAnswer
  ) {
    return
  }

  const stage =
    document.getElementById("randomMainStage")

  if (
    typeof playGameSound === "function"
  ) {
    playGameSound("wrong")
  }

  if (!stage) {
    return
  }

  stage.classList.remove(
    "randomBox5WrongFlash",
  )

  void stage.offsetWidth

  stage.classList.add(
    "randomBox5WrongFlash",
  )

  setTimeout(() => {
    stage.classList.remove(
      "randomBox5WrongFlash",
    )
  }, 650)
}

function completeRandomBox5Number(isCorrect) {
  if (
    randomChallengeState.currentBox !== 5
  ) {
    return
  }

  const box5 =
    randomChallengeState.box5

  const currentNumber =
    Number(box5.currentNumber || 0)

  if (
    !currentNumber ||
    box5.revealedAnswer
  ) {
    return
  }

  /* =========================
     الإجابة الخاطئة
  ========================= */

  if (!isCorrect) {
    triggerRandomBox5WrongEffect()
    return
  }

  /* =========================
     الإجابة الصحيحة
  ========================= */

  const selectedTeam =
    getRandomBox5SelectedTeam()

  if (
    selectedTeam !== "A" &&
    selectedTeam !== "B"
  ) {
    showGameToast(
      "اختر الفريق الذي أجاب صحيحًا",
    )

    return
  }

  stopRandomBox5BlockTimer()
  stopRandomBox5ReturnTimer()

  const total =
    normalizeRandomChallengeFatblaCount(
      randomChallengeSettings
        .fatblaCount || 5,
    )

  const scoreA =
    Number(box5.scoreA || 0)

  const scoreB =
    Number(box5.scoreB || 0)

  const isFinalNumber =
    currentNumber === total

  const isTie =
    scoreA === scoreB

  const points =
    isFinalNumber && isTie
      ? 2
      : 1

  if (selectedTeam === "A") {
    box5.scoreA =
      scoreA + points
  } else {
    box5.scoreB =
      scoreB + points
  }

  if (
    !Array.isArray(box5.openedNumbers)
  ) {
    box5.openedNumbers = []
  }

  if (
    !box5.openedNumbers.includes(
      currentNumber,
    )
  ) {
    box5.openedNumbers.push(
      currentNumber,
    )
  }

  box5.revealedAnswer = true

  box5.blockTimerVisible = false
  box5.blockTimerRunning = false
  box5.blockTimer =
    RANDOM_BOX5_BLOCK_TIMER_SECONDS

  if (
    typeof playGameSound === "function"
  ) {
    playGameSound("correct")
  }

  renderRandomChallengeStage()
  renderRandomChallengeControls()
  saveRandomChallengeState()

  randomBox5ReturnTimer =
    setTimeout(() => {
      randomBox5ReturnTimer = null

      if (
        randomChallengeState.currentBox !==
        5
      ) {
        return
      }

      box5.currentNumber = null
      box5.revealedAnswer = false

      clearRandomChallengeTeamSelection()

      const allNumbersFinished =
        box5.openedNumbers.length >= total

      if (allNumbersFinished) {
        finishRandomChallengeCurrentBox()
        return
      }

      renderRandomChallengeStage()
      renderRandomChallengeControls()
      saveRandomChallengeState()
    }, 1800)
}



function updateRandomBox1RouletteImages(img1, img2) {
  const el1 = document.getElementById("randomRouletteImg1")
  const el2 = document.getElementById("randomRouletteImg2")

  if (el1 && img1?.image) {
    el1.src = img1.image
  }

  if (el2 && img2?.image) {
    el2.src = img2.image
  }
}

/* =========================
   BOX ACTIONS
========================= */

function openRandomChallengeBox(number) {
  const boxNumber =
    normalizeRandomChallengeBoxNumber(
      number,
    )

  if (!boxNumber) return

  if (
    !isRandomChallengeBoxEnabled(
      boxNumber,
    )
  ) {
    showGameToast(
      "هذا المربع معطّل",
    )

    return
  }

  if (
    randomChallengeState.currentBox
  ) {
    showGameToast(
      "أنهِ المربع الحالي أولاً",
    )

    return
  }

  const boxState =
    getRandomChallengeBoxState(
      boxNumber,
    )

  if (boxState?.finished) {
    showGameToast(
      "هذا المربع منتهي",
    )

    return
  }

  stopAllRandomChallengeTimers()

  boxState.active = true

  randomChallengeState.currentBox =
    boxNumber

  if (!boxState.scores) {
    boxState.scores = {
      A: 0,
      B: 0,
    }
  }

  /* =========================
     BOX 2
  ========================= */

  if (boxNumber === 2) {
    Object.assign(
      randomChallengeState.box2,
      {
        currentQuestionNumber: 1,

        question: "",
        answer: "",

        numberInput: "",
        currentCount: 0,

        points: 0,
        calculatedPoints: 0,

        timer:
          RANDOM_BOX2_TIMER_SECONDS,

        timerRunning: false,
        started: false,
      },
    )

    loadRandomBox2CurrentQuestion()
  }

  /* =========================
     BOX 3
  ========================= */

  if (
    boxNumber === 3 &&
    !randomChallengeState.box3
      .question
  ) {
    loadRandomBox3CurrentQuestion()
  }

  /* =========================
     BOX 4
  ========================= */

  if (boxNumber === 4) {
    stopRandomBox4Timer()

    Object.assign(
  randomChallengeState.box4,
  {
    started: false,

    startingTeam: null,
    activeTeam: null,

    secondTeamBreak: false,

    currentQuestionNumber: 1,

    timer:
      RANDOM_BOX4_TIMER_SECONDS,

    timerRunning: false,

    revealed: false,
    reviewMode: false,

    selectedAnswer: "",
    currentWasCorrect: null,

    results: [],
  },
)

    randomChallengeState.activeTeam =
      null

    if (
      typeof clearGameActiveTeam ===
      "function"
    ) {
      clearGameActiveTeam()
    }
  }

  clearRandomChallengeTeamSelection()

  renderRandomChallengeUI()
  saveRandomChallengeState()

  if (
    typeof playGameSound ===
    "function"
  ) {
    playGameSound("open")
  }
}

function getRandomBox2QuestionNumber() {
  return Math.min(
    Math.max(
      Number(
        randomChallengeState.box2
          .currentQuestionNumber || 1
      ),
      1,
    ),
    RANDOM_BOX2_QUESTIONS_COUNT,
  )
}

function loadRandomBox2CurrentQuestion() {
  const number =
    getRandomBox2QuestionNumber()

  const row = getRandomChallengeQuestion(
    "auction",
    number,
  )

  randomChallengeState.box2.question =
    String(row?.question || "")

  randomChallengeState.box2.answer =
    String(row?.answer || "")

  return row
}

function nextRandomBox2Question() {
  if (randomChallengeState.currentBox !== 2) {
    return
  }

  stopRandomBox2Timer()

  const current =
    getRandomBox2QuestionNumber()

  if (
    current >=
    RANDOM_BOX2_QUESTIONS_COUNT
  ) {
    finishRandomChallengeCurrentBox()
    return
  }

  Object.assign(
    randomChallengeState.box2,
    {
      currentQuestionNumber:
        current + 1,

      question: "",
      answer: "",

      numberInput: "",
      currentCount: 0,

      points: 0,
      calculatedPoints: 0,

      timer:
        RANDOM_BOX2_TIMER_SECONDS,

      timerRunning: false,
    },
  )

  loadRandomBox2CurrentQuestion()

  clearRandomChallengeTeamSelection()

  renderRandomChallengeUI({
    scores: false,
  })

  saveRandomChallengeState()
}

function startRandomBox2Timer() {
  if (randomChallengeState.currentBox !== 2) {
    showGameToast("افتح المزاد أولاً")
    return
  }

  const box2 =
    randomChallengeState.box2

  if (box2.started) {
    return
  }

  const selectedTeam =
    randomChallengeState.activeTeam

  if (!isValidRandomChallengeTeam(selectedTeam)) {
    showGameToast("اختر الفريق من الهيدر أولاً")
    return
  }

  const numberValue =
    Number(box2.numberInput || 0)

  if (numberValue <= 0) {
    showGameToast("اكتب العدد أولاً")
    return
  }

  stopRandomBox2Timer()

  Object.assign(box2, {
    currentCount:numberValue,

    points:numberValue,

    calculatedPoints:
      numberValue < 10
        ? 1
        : Math.floor(numberValue / 10),

    timer:RANDOM_BOX2_TIMER_SECONDS,

    timerRunning:true,
    started:true,
  })

  renderRandomChallengeStage()
  renderRandomChallengeControls()

  saveRandomChallengeState()

randomBox2Timer = setInterval(() => {
  box2.timer =
    Math.max(
      0,
      Number(box2.timer || 0) - 1,
    )

  const timer =
    box2.timer

  const timerText =
    document.getElementById(
      "randomBox2TimerText",
    )

  const timerBox =
    document.querySelector(
      ".randomAuctionTimerCard",
    )

  const timerFill =
    document.getElementById(
      "randomBox2TimerFill",
    )

  if (timerText) {
    timerText.textContent =
      String(timer)
  }

  if (timerFill) {
    const progress =
      Math.max(
        0,
        Math.min(
          100,
          (
            timer /
            RANDOM_BOX2_TIMER_SECONDS
          ) * 100,
        ),
      )

    timerFill.style.setProperty(
      "--timer-progress",
      `${progress}%`,
    )
  }

  if (timerBox) {
    timerBox.classList.toggle(
      "danger",
      timer > 0 && timer <= 5,
    )
  }

    if (timerBox) {
      timerBox.classList.toggle(
        "danger",
        timer > 0 && timer <= 5,
      )

      timerBox.classList.remove(
        "randomAuctionTimerBeat",
      )

      void timerBox.offsetWidth

      timerBox.classList.add(
        "randomAuctionTimerBeat",
      )
    }

    if (timer > 0) {
      saveRandomChallengeState({
        sync:false,
      })

      return
    }

    stopRandomBox2Timer()

    box2.timerRunning = false

    if (timerBox) {
      timerBox.classList.remove(
        "danger",
        "randomAuctionTimerBeat",
      )
    }

    renderRandomChallengeControls()

    saveRandomChallengeState()

    if (
      typeof playGameSound ===
      "function"
    ) {
      playGameSound("timeout")
    }
  }, 1000)
}

function resetRandomBox2AfterScore() {
  stopRandomBox2Timer()

  Object.assign(
    randomChallengeState.box2,
    {
      timerRunning: false,
      started: false,
    },
  )

  nextRandomBox2Question()
}

function getRandomBox2Points() {
  return Math.max(
    0,
    Number(
      randomChallengeState.box2
        .calculatedPoints || 0,
    ),
  )
}

function startRandomChallengeBox1(pool = "saudi") {
  if (randomChallengeState.currentBox !== 1) {
    showGameToast("افتح المربع أولاً")
    return
  }

  if (randomChallengeState.box1.rolling) {
    return
  }

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

  renderRandomChallengeUI({
    scores: false,
  })

  saveRandomChallengeState({
    sync: false,
  })

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

      renderRandomChallengeUI({
        scores: false,
      })

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

function finishRandomChallengeCurrentBox() {
  const boxNumber = normalizeRandomChallengeBoxNumber(
    randomChallengeState.currentBox,
  )

  if (!boxNumber) return

  const boxState = getRandomChallengeBoxState(boxNumber)

  if (!boxState || boxState.finished) {
    return
  }

  stopAllRandomChallengeTimers()

  const winner = calculateRandomChallengeBoxWinner(boxNumber)

  boxState.active = false
  boxState.finished = true
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

  boxState.blockTimerVisible = false
  boxState.blockTimerRunning = false
  boxState.blockTimer =
    RANDOM_BOX5_BLOCK_TIMER_SECONDS
}

  randomChallengeState.currentBox = null

  clearRandomChallengeTeamSelection()

  calculateRandomChallengeBoxWins()
  checkRandomChallengeCompleted()

  renderRandomChallengeUI()
  saveRandomChallengeState()

  if (winner === "A" || winner === "B") {
    showGameToast(
      `فاز بالمربع ${getRandomChallengeTeamName(winner)}`,
    )
  } else {
    showGameToast("انتهى المربع بالتعادل")
  }
}

function randomChallengeCorrect() {
  const currentBox =
    normalizeRandomChallengeBoxNumber(
      randomChallengeState.currentBox,
    )

  const team =
    randomChallengeState.activeTeam

  if (!currentBox) {
    showGameToast("افتح مربع أولاً")
    return
  }

  if (!team) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  /* =========================
     اللاعب المشترك
  ========================= */

  if (currentBox === 1) {
    if (!randomChallengeState.box1.started) {
      showGameToast("اضغط بدء أولاً")
      return
    }

    if (randomChallengeState.box1.rolling) {
      showGameToast("انتظر انتهاء القرعة")
      return
    }

    addRandomChallengeTeamScore(team, 1)

    playRandomChallengeFeedback("correct")

    Object.assign(
      randomChallengeState.box1,
      {
        started: false,
        rolling: false,
        flashing: false,
        pool: "",
        images: [],
      },
    )

    clearRandomChallengeTeamSelection()

    renderRandomChallengeUI()
    saveRandomChallengeState()

    return
  }

  /* =========================
     المزاد
  ========================= */

  if (currentBox === 2) {
    const box2 =
      randomChallengeState.box2

    if (!box2.started) {
      showGameToast("ابدأ المزاد أولاً")
      return
    }

    const points =
      getRandomBox2Points()

    if (points <= 0) {
      showGameToast("لا توجد نقاط")
      return
    }

    addRandomChallengeTeamScore(
      team,
      points,
    )

    playRandomChallengeFeedback("correct")

    resetRandomBox2AfterScore()

    return
  }

  playRandomChallengeFeedback("correct")

  finishRandomChallengeCurrentBox()
}

function randomChallengeWrong() {
  const currentBox =
    normalizeRandomChallengeBoxNumber(
      randomChallengeState.currentBox,
    )

  if (!currentBox) {
    showGameToast("افتح مربع أولاً")
    return
  }

  /* =========================
     المزاد
  ========================= */

  if (currentBox === 2) {
    const box2 =
      randomChallengeState.box2

    const scoringTeam =
      randomChallengeState.activeTeam

    if (
      !isValidRandomChallengeTeam(
        scoringTeam,
      )
    ) {
      showGameToast(
        "اختر الفريق من الهيدر أولاً",
      )

      return
    }

    if (!box2.started) {
      showGameToast("ابدأ المزاد أولاً")
      return
    }

    const originalNumber = Number(
      box2.numberInput || 0,
    )

    const points =
      getRandomBox2Points()

    if (points <= 0) {
      showGameToast("لا توجد نقاط")
      return
    }

    /*
      إذا كان العدد 10 أو أكثر:
      تذهب النقاط للفريق الآخر.
    */

    if (originalNumber >= 10) {
      const otherTeam =
        getOtherRandomChallengeTeam(
          scoringTeam,
        )

      addRandomChallengeTeamScore(
        otherTeam,
        points,
      )
    }

    playRandomChallengeFeedback("wrong")

    resetRandomBox2AfterScore()

    return
  }

  playRandomChallengeFeedback("wrong")
}

function randomChallengeCorrect() {
  const currentBox =
    normalizeRandomChallengeBoxNumber(
      randomChallengeState.currentBox,
    )

  const team =
    randomChallengeState.activeTeam

  if (!currentBox) {
    showGameToast("افتح مربع أولاً")
    return
  }

  if (!team) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  /* =========================
     اللاعب المشترك
  ========================= */

  if (currentBox === 1) {
    if (!randomChallengeState.box1.started) {
      showGameToast("اضغط بدء أولاً")
      return
    }

    if (randomChallengeState.box1.rolling) {
      showGameToast("انتظر انتهاء القرعة")
      return
    }

    addRandomChallengeTeamScore(team, 1)

    playRandomChallengeFeedback("correct")

    Object.assign(
      randomChallengeState.box1,
      {
        started: false,
        rolling: false,
        flashing: false,
        pool: "",
        images: [],
      },
    )

    clearRandomChallengeTeamSelection()

    renderRandomChallengeUI()
    saveRandomChallengeState()

    return
  }

  /* =========================
     المزاد
  ========================= */

  if (currentBox === 2) {
    const box2 =
      randomChallengeState.box2

    if (!box2.started) {
      showGameToast("ابدأ المزاد أولاً")
      return
    }

    const points =
      getRandomBox2Points()

    if (points <= 0) {
      showGameToast("لا توجد نقاط")
      return
    }

    addRandomChallengeTeamScore(
      team,
      points,
    )

    playRandomChallengeFeedback("correct")

    resetRandomBox2AfterScore()

    return
  }

  playRandomChallengeFeedback("correct")

  finishRandomChallengeCurrentBox()
}

function randomChallengeWrong() {
  const currentBox =
    normalizeRandomChallengeBoxNumber(
      randomChallengeState.currentBox,
    )

  if (!currentBox) {
    showGameToast("افتح مربع أولاً")
    return
  }

  /* =========================
     المزاد
  ========================= */

  if (currentBox === 2) {
    const box2 =
      randomChallengeState.box2

    const scoringTeam =
      randomChallengeState.activeTeam

    if (
      !isValidRandomChallengeTeam(
        scoringTeam,
      )
    ) {
      showGameToast(
        "اختر الفريق من الهيدر أولاً",
      )

      return
    }

    if (!box2.started) {
      showGameToast("ابدأ المزاد أولاً")
      return
    }

    const originalNumber = Number(
      box2.numberInput || 0,
    )

    const points =
      getRandomBox2Points()

    if (points <= 0) {
      showGameToast("لا توجد نقاط")
      return
    }

    if (originalNumber >= 10) {
      const otherTeam =
        getOtherRandomChallengeTeam(
          scoringTeam,
        )

      addRandomChallengeTeamScore(
        otherTeam,
        points,
      )
    }

    playRandomChallengeFeedback("wrong")

    resetRandomBox2AfterScore()

    return
  }

  playRandomChallengeFeedback("wrong")
}

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

  renderRandomChallengeUI({
    scores: false,
  })

  saveRandomChallengeState()
}

function startRandomBox3Timer() {
  if (randomChallengeState.currentBox !== 3) {
    return
  }

  if (
    randomChallengeState.box3.choosingPoints ||
    randomChallengeState.box3.timerRunning
  ) {
    return
  }

  const selectedTeam =
    randomChallengeState.box3.activeTeam || randomChallengeState.activeTeam

  if (!selectedTeam) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  stopRandomBox3Timer()

  randomChallengeState.box3.activeTeam = selectedTeam

  randomChallengeState.activeTeam = selectedTeam

  randomChallengeState.box3.timer = RANDOM_BOX3_TIMER_SECONDS

  randomChallengeState.box3.timerRunning = true

  highlightRandomChallengeTeam(selectedTeam)

  renderRandomChallengeUI({
    scores: false,
  })

  saveRandomChallengeState()

  randomBox3Timer = setInterval(() => {
    randomChallengeState.box3.timer = Math.max(
      0,
      Number(randomChallengeState.box3.timer || 0) - 1,
    )

    const timer = randomChallengeState.box3.timer

    const timerText = document.getElementById("randomBox3TimerText")

    if (timerText) {
      timerText.innerText = timer
    }

    if (timer > 0) {
      saveRandomChallengeState({
        sync: false,
      })

      return
    }

    stopRandomBox3Timer()

    randomChallengeState.box3.timerRunning = false

    saveRandomChallengeState()

    if (typeof playGameSound === "function") {
      playGameSound("timeout")
    }
  }, 1000)
}

function switchRandomBox3Team() {
  if (randomChallengeState.currentBox !== 3) {
    return
  }

  if (randomChallengeState.box3.choosingPoints) {
    return
  }

  const currentTeam =
    randomChallengeState.box3.activeTeam || randomChallengeState.activeTeam

  if (!currentTeam) {
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

  renderRandomChallengeUI({
    scores: false,
  })

  saveRandomChallengeState()

  setTimeout(startRandomBox3Timer, 80)
}

function randomBox3Wrong() {
  if (randomChallengeState.currentBox !== 3) {
    return
  }

  if (randomChallengeState.box3.choosingPoints) {
    return
  }

  const team =
    randomChallengeState.box3.activeTeam ||
    randomChallengeState.activeTeam

  if (!team) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  const errors =
    randomChallengeState.box3.errors || {
      A: 0,
      B: 0,
    }

  errors[team] =
    Math.min(
      3,
      Number(errors[team] || 0) + 1,
    )

  randomChallengeState.box3.errors = errors
  randomChallengeState.box3.lastAction = "wrong"

  playRandomChallengeFeedback("wrong")

  saveRandomChallengeState()
  renderRandomChallenge()

  if (errors[team] >= 3) {
    finishRandomBox3ToPoints()
    return
  }

  switchRandomBox3Team()
}

function randomBox3Pass() {
  if (randomChallengeState.currentBox !== 3) {
    return
  }

  if (randomChallengeState.box3.choosingPoints) {
    return
  }

  const team = randomChallengeState.box3.activeTeam || randomChallengeState.activeTeam

  if (!team) {
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
    team:
      randomChallengeState.box3.activeTeam || randomChallengeState.activeTeam || null,
    both: false,
  }
}

function finishRandomBox3ToPoints() {
  if (randomChallengeState.currentBox !== 3) {
    return
  }

  if (randomChallengeState.box3.choosingPoints) {
    return
  }

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

  renderRandomChallengeUI({
    scores: false,
  })

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

  if (![1, 2].includes(value)) {
    return
  }

  if (!randomChallengeState.box3.choosingPoints) {
    return
  }

  const scoringBoth =
    !!randomChallengeState.box3.scoringBoth

  const team =
    randomChallengeState.box3.scoringTeam ||
    getRandomBox3ScoringInfo().team

  if (scoringBoth) {
    addRandomChallengeTeamScore("A", value)
    addRandomChallengeTeamScore("B", value)
  } else {
    if (!team) {
      showGameToast("لا يوجد فريق لتسجيل النقاط")
      return
    }

    addRandomChallengeTeamScore(team, value)
  }

  playRandomChallengeFeedback("correct")

  clearRandomChallengeTeamSelection()
  resetRandomBox3RoundState()

  if (
    getRandomBox3QuestionNumber() >=
    RANDOM_BOX3_QUESTIONS_COUNT
  ) {
    finishRandomChallengeCurrentBox()
    return
  }

  nextRandomBox3Question()
}

function checkRandomChallengeCompleted() {
  const enabledCount = getRandomChallengeEnabledCount()
  const completedCount = getRandomChallengeCompletedCount()

  randomChallengeState.completed =
    enabledCount > 0 &&
    completedCount === enabledCount

  calculateRandomChallengeBoxWins()

  if (randomChallengeState.completed) {
    randomChallengeState.segmentWinner =
      calculateRandomChallengeSegmentWinner()
  }

  return randomChallengeState.completed
}

/* =========================
   CONTROLS
========================= */

function renderRandomChallengeControls() {
  const controls =
    document.getElementById(
      "randomControlsBar",
    )

  if (!controls) {
    return
  }

  const currentBox =
    normalizeRandomChallengeBoxNumber(
      randomChallengeState.currentBox,
    )

  controls.className =
    "actionBar randomControlsBar randomChallengeActions"

  controls.innerHTML = ""

  if (!currentBox) {
    controls.hidden = true
    return
  }

  controls.hidden = false

  const setControls = (
    buttonsHtml,
    options = {},
  ) => {
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

  /* =========================
     1) اللاعب المشترك
  ========================= */

  if (currentBox === 1) {
    const box1 =
      randomChallengeState.box1

    const started =
      !!box1.started

    const rolling =
      !!box1.rolling

    if (!started) {
      controls.hidden = true
      return
    }

    setControls(
      `
        <button
          type="button"
          class="
            randomCtrlBtn
            randomChallengeActionBtn
            randomChallengeCorrectBtn
          "
          onclick="randomChallengeCorrect()"
          ${rolling ? "disabled" : ""}
        >
          صح
        </button>

        <button
          type="button"
          class="
            randomCtrlBtn
            randomChallengeActionBtn
            randomChallengeWrongBtn
          "
          onclick="randomChallengeWrong()"
          ${rolling ? "disabled" : ""}
        >
          خطأ
        </button>

        <button
          type="button"
          class="
            randomCtrlBtn
            randomChallengeActionBtn
            randomChallengePrimaryBtn
          "
          onclick="
            startRandomChallengeBox1(
              randomChallengeState.box1.pool ||
              'saudi'
            )
          "
          ${rolling ? "disabled" : ""}
        >
          ${
            rolling
              ? "جاري الاختيار"
              : "إعادة القرعة"
          }
        </button>
      `,
      {
        count: 3,
        extraClass:
          "randomChallengeBox1Actions",
      },
    )

    return
  }

  /* =========================
     2) المزاد
  ========================= */

  if (currentBox === 2) {
    const box2 =
      randomChallengeState.box2

    const started =
      !!box2.started

    const timerRunning =
      !!box2.timerRunning

    if (!started) {
      setControls(
        `
          <button
            type="button"
            class="
              randomCtrlBtn
              randomChallengeActionBtn
              randomChallengePrimaryBtn
            "
            onclick="startRandomBox2Timer()"
          >
            بدء
          </button>
        `,
        {
          count: 1,
          extraClass:
            "randomChallengeBox2Actions",
        },
      )

      return
    }

    setControls(
      `
        <button
          type="button"
          class="
            randomCtrlBtn
            randomChallengeActionBtn
            randomChallengeCorrectBtn
          "
          onclick="randomChallengeCorrect()"
        >
          صح
        </button>

        <button
          type="button"
          class="
            randomCtrlBtn
            randomChallengeActionBtn
            randomChallengeWrongBtn
          "
          onclick="randomChallengeWrong()"
        >
          خطأ
        </button>
      `,
      {
        count: 2,
        extraClass:
          `
            randomChallengeBox2Actions
            ${
              timerRunning
                ? "timerRunning"
                : ""
            }
          `,
      },
    )

    return
  }

  /* =========================
     3) ماذا تعرف
  ========================= */

  if (currentBox === 3) {
    const box3 =
      randomChallengeState.box3

    const choosingPoints =
      !!box3.choosingPoints

    if (choosingPoints) {
      controls.hidden = true
      return
    }

    const activeTeam =
      box3.activeTeam ||
      randomChallengeState.activeTeam

    const errors =
      box3.errors || {
        A: 0,
        B: 0,
      }

    const passUsed =
      box3.passUsed || {
        A: false,
        B: false,
      }

    const canPass =
      isValidRandomChallengeTeam(
        activeTeam,
      ) &&
      Number(
        errors[activeTeam] || 0,
      ) === 2 &&
      !passUsed[activeTeam] &&
      box3.lastAction !== "pass"

    setControls(
      `
        <button
          type="button"
          class="
            randomCtrlBtn
            randomChallengeActionBtn
            randomChallengePrimaryBtn
          "
          onclick="switchRandomBox3Team()"
          ${activeTeam ? "" : "disabled"}
        >
          تبديل الفريق
        </button>

        <button
          type="button"
          class="
            randomCtrlBtn
            randomChallengeActionBtn
            randomChallengeWrongBtn
          "
          onclick="randomBox3Wrong()"
          ${activeTeam ? "" : "disabled"}
        >
          خطأ
        </button>

        <button
          type="button"
          class="
            randomCtrlBtn
            randomChallengeActionBtn
            randomChallengeSecondaryBtn
          "
          onclick="randomBox3Pass()"
          ${canPass ? "" : "disabled"}
        >
          باس
        </button>

        <button
          type="button"
          class="
            randomCtrlBtn
            randomChallengeActionBtn
            randomChallengeFinishBtn
          "
          onclick="finishRandomBox3ToPoints()"
        >
          إنهاء
        </button>
      `,
      {
        count: 4,
        extraClass:
          "randomChallengeBox3Actions",
      },
    )

    return
  }

  /* =========================
     4) صح أو خطأ
  ========================= */

  if (currentBox === 4) {
    const box4 =
      randomChallengeState.box4

    const started =
      !!box4.started

    const revealed =
      !!box4.revealed

    const reviewMode =
      !!box4.reviewMode

    const secondTeamBreak =
      !!box4.secondTeamBreak

    if (!started) {
      setControls(
        `
          <button
            type="button"
            class="
              randomCtrlBtn
              randomChallengeActionBtn
              randomChallengePrimaryBtn
            "
            onclick="startRandomBox4Game()"
            ${
              box4.startingTeam
                ? ""
                : "disabled"
            }
          >
            بدء
          </button>
        `,
        {
          count: 1,
          extraClass:
            "randomChallengeBox4Actions",
        },
      )

      return
    }

    if (secondTeamBreak) {
      setControls(
        `
          <button
            type="button"
            class="
              randomCtrlBtn
              randomChallengeActionBtn
              randomChallengePrimaryBtn
            "
            onclick="
              startRandomBox4SecondTeam()
            "
          >
            بدء دور الفريق الثاني
          </button>
        `,
        {
          count: 1,
          extraClass:
            "randomChallengeBox4Actions",
        },
      )

      return
    }

    if (reviewMode) {
      setControls(
        `
          <button
            type="button"
            class="
              randomCtrlBtn
              randomChallengeActionBtn
              randomChallengeFinishBtn
            "
            onclick="
              finishRandomChallengeCurrentBox()
            "
          >
            إنهاء المربع
          </button>
        `,
        {
          count: 1,
          extraClass:
            "randomChallengeBox4Actions",
        },
      )

      return
    }

    setControls(
      `
        <button
          type="button"
          class="
            randomCtrlBtn
            randomChallengeActionBtn
            randomChallengeCorrectBtn
          "
          onclick="
            answerRandomBox4('صح')
          "
          ${revealed ? "disabled" : ""}
        >
          صح
        </button>

        <button
          type="button"
          class="
            randomCtrlBtn
            randomChallengeActionBtn
            randomChallengeWrongBtn
          "
          onclick="
            answerRandomBox4('خطأ')
          "
          ${revealed ? "disabled" : ""}
        >
          خطأ
        </button>

        <button
          type="button"
          class="
            randomCtrlBtn
            randomChallengeActionBtn
            randomChallengePrimaryBtn
          "
          onclick="
            nextRandomBox4Question()
          "
          ${revealed ? "" : "disabled"}
        >
          السؤال التالي
        </button>
      `,
      {
        count: 3,
        extraClass:
          "randomChallengeBox4Actions",
      },
    )

    return
  }

  /* =========================
     5) فتبلة
  ========================= */

  if (currentBox === 5) {
    const box5 =
      randomChallengeState.box5

    const hasNumber =
      !!box5.currentNumber

    const revealed =
      !!box5.revealedAnswer

    const blockTimerRunning =
      !!box5.blockTimerRunning

    if (!hasNumber || revealed) {
      controls.hidden = true
      return
    }

    setControls(
      `
        <button
          type="button"
          class="
            randomCtrlBtn
            randomChallengeActionBtn
            randomChallengeCorrectBtn
          "
          onclick="
            completeRandomBox5Number(true)
          "
        >
          صح
        </button>

        <button
          type="button"
          class="
            randomCtrlBtn
            randomChallengeActionBtn
            randomChallengeWrongBtn
          "
          onclick="
            completeRandomBox5Number(false)
          "
        >
          خطأ
        </button>

        <button
          type="button"
          class="
            randomCtrlBtn
            randomChallengeActionBtn
            randomChallengeSecondaryBtn
            randomFatblaBlockButton
            ${
              blockTimerRunning
                ? "active"
                : ""
            }
          "
          onclick="
            startRandomBox5BlockTimer()
          "
          ${
            blockTimerRunning
              ? "disabled"
              : ""
          }
        >
          ${
            blockTimerRunning
              ? "البلوك يعمل"
              : "بلوك"
          }
        </button>
      `,
      {
        count: 3,
        extraClass:
          "randomChallengeBox5Actions",
      },
    )
  }
}
/* =========================
   HEADER ACTIONS
========================= */

function hasRandomChallengeProgress() {
  return RANDOM_CHALLENGE_BOXES.some((number) => {
    if (!isRandomChallengeBoxEnabled(number)) {
      return false
    }

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
    return
  }
}

function handleRandomChallengeBack() {
  const currentBox = normalizeRandomChallengeBoxNumber(
    randomChallengeState.currentBox,
  )

  if (!currentBox) {
    goRandomChallengeHome()
    return
  }

  stopAllRandomChallengeTimers()

  const boxState = getRandomChallengeBoxState(currentBox)

  if (boxState) {
    boxState.active = false

    if (currentBox === 2) {
      boxState.timerRunning = false
    }

    if (currentBox === 3) {
      boxState.timerRunning = false
    }

    if (currentBox === 4) {
  stopRandomBox4Timer()
  boxState.timerRunning = false
}

    if (currentBox === 1) {
      boxState.rolling = false
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

  /*
    للتوافق مع نظام إنهاء الفقرات:
    نتيجة الفقرة = عدد المربعات.
  */

  randomChallengeState.scores = {
    A: wins.A,
    B: wins.B,
  }

  if (typeof clearGameActiveTeam === "function") {
    clearGameActiveTeam()
  }

  highlightRandomChallengeTeam(null)
  updateRandomChallengeWindowState()
  saveRandomChallengeState()

  if (winner === "A" || winner === "B") {
    showGameToast(
      `فاز بالتحدي ${getRandomChallengeTeamName(winner)} بعدد ${wins[winner]} مربعات`,
    )
  } else {
    showGameToast("انتهت فقرة التحدي بالتعادل")
  }

  if (typeof endCurrentSegment === "function") {
    endCurrentSegment()
  }
}
/* =========================
   WINDOW EXPORTS
========================= */

/* الحالة والعرض */

window.renderRandomChallenge = renderRandomChallenge

window.saveRandomChallengeState = saveRandomChallengeState

window.renderRandomChallengeScores = renderRandomChallengeScores

window.renderRandomChallengeStage = renderRandomChallengeStage

window.renderRandomChallengeControls = renderRandomChallengeControls

window.highlightRandomChallengeTeam = highlightRandomChallengeTeam

window.clearRandomChallengeTeamSelection = clearRandomChallengeTeamSelection

/* اختيار الفريق والمربعات */

window.selectRandomChallengeTeam = selectRandomChallengeTeam

window.openRandomChallengeBox = openRandomChallengeBox

window.finishRandomChallengeCurrentBox = finishRandomChallengeCurrentBox

/* الإجراءات العامة */

window.randomChallengeCorrect = randomChallengeCorrect

window.randomChallengeWrong = randomChallengeWrong


/* اللاعب المشترك */

window.startRandomChallengeBox1 = startRandomChallengeBox1

/* المزاد */

window.setRandomBox2NumberValue = setRandomBox2NumberValue

window.updateRandomBox2Number = updateRandomBox2Number

window.appendRandomBox2Digit = appendRandomBox2Digit

window.deleteRandomBox2Digit = deleteRandomBox2Digit

window.clearRandomBox2Number = clearRandomBox2Number

window.increaseRandomBox2Number = increaseRandomBox2Number

window.decreaseRandomBox2Number = decreaseRandomBox2Number

window.startRandomBox2Timer = startRandomBox2Timer

window.nextRandomBox2Question = nextRandomBox2Question

/* ماذا تعرف */

window.startRandomBox3Timer = startRandomBox3Timer

window.switchRandomBox3Team = switchRandomBox3Team

window.randomBox3Wrong = randomBox3Wrong

window.randomBox3Pass = randomBox3Pass

window.finishRandomBox3ToPoints = finishRandomBox3ToPoints

window.scoreRandomBox3Points = scoreRandomBox3Points

window.nextRandomBox3Question = nextRandomBox3Question

/* صح أو خطأ */

window.answerRandomBox4 = answerRandomBox4

window.nextRandomBox4Question = nextRandomBox4Question
window.startRandomBox4Timer =
  startRandomBox4Timer

window.handleRandomBox4Timeout =
  handleRandomBox4Timeout
  window.startRandomBox4Game =
  startRandomBox4Game
  window.startRandomBox4SecondTeam =
  startRandomBox4SecondTeam

/* فتبلة */

window.openRandomBox5Number = openRandomBox5Number

window.revealRandomBox5Answer = revealRandomBox5Answer

window.completeRandomBox5Number = completeRandomBox5Number

window.cancelRandomBox5Number = cancelRandomBox5Number
window.startRandomBox5BlockTimer =
  startRandomBox5BlockTimer

/* حالة الفقرة والهيدر */

window.hasRandomChallengeProgress = hasRandomChallengeProgress

window.checkRandomChallengeCompleted = checkRandomChallengeCompleted

window.handleRandomChallengeBack = handleRandomChallengeBack

window.handleRandomChallengeEnd = handleRandomChallengeEnd

window.goRandomChallengeHome = goRandomChallengeHome
window.renderRandomChallengeHeader = renderRandomChallengeHeader

window.getRandomChallengeBoxScores = getRandomChallengeBoxScores

window.calculateRandomChallengeBoxWinner =
  calculateRandomChallengeBoxWinner

window.calculateRandomChallengeBoxWins =
  calculateRandomChallengeBoxWins

window.calculateRandomChallengeSegmentWinner =
  calculateRandomChallengeSegmentWinner

window.decreaseRandomBox2Count =
  decreaseRandomBox2Count