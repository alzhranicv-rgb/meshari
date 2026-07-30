/* =========================================================
   RANDOM CHALLENGE / التحدي
   PRESENTER - CLEAN COMPLETE VERSION

   BOX 1: اللاعب المشترك
   BOX 2: المزاد
   BOX 3: ماذا تعرف
   BOX 4: صح أو خطأ
   BOX 5: فتبلة
========================================================= */

/* =========================
   1) CONSTANTS
========================= */

const PRESENTER_RANDOM_BOXES = Object.freeze([
  1,
  2,
  3,
  4,
  5
])

const PRESENTER_RANDOM_BOX2_QUESTIONS_COUNT = 2
const PRESENTER_RANDOM_BOX2_TIMER_SECONDS = 30

const PRESENTER_RANDOM_BOX3_QUESTIONS_COUNT = 2
const PRESENTER_RANDOM_BOX3_TIMER_SECONDS = 5

const PRESENTER_RANDOM_BOX4_QUESTIONS_COUNT = 10
const PRESENTER_RANDOM_BOX4_TIMER_SECONDS = 10
const PRESENTER_RANDOM_BOX4_TEAM_QUESTIONS_COUNT = 5
const PRESENTER_RANDOM_BOX5_BLOCK_TIMER_SECONDS = 20

const PRESENTER_RANDOM_INPUT_DELAY = 220
const PRESENTER_RANDOM_DATA_CACHE_TTL =
  10 * 60 * 1000

/* =========================
   2) RUNTIME
========================= */

let presenterRandomAuctionLocalCount = 0
let presenterRandomAuctionFixedPoints = 0

let presenterRandomActionBusy = false
let presenterRandomPendingBox = null
let presenterRandomLastScoreKey = ""

let presenterRandomAuctionInputTimer = null
let presenterRandomTimerWatcher = null

let presenterRandomLastUiMode = ""
let presenterRandomLastStructureKey = ""

let presenterRandomQuestionRows = []
let presenterRandomFatblaRows = []

let presenterRandomDataPromise = null
let presenterRandomDataLoaded = false
let presenterRandomDataModel = null

let presenterRandomSettings = {
  box1: true,
  box2: true,
  box3: true,
  box4: true,
  box5: true,
  fatblaCount: 5
}

/* =========================
   3) GENERAL HELPERS
========================= */

function presenterRandomSafeHtml(value = "") {
  if (
    typeof presenterSafeHtml === "function"
  ) {
    return presenterSafeHtml(value)
  }

  if (
    typeof escapeDisplayHtml === "function"
  ) {
    return escapeDisplayHtml(value)
  }

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function presenterRandomToast(message) {
  if (typeof showToast === "function") {
    showToast(message)
    return
  }

  console.log(message)
}

function markPresenterRandomLocalSync(
  duration = 900
) {
  if (
    typeof markPresenterLocalSync ===
    "function"
  ) {
    markPresenterLocalSync(
      "randomChallenge",
      duration
    )
  }
}

function getPresenterRandomModelId() {
  return Number(
    presenterModel ||
    window.currentModel ||
    window.gameModel ||
    localStorage.getItem("game_model") ||
    0
  )
}

function normalizePresenterRandomFatblaCount(
  value
) {
  const count = Number(value || 5)

  if (count === 3) return 3
  if (count === 7) return 7

  return 5
}

function normalizePresenterRandomQuestionKey(
  value
) {
  const key = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "")

  if (
    key === "auction" ||
    key === "box2" ||
    key === "randomchallengebox2"
  ) {
    return "auction"
  }

  if (
    key === "whatdoyouknow" ||
    key === "box3" ||
    key === "randomchallengebox3"
  ) {
    return "whatDoYouKnow"
  }

  if (
    key === "truefalse" ||
    key === "box4" ||
    key === "randomchallengebox4"
  ) {
    return "trueFalse"
  }

  return String(value || "").trim()
}

function getPresenterRandomBoxTitle(box) {
  const number = Number(box || 0)

  if (number === 1) {
    return "اللاعب المشترك"
  }

  if (number === 2) {
    return "المزاد"
  }

  if (number === 3) {
    return "ماذا تعرف"
  }

  if (number === 4) {
    return "صح أو خطأ"
  }

  if (number === 5) {
    return "فتبلة"
  }

  return "التحدي"
}

function getPresenterRandomTeamName(team) {
  if (team === "A") {
    return presenterTeamAName || "الفريق الأول"
  }

  if (team === "B") {
    return presenterTeamBName || "الفريق الثاني"
  }

  return ""
}

function getPresenterRandomImageUrl(item) {
  if (typeof item === "string") {
    return item
  }

  return (
    item?.image ||
    item?.src ||
    item?.url ||
    ""
  )
}

function getPresenterRandomImageName(item) {
  const raw =
    typeof item === "string"
      ? item
      : (
          item?.name ||
          item?.title ||
          item?.player ||
          item?.team ||
          item?.club ||
          item?.image ||
          item?.src ||
          item?.url ||
          ""
        )

  const fileName = String(raw)
    .split("/")
    .pop()
    .split("\\")
    .pop()
    .replace(/\.[a-z0-9]+$/i, "")

  return fileName
    .replace(/[0-9٠-٩]/g, "")
    .replace(/[()]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function getPresenterRandomBox1Players(
  state = getPresenterRandomChallengeState()
) {
  const box1 = state?.box1 || {}

  if (
    Array.isArray(box1.images) &&
    box1.images.length
  ) {
    return box1.images
  }

  if (
    Array.isArray(box1.players) &&
    box1.players.length
  ) {
    return box1.players
  }

  if (
    Array.isArray(box1.currentPlayers) &&
    box1.currentPlayers.length
  ) {
    return box1.currentPlayers
  }

  if (
    Array.isArray(box1.selectedImages) &&
    box1.selectedImages.length
  ) {
    return box1.selectedImages
  }

  return [
    box1.currentPlayer ||
      box1.currentName ||
      "",

    box1.secondPlayer ||
      box1.secondName ||
      ""
  ]
}

function isPresenterRandomVideo(url = "") {
  const cleanUrl = String(url || "")
    .split("?")[0]
    .split("#")[0]
    .toLowerCase()

  return (
    cleanUrl.endsWith(".mp4") ||
    cleanUrl.endsWith(".webm") ||
    cleanUrl.endsWith(".mov") ||
    cleanUrl.endsWith(".m4v")
  )
}

function createPresenterRandomTimerSync(
  seconds = 0
) {
  const duration =
    Math.max(0, Number(seconds || 0))

  const startedAt =
    Date.now()

  return {
    startedAt,
    endsAt:
      duration > 0
        ? startedAt + duration * 1000
        : 0,
    duration
  }
}

function getPresenterRandomMainScore(
  team,
  state = getPresenterRandomChallengeState()
) {
  if (team !== "A" && team !== "B") {
    return 0
  }

  return Number(
    state?.boxWins?.[team] ??
    state?.scores?.[team] ??
    0
  )
}

function getPresenterRandomBoxScore(
  team,
  box,
  state = getPresenterRandomChallengeState()
) {
  if (team !== "A" && team !== "B") {
    return 0
  }

  const key =
    `box${Number(box || 0)}`

  return Number(
    state?.[key]?.scores?.[team] || 0
  )
}

/* =========================
   4) DATA CACHE
========================= */

function getPresenterRandomDataCacheKey() {
  return [
    "presenter_random_challenge_data",
    getPresenterRandomModelId()
  ].join("_")
}

function readPresenterRandomDataCache() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(
        getPresenterRandomDataCacheKey()
      ) || "null"
    )

    if (
      !saved ||
      !saved.savedAt ||
      !Array.isArray(saved.questions) ||
      !Array.isArray(saved.fatbla)
    ) {
      return null
    }

    if (
      Date.now() -
        Number(saved.savedAt || 0) >
      PRESENTER_RANDOM_DATA_CACHE_TTL
    ) {
      return null
    }

    return saved
  } catch {
    return null
  }
}

function savePresenterRandomDataCache(
  payload
) {
  try {
    localStorage.setItem(
      getPresenterRandomDataCacheKey(),
      JSON.stringify({
        settings:
          Array.isArray(payload?.settings)
            ? payload.settings
            : [],

        questions:
          Array.isArray(payload?.questions)
            ? payload.questions
            : [],

        fatbla:
          Array.isArray(payload?.fatbla)
            ? payload.fatbla
            : [],

        savedAt: Date.now()
      })
    )
  } catch (error) {
    console.log(
      "SAVE PRESENTER RANDOM CACHE ERROR:",
      error
    )
  }
}

/* =========================
   5) DATA NORMALIZATION
========================= */

function applyPresenterRandomSettings(rows) {
  const settingsMap = {}

  ;(Array.isArray(rows) ? rows : [])
    .forEach(row => {
      settingsMap[
        String(row?.segment || "")
      ] = Number(row?.item_count || 0)
    })

  presenterRandomSettings = {
    box1:
      settingsMap.randomChallengeBox1 !==
      0,

    box2:
      settingsMap.randomChallengeBox2 !==
      0,

    box3:
      settingsMap.randomChallengeBox3 !==
      0,

    box4:
      settingsMap.randomChallengeBox4 !==
      0,

    box5:
      settingsMap.randomChallengeAuction !==
      0,

    fatblaCount:
      normalizePresenterRandomFatblaCount(
        settingsMap.auction || 5
      )
  }
}

function applyPresenterRandomQuestions(rows) {
  presenterRandomQuestionRows = (
    Array.isArray(rows) ? rows : []
  )
    .map(row => ({
      ...row,

      box_key:
        normalizePresenterRandomQuestionKey(
          row?.box_key
        ),

      number:
        Number(row?.number || 0),

      question:
        String(row?.question || "").trim(),

      answer:
        String(row?.answer || "").trim()
    }))
    .filter(row => {
      return (
        row.number > 0 &&
        [
          "auction",
          "whatDoYouKnow",
          "trueFalse"
        ].includes(row.box_key)
      )
    })
    .sort((first, second) => {
      if (
        first.box_key === second.box_key
      ) {
        return (
          Number(first.number || 0) -
          Number(second.number || 0)
        )
      }

      return String(first.box_key)
        .localeCompare(
          String(second.box_key)
        )
    })
}

function applyPresenterRandomFatblaRows(rows) {
  const total =
    normalizePresenterRandomFatblaCount(
      presenterRandomSettings.fatblaCount
    )

  presenterRandomFatblaRows = (
    Array.isArray(rows) ? rows : []
  )
    .map(row => ({
      ...row,

      number:
        Number(row?.number || 0),

      question:
        String(row?.question || "").trim(),

      answer:
        String(row?.answer || "").trim(),

      image:
        String(row?.image || "").trim(),

      video:
        String(row?.video || "").trim(),

      note:
        String(row?.note || "").trim()
    }))
    .filter(row => {
      return (
        row.number >= 1 &&
        row.number <= total
      )
    })
    .sort((first, second) => {
      return first.number - second.number
    })
    .slice(0, total)
}

function applyPresenterRandomData(payload) {
  applyPresenterRandomSettings(
    payload?.settings || []
  )

  applyPresenterRandomQuestions(
    payload?.questions || []
  )

  applyPresenterRandomFatblaRows(
    payload?.fatbla || []
  )
}

/* =========================
   6) LOAD DATA
========================= */

