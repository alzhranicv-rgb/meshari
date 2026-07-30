/* =========================
   GAME STATE MANAGER
   حفظ موحد محلي فقط
========================= */

const GAME_STATE_STORAGE_KEY =
  "hanaka_game_state_v1"

const GAME_STATE_SAVE_DELAY = 120

let unifiedStateSaveTimer = null

/* =========================
   Safe Helpers
========================= */

function getSafeLocalJson(
  key,
  fallback = null
) {
  try {
    const raw =
      localStorage.getItem(key)

    if (!raw) return fallback

    return JSON.parse(raw) ?? fallback
  } catch (error) {
    console.log(
      `GAME STATE JSON ERROR [${key}]:`,
      error
    )

    return fallback
  }
}

function getUnifiedModelId() {
  return Number(
    localStorage.getItem("game_model") ||
    window.currentModel ||
    0
  )
}

function getUnifiedTeamName(team) {
  if (team === "A") {
    return (
      localStorage.getItem("teamAName") ||
      window.teamAName ||
      "الفريق الأول"
    )
  }

  return (
    localStorage.getItem("teamBName") ||
    window.teamBName ||
    "الفريق الثاني"
  )
}

function getUnifiedMainScore(team) {
  if (team === "A") {
    return Number(
      localStorage.getItem("main_score_a") ||
      window.scoreA ||
      0
    )
  }

  return Number(
    localStorage.getItem("main_score_b") ||
    window.scoreB ||
    0
  )
}

function normalizeUnifiedSegmentKey(key) {
  key = String(key || "")

  if (key === "final_round1") return "finalRound1"
  if (key === "final_round2") return "finalRound2"
  if (key === "final_round3") return "finalRound3"
  if (key === "final_round4") return "finalRound4"

  if (
    key === "random_challenge" ||
    key === "randomchallenge"
  ) {
    return "randomChallenge"
  }

  if (
    key === "top_10" ||
    key === "topTen"
  ) {
    return "top10"
  }

  if (
    key === "auction" ||
    key === "fatbla" ||
    key === "fitbala" ||
    key === "فتبلة"
  ) {
    return ""
  }

  return key
}

/* =========================
   Stable Hash
========================= */

function sortUnifiedObject(value) {
  if (Array.isArray(value)) {
    return value.map(sortUnifiedObject)
  }

  if (
    value &&
    typeof value === "object"
  ) {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] =
          sortUnifiedObject(value[key])

        return result
      }, {})
  }

  return value
}

function createUnifiedStateHash(state) {
  try {
    const cleanState = {
      ...state
    }

    delete cleanState.updatedAt

    return JSON.stringify(
      sortUnifiedObject(cleanState)
    )
  } catch (error) {
    console.log(
      "GAME STATE HASH ERROR:",
      error
    )

    return ""
  }
}

/* =========================
   Build State
========================= */

function getUnifiedGameState() {
  const activeSegment =
    normalizeUnifiedSegmentKey(
      localStorage.getItem("active_segment") ||
      null
    )

  const finalState =
    getSafeLocalJson(
      "final_state_v3",
      null
    )

  return {
    version: 3,

    sessionId:
      localStorage.getItem("game_session_id") ||
      null,

    activeSegment,

    activeTeam:
      localStorage.getItem("active_team_v1") ||
      null,

    model:
      getUnifiedModelId(),

    modelName:
      localStorage.getItem("game_model_name") ||
      window.currentModelName ||
      "",

    teams: {
      A: getUnifiedTeamName("A"),
      B: getUnifiedTeamName("B")
    },

    mainScores: {
      A: getUnifiedMainScore("A"),
      B: getUnifiedMainScore("B")
    },

    currentSegmentScores:
      window.currentSegmentScores || null,

    display: {
      controlsHidden:
        localStorage.getItem(
          "presenter_hide_controls"
        ) === "1",

      segmentStatus:
        getSafeLocalJson(
          "segment_status_v1",
          null
        )
    },

    segments: {
      warmup:
        getSafeLocalJson(
          "warmup_state_v1",
          null
        ),

      top10:
        getSafeLocalJson(
          "top10_state_v1",
          null
        ),

      letterli:
        getSafeLocalJson(
          "letterli_state_v1",
          null
        ),

      who:
        getSafeLocalJson(
          "who_state_v1",
          null
        ),

      explain:
        getSafeLocalJson(
          "explain_state_v1",
          null
        ),

      final:
        finalState,

      archive:
        getSafeLocalJson(
          "archive_state_v1",
          null
        ),

      randomChallenge:
        getSafeLocalJson(
          "random_challenge_state_v1",
          null
        )
    },

    updatedAt:
      new Date().toISOString()
  }
}

