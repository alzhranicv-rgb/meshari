

let presenterModel = 1
let presenterSegment = null
let presenterTeamAName = "الفريق الأول"
let presenterTeamBName = "الفريق الثاني"
let presenterSelectedTeam = null
let presenterSessionId = null
let presenterChannel = null
let presenterFinalRound = 1
let presenterLiveState = null
let lastPresenterToastTime = 0
let presenterSyncTimer = null
let presenterGoingHome = false
let presenterJustJoined = false
let presenterFinalForcedRound = null
let presenterFinalForcedRoundUntil = 0
let presenterFinalRoundOverride = null
let presenterLocalSyncUntil = 0
let presenterLocalOpenedSegment = null
let presenterChannelHealthy = false
/* =========================
   PRESENTER DATA CACHE
========================= */

const PRESENTER_SESSION_CACHE_TTL = 30 * 1000
const PRESENTER_MODEL_CACHE_TTL = 5 * 60 * 1000
const PRESENTER_GLOBAL_CACHE_TTL = 10 * 60 * 1000
const PRESENTER_CONTENT_CACHE_TTL = 10 * 60 * 1000
const PRESENTER_READER_CACHE_TTL = 15 * 60 * 1000
const PRESENTER_CACHE_VERSION = 3

const PRESENTER_SESSION_SELECT = `
  id,
  model,
  team_a,
  team_b,
  active_segment,
  state,
  updated_at,
  join_code,
  status,
  ended_at
`

const presenterResourceRequests = new Map()
let presenterDeferredPreloadToken = 0

function getPresenterResourceCacheKey(namespace, parts = []) {
  return [
    "presenter_cache",
    PRESENTER_CACHE_VERSION,
    namespace,
    ...parts
  ].join("_")
}

function readPresenterResourceCache(
  cacheKey,
  ttl = PRESENTER_CONTENT_CACHE_TTL,
  options = {}
) {
  try {
    const saved = JSON.parse(
      localStorage.getItem(cacheKey) || "null"
    )

    if (
      !saved ||
      !Object.prototype.hasOwnProperty.call(saved, "data") ||
      !saved.savedAt
    ) {
      return null
    }

    const age = Date.now() - Number(saved.savedAt)
    const stale = age > Number(ttl || 0)

    if (stale && options.allowStale !== true) {
      return null
    }

    return {
      data: saved.data,
      savedAt: Number(saved.savedAt),
      age,
      stale
    }
  } catch {
    return null
  }
}

function savePresenterResourceCache(cacheKey, data) {
  try {
    localStorage.setItem(
      cacheKey,
      JSON.stringify({
        data,
        savedAt: Date.now()
      })
    )
  } catch (error) {
    console.log("SAVE PRESENTER RESOURCE CACHE ERROR:", error)
  }
}

function removePresenterResourceCache(cacheKey) {
  try {
    localStorage.removeItem(cacheKey)
  } catch {
    // تجاهل أخطاء التخزين المحلي
  }
}

function runPresenterResourceRequest(cacheKey, requestFactory) {
  if (presenterResourceRequests.has(cacheKey)) {
    return presenterResourceRequests.get(cacheKey)
  }

  const promise = Promise.resolve()
    .then(requestFactory)
    .finally(() => {
      presenterResourceRequests.delete(cacheKey)
    })

  presenterResourceRequests.set(cacheKey, promise)
  return promise
}

function queuePresenterIdleTask(callback, options = {}) {
  const delay = Math.max(0, Number(options.delay || 0))
  const timeout = Math.max(500, Number(options.timeout || 2000))

  return setTimeout(() => {
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(
        () => callback(),
        { timeout }
      )
      return
    }

    setTimeout(callback, 0)
  }, delay)
}


async function withPresenterTimeout(
  promise,
  timeoutMs = 3500,
  fallback = null
) {
  let timer = null

  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise(resolve => {
        timer = setTimeout(
          () => resolve(fallback),
          Math.max(500, Number(timeoutMs || 3500))
        )
      })
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function loadPresenterCachedResource({
  cacheKey,
  ttl = PRESENTER_CONTENT_CACHE_TTL,
  forceRefresh = false,
  staleWhileRevalidate = true,
  fetcher
}) {
  if (!cacheKey || typeof fetcher !== "function") {
    return {
      data: null,
      error: new Error("Invalid presenter resource loader"),
      source: "error"
    }
  }

  const cached = readPresenterResourceCache(
    cacheKey,
    ttl,
    { allowStale: staleWhileRevalidate }
  )

  const fetchFresh = () => runPresenterResourceRequest(
    cacheKey,
    async () => {
      try {
        const result = await fetcher()
        const data = result?.data ?? null
        const error = result?.error || null

        if (!error) {
          savePresenterResourceCache(cacheKey, data)
        }

        return {
          data,
          error,
          source: "network"
        }
      } catch (error) {
        return {
          data: null,
          error,
          source: "error"
        }
      }
    }
  )

  if (!forceRefresh && cached) {
    if (
      staleWhileRevalidate &&
      (
        cached.stale ||
        cached.age > Math.max(30 * 1000, ttl * 0.6)
      )
    ) {
      queuePresenterIdleTask(() => {
        fetchFresh().catch(() => null)
      })
    }

    return {
      data: cached.data,
      error: null,
      source: cached.stale
        ? "stale-cache"
        : "cache"
    }
  }

  const fresh = await fetchFresh()

  if (fresh.error && cached) {
    return {
      data: cached.data,
      error: fresh.error,
      source: "stale-cache"
    }
  }

  return fresh
}

function ensurePresenterLoadingStyles() {
  if (document.getElementById("presenterLoadingStyles")) return

  const style = document.createElement("style")
  style.id = "presenterLoadingStyles"
  style.textContent = `
    @keyframes presenterLoadingSpin {
      to { transform: rotate(360deg); }
    }

    .presenterInlineLoading {
      width: 100%;
      min-height: 92px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      color: #233D4D;
      font-weight: 700;
      text-align: center;
    }

    .presenterLoadingSpinner {
      width: 28px;
      height: 28px;
      flex: 0 0 28px;
      border: 3px solid #D5DADF;
      border-top-color: #FE7F2D;
      border-radius: 50%;
      animation: presenterLoadingSpin .75s linear infinite;
    }

    #presenterBootLoading {
      position: fixed;
      inset: 0;
      z-index: 99999;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: rgba(238, 243, 246, .96);
    }

    #presenterBootLoading.visible {
      display: flex;
    }

    #presenterBootLoading .presenterBootLoadingCard {
      width: min(92vw, 360px);
      min-height: 150px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: #FFFFFF;
      border: 2px solid #D5DADF;
      border-radius: 22px;
    }

    #presenterBackgroundLoading {
      position: fixed;
      right: 14px;
      bottom: 14px;
      z-index: 9998;
      display: none;
      align-items: center;
      gap: 9px;
      max-width: min(88vw, 320px);
      padding: 10px 14px;
      background: #FFFFFF;
      border: 1px solid #D5DADF;
      border-radius: 14px;
      color: #233D4D;
      box-shadow: 0 8px 24px rgba(35, 61, 77, .12);
      font-size: 14px;
      font-weight: 700;
    }

    #presenterBackgroundLoading.visible {
      display: flex;
    }

    #presenterBackgroundLoading .presenterLoadingSpinner {
      width: 18px;
      height: 18px;
      flex-basis: 18px;
      border-width: 2px;
    }
  `

  document.head.appendChild(style)
}

function getPresenterLoadingMarkup(text = "جارٍ التحميل...") {
  return `
    <div class="presenterInlineLoading" role="status" aria-live="polite">
      <span class="presenterLoadingSpinner" aria-hidden="true"></span>
      <span>${String(text || "جارٍ التحميل...")}</span>
    </div>
  `
}

function showPresenterBootLoading(text = "جاري تجهيز لوحة المقدم...") {
  ensurePresenterLoadingStyles()

  let overlay = document.getElementById("presenterBootLoading")

  if (!overlay) {
    overlay = document.createElement("div")
    overlay.id = "presenterBootLoading"
    overlay.innerHTML = `
      <div class="presenterBootLoadingCard"></div>
    `
    document.body.appendChild(overlay)
  }

  const card = overlay.querySelector(".presenterBootLoadingCard")
  if (card) card.innerHTML = getPresenterLoadingMarkup(text)

  overlay.classList.add("visible")
}

function hidePresenterBootLoading() {
  document
    .getElementById("presenterBootLoading")
    ?.classList.remove("visible")
}

function setPresenterBackgroundLoading(
  visible,
  text = "جاري تجهيز بيانات الفقرات..."
) {
  ensurePresenterLoadingStyles()

  let badge = document.getElementById("presenterBackgroundLoading")

  if (!badge) {
    badge = document.createElement("div")
    badge.id = "presenterBackgroundLoading"
    document.body.appendChild(badge)
  }

  if (visible) {
    badge.innerHTML = `
      <span class="presenterLoadingSpinner" aria-hidden="true"></span>
      <span>${String(text || "جاري تجهيز البيانات...")}</span>
    `
  }

  badge.classList.toggle("visible", !!visible)
}

let presenterModelDataLoaded = false
let presenterModelDataPromise = null
let presenterVisibilityPromise = null

function getPresenterSessionCacheKey(sessionId) {
  return `presenter_session_cache_${sessionId}`
}

function readPresenterSessionCache(sessionId) {
  try {
    const saved = JSON.parse(
      localStorage.getItem(
        getPresenterSessionCacheKey(sessionId)
      ) || "null"
    )

    if (!saved?.data || !saved?.savedAt) {
      return null
    }

    if (
      Date.now() - Number(saved.savedAt) >
      PRESENTER_SESSION_CACHE_TTL
    ) {
      return null
    }

    return saved.data
  } catch {
    return null
  }
}

function savePresenterSessionCache(data) {
  if (!data?.id) return

  try {
    localStorage.setItem(
      getPresenterSessionCacheKey(data.id),
      JSON.stringify({
        data,
        savedAt: Date.now()
      })
    )
  } catch (error) {
    console.log(
      "SAVE PRESENTER SESSION CACHE ERROR:",
      error
    )
  }
}

async function loadPresenterSession(sessionId, options = {}) {
  if (!sessionId || !window.db) {
    return {
      data: null,
      error: new Error("Session is unavailable"),
      source: "error"
    }
  }

  if (options.forceRefresh !== true) {
    const cached = readPresenterSessionCache(sessionId)

    if (cached) {
      return {
        data: cached,
        error: null,
        source: "cache"
      }
    }
  }

  try {
    const { data, error } = await db
      .from("game_sessions")
      .select(PRESENTER_SESSION_SELECT)
      .eq("id", sessionId)
      .maybeSingle()

    if (data) {
      savePresenterSessionCache(data)
    }

    return {
      data,
      error,
      source: "network"
    }
  } catch (error) {
    return {
      data: null,
      error,
      source: "error"
    }
  }
}

/* =========================
   SAFE PRESENTER SESSION UPDATE
   تحديث آمن وموحد للجلسة
========================= */

let presenterSessionUpdateQueue = Promise.resolve()
let presenterSessionUpdateCounter = 0

function mergePresenterObjects(base, patch) {
  const output = {
    ...(base && typeof base === "object" ? base : {})
  }

  Object.entries(patch || {}).forEach(([key, value]) => {
    const oldValue = output[key]

    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      oldValue &&
      typeof oldValue === "object" &&
      !Array.isArray(oldValue)
    ) {
      output[key] = mergePresenterObjects(
        oldValue,
        value
      )
    } else {
      output[key] = value
    }
  })

  return output
}