async function loadPresenterRandomChallengeData(
  options = {}
) {
  const model =
    getPresenterRandomModelId()

  const forceRefresh =
    options.forceRefresh === true

  if (!model) {
    presenterRandomToast(
      "تعذر تحديد النموذج"
    )

    return false
  }

  if (
    presenterRandomDataLoaded &&
    presenterRandomDataModel === model &&
    !forceRefresh
  ) {
    return true
  }

  if (
    presenterRandomDataPromise &&
    !forceRefresh
  ) {
    return presenterRandomDataPromise
  }

  if (!forceRefresh) {
    const cached =
      readPresenterRandomDataCache()

    if (cached) {
      applyPresenterRandomData(cached)

      presenterRandomDataLoaded = true
      presenterRandomDataModel = model

      if (
        options.backgroundRefresh !==
        false
      ) {
        setTimeout(() => {
          loadPresenterRandomChallengeData({
            forceRefresh: true,
            backgroundRefresh: false
          }).then(() => {
            if (
              presenterSegment ===
              "randomChallenge"
            ) {
              renderPresenterRandomChallenge()
            }
          })
        }, 0)
      }

      return true
    }
  }

  presenterRandomDataPromise =
    (async () => {
      try {
        const [
          settingsResult,
          questionsResult,
          fatblaResult
        ] = await Promise.all([
          db
            .from("segment_settings")
            .select("segment,item_count")
            .eq("model", model)
            .in("segment", [
              "randomChallengeBox1",
              "randomChallengeBox2",
              "randomChallengeBox3",
              "randomChallengeBox4",
              "randomChallengeAuction",
              "auction"
            ]),

          db
            .from(
              "random_challenge_questions"
            )
            .select(
              "id,box_key,number,question,answer"
            )
            .eq("model", model)
            .order("box_key", {
              ascending: true
            })
            .order("number", {
              ascending: true
            }),

          db
            .from("auction_questions")
            .select(
              "id,number,question,answer,image,video,note"
            )
            .eq("model", model)
            .order("number", {
              ascending: true
            })
        ])

        if (settingsResult.error) {
          console.log(
            "LOAD RANDOM SETTINGS ERROR:",
            settingsResult.error
          )
        }

        if (questionsResult.error) {
          console.log(
            "LOAD RANDOM QUESTIONS ERROR:",
            questionsResult.error
          )
        }

        if (fatblaResult.error) {
          console.log(
            "LOAD RANDOM FATBLA ERROR:",
            fatblaResult.error
          )
        }

        const payload = {
          settings:
            settingsResult.data || [],

          questions:
            questionsResult.data || [],

          fatbla:
            fatblaResult.data || []
        }

        applyPresenterRandomData(payload)
        savePresenterRandomDataCache(payload)

        presenterRandomDataLoaded = true
        presenterRandomDataModel = model

        return true
      } catch (error) {
        console.log(
          "LOAD PRESENTER RANDOM DATA ERROR:",
          error
        )

        presenterRandomDataLoaded = false

        return false
      } finally {
        presenterRandomDataPromise = null
      }
    })()

  return presenterRandomDataPromise
}

/* =========================
   7) DATA GETTERS
========================= */

function getPresenterRandomQuestion(
  key,
  number
) {
  const normalizedKey =
    normalizePresenterRandomQuestionKey(
      key
    )

  const safeNumber =
    Number(number || 0)

  return (
    presenterRandomQuestionRows.find(
      row => {
        return (
          row.box_key ===
            normalizedKey &&
          Number(row.number) ===
            safeNumber
        )
      }
    ) || null
  )
}

function getPresenterRandomFatblaRow(
  number
) {
  const safeNumber =
    Number(number || 0)

  return (
    presenterRandomFatblaRows.find(
      row =>
        Number(row.number) ===
        safeNumber
    ) || null
  )
}

function getPresenterRandomBoxEnabled(box) {
  const number = Number(box || 0)

  return !!presenterRandomSettings[
    `box${number}`
  ]
}

function getPresenterRandomEnabledBoxes() {
  return PRESENTER_RANDOM_BOXES.filter(
    box =>
      getPresenterRandomBoxEnabled(box)
  )
}

/* =========================
   8) STATE
========================= */

function getPresenterRandomChallengeRoot() {
  return (
    presenterLiveState?.randomChallenge ||
    {}
  )
}

function getPresenterRandomChallengeState() {
  const root =
    getPresenterRandomChallengeRoot()

  return {
    scores: {
      A: Number(root?.scores?.A || 0),
      B: Number(root?.scores?.B || 0)
    },

    boxWins: {
      A: Number(
        root?.boxWins?.A ??
        root?.scores?.A ??
        0
      ),

      B: Number(
        root?.boxWins?.B ??
        root?.scores?.B ??
        0
      )
    },

    activeTeam:
      root?.activeTeam || null,

    currentBox:
      Number(root?.currentBox || 0) ||
      null,

    completed:
      !!root?.completed,

    box1: {
      active: false,
      started: false,
      rolling: false,
      flashing: false,
      finished: false,
      pool: "",
      images: [],
      recentTeamKeys: [],
      scores: { A: 0, B: 0 },

      ...(root?.box1 || {})
    },

    box2: {
      active: false,
      finished: false,

      currentQuestionNumber: 1,
      question: "",
      answer: "",

      numberInput: "",
      currentCount: 0,
      points: 0,
      calculatedPoints: 0,

      timer:
        PRESENTER_RANDOM_BOX2_TIMER_SECONDS,

      timerRunning: false,
      timerEndsAt: 0,
      timerSync: null,

      scores: { A: 0, B: 0 },

      ...(root?.box2 || {})
    },

    box3: {
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

        ...(root?.box3?.errors || {})
      },

      passUsed: {
        A: false,
        B: false,

        ...(root?.box3?.passUsed || {})
      },

      lastAction: null,

      timer:
        PRESENTER_RANDOM_BOX3_TIMER_SECONDS,

      timerRunning: false,
      timerEndsAt: 0,
      timerSync: null,

      choosingPoints: false,

      scores: { A: 0, B: 0 },

      ...(root?.box3 || {})
    },

    box4: {
      active: false,
      finished: false,

      started: false,
      startingTeam: null,
      activeTeam: null,

      secondTeamBreak: false,

      currentQuestionNumber: 1,

      timer:
        PRESENTER_RANDOM_BOX4_TIMER_SECONDS,

      timerRunning: false,
      timerEndsAt: 0,
      timerSync: null,

      revealed: false,
      reviewMode: false,

      selectedAnswer: "",
      currentWasCorrect: null,
      results: [],

      scores: { A: 0, B: 0 },

      ...(root?.box4 || {})
    },

box5: {
  active: false,
  finished: false,

  currentNumber: null,
  openedNumbers: [],
  revealedAnswer: false,

  blockArmed: false,
  blockTimerVisible: false,
  blockTimerRunning: false,
  blockTimer:
    PRESENTER_RANDOM_BOX5_BLOCK_TIMER_SECONDS,
  blockTimerSync: null,

  scores: { A: 0, B: 0 },

  ...(root?.box5 || {})
}
  }
}

function getPresenterRandomCurrentBox() {
  return Number(
    getPresenterRandomChallengeState()
      ?.currentBox || 0
  )
}

function getPresenterRandomActiveTeam() {
  const state =
    getPresenterRandomChallengeState()

  if (
    Number(state.currentBox) === 3
  ) {
    return (
      state.box3?.activeTeam ||
      state.box3?.scoringTeam ||
      state.activeTeam ||
      presenterSelectedTeam ||
      null
    )
  }

  if (
    Number(state.currentBox) === 4
  ) {
    return (
      state.box4?.activeTeam ||
      state.box4?.startingTeam ||
      state.activeTeam ||
      presenterSelectedTeam ||
      null
    )
  }

  return (
    state.activeTeam ||
    presenterSelectedTeam ||
    null
  )
}

function getPresenterRandomCurrentRow(
  box = getPresenterRandomCurrentBox(),
  state = getPresenterRandomChallengeState()
) {
  const number = Number(box || 0)

  if (number === 2) {
    return getPresenterRandomQuestion(
      "auction",
      state.box2?.currentQuestionNumber
    )
  }

  if (number === 3) {
    return getPresenterRandomQuestion(
      "whatDoYouKnow",
      state.box3?.currentQuestionNumber
    )
  }

  if (number === 4) {
    return getPresenterRandomQuestion(
      "trueFalse",
      state.box4?.currentQuestionNumber
    )
  }

  if (number === 5) {
    return getPresenterRandomFatblaRow(
      state.box5?.currentNumber
    )
  }

  return null
}

function getPresenterRandomUiMode() {
  const state =
    getPresenterRandomChallengeState()

  const box =
    Number(state.currentBox || 0)

  if (!box) {
    return "select"
  }

  if (box === 1) {
    const players =
      getPresenterRandomBox1Players(
        state
      )

    const started =
      !!state.box1?.started ||
      !!state.box1?.rolling ||
      players.filter(Boolean).length > 0

    return started
      ? "box1Play"
      : "box1Pool"
  }

  if (box === 2) {
    return "box2"
  }

  if (box === 3) {
    return state.box3?.choosingPoints
      ? "box3Score"
      : "box3Play"
  }

  if (box === 4) {
    return "box4"
  }

  if (box === 5) {
    return state.box5?.currentNumber
      ? "box5Question"
      : "box5Numbers"
  }

  return `box${box}`
}

function getPresenterRandomStructureKey() {
  const state =
    getPresenterRandomChallengeState()

  return [
    state.currentBox || "",

    !!state.box1?.started,
    !!state.box1?.rolling,
    state.box1?.pool || "",

    state.box2?.currentQuestionNumber || 1,

    state.box3?.currentQuestionNumber || 1,
    !!state.box3?.choosingPoints,

    state.box4?.currentQuestionNumber || 1,
    !!state.box4?.revealed,

    state.box5?.currentNumber || "",
        !!state.box5?.blockArmed,
    !!state.box5?.blockTimerVisible,
    !!state.box5?.blockTimerRunning,
    !!state.box5?.revealedAnswer,

    Array.isArray(
      state.box5?.openedNumbers
    )
      ? state.box5.openedNumbers
          .map(Number)
          .sort((a, b) => a - b)
          .join(",")
      : ""
  ].join("|")
}

/* =========================
   9) AUCTION POINTS
========================= */

function getPresenterRandomAuctionCount(
  state = getPresenterRandomChallengeState()
) {
  return Number(
    presenterRandomAuctionLocalCount ||
    state.box2?.points ||
    state.box2?.numberInput ||
    0
  )
}

function calcPresenterRandomAuctionFixedPoints(
  count
) {
  const number = Number(count || 0)

  if (!number) return 0

  if (
    number > 0 &&
    number < 10
  ) {
    return 1
  }

  return Math.floor(number / 10)
}

function getPresenterRandomAuctionFixedPoints(
  state = getPresenterRandomChallengeState()
) {
  return Number(
    presenterRandomAuctionFixedPoints ||
    state.box2?.calculatedPoints ||
    calcPresenterRandomAuctionFixedPoints(
      getPresenterRandomAuctionCount(
        state
      )
    ) ||
    0
  )
}

function updatePresenterRandomAuctionLocalState(
  count,
  fixedPoints,
  options = {}
) {
  const oldRandom =
    presenterLiveState?.randomChallenge ||
    {}

  presenterLiveState = {
    ...(presenterLiveState || {}),

    randomChallenge: {
      ...oldRandom,

      currentBox: 2,

      box2: {
        ...(oldRandom.box2 || {}),

        active: true,

        numberInput:
          String(count || ""),

        points:
          Number(count || 0),

        calculatedPoints:
          Number(fixedPoints || 0)
      }
    }
  }

  if (options.refresh !== false) {
    refreshPresenterRandomChallengeFromState()
  }
}

function syncPresenterRandomAuctionPoints(
  count,
  fixedPoints,
  keepFixedPoints = false
) {
  clearTimeout(
    presenterRandomAuctionInputTimer
  )

  presenterRandomAuctionInputTimer =
    setTimeout(() => {
      sendCommand(
        "randomSetAuctionPoints",
        {
          points:
            Number(count || 0),

          count:
            Number(count || 0),

          calculatedPoints:
            Number(fixedPoints || 0),

          keepFixedPoints:
            !!keepFixedPoints
        }
      )
    }, PRESENTER_RANDOM_INPUT_DELAY)
}

function setPresenterRandomAuctionPoints(
  value,
  shouldSync = true
) {
  const clean = Math.max(
    0,

    Number(
      String(value || "")
        .replace(/\D/g, "")
        .slice(0, 5) || 0
    )
  )

  presenterRandomAuctionLocalCount =
    clean

  presenterRandomAuctionFixedPoints =
    calcPresenterRandomAuctionFixedPoints(
      clean
    )

  updatePresenterRandomAuctionLocalState(
    clean,
    presenterRandomAuctionFixedPoints,
    {
      refresh: false
    }
  )

  const input =
    document.getElementById(
      "presenterRandomAuctionInput"
    )

  const countBox =
    document.getElementById(
      "presenterRandomAuctionCount"
    )

  const fixedBox =
    document.getElementById(
      "presenterRandomAuctionFixed"
    )

  if (
    input &&
    document.activeElement !== input
  ) {
    input.value = clean || ""
  }

  if (countBox) {
    countBox.innerText =
      String(clean)
  }

  if (fixedBox) {
    fixedBox.innerText =
      String(
        presenterRandomAuctionFixedPoints
      )
  }

  if (shouldSync) {
    syncPresenterRandomAuctionPoints(
      clean,
      presenterRandomAuctionFixedPoints,
      false
    )
  }
}

