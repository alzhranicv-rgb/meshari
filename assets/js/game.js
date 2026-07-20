let teamAName = localStorage.getItem("teamAName") || "الفريق الأول"
let teamBName = localStorage.getItem("teamBName") || "الفريق الثاني"

let scoreA = Number(localStorage.getItem("main_score_a") || 0)
let scoreB = Number(localStorage.getItem("main_score_b") || 0)

/* =========================
   GLOBAL ACTIVE TEAM SYSTEM
   نظام الفريق النشط العام
========================= */

const ACTIVE_TEAM_KEY = "active_team_v1"

function setGameActiveTeam(team, options = {}) {
  const cleanTeam = team === "A" || team === "B" ? team : ""

  if (cleanTeam) {
    localStorage.setItem(ACTIVE_TEAM_KEY, cleanTeam)
    document.body.dataset.activeTeam = cleanTeam
  } else {
    localStorage.removeItem(ACTIVE_TEAM_KEY)
    delete document.body.dataset.activeTeam
  }

  if (options.sync !== false && typeof syncDisplayStateToSession === "function") {
    syncDisplayStateToSession()
  }
}

function getGameActiveTeam() {
  const team = localStorage.getItem(ACTIVE_TEAM_KEY)
  return team === "A" || team === "B" ? team : ""
}

function clearGameActiveTeam(options = {}) {
  setGameActiveTeam("", {
    sync: options.sync !== false
  })
}

function initGameActiveTeam() {
  const team = getGameActiveTeam()

  if (team) {
    document.body.dataset.activeTeam = team
  } else {
    delete document.body.dataset.activeTeam
  }
}

window.setGameActiveTeam = setGameActiveTeam
window.getGameActiveTeam = getGameActiveTeam
window.clearGameActiveTeam = clearGameActiveTeam

initGameActiveTeam()

let selectedTeam = null
let timer = null
let currentPoints = 0
let timeLeft = 0
let homeRefreshLocked = true
let endButtonWatcher = null
let gameToastTimer = null
let currentModel = Number(localStorage.getItem("game_model") || 0)
window.currentModel = currentModel

let currentModelName = localStorage.getItem("game_model_name") || ""
window.currentModelName = currentModelName
/* =========================
   DISPLAY DATA CACHE
========================= */

const DISPLAY_MODEL_CACHE_TTL = 5 * 60 * 1000
const DISPLAY_GLOBAL_CACHE_TTL = 10 * 60 * 1000

let displayModelDataLoaded = false
let displayModelDataPromise = null
let displayVisibilityLoadedAt = 0

let displaySyncTimer = null
let displaySyncInProgress = false
let displaySyncQueued = false

function getDisplayModelId() {
  return Number(
    localStorage.getItem("game_model") ||
    window.currentModel ||
    currentModel ||
    0
  )
}

function getDisplayDefaultSegmentCounts() {
  return {
    top10: 3,
    archive: 4,
    who: 15,
    explain: 5,
    finalRound1: 7,
    finalRound3: 5,
    finalRound4: 5
  }
}

function clampDisplaySegmentCount(value, fallback, max) {
  return Math.min(
    Math.max(Number(value || fallback), 1),
    max
  )
}
window.top10MaxRound = Number(
  localStorage.getItem("top10_max_round") || 3
)

window.archiveMaxRound = Number(
  localStorage.getItem("archive_max_round") || 4
)

window.whoMaxNumber = Number(
  localStorage.getItem("who_max_number") || 15
)

window.explainWordsCount = Number(
  localStorage.getItem("explain_words_count") || 5
)

window.finalRound1CardsCount = Number(
  localStorage.getItem("final_round1_cards_count") || 7
)

window.finalRound3Count = Number(
  localStorage.getItem("final_round3_count") || 5
)

window.finalRound4Count = Number(
  localStorage.getItem("final_round4_count") || 5
)
const ALL_DISPLAY_SEGMENTS = [
  { key: "warmup", title: "التسخين", sort: 1 },
  { key: "top10", title: "Top 10", sort: 2 },
  { key: "letterli", title: "حرفلي", sort: 3 },
  { key: "who", title: "من هو", sort: 4 },
  { key: "explain", title: "اشرح الكلمة", sort: 5 },
  { key: "finalRound1", title: "ٮدوں ٮڡاط", sort: 6 },
  { key: "finalRound2", title: "صح صحلي", sort: 7 },
  { key: "finalRound3", title: "قصة", sort: 8 },
  { key: "finalRound4", title: "التركيز", sort: 9 },
  { key: "archive", title: "الأرشيف", sort: 10 },
  { key: "randomChallenge", title: "التحدي", sort: 11 }
]

function getCachedSelectedDisplaySegments() {
  try {
    const saved = JSON.parse(
      localStorage.getItem("selected_game_segments") || "[]"
    )

    return Array.isArray(saved) ? saved : []
  } catch {
    return []
  }
}

const cachedSelectedDisplaySegments =
  getCachedSelectedDisplaySegments()

let visibleDisplaySegments = cachedSelectedDisplaySegments.length
  ? cachedSelectedDisplaySegments
      .map((key, index) => {
        const item = ALL_DISPLAY_SEGMENTS.find(segment => {
          return normalizeDisplaySegmentKey(segment.key) ===
            normalizeDisplaySegmentKey(key)
        })

        if (!item) return null

        return {
          ...item,
          key: normalizeDisplaySegmentKey(item.key),
          is_visible: true,
          sort_order: index + 1
        }
      })
      .filter(Boolean)
  : ALL_DISPLAY_SEGMENTS.map(item => ({
      ...item,
      is_visible: true,
      sort_order: item.sort
    }))

function escapeDisplayHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function normalizeDisplaySegmentKey(key) {
  key = String(key || "")

  if (key === "final_round1") return "finalRound1"
  if (key === "final_round2") return "finalRound2"
  if (key === "final_round3") return "finalRound3"
  if (key === "final_round4") return "finalRound4"

  return key
}

function isFinalSegmentKey(key) {
  key = normalizeDisplaySegmentKey(key)

  return (
    key === "final" ||
    key === "finalRound1" ||
    key === "finalRound2" ||
    key === "finalRound3" ||
    key === "finalRound4"
  )
}

function getFinalRoundFromSegmentKey(key) {
  key = normalizeDisplaySegmentKey(key)

  if (key === "finalRound1") return 1
  if (key === "finalRound2") return 2
  if (key === "finalRound3") return 3
  if (key === "finalRound4") return 4

  return Number(window.displayFinalRound || window.currentFinalRound || 1)
}

function getFinalSegmentKeyFromRound(round) {
  const r = Number(round || 1)

  if (r === 1) return "finalRound1"
  if (r === 2) return "finalRound2"
  if (r === 3) return "finalRound3"
  if (r === 4) return "finalRound4"

  return "finalRound1"
}

function isAnyFinalVisibleOnDisplay() {
  return getVisibleDisplaySegments().some(item => {
    const key = normalizeDisplaySegmentKey(item.key)
    return isFinalSegmentKey(key)
  })
}

const SEGMENT_STATUS_KEY = "segment_status_v1"

function defaultSegmentStatus() {
  const item = () => ({
    locked: false,
    winner: "",
    scoreA: 0,
    scoreB: 0
  })

  return {
    warmup: item(),
    top10: item(),
    letterli: item(),
    who: item(),
    explain: item(),

    final: item(),
    finalRound1: item(),
    finalRound2: item(),
    finalRound3: item(),
    finalRound4: item(),

    archive: item(),
    randomChallenge: item()
  }
}

function loadSegmentStatus() {
  try {
    const saved = JSON.parse(localStorage.getItem(SEGMENT_STATUS_KEY) || "null")
    const defaults = defaultSegmentStatus()

    if (!saved) return defaults

    Object.keys(defaults).forEach(key => {
      defaults[key] = {
  locked: !!saved?.[key]?.locked,
  winner: saved?.[key]?.winner || "",
  scoreA: Number(saved?.[key]?.scoreA || 0),
  scoreB: Number(saved?.[key]?.scoreB || 0)
}
    })

    return defaults
  } catch (e) {
    console.log("segment status load error:", e)
    return defaultSegmentStatus()
  }
}

function saveSegmentStatus() {
  try {
    localStorage.setItem(SEGMENT_STATUS_KEY, JSON.stringify(segmentStatus))
    syncDisplayStateToSession()
  } catch (e) {
    console.log("segment status save error:", e)
  }
}

let segmentStatus = loadSegmentStatus()
const GAME_SESSION_ID = localStorage.getItem("game_session_id")

function getSafeJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null")
  } catch {
    return null
  }
}

async function performDisplayStateSync() {
  try {
    const sessionId =
      localStorage.getItem(
        "game_session_id"
      )

    if (!sessionId) return

    const modelId =
      getDisplayModelId()

    if (!modelId) return

    currentModelName =
      localStorage.getItem(
        "game_model_name"
      ) ||
      currentModelName ||
      ""

    window.currentModelName =
      currentModelName

    const explainLocalState =
      getSafeJson(
        "explain_state_v1"
      )

    const explainSavedState =
      window.explainState ||
      explainLocalState
        ?.explainState ||
      null

    const explainSavedDoubleState =
      window.explainDoubleState ||
      explainLocalState
        ?.explainDoubleState ||
      null

    const state = {
      mainScores: {
        A: Number(
          localStorage.getItem(
            "main_score_a"
          ) ||
          scoreA ||
          0
        ),

        B: Number(
          localStorage.getItem(
            "main_score_b"
          ) ||
          scoreB ||
          0
        )
      },

      activeTeam:
        getGameActiveTeam(),

      currentModelName:
        localStorage.getItem(
          "game_model_name"
        ) ||
        currentModelName ||
        "",

      displayControlsHidden:
        localStorage.getItem(
          "presenter_hide_controls"
        ) === "1",

      segmentStatus:
        getSafeJson(
          "segment_status_v1"
        ) ||
        defaultSegmentStatus(),

      warmup:
        getSafeJson(
          "warmup_state_v1"
        ),

      top10:
        getSafeJson(
          "top10_state_v1"
        ),

      letterli:
        getSafeJson(
         "letterli_state_v1"
        ),

      who:
        getSafeJson(
          "who_state_v1"
        ),

      explain: {
        explainState:
          explainSavedState,

        explainDoubleState:
          explainSavedDoubleState
      },

      final:
        getSafeJson(
          "final_state_v3"
        ),

      finalRound1:
        getSafeJson(
          "final_state_v3"
        ),

      finalRound2:
        getSafeJson(
          "final_state_v3"
        ),

      finalRound3:
        getSafeJson(
          "final_state_v3"
        ),

      finalRound4:
        getSafeJson(
          "final_state_v3"
        ),

      archive:
        getSafeJson(
          "archive_state_v1"
        ),

      randomChallenge:
        getSafeJson(
          "random_challenge_state_v1"
        ),

      toast:
        window.lastDisplayToast ||
        null
    }

    const sessionData = {
      id: sessionId,

      join_code:
        localStorage.getItem(
          "game_join_code"
        ),

      status: "active",

      model: modelId,

      team_a:
        localStorage.getItem(
          "teamAName"
        ) ||
        teamAName,

      team_b:
        localStorage.getItem(
          "teamBName"
        ) ||
        teamBName,

      active_segment:
        localStorage.getItem(
          "active_segment"
        ) ||
        null,

      state,

      updated_at:
        new Date().toISOString()
    }

    try {
      if (
        typeof presenterCommandChannel !==
          "undefined" &&
        presenterCommandChannel
      ) {
        const payload = {
          type: "broadcast",
          event: "session_state",
          payload: sessionData
        }

        const channelState =
          presenterCommandChannel.state

        if (
  channelState === "joined"
) {
  await presenterCommandChannel.send(payload)
} else if (
  typeof presenterCommandChannel.httpSend === "function"
) {
  await presenterCommandChannel.httpSend(
    "session_state",
    sessionData
  )
}
      }
    } catch (error) {
      console.log(
        "Display session broadcast error:",
        error
      )
    }

    const {
      error: sessionError
    } = await db
      .from("game_sessions")
      .upsert(sessionData)

    if (sessionError) {
      throw sessionError
    }
  } catch (error) {
    console.log(
      "sync session error:",
      error
    )
  }
}

window.performDisplayStateSync =
  performDisplayStateSync
  
function syncDisplayStateToSession(options = {}) {
  const immediate = options.immediate === true
  const delay = immediate ? 0 : 180

  clearTimeout(displaySyncTimer)

  displaySyncTimer = setTimeout(async () => {
    if (displaySyncInProgress) {
      displaySyncQueued = true
      return
    }

    displaySyncInProgress = true

    try {
      await performDisplayStateSync()
    } finally {
      displaySyncInProgress = false

      if (displaySyncQueued) {
        displaySyncQueued = false
        syncDisplayStateToSession({
          immediate: true
        })
      }
    }
  }, delay)
}

window.syncDisplayStateToSession =
  syncDisplayStateToSession
  
/* =========================
   Winner Sound + Effects
========================= */

let winnerSound = null
let winnerConfettiLayer = null
let winnerConfettiInterval = null
let winnerFxTimeouts = []

function initWinnerSound() {
  if (!winnerSound) {
    winnerSound = new Audio("sounds/win.mp3")
    winnerSound.preload = "auto"
    winnerSound.loop = true
    winnerSound.volume = 0.9
  }
}

function playWinnerEffects() {
  initWinnerSound()
  stopWinnerEffects()

  const winnerBtn = document.querySelector(".winnerBtn")
  const homeShell = document.querySelector(".homePageShell")
  const overlay = document.getElementById("winnerOverlay")
  const nameBox = document.getElementById("winnerOverlayName")

  if (winnerBtn) {
    winnerBtn.classList.remove("winnerAnnounceFx")
    void winnerBtn.offsetWidth
    winnerBtn.classList.add("winnerAnnounceFx")
  }

  if (homeShell) {
    homeShell.classList.remove("winnerFlash")
    void homeShell.offsetWidth
    homeShell.classList.add("winnerFlash")
  }

  if (overlay) {
    overlay.classList.remove("winnerOverlayFx")
    void overlay.offsetWidth
    overlay.classList.add("winnerOverlayFx")
  }

  if (nameBox) {
    nameBox.classList.remove("winnerNameFx")
    void nameBox.offsetWidth
    nameBox.classList.add("winnerNameFx")
  }

  try {
    winnerSound.pause()
    winnerSound.currentTime = 0

    const playPromise = winnerSound.play()
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(err => {
        console.log("winner sound error:", err)
      })
    }
  } catch (e) {
    console.log("winner sound error:", e)
  }

  launchWinnerConfetti()
}

