/* =========================
   FINAL - CLEAN VERSION
   الفاصلة - JS كامل بعد التعديلات
========================= */

let finalState = createDefaultFinalState()

window.finalState = finalState
window.finalOpenedNumbers = []

const FINAL_STORAGE_KEY = "final_state_v3"
const FINAL_HISTORY_LIMIT = 60

let currentFinalRound1Image = ""
let currentFinalRound3Image = ""
let finalHistory = []

/* =========================
   Default State
========================= */

function createDefaultFinalState() {
  return {
    round: 1,

    doubleState: {
      used: { A: false, B: false },
      activeTeam: null
    },

    round1: {
      title: "الجولة الأولى",
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
      title: "الجولة الثانية",
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
      title: "الجولة الثالثة",
      mode: "classic",

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
      selectedCorrectIndexes: [],

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
    }
  }
}

/* =========================
   Persistence
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

  localStorage.setItem(FINAL_STORAGE_KEY, JSON.stringify(safe))
  localStorage.setItem("active_segment", "final")

  syncFinalGlobals()

  if (typeof syncDisplayStateToSession === "function") {
    syncDisplayStateToSession()
  }
}

function restoreFinalState(saved) {
  if (!saved) return

  finalState = saved
  ensureFinalStateShape()

  finalState.round2.revealTimer = null
  finalState.round3.sequenceTimer = null

  window.finalState = finalState
  syncFinalGlobals()
}

/* =========================
   Ensure State
========================= */

function ensureFinalStateShape() {
  if (!finalState) finalState = createDefaultFinalState()

  if (!finalState.round1) finalState.round1 = createDefaultFinalState().round1
  if (!finalState.round2) finalState.round2 = createDefaultFinalState().round2
  if (!finalState.round3) finalState.round3 = createDefaultFinalState().round3

  ensureFinalDoubleState()
  ensureFinalRound1State()
  ensureFinalRound2State()
  ensureFinalRound3State()
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

  r.title = r.title || d.title
  r.mode = r.mode === "team_media" ? "team_media" : "classic"

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

  if (!r.teamMedia) {
    r.teamMedia = {
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
  }

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

/* =========================
   Undo
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
   Helpers
========================= */

function getFinalCurrentRoundState() {
  if (finalState.round === 1) return finalState.round1
  if (finalState.round === 2) return finalState.round2
  if (finalState.round === 3) return finalState.round3
  return null
}

function getOtherTeam(team) {
  return team === "A" ? "B" : "A"
}

/* =========================
   Final Auto Team Turn
   Round 2 / Round 3 فقط
========================= */

function getFinalAutoTeam(round) {
  if (round !== 2 && round !== 3) return null

  const state = round === 2
    ? finalState.round2
    : finalState.round3

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

  highlightFinalTeam(team)
  renderFinalRoundTitle()
  saveFinalState()

  return team
}

function moveFinalTurnToNextTeam(round, currentTeam = null) {
  if (round !== 2 && round !== 3) return

  const team =
    currentTeam ||
    (
      round === 2
        ? finalState.round2.lastTeamPlayed || finalState.round2.activeTeam
        : finalState.round3.lastTeamPlayed || finalState.round3.activeTeam
    ) ||
    "A"

  const nextTeam = getOtherTeam(team)

  if (round === 2) {
    finalState.round2.activeTeam = nextTeam
  }

  if (round === 3) {
    finalState.round3.activeTeam = nextTeam

    if (finalState.round3.teamMedia) {
      finalState.round3.teamMedia.currentTeam = null
    }
  }

  highlightFinalTeam(nextTeam)
  renderFinalRoundTitle()
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
}

function syncFinalGlobals() {
  const totalA =
    Number(finalState.round1?.scores?.A || 0) +
    Number(finalState.round2?.scores?.A || 0) +
    Number(finalState.round3?.scores?.A || 0)

  const totalB =
    Number(finalState.round1?.scores?.B || 0) +
    Number(finalState.round2?.scores?.B || 0) +
    Number(finalState.round3?.scores?.B || 0)

  window.currentSegmentScores = { A: totalA, B: totalB }

  window.finalOpenedNumbers = [
    ...(finalState.round1?.opened || []).map(x => `r1-${x}`),
    ...(finalState.round2?.opened || []).map(x => `r2-${x}`),
    ...(finalState.round3?.opened || []).map(x => `r3-${x}`)
  ]

  window.finalState = finalState
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
   Double
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
   Init / Render
========================= */

window.renderFinal = async function () {
  const saved = getFinalState()
  finalHistory = []

  clearFinalIntervals()

  if (saved) {
    restoreFinalState(saved)
  } else {
    finalState = createDefaultFinalState()
    window.finalState = finalState
    syncFinalGlobals()
  }

  await loadFinalRoundMeta()
  await loadFinalRound1CardTexts()

  openSegment("صح صحلي", buildFinalHTML())
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
      finalState.round1.title = row.title || "الجولة الأولى"
      finalState.round1.cardsCount = Number(row.cards_count || 6)
    }

    if (row.round === 2) {
      finalState.round2.title = row.title || "الجولة الثانية"
    }

    if (row.round === 3) {
      finalState.round3.title = row.title || "الجولة الثالثة"

      const mode =
        row.mode ||
        row.round3_mode ||
        row.display_mode ||
        row.type ||
        "classic"

      finalState.round3.mode = mode === "team_media" ? "team_media" : "classic"
    }
  })

  ensureFinalStateShape()
}

