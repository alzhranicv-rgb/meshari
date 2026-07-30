/* =========================
   Explain Word Segment
========================= */

const EXPLAIN_STORAGE_KEY = "explain_state_v1"
const EXPLAIN_TIMER_SECONDS = 60

let explainTimer = null
let explainTimerLastTick = null
let explainRevealTimeout = null
let explainStateSyncTimer = null
let explainDataCache = {}
let explainDataPromise = null


const EXPLAIN_DATA_CACHE_TTL =
  5 * 60 * 1000

let explainDoubleState = {
  used: { A: false, B: false },
  activeTeam: null
}

let explainDoublePickMode = false

window.explainState = {
  model: null,
  wordsCount: 5,
  words: [],
  usedNumbers: [],
  currentNumber: null,
  currentWord: "",
  currentTeam: null,
  wordVisible: true,
  timerVisible: false,
  timeLeft: EXPLAIN_TIMER_SECONDS,
  revealLock: false,
  answerResult: null,
  scores: { A: 0, B: 0 },
  attempts: { A: 0, B: 0 },
  wordPoolKey: "",
compensationActive: false,
compensationNumber: null,
compensationReturnTeam: null
}

/* =========================
   Helpers
========================= */

function getExplainTeamName(team) {
  return team === "A" ? teamAName : teamBName
}

function getExplainOtherTeam(team) {
  return team === "A" ? "B" : "A"
}

function setExplainActiveTeam(
  team,
  options = {}
) {
  const validTeam =
    team === "A" || team === "B"

  selectedTeam =
    validTeam ? team : null

  window.selectedTeam =
    validTeam ? team : null

  window.explainState.currentTeam =
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

  highlightExplainTeam(
    validTeam ? team : null
  )

  if (options.save === true) {
    saveExplainState({
      immediate:
        options.immediate === true,

      sync:
        options.sync !== false
    })
  }

  return true
}

function canExplainTeamPlay(team) {
  const other = getExplainOtherTeam(team)

  const teamAttempts = Number(window.explainState.attempts?.[team] || 0)
  const otherAttempts = Number(window.explainState.attempts?.[other] || 0)

  return teamAttempts <= otherAttempts
}

function getExplainWordPoolKey(
  model,
  wordsCount,
  words
) {
  return [
    Number(model || 0),
    Number(wordsCount || 5),

    words
      .map(item => {
        return `${Number(item.number)}:${String(item.word || "").trim()}`
      })
      .join("|")
  ].join("__")
}

function normalizeExplainWordsCount(value) {
  const n = Number(value || 5)

  if (n === 9) return 9
  if (n === 7) return 7

  return 5
}

function getExplainConfiguredWordsCount(
  settingsValue = null
) {
  return normalizeExplainWordsCount(
    settingsValue ||
    window.explainWordsCount ||
    localStorage.getItem(
      "explain_words_count"
    ) ||
    5
  )
}

function buildExplainWords(rawWords, wordsCount) {
  const wordsMap = {}

  ;(rawWords || []).forEach(row => {
    const number = Number(row.number || 0)
    const word = String(row.word || "").trim()

    if (number >= 1 && number <= wordsCount) {
      wordsMap[number] = word
    }
  })

  return Array.from({ length: wordsCount }, (_, index) => {
    const number = index + 1

    return {
      number,
      word: wordsMap[number] || ""
    }
  })
}

function normalizeExplainDoubleState(state) {
  const clean = state || {
    used: { A: false, B: false },
    activeTeam: null
  }

  if (!clean.used) {
    clean.used = { A: false, B: false }
  }

  clean.used.A = !!clean.used.A
  clean.used.B = !!clean.used.B

  clean.activeTeam =
    clean.activeTeam === "A" || clean.activeTeam === "B"
      ? clean.activeTeam
      : null

  return clean
}

