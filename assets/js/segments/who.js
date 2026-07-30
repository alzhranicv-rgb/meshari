let whoState = {
  usedNumbers: [],
  scoreA: 0,
  scoreB: 0,
  currentPoints: 0,
  activeTeam: null,
  manualStartDone: false,
  lastAnsweredTeam: null
}

window.whoState = whoState

let whoDoubleState = {
  used: { A: false, B: false },
  activeTeam: null
}

let currentWhoAnswer = null
let currentWhoImage = null
let whoQuestionLocked = false
let whoCurrentNumber = null
let whoLastTickPlayed = null
let whoTimerStarted = false
let whoCompensationMode = false
let whoScoringLocked = false
let whoTimer = null
let whoStateSyncTimer = null
let whoFinishTimeout = null
let whoDataCache = {}
let whoDataPromise = null

let whoDataCacheModel = null

let whoTimerStartedAt = 0
let whoTimerEndsAt = 0
let whoTimerDuration = 0

const WHO_DATA_CACHE_TTL =
  10 * 60 * 1000
let whoMaxNumber = Number(
  window.whoMaxNumber ||
  localStorage.getItem("who_max_number") ||
  15
)
const WHO_STORAGE_KEY = "who_state_v1"

/* =========================
   Persistence
========================= */

function getWhoState() {
  try {
    return JSON.parse(localStorage.getItem(WHO_STORAGE_KEY) || "null")
  } catch {
    return null
  }
}
function syncWhoGlobals() {
  window.whoState = whoState
  window.whoCurrentNumber = whoCurrentNumber

  window.currentSegmentScores = {
    A: Number(whoState?.scoreA || 0),
    B: Number(whoState?.scoreB || 0)
  }
}

