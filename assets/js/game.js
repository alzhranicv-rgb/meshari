let teamAName = localStorage.getItem("teamAName") || "الفريق الأول"
let teamBName = localStorage.getItem("teamBName") || "الفريق الثاني"

let scoreA = Number(localStorage.getItem("main_score_a") || 0)
let scoreB = Number(localStorage.getItem("main_score_b") || 0)

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
window.top10MaxRound = Number(localStorage.getItem("top10_max_round") || 3)
window.auctionMaxNumber = Number(localStorage.getItem("auction_max_number") || 8)
window.archiveMaxRound = Number(localStorage.getItem("archive_max_round") || 4)
window.whoMaxNumber = Number(localStorage.getItem("who_max_number") || 15)
window.explainWordsCount = Number(localStorage.getItem("explain_words_count") || 4)
window.finalRound1CardsCount = Number(localStorage.getItem("final_round1_cards_count") || 6)
window.finalRound3Count = Number(localStorage.getItem("final_round3_count") || 4)

const ALL_DISPLAY_SEGMENTS = [
  { key: "warmup", title: "التسخين", sort: 1 },
  { key: "top10", title: "Top 10", sort: 2 },
  { key: "auction", title: "فتبلة", sort: 3 },
  { key: "who", title: "من هو", sort: 4 },
  { key: "explain", title: "اشرح الكلمة", sort: 5 },

  { key: "finalRound1", title: "من بدون نقط", sort: 6 },
  { key: "finalRound2", title: "صح صحلي", sort: 7 },
  { key: "finalRound3", title: "التركيز", sort: 8 },
  { key: "finalRound4", title: "اشرح الصورة", sort: 9 },

  { key: "archive", title: "الأرشيف", sort: 10 }
]