function saveExplainState(options = {}) {
  try {
    window.explainState.usedNumbers = [
      ...new Set(
        (window.explainState.usedNumbers || [])
          .map(Number)
          .filter(number => number > 0)
      )
    ]
        window.explainState.timerSync = {
      startedAt: Number(explainTimerStartedAt || 0),
      endsAt: Number(explainTimerEndsAt || 0),
      duration: Number(explainTimerDuration || 0)
    }
    

    localStorage.setItem(
      EXPLAIN_STORAGE_KEY,
      JSON.stringify({
        explainState:
          window.explainState,

        explainDoubleState:
          normalizeExplainDoubleState(
            explainDoubleState
          )
      })
    )

    localStorage.setItem(
      "active_segment",
      "explain"
    )

    window.currentSegmentScores = {
      A: Number(
        window.explainState.scores?.A || 0
      ),

      B: Number(
        window.explainState.scores?.B || 0
      )
    }

    if (options.sync !== false) {
      clearTimeout(
        explainStateSyncTimer
      )

      const immediate =
        options.immediate === true

      explainStateSyncTimer = setTimeout(() => {
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

    if (
      typeof updateEndRoundButtonState ===
      "function"
    ) {
      updateEndRoundButtonState()
    }
  } catch (error) {
    console.log(
      "SAVE EXPLAIN STATE ERROR:",
      error
    )
  }
}

function loadExplainState() {
  try {
    const saved = JSON.parse(localStorage.getItem(EXPLAIN_STORAGE_KEY) || "null")

    if (!saved) return null

    if (saved.explainState) {
      return saved
    }

    return {
      explainState: saved,
      explainDoubleState: {
        used: { A: false, B: false },
        activeTeam: null
      }
    }
  } catch {
    return null
  }
}

function resetExplainTimer() {
  clearInterval(explainTimer)
  explainTimer = null
  explainTimerLastTick = null

  explainTimerStartedAt = 0
  explainTimerEndsAt = 0
  explainTimerDuration = 0
}

function resetExplainRevealTimeout() {
  clearTimeout(explainRevealTimeout)
  explainRevealTimeout = null
}

function hideExplainTimer() {
  resetExplainTimer()

  window.explainState.timerVisible = false
  window.explainState.timeLeft =
    EXPLAIN_TIMER_SECONDS
}

function getExplainWordByNumber(number) {
  return (window.explainState.words || []).find(item => {
    return Number(item.number) === Number(number)
  }) || null
}

/* =========================
   Load From Supabase
========================= */

function normalizeExplainRows(
  rows,
  wordsCount
) {
  return (rows || [])
    .map(row => ({
      number: Number(
        row.number || 0
      ),

      word: String(
        row.word || ""
      ).trim()
    }))
    .filter(row => {
      return (
        row.number >= 1 &&
        row.number <= wordsCount
      )
    })
}

function applyExplainLoadedData(
  model,
  wordsCount,
  rawWords,
  options = {}
) {
  const saved =
    loadExplainState()

  const savedExplainState =
    saved?.explainState || null

  const savedDoubleState =
    saved?.explainDoubleState || null

  const wordPoolKey =
    getExplainWordPoolKey(
      model,
      wordsCount,
      rawWords
    )

  const sameSavedGame =
    Number(
      savedExplainState?.model || 0
    ) === Number(model) &&
    Number(
      savedExplainState
        ?.wordsCount || 5
    ) === Number(wordsCount) &&
    savedExplainState
      ?.wordPoolKey === wordPoolKey

  const preserveCurrentState =
    options.preserveState ===
      true &&
    Number(
      window.explainState
        ?.model || 0
    ) === Number(model)

  const sourceState =
    preserveCurrentState
      ? window.explainState
      : sameSavedGame
        ? savedExplainState
        : null

  const words =
    sourceState &&
    Array.isArray(
      sourceState.words
    )
      ? buildExplainWords(
          rawWords,
          wordsCount
        )
      : buildExplainWords(
          rawWords,
          wordsCount
        )

  window.explainState = {
    model,
    wordsCount,
    words,

    usedNumbers:
      sourceState?.usedNumbers
        ?.map(Number)
        .filter(number => {
          return (
            number >= 1 &&
            number <= wordsCount
          )
        }) || [],

    currentNumber:
      sourceState?.currentNumber
        ? Number(
            sourceState.currentNumber
          )
        : null,

    currentWord:
      sourceState?.currentWord ||
      "",

    currentTeam:
      sourceState?.currentTeam ===
        "A" ||
      sourceState?.currentTeam ===
        "B"
        ? sourceState.currentTeam
        : null,

    wordVisible:
      sourceState
        ? sourceState
            .wordVisible !== false
        : true,

    timerVisible:
      sourceState
        ? !!sourceState.timerVisible
        : false,

    timeLeft:
      sourceState
        ? Number(
            sourceState.timeLeft ??
            EXPLAIN_TIMER_SECONDS
          )
        : EXPLAIN_TIMER_SECONDS,

    revealLock:
      preserveCurrentState
        ? !!sourceState
            ?.revealLock
        : false,

    answerResult:
      preserveCurrentState
        ? sourceState
            ?.answerResult ||
          null
        : null,

    scores: {
      A: Number(
        sourceState
          ?.scores?.A || 0
      ),

      B: Number(
        sourceState
          ?.scores?.B || 0
      )
    },

    attempts: {
      A: Number(
        sourceState
          ?.attempts?.A || 0
      ),

      B: Number(
        sourceState
          ?.attempts?.B || 0
      )
    },

    wordPoolKey,

    compensationActive:
      !!sourceState?.compensationActive,

    compensationNumber:
      Number(sourceState?.compensationNumber || 0) || null,

    compensationReturnTeam:
      sourceState?.compensationReturnTeam === "A" ||
      sourceState?.compensationReturnTeam === "B"
        ? sourceState.compensationReturnTeam
        : null
  }

  explainDoubleState =
    sourceState
      ? normalizeExplainDoubleState(
          preserveCurrentState
            ? explainDoubleState
            : savedDoubleState
        )
      : normalizeExplainDoubleState(
          null
        )

  explainDoublePickMode =
    false

  window.currentSegmentScores = {
    A: Number(
      window.explainState
        .scores.A || 0
    ),

    B: Number(
      window.explainState
        .scores.B || 0
    )
  }
}

async function loadExplainData(
  options = {}
) {
  const model = Number(
    window.currentModel ||
    localStorage.getItem(
      "game_model"
    ) ||
    0
  )

  if (!model) {
    showGameToast(
      "لم يتم اختيار نموذج"
    )

    return {
      data: [],
      error: new Error(
        "MODEL_NOT_SELECTED"
      )
    }
  }

  const wordsCount =
    getExplainConfiguredWordsCount(
      window.explainWordsCount ||
      localStorage.getItem(
        "explain_words_count"
      ) ||
      5
    )

  window.explainWordsCount =
    wordsCount

  localStorage.setItem(
    "explain_words_count",
    String(wordsCount)
  )

  const cacheKey =
    `${model}_${wordsCount}`

  if (
    explainDataCache[cacheKey] &&
    options.forceRefresh !== true
  ) {
    applyExplainLoadedData(
      model,
      wordsCount,
      explainDataCache[cacheKey]
    )

    return {
      data:
        explainDataCache[cacheKey],
      error: null,
      source: "memory-cache"
    }
  }

  if (
    explainDataPromise &&
    options.forceRefresh !== true
  ) {
    return explainDataPromise
  }

  explainDataPromise =
    (async () => {
      let result

      if (
        typeof window
          .cachedSupabaseSelect ===
        "function"
      ) {
        result =
          await window
            .cachedSupabaseSelect(
              "explain_words",
              {
                select:
                  "number,word",

                filters: {
                  model
                },

                order: {
                  column: "number",
                  ascending: true
                },

                ttl:
                  EXPLAIN_DATA_CACHE_TTL,

                forceRefresh:
                  options.forceRefresh ===
                  true,

                staleWhileRevalidate:
                  options
                    .staleWhileRevalidate !==
                  false,

                cacheKey:
                  `supabase_cache_v1:explain_words:${model}`,

                onBackgroundUpdate:
                  freshRows => {
                    const cleanRows =
                      normalizeExplainRows(
                        freshRows,
                        wordsCount
                      )

                    explainDataCache[
                      cacheKey
                    ] = cleanRows

                    if (
                      Number(
                        window.currentModel ||
                        localStorage.getItem(
                          "game_model"
                        ) ||
                        0
                      ) === model
                    ) {
                      applyExplainLoadedData(
                        model,
                        wordsCount,
                        cleanRows,
                        {
                          preserveState:
                            true
                        }
                      )

                      if (
                        document.querySelector(
                          ".explainWrap"
                        )
                      ) {
                        updateExplainUI()
                      }
                    }
                  }
              }
            )
      } else {
        const {
          data,
          error
        } = await db
          .from("explain_words")
          .select("number,word")
          .eq("model", model)
          .order("number", {
            ascending: true
          })

        result = {
          data: data || [],
          error,
          source: "network"
        }
      }

      const cleanRows =
        normalizeExplainRows(
          result.data || [],
          wordsCount
        )

      if (
        result.error &&
        !cleanRows.length
      ) {
        console.log(
          "LOAD EXPLAIN DATA ERROR:",
          result.error
        )

        return {
          data: [],
          error: result.error,
          source:
            result.source || "error"
        }
      }

      explainDataCache[cacheKey] =
        cleanRows

      applyExplainLoadedData(
        model,
        wordsCount,
        cleanRows
      )

      return {
        data: cleanRows,
        error: result.error || null,
        source:
          result.source || "network"
      }
    })()

  try {
    return await explainDataPromise
  } finally {
    explainDataPromise = null
  }
}

/* =========================
   Render
========================= */

async function renderExplain() {
  selectedTeam = null
  window.selectedTeam = null

  resetExplainTimer()
  resetExplainRevealTimeout()

  clearTimeout(
    explainStateSyncTimer
  )

  explainStateSyncTimer = null
  explainDoublePickMode = false
  explainDataPromise = null

  const explainLoadResult =
    await loadExplainData({
      staleWhileRevalidate: true
    })

  if (
    explainLoadResult.error &&
    !explainLoadResult.data.length
  ) {
    showGameToast(
      "تعذر تحميل بيانات فقرة اشرح الكلمة"
    )

    return
  }

  openSegment(
    "اشرح الكلمة",
    buildExplainHtml()
  )

  updateExplainUI()

  setExplainActiveTeam(
    window.explainState.currentTeam,
    {
      sync: false,
      save: false
    }
  )

  updateExplainDoubleButton()

  if (
    window.explainState.currentNumber &&
    window.explainState.timerVisible &&
    Number(
      window.explainState.timeLeft || 0
    ) > 0
  ) {
    resumeExplainTimer(
      window.explainState.timeLeft
    )
  }

  saveExplainState({
    immediate: true
  })
}

window.renderExplain = renderExplain

/* =========================
   HTML
========================= */

function buildExplainHtml() {
  const count = normalizeExplainWordsCount(window.explainState.wordsCount)

  return `
    <div class="explainWrap" data-segment-key="explain">

      <header class="explainHeader">

        <button
          class="explainDockBtn"
          type="button"
          onclick="goHome()"
        >
          رجوع
        </button>

        <button
          type="button"
          id="explainTeamABox"
          class="explainTeamMini teamA ${window.explainState.currentTeam === "A" ? "explainTeamCurrent" : ""}"
          data-team="A"
          onclick="selectExplainTeam('A')"
        >
          <div class="explainTeamName">
            <strong>${escapeDisplayHtml(teamAName || "الفريق الأول")}</strong>
          </div>

          <b id="explainScoreA">
            ${window.explainState.scores.A}
          </b>
        </button>

        <div class="explainTitle">
          <h1>اشرح الكلمة</h1>
        </div>

        <button
          type="button"
          id="explainTeamBBox"
          class="explainTeamMini teamB ${window.explainState.currentTeam === "B" ? "explainTeamCurrent" : ""}"
          data-team="B"
          onclick="selectExplainTeam('B')"
        >
          <b id="explainScoreB">
            ${window.explainState.scores.B}
          </b>

          <div class="explainTeamName">
            <strong>${escapeDisplayHtml(teamBName || "الفريق الثاني")}</strong>
          </div>
        </button>

        <button
          id="endRoundBtn"
          class="explainDockBtn"
          type="button"
          onclick="endCurrentSegment()"
          disabled
        >
          إنهاء
        </button>

      </header>

      <section class="explainMainStage">

        <div
          id="explainWordBox"
          class="explainWordBox"
          onclick="hideExplainWord()"
        ></div>

        <div
          id="explainTimerBox"
          class="explainTimerBox hidden"
        >
          ${EXPLAIN_TIMER_SECONDS}
        </div>

      </section>

      <section class="finalRound3NumbersBar finalTeamMediaNumbersBar">

        <div
          class="finalRound3Grid finalTeamMediaNumbersGrid"
          style="grid-template-columns:repeat(${count},minmax(0,1fr));"
        >

          ${Array.from({ length: count }, (_, idx) => {

const number = idx + 1

const used =
  window.explainState.usedNumbers.includes(number)

const isCompensation =
  isExplainCompensationNumber(number)

return `
  <button
    type="button"
    id="explainNumber_${number}"
    class="finalRound3Card finalTeamMediaNumberCard ${used ? "used" : ""} ${isCompensation && !used ? "segmentCompensationNumber" : ""}"
    ${used ? "disabled" : ""}
    ${
      used
        ? ""
        : isCompensation
          ? `
            onpointerdown="startExplainCompensationPress(event, ${number})"
            onpointerup="clearExplainCompensationPress()"
            onpointerleave="clearExplainCompensationPress()"
            onpointercancel="clearExplainCompensationPress()"
            oncontextmenu="return false"
            onselectstart="return false"
            onclick="blockExplainCompensationNormalClick(event)"
          `
          : `onclick="openExplainNumber(${number})"`
    }
  >
    ${used ? "" : number}
  </button>
`
          }).join("")}

        </div>

      </section>

      <footer class="explainActionBar">

        <button
          type="button"
          id="explainDoubleBtn"
          class="explainActionBtn explainDoubleBtn"
          onclick="activateExplainDouble()"
        >
          دوبيلا
        </button>

        <button
          type="button"
          class="explainActionBtn explainStartBtn"
          onclick="startExplainTimer()"
        >
          بدء المؤقت
        </button>

        <button
          type="button"
          class="explainActionBtn explainCorrectBtn"
          onclick="correctExplainAnswer()"
        >
          صح
        </button>

        <button
          type="button"
          class="explainActionBtn explainWrongBtn"
          onclick="wrongExplainAnswer()"
        >
          خطأ
        </button>

      </footer>

    </div>
  `
}

/* =========================
   UI Update
========================= */

function highlightExplainTeam(team) {
  const shell = document.querySelector(".explainWrap")
  if (!shell) return

  const a = shell.querySelector("#explainTeamABox")
  const b = shell.querySelector("#explainTeamBBox")

  if (a) {
    a.classList.remove(
      "activeTeam",
      "selectedPresenterTeam",
      "finalTurnActiveTeam",
      "explainTeamCurrent"
    )
  }

  if (b) {
    b.classList.remove(
      "activeTeam",
      "selectedPresenterTeam",
      "finalTurnActiveTeam",
      "explainTeamCurrent"
    )
  }

  if (team === "A" && a) {
    a.classList.add("explainTeamCurrent")
  }

  if (team === "B" && b) {
    b.classList.add("explainTeamCurrent")
  }
}

function updateExplainUI() {
  const scoreAEl = document.getElementById("explainScoreA")
  const scoreBEl = document.getElementById("explainScoreB")
  const wordBox = document.getElementById("explainWordBox")
  const timerBox = document.getElementById("explainTimerBox")

  if (scoreAEl) {
    scoreAEl.innerText = Number(window.explainState.scores.A || 0)
  }

  if (scoreBEl) {
    scoreBEl.innerText = Number(window.explainState.scores.B || 0)
  }

  const explainActiveTeam =
    window.explainState.currentTeam ||
    selectedTeam ||
    null

  highlightExplainTeam(explainActiveTeam)

  if (wordBox) {
    const hasWord = !!window.explainState.currentNumber
    const hiddenWord = hasWord && !window.explainState.wordVisible

    wordBox.classList.toggle("hasWord", hasWord)
    wordBox.classList.toggle("hiddenWord", hiddenWord)
    wordBox.classList.toggle("emptyWord", !hasWord)
    wordBox.classList.toggle("wordBoxInvisible", hiddenWord)
    wordBox.classList.toggle(
      "danger",
      hiddenWord &&
      window.explainState.timerVisible &&
      Number(window.explainState.timeLeft ?? EXPLAIN_TIMER_SECONDS) <= 5
    )

    wordBox.classList.toggle("answerCorrect", window.explainState.answerResult === "correct")
    wordBox.classList.toggle("answerWrong", window.explainState.answerResult === "wrong")

    if (!hasWord) {
      wordBox.innerText = ""
    } else if (hiddenWord && window.explainState.timerVisible) {
      wordBox.innerText = Number(window.explainState.timeLeft ?? EXPLAIN_TIMER_SECONDS)
    } else if (hiddenWord) {
      wordBox.innerText = ""
    } else {
      wordBox.innerText = window.explainState.currentWord || ""
    }
  }

  if (timerBox) {
    const timeLeft = Number(window.explainState.timeLeft ?? EXPLAIN_TIMER_SECONDS)

    timerBox.innerText = timeLeft
    timerBox.classList.add("hidden")
    timerBox.classList.toggle("danger", timeLeft <= 5)
  }

  for (let i = 1; i <= normalizeExplainWordsCount(window.explainState.wordsCount); i++) {
    const btn = document.getElementById(`explainNumber_${i}`)
    if (!btn) continue

    const used = window.explainState.usedNumbers.includes(i)
    const active = Number(window.explainState.currentNumber) === i

    btn.classList.toggle("used", used)
    btn.classList.toggle("active", active)

    btn.disabled =
      used ||
      !!window.explainState.currentNumber ||
      !!window.explainState.revealLock
  }

  updateExplainDoubleButton()
}

/* =========================
   Double
========================= */

function activateExplainDouble() {
  if (
    window.explainState.currentNumber ||
    window.explainState.revealLock
  ) {
    showGameToast(
      "الدوبيلا قبل اختيار الرقم فقط"
    )

    return
  }

  if (
    explainDoubleState.used.A &&
    explainDoubleState.used.B
  ) {
    showGameToast(
      "تم استخدام الدوبيلا من الفريقين"
    )

    return
  }

  const team =
    window.explainState.currentTeam

  if (team) {
    activateExplainDoubleForTeam(team)
    return
  }

  explainDoublePickMode = true

  showGameToast(
    "اختر الفريق لتفعيل الدوبيلا"
  )

  updateExplainDoubleButton()
  saveExplainState()
}

function activateExplainDoubleForTeam(team) {
  if (team !== "A" && team !== "B") {
    return false
  }

  if (
    window.explainState.currentNumber ||
    window.explainState.revealLock
  ) {
    showGameToast(
      "الدوبيلا قبل اختيار الرقم فقط"
    )

    return false
  }

  if (explainDoubleState.used[team]) {
    showGameToast(
      "هذا الفريق استخدم الدوبيلا مسبقًا"
    )

    return false
  }

  setExplainActiveTeam(team, {
    sync: true,
    save: false
  })

  explainDoubleState.used[team] = true
  explainDoubleState.activeTeam = team
  explainDoublePickMode = false

  showGameToast(
    `تم تفعيل الدوبيلا لفريق ${getExplainTeamName(team)}`
  )

  updateExplainUI()

  saveExplainState({
    immediate: true
  })

  return true
}

function getExplainScoreValue(team) {
  return (
    explainDoubleState.activeTeam === team
      ? 2
      : 1
  )
}

function clearExplainActiveDouble(team) {
  if (
    explainDoubleState.activeTeam === team
  ) {
    explainDoubleState.activeTeam = null
  }

  explainDoublePickMode = false
}

function updateExplainDoubleButton() {
  const btn =
    document.getElementById(
      "explainDoubleBtn"
    )

  if (!btn) return

  const team =
    window.explainState.currentTeam

  const allDone =
    Number(
      window.explainState
        .usedNumbers?.length || 0
    ) >=
    normalizeExplainWordsCount(
      window.explainState.wordsCount
    )

  btn.classList.remove(
    "activeDouble"
  )

  if (allDone) {
    btn.disabled = true
    btn.innerText = "انتهت الفقرة"
    return
  }

  if (explainDoublePickMode) {
    btn.disabled = false
    btn.innerText = "اختر الفريق"
    btn.classList.add("activeDouble")
    return
  }

  if (
    window.explainState.currentNumber ||
    window.explainState.revealLock
  ) {
    btn.disabled = true
    btn.innerText = "دوبيلا"
    return
  }

  if (
    explainDoubleState.used.A &&
    explainDoubleState.used.B
  ) {
    btn.disabled = true
    btn.innerText = "دوبيلا مقفل"
    return
  }

  if (
    team &&
    explainDoubleState.activeTeam === team
  ) {
    btn.disabled = true
    btn.innerText = "دوبيلا مفعّل"
    btn.classList.add("activeDouble")
    return
  }

  if (
    team &&
    explainDoubleState.used[team]
  ) {
    btn.disabled = true
    btn.innerText = "تم استخدام دوبيلا"
    return
  }

  btn.disabled = false
  btn.innerText = "دوبيلا"
}

/* =========================
   Team / Number
========================= */

function selectExplainTeam(
  team,
  options = {}
) {
  if (team !== "A" && team !== "B") {
    return false
  }

  const force =
    options.force === true

  if (
    window.explainState.revealLock &&
    !force
  ) {
    return false
  }

  if (explainDoublePickMode) {
    return activateExplainDoubleForTeam(
      team
    )
  }

  const compensationActive =
    window.explainState.compensationActive === true

  if (
    window.explainState.currentNumber &&
    compensationActive &&
    !force
  ) {
    setExplainActiveTeam(team, {
      sync: options.sync !== false,
      save: false
    })

    updateExplainUI()
    renderExplainCompensationBadge()

    saveExplainState({
      immediate: true
    })

    return true
  }

  if (
    window.explainState.currentNumber &&
    !force
  ) {
    showGameToast(
      "أنهِ الكلمة الحالية أولاً"
    )

    return false
  }

  const gameStarted =
    Array.isArray(
      window.explainState.usedNumbers
    ) &&
    window.explainState.usedNumbers.length > 0

  if (gameStarted && !force) {
    showGameToast(
      "الدور ينتقل تلقائيًا"
    )

    return false
  }

  setExplainActiveTeam(team, {
    sync: options.sync !== false,
    save: false
  })

  updateExplainUI()

  saveExplainState({
    immediate: true
  })

  return true
}

function forceExplainTeamFromPresenter(team) {
  return selectExplainTeam(team, {
    force: true,
    sync: true
  })
}

window.selectExplainTeam =
  selectExplainTeam

window.forceExplainTeamFromPresenter =
  forceExplainTeamFromPresenter

let explainCompensationPressTimer = null
let explainCompensationPressActivated = false

function getExplainCompensationNumber() {
  const count =
    normalizeExplainWordsCount(
      window.explainState?.wordsCount ||
      window.explainWordsCount ||
      localStorage.getItem("explain_words_count") ||
      0
    )

  return [5, 7, 9].includes(count) ? count : 0
}

function isExplainCompensationNumber(number) {
  const n = Number(number || 0)
  return n > 0 && n === getExplainCompensationNumber()
}

function clearExplainCompensationPress() {
  clearTimeout(explainCompensationPressTimer)
  explainCompensationPressTimer = null

  document
    .querySelectorAll(".segmentCompensationPressing")
    .forEach(el => {
      el.classList.remove("segmentCompensationPressing")
    })
}

function startExplainCompensationPress(event, number) {
  event.preventDefault()
  event.stopPropagation()

  unlockAudioContext()
  clearExplainCompensationPress()

  const n = Number(number || 0)

  if (!isExplainCompensationNumber(n)) {
    return false
  }

  explainCompensationPressActivated = false

  const button =
    event.currentTarget

      if (
    event.pointerId &&
    typeof button?.setPointerCapture === "function"
  ) {
    button.setPointerCapture(event.pointerId)
  }

  button?.classList.add(
    "segmentCompensationPressing"
  )

  explainCompensationPressTimer =
    setTimeout(() => {
      explainCompensationPressActivated = true

      button?.classList.remove(
        "segmentCompensationPressing"
      )

      openExplainNumber(n, {
        compensation: true
      })
    }, 700)

  return false
}

function blockExplainCompensationNormalClick(event) {
  event.preventDefault()
  event.stopPropagation()

  clearExplainCompensationPress()

  if (!explainCompensationPressActivated) {
    showGameToast(
      "اضغط مطولاً لتفعيل التعويض"
    )
  }

  explainCompensationPressActivated = false

  return false
}

function renderExplainCompensationBadge() {
  document
    .getElementById("explainCompensationBadge")
    ?.remove()

  if (window.explainState?.compensationActive !== true) {
    return
  }

  const wrap =
    document.querySelector(".explainWrap")

  if (!wrap) return

  wrap.insertAdjacentHTML(
    "afterbegin",
    `
      <div
        id="explainCompensationBadge"
        class="segmentCompensationBadge"
      >
        التعويض
      </div>
    `
  )
}

function openExplainNumber(number, options = {}) {
  unlockAudioContext()

  if (window.explainState.revealLock) return

  const n = Number(number || 0)

  const isCompensation =
    isExplainCompensationNumber(n)

  const compensationMode =
    options.compensation === true

  if (isCompensation && !compensationMode) {
    showGameToast(
      "اضغط مطولاً لتفعيل التعويض"
    )

    return
  }

  const activeTeam =
    selectedTeam || window.explainState.currentTeam

  if (!isCompensation) {
    if (!activeTeam) {
      showGameToast("اختر الفريق أولاً")
      return
    }

    if (!canExplainTeamPlay(activeTeam)) {
      const other = getExplainOtherTeam(activeTeam)
      showGameToast(`الدور الآن لـ ${getExplainTeamName(other)}`)
      return
    }
  }

  if (window.explainState.usedNumbers.includes(n)) {
    showGameToast("هذا الرقم مستخدم")
    return
  }

  const item = getExplainWordByNumber(n)

  if (!item || !String(item.word || "").trim()) {
    showGameToast("لا توجد كلمة محفوظة لهذا الرقم")
    return
  }

  resetExplainTimer()
  resetExplainRevealTimeout()

  window.explainState.currentNumber = n
  window.explainState.currentWord = item.word

  window.explainState.compensationActive =
    isCompensation && compensationMode

  window.explainState.compensationNumber =
    window.explainState.compensationActive
      ? n
      : null

  window.explainState.compensationReturnTeam =
    window.explainState.compensationActive &&
    (
      activeTeam === "A" ||
      activeTeam === "B"
    )
      ? activeTeam
      : null

  if (window.explainState.compensationActive) {
    selectedTeam = null
    window.selectedTeam = null

    setExplainActiveTeam(null)
  } else {
    setExplainActiveTeam(activeTeam)
  }

  window.explainState.wordVisible = true
  window.explainState.timerVisible = false
  window.explainState.timeLeft = EXPLAIN_TIMER_SECONDS

  playGameSound("open")

  updateExplainUI()
  renderExplainCompensationBadge()

  saveExplainState({
    immediate: true
  })
}

function hideExplainWord() {
  if (!window.explainState.currentNumber) return
  if (window.explainState.revealLock) return

  window.explainState.wordVisible = !window.explainState.wordVisible

  playGameSound("answer")
  updateExplainUI()
    saveExplainState({
    immediate: true
  })
}

/* =========================
   Timer
========================= */

function startExplainTimer() {
  if (
    typeof unlockAudioContext ===
    "function"
  ) {
    unlockAudioContext()
  }

  if (
    window.explainState.revealLock
  ) {
    return
  }

  if (
    !window.explainState.currentNumber
  ) {
    showGameToast("اختر رقم أولاً")
    return
  }

  runExplainTimer(
    EXPLAIN_TIMER_SECONDS
  )
}

function resumeExplainTimer(seconds) {
  runExplainTimer(seconds)
}

function runExplainTimer(seconds) {
  resetExplainTimer()

  let time = Math.max(
    0,
    Number(seconds || 0)
  )
    explainTimerStartedAt = Date.now()
  explainTimerDuration = time
  explainTimerEndsAt =
    time > 0
      ? explainTimerStartedAt + time * 1000
      : 0

  window.explainState.timerVisible =
    time > 0

  window.explainState.wordVisible =
    false

  window.explainState.timeLeft =
    time

  explainTimerLastTick = null

  updateExplainUI()

  saveExplainState({
    immediate: true
  })

  if (time <= 0) {
    window.explainState.timerVisible =
      false

    explainTimerEndsAt = 0

    return
  }

  explainTimer = setInterval(() => {
    time = Math.max(
      0,
      time - 1
    )

    window.explainState.timeLeft =
      time

    if (
      time > 0 &&
      time <= 5 &&
      explainTimerLastTick !== time
    ) {
      explainTimerLastTick = time
      playGameSound("tick")
    }

    if (time <= 0) {
      resetExplainTimer()

      window.explainState.timeLeft = 0
      window.explainState.timerVisible =
        false

      playGameSound("timeout")

      updateExplainUI()

      saveExplainState({
        immediate: true
      })

      return
    }

    updateExplainUI()
    saveExplainState({
      sync: false
    })
  }, 1000)
}

/* =========================
   Scoring
========================= */

function finishExplainNumber(isCorrect) {
  unlockAudioContext()

  if (window.explainState.revealLock) return

  const n = Number(window.explainState.currentNumber || 0)

  if (!n) {
    showGameToast("اختر رقم أولاً")
    return
  }

  const compensationActive =
    window.explainState.compensationActive === true &&
    Number(window.explainState.compensationNumber || 0) === n &&
    isExplainCompensationNumber(n)

  const returnTeam =
    window.explainState.compensationReturnTeam

  const activeTeam =
    window.explainState.currentTeam || selectedTeam

  if (!compensationActive && !activeTeam) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  if (
    compensationActive &&
    isCorrect &&
    !activeTeam
  ) {
    showGameToast("اختر الفريق قبل تسجيل التعويض")
    return
  }

  if (window.explainState.usedNumbers.includes(n)) {
    showGameToast("هذا الرقم محسوب مسبقاً")
    return
  }

  resetExplainTimer()
  resetExplainRevealTimeout()

  window.explainState.timerVisible = false
  window.explainState.wordVisible = true
  window.explainState.revealLock = true
  window.explainState.answerResult = isCorrect ? "correct" : "wrong"

  if (isCorrect) {
    const points =
      compensationActive
        ? 2
        : getExplainScoreValue(activeTeam)

    window.explainState.scores[activeTeam] =
      Number(window.explainState.scores[activeTeam] || 0) + points

    playGameSound("correct")
    flashScreen("correct")
  } else {
    playGameSound("wrong")
    flashScreen("wrong")
  }

  if (activeTeam) {
    clearExplainActiveDouble(activeTeam)

    window.explainState.attempts[activeTeam] =
      Number(window.explainState.attempts[activeTeam] || 0) + 1
  }

  if (
    !window.explainState.usedNumbers
      .includes(n)
  ) {
    window.explainState.usedNumbers.push(n)
  }

  window.explainState.compensationActive = false
  window.explainState.compensationNumber = null
  window.explainState.compensationReturnTeam = null

  window.currentSegmentScores = {
    A: Number(window.explainState.scores.A || 0),
    B: Number(window.explainState.scores.B || 0)
  }

  updateExplainUI()
  renderExplainCompensationBadge()

  saveExplainState({
    immediate: true
  })

  explainRevealTimeout = setTimeout(() => {
    const allDone =
      window.explainState.usedNumbers.length >=
      normalizeExplainWordsCount(window.explainState.wordsCount)

    let nextTeam = null

    if (!allDone) {
      if (activeTeam) {
        nextTeam = getExplainOtherTeam(activeTeam)
      } else if (
        returnTeam === "A" ||
        returnTeam === "B"
      ) {
        nextTeam = returnTeam
      }
    }

    window.explainState.currentNumber = null
    window.explainState.currentWord = ""

    if (nextTeam) {
      setExplainActiveTeam(nextTeam, {
        sync: false,
        save: false
      })
    } else {
      setExplainActiveTeam(null, {
        sync: false,
        save: false
      })
    }

    window.explainState.wordVisible = true
    window.explainState.timerVisible = false
    window.explainState.timeLeft = EXPLAIN_TIMER_SECONDS
    window.explainState.revealLock = false
    window.explainState.answerResult = null

    updateExplainUI()
    updateExplainDoubleButton()

    saveExplainState({
      immediate: true
    })
  }, 5000)
}

function correctExplainAnswer() {
  finishExplainNumber(true)
}

function wrongExplainAnswer() {
  finishExplainNumber(false)
}

window.activateExplainDouble = activateExplainDouble
window.selectExplainTeam = selectExplainTeam
window.openExplainNumber = openExplainNumber
window.startExplainCompensationPress =
  startExplainCompensationPress

window.clearExplainCompensationPress =
  clearExplainCompensationPress

window.blockExplainCompensationNormalClick =
  blockExplainCompensationNormalClick
window.hideExplainWord = hideExplainWord
window.startExplainTimer = startExplainTimer
window.correctExplainAnswer = correctExplainAnswer
window.wrongExplainAnswer = wrongExplainAnswer