function saveWhoState(options = {}) {
  const timerBox = document.getElementById("timer")

  const state = {
    whoState: JSON.parse(
      JSON.stringify(whoState || {})
    ),

    whoDoubleState: JSON.parse(
      JSON.stringify(
        whoDoubleState || {
          used: {
            A: false,
            B: false
          },
          activeTeam: null
        }
      )
    ),

    currentWhoAnswer:
      currentWhoAnswer || null,

    currentWhoImage:
      currentWhoImage || null,

    whoQuestionLocked:
      !!whoQuestionLocked,

    whoCurrentNumber:
      whoCurrentNumber !== null
        ? Number(whoCurrentNumber)
        : null,

    whoTimerStarted:
      !!whoTimerStarted,

    whoCompensationMode:
      !!whoCompensationMode,

    timerValue:
      Number(timerBox?.innerText || 0),

    timerSync: {
      startedAt: Number(whoTimerStartedAt || 0),
      endsAt: Number(whoTimerEndsAt || 0),
      duration: Number(whoTimerDuration || 0)
    },

    whoScoringLocked:
      !!whoScoringLocked
  }

  localStorage.setItem(
    WHO_STORAGE_KEY,
    JSON.stringify(state)
  )

  localStorage.setItem(
    "active_segment",
    "who"
  )

  syncWhoGlobals()

  if (options.sync === false) {
    return
  }

  clearTimeout(whoStateSyncTimer)

  const immediate =
    options.immediate === true

  whoStateSyncTimer = setTimeout(() => {
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

function restoreWhoState(saved) {
  if (!saved) return

  clearInterval(whoTimer)
  whoTimer = null

  clearTimeout(whoFinishTimeout)
  whoFinishTimeout = null



  whoState = saved.whoState || {
    usedNumbers: [],
    scoreA: 0,
    scoreB: 0,
    currentPoints: 0,
    activeTeam: null,
    manualStartDone: false,
    lastAnsweredTeam: null
  }

  if (!Array.isArray(whoState.usedNumbers)) {
    whoState.usedNumbers = []
  }

  whoState.usedNumbers =
    whoState.usedNumbers
      .map(Number)
      .filter(number => Number.isFinite(number))

  whoState.scoreA =
    Number(whoState.scoreA || 0)

  whoState.scoreB =
    Number(whoState.scoreB || 0)

  whoState.currentPoints =
    Number(whoState.currentPoints || 0)

  whoState.activeTeam =
    whoState.activeTeam === "A" ||
    whoState.activeTeam === "B"
      ? whoState.activeTeam
      : null

  whoDoubleState =
    saved.whoDoubleState || {
      used: {
        A: false,
        B: false
      },
      activeTeam: null
    }

  if (!whoDoubleState.used) {
    whoDoubleState.used = {
      A: false,
      B: false
    }
  }

  whoDoubleState.used.A =
    !!whoDoubleState.used.A

  whoDoubleState.used.B =
    !!whoDoubleState.used.B

  whoDoubleState.activeTeam =
    whoDoubleState.activeTeam === "A" ||
    whoDoubleState.activeTeam === "B"
      ? whoDoubleState.activeTeam
      : null

  currentWhoAnswer =
    saved.currentWhoAnswer || null

  currentWhoImage =
    saved.currentWhoImage || null

  whoQuestionLocked =
    !!saved.whoQuestionLocked

  whoCurrentNumber =
    saved.whoCurrentNumber !== null &&
    saved.whoCurrentNumber !== undefined
      ? Number(saved.whoCurrentNumber)
      : null

  whoTimerStarted =
    !!saved.whoTimerStarted

  whoCompensationMode =
    !!saved.whoCompensationMode

  whoLastTickPlayed = null

  whoScoringLocked =
    !!saved.whoScoringLocked

  syncWhoGlobals()

  setWhoActiveTeam(
    whoState.activeTeam,
    {
      sync: false,
      save: false
    }
  )

  const scoreABox =
    document.getElementById("whoScoreA")

  const scoreBBox =
    document.getElementById("whoScoreB")

  if (scoreABox) {
    scoreABox.innerText =
      whoState.scoreA
  }

  if (scoreBBox) {
    scoreBBox.innerText =
      whoState.scoreB
  }

  highlightWhoPoints()
  highlightWhoTurnTeam()
  updateWhoTurnBox()
  updateWhoDoubleButton()

  const grid =
    document.querySelector(".whoGrid")

  if (grid) {
    grid.innerHTML = createWhoGrid()
  }

  updateWhoCompensationButton()
  setWhoScoreButtonsLocked(false)

  if (
    currentWhoImage &&
    whoQuestionLocked
  ) {
    showWhoImageFullscreen(
      currentWhoImage
    )

    openWhoImageOverlay()
  }

  const timerValue =
    Number(saved.timerValue || 0)

  if (
    whoTimerStarted &&
    whoQuestionLocked &&
    timerValue > 0
  ) {
    resumeWhoTimer(timerValue)
  } else {
    resetWhoTimer({
      save: false
    })
  }

  saveWhoState({
    immediate: true
  })
}

/* =========================
   Data Cache
========================= */

function buildWhoDataCache(
  rows = [],
  modelId = null
) {
  const cache = {}

  ;(rows || []).forEach(row => {
    const number =
      Number(row.number || 0)

    if (
      number < 1 ||
      number > whoMaxNumber
    ) {
      return
    }

    cache[number] = {
      number,

      answer:
        String(row.answer || ""),

      image:
        String(row.image || "")
    }
  })

  whoDataCache = cache

  if (modelId) {
    whoDataCacheModel =
      Number(modelId)
  }

  return whoDataCache
}

async function loadWhoData(
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
    return {
      data: [],
      error:
        new Error(
          "رقم النموذج غير صالح"
        )
    }
  }

    if (
    whoDataCacheModel === modelId &&
    Object.keys(whoDataCache || {}).length &&
    options.forceRefresh !== true
  ) {
    return {
      data: Object.values(whoDataCache),
      error: null,
      source: "memory"
    }
  }

  if (
    whoDataPromise &&
    options.forceRefresh !== true
  ) {
    return whoDataPromise
  }

  whoDataPromise = (async () => {
    try {
      let result

      if (
        typeof window
          .cachedSupabaseSelect ===
        "function"
      ) {
        result =
          await window
            .cachedSupabaseSelect(
              "who_images",
              {
                select:
                  "number,image,answer",

                filters: {
                  model: modelId
                },

                order: {
                  column: "number",
                  ascending: true
                },

                ttl:
                  WHO_DATA_CACHE_TTL,

                forceRefresh:
                  options.forceRefresh ===
                  true,

                staleWhileRevalidate:
                  options
                    .staleWhileRevalidate !==
                  false,

                cacheKey:
                  `supabase_cache_v1:who_images:${modelId}`,

                onBackgroundUpdate:
                  freshRows => {
                    buildWhoDataCache(
                      freshRows || [],
                      modelId
                    )
                  }
              }
            )
      } else {
        const {
          data,
          error
        } = await db
          .from("who_images")
          .select(
            "number,image,answer"
          )
          .eq("model", modelId)
          .order("number", {
            ascending: true
          })

        result = {
          data,
          error,
          source: "network"
        }
      }

      if (
        result?.error &&
        !result?.data?.length
      ) {
        throw result.error
      }

      buildWhoDataCache(
        result?.data || [],
        modelId
      )

      return {
        data:
          result?.data || [],
        error: null,
        source:
          result?.source ||
          "network"
      }
    } catch (error) {
      console.log(
        "WHO DATA LOAD ERROR:",
        error
      )

      return {
        data:
          Object.values(
            whoDataCache
          ),
        error
      }
    } finally {
      whoDataPromise = null
    }
  })()

  return whoDataPromise
}

function getWhoDataByNumber(
  number
) {
  return (
    whoDataCache[
      Number(number)
    ] || null
  )
}

/* =========================
   Render
========================= */

window.renderWho = async function () {
  clearInterval(whoTimer)
  whoTimer = null

  clearTimeout(whoStateSyncTimer)
  whoStateSyncTimer = null

  clearTimeout(whoFinishTimeout)
  whoFinishTimeout = null

  const whoCurrentModelId =
    Number(
      window.currentModel ||
      currentModel ||
      localStorage.getItem(
        "game_model"
      ) ||
      0
    )

  if (
    whoDataCacheModel &&
    whoDataCacheModel !==
      whoCurrentModelId
  ) {
    whoDataCache = {}
  }

  whoDataPromise = null
  whoScoringLocked = false

  document
    .getElementById("whoImageOverlay")
    ?.remove()

  document
    .getElementById("whoZoomFlashLayer")
    ?.remove()

  document.body.classList.remove(
    "whoOverlayActive"
  )

  whoMaxNumber = Number(
    window.whoMaxNumber ||
    localStorage.getItem("who_max_number") ||
    15
  )

    whoMaxNumber = Math.min(
    Math.max(whoMaxNumber, 10),
    15
  )

  const whoLoadResult =
    await loadWhoData({
      staleWhileRevalidate: true
    })

  if (
    whoLoadResult.error &&
    !whoLoadResult.data.length
  ) {
    showGameToast(
      "تعذر تحميل بيانات فقرة من هو"
    )

    return
  }

  const saved = getWhoState()


  whoState = {
    usedNumbers: [],
    scoreA: 0,
    scoreB: 0,
    currentPoints: 0,
    activeTeam: null,
    manualStartDone: false,
    lastAnsweredTeam: null
  }

  whoDoubleState = {
    used: { A: false, B: false },
    activeTeam: null
  }

  window.whoState = whoState
  window.currentSegmentScores = { A: 0, B: 0 }

  currentWhoAnswer = null
  currentWhoImage = null
  selectedTeam = null
  whoQuestionLocked = false
  whoCurrentNumber = null
  whoLastTickPlayed = null
  whoTimerStarted = false
  whoCompensationMode = false

openSegment("من هو", `
  <div class="whoWrap" data-segment-key="who">

    <header class="whoHeader">

      <button class="whoDockBtn" type="button" onclick="goHome()">
        رجوع
      </button>

      <div
        class="whoTeamMini teamA"
        onclick="selectWhoTeam('A')"
        id="whoTeamABox"
      >
        <div class="whoTeamName">
          <strong>${escapeDisplayHtml(teamAName || "الفريق الأول")}</strong>
        </div>

        <b id="whoScoreA">${whoState.scoreA}</b>
      </div>

      <div class="whoTitle">
  <h1>من هو</h1>
  <span id="timer" class="whoTimerHidden">0</span>
</div>

      <div
        class="whoTeamMini teamB"
        onclick="selectWhoTeam('B')"
        id="whoTeamBBox"
      >
        <b id="whoScoreB">${whoState.scoreB}</b>

        <div class="whoTeamName">
          <strong>${escapeDisplayHtml(teamBName || "الفريق الثاني")}</strong>
        </div>
      </div>

      <button
        id="endRoundBtn"
        class="whoDockBtn"
        type="button"
        onclick="endCurrentSegment()"
        disabled
      >
        إنهاء
      </button>

    </header>

    <section class="whoPointsCard">

      <div class="whoTurnSide" id="whoTurnInline">
        الدور: ${getWhoTurnName()}
      </div>

      <div class="whoPointsSide">
        <span class="whoPointsLabel">اختر النقاط</span>

        <button onclick="setWhoPoints(1)" class="whoPointBtn" id="whoPoint1">1</button>
        <button onclick="setWhoPoints(2)" class="whoPointBtn" id="whoPoint2">2</button>
        <button onclick="setWhoPoints(3)" class="whoPointBtn" id="whoPoint3">3</button>
        <button onclick="setWhoPoints(4)" class="whoPointBtn" id="whoPoint4">4</button>
        <button onclick="setWhoPoints(5)" class="whoPointBtn" id="whoPoint5">5</button>
      </div>

    </section>

    <section id="whoImageStage" class="whoImageStage whoImageStageEmpty"></section>

    <section class="whoGrid">
      ${createWhoGrid()}
    </section>

    <footer class="whoActionBar">

      <button
        onclick="activateWhoDouble()"
        class="whoActionBtn whoDoubleBtn"
        id="whoDoubleBtn"
      >
        دوبيلا
      </button>

      <button
        onclick="startWhoCompensation()"
        class="whoActionBtn whoCompensationBtn"
        id="whoCompensationBtn"
        disabled
      >
        التعويض
      </button>

      <button onclick="whoCorrect()" class="whoActionBtn btnCorrect">
        صح
      </button>

      <button onclick="whoWrong()" class="whoActionBtn btnWrong">
        خطأ
      </button>

    </footer>

  </div>
`)

  if (saved) {
    restoreWhoState(saved)
  } else {
    saveWhoState()
  }
  if (whoState.activeTeam) {
  setWhoActiveTeam(whoState.activeTeam, { sync:false })
}

  updateWhoDoubleButton()
updateWhoCompensationButton()
}

/* =========================
   Double
========================= */

function activateWhoDouble() {
  const team =
    whoState.activeTeam

  if (!team) {
    showGameToast(
      "اختر الفريق أولاً"
    )

    return
  }

  if (
    whoQuestionLocked ||
    whoCurrentNumber
  ) {
    showGameToast(
      "الدوبيلا قبل اختيار السؤال فقط"
    )

    return
  }

  if (
    whoDoubleState.activeTeam === team
  ) {
    showGameToast(
      "الدوبيلا مفعّل"
    )

    return
  }

  if (
    whoDoubleState.used[team]
  ) {
    showGameToast(
      "هذا الفريق استخدم الدوبيلا مسبقًا"
    )

    return
  }

  if (
    whoDoubleState.used.A &&
    whoDoubleState.used.B
  ) {
    showGameToast(
      "تم استخدام الدوبيلا من الفريقين"
    )

    return
  }

  whoDoubleState.used[team] = true
  whoDoubleState.activeTeam = team

  showGameToast(
    `تم تفعيل الدوبيلا لفريق ${
      team === "A"
        ? teamAName
        : teamBName
    }`
  )

  updateWhoDoubleButton()

  saveWhoState({
    immediate: true
  })
}

function getWhoScoreValue(team) {
  const base = Number(whoState.currentPoints || 0)
  return whoDoubleState.activeTeam === team ? base * 2 : base
}

function clearWhoActiveDouble() {
  whoDoubleState.activeTeam = null
}

function updateWhoDoubleButton() {
  const btn =
    document.getElementById(
      "whoDoubleBtn"
    )

  if (!btn) return

  const team =
    whoState.activeTeam

  btn.classList.remove(
    "activeDouble"
  )

  if (
    whoQuestionLocked ||
    whoCurrentNumber
  ) {
    btn.disabled = true
    btn.innerText = "دوبيلا"
    return
  }

  if (!team) {
    btn.disabled = true
    btn.innerText = "دوبيلا"
    return
  }

  if (
    whoDoubleState.activeTeam === team
  ) {
    btn.disabled = true
    btn.innerText = "دوبيلا مفعّل"
    btn.classList.add(
      "activeDouble"
    )

    return
  }

  if (
    whoDoubleState.used[team]
  ) {
    btn.disabled = true
    btn.innerText =
      "تم استخدام دوبيلا"

    return
  }

  btn.disabled = false
  btn.innerText = "دوبيلا"
}

/* =========================
   Grid / Points
========================= */

function createWhoGrid() {
  let html = ""

  const maxNumber = Number(whoMaxNumber || window.whoMaxNumber || 15)
  const used = (whoState.usedNumbers || []).map(Number)

  const lock15 =
    maxNumber === 15 &&
    !used.includes(15) &&
    used.length < 14

  const waitCompensation =
    maxNumber === 15 &&
    !used.includes(15) &&
    used.length === 14 &&
    !whoCompensationMode

  for (let i = 1; i <= maxNumber; i++) {
    const isUsed = used.includes(i)
    const isLocked15 = i === 15 && (lock15 || waitCompensation)

    html += `
      <button
        onclick="${isLocked15 ? "" : `chooseWho(${i})`}"
        class="whoBtn ${isUsed ? "used" : ""} ${isLocked15 ? "whoBtnLocked15" : ""}"
        ${(isUsed || isLocked15) ? "disabled" : ""}
      >
        ${isUsed ? "" : i}
      </button>
    `
  }

  return html
}

function setWhoPoints(p) {
  if (whoCompensationMode) {
    showGameToast("في التعويض النقاط ثابتة 5")
    return
  }

  if (whoQuestionLocked) {
    showGameToast("لا يمكن تغيير النقاط بعد اختيار السؤال")
    return
  }

  whoState.currentPoints = p
  highlightWhoPoints()
  saveWhoState()
}

function highlightWhoPoints() {
  for (let i = 1; i <= 5; i++) {
    const btn = document.getElementById(`whoPoint${i}`)
    if (!btn) continue

    btn.classList.remove("selectedWhoPoint")

    if (whoState.currentPoints === i) {
      btn.classList.add("selectedWhoPoint")
    }
  }
}

function resetWhoPoints() {
  whoState.currentPoints = 0
  highlightWhoPoints()
}

function getWhoOtherTeam(team) {
  return team === "A" ? "B" : "A"
}

function getWhoTurnName() {
  if (whoState.activeTeam === "A") return teamAName
  if (whoState.activeTeam === "B") return teamBName
  return "اختر فريق"
}

function setWhoActiveTeam(
  team,
  options = {}
) {
  const validTeam =
    team === "A" ||
    team === "B"

  whoState.activeTeam =
    validTeam ? team : null

  selectedTeam =
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
    } else {
      document.body.dataset.activeTeam =
        team
    }
  } else {
    if (
      typeof clearGameActiveTeam ===
      "function"
    ) {
      clearGameActiveTeam({
        sync: false
      })
    } else {
      delete document.body.dataset
        .activeTeam
    }
  }

  highlightWhoTurnTeam()
  updateWhoTurnBox()
  updateWhoDoubleButton()

  if (options.save === true) {
    saveWhoState({
      immediate:
        options.immediate === true,

      sync:
        options.sync !== false
    })
  }

  return true
}

