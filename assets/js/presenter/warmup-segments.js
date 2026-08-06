/* =========================
   WARMUP
========================= */

let presenterWarmupRows = []
let presenterWarmupSelected = null
let presenterWarmupRowsPromise = null
let presenterWarmupActionBusy = false
let presenterWarmupTimerInterval = null

const PRESENTER_WARMUP_CACHE_TTL = 5 * 60 * 1000

/* =========================
   STATE HELPERS
========================= */

function getPresenterWarmupRoot() {
  return presenterLiveState?.warmup || {}
}

function getPresenterWarmupState() {
  const root = getPresenterWarmupRoot()
  return root?.warmupState || root || {}
}

function getPresenterWarmupUsed() {
  const root = getPresenterWarmupRoot()
  const state = getPresenterWarmupState()

  return (
    root?.usedQuestions ||
    state?.usedQuestions ||
    {}
  )
}

function getPresenterWarmupActiveTeam() {
  const root = getPresenterWarmupRoot()
  const state = getPresenterWarmupState()

  return (
    state?.activeTeam ||
    state?.selectedTeam ||
    root?.activeTeam ||
    root?.selectedTeam ||
    presenterSelectedTeam ||
    null
  )
}

function getPresenterWarmupLocked() {
  const root = getPresenterWarmupRoot()
  const state = getPresenterWarmupState()

  return !!(
    root?.warmupQuestionLocked ||
    state?.warmupQuestionLocked
  )
}

function getPresenterWarmupResultPending() {
  const root = getPresenterWarmupRoot()
  const state = getPresenterWarmupState()

  return !!(
    root?.warmupResultPending ||
    state?.warmupResultPending
  )
}

function getPresenterWarmupCurrentKey() {
  const root = getPresenterWarmupRoot()
  const state = getPresenterWarmupState()

  return (
    root?.currentWarmupQuestionKey ||
    state?.currentWarmupQuestionKey ||
    null
  )
}

function getPresenterWarmupDoubleState() {
  const root = getPresenterWarmupRoot()
  const state = getPresenterWarmupState()

  return (
    root?.warmupDoubleState ||
    state?.warmupDoubleState ||
    {
      used: {
        A: false,
        B: false
      },
      activeTeam: null
    }
  )
}

function getPresenterWarmupTimerSync() {
  const root = getPresenterWarmupRoot()
  const state = getPresenterWarmupState()

  return (
    root?.timerSync ||
    state?.timerSync ||
    presenterLiveState?.timerSync ||
    null
  )
}

function getPresenterWarmupPointsFromKey(key) {
  if (!key) return 0

  const parts = String(key).split("_")
  return Number(parts[1] || 0)
}

function getPresenterWarmupInitialTime(points) {
  const value = Number(points || 0)

  if (value === 1) return 15
  if (value === 2) return 25
  if (value === 4) return 40

  return 0
}

/* =========================
   CACHE
========================= */

function getPresenterWarmupCacheKey() {
  return `presenter_warmup_questions_${Number(presenterModel || 0)}`
}

function readPresenterWarmupCache() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(
        getPresenterWarmupCacheKey()
      ) || "null"
    )

    if (!saved?.rows || !saved?.savedAt) {
      return null
    }

    if (
      Date.now() - Number(saved.savedAt) >
      PRESENTER_WARMUP_CACHE_TTL
    ) {
      return null
    }

    return Array.isArray(saved.rows)
      ? saved.rows
      : null
  } catch {
    return null
  }
}

function savePresenterWarmupCache(rows) {
  try {
    localStorage.setItem(
      getPresenterWarmupCacheKey(),
      JSON.stringify({
        rows: Array.isArray(rows) ? rows : [],
        savedAt: Date.now()
      })
    )
  } catch (error) {
    console.log(
      "SAVE PRESENTER WARMUP CACHE ERROR:",
      error
    )
  }
}

