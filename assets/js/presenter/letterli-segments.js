
let presenterLetterliActionBusy = false

const PRESENTER_LETTERLI_ACTIONS = Object.freeze({
  previous: "letterliPreviousQuestion",
  next: "letterliNextQuestion",
  toggleQuestion: "letterliToggleQuestion",
  toggleAnswer: "letterliToggleAnswer",
  reopen: "openSegment"
})

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

  return (
    state.currentItem ||
    state.currentQuestionItem ||
    root.currentItem ||
    root.currentQuestionItem ||
    {}
  )
}

function getPresenterLetterliQuestion() {
  const root = getPresenterLetterliRoot()
  const state = getPresenterLetterliState()
  const item = getPresenterLetterliCurrentItem()

  return String(
    state.currentQuestion ??
    state.question ??
    item.question ??
    root.currentQuestion ??
    root.question ??
    ""
  ).trim()
}

function getPresenterLetterliAnswer() {
  const root = getPresenterLetterliRoot()
  const state = getPresenterLetterliState()
  const item = getPresenterLetterliCurrentItem()

  return String(
    state.currentAnswer ??
    state.answer ??
    item.answer ??
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
    state.letter ??
    item.letter ??
    root.currentLetter ??
    root.letter ??
    ""
  ).trim()
}

