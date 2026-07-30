/* =========================
   LETTERLI / حرفلي
========================= */

let presenterLetterliActionBusy = false
let presenterLetterliTimerWatcher = null

const PRESENTER_LETTERLI_TIMER_SECONDS = 5

const PRESENTER_LETTERLI_ACTIONS = Object.freeze({
  spin: "letterliStartSpin",
  changeQuestion: "letterliChangeQuestion",
  showQuestion: "letterliShowQuestion",
  showAnswer: "letterliShowAnswer",
  startTimer: "letterliStartTimer",
  scoreA: "letterliScoreTeam",
  scoreB: "letterliScoreTeam"
})

async function sendPresenterLetterliCommandSafe(
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
        segment: "letterli"
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
      "PRESENTER LETTERLI COMMAND ERROR:",
      error
    )

    return false
  }
}

/* =========================
   1) STATE
========================= */

function getPresenterLetterliRoot() {
  return presenterLiveState?.letterli || {}
}

function getPresenterLetterliState() {
  const root = getPresenterLetterliRoot()

  return root?.letterliState || root || {}
}

function getPresenterLetterliCurrentItem() {
  const root = getPresenterLetterliRoot()
  const state = getPresenterLetterliState()

  const currentQuestion =
    state.currentQuestion ||
    root.currentQuestion ||
    state.currentItem ||
    state.currentQuestionItem ||
    root.currentItem ||
    root.currentQuestionItem ||
    null

  if (
    currentQuestion &&
    typeof currentQuestion === "object"
  ) {
    return currentQuestion
  }

  return {
    question:
      typeof currentQuestion === "string"
        ? currentQuestion
        : "",
    answer:
      state.currentAnswer ||
      state.answer ||
      root.currentAnswer ||
      root.answer ||
      "",
    letter:
      state.currentLetter ||
      state.letter ||
      root.currentLetter ||
      root.letter ||
      ""
  }
}

function getPresenterLetterliQuestion() {
  const root = getPresenterLetterliRoot()
  const state = getPresenterLetterliState()
  const item = getPresenterLetterliCurrentItem()

  return String(
    item.question ??
    state.question ??
    root.question ??
    ""
  ).trim()
}

function getPresenterLetterliAnswer() {
  const root = getPresenterLetterliRoot()
  const state = getPresenterLetterliState()
  const item = getPresenterLetterliCurrentItem()

  return String(
    item.answer ??
    state.currentAnswer ??
    state.answer ??
    root.currentAnswer ??
    root.answer ??
    ""
  ).trim()
}

function getPresenterLetterliLetter() {
  const root = getPresenterLetterliRoot()
  const state = getPresenterLetterliState()
  const item = getPresenterLetterliCurrentItem()

  return String(
    state.currentLetter ??
    item.letter ??
    state.letter ??
    root.currentLetter ??
    root.letter ??
    ""
  ).trim()
}

function getPresenterLetterliQuestionVisible() {
  const root = getPresenterLetterliRoot()
  const state = getPresenterLetterliState()

  return !!(
    state.questionVisible ??
    root.questionVisible ??
    false
  )
}

function getPresenterLetterliAnswerVisible() {
  const root = getPresenterLetterliRoot()
  const state = getPresenterLetterliState()

  return !!(
    state.answerVisible ??
    root.answerVisible ??
    false
  )
}

function getPresenterLetterliSpinning() {
  const root = getPresenterLetterliRoot()
  const state = getPresenterLetterliState()

  return !!(
    state.spinning ??
    root.spinning ??
    false
  )
}

function getPresenterLetterliTimerSync() {
  const root = getPresenterLetterliRoot()
  const state = getPresenterLetterliState()

  return (
    root.letterliTimerSync ||
    root.timerSync ||
    state.timerSync ||
    null
  )
}

function getPresenterLetterliTimerValue() {
  const timerSync =
    getPresenterLetterliTimerSync()

  if (
    timerSync &&
    Number(timerSync.endsAt || 0) > Date.now()
  ) {
    return Math.max(
      0,
      Math.ceil(
        (
          Number(timerSync.endsAt) -
          Date.now()
        ) / 1000
      )
    )
  }

  const root = getPresenterLetterliRoot()
  const state = getPresenterLetterliState()

  return Number(
    state.timerValue ??
    root.timerValue ??
    PRESENTER_LETTERLI_TIMER_SECONDS
  )
}