function decreasePresenterRandomAuctionPoints() {
  if (presenterRandomActionBusy) {
    return
  }

  const current = Number(
    presenterRandomAuctionLocalCount || 0
  )

  const fixed = Number(
    presenterRandomAuctionFixedPoints ||
    calcPresenterRandomAuctionFixedPoints(
      current
    )
  )

  const next = Math.max(
    0,
    current - 1
  )

  presenterRandomAuctionLocalCount =
    next

  presenterRandomAuctionFixedPoints =
    fixed

  updatePresenterRandomAuctionLocalState(
    next,
    fixed,
    {
      refresh: false
    }
  )

  const input =
    document.getElementById(
      "presenterRandomAuctionInput"
    )

  const countBox =
    document.getElementById(
      "presenterRandomAuctionCount"
    )

  const fixedBox =
    document.getElementById(
      "presenterRandomAuctionFixed"
    )

  if (input) {
    input.value = next || ""
  }

  if (countBox) {
    countBox.innerText =
      String(next)
  }

  if (fixedBox) {
    fixedBox.innerText =
      String(fixed)
  }

  syncPresenterRandomAuctionPoints(
    next,
    fixed,
    true
  )
}

/* =========================
   10) TIMER HELPERS
========================= */

function getPresenterRandomTimerEndsAt(
  boxNumber
) {
  const state =
    getPresenterRandomChallengeState()

  const box =
    Number(boxNumber || 0)

  if (box === 2) {
    return Number(
      state.box2?.timerEndsAt ||
      state.box2?.timerSync?.endsAt ||
      0
    )
  }

  if (box === 3) {
    return Number(
      state.box3?.timerEndsAt ||
      state.box3?.timerSync?.endsAt ||
      0
    )
  }

  if (box === 4) {
    return Number(
      state.box4?.timerEndsAt ||
      state.box4?.timerSync?.endsAt ||
      0
    )
  }

  if (box === 5) {
    return Number(
      state.box5?.blockTimerSync?.endsAt ||
      0
    )
  }

  return 0
}

function getPresenterRandomTimerRunning(
  boxNumber
) {
  const state =
    getPresenterRandomChallengeState()

  const box =
    Number(boxNumber || 0)

  const endsAt =
    getPresenterRandomTimerEndsAt(box)

  if (box === 2) {
    return !!(
      state.box2?.timerRunning ||
      endsAt > Date.now()
    )
  }

  if (box === 3) {
    return !!(
      state.box3?.timerRunning ||
      endsAt > Date.now()
    )
  }

  if (box === 4) {
    return !!(
      state.box4?.timerRunning ||
      endsAt > Date.now()
    )
  }

  if (box === 5) {
    return !!(
      state.box5?.blockTimerRunning ||
      endsAt > Date.now()
    )
  }

  return false
}

function getPresenterRandomRemainingTime(
  boxNumber
) {
  const state =
    getPresenterRandomChallengeState()

  const box =
    Number(boxNumber || 0)

  const endsAt =
    getPresenterRandomTimerEndsAt(box)

  if (endsAt > 0) {
    return Math.max(
      0,
      Math.ceil(
        (endsAt - Date.now()) / 1000
      )
    )
  }

  if (box === 2) {
    return Math.max(
      0,
      Number(
        state.box2?.timer ??
        PRESENTER_RANDOM_BOX2_TIMER_SECONDS
      )
    )
  }

  if (box === 3) {
    return Math.max(
      0,
      Number(
        state.box3?.timer ??
        PRESENTER_RANDOM_BOX3_TIMER_SECONDS
      )
    )
  }

  if (box === 4) {
    return Math.max(
      0,
      Number(
        state.box4?.timer ??
        PRESENTER_RANDOM_BOX4_TIMER_SECONDS
      )
    )
  }

  if (box === 5) {
    return Math.max(
      0,
      Number(
        state.box5?.blockTimer ??
        PRESENTER_RANDOM_BOX5_BLOCK_TIMER_SECONDS
      )
    )
  }

  return 0
}


function updatePresenterRandomTimers() {
  if (
    presenterSegment !==
    "randomChallenge"
  ) {
    return
  }

  const auctionTimer =
    document.getElementById(
      "presenterRandomAuctionTimer"
    )

  if (auctionTimer) {
    const remaining =
      getPresenterRandomRemainingTime(2)

    auctionTimer.innerText =
      String(remaining)

    auctionTimer.classList.toggle(
      "danger",
      remaining > 0 &&
      remaining <= 5
    )

    auctionTimer.classList.toggle(
      "presenterTimerDanger",
      remaining > 0 &&
      remaining <= 5
    )

    auctionTimer.classList.toggle(
      "presenterTimerFinished",
      remaining === 0
    )
  }

  const box3Timer =
    document.getElementById(
      "presenterRandomBox3Timer"
    )

  if (box3Timer) {
    const remaining =
      getPresenterRandomRemainingTime(3)

    box3Timer.innerText =
      String(remaining)

    box3Timer.classList.toggle(
      "danger",
      remaining > 0 &&
      remaining <= 2
    )

    box3Timer.classList.toggle(
      "presenterTimerDanger",
      remaining > 0 &&
      remaining <= 2
    )

    box3Timer.classList.toggle(
      "presenterTimerFinished",
      remaining === 0
    )
  }

    const box4Timer =
    document.getElementById(
      "presenterRandomBox4Timer"
    )

  if (box4Timer) {
    const remaining =
      getPresenterRandomRemainingTime(4)

    box4Timer.innerText =
      String(remaining)

    box4Timer.classList.toggle(
      "danger",
      remaining > 0 &&
      remaining <= 3
    )

    box4Timer.classList.toggle(
      "presenterTimerDanger",
      remaining > 0 &&
      remaining <= 3
    )

    box4Timer.classList.toggle(
      "presenterTimerFinished",
      remaining === 0
    )
  }

  const box5Timer =
    document.getElementById(
      "presenterRandomBox5BlockTimer"
    )

  if (box5Timer) {
    const remaining =
      getPresenterRandomRemainingTime(5)

    box5Timer.innerText =
      String(remaining)

    box5Timer.classList.toggle(
      "danger",
      remaining > 0 &&
      remaining <= 5
    )

    box5Timer.classList.toggle(
      "presenterTimerDanger",
      remaining > 0 &&
      remaining <= 5
    )

    box5Timer.classList.toggle(
      "presenterTimerFinished",
      remaining === 0
    )
  }

}

function startPresenterRandomTimerWatcher() {
  stopPresenterRandomTimerWatcher()
  updatePresenterRandomTimers()

  presenterRandomTimerWatcher =
    setInterval(() => {
      if (
        presenterSegment !==
        "randomChallenge"
      ) {
        stopPresenterRandomTimerWatcher()
        return
      }

      updatePresenterRandomTimers()
    }, 250)
}

function stopPresenterRandomTimerWatcher() {
  if (!presenterRandomTimerWatcher) {
    return
  }

  clearInterval(
    presenterRandomTimerWatcher
  )

  presenterRandomTimerWatcher = null
}

/* =========================
   11) LOCAL BOX STATE
========================= */

function applyPresenterRandomLocalBox(box) {
  const number = Number(box || 0)

  if (
    !PRESENTER_RANDOM_BOXES.includes(
      number
    )
  ) {
    return
  }

  const oldRandom =
    presenterLiveState?.randomChallenge ||
    {}

  presenterLiveState = {
    ...(presenterLiveState || {}),

    randomChallenge: {
      ...oldRandom,

      currentBox: number,
      activeTeam: null,

      box1: {
        ...(oldRandom.box1 || {}),

        active:
          number === 1,

        started:
          number === 1
            ? false
            : !!oldRandom.box1?.started,

        rolling:
          number === 1
            ? false
            : !!oldRandom.box1?.rolling,

        flashing:
          number === 1
            ? false
            : !!oldRandom.box1?.flashing,

        images:
          number === 1
            ? []
            : (
                oldRandom.box1?.images ||
                []
              )
      },

      box2: {
        ...(oldRandom.box2 || {}),

        active:
          number === 2,

        currentQuestionNumber:
          Number(
            oldRandom.box2
              ?.currentQuestionNumber || 1
          )
      },

      box3: {
        ...(oldRandom.box3 || {}),

        active:
          number === 3,

        activeTeam: null,

        currentQuestionNumber:
          Number(
            oldRandom.box3
              ?.currentQuestionNumber || 1
          )
      },

      box4: {
        ...(oldRandom.box4 || {}),

        active:
          number === 4,

        currentQuestionNumber:
          Number(
            oldRandom.box4
              ?.currentQuestionNumber || 1
          ),

        revealed:
          number === 4
            ? false
            : !!oldRandom.box4?.revealed
      },

      box5: {
        ...(oldRandom.box5 || {}),

        active:
          number === 5,

        currentNumber:
          number === 5
            ? null
            : (
                oldRandom.box5
                  ?.currentNumber ||
                null
              ),

        revealedAnswer:
          number === 5
            ? false
            : !!oldRandom.box5
                ?.revealedAnswer,

        openedNumbers:
          Array.isArray(
            oldRandom.box5
              ?.openedNumbers
          )
            ? oldRandom.box5
                .openedNumbers
            : []
      }
    }
  }
}

/* =========================
   12) OPEN BOX
========================= */

async function openPresenterRandomBox(box) {
  const number = Number(box || 0)

  if (
    !PRESENTER_RANDOM_BOXES.includes(
      number
    ) ||
    presenterRandomActionBusy ||
    presenterRandomPendingBox
  ) {
    return
  }

  if (
    !getPresenterRandomBoxEnabled(number)
  ) {
    presenterRandomToast(
      "هذا التحدي معطّل"
    )

    return
  }

  const state =
    getPresenterRandomChallengeState()

  if (
    state?.[`box${number}`]?.finished
  ) {
    presenterRandomToast(
      "هذا التحدي منتهٍ"
    )

    return
  }

  presenterRandomActionBusy = true
  presenterRandomPendingBox = number

  applyPresenterRandomLocalBox(number)

  presenterSelectedTeam = null

  if (number === 2) {
    const nextState =
      getPresenterRandomChallengeState()

    presenterRandomAuctionLocalCount =
      Number(
        nextState.box2?.points ||
        nextState.box2?.numberInput ||
        0
      )

    presenterRandomAuctionFixedPoints =
      Number(
        nextState.box2
          ?.calculatedPoints ||
        calcPresenterRandomAuctionFixedPoints(
          presenterRandomAuctionLocalCount
        )
      )
  } else {
    presenterRandomAuctionLocalCount = 0
    presenterRandomAuctionFixedPoints = 0
  }

  markPresenterRandomLocalSync(1400)

  await renderPresenterRandomChallenge()

const sent =
  await sendPresenterRandomCommandSafe(
    "randomOpenBox",
    {
      box: number
    }
  )

  presenterRandomActionBusy = false
  presenterRandomPendingBox = null

  if (!sent) {
    presenterRandomToast(
      "تعذر فتح التحدي"
    )

    if (
      typeof fetchPresenterSessionNow ===
      "function"
    ) {
      fetchPresenterSessionNow(
        presenterSessionId,
        true
      )
    }

    return
  }

  updatePresenterRandomActionButtons()
}

/* =========================
   13) BACK
========================= */

async function presenterRandomBackStep() {
  if (presenterRandomActionBusy) {
    return
  }

  const state =
    getPresenterRandomChallengeState()

  const currentBox =
    getPresenterRandomCurrentBox()

  if (!currentBox) {
    return
  }

  if (
    currentBox === 5 &&
    state.box5?.currentNumber
  ) {
    await cancelPresenterRandomBox5Number()
    return
  }

  if (
    currentBox === 1 &&
    state.box1?.started
  ) {
    presenterLiveState = {
      ...(presenterLiveState || {}),

      randomChallenge: {
        ...(presenterLiveState
          ?.randomChallenge || {}),

        currentBox: 1,

        box1: {
          ...(presenterLiveState
            ?.randomChallenge
            ?.box1 || {}),

          active: true,
          started: false,
          rolling: false,
          flashing: false,
          images: []
        }
      }
    }

    markPresenterRandomLocalSync(900)

    await renderPresenterRandomChallenge()

    await sendCommand(
      "randomResetBox1"
    )

    return
  }

  const oldRandom =
    presenterLiveState?.randomChallenge ||
    {}

  presenterLiveState = {
    ...(presenterLiveState || {}),

    randomChallenge: {
      ...oldRandom,

      currentBox: null,
      activeTeam: null,

      box1: {
        ...(oldRandom.box1 || {}),
        active: false
      },

      box2: {
        ...(oldRandom.box2 || {}),
        active: false
      },

      box3: {
        ...(oldRandom.box3 || {}),
        active: false,
        activeTeam: null
      },

      box4: {
        ...(oldRandom.box4 || {}),
        active: false
      },

      box5: {
        ...(oldRandom.box5 || {}),
        active: false,
        currentNumber: null,
        revealedAnswer: false
      }
    }
  }

  presenterSelectedTeam = null

  markPresenterRandomLocalSync(900)

  await renderPresenterRandomChallenge()

  await sendCommand(
    "randomBackToBoxes",
    {
      box: currentBox
    }
  )
}

