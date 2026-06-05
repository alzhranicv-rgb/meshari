/* =========================
   FINAL - CLEAN ORGANIZED VERSION
   الفاصلة
========================= */


/* =========================
   1) GLOBALS / CONSTANTS
========================= */

let finalState = createDefaultFinalState()

window.finalState = finalState
window.finalOpenedNumbers = []

const FINAL_STORAGE_KEY = "final_state_v3"
const FINAL_HISTORY_LIMIT = 60

let currentFinalRound1Image = ""
let currentFinalRound3Image = ""
let finalHistory = []
let currentFinalSegmentKey = localStorage.getItem("active_segment") || "final"


/* =========================
   2) SEGMENT KEYS / TITLES
========================= */

function isFinalSplitSegmentKey(key) {
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

  return "final"
}

function getActiveFinalSegmentKey() {
  if (isFinalSplitSegmentKey(currentFinalSegmentKey)) {
    return currentFinalSegmentKey
  }

  const active = localStorage.getItem("active_segment")

  if (isFinalSplitSegmentKey(active)) {
    return active
  }

  return "final"
}

function isFinalSplitMode() {
  return isFinalSplitSegmentKey(getActiveFinalSegmentKey())
}

function getFinalDisplayTitle() {
  const key = getActiveFinalSegmentKey()

  if (key === "finalRound1") return "من بدون نقط"
  if (key === "finalRound2") return "صح صحلي"
  if (key === "finalRound3") return "التركيز"
  if (key === "finalRound4") return "اشرح الصورة"

  return "صح صحلي"
}

function getFinalForcedRoundFromArgs(forcedRound, forcedSegmentKey) {
  const fromKey = getFinalRoundFromSegmentKey(forcedSegmentKey)

  if (fromKey) return fromKey

  const active = localStorage.getItem("active_segment")
  const fromActive = getFinalRoundFromSegmentKey(active)

  if (fromActive) return fromActive

  const numericRound = Number(forcedRound || 0)

  if ([1, 2, 3, 4].includes(numericRound)) {
    return numericRound
  }

  return null
}


/* =========================
   3) DEFAULT STATE
========================= */

function createDefaultFinalState() {
  return {
    round: 1,

    doubleState: {
      used: { A: false, B: false },
      activeTeam: null
    },

    round1: {
      title: "من بدون نقط",
      cardsCount: 6,
      opened: [],
      activeTeam: null,
      scores: { A: 0, B: 0 },
      errors: { A: 0, B: 0 },
      currentNumber: null,
      currentAnswer: "",
      currentImage: "",
      currentNote: "",
      currentQuestionParts: [],
      shownQuestionPartsCount: 0,
      answerShown: false,
      pendingScore: false,
      cardTexts: {}
    },

    round2: {
      title: "صح صحلي",
      opened: [],
      scoredNumbers: [],
      activeTeam: null,
      scores: { A: 0, B: 0 },
      currentNumber: null,
      currentType: null,
      revealTimer: null,
      allWords: [],
      answers: [],
      hints: [],
      scrambledWords: [],
      currentRevealIndex: -1,
      hiddenSequence: [],
      selectedCorrectIndexes: [],
      answerShown: false,
      correctCount: 0,
      countdown: 15,
      pendingScore: false,
      assignedTeams: {
        scramble: {},
        sequence: {}
      },
      lastTeamPlayed: null
    },

    round3: {
      title: "التركيز",
      mode: "team_media",

      opened: [],
      scoredNumbers: [],
      activeTeam: null,
      scores: { A: 0, B: 0 },
      currentNumber: null,
      pendingScore: false,
      lastTeamPlayed: null,

      teamMedia: {
        usedNumbers: [],
        teamNumbers: { A: [], B: [] },
        currentNumber: null,
        currentTeam: null,
        currentMediaType: "",
        currentMedia: "",
        currentQuestion: "",
        currentAnswer: "",
        questionShown: false,
        answerShown: false,
        videoPlayed: false,
        resultType: ""
      }
    },

    round4: {
      title: "اشرح الصورة",

      opened: [],
      scoredNumbers: [],
      activeTeam: null,
      scores: { A: 0, B: 0 },
      currentNumber: null,

      images: [],
      answers: [],
      notes: [],
      sequenceTimer: null,
      shownCount: 0,
      correctCount: 0,
      pendingScore: false,
      answersAllowed: false,
      assignedTeams: {},
      lastTeamPlayed: null,
      selectedCorrectIndexes: []
    }
  }
}


/* =========================
   4) PERSISTENCE
========================= */

function getFinalState() {
  try {
    return JSON.parse(localStorage.getItem(FINAL_STORAGE_KEY) || "null")
  } catch {
    return null
  }
}

function saveFinalState() {
  ensureFinalStateShape()

  const safe = JSON.parse(JSON.stringify(finalState))

  if (safe.round2) safe.round2.revealTimer = null
  if (safe.round3) safe.round3.sequenceTimer = null
  if (safe.round4) safe.round4.sequenceTimer = null

  localStorage.setItem(FINAL_STORAGE_KEY, JSON.stringify(safe))
  localStorage.setItem("active_segment", getActiveFinalSegmentKey())

  syncFinalGlobals()

  if (typeof saveUnifiedGameState === "function") {
    saveUnifiedGameState()
  }

  if (typeof syncDisplayStateToSession === "function") {
    syncDisplayStateToSession()
  }
}

function restoreFinalState(saved) {
  if (!saved) return

  finalState = saved
  ensureFinalStateShape()

  if (finalState.round2) finalState.round2.revealTimer = null
  if (finalState.round3) finalState.round3.sequenceTimer = null
  if (finalState.round4) finalState.round4.sequenceTimer = null

  window.finalState = finalState
  syncFinalGlobals()
}


/* =========================
   5) ENSURE STATE
========================= */

function ensureFinalStateShape() {
  if (!finalState) finalState = createDefaultFinalState()

  if (!finalState.round1) finalState.round1 = createDefaultFinalState().round1
  if (!finalState.round2) finalState.round2 = createDefaultFinalState().round2
  if (!finalState.round3) finalState.round3 = createDefaultFinalState().round3
  if (!finalState.round4) finalState.round4 = createDefaultFinalState().round4

  ensureFinalDoubleState()
  ensureFinalRound1State()
  ensureFinalRound2State()
  ensureFinalRound3State()
  ensureFinalRound4State()
}

function ensureFinalDoubleState() {
  if (!finalState.doubleState) {
    finalState.doubleState = {
      used: { A: false, B: false },
      activeTeam: null
    }
  }

  if (!finalState.doubleState.used) {
    finalState.doubleState.used = { A: false, B: false }
  }

  finalState.doubleState.used.A = !!finalState.doubleState.used.A
  finalState.doubleState.used.B = !!finalState.doubleState.used.B
}

function ensureFinalRound1State() {
  const r = finalState.round1
  const d = createDefaultFinalState().round1

  r.title = r.title || d.title
  r.cardsCount = Number(r.cardsCount || 6)
  if (r.cardsCount < 6) r.cardsCount = 6

  if (!Array.isArray(r.opened)) r.opened = []
  if (!r.scores) r.scores = { A: 0, B: 0 }
  if (!r.errors) r.errors = { A: 0, B: 0 }
  if (!Array.isArray(r.currentQuestionParts)) r.currentQuestionParts = []
  if (!r.cardTexts) r.cardTexts = {}

  r.scores.A = Number(r.scores.A || 0)
  r.scores.B = Number(r.scores.B || 0)
  r.errors.A = Number(r.errors.A || 0)
  r.errors.B = Number(r.errors.B || 0)
  r.shownQuestionPartsCount = Number(r.shownQuestionPartsCount || 0)
  r.answerShown = !!r.answerShown
  r.pendingScore = !!r.pendingScore
}

function ensureFinalRound2State() {
  const r = finalState.round2
  const d = createDefaultFinalState().round2

  r.title = r.title || d.title

  if (!Array.isArray(r.opened)) r.opened = []
  if (!Array.isArray(r.scoredNumbers)) r.scoredNumbers = []
  if (!r.scores) r.scores = { A: 0, B: 0 }
  if (!Array.isArray(r.allWords)) r.allWords = []
  if (!Array.isArray(r.answers)) r.answers = []
  if (!Array.isArray(r.hints)) r.hints = []
  if (!Array.isArray(r.scrambledWords)) r.scrambledWords = []
  if (!Array.isArray(r.hiddenSequence)) r.hiddenSequence = []
  if (!Array.isArray(r.selectedCorrectIndexes)) r.selectedCorrectIndexes = []

  if (!r.assignedTeams) {
    r.assignedTeams = { scramble: {}, sequence: {} }
  }

  if (!r.assignedTeams.scramble) r.assignedTeams.scramble = {}
  if (!r.assignedTeams.sequence) r.assignedTeams.sequence = {}

  r.scores.A = Number(r.scores.A || 0)
  r.scores.B = Number(r.scores.B || 0)
  r.correctCount = Number(r.correctCount || 0)
  r.countdown = Number(r.countdown ?? 15)
  r.pendingScore = !!r.pendingScore
  r.answerShown = !!r.answerShown
}

function ensureFinalRound3State() {
  const r = finalState.round3
  const d = createDefaultFinalState().round3

  r.title = "التركيز"
  r.mode = "team_media"

  if (!Array.isArray(r.opened)) r.opened = []
  if (!Array.isArray(r.scoredNumbers)) r.scoredNumbers = []
  if (!r.scores) r.scores = { A: 0, B: 0 }

  r.scores.A = Number(r.scores.A || 0)
  r.scores.B = Number(r.scores.B || 0)
  r.pendingScore = !!r.pendingScore

  if (!r.teamMedia) r.teamMedia = d.teamMedia

  const m = r.teamMedia

  if (!Array.isArray(m.usedNumbers)) m.usedNumbers = []
  if (!m.teamNumbers) m.teamNumbers = { A: [], B: [] }
  if (!Array.isArray(m.teamNumbers.A)) m.teamNumbers.A = []
  if (!Array.isArray(m.teamNumbers.B)) m.teamNumbers.B = []

  m.currentMediaType = String(m.currentMediaType || "")
  m.currentMedia = String(m.currentMedia || "")
  m.currentQuestion = String(m.currentQuestion || "")
  m.currentAnswer = String(m.currentAnswer || "")
  m.questionShown = !!m.questionShown
  m.answerShown = !!m.answerShown
  m.videoPlayed = !!m.videoPlayed
  m.resultType = String(m.resultType || "")
}

function ensureFinalRound4State() {
  const r = finalState.round4

  r.title = "اشرح الصورة"

  if (!Array.isArray(r.opened)) r.opened = []
  if (!Array.isArray(r.scoredNumbers)) r.scoredNumbers = []
  if (!r.scores) r.scores = { A: 0, B: 0 }

  if (!Array.isArray(r.images)) r.images = []
  if (!Array.isArray(r.answers)) r.answers = []
  if (!Array.isArray(r.notes)) r.notes = []
  if (!Array.isArray(r.selectedCorrectIndexes)) r.selectedCorrectIndexes = []
  if (!r.assignedTeams) r.assignedTeams = {}

  r.scores.A = Number(r.scores.A || 0)
  r.scores.B = Number(r.scores.B || 0)
  r.correctCount = Number(r.correctCount || 0)
  r.shownCount = Number(r.shownCount || 0)
  r.pendingScore = !!r.pendingScore
  r.answersAllowed = !!r.answersAllowed
}


/* =========================
   6) UNDO
========================= */

function cloneFinalData(data) {
  return JSON.parse(JSON.stringify(data))
}

function createFinalSnapshot() {
  return {
    finalState: cloneFinalData(finalState),
    currentFinalRound1Image,
    currentFinalRound3Image
  }
}

function pushFinalHistory() {
  finalHistory.push(createFinalSnapshot())

  if (finalHistory.length > FINAL_HISTORY_LIMIT) {
    finalHistory.shift()
  }

  updateFinalUndoButtonState()
}

