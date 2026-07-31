/* =========================
   WHO / من هو
========================= */

let presenterWhoRows = []
let presenterWhoRowsPromise = null
let presenterWhoActionBusy = false
let presenterWhoPendingNumber = null
let presenterWhoTimerInterval = null

let presenterWhoScoreLocked = false
let presenterWhoLastScoreKey = ""

const PRESENTER_WHO_CACHE_TTL = 5 * 60 * 1000

/* =========================
   STATE HELPERS
========================= */

function getPresenterWhoRoot() {
  return presenterLiveState?.who || {}
}

function getPresenterWhoState() {
  const root = getPresenterWhoRoot()

  return root?.whoState || root || {
    usedNumbers: [],
    scoreA: 0,
    scoreB: 0,
    currentPoints: 0,
    activeTeam: null,
    manualStartDone: false,
    lastAnsweredTeam: null
  }
}

function getPresenterWhoLocked() {
  const root = getPresenterWhoRoot()
  const state = getPresenterWhoState()

  return !!(
    root?.whoQuestionLocked ||
    state?.whoQuestionLocked ||
    state?.pendingScore
  )
}

function getPresenterWhoCurrentNumber() {
  const root = getPresenterWhoRoot()
  const state = getPresenterWhoState()

  return Number(
    root?.whoCurrentNumber ||
    state?.whoCurrentNumber ||
    state?.currentNumber ||
    0
  )
}

function getPresenterWhoCompensationMode() {
  const root = getPresenterWhoRoot()
  const state = getPresenterWhoState()

  return !!(
    root?.whoCompensationMode ||
    state?.whoCompensationMode ||
    state?.compensationMode
  )
}

function getPresenterWhoActiveTeam() {
  const root = getPresenterWhoRoot()
  const state = getPresenterWhoState()

  return (
    state?.activeTeam ||
    state?.selectedTeam ||
    root?.activeTeam ||
    root?.selectedTeam ||
    presenterSelectedTeam ||
    null
  )
}

function getPresenterWhoCurrentPoints() {
  const root = getPresenterWhoRoot()
  const state = getPresenterWhoState()

  return Number(
    state?.currentPoints ||
    root?.currentPoints ||
    0
  )
}

function getPresenterWhoUsedNumbers() {
  const state = getPresenterWhoState()

  return Array.isArray(state?.usedNumbers)
    ? state.usedNumbers.map(Number)
    : []
}

function getPresenterWhoMaxNumber() {
  const root = getPresenterWhoRoot()

  return Math.min(
    Math.max(
      Number(
        root?.whoMaxNumber ||
        presenterLiveState?.whoMaxNumber ||
        localStorage.getItem("who_max_number") ||
        15
      ),
      1
    ),
    15
  )
}

function getPresenterWhoScoreKey() {
  const number = getPresenterWhoCurrentNumber()
  const team = getPresenterWhoActiveTeam() || ""
  const points = getPresenterWhoCurrentPoints()

  return `${number}_${team}_${points}`
}

function getPresenterWhoRow(number) {
  return presenterWhoRows.find(row => {
    return Number(row.number) === Number(number)
  })
}

function getPresenterWhoCurrentAnswer() {
  const root = getPresenterWhoRoot()
  const state = getPresenterWhoState()
  const number = getPresenterWhoCurrentNumber()
  const row = getPresenterWhoRow(number)

  return (
    root?.currentWhoAnswer ||
    state?.currentWhoAnswer ||
    root?.answer ||
    state?.answer ||
    row?.answer ||
    ""
  )
}

function getPresenterWhoCurrentImage() {
  const root = getPresenterWhoRoot()
  const state = getPresenterWhoState()
  const number = getPresenterWhoCurrentNumber()
  const row = getPresenterWhoRow(number)

  return (
    root?.currentWhoImage ||
    state?.currentWhoImage ||
    root?.image ||
    state?.image ||
    row?.image ||
    ""
  )
}

