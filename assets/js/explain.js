/* =========================
   Explain Word Segment
========================= */

const EXPLAIN_STORAGE_KEY = "explain_state_v1"
const EXPLAIN_TIMER_SECONDS = 60

let explainTimerLastTick = null
let explainRevealTimeout = null

let explainDoubleState = {
  used: { A: false, B: false },
  activeTeam: null
}

let explainDoublePickMode = false

window.explainState = {
  model: null,
  wordsCount: 4,
  words: [],
  usedNumbers: [],
  currentNumber: null,
  currentWord: "",
  currentTeam: null,
  wordVisible: true,
  timerVisible: false,
  timeLeft: EXPLAIN_TIMER_SECONDS,
  revealLock: false,
  answerResult: null,
  scores: { A: 0, B: 0 },
  attempts: { A: 0, B: 0 },
  wordPoolKey: ""
}

/* =========================
   Helpers
========================= */

function getExplainTeamName(team) {
  return team === "A" ? teamAName : teamBName
}

function getExplainOtherTeam(team) {
  return team === "A" ? "B" : "A"
}

function setExplainActiveTeam(team, options = {}) {
  if (team !== "A" && team !== "B") {
    selectedTeam = null
    window.explainState.currentTeam = null

    if (typeof clearGameActiveTeam === "function") {
      clearGameActiveTeam()
    }

    highlightExplainTeam(null)
    return
  }

  selectedTeam = team
  window.explainState.currentTeam = team

  if (typeof setGameActiveTeam === "function") {
    setGameActiveTeam(team, options)
  }

  highlightExplainTeam(team)
}

function canExplainTeamPlay(team) {
  const other = getExplainOtherTeam(team)

  const teamAttempts = Number(window.explainState.attempts?.[team] || 0)
  const otherAttempts = Number(window.explainState.attempts?.[other] || 0)

  return teamAttempts <= otherAttempts
}

function getExplainWordPoolKey(model, wordsCount, words) {
  return [
    Number(model || 0),
    Number(wordsCount || 4),
    words
      .map(item => `${Number(item.number)}:${String(item.word || "").trim()}`)
      .join("|")
  ].join("__")
}

function normalizeExplainWordsCount(value) {
  const n = Number(value || 4)

  if (n === 8) return 8
  if (n === 6) return 6

  return 4
}

function getExplainConfiguredWordsCount(settingsValue = null) {
  return normalizeExplainWordsCount(
    settingsValue ||
    window.explainWordsCount ||
    localStorage.getItem("explain_words_count") ||
    4
  )
}

function buildExplainWords(rawWords, wordsCount) {
  const wordsMap = {}

  ;(rawWords || []).forEach(row => {
    const number = Number(row.number || 0)
    const word = String(row.word || "").trim()

    if (number >= 1 && number <= wordsCount) {
      wordsMap[number] = word
    }
  })

  return Array.from({ length: wordsCount }, (_, index) => {
    const number = index + 1

    return {
      number,
      word: wordsMap[number] || ""
    }
  })
}

function normalizeExplainDoubleState(state) {
  const clean = state || {
    used: { A: false, B: false },
    activeTeam: null
  }

  if (!clean.used) {
    clean.used = { A: false, B: false }
  }

  clean.used.A = !!clean.used.A
  clean.used.B = !!clean.used.B

  clean.activeTeam =
    clean.activeTeam === "A" || clean.activeTeam === "B"
      ? clean.activeTeam
      : null

  return clean
}

function saveExplainState() {
  try {
    localStorage.setItem(EXPLAIN_STORAGE_KEY, JSON.stringify({
      explainState: window.explainState,
      explainDoubleState
    }))

    localStorage.setItem("active_segment", "explain")

    window.currentSegmentScores = {
      A: Number(window.explainState.scores?.A || 0),
      B: Number(window.explainState.scores?.B || 0)
    }

    if (typeof saveUnifiedGameState === "function") {
      saveUnifiedGameState()
    }

    if (typeof syncDisplayStateToSession === "function") {
      syncDisplayStateToSession()
    }

    if (typeof updateEndRoundButtonState === "function") {
      updateEndRoundButtonState()
    }
  } catch (e) {
    console.log("SAVE EXPLAIN STATE ERROR:", e)
  }
}

