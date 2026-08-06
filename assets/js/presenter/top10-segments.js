
/* =========================
   TOP 10
========================= */

let presenterTop10Rows = []
let presenterTop10LoadedRound = null
let presenterTop10RowsPromise = null
let presenterTop10ActionBusy = false
let presenterTop10PendingNumber = null
let presenterTop10TimerInterval = null

const PRESENTER_TOP10_CACHE_TTL = 5 * 60 * 1000

/* =========================
   STATE HELPERS
========================= */

function getPresenterTop10Root() {
  return presenterLiveState?.top10 || {}
}

function getPresenterTop10State() {
  const root = getPresenterTop10Root()

  return root?.top10State || root || {
    round: 1,
    activeTeam: null,

    opened: {
      1: [],
      2: [],
      3: [],
      4: []
    },

    answers: {
      1: {},
      2: {},
      3: {},
      4: {}
    },

    question: {
      1: "",
      2: "",
      3: "",
      4: ""
    },

    errors: {
      1: { A: 0, B: 0 },
      2: { A: 0, B: 0 },
      3: { A: 0, B: 0 },
      4: { A: 0, B: 0 }
    }
  }
}

function getPresenterTop10MaxRound() {
  const root = getPresenterTop10Root()

  return Math.min(
    Math.max(
      Number(
        root?.top10MaxRound ||
        presenterLiveState?.top10MaxRound ||
        localStorage.getItem("top10_max_round") ||
        3
      ),
      1
    ),
    4
  )
}

function getPresenterTop10Round() {
  return Math.min(
    Math.max(
      Number(
        getPresenterTop10State()?.round ||
        1
      ),
      1
    ),
    getPresenterTop10MaxRound()
  )
}

function getPresenterTop10ActiveTeam() {
  const root = getPresenterTop10Root()
  const state = getPresenterTop10State()

  return (
    state?.activeTeam ||
    state?.selectedTeam ||
    root?.activeTeam ||
    root?.selectedTeam ||
    presenterSelectedTeam ||
    null
  )
}

function getPresenterTop10Opened(
  round = getPresenterTop10Round()
) {
  const top10 = getPresenterTop10State()

  return (
    top10.opened?.[round] || []
  ).map(Number)
}

function getPresenterTop10CurrentNumber() {
  const root = getPresenterTop10Root()
  const state = getPresenterTop10State()

  return Number(
    root?.currentTop10Number ||
    state?.currentTop10Number ||
    state?.currentNumber ||
    root?.currentNumber ||
    0
  )
}

function getPresenterTop10PendingScore() {
  const root = getPresenterTop10Root()
  const state = getPresenterTop10State()

  return !!(
    state?.pendingScore ||
    root?.pendingScore
  )
}

function getPresenterTop10Errors(
  round = getPresenterTop10Round()
) {
  const state = getPresenterTop10State()

  return {
    A: Number(
      state.errors?.[round]?.A || 0
    ),

    B: Number(
      state.errors?.[round]?.B || 0
    )
  }
}

function getPresenterTop10Question(
  round = getPresenterTop10Round()
) {
  const state = getPresenterTop10State()

  return (
    state.question?.[round] ||
    state.currentQuestion ||
    "اختر إجابة من القائمة"
  )
}
function getPresenterTop10DoubleState() {
  const root = getPresenterTop10Root()
  const state = getPresenterTop10State()

  return (
    root?.top10DoubleState ||
    state?.top10DoubleState ||
    {
      used: {
        A: false,
        B: false
      },
      activeTeam: null
    }
  )
}

function isPresenterTop10RoundFinished(
  round = getPresenterTop10Round()
) {
  return (
    getPresenterTop10Opened(round)
      .length >= 10
  )
}

function isPresenterTop10ShowAnswerReady(
  round = getPresenterTop10Round()
) {
  const errors =
    getPresenterTop10Errors(round)

  return (
    errors.A >= 3 &&
    errors.B >= 3 &&
    !isPresenterTop10RoundFinished(round)
  )
}

function getPresenterTop10TimerSync() {
  const root = getPresenterTop10Root()
  const state = getPresenterTop10State()

  return (
    root?.timerSync ||
    state?.timerSync ||
    presenterLiveState?.timerSync ||
    null
  )
}

function getPresenterTop10TimerStarted() {
  const root = getPresenterTop10Root()
  const state = getPresenterTop10State()

  return !!(
    root?.top10TimerStarted ||
    state?.top10TimerStarted
  )
}

