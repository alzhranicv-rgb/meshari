let finalState = {
  round: 1,

  round1: {
    title: "الجولة الأولى",
    cardsCount: 4,
    opened: [],
    activeTeam: null,
    scores: { A: 0, B: 0 },
    errors: { A: 0, B: 0 },
    currentNumber: null,
    currentAnswer: "",
    currentImage: "",
    currentNote: "",
    answerShown: false,
    pendingScore: false
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
  finalState.round2.revealTimer = null
  finalState.round3.sequenceTimer = null
  window.finalState = finalState
  syncFinalGlobals()
}

/* =========================
   Helpers
========================= */

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
}

function highlightFinalTeam(team) {
  const a = document.getElementById("finalTeamABox")
  const b = document.getElementById("finalTeamBBox")
  if (a) a.classList.remove("activeTeam")
  if (b) b.classList.remove("activeTeam")
  if (team === "A" && a) a.classList.add("activeTeam")
  if (team === "B" && b) b.classList.add("activeTeam")
}

function getOtherTeam(team) {
  return team === "A" ? "B" : "A"
}

function getRound2GroupKey(number) {
  return number === 1 || number === 3 ? "scramble" : "sequence"
}

function shuffleArabicWord(word) {
  const chars = String(word || "").split("")
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join("")
}

function getRound1ForcedTeam() {
  const e = finalState.round1.errors
  if (e.A >= 3 && e.B < 3) return "B"
  if (e.B >= 3 && e.A < 3) return "A"
  return null
}

function finalizeRound1Turn() {
  finalState.round1.pendingScore = false
  finalState.round1.currentNumber = null
  finalState.round1.currentAnswer = ""
  finalState.round1.currentImage = ""
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
  finalState.round3.shownCount = 0
  finalState.round3.correctCount = 0
  finalState.round3.answersAllowed = false

  resetFinalTeamSelection()
  renderFinalRound()

  if (nextTeam) {
    finalState.round3.activeTeam = nextTeam
    highlightFinalTeam(nextTeam)
  }

  saveFinalState()
  updateEndRoundButtonState()
}

/* =========================
   Init / Render
========================= */