let visibleDisplaySegments = ALL_DISPLAY_SEGMENTS.map(item => ({
  ...item,
  is_visible: item.sort <= 10,
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

function isFinalSegmentKey(key) {
  return (
    key === "finalRound1" ||
    key === "finalRound2" ||
    key === "finalRound3" ||
    key === "finalRound4"
  )
}

function getFinalRoundFromSegmentKey(key) {
  if (key === "finalRound1") return 1
  if (key === "finalRound2") return 2
  if (key === "finalRound3") return 3
  if (key === "finalRound4") return 4

  return null
}

function getFinalSegmentKeyFromRound(round) {
  const r = Number(round || 1)

  if (r === 1) return "finalRound1"
  if (r === 2) return "finalRound2"
  if (r === 3) return "finalRound3"
  if (r === 4) return "finalRound4"

  return "finalRound1"
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
    auction: item(),
    who: item(),
    explain: item(),

    final: item(),
    finalRound1: item(),
    finalRound2: item(),
    finalRound3: item(),
    finalRound4: item(),

    archive: item()
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

async function syncDisplayStateToSession() {
  try {
    const sessionId = localStorage.getItem("game_session_id")
    if (!sessionId) return

    currentModelName = localStorage.getItem("game_model_name") || currentModelName || ""
    window.currentModelName = currentModelName

    const explainSavedState =
      window.explainState ||
      getSafeJson("explain_state_v1") ||
      null

    const state = {
      mainScores: {
        A: Number(localStorage.getItem("main_score_a") || scoreA || 0),
        B: Number(localStorage.getItem("main_score_b") || scoreB || 0)
      },

      currentModelName: localStorage.getItem("game_model_name") || currentModelName || "",
      displayControlsHidden: localStorage.getItem("presenter_hide_controls") === "1",
      segmentStatus: getSafeJson("segment_status_v1") || defaultSegmentStatus(),

      warmup: getSafeJson("warmup_state_v1"),
      top10: getSafeJson("top10_state_v1"),
      auction: getSafeJson("auction_state_v2"),
      who: getSafeJson("who_state_v1"),

      explain: {
        explainState: explainSavedState
      },

      final: getSafeJson("final_state_v3"),
      finalRound1: getSafeJson("final_state_v3"),
      finalRound2: getSafeJson("final_state_v3"),
      finalRound3: getSafeJson("final_state_v3"),
      finalRound4: getSafeJson("final_state_v3"),
      archive: getSafeJson("archive_state_v1"),
      toast: window.lastDisplayToast || null
    }

    const sessionData = {
      id: sessionId,
      join_code: localStorage.getItem("game_join_code"),
      status: "active",
      model: Number(localStorage.getItem("game_model") || currentModel || 1),
      team_a: localStorage.getItem("teamAName") || teamAName,
      team_b: localStorage.getItem("teamBName") || teamBName,
      active_segment: localStorage.getItem("active_segment") || null,
      state,
      updated_at: new Date().toISOString()
    }

    try {
      if (typeof presenterCommandChannel !== "undefined" && presenterCommandChannel) {
        presenterCommandChannel.send({
          type: "broadcast",
          event: "session_state",
          payload: sessionData
        })
      }
    } catch (e) {
      console.log("Display session broadcast error:", e)
    }

    await db.from("game_sessions").upsert(sessionData)

  } catch (e) {
    console.log("sync session error:", e)
  }
}
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
========================= */

async function getDisplaySegmentCount(segment, fallback = 3, max = 4) {
  if (!currentModel) return fallback

  const { data, error } = await db
    .from("segment_settings")
    .select("item_count")
    .eq("model", Number(currentModel))
    .eq("segment", segment)
    .maybeSingle()

  if (error) {
    console.log("GET DISPLAY SEGMENT COUNT ERROR:", error)
    return fallback
  }

  return Math.min(Math.max(Number(data?.item_count || fallback), 1), max)
}

async function loadDisplaySegmentCounts() {
  window.top10MaxRound = await getDisplaySegmentCount("top10", 3, 4)
  window.auctionMaxNumber = await getDisplaySegmentCount("auction", 8, 8)
  window.archiveMaxRound = await getDisplaySegmentCount("archive", 4, 4)

  window.whoMaxNumber = await getDisplaySegmentCount("who", 15, 15)
  window.explainWordsCount = await getDisplaySegmentCount("explain", 4, 8)
  window.finalRound1CardsCount = await getDisplaySegmentCount("finalRound1", 6, 8)
  window.finalRound3Count = await getDisplaySegmentCount("finalRound3", 4, 8)

  localStorage.setItem("top10_max_round", String(window.top10MaxRound))
  localStorage.setItem("auction_max_number", String(window.auctionMaxNumber))
  localStorage.setItem("archive_max_round", String(window.archiveMaxRound))

  localStorage.setItem("who_max_number", String(window.whoMaxNumber))
  localStorage.setItem("explain_words_count", String(window.explainWordsCount))
  localStorage.setItem("final_round1_cards_count", String(window.finalRound1CardsCount))
  localStorage.setItem("final_round3_count", String(window.finalRound3Count))
}

async function loadDisplayCountForSegment(segmentKey) {
  if (segmentKey === "top10") {
    window.top10MaxRound = await getDisplaySegmentCount("top10", 3, 4)
    localStorage.setItem("top10_max_round", String(window.top10MaxRound))
  }

  if (segmentKey === "auction") {
    window.auctionMaxNumber = await getDisplaySegmentCount("auction", 8, 8)
    localStorage.setItem("auction_max_number", String(window.auctionMaxNumber))
  }

  if (segmentKey === "archive") {
    window.archiveMaxRound = await getDisplaySegmentCount("archive", 4, 4)
    localStorage.setItem("archive_max_round", String(window.archiveMaxRound))
  }

  if (segmentKey === "who") {
    window.whoMaxNumber = await getDisplaySegmentCount("who", 15, 15)
    localStorage.setItem("who_max_number", String(window.whoMaxNumber))
  }

  if (segmentKey === "explain") {
    window.explainWordsCount = await getDisplaySegmentCount("explain", 4, 8)
    localStorage.setItem("explain_words_count", String(window.explainWordsCount))
  }

  if (segmentKey === "finalRound1") {
    window.finalRound1CardsCount = await getDisplaySegmentCount("finalRound1", 6, 8)
    localStorage.setItem("final_round1_cards_count", String(window.finalRound1CardsCount))
  }

  if (segmentKey === "finalRound3") {
    window.finalRound3Count = await getDisplaySegmentCount("finalRound3", 4, 8)
    localStorage.setItem("final_round3_count", String(window.finalRound3Count))
  }
}

async function loadVisibleSegmentsForDisplay() {
  visibleDisplaySegments = ALL_DISPLAY_SEGMENTS.map(item => ({
    ...item,
    is_visible: item.sort <= 10,
    sort_order: item.sort
  }))

  const modelId = Number(
    localStorage.getItem("game_model") ||
    window.currentModel ||
    currentModel ||
    0
  )

  if (!modelId) {
    return visibleDisplaySegments
  }

  const { data, error } = await db
    .from("visible_segments")
    .select("*")
    .eq("model", modelId)
    .order("sort_order", { ascending: true })

  if (error) {
    console.log("LOAD VISIBLE SEGMENTS ERROR:", error)
    return visibleDisplaySegments
  }

  if (!data || !data.length) {
    return visibleDisplaySegments
  }

  const map = {}

  ALL_DISPLAY_SEGMENTS.forEach(item => {
    map[item.key] = {
      ...item,
      is_visible: item.sort <= 10,
      sort_order: item.sort
    }
  })

  data.forEach(row => {
    if (!map[row.segment_key]) return

    map[row.segment_key] = {
      ...map[row.segment_key],
      is_visible: !!row.is_visible,
      sort_order: Number(row.sort_order || map[row.segment_key].sort)
    }
  })

  visibleDisplaySegments = Object.values(map)
    .sort((a, b) => {
      return Number(a.sort_order || a.sort) - Number(b.sort_order || b.sort)
    })

  return visibleDisplaySegments
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
  const box = document.getElementById("modelNameDisplay")
  if (!box) return

  box.innerText = currentModelName ? currentModelName : ""
  box.onclick = showJoinCodePopup
  box.style.cursor = "pointer"
}

function getSegmentWinnerLabelIds(key) {
  if (key === "warmup") return ["segmentWinnerWarmup", "winnerWarmup"]
  if (key === "top10") return ["segmentWinnerTop10", "winnerTop10"]
  if (key === "auction") return ["segmentWinnerAuction", "winnerAuction"]
  if (key === "who") return ["segmentWinnerWho", "winnerWho"]
  if (key === "explain") return ["segmentWinnerExplain", "winnerExplain"]

  if (key === "finalRound1") return ["segmentWinnerFinalRound1", "winner_finalRound1"]
  if (key === "finalRound2") return ["segmentWinnerFinalRound2", "winner_finalRound2"]
  if (key === "finalRound3") return ["segmentWinnerFinalRound3", "winner_finalRound3"]
  if (key === "finalRound4") return ["segmentWinnerFinalRound4", "winner_finalRound4"]

  if (key === "final") return ["segmentWinnerFinal", "winnerFinal"]
  if (key === "archive") return ["segmentWinnerArchive", "winnerArchive"]

  return [`segmentWinner_${key}`, `winner_${key}`]
}

function getSegmentCardIds(key) {
  if (key === "warmup") return ["segmentCardWarmup", "segmentWarmup"]
  if (key === "top10") return ["segmentCardTop10", "segmentTop10"]
  if (key === "auction") return ["segmentCardAuction", "segmentAuction"]
  if (key === "who") return ["segmentCardWho", "segmentWho"]
  if (key === "explain") return ["segmentCardExplain", "segmentExplain"]

  if (key === "finalRound1") return ["segmentCardFinalRound1", "segment_finalRound1"]
  if (key === "finalRound2") return ["segmentCardFinalRound2", "segment_finalRound2"]
  if (key === "finalRound3") return ["segmentCardFinalRound3", "segment_finalRound3"]
  if (key === "finalRound4") return ["segmentCardFinalRound4", "segment_finalRound4"]

  if (key === "final") return ["segmentCardFinal", "segmentFinal"]
  if (key === "archive") return ["segmentCardArchive", "segmentArchive"]

  return [`segmentCard_${key}`, `segment_${key}`]
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
  const item = ALL_DISPLAY_SEGMENTS.find(x => x.key === segmentKey)
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

async function showSegmentEndOverlay(segmentKey, winner) {
  const title = getDisplaySegmentTitle(segmentKey)
  const isTie = !winner || winner === "تعادل"

  await showDisplayProOverlay({
    eyebrow: `انتهت فقرة ${title}`,
    title: isTie ? "تعادل" : winner,
    subtitle: isTie ? "لا يوجد فائز في هذه الفقرة" : "الفائز في الفقرة +1",
    type: isTie ? "neutral" : "winner",
    duration: 1800,
    sound: isTie ? "answer" : "correct"
  })
}

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

  localStorage.removeItem("auction_state_v1")
  localStorage.removeItem("auction_state_v2")

  localStorage.removeItem("who_state_v1")
  localStorage.removeItem("explain_state_v1")

  localStorage.removeItem("final_state_v1")
  localStorage.removeItem("final_state_v2")
  localStorage.removeItem("final_state_v3")

  localStorage.removeItem("archive_state_v1")

  segmentStatus = defaultSegmentStatus()

  window.usedQuestions = {}
  window.top10State = null
  window.auctionState = null
  window.whoState = null
  window.explainState = null
  window.finalState = null
  window.archiveState = null
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
    ".auctionBigImage",
    ".auctionImageFrame img",
    ".auctionImageBox img",
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

  initWinnerSound()
  initGameSounds()
  bindAudioUnlock()

  observeDisplayMedia()
  restoreDisplayControlsEye()

  await loadDisplaySegmentCounts()
  await loadVisibleSegmentsForDisplay()

  segmentStatus = loadSegmentStatus()

  renderVisibleSegmentsHome()
  updateSegmentCards()

  await restoreDisplayAfterRefresh()
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
  let winner = ""

  if (scoreA > scoreB) winner = teamAName
  else if (scoreB > scoreA) winner = teamBName
  else winner = "تعادل"

  showWinnerOverlay(winner, { homeWinner: true })
}

function announceWinner() {
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
  localStorage.removeItem("auction_state_v1")
  localStorage.removeItem("auction_state_v2")
  localStorage.removeItem("who_state_v1")
  localStorage.removeItem("explain_state_v1")
  localStorage.removeItem("final_state_v2")
  localStorage.removeItem("final_state_v3")
  localStorage.removeItem("archive_state_v1")

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
    .slice(0, 10)
}

function isSegmentVisibleOnDisplay(segmentKey) {
  return getVisibleDisplaySegments().some(item => item.key === segmentKey)
}

function getDisplaySegmentDomId(key) {
  if (key === "warmup") return "segmentWarmup"
  if (key === "top10") return "segmentTop10"
  if (key === "auction") return "segmentAuction"
  if (key === "who") return "segmentWho"
  if (key === "explain") return "segmentExplain"

  if (key === "finalRound1") return "segment_finalRound1"
  if (key === "finalRound2") return "segment_finalRound2"
  if (key === "finalRound3") return "segment_finalRound3"
  if (key === "finalRound4") return "segment_finalRound4"

  if (key === "final") return "segmentFinal"
  if (key === "archive") return "segmentArchive"

  return `segment_${key}`
}

function getDisplayWinnerDomId(key) {
  if (key === "warmup") return "winnerWarmup"
  if (key === "top10") return "winnerTop10"
  if (key === "auction") return "winnerAuction"
  if (key === "who") return "winnerWho"
  if (key === "explain") return "winnerExplain"

  if (key === "finalRound1") return "winner_finalRound1"
  if (key === "finalRound2") return "winner_finalRound2"
  if (key === "finalRound3") return "winner_finalRound3"
  if (key === "finalRound4") return "winner_finalRound4"

  if (key === "final") return "winnerFinal"
  if (key === "archive") return "winnerArchive"

  return `winner_${key}`
}

function renderVisibleSegmentsHome() {
  const grid = document.getElementById("segmentsGrid")
  if (!grid) return

  const segments = getVisibleDisplaySegments()

  grid.innerHTML = segments.map(item => {
    const cardId = getDisplaySegmentDomId(item.key)
    const winnerId = getDisplayWinnerDomId(item.key)

    return `
      <div
        class="segmentCard homeSegmentItem"
        id="${cardId}"
        onclick="openMainSegment('${item.key}')"
      >
        <div class="homeSegmentContent">
          <span>${escapeDisplayHtml(item.title)}</span>
          <div class="segmentWinner homeSegmentWinner" id="${winnerId}"></div>
        </div>
      </div>
    `
  }).join("")
}

function updateSegmentCards() {
  ALL_DISPLAY_SEGMENTS.forEach(item => {
    setSegmentWinnerLabel(item.key)
  })
}

function setSegmentWinnerLabel(key) {
  const labelIds = getSegmentWinnerLabelIds(key)
  const cardIds = getSegmentCardIds(key)

  const label = getFirstElement(labelIds)
  const card = getFirstElement(cardIds)
  const status = segmentStatus[key] || { locked: false, winner: "" }

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

async function openSegmentPage(segmentKey) {
  if (!canRunDisplayAction(`open_segment_${segmentKey}`, 1400)) {
    return
  }

  clearDisplayTemporaryFx()

  await loadVisibleSegmentsForDisplay()

  if (!isSegmentVisibleOnDisplay(segmentKey)) {
    showGameToast("هذه الفقرة غير مفعلة في العرض")
    renderVisibleSegmentsHome()
    updateSegmentCards()
    return
  }

  if (segmentStatus[segmentKey]?.locked) return

  if (displayProFxLock) return
  displayProFxLock = true

  await loadDisplayCountForSegment(segmentKey)

  homeRefreshLocked = true
  localStorage.setItem("active_segment", segmentKey)

  const homeScreen = getFirstElement(["homeScreen", "homePage"])
  const segmentScreen = getFirstElement(["segmentScreen"])

  document.body.classList.add("segmentMode")

  await showSegmentIntro(segmentKey)

  playSoftExit(homeScreen, async () => {
    if (homeScreen) homeScreen.classList.add("hidden")
    if (segmentScreen) segmentScreen.classList.remove("hidden")

    showDisplayLoading("جاري تجهيز الفقرة...")

   try {
  if (segmentKey === "warmup") await window.renderWarmup()
  if (segmentKey === "top10") await window.renderTop10()
  if (segmentKey === "auction") await window.renderAuction()
  if (segmentKey === "who") await window.renderWho()
  if (segmentKey === "explain") await window.renderExplain()

  if (isFinalSegmentKey(segmentKey)) {
    await window.renderFinal(getFinalRoundFromSegmentKey(segmentKey), segmentKey)
  }

  if (segmentKey === "archive") await window.renderArchive()

  const mediaRoot = document.getElementById("segmentArea") || document

  protectDisplayMedia(mediaRoot)

  if (typeof enhanceDisplayMediaFrames === "function") {
    enhanceDisplayMediaFrames(mediaRoot)
  }

  if (typeof preloadDisplayMediaInRoot === "function") {
    await preloadDisplayMediaInRoot(mediaRoot)
  }

  if (typeof applyDisplayMediaRevealFx === "function") {
    applyDisplayMediaRevealFx(mediaRoot)
  }

} catch (e) {
  console.log("DISPLAY SEGMENT RENDER ERROR:", e)
  showGameToast("تعذر تجهيز الفقرة")
} finally {
  hideDisplayLoading()
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

    setTimeout(() => {
      displayProFxLock = false
    }, 350)
  })
}

function openMainSegment(segmentKey) {
  openSegmentPage(segmentKey)
}

/* حل احتياطي لو فيه مكان قديم يستدعي الاسم الغلط */
function openMaToSegment(segmentKey) {
  openMainSegment(segmentKey)
}

function openSegment(title, content) {
  const area = document.getElementById("segmentArea")
  if (!area) return

  area.innerHTML = `
    <div class="segmentControls">
      <button onclick="goHome()" class="backBtn">رجوع</button>
      <h2 class="segmentTitle">${title}</h2>
      <button id="endRoundBtn" onclick="endCurrentSegment()" class="endBtn" disabled>إنهاء</button>
    </div>

    <div class="segmentContentWrap">
      ${content}
    </div>
  `

  syncDisplayStateToSession()
  updateEndRoundButtonState()
  startEndButtonWatcher()
}

function goHome() {
  clearDisplayTemporaryFx()

  clearInterval(timer)
  timer = null
  window.currentSegmentScores = null

  localStorage.removeItem("active_segment")
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

  const winner = getWinnerFromSegmentScores()

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

  saveSegmentStatus()
  updateSegmentCards()

  clearInterval(timer)
  timer = null

  localStorage.removeItem("active_segment")
  syncDisplayStateToSession()

  await showSegmentEndOverlay(key, winner)

  displayProFxLock = false

  goHome()
}

function getCurrentSegmentKey() {
  const active = localStorage.getItem("active_segment")

  if (active) return active

  const title = document.querySelector(".segmentTitle")
  if (!title) return null

  const text = title.innerText || ""

  if (text.includes("التسخين")) return "warmup"
  if (text.includes("Top 10")) return "top10"
  if (text.includes("فتبلة")) return "auction"
  if (text.includes("من هو")) return "who"
  if (text.includes("اشرح الكلمة")) return "explain"

  if (text.includes("من بدون نقط")) return "finalRound1"
  if (text.includes("صح صحلي")) return "finalRound2"
  if (text.includes("التركيز")) return "finalRound3"
  if (text.includes("اشرح الصورة")) return "finalRound4"

  if (text.includes("الفاصلة")) return "final"
  if (text.includes("الأرشيف")) return "archive"

  return null
}

function getSafeSegmentNumber(value, fallback, max) {
  return Math.min(
    Math.max(Number(value || fallback), 1),
    max
  )
}

function canEndSegment(segmentKey) {
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
      (window.finalState.round2?.opened || []).length >= 4 &&
      (window.finalState.round2?.scoredNumbers || []).length >= 4
    )
  }

  if (segmentKey === "finalRound3") {
    if (!window.finalState) return false

    const total = getSafeSegmentNumber(
      window.finalState.round3?.teamMedia?.count ||
      window.finalRound3Count ||
      localStorage.getItem("final_round3_count"),
      4,
      8
    )

    if (window.finalState.round3?.mode === "team_media") {
      return (
        (window.finalState.round3?.teamMedia?.usedNumbers || []).length >= total &&
        (window.finalState.round3?.scoredNumbers || []).length >= total
      )
    }

    return (
      (window.finalState.round3?.opened || []).length >= 2 &&
      (window.finalState.round3?.scoredNumbers || []).length >= 2
    )
  }

  if (segmentKey === "finalRound4") {
    if (!window.finalState) return false

    return (
      (window.finalState.round4?.opened || []).length >= 2 &&
      (window.finalState.round4?.scoredNumbers || []).length >= 2
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

    const finalR3Total = getSafeSegmentNumber(
      window.finalState.round3?.teamMedia?.count ||
      window.finalRound3Count ||
      localStorage.getItem("final_round3_count"),
      4,
      8
    )

    const r1Done =
      (window.finalState.round1?.opened || []).length >= r1Count

    const r2Done =
      (window.finalState.round2?.opened || []).length >= 4 &&
      (window.finalState.round2?.scoredNumbers || []).length >= 4

    const r3Done =
      (window.finalState.round3?.teamMedia?.usedNumbers || []).length >= finalR3Total &&
      (window.finalState.round3?.scoredNumbers || []).length >= finalR3Total

    const r4Done =
      (window.finalState.round4?.opened || []).length >= 2 &&
      (window.finalState.round4?.scoredNumbers || []).length >= 2

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

function getWinnerFromSegmentScores() {
  if (window.currentSegmentScores) {
    const a = Number(window.currentSegmentScores.A || 0)
    const b = Number(window.currentSegmentScores.B || 0)

    if (a > b) return teamAName
    if (b > a) return teamBName
    return "تعادل"
  }

  if (scoreA > scoreB) return teamAName
  if (scoreB > scoreA) return teamBName
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
let screenFlashLayer = null

function ensureScreenFlashLayer() {
  if (screenFlashLayer && document.body.contains(screenFlashLayer)) {
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
    "flashWrongPro"
  )

  void layer.offsetWidth

  if (type === "wrong") {
    layer.classList.add("flashWrongPro")
    playGameSound("wrong")
  } else {
    layer.classList.add("flashCorrectPro")
    playGameSound("correct")
  }

  setTimeout(() => {
    layer.classList.remove(
      "flashCorrect",
      "flashWrong",
      "flashWrongStrong",
      "flashCorrectPro",
      "flashWrongPro"
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
  "displayLoadingLayer"
]

  idsToRemove.forEach(id => {
    const el = document.getElementById(id)
    if (el) el.remove()
  })

  const proLayer = document.getElementById("displayProLayer")
  if (proLayer) {
    proLayer.className = "displayProLayer hidden"
    proLayer.innerHTML = ""
  }

  const toast = document.getElementById("gameToast")
  const toastText = document.getElementById("gameToastText")

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

  document.body.classList.remove("auctionOverlayActive")

  document
    .querySelectorAll(".timerDanger, .timerTimeoutFx, .displaySegmentEnterFx")
    .forEach(el => {
      el.classList.remove("timerDanger", "timerTimeoutFx", "displaySegmentEnterFx")
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

function toggleDisplayControlsFromScreen() {
  const isHidden = document.body.classList.toggle("presenterHideDisplayControls")

  localStorage.setItem("presenter_hide_controls", isHidden ? "1" : "0")
  updateDisplayControlsEyeButton(isHidden)

  if (typeof syncDisplayStateToSession === "function") {
    syncDisplayStateToSession()
  }

  hideJoinCodePopup()
}

function restoreDisplayControlsEye() {
  const isHidden = localStorage.getItem("presenter_hide_controls") === "1"
  document.body.classList.toggle("presenterHideDisplayControls", isHidden)
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
  class="homeModelClassicControl bigScreenModeBtn ${localStorage.getItem("big_screen_mode") === "1" ? "activeBigScreen" : ""}"
  type="button"
>
  ${localStorage.getItem("big_screen_mode") === "1" ? "إلغاء تحسين العرض" : "تحسين العرض"}
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
  bigBtn.onclick = function (e) {
    e.preventDefault()
    e.stopPropagation()
    toggleBigScreenMode()
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
   1) BIG SCREEN MODE
========================= */

const BIG_SCREEN_STORAGE_KEY = "big_screen_mode"

function applyBigScreenMode() {
  const enabled = localStorage.getItem(BIG_SCREEN_STORAGE_KEY) === "1"

  document.body.classList.toggle("bigScreenMode", enabled)

  const btn = document.getElementById("bigScreenModeBtn")
  if (btn) {
    btn.innerText = enabled ? "إلغاء تحسين العرض" : "تحسين العرض"
    btn.classList.toggle("activeBigScreen", enabled)
  }
}

function toggleBigScreenMode() {
  const enabled = localStorage.getItem(BIG_SCREEN_STORAGE_KEY) === "1"

  localStorage.setItem(BIG_SCREEN_STORAGE_KEY, enabled ? "0" : "1")
  applyBigScreenMode()
}


/* =========================
   2) DETAILED FINAL RESULTS
   لوحة النتائج = نفس العرض
   الكروت = إحصائيات كل فقرة
   الفائز = الأكثر فوزًا بالفقرات
========================= */

const FINAL_RESULTS_CONFIG = [
  { segmentKey: "warmup", cardKey: "warmup", prefix: "Warmup", title: "التسخين" },
  { segmentKey: "top10", cardKey: "top10", prefix: "Top10", title: "Top 10" },
  { segmentKey: "auction", cardKey: "auction", prefix: "Auction", title: "فتبلة" },
  { segmentKey: "who", cardKey: "who", prefix: "Who", title: "من هو" },
  { segmentKey: "explain", cardKey: "explain", prefix: "Explain", title: "اشرح الكلمة" },
  { segmentKey: "finalRound1", cardKey: "final1", prefix: "Final1", title: "من بدون نقط" },
  { segmentKey: "finalRound2", cardKey: "final2", prefix: "Final2", title: "صح صحلي" },
  { segmentKey: "finalRound3", cardKey: "final3", prefix: "Final3", title: "التركيز" },
  { segmentKey: "finalRound4", cardKey: "final4", prefix: "Final4", title: "اشرح الصورة" },
  { segmentKey: "archive", cardKey: "archive", prefix: "Archive", title: "الأرشيف" }
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
    warmup: window.warmupState || readResultJson("warmup_state_v1") || {},
    top10: window.top10State || readResultJson("top10_state_v1") || {},
    auction:
      window.auctionState ||
      readResultJson("auction_state_v2") ||
      readResultJson("auction_state_v1") ||
      {},
    who: window.whoState || readResultJson("who_state_v1") || {},
    explain: window.explainState || readResultJson("explain_state_v1") || {},
    final: window.finalState || readResultJson("final_state_v3") || {},
    archive: window.archiveState || readResultJson("archive_state_v1") || {}
  }
}

/* يقرأ النقاط من أي شكل مستخدم في ملفات الفقرات */
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

function normalizeWinnerToTeam(winner) {
  const text = String(winner || "").trim()

  if (!text) return ""
  if (text === "تعادل") return "draw"

  const aName = resultTeamName("A")
  const bName = resultTeamName("B")

  if (text === aName || text.includes(aName)) return "A"
  if (text === bName || text.includes(bName)) return "B"

  return ""
}

function getVisibleFinalResultKeys() {
  if (typeof getVisibleDisplaySegments === "function") {
    return getVisibleDisplaySegments()
      .map(item => item.key)
      .filter(Boolean)
  }

  return FINAL_RESULTS_CONFIG.map(item => item.segmentKey)
}

/* هنا نجيب نقاط كل فقرة الحقيقية */
function getRealSegmentScores(segmentKey) {
  const s = getResultState()
  const final = s.final || {}

  let A = 0
  let B = 0

  if (segmentKey === "warmup") {
    A = safeResultNumber(
      window.warmupScoreA ??
      s.warmup?.scoreA ??
      s.warmup?.scores?.A ??
      s.warmup?.totalA
    )

    B = safeResultNumber(
      window.warmupScoreB ??
      s.warmup?.scoreB ??
      s.warmup?.scores?.B ??
      s.warmup?.totalB
    )
  }

  if (segmentKey === "top10") {
    A = getResultScore(s.top10, "A")
    B = getResultScore(s.top10, "B")
  }

  if (segmentKey === "auction") {
    A = getResultScore(s.auction, "A")
    B = getResultScore(s.auction, "B")
  }

  if (segmentKey === "who") {
    A = getResultScore(s.who, "A")
    B = getResultScore(s.who, "B")
  }

  if (segmentKey === "explain") {
    A = getResultScore(s.explain, "A")
    B = getResultScore(s.explain, "B")
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
    A = getResultScore(s.archive, "A")
    B = getResultScore(s.archive, "B")
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

      const A = Number(status.scoreA || fallbackScores.A || 0)
      const B = Number(status.scoreB || fallbackScores.B || 0)

      let winnerTeam = ""

      if (A > B) winnerTeam = "A"
      else if (B > A) winnerTeam = "B"
      else if (status.locked) winnerTeam = "draw"

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

/* الإحصائية النهائية: نحسب الفائز حسب عدد الفقرات */
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

function hideAllFinalResultCards() {
  document.querySelectorAll("[data-result-card]").forEach(card => {
    card.classList.add("hiddenFinalResultCard")
    card.classList.remove("teamA", "teamB", "draw", "pending")
  })
}

function updateSingleResultCard(row, index) {
  /* هنا تظهر نقاط الفقرة الحقيقية */
  setResultText(`result${row.prefix}A`, row.A)
  setResultText(`result${row.prefix}B`, row.B)

  let winnerText = "لم تنتهِ"
  let winnerClass = "pending"

  if (row.locked || row.winnerTeam) {
    if (row.winnerTeam === "A") {
      winnerText = `فاز: ${resultTeamName("A")}`
      winnerClass = "teamA"
    } else if (row.winnerTeam === "B") {
      winnerText = `فاز: ${resultTeamName("B")}`
      winnerClass = "teamB"
    } else {
      winnerText = "تعادل"
      winnerClass = "draw"
    }
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

  rows.forEach((row, index) => {
    updateSingleResultCard(row, index)
  })

  setResultText("finalResultsTeamAName", resultTeamName("A"))
  setResultText("finalResultsTeamBName", resultTeamName("B"))

  /* فوق نعرض عدد الفقرات الفائزة، وليس نقاط الفقرات */
  setResultText("finalResultsTotalA", stats.A)
  setResultText("finalResultsTotalB", stats.B)

  const teamABox = document.getElementById("finalResultsTeamABox")
  const teamBBox = document.getElementById("finalResultsTeamBBox")
  const winnerName = document.getElementById("finalResultsWinnerName")
  const winnerSub = document.getElementById("finalResultsWinnerSub")
  const overlay = document.getElementById("finalResultsOverlay")
  const cupText = document.querySelector(".finalScoreCup span")

  if (teamABox) teamABox.classList.remove("winner")
  if (teamBBox) teamBBox.classList.remove("winner")
  if (overlay) overlay.classList.remove("teamA", "teamB", "draw")

  if (cupText) {
    cupText.innerText = stats.draw > 0 ? `تعادل ${stats.draw}` : "VS"
  }

  if (!rows.length) {
    if (winnerName) winnerName.innerText = "لا توجد فقرات"
    if (winnerSub) winnerSub.innerText = "لم يتم اختيار أي فقرة"
    if (overlay) overlay.classList.add("draw")
    return
  }

  if (!stats.completedCount) {
    if (winnerName) winnerName.innerText = "لم تبدأ النتائج"
    if (winnerSub) winnerSub.innerText = `الفقرات المختارة: ${stats.selectedCount}`
    if (overlay) overlay.classList.add("draw")
    return
  }

  if (stats.A > stats.B) {
    if (winnerName) winnerName.innerText = resultTeamName("A")
    if (winnerSub) winnerSub.innerText = `فاز في ${stats.A} من ${stats.completedCount} فقرات`
    if (teamABox) teamABox.classList.add("winner")
    if (overlay) overlay.classList.add("teamA")
  } else if (stats.B > stats.A) {
    if (winnerName) winnerName.innerText = resultTeamName("B")
    if (winnerSub) winnerSub.innerText = `فاز في ${stats.B} من ${stats.completedCount} فقرات`
    if (teamBBox) teamBBox.classList.add("winner")
    if (overlay) overlay.classList.add("teamB")
  } else {
    if (winnerName) winnerName.innerText = "تعادل"
    if (winnerSub) winnerSub.innerText = `تعادل في عدد الفقرات`
    if (overlay) overlay.classList.add("draw")
  }
}

function showDetailedFinalResults() {
  updateFinalResultsUI()

  const overlay = document.getElementById("finalResultsOverlay")
  if (!overlay) return

  overlay.classList.remove("hidden")
  overlay.classList.remove("closing")
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

  let winner = "تعادل"

  if (stats.A > stats.B) winner = resultTeamName("A")
  if (stats.B > stats.A) winner = resultTeamName("B")

  closeDetailedFinalResults()

  setTimeout(() => {
    if (typeof playWinnerEffects === "function") {
      playWinnerEffects()
    }

    if (typeof showWinnerOverlay === "function") {
      showWinnerOverlay(winner, { homeWinner: true })
    }
  }, 220)
}

window.showDetailedFinalResults = showDetailedFinalResults
window.closeDetailedFinalResults = closeDetailedFinalResults
window.announceWinnerFromDetailedResults = announceWinnerFromDetailedResults

/* =========================
   3) INIT EXTRA FEATURES
========================= */

document.addEventListener("DOMContentLoaded", () => {
  applyBigScreenMode()
})

window.toggleBigScreenMode = toggleBigScreenMode
window.applyBigScreenMode = applyBigScreenMode