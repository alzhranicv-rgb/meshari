/* =========================
   PRESENTER - SESSION VERSION
========================= */

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
      .select(`
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
      `)
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
        .select(`
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
        `)
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
      .select(`
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
      `)
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

window.normalizePresenterSegmentKey =
  normalizePresenterSegmentKey

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
  { key: "auction", title: "فتبلة", sort: 3 },
  { key: "who", title: "من هو", sort: 4 },
  { key: "explain", title: "اشرح الكلمة", sort: 5 },
  { key: "archive", title: "الأرشيف", sort: 6 },

  { key: "final_round1", title: "ٮدوں ٮڡاط", sort: 7, finalRound: 1 },
  { key: "final_round2", title: "صح صحلي", sort: 8, finalRound: 2 },
  { key: "final_round3", title: "قصة", sort: 9, finalRound: 3 },
  { key: "final_round4", title: "التركيز", sort: 10, finalRound: 4 },

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
    showPresenterJoin()
    return
  }
  const cachedSession =
    readPresenterSessionCache(savedSessionId)

  if (cachedSession) {
    if (cachedSession.status === "ended") {
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
      renderPresenterReaderHome()
   
      } else {
  applyPresenterSessionData(cachedSession)
}
  }

  const result = await loadPresenterSession(
    savedSessionId,
    {
      forceRefresh: true
    }
  )

  if (result.error || !result.data) {
    if (!cachedSession) {
      localStorage.removeItem("presenter_session_id")
      localStorage.removeItem("presenter_join_code")
      showPresenterJoin()
    }

    return
  }

  const data = result.data

  if (data.status === "ended") {
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
    renderPresenterReaderHome()
    return
  }

  applyPresenterSessionData(data)
  subscribeToGameSession(data.id)
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

