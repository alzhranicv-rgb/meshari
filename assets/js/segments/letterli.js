/* =========================================================
   LETTERLI / حرفلي
   File: assets/js/segments/letterli.js
========================================================= */

const LETTERLI_EXCEL_PATH =
  "assets/data/letterli_questions.xlsx"

const LETTERLI_STORAGE_KEY =
  "letterli_state_v1"

const LETTERLI_TIMER_SECONDS = 5

const LETTERLI_ALPHABET = [
  "أ",
  "ب",
  "ت",
  "ث",
  "ج",
  "ح",
  "خ",
  "د",
  "ذ",
  "ر",
  "ز",
  "س",
  "ش",
  "ص",
  "ض",
  "ط",
  "ظ",
  "ع",
  "غ",
  "ف",
  "ق",
  "ك",
  "ل",
  "م",
  "ن",
  "ه",
  "و",
  "ي"
]

let letterliQuestions = {}

let letterliLoaded = false
let letterliLoading = false
let letterliSpinTimer = null
let letterliCountdownTimer = null
let letterliTimerSync = null
let letterliLoadError = ""

let letterliStateSyncTimer = null
let letterliStateSyncQueued = false
let letterliStateSyncPending = false

let letterliState =
  createDefaultLetterliState()

window.letterliState =
  letterliState

/* =========================================================
   DEFAULT STATE
========================================================= */

function createDefaultLetterliState() {
  return {
    currentLetter: null,
    currentQuestionIndex: null,
    currentQuestion: null,

    usedLetters: [],
    usedQuestions: {},

    scoreA: 0,
    scoreB: 0,
    completedCount: 0,

    selectedTeam: null,

    questionVisible: false,
    answerVisible: false,

    timerValue: LETTERLI_TIMER_SECONDS,
    timerRunning: false,
    timerSync: null,

    spinning: false
  }
}

/* =========================================================
   NORMALIZE
========================================================= */

function cleanLetterliText(value) {
  return String(value ?? "")
    .replace(/\u200f/g, "")
    .replace(/\u200e/g, "")
    .trim()
}

function normalizeLetterliLetter(value) {
  const letter =
    cleanLetterliText(value)
      .replace(/[إآٱا]/g, "أ")
      .replace(/ى/g, "ي")
      .replace(/ة/g, "ه")
      .replace(/ـ/g, "")

  if (!letter) {
    return ""
  }

  return LETTERLI_ALPHABET.includes(letter)
    ? letter
    : ""
}

function buildLetterliQuestionSnapshot(question) {
  if (!question) return null

  return {
    id: cleanLetterliText(question.id),
    letter: normalizeLetterliLetter(question.letter),
    question: cleanLetterliText(question.question),
    answer: cleanLetterliText(question.answer)
  }
}

function syncLetterliGlobals() {
  letterliState.timerSync = letterliTimerSync

  window.letterliState = letterliState
  window.letterliTimerSync = letterliTimerSync

  window.currentSegmentScores = {
    A: Number(letterliState.scoreA || 0),
    B: Number(letterliState.scoreB || 0)
  }
}

function createLetterliTimerSync(seconds = LETTERLI_TIMER_SECONDS) {
  const now = Date.now()
  const duration = Math.max(0, Number(seconds || 0))

  return {
    startedAt: now,
    endsAt: now + duration * 1000,
    duration
  }
}

function clearLetterliTimerSync() {
  letterliTimerSync = null
  letterliState.timerSync = null
  window.letterliTimerSync = null
}

function getLetterliTimerRemaining(fallback = LETTERLI_TIMER_SECONDS) {
  if (
    letterliTimerSync &&
    Number(letterliTimerSync.endsAt || 0) > Date.now()
  ) {
    return Math.max(
      0,
      Math.ceil((Number(letterliTimerSync.endsAt) - Date.now()) / 1000)
    )
  }

  return Number(fallback || LETTERLI_TIMER_SECONDS)
}

function setLetterliGameActiveTeam(team) {
  if (team !== "A" && team !== "B") return

  window.selectedTeam = team

  if (typeof window.setGameActiveTeam === "function") {
    window.setGameActiveTeam(team, {
      sync: false
    })
  }
}

function clearLetterliGameActiveTeam() {
  window.selectedTeam = null

  if (typeof window.clearGameActiveTeam === "function") {
    window.clearGameActiveTeam({
      sync: false
    })
  }
}

/* =========================================================
   STORAGE
========================================================= */