function restoreFinalSnapshot(snapshot) {
  if (!snapshot) return

  clearFinalIntervals()

  finalState = cloneFinalData(snapshot.finalState)
  currentFinalRound1Image = snapshot.currentFinalRound1Image || ""
  currentFinalRound3Image = snapshot.currentFinalRound3Image || ""

  ensureFinalStateShape()
  window.finalState = finalState

  renderFinalRound()
  updateEndRoundButtonState()
  updateFinalUndoButtonState()
  saveFinalState()
}

function undoFinalAction() {
  if (!finalHistory.length) {
    showGameToast("لا يوجد خطوة للتراجع")
    return
  }

  const snapshot = finalHistory.pop()
  restoreFinalSnapshot(snapshot)
}

function updateFinalUndoButtonState() {
  const btns = document.querySelectorAll(".finalUndoBtn")
  btns.forEach(btn => {
    btn.disabled = finalHistory.length === 0
  })
}


/* =========================
   7) SHARED HELPERS
========================= */

function getFinalCurrentRoundState() {
  if (finalState.round === 1) return finalState.round1
  if (finalState.round === 2) return finalState.round2
  if (finalState.round === 3) return finalState.round3
  if (finalState.round === 4) return finalState.round4

  return null
}

function getOtherTeam(team) {
  return team === "A" ? "B" : "A"
}

function getFinalStatusTeamName() {
  let team = null

  if (finalState.round === 1) team = finalState.round1.activeTeam
  if (finalState.round === 2) team = finalState.round2.activeTeam

  if (finalState.round === 3) {
    team = finalState.round3.teamMedia.currentTeam || finalState.round3.activeTeam
  }

  if (finalState.round === 4) team = finalState.round4.activeTeam

  if (team === "A") return teamAName || "الفريق الأول"
  if (team === "B") return teamBName || "الفريق الثاني"

  return "اختر الفريق"
}

function getFinalStatusDetails() {
  const teamName = getFinalStatusTeamName()

  if (finalState.round === 1) {
    return `من بدون نقط  •  الفريق المختار: ${teamName}`
  }

  if (finalState.round === 2) {
    return `صح صحلي  •  الفريق المختار: ${teamName}`
  }

  if (finalState.round === 3) {
    return `التركيز  •  الفريق المختار: ${teamName}`
  }

  if (finalState.round === 4) {
    return `اشرح الصورة  •  الفريق المختار: ${teamName}`
  }

  return "صح صحلي"
}

function renderFinalCenterStatus() {
  const box = document.getElementById("finalCenterStatusText")
  if (!box) return

  box.innerText = getFinalStatusDetails()
}

function getFinalCurrentNumberText() {
  if (finalState.round === 1) {
    const n = finalState.round1.currentNumber
    return n ? `رقم ${n}` : "اختر رقم"
  }

  if (finalState.round === 2) {
    const n = finalState.round2.currentNumber
    return n ? `رقم ${n}` : "اختر رقم"
  }

  if (finalState.round === 3) {
    const n =
      finalState.round3.teamMedia.currentNumber ||
      finalState.round3.currentNumber

    return n ? `رقم ${n}` : "اختر رقم"
  }

  if (finalState.round === 4) {
    const n = finalState.round4.currentNumber
    return n ? `رقم ${n}` : "اختر رقم"
  }

  return "اختر رقم"
}

function getFinalActiveTurnTeam() {
  if (finalState.round === 1) return finalState.round1.activeTeam || null
  if (finalState.round === 2) return finalState.round2.activeTeam || "A"

  if (finalState.round === 3) {
    return (
      finalState.round3.teamMedia.currentTeam ||
      finalState.round3.activeTeam ||
      "A"
    )
  }

  if (finalState.round === 4) return finalState.round4.activeTeam || "A"

  return null
}

function getFinalTurnTeamName() {
  const team = getFinalActiveTurnTeam()

  if (team === "A") return teamAName || "الفريق الأول"
  if (team === "B") return teamBName || "الفريق الثاني"

  return "اختر فريق"
}

function getFinalTurnTeamClass() {
  const team = getFinalActiveTurnTeam()

  if (team === "A") return "teamA"
  if (team === "B") return "teamB"

  return "noTeam"
}

function getFinalRoundTextLabel() {
  if (finalState.round === 1) return "من بدون نقط"
  if (finalState.round === 2) return "صح صحلي"
  if (finalState.round === 3) return "التركيز"
  if (finalState.round === 4) return "اشرح الصورة"

  return "صح صحلي"
}

function updateFinalTopHeaderRoundInfo() {
  const roundNumber = Number(finalState.round || 1)
  const roundTitle = getFinalRoundTextLabel()

  const titleBox =
    document.querySelector(".segmentTitle") ||
    document.querySelector(".displaySegmentTitle") ||
    document.querySelector(".mainSegmentTitle") ||
    document.querySelector(".currentSegmentTitle") ||
    document.querySelector(".segmentHeaderTitle") ||
    document.querySelector(".displayHeaderTitle") ||
    document.querySelector(".topSegmentTitle")

  if (!titleBox) return

  let badge = document.getElementById("finalTopRoundBadge")

  if (!badge) {
    badge = document.createElement("span")
    badge.id = "finalTopRoundBadge"
    badge.className = "finalTopRoundBadge"
    titleBox.appendChild(badge)
  }

  badge.innerHTML = `
    <span class="finalTopRoundNumber">${roundNumber}</span>
    <span class="finalTopRoundName">${roundTitle}</span>
  `
}

function renderFinalStatusPanel() {
  const box = document.getElementById("finalStatusPanel")
  if (!box) return

  box.innerHTML = `
    <div class="finalStatusText">
      ${getFinalStatusDetails()}
    </div>
  `
}

function renderFinalTurnBar() {
  const box = document.getElementById("finalTurnBar")
  if (!box) return

  const teamClass = getFinalTurnTeamClass()
  const teamName = getFinalTurnTeamName()
  const numberText = getFinalCurrentNumberText()

  box.className = `finalTurnBar finalTurnBarHeader ${teamClass}`

  box.innerHTML = `
    <div class="finalTurnMain">
      <span class="finalTurnBadge">الدور الآن</span>
      <strong class="finalTurnTeam">${teamName}</strong>
    </div>

    <div class="finalTurnInfo">
      <span>${numberText}</span>
    </div>
  `
}

function getFinalAutoTeam(round) {
  if (round !== 2 && round !== 3 && round !== 4) return null

  const state =
    round === 2
      ? finalState.round2
      : round === 3
        ? finalState.round3
        : finalState.round4

  if (state.activeTeam === "A" || state.activeTeam === "B") {
    return state.activeTeam
  }

  return "A"
}

function setFinalAutoTeam(round) {
  const team = getFinalAutoTeam(round)

  if (!team) return null

  if (round === 2) {
    finalState.round2.activeTeam = team
  }

  if (round === 3) {
    finalState.round3.activeTeam = team

    if (finalState.round3.teamMedia) {
      finalState.round3.teamMedia.currentTeam =
        finalState.round3.teamMedia.currentTeam || team
    }
  }

  if (round === 4) {
    finalState.round4.activeTeam = team
  }

  highlightFinalTeam(team)
  renderFinalRoundTitle()
  renderFinalTurnBar()
  saveFinalState()

  return team
}

function moveFinalTurnToNextTeam(round, currentTeam = null) {
  if (round !== 2 && round !== 3 && round !== 4) return

  const state =
    round === 2
      ? finalState.round2
      : round === 3
        ? finalState.round3
        : finalState.round4

  const team =
    currentTeam ||
    state.lastTeamPlayed ||
    state.activeTeam ||
    "A"

  const nextTeam = getOtherTeam(team)

  state.activeTeam = nextTeam

  if (round === 3 && finalState.round3.teamMedia) {
    finalState.round3.teamMedia.currentTeam = null
  }

  highlightFinalTeam(nextTeam)
  renderFinalRoundTitle()
  renderFinalTurnBar()
  saveFinalState()
}

function getRound2GroupKey(number) {
  return number === 1 || number === 3 ? "scramble" : "sequence"
}

function clearFinalIntervals() {
  if (finalState.round2?.revealTimer) {
    clearInterval(finalState.round2.revealTimer)
    finalState.round2.revealTimer = null
  }

  if (finalState.round3?.sequenceTimer) {
    clearInterval(finalState.round3.sequenceTimer)
    finalState.round3.sequenceTimer = null
  }

  if (finalState.round4?.sequenceTimer) {
    clearInterval(finalState.round4.sequenceTimer)
    finalState.round4.sequenceTimer = null
  }
}

function setFinalControlsMode(mode) {
  const controls = document.getElementById("finalControlsBar")
  if (!controls) return

  controls.classList.remove(
    "finalRound1ControlsBar",
    "finalRound2ControlsBar",
    "finalRound3ControlsBar"
  )

  if (mode === 1) controls.classList.add("finalRound1ControlsBar")
  if (mode === 2) controls.classList.add("finalRound2ControlsBar")
  if (mode === 3) controls.classList.add("finalRound3ControlsBar")
}

function resetFinalTeamSelection() {
  finalState.round1.activeTeam = null
  finalState.round2.activeTeam = null
  finalState.round3.activeTeam = null
  finalState.round4.activeTeam = null

  const a = document.getElementById("finalTeamABox")
  const b = document.getElementById("finalTeamBBox")

  if (a) a.classList.remove("activeTeam")
  if (b) b.classList.remove("activeTeam")

  updateFinalDoubleButton()
}

function highlightFinalTeam(team) {
  const a = document.getElementById("finalTeamABox")
  const b = document.getElementById("finalTeamBBox")

  if (a) a.classList.remove("activeTeam")
  if (b) b.classList.remove("activeTeam")

  if (team === "A" && a) a.classList.add("activeTeam")
  if (team === "B" && b) b.classList.add("activeTeam")

  updateFinalDoubleButton()
  renderFinalCenterStatus()
}

function shuffleArabicWord(text) {
  function shuffleWord(word) {
    const chars = String(word || "").split("")
    if (chars.length <= 1) return word

    const original = chars.join("")
    let shuffled = original
    let attempts = 0

    while (shuffled === original && attempts < 20) {
      const arr = [...chars]

      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[arr[i], arr[j]] = [arr[j], arr[i]]
      }

      shuffled = arr.join("")
      attempts++
    }

    if (shuffled === original && chars.length > 1) {
      const arr = [...chars]
      ;[arr[0], arr[1]] = [arr[1], arr[0]]
      shuffled = arr.join("")
    }

    return shuffled
  }

  return String(text || "")
    .split(/(\s+)/)
    .map(part => {
      if (/^\s+$/.test(part)) return part
      return shuffleWord(part)
    })
    .join("")
}

function removeArabicDots(text = "") {
  return String(text)
    .replace(/ي/g, "ى")
    .replace(/[بتث]/g, "ٮ")
    .replace(/[جخ]/g, "ح")
    .replace(/ذ/g, "د")
    .replace(/ز/g, "ر")
    .replace(/ش/g, "س")
    .replace(/ض/g, "ص")
    .replace(/ظ/g, "ط")
    .replace(/غ/g, "ع")
    .replace(/ف/g, "ڡ")
    .replace(/ق/g, "ٯ")
    .replace(/ن/g, "ں")
}

function getFinalRound1ClipStyle(text = "", zoom = false) {
  const clean = String(text || "").trim()
  const len = clean.length

  let size = zoom ? "clamp(2.1rem, 2.8vw, 3rem)" : "clamp(1.7rem, 2.2vw, 2.45rem)"
  let line = zoom ? "1.95" : "1.82"

  if (len > 90) {
    size = zoom ? "clamp(1.8rem, 2.45vw, 2.55rem)" : "clamp(1.45rem, 1.95vw, 2rem)"
    line = zoom ? "1.86" : "1.72"
  }

  if (len > 140) {
    size = zoom ? "clamp(1.55rem, 2.1vw, 2.2rem)" : "clamp(1.22rem, 1.65vw, 1.7rem)"
    line = zoom ? "1.75" : "1.58"
  }

  if (len > 190) {
    size = zoom ? "clamp(1.35rem, 1.8vw, 1.9rem)" : "clamp(1.05rem, 1.42vw, 1.45rem)"
    line = zoom ? "1.62" : "1.46"
  }

  return `font-family:'MolhimCustom','HanakaText',sans-serif !important;font-size:${size};line-height:${line};text-wrap:balance;`
}