function getPresenterWhoCurrentVideo() {
  const root = getPresenterWhoRoot()
  const state = getPresenterWhoState()
  const number = getPresenterWhoCurrentNumber()
  const row = getPresenterWhoRow(number)

  return (
    root?.currentWhoVideo ||
    state?.currentWhoVideo ||
    root?.video ||
    state?.video ||
    row?.video ||
    ""
  )
}

function getPresenterWhoDoubleState() {
  const root = getPresenterWhoRoot()
  const state = getPresenterWhoState()

  return (
    root?.whoDoubleState ||
    state?.whoDoubleState ||
    {
      used: {
        A: false,
        B: false
      },
      activeTeam: null
    }
  )
}

function getPresenterWhoScoringLocked() {
  const root = getPresenterWhoRoot()
  const state = getPresenterWhoState()

  return !!(
    root?.whoScoringLocked ||
    state?.whoScoringLocked
  )
}

function getPresenterWhoTimerSync() {
  const root = getPresenterWhoRoot()
  const state = getPresenterWhoState()

  return (
    root?.timerSync ||
    state?.timerSync ||
    presenterLiveState?.timerSync ||
    null
  )
}

function getPresenterWhoTimerStarted() {
  const root = getPresenterWhoRoot()
  const state = getPresenterWhoState()

  return !!(
    root?.whoTimerStarted ||
    state?.whoTimerStarted
  )
}

function isPresenterWhoDoubleUsed(team) {
  if (team !== "A" && team !== "B") {
    return false
  }

  return !!getPresenterWhoDoubleState()?.used?.[team]
}

/* =========================
   COMPENSATION
========================= */

function getPresenterWhoRemainingNumbers() {
  const used = getPresenterWhoUsedNumbers()
  const maxNumber = getPresenterWhoMaxNumber()

  return Array.from(
    { length: maxNumber },
    (_, index) => index + 1
  ).filter(number => !used.includes(number))
}

function canPresenterWhoCompensation() {
  const remaining = getPresenterWhoRemainingNumbers()

  return (
    !getPresenterWhoLocked() &&
    !getPresenterWhoCurrentNumber() &&
    remaining.length === 1 &&
    remaining[0] === 15
  )
}

function isPresenterWhoNumber15Locked(number) {
  if (Number(number) !== 15) {
    return false
  }

  const used = getPresenterWhoUsedNumbers()
  const compensationMode = getPresenterWhoCompensationMode()

  if (used.includes(15)) {
    return false
  }

  if (compensationMode) {
    return false
  }

  return used.length < 14 || used.length === 14
}

/* =========================
   SCORE GUARD
========================= */

function setPresenterWhoScoreButtonsDisabled(disabled) {
  const correctButton = document.getElementById(
    "presenterWhoCorrectBtn"
  )

  const wrongButton = document.getElementById(
    "presenterWhoWrongBtn"
  )

  if (correctButton) {
    correctButton.disabled = !!disabled
  }

  if (wrongButton) {
    wrongButton.disabled = !!disabled
  }
}

function resetPresenterWhoScoreGuard() {
  presenterWhoScoreLocked = false
  presenterWhoLastScoreKey = ""

  updatePresenterWhoActionButtons()
}

/* =========================
   HTML SAFETY
========================= */

function escapePresenterWhoHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

/* =========================
   CACHE
========================= */

function getPresenterWhoCacheKey() {
  return [
    "presenter_who_questions",
    Number(presenterModel || 0)
  ].join("_")
}

function readPresenterWhoCache() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(
        getPresenterWhoCacheKey()
      ) || "null"
    )

    if (
      !Array.isArray(saved?.rows) ||
      !saved?.savedAt
    ) {
      return null
    }

    if (
      Date.now() - Number(saved.savedAt) >
      PRESENTER_WHO_CACHE_TTL
    ) {
      return null
    }

    return saved.rows
  } catch {
    return null
  }
}

