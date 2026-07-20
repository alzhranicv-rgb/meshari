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
let warmupTimer = null
let warmupStateSyncTimer = null
let warmupResultPending = false
let warmupDataCache = null
let warmupDataPromise = null

const WARMUP_DATA_CACHE_TTL =
  5 * 60 * 1000

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

function saveWarmupState(options = {}) {
  const questionBox = document.getElementById("questionBox")
  const timerBox = document.getElementById("timer")

  const state = {
    usedQuestions: JSON.parse(JSON.stringify(usedQuestions || {})),
    warmupScoreA: Number(warmupScoreA || 0),
    warmupScoreB: Number(warmupScoreB || 0),

    lastAnsweredTeam,
    warmupManualSelectionDone: !!warmupManualSelectionDone,
    warmupQuestionLocked: !!warmupQuestionLocked,
    warmupResultPending: !!warmupResultPending,
    currentWarmupQuestionKey,

    warmupDoubleState: JSON.parse(
      JSON.stringify(
        warmupDoubleState || {
          used: { A: false, B: false },
          activeTeam: null
        }
      )
    ),

    selectedTeam:
      selectedTeam === "A" || selectedTeam === "B"
        ? selectedTeam
        : null,

    currentPoints: Number(currentPoints || 0),
    currentAnswer: String(window.currentAnswer || ""),

    questionText:
      questionBox?.innerText ||
      "اختر رقم السؤال",

    timerValue: Number(
      timerBox?.innerText || 0
    )
  }

  localStorage.setItem(
    WARMUP_STORAGE_KEY,
    JSON.stringify(state)
  )

  localStorage.setItem(
    "active_segment",
    "warmup"
  )

  window.currentSegmentScores = {
    A: Number(warmupScoreA || 0),
    B: Number(warmupScoreB || 0)
  }

  if (
    typeof saveUnifiedGameState ===
    "function"
  ) {
    saveUnifiedGameState()
  }

  clearTimeout(warmupStateSyncTimer)

  const immediate =
    options.immediate === true

  warmupStateSyncTimer = setTimeout(() => {
    if (
      typeof syncDisplayStateToSession ===
      "function"
    ) {
      syncDisplayStateToSession({
        immediate
      })
    }
  }, immediate ? 0 : 120)
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

  usedQuestions =
    saved.usedQuestions &&
    typeof saved.usedQuestions === "object"
      ? saved.usedQuestions
      : {}

  window.usedQuestions = usedQuestions

  warmupScoreA = Number(saved.warmupScoreA || 0)
  warmupScoreB = Number(saved.warmupScoreB || 0)

  lastAnsweredTeam =
    saved.lastAnsweredTeam === "A" ||
    saved.lastAnsweredTeam === "B"
      ? saved.lastAnsweredTeam
      : null

  warmupManualSelectionDone =
    !!saved.warmupManualSelectionDone

  warmupQuestionLocked =
    !!saved.warmupQuestionLocked

  /*
    عند تحديث الصفحة أثناء عرض الإجابة:
    نوقف حالة الانتظار فقط،
    لكن نبقي السؤال مفتوحًا حتى يستطيع المقدم
    تسجيل النتيجة مرة أخرى.
  */
  warmupResultPending = false

  currentWarmupQuestionKey =
    saved.currentWarmupQuestionKey || null

  warmupDoubleState = {
    used: {
      A: !!saved.warmupDoubleState?.used?.A,
      B: !!saved.warmupDoubleState?.used?.B
    },

    activeTeam:
      saved.warmupDoubleState?.activeTeam === "A" ||
      saved.warmupDoubleState?.activeTeam === "B"
        ? saved.warmupDoubleState.activeTeam
        : null
  }

  selectedTeam =
    saved.selectedTeam === "A" ||
    saved.selectedTeam === "B"
      ? saved.selectedTeam
      : null

  window.selectedTeam = selectedTeam

  currentPoints =
    Number(saved.currentPoints || 0)

  window.currentAnswer =
    String(saved.currentAnswer || "")

  const scoreABox =
    document.getElementById("roundScoreA")

  const scoreBBox =
    document.getElementById("roundScoreB")

  const questionBox =
    document.getElementById("questionBox")

  const timerBox =
    document.getElementById("timer")

  if (scoreABox) {
    scoreABox.innerText = warmupScoreA
  }

  if (scoreBBox) {
    scoreBBox.innerText = warmupScoreB
  }

  if (questionBox) {
    questionBox.innerText =
      saved.questionText ||
      "اختر رقم السؤال"
  }

  const restoredTime = Math.max(
    0,
    Number(saved.timerValue || 0)
  )

  if (timerBox) {
    timerBox.innerText = restoredTime
  }

  if (selectedTeam) {
    setWarmupActiveTeam(selectedTeam, {
      sync: false,
      save: false
    })
  }

  restoreWarmupButtonStates()

  if (currentWarmupQuestionKey) {
    const [cat, num] =
      currentWarmupQuestionKey.split("_")

    const btn =
      document.getElementById(
        `q${cat}_${num}`
      )

    if (btn) {
      highlightWarmupSelectedButton(btn)
    }
  }

  updateWarmupDoubleButton()

  window.currentSegmentScores = {
    A: warmupScoreA,
    B: warmupScoreB
  }

  if (
    warmupQuestionLocked &&
    restoredTime > 0
  ) {
    resumeWarmupTimer(restoredTime)
  }
}