function loadLetterliState() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(
        LETTERLI_STORAGE_KEY
      ) || "null"
    )

    if (!saved) {
      letterliState =
        createDefaultLetterliState()

      letterliTimerSync = null

      syncLetterliGlobals()

      return
    }

    letterliState = {
      ...createDefaultLetterliState(),
      ...saved,

      currentQuestion:
        saved.currentQuestion &&
        typeof saved.currentQuestion === "object"
          ? buildLetterliQuestionSnapshot(saved.currentQuestion)
          : null,

      usedLetters:
        Array.isArray(saved.usedLetters)
          ? saved.usedLetters
              .map(normalizeLetterliLetter)
              .filter(Boolean)
          : [],

      usedQuestions:
        saved.usedQuestions &&
        typeof saved.usedQuestions === "object"
          ? saved.usedQuestions
          : {},

      scoreA:
        Number(
          saved.scoreA ??
          saved.scores?.A ??
          0
        ),

      scoreB:
        Number(
          saved.scoreB ??
          saved.scores?.B ??
          0
        ),

      completedCount:
        Number(
          saved.completedCount ??
          saved.answeredCount ??
          0
        ),

      selectedTeam: null,
      spinning: false,
      timerRunning: false
    }

    letterliTimerSync =
      saved.timerSync ||
      saved.letterliTimerSync ||
      saved.currentTimerSync ||
      null

    letterliState.timerSync = letterliTimerSync

    syncLetterliGlobals()
  } catch (error) {
    console.warn(
      "LETTERLI STATE LOAD ERROR:",
      error
    )

    letterliState =
      createDefaultLetterliState()

    letterliTimerSync = null

    syncLetterliGlobals()
  }
}

function saveLetterliState(options = {}) {
  syncLetterliGlobals()

  localStorage.setItem(
    LETTERLI_STORAGE_KEY,
    JSON.stringify(
      letterliState
    )
  )

  localStorage.setItem(
    "active_segment",
    "letterli"
  )

  if (options.sync === false) {
    return
  }

  const immediate = options.immediate === true
  const delay = immediate ? 0 : 120

  letterliStateSyncPending = true

  clearTimeout(letterliStateSyncTimer)

  letterliStateSyncTimer = setTimeout(() => {
    runLetterliStateSync(immediate)
  }, delay)
}

async function runLetterliStateSync(immediate = false) {
  if (letterliStateSyncQueued) {
    letterliStateSyncPending = true
    return
  }

  if (
    typeof window.saveUnifiedGameState !== "function" &&
    typeof window.syncDisplayStateToSession !== "function"
  ) {
    letterliStateSyncPending = false
    return
  }

  letterliStateSyncQueued = true
  letterliStateSyncPending = false

  try {
    if (typeof window.saveUnifiedGameState === "function") {
      await Promise.resolve(
        window.saveUnifiedGameState()
      )
    }

    if (typeof window.syncDisplayStateToSession === "function") {
      await Promise.resolve(
        window.syncDisplayStateToSession({
          immediate
        })
      )
    }
  } catch (error) {
    console.log(
      "LETTERLI STATE SYNC ERROR:",
      error
    )
  } finally {
    letterliStateSyncQueued = false

    if (letterliStateSyncPending) {
      letterliStateSyncTimer = setTimeout(() => {
        runLetterliStateSync(true)
      }, 60)
    }
  }
}

function resetLetterliState() {
  stopLetterliSpin()
  stopLetterliCountdown(false)

  letterliState =
    createDefaultLetterliState()

  letterliLoadError = ""

  letterliTimerSync = null

  syncLetterliGlobals()

  localStorage.removeItem(
    LETTERLI_STORAGE_KEY
  )

  renderLetterli()
}

/* =========================================================
   ELEMENTS
========================================================= */

function getLetterliElement(id) {
  return document.getElementById(id)
}

function getLetterliElements() {
  return {
    currentLetter:
      getLetterliElement(
        "letterliCurrentLetter"
      ),

    questionCard:
      getLetterliElement(
        "letterliQuestionCard"
      ),

      questionLabel:
  getLetterliElement(
    "letterliQuestionLabel"
  ),

    questionText:
      getLetterliElement(
        "letterliQuestionText"
      ),

    timer:
      getLetterliElement(
        "letterliTimer"
      ),

    timerButton:
      getLetterliElement(
        "letterliTimerButton"
      ),

    spinButton:
      getLetterliElement(
        "letterliSpinBtn"
      ),

    changeQuestionButton:
      getLetterliElement(
        "letterliChangeQuestionBtn"
      ),

    toggleQuestionButton:
      getLetterliElement(
        "letterliToggleQuestionBtn"
      ),

    correctButton:
      getLetterliElement(
        "letterliCorrectBtn"
      ),

    teamABox:
      getLetterliElement(
        "letterliTeamABox"
      ),

    teamBBox:
      getLetterliElement(
        "letterliTeamBBox"
      )
  }
}

/* =========================================================
   TOAST
========================================================= */

function showLetterliToast(message) {
  if (
    typeof window.showGameToast ===
    "function"
  ) {
    window.showGameToast(message)
    return
  }

  console.log(message)
}

/* =========================================================
   EXCEL LOADER
========================================================= */