function updatePresenterLocalSessionData(data) {
  if (!data?.id) return

  savePresenterSessionCache(data)

  presenterSessionId = data.id
  presenterModel = Number(
    data.model ||
    presenterModel ||
    1
  )

  presenterTeamAName =
    data.team_a ||
    presenterTeamAName ||
    "الفريق الأول"

  presenterTeamBName =
    data.team_b ||
    presenterTeamBName ||
    "الفريق الثاني"

  presenterLiveState =
    data.state ||
    presenterLiveState ||
    {}

  if (
    typeof syncPresenterSelectedTeamFromDisplayState ===
    "function"
  ) {
    syncPresenterSelectedTeamFromDisplayState()
  }
}

async function performPresenterSessionUpdate(
  sessionId,
  patch = {},
  options = {}
) {
  if (!sessionId || !window.db) {
    return {
      data: null,
      error: new Error("Session is unavailable")
    }
  }

  const updateId =
    ++presenterSessionUpdateCounter

  try {
    const { data: currentData, error: readError } =
      await db
        .from("game_sessions")
        .select(PRESENTER_SESSION_SELECT)
        .eq("id", sessionId)
        .maybeSingle()

    if (readError || !currentData) {
      console.log(
        "SAFE SESSION READ ERROR:",
        readError
      )

      return {
        data: null,
        error:
          readError ||
          new Error("Session not found")
      }
    }

    if (
      currentData.status === "ended" &&
      options.allowEnded !== true
    ) {
      return {
        data: currentData,
        error: new Error("Session has ended")
      }
    }

    const nextUpdate = {
      ...patch,
      updated_at: new Date().toISOString()
    }

    if (
      patch.state &&
      typeof patch.state === "object"
    ) {
      nextUpdate.state =
        options.replaceState === true
          ? patch.state
          : mergePresenterObjects(
              currentData.state || {},
              patch.state
            )
    }

    const { data, error } = await db
      .from("game_sessions")
      .update(nextUpdate)
      .eq("id", sessionId)
      .select(PRESENTER_SESSION_SELECT)
      .maybeSingle()

    if (error || !data) {
      console.log(
        "SAFE SESSION UPDATE ERROR:",
        error
      )

      return {
        data: null,
        error:
          error ||
          new Error("Session update failed")
      }
    }

    updatePresenterLocalSessionData(data)

    if (
      options.applySession !== false &&
      typeof applyPresenterSessionData ===
        "function"
    ) {
      applyPresenterSessionData(data)
    }

    return {
      data,
      error: null,
      updateId
    }
  } catch (error) {
    console.log(
      "SAFE SESSION UPDATE CATCH:",
      error
    )

    return {
      data: null,
      error
    }
  }
}

function updatePresenterSessionSafely(
  patch = {},
  options = {}
) {
  const sessionId =
    options.sessionId ||
    presenterSessionId ||
    localStorage.getItem(
      "presenter_session_id"
    )

  const task = async () => {
    return performPresenterSessionUpdate(
      sessionId,
      patch,
      options
    )
  }

  presenterSessionUpdateQueue =
    presenterSessionUpdateQueue
      .catch(() => null)
      .then(task)

  return presenterSessionUpdateQueue
}

window.updatePresenterSessionSafely =
  updatePresenterSessionSafely

/* =========================
   PRESENTER SEGMENT NORMALIZER
========================= */

function normalizePresenterSegmentKey(key) {
  const value = String(key || "").trim()

  if (value === "finalRound1") return "final_round1"
  if (value === "finalRound2") return "final_round2"
  if (value === "finalRound3") return "final_round3"
  if (value === "finalRound4") return "final_round4"

  if (value === "final_round1") return "final_round1"
  if (value === "final_round2") return "final_round2"
  if (value === "final_round3") return "final_round3"
  if (value === "final_round4") return "final_round4"

  return value
}

window.normalizePresenterSegmentKey =
  normalizePresenterSegmentKey

function getPresenterSegmentName(segment) {
  const key = normalizePresenterSegmentKey(segment)

  if (key === "final") {
    const round = Number(
      presenterFinalRound ||
      presenterLiveState?.final?.round ||
      1
    )

    const finalTitles = {
      1: "ٮدوں ٮڡاط",
      2: "صح صحلي",
      3: "قصة",
      4: "التركيز"
    }

    return finalTitles[round] || "الفاصلة"
  }

  const item = ALL_PRESENTER_SEGMENTS.find(segmentItem => {
    return normalizePresenterSegmentKey(segmentItem.key) === key
  })

  return item?.title || "لوحة المقدم"
}

window.getPresenterSegmentName = getPresenterSegmentName

function isPresenterSegmentGloballyEnabled(
  segmentKey,
  globalMap = {}
) {
  const key = normalizePresenterSegmentKey(segmentKey)
  return globalMap[key] !== false
}

function markPresenterLocalSync(segment = presenterSegment, ms = 1200) {
  presenterLocalSyncUntil = Date.now() + ms
  presenterLocalOpenedSegment = segment || presenterSegment || null
}

function isPresenterLocalSyncProtected() {
  return Date.now() < presenterLocalSyncUntil
}
/* =========================
   PRESENTER MODE
   control = تحكم
   reader  = دليل الأسئلة فقط
========================= */

let presenterJoinMode = localStorage.getItem("presenter_join_mode") || "control"
let presenterReaderSegment = null

function setPresenterJoinMode(mode) {
  presenterJoinMode = mode === "reader" ? "reader" : "control"
  localStorage.setItem("presenter_join_mode", presenterJoinMode)

  document.getElementById("presenterControlModeBtn")?.classList.toggle(
    "activePresenterMode",
    presenterJoinMode === "control"
  )

  document.getElementById("presenterReaderModeBtn")?.classList.toggle(
    "activePresenterMode",
    presenterJoinMode === "reader"
  )

  const status = document.getElementById("presenterJoinStatus")

  if (status) {
    status.innerText =
      presenterJoinMode === "reader"
        ? "وضع قراءة فقط: الأسئلة والإجابات بدون تحكم"
        : "وضع تحكم: ربط مع العرض والتحكم باللعبة"
  }
}

function syncPresenterJoinModeUI() {
  setPresenterJoinMode(presenterJoinMode)
}
const ALL_PRESENTER_SEGMENTS = [
  { key: "warmup", title: "التسخين", sort: 1 },
  { key: "top10", title: "Top 10", sort: 2 },
  { key: "who", title: "من هو", sort: 3 },
  { key: "explain", title: "اشرح الكلمة", sort: 4 },
  { key: "letterli", title: "حرفلي", sort: 5 },

  { key: "final_round1", title: "ٮدوں ٮڡاط", sort: 6, finalRound: 1 },
  { key: "final_round2", title: "صح صحلي", sort: 7, finalRound: 2 },
  { key: "final_round3", title: "قصة", sort: 8, finalRound: 3 },
  { key: "final_round4", title: "التركيز", sort: 9, finalRound: 4 },

  { key: "archive", title: "الأرشيف", sort: 10 },
  { key: "randomChallenge", title: "التحدي", sort: 11 }
]


let presenterVisibleSegments = ALL_PRESENTER_SEGMENTS
  .map(item => ({
    ...item,
    is_visible: true,
    sort_order: item.sort
  }))

document.addEventListener("DOMContentLoaded", async () => {
  const urlParams =
    new URLSearchParams(window.location.search)

  const openedFromQr =
    urlParams.get("join") === "1"

  if (openedFromQr) {
    localStorage.removeItem("presenter_session_id")
    localStorage.removeItem("presenter_join_code")
  }

  const savedSessionId =
    localStorage.getItem("presenter_session_id")

  if (!savedSessionId) {
    hidePresenterBootLoading()
    showPresenterJoin()
    return
  }

  showPresenterBootLoading()

  const cachedSession =
    readPresenterSessionCache(savedSessionId)

  if (cachedSession) {
    if (cachedSession.status === "ended") {
      hidePresenterBootLoading()
      renderPresenterEnded()
      return
    }

    presenterSessionId = cachedSession.id
    presenterModel = Number(cachedSession.model || 1)
    presenterTeamAName =
      cachedSession.team_a || "الفريق الأول"
    presenterTeamBName =
      cachedSession.team_b || "الفريق الثاني"
    presenterLiveState =
      cachedSession.state || {}

    syncPresenterSelectedTeamFromDisplayState()

    if (presenterJoinMode === "reader") {
      await renderPresenterReaderHome()
    } else {
      applyPresenterSessionData(cachedSession)
    }

    hidePresenterBootLoading()
  }

  const result = await loadPresenterSession(
    savedSessionId,
    { forceRefresh: true }
  )

  if (result.error || !result.data) {
    hidePresenterBootLoading()

    if (!cachedSession) {
      localStorage.removeItem("presenter_session_id")
      localStorage.removeItem("presenter_join_code")
      showPresenterJoin()
    }

    return
  }

  const data = result.data

  if (data.status === "ended") {
    hidePresenterBootLoading()
    renderPresenterEnded()
    return
  }

  presenterSessionId = data.id
  presenterModel = Number(data.model || 1)
  presenterTeamAName =
    data.team_a || "الفريق الأول"
  presenterTeamBName =
    data.team_b || "الفريق الثاني"
  presenterLiveState =
    data.state || {}

  syncPresenterSelectedTeamFromDisplayState()

  if (presenterJoinMode === "reader") {
    await renderPresenterReaderHome()
    hidePresenterBootLoading()
    return
  }

  applyPresenterSessionData(data)
  subscribeToGameSession(data.id)
  hidePresenterBootLoading()
})

/* =========================
   PAGE MODE
========================= */

function hideAllPresenterPages() {
  document.getElementById("presenterJoin")?.classList.add("hidden")
  document.getElementById("presenterHome")?.classList.add("hidden")
  document.getElementById("presenterSegmentPage")?.classList.add("hidden")

  document.getElementById("presenterReaderHome")?.classList.add("hidden")
  document.getElementById("presenterReaderSegmentPage")?.classList.add("hidden")
}

function showPresenterJoin() {
  hideAllPresenterPages()
  document.getElementById("presenterJoin")?.classList.remove("hidden")
  syncPresenterJoinModeUI()
  hidePresenterInsideModeSwitch()
}

function showPresenterHomePage() {
  hideAllPresenterPages()
  document.getElementById("presenterHome")?.classList.remove("hidden")
}

function showPresenterSegmentPage() {
  hideAllPresenterPages()
  document.getElementById("presenterSegmentPage")?.classList.remove("hidden")
  hidePresenterInsideModeSwitch()
}

function showPresenterReaderHomePage() {
  hideAllPresenterPages()
  document
    .getElementById("presenterReaderHome")
    ?.classList.remove("hidden")
}

function showPresenterReaderSegmentPage() {
  hideAllPresenterPages()
  document
    .getElementById("presenterReaderSegmentPage")
    ?.classList.remove("hidden")
}

async function loadPresenterGlobalSegmentVisibilityMap(
  options = {}
) {
  const map = {}

  try {
    const result = await withPresenterTimeout(
      loadPresenterCachedResource({
        cacheKey: getPresenterResourceCacheKey(
          "global_segment_visibility"
        ),
        ttl: PRESENTER_GLOBAL_CACHE_TTL,
        forceRefresh: options.forceRefresh === true,
        staleWhileRevalidate:
          options.staleWhileRevalidate !== false,
        fetcher: async () => {
          const { data, error } = await db
            .from("global_segment_visibility")
            .select("segment_key,is_enabled")

          return { data: data || [], error }
        }
      }),
      3200,
      {
        data: [],
        error: new Error("Global visibility timeout"),
        source: "timeout"
      }
    )

    const rows = Array.isArray(result?.data)
      ? result.data
      : []

    rows.forEach(row => {
      const key = normalizePresenterSegmentKey(
        row.segment_key
      )

      map[key] = row.is_enabled !== false
    })

    if (result?.error && !rows.length) {
      console.log(
        "PRESENTER GLOBAL VISIBILITY FALLBACK:",
        result.error
      )
    }

    return map
  } catch (error) {
    console.log(
      "PRESENTER GLOBAL VISIBILITY CATCH:",
      error
    )

    return map
  }
}