async function loadFinalRound1CardTexts() {
  const { data, error } = await db
    .from("final_round1_items")
    .select("number, card_text, question_part1, question_part2, question_part3")
    .eq("model", Number(currentModel))
    .in("number", [1, 2, 3, 4, 5, 6])

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

      <div class="finalHeaderQuestionRow">
        <div class="finalMiniTabs">
          <button id="finalRoundTab1" onclick="goToFinalRound(1)">1</button>
          <button id="finalRoundTab2" onclick="goToFinalRound(2)">2</button>
          <button id="finalRoundTab3" onclick="goToFinalRound(3)">3</button>
        </div>

        <div class="finalMiniTitle" id="finalRoundTitleBar"></div>
      </div>

      <div class="finalScoreBoards" id="finalScoreBoards">

        <div class="finalScorePanel finalScorePanelLeft" id="finalTeamABox" onclick="selectFinalTeam('A')">
          <div class="finalScoreTeamNameBox finalScoreTeamNameFix">${teamAName}</div>
          <div class="finalScoreErrorsBox" id="finalErrorsA"></div>
          <div class="finalScoreValueBox" id="finalScoreA">0</div>
        </div>

        <div class="finalScoreCenterPanel">
          <div class="finalScoreCenterTop" id="finalRoundCenterTop"></div>
          <div class="finalScoreCenterValue" id="finalRoundCenterNum">1</div>
          <div class="finalScoreCenterBottom" id="finalRoundCenterBottom"></div>
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
  renderFinalTeamLayout()

  if (finalState.round === 1) renderFinalRound1()
  if (finalState.round === 2) renderFinalRound2()
  if (finalState.round === 3) renderFinalRound3()

  updateFinalDoubleButton()
  syncFinalGlobals()
  saveFinalState()
  updateFinalUndoButtonState()
}