/* =========================
   8) SCORES / GLOBAL SYNC
========================= */

function syncFinalGlobals() {
  const key = getActiveFinalSegmentKey()

  const r1A = Number(finalState.round1?.scores?.A || 0)
  const r1B = Number(finalState.round1?.scores?.B || 0)

  const r2A = Number(finalState.round2?.scores?.A || 0)
  const r2B = Number(finalState.round2?.scores?.B || 0)

  const r3A = Number(finalState.round3?.scores?.A || 0)
  const r3B = Number(finalState.round3?.scores?.B || 0)

  const r4A = Number(finalState.round4?.scores?.A || 0)
  const r4B = Number(finalState.round4?.scores?.B || 0)

  let totalA = r1A + r2A + r3A + r4A
  let totalB = r1B + r2B + r3B + r4B

  if (key === "finalRound1") {
    totalA = r1A
    totalB = r1B
  }

  if (key === "finalRound2") {
    totalA = r2A
    totalB = r2B
  }

  if (key === "finalRound3") {
    totalA = r3A
    totalB = r3B
  }

  if (key === "finalRound4") {
    totalA = r4A
    totalB = r4B
  }

  window.currentSegmentScores = { A: totalA, B: totalB }

  window.finalOpenedNumbers = [
    ...(finalState.round1?.opened || []).map(x => `r1-${x}`),
    ...(finalState.round2?.opened || []).map(x => `r2-${x}`),
    ...(finalState.round3?.opened || []).map(x => `r3-${x}`),
    ...(finalState.round4?.opened || []).map(x => `r4-${x}`)
  ]

  window.finalState = finalState
}

function renderFinalScores() {
  const a = document.getElementById("finalScoreA")
  const b = document.getElementById("finalScoreB")

  const key = getActiveFinalSegmentKey()

  const r1A = Number(finalState.round1?.scores?.A || 0)
  const r1B = Number(finalState.round1?.scores?.B || 0)

  const r2A = Number(finalState.round2?.scores?.A || 0)
  const r2B = Number(finalState.round2?.scores?.B || 0)

  const r3A = Number(finalState.round3?.scores?.A || 0)
  const r3B = Number(finalState.round3?.scores?.B || 0)

  const r4A = Number(finalState.round4?.scores?.A || 0)
  const r4B = Number(finalState.round4?.scores?.B || 0)

  let totalA = r1A + r2A + r3A + r4A
  let totalB = r1B + r2B + r3B + r4B

  if (key === "finalRound1") {
    totalA = r1A
    totalB = r1B
  }

  if (key === "finalRound2") {
    totalA = r2A
    totalB = r2B
  }

  if (key === "finalRound3") {
    totalA = r3A
    totalB = r3B
  }

  if (key === "finalRound4") {
    totalA = r4A
    totalB = r4B
  }

  if (a) a.innerText = totalA
  if (b) b.innerText = totalB
}

function renderFinalErrors() {
  const boxA = document.getElementById("finalErrorsA")
  const boxB = document.getElementById("finalErrorsB")

  if (!boxA || !boxB) return

  boxA.innerHTML = ""
  boxB.innerHTML = ""
}

function renderFinalTeamLayout() {
  const wrap = document.getElementById("finalScoreBoards")
  if (!wrap) return

  wrap.classList.remove("finalTeamsRound1", "finalTeamsRoundOther")

  if (finalState.round === 1) {
    wrap.classList.add("finalTeamsRound1")
  } else {
    wrap.classList.add("finalTeamsRoundOther")
  }
}

function isFinalRoundFinished(round) {
  if (round === 1) {
    return finalState.round1.opened.length >= Number(finalState.round1.cardsCount || 6)
  }

  if (round === 2) {
    return finalState.round2.opened.length >= 4 &&
      finalState.round2.scoredNumbers.length >= 4
  }

  if (round === 3) {
  const total = getFinalRound3Count()

  return finalState.round3.teamMedia.usedNumbers.length >= total &&
    finalState.round3.scoredNumbers.length >= total
}

  if (round === 4) {
    return finalState.round4.opened.length >= 2 &&
      finalState.round4.scoredNumbers.length >= 2
  }

  return false
}


/* =========================
   9) DOUBLE
========================= */

function activateFinalDouble() {
  ensureFinalDoubleState()

  const roundState = getFinalCurrentRoundState()
  const team = roundState?.activeTeam

  if (!team) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  if (finalState.round === 1) {
    if (!finalState.round1.pendingScore || finalState.round1.currentNumber === null) {
      showGameToast("اختر الرقم أولاً")
      return
    }

    if (
      finalState.round1.answerShown ||
      Number(finalState.round1.shownQuestionPartsCount || 0) > 0
    ) {
      showGameToast("الدبل قبل ظهور السؤال فقط")
      return
    }
  } else {
    if (roundState.pendingScore || roundState.currentNumber !== null) {
      showGameToast("الدبل قبل اختيار الرقم فقط")
      return
    }
  }

  if (finalState.doubleState.used[team]) {
    showGameToast("هذا الفريق استخدم الدبل مسبقًا في صح صحلي")
    return
  }

  pushFinalHistory()

  finalState.doubleState.used[team] = true
  finalState.doubleState.activeTeam = team

  showGameToast(`تم تفعيل الدبل لفريق ${team === "A" ? teamAName : teamBName}`)

  updateFinalDoubleButton()
  saveFinalState()
}

function getFinalScoreValue(team, base) {
  ensureFinalDoubleState()

  const points = Number(base || 0)
  return finalState.doubleState.activeTeam === team ? points * 2 : points
}

function clearFinalActiveDouble() {
  ensureFinalDoubleState()
  finalState.doubleState.activeTeam = null
}

function updateFinalDoubleButton() {
  ensureFinalDoubleState()

  const btn = document.getElementById("finalDoubleBtn")
  if (!btn) return

  const roundState = getFinalCurrentRoundState()
  const team = roundState?.activeTeam

  btn.classList.remove("activeDouble")

  if (finalState.round === 1) {
    if (
      !finalState.round1.pendingScore ||
      finalState.round1.currentNumber === null ||
      finalState.round1.answerShown ||
      Number(finalState.round1.shownQuestionPartsCount || 0) > 0
    ) {
      btn.disabled = true
      btn.innerText = "دبل"
      return
    }
  } else {
    if (roundState?.pendingScore || roundState?.currentNumber !== null) {
      btn.disabled = true
      btn.innerText = "دبل"
      return
    }
  }

  if (!team) {
    btn.disabled = finalState.doubleState.used.A && finalState.doubleState.used.B
    btn.innerText = "دبل"
    return
  }

  if (finalState.doubleState.activeTeam === team) {
    btn.disabled = true
    btn.innerText = "دبل مفعّل"
    btn.classList.add("activeDouble")
    return
  }

  if (finalState.doubleState.used[team]) {
    btn.disabled = true
    btn.innerText = "استخدم الدبل"
    return
  }

  btn.disabled = false
  btn.innerText = "دبل"
}


/* =========================
   10) INIT / MAIN RENDER
========================= */

window.renderFinal = async function (forcedRound = null, forcedSegmentKey = null) {
  const saved = getFinalState()
  finalHistory = []

  clearFinalIntervals()

  const targetRound = getFinalForcedRoundFromArgs(forcedRound, forcedSegmentKey)

  if (forcedSegmentKey && isFinalSplitSegmentKey(forcedSegmentKey)) {
    currentFinalSegmentKey = forcedSegmentKey
  } else if (targetRound && isFinalSplitSegmentKey(localStorage.getItem("active_segment"))) {
    currentFinalSegmentKey = localStorage.getItem("active_segment")
  } else if (targetRound) {
    currentFinalSegmentKey = getFinalSegmentKeyFromRound(targetRound)
  } else {
    currentFinalSegmentKey = "final"
  }

  if (saved) {
    restoreFinalState(saved)
  } else {
    finalState = createDefaultFinalState()
    window.finalState = finalState
    syncFinalGlobals()
  }

  await loadFinalRoundMeta()
  await loadFinalRound1CardTexts()

  if (targetRound) {
    finalState.round = targetRound
  }

  openSegment(getFinalDisplayTitle(), buildFinalHTML())
  renderFinalRound()
  saveFinalState()
  updateEndRoundButtonState()
  updateFinalUndoButtonState()
}

async function loadFinalRoundMeta() {
  const { data, error } = await db
    .from("final_round_meta")
    .select("*")
    .eq("model", Number(currentModel))
    .order("round", { ascending: true })

  if (error) {
    console.log(error)
    return
  }

  ;(data || []).forEach(row => {
    if (row.round === 1) {
      finalState.round1.title = "من بدون نقط"
      finalState.round1.cardsCount = Number(row.cards_count || 6)
    }

    if (row.round === 2) {
      finalState.round2.title = "صح صحلي"
    }

    if (row.round === 3) {
      finalState.round3.title = "التركيز"
      finalState.round3.mode = "team_media"
    }
  })

  ensureFinalStateShape()
}

async function loadFinalRound1CardTexts() {
  const cardsCount = Number(finalState.round1.cardsCount || 6)
  const numbers = Array.from({ length: cardsCount }, (_, i) => i + 1)

  const { data, error } = await db
    .from("final_round1_items")
    .select("number, card_text, question_part1, question_part2, question_part3")
    .eq("model", Number(currentModel))
    .in("number", numbers)

  if (error) {
    console.log(error)
    return
  }

  finalState.round1.cardTexts = {}

  ;(data || []).forEach(row => {
    finalState.round1.cardTexts[row.number] = row.card_text || ""
  })
}

function buildFinalHTML() {
  return `
    <div class="finalWrapNew">

      <div class="finalScoreBoards" id="finalScoreBoards">

        <div class="finalScorePanel finalScorePanelLeft" id="finalTeamABox" onclick="selectFinalTeam('A')">
          <div class="finalScoreTeamNameBox finalScoreTeamNameFix">${teamAName}</div>
          <div class="finalScoreErrorsBox" id="finalErrorsA"></div>
          <div class="finalScoreValueBox" id="finalScoreA">0</div>
        </div>

        <div class="finalScoreCenterPanel finalCenterMiniGlass">
          <div class="finalCenterStatusText" id="finalCenterStatusText">
            اختر الفريق
          </div>
        </div>

        <div class="finalScorePanel finalScorePanelRight" id="finalTeamBBox" onclick="selectFinalTeam('B')">
          <div class="finalScoreValueBox" id="finalScoreB">0</div>
          <div class="finalScoreErrorsBox" id="finalErrorsB"></div>
          <div class="finalScoreTeamNameBox finalScoreTeamNameFix">${teamBName}</div>
        </div>

      </div>

      <div class="finalMainStage" id="finalMainStage"></div>
      <div class="finalControlsBar" id="finalControlsBar"></div>

    </div>
  `
}

function renderFinalRound() {
  clearFinalIntervals()
  ensureFinalStateShape()

  renderFinalTabs()
  renderFinalScores()
  renderFinalErrors()
  renderFinalRoundTitle()
  updateFinalTopHeaderRoundInfo()
  renderFinalTeamLayout()
  renderFinalTurnBar()

  if (finalState.round === 1) renderFinalRound1()
  if (finalState.round === 2) renderFinalRound2()
  if (finalState.round === 3) renderFinalRound3()
  if (finalState.round === 4) renderFinalRound4()

  updateFinalDoubleButton()
  syncFinalGlobals()
  saveFinalState()
  updateFinalUndoButtonState()
}

function renderFinalTabs() {
  for (const n of [1, 2, 3, 4]) {
    const btn = document.getElementById(`finalRoundTab${n}`)
    if (!btn) continue

    btn.classList.remove("activeFinalRoundTab", "doneFinalRoundTab")

    if (finalState.round === n) btn.classList.add("activeFinalRoundTab")
    if (isFinalRoundFinished(n)) btn.classList.add("doneFinalRoundTab")
  }
}