function getPresenterLetterliQuestionVisible() {
  const root = getPresenterLetterliRoot()
  const state = getPresenterLetterliState()

  return (
    state.questionVisible ??
    root.questionVisible ??
    true
  ) !== false
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

function getPresenterLetterliPosition() {
  const root = getPresenterLetterliRoot()
  const state = getPresenterLetterliState()

  const explicitNumber = Number(
    state.currentNumber ??
    state.questionNumber ??
    root.currentNumber ??
    root.questionNumber ??
    0
  )

  const total = Math.max(
    0,
    Number(
      state.totalQuestions ??
      state.total ??
      root.totalQuestions ??
      root.total ??
      0
    )
  )

  if (explicitNumber > 0) {
    return {
      current: explicitNumber,
      total
    }
  }

  const index = Number(
    state.currentIndex ??
    root.currentIndex ??
    -1
  )

  return {
    current: index >= 0 ? index + 1 : 0,
    total
  }
}

/* =========================
   2) RENDER
========================= */

function renderPresenterLetterli() {
  const panel = document.getElementById("presenterPanel")
  if (!panel) return

  panel.dataset.segment = "letterli"

  panel.innerHTML = `
    <section class="presenterLetterliView">

      <div class="presenterLetterliMetaRow">
        <div class="presenterLetterliMetaCard">
          <span class="presenterLabel">السؤال الحالي</span>
          <strong id="presenterLetterliPositionText">—</strong>
        </div>

        <div class="presenterLetterliMetaCard">
          <span class="presenterLabel">الحرف</span>
          <strong id="presenterLetterliCurrentLetter">—</strong>
        </div>

        <div class="presenterLetterliVisibilityCard">
          <span id="presenterLetterliQuestionVisibility">السؤال ظاهر في العرض</span>
          <span id="presenterLetterliAnswerVisibility">الإجابة مخفية في العرض</span>
        </div>
      </div>

      <div class="presenterLetterliContentGrid">
        <article class="presenterLetterliContentCard">
          <div class="presenterLabel">السؤال عند المقدم</div>
          <div
            id="presenterLetterliQuestionText"
            class="presenterQuestionText presenterLetterliQuestionText"
          >
            بانتظار السؤال...
          </div>
        </article>

        <article class="presenterLetterliContentCard presenterLetterliAnswerCard">
          <div class="presenterLabel">الإجابة عند المقدم</div>
          <div
            id="presenterLetterliAnswerText"
            class="presenterAnswerBox presenterLetterliAnswerText"
          >
            بانتظار الإجابة...
          </div>
        </article>
      </div>

      <div class="presenterLetterliControls">
        <button
          id="presenterLetterliPreviousBtn"
          type="button"
          class="presenterBtn"
          onclick="runPresenterLetterliAction('previous')"
        >
          السؤال السابق
        </button>

        <button
          id="presenterLetterliNextBtn"
          type="button"
          class="presenterBtn orange"
          onclick="runPresenterLetterliAction('next')"
        >
          السؤال التالي
        </button>

        <button
          id="presenterLetterliToggleQuestionBtn"
          type="button"
          class="presenterBtn"
          onclick="runPresenterLetterliAction('toggleQuestion')"
        >
          إخفاء السؤال من العرض
        </button>

        <button
          id="presenterLetterliToggleAnswerBtn"
          type="button"
          class="presenterBtn blue"
          onclick="runPresenterLetterliAction('toggleAnswer')"
        >
          إظهار الإجابة في العرض
        </button>

        <button
          id="presenterLetterliReopenBtn"
          type="button"
          class="presenterBtn"
          onclick="runPresenterLetterliAction('reopen')"
        >
          إعادة فتح حرفلي في العرض
        </button>
      </div>

      <div
        id="presenterLetterliStatusText"
        class="presenterStatusText"
      ></div>

    </section>
  `

  refreshPresenterLetterliFromState()
}

/* =========================
   3) REFRESH
========================= */

function refreshPresenterLetterliFromState() {
  const panel = document.getElementById("presenterPanel")

  if (
    !panel ||
    panel.dataset.segment !== "letterli"
  ) {
    return
  }

  const question = getPresenterLetterliQuestion()
  const answer = getPresenterLetterliAnswer()
  const letter = getPresenterLetterliLetter()
  const questionVisible = getPresenterLetterliQuestionVisible()
  const answerVisible = getPresenterLetterliAnswerVisible()
  const position = getPresenterLetterliPosition()

  const questionBox = document.getElementById(
    "presenterLetterliQuestionText"
  )

  const answerBox = document.getElementById(
    "presenterLetterliAnswerText"
  )

  const letterBox = document.getElementById(
    "presenterLetterliCurrentLetter"
  )

  const positionBox = document.getElementById(
    "presenterLetterliPositionText"
  )

  const questionVisibilityBox = document.getElementById(
    "presenterLetterliQuestionVisibility"
  )

  const answerVisibilityBox = document.getElementById(
    "presenterLetterliAnswerVisibility"
  )

  const toggleQuestionButton = document.getElementById(
    "presenterLetterliToggleQuestionBtn"
  )

  const toggleAnswerButton = document.getElementById(
    "presenterLetterliToggleAnswerBtn"
  )

  /*
    السؤال والإجابة يظهران دائمًا عند المقدم.
    حالة الإخفاء تخص شاشة العرض فقط.
  */
  if (questionBox) {
    questionBox.textContent =
      question || "بانتظار اختيار السؤال من العرض"
  }

  if (answerBox) {
    answerBox.textContent =
      answer || "لا توجد إجابة حالية"
  }

  if (letterBox) {
    letterBox.textContent = letter || "—"
  }

  if (positionBox) {
    positionBox.textContent = position.current
      ? (
          position.total
            ? `${position.current} من ${position.total}`
            : String(position.current)
        )
      : "—"
  }

  if (questionVisibilityBox) {
    questionVisibilityBox.textContent = questionVisible
      ? "السؤال ظاهر في العرض"
      : "السؤال مخفي في العرض"

    questionVisibilityBox.classList.toggle(
      "isHiddenInDisplay",
      !questionVisible
    )
  }

  if (answerVisibilityBox) {
    answerVisibilityBox.textContent = answerVisible
      ? "الإجابة ظاهرة في العرض"
      : "الإجابة مخفية في العرض"

    answerVisibilityBox.classList.toggle(
      "isHiddenInDisplay",
      !answerVisible
    )
  }

  if (toggleQuestionButton) {
    toggleQuestionButton.textContent = questionVisible
      ? "إخفاء السؤال من العرض"
      : "إظهار السؤال في العرض"
  }

  if (toggleAnswerButton) {
    toggleAnswerButton.textContent = answerVisible
      ? "إخفاء الإجابة من العرض"
      : "إظهار الإجابة في العرض"
  }

  updatePresenterLetterliButtons()
}

/* =========================
   4) ACTIONS
========================= */

async function runPresenterLetterliAction(action) {
  if (presenterLetterliActionBusy) return false

  const command = PRESENTER_LETTERLI_ACTIONS[action]
  if (!command) return false

  presenterLetterliActionBusy = true
  updatePresenterLetterliButtons()

  const payload =
    action === "reopen"
      ? { segment: "letterli" }
      : {
          currentQuestion: getPresenterLetterliQuestion(),
          currentAnswer: getPresenterLetterliAnswer()
        }

  const sent = await sendCommand(command, payload)

  presenterLetterliActionBusy = false
  updatePresenterLetterliButtons()

  if (!sent) {
    showToast("تعذر تنفيذ أمر حرفلي")
    return false
  }

  return true
}

function updatePresenterLetterliButtons() {
  document
    .querySelectorAll(
      "#presenterPanel[data-segment='letterli'] button"
    )
    .forEach(button => {
      button.disabled = presenterLetterliActionBusy
    })
}

/* =========================
   5) PUBLIC HOOKS
========================= */

window.renderPresenterLetterli = renderPresenterLetterli
window.refreshPresenterLetterliFromState =
  refreshPresenterLetterliFromState
window.runPresenterLetterliAction =
  runPresenterLetterliAction