function loadExplainState() {
  try {
    const saved = JSON.parse(localStorage.getItem(EXPLAIN_STORAGE_KEY) || "null")

    if (!saved) return null

    if (saved.explainState) {
      return saved
    }

    return {
      explainState: saved,
      explainDoubleState: {
        used: { A: false, B: false },
        activeTeam: null
      }
    }
  } catch {
    return null
  }
}

function resetExplainTimer() {
  clearInterval(timer)
  timer = null
  explainTimerLastTick = null
}

function resetExplainRevealTimeout() {
  clearTimeout(explainRevealTimeout)
  explainRevealTimeout = null
}

function hideExplainTimer() {
  resetExplainTimer()
  window.explainState.timerVisible = false
  window.explainState.timeLeft = EXPLAIN_TIMER_SECONDS
}

function getExplainWordByNumber(number) {
  return (window.explainState.words || []).find(item => {
    return Number(item.number) === Number(number)
  }) || null
}

/* =========================
   Load From Supabase
========================= */

async function loadExplainData() {
  const model = Number(window.currentModel || localStorage.getItem("game_model") || 0)

  if (!model) {
    showGameToast("لم يتم اختيار نموذج")
    return false
  }

  const [settingsRes, wordsRes] = await Promise.all([
    db
      .from("segment_settings")
      .select("item_count")
      .eq("model", model)
      .eq("segment", "explain")
      .maybeSingle(),

    db
      .from("explain_words")
      .select("*")
      .eq("model", model)
      .order("number", { ascending: true })
  ])

  if (settingsRes.error || wordsRes.error) {
    console.log(settingsRes.error || wordsRes.error)
    showGameToast("تعذر تحميل فقرة اشرح الكلمة")
    return false
  }

  const wordsCount = getExplainConfiguredWordsCount(settingsRes.data?.item_count)

  window.explainWordsCount = wordsCount
  localStorage.setItem("explain_words_count", String(wordsCount))

  console.log("EXPLAIN WORDS COUNT:", {
    settings: settingsRes.data?.item_count,
    windowCount: window.explainWordsCount,
    localCount: localStorage.getItem("explain_words_count"),
    finalCount: wordsCount
  })

  const rawWords = (wordsRes.data || [])
    .filter(row => Number(row.number) >= 1 && Number(row.number) <= wordsCount)
    .map(row => ({
      number: Number(row.number),
      word: row.word || ""
    }))

  const wordPoolKey = getExplainWordPoolKey(model, wordsCount, rawWords)
  const saved = loadExplainState()

  const savedExplainState = saved?.explainState || null
  const savedDoubleState = saved?.explainDoubleState || null

  const sameSavedGame =
    Number(savedExplainState?.model || 0) === Number(model) &&
    Number(savedExplainState?.wordsCount || 4) === Number(wordsCount) &&
    savedExplainState?.wordPoolKey === wordPoolKey

  const words = sameSavedGame && Array.isArray(savedExplainState?.words)
    ? savedExplainState.words
    : buildExplainWords(rawWords, wordsCount)

  window.explainState = {
    model,
    wordsCount,
    words,
    usedNumbers: sameSavedGame ? (savedExplainState?.usedNumbers || []) : [],
    currentNumber: sameSavedGame ? (savedExplainState?.currentNumber || null) : null,
    currentWord: sameSavedGame ? (savedExplainState?.currentWord || "") : "",
    currentTeam: sameSavedGame ? (savedExplainState?.currentTeam || null) : null,
    wordVisible: sameSavedGame ? (savedExplainState?.wordVisible !== false) : true,
    timerVisible: sameSavedGame ? !!savedExplainState?.timerVisible : false,
    timeLeft: sameSavedGame
      ? Number(savedExplainState?.timeLeft || EXPLAIN_TIMER_SECONDS)
      : EXPLAIN_TIMER_SECONDS,
    revealLock: false,
    answerResult: null,
    scores: sameSavedGame ? {
      A: Number(savedExplainState?.scores?.A || 0),
      B: Number(savedExplainState?.scores?.B || 0)
    } : { A: 0, B: 0 },
    attempts: sameSavedGame ? {
      A: Number(savedExplainState?.attempts?.A || 0),
      B: Number(savedExplainState?.attempts?.B || 0)
    } : { A: 0, B: 0 },
    wordPoolKey
  }

  explainDoubleState = sameSavedGame
    ? normalizeExplainDoubleState(savedDoubleState)
    : normalizeExplainDoubleState(null)

  explainDoublePickMode = false

  window.currentSegmentScores = {
    A: Number(window.explainState.scores.A || 0),
    B: Number(window.explainState.scores.B || 0)
  }

  if (window.explainState.currentTeam) {
    setExplainActiveTeam(window.explainState.currentTeam, { sync:false })
  } else {
    setExplainActiveTeam(null, { sync:false })
  }

  if (!sameSavedGame) {
    hideExplainTimer()
  }

  saveExplainState()
  return true
}

