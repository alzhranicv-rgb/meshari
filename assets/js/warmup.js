let usedQuestions = {}
window.usedQuestions = usedQuestions

let warmupScoreA = 0
let warmupScoreB = 0
let lastAnsweredTeam = null
let warmupManualSelectionDone = false
let currentWarmupButton = null
let warmupQuestionLocked = false
let currentWarmupQuestionKey = null
let warmupLastTickPlayed = null

const WARMUP_STORAGE_KEY = "warmup_state_v1"

/* =========================
   Warmup Persistence
========================= */

function getWarmupState() {
  try {
    return JSON.parse(localStorage.getItem(WARMUP_STORAGE_KEY) || "null")
  } catch {
    return null
  }
}

function saveWarmupState() {
  const questionBox = document.getElementById("questionBox")
  const timerBox = document.getElementById("timer")

  const state = {
    usedQuestions,
    warmupScoreA,
    warmupScoreB,
    lastAnsweredTeam,
    warmupManualSelectionDone,
    warmupQuestionLocked,
    currentWarmupQuestionKey,
    selectedTeam,
    currentPoints,
    currentAnswer: window.currentAnswer || "",
    questionText: questionBox ? questionBox.innerText : "اختر رقم السؤال",
    timerValue: timerBox ? Number(timerBox.innerText || 0) : 0
  }

  localStorage.setItem(WARMUP_STORAGE_KEY, JSON.stringify(state))
  localStorage.setItem("active_segment", "warmup")
}

function clearWarmupState() {
  localStorage.removeItem(WARMUP_STORAGE_KEY)
  localStorage.removeItem("active_segment")
}

function restoreWarmupButtonStates() {
  Object.keys(usedQuestions || {}).forEach(key => {
    if (!usedQuestions[key]) return
    const [cat, num] = key.split("_")
    const btn = document.getElementById(`q${cat}_${num}`)
    if (btn) {
      btn.disabled = true
      btn.classList.add("warmupUsedBtn")
    }
  })
}

function restoreWarmupUIFromState(saved) {
  if (!saved) return

  usedQuestions = saved.usedQuestions || {}
  window.usedQuestions = usedQuestions

  warmupScoreA = Number(saved.warmupScoreA || 0)
  warmupScoreB = Number(saved.warmupScoreB || 0)
  lastAnsweredTeam = saved.lastAnsweredTeam || null
  warmupManualSelectionDone = !!saved.warmupManualSelectionDone
  warmupQuestionLocked = !!saved.warmupQuestionLocked
  currentWarmupQuestionKey = saved.currentWarmupQuestionKey || null
  selectedTeam = saved.selectedTeam || null
  currentPoints = Number(saved.currentPoints || 0)
  window.currentAnswer = saved.currentAnswer || ""

  const scoreABox = document.getElementById("roundScoreA")
  const scoreBBox = document.getElementById("roundScoreB")
  const questionBox = document.getElementById("questionBox")
  const timerBox = document.getElementById("timer")

  if (scoreABox) scoreABox.innerText = warmupScoreA
  if (scoreBBox) scoreBBox.innerText = warmupScoreB
  if (questionBox) questionBox.innerText = saved.questionText || "اختر رقم السؤال"
  if (timerBox) timerBox.innerText = Number(saved.timerValue || 0)

  if (selectedTeam) highlightWarmupSelectedTeam(selectedTeam)
  restoreWarmupButtonStates()

  if (currentWarmupQuestionKey) {
    const [cat, num] = currentWarmupQuestionKey.split("_")
    const btn = document.getElementById(`q${cat}_${num}`)
    if (btn) highlightWarmupSelectedButton(btn)
  }

  window.currentSegmentScores = {
    A: warmupScoreA,
    B: warmupScoreB
  }

  const restoredTime = Number(saved.timerValue || 0)
  if (warmupQuestionLocked && restoredTime > 0) {
    resumeWarmupTimer(restoredTime)
  }
}

/* =========================
   Render
========================= */

