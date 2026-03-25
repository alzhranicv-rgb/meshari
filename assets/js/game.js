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
  } catch (e) {
    console.log("segment status save error:", e)
  }
}

let segmentStatus = loadSegmentStatus()

/* =========================
   Winner Sound + Effects
========================= */

let winnerSound = null
let winnerConfettiLayer = null
let winnerConfettiInterval = null

function initWinnerSound() {
  if (!winnerSound) {
    winnerSound = new Audio("sounds/win.mp3")
    winnerSound.preload = "auto"
    winnerSound.loop = true
  }
}

function playWinnerEffects() {
  initWinnerSound()
  stopWinnerEffects()

  try {
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

function createWinnerConfettiBurst(count = 24) {
  if (!winnerConfettiLayer) return

  for (let i = 0; i < count; i++) {
    const piece = document.createElement("span")
    piece.className = "winnerConfettiPiece"
    piece.style.left = `${Math.random() * 100}%`
    piece.style.animationDelay = `${Math.random() * 0.2}s`
    piece.style.animationDuration = `${2 + Math.random() * 1.2}s`
    winnerConfettiLayer.appendChild(piece)

    setTimeout(() => {
      piece.remove()
    }, 3800)
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

  createWinnerConfettiBurst(40)

  winnerConfettiInterval = setInterval(() => {
    createWinnerConfettiBurst(18)
  }, 700)
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

  if (winnerConfettiLayer) {
    winnerConfettiLayer.remove()
    winnerConfettiLayer = null
  }
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

document.addEventListener("DOMContentLoaded", () => {
  initWinnerSound()
  initGameSounds()
  bindAudioUnlock()

  segmentStatus = loadSegmentStatus()
  updateSegmentCards()

  localStorage.removeItem("active_segment")

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

function endGameAndGoIntro() {
  stopWinnerEffects()

  localStorage.removeItem("main_score_a")
  localStorage.removeItem("main_score_b")
  localStorage.removeItem("game_model")
  localStorage.removeItem("game_model_name")
  localStorage.removeItem("active_segment")
  localStorage.removeItem("segment_status_v1")

  localStorage.removeItem("warmup_state_v1")
  localStorage.removeItem("top10_state_v1")
  localStorage.removeItem("auction_state_v1")
  localStorage.removeItem("who_state_v1")
  localStorage.removeItem("final_state_v1")
  localStorage.removeItem("archive_state_v1")

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
    label.innerText = status.winner ? `الفائز: ${status.winner}` : ""
  }

  if (card) {
    if (status.locked) card.classList.add("segmentLocked")
    else card.classList.remove("segmentLocked")
  }
}

/* =========================
   Open Segment
========================= */

function openSegmentPage(segmentKey) {
  if (segmentStatus[segmentKey]?.locked) return

  homeRefreshLocked = true

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

  updateEndRoundButtonState()
  startEndButtonWatcher()
}

function goHome() {
  clearInterval(timer)
  timer = null
  window.currentSegmentScores = null
  homeRefreshLocked = false

  stopEndButtonWatcher()

  const content = document.querySelector(".segmentContentWrap")

  playSoftExit(content, () => {
    renderMainHome(true)
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

  goHome()
}

function getCurrentSegmentKey() {
  const title = document.querySelector(".segmentTitle")
  if (!title) return null

  const text = title.innerText

  if (text.includes("التسخين")) return "warmup"
  if (text.includes("Top 10")) return "top10"
  if (text.includes("المزاد")) return "auction"
  if (text.includes("من هو")) return "who"
  if (text.includes("الفاصلة")) return "final"
  if (text.includes("الأرشيف")) return "archive"

  return null
}

function canEndSegment(segmentKey) {
  if (segmentKey === "warmup") {
    if (!window.usedQuestions) return false
    return Object.keys(window.usedQuestions).length >= 12
  }

  if (segmentKey === "top10") {
    if (!window.top10State) return false
    return (
      window.top10State.round === 3 &&
      window.top10State.opened[1].length === 10 &&
      window.top10State.opened[2].length === 10 &&
      window.top10State.opened[3].length === 10
    )
  }

  if (segmentKey === "auction") {
    if (!window.auctionState) return false
    return window.auctionState.usedNumbers.length >= (window.auctionMaxNumber || 4)
  }

  if (segmentKey === "who") {
    if (!window.whoState) return false
    return window.whoState.usedNumbers.length >= 15
  }

  if (segmentKey === "final") {
    if (!window.finalOpenedNumbers) return false
    return window.finalOpenedNumbers.length >= 6
  }

  if (segmentKey === "archive") {
    if (!window.archiveState) return false

    const round1Items = window.archiveRoundCache?.[1]?.items || []
    const round2Items = window.archiveRoundCache?.[2]?.items || []
    const round3Items = window.archiveRoundCache?.[3]?.items || []

    const r1 = round1Items.length > 0 && round1Items.every(item => window.archiveRevealState?.[1]?.[item.position])
    const r2 = round2Items.length > 0 && round2Items.every(item => window.archiveRevealState?.[2]?.[item.position])
    const r3 = round3Items.length > 0 && round3Items.every(item => window.archiveRevealState?.[3]?.[item.position])

    return r1 && r2 && r3
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
  const toast = document.getElementById("gameToast")
  const text = document.getElementById("gameToastText")

  if (!toast || !text) return

  text.innerText = message
  toast.classList.remove("hidden")

  requestAnimationFrame(() => {
    toast.classList.add("show")
  })

  clearTimeout(gameToastTimer)
  gameToastTimer = setTimeout(() => {
    toast.classList.remove("show")

    setTimeout(() => {
      toast.classList.add("hidden")
    }, 280)
  }, 3000)
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