function updateWhoTurnBox() {
  const inline = document.getElementById("whoTurnInline")
  if (inline) {
    inline.innerText = "الدور: " + getWhoTurnName()
  }

  updateWhoDoubleButton()
}

function selectWhoTeam(
  team,
  options = {}
) {
  if (
    team !== "A" &&
    team !== "B"
  ) {
    return false
  }

  const force =
    options.force === true

  if (
    !force &&
    whoQuestionLocked &&
    !whoCompensationMode
  ) {
    showGameToast(
      "سجل نتيجة السؤال الحالي أولاً"
    )

    return false
  }

  if (
    !force &&
    whoCompensationMode &&
    whoQuestionLocked
  ) {
    setWhoActiveTeam(team, {
      sync:
        options.sync !== false,
      save: false
    })

    saveWhoState({
      immediate: true
    })

    return true
  }

  if (
    !force &&
    whoState.manualStartDone &&
    whoState.activeTeam
  ) {
    showGameToast(
      "بعد البداية الأولى ينتقل الدور تلقائيًا"
    )

    return false
  }

  whoState.manualStartDone = true

  setWhoActiveTeam(team, {
    sync:
      options.sync !== false,
    save: false
  })

  saveWhoState({
    immediate: true
  })

  setTimeout(() => {
    highlightWhoTurnTeam()
  }, 50)

  return true
}