window.renderWarmup = async function () {
  const saved = getWarmupState()

  usedQuestions = {}
  window.usedQuestions = usedQuestions

  warmupScoreA = 0
  warmupScoreB = 0
  currentPoints = 0
  window.currentAnswer = ""
  selectedTeam = null
  lastAnsweredTeam = null
  warmupManualSelectionDone = false
  currentWarmupButton = null
  warmupQuestionLocked = false
  currentWarmupQuestionKey = null
  warmupLastTickPlayed = null

  const categories = await loadWarmupCategories()

  openSegment("التسخين", `
    <div class="warmupWrap">

      <div class="warmupTopBar">

        <div class="warmupTeamCard" onclick="selectWarmupTeam('A')" id="warmupTeamABox">
          <div class="warmupTeamName">${teamAName}</div>
          <div class="warmupTeamScore" id="roundScoreA">${warmupScoreA}</div>
        </div>

        <div class="warmupTimerBox">
          <div class="warmupTimerLabel">المؤقت</div>
          <div class="warmupTimerValue" id="timer">0</div>
        </div>

        <div class="warmupTeamCard" onclick="selectWarmupTeam('B')" id="warmupTeamBBox">
          <div class="warmupTeamName">${teamBName}</div>
          <div class="warmupTeamScore" id="roundScoreB">${warmupScoreB}</div>
        </div>

      </div>

      <div id="questionBox" class="warmupQuestionBox">
        اختر رقم السؤال
      </div>

      <div class="warmupControlPanel">
        <button onclick="showWarmupAnswer()" class="btnAnswer">إظهار الإجابة</button>
        <button onclick="warmupWrong()" class="btnWrong">✕ خطأ</button>
        <button onclick="warmupCorrect()" class="btnCorrect">✓ صح</button>
      </div>

      <div class="warmupGrid">
        ${createWarmupCategory(1, categories[1] || "الفئة 1")}
        ${createWarmupCategory(2, categories[2] || "الفئة 2")}
        ${createWarmupCategory(3, categories[3] || "الفئة 3")}
        ${createWarmupCategory(4, categories[4] || "الفئة 4")}
      </div>

    </div>
  `)

  window.currentSegmentScores = {
    A: warmupScoreA,
    B: warmupScoreB
  }

  if (saved) {
    restoreWarmupUIFromState(saved)
  } else {
    saveWarmupState()
  }
}

async function loadWarmupCategories() {
  const { data, error } = await db
    .from("questions")
    .select("category, category_name")
    .eq("model", Number(currentModel))
    .eq("segment", "warmup")
    .order("category", { ascending: true })

  if (error) {
    console.log("loadWarmupCategories error =", error)
    return {}
  }

  const categories = {}

  ;(data || []).forEach(row => {
    if (row.category) {
      categories[Number(row.category)] = row.category_name || `الفئة ${row.category}`
    }
  })

  return categories
}

function createWarmupCategory(num, name) {
  return `
    <div class="warmupCategoryCard">
      <div class="warmupCategoryTitle">${name}</div>

      <div class="warmupNumbersRow">
        <button id="q${num}_1" onclick="openWarmupQuestion(${num},1)" class="warmupNumberBtn">1</button>
        <button id="q${num}_2" onclick="openWarmupQuestion(${num},2)" class="warmupNumberBtn">2</button>
        <button id="q${num}_4" onclick="openWarmupQuestion(${num},4)" class="warmupNumberBtn">4</button>
      </div>
    </div>
  `
}

/* =========================
   Team UI
========================= */

function highlightWarmupSelectedTeam(team) {
  const a = document.getElementById("warmupTeamABox")
  const b = document.getElementById("warmupTeamBBox")

  if (a) {
    a.classList.remove("activeTeam")
    a.style.border = "2px solid var(--border-soft)"
    a.style.boxShadow = "var(--shadow-soft)"
  }

  if (b) {
    b.classList.remove("activeTeam")
    b.style.border = "2px solid var(--border-soft)"
    b.style.boxShadow = "var(--shadow-soft)"
  }

  if (team === "A" && a) {
    a.classList.add("activeTeam")
    a.style.border = "3px solid #000"
    a.style.boxShadow = "0 0 0 4px rgba(0,0,0,.12), var(--shadow-soft)"
  }

  if (team === "B" && b) {
    b.classList.add("activeTeam")
    b.style.border = "3px solid #000"
    b.style.boxShadow = "0 0 0 4px rgba(0,0,0,.12), var(--shadow-soft)"
  }
}

function clearWarmupSelectedButton() {
  if (!currentWarmupButton) return
  currentWarmupButton.style.outline = "none"
  currentWarmupButton.style.outlineOffset = "0"
  currentWarmupButton = null
}

function highlightWarmupSelectedButton(button) {
  clearWarmupSelectedButton()
  if (!button) return

  currentWarmupButton = button
  button.style.outline = "3px solid #000"
  button.style.outlineOffset = "0"
}

function getNextWarmupTeam() {
  if (lastAnsweredTeam === "A") return "B"
  if (lastAnsweredTeam === "B") return "A"
  return null
}

function selectWarmupTeam(team) {
  if (warmupManualSelectionDone && team !== selectedTeam) {
    showGameToast("بعد البداية الأولى يتحدد الدور تلقائيًا")
    return
  }

  if (lastAnsweredTeam === team) {
    showGameToast("لا يمكن لنفس الفريق اللعب مرتين متتاليتين")
    return
  }

  selectedTeam = team
  warmupManualSelectionDone = true
  highlightWarmupSelectedTeam(team)
  saveWarmupState()
}

/* =========================
   Questions
========================= */

