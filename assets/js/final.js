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
let finalRound2ImageAutoTimer = null
let finalRound4ImageTimer = null


/* =========================
   2) SEGMENT KEYS / TITLES
========================= */

function normalizeFinalSegmentKey(key) {
  key = String(key || "")

  if (key === "final_round1") return "finalRound1"
  if (key === "final_round2") return "finalRound2"
  if (key === "final_round3") return "finalRound3"
  if (key === "final_round4") return "finalRound4"

  return key
}

function isFinalSplitSegmentKey(key) {
  key = normalizeFinalSegmentKey(key)

  return (
    key === "finalRound1" ||
    key === "finalRound2" ||
    key === "finalRound3" ||
    key === "finalRound4"
  )
}

function getFinalRoundFromSegmentKey(key) {
  key = normalizeFinalSegmentKey(key)

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

function getActiveFinalSegmentKey() {
  const current = normalizeFinalSegmentKey(currentFinalSegmentKey)
  if (isFinalSplitSegmentKey(current)) return current

  const active = normalizeFinalSegmentKey(localStorage.getItem("active_segment"))
  if (isFinalSplitSegmentKey(active)) return active

  const round = Number(window.displayFinalRound || window.currentFinalRound || finalState?.round || 1)
  return getFinalSegmentKeyFromRound(round)
}

function isFinalSplitMode() {
  return true
}

function getFinalDisplayTitle() {
  const key = getActiveFinalSegmentKey()

  if (key === "finalRound1") return "ٮدوں ٮڡاط"
  if (key === "finalRound2") return "صح صحلي"
  if (key === "finalRound3") return "قصة"
  if (key === "finalRound4") return "التركيز"

  return "الفاصلة"
}

function getFinalForcedRoundFromArgs(forcedRound, forcedSegmentKey) {
  const fixedKey = normalizeFinalSegmentKey(forcedSegmentKey)
  const fromKey = getFinalRoundFromSegmentKey(fixedKey)

  if (fromKey) return fromKey

  const numericRound = Number(forcedRound || 0)

  if ([1, 2, 3, 4].includes(numericRound)) {
    return numericRound
  }

  const active = normalizeFinalSegmentKey(localStorage.getItem("active_segment"))
  const fromActive = getFinalRoundFromSegmentKey(active)

  if (fromActive) return fromActive

  const displayRound = Number(window.displayFinalRound || window.currentFinalRound || 0)

  if ([1, 2, 3, 4].includes(displayRound)) {
    return displayRound
  }

  return 1
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
      title: "ٮدوں ٮڡاط",
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

      images: [],
      imageAnswers: [],
      shownImageIndex: 0,
      imageAnswerShown: false,

      answerShown: false,
      correctCount: 0,
      countdown: 15,
      pendingScore: false,

      assignedTeams: {
        scramble: {},
        sequence: {},
        image: {}
      },

      lastTeamPlayed: null
    },

    round3: {
      title: "قصة",
      mode: "story",

      cardsCount: 4,
      opened: [],
      scoredNumbers: [],
      activeTeam: null,
      scores: { A: 0, B: 0 },

      currentNumber: null,
      currentAnswer: "",
      currentParts: ["", "", ""],
      shownPart: 0,
      currentPoints: 0,
      answerShown: false,
      pendingScore: false,
      lastTeamPlayed: null
    },

    round4: {
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
  count: 4,
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
  imageHidden: false,
  resultType: ""
}
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

if (![4, 6, 8].includes(r.cardsCount)) {
  r.cardsCount = 6
}

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
  r.assignedTeams = {
    scramble: {},
    sequence: {},
    image: {}
  }
}

  if (!r.assignedTeams.scramble) r.assignedTeams.scramble = {}
  if (!r.assignedTeams.sequence) r.assignedTeams.sequence = {}
  if (!r.assignedTeams.image) r.assignedTeams.image = {}

  if (!Array.isArray(r.images)) r.images = []
  if (!Array.isArray(r.imageAnswers)) r.imageAnswers = []

  r.shownImageIndex = Number(r.shownImageIndex || 0)
  r.imageAnswerShown = !!r.imageAnswerShown

  r.scores.A = Number(r.scores.A || 0)
  r.scores.B = Number(r.scores.B || 0)
  r.correctCount = Number(r.correctCount || 0)
  r.countdown = Number(r.countdown ?? 15)
  r.pendingScore = !!r.pendingScore
  r.answerShown = !!r.answerShown
}

function ensureFinalRound3State() {
  const r = finalState.round3

  r.title = "قصة"
  r.mode = "story"

  r.cardsCount = Number(r.cardsCount || 4)
  if (![4, 6, 8].includes(r.cardsCount)) {
    r.cardsCount = 4
  }

  if (!Array.isArray(r.opened)) r.opened = []
  if (!Array.isArray(r.scoredNumbers)) r.scoredNumbers = []
  if (!r.scores) r.scores = { A: 0, B: 0 }
  if (!Array.isArray(r.currentParts)) r.currentParts = ["", "", ""]

  r.scores.A = Number(r.scores.A || 0)
  r.scores.B = Number(r.scores.B || 0)

  r.currentNumber = r.currentNumber ?? null
  r.currentAnswer = String(r.currentAnswer || "")
  r.shownPart = Number(r.shownPart || 0)
  r.currentPoints = Number(r.currentPoints || 0)
  r.answerShown = !!r.answerShown
  r.pendingScore = !!r.pendingScore
  r.lastTeamPlayed = r.lastTeamPlayed || null
}

function ensureFinalRound4State() {
  const r = finalState.round4
  const d = createDefaultFinalState().round4

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

  m.count = Number(m.count || 4)
  if (![4, 6, 8].includes(m.count)) {
    m.count = 4
  }

  if (!Array.isArray(m.usedNumbers)) m.usedNumbers = []
  if (!m.teamNumbers) m.teamNumbers = { A: [], B: [] }
  if (!Array.isArray(m.teamNumbers.A)) m.teamNumbers.A = []
  if (!Array.isArray(m.teamNumbers.B)) m.teamNumbers.B = []

  m.currentNumber = m.currentNumber ?? null
  m.currentTeam = m.currentTeam || null
  m.currentMediaType = String(m.currentMediaType || "")
  m.currentMedia = String(m.currentMedia || "")
  m.currentQuestion = String(m.currentQuestion || "")
  m.currentAnswer = String(m.currentAnswer || "")
  m.questionShown = !!m.questionShown
  m.answerShown = !!m.answerShown
  m.videoPlayed = !!m.videoPlayed
  m.imageHidden = !!m.imageHidden
  m.resultType = String(m.resultType || "")
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

let finalClickLock = false

function withFinalClickLock(callback, delay = 450) {
  if (finalClickLock) return

  finalClickLock = true

  try {
    callback()
  } catch (e) {
    console.log("FINAL CLICK LOCK ERROR:", e)
  }

  setTimeout(() => {
    finalClickLock = false
  }, delay)
}

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
    team = finalState.round3.activeTeam
  }

  if (finalState.round === 4) {
    team = finalState.round4.teamMedia?.currentTeam || finalState.round4.activeTeam
  }

  if (team === "A") return teamAName || "الفريق الأول"
  if (team === "B") return teamBName || "الفريق الثاني"

  return "اختر الفريق"
}

function getFinalStatusDetails() {
  const teamName = getFinalStatusTeamName()

  if (finalState.round === 1) {
    return `ٮدوں ٮڡاط  •  الفريق المختار: ${teamName}`
  }

  if (finalState.round === 2) {
    return `صح صحلي  •  الفريق المختار: ${teamName}`
  }

  if (finalState.round === 3) {
    return `قصة  •  الفريق المختار: ${teamName}`
  }

  if (finalState.round === 4) {
    return `التركيز  •  الفريق المختار: ${teamName}`
  }

  return "الفاصلة"
}

function getFinalCenterTeamOnly() {
  let team = null

  if (finalState.round === 1) {
    team = finalState.round1.activeTeam
  }

  if (finalState.round === 2) {
    team = finalState.round2.activeTeam
  }

  if (finalState.round === 3) {
    team =
      (typeof selectedTeam !== "undefined" && selectedTeam) ||
      finalState.round3.activeTeam
  }

  if (finalState.round === 4) {
    team =
      finalState.round4.teamMedia?.currentTeam ||
      finalState.round4.activeTeam
  }

  if (team === "A") return teamAName || "الفريق الأول"
  if (team === "B") return teamBName || "الفريق الثاني"

  return ""
}

function renderFinalCenterStatus() {
  const box = document.getElementById("finalCenterStatusText")
  if (!box) return

  const teamName = getFinalCenterTeamOnly() || "بدون فريق"
  const numberText = getFinalCurrentNumberText()
  const label =
    finalState.round === 1
      ? "بدون نقاط"
      : finalState.round === 2
        ? "صح صحلي"
        : finalState.round === 3
          ? "قصة"
          : finalState.round === 4
            ? "التركيز"
            : "الفاصلة"

  box.innerHTML = `
    <div class="finalCenterStatusBox">
     
      <div class="finalCenterStatusTeam">${escapeDisplayHtml(teamName)}</div>
      
    </div>
  `
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
    const n = finalState.round3.currentNumber
    return n ? `رقم ${n}` : "اختر رقم"
  }

  if (finalState.round === 4) {
    const n =
      finalState.round4.teamMedia?.currentNumber ||
      finalState.round4.currentNumber

    return n ? `رقم ${n}` : "اختر رقم"
  }

  return "اختر رقم"
}