function forceWhoTeamFromPresenter(
  team
) {
  return selectWhoTeam(team, {
    force: true,
    sync: true
  })
}

window.selectWhoTeam =
  selectWhoTeam

window.forceWhoTeamFromPresenter =
  forceWhoTeamFromPresenter

function getWhoTeamBox(team) {
  const letter = team === "A" ? "A" : "B"

  return (
    document.getElementById(`whoTeam${letter}Box`) ||
    document.getElementById(`whoTeam${letter}`) ||
    document.getElementById(`whoScore${letter}Box`) ||
    document.getElementById(`whoScorePanel${letter}`) ||
    document.querySelector(`[onclick="selectWhoTeam('${letter}')"]`) ||
    document.querySelector(`[onclick='selectWhoTeam("${letter}")']`) ||
    document.querySelector(`[data-team="${letter}"]`) ||
    document.querySelector(`.whoTeamBox.team${letter}`) ||
    document.querySelector(`.whoTeamCard.team${letter}`) ||
    document.querySelector(`.whoScorePanel.team${letter}`)
  )
}

function highlightWhoTurnTeam() {
  const team = whoState.activeTeam || selectedTeam || null

  const a = document.getElementById("whoTeamABox")
  const b = document.getElementById("whoTeamBBox")

  if (team === "A" || team === "B") {
    document.body.setAttribute("data-active-team", team)
  } else {
    document.body.removeAttribute("data-active-team")
  }

  if (a) {
    a.classList.remove(
      "activeTeam",
      "selectedPresenterTeam",
      "finalTurnActiveTeam",
      "whoTeamCurrent"
    )
  }

  if (b) {
    b.classList.remove(
      "activeTeam",
      "selectedPresenterTeam",
      "finalTurnActiveTeam",
      "whoTeamCurrent"
    )
  }

  if (team === "A" && a) {
    a.classList.add("whoTeamCurrent")
    a.setAttribute("data-current-team", "true")
  } else if (a) {
    a.removeAttribute("data-current-team")
  }

  if (team === "B" && b) {
    b.classList.add("whoTeamCurrent")
    b.setAttribute("data-current-team", "true")
  } else if (b) {
    b.removeAttribute("data-current-team")
  }

  console.log("WHO ACTIVE TEAM:", {
    team,
    bodyTeam: document.body.getAttribute("data-active-team"),
    aClass: a ? a.className : null,
    bClass: b ? b.className : null
  })
}