async function loadPresenterModelData(options = {}) {
  const modelId = Number(presenterModel || 0)

  if (!modelId) return null

  if (
    presenterModelDataPromise &&
    options.forceRefresh !== true
  ) {
    return presenterModelDataPromise
  }

  presenterModelDataPromise = (async () => {
    try {
      const result = await withPresenterTimeout(
        loadPresenterCachedResource({
          cacheKey: getPresenterResourceCacheKey(
            "model_relations",
            [modelId]
          ),
          ttl: PRESENTER_MODEL_CACHE_TTL,
          forceRefresh: options.forceRefresh === true,
          staleWhileRevalidate:
            options.staleWhileRevalidate !== false,
          fetcher: async () => {
            const { data, error } = await db
              .from("models")
              .select(`
                id,
                name,
                visible_segments (
                  segment_key,
                  is_visible,
                  sort_order
                ),
                segment_settings (*)
              `)
              .eq("id", modelId)
              .maybeSingle()

            return { data, error }
          }
        }),
        3800,
        {
          data: null,
          error: new Error("Model relations timeout"),
          source: "timeout"
        }
      )

      if (result?.error && !result?.data) {
        console.log(
          "LOAD PRESENTER MODEL DATA FALLBACK:",
          result.error
        )

        return null
      }

      presenterModelDataLoaded = true
      return result?.data || null
    } catch (error) {
      console.log(
        "LOAD PRESENTER MODEL DATA CATCH:",
        error
      )

      return null
    } finally {
      presenterModelDataPromise = null
    }
  })()

  return presenterModelDataPromise
}

function applyPresenterVisibleSegments(
  rows = [],
  globalMap = {}
) {
  const map = {}

  ALL_PRESENTER_SEGMENTS.forEach(item => {
    const key =
      normalizePresenterSegmentKey(item.key)

    if (
      !isPresenterSegmentGloballyEnabled(
        key,
        globalMap
      )
    ) {
      return
    }

    map[key] = {
      ...item,
      key,
      is_visible: true,
      sort_order: item.sort
    }
  })

  ;(rows || []).forEach(row => {
    const key =
      normalizePresenterSegmentKey(
        row.segment_key
      )

    if (!map[key]) return

    map[key] = {
      ...map[key],
      is_visible: !!row.is_visible,
      sort_order: Number(
        row.sort_order ||
        map[key].sort
      )
    }
  })

  presenterVisibleSegments =
    Object.values(map)
      .filter(item => item.is_visible)
      .sort((a, b) => {
        return (
          Number(a.sort_order || a.sort) -
          Number(b.sort_order || b.sort)
        )
      })

  return presenterVisibleSegments
}

function applyPresenterCachedVisibilityNow() {
  const globalCached = readPresenterResourceCache(
    getPresenterResourceCacheKey(
      "global_segment_visibility"
    ),
    PRESENTER_GLOBAL_CACHE_TTL,
    { allowStale: true }
  )

  const modelCached = readPresenterResourceCache(
    getPresenterResourceCacheKey(
      "model_relations",
      [Number(presenterModel || 0)]
    ),
    PRESENTER_MODEL_CACHE_TTL,
    { allowStale: true }
  )

  const globalMap = {}

  ;(globalCached?.data || []).forEach(row => {
    const key = normalizePresenterSegmentKey(
      row.segment_key
    )

    globalMap[key] = row.is_enabled !== false
  })

  return applyPresenterVisibleSegments(
    modelCached?.data?.visible_segments || [],
    globalMap
  )
}

async function loadPresenterVisibleSegments(
  options = {}
) {
  if (
    presenterVisibilityPromise &&
    options.forceRefresh !== true
  ) {
    return presenterVisibilityPromise
  }

  presenterVisibilityPromise = (async () => {
    try {
      const settled = await Promise.allSettled([
        loadPresenterGlobalSegmentVisibilityMap({
          forceRefresh:
            options.forceRefresh === true,
          staleWhileRevalidate:
            options.staleWhileRevalidate !== false
        }),

        loadPresenterModelData({
          forceRefresh:
            options.forceRefresh === true,
          staleWhileRevalidate:
            options.staleWhileRevalidate !== false
        })
      ])

      const globalMap =
        settled[0]?.status === "fulfilled"
          ? settled[0].value || {}
          : {}

      const modelData =
        settled[1]?.status === "fulfilled"
          ? settled[1].value || null
          : null

      return applyPresenterVisibleSegments(
        modelData?.visible_segments || [],
        globalMap
      )
    } catch (error) {
      console.log(
        "LOAD PRESENTER VISIBILITY FALLBACK:",
        error
      )

      if (!presenterVisibleSegments.length) {
        applyPresenterVisibleSegments([], {})
      }

      return presenterVisibleSegments
    }
  })()

  try {
    return await presenterVisibilityPromise
  } finally {
    presenterVisibilityPromise = null
  }
}

function getPresenterDeferredPreloadTasks() {
  const visibleKeys = new Set(
    presenterVisibleSegments.map(item =>
      normalizePresenterSegmentKey(item.key)
    )
  )

  const tasks = []

  const warmupLoader = getPresenterModuleFunction(
    "loadPresenterWarmupRows"
  )

  if (visibleKeys.has("warmup") && warmupLoader) {
    tasks.push(() =>
      warmupLoader({ backgroundRefresh: false })
    )
  }

  const top10Loader = getPresenterModuleFunction(
    "loadPresenterTop10RoundRows"
  )

  if (visibleKeys.has("top10") && top10Loader) {
    tasks.push(() =>
      top10Loader(1, { backgroundRefresh: false })
    )
  }

  const whoLoader = getPresenterModuleFunction(
    "loadPresenterWhoRows"
  )

  if (visibleKeys.has("who") && whoLoader) {
    tasks.push(() =>
      whoLoader({ backgroundRefresh: false })
    )
  }

  return tasks
}

function schedulePresenterDeferredPreload() {
  const token = ++presenterDeferredPreloadToken

  queuePresenterIdleTask(async () => {
    const tasks = getPresenterDeferredPreloadTasks()

    if (!tasks.length || token !== presenterDeferredPreloadToken) {
      setPresenterBackgroundLoading(false)
      return
    }

    setPresenterBackgroundLoading(true)

    try {
      for (const task of tasks) {
        if (
          token !== presenterDeferredPreloadToken ||
          !presenterSessionId
        ) {
          break
        }

        if (document.hidden) {
          await new Promise(resolve => setTimeout(resolve, 350))
        }

        try {
          await task()
        } catch (error) {
          console.log("PRESENTER DEFERRED LOAD ERROR:", error)
        }

        await new Promise(resolve => setTimeout(resolve, 120))
      }
    } finally {
      if (token === presenterDeferredPreloadToken) {
        setPresenterBackgroundLoading(false)
      }
    }
  }, {
    delay: 700,
    timeout: 2500
  })
}

function isPresenterSegmentVisible(segment) {
  const key = normalizePresenterSegmentKey(segment)

  return presenterVisibleSegments.some(item => {
    return normalizePresenterSegmentKey(item.key) === key
  })
}

function getPresenterSegmentLockKeys(segmentKey) {
  const key = normalizePresenterSegmentKey(segmentKey)

  if (key === "final_round1") {
    return ["final_round1", "finalRound1"]
  }

  if (key === "final_round2") {
    return ["final_round2", "finalRound2"]
  }

  if (key === "final_round3") {
    return ["final_round3", "finalRound3"]
  }

  if (key === "final_round4") {
    return ["final_round4", "finalRound4"]
  }

  return [key]
}

function isPresenterSegmentLocked(segmentKey) {
  const status = presenterLiveState?.segmentStatus || {}
  return getPresenterSegmentLockKeys(segmentKey).some(key => {
    return !!status?.[key]?.locked
  })
}

function getPresenterCurrentLockKey() {
  if (presenterSegment === "final") {
    return `final_round${Number(getPresenterFinalRound() || 1)}`
  }

  return presenterSegment || ""
}

function buildPresenterSegmentsGridHtml() {
  if (!presenterVisibleSegments.length) {
    return `
      <div class="presenterEmptySegments">
        لا توجد فقرات مفعلة حاليًا
      </div>
    `
  }

  return presenterVisibleSegments.map(item => {
    const key = normalizePresenterSegmentKey(item.key)
    const locked = isPresenterSegmentLocked(key)

    const clickAction = item.finalRound
      ? `openPresenterFinalCard(${Number(item.finalRound)})`
      : `openPresenterSegment('${key}')`

    return `
      <button
        type="button"
        class="segmentCard presenterSegmentCard ${locked ? "presenterLockedSegment" : ""}"
        data-segment="${key}"
        onclick="${clickAction}"
        ${locked ? "disabled" : ""}
      >
        <span>${item.title}</span>
      </button>
    `
  }).join("")
}

async function renderPresenterSegmentsGrid() {
  const grid = document.getElementById("presenterSegmentsGrid")
  if (!grid) return

  applyPresenterCachedVisibilityNow()

  if (!presenterVisibleSegments.length) {
    applyPresenterVisibleSegments([], {})
  }

  grid.innerHTML = buildPresenterSegmentsGridHtml()

  try {
    await withPresenterTimeout(
      loadPresenterVisibleSegments(),
      4200,
      presenterVisibleSegments
    )

    grid.innerHTML = buildPresenterSegmentsGridHtml()
    updatePresenterLockedSegments()
  } catch (error) {
    console.log(
      "RENDER PRESENTER SEGMENTS FALLBACK:",
      error
    )
  }
}

/* =========================
   JOIN SESSION
========================= */

async function joinGameSession() {
  const input = document.getElementById("joinCodeInput")
  const status = document.getElementById("presenterJoinStatus")
  const btn = document.getElementById("presenterJoinBtn")

  const code = (input?.value || "").replace(/\D/g, "").trim()

  if (input) input.value = code

  if (code.length !== 4) {
    if (status) status.innerText = "اكتب كود من 4 أرقام"
    return
  }

  if (!window.db) {
    if (status) status.innerText = "الاتصال غير جاهز، أعد المحاولة"
    return
  }

  if (btn?.disabled) return

  if (btn) {
    btn.disabled = true
    btn.innerText = "جاري الدخول..."
  }

  if (status) status.innerText = "جاري التحقق من الكود..."

  try {
    const { data, error } = await db
      .from("game_sessions")
      .select(PRESENTER_SESSION_SELECT)
      .eq("join_code", code)
      .eq("status", "active")
      .maybeSingle()

    if (error || !data) {
      if (status) status.innerText = "الكود غير صحيح أو اللعبة منتهية"

      if (btn) {
        btn.disabled = false
        btn.innerText = "دخول"
      }

      return
    }

    localStorage.setItem("presenter_session_id", data.id)
    localStorage.setItem("presenter_join_code", code)

    window.history.replaceState({}, "", "presenter.html")

    presenterSessionId = data.id
    presenterModel = Number(data.model || 1)
    presenterTeamAName = data.team_a || "الفريق الأول"
    presenterTeamBName = data.team_b || "الفريق الثاني"
    presenterSegment = null

    presenterLiveState = {
      ...(data.state || {}),
      presenterStarted: true,
      presenterStartedAt: new Date().toISOString()
    }

    presenterJustJoined = true

if (presenterJoinMode === "reader") {
  presenterJustJoined = false
  renderPresenterReaderHome()
  showToast("تم الدخول إلى دليل الأسئلة")
  return
}

await markPresenterStartedSession(
  data.id,
  presenterLiveState
)

renderPresenterHome()
subscribeToGameSession(data.id)

showToast("تم الدخول للجلسة")

  } catch (e) {
    console.log("JOIN SESSION ERROR:", e)

    if (status) {
      status.innerText = "تعذر الدخول، تأكد من الاتصال"
    }

  } finally {
    if (btn) {
      btn.disabled = false
      btn.innerText = "دخول"
    }
  }
}

