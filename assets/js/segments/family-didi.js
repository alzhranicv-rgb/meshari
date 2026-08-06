/* =========================================================
   FAMILY DIDI / فاملي ديدي
   DISPLAY + FAST TWO-WAY SYNC
========================================================= */

/* =========================
   1) CONSTANTS
========================= */

const FAMILY_DIDI_STORAGE_KEY =
  "family_didi_state_v1"

const FAMILY_DIDI_DATA_CACHE_TTL =
  5 * 60 * 1000

const FAMILY_DIDI_MIN_ROUNDS = 1
const FAMILY_DIDI_MAX_ROUNDS = 5
const FAMILY_DIDI_MAX_ANSWERS = 8

const FAMILY_DIDI_PLAY_TIMER = 20
const FAMILY_DIDI_STEAL_TIMER = 30

const FAMILY_DIDI_DEFAULT_TIMER =
  FAMILY_DIDI_PLAY_TIMER
const FAMILY_DIDI_MAX_ERRORS = 3
const FAMILY_DIDI_HISTORY_LIMIT = 50

/* =========================
   2) RUNTIME STATE
========================= */

let familyDidiMaxRounds = 3

let familyDidiDataCache = null
let familyDidiDataCacheModel = null
let familyDidiDataPromise = null

let familyDidiTimer = null
let familyDidiTimerStarted = false
let familyDidiTimerStartedAt = 0
let familyDidiTimerEndsAt = 0
let familyDidiTimerDuration = 0
let familyDidiLastTickPlayed = null

let familyDidiHistory = []
let familyDidiActionBusy = false
let familyDidiAnimatingPosition = null

let familyDidiStateSyncTimer = null
let familyDidiStateSyncRunning = false
let familyDidiStateSyncPending = false

/* =========================
   3) DEFAULT STATE
========================= */

function createDefaultFamilyDidiRound() {
  return {
    question: "",
    questionRevealed: false,

    timerSeconds:
      FAMILY_DIDI_DEFAULT_TIMER,

    totalPoints: 0,
    answersCount: 8,

    answers: {},
    opened: [],

    errors: {
      A: 0,
      B: 0
    },

    initialOpenedCount: 0,
    previewErrorsCount: 0,

    roundPoints: 0,
    awardedTeam: null,

    resultRecorded: false,
    remainingAnswersRevealed: false,
    doubleRound: false,
    completed: false
  }
}



function createDefaultFamilyDidiState(
  maxRounds = familyDidiMaxRounds
) {
  const safeMaxRounds =
    Math.min(
      Math.max(
        Number(maxRounds || 3),
        FAMILY_DIDI_MIN_ROUNDS
      ),
      FAMILY_DIDI_MAX_ROUNDS
    )

  const rounds = {}

  for (
    let round = FAMILY_DIDI_MIN_ROUNDS;
    round <= safeMaxRounds;
    round++
  ) {
    rounds[round] =
      createDefaultFamilyDidiRound()
  }

  return {
    version: 1,
    updatedAt: Date.now(),

    round: 1,

    scores: {
      A: 0,
      B: 0
    },

    activeTeam: null,
    originalTeam: null,
    stealTeam: null,

    phase: "play",

    rounds
  }
}

let familyDidiState =
  createDefaultFamilyDidiState()

/* =========================
   4) NORMALIZERS
========================= */

function normalizeFamilyDidiRoundCount(
  value,
  fallback = 3
) {
  const number =
    Number(value || fallback)

  return Math.min(
    Math.max(
      Number.isFinite(number)
        ? number
        : fallback,
      FAMILY_DIDI_MIN_ROUNDS
    ),
    FAMILY_DIDI_MAX_ROUNDS
  )
}

function normalizeFamilyDidiAnswersCount(
  value,
  fallback = 8
) {
  const number =
    Number(value || fallback)

  return Math.min(
    Math.max(
      Number.isFinite(number)
        ? number
        : fallback,
      1
    ),
    FAMILY_DIDI_MAX_ANSWERS
  )
}

function normalizeFamilyDidiTimer(
  value,
  fallback =
    FAMILY_DIDI_DEFAULT_TIMER
) {
  const number =
    Number(value || fallback)

  return Math.min(
    Math.max(
      Number.isFinite(number)
        ? number
        : fallback,
      1
    ),
    300
  )
}

function normalizeFamilyDidiTeam(
  team
) {
  const value =
    String(team || "")
      .trim()
      .toUpperCase()

  return (
    value === "A" ||
    value === "B"
  )
    ? value
    : null
}

function getOtherFamilyDidiTeam(
  team
) {
  return team === "A"
    ? "B"
    : team === "B"
      ? "A"
      : null
}

function getFamilyDidiCurrentTimerDuration() {
  return familyDidiState.phase === "steal"
    ? FAMILY_DIDI_STEAL_TIMER
    : FAMILY_DIDI_PLAY_TIMER
}

/* =========================
   5) STATE HELPERS
========================= */

function ensureFamilyDidiRoundState(
  roundNumber
) {
  const round =
    Math.min(
      Math.max(
        Number(roundNumber || 1),
        FAMILY_DIDI_MIN_ROUNDS
      ),
      familyDidiMaxRounds
    )

  if (!familyDidiState.rounds) {
    familyDidiState.rounds = {}
  }

  if (!familyDidiState.rounds[round]) {
    familyDidiState.rounds[round] =
      createDefaultFamilyDidiRound()
  }

  const current =
    familyDidiState.rounds[round]

  current.question =
    String(current.question || "")
    current.questionRevealed =
  Boolean(
    current.questionRevealed
  )

  current.timerSeconds =
  FAMILY_DIDI_DEFAULT_TIMER

current.totalPoints =
  Math.max(
    0,
    Number(
      current.totalPoints || 0
    )
  )

  current.answersCount =
    normalizeFamilyDidiAnswersCount(
      current.answersCount
    )

  if (
    !current.answers ||
    typeof current.answers !== "object"
  ) {
    current.answers = {}
  }

  if (!Array.isArray(current.opened)) {
    current.opened = []
  }

  current.opened = [
    ...new Set(
      current.opened
        .map(Number)
        .filter(position => {
          return (
            position >= 1 &&
            position <=
              current.answersCount
          )
        })
    )
  ]

  if (
    !current.errors ||
    typeof current.errors !== "object"
  ) {
    current.errors = {
      A: 0,
      B: 0
    }
  }

  current.errors.A =
    Math.min(
      Math.max(
        Number(
          current.errors.A || 0
        ),
        0
      ),
      FAMILY_DIDI_MAX_ERRORS
    )

  current.errors.B =
    Math.min(
      Math.max(
        Number(
          current.errors.B || 0
        ),
        0
      ),
      FAMILY_DIDI_MAX_ERRORS
    )

  current.initialOpenedCount =
    Math.min(
      Math.max(
        Number(
          current.initialOpenedCount || 0
        ),
        0
      ),
      2
    )

  current.previewErrorsCount =
    Math.min(
      Math.max(
        Number(
          current.previewErrorsCount || 0
        ),
        0
      ),
      FAMILY_DIDI_MAX_ERRORS
    )

  current.roundPoints =
    Math.max(
      0,
      Number(
        current.roundPoints || 0
      )
    )

  current.awardedTeam =
    normalizeFamilyDidiTeam(
      current.awardedTeam
    )

  current.resultRecorded =
    Boolean(
      current.resultRecorded ||
      current.completed
    )

  current.remainingAnswersRevealed =
    Boolean(
      current.remainingAnswersRevealed
    )
    current.doubleRound =
  Number(round) ===
  Number(familyDidiMaxRounds)

  current.completed =
    Boolean(
      current.completed
    )

  return current
}

function ensureFamilyDidiState() {
  familyDidiMaxRounds =
    normalizeFamilyDidiRoundCount(
      familyDidiMaxRounds,
      3
    )

  if (
    !familyDidiState ||
    typeof familyDidiState !== "object"
  ) {
    familyDidiState =
      createDefaultFamilyDidiState(
        familyDidiMaxRounds
      )
  }

  if (
    !familyDidiState.scores ||
    typeof familyDidiState.scores !==
      "object"
  ) {
    familyDidiState.scores = {
      A: 0,
      B: 0
    }
  }

  familyDidiState.scores.A =
    Math.max(
      0,
      Number(
        familyDidiState.scores.A || 0
      )
    )

  familyDidiState.scores.B =
    Math.max(
      0,
      Number(
        familyDidiState.scores.B || 0
      )
    )

  familyDidiState.round =
    Math.min(
      Math.max(
        Number(
          familyDidiState.round || 1
        ),
        FAMILY_DIDI_MIN_ROUNDS
      ),
      familyDidiMaxRounds
    )

  familyDidiState.activeTeam =
    normalizeFamilyDidiTeam(
      familyDidiState.activeTeam
    )

  familyDidiState.originalTeam =
    normalizeFamilyDidiTeam(
      familyDidiState.originalTeam
    )

  familyDidiState.stealTeam =
    normalizeFamilyDidiTeam(
      familyDidiState.stealTeam
    )

  if (
    familyDidiState.phase !== "steal" &&
    familyDidiState.phase !== "finished"
  ) {
    familyDidiState.phase = "play"
  }

  for (
    let round = FAMILY_DIDI_MIN_ROUNDS;
    round <= familyDidiMaxRounds;
    round++
  ) {
    ensureFamilyDidiRoundState(round)
  }

  familyDidiState.version =
    Math.max(
      1,
      Number(
        familyDidiState.version || 1
      )
    )

  familyDidiState.updatedAt =
    Math.max(
      0,
      Number(
        familyDidiState.updatedAt ||
        Date.now()
      )
    )

  syncFamilyDidiGlobals()

  return familyDidiState
}