async function loadLetterliQuestions() {
  if (letterliLoaded) {
    return true
  }

  if (letterliLoading) {
    return false
  }

  letterliLoading = true
  letterliLoadError = ""

  try {
    if (
      typeof window.XLSX ===
      "undefined"
    ) {
      throw new Error(
        "مكتبة XLSX غير موجودة"
      )
    }

    const response =
      await fetch(
        LETTERLI_EXCEL_PATH,
        {
          cache: "no-store"
        }
      )

    if (!response.ok) {
      throw new Error(
        `تعذر تحميل ملف الأسئلة: ${response.status}`
      )
    }

    const buffer =
      await response.arrayBuffer()

    const workbook =
      XLSX.read(buffer, {
        type: "array"
      })

    const firstSheetName =
      workbook.SheetNames[0]

    if (!firstSheetName) {
      throw new Error(
        "ملف الأسئلة لا يحتوي على ورقة"
      )
    }

    const sheet =
      workbook.Sheets[
        firstSheetName
      ]

    const rows =
      XLSX.utils.sheet_to_json(
        sheet,
        {
          defval: "",
          raw: false
        }
      )

    const questions = {}

    rows.forEach((row, rowIndex) => {
      const letter =
        normalizeLetterliLetter(
          row["الحرف"] ||
          row["حرف"] ||
          row.letter
        )

      const question =
        cleanLetterliText(
          row["السؤال"] ||
          row["سؤال"] ||
          row.question
        )

      const answer =
        cleanLetterliText(
          row["الإجابة"] ||
          row["الاجابة"] ||
          row["جواب"] ||
          row.answer
        )

      if (
        !letter ||
        !question ||
        !answer
      ) {
        return
      }

      if (
        !Array.isArray(
          questions[letter]
        )
      ) {
        questions[letter] = []
      }

      questions[letter].push({
        id: `${letter}_${rowIndex + 2}`,
        letter,
        question,
        answer
      })
    })

    letterliQuestions =
      questions

    letterliLoaded = true
    letterliLoadError = ""

    const availableLetters =
      getLetterliAvailableLetters()

    if (!availableLetters.length) {
      throw new Error(
        "لا توجد أسئلة صالحة في ملف الإكسل"
      )
    }

    return true
  } catch (error) {
  console.error(
    "LETTERLI QUESTIONS LOAD ERROR:",
    error
  )

  letterliQuestions = {}
  letterliLoaded = false

  const errorMessage =
    String(error?.message || "")

  if (
    errorMessage.includes(
      "لا توجد أسئلة صالحة"
    )
  ) {
    letterliLoadError =
      "لا توجد أسئلة صالحة في ملف الإكسل"
  } else if (
    errorMessage.includes("404")
  ) {
    letterliLoadError =
      "تعذر العثور على ملف أسئلة حرفلي"
  } else if (
    errorMessage.includes(
      "مكتبة XLSX"
    )
  ) {
    letterliLoadError =
      "مكتبة قراءة الإكسل غير محمّلة"
  } else {
    letterliLoadError =
      "تعذر تحميل أسئلة حرفلي"
  }

  return false
} finally {
  letterliLoading = false
}
}

/* =========================================================
   QUESTIONS HELPERS
========================================================= */

function getLetterliQuestionsByLetter(
  letter
) {
  const normalized =
    normalizeLetterliLetter(letter)

  const rows =
    letterliQuestions[
      normalized
    ]

  return Array.isArray(rows)
    ? rows
    : []
}

function getLetterliAvailableLetters() {
  return LETTERLI_ALPHABET.filter(
    letter =>
      getLetterliQuestionsByLetter(
        letter
      ).length > 0
  )
}

function getLetterliCurrentQuestion() {
  const letter =
    normalizeLetterliLetter(
      letterliState.currentLetter
    )

  const index =
    Number(
      letterliState.currentQuestionIndex
    )

  if (
    !letter ||
    !Number.isInteger(index)
  ) {
    return null
  }

  const questions =
    getLetterliQuestionsByLetter(
      letter
    )

  const question =
    questions[index] || null

  if (question) {
    return question
  }

  const savedQuestion =
    letterliState.currentQuestion

  if (
    savedQuestion &&
    normalizeLetterliLetter(savedQuestion.letter) === letter
  ) {
    return savedQuestion
  }

  return null
}

function getLetterliUnusedLetters() {
  const available =
    getLetterliAvailableLetters()

  const used =
    new Set(
      letterliState.usedLetters
        .map(normalizeLetterliLetter)
        .filter(Boolean)
    )

  return available.filter(
    letter => !used.has(letter)
  )
}

function getLetterliUsedQuestionIndexes(
  letter
) {
  const normalized =
    normalizeLetterliLetter(letter)

  const saved =
    letterliState.usedQuestions[
      normalized
    ]

  if (!Array.isArray(saved)) {
    return []
  }

  return saved
    .map(Number)
    .filter(Number.isInteger)
}

function getRandomLetterliItem(
  items
) {
  if (
    !Array.isArray(items) ||
    !items.length
  ) {
    return null
  }

  return items[
    Math.floor(
      Math.random() *
      items.length
    )
  ]
}

/* =========================================================
   SELECT QUESTION
========================================================= */

