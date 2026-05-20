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

let warmupDoubleState = {
  used: { A: false, B: false },
  activeTeam: null
}

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
    warmupDoubleState,
    selectedTeam,
    currentPoints,
    currentAnswer: window.currentAnswer || "",
    questionText: questionBox ? questionBox.innerText : "اختر رقم السؤال",
    timerValue: timerBox ? Number(timerBox.innerText || 0) : 0
  }

  localStorage.setItem(WARMUP_STORAGE_KEY, JSON.stringify(state))
  localStorage.setItem("active_segment", "warmup")

  if (typeof syncDisplayStateToSession === "function") {
    syncDisplayStateToSession()
  }
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
  warmupDoubleState = saved.warmupDoubleState || {
    used: { A: false, B: false },
    activeTeam: null
  }

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
  updateWarmupDoubleButton()

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

  warmupDoubleState = {
    used: { A: false, B: false },
    activeTeam: null
  }

  const categories = await loadWarmupCategories()

  openSegment("التسخين", `
    <div class="warmupWrap">

      <div class="warmupScoreBoard">

  <div class="warmupTeamCard warmupScoreTeamCard" onclick="selectWarmupTeam('A')" id="warmupTeamABox">
    <div class="warmupTeamMeta">
      <div class="warmupTeamName">${teamAName}</div>
    </div>

    <div class="warmupTeamScoreWrap">
      <div class="warmupTeamScore" id="roundScoreA">${warmupScoreA}</div>
    </div>
  </div>

  <div class="warmupTimerBox warmupScoreTimerBox">
    
    <div class="warmupTimerValue" id="timer">0</div>
  </div>

  <div class="warmupTeamCard warmupScoreTeamCard" onclick="selectWarmupTeam('B')" id="warmupTeamBBox">
    <div class="warmupTeamMeta">
      <div class="warmupTeamName">${teamBName}</div>
    </div>

    <div class="warmupTeamScoreWrap">
      <div class="warmupTeamScore" id="roundScoreB">${warmupScoreB}</div>
    </div>
  </div>

</div>


      <div id="questionBox" class="warmupQuestionBox">
        اختر رقم السؤال
      </div>

      <div class="warmupControlPanel">
  <button onclick="activateWarmupDouble()" class="warmupDoubleBtn" id="warmupDoubleBtn">دبل</button>
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

  updateWarmupDoubleButton()
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
   Double
========================= */

function activateWarmupDouble() {
  const team = selectedTeam

  if (!team) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  if (warmupQuestionLocked || currentWarmupQuestionKey) {
    showGameToast("الدوبيلا قبل اختيار السؤال فقط")
    return
  }

  if (warmupDoubleState.used[team]) {
    showGameToast("هذا الفريق استخدم الدوبيلا مسبقًا")
    return
  }

  if (warmupDoubleState.used.A && warmupDoubleState.used.B) {
    showGameToast("تم استخدام الدوبيلا من الفريقين")
    return
  }

  warmupDoubleState.used[team] = true
  warmupDoubleState.activeTeam = team

  showGameToast(`تم تفعيل الدوبيلا  لفريق ${team === "A" ? teamAName : teamBName}`)

  updateWarmupDoubleButton()
  saveWarmupState()
}

function getWarmupScoreValue(team) {
  const base = Number(currentPoints || 0)
  return warmupDoubleState.activeTeam === team ? base * 2 : base
}

function clearWarmupActiveDouble() {
  warmupDoubleState.activeTeam = null
}

function updateWarmupDoubleButton() {
  const btn = document.getElementById("warmupDoubleBtn")
  if (!btn) return

  const team = selectedTeam

  btn.classList.remove("activeDouble")

  if (warmupQuestionLocked || currentWarmupQuestionKey) {
    btn.disabled = true
    btn.innerText = "دوبيلا"
    return
  }

  if (!team) {
    btn.disabled = warmupDoubleState.used.A && warmupDoubleState.used.B
    btn.innerText = "دوبيلا"
    return
  }

  if (warmupDoubleState.activeTeam === team) {
    btn.disabled = true
    btn.innerText = "الدوبيلا مفعّل"
    btn.classList.add("activeDouble")
    return
  }

  if (warmupDoubleState.used[team]) {
    btn.disabled = true
    btn.innerText = " الدوبيلا"
    return
  }

  if (warmupDoubleState.used.A && warmupDoubleState.used.B) {
    btn.disabled = true
    btn.innerText = "الدوبيلا مقفل"
    return
  }

  btn.disabled = false
  btn.innerText = "دوبيلا "
}

/* =========================
   Team UI
========================= */

function highlightWarmupSelectedTeam(team) {
  const a = document.getElementById("warmupTeamABox")
  const b = document.getElementById("warmupTeamBBox")

  if (a) {
    a.classList.remove("activeTeam")
    a.removeAttribute("style")
  }

  if (b) {
    b.classList.remove("activeTeam")
    b.removeAttribute("style")
  }

  if (team === "A" && a) {
    a.classList.add("activeTeam")
  }

  if (team === "B" && b) {
    b.classList.add("activeTeam")
  }

  updateWarmupDoubleButton()
}

function clearWarmupSelectedButton() {
  if (!currentWarmupButton) return

  currentWarmupButton.classList.remove("currentNumber")
  currentWarmupButton = null
}

function highlightWarmupSelectedButton(button) {
  clearWarmupSelectedButton()
  if (!button) return

  currentWarmupButton = button
  button.classList.add("currentNumber")
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
  updateWarmupDoubleButton()
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

  updateWarmupDoubleButton()
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

let warmupResultPending = false

function showWarmupAnswerForSeconds(callback) {
  const box = document.getElementById("questionBox")

  if (box && window.currentAnswer) {
    box.innerText = window.currentAnswer
  }

  setTimeout(() => {
    warmupResultPending = false
    callback()
  }, 5000)
}

function warmupCorrect() {
  if (warmupResultPending) return

  if (!selectedTeam) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  if (!warmupQuestionLocked) {
    showGameToast("اختر سؤالاً أولاً")
    return
  }

  warmupResultPending = true
  resetWarmupTimer()

  playGameSound("correct")
  flashScreen("correct")

  showWarmupAnswerForSeconds(() => {
    const team = selectedTeam
    const points = getWarmupScoreValue(team)

    if (team === "A") {
      warmupScoreA += points
      const box = document.getElementById("roundScoreA")
      if (box) box.innerText = warmupScoreA
    }

    if (team === "B") {
      warmupScoreB += points
      const box = document.getElementById("roundScoreB")
      if (box) box.innerText = warmupScoreB
    }

    clearWarmupActiveDouble()

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
    updateWarmupDoubleButton()
    saveWarmupState()
  })
}

function warmupWrong() {
  if (warmupResultPending) return

  if (!warmupQuestionLocked) {
    showGameToast("اختر سؤالاً أولاً")
    return
  }

  warmupResultPending = true
  resetWarmupTimer()

  playGameSound("wrong")
  flashScreen("wrong")

  showWarmupAnswerForSeconds(() => {
    clearWarmupActiveDouble()

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
    updateWarmupDoubleButton()
    saveWarmupState()
  })
}