/* =========================
   SESSION SYNC / SEGMENT ROUTER - CLEAN BASE
========================= */

let presenterLastSessionStateKey = ""

function getPresenterSessionStateKey(data) {
  if (!data) return ""

  return JSON.stringify({
    id: data.id || "",
    status: data.status || "",
    active_segment: data.active_segment || "",
    updated_at: data.updated_at || "",
    state: data.state || {}
  })
}

function normalizePresenterSegmentFromSession(segment) {
  const key = String(segment || "")

  if (
    key === "finalRound1" ||
    key === "finalRound2" ||
    key === "finalRound3" ||
    key === "finalRound4" ||
    key === "final_round1" ||
    key === "final_round2" ||
    key === "final_round3" ||
    key === "final_round4"
  ) {
    return "final"
  }

  return key || null
}

function getPresenterFinalRoundFromSessionSegment(segment, fallback = 1) {
  const key = String(segment || "")

  if (key === "finalRound1" || key === "final_round1") return 1
  if (key === "finalRound2" || key === "final_round2") return 2
  if (key === "finalRound3" || key === "final_round3") return 3
  if (key === "finalRound4" || key === "final_round4") return 4

  return Number(fallback || 1)
}

function getPresenterFinalSessionSegmentKey(round) {
  const r = Number(round || 1)

  if (r === 1) return "finalRound1"
  if (r === 2) return "finalRound2"
  if (r === 3) return "finalRound3"
  if (r === 4) return "finalRound4"

  return "finalRound1"
}

function getPresenterModuleFunction(name) {
  const fn = window[name]
  return typeof fn === "function" ? fn : null
}

function getPresenterSegmentHandler(segment) {
  const key = normalizePresenterSegmentFromSession(segment)

  const handlers = {
    warmup: {
      render: getPresenterModuleFunction("renderWarmup"),
      refresh: getPresenterModuleFunction("refreshPresenterWarmupFromState")
    },

    top10: {
      render: getPresenterModuleFunction("renderTop10"),
      refresh: getPresenterModuleFunction("refreshPresenterTop10FromState")
    },

    auction: {
      render: getPresenterModuleFunction("renderAuction"),
      refresh: getPresenterModuleFunction("refreshPresenterAuctionFromState"),
      afterRender: () => {
        const ensureVideoButton = getPresenterModuleFunction(
          "ensurePresenterAuctionVideoButton"
        )

        if (ensureVideoButton) {
          setTimeout(ensureVideoButton, 120)
        }
      },
      afterRefresh: () => {
        const ensureVideoButton = getPresenterModuleFunction(
          "ensurePresenterAuctionVideoButton"
        )

        if (ensureVideoButton) {
          setTimeout(ensureVideoButton, 80)
        }
      }
    },

    who: {
      render: getPresenterModuleFunction("renderWho"),
      refresh: getPresenterModuleFunction("refreshPresenterWhoFromState")
    },

    explain: {
      render: getPresenterModuleFunction("renderExplain"),
      refresh: getPresenterModuleFunction("refreshPresenterExplainFromState")
    },

    letterli: {
      render: getPresenterModuleFunction("renderPresenterLetterli"),
      refresh: getPresenterModuleFunction("refreshPresenterLetterliFromState")
    },

    archive: {
      render: getPresenterModuleFunction("renderArchive"),
      refresh: getPresenterModuleFunction(
        "refreshPresenterArchiveFromState"
      )
    },

    randomChallenge: {
      render: getPresenterModuleFunction("renderPresenterRandomChallenge"),
      refresh: getPresenterModuleFunction(
        "refreshPresenterRandomChallengeFromState"
      )
    },

    final: {
      render: getPresenterModuleFunction("renderFinal"),
      refresh: getPresenterModuleFunction(
        "refreshPresenterFinalFromState"
      )
    }
  }

  const handler = handlers[key] || null

  if (!handler || typeof handler.render !== "function") {
    return null
  }

  return handler
}

function refreshPresenterCurrentSegmentFromState() {
  if (!presenterSegment) return

  try {
    syncPresenterSelectedTeamFromDisplayState()

    const handler = getPresenterSegmentHandler(presenterSegment)

    if (!handler || typeof handler.refresh !== "function") return

    const result = handler.refresh()

    if (result && typeof result.catch === "function") {
      result.catch(err => {
        console.log("PRESENTER REFRESH ASYNC ERROR:", err)
      })
    }

    if (typeof handler.afterRefresh === "function") {
      handler.afterRefresh()
    }

    if (typeof refreshPresenterEnhancements === "function") {
      refreshPresenterEnhancements()
    }
  } catch (err) {
    console.log("PRESENTER REFRESH CURRENT SEGMENT ERROR:", err)
  }
}

function isPresenterPanelReadyForSegment(segment) {
  const panel = document.getElementById("presenterPanel")
  if (!panel) return false

  const normalized = normalizePresenterSegmentFromSession(segment)
  const currentRendered = panel.dataset.segment || ""
  const panelText = panel.innerText || ""

  const panelIsEmpty =
    !panel.innerHTML.trim() ||
    panelText.includes("جارٍ التحميل") ||
    panelText.includes("حدث خطأ في تحميل الفقرة")

  return currentRendered === normalized && !panelIsEmpty
}

async function renderPresenterSegmentShell(segment) {
  const panel = document.getElementById("presenterPanel")
  if (!panel) return

  const normalized = normalizePresenterSegmentFromSession(segment)

  showPresenterSegmentPage()

  const title = document.getElementById("presenterSegmentTitle")

  if (title) {
    title.innerText =
      normalized === "final"
        ? getPresenterFinalRoundTitle(getPresenterFinalRound())
        : getPresenterSegmentName(normalized)
  }

  panel.dataset.segment = normalized
  panel.innerHTML = `
    <section class="presenterCard">
      ${getPresenterLoadingMarkup("جارٍ تحميل الفقرة...")}
    </section>
  `
}

async function openPresenterSegmentFromSync(segment) {
  segment = normalizePresenterSegmentFromSession(segment)

  const panel = document.getElementById("presenterPanel")
  if (!panel || !segment) return

  loadPresenterVisibleSegments().catch(() => null)

  let visibilityKey = segment

  if (segment === "final") {
    visibilityKey = `final_round${Number(getPresenterFinalRound() || 1)}`
  }

  if (!isPresenterSegmentVisible(visibilityKey)) {
    showToast("هذه الفقرة معطلة من الأدمن")
    presenterSegment = null
    presenterSelectedTeam = null
    renderPresenterHome()
    return
  }

  if (isPresenterSegmentLocked(visibilityKey)) {
    showToast("هذه الفقرة منتهية")
    presenterSegment = null
    presenterSelectedTeam = null
    renderPresenterHome()
    return
  }

  const handler = getPresenterSegmentHandler(segment)

  if (!handler || typeof handler.render !== "function") {
    console.error(
      "PRESENTER SEGMENT MODULE IS NOT READY:",
      segment
    )

    panel.innerHTML = `
      <section class="presenterCard">
        <div class="presenterLabel">
          ملف الفقرة غير محمّل
        </div>

        <button
          type="button"
          class="presenterBtn gray"
          onclick="presenterGoHome()"
        >
          رجوع للرئيسية
        </button>
      </section>
    `
    return
  }

  if (isPresenterPanelReadyForSegment(segment)) {
    refreshPresenterCurrentSegmentFromState()
    return
  }

  await renderPresenterSegmentShell(segment)

  try {
    const result = handler.render()

    if (result && typeof result.then === "function") {
      await result
    }

    panel.dataset.segment = segment

    if (typeof handler.afterRender === "function") {
      handler.afterRender()
    }

    refreshPresenterCurrentSegmentFromState()
  } catch (err) {
    console.log("Presenter render error:", err)

    panel.innerHTML = `
      <section class="presenterCard">
        <div class="presenterLabel">
          حدث خطأ في تحميل الفقرة
        </div>

        <button
          class="presenterBtn gray"
          onclick="presenterGoHome()"
        >
          رجوع للرئيسية
        </button>
      </section>
    `
  }
}

function applyPresenterSessionData(data) {
  if (!data) return

  if (data.status === "ended") {
    renderPresenterEnded()
    return
  }

  const rawNextSegment = data.active_segment || null
  const nextSegment = normalizePresenterSegmentFromSession(rawNextSegment)

  if (
  isPresenterLocalSyncProtected() &&
  presenterSegment &&
  !nextSegment
) {
  return
}

if (
  isPresenterLocalSyncProtected() &&
  presenterLocalOpenedSegment &&
  nextSegment &&
  normalizePresenterSegmentFromSession(presenterLocalOpenedSegment) !== nextSegment
) {
  return
}

  const nextFinalRound = getPresenterFinalRoundFromSessionSegment(
    rawNextSegment,
    data.state?.final?.round || presenterFinalRound || 1
  )

  const oldSegment = presenterSegment
  const oldSessionId = presenterSessionId
  const segmentChanged = oldSegment !== nextSegment

  presenterSessionId = data.id
  presenterModel = Number(data.model || 1)
  presenterTeamAName = data.team_a || "الفريق الأول"
  presenterTeamBName = data.team_b || "الفريق الثاني"

  let incomingState = data.state || {}

  if (nextSegment === "final") {
    let roundToUse = Number(nextFinalRound || 1)

    if (
      presenterFinalForcedRound &&
      Date.now() < presenterFinalForcedRoundUntil
    ) {
      roundToUse = Number(presenterFinalForcedRound)
    }

    presenterFinalRound = roundToUse
    presenterFinalRoundOverride = roundToUse

    incomingState = {
      ...incomingState,
      final: {
        ...(incomingState.final || {}),
        round: roundToUse
      }
    }
  } else {
    presenterFinalForcedRound = null
    presenterFinalForcedRoundUntil = 0
    presenterFinalRoundOverride = null
  }

  presenterLiveState = incomingState
  presenterSegment = nextSegment

  syncPresenterSelectedTeamFromDisplayState()
  updatePresenterHomeScoresOnly()
  updatePresenterLockedSegments()

  if (presenterJustJoined) {
    presenterJustJoined = false
    presenterSegment = null
    renderPresenterHome()
    return
  }

  if (presenterGoingHome) {
    if (!nextSegment) {
      presenterGoingHome = false
      presenterSegment = null
      presenterSelectedTeam = null
      renderPresenterHome()
      return
    }

    return
  }

  const toast = presenterLiveState?.toast

  if (toast?.text && toast?.time && toast.time !== lastPresenterToastTime) {
    lastPresenterToastTime = toast.time
    showToast(toast.text)
  }

  if (!presenterSegment) {
    presenterSelectedTeam = null
    renderPresenterHome()
    return
  }

  const currentLockKey =
    presenterSegment === "final"
      ? `final_round${Number(getPresenterFinalRound() || 1)}`
      : presenterSegment

  if (isPresenterSegmentLocked(currentLockKey)) {
    showToast("هذه الفقرة منتهية")
    presenterSegment = null
    presenterSelectedTeam = null
    renderPresenterHome()
    return
  }

  if (
    segmentChanged ||
    oldSessionId !== data.id ||
    !isPresenterPanelReadyForSegment(presenterSegment)
  ) {
    openPresenterSegmentFromSync(presenterSegment)
    return
  }

  refreshPresenterCurrentSegmentFromState()
}

async function markPresenterStartedSession(
  sessionId
) {
  if (!sessionId) return false

  const result =
    await updatePresenterSessionSafely(
      {
        state: {
          presenterStarted: true,
          presenterStartedAt:
            new Date().toISOString()
        }
      },
      {
        sessionId,
        applySession: false
      }
    )

  if (result.error) {
    console.log(
      "MARK PRESENTER STARTED ERROR:",
      result.error
    )

    return false
  }

  return true
}