function createWinnerConfettiBurst(count = 50) {
  if (!winnerConfettiLayer) return

  const colors = [
    "#FF9B51", // برتقالي المشروع
    "#FFC08E", // برتقالي فاتح
    "#2F4158", // كحلي المشروع
    "#25343F", // كحلي غامق
    "#FFFFFF", // أبيض
    "#EAC17A", // ذهبي هادي
    "#67E8F9"  // سماوي خفيف
  ]

  for (let i = 0; i < count; i++) {
    const piece = document.createElement("span")
    piece.className = "winnerConfettiPiece"

    const size = 7 + Math.random() * 12
    const left = Math.random() * 100
    const delay = Math.random() * 0.22
    const duration = 2.6 + Math.random() * 1.9
    const drift = -170 + Math.random() * 340
    const rotate = 240 + Math.random() * 760
    const color = colors[Math.floor(Math.random() * colors.length)]
    const shape = Math.random()

    piece.style.left = `${left}%`
    piece.style.top = `-44px`
    piece.style.width = `${size}px`
    piece.style.height = `${size * (shape > 0.62 ? 1.45 : 1)}px`
    piece.style.background = color
    piece.style.animationDelay = `${delay}s`
    piece.style.animationDuration = `${duration}s`
    piece.style.setProperty("--confetti-drift", `${drift}px`)
    piece.style.setProperty("--confetti-rotate", `${rotate}deg`)

    if (shape < 0.30) {
      piece.style.borderRadius = "50%"
    } else if (shape < 0.68) {
      piece.style.borderRadius = "5px"
    } else {
      piece.style.borderRadius = "2px"
      piece.style.transform = "skewX(-10deg)"
    }

    winnerConfettiLayer.appendChild(piece)

    const removeTimeout = setTimeout(() => {
      piece.remove()
    }, (duration + delay + 1.2) * 1000)

    winnerFxTimeouts.push(removeTimeout)
  }
}

function launchWinnerConfetti() {
  if (winnerConfettiLayer) {
    winnerConfettiLayer.remove()
    winnerConfettiLayer = null
  }

  winnerConfettiLayer = document.createElement("div")
  winnerConfettiLayer.className = "winnerConfettiLayer"
  document.body.appendChild(winnerConfettiLayer)

  createWinnerConfettiBurst(55)

  winnerFxTimeouts.push(
    setTimeout(() => createWinnerConfettiBurst(35), 280),
    setTimeout(() => createWinnerConfettiBurst(28), 620)
  )

  winnerConfettiInterval = setInterval(() => {
    createWinnerConfettiBurst(10)
  }, 900)
}

function stopWinnerEffects() {
  if (winnerSound) {
    winnerSound.pause()
    winnerSound.currentTime = 0
  }

  if (winnerConfettiInterval) {
    clearInterval(winnerConfettiInterval)
    winnerConfettiInterval = null
  }

  winnerFxTimeouts.forEach(t => clearTimeout(t))
  winnerFxTimeouts = []

  if (winnerConfettiLayer) {
    winnerConfettiLayer.remove()
    winnerConfettiLayer = null
  }

  const winnerBtn = document.querySelector(".winnerBtn")
  const homeShell = document.querySelector(".homePageShell")
  const overlay = document.getElementById("winnerOverlay")
  const nameBox = document.getElementById("winnerOverlayName")

  if (winnerBtn) winnerBtn.classList.remove("winnerAnnounceFx")
  if (homeShell) homeShell.classList.remove("winnerFlash")
  if (overlay) overlay.classList.remove("winnerOverlayFx")
  if (nameBox) nameBox.classList.remove("winnerNameFx")
}
/* =========================
   Shared Game Sounds
========================= */

let sharedGameSounds = null
let audioUnlocked = false

function initGameSounds() {
  if (sharedGameSounds) return

  sharedGameSounds = {
    correct: new Audio("sounds/correct.mp3"),
    wrong: new Audio("sounds/wrong.mp3"),
    tick: new Audio("sounds/tick.mp3"),
    timeout: new Audio("sounds/timer.mp3"),
    bid: new Audio("sounds/bid.mp3"),
    open: new Audio("sounds/open.mp3"),
    answer: new Audio("sounds/answer.mp3")
  }

  Object.values(sharedGameSounds).forEach(sound => {
    sound.preload = "auto"
  })
}

function unlockAudioContext() {
  if (audioUnlocked) return

  initWinnerSound()
  initGameSounds()

  const sounds = [
    winnerSound,
    ...(sharedGameSounds ? Object.values(sharedGameSounds) : [])
  ].filter(Boolean)

  sounds.forEach(sound => {
    try {
      sound.muted = true
      const playPromise = sound.play()

      if (playPromise && typeof playPromise.then === "function") {
        playPromise
          .then(() => {
            sound.pause()
            sound.currentTime = 0
            sound.muted = false
          })
          .catch(() => {
            sound.muted = false
          })
      } else {
        sound.pause()
        sound.currentTime = 0
        sound.muted = false
      }
    } catch (e) {
      sound.muted = false
    }
  })

  audioUnlocked = true
}

function bindAudioUnlock() {
  const unlockOnce = () => {
    unlockAudioContext()
    document.removeEventListener("click", unlockOnce)
    document.removeEventListener("touchstart", unlockOnce)
    document.removeEventListener("pointerdown", unlockOnce)
  }

  document.addEventListener("click", unlockOnce, { passive: true })
  document.addEventListener("touchstart", unlockOnce, { passive: true })
  document.addEventListener("pointerdown", unlockOnce, { passive: true })
}

function playGameSound(type) {
  initGameSounds()

  if (!audioUnlocked) return

  const sound = sharedGameSounds?.[type]
  if (!sound) return

  try {
    sound.pause()
    sound.currentTime = 0

    const playPromise = sound.play()
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(err => {
        console.log(`sound error [${type}]`, err)
      })
    }
  } catch (e) {
    console.log(`sound error [${type}]`, e)
  }
}
/* =========================
   Segment Counts From Admin
   استعلام واحد بدل 8 استعلامات
========================= */

function applyDisplaySegmentSettings(rows = []) {
  const defaults = getDisplayDefaultSegmentCounts()
  const map = {}

  ;(rows || []).forEach(row => {
    map[row.segment] = Number(row.item_count || 0)
  })

  window.top10MaxRound = clampDisplaySegmentCount(
    map.top10,
    defaults.top10,
    4
  )

  window.archiveMaxRound = clampDisplaySegmentCount(
    map.archive,
    defaults.archive,
    4
  )

  window.whoMaxNumber = clampDisplaySegmentCount(
    map.who,
    defaults.who,
    15
  )

  window.explainWordsCount = clampDisplaySegmentCount(
    map.explain,
    defaults.explain,
    9
  )

  window.finalRound1CardsCount = clampDisplaySegmentCount(
    map.finalRound1,
    defaults.finalRound1,
    9
  )

  window.finalRound3Count = clampDisplaySegmentCount(
    map.finalRound3,
    defaults.finalRound3,
    9
  )

  window.finalRound4Count = clampDisplaySegmentCount(
    map.finalRound4,
    defaults.finalRound4,
    9
  )

  localStorage.setItem(
    "top10_max_round",
    String(window.top10MaxRound)
  )

  localStorage.setItem(
    "archive_max_round",
    String(window.archiveMaxRound)
  )

  localStorage.setItem(
    "who_max_number",
    String(window.whoMaxNumber)
  )

  localStorage.setItem(
    "explain_words_count",
    String(window.explainWordsCount)
  )

  localStorage.setItem(
    "final_round1_cards_count",
    String(window.finalRound1CardsCount)
  )

  localStorage.setItem(
    "final_round3_count",
    String(window.finalRound3Count)
  )

  localStorage.setItem(
    "final_round4_count",
    String(window.finalRound4Count)
  )
}

async function loadDisplayModelData(options = {}) {
  const modelId = getDisplayModelId()

  if (!modelId) {
    return null
  }

  if (
    displayModelDataPromise &&
    options.forceRefresh !== true
  ) {
    return displayModelDataPromise
  }

  displayModelDataPromise = (async () => {
    try {
      let result

      if (typeof window.loadModelWithRelations === "function") {
        result = await window.loadModelWithRelations(
          modelId,
          {
            ttl: DISPLAY_MODEL_CACHE_TTL,
            forceRefresh: options.forceRefresh === true,
            staleWhileRevalidate:
              options.staleWhileRevalidate !== false,

            onBackgroundUpdate: freshModel => {
              if (!freshModel) return

              applyDisplaySegmentSettings(
                freshModel.segment_settings || []
              )

              applyVisibleSegmentsForDisplay(
                freshModel.visible_segments || [],
                window.displayGlobalVisibilityMap || {}
              )

              renderVisibleSegmentsHome()
              updateSegmentCards()
            }
          }
        )
      } else {
        const { data, error } = await db
          .from("models")
          .select(`
            id,
            name,
            segment_settings (
              segment,
              item_count
            ),
            visible_segments (
              segment_key,
              is_visible,
              sort_order
            )
          `)
          .eq("id", modelId)
          .maybeSingle()

        result = {
          data,
          error,
          source: "network"
        }
      }

      if (result?.error && !result?.data) {
        console.log(
          "LOAD DISPLAY MODEL DATA ERROR:",
          result.error
        )

        return null
      }

      const modelData = result?.data || null

      if (!modelData) {
        return null
      }

      if (modelData.name) {
        currentModelName = modelData.name
        window.currentModelName = modelData.name

        localStorage.setItem(
          "game_model_name",
          modelData.name
        )
      }

      applyDisplaySegmentSettings(
        modelData.segment_settings || []
      )

      displayModelDataLoaded = true

      return modelData
    } catch (error) {
      console.log(
        "LOAD DISPLAY MODEL DATA CATCH:",
        error
      )

      return null
    } finally {
      displayModelDataPromise = null
    }
  })()

  return displayModelDataPromise
}

async function loadDisplaySegmentCounts(options = {}) {
  const modelData = await loadDisplayModelData(options)

  if (!modelData) {
    applyDisplaySegmentSettings([])
  }

  return modelData
}

async function loadDisplayCountForSegment(segmentKey) {
  /*
    الإعدادات جرى تحميلها كلها في طلب واحد.
    لا نرسل طلبًا جديدًا عند فتح كل فقرة.
  */

  if (!displayModelDataLoaded) {
    await loadDisplayModelData({
      staleWhileRevalidate: true
    })
  }

  return segmentKey
}

/* =========================
   Global Segment Visibility - Display
========================= */

window.displayGlobalVisibilityMap =
  window.displayGlobalVisibilityMap || {}

async function loadDisplayGlobalSegmentVisibilityMap(
  options = {}
) {
  const map = {}

  try {
    let rows = []

    if (typeof window.cachedSupabaseSelect === "function") {
      const result = await window.cachedSupabaseSelect(
        "global_segment_visibility",
        {
          select: "segment_key,is_enabled",
          ttl: DISPLAY_GLOBAL_CACHE_TTL,
          forceRefresh: options.forceRefresh === true,
          staleWhileRevalidate:
            options.staleWhileRevalidate !== false,

          onBackgroundUpdate: freshRows => {
            const freshMap = {}

            ;(freshRows || []).forEach(row => {
              freshMap[
                normalizeDisplaySegmentKey(row.segment_key)
              ] = row.is_enabled !== false
            })

            window.displayGlobalVisibilityMap = freshMap

            if (window.lastDisplayVisibleRows) {
              applyVisibleSegmentsForDisplay(
                window.lastDisplayVisibleRows,
                freshMap
              )

              renderVisibleSegmentsHome()
              updateSegmentCards()
            }
          }
        }
      )

      rows = result.data || []

      if (result.error && !rows.length) {
        console.log(
          "DISPLAY GLOBAL VISIBILITY ERROR:",
          result.error
        )
      }
    } else {
      const { data, error } = await db
        .from("global_segment_visibility")
        .select("segment_key,is_enabled")

      if (error) {
        console.log(
          "DISPLAY GLOBAL VISIBILITY ERROR:",
          error
        )
      }

      rows = data || []
    }

    rows.forEach(row => {
      map[
        normalizeDisplaySegmentKey(row.segment_key)
      ] = row.is_enabled !== false
    })

    window.displayGlobalVisibilityMap = map
    displayVisibilityLoadedAt = Date.now()

    return map
  } catch (error) {
    console.log(
      "DISPLAY GLOBAL VISIBILITY CATCH:",
      error
    )

    return map
  }
}

function isDisplaySegmentGloballyEnabled(
  segmentKey,
  globalMap = {}
) {
  const key =
    normalizeDisplaySegmentKey(segmentKey)

  return globalMap[key] !== false
}

function applyVisibleSegmentsForDisplay(
  rows = [],
  globalMap = {}
) {
  window.lastDisplayVisibleRows = rows || []

  const map = {}

  ALL_DISPLAY_SEGMENTS.forEach(item => {
    const key =
      normalizeDisplaySegmentKey(item.key)

    if (
      !isDisplaySegmentGloballyEnabled(
        key,
        globalMap
      )
    ) {
      return
    }

    map[key] = {
      ...item,
      key,
      is_visible: true,
      sort_order: item.sort
    }
  })

  ;(rows || []).forEach(row => {
    const key =
      normalizeDisplaySegmentKey(
        row.segment_key
      )

    if (!map[key]) return

    map[key] = {
      ...map[key],
      is_visible: !!row.is_visible,
      sort_order: Number(
        row.sort_order ||
        map[key].sort
      )
    }
  })

  visibleDisplaySegments =
    Object.values(map)
      .filter(item => item.is_visible)
      .sort((a, b) => {
        return (
          Number(a.sort_order || a.sort) -
          Number(b.sort_order || b.sort)
        )
      })

  return visibleDisplaySegments
}

async function loadVisibleSegmentsForDisplay(
  options = {}
) {
  const modelId = getDisplayModelId()

  const [globalMap, modelData] =
    await Promise.all([
      loadDisplayGlobalSegmentVisibilityMap({
        forceRefresh:
          options.forceRefresh === true,
        staleWhileRevalidate:
          options.staleWhileRevalidate !== false
      }),

      loadDisplayModelData({
        forceRefresh:
          options.forceRefresh === true,
        staleWhileRevalidate:
          options.staleWhileRevalidate !== false
      })
    ])

  if (!modelId || !modelData) {
    return applyVisibleSegmentsForDisplay(
      [],
      globalMap
    )
  }

  return applyVisibleSegmentsForDisplay(
    modelData.visible_segments || [],
    globalMap
  )
}
/* =========================
   Helpers
========================= */

function getFirstElement(ids) {
  for (const id of ids) {
    const el = document.getElementById(id)
    if (el) return el
  }
  return null
}

function setTextIfFound(ids, value) {
  const el = getFirstElement(ids)
  if (el) el.innerText = value
}

function addClassIfFound(ids, className) {
  const el = getFirstElement(ids)
  if (el) el.classList.add(className)
}

function removeClassIfFound(ids, className) {
  const el = getFirstElement(ids)
  if (el) el.classList.remove(className)
}

function updateModelNameDisplay() {
  const modelBox = document.getElementById("modelNameDisplay")
  const titleBox = document.querySelector(".homeTitleBox")

  if (modelBox) {
    modelBox.innerText = currentModelName ? currentModelName : "النموذج"
    modelBox.onclick = showJoinCodePopup
    modelBox.setAttribute("role", "button")
    modelBox.setAttribute("tabindex", "0")
    modelBox.style.cursor = "pointer"

    modelBox.onkeydown = function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        showJoinCodePopup()
      }
    }
  }

  if (titleBox) {
    titleBox.onclick = function (e) {
      const clickedButton = e.target.closest("button")
      if (clickedButton) return

      showJoinCodePopup()
    }

    titleBox.style.cursor = "pointer"
  }
}

