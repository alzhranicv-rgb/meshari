let finalState = {
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

window.finalState = finalState
window.finalOpenedNumbers = []

const FINAL_STORAGE_KEY = "final_state_v3"

let currentFinalRound3Image = ""

let finalHistory = []
const FINAL_HISTORY_LIMIT = 60

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
  ensureFinalDoubleState()

  const safe = JSON.parse(JSON.stringify(finalState))
  safe.round2.revealTimer = null
  safe.round3.sequenceTimer = null

  localStorage.setItem(FINAL_STORAGE_KEY, JSON.stringify(safe))
  localStorage.setItem("active_segment", "final")
  syncFinalGlobals()
}

function clearFinalState() {
  localStorage.removeItem(FINAL_STORAGE_KEY)
  localStorage.removeItem("active_segment")
}

function restoreFinalState(saved) {
  if (!saved) return

  finalState = saved

  ensureFinalDoubleState()

  finalState.round2.revealTimer = null
  finalState.round3.sequenceTimer = null

  if (!finalState.round1.cardTexts) {
    finalState.round1.cardTexts = {}
  }

  if (!finalState.round1.currentQuestionParts) {
    finalState.round1.currentQuestionParts = []
  }

  if (typeof finalState.round1.shownQuestionPartsCount !== "number") {
    finalState.round1.shownQuestionPartsCount = 0
  }

  window.finalState = finalState
  syncFinalGlobals()
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
  ensureFinalDoubleState()

  window.finalState = finalState
  currentFinalRound3Image = snapshot.currentFinalRound3Image || ""

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

function ensureFinalDoubleState() {
  if (!finalState.doubleState) {
    finalState.doubleState = {
      used: { A: false, B: false },
      activeTeam: null
    }
  }
}

function getFinalCurrentRoundState() {
  if (finalState.round === 1) return finalState.round1
  if (finalState.round === 2) return finalState.round2
  if (finalState.round === 3) return finalState.round3
  return null
}

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

function syncFinalGlobals() {
  const totalA =
    Number(finalState.round1.scores.A || 0) +
    Number(finalState.round2.scores.A || 0) +
    Number(finalState.round3.scores.A || 0)

  const totalB =
    Number(finalState.round1.scores.B || 0) +
    Number(finalState.round2.scores.B || 0) +
    Number(finalState.round3.scores.B || 0)

  window.currentSegmentScores = { A: totalA, B: totalB }

  window.finalOpenedNumbers = [
    ...finalState.round1.opened.map(x => `r1-${x}`),
    ...finalState.round2.opened.map(x => `r2-${x}`),
    ...finalState.round3.opened.map(x => `r3-${x}`)
  ]

  window.finalState = finalState
}

function clearFinalIntervals() {
  clearInterval(finalState.round2.revealTimer)
  finalState.round2.revealTimer = null

  clearInterval(finalState.round3.sequenceTimer)
  finalState.round3.sequenceTimer = null
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

function getOtherTeam(team) {
  return team === "A" ? "B" : "A"
}

function getRound2GroupKey(number) {
  return number === 1 || number === 3 ? "scramble" : "sequence"
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

    if (shuffled === original) {
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

function getRound1ForcedTeam() {
  const e = finalState.round1.errors
  if (e.A >= 3 && e.B < 3) return "B"
  if (e.B >= 3 && e.A < 3) return "A"
  return null
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

  return `font-family:'MolhimCustom', sans-serif !important;font-size:${size};line-height:${line};text-wrap:balance;`
}

function setFinalControlsMode(mode) {
  const controls = document.getElementById("finalControlsBar")
  if (!controls) return

  controls.classList.remove("finalRound1ControlsBar", "finalRound2ControlsBar", "finalRound3ControlsBar")
  if (mode === 1) controls.classList.add("finalRound1ControlsBar")
  if (mode === 2) controls.classList.add("finalRound2ControlsBar")
  if (mode === 3) controls.classList.add("finalRound3ControlsBar")
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

  resetFinalTeamSelection()
  renderFinalRound()
  saveFinalState()
  updateEndRoundButtonState()
}

function finalizeRound2Number() {
  if (finalState.round2.currentNumber !== null) {
    if (!finalState.round2.scoredNumbers.includes(finalState.round2.currentNumber)) {
      finalState.round2.scoredNumbers.push(finalState.round2.currentNumber)
    }
  }

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

  resetFinalTeamSelection()
  renderFinalRound()
  saveFinalState()
  updateEndRoundButtonState()
}

function finalizeRound3Number(nextTeam = null) {
  if (finalState.round3.currentNumber !== null) {
    if (!finalState.round3.scoredNumbers.includes(finalState.round3.currentNumber)) {
      finalState.round3.scoredNumbers.push(finalState.round3.currentNumber)
    }
  }

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

  resetFinalTeamSelection()
  renderFinalRound()

  if (nextTeam) {
    finalState.round3.activeTeam = nextTeam
    highlightFinalTeam(nextTeam)
  }

  saveFinalState()
  updateEndRoundButtonState()
}

async function loadFinalRound1CardTexts() {
  const { data, error } = await db
    .from("final_round1_items")
    .select("number, card_text, question_part1, question_part2, question_part3")
    .eq("model", currentModel)
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

/* =========================
   Init / Render
========================= */

window.renderFinal = async function () {
  const saved = getFinalState()
  finalHistory = []

  if (saved) {
    restoreFinalState(saved)
    await loadFinalRoundMeta()
    await loadFinalRound1CardTexts()
    openSegment("الفاصلة", buildFinalHTML())
    renderFinalRound()
    saveFinalState()
    updateEndRoundButtonState()
    updateFinalUndoButtonState()
    return
  }

  finalState = {
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

  window.finalState = finalState
  syncFinalGlobals()

  await loadFinalRoundMeta()
  await loadFinalRound1CardTexts()

  openSegment("الفاصلة", buildFinalHTML())
  renderFinalRound()
  saveFinalState()
  updateEndRoundButtonState()
  updateFinalUndoButtonState()
}

async function loadFinalRoundMeta() {
  const { data, error } = await db
    .from("final_round_meta")
    .select("*")
    .eq("model", currentModel)
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
    }
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
  ensureFinalDoubleState()
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
    if (centerBottom) centerBottom.innerText = finalState.round1.activeTeam ? "الدور: فريق مختار" : "الدور: اختر فريق"
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
    finalState.round1.scores.A +
    finalState.round2.scores.A +
    finalState.round3.scores.A

  const totalB =
    finalState.round1.scores.B +
    finalState.round2.scores.B +
    finalState.round3.scores.B

  if (a) a.innerText = totalA
  if (b) b.innerText = totalB
}

function renderFinalErrors() {
  const boxA = document.getElementById("finalErrorsA")
  const boxB = document.getElementById("finalErrorsB")

  if (!boxA || !boxB) return

  if (finalState.round !== 1) {
    boxA.innerHTML = ""
    boxB.innerHTML = ""
    return
  }

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

    finalState.round1.activeTeam = team
  }

  if (finalState.round === 2) finalState.round2.activeTeam = team
  if (finalState.round === 3) finalState.round3.activeTeam = team

  highlightFinalTeam(team)
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
  finalState.round1.activeTeam = null

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
    .eq("model", currentModel)
    .eq("number", number)
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

  if (!finalState.round1.cardTexts) {
    finalState.round1.cardTexts = {}
  }
  finalState.round1.cardTexts[number] = data?.card_text || ""

  const box = document.getElementById("finalRound1ImageStage")
  if (!box) return

  const fullCardText = (data?.card_text || "").trim()
  const isHistoricalTextCard = number >= 1 && number <= 3 && !!fullCardText
  const isQuestionCard = number >= 4 && number <= 6

  let mainContent = ""
  let noteContent = ""
  let answerContent = ""

  if (isHistoricalTextCard) {
    const clipText = removeArabicDots(fullCardText)

    mainContent = `
  <div class="finalRound1MainStageCard">
    <div class="finalRound1TextCard" onclick="toggleFinalRound1Overlay()">
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
        <div class="finalRound1MainStageCard">
          <div class="finalRound1QuestionStage">
            ${visibleParts.map(part => `
              <div class="finalRound1QuestionPart">${part}</div>
            `).join("")}
          </div>
        </div>
      `
    } else if (finalState.round1.currentImage) {
      mainContent = `
        <div class="finalRound1MainStageCard">
          <div class="finalRound1ImageFrame">
            <img class="finalRound1BigImage" src="${finalState.round1.currentImage}" alt="">
          </div>
        </div>
      `
    } else {
      mainContent = `
        <div class="finalRound1MainStageCard">
          <div class="finalRoundPlaceholder">اضغط إظهار السؤال</div>
        </div>
      `
    }
  } else if (finalState.round1.currentImage) {
    mainContent = `
      <div class="finalRound1MainStageCard">
        <div class="finalRound1ImageFrame">
          <img class="finalRound1BigImage" src="${finalState.round1.currentImage}" alt="">
        </div>
      </div>
    `
  } else {
    mainContent = `
      <div class="finalRound1MainStageCard">
        <div class="finalRoundPlaceholder">لا توجد صورة</div>
      </div>
    `
  }

  

  if (finalState.round1.answerShown && finalState.round1.currentAnswer) {
    answerContent = `
      <div class="finalRound1InfoCard finalRound1AnswerBox">
        ${finalState.round1.currentAnswer}
      </div>
    `
  }

  box.innerHTML = `
    <div class="finalRound1StageLayout">
      ${mainContent}

      ${(noteContent || answerContent) ? `
        <div class="finalRound1BottomInfoRow">
          ${noteContent || `<div class="finalRound1InfoCard finalRound1InfoEmpty"></div>`}
          ${answerContent || `<div class="finalRound1InfoCard finalRound1InfoEmpty"></div>`}
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

  const number = finalState.round1.currentNumber

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

  finalState.round1.answerShown = !finalState.round1.answerShown
  loadFinalRound1Current()
  renderFinalRound1()
  saveFinalState()
}

function finalRound1Wrong() {
  if (!finalState.round1.pendingScore || finalState.round1.currentNumber === null) {
    showGameToast("اختر رقمًا أولاً")
    return
  }

  pushFinalHistory()

  playGameSound("wrong")
  flashScreen("wrong")
  updateFinalDoubleButton()
  saveFinalState()
}

function finalRound1Correct() {
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


  const doubleTeam = finalState.doubleState?.activeTeam || null

  if (doubleTeam) {
    if (answeringTeam === doubleTeam) {
      finalState.round1.scores[doubleTeam] += 2
    }

    clearFinalActiveDouble()
  } else {
    finalState.round1.scores[answeringTeam] += 1
  }

  playGameSound("correct")
  flashScreen("correct")
  renderFinalScores()
saveFinalState()

setTimeout(() => {
  finalizeRound1Turn()
}, 20000)
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
  const hasCurrent = finalState.round2.pendingScore && finalState.round2.currentNumber !== null

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
    <button onclick="showFinalRound2Answer()" class="archiveCtrlBtn btnAnswer" ${hasCurrent ? "" : "disabled"}>إظهار الإجابة</button>
    <button onclick="finalRound2DecreaseCountdown()" class="archiveCtrlBtn btnStart" ${isSequence ? "" : "disabled"}>
      ${isSequence ? finalState.round2.countdown : "العداد"}
    </button>
    <button onclick="finalRound2RecordScore()" class="archiveCtrlBtn btnCorrect" ${isScramble ? "" : "disabled"}>تسجيل نتيجة المبعثرة</button>
    <button onclick="finalRound2RecordSequenceScore()" class="archiveCtrlBtn btnCorrect" ${isSequence ? "" : "disabled"}>تسجيل نتيجة التلميح</button>
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

  const team = finalState.round2.activeTeam
  if (!team) {
    showGameToast("اختر الفريق أولاً")
    return
  }

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
    .eq("model", currentModel)
    .eq("number", number)
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
  renderFinalRound2Words(false)

  let idx = 0
  finalState.round2.revealTimer = setInterval(() => {
    if (idx >= finalState.round2.scrambledWords.length) {
      clearInterval(finalState.round2.revealTimer)
      finalState.round2.revealTimer = null
      return
    }

    finalState.round2.currentRevealIndex = idx
    renderFinalRound2Words(false)
    idx++
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
            const selected = (finalState.round2.selectedCorrectIndexes || []).includes(idx)
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

function showFinalRound2Answer() {
  if (!finalState.round2.pendingScore || finalState.round2.currentNumber === null) {
    showGameToast("اختر الفريق ثم الرقم أولاً")
    return
  }

  finalState.round2.answerShown = true
  clearInterval(finalState.round2.revealTimer)
  finalState.round2.revealTimer = null

  renderFinalRoundTitle()
  renderFinalRound2Words(true)
  
  flashScreen("correct")
  saveFinalState()
}

function toggleFinalRound2CorrectSelection(index) {
  if (finalState.round2.currentType !== "scramble") return
  if (!finalState.round2.answerShown) return
  if (!finalState.round2.pendingScore) return

  pushFinalHistory()

  const arr = finalState.round2.selectedCorrectIndexes || []
  const exists = arr.includes(index)

  if (exists) {
    finalState.round2.selectedCorrectIndexes = arr.filter(x => x !== index)
  } else {
    finalState.round2.selectedCorrectIndexes = [...arr, index]
  }

  finalState.round2.correctCount = finalState.round2.selectedCorrectIndexes.length

  renderFinalRoundTitle()
  renderFinalRound2Words(true)
  saveFinalState()
}

function finalRound2AddCorrect() {
  if (!finalState.round2.pendingScore || finalState.round2.currentNumber === null) {
    showGameToast("اختر الفريق ثم الرقم أولاً")
    return
  }

  if (finalState.round2.currentType === "scramble") {
    showGameToast("حدد الصحيح بالضغط على البطاقات")
    return
  }

  showGameToast("هذا الزر غير مستخدم هنا")
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

  finalState.round2.correctCount = (finalState.round2.selectedCorrectIndexes || []).length
  finalState.round2.scores[team] += getFinalScoreValue(team, finalState.round2.correctCount)
  finalState.round2.lastTeamPlayed = team

  clearFinalActiveDouble()

  renderFinalScores()
  playGameSound("correct")
  finalizeRound2Number()
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

  renderFinalRoundTitle()
  renderFinalRound2()
  saveFinalState()
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

/* =========================
   Round 3
========================= */

function renderFinalRound3() {
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
          اختر الفريق ثم الرقم
        </div>
      </div>
    </div>
  `

  controls.innerHTML = `
    <button onclick="activateFinalDouble()" id="finalDoubleBtn" class="archiveCtrlBtn finalDoubleBtn">دبل</button>
    <button onclick="showFinalRound3Answer()" class="archiveCtrlBtn btnAnswer">إظهار الإجابة</button>
    <button onclick="finalRound3RecordScore()" class="archiveCtrlBtn btnCorrect">تسجيل النتيجة</button>
    <button onclick="startFinalRound3Sequence()" class="archiveCtrlBtn btnStart">بدء عرض الصور</button>
    <button onclick="undoFinalAction()" class="archiveCtrlBtn undoBtn finalUndoBtn">تراجع</button>
  `

  updateFinalDoubleButton()
}

async function openFinalRound3Card(number) {
  if (finalState.round3.pendingScore) {
    showGameToast("سجل النتيجة أولاً")
    return
  }

  const team = finalState.round3.activeTeam
  if (!team) {
    showGameToast("اختر الفريق أولاً")
    return
  }

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
    .eq("model", currentModel)
    .eq("number", number)
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
        <div class="finalRound3ImageFrame" onclick="toggleFinalRound3ImageOverlay()">
          <img src="${currentFinalRound3Image}" class="finalRound3Image" alt="">
        </div>
      `

      const overlayImg = document.getElementById("finalRound3ImageOverlayImg")
      if (overlayImg) {
        overlayImg.src = currentFinalRound3Image
      }

      finalState.round3.shownCount = idx + 1
      idx++
      saveFinalState()
      return
    }

    if (idx === finalState.round3.images.length) {
      currentFinalRound3Image = ""
      stage.innerHTML = `<div class="finalRoundPlaceholder">انتهى عرض الصور</div>`

      const overlay = document.getElementById("finalRound3ImageOverlay")
      if (overlay) overlay.remove()

      finalState.round3.answersAllowed = true
      idx++
      saveFinalState()
      return
    }

    clearInterval(finalState.round3.sequenceTimer)
    finalState.round3.sequenceTimer = null
  }

  showImage()
  finalState.round3.sequenceTimer = setInterval(showImage, 10000)
}

function toggleFinalRound3CorrectSelection(index) {
  if (!finalState.round3.pendingScore) return
  if (!finalState.round3.answersAllowed) return

  pushFinalHistory()

  const arr = finalState.round3.selectedCorrectIndexes || []
  const exists = arr.includes(index)

  if (exists) {
    finalState.round3.selectedCorrectIndexes = arr.filter(x => x !== index)
  } else {
    finalState.round3.selectedCorrectIndexes = [...arr, index]
  }

  finalState.round3.correctCount = finalState.round3.selectedCorrectIndexes.length

  renderFinalRoundTitle()
  showFinalRound3Answer()
  saveFinalState()
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
    <div class="finalRound3AnswersList">
      ${finalState.round3.answers.map((x, idx) => {
        const selected = (finalState.round3.selectedCorrectIndexes || []).includes(idx)
        return `
          <button class="finalRound3AnswerCard ${selected ? "selectedCorrect" : ""}" onclick="toggleFinalRound3CorrectSelection(${idx})">
            <div class="finalAnswerChip">${x}</div>
            ${finalState.round3.notes[idx] ? `<div class="finalNoteBox">${finalState.round3.notes[idx]}</div>` : ""}
          </button>
        `
      }).join("")}
    </div>
  `
      
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

  finalState.round3.correctCount = (finalState.round3.selectedCorrectIndexes || []).length
  finalState.round3.scores[team] += getFinalScoreValue(team, finalState.round3.correctCount)
  finalState.round3.lastTeamPlayed = team

  clearFinalActiveDouble()

  renderFinalScores()
  playGameSound("correct")
  flashScreen("correct")

  const nextTeam = getOtherTeam(team)
  finalizeRound3Number(nextTeam)
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