function selectLetterliQuestion(
  letter,
  options = {}
) {
  const normalized =
    normalizeLetterliLetter(letter)

  const questions =
    getLetterliQuestionsByLetter(
      normalized
    )

  if (!questions.length) {
    letterliState.currentQuestionIndex = null
    letterliState.currentQuestion = null
    letterliState.questionVisible = false
    letterliState.answerVisible = false

    stopLetterliCountdown(true)

    saveLetterliState({ immediate: true })
    renderLetterli()

    return null
  }

  const currentIndex =
    Number(
      letterliState.currentQuestionIndex
    )

  let usedIndexes =
    getLetterliUsedQuestionIndexes(
      normalized
    )

  let availableIndexes =
    questions
      .map((_, index) => index)
      .filter(
        index =>
          !usedIndexes.includes(index)
      )

  if (
    options.avoidCurrent === true &&
    questions.length > 1
  ) {
    availableIndexes =
      availableIndexes.filter(
        index =>
          index !== currentIndex
      )
  }

  if (!availableIndexes.length) {
    usedIndexes = []

    availableIndexes =
      questions.map(
        (_, index) => index
      )

    if (
      options.avoidCurrent === true &&
      questions.length > 1
    ) {
      availableIndexes =
        availableIndexes.filter(
          index =>
            index !== currentIndex
        )
    }
  }

  const selectedIndex =
    getRandomLetterliItem(
      availableIndexes
    )

  if (
    selectedIndex === null ||
    selectedIndex === undefined
  ) {
    return null
  }

  letterliState.currentLetter = normalized
  letterliState.currentQuestionIndex = selectedIndex
  letterliState.currentQuestion =
    buildLetterliQuestionSnapshot(
      questions[selectedIndex]
    )

  letterliState.selectedTeam = null
  letterliState.questionVisible = false
  letterliState.answerVisible = false

  clearLetterliGameActiveTeam()
  stopLetterliCountdown(true)

  const nextUsedIndexes =
    Array.from(
      new Set([
        ...usedIndexes,
        selectedIndex
      ])
    )

  letterliState.usedQuestions[
    normalized
  ] = nextUsedIndexes

  saveLetterliState({ immediate: true })
  renderLetterli()

  return questions[selectedIndex]
}

function changeLetterliQuestion() {
  if (letterliState.spinning) {
    return
  }

  const letter =
    normalizeLetterliLetter(
      letterliState.currentLetter
    )

  if (!letter) {
    showLetterliToast(
      "شغّل خلط الحروف أولاً"
    )

    return
  }

  const questions =
    getLetterliQuestionsByLetter(
      letter
    )

  if (!questions.length) {
    showLetterliToast(
      "لا توجد أسئلة لهذا الحرف"
    )

    return
  }

  if (questions.length === 1) {
    showLetterliToast(
      "يوجد سؤال واحد فقط لهذا الحرف"
    )

    return
  }

  stopLetterliCountdown(true)

  selectLetterliQuestion(
    letter,
    {
      avoidCurrent: true
    }
  )
}

/* =========================================================
   LETTER SPIN
========================================================= */

function stopLetterliSpin() {
  if (letterliSpinTimer) {
    clearTimeout(letterliSpinTimer)
    letterliSpinTimer = null
  }

  letterliState.spinning = false

  const letterElement =
  getLetterliElement(
    "letterliCurrentLetter"
  )

  letterElement?.classList.remove(
    "is-spinning"
  )
}

function getLetterliSpinDelays() {
  return [
    48,
    48,
    50,
    50,
    52,
    52,
    55,
    55,
    58,
    60,
    64,
    68,
    74,
    82,
    92,
    105,
    120,
    140,
    165,
    195,
    230,
    275,
    330,
    400
  ]
}

async function startLetterliSpin() {
  if (
    letterliState.spinning ||
    getLetterliCurrentQuestion()
  ) {
    if (getLetterliCurrentQuestion()) {
      showLetterliToast(
        "أنهِ السؤال الحالي أولاً"
      )
    }

    return
  }

  const loaded =
    await loadLetterliQuestions()

  if (!loaded) {
    renderLetterli()
    return
  }

  let selectableLetters =
    getLetterliUnusedLetters()

  if (!selectableLetters.length) {
    letterliState.usedLetters = []

    selectableLetters =
      getLetterliAvailableLetters()
  }

  if (!selectableLetters.length) {
    showLetterliToast(
      "لا توجد حروف تحتوي على أسئلة"
    )

    return
  }

  stopLetterliSpin()
  stopLetterliCountdown(true)

  letterliState.spinning = true
  letterliState.answerVisible = false
  letterliState.questionVisible = false
  letterliState.selectedTeam = null
  letterliState.currentQuestionIndex = null
  letterliState.currentQuestion = null

  saveLetterliState({
    sync: false
  })

  renderLetterli()

  const letterElement =
    getLetterliElement(
      "letterliCurrentLetter"
    )

  letterElement?.classList.remove(
    "is-selected"
  )

  letterElement?.classList.add(
    "is-spinning"
  )

  const finalLetter =
    getRandomLetterliItem(
      selectableLetters
    )

  const animationLetters =
    getLetterliAvailableLetters()

  const delays =
    getLetterliSpinDelays()

  let step = 0
  let previousLetter = null

  function runStep() {
    if (!letterliState.spinning) {
      return
    }

    if (step >= delays.length) {
      finishLetterliSpin(
        finalLetter
      )

      return
    }

    let previewLetter =
      getRandomLetterliItem(
        animationLetters
      )

    if (
      animationLetters.length > 1
    ) {
      while (
        previewLetter ===
        previousLetter
      ) {
        previewLetter =
          getRandomLetterliItem(
            animationLetters
          )
      }
    }

    previousLetter =
      previewLetter

    letterliState.currentLetter =
      previewLetter

    letterliState.currentQuestionIndex =
      null

    renderLetterli()

    const delay =
      delays[step]

    step += 1

    letterliSpinTimer =
      window.setTimeout(
        runStep,
        delay
      )
  }

  runStep()
}

