/* =========================================================
   PRESENTER / المقدم
   CLEAN FOUNDATION
========================================================= */

/* =========================
   1) MAIN STATE
========================= */

let presenterModel = 1
let presenterSegment = null
let presenterTeamAName = "الفريق الأول"
let presenterTeamBName = "الفريق الثاني"
let presenterSelectedTeam = null
let presenterSessionId = null
let presenterChannel = null
let presenterLiveState = null

let presenterFinalRound = 1
let presenterFinalRoundOverride = null
let presenterFinalForcedRound = null
let presenterFinalForcedRoundUntil = 0

let lastPresenterToastTime = 0
let presenterSyncTimer = null
let presenterGoingHome = false
let presenterJustJoined = false

let presenterLocalSyncUntil = 0
let presenterLocalOpenedSegment = null
let presenterChannelHealthy = false

let presenterJoinMode =
  localStorage.getItem("presenter_join_mode") ||
  "control"

let presenterReaderSegment = null

/* =========================
   2) CACHE SETTINGS
========================= */

const PRESENTER_SESSION_CACHE_TTL = 30 * 1000
const PRESENTER_MODEL_CACHE_TTL = 5 * 60 * 1000
const PRESENTER_CONTENT_CACHE_TTL = 10 * 60 * 1000
const PRESENTER_READER_CACHE_TTL = 15 * 60 * 1000
const PRESENTER_CACHE_VERSION = 5

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
let presenterModelDataLoaded = false
let presenterModelDataPromise = null
let presenterVisibilityPromise = null
let presenterLastSessionStateKey = ""

/* =========================
   3) SEGMENT REGISTRY
   مصدر واحد للفقرات
========================= */

const PRESENTER_SEGMENTS = [
  {
    key: "warmup",
    title: "التسخين",
    sort: 1,
    moduleKey: "warmup",
    displaySegment: "warmup",
    needsLottery: true
  },
  {
    key: "top10",
    title: "Top 10",
    sort: 2,
    moduleKey: "top10",
    displaySegment: "top10",
    needsLottery: true
  },
  {
    key: "letterli",
    title: "حرفلي",
    sort: 3,
    moduleKey: "letterli",
    displaySegment: "letterli",
    needsLottery: false
  },
  {
    key: "who",
    title: "من هو",
    sort: 4,
    moduleKey: "who",
    displaySegment: "who",
    needsLottery: true
  },
  {
    key: "explain",
    title: "اشرح الكلمة",
    sort: 5,
    moduleKey: "explain",
    displaySegment: "explain",
    needsLottery: true
  },
  {
    key: "final_round1",
    title: "ٮدوں ٮڡاط",
    sort: 6,
    moduleKey: "final",
    displaySegment: "final",
    finalRound: 1,
    needsLottery: false
  },
  {
    key: "final_round2",
    title: "صح صحلي",
    sort: 7,
    moduleKey: "final",
    displaySegment: "final",
    finalRound: 2,
    needsLottery: true
  },
  {
    key: "final_round3",
    title: "قصة",
    sort: 8,
    moduleKey: "final",
    displaySegment: "final",
    finalRound: 3,
    needsLottery: false
  },
  {
    key: "final_round4",
    title: "التركيز",
    sort: 9,
    moduleKey: "final",
    displaySegment: "final",
    finalRound: 4,
    needsLottery: true
  },
  {
    key: "archive",
    title: "الأرشيف",
    sort: 10,
    moduleKey: "archive",
    displaySegment: "archive",
    needsLottery: true
  },
  {
    key: "randomChallenge",
    title: "التحدي",
    sort: 11,
    moduleKey: "randomChallenge",
    displaySegment: "randomChallenge",
    needsLottery: false
  }
]

const ALL_PRESENTER_SEGMENTS = PRESENTER_SEGMENTS

let presenterVisibleSegments =
  PRESENTER_SEGMENTS.map(item => ({
    ...item,
    is_visible: true,
    sort_order: item.sort
  }))

/* =========================
   4) BASIC HELPERS
========================= */

function getPresenterModuleFunction(name) {
  const fn = window[name]
  return typeof fn === "function" ? fn : null
}

function withPresenterTimeout(
  promise,
  ms = 3500,
  fallback = null
) {
  let timer = null

  const timeoutPromise =
    new Promise(resolve => {
      timer = setTimeout(() => {
        resolve(fallback)
      }, ms)
    })

  return Promise
    .race([promise, timeoutPromise])
    .finally(() => {
      if (timer) clearTimeout(timer)
    })
}

function queuePresenterIdleTask(
  task,
  options = {}
) {
  const delay = Number(options.delay || 0)
  const timeout = Number(options.timeout || 2000)

  const run = () => {
    if (typeof task !== "function") return

    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(() => task(), {
        timeout
      })
      return
    }

    setTimeout(task, 0)
  }

  if (delay > 0) {
    setTimeout(run, delay)
    return
  }

  run()
}

function mergePresenterObjects(base = {}, patch = {}) {
  const output = {
    ...(base || {})
  }

  Object.keys(patch || {}).forEach(key => {
    const value = patch[key]

    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      output[key] = mergePresenterObjects(
        output[key] || {},
        value
      )
      return
    }

    output[key] = value
  })

  return output
}

/* =========================
   5) RESOURCE CACHE
========================= */

function getPresenterResourceCacheKey(
  namespace = "resource",
  parts = []
) {
  const cleanParts =
    Array.isArray(parts)
      ? parts
      : [parts]

  return [
    "presenter_cache",
    `v${PRESENTER_CACHE_VERSION}`,
    namespace,
    ...cleanParts
  ]
    .map(part =>
      String(part ?? "")
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, "_")
    )
    .join("_")
}