/* =========================
   Render
========================= */

async function renderExplain() {
  selectedTeam = null
  resetExplainTimer()
  resetExplainRevealTimeout()
  explainDoublePickMode = false

  const loaded = await loadExplainData()
  if (!loaded) return

  openSegment("اشرح الكلمة", buildExplainHtml())

  updateExplainUI()

  if (window.explainState.currentTeam) {
    setExplainActiveTeam(window.explainState.currentTeam, { sync:false })
  }

  updateExplainDoubleButton()
}

window.renderExplain = renderExplain

/* =========================
   HTML
========================= */

function buildExplainHtml() {
  const count = normalizeExplainWordsCount(window.explainState.wordsCount)

  return `
    <div class="explainWrap" data-segment-key="explain">

      <header class="explainHeader">

        <button class="explainDockBtn" type="button" onclick="goHome()">
          رجوع
        </button>

        <button
          type="button"
          id="explainTeamABox"
          class="explainTeamMini teamA ${window.explainState.currentTeam === "A" ? "explainTeamCurrent" : ""}"
          data-team="A"
          onclick="selectExplainTeam('A')"
        >
          <div class="explainTeamName">
            <strong>${escapeDisplayHtml(teamAName || "الفريق الأول")}</strong>
          </div>

          <b id="explainScoreA">${window.explainState.scores.A}</b>
        </button>

        <div class="explainTitle">
          <h1>اشرح الكلمة</h1>
        </div>

        <button
          type="button"
          id="explainTeamBBox"
          class="explainTeamMini teamB ${window.explainState.currentTeam === "B" ? "explainTeamCurrent" : ""}"
          data-team="B"
          onclick="selectExplainTeam('B')"
        >
          <b id="explainScoreB">${window.explainState.scores.B}</b>

          <div class="explainTeamName">
            <strong>${escapeDisplayHtml(teamBName || "الفريق الثاني")}</strong>
          </div>
        </button>

        <button
          id="endRoundBtn"
          class="explainDockBtn"
          type="button"
          onclick="endCurrentSegment()"
          disabled
        >
          إنهاء
        </button>

      </header>

      <section class="explainMainStage">

        <div
          id="explainWordBox"
          class="explainWordBox"
          onclick="hideExplainWord()"
        ></div>

        <div id="explainTimerBox" class="explainTimerBox hidden">
          ${EXPLAIN_TIMER_SECONDS}
        </div>

      </section>

      <section class="explainNumbersGrid">
        ${Array.from({ length: count }, (_, idx) => {
          const number = idx + 1
          const used = window.explainState.usedNumbers.includes(number)

          return `
            <button
              type="button"
              id="explainNumber_${number}"
              class="explainNumberCard ${used ? "used" : ""}"
              onclick="openExplainNumber(${number})"
              ${used ? "disabled" : ""}
            >
              <span>${number}</span>
            </button>
          `
        }).join("")}
      </section>

      <footer class="explainActionBar">

        <button
          type="button"
          id="explainDoubleBtn"
          class="explainActionBtn explainDoubleBtn"
          onclick="activateExplainDouble()"
        >
          دبل
        </button>

        <button
          type="button"
          class="explainActionBtn explainStartBtn"
          onclick="startExplainTimer()"
        >
          بدء المؤقت
        </button>

        <button
          type="button"
          class="explainActionBtn explainCorrectBtn"
          onclick="correctExplainAnswer()"
        >
          صح
        </button>

        <button
          type="button"
          class="explainActionBtn explainWrongBtn"
          onclick="wrongExplainAnswer()"
        >
          خطأ
        </button>

      </footer>

    </div>
  `
}