function renderFinalRoundTitle() {
  const titleBox = document.getElementById("finalRoundTitleBar")
  const centerTop = document.getElementById("finalRoundCenterTop")
  const centerNum = document.getElementById("finalRoundCenterNum")
  const centerBottom = document.getElementById("finalRoundCenterBottom")
  const boards = document.getElementById("finalScoreBoards")

  if (titleBox) titleBox.innerText = ""

  if (boards) {
    boards.classList.remove("finalBoardRound1", "finalBoardRoundOther", "finalRound1Mode")

    if (finalState.round === 1) {
      boards.classList.add("finalBoardRound1", "finalRound1Mode")
    } else {
      boards.classList.add("finalBoardRoundOther")
    }
  }

  if (centerTop) centerTop.innerText = ""
  if (centerNum) centerNum.innerText = ""
  if (centerBottom) centerBottom.innerText = ""

  renderFinalCenterStatus()
}

function selectFinalTeam(team) {
  if (finalState.round === 1) {
    if (!finalState.round1.pendingScore || finalState.round1.currentNumber === null) {
      showGameToast("اختر الرقم أولاً")
      return
    }

    finalState.round1.activeTeam =
      finalState.round1.activeTeam === team ? null : team
  }

  if (finalState.round === 2) {
    finalState.round2.activeTeam =
      finalState.round2.activeTeam === team ? null : team
  }

  if (finalState.round === 3) {
    finalState.round3.activeTeam =
      finalState.round3.activeTeam === team ? null : team
  }

  if (finalState.round === 4) {
    finalState.round4.activeTeam =
      finalState.round4.activeTeam === team ? null : team
  }

  const current = getFinalCurrentRoundState()

  highlightFinalTeam(current?.activeTeam || null)
  renderFinalRoundTitle()
  renderFinalTurnBar()
  updateFinalDoubleButton()
  saveFinalState()
}

function goToFinalRound(round) {
  if (isFinalSplitMode()) {
    showGameToast("هذه الجولة مستقلة")
    return
  }

  if (round === finalState.round) return

  if (round > finalState.round && !isFinalRoundFinished(finalState.round)) {
    showGameToast("أنهِ الجولة الحالية أولاً")
    return
  }

  pushFinalHistory()

  finalState.round = round
  resetFinalTeamSelection()

  renderFinalRound()
  updateFinalTopHeaderRoundInfo()
  updateEndRoundButtonState()
}

/* =========================
   11) ROUND 1 - من بدون نقط
========================= */
function getFinalRound1NoDotsCount() {
  const cardsCount = Number(finalState.round1.cardsCount || 6)
  return cardsCount === 8 ? 4 : 3
}

function isFinalRound1TextCard(number) {
  return Number(number) >= 1 && Number(number) <= getFinalRound1NoDotsCount()
}

function isFinalRound1QuestionCard(number) {
  const cardsCount = Number(finalState.round1.cardsCount || 6)
  const noDotsCount = getFinalRound1NoDotsCount()

  return Number(number) > noDotsCount && Number(number) <= cardsCount
}


function renderFinalRound1() {
  const stage = document.getElementById("finalMainStage")
  const controls = document.getElementById("finalControlsBar")
  if (!stage || !controls) return

  setFinalControlsMode(1)

  const cardsCount = Number(finalState.round1.cardsCount || 6)
  let cards = []

  for (let i = 1; i <= cardsCount; i++) {
    const opened = finalState.round1.opened.includes(i)

    cards.push(`
      <button
        class="finalRound1Card ${opened ? "used" : ""}"
        ${opened ? "disabled" : ""}
        onclick="openFinalRound1Card(${i})"
      >
        ${i}
      </button>
    `)
  }

  if (finalState.round1.currentNumber) {
    document.body.classList.add("round1-image-mode")

    stage.innerHTML = `
      <div class="finalRound1PlayLayout">
        <div class="finalRound1TopNumbersBar">
          <div class="finalRound1GridSingleRow">
            ${cards.join("")}
          </div>
        </div>

        <div class="finalRound1ContentShell" id="finalRound1ImageStage"></div>
      </div>
    `
  } else {
    document.body.classList.remove("round1-image-mode")

    stage.innerHTML = `
      <div class="finalRound1StartView">
        <div class="finalRound1GridSingleRow">
          ${cards.join("")}
        </div>
      </div>
    `
  }

  const currentNumber = Number(finalState.round1.currentNumber || 0)
  const isQuestionCard = isFinalRound1QuestionCard(currentNumber)

  const nextRoundButton = isFinalSplitMode()
    ? ""
    : `<button onclick="goToFinalRound(2)" class="archiveCtrlBtn roundNavBtn">الجولة التالية</button>`

  controls.innerHTML = `
    <button onclick="activateFinalDouble()" id="finalDoubleBtn" class="archiveCtrlBtn finalDoubleBtn">دبل</button>
    <button onclick="showFinalRound1Question()" class="archiveCtrlBtn btnStart" ${isQuestionCard ? "" : "disabled"}>إظهار السؤال</button>
    <button onclick="finalRound1Correct()" class="archiveCtrlBtn btnCorrect">إجابة صحيحة</button>
    <button onclick="finalRound1Wrong()" class="archiveCtrlBtn btnWrong">خطأ</button>
    <button onclick="undoFinalAction()" class="archiveCtrlBtn undoBtn finalUndoBtn">تراجع</button>
    ${nextRoundButton}
  `

  updateFinalDoubleButton()

  if (finalState.round1.currentNumber) {
    loadFinalRound1Current()
  }
}

async function openFinalRound1Card(number) {
  if (finalState.round1.pendingScore) {
    showGameToast("أنهِ الدور الحالي أولاً")
    return
  }

  if (finalState.round1.opened.includes(number)) return

  pushFinalHistory()

  finalState.round1.currentNumber = number
  finalState.round1.opened.push(number)
  finalState.round1.pendingScore = true
  finalState.round1.currentAnswer = ""
  finalState.round1.currentImage = ""
  finalState.round1.currentNote = ""
  finalState.round1.currentQuestionParts = []
  finalState.round1.shownQuestionPartsCount = 0
  finalState.round1.answerShown = false
  finalState.round1.errors.A = 0
  finalState.round1.errors.B = 0

  renderFinalRound1()
  renderFinalErrors()
  saveFinalState()
  updateEndRoundButtonState()

  await loadFinalRound1Current()
}

async function loadFinalRound1Current() {
  const number = finalState.round1.currentNumber
  if (!number) return

  const { data, error } = await db
    .from("final_round1_items")
    .select("*")
    .eq("model", Number(currentModel))
    .eq("number", Number(number))
    .maybeSingle()

    if (!data) {
  showGameToast("لا توجد بيانات لهذا الرقم")
  return
}

  if (error) {
    console.log(error)
    return
  }

  finalState.round1.currentAnswer = data?.answer || ""
  finalState.round1.currentImage = data?.image || ""
  finalState.round1.currentNote = data?.note || ""
  finalState.round1.currentQuestionParts = [
    data?.question_part1 || "",
    data?.question_part2 || "",
    data?.question_part3 || ""
  ]

  finalState.round1.cardTexts[number] = data?.card_text || ""

  renderFinalRound1Content(data || {})
  saveFinalState()
}

function renderFinalRound1Content(data) {
  const box = document.getElementById("finalRound1ImageStage")
  if (!box) return

  const number = Number(finalState.round1.currentNumber || 0)
  const fullCardText = (data?.card_text || finalState.round1.cardTexts?.[number] || "").trim()
  const isHistoricalTextCard = isFinalRound1TextCard(number) && !!fullCardText
const isQuestionCard = isFinalRound1QuestionCard(number)

  currentFinalRound1Image = finalState.round1.currentImage || ""

  let mainContent = ""
  let answerContent = ""

  if (isHistoricalTextCard) {
    const clipText = removeArabicDots(fullCardText)

    mainContent = `
      <div class="finalRound1MainStageCard finalRound1PremiumStage">
        <div class="finalRound1TextCard finalRound1RevealCard" onclick="toggleFinalRound1Overlay()">
          <div class="finalRound1TextCardInner">
            ${clipText}
          </div>
        </div>
      </div>
    `
  } else if (isQuestionCard) {
    const visibleParts = (finalState.round1.currentQuestionParts || [])
      .filter(part => String(part || "").trim() !== "")
      .slice(0, Number(finalState.round1.shownQuestionPartsCount || 0))

    if (visibleParts.length) {
      mainContent = `
        <div class="finalRound1MainStageCard finalRound1PremiumStage">
          <div class="finalRound1QuestionStage finalRound1RevealCard">
            ${visibleParts.map((part, idx) => `
              <div class="finalRound1QuestionPart">
                <span class="finalRound1PartBadge">${idx + 1}</span>
                <span>${part}</span>
              </div>
            `).join("")}
          </div>
        </div>
      `
    } else if (finalState.round1.currentImage) {
      mainContent = `
        <div class="finalRound1MainStageCard finalRound1PremiumStage">
          <div class="finalRound1ImageFrame finalRound1RevealCard" onclick="toggleFinalRound1ImageOverlay()">
            <img class="finalRound1BigImage" src="${finalState.round1.currentImage}" alt="">
          </div>
        </div>
      `
    } else {
      mainContent = `
        <div class="finalRound1MainStageCard finalRound1PremiumStage">
          <div class="finalRoundPlaceholder">اضغط إظهار السؤال</div>
        </div>
      `
    }
  } else if (finalState.round1.currentImage) {
    mainContent = `
      <div class="finalRound1MainStageCard finalRound1PremiumStage">
        <div class="finalRound1ImageFrame finalRound1RevealCard" onclick="toggleFinalRound1ImageOverlay()">
          <img class="finalRound1BigImage" src="${finalState.round1.currentImage}" alt="">
        </div>
      </div>
    `
  } else {
    mainContent = `
      <div class="finalRound1MainStageCard finalRound1PremiumStage">
        <div class="finalRoundPlaceholder">لا توجد صورة</div>
      </div>
    `
  }

  if (finalState.round1.answerShown && finalState.round1.currentAnswer) {
    answerContent = `
      <div class="finalRound1ResultBox correctResult">
        <div class="finalRound1ResultLabel">الإجابة</div>
        <div class="finalRound1ResultText ${isFinalRound1QuestionCard(number) ? "finalRound1AnswerProjectFont" : "finalRound1AnswerMolhimFont"}">
          ${finalState.round1.currentAnswer}
        </div>
      </div>
    `
  }

  box.innerHTML = `
    <div class="finalRound1StageLayout finalRound1PremiumLayout">
      ${mainContent}

      ${answerContent ? `
        <div class="finalRound1BottomInfoRow">
          ${answerContent}
        </div>
      ` : ""}
    </div>
  `
}

function showFinalRound1Question() {
  if (!finalState.round1.pendingScore || !finalState.round1.currentNumber) {
    showGameToast("اختر رقمًا أولاً")
    return
  }

  const number = Number(finalState.round1.currentNumber)

  if (!isFinalRound1QuestionCard(number)) {
  showGameToast("إظهار السؤال متاح فقط لكروت السؤال")
  return
}

  const parts = (finalState.round1.currentQuestionParts || [])
    .filter(part => String(part || "").trim() !== "")

  if (!parts.length) {
    showGameToast("لا توجد أجزاء للسؤال")
    return
  }

  pushFinalHistory()

  if (finalState.round1.shownQuestionPartsCount < parts.length) {
    finalState.round1.shownQuestionPartsCount += 1
  }

  loadFinalRound1Current()
  saveFinalState()
}

function showFinalRound1Answer() {
  if (!finalState.round1.pendingScore || !finalState.round1.currentNumber) {
    showGameToast("اختر رقمًا أولاً")
    return
  }

  pushFinalHistory()

  finalState.round1.answerShown = !finalState.round1.answerShown
  loadFinalRound1Current()
  saveFinalState()
}