/* =========================
   Render
========================= */

window.renderWarmup = async function () {
  clearInterval(warmupTimer)
  warmupTimer = null

  clearTimeout(warmupStateSyncTimer)
  warmupStateSyncTimer = null

  warmupDataCache = null
  warmupDataPromise = null

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
  warmupResultPending = false

  warmupDoubleState = {
    used: { A: false, B: false },
    activeTeam: null
  }

  const categories = await loadWarmupCategories()

  openSegment("التسخين", `
    <div class="warmupWrap" data-segment-key="warmup">

      <header class="megaHeader">

        <button class="dockBtn dockBtnNav" type="button" onclick="goHome()">
          رجوع
        </button>

        <div
          class="teamMini teamA"
          onclick="selectWarmupTeam('A')"
          id="warmupTeamABox"
        >
          <div class="teamNameBlock">
            <strong>${escapeDisplayHtml(teamAName || "الفريق الأول")}</strong>
          </div>

          <b id="roundScoreA">${warmupScoreA}</b>
        </div>

        <div class="segmentTitlePlain">
          <h1>التسخين</h1>
        </div>

        <div
          class="teamMini teamB"
          onclick="selectWarmupTeam('B')"
          id="warmupTeamBBox"
        >
          <b id="roundScoreB">${warmupScoreB}</b>

          <div class="teamNameBlock">
            <strong>${escapeDisplayHtml(teamBName || "الفريق الثاني")}</strong>
          </div>
        </div>

        <button
          id="endRoundBtn"
          class="dockBtn dockBtnNav"
          type="button"
          onclick="endCurrentSegment()"
          disabled
        >
          إنهاء
        </button>

      </header>

      <section class="questionUnifiedCard">

        <div class="questionSide">
          <span class="questionLabel">السؤال</span>

          <div id="questionBox" class="questionTextBox">
            اختر رقم السؤال
          </div>
        </div>

        <div class="timerSide">
          <div class="timerPill">
            <strong id="timer">0</strong>
          </div>
        </div>

      </section>

      <section class="categoriesGrid">
        ${createWarmupCategory(1, categories[1] || "الفئة 1", "catBlue")}
        ${createWarmupCategory(2, categories[2] || "الفئة 2", "catCyan")}
        ${createWarmupCategory(3, categories[3] || "الفئة 3", "catPurple")}
        ${createWarmupCategory(4, categories[4] || "الفئة 4", "catGreen")}
      </section>

      <footer class="actionBar">
        <button
          onclick="activateWarmupDouble()"
          class="actionBtn btnDouble"
          id="warmupDoubleBtn"
        >
          دوبيلا
        </button>

        <button
          onclick="warmupCorrect()"
          class="actionBtn btnCorrect"
        >
          ✓ صح
        </button>

        <button
          onclick="warmupWrong()"
          class="actionBtn btnWrong"
        >
          ✕ خطأ
        </button>
      </footer>

    </div>
  `)

  window.currentSegmentScores = {
    A: warmupScoreA,
    B: warmupScoreB
  }

  if (saved) {
    restoreWarmupUIFromState(saved)
  } else {
    saveWarmupState({
      immediate: true
    })
  }

  updateWarmupDoubleButton()
  renderWarmupFinishedIfNeeded()
}