/* =========================
   UI Update
========================= */

function highlightExplainTeam(team) {
  const shell = document.querySelector(".explainWrap")
  if (!shell) return

  const a = shell.querySelector("#explainTeamABox")
  const b = shell.querySelector("#explainTeamBBox")

  if (a) {
    a.classList.remove(
      "activeTeam",
      "selectedPresenterTeam",
      "finalTurnActiveTeam",
      "explainTeamCurrent"
    )
  }

  if (b) {
    b.classList.remove(
      "activeTeam",
      "selectedPresenterTeam",
      "finalTurnActiveTeam",
      "explainTeamCurrent"
    )
  }

  if (team === "A" && a) {
    a.classList.add("explainTeamCurrent")
  }

  if (team === "B" && b) {
    b.classList.add("explainTeamCurrent")
  }
}

function updateExplainUI() {
  const scoreAEl = document.getElementById("explainScoreA")
  const scoreBEl = document.getElementById("explainScoreB")
  const wordBox = document.getElementById("explainWordBox")
  const timerBox = document.getElementById("explainTimerBox")

  if (scoreAEl) {
    scoreAEl.innerText = Number(window.explainState.scores.A || 0)
  }

  if (scoreBEl) {
    scoreBEl.innerText = Number(window.explainState.scores.B || 0)
  }

  const explainActiveTeam =
    window.explainState.currentTeam ||
    selectedTeam ||
    null

  highlightExplainTeam(explainActiveTeam)

  if (wordBox) {
    const hasWord = !!window.explainState.currentNumber
    const hiddenWord = hasWord && !window.explainState.wordVisible

    wordBox.classList.toggle("hasWord", hasWord)
    wordBox.classList.toggle("hiddenWord", hiddenWord)
    wordBox.classList.toggle("emptyWord", !hasWord)
    wordBox.classList.toggle("wordBoxInvisible", hiddenWord)
    wordBox.classList.toggle(
      "danger",
      hiddenWord &&
      window.explainState.timerVisible &&
      Number(window.explainState.timeLeft ?? EXPLAIN_TIMER_SECONDS) <= 5
    )

    wordBox.classList.toggle("answerCorrect", window.explainState.answerResult === "correct")
    wordBox.classList.toggle("answerWrong", window.explainState.answerResult === "wrong")

    if (!hasWord) {
      wordBox.innerText = ""
    } else if (hiddenWord && window.explainState.timerVisible) {
      wordBox.innerText = Number(window.explainState.timeLeft ?? EXPLAIN_TIMER_SECONDS)
    } else if (hiddenWord) {
      wordBox.innerText = ""
    } else {
      wordBox.innerText = window.explainState.currentWord || ""
    }
  }

  if (timerBox) {
    const timeLeft = Number(window.explainState.timeLeft ?? EXPLAIN_TIMER_SECONDS)

    timerBox.innerText = timeLeft
    timerBox.classList.add("hidden")
    timerBox.classList.toggle("danger", timeLeft <= 5)
  }

  for (let i = 1; i <= normalizeExplainWordsCount(window.explainState.wordsCount); i++) {
    const btn = document.getElementById(`explainNumber_${i}`)
    if (!btn) continue

    const used = window.explainState.usedNumbers.includes(i)
    const active = Number(window.explainState.currentNumber) === i

    btn.classList.toggle("used", used)
    btn.classList.toggle("active", active)

    btn.disabled =
      used ||
      !!window.explainState.currentNumber ||
      !!window.explainState.revealLock
  }

  updateExplainDoubleButton()
  saveExplainState()
}

/* =========================
   Double
   نفس نظام فتبلة القديم
========================= */

function activateExplainDouble() {
  if (window.explainState.currentNumber || window.explainState.revealLock) {
    showGameToast("الدبل قبل اختيار الرقم فقط")
    return
  }

  if (explainDoubleState.used.A && explainDoubleState.used.B) {
    showGameToast("تم استخدام الدبل من الفريقين")
    return
  }

  explainDoublePickMode = true
  showGameToast("اختر الفريق لتفعيل الدبل")
  updateExplainDoubleButton()
  saveExplainState()
}