function finishLetterliSpin(
  selectedLetter
) {
  stopLetterliSpin()

  const letter =
    normalizeLetterliLetter(
      selectedLetter
    )

  if (!letter) {
    renderLetterli()
    return
  }

  letterliState.currentLetter =
    letter

  if (
    !letterliState.usedLetters.includes(
      letter
    )
  ) {
    letterliState.usedLetters.push(
      letter
    )
  }

  saveLetterliState({
    sync: false
  })

  selectLetterliQuestion(letter)

requestAnimationFrame(() => {
  const letterElement =
    getLetterliElement(
      "letterliCurrentLetter"
    )

  if (!letterElement) {
    return
  }

  letterElement.classList.remove(
    "is-spinning",
    "is-selected"
  )

  void letterElement.offsetWidth

  letterElement.classList.add(
    "is-selected"
  )

  window.setTimeout(() => {
    letterElement.classList.remove(
      "is-selected"
    )
  }, 850)
})

  if (
    typeof window.playLetterliStopSound ===
    "function"
  ) {
    window.playLetterliStopSound()
  }
}

/* =========================================================
   COUNTDOWN TIMER
========================================================= */

function stopLetterliCountdown(
  reset = false
) {
  if (letterliCountdownTimer) {
    clearInterval(
      letterliCountdownTimer
    )

    letterliCountdownTimer = null
  }

  letterliState.timerRunning = false
  clearLetterliTimerSync()

  if (reset) {
    letterliState.timerValue = LETTERLI_TIMER_SECONDS
  }
}

function resetLetterliCountdown() {
  stopLetterliCountdown(true)
  saveLetterliState({ immediate: true })
  renderLetterli()
}

function startLetterliCountdown() {
  if (
    letterliState.spinning ||
    letterliState.timerRunning ||
    letterliState.answerVisible
  ) {
    return
  }

  if (!getLetterliCurrentQuestion()) {
    showLetterliToast(
      "لا يوجد سؤال حالي"
    )

    return
  }

  letterliState.timerValue = LETTERLI_TIMER_SECONDS
  letterliState.timerRunning = true
  letterliTimerSync =
    createLetterliTimerSync(
      LETTERLI_TIMER_SECONDS
    )

  saveLetterliState({ immediate: true })
  renderLetterli()

  letterliCountdownTimer =
    window.setInterval(() => {
      letterliState.timerValue =
        getLetterliTimerRemaining(
          letterliState.timerValue
        )

      if (
        letterliState.timerValue <= 0
      ) {
        stopLetterliCountdown(false)

        letterliState.timerValue = 0

        saveLetterliState({ immediate: true })
        renderLetterli()

        if (
          typeof window
            .playTimeoutSound ===
          "function"
        ) {
          window.playTimeoutSound()
        }

        return
      }

      saveLetterliState({
        sync: false
      })

      renderLetterli()
    }, 1000)
}

/* =========================================================
   VISIBILITY
========================================================= */

function toggleLetterliQuestion() {
  if (letterliState.spinning) {
    return
  }

  const currentQuestion =
    getLetterliCurrentQuestion()

  if (!currentQuestion) {
    showLetterliToast(
      "لا يوجد سؤال حالي"
    )

    return
  }

  letterliState.questionVisible =
    true

  letterliState.answerVisible =
    false

  saveLetterliState({ immediate: true })
  renderLetterli()
}

function markLetterliCorrectAnswer() {
  if (
    letterliState.spinning ||
    letterliState.answerVisible
  ) {
    return
  }

  const currentQuestion =
    getLetterliCurrentQuestion()

  if (!currentQuestion) {
    return
  }

  stopLetterliCountdown(false)

  letterliState.questionVisible = false
  letterliState.answerVisible = true
  letterliState.selectedTeam = null

  clearLetterliGameActiveTeam()

  saveLetterliState({ immediate: true })
  renderLetterli()
}

/* =========================================================
   TEAM SELECTION
========================================================= */

function getLetterliSelectedTeam() {
  return (
    letterliState.selectedTeam === "A" ||
    letterliState.selectedTeam === "B"
  )
    ? letterliState.selectedTeam
    : null
}

