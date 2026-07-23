/* =========================
   EXPLAIN WORD / اشرح الكلمة
========================= */

let presenterExplainActionBusy = false
let presenterExplainPendingNumber = null
let presenterExplainTimerInterval = null
let presenterExplainLastScoreKey = ""

/* =========================
   STATE HELPERS
========================= */

function getPresenterExplainRoot() {
  return presenterLiveState?.explain || {}
}

function getPresenterExplainState() {
  const root = getPresenterExplainRoot()

  return root?.explainState || root || {
    wordsCount: 4,
    words: [],
    usedNumbers: [],
    currentNumber: null,
    currentWord: "",
    currentTeam: null,
    wordVisible: true,
    timerVisible: false,
    timeLeft: 45,
    timerEndsAt: 0,
    revealLock: false,
    answerResult: null,
    scores: {
      A: 0,
      B: 0
    },
    attempts: {
      A: 0,
      B: 0
    }
  }
}

function getPresenterExplainWordsCount() {
  const root = getPresenterExplainRoot()
  const explain = getPresenterExplainState()

  const count = Number(
    explain?.wordsCount ||
    root?.wordsCount ||
    presenterLiveState?.explainWordsCount ||
    localStorage.getItem("explain_words_count") ||
    4
  )

  return count === 6 ? 6 : 4
}

function getPresenterExplainWords() {
  const root = getPresenterExplainRoot()
  const explain = getPresenterExplainState()

  return (
    explain?.words ||
    root?.words ||
    []
  )
}

function getPresenterExplainUsedNumbers() {
  const explain = getPresenterExplainState()

  return Array.isArray(explain?.usedNumbers)
    ? explain.usedNumbers.map(Number)
    : []
}

function getPresenterExplainCurrentNumber() {
  const root = getPresenterExplainRoot()
  const explain = getPresenterExplainState()

  return Number(
    explain?.currentNumber ||
    root?.currentNumber ||
    0
  )
}

function getPresenterExplainActiveTeam() {
  const root = getPresenterExplainRoot()
  const explain = getPresenterExplainState()

  return (
    explain?.currentTeam ||
    explain?.activeTeam ||
    root?.currentTeam ||
    root?.activeTeam ||
    presenterSelectedTeam ||
    null
  )
}

function getPresenterExplainRevealLock() {
  const root = getPresenterExplainRoot()
  const explain = getPresenterExplainState()

  return !!(
    explain?.revealLock ||
    root?.revealLock
  )
}

function getPresenterExplainWordVisible() {
  const explain = getPresenterExplainState()

  return explain?.wordVisible !== false
}

function getPresenterExplainTimerVisible() {
  const root = getPresenterExplainRoot()
  const explain = getPresenterExplainState()

  return !!(
    explain?.timerVisible ||
    root?.timerVisible
  )
}

function getPresenterExplainTimerEndsAt() {
  const root = getPresenterExplainRoot()
  const explain = getPresenterExplainState()

  return Number(
    explain?.timerEndsAt ||
    explain?.timerSync?.endsAt ||
    root?.timerEndsAt ||
    root?.timerSync?.endsAt ||
    presenterLiveState?.timerSync?.endsAt ||
    0
  )
}

function getPresenterExplainSavedTimeLeft() {
  const root = getPresenterExplainRoot()
  const explain = getPresenterExplainState()

  return Math.max(
    0,
    Number(
      explain?.timeLeft ??
      root?.timeLeft ??
      45
    )
  )
}

function getPresenterExplainCurrentWord() {
  const root = getPresenterExplainRoot()
  const explain = getPresenterExplainState()
  const currentNumber = getPresenterExplainCurrentNumber()

  if (explain?.currentWord) {
    return explain.currentWord
  }

  if (root?.currentWord) {
    return root.currentWord
  }

  return getPresenterExplainWordByNumber(
    currentNumber
  )
}