/* =========================
   OPENED BY STORAGE
========================= */

function getPresenterTop10OpenedByStorageKey() {
  const sessionId =
    presenterSessionId ||
    localStorage.getItem(
      "presenter_session_id"
    ) ||
    "no_session"

  return [
    "presenter_top10_opened_by",
    sessionId,
    Number(presenterModel || 0)
  ].join("_")
}

function loadPresenterTop10OpenedBy() {
  try {
    return JSON.parse(
      localStorage.getItem(
        getPresenterTop10OpenedByStorageKey()
      ) || "{}"
    )
  } catch {
    return {}
  }
}

let presenterTop10OpenedBy =
  loadPresenterTop10OpenedBy()

function savePresenterTop10OpenedBy() {
  try {
    localStorage.setItem(
      getPresenterTop10OpenedByStorageKey(),
      JSON.stringify(
        presenterTop10OpenedBy
      )
    )
  } catch (error) {
    console.log(
      "SAVE TOP10 OPENED BY ERROR:",
      error
    )
  }
}

function getTop10OpenedTeamName(
  round,
  number
) {
  const team =
    presenterTop10OpenedBy[
      `${round}_${number}`
    ]

  if (team === "A") {
    return presenterTeamAName
  }

  if (team === "B") {
    return presenterTeamBName
  }

  return ""
}

/* =========================
   CACHE
========================= */

function getPresenterTop10CacheKey(round) {
  return [
    "presenter_top10_questions",
    Number(presenterModel || 0),
    Number(round || 1)
  ].join("_")
}

function readPresenterTop10Cache(round) {
  try {
    const saved = JSON.parse(
      localStorage.getItem(
        getPresenterTop10CacheKey(round)
      ) || "null"
    )

    if (
      !Array.isArray(saved?.rows) ||
      !saved?.savedAt
    ) {
      return null
    }

    if (
      Date.now() -
      Number(saved.savedAt) >
      PRESENTER_TOP10_CACHE_TTL
    ) {
      return null
    }

    return saved.rows
  } catch {
    return null
  }
}

function savePresenterTop10Cache(
  round,
  rows
) {
  try {
    localStorage.setItem(
      getPresenterTop10CacheKey(round),
      JSON.stringify({
        rows: Array.isArray(rows)
          ? rows
          : [],

        savedAt: Date.now()
      })
    )
  } catch (error) {
    console.log(
      "SAVE TOP10 CACHE ERROR:",
      error
    )
  }
}

async function loadPresenterTop10RoundRows(
  round,
  options = {}
) {
  const safeRound = Number(round || 1)

  if (
    presenterTop10RowsPromise &&
    options.forceRefresh !== true
  ) {
    return presenterTop10RowsPromise
  }

  if (options.forceRefresh !== true) {
    const cachedRows =
      readPresenterTop10Cache(safeRound)

    if (cachedRows?.length) {
      presenterTop10Rows = cachedRows
      presenterTop10LoadedRound = safeRound

      if (
        options.backgroundRefresh !== false
      ) {
        setTimeout(() => {
          loadPresenterTop10RoundRows(
            safeRound,
            {
              forceRefresh: true,
              backgroundRefresh: false
            }
          ).then(() => {
            if (
              presenterSegment === "top10" &&
              getPresenterTop10Round() ===
                safeRound
            ) {
              renderPresenterTop10AnswersOnly()
              refreshPresenterTop10FromState()
            }
          })
        }, 0)
      }

      return cachedRows
    }
  }

  presenterTop10RowsPromise =
    (async () => {
      try {
        const { data, error } = await db
          .from("top10_questions")
          .select(`
            round,
            position,
            question,
            answer
          `)
          .eq(
            "model",
            Number(presenterModel)
          )
          .eq("round", safeRound)
          .order("position", {
            ascending: true
          })

        if (error) {
          console.log(
            "LOAD PRESENTER TOP10 ERROR:",
            error
          )

          return presenterTop10Rows
        }

        presenterTop10Rows =
          Array.isArray(data)
            ? data
            : []

        presenterTop10LoadedRound =
          safeRound

        savePresenterTop10Cache(
          safeRound,
          presenterTop10Rows
        )

        return presenterTop10Rows
      } catch (error) {
        console.log(
          "LOAD PRESENTER TOP10 CATCH:",
          error
        )

        return presenterTop10Rows
      } finally {
        presenterTop10RowsPromise = null
      }
    })()

  return presenterTop10RowsPromise
}