/* =========================
   14) BOX 1
========================= */

async function startPresenterRandomBox1(pool) {
  if (presenterRandomActionBusy) {
    return
  }

  const cleanPool =
    pool === "world"
      ? "world"
      : "saudi"

  const oldRandom =
    presenterLiveState?.randomChallenge ||
    {}

  presenterRandomActionBusy = true

  presenterLiveState = {
    ...(presenterLiveState || {}),

    randomChallenge: {
      ...oldRandom,

      currentBox: 1,

      box1: {
        ...(oldRandom.box1 || {}),

        active: true,
        pool: cleanPool,
        started: true,
        rolling: true,
        flashing: false,
        images: []
      }
    }
  }

  markPresenterRandomLocalSync(1400)

  await renderPresenterRandomChallenge()

  const sent = await sendCommand(
    "randomStartBox1",
    {
      pool: cleanPool
    }
  )

  presenterRandomActionBusy = false

  if (!sent) {
    presenterRandomToast(
      "تعذر بدء الاختيار"
    )
  }

  updatePresenterRandomActionButtons()
}

/* =========================
   15) GENERAL ACTION
========================= */

function getPresenterRandomActionKey(
  action,
  payload = {}
) {
  const state =
    getPresenterRandomChallengeState()

  return [
    action,
    state.currentBox || "",
    state.activeTeam || "",
    state.box3?.activeTeam || "",
    state.box2
      ?.currentQuestionNumber || "",
    state.box3
      ?.currentQuestionNumber || "",
    state.box4
      ?.currentQuestionNumber || "",
    state.box5?.currentNumber || "",
    payload.points || "",
    payload.answer || "",
    payload.correct ?? "",
    presenterRandomAuctionLocalCount ||
      ""
  ].join("_")
}

async function sendPresenterRandomCommandSafe(
  action,
  payload = {}
) {
  if (typeof sendCommand !== "function") {
    return false
  }

  try {
    const result = await Promise.race([
      sendCommand(action, {
        ...payload,
        segment: "randomChallenge"
      }),

      new Promise(resolve => {
        setTimeout(() => {
          resolve(false)
        }, 2500)
      })
    ])

    return result !== false
  } catch (error) {
    console.log(
      "PRESENTER RANDOM COMMAND ERROR:",
      error
    )

    return false
  }
}

async function runPresenterRandomAction(
  action,
  payload = {}
) {
  if (presenterRandomActionBusy) {
    return false
  }

  const state =
    getPresenterRandomChallengeState()

  const currentBox =
    getPresenterRandomCurrentBox()

  const activeTeam =
    getPresenterRandomActiveTeam()

  if (!currentBox) {
    presenterRandomToast(
      "اختر تحديًا أولاً"
    )

    return false
  }

    if (
    action === "randomStartBox2Timer"
  ) {
    if (!activeTeam) {
      presenterRandomToast(
        "اختر الفريق أولاً"
      )

      return false
    }

    if (
      !getPresenterRandomAuctionCount(
        state
      )
    ) {
      presenterRandomToast(
        "اكتب عدد الإجابات"
      )

      return false
    }
  }

  if (
    action === "randomStartBox3Timer" &&
    getPresenterRandomTimerRunning(3) &&
    getPresenterRandomRemainingTime(3) > 0
  ) {
    presenterRandomToast(
      "المؤقت يعمل الآن"
    )

    return false
  }

  if (
    action === "randomStartBox4Game"
  ) {
    if (!activeTeam) {
      presenterRandomToast(
        "اختر الفريق الذي يبدأ"
      )

      return false
    }

    if (state.box4?.started) {
      return false
    }
  }

  if (
    action === "randomStartBox4SecondTeam" &&
    !state.box4?.secondTeamBreak
  ) {
    return false
  }

if (
  action === "randomBox5BlockTimer" &&
  getPresenterRandomTimerRunning(5) &&
  getPresenterRandomRemainingTime(5) > 0
) {
  presenterRandomToast(
    "البلوك يعمل الآن"
  )

  return false
}

  if (
    (
      action === "correct" ||
      action === "wrong"
    ) &&
    !activeTeam
  ) {
    presenterRandomToast(
      "اختر الفريق أولاً"
    )

    return false
  }

  if (
    action ===
      "randomStartBox2Timer" &&
    getPresenterRandomTimerRunning(2) &&
    getPresenterRandomRemainingTime(2) >
      0
  ) {
    presenterRandomToast(
      "المؤقت يعمل الآن"
    )

    return false
  }

  const actionKey =
    getPresenterRandomActionKey(
      action,
      payload
    )

  if (
    (
      action === "correct" ||
      action === "wrong" ||
      action ===
        "randomBox3ScorePoints"
    ) &&
    presenterRandomLastScoreKey ===
      actionKey
  ) {
    return false
  }

  if (
    action === "correct" ||
    action === "wrong" ||
    action ===
      "randomBox3ScorePoints"
  ) {
    presenterRandomLastScoreKey =
      actionKey
  }

  presenterRandomActionBusy = true

  updatePresenterRandomActionButtons()

  if (
    action ===
    "randomStartBox2Timer"
  ) {
    const endsAt =
      Date.now() +
      PRESENTER_RANDOM_BOX2_TIMER_SECONDS *
        1000

    const oldRandom =
      presenterLiveState
        ?.randomChallenge || {}

    presenterLiveState = {
      ...(presenterLiveState || {}),

      randomChallenge: {
        ...oldRandom,

        box2: {
          ...(oldRandom.box2 || {}),

          timer:
            PRESENTER_RANDOM_BOX2_TIMER_SECONDS,

          timerRunning: true,
          timerEndsAt: endsAt,

          timerSync: {
            startedAt:
              endsAt -
              PRESENTER_RANDOM_BOX2_TIMER_SECONDS *
                1000,
            endsAt,
            duration:
              PRESENTER_RANDOM_BOX2_TIMER_SECONDS
          }
        }
      }
    }

    updatePresenterRandomTimers()
  }

    if (
    action === "randomStartBox3Timer"
  ) {
    const timerSync =
      createPresenterRandomTimerSync(
        PRESENTER_RANDOM_BOX3_TIMER_SECONDS
      )

    const oldRandom =
      presenterLiveState
        ?.randomChallenge || {}

    presenterLiveState = {
      ...(presenterLiveState || {}),

      randomChallenge: {
        ...oldRandom,

        box3: {
          ...(oldRandom.box3 || {}),

          timer:
            PRESENTER_RANDOM_BOX3_TIMER_SECONDS,

          timerRunning: true,
          timerEndsAt:
            timerSync.endsAt,
          timerSync
        }
      }
    }

    updatePresenterRandomTimers()
  }

  if (
    action === "randomStartBox4Game"
  ) {
    const timerSync =
      createPresenterRandomTimerSync(
        PRESENTER_RANDOM_BOX4_TIMER_SECONDS
      )

    const oldRandom =
      presenterLiveState
        ?.randomChallenge || {}

    presenterLiveState = {
      ...(presenterLiveState || {}),

      randomChallenge: {
        ...oldRandom,

        activeTeam,

        box4: {
          ...(oldRandom.box4 || {}),

          started: true,
          startingTeam: activeTeam,
          activeTeam,

          currentQuestionNumber: 1,

          timer:
            PRESENTER_RANDOM_BOX4_TIMER_SECONDS,

          timerRunning: true,
          timerEndsAt:
            timerSync.endsAt,
          timerSync,

          revealed: false,
          reviewMode: false,
          secondTeamBreak: false
        }
      }
    }

    updatePresenterRandomTimers()
  }

  if (
    action === "randomStartBox4SecondTeam"
  ) {
    const timerSync =
      createPresenterRandomTimerSync(
        PRESENTER_RANDOM_BOX4_TIMER_SECONDS
      )

    const oldRandom =
      presenterLiveState
        ?.randomChallenge || {}

    const secondTeam =
      oldRandom.box4?.startingTeam === "A"
        ? "B"
        : "A"

    presenterLiveState = {
      ...(presenterLiveState || {}),

      randomChallenge: {
        ...oldRandom,

        activeTeam:
          secondTeam,

        box4: {
          ...(oldRandom.box4 || {}),

          secondTeamBreak: false,
          activeTeam:
            secondTeam,

          currentQuestionNumber:
            PRESENTER_RANDOM_BOX4_TEAM_QUESTIONS_COUNT +
            1,

          timer:
            PRESENTER_RANDOM_BOX4_TIMER_SECONDS,

          timerRunning: true,
          timerEndsAt:
            timerSync.endsAt,
          timerSync,

          revealed: false
        }
      }
    }

    updatePresenterRandomTimers()
  }

if (
  action === "randomBox5BlockTimer"
) {
  const oldRandom =
    presenterLiveState
      ?.randomChallenge || {}

  const nextArmed =
    !oldRandom.box5?.blockArmed

  presenterLiveState = {
    ...(presenterLiveState || {}),

    randomChallenge: {
      ...oldRandom,

      box5: {
        ...(oldRandom.box5 || {}),

        blockArmed:
          nextArmed,

        blockTimerVisible:
          nextArmed,

        blockTimerRunning:
          false,

        blockTimer:
          PRESENTER_RANDOM_BOX5_BLOCK_TIMER_SECONDS,

        blockTimerSync:
          null
      }
    }
  }

  updatePresenterRandomTimers()
}

const sent =
  await sendPresenterRandomCommandSafe(
    action,
    {
      ...payload,

      team:
        payload.team ||
        activeTeam ||
        null,

      box:
        payload.box ||
        currentBox
    }
  )

  presenterRandomActionBusy = false

  if (!sent) {
    if (
      action === "correct" ||
      action === "wrong" ||
      action ===
        "randomBox3ScorePoints"
    ) {
      presenterRandomLastScoreKey = ""
    }

    updatePresenterRandomActionButtons()

    presenterRandomToast(
      "تعذر تنفيذ الأمر"
    )

    return false
  }

  setTimeout(() => {
    presenterRandomActionBusy = false
    updatePresenterRandomActionButtons()
  }, 250)

  return true
}

/* =========================
   16) BOX 2 SCORE
========================= */

async function sendPresenterRandomAuctionScore(
  type
) {
  const count = Number(
    presenterRandomAuctionLocalCount || 0
  )

  const fixedPoints = Number(
    presenterRandomAuctionFixedPoints ||
    calcPresenterRandomAuctionFixedPoints(
      count
    )
  )

  if (!count) {
    presenterRandomToast(
      "اكتب عدد الإجابات"
    )

    return
  }

  const activeTeam =
    getPresenterRandomActiveTeam()

  if (!activeTeam) {
    presenterRandomToast(
      "اختر الفريق أولاً"
    )

    return
  }

  await runPresenterRandomAction(
    type,
    {
      points: fixedPoints,
      count,
      calculatedPoints: fixedPoints,
      presenterOnlyPoints: true
    }
  )
}

/* =========================
   17) BOX 3
========================= */

async function finishPresenterRandomBox3Round() {
  const state =
    getPresenterRandomChallengeState()

  if (
    state.box3?.choosingPoints
  ) {
    return
  }

  const sent =
    await runPresenterRandomAction(
      "randomFinishRound"
    )

  if (!sent) return

  const oldRandom =
    presenterLiveState?.randomChallenge ||
    {}

  presenterLiveState = {
    ...(presenterLiveState || {}),

    randomChallenge: {
      ...oldRandom,

      currentBox: 3,

      box3: {
        ...(oldRandom.box3 || {}),

        choosingPoints: true,

        scoringTeam:
          oldRandom.box3?.activeTeam ||
          oldRandom.activeTeam ||
          presenterSelectedTeam ||
          null
      }
    }
  }

  markPresenterRandomLocalSync(900)

  await renderPresenterRandomChallenge()
}

async function scorePresenterRandomBox3Points(
  points
) {
  const value = Math.min(
    3,
    Math.max(1, Number(points || 1))
  )

  await runPresenterRandomAction(
    "randomBox3ScorePoints",
    {
      points: value
    }
  )
}

/* =========================
   18) BOX 4
========================= */