function getPresenterExplainWordByNumber(number) {
  const item = getPresenterExplainWords().find(row => {
    return Number(
      row.number ??
      row.id ??
      0
    ) === Number(number)
  })

  return item?.word || ""
}

function getPresenterExplainScoreKey() {
  const number = getPresenterExplainCurrentNumber()
  const team = getPresenterExplainActiveTeam() || ""
  const word = getPresenterExplainCurrentWord() || ""

  return `${number}_${team}_${word}`
}

/* =========================
   TIMER
========================= */

function getPresenterExplainRemainingTime() {
  const endsAt = getPresenterExplainTimerEndsAt()

  if (endsAt > 0) {
    return Math.max(
      0,
      Math.ceil(
        (endsAt - Date.now()) / 1000
      )
    )
  }

  return getPresenterExplainSavedTimeLeft()
}

function updatePresenterExplainTimer() {
  const timerBox = document.getElementById(
    "presenterExplainTimerText"
  )

  if (!timerBox) return

  const timerVisible =
    getPresenterExplainTimerVisible()

  const currentNumber =
    getPresenterExplainCurrentNumber()

  if (!timerVisible || !currentNumber) {
    timerBox.innerText = "—"

    timerBox.classList.add("hidden")

    timerBox.classList.remove(
      "danger",
      "presenterTimerDanger",
      "presenterTimerFinished"
    )

    return
  }

  const remaining =
    getPresenterExplainRemainingTime()

  timerBox.innerText =
    String(remaining)

  timerBox.classList.remove("hidden")

  timerBox.classList.toggle(
    "danger",
    remaining > 0 && remaining <= 5
  )

  timerBox.classList.toggle(
    "presenterTimerDanger",
    remaining > 0 && remaining <= 5
  )

  timerBox.classList.toggle(
    "presenterTimerFinished",
    remaining === 0
  )
}

function startPresenterExplainTimerWatcher() {
  stopPresenterExplainTimerWatcher()

  updatePresenterExplainTimer()

  presenterExplainTimerInterval = setInterval(() => {
    if (presenterSegment !== "explain") {
      stopPresenterExplainTimerWatcher()
      return
    }

    updatePresenterExplainTimer()
  }, 250)
}

function stopPresenterExplainTimerWatcher() {
  if (!presenterExplainTimerInterval) return

  clearInterval(
    presenterExplainTimerInterval
  )

  presenterExplainTimerInterval = null
}

/* =========================
   HTML HELPERS
========================= */

function escapePresenterExplainHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function buildPresenterExplainNumbersHtml() {
  const count =
    getPresenterExplainWordsCount()

  const used =
    getPresenterExplainUsedNumbers()

  const currentNumber =
    getPresenterExplainCurrentNumber()

  const revealLock =
    getPresenterExplainRevealLock()

  const activeTeam =
    getPresenterExplainActiveTeam()

  return Array.from(
    { length: count },
    (_, index) => index + 1
  )
    .map(number => {
      const isUsed =
        used.includes(number)

      const isCurrent =
        currentNumber === number

      const isPending =
        presenterExplainPendingNumber === number

      const disabled =
        isUsed ||
        isPending ||
        presenterExplainActionBusy ||
        !!currentNumber ||
        revealLock ||
        !activeTeam

      return `
        <button
          type="button"
          class="
            presenterNumberBtn
            presenterExplainNumberCard
            ${isUsed ? "used presenterOpened" : ""}
            ${isCurrent ? "active selectedPresenterTeam" : ""}
            ${isPending ? "presenterPendingNumber" : ""}
          "
          data-explain-number="${number}"
          ${disabled ? "disabled" : ""}
          onclick="
            openExplainPresenterNumber(
              ${number},
              event
            )
          "
          aria-label="فتح الكلمة رقم ${number}"
        >
          <span>
            ${isUsed ? "" : number}
          </span>
        </button>
      `
    })
    .join("")
}