function flashFinalRound1OverlayWrong() {
  const overlay = document.getElementById("finalRound1Overlay")
  const displayOverlay = document.getElementById("displayImageZoomOverlay")

  const hasOverlay = overlay || displayOverlay

  if (!hasOverlay) {
    return false
  }

  let flashLayer = document.getElementById("finalRound1ZoomFlashLayer")

  if (!flashLayer) {
    flashLayer = document.createElement("div")
    flashLayer.id = "finalRound1ZoomFlashLayer"
    flashLayer.className = "finalRound1ZoomFlashLayer"
    document.body.appendChild(flashLayer)
  } else {
    document.body.appendChild(flashLayer)
  }

  flashLayer.classList.remove("finalRound1ZoomFlashRun")
  void flashLayer.offsetWidth
  flashLayer.classList.add("finalRound1ZoomFlashRun")

  const media =
    document.querySelector("#finalRound1Overlay img") ||
    document.querySelector("#finalRound1Overlay video") ||
    document.getElementById("displayImageZoomImg")

  if (media) {
    media.classList.remove("mediaWrongShake")
    void media.offsetWidth
    media.classList.add("mediaWrongShake")
  }

  setTimeout(() => {
    flashLayer.classList.remove("finalRound1ZoomFlashRun")
  }, 850)

  return true
}

function finalRound1Wrong() {
  if (!finalState.round1.pendingScore || finalState.round1.currentNumber === null) {
    showGameToast("اختر رقمًا أولاً")
    return
  }

  pushFinalHistory()

  clearFinalActiveDouble()
  playGameSound("wrong")
  flashScreen("wrong")

  updateFinalDoubleButton()
  saveFinalState()
}

function finalRound1Correct() {
  const oldOverlay = document.getElementById("finalRound1Overlay")
  if (oldOverlay) oldOverlay.remove()

  const answeringTeam = finalState.round1.activeTeam

  if (!finalState.round1.pendingScore || finalState.round1.currentNumber === null) {
    showGameToast("اختر رقمًا أولاً")
    return
  }

  if (!answeringTeam) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  pushFinalHistory()

  if (!finalState.round1.answerShown) {
    finalState.round1.answerShown = true
    loadFinalRound1Current()
  }

  finalState.round1.scores[answeringTeam] += getFinalScoreValue(answeringTeam, 1)

  clearFinalActiveDouble()

  playGameSound("correct")
  flashScreen("correct")
  renderFinalScores()
  saveFinalState()

  setTimeout(() => {
    finalizeRound1Turn()
  }, 7000)
}

function finalizeRound1Turn() {
  finalState.round1.pendingScore = false
  finalState.round1.currentNumber = null
  finalState.round1.currentAnswer = ""
  finalState.round1.currentImage = ""
  finalState.round1.currentNote = ""
  finalState.round1.currentQuestionParts = []
  finalState.round1.shownQuestionPartsCount = 0
  finalState.round1.answerShown = false
  finalState.round1.activeTeam = null
  currentFinalRound1Image = ""

  resetFinalTeamSelection()
  renderFinalRound()
  saveFinalState()
  updateEndRoundButtonState()
}

function toggleFinalRound1Overlay() {
  const oldOverlay = document.getElementById("finalRound1Overlay")

  if (oldOverlay) {
    oldOverlay.remove()
    return
  }

  const number = finalState.round1.currentNumber
  if (!number) return

  const text = finalState.round1.cardTexts?.[number] || ""
  if (!text.trim()) return

  const clipText = removeArabicDots(text)

  const overlay = document.createElement("div")
  overlay.id = "finalRound1Overlay"
  overlay.className = "finalRound1Overlay"
  overlay.innerHTML = `
    <div class="finalRound1OverlayInner">
      <div class="finalRound1OverlayPaper">
        <div
          class="finalRound1OverlayText molhimClipFont"
          style="${getFinalRound1ClipStyle(clipText, true)}"
        >
          ${clipText}
        </div>
      </div>
    </div>
  `

  overlay.onclick = function () {
    overlay.remove()
  }

  document.body.appendChild(overlay)
}

function toggleFinalRound1ImageOverlay() {
  const oldOverlay = document.getElementById("finalRound1ImageOverlay")

  if (oldOverlay) {
    oldOverlay.remove()
    return
  }

  if (!currentFinalRound1Image) return

  const overlay = document.createElement("div")
  overlay.id = "finalRound1ImageOverlay"
  overlay.className = "finalRound3ImageOverlay"
  overlay.innerHTML = `
    <div class="finalRound3ImageOverlayInner">
      <img src="${currentFinalRound1Image}" class="finalRound3ImageOverlayImg" alt="">
    </div>
  `

  overlay.onclick = function () {
    overlay.remove()
  }

  document.body.appendChild(overlay)
}


/* =========================
   12) ROUND 2 - صح صحلي
========================= */

function renderFinalRound2() {
  const stage = document.getElementById("finalMainStage")
  const controls = document.getElementById("finalControlsBar")
  if (!stage || !controls) return

  setFinalControlsMode(2)

  let grid = ""

  for (let i = 1; i <= 4; i++) {
    const opened = finalState.round2.opened.includes(i)

    grid += `
      <button
        class="finalRound2Card ${opened ? "used" : ""}"
        ${opened ? "disabled" : ""}
        onclick="openFinalRound2Card(${i})"
      >
        ${i}
      </button>
    `
  }

  const isScramble = finalState.round2.currentType === "scramble"
  const isSequence = finalState.round2.currentType === "sequence"

  stage.innerHTML = `
    <div class="finalRound2Wrap">
      <div class="finalRound2Grid">${grid}</div>
      <div class="finalRound2WordsStage" id="finalRound2WordsStage" data-round2-number="${Number(finalState.round2.currentNumber || 0)}">
        اختر الفريق ثم الرقم
      </div>
    </div>
  `

  const nextRoundButton = isFinalSplitMode()
    ? ""
    : `<button onclick="goToFinalRound(3)" class="archiveCtrlBtn roundNavBtn">الجولة التالية</button>`

  controls.innerHTML = `
    <button onclick="activateFinalDouble()" id="finalDoubleBtn" class="archiveCtrlBtn finalDoubleBtn">دبل</button>

    <button onclick="finalRound2DecreaseCountdown()" class="archiveCtrlBtn btnStart" ${isSequence ? "" : "disabled"}>
      ${isSequence ? finalState.round2.countdown : "العداد"}
    </button>

    <button onclick="finalRound2RecordScore()" class="archiveCtrlBtn btnCorrect" ${isScramble ? "" : "disabled"}>
      تسجيل نتيجة المبعثرة
    </button>

    <button onclick="finalRound2RecordSequenceScore()" class="archiveCtrlBtn btnCorrect" ${isSequence ? "" : "disabled"}>
      تسجيل نتيجة التلميح
    </button>

    <button onclick="undoFinalAction()" class="archiveCtrlBtn undoBtn finalUndoBtn">تراجع</button>
    ${nextRoundButton}
  `

  updateFinalDoubleButton()
  renderFinalRound2Words(finalState.round2.answerShown)
}

async function openFinalRound2Card(number) {
  if (finalState.round2.pendingScore) {
    showGameToast("سجل النتيجة أولاً")
    return
  }

  const team = setFinalAutoTeam(2)

  if (finalState.round2.opened.includes(number)) return

  const groupKey = getRound2GroupKey(number)
  const teamValues = Object.values(finalState.round2.assignedTeams[groupKey] || {})

  if (teamValues.includes(team)) {
    showGameToast("لا يمكن تكرار نفس الفريق في هذا النوع")
    return
  }

  pushFinalHistory()

  clearInterval(finalState.round2.revealTimer)
  finalState.round2.revealTimer = null

  finalState.round2.currentNumber = number
  finalState.round2.currentType = groupKey
  finalState.round2.opened.push(number)
  finalState.round2.pendingScore = true
  finalState.round2.answerShown = false
  finalState.round2.correctCount = 0
  finalState.round2.countdown = 15
  finalState.round2.currentRevealIndex = -1
  finalState.round2.hiddenSequence = []
  finalState.round2.selectedCorrectIndexes = []
  finalState.round2.allWords = []
  finalState.round2.answers = []
  finalState.round2.hints = []
  finalState.round2.scrambledWords = []
  finalState.round2.assignedTeams[groupKey][number] = team

  const { data, error } = await db
    .from("final_round2_items")
    .select("*")
    .eq("model", Number(currentModel))
    .eq("number", Number(number))
    .order("item_order", { ascending: true })

  if (error) {
    console.log(error)
    return
  }

  const items = data || []

  if (!items.length) {
  showGameToast("لا توجد بيانات لهذا الرقم")

  finalState.round2.currentNumber = null
  finalState.round2.currentType = null
  finalState.round2.opened = finalState.round2.opened.filter(n => Number(n) !== Number(number))
  finalState.round2.pendingScore = false
  finalState.round2.answerShown = false
  finalState.round2.correctCount = 0
  finalState.round2.countdown = 15
  finalState.round2.currentRevealIndex = -1
  finalState.round2.hiddenSequence = []
  finalState.round2.selectedCorrectIndexes = []
  finalState.round2.allWords = []
  finalState.round2.answers = []
  finalState.round2.hints = []
  finalState.round2.scrambledWords = []

  delete finalState.round2.assignedTeams[groupKey][number]

  renderFinalRound2()
  saveFinalState()
  updateEndRoundButtonState()
  return
}

  finalState.round2.allWords = items.map(x => x.prompt || "")
  finalState.round2.answers = items.map(x => x.answer || x.prompt || "")
  finalState.round2.hints = items.map(x => x.hint || "")
  finalState.round2.scrambledWords = items.map(x => shuffleArabicWord(x.prompt || ""))

  renderFinalRound2()

  if (groupKey === "scramble") {
    startFinalRound2ScrambleReveal()
  } else {
    renderFinalRoundTitle()
    renderFinalRound2Words(false)
  }

  saveFinalState()
  updateEndRoundButtonState()
}

function startFinalRound2ScrambleReveal() {
  clearInterval(finalState.round2.revealTimer)

  finalState.round2.currentRevealIndex = -1
  finalState.round2.answerShown = false

  renderFinalRound2Words(false)

  let idx = 0

  finalState.round2.revealTimer = setInterval(() => {
    if (idx >= finalState.round2.scrambledWords.length) {
      clearInterval(finalState.round2.revealTimer)
      finalState.round2.revealTimer = null

      finalState.round2.answerShown = true

      renderFinalRoundTitle()
      renderFinalRound2Words(true)
      flashScreen("correct")
      saveFinalState()
      return
    }

    finalState.round2.currentRevealIndex = idx
    renderFinalRound2Words(false)
    idx++
    saveFinalState()
  }, 5000)
}

function renderFinalRound2Words(showAnswers) {
  const box = document.getElementById("finalRound2WordsStage")
  if (!box) return

  box.setAttribute("data-round2-number", String(Number(finalState.round2.currentNumber || 0)))

  if (!finalState.round2.currentNumber) {
    box.innerHTML = `<div class="finalRoundPlaceholder">اختر الفريق ثم الرقم</div>`
    return
  }

  if (finalState.round2.currentType === "scramble") {
    if (showAnswers) {
      box.innerHTML = `
        <div class="finalRound2AnswerGrid">
          ${finalState.round2.scrambledWords.map((word, idx) => {
            const selected = finalState.round2.selectedCorrectIndexes.includes(idx)

            return `
              <button
                class="finalRound2AnswerCard ${selected ? "selectedCorrect" : ""}"
                onclick="toggleFinalRound2CorrectSelection(${idx})"
              >
                <div class="finalRound2AnswerScrambled">${escapeDisplayHtml(word)}</div>
                <div class="finalRound2AnswerCorrect">${escapeDisplayHtml(finalState.round2.answers[idx] || "-")}</div>
              </button>
            `
          }).join("")}
        </div>
      `
      return
    }

    const idx = finalState.round2.currentRevealIndex

    if (idx < 0 || !finalState.round2.scrambledWords[idx]) {
      box.innerHTML = `<div class="finalRoundPlaceholder">انتظر ظهور الكلمات</div>`
      return
    }

    box.innerHTML = `
      <div class="finalHintStage">
        <div class="finalHintText">${escapeDisplayHtml(finalState.round2.hints[idx] || "بدون تلميحة")}</div>
        <div class="finalWordChipLarge">${escapeDisplayHtml(finalState.round2.scrambledWords[idx])}</div>
      </div>
    `
    return
  }

  const visibleWords = finalState.round2.allWords.filter((_, idx) => {
    return !finalState.round2.hiddenSequence.includes(idx)
  })

  if (!visibleWords.length) {
    box.innerHTML = `<div class="finalRoundPlaceholder">تم إخفاء جميع الكلمات</div>`
    return
  }

  box.innerHTML = `
    <div class="finalSequenceWordsWrap">
      ${visibleWords.map((word, visibleIdx) => {
        const realIndex = finalState.round2.allWords.findIndex((_, idx) => {
          return !finalState.round2.hiddenSequence.includes(idx) &&
            finalState.round2.allWords[idx] === word &&
            visibleWords.slice(0, visibleIdx).filter(x => x === word).length ===
            finalState.round2.allWords
              .slice(0, idx)
              .filter((x, i) => !finalState.round2.hiddenSequence.includes(i) && x === word).length
        })

        return `
          <button class="finalSequenceWordBtn" onclick="hideFinalRound2SequenceWord(${realIndex})">
            ${escapeDisplayHtml(word)}
          </button>
        `
      }).join("")}
    </div>
  `
}

