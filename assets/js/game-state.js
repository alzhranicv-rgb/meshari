/* =========================
   GAME STATE MANAGER
   نظام حفظ موحد آمن
========================= */

const GAME_STATE_STORAGE_KEY = "hanaka_game_state_v1"

function getSafeLocalJson(key, fallback = null) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback
  } catch {
    return fallback
  }
}

function getUnifiedGameState() {
  return {
    version: 1,

    activeSegment: localStorage.getItem("active_segment") || null,

    model: Number(localStorage.getItem("game_model") || window.currentModel || 1),
    modelName: localStorage.getItem("game_model_name") || window.currentModelName || "",

    teams: {
      A: localStorage.getItem("teamAName") || window.teamAName || "الفريق الأول",
      B: localStorage.getItem("teamBName") || window.teamBName || "الفريق الثاني"
    },

    mainScores: {
      A: Number(localStorage.getItem("main_score_a") || window.scoreA || 0),
      B: Number(localStorage.getItem("main_score_b") || window.scoreB || 0)
    },

    display: {
      controlsHidden: localStorage.getItem("presenter_hide_controls") === "1",
      segmentStatus: getSafeLocalJson("segment_status_v1", null)
    },

    segments: {
      warmup: getSafeLocalJson("warmup_state_v1", null),
      top10: getSafeLocalJson("top10_state_v1", null),
      auction: getSafeLocalJson("auction_state_v2", null),
      who: getSafeLocalJson("who_state_v1", null),
      explain: getSafeLocalJson("explain_state_v1", null),
      final: getSafeLocalJson("final_state_v3", null),
      archive: getSafeLocalJson("archive_state_v1", null)
    },

    updatedAt: new Date().toISOString()
  }
}

function saveUnifiedGameState() {
  const state = getUnifiedGameState()
  localStorage.setItem(GAME_STATE_STORAGE_KEY, JSON.stringify(state))
  return state
}

function loadUnifiedGameState() {
  return getSafeLocalJson(GAME_STATE_STORAGE_KEY, null)
}

function resetUnifiedGameState() {
  localStorage.removeItem(GAME_STATE_STORAGE_KEY)
}

function syncUnifiedGameState() {
  const state = saveUnifiedGameState()

  if (typeof syncDisplayStateToSession === "function") {
    syncDisplayStateToSession()
  }

  return state
}

window.getUnifiedGameState = getUnifiedGameState
window.saveUnifiedGameState = saveUnifiedGameState
window.loadUnifiedGameState = loadUnifiedGameState
window.resetUnifiedGameState = resetUnifiedGameState
window.syncUnifiedGameState = syncUnifiedGameState