function getCurrentFamilyDidiRound() {
  ensureFamilyDidiState()

  return ensureFamilyDidiRoundState(
    familyDidiState.round
  )
}

/* =========================
   6) GLOBAL SYNC
========================= */

function syncFamilyDidiGlobals() {
  window.familyDidiState =
    familyDidiState

  window.familyDidiMaxRounds =
    familyDidiMaxRounds

  window.familyDidiTimerSync =
    familyDidiTimerStarted
      ? {
          startedAt:
            familyDidiTimerStartedAt,

          endsAt:
            familyDidiTimerEndsAt,

          duration:
            familyDidiTimerDuration,

          running: true
        }
      : null

  window.currentSegmentScores = {
    A: Number(
      familyDidiState
        ?.scores?.A || 0
    ),

    B: Number(
      familyDidiState
        ?.scores?.B || 0
    )
  }
}

/* =========================
   7) LOCAL STORAGE
========================= */

function getFamilyDidiSavedState() {
  try {
    return JSON.parse(
      localStorage.getItem(
        FAMILY_DIDI_STORAGE_KEY
      ) || "null"
    )
  } catch (error) {
    console.log(
      "LOAD FAMILY DIDI STATE ERROR:",
      error
    )

    return null
  }
}

function buildFamilyDidiStateSnapshot() {
  ensureFamilyDidiState()

  return {
    version:
      Number(
        familyDidiState.version || 1
      ),

    updatedAt:
      Number(
        familyDidiState.updatedAt ||
        Date.now()
      ),

    familyDidiMaxRounds:
      Number(
        familyDidiMaxRounds || 3
      ),

    familyDidiState:
      JSON.parse(
        JSON.stringify(
          familyDidiState
        )
      ),

    timerSync:
      familyDidiTimerStarted
        ? {
            startedAt:
              familyDidiTimerStartedAt,

            endsAt:
              familyDidiTimerEndsAt,

            duration:
              familyDidiTimerDuration,

            running: true
          }
        : null
  }
}

function saveFamilyDidiLocalState() {
  try {
    localStorage.setItem(
      FAMILY_DIDI_STORAGE_KEY,
      JSON.stringify(
        buildFamilyDidiStateSnapshot()
      )
    )
  } catch (error) {
    console.log(
      "SAVE FAMILY DIDI LOCAL ERROR:",
      error
    )
  }
}

function markFamilyDidiStateChanged() {
  ensureFamilyDidiState()

  familyDidiState.version =
    Number(
      familyDidiState.version || 1
    ) + 1

  familyDidiState.updatedAt =
    Date.now()

  syncFamilyDidiGlobals()
  saveFamilyDidiLocalState()
}

/* =========================
   8) HISTORY
========================= */

function createFamilyDidiHistorySnapshot() {
  return {
    state:
      JSON.parse(
        JSON.stringify(
          familyDidiState
        )
      ),

    timerStarted:
      familyDidiTimerStarted,

    timerStartedAt:
      familyDidiTimerStartedAt,

    timerEndsAt:
      familyDidiTimerEndsAt,

    timerDuration:
      familyDidiTimerDuration
  }
}

function pushFamilyDidiHistory() {
  familyDidiHistory.push(
    createFamilyDidiHistorySnapshot()
  )

  if (
    familyDidiHistory.length >
    FAMILY_DIDI_HISTORY_LIMIT
  ) {
    familyDidiHistory.shift()
  }
}

/* =========================
   9) INITIALIZE GLOBALS
========================= */

ensureFamilyDidiState()

window.getFamilyDidiSavedState =
  getFamilyDidiSavedState

window.ensureFamilyDidiState =
  ensureFamilyDidiState

window.getCurrentFamilyDidiRound =
  getCurrentFamilyDidiRound

window.syncFamilyDidiGlobals =
  syncFamilyDidiGlobals

  /* =========================
   10) MODEL + DATA LOAD
========================= */

function getFamilyDidiModelId() {
  return Number(
    window.currentModel ||
    currentModel ||
    localStorage.getItem(
      "game_model"
    ) ||
    0
  )
}

function getFamilyDidiDataCacheKey(
  modelId
) {
  return [
    "supabase_cache_v1",
    "family_didi_full",
    Number(modelId || 0)
  ].join(":")
}

async function loadFamilyDidiMaxRounds() {
  const modelId =
    getFamilyDidiModelId()

  if (!modelId) {
    familyDidiMaxRounds = 3
    return familyDidiMaxRounds
  }

  try {
    let result = null

    if (
      typeof window.cachedSupabaseSelect ===
      "function"
    ) {
      result =
        await window.cachedSupabaseSelect(
          "segment_settings",
          {
            select:
              "segment,item_count",

            filters: {
              model: modelId,
              segment: "familyDidi"
            },

            ttl:
              FAMILY_DIDI_DATA_CACHE_TTL,

            staleWhileRevalidate:
              true,

            cacheKey:
              `supabase_cache_v1:family_didi_settings:${modelId}`
          }
        )
    } else {
      const response =
        await db
          .from("segment_settings")
          .select(
            "segment,item_count"
          )
          .eq("model", modelId)
          .eq(
            "segment",
            "familyDidi"
          )
          .maybeSingle()

      result = {
        data:
          response.data
            ? [response.data]
            : [],

        error:
          response.error || null
      }
    }

    const row =
      Array.isArray(result?.data)
        ? result.data[0]
        : result?.data

    familyDidiMaxRounds =
      normalizeFamilyDidiRoundCount(
        row?.item_count || 3,
        3
      )
  } catch (error) {
    console.log(
      "LOAD FAMILY DIDI MAX ROUNDS ERROR:",
      error
    )

    familyDidiMaxRounds =
      normalizeFamilyDidiRoundCount(
        localStorage.getItem(
          "family_didi_max_rounds"
        ) || 3,
        3
      )
  }

  localStorage.setItem(
    "family_didi_max_rounds",
    String(familyDidiMaxRounds)
  )

  window.familyDidiMaxRounds =
    familyDidiMaxRounds

  return familyDidiMaxRounds
}

function normalizeFamilyDidiDataRows(
  rows = []
) {
  return (
    Array.isArray(rows)
      ? rows
      : []
  )
    .map(row => {
      return {
        round:
          Number(row.round || 1),

        position:
          Number(row.position || 1),

        question:
          String(
            row.question || ""
          ).trim(),

        answer:
          String(
            row.answer || ""
          ).trim(),

        points:
          Math.max(
            0,
            Number(row.points || 0)
          ),

        answersCount:
          normalizeFamilyDidiAnswersCount(
            row.answers_count || 8
          ),

        timerSeconds:
  FAMILY_DIDI_DEFAULT_TIMER,

totalPoints:
  Math.max(
    0,
    Number(
      row.total_points || 0
    )
  )
      }
    })
    .filter(row => {
      return (
        row.round >=
          FAMILY_DIDI_MIN_ROUNDS &&
        row.round <=
          FAMILY_DIDI_MAX_ROUNDS &&
        row.position >= 1 &&
        row.position <=
          FAMILY_DIDI_MAX_ANSWERS
      )
    })
}