function getSegmentWinnerLabelIds(key) {
  if (key === "warmup") {
    return ["segmentWinnerWarmup", "winnerWarmup"]
  }

  if (key === "top10") {
    return ["segmentWinnerTop10", "winnerTop10"]
  }

  if (key === "letterli") {
    return ["segmentWinnerLetterli", "winnerLetterli"]
  }

  if (key === "who") {
    return ["segmentWinnerWho", "winnerWho"]
  }

  if (key === "explain") {
    return ["segmentWinnerExplain", "winnerExplain"]
  }

  if (key === "finalRound1") {
    return ["segmentWinnerFinalRound1", "winner_finalRound1"]
  }

  if (key === "finalRound2") {
    return ["segmentWinnerFinalRound2", "winner_finalRound2"]
  }

  if (key === "finalRound3") {
    return ["segmentWinnerFinalRound3", "winner_finalRound3"]
  }

  if (key === "finalRound4") {
    return ["segmentWinnerFinalRound4", "winner_finalRound4"]
  }

  if (key === "final") {
    return ["segmentWinnerFinal", "winnerFinal"]
  }

  if (key === "archive") {
    return ["segmentWinnerArchive", "winnerArchive"]
  }

  if (key === "randomChallenge") {
    return [
      "segmentWinnerRandomChallenge",
      "winnerRandomChallenge"
    ]
  }

  return [
    `segmentWinner_${key}`,
    `winner_${key}`
  ]
}

function getSegmentCardIds(key) {
  if (key === "warmup") {
    return ["segmentCardWarmup", "segmentWarmup"]
  }

  if (key === "top10") {
    return ["segmentCardTop10", "segmentTop10"]
  }

  if (key === "letterli") {
    return ["segmentCardLetterli", "segmentLetterli"]
  }

  if (key === "who") {
    return ["segmentCardWho", "segmentWho"]
  }

  if (key === "explain") {
    return ["segmentCardExplain", "segmentExplain"]
  }

  if (key === "finalRound1") {
    return ["segmentCardFinalRound1", "segment_finalRound1"]
  }

  if (key === "finalRound2") {
    return ["segmentCardFinalRound2", "segment_finalRound2"]
  }

  if (key === "finalRound3") {
    return ["segmentCardFinalRound3", "segment_finalRound3"]
  }

  if (key === "finalRound4") {
    return ["segmentCardFinalRound4", "segment_finalRound4"]
  }

  if (key === "final") {
    return ["segmentCardFinal", "segmentFinal"]
  }

  if (key === "archive") {
    return ["segmentCardArchive", "segmentArchive"]
  }

  if (key === "randomChallenge") {
    return [
      "segmentCardRandomChallenge",
      "segmentRandomChallenge"
    ]
  }

  return [
    `segmentCard_${key}`,
    `segment_${key}`
  ]
}

function playSoftEnter(selector, fast = false) {
  const el = typeof selector === "string" ? document.querySelector(selector) : selector
  if (!el) return

  el.classList.remove("softEnter", "softEnterFast", "softSwap")
  void el.offsetWidth
  el.classList.add(fast ? "softEnterFast" : "softEnter")
}

function playSoftExit(selector, callback) {
  const el = typeof selector === "string" ? document.querySelector(selector) : selector
  if (!el) {
    if (callback) callback()
    return
  }

  el.classList.remove("softExit")
  void el.offsetWidth
  el.classList.add("softExit")

  setTimeout(() => {
    el.classList.remove("softExit")
    if (callback) callback()
  }, 90)
}

/* =========================
   DISPLAY ACTION GUARD
   حماية العرض من تكرار الأوامر
========================= */

const displayActionGuard = new Map()

function canRunDisplayAction(key, delay = 900) {
  const now = Date.now()
  const last = displayActionGuard.get(key) || 0

  if (now - last < delay) {
    return false
  }

  displayActionGuard.set(key, now)

  if (displayActionGuard.size > 80) {
    const latest = Array.from(displayActionGuard.entries()).slice(-40)
    displayActionGuard.clear()
    latest.forEach(([k, v]) => displayActionGuard.set(k, v))
  }

  return true
}

function getDisplayActiveSegmentKey() {
  return localStorage.getItem("active_segment") || getCurrentSegmentKey() || "home"
}

/* =========================
   DISPLAY PRO FLOW FX
   انتقالات ولقطات احترافية للعرض
========================= */

let displayProFxLock = false
let displayLastFxKey = ""
let displayLastFxTime = 0

function getDisplaySegmentTitle(segmentKey) {
  const key = normalizeDisplaySegmentKey(segmentKey)
  const item = ALL_DISPLAY_SEGMENTS.find(x => normalizeDisplaySegmentKey(x.key) === key)
  return item?.title || "الفقرة"
}

function shouldSkipRepeatedFx(key, delay = 900) {
  const now = Date.now()

  if (displayLastFxKey === key && now - displayLastFxTime < delay) {
    return true
  }

  displayLastFxKey = key
  displayLastFxTime = now

  return false
}

function ensureDisplayProLayer() {
  let layer = document.getElementById("displayProLayer")

  if (!layer) {
    layer = document.createElement("div")
    layer.id = "displayProLayer"
    layer.className = "displayProLayer hidden"
    document.body.appendChild(layer)
  }

  return layer
}

function showDisplayProOverlay({
  eyebrow = "",
  title = "",
  subtitle = "",
  type = "neutral",
  duration = 1200,
  sound = ""
} = {}) {
  return new Promise(resolve => {
    const layer = ensureDisplayProLayer()

    layer.className = `displayProLayer displayProLayerShow ${type}`

    layer.innerHTML = `
      <div class="displayProCard">
        ${eyebrow ? `<div class="displayProEyebrow">${escapeDisplayHtml(eyebrow)}</div>` : ""}
        ${title ? `<div class="displayProTitle">${escapeDisplayHtml(title)}</div>` : ""}
        ${subtitle ? `<div class="displayProSubtitle">${escapeDisplayHtml(subtitle)}</div>` : ""}
      </div>
    `

    if (sound) {
      playGameSound(sound)
    }

    setTimeout(() => {
      layer.classList.add("displayProLayerHide")

      setTimeout(() => {
        layer.className = "displayProLayer hidden"
        layer.innerHTML = ""
        resolve()
      }, 260)
    }, duration)
  })
}

async function showSegmentIntro(segmentKey) {
  if (shouldSkipRepeatedFx(`intro_${segmentKey}`, 1200)) return

  const title = getDisplaySegmentTitle(segmentKey)

  await showDisplayProOverlay({
    eyebrow: "الفقرة التالية",
    title,
    subtitle: "استعدوا",
    type: "segment",
    duration: 950,
    sound: "open"
  })
}

function getSegmentArabicTitle(segmentKey) {
  segmentKey = normalizeDisplaySegmentKey(segmentKey)

  const titles = {
  warmup: "التسخين",
  top10: "Top 10",
  letterli: "حرفلي",
  who: "من هو",
  explain: "اشرح الكلمة",
  finalRound1: "ٮدوں ٮڡاط",
  finalRound2: "صح صحلي",
  finalRound3: "قصة",
  finalRound4: "التركيز",
  archive: "الأرشيف",
  randomChallenge: "التحدي",
  final: "الفاصلة"
}

  return titles[segmentKey] || "الفقرة"
}

function getSegmentEndScores(segmentKey) {
  const fallback = typeof getRealSegmentScores === "function"
    ? getRealSegmentScores(segmentKey)
    : { A: 0, B: 0 }

  return {
    A: Number(window.currentSegmentScores?.A ?? fallback.A ?? 0),
    B: Number(window.currentSegmentScores?.B ?? fallback.B ?? 0)
  }
}

function closeSegmentEndOverlay() {
  document.getElementById("segmentEndOverlay")?.remove()
}

function showSegmentEndOverlay(segmentKey, winner) {
  return new Promise(resolve => {
    closeSegmentEndOverlay()

    const title = getSegmentArabicTitle(segmentKey)
    const scores = getSegmentEndScores(segmentKey)

    const isTie =
      !winner ||
      winner === "تعادل" ||
      Number(scores.A) === Number(scores.B)

    const winnerText = isTie ? "تعادل" : winner

    const overlay = document.createElement("div")
    overlay.id = "segmentEndOverlay"
    overlay.className = `segmentEndOverlay ${isTie ? "segmentEndTie" : ""}`

    overlay.innerHTML = `
      <section class="segmentEndCard">

        <div class="segmentEndTop">
          <span class="segmentEndBadge">منتهية</span>
          <span class="segmentEndMiniTitle">نهاية الفقرة</span>
        </div>

        <h2 class="segmentEndTitle">${escapeDisplayHtml(title)}</h2>

        <div class="segmentEndWinnerBox">
          <span>${isTie ? "النتيجة" : "الفائز"}</span>
          <strong>${escapeDisplayHtml(winnerText)}</strong>
        </div>

        <div class="segmentEndScoreBoard">

          <div class="segmentEndTeamScore teamA">
            <span>${escapeDisplayHtml(teamAName || "الفريق الأول")}</span>
            <b>${Number(scores.A || 0)}</b>
          </div>

          <div class="segmentEndVs">VS</div>

          <div class="segmentEndTeamScore teamB">
            <b>${Number(scores.B || 0)}</b>
            <span>${escapeDisplayHtml(teamBName || "الفريق الثاني")}</span>
          </div>

        </div>

        <div class="segmentEndActions">
          
        </div>

      </section>
    `

    document.body.appendChild(overlay)

    const finish = () => {
      closeSegmentEndOverlay()
      resolve()
    }

    document.getElementById("segmentEndHomeBtn")?.addEventListener("click", finish)
    document.getElementById("segmentEndCloseBtn")?.addEventListener("click", finish)

    setTimeout(() => {
      if (document.body.contains(overlay)) {
        finish()
      }
    }, 4200)
  })
}

window.showSegmentEndOverlay = showSegmentEndOverlay
window.closeSegmentEndOverlay = closeSegmentEndOverlay

function showAnswerResultOverlay(type = "correct", points = "") {
  const isCorrect = type === "correct"

  if (shouldSkipRepeatedFx(`answer_${type}_${points}`, 700)) return

  showDisplayProOverlay({
    eyebrow: isCorrect ? "إجابة صحيحة" : "إجابة خاطئة",
    title: isCorrect && points ? `+${points}` : (isCorrect ? "صح" : "خطأ"),
    subtitle: "",
    type: isCorrect ? "correct" : "wrong",
    duration: 780,
    sound: isCorrect ? "correct" : "wrong"
  })
}

function showDisplayCurrentTurn(team) {
  const old = document.getElementById("displayCurrentTurnBadge")
  if (old) old.remove()

  if (!team) return

  const teamName = team === "A" ? teamAName : team === "B" ? teamBName : team

  const badge = document.createElement("div")
  badge.id = "displayCurrentTurnBadge"
  badge.className = `displayCurrentTurnBadge team${team}`
  badge.innerHTML = `
    <span>الدور الآن</span>
    <strong>${escapeDisplayHtml(teamName)}</strong>
  `

  document.body.appendChild(badge)

  setTimeout(() => {
    badge.classList.add("hide")
    setTimeout(() => badge.remove(), 260)
  }, 2200)
}

function showLastScoreUpdate(team, points = 1) {
  const old = document.getElementById("displayLastScoreUpdate")
  if (old) old.remove()

  const teamName = team === "A" ? teamAName : team === "B" ? teamBName : team

  const box = document.createElement("div")
  box.id = "displayLastScoreUpdate"
  box.className = "displayLastScoreUpdate"
  box.innerHTML = `
    <span>آخر تحديث</span>
    <strong>${escapeDisplayHtml(teamName)} +${points}</strong>
  `

  document.body.appendChild(box)

  setTimeout(() => {
    box.classList.add("hide")
    setTimeout(() => box.remove(), 260)
  }, 2400)
}

function startEndButtonWatcher() {
  stopEndButtonWatcher()
  endButtonWatcher = setInterval(() => {
    updateEndRoundButtonState()
  }, 300)
}

function stopEndButtonWatcher() {
  if (endButtonWatcher) {
    clearInterval(endButtonWatcher)
    endButtonWatcher = null
  }
}

/* =========================
   New Session Reset
========================= */

const DISPLAY_SESSION_MARKER_KEY = "display_session_marker_v1"

function clearAllSegmentPlayStatesForNewSession() {
  localStorage.removeItem("active_segment")
  localStorage.removeItem("segment_status_v1")

  localStorage.removeItem("warmup_state_v1")
  localStorage.removeItem("top10_state_v1")
  localStorage.removeItem("letterli_state_v1")
  localStorage.removeItem("who_state_v1")
  localStorage.removeItem("explain_state_v1")

  localStorage.removeItem("final_state_v1")
  localStorage.removeItem("final_state_v2")
  localStorage.removeItem("final_state_v3")

  localStorage.removeItem("archive_state_v1")
  localStorage.removeItem(
    "random_challenge_state_v1"
  )

  segmentStatus = defaultSegmentStatus()

  window.usedQuestions = {}
  window.top10State = null
  window.letterliState = null
  window.whoState = null
  window.explainState = null
  window.finalState = null
  window.archiveState = null
  window.randomChallengeState = null
}

function resetDisplayStatesIfNewSession() {
  const sessionId = localStorage.getItem("game_session_id") || ""
  if (!sessionId) return

  const lastSessionId = localStorage.getItem(DISPLAY_SESSION_MARKER_KEY) || ""

  if (lastSessionId === sessionId) return

  clearAllSegmentPlayStatesForNewSession()
  localStorage.setItem(DISPLAY_SESSION_MARKER_KEY, sessionId)
}
async function restoreDisplayAfterRefresh() {
  const activeSegment = localStorage.getItem("active_segment")

  if (
    activeSegment &&
    isSegmentVisibleOnDisplay(activeSegment) &&
    !segmentStatus?.[activeSegment]?.locked
  ) {
    homeRefreshLocked = false
    await openSegmentPage(activeSegment)
    return
  }

  renderMainHome(true)
}

function observeDisplayMedia() {
  protectDisplayMedia(document)

  if (typeof enhanceDisplayMediaFrames === "function") {
    enhanceDisplayMediaFrames(document)
  }

  preloadDisplayMediaInRoot(document)
  applyDisplayMediaRevealFx(document)

  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (!(node instanceof HTMLElement)) return

        protectDisplayMedia(node)

        if (typeof enhanceDisplayMediaFrames === "function") {
          enhanceDisplayMediaFrames(node)
        }

        preloadDisplayMediaInRoot(node)
        applyDisplayMediaRevealFx(node)
      })
    })
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true
  })
}

function enhanceDisplayMediaFrames(root = document) {
  const scope = root || document

  const mediaSelectors = [
    ".whoImageFull",
    ".archiveModernBigCard img",
    ".archiveImageFrame img",
    ".finalRound1BigImage",
    ".finalRound3Image",
    ".finalRound3ImageStage img",
    "video"
  ]

  scope.querySelectorAll(mediaSelectors.join(",")).forEach(media => {
    if (media.dataset.displayEnhanced === "1") return

    media.dataset.displayEnhanced = "1"
    media.classList.add("displayUnifiedMedia")

    const parent = media.parentElement
    if (parent) {
      parent.classList.add("displayUnifiedMediaFrame")
    }

    if (media.tagName.toLowerCase() === "video") {
      media.classList.add("displayUnifiedVideo")
      media.setAttribute("playsinline", "true")
      media.setAttribute("controls", "true")
      media.setAttribute("preload", "metadata")
    }
  })
}

/* =========================
   DISPLAY MEDIA PRELOAD
   تحميل مسبق للصور والفيديو
========================= */

const displayPreloadedMedia = new Set()