function switchWhoTurn() {
  if (!whoState.activeTeam) return

  whoState.lastAnsweredTeam = whoState.activeTeam
setWhoActiveTeam(getWhoOtherTeam(whoState.activeTeam))
}


function canUseWhoCompensation() {
  const maxNumber = Number(whoMaxNumber || window.whoMaxNumber || 15)

  if (maxNumber !== 15) return false

  const used = (whoState.usedNumbers || []).map(Number)
  const remaining = []

  for (let i = 1; i <= maxNumber; i++) {
    if (!used.includes(i)) remaining.push(i)
  }

  return (
    !whoQuestionLocked &&
    !whoCurrentNumber &&
    remaining.length === 1 &&
    remaining[0] === 15
  )
}

function updateWhoCompensationButton() {
  const btn = document.getElementById("whoCompensationBtn")
  if (!btn) return

  const active = canUseWhoCompensation()

  btn.disabled = !active
  btn.classList.toggle("activeCompensation", active)
}

async function startWhoCompensation() {
  if (!canUseWhoCompensation()) {
    showGameToast(
      "التعويض يتفعل فقط إذا بقي الرقم 15"
    )

    return
  }

  whoCompensationMode = true
  whoState.currentPoints = 5

  setWhoActiveTeam(null, {
    sync: true,
    save: false
  })

  highlightWhoPoints()

  const grid =
    document.querySelector(".whoGrid")

  if (grid) {
    grid.innerHTML =
      createWhoGrid()
  }

  updateWhoCompensationButton()

  saveWhoState({
    immediate: true
  })

  showGameToast(
    "تم تفعيل التعويض، افتح رقم 15 ثم اختر الفريق"
  )
}
/* =========================
   Question
========================= */