async function openWarmupQuestion(category, number) {
  if (warmupQuestionLocked) {
    showGameToast("سجل النتيجة أولاً")
    return
  }

  if (!selectedTeam) {
    if (!warmupManualSelectionDone) {
      showGameToast("اختر الفريق أولاً")
      return
    }

    const autoTeam = getNextWarmupTeam()

    if (!autoTeam) {
      showGameToast("اختر الفريق أولاً")
      return
    }

    selectedTeam = autoTeam
    highlightWarmupSelectedTeam(autoTeam)
  }

  const key = `${category}_${number}`

  if (usedQuestions[key]) return

  const btn = document.getElementById(`q${category}_${number}`)
  if (btn) {
    highlightWarmupSelectedButton(btn)
    btn.disabled = true
    btn.classList.add("warmupUsedBtn")
  }

  const { data, error } = await db
    .from("questions")
    .select("question, answer")
    .eq("model", Number(currentModel))
    .eq("segment", "warmup")
    .eq("category", Number(category))
    .eq("number", Number(number))
    .limit(1)

  if (error) {
    console.log("openWarmupQuestion error =", error)

    if (btn) {
      btn.disabled = false
      btn.classList.remove("warmupUsedBtn")
    }

    const box = document.getElementById("questionBox")
    if (box) box.innerText = "تعذر تحميل السؤال"
    return
  }

  if (!data || !data.length) {
    if (btn) {
      btn.disabled = false
      btn.classList.remove("warmupUsedBtn")
    }

    const box = document.getElementById("questionBox")
    if (box) box.innerText = "لا يوجد سؤال محفوظ لهذا الرقم"
    return
  }

  const row = data[0]

  usedQuestions[key] = true
  window.usedQuestions = usedQuestions
  warmupQuestionLocked = true
  currentWarmupQuestionKey = key
  warmupLastTickPlayed = null

  const questionBox = document.getElementById("questionBox")
  if (questionBox) questionBox.innerText = row.question || "لا يوجد نص سؤال"

  window.currentAnswer = row.answer || ""
  currentPoints = Number(number)

  startWarmupTimer(number)
  saveWarmupState()
}

function showWarmupAnswer() {
  if (!warmupQuestionLocked || !window.currentAnswer) {
    showGameToast("اختر سؤالاً أولاً")
    return
  }

  const box = document.getElementById("questionBox")
  if (box) box.innerText = window.currentAnswer
  saveWarmupState()
}

/* =========================
   Timer
========================= */

function getWarmupTimeByPoints(points) {
  let time = 15
  if (points == 2) time = 25
  if (points == 4) time = 40
  return time
}

function startWarmupTimer(points) {
  const time = getWarmupTimeByPoints(points)
  runWarmupTimer(time)
}

function resumeWarmupTimer(time) {
  runWarmupTimer(time)
}

function runWarmupTimer(startValue) {
  const timerBox = document.getElementById("timer")
  if (!timerBox) return

  clearInterval(timer)
  let time = Number(startValue || 0)
  warmupLastTickPlayed = null

  timerBox.innerText = time
  saveWarmupState()

  timer = setInterval(() => {
    time--
    timerBox.innerText = time

    if (time > 0 && time <= 5 && warmupLastTickPlayed !== time) {
      warmupLastTickPlayed = time
      playGameSound("tick")
    }

    saveWarmupState()

    if (time <= 0) {
      clearInterval(timer)
      timer = null
      timerBox.innerText = 0
      warmupLastTickPlayed = null
      playGameSound("timeout")
      saveWarmupState()
    }
  }, 1000)
}

function resetWarmupTimer() {
  clearInterval(timer)
  timer = null
  warmupLastTickPlayed = null

  const timerBox = document.getElementById("timer")
  if (timerBox) timerBox.innerText = 0

  saveWarmupState()
}

/* =========================
   Actions
========================= */

function warmupCorrect() {
  if (!selectedTeam) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  if (!warmupQuestionLocked) {
    showGameToast("اختر سؤالاً أولاً")
    return
  }

  const points = Number(currentPoints || 0)

  if (selectedTeam === "A") {
    warmupScoreA += points
    const box = document.getElementById("roundScoreA")
    if (box) box.innerText = warmupScoreA
  }

  if (selectedTeam === "B") {
    warmupScoreB += points
    const box = document.getElementById("roundScoreB")
    if (box) box.innerText = warmupScoreB
  }

  playGameSound("correct")
  flashScreen("correct")

  lastAnsweredTeam = selectedTeam
  selectedTeam = getNextWarmupTeam()
  highlightWarmupSelectedTeam(selectedTeam)

  window.currentSegmentScores = {
    A: warmupScoreA,
    B: warmupScoreB
  }

  const questionBox = document.getElementById("questionBox")
  if (questionBox) questionBox.innerText = "اختر رقم السؤال"

  currentPoints = 0
  window.currentAnswer = ""
  warmupQuestionLocked = false
  currentWarmupQuestionKey = null
  clearWarmupSelectedButton()
  resetWarmupTimer()
  saveWarmupState()
}

function warmupWrong() {
  if (!warmupQuestionLocked) {
    showGameToast("اختر سؤالاً أولاً")
    return
  }

  playGameSound("wrong")
  flashScreen("wrong")
  if (selectedTeam) {
    lastAnsweredTeam = selectedTeam
  }

  selectedTeam = getNextWarmupTeam()
  highlightWarmupSelectedTeam(selectedTeam)

  const questionBox = document.getElementById("questionBox")
  if (questionBox) questionBox.innerText = "اختر رقم السؤال"

  currentPoints = 0
  window.currentAnswer = ""
  warmupQuestionLocked = false
  currentWarmupQuestionKey = null
  clearWarmupSelectedButton()
  resetWarmupTimer()
  saveWarmupState()
}