async function loadPresenterWarmupRows(options = {}) {
  if (
    presenterWarmupRowsPromise &&
    options.forceRefresh !== true
  ) {
    return presenterWarmupRowsPromise
  }

  if (options.forceRefresh !== true) {
    const cachedRows = readPresenterWarmupCache()

    if (cachedRows?.length) {
      presenterWarmupRows = cachedRows

      if (options.backgroundRefresh !== false) {
        setTimeout(() => {
          loadPresenterWarmupRows({
            forceRefresh: true,
            backgroundRefresh: false
          }).then(() => {
            if (presenterSegment === "warmup") {
              renderPresenterWarmupNumbersOnly()
              refreshPresenterWarmupFromState()
            }
          })
        }, 0)
      }

      return cachedRows
    }
  }

  presenterWarmupRowsPromise = (async () => {
    try {
      const { data, error } = await db
        .from("questions")
        .select(`
          category,
          category_name,
          number,
          question,
          answer
        `)
        .eq("model", Number(presenterModel))
        .eq("segment", "warmup")
        .order("category", {
          ascending: true
        })
        .order("number", {
          ascending: true
        })

      if (error) {
        console.log(
          "LOAD PRESENTER WARMUP ERROR:",
          error
        )

        return presenterWarmupRows
      }

      presenterWarmupRows =
        Array.isArray(data) ? data : []

      savePresenterWarmupCache(
        presenterWarmupRows
      )

      return presenterWarmupRows
    } catch (error) {
      console.log(
        "LOAD PRESENTER WARMUP CATCH:",
        error
      )

      return presenterWarmupRows
    } finally {
      presenterWarmupRowsPromise = null
    }
  })()

  return presenterWarmupRowsPromise
}

/* =========================
   COMMANDS
========================= */

async function sendPresenterWarmupCommandSafe(
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
        segment: "warmup"
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
      "PRESENTER WARMUP COMMAND ERROR:",
      error
    )

    return false
  }
}

/* =========================
   RENDER HELPERS
========================= */

function escapePresenterWarmupHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function getPresenterWarmupCategoryRows(category) {
  return presenterWarmupRows.filter(row => {
    return Number(row.category) === Number(category)
  })
}

function buildPresenterWarmupNumbersHtml() {
  const used = getPresenterWarmupUsed()
  const locked = getPresenterWarmupLocked()
  const currentKey = getPresenterWarmupCurrentKey()

  return [1, 2, 3, 4]
    .map(category => {
      const categoryRows =
        getPresenterWarmupCategoryRows(category)

      const categoryName =
        categoryRows[0]?.category_name ||
        `الفئة ${category}`

      return `
        <article
          class="presenterWarmupRow"
          data-warmup-category="${category}"
        >
          <div class="presenterWarmupRowTitle">
            ${escapePresenterWarmupHtml(categoryName)}
          </div>

          <div class="presenterWarmupNumbers">
            ${[1, 2, 4]
              .map(number => {
                const key =
                  `${category}_${number}`

                const isUsed =
                  !!used[key]

                const isCurrent =
                  currentKey === key

                const isSelected =
                  presenterWarmupSelected &&
                  Number(presenterWarmupSelected.category) === Number(category) &&
                  Number(presenterWarmupSelected.number) === Number(number)

                return `
                  <button
                    type="button"
                    class="
                      presenterNumberBtn
                      ${isUsed ? "presenterOpened" : ""}
                      ${
                        isCurrent || isSelected
                          ? "selectedPresenterTeam"
                          : ""
                      }
                    "
                    data-warmup-category="${category}"
                    data-warmup-number="${number}"
                    ${
                      isUsed ||
                      locked ||
                      presenterWarmupActionBusy
                        ? "disabled"
                        : ""
                    }
                    onclick="openWarmupPresenterQuestion(${category}, ${number}, event)"
                    aria-label="سؤال ${number} من ${escapePresenterWarmupHtml(categoryName)}"
                  >
                    ${isUsed ? "" : number}
                  </button>
                `
              })
              .join("")}
          </div>
        </article>
      `
    })
    .join("")
}

function renderPresenterWarmupNumbersOnly() {
  const box =
    document.getElementById(
      "presenterWarmupCats"
    )

  if (!box) return

  box.innerHTML =
    buildPresenterWarmupNumbersHtml()
}

function renderPresenterWarmupQuestionPlaceholder() {
  const questionBox =
    document.getElementById(
      "presenterWarmupQuestionText"
    )

  const answerBox =
    document.getElementById(
      "presenterWarmupAnswerText"
    )

  if (questionBox) {
    questionBox.innerText =
      "اختر الفريق من الهيدر ثم رقم السؤال"
  }

  if (answerBox) {
    answerBox.innerText = "—"
  }
}