function getDisplayMediaSrc(media) {
  if (!media) return ""

  if (media.tagName?.toLowerCase() === "img") {
    return media.currentSrc || media.src || ""
  }

  if (media.tagName?.toLowerCase() === "video") {
    return media.currentSrc || media.src || media.querySelector("source")?.src || ""
  }

  return ""
}

function preloadDisplayImage(src) {
  return new Promise(resolve => {
    if (!src || displayPreloadedMedia.has(src)) {
      resolve(false)
      return
    }

    const img = new Image()

    img.onload = () => {
      displayPreloadedMedia.add(src)
      resolve(true)
    }

    img.onerror = () => {
      resolve(false)
    }

    img.src = src
  })
}

function preloadDisplayVideo(src) {
  return new Promise(resolve => {
    if (!src || displayPreloadedMedia.has(src)) {
      resolve(false)
      return
    }

    const video = document.createElement("video")
    video.preload = "metadata"
    video.muted = true
    video.playsInline = true

    video.onloadedmetadata = () => {
      displayPreloadedMedia.add(src)
      resolve(true)
    }

    video.onerror = () => {
      resolve(false)
    }

    video.src = src
  })
}

async function preloadDisplayMediaInRoot(root = document) {
  const scope = root || document

  const images = Array.from(scope.querySelectorAll("img"))
    .map(img => getDisplayMediaSrc(img))
    .filter(Boolean)

  const videos = Array.from(scope.querySelectorAll("video"))
    .map(video => getDisplayMediaSrc(video))
    .filter(Boolean)

  const imageTasks = images.map(src => preloadDisplayImage(src))
  const videoTasks = videos.map(src => preloadDisplayVideo(src))

  await Promise.allSettled([
    ...imageTasks,
    ...videoTasks
  ])
}
/* =========================
   DISPLAY MEDIA REVEAL FX
   مؤثر ظهور الصور والفيديو
========================= */

function applyDisplayMediaRevealFx(root = document) {
  const scope = root || document

  const mediaList = scope.querySelectorAll(`
    img,
    video,
    .whoImageFull,
    .auctionBigImage,
    .finalRound1BigImage,
    .finalRound3Image
  `)

  mediaList.forEach(media => {
    if (media.dataset.revealFxDone === "1") return

    media.dataset.revealFxDone = "1"
    media.classList.remove("displayMediaRevealFx")

    void media.offsetWidth

    media.classList.add("displayMediaRevealFx")
  })
}

document.addEventListener("DOMContentLoaded", async () => {
  resetDisplayStatesIfNewSession()
  applyDisplayViewportSize()

  initWinnerSound()
  initGameSounds()
  bindAudioUnlock()

  observeDisplayMedia()
  restoreDisplayControlsEye()


  segmentStatus = loadSegmentStatus()

  renderVisibleSegmentsHome()
  updateSegmentCards()
  updateMainScoreBoard()
  updateLeadingTeamStyle()
  updateModelNameDisplay()

  await restoreDisplayAfterRefresh()

  setTimeout(async () => {
    try {
      await loadVisibleSegmentsForDisplay({
        staleWhileRevalidate: true
      })

      renderVisibleSegmentsHome()
      updateSegmentCards()
      updateModelNameDisplay()
    } catch (error) {
      console.log(
        "DISPLAY BACKGROUND LOAD ERROR:",
        error
      )
    }
  }, 0)
})
/* =========================
   Main Home
========================= */

function renderMainHome(force = false) {
  if (homeRefreshLocked && !force) return
  clearDisplayTemporaryFx()

  const homeScreen = getFirstElement(["homeScreen", "homePage"])
  const segmentScreen = getFirstElement(["segmentScreen"])
  const segmentArea = document.getElementById("segmentArea")

  document.body.classList.remove("segmentMode")

  if (homeScreen) homeScreen.classList.remove("hidden")
  if (segmentScreen) segmentScreen.classList.add("hidden")
  if (segmentArea) segmentArea.innerHTML = ""

  stopEndButtonWatcher()

  renderVisibleSegmentsHome()
  updateMainScoreBoard()
  updateSegmentCards()
  updateLeadingTeamStyle()
  updateModelNameDisplay()

playSoftEnter(homeScreen)
}

function updateMainScoreBoard() {
  setTextIfFound(["mainTeamNameA", "teamNameA"], teamAName)
  setTextIfFound(["mainTeamNameB", "teamNameB"], teamBName)

  setTextIfFound(["mainScoreA"], scoreA)
  setTextIfFound(["mainScoreB"], scoreB)

  const scoreAEl = getFirstElement(["mainScoreA"])
  const scoreBEl = getFirstElement(["mainScoreB"])

  if (scoreAEl) {
    if (scoreA === 6) scoreAEl.classList.add("maxScore")
    else scoreAEl.classList.remove("maxScore")
  }

  if (scoreBEl) {
    if (scoreB === 6) scoreBEl.classList.add("maxScore")
    else scoreBEl.classList.remove("maxScore")
  }
}

/* =========================
   Main Score Actions
========================= */

function increaseMainScore(team) {
  if (!canRunDisplayAction(`main_score_${team}`, 650)) {
    return
  }

  let addedTeam = null

  if (team === "A") {
    scoreA++
    if (scoreA > 6) scoreA = 0
    localStorage.setItem("main_score_a", scoreA)
    addedTeam = "A"
  }

  if (team === "B") {
    scoreB++
    if (scoreB > 6) scoreB = 0
    localStorage.setItem("main_score_b", scoreB)
    addedTeam = "B"
  }

  updateMainScoreBoard()
  updateLeadingTeamStyle()

  if (team === "A") bumpScore("mainScoreA")
  if (team === "B") bumpScore("mainScoreB")

  if (addedTeam) {
    showLastScoreUpdate(addedTeam, 1)
  }

  syncDisplayStateToSession()
}

function addMainScore(team) {
  increaseMainScore(team)
}

/* =========================
   Home Winner Overlay
========================= */

function announceMainWinner() {
  if (typeof showDetailedFinalResults === "function") {
    showDetailedFinalResults()
    return
  }

  let winner = ""

  if (scoreA > scoreB) winner = teamAName
  else if (scoreB > scoreA) winner = teamBName
  else winner = "تعادل"

  showWinnerOverlay(winner, { homeWinner: true })
}

function announceWinner() {
  if (typeof showDetailedFinalResults === "function") {
    showDetailedFinalResults()
    return
  }

  playWinnerEffects()
  homeRefreshLocked = false

  let winner = ""

  if (scoreA > scoreB) winner = teamAName
  else if (scoreB > scoreA) winner = teamBName
  else winner = "تعادل"

  showWinnerOverlay(winner, { homeWinner: true })
}



function showWinnerOverlay(name, options = {}) {
  const overlay = document.getElementById("winnerOverlay")
  const nameBox = document.getElementById("winnerOverlayName")
  const closeBtn = document.getElementById("winnerOverlayClose")
  const endBtn = document.getElementById("winnerOverlayEnd")

  const { homeWinner = false } = options

  if (nameBox) nameBox.innerText = name

  if (closeBtn) {
    if (homeWinner) closeBtn.classList.remove("hidden")
    else closeBtn.classList.add("hidden")
  }

  if (endBtn) {
    if (homeWinner) endBtn.classList.remove("hidden")
    else endBtn.classList.add("hidden")
  }

  if (overlay) overlay.classList.remove("hidden")
}

function closeWinnerOverlay() {
  const overlay = document.getElementById("winnerOverlay")
  if (overlay) overlay.classList.add("hidden")
  stopWinnerEffects()
}

async function endGameAndGoIntro() {
  stopWinnerEffects()

  const sessionId = localStorage.getItem("game_session_id")

  if (sessionId) {
    await db.from("game_sessions").update({
      status: "ended",
      active_segment: null,
      ended_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }).eq("id", sessionId)
  }

  localStorage.removeItem("main_score_a")
  localStorage.removeItem("main_score_b")
  localStorage.removeItem("game_model")
  localStorage.removeItem("game_model_name")
  localStorage.removeItem("active_segment")
  localStorage.removeItem("segment_status_v1")

  localStorage.removeItem("warmup_state_v1")
  localStorage.removeItem("top10_state_v1")
  localStorage.removeItem("letterli_state_v1")
  localStorage.removeItem("who_state_v1")
  localStorage.removeItem("explain_state_v1")
  localStorage.removeItem("final_state_v2")
  localStorage.removeItem("final_state_v3")
  localStorage.removeItem("archive_state_v1")
localStorage.removeItem("random_challenge_state_v1")

  localStorage.removeItem("game_session_id")
  localStorage.removeItem("game_join_code")
  localStorage.removeItem("display_session_marker_v1")

  const overlay = document.getElementById("winnerOverlay")
  if (overlay) overlay.classList.add("hidden")

  window.location.href = "intro.html"
}

/* =========================
   Segment Cards
========================= */

function getVisibleDisplaySegments() {
  return visibleDisplaySegments
    .filter(item => item.is_visible)
    .sort((a, b) => Number(a.sort_order || a.sort) - Number(b.sort_order || b.sort))
    .slice(0, 11)
}

function isSegmentVisibleOnDisplay(segmentKey) {
  const key = normalizeDisplaySegmentKey(segmentKey)

  if (key === "final") {
    return isAnyFinalVisibleOnDisplay()
  }

  return getVisibleDisplaySegments().some(item => {
    return normalizeDisplaySegmentKey(item.key) === key
  })
}

function getDisplaySegmentDomId(key) {
  key = normalizeDisplaySegmentKey(key)

  if (key === "warmup") return "segmentWarmup"
  if (key === "top10") return "segmentTop10"
  if (key === "letterli") return "segmentLetterli"
  if (key === "who") return "segmentWho"
  if (key === "explain") return "segmentExplain"

  if (key === "finalRound1") return "segment_finalRound1"
  if (key === "finalRound2") return "segment_finalRound2"
  if (key === "finalRound3") return "segment_finalRound3"
  if (key === "finalRound4") return "segment_finalRound4"

  if (key === "final") return "segmentFinal"
  if (key === "archive") return "segmentArchive"
  if (key === "randomChallenge") return "segmentRandomChallenge"

  return `segment_${key}`
}

function getDisplayWinnerDomId(key) {
  key = normalizeDisplaySegmentKey(key)

  if (key === "warmup") return "winnerWarmup"
  if (key === "top10") return "winnerTop10"
  if (key === "letterli") return "winnerLetterli"
  if (key === "who") return "winnerWho"
  if (key === "explain") return "winnerExplain"

  if (key === "finalRound1") return "winner_finalRound1"
  if (key === "finalRound2") return "winner_finalRound2"
  if (key === "finalRound3") return "winner_finalRound3"
  if (key === "finalRound4") return "winner_finalRound4"

  if (key === "final") return "winnerFinal"
  if (key === "archive") return "winnerArchive"
  if (key === "randomChallenge") return "winnerRandomChallenge"

  return `winner_${key}`
}

function renderVisibleSegmentsHome() {
  const grid = document.getElementById("segmentsGrid")
  if (!grid) return

  const segments = getVisibleDisplaySegments()

  grid.innerHTML = segments.map(item => {
    const key = normalizeDisplaySegmentKey(item.key)
    const cardId = getDisplaySegmentDomId(key)
    const winnerId = getDisplayWinnerDomId(key)

    return `
      <div
        class="segmentCard homeSegmentItem"
        id="${cardId}"
        onclick="openMainSegment('${key}')"
      >
        <div class="homeSegmentContent">
          <span>${escapeDisplayHtml(item.title)}</span>
          <div class="segmentWinner homeSegmentWinner" id="${winnerId}"></div>
        </div>
      </div>
    `
  }).join("")

  applySegmentsGridCount()
}

function applySegmentsGridCount() {
  const grid = document.getElementById("segmentsGrid")
  if (!grid) return

  const count = grid.querySelectorAll(".homeSegmentItem").length

  grid.classList.toggle("segmentsMoreThan6", count > 6)
  grid.classList.toggle("segmentsSixOrLess", count <= 6)
}

function updateSegmentCards() {
  ALL_DISPLAY_SEGMENTS.forEach(item => {
    setSegmentWinnerLabel(item.key)
  })

  applySegmentsGridCount()
}

function setSegmentWinnerLabel(key) {
  key = normalizeDisplaySegmentKey(key)

  const labelIds = getSegmentWinnerLabelIds(key)
  const cardIds = getSegmentCardIds(key)

  const label = getFirstElement(labelIds)
  const card = getFirstElement(cardIds)

  const status = segmentStatus[key] || {
    locked: false,
    winner: "",
    scoreA: 0,
    scoreB: 0
  }

  if (label) {
    label.innerText = status.winner ? status.winner : ""
  }

  if (card) {
    if (status.locked) {
      card.classList.add("segmentLocked", "hasWinner", "segmentDone")
    } else {
      card.classList.remove("segmentLocked", "hasWinner", "segmentDone")
    }
  }
}
/* =========================
   Open Segment
========================= */

async function openSegmentPage(segmentKey, forcedRound = null) {
  segmentKey = normalizeDisplaySegmentKey(segmentKey)

  const isFinalInternalSegment = segmentKey === "final"
  const isFinalCardSegment =
    segmentKey === "finalRound1" ||
    segmentKey === "finalRound2" ||
    segmentKey === "finalRound3" ||
    segmentKey === "finalRound4"

  const isFinalAny = isFinalInternalSegment || isFinalCardSegment

  if (!canRunDisplayAction(`open_segment_${segmentKey}`, 900)) {
    return
  }

  clearDisplayTemporaryFx()

if (!displayModelDataLoaded) {
  await loadVisibleSegmentsForDisplay({
    staleWhileRevalidate: true
  })
}

  if (!isFinalAny && !isSegmentVisibleOnDisplay(segmentKey)) {
    showGameToast("هذه الفقرة غير مفعلة في العرض")
    renderVisibleSegmentsHome()
    updateSegmentCards()
    return
  }
  if (isFinalAny) {
  const targetFinalKey = getFinalSegmentKeyFromRound(
    Number(forcedRound || getFinalRoundFromSegmentKey(segmentKey) || 1)
  )

  if (!isSegmentVisibleOnDisplay(targetFinalKey)) {
    showGameToast("هذه الفقرة غير مفعلة في العرض")
    renderVisibleSegmentsHome()
    updateSegmentCards()
    return
  }
}

  let finalRound = 0
  let lockKey = segmentKey

  if (isFinalAny) {
    finalRound =
      Number(forcedRound || 0) ||
      Number(getFinalRoundFromSegmentKey(segmentKey) || 0) ||
      Number(window.displayFinalRound || 0) ||
      Number(window.currentFinalRound || 0) ||
      1

    window.displayFinalRound = finalRound
    window.currentFinalRound = finalRound

    lockKey = getFinalSegmentKeyFromRound(finalRound)
  }

  lockKey = normalizeDisplaySegmentKey(lockKey)

  if (segmentStatus[lockKey]?.locked) return

  displayProFxLock = false

  await loadDisplayCountForSegment(lockKey)

  homeRefreshLocked = true
  localStorage.setItem("active_segment", isFinalAny ? lockKey : segmentKey)

  const homeScreen = getFirstElement(["homeScreen", "homePage"])
  const segmentScreen = getFirstElement(["segmentScreen"])

  document.body.classList.add("segmentMode")

  await showSegmentIntro(lockKey)

  if (homeScreen) homeScreen.classList.add("hidden")
  if (segmentScreen) segmentScreen.classList.remove("hidden")

  showDisplayLoading("جاري تجهيز الفقرة...")

  try {
    if (segmentKey === "warmup") await window.renderWarmup()
    if (segmentKey === "top10") await window.renderTop10()
    if (segmentKey === "letterli") {
  if (typeof window.openLetterliSegment !== "function") {
    throw new Error("openLetterliSegment is not loaded")
  }

  await window.openLetterliSegment()
}
    if (segmentKey === "who") await window.renderWho()
    if (segmentKey === "explain") await window.renderExplain()
    if (segmentKey === "archive") await window.renderArchive()
          if (segmentKey === "randomChallenge") await window.renderRandomChallenge()

    if (isFinalAny) {
      if (typeof window.renderFinal !== "function") {
        showGameToast("ملف الفاصلة غير محمّل")
        return
      }

      localStorage.setItem("active_segment", lockKey)
      await window.renderFinal(finalRound, lockKey)
    }

    const mediaRoot = document.getElementById("segmentArea") || document

    if (typeof protectDisplayMedia === "function") protectDisplayMedia(mediaRoot)
    if (typeof enhanceDisplayMediaFrames === "function") enhanceDisplayMediaFrames(mediaRoot)
    if (typeof preloadDisplayMediaInRoot === "function") await preloadDisplayMediaInRoot(mediaRoot)
    if (typeof applyDisplayMediaRevealFx === "function") applyDisplayMediaRevealFx(mediaRoot)

  } catch (e) {
    console.log("DISPLAY SEGMENT RENDER ERROR:", e)
    showGameToast("تعذر تجهيز الفقرة")
  } finally {
    hideDisplayLoading()
    displayProFxLock = false
  }

  const segmentArea = document.getElementById("segmentArea")
  if (segmentArea) {
    segmentArea.classList.remove("displaySegmentEnterFx")
    void segmentArea.offsetWidth
    segmentArea.classList.add("displaySegmentEnterFx")
  }

  if (typeof syncDisplayStateToSession === "function") {
    syncDisplayStateToSession()
  }
  applyPresenterHideDisplayControlsState()
}