/* =========================
   MAIN RENDER
========================= */

async function renderExplain() {
  const panel = document.getElementById(
    "presenterPanel"
  )

  if (!panel) return

  const explain =
    getPresenterExplainState()

  const count =
    getPresenterExplainWordsCount()

  const currentNumber =
    getPresenterExplainCurrentNumber()

  const currentWord =
    getPresenterExplainCurrentWord()

  panel.dataset.segment = "explain"

  panel.innerHTML = `
    <div
      class="presenterExplainPage"
      data-presenter-segment="explain"
    >

      <section class="presenterExplainOverview">

        <div class="presenterExplainTeamsBox">
          ${teamButtons()}
        </div>

        <section
          class="presenterCard presenterExplainStatusCard"
          aria-label="حالة فقرة اشرح الكلمة"
        >
          <div class="presenterExplainStatusItem">
            <span class="presenterLabel">الحالة</span>

            <strong
              id="presenterExplainStatusText"
              class="presenterExplainStatusText"
            >
              اختر الفريق ثم الرقم
            </strong>
          </div>

          <div class="presenterExplainStatusItem">
            <span class="presenterLabel">الرقم الحالي</span>

            <strong
              id="presenterExplainCurrentBadge"
              class="presenterExplainCurrentBadge"
            >
              ${
                currentNumber
                  ? `رقم ${currentNumber}`
                  : "—"
              }
            </strong>
          </div>

          <div class="presenterExplainStatusItem presenterExplainTimerStatus">
            <span class="presenterLabel">المؤقت</span>

            <strong
              id="presenterExplainTimerText"
              class="presenterExplainTimerBox ${
                getPresenterExplainTimerVisible()
                  ? ""
                  : "hidden"
              }"
            >
              ${
                getPresenterExplainTimerVisible()
                  ? getPresenterExplainRemainingTime()
                  : "—"
              }
            </strong>
          </div>
        </section>

      </section>

      <section class="presenterExplainContent">

        <section
          class="presenterCard presenterExplainNumbersCard"
          aria-label="أرقام الكلمات"
        >
          <header class="presenterExplainSectionHead">
            <div>
              <span class="presenterLabel">الاختيارات</span>
              <h2>أرقام الكلمات</h2>
            </div>

            <span class="presenterExplainCountBadge">
              ${count} كلمات
            </span>
          </header>

          <div
            id="presenterExplainNumbersGrid"
            class="presenterExplainNumbersGrid"
            style="grid-template-columns:repeat(${count},minmax(0,1fr));"
          >
            ${buildPresenterExplainNumbersHtml()}
          </div>
        </section>

        <section
          class="presenterCard presenterExplainWordCard"
          aria-label="الكلمة الحالية"
        >
          <header class="presenterExplainSectionHead">
            <div>
              <span class="presenterLabel">المحتوى</span>
              <h2>الكلمة الحالية</h2>
            </div>

            <span
              id="presenterExplainWordState"
              class="presenterExplainWordState"
            ></span>
          </header>

          <div
            id="presenterExplainWordText"
            class="presenterExplainWordBox ${
              explain.answerResult === "correct"
                ? "answerCorrect"
                : ""
            } ${
              explain.answerResult === "wrong"
                ? "answerWrong"
                : ""
            }"
          >
            ${
              currentNumber
                ? escapePresenterExplainHtml(
                    currentWord || "—"
                  )
                : "اختر الفريق ثم رقم الكلمة"
            }
          </div>
        </section>

      </section>

      <footer
        class="presenterExplainActions"
        aria-label="أزرار التحكم"
      >
        <button
          type="button"
          id="presenterExplainStartTimerBtn"
          class="presenterBtn dark presenterExplainStartTimerBtn"
          onclick="runPresenterExplainAction('startTimer')"
        >
          بدء المؤقت
        </button>

        <button
          type="button"
          id="presenterExplainToggleWordBtn"
          class="presenterBtn blue presenterExplainToggleWordBtn"
          onclick="runPresenterExplainAction('toggleWordVisible')"
        >
          إخفاء الكلمة
        </button>

        <button
          type="button"
          id="presenterExplainWrongBtn"
          class="presenterBtn red presenterExplainWrongBtn"
          onclick="runPresenterExplainAction('wrong')"
        >
          ✕ خطأ
        </button>

        <button
          type="button"
          id="presenterExplainCorrectBtn"
          class="presenterBtn green presenterExplainCorrectBtn"
          onclick="runPresenterExplainAction('correct')"
        >
          ✓ صح
        </button>
      </footer>

    </div>
  `

  refreshPresenterExplainFromState()
  startPresenterExplainTimerWatcher()
}