function savePresenterWhoCache(rows) {
  try {
    localStorage.setItem(
      getPresenterWhoCacheKey(),
      JSON.stringify({
        rows: Array.isArray(rows) ? rows : [],
        savedAt: Date.now()
      })
    )
  } catch (error) {
    console.log(
      "SAVE PRESENTER WHO CACHE ERROR:",
      error
    )
  }
}

async function loadPresenterWhoRows(options = {}) {
  if (
    presenterWhoRowsPromise &&
    options.forceRefresh !== true
  ) {
    return presenterWhoRowsPromise
  }

  if (options.forceRefresh !== true) {
    const cachedRows = readPresenterWhoCache()

    if (cachedRows?.length) {
      presenterWhoRows = cachedRows

      if (options.backgroundRefresh !== false) {
        setTimeout(() => {
          loadPresenterWhoRows({
            forceRefresh: true,
            backgroundRefresh: false
          }).then(() => {
            if (presenterSegment !== "who") return

            refreshPresenterWhoFromState()
          })
        }, 0)
      }

      return cachedRows
    }
  }

  presenterWhoRowsPromise = (async () => {
    try {
      const { data, error } = await db
        .from("who_images")
        .select(`
          number,
          answer,
          image
        `)
        .eq("model", Number(presenterModel))
        .order("number", {
          ascending: true
        })

      if (error) {
        console.log(
          "LOAD PRESENTER WHO ERROR:",
          error
        )

        return presenterWhoRows
      }

      presenterWhoRows = Array.isArray(data)
        ? data
        : []

      savePresenterWhoCache(
        presenterWhoRows
      )

      return presenterWhoRows
    } catch (error) {
      console.log(
        "LOAD PRESENTER WHO CATCH:",
        error
      )

      return presenterWhoRows
    } finally {
      presenterWhoRowsPromise = null
    }
  })()

  return presenterWhoRowsPromise
}

async function sendPresenterWhoCommandSafe(
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
        segment: "who"
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
      "PRESENTER WHO COMMAND ERROR:",
      error
    )

    return false
  }
}

/* =========================
   HTML BUILDERS
========================= */

function buildPresenterWhoPointsHtml() {
  const currentPoints = getPresenterWhoCurrentPoints()
  const locked = getPresenterWhoLocked()
  const compensationMode = getPresenterWhoCompensationMode()

  return [1, 2, 3, 4, 5]
    .map(points => {
      const selected = currentPoints === points

      return `
        <button
          type="button"
          class="
            presenterNumberBtn
            presenterWhoPointBtn
            ${
              selected
                ? "selectedPresenterTeam activeWhoPoint"
                : ""
            }
          "
          data-who-points="${points}"
          ${
            locked ||
            compensationMode ||
            presenterWhoActionBusy
              ? "disabled"
              : ""
          }
          onclick="
            selectPresenterWhoPoints(${points})
          "
        >
          ${points}
        </button>
      `
    })
    .join("")
}

function buildPresenterWhoNumbersHtml() {
  const used = getPresenterWhoUsedNumbers()
  const currentNumber = getPresenterWhoCurrentNumber()
  const locked = getPresenterWhoLocked()
  const maxNumber = getPresenterWhoMaxNumber()

  return Array.from(
    { length: maxNumber },
    (_, index) => index + 1
  )
    .map(number => {
      const isUsed = used.includes(number)
      const isCurrent = currentNumber === number
      const isPending =
        presenterWhoPendingNumber === number

      const isLocked15 =
        isPresenterWhoNumber15Locked(number)

      const disabled =
        isUsed ||
        isPending ||
        presenterWhoActionBusy ||
        locked ||
        isLocked15

      return `
        <button
          type="button"
          class="
            presenterNumberBtn
            ${isUsed ? "presenterOpened" : ""}
            ${
              isCurrent
                ? "selectedPresenterTeam"
                : ""
            }
            ${
              isPending
                ? "presenterPendingNumber"
                : ""
            }
            ${
              isLocked15
                ? "presenterWhoLocked15"
                : ""
            }
          "
          data-who-number="${number}"
          ${disabled ? "disabled" : ""}
          onclick="
            openWhoPresenterNumber(
              ${number},
              event
            )
          "
        >
          ${isUsed ? "" : number}
        </button>
      `
    })
    .join("")
}