window.renderFinal = async function () {
  const saved = getFinalState()

  if (saved) {
    restoreFinalState(saved)
    await loadFinalRoundMeta()
    openSegment("الفاصلة", buildFinalHTML())
    renderFinalRound()
    saveFinalState()
    updateEndRoundButtonState()
    return
  }

  finalState = {
    round: 1,
    round1: {
      title: "الجولة الأولى",
      cardsCount: 4,
      opened: [],
      activeTeam: null,
      scores: { A: 0, B: 0 },
      errors: { A: 0, B: 0 },
      currentNumber: null,
      currentAnswer: "",
      currentImage: "",
      answerShown: false,
      pendingScore: false
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
      sequenceTimer: null,
      shownCount: 0,
      correctCount: 0,
      pendingScore: false,
      answersAllowed: false,
      assignedTeams: {},
      lastTeamPlayed: null
    }
  }

  window.finalState = finalState
  syncFinalGlobals()

  await loadFinalRoundMeta()

  openSegment("الفاصلة", buildFinalHTML())
  renderFinalRound()
  saveFinalState()
  updateEndRoundButtonState()
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
      finalState.round1.cardsCount = Number(row.cards_count || 4)
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
          <div class="finalScoreTeamNameBox">${teamAName}</div>
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
          <div class="finalScoreTeamNameBox">${teamBName}</div>
        </div>

      </div>

      <div class="finalMainStage" id="finalMainStage"></div>
      <div class="finalControlsBar" id="finalControlsBar"></div>
    </div>
  `
}

function renderFinalRound() {
  clearFinalIntervals()
  renderFinalTabs()
  renderFinalScores()
  renderFinalErrors()
  renderFinalRoundTitle()
  renderFinalTeamLayout()

  if (finalState.round === 1) renderFinalRound1()
  if (finalState.round === 2) renderFinalRound2()
  if (finalState.round === 3) renderFinalRound3()

  syncFinalGlobals()
  saveFinalState()
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
    boards.classList.remove("finalBoardRound1", "finalBoardRoundOther")
    if (finalState.round === 1) boards.classList.add("finalBoardRound1")
    else boards.classList.add("finalBoardRoundOther")
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

  boxA.innerHTML = renderFinalErrorMarks(finalState.round1.errors.A)
  boxB.innerHTML = renderFinalErrorMarks(finalState.round1.errors.B)
}

function renderFinalErrorMarks(count) {
  let html = ""
  for (let i = 0; i < 3; i++) {
    html += `<span class="top10ErrorMark ${i < count ? "active" : ""}">✕</span>`
  }
  return html
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
    if (finalState.round1.currentNumber === null) {
      showGameToast("اختر رقمًا أولاً")
      return
    }
    const forcedTeam = getRound1ForcedTeam()
    if (forcedTeam && team !== forcedTeam) {
      showGameToast("الدور للفريق الأقل أخطاء")
      return
    }
    finalState.round1.activeTeam = team
  }

  if (finalState.round === 2) {
    if (finalState.round2.pendingScore && finalState.round2.currentNumber !== null) {
      finalState.round2.activeTeam = team
    } else {
      finalState.round2.activeTeam = team
    }
  }

  if (finalState.round === 3) {
    if (finalState.round3.pendingScore && finalState.round3.currentNumber !== null) {
      finalState.round3.activeTeam = team
    } else {
      finalState.round3.activeTeam = team
    }
  }

  highlightFinalTeam(team)
  saveFinalState()
}

function isFinalRoundFinished(round) {
  if (round === 1) {
    return finalState.round1.opened.length >= Number(finalState.round1.cardsCount || 4)
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

  let grid = ""
  for (let i = 1; i <= Number(finalState.round1.cardsCount || 4); i++) {
    const opened = finalState.round1.opened.includes(i)
    grid += `
      <button
        class="finalRound1Card ${opened ? "used" : ""}"
        ${opened ? "disabled" : ""}
        onclick="openFinalRound1Card(${i})"
      >
        ${i}
      </button>
    `
  }

  if (finalState.round1.currentNumber) {
    stage.innerHTML = `
      <div class="finalRound1FullView">
        <div class="finalRound1ImageStage finalRound1ImageStageFull" id="finalRound1ImageStage"></div>
      </div>
    `
  } else {
    stage.innerHTML = `
      <div class="finalRound1StartView">
        <div class="finalRound1Grid">${grid}</div>
      </div>
    `
  }

  controls.innerHTML = `
    <button onclick="showFinalRound1Answer()" class="archiveCtrlBtn btnAnswer">إظهار الإجابة</button>
    <button onclick="finalRound1Correct()" class="archiveCtrlBtn btnCorrect">إجابة صحيحة</button>
    <button onclick="finalRound1Wrong()" class="archiveCtrlBtn btnWrong">خطأ</button>
    <button onclick="goToFinalRound(2)" class="archiveCtrlBtn btnNext">الجولة التالية</button>
  `

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

  finalState.round1.currentNumber = number
  finalState.round1.opened.push(number)
  finalState.round1.pendingScore = true
  finalState.round1.currentAnswer = ""
  finalState.round1.currentImage = ""
  finalState.round1.currentNote = ""
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

  const box = document.getElementById("finalRound1ImageStage")
  if (!box) return

  let html = ""

  if (finalState.round1.currentNote) {
    html += `
      <div class="finalNoteBox finalNoteBoxTop finalRound1NoteOverlay">
        ${finalState.round1.currentNote}
      </div>
    `
  }

  if (finalState.round1.currentImage) {
    html += `
      <div class="finalRound1ImageInner">
        <img src="${finalState.round1.currentImage}" alt="">
      </div>
    `
  } else {
    html += `<div class="finalRoundPlaceholder">لا توجد صورة</div>`
  }

  if (finalState.round1.answerShown && finalState.round1.currentAnswer) {
    html += `<div class="finalAnswerBox">${finalState.round1.currentAnswer}</div>`
  }

  box.innerHTML = html
}

function showFinalRound1Answer() {
  if (!finalState.round1.pendingScore || !finalState.round1.currentNumber) {
    showGameToast("اختر رقمًا أولاً")
    return
  }

  if (!finalState.round1.answerShown) {
    finalState.round1.answerShown = true
    loadFinalRound1Current()
  }

  playGameSound("answer")
  saveFinalState()

  setTimeout(() => {
    finalizeRound1Turn()
  }, 4000)
}

function finalRound1Wrong() {
  const team = finalState.round1.activeTeam

  if (!finalState.round1.pendingScore || finalState.round1.currentNumber === null) {
    showGameToast("اختر رقمًا أولاً")
    return
  }

  if (!team) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  if (finalState.round1.errors[team] < 3) {
    finalState.round1.errors[team] += 1
  }

  const forcedTeam = getRound1ForcedTeam()
  if (forcedTeam) {
    finalState.round1.activeTeam = forcedTeam
    highlightFinalTeam(forcedTeam)
  }

  playGameSound("wrong")
  renderFinalErrors()
  saveFinalState()
}

function finalRound1Correct() {
  const team = finalState.round1.activeTeam

  if (!finalState.round1.pendingScore || finalState.round1.currentNumber === null) {
    showGameToast("اختر رقمًا أولاً")
    return
  }

  if (!team) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  if (!finalState.round1.answerShown) {
    finalState.round1.answerShown = true
    loadFinalRound1Current()
  }

  finalState.round1.scores[team] += 1
  playGameSound("correct")
  renderFinalScores()
  saveFinalState()

  setTimeout(() => {
    finalizeRound1Turn()
  }, 4000)
}

function finalizeRound1Turn() {
  finalState.round1.pendingScore = false
  finalState.round1.currentNumber = null
  finalState.round1.currentAnswer = ""
  finalState.round1.currentImage = ""
  finalState.round1.currentNote = ""
  finalState.round1.answerShown = false
  resetFinalTeamSelection()
  renderFinalRound()
  saveFinalState()
  updateEndRoundButtonState()
}
/* =========================
   Round 2
========================= */

function renderFinalRound2() {
  const stage = document.getElementById("finalMainStage")
  const controls = document.getElementById("finalControlsBar")
  if (!stage || !controls) return

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

  stage.innerHTML = `
    <div class="finalRound2Wrap">
      <div class="finalRound2Grid">${grid}</div>
      <div class="finalRound2WordsStage" id="finalRound2WordsStage">
        اختر الفريق ثم الرقم
      </div>
    </div>
  `

  if (finalState.round2.currentType === "scramble") {
    controls.innerHTML = `
      <button onclick="showFinalRound2Answer()" class="archiveCtrlBtn btnAnswer">إظهار الإجابة</button>
      <button onclick="finalRound2RecordScore()" class="archiveCtrlBtn btnSave">تسجيل النتيجة</button>
      <button onclick="goToFinalRound(3)" class="archiveCtrlBtn btnNext">الجولة التالية</button>
    `
  } else if (finalState.round2.currentType === "sequence") {
    controls.innerHTML = `
      <button onclick="finalRound2DecreaseCountdown()" class="archiveCtrlBtn btnCounter">${finalState.round2.countdown}</button>
      <button onclick="finalRound2RecordSequenceScore()" class="archiveCtrlBtn btnSave">تسجيل النتيجة</button>
      <button onclick="goToFinalRound(3)" class="archiveCtrlBtn btnNext">الجولة التالية</button>
    `
  } else {
    controls.innerHTML = `
      <button onclick="showGameToast('اختر الفريق ثم الرقم أولاً')" class="archiveCtrlBtn btnSave">تسجيل النتيجة</button>
      <button onclick="goToFinalRound(3)" class="archiveCtrlBtn btnNext">الجولة التالية</button>
    `
  }

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
  playGameSound("answer")
  saveFinalState()
}

function toggleFinalRound2CorrectSelection(index) {
  if (finalState.round2.currentType !== "scramble") return
  if (!finalState.round2.answerShown) return
  if (!finalState.round2.pendingScore) return

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

  finalState.round2.correctCount = (finalState.round2.selectedCorrectIndexes || []).length
  finalState.round2.scores[team] += Number(finalState.round2.correctCount || 0)
  finalState.round2.lastTeamPlayed = team

  renderFinalScores()
  playGameSound("correct")
  finalizeRound2Number()
}

function hideFinalRound2SequenceWord(index) {
  if (finalState.round2.currentType !== "sequence") return
  if (!finalState.round2.pendingScore) return
  if (index < 0) return
  if (finalState.round2.hiddenSequence.includes(index)) return

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

  finalState.round2.scores[team] += Number(finalState.round2.countdown || 0)
  finalState.round2.lastTeamPlayed = team

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

  resetFinalTeamSelection()
  renderFinalRound()
  saveFinalState()
  updateEndRoundButtonState()
}
/* =========================
   Round 3
========================= */

function renderFinalRound3() {
  const stage = document.getElementById("finalMainStage")
  const controls = document.getElementById("finalControlsBar")
  if (!stage || !controls) return

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
    <button onclick="showFinalRound3Answer()" class="archiveCtrlBtn btnAnswer">إظهار الإجابة</button>
    <button onclick="finalRound3RecordScore()" class="archiveCtrlBtn btnSave">تسجيل النتيجة</button>
    <button onclick="startFinalRound3Sequence()" class="archiveCtrlBtn btnStart">بدء عرض الصور</button>
  `
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

  clearInterval(finalState.round3.sequenceTimer)
  finalState.round3.sequenceTimer = null

  finalState.round3.currentNumber = number
  finalState.round3.opened.push(number)
  finalState.round3.pendingScore = true
  finalState.round3.correctCount = 0
  finalState.round3.answersAllowed = false
  finalState.round3.selectedCorrectIndexes = []
  finalState.round3.assignedTeams[number] = team

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
      stage.innerHTML = `<img src="${finalState.round3.images[idx]}" alt="">`
      finalState.round3.shownCount = idx + 1
      idx++
      return
    }

    if (idx === finalState.round3.images.length) {
      stage.innerHTML = `<div class="finalRoundPlaceholder">انتهى عرض الصور</div>`
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
  playGameSound("answer")
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

  finalState.round3.correctCount = (finalState.round3.selectedCorrectIndexes || []).length
  finalState.round3.scores[team] += Number(finalState.round3.correctCount || 0)
  finalState.round3.lastTeamPlayed = team

  renderFinalScores()
  playGameSound("correct")

  const nextTeam = getOtherTeam(team)
  finalizeRound3Number(nextTeam)
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

  resetFinalTeamSelection()
  renderFinalRound()

  if (nextTeam) {
    finalState.round3.activeTeam = nextTeam
    highlightFinalTeam(nextTeam)
  }

  saveFinalState()
  updateEndRoundButtonState()
}