function openMainSegment(segmentKey) {
  segmentKey = normalizeDisplaySegmentKey(segmentKey)

  if (isFinalSegmentKey(segmentKey) && segmentKey !== "final") {
    const round = getFinalRoundFromSegmentKey(segmentKey)
    openSegmentPage(segmentKey, round)
    return
  }

  openSegmentPage(segmentKey)
}

function openMaToSegment(segmentKey) {
  openMainSegment(segmentKey)
}

function openSegment(title, content) {
  const area = document.getElementById("segmentArea")
  if (!area) return

  area.innerHTML = `
    <div class="segmentContentWrap">
      ${content}
    </div>
  `

  syncDisplayStateToSession()
  updateEndRoundButtonState()
  startEndButtonWatcher()
}

function stopAllDisplaySegmentTimers() {
  clearInterval(timer)
  timer = null

  if (
    typeof warmupTimer !== "undefined"
  ) {
    clearInterval(warmupTimer)
    warmupTimer = null
  }

  if (
    typeof top10Timer !== "undefined"
  ) {
    clearInterval(top10Timer)
    top10Timer = null
  }

  if (
    typeof stopLetterliCountdown ===
    "function"
  ) {
    stopLetterliCountdown(false)
  }

  if (
    typeof whoTimer !== "undefined"
  ) {
    clearInterval(whoTimer)
    whoTimer = null
  }

  if (
    typeof resetExplainTimer ===
    "function"
  ) {
    resetExplainTimer()
  }

  if (
    typeof resetWhoRevealTimeout ===
    "function"
  ) {
    resetWhoRevealTimeout()
  }
}

function goHome() {
  clearDisplayTemporaryFx()

  stopAllDisplaySegmentTimers()
  window.currentSegmentScores = null

  localStorage.removeItem("active_segment")
  clearGameActiveTeam()

  homeRefreshLocked = false

  syncDisplayStateToSession()

  stopEndButtonWatcher()

  const content = document.querySelector(".segmentContentWrap")

  playSoftExit(content, () => {
    renderMainHome(true)
    syncDisplayStateToSession()
  })
}

function updateEndRoundButtonState() {
  const btn = document.getElementById("endRoundBtn")
  if (!btn) return

  const key = getCurrentSegmentKey()
  if (!key) {
    btn.disabled = true
    btn.innerText = "إنهاء"
    btn.classList.add("disabledEndBtn")
    return
  }

  const canEnd = canEndSegment(key)

  if (!canEnd) {
    btn.disabled = true
    btn.innerText = "إنهاء"
    btn.classList.add("disabledEndBtn")
    return
  }

  btn.disabled = false
  btn.innerText = "إنهاء"
  btn.classList.remove("disabledEndBtn")
}

/* =========================
   Teams / Answers
========================= */

function selectTeam(team) {
  selectedTeam = team

  unlockAudioContext()

  const a = document.getElementById("teamABox")
  const b = document.getElementById("teamBBox")

  if (a) a.classList.remove("activeTeam")
  if (b) b.classList.remove("activeTeam")

  if (team === "A" && a) a.classList.add("activeTeam")
  if (team === "B" && b) b.classList.add("activeTeam")

  if (team === "A" || team === "B") {
    setGameActiveTeam(team)
  }

  showDisplayCurrentTurn(team)
}

function correctAnswer() {
  unlockAudioContext()

  if (!canRunDisplayAction(`correct_${getDisplayActiveSegmentKey()}`, 900)) {
    return
  }

  if (!selectedTeam) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  let addedTeam = null

  if (selectedTeam === "A") {
    scoreA++
    if (scoreA > 6) scoreA = 0
    localStorage.setItem("main_score_a", scoreA)
    addedTeam = "A"
    bumpScore("mainScoreA")
  }

  if (selectedTeam === "B") {
    scoreB++
    if (scoreB > 6) scoreB = 0
    localStorage.setItem("main_score_b", scoreB)
    addedTeam = "B"
    bumpScore("mainScoreB")
  }

  updateMainScoreBoard()
  updateLeadingTeamStyle()
  syncDisplayStateToSession()

  if (addedTeam) {
    showLastScoreUpdate(addedTeam, 1)
  }

  flashScreen("correct")
}

function startQuestion(points) {
  unlockAudioContext()

  let time = 15
  if (points == 2) time = 25
  if (points == 3) time = 30
  if (points == 4) time = 40
  if (points == 5) time = 50

  const timerBox = document.getElementById("timer")
  if (!timerBox) return

  clearInterval(timer)
  timer = null

  currentPoints = Number(points || 0)
  timeLeft = time

  let lastTickPlayed = null

  timerBox.innerText = time
  timerBox.classList.remove("timerDanger", "timerTimeoutFx")

  timer = setInterval(() => {
    time--
    timeLeft = time
    timerBox.innerText = time

    timerBox.classList.toggle("timerDanger", time > 0 && time <= 5)

    if (time > 0 && time <= 5 && lastTickPlayed !== time) {
      lastTickPlayed = time
      playGameSound("tick")
    }

    if (time <= 0) {
      clearInterval(timer)
      timer = null
      timeLeft = 0

      timerBox.innerText = 0
      timerBox.classList.remove("timerDanger")
      timerBox.classList.add("timerTimeoutFx")

      playGameSound("timeout")
      flashTimerTimeout()

      setTimeout(() => {
        timerBox.classList.remove("timerTimeoutFx")
      }, 1200)
    }
  }, 1000)
}

/* =========================
   Finish Segment
========================= */

async function endCurrentSegment() {
    if (!canRunDisplayAction("end_current_segment", 1600)) {
    return
  }
  const key = getCurrentSegmentKey()
  if (!key) return

  if (!canEndSegment(key)) {
    showGameToast("لا يمكن إنهاء الفقرة قبل إكمالها")
    updateEndRoundButtonState()
    return
  }

  if (displayProFxLock) return
  displayProFxLock = true

  const winner = getWinnerFromSegmentScores(key)

const fallbackSegmentScores = getRealSegmentScores(key)

const finishedSegmentScores = {
  A: Number(window.currentSegmentScores?.A ?? fallbackSegmentScores.A ?? 0),
  B: Number(window.currentSegmentScores?.B ?? fallbackSegmentScores.B ?? 0)
}

if (winner === teamAName) {
    scoreA++
    localStorage.setItem("main_score_a", scoreA)
    updateMainScoreBoard()
    bumpScore("mainScoreA")
    showLastScoreUpdate("A", 1)
  }

  if (winner === teamBName) {
    scoreB++
    localStorage.setItem("main_score_b", scoreB)
    updateMainScoreBoard()
    bumpScore("mainScoreB")
    showLastScoreUpdate("B", 1)
  }

  updateLeadingTeamStyle()
  syncDisplayStateToSession()

  if (!segmentStatus[key]) {
  segmentStatus[key] = {
    locked: false,
    winner: "",
    scoreA: 0,
    scoreB: 0
  }
}

segmentStatus[key].locked = true
segmentStatus[key].winner = winner
segmentStatus[key].scoreA = finishedSegmentScores.A
segmentStatus[key].scoreB = finishedSegmentScores.B

clearGameActiveTeam()

saveSegmentStatus()
updateSegmentCards()

  stopAllDisplaySegmentTimers()

  localStorage.removeItem("active_segment")
  syncDisplayStateToSession()

  await showSegmentEndOverlay(key, winner)

  displayProFxLock = false

  goHome()
}

function endSegment() {
  return endCurrentSegment()
}

function finishSegment() {
  return endCurrentSegment()
}

function closeSegment() {
  return endCurrentSegment()
}

window.endCurrentSegment = endCurrentSegment
window.endSegment = endSegment
window.finishSegment = finishSegment
window.closeSegment = closeSegment

function getCurrentSegmentKey() {
  const active =
    normalizeDisplaySegmentKey(
      localStorage.getItem(
        "active_segment"
      )
    )

  if (active) {
    return active
  }

  const segmentRoot =
    document.querySelector(
      "[data-segment-key]"
    ) ||
    document.querySelector(
      ".warmupWrap"
    ) ||
    document.querySelector(
      ".top10Wrap"
    ) ||
    document.querySelector(
      ".letterliWrap"
    ) ||
    document.querySelector(
      ".whoWrap"
    ) ||
    document.querySelector(
      ".explainWrap"
    ) ||
    document.querySelector(
      ".finalWrapNew"
    ) ||
    document.querySelector(
      ".archiveWrap"
    ) ||
    document.querySelector(
      ".randomChallengeWrap"
    )

  if (!segmentRoot) {
    return null
  }

  if (
    segmentRoot.dataset?.segmentKey
  ) {
    return normalizeDisplaySegmentKey(
      segmentRoot.dataset.segmentKey
    )
  }

  if (
    segmentRoot.classList.contains(
      "warmupWrap"
    )
  ) {
    return "warmup"
  }

  if (
    segmentRoot.classList.contains(
      "top10Wrap"
    )
  ) {
    return "top10"
  }

  if (
    segmentRoot.classList.contains(
      "letterliWrap"
    )
  ) {
    return "letterli"
  }

  if (
    segmentRoot.classList.contains(
      "whoWrap"
    )
  ) {
    return "who"
  }

  if (
    segmentRoot.classList.contains(
      "explainWrap"
    )
  ) {
    return "explain"
  }

  if (
    segmentRoot.classList.contains(
      "archiveWrap"
    )
  ) {
    return "archive"
  }

  if (
    segmentRoot.classList.contains(
      "randomChallengeWrap"
    )
  ) {
    return "randomChallenge"
  }

  if (
    segmentRoot.classList.contains(
      "finalWrapNew"
    )
  ) {
    return normalizeDisplaySegmentKey(
      localStorage.getItem(
        "active_segment"
      ) ||
      "finalRound1"
    )
  }

  return null
}

function getSafeSegmentNumber(value, fallback, max) {
  return Math.min(
    Math.max(Number(value || fallback), 1),
    max
  )
}

function isDisplaySegmentBusyBeforeEnd(segmentKey) {
  segmentKey = normalizeDisplaySegmentKey(segmentKey)

  if (segmentKey === "warmup") {
    return !!(
      window.warmupQuestionLocked ||
      typeof warmupQuestionLocked !== "undefined" && warmupQuestionLocked
    )
  }

  if (segmentKey === "top10") {
    return !!(
      window.top10State?.pendingScore ||
      window.top10State?.currentNumber ||
      window.top10State?.currentQuestion
    )
  }

  if (segmentKey === "letterli") {
  const state =
    window.letterliState ||
    getSafeJson(
      "letterli_state_v1"
    ) ||
    {}

  return !!(
    state.spinning ||
    state.timerRunning ||
    state.currentQuestionIndex !==
      null
  )
}

  if (segmentKey === "auction") {
    return !!(
      window.auctionState?.pendingScore ||
      window.auctionState?.currentNumber
    )
  }

  if (segmentKey === "who") {
  return !!(
    window.whoState?.pendingScore ||
    window.whoCurrentNumber ||
    (
      typeof whoCurrentNumber !==
        "undefined" &&
      whoCurrentNumber
    ) ||
    (
      typeof whoQuestionLocked !==
        "undefined" &&
      whoQuestionLocked
    )
  )
}

  if (segmentKey === "explain") {
    return !!(
      window.explainState?.pendingScore ||
      window.explainState?.currentNumber ||
      window.explainState?.activeWord
    )
  }

  if (segmentKey === "finalRound1") {
    return !!(
      window.finalState?.round1?.pendingScore ||
      window.finalState?.round1?.currentNumber
    )
  }

  if (segmentKey === "finalRound2") {
    return !!window.finalState?.round2?.pendingScore
  }

  if (segmentKey === "finalRound3") {
    return !!(
      window.finalState?.round3?.pendingScore ||
      window.finalState?.round3?.currentNumber
    )
  }

  if (segmentKey === "finalRound4") {
    return !!(
      window.finalState?.round4?.pendingScore ||
      window.finalState?.round4?.currentNumber ||
      window.finalState?.round4?.teamMedia?.currentNumber
    )
  }
if (segmentKey === "randomChallenge") {
  const state = window.randomChallengeState || getSafeJson("random_challenge_state_v1")

  return !!(
    state?.pendingScore ||
    state?.currentBox
  )
}

  return false
}

function getLetterliDisplayState() {
  return (
    window.letterliState ||
    getSafeJson(
      "letterli_state_v1"
    ) ||
    {}
  )
}

function getLetterliDisplayScores() {
  const state =
    getLetterliDisplayState()

  return {
    A: Number(
      state.scoreA ??
      state.scores?.A ??
      state.teamScores?.A ??
      0
    ),

    B: Number(
      state.scoreB ??
      state.scores?.B ??
      state.teamScores?.B ??
      0
    )
  }
}

function getLetterliCompletedCount() {
  const state =
    getLetterliDisplayState()

  const possibleArrays = [
    state.completedQuestions,
    state.usedQuestionKeys,
    state.usedQuestions,
    state.answeredQuestions
  ]

  const completedArray =
    possibleArrays.find(
      value => Array.isArray(value)
    )

  if (completedArray) {
    return completedArray.length
  }

  return Number(
    state.completedCount ||
    state.answeredCount ||
    0
  )
}