function toggleFinalRound2CorrectSelection(index) {
  if (finalState.round2.currentType !== "scramble") return
  if (!finalState.round2.answerShown) return
  if (!finalState.round2.pendingScore) return

  pushFinalHistory()

  const arr = finalState.round2.selectedCorrectIndexes
  const exists = arr.includes(index)

  finalState.round2.selectedCorrectIndexes = exists
    ? arr.filter(x => x !== index)
    : [...arr, index]

  finalState.round2.correctCount = finalState.round2.selectedCorrectIndexes.length

  renderFinalRoundTitle()
  renderFinalRound2Words(true)
  saveFinalState()
}

function finalRound2ToggleCorrectFromPresenter(index) {
  if (!finalState.round2.pendingScore || finalState.round2.currentNumber === null) return
  if (finalState.round2.currentType !== "scramble") return
  if (index < 0) return

  pushFinalHistory()

  const arr = finalState.round2.selectedCorrectIndexes
  const exists = arr.includes(index)

  finalState.round2.selectedCorrectIndexes = exists
    ? arr.filter(x => x !== index)
    : [...arr, index]

  finalState.round2.correctCount = finalState.round2.selectedCorrectIndexes.length

  renderFinalRoundTitle()

  if (finalState.round2.answerShown) {
    renderFinalRound2Words(true)
  }

  saveFinalState()
}

function hideFinalRound2SequenceWord(index) {
  if (finalState.round2.currentType !== "sequence") return
  if (!finalState.round2.pendingScore) return
  if (index < 0) return
  if (finalState.round2.hiddenSequence.includes(index)) return

  pushFinalHistory()

  finalState.round2.hiddenSequence.push(index)

  renderFinalRound2Words(finalState.round2.answerShown)
  saveFinalState()
}

function finalRound2DecreaseCountdown() {
  if (!finalState.round2.pendingScore || finalState.round2.currentNumber === null) {
    showGameToast("اختر الفريق ثم الرقم أولاً")
    return
  }

  if (finalState.round2.currentType !== "sequence") {
    showGameToast("هذا الزر خاص بالرقمين 2 و 4")
    return
  }

  pushFinalHistory()

  if (finalState.round2.countdown > 0) {
    finalState.round2.countdown -= 1
  }

  if (finalState.round2.countdown <= 0) {
    finalState.round2.answerShown = true
    renderFinalRoundTitle()
    renderFinalRound2Words(true)
    flashScreen("correct")
    saveFinalState()
    return
  }

  renderFinalRoundTitle()
  renderFinalRound2()
  saveFinalState()
}

function finalRound2RecordScore() {
  const team = finalState.round2.activeTeam

  if (!finalState.round2.pendingScore || finalState.round2.currentNumber === null) {
    showGameToast("اختر الفريق ثم الرقم أولاً")
    return
  }

  if (finalState.round2.currentType !== "scramble") {
    showGameToast("هذا الزر خاص بالرقمين 1 و 3")
    return
  }

  if (!team) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  pushFinalHistory()

  finalState.round2.correctCount = finalState.round2.selectedCorrectIndexes.length
  finalState.round2.scores[team] += getFinalScoreValue(team, finalState.round2.correctCount)
  finalState.round2.lastTeamPlayed = team

  clearFinalActiveDouble()

  renderFinalScores()
  playGameSound("correct")
  finalizeRound2Number()
}

function finalRound2RecordSequenceScore() {
  const team = finalState.round2.activeTeam

  if (!finalState.round2.pendingScore || finalState.round2.currentNumber === null) {
    showGameToast("اختر الفريق ثم الرقم أولاً")
    return
  }

  if (finalState.round2.currentType !== "sequence") {
    showGameToast("هذا الزر خاص بالرقمين 2 و 4")
    return
  }

  if (!finalState.round2.answerShown && Number(finalState.round2.countdown || 0) > 0) {
    showGameToast("أنهِ العدّاد أولاً")
    return
  }

  if (!team) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  pushFinalHistory()

  finalState.round2.scores[team] += getFinalScoreValue(team, finalState.round2.countdown)
  finalState.round2.lastTeamPlayed = team

  clearFinalActiveDouble()

  renderFinalScores()
  playGameSound("correct")
  finalizeRound2Number()
}

function finalizeRound2Number() {
  if (finalState.round2.currentNumber !== null) {
    if (!finalState.round2.scoredNumbers.includes(finalState.round2.currentNumber)) {
      finalState.round2.scoredNumbers.push(finalState.round2.currentNumber)
    }
  }

  clearInterval(finalState.round2.revealTimer)

  finalState.round2.revealTimer = null
  finalState.round2.pendingScore = false
  finalState.round2.currentNumber = null
  finalState.round2.currentType = null
  finalState.round2.allWords = []
  finalState.round2.answers = []
  finalState.round2.hints = []
  finalState.round2.scrambledWords = []
  finalState.round2.currentRevealIndex = -1
  finalState.round2.answerShown = false
  finalState.round2.correctCount = 0
  finalState.round2.countdown = 15
  finalState.round2.hiddenSequence = []
  finalState.round2.selectedCorrectIndexes = []

  const nextTeam = getOtherTeam(finalState.round2.lastTeamPlayed || "A")

  finalState.round2.activeTeam = nextTeam

  renderFinalRound()
  highlightFinalTeam(nextTeam)
  saveFinalState()
  updateEndRoundButtonState()
}

/* =========================
   13) ROUND 3 - التركيز
========================= */

function renderFinalRound3() {
  ensureFinalRound3State()
  renderFinalRound3TeamMedia()
}

async function loadFinalRound3TeamMediaItem(number) {
  const { data, error } = await db
    .from("final_round3_items")
    .select("*")
    .eq("model", Number(currentModel))
    .eq("number", Number(number))
    .eq("image_order", 1)
    .maybeSingle()

  if (error) {
    console.log("LOAD FINAL ROUND 3 TEAM MEDIA ERROR:", error)
    showGameToast("تعذر تحميل بيانات الرقم")
    return null
  }

  return data || null
}

function getFinalRound3Count() {
  const count = Number(
    window.finalRound3Count ||
    localStorage.getItem("final_round3_count") ||
    finalState.round3?.teamMedia?.count ||
    4
  )

  if (count === 8) return 8
  if (count === 6) return 6
  return 4
}

function getFinalRound3MaxPerTeam() {
  return Math.ceil(getFinalRound3Count() / 2)
}


function renderFinalRound3TeamMedia() {
  const stage = document.getElementById("finalMainStage")
  const controls = document.getElementById("finalControlsBar")
  if (!stage || !controls) return

  setFinalControlsMode(3)
  ensureFinalRound3State()

  const state = finalState.round3.teamMedia
const used = state.usedNumbers || []
const totalNumbers = getFinalRound3Count()

state.count = totalNumbers

let grid = ""

for (let i = 1; i <= totalNumbers; i++) {
    const opened = used.includes(i)

    grid += `
      <button
        class="finalRound3Card finalTeamMediaNumberCard ${opened ? "used" : ""}"
        ${opened ? "disabled" : ""}
        onclick="openFinalRound3TeamMediaCard(${i})"
      >
        ${opened ? "" : i}
      </button>
    `
  }

  stage.innerHTML = `
    <div class="finalRound3Wrap finalRound3TeamMediaWrap">

      <div class="finalRound3Grid finalTeamMediaNumbersGrid">
        ${grid}
      </div>

      <div class="finalRound3ImageStageWrap finalTeamMediaStageWrap">
        <div class="finalRound3ImageStage finalRound3TeamMediaStage" id="finalRound3TeamMediaStage">
          ${buildFinalRound3TeamMediaContent()}
        </div>
      </div>

    </div>
  `

  const hasCurrent = !!state.currentNumber
  const questionShown = !!state.questionShown
  const answerShown = !!state.answerShown

  const canShowQuestion =
    hasCurrent &&
    !!state.currentQuestion &&
    !questionShown &&
    !answerShown

  const videoAvailable =
    hasCurrent &&
    !questionShown &&
    !answerShown &&
    state.currentMediaType === "video" &&
    !!state.currentMedia

  const canPlayVideo = videoAvailable && !state.videoPlayed
  const canRestartVideo = videoAvailable

  controls.innerHTML = `
  <button
    onclick="activateFinalDouble()"
    id="finalDoubleBtn"
    class="archiveCtrlBtn finalTeamMediaCtrlBtn finalDoubleBtn"
  >
    دبل
  </button>

  <button
    onclick="showFinalRound3TeamMediaQuestion()"
    class="archiveCtrlBtn finalTeamMediaCtrlBtn btnAnswer"
    ${canShowQuestion ? "" : "disabled"}
  >
    إظهار السؤال
  </button>

    <button
      onclick="playFinalRound3TeamMediaVideo()"
      class="archiveCtrlBtn finalTeamMediaCtrlBtn btnStart"
      ${canPlayVideo ? "" : "disabled"}
    >
      تشغيل الفيديو
    </button>

    <button
      onclick="restartFinalRound3TeamMediaVideo()"
      class="archiveCtrlBtn finalTeamMediaCtrlBtn btnStart"
      ${canRestartVideo ? "" : "disabled"}
    >
      إعادة تشغيل
    </button>

    <button
      onclick="finalRound3TeamMediaCorrect()"
      class="archiveCtrlBtn finalTeamMediaCtrlBtn btnCorrect"
      ${hasCurrent ? "" : "disabled"}
    >
      إجابة صحيحة
    </button>

    <button
      onclick="finalRound3TeamMediaWrong()"
      class="archiveCtrlBtn finalTeamMediaCtrlBtn btnWrong"
      ${hasCurrent ? "" : "disabled"}
    >
      خطأ
    </button>

    <button
      onclick="undoFinalAction()"
      class="archiveCtrlBtn finalTeamMediaCtrlBtn undoBtn finalUndoBtn"
    >
      تراجع
    </button>
  `

  renderFinalRoundTitle()
  renderFinalScores()
  renderFinalTurnBar()
  updateFinalUndoButtonState()
  updateFinalDoubleButton()
  updateEndRoundButtonState()
  saveFinalState()
}

function buildFinalRound3TeamMediaContent() {
  const state = finalState.round3.teamMedia

  if (!state.currentNumber) {
    return `
      <div class="finalTeamMediaEmptyState">
        اختر الفريق ثم الرقم
      </div>
    `
  }

  const isVideo = state.currentMediaType === "video" && state.currentMedia
  const showMedia = !state.questionShown && !state.answerShown

  const resultClass =
    state.resultType === "correct"
      ? "correctResult"
      : state.resultType === "wrong"
        ? "wrongResult"
        : ""

  const mediaHTML =
    showMedia && state.currentMedia
      ? isVideo
        ? `
          <div class="finalTeamMediaFrame finalTeamMediaVideoFrame" onclick="openFinalRound3TeamMediaOverlay('video')">
            <video
              id="finalRound3TeamMediaInlineVideo"
              src="${escapeDisplayHtml(state.currentMedia)}"
              class="finalTeamMediaVideo"
              playsinline
              preload="metadata"
              controlslist="nodownload noplaybackrate"
              disablepictureinpicture
            ></video>

            <button
              type="button"
              class="finalTeamMediaPlayBadge"
              onclick="event.stopPropagation(); playFinalRound3TeamMediaVideo()"
            >
              ▶
            </button>
          </div>
        `
        : `
          <div class="finalTeamMediaFrame finalTeamMediaImageFrame" onclick="openFinalRound3TeamMediaOverlay('image')">
            <img src="${escapeDisplayHtml(state.currentMedia)}" class="finalTeamMediaImage" alt="">
          </div>
        `
      : ""

  const questionHTML =
    state.questionShown && state.currentQuestion
      ? `
        <div class="finalTeamMediaQuestionBox finalTeamMediaQuestionOnly">
          <div class="finalTeamMediaSmallLabel">السؤال</div>
          <div class="finalTeamMediaQuestionText">
            ${escapeDisplayHtml(state.currentQuestion)}
          </div>
        </div>
      `
      : ""

  const answerHTML =
    state.answerShown && state.currentAnswer
      ? `
        <div class="finalTeamMediaResultBox ${resultClass}">
          <div class="finalTeamMediaSmallLabel">الإجابة</div>
          <div class="finalRound3TeamMediaAnswer">
            ${escapeDisplayHtml(state.currentAnswer)}
          </div>
        </div>
      `
      : ""

  return `
    <div class="finalRound3TeamMediaContent">
      ${mediaHTML}

      <div class="finalTeamMediaTextRow">
        ${questionHTML}
        ${answerHTML}
      </div>
    </div>
  `
}

