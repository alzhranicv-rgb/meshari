let top10MaxRound = Number(window.top10MaxRound || localStorage.getItem("top10_max_round") || 3)
window.top10MaxRound = top10MaxRound

let top10State = {
  round: 1,
  scores: { A: 0, B: 0 },
  activeTeam: null,
  lastTeam: null,
  question: { 1: "", 2: "", 3: "", 4: "" },
  errors: {
    1: { A: 0, B: 0 },
    2: { A: 0, B: 0 },
    3: { A: 0, B: 0 },
    4: { A: 0, B: 0 }
  },
  opened: { 1: [], 2: [], 3: [], 4: [] },
  answers: { 1: {}, 2: {}, 3: {}, 4: {} }
}

window.top10State = top10State

let top10DoubleState = {
  used: { A: false, B: false },
  activeTeam: null
}

let currentTop10Answer = null
let currentTop10Number = null
let top10TimerStarted = false
let top10LastTickPlayed = null
let top10AnimatingNumber = null

let top10History = []
let top10Timer = null
let top10StateSyncTimer = null
let top10SaveDelayTimer = null
let top10RoundAnswersCache = {}
let top10DataCache = null
let top10DataPromise = null
let top10DataCacheModel = null

let top10TimerStartedAt = 0
let top10TimerEndsAt = 0
let top10TimerDuration = 0

const TOP10_DATA_CACHE_TTL =
  5 * 60 * 1000


const TOP10_HISTORY_LIMIT = 50
const TOP10_STORAGE_KEY = "top10_state_v1"
const TOP10_TIMER_SECONDS = 35

/* =========================
   Persistence
========================= */

function getTop10State() {
  try {
    return JSON.parse(localStorage.getItem(TOP10_STORAGE_KEY) || "null")
  } catch {
    return null
  }
}

function syncTop10Globals() {
  top10MaxRound = Math.min(Math.max(Number(top10MaxRound || 3), 1), 4)

  window.top10MaxRound = top10MaxRound
  window.top10State = top10State

  localStorage.setItem("top10_max_round", String(top10MaxRound))

  window.currentSegmentScores = {
    A: Number(top10State.scores?.A || 0),
    B: Number(top10State.scores?.B || 0)
  }
}

function createEmptyTop10State(maxRound = top10MaxRound) {
  const safeMax = Math.min(Math.max(Number(maxRound || 3), 1), 4)

  const question = {}
  const errors = {}
  const opened = {}
  const answers = {}

  for (let r = 1; r <= safeMax; r++) {
    question[r] = ""
    errors[r] = { A: 0, B: 0 }
    opened[r] = []
    answers[r] = {}
  }

  return {
    round: 1,
    scores: { A: 0, B: 0 },
    activeTeam: null,
    lastTeam: null,
    question,
    errors,
    opened,
    answers
  }
}

function ensureTop10RoundState() {
  top10MaxRound = Math.min(Math.max(Number(top10MaxRound || 3), 1), 4)

  if (!top10State.question) top10State.question = {}
  if (!top10State.errors) top10State.errors = {}
  if (!top10State.opened) top10State.opened = {}
  if (!top10State.answers) top10State.answers = {}

  for (let r = 1; r <= top10MaxRound; r++) {
    if (typeof top10State.question[r] !== "string") {
      top10State.question[r] = ""
    }

    if (!top10State.errors[r]) {
      top10State.errors[r] = { A: 0, B: 0 }
    }

    if (typeof top10State.errors[r].A !== "number") {
      top10State.errors[r].A = 0
    }

    if (typeof top10State.errors[r].B !== "number") {
      top10State.errors[r].B = 0
    }

    if (!Array.isArray(top10State.opened[r])) {
      top10State.opened[r] = []
    }

    if (!top10State.answers[r]) {
      top10State.answers[r] = {}
    }
  }

  top10State.round = Math.min(
    Math.max(Number(top10State.round || 1), 1),
    top10MaxRound
  )

  syncTop10Globals()
}