async function chooseWho(num) {
  if (whoQuestionLocked) {
    showGameToast("سجل النتيجة أولاً")
    return
  }

  if (!whoState.activeTeam && !whoCompensationMode) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  if (whoState.currentPoints === 0 && !whoCompensationMode) {
    showGameToast("اختر النقاط أولاً")
    return
  }

  if (whoState.usedNumbers.includes(num)) return

  whoState.usedNumbers.push(num)
  window.whoState = whoState

  whoQuestionLocked = true
  whoCurrentNumber = num

  updateWhoDoubleButton()

  const grid = document.querySelector(".whoGrid")
  if (grid) {
    grid.innerHTML = createWhoGrid()
  }

    let data =
    getWhoDataByNumber(num)

  if (!data) {
    const loadResult =
      await loadWhoData({
        forceRefresh: true,
        staleWhileRevalidate: false
      })

    if (!loadResult.error) {
      data =
        getWhoDataByNumber(
          num
        )
    }
  }

  if (!data) {
    console.log(
  "WHO ITEM NOT FOUND:",
  num
)

    showGameToast("تعذر تحميل الصورة")

    whoState.usedNumbers = whoState.usedNumbers.filter(n => Number(n) !== Number(num))
    window.whoState = whoState

    whoQuestionLocked = false
    whoCurrentNumber = null
    currentWhoAnswer = null
    currentWhoImage = null

    if (grid) {
      grid.innerHTML = createWhoGrid()
    }

    updateWhoDoubleButton()
    updateWhoCompensationButton()
    saveWhoState()
    return
  }

  currentWhoAnswer = data.answer || ""
  currentWhoImage = data.image || ""

  showWhoImageFullscreen(currentWhoImage)
  openWhoImageOverlay()
  startWhoTimer()

  updateWhoCompensationButton()
  saveWhoState()
}

function showWhoImageFullscreen(imageUrl) {
  const stage = document.getElementById("whoImageStage")
  if (!stage || !imageUrl) return

  stage.innerHTML = `
    <div class="whoImageFrame" onclick="toggleWhoImageOverlay()">
      <img src="${escapeDisplayHtml(imageUrl)}" class="whoImageFull" alt="">
    </div>
  `

  stage.classList.remove("whoImageStageEmpty")

  if (typeof protectDisplayMedia === "function") {
    protectDisplayMedia(stage)
  }

  if (typeof applyDisplayMediaRevealFx === "function") {
    applyDisplayMediaRevealFx(stage)
  }
}

function hideWhoImage() {
  const stage = document.getElementById("whoImageStage")
  if (!stage) return

  stage.innerHTML = ""
  stage.classList.add("whoImageStageEmpty")
}

function showWhoAnswer(resultType = "") {
  if (!whoQuestionLocked || !currentWhoAnswer) {
    showGameToast("اختر سؤالاً أولاً")
    return
  }

  const oldOverlay = document.getElementById("whoImageOverlay")
  if (oldOverlay) oldOverlay.remove()

  document.body.classList.remove("whoOverlayActive")

  const stage = document.getElementById("whoImageStage")
  if (!stage) return

  const resultClass =
    resultType === "correct"
      ? "correctResult"
      : resultType === "wrong"
      ? "wrongResult"
      : ""

  const resultLabel =
    resultType === "correct"
      ? "إجابة صحيحة"
      : resultType === "wrong"
      ? "إجابة خاطئة"
      : "الإجابة"

  stage.innerHTML = `
    <div class="whoResultView ${resultClass}">

      <div class="whoResultImageBox" onclick="toggleWhoImageOverlay()">
        <img src="${currentWhoImage || ""}" class="whoResultImage" alt="">
      </div>

      <div class="whoResultAnswerBox">
        <div class="whoResultAnswerLabel">${escapeDisplayHtml(resultLabel)}</div>
        <div class="whoResultAnswerText">${escapeDisplayHtml(currentWhoAnswer)}</div>
      </div>

    </div>
  `

  stage.classList.remove("whoImageStageEmpty")

  if (typeof protectDisplayMedia === "function") {
    protectDisplayMedia(stage)
  }

  if (typeof applyDisplayMediaRevealFx === "function") {
    applyDisplayMediaRevealFx(stage)
  }

  saveWhoState()
}

function clearWhoStage() {
  const stage = document.getElementById("whoImageStage")
  if (!stage) return

  const oldOverlay = document.getElementById("whoImageOverlay")
  if (oldOverlay) oldOverlay.remove()

  document.body.classList.remove("whoOverlayActive")

  stage.innerHTML = ""
  stage.classList.add("whoImageStageEmpty")

  currentWhoAnswer = null
  currentWhoImage = null
}

/* =========================
   Timer
========================= */

function startWhoTimer() {
  runWhoTimer(30)
}

function resumeWhoTimer(time) {
  runWhoTimer(time)
}