async function openFinalRound3TeamMediaCard(number) {
  ensureFinalRound3State()

  const state = finalState.round3.teamMedia
  const team = setFinalAutoTeam(3)

  if (state.currentNumber) {
    showGameToast("أغلق الرقم الحالي أولاً")
    return
  }

  const maxPerTeam = getFinalRound3MaxPerTeam()

if (state.teamNumbers[team].length >= maxPerTeam) {
  showGameToast(`هذا الفريق أخذ ${maxPerTeam} أرقام`)
  return
}

  if (state.usedNumbers.includes(number)) return

  const item = await loadFinalRound3TeamMediaItem(number)

  if (!item) {
    showGameToast("لا توجد بيانات لهذا الرقم")
    return
  }

  pushFinalHistory()

  const video = String(item.video || "").trim()
  const image = String(item.image || "").trim()

  state.currentNumber = number
  state.currentTeam = team
  state.currentQuestion = item.question || item.note || ""
  state.currentAnswer = item.answer || ""
  state.answerShown = false
  state.questionShown = false
  state.videoPlayed = false
  state.resultType = ""

  if (video) {
    state.currentMediaType = "video"
    state.currentMedia = video
  } else {
    state.currentMediaType = "image"
    state.currentMedia = image
  }

  state.usedNumbers.push(number)
  state.teamNumbers[team].push(number)

  finalState.round3.currentNumber = number
  finalState.round3.pendingScore = true

  if (!finalState.round3.opened.includes(number)) {
    finalState.round3.opened.push(number)
  }

  playGameSound("open")
  renderFinalRound3TeamMedia()
}

function showFinalRound3TeamMediaQuestion() {
  const state = finalState.round3.teamMedia

  if (!state.currentNumber) {
    showGameToast("افتح رقم أولاً")
    return
  }

  if (!state.currentQuestion) {
    showGameToast("لا يوجد سؤال لهذا الرقم")
    return
  }

  pushFinalHistory()

  state.questionShown = true
  state.answerShown = false
  state.resultType = ""

  closeFinalRound3TeamMediaOverlay()

  playGameSound("answer")
  renderFinalRound3TeamMedia()
  saveFinalState()
}

function finalRound3TeamMediaCorrect() {
  const state = finalState.round3.teamMedia
  const team = state.currentTeam
  const number = state.currentNumber

  if (!number) {
    showGameToast("افتح رقم أولاً")
    return
  }

  if (!team) {
    showGameToast("لا يوجد فريق محدد")
    return
  }

  if (finalState.round3.scoredNumbers.includes(number)) {
    showGameToast("تم تسجيل هذا الرقم مسبقاً")
    return
  }

  pushFinalHistory()

  state.answerShown = true
  state.resultType = "correct"

  finalState.round3.scores[team] += getFinalScoreValue(team, 1)
  finalState.round3.scoredNumbers.push(number)
  finalState.round3.lastTeamPlayed = team

  clearFinalActiveDouble()

  playGameSound("correct")
  flashScreen("correct")
  closeFinalRound3TeamMediaOverlay()

  renderFinalScores()
  renderFinalRound3TeamMedia()

  setTimeout(() => {
    resetFinalRound3TeamMediaCurrent(getOtherTeam(team))
  }, 7000)
}

function finalRound3TeamMediaWrong() {
  const state = finalState.round3.teamMedia
  const number = state.currentNumber

  if (!number) {
    showGameToast("افتح رقم أولاً")
    return
  }

  pushFinalHistory()

  state.answerShown = true
  state.questionShown = false
  state.resultType = "wrong"

  if (!finalState.round3.scoredNumbers.includes(number)) {
    finalState.round3.scoredNumbers.push(number)
  }

  const team = state.currentTeam || finalState.round3.activeTeam || "A"
  finalState.round3.lastTeamPlayed = team

  playGameSound("wrong")

  closeFinalRound3TeamMediaOverlay()
  flashScreen("wrong")

  renderFinalRound3TeamMedia()
  saveFinalState()

  setTimeout(() => {
    resetFinalRound3TeamMediaCurrent(getOtherTeam(team))
  }, 7000)
}

function resetFinalRound3TeamMediaCurrent(nextTeam = null) {
  const state = finalState.round3.teamMedia

  state.currentNumber = null
  state.currentTeam = null
  state.currentMediaType = ""
  state.currentMedia = ""
  state.currentQuestion = ""
  state.currentAnswer = ""
  state.answerShown = false
  state.questionShown = false
  state.videoPlayed = false
  state.resultType = ""

  finalState.round3.currentNumber = null
  finalState.round3.pendingScore = false

  if (nextTeam === "A" || nextTeam === "B") {
    finalState.round3.activeTeam = nextTeam
    highlightFinalTeam(nextTeam)
  }

  renderFinalRound3TeamMedia()
  renderFinalRoundTitle()
  updateEndRoundButtonState()
  saveFinalState()
}

function openFinalRound3TeamMediaOverlay(type) {
  const state = finalState.round3.teamMedia

  if (!state.currentMedia) return

  let overlay = document.getElementById("finalRound3TeamMediaOverlay")

  if (!overlay) {
    overlay = document.createElement("div")
    overlay.id = "finalRound3TeamMediaOverlay"
    overlay.className = "finalRound3TeamMediaOverlay"
    document.body.appendChild(overlay)
  }

  overlay.onclick = function () {
    closeFinalRound3TeamMediaOverlay()
  }

  overlay.classList.remove("hidden", "imageMode", "videoMode")
  overlay.classList.add(type === "video" ? "videoMode" : "imageMode")

  if (type === "video") {
    overlay.innerHTML = `
      <button
        class="finalRound3TeamMediaCloseBtn"
        onclick="event.stopPropagation(); closeFinalRound3TeamMediaOverlay()"
      >
        ×
      </button>

      <div class="finalRound3TeamMediaOverlayInner" onclick="event.stopPropagation()">
        <video
          id="finalRound3TeamMediaOverlayVideo"
          src="${escapeDisplayHtml(state.currentMedia)}"
          class="finalRound3TeamMediaOverlayVideo"
          controls
          playsinline
          preload="auto"
          controlslist="nodownload noplaybackrate"
          disablepictureinpicture
        ></video>
      </div>
    `
  } else {
    overlay.innerHTML = `
      <button
        class="finalRound3TeamMediaCloseBtn"
        onclick="event.stopPropagation(); closeFinalRound3TeamMediaOverlay()"
      >
        ×
      </button>

      <div class="finalRound3TeamMediaOverlayInner" onclick="event.stopPropagation()">
        <img src="${escapeDisplayHtml(state.currentMedia)}" class="finalRound3TeamMediaOverlayImage" alt="">
      </div>
    `
  }
}

function closeFinalRound3TeamMediaOverlay() {
  const overlay = document.getElementById("finalRound3TeamMediaOverlay")
  if (!overlay) return

  const overlayVideo = document.getElementById("finalRound3TeamMediaOverlayVideo")
  if (overlayVideo) {
    overlayVideo.pause()
    overlayVideo.currentTime = 0
    overlayVideo.src = ""
    overlayVideo.load()
  }

  const inlineVideo = document.getElementById("finalRound3TeamMediaInlineVideo")
  if (inlineVideo) {
    inlineVideo.pause()
  }

  overlay.classList.add("hidden")
  overlay.classList.remove("imageMode", "videoMode")
  overlay.innerHTML = ""
}

function getFinalRound3ActiveVideo() {
  return (
    document.getElementById("finalRound3TeamMediaOverlayVideo") ||
    document.getElementById("finalRound3TeamMediaInlineVideo")
  )
}

function playFinalRound3TeamMediaVideo() {
  const state = finalState.round3.teamMedia

  if (!state.currentNumber || state.currentMediaType !== "video" || !state.currentMedia) {
    showGameToast("لا يوجد فيديو")
    return
  }

  if (state.questionShown || state.answerShown) {
    showGameToast("الفيديو غير متاح بعد إظهار السؤال")
    return
  }

  openFinalRound3TeamMediaOverlay("video")

  setTimeout(() => {
    const video = document.getElementById("finalRound3TeamMediaOverlayVideo")
    if (!video) return

    video.loop = false
    video.controls = true
    video.muted = false
    video.volume = 1

    state.videoPlayed = true

    video.onended = function () {
      closeFinalRound3TeamMediaOverlay()
      saveFinalState()
    }

    const playPromise = video.play()

    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(err => {
        console.log("FINAL TEAM MEDIA VIDEO PLAY ERROR:", err)
        showGameToast("اضغط تشغيل مرة أخرى")
      })
    }

    saveFinalState()
  }, 120)
}

function restartFinalRound3TeamMediaVideo() {
  const state = finalState.round3.teamMedia

  if (!state.currentNumber || state.currentMediaType !== "video" || !state.currentMedia) {
    showGameToast("لا يوجد فيديو")
    return
  }

  if (state.questionShown || state.answerShown) {
    showGameToast("الفيديو غير متاح بعد إظهار السؤال")
    return
  }

  openFinalRound3TeamMediaOverlay("video")

  setTimeout(() => {
    const video = document.getElementById("finalRound3TeamMediaOverlayVideo")
    if (!video) return

    video.pause()
    video.currentTime = 0
    video.loop = false
    video.controls = true
    video.muted = false
    video.volume = 1

    state.videoPlayed = true

    video.onended = function () {
      closeFinalRound3TeamMediaOverlay()
      saveFinalState()
    }

    const playPromise = video.play()

    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(err => {
        console.log("FINAL TEAM MEDIA VIDEO RESTART ERROR:", err)
        showGameToast("اضغط إعادة تشغيل مرة أخرى")
      })
    }

    saveFinalState()
  }, 120)
}


/* =========================
   14) ROUND 4 - اشرح الصورة
========================= */

function renderFinalRound4() {
  const stage = document.getElementById("finalMainStage")
  const controls = document.getElementById("finalControlsBar")
  if (!stage || !controls) return

  ensureFinalRound4State()
  setFinalControlsMode(3)

  let grid = ""

  for (let i = 1; i <= 2; i++) {
    const opened = finalState.round4.opened.includes(i)

    grid += `
      <button
        class="finalRound3Card ${opened ? "used" : ""}"
        ${opened ? "disabled" : ""}
        onclick="openFinalRound4Card(${i})"
      >
        ${i}
      </button>
    `
  }

  stage.innerHTML = `
    <div class="finalRound3Wrap finalRound4Wrap">
      <div class="finalRound3Grid">${grid}</div>

      <div class="finalRound3ImageStageWrap">
        <div class="finalRound3ImageStage" id="finalRound4ImageStage">
          <div class="finalRoundPlaceholder">اختر الفريق ثم الرقم</div>
        </div>
      </div>
    </div>
  `

  controls.innerHTML = `
    <button onclick="activateFinalDouble()" id="finalDoubleBtn" class="archiveCtrlBtn finalDoubleBtn">دبل</button>
    <button onclick="finalRound4RecordScore()" class="archiveCtrlBtn btnCorrect">تسجيل النتيجة</button>
    <button onclick="startFinalRound4Sequence()" class="archiveCtrlBtn btnStart">بدء عرض الصور</button>
    <button onclick="undoFinalAction()" class="archiveCtrlBtn undoBtn finalUndoBtn">تراجع</button>
  `

  updateFinalDoubleButton()

  if (finalState.round4.pendingScore && finalState.round4.answersAllowed) {
    showFinalRound4Answer()
  }
}