function renderFinalTabs() {
  for (const n of [1, 2, 3]) {
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

  let title = ""
  if (finalState.round === 1) title = finalState.round1.title
  if (finalState.round === 2) title = finalState.round2.title
  if (finalState.round === 3) title = finalState.round3.title

  if (titleBox) titleBox.innerText = title

  if (boards) {
    boards.classList.remove("finalBoardRound1", "finalBoardRoundOther", "finalRound1Mode")

    if (finalState.round === 1) {
      boards.classList.add("finalBoardRound1", "finalRound1Mode")
    } else {
      boards.classList.add("finalBoardRoundOther")
    }
  }

  if (finalState.round === 1) {
    if (centerTop) centerTop.innerText = "الجولة 1"
    if (centerNum) centerNum.innerText = "0"
    if (centerBottom) {
      centerBottom.innerText = finalState.round1.activeTeam
        ? "الدور: فريق مختار"
        : "الدور: اختر فريق"
    }
    return
  }

  if (finalState.round === 2) {
    if (finalState.round2.currentType === "sequence") {
      if (centerTop) centerTop.innerText = "المتبقي"
      if (centerNum) centerNum.innerText = String(finalState.round2.countdown ?? 15)
      if (centerBottom) centerBottom.innerText = "الجولة 2"
    } else {
      if (centerTop) centerTop.innerText = "الصح"
      if (centerNum) centerNum.innerText = `${finalState.round2.correctCount} / 6`
      if (centerBottom) centerBottom.innerText = "الجولة 2"
    }
    return
  }

  if (finalState.round === 3) {
    if (finalState.round3.mode === "team_media") {
      const used = finalState.round3.teamMedia.usedNumbers.length
      if (centerTop) centerTop.innerText = "المفتوح"
      if (centerNum) centerNum.innerText = `${used} / 4`
      if (centerBottom) centerBottom.innerText = "الجولة 3"
      return
    }

    const totalImages = finalState.round3.images.length || 5

    if (centerTop) centerTop.innerText = "الصح"
    if (centerNum) centerNum.innerText = `${finalState.round3.correctCount} / ${totalImages}`
    if (centerBottom) centerBottom.innerText = "الجولة 3"
  }
}

function renderFinalScores() {
  const a = document.getElementById("finalScoreA")
  const b = document.getElementById("finalScoreB")

  const totalA =
    Number(finalState.round1.scores.A || 0) +
    Number(finalState.round2.scores.A || 0) +
    Number(finalState.round3.scores.A || 0)

  const totalB =
    Number(finalState.round1.scores.B || 0) +
    Number(finalState.round2.scores.B || 0) +
    Number(finalState.round3.scores.B || 0)

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

  if (finalState.round === 1) wrap.classList.add("finalTeamsRound1")
  else wrap.classList.add("finalTeamsRoundOther")
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

  const current = getFinalCurrentRoundState()

  highlightFinalTeam(current?.activeTeam || null)
  renderFinalRoundTitle()
  updateFinalDoubleButton()
  saveFinalState()
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
    if (finalState.round3.mode === "team_media") {
      return finalState.round3.teamMedia.usedNumbers.length >= 4 &&
        finalState.round3.scoredNumbers.length >= 4
    }

    return finalState.round3.opened.length >= 2 &&
      finalState.round3.scoredNumbers.length >= 2
  }

  return false
}

function goToFinalRound(round) {
  if (round === finalState.round) return

  if (round > finalState.round && !isFinalRoundFinished(finalState.round)) {
    showGameToast("أنهِ الجولة الحالية أولاً")
    return
  }

  pushFinalHistory()

  finalState.round = round
  resetFinalTeamSelection()

  renderFinalRound()
  updateEndRoundButtonState()
}