async function answerPresenterRandomBox4(
  selectedAnswer
) {
  if (presenterRandomActionBusy) {
    return
  }

  const state =
    getPresenterRandomChallengeState()

  if (
    Number(state.currentBox) !== 4
  ) {
    return
  }

  if (state.box4?.revealed) {
    presenterRandomToast(
      "تم تسجيل نتيجة العبارة"
    )

    return
  }

  const activeTeam =
    getPresenterRandomActiveTeam()

  if (!activeTeam) {
    presenterRandomToast(
      "اختر الفريق أولاً"
    )

    return
  }

  const answer =
    selectedAnswer === "خطأ"
      ? "خطأ"
      : "صح"

  const oldRandom =
    presenterLiveState?.randomChallenge ||
    {}

  presenterLiveState = {
    ...(presenterLiveState || {}),

    randomChallenge: {
      ...oldRandom,

      box4: {
        ...(oldRandom.box4 || {}),
        revealed: true
      }
    }
  }

  presenterRandomActionBusy = true

  markPresenterRandomLocalSync(1200)

  await renderPresenterRandomChallenge()

  const sent = await sendCommand(
    "randomBox4Answer",
    {
      answer,
      selectedAnswer: answer,
      team: activeTeam,
      box: 4
    }
  )

  presenterRandomActionBusy = false

  if (!sent) {
    presenterRandomToast(
      "تعذر تسجيل الإجابة"
    )
  }

  updatePresenterRandomActionButtons()
}

async function nextPresenterRandomBox4Question() {
  if (presenterRandomActionBusy) {
    return
  }

  const state =
    getPresenterRandomChallengeState()

  if (
    Number(state.currentBox) !== 4
  ) {
    return
  }

  if (!state.box4?.revealed) {
    presenterRandomToast(
      "سجل نتيجة العبارة أولاً"
    )

    return
  }

  const current = Math.min(
    PRESENTER_RANDOM_BOX4_QUESTIONS_COUNT,

    Math.max(
      1,
      Number(
        state.box4
          ?.currentQuestionNumber || 1
      )
    )
  )

  const oldRandom =
    presenterLiveState?.randomChallenge ||
    {}

  if (
    current >=
    PRESENTER_RANDOM_BOX4_QUESTIONS_COUNT
  ) {
    presenterLiveState = {
      ...(presenterLiveState || {}),

      randomChallenge: {
        ...oldRandom,

        currentBox: null,
        activeTeam: null,

        box4: {
          ...(oldRandom.box4 || {}),

          active: false,
          finished: true,
          revealed: false
        }
      }
    }
  } else {
    presenterLiveState = {
      ...(presenterLiveState || {}),

      randomChallenge: {
        ...oldRandom,

        activeTeam: null,

        box4: {
          ...(oldRandom.box4 || {}),

          active: true,

          currentQuestionNumber:
            current + 1,

          revealed: false
        }
      }
    }
  }

  presenterSelectedTeam = null
  presenterRandomActionBusy = true

  markPresenterRandomLocalSync(1200)

  await renderPresenterRandomChallenge()

  const sent = await sendCommand(
    "randomBox4Next",
    {
      current,
      next: current + 1,
      box: 4
    }
  )

  presenterRandomActionBusy = false

  if (!sent) {
    presenterRandomToast(
      "تعذر الانتقال للسؤال التالي"
    )
  }
}

/* =========================
   19) BOX 5
========================= */

function getPresenterRandomBox5Total() {
  return normalizePresenterRandomFatblaCount(
    presenterRandomSettings.fatblaCount
  )
}

async function openPresenterRandomBox5Number(
  number
) {
  if (presenterRandomActionBusy) {
    return
  }

  const state =
    getPresenterRandomChallengeState()

  if (
    Number(state.currentBox) !== 5
  ) {
    return
  }

  if (state.box5?.currentNumber) {
    presenterRandomToast(
      "ارجع للأرقام أولاً"
    )

    return
  }

  const total =
    getPresenterRandomBox5Total()

  const safeNumber =
    Number(number || 0)

  if (
    safeNumber < 1 ||
    safeNumber > total
  ) {
    return
  }

  const openedNumbers =
    Array.isArray(
      state.box5?.openedNumbers
    )
      ? state.box5.openedNumbers
          .map(Number)
      : []

  if (
    openedNumbers.includes(
      safeNumber
    )
  ) {
    presenterRandomToast(
      "هذا الرقم مستخدم"
    )

    return
  }

  const row =
    getPresenterRandomFatblaRow(
      safeNumber
    )

  if (!row) {
    presenterRandomToast(
      "لا توجد بيانات لهذا الرقم"
    )

    return
  }

  const oldRandom =
    presenterLiveState?.randomChallenge ||
    {}

  presenterLiveState = {
    ...(presenterLiveState || {}),

    randomChallenge: {
      ...oldRandom,

      activeTeam: null,

      box5: {
        ...(oldRandom.box5 || {}),

        active: true,
        currentNumber: safeNumber,
        revealedAnswer: false
      }
    }
  }

  presenterSelectedTeam = null
  presenterRandomActionBusy = true

  markPresenterRandomLocalSync(1200)

  await renderPresenterRandomChallenge()

  const sent = await sendCommand(
    "randomBox5OpenNumber",
    {
      number: safeNumber,
      box: 5
    }
  )

  presenterRandomActionBusy = false

  if (!sent) {
    presenterRandomToast(
      "تعذر فتح الرقم"
    )
  }

  updatePresenterRandomActionButtons()
}

async function revealPresenterRandomBox5Answer() {
  if (presenterRandomActionBusy) {
    return
  }

  const state =
    getPresenterRandomChallengeState()

  const number =
    Number(
      state.box5?.currentNumber || 0
    )

  if (!number) {
    presenterRandomToast(
      "اختر رقمًا أولاً"
    )

    return
  }

  if (
    state.box5?.revealedAnswer
  ) {
    return
  }

  const oldRandom =
    presenterLiveState?.randomChallenge ||
    {}

  presenterLiveState = {
    ...(presenterLiveState || {}),

    randomChallenge: {
      ...oldRandom,

      box5: {
        ...(oldRandom.box5 || {}),

        revealedAnswer: true
      }
    }
  }

  presenterRandomActionBusy = true

  markPresenterRandomLocalSync(900)

  await renderPresenterRandomChallenge()

  const sent = await sendCommand(
    "randomBox5RevealAnswer",
    {
      number,
      box: 5
    }
  )

  presenterRandomActionBusy = false

  if (!sent) {
    presenterRandomToast(
      "تعذر إظهار الإجابة"
    )
  }

  updatePresenterRandomActionButtons()
}

async function completePresenterRandomBox5Number(
  isCorrect
) {
  if (presenterRandomActionBusy) {
    return
  }

  const state =
    getPresenterRandomChallengeState()

  const number =
    Number(
      state.box5?.currentNumber || 0
    )

  if (!number) {
    presenterRandomToast(
      "اختر رقمًا أولاً"
    )

    return
  }

  const correct =
    !!isCorrect

  const activeTeam =
    getPresenterRandomActiveTeam()

  if (
    correct &&
    !activeTeam
  ) {
    presenterRandomToast(
      "اختر الفريق أولاً"
    )

    return
  }

  presenterRandomActionBusy = true

  if (correct) {
    const oldRandom =
      presenterLiveState?.randomChallenge ||
      {}

    presenterLiveState = {
      ...(presenterLiveState || {}),

      randomChallenge: {
        ...oldRandom,

        box5: {
          ...(oldRandom.box5 || {}),

          revealedAnswer: true
        }
      }
    }

    markPresenterRandomLocalSync(1200)

    await renderPresenterRandomChallenge()
  }

const sent =
  await sendPresenterRandomCommandSafe(
    "randomBox5CompleteNumber",
    {
      number,
      correct,
      isCorrect: correct,
      team: activeTeam || null,
      box: 5
    }
  )

  presenterRandomActionBusy = false

  if (!sent) {
    presenterRandomToast(
      "تعذر تسجيل النتيجة"
    )
  }

  updatePresenterRandomActionButtons()
}

async function cancelPresenterRandomBox5Number() {
  if (presenterRandomActionBusy) {
    return
  }

  const state =
    getPresenterRandomChallengeState()

  const number =
    Number(
      state.box5?.currentNumber || 0
    )

  if (!number) {
    return
  }

  const oldRandom =
    presenterLiveState?.randomChallenge ||
    {}

  presenterLiveState = {
    ...(presenterLiveState || {}),

    randomChallenge: {
      ...oldRandom,

      activeTeam: null,

      box5: {
        ...(oldRandom.box5 || {}),

        currentNumber: null,
        revealedAnswer: false
      }
    }
  }

  presenterSelectedTeam = null
  presenterRandomActionBusy = true

  markPresenterRandomLocalSync(900)

  await renderPresenterRandomChallenge()

const sent =
  await sendPresenterRandomCommandSafe(
    "randomBox5CancelNumber",
    {
      number,
      box: 5
    }
  )

  presenterRandomActionBusy = false

  if (!sent) {
    presenterRandomToast(
      "تعذر الرجوع للأرقام"
    )
  }
}

async function presenterRandomBox5MediaAction() {
  if (presenterRandomActionBusy) {
    return
  }

  const state =
    getPresenterRandomChallengeState()

  const row =
    getPresenterRandomFatblaRow(
      state.box5?.currentNumber
    )

  if (!row) {
    presenterRandomToast(
      "لا توجد بيانات للرقم"
    )

    return
  }

  if (row.video) {
const sent =
  await sendPresenterRandomCommandSafe(
    "randomBox5PlayVideo",
    {
      number: row.number,
      box: 5
    }
  )

    if (!sent) {
      presenterRandomToast(
        "تعذر تشغيل الفيديو"
      )
    }

    return
  }

  if (row.image) {
const sent =
  await sendPresenterRandomCommandSafe(
    "zoomImage",
    {
      number: row.number,
      box: 5
    }
  )

    if (!sent) {
      presenterRandomToast(
        "تعذر تكبير الصورة"
      )
    }

    return
  }

  presenterRandomToast(
    "لا توجد صورة أو فيديو"
  )
}

/* =========================
   20) BUTTON STATES
========================= */

function updatePresenterRandomActionButtons() {
  const state =
    getPresenterRandomChallengeState()

  const currentBox =
    getPresenterRandomCurrentBox()

  const activeTeam =
    getPresenterRandomActiveTeam()

  const busy =
    presenterRandomActionBusy

  const auctionCount =
    getPresenterRandomAuctionCount(
      state
    )

  const box3Errors =
    state.box3?.errors || {
      A: 0,
      B: 0
    }

  const box3PassUsed =
    state.box3?.passUsed || {
      A: false,
      B: false
    }

  const canBox3Pass =
    activeTeam &&
    Number(box3Errors?.[activeTeam] || 0) === 2 &&
    !box3PassUsed?.[activeTeam] &&
    state.box3?.lastAction !== "pass"

  document
    .querySelectorAll(
      "[data-random-action]"
    )
    .forEach(button => {
      const action =
        button.dataset.randomAction ||
        ""

      let disabled = busy

      if (action === "openBox") {
        const box = Number(
          button.dataset.randomBox || 0
        )

        disabled =
          busy ||
          !!presenterRandomPendingBox ||
          !getPresenterRandomBoxEnabled(
            box
          ) ||
          !!state?.[`box${box}`]
            ?.finished
      }

      if (action === "box1Score") {
        disabled =
          busy ||
          !activeTeam ||
          !state.box1?.started ||
          !!state.box1?.rolling
      }

      if (
        action === "startBox2Timer"
      ) {
        disabled =
          busy ||
          !activeTeam ||
          !auctionCount ||
          (
            getPresenterRandomTimerRunning(
              2
            ) &&
            getPresenterRandomRemainingTime(
              2
            ) > 0
          )
      }

      if (action === "box2Score") {
        disabled =
          busy ||
          !activeTeam ||
          !auctionCount
      }

      if (action === "box3StartTimer") {
        disabled =
          busy ||
          !activeTeam ||
          !!state.box3?.choosingPoints ||
          (
            getPresenterRandomTimerRunning(
              3
            ) &&
            getPresenterRandomRemainingTime(
              3
            ) > 0
          )
      }

      if (action === "box3Wrong") {
        disabled =
          busy ||
          !activeTeam ||
          !!state.box3?.choosingPoints
      }

      if (action === "box3Pass") {
        disabled =
          busy ||
          !canBox3Pass ||
          !!state.box3?.choosingPoints
      }

      if (action === "box3Switch") {
        disabled =
          busy ||
          !activeTeam ||
          !!state.box3?.choosingPoints
      }

      if (action === "box3FinishRound") {
        disabled =
          busy ||
          !!state.box3?.choosingPoints
      }

      if (action === "box3Score") {
        disabled =
          busy ||
          !state.box3?.choosingPoints
      }

      if (action === "box4Start") {
        disabled =
          busy ||
          !activeTeam ||
          !!state.box4?.started
      }

      if (action === "box4SecondTeam") {
        disabled =
          busy ||
          !state.box4?.secondTeamBreak
      }

      if (action === "box4Answer") {
        disabled =
          busy ||
          !activeTeam ||
          !state.box4?.started ||
          !!state.box4?.revealed ||
          !!state.box4?.reviewMode ||
          !!state.box4?.secondTeamBreak
      }

      if (action === "box4Next") {
        disabled =
          busy ||
          !state.box4?.started ||
          !state.box4?.revealed ||
          !!state.box4?.reviewMode ||
          !!state.box4?.secondTeamBreak
      }

      if (action === "box5Open") {
        disabled =
          busy ||
          !!state.box5?.currentNumber
      }

      if (action === "box5Block") {
        disabled =
          busy ||
          (
            !!state.box5?.currentNumber &&
            !!state.box5?.revealedAnswer
          ) ||
          (
            getPresenterRandomTimerRunning(5) &&
            getPresenterRandomRemainingTime(5) > 0
          )
      }

      if (action === "box5Correct") {
        disabled =
          busy ||
          !state.box5?.currentNumber ||
          !activeTeam
      }

      if (action === "box5Wrong") {
        disabled =
          busy ||
          !state.box5?.currentNumber
      }

      if (action === "box5Cancel") {
        disabled =
          busy ||
          !state.box5?.currentNumber
      }

      if (action === "box5Media") {
        const row =
          getPresenterRandomFatblaRow(
            state.box5?.currentNumber
          )

        disabled =
          busy ||
          !row ||
          (!row.image && !row.video)
      }

      if (action === "finish") {
        disabled =
          busy ||
          !currentBox
      }

      button.disabled = disabled
    })

  const startTimerButton =
    document.getElementById(
      "presenterRandomStartBox2TimerBtn"
    )

  if (startTimerButton) {
    const running =
      getPresenterRandomTimerRunning(2) &&
      getPresenterRandomRemainingTime(2) >
        0

    startTimerButton.innerText =
      running
        ? "المؤقت يعمل"
        : "بدء المؤقت"
  }

  const auctionInput =
    document.getElementById(
      "presenterRandomAuctionInput"
    )

  if (auctionInput) {
    auctionInput.disabled = busy
  }
}