/* =========================
   MAIN RENDER
========================= */

async function renderWho() {
  const panel = document.getElementById(
    "presenterPanel"
  )

  if (!panel) return

  const cachedRows = readPresenterWhoCache()

  if (cachedRows?.length) {
    presenterWhoRows = cachedRows
  }

  panel.innerHTML = `
    <section class="presenterWhoControlView">

      <header class="presenterWhoControlHeader">

        <div class="presenterWhoHeaderTeams">
          ${teamButtons()}
        </div>

<div class="presenterWhoHeaderInfo">

  <span
    id="presenterWhoStatusText"
    class="presenterWhoStatusText"
  >
    —
  </span>

  <strong
    id="presenterWhoCurrentBadge"
    class="presenterWhoCurrentBadge"
  >
    —
  </strong>

  <strong
    id="presenterWhoTimer"
    class="presenterWhoTimer"
  >
    —
  </strong>

  <button
    type="button"
    id="presenterWhoCompensationBtn"
    class="presenterBtn gray presenterWhoCompensationBtn"
    onclick="runPresenterWhoAction('compensation')"
  >
    تعويض
  </button>

</div>

      </header>

      <main class="presenterWhoControlMain">

        <section class="presenterWhoBoardCard">

          <header class="presenterWhoPanelTitle">
            <h2>النقاط</h2>
          </header>

          <div
            id="presenterWhoPointsGrid"
            class="presenterWhoPointsGrid"
          >
            ${buildPresenterWhoPointsHtml()}
          </div>

          <header class="presenterWhoPanelTitle">
            <h2>الأرقام</h2>
          </header>

          <div
            id="presenterWhoGrid"
            class="presenterWhoGrid"
          >
            ${buildPresenterWhoNumbersHtml()}
          </div>

        </section>

        <section class="presenterWhoPreviewPanel">

          <header class="presenterWhoPanelTitle">
            <h2>الإجابة</h2>

            <span
              id="presenterWhoMediaLabel"
              class="presenterWhoMediaLabel"
            ></span>
          </header>

          <div class="presenterWhoPreviewContent">

            <div
              id="presenterWhoAnswerText"
              class="presenterWhoAnswerText"
            >
              —
            </div>

            <div
              id="presenterWhoImageBox"
              class="presenterWhoImageBox hidden"
            ></div>

          </div>

        </section>

      </main>

      <footer class="presenterWhoCommandBar">

        <button
          type="button"
          id="presenterWhoDoubleBtn"
          class="presenterBtn gray presenterWhoDoubleBtn"
          onclick="runPresenterWhoAction('double')"
        >
          دوببلا
        </button>
<button
  type="button"
  id="presenterWhoCompensationBtn"
  class="presenterBtn gray presenterWhoCompensationBtn"
  onclick="runPresenterWhoAction('compensation')"
>
  تعويض
</button>

        <button
          type="button"
          id="presenterWhoWrongBtn"
          class="presenterBtn red"
          onclick="sendPresenterWhoScore('wrong')"
        >
          خطأ
        </button>

        <button
          type="button"
          id="presenterWhoCorrectBtn"
          class="presenterBtn green"
          onclick="sendPresenterWhoScore('correct')"
        >
          صح
        </button>

      </footer>

    </section>
  `

  refreshPresenterWhoFromState()
    startPresenterWhoTimerWatcher()

  if (!presenterWhoRows.length) {
    await loadPresenterWhoRows({
      backgroundRefresh: false
    })

    if (presenterSegment !== "who") {
      return
    }

    refreshPresenterWhoFromState()
  } else {
    loadPresenterWhoRows({
      backgroundRefresh: false
    }).then(() => {
      if (presenterSegment !== "who") return

      refreshPresenterWhoFromState()
    })
  }
}

/* =========================
   POINTS
========================= */