function isPresenterLetterliTimerRunning() {
  const timerSync =
    getPresenterLetterliTimerSync()

  return !!(
    timerSync &&
    Number(timerSync.endsAt || 0) > Date.now()
  )
}

function getPresenterLetterliScore(team) {
  const state = getPresenterLetterliState()

  if (team === "A") {
    return Number(
      state.scoreA ??
      state.scores?.A ??
      0
    )
  }

  if (team === "B") {
    return Number(
      state.scoreB ??
      state.scores?.B ??
      0
    )
  }

  return 0
}

function getPresenterLetterliPosition() {
  const state = getPresenterLetterliState()
  const hasQuestion =
    !!getPresenterLetterliQuestion()

  const completed =
    Number(
      state.completedCount ??
      state.answeredCount ??
      0
    )

  return {
    current:
      hasQuestion
        ? completed + 1
        : completed || 0,
    total: 0
  }
}

/* =========================
   2) RENDER
========================= */

function renderPresenterLetterli() {
  const panel =
    document.getElementById("presenterPanel")

  if (!panel) return

  const teamA =
    typeof teamAName !== "undefined"
      ? teamAName
      : "الفريق الأول"

  const teamB =
    typeof teamBName !== "undefined"
      ? teamBName
      : "الفريق الثاني"

  panel.dataset.segment = "letterli"

  panel.innerHTML = `
    <section class="presenterLetterliControlView">

      <header class="presenterLetterliControlHeader">

        <div class="presenterLetterliInfoCard">
          <span>السؤال</span>
          <strong id="presenterLetterliPositionText">—</strong>
        </div>

        <div class="presenterLetterliInfoCard active">
          <span>الحرف</span>
          <strong id="presenterLetterliCurrentLetter">—</strong>
        </div>

        <div class="presenterLetterliInfoCard timer">
          <span>الوقت</span>
          <strong id="presenterLetterliTimerText">5</strong>
        </div>

        <div class="presenterLetterliVisibilityCard">
          <span id="presenterLetterliQuestionVisibility">—</span>
          <span id="presenterLetterliAnswerVisibility">—</span>
        </div>

      </header>

      <main class="presenterLetterliControlMain">

        <section class="presenterLetterliPanel">

          <header class="presenterLetterliPanelTitle">
            <h2>السؤال</h2>
          </header>

          <div
            id="presenterLetterliQuestionText"
            class="presenterLetterliQuestionText"
          >
            —
          </div>

        </section>

        <section class="presenterLetterliPanel">

          <header class="presenterLetterliPanelTitle">
            <h2>الإجابة</h2>
          </header>

          <div
            id="presenterLetterliAnswerText"
            class="presenterLetterliAnswerText"
          >
            —
          </div>

        </section>

      </main>

      <footer class="presenterLetterliCommandBar">

        <button
          id="presenterLetterliSpinBtn"
          type="button"
          class="presenterBtn orange"
          onclick="runPresenterLetterliAction('spin')"
        >
          خلط
        </button>

        <button
          id="presenterLetterliChangeQuestionBtn"
          type="button"
          class="presenterBtn"
          onclick="runPresenterLetterliAction('changeQuestion')"
        >
          تغيير
        </button>

        <button
          id="presenterLetterliShowQuestionBtn"
          type="button"
          class="presenterBtn green"
          onclick="runPresenterLetterliAction('showQuestion')"
        >
          السؤال
        </button>

        <button
          id="presenterLetterliShowAnswerBtn"
          type="button"
          class="presenterBtn blue"
          onclick="runPresenterLetterliAction('showAnswer')"
        >
          الإجابة
        </button>

        <button
          id="presenterLetterliStartTimerBtn"
          type="button"
          class="presenterBtn"
          onclick="runPresenterLetterliAction('startTimer')"
        >
          المؤقت
        </button>

      </footer>

      <footer class="presenterLetterliScoreBar">

        <button
          id="presenterLetterliScoreABtn"
          type="button"
          class="presenterBtn green"
          onclick="runPresenterLetterliAction('scoreA')"
        >
          ${teamA}
          <span id="presenterLetterliScoreA">0</span>
        </button>

        <button
          id="presenterLetterliScoreBBtn"
          type="button"
          class="presenterBtn green"
          onclick="runPresenterLetterliAction('scoreB')"
        >
          ${teamB}
          <span id="presenterLetterliScoreB">0</span>
        </button>

      </footer>

      <div
        id="presenterLetterliStatusText"
        class="presenterStatusText"
      ></div>

    </section>
  `

  startPresenterLetterliTimerWatcher()
  refreshPresenterLetterliFromState()
}