async function loadPresenterGlobalSegmentVisibilityMap(
  options = {}
) {
  const map = {}

  try {
    let rows = []

    if (
      typeof window.cachedSupabaseSelect ===
      "function"
    ) {
      const result =
        await window.cachedSupabaseSelect(
          "global_segment_visibility",
          {
            select: "segment_key,is_enabled",
            ttl: PRESENTER_GLOBAL_CACHE_TTL,
            forceRefresh:
              options.forceRefresh === true,
            staleWhileRevalidate:
              options.staleWhileRevalidate !== false
          }
        )

      rows = result.data || []

      if (result.error && !rows.length) {
        console.log(
          "PRESENTER GLOBAL VISIBILITY ERROR:",
          result.error
        )
      }
    } else {
      const { data, error } = await db
        .from("global_segment_visibility")
        .select("segment_key,is_enabled")

      if (error) {
        console.log(
          "PRESENTER GLOBAL VISIBILITY ERROR:",
          error
        )
      }

      rows = data || []
    }

    rows.forEach(row => {
      const key = normalizePresenterSegmentKey(
        row.segment_key
      )

      map[key] = row.is_enabled !== false
    })

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
      let result

      if (
        typeof window.loadModelWithRelations ===
        "function"
      ) {
        result =
          await window.loadModelWithRelations(
            modelId,
            {
              ttl: PRESENTER_MODEL_CACHE_TTL,
              forceRefresh:
                options.forceRefresh === true,
              staleWhileRevalidate:
                options.staleWhileRevalidate !== false
            }
          )
      } else {
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
            segment_settings (
              segment,
              item_count
            )
          `)
          .eq("id", modelId)
          .maybeSingle()

        result = {
          data,
          error,
          source: "network"
        }
      }

      if (result?.error && !result?.data) {
        console.log(
          "LOAD PRESENTER MODEL DATA ERROR:",
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
    const [globalMap, modelData] =
      await Promise.all([
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

    return applyPresenterVisibleSegments(
      modelData?.visible_segments || [],
      globalMap
    )
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

async function renderPresenterSegmentsGrid() {
  const grid = document.getElementById("presenterSegmentsGrid")
  if (!grid) return

  await loadPresenterVisibleSegments()

  if (!presenterVisibleSegments.length) {
    grid.innerHTML = `
      <div class="presenterEmptySegments">
        لا توجد فقرات مفعلة حاليًا
      </div>
    `
    return
  }

  grid.innerHTML = presenterVisibleSegments.map(item => {
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
      .select("*")
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

function getPresenterSegmentHandler(segment) {
  const key = normalizePresenterSegmentFromSession(segment)

  const handlers = {
    warmup: {
      render: renderWarmup,
      refresh: refreshPresenterWarmupFromState
    },

    top10: {
      render: renderTop10,
      refresh: refreshPresenterTop10FromState
    },

    auction: {
      render: renderAuction,
      refresh: refreshPresenterAuctionFromState,
      afterRender: () => {
        if (typeof ensurePresenterAuctionVideoButton === "function") {
          setTimeout(ensurePresenterAuctionVideoButton, 120)
        }
      },
      afterRefresh: () => {
        if (typeof ensurePresenterAuctionVideoButton === "function") {
          setTimeout(ensurePresenterAuctionVideoButton, 80)
        }
      }
    },

    who: {
      render: renderWho,
      refresh: refreshPresenterWhoFromState
    },

    explain: {
      render: renderExplain,
      refresh: refreshPresenterExplainFromState
    },

    archive: {
      render: renderArchive,
      refresh: refreshPresenterArchiveFromState
    },

    randomChallenge: {
      render: renderPresenterRandomChallenge,
      refresh: refreshPresenterRandomChallengeFromState
    },

    final: {
      render: renderFinal,
      refresh: refreshPresenterFinalFromState
    }
  }

  return handlers[key] || null
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
      <div class="presenterLabel">جارٍ التحميل...</div>
    </section>
  `
}

async function openPresenterSegmentFromSync(segment) {
  segment = normalizePresenterSegmentFromSession(segment)

  const panel = document.getElementById("presenterPanel")
  if (!panel || !segment) return

  await loadPresenterVisibleSegments()

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
    renderPresenterHome()
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
      .select("*")
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
  updatePresenterLockedSegments()
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

  await loadPresenterVisibleSegments()

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

  await loadPresenterVisibleSegments()

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
  await forcePresenterFinalRound(round)
  await openPresenterSegmentFromSync("final")

  const sent = await sendCommand("openSegment", {
    segment: "final",
    round
  })

  if (!sent) {
    showToast("تعذر فتح الفاصلة في العرض")
  }
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
          class="presenterWarmupCat"
          data-warmup-category="${category}"
        >
          <div class="presenterWarmupCatTitle">
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
                  Number(
                    presenterWarmupSelected.category
                  ) === Number(category) &&
                  Number(
                    presenterWarmupSelected.number
                  ) === Number(number)

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
                      isUsed || locked || presenterWarmupActionBusy
                        ? "disabled"
                        : ""
                    }
                    onclick="
                      openWarmupPresenterQuestion(
                        ${category},
                        ${number},
                        event
                      )
                    "
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
  const box = document.getElementById(
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
      "اختر الفريق ثم رقم السؤال"
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

  panel.innerHTML = `
    <div class="presenterWarmupLayout">

      <section class="presenterWarmupLeft">

        <section
          class="
            presenterCard
            presenterWarmupNumbersCard
          "
        >
          <header class="presenterWarmupCardHeader">

            <div>
              <div class="presenterLabel">
                الفئات والأسئلة
              </div>

              <div
                id="presenterWarmupStatusText"
                class="presenterWarmupStatusText"
              >
                اختر الفريق أولاً
              </div>
            </div>

            <div
              id="presenterWarmupTimer"
              class="presenterWarmupTimer"
              aria-live="polite"
            >
              —
            </div>

          </header>

          <div
            id="presenterWarmupCats"
            class="presenterWarmupCats"
          >
            ${
              presenterWarmupRows.length
                ? buildPresenterWarmupNumbersHtml()
                : `
                  <div class="presenterWarmupLoading">
                    جارٍ تحميل الأسئلة...
                  </div>
                `
            }
          </div>
        </section>

      </section>

      <section class="presenterWarmupRight">

        <div class="presenterWarmupTeamsBox">
          ${teamButtons()}
        </div>

        <section
          class="
            presenterCard
            presenterWarmupPreviewCard
          "
        >
          <div class="presenterWarmupPreviewHead">

            <div class="presenterLabel">
              السؤال
            </div>

            <div
              id="presenterWarmupQuestionMeta"
              class="presenterWarmupQuestionMeta"
            ></div>

          </div>

          <div
            id="presenterWarmupQuestionText"
            class="
              presenterQuestionBody
              presenterBigQuestionBody
            "
          >
            اختر الفريق ثم رقم السؤال
          </div>

          <div class="presenterWarmupAnswerHead">
            <div class="presenterLabel">
              الإجابة
            </div>
          </div>

          <div
            id="presenterWarmupAnswerText"
            class="
              presenterAnswerBody
              presenterBigAnswerBody
            "
          >
            —
          </div>
        </section>

        <div class="presenterWarmupActions">

          <button
            type="button"
            id="presenterWarmupDoubleBtn"
            class="
              presenterBtn
              gray
              presenterDoubleBtn
            "
            onclick="runPresenterWarmupAction('double')"
          >
            دوببلا
          </button>

          <button
            type="button"
            id="presenterWarmupWrongBtn"
            class="
              presenterBtn
              red
              presenterWrongBtn
            "
            onclick="runPresenterWarmupAction('wrong')"
          >
            ✕ خطأ
          </button>

          <button
            type="button"
            id="presenterWarmupCorrectBtn"
            class="
              presenterBtn
              green
              presenterCorrectBtn
            "
            onclick="runPresenterWarmupAction('correct')"
          >
            ✓ صح
          </button>

        </div>

      </section>

    </div>
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
  } else {
    loadPresenterWarmupRows({
      forceRefresh: true,
      backgroundRefresh: false
    }).then(() => {
      if (presenterSegment !== "warmup") {
        return
      }

      renderPresenterWarmupNumbersOnly()
      refreshPresenterWarmupFromState()
    })
  }
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

  /*
    تحديث محلي فوري قبل الشبكة.
  */
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

  const sent = await sendCommand(
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

  /*
    لا ننتظر Supabase.
    التحديث القادم من العرض يثبت الحالة.
  */
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
    if (!currentKey || !locked) {
      showToast("افتح سؤالاً أولاً")
      return
    }
  }

  presenterWarmupActionBusy = true
  updatePresenterWarmupActionButtons()

  const sent = await sendCommand(action, {
    team: activeTeam,
    questionKey: currentKey
  })

  if (!sent) {
    presenterWarmupActionBusy = false
    updatePresenterWarmupActionButtons()
    showToast("تعذر تنفيذ الأمر")
    return
  }

  /*
    بعد صح أو خطأ نفرغ المعاينة محليًا سريعًا.
    الحالة النهائية ستأتي من العرض.
  */
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

  /*
    قبل وصول timerSync نعرض الوقت الأساسي
    بدل ظهور صفر لحظي.
  */
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
      if (
        presenterSegment !== "warmup"
      ) {
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

  updatePresenterTeamButtonsOnly(
    activeTeam
  )

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
   CLEANUP
========================= */

window.addEventListener(
  "beforeunload",
  stopPresenterWarmupTimerWatcher
)
/* =========================
   TOP 10
========================= */

let presenterTop10Rows = []
let presenterTop10LoadedRound = null
let presenterTop10RowsPromise = null
let presenterTop10ActionBusy = false
let presenterTop10PendingNumber = null

const PRESENTER_TOP10_CACHE_TTL = 5 * 60 * 1000

/* =========================
   STATE HELPERS
========================= */

function getPresenterTop10Root() {
  return presenterLiveState?.top10 || {}
}

function getPresenterTop10State() {
  const root = getPresenterTop10Root()

  return root?.top10State || root || {
    round: 1,
    activeTeam: null,

    opened: {
      1: [],
      2: [],
      3: [],
      4: []
    },

    answers: {
      1: {},
      2: {},
      3: {},
      4: {}
    },

    question: {
      1: "",
      2: "",
      3: "",
      4: ""
    },

    errors: {
      1: { A: 0, B: 0 },
      2: { A: 0, B: 0 },
      3: { A: 0, B: 0 },
      4: { A: 0, B: 0 }
    }
  }
}

function getPresenterTop10MaxRound() {
  const root = getPresenterTop10Root()

  return Math.min(
    Math.max(
      Number(
        root?.top10MaxRound ||
        presenterLiveState?.top10MaxRound ||
        localStorage.getItem("top10_max_round") ||
        3
      ),
      1
    ),
    4
  )
}

function getPresenterTop10Round() {
  return Math.min(
    Math.max(
      Number(
        getPresenterTop10State()?.round ||
        1
      ),
      1
    ),
    getPresenterTop10MaxRound()
  )
}

function getPresenterTop10ActiveTeam() {
  const root = getPresenterTop10Root()
  const state = getPresenterTop10State()

  return (
    state?.activeTeam ||
    root?.activeTeam ||
    presenterSelectedTeam ||
    null
  )
}

function getPresenterTop10Opened(
  round = getPresenterTop10Round()
) {
  const top10 = getPresenterTop10State()

  return (
    top10.opened?.[round] || []
  ).map(Number)
}

function getPresenterTop10CurrentNumber() {
  const root = getPresenterTop10Root()
  const state = getPresenterTop10State()

  return Number(
    state?.currentNumber ||
    root?.currentNumber ||
    0
  )
}

function getPresenterTop10PendingScore() {
  const root = getPresenterTop10Root()
  const state = getPresenterTop10State()

  return !!(
    state?.pendingScore ||
    root?.pendingScore
  )
}

function getPresenterTop10Errors(
  round = getPresenterTop10Round()
) {
  const state = getPresenterTop10State()

  return {
    A: Number(
      state.errors?.[round]?.A || 0
    ),

    B: Number(
      state.errors?.[round]?.B || 0
    )
  }
}

function getPresenterTop10Question(
  round = getPresenterTop10Round()
) {
  const state = getPresenterTop10State()

  return (
    state.question?.[round] ||
    state.currentQuestion ||
    "اختر إجابة من القائمة"
  )
}

/* =========================
   OPENED BY STORAGE
========================= */

function getPresenterTop10OpenedByStorageKey() {
  const sessionId =
    presenterSessionId ||
    localStorage.getItem(
      "presenter_session_id"
    ) ||
    "no_session"

  return [
    "presenter_top10_opened_by",
    sessionId,
    Number(presenterModel || 0)
  ].join("_")
}

function loadPresenterTop10OpenedBy() {
  try {
    return JSON.parse(
      localStorage.getItem(
        getPresenterTop10OpenedByStorageKey()
      ) || "{}"
    )
  } catch {
    return {}
  }
}

let presenterTop10OpenedBy =
  loadPresenterTop10OpenedBy()

function savePresenterTop10OpenedBy() {
  try {
    localStorage.setItem(
      getPresenterTop10OpenedByStorageKey(),
      JSON.stringify(
        presenterTop10OpenedBy
      )
    )
  } catch (error) {
    console.log(
      "SAVE TOP10 OPENED BY ERROR:",
      error
    )
  }
}

function getTop10OpenedTeamName(
  round,
  number
) {
  const team =
    presenterTop10OpenedBy[
      `${round}_${number}`
    ]

  if (team === "A") {
    return presenterTeamAName
  }

  if (team === "B") {
    return presenterTeamBName
  }

  return ""
}

/* =========================
   CACHE
========================= */

function getPresenterTop10CacheKey(round) {
  return [
    "presenter_top10_questions",
    Number(presenterModel || 0),
    Number(round || 1)
  ].join("_")
}

function readPresenterTop10Cache(round) {
  try {
    const saved = JSON.parse(
      localStorage.getItem(
        getPresenterTop10CacheKey(round)
      ) || "null"
    )

    if (
      !Array.isArray(saved?.rows) ||
      !saved?.savedAt
    ) {
      return null
    }

    if (
      Date.now() -
      Number(saved.savedAt) >
      PRESENTER_TOP10_CACHE_TTL
    ) {
      return null
    }

    return saved.rows
  } catch {
    return null
  }
}

function savePresenterTop10Cache(
  round,
  rows
) {
  try {
    localStorage.setItem(
      getPresenterTop10CacheKey(round),
      JSON.stringify({
        rows: Array.isArray(rows)
          ? rows
          : [],

        savedAt: Date.now()
      })
    )
  } catch (error) {
    console.log(
      "SAVE TOP10 CACHE ERROR:",
      error
    )
  }
}

async function loadPresenterTop10RoundRows(
  round,
  options = {}
) {
  const safeRound = Number(round || 1)

  if (
    presenterTop10RowsPromise &&
    options.forceRefresh !== true
  ) {
    return presenterTop10RowsPromise
  }

  if (options.forceRefresh !== true) {
    const cachedRows =
      readPresenterTop10Cache(safeRound)

    if (cachedRows?.length) {
      presenterTop10Rows = cachedRows
      presenterTop10LoadedRound = safeRound

      if (
        options.backgroundRefresh !== false
      ) {
        setTimeout(() => {
          loadPresenterTop10RoundRows(
            safeRound,
            {
              forceRefresh: true,
              backgroundRefresh: false
            }
          ).then(() => {
            if (
              presenterSegment === "top10" &&
              getPresenterTop10Round() ===
                safeRound
            ) {
              renderPresenterTop10AnswersOnly()
              refreshPresenterTop10FromState()
            }
          })
        }, 0)
      }

      return cachedRows
    }
  }

  presenterTop10RowsPromise =
    (async () => {
      try {
        const { data, error } = await db
          .from("top10_questions")
          .select(`
            round,
            position,
            question,
            answer
          `)
          .eq(
            "model",
            Number(presenterModel)
          )
          .eq("round", safeRound)
          .order("position", {
            ascending: true
          })

        if (error) {
          console.log(
            "LOAD PRESENTER TOP10 ERROR:",
            error
          )

          return presenterTop10Rows
        }

        presenterTop10Rows =
          Array.isArray(data)
            ? data
            : []

        presenterTop10LoadedRound =
          safeRound

        savePresenterTop10Cache(
          safeRound,
          presenterTop10Rows
        )

        return presenterTop10Rows
      } catch (error) {
        console.log(
          "LOAD PRESENTER TOP10 CATCH:",
          error
        )

        return presenterTop10Rows
      } finally {
        presenterTop10RowsPromise = null
      }
    })()

  return presenterTop10RowsPromise
}

/* =========================
   HTML HELPERS
========================= */

function escapePresenterTop10Html(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function getPresenterTop10Row(number) {
  return presenterTop10Rows.find(row => {
    return (
      Number(row.position) ===
      Number(number)
    )
  })
}

function buildPresenterTop10AnswerButton(
  number
) {
  const round =
    getPresenterTop10Round()

  const opened =
    getPresenterTop10Opened(round)

  const currentNumber =
    getPresenterTop10CurrentNumber()

  const activeTeam =
    getPresenterTop10ActiveTeam()

  const row =
    getPresenterTop10Row(number)

  const isOpened =
    opened.includes(Number(number))

  const isCurrent =
    currentNumber === Number(number)

  const isPending =
    presenterTop10PendingNumber ===
    Number(number)

  const openedName =
    getTop10OpenedTeamName(
      round,
      number
    )

  const disabled =
    isOpened ||
    isPending ||
    presenterTop10ActionBusy ||
    !activeTeam

  return `
    <button
      type="button"
      class="
        presenterTop10AnswerBtn
        ${isOpened ? "opened" : ""}
        ${isCurrent ? "current" : ""}
        ${isPending ? "pending" : ""}
      "
      data-top10-number="${number}"
      ${disabled ? "disabled" : ""}
      onclick="
        openTop10PresenterNumber(
          ${number},
          event
        )
      "
    >
      <span class="presenterTop10AnswerNo">
        ${number}
      </span>

      <span class="presenterTop10AnswerText">
        ${escapePresenterTop10Html(
          row?.answer || "-"
        )}
      </span>

      <span class="presenterTop10OpenedBy">
        ${
          isOpened || isPending
            ? escapePresenterTop10Html(
                openedName ||
                (
                  isPending
                    ? "جارٍ الفتح..."
                    : "تم الفتح"
                )
              )
            : ""
        }
      </span>
    </button>
  `
}

function buildPresenterTop10AnswersHtml() {
  return `
    <div class="
      presenterTop10AnswersCol
      presenterTop10RightCol
    ">
      ${[1, 2, 3, 4, 5]
        .map(number => {
          return buildPresenterTop10AnswerButton(
            number
          )
        })
        .join("")}
    </div>

    <div class="
      presenterTop10AnswersCol
      presenterTop10LeftCol
    ">
      ${[6, 7, 8, 9, 10]
        .map(number => {
          return buildPresenterTop10AnswerButton(
            number
          )
        })
        .join("")}
    </div>
  `
}

function renderPresenterTop10AnswersOnly() {
  const box =
    document.getElementById(
      "presenterTop10AnswersCols"
    )

  if (!box) return

  box.innerHTML =
    buildPresenterTop10AnswersHtml()
}

/* =========================
   MAIN RENDER
========================= */

async function renderTop10() {
  const panel =
    document.getElementById(
      "presenterPanel"
    )

  if (!panel) return

  const round =
    getPresenterTop10Round()

  presenterTop10OpenedBy =
    loadPresenterTop10OpenedBy()

  const cachedRows =
    readPresenterTop10Cache(round)

  if (cachedRows?.length) {
    presenterTop10Rows = cachedRows
    presenterTop10LoadedRound = round
  }

  const errors =
    getPresenterTop10Errors(round)

  panel.innerHTML = `
    <div class="presenterTop10Layout">

      <section class="presenterTop10Left">

        <section class="
          presenterCard
          presenterTop10AnswersCard
        ">

          <header class="presenterTop10AnswersHead">

            <div>
              <div class="presenterLabel">
                الإجابات
              </div>

              <div
                id="presenterTop10StatusText"
                class="presenterTop10StatusText"
              >
                اختر الفريق ثم الإجابة
              </div>
            </div>

            <div class="presenterTop10RoundBadge">
              <span>الجولة</span>

              <strong id="presenterTop10RoundText">
                ${round}
              </strong>
            </div>

          </header>

          <div
            id="presenterTop10AnswersCols"
            class="presenterTop10AnswersCols"
          >
            ${
              presenterTop10Rows.length
                ? buildPresenterTop10AnswersHtml()
                : `
                  <div class="presenterTop10Loading">
                    جارٍ تحميل الإجابات...
                  </div>
                `
            }
          </div>

        </section>

      </section>

      <section class="presenterTop10Right">

        <div class="presenterTop10TeamsBox">
          ${teamButtons()}
        </div>

        <section class="
          presenterCard
          presenterTop10QuestionCard
        ">

          <div class="presenterTop10StatusTop">

            <div class="presenterTop10ErrorsMini">

              <div class="
                presenterTop10ErrorMiniBox
                teamA
              ">
                <span>
                  ${escapePresenterTop10Html(
                    presenterTeamAName
                  )}
                </span>

                <strong id="presenterTop10ErrorsA">
                  ${errors.A} / 3
                </strong>
              </div>

              <div class="
                presenterTop10ErrorMiniBox
                teamB
              ">
                <span>
                  ${escapePresenterTop10Html(
                    presenterTeamBName
                  )}
                </span>

                <strong id="presenterTop10ErrorsB">
                  ${errors.B} / 3
                </strong>
              </div>

            </div>

          </div>

          <div class="presenterTop10QuestionClear">

            <div class="presenterLabel">
              السؤال
            </div>

            <div
              id="presenterTop10QuestionText"
              class="presenterTop10QuestionText"
            >
              ${escapePresenterTop10Html(
                getPresenterTop10Question(round)
              )}
            </div>

          </div>

        </section>

        <div class="presenterTop10Actions">

          <button
            type="button"
            id="presenterTop10DoubleBtn"
            class="
              presenterBtn
              gray
              presenterTop10DoubleBtn
            "
            onclick="
              runPresenterTop10Action('double')
            "
          >
            دوببلا
          </button>

          <button
            type="button"
            id="presenterTop10ShowAnswerBtn"
            class="presenterBtn green"
            onclick="
              runPresenterTop10Action(
                'showAnswer'
              )
            "
          >
            إظهار الإجابات
          </button>

          <button
            type="button"
            id="presenterTop10WrongBtn"
            class="presenterBtn red"
            onclick="
              runPresenterTop10Action('wrong')
            "
          >
            خطأ الفريق
          </button>

          <button
            type="button"
            id="presenterTop10UndoBtn"
            class="presenterBtn gray"
            onclick="
              runPresenterTop10Action('undo')
            "
          >
            تراجع
          </button>

          <button
            type="button"
            id="presenterTop10SwitchBtn"
            class="presenterBtn blue"
            onclick="
              runPresenterTop10Action(
                'switchTurn'
              )
            "
          >
            تبديل الدور
          </button>

          <button
            type="button"
            id="presenterTop10NextRoundBtn"
            class="presenterBtn blue"
            onclick="
              runPresenterTop10Action(
                'nextRound'
              )
            "
          >
            الجولة التالية
          </button>

        </div>

      </section>

    </div>
  `

  refreshPresenterTop10FromState()

  if (!presenterTop10Rows.length) {
    await loadPresenterTop10RoundRows(
      round,
      {
        backgroundRefresh: false
      }
    )

    if (
      presenterSegment !== "top10" ||
      getPresenterTop10Round() !== round
    ) {
      return
    }

    renderPresenterTop10AnswersOnly()
    refreshPresenterTop10FromState()
  } else {
    loadPresenterTop10RoundRows(
      round,
      {
        forceRefresh: true,
        backgroundRefresh: false
      }
    ).then(() => {
      if (
        presenterSegment !== "top10" ||
        getPresenterTop10Round() !== round
      ) {
        return
      }

      renderPresenterTop10AnswersOnly()
      refreshPresenterTop10FromState()
    })
  }
}

/* =========================
   OPEN ANSWER
========================= */

async function openTop10PresenterNumber(
  number,
  event
) {
  const safeNumber =
    Number(number || 0)

  if (
    !safeNumber ||
    presenterTop10ActionBusy ||
    presenterTop10PendingNumber
  ) {
    return
  }

  const round =
    getPresenterTop10Round()

  const opened =
    getPresenterTop10Opened(round)

  const activeTeam =
    getPresenterTop10ActiveTeam()

  if (!activeTeam) {
    showToast("اختر الفريق أولاً")
    return
  }

  if (opened.includes(safeNumber)) {
    showToast("الإجابة مفتوحة")
    return
  }

  presenterTop10PendingNumber =
    safeNumber

  presenterTop10ActionBusy = true

  presenterTop10OpenedBy[
    `${round}_${safeNumber}`
  ] = activeTeam

  savePresenterTop10OpenedBy()

  const teamName =
    activeTeam === "A"
      ? presenterTeamAName
      : presenterTeamBName

  const button =
    event?.currentTarget

  if (button) {
    button.classList.add(
      "opened",
      "pending",
      "top10RevealFx"
    )

    button.disabled = true

    const openedByBox =
      button.querySelector(
        ".presenterTop10OpenedBy"
      )

    if (openedByBox) {
      openedByBox.innerText =
        teamName
    }

    setTimeout(() => {
      button.classList.remove(
        "top10RevealFx"
      )
    }, 350)
  }

  /*
    تحديث محلي فوري للمقدم.
  */
  const currentState =
    getPresenterTop10State()

  presenterLiveState = {
    ...(presenterLiveState || {}),

    top10: {
      ...(presenterLiveState?.top10 || {}),

      activeTeam,

      top10State: {
        ...currentState,
        activeTeam,
        currentNumber: safeNumber,
        pendingScore: true,

        opened: {
          ...(currentState.opened || {}),

          [round]: Array.from(
            new Set([
              ...opened,
              safeNumber
            ])
          )
        }
      }
    }
  }

  refreshPresenterTop10FromState()

  const sent = await sendCommand(
    "openNumber",
    {
      number: safeNumber,
      round,
      team: activeTeam
    }
  )

  presenterTop10ActionBusy = false

  if (!sent) {
    delete presenterTop10OpenedBy[
      `${round}_${safeNumber}`
    ]

    savePresenterTop10OpenedBy()

    presenterTop10PendingNumber = null

    showToast("تعذر فتح الإجابة")

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
    presenterTop10PendingNumber = null
    presenterTop10ActionBusy = false

    refreshPresenterTop10FromState()
  }, 220)
}

/* =========================
   ACTIONS
========================= */

async function runPresenterTop10Action(
  action
) {
  if (presenterTop10ActionBusy) {
    return
  }

  const round =
    getPresenterTop10Round()

  const activeTeam =
    getPresenterTop10ActiveTeam()

  const currentNumber =
    getPresenterTop10CurrentNumber()

  const pendingScore =
    getPresenterTop10PendingScore()

  const maxRound =
    getPresenterTop10MaxRound()

  if (action === "double") {
    if (!activeTeam) {
      showToast("اختر الفريق أولاً")
      return
    }

    if (currentNumber || pendingScore) {
      showToast(
        "فعّل دوببلا قبل فتح الإجابة"
      )
      return
    }
  }

  if (
    action === "wrong" &&
    !activeTeam
  ) {
    showToast("اختر الفريق أولاً")
    return
  }

  if (
    action === "showAnswer" &&
    !currentNumber
  ) {
    showToast("اختر إجابة أولاً")
    return
  }

  if (
    action === "nextRound" &&
    round >= maxRound
  ) {
    showToast("هذه آخر جولة")
    return
  }

  presenterTop10ActionBusy = true
  updatePresenterTop10ActionButtons()

  /*
    تحديث مرئي سريع عند تبديل الدور.
  */
  if (
    action === "switchTurn" &&
    activeTeam
  ) {
    const nextTeam =
      activeTeam === "A" ? "B" : "A"

    presenterSelectedTeam = nextTeam

    setPresenterLocalActiveTeam(
      nextTeam
    )

    updatePresenterTeamButtonsOnly(
      nextTeam
    )
  }

  const sent = await sendCommand(
    action,
    {
      round,
      team: activeTeam,
      number: currentNumber || null
    }
  )

  if (!sent) {
    presenterTop10ActionBusy = false

    updatePresenterTop10ActionButtons()

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

  if (action === "nextRound") {
    const nextRound =
      Math.min(round + 1, maxRound)

    applyPresenterTop10LocalRound(
      nextRound
    )

    await ensurePresenterTop10RoundLoaded(
      nextRound
    )
  }

  setTimeout(() => {
    presenterTop10ActionBusy = false

    updatePresenterTop10ActionButtons()
  }, 300)
}

function updatePresenterTop10ActionButtons() {
  const activeTeam =
    getPresenterTop10ActiveTeam()

  const round =
    getPresenterTop10Round()

  const maxRound =
    getPresenterTop10MaxRound()

  const currentNumber =
    getPresenterTop10CurrentNumber()

  const pendingScore =
    getPresenterTop10PendingScore()

  const busy =
    presenterTop10ActionBusy

  const doubleButton =
    document.getElementById(
      "presenterTop10DoubleBtn"
    )

  const showAnswerButton =
    document.getElementById(
      "presenterTop10ShowAnswerBtn"
    )

  const wrongButton =
    document.getElementById(
      "presenterTop10WrongBtn"
    )

  const undoButton =
    document.getElementById(
      "presenterTop10UndoBtn"
    )

  const switchButton =
    document.getElementById(
      "presenterTop10SwitchBtn"
    )

  const nextRoundButton =
    document.getElementById(
      "presenterTop10NextRoundBtn"
    )

  if (doubleButton) {
    doubleButton.disabled =
      busy ||
      !activeTeam ||
      !!currentNumber ||
      !!pendingScore
  }

  if (showAnswerButton) {
    showAnswerButton.disabled =
      busy ||
      !currentNumber
  }

  if (wrongButton) {
    wrongButton.disabled =
      busy ||
      !activeTeam
  }

  if (undoButton) {
    undoButton.disabled = busy
  }

  if (switchButton) {
    switchButton.disabled =
      busy ||
      !activeTeam
  }

  if (nextRoundButton) {
    nextRoundButton.disabled =
      busy ||
      round >= maxRound

    nextRoundButton.innerText =
      round >= maxRound
        ? "آخر جولة"
        : "الجولة التالية"
  }
}

/* =========================
   ROUND
========================= */

function applyPresenterTop10LocalRound(
  round
) {
  const maxRound =
    getPresenterTop10MaxRound()

  const safeRound =
    Math.min(
      Math.max(
        Number(round || 1),
        1
      ),
      maxRound
    )

  const currentState =
    getPresenterTop10State()

  presenterLiveState = {
    ...(presenterLiveState || {}),

    top10: {
      ...(presenterLiveState?.top10 || {}),

      top10State: {
        ...currentState,
        round: safeRound,
        currentNumber: null,
        currentQuestion: null,
        pendingScore: false
      }
    }
  }

  presenterTop10PendingNumber = null
}

async function ensurePresenterTop10RoundLoaded(
  round
) {
  const safeRound = Number(round || 1)

  const cachedRows =
    readPresenterTop10Cache(safeRound)

  if (cachedRows?.length) {
    presenterTop10Rows = cachedRows
    presenterTop10LoadedRound = safeRound

    renderPresenterTop10AnswersOnly()
    refreshPresenterTop10FromState()

    loadPresenterTop10RoundRows(
      safeRound,
      {
        forceRefresh: true,
        backgroundRefresh: false
      }
    )

    return
  }

  presenterTop10Rows = []
  presenterTop10LoadedRound = null

  const answersBox =
    document.getElementById(
      "presenterTop10AnswersCols"
    )

  if (answersBox) {
    answersBox.innerHTML = `
      <div class="presenterTop10Loading">
        جارٍ تحميل الجولة...
      </div>
    `
  }

  await loadPresenterTop10RoundRows(
    safeRound,
    {
      backgroundRefresh: false
    }
  )

  if (
    presenterSegment !== "top10" ||
    getPresenterTop10Round() !== safeRound
  ) {
    return
  }

  renderPresenterTop10AnswersOnly()
  refreshPresenterTop10FromState()
}

async function setPresenterTop10Round(
  round
) {
  const maxRound =
    getPresenterTop10MaxRound()

  const safeRound =
    Math.min(
      Math.max(
        Number(round || 1),
        1
      ),
      maxRound
    )

  if (
    safeRound ===
    getPresenterTop10Round()
  ) {
    return
  }

  applyPresenterTop10LocalRound(
    safeRound
  )

  await ensurePresenterTop10RoundLoaded(
    safeRound
  )

  const sent = await sendCommand(
    "setRound",
    {
      round: safeRound
    }
  )

  if (!sent) {
    showToast("تعذر تغيير الجولة")

    if (
      typeof fetchPresenterSessionNow ===
      "function"
    ) {
      fetchPresenterSessionNow(
        presenterSessionId,
        true
      )
    }
  }
}

/* =========================
   REFRESH FROM DISPLAY
========================= */

async function refreshPresenterTop10FromState() {
  if (presenterSegment !== "top10") {
    return
  }

  const round =
    getPresenterTop10Round()

  if (
    presenterTop10LoadedRound !==
    round
  ) {
    await ensurePresenterTop10RoundLoaded(
      round
    )

    return
  }

  const opened =
    getPresenterTop10Opened(round)

  const errors =
    getPresenterTop10Errors(round)

  const activeTeam =
    getPresenterTop10ActiveTeam()

  const currentNumber =
    getPresenterTop10CurrentNumber()

  updatePresenterTeamButtonsOnly(
    activeTeam
  )

  const roundText =
    document.getElementById(
      "presenterTop10RoundText"
    )

  if (roundText) {
    roundText.innerText =
      String(round)
  }

  const questionBox =
    document.getElementById(
      "presenterTop10QuestionText"
    )

  if (questionBox) {
    questionBox.innerText =
      getPresenterTop10Question(round)
  }

  const errorsABox =
    document.getElementById(
      "presenterTop10ErrorsA"
    )

  const errorsBBox =
    document.getElementById(
      "presenterTop10ErrorsB"
    )

  if (errorsABox) {
    errorsABox.innerText =
      `${errors.A} / 3`
  }

  if (errorsBBox) {
    errorsBBox.innerText =
      `${errors.B} / 3`
  }

  const statusBox =
    document.getElementById(
      "presenterTop10StatusText"
    )

  if (statusBox) {
    if (!activeTeam) {
      statusBox.innerText =
        "اختر الفريق أولاً"
    } else if (currentNumber) {
      statusBox.innerText =
        "الإجابة مفتوحة"
    } else {
      const teamName =
        activeTeam === "A"
          ? presenterTeamAName
          : presenterTeamBName

      statusBox.innerText =
        `الدور على ${teamName}`
    }
  }

  document
    .querySelectorAll(
      ".presenterTop10AnswerBtn"
    )
    .forEach(button => {
      const number =
        Number(
          button.dataset.top10Number ||
          0
        )

      if (!number) return

      const isOpened =
        opened.includes(number)

      const isCurrent =
        currentNumber === number

      const isPending =
        presenterTop10PendingNumber ===
        number

      const row =
        getPresenterTop10Row(number)

      const answer =
        getPresenterTop10State()
          .answers?.[round]?.[number] ||
        row?.answer ||
        "-"

      button.classList.toggle(
        "opened",
        isOpened
      )

      button.classList.toggle(
        "current",
        isCurrent
      )

      button.classList.toggle(
        "pending",
        isPending
      )

      button.disabled =
        isOpened ||
        isPending ||
        presenterTop10ActionBusy ||
        !activeTeam

      const textBox =
        button.querySelector(
          ".presenterTop10AnswerText"
        )

      if (textBox) {
        textBox.innerText = answer
      }

      const openedByBox =
        button.querySelector(
          ".presenterTop10OpenedBy"
        )

      if (openedByBox) {
        const openedTeamName =
          getTop10OpenedTeamName(
            round,
            number
          )

        openedByBox.innerText =
          isOpened || isPending
            ? (
                openedTeamName ||
                (
                  isPending
                    ? "جارٍ الفتح..."
                    : "تم الفتح"
                )
              )
            : ""
      }
    })

  updatePresenterTop10ActionButtons()
}
/* =========================
   AUCTION / فتبلة
========================= */

let presenterAuctionRows = []
let presenterAuctionRowsPromise = null
let presenterAuctionActionBusy = false
let presenterAuctionPendingNumber = null

const PRESENTER_AUCTION_CACHE_TTL = 5 * 60 * 1000

/* =========================
   STATE HELPERS
========================= */

function getPresenterAuctionRoot() {
  return presenterLiveState?.auction || {}
}

function getPresenterAuctionState() {
  const root = getPresenterAuctionRoot()

  return root?.auctionState || root || {
    usedNumbers: [],
    scoreA: 0,
    scoreB: 0,
    currentQuestionNumber: null,
    pendingScore: false,
    answerShown: false,
    activeTeam: null
  }
}

function getPresenterAuctionMaxNumber() {
  const root = getPresenterAuctionRoot()

  return Math.min(
    Math.max(
      Number(
        root?.auctionMaxNumber ||
        presenterLiveState?.auctionMaxNumber ||
        localStorage.getItem("auction_max_number") ||
        8
      ),
      1
    ),
    8
  )
}

function getPresenterAuctionActiveTeam() {
  const root = getPresenterAuctionRoot()
  const state = getPresenterAuctionState()

  return (
    state?.activeTeam ||
    root?.activeTeam ||
    presenterSelectedTeam ||
    null
  )
}

function getPresenterAuctionCurrentNumber() {
  const root = getPresenterAuctionRoot()
  const state = getPresenterAuctionState()

  return Number(
    state?.currentQuestionNumber ||
    state?.currentNumber ||
    root?.currentQuestionNumber ||
    root?.currentNumber ||
    0
  )
}

function getPresenterAuctionUsedNumbers() {
  const state = getPresenterAuctionState()

  return Array.isArray(state?.usedNumbers)
    ? state.usedNumbers.map(Number)
    : []
}

function isPresenterAuctionPendingScore() {
  const root = getPresenterAuctionRoot()
  const state = getPresenterAuctionState()

  return !!(
    state?.pendingScore ||
    root?.pendingScore
  )
}

function getPresenterAuctionDoubleState() {
  const root = getPresenterAuctionRoot()
  const state = getPresenterAuctionState()

  return (
    root?.auctionDoubleState ||
    state?.auctionDoubleState ||
    {
      used: {
        A: false,
        B: false
      },
      activeTeam: null
    }
  )
}

function isPresenterAuctionDoubleUsed(team) {
  if (team !== "A" && team !== "B") {
    return false
  }

  return !!getPresenterAuctionDoubleState()?.used?.[team]
}

/* =========================
   ROW HELPERS
========================= */

function getPresenterAuctionRow(number) {
  return presenterAuctionRows.find(row => {
    return Number(row.number) === Number(number)
  })
}

function getPresenterAuctionCurrentAnswer() {
  const root = getPresenterAuctionRoot()
  const state = getPresenterAuctionState()
  const currentNumber = getPresenterAuctionCurrentNumber()
  const row = getPresenterAuctionRow(currentNumber)

  return (
    root?.currentAuctionAnswer ||
    state?.currentAuctionAnswer ||
    root?.answer ||
    state?.answer ||
    row?.answer ||
    ""
  )
}

function getPresenterAuctionCurrentImage() {
  const root = getPresenterAuctionRoot()
  const state = getPresenterAuctionState()
  const currentNumber = getPresenterAuctionCurrentNumber()
  const row = getPresenterAuctionRow(currentNumber)

  return (
    root?.currentAuctionImage ||
    state?.currentAuctionImage ||
    root?.image ||
    state?.image ||
    row?.image ||
    ""
  )
}

function getPresenterAuctionCurrentVideo() {
  const root = getPresenterAuctionRoot()
  const state = getPresenterAuctionState()
  const currentNumber = getPresenterAuctionCurrentNumber()
  const row = getPresenterAuctionRow(currentNumber)

  return (
    root?.currentAuctionVideo ||
    state?.currentAuctionVideo ||
    root?.video ||
    state?.video ||
    row?.video ||
    ""
  )
}

function getPresenterAuctionCurrentMediaType() {
  const video = getPresenterAuctionCurrentVideo()
  const image = getPresenterAuctionCurrentImage()

  if (video) return "video"
  if (image) return "image"

  return ""
}

function isPresenterAuctionVideo(url = "") {
  const cleanUrl = String(url || "")
    .split("?")[0]
    .split("#")[0]
    .toLowerCase()

  return (
    cleanUrl.endsWith(".mp4") ||
    cleanUrl.endsWith(".webm") ||
    cleanUrl.endsWith(".mov") ||
    cleanUrl.endsWith(".m4v")
  )
}

/* =========================
   HTML SAFETY
========================= */

function escapePresenterAuctionHtml(value) {
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

function getPresenterAuctionCacheKey() {
  return [
    "presenter_auction_questions",
    Number(presenterModel || 0)
  ].join("_")
}

function readPresenterAuctionCache() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(
        getPresenterAuctionCacheKey()
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
      PRESENTER_AUCTION_CACHE_TTL
    ) {
      return null
    }

    return saved.rows
  } catch {
    return null
  }
}

function savePresenterAuctionCache(rows) {
  try {
    localStorage.setItem(
      getPresenterAuctionCacheKey(),
      JSON.stringify({
        rows: Array.isArray(rows) ? rows : [],
        savedAt: Date.now()
      })
    )
  } catch (error) {
    console.log(
      "SAVE PRESENTER AUCTION CACHE ERROR:",
      error
    )
  }
}

async function loadPresenterAuctionRows(options = {}) {
  if (
    presenterAuctionRowsPromise &&
    options.forceRefresh !== true
  ) {
    return presenterAuctionRowsPromise
  }

  if (options.forceRefresh !== true) {
    const cachedRows = readPresenterAuctionCache()

    if (cachedRows?.length) {
      presenterAuctionRows = cachedRows

      if (options.backgroundRefresh !== false) {
        setTimeout(() => {
          loadPresenterAuctionRows({
            forceRefresh: true,
            backgroundRefresh: false
          }).then(() => {
            if (presenterSegment !== "auction") return

            refreshPresenterAuctionFromState()
          })
        }, 0)
      }

      return cachedRows
    }
  }

  presenterAuctionRowsPromise = (async () => {
    try {
      const { data, error } = await db
        .from("auction_questions")
        .select(`
          number,
          answer,
          image,
          video
        `)
        .eq("model", Number(presenterModel))
        .order("number", {
          ascending: true
        })

      if (error) {
        console.log(
          "LOAD PRESENTER AUCTION ERROR:",
          error
        )

        return presenterAuctionRows
      }

      presenterAuctionRows = Array.isArray(data)
        ? data
        : []

      savePresenterAuctionCache(
        presenterAuctionRows
      )

      return presenterAuctionRows
    } catch (error) {
      console.log(
        "LOAD PRESENTER AUCTION CATCH:",
        error
      )

      return presenterAuctionRows
    } finally {
      presenterAuctionRowsPromise = null
    }
  })()

  return presenterAuctionRowsPromise
}

/* =========================
   GRID HTML
========================= */

function buildPresenterAuctionGridHtml() {
  const maxNumber = getPresenterAuctionMaxNumber()
  const used = getPresenterAuctionUsedNumbers()
  const currentNumber = getPresenterAuctionCurrentNumber()
  const pendingScore = isPresenterAuctionPendingScore()
  const activeTeam = getPresenterAuctionActiveTeam()

  return Array.from(
    { length: maxNumber },
    (_, index) => index + 1
  )
    .map(number => {
      const isUsed = used.includes(number)
      const isCurrent = currentNumber === number
      const isPending =
        presenterAuctionPendingNumber === number

      const disabled =
        isUsed ||
        isPending ||
        presenterAuctionActionBusy ||
        pendingScore ||
        !activeTeam

      return `
        <button
          type="button"
          class="
            presenterNumberBtn
            ${isUsed ? "presenterOpened" : ""}
            ${isCurrent ? "selectedPresenterTeam" : ""}
            ${isPending ? "presenterPendingNumber" : ""}
          "
          data-auction-number="${number}"
          ${disabled ? "disabled" : ""}
          onclick="
            openAuctionPresenterNumber(
              ${number},
              event
            )
          "
          aria-label="فتح رقم ${number}"
        >
          ${isUsed ? "" : number}
        </button>
      `
    })
    .join("")
}

function renderPresenterAuctionGrid() {
  const grid = document.getElementById(
    "presenterAuctionGrid"
  )

  if (!grid) return

  grid.innerHTML = buildPresenterAuctionGridHtml()
}

/* =========================
   MAIN RENDER
========================= */

async function renderAuction() {
  const panel = document.getElementById(
    "presenterPanel"
  )

  if (!panel) return

  const cachedRows = readPresenterAuctionCache()

  if (cachedRows?.length) {
    presenterAuctionRows = cachedRows
  }

  panel.innerHTML = `
    <div class="presenterAuctionLayout">

      <section class="presenterAuctionLeft">

        <section
          class="
            presenterCard
            presenterAuctionNumbersCard
          "
        >
          <header class="presenterAuctionNumbersHead">

            <div>
              <div class="presenterLabel">
                الأرقام
              </div>

              <div
                id="presenterAuctionStatusText"
                class="presenterAuctionStatusText"
              >
                اختر الفريق أولاً
              </div>
            </div>

            <div
              id="presenterAuctionCurrentBadge"
              class="presenterAuctionCurrentBadge"
            >
              —
            </div>

          </header>

          <div
            id="presenterAuctionGrid"
            class="
              presenterGrid
              four
              presenterAuctionGrid
            "
          >
            ${buildPresenterAuctionGridHtml()}
          </div>
        </section>

        <div class="presenterAuctionActions">

          <button
            type="button"
            id="presenterAuctionDoubleBtn"
            class="
              presenterBtn
              gray
              presenterAuctionDoubleBtn
            "
            onclick="
              runPresenterAuctionAction('double')
            "
          >
            دوببلا
          </button>

          <button
            type="button"
            id="presenterAuctionCorrectBtn"
            class="presenterBtn green"
            onclick="
              runPresenterAuctionAction('correct')
            "
          >
            ✓ صحيحة
          </button>

          <button
            type="button"
            id="presenterAuctionWrongBtn"
            class="presenterBtn red"
            onclick="
              runPresenterAuctionAction('wrong')
            "
          >
            ✕ خطأ
          </button>

          <button
            type="button"
            id="presenterAuctionMediaActionBtn"
            class="presenterBtn blue"
            onclick="
              runPresenterAuctionMediaAction()
            "
            disabled
          >
            تكبير
          </button>

          <button
            type="button"
            id="presenterAuctionUndoBtn"
            class="presenterBtn gray"
            onclick="
              runPresenterAuctionAction('undo')
            "
          >
            تراجع
          </button>

        </div>

      </section>

      <section class="presenterAuctionRight">

        <div class="presenterAuctionTeamsBox">
          ${teamButtons()}
        </div>

        <section
          class="
            presenterCard
            presenterAuctionPreviewCard
          "
        >
          <div class="presenterAuctionPreviewHead">

            <div class="presenterLabel">
              الإجابة
            </div>

            <div
              id="presenterAuctionMediaLabel"
              class="presenterAuctionMediaLabel"
            ></div>

          </div>

          <div
            id="presenterAuctionAnswerText"
            class="
              presenterAnswerBody
              presenterAuctionAnswerText
            "
          >
            —
          </div>

          <div
            id="presenterAuctionImageBox"
            class="
              presenterImagePreviewBox
              presenterAuctionImageBox
              hidden
            "
          ></div>
        </section>

      </section>

    </div>
  `

  refreshPresenterAuctionFromState()

  if (!presenterAuctionRows.length) {
    await loadPresenterAuctionRows({
      backgroundRefresh: false
    })

    if (presenterSegment !== "auction") {
      return
    }

    refreshPresenterAuctionFromState()
  } else {
    loadPresenterAuctionRows({
      forceRefresh: true,
      backgroundRefresh: false
    }).then(() => {
      if (presenterSegment !== "auction") return

      refreshPresenterAuctionFromState()
    })
  }
}

/* =========================
   OPEN NUMBER
========================= */

async function openAuctionPresenterNumber(
  number,
  event
) {
  const safeNumber = Number(number || 0)

  if (
    !safeNumber ||
    presenterAuctionActionBusy ||
    presenterAuctionPendingNumber
  ) {
    return
  }

  const used = getPresenterAuctionUsedNumbers()
  const pendingScore = isPresenterAuctionPendingScore()
  const activeTeam = getPresenterAuctionActiveTeam()

  if (!activeTeam) {
    showToast("اختر الفريق أولاً")
    return
  }

  if (pendingScore) {
    showToast("سجل نتيجة السؤال الحالي أولاً")
    return
  }

  if (used.includes(safeNumber)) {
    showToast("الرقم مستخدم")
    return
  }

  presenterAuctionActionBusy = true
  presenterAuctionPendingNumber = safeNumber

  const oldAuctionRoot = getPresenterAuctionRoot()
  const oldAuctionState = getPresenterAuctionState()

  /*
    تحديث محلي فوري للمقدم.
  */
  presenterLiveState = {
    ...(presenterLiveState || {}),

    auction: {
      ...oldAuctionRoot,

      activeTeam,

      currentQuestionNumber: safeNumber,
      pendingScore: true,

      auctionState: {
        ...oldAuctionState,

        activeTeam,
        currentQuestionNumber: safeNumber,
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

  showPresenterAuctionPreview(safeNumber)
  refreshPresenterAuctionFromState()

  const sent = await sendCommand(
    "openNumber",
    {
      number: safeNumber,
      team: activeTeam
    }
  )

  presenterAuctionActionBusy = false

  if (!sent) {
    presenterAuctionPendingNumber = null

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
    presenterAuctionPendingNumber = null
    presenterAuctionActionBusy = false

    refreshPresenterAuctionFromState()
  }, 220)
}

/* =========================
   PREVIEW
========================= */

function renderPresenterAuctionMedia(
  box,
  mediaUrl
) {
  if (!box) return

  const safeUrl = String(mediaUrl || "").trim()

  if (
    !safeUrl ||
    isPresenterAuctionVideo(safeUrl)
  ) {
    box.classList.add("hidden")
    box.innerHTML = ""
    return
  }

  box.classList.remove("hidden")

  box.innerHTML = `
    <img
      src="${escapePresenterAuctionHtml(safeUrl)}"
      alt="صورة السؤال"
      loading="eager"
      decoding="async"
    >
  `
}

function showPresenterAuctionPreview(number) {
  const row = getPresenterAuctionRow(number)

  const answerBox = document.getElementById(
    "presenterAuctionAnswerText"
  )

  const imageBox = document.getElementById(
    "presenterAuctionImageBox"
  )

  const mediaLabel = document.getElementById(
    "presenterAuctionMediaLabel"
  )

  const answer =
    row?.answer ||
    getPresenterAuctionCurrentAnswer() ||
    "لا توجد إجابة"

  const image =
    row?.image ||
    getPresenterAuctionCurrentImage() ||
    ""

  const video =
    row?.video ||
    getPresenterAuctionCurrentVideo() ||
    ""

  if (answerBox) {
    answerBox.innerText = answer
  }

  if (imageBox) {
    if (image) {
      renderPresenterAuctionMedia(
        imageBox,
        image
      )
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

  updatePresenterAuctionMediaActionButton()
}

/* =========================
   MEDIA ACTION
========================= */

function updatePresenterAuctionMediaActionButton() {
  const button = document.getElementById(
    "presenterAuctionMediaActionBtn"
  )

  if (!button) return

  const currentNumber =
    getPresenterAuctionCurrentNumber()

  const mediaType =
    getPresenterAuctionCurrentMediaType()

  button.classList.remove(
    "presenterAuctionVideoBtn",
    "presenterAuctionImageBtn"
  )

  if (
    !currentNumber ||
    !mediaType ||
    presenterAuctionActionBusy
  ) {
    button.disabled = true
    button.innerText = "تكبير"
    return
  }

  button.disabled = false

  if (mediaType === "video") {
    button.classList.add(
      "presenterAuctionVideoBtn"
    )

    button.innerText = "▶ تشغيل الفيديو"
    return
  }

  button.classList.add(
    "presenterAuctionImageBtn"
  )

  button.innerText = "تكبير الصورة"
}

async function runPresenterAuctionMediaAction() {
  if (presenterAuctionActionBusy) return

  const currentNumber =
    getPresenterAuctionCurrentNumber()

  const mediaType =
    getPresenterAuctionCurrentMediaType()

  if (!currentNumber) {
    showToast("اختر رقمًا أولاً")
    return
  }

  if (!mediaType) {
    showToast("لا توجد صورة أو فيديو")
    return
  }

  presenterAuctionActionBusy = true
  updatePresenterAuctionMediaActionButton()

  /*
    الفيديو يحتاج أمرًا واحدًا فقط.
    لا نرسل zoomImage ثم playAuctionVideo.
  */
  const action =
    mediaType === "video"
      ? "playAuctionVideo"
      : "zoomImage"

  const sent = await sendCommand(action, {
    number: currentNumber
  })

  presenterAuctionActionBusy = false
  updatePresenterAuctionMediaActionButton()

  if (!sent) {
    showToast(
      mediaType === "video"
        ? "تعذر تشغيل الفيديو"
        : "تعذر تكبير الصورة"
    )
  }
}

/* =========================
   SCORE ACTIONS
========================= */

async function runPresenterAuctionAction(action) {
  if (presenterAuctionActionBusy) return

  const activeTeam =
    getPresenterAuctionActiveTeam()

  const currentNumber =
    getPresenterAuctionCurrentNumber()

  const pendingScore =
    isPresenterAuctionPendingScore()

  if (action === "double") {
    if (!activeTeam) {
      showToast("اختر الفريق أولاً")
      return
    }

    if (currentNumber || pendingScore) {
      showToast("فعّل دوببلا قبل فتح الرقم")
      return
    }

    if (isPresenterAuctionDoubleUsed(activeTeam)) {
      showToast("تم استخدام دوببلا لهذا الفريق")
      return
    }
  }

  if (
    action === "correct" ||
    action === "wrong"
  ) {
    if (!currentNumber || !pendingScore) {
      showToast("افتح رقمًا أولاً")
      return
    }

    if (!activeTeam) {
      showToast("اختر الفريق أولاً")
      return
    }
  }

  presenterAuctionActionBusy = true
  updatePresenterAuctionActionButtons()

  const sent = await sendCommand(action, {
    team: activeTeam,
    number: currentNumber || null
  })

  if (!sent) {
    presenterAuctionActionBusy = false

    updatePresenterAuctionActionButtons()
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
    presenterAuctionActionBusy = false

    updatePresenterAuctionActionButtons()
  }, action === "undo" ? 220 : 350)
}

function updatePresenterAuctionActionButtons() {
  const activeTeam =
    getPresenterAuctionActiveTeam()

  const currentNumber =
    getPresenterAuctionCurrentNumber()

  const pendingScore =
    isPresenterAuctionPendingScore()

  const doubleUsed =
    isPresenterAuctionDoubleUsed(activeTeam)

  const busy =
    presenterAuctionActionBusy

  const doubleButton =
    document.getElementById(
      "presenterAuctionDoubleBtn"
    )

  const correctButton =
    document.getElementById(
      "presenterAuctionCorrectBtn"
    )

  const wrongButton =
    document.getElementById(
      "presenterAuctionWrongBtn"
    )

  const undoButton =
    document.getElementById(
      "presenterAuctionUndoBtn"
    )

  if (doubleButton) {
    doubleButton.disabled =
      busy ||
      !activeTeam ||
      !!currentNumber ||
      !!pendingScore ||
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
    busy ||
    !activeTeam ||
    !currentNumber ||
    !pendingScore

  if (correctButton) {
    correctButton.disabled = scoreDisabled
  }

  if (wrongButton) {
    wrongButton.disabled = scoreDisabled
  }

  if (undoButton) {
    undoButton.disabled = busy
  }

  updatePresenterAuctionMediaActionButton()
}

/* =========================
   REFRESH FROM DISPLAY
========================= */

function refreshPresenterAuctionFromState() {
  if (presenterSegment !== "auction") return

  const maxNumber =
    getPresenterAuctionMaxNumber()

  const used =
    getPresenterAuctionUsedNumbers()

  const currentNumber =
    getPresenterAuctionCurrentNumber()

  const pendingScore =
    isPresenterAuctionPendingScore()

  const activeTeam =
    getPresenterAuctionActiveTeam()

  updatePresenterTeamButtonsOnly(
    activeTeam
  )

  const grid = document.getElementById(
    "presenterAuctionGrid"
  )

  if (
    grid &&
    grid.querySelectorAll(
      "[data-auction-number]"
    ).length !== maxNumber
  ) {
    renderPresenterAuctionGrid()
  }

  document
    .querySelectorAll(
      "#presenterAuctionGrid .presenterNumberBtn"
    )
    .forEach(button => {
      const number = Number(
        button.dataset.auctionNumber || 0
      )

      if (!number) return

      const isUsed =
        used.includes(number)

      const isCurrent =
        currentNumber === number

      const isPending =
        presenterAuctionPendingNumber ===
        number

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

      button.disabled =
        isUsed ||
        isPending ||
        presenterAuctionActionBusy ||
        pendingScore ||
        !activeTeam

      button.innerText =
        isUsed ? "" : String(number)
    })

  const currentBadge =
    document.getElementById(
      "presenterAuctionCurrentBadge"
    )

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

  const statusBox =
    document.getElementById(
      "presenterAuctionStatusText"
    )

  if (statusBox) {
    if (!activeTeam) {
      statusBox.innerText =
        "اختر الفريق أولاً"
    } else if (currentNumber && pendingScore) {
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

  const answerBox =
    document.getElementById(
      "presenterAuctionAnswerText"
    )

  const imageBox =
    document.getElementById(
      "presenterAuctionImageBox"
    )

  const mediaLabel =
    document.getElementById(
      "presenterAuctionMediaLabel"
    )

  if (currentNumber) {
    showPresenterAuctionPreview(
      currentNumber
    )
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

  updatePresenterAuctionActionButtons()
}
/* =========================
   WHO / من هو
========================= */

let presenterWhoRows = []
let presenterWhoRowsPromise = null
let presenterWhoActionBusy = false
let presenterWhoPendingNumber = null

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
    root?.activeTeam ||
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
          image,
          video
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
    <div class="presenterWhoLayout">

      <section class="presenterWhoLeft">

        <section
          class="
            presenterCard
            presenterWhoNumbersCard
          "
        >
          <header class="presenterWhoCardHeader">

            <div>
              <div class="presenterLabel">
                النقاط
              </div>

              <div
                id="presenterWhoStatusText"
                class="presenterWhoStatusText"
              >
                اختر الفريق ثم النقاط
              </div>
            </div>

            <div
              id="presenterWhoCurrentBadge"
              class="presenterWhoCurrentBadge"
            >
              —
            </div>

          </header>

          <div
            id="presenterWhoPointsGrid"
            class="presenterWhoPointsGrid"
          >
            ${buildPresenterWhoPointsHtml()}
          </div>

          <div
            class="
              presenterLabel
              presenterWhoNumbersLabel
            "
          >
            الأرقام
          </div>

          <div
            id="presenterWhoGrid"
            class="presenterWhoGrid"
          >
            ${buildPresenterWhoNumbersHtml()}
          </div>
        </section>

        <div class="presenterWhoActions">

          <button
            type="button"
            id="presenterWhoDoubleBtn"
            class="
              presenterBtn
              gray
              presenterWhoDoubleBtn
            "
            onclick="
              runPresenterWhoAction('double')
            "
          >
            دوببلا
          </button>

          <button
            type="button"
            id="presenterWhoCompensationBtn"
            class="
              presenterBtn
              gray
              presenterWhoCompensationBtn
            "
            onclick="
              runPresenterWhoAction(
                'compensation'
              )
            "
          >
            التعويض
          </button>

          <button
            type="button"
            id="presenterWhoCorrectBtn"
            class="presenterBtn green"
            onclick="
              sendPresenterWhoScore('correct')
            "
          >
            ✓ صح
          </button>

          <button
            type="button"
            id="presenterWhoWrongBtn"
            class="presenterBtn red"
            onclick="
              sendPresenterWhoScore('wrong')
            "
          >
            ✕ خطأ
          </button>

        </div>

      </section>

      <section class="presenterWhoRight">

        <div class="presenterWhoTeamsBox">
          ${teamButtons()}
        </div>

        <section
          class="
            presenterCard
            presenterWhoPreviewCard
          "
        >
          <div class="presenterWhoPreviewHead">

            <div class="presenterLabel">
              الإجابة
            </div>

            <div
              id="presenterWhoMediaLabel"
              class="presenterWhoMediaLabel"
            ></div>

          </div>

          <div
            id="presenterWhoAnswerText"
            class="presenterAnswerBody"
          >
            —
          </div>

          <div
            id="presenterWhoImageBox"
            class="
              presenterImagePreviewBox
              presenterWhoImageBox
              hidden
            "
          ></div>
        </section>

      </section>

    </div>
  `

  refreshPresenterWhoFromState()

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
      forceRefresh: true,
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

  const sent = await sendCommand(
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

  const sent = await sendCommand(
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

  const sent = await sendCommand(
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

  if (!number) {
    showToast("اختر رقمًا أولاً")
    return
  }

  if (!team && !compensationMode) {
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

  const sent = await sendCommand(
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
      !canPresenterWhoCompensation()
  }

  const scoreDisabled =
    busy ||
    presenterWhoScoreLocked ||
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

function refreshPresenterWhoFromState() {
  if (presenterSegment !== "who") return

  const used = getPresenterWhoUsedNumbers()
  const currentNumber = getPresenterWhoCurrentNumber()
  const locked = getPresenterWhoLocked()
  const currentPoints = getPresenterWhoCurrentPoints()
  const compensationMode = getPresenterWhoCompensationMode()
  const activeTeam = getPresenterWhoActiveTeam()

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
    if (compensationMode) {
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
}
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

  panel.innerHTML = `
    <div class="presenterExplainLayout">

      <section class="presenterExplainLeft">

        <section
          class="
            presenterCard
            presenterExplainNumbersCard
          "
        >
          <header class="presenterExplainNumbersHead">

            <div>
              <div class="presenterLabel">
                الأرقام
              </div>

              <div
                id="presenterExplainStatusText"
                class="presenterExplainStatusText"
              >
                اختر الفريق ثم الرقم
              </div>
            </div>

            <div
              id="presenterExplainCurrentBadge"
              class="presenterExplainCurrentBadge"
            >
              ${
                currentNumber
                  ? `رقم ${currentNumber}`
                  : "—"
              }
            </div>

          </header>

          <div
            id="presenterExplainNumbersGrid"
            class="presenterExplainNumbersGrid"
            style="
              grid-template-columns:
              repeat(${count}, minmax(0, 1fr));
            "
          >
            ${buildPresenterExplainNumbersHtml()}
          </div>
        </section>

        <div class="presenterExplainActions">

          <button
            type="button"
            id="presenterExplainStartTimerBtn"
            class="
              presenterBtn
              dark
              presenterExplainStartTimerBtn
            "
            onclick="
              runPresenterExplainAction(
                'startTimer'
              )
            "
          >
            بدء المؤقت
          </button>

          <button
            type="button"
            id="presenterExplainToggleWordBtn"
            class="
              presenterBtn
              blue
              presenterExplainToggleWordBtn
            "
            onclick="
              runPresenterExplainAction(
                'toggleWordVisible'
              )
            "
          >
            إخفاء الكلمة
          </button>

          <button
            type="button"
            id="presenterExplainCorrectBtn"
            class="
              presenterBtn
              green
              presenterExplainCorrectBtn
            "
            onclick="
              runPresenterExplainAction(
                'correct'
              )
            "
          >
            ✓ صح
          </button>

          <button
            type="button"
            id="presenterExplainWrongBtn"
            class="
              presenterBtn
              red
              presenterExplainWrongBtn
            "
            onclick="
              runPresenterExplainAction(
                'wrong'
              )
            "
          >
            ✕ خطأ
          </button>

        </div>

      </section>

      <section class="presenterExplainRight">

        <div class="presenterExplainTeamsBox">
          ${teamButtons()}
        </div>

        <section
          class="
            presenterCard
            presenterExplainWordCard
          "
        >
          <div class="presenterExplainWordHead">

            <div class="presenterLabel">
              الكلمة
            </div>

            <div
              id="presenterExplainWordState"
              class="presenterExplainWordState"
            ></div>

          </div>

          <div
            id="presenterExplainWordText"
            class="
              presenterExplainWordBox
              ${
                explain.answerResult === "correct"
                  ? "answerCorrect"
                  : ""
              }
              ${
                explain.answerResult === "wrong"
                  ? "answerWrong"
                  : ""
              }
            "
          >
            ${
              currentNumber
                ? escapePresenterExplainHtml(
                    currentWord || "—"
                  )
                : "—"
            }
          </div>
        </section>

        <section
          class="
            presenterCard
            presenterExplainTimerCard
          "
        >
          <div class="presenterLabel">
            المؤقت
          </div>

          <div
            id="presenterExplainTimerText"
            class="
              presenterExplainTimerBox
              ${
                getPresenterExplainTimerVisible()
                  ? ""
                  : "hidden"
              }
            "
          >
            ${
              getPresenterExplainTimerVisible()
                ? getPresenterExplainRemainingTime()
                : "—"
            }
          </div>
        </section>

      </section>

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
   RANDOM CHALLENGE / التحدي
========================= */

let presenterRandomAuctionLocalCount = 0
let presenterRandomAuctionFixedPoints = 0
let presenterRandomLastUiMode = ""

let presenterRandomActionBusy = false
let presenterRandomAuctionInputTimer = null
let presenterRandomTimerWatcher = null
let presenterRandomPendingBox = null
let presenterRandomLastScoreKey = ""

const PRESENTER_RANDOM_INPUT_DELAY = 220

/* =========================
   HELPERS
========================= */

function presenterRandomSafeHtml(value = "") {
  if (typeof presenterSafeHtml === "function") {
    return presenterSafeHtml(value)
  }

  if (typeof escapeDisplayHtml === "function") {
    return escapeDisplayHtml(value)
  }

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function getPresenterRandomChallengeRoot() {
  return presenterLiveState?.randomChallenge || {}
}

function getPresenterRandomChallengeState() {
  const root = getPresenterRandomChallengeRoot()

  return {
    scores: {
      A: Number(root?.scores?.A || 0),
      B: Number(root?.scores?.B || 0)
    },

    activeTeam: root?.activeTeam || null,
    currentBox: root?.currentBox || null,
    completed: !!root?.completed,

    box1: {
      active: false,
      started: false,
      rolling: false,
      flashing: false,
      finished: false,
      pool: "",
      images: [],
      recentTeamKeys: [],
      ...(root?.box1 || {})
    },

    box2: {
      active: false,
      finished: false,
      numberInput: "",
      points: 0,
      calculatedPoints: 0,
      timer: 30,
      timerRunning: false,
      timerEndsAt: 0,
      timerSync: null,
      ...(root?.box2 || {})
    },

    box3: {
      active: false,
      finished: false,
      activeTeam: null,
      errors: {
        A: 0,
        B: 0,
        ...(root?.box3?.errors || {})
      },
      passUsed: {
        A: false,
        B: false,
        ...(root?.box3?.passUsed || {})
      },
      choosingPoints: false,
      timer: 5,
      timerRunning: false,
      timerEndsAt: 0,
      timerSync: null,
      ...(root?.box3 || {})
    },

    box4: {
      active: false,
      finished: false,
      ...(root?.box4 || {})
    }
  }
}

function getPresenterRandomCurrentBox() {
  return Number(
    getPresenterRandomChallengeState()?.currentBox || 0
  )
}

function getPresenterRandomActiveTeam() {
  const state = getPresenterRandomChallengeState()

  return (
    state?.box3?.activeTeam ||
    state?.activeTeam ||
    presenterSelectedTeam ||
    null
  )
}

function getPresenterRandomBoxTitle(box) {
  const number = Number(box || 0)

  if (number === 1) return "اللاعب المشترك"
  if (number === 2) return "المزاد"
  if (number === 3) return "ماذا تعرف"
  if (number === 4) return "قريبًا"

  return "التحدي"
}

function getPresenterRandomUiMode() {
  const state = getPresenterRandomChallengeState()
  const box = Number(state?.currentBox || 0)

  if (!box) return "select"
  if (box === 2) return "auction"

  if (
    box === 3 &&
    state.box3?.choosingPoints
  ) {
    return "box3Score"
  }

  if (box === 3) {
    return "box3Play"
  }

  return `box${box}`
}

function getPresenterRandomTeamName(team) {
  if (team === "A") {
    return presenterTeamAName
  }

  if (team === "B") {
    return presenterTeamBName
  }

  return ""
}

function getPresenterRandomImageName(item) {
  const raw =
    typeof item === "string"
      ? item
      : item?.image ||
        item?.src ||
        item?.url ||
        item?.name ||
        item?.title ||
        item?.team ||
        item?.club ||
        ""

  const fileName = String(raw)
    .split("/")
    .pop()
    .split("\\")
    .pop()
    .replace(/\.[a-z0-9]+$/i, "")

  return fileName
    .replace(/[0-9٠-٩]/g, "")
    .replace(/[()]/g, "")
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function getPresenterRandomBox1Players(
  state = getPresenterRandomChallengeState()
) {
  const box1 = state?.box1 || {}

  if (
    Array.isArray(box1.images) &&
    box1.images.length
  ) {
    return box1.images
  }

  if (
    Array.isArray(box1.players) &&
    box1.players.length
  ) {
    return box1.players
  }

  if (
    Array.isArray(box1.currentPlayers) &&
    box1.currentPlayers.length
  ) {
    return box1.currentPlayers
  }

  if (
    Array.isArray(box1.selectedImages) &&
    box1.selectedImages.length
  ) {
    return box1.selectedImages
  }

  return [
    box1.currentPlayer ||
      box1.currentName ||
      "",

    box1.secondPlayer ||
      box1.secondName ||
      ""
  ]
}

/* =========================
   AUCTION POINTS
========================= */

function getPresenterRandomAuctionCount(
  state = getPresenterRandomChallengeState()
) {
  return Number(
    presenterRandomAuctionLocalCount ||
    state.box2?.points ||
    state.box2?.numberInput ||
    0
  )
}

function calcPresenterRandomAuctionFixedPoints(count) {
  const number = Number(count || 0)

  if (!number) return 0
  if (number > 0 && number < 10) return 1

  return Math.floor(number / 10)
}

function getPresenterRandomAuctionFixedPoints(
  state = getPresenterRandomChallengeState()
) {
  return Number(
    presenterRandomAuctionFixedPoints ||
    state.box2?.calculatedPoints ||
    calcPresenterRandomAuctionFixedPoints(
      getPresenterRandomAuctionCount(state)
    ) ||
    0
  )
}

function updatePresenterRandomAuctionLocalState(
  count,
  fixedPoints,
  options = {}
) {
  const oldRandom =
    presenterLiveState?.randomChallenge || {}

  presenterLiveState = {
    ...(presenterLiveState || {}),

    randomChallenge: {
      ...oldRandom,

      currentBox: 2,

      box2: {
        ...(oldRandom.box2 || {}),
        active: true,
        numberInput: String(count || ""),
        points: Number(count || 0),
        calculatedPoints: Number(
          fixedPoints || 0
        )
      }
    }
  }

  if (options.refresh !== false) {
    refreshPresenterRandomChallengeFromState()
  }
}

function syncPresenterRandomAuctionPoints(
  count,
  fixedPoints,
  keepFixedPoints = false
) {
  clearTimeout(
    presenterRandomAuctionInputTimer
  )

  presenterRandomAuctionInputTimer =
    setTimeout(() => {
      sendCommand(
        "randomSetAuctionPoints",
        {
          points: Number(count || 0),
          count: Number(count || 0),

          calculatedPoints:
            Number(fixedPoints || 0),

          keepFixedPoints:
            !!keepFixedPoints
        }
      )
    }, PRESENTER_RANDOM_INPUT_DELAY)
}

function setPresenterRandomAuctionPoints(
  value,
  shouldSync = true
) {
  const clean = Math.max(
    0,
    Number(
      String(value || "")
        .replace(/\D/g, "") || 0
    )
  )

  presenterRandomAuctionLocalCount =
    clean

  presenterRandomAuctionFixedPoints =
    calcPresenterRandomAuctionFixedPoints(
      clean
    )

  updatePresenterRandomAuctionLocalState(
    presenterRandomAuctionLocalCount,
    presenterRandomAuctionFixedPoints,
    {
      refresh: false
    }
  )

  const input = document.getElementById(
    "presenterRandomAuctionInput"
  )

  const countBox = document.getElementById(
    "presenterRandomAuctionCount"
  )

  const fixedBox = document.getElementById(
    "presenterRandomAuctionFixed"
  )

  if (
    input &&
    document.activeElement !== input
  ) {
    input.value = clean || ""
  }

  if (countBox) {
    countBox.innerText = String(clean)
  }

  if (fixedBox) {
    fixedBox.innerText = String(
      presenterRandomAuctionFixedPoints
    )
  }

  if (shouldSync) {
    syncPresenterRandomAuctionPoints(
      clean,
      presenterRandomAuctionFixedPoints,
      false
    )
  }
}

function decreasePresenterRandomAuctionPoints() {
  if (presenterRandomActionBusy) return

  const current = Number(
    presenterRandomAuctionLocalCount || 0
  )

  const fixed = Number(
    presenterRandomAuctionFixedPoints ||
    calcPresenterRandomAuctionFixedPoints(
      current
    )
  )

  const next = Math.max(
    0,
    current - 1
  )

  presenterRandomAuctionLocalCount =
    next

  /*
    عند الإنقاص نحافظ على النقاط
    المحسوبة كما في النظام السابق.
  */
  presenterRandomAuctionFixedPoints =
    fixed

  updatePresenterRandomAuctionLocalState(
    next,
    fixed,
    {
      refresh: false
    }
  )

  const input = document.getElementById(
    "presenterRandomAuctionInput"
  )

  const countBox = document.getElementById(
    "presenterRandomAuctionCount"
  )

  const fixedBox = document.getElementById(
    "presenterRandomAuctionFixed"
  )

  if (input) {
    input.value = next || ""
  }

  if (countBox) {
    countBox.innerText = String(next)
  }

  if (fixedBox) {
    fixedBox.innerText = String(fixed)
  }

  syncPresenterRandomAuctionPoints(
    next,
    fixed,
    true
  )
}

/* =========================
   TIMER HELPERS
========================= */

function getPresenterRandomTimerEndsAt(boxNumber) {
  const state =
    getPresenterRandomChallengeState()

  if (Number(boxNumber) === 2) {
    return Number(
      state.box2?.timerEndsAt ||
      state.box2?.timerSync?.endsAt ||
      0
    )
  }

  if (Number(boxNumber) === 3) {
    return Number(
      state.box3?.timerEndsAt ||
      state.box3?.timerSync?.endsAt ||
      0
    )
  }

  return 0
}

function getPresenterRandomTimerRunning(boxNumber) {
  const state =
    getPresenterRandomChallengeState()

  if (Number(boxNumber) === 2) {
    return !!(
      state.box2?.timerRunning ||
      state.box2?.timerSync?.running
    )
  }

  if (Number(boxNumber) === 3) {
    return !!(
      state.box3?.timerRunning ||
      state.box3?.timerSync?.running
    )
  }

  return false
}

function getPresenterRandomRemainingTime(
  boxNumber
) {
  const state =
    getPresenterRandomChallengeState()

  const endsAt =
    getPresenterRandomTimerEndsAt(
      boxNumber
    )

  if (endsAt > 0) {
    return Math.max(
      0,
      Math.ceil(
        (endsAt - Date.now()) / 1000
      )
    )
  }

  if (Number(boxNumber) === 2) {
    return Math.max(
      0,
      Number(state.box2?.timer ?? 30)
    )
  }

  if (Number(boxNumber) === 3) {
    return Math.max(
      0,
      Number(state.box3?.timer ?? 5)
    )
  }

  return 0
}

function updatePresenterRandomTimers() {
  if (
    presenterSegment !==
    "randomChallenge"
  ) {
    return
  }

  const auctionTimer =
    document.getElementById(
      "presenterRandomAuctionTimer"
    )

  if (auctionTimer) {
    const remaining =
      getPresenterRandomRemainingTime(2)

    auctionTimer.innerText =
      String(remaining)

    auctionTimer.classList.toggle(
      "danger",
      remaining > 0 &&
      remaining <= 5
    )

    auctionTimer.classList.toggle(
      "presenterTimerDanger",
      remaining > 0 &&
      remaining <= 5
    )

    auctionTimer.classList.toggle(
      "presenterTimerFinished",
      remaining === 0
    )
  }

  const box3Timer =
    document.getElementById(
      "presenterRandomBox3Timer"
    )

  if (box3Timer) {
    const remaining =
      getPresenterRandomRemainingTime(3)

    box3Timer.innerText =
      String(remaining)

    box3Timer.classList.toggle(
      "danger",
      remaining > 0 &&
      remaining <= 2
    )

    box3Timer.classList.toggle(
      "presenterTimerDanger",
      remaining > 0 &&
      remaining <= 2
    )

    box3Timer.classList.toggle(
      "presenterTimerFinished",
      remaining === 0
    )
  }
}

function startPresenterRandomTimerWatcher() {
  stopPresenterRandomTimerWatcher()

  updatePresenterRandomTimers()

  presenterRandomTimerWatcher =
    setInterval(() => {
      if (
        presenterSegment !==
        "randomChallenge"
      ) {
        stopPresenterRandomTimerWatcher()
        return
      }

      updatePresenterRandomTimers()
    }, 250)
}

function stopPresenterRandomTimerWatcher() {
  if (!presenterRandomTimerWatcher) {
    return
  }

  clearInterval(
    presenterRandomTimerWatcher
  )

  presenterRandomTimerWatcher = null
}

/* =========================
   LOCAL STATE
========================= */

function applyPresenterRandomLocalBox(box) {
  const number = Number(box || 0)

  if (!number) return

  const oldRandom =
    presenterLiveState?.randomChallenge || {}

  presenterLiveState = {
    ...(presenterLiveState || {}),

    randomChallenge: {
      ...oldRandom,

      currentBox: number,
      activeTeam: null,

      box1: {
        ...(oldRandom.box1 || {}),
        active: number === 1,

        started:
          number === 1
            ? false
            : !!oldRandom.box1?.started,

        rolling:
          number === 1
            ? false
            : !!oldRandom.box1?.rolling,

        flashing:
          number === 1
            ? false
            : !!oldRandom.box1?.flashing,

        images:
          number === 1
            ? []
            : oldRandom.box1?.images || []
      },

      box2: {
        ...(oldRandom.box2 || {}),
        active: number === 2
      },

      box3: {
        ...(oldRandom.box3 || {}),
        active: number === 3,
        activeTeam: null
      },

      box4: {
        ...(oldRandom.box4 || {}),
        active: number === 4
      }
    }
  }
}

/* =========================
   OPEN BOX
========================= */

async function openPresenterRandomBox(box) {
  const number = Number(box || 0)

  if (
    !number ||
    presenterRandomActionBusy ||
    presenterRandomPendingBox
  ) {
    return
  }

  const state =
    getPresenterRandomChallengeState()

  if (
    state?.[`box${number}`]?.finished
  ) {
    showToast("هذا التحدي منتهٍ")
    return
  }

  presenterRandomActionBusy = true
  presenterRandomPendingBox = number

  applyPresenterRandomLocalBox(number)

  presenterSelectedTeam = null

  if (number === 2) {
    const nextState =
      getPresenterRandomChallengeState()

    presenterRandomAuctionLocalCount =
      Number(
        nextState.box2?.points ||
        nextState.box2?.numberInput ||
        0
      )

    presenterRandomAuctionFixedPoints =
      Number(
        nextState.box2?.calculatedPoints ||
        calcPresenterRandomAuctionFixedPoints(
          presenterRandomAuctionLocalCount
        )
      )
  } else {
    presenterRandomAuctionLocalCount = 0
    presenterRandomAuctionFixedPoints = 0
  }

  markPresenterLocalSync(
    "randomChallenge",
    1400
  )

  renderPresenterRandomChallenge()

  const sent = await sendCommand(
    "randomOpenBox",
    {
      box: number
    }
  )

  presenterRandomActionBusy = false
  presenterRandomPendingBox = null

  if (!sent) {
    showToast("تعذر فتح التحدي")

    if (
      typeof fetchPresenterSessionNow ===
      "function"
    ) {
      fetchPresenterSessionNow(
        presenterSessionId,
        true
      )
    }
  }
}

/* =========================
   BACK
========================= */

function presenterRandomBackStep() {
  if (presenterRandomActionBusy) return

  const state =
    getPresenterRandomChallengeState()

  const currentBox =
    getPresenterRandomCurrentBox()

  if (!currentBox) return

  if (
    currentBox === 1 &&
    state.box1?.started
  ) {
    presenterLiveState = {
      ...(presenterLiveState || {}),

      randomChallenge: {
        ...(presenterLiveState
          ?.randomChallenge || {}),

        currentBox: 1,

        box1: {
          ...(presenterLiveState
            ?.randomChallenge
            ?.box1 || {}),

          active: true,
          started: false,
          rolling: false,
          flashing: false,
          images: []
        }
      }
    }

    markPresenterLocalSync(
      "randomChallenge",
      800
    )

    renderPresenterRandomChallenge()
    return
  }

  presenterLiveState = {
    ...(presenterLiveState || {}),

    randomChallenge: {
      ...(presenterLiveState
        ?.randomChallenge || {}),

      currentBox: null,
      activeTeam: null
    }
  }

  presenterSelectedTeam = null

  markPresenterLocalSync(
    "randomChallenge",
    800
  )

  renderPresenterRandomChallenge()
}

/* =========================
   BOX 1
========================= */

async function startPresenterRandomBox1(pool) {
  if (presenterRandomActionBusy) return

  const cleanPool =
    pool === "world"
      ? "world"
      : "saudi"

  const oldRandom =
    presenterLiveState?.randomChallenge || {}

  presenterRandomActionBusy = true

  presenterLiveState = {
    ...(presenterLiveState || {}),

    randomChallenge: {
      ...oldRandom,

      currentBox: 1,

      box1: {
        ...(oldRandom.box1 || {}),
        active: true,
        pool: cleanPool,
        started: true,
        rolling: true,
        images: []
      }
    }
  }

  markPresenterLocalSync(
    "randomChallenge",
    1200
  )

  renderPresenterRandomChallenge()

  const sent = await sendCommand(
    "randomStartBox1",
    {
      pool: cleanPool
    }
  )

  presenterRandomActionBusy = false

  if (!sent) {
    showToast("تعذر بدء الاختيار")
  }
}

/* =========================
   GENERAL ACTION
========================= */

function getPresenterRandomActionKey(
  action,
  payload = {}
) {
  const state =
    getPresenterRandomChallengeState()

  return [
    action,
    state.currentBox || "",
    state.box3?.activeTeam || "",
    payload.points || "",
    payload.pool || "",
    presenterRandomAuctionLocalCount || ""
  ].join("_")
}

async function runPresenterRandomAction(
  action,
  payload = {}
) {
  if (presenterRandomActionBusy) return false

  const state =
    getPresenterRandomChallengeState()

  const currentBox =
    getPresenterRandomCurrentBox()

  const activeTeam =
    getPresenterRandomActiveTeam()

  if (!currentBox) {
    showToast("اختر تحديًا أولاً")
    return false
  }

  if (
    (
      action === "correct" ||
      action === "wrong"
    ) &&
    !activeTeam
  ) {
    showToast("اختر الفريق أولاً")
    return false
  }

  if (
    action === "randomStartBox2Timer" &&
    getPresenterRandomTimerRunning(2) &&
    getPresenterRandomRemainingTime(2) > 0
  ) {
    showToast("المؤقت يعمل الآن")
    return false
  }

  const actionKey =
    getPresenterRandomActionKey(
      action,
      payload
    )

  if (
    (
      action === "correct" ||
      action === "wrong" ||
      action === "randomBox3ScorePoints"
    ) &&
    presenterRandomLastScoreKey ===
      actionKey
  ) {
    return false
  }

  if (
    action === "correct" ||
    action === "wrong" ||
    action === "randomBox3ScorePoints"
  ) {
    presenterRandomLastScoreKey =
      actionKey
  }

  presenterRandomActionBusy = true
  updatePresenterRandomActionButtons()

  /*
    بداية مؤقت المزاد محليًا.
  */
  if (
    action === "randomStartBox2Timer"
  ) {
    const endsAt =
      Date.now() + 30 * 1000

    const oldRandom =
      presenterLiveState
        ?.randomChallenge || {}

    presenterLiveState = {
      ...(presenterLiveState || {}),

      randomChallenge: {
        ...oldRandom,

        box2: {
          ...(oldRandom.box2 || {}),

          timer: 30,
          timerRunning: true,
          timerEndsAt: endsAt,

          timerSync: {
            endsAt,
            running: true
          }
        }
      }
    }

    updatePresenterRandomTimers()
  }

  const sent = await sendCommand(
    action,
    {
      ...payload,

      team:
        payload.team ||
        activeTeam ||
        null,

      box:
        payload.box ||
        currentBox
    }
  )

  presenterRandomActionBusy = false

  if (!sent) {
    if (
      action === "correct" ||
      action === "wrong" ||
      action ===
        "randomBox3ScorePoints"
    ) {
      presenterRandomLastScoreKey = ""
    }

    updatePresenterRandomActionButtons()

    showToast("تعذر تنفيذ الأمر")
    return false
  }

  setTimeout(() => {
    presenterRandomActionBusy = false
    updatePresenterRandomActionButtons()
  }, 250)

  return true
}

/* =========================
   BOX 2 SCORE
========================= */

async function sendPresenterRandomAuctionScore(
  type
) {
  const fixedPoints = Number(
    presenterRandomAuctionFixedPoints || 0
  )

  const count = Number(
    presenterRandomAuctionLocalCount || 0
  )

  if (!count) {
    showToast("اكتب عدد الإجابات")
    return
  }

  const activeTeam =
    getPresenterRandomActiveTeam()

  if (!activeTeam) {
    showToast("اختر الفريق أولاً")
    return
  }

  await runPresenterRandomAction(
    type,
    {
      points: fixedPoints,
      count,
      calculatedPoints: fixedPoints,
      presenterOnlyPoints: true
    }
  )
}

/* =========================
   BOX 3
========================= */

async function finishPresenterRandomBox3Round() {
  const sent = await runPresenterRandomAction(
    "randomFinishRound"
  )

  if (!sent) return

  presenterLiveState = {
    ...(presenterLiveState || {}),

    randomChallenge: {
      ...(presenterLiveState
        ?.randomChallenge || {}),

      currentBox: 3,

      box3: {
        ...(presenterLiveState
          ?.randomChallenge
          ?.box3 || {}),

        choosingPoints: true
      }
    }
  }

  renderPresenterRandomChallenge()
}

/* =========================
   BUTTON STATE
========================= */

function updatePresenterRandomActionButtons() {
  const state =
    getPresenterRandomChallengeState()

  const currentBox =
    getPresenterRandomCurrentBox()

  const activeTeam =
    getPresenterRandomActiveTeam()

  const busy =
    presenterRandomActionBusy

  document
    .querySelectorAll(
      "[data-random-action]"
    )
    .forEach(button => {
      const action =
        button.dataset.randomAction || ""

      let disabled = busy

      if (
        action === "score" &&
        !activeTeam
      ) {
        disabled = true
      }

      if (
        action === "startBox2Timer" &&
        getPresenterRandomTimerRunning(2) &&
        getPresenterRandomRemainingTime(2) >
          0
      ) {
        disabled = true
      }

      if (
        action === "box3Action" &&
        !activeTeam
      ) {
        disabled = true
      }

      if (
        action === "finish" &&
        !currentBox
      ) {
        disabled = true
      }

      button.disabled = disabled
    })

  const startTimerButton =
    document.getElementById(
      "presenterRandomStartBox2TimerBtn"
    )

  if (startTimerButton) {
    const running =
      getPresenterRandomTimerRunning(2) &&
      getPresenterRandomRemainingTime(2) >
        0

    startTimerButton.disabled =
      busy || running

    startTimerButton.innerText =
      running
        ? "المؤقت يعمل"
        : "بدء"
  }

  const auctionInput =
    document.getElementById(
      "presenterRandomAuctionInput"
    )

  if (auctionInput) {
    auctionInput.disabled = busy
  }
}

/* =========================
   RENDER
========================= */

function renderPresenterRandomChallenge() {
  const panel = document.getElementById(
    "presenterPanel"
  )

  if (!panel) return

  const state =
    getPresenterRandomChallengeState()

  const currentBox =
    getPresenterRandomCurrentBox()

  const uiMode =
    getPresenterRandomUiMode()

  presenterRandomLastUiMode =
    uiMode

  const activeTeam =
    getPresenterRandomActiveTeam()

  const errorsA = Number(
    state.box3?.errors?.A || 0
  )

  const errorsB = Number(
    state.box3?.errors?.B || 0
  )

  const box1Pool =
    state.box1?.pool || ""

  const box1Players =
    getPresenterRandomBox1Players(state)

  const box1Started =
    !!state.box1?.currentPlayer ||
    !!state.box1?.started ||
    !!state.box1?.currentName ||
    box1Players.filter(Boolean).length >
      0 ||
    !!state.box1?.rolling

  const box1NameA =
    getPresenterRandomImageName(
      box1Players[0]
    )

  const box1NameB =
    getPresenterRandomImageName(
      box1Players[1]
    )

  const auctionCount =
    getPresenterRandomAuctionCount(state)

  const auctionFixedPoints =
    getPresenterRandomAuctionFixedPoints(
      state
    )

  const auctionTimer =
    getPresenterRandomRemainingTime(2)

  const box3Timer =
    getPresenterRandomRemainingTime(3)

  panel.innerHTML = `
    <div
      class="presenterRandomLayout"
      data-random-mode="${uiMode}"
    >

      ${
        !currentBox
          ? `
            <section class="presenterRandomIntroCard">

              <div class="presenterRandomChooseGrid">

                ${[1, 2, 3, 4]
                  .map(box => {
                    const titles = {
                      1: "اللاعب المشترك",
                      2: "المزاد",
                      3: "ماذا تعرف",
                      4: "قريبًا"
                    }

                    const finished =
                      !!state?.[`box${box}`]
                        ?.finished

                    const pending =
                      presenterRandomPendingBox ===
                      box

                    return `
                      <button
                        type="button"
                        class="
                          presenterRandomChooseBtn
                          ${
                            finished
                              ? "presenterOpened"
                              : ""
                          }
                          ${
                            pending
                              ? "presenterPendingNumber"
                              : ""
                          }
                        "
                        ${
                          finished ||
                          pending ||
                          presenterRandomActionBusy
                            ? "disabled"
                            : ""
                        }
                        onclick="
                          openPresenterRandomBox(
                            ${box}
                          )
                        "
                      >
                        <span>
                          ${String(box).padStart(
                            2,
                            "0"
                          )}
                        </span>

                        <strong>
                          ${titles[box]}
                        </strong>
                      </button>
                    `
                  })
                  .join("")}

              </div>

            </section>
          `
          : `
            <div class="presenterRandomHeaderLine">

              <button
                type="button"
                class="presenterRandomBackBtn"
                onclick="
                  presenterRandomBackStep()
                "
              >
                رجوع
              </button>

              <div>
                <strong>
                  ${presenterRandomSafeHtml(
                    getPresenterRandomBoxTitle(
                      currentBox
                    )
                  )}
                </strong>
              </div>

              <button
                type="button"
                class="presenterRandomEndBtn"
                data-random-action="finish"
                onclick="
                  runPresenterRandomAction(
                    'randomFinishBox'
                  )
                "
              >
                إنهاء
              </button>

            </div>

            <div class="presenterRandomPage">

              <main class="presenterRandomMain">

                ${
                  currentBox === 1 &&
                  !box1Started
                    ? `
                      <section class="presenterRandomGlassCard">

                        <div class="presenterRandomPoolGrid">

                          <button
                            type="button"
                            class="
                              presenterRandomPoolBtn
                              ${
                                box1Pool ===
                                "saudi"
                                  ? "active"
                                  : ""
                              }
                            "
                            onclick="
                              startPresenterRandomBox1(
                                'saudi'
                              )
                            "
                          >
                            <span>🇸🇦</span>
                            <strong>
                              الدوري السعودي
                            </strong>
                          </button>

                          <button
                            type="button"
                            class="
                              presenterRandomPoolBtn
                              ${
                                box1Pool ===
                                "world"
                                  ? "active"
                                  : ""
                              }
                            "
                            onclick="
                              startPresenterRandomBox1(
                                'world'
                              )
                            "
                          >
                            <span>🌍</span>
                            <strong>
                              عالمي
                            </strong>
                          </button>

                        </div>

                      </section>
                    `
                    : ""
                }

                ${
                  currentBox === 1 &&
                  box1Started
                    ? `
                      <section class="presenterRandomGlassCard">

                        <div class="presenterRandomPlayerNames">

                          <div class="presenterRandomPlayerNameCard">
                            <strong>
                              ${presenterRandomSafeHtml(
                                box1NameA || "—"
                              )}
                            </strong>
                          </div>

                          <div class="presenterRandomVsText">
                            VS
                          </div>

                          <div class="presenterRandomPlayerNameCard">
                            <strong>
                              ${presenterRandomSafeHtml(
                                box1NameB || "—"
                              )}
                            </strong>
                          </div>

                        </div>

                      </section>
                    `
                    : ""
                }

                ${
                  currentBox === 2
                    ? `
                      <section
                        class="
                          presenterRandomGlassCard
                          presenterRandomAuctionCard
                        "
                      >

                        <div class="presenterRandomAuctionInputWrap">

                          <input
                            id="presenterRandomAuctionInput"
                            class="presenterRandomAuctionInput"
                            type="tel"
                            inputmode="numeric"
                            autocomplete="off"
                            value="${
                              auctionCount || ""
                            }"
                            oninput="
                              setPresenterRandomAuctionPoints(
                                this.value
                              )
                            "
                          >

                        </div>

                        <div class="presenterRandomAuctionMetrics">

                          <button
                            type="button"
                            class="
                              presenterRandomMetric
                              countMetric
                            "
                            onclick="
                              decreasePresenterRandomAuctionPoints()
                            "
                          >
                            <span>العدد</span>

                            <strong
                              id="presenterRandomAuctionCount"
                            >
                              ${auctionCount}
                            </strong>
                          </button>

                          <div
                            class="
                              presenterRandomMetric
                              timerMetric
                            "
                          >
                            <span>الوقت</span>

                            <strong
                              id="presenterRandomAuctionTimer"
                            >
                              ${auctionTimer}
                            </strong>
                          </div>

                          <div
                            class="
                              presenterRandomMetric
                              pointsMetric
                            "
                          >
                            <span>النقاط</span>

                            <strong
                              id="presenterRandomAuctionFixed"
                            >
                              ${auctionFixedPoints}
                            </strong>
                          </div>

                        </div>

                      </section>
                    `
                    : ""
                }

                ${
                  currentBox === 3 &&
                  !state.box3?.choosingPoints
                    ? `
                      <section
                        class="
                          presenterRandomGlassCard
                          presenterRandomKnowCard
                        "
                      >

                        <div
                          id="presenterRandomBox3Timer"
                          class="
                            presenterRandomBox3Timer
                            ${
                              box3Timer <= 2
                                ? "danger presenterTimerDanger"
                                : ""
                            }
                          "
                        >
                          ${box3Timer}
                        </div>

                        <div class="presenterRandomKnowBoard">

                          <div
                            class="
                              presenterRandomKnowTeam
                              presenterRandomTeamName
                              ${
                                activeTeam === "A"
                                  ? "active"
                                  : ""
                              }
                            "
                          >
                            <span>
                              ${presenterRandomSafeHtml(
                                presenterTeamAName
                              )}
                            </span>

                            <strong>
                              ${errorsA} / 3
                            </strong>
                          </div>

                          <div
                            class="
                              presenterRandomKnowTeam
                              presenterRandomTeamName
                              ${
                                activeTeam === "B"
                                  ? "active"
                                  : ""
                              }
                            "
                          >
                            <span>
                              ${presenterRandomSafeHtml(
                                presenterTeamBName
                              )}
                            </span>

                            <strong>
                              ${errorsB} / 3
                            </strong>
                          </div>

                        </div>

                      </section>
                    `
                    : ""
                }

                ${
                  currentBox === 3 &&
                  state.box3?.choosingPoints
                    ? `
                      <section class="presenterRandomGlassCard">

                        <div class="presenterRandomScoreButtons">

                          ${[1, 2, 3]
                            .map(points => {
                              return `
                                <button
                                  type="button"
                                  class="presenterBtn green"
                                  data-random-action="score"
                                  onclick="
                                    runPresenterRandomAction(
                                      'randomBox3ScorePoints',
                                      {
                                        points:
                                          ${points}
                                      }
                                    )
                                  "
                                >
                                  ${points}
                                </button>
                              `
                            })
                            .join("")}

                        </div>

                      </section>
                    `
                    : ""
                }

                ${
                  currentBox === 4
                    ? `
                      <section class="presenterRandomGlassCard">
                        <div class="presenterRandomSoonText">
                          قريبًا
                        </div>
                      </section>
                    `
                    : ""
                }

              </main>

              ${
                currentBox === 1 ||
                currentBox === 2 ||
                currentBox === 3
                  ? `
                    <aside class="presenterRandomSide">

                      <div class="presenterRandomTeamsBox">
                        ${teamButtons()}
                      </div>

                    </aside>
                  `
                  : ""
              }

            </div>

            <div class="presenterRandomActionsArea">

              ${
                currentBox === 1
                  ? `
                    ${
                      box1Started
                        ? `
                          <button
                            type="button"
                            class="presenterBtn gray"
                            onclick="
                              runPresenterRandomAction(
                                'randomSkip',
                                {
                                  pool:
                                    '${box1Pool ||
                                    "saudi"}'
                                }
                              )
                            "
                          >
                            إعادة
                          </button>

                          <button
                            type="button"
                            class="presenterBtn green"
                            data-random-action="score"
                            onclick="
                              runPresenterRandomAction(
                                'correct'
                              )
                            "
                          >
                            صح
                          </button>

                          <button
                            type="button"
                            class="presenterBtn red"
                            data-random-action="score"
                            onclick="
                              runPresenterRandomAction(
                                'wrong'
                              )
                            "
                          >
                            خطأ
                          </button>
                        `
                        : ""
                    }

                    <button
                      type="button"
                      class="presenterBtn dark"
                      data-random-action="finish"
                      onclick="
                        runPresenterRandomAction(
                          'randomFinishBox'
                        )
                      "
                    >
                      إنهاء
                    </button>
                  `
                  : ""
              }

              ${
                currentBox === 2
                  ? `
                    <button
                      type="button"
                      id="presenterRandomStartBox2TimerBtn"
                      class="presenterBtn dark"
                      data-random-action="startBox2Timer"
                      onclick="
                        runPresenterRandomAction(
                          'randomStartBox2Timer'
                        )
                      "
                    >
                      بدء
                    </button>

                    <button
                      type="button"
                      class="presenterBtn green"
                      data-random-action="score"
                      onclick="
                        sendPresenterRandomAuctionScore(
                          'correct'
                        )
                      "
                    >
                      صح
                    </button>

                    <button
                      type="button"
                      class="presenterBtn red"
                      data-random-action="score"
                      onclick="
                        sendPresenterRandomAuctionScore(
                          'wrong'
                        )
                      "
                    >
                      خطأ
                    </button>

                    <button
                      type="button"
                      class="presenterBtn gray"
                      data-random-action="finish"
                      onclick="
                        runPresenterRandomAction(
                          'randomFinishBox'
                        )
                      "
                    >
                      إنهاء
                    </button>
                  `
                  : ""
              }

              ${
                currentBox === 3 &&
                !state.box3?.choosingPoints
                  ? `
                    <button
                      type="button"
                      class="presenterBtn red"
                      data-random-action="box3Action"
                      onclick="
                        runPresenterRandomAction(
                          'randomBox3Wrong'
                        )
                      "
                    >
                      خطأ
                    </button>

                    <button
                      type="button"
                      class="presenterBtn blue"
                      data-random-action="box3Action"
                      onclick="
                        runPresenterRandomAction(
                          'randomBox3Pass'
                        )
                      "
                    >
                      باس
                    </button>

                    <button
                      type="button"
                      class="presenterBtn gray"
                      data-random-action="box3Action"
                      onclick="
                        runPresenterRandomAction(
                          'randomBox3SwitchTeam'
                        )
                      "
                    >
                      تبديل
                    </button>

                    <button
                      type="button"
                      class="presenterBtn dark"
                      onclick="
                        finishPresenterRandomBox3Round()
                      "
                    >
                      إنهاء
                    </button>
                  `
                  : ""
              }

              ${
                currentBox === 3 &&
                state.box3?.choosingPoints
                  ? `
                    <button
                      type="button"
                      class="presenterBtn gray"
                      data-random-action="finish"
                      onclick="
                        runPresenterRandomAction(
                          'randomFinishBox'
                        )
                      "
                    >
                      إنهاء
                    </button>
                  `
                  : ""
              }

              ${
                currentBox === 4
                  ? `
                    <button
                      type="button"
                      class="presenterBtn gray"
                      data-random-action="finish"
                      onclick="
                        runPresenterRandomAction(
                          'randomFinishBox'
                        )
                      "
                    >
                      إنهاء
                    </button>
                  `
                  : ""
              }

            </div>
          `
      }

    </div>
  `

  refreshPresenterRandomChallengeFromState()
  startPresenterRandomTimerWatcher()
}

/* =========================
   REFRESH
========================= */

function refreshPresenterRandomChallengeFromState() {
  if (
    presenterSegment !==
    "randomChallenge"
  ) {
    stopPresenterRandomTimerWatcher()
    return
  }

  const state =
    getPresenterRandomChallengeState()

  const uiMode =
    getPresenterRandomUiMode()

  if (
    presenterRandomLastUiMode &&
    presenterRandomLastUiMode !== uiMode
  ) {
    renderPresenterRandomChallenge()
    return
  }

  const activeTeam =
    getPresenterRandomActiveTeam()

  updatePresenterTeamButtonsOnly(
    activeTeam
  )

  document
    .querySelectorAll(
      ".presenterRandomTeamName"
    )
    .forEach((box, index) => {
      const team =
        index === 0 ? "A" : "B"

      box.classList.toggle(
        "active",
        activeTeam === team
      )
    })

  const box1Players =
    getPresenterRandomBox1Players(state)

  const playerNameCards =
    document.querySelectorAll(
      ".presenterRandomPlayerNameCard strong"
    )

  if (playerNameCards?.[0]) {
    playerNameCards[0].innerText =
      getPresenterRandomImageName(
        box1Players[0]
      ) || "—"
  }

  if (playerNameCards?.[1]) {
    playerNameCards[1].innerText =
      getPresenterRandomImageName(
        box1Players[1]
      ) || "—"
  }

  const errorsA = Number(
    state.box3?.errors?.A || 0
  )

  const errorsB = Number(
    state.box3?.errors?.B || 0
  )

  const knowTeams =
    document.querySelectorAll(
      ".presenterRandomKnowTeam"
    )

  if (knowTeams?.[0]) {
    knowTeams[0].classList.toggle(
      "active",
      activeTeam === "A"
    )

    const score =
      knowTeams[0].querySelector(
        "strong"
      )

    if (score) {
      score.innerText =
        `${errorsA} / 3`
    }
  }

  if (knowTeams?.[1]) {
    knowTeams[1].classList.toggle(
      "active",
      activeTeam === "B"
    )

    const score =
      knowTeams[1].querySelector(
        "strong"
      )

    if (score) {
      score.innerText =
        `${errorsB} / 3`
    }
  }

  const countBox =
    document.getElementById(
      "presenterRandomAuctionCount"
    )

  const fixedBox =
    document.getElementById(
      "presenterRandomAuctionFixed"
    )

  const input =
    document.getElementById(
      "presenterRandomAuctionInput"
    )

  if (countBox || fixedBox || input) {
    const stateCount = Number(
      state.box2?.points ??
      state.box2?.numberInput ??
      0
    )

    const stateFixed = Number(
      state.box2?.calculatedPoints ??
      calcPresenterRandomAuctionFixedPoints(
        stateCount
      )
    )

    const inputIsFocused =
      document.activeElement === input

    const count = inputIsFocused
      ? Number(
          presenterRandomAuctionLocalCount ||
          stateCount ||
          0
        )
      : stateCount

    const fixed = inputIsFocused
      ? Number(
          presenterRandomAuctionFixedPoints ||
          stateFixed ||
          0
        )
      : stateFixed

    presenterRandomAuctionLocalCount =
      count

    presenterRandomAuctionFixedPoints =
      fixed

    if (countBox) {
      countBox.innerText =
        String(count)
    }

    if (fixedBox) {
      fixedBox.innerText =
        String(fixed)
    }

    if (input && !inputIsFocused) {
      input.value = count || ""
    }
  }

  updatePresenterRandomTimers()
  updatePresenterRandomActionButtons()

  if (!presenterRandomTimerWatcher) {
    startPresenterRandomTimerWatcher()
  }
}

/* =========================
   CLEANUP
========================= */

window.addEventListener(
  "beforeunload",
  () => {
    clearTimeout(
      presenterRandomAuctionInputTimer
    )

    stopPresenterRandomTimerWatcher()
  }
)
/* =========================
   FINAL - PRESENTER CLEAN VERSION
   مطابق للفاصلة الجديدة:
   1 بدون نقاط
   2 صح صحلي
   3 قصة
   4 التركيز
========================= */

let presenterFinalRound2RowsModel = null
let presenterFinalRound3Rows = []

let presenterFinalSelected = { round: 1, number: null }

let presenterFinalPreviewCache = {
  1: "",
  2: "",
  3: "",
  4: ""
}

let presenterFinalRound1FocusMode = false

/* =========================
   FINAL SEGMENT KEYS
   التعرف على فقرات الفاصلة المستقلة
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
  const normalizedKey = normalizePresenterFinalSegmentKey(key)

  return (
    normalizedKey === "final" ||
    normalizedKey === "finalRound1" ||
    normalizedKey === "finalRound2" ||
    normalizedKey === "finalRound3" ||
    normalizedKey === "finalRound4"
  )
}

function getPresenterFinalRoundFromSegmentKey(key) {
  const normalizedKey = normalizePresenterFinalSegmentKey(key)

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
  ]

  for (const key of possibleKeys) {
    const normalizedKey =
      normalizePresenterFinalSegmentKey(key)

    if (isPresenterFinalSegment(normalizedKey)) {
      return normalizedKey
    }
  }

  return "final"
}

function getPresenterFinalRoundTitle(round = getPresenterFinalRound(), mode = "full") {
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

  return titles[round]?.[mode] || titles[round]?.full || "الفاصلة"
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

function getPresenterFinalState() {
  return presenterLiveState?.final || { round: 1 }
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

function getPresenterFinalRoundState(round = getPresenterFinalRound()) {
  const state = getPresenterFinalState()

  if (round === 1) return state.round1 || {}
  if (round === 2) return state.round2 || {}
  if (round === 3) return state.round3 || {}
  if (round === 4) return state.round4 || {}

  return {}
}

function getPresenterFinalActiveTeam(round = getPresenterFinalRound()) {
  round = Number(round || 1)

  const state = getPresenterFinalRoundState(round)

  if (round === 4) {
    const mediaState = getPresenterFinalRound4TeamMediaState()

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

function getPresenterFinalSafeCount(value, fallback = 4) {
  const count = Number(value || fallback)

  if (count === 8) return 8
  if (count === 6) return 6
  if (count === 4) return 4

  return fallback
}

function getPresenterFinalRound1Count() {
  const state = getPresenterFinalRoundState(1)
  return getPresenterFinalSafeCount(state.cardsCount, 6)
}

function getPresenterFinalRound3StoryCount() {
  const state = getPresenterFinalRoundState(3)
  return getPresenterFinalSafeCount(state.cardsCount, 4)
}

function getPresenterFinalRound4FocusCount() {
  const state = getPresenterFinalRoundState(4)
  const media = state.teamMedia || {}
  return getPresenterFinalSafeCount(media.count, 4)
}

function getPresenterFinalRound2Type(number) {
  const n = Number(number || 0)

  if (n === 1 || n === 4) return "scramble"
  if (n === 2 || n === 5) return "sequence"
  if (n === 3 || n === 6) return "image"

  return ""
}

function getPresenterFinalRound2ImageDbNumber(number) {
  const n = Number(number || 0)

  if (n === 3) return 101
  if (n === 6) return 102

  return 0
}

function getPresenterFinalNumbersForRound(round) {
  round = Number(round || 1)

  if (round === 1) {
    return Array.from({ length: getPresenterFinalRound1Count() }, (_, i) => i + 1)
  }

  if (round === 2) {
    return [1, 2, 3, 4, 5, 6]
  }

  if (round === 3) {
    return Array.from({ length: getPresenterFinalRound3StoryCount() }, (_, i) => i + 1)
  }

  if (round === 4) {
    return Array.from({ length: getPresenterFinalRound4FocusCount() }, (_, i) => i + 1)
  }

  return []
}

function getPresenterFinalRound4TeamMediaState() {
  const state = getPresenterFinalRoundState(4)

  return state.teamMedia || {
    count: 4,
    usedNumbers: [],
    teamNumbers: { A: [], B: [] },
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

function clearPresenterFinalPreview(round = presenterFinalRound) {
  round = Number(round || 1)

  presenterFinalPreviewCache[round] = ""
  presenterFinalSelected = { round, number: null }

  const previewBox = document.getElementById("presenterFinalPreview")
  if (previewBox) previewBox.innerHTML = "اختر رقمًا"
}

/* =========================
   FINAL HELPERS
========================= */

async function setPresenterFinalRound(round) {
  const requestedRound = Number(round || 1)

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
    await sendCommand("setRound", {
      round: presenterFinalRound
    })
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

  const round = getPresenterFinalRound()

  if (round !== 1) {
    setPresenterFinalRound1FocusMode(false)
    return
  }

  const state = getPresenterFinalRoundState(1)

  const currentNumber =
    Number(state.currentNumber || 0) ||
    (
      presenterFinalSelected?.round === 1
        ? Number(presenterFinalSelected.number || 0)
        : 0
    )

  const pendingScore = !!state.pendingScore

  setPresenterFinalRound1FocusMode(!!currentNumber || pendingScore)
}

function refreshPresenterEnhancements() {
  updatePresenterFinalRound1FocusFromState()
}

async function presenterPlayCurrentFinalVideo() {
  const sent = await sendCommand("playCurrentFinalVideo", {
    round: getPresenterFinalRound()
  })

  if (!sent) {
    showToast("تعذر تشغيل الفيديو")
    return
  }

  showToast("تم تشغيل الفيديو")
}

async function presenterRestartCurrentFinalVideo() {
  const sent = await sendCommand("restartCurrentFinalVideo", {
    round: getPresenterFinalRound()
  })

  if (!sent) {
    showToast("تعذر إعادة تشغيل الفيديو")
    return
  }

  showToast("تمت إعادة تشغيل الفيديو")
}

async function presenterRestartCurrentFinalImage() {
  const sent = await sendCommand("restartCurrentFinalImage", {
    round: getPresenterFinalRound()
  })

  if (!sent) {
    showToast("تعذر إعادة الصورة")
    return
  }

  showToast("تمت إعادة الصورة")
}

function resetPresenterFinalLocalChoice(round = getPresenterFinalRound()) {
  round = Number(round || 1)

  presenterSelectedTeam = null
  presenterFinalSelected = { round, number: null }
  presenterFinalPreviewCache[round] = ""


  updatePresenterTeamButtonsOnly(null)

  const previewBox = document.getElementById("presenterFinalPreview")
  if (previewBox) {
    previewBox.innerHTML = "اختر رقمًا"
  }
}

async function presenterFinalCorrect() {
  const round = getPresenterFinalRound()
  const activeTeam = getPresenterFinalActiveTeam(round)

  if ((round === 1 || round === 3) && !activeTeam) {
    showToast("اختر الفريق أولاً")
    return
  }

  sendCommand("stopCurrentFinalVideo")

  const sent = await sendCommand("correct", {
    round,
    team: activeTeam || null
  })

  if (!sent) return

  const segmentKey = getPresenterActiveFinalSegmentKey()

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
  const round = getPresenterFinalRound()

  const sent = await sendCommand("wrong", {
    round
  })

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

  panel.innerHTML = `
    <div class="presenterFinalLayout">

      <div class="presenterFinalLeft">

        <section class="presenterCard presenterFinalNumbersCard">
          <div class="presenterLabel">الأرقام</div>
          <div class="presenterGrid" id="presenterFinalNumbers"></div>
        </section>

        <div id="presenterFinalControls" class="presenterFinalControlsArea"></div>

      </div>

      <div class="presenterFinalRight">

        <div class="presenterFinalTeamsArea">
          ${teamButtons()}
        </div>

        <section class="presenterCard presenterFinalPreviewCard">
          <div id="presenterFinalPreview" class="presenterFinalPreviewBox">
            ${presenterFinalPreviewCache[presenterFinalRound] || "اختر رقمًا"}
          </div>
        </section>

      </div>

    </div>
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
    sent = await sendCommand("recordScrambleScore")
  }

  if (type === "sequence") {
    sent = await sendCommand("recordSequenceScore")
  }

  if (type === "image") {
    sent = await sendCommand("recordImageScore")
  }

  if (!sent) return

  resetPresenterFinalLocalChoice(2)
  markPresenterLocalSync(
  getPresenterActiveFinalSegmentKey(),
  900
)

  setTimeout(() => {
    renderPresenterFinalRoundContent()
  }, 250)
}

async function renderPresenterFinalRoundContent() {
  const round = Number(getPresenterFinalRound() || presenterFinalRound || 1)
  presenterFinalRound = round

  const numbersBox = document.getElementById("presenterFinalNumbers")
  const controlsBox = document.getElementById("presenterFinalControls")
  const previewBox = document.getElementById("presenterFinalPreview")

  if (!numbersBox || !controlsBox || !previewBox) return

  const state = getPresenterFinalRoundState(round)
  const round4MediaState = getPresenterFinalRound4TeamMediaState()

  const nums = getPresenterFinalNumbersForRound(round)

  numbersBox.className = `presenterGrid presenterFinalNumbersGrid finalNumbersCount${nums.length}`

  const openedNumbers =
    round === 4
      ? (round4MediaState.usedNumbers || state.opened || [])
      : (state.opened || [])

  const selectedNumber =
    Number(
      round === 4
        ? round4MediaState.currentNumber || state.currentNumber || 0
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

  numbersBox.innerHTML = nums.map(n => {
    const opened = openedNumbers.map(Number).includes(Number(n))
    const current = selectedNumber === n

    return `
      <button
        class="presenterNumberBtn ${opened ? "presenterOpened" : ""} ${current ? "selectedPresenterTeam" : ""}"
        ${opened || pendingScore ? "disabled" : ""}
        onclick="openPresenterFinalNumber(${round}, ${n})"
      >
        ${opened ? "" : n}
      </button>
    `
  }).join("")

  if (selectedNumber) {
    if (round === 1) await renderPresenterFinalRound1Preview()
    if (round === 2) await renderPresenterFinalRound2Preview()
    if (round === 3) await renderPresenterFinalRound3Preview()
    if (round === 4) await renderPresenterFinalRound4Preview()
  } else {
    previewBox.innerHTML = presenterFinalPreviewCache[round] || "اختر رقمًا"
  }

  controlsBox.dataset.round = String(round)
  controlsBox.className = `presenterFinalControlsArea finalControlsRound${round}`

  if (round === 1) {
    controlsBox.innerHTML = `
      <div class="presenterFinalControlsGrid">
        <button class="presenterBtn gray" onclick="sendCommand('double')">دوبيلا</button>
        <button class="presenterBtn blue" onclick="sendCommand('zoomImage')">تكبير</button>
        <button class="presenterBtn green" onclick="presenterFinalCorrect()">صحيحة</button>
        <button class="presenterBtn red" onclick="presenterFinalWrong()">خطأ</button>
        <button class="presenterBtn gray" onclick="sendCommand('undo')">تراجع</button>
      </div>
    `

    refreshPresenterFinalControlsOnly(1)
    refreshPresenterEnhancements()
    return
  }

  if (round === 2) {
    const currentNumber = Number(
      state.currentNumber ||
      (
        presenterFinalSelected?.round === 2
          ? presenterFinalSelected.number
          : 0
      )
    )

    const type = getPresenterFinalRound2Type(currentNumber)
    const isScramble = type === "scramble"
    const isSequence = type === "sequence"
    const isImage = type === "image"

    controlsBox.innerHTML = `
      <div class="presenterFinalControlsGrid">
        <button class="presenterBtn gray" onclick="sendCommand('double')">
          دوبيلا
        </button>

        <button
          class="presenterBtn dark"
          onclick="sendCommand('decreaseCountdown')"
          ${isSequence ? "" : "disabled"}
        >
          ${isSequence ? `العداد ${state.countdown ?? 15}` : "العداد"}
        </button>

        <button
          class="presenterBtn blue"
          onclick="sendCommand('showNextImage')"
          ${isImage ? "" : "disabled"}
        >
          بدء الصور
        </button>

        <button
          class="presenterBtn green"
          onclick="presenterRecordFinalRound2Score('scramble')"
          ${isScramble ? "" : "disabled"}
        >
          المبعثرة
        </button>

        <button
          class="presenterBtn green"
          onclick="presenterRecordFinalRound2Score('sequence')"
          ${isSequence ? "" : "disabled"}
        >
          الترتيب
        </button>

        <button
  class="presenterBtn green"
  onclick="presenterRecordFinalRound2Score('image')"
  ${isImage ? "" : "disabled"}
>
  الصورة
</button>

        <button class="presenterBtn gray" onclick="sendCommand('undo')">
          تراجع
        </button>
      </div>
    `

    refreshPresenterFinalControlsOnly(2)
    refreshPresenterEnhancements()
    return
  }

if (round === 3) {
  const currentNumber = Number(state.currentNumber || 0)
  const shownPart = Number(state.shownPart || 0)
  const parts = Array.isArray(state.currentParts) ? state.currentParts : []
  const canShowPart =
    !!currentNumber &&
    shownPart < parts.length &&
    !state.answerShown

  const nextPartText =
    shownPart === 0
      ? "الجزء الأول"
      : shownPart === 1
        ? "الجزء الثاني"
        : shownPart === 2
          ? "الجزء الثالث"
          : "اكتملت"

  const answerBoxHtml = await getPresenterFinalRound3AnswerBox()

  controlsBox.innerHTML = `
    ${answerBoxHtml}

    <div class="presenterFinalControlsGrid">
      <button class="presenterBtn gray" onclick="sendCommand('double')">
        دوبيلا
      </button>

      <button
        class="presenterBtn blue"
        onclick="sendCommand('showStoryPart')"
        ${canShowPart ? "" : "disabled"}
      >
        ${nextPartText}
      </button>

      <button
        class="presenterBtn green"
        onclick="presenterFinalCorrect()"
        ${currentNumber && shownPart > 0 ? "" : "disabled"}
      >
        صحيحة
      </button>

      <button
        class="presenterBtn red"
        onclick="presenterFinalWrong()"
        ${currentNumber ? "" : "disabled"}
      >
        خطأ
      </button>

      <button class="presenterBtn gray" onclick="sendCommand('undo')">
        تراجع
      </button>
    </div>
  `

  refreshPresenterFinalControlsOnly(3)
  refreshPresenterEnhancements()
  return
}

  if (round === 4) {
    const hasCurrent = !!round4MediaState.currentNumber
    const isVideo = round4MediaState.currentMediaType === "video"
    const isImage = round4MediaState.currentMediaType === "image"
    const questionShown = !!round4MediaState.questionShown
    const answerShown = !!round4MediaState.answerShown
    const videoPlayed = !!round4MediaState.videoPlayed
    const imageHidden = !!round4MediaState.imageHidden

    controlsBox.innerHTML = `
      <div class="presenterFinalControlsGrid">
        <button class="presenterBtn gray" onclick="sendCommand('double')">
          دوبيلا
        </button>

        <button
          class="presenterBtn blue"
          onclick="sendCommand('showQuestion')"
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
          class="presenterBtn dark"
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
          class="presenterBtn green"
          onclick="presenterFinalCorrect()"
          ${hasCurrent && !answerShown ? "" : "disabled"}
        >
          صحيحة
        </button>

        <button
          class="presenterBtn red"
          onclick="presenterFinalWrong()"
          ${hasCurrent && !answerShown ? "" : "disabled"}
        >
          خطأ
        </button>

        <button class="presenterBtn gray" onclick="sendCommand('undo')">
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

  const title = document.getElementById("presenterSegmentTitle")
  if (title) {
    title.innerText =
  getPresenterFinalRoundTitle(round, "short")
  }

const activeTeam = getPresenterFinalActiveTeam(round)
updatePresenterTeamButtonsOnly(activeTeam)

  const controlsBox = document.getElementById("presenterFinalControls")
  const currentControlsRound = Number(controlsBox?.dataset.round || 0)

  if (currentControlsRound !== round) {
    presenterFinalSelected = { round, number: null }
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
  round = Number(getPresenterFinalRound() || round || 1)
  presenterFinalRound = round

  const numbersBox = document.getElementById("presenterFinalNumbers")
  if (!numbersBox) return

  const state = getPresenterFinalRoundState(round)
  const round4MediaState = getPresenterFinalRound4TeamMediaState()
  const nums = getPresenterFinalNumbersForRound(round)

  numbersBox.className = `presenterGrid presenterFinalNumbersGrid finalNumbersCount${nums.length}`

  const openedNumbers =
    round === 4
      ? (round4MediaState.usedNumbers || state.opened || [])
      : (state.opened || [])

  const selectedNumber =
    Number(
      round === 4
        ? round4MediaState.currentNumber || state.currentNumber || 0
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

  numbersBox.innerHTML = nums.map(n => {
    const opened = openedNumbers.map(Number).includes(Number(n))
    const current = selectedNumber === n

    return `
      <button
        class="presenterNumberBtn ${opened ? "presenterOpened" : ""} ${current ? "selectedPresenterTeam" : ""}"
        ${opened || pendingScore ? "disabled" : ""}
        onclick="openPresenterFinalNumber(${round}, ${n})"
      >
        ${opened ? "" : n}
      </button>
    `
  }).join("")
}

async function refreshPresenterFinalPreviewOnly(round) {
  round = Number(getPresenterFinalRound() || round || 1)
  presenterFinalRound = round

  const previewBox = document.getElementById("presenterFinalPreview")
  if (!previewBox) return

  const state = getPresenterFinalRoundState(round)
  const round4MediaState = getPresenterFinalRound4TeamMediaState()

  const currentNumber =
    Number(
      round === 4
        ? round4MediaState.currentNumber || state.currentNumber || 0
        : state.currentNumber || 0
    ) ||
    (
      presenterFinalSelected?.round === round
        ? Number(presenterFinalSelected.number || 0)
        : 0
    )

  if (!currentNumber) {
    presenterFinalPreviewCache[round] = ""
    presenterFinalSelected = { round, number: null }
    previewBox.innerHTML = "اختر رقمًا"
    return
  }

  if (round === 1) await renderPresenterFinalRound1Preview()
if (round === 2) await renderPresenterFinalRound2Preview()

if (round === 3) {
  await renderPresenterFinalRound3Preview()
  await refreshPresenterFinalRound3AnswerControl()
}

if (round === 4) await renderPresenterFinalRound4Preview()
}

function refreshPresenterFinalControlsOnly(round) {
  round = Number(getPresenterFinalRound() || round || 1)
  presenterFinalRound = round

  const controlsBox = document.getElementById("presenterFinalControls")
  if (!controlsBox) return

  const state = getPresenterFinalRoundState(round)
  const allButtons = [...controlsBox.querySelectorAll(".presenterBtn")]

  if (round === 1) {
    const pendingScore = !!state.pendingScore

    allButtons.forEach(btn => {
      const onclick = btn.getAttribute("onclick") || ""

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
    const currentNumber = Number(state.currentNumber || 0)
    const type = getPresenterFinalRound2Type(currentNumber)

    allButtons.forEach(btn => {
      const onclick = btn.getAttribute("onclick") || ""

      if (onclick.includes("decreaseCountdown")) {
        btn.disabled = type !== "sequence"
        btn.innerText = type === "sequence"
          ? `العداد ${state.countdown ?? 15}`
          : "العداد"
      }

      if (onclick.includes("showNextImage")) {
        btn.disabled = type !== "image"
      }

     if (
  onclick.includes("recordScrambleScore") ||
  onclick.includes("presenterRecordFinalRound2Score('scramble')")
) {
  btn.disabled = type !== "scramble"
}

if (
  onclick.includes("recordSequenceScore") ||
  onclick.includes("presenterRecordFinalRound2Score('sequence')")
) {
  btn.disabled = type !== "sequence"
}

if (
  onclick.includes("recordImageScore") ||
  onclick.includes("presenterRecordFinalRound2Score('image')")
) {
  btn.disabled = type !== "image"
}
    })

    return
  }

  if (round === 3) {
    const currentNumber = Number(state.currentNumber || 0)
    const shownPart = Number(state.shownPart || 0)
    const parts = Array.isArray(state.currentParts) ? state.currentParts : []
    const answerShown = !!state.answerShown

    allButtons.forEach(btn => {
      const onclick = btn.getAttribute("onclick") || ""

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
        btn.disabled = !(currentNumber && shownPart > 0 && !answerShown)
      }

      if (onclick.includes("presenterFinalWrong")) {
        btn.disabled = !(currentNumber && !answerShown)
      }
    })

    return
  }

  if (round === 4) {
    const mediaState = getPresenterFinalRound4TeamMediaState()
    const hasCurrent = !!mediaState.currentNumber
    const isVideo = mediaState.currentMediaType === "video"
    const isImage = mediaState.currentMediaType === "image"
    const questionShown = !!mediaState.questionShown
    const answerShown = !!mediaState.answerShown
    const videoPlayed = !!mediaState.videoPlayed
    const imageHidden = !!mediaState.imageHidden

    allButtons.forEach(btn => {
      const onclick = btn.getAttribute("onclick") || ""

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
        btn.disabled = !hasCurrent || answerShown
      }

      if (onclick.includes("presenterFinalWrong")) {
        btn.disabled = !hasCurrent || answerShown
      }
    })
  }
}

/* =========================
   OPEN FINAL NUMBER
========================= */

async function openPresenterFinalNumber(round, number) {
  round = Number(round || 1)
  number = Number(number || 0)

  const state = getPresenterFinalRoundState(round)
  const round4MediaState = getPresenterFinalRound4TeamMediaState()

  const openedNumbers =
    round === 4
      ? (round4MediaState.usedNumbers || state.opened || [])
      : (state.opened || [])

  const hasCurrent =
  round === 4
    ? !!round4MediaState.currentNumber
    : !!state.pendingScore

  if (hasCurrent) {
    showToast("أنهِ الرقم الحالي أولاً")
    return
  }

  if (openedNumbers.map(Number).includes(number)) {
    showToast("الرقم مستخدم")
    return
  }

const activeTeam = getPresenterFinalActiveTeam(round)

if ((round === 2 || round === 4) && !activeTeam) {
  showToast("اختر الفريق أولاً")
  return
}

  presenterFinalSelected = { round, number }

  if (round === 1) {
    setPresenterFinalRound1FocusMode(true)
    renderPresenterFinalRound1Preview()
  }

  if (round === 2) renderPresenterFinalRound2Preview()
  if (round === 3) {
  renderPresenterFinalRound3Preview()

  setTimeout(() => {
    refreshPresenterFinalRound3AnswerControl()
  }, 80)

  setTimeout(() => {
    refreshPresenterFinalRound3AnswerControl()
  }, 250)
}
  if (round === 4) renderPresenterFinalRound4Preview()

  const sent = await sendCommand("openNumber", {
  round,
  number,
  team: activeTeam,
  segmentKey: getPresenterActiveFinalSegmentKey()
})

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
    document.body.classList.add("presenterFinalRound1FocusMode")
  }
}

/* =========================
   ROUND 1 PREVIEW - بدون نقاط
========================= */

async function renderPresenterFinalRound1Preview() {
  const previewBox = document.getElementById("presenterFinalPreview")
  if (!previewBox) return

  const state = getPresenterFinalRoundState(1)

  const current = Number(
    state.currentNumber ||
    (
      presenterFinalSelected?.round === 1
        ? presenterFinalSelected.number
        : 0
    )
  )

  if (!current) {
    presenterFinalPreviewCache[1] = ""
    previewBox.innerHTML = "اختر رقمًا"
    return
  }

  const { data, error } = await db
    .from("final_round1_items")
    .select("*")
    .eq("model", presenterModel)
    .eq("number", current)
    .maybeSingle()

  if (error || !data) {
    presenterFinalPreviewCache[1] = `
      <div class="presenterFinalOnlyAnswerView">
        <div class="presenterFinalOnlyAnswerLabel">الإجابة</div>
        <div class="presenterFinalOnlyAnswerText">لا توجد بيانات لهذا الرقم</div>
      </div>
    `

    previewBox.innerHTML = presenterFinalPreviewCache[1]
    return
  }

  const answerText = data.answer || "لا توجد إجابة"
  const noteText = data.note || ""

  presenterFinalPreviewCache[1] = `
    <div class="presenterFinalOnlyAnswerView">
      <div class="presenterFinalOnlyAnswerLabel">الإجابة</div>

      <div class="presenterFinalOnlyAnswerText">
        ${presenterSafeHtml(answerText)}
      </div>

      ${
        noteText
          ? `
            <div class="presenterFinalMiniNote">
              ${presenterSafeHtml(noteText)}
            </div>
          `
          : ""
      }
    </div>
  `

  previewBox.innerHTML = presenterFinalPreviewCache[1]
}

/* =========================
   ROUND 2 PREVIEW - صح صحلي
========================= */

async function loadPresenterFinalRound2Rows() {
  const model = Number(presenterModel || 0)

  if (
    presenterFinalRound2Rows.length &&
    presenterFinalRound2RowsModel === model
  ) {
    return
  }

  presenterFinalRound2Rows = []
  presenterFinalRound2RowsModel = model

  const { data, error } = await db
    .from("final_round2_items")
    .select("*")
    .eq("model", model)
    .order("number", { ascending: true })
    .order("item_order", { ascending: true })

  if (error) {
    console.log("LOAD PRESENTER FINAL ROUND 2 ERROR:", error)
    return
  }

  presenterFinalRound2Rows = data || []
}

function togglePresenterFinalRound2Correct(index) {
  const state = getPresenterFinalRoundState(2)

  const currentNumber = Number(
    state.currentNumber ||
    (
      presenterFinalSelected?.round === 2
        ? presenterFinalSelected.number
        : 0
    )
  )

  if (!currentNumber) return

  const oldSelected = Array.isArray(state.selectedCorrectIndexes)
    ? state.selectedCorrectIndexes.map(Number)
    : []

  const i = Number(index)

  const nextSelected = oldSelected.includes(i)
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

  sendCommand("toggleRound2Correct", {
    index: i,
    number: currentNumber,
    selectedCorrectIndexes: nextSelected
  })
}

async function renderPresenterFinalRound2Preview() {
  const previewBox = document.getElementById("presenterFinalPreview")
  if (!previewBox) return

  const state = getPresenterFinalRoundState(2)

  const current = Number(
    state.currentNumber ||
    (
      presenterFinalSelected?.round === 2
        ? presenterFinalSelected.number
        : 0
    )
  )

  if (!current) {
    previewBox.innerHTML = presenterFinalPreviewCache[2] || "اختر رقمًا"
    return
  }

  const type = getPresenterFinalRound2Type(current)

  if (type === "image") {
    await renderPresenterFinalRound2ImagePreview(current)
    return
  }

  await loadPresenterFinalRound2Rows()

  const rows = presenterFinalRound2Rows.filter(row => {
    return Number(row.number) === Number(current)
  })

  if (!rows.length) {
    presenterFinalPreviewCache[2] = `
      <div class="presenterFinalOnlyAnswerView">
        <div class="presenterFinalOnlyAnswerText">لا توجد بيانات لهذا الرقم</div>
      </div>
    `

    previewBox.innerHTML = presenterFinalPreviewCache[2]
    return
  }

  if (type === "scramble") {
    const selected = Array.isArray(state.selectedCorrectIndexes)
  ? state.selectedCorrectIndexes.map(Number)
  : []

    presenterFinalPreviewCache[2] = `
      <div class="presenterFinalAnswersGrid">
        ${rows.map((r, idx) => `
          <button
            class="presenterFinalAnswerCard ${selected.includes(idx) ? "selectedCorrect" : ""}"
            type="button"
            onclick="togglePresenterFinalRound2Correct(${idx})"
          >
            <span>${presenterSafeHtml(r.answer || r.prompt || "-")}</span>
          </button>
        `).join("")}
      </div>
    `

    previewBox.innerHTML = presenterFinalPreviewCache[2]
    return
  }

  if (type === "sequence") {
    const hidden = Array.isArray(state.hiddenSequence)
  ? state.hiddenSequence.map(Number)
  : []

    presenterFinalPreviewCache[2] = `
      <div class="presenterFinalSequencePreview">
        <div class="presenterFinalCountdownBox">
          العداد: ${Number(state.countdown ?? 15)}
        </div>

        <div class="presenterFinalAnswersGrid">
          ${rows.map((r, idx) => {
            if (hidden.includes(idx)) return ""

            return `
              <button
                class="presenterFinalAnswerCard"
                type="button"
                onclick="sendCommand('hideRound2SequenceWord',{index:${idx}})"
              >
                <span>${presenterSafeHtml(r.prompt || r.answer || "-")}</span>
              </button>
            `
          }).join("")}
        </div>
      </div>
    `

    previewBox.innerHTML = presenterFinalPreviewCache[2]
  }
}

function togglePresenterFinalRound2ImageAnswer(index) {
  const state = getPresenterFinalRoundState(2)

  const currentNumber = Number(
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

  const baseSelected = oldSelected.map(Number)
  const i = Number(index)

  const nextSelected = baseSelected.includes(i)
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

  sendCommand("toggleRound2ImageCorrect", {
    index: i,
    number: currentNumber,
    selectedCorrectIndexes: nextSelected
  })
}

let presenterFinalRound2ImageLocalSelection = {
  number: null,
  indexes: [],
  expires: 0
}

async function renderPresenterFinalRound2ImagePreview(current) {
  const previewBox = document.getElementById("presenterFinalPreview")
  if (!previewBox) return

  const state = getPresenterFinalRoundState(2)
  const selected = (
  presenterFinalRound2ImageLocalSelection.number === Number(current) &&
  Date.now() < presenterFinalRound2ImageLocalSelection.expires
    ? presenterFinalRound2ImageLocalSelection.indexes
    : (state.selectedCorrectIndexes || [])
).map(Number)

  let answers = Array.isArray(state.imageAnswers) ? state.imageAnswers : []

  if (!answers.length) {
    const dbNumber = getPresenterFinalRound2ImageDbNumber(current)

    const { data } = await db
      .from("final_round3_items")
      .select("*")
      .eq("model", presenterModel)
      .eq("number", Number(dbNumber))
      .order("image_order", { ascending: true })

    answers = (data || []).map(row => row.answer || "-")
  }

  presenterFinalPreviewCache[2] = `
    <div class="presenterFinalQuestionAnswerOnly">
      <div class="presenterFinalPreviewBlock questionBlock presenterFinalImageStatusBlock">
        
        <div class="presenterFinalPreviewText">
          المعروض: ${Number(state.shownImageIndex || 0)}
          ${state.imageAnswerShown ? " / ظهرت الإجابات" : ""}
        </div>
      </div>

      <div class="presenterFinalAnswersGrid">
        ${
          answers.length
            ? answers.map((answer, idx) => `
              <button
                class="presenterFinalAnswerCard ${selected.includes(Number(idx)) ? "selectedCorrect" : ""}"
                type="button"
                onclick="togglePresenterFinalRound2ImageAnswer(${idx})"
              >
                <span>${presenterSafeHtml(answer || "-")}</span>
              </button>
            `).join("")
            : `<div class="presenterFinalEmptyText">لا توجد إجابات</div>`
        }
      </div>
    </div>
  `

  previewBox.innerHTML = presenterFinalPreviewCache[2]
}

/* =========================
   ROUND 3 PREVIEW - قصة
========================= */

async function renderPresenterFinalRound3Preview() {
  const previewBox = document.getElementById("presenterFinalPreview")
  if (!previewBox) return

  const state = getPresenterFinalRoundState(3)

  const current = Number(
    state.currentNumber ||
    (
      presenterFinalSelected?.round === 3
        ? presenterFinalSelected.number
        : 0
    )
  )

  if (!current) {
    previewBox.innerHTML = presenterFinalPreviewCache[3] || "اختر رقمًا"
    return
  }

  let parts = Array.isArray(state.currentParts) ? state.currentParts : []

  if (!parts.length) {
    const dbNumber = 200 + Number(current)

    const { data } = await db
      .from("final_round1_items")
      .select("*")
      .eq("model", presenterModel)
      .eq("number", Number(dbNumber))
      .maybeSingle()

    if (data) {
      parts = [
        data.question_part1 || "",
        data.question_part2 || "",
        data.question_part3 || ""
      ].filter(Boolean)
    }
  }

  const shownPart = Number(state.shownPart || 0)

  presenterFinalPreviewCache[3] = `
    <div class="presenterFinalStoryPreview presenterFinalStoryPartsOnly">
      <div class="presenterFinalPreviewLabel">
        أجزاء السؤال ${shownPart ? `- ظاهر ${shownPart}` : ""}
      </div>

      <div class="presenterFinalStoryParts">
        ${
          parts.length
            ? parts.map((part, idx) => `
              <div class="presenterFinalStoryPart ${idx < shownPart ? "visiblePart" : ""}">
                <span>${idx === 0 ? 3 : idx === 1 ? 2 : 1}</span>
                <strong>${presenterSafeHtml(part || "-")}</strong>
              </div>
            `).join("")
            : `<div class="presenterFinalEmptyText">لا توجد أجزاء</div>`
        }
      </div>
    </div>
  `

  previewBox.innerHTML = presenterFinalPreviewCache[3]
}
async function getPresenterFinalRound3AnswerBox() {
  const state = getPresenterFinalRoundState(3)

  const current = Number(
    state.currentNumber ||
    (
      presenterFinalSelected?.round === 3
        ? presenterFinalSelected.number
        : 0
    )
  )

  if (!current) return ""

  let answer = state.currentAnswer || ""
  const currentPoints = Number(state.currentPoints || 0)

  if (!answer) {
    const dbNumber = 200 + Number(current)

    const { data } = await db
      .from("final_round1_items")
      .select("*")
      .eq("model", presenterModel)
      .eq("number", Number(dbNumber))
      .maybeSingle()

    if (data) {
      answer = data.answer || ""
    }
  }

  return `
    <section class="presenterCard presenterFinalStoryAnswerControl">
      <div class="presenterFinalPreviewLabel">
        الإجابة ${currentPoints ? `- ${currentPoints} نقاط` : ""}
      </div>

      <div class="presenterFinalPreviewText answerText">
        ${presenterSafeHtml(answer || "لا توجد إجابة")}
      </div>
    </section>
  `
}
async function refreshPresenterFinalRound3AnswerControl() {
  if (!isPresenterFinalSegment()) return
  if (Number(getPresenterFinalRound()) !== 3) return

  const controlsBox = document.getElementById("presenterFinalControls")
  if (!controlsBox) return

  const answerHtml = await getPresenterFinalRound3AnswerBox()
  const oldAnswerBox = controlsBox.querySelector(".presenterFinalStoryAnswerControl")
  const controlsGrid = controlsBox.querySelector(".presenterFinalControlsGrid")

  if (oldAnswerBox) {
    oldAnswerBox.remove()
  }

  if (!answerHtml || !controlsGrid) return

  controlsGrid.insertAdjacentHTML("beforebegin", answerHtml)
}
/* =========================
   ROUND 4 PREVIEW - التركيز
========================= */

async function renderPresenterFinalRound4Preview() {
  const previewBox = document.getElementById("presenterFinalPreview")
  if (!previewBox) return

  const state = getPresenterFinalRoundState(4)
  const mediaState = getPresenterFinalRound4TeamMediaState()

  const current = Number(
    mediaState.currentNumber ||
    state.currentNumber ||
    (
      presenterFinalSelected?.round === 4
        ? presenterFinalSelected.number
        : 0
    )
  )

  if (!current) {
    previewBox.innerHTML = presenterFinalPreviewCache[4] || "اختر رقمًا"
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
    mediaState.currentMediaType ||
    ""

  if (!question && !answer) {
    const { data } = await db
      .from("final_round3_items")
      .select("*")
      .eq("model", presenterModel)
      .eq("number", Number(current))
      .eq("image_order", 1)
      .maybeSingle()

    if (data) {
      question = data.question || data.note || ""
      answer = data.answer || ""
      mediaType = data.video ? "video" : data.image ? "image" : ""
    }
  }

  const statusText =
    mediaState.answerShown
      ? "ظهرت الإجابة"
      : mediaState.questionShown
        ? "ظهر السؤال"
        : mediaState.imageHidden
          ? "انتهى وقت الصورة"
          : mediaState.currentNumber
            ? "الوسائط ظاهرة"
            : "جاهز"

  presenterFinalPreviewCache[4] = `
    <div class="presenterFinalQuestionAnswerOnly">

      <div class="presenterFinalPreviewBlock questionBlock">
        <div class="presenterFinalPreviewLabel">
          السؤال ${mediaType ? `- ${mediaType === "video" ? "فيديو" : "صورة"}` : ""}
        </div>

        <div class="presenterFinalPreviewText">
          ${presenterSafeHtml(question || "لا يوجد سؤال")}
        </div>
      </div>

      <div class="presenterFinalPreviewBlock answerBlock">
        <div class="presenterFinalPreviewLabel">
          الإجابة - ${statusText}
        </div>

        <div class="presenterFinalPreviewText answerText">
          ${presenterSafeHtml(answer || "لا توجد إجابة")}
        </div>
      </div>

    </div>
  `

  previewBox.innerHTML = presenterFinalPreviewCache[4]
}

/* =========================
   ARCHIVE / الأرشيف
========================= */

let presenterArchiveRows = []
let presenterArchiveBox = null
let presenterArchiveLoadedRound = null

function getPresenterArchiveRoot() {
  return presenterLiveState?.archive || {}
}

function getPresenterArchiveState() {
  const root = getPresenterArchiveRoot()

  return root?.archiveState || {
    round: 1,
    scores: { A: 0, B: 0 },
    activeTeam: null,
    errors: {}
  }
}

function getPresenterArchiveActiveTeam() {
  const root = getPresenterArchiveRoot()
  const archive = getPresenterArchiveState()

  return (
    archive?.activeTeam ||
    root?.activeTeam ||
    presenterSelectedTeam ||
    null
  )
}

function getPresenterArchiveMaxRound() {
  const root = getPresenterArchiveRoot()
  return Number(root?.archiveMaxRound || 4)
}

function getPresenterArchiveRound() {
  const archive = getPresenterArchiveState()
  return Number(archive?.round || 1)
}

function getPresenterArchiveReveal() {
  const root = getPresenterArchiveRoot()
  return root?.archiveRevealState || {}
}

function getPresenterArchiveRoundReveal(round = getPresenterArchiveRound()) {
  const reveal = getPresenterArchiveReveal()
  return reveal?.[round] || {}
}

function getPresenterArchiveRemainingPoints() {
  const root = getPresenterArchiveRoot()
  return Number(root?.archiveRemainingPoints || 0)
}

function getPresenterArchiveRequiredItems() {
  return presenterArchiveRows
    .filter(item => String(item.label || "").trim() === "المطلوب")
    .sort((a, b) => Number(a.position) - Number(b.position))
}

async function loadPresenterArchiveRound(round) {
  round = Number(round || 1)

  const { data: boxData } = await db
    .from("archive_boxes")
    .select("*")
    .eq("model", presenterModel)
    .eq("round", round)
    .limit(1)

  const { data: itemsData } = await db
    .from("archive_items")
    .select("*")
    .eq("model", presenterModel)
    .eq("round", round)
    .order("position", { ascending: true })

  presenterArchiveBox = boxData?.[0] || null
  presenterArchiveRows = itemsData || []
  presenterArchiveLoadedRound = round
}

function buildPresenterArchiveRequiredList() {
  const round = getPresenterArchiveRound()
  const reveal = getPresenterArchiveRoundReveal(round)
  const requiredItems = getPresenterArchiveRequiredItems()

  if (!requiredItems.length) {
    return `<div class="presenterArchiveEmpty">لا يوجد مطلوب</div>`
  }

  return requiredItems.map(item => {
    const position = Number(item.position)
    const opened = !!reveal[position]

    return `
      <button
        type="button"
        class="presenterArchiveRequiredItem ${opened ? "opened" : ""}"
        onclick="sendCommand('showAnswer', { position: ${position} })"
        ${opened ? "disabled" : ""}
      >
        ${item.text || "المطلوب"}
      </button>
    `
  }).join("")
}

async function renderArchive() {
  const panel = document.getElementById("presenterPanel")
  if (!panel) return

  const round = getPresenterArchiveRound()
  const remainingPoints = getPresenterArchiveRemainingPoints()

  await loadPresenterArchiveRound(round)

  panel.innerHTML = `
    <div class="presenterArchiveLayout">

      <div class="presenterArchiveMain">

        <div class="presenterArchiveTeamsBox">
          ${teamButtons()}
        </div>

        <section class="presenterCard presenterArchiveSimpleCard">

          <div class="presenterFinalRoundHeader presenterArchiveRoundHeader">
            <span>الجولة الحالية</span>
            <strong id="presenterArchiveRoundText">${round}</strong>
          </div>

          <div class="presenterLabel">النقاط الباقية</div>

          <div class="presenterArchiveSimpleScore">
            <strong>${remainingPoints}</strong>
          </div>

          <div class="presenterLabel">المطلوب</div>

          <div class="presenterArchiveRequiredList">
            ${buildPresenterArchiveRequiredList()}
          </div>

        </section>

      </div>

      <div class="presenterArchiveActionsArea">

        <div class="presenterArchiveActions">
          <button
            type="button"
            class="presenterBtn dark presenterArchiveStartTimerBtn"
            onclick="sendCommand('startTimer')"
          >
            بدء المؤقت
          </button>

          <button
            type="button"
            class="presenterBtn gray presenterArchiveDoubleBtn"
            onclick="sendCommand('double')"
          >
            دوبيلا
          </button>

          <button
            type="button"
            class="presenterBtn red presenterArchiveWrongBtn"
            onclick="sendCommand('wrong')"
          >
            خطأ
          </button>
        </div>

        <div class="presenterArchiveActions">
          <button
            type="button"
            class="presenterBtn green presenterArchiveShowAnswerBtn"
            onclick="sendCommand('showAnswer')"
          >
            إظهار الإجابة
          </button>

          <button
            type="button"
            class="presenterBtn gray presenterArchiveUndoBtn"
            onclick="sendCommand('undo')"
          >
            تراجع
          </button>

          <button
            type="button"
            class="presenterBtn blue presenterArchiveNextRoundBtn"
            onclick="sendCommand('nextRound')"
          >
            الجولة التالية
          </button>
        </div>

      </div>

    </div>
  `

  refreshPresenterArchiveFromState()
}

async function refreshPresenterArchiveFromState() {
  if (presenterSegment !== "archive") return

  const round = getPresenterArchiveRound()

  if (presenterArchiveLoadedRound !== round) {
    await loadPresenterArchiveRound(round)
  }

  const remainingPoints = getPresenterArchiveRemainingPoints()
  const activeTeam = getPresenterArchiveActiveTeam()

  updatePresenterTeamButtonsOnly(activeTeam)

  const roundText = document.getElementById("presenterArchiveRoundText")
  if (roundText) {
    roundText.innerText = round
  }

  const scoreBox = document.querySelector(".presenterArchiveSimpleScore strong")
  if (scoreBox) {
    scoreBox.innerText = remainingPoints
  }

  const list = document.querySelector(".presenterArchiveRequiredList")
  if (list) {
    list.innerHTML = buildPresenterArchiveRequiredList()
  }

  const doubleBtn = document.querySelector(".presenterArchiveDoubleBtn")
  const wrongBtn = document.querySelector(".presenterArchiveWrongBtn")
  const timerBtn = document.querySelector(".presenterArchiveStartTimerBtn")

  if (doubleBtn) {
    doubleBtn.disabled = !activeTeam
  }

  if (wrongBtn) {
    wrongBtn.disabled = !activeTeam
  }

  if (timerBtn) {
    timerBtn.disabled = !activeTeam
  }
}

function setPresenterArchiveRound(round) {
  const maxRound = getPresenterArchiveMaxRound()

  const safeRound = Math.min(
    Math.max(Number(round || 1), 1),
    maxRound
  )

  sendCommand("setRound", {
    round: safeRound
  })
}

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

function getPresenterReaderCachedHtml(segment) {
  return presenterReaderHtmlCache.get(
    getPresenterReaderCacheKey(segment)
  ) || ""
}

function savePresenterReaderCachedHtml(segment, html) {
  if (!html) return

  presenterReaderHtmlCache.set(
    getPresenterReaderCacheKey(segment),
    html
  )
}

function clearPresenterReaderCache(segment = null) {
  if (!segment) {
    presenterReaderHtmlCache.clear()
    return
  }

  presenterReaderHtmlCache.delete(
    getPresenterReaderCacheKey(segment)
  )
}

function normalizePresenterReaderSegmentKey(segment) {
  return normalizePresenterFinalSegmentKey(
    normalizePresenterSegmentKey(segment)
  )
}

function presenterReaderLogout() {
  function presenterReaderLogout() {
  clearPresenterReaderCache()
  closeReaderMediaViewer()

  localStorage.removeItem("presenter_session_id")
  localStorage.removeItem("presenter_join_code")

  presenterSessionId = null
  presenterReaderSegment = null

  showPresenterJoin()
}
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

  await loadPresenterVisibleSegments()

  const subtitle = document.getElementById("presenterReaderSubtitle")

  if (subtitle) {
    const modelName = presenterLiveState?.currentModelName || ""
    subtitle.innerText = modelName
      ? `النموذج: ${modelName}`
      : `النموذج رقم ${presenterModel}`
  }

  const grid = document.getElementById("presenterReaderSegmentsGrid")
  if (!grid) return

  if (!presenterVisibleSegments.length) {
  grid.innerHTML = `
    <section class="readerEmptyCard">
      لا توجد فقرات مفعلة حاليًا
    </section>
  `

  ensurePresenterInsideModeSwitch()
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

ensurePresenterInsideModeSwitch()
}


async function openPresenterReaderSegment(segment) {
  segment = normalizePresenterReaderSegmentKey(segment)

  await loadPresenterVisibleSegments()

  if (!isPresenterSegmentVisible(segment)) {
    showToast("هذه الفقرة معطلة من الأدمن")
    await renderPresenterReaderHome()
    return
  }

  presenterReaderSegment = segment

  showPresenterReaderSegmentPage()

  const title =
    document.getElementById(
      "presenterReaderSegmentTitle"
    )

  const panel =
    document.getElementById(
      "presenterReaderPanel"
    )

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
      جارٍ تحميل البيانات...
    </section>
  `

  try {
    if (segment === "warmup") {
      await renderPresenterReaderWarmup()
    } else if (segment === "top10") {
      await renderPresenterReaderTop10()
    } else if (segment === "auction") {
      await renderPresenterReaderAuction()
    } else if (segment === "who") {
      await renderPresenterReaderWho()
    } else if (segment === "explain") {
      await renderPresenterReaderExplain()
    } else if (segment === "archive") {
      await renderPresenterReaderArchive()
    } else if (segment === "randomChallenge") {
      panel.innerHTML = readerEmpty(
        "فقرة التحدي لا تحتوي على أسئلة من الأدمن"
      )
    } else if (segment === "finalRound1") {
      await renderPresenterReaderFinalRound1()
    } else if (segment === "finalRound2") {
      await renderPresenterReaderFinalRound2()
    } else if (segment === "finalRound3") {
      await renderPresenterReaderFinalRound3()
    } else if (segment === "finalRound4") {
      await renderPresenterReaderFinalRound4()
    } else {
      panel.innerHTML = readerEmpty(
        "هذه الفقرة غير مدعومة في دليل الأسئلة"
      )
    }

    savePresenterReaderCachedHtml(
      segment,
      panel.innerHTML
    )
  } catch (err) {
    console.log(
      "READER SEGMENT ERROR:",
      err
    )

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
   Reader: Warmup
   كل فئة: الرقم + السؤال + الإجابة
========================= */

async function renderPresenterReaderWarmup() {
  const panel = document.getElementById("presenterReaderPanel")
  if (!panel) return

  const { data, error } = await db
    .from("questions")
    .select("category, category_name, number, question, answer")
    .eq("model", Number(presenterModel))
    .eq("segment", "warmup")
    .order("category", { ascending: true })
    .order("number", { ascending: true })

  if (error) throw error

  const rows = data || []

  if (!rows.length) {
    panel.innerHTML = readerEmpty("لا توجد أسئلة في التسخين")
    return
  }

  panel.innerHTML = `
    <div class="readerWarmupGrid">
      ${[1, 2, 3, 4].map(cat => {
        const catRows = rows.filter(row => Number(row.category) === cat)
        const catName = catRows[0]?.category_name || `الفئة ${cat}`

        return `
          <section class="readerCategoryBox">
            <h2>${readerEscape(catName)}</h2>

            <div class="readerCategoryQuestions">
              ${[1, 2, 4].map(num => {
                const row = catRows.find(x => Number(x.number) === num)

                return readerMiniCard({
                  id: readerId(["warmup", cat, num]),
                  number: num,
                  title: `سؤال ${num}`,
                  question: row?.question || "",
                  answer: row?.answer || ""
                })
              }).join("")}
            </div>
          </section>
        `
      }).join("")}
    </div>
  `
}

/* =========================
   Reader: Top 10
   كل جولة صفحة/قسم - السؤال فوق والإجابات مرقمة
========================= */

async function renderPresenterReaderTop10() {
  const panel = document.getElementById("presenterReaderPanel")
  if (!panel) return

  const { data, error } = await db
    .from("top10_questions")
    .select("round, position, question, answer")
    .eq("model", Number(presenterModel))
    .order("round", { ascending: true })
    .order("position", { ascending: true })

  if (error) throw error

  const rows = data || []

  if (!rows.length) {
    panel.innerHTML = readerEmpty("لا توجد بيانات في Top 10")
    return
  }

  const rounds = [...new Set(rows.map(row => Number(row.round)))].sort((a, b) => a - b)

  panel.innerHTML = `
    <div class="readerRoundsStack">
      ${rounds.map(round => {
        const roundRows = rows.filter(row => Number(row.round) === round)
        const question = roundRows[0]?.question || ""

        return `
          <section class="readerRoundPage">
            <div class="readerRoundHead">
              <h2>الجولة ${round}</h2>
            </div>

            <div
              class="readerMainQuestion ${readerReadClass(readerId(["top10", round, "question"]))}"
              onclick="toggleReaderRead('${readerId(["top10", round, "question"])}', this)"
            >
              <label>السؤال</label>
              <p>${readerEscape(question || "لا يوجد سؤال رئيسي")}</p>
            </div>

            <div class="readerTop10Answers">
              ${roundRows.map(row => `
                <div
                  class="readerTop10Answer ${readerReadClass(readerId(["top10", round, row.position]))}"
                  onclick="toggleReaderRead('${readerId(["top10", round, row.position])}', this)"
                >
                  <strong>${readerEscape(row.position)}</strong>
                  <span>${readerEscape(row.answer || "—")}</span>
                </div>
              `).join("")}
            </div>
          </section>
        `
      }).join("")}
    </div>
  `
}

/* =========================
   Reader: Auction - فتبلة
   الرقم + الصورة/الفيديو مصغر + الإجابة فقط
========================= */

async function renderPresenterReaderAuction() {
  const panel = document.getElementById("presenterReaderPanel")
  if (!panel) return

  const { data, error } = await db
    .from("auction_questions")
    .select("number, answer, image, video")
    .eq("model", Number(presenterModel))
    .order("number", { ascending: true })

  if (error) throw error

  const rows = data || []

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
   Reader: Who - من هو
   الرقم + صورة مصغرة + الإجابة
========================= */

async function renderPresenterReaderWho() {
  const panel = document.getElementById("presenterReaderPanel")
  if (!panel) return

  const { data, error } = await db
    .from("who_images")
    .select("number, answer, image")
    .eq("model", Number(presenterModel))
    .order("number", { ascending: true })

  if (error) throw error

  const rows = data || []

  if (!rows.length) {
    panel.innerHTML = readerEmpty("لا توجد بيانات في من هو")
    return
  }

  panel.innerHTML = `
    <div class="readerMediaList">
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

/* =========================
   Reader: Explain
   الرقم + الإجابة فقط
========================= */

async function renderPresenterReaderExplain() {
  const panel = document.getElementById("presenterReaderPanel")
  if (!panel) return

  const { data, error } = await db
    .from("explain_words")
    .select("number, word")
    .eq("model", Number(presenterModel))
    .order("number", { ascending: true })

  if (error) throw error

  const rows = data || []

  if (!rows.length) {
    panel.innerHTML = readerEmpty("لا توجد كلمات في اشرح الكلمة")
    return
  }

  panel.innerHTML = `
    <div class="readerSimpleGrid">
      ${rows.map(row => readerMiniCard({
        id: readerId(["explain", row.number]),
        number: row.number,
        title: `رقم ${row.number}`,
        answer: row.word
      })).join("")}
    </div>
  `
}

/* =========================
   Reader: Final Round 1 - بدون نقط
   الرقم + الإجابة فقط
========================= */

async function renderPresenterReaderFinalRound1() {
  const panel = document.getElementById("presenterReaderPanel")
  if (!panel) return

  const { data, error } = await db
    .from("final_round1_items")
    .select("number, answer")
    .eq("model", Number(presenterModel))
    .gte("number", 1)
    .lte("number", 8)
    .order("number", { ascending: true })

  if (error) throw error

  const rows = data || []

  if (!rows.length) {
    panel.innerHTML = readerEmpty("لا توجد بيانات في بدون نقط")
    return
  }

  panel.innerHTML = `
    <div class="readerSimpleGrid">
      ${rows.map(row => readerMiniCard({
        id: readerId(["final1", row.number]),
        number: row.number,
        title: `رقم ${row.number}`,
        answer: row.answer
      })).join("")}
    </div>
  `
}

/* =========================
   Reader: Final Round 2 - صح صحلي
   1 و 4: التلميح + الإجابة
   2 و 5: الكلمات فقط
   3 و 6: الصورة مصغرة + الإجابة
========================= */

async function renderPresenterReaderFinalRound2() {
  const panel = document.getElementById("presenterReaderPanel")
  if (!panel) return

  const [textRes, imageRes] = await Promise.all([
    db
      .from("final_round2_items")
      .select("*")
      .eq("model", Number(presenterModel))
      .order("number", { ascending: true })
      .order("item_order", { ascending: true }),

    db
      .from("final_round3_items")
      .select("*")
      .eq("model", Number(presenterModel))
      .in("number", [101, 102])
      .order("number", { ascending: true })
      .order("image_order", { ascending: true })
  ])

  if (textRes.error) throw textRes.error
  if (imageRes.error) throw imageRes.error

  const textRows = textRes.data || []
  const imageRows = imageRes.data || []

  panel.innerHTML = `
    <div class="readerRoundsStack">
      ${[1, 2, 3, 4, 5, 6].map(number => {
        const type = getPresenterFinalRound2Type(number)

        if (type === "scramble") {
          const rows = textRows.filter(row => Number(row.number) === number)

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
                        id: readerId(["final2", number, row.item_order]),
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
          const rows = textRows.filter(row => Number(row.number) === number)

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

        const dbNumber = getPresenterFinalRound2ImageDbNumber(number)
        const rows = imageRows.filter(row => Number(row.number) === dbNumber)

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
                      id: readerId(["final2img", number, row.image_order]),
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
      }).join("")}
    </div>
  `
}

/* =========================
   Reader: Final Round 3 - قصة
   أجزاء السؤال مقسمة + الإجابة + الرقم
========================= */

async function renderPresenterReaderFinalRound3() {
  const panel = document.getElementById("presenterReaderPanel")
  if (!panel) return

  const { data, error } = await db
    .from("final_round1_items")
    .select("*")
    .eq("model", Number(presenterModel))
    .gte("number", 201)
    .lte("number", 208)
    .order("number", { ascending: true })

  if (error) throw error

  const rows = data || []

  if (!rows.length) {
    panel.innerHTML = readerEmpty("لا توجد بيانات في قصة")
    return
  }

  panel.innerHTML = `
    <div class="readerSimpleGrid">
      ${rows.map(row => {
        const displayNumber = Number(row.number) - 200

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
      }).join("")}
    </div>
  `
}

/* =========================
   Reader: Final Round 4 - التركيز
   فيديو/صورة مصغرة + السؤال + الإجابة
========================= */

async function renderPresenterReaderFinalRound4() {
  const panel = document.getElementById("presenterReaderPanel")
  if (!panel) return

  const { data, error } = await db
    .from("final_round3_items")
    .select("*")
    .eq("model", Number(presenterModel))
    .gte("number", 1)
    .lte("number", 8)
    .eq("image_order", 1)
    .order("number", { ascending: true })

  if (error) throw error

  const rows = data || []

  if (!rows.length) {
    panel.innerHTML = readerEmpty("لا توجد بيانات في التركيز")
    return
  }

  panel.innerHTML = `
    <div class="readerMediaList">
      ${rows.map(row => readerMiniCard({
        id: readerId(["focus", row.number]),
        number: row.number,
        title: `رقم ${row.number}`,
        question: row.question,
        answer: row.answer,
        image: row.image,
        video: row.video
      })).join("")}
    </div>
  `
}

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

    const { data, error } = await db
      .from("game_sessions")
      .select("*")
      .eq("id", sessionId)
      .maybeSingle()

    if (error || !data || data.status === "ended") {
      renderPresenterEnded()
      return
    }

    applyPresenterSessionData(data)
    subscribeToGameSession(sessionId)

    renderPresenterHome()
    ensurePresenterInsideModeSwitch()
    showToast("تم التحويل إلى وضع التحكم")
  }
}
function hidePresenterInsideModeSwitch() {
  const box = document.getElementById("presenterInsideModeSwitch")
  if (box) box.classList.add("hidden")
}