async function fetchPresenterSessionNow(sessionId, forceApply = false) {
  if (!sessionId || !window.db) return

  try {
    const { data, error } = await db
      .from("game_sessions")
      .select(PRESENTER_SESSION_SELECT)
      .eq("id", sessionId)
      .maybeSingle()

    if (error || !data) {
      console.log("PRESENTER SESSION FETCH ERROR:", error)
      return
    }

    const nextKey = getPresenterSessionStateKey(data)

    if (!forceApply && nextKey === presenterLastSessionStateKey) {
      return
    }

    presenterLastSessionStateKey = nextKey
    applyPresenterSessionData(data)
  } catch (err) {
    console.log("PRESENTER SESSION FETCH CATCH:", err)
  }
}

function subscribeToGameSession(sessionId) {
  presenterSessionId = sessionId

  if (presenterChannel) {
    db.removeChannel(presenterChannel)
    presenterChannel = null
  }

  if (presenterSyncTimer) {
    clearInterval(presenterSyncTimer)
    presenterSyncTimer = null
  }

  presenterLastSessionStateKey = ""
  presenterChannelHealthy = false

  presenterChannel = db.channel("game_session_" + sessionId, {
    config: {
      broadcast: { self: false, ack: true }
    }
  })

  presenterChannel
    .on(
      "broadcast",
      { event: "session_state" },
      payload => {
        const data = payload?.payload
        if (!data) return

        presenterLastSessionStateKey = getPresenterSessionStateKey(data)
        applyPresenterSessionData(data)
      }
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "game_sessions",
        filter: `id=eq.${sessionId}`
      },
      payload => {
        const data = payload?.new
        if (!data) return

        presenterLastSessionStateKey = getPresenterSessionStateKey(data)
        applyPresenterSessionData(data)
      }
    )
    .subscribe(status => {
      console.log("PRESENTER SESSION CHANNEL:", status)

      if (status === "SUBSCRIBED") {
        presenterChannelHealthy = true
        fetchPresenterSessionNow(sessionId, true)
      }

      if (
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT" ||
        status === "CLOSED"
      ) {
        presenterChannelHealthy = false

        setTimeout(() => {
          if (presenterSessionId === sessionId) {
            subscribeToGameSession(sessionId)
          }
        }, 1000)
      }
    })

  presenterSyncTimer = setInterval(() => {
    if (document.hidden) return
    if (presenterChannelHealthy) return
    fetchPresenterSessionNow(sessionId, false)
  }, 2000)
}


function renderPresenterEnded() {
  presenterDeferredPreloadToken += 1
  setPresenterBackgroundLoading(false)
  hidePresenterBootLoading()

  localStorage.removeItem("presenter_session_id")
  localStorage.removeItem("presenter_join_code")

  presenterSessionId = null
  presenterSegment = null
  presenterSelectedTeam = null
  presenterLiveState = null

  showPresenterJoin()

  const status = document.getElementById("presenterJoinStatus")

  if (status) {
    status.innerText = "انتهت اللعبة — أدخل كود جديد"
  }
}

/* =========================
   HOME / NAVIGATION - CLEAN BASE
========================= */

function getPresenterTotalScores() {
  const s = presenterLiveState || {}

  if (s.mainScores) {
    return {
      A: Number(s.mainScores.A || 0),
      B: Number(s.mainScores.B || 0)
    }
  }

  return { A: 0, B: 0 }
}

function renderPresenterHome() {
  showPresenterHomePage()

  const scores = getPresenterTotalScores()

  const teamA = document.getElementById("presenterHomeTeamA")
  const teamB = document.getElementById("presenterHomeTeamB")
  const scoreA = document.getElementById("presenterHomeScoreA")
  const scoreB = document.getElementById("presenterHomeScoreB")
  const title = document.getElementById("presenterTitle")
  const subtitle = document.getElementById("presenterSubtitle")
  const panel = document.getElementById("presenterPanel")

  if (teamA) teamA.innerText = presenterTeamAName
  if (teamB) teamB.innerText = presenterTeamBName
  if (scoreA) scoreA.innerText = scores.A
  if (scoreB) scoreB.innerText = scores.B

  if (title) title.innerText = "لوحة المقدم"

  const modelName = presenterLiveState?.currentModelName || ""

  if (subtitle) {
    subtitle.innerHTML = presenterSessionId
      ? `<span class="presenterOnlineDot">✅</span><span class="presenterModelName">${modelName || "بدون اسم نموذج"}</span>`
      : `<span class="presenterOfflineDot">❌</span><span class="presenterModelName">غير متصل</span>`
  }

  if (panel) {
    panel.dataset.segment = ""
  }

  renderPresenterSegmentsGrid()
    .then(() => {
      updatePresenterLockedSegments()
      schedulePresenterDeferredPreload()
    })
    .catch(error => {
      console.log("RENDER PRESENTER SEGMENTS ERROR:", error)
    })

  ensurePresenterInsideModeSwitch()
}

function updatePresenterHomeScoresOnly() {
  const scores = getPresenterTotalScores()

  const scoreA = document.getElementById("presenterHomeScoreA")
  const scoreB = document.getElementById("presenterHomeScoreB")

  if (scoreA) scoreA.innerText = scores.A
  if (scoreB) scoreB.innerText = scores.B
}

function updatePresenterLockedSegments() {
  document
    .querySelectorAll("#presenterSegmentsGrid .segmentCard")
    .forEach(card => {
      const key = card.dataset.segment
      if (!key) return

      const isLocked = isPresenterSegmentLocked(key)

      card.classList.toggle("presenterLockedSegment", isLocked)
      card.disabled = isLocked
    })
}

async function presenterGoHome() {
  presenterGoingHome = true
  presenterSegment = null
  presenterSelectedTeam = null

  markPresenterLocalSync(null, 1200)
  renderPresenterHome()

  const sent = await sendCommand("goHome", {
    segment: null
  })

  if (!sent) {
    presenterGoingHome = false
    showToast("تعذر الرجوع للرئيسية")
    return
  }

  const sessionId =
    localStorage.getItem("presenter_session_id")

  if (sessionId) {
    const result =
      await updatePresenterSessionSafely(
        {
          active_segment: null
        },
        {
          sessionId,
          applySession: false
        }
      )

    if (result.error) {
      console.log(
        "GO HOME SAFE UPDATE ERROR:",
        result.error
      )
    }
  }

  setTimeout(() => {
    presenterGoingHome = false
  }, 500)
}

async function openPresenterSegment(segment) {
  segment = normalizePresenterSegmentKey(segment)

  loadPresenterVisibleSegments().catch(() => null)

  if (!isPresenterSegmentVisible(segment)) {
    showToast("هذه الفقرة معطلة من الأدمن")
    renderPresenterHome()
    return
  }

  if (isPresenterSegmentLocked(segment)) {
    showToast("هذه الفقرة منتهية")
    return
  }

  presenterSelectedTeam = null
  presenterSegment = normalizePresenterSegmentFromSession(segment)

  markPresenterLocalSync(presenterSegment, 1400)

  await renderPresenterSegmentShell(presenterSegment)
  await openPresenterSegmentFromSync(presenterSegment)

  const sent = await sendCommand("openSegment", { segment })

  if (!sent) {
    showToast("تعذر فتح الفقرة في العرض")
  }
}

async function openPresenterFinalCard(round) {
  round = Number(round || 1)

  const finalKey = `final_round${round}`

  loadPresenterVisibleSegments().catch(() => null)

  if (!isPresenterSegmentVisible(finalKey)) {
    showToast("هذه الفقرة معطلة من الأدمن")
    renderPresenterHome()
    return
  }

  if (isPresenterSegmentLocked(finalKey)) {
    showToast("هذه الفقرة منتهية")
    renderPresenterHome()
    return
  }

  presenterSelectedTeam = null
  presenterSegment = "final"
  presenterFinalRound = round
  presenterFinalForcedRound = round
  presenterFinalForcedRoundUntil = Date.now() + 60000
  presenterFinalRoundOverride = round
  presenterFinalSelected = { round, number: null }

  presenterLiveState = {
    ...(presenterLiveState || {}),
    final: {
      ...(presenterLiveState?.final || {}),
      round
    }
  }

  markPresenterLocalSync("final", 1600)

  await renderPresenterSegmentShell("final")
  await openPresenterSegmentFromSync("final")

  forcePresenterFinalRound(round).catch(error => {
    console.log(
      "FORCE FINAL ROUND BACKGROUND ERROR:",
      error
    )
  })

  sendCommand("openSegment", {
    segment: "final",
    round
  }).then(sent => {
    if (!sent) {
      showToast("تعذر فتح الفاصلة في العرض")
    }
  }).catch(error => {
    console.log(
      "OPEN FINAL SEGMENT ERROR:",
      error
    )
    showToast("تعذر فتح الفاصلة في العرض")
  })
}

async function forcePresenterFinalRound(round) {
  round = Math.min(
    Math.max(Number(round || 1), 1),
    4
  )

  presenterSegment = "final"
  presenterFinalRound = round
  presenterFinalForcedRound = round
  presenterFinalForcedRoundUntil =
    Date.now() + 30000
  presenterFinalRoundOverride = round

  presenterFinalSelected = {
    round,
    number: null
  }

  presenterLiveState = {
    ...(presenterLiveState || {}),
    final: {
      ...(presenterLiveState?.final || {}),
      round
    }
  }

  const sessionId =
    localStorage.getItem(
      "presenter_session_id"
    )

  if (!sessionId) return false

  const result =
    await updatePresenterSessionSafely(
      {
        active_segment:
          getPresenterFinalSessionSegmentKey(
            round
          ),

        state: {
          final: {
            round
          }
        }
      },
      {
        sessionId,
        applySession: false
      }
    )

  if (result.error) {
    console.log(
      "FORCE FINAL ROUND SAFE ERROR:",
      result.error
    )

    return false
  }

  return true
}

/* =========================
   SHARED UI / TEAM SYNC - CLEAN BASE
========================= */

function getPresenterActiveTeamFromState() {
  if (presenterSegment === "warmup") {
    return (
      presenterLiveState?.warmup?.warmupState?.activeTeam ||
      presenterLiveState?.warmup?.selectedTeam ||
      presenterLiveState?.warmup?.activeTeam ||
      null
    )
  }

  if (presenterSegment === "top10") {
    return (
      presenterLiveState?.top10?.top10State?.activeTeam ||
      presenterLiveState?.top10?.activeTeam ||
      null
    )
  }

  if (presenterSegment === "auction") {
    return (
      presenterLiveState?.auction?.auctionState?.activeTeam ||
      presenterLiveState?.auction?.activeTeam ||
      null
    )
  }

  if (presenterSegment === "who") {
    return (
      presenterLiveState?.who?.whoState?.activeTeam ||
      presenterLiveState?.who?.activeTeam ||
      null
    )
  }

  if (presenterSegment === "explain") {
    return (
      presenterLiveState?.explain?.explainState?.currentTeam ||
      presenterLiveState?.explain?.explainState?.activeTeam ||
      presenterLiveState?.explain?.activeTeam ||
      null
    )
  }

  if (presenterSegment === "archive") {
    return (
      presenterLiveState?.archive?.archiveState?.activeTeam ||
      presenterLiveState?.archive?.activeTeam ||
      null
    )
  }

  if (presenterSegment === "randomChallenge") {
    return (
      presenterLiveState?.randomChallenge?.box3?.activeTeam ||
      presenterLiveState?.randomChallenge?.activeTeam ||
      null
    )
  }

  if (presenterSegment === "final") {
    const round = Number(
      presenterLiveState?.final?.round ||
      presenterFinalRound ||
      1
    )

    if (round === 1) {
      return (
        presenterLiveState?.final?.round1?.activeTeam ||
        presenterLiveState?.final?.activeTeam ||
        null
      )
    }

    if (round === 2) {
      return (
        presenterLiveState?.final?.round2?.activeTeam ||
        presenterLiveState?.final?.activeTeam ||
        null
      )
    }

    if (round === 3) {
      return (
        presenterLiveState?.final?.round3?.activeTeam ||
        presenterLiveState?.final?.activeTeam ||
        null
      )
    }

    if (round === 4) {
      return (
        presenterLiveState?.final?.round4?.teamMedia?.currentTeam ||
        presenterLiveState?.final?.round4?.activeTeam ||
        presenterLiveState?.final?.activeTeam ||
        null
      )
    }
  }

  return null
}