/* =========================
   3) REFRESH
========================= */

function refreshPresenterLetterliFromState() {
  const panel =
    document.getElementById("presenterPanel")

  if (
    !panel ||
    panel.dataset.segment !== "letterli"
  ) {
    return
  }

  const question =
    getPresenterLetterliQuestion()

  const answer =
    getPresenterLetterliAnswer()

  const letter =
    getPresenterLetterliLetter()

  const questionVisible =
    getPresenterLetterliQuestionVisible()

  const answerVisible =
    getPresenterLetterliAnswerVisible()

  const spinning =
    getPresenterLetterliSpinning()

  const timerValue =
    getPresenterLetterliTimerValue()

  const timerRunning =
    isPresenterLetterliTimerRunning()

  const position =
    getPresenterLetterliPosition()

  const questionBox =
    document.getElementById(
      "presenterLetterliQuestionText"
    )

  const answerBox =
    document.getElementById(
      "presenterLetterliAnswerText"
    )

  const letterBox =
    document.getElementById(
      "presenterLetterliCurrentLetter"
    )

  const timerBox =
    document.getElementById(
      "presenterLetterliTimerText"
    )

  const positionBox =
    document.getElementById(
      "presenterLetterliPositionText"
    )

  const questionVisibilityBox =
    document.getElementById(
      "presenterLetterliQuestionVisibility"
    )

  const answerVisibilityBox =
    document.getElementById(
      "presenterLetterliAnswerVisibility"
    )

  if (questionBox) {
    questionBox.textContent =
      question || "بانتظار اختيار السؤال من العرض"
  }

  if (answerBox) {
    answerBox.textContent =
      answer || "لا توجد إجابة حالية"
  }

  if (letterBox) {
    letterBox.textContent =
      letter || "—"
  }

  if (timerBox) {
    timerBox.textContent =
      String(timerValue)
  }

  if (positionBox) {
    positionBox.textContent =
      position.current
        ? String(position.current)
        : "—"
  }

  if (questionVisibilityBox) {
    questionVisibilityBox.textContent =
      questionVisible
        ? "السؤال ظاهر في العرض"
        : "السؤال مخفي في العرض"

    questionVisibilityBox.classList.toggle(
      "isHiddenInDisplay",
      !questionVisible
    )
  }

  if (answerVisibilityBox) {
    answerVisibilityBox.textContent =
      answerVisible
        ? "الإجابة ظاهرة في العرض"
        : "الإجابة مخفية في العرض"

    answerVisibilityBox.classList.toggle(
      "isHiddenInDisplay",
      !answerVisible
    )
  }

  const scoreA =
    document.getElementById(
      "presenterLetterliScoreA"
    )

  const scoreB =
    document.getElementById(
      "presenterLetterliScoreB"
    )

  if (scoreA) {
    scoreA.textContent =
      getPresenterLetterliScore("A")
  }

  if (scoreB) {
    scoreB.textContent =
      getPresenterLetterliScore("B")
  }

  updatePresenterLetterliButtons({
    hasQuestion: Boolean(question),
    questionVisible,
    answerVisible,
    spinning,
    timerRunning
  })
}

/* =========================
   4) ACTIONS
========================= */

async function runPresenterLetterliAction(action) {
  if (presenterLetterliActionBusy) {
    return false
  }

  const command =
    PRESENTER_LETTERLI_ACTIONS[action]

  if (!command) {
    return false
  }

  presenterLetterliActionBusy = true
  updatePresenterLetterliButtons()

  let payload = {
    currentLetter:
      getPresenterLetterliLetter(),
    currentQuestion:
      getPresenterLetterliQuestion(),
    currentAnswer:
      getPresenterLetterliAnswer()
  }


  if (action === "scoreA") {
    payload = {
      team: "A"
    }
  }

  if (action === "scoreB") {
    payload = {
      team: "B"
    }
  }

const sent =
  await sendPresenterLetterliCommandSafe(
    command,
    payload
  )

presenterLetterliActionBusy = false
refreshPresenterLetterliFromState()
updatePresenterLetterliButtons()

if (!sent) {
    if (
      typeof showToast === "function"
    ) {
      showToast(
        "تعذر تنفيذ أمر حرفلي"
      )
    }

    return false
  }

  return true
}