async function openFinalRound4Card(number) {
  if (finalState.round4.pendingScore) {
    showGameToast("سجل النتيجة أولاً")
    return
  }

  const team = setFinalAutoTeam(4)

  if (finalState.round4.opened.includes(number)) return

  if (Object.values(finalState.round4.assignedTeams).includes(team)) {
    showGameToast("كل فريق له رقم واحد فقط")
    return
  }

  pushFinalHistory()

  clearInterval(finalState.round4.sequenceTimer)

  finalState.round4.sequenceTimer = null
  finalState.round4.currentNumber = number
  finalState.round4.opened.push(number)
  finalState.round4.pendingScore = true
  finalState.round4.correctCount = 0
  finalState.round4.answersAllowed = false
  finalState.round4.selectedCorrectIndexes = []
  finalState.round4.assignedTeams[number] = team
  currentFinalRound3Image = ""

  const dbNumber = Number(number)

const { data, error } = await db
  .from("final_round3_items")
  .select("*")
  .eq("model", Number(currentModel))
  .eq("number", dbNumber)
  .order("image_order", { ascending: true })

  if (error) {
    console.log(error)
    showGameToast("تعذر تحميل الصور")
    return
  }

  const rows = data || []

  if (!rows.length) {
    showGameToast("لا توجد صور لهذا الرقم")

    finalState.round4.currentNumber = null
    finalState.round4.opened = finalState.round4.opened.filter(n => Number(n) !== Number(number))
    finalState.round4.pendingScore = false
    finalState.round4.correctCount = 0
    finalState.round4.answersAllowed = false
    finalState.round4.selectedCorrectIndexes = []
    finalState.round4.images = []
    finalState.round4.answers = []
    finalState.round4.notes = []
    finalState.round4.shownCount = 0

    delete finalState.round4.assignedTeams[number]

    currentFinalRound3Image = ""

    renderFinalRound4()
    saveFinalState()
    updateEndRoundButtonState()
    return
  }

  finalState.round4.images = rows.map(x => x.image || "")
  finalState.round4.answers = rows.map(x => x.answer || "")
  finalState.round4.notes = rows.map(x => x.note || "")
  finalState.round4.shownCount = 0

  renderFinalRoundTitle()
  renderFinalRound4()
  saveFinalState()
  updateEndRoundButtonState()
}

function startFinalRound4Sequence() {
  if (!finalState.round4.pendingScore || finalState.round4.currentNumber === null) {
    showGameToast("اختر الفريق ثم الرقم أولاً")
    return
  }

  clearInterval(finalState.round4.sequenceTimer)

  const stage = document.getElementById("finalRound4ImageStage")
  if (!stage) return

  if (!finalState.round4.images.length) {
    showGameToast("لا توجد صور")
    return
  }

  let idx = Number(finalState.round4.shownCount || 0)

  const showImage = () => {
    if (idx < finalState.round4.images.length) {
      currentFinalRound3Image = finalState.round4.images[idx] || ""

      stage.innerHTML = `
        <div class="finalRound3ImageFrame finalRound1RevealCard" onclick="toggleFinalRoundImageOverlay()">
          <img src="${escapeDisplayHtml(currentFinalRound3Image)}" class="finalRound3Image" alt="">
        </div>
      `

      const overlayImg = document.getElementById("finalRoundImageOverlayImg")
      if (overlayImg) overlayImg.src = currentFinalRound3Image

      finalState.round4.shownCount = idx + 1
      idx++
      saveFinalState()
      return
    }

    currentFinalRound3Image = ""

    const overlay = document.getElementById("finalRoundImageOverlay")
    if (overlay) overlay.remove()

    finalState.round4.answersAllowed = true

    clearInterval(finalState.round4.sequenceTimer)
    finalState.round4.sequenceTimer = null

    showFinalRound4Answer()
    saveFinalState()
  }

  showImage()
  finalState.round4.sequenceTimer = setInterval(showImage, 10000)
}

function showFinalRound4Answer() {
  if (!finalState.round4.pendingScore || finalState.round4.currentNumber === null) {
    showGameToast("اختر الفريق ثم الرقم أولاً")
    return
  }

  if (!finalState.round4.answersAllowed) {
    showGameToast("اعرض جميع الصور أولاً")
    return
  }

  currentFinalRound3Image = ""

  const stage = document.getElementById("finalRound4ImageStage")
  if (!stage) return

  stage.innerHTML = `
    <div class="finalRound3ResultView">
      <div class="finalRound3ResultHeader">
        <div class="finalRound3ResultTitle">اختيار الإجابات الصحيحة</div>
        <div class="finalRound3ResultCounter">
          ${Number(finalState.round4.correctCount || 0)} / ${finalState.round4.answers.length || 5}
        </div>
      </div>

      <div class="finalRound3AnswersList finalRound3AnswersPremium">
        ${finalState.round4.answers.map((answer, idx) => {
          const selected = finalState.round4.selectedCorrectIndexes.includes(idx)
          const note = finalState.round4.notes[idx] || ""

          return `
            <button
              class="finalRound3AnswerCard ${selected ? "selectedCorrect" : ""}"
              onclick="toggleFinalRound4CorrectSelection(${idx})"
            >
              <div class="finalAnswerChip">${escapeDisplayHtml(answer || "-")}</div>
              ${note ? `<div class="finalNoteBox">${escapeDisplayHtml(note)}</div>` : ""}
            </button>
          `
        }).join("")}
      </div>
    </div>
  `

  saveFinalState()
}

function toggleFinalRound4CorrectSelection(index) {
  if (!finalState.round4.pendingScore) return
  if (index < 0) return
  if (!finalState.round4.answersAllowed) return

  pushFinalHistory()

  const arr = finalState.round4.selectedCorrectIndexes
  const exists = arr.includes(index)

  finalState.round4.selectedCorrectIndexes = exists
    ? arr.filter(x => x !== index)
    : [...arr, index]

  finalState.round4.correctCount = finalState.round4.selectedCorrectIndexes.length

  renderFinalRoundTitle()

  if (finalState.round4.answersAllowed) {
    showFinalRound4Answer()
  }

  saveFinalState()
}

function finalRound4RecordScore() {
  const team = finalState.round4.activeTeam

  if (!finalState.round4.pendingScore || finalState.round4.currentNumber === null) {
    showGameToast("اختر الفريق ثم الرقم أولاً")
    return
  }

  if (!finalState.round4.answersAllowed) {
    showGameToast("اعرض الصور أولاً")
    return
  }

  if (!team) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  pushFinalHistory()

  finalState.round4.correctCount = finalState.round4.selectedCorrectIndexes.length
  finalState.round4.scores[team] += getFinalScoreValue(team, finalState.round4.correctCount)
  finalState.round4.lastTeamPlayed = team

  clearFinalActiveDouble()

  renderFinalScores()
  playGameSound("correct")
  flashScreen("correct")

  finalizeRound4Number(getOtherTeam(team))
}

function finalizeRound4Number(nextTeam = null) {
  if (finalState.round4.currentNumber !== null) {
    if (!finalState.round4.scoredNumbers.includes(finalState.round4.currentNumber)) {
      finalState.round4.scoredNumbers.push(finalState.round4.currentNumber)
    }
  }

  clearInterval(finalState.round4.sequenceTimer)

  finalState.round4.sequenceTimer = null
  finalState.round4.pendingScore = false
  finalState.round4.currentNumber = null
  finalState.round4.images = []
  finalState.round4.answers = []
  finalState.round4.notes = []
  finalState.round4.shownCount = 0
  finalState.round4.correctCount = 0
  finalState.round4.answersAllowed = false
  finalState.round4.selectedCorrectIndexes = []
  currentFinalRound3Image = ""

  const autoNextTeam =
    nextTeam ||
    getOtherTeam(finalState.round4.lastTeamPlayed || finalState.round4.activeTeam || "A")

  finalState.round4.activeTeam = autoNextTeam

  renderFinalRound()
  highlightFinalTeam(autoNextTeam)

  saveFinalState()
  updateEndRoundButtonState()
}

function toggleFinalRoundImageOverlay() {
  const oldOverlay = document.getElementById("finalRoundImageOverlay")

  if (oldOverlay) {
    oldOverlay.remove()
    return
  }

  if (!currentFinalRound3Image) return

  const overlay = document.createElement("div")
  overlay.id = "finalRoundImageOverlay"
  overlay.className = "finalRound3ImageOverlay"
  overlay.innerHTML = `
    <div class="finalRound3ImageOverlayInner">
      <img
        id="finalRoundImageOverlayImg"
        src="${escapeDisplayHtml(currentFinalRound3Image)}"
        class="finalRound3ImageOverlayImg"
        alt=""
      >
    </div>
  `

  overlay.onclick = function () {
    overlay.remove()
  }

  document.body.appendChild(overlay)
}

/* =========================
   15) PRESENTER VIDEO COMMANDS
========================= */

function getCurrentFinalVideoElement() {
  return (
    document.getElementById("finalRound3TeamMediaOverlayVideo") ||
    document.getElementById("finalRound3TeamMediaInlineVideo") ||
    document.querySelector(".finalRound3TeamMediaOverlay video") ||
    document.querySelector(".finalTeamMediaVideoFrame video") ||
    document.querySelector(".finalRound3TeamMediaStage video") ||
    document.querySelector(".finalMainStage video")
  )
}

function getCurrentFinalVideoFrame() {
  const video = getCurrentFinalVideoElement()
  if (!video) return null

  return (
    video.closest(".finalRound3TeamMediaOverlayInner") ||
    video.closest(".finalTeamMediaVideoFrame") ||
    video.closest(".finalTeamMediaFrame") ||
    video.parentElement
  )
}

function playCurrentFinalVideo() {
  const state = finalState.round3?.teamMedia

  if (
    finalState.round !== 3 ||
    finalState.round3.mode !== "team_media" ||
    !state?.currentNumber ||
    state.currentMediaType !== "video"
  ) {
    showGameToast("لا يوجد فيديو حالي")
    return
  }

  playFinalRound3TeamMediaVideo()
}

function restartCurrentFinalVideo() {
  const state = finalState.round3?.teamMedia

  if (
    finalState.round !== 3 ||
    finalState.round3.mode !== "team_media" ||
    !state?.currentNumber ||
    state.currentMediaType !== "video"
  ) {
    showGameToast("لا يوجد فيديو حالي")
    return
  }

  restartFinalRound3TeamMediaVideo()
}

function stopCurrentFinalVideo() {
  const overlayVideo = document.getElementById("finalRound3TeamMediaOverlayVideo")
  const inlineVideo = document.getElementById("finalRound3TeamMediaInlineVideo")

  ;[overlayVideo, inlineVideo].forEach(video => {
    if (!video) return

    try {
      video.pause()
      video.currentTime = 0
    } catch (e) {
      console.log("STOP FINAL VIDEO ERROR:", e)
    }
  })

  if (typeof closeFinalRound3TeamMediaOverlay === "function") {
    closeFinalRound3TeamMediaOverlay()
  }
}

function finalWrongVideoOnly() {
  const video = getCurrentFinalVideoElement()

  if (!video) {
    showGameToast("لا يوجد فيديو شغال")
    return
  }

  const frame = getCurrentFinalVideoFrame()
  if (!frame) return

  frame.classList.remove("finalVideoWrongFlash")
  void frame.offsetWidth
  frame.classList.add("finalVideoWrongFlash")

  playGameSound("wrong")

  setTimeout(() => {
    frame.classList.remove("finalVideoWrongFlash")
  }, 900)
}

window.playCurrentFinalVideo = playCurrentFinalVideo
window.restartCurrentFinalVideo = restartCurrentFinalVideo
window.stopCurrentFinalVideo = stopCurrentFinalVideo
window.finalWrongVideoOnly = finalWrongVideoOnly