function getPresenterFinalTeamForRound(round = getPresenterFinalRound()) {
  return getPresenterActiveTeamFromState()
}

function updatePresenterTeamButtonsOnly(team) {
  const cleanTeam =
    team === "A" || team === "B"
      ? team
      : null

  const teamA = document.getElementById("teamA")
  const teamB = document.getElementById("teamB")

  if (teamA) {
    teamA.classList.toggle("selectedPresenterTeam", cleanTeam === "A")
    teamA.classList.toggle("activeTeam", cleanTeam === "A")
  }

  if (teamB) {
    teamB.classList.toggle("selectedPresenterTeam", cleanTeam === "B")
    teamB.classList.toggle("activeTeam", cleanTeam === "B")
  }
}

function syncPresenterSelectedTeamFromDisplayState() {
  const syncedTeam = getPresenterActiveTeamFromState()

  presenterSelectedTeam =
    syncedTeam === "A" || syncedTeam === "B"
      ? syncedTeam
      : null

  updatePresenterTeamButtonsOnly(presenterSelectedTeam)
}

function teamButtons() {
  const activeTeam = getPresenterActiveTeamFromState()

  return `
    <div class="presenterTeams">
      <button
        class="presenterBtn orange ${activeTeam === "A" ? "selectedPresenterTeam activeTeam" : ""}"
        onclick="selectTeam('A')"
        id="teamA"
        type="button"
      >
        ${presenterTeamAName}
      </button>

      <button
        class="presenterBtn orange ${activeTeam === "B" ? "selectedPresenterTeam activeTeam" : ""}"
        onclick="selectTeam('B')"
        id="teamB"
        type="button"
      >
        ${presenterTeamBName}
      </button>
    </div>
  `
}

function setPresenterLocalActiveTeam(team) {
  if (team !== "A" && team !== "B") return

  const s = presenterLiveState || {}

  if (presenterSegment === "warmup") {
    presenterLiveState = {
      ...s,
      warmup: {
        ...(s.warmup || {}),
        activeTeam: team,
        selectedTeam: team,
        warmupState: {
          ...(s.warmup?.warmupState || {}),
          activeTeam: team
        }
      }
    }
    return
  }

  if (presenterSegment === "top10") {
    presenterLiveState = {
      ...s,
      top10: {
        ...(s.top10 || {}),
        activeTeam: team,
        top10State: {
          ...(s.top10?.top10State || {}),
          activeTeam: team
        }
      }
    }
    return
  }

  if (presenterSegment === "auction") {
    presenterLiveState = {
      ...s,
      auction: {
        ...(s.auction || {}),
        activeTeam: team,
        auctionState: {
          ...(s.auction?.auctionState || {}),
          activeTeam: team
        }
      }
    }
    return
  }

  if (presenterSegment === "who") {
    presenterLiveState = {
      ...s,
      who: {
        ...(s.who || {}),
        activeTeam: team,
        whoState: {
          ...(s.who?.whoState || {}),
          activeTeam: team
        }
      }
    }
    return
  }

  if (presenterSegment === "explain") {
    presenterLiveState = {
      ...s,
      explain: {
        ...(s.explain || {}),
        activeTeam: team,
        currentTeam: team,
        explainState: {
          ...(s.explain?.explainState || {}),
          activeTeam: team,
          currentTeam: team
        }
      }
    }
    return
  }

  if (presenterSegment === "archive") {
    presenterLiveState = {
      ...s,
      archive: {
        ...(s.archive || {}),
        activeTeam: team,
        archiveState: {
          ...(s.archive?.archiveState || {}),
          activeTeam: team
        }
      }
    }
    return
  }

  if (presenterSegment === "randomChallenge") {
    presenterLiveState = {
      ...s,
      randomChallenge: {
        ...(s.randomChallenge || {}),
        activeTeam: team,
        box3: {
          ...(s.randomChallenge?.box3 || {}),
          activeTeam:
            Number(s.randomChallenge?.currentBox || 0) === 3
              ? team
              : s.randomChallenge?.box3?.activeTeam || null
        }
      }
    }
    return
  }

  if (presenterSegment === "final") {
    const round = Number(getPresenterFinalRound() || 1)

    presenterLiveState = {
      ...s,
      final: {
        ...(s.final || {}),
        activeTeam: team,
        round,
        [`round${round}`]: {
          ...(s.final?.[`round${round}`] || {}),
          activeTeam: team,
          currentTeam: team,
          teamMedia:
            round === 4
              ? {
                  ...(s.final?.round4?.teamMedia || {}),
                  currentTeam: team
                }
              : s.final?.[`round${round}`]?.teamMedia
        }
      }
    }
  }
}

async function selectTeam(team) {
  if (team !== "A" && team !== "B") return

  presenterSelectedTeam = team
  setPresenterLocalActiveTeam(team)
  updatePresenterTeamButtonsOnly(team)
  markPresenterLocalSync(presenterSegment, 900)

  if (presenterSegment === "randomChallenge") {
    document.querySelectorAll(".presenterRandomTeamName").forEach((box, index) => {
      const boxTeam = index === 0 ? "A" : "B"
      box.classList.toggle("active", boxTeam === team)
    })
  }

  const sent = await sendCommand("selectTeam", {
    team,
    segment: presenterSegment || null,
    round: presenterSegment === "final" ? getPresenterFinalRound() : null
  })

  if (!sent) {
    syncPresenterSelectedTeamFromDisplayState()
    showToast("تعذر اختيار الفريق")
  }
}

/* =========================
   Presenter Button Guard - CLEAN
========================= */

let presenterActionLocks = new Map()

function getPresenterCurrentNumberForLock() {
  if (presenterSegment === "warmup") {
    return presenterLiveState?.warmup?.currentWarmupQuestionKey || ""
  }

  if (presenterSegment === "top10") {
    const top10 = presenterLiveState?.top10?.top10State || {}
    return `${top10.round || ""}_${top10.currentNumber || ""}_${top10.question?.[top10.round] || ""}`
  }

  if (presenterSegment === "auction") {
    return presenterLiveState?.auction?.auctionState?.currentQuestionNumber || ""
  }

  if (presenterSegment === "who") {
    return presenterLiveState?.who?.currentNumber || ""
  }

  if (presenterSegment === "explain") {
    return presenterLiveState?.explain?.explainState?.currentNumber || ""
  }

  if (presenterSegment === "archive") {
    const archive = presenterLiveState?.archive?.archiveState || {}
    return archive.round || ""
  }

  if (presenterSegment === "randomChallenge") {
    const random = presenterLiveState?.randomChallenge || {}
    return `${random.currentBox || ""}_${random.box1?.pool || ""}_${random.box2?.numberInput || ""}_${random.box3?.activeTeam || ""}`
  }

  if (presenterSegment === "final") {
    const final = presenterLiveState?.final || {}
    const round = Number(final.round || presenterFinalRound || 1)

    if (round === 1) return `r1_${final.round1?.currentNumber || ""}`
    if (round === 2) return `r2_${final.round2?.currentNumber || ""}`
    if (round === 3) return `r3_${final.round3?.currentNumber || ""}`
    if (round === 4) {
      return `r4_${final.round4?.teamMedia?.currentNumber || final.round4?.currentNumber || ""}`
    }
  }

  return ""
}


function getPresenterActionLockTime(action) {

    if (action === "selectTeam") return 120
 
const fastActions = [
  "toggleRound2Correct",
  "toggleRound2ImageCorrect",
  "hideRound2SequenceWord",
  "randomBox3ScorePoints",
  "randomBox3SwitchTeam",
  "randomBox3Pass",
  "showStoryPart",
  "showNextImage",
  "showAnswer",
  "switchTurn",
  "randomSetAuctionPoints",
  "decreaseCountdown",
  "showQuestion",
  "playCurrentFinalVideo",
  "restartCurrentFinalVideo",
  "restartCurrentFinalImage",
  "stopCurrentFinalVideo"
]

  if (fastActions.includes(action)) return 120

  const scoreActions = [
    "correct",
    "wrong",
    "recordRound3Score",
    "recordScrambleScore",
    "recordSequenceScore",
    "recordImageScore",
    "randomBox3Wrong",
    "randomFinishBox",
    "finishSegment",
    "endRound"
  ]

  if (scoreActions.includes(action)) return 1300

  const mediumActions = [
    "openNumber",
    "randomOpenBox",
    "randomStartBox1",
    "randomStartBox2Timer",
    "startTimer",
    "double",
    "nextRound",
    "setRound",
    "openSegment",
    "goHome"
  ]

  if (mediumActions.includes(action)) return 800

  if (action === "undo") return 600

  return 450
}

function getPresenterActionLockKey(action, payload = {}) {
  const segment = presenterSegment || "global"

  if (action === "openSegment") {
    return `${segment}_${action}_${payload.segment || ""}_${payload.round || ""}`
  }

  if (action === "openNumber") {
    return [
      segment,
      action,
      payload.round || "",
      payload.category || "",
      payload.number || ""
    ].join("_")
  }

  if (action === "randomOpenBox") {
    return `${segment}_${action}_${payload.box || ""}`
  }

  if (action === "randomStartBox1") {
    return `${segment}_${action}_${payload.pool || "saudi"}`
  }

  if (
    action === "correct" ||
    action === "wrong" ||
    action === "double" ||
    action === "startTimer" ||
    action === "randomBox3Wrong" ||
    action === "randomFinishBox"
  ) {
    return `${segment}_${action}_${getPresenterCurrentNumberForLock()}`
  }

  if (
    action === "toggleRound2Correct" ||
    action === "toggleRound2ImageCorrect" ||
    action === "hideRound2SequenceWord"
  ) {
    return `${segment}_${action}_${payload.number || ""}_${payload.index || ""}`
  }

  if (action === "randomBox3ScorePoints") {
    return `${segment}_${action}_${payload.points || ""}_${getPresenterCurrentNumberForLock()}`
  }

  if (action === "undo") {
    return `${segment}_${action}_${Date.now()}`
  }

  return `${segment}_${action}_${JSON.stringify(payload || {})}`
}

