/* =========================
   Explain Word Segment
========================= */

const EXPLAIN_STORAGE_KEY = "explain_state_v1"

let explainTimerLastTick = null
let explainRevealTimeout = null

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
  timeLeft: 45,
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

function saveExplainState() {
  try {
    localStorage.setItem(EXPLAIN_STORAGE_KEY, JSON.stringify(window.explainState))
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
    return JSON.parse(localStorage.getItem(EXPLAIN_STORAGE_KEY) || "null")
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
  window.explainState.timeLeft = 45
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

  const countFromSettings = Number(
    settingsRes.data?.item_count ||
    window.explainWordsCount ||
    localStorage.getItem("explain_words_count") ||
    4
  )

  const wordsCount =
    countFromSettings === 8 ? 8 :
    countFromSettings === 6 ? 6 :
    4

  window.explainWordsCount = wordsCount
  localStorage.setItem("explain_words_count", String(wordsCount))

  const rawWords = (wordsRes.data || [])
    .filter(row => Number(row.number) >= 1 && Number(row.number) <= wordsCount)
    .map(row => ({
      number: Number(row.number),
      word: row.word || ""
    }))

  const wordPoolKey = getExplainWordPoolKey(model, wordsCount, rawWords)
  const saved = loadExplainState()

  const sameSavedGame =
    Number(saved?.model || 0) === Number(model) &&
    Number(saved?.wordsCount || 4) === Number(wordsCount) &&
    saved?.wordPoolKey === wordPoolKey

  const words = sameSavedGame && Array.isArray(saved?.words)
  ? saved.words
  : buildExplainWords(rawWords, wordsCount)

  window.explainState = {
    model,
    wordsCount,
    words,
    usedNumbers: sameSavedGame ? (saved?.usedNumbers || []) : [],
    currentNumber: sameSavedGame ? (saved?.currentNumber || null) : null,
    currentWord: sameSavedGame ? (saved?.currentWord || "") : "",
    currentTeam: sameSavedGame ? (saved?.currentTeam || null) : null,
    wordVisible: sameSavedGame ? (saved?.wordVisible !== false) : true,
    timerVisible: sameSavedGame ? !!saved?.timerVisible : false,
    timeLeft: sameSavedGame ? Number(saved?.timeLeft || 45) : 45,
    revealLock: false,
    answerResult: null,
    scores: sameSavedGame ? {
      A: Number(saved?.scores?.A || 0),
      B: Number(saved?.scores?.B || 0)
    } : { A: 0, B: 0 },
    attempts: sameSavedGame ? {
      A: Number(saved?.attempts?.A || 0),
      B: Number(saved?.attempts?.B || 0)
    } : { A: 0, B: 0 },
    wordPoolKey
  }

  window.currentSegmentScores = {
    A: Number(window.explainState.scores.A || 0),
    B: Number(window.explainState.scores.B || 0)
  }

  hideExplainTimer()
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

  const loaded = await loadExplainData()
  if (!loaded) return

  openSegment("اشرح الكلمة", buildExplainHtml())

  updateExplainUI()
}

window.renderExplain = renderExplain

function buildExplainHtml() {
  const rawCount = Number(window.explainState.wordsCount || 4)

const count =
  rawCount === 8 ? 8 :
  rawCount === 6 ? 6 :
  4

  return `
    <div class="explainGameShell">

      <div class="explainTopBoard">
        <button
          type="button"
          id="explainTeamABox"
          class="explainTeamBox"
          onclick="selectExplainTeam('A')"
        >
          <span class="explainTeamLabel">${escapeDisplayHtml(teamAName)}</span>
          <strong id="explainScoreA">${window.explainState.scores.A}</strong>
          <small id="explainAttemptsA">0</small>
        </button>

        <div class="explainCenterTitle">
          
          <h3> </h3>
        </div>
 
        <button
          type="button"
          id="explainTeamBBox"
          class="explainTeamBox"
          onclick="selectExplainTeam('B')"
        >
          <span class="explainTeamLabel">${escapeDisplayHtml(teamBName)}</span>
          <strong id="explainScoreB">${window.explainState.scores.B}</strong>
          <small id="explainAttemptsB">0</small>
        </button>
      </div>

      <div class="explainNumbersGrid">
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
      </div>

      <div class="explainMainStage">
        <div
          id="explainWordBox"
          class="explainWordBox"
          onclick="hideExplainWord()"
        ></div>

        <div id="explainTimerBox" class="explainTimerBox hidden">
          45
        </div>
      </div>

      <div class="explainControls">
        <button
          type="button"
          class="explainControlBtn explainStartBtn"
          onclick="startExplainTimer()"
        >
          بدء المؤقت
        </button>

        <button
          type="button"
          class="explainControlBtn explainCorrectBtn"
          onclick="correctExplainAnswer()"
        >
          صح
        </button>

        <button
          type="button"
          class="explainControlBtn explainWrongBtn"
          onclick="wrongExplainAnswer()"
        >
          خطأ
        </button>
      </div>

    </div>
  `
}

/* =========================
   UI Update
========================= */

function getExplainTeamBox(team) {
  const letter = team === "A" ? "A" : "B"

  return (
    document.getElementById(`team${letter}Box`) ||
    document.getElementById(`explainTeam${letter}Box`) ||
    document.querySelector(`[onclick="selectExplainTeam('${letter}')"]`) ||
    document.querySelector(`[onclick='selectExplainTeam("${letter}")']`) ||
    document.querySelector(`[data-team="${letter}"]`) ||
    document.querySelector(`.explainTeamBox.team${letter}`) ||
    document.querySelector(`.explainTeamCard.team${letter}`)
  )
}

function highlightExplainTeam(team) {
  const shell = document.querySelector(".explainGameShell")
  if (!shell) return

  const a = shell.querySelector("#explainTeamABox")
  const b = shell.querySelector("#explainTeamBBox")

  if (a) {
    a.classList.remove("activeTeam", "selectedPresenterTeam", "finalTurnActiveTeam", "explainTeamCurrent")
  }

  if (b) {
    b.classList.remove("activeTeam", "selectedPresenterTeam", "finalTurnActiveTeam", "explainTeamCurrent")
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
  const attemptsAEl = document.getElementById("explainAttemptsA")
  const attemptsBEl = document.getElementById("explainAttemptsB")
  const wordBox = document.getElementById("explainWordBox")
  const timerBox = document.getElementById("explainTimerBox")

  if (scoreAEl) scoreAEl.innerText = Number(window.explainState.scores.A || 0)
  if (scoreBEl) scoreBEl.innerText = Number(window.explainState.scores.B || 0)

  if (attemptsAEl) attemptsAEl.innerText = Number(window.explainState.attempts.A || 0)
  if (attemptsBEl) attemptsBEl.innerText = Number(window.explainState.attempts.B || 0)

  const explainActiveTeam =
  window.explainState.currentTeam ||
  selectedTeam ||
  null

highlightExplainTeam(explainActiveTeam)

  const centerTitle = document.querySelector(".explainCenterTitle h3")

  if (centerTitle) {
  const team =
    window.explainState.currentTeam ||
    selectedTeam ||
    null

  const teamName =
    team === "A"
      ? getExplainTeamName("A")
      : team === "B"
        ? getExplainTeamName("B")
        : ""

  centerTitle.innerHTML = `
    <div class="explainCenterTurnTeamName">
      ${teamName}
    </div>
  `
}

  if (wordBox) {
    const hasWord = !!window.explainState.currentNumber
    const hiddenWord = hasWord && !window.explainState.wordVisible

    wordBox.classList.toggle("hasWord", hasWord)
    wordBox.classList.toggle("hiddenWord", hiddenWord)
    wordBox.classList.toggle("emptyWord", !hasWord)
    wordBox.classList.toggle("wordBoxInvisible", hiddenWord)

    wordBox.classList.toggle("answerCorrect", window.explainState.answerResult === "correct")
    wordBox.classList.toggle("answerWrong", window.explainState.answerResult === "wrong")

    if (!hasWord) {
      wordBox.innerText = ""
    } else if (hiddenWord) {
      wordBox.innerText = ""
    } else {
      wordBox.innerText = window.explainState.currentWord || ""
    }
  }

  if (timerBox) {
    timerBox.innerText = Number(window.explainState.timeLeft || 45)
    timerBox.classList.toggle("hidden", !window.explainState.timerVisible)
    timerBox.classList.toggle("danger", Number(window.explainState.timeLeft || 45) <= 5)
  }

  for (let i = 1; i <= Number(window.explainState.wordsCount || 4); i++) {
    const btn = document.getElementById(`explainNumber_${i}`)
    if (!btn) continue

    const used = window.explainState.usedNumbers.includes(i)
    const active = Number(window.explainState.currentNumber) === i

    btn.classList.toggle("used", used)
    btn.classList.toggle("active", active)
    btn.disabled = used || !!window.explainState.currentNumber || !!window.explainState.revealLock
  }

  saveExplainState()
}
/* =========================
   Team / Number
========================= */

function selectExplainTeam(team) {
  if (window.explainState.revealLock) return

  if (window.explainState.currentNumber) {
    showGameToast("أنهِ الكلمة الحالية أولاً")
    return
  }

  if (!canExplainTeamPlay(team)) {
    const other = getExplainOtherTeam(team)
    showGameToast(`الدور الآن لـ ${getExplainTeamName(other)}`)
    return
  }

  selectedTeam = team
  window.explainState.currentTeam = team

  highlightExplainTeam(team)

  const centerTitle = document.querySelector(".explainCenterTitle h3")
  if (centerTitle) {
    centerTitle.innerHTML = `
      <div class="explainCenterTurnTeamName">
        ${getExplainTeamName(team)}
      </div>
    `
  }

  updateExplainUI()
  saveExplainState()

  setTimeout(() => {
    selectedTeam = team
    window.explainState.currentTeam = team
    highlightExplainTeam(team)
    updateExplainUI()
  }, 80)
}

function openExplainNumber(number) {
  unlockAudioContext()

  if (window.explainState.revealLock) return

  const n = Number(number || 0)

  if (!selectedTeam) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  if (!canExplainTeamPlay(selectedTeam)) {
    const other = getExplainOtherTeam(selectedTeam)
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
  window.explainState.currentTeam = selectedTeam
  window.explainState.wordVisible = true
  window.explainState.timerVisible = false
  window.explainState.timeLeft = 45

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
  window.explainState.timeLeft = 45
  explainTimerLastTick = null

updateExplainUI()

  timer = setInterval(() => {
    window.explainState.timeLeft = Number(window.explainState.timeLeft || 0) - 1

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
    window.explainState.scores[activeTeam] =
      Number(window.explainState.scores[activeTeam] || 0) + 1

    playGameSound("correct")
    flashScreen("correct")
  } else {
    playGameSound("wrong")
    flashScreen("wrong")
  }

  window.explainState.attempts[activeTeam] =
    Number(window.explainState.attempts[activeTeam] || 0) + 1

  window.explainState.usedNumbers.push(n)

  window.currentSegmentScores = {
    A: Number(window.explainState.scores.A || 0),
    B: Number(window.explainState.scores.B || 0)
  }

  updateExplainUI()

  explainRevealTimeout = setTimeout(() => {
    window.explainState.currentNumber = null
    window.explainState.currentWord = ""
    window.explainState.currentTeam = null
    window.explainState.wordVisible = true
    window.explainState.timerVisible = false
    window.explainState.timeLeft = 45
    window.explainState.revealLock = false
window.explainState.answerResult = null

    selectedTeam = null

    updateExplainUI()
  }, 5000)
}

function correctExplainAnswer() {
  finishExplainNumber(true)
}

function wrongExplainAnswer() {
  finishExplainNumber(false)
}