function canEndLetterliSegment() {
  const state =
    getLetterliDisplayState()

  const scores =
    getLetterliDisplayScores()

  const completedCount =
    getLetterliCompletedCount()

  const hasPlayed =
    completedCount > 0 ||
    scores.A > 0 ||
    scores.B > 0

  return !!(
    hasPlayed &&
    !state.spinning &&
    !state.timerRunning &&
    !state.answerVisible
  )
}


function canEndSegment(segmentKey) {
    segmentKey = normalizeDisplaySegmentKey(segmentKey)

    if (isDisplaySegmentBusyBeforeEnd(segmentKey)) {
  return false
}

  if (segmentKey === "warmup") {
  if (!window.usedQuestions) return false
  if (warmupQuestionLocked) return false

  return Object.keys(window.usedQuestions).length >= 12
}

  if (segmentKey === "top10") {
    if (!window.top10State) return false

    const maxRound = getSafeSegmentNumber(
      window.top10MaxRound || localStorage.getItem("top10_max_round"),
      3,
      4
    )

    for (let r = 1; r <= maxRound; r++) {
      const opened = window.top10State.opened?.[r] || []
      if (opened.length < 10) return false
    }

    return Number(window.top10State.round || 1) >= maxRound
  }

  if (segmentKey === "letterli") {
  const state =
    window.letterliState ||
    getSafeJson(
      "letterli_state_v1"
    )

  if (!state) {
    return false
  }

  return (
    Number(
      state.completedCount || 0
    ) > 0 &&
    !state.spinning &&
    !state.timerRunning &&
    state.currentQuestionIndex ===
      null
  )
}

  if (segmentKey === "auction") {
    if (!window.auctionState) return false

    const maxNumber = getSafeSegmentNumber(
      window.auctionMaxNumber || localStorage.getItem("auction_max_number"),
      8,
      8
    )

    return (window.auctionState.usedNumbers || []).length >= maxNumber
  }

  if (segmentKey === "who") {
    if (!window.whoState) return false

    const maxWhoNumber = getSafeSegmentNumber(
      window.whoMaxNumber || localStorage.getItem("who_max_number"),
      15,
      15
    )

    return (window.whoState.usedNumbers || []).length >= maxWhoNumber
  }

  if (segmentKey === "explain") {
    if (!window.explainState) return false

    const total = getSafeSegmentNumber(
      window.explainState.wordsCount ||
      window.explainWordsCount ||
      localStorage.getItem("explain_words_count"),
      4,
      8
    )

    return (window.explainState.usedNumbers || []).length >= total
  }

  if (segmentKey === "finalRound1") {
    if (!window.finalState) return false

    const r1Count = getSafeSegmentNumber(
      window.finalState.round1?.cardsCount ||
      window.finalRound1CardsCount ||
      localStorage.getItem("final_round1_cards_count"),
      6,
      8
    )

    return (window.finalState.round1?.opened || []).length >= r1Count
  }

  if (segmentKey === "finalRound2") {
  if (!window.finalState) return false

  return (
    (window.finalState.round2?.opened || []).length >= 6 &&
    (window.finalState.round2?.scoredNumbers || []).length >= 6
  )
}

if (segmentKey === "finalRound3") {
  if (!window.finalState) return false

  const total = getSafeSegmentNumber(
    window.finalState.round3?.cardsCount ||
    window.finalRound3Count ||
    localStorage.getItem("final_round3_count"),
    4,
    8
  )

  return (
    (window.finalState.round3?.opened || []).length >= total &&
    (window.finalState.round3?.scoredNumbers || []).length >= total
  )
}

if (segmentKey === "finalRound4") {
  if (!window.finalState) return false

  const total = getSafeSegmentNumber(
    window.finalState.round4?.teamMedia?.count ||
    window.finalRound4Count ||
    localStorage.getItem("final_round4_count"),
    4,
    8
  )

  return (
    (window.finalState.round4?.teamMedia?.usedNumbers || []).length >= total &&
    (window.finalState.round4?.scoredNumbers || []).length >= total
  )
}

if (segmentKey === "final") {
  if (!window.finalState) return false

  const r1Count = getSafeSegmentNumber(
    window.finalState.round1?.cardsCount ||
    window.finalRound1CardsCount ||
    localStorage.getItem("final_round1_cards_count"),
    6,
    8
  )

  const r3Count = getSafeSegmentNumber(
    window.finalState.round3?.cardsCount ||
    window.finalRound3Count ||
    localStorage.getItem("final_round3_count"),
    4,
    8
  )

  const r4Count = getSafeSegmentNumber(
    window.finalState.round4?.teamMedia?.count ||
    window.finalRound4Count ||
    localStorage.getItem("final_round4_count"),
    4,
    8
  )

  const r1Done =
    (window.finalState.round1?.opened || []).length >= r1Count

  const r2Done =
    (window.finalState.round2?.opened || []).length >= 6 &&
    (window.finalState.round2?.scoredNumbers || []).length >= 6

  const r3Done =
    (window.finalState.round3?.opened || []).length >= r3Count &&
    (window.finalState.round3?.scoredNumbers || []).length >= r3Count

  const r4Done =
    (window.finalState.round4?.teamMedia?.usedNumbers || []).length >= r4Count &&
    (window.finalState.round4?.scoredNumbers || []).length >= r4Count

  return r1Done && r2Done && r3Done && r4Done
}

  if (segmentKey === "archive") {
    if (!window.archiveState) return false

    const maxRound = getSafeSegmentNumber(
      window.archiveMaxRound || localStorage.getItem("archive_max_round"),
      4,
      4
    )

    for (let r = 1; r <= maxRound; r++) {
      const roundCache = window.archiveRoundCache?.[r]
      const items = roundCache?.items || []

      if (!items.length) return false

      const finished = items.every(item => {
        return !!window.archiveRevealState?.[r]?.[item.position]
      })

      if (!finished) return false
    }

    return Number(window.archiveState.round || 1) >= maxRound
  }
if (segmentKey === "randomChallenge") {
  const state = window.randomChallengeState || getSafeJson("random_challenge_state_v1")
  if (!state) return false

  const hasFinishedBox =
    !!state.box1?.finished ||
    !!state.box2?.finished ||
    !!state.box3?.finished ||
    !!state.box4?.finished

  const hasScores =
    Number(state.scores?.A || 0) > 0 ||
    Number(state.scores?.B || 0) > 0

  return hasFinishedBox || hasScores
}

  return false
}
/* =========================
   Leading Team Style
========================= */

function updateLeadingTeamStyle() {
  const teamABox =
    getFirstElement(["teamNameA"])?.closest(".teamBox") ||
    document.querySelectorAll(".teamBox")[0]

  const teamBBox =
    getFirstElement(["teamNameB"])?.closest(".teamBox") ||
    document.querySelectorAll(".teamBox")[1]

  if (!teamABox || !teamBBox) return

  teamABox.classList.remove("leadingTeam", "tieTeam")
  teamBBox.classList.remove("leadingTeam", "tieTeam")

  if (scoreA > scoreB) {
    teamABox.classList.add("leadingTeam")
  } else if (scoreB > scoreA) {
    teamBBox.classList.add("leadingTeam")
  } else {
    teamABox.classList.add("tieTeam")
    teamBBox.classList.add("tieTeam")
  }
}

function getWinnerFromSegmentScores(segmentKey = null) {
  const key = normalizeDisplaySegmentKey(segmentKey || getCurrentSegmentKey() || "")
  const fallbackScores = key ? getRealSegmentScores(key) : { A: 0, B: 0 }

  const a = Number(window.currentSegmentScores?.A ?? fallbackScores.A ?? 0)
  const b = Number(window.currentSegmentScores?.B ?? fallbackScores.B ?? 0)

  if (a > b) return teamAName
  if (b > a) return teamBName

  return "تعادل"
}

/* =========================
   Toast Notification
========================= */

function showGameToast(message) {
  window.lastDisplayToast = {
    text: message,
    time: Date.now()
  }

  if (typeof syncDisplayStateToSession === "function") {
    syncDisplayStateToSession()
  }

  const toast = document.getElementById("gameToast")
  const text = document.getElementById("gameToastText")

  if (!toast || !text) return

  text.innerText = message

  toast.classList.remove("hidden")
  toast.classList.remove("show")

  requestAnimationFrame(() => {
    toast.classList.add("show")
  })

  clearTimeout(gameToastTimer)

  gameToastTimer = setTimeout(() => {
    toast.classList.remove("show")

    setTimeout(() => {
      toast.classList.add("hidden")
      text.innerText = ""
    }, 280)
  }, 5000)
}
/* =========================
   Score bump helper
========================= */

function bumpScore(id) {
  const el = document.getElementById(id)
  if (!el) return

  el.classList.remove("score-bump")
  void el.offsetWidth
  el.classList.add("score-bump")
}

var screenFlashLayer = null

function ensureScreenFlashLayer() {
  if (
    screenFlashLayer &&
    document.body.contains(screenFlashLayer)
  ) {
    document.body.appendChild(screenFlashLayer)
    return screenFlashLayer
  }

  screenFlashLayer = document.createElement("div")
  screenFlashLayer.className = "screenFlashLayer"

  document.body.appendChild(screenFlashLayer)

  return screenFlashLayer
}

function flashScreen(type = "correct") {
  const layer = ensureScreenFlashLayer()

  layer.classList.remove(
    "flashCorrect",
    "flashWrong",
    "flashWrongStrong",
    "flashCorrectPro",
    "flashWrongPro",
    "flashTimeoutPro"
  )

  void layer.offsetWidth

  if (type === "wrong") {
    layer.classList.add("flashWrongPro")
  } else {
    layer.classList.add("flashCorrectPro")
  }

  setTimeout(() => {
    layer.classList.remove(
      "flashCorrect",
      "flashWrong",
      "flashWrongStrong",
      "flashCorrectPro",
      "flashWrongPro",
      "flashTimeoutPro"
    )
  }, 860)
}

function flashTimerTimeout() {
  const layer = ensureScreenFlashLayer()

  layer.classList.remove(
    "flashCorrect",
    "flashWrong",
    "flashWrongStrong",
    "flashCorrectPro",
    "flashWrongPro",
    "flashTimeoutPro"
  )

  void layer.offsetWidth

  layer.classList.add("flashTimeoutPro")

  setTimeout(() => {
    layer.classList.remove("flashTimeoutPro")
  }, 900)
}

function clearDisplayTemporaryFx() {
  const idsToRemove = [
    "displayCurrentTurnBadge",
    "displayLastScoreUpdate",
    "displayImageZoomOverlay",
    "auctionImageOverlay",
    "auctionVideoFullscreenOverlay",
    "displayReadyHint",
    "displayLoadingLayer",
    "whoImageOverlay",
    "whoZoomFlashLayer"
  ]

  idsToRemove.forEach(id => {
    const el = document.getElementById(id)

    if (el) {
      el.remove()
    }
  })

  const proLayer =
    document.getElementById("displayProLayer")

  if (proLayer) {
    proLayer.className =
      "displayProLayer hidden"

    proLayer.innerHTML = ""
  }

  const toast =
    document.getElementById("gameToast")

  const toastText =
    document.getElementById("gameToastText")

  if (toast) {
    toast.classList.remove("show")
    toast.classList.add("hidden")
  }

  if (toastText) {
    toastText.innerText = ""
  }

  if (screenFlashLayer) {
    screenFlashLayer.classList.remove(
      "flashCorrect",
      "flashWrong",
      "flashWrongStrong",
      "flashCorrectPro",
      "flashWrongPro",
      "flashTimeoutPro"
    )
  }

  document.body.classList.remove(
    "auctionOverlayActive",
    "whoOverlayActive"
  )

  document
    .querySelectorAll(
      ".timerDanger, .timerTimeoutFx, .displaySegmentEnterFx"
    )
    .forEach(el => {
      el.classList.remove(
        "timerDanger",
        "timerTimeoutFx",
        "displaySegmentEnterFx"
      )
    })
}
/* =========================
   DISPLAY LOADING STATE
   شاشة تحميل خفيفة عند فتح الفقرات
========================= */

function showDisplayLoading(text = "جاري تجهيز الفقرة...") {
  let layer = document.getElementById("displayLoadingLayer")

  if (!layer) {
    layer = document.createElement("div")
    layer.id = "displayLoadingLayer"
    layer.className = "displayLoadingLayer"
    document.body.appendChild(layer)
  }

  layer.innerHTML = `
    <div class="displayLoadingCard">
      <div class="displayLoadingSpinner"></div>
      <div class="displayLoadingText">${escapeDisplayHtml(text)}</div>
    </div>
  `

  layer.classList.remove("hidden")
}

function hideDisplayLoading() {
  const layer = document.getElementById("displayLoadingLayer")
  if (!layer) return

  layer.classList.add("hidden")
  layer.innerHTML = ""
}

function closeCurrentDisplayImageZoom() {
  const displayOverlay = document.getElementById("displayImageZoomOverlay")
  if (displayOverlay) displayOverlay.remove()

  const auctionOverlay = document.getElementById("auctionImageOverlay")
  if (auctionOverlay) auctionOverlay.remove()

  const videoOverlay = document.getElementById("auctionVideoFullscreenOverlay")
  if (videoOverlay && typeof closeAuctionVideoFullscreen === "function") {
    closeAuctionVideoFullscreen()
  }

  document.body.classList.remove("auctionOverlayActive")
}

function zoomCurrentDisplayImage() {
  const openedDisplayOverlay = document.getElementById("displayImageZoomOverlay")
  const openedAuctionOverlay = document.getElementById("auctionImageOverlay")

  if (openedDisplayOverlay || openedAuctionOverlay) {
    closeCurrentDisplayImageZoom()
    return
  }

  const img =
    document.querySelector(".auctionBigImage") ||
    document.querySelector(".auctionImageFrame img") ||
    document.querySelector(".auctionQuestionBox img") ||
    document.querySelector(".auctionResultImage") ||
    document.querySelector(".whoImageFull") ||
    document.querySelector(".finalRound1BigImage") ||
    document.querySelector(".finalRound3Image") ||
    document.querySelector(".archiveModernBigCard.revealed img")

  if (!img || !img.src) {
    showGameToast("لا توجد صورة للتكبير")
    return
  }

  const overlay = document.createElement("div")
  overlay.id = "displayImageZoomOverlay"
  overlay.className = "displayImageZoomOverlay"

  overlay.innerHTML = `
    <div class="displayImageZoomInner">
      <img id="displayImageZoomImg" class="displayImageZoomImg" src="${img.src}" alt="">
    </div>
  `

  overlay.onclick = closeCurrentDisplayImageZoom

  document.body.appendChild(overlay)
}

/* =========================
   DISPLAY MEDIA FAILSAFE
   حماية الصور والفيديو من الظهور بشكل مكسور
========================= */

function createDisplayMediaFallback(type = "image") {
  const box = document.createElement("div")
  box.className = "displayMediaFallback"

  box.innerHTML = `
    <div class="displayMediaFallbackIcon">
      ${type === "video" ? "▶" : "!"}
    </div>

    <div class="displayMediaFallbackTitle">
      ${type === "video" ? "تعذر تشغيل الفيديو" : "تعذر تحميل الصورة"}
    </div>

    <div class="displayMediaFallbackText">
      تحقق من الملف أو أعد رفعه من لوحة التحكم
    </div>
  `

  return box
}