function getExplainScoreValue(team) {
  return explainDoubleState.activeTeam === team ? 2 : 1
}

function clearExplainActiveDouble(team) {
  if (explainDoubleState.activeTeam === team) {
    explainDoubleState.activeTeam = null
  }

  explainDoublePickMode = false
}

function updateExplainDoubleButton() {
  const btn = document.getElementById("explainDoubleBtn")
  if (!btn) return

  const team = window.explainState.currentTeam

  btn.classList.remove("activeDouble")

  if (explainDoublePickMode) {
    btn.disabled = false
    btn.innerText = "اختر الفريق"
    btn.classList.add("activeDouble")
    return
  }

  if (window.explainState.currentNumber || window.explainState.revealLock) {
    btn.disabled = true
    btn.innerText = "دبل"
    return
  }

  if (explainDoubleState.used.A && explainDoubleState.used.B) {
    btn.disabled = true
    btn.innerText = "الدبل مقفل"
    return
  }

  if (team && explainDoubleState.activeTeam === team) {
    btn.disabled = true
    btn.innerText = "الدبل مفعّل"
    btn.classList.add("activeDouble")
    return
  }

  if (team && explainDoubleState.used[team]) {
    btn.disabled = true
    btn.innerText = "استخدم الدبل"
    return
  }

  btn.disabled = false
  btn.innerText = "دبل"
}

/* =========================
   Team / Number
========================= */

function selectExplainTeam(team) {
  if (window.explainState.revealLock) return
  if (team !== "A" && team !== "B") return

  if (explainDoublePickMode) {
    if (window.explainState.currentNumber) {
      showGameToast("الدبل قبل اختيار الرقم فقط")
      explainDoublePickMode = false
      updateExplainDoubleButton()
      saveExplainState()
      return
    }

    if (explainDoubleState.used[team]) {
      showGameToast("هذا الفريق استخدم الدبل مسبقًا")
      return
    }

    setExplainActiveTeam(team)

    explainDoubleState.used[team] = true
    explainDoubleState.activeTeam = team
    explainDoublePickMode = false

    showGameToast(`تم تفعيل الدبل لفريق ${getExplainTeamName(team)}`)

    updateExplainUI()
    updateExplainDoubleButton()
    saveExplainState()
    return
  }

  if (window.explainState.currentNumber) {
    showGameToast("أنهِ الكلمة الحالية أولاً")
    return
  }

  const gameStarted =
    Array.isArray(window.explainState.usedNumbers) &&
    window.explainState.usedNumbers.length > 0

  if (gameStarted) {
    showGameToast("الدور ينتقل تلقائيًا")
    return
  }

  setExplainActiveTeam(team)

  updateExplainUI()
  updateExplainDoubleButton()
  saveExplainState()
}

function openExplainNumber(number) {
  unlockAudioContext()

  if (window.explainState.revealLock) return

  const n = Number(number || 0)
  const activeTeam = selectedTeam || window.explainState.currentTeam

  if (!activeTeam) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  if (!canExplainTeamPlay(activeTeam)) {
    const other = getExplainOtherTeam(activeTeam)
    showGameToast(`الدور الآن لـ ${getExplainTeamName(other)}`)
    return
  }

  if (window.explainState.usedNumbers.includes(n)) {
    showGameToast("هذا الرقم مستخدم")
    return
  }

  const item = getExplainWordByNumber(n)

  if (!item || !String(item.word || "").trim()) {
    showGameToast("لا توجد كلمة محفوظة لهذا الرقم")
    return
  }

  resetExplainTimer()
  resetExplainRevealTimeout()

  window.explainState.currentNumber = n
  window.explainState.currentWord = item.word

  setExplainActiveTeam(activeTeam)

  window.explainState.wordVisible = true
  window.explainState.timerVisible = false
  window.explainState.timeLeft = EXPLAIN_TIMER_SECONDS

  playGameSound("open")
  updateExplainUI()
}