function selectLetterliTeam(team) {
  if (
    team !== "A" &&
    team !== "B"
  ) {
    return false
  }

  if (letterliState.spinning) {
    return false
  }

  const currentQuestion =
    getLetterliCurrentQuestion()

  if (
    !currentQuestion ||
    !letterliState.answerVisible
  ) {
    showLetterliToast(
      "أظهر الإجابة أولاً"
    )

    return false
  }

  letterliState.selectedTeam = team

  setLetterliGameActiveTeam(team)

  addLetterliPoint(team)

  letterliState.completedCount =
    Number(
      letterliState.completedCount || 0
    ) + 1

  stopLetterliCountdown(true)

  letterliState.currentLetter = null
  letterliState.currentQuestionIndex = null
  letterliState.currentQuestion = null
  letterliState.questionVisible = false
  letterliState.answerVisible = false
  letterliState.selectedTeam = null

  clearLetterliGameActiveTeam()

  saveLetterliState({ immediate: true })
  renderLetterli()

  return true
}

function renderLetterliSelectedTeam() {
  const selectedTeam =
    getLetterliSelectedTeam()

  const teamABox =
    document.getElementById(
      "letterliTeamABox"
    )

  const teamBBox =
    document.getElementById(
      "letterliTeamBBox"
    )

  teamABox?.classList.toggle(
    "warmupTeamCurrent",
    selectedTeam === "A"
  )

  teamBBox?.classList.toggle(
    "warmupTeamCurrent",
    selectedTeam === "B"
  )
}

/* =========================================================
   RENDER
========================================================= */

function renderLetterli() {
  const elements =
    getLetterliElements()

  if (!elements.currentLetter) {
    return
  }

  renderLetterliSelectedTeam()

  const currentQuestion =
    getLetterliCurrentQuestion()

  const currentLetter =
    normalizeLetterliLetter(
      letterliState.currentLetter
    )

  const selectedTeam =
    getLetterliSelectedTeam()

  const controlsDisabled =
    letterliState.spinning ||
    letterliLoading ||
    Boolean(letterliLoadError)

  /* =========================
     CURRENT LETTER
  ========================= */

  elements.currentLetter.textContent =
  letterliState.answerVisible
    ? "؟"
    : currentLetter || "؟"

  elements.currentLetter.classList.toggle(
    "is-spinning",
    letterliState.spinning
  )

  /* =========================
     TIMER
  ========================= */

  if (elements.timer) {
    const liveTimerValue =
      letterliState.timerRunning
        ? getLetterliTimerRemaining(
            letterliState.timerValue
          )
        : Number(
            letterliState.timerValue ??
            LETTERLI_TIMER_SECONDS
          )

    elements.timer.textContent =
      String(liveTimerValue)

    elements.timer.classList.toggle(
  "timerDanger",
  letterliState.timerRunning &&
  letterliState.timerValue <= 3
)

    elements.timer.classList.toggle(
      "timerFinished",
      !letterliState.timerRunning &&
      letterliState.timerValue === 0
    )
  }

  if (elements.timerButton) {
  elements.timerButton.classList.toggle(
    "is-running",
    letterliState.timerRunning
  )

  elements.timerButton.disabled =
    controlsDisabled ||
    !currentQuestion ||
    letterliState.answerVisible
}

  /* =========================
     QUESTION CARD
  ========================= */

  if (elements.questionCard) {
    elements.questionCard.classList.toggle(
      "has-error",
      Boolean(letterliLoadError)
    )

    elements.questionCard.classList.toggle(
      "is-spinning",
      letterliState.spinning
    )

    elements.questionCard.classList.toggle(
      "has-answer",
      letterliState.answerVisible
    )
  }

  if (elements.questionLabel) {
  elements.questionLabel.textContent =
    letterliState.answerVisible
      ? "الإجابة"
      : "السؤال"

  elements.questionLabel.classList.toggle(
    "is-answer",
    letterliState.answerVisible
  )
}

if (elements.questionText) {
  if (letterliLoadError) {
    elements.questionText.innerHTML = `
      <div class="letterliErrorMessage">

        <span class="letterliErrorIcon">
          !
        </span>

        <strong>
          تعذر تجهيز الأسئلة
        </strong>

        <p>
          ${cleanLetterliText(
            letterliLoadError
          )}
        </p>

      </div>
    `
  } else if (letterliLoading) {
    elements.questionText.textContent =
      "جاري تحميل الأسئلة..."
  } else if (letterliState.spinning) {
    elements.questionText.textContent =
      "جاري اختيار الحرف..."
  } else if (
    currentQuestion &&
    letterliState.answerVisible
  ) {
    elements.questionText.textContent =
      currentQuestion.answer
  } else if (
    currentQuestion &&
    letterliState.questionVisible
  ) {
    elements.questionText.textContent =
      currentQuestion.question
  } else if (currentQuestion) {
    elements.questionText.textContent =
      "السؤال مخفي"
  } else {
    elements.questionText.textContent =
      "اضغط خلط الحروف للبدء "
  }

  elements.questionText.classList.toggle(
    "is-answer",
    letterliState.answerVisible
  )
}

/* =========================
     CONTROLS
  ========================= */

  if (elements.spinButton) {
  elements.spinButton.disabled =
    controlsDisabled ||
    Boolean(currentQuestion)

  elements.spinButton.textContent =
    letterliState.spinning
      ? "جاري الخلط..."
      : "خلط الحروف"
}

if (elements.changeQuestionButton) {
  elements.changeQuestionButton.disabled =
    controlsDisabled ||
    !currentQuestion ||
    letterliState.answerVisible

  elements.changeQuestionButton.textContent =
    "تغيير السؤال"
}

if (elements.toggleQuestionButton) {
  elements.toggleQuestionButton.disabled =
    controlsDisabled ||
    !currentQuestion ||
    letterliState.questionVisible ||
    letterliState.answerVisible

  elements.toggleQuestionButton.textContent =
    "إظهار السؤال"
}

if (elements.correctButton) {
  elements.correctButton.disabled =
    controlsDisabled ||
    !currentQuestion ||
    letterliState.answerVisible

  elements.correctButton.textContent =
    letterliState.answerVisible
      ? "اختر الفريق"
      : "إظهار الإجابة"
}

  /* =========================
     SCORES
  ========================= */

  const scoreA =
    document.getElementById(
      "letterliScoreA"
    )

  const scoreB =
    document.getElementById(
      "letterliScoreB"
    )

  if (scoreA) {
    scoreA.textContent =
      getLetterliDisplayedScore("A")
  }

  if (scoreB) {
    scoreB.textContent =
      getLetterliDisplayedScore("B")
  }

  if (
    typeof window
      .updateEndRoundButtonState ===
    "function"
  ) {
    window.updateEndRoundButtonState()
  }
}