function runWhoTimer(startValue) {
  const timerBox =
    document.getElementById("timer")

  if (!timerBox) return

  clearInterval(whoTimer)
  whoTimer = null

  let time = Math.max(
    0,
    Number(startValue || 0)
  )

    whoTimerStartedAt = Date.now()
  whoTimerDuration = time
  whoTimerEndsAt =
    time > 0
      ? whoTimerStartedAt + time * 1000
      : 0

  whoTimerStarted =
    time > 0

  whoLastTickPlayed = null

  timerBox.innerText = time

  const updateTimerUI = () => {
    const overlayTimer =
      document.getElementById(
        "whoOverlayTimer"
      )

    if (overlayTimer) {
      overlayTimer.innerText = time

      overlayTimer.classList.toggle(
        "timerDanger",
        time > 0 && time <= 5
      )
    }

    timerBox.classList.toggle(
      "timerDanger",
      time > 0 && time <= 5
    )
  }

  updateTimerUI()

  saveWhoState({
    sync: false
  })

  if (time <= 0) {
    whoTimerStarted = false
    whoTimerEndsAt = 0
    return
  }

  whoTimer = setInterval(() => {
    time = Math.max(
      0,
      time - 1
    )

    timerBox.innerText = time
    updateTimerUI()

    if (
      time > 0 &&
      time <= 5 &&
      whoLastTickPlayed !== time
    ) {
      whoLastTickPlayed = time
      playGameSound("tick")
    }

    saveWhoState({
      sync: false
    })

    if (time > 0) return

    clearInterval(whoTimer)
    whoTimer = null

    whoTimerStarted = false
    whoLastTickPlayed = null
    whoTimerEndsAt = 0

    timerBox.innerText = 0
    timerBox.classList.remove(
      "timerDanger"
    )

    const overlayTimer =
      document.getElementById(
        "whoOverlayTimer"
      )

    overlayTimer?.classList.remove(
      "timerDanger"
    )

    playGameSound("timeout")

    saveWhoState({
      immediate: true
    })
  }, 1000)
}

function resetWhoTimer(
  options = {}
) {
  clearInterval(whoTimer)
  whoTimer = null

  whoTimerStarted = false
  whoLastTickPlayed = null

  whoTimerStartedAt = 0
  whoTimerEndsAt = 0
  whoTimerDuration = 0

  const timerBox =
    document.getElementById("timer")

  if (timerBox) {
    timerBox.innerText = 0
    timerBox.classList.remove(
      "timerDanger"
    )
  }

  const overlayTimer =
    document.getElementById(
      "whoOverlayTimer"
    )

  if (overlayTimer) {
    overlayTimer.innerText = 0
    overlayTimer.classList.remove(
      "timerDanger"
    )
  }

  if (options.save !== false) {
    saveWhoState()
  }
}
/* =========================
   Score Buttons Guard
   حماية أزرار التسجيل من التكرار
========================= */

function setWhoScoreButtonsLocked(isLocked) {
  whoScoringLocked = !!isLocked

  const buttons = [
    document.querySelector(".btnCorrect"),
    document.querySelector(".btnWrong")
  ]

  buttons.forEach(btn => {
    if (!btn) return

    btn.disabled = whoScoringLocked
    btn.classList.toggle("whoScoreBtnLocked", whoScoringLocked)
  })
}

function canScoreWhoNow() {
  if (whoScoringLocked) {
    return false
  }

  whoScoringLocked = true
  setWhoScoreButtonsLocked(true)

  return true
}

/* =========================
   Result
========================= */

function finishWhoAfterAnswerDelay(
  answeredTeam
) {
  resetWhoTimer({
    save: false
  })

  clearTimeout(whoFinishTimeout)

  whoFinishTimeout = setTimeout(() => {
    clearWhoStage()

    whoState.lastAnsweredTeam =
      answeredTeam || null

    const allDone =
      Number(
        whoState.usedNumbers?.length || 0
      ) >= Number(whoMaxNumber || 15)

    if (
      allDone ||
      whoCompensationMode
    ) {
      setWhoActiveTeam(null, {
        sync: true,
        save: false
      })
    } else if (answeredTeam) {
      setWhoActiveTeam(
        getWhoOtherTeam(
          answeredTeam
        ),
        {
          sync: true,
          save: false
        }
      )
    }

    resetWhoPoints()

    whoQuestionLocked = false
    whoCurrentNumber = null
    whoScoringLocked = false
    whoCompensationMode = false

    setWhoScoreButtonsLocked(false)
    updateWhoDoubleButton()
    updateWhoCompensationButton()

    const grid =
      document.querySelector(".whoGrid")

    if (grid) {
      grid.innerHTML =
        createWhoGrid()
    }

    saveWhoState({
      immediate: true
    })
  }, 5000)
}

