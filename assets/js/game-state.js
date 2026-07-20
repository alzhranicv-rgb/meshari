/* =========================
   GAME STATE MANAGER
   حفظ موحد + منع التكرار + مزامنة مخففة
========================= */

const GAME_STATE_STORAGE_KEY = "hanaka_game_state_v1"
const GAME_STATE_LAST_SYNC_HASH_KEY = "hanaka_game_state_last_sync_hash_v1"

const GAME_STATE_SAVE_DELAY = 120
const GAME_STATE_SYNC_DELAY = 220

let unifiedStateSaveTimer = null
let unifiedStateSyncTimer = null

let unifiedStateSyncInProgress = false
let unifiedStateSyncQueued = false

let lastUnifiedStateHash =
  localStorage.getItem(GAME_STATE_LAST_SYNC_HASH_KEY) || ""

/* =========================
   Safe Helpers
========================= */

function getSafeLocalJson(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key)

    if (!raw) return fallback

    return JSON.parse(raw) ?? fallback
  } catch (error) {
    console.log(`GAME STATE JSON ERROR [${key}]:`, error)
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
        result[key] = sortUnifiedObject(value[key])
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
    console.log("GAME STATE HASH ERROR:", error)
    return ""
  }
}

/* =========================
   Build State
========================= */

function getUnifiedGameState() {
  const finalState =
    getSafeLocalJson("final_state_v3", null)

  return {
    version: 2,

    sessionId:
      localStorage.getItem("game_session_id") ||
      null,

    activeSegment:
      localStorage.getItem("active_segment") ||
      null,

    activeTeam:
      localStorage.getItem("active_team_v1") ||
      null,

    model: getUnifiedModelId(),

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

      auction:
        getSafeLocalJson(
          "auction_state_v2",
          null
        ) ||
        getSafeLocalJson(
          "auction_state_v1",
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

      final: finalState,

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

    updatedAt: new Date().toISOString()
  }
}

/* =========================
   Local Save
========================= */

function saveUnifiedGameState(options = {}) {
  const state = getUnifiedGameState()
  const hash = createUnifiedStateHash(state)

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

  clearTimeout(unifiedStateSaveTimer)

  if (immediate) {
    return saveUnifiedGameState(options)
  }

  unifiedStateSaveTimer = setTimeout(() => {
    saveUnifiedGameState(options)
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
  clearTimeout(unifiedStateSaveTimer)
  clearTimeout(unifiedStateSyncTimer)

  unifiedStateSaveTimer = null
  unifiedStateSyncTimer = null

  unifiedStateSyncInProgress = false
  unifiedStateSyncQueued = false
  lastUnifiedStateHash = ""

  localStorage.removeItem(
    GAME_STATE_STORAGE_KEY
  )

  localStorage.removeItem(
    GAME_STATE_LAST_SYNC_HASH_KEY
  )
}

/* =========================
   Remote Sync
========================= */

async function performUnifiedGameStateSync(
  options = {}
) {
  const saved = saveUnifiedGameState({
    force:
      options.forceSave === true
  })

  const state = saved.state
  const hash = saved.hash

  if (!state) {
    return {
      synced: false,
      reason: "no_state"
    }
  }

  if (!state.sessionId) {
    return {
      synced: false,
      reason: "no_session"
    }
  }

  if (!state.model) {
    return {
      synced: false,
      reason: "no_model"
    }
  }

  if (
    options.force !== true &&
    hash &&
    hash === lastUnifiedStateHash
  ) {
    return {
      synced: false,
      reason: "unchanged",
      state
    }
  }

  if (
    typeof window.performDisplayStateSync ===
    "function"
  ) {
    try {
      await window.performDisplayStateSync()

      if (hash) {
        lastUnifiedStateHash = hash

        localStorage.setItem(
          GAME_STATE_LAST_SYNC_HASH_KEY,
          hash
        )
      }

      return {
        synced: true,
        state
      }
    } catch (error) {
      console.log(
        "SYNC UNIFIED GAME STATE ERROR:",
        error
      )

      return {
        synced: false,
        reason: "sync_error",
        error,
        state
      }
    }
  }

  if (
    typeof window.syncDisplayStateToSession ===
    "function"
  ) {
    window.syncDisplayStateToSession({
      immediate: true
    })

    return {
      synced: true,
      queued: true,
      state
    }
  }

  return {
    synced: false,
    reason: "sync_function_missing",
    state
  }
}

function syncUnifiedGameState(options = {}) {
  const immediate =
    options.immediate === true

  const delay = immediate
    ? 0
    : GAME_STATE_SYNC_DELAY

  clearTimeout(unifiedStateSyncTimer)

  unifiedStateSyncTimer = setTimeout(
    async () => {
      if (unifiedStateSyncInProgress) {
        unifiedStateSyncQueued = true
        return
      }

      unifiedStateSyncInProgress = true

      try {
        await performUnifiedGameStateSync(
          options
        )
      } finally {
        unifiedStateSyncInProgress = false

        if (unifiedStateSyncQueued) {
          unifiedStateSyncQueued = false

          syncUnifiedGameState({
            ...options,
            immediate: true
          })
        }
      }
    },
    delay
  )

  return scheduleUnifiedGameStateSave({
    immediate
  })
}

/* =========================
   Storage Listener
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
    "auction_state_v1",
    "auction_state_v2",
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

    syncUnifiedGameState()
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

    syncUnifiedGameState({
      immediate: true,
      forceSave: true
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