/* =========================
   21) HTML HELPERS
========================= */

function buildPresenterRandomQuestionCard({
  title = "",
  number = 0,
  total = 0,
  question = "",
  answer = ""
} = {}) {
  return `
    <section class="presenterRandomQuestionView">

      <header class="presenterRandomQuestionHeader">

        <strong>
          ${presenterRandomSafeHtml(title)}
        </strong>

        ${
          number
            ? `
              <span>
                ${number}${total ? ` / ${total}` : ""}
              </span>
            `
            : ""
        }

      </header>

      <div class="presenterRandomQuestionBody">

        <section class="presenterRandomQABox questionBox">
          <span>السؤال</span>

          <strong>
            ${presenterRandomSafeHtml(
              question || "—"
            )}
          </strong>
        </section>

        <section class="presenterRandomQABox answerBox">
          <span>الإجابة</span>

          <strong>
            ${presenterRandomSafeHtml(
              answer || "—"
            )}
          </strong>
        </section>

      </div>

    </section>
  `
}

function buildPresenterRandomBox1PlayersHtml(
  players
) {
  return `
    <section class="presenterRandomPlayersView">

      <div class="presenterRandomPlayerNames">

        ${[0, 1]
          .map(index => {
            const item =
              players[index] || ""

            const image =
              getPresenterRandomImageUrl(item)

            const name =
              getPresenterRandomImageName(item) || "—"

            return `
              <article
                class="presenterRandomPlayerNameCard"
                data-player-index="${index}"
              >

                <div class="presenterRandomPlayerImageBox">

                  ${
                    image
                      ? `
                        <img
                          data-player-image="${index}"
                          src="${presenterRandomSafeHtml(image)}"
                          alt=""
                        >
                      `
                      : `
                        <div
                          class="presenterRandomPlayerPlaceholder"
                          data-player-image="${index}"
                        >
                          —
                        </div>
                      `
                  }

                </div>

                <strong data-player-name="${index}">
                  ${presenterRandomSafeHtml(name)}
                </strong>

              </article>
            `
          })
          .join(`
            <div class="presenterRandomVsText">
              VS
            </div>
          `)}

      </div>

    </section>
  `
}

function buildPresenterRandomBox5MediaHtml(row) {
  if (!row) {
    return `
      <div class="presenterRandomMediaEmpty">
        —
      </div>
    `
  }

  if (row.video) {
    return `
      <div class="presenterRandomMediaPreview">

        <video
          src="${presenterRandomSafeHtml(row.video)}"
          controls
          muted
          playsinline
          preload="metadata"
        ></video>

      </div>
    `
  }

  if (row.image) {
    return `
      <div class="presenterRandomMediaPreview">

        <img
          src="${presenterRandomSafeHtml(row.image)}"
          alt=""
          loading="eager"
          decoding="async"
        >

      </div>
    `
  }

  return `
    <div class="presenterRandomMediaEmpty">
      —
    </div>
  `
}

/* =========================
   22) BOX CONTENT
========================= */

function buildPresenterRandomBoxContent(state) {
  const currentBox =
    Number(state.currentBox || 0)

  const activeTeam =
    getPresenterRandomActiveTeam()

  if (currentBox === 1) {
    const players =
      getPresenterRandomBox1Players(state)

    const started =
      !!state.box1?.started ||
      !!state.box1?.rolling ||
      players.filter(Boolean).length > 0

    if (!started) {
      return `
        <section class="presenterRandomPoolView">

          <button
            type="button"
            class="presenterRandomPoolBtn ${state.box1?.pool === "saudi" ? "active" : ""}"
            onclick="startPresenterRandomBox1('saudi')"
          >
            <span>🇸🇦</span>
            <strong>الدوري السعودي</strong>
          </button>

          <button
            type="button"
            class="presenterRandomPoolBtn ${state.box1?.pool === "world" ? "active" : ""}"
            onclick="startPresenterRandomBox1('world')"
          >
            <span>🌍</span>
            <strong>عالمي</strong>
          </button>

        </section>
      `
    }

    return `
      ${buildPresenterRandomBox1PlayersHtml(players)}

      <section class="presenterRandomStatusPanel">
        <strong>
          ${
            state.box1?.rolling
              ? "جاري الاختيار"
              : activeTeam
                ? presenterRandomSafeHtml(
                    getPresenterRandomTeamName(activeTeam)
                  )
                : "اختر الفريق"
          }
        </strong>
      </section>
    `
  }

  if (currentBox === 2) {
    const number =
      Math.min(
        PRESENTER_RANDOM_BOX2_QUESTIONS_COUNT,
        Math.max(
          1,
          Number(state.box2?.currentQuestionNumber || 1)
        )
      )

    const row =
      getPresenterRandomQuestion("auction", number)

    const count =
      getPresenterRandomAuctionCount(state)

    const fixedPoints =
      getPresenterRandomAuctionFixedPoints(state)

    const timer =
      getPresenterRandomRemainingTime(2)

    return `
      ${buildPresenterRandomQuestionCard({
        title: "المزاد",
        number,
        total: PRESENTER_RANDOM_BOX2_QUESTIONS_COUNT,
        question: row?.question || state.box2?.question,
        answer: row?.answer
      })}

      <section class="presenterRandomAuctionView">

        <input
          id="presenterRandomAuctionInput"
          class="presenterRandomAuctionInput"
          type="tel"
          inputmode="numeric"
          autocomplete="off"
          maxlength="5"
          value="${count || ""}"
          placeholder="عدد الإجابات"
          oninput="setPresenterRandomAuctionPoints(this.value)"
        >

        <div class="presenterRandomMetricsGrid">

          <button
            type="button"
            class="presenterRandomMetric countMetric"
            onclick="decreasePresenterRandomAuctionPoints()"
          >
            <span>العدد</span>
            <strong id="presenterRandomAuctionCount">${count}</strong>
          </button>

          <div class="presenterRandomMetric timerMetric">
            <span>الوقت</span>
            <strong id="presenterRandomAuctionTimer">${timer}</strong>
          </div>

          <div class="presenterRandomMetric pointsMetric">
            <span>النقاط</span>
            <strong id="presenterRandomAuctionFixed">${fixedPoints}</strong>
          </div>

        </div>

      </section>
    `
  }

  if (currentBox === 3) {
    const number =
      Math.min(
        PRESENTER_RANDOM_BOX3_QUESTIONS_COUNT,
        Math.max(
          1,
          Number(state.box3?.currentQuestionNumber || 1)
        )
      )

    const row =
      getPresenterRandomQuestion(
        "whatDoYouKnow",
        number
      )

    const timer =
      getPresenterRandomRemainingTime(3)

    const errorsA =
      Number(state.box3?.errors?.A || 0)

    const errorsB =
      Number(state.box3?.errors?.B || 0)

    return `
      ${buildPresenterRandomQuestionCard({
        title: "ماذا تعرف",
        number,
        total: PRESENTER_RANDOM_BOX3_QUESTIONS_COUNT,
        question: row?.question || state.box3?.question,
        answer: row?.answer
      })}

      <section class="presenterRandomKnowView">

        <div
          id="presenterRandomBox3Timer"
          class="presenterRandomTimerBox ${timer <= 2 ? "danger presenterTimerDanger" : ""}"
        >
          ${timer}
        </div>

        <div class="presenterRandomKnowBoard">

          <div
            class="presenterRandomKnowTeam presenterRandomTeamName ${activeTeam === "A" ? "active" : ""}"
            data-random-team="A"
          >
            <span>
              ${presenterRandomSafeHtml(presenterTeamAName)}
            </span>

            <strong>${errorsA} / 3</strong>
          </div>

          <div
            class="presenterRandomKnowTeam presenterRandomTeamName ${activeTeam === "B" ? "active" : ""}"
            data-random-team="B"
          >
            <span>
              ${presenterRandomSafeHtml(presenterTeamBName)}
            </span>

            <strong>${errorsB} / 3</strong>
          </div>

        </div>

      </section>
    `
  }

  if (currentBox === 4) {
    const number =
      Math.min(
        PRESENTER_RANDOM_BOX4_QUESTIONS_COUNT,
        Math.max(
          1,
          Number(state.box4?.currentQuestionNumber || 1)
        )
      )

    const row =
      getPresenterRandomQuestion("trueFalse", number)

    const timer =
      getPresenterRandomRemainingTime(4)

    if (!state.box4?.started) {
      return `
        <section class="presenterRandomStartView">
          <strong>
            ${
              activeTeam
                ? presenterRandomSafeHtml(
                    getPresenterRandomTeamName(activeTeam)
                  )
                : "اختر الفريق"
            }
          </strong>
        </section>
      `
    }

    if (state.box4?.secondTeamBreak) {
      const firstTeam =
        state.box4?.startingTeam || "A"

      const secondTeam =
        firstTeam === "A" ? "B" : "A"

      return `
        <section class="presenterRandomStartView">
          <strong>
            ${presenterRandomSafeHtml(
              getPresenterRandomTeamName(secondTeam)
            )}
          </strong>
        </section>
      `
    }

    if (state.box4?.reviewMode) {
      return `
        <section class="presenterRandomStartView">
          <strong>المراجعة</strong>
        </section>
      `
    }

    return `
      ${buildPresenterRandomQuestionCard({
        title: "صح أو خطأ",
        number:
          ((number - 1) %
            PRESENTER_RANDOM_BOX4_TEAM_QUESTIONS_COUNT) + 1,
        total: PRESENTER_RANDOM_BOX4_TEAM_QUESTIONS_COUNT,
        question: row?.question,
        answer: row?.answer
      })}

      <section class="presenterRandomBox4View">

        <div class="presenterRandomMetricsGrid">

          <div class="presenterRandomMetric timerMetric">
            <span>الوقت</span>
            <strong id="presenterRandomBox4Timer">${timer}</strong>
          </div>

          <div class="presenterRandomMetric pointsMetric">
            <span>
              ${presenterRandomSafeHtml(presenterTeamAName)}
            </span>

            <strong>
              ${getPresenterRandomBoxScore("A", 4, state)}
              /
              ${PRESENTER_RANDOM_BOX4_TEAM_QUESTIONS_COUNT}
            </strong>
          </div>

          <div class="presenterRandomMetric pointsMetric">
            <span>
              ${presenterRandomSafeHtml(presenterTeamBName)}
            </span>

            <strong>
              ${getPresenterRandomBoxScore("B", 4, state)}
              /
              ${PRESENTER_RANDOM_BOX4_TEAM_QUESTIONS_COUNT}
            </strong>
          </div>

        </div>

      </section>
    `
  }

  if (currentBox === 5) {
    const total =
      getPresenterRandomBox5Total()

    const currentNumber =
      Number(state.box5?.currentNumber || 0)

    const openedNumbers =
      Array.isArray(state.box5?.openedNumbers)
        ? state.box5.openedNumbers.map(Number)
        : []

    const blockTimerVisible =
      !!state.box5?.blockTimerVisible ||
      !!state.box5?.blockArmed ||
      getPresenterRandomTimerRunning(5)

    const blockTimer =
      getPresenterRandomRemainingTime(5)

    if (!currentNumber) {
      return `
        <section class="presenterRandomFatblaNumbersView">

          <div class="presenterRandomFatblaNumbers">

            ${Array.from(
              { length: total },
              (_, index) => index + 1
            )
              .map(number => {
                const opened =
                  openedNumbers.includes(number)

                return `
                  <button
                    type="button"
                    class="
                      presenterNumberBtn
                      presenterRandomFatblaNumber
                      ${opened ? "presenterOpened" : ""}
                    "
                    data-random-action="box5Open"
                    ${opened ? "disabled" : ""}
                    onclick="openPresenterRandomBox5Number(${number})"
                  >
                    ${opened ? "" : number}
                  </button>
                `
              })
              .join("")}

          </div>

          ${
            blockTimerVisible
              ? `
                <div class="presenterRandomBlockStatus">
                  <span>بلوك</span>

                  <strong id="presenterRandomBox5BlockTimer">
                    ${blockTimer}
                  </strong>
                </div>
              `
              : ""
          }

        </section>
      `
    }

    const row =
      getPresenterRandomFatblaRow(currentNumber)

    return `
      <section class="presenterRandomFatblaQuestionView">

        <header class="presenterRandomQuestionHeader">

          <strong>فتبلة</strong>

          <span>${currentNumber}</span>

        </header>

        ${buildPresenterRandomBox5MediaHtml(row)}

        <div class="presenterRandomQuestionBody">

          <section class="presenterRandomQABox questionBox">
            <span>السؤال</span>

            <strong>
              ${presenterRandomSafeHtml(
                row?.question || "—"
              )}
            </strong>
          </section>

          <section class="presenterRandomQABox answerBox">
            <span>الإجابة</span>

            <strong>
              ${presenterRandomSafeHtml(
                row?.answer || "—"
              )}
            </strong>
          </section>

        </div>

        ${
          row?.note
            ? `
              <div class="presenterRandomNote">
                ${presenterRandomSafeHtml(row.note)}
              </div>
            `
            : ""
        }

        ${
          blockTimerVisible
            ? `
              <div class="presenterRandomBlockStatus">
                <span>بلوك</span>

                <strong id="presenterRandomBox5BlockTimer">
                  ${blockTimer}
                </strong>
              </div>
            `
            : ""
        }

      </section>
    `
  }

  return ""
}