/* =========================
   MAIN RENDER
========================= */

async function renderWarmup() {
  const panel =
    document.getElementById("presenterPanel")

  if (!panel) return

  const cachedRows =
    readPresenterWarmupCache()

  if (cachedRows?.length) {
    presenterWarmupRows = cachedRows
  }

  panel.dataset.segment = "warmup"

  panel.innerHTML = `
    <section
      class="presenterWarmupView"
      aria-label="لوحة تحكم فقرة التسخين"
    >

      <main class="presenterWarmupMain">

        <section
          class="presenterCard presenterWarmupNumbersCard"
          aria-label="فئات وأسئلة التسخين"
        >
          <div
            id="presenterWarmupCats"
            class="presenterWarmupCats presenterWarmupRows"
          >
            ${
              presenterWarmupRows.length
                ? buildPresenterWarmupNumbersHtml()
                : `
                  <div
                    class="presenterWarmupLoading"
                    role="status"
                  >
                    جارٍ تحميل الأسئلة...
                  </div>
                `
            }
          </div>
        </section>

        <section
          class="presenterCard presenterWarmupPreviewCard"
          aria-label="السؤال والإجابة"
        >
          <div
            id="presenterWarmupQuestionMeta"
            class="presenterWarmupQuestionMeta"
          ></div>

          <div
            id="presenterWarmupQuestionText"
            class="presenterQuestionBody presenterBigQuestionBody"
            aria-live="polite"
          >
            اختر الفريق من الهيدر ثم رقم السؤال
          </div>

          <div
            id="presenterWarmupAnswerText"
            class="presenterAnswerBody presenterBigAnswerBody"
            aria-live="polite"
          >
            —
          </div>
        </section>

      </main>

      <footer
        class="presenterWarmupActions"
        aria-label="أزرار التحكم"
      >
        <button
          type="button"
          id="presenterWarmupDoubleBtn"
          class="presenterBtn gray presenterDoubleBtn"
          onclick="runPresenterWarmupAction('double')"
        >
          دوببلا
        </button>

        <button
          type="button"
          id="presenterWarmupWrongBtn"
          class="presenterBtn red presenterWrongBtn"
          onclick="runPresenterWarmupAction('wrong')"
        >
          خطأ
        </button>

        <button
          type="button"
          id="presenterWarmupCorrectBtn"
          class="presenterBtn green presenterCorrectBtn"
          onclick="runPresenterWarmupAction('correct')"
        >
          صح
        </button>
      </footer>

    </section>
  `

  refreshPresenterWarmupFromState()
  startPresenterWarmupTimerWatcher()

  if (!presenterWarmupRows.length) {
    await loadPresenterWarmupRows({
      backgroundRefresh: false
    })

    if (presenterSegment !== "warmup") {
      return
    }

    renderPresenterWarmupNumbersOnly()
    refreshPresenterWarmupFromState()
    return
  }

  loadPresenterWarmupRows({
    backgroundRefresh: false
  }).then(() => {
    if (presenterSegment !== "warmup") {
      return
    }

    renderPresenterWarmupNumbersOnly()
    refreshPresenterWarmupFromState()
  })
}

/* =========================
   OPEN QUESTION
========================= */

async function openWarmupPresenterQuestion(
  category,
  number,
  event
) {
  const used = getPresenterWarmupUsed()
  const key = `${category}_${number}`

  if (presenterWarmupActionBusy) return

  if (getPresenterWarmupLocked()) {
    showToast("سجل النتيجة أولاً")
    return
  }

  if (used[key]) {
    showToast("السؤال مستخدم")
    return
  }

  const activeTeam =
    getPresenterWarmupActiveTeam()

  if (!activeTeam) {
    showToast("اختر الفريق أولاً")
    return
  }

  presenterWarmupActionBusy = true

  presenterWarmupSelected = {
    category: Number(category),
    number: Number(number)
  }

  presenterLiveState = {
    ...(presenterLiveState || {}),

    warmup: {
      ...(presenterLiveState?.warmup || {}),

      currentWarmupQuestionKey: key,
      warmupQuestionLocked: true,

      warmupState: {
        ...(
          presenterLiveState?.warmup
            ?.warmupState || {}
        ),

        activeTeam,
        currentWarmupQuestionKey: key,
        warmupQuestionLocked: true
      }
    }
  }

  const button = event?.currentTarget

  if (button) {
    button.disabled = true

    button.classList.add(
      "selectedPresenterTeam"
    )
  }

  showPresenterWarmupPreview(
    category,
    number
  )

  refreshPresenterWarmupFromState()

  const sent =
    await sendPresenterWarmupCommandSafe(
      "openNumber",
      {
        category: Number(category),
        number: Number(number),
        team: activeTeam
      }
    )

  presenterWarmupActionBusy = false

  if (!sent) {
    presenterWarmupSelected = null

    showToast("تعذر فتح السؤال")

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
    presenterWarmupActionBusy = false
    refreshPresenterWarmupFromState()
  }, 180)
}