function getFinalActiveTurnTeam() {
  if (finalState.round === 1) return finalState.round1.activeTeam || null
  if (finalState.round === 2) return finalState.round2.activeTeam || null
  if (finalState.round === 3) return finalState.round3.activeTeam || null

  if (finalState.round === 4) {
    return (
      finalState.round4.teamMedia?.currentTeam ||
      finalState.round4.activeTeam ||
      null
    )
  }

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
  if (finalState.round === 1) return "ٮدوں ٮڡاط"
  if (finalState.round === 2) return "صح صحلي"
  if (finalState.round === 3) return "قصة"
  if (finalState.round === 4) return "التركيز"

  return "الفاصلة"
}

function updateFinalTopHeaderRoundInfo() {
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

  const oldBadge = document.getElementById("finalTopRoundBadge")
  if (oldBadge) oldBadge.remove()

  titleBox.textContent = roundTitle
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
  }

  if (round === 4) {
    finalState.round4.activeTeam = team

    if (finalState.round4.teamMedia) {
      finalState.round4.teamMedia.currentTeam =
        finalState.round4.teamMedia.currentTeam || team
    }
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

  if (round === 4 && finalState.round4.teamMedia) {
    finalState.round4.teamMedia.currentTeam = null
  }

  highlightFinalTeam(nextTeam)
  renderFinalRoundTitle()
  renderFinalTurnBar()
  saveFinalState()
}

function getFinalStoryDbNumber(displayNumber) {
  return 200 + Number(displayNumber || 1)
}

function getFinalRound2ImageDbNumber(displayNumber) {
  const n = Number(displayNumber || 0)

  if (n === 3) return 101
  if (n === 6) return 102

  return 0
}

function isFinalRound2ScrambleNumber(number) {
  const n = Number(number || 0)
  return n === 1 || n === 4
}

function isFinalRound2SequenceNumber(number) {
  const n = Number(number || 0)
  return n === 2 || n === 5
}

function isFinalRound2ImageNumber(number) {
  const n = Number(number || 0)
  return n === 3 || n === 6
}

function getRound2GroupKey(number) {
  if (isFinalRound2ScrambleNumber(number)) return "scramble"
  if (isFinalRound2SequenceNumber(number)) return "sequence"
  if (isFinalRound2ImageNumber(number)) return "image"

  return ""
}

function getFinalRound3StoryCount() {
  const count = Number(finalState.round3?.cardsCount || 4)

  if (count === 8) return 8
  if (count === 6) return 6
  return 4
}

function getFinalRound4FocusCount() {
  const count = Number(finalState.round4?.teamMedia?.count || 4)

  if (count === 8) return 8
  if (count === 6) return 6
  return 4
}

function clearFinalIntervals() {
  stopFinalRound2ImageAutoShow()
  stopFinalRound4ImageTimer()

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

  if (a) {
    a.classList.remove("activeTeam", "finalTurnActiveTeam", "finalScoreTeamCurrent")
  }

  if (b) {
    b.classList.remove("activeTeam", "finalTurnActiveTeam", "finalScoreTeamCurrent")
  }

  if (team === "A" && a) {
    a.classList.add("finalScoreTeamCurrent")
  }

  if (team === "B" && b) {
    b.classList.add("finalScoreTeamCurrent")
  }

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

  let size = zoom ? "clamp(3rem, 6.3vw, 7rem)" : "clamp(1.7rem, 2.2vw, 2.45rem)"
  let line = zoom ? "1.45" : "1.82"

  if (len > 90) {
    size = zoom ? "clamp(2.6rem, 5.4vw, 6rem)" : "clamp(1.45rem, 1.95vw, 2rem)"
    line = zoom ? "1.42" : "1.72"
  }

  if (len > 140) {
    size = zoom ? "clamp(2.25rem, 4.7vw, 5.2rem)" : "clamp(1.22rem, 1.65vw, 1.7rem)"
    line = zoom ? "1.38" : "1.58"
  }

  if (len > 190) {
    size = zoom ? "clamp(1.9rem, 3.9vw, 4.35rem)" : "clamp(1.05rem, 1.42vw, 1.45rem)"
    line = zoom ? "1.34" : "1.46"
  }

  return `font-family:'MolhimCustom','HanakaText',sans-serif;font-size:${size};line-height:${line};text-wrap:balance;`
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
    return finalState.round2.opened.length >= 6 &&
      finalState.round2.scoredNumbers.length >= 6
  }

  if (round === 3) {
  const total = getFinalRound3Count()

  return finalState.round3.opened.length >= total &&
    finalState.round3.scoredNumbers.length >= total
}

  if (round === 4) {
  const total = getFinalRound4Count()

  return finalState.round4.teamMedia.usedNumbers.length >= total &&
    finalState.round4.scoredNumbers.length >= total
}

  return false
}

function getFinalRoundScores(round = finalState.round) {
  if (round === 1) return finalState.round1.scores || { A: 0, B: 0 }
  if (round === 2) return finalState.round2.scores || { A: 0, B: 0 }
  if (round === 3) return finalState.round3.scores || { A: 0, B: 0 }
  if (round === 4) return finalState.round4.scores || { A: 0, B: 0 }

  return { A: 0, B: 0 }
}

function getFinalRoundWinnerText(round = finalState.round) {
  const scores = getFinalRoundScores(round)
  const a = Number(scores.A || 0)
  const b = Number(scores.B || 0)

  if (a > b) return teamAName || "الفريق الأول"
  if (b > a) return teamBName || "الفريق الثاني"

  return "تعادل"
}

function showFinalRoundFinishedScreen() {
  const stage = document.getElementById("finalMainStage")
  if (!stage) return

  const round = Number(finalState.round || 1)
  const scores = getFinalRoundScores(round)
  const winner = getFinalRoundWinnerText(round)

  stage.innerHTML = `
    <div class="finalFinishedScreen">
      <div class="finalFinishedCard">
        <div class="finalFinishedBadge">انتهت الفقرة</div>

        <h2>${getFinalRoundTextLabel()}</h2>

        <div class="finalFinishedWinner">
          ${winner === "تعادل" ? "تعادل" : `الفائز: ${escapeDisplayHtml(winner)}`}
        </div>

        <div class="finalFinishedScores">
          <div>
            <span>${escapeDisplayHtml(teamAName || "الفريق الأول")}</span>
            <strong>${Number(scores.A || 0)}</strong>
          </div>

          <div>
            <span>${escapeDisplayHtml(teamBName || "الفريق الثاني")}</span>
            <strong>${Number(scores.B || 0)}</strong>
          </div>
        </div>
      </div>
    </div>
  `
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
    showGameToast("هذا الفريق استخدم الدبل مسبقًا في الفاصلة")
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
  const targetKey = getFinalSegmentKeyFromRound(targetRound)

  currentFinalSegmentKey = targetKey

  window.displayFinalRound = targetRound
  window.currentFinalRound = targetRound

  localStorage.setItem("active_segment", targetKey)

  if (saved) {
    restoreFinalState(saved)
  } else {
    finalState = createDefaultFinalState()
    window.finalState = finalState
    syncFinalGlobals()
  }

  await loadFinalRoundMeta()
  await loadFinalRound1CardTexts()

  finalState.round = targetRound
  currentFinalSegmentKey = targetKey

  window.displayFinalRound = targetRound
  window.currentFinalRound = targetRound

  localStorage.setItem("active_segment", targetKey)

  openSegment(getFinalDisplayTitle(), buildFinalHTML())

  renderFinalRound()
  saveFinalState()
  updateEndRoundButtonState()
  updateFinalUndoButtonState()
}