/* =========================================================
   SCORE
========================================================= */

function getLetterliDisplayedScore(
  team
) {
  if (team === "A") {
    return Number(
      letterliState.scoreA || 0
    )
  }

  if (team === "B") {
    return Number(
      letterliState.scoreB || 0
    )
  }

  return 0
}

function addLetterliPoint(team) {
  if (
    team !== "A" &&
    team !== "B"
  ) {
    return false
  }

  if (team === "A") {
    letterliState.scoreA =
      Number(
        letterliState.scoreA || 0
      ) + 1
  }

  if (team === "B") {
    letterliState.scoreB =
      Number(
        letterliState.scoreB || 0
      ) + 1
  }

  window.currentSegmentScores = {
    A: Number(
      letterliState.scoreA || 0
    ),

    B: Number(
      letterliState.scoreB || 0
    )
  }

  return true
}

/* =========================================================
   EVENTS
========================================================= */

function bindLetterliEvents() {
  const elements =
    getLetterliElements()

  if (
    elements.spinButton &&
    !elements.spinButton.dataset.letterliBound
  ) {
    elements.spinButton.addEventListener(
      "click",
      startLetterliSpin
    )

    elements.spinButton.dataset.letterliBound =
      "true"
  }

  if (
    elements.changeQuestionButton &&
    !elements.changeQuestionButton.dataset.letterliBound
  ) {
    elements.changeQuestionButton.addEventListener(
      "click",
      changeLetterliQuestion
    )

    elements.changeQuestionButton.dataset.letterliBound =
      "true"
  }

  if (
    elements.toggleQuestionButton &&
    !elements.toggleQuestionButton.dataset.letterliBound
  ) {
    elements.toggleQuestionButton.addEventListener(
      "click",
      toggleLetterliQuestion
    )

    elements.toggleQuestionButton.dataset.letterliBound =
      "true"
  }

  if (
    elements.correctButton &&
    !elements.correctButton.dataset.letterliBound
  ) {
    elements.correctButton.addEventListener(
      "click",
      markLetterliCorrectAnswer
    )

    elements.correctButton.dataset.letterliBound =
      "true"
  }

  if (
    elements.timerButton &&
    !elements.timerButton.dataset.letterliBound
  ) {
    elements.timerButton.addEventListener(
      "click",
      startLetterliCountdown
    )

    elements.timerButton.dataset.letterliBound =
      "true"
  }
}

/* =========================================================
   OPEN SEGMENT
========================================================= */