function buildWarmupDataMap(rows = []) {
  const categories = {}
  const questions = {}

  ;(rows || []).forEach(row => {
    const category =
      Number(row.category || 0)

    const number =
      Number(row.number || 0)

    if (!category || !number) {
      return
    }

    if (!categories[category]) {
      categories[category] =
        row.category_name ||
        `الفئة ${category}`
    }

    questions[
      `${category}_${number}`
    ] = {
      category,
      number,

      categoryName:
        row.category_name ||
        `الفئة ${category}`,

      question:
        String(row.question || ""),

      answer:
        String(row.answer || "")
    }
  })

  return {
    categories,
    questions
  }
}

function applyWarmupFreshData(rows = []) {
  warmupDataCache =
    buildWarmupDataMap(rows)

  return warmupDataCache
}

async function loadWarmupData(
  options = {}
) {
  const modelId =
    Number(
      currentModel ||
      window.currentModel ||
      localStorage.getItem(
        "game_model"
      ) ||
      0
    )

  if (!modelId) {
    return {
      categories: {},
      questions: {}
    }
  }

  if (
    warmupDataCache &&
    options.forceRefresh !== true
  ) {
    return warmupDataCache
  }

  if (
    warmupDataPromise &&
    options.forceRefresh !== true
  ) {
    return warmupDataPromise
  }

  warmupDataPromise =
    (async () => {
      try {
        let rows = []

        if (
          typeof window
            .cachedSupabaseSelect ===
          "function"
        ) {
          const result =
            await window
              .cachedSupabaseSelect(
                "questions",
                {
                  select: `
                    category,
                    category_name,
                    number,
                    question,
                    answer
                  `,

                  filters: {
                    model: modelId,
                    segment: "warmup"
                  },

                  order: [
                    {
                      column: "category",
                      ascending: true
                    },
                    {
                      column: "number",
                      ascending: true
                    }
                  ],

                  ttl:
                    WARMUP_DATA_CACHE_TTL,

                  forceRefresh:
                    options.forceRefresh ===
                    true,

                  staleWhileRevalidate:
                    options
                      .staleWhileRevalidate !==
                    false,

                  onBackgroundUpdate:
                    freshRows => {
                      applyWarmupFreshData(
                        freshRows || []
                      )
                    }
                }
              )

          rows = result.data || []

          if (
            result.error &&
            !rows.length
          ) {
            throw result.error
          }
        } else {
          const {
            data,
            error
          } = await db
            .from("questions")
            .select(`
              category,
              category_name,
              number,
              question,
              answer
            `)
            .eq(
              "model",
              modelId
            )
            .eq(
              "segment",
              "warmup"
            )
            .order(
              "category",
              {
                ascending: true
              }
            )
            .order(
              "number",
              {
                ascending: true
              }
            )

          if (error) {
            throw error
          }

          rows = data || []
        }

        return applyWarmupFreshData(
          rows
        )
      } catch (error) {
        console.log(
          "LOAD WARMUP DATA ERROR:",
          error
        )

        return (
          warmupDataCache || {
            categories: {},
            questions: {}
          }
        )
      } finally {
        warmupDataPromise = null
      }
    })()

  return warmupDataPromise
}

async function loadWarmupCategories() {
  const data =
    await loadWarmupData({
      staleWhileRevalidate: true
    })

  return data.categories || {}
}

function getCachedWarmupQuestion(
  category,
  number
) {
  const key =
    `${Number(category)}_${Number(number)}`

  return (
    warmupDataCache
      ?.questions?.[key] ||
    null
  )
}