function hideExplainWord() {
  if (!window.explainState.currentNumber) return
  if (window.explainState.revealLock) return

  window.explainState.wordVisible = !window.explainState.wordVisible

  playGameSound("answer")
  updateExplainUI()
}

/* =========================
   Timer
========================= */

function startExplainTimer() {
  unlockAudioContext()

  if (window.explainState.revealLock) return

  if (!window.explainState.currentNumber) {
    showGameToast("اختر رقم أولاً")
    return
  }

  resetExplainTimer()

  window.explainState.timerVisible = true
  window.explainState.wordVisible = false
  window.explainState.timeLeft = EXPLAIN_TIMER_SECONDS
  explainTimerLastTick = null

  updateExplainUI()
  saveExplainState()

  timer = setInterval(() => {
    window.explainState.timeLeft =
      Number(window.explainState.timeLeft || 0) - 1

    if (
      window.explainState.timeLeft > 0 &&
      window.explainState.timeLeft <= 5 &&
      explainTimerLastTick !== window.explainState.timeLeft
    ) {
      explainTimerLastTick = window.explainState.timeLeft
      playGameSound("tick")
    }

    if (window.explainState.timeLeft <= 0) {
      window.explainState.timeLeft = 0
      window.explainState.timerVisible = false

      resetExplainTimer()
      playGameSound("timeout")
    }

    updateExplainUI()
    saveExplainState()
  }, 1000)
}

/* =========================
   Scoring
========================= */

function finishExplainNumber(isCorrect) {
  unlockAudioContext()

  if (window.explainState.revealLock) return

  const activeTeam = window.explainState.currentTeam || selectedTeam

  if (!activeTeam) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  const n = Number(window.explainState.currentNumber || 0)

  if (!n) {
    showGameToast("اختر رقم أولاً")
    return
  }

  if (window.explainState.usedNumbers.includes(n)) {
    showGameToast("هذا الرقم محسوب مسبقاً")
    return
  }

  resetExplainTimer()
  resetExplainRevealTimeout()

  window.explainState.timerVisible = false
  window.explainState.wordVisible = true
  window.explainState.revealLock = true
  window.explainState.answerResult = isCorrect ? "correct" : "wrong"

  if (isCorrect) {
    const points = getExplainScoreValue(activeTeam)

    window.explainState.scores[activeTeam] =
      Number(window.explainState.scores[activeTeam] || 0) + points

    playGameSound("correct")
    flashScreen("correct")
  } else {
    playGameSound("wrong")
    flashScreen("wrong")
  }

  clearExplainActiveDouble(activeTeam)

  window.explainState.attempts[activeTeam] =
    Number(window.explainState.attempts[activeTeam] || 0) + 1

  window.explainState.usedNumbers.push(n)

  window.currentSegmentScores = {
    A: Number(window.explainState.scores.A || 0),
    B: Number(window.explainState.scores.B || 0)
  }

  updateExplainUI()
  saveExplainState()

  explainRevealTimeout = setTimeout(() => {
    const allDone =
      window.explainState.usedNumbers.length >=
      normalizeExplainWordsCount(window.explainState.wordsCount)

    const nextTeam = allDone ? null : getExplainOtherTeam(activeTeam)

    window.explainState.currentNumber = null
    window.explainState.currentWord = ""

    if (nextTeam) {
      setExplainActiveTeam(nextTeam)
    } else {
      setExplainActiveTeam(null)
    }

    window.explainState.wordVisible = true
    window.explainState.timerVisible = false
    window.explainState.timeLeft = EXPLAIN_TIMER_SECONDS
    window.explainState.revealLock = false
    window.explainState.answerResult = null

    updateExplainUI()
    updateExplainDoubleButton()
    saveExplainState()
  }, 5000)
}

function correctExplainAnswer() {
  finishExplainNumber(true)
}

function wrongExplainAnswer() {
  finishExplainNumber(false)
}

window.activateExplainDouble = activateExplainDouble
window.selectExplainTeam = selectExplainTeam
window.openExplainNumber = openExplainNumber
window.hideExplainWord = hideExplainWord
window.startExplainTimer = startExplainTimer
window.correctExplainAnswer = correctExplainAnswer
window.wrongExplainAnswer = wrongExplainAnswer