/* =========================
   23) ACTIONS HTML
========================= */

function buildPresenterRandomActionsHtml(state) {
  const currentBox =
    Number(state.currentBox || 0)

  if (!currentBox) {
    return ""
  }

  if (currentBox === 1) {
    const players =
      getPresenterRandomBox1Players(state)

    const started =
      !!state.box1?.started ||
      players.filter(Boolean).length > 0

    if (!started) {
      return `
        <button
          type="button"
          class="presenterBtn gray"
          data-random-action="finish"
          onclick="runPresenterRandomAction('randomFinishBox')"
        >
          إنهاء
        </button>
      `
    }

    return `
      <button
        type="button"
        class="presenterBtn gray"
        onclick="runPresenterRandomAction('randomSkip',{pool:'${state.box1?.pool || "saudi"}'})"
      >
        إعادة
      </button>

      <button
        type="button"
        class="presenterBtn green"
        data-random-action="box1Score"
        onclick="runPresenterRandomAction('correct')"
      >
        صح
      </button>

      <button
        type="button"
        class="presenterBtn red"
        data-random-action="box1Score"
        onclick="runPresenterRandomAction('wrong')"
      >
        خطأ
      </button>

      <button
        type="button"
        class="presenterBtn gray"
        data-random-action="finish"
        onclick="runPresenterRandomAction('randomFinishBox')"
      >
        إنهاء
      </button>
    `
  }

  if (currentBox === 2) {
    return `
      <button
        type="button"
        id="presenterRandomStartBox2TimerBtn"
        class="presenterBtn dark"
        data-random-action="startBox2Timer"
        onclick="runPresenterRandomAction('randomStartBox2Timer')"
      >
        المؤقت
      </button>

      <button
        type="button"
        class="presenterBtn green"
        data-random-action="box2Score"
        onclick="sendPresenterRandomAuctionScore('correct')"
      >
        صح
      </button>

      <button
        type="button"
        class="presenterBtn red"
        data-random-action="box2Score"
        onclick="sendPresenterRandomAuctionScore('wrong')"
      >
        خطأ
      </button>

      <button
        type="button"
        class="presenterBtn gray"
        data-random-action="finish"
        onclick="runPresenterRandomAction('randomFinishBox')"
      >
        إنهاء
      </button>
    `
  }

  if (currentBox === 3) {
    if (state.box3?.choosingPoints) {
      return `
        ${[1, 2]
          .map(points => `
            <button
              type="button"
              class="presenterBtn green"
              data-random-action="box3Score"
              onclick="scorePresenterRandomBox3Points(${points})"
            >
              ${points}
            </button>
          `)
          .join("")}

        <button
          type="button"
          class="presenterBtn gray"
          data-random-action="finish"
          onclick="runPresenterRandomAction('randomFinishBox')"
        >
          إنهاء
        </button>
      `
    }

    return `
      <button
        type="button"
        class="presenterBtn dark"
        data-random-action="box3StartTimer"
        onclick="runPresenterRandomAction('randomStartBox3Timer')"
      >
        المؤقت
      </button>

      <button
        type="button"
        class="presenterBtn red"
        data-random-action="box3Wrong"
        onclick="runPresenterRandomAction('randomBox3Wrong')"
      >
        خطأ
      </button>

      <button
        type="button"
        class="presenterBtn blue"
        data-random-action="box3Pass"
        onclick="runPresenterRandomAction('randomBox3Pass')"
      >
        باس
      </button>

      <button
        type="button"
        class="presenterBtn gray"
        data-random-action="box3Switch"
        onclick="runPresenterRandomAction('randomBox3SwitchTeam')"
      >
        تبديل
      </button>

      <button
        type="button"
        class="presenterBtn dark"
        data-random-action="box3FinishRound"
        onclick="finishPresenterRandomBox3Round()"
      >
        إنهاء
      </button>
    `
  }

  if (currentBox === 4) {
    if (!state.box4?.started) {
      return `
        <button
          type="button"
          class="presenterBtn dark"
          data-random-action="box4Start"
          onclick="runPresenterRandomAction('randomStartBox4Game')"
        >
          بدء
        </button>

        <button
          type="button"
          class="presenterBtn gray"
          data-random-action="finish"
          onclick="runPresenterRandomAction('randomFinishBox')"
        >
          إنهاء
        </button>
      `
    }

    if (state.box4?.secondTeamBreak) {
      return `
        <button
          type="button"
          class="presenterBtn dark"
          data-random-action="box4SecondTeam"
          onclick="runPresenterRandomAction('randomStartBox4SecondTeam')"
        >
          بدء
        </button>

        <button
          type="button"
          class="presenterBtn gray"
          data-random-action="finish"
          onclick="runPresenterRandomAction('randomFinishBox')"
        >
          إنهاء
        </button>
      `
    }

    if (state.box4?.reviewMode) {
      return `
        <button
          type="button"
          class="presenterBtn gray"
          data-random-action="finish"
          onclick="runPresenterRandomAction('randomFinishBox')"
        >
          إنهاء
        </button>
      `
    }

    const number =
      Number(state.box4?.currentQuestionNumber || 1)

    const lastQuestion =
      number >= PRESENTER_RANDOM_BOX4_QUESTIONS_COUNT

    return `
      <button
        type="button"
        class="presenterBtn green"
        data-random-action="box4Answer"
        onclick="answerPresenterRandomBox4('صح')"
      >
        صح
      </button>

      <button
        type="button"
        class="presenterBtn red"
        data-random-action="box4Answer"
        onclick="answerPresenterRandomBox4('خطأ')"
      >
        خطأ
      </button>

      <button
        type="button"
        class="presenterBtn blue"
        data-random-action="box4Next"
        onclick="nextPresenterRandomBox4Question()"
      >
        ${lastQuestion ? "مراجعة" : "التالي"}
      </button>

      <button
        type="button"
        class="presenterBtn gray"
        data-random-action="finish"
        onclick="runPresenterRandomAction('randomFinishBox')"
      >
        إنهاء
      </button>
    `
  }

  if (currentBox === 5) {
    if (!state.box5?.currentNumber) {
      return `
        <button
          type="button"
          class="presenterBtn dark"
          data-random-action="box5Block"
          onclick="runPresenterRandomAction('randomBox5BlockTimer')"
        >
          بلوك
        </button>

        <button
          type="button"
          class="presenterBtn gray"
          data-random-action="finish"
          onclick="runPresenterRandomAction('randomFinishBox')"
        >
          إنهاء
        </button>
      `
    }

    const row =
      getPresenterRandomFatblaRow(
        state.box5?.currentNumber
      )

    const mediaText =
      row?.video
        ? "فيديو"
        : row?.image
          ? "تكبير"
          : "وسائط"

    return `
      <button
        type="button"
        class="presenterBtn dark"
        data-random-action="box5Block"
        onclick="runPresenterRandomAction('randomBox5BlockTimer')"
      >
        بلوك
      </button>

      <button
        type="button"
        class="presenterBtn blue"
        data-random-action="box5Media"
        onclick="presenterRandomBox5MediaAction()"
      >
        ${mediaText}
      </button>

      <button
        type="button"
        class="presenterBtn green"
        data-random-action="box5Correct"
        onclick="completePresenterRandomBox5Number(true)"
      >
        صح
      </button>

      <button
        type="button"
        class="presenterBtn red"
        data-random-action="box5Wrong"
        onclick="completePresenterRandomBox5Number(false)"
      >
        خطأ
      </button>

      <button
        type="button"
        class="presenterBtn gray"
        data-random-action="box5Cancel"
        onclick="cancelPresenterRandomBox5Number()"
      >
        رجوع
      </button>
    `
  }

  return ""
}

/* =========================
   24) MAIN RENDER
========================= */