async function sendPresenterTop10CommandSafe(
  action,
  payload = {}
) {
  if (typeof sendCommand !== "function") {
    return false
  }

  try {
    const result = await Promise.race([
      sendCommand(action, {
        ...payload,
        segment: "top10"
      }),

      new Promise(resolve => {
        setTimeout(() => {
          resolve(false)
        }, 2500)
      })
    ])

    return result !== false
  } catch (error) {
    console.log(
      "PRESENTER TOP10 COMMAND ERROR:",
      error
    )

    return false
  }
}

/* =========================
   HTML HELPERS
========================= */

function escapePresenterTop10Html(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function getPresenterTop10Row(number) {
  return presenterTop10Rows.find(row => {
    return (
      Number(row.position) ===
      Number(number)
    )
  })
}

function buildPresenterTop10AnswerButton(
  number
) {
  const round =
    getPresenterTop10Round()

  const opened =
    getPresenterTop10Opened(round)

  const currentNumber =
    getPresenterTop10CurrentNumber()

  const activeTeam =
    getPresenterTop10ActiveTeam()

  const row =
    getPresenterTop10Row(number)

  const isOpened =
    opened.includes(Number(number))

  const isCurrent =
    currentNumber === Number(number)

  const isPending =
    presenterTop10PendingNumber ===
    Number(number)

  const disabled =
    isOpened ||
    isPending ||
    presenterTop10ActionBusy ||
    !activeTeam

  return `
    <button
      type="button"
      class="
        presenterTop10AnswerBtn
        ${isOpened ? "opened" : ""}
        ${isCurrent ? "current" : ""}
        ${isPending ? "pending" : ""}
      "
      data-top10-number="${number}"
      ${disabled ? "disabled" : ""}
      onclick="openTop10PresenterNumber(${number}, event)"
    >
      <span class="presenterTop10AnswerNo">
        ${number}
      </span>

      <span class="presenterTop10AnswerText">
        ${escapePresenterTop10Html(row?.answer || "-")}
      </span>
    </button>
  `
}

function buildPresenterTop10AnswersHtml() {
  return `
    <div class="
      presenterTop10AnswersCol
      presenterTop10RightCol
    ">
      ${[1, 2, 3, 4, 5]
        .map(number => {
          return buildPresenterTop10AnswerButton(
            number
          )
        })
        .join("")}
    </div>

    <div class="
      presenterTop10AnswersCol
      presenterTop10LeftCol
    ">
      ${[6, 7, 8, 9, 10]
        .map(number => {
          return buildPresenterTop10AnswerButton(
            number
          )
        })
        .join("")}
    </div>
  `
}

function renderPresenterTop10AnswersOnly() {
  const box =
    document.getElementById(
      "presenterTop10AnswersCols"
    )

  if (!box) return

  box.innerHTML =
    buildPresenterTop10AnswersHtml()
}

/* =========================
   MAIN RENDER
========================= */

async function renderTop10() {
  const panel =
    document.getElementById(
      "presenterPanel"
    )

  if (!panel) return

  const round =
    getPresenterTop10Round()

  presenterTop10OpenedBy =
    loadPresenterTop10OpenedBy()

  const cachedRows =
    readPresenterTop10Cache(round)

  if (cachedRows?.length) {
    presenterTop10Rows = cachedRows
    presenterTop10LoadedRound = round
  }

  const errors =
    getPresenterTop10Errors(round)

  panel.dataset.segment = "top10"

  panel.innerHTML = `
    <section
      class="presenterTop10Screen"
      aria-label="لوحة تحكم Top 10"
    >

      <main class="presenterTop10Main">

        <section
          class="presenterCard presenterTop10AnswersCard"
          aria-label="إجابات Top 10"
        >
          <div
            id="presenterTop10AnswersCols"
            class="presenterTop10AnswersCols"
          >
            ${
              presenterTop10Rows.length
                ? buildPresenterTop10AnswersHtml()
                : `
                  <div class="presenterTop10Loading">
                    ${getPresenterLoadingMarkup(
                      "جارٍ تحميل الإجابات..."
                    )}
                  </div>
                `
            }
          </div>
        </section>

        <section
          class="presenterCard presenterTop10ControlCard"
          aria-label="تحكم Top 10"
        >

          <div class="presenterTop10RoundLine">

            <div class="presenterTop10RoundBadge">
              <span>الجولة</span>

              <strong id="presenterTop10RoundText">
                ${round}
              </strong>
            </div>

            <div
              id="presenterTop10Timer"
              class="presenterTop10Timer"
            >
              —
            </div>

          </div>

          <div class="presenterTop10ErrorsLine">

            <div class="presenterTop10ErrorMiniBox teamA">
              <span>A</span>

              <strong id="presenterTop10ErrorsA">
                ${errors.A} / 3
              </strong>
            </div>

            <div class="presenterTop10ErrorMiniBox teamB">
              <span>B</span>

              <strong id="presenterTop10ErrorsB">
                ${errors.B} / 3
              </strong>
            </div>

          </div>

          <div
            id="presenterTop10QuestionText"
            class="presenterTop10QuestionText"
            aria-live="polite"
          >
            ${escapePresenterTop10Html(
              getPresenterTop10Question(round)
            )}
          </div>

          <div
            class="presenterTop10Actions"
            aria-label="أزرار التحكم"
          >

            <button
              type="button"
              id="presenterTop10DoubleBtn"
              class="presenterBtn presenterTop10DoubleBtn"
              onclick="runPresenterTop10Action('double')"
            >
              دوببلا
            </button>

            <button
              type="button"
              id="presenterTop10ShowAnswerBtn"
              class="presenterBtn presenterTop10ShowAnswerBtn"
              onclick="runPresenterTop10Action('showAnswer')"
            >
              الإجابات
            </button>

            <button
              type="button"
              id="presenterTop10WrongBtn"
              class="presenterBtn presenterTop10WrongBtn"
              onclick="runPresenterTop10Action('wrong')"
            >
              خطأ
            </button>

            <button
              type="button"
              id="presenterTop10UndoBtn"
              class="presenterBtn presenterTop10UndoBtn"
              onclick="runPresenterTop10Action('undo')"
            >
              تراجع
            </button>

            <button
              type="button"
              id="presenterTop10SwitchBtn"
              class="presenterBtn presenterTop10SwitchBtn"
              onclick="runPresenterTop10Action('switchTurn')"
            >
              تبديل
            </button>

            <button
              type="button"
              id="presenterTop10NextRoundBtn"
              class="presenterBtn presenterTop10NextRoundBtn"
              onclick="runPresenterTop10Action('nextRound')"
            >
              التالي
            </button>

          </div>

        </section>

      </main>

    </section>
  `

  refreshPresenterTop10FromState()
  startPresenterTop10TimerWatcher()

  if (!presenterTop10Rows.length) {
    await loadPresenterTop10RoundRows(
      round,
      {
        backgroundRefresh: false
      }
    )

    if (
      presenterSegment !== "top10" ||
      getPresenterTop10Round() !== round
    ) {
      return
    }

    renderPresenterTop10AnswersOnly()
    refreshPresenterTop10FromState()
    return
  }

  loadPresenterTop10RoundRows(
    round,
    {
      backgroundRefresh: false
    }
  ).then(() => {
    if (
      presenterSegment !== "top10" ||
      getPresenterTop10Round() !== round
    ) {
      return
    }

    renderPresenterTop10AnswersOnly()
    refreshPresenterTop10FromState()
  })
}


/* =========================
   OPEN ANSWER
========================= */

async function openTop10PresenterNumber(
  number,
  event
) {
  const safeNumber =
    Number(number || 0)

  if (
    !safeNumber ||
    presenterTop10ActionBusy ||
    presenterTop10PendingNumber
  ) {
    return
  }

  const round =
    getPresenterTop10Round()

  const opened =
    getPresenterTop10Opened(round)

  const activeTeam =
    getPresenterTop10ActiveTeam()

  if (!activeTeam) {
    showToast("اختر الفريق أولاً")
    return
  }

  if (opened.includes(safeNumber)) {
    showToast("الإجابة مفتوحة")
    return
  }

  presenterTop10PendingNumber =
    safeNumber

  presenterTop10ActionBusy = true

  presenterTop10OpenedBy[
    `${round}_${safeNumber}`
  ] = activeTeam

  savePresenterTop10OpenedBy()

  const teamName =
    activeTeam === "A"
      ? presenterTeamAName
      : presenterTeamBName

  const button =
    event?.currentTarget

  if (button) {
    button.classList.add(
      "opened",
      "pending",
      "top10RevealFx"
    )

    button.disabled = true

    const openedByBox =
      button.querySelector(
        ".presenterTop10OpenedBy"
      )

    if (openedByBox) {
      openedByBox.innerText =
        teamName
    }

    setTimeout(() => {
      button.classList.remove(
        "top10RevealFx"
      )
    }, 350)
  }

  /*
    تحديث محلي فوري للمقدم.
  */
  const currentState =
    getPresenterTop10State()

  presenterLiveState = {
    ...(presenterLiveState || {}),

    top10: {
      ...(presenterLiveState?.top10 || {}),

      activeTeam,

      top10State: {
        ...currentState,
        activeTeam,
        currentNumber: safeNumber,
        pendingScore: true,

        opened: {
          ...(currentState.opened || {}),

          [round]: Array.from(
            new Set([
              ...opened,
              safeNumber
            ])
          )
        }
      }
    }
  }

  refreshPresenterTop10FromState()

const sent =
  await sendPresenterTop10CommandSafe(
    "openNumber",
    {
      number: safeNumber,
      round,
      team: activeTeam
    }
  )

  presenterTop10ActionBusy = false

  if (!sent) {
    delete presenterTop10OpenedBy[
      `${round}_${safeNumber}`
    ]

    savePresenterTop10OpenedBy()

    presenterTop10PendingNumber = null

    showToast("تعذر فتح الإجابة")

    if (
      typeof fetchPresenterSessionNow ===
      "function"
    ) {
      fetchPresenterSessionNow(
        presenterSessionId,
        true
      )
    }

    return
  }

  setTimeout(() => {
    presenterTop10PendingNumber = null
    presenterTop10ActionBusy = false

    refreshPresenterTop10FromState()
  }, 220)
}

/* =========================
   ACTIONS
========================= */

async function runPresenterTop10Action(
  action
) {
  if (presenterTop10ActionBusy) {
    return
  }

  const round =
    getPresenterTop10Round()

  const activeTeam =
    getPresenterTop10ActiveTeam()

  const currentNumber =
    getPresenterTop10CurrentNumber()

  const maxRound =
    getPresenterTop10MaxRound()

  const roundFinished =
    isPresenterTop10RoundFinished(round)

  const showAnswerReady =
    isPresenterTop10ShowAnswerReady(round)

  const doubleState =
    getPresenterTop10DoubleState()

  const doubleUsed =
    activeTeam
      ? !!doubleState?.used?.[activeTeam]
      : false

  const doubleActive =
    activeTeam &&
    doubleState?.activeTeam === activeTeam

  if (action === "double") {
    if (!activeTeam) {
      showToast("اختر الفريق أولاً")
      return
    }

    if (roundFinished) {
      showToast("انتهت الجولة")
      return
    }

    if (doubleActive) {
      showToast("دوببلا مفعّل")
      return
    }

    if (doubleUsed) {
      showToast("تم استخدام دوببلا لهذا الفريق")
      return
    }
  }

  if (action === "wrong") {
    if (!activeTeam) {
      showToast("اختر الفريق أولاً")
      return
    }

    if (roundFinished) {
      showToast("انتهت الجولة")
      return
    }
  }

  if (action === "showAnswer") {
    if (!showAnswerReady) {
      showToast(
        "إظهار الإجابات بعد اكتمال أخطاء الفريقين"
      )
      return
    }
  }

  if (action === "nextRound") {
    if (round >= maxRound) {
      showToast("هذه آخر جولة")
      return
    }

    if (!roundFinished) {
      showToast("افتح جميع الإجابات أولاً")
      return
    }
  }

  presenterTop10ActionBusy = true
  updatePresenterTop10ActionButtons()

  if (
    action === "switchTurn" &&
    activeTeam &&
    !roundFinished
  ) {
    const nextTeam =
      activeTeam === "A" ? "B" : "A"

    presenterSelectedTeam = nextTeam

    setPresenterLocalActiveTeam(
      nextTeam
    )

    updatePresenterTeamButtonsOnly(
      nextTeam
    )
  }

const sent =
  await sendPresenterTop10CommandSafe(
    action,
    {
      round,
      team: activeTeam,
      number: currentNumber || null
    }
  )

  if (!sent) {
    presenterTop10ActionBusy = false

    updatePresenterTop10ActionButtons()

    showToast("تعذر تنفيذ الأمر")

    if (
      typeof fetchPresenterSessionNow ===
      "function"
    ) {
      fetchPresenterSessionNow(
        presenterSessionId,
        true
      )
    }

    return
  }

  if (action === "nextRound") {
    const nextRound =
      Math.min(round + 1, maxRound)

    applyPresenterTop10LocalRound(
      nextRound
    )

    await ensurePresenterTop10RoundLoaded(
      nextRound
    )
  }

setTimeout(() => {
  presenterTop10ActionBusy = false

  refreshPresenterTop10FromState()
  updatePresenterTop10ActionButtons()
  updatePresenterTop10Timer()
}, 300)
}

function updatePresenterTop10ActionButtons() {
  const activeTeam =
    getPresenterTop10ActiveTeam()

  const round =
    getPresenterTop10Round()

  const maxRound =
    getPresenterTop10MaxRound()

  const roundFinished =
    isPresenterTop10RoundFinished(round)

  const showAnswerReady =
    isPresenterTop10ShowAnswerReady(round)

  const doubleState =
    getPresenterTop10DoubleState()

  const doubleUsed =
    activeTeam
      ? !!doubleState?.used?.[activeTeam]
      : false

  const doubleActive =
    activeTeam &&
    doubleState?.activeTeam === activeTeam

  const busy =
    presenterTop10ActionBusy

  const doubleButton =
    document.getElementById(
      "presenterTop10DoubleBtn"
    )

  const showAnswerButton =
    document.getElementById(
      "presenterTop10ShowAnswerBtn"
    )

  const wrongButton =
    document.getElementById(
      "presenterTop10WrongBtn"
    )

  const undoButton =
    document.getElementById(
      "presenterTop10UndoBtn"
    )

  const switchButton =
    document.getElementById(
      "presenterTop10SwitchBtn"
    )

  const nextRoundButton =
    document.getElementById(
      "presenterTop10NextRoundBtn"
    )

  if (doubleButton) {
    doubleButton.disabled =
      busy ||
      !activeTeam ||
      roundFinished ||
      doubleUsed ||
      doubleActive

    doubleButton.innerText =
      doubleActive
        ? "دوببلا مفعّل"
        : doubleUsed
        ? "تم استخدام دوببلا"
        : "دوببلا"
  }

  if (showAnswerButton) {
    showAnswerButton.disabled =
      busy ||
      !showAnswerReady
  }

  if (wrongButton) {
    wrongButton.disabled =
      busy ||
      !activeTeam ||
      roundFinished
  }

  if (undoButton) {
    undoButton.disabled = busy
  }

  if (switchButton) {
    switchButton.disabled =
      busy ||
      !activeTeam ||
      roundFinished
  }

  if (nextRoundButton) {
    nextRoundButton.disabled =
      busy ||
      round >= maxRound ||
      !roundFinished

    nextRoundButton.innerText =
      round >= maxRound
        ? "آخر جولة"
        : "الجولة التالية"
  }
}

/* =========================
   ROUND
========================= */

function applyPresenterTop10LocalRound(
  round
) {
  const maxRound =
    getPresenterTop10MaxRound()

  const safeRound =
    Math.min(
      Math.max(
        Number(round || 1),
        1
      ),
      maxRound
    )

  const currentState =
    getPresenterTop10State()

  presenterLiveState = {
    ...(presenterLiveState || {}),

    top10: {
      ...(presenterLiveState?.top10 || {}),

      top10State: {
        ...currentState,
        round: safeRound,
        currentNumber: null,
        currentQuestion: null,
        pendingScore: false
      }
    }
  }

  presenterTop10PendingNumber = null
}

async function ensurePresenterTop10RoundLoaded(
  round
) {
  const safeRound = Number(round || 1)

  const cachedRows =
    readPresenterTop10Cache(safeRound)

  if (cachedRows?.length) {
    presenterTop10Rows = cachedRows
    presenterTop10LoadedRound = safeRound

    renderPresenterTop10AnswersOnly()
    refreshPresenterTop10FromState()

    loadPresenterTop10RoundRows(
      safeRound,
      {
        backgroundRefresh: false
      }
    )

    return
  }

  presenterTop10Rows = []
  presenterTop10LoadedRound = null

  const answersBox =
    document.getElementById(
      "presenterTop10AnswersCols"
    )

  if (answersBox) {
    answersBox.innerHTML = `
      <div class="presenterTop10Loading">
        جارٍ تحميل الجولة...
      </div>
    `
  }

  await loadPresenterTop10RoundRows(
    safeRound,
    {
      backgroundRefresh: false
    }
  )

  if (
    presenterSegment !== "top10" ||
    getPresenterTop10Round() !== safeRound
  ) {
    return
  }

  renderPresenterTop10AnswersOnly()
  refreshPresenterTop10FromState()
}

async function setPresenterTop10Round(
  round
) {
  const maxRound =
    getPresenterTop10MaxRound()

  const safeRound =
    Math.min(
      Math.max(
        Number(round || 1),
        1
      ),
      maxRound
    )

  if (
    safeRound ===
    getPresenterTop10Round()
  ) {
    return
  }

  applyPresenterTop10LocalRound(
    safeRound
  )

  await ensurePresenterTop10RoundLoaded(
    safeRound
  )

  const sent = await sendCommand(
    "setRound",
    {
      round: safeRound
    }
  )

  if (!sent) {
    showToast("تعذر تغيير الجولة")

    if (
      typeof fetchPresenterSessionNow ===
      "function"
    ) {
      fetchPresenterSessionNow(
        presenterSessionId,
        true
      )
    }
  }
}



/* =========================
   REFRESH FROM DISPLAY
========================= */

function getPresenterTop10RemainingSeconds() {
  const timerSync =
    getPresenterTop10TimerSync()

  const endsAt =
    Number(timerSync?.endsAt || 0)

  if (endsAt > 0) {
    return Math.max(
      0,
      Math.ceil(
        (endsAt - Date.now()) / 1000
      )
    )
  }

  const root =
    getPresenterTop10Root()

  const state =
    getPresenterTop10State()

  return Math.max(
    0,
    Number(
      root?.timerValue ??
      state?.timerValue ??
      0
    )
  )
}

function updatePresenterTop10Timer() {
  const timerBox =
    document.getElementById(
      "presenterTop10Timer"
    )

  if (!timerBox) return

  const activeTeam =
    getPresenterTop10ActiveTeam()

  const timerSync =
    getPresenterTop10TimerSync()

  const timerStarted =
    getPresenterTop10TimerStarted()

  if (
    !activeTeam &&
    !timerStarted &&
    !timerSync?.endsAt
  ) {
    timerBox.innerText = "—"

    timerBox.classList.remove(
      "timerRunning",
      "timerDanger",
      "timerFinished"
    )

    return
  }

  const remaining =
    getPresenterTop10RemainingSeconds()

  timerBox.innerText =
    String(remaining)

  timerBox.classList.toggle(
    "timerRunning",
    remaining > 5
  )

  timerBox.classList.toggle(
    "timerDanger",
    remaining > 0 &&
    remaining <= 5
  )

  timerBox.classList.toggle(
    "timerFinished",
    remaining === 0
  )
}

function startPresenterTop10TimerWatcher() {
  stopPresenterTop10TimerWatcher()

  updatePresenterTop10Timer()

  presenterTop10TimerInterval =
    setInterval(() => {
      if (presenterSegment !== "top10") {
        stopPresenterTop10TimerWatcher()
        return
      }

      updatePresenterTop10Timer()
    }, 250)
}

function stopPresenterTop10TimerWatcher() {
  if (presenterTop10TimerInterval) {
    clearInterval(
      presenterTop10TimerInterval
    )

    presenterTop10TimerInterval = null
  }
}

async function refreshPresenterTop10FromState() {
  if (presenterSegment !== "top10") {
    stopPresenterTop10TimerWatcher()
    return
  }

  const round =
    getPresenterTop10Round()

  if (
    presenterTop10LoadedRound !==
    round
  ) {
    await ensurePresenterTop10RoundLoaded(
      round
    )

    return
  }

  const opened =
    getPresenterTop10Opened(round)

  const errors =
    getPresenterTop10Errors(round)

  const activeTeam =
    getPresenterTop10ActiveTeam()

  const currentNumber =
    getPresenterTop10CurrentNumber()

      const roundFinished =
    isPresenterTop10RoundFinished(round)

  updatePresenterTeamButtonsOnly(
    activeTeam
  )

  const roundText =
    document.getElementById(
      "presenterTop10RoundText"
    )

  if (roundText) {
    roundText.innerText =
      String(round)
  }

  const questionBox =
    document.getElementById(
      "presenterTop10QuestionText"
    )

  if (questionBox) {
    questionBox.innerText =
      getPresenterTop10Question(round)
  }

  const errorsABox =
    document.getElementById(
      "presenterTop10ErrorsA"
    )

  const errorsBBox =
    document.getElementById(
      "presenterTop10ErrorsB"
    )

  if (errorsABox) {
    errorsABox.innerText =
      `${errors.A} / 3`
  }

  if (errorsBBox) {
    errorsBBox.innerText =
      `${errors.B} / 3`
  }

  const statusBox =
    document.getElementById(
      "presenterTop10StatusText"
    )

  if (statusBox) {
    if (roundFinished) {
      statusBox.innerText =
        "انتهت الجولة"
    } else if (!activeTeam) {
      statusBox.innerText =
        "اختر الفريق أولاً"
    } else {
      const teamName =
        activeTeam === "A"
          ? presenterTeamAName
          : presenterTeamBName

      statusBox.innerText =
        `الدور على ${teamName}`
    }
  }

  document
    .querySelectorAll(
      ".presenterTop10AnswerBtn"
    )
    .forEach(button => {
      const number =
        Number(
          button.dataset.top10Number ||
          0
        )

      if (!number) return

      const isOpened =
        opened.includes(number)

      const isCurrent =
        currentNumber === number

      const isPending =
        presenterTop10PendingNumber ===
        number

      const row =
        getPresenterTop10Row(number)

      const answer =
        getPresenterTop10State()
          .answers?.[round]?.[number] ||
        row?.answer ||
        "-"

      button.classList.toggle(
        "opened",
        isOpened
      )

      button.classList.toggle(
        "current",
        isCurrent
      )

      button.classList.toggle(
        "pending",
        isPending
      )

      button.disabled =
        isOpened ||
        isPending ||
        presenterTop10ActionBusy ||
        !activeTeam ||
        roundFinished

      const textBox =
        button.querySelector(
          ".presenterTop10AnswerText"
        )

      if (textBox) {
        textBox.innerText = answer
      }

      const openedByBox =
        button.querySelector(
          ".presenterTop10OpenedBy"
        )

      if (openedByBox) {
        const openedTeamName =
          getTop10OpenedTeamName(
            round,
            number
          )

        openedByBox.innerText =
          isOpened || isPending
            ? (
                openedTeamName ||
                (
                  isPending
                    ? "جارٍ الفتح..."
                    : "تم الفتح"
                )
              )
            : ""
      }
    })

  updatePresenterTop10ActionButtons()
    updatePresenterTop10Timer()
}

window.addEventListener(
  "beforeunload",
  stopPresenterTop10TimerWatcher
)

/* =========================
   Reader: Top 10
   كل جولة تعرض السؤال وجميع الإجابات مباشرة
========================= */

async function renderPresenterReaderTop10() {
  const panel =
    document.getElementById(
      "presenterReaderPanel"
    )

  if (!panel) return

  const { data, error } = await db
    .from("top10_questions")
    .select(`
      round,
      position,
      question,
      answer
    `)
    .eq(
      "model",
      Number(presenterModel)
    )
    .order("round", {
      ascending: true
    })
    .order("position", {
      ascending: true
    })

  if (error) throw error

  const rows =
    Array.isArray(data)
      ? data
      : []

  if (!rows.length) {
    panel.innerHTML =
      readerEmpty(
        "لا توجد بيانات في Top 10"
      )

    return
  }

  const rounds =
    [...new Set(
      rows.map(row => {
        return Number(row.round || 0)
      })
    )]
      .filter(Boolean)
      .sort((a, b) => a - b)

  panel.innerHTML = `
    <section class="readerRoundsStack">
      ${rounds
        .map(round => {
          const roundRows =
            rows.filter(row => {
              return Number(row.round) === Number(round)
            })

          const question =
            roundRows[0]?.question || "—"

          return `
            <section class="readerRoundPage">

              <header class="readerRoundHead">
                <h2>الجولة ${round}</h2>
                <span>Top 10</span>
              </header>

              <article class="readerQuestionCard">
                ${escapePresenterTop10Html(question)}
              </article>

              <div class="readerSimpleGrid">
                ${roundRows
                  .map(row => {
                    return `
                      <article class="readerMiniCard">
                        <div class="readerBlock">
                          <label>الرقم</label>
                          <p>${Number(row.position || 0)}</p>
                        </div>

                        <div class="readerBlock">
                          <label>الإجابة</label>
                          <p>${escapePresenterTop10Html(row.answer || "—")}</p>
                        </div>
                      </article>
                    `
                  })
                  .join("")}
              </div>

            </section>
          `
        })
        .join("")}
    </section>
  `
}