function saveTop10State(options = {}) {
  ensureTop10RoundState()

  const timerBox = document.getElementById("timer")

  const state = {
    top10State: cloneTop10Data(top10State),

    top10DoubleState: cloneTop10Data(
      top10DoubleState || {
        used: { A: false, B: false },
        activeTeam: null
      }
    ),

    currentTop10Answer:
      currentTop10Answer || null,

    currentTop10Number:
      currentTop10Number !== null
        ? Number(currentTop10Number)
        : null,

    top10TimerStarted:
      !!top10TimerStarted,

    top10MaxRound:
      Number(top10MaxRound || 3),

    timerValue:
      Number(timerBox?.innerText || 0),

    timerSync: {
      startedAt: Number(top10TimerStartedAt || 0),
      endsAt: Number(top10TimerEndsAt || 0),
      duration: Number(top10TimerDuration || 0)
    },

    top10History:
      cloneTop10Data(top10History || [])
  }

  localStorage.setItem(
    TOP10_STORAGE_KEY,
    JSON.stringify(state)
  )

  localStorage.setItem(
    "top10_max_round",
    String(top10MaxRound)
  )

  localStorage.setItem(
    "active_segment",
    "top10"
  )

  syncTop10Globals()

  if (options.sync === false) {
    return
  }

  clearTimeout(top10StateSyncTimer)

  const immediate =
    options.immediate === true

  top10StateSyncTimer = setTimeout(() => {
    if (
      typeof saveUnifiedGameState ===
      "function"
    ) {
      saveUnifiedGameState()
    }

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

function clearTop10State() {
  localStorage.removeItem(TOP10_STORAGE_KEY)
  localStorage.removeItem("top10_max_round")
  localStorage.removeItem("active_segment")
}

function restoreTop10State(saved) {
  if (!saved?.top10State) return

  clearInterval(top10Timer)
  top10Timer = null

  top10MaxRound = Math.min(
    Math.max(
      Number(
        window.top10MaxRound ||
        localStorage.getItem("top10_max_round") ||
        saved.top10MaxRound ||
        3
      ),
      1
    ),
    4
  )

  window.top10MaxRound = top10MaxRound

  localStorage.setItem(
    "top10_max_round",
    String(top10MaxRound)
  )

  const loadedQuestions = {
    ...(top10State?.question || {})
  }

  top10State = cloneTop10Data(
    saved.top10State
  )

  ensureTop10RoundState()

  for (
    let round = 1;
    round <= top10MaxRound;
    round++
  ) {
    if (!top10State.question[round]) {
      top10State.question[round] =
        loadedQuestions[round] ||
        "السؤال يظهر هنا"
    }
  }

  top10DoubleState = cloneTop10Data(
    saved.top10DoubleState || {
      used: { A: false, B: false },
      activeTeam: null
    }
  )

  if (!top10DoubleState.used) {
    top10DoubleState.used = {
      A: false,
      B: false
    }
  }

  top10DoubleState.used.A =
    !!top10DoubleState.used.A

  top10DoubleState.used.B =
    !!top10DoubleState.used.B

  currentTop10Answer =
    saved.currentTop10Answer || null

  currentTop10Number =
    saved.currentTop10Number !== null &&
    saved.currentTop10Number !== undefined
      ? Number(saved.currentTop10Number)
      : null

  top10TimerStarted =
    !!saved.top10TimerStarted

  top10AnimatingNumber = null
  top10LastTickPlayed = null

  top10History = Array.isArray(
    saved.top10History
  )
    ? saved.top10History
    : []

  const currentRound =
    Number(top10State.round || 1)

  const currentOpened =
    top10State.opened?.[currentRound] || []

  if (!currentOpened.length) {
    top10State.activeTeam = null
    top10State.lastTeam = null
    currentTop10Answer = null
    currentTop10Number = null
    top10TimerStarted = false
    top10DoubleState.activeTeam = null
  }

  syncTop10Globals()
  renderCurrentRoundTop10UI()

  setTop10ActiveTeam(
    top10State.activeTeam,
    {
      sync: false,
      save: false
    }
  )

  const timerValue =
    Number(saved.timerValue || 0)

  if (
    top10TimerStarted &&
    timerValue > 0 &&
    currentOpened.length > 0 &&
    top10State.activeTeam
  ) {
    resumeTop10Timer(timerValue)
  } else {
    stopTop10Timer(0, {
      save: false
    })
  }

  updateTop10UndoButtonState()
  updateTop10DoubleButton()

  saveTop10State({
    immediate: true
  })

  if (
    typeof updateEndRoundButtonState ===
    "function"
  ) {
    updateEndRoundButtonState()
  }
}
/* =========================
   Double
========================= */

function activateTop10Double() {
  ensureTop10RoundState()

  const team =
    top10State.activeTeam

  const round =
    Number(top10State.round || 1)

  const opened =
    top10State.opened?.[round] || []

  if (!team) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  if (opened.length >= 10) {
    showGameToast("انتهت الجولة")
    return
  }

  if (
    top10DoubleState.activeTeam === team
  ) {
    showGameToast("الدوبيلا مفعّل")
    return
  }

  if (top10DoubleState.used[team]) {
    showGameToast(
      "هذا الفريق استخدم الدوبيلا مسبقًا"
    )

    return
  }

  if (
    top10DoubleState.used.A &&
    top10DoubleState.used.B
  ) {
    showGameToast(
      "تم استخدام الدوبيلا من الفريقين"
    )

    return
  }

  pushTop10History()

  top10DoubleState.used[team] = true
  top10DoubleState.activeTeam = team

  showGameToast(
    `تم تفعيل الدوبيلا لفريق ${
      team === "A"
        ? teamAName
        : teamBName
    }`
  )

  updateTop10DoubleButton()

  saveTop10State({
    immediate: true
  })
}

function getTop10ScoreValue(team, num) {
  return top10DoubleState.activeTeam === team ? num * 2 : num
}

function clearTop10ActiveDouble() {
  top10DoubleState.activeTeam = null
}

function updateTop10DoubleButton() {
  const btn =
    document.getElementById(
      "top10DoubleBtn"
    )

  if (!btn) return

  ensureTop10RoundState()

  const team =
    top10State.activeTeam

  const round =
    Number(top10State.round || 1)

  const roundFinished =
    Number(
      top10State.opened?.[round]?.length || 0
    ) >= 10

  btn.classList.remove(
    "activeDouble"
  )

  if (roundFinished) {
    btn.disabled = true
    btn.innerText = "انتهت الجولة"
    return
  }

  if (!team) {
    btn.disabled = true
    btn.innerText = "دوبيلا"
    return
  }

  if (
    top10DoubleState.activeTeam === team
  ) {
    btn.disabled = true
    btn.innerText = "دوبيلا مفعّل"
    btn.classList.add("activeDouble")
    return
  }

  if (
    top10DoubleState.used[team]
  ) {
    btn.disabled = true
    btn.innerText = "تم استخدام دوبيلا"
    return
  }

  btn.disabled = false
  btn.innerText = "دوبيلا"
}

/* =========================
   Undo
========================= */

function cloneTop10Data(data) {
  return JSON.parse(JSON.stringify(data))
}

function createTop10Snapshot() {
  const timerBox = document.getElementById("timer")

  return {
    top10State: cloneTop10Data(top10State),
    top10DoubleState: cloneTop10Data(top10DoubleState),
    currentTop10Answer,
    currentTop10Number,
    top10TimerStarted,
    top10MaxRound,
    timerValue: timerBox ? Number(timerBox.innerText || 0) : 0
  }
}

function pushTop10History() {
  top10History.push(createTop10Snapshot())

  if (top10History.length > TOP10_HISTORY_LIMIT) {
    top10History.shift()
  }

  updateTop10UndoButtonState()
}

function restoreTop10Snapshot(snapshot) {
  if (!snapshot) return

  clearInterval(top10Timer)
  top10Timer = null

  top10MaxRound = Math.min(
    Math.max(
      Number(
        snapshot.top10MaxRound ||
        top10MaxRound ||
        3
      ),
      1
    ),
    4
  )

  top10State =
    cloneTop10Data(
      snapshot.top10State
    )

  top10DoubleState =
    cloneTop10Data(
      snapshot.top10DoubleState || {
        used: {
          A: false,
          B: false
        },
        activeTeam: null
      }
    )

  currentTop10Answer =
    snapshot.currentTop10Answer || null

  currentTop10Number =
    snapshot.currentTop10Number !== null &&
    snapshot.currentTop10Number !== undefined
      ? Number(
          snapshot.currentTop10Number
        )
      : null

  top10TimerStarted =
    !!snapshot.top10TimerStarted

  top10LastTickPlayed = null
  top10AnimatingNumber = null

  ensureTop10RoundState()
  syncTop10Globals()
  renderCurrentRoundTop10UI()

  setTop10ActiveTeam(
    top10State.activeTeam,
    {
      sync: false,
      save: false
    }
  )

  const timerValue =
    Number(snapshot.timerValue || 0)

  if (
    top10TimerStarted &&
    timerValue > 0 &&
    top10State.activeTeam
  ) {
    resumeTop10Timer(timerValue)
  } else {
    stopTop10Timer(timerValue, {
      save: false
    })
  }

  updateTop10UndoButtonState()
  updateTop10DoubleButton()

  saveTop10State({
    immediate: true
  })

  if (
    typeof updateEndRoundButtonState ===
    "function"
  ) {
    updateEndRoundButtonState()
  }
}

function undoTop10Action() {
  if (!top10History.length) {
    showGameToast("لا يوجد خطوة للتراجع")
    return
  }

  const snapshot = top10History.pop()
  restoreTop10Snapshot(snapshot)
}

function updateTop10UndoButtonState() {
  const btn = document.getElementById("top10UndoBtn")
  if (!btn) return

  btn.disabled = top10History.length === 0
}

/* =========================
   Settings
========================= */

async function loadTop10MaxRound() {
  const cachedCount = Number(
    window.top10MaxRound ||
    localStorage.getItem(
      "top10_max_round"
    ) ||
    3
  )

  top10MaxRound = Math.min(
    Math.max(cachedCount, 1),
    4
  )

  window.top10MaxRound =
    top10MaxRound

  localStorage.setItem(
    "top10_max_round",
    String(top10MaxRound)
  )

  return top10MaxRound
}

async function loadTop10Data(
  options = {}
) {
  const modelId =
    Number(
      window.currentModel ||
      currentModel ||
      localStorage.getItem(
        "game_model"
      ) ||
      0
    )

  if (!modelId) {
    return []
  }

  if (
    top10DataCache &&
    top10DataCacheModel === modelId &&
    options.forceRefresh !== true
  ) {
    return top10DataCache
  }

  if (
    top10DataPromise &&
    options.forceRefresh !== true
  ) {
    return top10DataPromise
  }

  top10DataPromise = (async () => {
    try {
      let rows = []

      if (
        typeof window.cachedSupabaseSelect ===
        "function"
      ) {
        const result =
          await window.cachedSupabaseSelect(
            "top10_questions",
            {
              select:
                "round,position,question,answer",

              filters: {
                model: modelId
              },

              order: [
                {
                  column: "round",
                  ascending: true
                },
                {
                  column: "position",
                  ascending: true
                }
              ],

              ttl:
                TOP10_DATA_CACHE_TTL,

              forceRefresh:
                options.forceRefresh ===
                true,

              staleWhileRevalidate:
                options
                  .staleWhileRevalidate !==
                false,

              cacheKey:
                `supabase_cache_v1:top10_full:${modelId}`,

              onBackgroundUpdate:
                freshRows => {
                  top10DataCache =
                    Array.isArray(freshRows)
                      ? freshRows
                      : []

                  top10DataCacheModel =
                    modelId

                  buildTop10DataCache(
                    top10DataCache
                  )
                }
            }
          )

        rows = result.data || []

        if (
          result.error &&
          !rows.length
        ) {
          console.log(
            "TOP 10 DATA ERROR:",
            result.error
          )
        }
      } else {
        const { data, error } =
          await db
            .from("top10_questions")
            .select(
              "round,position,question,answer"
            )
            .eq("model", modelId)
            .order("round", {
              ascending: true
            })
            .order("position", {
              ascending: true
            })

        if (error) {
          throw error
        }

        rows = data || []
      }

      top10DataCache =
        Array.isArray(rows)
          ? rows
          : []

      top10DataCacheModel =
        modelId

      buildTop10DataCache(
        top10DataCache
      )

      return top10DataCache
    } catch (error) {
      console.log(
        "LOAD TOP 10 DATA ERROR:",
        error
      )

      return top10DataCache || []
    } finally {
      top10DataPromise = null
    }
  })()

  return top10DataPromise
}

function buildTop10DataCache(
  rows = []
) {
  top10RoundAnswersCache = {}

  for (
    let round = 1;
    round <= top10MaxRound;
    round++
  ) {
    const roundRows =
      rows.filter(item => {
        return (
          Number(item.round) === round
        )
      })

    const question =
      roundRows.find(item => {
        return String(
          item.question || ""
        ).trim()
      })?.question ||
      "السؤال يظهر هنا"

    top10State.question[round] =
      question

    const answerMap = {}

    roundRows.forEach(item => {
      const position =
        Number(item.position || 0)

      if (
        position < 1 ||
        position > 10
      ) {
        return
      }

      answerMap[position] = {
        position,
        answer:
          String(
            item.answer || ""
          )
      }
    })

    const key =
      getTop10RoundCacheKey(
        round
      )

    top10RoundAnswersCache[key] =
      answerMap
  }
}
/* =========================
   Render
========================= */

window.renderTop10 =
  async function () {
    clearInterval(top10Timer)
    top10Timer = null

    clearTimeout(
      top10StateSyncTimer
    )

    top10StateSyncTimer = null

    clearTimeout(
      top10SaveDelayTimer
    )

    top10SaveDelayTimer = null

    const top10CurrentModelId =
      Number(
        window.currentModel ||
        currentModel ||
        localStorage.getItem(
          "game_model"
        ) ||
        0
      )

    if (
      top10DataCacheModel &&
      top10DataCacheModel !==
        top10CurrentModelId
    ) {
      top10RoundAnswersCache = {}
      top10DataCache = null
    }

    top10DataPromise = null

    await loadTop10MaxRound()

    const saved =
      getTop10State()

    top10State =
      createEmptyTop10State(
        top10MaxRound
      )

    ensureTop10RoundState()

    top10DoubleState = {
      used: {
        A: false,
        B: false
      },
      activeTeam: null
    }

    currentTop10Answer = null
    currentTop10Number = null
    top10TimerStarted = false
    top10LastTickPlayed = null
    top10TimerEndsAt = 0
    top10AnimatingNumber = null
    top10History = []

    syncTop10Globals()

    await loadTop10Data({
      staleWhileRevalidate: true
    })

    openSegment(
      `Top 10 - الجولة ${top10State.round}`,
      buildTop10HTML()
    )

    if (saved) {
      restoreTop10State(saved)
    } else {
      setTop10ActiveTeam(null, {
        sync: false,
        save: false
      })

      updateTop10UndoButtonState()
      updateTop10DoubleButton()

      saveTop10State({
        immediate: true
      })
    }

    if (
      typeof updateEndRoundButtonState ===
      "function"
    ) {
      updateEndRoundButtonState()
    }
  }

function autoStartTop10Timer() {
  ensureTop10RoundState()

  const round =
    Number(top10State.round || 1)

  const roundFinished =
    Number(
      top10State.opened?.[round]?.length || 0
    ) >= 10

  if (
    !top10State.activeTeam ||
    roundFinished
  ) {
    stopTop10Timer(0, {
      save: false
    })

    return
  }

  clearInterval(top10Timer)
  top10Timer = null

  top10TimerStarted = true

  runTop10Timer(
    TOP10_TIMER_SECONDS
  )
}

async function loadTop10RoundQuestion(
  round
) {
  const safeRound =
    Number(round || 1)

  if (!top10DataCache) {
    await loadTop10Data({
      staleWhileRevalidate: true
    })
  }

  const roundRows =
    (top10DataCache || [])
      .filter(item => {
        return (
          Number(item.round) ===
          safeRound
        )
      })

  top10State.question[safeRound] =
    roundRows.find(item => {
      return String(
        item.question || ""
      ).trim()
    })?.question ||
    "السؤال يظهر هنا"

  return top10State.question[
    safeRound
  ]
}

function buildTop10HTML() {
  ensureTop10RoundState()

  const round = top10State.round
  const opened = top10State.opened[round] || []

  const rightSide = [1, 2, 3, 4, 5]
  const leftSide = [6, 7, 8, 9, 10]

  return `
    <div class="top10Wrap" data-segment-key="top10">

      <header class="top10Header">

        <button class="top10DockBtn" type="button" onclick="goHome()">
          رجوع
        </button>

        <div
          class="top10TeamMini teamA ${top10State.activeTeam === "A" ? "top10TeamCurrent" : ""}"
          id="top10TeamA"
          onclick="selectTop10Team('A')"
        >
          <div class="top10TeamName">
            <strong>${escapeDisplayHtml(teamAName || "الفريق الأول")}</strong>
          </div>

          <div class="top10Errors" id="top10ErrorsA">
            ${renderTop10Errors("A")}
          </div>

          <b id="top10ScoreA">${top10State.scores.A}</b>
        </div>

        <div class="top10Title">
          <h1>Top 10</h1>
          <span id="top10RoundLabel">الجولة ${round}</span>
        </div>

        <div
          class="top10TeamMini teamB ${top10State.activeTeam === "B" ? "top10TeamCurrent" : ""}"
          id="top10TeamB"
          onclick="selectTop10Team('B')"
        >
          <b id="top10ScoreB">${top10State.scores.B}</b>

          <div class="top10Errors" id="top10ErrorsB">
            ${renderTop10Errors("B")}
          </div>

          <div class="top10TeamName">
            <strong>${escapeDisplayHtml(teamBName || "الفريق الثاني")}</strong>
          </div>
        </div>

        <button
          id="endRoundBtn"
          class="top10DockBtn"
          type="button"
          onclick="endCurrentSegment()"
          disabled
        >
          إنهاء
        </button>

      </header>

      <section class="top10QuestionCard">

        <div class="top10QuestionSide">
          <span class="top10QuestionLabel">السؤال</span>

          <div class="top10QuestionText" id="top10QuestionBox">
            ${escapeDisplayHtml(top10State.question[round] || "السؤال يظهر هنا")}
          </div>
        </div>

        <div class="top10TimerPill">
  <strong id="timer">0</strong>
</div>

        

      </section>

      <section class="top10NumbersBoard">

        <div class="top10Side top10RightSide">
          ${rightSide.map(num => renderTop10Rect(num, opened)).join("")}
        </div>

        <div class="top10Side top10LeftSide">
          ${leftSide.map(num => renderTop10Rect(num, opened)).join("")}
        </div>

      </section>

      <footer class="top10ActionBar">

        <button
          onclick="activateTop10Double()"
          id="top10DoubleBtn"
          class="top10ActionBtn top10DoubleBtn"
        >
          دوبيلا
        </button>

       <button
  id="top10ShowAnswerBtn"
  type="button"
  onclick="showTop10Answer()"
  class="top10ActionBtn top10AnswerBtn"
  disabled
>
  إظهار الإجابات
</button>

        <button onclick="addTop10Error()" class="top10ActionBtn top10WrongBtn">
          خطأ
        </button>

        <button onclick="undoTop10Action()" id="top10UndoBtn" class="top10ActionBtn top10UndoBtn">
          تراجع
        </button>

        <button onclick="switchTop10Turn()" class="top10ActionBtn top10SwitchBtn">
          تبديل الدور
        </button>

        <button onclick="nextTop10Round()" class="top10ActionBtn top10NextBtn">
          الجولة التالية
        </button>

      </footer>

    </div>
  `
}

function renderTop10Rect(
  num,
  opened
) {
  const round =
    Number(top10State.round || 1)

  const number =
    Number(num || 0)

  const isOpened =
    opened.includes(number)

  const isAnimating =
    top10AnimatingNumber === number

  const answer =
    String(
      top10State
        .answers?.[round]?.[number] ||
      ""
    ).trim()

  let textSize =
    "normal"

  if (answer.length > 30) {
    textSize = "long"
  } else if (answer.length > 18) {
    textSize = "medium"
  }

  return `
    <button
      type="button"
      id="top10Number${number}"
      class="
        top10Rect
        ${isOpened ? "opened" : ""}
        ${isAnimating ? "top10RectAnimating" : ""}
      "
      data-number="${number}"
      data-num="${number}"
      data-text-size="${textSize}"
      onclick="openTop10Number(${number})"
      ${
        isOpened || isAnimating
          ? "disabled"
          : ""
      }
    >

      <span class="top10RectNumber">
        ${number}
      </span>

      <span class="top10RectAnswer">
        <span class="top10RectInner">
          ${
            isOpened
              ? escapeDisplayHtml(answer)
              : ""
          }
        </span>
      </span>

    </button>
  `
}

function renderTop10Errors(team) {
  const round = Number(top10State.round || 1)

  const count = Number(
    top10State.errors?.[round]?.[team] || 0
  )

  let html = ""

  for (let i = 0; i < 3; i++) {
    html += `
      <span class="errorMark ${i < count ? "active" : ""}">
        ✕
      </span>
    `
  }

  return html
}

function getOtherTeam(team) {
  return team === "A" ? "B" : "A"
}

function setTop10ActiveTeam(
  team,
  options = {}
) {
  const validTeam =
    team === "A" || team === "B"

  top10State.activeTeam =
    validTeam ? team : null

  window.selectedTeam =
    validTeam ? team : null

  if (validTeam) {
    if (
      typeof setGameActiveTeam ===
      "function"
    ) {
      setGameActiveTeam(team, {
        sync: false
      })
    }
  } else if (
    typeof clearGameActiveTeam ===
    "function"
  ) {
    clearGameActiveTeam({
      sync: false
    })
  }

  highlightTop10TurnTeam()
  updateTop10TurnLabel()
  updateTop10DoubleButton()

  if (options.save === true) {
    saveTop10State({
      immediate:
        options.immediate === true,

      sync:
        options.sync !== false
    })
  }

  return true
}

function applyTop10RoundStarterFromLottery(round = top10State?.round || 1) {
  if (
    typeof getTop10RoundStarterTeam !== "function" ||
    typeof setTop10ActiveTeam !== "function"
  ) {
    return false
  }

  const team =
    getTop10RoundStarterTeam(round)

  if (
    team !== "A" &&
    team !== "B"
  ) {
    return false
  }

  setTop10ActiveTeam(team, {
    sync: true,
    announce: true
  })

  if (typeof highlightTop10TurnTeam === "function") {
    highlightTop10TurnTeam()
  }

  if (typeof saveTop10State === "function") {
    saveTop10State()
  }

  return true
}

window.applyTop10RoundStarterFromLottery =
  applyTop10RoundStarterFromLottery

/* =========================
   Game Actions
========================= */

function selectTop10Team(
  team,
  options = {}
) {
  ensureTop10RoundState()

  if (team !== "A" && team !== "B") {
    return false
  }

  const force =
    options.force === true

  const round =
    Number(top10State.round || 1)

  const otherTeam =
    getOtherTeam(team)

  const teamErrors =
    Number(
      top10State.errors?.[round]?.[team] || 0
    )

  const otherErrors =
    Number(
      top10State.errors?.[round]?.[otherTeam] || 0
    )

  if (!force && teamErrors >= 3) {
    showGameToast(
      "هذا الفريق أكمل أخطاءه الثلاث"
    )

    return false
  }

  if (
    !force &&
    top10State.lastTeam === team &&
    teamErrors < 3
  ) {
    showGameToast(
      "لا يمكن لنفس الفريق اللعب مرتين متتاليتين قبل اكتمال أخطائه الثلاث"
    )

    return false
  }

  if (
    !force &&
    teamErrors > otherErrors &&
    otherErrors < 3
  ) {
    showGameToast(
      "الدور للفريق الذي لديه أخطاء أقل"
    )

    return false
  }

  if (
    top10State.activeTeam === team
  ) {
    return true
  }

  pushTop10History()

  setTop10ActiveTeam(team, {
    sync: options.sync !== false
  })

  autoStartTop10Timer()

  saveTop10State({
    immediate: true
  })

  setTimeout(() => {
    highlightTop10TurnTeam()
  }, 50)

  return true
}

function forceTop10TeamFromPresenter(team) {
  ensureTop10RoundState()

  if (team !== "A" && team !== "B") {
    return false
  }

  setTop10ActiveTeam(team, {
    sync: true,
    save: false
  })

  autoStartTop10Timer()

  saveTop10State({
    immediate: true
  })

  return true
}

window.forceTop10TeamFromPresenter =
  forceTop10TeamFromPresenter

function getTop10TeamBox(team) {
  if (team !== "A" && team !== "B") return null

  const letter = team

  return (
    document.getElementById(`top10Team${letter}Box`) ||
    document.getElementById(`top10Team${letter}`) ||
    document.getElementById(`top10Score${letter}Box`) ||
    document.getElementById(`top10ScorePanel${letter}`) ||
    document.querySelector(`[onclick="selectTop10Team('${letter}')"]`) ||
    document.querySelector(`[onclick='selectTop10Team("${letter}")']`) ||
    document.querySelector(`[data-team="${letter}"]`) ||
    document.querySelector(`.top10TeamBox.team${letter}`) ||
    document.querySelector(`.top10TeamCard.team${letter}`) ||
    document.querySelector(`.top10ScorePanel.team${letter}`)
  )
}

function highlightTop10TurnTeam() {
  const team = top10State.activeTeam

  document.querySelectorAll(".top10TeamCurrent").forEach(el => {
    el.classList.remove("top10TeamCurrent")
  })

  if (team !== "A" && team !== "B") {
    return
  }

  const box = getTop10TeamBox(team)

  if (box) {
    box.classList.remove("activeTeam", "selectedPresenterTeam")
    box.classList.add("top10TeamCurrent")
  }
}

function updateTop10TurnLabel() {
  const label = document.getElementById("top10TurnLabel")
  if (!label) return

  label.innerText =
    top10State.activeTeam === "A"
      ? teamAName
      : top10State.activeTeam === "B"
      ? teamBName
      : "اختر فريق"
}

function getTop10RoundCacheKey(round = top10State?.round) {
  return `${Number(currentModel)}_${Number(round)}`
}

async function loadTop10RoundAnswers(
  round = top10State.round
) {
  const safeRound =
    Number(round || 1)

  const key =
    getTop10RoundCacheKey(
      safeRound
    )

  if (
    top10RoundAnswersCache[key]
  ) {
    return (
      top10RoundAnswersCache[key]
    )
  }

  if (!top10DataCache) {
    await loadTop10Data({
      staleWhileRevalidate: true
    })
  }

  const map = {}

  ;(top10DataCache || [])
    .filter(item => {
      return (
        Number(item.round) ===
        safeRound
      )
    })
    .forEach(item => {
      const position =
        Number(item.position || 0)

      if (
        position < 1 ||
        position > 10
      ) {
        return
      }

      map[position] = {
        position,
        answer:
          String(
            item.answer || ""
          )
      }
    })

  top10RoundAnswersCache[key] =
    map

  return map
}

async function getTop10AnswerCached(round, num) {
  const answers = await loadTop10RoundAnswers(round)
  return answers[Number(num)] || null
}

function saveTop10StateLazy() {
  clearTimeout(top10SaveDelayTimer)

  top10SaveDelayTimer = setTimeout(() => {
    saveTop10State()
  }, 180)
}

function getTop10NumberElement(num) {
  return (
    document.querySelector(`.top10Rect[data-number="${num}"]`) ||
    document.querySelector(`.top10Rect[data-num="${num}"]`) ||
    document.querySelector(`#top10Number${num}`) ||
    Array.from(document.querySelectorAll(".top10Rect")).find(el => {
      const text = (el.textContent || "").trim()
      return text === String(num)
    })
  )
}

function playTop10OpenEffect(num) {
  requestAnimationFrame(() => {
    const el = document.querySelector(`.top10Rect[data-num="${num}"]`)
    if (!el) return

    el.classList.remove("top10RevealFx")

    requestAnimationFrame(() => {
      el.classList.add("top10RevealFx")

      setTimeout(() => {
        el.classList.remove("top10RevealFx")
      }, 520)
    })
  })
}

function stopTop10Timer(
  resetValue = 0,
  options = {}
) {
  clearInterval(top10Timer)
  top10Timer = null

  top10TimerStarted = false
  top10LastTickPlayed = null
    top10TimerStarted = false
  top10LastTickPlayed = null

  const timerBox =
    document.getElementById("timer")

  if (timerBox) {
    timerBox.innerText =
      Math.max(
        0,
        Number(resetValue || 0)
      )

    const timerPill =
      timerBox.closest(
        ".top10TimerPill"
      )

    timerPill?.classList.remove(
      "timerDanger",
      "timerTimeoutFx"
    )
  }

  if (options.save !== false) {
    saveTop10State()
  }
}

async function openTop10Number(num) {
  ensureTop10RoundState()

  const round = Number(top10State.round || 1)
  const number = Number(num || 0)

  if (!number || number < 1 || number > 10) {
    return
  }

  if (!top10State.activeTeam) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  if (
    top10AnimatingNumber !== null ||
    top10State.opened[round].includes(number)
  ) {
    return
  }

  top10AnimatingNumber = number

  const numberButton =
    getTop10NumberElement(number)

  if (numberButton) {
    numberButton.disabled = true
  }

  let data = null

  try {
    data = await getTop10AnswerCached(
      round,
      number
    )
  } catch (error) {
    console.log(
      "TOP 10 ANSWER LOAD ERROR:",
      error
    )

    top10AnimatingNumber = null

    if (numberButton) {
      numberButton.disabled = false
    }

    showGameToast("تعذر تحميل الإجابة")
    return
  }

  if (!data) {
    top10AnimatingNumber = null

    if (numberButton) {
      numberButton.disabled = false
    }

    showGameToast(
      "لا توجد إجابة لهذا الرقم"
    )

    return
  }

  pushTop10History()

  const team =
    top10State.activeTeam

  currentTop10Number = number
  currentTop10Answer =
    String(data.answer || "")

  if (
    !top10State.opened[round]
      .includes(number)
  ) {
    top10State.opened[round].push(
      number
    )
  }

  top10State.answers[round][number] =
    String(data.answer || "")

  const points =
    getTop10ScoreValue(
      team,
      number
    )

  if (team === "A") {
    top10State.scores.A += points
  }

  if (team === "B") {
    top10State.scores.B += points
  }

  clearTop10ActiveDouble()

  top10State.lastTeam = team

  const otherTeam =
    getOtherTeam(team)

  const otherErrors =
    Number(
      top10State.errors?.[round]
        ?.[otherTeam] || 0
    )

  const teamErrors =
    Number(
      top10State.errors?.[round]
        ?.[team] || 0
    )

  const allOpened =
    top10State.opened[round].length >= 10

  if (allOpened) {
    setTop10ActiveTeam(null, {
      sync: false,
      save: false
    })
  } else if (otherErrors < 3) {
    setTop10ActiveTeam(otherTeam, {
      sync: false,
      save: false
    })
  } else if (teamErrors < 3) {
    setTop10ActiveTeam(team, {
      sync: false,
      save: false
    })
  } else {
    setTop10ActiveTeam(null, {
      sync: false,
      save: false
    })
  }

  syncTop10Globals()
  updateTop10UIOnly()
  playTop10OpenEffect(number)

  top10AnimatingNumber = null

  playGameSound("correct")

  if (allOpened) {
    stopTop10Timer(0, {
      save: false
    })
  } else if (top10State.activeTeam) {
    autoStartTop10Timer()
  } else {
    stopTop10Timer(0, {
      save: false
    })
  }

  saveTop10State({
    immediate: true
  })

  if (
    typeof updateEndRoundButtonState ===
    "function"
  ) {
    updateEndRoundButtonState()
  }
}
/* =========================
   Timer
========================= */

function startTop10TimerButton() {
  if (!top10State.activeTeam) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  if (top10TimerStarted) return

  pushTop10History()

  top10TimerStarted = true
  startTop10Timer(TOP10_TIMER_SECONDS)
}

function startTop10Timer(seconds) {
  runTop10Timer(seconds)
}

function resumeTop10Timer(seconds) {
  runTop10Timer(seconds)
}

function runTop10Timer(seconds) {
  const timerBox =
    document.getElementById("timer")

  if (!timerBox) return

  clearInterval(top10Timer)
  top10Timer = null

  let time = Math.max(
    0,
    Number(seconds || 0)
  )
    top10TimerStartedAt = Date.now()
  top10TimerDuration = time
  top10TimerEndsAt =
    time > 0
      ? top10TimerStartedAt + time * 1000
      : 0

  top10TimerStarted =
    time > 0

  top10LastTickPlayed = null
  timerBox.innerText = time

  const timerPill =
    timerBox.closest(
      ".top10TimerPill"
    )

  timerPill?.classList.toggle(
    "timerDanger",
    time > 0 && time <= 5
  )

  timerPill?.classList.remove(
    "timerTimeoutFx"
  )

  saveTop10State({
    sync: false
  })

  if (time <= 0) {
    top10TimerStarted = false
    top10TimerEndsAt = 0
    return
  }

  top10Timer = setInterval(() => {
    time = Math.max(
      0,
      time - 1
    )

    timerBox.innerText = time

    timerPill?.classList.toggle(
      "timerDanger",
      time > 0 && time <= 5
    )

    if (
      time > 0 &&
      time <= 5 &&
      top10LastTickPlayed !== time
    ) {
      top10LastTickPlayed = time
      playGameSound("tick")
    }

    saveTop10State({
      sync: false
    })

    if (time > 0) return

    clearInterval(top10Timer)
    top10Timer = null

    top10TimerStarted = false
    top10LastTickPlayed = null

    timerBox.innerText = 0

    timerPill?.classList.remove(
      "timerDanger"
    )

    timerPill?.classList.add(
      "timerTimeoutFx"
    )

    setTimeout(() => {
      timerPill?.classList.remove(
        "timerTimeoutFx"
      )
    }, 900)

    playGameSound("timeout")

    saveTop10State({
      immediate: true
    })
  }, 1000)
}

/* =========================
   UI Updates
========================= */

function updateTop10Scores() {
  const a = document.getElementById("top10ScoreA")
  const b = document.getElementById("top10ScoreB")

  if (a) a.innerText = top10State.scores.A
  if (b) b.innerText = top10State.scores.B

  syncTop10Globals()
}

function updateTop10UIOnly() {
  ensureTop10RoundState()

  const round = top10State.round

  updateTop10Scores()

  const errorsA = document.getElementById("top10ErrorsA")
  const errorsB = document.getElementById("top10ErrorsB")

  if (errorsA) errorsA.innerHTML = renderTop10Errors("A")
  if (errorsB) errorsB.innerHTML = renderTop10Errors("B")

  highlightTop10TurnTeam()
  updateTop10TurnLabel()
  updateTop10DoubleButton()

  const questionBox = document.getElementById("top10QuestionBox")
  if (questionBox) {
    questionBox.innerText = top10State.question[round] || "السؤال يظهر هنا"
  }

  const roundLabel = document.getElementById("top10RoundLabel")
  if (roundLabel) {
    roundLabel.innerText = `الجولة ${round}`
  }

  const pageTitle = document.querySelector(".segmentTitle")
  if (pageTitle) {
    pageTitle.innerText = `Top 10 - الجولة ${round}`
  }

  const rightSide = [1, 2, 3, 4, 5]
  const leftSide = [6, 7, 8, 9, 10]

  const rightCol = document.querySelector(".top10RightSide")
  const leftCol = document.querySelector(".top10LeftSide")

  if (rightCol) {
    rightCol.innerHTML = rightSide
      .map(num => renderTop10Rect(num, top10State.opened[round]))
      .join("")
  }

  if (leftCol) {
    leftCol.innerHTML = leftSide
      .map(num => renderTop10Rect(num, top10State.opened[round]))
      .join("")
  }

  updateTop10UndoButtonState()
  updateTop10AnswerButton()
}

function renderCurrentRoundTop10UI() {
  ensureTop10RoundState()

  const round = top10State.round

  const roundLabel = document.getElementById("top10RoundLabel")
  if (roundLabel) roundLabel.innerText = `الجولة ${round}`

  const pageTitle = document.querySelector(".segmentTitle")
  if (pageTitle) pageTitle.innerText = `Top 10 - الجولة ${round}`

  const questionBox = document.getElementById("top10QuestionBox")
  if (questionBox) {
    questionBox.innerText = top10State.question[round] || "السؤال يظهر هنا"
  }

  const timerBox = document.getElementById("timer")
  if (timerBox && !top10TimerStarted) timerBox.innerText = 0

  updateTop10Scores()
  highlightTop10TurnTeam()
  updateTop10TurnLabel()
  updateTop10DoubleButton()

  const errorsA = document.getElementById("top10ErrorsA")
  const errorsB = document.getElementById("top10ErrorsB")

  if (errorsA) errorsA.innerHTML = renderTop10Errors("A")
  if (errorsB) errorsB.innerHTML = renderTop10Errors("B")

  const rightSide = [1, 2, 3, 4, 5]
  const leftSide = [6, 7, 8, 9, 10]

  const rightCol = document.querySelector(".top10RightSide")
  const leftCol = document.querySelector(".top10LeftSide")

  if (rightCol) {
    rightCol.innerHTML = rightSide
      .map(num => renderTop10Rect(num, top10State.opened[round]))
      .join("")
  }

  if (leftCol) {
    leftCol.innerHTML = leftSide
      .map(num => renderTop10Rect(num, top10State.opened[round]))
      .join("")
  }

  updateTop10UndoButtonState()
  updateTop10AnswerButton()
}

/* =========================
   Round Navigation
========================= */

async function nextTop10Round() {
  ensureTop10RoundState()

  const currentRound = Number(top10State.round || 1)
  const currentOpened = top10State.opened?.[currentRound] || []

  if (currentOpened.length < 10) {
    showGameToast("افتح جميع الأرقام أولاً")
    return
  }

  if (currentRound >= top10MaxRound) {
    showGameToast("هذه آخر جولة")
    return
  }

  pushTop10History()

  stopTop10Timer(0, {
    save: false
  })

  const nextRound = currentRound + 1

  top10State.round = nextRound
  top10State.lastTeam = null
  top10State.activeTeam = null
   top10DoubleState.activeTeam = null

  if (!top10State.opened[nextRound]) {
    top10State.opened[nextRound] = []
  }

  if (!top10State.answers[nextRound]) {
    top10State.answers[nextRound] = {}
  }

  if (!top10State.errors[nextRound]) {
    top10State.errors[nextRound] = {
      A: 0,
      B: 0
    }
  }

  currentTop10Answer = null
  currentTop10Number = null
  top10LastTickPlayed = null
  top10AnimatingNumber = null
  top10DoubleState.activeTeam = null

  setTop10ActiveTeam(null, {
    sync: false,
    save: false
  })

  await loadTop10RoundQuestion(nextRound)

  applyTop10RoundStarterFromLottery(nextRound)

  syncTop10Globals()
  renderCurrentRoundTop10UI()

  updateTop10AnswerButton()

  saveTop10State({
    immediate: true
  })

  if (
    typeof updateEndRoundButtonState ===
    "function"
  ) {
    updateEndRoundButtonState()
  }
}

async function prevTop10Round() {
  ensureTop10RoundState()

  const currentRound =
    Number(top10State.round || 1)

  if (currentRound <= 1) {
    showGameToast("هذه أول جولة")
    return
  }

  pushTop10History()

  stopTop10Timer(0, {
    save: false
  })

  top10State.round =
    currentRound - 1

  top10State.lastTeam = null

  currentTop10Answer = null
  currentTop10Number = null
  top10LastTickPlayed = null
  top10AnimatingNumber = null
  top10DoubleState.activeTeam = null

  setTop10ActiveTeam(null, {
    sync: false,
    save: false
  })

  await loadTop10RoundQuestion(
    top10State.round
  )

  syncTop10Globals()
renderCurrentRoundTop10UI()
updateTop10AnswerButton()

saveTop10State({
  immediate: true
})

  if (
    typeof updateEndRoundButtonState ===
    "function"
  ) {
    updateEndRoundButtonState()
  }
}

function switchTop10Turn() {
  ensureTop10RoundState()

  const team =
    top10State.activeTeam

  if (!team) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  const otherTeam =
    getOtherTeam(team)

  const otherErrors =
    Number(
      top10State.errors?.[
        top10State.round
      ]?.[otherTeam] || 0
    )

  if (otherErrors >= 3) {
    showGameToast(
      "الفريق الآخر أكمل أخطاءه الثلاث"
    )

    return
  }

  pushTop10History()

  clearTop10ActiveDouble()

  setTop10ActiveTeam(otherTeam, {
    sync: true,
    save: false
  })

  autoStartTop10Timer()

  saveTop10State({
    immediate: true
  })
}


async function showTop10Answer() {
  ensureTop10RoundState()

  const round =
    Number(
      top10State.round || 1
    )

  const errorsA =
    Number(
      top10State.errors?.[round]?.A || 0
    )

  const errorsB =
    Number(
      top10State.errors?.[round]?.B || 0
    )

  if (
    errorsA < 3 ||
    errorsB < 3
  ) {
    showGameToast(
      "لا يمكن إظهار الإجابات حتى تكتمل أخطاء الفريقين"
    )

    updateTop10AnswerButton()
    return false
  }

  let answers = null

  try {
    answers =
      await loadTop10RoundAnswers(
        round
      )
  } catch (error) {
    console.log(error)

    showGameToast(
      "تعذر تحميل الإجابات"
    )

    return false
  }

  const remainingNumbers =
    Array.from(
      {
        length: 10
      },
      (_, index) => index + 1
    ).filter(number => {
      return (
        answers?.[number] &&
        !top10State.opened?.[round]
          ?.includes(number)
      )
    })

  if (!remainingNumbers.length) {
    showGameToast(
      "تم إظهار جميع الإجابات"
    )

    updateTop10AnswerButton()
    return true
  }

  pushTop10History()

  const button =
    document.getElementById(
      "top10ShowAnswerBtn"
    )

  if (button) {
    button.disabled = true
  }

  currentTop10Number = null
  currentTop10Answer = null

  clearTop10ActiveDouble()

  setTop10ActiveTeam(null, {
    sync: false,
    save: false
  })

  stopTop10Timer(0, {
    save: false
  })

  for (
    const number of
    remainingNumbers
  ) {
    const item =
      answers[number]

    const card =
      document.querySelector(
        `.top10Rect[data-number="${number}"]`
      )

    card?.classList.add(
      "top10RevealFx"
    )

    await new Promise(resolve => {
      setTimeout(resolve, 180)
    })

    if (
      !top10State.opened[round]
        .includes(number)
    ) {
      top10State.opened[round].push(
        number
      )
    }

    top10State.answers[round][number] =
      item.answer || ""

    updateTop10UIOnly()

    if (
      typeof playGameSound ===
      "function"
    ) {
      playGameSound("answer")
    }

    await new Promise(resolve => {
      setTimeout(resolve, 110)
    })
  }

  updateTop10UIOnly()
  updateTop10AnswerButton()

  saveTop10State({
    immediate: true
  })

  if (
    typeof updateEndRoundButtonState ===
    "function"
  ) {
    updateEndRoundButtonState()
  }

  return true
}

window.showTop10Answer = showTop10Answer

function updateTop10AnswerButton() {
  const btn = document.getElementById("top10ShowAnswerBtn")
  if (!btn) return

  ensureTop10RoundState()

  const round = Number(top10State.round || 1)

  const errorsA = Number(
    top10State.errors?.[round]?.A || 0
  )

  const errorsB = Number(
    top10State.errors?.[round]?.B || 0
  )

  const openedCount = Number(
    top10State.opened?.[round]?.length || 0
  )

  const unlocked =
    errorsA >= 3 &&
    errorsB >= 3 &&
    openedCount < 10

  btn.disabled = !unlocked

  btn.classList.remove(
    "hidden",
    "top10AnswerLocked",
    "top10AnswerReady"
  )

  btn.classList.add(
    unlocked
      ? "top10AnswerReady"
      : "top10AnswerLocked"
  )
}

function addTop10Error() {
  ensureTop10RoundState()

  const team =
    top10State.activeTeam

  if (!team) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  const round =
    Number(top10State.round || 1)

  const currentErrors =
    Number(
      top10State.errors?.[round]?.[team] || 0
    )

  if (currentErrors >= 3) {
    showGameToast(
      "اكتملت أخطاء هذا الفريق"
    )

    return
  }

  pushTop10History()

  top10State.errors[round][team] =
    currentErrors + 1

  top10State.lastTeam = team

  clearTop10ActiveDouble()

  const otherTeam =
    getOtherTeam(team)

  const teamErrors =
    Number(
      top10State.errors[round][team] || 0
    )

  const otherErrors =
    Number(
      top10State.errors[round][otherTeam] || 0
    )

  if (teamErrors >= 3) {
    if (otherErrors < 3) {
      setTop10ActiveTeam(otherTeam, {
        sync: true,
        save: false
      })
    } else {
      setTop10ActiveTeam(null, {
        sync: true,
        save: false
      })
    }
  } else if (otherErrors < 3) {
    setTop10ActiveTeam(otherTeam, {
      sync: true,
      save: false
    })
  } else {
    setTop10ActiveTeam(team, {
      sync: true,
      save: false
    })
  }

playGameSound("wrong")
flashScreen("wrong")

if (
  typeof showScreenWrongCountFx ===
  "function"
) {
  showScreenWrongCountFx(
    Math.min(teamErrors, 3)
  )
}

  updateTop10UIOnly()
  updateTop10AnswerButton()

  if (top10State.activeTeam) {
    autoStartTop10Timer()
  } else {
    stopTop10Timer(0, {
      save: false
    })
  }

  saveTop10State({
    immediate: true
  })

  if (
    typeof updateEndRoundButtonState ===
    "function"
  ) {
    updateEndRoundButtonState()
  }
}
window.selectTop10Team = selectTop10Team
window.forceTop10TeamFromPresenter = forceTop10TeamFromPresenter
window.openTop10Number = openTop10Number
window.activateTop10Double = activateTop10Double
window.showTop10Answer = showTop10Answer
window.addTop10Error = addTop10Error
window.undoTop10Action = undoTop10Action
window.switchTop10Turn = switchTop10Turn
window.nextTop10Round = nextTop10Round
window.prevTop10Round = prevTop10Round
window.renderCurrentRoundTop10UI = renderCurrentRoundTop10UI
window.saveTop10State = saveTop10State