/* =========================
   Round 1
========================= */

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
  const isQuestionCard = currentNumber >= 4 && currentNumber <= 6

  controls.innerHTML = `
    <button onclick="activateFinalDouble()" id="finalDoubleBtn" class="archiveCtrlBtn finalDoubleBtn">دبل</button>
    <button onclick="showFinalRound1Question()" class="archiveCtrlBtn btnStart" ${isQuestionCard ? "" : "disabled"}>إظهار السؤال</button>
    <button onclick="finalRound1Correct()" class="archiveCtrlBtn btnCorrect">إجابة صحيحة</button>
    <button onclick="finalRound1Wrong()" class="archiveCtrlBtn btnWrong">خطأ</button>
    <button onclick="undoFinalAction()" class="archiveCtrlBtn undoBtn finalUndoBtn">تراجع</button>
    <button onclick="goToFinalRound(2)" class="archiveCtrlBtn roundNavBtn">الجولة التالية</button>
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
    .single()

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
  const isHistoricalTextCard = number >= 1 && number <= 3 && !!fullCardText
  const isQuestionCard = number >= 4 && number <= 6

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
        <div class="finalRound1ResultText ${number >= 4 && number <= 6 ? "finalRound1AnswerProjectFont" : "finalRound1AnswerMolhimFont"}">
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

  if (number < 4 || number > 6) {
    showGameToast("إظهار السؤال متاح فقط للأرقام 4 و5 و6")
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
   Round 2
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
    <button onclick="goToFinalRound(3)" class="archiveCtrlBtn roundNavBtn">الجولة التالية</button>
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
                <div class="finalRound2AnswerScrambled">${word}</div>
                <div class="finalRound2AnswerCorrect">${finalState.round2.answers[idx] || "-"}</div>
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
        <div class="finalHintText">${finalState.round2.hints[idx] || "بدون تلميحة"}</div>
        <div class="finalWordChipLarge">${finalState.round2.scrambledWords[idx]}</div>
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
            ${word}
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
   Round 3 Switch
========================= */

function renderFinalRound3() {
  ensureFinalRound3State()

  if (finalState.round3.mode === "team_media") {
    renderFinalRound3TeamMedia()
    return
  }

  renderFinalRound3Classic()
}

/* =========================
   Round 3 - Classic
========================= */

function renderFinalRound3Classic() {
  const stage = document.getElementById("finalMainStage")
  const controls = document.getElementById("finalControlsBar")
  if (!stage || !controls) return

  setFinalControlsMode(3)

  let grid = ""

  for (let i = 1; i <= 2; i++) {
    const opened = finalState.round3.opened.includes(i)

    grid += `
      <button
        class="finalRound3Card ${opened ? "used" : ""}"
        ${opened ? "disabled" : ""}
        onclick="openFinalRound3Card(${i})"
      >
        ${i}
      </button>
    `
  }

  stage.innerHTML = `
    <div class="finalRound3Wrap">
      <div class="finalRound3Grid">${grid}</div>

      <div class="finalRound3ImageStageWrap">
        <div class="finalRound3ImageStage" id="finalRound3ImageStage">
          <div class="finalRoundPlaceholder">اختر الفريق ثم الرقم</div>
        </div>
      </div>
    </div>
  `

  controls.innerHTML = `
    <button onclick="activateFinalDouble()" id="finalDoubleBtn" class="archiveCtrlBtn finalDoubleBtn">دبل</button>
    <button onclick="finalRound3RecordScore()" class="archiveCtrlBtn btnCorrect">تسجيل النتيجة</button>
    <button onclick="startFinalRound3Sequence()" class="archiveCtrlBtn btnStart">بدء عرض الصور</button>
    <button onclick="undoFinalAction()" class="archiveCtrlBtn undoBtn finalUndoBtn">تراجع</button>
  `

  updateFinalDoubleButton()

  if (finalState.round3.pendingScore && finalState.round3.answersAllowed) {
    showFinalRound3Answer()
  }
}

async function openFinalRound3Card(number) {
  if (finalState.round3.pendingScore) {
    showGameToast("سجل النتيجة أولاً")
    return
  }

  const team = setFinalAutoTeam(3)

  if (finalState.round3.opened.includes(number)) return



  if (Object.values(finalState.round3.assignedTeams).includes(team)) {
    showGameToast("كل فريق له رقم واحد فقط")
    return
  }

  pushFinalHistory()

  clearInterval(finalState.round3.sequenceTimer)

  finalState.round3.sequenceTimer = null
  finalState.round3.currentNumber = number
  finalState.round3.opened.push(number)
  finalState.round3.pendingScore = true
  finalState.round3.correctCount = 0
  finalState.round3.answersAllowed = false
  finalState.round3.selectedCorrectIndexes = []
  finalState.round3.assignedTeams[number] = team
  currentFinalRound3Image = ""

  const { data, error } = await db
    .from("final_round3_items")
    .select("*")
    .eq("model", Number(currentModel))
    .eq("number", Number(number))
    .order("image_order", { ascending: true })

  if (error) {
    console.log(error)
    return
  }

  const rows = data || []

  finalState.round3.images = rows.map(x => x.image || "")
  finalState.round3.answers = rows.map(x => x.answer || "")
  finalState.round3.notes = rows.map(x => x.note || "")
  finalState.round3.shownCount = 0

  renderFinalRoundTitle()
  renderFinalRound3()
  saveFinalState()
  updateEndRoundButtonState()
}

function startFinalRound3Sequence() {
  if (!finalState.round3.pendingScore || finalState.round3.currentNumber === null) {
    showGameToast("اختر الفريق ثم الرقم أولاً")
    return
  }

  clearInterval(finalState.round3.sequenceTimer)

  const stage = document.getElementById("finalRound3ImageStage")
  if (!stage) return

  if (!finalState.round3.images.length) {
    showGameToast("لا توجد صور")
    return
  }

  let idx = 0

  const showImage = () => {
    if (idx < finalState.round3.images.length) {
      currentFinalRound3Image = finalState.round3.images[idx] || ""

      stage.innerHTML = `
        <div class="finalRound3ImageFrame finalRound1RevealCard" onclick="toggleFinalRound3ImageOverlay()">
          <img src="${currentFinalRound3Image}" class="finalRound3Image" alt="">
        </div>
      `

      const overlayImg = document.getElementById("finalRound3ImageOverlayImg")
      if (overlayImg) overlayImg.src = currentFinalRound3Image

      finalState.round3.shownCount = idx + 1
      idx++
      saveFinalState()
      return
    }

    currentFinalRound3Image = ""

    const overlay = document.getElementById("finalRound3ImageOverlay")
    if (overlay) overlay.remove()

    finalState.round3.answersAllowed = true

    clearInterval(finalState.round3.sequenceTimer)
    finalState.round3.sequenceTimer = null

    showFinalRound3Answer()
    saveFinalState()
  }

  showImage()
  finalState.round3.sequenceTimer = setInterval(showImage, 10000)
}

function showFinalRound3Answer() {
  if (!finalState.round3.pendingScore || finalState.round3.currentNumber === null) {
    showGameToast("اختر الفريق ثم الرقم أولاً")
    return
  }

  if (!finalState.round3.answersAllowed) {
    showGameToast("اعرض جميع الصور أولاً")
    return
  }

  currentFinalRound3Image = ""

  const stage = document.getElementById("finalRound3ImageStage")
  if (!stage) return

  stage.innerHTML = `
    <div class="finalRound3ResultView">
      <div class="finalRound3ResultHeader">
        <div class="finalRound3ResultTitle">اختيار الإجابات الصحيحة</div>
        <div class="finalRound3ResultCounter">${finalState.round3.correctCount} / ${finalState.round3.answers.length || 5}</div>
      </div>

      <div class="finalRound3AnswersList finalRound3AnswersPremium">
        ${finalState.round3.answers.map((answer, idx) => {
          const selected = finalState.round3.selectedCorrectIndexes.includes(idx)

          return `
            <button
              class="finalRound3AnswerCard ${selected ? "selectedCorrect" : ""}"
              onclick="toggleFinalRound3CorrectSelection(${idx})"
            >
              <div class="finalAnswerChip">${answer || "-"}</div>
              ${finalState.round3.notes[idx] ? `<div class="finalNoteBox">${finalState.round3.notes[idx]}</div>` : ""}
            </button>
          `
        }).join("")}
      </div>
    </div>
  `

  saveFinalState()
}

function toggleFinalRound3CorrectSelection(index) {
  if (!finalState.round3.pendingScore) return
  if (index < 0) return

  pushFinalHistory()

  const arr = finalState.round3.selectedCorrectIndexes
  const exists = arr.includes(index)

  finalState.round3.selectedCorrectIndexes = exists
    ? arr.filter(x => x !== index)
    : [...arr, index]

  finalState.round3.correctCount = finalState.round3.selectedCorrectIndexes.length

  renderFinalRoundTitle()

  if (finalState.round3.answersAllowed) {
    showFinalRound3Answer()
  }

  saveFinalState()
}

function finalRound3RecordScore() {
  const team = finalState.round3.activeTeam

  if (!finalState.round3.pendingScore || finalState.round3.currentNumber === null) {
    showGameToast("اختر الفريق ثم الرقم أولاً")
    return
  }

  if (!team) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  pushFinalHistory()

  finalState.round3.correctCount = finalState.round3.selectedCorrectIndexes.length
  finalState.round3.scores[team] += getFinalScoreValue(team, finalState.round3.correctCount)
  finalState.round3.lastTeamPlayed = team

  clearFinalActiveDouble()

  renderFinalScores()
  playGameSound("correct")
  flashScreen("correct")

  finalizeRound3Number(getOtherTeam(team))
}

function finalizeRound3Number(nextTeam = null) {
  if (finalState.round3.currentNumber !== null) {
    if (!finalState.round3.scoredNumbers.includes(finalState.round3.currentNumber)) {
      finalState.round3.scoredNumbers.push(finalState.round3.currentNumber)
    }
  }

  clearInterval(finalState.round3.sequenceTimer)

  finalState.round3.sequenceTimer = null
  finalState.round3.pendingScore = false
  finalState.round3.currentNumber = null
  finalState.round3.images = []
  finalState.round3.answers = []
  finalState.round3.notes = []
  finalState.round3.shownCount = 0
  finalState.round3.correctCount = 0
  finalState.round3.answersAllowed = false
  finalState.round3.selectedCorrectIndexes = []
  currentFinalRound3Image = ""

  const autoNextTeam =
  nextTeam ||
  getOtherTeam(finalState.round3.lastTeamPlayed || finalState.round3.activeTeam || "A")

finalState.round3.activeTeam = autoNextTeam

renderFinalRound()
highlightFinalTeam(autoNextTeam)

saveFinalState()
updateEndRoundButtonState()
}

function toggleFinalRound3ImageOverlay() {
  const oldOverlay = document.getElementById("finalRound3ImageOverlay")

  if (oldOverlay) {
    oldOverlay.remove()
    return
  }

  if (!currentFinalRound3Image) return

  const overlay = document.createElement("div")
  overlay.id = "finalRound3ImageOverlay"
  overlay.className = "finalRound3ImageOverlay"
  overlay.innerHTML = `
    <div class="finalRound3ImageOverlayInner">
      <img id="finalRound3ImageOverlayImg" src="${currentFinalRound3Image}" class="finalRound3ImageOverlayImg" alt="">
    </div>
  `

  overlay.onclick = function () {
    overlay.remove()
  }

  document.body.appendChild(overlay)
}

/* =========================
   Round 3 - Team Media
   نسخة مرتبة + عرض فيديو مضبوط
========================= */

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

function renderFinalRound3TeamMedia() {
  const stage = document.getElementById("finalMainStage")
  const controls = document.getElementById("finalControlsBar")
  if (!stage || !controls) return

  setFinalControlsMode(3)
  ensureFinalRound3State()

  const state = finalState.round3.teamMedia
  const used = state.usedNumbers || []

  let grid = ""

  for (let i = 1; i <= 4; i++) {
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
              src="${state.currentMedia}"
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
            <img src="${state.currentMedia}" class="finalTeamMediaImage" alt="">
          </div>
        `
      : ""

  const questionHTML =
    state.questionShown && state.currentQuestion
      ? `
        <div class="finalTeamMediaQuestionBox finalTeamMediaQuestionOnly">
          <div class="finalTeamMediaSmallLabel">السؤال</div>
          <div class="finalTeamMediaQuestionText">
            ${state.currentQuestion}
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
            ${state.currentAnswer}
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

  

  if (state.teamNumbers[team].length >= 2) {
    showGameToast("هذا الفريق أخذ رقمين")
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
  src="${state.currentMedia}"
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
        <img src="${state.currentMedia}" class="finalRound3TeamMediaOverlayImage" alt="">
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

/* =========================================================
   FINAL - PRESENTER VIDEO COMMANDS
   أوامر الفيديو القادمة من صفحة المقدم
========================================================= */

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