function createWarmupCategory(num, name, colorClass = "") {
  return `
    <article class="categoryCard ${colorClass}">
      <header class="categoryCardHead">
        <h3>${escapeDisplayHtml(name)}</h3>
      </header>

      <div class="numbers">
        <button id="q${num}_1" onclick="openWarmupQuestion(${num},1)" class="warmupNumberBtn">1</button>
        <button id="q${num}_2" onclick="openWarmupQuestion(${num},2)" class="warmupNumberBtn">2</button>
        <button id="q${num}_4" onclick="openWarmupQuestion(${num},4)" class="warmupNumberBtn">4</button>
      </div>
    </article>
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
  const btn =
    document.getElementById(
      "warmupDoubleBtn"
    )

  if (!btn) return

  const team = selectedTeam

  btn.classList.remove("activeDouble")

  if (
    warmupQuestionLocked ||
    currentWarmupQuestionKey
  ) {
    btn.disabled = true
    btn.innerText = "دوبيلا"
    return
  }

  if (!team) {
    btn.disabled =
      warmupDoubleState.used.A &&
      warmupDoubleState.used.B

    btn.innerText = "دوبيلا"
    return
  }

  if (
    warmupDoubleState.activeTeam ===
    team
  ) {
    btn.disabled = true
    btn.innerText = "دوبيلا مفعّل"
    btn.classList.add("activeDouble")
    return
  }

  if (warmupDoubleState.used[team]) {
    btn.disabled = true
    btn.innerText = "تم استخدام دوبيلا"
    return
  }

  if (
    warmupDoubleState.used.A &&
    warmupDoubleState.used.B
  ) {
    btn.disabled = true
    btn.innerText = "دوبيلا مقفل"
    return
  }

  btn.disabled = false
  btn.innerText = "دوبيلا"
}
function setWarmupActiveTeam(
  team,
  options = {}
) {
  if (team !== "A" && team !== "B") {
    return false
  }

  selectedTeam = team
  window.selectedTeam = team

  highlightWarmupSelectedTeam(team)

  if (
    typeof setGameActiveTeam ===
    "function"
  ) {
    setGameActiveTeam(team, {
      sync: options.sync !== false
    })
  }

  updateWarmupDoubleButton()

  if (options.save !== false) {
    saveWarmupState({
      immediate:
        options.immediate === true
    })
  }

  return true
}

/* =========================
   Team UI
========================= */

function getWarmupTeamBox(team) {
  const letter = team === "A" ? "A" : "B"

  return (
    document.getElementById(`warmupTeam${letter}Box`) ||
    document.getElementById(`warmupTeam${letter}`) ||
    document.getElementById(`warmupScore${letter}Box`) ||
    document.getElementById(`warmupScorePanel${letter}`) ||
    document.querySelector(`[onclick="selectWarmupTeam('${letter}')"]`) ||
    document.querySelector(`[onclick='selectWarmupTeam("${letter}")']`) ||
    document.querySelector(`[data-team="${letter}"]`) ||
    document.querySelector(`.warmupTeamBox.team${letter}`) ||
    document.querySelector(`.warmupTeamCard.team${letter}`) ||
    document.querySelector(`.warmupScorePanel.team${letter}`)
  )
}

function highlightWarmupSelectedTeam(team) {
  document.querySelectorAll(".warmupTeamCurrent").forEach(el => {
    el.classList.remove("warmupTeamCurrent")
  })

  const box = getWarmupTeamBox(team)

  if (box) {
    box.classList.remove("activeTeam", "selectedPresenterTeam")
    box.classList.add("warmupTeamCurrent")
  } else {
    console.log("WARMUP TEAM BOX NOT FOUND:", team)
  }
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

function selectWarmupTeam(
  team,
  options = {}
) {
  if (team !== "A" && team !== "B") {
    return false
  }

  const force =
    options.force === true

  if (
    !force &&
    warmupQuestionLocked
  ) {
    showGameToast(
      "سجل نتيجة السؤال الحالي أولاً"
    )

    return false
  }

  if (
    !force &&
    warmupManualSelectionDone &&
    team !== selectedTeam
  ) {
    showGameToast(
      "بعد البداية الأولى يتحدد الدور تلقائيًا"
    )

    return false
  }

  if (
    !force &&
    lastAnsweredTeam === team
  ) {
    showGameToast(
      "لا يمكن لنفس الفريق اللعب مرتين متتاليتين"
    )

    return false
  }

  warmupManualSelectionDone = true

  setWarmupActiveTeam(team, {
    immediate: true
  })

  setTimeout(() => {
    highlightWarmupSelectedTeam(team)
  }, 50)

  return true
}
function forceWarmupTeamFromPresenter(team) {
  return selectWarmupTeam(team, {
    force: true
  })
}

window.selectWarmupTeam =
  selectWarmupTeam

window.forceWarmupTeamFromPresenter =
  forceWarmupTeamFromPresenter


/* =========================
   Questions
========================= */

async function openWarmupQuestion(
  category,
  number
) {
  const categoryNumber =
    Number(category || 0)

  const questionNumber =
    Number(number || 0)

  if (
    !categoryNumber ||
    !questionNumber
  ) {
    return
  }

  if (warmupQuestionLocked) {
    showGameToast(
      "سجل النتيجة أولاً"
    )

    return
  }

  if (!selectedTeam) {
    if (
      !warmupManualSelectionDone
    ) {
      showGameToast(
        "اختر الفريق أولاً"
      )

      return
    }

    const autoTeam =
      getNextWarmupTeam()

    if (!autoTeam) {
      showGameToast(
        "اختر الفريق أولاً"
      )

      return
    }

    setWarmupActiveTeam(
      autoTeam,
      {
        immediate: true
      }
    )
  }

  const key =
    `${categoryNumber}_${questionNumber}`

  if (usedQuestions[key]) {
    return
  }

  const btn =
    document.getElementById(
      `q${categoryNumber}_${questionNumber}`
    )

  if (btn) {
    highlightWarmupSelectedButton(
      btn
    )

    btn.disabled = true

    btn.classList.add(
      "warmupUsedBtn"
    )
  }

  let row =
    getCachedWarmupQuestion(
      categoryNumber,
      questionNumber
    )

  if (!row) {
    const questionBox =
      document.getElementById(
        "questionBox"
      )

    if (questionBox) {
      questionBox.innerText =
        "جارٍ تحميل السؤال..."
    }

    await loadWarmupData({
      forceRefresh: true,
      staleWhileRevalidate: false
    })

    row =
      getCachedWarmupQuestion(
        categoryNumber,
        questionNumber
      )
  }

  if (!row) {
    if (btn) {
      btn.disabled = false

      btn.classList.remove(
        "warmupUsedBtn"
      )
    }

    clearWarmupSelectedButton()

    const questionBox =
      document.getElementById(
        "questionBox"
      )

    if (questionBox) {
      questionBox.innerText =
        "لا يوجد سؤال محفوظ لهذا الرقم"
    }

    return
  }

  usedQuestions[key] = true
  window.usedQuestions =
    usedQuestions

  warmupQuestionLocked = true
  currentWarmupQuestionKey =
    key

  warmupLastTickPlayed = null

  const questionBox =
    document.getElementById(
      "questionBox"
    )

  if (questionBox) {
    questionBox.innerText =
      row.question ||
      "لا يوجد نص سؤال"
  }

  window.currentAnswer =
    row.answer || ""

  currentPoints =
    questionNumber

  updateWarmupDoubleButton()

  startWarmupTimer(
    questionNumber
  )

  saveWarmupState({
    immediate: true
  })
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
  const timerBox =
    document.getElementById("timer")

  if (!timerBox) return

  clearInterval(warmupTimer)
  warmupTimer = null

  let time = Math.max(
    0,
    Number(startValue || 0)
  )

  warmupLastTickPlayed = null

  timerBox.innerText = time

  timerBox.classList.toggle(
    "timerDanger",
    time > 0 && time <= 5
  )

  timerBox.classList.remove(
    "timerTimeoutFx"
  )

  saveWarmupState()

  if (time <= 0) return

  warmupTimer = setInterval(() => {
    time = Math.max(0, time - 1)

    timerBox.innerText = time

    timerBox.classList.toggle(
      "timerDanger",
      time > 0 && time <= 5
    )

    if (
      time > 0 &&
      time <= 5 &&
      warmupLastTickPlayed !== time
    ) {
      warmupLastTickPlayed = time
      playGameSound("tick")
    }

    saveWarmupState()

    if (time > 0) return

    clearInterval(warmupTimer)
    warmupTimer = null

    timerBox.innerText = 0

    timerBox.classList.remove(
      "timerDanger"
    )

    timerBox.classList.add(
      "timerTimeoutFx"
    )

    setTimeout(() => {
      timerBox.classList.remove(
        "timerTimeoutFx"
      )
    }, 900)

    warmupLastTickPlayed = null

    playGameSound("timeout")

    saveWarmupState({
      immediate: true
    })
  }, 1000)
}

function resetWarmupTimer(options = {}) {
  clearInterval(warmupTimer)
  warmupTimer = null

  warmupLastTickPlayed = null

  const timerBox =
    document.getElementById("timer")

  if (timerBox) {
    timerBox.innerText = 0

    timerBox.classList.remove(
      "timerDanger",
      "timerTimeoutFx"
    )
  }

  if (options.save !== false) {
    saveWarmupState()
  }
}

/* =========================
   Actions
========================= */


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

resetWarmupTimer({
  save: false
})

saveWarmupState({
  immediate: true
})

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

const nextTeam = getNextWarmupTeam()

if (nextTeam) {
  setWarmupActiveTeam(nextTeam, {
    sync: false,
    save: false
  })
}

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
    resetWarmupTimer({
  save: false
})

updateWarmupDoubleButton()

saveWarmupState({
  immediate: true
})
    renderWarmupFinishedIfNeeded()
  })
}

function warmupWrong() {
  if (warmupResultPending) return

  if (!warmupQuestionLocked) {
    showGameToast("اختر سؤالاً أولاً")
    return
  }

warmupResultPending = true

resetWarmupTimer({
  save: false
})

saveWarmupState({
  immediate: true
})

  playGameSound("wrong")
  flashScreen("wrong")

  showWarmupAnswerForSeconds(() => {
    clearWarmupActiveDouble()

    if (selectedTeam) {
      lastAnsweredTeam = selectedTeam
    }

    const nextTeam = getNextWarmupTeam()

if (nextTeam) {
  setWarmupActiveTeam(nextTeam, {
    sync: false,
    save: false
  })
}

    const questionBox = document.getElementById("questionBox")
    if (questionBox) questionBox.innerText = "اختر رقم السؤال"

    currentPoints = 0
    window.currentAnswer = ""
    warmupQuestionLocked = false
    currentWarmupQuestionKey = null
    clearWarmupSelectedButton()
    resetWarmupTimer({
  save: false
})

updateWarmupDoubleButton()

saveWarmupState({
  immediate: true
})
    renderWarmupFinishedIfNeeded()
  })
}

function getWarmupTotalQuestionsCount() {
  return 12
}

function getWarmupUsedQuestionsCount() {
  return Object.keys(usedQuestions || {}).filter(key => usedQuestions[key]).length
}

function isWarmupFinished() {
  return (
    getWarmupUsedQuestionsCount() >= getWarmupTotalQuestionsCount() &&
    !warmupQuestionLocked &&
    !warmupResultPending
  )
}

function getWarmupWinnerText() {
  const a = Number(warmupScoreA || 0)
  const b = Number(warmupScoreB || 0)

  if (a > b) return teamAName || "الفريق الأول"
  if (b > a) return teamBName || "الفريق الثاني"

  return "تعادل"
}
function renderWarmupFinishedIfNeeded() {
  if (!isWarmupFinished()) return false

  window.currentSegmentScores = {
    A: Number(warmupScoreA || 0),
    B: Number(warmupScoreB || 0)
  }

  saveWarmupState()

  if (typeof updateEndRoundButtonState === "function") {
    updateEndRoundButtonState()
  }

  return true
}