function updatePresenterLetterliButtons(
  state = {}
) {
  const panel =
    document.querySelector(
      "#presenterPanel[data-segment='letterli']"
    )

  if (!panel) return

  const hasQuestion =
    state.hasQuestion ??
    Boolean(
      getPresenterLetterliQuestion()
    )

  const questionVisible =
    state.questionVisible ??
    getPresenterLetterliQuestionVisible()

  const answerVisible =
    state.answerVisible ??
    getPresenterLetterliAnswerVisible()

  const spinning =
    state.spinning ??
    getPresenterLetterliSpinning()

  const timerRunning =
    state.timerRunning ??
    isPresenterLetterliTimerRunning()

  const setDisabled = (
    selector,
    disabled
  ) => {
    const button =
      panel.querySelector(selector)

    if (button) {
      button.disabled =
        presenterLetterliActionBusy ||
        !!disabled
    }
  }

  setDisabled(
    "#presenterLetterliSpinBtn",
    spinning || hasQuestion
  )

  setDisabled(
    "#presenterLetterliChangeQuestionBtn",
    spinning || !hasQuestion || answerVisible
  )

  setDisabled(
    "#presenterLetterliShowQuestionBtn",
    spinning || !hasQuestion || questionVisible || answerVisible
  )

  setDisabled(
    "#presenterLetterliShowAnswerBtn",
    spinning || !hasQuestion || answerVisible
  )

  setDisabled(
    "#presenterLetterliStartTimerBtn",
    spinning || !hasQuestion || answerVisible || timerRunning
  )

  setDisabled(
    "#presenterLetterliScoreABtn",
    spinning || !hasQuestion || !answerVisible
  )

  setDisabled(
    "#presenterLetterliScoreBBtn",
    spinning || !hasQuestion || !answerVisible
  )


  const showQuestionBtn =
    panel.querySelector(
      "#presenterLetterliShowQuestionBtn"
    )

  if (showQuestionBtn) {
    showQuestionBtn.textContent =
      questionVisible
        ? "السؤال ظاهر في العرض"
        : "إظهار السؤال في العرض"
  }

  const showAnswerBtn =
    panel.querySelector(
      "#presenterLetterliShowAnswerBtn"
    )

  if (showAnswerBtn) {
    showAnswerBtn.textContent =
      answerVisible
        ? "الإجابة ظاهرة"
        : "إظهار الإجابة"
  }

  const timerBtn =
    panel.querySelector(
      "#presenterLetterliStartTimerBtn"
    )

  if (timerBtn) {
    timerBtn.textContent =
      timerRunning
        ? `المؤقت ${getPresenterLetterliTimerValue()}`
        : "بدء المؤقت"
  }
}

/* =========================
   5) TIMER WATCHER
========================= */

function startPresenterLetterliTimerWatcher() {
  clearInterval(
    presenterLetterliTimerWatcher
  )

  presenterLetterliTimerWatcher =
    setInterval(() => {
      const panel =
        document.querySelector(
          "#presenterPanel[data-segment='letterli']"
        )

      if (!panel) return

      const timerBox =
        document.getElementById(
          "presenterLetterliTimerText"
        )

      const timerBtn =
        document.getElementById(
          "presenterLetterliStartTimerBtn"
        )

      const timerValue =
        getPresenterLetterliTimerValue()

      const timerRunning =
        isPresenterLetterliTimerRunning()

      if (timerBox) {
        timerBox.textContent =
          String(timerValue)
      }

      if (timerBtn) {
        timerBtn.disabled =
          presenterLetterliActionBusy ||
          timerRunning ||
          !getPresenterLetterliQuestion() ||
          getPresenterLetterliAnswerVisible()

        timerBtn.textContent =
          timerRunning
            ? `المؤقت ${timerValue}`
            : "بدء المؤقت"
      }
    }, 500)
}

/* =========================
   6) PUBLIC HOOKS
========================= */

window.renderPresenterLetterli =
  renderPresenterLetterli

window.refreshPresenterLetterliFromState =
  refreshPresenterLetterliFromState

window.runPresenterLetterliAction =
  runPresenterLetterliAction

window.startPresenterLetterliTimerWatcher =
  startPresenterLetterliTimerWatcher