/* =========================
   OPEN NUMBER
========================= */

async function openExplainPresenterNumber(
  number,
  event
) {
  const safeNumber =
    Number(number || 0)

  if (
    !safeNumber ||
    presenterExplainActionBusy ||
    presenterExplainPendingNumber
  ) {
    return
  }

  const used =
    getPresenterExplainUsedNumbers()

  const currentNumber =
    getPresenterExplainCurrentNumber()

  const activeTeam =
    getPresenterExplainActiveTeam()

  const revealLock =
    getPresenterExplainRevealLock()

  if (!activeTeam) {
    showToast("اختر الفريق أولاً")
    return
  }

  if (revealLock) {
    showToast("انتظر نهاية النتيجة")
    return
  }

  if (currentNumber) {
    showToast("أنهِ الكلمة الحالية أولاً")
    return
  }

  if (used.includes(safeNumber)) {
    showToast("الرقم مستخدم")
    return
  }

  presenterExplainActionBusy = true
  presenterExplainPendingNumber = safeNumber
  presenterExplainLastScoreKey = ""

  const root =
    getPresenterExplainRoot()

  const explain =
    getPresenterExplainState()

  const word =
    getPresenterExplainWordByNumber(
      safeNumber
    )

  /*
    تحديث فوري في واجهة المقدم.
  */
  presenterLiveState = {
    ...(presenterLiveState || {}),

    explain: {
      ...root,

      currentNumber: safeNumber,
      currentTeam: activeTeam,

      explainState: {
        ...explain,

        currentNumber: safeNumber,
        currentWord: word,
        currentTeam: activeTeam,
        activeTeam,
        wordVisible: true,
        timerVisible: false,
        timeLeft: 45,
        timerEndsAt: 0,
        revealLock: false,
        answerResult: null
      }
    }
  }

  const button = event?.currentTarget

  if (button) {
    button.disabled = true

    button.classList.add(
      "selectedPresenterTeam",
      "presenterPendingNumber"
    )
  }

  refreshPresenterExplainFromState()

  const sent = await sendCommand(
    "openNumber",
    {
      number: safeNumber,
      team: activeTeam
    }
  )

  presenterExplainActionBusy = false

  if (!sent) {
    presenterExplainPendingNumber = null

    showToast("تعذر فتح الكلمة")

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
    presenterExplainPendingNumber = null
    presenterExplainActionBusy = false

    refreshPresenterExplainFromState()
  }, 220)
}

/* =========================
   ACTIONS
========================= */