/* =========================
   QUESTION PREVIEW
========================= */

function showPresenterWarmupPreview(
  category,
  number
) {
  const item =
    presenterWarmupRows.find(row => {
      return (
        Number(row.category) ===
          Number(category) &&
        Number(row.number) ===
          Number(number)
      )
    })

  const questionBox =
    document.getElementById(
      "presenterWarmupQuestionText"
    )

  const answerBox =
    document.getElementById(
      "presenterWarmupAnswerText"
    )

  const metaBox =
    document.getElementById(
      "presenterWarmupQuestionMeta"
    )

  if (questionBox) {
    questionBox.innerText =
      item?.question ||
      "لا يوجد سؤال"
  }

  if (answerBox) {
    answerBox.innerText =
      item?.answer ||
      "لا توجد إجابة"
  }

  if (metaBox) {
    const categoryName =
      item?.category_name ||
      `الفئة ${category}`

    metaBox.innerText =
      `${categoryName} • ${number} نقاط`
  }
}

/* =========================
   ACTIONS
========================= */

async function runPresenterWarmupAction(action) {
  if (presenterWarmupActionBusy) return

  const locked =
    getPresenterWarmupLocked()

  const currentKey =
    getPresenterWarmupCurrentKey()

  const activeTeam =
    getPresenterWarmupActiveTeam()

  const resultPending =
    getPresenterWarmupResultPending()

  if (action === "double") {
    if (!activeTeam) {
      showToast("اختر الفريق أولاً")
      return
    }

    if (locked || currentKey) {
      showToast("فعّل دوببلا قبل فتح السؤال")
      return
    }

    const doubleState =
      getPresenterWarmupDoubleState()

    if (doubleState?.used?.[activeTeam]) {
      showToast("تم استخدام دوببلا لهذا الفريق")
      return
    }
  }

  if (
    action === "correct" ||
    action === "wrong"
  ) {
    if (resultPending) {
      showToast("انتظر انتهاء عرض الإجابة")
      return
    }

    if (!currentKey || !locked) {
      showToast("افتح سؤالاً أولاً")
      return
    }
  }

  presenterWarmupActionBusy = true
  updatePresenterWarmupActionButtons()

  const sent =
    await sendPresenterWarmupCommandSafe(
      action,
      {
        team: activeTeam,
        questionKey: currentKey
      }
    )

  if (!sent) {
    presenterWarmupActionBusy = false
    updatePresenterWarmupActionButtons()
    showToast("تعذر تنفيذ الأمر")
    return
  }

  if (
    action === "correct" ||
    action === "wrong"
  ) {
    setTimeout(() => {
      presenterWarmupSelected = null
    }, 100)
  }

  setTimeout(() => {
    presenterWarmupActionBusy = false
    refreshPresenterWarmupFromState()
    updatePresenterWarmupActionButtons()
  }, 350)
}