function readPresenterResourceCache(
  cacheKey,
  ttl = 0,
  options = {}
) {
  try {
    const raw =
      localStorage.getItem(cacheKey)

    if (!raw) return null

    const parsed = JSON.parse(raw)
    const savedAt = Number(parsed.savedAt || 0)
    const age = Date.now() - savedAt

    if (
      ttl &&
      age > ttl &&
      options.allowStale !== true
    ) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

function savePresenterResourceCache(
  cacheKey,
  data
) {
  try {
    localStorage.setItem(
      cacheKey,
      JSON.stringify({
        data,
        savedAt: Date.now()
      })
    )
  } catch (error) {
    console.log("PRESENTER CACHE SAVE ERROR:", error)
  }
}

function removePresenterResourceCache(cacheKey) {
  try {
    localStorage.removeItem(cacheKey)
  } catch {}
}

async function loadPresenterCachedResource({
  cacheKey,
  ttl = 0,
  forceRefresh = false,
  staleWhileRevalidate = true,
  fetcher
} = {}) {
  if (!cacheKey || typeof fetcher !== "function") {
    return {
      data: null,
      error: new Error("Invalid cached resource")
    }
  }

  const cached =
    readPresenterResourceCache(
      cacheKey,
      ttl,
      { allowStale: staleWhileRevalidate }
    )

  if (cached && forceRefresh !== true) {
    if (staleWhileRevalidate) {
      fetcher()
        .then(result => {
          if (!result?.error) {
            savePresenterResourceCache(
              cacheKey,
              result?.data || null
            )
          }
        })
        .catch(error => {
          console.log(
            "PRESENTER BACKGROUND CACHE ERROR:",
            error
          )
        })
    }

    return {
      data: cached.data,
      error: null,
      source: "cache"
    }
  }

  if (presenterResourceRequests.has(cacheKey)) {
    return presenterResourceRequests.get(cacheKey)
  }

  const request = (async () => {
    try {
      const result = await fetcher()

      if (!result?.error) {
        savePresenterResourceCache(
          cacheKey,
          result?.data || null
        )
      }

      return result
    } catch (error) {
      return {
        data: cached?.data || null,
        error,
        source: cached ? "stale-cache" : "error"
      }
    } finally {
      presenterResourceRequests.delete(cacheKey)
    }
  })()

  presenterResourceRequests.set(cacheKey, request)
  return request
}

/* =========================
   6) LOADING UI
========================= */

function getPresenterLoadingMarkup(
  text = "جارٍ التحميل..."
) {
  return `
    <div class="presenterLoadingBox">
      <div class="presenterLoadingSpinner"></div>
      <div class="presenterLoadingText">${text}</div>
    </div>
  `
}

function showPresenterBootLoading(
  text = "جاري تجهيز لوحة المقدم..."
) {
  const overlay =
    document.getElementById("presenterBootLoading")

  if (!overlay) return

  const label =
    overlay.querySelector("[data-loading-text]") ||
    overlay.querySelector(".presenterLoadingText")

  if (label) {
    label.innerText = text
  }

  overlay.classList.remove("hidden")
  overlay.classList.add("visible")
  overlay.style.display = ""
}

function hidePresenterBootLoading() {
  const overlay =
    document.getElementById("presenterBootLoading")

  if (!overlay) return

  overlay.classList.remove("visible")
  overlay.classList.add("hidden")
  overlay.style.display = "none"
}

function setPresenterBackgroundLoading(active) {
  const box =
    document.getElementById("presenterBackgroundLoading")

  if (!box) return

  box.classList.toggle("hidden", !active)
}

/* =========================
   7) SEGMENT HELPERS
========================= */

function normalizePresenterSegmentKey(key) {
  const value = String(key || "").trim()

  if (!value) return ""

  if (value === "final") {
    return `final_round${Number(getPresenterFinalRound() || 1)}`
  }

  if (value === "finalRound1") return "final_round1"
  if (value === "finalRound2") return "final_round2"
  if (value === "finalRound3") return "final_round3"
  if (value === "finalRound4") return "final_round4"

  if (value === "final_round1") return "final_round1"
  if (value === "final_round2") return "final_round2"
  if (value === "final_round3") return "final_round3"
  if (value === "final_round4") return "final_round4"

  if (value === "random_challenge") return "randomChallenge"
  if (value === "randomchallenge") return "randomChallenge"
  if (value === "randomChallenge") return "randomChallenge"

  if (value === "top_10") return "top10"
  if (value === "topTen") return "top10"

  if (
    value === "auction" ||
    value === "fatbla" ||
    value === "fitbala" ||
    value === "فتبلة"
  ) {
    return ""
  }

  return value
}

function getPresenterSegmentConfig(segment) {
  const key = normalizePresenterSegmentKey(segment)

  return PRESENTER_SEGMENTS.find(item => {
    return item.key === key
  }) || null
}

function getPresenterSegmentTitle(segment) {
  return (
    getPresenterSegmentConfig(segment)?.title ||
    "لوحة المقدم"
  )
}

function getPresenterSegmentName(segment) {
  return getPresenterSegmentTitle(segment)
}

function getPresenterFinalRound() {
  return Number(
    presenterFinalRoundOverride ||
    presenterFinalRound ||
    presenterLiveState?.final?.round ||
    1
  )
}

function getPresenterFinalRoundTitle(round = 1) {
  const titles = {
    1: "ٮدوں ٮڡاط",
    2: "صح صحلي",
    3: "قصة",
    4: "التركيز"
  }

  return titles[Number(round || 1)] || "الفاصلة"
}

function getPresenterFinalRoundFromKey(segment) {
  const key = normalizePresenterSegmentKey(segment)

  if (key === "final_round1") return 1
  if (key === "final_round2") return 2
  if (key === "final_round3") return 3
  if (key === "final_round4") return 4

  return Number(getPresenterFinalRound() || 1)
}

function getPresenterFinalSessionSegmentKey(round) {
  const r = Math.min(
    Math.max(Number(round || 1), 1),
    4
  )

  return `finalRound${r}`
}

function normalizePresenterSegmentFromSession(segment) {
  const raw = String(segment || "").trim()

  if (!raw) return null

  if (
    raw === "final" ||
    raw === "finalRound1" ||
    raw === "finalRound2" ||
    raw === "finalRound3" ||
    raw === "finalRound4" ||
    raw === "final_round1" ||
    raw === "final_round2" ||
    raw === "final_round3" ||
    raw === "final_round4"
  ) {
    return "final"
  }

  const key = normalizePresenterSegmentKey(raw)
  const config = getPresenterSegmentConfig(key)

  if (!config) return null

  return config.moduleKey || config.key
}

function getPresenterFinalRoundFromSessionSegment(
  segment,
  fallback = 1
) {
  const key = String(segment || "")

  if (key === "finalRound1" || key === "final_round1") return 1
  if (key === "finalRound2" || key === "final_round2") return 2
  if (key === "finalRound3" || key === "final_round3") return 3
  if (key === "finalRound4" || key === "final_round4") return 4

  return Number(fallback || 1)
}

function normalizePresenterFinalSegmentKey(segment) {
  const key = normalizePresenterSegmentKey(segment)

  if (key === "final_round1") return "finalRound1"
  if (key === "final_round2") return "finalRound2"
  if (key === "final_round3") return "finalRound3"
  if (key === "final_round4") return "finalRound4"

  return key
}

function getPresenterCurrentSegmentKey() {
  if (presenterSegment === "final") {
    return `final_round${Number(getPresenterFinalRound() || 1)}`
  }

  return normalizePresenterSegmentKey(
    presenterSegment || ""
  )
}

function markPresenterLocalSync(
  segment = presenterSegment,
  ms = 1200
) {
  presenterLocalSyncUntil = Date.now() + ms
  presenterLocalOpenedSegment =
    segment || presenterSegment || null
}

function isPresenterLocalSyncProtected() {
  return Date.now() < presenterLocalSyncUntil
}

/* =========================
   8) SESSION CACHE + API
========================= */

function getPresenterSessionCacheKey(sessionId) {
  return getPresenterResourceCacheKey(
    "session",
    [sessionId]
  )
}

function readPresenterSessionCache(sessionId) {
  return readPresenterResourceCache(
    getPresenterSessionCacheKey(sessionId),
    PRESENTER_SESSION_CACHE_TTL,
    { allowStale: true }
  )?.data || null
}

function savePresenterSessionCache(data) {
  if (!data?.id) return

  savePresenterResourceCache(
    getPresenterSessionCacheKey(data.id),
    data
  )
}

async function loadPresenterSession(
  sessionId,
  options = {}
) {
  if (!sessionId || !window.db) {
    return {
      data: null,
      error: new Error("No session or db")
    }
  }

  if (options.forceRefresh !== true) {
    const cached =
      readPresenterSessionCache(sessionId)

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

    if (!error && data) {
      savePresenterSessionCache(data)
    }

    return { data, error }
  } catch (error) {
    return { data: null, error }
  }
}

async function updatePresenterSessionSafely(
  patch = {},
  options = {}
) {
  const sessionId =
    options.sessionId ||
    presenterSessionId ||
    localStorage.getItem("presenter_session_id")

  if (!sessionId || !window.db) {
    return {
      data: null,
      error: new Error("No session or db")
    }
  }

  try {
    const currentRes = await db
      .from("game_sessions")
      .select(PRESENTER_SESSION_SELECT)
      .eq("id", sessionId)
      .maybeSingle()

    if (currentRes.error || !currentRes.data) {
      return {
        data: null,
        error: currentRes.error || new Error("Session not found")
      }
    }

    const current = currentRes.data

    const updatePayload = {
      updated_at: new Date().toISOString()
    }

    if ("active_segment" in patch) {
      updatePayload.active_segment = patch.active_segment
    }

    if ("status" in patch) {
      updatePayload.status = patch.status
    }

    if ("ended_at" in patch) {
      updatePayload.ended_at = patch.ended_at
    }

    if ("state" in patch) {
      updatePayload.state =
        options.replaceState === true
          ? patch.state
          : mergePresenterObjects(
              current.state || {},
              patch.state || {}
            )
    }

    const { data, error } = await db
      .from("game_sessions")
      .update(updatePayload)
      .eq("id", sessionId)
      .select(PRESENTER_SESSION_SELECT)
      .maybeSingle()

    if (!error && data) {
      savePresenterSessionCache(data)

      if (
        presenterChannel &&
        presenterChannelHealthy
      ) {
        presenterChannel.send({
          type: "broadcast",
          event: "session_state",
          payload: data
        }).catch(() => null)
      }

      if (options.applySession !== false) {
        applyPresenterSessionData(data)
      }
    }

    return { data, error }
  } catch (error) {
    return { data: null, error }
  }
}

/* =========================
   9) PAGE MODE
========================= */

function hideAllPresenterPages() {
  document.getElementById("presenterJoin")?.classList.add("hidden")
  document.getElementById("presenterHome")?.classList.add("hidden")
  document.getElementById("presenterSegmentPage")?.classList.add("hidden")
  document.getElementById("presenterReaderHome")?.classList.add("hidden")
  document.getElementById("presenterReaderSegmentPage")?.classList.add("hidden")
}

function syncPresenterJoinModeUI() {
  document
    .getElementById("presenterControlModeBtn")
    ?.classList.toggle("active", presenterJoinMode === "control")

  document
    .getElementById("presenterReaderModeBtn")
    ?.classList.toggle("active", presenterJoinMode === "reader")
}

function setPresenterJoinMode(mode) {
  presenterJoinMode =
    mode === "reader"
      ? "reader"
      : "control"

  localStorage.setItem(
    "presenter_join_mode",
    presenterJoinMode
  )

  syncPresenterJoinModeUI()

  const status =
    document.getElementById("presenterJoinStatus")

  if (status) {
    status.innerText =
      presenterJoinMode === "reader"
        ? "وضع القراءة: عرض الأسئلة والإجابات فقط"
        : "وضع التحكم: ربط مع العرض والتحكم باللعبة"
  }
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
  document.getElementById("presenterReaderHome")?.classList.remove("hidden")
}

function showPresenterReaderSegmentPage() {
  hideAllPresenterPages()
  document.getElementById("presenterReaderSegmentPage")?.classList.remove("hidden")
}

/* =========================
   10) BOOT
========================= */

function renderPresenterBootFallback(data = null) {
  try {
    if (data) {
      presenterSessionId = data.id || presenterSessionId
      presenterModel = Number(data.model || presenterModel || 1)
      presenterTeamAName = data.team_a || presenterTeamAName || "الفريق الأول"
      presenterTeamBName = data.team_b || presenterTeamBName || "الفريق الثاني"
      presenterLiveState = data.state || presenterLiveState || {}
    }

    presenterSegment = null
    presenterSelectedTeam = null

    renderPresenterHome()
  } catch (error) {
    console.log("PRESENTER BOOT FALLBACK ERROR:", error)

    hideAllPresenterPages()
    document.getElementById("presenterHome")?.classList.remove("hidden")
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  let cachedSession = null

  try {
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

    cachedSession =
      readPresenterSessionCache(savedSessionId)

    if (cachedSession) {
      if (cachedSession.status === "ended") {
        hidePresenterBootLoading()
        renderPresenterEnded()
        return
      }

      presenterSessionId = cachedSession.id
      presenterModel = Number(cachedSession.model || 1)
      presenterTeamAName = cachedSession.team_a || "الفريق الأول"
      presenterTeamBName = cachedSession.team_b || "الفريق الثاني"
      presenterLiveState = cachedSession.state || {}

      try {
        syncPresenterSelectedTeamFromDisplayState()

        if (presenterJoinMode === "reader") {
          await renderPresenterReaderHome()
        } else {
          applyPresenterSessionData(cachedSession)
        }
      } catch (error) {
        console.log(
          "PRESENTER CACHED SESSION APPLY ERROR:",
          error
        )

        renderPresenterBootFallback(cachedSession)
      }

      hidePresenterBootLoading()
    }

    const result = await withPresenterTimeout(
      loadPresenterSession(savedSessionId, {
        forceRefresh: true
      }),
      4500,
      cachedSession
        ? {
            data: cachedSession,
            error: null,
            source: "timeout-cache"
          }
        : {
            data: null,
            error: new Error("Presenter session timeout"),
            source: "timeout"
          }
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
    presenterTeamAName = data.team_a || "الفريق الأول"
    presenterTeamBName = data.team_b || "الفريق الثاني"
    presenterLiveState = data.state || {}

    try {
      syncPresenterSelectedTeamFromDisplayState()

      if (presenterJoinMode === "reader") {
        await renderPresenterReaderHome()
        hidePresenterBootLoading()
        return
      }

      applyPresenterSessionData(data)
      subscribeToGameSession(data.id)
    } catch (error) {
      console.log("PRESENTER SESSION APPLY ERROR:", error)

      try {
        subscribeToGameSession(data.id)
      } catch (subscribeError) {
        console.log(
          "PRESENTER SUBSCRIBE ERROR:",
          subscribeError
        )
      }

      renderPresenterBootFallback(data)
    }

    hidePresenterBootLoading()
  } catch (error) {
    console.log("PRESENTER BOOT ERROR:", error)

    hidePresenterBootLoading()

    const savedSessionId =
      localStorage.getItem("presenter_session_id")

    if (savedSessionId && cachedSession) {
      renderPresenterBootFallback(cachedSession)
      return
    }

    if (savedSessionId) {
      renderPresenterBootFallback()
      return
    }

    showPresenterJoin()
  }
})

/* =========================
   11) MODEL VISIBILITY
========================= */

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

function applyPresenterVisibleSegments(rows = []) {
  const map = {}

  PRESENTER_SEGMENTS.forEach(item => {
    map[item.key] = {
      ...item,
      is_visible: true,
      sort_order: item.sort
    }
  })

  ;(rows || []).forEach(row => {
    const key =
      normalizePresenterSegmentKey(row.segment_key)

    if (!map[key]) return

    map[key] = {
      ...map[key],
      is_visible: row.is_visible !== false,
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

function getPresenterSelectedSegmentsFromState() {
  const rows =
    presenterLiveState?.selectedSegments || []

  if (!Array.isArray(rows) || !rows.length) {
    return []
  }

  return rows
    .map((row, index) => {
      const key =
        normalizePresenterSegmentKey(
          row.key ||
          row.segment_key ||
          row
        )

      const config =
        getPresenterSegmentConfig(key)

      if (!config) return null

      return {
        ...config,
        title:
          row.title ||
          config.title,
        is_visible: true,
        sort_order:
          Number(row.sort_order || index + 1)
      }
    })
    .filter(Boolean)
    .sort((a, b) => {
      return (
        Number(a.sort_order || a.sort) -
        Number(b.sort_order || b.sort)
      )
    })
}

function applyPresenterSelectedSegmentsFromState() {
  const selected =
    getPresenterSelectedSegmentsFromState()

  if (!selected.length) {
    return false
  }

  presenterVisibleSegments = selected
  return true
}

function applyPresenterCachedVisibilityNow() {
  if (applyPresenterSelectedSegmentsFromState()) {
    return presenterVisibleSegments
  }

  const modelCached =
    readPresenterResourceCache(
      getPresenterResourceCacheKey(
        "model_relations",
        [Number(presenterModel || 0)]
      ),
      PRESENTER_MODEL_CACHE_TTL,
      { allowStale: true }
    )

  return applyPresenterVisibleSegments(
    modelCached?.data?.visible_segments || []
  )
}

async function loadPresenterVisibleSegments(
  options = {}
) {
  if (applyPresenterSelectedSegmentsFromState()) {
    return presenterVisibleSegments
  }

  if (
    presenterVisibilityPromise &&
    options.forceRefresh !== true
  ) {
    return presenterVisibilityPromise
  }

  presenterVisibilityPromise = (async () => {
    try {
      const modelData =
        await loadPresenterModelData({
          forceRefresh:
            options.forceRefresh === true,
          staleWhileRevalidate:
            options.staleWhileRevalidate !== false
        })

      if (applyPresenterSelectedSegmentsFromState()) {
        return presenterVisibleSegments
      }

      return applyPresenterVisibleSegments(
        modelData?.visible_segments || []
      )
    } catch (error) {
      console.log(
        "LOAD PRESENTER VISIBILITY FALLBACK:",
        error
      )

      if (!presenterVisibleSegments.length) {
        applyPresenterVisibleSegments([])
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

function isPresenterSegmentVisible(segment) {
  const key = normalizePresenterSegmentKey(segment)

  return presenterVisibleSegments.some(item => {
    return item.key === key
  })
}

/* =========================
   12) SEGMENT LOCKS
========================= */

function getPresenterSegmentLockKeys(segmentKey) {
  const key = normalizePresenterSegmentKey(segmentKey)

  if (!key) return []

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
  const status =
    presenterLiveState?.segmentStatus || {}

  return getPresenterSegmentLockKeys(segmentKey).some(key => {
    return !!status?.[key]?.locked
  })
}

function getPresenterCurrentLockKey() {
  return getPresenterCurrentSegmentKey()
}

/* =========================
   13) HOME
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

function buildPresenterSegmentsGridHtml() {
  if (!presenterVisibleSegments.length) {
    return `
      <div class="presenterEmptySegments">
        لا توجد فقرات مفعلة حاليًا
      </div>
    `
  }

  return presenterVisibleSegments.map(item => {
    const key =
      normalizePresenterSegmentKey(item.key)

    const locked =
      isPresenterSegmentLocked(key)

    return `
      <button
        type="button"
        class="segmentCard presenterSegmentCard presenterSegmentCardClean ${locked ? "presenterLockedSegment" : ""}"
        data-segment="${key}"
        onclick="openPresenterSegmentCard('${key}')"
        ${locked ? "disabled" : ""}
      >
        <span>${item.title}</span>
      </button>
    `
  }).join("")
}

async function renderPresenterSegmentsGrid() {
  const grid =
    document.getElementById("presenterSegmentsGrid")

  if (!grid) return

  applyPresenterCachedVisibilityNow()

  if (!presenterVisibleSegments.length) {
    applyPresenterVisibleSegments([])
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

function renderPresenterHome() {
  showPresenterHomePage()

  const scores = getPresenterTotalScores()

  const teamA =
    document.getElementById("presenterHomeTeamA")

  const teamB =
    document.getElementById("presenterHomeTeamB")

  const scoreA =
    document.getElementById("presenterHomeScoreA")

  const scoreB =
    document.getElementById("presenterHomeScoreB")

  const title =
    document.getElementById("presenterTitle")

  const subtitle =
    document.getElementById("presenterSubtitle")

  const panel =
    document.getElementById("presenterPanel")

  if (teamA) teamA.innerText = presenterTeamAName
  if (teamB) teamB.innerText = presenterTeamBName
  if (scoreA) scoreA.innerText = scores.A
  if (scoreB) scoreB.innerText = scores.B
  if (title) title.innerText = "لوحة المقدم"

  const modelName =
    presenterLiveState?.currentModelName || ""

  if (subtitle) {
    subtitle.innerHTML = presenterSessionId
      ? `<span class="presenterOnlineDot">✅</span><span class="presenterModelName">${modelName || "بدون اسم نموذج"}</span>`
      : `<span class="presenterOfflineDot">❌</span><span class="presenterModelName">غير متصل</span>`
  }

  if (panel) {
    panel.dataset.segment = ""
    delete panel.dataset.finalRound
  }

  renderPresenterSegmentsGrid()
    .then(() => {
      updatePresenterLockedSegments()
      schedulePresenterDeferredPreload()
    })
    .catch(error => {
      console.log(
        "RENDER PRESENTER SEGMENTS ERROR:",
        error
      )
    })

  ensurePresenterInsideModeSwitch()
}

function updatePresenterHomeScoresOnly() {
  const scores = getPresenterTotalScores()

  const scoreA =
    document.getElementById("presenterHomeScoreA")

  const scoreB =
    document.getElementById("presenterHomeScoreB")

  if (scoreA) scoreA.innerText = scores.A
  if (scoreB) scoreB.innerText = scores.B
}

function updatePresenterLockedSegments() {
  document
    .querySelectorAll("#presenterSegmentsGrid .segmentCard")
    .forEach(card => {
      const key = card.dataset.segment
      if (!key) return

      const locked =
        isPresenterSegmentLocked(key)

      card.classList.toggle(
        "presenterLockedSegment",
        locked
      )

      card.disabled = locked
    })
}

/* =========================
   14) JOIN SESSION
========================= */

async function joinGameSession() {
  const input =
    document.getElementById("joinCodeInput")

  const status =
    document.getElementById("presenterJoinStatus")

  const btn =
    document.getElementById("presenterJoinBtn")

  const code =
    (input?.value || "")
      .replace(/\D/g, "")
      .trim()

  if (input) input.value = code

  if (code.length !== 4) {
    if (status) status.innerText = "اكتب كود من 4 أرقام"
    return
  }

  if (!window.db) {
    if (status) {
      status.innerText = "الاتصال غير جاهز، أعد المحاولة"
    }
    return
  }

  if (btn?.disabled) return

  if (btn) {
    btn.disabled = true
    btn.innerText = "جاري الدخول..."
  }

  if (status) {
    status.innerText = "جاري التحقق من الكود..."
  }

  try {
    const { data, error } = await db
      .from("game_sessions")
      .select(PRESENTER_SESSION_SELECT)
      .eq("join_code", code)
      .eq("status", "active")
      .maybeSingle()

    if (error || !data) {
      if (status) {
        status.innerText = "الكود غير صحيح أو اللعبة منتهية"
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
      await renderPresenterReaderHome()
      showToast("تم الدخول إلى دليل الأسئلة")
      return
    }

setPresenterBackgroundLoading(false)

renderPresenterHome()
subscribeToGameSession(data.id)

markPresenterStartedSession(data.id)
  .catch(error => {
    console.log(
      "PRESENTER START MARK ERROR:",
      error
    )
  })
  .finally(() => {
    setPresenterBackgroundLoading(false)
  })

showToast("تم الدخول للجلسة")
  } catch (error) {
    console.log("JOIN SESSION ERROR:", error)

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
   15) SESSION SYNC
========================= */

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

function getPresenterSegmentHandler(segment) {
  const runtimeSegment =
    normalizePresenterSegmentFromSession(segment)

  const handlers = {
    warmup: {
      render: getPresenterModuleFunction("renderWarmup"),
      refresh: getPresenterModuleFunction("refreshPresenterWarmupFromState")
    },
    top10: {
      render: getPresenterModuleFunction("renderTop10"),
      refresh: getPresenterModuleFunction("refreshPresenterTop10FromState")
    },
    letterli: {
      render: getPresenterModuleFunction("renderPresenterLetterli"),
      refresh: getPresenterModuleFunction("refreshPresenterLetterliFromState")
    },
    who: {
      render: getPresenterModuleFunction("renderWho"),
      refresh: getPresenterModuleFunction("refreshPresenterWhoFromState")
    },
    explain: {
      render: getPresenterModuleFunction("renderExplain"),
      refresh: getPresenterModuleFunction("refreshPresenterExplainFromState")
    },
    final: {
      render: getPresenterModuleFunction("renderFinal"),
      refresh: getPresenterModuleFunction("refreshPresenterFinalFromState")
    },
    archive: {
      render: getPresenterModuleFunction("renderArchive"),
      refresh: getPresenterModuleFunction("refreshPresenterArchiveFromState")
    },
    randomChallenge: {
      render: getPresenterModuleFunction("renderPresenterRandomChallenge"),
      refresh: getPresenterModuleFunction("refreshPresenterRandomChallengeFromState")
    }
  }

  const handler = handlers[runtimeSegment] || null

  if (!handler || typeof handler.render !== "function") {
    return null
  }

  return handler
}

function refreshPresenterCurrentSegmentFromState() {
  if (!presenterSegment) return

  try {
    syncPresenterSelectedTeamFromDisplayState()

    const handler =
      getPresenterSegmentHandler(presenterSegment)

    if (!handler || typeof handler.refresh !== "function") {
      return
    }

    const result = handler.refresh()

    if (result && typeof result.catch === "function") {
      result.catch(error => {
        console.log(
          "PRESENTER REFRESH ASYNC ERROR:",
          error
        )
      })
    }

    if (typeof handler.afterRefresh === "function") {
      handler.afterRefresh()
    }

    if (typeof refreshPresenterEnhancements === "function") {
      refreshPresenterEnhancements()
    }
  } catch (error) {
    console.log(
      "PRESENTER REFRESH CURRENT SEGMENT ERROR:",
      error
    )
  }
}

function isPresenterPanelReadyForSegment(segment) {
  const panel =
    document.getElementById("presenterPanel")

  if (!panel) return false

  const runtimeSegment =
    normalizePresenterSegmentFromSession(segment)

  const currentRendered =
    panel.dataset.segment || ""

  const currentRound =
    Number(panel.dataset.finalRound || 0)

  const panelText =
    panel.innerText || ""

  const panelIsEmpty =
    !panel.innerHTML.trim() ||
    panelText.includes("جارٍ التحميل") ||
    panelText.includes("جارٍ تحميل") ||
    panelText.includes("جاري تحميل") ||
    panelText.includes("جاري التحميل") ||
    panelText.includes("حدث خطأ في تحميل الفقرة")

  if (runtimeSegment === "final") {
    return (
      currentRendered === "final" &&
      currentRound === Number(getPresenterFinalRound() || 1) &&
      !panelIsEmpty
    )
  }

  return (
    currentRendered === runtimeSegment &&
    !panelIsEmpty
  )
}

async function renderPresenterSegmentShell(segment) {
  const panel =
    document.getElementById("presenterPanel")

  if (!panel) return

  const runtimeSegment =
    normalizePresenterSegmentFromSession(segment)

  if (!runtimeSegment) {
    presenterSegment = null
    presenterSelectedTeam = null
    renderPresenterHome()
    return
  }

  showPresenterSegmentPage()

  const title =
    document.getElementById("presenterSegmentTitle")

  if (title) {
    title.innerText =
      runtimeSegment === "final"
        ? getPresenterFinalRoundTitle(getPresenterFinalRound())
        : getPresenterSegmentName(runtimeSegment)
  }

  panel.dataset.segment = runtimeSegment

  if (runtimeSegment === "final") {
    panel.dataset.finalRound =
      String(getPresenterFinalRound() || 1)
  } else {
    delete panel.dataset.finalRound
  }

  panel.innerHTML = `
    <section class="presenterCard presenterSegmentLoadingCard">
      ${getPresenterLoadingMarkup("جارٍ تحميل الفقرة...")}
    </section>
  `
}

async function openPresenterSegmentFromSync(segment) {
  const runtimeSegment =
    normalizePresenterSegmentFromSession(segment)

  const panel =
    document.getElementById("presenterPanel")

  if (!panel) return

  if (!runtimeSegment) {
    presenterSegment = null
    presenterSelectedTeam = null
    renderPresenterHome()
    return
  }

  const visibleKey =
    runtimeSegment === "final"
      ? `final_round${Number(getPresenterFinalRound() || 1)}`
      : runtimeSegment

  if (!isPresenterSegmentVisible(visibleKey)) {
    showToast("هذه الفقرة معطلة من الأدمن")
    presenterSegment = null
    presenterSelectedTeam = null
    renderPresenterHome()
    return
  }

  if (isPresenterSegmentLocked(visibleKey)) {
    showToast("هذه الفقرة منتهية")
    presenterSegment = null
    presenterSelectedTeam = null
    renderPresenterHome()
    return
  }

  presenterSegment = runtimeSegment

  const handler =
    getPresenterSegmentHandler(runtimeSegment)

  if (!handler || typeof handler.render !== "function") {
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

  if (isPresenterPanelReadyForSegment(runtimeSegment)) {
    refreshPresenterCurrentSegmentFromState()
    return
  }

  await renderPresenterSegmentShell(runtimeSegment)

  try {
    const result = handler.render()

    if (result && typeof result.then === "function") {
      await result
    }

    panel.dataset.segment = runtimeSegment

    if (runtimeSegment === "final") {
      panel.dataset.finalRound =
        String(getPresenterFinalRound() || 1)
    } else {
      delete panel.dataset.finalRound
    }

    refreshPresenterCurrentSegmentFromState()
  } catch (error) {
    console.log("Presenter render error:", error)

    panel.innerHTML = `
      <section class="presenterCard">
        <div class="presenterLabel">
          حدث خطأ في تحميل الفقرة
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
  }
}

function applyPresenterSessionData(data) {
  if (!data) return

  if (data.status === "ended") {
    renderPresenterEnded()
    return
  }

  const rawNextSegment =
    data.active_segment || null

  const nextSegment =
    normalizePresenterSegmentFromSession(rawNextSegment)

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

  const nextFinalRound =
    getPresenterFinalRoundFromSessionSegment(
      rawNextSegment,
      data.state?.final?.round ||
        presenterFinalRound ||
        1
    )

  const oldSegment = presenterSegment
  const oldSessionId = presenterSessionId
  const segmentChanged = oldSegment !== nextSegment

  presenterSessionId = data.id
  presenterModel = Number(data.model || 1)
  presenterTeamAName = data.team_a || "الفريق الأول"
  presenterTeamBName = data.team_b || "الفريق الثاني"

  let incomingState =
    data.state || {}

  if (nextSegment === "final") {
    let roundToUse =
      Number(nextFinalRound || 1)

    if (
      presenterFinalForcedRound &&
      Date.now() < presenterFinalForcedRoundUntil
    ) {
      roundToUse =
        Number(presenterFinalForcedRound)
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

  if (
    toast?.text &&
    toast?.time &&
    toast.time !== lastPresenterToastTime
  ) {
    lastPresenterToastTime = toast.time
    showToast(toast.text)
  }

  if (!presenterSegment) {
    presenterSelectedTeam = null
    renderPresenterHome()
    return
  }

  const lockKey =
    getPresenterCurrentLockKey()

  if (isPresenterSegmentLocked(lockKey)) {
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

async function markPresenterStartedSession(sessionId) {
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

async function fetchPresenterSessionNow(
  sessionId,
  forceApply = false
) {
  if (!sessionId || !window.db) return

  try {
    const { data, error } = await db
      .from("game_sessions")
      .select(PRESENTER_SESSION_SELECT)
      .eq("id", sessionId)
      .maybeSingle()

    if (error || !data) {
      console.log(
        "PRESENTER SESSION FETCH ERROR:",
        error
      )
      return
    }

    const nextKey =
      getPresenterSessionStateKey(data)

    if (
      !forceApply &&
      nextKey === presenterLastSessionStateKey
    ) {
      return
    }

    presenterLastSessionStateKey = nextKey
    savePresenterSessionCache(data)
    applyPresenterSessionData(data)
  } catch (error) {
    console.log(
      "PRESENTER SESSION FETCH CATCH:",
      error
    )
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

  presenterChannel =
    db.channel("game_session_" + sessionId, {
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

        const nextKey =
          getPresenterSessionStateKey(data)

        if (
          nextKey &&
          nextKey === presenterLastSessionStateKey
        ) {
          return
        }

        presenterLastSessionStateKey = nextKey
        savePresenterSessionCache(data)
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

        const nextKey =
          getPresenterSessionStateKey(data)

        if (
          nextKey &&
          nextKey === presenterLastSessionStateKey
        ) {
          return
        }

        presenterLastSessionStateKey = nextKey
        savePresenterSessionCache(data)
        applyPresenterSessionData(data)
      }
    )
    .subscribe(status => {
      console.log(
        "PRESENTER SESSION CHANNEL:",
        status
      )

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

    fetchPresenterSessionNow(
      sessionId,
      false
    )
  }, 1500)
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

  const status =
    document.getElementById("presenterJoinStatus")

  if (status) {
    status.innerText = "انتهت اللعبة — أدخل كود جديد"
  }
}

/* =========================
   16) UNIFIED SEGMENT OPENING
========================= */

function getPresenterOpenInfo(segment) {
  const key = normalizePresenterSegmentKey(segment)
  const config = getPresenterSegmentConfig(key)

  if (!config) return null

  const finalRound =
    config.finalRound
      ? Number(config.finalRound)
      : null

  return {
    key,
    title: config.title,
    runtimeSegment: config.moduleKey || config.key,
    displaySegment: config.displaySegment || config.key,
    sessionSegment: finalRound
      ? getPresenterFinalSessionSegmentKey(finalRound)
      : config.key,
    finalRound,
    needsLottery: !!config.needsLottery
  }
}

function getPresenterOpenCommandPayload(openInfo) {
  const payload = {
    segment: openInfo.displaySegment,
    segmentKey: openInfo.key,
    activeSegment: openInfo.sessionSegment,
    needsLottery: openInfo.needsLottery === true
  }

  if (openInfo.finalRound) {
    payload.round = openInfo.finalRound
    payload.finalRound = openInfo.finalRound
  }

  return payload
}

function setPresenterLocalOpenState(openInfo) {
  presenterSelectedTeam = null
  presenterSegment = openInfo.runtimeSegment

  if (openInfo.finalRound) {
    presenterFinalRound = openInfo.finalRound
    presenterFinalRoundOverride = openInfo.finalRound
    presenterFinalForcedRound = openInfo.finalRound
    presenterFinalForcedRoundUntil =
      Date.now() + 30000

    presenterFinalSelected = {
      round: openInfo.finalRound,
      number: null
    }

    presenterLiveState = {
      ...(presenterLiveState || {}),
      final: {
        ...(presenterLiveState?.final || {}),
        round: openInfo.finalRound
      }
    }

    return
  }

  presenterFinalRoundOverride = null
  presenterFinalSelected = null
}

async function syncPresenterOpenedSegment(openInfo) {
  const patch = {
    active_segment: openInfo.sessionSegment
  }

  if (openInfo.finalRound) {
    patch.state = {
      final: {
        round: openInfo.finalRound
      }
    }
  }

  const result =
    await updatePresenterSessionSafely(
      patch,
      {
        applySession: false
      }
    )

  if (result.error) {
    console.log(
      "SYNC OPEN SEGMENT ERROR:",
      result.error
    )
  }

  return !result.error
}

async function renderPresenterOpenedSegment(openInfo) {
  await renderPresenterSegmentShell(openInfo.runtimeSegment)
  await openPresenterSegmentFromSync(openInfo.runtimeSegment)
}

async function openPresenterSegmentCard(segment) {
  const openInfo =
    getPresenterOpenInfo(segment)

  if (!openInfo) {
    showToast("الفقرة غير معروفة")
    return
  }

  loadPresenterVisibleSegments().catch(() => null)

  if (!isPresenterSegmentVisible(openInfo.key)) {
    showToast("هذه الفقرة معطلة من الأدمن")
    renderPresenterHome()
    return
  }

  if (isPresenterSegmentLocked(openInfo.key)) {
    showToast("هذه الفقرة منتهية")
    renderPresenterHome()
    return
  }

  setPresenterLocalOpenState(openInfo)

  markPresenterLocalSync(
    openInfo.runtimeSegment,
    openInfo.finalRound ? 1800 : 1400
  )

  const commandPromise =
    sendCommand(
      "openSegment",
      getPresenterOpenCommandPayload(openInfo)
    )

  const sessionPromise =
    syncPresenterOpenedSegment(openInfo)
      .catch(error => {
        console.log(
          "OPEN SEGMENT SESSION SYNC CATCH:",
          error
        )
        return false
      })

  const renderPromise =
    renderPresenterOpenedSegment(openInfo)
      .catch(error => {
        console.log(
          "OPEN SEGMENT RENDER CATCH:",
          error
        )
        showToast("تعذر فتح الفقرة في المقدم")
      })

  const sent = await commandPromise

  if (!sent) {
    showToast("تعذر فتح الفقرة في العرض")
  }

  await sessionPromise
  await renderPromise
}

async function openPresenterSegment(segment) {
  return openPresenterSegmentCard(segment)
}

async function openPresenterFinalCard(round) {
  return openPresenterSegmentCard(
    `final_round${Number(round || 1)}`
  )
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
    localStorage.getItem("presenter_session_id")

  if (!sessionId) return false

  const result =
    await updatePresenterSessionSafely(
      {
        active_segment:
          getPresenterFinalSessionSegmentKey(round),
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
   17) GO HOME
========================= */

async function presenterGoHome() {
  presenterGoingHome = true
  presenterSegment = null
  presenterSelectedTeam = null

  markPresenterLocalSync(null, 1200)
  renderPresenterHome()

  const sent =
    await sendCommand("goHome", {
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

/* =========================
   18) TEAM SYNC
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
    const round =
      Number(
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

function getPresenterFinalTeamForRound(
  round = getPresenterFinalRound()
) {
  return getPresenterActiveTeamFromState()
}

function updatePresenterTeamButtonsOnly(team) {
  const cleanTeam =
    team === "A" || team === "B"
      ? team
      : null

  const teamA =
    document.getElementById("teamA")

  const teamB =
    document.getElementById("teamB")

  if (teamA) {
    teamA.classList.toggle(
      "selectedPresenterTeam",
      cleanTeam === "A"
    )
    teamA.classList.toggle(
      "activeTeam",
      cleanTeam === "A"
    )
  }

  if (teamB) {
    teamB.classList.toggle(
      "selectedPresenterTeam",
      cleanTeam === "B"
    )
    teamB.classList.toggle(
      "activeTeam",
      cleanTeam === "B"
    )
  }
}

function syncPresenterSelectedTeamFromDisplayState() {
  const syncedTeam =
    getPresenterActiveTeamFromState()

  presenterSelectedTeam =
    syncedTeam === "A" || syncedTeam === "B"
      ? syncedTeam
      : null

  updatePresenterTeamButtonsOnly(
    presenterSelectedTeam
  )
}

function teamButtons() {
  const activeTeam =
    getPresenterActiveTeamFromState()

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
    const round =
      Number(getPresenterFinalRound() || 1)

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
    document
      .querySelectorAll(".presenterRandomTeamName")
      .forEach((box, index) => {
        const boxTeam = index === 0 ? "A" : "B"
        box.classList.toggle("active", boxTeam === team)
      })
  }

  const sent =
    await sendCommand("selectTeam", {
      team,
      segment: presenterSegment || null,
      round:
        presenterSegment === "final"
          ? getPresenterFinalRound()
          : null
    })

  if (!sent) {
    syncPresenterSelectedTeamFromDisplayState()
    showToast("تعذر اختيار الفريق")
  }
}

/* =========================
   19) ACTION GUARD + COMMANDS
========================= */

let presenterActionLocks = new Map()

function getPresenterCurrentNumberForLock() {
  if (presenterSegment === "warmup") {
    return presenterLiveState?.warmup?.currentWarmupQuestionKey || ""
  }

  if (presenterSegment === "top10") {
    const top10 =
      presenterLiveState?.top10?.top10State || {}

    return `${top10.round || ""}_${top10.currentNumber || ""}_${top10.question?.[top10.round] || ""}`
  }

  if (presenterSegment === "who") {
    return presenterLiveState?.who?.currentNumber || ""
  }

  if (presenterSegment === "explain") {
    return presenterLiveState?.explain?.explainState?.currentNumber || ""
  }

  if (presenterSegment === "archive") {
    const archive =
      presenterLiveState?.archive?.archiveState || {}

    return archive.round || ""
  }

  if (presenterSegment === "randomChallenge") {
    const random =
      presenterLiveState?.randomChallenge || {}

    return `${random.currentBox || ""}_${random.box1?.pool || ""}_${random.box2?.numberInput || ""}_${random.box3?.activeTeam || ""}`
  }

  if (presenterSegment === "final") {
    const final =
      presenterLiveState?.final || {}

    const round =
      Number(final.round || presenterFinalRound || 1)

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

function getPresenterActionLockKey(
  action,
  payload = {}
) {
  const segment =
    presenterSegment || "global"

  if (action === "openSegment") {
    return `${segment}_${action}_${payload.segmentKey || payload.segment || ""}_${payload.round || ""}`
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

function lockPresenterActionButton(
  action,
  payload = {}
) {
  const key =
    getPresenterActionLockKey(action, payload)

  const now = Date.now()
  const lockTime =
    getPresenterActionLockTime(action)

  const lastTime =
    presenterActionLocks.get(key) || 0

  if (now - lastTime < lockTime) {
    return false
  }

  presenterActionLocks.set(key, now)

  if (presenterActionLocks.size > 120) {
    presenterActionLocks =
      new Map(
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
    segment:
      payload.segmentKey ||
      presenterSegment ||
      "global",
    action,
    payload: {
      ...payload,
      __client_command_id: clientCommandId
    },
    created_at: new Date().toISOString()
  }

  let broadcastSent = false

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

      broadcastSent = result !== "error"
    } catch (error) {
      console.log(
        "PRESENTER BROADCAST ERROR:",
        error
      )
    }
  }

  async function saveFallbackCommand() {
    try {
      const { error } = await db
        .from("presenter_commands")
        .insert(command)

      if (error) {
        console.log(
          "PRESENTER COMMAND FALLBACK ERROR:",
          error
        )
        return false
      }

      return true
    } catch (error) {
      console.log(
        "PRESENTER COMMAND FALLBACK CATCH:",
        error
      )
      return false
    }
  }

  if (broadcastSent) {
    saveFallbackCommand()
    return true
  }

  const fallbackSaved =
    await saveFallbackCommand()

  if (!fallbackSaved) {
    showToast("تعذر تنفيذ الأمر")
    return false
  }

  return true
}

/* =========================
   20) DEFERRED PRELOAD
========================= */

function getPresenterDeferredPreloadTasks() {
  const visibleKeys =
    new Set(
      presenterVisibleSegments.map(item =>
        normalizePresenterSegmentKey(item.key)
      )
    )

  const tasks = []

  const warmupLoader =
    getPresenterModuleFunction("loadPresenterWarmupRows")

  if (visibleKeys.has("warmup") && warmupLoader) {
    tasks.push(() =>
      warmupLoader({ backgroundRefresh: false })
    )
  }

  const top10Loader =
    getPresenterModuleFunction("loadPresenterTop10RoundRows")

  if (visibleKeys.has("top10") && top10Loader) {
    tasks.push(() =>
      top10Loader(1, { backgroundRefresh: false })
    )
  }

  const whoLoader =
    getPresenterModuleFunction("loadPresenterWhoRows")

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
    const tasks =
      getPresenterDeferredPreloadTasks()

    if (
      !tasks.length ||
      token !== presenterDeferredPreloadToken
    ) {
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
          await new Promise(resolve =>
            setTimeout(resolve, 350)
          )
        }

        try {
          await task()
        } catch (error) {
          console.log(
            "PRESENTER DEFERRED LOAD ERROR:",
            error
          )
        }

        await new Promise(resolve =>
          setTimeout(resolve, 120)
        )
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

/* =========================
   21) TOAST + DISPLAY CONTROLS
========================= */

let presenterToastTimer = null
let presenterToastHideTimer = null
let presenterDisplayControlsHidden = false

function showToast(text) {
  const t =
    document.getElementById("presenterToast")

  const textBox =
    document.getElementById("presenterToastText")

  const iconBox =
    t?.querySelector(".gameToastIcon")

  if (!t) return

  clearTimeout(presenterToastTimer)
  clearTimeout(presenterToastHideTimer)

  const msg =
    String(text || "")

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
      t.classList.remove(
        "presenterToastSuccess",
        "presenterToastError"
      )

      if (textBox) textBox.innerText = ""
      if (iconBox) iconBox.innerText = "!"
    }, 180)
  }, 1600)
}

function updateDisplayControlsEyeButton(isHidden) {
  const btn =
    document.getElementById("displayControlsEyeBtn")

  if (!btn) return

  btn.innerText =
    isHidden
      ? "إظهار التحكم"
      : "إخفاء التحكم"

  btn.classList.toggle(
    "showControlsMode",
    isHidden
  )

  btn.classList.toggle(
    "hideControlsMode",
    !isHidden
  )

  btn.title =
    isHidden
      ? "إظهار أزرار التحكم"
      : "إخفاء أزرار التحكم"
}

function togglePresenterDisplayControls() {
  presenterDisplayControlsHidden =
    !presenterDisplayControlsHidden

  updateDisplayControlsEyeButton(
    presenterDisplayControlsHidden
  )

  sendCommand("toggleDisplayControls")
}

/* =========================
   22) READER MODE
========================= */

const presenterReaderHtmlCache = new Map()

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
    .map(x =>
      String(x ?? "").replace(/[^a-zA-Z0-9_-]/g, "_")
    )
    .join("_")
}

function getPresenterReaderCacheKey(segment) {
  const model =
    Number(presenterModel || 0)

  const key =
    normalizePresenterFinalSegmentKey(
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
  const key =
    getPresenterReaderCacheKey(segment)

  const memoryValue =
    presenterReaderHtmlCache.get(key)

  if (
    memoryValue?.html &&
    Date.now() - Number(memoryValue.savedAt || 0) <=
      PRESENTER_READER_CACHE_TTL
  ) {
    return memoryValue.html
  }

  const cached =
    readPresenterResourceCache(
      getPresenterReaderStorageKey(segment),
      PRESENTER_READER_CACHE_TTL
    )

  const html =
    String(cached?.data?.html || "")

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

  const key =
    getPresenterReaderCacheKey(segment)

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

    const prefix =
      getPresenterResourceCacheKey("reader_html")

    for (
      let index = localStorage.length - 1;
      index >= 0;
      index -= 1
    ) {
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

function getPresenterReaderSegmentTitle(segment) {
  const key =
    normalizePresenterSegmentKey(segment)

  const item =
    ALL_PRESENTER_SEGMENTS.find(x => {
      return normalizePresenterSegmentKey(x.key) === key
    })

  return item?.title || "الفقرة"
}

function getReaderReadMap() {
  try {
    return JSON.parse(
      localStorage.getItem("presenter_reader_read_map") || "{}"
    )
  } catch {
    return {}
  }
}

function saveReaderReadMap(map) {
  localStorage.setItem(
    "presenter_reader_read_map",
    JSON.stringify(map || {})
  )
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

function readerReadClass(id) {
  return isReaderItemRead(id) ? "readerRead" : ""
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

  const grid =
    document.getElementById("presenterReaderSegmentsGrid")

  const subtitle =
    document.getElementById("presenterReaderSubtitle")

  if (subtitle) {
    const modelName =
      presenterLiveState?.currentModelName || ""

    subtitle.innerText =
      modelName
        ? `النموذج: ${modelName}`
        : `النموذج رقم ${presenterModel}`
  }

  if (!grid) return

  const paintReaderSegments = () => {
    applyPresenterCachedVisibilityNow()

    if (!presenterVisibleSegments.length) {
      applyPresenterVisibleSegments([])
    }

    if (!presenterVisibleSegments.length) {
      grid.innerHTML = `
        <section class="readerEmptyCard">
          لا توجد فقرات مفعلة حاليًا
        </section>
      `
      return
    }

    grid.innerHTML =
      presenterVisibleSegments.map(item => {
        const key =
          normalizePresenterSegmentKey(item.key)

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
  segment =
    normalizePresenterReaderSegmentKey(segment)

  loadPresenterVisibleSegments().catch(() => null)

  if (!isPresenterSegmentVisible(segment)) {
    showToast("هذه الفقرة معطلة من الأدمن")
    await renderPresenterReaderHome()
    return
  }

  presenterReaderSegment = segment
  showPresenterReaderSegmentPage()

  const title =
    document.getElementById("presenterReaderSegmentTitle")

  const panel =
    document.getElementById("presenterReaderPanel")

  if (title) {
    title.innerText =
      getPresenterReaderSegmentTitle(segment)
  }

  if (!panel) return

  const cachedHtml =
    getPresenterReaderCachedHtml(segment)

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
      panel.innerHTML =
        readerEmpty(
          "فقرة حرفلي تعتمد على ملف Excel وأسئلة ثابتة"
        )
    } else if (segment === "randomChallenge") {
      panel.innerHTML =
        readerEmpty(
          "فقرة التحدي لا تحتوي على أسئلة من الأدمن"
        )
    } else if (segment === "archive") {
      await renderPresenterReaderArchive()
    } else {
      const reader =
        getPresenterModuleFunction(
          externalReaders[segment]
        )

      if (!reader) {
        panel.innerHTML =
          readerEmpty(
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
  } catch (error) {
    console.log("READER SEGMENT ERROR:", error)

    panel.innerHTML =
      readerEmpty(
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

/* =========================
   23) READER MEDIA VIEWER
========================= */

function openReaderMediaFromElement(element) {
  if (!element) return

  const type =
    element.dataset.readerMediaType === "video"
      ? "video"
      : "image"

  const src =
    String(element.dataset.readerMediaSrc || "")

  if (!src) return

  openReaderMediaViewer({ type, src })
}

function ensureReaderMediaViewer() {
  let viewer =
    document.getElementById("readerMediaViewer")

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

function openReaderMediaViewer({
  type = "image",
  src = ""
} = {}) {
  const cleanSrc =
    String(src || "")

  if (!cleanSrc) return

  const viewer =
    ensureReaderMediaViewer()

  const content =
    document.getElementById("readerMediaViewerContent")

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
  const viewer =
    document.getElementById("readerMediaViewer")

  const content =
    document.getElementById("readerMediaViewerContent")

  if (content) {
    content.innerHTML = ""
  }

  if (viewer) {
    viewer.classList.add("hidden")
  }

  document.body.classList.remove("readerMediaViewerOpen")
}

/* =========================
   24) READER ARCHIVE
========================= */

async function renderPresenterReaderArchive() {
  const panel =
    document.getElementById("presenterReaderPanel")

  if (!panel) return

  const [boxesRes, itemsRes] =
    await Promise.all([
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
    panel.innerHTML =
      readerEmpty("لا توجد بيانات في الأرشيف")
    return
  }

  const rounds =
    [...new Set([
      ...boxes.map(row => Number(row.round)),
      ...items.map(row => Number(row.round))
    ])].sort((a, b) => a - b)

  panel.innerHTML = `
    <div class="readerRoundsStack">
      ${rounds.map(round => {
        const box =
          boxes.find(row => Number(row.round) === round) || {}

        const roundItems =
          items.filter(row => Number(row.round) === round)

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
                answer:
                  String(item.label || "").trim() === "المطلوب"
                    ? item.text
                    : "",
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
   25) INSIDE MODE SWITCH
========================= */

function ensurePresenterInsideModeSwitch() {
  let box =
    document.getElementById("presenterInsideModeSwitch")

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
  const box =
    document.getElementById("presenterInsideModeSwitch")

  if (!box) return

  const hasSession =
    !!localStorage.getItem("presenter_session_id")

  box.classList.toggle("hidden", !hasSession)

  document
    .getElementById("insideControlModeBtn")
    ?.classList.toggle(
      "active",
      presenterJoinMode === "control"
    )

  document
    .getElementById("insideReaderModeBtn")
    ?.classList.toggle(
      "active",
      presenterJoinMode === "reader"
    )
}

async function switchPresenterInsideMode(mode) {
  const nextMode =
    mode === "reader"
      ? "reader"
      : "control"

  presenterJoinMode = nextMode
  localStorage.setItem(
    "presenter_join_mode",
    presenterJoinMode
  )

  const sessionId =
    localStorage.getItem("presenter_session_id")

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

  presenterReaderSegment = null
  presenterSegment = null

  showPresenterBootLoading(
    "جاري التحويل إلى وضع التحكم..."
  )

  const result =
    await loadPresenterSession(
      sessionId,
      { forceRefresh: true }
    )

  const data = result.data

  if (
    result.error ||
    !data ||
    data.status === "ended"
  ) {
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

function hidePresenterInsideModeSwitch() {
  const box =
    document.getElementById("presenterInsideModeSwitch")

  if (box) {
    box.classList.add("hidden")
  }
}

/* =========================
   26) EXPORTS
========================= */

window.normalizePresenterSegmentKey = normalizePresenterSegmentKey
window.normalizePresenterFinalSegmentKey = normalizePresenterFinalSegmentKey
window.getPresenterSegmentName = getPresenterSegmentName
window.getPresenterFinalRound = getPresenterFinalRound
window.getPresenterFinalRoundTitle = getPresenterFinalRoundTitle
window.getPresenterFinalTeamForRound = getPresenterFinalTeamForRound

window.joinGameSession = joinGameSession
window.presenterGoHome = presenterGoHome
window.openPresenterSegment = openPresenterSegment
window.openPresenterSegmentCard = openPresenterSegmentCard
window.openPresenterFinalCard = openPresenterFinalCard
window.forcePresenterFinalRound = forcePresenterFinalRound
window.selectTeam = selectTeam
window.teamButtons = teamButtons
window.sendCommand = sendCommand
window.showToast = showToast
window.togglePresenterDisplayControls = togglePresenterDisplayControls

window.renderPresenterReaderHome = renderPresenterReaderHome
window.openPresenterReaderSegment = openPresenterReaderSegment
window.reloadPresenterReaderSegment = reloadPresenterReaderSegment
window.presenterReaderLogout = presenterReaderLogout
window.presenterReaderGoHome = presenterReaderGoHome
window.toggleReaderRead = toggleReaderRead
window.openReaderMediaFromElement = openReaderMediaFromElement
window.closeReaderMediaViewer = closeReaderMediaViewer
window.switchPresenterInsideMode = switchPresenterInsideMode
window.setPresenterJoinMode = setPresenterJoinMode