function applyFamilyDidiDataRows(
  rows = []
) {
  const normalizedRows =
    normalizeFamilyDidiDataRows(rows)

  for (
    let roundNumber =
      FAMILY_DIDI_MIN_ROUNDS;
    roundNumber <=
      familyDidiMaxRounds;
    roundNumber++
  ) {
    const round =
      ensureFamilyDidiRoundState(
        roundNumber
      )

    const roundRows =
      normalizedRows.filter(row => {
        return (
          row.round === roundNumber
        )
      })

    if (!roundRows.length) {
      continue
    }

    const firstRow =
      roundRows[0]

    round.question =
      firstRow.question ||
      round.question ||
      ""

    round.answersCount =
      normalizeFamilyDidiAnswersCount(
        firstRow.answersCount
      )

    round.timerSeconds =
      FAMILY_DIDI_DEFAULT_TIMER

    round.totalPoints =
      Math.max(
        0,
        Number(
          firstRow.totalPoints || 0
        )
      )

    const answerMap = {}

    roundRows.forEach(row => {
      if (
        row.position >
        round.answersCount
      ) {
        return
      }

      answerMap[row.position] = {
        position:
          row.position,

        answer:
          row.answer,

        points:
          Math.max(
            0,
            Number(
              row.points || 0
            )
          )
      }
    })

    const loadedPointsTotal =
      Object.values(
        answerMap
      ).reduce(
        (sum, item) => {
          return (
            sum +
            Math.max(
              0,
              Number(
                item?.points || 0
              )
            )
          )
        },
        0
      )

    /*
      دعم الجولات القديمة:
      إذا لم تكن total_points محفوظة،
      نحسبها من مجموع نقاط الإجابات.
    */
    if (!round.totalPoints) {
      round.totalPoints =
        loadedPointsTotal
    }

    round.answers =
      answerMap

    round.opened =
      round.opened.filter(position => {
        return Boolean(
          round.answers[position]
        )
      })

    round.roundPoints =
      round.opened.reduce(
        (total, position) => {
          return (
            total +
            Number(
              round.answers[position]
                ?.points || 0
            )
          )
        },
        0
      )
  }

  ensureFamilyDidiState()
  syncFamilyDidiGlobals()

  return normalizedRows
}

async function loadFamilyDidiData(
  options = {}
) {
  const modelId =
    getFamilyDidiModelId()

  if (!modelId) {
    return []
  }

  if (
    familyDidiDataCache &&
    familyDidiDataCacheModel ===
      modelId &&
    options.forceRefresh !== true
  ) {
    applyFamilyDidiDataRows(
      familyDidiDataCache
    )

    return familyDidiDataCache
  }

  if (
    familyDidiDataPromise &&
    options.forceRefresh !== true
  ) {
    return familyDidiDataPromise
  }

  familyDidiDataPromise =
    (async () => {
      try {
        let rows = []

        if (
          typeof window
            .cachedSupabaseSelect ===
          "function"
        ) {
          const result =
            await window
              .cachedSupabaseSelect(
                "family_didi_questions",
                {
                 select: [
  "round",
  "position",
  "question",
  "answer",
  "points",
  "answers_count",
  "timer_seconds",
  "total_points"
].join(","),

                  filters: {
                    model: modelId
                  },

                  order: [
                    {
                      column: "round",
                      ascending: true
                    },
                    {
                      column: "position",
                      ascending: true
                    }
                  ],

                  ttl:
                    FAMILY_DIDI_DATA_CACHE_TTL,

                  forceRefresh:
                    options.forceRefresh ===
                    true,

                  staleWhileRevalidate:
                    options
                      .staleWhileRevalidate !==
                    false,

                  cacheKey:
                    getFamilyDidiDataCacheKey(
                      modelId
                    ),

                  onBackgroundUpdate:
                    freshRows => {
                      familyDidiDataCache =
                        normalizeFamilyDidiDataRows(
                          freshRows
                        )

                      familyDidiDataCacheModel =
                        modelId

                      applyFamilyDidiDataRows(
                        familyDidiDataCache
                      )

                      if (
                        document.querySelector(
                          ".familyDidiWrap"
                        )
                      ) {
                        renderFamilyDidiUI()
                      }
                    }
                }
              )

          rows =
            result?.data || []

          if (
            result?.error &&
            !rows.length
          ) {
            console.log(
              "FAMILY DIDI DATA ERROR:",
              result.error
            )
          }
        } else {
          const {
            data,
            error
          } =
            await db
              .from(
                "family_didi_questions"
              )
              .select(
  [
    "round",
    "position",
    "question",
    "answer",
    "points",
    "answers_count",
    "timer_seconds",
    "total_points"
  ].join(",")
)
              .eq(
                "model",
                modelId
              )
              .order(
                "round",
                {
                  ascending: true
                }
              )
              .order(
                "position",
                {
                  ascending: true
                }
              )

          if (error) {
            throw error
          }

          rows = data || []
        }

        familyDidiDataCache =
          normalizeFamilyDidiDataRows(
            rows
          )

        familyDidiDataCacheModel =
          modelId

        applyFamilyDidiDataRows(
          familyDidiDataCache
        )

        return familyDidiDataCache
      } catch (error) {
        console.log(
          "LOAD FAMILY DIDI DATA ERROR:",
          error
        )

        return (
          familyDidiDataCache || []
        )
      } finally {
        familyDidiDataPromise = null
      }
    })()

  return familyDidiDataPromise
}

/* =========================
   11) ROUND DATA HELPERS
========================= */

function getFamilyDidiRoundData(
  roundNumber =
    familyDidiState.round
) {
  ensureFamilyDidiState()

  return ensureFamilyDidiRoundState(
    roundNumber
  )
}

function getFamilyDidiAnswerData(
  position,
  roundNumber =
    familyDidiState.round
) {
  const round =
    getFamilyDidiRoundData(
      roundNumber
    )

  return (
    round.answers?.[
      Number(position || 0)
    ] ||
    null
  )
}

function getFamilyDidiOpenedPoints(
  roundNumber =
    familyDidiState.round
) {
  const round =
    getFamilyDidiRoundData(
      roundNumber
    )

  return round.opened.reduce(
    (total, position) => {
      return (
        total +
        Number(
          round.answers?.[position]
            ?.points || 0
        )
      )
    },
    0
  )
}

function isFamilyDidiRoundFullyOpened(
  roundNumber =
    familyDidiState.round
) {
  const round =
    getFamilyDidiRoundData(
      roundNumber
    )

  const positions =
    getFamilyDidiRoundPositions(
      round
    )

  return positions.every(position => {
    return round.opened.includes(
      position
    )
  })
}

window.loadFamilyDidiMaxRounds =
  loadFamilyDidiMaxRounds

window.loadFamilyDidiData =
  loadFamilyDidiData

window.getFamilyDidiRoundData =
  getFamilyDidiRoundData

window.getFamilyDidiAnswerData =
  getFamilyDidiAnswerData

window.getFamilyDidiOpenedPoints =
  getFamilyDidiOpenedPoints

  /* =========================
   12) DISPLAY HELPERS
========================= */

