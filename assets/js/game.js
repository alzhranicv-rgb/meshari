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

let currentModel = Number(localStorage.getItem("game_model") || 0)
window.currentModel = currentModel

let currentModelName = localStorage.getItem("game_model_name") || ""
window.currentModelName = currentModelName
window.top10MaxRound = Number(localStorage.getItem("top10_max_round") || 3)
window.auctionMaxNumber = Number(localStorage.getItem("auction_max_number") || 8)
window.archiveMaxRound = Number(localStorage.getItem("archive_max_round") || 4)

const SEGMENT_STATUS_KEY = "segment_status_v1"

function defaultSegmentStatus() {
  return {
    warmup: { locked: false, winner: "" },
    top10: { locked: false, winner: "" },
    auction: { locked: false, winner: "" },
    who: { locked: false, winner: "" },
    final: { locked: false, winner: "" },
    archive: { locked: false, winner: "" }
  }
}

function loadSegmentStatus() {
  try {
    const saved = JSON.parse(localStorage.getItem(SEGMENT_STATUS_KEY) || "null")
    if (!saved) return defaultSegmentStatus()

    return {
      warmup: { locked: !!saved?.warmup?.locked, winner: saved?.warmup?.winner || "" },
      top10: { locked: !!saved?.top10?.locked, winner: saved?.top10?.winner || "" },
      auction: { locked: !!saved?.auction?.locked, winner: saved?.auction?.winner || "" },
      who: { locked: !!saved?.who?.locked, winner: saved?.who?.winner || "" },
      final: { locked: !!saved?.final?.locked, winner: saved?.final?.winner || "" },
      archive: { locked: !!saved?.archive?.locked, winner: saved?.archive?.winner || "" }
    }
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
      final: getSafeJson("final_state_v3"),
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
      if (presenterCommandChannel) {
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

  localStorage.setItem("top10_max_round", String(window.top10MaxRound))
  localStorage.setItem("auction_max_number", String(window.auctionMaxNumber))
  localStorage.setItem("archive_max_round", String(window.archiveMaxRound))
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
  if (key === "final") return ["segmentWinnerFinal", "winnerFinal"]
  if (key === "archive") return ["segmentWinnerArchive", "winnerArchive"]
  return []
}

function getSegmentCardIds(key) {
  if (key === "warmup") return ["segmentCardWarmup", "segmentWarmup"]
  if (key === "top10") return ["segmentCardTop10", "segmentTop10"]
  if (key === "auction") return ["segmentCardAuction", "segmentAuction"]
  if (key === "who") return ["segmentCardWho", "segmentWho"]
  if (key === "final") return ["segmentCardFinal", "segmentFinal"]
  if (key === "archive") return ["segmentCardArchive", "segmentArchive"]
  return []
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

document.addEventListener("DOMContentLoaded", async () => {
  initWinnerSound()
  initGameSounds()
  bindAudioUnlock()

  await loadDisplaySegmentCounts()

  segmentStatus = loadSegmentStatus()
  updateSegmentCards()

  renderMainHome(true)
})

/* =========================
   Main Home
========================= */

function renderMainHome(force = false) {
  if (homeRefreshLocked && !force) return

  const homeScreen = getFirstElement(["homeScreen", "homePage"])
  const segmentScreen = getFirstElement(["segmentScreen"])
  const segmentArea = document.getElementById("segmentArea")

  document.body.classList.remove("segmentMode")

  if (homeScreen) homeScreen.classList.remove("hidden")
  if (segmentScreen) segmentScreen.classList.add("hidden")
  if (segmentArea) segmentArea.innerHTML = ""

  stopEndButtonWatcher()

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
  if (team === "A") {
    scoreA++
    if (scoreA > 6) scoreA = 0
    localStorage.setItem("main_score_a", scoreA)
  }

  if (team === "B") {
    scoreB++
    if (scoreB > 6) scoreB = 0
    localStorage.setItem("main_score_b", scoreB)
  }

  updateMainScoreBoard()
  updateLeadingTeamStyle()

  if (team === "A") bumpScore("mainScoreA")
  if (team === "B") bumpScore("mainScoreB")
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
  localStorage.removeItem("final_state_v2")
  localStorage.removeItem("final_state_v3")
  localStorage.removeItem("archive_state_v1")

  localStorage.removeItem("game_session_id")
  localStorage.removeItem("game_join_code")

  const overlay = document.getElementById("winnerOverlay")
  if (overlay) overlay.classList.add("hidden")

  window.location.href = "intro.html"
}

/* =========================
   Segment Cards
========================= */

function updateSegmentCards() {
  setSegmentWinnerLabel("warmup")
  setSegmentWinnerLabel("top10")
  setSegmentWinnerLabel("auction")
  setSegmentWinnerLabel("who")
  setSegmentWinnerLabel("final")
  setSegmentWinnerLabel("archive")
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
  if (segmentStatus[segmentKey]?.locked) return

  await loadDisplayCountForSegment(segmentKey)

  homeRefreshLocked = true
  localStorage.setItem("active_segment", segmentKey)
  syncDisplayStateToSession()

  const homeScreen = getFirstElement(["homeScreen", "homePage"])
  const segmentScreen = getFirstElement(["segmentScreen"])

  document.body.classList.add("segmentMode")

  playSoftExit(homeScreen, () => {
    if (homeScreen) homeScreen.classList.add("hidden")
    if (segmentScreen) segmentScreen.classList.remove("hidden")

    if (segmentKey === "warmup") window.renderWarmup()
    if (segmentKey === "top10") window.renderTop10()
    if (segmentKey === "auction") window.renderAuction()
    if (segmentKey === "who") window.renderWho()
    if (segmentKey === "final") window.renderFinal()
    if (segmentKey === "archive") window.renderArchive()
  })
}

function openMainSegment(segmentKey) {
  openSegmentPage(segmentKey)
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
}

function correctAnswer() {
  unlockAudioContext()

  if (!selectedTeam) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  if (selectedTeam === "A") {
    scoreA++
    if (scoreA > 6) scoreA = 0
    localStorage.setItem("main_score_a", scoreA)
  }

  if (selectedTeam === "B") {
    scoreB++
    if (scoreB > 6) scoreB = 0
    localStorage.setItem("main_score_b", scoreB)
  }

  updateMainScoreBoard()
  updateLeadingTeamStyle()
}

function wrongAnswer() {
  clearInterval(timer)
  timer = null
  const timerBox = document.getElementById("timer")
  if (timerBox) timerBox.innerText = 0
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

  let lastTickPlayed = null
  timerBox.innerText = time

  timer = setInterval(() => {
    time--
    timerBox.innerText = time

    if (time > 0 && time <= 5 && lastTickPlayed !== time) {
      lastTickPlayed = time
      playGameSound("tick")
    }

    if (time <= 0) {
      clearInterval(timer)
      timer = null
      timerBox.innerText = 0
      playGameSound("timeout")
    }
  }, 1000)
}

/* =========================
   Finish Segment
========================= */

function endCurrentSegment() {
  const key = getCurrentSegmentKey()
  if (!key) return

  if (!canEndSegment(key)) {
    showGameToast("لا يمكن إنهاء الفقرة قبل إكمالها")
    updateEndRoundButtonState()
    return
  }

  const winner = getWinnerFromSegmentScores()

  if (winner === teamAName) {
    scoreA++
    localStorage.setItem("main_score_a", scoreA)
  }

  if (winner === teamBName) {
    scoreB++
    localStorage.setItem("main_score_b", scoreB)
  }

  updateMainScoreBoard()
  updateLeadingTeamStyle()
  syncDisplayStateToSession()

  if (!segmentStatus[key]) {
    segmentStatus[key] = { locked: false, winner: "" }
  }

  segmentStatus[key].locked = true
  segmentStatus[key].winner = winner

  saveSegmentStatus()
  updateSegmentCards()

  clearInterval(timer)
  timer = null

  localStorage.removeItem("active_segment")
  syncDisplayStateToSession()

  goHome()
}

function getCurrentSegmentKey() {
  const title = document.querySelector(".segmentTitle")
  if (!title) return null

  const text = title.innerText || ""

  if (text.includes("التسخين")) return "warmup"
  if (text.includes("Top 10")) return "top10"
  if (text.includes("فتبلة")) return "auction"
  if (text.includes("من هو")) return "who"
  if (text.includes("الفاصلة")) return "final"
  if (text.includes("الأرشيف")) return "archive"

  return localStorage.getItem("active_segment") || null
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
    return (window.whoState.usedNumbers || []).length >= 15
  }

if (segmentKey === "final") {
  if (!window.finalState) return false

  const r1Count = Number(window.finalState.round1?.cardsCount || 6)

  const r1Done =
    (window.finalState.round1?.opened || []).length >= r1Count

  const r2Done =
    (window.finalState.round2?.opened || []).length >= 4 &&
    (window.finalState.round2?.scoredNumbers || []).length >= 4

  let r3Done = false

  if (window.finalState.round3?.mode === "team_media") {
    r3Done =
      (window.finalState.round3?.teamMedia?.usedNumbers || []).length >= 4 &&
      (window.finalState.round3?.scoredNumbers || []).length >= 4
  } else {
    r3Done =
      (window.finalState.round3?.opened || []).length >= 2 &&
      (window.finalState.round3?.scoredNumbers || []).length >= 2
  }

  return r1Done && r2Done && r3Done
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

let gameToastTimer = null

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
  if (screenFlashLayer && document.body.contains(screenFlashLayer)) return screenFlashLayer

  screenFlashLayer = document.createElement("div")
  screenFlashLayer.className = "screenFlashLayer"
  document.body.appendChild(screenFlashLayer)
  return screenFlashLayer
}

function flashScreen(type = "correct") {
  const layer = ensureScreenFlashLayer()

  layer.classList.remove("flashCorrect", "flashWrong")
  void layer.offsetWidth

  if (type === "wrong") {
    layer.classList.add("flashWrong")
  } else {
    layer.classList.add("flashCorrect")
  }
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
}

function restoreDisplayControlsEye() {
  const isHidden = localStorage.getItem("presenter_hide_controls") === "1"
  document.body.classList.toggle("presenterHideDisplayControls", isHidden)
  updateDisplayControlsEyeButton(isHidden)
}
let joinCodePopTimer = null
function showJoinCodePopup() {
  const code = localStorage.getItem("game_join_code") || ""
  const modelName = localStorage.getItem("game_model_name") || currentModelName || "النموذج الحالي"

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

      <div class="homeModelClassicHeader">
        <div class="homeModelClassicLabel">النموذج الحالي</div>
        <div class="homeModelClassicName">${modelName}</div>
      </div>

      <div class="homeModelClassicBody">
        <div class="homeModelClassicCodeLabel">كود المقدم</div>
        <div class="homeModelClassicCode">${code}</div>
      </div>

      <button
        id="displayControlsEyeBtn"
        class="homeModelClassicControl ${isHidden ? "showControlsMode" : "hideControlsMode"}"
        type="button"
      >
        ${isHidden ? "إظهار أزرار التحكم" : "إخفاء أزرار التحكم"}
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

  box.classList.remove("hidden")
  box.classList.remove("show")
  void box.offsetWidth
  box.classList.add("show")

  clearTimeout(joinCodePopTimer)
  joinCodePopTimer = setTimeout(() => {
    hideJoinCodePopup()
  }, 10000)
}

function hideJoinCodePopup() {
  const box = document.getElementById("homeModelPopupArea")
  if (!box) return

  box.classList.remove("show")

  setTimeout(() => {
    box.classList.add("hidden")
    box.innerHTML = ""
  }, 240)
}