async function loadFinalRoundMeta() {
  const [metaRes, settingsRes] = await Promise.all([
    db
      .from("final_round_meta")
      .select("*")
      .eq("model", Number(currentModel))
      .order("round", { ascending: true }),

    db
      .from("segment_settings")
      .select("*")
      .eq("model", Number(currentModel))
      .in("segment", ["finalRound1", "finalRound3", "finalRound4"])
  ])

  if (metaRes.error) {
    console.log(metaRes.error)
  }

  if (settingsRes.error) {
    console.log(settingsRes.error)
  }

  const settingsMap = {}

  ;(settingsRes.data || []).forEach(row => {
    settingsMap[row.segment] = Number(row.item_count || 0)
  })

  finalState.round1.title = "ٮدوں ٮڡاط"
  finalState.round2.title = "صح صحلي"
  finalState.round3.title = "قصة"
  finalState.round4.title = "التركيز"

  finalState.round1.cardsCount = [4, 6, 8].includes(settingsMap.finalRound1)
    ? settingsMap.finalRound1
    : 6

  finalState.round3.cardsCount = [4, 6, 8].includes(settingsMap.finalRound3)
    ? settingsMap.finalRound3
    : 4

  if (!finalState.round4.teamMedia) {
    finalState.round4.teamMedia = createDefaultFinalState().round4.teamMedia
  }

  finalState.round4.teamMedia.count = [4, 6, 8].includes(settingsMap.finalRound4)
    ? settingsMap.finalRound4
    : 4

  finalState.round3.mode = "story"
  finalState.round4.mode = "team_media"

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

        <div class="finalScorePanel finalScorePanelRight" id="finalTeamBBox" onclick="selectFinalTeam('B')">
          <div class="finalScoreTeamNameBox finalScoreTeamNameFix">${teamBName}</div>
          <div class="finalScoreErrorsBox" id="finalErrorsB"></div>
          <div class="finalScoreValueBox" id="finalScoreB">0</div>
        </div>

        <div class="finalScoreCenterPanel finalCenterMiniGlass">
          <div class="finalCenterStatusText" id="finalCenterStatusText">
            اختر الفريق
          </div>
        </div>

        <div class="finalScorePanel finalScorePanelLeft" id="finalTeamABox" onclick="selectFinalTeam('A')">
          <div class="finalScoreValueBox" id="finalScoreA">0</div>
          <div class="finalScoreErrorsBox" id="finalErrorsA"></div>
          <div class="finalScoreTeamNameBox finalScoreTeamNameFix">${teamAName}</div>
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

if (isFinalRoundFinished(finalState.round)) {
  showFinalRoundFinishedScreen()
  updateFinalDoubleButton()
  syncFinalGlobals()
  saveFinalState()
  updateFinalUndoButtonState()
  return
}

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
  ensureFinalStateShape()

  if (finalState.round === 1) {
    if (!finalState.round1.pendingScore || finalState.round1.currentNumber === null) {
      showGameToast("افتح الرقم أولاً")
      return
    }

    finalState.round1.activeTeam =
      finalState.round1.activeTeam === team ? null : team
  }

  if (finalState.round === 2) {
    if (finalState.round2.pendingScore) {
      showGameToast("سجل نتيجة الرقم الحالي أولاً")
      return
    }

    if (finalState.round2.lastTeamPlayed === team) {
      showGameToast("الدور للفريق الثاني")
      return
    }

    finalState.round2.activeTeam = team
  }

  if (finalState.round === 3) {
    if (!finalState.round3.pendingScore || !finalState.round3.currentNumber) {
      showGameToast("افتح رقمًا أولاً")
      return
    }

    finalState.round3.activeTeam =
      finalState.round3.activeTeam === team ? null : team
  }

  if (finalState.round === 4) {
    if (finalState.round4.teamMedia?.currentNumber) {
      showGameToast("أنه الدور الحالي أولاً")
      return
    }

    if (finalState.round4.lastTeamPlayed === team) {
      showGameToast("لا يمكن نفس الفريق يلعب دورين وراء بعض")
      return
    }

    finalState.round4.activeTeam = team
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
   11) ROUND 1 - ٮدوں ٮڡاط
========================= */
function getFinalRound1NoDotsCount() {
  const cardsCount = Number(finalState.round1.cardsCount || 6)

  if (cardsCount === 4) return 4
  if (cardsCount === 8) return 8
  return 6
}

function isFinalRound1TextCard(number) {
  return Number(number) >= 1 && Number(number) <= getFinalRound1NoDotsCount()
}

function isFinalRound1QuestionCard() {
  return false
}


function renderFinalRound1() {
  const stage = document.getElementById("finalMainStage")
  const controls = document.getElementById("finalControlsBar")
  if (!stage || !controls) return

  setFinalControlsMode(1)

  const cardsCount = Number(finalState.round1.cardsCount || 6)
  let cards = []

  for (let i = 1; i <= cardsCount; i++) {
  const current = Number(finalState.round1.currentNumber) === i
  const opened = finalState.round1.opened.includes(i)
  const locked = finalState.round1.pendingScore && !current
  const disabled = (opened && !current) || locked

  cards.push(`
    <button
      class="finalRound1Card ${opened ? "used" : ""} ${current ? "active" : ""} ${locked ? "locked" : ""}"
      ${disabled ? "disabled" : ""}
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

  const nextRoundButton = isFinalSplitMode()
  ? ""
  : `<button onclick="goToFinalRound(2)" class="archiveCtrlBtn roundNavBtn">الجولة التالية</button>`

controls.innerHTML = `
  <button onclick="activateFinalDouble()" id="finalDoubleBtn" class="archiveCtrlBtn finalDoubleBtn">
    دبل
  </button>

  <button onclick="finalRound1Correct()" class="archiveCtrlBtn btnCorrect">
    إجابة صحيحة
  </button>

  <button onclick="finalRound1Wrong()" class="archiveCtrlBtn btnWrong">
    خطأ
  </button>

  <button onclick="undoFinalAction()" class="archiveCtrlBtn undoBtn finalUndoBtn">
    تراجع
  </button>

  ${nextRoundButton}
`

  updateFinalDoubleButton()

  if (finalState.round1.currentNumber) {
    loadFinalRound1Current()
  }
}

async function openFinalRound1Card(number) {
  if (finalState.round1.pendingScore) {
    showGameToast("أنهِ الرقم الحالي أولاً")
    return
  }

  if (finalState.round1.opened.includes(number)) return

  pushFinalHistory()

  finalState.round1.currentNumber = number
  finalState.round1.opened.push(number)
  finalState.round1.pendingScore = true
  finalState.round1.activeTeam = null

  finalState.round1.currentAnswer = ""
  finalState.round1.currentImage = ""
  finalState.round1.currentNote = ""
  finalState.round1.currentQuestionParts = []
  finalState.round1.shownQuestionPartsCount = 0
  finalState.round1.answerShown = false
  finalState.round1.errors.A = 0
  finalState.round1.errors.B = 0

  highlightFinalTeam(null)
  renderFinalRound1()
  renderFinalErrors()
  renderFinalTurnBar()
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
                <span>${escapeDisplayHtml(part)}</span>
              </div>
            `).join("")}
          </div>
        </div>
      `
    } else if (finalState.round1.currentImage) {
      mainContent = `
        <div class="finalRound1MainStageCard finalRound1PremiumStage">
          <div class="finalRound1ImageFrame finalRound1RevealCard" onclick="toggleFinalRound1ImageOverlay()">
            <img class="finalRound1BigImage" src="${escapeDisplayHtml(finalState.round1.currentImage)}" alt="">
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
          <img class="finalRound1BigImage" src="${escapeDisplayHtml(finalState.round1.currentImage)}" alt="">
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
          ${escapeDisplayHtml(finalState.round1.currentAnswer)}
        </div>
      </div>
    `
  }

  box.innerHTML = `
    <div class="finalRound1StageLayout finalRound1PremiumLayout ${answerContent ? "finalRound1AnswerLayout" : "finalRound1QuestionOnlyLayout"}">

      <div class="finalRound1QuestionSide">
        ${mainContent}
      </div>

      ${answerContent ? `
        <div class="finalRound1AnswerSide finalRound1BottomInfoRow">
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

function finalRound1Correct() {
  ensureFinalRound1State()

  if (!finalState.round1.pendingScore || finalState.round1.currentNumber === null) {
    showGameToast("افتح رقمًا أولاً")
    return
  }

  const team = finalState.round1.activeTeam

  if (!team) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  if (finalState.round1.answerShown) {
    showGameToast("تم تسجيل الإجابة")
    return
  }

  pushFinalHistory()

  finalState.round1.scores[team] += getFinalScoreValue(team, 1)
  finalState.round1.answerShown = true

  clearFinalActiveDouble()

  playGameSound("correct")
  flashScreen("correct")

  renderFinalScores()
  loadFinalRound1Current()
  saveFinalState()

  setTimeout(() => {
    finalizeRound1Turn()
  }, 8000)
}

function finalRound1Wrong() {
  if (!finalState.round1.pendingScore || finalState.round1.currentNumber === null) {
    showGameToast("افتح رقمًا أولاً")
    return
  }

  playGameSound("wrong")
  flashScreen("wrong")

  saveFinalState()
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

  highlightFinalTeam(null)
  renderFinalRound()
  renderFinalTurnBar()
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

  for (let i = 1; i <= 6; i++) {
  const current = Number(finalState.round2.currentNumber) === i
  const opened = finalState.round2.opened.includes(i)
  const locked = finalState.round2.pendingScore && !current
  const disabled = (opened && !current) || locked

  grid += `
    <button
      class="finalRound2Card ${opened ? "used" : ""} ${current ? "active" : ""} ${locked ? "locked" : ""}"
      ${disabled ? "disabled" : ""}
      onclick="openFinalRound2Card(${i})"
    >
      ${i}
    </button>
  `
}

  const isScramble = finalState.round2.currentType === "scramble"
  const isSequence = finalState.round2.currentType === "sequence"
  const isImage = finalState.round2.currentType === "image"

  stage.innerHTML = `
    <div class="finalRound2Wrap">
      <div class="finalRound2Grid finalRound2SixNumbersGrid">${grid}</div>

      <div
        class="finalRound2WordsStage"
        id="finalRound2WordsStage"
        data-round2-number="${Number(finalState.round2.currentNumber || 0)}"
      >
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

    <button onclick="finalRound2ShowNextImage()" class="archiveCtrlBtn btnStart" ${isImage ? "" : "disabled"}>
  بدء عرض الصور
</button>

    <button onclick="finalRound2RecordScore()" class="archiveCtrlBtn btnCorrect" ${isScramble ? "" : "disabled"}>
      تسجيل المبعثرة
    </button>

    <button onclick="finalRound2RecordSequenceScore()" class="archiveCtrlBtn btnCorrect" ${isSequence ? "" : "disabled"}>
  ${isSequence ? `تسجيل الترتيب (${Number(finalState.round2.countdown || 0)})` : "تسجيل الترتيب"}
</button>

    <button onclick="finalRound2RecordImageScore()" class="archiveCtrlBtn btnCorrect" ${isImage ? "" : "disabled"}>
      تسجيل الصورة
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

  const team = finalState.round2.activeTeam

  if (!team) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  if (finalState.round2.lastTeamPlayed === team) {
    showGameToast("لا يمكن نفس الفريق يلعب دورين وراء بعض")
    return
  }

  if (finalState.round2.opened.includes(number)) return

  const groupKey = getRound2GroupKey(number)

  if (!groupKey) {
    showGameToast("رقم غير صحيح")
    return
  }

  const teamValues = Object.values(finalState.round2.assignedTeams[groupKey] || {})

  if (teamValues.includes(team)) {
    showGameToast("هذا الفريق لعب هذا النوع مسبقًا")
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

  finalState.round2.images = []
  finalState.round2.imageAnswers = []
  finalState.round2.shownImageIndex = 0
  finalState.round2.imageAnswerShown = false

  finalState.round2.assignedTeams[groupKey][number] = team

  if (groupKey === "image") {
    await loadFinalRound2ImageNumber(number, groupKey)
    return
  }

  const { data, error } = await db
    .from("final_round2_items")
    .select("*")
    .eq("model", Number(currentModel))
    .eq("number", Number(number))
    .order("item_order", { ascending: true })

  if (error) {
    console.log(error)
    showGameToast("تعذر تحميل بيانات الرقم")
    return
  }

  const items = data || []

  if (!items.length) {
    resetFinalRound2EmptyNumber(number, groupKey)
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

  setTimeout(() => {
    updateFinalRound2CountdownButtonLabel()
    updateFinalRound2SequenceScoreButtonLabel()
  }, 50)
}

async function loadFinalRound2ImageNumber(displayNumber, groupKey) {
  const dbNumber = getFinalRound2ImageDbNumber(displayNumber)

  const { data, error } = await db
    .from("final_round3_items")
    .select("*")
    .eq("model", Number(currentModel))
    .eq("number", Number(dbNumber))
    .order("image_order", { ascending: true })

  if (error) {
    console.log(error)
    showGameToast("تعذر تحميل صور الرقم")
    return
  }

  const rows = data || []

  if (!rows.length) {
    resetFinalRound2EmptyNumber(displayNumber, groupKey)
    return
  }

  finalState.round2.images = rows.map(x => x.image || "")
  finalState.round2.imageAnswers = rows.map(x => x.answer || "")
  finalState.round2.shownImageIndex = 0
  finalState.round2.imageAnswerShown = false
  finalState.round2.answerShown = false

  renderFinalRound2()
  renderFinalRoundTitle()
  renderFinalRound2Words(false)
  saveFinalState()
  updateEndRoundButtonState()
}

function resetFinalRound2EmptyNumber(number, groupKey) {
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

  finalState.round2.images = []
  finalState.round2.imageAnswers = []
  finalState.round2.shownImageIndex = 0
  finalState.round2.imageAnswerShown = false
  closeFinalRound2ImageAutoOverlay()

  if (groupKey && finalState.round2.assignedTeams?.[groupKey]) {
    delete finalState.round2.assignedTeams[groupKey][number]
  }

  renderFinalRound2()
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
    renderFinalRound2ScrambleWords(box, showAnswers)
    return
  }

  if (finalState.round2.currentType === "sequence") {
    renderFinalRound2SequenceWords(box)
    return
  }

  if (finalState.round2.currentType === "image") {
    renderFinalRound2ImageWords(box)
    return
  }
}

function renderFinalRound2ScrambleWords(box, showAnswers) {
  if (showAnswers) {
    const count = finalState.round2.scrambledWords.length

    box.innerHTML = `
      <div class="finalRound2ScrambleAnswerStage finalAnswersCount${count}">
        <div class="finalRound2AnswerGrid finalRound2ScrambleGrid finalAnswersCount${count}">
          ${finalState.round2.scrambledWords.map((word, idx) => {
            const selected = finalState.round2.selectedCorrectIndexes.includes(idx)

            return `
              <button
                class="finalRound2AnswerCard ${selected ? "selectedCorrect" : ""}"
                onclick="toggleFinalRound2CorrectSelection(${idx})"
              >
                <div class="finalRound2AnswerScrambled">
                  ${escapeDisplayHtml(word)}
                </div>

                <div class="finalRound2AnswerCorrect">
                  ${escapeDisplayHtml(finalState.round2.answers[idx] || "-")}
                </div>
              </button>
            `
          }).join("")}
        </div>
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
}

function renderFinalRound2SequenceWords(box) {
  const countdown = Number(finalState.round2.countdown || 0)
  const timerClass = countdown <= 5 ? "danger" : ""

  const words = Array.isArray(finalState.round2.allWords)
    ? finalState.round2.allWords
    : []

  if (!words.length) {
    box.innerHTML = `
      <div class="finalSequenceStageBox">
        <div class="finalSequenceTimerBadge ${timerClass}">
          <span>المتبقي</span>
          <strong>${countdown}</strong>
        </div>

        <div class="finalRoundPlaceholder">
          لا توجد كلمات
        </div>
      </div>
    `
    return
  }

  const allHidden = words.every((_, idx) => {
    return finalState.round2.hiddenSequence.includes(idx)
  })

  if (allHidden) {
    box.innerHTML = `
      <div class="finalSequenceStageBox">
        <div class="finalSequenceTimerBadge ${timerClass}">
          <span>المتبقي</span>
          <strong>${countdown}</strong>
        </div>

        <div class="finalSequenceWordsWrap finalSequenceWordsDone">
          ${words.map((word, idx) => `
            <button
              class="finalSequenceWordBtn isHiddenWord"
              disabled
              type="button"
            >
              ${escapeDisplayHtml(word)}
            </button>
          `).join("")}
        </div>
      </div>
    `
    return
  }

  box.innerHTML = `
    <div class="finalSequenceStageBox">

      <div class="finalSequenceTimerBadge ${timerClass}">
        <span>المتبقي</span>
        <strong>${countdown}</strong>
      </div>

      <div class="finalSequenceWordsWrap">
        ${words.map((word, idx) => {
          const hidden = finalState.round2.hiddenSequence.includes(idx)

          return `
            <button
              class="finalSequenceWordBtn ${hidden ? "isHiddenWord" : ""}"
              ${hidden ? "disabled" : ""}
              type="button"
              onclick="${hidden ? "" : `hideFinalRound2SequenceWord(${idx})`}"
            >
              ${escapeDisplayHtml(word)}
            </button>
          `
        }).join("")}
      </div>

    </div>
  `
}

function renderFinalRound2ImageWords(box) {
  const images = finalState.round2.images || []
  const answers = finalState.round2.imageAnswers || []
  const shown = Number(finalState.round2.shownImageIndex || 0)
  const answersCount = answers.length

  if (!images.length) {
    box.innerHTML = `<div class="finalRoundPlaceholder">لا توجد صور</div>`
    return
  }

  if (finalState.round2.imageAnswerShown) {
    box.innerHTML = `
      <div class="finalRound3ResultView finalRound2ImageAnswerStage">
        <div class="finalRound3AnswersList finalRound3AnswersPremium finalAnswersCount${answersCount}">
          ${answers.map((answer, idx) => {
            const selected = finalState.round2.selectedCorrectIndexes.includes(idx)

            return `
              <button
                class="finalRound3AnswerCard ${selected ? "selectedCorrect" : ""}"
                onclick="toggleFinalRound2ImageCorrectSelection(${idx})"
              >
                <div class="finalAnswerChip">${escapeDisplayHtml(answer || "-")}</div>
              </button>
            `
          }).join("")}
        </div>
      </div>
    `
    return
  }

  if (shown <= 0) {
    box.innerHTML = `<div class="finalRoundPlaceholder">اضغط بدء عرض الصور</div>`
    return
  }

  const currentIndex = Math.min(shown - 1, images.length - 1)
  const currentImage = images[currentIndex] || ""

  if (!currentImage) {
    box.innerHTML = `<div class="finalRoundPlaceholder">الصورة غير موجودة</div>`
    return
  }

  box.innerHTML = `
    <div class="finalRound3ImageFrame finalRound1RevealCard" onclick="toggleFinalRound2ImageOverlay()">
      <img src="${escapeDisplayHtml(currentImage)}" class="finalRound3Image" alt="">
    </div>
  `

  currentFinalRound3Image = currentImage
}

function stopFinalRound2ImageAutoShow() {
  if (finalRound2ImageAutoTimer) {
    clearTimeout(finalRound2ImageAutoTimer)
    finalRound2ImageAutoTimer = null
  }
}

function closeFinalRound2ImageAutoOverlay() {
  stopFinalRound2ImageAutoShow()

  const overlay = document.getElementById("finalRound2ImageAutoOverlay")
  if (overlay) overlay.remove()
}

function showFinalRound2ImageAutoOverlay(src, index, total) {
  let overlay = document.getElementById("finalRound2ImageAutoOverlay")

  if (!overlay) {
    overlay = document.createElement("div")
    overlay.id = "finalRound2ImageAutoOverlay"
    overlay.className = "finalRound2ImageAutoOverlay"
    document.body.appendChild(overlay)
  }

  overlay.innerHTML = `
    <div class="finalRound2ImageAutoInner">
      <div class="finalRound2ImageAutoCounter">
        ${index} / ${total}
      </div>

      <img
        class="finalRound2ImageAutoImg"
        src="${escapeDisplayHtml(src)}"
        alt=""
      >
    </div>
  `
}

function startFinalRound2ImageAutoShow() {
  ensureFinalRound2State()

  if (
    !finalState.round2.pendingScore ||
    !finalState.round2.currentNumber ||
    finalState.round2.currentType !== "image"
  ) {
    showGameToast("اختر رقم الصورة أولاً")
    return
  }

  const images = finalState.round2.images || []

  if (!images.length) {
    showGameToast("لا توجد صور لهذا الرقم")
    return
  }

  stopFinalRound2ImageAutoShow()

  pushFinalHistory()

  finalState.round2.shownImageIndex = 0
  finalState.round2.imageAnswerShown = false
  finalState.round2.answerShown = false

  let currentIndex = 0

  const showNext = () => {
    if (currentIndex >= images.length) {
      const overlay = document.getElementById("finalRound2ImageAutoOverlay")
if (overlay) overlay.remove()

stopFinalRound2ImageAutoShow()

      finalState.round2.shownImageIndex = images.length
      finalState.round2.imageAnswerShown = true
      finalState.round2.answerShown = true
      currentFinalRound3Image = ""

      playGameSound("answer")

      renderFinalRoundTitle()
      renderFinalRound2Words(true)
      updateFinalRound2SequenceScoreButtonLabel()
      saveFinalState()
      return
    }

    const src = images[currentIndex]
    finalState.round2.shownImageIndex = currentIndex + 1
    currentFinalRound3Image = src

    showFinalRound2ImageAutoOverlay(src, currentIndex + 1, images.length)

    playGameSound("open")

    renderFinalRoundTitle()
    renderFinalRound2Words(false)
    saveFinalState()

    currentIndex += 1

    finalRound2ImageAutoTimer = setTimeout(showNext, 7000)
  }

  showNext()
}

function finalRound2ShowNextImage() {
  startFinalRound2ImageAutoShow()
}

function toggleFinalRound2ImageCorrectSelection(index) {
  if (!finalState.round2.pendingScore) return
  if (finalState.round2.currentType !== "image") return
  if (!finalState.round2.imageAnswerShown) return
  if (index < 0) return

  pushFinalHistory()

  const arr = finalState.round2.selectedCorrectIndexes
  const exists = arr.includes(index)

  finalState.round2.selectedCorrectIndexes = exists
    ? arr.filter(x => x !== index)
    : [...arr, index]

  finalState.round2.correctCount = finalState.round2.selectedCorrectIndexes.length

  renderFinalRoundTitle()
  renderFinalRound2Words(false)
  saveFinalState()
}

function toggleFinalRound2ImageOverlay() {
  const oldOverlay = document.getElementById("finalRound2ImageOverlay")

  if (oldOverlay) {
    oldOverlay.remove()
    return
  }

  if (!currentFinalRound3Image) return

  const overlay = document.createElement("div")
  overlay.id = "finalRound2ImageOverlay"
  overlay.className = "finalRound3ImageOverlay"
  overlay.innerHTML = `
    <div class="finalRound3ImageOverlayInner">
      <img
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
  if (index < 0) return

  if (finalState.round2.currentType === "image") {
    toggleFinalRound2ImageCorrectSelection(index)
    return
  }

  if (finalState.round2.currentType !== "scramble") return

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
  updateFinalRound2SequenceScoreButtonLabel()
  saveFinalState()
}

function finalRound2DecreaseCountdown() {
  if (!finalState.round2.pendingScore || finalState.round2.currentNumber === null) {
    showGameToast("اختر الفريق ثم الرقم أولاً")
    return
  }

  if (finalState.round2.currentType !== "sequence") {
    showGameToast("هذا الزر خاص بالرقمين 2 و 5")
    return
  }

  pushFinalHistory()

  if (finalState.round2.countdown > 0) {
    finalState.round2.countdown -= 1
  }

  if (finalState.round2.countdown <= 0) {
    finalState.round2.countdown = 0
    finalState.round2.answerShown = true

    renderFinalRoundTitle()
    renderFinalRound2Words(true)

    updateFinalRound2CountdownButtonLabel()
    updateFinalRound2SequenceScoreButtonLabel()

    flashScreen("wrong")
    saveFinalState()
    return
  }

  renderFinalRoundTitle()
  renderFinalRound2Words(false)

  updateFinalRound2CountdownButtonLabel()
  updateFinalRound2SequenceScoreButtonLabel()

  saveFinalState()
}

function updateFinalRound2SequenceScoreButtonLabel() {
  const btn = document.querySelector('[onclick="finalRound2RecordSequenceScore()"]')
  if (!btn) return

  const isSequence =
    finalState?.round === 2 &&
    finalState?.round2?.currentType === "sequence" &&
    finalState?.round2?.pendingScore

  if (!isSequence) {
    btn.innerText = "تسجيل الترتيب"
    return
  }

  const countdown = Number(finalState.round2.countdown || 0)
  btn.innerText = `تسجيل الترتيب (${countdown})`
}

function updateFinalRound2CountdownButtonLabel() {
  const btn = document.querySelector('[onclick="finalRound2DecreaseCountdown()"]')
  if (!btn) return

  const isSequence =
    finalState?.round === 2 &&
    finalState?.round2?.currentType === "sequence" &&
    finalState?.round2?.pendingScore

  if (!isSequence) {
    btn.innerText = "العداد"
    return
  }

  const countdown = Number(finalState.round2.countdown || 0)
  btn.innerText = countdown
}

function finalRound2RecordScore() {
  const team = finalState.round2.activeTeam

  if (!finalState.round2.pendingScore || finalState.round2.currentNumber === null) {
    showGameToast("اختر الفريق ثم الرقم أولاً")
    return
  }

  if (finalState.round2.currentType !== "scramble") {
    showGameToast("هذا الزر خاص بالرقمين 1 و 4")
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
    showGameToast("هذا الزر خاص بالرقمين 2 و 5")
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

function finalRound2RecordImageScore() {
  const team = finalState.round2.activeTeam

  if (!finalState.round2.pendingScore || finalState.round2.currentNumber === null) {
    showGameToast("اختر الفريق ثم الرقم أولاً")
    return
  }

  if (finalState.round2.scoredNumbers.includes(finalState.round2.currentNumber)) {
  showGameToast("تم تسجيل هذا الرقم")
  return
}

  if (finalState.round2.currentType !== "image") {
    showGameToast("هذا الزر خاص بالرقمين 3 و 6")
    return
  }

  if (!finalState.round2.imageAnswerShown) {
    showGameToast("اعرض كل الصور أولاً")
    return
  }

  if (finalState.round2.scoredNumbers.includes(finalState.round2.currentNumber)) {
  showGameToast("تم تسجيل هذا الرقم")
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

function finalizeRound2Number() {
  const currentNumber = finalState.round2.currentNumber
  const playedTeam = finalState.round2.activeTeam || finalState.round2.lastTeamPlayed || null

  if (currentNumber !== null) {
    if (!finalState.round2.scoredNumbers.includes(currentNumber)) {
      finalState.round2.scoredNumbers.push(currentNumber)
    }
  }

  clearInterval(finalState.round2.revealTimer)

  const overlay = document.getElementById("finalRound2ImageOverlay")
  if (overlay) overlay.remove()

  closeFinalRound2ImageAutoOverlay()

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

  finalState.round2.images = []
  finalState.round2.imageAnswers = []
  finalState.round2.shownImageIndex = 0
  finalState.round2.imageAnswerShown = false

  currentFinalRound3Image = ""

  if (playedTeam === "A" || playedTeam === "B") {
    finalState.round2.lastTeamPlayed = playedTeam
    finalState.round2.activeTeam = getOtherTeam(playedTeam)
  } else {
    finalState.round2.activeTeam = null
  }

  renderFinalRound()

  if (finalState.round2.activeTeam) {
    highlightFinalTeam(finalState.round2.activeTeam)
  } else {
    highlightFinalTeam(null)
  }

  renderFinalTurnBar()
  saveFinalState()
  updateEndRoundButtonState()

  setTimeout(() => {
    updateFinalRound2CountdownButtonLabel()
    updateFinalRound2SequenceScoreButtonLabel()
  }, 50)
}
/* =========================
   13) ROUND 3 - قصة
========================= */

function getFinalRound3Count() {
  const count = Number(finalState.round3?.cardsCount || 4)

  if (count === 8) return 8
  if (count === 6) return 6
  return 4
}


function renderFinalRound3() {
  const stage = document.getElementById("finalMainStage")
  const controls = document.getElementById("finalControlsBar")
  if (!stage || !controls) return

  ensureFinalRound3State()
  setFinalControlsMode(3)

  const count = getFinalRound3Count()
  let grid = ""

  for (let i = 1; i <= count; i++) {
  const current = Number(finalState.round3.currentNumber) === i
  const opened = finalState.round3.opened.includes(i)
  const locked = finalState.round3.pendingScore && !current
  const disabled = (opened && !current) || locked

  grid += `
    <button
      class="finalRound3Card finalStoryNumberCard ${opened ? "used" : ""} ${current ? "active" : ""} ${locked ? "locked" : ""}"
      ${disabled ? "disabled" : ""}
      onclick="openFinalRound3StoryCard(${i})"
    >
      ${i}
    </button>
  `
}

  stage.innerHTML = `
    <div class="finalRound3Wrap finalStoryWrap">
      <div class="finalRound3Grid finalStoryNumbersGrid">
        ${grid}
      </div>

      <div class="finalRound3ImageStageWrap finalStoryStageWrap">
        <div class="finalRound3ImageStage finalStoryStage" id="finalStoryStage">
          ${buildFinalRound3StoryContent()}
        </div>
      </div>
    </div>
  `

  const hasCurrent = !!finalState.round3.currentNumber
  const shownPart = Number(finalState.round3.shownPart || 0)
  const canShowPart = hasCurrent && shownPart < 3 && !finalState.round3.answerShown
  const canScore = hasCurrent && shownPart > 0

  const nextPartText =
    shownPart === 0
      ? "إظهار الجزء الأول"
      : shownPart === 1
        ? "إظهار الجزء الثاني"
        : shownPart === 2
          ? "إظهار الجزء الثالث"
          : "اكتملت الأجزاء"

  const nextRoundButton = isFinalSplitMode()
    ? ""
    : `<button onclick="goToFinalRound(4)" class="archiveCtrlBtn roundNavBtn">الجولة التالية</button>`

  controls.innerHTML = `
    <button onclick="activateFinalDouble()" id="finalDoubleBtn" class="archiveCtrlBtn finalDoubleBtn">
      دبل
    </button>

    <button onclick="showFinalRound3StoryPart()" class="archiveCtrlBtn btnStart" ${canShowPart ? "" : "disabled"}>
      ${nextPartText}
    </button>

    <button onclick="finalRound3StoryCorrect()" class="archiveCtrlBtn btnCorrect" ${canScore ? "" : "disabled"}>
      إجابة صحيحة
    </button>

    <button onclick="finalRound3StoryWrong()" class="archiveCtrlBtn btnWrong" ${hasCurrent ? "" : "disabled"}>
      خطأ
    </button>

    <button onclick="undoFinalAction()" class="archiveCtrlBtn undoBtn finalUndoBtn">
      تراجع
    </button>

    ${nextRoundButton}
  `

  renderFinalRoundTitle()
  renderFinalScores()
  renderFinalTurnBar()
  updateFinalUndoButtonState()
  updateFinalDoubleButton()
  updateEndRoundButtonState()
  saveFinalState()
}

function buildFinalRound3StoryContent() {
  const state = finalState.round3

  if (!state.currentNumber) {
    return `
      <div class="finalStoryCleanEmpty">
        اختر رقم
      </div>
    `
  }

  const shownPart = Number(state.shownPart || 0)
  const parts = Array.isArray(state.currentParts) ? state.currentParts : ["", "", ""]
  const visibleParts = parts.slice(0, shownPart)
  const partsCount = visibleParts.length

  const getPartPoints = index => {
    if (index === 0) return 3
    if (index === 1) return 2
    return 1
  }

  const answerHTML =
    state.answerShown && state.currentAnswer
      ? `
        <div class="finalStoryCleanAnswer">
          ${escapeDisplayHtml(state.currentAnswer)}
        </div>
      `
      : ""

  if (!shownPart) {
    return `
      <div class="finalStoryCleanEmpty">
        اضغط إظهار الجزء
      </div>
    `
  }

  return `
    <div class="finalStoryStackContent finalStoryPartsCount${partsCount} ${answerHTML ? "finalStoryHasAnswer" : ""}">

      <div class="finalStoryPartsStack finalStoryPartsCount${partsCount}">
        ${visibleParts.map((part, index) => `
          <div class="finalStoryStackPart">
            <div class="finalStoryStackPoints">
              ${getPartPoints(index)}
            </div>

            <div class="finalStoryStackText">
              ${escapeDisplayHtml(part || "-")}
            </div>
          </div>
        `).join("")}
      </div>

      ${answerHTML}

    </div>
  `
}

async function openFinalRound3StoryCard(number) {
  ensureFinalRound3State()

  const n = Number(number)

  if (finalState.round3.opened.includes(n)) {
    showGameToast("هذا الرقم مستخدم")
    return
  }

  pushFinalHistory()

  finalState.round3.currentNumber = n
  finalState.round3.currentParts = []
  finalState.round3.currentAnswer = ""
  finalState.round3.shownPart = 0
  finalState.round3.currentPoints = 0
  finalState.round3.answerShown = false
  finalState.round3.pendingScore = true
  finalState.round3.activeTeam = null

  const dbNumber = getFinalStoryDbNumber(n)

  const { data, error } = await db
    .from("final_round1_items")
    .select("*")
    .eq("model", Number(currentModel))
    .eq("number", Number(dbNumber))
    .maybeSingle()

  if (error) {
    console.log("LOAD FINAL STORY ERROR:", error)
    showGameToast("تعذر تحميل بيانات الرقم")
    finalState.round3.currentNumber = null
    saveFinalState()
    renderFinalRound()
    return
  }

  if (!data) {
    showGameToast("لا توجد بيانات لهذا الرقم")
    finalState.round3.currentNumber = null
    saveFinalState()
    renderFinalRound()
    return
  }

  finalState.round3.currentParts = [
    data.question_part1 || "",
    data.question_part2 || "",
    data.question_part3 || ""
  ].filter(Boolean)

  finalState.round3.currentAnswer = data.answer || ""

  playGameSound("open")

  renderFinalRound()
  saveFinalState()
}

function showFinalRound3StoryPart() {
  ensureFinalRound3State()

  if (!finalState.round3.pendingScore || !finalState.round3.currentNumber) {
    showGameToast("اختر رقم أولاً")
    return
  }

  const totalParts = finalState.round3.currentParts.length || 0

  if (finalState.round3.shownPart >= totalParts) {
    showGameToast("ظهرت كل الأجزاء")
    return
  }

  pushFinalHistory()

  finalState.round3.shownPart += 1

  if (finalState.round3.shownPart === 1) {
    finalState.round3.currentPoints = 3
  } else if (finalState.round3.shownPart === 2) {
    finalState.round3.currentPoints = 2
  } else {
    finalState.round3.currentPoints = 1
  }

  playGameSound("answer")

  renderFinalRound3()
  updateFinalTopHeaderRoundInfo()
  renderFinalTurnBar()
  updateFinalDoubleButton()
  saveFinalState()
}

function finalRound3StoryCorrect() {
  ensureFinalRound3State()

  if (!finalState.round3.pendingScore || !finalState.round3.currentNumber) {
    showGameToast("لا يوجد رقم مفتوح")
    return
  }

  if (!finalState.round3.shownPart) {
    showGameToast("أظهر جزء من القصة أولاً")
    return
  }

  const team = finalState.round3.activeTeam

  if (!team) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  if (finalState.round3.answerShown) {
    showGameToast("تم تسجيل الإجابة")
    return
  }

  pushFinalHistory()

  const points = Number(finalState.round3.currentPoints || 1)
  const totalParts = finalState.round3.currentParts.length || 0

  finalState.round3.scores[team] += getFinalScoreValue(team, points)
  finalState.round3.answerShown = true
  finalState.round3.shownPart = totalParts
  finalState.round3.lastTeamPlayed = team

  clearFinalActiveDouble()

  playGameSound("correct")
  flashScreen("correct")

  renderFinalScores()
  renderFinalRound3()
  updateFinalTopHeaderRoundInfo()
  saveFinalState()

  setTimeout(() => {
    finalizeFinalRound3StoryTurn()
  }, 5000)
}

function finalRound3StoryWrong() {
  ensureFinalRound3State()

  if (!finalState.round3.pendingScore || !finalState.round3.currentNumber) {
    showGameToast("لا يوجد رقم مفتوح")
    return
  }

  playGameSound("wrong")
  flashScreen("wrong")

  saveFinalState()
}

function finalizeFinalRound3StoryTurn() {
  ensureFinalRound3State()

  const n = Number(finalState.round3.currentNumber || 0)

  if (n) {
    if (!finalState.round3.opened.includes(n)) {
      finalState.round3.opened.push(n)
    }

    if (!finalState.round3.scoredNumbers.includes(n)) {
      finalState.round3.scoredNumbers.push(n)
    }
  }

  finalState.round3.currentNumber = null
  finalState.round3.currentParts = []
  finalState.round3.currentAnswer = ""
  finalState.round3.shownPart = 0
  finalState.round3.currentPoints = 0
  finalState.round3.answerShown = false
  finalState.round3.pendingScore = false
  finalState.round3.activeTeam = null

  highlightFinalTeam(null)
  renderFinalRound()
  renderFinalTurnBar()
  saveFinalState()
}
/* =========================
   14) ROUND 4 - التركيز
========================= */

function getFinalRound4Count() {
  const count = Number(
    finalState.round4?.teamMedia?.count ||
    4
  )

  if (count === 8) return 8
  if (count === 6) return 6
  return 4
}

function getFinalRound4MaxPerTeam() {
  return Math.ceil(getFinalRound4Count() / 2)
}

function renderFinalRound4() {
  ensureFinalRound4State()
  renderFinalRound4TeamMedia()
}

async function loadFinalRound4TeamMediaItem(number) {
  const { data, error } = await db
    .from("final_round3_items")
    .select("*")
    .eq("model", Number(currentModel))
    .eq("number", Number(number))
    .eq("image_order", 1)
    .maybeSingle()

  if (error) {
    console.log("LOAD FINAL ROUND 4 TEAM MEDIA ERROR:", error)
    showGameToast("تعذر تحميل بيانات الرقم")
    return null
  }

  return data || null
}

function stopFinalRound4ImageTimer() {
  if (finalRound4ImageTimer) {
    clearTimeout(finalRound4ImageTimer)
    finalRound4ImageTimer = null
  }
}

function startFinalRound4ImageTimer() {
  stopFinalRound4ImageTimer()

  const state = finalState.round4.teamMedia

  if (
    !state.currentNumber ||
    state.currentMediaType !== "image" ||
    !state.currentMedia ||
    state.questionShown ||
    state.answerShown
  ) {
    return
  }

  state.imageHidden = false

  openFinalRound4TeamMediaOverlay("image")

  finalRound4ImageTimer = setTimeout(() => {
    state.imageHidden = true
    finalRound4ImageTimer = null

    closeFinalRound4TeamMediaOverlay()

    playGameSound("answer")
    renderFinalRound4TeamMedia()
    saveFinalState()
  }, 30000)
}

function restartFinalRound4TeamMediaImage() {
  const state = finalState.round4.teamMedia

  if (!state.currentNumber || state.currentMediaType !== "image" || !state.currentMedia) {
    showGameToast("لا توجد صورة")
    return
  }

  if (state.questionShown || state.answerShown) {
    showGameToast("الصورة غير متاحة بعد إظهار السؤال")
    return
  }

  pushFinalHistory()

  state.imageHidden = false

  playGameSound("open")
  renderFinalRound4TeamMedia()
  saveFinalState()

  startFinalRound4ImageTimer()
}

function renderFinalRound4TeamMedia() {
  const stage = document.getElementById("finalMainStage")
  const controls = document.getElementById("finalControlsBar")
  if (!stage || !controls) return

  setFinalControlsMode(3)
  ensureFinalRound4State()

  const state = finalState.round4.teamMedia
  const used = state.usedNumbers || []
  const totalNumbers = getFinalRound4Count()

  state.count = totalNumbers

  let grid = ""

  for (let i = 1; i <= totalNumbers; i++) {
  const current = Number(state.currentNumber) === i
  const opened = used.includes(i)
  const locked = !!state.currentNumber && !current
  const disabled = (opened && !current) || locked

  grid += `
    <button
      class="finalRound3Card finalTeamMediaNumberCard ${opened ? "used" : ""} ${current ? "active" : ""} ${locked ? "locked" : ""}"
      ${disabled ? "disabled" : ""}
      onclick="openFinalRound4TeamMediaCard(${i})"
    >
      ${opened && !current ? "" : i}
    </button>
  `
}

  stage.innerHTML = `
    <div class="finalRound3Wrap finalRound4TeamMediaWrap">

      <div class="finalRound3Grid finalTeamMediaNumbersGrid">
        ${grid}
      </div>

      <div class="finalRound3ImageStageWrap finalTeamMediaStageWrap">
        <div class="finalRound3ImageStage finalRound3TeamMediaStage" id="finalRound4TeamMediaStage">
          ${buildFinalRound4TeamMediaContent()}
        </div>
      </div>

    </div>
  `

  const hasCurrent = !!state.currentNumber
  const questionShown = !!state.questionShown
  const answerShown = !!state.answerShown

  const isVideo =
    hasCurrent &&
    state.currentMediaType === "video" &&
    !!state.currentMedia

  const isImage =
    hasCurrent &&
    state.currentMediaType === "image" &&
    !!state.currentMedia

  const canShowQuestion =
    hasCurrent &&
    !!state.currentQuestion &&
    !questionShown &&
    !answerShown

  const canPlayVideo =
    isVideo &&
    !questionShown &&
    !answerShown &&
    !state.videoPlayed

  const canRestartVideo =
    isVideo &&
    !questionShown &&
    !answerShown

  const canRestartImage =
    isImage &&
    !questionShown &&
    !answerShown &&
    !!state.imageHidden

  controls.innerHTML = `
    <button
      onclick="activateFinalDouble()"
      id="finalDoubleBtn"
      class="archiveCtrlBtn finalTeamMediaCtrlBtn finalDoubleBtn"
    >
      دبل
    </button>

    <button
      onclick="showFinalRound4TeamMediaQuestion()"
      class="archiveCtrlBtn finalTeamMediaCtrlBtn btnAnswer"
      ${canShowQuestion ? "" : "disabled"}
    >
      إظهار السؤال
    </button>

    <button
      onclick="playFinalRound4TeamMediaVideo()"
      class="archiveCtrlBtn finalTeamMediaCtrlBtn btnStart"
      ${canPlayVideo ? "" : "disabled"}
    >
      تشغيل الفيديو
    </button>

    <button
      onclick="${isImage ? "restartFinalRound4TeamMediaImage()" : "restartFinalRound4TeamMediaVideo()"}"
      class="archiveCtrlBtn finalTeamMediaCtrlBtn btnStart"
      ${(canRestartVideo || canRestartImage) ? "" : "disabled"}
    >
      إعادة
    </button>

    <button
      onclick="finalRound4TeamMediaCorrect()"
      class="archiveCtrlBtn finalTeamMediaCtrlBtn btnCorrect"
      ${hasCurrent ? "" : "disabled"}
    >
      إجابة صحيحة
    </button>

    <button
      onclick="finalRound4TeamMediaWrong()"
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

function buildFinalRound4TeamMediaContent() {
  const state = finalState.round4.teamMedia

  if (!state.currentNumber) {
    return `
      <div class="finalTeamMediaEmptyState">
        اختر الفريق ثم الرقم
      </div>
    `
  }

  const isVideo = state.currentMediaType === "video" && state.currentMedia
  const isImage = state.currentMediaType === "image" && state.currentMedia
  const hasMedia = !!(isVideo || isImage)

  const showMedia =
    hasMedia &&
    !state.questionShown &&
    !state.answerShown &&
    !state.imageHidden

  const resultClass =
    state.resultType === "correct"
      ? "correctResult"
      : state.resultType === "wrong"
        ? "wrongResult"
        : ""

  let mediaHTML = ""

  if (showMedia) {
    if (isVideo) {
      mediaHTML = `
        <div class="finalTeamMediaFrame finalTeamMediaVideoFrame" onclick="openFinalRound4TeamMediaOverlay('video')">
          <video
            id="finalRound4TeamMediaInlineVideo"
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
            onclick="event.stopPropagation(); playFinalRound4TeamMediaVideo()"
          >
            ▶
          </button>
        </div>
      `
    } else if (isImage) {
      mediaHTML = `
        <div class="finalTeamMediaFrame finalTeamMediaImageFrame" onclick="openFinalRound4TeamMediaOverlay('image')">
          <img src="${escapeDisplayHtml(state.currentMedia)}" class="finalTeamMediaImage" alt="">
        </div>
      `
    }
  }

  if (isImage && state.imageHidden && !state.questionShown && !state.answerShown) {
    mediaHTML = `
      <div class="finalTeamMediaEmptyState">
        انتهى وقت الصورة
      </div>
    `
  }

  const questionHTML =
    state.questionShown && state.currentQuestion
      ? `
        <div class="finalTeamMediaQuestionBox finalTeamMediaQuestionOnly">
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
          <div class="finalRound3TeamMediaAnswer">
            ${escapeDisplayHtml(state.currentAnswer)}
          </div>
        </div>
      `
      : ""

  const hasText = !!(questionHTML || answerHTML)

  const classes = [
    "finalRound3TeamMediaContent",

    showMedia ? "finalFocusHasMedia" : "",
    hasText ? "finalFocusHasText" : "",

    questionHTML ? "finalFocusHasQuestion" : "",
    answerHTML ? "finalFocusHasAnswer" : "",

    /* مهم: نص فقط الحقيقي يكون فقط إذا ما فيه ميديا أصلاً */
    !hasMedia && hasText ? "finalFocusTextOnly" : "",

    /* إذا فيه ميديا لكنها اختفت بعد السؤال/الإجابة */
    hasMedia && hasText && !showMedia ? "finalFocusMediaHiddenText" : ""
  ].filter(Boolean).join(" ")

  return `
    <div class="${classes}">
      ${mediaHTML}

      <div class="finalTeamMediaTextRow">
        ${questionHTML}
        ${answerHTML}
      </div>
    </div>
  `
}

async function openFinalRound4TeamMediaCard(number) {
  ensureFinalRound4State()

  const state = finalState.round4.teamMedia
  const team = finalState.round4.activeTeam

  if (!team) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  if (finalState.round4.lastTeamPlayed === team) {
    showGameToast("لا يمكن نفس الفريق يلعب دورين وراء بعض")
    return
  }

  if (state.currentNumber) {
    showGameToast("أنه الرقم الحالي أولاً")
    return
  }

  const maxPerTeam = getFinalRound4MaxPerTeam()

  if (state.teamNumbers[team].length >= maxPerTeam) {
    showGameToast(`هذا الفريق أخذ ${maxPerTeam} أرقام`)
    return
  }

  if (state.usedNumbers.includes(number)) return

  const item = await loadFinalRound4TeamMediaItem(number)

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
  state.imageHidden = false

  stopFinalRound4ImageTimer()

  if (video) {
    state.currentMediaType = "video"
    state.currentMedia = video
  } else {
    state.currentMediaType = "image"
    state.currentMedia = image
  }

  state.usedNumbers.push(number)
  state.teamNumbers[team].push(number)

  finalState.round4.currentNumber = number
  finalState.round4.pendingScore = true
  finalState.round4.activeTeam = team

  if (!finalState.round4.opened.includes(number)) {
    finalState.round4.opened.push(number)
  }

  playGameSound("open")
  renderFinalRound4TeamMedia()
  saveFinalState()
  updateEndRoundButtonState()

  if (state.currentMediaType === "image") {
    startFinalRound4ImageTimer()
  }
}

function showFinalRound4TeamMediaQuestion() {
  const state = finalState.round4.teamMedia

  if (!state.currentNumber) {
    showGameToast("افتح رقم أولاً")
    return
  }

  if (!state.currentQuestion) {
    showGameToast("لا يوجد سؤال لهذا الرقم")
    return
  }

  pushFinalHistory()
  stopFinalRound4ImageTimer()

  state.questionShown = true
  state.answerShown = false
  state.resultType = ""

  closeFinalRound4TeamMediaOverlay()

  playGameSound("answer")
  renderFinalRound4TeamMedia()
  saveFinalState()
}

function finalRound4TeamMediaCorrect() {
  const state = finalState.round4.teamMedia
  const team = state.currentTeam || finalState.round4.activeTeam
  const number = state.currentNumber

  if (!number) {
    showGameToast("افتح رقم أولاً")
    return
  }

  if (!team) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  if (finalState.round4.scoredNumbers.includes(number)) {
    showGameToast("تم تسجيل هذا الرقم مسبقاً")
    return
  }

  if (state.answerShown) {
    showGameToast("تم تسجيل الإجابة")
    return
  }

  pushFinalHistory()

  stopFinalRound4ImageTimer()
  closeFinalRound4TeamMediaOverlay()

  state.currentTeam = team
  state.answerShown = true
  state.resultType = "correct"

  finalState.round4.scores[team] += getFinalScoreValue(team, 1)
  finalState.round4.scoredNumbers.push(number)
  finalState.round4.lastTeamPlayed = team

  clearFinalActiveDouble()

  playGameSound("correct")
  flashScreen("correct")

  renderFinalScores()
  renderFinalRound4TeamMedia()
  saveFinalState()

  setTimeout(() => {
    resetFinalRound4TeamMediaCurrent(getOtherTeam(team))
  }, 5000)
}

function finalRound4TeamMediaWrong() {
  const state = finalState.round4.teamMedia
  const team = state.currentTeam || finalState.round4.activeTeam
  const number = state.currentNumber

  if (!number) {
    showGameToast("افتح رقم أولاً")
    return
  }

  if (!team) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  if (finalState.round4.scoredNumbers.includes(number)) {
    showGameToast("تم تسجيل هذا الرقم مسبقاً")
    return
  }

  pushFinalHistory()

  stopFinalRound4ImageTimer()
  closeFinalRound4TeamMediaOverlay()

  state.currentTeam = team
  state.answerShown = true
  state.questionShown = false
  state.resultType = "wrong"

  finalState.round4.scoredNumbers.push(number)
  finalState.round4.lastTeamPlayed = team

  clearFinalActiveDouble()

  playGameSound("wrong")
  flashScreen("wrong")

  renderFinalRound4TeamMedia()
  saveFinalState()

  setTimeout(() => {
    resetFinalRound4TeamMediaCurrent(getOtherTeam(team))
  }, 5000)
}

function resetFinalRound4TeamMediaCurrent(nextTeam = null) {
  stopFinalRound4ImageTimer()

  const state = finalState.round4.teamMedia

  state.currentNumber = null
  state.currentTeam = null
  state.currentMediaType = ""
  state.currentMedia = ""
  state.currentQuestion = ""
  state.currentAnswer = ""
  state.answerShown = false
  state.questionShown = false
  state.videoPlayed = false
  state.imageHidden = false
  state.resultType = ""

  finalState.round4.currentNumber = null
  finalState.round4.pendingScore = false

  if (nextTeam === "A" || nextTeam === "B") {
    finalState.round4.activeTeam = nextTeam
    highlightFinalTeam(nextTeam)
  }

  renderFinalRound4TeamMedia()
  renderFinalRoundTitle()
  renderFinalTurnBar()
  updateEndRoundButtonState()
  saveFinalState()
}

function openFinalRound4TeamMediaOverlay(type) {
  const state = finalState.round4.teamMedia

  if (!state.currentMedia) return

  let overlay = document.getElementById("finalRound4TeamMediaOverlay")

  if (!overlay) {
    overlay = document.createElement("div")
    overlay.id = "finalRound4TeamMediaOverlay"
    overlay.className = "finalRound3TeamMediaOverlay finalRound4TeamMediaOverlay"
    document.body.appendChild(overlay)
  }

  overlay.onclick = function () {
    closeFinalRound4TeamMediaOverlay()
  }

  overlay.classList.remove("hidden", "imageMode", "videoMode")
  overlay.classList.add(type === "video" ? "videoMode" : "imageMode")

  if (type === "video") {
    overlay.innerHTML = `
      <button
        class="finalRound3TeamMediaCloseBtn"
        onclick="event.stopPropagation(); closeFinalRound4TeamMediaOverlay()"
      >
        ×
      </button>

      <div class="finalRound3TeamMediaOverlayInner" onclick="event.stopPropagation()">
        <video
          id="finalRound4TeamMediaOverlayVideo"
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
        onclick="event.stopPropagation(); closeFinalRound4TeamMediaOverlay()"
      >
        ×
      </button>

      <div class="finalRound3TeamMediaOverlayInner" onclick="event.stopPropagation()">
        <img src="${escapeDisplayHtml(state.currentMedia)}" class="finalRound3TeamMediaOverlayImage" alt="">
      </div>
    `
  }
}

function closeFinalRound4TeamMediaOverlay() {
  const overlay = document.getElementById("finalRound4TeamMediaOverlay")
  if (!overlay) return

  const overlayVideo = document.getElementById("finalRound4TeamMediaOverlayVideo")
  if (overlayVideo) {
    overlayVideo.pause()
    overlayVideo.currentTime = 0
    overlayVideo.src = ""
    overlayVideo.load()
  }

  const inlineVideo = document.getElementById("finalRound4TeamMediaInlineVideo")
  if (inlineVideo) {
    inlineVideo.pause()
  }

  overlay.classList.add("hidden")
  overlay.classList.remove("imageMode", "videoMode")
  overlay.innerHTML = ""
}

function playFinalRound4TeamMediaVideo() {
  const state = finalState.round4.teamMedia

  if (!state.currentNumber || state.currentMediaType !== "video" || !state.currentMedia) {
    showGameToast("لا يوجد فيديو")
    return
  }

  if (state.questionShown || state.answerShown) {
    showGameToast("الفيديو غير متاح بعد إظهار السؤال")
    return
  }

  openFinalRound4TeamMediaOverlay("video")

  setTimeout(() => {
    const video = document.getElementById("finalRound4TeamMediaOverlayVideo")
    if (!video) return

    video.loop = false
    video.controls = true
    video.muted = false
    video.volume = 1

    state.videoPlayed = true

    video.onended = function () {
      closeFinalRound4TeamMediaOverlay()
      saveFinalState()
    }

    const playPromise = video.play()

    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(err => {
        console.log("FINAL ROUND 4 VIDEO PLAY ERROR:", err)
        showGameToast("اضغط تشغيل مرة أخرى")
      })
    }

    saveFinalState()
  }, 120)
}

function restartFinalRound4TeamMediaVideo() {
  const state = finalState.round4.teamMedia

  if (!state.currentNumber || state.currentMediaType !== "video" || !state.currentMedia) {
    showGameToast("لا يوجد فيديو")
    return
  }

  if (state.questionShown || state.answerShown) {
    showGameToast("الفيديو غير متاح بعد إظهار السؤال")
    return
  }

  openFinalRound4TeamMediaOverlay("video")

  setTimeout(() => {
    const video = document.getElementById("finalRound4TeamMediaOverlayVideo")
    if (!video) return

    video.pause()
    video.currentTime = 0
    video.loop = false
    video.controls = true
    video.muted = false
    video.volume = 1

    state.videoPlayed = true

    video.onended = function () {
      closeFinalRound4TeamMediaOverlay()
      saveFinalState()
    }

    const playPromise = video.play()

    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(err => {
        console.log("FINAL ROUND 4 VIDEO RESTART ERROR:", err)
        showGameToast("اضغط إعادة تشغيل مرة أخرى")
      })
    }

    saveFinalState()
  }, 120)
}
/* =========================
   15) PRESENTER VIDEO COMMANDS
========================= */

function getCurrentFinalVideoElement() {
  return (
    document.getElementById("finalRound4TeamMediaOverlayVideo") ||
    document.getElementById("finalRound4TeamMediaInlineVideo") ||
    document.querySelector(".finalRound4TeamMediaOverlay video") ||
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
  const state = finalState.round4?.teamMedia

  if (
    finalState.round !== 4 ||
    finalState.round4.mode !== "team_media" ||
    !state?.currentNumber ||
    state.currentMediaType !== "video"
  ) {
    showGameToast("لا يوجد فيديو حالي")
    return
  }

  playFinalRound4TeamMediaVideo()
}

function restartCurrentFinalVideo() {
  const state = finalState.round4?.teamMedia

  if (
    finalState.round !== 4 ||
    finalState.round4.mode !== "team_media" ||
    !state?.currentNumber ||
    state.currentMediaType !== "video"
  ) {
    showGameToast("لا يوجد فيديو حالي")
    return
  }

  restartFinalRound4TeamMediaVideo()
}

function stopCurrentFinalVideo() {
  const overlayVideo = document.getElementById("finalRound4TeamMediaOverlayVideo")
  const inlineVideo = document.getElementById("finalRound4TeamMediaInlineVideo")

  ;[overlayVideo, inlineVideo].forEach(video => {
    if (!video) return

    try {
      video.pause()
      video.currentTime = 0
    } catch (e) {
      console.log("STOP FINAL VIDEO ERROR:", e)
    }
  })

  if (typeof closeFinalRound4TeamMediaOverlay === "function") {
    closeFinalRound4TeamMediaOverlay()
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
window.selectFinalTeam = selectFinalTeam
window.activateFinalDouble = activateFinalDouble
window.undoFinalAction = undoFinalAction

window.openFinalRound1Card = openFinalRound1Card
window.finalRound1Correct = finalRound1Correct
window.finalRound1Wrong = finalRound1Wrong
window.showFinalRound1Answer = showFinalRound1Answer
window.showFinalRound1Question = showFinalRound1Question
window.toggleFinalRound1Overlay = toggleFinalRound1Overlay
window.toggleFinalRound1ImageOverlay = toggleFinalRound1ImageOverlay

window.openFinalRound2Card = openFinalRound2Card
window.finalRound2DecreaseCountdown = finalRound2DecreaseCountdown
window.finalRound2ShowNextImage = finalRound2ShowNextImage
window.finalRound2RecordScore = finalRound2RecordScore
window.finalRound2RecordSequenceScore = finalRound2RecordSequenceScore
window.finalRound2RecordImageScore = finalRound2RecordImageScore
window.finalRound2RecordWrong = finalRound2RecordWrong
window.toggleFinalRound2CorrectSelection = toggleFinalRound2CorrectSelection
window.toggleFinalRound2ImageCorrectSelection = toggleFinalRound2ImageCorrectSelection
window.hideFinalRound2SequenceWord = hideFinalRound2SequenceWord
window.toggleFinalRound2ImageOverlay = toggleFinalRound2ImageOverlay

window.openFinalRound3StoryCard = openFinalRound3StoryCard
window.showFinalRound3StoryPart = showFinalRound3StoryPart
window.finalRound3StoryCorrect = finalRound3StoryCorrect
window.finalRound3StoryWrong = finalRound3StoryWrong

window.openFinalRound4TeamMediaCard = openFinalRound4TeamMediaCard
window.showFinalRound4TeamMediaQuestion = showFinalRound4TeamMediaQuestion
window.playFinalRound4TeamMediaVideo = playFinalRound4TeamMediaVideo
window.restartFinalRound4TeamMediaVideo = restartFinalRound4TeamMediaVideo
window.restartFinalRound4TeamMediaImage = restartFinalRound4TeamMediaImage
window.finalRound4TeamMediaCorrect = finalRound4TeamMediaCorrect
window.finalRound4TeamMediaWrong = finalRound4TeamMediaWrong
window.openFinalRound4TeamMediaOverlay = openFinalRound4TeamMediaOverlay
window.closeFinalRound4TeamMediaOverlay = closeFinalRound4TeamMediaOverlay

window.playCurrentFinalVideo = playCurrentFinalVideo
window.restartCurrentFinalVideo = restartCurrentFinalVideo
window.stopCurrentFinalVideo = stopCurrentFinalVideo
window.finalWrongVideoOnly = finalWrongVideoOnly