function whoCorrect() {
  if (!canScoreWhoNow()) return

  if (!whoQuestionLocked) {
    setWhoScoreButtonsLocked(false)
    showGameToast("اختر رقمًا أولاً")
    return
  }

  if (whoCompensationMode && !whoState.activeTeam) {
    setWhoScoreButtonsLocked(false)
    showGameToast("اختر الفريق الذي يأخذ التعويض ثم اضغط صح")
    return
  }

  if (!whoState.activeTeam) {
    setWhoScoreButtonsLocked(false)
    showGameToast("اختر الفريق أولاً")
    return
  }

  const team = whoState.activeTeam
  const points = whoCompensationMode ? 5 : getWhoScoreValue(team)

  if (team === "A") {
    whoState.scoreA += points
    document.getElementById("whoScoreA").innerText = whoState.scoreA
  } else {
    whoState.scoreB += points
    document.getElementById("whoScoreB").innerText = whoState.scoreB
  }

  clearWhoActiveDouble()

  playGameSound("correct")
  flashScreen("correct")
  showWhoAnswer("correct")

  window.whoState = whoState
  window.currentSegmentScores = {
    A: whoState.scoreA,
    B: whoState.scoreB
  }

  whoCompensationMode = false
  updateWhoCompensationButton()

  saveWhoState({
    immediate: true
  })

  finishWhoAfterAnswerDelay(team)
}

function whoWrong() {
  if (!canScoreWhoNow()) return

  if (!whoState.activeTeam) {
    setWhoScoreButtonsLocked(false)
    showGameToast("اختر الفريق أولاً")
    return
  }

  if (!whoQuestionLocked) {
    setWhoScoreButtonsLocked(false)
    showGameToast("اختر رقمًا أولاً")
    return
  }

  if (whoState.currentPoints === 0 && !whoCompensationMode) {
    setWhoScoreButtonsLocked(false)
    showGameToast("اختر النقاط أولاً")
    return
  }

  const team = whoState.activeTeam
  const points = whoCompensationMode ? 5 : getWhoScoreValue(team)

  if (team === "A") {
    whoState.scoreA -= points
    document.getElementById("whoScoreA").innerText = whoState.scoreA
  } else {
    whoState.scoreB -= points
    document.getElementById("whoScoreB").innerText = whoState.scoreB
  }

  clearWhoActiveDouble()

  playGameSound("wrong")
  flashWhoZoomOverlayWrong()
  flashScreen("wrong")
  showWhoAnswer("wrong")

  window.whoState = whoState
  window.currentSegmentScores = {
    A: whoState.scoreA,
    B: whoState.scoreB
  }

  whoCompensationMode = false
  updateWhoCompensationButton()

  saveWhoState({
  immediate: true
})

finishWhoAfterAnswerDelay(team)
}

function flashWhoZoomOverlayWrong() {
  const whoOverlay = document.getElementById("whoImageOverlay")

  const whoVisible = whoOverlay && !whoOverlay.classList.contains("hidden")

  if (!whoVisible) {
    return false
  }

  let flashLayer = document.getElementById("whoZoomFlashLayer")

  if (!flashLayer) {
    flashLayer = document.createElement("div")
    flashLayer.id = "whoZoomFlashLayer"
    flashLayer.className = "whoZoomFlashLayer"
    document.body.appendChild(flashLayer)
  }

  flashLayer.classList.remove("whoZoomFlashRun")
  void flashLayer.offsetWidth
  flashLayer.classList.add("whoZoomFlashRun")

  const img = whoOverlay.querySelector("img")

  if (img) {
    img.classList.remove("whoZoomImageShake")
    void img.offsetWidth
    img.classList.add("whoZoomImageShake")
  }

  setTimeout(() => {
    flashLayer.classList.remove("whoZoomFlashRun")
  }, 800)

  return true
}

/* =========================
   Image Overlay
========================= */

function openWhoImageOverlay() {
  const oldOverlay = document.getElementById("whoImageOverlay")
  if (oldOverlay) oldOverlay.remove()

  if (!currentWhoImage) return

  document.body.classList.add("whoOverlayActive")

  const timerBox = document.getElementById("timer")
  const time = timerBox ? Number(timerBox.innerText || 0) : 0
const dangerClass = time > 0 && time <= 5 ? "timerDanger" : ""

  const overlay = document.createElement("div")
  overlay.id = "whoImageOverlay"
  overlay.className = "whoImageOverlay"
  overlay.innerHTML = `
    <div class="whoImageOverlayTimer ${dangerClass}" id="whoOverlayTimer">${time}</div>

    <div class="whoImageOverlayInner">
      <img src="${escapeDisplayHtml(currentWhoImage)}" class="whoImageOverlayImg" alt="">
    </div>
  `

  overlay.onclick = function () {
    overlay.remove()
    document.body.classList.remove("whoOverlayActive")
  }

  document.body.appendChild(overlay)
}

function toggleWhoImageOverlay() {
  const oldOverlay = document.getElementById("whoImageOverlay")

  if (oldOverlay) {
    oldOverlay.remove()
    document.body.classList.remove("whoOverlayActive")
    return
  }

  openWhoImageOverlay()
}
window.setWhoPoints =
  setWhoPoints

window.chooseWho =
  chooseWho

window.activateWhoDouble =
  activateWhoDouble

window.startWhoCompensation =
  startWhoCompensation

window.whoCorrect =
  whoCorrect

window.whoWrong =
  whoWrong

window.toggleWhoImageOverlay =
  toggleWhoImageOverlay

window.openWhoImageOverlay =
  openWhoImageOverlay

window.resetWhoTimer =
  resetWhoTimer

window.saveWhoState =
  saveWhoState
  window.loadWhoData =
  loadWhoData

window.getWhoDataByNumber =
  getWhoDataByNumber