async function renderPresenterRandomChallenge() {
  const panel =
    document.getElementById(
      "presenterPanel"
    )

  if (!panel) return

  if (!presenterRandomDataLoaded) {
    panel.innerHTML = `
      <div class="presenterLoadingState">
        جاري تحميل التحدي...
      </div>
    `

    await loadPresenterRandomChallengeData({
      backgroundRefresh: false
    })

    if (
      presenterSegment !==
      "randomChallenge"
    ) {
      return
    }
  }

  const state =
    getPresenterRandomChallengeState()

  const currentBox =
    getPresenterRandomCurrentBox()

  const uiMode =
    getPresenterRandomUiMode()

  presenterRandomLastUiMode =
    uiMode

  presenterRandomLastStructureKey =
    getPresenterRandomStructureKey()

  const title =
    document.getElementById(
      "presenterSegmentTitle"
    )

  if (title) {
    title.innerText =
      currentBox
        ? getPresenterRandomBoxTitle(
            currentBox
          )
        : "التحدي"
  }

  const enabledBoxes =
    getPresenterRandomEnabledBoxes()

  panel.innerHTML = `
    <section
      class="presenterRandomControlView"
      data-random-mode="${uiMode}"
    >

      ${
        !currentBox
          ? `
            <header class="presenterRandomControlHeader">

              <div class="presenterRandomHeaderTitle">
                <strong>التحدي</strong>
              </div>

              <div class="presenterRandomHeaderScores">

                <span>
                  ${presenterRandomSafeHtml(presenterTeamAName)}

                  <strong id="presenterRandomScoreA">
                    ${getPresenterRandomMainScore("A", state)}
                  </strong>
                </span>

                <span>
                  ${presenterRandomSafeHtml(presenterTeamBName)}

                  <strong id="presenterRandomScoreB">
                    ${getPresenterRandomMainScore("B", state)}
                  </strong>
                </span>

              </div>

            </header>

            <main class="presenterRandomSelectMain">

              <div class="presenterRandomChooseGrid">

                ${enabledBoxes
                  .map(box => {
                    const finished =
                      !!state?.[`box${box}`]?.finished

                    const pending =
                      presenterRandomPendingBox === box

                    return `
                      <button
                        type="button"
                        class="
                          presenterRandomChooseBtn
                          ${finished ? "presenterOpened" : ""}
                          ${pending ? "presenterPendingNumber" : ""}
                        "
                        data-random-action="openBox"
                        data-random-box="${box}"
                        onclick="openPresenterRandomBox(${box})"
                      >
                        <span>
                          ${box}
                        </span>

                        <strong>
                          ${presenterRandomSafeHtml(
                            getPresenterRandomBoxTitle(box)
                          )}
                        </strong>
                      </button>
                    `
                  })
                  .join("")}

              </div>

            </main>
          `
          : `
            <header class="presenterRandomControlHeader">

              <button
                type="button"
                class="presenterRandomBackBtn"
                onclick="presenterRandomBackStep()"
              >
                رجوع
              </button>

              <div class="presenterRandomHeaderTitle">
                <strong>
                  ${presenterRandomSafeHtml(
                    getPresenterRandomBoxTitle(currentBox)
                  )}
                </strong>

                <span>
                  ${currentBox}
                </span>
              </div>

              <button
                type="button"
                class="presenterRandomEndBtn"
                data-random-action="finish"
                onclick="runPresenterRandomAction('randomFinishBox')"
              >
                إنهاء
              </button>

            </header>

            <main class="presenterRandomControlMain">

              <section class="presenterRandomContentPanel">
                ${buildPresenterRandomBoxContent(state)}
              </section>

              <aside class="presenterRandomSidePanel">

                <div class="presenterRandomTeamsBox">
                  ${teamButtons()}
                </div>

                <section class="presenterRandomScorePanel">

                  <span>
                    ${presenterRandomSafeHtml(presenterTeamAName)}

                    <strong id="presenterRandomScoreA">
                      ${getPresenterRandomMainScore("A", state)}
                    </strong>
                  </span>

                  <span>
                    ${presenterRandomSafeHtml(presenterTeamBName)}

                    <strong id="presenterRandomScoreB">
                      ${getPresenterRandomMainScore("B", state)}
                    </strong>
                  </span>

                </section>

              </aside>

            </main>

            <footer class="presenterRandomCommandBar">
              ${buildPresenterRandomActionsHtml(state)}
            </footer>
          `
      }

    </section>
  `

  refreshPresenterRandomChallengeFromState()
  startPresenterRandomTimerWatcher()
}

/* =========================
   25) PARTIAL REFRESH
========================= */

function refreshPresenterRandomChallengeFromState() {
  if (
    presenterSegment !==
    "randomChallenge"
  ) {
    stopPresenterRandomTimerWatcher()
    return
  }

  const state =
    getPresenterRandomChallengeState()

  const uiMode =
    getPresenterRandomUiMode()

  const structureKey =
    getPresenterRandomStructureKey()

  if (
    presenterRandomLastUiMode &&
    (
      presenterRandomLastUiMode !==
        uiMode ||
      presenterRandomLastStructureKey !==
        structureKey
    )
  ) {
    renderPresenterRandomChallenge()
    return
  }

  presenterRandomLastUiMode = uiMode

  presenterRandomLastStructureKey =
    structureKey

  const activeTeam =
    getPresenterRandomActiveTeam()

  if (
    typeof updatePresenterTeamButtonsOnly ===
    "function"
  ) {
    updatePresenterTeamButtonsOnly(
      activeTeam
    )
  }

  const scoreA =
    document.getElementById(
      "presenterRandomScoreA"
    )

  const scoreB =
    document.getElementById(
      "presenterRandomScoreB"
    )

  if (scoreA) {
    scoreA.innerText =
      String(
        getPresenterRandomMainScore(
          "A",
          state
        )
      )
  }

  if (scoreB) {
    scoreB.innerText =
      String(
        getPresenterRandomMainScore(
          "B",
          state
        )
      )
  }

  document
    .querySelectorAll(
      ".presenterRandomTeamName"
    )
    .forEach(box => {
      const team =
        box.dataset.randomTeam || ""

      box.classList.toggle(
        "active",
        activeTeam === team
      )
    })

  const box1Players =
    getPresenterRandomBox1Players(
      state
    )

  ;[0, 1].forEach(index => {
    const nameElement =
      document.querySelector(
        `[data-player-name="${index}"]`
      )

    const imageElement =
      document.querySelector(
        `img[data-player-image="${index}"]`
      )

    const item =
      box1Players[index] || ""

    if (nameElement) {
      nameElement.innerText =
        getPresenterRandomImageName(
          item
        ) || "—"
    }

    if (imageElement) {
      const image =
        getPresenterRandomImageUrl(
          item
        )

      if (
        image &&
        imageElement.src !== image
      ) {
        imageElement.src = image
      }
    }
  })

  const knowTeams =
    document.querySelectorAll(
      ".presenterRandomKnowTeam"
    )

  const errorsA =
    Number(
      state.box3?.errors?.A || 0
    )

  const errorsB =
    Number(
      state.box3?.errors?.B || 0
    )

  if (knowTeams?.[0]) {
    const score =
      knowTeams[0].querySelector(
        "strong"
      )

    if (score) {
      score.innerText =
        `${errorsA} / 3`
    }
  }

  if (knowTeams?.[1]) {
    const score =
      knowTeams[1].querySelector(
        "strong"
      )

    if (score) {
      score.innerText =
        `${errorsB} / 3`
    }
  }

  const countBox =
    document.getElementById(
      "presenterRandomAuctionCount"
    )

  const fixedBox =
    document.getElementById(
      "presenterRandomAuctionFixed"
    )

  const input =
    document.getElementById(
      "presenterRandomAuctionInput"
    )

  if (
    countBox ||
    fixedBox ||
    input
  ) {
    const stateCount = Number(
      state.box2?.points ??
      state.box2?.numberInput ??
      0
    )

    const stateFixed = Number(
      state.box2?.calculatedPoints ??
      calcPresenterRandomAuctionFixedPoints(
        stateCount
      )
    )

    const inputIsFocused =
      document.activeElement === input

    const count =
      inputIsFocused
        ? Number(
            presenterRandomAuctionLocalCount ||
            stateCount ||
            0
          )
        : stateCount

    const fixed =
      inputIsFocused
        ? Number(
            presenterRandomAuctionFixedPoints ||
            stateFixed ||
            0
          )
        : stateFixed

    presenterRandomAuctionLocalCount =
      count

    presenterRandomAuctionFixedPoints =
      fixed

    if (countBox) {
      countBox.innerText =
        String(count)
    }

    if (fixedBox) {
      fixedBox.innerText =
        String(fixed)
    }

    if (
      input &&
      !inputIsFocused
    ) {
      input.value = count || ""
    }
  }

  updatePresenterRandomTimers()
  updatePresenterRandomActionButtons()

  if (!presenterRandomTimerWatcher) {
    startPresenterRandomTimerWatcher()
  }
}

/* =========================
   26) READER
========================= */

async function renderPresenterReaderRandomChallenge() {
  const panel =
    document.getElementById(
      "presenterReaderPanel"
    )

  if (!panel) return

  await loadPresenterRandomChallengeData({
    backgroundRefresh: false
  })

  const auctionRows =
    presenterRandomQuestionRows.filter(
      row =>
        row.box_key === "auction"
    )

  const knowRows =
    presenterRandomQuestionRows.filter(
      row =>
        row.box_key ===
        "whatDoYouKnow"
    )

  const trueFalseRows =
    presenterRandomQuestionRows.filter(
      row =>
        row.box_key === "trueFalse"
    )

  panel.innerHTML = `
    <div class="readerRoundsStack">

      <section class="readerRoundPage">

        <div class="readerRoundHead">
          <h2>اللاعب المشترك</h2>
          <span>
            لا يحتوي على أسئلة
          </span>
        </div>

      </section>

      <section class="readerRoundPage">

        <div class="readerRoundHead">
          <h2>المزاد</h2>
          <span>
            السؤال والإجابة
          </span>
        </div>

        <div class="readerSimpleGrid">

          ${
            auctionRows.length
              ? auctionRows
                  .map(row =>
                    readerMiniCard({
                      id: readerId([
                        "random",
                        "auction",
                        row.number
                      ]),

                      number:
                        row.number,

                      title:
                        `السؤال ${row.number}`,

                      question:
                        row.question,

                      answer:
                        row.answer
                    })
                  )
                  .join("")
              : readerEmpty(
                  "لا توجد أسئلة في المزاد"
                )
          }

        </div>

      </section>

      <section class="readerRoundPage">

        <div class="readerRoundHead">
          <h2>ماذا تعرف</h2>
          <span>
            السؤال والإجابة
          </span>
        </div>

        <div class="readerSimpleGrid">

          ${
            knowRows.length
              ? knowRows
                  .map(row =>
                    readerMiniCard({
                      id: readerId([
                        "random",
                        "know",
                        row.number
                      ]),

                      number:
                        row.number,

                      title:
                        `السؤال ${row.number}`,

                      question:
                        row.question,

                      answer:
                        row.answer
                    })
                  )
                  .join("")
              : readerEmpty(
                  "لا توجد أسئلة في ماذا تعرف"
                )
          }

        </div>

      </section>

      <section class="readerRoundPage">

        <div class="readerRoundHead">
          <h2>صح أو خطأ</h2>
          <span>
            العبارة والإجابة
          </span>
        </div>

        <div class="readerSimpleGrid">

          ${
            trueFalseRows.length
              ? trueFalseRows
                  .map(row =>
                    readerMiniCard({
                      id: readerId([
                        "random",
                        "trueFalse",
                        row.number
                      ]),

                      number:
                        row.number,

                      title:
                        `العبارة ${row.number}`,

                      question:
                        row.question,

                      answer:
                        row.answer
                    })
                  )
                  .join("")
              : readerEmpty(
                  "لا توجد عبارات صح أو خطأ"
                )
          }

        </div>

      </section>

      <section class="readerRoundPage">

        <div class="readerRoundHead">
          <h2>فتبلة</h2>
          <span>
            السؤال والوسائط والإجابة
          </span>
        </div>

        <div class="readerMediaList">

          ${
            presenterRandomFatblaRows.length
              ? presenterRandomFatblaRows
                  .map(row =>
                    readerMiniCard({
                      id: readerId([
                        "random",
                        "fatbla",
                        row.number
                      ]),

                      number:
                        row.number,

                      title:
                        `رقم ${row.number}`,

                      question:
                        row.question,

                      answer:
                        row.answer,

                      image:
                        row.image,

                      video:
                        row.video
                    })
                  )
                  .join("")
              : readerEmpty(
                  "لا توجد أسئلة في فتبلة"
                )
          }

        </div>

      </section>

    </div>
  `
}

/* =========================
   27) CLEANUP
========================= */

window.addEventListener(
  "beforeunload",
  () => {
    clearTimeout(
      presenterRandomAuctionInputTimer
    )

    stopPresenterRandomTimerWatcher()
  }
)

/* =========================
   28) WINDOW EXPORTS
========================= */

window.renderPresenterRandomChallenge =
  renderPresenterRandomChallenge

window.refreshPresenterRandomChallengeFromState =
  refreshPresenterRandomChallengeFromState

window.renderPresenterReaderRandomChallenge =
  renderPresenterReaderRandomChallenge

window.openPresenterRandomBox =
  openPresenterRandomBox

window.presenterRandomBackStep =
  presenterRandomBackStep

window.startPresenterRandomBox1 =
  startPresenterRandomBox1

window.runPresenterRandomAction =
  runPresenterRandomAction

window.setPresenterRandomAuctionPoints =
  setPresenterRandomAuctionPoints

window.decreasePresenterRandomAuctionPoints =
  decreasePresenterRandomAuctionPoints

window.sendPresenterRandomAuctionScore =
  sendPresenterRandomAuctionScore

window.finishPresenterRandomBox3Round =
  finishPresenterRandomBox3Round

window.scorePresenterRandomBox3Points =
  scorePresenterRandomBox3Points

window.answerPresenterRandomBox4 =
  answerPresenterRandomBox4

window.nextPresenterRandomBox4Question =
  nextPresenterRandomBox4Question

window.openPresenterRandomBox5Number =
  openPresenterRandomBox5Number

window.revealPresenterRandomBox5Answer =
  revealPresenterRandomBox5Answer

window.completePresenterRandomBox5Number =
  completePresenterRandomBox5Number

window.cancelPresenterRandomBox5Number =
  cancelPresenterRandomBox5Number

window.presenterRandomBox5MediaAction =
  presenterRandomBox5MediaAction
  
  window.startPresenterRandomBox5BlockTimer =
  function () {
    return runPresenterRandomAction(
      "randomBox5BlockTimer"
    )
  }