function protectDisplayMedia(root = document) {
  const scope = root || document

  scope.querySelectorAll("img").forEach(img => {
    if (img.dataset.mediaProtected === "1") return

    img.dataset.mediaProtected = "1"
    img.classList.add("displayImagePreparing")

    const markLoaded = () => {
      img.classList.remove("displayImagePreparing")
      img.classList.add("displayMediaLoaded", "displayImagePro")
    }

    const markError = () => {
      const parent = img.parentElement
      if (!parent) return

      parent.classList.add("displayMediaErrorBox")
      parent.innerHTML = ""
      parent.appendChild(createDisplayMediaFallback("image"))
    }

    if (img.complete && img.naturalWidth > 0) {
      markLoaded()
    } else {
      img.addEventListener("load", markLoaded, { once: true })
      img.addEventListener("error", markError, { once: true })
    }
  })

  scope.querySelectorAll("video").forEach(video => {
    if (video.dataset.mediaProtected === "1") return

    video.dataset.mediaProtected = "1"
    video.classList.add("displayImagePreparing")

    const markLoaded = () => {
      video.classList.remove("displayImagePreparing")
      video.classList.add("displayMediaLoaded", "displayImagePro")
    }

    const markError = () => {
      const parent = video.parentElement
      if (!parent) return

      parent.classList.add("displayMediaErrorBox")
      parent.innerHTML = ""
      parent.appendChild(createDisplayMediaFallback("video"))
    }

    if (video.readyState >= 2) {
      markLoaded()
    } else {
      video.addEventListener("loadeddata", markLoaded, { once: true })
      video.addEventListener("error", markError, { once: true })
    }
  })
}

function updateDisplayControlsEyeButton(isHidden) {
  const btn = document.getElementById("displayControlsEyeBtn")
  if (!btn) return

  btn.innerText = isHidden ? "إظهار التحكم" : "إخفاء التحكم"
  btn.classList.toggle("showControlsMode", isHidden)
  btn.classList.toggle("hideControlsMode", !isHidden)
  btn.title = isHidden ? "إظهار أزرار التحكم" : "إخفاء أزرار التحكم"
}

function applyPresenterHideDisplayControlsState() {
  const isHidden = localStorage.getItem("presenter_hide_controls") === "1"

  document.body.classList.toggle("presenterHideDisplayControls", isHidden)
  document.documentElement.classList.toggle("presenterHideDisplayControls", isHidden)

  /* دعم أكواد CSS داخل ملفات الفقرات */
  document.body.classList.toggle("segmentsControlsHidden", isHidden)
  document.documentElement.classList.toggle("segmentsControlsHidden", isHidden)

  const area = document.getElementById("segmentArea")
  if (!area) return

  const selectors = [
    /* عام داخل الفقرات فقط */
    ".displayControls",
    ".controlsBar",
    ".controlButtons",
    ".actionBar",
    ".segmentActionBar",
    ".segmentActions",
    ".segmentControlsBar",

    /* التسخين */
    ".warmupControlsBar",
    "#warmupControlsBar",
    ".warmupActionBar",
    "#warmupActionBar",
    ".warmupControlPanel",
    ".warmupControls",
    ".warmupActions",
    ".warmupButtons",

    /* Top 10 */
    ".top10ControlsBar",
    "#top10ControlsBar",
    ".top10ActionBar",
    "#top10ActionBar",
    ".top10Controls",
    ".top10ControlPanel",
    ".top10Actions",
    ".top10Buttons",

    /* حرفلي */
".letterliActionBar",
"#letterliActionBar",
".letterliControlsBar",
"#letterliControlsBar",
".letterliControlPanel",
".letterliControls",
".letterliActions",
".letterliButtons",

    /* فتبلة */
    ".auctionControlsBar",
    "#auctionControlsBar",
    ".auctionActionBar",
    "#auctionActionBar",
    ".auctionControls",
    ".auctionControlPanel",
    ".auctionActions",
    ".auctionButtons",
    ".fatblaControls",
    ".fatblaActions",

    /* من هو */
    ".whoControlsBar",
    "#whoControlsBar",
    ".whoActionBar",
    "#whoActionBar",
    ".whoControlPanel",
    ".whoControls",
    ".whoActions",
    ".whoButtons",

    /* اشرح الكلمة */
    ".explainActionBar",
    "#explainActionBar",
    ".explainControlPanel",
    ".explainControls",
    ".explainActions",
    ".explainButtons",
    ".explainGameActions",
    ".explainAnswerActions",
    ".explainControlButtons",

    /* الفاصلة */
    ".finalControlsBar",
    "#finalControlsBar",
    ".finalRound1ControlsBar",
    ".finalRound2ControlsBar",
    ".finalRound3ControlsBar",
    ".finalRound4ControlsBar",
    ".finalActions",
    ".finalButtons",

    /* الأرشيف */
    ".archiveControlsBar",
    "#archiveControlsBar",
    ".archiveActionBar",
    "#archiveActionBar",
    ".archiveControlButtons",
    ".archiveControlPanel",
    ".archiveControls",
    ".archiveActions",
    ".archiveButtons"
  ]

  area.querySelectorAll(selectors.join(",")).forEach(el => {
    if (isHidden) {
      el.dataset.presenterHiddenDisplay = "1"
      el.style.setProperty("display", "none", "important")
    } else if (el.dataset.presenterHiddenDisplay === "1") {
      el.style.removeProperty("display")
      delete el.dataset.presenterHiddenDisplay
    }
  })
}

function toggleDisplayControlsFromScreen() {
  const isHidden = localStorage.getItem("presenter_hide_controls") !== "1"

  localStorage.setItem("presenter_hide_controls", isHidden ? "1" : "0")

  applyPresenterHideDisplayControlsState()
  updateDisplayControlsEyeButton(isHidden)

  showGameToast(isHidden ? "تم إخفاء أزرار التحكم" : "تم إظهار أزرار التحكم")

  if (typeof syncDisplayStateToSession === "function") {
    syncDisplayStateToSession()
  }
}

function restoreDisplayControlsEye() {
  const isHidden = localStorage.getItem("presenter_hide_controls") === "1"

  applyPresenterHideDisplayControlsState()
  updateDisplayControlsEyeButton(isHidden)
}

async function copyDisplayJoinCodeFromPopup() {
  const code = localStorage.getItem("game_join_code") || ""

  if (!code) {
    showGameToast("لا يوجد كود جلسة")
    return
  }

  try {
    await navigator.clipboard.writeText(code)
    showGameToast("تم نسخ كود المقدم")
  } catch (e) {
    const textarea = document.createElement("textarea")
    textarea.value = code
    textarea.style.position = "fixed"
    textarea.style.opacity = "0"
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()

    try {
      document.execCommand("copy")
      showGameToast("تم نسخ كود المقدم")
    } catch {
      showGameToast("تعذر نسخ الكود")
    }

    textarea.remove()
  }
}

window.copyDisplayJoinCodeFromPopup = copyDisplayJoinCodeFromPopup

let joinCodePopTimer = null

function showJoinCodePopup() {
  const code = localStorage.getItem("game_join_code") || ""
  const modelName = localStorage.getItem("game_model_name") || currentModelName || "النموذج"

  if (!code) {
    showGameToast("لا يوجد كود جلسة")
    return
  }

  const box = document.getElementById("homeModelPopupArea")
  if (!box) return

  const isHidden = localStorage.getItem("presenter_hide_controls") === "1"

  box.innerHTML = `
  <div class="homeModelClassicBox">

    <button class="homeModelClassicClose" onclick="hideJoinCodePopup()">×</button>

    <button
  id="displayControlsEyeBtn"
  class="homeModelClassicControl ${isHidden ? "showControlsMode" : "hideControlsMode"}"
  type="button"
>
  ${isHidden ? "إظهار التحكم" : "إخفاء التحكم"}
</button>

<button
  id="bigScreenModeBtn"
  class="homeModelClassicControl fullScreenModeBtn"
  type="button"
>
  ملء الشاشة
</button>

    <button
      type="button"
      class="homeModelClassicBody"
      onclick="copyDisplayJoinCodeFromPopup()"
      title="اضغط لنسخ كود المقدم"
    >
      <span class="homeModelClassicCodeLabel">كود المقدم</span>
      <span class="homeModelClassicCode">${escapeDisplayHtml(code)}</span>
    </button>

  </div>
`

  const ctrlBtn = box.querySelector("#displayControlsEyeBtn")

  if (ctrlBtn) {
    ctrlBtn.onclick = function (e) {
      e.preventDefault()
      e.stopPropagation()
      toggleDisplayControlsFromScreen()
      return false
    }
  }

  const bigBtn = box.querySelector("#bigScreenModeBtn")

if (bigBtn) {
  updateTvFullScreenButton()

  bigBtn.onclick = function (e) {
    e.preventDefault()
    e.stopPropagation()
    toggleTvFullScreenMode()
    return false
  }
}

  box.classList.remove("hidden")
  box.classList.remove("show")

  void box.offsetWidth

  box.classList.add("show")

  clearTimeout(joinCodePopTimer)
  joinCodePopTimer = setTimeout(() => {
    hideJoinCodePopup()
  }, 9000)
}

function hideJoinCodePopup() {
  const box = document.getElementById("homeModelPopupArea")
  if (!box) return

  clearTimeout(joinCodePopTimer)
  joinCodePopTimer = null

  box.classList.remove("show")

  setTimeout(() => {
    box.classList.add("hidden")
    box.innerHTML = ""
  }, 220)
}

/* =========================
   DISPLAY VIEWPORT + FULL SCREEN MODE
   قياس الشاشة الحقيقي + وضع ملء الشاشة
========================= */

let displayViewportResizeTimer = null

function getDisplayViewportHeight() {
  const visualHeight = window.visualViewport?.height
  const innerHeight = window.innerHeight
  const clientHeight = document.documentElement.clientHeight

  return Math.round(
    visualHeight ||
    innerHeight ||
    clientHeight ||
    700
  )
}

function getDisplayViewportWidth() {
  const visualWidth = window.visualViewport?.width
  const innerWidth = window.innerWidth
  const clientWidth = document.documentElement.clientWidth

  return Math.round(
    visualWidth ||
    innerWidth ||
    clientWidth ||
    1000
  )
}

function applyDisplayViewportSize() {
  const visual = window.visualViewport

  const h = Math.round(
    visual?.height ||
    window.innerHeight ||
    document.documentElement.clientHeight ||
    700
  )

  const w = Math.round(
    visual?.width ||
    window.innerWidth ||
    document.documentElement.clientWidth ||
    1000
  )

  const shortest = Math.min(w, h)
  const isLandscape = w >= h

  let deviceMode = "desktop"

  if (shortest <= 480) {
    deviceMode = "phone"
  } else if (shortest <= 850) {
    deviceMode = "tablet"
  }

  let scale = 1

  if (deviceMode === "phone") {
    scale = isLandscape ? 0.78 : 0.72
  }

  if (deviceMode === "tablet") {
    scale = isLandscape ? 0.92 : 0.86
  }

  document.documentElement.style.setProperty("--app-height", `${h}px`)
  document.documentElement.style.setProperty("--app-width", `${w}px`)
  document.documentElement.style.setProperty("--display-vh", `${h}px`)
  document.documentElement.style.setProperty("--display-vw", `${w}px`)
  document.documentElement.style.setProperty("--display-scale", scale)

  document.body.classList.toggle("displayPhone", deviceMode === "phone")
  document.body.classList.toggle("displayTablet", deviceMode === "tablet")
  document.body.classList.toggle("displayDesktop", deviceMode === "desktop")
  document.body.classList.toggle("displayLandscape", isLandscape)
  document.body.classList.toggle("displayPortrait", !isLandscape)
}

function scheduleDisplayViewportSize() {
  clearTimeout(displayViewportResizeTimer)

  requestAnimationFrame(() => {
    applyDisplayViewportSize()
  })

  displayViewportResizeTimer = setTimeout(() => {
    applyDisplayViewportSize()
  }, 120)
}

function isNativeFullScreenActive() {
  return !!(
    document.fullscreenElement ||
    document.webkitFullscreenElement
  )
}

function isTvFullScreenActive() {
  return isNativeFullScreenActive() || document.body.classList.contains("tvFullScreenMode")
}

function updateTvFullScreenButton() {
  const btn =
    document.getElementById("bigScreenModeBtn") ||
    document.getElementById("fullScreenModeBtn")

  if (!btn) return

  const active = isTvFullScreenActive()

  btn.classList.toggle("activeFullScreen", active)
  btn.innerText = active ? "الخروج من ملء الشاشة" : "ملء الشاشة"
}

async function enterNativeFullScreen(root) {
  if (root.requestFullscreen) {
    await root.requestFullscreen({ navigationUI: "hide" })
    return true
  }

  if (root.webkitRequestFullscreen) {
    root.webkitRequestFullscreen()
    return true
  }

  return false
}

async function exitNativeFullScreen() {
  if (document.exitFullscreen && document.fullscreenElement) {
    await document.exitFullscreen()
    return true
  }

  if (document.webkitExitFullscreen && document.webkitFullscreenElement) {
    document.webkitExitFullscreen()
    return true
  }

  return false
}

async function toggleTvFullScreenMode() {
  const root = document.documentElement
  const active = isTvFullScreenActive()

  try {
    if (active) {
      await exitNativeFullScreen()

      document.body.classList.remove("tvFullScreenMode")
      document.documentElement.classList.remove("tvFullScreenMode")

      scheduleDisplayViewportSize()
      updateTvFullScreenButton()
      return
    }

    document.body.classList.add("tvFullScreenMode")
    document.documentElement.classList.add("tvFullScreenMode")

    await enterNativeFullScreen(root)

    scheduleDisplayViewportSize()
    updateTvFullScreenButton()
  } catch (error) {
    console.log("TV FULLSCREEN ERROR:", error)

    document.body.classList.add("tvFullScreenMode")
    document.documentElement.classList.add("tvFullScreenMode")

    scheduleDisplayViewportSize()
    updateTvFullScreenButton()

    if (typeof showGameToast === "function") {
      showGameToast("تم تفعيل ملء الشاشة داخل الصفحة")
    }
  }
}

document.addEventListener("fullscreenchange", () => {
  if (isNativeFullScreenActive()) {
    document.body.classList.add("tvFullScreenMode")
    document.documentElement.classList.add("tvFullScreenMode")
  } else {
    document.body.classList.remove("tvFullScreenMode")
    document.documentElement.classList.remove("tvFullScreenMode")
  }

  scheduleDisplayViewportSize()
  updateTvFullScreenButton()
})

document.addEventListener("webkitfullscreenchange", () => {
  if (isNativeFullScreenActive()) {
    document.body.classList.add("tvFullScreenMode")
    document.documentElement.classList.add("tvFullScreenMode")
  } else {
    document.body.classList.remove("tvFullScreenMode")
    document.documentElement.classList.remove("tvFullScreenMode")
  }

  scheduleDisplayViewportSize()
  updateTvFullScreenButton()
})

window.addEventListener("resize", scheduleDisplayViewportSize)
window.addEventListener("orientationchange", scheduleDisplayViewportSize)
window.addEventListener("pageshow", scheduleDisplayViewportSize)

if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", scheduleDisplayViewportSize)
  window.visualViewport.addEventListener("scroll", scheduleDisplayViewportSize)
}

window.addEventListener("load", updateTvFullScreenButton)

/* أسماء احتياطية للأزرار القديمة */
function toggleBigScreenMode() {
  return toggleTvFullScreenMode()
}

function applyBigScreenMode() {
  return applyDisplayViewportSize()
}