async function runPresenterExplainAction(action) {
  if (presenterExplainActionBusy) return

  const currentNumber =
    getPresenterExplainCurrentNumber()

  const activeTeam =
    getPresenterExplainActiveTeam()

  const revealLock =
    getPresenterExplainRevealLock()

  const timerVisible =
    getPresenterExplainTimerVisible()

  const wordVisible =
    getPresenterExplainWordVisible()

  if (!currentNumber) {
    showToast("اختر رقمًا أولاً")
    return
  }

  if (!activeTeam) {
    showToast("اختر الفريق أولاً")
    return
  }

  if (revealLock) {
    showToast("انتظر نهاية النتيجة")
    return
  }

  if (
    action === "startTimer" &&
    timerVisible &&
    getPresenterExplainRemainingTime() > 0
  ) {
    showToast("المؤقت يعمل الآن")
    return
  }

  if (
    action === "correct" ||
    action === "wrong"
  ) {
    const scoreKey =
      getPresenterExplainScoreKey()

    if (
      presenterExplainLastScoreKey ===
      scoreKey
    ) {
      return
    }

    presenterExplainLastScoreKey =
      scoreKey
  }

  presenterExplainActionBusy = true
  updatePresenterExplainActionButtons()

  /*
    تحديث محلي سريع للمؤقت.
  */
  if (action === "startTimer") {
    const endsAt =
      Date.now() + 45 * 1000

    const root =
      getPresenterExplainRoot()

    const explain =
      getPresenterExplainState()

    presenterLiveState = {
      ...(presenterLiveState || {}),

      explain: {
        ...root,

        timerVisible: true,
        timerEndsAt: endsAt,
        timeLeft: 45,

        explainState: {
          ...explain,

          timerVisible: true,
          timerEndsAt: endsAt,
          timerSync: {
            endsAt,
            running: true
          },
          timeLeft: 45
        }
      }
    }

    updatePresenterExplainTimer()
  }

  /*
    تغيير نص الزر فورًا.
  */
  if (action === "toggleWordVisible") {
    const root =
      getPresenterExplainRoot()

    const explain =
      getPresenterExplainState()

    presenterLiveState = {
      ...(presenterLiveState || {}),

      explain: {
        ...root,

        wordVisible: !wordVisible,

        explainState: {
          ...explain,
          wordVisible: !wordVisible
        }
      }
    }
  }

  const sent = await sendCommand(
    action,
    {
      number: currentNumber,
      team: activeTeam,
      scoreKey:
        action === "correct" ||
        action === "wrong"
          ? getPresenterExplainScoreKey()
          : null
    }
  )

  if (!sent) {
    presenterExplainActionBusy = false

    if (
      action === "correct" ||
      action === "wrong"
    ) {
      presenterExplainLastScoreKey = ""
    }

    updatePresenterExplainActionButtons()

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

  setTimeout(() => {
    presenterExplainActionBusy = false

    updatePresenterExplainActionButtons()
    refreshPresenterExplainFromState()
  }, 300)
}

/* =========================
   BUTTON STATES
========================= */

function updatePresenterExplainActionButtons() {
  const currentNumber =
    getPresenterExplainCurrentNumber()

  const activeTeam =
    getPresenterExplainActiveTeam()

  const revealLock =
    getPresenterExplainRevealLock()

  const timerVisible =
    getPresenterExplainTimerVisible()

  const remaining =
    getPresenterExplainRemainingTime()

  const wordVisible =
    getPresenterExplainWordVisible()

  const busy =
    presenterExplainActionBusy

  const timerButton =
    document.getElementById(
      "presenterExplainStartTimerBtn"
    )

  const toggleWordButton =
    document.getElementById(
      "presenterExplainToggleWordBtn"
    )

  const correctButton =
    document.getElementById(
      "presenterExplainCorrectBtn"
    )

  const wrongButton =
    document.getElementById(
      "presenterExplainWrongBtn"
    )

  const basicDisabled =
    busy ||
    !currentNumber ||
    !activeTeam ||
    revealLock

  if (timerButton) {
    timerButton.disabled =
      basicDisabled ||
      (
        timerVisible &&
        remaining > 0
      )

    timerButton.innerText =
      timerVisible && remaining > 0
        ? "المؤقت يعمل"
        : "بدء المؤقت"
  }

  if (toggleWordButton) {
    toggleWordButton.disabled =
      basicDisabled

    toggleWordButton.innerText =
      wordVisible
        ? "إخفاء الكلمة"
        : "إظهار الكلمة"
  }

  if (correctButton) {
    correctButton.disabled =
      basicDisabled
  }

  if (wrongButton) {
    wrongButton.disabled =
      basicDisabled
  }
}

/* =========================
   REFRESH FROM DISPLAY
========================= */

function refreshPresenterExplainFromState() {
  if (presenterSegment !== "explain") {
    stopPresenterExplainTimerWatcher()
    return
  }

  const explain =
    getPresenterExplainState()

  const count =
    getPresenterExplainWordsCount()

  const used =
    getPresenterExplainUsedNumbers()

  const currentNumber =
    getPresenterExplainCurrentNumber()

  const activeTeam =
    getPresenterExplainActiveTeam()

  const revealLock =
    getPresenterExplainRevealLock()

  const wordVisible =
    getPresenterExplainWordVisible()

  updatePresenterTeamButtonsOnly(
    activeTeam
  )

  const wordBox =
    document.getElementById(
      "presenterExplainWordText"
    )

  const wordState =
    document.getElementById(
      "presenterExplainWordState"
    )

  const grid =
    document.getElementById(
      "presenterExplainNumbersGrid"
    )

  const currentBadge =
    document.getElementById(
      "presenterExplainCurrentBadge"
    )

  const statusBox =
    document.getElementById(
      "presenterExplainStatusText"
    )

  if (wordBox) {
    wordBox.classList.toggle(
      "answerCorrect",
      explain.answerResult === "correct"
    )

    wordBox.classList.toggle(
      "answerWrong",
      explain.answerResult === "wrong"
    )

    if (!currentNumber) {
      wordBox.innerText = "—"
    } else {
      wordBox.innerText =
        getPresenterExplainCurrentWord() ||
        getPresenterExplainWordByNumber(
          currentNumber
        ) ||
        "—"
    }

    wordBox.classList.toggle(
      "presenterExplainWordHidden",
      !!currentNumber && !wordVisible
    )
  }

  if (wordState) {
    if (!currentNumber) {
      wordState.innerText = ""
    } else {
      wordState.innerText =
        wordVisible
          ? "ظاهرة في العرض"
          : "مخفية من العرض"
    }
  }

  if (currentBadge) {
    currentBadge.innerText =
      currentNumber
        ? `رقم ${currentNumber}`
        : "—"

    currentBadge.classList.toggle(
      "active",
      !!currentNumber
    )
  }

  if (statusBox) {
    if (!activeTeam) {
      statusBox.innerText =
        "اختر الفريق أولاً"
    } else if (revealLock) {
      statusBox.innerText =
        "جارٍ تسجيل النتيجة"
    } else if (currentNumber) {
      const teamName =
        activeTeam === "A"
          ? presenterTeamAName
          : presenterTeamBName

      statusBox.innerText =
        `الكلمة مع ${teamName}`
    } else {
      statusBox.innerText =
        "اختر رقم الكلمة"
    }
  }

  if (grid) {
    grid.style.gridTemplateColumns =
      `repeat(${count}, minmax(0, 1fr))`

    const currentButtons =
      grid.querySelectorAll(
        "[data-explain-number]"
      )

    if (currentButtons.length !== count) {
      grid.innerHTML =
        buildPresenterExplainNumbersHtml()
    }
  }

  document
    .querySelectorAll(
      "#presenterExplainNumbersGrid .presenterExplainNumberCard"
    )
    .forEach(button => {
      const number = Number(
        button.dataset.explainNumber || 0
      )

      if (!number) return

      const isUsed =
        used.includes(number)

      const isCurrent =
        currentNumber === number

      const isPending =
        presenterExplainPendingNumber ===
        number

      button.classList.toggle(
        "used",
        isUsed
      )

      button.classList.toggle(
        "presenterOpened",
        isUsed
      )

      button.classList.toggle(
        "active",
        isCurrent
      )

      button.classList.toggle(
        "selectedPresenterTeam",
        isCurrent
      )

      button.classList.toggle(
        "presenterPendingNumber",
        isPending
      )

      button.disabled =
        isUsed ||
        isPending ||
        presenterExplainActionBusy ||
        !!currentNumber ||
        revealLock ||
        !activeTeam

      const text = button.querySelector("span")

      if (text) {
        text.innerText =
          isUsed ? "" : String(number)
      }
    })

  /*
    بعد انتقال العرض للكلمة التالية نسمح
    بالتسجيل مرة أخرى.
  */
  const currentScoreKey =
    getPresenterExplainScoreKey()

  if (
    !currentNumber ||
    presenterExplainLastScoreKey !==
      currentScoreKey
  ) {
    presenterExplainLastScoreKey = ""
  }

  updatePresenterExplainTimer()
  updatePresenterExplainActionButtons()

  if (!presenterExplainTimerInterval) {
    startPresenterExplainTimerWatcher()
  }
}

/* =========================
   CLEANUP
========================= */

window.addEventListener(
  "beforeunload",
  stopPresenterExplainTimerWatcher
)

/* =========================
   READER DATA + CACHE
========================= */

let presenterExplainReaderRowsPromise = null

const PRESENTER_EXPLAIN_READER_CACHE_TTL =
  5 * 60 * 1000

function getPresenterExplainReaderCacheKey() {
  return [
    "presenter_explain_words",
    Number(presenterModel || 0)
  ].join("_")
}

async function loadPresenterExplainReaderRows({
  forceRefresh = false
} = {}) {
  if (
    presenterExplainReaderRowsPromise &&
    !forceRefresh
  ) {
    return presenterExplainReaderRowsPromise
  }

  presenterExplainReaderRowsPromise = (async () => {
    const fetcher = async () => {
      if (!window.db) {
        return {
          data: [],
          error: new Error("Supabase is unavailable")
        }
      }

      return db
        .from("explain_words")
        .select("number, word")
        .eq("model", Number(presenterModel))
        .order("number", { ascending: true })
    }

    if (
      typeof loadPresenterCachedResource ===
      "function"
    ) {
      const result =
        await loadPresenterCachedResource({
          cacheKey:
            getPresenterExplainReaderCacheKey(),
          ttl:
            PRESENTER_EXPLAIN_READER_CACHE_TTL,
          forceRefresh,
          staleWhileRevalidate: true,
          fetcher
        })

      if (
        result?.error &&
        !Array.isArray(result?.data)
      ) {
        throw result.error
      }

      return Array.isArray(result?.data)
        ? result.data
        : []
    }

    const { data, error } = await fetcher()

    if (error) throw error

    return Array.isArray(data) ? data : []
  })()

  try {
    return await presenterExplainReaderRowsPromise
  } finally {
    presenterExplainReaderRowsPromise = null
  }
}

/* =========================
   READER: EXPLAIN / اشرح الكلمة
   جميع الكلمات ظاهرة بالكامل
========================= */

async function renderPresenterReaderExplain() {
  const panel = document.getElementById(
    "presenterReaderPanel"
  )

  if (!panel) return

  const rows =
    await loadPresenterExplainReaderRows()

  if (!rows.length) {
    panel.innerHTML = readerEmpty(
      "لا توجد كلمات في اشرح الكلمة"
    )
    return
  }

  panel.innerHTML = `
    <section class="readerExplainPage">
      <header class="readerExplainHead">
        <div>
          <span>دليل الأسئلة</span>
          <h2>اشرح الكلمة</h2>
        </div>

        <strong>${rows.length} كلمات</strong>
      </header>

      <div class="readerSimpleGrid readerExplainGrid">
        ${rows.map(row => readerMiniCard({
          id: readerId([
            "explain",
            row.number
          ]),
          number: row.number,
          title: `الكلمة رقم ${row.number}`,
          answer: row.word
        })).join("")}
      </div>
    </section>
  `
}