/* =========================
   Local Save
========================= */

function saveUnifiedGameState(
  options = {}
) {
  const state =
    getUnifiedGameState()

  const hash =
    createUnifiedStateHash(state)

  const previousState =
    loadUnifiedGameState()

  const previousHash =
    previousState
      ? createUnifiedStateHash(previousState)
      : ""

  if (
    options.force !== true &&
    hash &&
    hash === previousHash
  ) {
    return {
      state: previousState || state,
      changed: false,
      hash
    }
  }

  try {
    localStorage.setItem(
      GAME_STATE_STORAGE_KEY,
      JSON.stringify(state)
    )

    return {
      state,
      changed: true,
      hash
    }
  } catch (error) {
    console.log(
      "SAVE UNIFIED GAME STATE ERROR:",
      error
    )

    return {
      state,
      changed: false,
      hash,
      error
    }
  }
}

function scheduleUnifiedGameStateSave(
  options = {}
) {
  const immediate =
    options.immediate === true

  clearTimeout(
    unifiedStateSaveTimer
  )

  if (immediate) {
    return saveUnifiedGameState(
      options
    )
  }

  unifiedStateSaveTimer =
    setTimeout(() => {
      saveUnifiedGameState(
        options
      )
    }, GAME_STATE_SAVE_DELAY)

  return null
}

function loadUnifiedGameState() {
  return getSafeLocalJson(
    GAME_STATE_STORAGE_KEY,
    null
  )
}

function resetUnifiedGameState() {
  clearTimeout(
    unifiedStateSaveTimer
  )

  unifiedStateSaveTimer = null

  localStorage.removeItem(
    GAME_STATE_STORAGE_KEY
  )
}

/* =========================
   Compatibility Only
   لا يرسل أي مزامنة خارجية
========================= */

async function performUnifiedGameStateSync(
  options = {}
) {
  const saved =
    saveUnifiedGameState({
      force:
        options.forceSave === true ||
        options.force === true
    })

  return {
    synced: false,
    localOnly: true,
    state: saved.state,
    changed: saved.changed,
    hash: saved.hash
  }
}

function syncUnifiedGameState(
  options = {}
) {
  return scheduleUnifiedGameStateSave({
    immediate:
      options.immediate === true,
    force:
      options.force === true ||
      options.forceSave === true
  })
}

/* =========================
   Storage Listener
   حفظ محلي فقط بدون مزامنة خارجية
========================= */

function shouldTrackUnifiedStorageKey(key) {
  if (!key) return false

  return [
    "active_segment",
    "active_team_v1",
    "game_model",
    "game_model_name",
    "teamAName",
    "teamBName",
    "main_score_a",
    "main_score_b",
    "presenter_hide_controls",
    "segment_status_v1",

    "warmup_state_v1",
    "top10_state_v1",
    "letterli_state_v1",
    "who_state_v1",
    "explain_state_v1",
    "final_state_v3",
    "archive_state_v1",
    "random_challenge_state_v1"
  ].includes(key)
}

window.addEventListener(
  "storage",
  event => {
    if (
      !shouldTrackUnifiedStorageKey(
        event.key
      )
    ) {
      return
    }

    scheduleUnifiedGameStateSave()
  }
)

/* =========================
   Visibility Flush
========================= */

document.addEventListener(
  "visibilitychange",
  () => {
    if (
      document.visibilityState !==
      "hidden"
    ) {
      return
    }

    saveUnifiedGameState({
      force: true
    })
  }
)

/* =========================
   Exports
========================= */

window.getUnifiedGameState =
  getUnifiedGameState

window.saveUnifiedGameState =
  saveUnifiedGameState

window.scheduleUnifiedGameStateSave =
  scheduleUnifiedGameStateSave

window.loadUnifiedGameState =
  loadUnifiedGameState

window.resetUnifiedGameState =
  resetUnifiedGameState

window.performUnifiedGameStateSync =
  performUnifiedGameStateSync

window.syncUnifiedGameState =
  syncUnifiedGameState

window.createUnifiedStateHash =
  createUnifiedStateHash

window.normalizeUnifiedSegmentKey =
  normalizeUnifiedSegmentKey