let presenterFinalRound2Rows = []
let presenterFinalRound2RowsModel = null
let presenterFinalRound2RowsLoaded = false
let presenterFinalRound3Rows = []

const PRESENTER_FINAL_CACHE_TTL = 10 * 60 * 1000

let presenterFinalSelected = {
  round: 1,
  number: null
}

let presenterFinalPreviewCache = {
  1: "",
  2: "",
  3: "",
  4: ""
}

let presenterFinalRound1FocusMode = false
let presenterFinalActionBusy = false

let presenterFinalCompensationPressTimer = null
let presenterFinalCompensationPressActivated = false

let presenterFinalRound2ImageLocalSelection = {
  number: null,
  indexes: [],
  expires: 0
}

/* =========================
   COMMANDS
========================= */

async function sendPresenterFinalCommandSafe(
  action,
  payload = {}
) {
  if (typeof sendCommand !== "function") {
    return false
  }

  const round =
    Number(
      payload.round ||
      getPresenterFinalRound() ||
      presenterFinalRound ||
      1
    )

  try {
    const result = await Promise.race([
      sendCommand(action, {
        ...payload,
        segment: "final",
        round,
        finalRound: round
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
      "PRESENTER FINAL COMMAND ERROR:",
      error
    )

    return false
  }
}

async function runPresenterFinalCommand(
  action,
  payload = {}
) {
  if (presenterFinalActionBusy) {
    return false
  }

  presenterFinalActionBusy = true

  const sent =
    await sendPresenterFinalCommandSafe(
      action,
      payload
    )

  presenterFinalActionBusy = false

  if (!sent) {
    showToast("تعذر تنفيذ الأمر")
    return false
  }

  setTimeout(() => {
    refreshPresenterFinalFromState()
    refreshPresenterEnhancements()
  }, 250)

  return true
}

/* =========================
   FINAL SEGMENT KEYS
========================= */

function normalizePresenterFinalSegmentKey(key) {
  key = String(key || "")

  if (key === "final_round1") return "finalRound1"
  if (key === "final_round2") return "finalRound2"
  if (key === "final_round3") return "finalRound3"
  if (key === "final_round4") return "finalRound4"

  return key
}

function isPresenterFinalSegment(key = presenterSegment) {
  const normalizedKey =
    normalizePresenterFinalSegmentKey(key)

  return (
    normalizedKey === "final" ||
    normalizedKey === "finalRound1" ||
    normalizedKey === "finalRound2" ||
    normalizedKey === "finalRound3" ||
    normalizedKey === "finalRound4"
  )
}

function getPresenterFinalRoundFromSegmentKey(key) {
  const normalizedKey =
    normalizePresenterFinalSegmentKey(key)

  if (normalizedKey === "finalRound1") return 1
  if (normalizedKey === "finalRound2") return 2
  if (normalizedKey === "finalRound3") return 3
  if (normalizedKey === "finalRound4") return 4

  return null
}

function getPresenterFinalSegmentKeyFromRound(round) {
  const r = Number(round || 1)

  if (r === 1) return "finalRound1"
  if (r === 2) return "finalRound2"
  if (r === 3) return "finalRound3"
  if (r === 4) return "finalRound4"

  return "finalRound1"
}

function getPresenterActiveFinalSegmentKey() {
  const possibleKeys = [
    typeof presenterSegment !== "undefined"
      ? presenterSegment
      : "",

    presenterLiveState?.active_segment,
    presenterLiveState?.activeSegment,
    localStorage.getItem("active_segment")
  ].map(normalizePresenterFinalSegmentKey)

  const splitKey =
    possibleKeys.find(key => {
      return (
        key === "finalRound1" ||
        key === "finalRound2" ||
        key === "finalRound3" ||
        key === "finalRound4"
      )
    })

  if (splitKey) return splitKey

  if (possibleKeys.includes("final")) {
    return "final"
  }

  return "final"
}

function getPresenterFinalRoundTitle(
  round = getPresenterFinalRound(),
  mode = "full"
) {
  round = Number(round || 1)

  const titles = {
    1: {
      short: "ٮدوں ٮڡاط",
      full: "الفاصلة - بدون نقاط"
    },
    2: {
      short: "صح صحلي",
      full: "الفاصلة - صح صحلي"
    },
    3: {
      short: "قصة",
      full: "الفاصلة - قصة"
    },
    4: {
      short: "التركيز",
      full: "الفاصلة - التركيز"
    }
  }

  return (
    titles[round]?.[mode] ||
    titles[round]?.full ||
    "الفاصلة"
  )
}

function presenterSafeHtml(value = "") {
  if (typeof escapeDisplayHtml === "function") {
    return escapeDisplayHtml(value)
  }

  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

/* =========================
   FINAL STATE
========================= */

function getPresenterFinalState() {
  return presenterLiveState?.final || {
    round: 1
  }
}

function getPresenterFinalRound() {
  const hasForcedRound =
    typeof presenterFinalForcedRound !== "undefined" &&
    Number(presenterFinalForcedRound) > 0

  const forcedRoundUntil =
    typeof presenterFinalForcedRoundUntil !== "undefined"
      ? Number(presenterFinalForcedRoundUntil || 0)
      : 0

  if (
    hasForcedRound &&
    Date.now() < forcedRoundUntil
  ) {
    return Number(presenterFinalForcedRound)
  }

  const segmentKey =
    getPresenterActiveFinalSegmentKey()

  const roundFromSegment =
    getPresenterFinalRoundFromSegmentKey(segmentKey)

  if (roundFromSegment) {
    return roundFromSegment
  }

  const roundOverride =
    typeof presenterFinalRoundOverride !== "undefined"
      ? Number(presenterFinalRoundOverride || 0)
      : 0

  if (roundOverride) {
    return roundOverride
  }

  const liveRound =
    Number(getPresenterFinalState()?.round || 0)

  if ([1, 2, 3, 4].includes(liveRound)) {
    return liveRound
  }

  const localRound =
    typeof presenterFinalRound !== "undefined"
      ? Number(presenterFinalRound || 1)
      : 1

  return [1, 2, 3, 4].includes(localRound)
    ? localRound
    : 1
}

function getPresenterFinalRoundState(
  round = getPresenterFinalRound()
) {
  const state =
    getPresenterFinalState()

  round = Number(round || 1)

  if (round === 1) return state.round1 || {}
  if (round === 2) return state.round2 || {}
  if (round === 3) return state.round3 || {}
  if (round === 4) return state.round4 || {}

  return {}
}

function getPresenterFinalActiveTeam(
  round = getPresenterFinalRound()
) {
  round = Number(round || 1)

  const state =
    getPresenterFinalRoundState(round)

  if (round === 4) {
    const mediaState =
      getPresenterFinalRound4TeamMediaState()

    return (
      mediaState.currentTeam ||
      state.activeTeam ||
      presenterSelectedTeam ||
      null
    )
  }

  return (
    state.activeTeam ||
    state.currentTeam ||
    presenterSelectedTeam ||
    null
  )
}

function getPresenterFinalSafeCount(
  value,
  fallback = 5
) {
  const count =
    Number(value || fallback)

  if (count === 9) return 9
  if (count === 7) return 7
  if (count === 5) return 5

  return fallback
}

function getPresenterFinalRound1Count() {
  const state =
    getPresenterFinalRoundState(1)

  return getPresenterFinalSafeCount(
    state.cardsCount ||
      window.finalRound1CardsCount ||
      localStorage.getItem(
        "final_round1_cards_count"
      ),
    7
  )
}

function getPresenterFinalRound3StoryCount() {
  const state =
    getPresenterFinalRoundState(3)

  return getPresenterFinalSafeCount(
    state.cardsCount ||
      window.finalRound3Count ||
      localStorage.getItem("final_round3_count"),
    5
  )
}

function getPresenterFinalRound4FocusCount() {
  const state =
    getPresenterFinalRoundState(4)

  const media =
    state.teamMedia || {}

  return getPresenterFinalSafeCount(
    media.count ||
      window.finalRound4Count ||
      localStorage.getItem("final_round4_count"),
    5
  )
}

function getPresenterFinalRound2Type(number) {
  const n =
    Number(number || 0)

  if (n === 1 || n === 4) return "scramble"
  if (n === 2 || n === 5) return "sequence"
  if (n === 3 || n === 6) return "image"

  return ""
}

function getPresenterFinalRound2ImageDbNumber(number) {
  const n =
    Number(number || 0)

  if (n === 3) return 101
  if (n === 6) return 102

  return 0
}

function getPresenterFinalNumbersForRound(round) {
  round = Number(round || 1)

  if (round === 1) {
    return Array.from(
      {
        length: getPresenterFinalRound1Count()
      },
      (_, i) => i + 1
    )
  }

  if (round === 2) {
    return [1, 2, 3, 4, 5, 6]
  }

  if (round === 3) {
    return Array.from(
      {
        length: getPresenterFinalRound3StoryCount()
      },
      (_, i) => i + 1
    )
  }

  if (round === 4) {
    return Array.from(
      {
        length: getPresenterFinalRound4FocusCount()
      },
      (_, i) => i + 1
    )
  }

  return []
}

function getPresenterFinalRound4TeamMediaState() {
  const state =
    getPresenterFinalRoundState(4)

  return state.teamMedia || {
    count: 5,
    usedNumbers: [],
    teamNumbers: {
      A: [],
      B: []
    },
    currentNumber: null,
    currentTeam: null,
    currentMediaType: "",
    currentMedia: "",
    currentQuestion: "",
    currentAnswer: "",
    questionShown: false,
    answerShown: false,
    videoPlayed: false,
    imageHidden: false,
    resultType: ""
  }
}

/* =========================
   COMPENSATION
========================= */

function getPresenterFinalCompensationCount(round) {
  round = Number(round || 0)

  if (round === 1) {
    return getPresenterFinalRound1Count()
  }

  if (round === 3) {
    return getPresenterFinalRound3StoryCount()
  }

  if (round === 4) {
    return getPresenterFinalRound4FocusCount()
  }

  return 0
}

function isPresenterFinalCompensationNumber(
  round,
  number
) {
  const count =
    Number(
      getPresenterFinalCompensationCount(round) || 0
    )

  const n =
    Number(number || 0)

  return (
    [5, 7, 9].includes(count) &&
    n === count
  )
}

function clearPresenterFinalCompensationPress() {
  clearTimeout(presenterFinalCompensationPressTimer)
  presenterFinalCompensationPressTimer = null

  document
    .querySelectorAll(".segmentCompensationPressing")
    .forEach(el => {
      el.classList.remove(
        "segmentCompensationPressing"
      )
    })
}

function startPresenterFinalCompensationPress(
  event,
  round,
  number
) {
  event.preventDefault()
  event.stopPropagation()

  clearPresenterFinalCompensationPress()

  const safeRound =
    Number(round || 0)

  const safeNumber =
    Number(number || 0)

  if (
    !isPresenterFinalCompensationNumber(
      safeRound,
      safeNumber
    )
  ) {
    return false
  }

  presenterFinalCompensationPressActivated = false

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

  presenterFinalCompensationPressTimer =
    setTimeout(() => {
      presenterFinalCompensationPressActivated = true

      button?.classList.remove(
        "segmentCompensationPressing"
      )

      openPresenterFinalNumber(
        safeRound,
        safeNumber,
        {
          compensation: true
        }
      )
    }, 700)

  return false
}

function blockPresenterFinalCompensationNormalClick(
  event
) {
  event.preventDefault()
  event.stopPropagation()

  clearPresenterFinalCompensationPress()

  if (!presenterFinalCompensationPressActivated) {
    showToast("اضغط مطولاً لتفعيل التعويض")
  }

  presenterFinalCompensationPressActivated = false

  return false
}

function buildPresenterFinalNumberButton(
  round,
  number,
  opened,
  current,
  locked
) {
  const isCompensation =
    isPresenterFinalCompensationNumber(
      round,
      number
    )

  const classes = [
    "presenterNumberBtn",
    "presenterFinalNumberCard",
    opened ? "used presenterOpened" : "",
    current ? "active selectedPresenterTeam presenterPendingNumber" : "",
    isCompensation && !opened
      ? "presenterFinalCompensationNumber segmentCompensationNumber"
      : ""
  ].filter(Boolean).join(" ")

  const disabled =
    opened || locked

  const pointerEvents =
    isCompensation && !opened && !locked
      ? `
        onpointerdown="startPresenterFinalCompensationPress(event, ${round}, ${number})"
        onpointerup="clearPresenterFinalCompensationPress()"
        onpointerleave="clearPresenterFinalCompensationPress()"
        onpointercancel="clearPresenterFinalCompensationPress()"
      `
      : ""

  const clickEvent =
    isCompensation && !opened && !locked
      ? `onclick="blockPresenterFinalCompensationNormalClick(event)"`
      : `onclick="openPresenterFinalNumber(${round}, ${number})"`

  return `
    <button
      type="button"
      class="${classes}"
      ${disabled ? "disabled" : ""}
      ${pointerEvents}
      ${clickEvent}
    >
      <span>${number}</span>
    </button>
  `
}

window.startPresenterFinalCompensationPress =
  startPresenterFinalCompensationPress

window.clearPresenterFinalCompensationPress =
  clearPresenterFinalCompensationPress

window.blockPresenterFinalCompensationNormalClick =
  blockPresenterFinalCompensationNormalClick

/* =========================
   CACHE LOADERS
========================= */

function clearPresenterFinalPreview(
  round = presenterFinalRound
) {
  round = Number(round || 1)

  presenterFinalPreviewCache[round] = ""
  presenterFinalSelected = {
    round,
    number: null
  }

  const previewBox =
    document.getElementById("presenterFinalPreview")

  if (previewBox) {
    previewBox.innerHTML = "اختر رقمًا"
  }
}

async function loadPresenterFinalRound1Item(
  number,
  options = {}
) {
  const model =
    Number(presenterModel || 0)

  const safeNumber =
    Number(number || 0)

  if (!model || !safeNumber) return null

  const result =
    await loadPresenterCachedResource({
      cacheKey: getPresenterResourceCacheKey(
        "final_round1_item",
        [model, safeNumber]
      ),
      ttl: PRESENTER_FINAL_CACHE_TTL,
      forceRefresh: options.forceRefresh === true,
      staleWhileRevalidate:
        options.staleWhileRevalidate !== false,
      fetcher: async () => {
        const { data, error } = await db
          .from("final_round1_items")
          .select("*")
          .eq("model", model)
          .eq("number", safeNumber)
          .maybeSingle()

        return {
          data,
          error
        }
      }
    })

  return result.data || null
}

async function loadPresenterFinalRound2Rows(
  options = {}
) {
  const model =
    Number(presenterModel || 0)

  if (
    presenterFinalRound2RowsModel === model &&
    presenterFinalRound2RowsLoaded &&
    options.forceRefresh !== true
  ) {
    return presenterFinalRound2Rows
  }

  const result =
    await loadPresenterCachedResource({
      cacheKey: getPresenterResourceCacheKey(
        "final_round2_rows",
        [model]
      ),
      ttl: PRESENTER_FINAL_CACHE_TTL,
      forceRefresh: options.forceRefresh === true,
      staleWhileRevalidate:
        options.staleWhileRevalidate !== false,
      fetcher: async () => {
        const { data, error } = await db
          .from("final_round2_items")
          .select("*")
          .eq("model", model)
          .order("number", {
            ascending: true
          })
          .order("item_order", {
            ascending: true
          })

        return {
          data: Array.isArray(data) ? data : [],
          error
        }
      }
    })

  if (result.error && !result.data) {
    console.log(
      "LOAD PRESENTER FINAL ROUND 2 ERROR:",
      result.error
    )
  }

  presenterFinalRound2Rows =
    Array.isArray(result.data)
      ? result.data
      : []

  presenterFinalRound2RowsModel = model

  presenterFinalRound2RowsLoaded =
    Array.isArray(result.data)

  return presenterFinalRound2Rows
}

async function loadPresenterFinalRound3RowsByNumber(
  number,
  options = {}
) {
  const model =
    Number(presenterModel || 0)

  const safeNumber =
    Number(number || 0)

  if (!model || !safeNumber) return []

  const result =
    await loadPresenterCachedResource({
      cacheKey: getPresenterResourceCacheKey(
        "final_round3_rows",
        [model, safeNumber]
      ),
      ttl: PRESENTER_FINAL_CACHE_TTL,
      forceRefresh: options.forceRefresh === true,
      staleWhileRevalidate:
        options.staleWhileRevalidate !== false,
      fetcher: async () => {
        const { data, error } = await db
          .from("final_round3_items")
          .select("*")
          .eq("model", model)
          .eq("number", safeNumber)
          .order("image_order", {
            ascending: true
          })

        return {
          data: Array.isArray(data) ? data : [],
          error
        }
      }
    })

  return Array.isArray(result.data)
    ? result.data
    : []
}

async function loadPresenterFinalRound1RowsByRange(
  minNumber,
  maxNumber,
  options = {}
) {
  const model =
    Number(presenterModel || 0)

  const min =
    Number(minNumber || 0)

  const max =
    Number(maxNumber || 0)

  if (!model || !min || !max) return []

  const result =
    await loadPresenterCachedResource({
      cacheKey: getPresenterResourceCacheKey(
        "final_round1_range",
        [model, min, max]
      ),
      ttl: PRESENTER_FINAL_CACHE_TTL,
      forceRefresh: options.forceRefresh === true,
      staleWhileRevalidate:
        options.staleWhileRevalidate !== false,
      fetcher: async () => {
        const { data, error } = await db
          .from("final_round1_items")
          .select("*")
          .eq("model", model)
          .gte("number", min)
          .lte("number", max)
          .order("number", {
            ascending: true
          })

        return {
          data: Array.isArray(data) ? data : [],
          error
        }
      }
    })

  return Array.isArray(result.data)
    ? result.data
    : []
}

async function loadPresenterFinalRound3RowsByNumbers(
  numbers = [],
  options = {}
) {
  const model =
    Number(presenterModel || 0)

  const safeNumbers =
    numbers
      .map(Number)
      .filter(Boolean)

  if (!model || !safeNumbers.length) return []

  const result =
    await loadPresenterCachedResource({
      cacheKey: getPresenterResourceCacheKey(
        "final_round3_numbers",
        [model, ...safeNumbers]
      ),
      ttl: PRESENTER_FINAL_CACHE_TTL,
      forceRefresh: options.forceRefresh === true,
      staleWhileRevalidate:
        options.staleWhileRevalidate !== false,
      fetcher: async () => {
        const { data, error } = await db
          .from("final_round3_items")
          .select("*")
          .eq("model", model)
          .in("number", safeNumbers)
          .order("number", {
            ascending: true
          })
          .order("image_order", {
            ascending: true
          })

        return {
          data: Array.isArray(data) ? data : [],
          error
        }
      }
    })

  return Array.isArray(result.data)
    ? result.data
    : []
}

/* =========================
   FINAL HELPERS
========================= */

async function setPresenterFinalRound(round) {
  const requestedRound =
    Number(round || 1)

  if (![1, 2, 3, 4].includes(requestedRound)) {
    return
  }

  const activeSegmentKey =
    getPresenterActiveFinalSegmentKey()

  const fixedRound =
    getPresenterFinalRoundFromSegmentKey(
      activeSegmentKey
    )

  presenterFinalRound =
    fixedRound || requestedRound

  presenterFinalSelected = {
    round: presenterFinalRound,
    number: null
  }

  setPresenterFinalRound1FocusMode(false)

  const title =
    document.getElementById(
      "presenterSegmentTitle"
    )

  if (title) {
    title.innerText =
      getPresenterFinalRoundTitle(
        presenterFinalRound,
        "short"
      )
  }

  if (activeSegmentKey === "final") {
    await sendPresenterFinalCommandSafe(
      "setRound",
      {
        round: presenterFinalRound
      }
    )
  }

  await renderPresenterFinalRoundContent()
  refreshPresenterEnhancements()
}

function setPresenterFinalRound1FocusMode(active) {
  presenterFinalRound1FocusMode = !!active

  document.body.classList.toggle(
    "presenterFinalRound1FocusMode",
    presenterFinalRound1FocusMode
  )
}

function updatePresenterFinalRound1FocusFromState() {
  if (!isPresenterFinalSegment()) {
    setPresenterFinalRound1FocusMode(false)
    return
  }

  const round =
    getPresenterFinalRound()

  if (round !== 1) {
    setPresenterFinalRound1FocusMode(false)
    return
  }

  const state =
    getPresenterFinalRoundState(1)

  const currentNumber =
    Number(state.currentNumber || 0) ||
    (
      presenterFinalSelected?.round === 1
        ? Number(presenterFinalSelected.number || 0)
        : 0
    )

  const pendingScore =
    !!state.pendingScore

  setPresenterFinalRound1FocusMode(
    !!currentNumber || pendingScore
  )
}

function refreshPresenterEnhancements() {
  updatePresenterFinalRound1FocusFromState()
}

async function presenterPlayCurrentFinalVideo() {
  const sent =
    await sendPresenterFinalCommandSafe(
      "playCurrentFinalVideo",
      {
        round: getPresenterFinalRound()
      }
    )

  if (!sent) {
    showToast("تعذر تشغيل الفيديو")
    return
  }

  showToast("تم تشغيل الفيديو")
}

async function presenterRestartCurrentFinalVideo() {
  const sent =
    await sendPresenterFinalCommandSafe(
      "restartCurrentFinalVideo",
      {
        round: getPresenterFinalRound()
      }
    )

  if (!sent) {
    showToast("تعذر إعادة تشغيل الفيديو")
    return
  }

  showToast("تمت إعادة تشغيل الفيديو")
}

async function presenterRestartCurrentFinalImage() {
  const sent =
    await sendPresenterFinalCommandSafe(
      "restartCurrentFinalImage",
      {
        round: getPresenterFinalRound()
      }
    )

  if (!sent) {
    showToast("تعذر إعادة الصورة")
    return
  }

  showToast("تمت إعادة الصورة")
}

function resetPresenterFinalLocalChoice(
  round = getPresenterFinalRound()
) {
  round = Number(round || 1)

  presenterSelectedTeam = null

  presenterFinalSelected = {
    round,
    number: null
  }

  presenterFinalPreviewCache[round] = ""

  updatePresenterTeamButtonsOnly(null)

  const previewBox =
    document.getElementById(
      "presenterFinalPreview"
    )

  if (previewBox) {
    previewBox.innerHTML = "اختر رقمًا"
  }
}

async function presenterFinalCorrect() {
  const round =
    getPresenterFinalRound()

  const activeTeam =
    getPresenterFinalActiveTeam(round)

  if (
    (round === 1 || round === 3) &&
    !activeTeam
  ) {
    showToast("اختر الفريق أولاً")
    return
  }

  sendPresenterFinalCommandSafe(
    "stopCurrentFinalVideo",
    {
      round
    }
  )

  const sent =
    await sendPresenterFinalCommandSafe(
      "correct",
      {
        round,
        team: activeTeam || null
      }
    )

  if (!sent) return

  const segmentKey =
    getPresenterActiveFinalSegmentKey()

  const finishDelay =
    round === 1
      ? 8300
      : round === 3
        ? 12300
        : round === 4
          ? 5300
          : 900

  markPresenterLocalSync(
    segmentKey,
    finishDelay
  )

  setTimeout(() => {
    resetPresenterFinalLocalChoice(round)
    refreshPresenterFinalFromState()
    refreshPresenterEnhancements()
  }, finishDelay)
}

async function presenterFinalWrong() {
  const round =
    getPresenterFinalRound()

  const activeTeam =
    getPresenterFinalActiveTeam(round)

  const sent =
    await sendPresenterFinalCommandSafe(
      "wrong",
      {
        round,
        team: activeTeam || null
      }
    )

  if (!sent) return

  if (round === 1 || round === 3) {
    markPresenterLocalSync(
      getPresenterActiveFinalSegmentKey(),
      900
    )

    setTimeout(() => {
      refreshPresenterFinalFromState()
      refreshPresenterEnhancements()
    }, 300)

    return
  }

  markPresenterLocalSync(
    getPresenterActiveFinalSegmentKey(),
    6000
  )

  setTimeout(() => {
    refreshPresenterFinalFromState()
    refreshPresenterEnhancements()
  }, 300)
}

/* =========================
   RENDER FINAL MAIN
========================= */

async function renderFinal() {
  const panel =
    document.getElementById("presenterPanel")

  if (!panel) return

  const activeSegmentKey =
    getPresenterActiveFinalSegmentKey()

  const roundFromSegment =
    getPresenterFinalRoundFromSegmentKey(
      activeSegmentKey
    )

  presenterFinalRound =
    roundFromSegment ||
    Number(getPresenterFinalRound() || 1)

  presenterFinalSelected = {
    round: presenterFinalRound,
    number: null
  }

  const title =
    document.getElementById(
      "presenterSegmentTitle"
    )

  if (title) {
    title.innerText =
      getPresenterFinalRoundTitle(
        presenterFinalRound,
        "short"
      )
  }

  panel.dataset.segment = "final"

  panel.innerHTML = `
    <section
      class="presenterFinalScreen"
      data-presenter-segment="final"
      data-final-round="${presenterFinalRound}"
      aria-label="لوحة تحكم الفاصلة"
    >

      <main class="presenterFinalMain">

        <section
          class="presenterCard presenterFinalContentCard presenterFinalPreviewCard"
          aria-label="المحتوى"
        >

          <div
            id="presenterFinalPreview"
            class="presenterFinalPreviewBox"
          >
            ${presenterFinalPreviewCache[presenterFinalRound] || "اختر رقمًا"}
          </div>

        </section>

        <section
          class="presenterCard presenterFinalControlCard presenterFinalNumbersCard"
          aria-label="الأرقام والتحكم"
        >

          <div
            id="presenterFinalNumbers"
            class="presenterFinalNumbersGrid"
          ></div>

          <footer
            id="presenterFinalControls"
            class="presenterFinalControlsArea"
            aria-label="أزرار التحكم"
          ></footer>

        </section>

      </main>

    </section>
  `

  await renderPresenterFinalRoundContent()
  refreshPresenterEnhancements()
}

/* =========================
   ROUND CONTENT
========================= */

async function presenterRecordFinalRound2Score(type) {
  let sent = false

  if (type === "scramble") {
    sent =
      await sendPresenterFinalCommandSafe(
        "recordScrambleScore",
        {
          round: 2
        }
      )
  }

  if (type === "sequence") {
    sent =
      await sendPresenterFinalCommandSafe(
        "recordSequenceScore",
        {
          round: 2
        }
      )
  }

  if (type === "image") {
    sent =
      await sendPresenterFinalCommandSafe(
        "recordImageScore",
        {
          round: 2
        }
      )
  }

  if (!sent) {
    showToast("تعذر تسجيل النتيجة")
    return
  }

  resetPresenterFinalLocalChoice(2)

  markPresenterLocalSync(
    getPresenterActiveFinalSegmentKey(),
    900
  )

  setTimeout(() => {
    renderPresenterFinalRoundContent()
  }, 250)
}

async function hidePresenterFinalRound2SequenceWord(index) {
  const sent =
    await sendPresenterFinalCommandSafe(
      "hideRound2SequenceWord",
      {
        round: 2,
        index: Number(index || 0)
      }
    )

  if (!sent) {
    showToast("تعذر إخفاء الكلمة")
  }
}

async function renderPresenterFinalRoundContent() {
  const round =
    Number(
      getPresenterFinalRound() ||
      presenterFinalRound ||
      1
    )

  presenterFinalRound = round

  const numbersBox =
    document.getElementById("presenterFinalNumbers")

  const controlsBox =
    document.getElementById("presenterFinalControls")

  const previewBox =
    document.getElementById("presenterFinalPreview")

  if (!numbersBox || !controlsBox || !previewBox) {
    return
  }

  const state =
    getPresenterFinalRoundState(round)

  const round4MediaState =
    getPresenterFinalRound4TeamMediaState()

  const nums =
    getPresenterFinalNumbersForRound(round)

  numbersBox.className =
    `presenterFinalNumbersGrid count-${nums.length} finalNumbersCount${nums.length}`

  const openedNumbers =
    round === 4
      ? (
          round4MediaState.usedNumbers ||
          state.opened ||
          []
        )
      : (state.opened || [])

  const selectedNumber =
    Number(
      round === 4
        ? round4MediaState.currentNumber ||
          state.currentNumber ||
          0
        : state.currentNumber || 0
    ) ||
    (
      presenterFinalSelected?.round === round
        ? Number(presenterFinalSelected.number || 0)
        : 0
    )

  const pendingScore =
    round === 4
      ? !!round4MediaState.currentNumber
      : !!state.pendingScore

  numbersBox.innerHTML =
    nums.map(n => {
      const opened =
        openedNumbers
          .map(Number)
          .includes(Number(n))

      const current =
        selectedNumber === n

      return buildPresenterFinalNumberButton(
        round,
        n,
        opened,
        current,
        pendingScore
      )
    }).join("")

  if (selectedNumber) {
    if (round === 1) {
      await renderPresenterFinalRound1Preview()
    }

    if (round === 2) {
      await renderPresenterFinalRound2Preview()
    }

    if (round === 3) {
      await renderPresenterFinalRound3Preview()
    }

    if (round === 4) {
      await renderPresenterFinalRound4Preview()
    }
  } else {
    previewBox.innerHTML =
      presenterFinalPreviewCache[round] ||
      "اختر رقمًا"
  }

  controlsBox.dataset.round = String(round)
  controlsBox.className =
    `presenterFinalControlsArea presenterFinalActions finalControlsRound${round}`

  if (round === 1) {
    controlsBox.innerHTML = `
      <div class="presenterFinalRound1CommandGrid">

        <button
          type="button"
          class="presenterBtn gray"
          onclick="runPresenterFinalCommand('double')"
        >
          دوببلا
        </button>

        <button
          type="button"
          class="presenterBtn blue"
          onclick="runPresenterFinalCommand('zoomImage')"
        >
          تكبير
        </button>

        <button
          type="button"
          class="presenterBtn green"
          onclick="presenterFinalCorrect()"
        >
          صح
        </button>

        <button
          type="button"
          class="presenterBtn red"
          onclick="presenterFinalWrong()"
        >
          خطأ
        </button>

        <button
          type="button"
          class="presenterBtn gray"
          onclick="runPresenterFinalCommand('undo')"
        >
          تراجع
        </button>

      </div>
    `

    refreshPresenterFinalControlsOnly(1)
    refreshPresenterEnhancements()
    return
  }

  if (round === 2) {
    const currentNumber =
      Number(
        state.currentNumber ||
        (
          presenterFinalSelected?.round === 2
            ? presenterFinalSelected.number
            : 0
        )
      )

    const type =
      getPresenterFinalRound2Type(currentNumber)

    const isScramble =
      type === "scramble"

    const isSequence =
      type === "sequence"

    const isImage =
      type === "image"

    controlsBox.innerHTML = `
      <div class="presenterFinalRound2CommandGrid">

        <button
          type="button"
          class="presenterBtn gray"
          onclick="runPresenterFinalCommand('double', { round: 2 })"
        >
          دوببلا
        </button>

        <button
          type="button"
          class="presenterBtn"
          onclick="runPresenterFinalCommand('decreaseCountdown', { round: 2 })"
          ${isSequence ? "" : "disabled"}
        >
          ${isSequence ? `العداد ${state.countdown ?? 15}` : "العداد"}
        </button>

        <button
          type="button"
          class="presenterBtn blue"
          onclick="runPresenterFinalCommand('showNextImage', { round: 2 })"
          ${isImage ? "" : "disabled"}
        >
          الصور
        </button>

        <button
          type="button"
          class="presenterBtn green"
          onclick="presenterRecordFinalRound2Score('scramble')"
          ${isScramble ? "" : "disabled"}
        >
          المبعثرة
        </button>

        <button
          type="button"
          class="presenterBtn green"
          onclick="presenterRecordFinalRound2Score('sequence')"
          ${isSequence ? "" : "disabled"}
        >
          الترتيب
        </button>

        <button
          type="button"
          class="presenterBtn green"
          onclick="presenterRecordFinalRound2Score('image')"
          ${isImage ? "" : "disabled"}
        >
          الصورة
        </button>

        <button
          type="button"
          class="presenterBtn gray"
          onclick="runPresenterFinalCommand('undo', { round: 2 })"
        >
          تراجع
        </button>

      </div>
    `

    refreshPresenterFinalControlsOnly(2)
    refreshPresenterEnhancements()
    return
  }

  if (round === 3) {
    const currentNumber =
      Number(state.currentNumber || 0)

    const shownPart =
      Number(state.shownPart || 0)

    const parts =
      Array.isArray(state.currentParts)
        ? state.currentParts
        : []

    const maxParts =
      parts.length || 3

    const canShowPart =
      !!currentNumber &&
      shownPart < maxParts &&
      !state.answerShown

    const nextPartText =
      shownPart === 0
        ? "الأول"
        : shownPart === 1
          ? "الثاني"
          : shownPart === 2
            ? "الثالث"
            : "اكتمل"

    controlsBox.innerHTML = `
      <div class="presenterFinalRound3CommandGrid">

        <button
          type="button"
          class="presenterBtn gray"
          onclick="runPresenterFinalCommand('double', { round: 3 })"
        >
          دوببلا
        </button>

        <button
          type="button"
          class="presenterBtn blue"
          onclick="runPresenterFinalCommand('showStoryPart', { round: 3 })"
          ${canShowPart ? "" : "disabled"}
        >
          ${nextPartText}
        </button>

        <button
          type="button"
          class="presenterBtn green"
          onclick="presenterFinalCorrect()"
          ${currentNumber && shownPart > 0 ? "" : "disabled"}
        >
          صح
        </button>

        <button
          type="button"
          class="presenterBtn red"
          onclick="presenterFinalWrong()"
          ${currentNumber ? "" : "disabled"}
        >
          خطأ
        </button>

        <button
          type="button"
          class="presenterBtn gray"
          onclick="runPresenterFinalCommand('undo', { round: 3 })"
        >
          تراجع
        </button>

      </div>
    `

    refreshPresenterFinalControlsOnly(3)
    refreshPresenterEnhancements()
    return
  }

  if (round === 4) {
    const hasCurrent =
      !!round4MediaState.currentNumber

    const isVideo =
      round4MediaState.currentMediaType === "video"

    const isImage =
      round4MediaState.currentMediaType === "image"

    const questionShown =
      !!round4MediaState.questionShown

    const answerShown =
      !!round4MediaState.answerShown

    const videoPlayed =
      !!round4MediaState.videoPlayed

    const imageHidden =
      !!round4MediaState.imageHidden

    controlsBox.innerHTML = `
      <div class="presenterFinalRound4CommandGrid">

        <button
          type="button"
          class="presenterBtn gray"
          onclick="runPresenterFinalCommand('double', { round: 4 })"
        >
          دوببلا
        </button>

        <button
          type="button"
          class="presenterBtn blue"
          onclick="runPresenterFinalCommand('showQuestion', { round: 4 })"
          ${
            hasCurrent &&
            round4MediaState.currentQuestion &&
            !questionShown &&
            !answerShown
              ? ""
              : "disabled"
          }
        >
          السؤال
        </button>

        <button
          type="button"
          class="presenterBtn"
          onclick="presenterPlayCurrentFinalVideo()"
          ${
            hasCurrent &&
            isVideo &&
            !questionShown &&
            !answerShown &&
            !videoPlayed
              ? ""
              : "disabled"
          }
        >
          تشغيل
        </button>

        <button
          type="button"
          class="presenterBtn blue"
          onclick="${isImage ? "presenterRestartCurrentFinalImage()" : "presenterRestartCurrentFinalVideo()"}"
          ${
            hasCurrent &&
            !questionShown &&
            !answerShown &&
            (
              isVideo ||
              (isImage && imageHidden)
            )
              ? ""
              : "disabled"
          }
        >
          إعادة
        </button>

        <button
          type="button"
          class="presenterBtn green"
          onclick="presenterFinalCorrect()"
          ${hasCurrent && !answerShown ? "" : "disabled"}
        >
          صح
        </button>

        <button
          type="button"
          class="presenterBtn red"
          onclick="presenterFinalWrong()"
          ${hasCurrent && !answerShown ? "" : "disabled"}
        >
          خطأ
        </button>

        <button
          type="button"
          class="presenterBtn gray"
          onclick="runPresenterFinalCommand('undo', { round: 4 })"
        >
          تراجع
        </button>

      </div>
    `

    refreshPresenterFinalControlsOnly(4)
    refreshPresenterEnhancements()
  }
}

/* =========================
   REFRESH FINAL
========================= */

async function refreshPresenterFinalFromState() {
  if (!isPresenterFinalSegment()) return

  const activeSegmentKey =
    getPresenterActiveFinalSegmentKey()

  const roundFromSegment =
    getPresenterFinalRoundFromSegmentKey(
      activeSegmentKey
    )

  const round =
    roundFromSegment ||
    Number(
      getPresenterFinalRound() ||
      presenterFinalRound ||
      1
    )

  presenterFinalRound = round

  const title =
    document.getElementById("presenterSegmentTitle")

  if (title) {
    title.innerText =
      getPresenterFinalRoundTitle(
        round,
        "short"
      )
  }

  const activeTeam =
    getPresenterFinalActiveTeam(round)

  updatePresenterTeamButtonsOnly(activeTeam)

  const controlsBox =
    document.getElementById("presenterFinalControls")

  const currentControlsRound =
    Number(controlsBox?.dataset.round || 0)

  if (currentControlsRound !== round) {
    presenterFinalSelected = {
      round,
      number: null
    }

    await renderPresenterFinalRoundContent()
    refreshPresenterEnhancements()
    return
  }

  await refreshPresenterFinalNumbersOnly(round)
  await refreshPresenterFinalPreviewOnly(round)

  refreshPresenterFinalControlsOnly(round)
  refreshPresenterEnhancements()
}

async function refreshPresenterFinalNumbersOnly(round) {
  round =
    Number(
      getPresenterFinalRound() ||
      round ||
      1
    )

  presenterFinalRound = round

  const numbersBox =
    document.getElementById("presenterFinalNumbers")

  if (!numbersBox) return

  const state =
    getPresenterFinalRoundState(round)

  const round4MediaState =
    getPresenterFinalRound4TeamMediaState()

  const nums =
    getPresenterFinalNumbersForRound(round)

  numbersBox.className =
    `presenterGrid presenterFinalNumbersGrid finalNumbersCount${nums.length}`

  const openedNumbers =
    round === 4
      ? (
          round4MediaState.usedNumbers ||
          state.opened ||
          []
        )
      : (state.opened || [])

  const selectedNumber =
    Number(
      round === 4
        ? round4MediaState.currentNumber ||
          state.currentNumber ||
          0
        : state.currentNumber || 0
    ) ||
    (
      presenterFinalSelected?.round === round
        ? Number(presenterFinalSelected.number || 0)
        : 0
    )

  const pendingScore =
    round === 4
      ? !!round4MediaState.currentNumber
      : !!state.pendingScore

  numbersBox.innerHTML =
    nums.map(n => {
      const opened =
        openedNumbers
          .map(Number)
          .includes(Number(n))

      const current =
        selectedNumber === n

      return buildPresenterFinalNumberButton(
        round,
        n,
        opened,
        current,
        pendingScore
      )
    }).join("")
}

async function refreshPresenterFinalPreviewOnly(round) {
  round =
    Number(
      getPresenterFinalRound() ||
      round ||
      1
    )

  presenterFinalRound = round

  const previewBox =
    document.getElementById("presenterFinalPreview")

  if (!previewBox) return

  const state =
    getPresenterFinalRoundState(round)

  const round4MediaState =
    getPresenterFinalRound4TeamMediaState()

  const currentNumber =
    Number(
      round === 4
        ? round4MediaState.currentNumber ||
          state.currentNumber ||
          0
        : state.currentNumber || 0
    ) ||
    (
      presenterFinalSelected?.round === round
        ? Number(presenterFinalSelected.number || 0)
        : 0
    )

  if (!currentNumber) {
    presenterFinalPreviewCache[round] = ""

    presenterFinalSelected = {
      round,
      number: null
    }

    previewBox.innerHTML = "اختر رقمًا"
    return
  }

  if (round === 1) {
    await renderPresenterFinalRound1Preview()
  }

  if (round === 2) {
    await renderPresenterFinalRound2Preview()
  }

  if (round === 3) {
    await renderPresenterFinalRound3Preview()
  }

  if (round === 4) {
    await renderPresenterFinalRound4Preview()
  }
}

function refreshPresenterFinalControlsOnly(round) {
  round =
    Number(
      getPresenterFinalRound() ||
      round ||
      1
    )

  presenterFinalRound = round

  const controlsBox =
    document.getElementById("presenterFinalControls")

  if (!controlsBox) return

  const state =
    getPresenterFinalRoundState(round)

  const allButtons =
    [...controlsBox.querySelectorAll(".presenterBtn")]

  if (round === 1) {
    const pendingScore =
      !!state.pendingScore

    allButtons.forEach(btn => {
      const onclick =
        btn.getAttribute("onclick") || ""

      if (onclick.includes("presenterFinalCorrect")) {
        btn.disabled = !pendingScore
      }

      if (onclick.includes("presenterFinalWrong")) {
        btn.disabled = !pendingScore
      }
    })

    return
  }

  if (round === 2) {
    const currentNumber =
      Number(state.currentNumber || 0)

    const type =
      getPresenterFinalRound2Type(currentNumber)

    allButtons.forEach(btn => {
      const onclick =
        btn.getAttribute("onclick") || ""

      if (onclick.includes("decreaseCountdown")) {
        btn.disabled =
          type !== "sequence"

        btn.innerText =
          type === "sequence"
            ? `العداد ${state.countdown ?? 15}`
            : "العداد"
      }

      if (onclick.includes("showNextImage")) {
        btn.disabled =
          type !== "image"
      }

      if (
        onclick.includes("recordScrambleScore") ||
        onclick.includes("presenterRecordFinalRound2Score('scramble')")
      ) {
        btn.disabled =
          type !== "scramble"
      }

      if (
        onclick.includes("recordSequenceScore") ||
        onclick.includes("presenterRecordFinalRound2Score('sequence')")
      ) {
        btn.disabled =
          type !== "sequence"
      }

      if (
        onclick.includes("recordImageScore") ||
        onclick.includes("presenterRecordFinalRound2Score('image')")
      ) {
        btn.disabled =
          type !== "image"
      }
    })

    return
  }

  if (round === 3) {
    const currentNumber =
      Number(state.currentNumber || 0)

    const shownPart =
      Number(state.shownPart || 0)

    const parts =
      Array.isArray(state.currentParts)
        ? state.currentParts
        : []

    const answerShown =
      !!state.answerShown

    allButtons.forEach(btn => {
      const onclick =
        btn.getAttribute("onclick") || ""

      if (onclick.includes("showStoryPart")) {
        btn.disabled = !(
          currentNumber &&
          shownPart < parts.length &&
          !answerShown
        )

        btn.innerText =
          shownPart === 0
            ? "الجزء الأول"
            : shownPart === 1
              ? "الجزء الثاني"
              : shownPart === 2
                ? "الجزء الثالث"
                : "اكتملت"
      }

      if (onclick.includes("presenterFinalCorrect")) {
        btn.disabled = !(
          currentNumber &&
          shownPart > 0 &&
          !answerShown
        )
      }

      if (onclick.includes("presenterFinalWrong")) {
        btn.disabled = !(
          currentNumber &&
          !answerShown
        )
      }
    })

    return
  }

  if (round === 4) {
    const mediaState =
      getPresenterFinalRound4TeamMediaState()

    const hasCurrent =
      !!mediaState.currentNumber

    const isVideo =
      mediaState.currentMediaType === "video"

    const isImage =
      mediaState.currentMediaType === "image"

    const questionShown =
      !!mediaState.questionShown

    const answerShown =
      !!mediaState.answerShown

    const videoPlayed =
      !!mediaState.videoPlayed

    const imageHidden =
      !!mediaState.imageHidden

    allButtons.forEach(btn => {
      const onclick =
        btn.getAttribute("onclick") || ""

      if (onclick.includes("showQuestion")) {
        btn.disabled = !(
          hasCurrent &&
          mediaState.currentQuestion &&
          !questionShown &&
          !answerShown
        )
      }

      if (onclick.includes("presenterPlayCurrentFinalVideo")) {
        btn.disabled = !(
          hasCurrent &&
          isVideo &&
          !questionShown &&
          !answerShown &&
          !videoPlayed
        )
      }

      if (
        onclick.includes("presenterRestartCurrentFinalVideo") ||
        onclick.includes("presenterRestartCurrentFinalImage")
      ) {
        btn.disabled = !(
          hasCurrent &&
          !questionShown &&
          !answerShown &&
          (
            isVideo ||
            (isImage && imageHidden)
          )
        )
      }

      if (onclick.includes("presenterFinalCorrect")) {
        btn.disabled =
          !hasCurrent || answerShown
      }

      if (onclick.includes("presenterFinalWrong")) {
        btn.disabled =
          !hasCurrent || answerShown
      }
    })
  }
}

/* =========================
   OPEN FINAL NUMBER
========================= */

async function openPresenterFinalNumber(
  round,
  number,
  options = {}
) {
  round = Number(round || 1)
  number = Number(number || 0)

  const state =
    getPresenterFinalRoundState(round)

  const round4MediaState =
    getPresenterFinalRound4TeamMediaState()

  const compensationMode =
    options.compensation === true

  const isCompensation =
    isPresenterFinalCompensationNumber(
      round,
      number
    )

  if (isCompensation && !compensationMode) {
    showToast("اضغط مطولاً لتفعيل التعويض")
    return
  }

  const openedNumbers =
    round === 4
      ? (
          round4MediaState.usedNumbers ||
          state.opened ||
          []
        )
      : (state.opened || [])

  const hasCurrent =
    round === 4
      ? !!round4MediaState.currentNumber
      : !!state.pendingScore

  if (hasCurrent) {
    showToast("أنهِ الرقم الحالي أولاً")
    return
  }

  if (
    openedNumbers
      .map(Number)
      .includes(number)
  ) {
    showToast("الرقم مستخدم")
    return
  }

  const activeTeam =
    getPresenterFinalActiveTeam(round)

  if (
    round === 2 &&
    !activeTeam
  ) {
    showToast("اختر الفريق أولاً")
    return
  }

  if (
    round === 4 &&
    !isCompensation &&
    !activeTeam
  ) {
    showToast("اختر الفريق أولاً")
    return
  }

  presenterFinalSelected = {
    round,
    number
  }

  if (round === 1) {
    setPresenterFinalRound1FocusMode(true)
    await renderPresenterFinalRound1Preview()
  }

  if (round === 2) {
    await renderPresenterFinalRound2Preview()
  }

  if (round === 3) {
    await renderPresenterFinalRound3Preview()
  }

  if (round === 4) {
    await renderPresenterFinalRound4Preview()
  }

  const sent =
    await sendPresenterFinalCommandSafe(
      "openNumber",
      {
        round,
        number,
        team: activeTeam,
        compensation: compensationMode,
        segmentKey:
          getPresenterActiveFinalSegmentKey()
      }
    )

  if (!sent) {
    presenterFinalSelected = {
      round,
      number: null
    }

    presenterFinalPreviewCache[round] = ""

    showToast("تعذر فتح الرقم")

    await refreshPresenterFinalNumbersOnly(round)
    await refreshPresenterFinalPreviewOnly(round)

    return
  }

  if (round === 1) {
    setPresenterFinalRound1FocusMode(true)

    document.body.classList.add(
      "presenterFinalRound1FocusMode"
    )
  }
}

/* =========================
   ROUND 1 PREVIEW
========================= */

async function renderPresenterFinalRound1Preview() {
  const previewBox =
    document.getElementById("presenterFinalPreview")

  if (!previewBox) return

  const state =
    getPresenterFinalRoundState(1)

  const current =
    Number(
      state.currentNumber ||
      (
        presenterFinalSelected?.round === 1
          ? presenterFinalSelected.number
          : 0
      )
    )

  if (!current) {
    presenterFinalPreviewCache[1] = ""
    previewBox.innerHTML = "—"
    return
  }

  const data =
    await loadPresenterFinalRound1Item(current)

  if (!data) {
    presenterFinalPreviewCache[1] = `
      <div class="presenterFinalRound1AnswerView">
        <div class="presenterFinalRound1AnswerText">
          لا توجد بيانات
        </div>
      </div>
    `

    previewBox.innerHTML =
      presenterFinalPreviewCache[1]

    return
  }

  const answerText =
    data.answer || "لا توجد إجابة"

  const noteText =
    data.note || ""

  presenterFinalPreviewCache[1] = `
    <div class="presenterFinalRound1AnswerView">

      <div class="presenterFinalRound1AnswerText">
        ${presenterSafeHtml(answerText)}
      </div>

      ${
        noteText
          ? `
            <div class="presenterFinalRound1Note">
              ${presenterSafeHtml(noteText)}
            </div>
          `
          : ""
      }

    </div>
  `

  previewBox.innerHTML =
    presenterFinalPreviewCache[1]
}

/* =========================
   ROUND 2 PREVIEW
========================= */

function togglePresenterFinalRound2Correct(index) {
  const state =
    getPresenterFinalRoundState(2)

  const currentNumber =
    Number(
      state.currentNumber ||
      (
        presenterFinalSelected?.round === 2
          ? presenterFinalSelected.number
          : 0
      )
    )

  if (!currentNumber) return

  const oldSelected =
    Array.isArray(state.selectedCorrectIndexes)
      ? state.selectedCorrectIndexes.map(Number)
      : []

  const i =
    Number(index)

  const nextSelected =
    oldSelected.includes(i)
      ? oldSelected.filter(x => Number(x) !== i)
      : [...oldSelected, i]

  presenterLiveState = {
    ...(presenterLiveState || {}),
    final: {
      ...(presenterLiveState?.final || {}),
      round: 2,
      round2: {
        ...(presenterLiveState?.final?.round2 || {}),
        currentNumber,
        selectedCorrectIndexes: nextSelected,
        correctCount: nextSelected.length
      }
    }
  }

  renderPresenterFinalRound2Preview()

  sendPresenterFinalCommandSafe(
    "toggleRound2Correct",
    {
      round: 2,
      index: i,
      number: currentNumber,
      selectedCorrectIndexes: nextSelected
    }
  )
}

async function renderPresenterFinalRound2Preview() {
  const previewBox =
    document.getElementById("presenterFinalPreview")

  if (!previewBox) return

  const state =
    getPresenterFinalRoundState(2)

  const current =
    Number(
      state.currentNumber ||
      (
        presenterFinalSelected?.round === 2
          ? presenterFinalSelected.number
          : 0
      )
    )

  if (!current) {
    previewBox.innerHTML =
      presenterFinalPreviewCache[2] || "—"

    return
  }

  const type =
    getPresenterFinalRound2Type(current)

  if (type === "image") {
    await renderPresenterFinalRound2ImagePreview(current)
    return
  }

  await loadPresenterFinalRound2Rows()

  const rows =
    presenterFinalRound2Rows.filter(row => {
      return Number(row.number) === Number(current)
    })

  if (!rows.length) {
    presenterFinalPreviewCache[2] = `
      <div class="presenterFinalRound2Empty">
        لا توجد بيانات
      </div>
    `

    previewBox.innerHTML =
      presenterFinalPreviewCache[2]

    return
  }

  if (type === "scramble") {
    const selected =
      Array.isArray(state.selectedCorrectIndexes)
        ? state.selectedCorrectIndexes.map(Number)
        : []

    presenterFinalPreviewCache[2] = `
      <div class="presenterFinalRound2AnswerGrid">
        ${
          rows.map((r, idx) => `
            <button
              class="presenterFinalRound2AnswerCard ${selected.includes(idx) ? "selectedCorrect" : ""}"
              type="button"
              onclick="togglePresenterFinalRound2Correct(${idx})"
            >
              <span>
                ${presenterSafeHtml(r.answer || r.prompt || "-")}
              </span>
            </button>
          `).join("")
        }
      </div>
    `

    previewBox.innerHTML =
      presenterFinalPreviewCache[2]

    return
  }

  if (type === "sequence") {
    const hidden =
      Array.isArray(state.hiddenSequence)
        ? state.hiddenSequence.map(Number)
        : []

    presenterFinalPreviewCache[2] = `
      <div class="presenterFinalRound2SequenceView">

        <div class="presenterFinalRound2Countdown">
          ${Number(state.countdown ?? 15)}
        </div>

        <div class="presenterFinalRound2AnswerGrid">
          ${
            rows.map((r, idx) => {
              if (hidden.includes(idx)) return ""

              return `
                <button
                  class="presenterFinalRound2AnswerCard"
                  type="button"
                  onclick="hidePresenterFinalRound2SequenceWord(${idx})"
                >
                  <span>
                    ${presenterSafeHtml(r.prompt || r.answer || "-")}
                  </span>
                </button>
              `
            }).join("")
          }
        </div>

      </div>
    `

    previewBox.innerHTML =
      presenterFinalPreviewCache[2]
  }
}

function togglePresenterFinalRound2ImageAnswer(index) {
  const state =
    getPresenterFinalRoundState(2)

  const currentNumber =
    Number(
      state.currentNumber ||
      (
        presenterFinalSelected?.round === 2
          ? presenterFinalSelected.number
          : 0
      )
    )

  if (!currentNumber) return

  const oldSelected =
    presenterFinalRound2ImageLocalSelection.number === currentNumber &&
    Date.now() < presenterFinalRound2ImageLocalSelection.expires
      ? presenterFinalRound2ImageLocalSelection.indexes
      : Array.isArray(state.selectedCorrectIndexes)
        ? state.selectedCorrectIndexes
        : []

  const baseSelected =
    oldSelected.map(Number)

  const i =
    Number(index)

  const nextSelected =
    baseSelected.includes(i)
      ? baseSelected.filter(x => Number(x) !== i)
      : [...baseSelected, i]

  presenterFinalRound2ImageLocalSelection = {
    number: currentNumber,
    indexes: nextSelected,
    expires: Date.now() + 60000
  }

  presenterLiveState = {
    ...(presenterLiveState || {}),
    final: {
      ...(presenterLiveState?.final || {}),
      round: 2,
      round2: {
        ...(presenterLiveState?.final?.round2 || {}),
        currentNumber,
        selectedCorrectIndexes: nextSelected
      }
    }
  }

  renderPresenterFinalRound2ImagePreview(currentNumber)

  sendPresenterFinalCommandSafe(
    "toggleRound2ImageCorrect",
    {
      round: 2,
      index: i,
      number: currentNumber,
      selectedCorrectIndexes: nextSelected
    }
  )
}

async function renderPresenterFinalRound2ImagePreview(
  current
) {
  const previewBox =
    document.getElementById("presenterFinalPreview")

  if (!previewBox) return

  const state =
    getPresenterFinalRoundState(2)

  const selected =
    (
      presenterFinalRound2ImageLocalSelection.number === Number(current) &&
      Date.now() < presenterFinalRound2ImageLocalSelection.expires
        ? presenterFinalRound2ImageLocalSelection.indexes
        : (state.selectedCorrectIndexes || [])
    ).map(Number)

  let answers =
    Array.isArray(state.imageAnswers)
      ? state.imageAnswers
      : []

  if (!answers.length) {
    const dbNumber =
      getPresenterFinalRound2ImageDbNumber(current)

    const rows =
      await loadPresenterFinalRound3RowsByNumber(
        dbNumber
      )

    answers =
      rows.map(row => row.answer || "-")
  }

  presenterFinalPreviewCache[2] = `
    <div class="presenterFinalRound2ImageView">

      <div class="presenterFinalRound2ImageStatus">
        <span>المعروض</span>

        <strong>
          ${Number(state.shownImageIndex || 0)}
        </strong>

        ${
          state.imageAnswerShown
            ? `<em>الإجابات</em>`
            : ""
        }
      </div>

      <div class="presenterFinalRound2AnswerGrid">
        ${
          answers.length
            ? answers.map((answer, idx) => `
              <button
                class="presenterFinalRound2AnswerCard ${selected.includes(Number(idx)) ? "selectedCorrect" : ""}"
                type="button"
                onclick="togglePresenterFinalRound2ImageAnswer(${idx})"
              >
                <span>
                  ${presenterSafeHtml(answer || "-")}
                </span>
              </button>
            `).join("")
            : `
              <div class="presenterFinalRound2Empty">
                لا توجد إجابات
              </div>
            `
        }
      </div>

    </div>
  `

  previewBox.innerHTML =
    presenterFinalPreviewCache[2]
}

/* =========================
   ROUND 3 PREVIEW
========================= */

async function renderPresenterFinalRound3Preview() {
  const previewBox =
    document.getElementById("presenterFinalPreview")

  if (!previewBox) return

  const state =
    getPresenterFinalRoundState(3)

  const current =
    Number(
      state.currentNumber ||
      (
        presenterFinalSelected?.round === 3
          ? presenterFinalSelected.number
          : 0
      )
    )

  if (!current) {
    previewBox.innerHTML =
      presenterFinalPreviewCache[3] || "—"

    return
  }

  let parts =
    Array.isArray(state.currentParts)
      ? state.currentParts
      : []

  let answer =
    state.currentAnswer || ""

  const currentPoints =
    Number(state.currentPoints || 0)

  if (!parts.length || !answer) {
    const dbNumber =
      200 + Number(current)

    const data =
      await loadPresenterFinalRound1Item(dbNumber)

    if (data) {
      if (!parts.length) {
        parts = [
          data.question_part1 || "",
          data.question_part2 || "",
          data.question_part3 || ""
        ].filter(Boolean)
      }

      if (!answer) {
        answer = data.answer || ""
      }
    }
  }

  const shownPart =
    Number(state.shownPart || 0)

  presenterFinalPreviewCache[3] = `
    <div class="presenterFinalRound3StoryView">

      <div class="presenterFinalRound3StoryParts">
        ${
          parts.length
            ? parts.map((part, idx) => `
              <div
                class="
                  presenterFinalRound3StoryPart
                  ${idx < shownPart ? "visiblePart" : ""}
                "
              >
                <span>
                  ${idx === 0 ? 3 : idx === 1 ? 2 : 1}
                </span>

                <strong>
                  ${presenterSafeHtml(part || "-")}
                </strong>
              </div>
            `).join("")
            : `
              <div class="presenterFinalRound3Empty">
                لا توجد أجزاء
              </div>
            `
        }
      </div>

      <div class="presenterFinalRound3AnswerPanel">
        <span>
          الإجابة ${currentPoints ? `- ${currentPoints}` : ""}
        </span>

        <strong>
          ${presenterSafeHtml(answer || "—")}
        </strong>
      </div>

    </div>
  `

  previewBox.innerHTML =
    presenterFinalPreviewCache[3]
}

/* =========================
   ROUND 4 PREVIEW
========================= */

async function renderPresenterFinalRound4Preview() {
  const previewBox =
    document.getElementById("presenterFinalPreview")

  if (!previewBox) return

  const state =
    getPresenterFinalRoundState(4)

  const mediaState =
    getPresenterFinalRound4TeamMediaState()

  const current =
    Number(
      mediaState.currentNumber ||
      state.currentNumber ||
      (
        presenterFinalSelected?.round === 4
          ? presenterFinalSelected.number
          : 0
      )
    )

  if (!current) {
    previewBox.innerHTML =
      presenterFinalPreviewCache[4] || "—"

    return
  }

  let question =
    mediaState.currentQuestion ||
    state.currentQuestion ||
    ""

  let answer =
    mediaState.currentAnswer ||
    state.currentAnswer ||
    ""

  let mediaType =
    mediaState.currentMediaType || ""

  if (!question && !answer) {
    const rows =
      await loadPresenterFinalRound3RowsByNumber(
        current
      )

    const data =
      rows.find(row =>
        Number(row.image_order || 0) === 1
      ) || rows[0] || null

    if (data) {
      question =
        data.question ||
        data.note ||
        ""

      answer =
        data.answer || ""

      mediaType =
        data.video
          ? "video"
          : data.image
            ? "image"
            : ""
    }
  }

  const statusText =
    mediaState.answerShown
      ? "الإجابة"
      : mediaState.questionShown
        ? "السؤال"
        : mediaState.imageHidden
          ? "انتهت الصورة"
          : mediaState.currentNumber
            ? "الوسائط"
            : "جاهز"

  const mediaLabel =
    mediaType === "video"
      ? "فيديو"
      : mediaType === "image"
        ? "صورة"
        : "—"

  presenterFinalPreviewCache[4] = `
    <div class="presenterFinalRound4FocusView">

      <div class="presenterFinalRound4Status">
        <span>${statusText}</span>
        <strong>${mediaLabel}</strong>
      </div>

      <div class="presenterFinalRound4Content">

        <section class="presenterFinalRound4Box questionBox">
          <span>السؤال</span>

          <strong>
            ${presenterSafeHtml(question || "—")}
          </strong>
        </section>

        <section class="presenterFinalRound4Box answerBox">
          <span>الإجابة</span>

          <strong>
            ${presenterSafeHtml(answer || "—")}
          </strong>
        </section>

      </div>

    </div>
  `

  previewBox.innerHTML =
    presenterFinalPreviewCache[4]
}

/* =========================
   READER FINAL ROUND 1
========================= */

async function renderPresenterReaderFinalRound1() {
  const panel =
    document.getElementById("presenterReaderPanel")

  if (!panel) return

  const count =
    getPresenterFinalRound1Count()

  const rows =
    await loadPresenterFinalRound1RowsByRange(
      1,
      count
    )

  if (!rows.length) {
    panel.innerHTML =
      readerEmpty("لا توجد بيانات في بدون نقط")

    return
  }

  panel.innerHTML = `
    <div class="readerSimpleGrid">
      ${
        rows.map(row => readerMiniCard({
          id: readerId(["final1", row.number]),
          number: row.number,
          title: `رقم ${row.number}`,
          answer: row.answer
        })).join("")
      }
    </div>
  `
}

/* =========================
   READER FINAL ROUND 2
========================= */

async function renderPresenterReaderFinalRound2() {
  const panel =
    document.getElementById("presenterReaderPanel")

  if (!panel) return

  const [textRows, imageRows] =
    await Promise.all([
      loadPresenterFinalRound2Rows(),

      loadPresenterFinalRound3RowsByNumbers([
        101,
        102
      ])
    ])

  panel.innerHTML = `
    <div class="readerRoundsStack">
      ${
        [1, 2, 3, 4, 5, 6].map(number => {
          const type =
            getPresenterFinalRound2Type(number)

          if (type === "scramble") {
            const rows =
              textRows.filter(row => {
                return Number(row.number) === number
              })

            return `
              <section class="readerRoundPage">
                <div class="readerRoundHead">
                  <h2>رقم ${number}</h2>
                  <span>التلميح والإجابة</span>
                </div>

                <div class="readerSimpleGrid">
                  ${
                    rows.length
                      ? rows.map(row => readerMiniCard({
                          id: readerId([
                            "final2",
                            number,
                            row.item_order
                          ]),
                          number: row.item_order,
                          title: `عنصر ${row.item_order}`,
                          hint: row.hint,
                          answer: row.answer
                        })).join("")
                      : readerEmpty("لا توجد بيانات")
                  }
                </div>
              </section>
            `
          }

          if (type === "sequence") {
            const rows =
              textRows.filter(row => {
                return Number(row.number) === number
              })

            return `
              <section class="readerRoundPage">
                <div class="readerRoundHead">
                  <h2>رقم ${number}</h2>
                  <span>الكلمات فقط</span>
                </div>

                <div class="readerWordsOnly">
                  ${
                    rows.length
                      ? rows.map(row => `
                        <div
                          class="readerWordOnly ${readerReadClass(readerId(["final2seq", number, row.item_order]))}"
                          onclick="toggleReaderRead('${readerId(["final2seq", number, row.item_order])}', this)"
                        >
                          <strong>${readerEscape(row.item_order)}</strong>
                          <span>${readerEscape(row.prompt || "—")}</span>
                        </div>
                      `).join("")
                      : readerEmpty("لا توجد كلمات")
                  }
                </div>
              </section>
            `
          }

          const dbNumber =
            getPresenterFinalRound2ImageDbNumber(number)

          const rows =
            imageRows.filter(row => {
              return Number(row.number) === dbNumber
            })

          return `
            <section class="readerRoundPage">
              <div class="readerRoundHead">
                <h2>رقم ${number}</h2>
                <span>صور مصغرة</span>
              </div>

              <div class="readerMediaList">
                ${
                  rows.length
                    ? rows.map(row => readerMiniCard({
                        id: readerId([
                          "final2img",
                          number,
                          row.image_order
                        ]),
                        number: row.image_order,
                        title: `الصورة ${row.image_order}`,
                        answer: row.answer,
                        image: row.image
                      })).join("")
                    : readerEmpty("لا توجد صور")
                }
              </div>
            </section>
          `
        }).join("")
      }
    </div>
  `
}

/* =========================
   READER FINAL ROUND 3
========================= */

async function renderPresenterReaderFinalRound3() {
  const panel =
    document.getElementById("presenterReaderPanel")

  if (!panel) return

  const count =
    getPresenterFinalRound3StoryCount()

  const rows =
    await loadPresenterFinalRound1RowsByRange(
      201,
      200 + count
    )

  if (!rows.length) {
    panel.innerHTML =
      readerEmpty("لا توجد بيانات في قصة")

    return
  }

  panel.innerHTML = `
    <div class="readerSimpleGrid">
      ${
        rows.map(row => {
          const displayNumber =
            Number(row.number) - 200

          const parts = [
            row.question_part1,
            row.question_part2,
            row.question_part3
          ].filter(Boolean)

          return readerMiniCard({
            id: readerId(["story", displayNumber]),
            number: displayNumber,
            title: `رقم ${displayNumber}`,
            parts,
            answer: row.answer
          })
        }).join("")
      }
    </div>
  `
}

/* =========================
   READER FINAL ROUND 4
========================= */

async function renderPresenterReaderFinalRound4() {
  const panel =
    document.getElementById("presenterReaderPanel")

  if (!panel) return

  const count =
    getPresenterFinalRound4FocusCount()

  const numbers =
    Array.from(
      {
        length: count
      },
      (_, i) => i + 1
    )

  const allRows =
    await loadPresenterFinalRound3RowsByNumbers(
      numbers
    )

  const rows =
    allRows.filter(row => {
      return Number(row.image_order || 0) === 1
    })

  if (!rows.length) {
    panel.innerHTML =
      readerEmpty("لا توجد بيانات في التركيز")

    return
  }

  panel.innerHTML = `
    <div class="readerMediaList">
      ${
        rows.map(row => readerMiniCard({
          id: readerId(["focus", row.number]),
          number: row.number,
          title: `رقم ${row.number}`,
          question: row.question,
          answer: row.answer,
          image: row.image,
          video: row.video
        })).join("")
      }
    </div>
  `
}