window.toggleTvFullScreenMode = toggleTvFullScreenMode
window.updateTvFullScreenButton = updateTvFullScreenButton
window.applyDisplayViewportSize = applyDisplayViewportSize

window.toggleBigScreenMode = toggleBigScreenMode
window.applyBigScreenMode = applyBigScreenMode

/* =========================
   UNIFIED FINAL RESULTS
   شاشة واحدة للنتائج والختام
========================= */

const FINAL_RESULTS_CONFIG = [
  {
    segmentKey: "warmup",
    cardKey: "warmup",
    prefix: "Warmup",
    title: "التسخين"
  },

  {
    segmentKey: "top10",
    cardKey: "top10",
    prefix: "Top10",
    title: "Top 10"
  },

  {
    segmentKey: "letterli",
    cardKey: "letterli",
    prefix: "Letterli",
    title: "حرفلي"
  },

  {
    segmentKey: "who",
    cardKey: "who",
    prefix: "Who",
    title: "من هو"
  },

  {
    segmentKey: "explain",
    cardKey: "explain",
    prefix: "Explain",
    title: "اشرح الكلمة"
  },

  {
    segmentKey: "finalRound1",
    cardKey: "final1",
    prefix: "Final1",
    title: "ٮدوں ٮڡاط"
  },

  {
    segmentKey: "finalRound2",
    cardKey: "final2",
    prefix: "Final2",
    title: "صح صحلي"
  },

  {
    segmentKey: "finalRound3",
    cardKey: "final3",
    prefix: "Final3",
    title: "قصة"
  },

  {
    segmentKey: "finalRound4",
    cardKey: "final4",
    prefix: "Final4",
    title: "التركيز"
  },

  {
    segmentKey: "archive",
    cardKey: "archive",
    prefix: "Archive",
    title: "الأرشيف"
  },

  {
    segmentKey: "randomChallenge",
    cardKey: "randomChallenge",
    prefix: "RandomChallenge",
    title: "التحدي"
  }
]

function readResultJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null")
  } catch {
    return null
  }
}

function safeResultNumber(value) {
  const n = Number(value || 0)
  return Number.isFinite(n) ? n : 0
}

function resultTeamName(team) {
  if (team === "A") return teamAName || localStorage.getItem("teamAName") || "الفريق الأول"
  if (team === "B") return teamBName || localStorage.getItem("teamBName") || "الفريق الثاني"
  return "تعادل"
}

function setResultText(id, value) {
  const el = document.getElementById(id)
  if (el) el.innerText = value
}

function getResultState() {
  return {
    warmup:
      window.warmupState ||
      readResultJson(
        "warmup_state_v1"
      ) ||
      {},

    top10:
      window.top10State ||
      readResultJson(
        "top10_state_v1"
      ) ||
      {},

    letterli:
      window.letterliState ||
      readResultJson(
        "letterli_state_v1"
      ) ||
      {},

    who:
      window.whoState ||
      readResultJson(
        "who_state_v1"
      ) ||
      {},

    explain:
      window.explainState ||
      readResultJson(
        "explain_state_v1"
      ) ||
      {},

    final:
      window.finalState ||
      readResultJson(
        "final_state_v3"
      ) ||
      {},

    archive:
      window.archiveState ||
      readResultJson(
        "archive_state_v1"
      ) ||
      {},

    randomChallenge:
      window.randomChallengeState ||
      readResultJson(
        "random_challenge_state_v1"
      ) ||
      {}
  }
}

function getResultScore(state, team) {
  if (!state) return 0

  return safeResultNumber(
    state?.scores?.[team] ??
    state?.score?.[team] ??
    state?.totalScores?.[team] ??
    state?.roundScores?.[team] ??
    state?.teamScores?.[team] ??
    state?.[`score${team}`] ??
    state?.[`total${team}`] ??
    state?.[`team${team}Score`] ??
    0
  )
}

function unwrapResultState(state, key) {
  if (!state) return {}
  if (state[key]) return state[key]
  return state
}

function getVisibleFinalResultKeys() {
  if (typeof getVisibleDisplaySegments === "function") {
    return getVisibleDisplaySegments()
      .map(item => normalizeDisplaySegmentKey(item.key))
      .filter(Boolean)
  }

  return FINAL_RESULTS_CONFIG.map(item => item.segmentKey)
}

function getRealSegmentScores(segmentKey) {
  const s = getResultState()

  const final = s.final || {}
  const warmup = s.warmup || {}
  const top10 = unwrapResultState(s.top10, "top10State")
  const letterli =
  unwrapResultState(
    s.letterli,
    "letterliState"
  )
  const auction = unwrapResultState(s.auction, "auctionState")
  const who = unwrapResultState(s.who, "whoState")
  const explain =
  unwrapResultState(
    s.explain,
    "explainState"
  )
  const archive = unwrapResultState(s.archive, "archiveState")
    const randomChallenge = unwrapResultState(s.randomChallenge, "randomChallengeState")

  let A = 0
  let B = 0

  if (segmentKey === "warmup") {
    A = safeResultNumber(
      window.warmupScoreA ??
      warmup.warmupScoreA ??
      warmup.scoreA ??
      warmup.scores?.A
    )

    B = safeResultNumber(
      window.warmupScoreB ??
      warmup.warmupScoreB ??
      warmup.scoreB ??
      warmup.scores?.B
    )
  }

  if (segmentKey === "top10") {
    A = getResultScore(top10, "A")
    B = getResultScore(top10, "B")
  }

  if (segmentKey === "letterli") {
  const state =
    window.letterliState ||
    readResultJson(
      "letterli_state_v1"
    ) ||
    {}

  A = safeResultNumber(
    state.scoreA ??
    state.scores?.A
  )

  B = safeResultNumber(
    state.scoreB ??
    state.scores?.B
  )
}

  if (segmentKey === "who") {
    A = safeResultNumber(who.scoreA ?? who.scores?.A)
    B = safeResultNumber(who.scoreB ?? who.scores?.B)
  }

  if (segmentKey === "explain") {
    A = getResultScore(explain, "A")
    B = getResultScore(explain, "B")
  }

  if (segmentKey === "finalRound1") {
    A = getResultScore(final.round1, "A")
    B = getResultScore(final.round1, "B")
  }

  if (segmentKey === "finalRound2") {
    A = getResultScore(final.round2, "A")
    B = getResultScore(final.round2, "B")
  }

  if (segmentKey === "finalRound3") {
    A = getResultScore(final.round3, "A")
    B = getResultScore(final.round3, "B")
  }

  if (segmentKey === "finalRound4") {
    A = getResultScore(final.round4, "A")
    B = getResultScore(final.round4, "B")
  }

  if (segmentKey === "archive") {
    A = getResultScore(archive, "A")
    B = getResultScore(archive, "B")
  }

    if (segmentKey === "randomChallenge") {
    A = getResultScore(randomChallenge, "A")
    B = getResultScore(randomChallenge, "B")
  }

  return { A, B }
}

function getFinalResultsRows() {
  segmentStatus = loadSegmentStatus()

  const visibleKeys = getVisibleFinalResultKeys()

  return FINAL_RESULTS_CONFIG
    .filter(item => visibleKeys.includes(item.segmentKey))
    .map(item => {
      const status = segmentStatus?.[item.segmentKey] || {
        locked: false,
        winner: "",
        scoreA: 0,
        scoreB: 0
      }

      const fallbackScores = getRealSegmentScores(item.segmentKey)

      const A = Number(status.locked ? status.scoreA : fallbackScores.A || 0)
      const B = Number(status.locked ? status.scoreB : fallbackScores.B || 0)

      let winnerTeam = ""

      if (status.locked) {
        if (A > B) winnerTeam = "A"
        else if (B > A) winnerTeam = "B"
        else winnerTeam = "draw"
      }

      return {
        ...item,
        A,
        B,
        locked: !!status.locked,
        winnerText: status.winner || "",
        winnerTeam
      }
    })
}

function getFinalResultsStats() {
  const rows = getFinalResultsRows()

  const stats = {
    A: 0,
    B: 0,
    draw: 0,
    pending: 0,
    selectedCount: rows.length,
    completedCount: 0
  }

  rows.forEach(row => {
    if (!row.locked) {
      stats.pending += 1
      return
    }

    stats.completedCount += 1

    if (row.winnerTeam === "A") stats.A += 1
    else if (row.winnerTeam === "B") stats.B += 1
    else stats.draw += 1
  })

  return stats
}

function getUnifiedFinalWinner(stats = getFinalResultsStats()) {
  if (stats.A > stats.B) {
    return {
      team: "A",
      name: resultTeamName("A"),
      type: "team"
    }
  }

  if (stats.B > stats.A) {
    return {
      team: "B",
      name: resultTeamName("B"),
      type: "team"
    }
  }

  return {
    team: "draw",
    name: "تعادل",
    type: "draw"
  }
}

function hideAllFinalResultCards() {
  document.querySelectorAll("[data-result-card]").forEach(card => {
    card.classList.add("hiddenFinalResultCard")
    card.classList.remove("teamA", "teamB", "draw", "pending")
  })
}

function updateSingleResultCard(row, index) {
  let winnerText = "لم تلعب"
  let winnerClass = "pending"

  if (row.locked) {
    setResultText(`result${row.prefix}A`, row.A)
    setResultText(`result${row.prefix}B`, row.B)

    if (row.winnerTeam === "A") {
      winnerText = resultTeamName("A")
      winnerClass = "teamA"
    } else if (row.winnerTeam === "B") {
      winnerText = resultTeamName("B")
      winnerClass = "teamB"
    } else {
      winnerText = "تعادل"
      winnerClass = "draw"
    }
  } else {
    setResultText(`result${row.prefix}A`, "—")
    setResultText(`result${row.prefix}B`, "—")
  }

  setResultText(`result${row.prefix}Winner`, winnerText)

  const card = document.querySelector(`[data-result-card="${row.cardKey}"]`)
  if (!card) return

  card.classList.remove("hiddenFinalResultCard", "teamA", "teamB", "draw", "pending")
  card.classList.add(winnerClass)

  const number = card.querySelector(".finalMatchNo")
  if (number) number.innerText = index + 1

  const title = card.querySelector("h3")
  if (title) title.innerText = row.title
}

function updateFinalResultsUI() {
  hideAllFinalResultCards()

  const rows = getFinalResultsRows()
  const stats = getFinalResultsStats()
  const winner = getUnifiedFinalWinner(stats)

  const overlay = document.getElementById("finalResultsOverlay")
  const board = document.querySelector(".finalResultsBoard")
  const list =
    document.querySelector(".finalResultsSegmentsGrid") ||
    document.querySelector(".finalResultsTimeline") ||
    document.querySelector(".finalResultsList")

  const totalPointsA = rows.reduce((sum, row) => sum + Number(row.A || 0), 0)
  const totalPointsB = rows.reduce((sum, row) => sum + Number(row.B || 0), 0)

  if (overlay) {
    overlay.classList.remove(
      "resultsCount1",
      "resultsCount2",
      "resultsCount3",
      "resultsCount4",
      "resultsCount5",
      "resultsCount6",
      "resultsCount7",
      "resultsCount8",
      "resultsCount9",
      "resultsCount10",
      "resultsCount11",
      "teamA",
      "teamB",
      "draw"
    )

    overlay.classList.add(`resultsCount${Math.max(1, Math.min(rows.length, 10))}`)

    if (winner.team === "A") overlay.classList.add("teamA")
    else if (winner.team === "B") overlay.classList.add("teamB")
    else overlay.classList.add("draw")
  }

  if (board) {
    board.style.setProperty("--results-count", rows.length)
  }

  if (list) {
    list.style.setProperty("--results-count", rows.length)
  }

  rows.forEach((row, index) => {
    updateSingleResultCard(row, index)
  })

  setResultText("finalTeamAStatsName", resultTeamName("A"))
  setResultText("finalTeamBStatsName", resultTeamName("B"))

  setResultText("finalTeamAStatsWins", stats.A)
  setResultText("finalTeamBStatsWins", stats.B)

  setResultText("finalTeamAStatsPoints", totalPointsA)
  setResultText("finalTeamBStatsPoints", totalPointsB)

  setResultText("finalTeamAStatsCompleted", stats.completedCount)
  setResultText("finalTeamBStatsCompleted", stats.completedCount)

  setResultText("finalResultsDrawTotal", stats.draw)

  setResultText("finalQuickCompleted", `${stats.completedCount}/${stats.selectedCount}`)
  setResultText("finalQuickDraws", stats.draw)
  setResultText("finalQuickPending", stats.pending)

  const teamABox = document.getElementById("finalResultsTeamABox")
  const teamBBox = document.getElementById("finalResultsTeamBBox")
  const winnerName = document.getElementById("finalResultsWinnerName")
  const winnerSub = document.getElementById("finalResultsWinnerSub")

  if (teamABox) teamABox.classList.remove("winner")
  if (teamBBox) teamBBox.classList.remove("winner")

  if (!rows.length) {
    if (winnerName) winnerName.innerText = "لا توجد فقرات"
    if (winnerSub) winnerSub.innerText = "لم يتم اختيار أي فقرة"
    return
  }

  if (!stats.completedCount) {
    if (winnerName) winnerName.innerText = "بانتظار النتائج"
    if (winnerSub) winnerSub.innerText = `الفقرات المختارة: ${stats.selectedCount}`
    return
  }

  if (winner.team === "A") {
    if (winnerName) winnerName.innerText = winner.name
    if (winnerSub) {
      winnerSub.innerText = `فاز في ${stats.A} من ${stats.completedCount} فقرات`
    }

    if (teamABox) teamABox.classList.add("winner")
    return
  }

  if (winner.team === "B") {
    if (winnerName) winnerName.innerText = winner.name
    if (winnerSub) {
      winnerSub.innerText = `فاز في ${stats.B} من ${stats.completedCount} فقرات`
    }

    if (teamBBox) teamBBox.classList.add("winner")
    return
  }

  if (winnerName) winnerName.innerText = "تعادل"
  if (winnerSub) winnerSub.innerText = `تعادل في عدد الفقرات — ${stats.A} / ${stats.B}`
}

function showDetailedFinalResults() {
  updateFinalResultsUI()

  const overlay = document.getElementById("finalResultsOverlay")
  if (!overlay) return

  overlay.classList.remove("hidden", "closing")
}

function closeDetailedFinalResults() {
  const overlay = document.getElementById("finalResultsOverlay")
  if (!overlay) return

  overlay.classList.add("closing")

  setTimeout(() => {
    overlay.classList.add("hidden")
    overlay.classList.remove("closing")
  }, 180)
}

function announceWinnerFromDetailedResults() {
  const stats = getFinalResultsStats()
  const winner = getUnifiedFinalWinner(stats)

  closeDetailedFinalResults()

  setTimeout(() => {
    if (typeof playWinnerEffects === "function") {
      playWinnerEffects()
    }

    if (typeof showWinnerOverlay === "function") {
      showWinnerOverlay(winner.name, { homeWinner: true })
    }
  }, 220)
}
document.addEventListener("visibilitychange", () => {
  if (
    document.visibilityState === "hidden" &&
    localStorage.getItem("game_session_id")
  ) {
    syncDisplayStateToSession({
      immediate: true
    })
  }
})

window.showDetailedFinalResults = showDetailedFinalResults
window.closeDetailedFinalResults = closeDetailedFinalResults
window.announceWinnerFromDetailedResults = announceWinnerFromDetailedResults