async function openLetterliSegment() {
  stopLetterliSpin()
  loadLetterliState()

  syncLetterliGlobals()

  letterliLoadError = ""

  const teamA =
    typeof window.teamAName !==
    "undefined"
      ? window.teamAName
      : localStorage.getItem(
          "teamAName"
        ) || "الفريق الأول"

  const teamB =
    typeof window.teamBName !==
    "undefined"
      ? window.teamBName
      : localStorage.getItem(
          "teamBName"
        ) || "الفريق الثاني"

  const escapeText =
    typeof window
      .escapeDisplayHtml ===
    "function"
      ? window.escapeDisplayHtml
      : value =>
          String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;")

  openSegment("حرفلي", `
  <div
    class="letterliWrap"
    data-segment-key="letterli"
  >

    <header class="megaHeader">

      <button
        class="dockBtn dockBtnNav"
        type="button"
        onclick="goHome()"
      >
        رجوع
      </button>

      <div
        class="teamMini teamA"
        id="letterliTeamABox"
        onclick="selectLetterliTeam('A')"
      >
        <div class="teamNameBlock">
          <strong>
            ${escapeText(teamA)}
          </strong>
        </div>

        <b id="letterliScoreA">
          ${getLetterliDisplayedScore("A")}
        </b>
      </div>

      <div class="segmentTitlePlain">
        <h1>حرفلي</h1>
      </div>

      <div
        class="teamMini teamB"
        id="letterliTeamBBox"
        onclick="selectLetterliTeam('B')"
      >
        <b id="letterliScoreB">
          ${getLetterliDisplayedScore("B")}
        </b>

        <div class="teamNameBlock">
          <strong>
            ${escapeText(teamB)}
          </strong>
        </div>
      </div>

      <button
        id="endRoundBtn"
        class="dockBtn dockBtnNav"
        type="button"
        onclick="endCurrentSegment()"
      >
        إنهاء
      </button>

    </header>

    <section
      id="letterliQuestionCard"
      class="questionUnifiedCard letterliQuestionUnifiedCard"
    >

      <div class="questionSide">

        <span
          id="letterliQuestionLabel"
          class="questionLabel"
        >
          السؤال
        </span>

        <div class="letterliQuestionContent">

          <div
            id="letterliQuestionText"
            class="questionTextBox letterliQuestionText"
          >
            اضغط خلط الحروف للبدء 
          </div>

        </div>

      </div>

      <div class="timerSide">

        <button
          id="letterliTimerButton"
          class="timerPill letterliTimerButton"
          type="button"
        >
          <strong id="letterliTimer">
            5
          </strong>
        </button>

      </div>

    </section>

    <section class="letterliBigStage">

      <div
        id="letterliCurrentLetter"
        class="letterliBigLetter"
      >
        ؟
      </div>

    </section>

    <footer
  id="letterliActionBar"
  class="actionBar letterliActionBar"
>

      <button
        id="letterliSpinBtn"
        class="actionBtn btnDouble"
        type="button"
      >
        خلط الحروف
      </button>

      <button
        id="letterliChangeQuestionBtn"
        class="actionBtn letterliChangeBtn"
        type="button"
        disabled
      >
        تغيير السؤال
      </button>

      <button
        id="letterliToggleQuestionBtn"
        class="actionBtn btnCorrect"
        type="button"
        disabled
      >
        إظهار السؤال
      </button>

      <button
        id="letterliCorrectBtn"
        class="actionBtn btnWrong"
        type="button"
        disabled
      >
        إظهار الإجابة
      </button>

    </footer>

  </div>
`)

  bindLetterliEvents()
  renderLetterli()

  const loaded =
    await loadLetterliQuestions()

  if (loaded) {
    const currentLetter =
      normalizeLetterliLetter(
        letterliState.currentLetter
      )

    if (currentLetter) {
      const questions =
        getLetterliQuestionsByLetter(
          currentLetter
        )

      const currentIndex =
        Number(
          letterliState
            .currentQuestionIndex
        )

      if (
        !Number.isInteger(
          currentIndex
        ) ||
        !questions[currentIndex]
      ) {
        letterliState.currentQuestionIndex = null
        letterliState.currentQuestion = null

        selectLetterliQuestion(
          currentLetter
        )
      }
    }
  }


  localStorage.setItem(
    "active_segment",
    "letterli"
  )

  saveLetterliState({
    immediate: true
  })

  renderLetterli()

  return true
}

/* =========================================================
   GLOBAL EXPORTS
========================================================= */

window.openLetterliSegment =
  openLetterliSegment

window.loadLetterliQuestions =
  loadLetterliQuestions

window.startLetterliSpin =
  startLetterliSpin

window.changeLetterliQuestion =
  changeLetterliQuestion

window.toggleLetterliQuestion =
  toggleLetterliQuestion

window.markLetterliCorrectAnswer =
  markLetterliCorrectAnswer

window.startLetterliCountdown =
  startLetterliCountdown

window.resetLetterliState =
  resetLetterliState

window.renderLetterli =
  renderLetterli

window.getLetterliCurrentQuestion =
  getLetterliCurrentQuestion

window.getLetterliQuestionsByLetter =
  getLetterliQuestionsByLetter

window.selectLetterliTeam =
  selectLetterliTeam

window.stopLetterliCountdown =
  stopLetterliCountdown

window.getLetterliDisplayedScore =
  getLetterliDisplayedScore

  window.getLetterliTimerRemaining =
  getLetterliTimerRemaining

window.getLetterliTimerSync =
  () => letterliTimerSync

window.syncLetterliGlobals =
  syncLetterliGlobals

/* =========================================================
   INITIAL LOAD
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {
    loadLetterliState()
  }
)