function updatePresenterWarmupActionButtons() {
  const locked =
    getPresenterWarmupLocked()

  const currentKey =
    getPresenterWarmupCurrentKey()

  const activeTeam =
    getPresenterWarmupActiveTeam()

  const resultPending =
    getPresenterWarmupResultPending()

  const doubleState =
    getPresenterWarmupDoubleState()

  const doubleUsed =
    activeTeam
      ? !!doubleState?.used?.[activeTeam]
      : false

  const doubleButton =
    document.getElementById(
      "presenterWarmupDoubleBtn"
    )

  const wrongButton =
    document.getElementById(
      "presenterWarmupWrongBtn"
    )

  const correctButton =
    document.getElementById(
      "presenterWarmupCorrectBtn"
    )

  if (doubleButton) {
    doubleButton.disabled =
      presenterWarmupActionBusy ||
      resultPending ||
      !activeTeam ||
      !!locked ||
      !!currentKey ||
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

  const scoreDisabled =
    presenterWarmupActionBusy ||
    resultPending ||
    !locked ||
    !currentKey

  if (wrongButton) {
    wrongButton.disabled = scoreDisabled
  }

  if (correctButton) {
    correctButton.disabled = scoreDisabled
  }
}

/* =========================
   TIMER
========================= */

function getPresenterWarmupRemainingSeconds() {
  const timerSync =
    getPresenterWarmupTimerSync()

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
    getPresenterWarmupRoot()

  const state =
    getPresenterWarmupState()

  const savedTime =
    Number(
      root?.timerValue ??
      state?.timerValue ??
      root?.timeLeft ??
      state?.timeLeft ??
      0
    )

  return Math.max(0, savedTime)
}

function updatePresenterWarmupTimer() {
  const timerBox =
    document.getElementById(
      "presenterWarmupTimer"
    ) ||
    document.getElementById(
      "presenterGlobalTimer"
    )

  if (!timerBox) return

  const currentKey =
    getPresenterWarmupCurrentKey()

  if (!currentKey) {
    timerBox.innerText = "—"

    timerBox.classList.remove(
      "timerRunning",
      "timerDanger",
      "timerFinished"
    )

    return
  }

  const timerSync =
    getPresenterWarmupTimerSync()

  const remaining =
    getPresenterWarmupRemainingSeconds()

  const points =
    getPresenterWarmupPointsFromKey(
      currentKey
    )

  const initialTime =
    getPresenterWarmupInitialTime(points)

  const shownTime =
    timerSync?.endsAt
      ? remaining
      : remaining || initialTime

  timerBox.innerText =
    String(shownTime)

  timerBox.classList.toggle(
    "timerRunning",
    shownTime > 5
  )

  timerBox.classList.toggle(
    "timerDanger",
    shownTime > 0 &&
    shownTime <= 5
  )

  timerBox.classList.toggle(
    "timerFinished",
    shownTime === 0
  )
}

function startPresenterWarmupTimerWatcher() {
  stopPresenterWarmupTimerWatcher()

  updatePresenterWarmupTimer()

  presenterWarmupTimerInterval =
    setInterval(() => {
      if (presenterSegment !== "warmup") {
        stopPresenterWarmupTimerWatcher()
        return
      }

      updatePresenterWarmupTimer()
    }, 250)
}

function stopPresenterWarmupTimerWatcher() {
  if (presenterWarmupTimerInterval) {
    clearInterval(
      presenterWarmupTimerInterval
    )

    presenterWarmupTimerInterval = null
  }
}

/* =========================
   REFRESH FROM DISPLAY
========================= */

function refreshPresenterWarmupFromState() {
  if (presenterSegment !== "warmup") {
    stopPresenterWarmupTimerWatcher()
    return
  }

  const used =
    getPresenterWarmupUsed()

  const locked =
    getPresenterWarmupLocked()

  const currentKey =
    getPresenterWarmupCurrentKey()

  const activeTeam =
    getPresenterWarmupActiveTeam()

  const resultPending =
    getPresenterWarmupResultPending()

  if (
    typeof updatePresenterTeamButtonsOnly ===
    "function"
  ) {
    updatePresenterTeamButtonsOnly(
      activeTeam
    )
  }

  document
    .querySelectorAll(
      ".presenterWarmupNumbers .presenterNumberBtn"
    )
    .forEach(button => {
      const category =
        Number(
          button.dataset.warmupCategory ||
          0
        )

      const number =
        Number(
          button.dataset.warmupNumber ||
          0
        )

      if (!category || !number) return

      const key =
        `${category}_${number}`

      const isUsed =
        !!used[key]

      const isCurrent =
        currentKey === key

      button.classList.remove(
        "presenterOpened",
        "selectedPresenterTeam"
      )

      if (isUsed) {
        button.classList.add(
          "presenterOpened"
        )

        button.disabled = true
        button.innerText = ""
      } else {
        button.innerText =
          String(number)

        button.disabled =
          presenterWarmupActionBusy ||
          (!!locked && !isCurrent)
      }

      if (isCurrent) {
        button.classList.add(
          "selectedPresenterTeam"
        )

        button.disabled = true
      }
    })

  if (currentKey) {
    const [category, number] =
      currentKey.split("_")

    showPresenterWarmupPreview(
      Number(category),
      Number(number)
    )
  } else {
    renderPresenterWarmupQuestionPlaceholder()
    presenterWarmupSelected = null

    const metaBox =
      document.getElementById(
        "presenterWarmupQuestionMeta"
      )

    if (metaBox) {
      metaBox.innerText = ""
    }
  }

  const statusBox =
    document.getElementById(
      "presenterWarmupStatusText"
    )

  if (statusBox) {
    if (!activeTeam) {
      statusBox.innerText =
        "اختر الفريق أولاً"
    } else if (resultPending) {
      statusBox.innerText =
        "الإجابة ظاهرة — انتظر"
    } else if (locked && currentKey) {
      statusBox.innerText =
        "السؤال مفتوح — سجل النتيجة"
    } else {
      const teamName =
        activeTeam === "A"
          ? presenterTeamAName
          : presenterTeamBName

      statusBox.innerText =
        `الدور على ${teamName}`
    }
  }

  updatePresenterWarmupActionButtons()
  updatePresenterWarmupTimer()
}

/* =========================
   READER
========================= */

async function renderPresenterReaderWarmup() {
  const panel =
    document.getElementById("presenterReaderPanel")

  if (!panel) return

  const rows =
    await loadPresenterWarmupRows({
      backgroundRefresh: false
    })

  if (!rows.length) {
    panel.innerHTML =
      typeof readerEmpty === "function"
        ? readerEmpty("لا توجد أسئلة في التسخين")
        : `
          <div class="readerEmptyCard">
            لا توجد أسئلة في التسخين
          </div>
        `

    return
  }

  const grouped = [1, 2, 3, 4]
    .map(category => {
      const categoryRows =
        rows.filter(row => {
          return Number(row.category) === Number(category)
        })

      if (!categoryRows.length) return ""

      const categoryName =
        categoryRows[0]?.category_name ||
        `الفئة ${category}`

      return `
        <section class="readerRoundPage">

          <header class="readerRoundHead">
            <h2>${escapePresenterWarmupHtml(categoryName)}</h2>
            <span>التسخين</span>
          </header>

          <div class="readerSimpleGrid">
            ${categoryRows
              .map(row => {
                const number =
                  Number(row.number || 0)

                return `
                  <article
                    class="readerMiniCard"
                    data-reader-id="warmup_${category}_${number}"
                  >
                    <div class="readerBlock">
                      <label>الرقم</label>
                      <p>${number}</p>
                    </div>

                    <div class="readerBlock">
                      <label>السؤال</label>
                      <p>${escapePresenterWarmupHtml(row.question || "—")}</p>
                    </div>

                    <div class="readerBlock">
                      <label>الإجابة</label>
                      <p>${escapePresenterWarmupHtml(row.answer || "—")}</p>
                    </div>
                  </article>
                `
              })
              .join("")}
          </div>

        </section>
      `
    })
    .join("")

  panel.innerHTML = `
    <section class="readerRoundsStack">
      ${grouped}
    </section>
  `
}

/* =========================
   CLEANUP
========================= */

window.addEventListener(
  "beforeunload",
  stopPresenterWarmupTimerWatcher
)

/* =========================
   EXPORTS
========================= */

window.renderWarmup = renderWarmup
window.renderPresenterWarmup = renderWarmup
window.refreshPresenterWarmupFromState = refreshPresenterWarmupFromState
window.loadPresenterWarmupRows = loadPresenterWarmupRows
window.openWarmupPresenterQuestion = openWarmupPresenterQuestion
window.runPresenterWarmupAction = runPresenterWarmupAction
window.renderPresenterReaderWarmup = renderPresenterReaderWarmup
window.renderPresenterWarmupNumbersOnly = renderPresenterWarmupNumbersOnly
window.stopPresenterWarmupTimerWatcher = stopPresenterWarmupTimerWatcher