function lockPresenterActionButton(action, payload = {}) {
  const key = getPresenterActionLockKey(action, payload)
  const now = Date.now()
  const lockTime = getPresenterActionLockTime(action)
  const lastTime = presenterActionLocks.get(key) || 0

  if (now - lastTime < lockTime) {
    return false
  }

  presenterActionLocks.set(key, now)

  if (presenterActionLocks.size > 120) {
    presenterActionLocks = new Map(
      Array.from(presenterActionLocks.entries()).slice(-60)
    )
  }

  return true
}
async function sendCommand(action, payload = {}) {
  if (!lockPresenterActionButton(action, payload)) {
    return false
  }

  const sessionId =
    localStorage.getItem("presenter_session_id")

  if (!sessionId) {
    showToast("ادخل كود الجلسة أولاً")
    return false
  }

  if (!window.db) {
    showToast("الاتصال غير جاهز")
    return false
  }

  const clientCommandId =
    `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

  const command = {
    session_id: sessionId,
    model: Number(presenterModel || 1),
    segment: presenterSegment || "global",
    action,

    payload: {
      ...payload,
      __client_command_id: clientCommandId
    },

    created_at: new Date().toISOString()
  }

  /* المسار السريع فقط */
  if (
    presenterChannel &&
    presenterChannelHealthy
  ) {
    try {
      const result =
        await presenterChannel.send({
          type: "broadcast",
          event: "presenter_command",
          payload: command
        })

      if (result !== "error") {
        return true
      }
    } catch (error) {
      console.log(
        "PRESENTER BROADCAST ERROR:",
        error
      )
    }
  }

  /* قاعدة البيانات تستخدم فقط عند فشل Realtime */
  try {
    const { error } = await db
      .from("presenter_commands")
      .insert(command)

    if (error) {
      console.log(
        "PRESENTER COMMAND FALLBACK ERROR:",
        error
      )

      showToast("تعذر تنفيذ الأمر")
      return false
    }

    return true
  } catch (error) {
    console.log(
      "PRESENTER COMMAND FALLBACK CATCH:",
      error
    )

    showToast("تعذر تنفيذ الأمر")
    return false
  }
}

/* =========================
   TOAST
========================= */

let presenterToastTimer = null
let presenterToastHideTimer = null

function showToast(text) {
  const t = document.getElementById("presenterToast")
  const textBox = document.getElementById("presenterToastText")
  const iconBox = t?.querySelector(".gameToastIcon")

  if (!t) return

  clearTimeout(presenterToastTimer)
  clearTimeout(presenterToastHideTimer)

  const msg = String(text || "")

  if (textBox) textBox.innerText = msg
  else t.innerText = msg

  t.classList.remove(
    "hidden",
    "show",
    "presenterToastSuccess",
    "presenterToastError"
  )

  if (
    msg.includes("خطأ") ||
    msg.includes("غير صحيح") ||
    msg.includes("تعذر") ||
    msg.includes("مقفل") ||
    msg.includes("انتهت") ||
    msg.includes("أولاً")
  ) {
    t.classList.add("presenterToastError")
    if (iconBox) iconBox.innerText = "!"
  } else if (
    msg.includes("تم") ||
    msg.includes("صح") ||
    msg.includes("نجاح") ||
    msg.includes("صحيحة")
  ) {
    t.classList.add("presenterToastSuccess")
    if (iconBox) iconBox.innerText = "✓"
  } else {
    if (iconBox) iconBox.innerText = "!"
  }

  void t.offsetWidth

  requestAnimationFrame(() => {
    t.classList.add("show")
  })

  presenterToastTimer = setTimeout(() => {
    t.classList.remove("show")

    presenterToastHideTimer = setTimeout(() => {
      t.classList.add("hidden")
      t.classList.remove("presenterToastSuccess", "presenterToastError")

      if (textBox) textBox.innerText = ""
      if (iconBox) iconBox.innerText = "!"
    }, 180)
  }, 1600)
}


let presenterDisplayControlsHidden = false

function updateDisplayControlsEyeButton(isHidden) {
  const btn = document.getElementById("displayControlsEyeBtn")
  if (!btn) return

  btn.innerText = isHidden ? "إظهار التحكم" : "إخفاء التحكم"
  btn.classList.toggle("showControlsMode", isHidden)
  btn.classList.toggle("hideControlsMode", !isHidden)
  btn.title = isHidden ? "إظهار أزرار التحكم" : "إخفاء أزرار التحكم"
}

function togglePresenterDisplayControls() {
  presenterDisplayControlsHidden = !presenterDisplayControlsHidden
  updateDisplayControlsEyeButton(presenterDisplayControlsHidden)
  sendCommand("toggleDisplayControls")
}

/* =========================
   EXTERNAL SEGMENT MODULES
========================= */

/*
  تم نقل منطق الفقرات التالية إلى ملفات مستقلة:
  - التسخين
  - Top 10
  - من هو
  - اشرح الكلمة
  - حرفلي
  - فتبلة
  - التحدي

  يبقى presenter.js مسؤولًا عن التوجيه والمزامنة والدوال المشتركة.
*/

/* =========================
   EXTERNAL SEGMENT MODULES
   FINAL + ARCHIVE
   تم نقل المنطق بالكامل إلى:
   - final-segments.js
   - archive-segments.js
========================= */

/* =========================
   READER MODE - دليل الأسئلة فقط
========================= */

/* =========================
   READER CACHE
========================= */

const presenterReaderHtmlCache = new Map()

function getPresenterReaderCacheKey(segment) {
  const model = Number(presenterModel || 0)
  const key = normalizePresenterFinalSegmentKey(
    normalizePresenterSegmentKey(segment)
  )

  return `${model}_${key}`
}

function getPresenterReaderStorageKey(segment) {
  return getPresenterResourceCacheKey(
    "reader_html",
    [getPresenterReaderCacheKey(segment)]
  )
}

function getPresenterReaderCachedHtml(segment) {
  const key = getPresenterReaderCacheKey(segment)
  const memoryValue = presenterReaderHtmlCache.get(key)

  if (
    memoryValue?.html &&
    Date.now() - Number(memoryValue.savedAt || 0) <=
      PRESENTER_READER_CACHE_TTL
  ) {
    return memoryValue.html
  }

  const cached = readPresenterResourceCache(
    getPresenterReaderStorageKey(segment),
    PRESENTER_READER_CACHE_TTL
  )

  const html = String(cached?.data?.html || "")

  if (html) {
    presenterReaderHtmlCache.set(key, {
      html,
      savedAt: Number(cached.savedAt || Date.now())
    })
  }

  return html
}

function savePresenterReaderCachedHtml(segment, html) {
  if (!html) return

  const key = getPresenterReaderCacheKey(segment)
  const payload = {
    html,
    savedAt: Date.now()
  }

  presenterReaderHtmlCache.set(key, payload)
  savePresenterResourceCache(
    getPresenterReaderStorageKey(segment),
    { html }
  )
}

function clearPresenterReaderCache(segment = null) {
  if (!segment) {
    presenterReaderHtmlCache.clear()

    const prefix = getPresenterResourceCacheKey(
      "reader_html"
    )

    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index)
      if (key?.startsWith(prefix)) {
        removePresenterResourceCache(key)
      }
    }

    return
  }

  presenterReaderHtmlCache.delete(
    getPresenterReaderCacheKey(segment)
  )

  removePresenterResourceCache(
    getPresenterReaderStorageKey(segment)
  )
}

function normalizePresenterReaderSegmentKey(segment) {
  return normalizePresenterFinalSegmentKey(
    normalizePresenterSegmentKey(segment)
  )
}

function presenterReaderLogout() {
  clearPresenterReaderCache()
  closeReaderMediaViewer()

  localStorage.removeItem("presenter_session_id")
  localStorage.removeItem("presenter_join_code")

  presenterSessionId = null
  presenterReaderSegment = null

  showPresenterJoin()
}

function presenterReaderGoHome() {
  presenterReaderSegment = null
  renderPresenterReaderHome()
}

function getPresenterReaderSegmentTitle(segment) {
  const key = normalizePresenterSegmentKey(segment)

  const item = ALL_PRESENTER_SEGMENTS.find(x => {
    return normalizePresenterSegmentKey(x.key) === key
  })

  return item?.title || "الفقرة"
}

function readerEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function readerId(parts = []) {
  return parts
    .map(x => String(x ?? "").replace(/[^a-zA-Z0-9_-]/g, "_"))
    .join("_")
}

function getReaderReadMap() {
  try {
    return JSON.parse(localStorage.getItem("presenter_reader_read_map") || "{}")
  } catch {
    return {}
  }
}

function saveReaderReadMap(map) {
  localStorage.setItem("presenter_reader_read_map", JSON.stringify(map || {}))
}

function isReaderItemRead(id) {
  const map = getReaderReadMap()
  return !!map[id]
}

function toggleReaderRead(id, el = null) {
  const map = getReaderReadMap()
  map[id] = !map[id]
  saveReaderReadMap(map)

  if (el) {
    el.classList.toggle("readerRead", !!map[id])
  }
}

function readerEmpty(text = "لا توجد بيانات") {
  return `
    <section class="readerEmptyCard">
      ${readerEscape(text)}
    </section>
  `
}

function readerMedia({ image = "", video = "" } = {}) {
  const cleanImage = String(image || "")
  const cleanVideo = String(video || "")

  if (cleanVideo) {
    return `
      <div
        class="readerMediaThumb readerVideoThumb"
        data-reader-media-type="video"
        data-reader-media-src="${readerEscape(cleanVideo)}"
        onclick="event.stopPropagation(); openReaderMediaFromElement(this)"
      >
        <video
          src="${readerEscape(cleanVideo)}"
          muted
          playsinline
          preload="metadata"
        ></video>

        <div class="readerMediaHint">
          اضغط للتكبير والتشغيل
        </div>
      </div>
    `
  }

  if (cleanImage) {
    return `
      <div
        class="readerMediaThumb readerImageThumb"
        data-reader-media-type="image"
        data-reader-media-src="${readerEscape(cleanImage)}"
        onclick="event.stopPropagation(); openReaderMediaFromElement(this)"
      >
        <img
          src="${readerEscape(cleanImage)}"
          alt=""
          loading="lazy"
        >

        <div class="readerMediaHint">
          اضغط للتكبير
        </div>
      </div>
    `
  }

  return `
    <div class="readerMediaThumb readerNoMedia">
      لا توجد صورة
    </div>
  `
}

function openReaderMediaFromElement(element) {
  if (!element) return

  const type =
    element.dataset.readerMediaType === "video"
      ? "video"
      : "image"

  const src = String(
    element.dataset.readerMediaSrc || ""
  )

  if (!src) return

  openReaderMediaViewer({
    type,
    src
  })
}

function ensureReaderMediaViewer() {
  let viewer = document.getElementById("readerMediaViewer")

  if (viewer) return viewer

  viewer = document.createElement("div")
  viewer.id = "readerMediaViewer"
  viewer.className = "readerMediaViewer hidden"

  viewer.innerHTML = `
    <div class="readerMediaViewerBackdrop" onclick="closeReaderMediaViewer()"></div>

    <div class="readerMediaViewerBox">
      <button
        type="button"
        class="readerMediaViewerClose"
        onclick="closeReaderMediaViewer()"
      >
        إغلاق
      </button>

      <div id="readerMediaViewerContent" class="readerMediaViewerContent"></div>
    </div>
  `

  document.body.appendChild(viewer)
  return viewer
}

function openReaderMediaViewer({ type = "image", src = "" } = {}) {
  const cleanSrc = String(src || "")
  if (!cleanSrc) return

  const viewer = ensureReaderMediaViewer()
  const content = document.getElementById("readerMediaViewerContent")

  if (!content) return

  if (type === "video") {
    content.innerHTML = `
      <video
        src="${readerEscape(cleanSrc)}"
        controls
        autoplay
        playsinline
      ></video>
    `
  } else {
    content.innerHTML = `
      <img src="${readerEscape(cleanSrc)}" alt="">
    `
  }

  viewer.classList.remove("hidden")
  document.body.classList.add("readerMediaViewerOpen")
}

function closeReaderMediaViewer() {
  const viewer = document.getElementById("readerMediaViewer")
  const content = document.getElementById("readerMediaViewerContent")

  if (content) {
    content.innerHTML = ""
  }

  if (viewer) {
    viewer.classList.add("hidden")
  }

  document.body.classList.remove("readerMediaViewerOpen")
}

function readerReadClass(id) {
  return isReaderItemRead(id) ? "readerRead" : ""
}

function readerMiniCard({
  id = "",
  number = "",
  title = "",
  question = "",
  answer = "",
  hint = "",
  image = "",
  video = "",
  parts = []
}) {
  return `
    <article
      class="readerMiniCard ${readerReadClass(id)}"
      onclick="toggleReaderRead('${readerEscape(id)}', this)"
    >
      <div class="readerMiniTop">
        <strong>${readerEscape(number)}</strong>
        <span>${readerEscape(title)}</span>
      </div>

      ${
        image || video
          ? readerMedia({ image, video })
          : ""
      }

      ${
        question
          ? `
            <div class="readerBlock">
              <label>السؤال</label>
              <p>${readerEscape(question)}</p>
            </div>
          `
          : ""
      }

      ${
        parts.length
          ? `
            <div class="readerPartsList">
              ${parts.map((part, index) => `
                <div class="readerPartItem">
                  <span>الجزء ${index + 1}</span>
                  <p>${readerEscape(part)}</p>
                </div>
              `).join("")}
            </div>
          `
          : ""
      }

      ${
        hint
          ? `
            <div class="readerBlock hint">
              <label>التلميح</label>
              <p>${readerEscape(hint)}</p>
            </div>
          `
          : ""
      }

      ${
        answer
          ? `
            <div class="readerBlock answer">
              <label>الإجابة</label>
              <p>${readerEscape(answer)}</p>
            </div>
          `
          : ""
      }
    </article>
  `
}

async function renderPresenterReaderHome() {
  showPresenterReaderHomePage()

  const grid = document.getElementById(
    "presenterReaderSegmentsGrid"
  )

  const subtitle = document.getElementById(
    "presenterReaderSubtitle"
  )

  if (subtitle) {
    const modelName = presenterLiveState?.currentModelName || ""
    subtitle.innerText = modelName
      ? `النموذج: ${modelName}`
      : `النموذج رقم ${presenterModel}`
  }

  if (!grid) return

  const paintReaderSegments = () => {
    applyPresenterCachedVisibilityNow()

    if (!presenterVisibleSegments.length) {
      applyPresenterVisibleSegments([], {})
    }

    if (!presenterVisibleSegments.length) {
      grid.innerHTML = `
        <section class="readerEmptyCard">
          لا توجد فقرات مفعلة حاليًا
        </section>
      `
      return
    }

    grid.innerHTML = presenterVisibleSegments.map(item => {
      const key = normalizePresenterSegmentKey(item.key)

      return `
        <button
          type="button"
          class="presenterReaderSegmentCard"
          onclick="openPresenterReaderSegment('${key}')"
        >
          <strong>${readerEscape(item.title)}</strong>
          <span>عرض الأسئلة والإجابات</span>
        </button>
      `
    }).join("")
  }

  paintReaderSegments()

  loadPresenterVisibleSegments()
    .then(() => paintReaderSegments())
    .catch(error => {
      console.log(
        "READER VISIBILITY FALLBACK:",
        error
      )
    })

  schedulePresenterDeferredPreload()
  ensurePresenterInsideModeSwitch()
}

async function openPresenterReaderSegment(segment) {
  segment = normalizePresenterReaderSegmentKey(segment)

  loadPresenterVisibleSegments().catch(() => null)

  if (!isPresenterSegmentVisible(segment)) {
    showToast("هذه الفقرة معطلة من الأدمن")
    await renderPresenterReaderHome()
    return
  }

  presenterReaderSegment = segment
  showPresenterReaderSegmentPage()

  const title = document.getElementById(
    "presenterReaderSegmentTitle"
  )

  const panel = document.getElementById(
    "presenterReaderPanel"
  )

  if (title) {
    title.innerText = getPresenterReaderSegmentTitle(segment)
  }

  if (!panel) return

  const cachedHtml = getPresenterReaderCachedHtml(segment)

  if (cachedHtml) {
    panel.innerHTML = cachedHtml
    return
  }

  panel.innerHTML = `
    <section class="readerLoadingCard">
      ${getPresenterLoadingMarkup("جارٍ تحميل البيانات...")}
    </section>
  `

  try {
    const externalReaders = {
      warmup: "renderPresenterReaderWarmup",
      top10: "renderPresenterReaderTop10",
      who: "renderPresenterReaderWho",
      explain: "renderPresenterReaderExplain",
      finalRound1: "renderPresenterReaderFinalRound1",
      finalRound2: "renderPresenterReaderFinalRound2",
      finalRound3: "renderPresenterReaderFinalRound3",
      finalRound4: "renderPresenterReaderFinalRound4"
    }

    if (segment === "letterli") {
      panel.innerHTML = readerEmpty(
        "فقرة حرفلي تعتمد على ملف Excel وأسئلة ثابتة"
      )
    } else if (segment === "randomChallenge") {
      panel.innerHTML = readerEmpty(
        "فقرة التحدي لا تحتوي على أسئلة من الأدمن"
      )
    } else if (segment === "auction") {
      await renderPresenterReaderAuction()
    } else if (segment === "archive") {
      await renderPresenterReaderArchive()
    } else {
      const reader = getPresenterModuleFunction(
        externalReaders[segment]
      )

      if (!reader) {
        panel.innerHTML = readerEmpty(
          "هذه الفقرة غير مدعومة في دليل الأسئلة"
        )
      } else {
        await reader()
      }
    }

    savePresenterReaderCachedHtml(
      segment,
      panel.innerHTML
    )
  } catch (err) {
    console.log("READER SEGMENT ERROR:", err)

    panel.innerHTML = readerEmpty(
      "تعذر تحميل بيانات الفقرة"
    )
  }
}

async function reloadPresenterReaderSegment() {
  if (!presenterReaderSegment) {
    clearPresenterReaderCache()
    await renderPresenterReaderHome()
    return
  }

  const segment =
    normalizePresenterReaderSegmentKey(
      presenterReaderSegment
    )

  clearPresenterReaderCache(segment)

  await openPresenterReaderSegment(segment)
}

/* =========================
   Reader: Top 10
   تم نقله إلى: top10-segments.js
========================= */

/* =========================
   Reader: Auction - فتبلة
   الرقم + الصورة/الفيديو مصغر + الإجابة فقط
========================= */

async function renderPresenterReaderAuction() {
  const panel = document.getElementById("presenterReaderPanel")
  if (!panel) return

  const rows = await loadPresenterAuctionRows({
    backgroundRefresh: false
  })

  if (!rows.length) {
    panel.innerHTML = readerEmpty("لا توجد أسئلة في فتبلة")
    return
  }

  panel.innerHTML = `
    <div class="readerMediaList">
      ${rows.map(row => readerMiniCard({
        id: readerId(["auction", row.number]),
        number: row.number,
        title: `رقم ${row.number}`,
        answer: row.answer,
        image: row.image,
        video: row.video
      })).join("")}
    </div>
  `
}

/* =========================
   Reader: Final Rounds
   تم نقلها إلى: final-segments.js
========================= */

/* =========================
   Reader: Archive
========================= */

async function renderPresenterReaderArchive() {
  const panel = document.getElementById("presenterReaderPanel")
  if (!panel) return

  const [boxesRes, itemsRes] = await Promise.all([
    db
      .from("archive_boxes")
      .select("*")
      .eq("model", Number(presenterModel))
      .order("round", { ascending: true }),

    db
      .from("archive_items")
      .select("*")
      .eq("model", Number(presenterModel))
      .order("round", { ascending: true })
      .order("position", { ascending: true })
  ])

  if (boxesRes.error) throw boxesRes.error
  if (itemsRes.error) throw itemsRes.error

  const boxes = boxesRes.data || []
  const items = itemsRes.data || []

  if (!boxes.length && !items.length) {
    panel.innerHTML = readerEmpty("لا توجد بيانات في الأرشيف")
    return
  }

  const rounds = [...new Set([
    ...boxes.map(row => Number(row.round)),
    ...items.map(row => Number(row.round))
  ])].sort((a, b) => a - b)

  panel.innerHTML = `
    <div class="readerRoundsStack">
      ${rounds.map(round => {
        const box = boxes.find(row => Number(row.round) === round) || {}
        const roundItems = items.filter(row => Number(row.round) === round)

        return `
          <section class="readerRoundPage">
            <div class="readerRoundHead">
              <h2>الأرشيف - الجولة ${round}</h2>
            </div>

            <div class="readerArchiveInfo">
              <div><label>البطولة</label><strong>${readerEscape(box.tournament || "-")}</strong></div>
              <div><label>الموسم</label><strong>${readerEscape(box.season || "-")}</strong></div>
              <div><label>النتيجة</label><strong>${readerEscape(box.score || "-")}</strong></div>
            </div>

            <div class="readerMediaList">
              ${roundItems.map(item => readerMiniCard({
                id: readerId(["archive", round, item.position]),
                number: item.position,
                title: item.label || `العنصر ${item.position}`,
                question: item.text,
                answer: String(item.label || "").trim() === "المطلوب" ? item.text : "",
                image: item.image
              })).join("")}
            </div>
          </section>
        `
      }).join("")}
    </div>
  `
}
/* =========================
   INSIDE MODE SWITCH
   تغيير الوضع بعد الدخول
========================= */

function ensurePresenterInsideModeSwitch() {
  let box = document.getElementById("presenterInsideModeSwitch")

  if (box) {
    updatePresenterInsideModeSwitch()
    return
  }

  box = document.createElement("div")
  box.id = "presenterInsideModeSwitch"
  box.className = "presenterInsideModeSwitch"

  box.innerHTML = `
    <button
      type="button"
      id="insideControlModeBtn"
      onclick="switchPresenterInsideMode('control')"
    >
      تحكم
    </button>

    <button
      type="button"
      id="insideReaderModeBtn"
      onclick="switchPresenterInsideMode('reader')"
    >
      دليل الأسئلة
    </button>
  `

  document.body.appendChild(box)
  updatePresenterInsideModeSwitch()
}

function updatePresenterInsideModeSwitch() {
  const box = document.getElementById("presenterInsideModeSwitch")
  if (!box) return

  const hasSession = !!localStorage.getItem("presenter_session_id")

  box.classList.toggle("hidden", !hasSession)

  document.getElementById("insideControlModeBtn")?.classList.toggle(
    "active",
    presenterJoinMode === "control"
  )

  document.getElementById("insideReaderModeBtn")?.classList.toggle(
    "active",
    presenterJoinMode === "reader"
  )
}

async function switchPresenterInsideMode(mode) {
  const nextMode = mode === "reader" ? "reader" : "control"

  presenterJoinMode = nextMode
  localStorage.setItem("presenter_join_mode", presenterJoinMode)

  const sessionId = localStorage.getItem("presenter_session_id")

  if (!sessionId) {
    showPresenterJoin()
    return
  }

  if (presenterJoinMode === "reader") {
    presenterSegment = null
    presenterSelectedTeam = null
    presenterReaderSegment = null

    if (presenterChannel) {
      db.removeChannel(presenterChannel)
      presenterChannel = null
    }

    if (presenterSyncTimer) {
      clearInterval(presenterSyncTimer)
      presenterSyncTimer = null
    }

    await renderPresenterReaderHome()
    ensurePresenterInsideModeSwitch()
    showToast("تم التحويل إلى دليل الأسئلة")
    return
  }

  if (presenterJoinMode === "control") {
    presenterReaderSegment = null
    presenterSegment = null

    showPresenterBootLoading(
      "جاري التحويل إلى وضع التحكم..."
    )

    const result = await loadPresenterSession(
      sessionId,
      { forceRefresh: true }
    )

    const data = result.data

    if (result.error || !data || data.status === "ended") {
      hidePresenterBootLoading()
      renderPresenterEnded()
      return
    }

    applyPresenterSessionData(data)
    subscribeToGameSession(sessionId)

    renderPresenterHome()
    ensurePresenterInsideModeSwitch()
    hidePresenterBootLoading()
    showToast("تم التحويل إلى وضع التحكم")
  }
}
function hidePresenterInsideModeSwitch() {
  const box = document.getElementById("presenterInsideModeSwitch")
  if (box) box.classList.add("hidden")
}