async function selectPresenterWhoPoints(points) {
  const safePoints = Number(points || 0)

  if (
    !safePoints ||
    presenterWhoActionBusy
  ) {
    return
  }

  if (getPresenterWhoLocked()) {
    showToast("سجل النتيجة أولاً")
    return
  }

  if (getPresenterWhoCompensationMode()) {
    showToast("التعويض لا يحتاج اختيار نقاط")
    return
  }

  presenterWhoActionBusy = true

  const root = getPresenterWhoRoot()
  const state = getPresenterWhoState()

  presenterLiveState = {
    ...(presenterLiveState || {}),

    who: {
      ...root,

      currentPoints: safePoints,

      whoState: {
        ...state,
        currentPoints: safePoints
      }
    }
  }

  refreshPresenterWhoFromState()

const sent =
  await sendPresenterWhoCommandSafe(
    "setPoints",
    {
      points: safePoints
    }
  )

  presenterWhoActionBusy = false

  if (!sent) {
    showToast("تعذر اختيار النقاط")

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

  updatePresenterWhoActionButtons()
}

/* =========================
   OPEN NUMBER
========================= */

async function openWhoPresenterNumber(
  number,
  event
) {
  const safeNumber = Number(number || 0)

  if (
    !safeNumber ||
    presenterWhoActionBusy ||
    presenterWhoPendingNumber
  ) {
    return
  }

  const used = getPresenterWhoUsedNumbers()
  const locked = getPresenterWhoLocked()
  const activeTeam = getPresenterWhoActiveTeam()
  const currentPoints = getPresenterWhoCurrentPoints()
  const compensationMode = getPresenterWhoCompensationMode()

  if (locked) {
    showToast("سجل النتيجة أولاً")
    return
  }

  if (used.includes(safeNumber)) {
    showToast("الرقم مستخدم")
    return
  }

  if (
    isPresenterWhoNumber15Locked(safeNumber)
  ) {
    showToast("الرقم 15 مخصص للتعويض")
    return
  }

  if (!activeTeam && !compensationMode) {
    showToast("اختر الفريق أولاً")
    return
  }

  if (!currentPoints && !compensationMode) {
    showToast("اختر النقاط أولاً")
    return
  }

  resetPresenterWhoScoreGuard()

  presenterWhoActionBusy = true
  presenterWhoPendingNumber = safeNumber

  const root = getPresenterWhoRoot()
  const state = getPresenterWhoState()

  presenterLiveState = {
    ...(presenterLiveState || {}),

    who: {
      ...root,

      whoCurrentNumber: safeNumber,
      whoQuestionLocked: true,

      whoState: {
        ...state,

        currentNumber: safeNumber,
        whoCurrentNumber: safeNumber,
        activeTeam,
        currentPoints,
        pendingScore: true
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

  showPresenterWhoPreview(safeNumber)
  refreshPresenterWhoFromState()

const sent =
  await sendPresenterWhoCommandSafe(
    "openNumber",
    {
      number: safeNumber,
      team: activeTeam,
      points: currentPoints
    }
  )

  presenterWhoActionBusy = false

  if (!sent) {
    presenterWhoPendingNumber = null

    showToast("تعذر فتح الرقم")

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
    presenterWhoPendingNumber = null
    presenterWhoActionBusy = false

    refreshPresenterWhoFromState()
  }, 220)
}

/* =========================
   PREVIEW
========================= */

function showPresenterWhoPreview(number) {
  const item = getPresenterWhoRow(number)

  const answerBox = document.getElementById(
    "presenterWhoAnswerText"
  )

  const imageBox = document.getElementById(
    "presenterWhoImageBox"
  )

  const mediaLabel = document.getElementById(
    "presenterWhoMediaLabel"
  )

  const answer =
    item?.answer ||
    getPresenterWhoCurrentAnswer() ||
    "لا توجد إجابة"

  const image =
    item?.image ||
    getPresenterWhoCurrentImage() ||
    ""

  const video =
    item?.video ||
    getPresenterWhoCurrentVideo() ||
    ""

  if (answerBox) {
    answerBox.innerText = answer
  }

  if (imageBox) {
    if (image) {
      imageBox.classList.remove("hidden")

      imageBox.innerHTML = `
        <img
          src="${escapePresenterWhoHtml(image)}"
          alt="صورة من هو"
          loading="eager"
          decoding="async"
        >
      `
    } else {
      imageBox.classList.add("hidden")
      imageBox.innerHTML = ""
    }
  }

  if (mediaLabel) {
    if (video) {
      mediaLabel.innerText = "فيديو"
    } else if (image) {
      mediaLabel.innerText = "صورة"
    } else {
      mediaLabel.innerText = ""
    }
  }
}

/* =========================
   ACTIONS
========================= */

async function runPresenterWhoAction(action) {
  if (presenterWhoActionBusy) return

  const activeTeam = getPresenterWhoActiveTeam()
  const currentNumber = getPresenterWhoCurrentNumber()
  const locked = getPresenterWhoLocked()

  if (action === "double") {
    if (!activeTeam) {
      showToast("اختر الفريق أولاً")
      return
    }

    if (locked || currentNumber) {
      showToast("فعّل دوببلا قبل فتح الرقم")
      return
    }

    if (isPresenterWhoDoubleUsed(activeTeam)) {
      showToast("تم استخدام دوببلا لهذا الفريق")
      return
    }
  }

  if (action === "compensation") {
    if (!canPresenterWhoCompensation()) {
      showToast("التعويض غير متاح الآن")
      return
    }
  }

  presenterWhoActionBusy = true
  updatePresenterWhoActionButtons()

const sent =
  await sendPresenterWhoCommandSafe(
    action,
    {
      team: activeTeam,
      number: currentNumber || null
    }
  )

  presenterWhoActionBusy = false

  if (!sent) {
    showToast("تعذر تنفيذ الأمر")
  }

  updatePresenterWhoActionButtons()
}

/* =========================
   SCORE
========================= */

async function sendPresenterWhoScore(action) {
  const number = getPresenterWhoCurrentNumber()
  const team = getPresenterWhoActiveTeam()
  const points = getPresenterWhoCurrentPoints()
  const compensationMode = getPresenterWhoCompensationMode()
  const displayScoringLocked =
    getPresenterWhoScoringLocked()

  if (displayScoringLocked) {
    showToast("انتظر انتهاء عرض الإجابة")
    return
  }

  if (!number) {
    showToast("اختر رقمًا أولاً")
    return
  }

  if (!team) {
    showToast("اختر الفريق أولاً")
    return
  }

  if (!points && !compensationMode) {
    showToast("اختر النقاط أولاً")
    return
  }

  const scoreKey = getPresenterWhoScoreKey()

  if (
    presenterWhoScoreLocked ||
    presenterWhoLastScoreKey === scoreKey
  ) {
    return
  }

  presenterWhoScoreLocked = true
  presenterWhoLastScoreKey = scoreKey

  updatePresenterWhoActionButtons()

const sent =
  await sendPresenterWhoCommandSafe(
    action,
    {
      __who_score_key: scoreKey,
      number,
      team,
      points
    }
  )

  if (!sent) {
    resetPresenterWhoScoreGuard()
    showToast("تعذر تسجيل النتيجة")
    return
  }

  setTimeout(() => {
    const currentKey = getPresenterWhoScoreKey()

    if (
      currentKey !== scoreKey ||
      !getPresenterWhoCurrentNumber()
    ) {
      resetPresenterWhoScoreGuard()
    }
  }, 1200)
}

/* =========================
   BUTTON STATES
========================= */

function updatePresenterWhoActionButtons() {
  const locked = getPresenterWhoLocked()
  const currentNumber = getPresenterWhoCurrentNumber()
  const activeTeam = getPresenterWhoActiveTeam()
  const compensationMode = getPresenterWhoCompensationMode()
  const displayScoringLocked =
    getPresenterWhoScoringLocked()

  const doubleUsed =
    isPresenterWhoDoubleUsed(activeTeam)

  const busy = presenterWhoActionBusy

  const doubleButton = document.getElementById(
    "presenterWhoDoubleBtn"
  )

  const compensationButton = document.getElementById(
    "presenterWhoCompensationBtn"
  )

  const correctButton = document.getElementById(
    "presenterWhoCorrectBtn"
  )

  const wrongButton = document.getElementById(
    "presenterWhoWrongBtn"
  )

  if (doubleButton) {
    doubleButton.disabled =
      busy ||
      displayScoringLocked ||
      !activeTeam ||
      locked ||
      !!currentNumber ||
      compensationMode ||
      doubleUsed

    doubleButton.classList.toggle(
      "presenterUsedDouble",
      doubleUsed
    )

    doubleButton.innerText =
      doubleUsed
        ? "تم استخدام دوببلا"
        : "دوببلا"
  }

  if (compensationButton) {
    compensationButton.disabled =
      busy ||
      displayScoringLocked ||
      !canPresenterWhoCompensation()
  }

  const scoreDisabled =
    busy ||
    presenterWhoScoreLocked ||
    displayScoringLocked ||
    !currentNumber

  if (correctButton) {
    correctButton.disabled = scoreDisabled
  }

  if (wrongButton) {
    wrongButton.disabled = scoreDisabled
  }
}

/* =========================
   REFRESH FROM DISPLAY
========================= */

function getPresenterWhoRemainingSeconds() {
  const timerSync =
    getPresenterWhoTimerSync()

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
    getPresenterWhoRoot()

  const state =
    getPresenterWhoState()

  return Math.max(
    0,
    Number(
      root?.timerValue ??
      state?.timerValue ??
      0
    )
  )
}

function updatePresenterWhoTimer() {
  const timerBox =
    document.getElementById(
      "presenterWhoTimer"
    )

  if (!timerBox) return

  const currentNumber =
    getPresenterWhoCurrentNumber()

  const timerSync =
    getPresenterWhoTimerSync()

  const timerStarted =
    getPresenterWhoTimerStarted()

  if (
    !currentNumber &&
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
    getPresenterWhoRemainingSeconds()

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

function startPresenterWhoTimerWatcher() {
  stopPresenterWhoTimerWatcher()

  updatePresenterWhoTimer()

  presenterWhoTimerInterval =
    setInterval(() => {
      if (presenterSegment !== "who") {
        stopPresenterWhoTimerWatcher()
        return
      }

      updatePresenterWhoTimer()
    }, 250)
}

function stopPresenterWhoTimerWatcher() {
  if (presenterWhoTimerInterval) {
    clearInterval(
      presenterWhoTimerInterval
    )

    presenterWhoTimerInterval = null
  }
}

function refreshPresenterWhoFromState() {
  if (presenterSegment !== "who") {
    stopPresenterWhoTimerWatcher()
    return
  }

  const used = getPresenterWhoUsedNumbers()
  const currentNumber = getPresenterWhoCurrentNumber()
  const locked = getPresenterWhoLocked()
  const currentPoints = getPresenterWhoCurrentPoints()
  const compensationMode = getPresenterWhoCompensationMode()
  const activeTeam = getPresenterWhoActiveTeam()
    const displayScoringLocked =
    getPresenterWhoScoringLocked()

  updatePresenterTeamButtonsOnly(activeTeam)

  document
    .querySelectorAll(".presenterWhoPointBtn")
    .forEach(button => {
      const points = Number(
        button.dataset.whoPoints || 0
      )

      const selected =
        currentPoints === points

      button.classList.toggle(
        "selectedPresenterTeam",
        selected
      )

      button.classList.toggle(
        "activeWhoPoint",
        selected
      )

      button.disabled =
        presenterWhoActionBusy ||
        displayScoringLocked ||
        locked ||
        compensationMode
    })

  document
    .querySelectorAll(
      "#presenterWhoGrid .presenterNumberBtn"
    )
    .forEach(button => {
      const number = Number(
        button.dataset.whoNumber || 0
      )

      if (!number) return

      const isUsed = used.includes(number)
      const isCurrent =
        currentNumber === number
      const isPending =
        presenterWhoPendingNumber === number
      const isLocked15 =
        isPresenterWhoNumber15Locked(number)

      button.classList.toggle(
        "presenterOpened",
        isUsed
      )

      button.classList.toggle(
        "selectedPresenterTeam",
        isCurrent
      )

      button.classList.toggle(
        "presenterPendingNumber",
        isPending
      )

      button.classList.toggle(
        "presenterWhoLocked15",
        isLocked15
      )

      button.disabled =
        isUsed ||
        isPending ||
        presenterWhoActionBusy ||
        displayScoringLocked ||
        locked ||
        isLocked15

      button.innerText =
        isUsed ? "" : String(number)
    })

  const currentBadge = document.getElementById(
    "presenterWhoCurrentBadge"
  )

  if (currentBadge) {
    currentBadge.innerText =
      currentNumber
        ? `رقم ${currentNumber}`
        : compensationMode
          ? "تعويض"
          : "—"

    currentBadge.classList.toggle(
      "active",
      !!currentNumber || compensationMode
    )
  }

  const statusBox = document.getElementById(
    "presenterWhoStatusText"
  )

  if (statusBox) {
    if (displayScoringLocked) {
      statusBox.innerText =
        "الإجابة ظاهرة — انتظر"
    } else if (compensationMode) {
      statusBox.innerText =
        "وضع التعويض مفعل"
    } else if (!activeTeam) {
      statusBox.innerText =
        "اختر الفريق أولاً"
    } else if (!currentPoints) {
      statusBox.innerText =
        "اختر قيمة النقاط"
    } else if (currentNumber && locked) {
      statusBox.innerText =
        "السؤال مفتوح — سجل النتيجة"
    } else {
      const teamName =
        activeTeam === "A"
          ? presenterTeamAName
          : presenterTeamBName

      statusBox.innerText =
        `الدور على ${teamName} — ${currentPoints} نقاط`
    }
  }

  const answerBox = document.getElementById(
    "presenterWhoAnswerText"
  )

  const imageBox = document.getElementById(
    "presenterWhoImageBox"
  )

  const mediaLabel = document.getElementById(
    "presenterWhoMediaLabel"
  )

  if (currentNumber) {
    showPresenterWhoPreview(currentNumber)
  } else {
    if (answerBox) {
      answerBox.innerText = "—"
    }

    if (imageBox) {
      imageBox.classList.add("hidden")
      imageBox.innerHTML = ""
    }

    if (mediaLabel) {
      mediaLabel.innerText = ""
    }
  }

  const currentScoreKey =
    getPresenterWhoScoreKey()

  if (
    !currentNumber ||
    currentScoreKey !== presenterWhoLastScoreKey
  ) {
    presenterWhoScoreLocked = false
    presenterWhoLastScoreKey = ""
  }

  updatePresenterWhoActionButtons()
    updatePresenterWhoTimer()
}

window.addEventListener(
  "beforeunload",
  stopPresenterWhoTimerWatcher
)

/* =========================
   Reader: Who - من هو
   الرقم + صورة مصغرة + الإجابة
========================= */

async function renderPresenterReaderWho() {
  const panel = document.getElementById("presenterReaderPanel")
  if (!panel) return

  const rows = await loadPresenterWhoRows({
    backgroundRefresh: false
  })

  if (!rows.length) {
    panel.innerHTML = readerEmpty("لا توجد بيانات في من هو")
    return
  }

  panel.innerHTML = `
    <div class="readerMediaList readerWhoList">
      ${rows.map(row => readerMiniCard({
        id: readerId(["who", row.number]),
        number: row.number,
        title: `رقم ${row.number}`,
        answer: row.answer,
        image: row.image
      })).join("")}
    </div>
  `
}