function escapeFamilyDidiHtml(
  value
) {
  if (
    typeof escapeDisplayHtml ===
    "function"
  ) {
    return escapeDisplayHtml(
      value
    )
  }

  return String(
    value ?? ""
  )
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function getFamilyDidiTeamName(
  team
) {
  if (team === "A") {
    return (
      window.teamAName ||
      teamAName ||
      "الفريق الأول"
    )
  }

  return (
    window.teamBName ||
    teamBName ||
    "الفريق الثاني"
  )
}

function getFamilyDidiAnswerTextClass(
  answer
) {
  const length =
    String(answer || "")
      .trim()
      .length

  if (length > 30) {
    return "familyDidiAnswerLong"
  }

  if (length > 18) {
    return "familyDidiAnswerMedium"
  }

  return "familyDidiAnswerNormal"
}

function getFamilyDidiRoundPositions(
  round =
    getCurrentFamilyDidiRound()
) {
  const answerPositions =
    Object.keys(
      round.answers || {}
    )
      .map(Number)
      .filter(position => {
        return (
          Number.isFinite(position) &&
          position >= 1 &&
          position <=
            FAMILY_DIDI_MAX_ANSWERS &&
          String(
            round.answers?.[position]
              ?.answer || ""
          ).trim()
        )
      })
      .sort((a, b) => a - b)

  if (answerPositions.length) {
    return answerPositions
  }

  return Array.from(
    {
      length:
        normalizeFamilyDidiAnswersCount(
          round.answersCount
        )
    },
    (_, index) => index + 1
  )
}

function getFamilyDidiRightPositions(
  round =
    getCurrentFamilyDidiRound()
) {
  return getFamilyDidiRoundPositions(
    round
  ).filter(position => {
    return position <= 4
  })
}

function getFamilyDidiLeftPositions(
  round =
    getCurrentFamilyDidiRound()
) {
  return getFamilyDidiRoundPositions(
    round
  ).filter(position => {
    return position >= 5
  })
}

/* =========================
   13) ERRORS
========================= */

function renderFamilyDidiErrors(
  team
) {
  const round =
    getCurrentFamilyDidiRound()

  const count =
    Math.min(
      Math.max(
        Number(
          round.errors?.[team] || 0
        ),
        0
      ),
      FAMILY_DIDI_MAX_ERRORS
    )

  return Array.from(
    {
      length:
        FAMILY_DIDI_MAX_ERRORS
    },

    (_, index) => {
      return `
        <span
          class="
            familyDidiErrorDot
            ${
              index < count
                ? "isActive"
                : ""
            }
          "
        ></span>
      `
    }
  ).join("")
}

/* =========================
   14) ANSWER CARD
========================= */

function renderFamilyDidiAnswerCard(
  position
) {
  const round =
    getCurrentFamilyDidiRound()

  const item =
    round.answers?.[position] || {
      answer: "",
      points: 0
    }

  const isOpened =
    round.opened.includes(
      position
    )

  const isAnimating =
    familyDidiAnimatingPosition ===
    position

  const answer =
    String(
      item.answer || ""
    ).trim()

  const points =
    Math.max(
      0,
      Number(item.points || 0)
    )

  return `
    <button
      type="button"
      class="
        familyDidiAnswerCard
        ${
          isOpened
            ? "isOpened"
            : ""
        }
        ${
          isAnimating
            ? "isAnimating"
            : ""
        }
      "
      data-position="${position}"
      onclick="
        openFamilyDidiAnswer(
          ${position}
        )
      "
      ${
        isOpened ||
        isAnimating ||
        round.completed
          ? "disabled"
          : ""
      }
    >

      <span
        class="familyDidiAnswerNumber"
      >
        ${position}
      </span>

      <span
        class="familyDidiAnswerContent"
      >

        <span
          class="
            familyDidiAnswerText
            ${getFamilyDidiAnswerTextClass(
              answer
            )}
          "
        >
          ${
            isOpened
              ? escapeFamilyDidiHtml(
                  answer
                )
              : ""
          }
        </span>

        <span
          class="familyDidiAnswerScore"
        >
          ${
            isOpened
              ? points
              : ""
          }
        </span>

      </span>

    </button>
  `
}

/* =========================
   15) FULL HTML
========================= */

function buildFamilyDidiHTML() {
  ensureFamilyDidiState()

  const roundNumber =
    Number(
      familyDidiState.round || 1
    )

  const round =
    getCurrentFamilyDidiRound()

  const rightPositions =
    getFamilyDidiRightPositions(
      round
    )

  const leftPositions =
    getFamilyDidiLeftPositions(
      round
    )

  const timerValue =
  familyDidiTimerStarted
    ? getFamilyDidiTimerRemaining()
    : FAMILY_DIDI_PLAY_TIMER

  return `
    <div
      class="familyDidiWrap"
      data-segment-key="familyDidi"
    >

      <header class="familyDidiHeader">

        <button
          type="button"
          class="familyDidiDockBtn"
          onclick="goHome()"
        >
          رجوع
        </button>

        <div
          id="familyDidiTeamA"
          class="
            familyDidiTeamMini
            teamA
            ${
              familyDidiState
                .activeTeam === "A"
                ? "familyDidiTeamCurrent"
                : ""
            }
          "
          onclick="
            selectFamilyDidiTeam('A')
          "
        >

          <div
            class="familyDidiTeamName"
          >
            <strong>
              ${escapeFamilyDidiHtml(
                getFamilyDidiTeamName(
                  "A"
                )
              )}
            </strong>
          </div>

          <div
            id="familyDidiErrorsA"
            class="familyDidiErrors"
          >
            ${renderFamilyDidiErrors(
              "A"
            )}
          </div>

          <b id="familyDidiScoreA">
            ${Number(
              familyDidiState
                .scores?.A || 0
            )}
          </b>

        </div>

        <div class="familyDidiTitle">

          <h1>
            فاملي ديدي
          </h1>

          <span
            id="familyDidiRoundLabel"
          >
            الجولة ${roundNumber}
          </span>

        </div>

        <div
          id="familyDidiTeamB"
          class="
            familyDidiTeamMini
            teamB
            ${
              familyDidiState
                .activeTeam === "B"
                ? "familyDidiTeamCurrent"
                : ""
            }
          "
          onclick="
            selectFamilyDidiTeam('B')
          "
        >

          <b id="familyDidiScoreB">
            ${Number(
              familyDidiState
                .scores?.B || 0
            )}
          </b>

          <div
            id="familyDidiErrorsB"
            class="familyDidiErrors"
          >
            ${renderFamilyDidiErrors(
              "B"
            )}
          </div>

          <div
            class="familyDidiTeamName"
          >
            <strong>
              ${escapeFamilyDidiHtml(
                getFamilyDidiTeamName(
                  "B"
                )
              )}
            </strong>
          </div>

        </div>

        <button
  type="button"
  id="endRoundBtn"
  class="familyDidiDockBtn"
  onclick="endCurrentSegment()"
  disabled
>
  إنهاء
</button>

      </header>

      <section
        class="familyDidiQuestionCard"
      >

        <div
          class="familyDidiQuestionSide"
        >

          <span
            class="familyDidiQuestionLabel"
          >
            السؤال
          </span>

          <button
  type="button"
  id="familyDidiQuestionBox"
  class="
    familyDidiQuestionText
    ${
      round.questionRevealed
        ? "isRevealed"
        : "isHidden"
    }
  "
  onclick="
    revealFamilyDidiQuestion()
  "
  ${
    round.questionRevealed
      ? "disabled"
      : ""
  }
>
  ${
    round.questionRevealed
      ? escapeFamilyDidiHtml(
          round.question ||
          "السؤال يظهر هنا"
        )
      : "إظهار السؤال"
  }
</button>

        </div>

        <button
          type="button"
          class="
            familyDidiTimerPill
            ${
              familyDidiTimerStarted
                ? "isRunning"
                : ""
            }
          "
          onclick="
            startFamilyDidiTimerButton()
          "
        >
          <strong
            id="familyDidiTimer"
          >
            ${Math.max(
              0,
              Number(timerValue || 0)
            )}
          </strong>
        </button>

      </section>

      <section
        class="familyDidiAnswersBoard"
      >

        <div
          class="
            familyDidiAnswersSide
            familyDidiRightSide
          "
        >
          ${rightPositions
            .map(position => {
              return renderFamilyDidiAnswerCard(
                position
              )
            })
            .join("")}
        </div>

        <div
          class="
            familyDidiAnswersSide
            familyDidiLeftSide
            ${
              leftPositions.length
                ? ""
                : "isEmpty"
            }
          "
        >
          ${leftPositions
            .map(position => {
              return renderFamilyDidiAnswerCard(
                position
              )
            })
            .join("")}
        </div>

      </section>

      <footer
  id="familyDidiActionBar"
  class="familyDidiActionBar"
>

        <button
          type="button"
          id="familyDidiWrongBtn"
          class="
            familyDidiActionBtn
            familyDidiWrongBtn
          "
          onclick="addFamilyDidiError()"
        >
          خطأ
        </button>

        <button
          type="button"
          id="familyDidiAwardBtn"
          class="
            familyDidiActionBtn
            familyDidiAwardBtn
          "
          onclick="
            awardFamilyDidiRound()
          "
        >
          اعتماد الجولة
        </button>

        <button
          type="button"
          id="familyDidiUndoBtn"
          class="
            familyDidiActionBtn
            familyDidiUndoBtn
          "
          onclick="undoFamilyDidiAction()"
          ${
            familyDidiHistory.length
              ? ""
              : "disabled"
          }
        >
          تراجع
        </button>

        <button
          type="button"
          id="familyDidiSwitchBtn"
          class="
            familyDidiActionBtn
            familyDidiSwitchBtn
          "
          onclick="
            switchFamilyDidiTurn()
          "
        >
          تبديل الدور
        </button>

        <button
  type="button"
  id="familyDidiShowAnswersBtn"
  class="
    familyDidiActionBtn
    familyDidiShowAnswersBtn
  "
  onclick="
    showRemainingFamilyDidiAnswers()
  "
>
  إظهار الإجابات
</button>

        <button
          type="button"
          id="familyDidiNextBtn"
          class="
            familyDidiActionBtn
            familyDidiNextBtn
          "
          onclick="nextFamilyDidiRound()"
        >
          الجولة التالية
        </button>

      </footer>

    </div>
  `
}

/* =========================
   16) UI RENDER
========================= */

function renderFamilyDidiAnswersOnly() {
  const round =
    getCurrentFamilyDidiRound()

  const rightSide =
    document.querySelector(
      ".familyDidiRightSide"
    )

  const leftSide =
    document.querySelector(
      ".familyDidiLeftSide"
    )

  const rightPositions =
    getFamilyDidiRightPositions(
      round
    )

  const leftPositions =
    getFamilyDidiLeftPositions(
      round
    )

  if (rightSide) {
    rightSide.innerHTML =
      rightPositions
        .map(position => {
          return renderFamilyDidiAnswerCard(
            position
          )
        })
        .join("")
  }

  if (leftSide) {
    leftSide.classList.toggle(
      "isEmpty",
      leftPositions.length === 0
    )

    leftSide.innerHTML =
      leftPositions
        .map(position => {
          return renderFamilyDidiAnswerCard(
            position
          )
        })
        .join("")
  }
}

function updateFamilyDidiScores() {
  const scoreA =
    document.getElementById(
      "familyDidiScoreA"
    )

  const scoreB =
    document.getElementById(
      "familyDidiScoreB"
    )

  if (scoreA) {
    scoreA.innerText =
      Number(
        familyDidiState
          .scores?.A || 0
      )
  }

  if (scoreB) {
    scoreB.innerText =
      Number(
        familyDidiState
          .scores?.B || 0
      )
  }

  syncFamilyDidiGlobals()
}

function highlightFamilyDidiTeam() {
  const teamA =
    document.getElementById(
      "familyDidiTeamA"
    )

  const teamB =
    document.getElementById(
      "familyDidiTeamB"
    )

  teamA?.classList.toggle(
    "familyDidiTeamCurrent",
    familyDidiState.activeTeam === "A"
  )

  teamB?.classList.toggle(
    "familyDidiTeamCurrent",
    familyDidiState.activeTeam === "B"
  )
}

function updateFamilyDidiErrors() {
  const errorsA =
    document.getElementById(
      "familyDidiErrorsA"
    )

  const errorsB =
    document.getElementById(
      "familyDidiErrorsB"
    )

  if (errorsA) {
    errorsA.innerHTML =
      renderFamilyDidiErrors("A")
  }

  if (errorsB) {
    errorsB.innerHTML =
      renderFamilyDidiErrors("B")
  }
}

function updateFamilyDidiButtons() {
  const round =
    getCurrentFamilyDidiRound()

  const wrongButton =
    document.getElementById(
      "familyDidiWrongBtn"
    )

  const awardButton =
    document.getElementById(
      "familyDidiAwardBtn"
    )

  const switchButton =
    document.getElementById(
      "familyDidiSwitchBtn"
    )

  const showAnswersButton =
    document.getElementById(
      "familyDidiShowAnswersBtn"
    )

  const nextButton =
    document.getElementById(
      "familyDidiNextBtn"
    )

  const undoButton =
    document.getElementById(
      "familyDidiUndoBtn"
    )

  const resultRecorded =
    Boolean(
      round.resultRecorded ||
      round.completed
    )

  const allAnswersOpened =
    isFamilyDidiRoundFullyOpened()

  const answersRevealed =
    Boolean(
      round.remainingAnswersRevealed ||
      allAnswersOpened
    )

if (wrongButton) {
  wrongButton.disabled =
    resultRecorded ||
    familyDidiActionBusy
}

  if (awardButton) {
    awardButton.disabled =
      !familyDidiState.activeTeam ||
      !round.opened.length ||
      resultRecorded ||
      familyDidiActionBusy
  }

  if (switchButton) {
    switchButton.disabled =
      resultRecorded ||
      familyDidiActionBusy
  }

if (showAnswersButton) {
  showAnswersButton.hidden = false

  showAnswersButton.disabled =
    !resultRecorded ||
    answersRevealed ||
    familyDidiActionBusy

  showAnswersButton.innerText =
    answersRevealed
      ? "تم إظهار الإجابات"
      : "إظهار الإجابات"
}

  if (nextButton) {
    nextButton.disabled =
      !resultRecorded ||
      !answersRevealed ||
      familyDidiState.round >=
        familyDidiMaxRounds ||
      familyDidiActionBusy
  }

  if (undoButton) {
    undoButton.disabled =
      !familyDidiHistory.length ||
      familyDidiActionBusy
  }
}



function renderFamilyDidiUI() {
  if (
    !document.querySelector(
      ".familyDidiWrap"
    )
  ) {
    return
  }

  const round =
    getCurrentFamilyDidiRound()

  const questionBox =
    document.getElementById(
      "familyDidiQuestionBox"
    )

  const roundLabel =
    document.getElementById(
      "familyDidiRoundLabel"
    )

  if (questionBox) {
    questionBox.innerText =
      round.questionRevealed
        ? (
            round.question ||
            "السؤال يظهر هنا"
          )
        : "إظهار السؤال"

    questionBox.disabled =
      round.questionRevealed

    questionBox.classList.toggle(
      "isRevealed",
      round.questionRevealed
    )

    questionBox.classList.toggle(
      "isHidden",
      !round.questionRevealed
    )
  }

  if (roundLabel) {
    roundLabel.innerText =
      `الجولة ${familyDidiState.round}`
  }

  updateFamilyDidiScores()
  highlightFamilyDidiTeam()
  updateFamilyDidiErrors()
  renderFamilyDidiAnswersOnly()
  updateFamilyDidiButtons()

  if (
    typeof updateEndRoundButtonState ===
    "function"
  ) {
    updateEndRoundButtonState()
  }

  if (
    typeof applyPresenterHideDisplayControlsState ===
    "function"
  ) {
    applyPresenterHideDisplayControlsState()
  }
}

/* =========================
   17) OPEN SEGMENT
========================= */

window.renderFamilyDidi =
  async function () {
    clearInterval(
      familyDidiTimer
    )

    familyDidiTimer = null

    familyDidiHistory = []
    familyDidiActionBusy = false
    familyDidiAnimatingPosition = null

    await loadFamilyDidiMaxRounds()

    const saved =
      getFamilyDidiSavedState()

    familyDidiState =
      createDefaultFamilyDidiState(
        familyDidiMaxRounds
      )

    ensureFamilyDidiState()

    await loadFamilyDidiData({
      staleWhileRevalidate: true
    })

    if (
      saved?.familyDidiState
    ) {
      familyDidiState = {
        ...createDefaultFamilyDidiState(
          familyDidiMaxRounds
        ),

        ...saved.familyDidiState
      }

      familyDidiMaxRounds =
        normalizeFamilyDidiRoundCount(
          saved.familyDidiMaxRounds ||
          familyDidiMaxRounds
        )

      ensureFamilyDidiState()

      await loadFamilyDidiData({
        staleWhileRevalidate: true
      })
    }

    openSegment(
      `فاملي ديدي - الجولة ${familyDidiState.round}`,
      buildFamilyDidiHTML()
    )

    renderFamilyDidiUI()
    saveFamilyDidiLocalState()
    
  }

window.openFamilyDidiSegment =
  window.renderFamilyDidi

window.buildFamilyDidiHTML =
  buildFamilyDidiHTML

window.renderFamilyDidiUI =
  renderFamilyDidiUI

window.renderFamilyDidiAnswersOnly =
  renderFamilyDidiAnswersOnly


  function revealFamilyDidiQuestion(
  options = {}
) {
  ensureFamilyDidiState()

  const round =
    getCurrentFamilyDidiRound()

  if (
    round.questionRevealed ||
    familyDidiActionBusy
  ) {
    return false
  }

  if (
    options.history !== false
  ) {
    pushFamilyDidiHistory()
  }

  round.questionRevealed = true

  markFamilyDidiStateChanged()
  renderFamilyDidiUI()

  const questionBox =
    document.getElementById(
      "familyDidiQuestionBox"
    )

  if (questionBox) {
    questionBox.animate(
      [
        {
          opacity: 0,
          transform: "scale(.97)"
        },
        {
          opacity: 1,
          transform: "scale(1)"
        }
      ],
      {
        duration: 320,
        easing: "ease-out"
      }
    )
  }

  if (
    typeof playGameSound ===
    "function"
  ) {
    playGameSound("answer")
  }

  if (
    options.sync !== false
  ) {
    scheduleFamilyDidiStateSync(
      true
    )
  }

  return true
}

  /* =========================
   18) TEAM SELECTION
========================= */

function selectFamilyDidiTeam(
  team,
  options = {}
) {
  const safeTeam =
    normalizeFamilyDidiTeam(
      team
    )

  if (!safeTeam) {
    return false
  }

  const round =
    getCurrentFamilyDidiRound()

  if (
    round.completed ||
    familyDidiActionBusy
  ) {
    return false
  }

  if (options.history !== false) {
    pushFamilyDidiHistory()
  }

  familyDidiState.activeTeam =
    safeTeam

  if (
    !familyDidiState.originalTeam
  ) {
    familyDidiState.originalTeam =
      safeTeam
  }

  if (
    familyDidiState.phase === "steal"
  ) {
    familyDidiState.stealTeam =
      safeTeam
  }

  markFamilyDidiStateChanged()
  renderFamilyDidiUI()
  markFamilyDidiStateChanged()
  renderFamilyDidiUI()


  if (options.sync !== false) {
    scheduleFamilyDidiStateSync(true)
  }

  return true
}

function switchFamilyDidiTurn() {
  const round =
    getCurrentFamilyDidiRound()

  if (
    round.completed ||
    familyDidiActionBusy
  ) {
    return false
  }

  const currentTeam =
    familyDidiState.activeTeam

  const nextTeam =
    currentTeam
      ? getOtherFamilyDidiTeam(
          currentTeam
        )
      : "A"

  return selectFamilyDidiTeam(
    nextTeam
  )
}

/* =========================
   19) OPEN ANSWER
========================= */

async function openFamilyDidiAnswer(
  position,
  options = {}
) {
  ensureFamilyDidiState()

  const round =
    getCurrentFamilyDidiRound()

  const safePosition =
    Number(position || 0)

  const availablePositions =
    getFamilyDidiRoundPositions(
      round
    )

  if (
    !availablePositions.includes(
      safePosition
    ) ||
    round.completed ||
    familyDidiActionBusy ||
    familyDidiAnimatingPosition !==
      null
  ) {
    return false
  }

  if (
    round.opened.includes(
      safePosition
    )
  ) {
    return false
  }

  const item =
    round.answers?.[
      safePosition
    ]

  if (
    !item ||
    !String(
      item.answer || ""
    ).trim()
  ) {
    if (
      typeof showGameToast ===
      "function"
    ) {
      showGameToast(
        "لا توجد إجابة لهذا الرقم"
      )
    }

    return false
  }

  const activeTeam =
    normalizeFamilyDidiTeam(
      familyDidiState.activeTeam
    )

  const openingWithoutTeam =
    !activeTeam

  if (
    openingWithoutTeam &&
    Number(
      round.initialOpenedCount || 0
    ) >= 2
  ) {
    if (
      typeof showGameToast ===
      "function"
    ) {
      showGameToast(
        "اختر الفريق لإكمال الجولة"
      )
    }

    return false
  }

  pushFamilyDidiHistory()

  familyDidiActionBusy = true

  familyDidiAnimatingPosition =
    safePosition

  renderFamilyDidiUI()

  await new Promise(resolve => {
    setTimeout(resolve, 180)
  })

  round.opened.push(
    safePosition
  )

  round.opened = [
    ...new Set(
      round.opened.map(Number)
    )
  ]

  if (openingWithoutTeam) {
    round.initialOpenedCount =
      Math.min(
        Number(
          round.initialOpenedCount || 0
        ) + 1,
        2
      )
  }

  round.roundPoints =
  getFamilyDidiOpenedPoints()

const openedCount =
  round.opened.length

const totalAnswersCount =
  availablePositions.length

const allAnswersOpened =
  totalAnswersCount > 0 &&
  openedCount >= totalAnswersCount

familyDidiAnimatingPosition =
  null

familyDidiActionBusy = false

if (allAnswersOpened) {
  stopFamilyDidiTimer(
    0,
    {
      save: false
    }
  )
} else {
  restartFamilyDidiTimer()
}

  markFamilyDidiStateChanged()
  renderFamilyDidiUI()

  if (
    typeof playGameSound ===
    "function"
  ) {
    playGameSound("correct")
  }

  if (
    openingWithoutTeam &&
    round.initialOpenedCount >= 2 &&
    typeof showGameToast ===
      "function"
  ) {
    showGameToast(
      "اختر الفريق لإكمال الجولة"
    )
  }

  if (
    options.sync !== false
  ) {
    scheduleFamilyDidiStateSync(
      true
    )
  }

  return true
}
/* =========================
   20) ERRORS + STEAL
========================= */

function showFamilyDidiStealIntro(
  team
) {
  return new Promise(resolve => {
    document
      .getElementById(
        "familyDidiStealIntro"
      )
      ?.remove()

    const overlay =
      document.createElement("div")

    overlay.id =
      "familyDidiStealIntro"

    overlay.className =
      "familyDidiStealIntro"

    overlay.innerHTML = `
  <div
    class="familyDidiStealIntroCard"
  >
    <span>
      فرصة السرقة
    </span>

    <strong>
      ${escapeFamilyDidiHtml(
        getFamilyDidiTeamName(team)
      )}
    </strong>

    <b>
      يا لنا... يا لهم!
    </b>
  </div>
`

    document.body.appendChild(
      overlay
    )

    requestAnimationFrame(() => {
      overlay.classList.add(
        "isVisible"
      )
    })

    const finish = () => {
      overlay.classList.remove(
        "isVisible"
      )

      setTimeout(() => {
        overlay.remove()
        resolve()
      }, 280)
    }

    setTimeout(
      finish,
      5000
    )
  })
}

async function addFamilyDidiError(
  options = {}
) {
  ensureFamilyDidiState()

  const round =
    getCurrentFamilyDidiRound()

  if (
    round.completed ||
    round.resultRecorded ||
    familyDidiActionBusy
  ) {
    return false
  }

  const activeTeam =
    normalizeFamilyDidiTeam(
      familyDidiState.activeTeam
    )

  /*
    قبل اختيار الفريق:
    نعرض تأثير الخطأ فقط،
    ثم نعيد مؤقت اللعب إلى 20 ثانية.
  */
  if (!activeTeam) {
    const previewErrorsCount =
      Math.min(
        Math.max(
          Number(
            round.previewErrorsCount || 0
          ) + 1,
          1
        ),
        FAMILY_DIDI_MAX_ERRORS
      )

    round.previewErrorsCount =
      previewErrorsCount

    markFamilyDidiStateChanged()
    renderFamilyDidiUI()

    if (
      typeof playGameSound ===
      "function"
    ) {
      playGameSound("wrong")
    }

    if (
      typeof flashScreen ===
      "function"
    ) {
      flashScreen("wrong")
    }

    if (
      typeof showScreenWrongCountFx ===
      "function"
    ) {
      showScreenWrongCountFx(
        previewErrorsCount
      )
    }

    restartFamilyDidiTimer(
      FAMILY_DIDI_PLAY_TIMER
    )

    if (
      options.sync !== false
    ) {
      scheduleFamilyDidiStateSync(
        true
      )
    }

    return true
  }

  pushFamilyDidiHistory()

  round.errors[activeTeam] =
    Math.min(
      Number(
        round.errors[
          activeTeam
        ] || 0
      ) + 1,
      FAMILY_DIDI_MAX_ERRORS
    )

  const currentErrorsCount =
    Number(
      round.errors[
        activeTeam
      ] || 0
    )

  if (
    typeof playGameSound ===
    "function"
  ) {
    playGameSound("wrong")
  }

  if (
    typeof flashScreen ===
    "function"
  ) {
    flashScreen("wrong")
  }

  if (
    typeof showScreenWrongCountFx ===
    "function"
  ) {
    showScreenWrongCountFx(
      currentErrorsCount
    )
  }

  /*
    خطأ فريق السرقة:
    تنتهي محاولة السرقة وتذهب
    النقاط للفريق الأصلي.
  */
  if (
    familyDidiState.phase ===
      "steal"
  ) {
    stopFamilyDidiTimer(
      0,
      {
        save: false
      }
    )

    const originalTeam =
      normalizeFamilyDidiTeam(
        familyDidiState.originalTeam
      )

    if (!originalTeam) {
      return false
    }

    const resultRecorded =
      awardFamilyDidiRound(
        originalTeam,
        {
          history: false,
          sync: false
        }
      )

    if (
      typeof showGameToast ===
      "function"
    ) {
      showGameToast(
        resultRecorded
          ? `فشلت السرقة وتم اعتماد النقاط لـ ${getFamilyDidiTeamName(
              originalTeam
            )}`
          : "فشلت السرقة"
      )
    }

    if (
      options.sync !== false
    ) {
      scheduleFamilyDidiStateSync(
        true
      )
    }

    return resultRecorded
  }

  /*
    الخطأ الثالث:
    إيقاف مؤقت اللعب، ثم عرض
    إشعار السرقة لمدة 5 ثوانٍ.
  */
  if (
    round.errors[activeTeam] >=
      FAMILY_DIDI_MAX_ERRORS
  ) {
    const otherTeam =
      getOtherFamilyDidiTeam(
        activeTeam
      )

    familyDidiState.phase =
      "steal"

    familyDidiState.originalTeam =
      familyDidiState
        .originalTeam ||
      activeTeam

    familyDidiState.stealTeam =
      otherTeam

    familyDidiState.activeTeam =
      otherTeam

    round.errors[otherTeam] = 0

    stopFamilyDidiTimer(
      0,
      {
        save: false
      }
    )

    familyDidiActionBusy = true

    markFamilyDidiStateChanged()
    renderFamilyDidiUI()

    if (
      options.sync !== false
    ) {
      scheduleFamilyDidiStateSync(
        true
      )
    }

    await showFamilyDidiStealIntro(
      otherTeam
    )

    familyDidiActionBusy = false

    renderFamilyDidiUI()

    restartFamilyDidiTimer(
      FAMILY_DIDI_STEAL_TIMER
    )

    if (
      options.sync !== false
    ) {
      scheduleFamilyDidiStateSync(
        true
      )
    }

    return true
  }

  markFamilyDidiStateChanged()
  renderFamilyDidiUI()

  restartFamilyDidiTimer(
    FAMILY_DIDI_PLAY_TIMER
  )

  if (
    options.sync !== false
  ) {
    scheduleFamilyDidiStateSync(
      true
    )
  }

  return true
}
/* =========================
   21) AWARD ROUND
========================= */

function awardFamilyDidiRound(
  forcedTeam = null,
  options = {}
) {
  ensureFamilyDidiState()

  const round =
    getCurrentFamilyDidiRound()

  if (
    round.completed ||
    round.resultRecorded ||
    familyDidiActionBusy ||
    !round.opened.length
  ) {
    return false
  }

  const winnerTeam =
    normalizeFamilyDidiTeam(
      forcedTeam
    ) ||
    normalizeFamilyDidiTeam(
      familyDidiState.activeTeam
    )

  if (!winnerTeam) {
    if (
      typeof showGameToast ===
      "function"
    ) {
      showGameToast(
        "اختر الفريق أولاً"
      )
    }

    return false
  }

  if (
    options.history !== false
  ) {
    pushFamilyDidiHistory()
  }

  const basePoints =
  getFamilyDidiOpenedPoints()

const points =
  round.doubleRound
    ? basePoints * 2
    : basePoints

  familyDidiState
    .scores[winnerTeam] =
      Number(
        familyDidiState
          .scores[winnerTeam] || 0
      ) + points

  round.roundPoints =
    points

  round.awardedTeam =
    winnerTeam

  round.resultRecorded = true
  round.completed = true

  round.remainingAnswersRevealed =
    isFamilyDidiRoundFullyOpened()

  familyDidiState.activeTeam =
    null

  familyDidiState.originalTeam =
    null  

  familyDidiState.phase =
    "finished"

  familyDidiState.stealTeam =
    null

  stopFamilyDidiTimer(
    0,
    {
      save: false
    }
  )

  markFamilyDidiStateChanged()
  renderFamilyDidiUI()

  if (
    typeof playGameSound ===
    "function"
  ) {
    playGameSound("correct")
  }

  if (
    typeof showGameToast ===
    "function"
  ) {
    showGameToast(
      `تم اعتماد ${points} نقطة لـ ${getFamilyDidiTeamName(
        winnerTeam
      )}`
    )
  }

  if (
    options.sync !== false
  ) {
    scheduleFamilyDidiStateSync(
      true
    )
  }

  return true
}

/* =========================
   SHOW REMAINING ANSWERS
========================= */

async function showRemainingFamilyDidiAnswers() {
  ensureFamilyDidiState()

  const round =
    getCurrentFamilyDidiRound()

  if (
    !round.resultRecorded ||
    !round.completed ||
    familyDidiActionBusy
  ) {
    return false
  }

  const positions =
    getFamilyDidiRoundPositions(
      round
    )

  const remainingPositions =
    positions.filter(position => {
      return !round.opened.includes(
        position
      )
    })

  if (!remainingPositions.length) {
    round.remainingAnswersRevealed =
      true

    markFamilyDidiStateChanged()
    renderFamilyDidiUI()
    scheduleFamilyDidiStateSync(true)

    return true
  }

  pushFamilyDidiHistory()

  familyDidiActionBusy = true

  updateFamilyDidiButtons()

  for (
    const position of
    remainingPositions
  ) {
    familyDidiAnimatingPosition =
      position

    renderFamilyDidiAnswersOnly()

    await new Promise(resolve => {
      setTimeout(resolve, 180)
    })

    round.opened.push(
      position
    )

    round.opened = [
      ...new Set(
        round.opened.map(Number)
      )
    ]

    familyDidiAnimatingPosition =
      null

    renderFamilyDidiAnswersOnly()

    if (
      typeof playGameSound ===
      "function"
    ) {
      playGameSound("answer")
    }

    await new Promise(resolve => {
      setTimeout(resolve, 110)
    })
  }

  round.remainingAnswersRevealed =
    true

  /*
    لا نعيد حساب roundPoints هنا.
    الإجابات الجديدة للعرض فقط ولا تسجل نقاطًا.
  */

  familyDidiActionBusy = false
  familyDidiAnimatingPosition = null

  markFamilyDidiStateChanged()
  renderFamilyDidiUI()
  scheduleFamilyDidiStateSync(true)

  return true
}

/* =========================
   22) TIMER
========================= */

function getFamilyDidiTimerRemaining(
  fallback = null
) {
  if (
    familyDidiTimerStarted &&
    familyDidiTimerEndsAt >
      Date.now()
  ) {
    return Math.max(
      0,
      Math.ceil(
        (
          familyDidiTimerEndsAt -
          Date.now()
        ) / 1000
      )
    )
  }

  if (fallback !== null) {
    return Math.max(
      0,
      Number(fallback || 0)
    )
  }

  return getFamilyDidiCurrentTimerDuration()
}

function startFamilyDidiTimerButton() {
  const round =
    getCurrentFamilyDidiRound()

  if (
    round.completed ||
    familyDidiActionBusy
  ) {
    return false
  }

  pushFamilyDidiHistory()

  return restartFamilyDidiTimer()
}

function restartFamilyDidiTimer(
  seconds = null
) {
  const duration =
    seconds === null
      ? getFamilyDidiCurrentTimerDuration()
      : Math.max(
          1,
          Number(seconds || 0)
        )

  stopFamilyDidiTimer(
    duration,
    {
      save: false
    }
  )

  return startFamilyDidiTimer(
    duration
  )
}

function startFamilyDidiTimer(
  seconds = null
) {
  const round =
    getCurrentFamilyDidiRound()

  if (
    round.completed ||
    round.resultRecorded
  ) {
    return false
  }

  const duration =
    Math.max(
      1,
      Number(
        seconds ??
        getFamilyDidiCurrentTimerDuration()
      )
    )

  clearInterval(
    familyDidiTimer
  )

  familyDidiTimer = null
  familyDidiTimerStarted = true
  familyDidiTimerDuration = duration
  familyDidiTimerStartedAt = Date.now()

  familyDidiTimerEndsAt =
    familyDidiTimerStartedAt +
    duration * 1000

  familyDidiLastTickPlayed = null

  updateFamilyDidiTimerUI(
    duration
  )

  familyDidiTimer =
    setInterval(() => {
      const remaining =
        getFamilyDidiTimerRemaining(0)

      updateFamilyDidiTimerUI(
        remaining
      )

      if (
        remaining > 0 &&
        remaining <= 5 &&
        familyDidiLastTickPlayed !==
          remaining
      ) {
        familyDidiLastTickPlayed =
          remaining

        if (
          typeof playGameSound ===
          "function"
        ) {
          playGameSound("tick")
        }
      }

      if (remaining > 0) {
        return
      }

      clearInterval(
        familyDidiTimer
      )

      familyDidiTimer = null
      familyDidiTimerStarted = false
      familyDidiTimerStartedAt = 0
      familyDidiTimerEndsAt = 0
      familyDidiTimerDuration = 0
      familyDidiLastTickPlayed = null

      updateFamilyDidiTimerUI(0)

      if (
        typeof playGameSound ===
        "function"
      ) {
        playGameSound("timeout")
      }

      /*
        انتهاء الوقت لا يسجل خطأ.
        الخطأ يُسجل يدويًا فقط.
      */
      syncFamilyDidiGlobals()
      saveFamilyDidiLocalState()
      scheduleFamilyDidiStateSync(true)
    }, 250)

  syncFamilyDidiGlobals()
  saveFamilyDidiLocalState()
  scheduleFamilyDidiStateSync()

  return true
}

function stopFamilyDidiTimer(
  resetValue = null,
  options = {}
) {
  clearInterval(
    familyDidiTimer
  )

  familyDidiTimer = null
  familyDidiTimerStarted = false
  familyDidiTimerStartedAt = 0
  familyDidiTimerEndsAt = 0
  familyDidiTimerDuration = 0
  familyDidiLastTickPlayed = null

  const value =
    resetValue === null
      ? getFamilyDidiCurrentTimerDuration()
      : Math.max(
          0,
          Number(resetValue || 0)
        )

  updateFamilyDidiTimerUI(
    value
  )

  syncFamilyDidiGlobals()

  if (options.save !== false) {
    saveFamilyDidiLocalState()
  }
}

function updateFamilyDidiTimerUI(
  forcedValue = null
) {
  const timerBox =
    document.getElementById(
      "familyDidiTimer"
    )

  if (!timerBox) {
    return
  }

  const value =
    forcedValue === null
      ? getFamilyDidiTimerRemaining()
      : Math.max(
          0,
          Number(
            forcedValue || 0
          )
        )

  timerBox.innerText =
    value

  const timerPill =
    timerBox.closest(
      ".familyDidiTimerPill"
    )

  timerPill?.classList.toggle(
    "isRunning",
    familyDidiTimerStarted
  )

  timerPill?.classList.toggle(
    "timerDanger",
    value > 0 &&
    value <= 5
  )

  timerPill?.classList.toggle(
    "timerFinished",
    value === 0
  )
}
/* =========================
   23) UNDO
========================= */

function undoFamilyDidiAction() {
  if (
    !familyDidiHistory.length ||
    familyDidiActionBusy
  ) {
    if (
      typeof showGameToast ===
      "function"
    ) {
      showGameToast(
        "لا يوجد خطوة للتراجع"
      )
    }

    return false
  }

  const snapshot =
    familyDidiHistory.pop()

  stopFamilyDidiTimer(
    0,
    {
      save: false
    }
  )

  familyDidiState =
    JSON.parse(
      JSON.stringify(
        snapshot.state
      )
    )

  ensureFamilyDidiState()

  if (
    snapshot.timerStarted &&
    snapshot.timerEndsAt >
      Date.now()
  ) {
    const remaining =
      Math.max(
        1,
        Math.ceil(
          (
            snapshot.timerEndsAt -
            Date.now()
          ) / 1000
        )
      )

    startFamilyDidiTimer(
      remaining
    )
  }

  markFamilyDidiStateChanged()
  renderFamilyDidiUI()
  scheduleFamilyDidiStateSync(true)

  return true
}

/* =========================
   DOUBLE ROUND INTRO
========================= */

function showFamilyDidiDoubleIntro() {
  return new Promise(resolve => {
    const oldOverlay =
      document.getElementById(
        "familyDidiDoubleIntro"
      )

    oldOverlay?.remove()

    const overlay =
      document.createElement("div")

    overlay.id =
      "familyDidiDoubleIntro"

    overlay.className =
      "familyDidiDoubleIntro"

    overlay.innerHTML = `
      <div
        class="familyDidiDoubleIntroCard"
      >
        <span>
          الجولة الأخيرة
        </span>

        <strong>
          النقاط دبل
          يا لنا يا لهم
        </strong>

        <b>
          ×2
        </b>
      </div>
    `

    document.body.appendChild(
      overlay
    )

    requestAnimationFrame(() => {
      overlay.classList.add(
        "isVisible"
      )
    })

    setTimeout(() => {
      overlay.classList.remove(
        "isVisible"
      )

      setTimeout(() => {
        overlay.remove()
        resolve()
      }, 280)
    }, 10000)
  })
}

/* =========================
   24) ROUND NAVIGATION
========================= */

async function nextFamilyDidiRound() {
  ensureFamilyDidiState()

  const currentRound =
    getCurrentFamilyDidiRound()

if (
  !currentRound.resultRecorded ||
  !currentRound.completed
) {
  if (
    typeof showGameToast ===
      "function"
  ) {
    showGameToast(
      "اعتمد نتيجة الجولة أولاً"
    )
  }

  return false
}

if (
  !currentRound
    .remainingAnswersRevealed &&
  !isFamilyDidiRoundFullyOpened()
) {
  if (
    typeof showGameToast ===
      "function"
  ) {
    showGameToast(
      "أظهر بقية الإجابات أولاً"
    )
  }

  return false
}

  if (
    familyDidiState.round >=
      familyDidiMaxRounds
  ) {
    if (
      typeof showGameToast ===
      "function"
    ) {
      showGameToast(
        "هذه آخر جولة"
      )
    }

    return false
  }

  pushFamilyDidiHistory()

  stopFamilyDidiTimer(
    0,
    {
      save: false
    }
  )

  familyDidiState.round += 1

  familyDidiState.activeTeam =
    null

  familyDidiState.originalTeam =
    null

  familyDidiState.stealTeam =
    null

  familyDidiState.phase =
    "play"

  ensureFamilyDidiRoundState(
    familyDidiState.round
  )

markFamilyDidiStateChanged()
scheduleFamilyDidiStateSync(true)

const openingDoubleRound =
  Number(familyDidiState.round) ===
  Number(familyDidiMaxRounds)

if (openingDoubleRound) {
  await showFamilyDidiDoubleIntro()
}

openSegment(
  `فاملي ديدي - الجولة ${familyDidiState.round}`,
  buildFamilyDidiHTML()
)

renderFamilyDidiUI()
restartFamilyDidiTimer(
  FAMILY_DIDI_PLAY_TIMER
)
scheduleFamilyDidiStateSync(true)

return true
}

async function previousFamilyDidiRound() {
  ensureFamilyDidiState()

  if (
    familyDidiState.round <=
      FAMILY_DIDI_MIN_ROUNDS
  ) {
    if (
      typeof showGameToast ===
      "function"
    ) {
      showGameToast(
        "هذه أول جولة"
      )
    }

    return false
  }

  pushFamilyDidiHistory()

  stopFamilyDidiTimer(
    0,
    {
      save: false
    }
  )

  familyDidiState.round -= 1

  familyDidiState.activeTeam =
    null

  familyDidiState.originalTeam =
    null

  familyDidiState.stealTeam =
    null

  familyDidiState.phase =
    getCurrentFamilyDidiRound()
      .completed
      ? "finished"
      : "play"

  markFamilyDidiStateChanged()

  openSegment(
    `فاملي ديدي - الجولة ${familyDidiState.round}`,
    buildFamilyDidiHTML()
  )

  return true
}
/* =========================
   25) GLOBAL EXPORTS
========================= */

window.selectFamilyDidiTeam =
  selectFamilyDidiTeam

window.switchFamilyDidiTurn =
  switchFamilyDidiTurn

window.openFamilyDidiAnswer =
  openFamilyDidiAnswer

window.addFamilyDidiError =
  addFamilyDidiError

window.awardFamilyDidiRound =
  awardFamilyDidiRound

  window.showRemainingFamilyDidiAnswers =
  showRemainingFamilyDidiAnswers

window.startFamilyDidiTimerButton =
  startFamilyDidiTimerButton

window.startFamilyDidiTimer =
  startFamilyDidiTimer

window.stopFamilyDidiTimer =
  stopFamilyDidiTimer

window.getFamilyDidiTimerRemaining =
  getFamilyDidiTimerRemaining

window.undoFamilyDidiAction =
  undoFamilyDidiAction

window.nextFamilyDidiRound =
  nextFamilyDidiRound

window.previousFamilyDidiRound =
  previousFamilyDidiRound

/* =========================
   26) PROJECT STATE SYNC
========================= */

function saveFamilyDidiState(
  options = {}
) {
  ensureFamilyDidiState()

  saveFamilyDidiLocalState()

  localStorage.setItem(
    "family_didi_max_rounds",
    String(familyDidiMaxRounds)
  )

  localStorage.setItem(
    "active_segment",
    "familyDidi"
  )

  syncFamilyDidiGlobals()

  if (options.sync === false) {
    return
  }

  clearTimeout(
    familyDidiStateSyncTimer
  )

  const immediate =
    options.immediate === true

  familyDidiStateSyncTimer =
    setTimeout(() => {
      if (
        typeof saveUnifiedGameState ===
        "function"
      ) {
        saveUnifiedGameState()
      }

      if (
        typeof syncDisplayStateToSession ===
        "function"
      ) {
        syncDisplayStateToSession({
          immediate
        })
      }
    }, immediate ? 0 : 120)
}

function scheduleFamilyDidiStateSync(
  immediate = false
) {
  saveFamilyDidiState({
    immediate
  })
}

function clearFamilyDidiState() {
  clearTimeout(
    familyDidiStateSyncTimer
  )

  familyDidiStateSyncTimer = null
  familyDidiStateSyncRunning = false
  familyDidiStateSyncPending = false

  clearInterval(
    familyDidiTimer
  )

  familyDidiTimer = null
  familyDidiTimerStarted = false
  familyDidiTimerStartedAt = 0
  familyDidiTimerEndsAt = 0
  familyDidiTimerDuration = 0
  familyDidiLastTickPlayed = null

  localStorage.removeItem(
    FAMILY_DIDI_STORAGE_KEY
  )

  localStorage.removeItem(
    "family_didi_max_rounds"
  )

  if (
    localStorage.getItem(
      "active_segment"
    ) === "familyDidi"
  ) {
    localStorage.removeItem(
      "active_segment"
    )
  }

  familyDidiState =
    createDefaultFamilyDidiState(
      familyDidiMaxRounds
    )

  familyDidiHistory = []
  familyDidiActionBusy = false
  familyDidiAnimatingPosition = null

  syncFamilyDidiGlobals()
}

window.saveFamilyDidiState =
  saveFamilyDidiState

window.scheduleFamilyDidiStateSync =
  scheduleFamilyDidiStateSync

window.clearFamilyDidiState =
  clearFamilyDidiState
  window.revealFamilyDidiQuestion =
  revealFamilyDidiQuestion