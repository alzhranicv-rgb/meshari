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
  const urlParams = new URLSearchParams(window.location.search)
  const openedFromQr = urlParams.get("join") === "1"

if (openedFromQr) {
  localStorage.removeItem("presenter_session_id")
  localStorage.removeItem("presenter_join_code")
}

  const savedSessionId = localStorage.getItem("presenter_session_id")

  if (!savedSessionId) {
    showPresenterJoin()
    return
  }

  const { data, error } = await db
    .from("game_sessions")
    .select("*")
    .eq("id", savedSessionId)
    .maybeSingle()

  if (error || !data) {
    localStorage.removeItem("presenter_session_id")
    localStorage.removeItem("presenter_join_code")
    showPresenterJoin()
    return
  }

  if (data.status === "ended") {
    renderPresenterEnded()
    return
  }

  presenterSessionId = data.id
presenterModel = Number(data.model || 1)
presenterTeamAName = data.team_a || "الفريق الأول"
presenterTeamBName = data.team_b || "الفريق الثاني"
presenterLiveState = data.state || {}

if (typeof syncPresenterSelectedTeamFromDisplayState === "function") {
  syncPresenterSelectedTeamFromDisplayState()
}

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

function showPresenterReaderHomePage() {
  hideAllPresenterPages()
  document.getElementById("presenterReaderHome")?.classList.remove("hidden")
}

function showPresenterReaderSegmentPage() {
  hideAllPresenterPages()
  document.getElementById("presenterReaderSegmentPage")?.classList.remove("hidden")
  hidePresenterInsideModeSwitch()
}


function normalizePresenterSegmentKey(key) {
  key = String(key || "")

  if (key === "finalRound1") return "final_round1"
  if (key === "finalRound2") return "final_round2"
  if (key === "finalRound3") return "final_round3"
  if (key === "finalRound4") return "final_round4"

  if (key === "final_round1") return "final_round1"
  if (key === "final_round2") return "final_round2"
  if (key === "final_round3") return "final_round3"
  if (key === "final_round4") return "final_round4"

  return key
}

function getPresenterSegmentName(segment) {
  const key = normalizePresenterSegmentKey(segment)

  if (key === "final") {
  return getPresenterFinalRoundTitle(presenterFinalRound, "short")
}

  const item = ALL_PRESENTER_SEGMENTS.find(x => {
    return normalizePresenterSegmentKey(x.key) === key
  })

  return item?.title || "لوحة المقدم"
}

async function loadPresenterGlobalSegmentVisibilityMap() {
  const map = {}

  try {
    const { data, error } = await db
      .from("global_segment_visibility")
      .select("segment_key,is_enabled")

    if (error) {
      console.log("PRESENTER GLOBAL SEGMENT VISIBILITY ERROR:", error)
      return map
    }

    ;(data || []).forEach(row => {
      const key = normalizePresenterSegmentKey(row.segment_key)
      map[key] = row.is_enabled !== false
    })

    return map
  } catch (err) {
    console.log("PRESENTER GLOBAL SEGMENT VISIBILITY CATCH:", err)
    return map
  }
}

function isPresenterSegmentGloballyEnabled(segmentKey, globalMap = {}) {
  const key = normalizePresenterSegmentKey(segmentKey)
  return globalMap[key] !== false
}

async function loadPresenterVisibleSegments() {
  const modelId = Number(presenterModel || 0)
  const globalMap = await loadPresenterGlobalSegmentVisibilityMap()

  presenterVisibleSegments = ALL_PRESENTER_SEGMENTS
    .filter(item => isPresenterSegmentGloballyEnabled(item.key, globalMap))
    .map(item => ({
      ...item,
      key: normalizePresenterSegmentKey(item.key),
      is_visible: true,
      sort_order: item.sort
    }))

  if (!modelId) {
    return presenterVisibleSegments
  }

  const { data, error } = await db
    .from("visible_segments")
    .select("*")
    .eq("model", modelId)
    .order("sort_order", { ascending: true })

  if (error) {
    console.log("LOAD PRESENTER VISIBLE SEGMENTS ERROR:", error)
    return presenterVisibleSegments
  }

  const map = {}

  ALL_PRESENTER_SEGMENTS.forEach(item => {
    const key = normalizePresenterSegmentKey(item.key)

    if (!isPresenterSegmentGloballyEnabled(key, globalMap)) return

    map[key] = {
      ...item,
      key,
      is_visible: true,
      sort_order: item.sort
    }
  })

  ;(data || []).forEach(row => {
    const key = normalizePresenterSegmentKey(row.segment_key)

    if (!map[key]) return

    map[key] = {
      ...map[key],
      is_visible: !!row.is_visible,
      sort_order: Number(row.sort_order || map[key].sort)
    }
  })

  presenterVisibleSegments = Object.values(map)
    .filter(item => item.is_visible)
    .sort((a, b) => {
      return Number(a.sort_order || a.sort) - Number(b.sort_order || b.sort)
    })

  return presenterVisibleSegments
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

await markPresenterStartedSession(data.id)

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

async function markPresenterStartedSession(sessionId) {
  if (!sessionId || !window.db) return

  const { data, error } = await db
    .from("game_sessions")
    .select("state")
    .eq("id", sessionId)
    .maybeSingle()

  if (error || !data) {
    console.log("mark presenter started read error:", error)
    return
  }

  const nextState = {
    ...(data.state || {}),
    presenterStarted: true,
    presenterStartedAt: new Date().toISOString()
  }

  const { error: updateError } = await db
    .from("game_sessions")
    .update({
      state: nextState,
      updated_at: new Date().toISOString()
    })
    .eq("id", sessionId)

  if (updateError) {
    console.log("mark presenter started update error:", updateError)
  }
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

  presenterChannel = db.channel("game_session_" + sessionId)

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
        fetchPresenterSessionNow(sessionId, true)
      }
    })

  presenterSyncTimer = setInterval(() => {
    if (document.hidden) return
    fetchPresenterSessionNow(sessionId, false)
  }, 4000)
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

  renderPresenterHome()

  const sent = await sendCommand("goHome")

  const sessionId = localStorage.getItem("presenter_session_id")

  if (sessionId && window.db) {
    db
      .from("game_sessions")
      .update({
        active_segment: null,
        updated_at: new Date().toISOString()
      })
      .eq("id", sessionId)
      .then(({ error }) => {
        if (error) console.log("Go home update error:", error)
      })
  }

  setTimeout(() => {
    presenterGoingHome = false
  }, sent ? 500 : 800)
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
  round = Number(round || 1)

  presenterSegment = "final"
  presenterFinalRound = round
  presenterFinalForcedRound = round
  presenterFinalForcedRoundUntil = Date.now() + 30000
  presenterFinalRoundOverride = round
  presenterFinalSelected = { round, number: null }

  presenterLiveState = {
    ...(presenterLiveState || {}),
    final: {
      ...(presenterLiveState?.final || {}),
      round
    }
  }

  const sessionId = localStorage.getItem("presenter_session_id")
  if (!sessionId || !window.db) return

  const { data, error } = await db
    .from("game_sessions")
    .select("state")
    .eq("id", sessionId)
    .maybeSingle()

  if (error || !data) {
    console.log("FORCE FINAL ROUND READ ERROR:", error)
    return
  }

  const nextState = {
    ...(data.state || {}),
    final: {
      ...(data.state?.final || {}),
      round
    }
  }

  const { error: updateError } = await db
    .from("game_sessions")
    .update({
      active_segment: getPresenterFinalSessionSegmentKey(round),
      state: nextState,
      updated_at: new Date().toISOString()
    })
    .eq("id", sessionId)

  if (updateError) {
    console.log("FORCE FINAL ROUND UPDATE ERROR:", updateError)
  }
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

  const sessionId = localStorage.getItem("presenter_session_id")

  if (!sessionId) {
    showToast("ادخل كود الجلسة أولاً")
    return false
  }

  if (!window.db) {
    showToast("الاتصال غير جاهز")
    return false
  }

  const clientCommandId = `${Date.now()}_${Math.random().toString(36).slice(2)}`

  const commandPayload = {
    ...payload,
    __client_command_id: clientCommandId
  }

  const command = {
    session_id: sessionId,
    model: Number(presenterModel || 1),
    segment: presenterSegment || "global",
    action,
    payload: commandPayload,
    created_at: new Date().toISOString()
  }

  let broadcastSent = false
  let databaseSaved = false

  try {
    if (presenterChannel) {
      const res = await presenterChannel.send({
        type: "broadcast",
        event: "presenter_command",
        payload: command
      })

      broadcastSent = true
    }
  } catch (error) {
    console.log("Presenter broadcast error:", error)
    broadcastSent = false
  }

  try {
    const { error } = await db
      .from("presenter_commands")
      .insert(command)

    if (error) {
      console.log("Presenter command database error:", error)
      databaseSaved = false
    } else {
      databaseSaved = true
    }
  } catch (error) {
    console.log("Presenter command database catch:", error)
    databaseSaved = false
  }

  if (!broadcastSent && !databaseSaved) {
    showToast("تعذر تنفيذ الأمر")
    return false
  }

  return true
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

async function renderWarmup() {
  const panel = document.getElementById("presenterPanel")
  if (!panel) return

  const { data } = await db
    .from("questions")
    .select("category, category_name, number, question, answer")
    .eq("model", presenterModel)
    .eq("segment", "warmup")
    .order("category", { ascending: true })
    .order("number", { ascending: true })

  presenterWarmupRows = data || []

  const used = getPresenterWarmupUsed()
  const locked = getPresenterWarmupLocked()
  const currentKey = getPresenterWarmupCurrentKey()

  panel.innerHTML = `
    <div class="presenterWarmupLayout">

      <div class="presenterWarmupLeft">

        <section class="presenterCard presenterWarmupNumbersCard">
          <div class="presenterLabel">الفئات والأسئلة</div>

          <div class="presenterWarmupCats">
            ${[1, 2, 3, 4].map(cat => {
              const catRows = presenterWarmupRows.filter(row => {
                return Number(row.category) === Number(cat)
              })

              const catName = catRows[0]?.category_name || `الفئة ${cat}`

              return `
                <div class="presenterWarmupCat">
                  <div class="presenterWarmupCatTitle">${catName}</div>

                  <div class="presenterWarmupNumbers">
                    ${[1, 2, 4].map(num => {
                      const key = `${cat}_${num}`
                      const isUsed = !!used[key]
                      const isCurrent = currentKey === key
                      const isSelected =
                        presenterWarmupSelected &&
                        Number(presenterWarmupSelected.category) === Number(cat) &&
                        Number(presenterWarmupSelected.number) === Number(num)

                      return `
                        <button
                          type="button"
                          class="presenterNumberBtn ${isUsed ? "presenterOpened" : ""} ${isCurrent || isSelected ? "selectedPresenterTeam" : ""}"
                          ${isUsed || locked ? "disabled" : ""}
                          onclick="openWarmupPresenterQuestion(${cat}, ${num}, event)"
                        >
                          ${isUsed ? "" : num}
                        </button>
                      `
                    }).join("")}
                  </div>
                </div>
              `
            }).join("")}
          </div>
        </section>

      </div>

      <div class="presenterWarmupRight">

        <div class="presenterWarmupTeamsBox">
          ${teamButtons()}
        </div>

        <section class="presenterCard presenterWarmupPreviewCard">

          <div class="presenterLabel">السؤال</div>

          <div id="presenterWarmupQuestionText" class="presenterQuestionBody presenterBigQuestionBody">
            اختر رقم السؤال
          </div>

          <div class="presenterLabel">الإجابة</div>

          <div id="presenterWarmupAnswerText" class="presenterAnswerBody presenterBigAnswerBody">
            —
          </div>

        </section>

        <div class="presenterWarmupActions">
          <button
            type="button"
            class="presenterBtn gray presenterDoubleBtn"
            onclick="sendCommand('double')"
            ${locked || currentKey ? "disabled" : ""}
          >
            دوبيلا
          </button>

          <button
            type="button"
            class="presenterBtn red presenterWrongBtn"
            onclick="sendCommand('wrong')"
          >
            ✕ خطأ
          </button>

          <button
            type="button"
            class="presenterBtn green presenterCorrectBtn"
            onclick="sendCommand('correct')"
          >
            ✓ صح
          </button>
        </div>

      </div>

    </div>
  `

  if (currentKey) {
    const [cat, num] = currentKey.split("_")
    showPresenterWarmupPreview(Number(cat), Number(num))
  } else {
    presenterWarmupSelected = null
  }

  refreshPresenterWarmupFromState()
}

function openWarmupPresenterQuestion(category, number, event) {
  const used = getPresenterWarmupUsed()
  const key = `${category}_${number}`

  if (getPresenterWarmupLocked()) {
    showToast("سجل النتيجة أولاً")
    return
  }

  if (used[key]) {
    showToast("السؤال مستخدم")
    return
  }

  if (!getPresenterWarmupActiveTeam()) {
    showToast("اختر الفريق أولاً")
    return
  }

  presenterWarmupSelected = {
    category: Number(category),
    number: Number(number)
  }

  const btn = event?.currentTarget

  if (btn) {
    btn.disabled = true
    btn.classList.add("presenterOpened", "selectedPresenterTeam")
    btn.innerText = ""
  }

  showPresenterWarmupPreview(category, number)

  sendCommand("openNumber", {
    category: Number(category),
    number: Number(number)
  })
}

function showPresenterWarmupPreview(category, number) {
  const item = presenterWarmupRows.find(row => {
    return Number(row.category) === Number(category) &&
           Number(row.number) === Number(number)
  })

  const questionBox = document.getElementById("presenterWarmupQuestionText")
  const answerBox = document.getElementById("presenterWarmupAnswerText")

  if (questionBox) {
    questionBox.innerText = item?.question || "لا يوجد سؤال"
  }

  if (answerBox) {
    answerBox.innerText = item?.answer || "لا توجد إجابة"
  }
}

function refreshPresenterWarmupFromState() {
  if (presenterSegment !== "warmup") return

  const used = getPresenterWarmupUsed()
  const locked = getPresenterWarmupLocked()
  const currentKey = getPresenterWarmupCurrentKey()
  const activeTeam = getPresenterWarmupActiveTeam()

  updatePresenterTeamButtonsOnly(activeTeam)

  document
    .querySelectorAll(".presenterWarmupNumbers .presenterNumberBtn")
    .forEach(btn => {
      const onclick = btn.getAttribute("onclick") || ""
      const match = onclick.match(/openWarmupPresenterQuestion\((\d+),\s*(\d+)/)

      if (!match) return

      const cat = Number(match[1])
      const num = Number(match[2])
      const key = `${cat}_${num}`

      const isUsed = !!used[key]
      const isCurrent = currentKey === key

      btn.classList.remove("presenterOpened", "selectedPresenterTeam")

      if (isUsed) {
        btn.classList.add("presenterOpened")
        btn.disabled = true
        btn.innerText = ""
      } else {
        btn.innerText = String(num)
        btn.disabled = !!locked && !isCurrent
      }

      if (isCurrent) {
        btn.classList.add("selectedPresenterTeam")
        btn.disabled = true
      }
    })

  if (currentKey) {
    const [cat, num] = currentKey.split("_")
    showPresenterWarmupPreview(Number(cat), Number(num))
  } else {
    const questionBox = document.getElementById("presenterWarmupQuestionText")
    const answerBox = document.getElementById("presenterWarmupAnswerText")

    if (questionBox) questionBox.innerText = "اختر رقم السؤال"
    if (answerBox) answerBox.innerText = "—"

    presenterWarmupSelected = null
  }

  const doubleBtn = document.querySelector(".presenterWarmupActions .presenterDoubleBtn")

  if (doubleBtn) {
    doubleBtn.disabled = !!locked || !!currentKey
  }
}

/* =========================
   TOP 10
========================= */

let presenterTop10Rows = []
let presenterTop10LoadedRound = null
let presenterTop10OpenedBy = JSON.parse(
  localStorage.getItem("presenter_top10_opened_by") || "{}"
)

function savePresenterTop10OpenedBy() {
  localStorage.setItem(
    "presenter_top10_opened_by",
    JSON.stringify(presenterTop10OpenedBy)
  )
}

function getPresenterTop10Root() {
  return presenterLiveState?.top10 || {}
}

function getPresenterTop10State() {
  const root = getPresenterTop10Root()

  return root?.top10State || {
    round: 1,
    activeTeam: null,
    opened: { 1: [], 2: [], 3: [], 4: [] },
    answers: { 1: {}, 2: {}, 3: {}, 4: {} },
    question: { 1: "", 2: "", 3: "", 4: "" },
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
  return Number(root?.top10MaxRound || 3)
}

function getPresenterTop10Round() {
  return Number(getPresenterTop10State()?.round || 1)
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

function getPresenterTop10Opened(round = getPresenterTop10Round()) {
  const top10 = getPresenterTop10State()
  return (top10.opened?.[round] || []).map(Number)
}

function getTop10OpenedTeamName(round, number) {
  const team = presenterTop10OpenedBy[`${round}_${number}`]

  if (team === "A") return presenterTeamAName
  if (team === "B") return presenterTeamBName

  return ""
}

async function loadPresenterTop10RoundRows(round) {
  const { data } = await db
    .from("top10_questions")
    .select("round, position, question, answer")
    .eq("model", presenterModel)
    .eq("round", round)
    .order("position", { ascending: true })

  presenterTop10Rows = data || []
  presenterTop10LoadedRound = round
}

async function renderTop10() {
  const panel = document.getElementById("presenterPanel")
  if (!panel) return

  const top10 = getPresenterTop10State()
  const round = getPresenterTop10Round()
  const opened = getPresenterTop10Opened(round)
  const question = top10.question?.[round] || "السؤال يظهر هنا"
  const errorsA = Number(top10.errors?.[round]?.A || 0)
  const errorsB = Number(top10.errors?.[round]?.B || 0)

  await loadPresenterTop10RoundRows(round)

  function buildTop10AnswerButton(number) {
    const item = presenterTop10Rows.find(row => {
      return Number(row.position) === Number(number)
    })

    const isOpened = opened.includes(Number(number))
    const openedName = getTop10OpenedTeamName(round, number)

    return `
      <button
        type="button"
        class="presenterTop10AnswerBtn ${isOpened ? "opened" : ""}"
        ${isOpened ? "disabled" : ""}
        onclick="openTop10PresenterNumber(${number}, event)"
      >
        <span class="presenterTop10AnswerNo">${number}</span>

        <span class="presenterTop10AnswerText">
          ${item?.answer || "-"}
        </span>

        <span class="presenterTop10OpenedBy">
          ${isOpened ? (openedName || "تم الفتح") : ""}
        </span>
      </button>
    `
  }

  panel.innerHTML = `
    <div class="presenterTop10Layout">

      <div class="presenterTop10Left">

        <section class="presenterCard presenterTop10AnswersCard">
          <div class="presenterLabel">الإجابات</div>

          <div class="presenterTop10AnswersCols">

            <div class="presenterTop10AnswersCol presenterTop10RightCol">
              ${[1, 2, 3, 4, 5].map(num => {
                return buildTop10AnswerButton(num)
              }).join("")}
            </div>

            <div class="presenterTop10AnswersCol presenterTop10LeftCol">
              ${[6, 7, 8, 9, 10].map(num => {
                return buildTop10AnswerButton(num)
              }).join("")}
            </div>

          </div>
        </section>

      </div>

      <div class="presenterTop10Right">

        <div class="presenterTop10TeamsBox">
          ${teamButtons()}
        </div>

        <section class="presenterCard presenterTop10QuestionCard">

          <div class="presenterTop10StatusTop">

            <div class="presenterTop10RoundMini">
              <span>الجولة</span>
              <strong id="presenterTop10RoundText">${round}</strong>
            </div>

            <div class="presenterTop10ErrorsMini">
              <div class="presenterTop10ErrorMiniBox">
                <span>${presenterTeamAName}</span>
                <strong id="presenterTop10ErrorsA">${errorsA} / 3</strong>
              </div>

              <div class="presenterTop10ErrorMiniBox">
                <span>${presenterTeamBName}</span>
                <strong id="presenterTop10ErrorsB">${errorsB} / 3</strong>
              </div>
            </div>

          </div>

          <div class="presenterTop10QuestionClear">
            <div class="presenterLabel">السؤال</div>

            <div id="presenterTop10QuestionText" class="presenterTop10QuestionText">
              ${question}
            </div>
          </div>

        </section>

        <div class="presenterTop10Actions">
          <button
            type="button"
            class="presenterBtn gray presenterTop10DoubleBtn"
            onclick="sendCommand('double')"
          >
            دوبيلا
          </button>

          <button
            type="button"
            class="presenterBtn green"
            onclick="sendCommand('showAnswer')"
          >
            إظهار الإجابات
          </button>

          <button
            type="button"
            class="presenterBtn red"
            onclick="sendCommand('wrong')"
          >
            خطأ الفريق
          </button>

          <button
            type="button"
            class="presenterBtn gray"
            onclick="sendCommand('undo')"
          >
            تراجع
          </button>

          <button
            type="button"
            class="presenterBtn blue"
            onclick="sendCommand('switchTurn')"
          >
            تبديل الدور
          </button>

          <button
            type="button"
            class="presenterBtn blue"
            onclick="sendCommand('nextRound')"
          >
            الجولة التالية
          </button>
        </div>

      </div>

    </div>
  `

  refreshPresenterTop10FromState()
}

async function refreshPresenterTop10FromState() {
  if (presenterSegment !== "top10") return

  const top10 = getPresenterTop10State()
  const round = getPresenterTop10Round()

  if (presenterTop10LoadedRound !== round) {
    await loadPresenterTop10RoundRows(round)
  }

  const opened = getPresenterTop10Opened(round)
  const question = top10.question?.[round] || "السؤال يظهر هنا"
  const errorsA = Number(top10.errors?.[round]?.A || 0)
  const errorsB = Number(top10.errors?.[round]?.B || 0)
  const activeTeam = getPresenterTop10ActiveTeam()

  updatePresenterTeamButtonsOnly(activeTeam)

  const roundText = document.getElementById("presenterTop10RoundText")
  if (roundText) {
    roundText.innerText = round
  }

  const questionBox = document.getElementById("presenterTop10QuestionText")
  if (questionBox) {
    questionBox.innerText = question
  }

  const errorsABox = document.getElementById("presenterTop10ErrorsA")
  const errorsBBox = document.getElementById("presenterTop10ErrorsB")

  if (errorsABox) errorsABox.innerText = `${errorsA} / 3`
  if (errorsBBox) errorsBBox.innerText = `${errorsB} / 3`

  document.querySelectorAll(".presenterTop10AnswerBtn").forEach(btn => {
    const numberBox = btn.querySelector(".presenterTop10AnswerNo")
    const textBox = btn.querySelector(".presenterTop10AnswerText")
    const openedByBox = btn.querySelector(".presenterTop10OpenedBy")

    const number = Number(numberBox?.innerText || 0)
    if (!number) return

    const isOpened = opened.includes(number)

    const row = presenterTop10Rows.find(item => {
      return Number(item.position) === Number(number)
    })

    const answer =
      top10.answers?.[round]?.[number] ||
      row?.answer ||
      "-"

    btn.classList.toggle("opened", isOpened)
    btn.disabled = isOpened

    if (textBox) {
      textBox.innerText = answer
    }

    if (openedByBox) {
      const openedTeamName = getTop10OpenedTeamName(round, number)

      openedByBox.innerText = isOpened
        ? (openedTeamName || "تم الفتح")
        : ""
    }
  })
}

function setPresenterTop10Round(round) {
  const maxRound = getPresenterTop10MaxRound()
  const safeRound = Math.min(
    Math.max(Number(round || 1), 1),
    maxRound
  )

  sendCommand("setRound", {
    round: safeRound
  })
}

function openTop10PresenterNumber(number, event) {
  const round = getPresenterTop10Round()
  const opened = getPresenterTop10Opened(round)
  const activeTeam = getPresenterTop10ActiveTeam()

  if (!activeTeam) {
    showToast("اختر الفريق أولاً")
    return
  }

  if (opened.includes(Number(number))) {
    showToast("الإجابة مفتوحة")
    return
  }

  const teamName =
    activeTeam === "A"
      ? presenterTeamAName
      : presenterTeamBName

  presenterTop10OpenedBy[`${round}_${number}`] = activeTeam
  savePresenterTop10OpenedBy()

  const btn = event?.currentTarget

  if (btn) {
    btn.classList.add("opened", "top10RevealFx")
    btn.disabled = true

    const openedByBox = btn.querySelector(".presenterTop10OpenedBy")

    if (openedByBox) {
      openedByBox.innerText = teamName
    }

    setTimeout(() => {
      btn.classList.remove("top10RevealFx")
    }, 350)
  }

  sendCommand("openNumber", {
    number: Number(number),
    round,
    team: activeTeam
  })
}
/* =========================
   AUCTION / فتبلة
========================= */

let presenterAuctionRows = []

function getPresenterAuctionRoot() {
  return presenterLiveState?.auction || {}
}

function getPresenterAuctionState() {
  const root = getPresenterAuctionRoot()

  return root?.auctionState || {
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
  return Number(root?.auctionMaxNumber || 8)
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
  const state = getPresenterAuctionState()
  return Number(state?.currentQuestionNumber || 0)
}

function getPresenterAuctionUsedNumbers() {
  const state = getPresenterAuctionState()
  return (state?.usedNumbers || []).map(Number)
}

function isPresenterAuctionPendingScore() {
  const state = getPresenterAuctionState()
  return !!state?.pendingScore
}

function isPresenterAuctionVideo(url = "") {
  const cleanUrl = String(url || "").split("?")[0].toLowerCase()

  return (
    cleanUrl.endsWith(".mp4") ||
    cleanUrl.endsWith(".webm") ||
    cleanUrl.endsWith(".mov") ||
    cleanUrl.endsWith(".m4v")
  )
}

function getPresenterAuctionRow(number) {
  return presenterAuctionRows.find(row => {
    return Number(row.number) === Number(number)
  })
}

function getPresenterAuctionCurrentAnswer() {
  const root = getPresenterAuctionRoot()
  const currentNumber = getPresenterAuctionCurrentNumber()
  const row = getPresenterAuctionRow(currentNumber)

  return (
    root?.currentAuctionAnswer ||
    root?.answer ||
    row?.answer ||
    ""
  )
}

function getPresenterAuctionCurrentImage() {
  const root = getPresenterAuctionRoot()
  const currentNumber = getPresenterAuctionCurrentNumber()
  const row = getPresenterAuctionRow(currentNumber)

  return (
    root?.currentAuctionImage ||
    root?.image ||
    row?.image ||
    ""
  )
}

function getPresenterAuctionCurrentVideo() {
  const root = getPresenterAuctionRoot()
  const currentNumber = getPresenterAuctionCurrentNumber()
  const row = getPresenterAuctionRow(currentNumber)

  return (
    root?.currentAuctionVideo ||
    root?.video ||
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

async function loadPresenterAuctionRows() {
  const { data } = await db
    .from("auction_questions")
    .select("number, answer, image, video")
    .eq("model", presenterModel)
    .order("number", { ascending: true })

  presenterAuctionRows = data || []
}

async function renderAuction() {
  const panel = document.getElementById("presenterPanel")
  if (!panel) return

  await loadPresenterAuctionRows()

  const maxNumber = getPresenterAuctionMaxNumber()
  const used = getPresenterAuctionUsedNumbers()
  const currentNumber = getPresenterAuctionCurrentNumber()
  const pendingScore = isPresenterAuctionPendingScore()

  panel.innerHTML = `
    <div class="presenterAuctionLayout">

      <div class="presenterAuctionLeft">

        <section class="presenterCard presenterAuctionNumbersCard">
          <div class="presenterLabel">الأرقام</div>

          <div class="presenterGrid four presenterAuctionGrid" id="presenterAuctionGrid">
            ${Array.from({ length: maxNumber }, (_, i) => i + 1).map(number => {
              const isUsed = used.includes(Number(number))
              const isCurrent = currentNumber === Number(number)

              return `
                <button
                  type="button"
                  class="presenterNumberBtn ${isUsed ? "presenterOpened" : ""} ${isCurrent ? "selectedPresenterTeam" : ""}"
                  ${isUsed || pendingScore ? "disabled" : ""}
                  onclick="openAuctionPresenterNumber(${number}, event)"
                >
                  ${isUsed ? "" : number}
                </button>
              `
            }).join("")}
          </div>
        </section>

        <div class="presenterAuctionActions">
          <button
            type="button"
            class="presenterBtn gray presenterAuctionDoubleBtn"
            onclick="sendCommand('double')"
            ${currentNumber || pendingScore ? "disabled" : ""}
          >
            دوبيلا
          </button>

          <button
            type="button"
            class="presenterBtn green"
            onclick="sendCommand('correct')"
          >
            ✓ صحيحة
          </button>

          <button
            type="button"
            class="presenterBtn red"
            onclick="sendCommand('wrong')"
          >
            ✕ خطأ
          </button>

          <button
            type="button"
            id="presenterAuctionMediaActionBtn"
            class="presenterBtn blue"
            onclick="runPresenterAuctionMediaAction()"
            disabled
          >
            تكبير
          </button>

          <button
            type="button"
            class="presenterBtn gray"
            onclick="sendCommand('undo')"
          >
            تراجع
          </button>
        </div>

      </div>

      <div class="presenterAuctionRight">

        <div class="presenterAuctionTeamsBox">
          ${teamButtons()}
        </div>

        <section class="presenterCard presenterAuctionPreviewCard">
          <div class="presenterLabel">الإجابة</div>

          <div id="presenterAuctionAnswerText" class="presenterAnswerBody">
            —
          </div>

          <div id="presenterAuctionImageBox" class="presenterImagePreviewBox hidden"></div>
        </section>

      </div>

    </div>
  `

  refreshPresenterAuctionFromState()
}

function openAuctionPresenterNumber(number, event) {
  number = Number(number || 0)

  const used = getPresenterAuctionUsedNumbers()
  const pendingScore = isPresenterAuctionPendingScore()
  const activeTeam = getPresenterAuctionActiveTeam()

  if (!activeTeam) {
    showToast("اختر الفريق أولاً")
    return
  }

  if (pendingScore) {
    showToast("أنهِ الدور الحالي أولاً")
    return
  }

  if (used.includes(number)) {
    showToast("الرقم مستخدم")
    return
  }

  const btn = event?.currentTarget

  if (btn) {
    btn.disabled = true
    btn.classList.add("selectedPresenterTeam")
  }

  showPresenterAuctionPreview(number)

  sendCommand("openNumber", {
    number,
    team: activeTeam
  })
}

function renderPresenterAuctionMedia(box, mediaUrl) {
  if (!box) return

  const safeUrl = String(mediaUrl || "")

  if (!safeUrl || isPresenterAuctionVideo(safeUrl)) {
    box.classList.add("hidden")
    box.innerHTML = ""
    return
  }

  box.classList.remove("hidden")
  box.innerHTML = `
    <img src="${safeUrl}" alt="">
  `
}

function showPresenterAuctionPreview(number) {
  const row = getPresenterAuctionRow(number)

  const answerBox = document.getElementById("presenterAuctionAnswerText")
  const imageBox = document.getElementById("presenterAuctionImageBox")

  if (answerBox) {
    answerBox.innerText = row?.answer || "لا توجد إجابة"
  }

  if (imageBox) {
    const image = row?.image || ""

    if (image) {
      renderPresenterAuctionMedia(imageBox, image)
    } else {
      imageBox.classList.add("hidden")
      imageBox.innerHTML = ""
    }
  }

  updatePresenterAuctionMediaActionButton()
}

function updatePresenterAuctionMediaActionButton() {
  const btn = document.getElementById("presenterAuctionMediaActionBtn")
  if (!btn) return

  const currentNumber = getPresenterAuctionCurrentNumber()
  const mediaType = getPresenterAuctionCurrentMediaType()

  if (!currentNumber || !mediaType) {
    btn.disabled = true
    btn.innerText = "تكبير"
    return
  }

  btn.disabled = false

  if (mediaType === "video") {
    btn.innerText = "▶ تشغيل الفيديو"
    return
  }

  btn.innerText = "تكبير"
}

async function runPresenterAuctionMediaAction() {
  const mediaType = getPresenterAuctionCurrentMediaType()

  if (mediaType === "video") {
    const zoomSent = await sendCommand("zoomImage")

    if (!zoomSent) return

    setTimeout(() => {
      sendCommand("playAuctionVideo")
    }, 220)

    return
  }

  if (mediaType === "image") {
    sendCommand("zoomImage")
    return
  }

  showToast("لا توجد صورة أو فيديو")
}

function refreshPresenterAuctionFromState() {
  if (presenterSegment !== "auction") return

  const maxNumber = getPresenterAuctionMaxNumber()
  const used = getPresenterAuctionUsedNumbers()
  const currentNumber = getPresenterAuctionCurrentNumber()
  const pendingScore = isPresenterAuctionPendingScore()
  const activeTeam = getPresenterAuctionActiveTeam()

  updatePresenterTeamButtonsOnly(activeTeam)

  const grid = document.getElementById("presenterAuctionGrid")

  if (grid) {
    grid.innerHTML = Array.from({ length: maxNumber }, (_, i) => i + 1).map(number => {
      const isUsed = used.includes(Number(number))
      const isCurrent = currentNumber === Number(number)

      return `
        <button
          type="button"
          class="presenterNumberBtn ${isUsed ? "presenterOpened" : ""} ${isCurrent ? "selectedPresenterTeam" : ""}"
          ${isUsed || pendingScore ? "disabled" : ""}
          onclick="openAuctionPresenterNumber(${number}, event)"
        >
          ${isUsed ? "" : number}
        </button>
      `
    }).join("")
  }

  const answerBox = document.getElementById("presenterAuctionAnswerText")
  const imageBox = document.getElementById("presenterAuctionImageBox")

  if (currentNumber) {
    const answer = getPresenterAuctionCurrentAnswer()
    const image = getPresenterAuctionCurrentImage()

    if (answerBox) {
      answerBox.innerText = answer || "لا توجد إجابة"
    }

    if (imageBox) {
      if (image) {
        renderPresenterAuctionMedia(imageBox, image)
      } else {
        imageBox.classList.add("hidden")
        imageBox.innerHTML = ""
      }
    }
  } else {
    if (answerBox) {
      answerBox.innerText = "—"
    }

    if (imageBox) {
      imageBox.classList.add("hidden")
      imageBox.innerHTML = ""
    }
  }

  const doubleBtn = document.querySelector(".presenterAuctionActions .presenterAuctionDoubleBtn")

  if (doubleBtn) {
    doubleBtn.disabled = !!currentNumber || !!pendingScore
  }

  updatePresenterAuctionMediaActionButton()
}
/* =========================
   WHO / من هو
========================= */

let presenterWhoRows = []
let presenterWhoScoreLocked = false
let presenterWhoLastScoreKey = ""

function getPresenterWhoRoot() {
  return presenterLiveState?.who || {}
}

function getPresenterWhoState() {
  const root = getPresenterWhoRoot()

  return root?.whoState || {
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
  return !!root?.whoQuestionLocked
}

function getPresenterWhoCurrentNumber() {
  const root = getPresenterWhoRoot()
  return Number(root?.whoCurrentNumber || 0)
}

function getPresenterWhoCompensationMode() {
  const root = getPresenterWhoRoot()
  return !!root?.whoCompensationMode
}

function getPresenterWhoActiveTeam() {
  const root = getPresenterWhoRoot()
  const who = getPresenterWhoState()

  return (
    who?.activeTeam ||
    root?.activeTeam ||
    presenterSelectedTeam ||
    null
  )
}

function getPresenterWhoCurrentPoints() {
  const who = getPresenterWhoState()
  return Number(who?.currentPoints || 0)
}

function getPresenterWhoUsedNumbers() {
  const who = getPresenterWhoState()
  return (who?.usedNumbers || []).map(Number)
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

function canPresenterWhoCompensation() {
  const used = getPresenterWhoUsedNumbers()
  const remaining = []

  for (let i = 1; i <= 15; i++) {
    if (!used.includes(i)) {
      remaining.push(i)
    }
  }

  return (
    !getPresenterWhoLocked() &&
    !getPresenterWhoCurrentNumber() &&
    remaining.length === 1 &&
    remaining[0] === 15
  )
}

function setPresenterWhoScoreButtonsDisabled(disabled) {
  const correctBtn = document.getElementById("presenterWhoCorrectBtn")
  const wrongBtn = document.getElementById("presenterWhoWrongBtn")

  if (correctBtn) correctBtn.disabled = !!disabled
  if (wrongBtn) wrongBtn.disabled = !!disabled
}

function resetPresenterWhoScoreGuard() {
  presenterWhoScoreLocked = false
  presenterWhoLastScoreKey = ""
  setPresenterWhoScoreButtonsDisabled(false)
}

async function loadPresenterWhoRows() {
  const { data } = await db
    .from("who_images")
    .select("number, answer, image, video")
    .eq("model", presenterModel)
    .order("number", { ascending: true })

  presenterWhoRows = data || []
}

async function renderWho() {
  const panel = document.getElementById("presenterPanel")
  if (!panel) return

  await loadPresenterWhoRows()

  const used = getPresenterWhoUsedNumbers()
  const currentNumber = getPresenterWhoCurrentNumber()
  const locked = getPresenterWhoLocked()
  const currentPoints = getPresenterWhoCurrentPoints()
  const compensationMode = getPresenterWhoCompensationMode()

  const lock15 = !used.includes(15) && used.length < 14
  const waitCompensation =
    !used.includes(15) &&
    used.length === 14 &&
    !compensationMode

  panel.innerHTML = `
    <div class="presenterWhoLayout">

      <div class="presenterWhoLeft">

        <section class="presenterCard presenterWhoNumbersCard">
          <div class="presenterLabel">النقاط</div>

          <div class="presenterWhoPointsGrid">
            ${[1, 2, 3, 4, 5].map(points => {
              const selected = currentPoints === points

              return `
                <button
                  type="button"
                  class="presenterNumberBtn presenterWhoPointBtn ${selected ? "selectedPresenterTeam activeWhoPoint" : ""}"
                  data-points="${points}"
                  ${locked || compensationMode ? "disabled" : ""}
                  onclick="selectPresenterWhoPoints(${points})"
                >
                  ${points}
                </button>
              `
            }).join("")}
          </div>

          <div class="presenterLabel presenterWhoNumbersLabel">الأرقام</div>

          <div class="presenterWhoGrid">
            ${Array.from({ length: 15 }, (_, i) => i + 1).map(number => {
              const isUsed = used.includes(number)
              const isCurrent = currentNumber === number
              const isLocked15 = number === 15 && (lock15 || waitCompensation)

              return `
                <button
                  type="button"
                  class="presenterNumberBtn ${isUsed ? "presenterOpened" : ""} ${isCurrent ? "selectedPresenterTeam" : ""}"
                  ${isUsed || locked || isLocked15 ? "disabled" : ""}
                  onclick="openWhoPresenterNumber(${number}, event)"
                >
                  ${isUsed ? "" : number}
                </button>
              `
            }).join("")}
          </div>
        </section>

        <div class="presenterWhoActions">
          <button
            type="button"
            class="presenterBtn gray presenterWhoDoubleBtn"
            onclick="sendCommand('double')"
            ${locked || currentNumber ? "disabled" : ""}
          >
            دوبيلا
          </button>

          <button
            type="button"
            class="presenterBtn gray presenterWhoCompensationBtn"
            onclick="sendCommand('compensation')"
            ${canPresenterWhoCompensation() ? "" : "disabled"}
          >
            التعويض
          </button>

          <button
            type="button"
            id="presenterWhoCorrectBtn"
            class="presenterBtn green"
            onclick="sendPresenterWhoScore('correct')"
            ${!currentNumber ? "disabled" : ""}
          >
            ✓ صح
          </button>

          <button
            type="button"
            id="presenterWhoWrongBtn"
            class="presenterBtn red"
            onclick="sendPresenterWhoScore('wrong')"
            ${!currentNumber ? "disabled" : ""}
          >
            ✕ خطأ
          </button>
        </div>

      </div>

      <div class="presenterWhoRight">

        <div class="presenterWhoTeamsBox">
          ${teamButtons()}
        </div>

        <section class="presenterCard presenterWhoPreviewCard">
          <div class="presenterLabel">الإجابة</div>

          <div id="presenterWhoAnswerText" class="presenterAnswerBody">
            —
          </div>

          <div class="presenterLabel">الصورة</div>

          <div id="presenterWhoImageBox" class="presenterImagePreviewBox hidden"></div>
        </section>

      </div>

    </div>
  `

  refreshPresenterWhoFromState()
}

function selectPresenterWhoPoints(points) {
  points = Number(points || 0)

  if (getPresenterWhoLocked()) {
    showToast("سجل النتيجة أولاً")
    return
  }

  if (getPresenterWhoCompensationMode()) {
    showToast("التعويض لا يحتاج اختيار نقاط")
    return
  }

  document.querySelectorAll(".presenterWhoPointBtn").forEach(btn => {
    const selected = Number(btn.dataset.points) === points

    btn.classList.toggle("selectedPresenterTeam", selected)
    btn.classList.toggle("activeWhoPoint", selected)
  })

  sendCommand("setPoints", {
    points
  })
}

function openWhoPresenterNumber(number, event) {
  number = Number(number || 0)

  const used = getPresenterWhoUsedNumbers()
  const locked = getPresenterWhoLocked()
  const activeTeam = getPresenterWhoActiveTeam()
  const currentPoints = getPresenterWhoCurrentPoints()
  const compensationMode = getPresenterWhoCompensationMode()

  if (locked) {
    showToast("سجل النتيجة أولاً")
    return
  }

  if (used.includes(number)) {
    showToast("الرقم مستخدم")
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

  const btn = event?.currentTarget

  if (btn) {
    btn.disabled = true
    btn.classList.add("selectedPresenterTeam")
  }

  showPresenterWhoPreview(number)

  sendCommand("openNumber", {
    number,
    team: activeTeam,
    points: currentPoints
  })
}

function showPresenterWhoPreview(number) {
  const item = getPresenterWhoRow(number)

  const answerBox = document.getElementById("presenterWhoAnswerText")
  const imageBox = document.getElementById("presenterWhoImageBox")

  if (answerBox) {
    answerBox.innerText = item?.answer || "لا توجد إجابة"
  }

  if (imageBox) {
    if (item?.image) {
      imageBox.classList.remove("hidden")
      imageBox.innerHTML = `<img src="${item.image}" alt="">`
    } else {
      imageBox.classList.add("hidden")
      imageBox.innerHTML = ""
    }
  }
}

function sendPresenterWhoScore(action) {
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

  if (presenterWhoScoreLocked || presenterWhoLastScoreKey === scoreKey) {
    return
  }

  presenterWhoScoreLocked = true
  presenterWhoLastScoreKey = scoreKey
  setPresenterWhoScoreButtonsDisabled(true)

  sendCommand(action, {
    __who_score_key: scoreKey,
    number,
    team,
    points
  })

  setTimeout(() => {
    const currentKey = getPresenterWhoScoreKey()

    if (currentKey !== scoreKey || !getPresenterWhoCurrentNumber()) {
      resetPresenterWhoScoreGuard()
    }
  }, 2500)
}

function refreshPresenterWhoFromState() {
  if (presenterSegment !== "who") return

  const root = getPresenterWhoRoot()
  const used = getPresenterWhoUsedNumbers()
  const currentNumber = getPresenterWhoCurrentNumber()
  const locked = getPresenterWhoLocked()
  const currentPoints = getPresenterWhoCurrentPoints()
  const compensationMode = getPresenterWhoCompensationMode()
  const activeTeam = getPresenterWhoActiveTeam()

  updatePresenterTeamButtonsOnly(activeTeam)

  document.querySelectorAll(".presenterWhoPointBtn").forEach(btn => {
    const points = Number(btn.dataset.points || 0)
    const selected = currentPoints === points

    btn.classList.toggle("selectedPresenterTeam", selected)
    btn.classList.toggle("activeWhoPoint", selected)
    btn.disabled = !!locked || !!compensationMode
  })

  document.querySelectorAll(".presenterWhoGrid .presenterNumberBtn").forEach(btn => {
    const onclick = btn.getAttribute("onclick") || ""
    const match = onclick.match(/openWhoPresenterNumber\((\d+)/)

    if (!match) return

    const number = Number(match[1])
    const isUsed = used.includes(number)
    const isCurrent = currentNumber === number

    const lock15 = !used.includes(15) && used.length < 14
    const waitCompensation =
      !used.includes(15) &&
      used.length === 14 &&
      !compensationMode

    const isLocked15 = number === 15 && (lock15 || waitCompensation)

    btn.classList.remove("presenterOpened", "selectedPresenterTeam")

    if (isUsed) {
      btn.classList.add("presenterOpened")
      btn.disabled = true
      btn.innerText = ""
    } else {
      btn.innerText = String(number)
      btn.disabled = !!locked || !!isLocked15
    }

    if (isCurrent) {
      btn.classList.add("selectedPresenterTeam")
      btn.disabled = true
    }
  })

  const answerBox = document.getElementById("presenterWhoAnswerText")
  const imageBox = document.getElementById("presenterWhoImageBox")

  const answer =
    root?.currentWhoAnswer ||
    root?.answer ||
    ""

  const image =
    root?.currentWhoImage ||
    root?.image ||
    ""

  if (currentNumber) {
    if (answerBox) {
      answerBox.innerText = answer || "لا توجد إجابة"
    }

    if (imageBox) {
      if (image) {
        imageBox.classList.remove("hidden")
        imageBox.innerHTML = `<img src="${image}" alt="">`
      } else {
        imageBox.classList.add("hidden")
        imageBox.innerHTML = ""
      }
    }
  } else {
    if (answerBox) {
      answerBox.innerText = "—"
    }

    if (imageBox) {
      imageBox.classList.add("hidden")
      imageBox.innerHTML = ""
    }
  }

  const doubleBtn = document.querySelector(".presenterWhoActions .presenterWhoDoubleBtn")
  const compensationBtn = document.querySelector(".presenterWhoActions .presenterWhoCompensationBtn")

  if (doubleBtn) {
    doubleBtn.disabled = !!locked || !!currentNumber
  }

  if (compensationBtn) {
    compensationBtn.disabled = !canPresenterWhoCompensation()
  }

  const currentScoreKey = getPresenterWhoScoreKey()

  if (!currentNumber || currentScoreKey !== presenterWhoLastScoreKey) {
    presenterWhoScoreLocked = false
    presenterWhoLastScoreKey = ""
  }

  setPresenterWhoScoreButtonsDisabled(
    presenterWhoScoreLocked || !currentNumber
  )
}

/* =========================
   EXPLAIN WORD / اشرح الكلمة
========================= */

function getPresenterExplainRoot() {
  return presenterLiveState?.explain || {}
}

function getPresenterExplainState() {
  const root = getPresenterExplainRoot()

  return root?.explainState || {
    wordsCount: 4,
    words: [],
    usedNumbers: [],
    currentNumber: null,
    currentWord: "",
    currentTeam: null,
    wordVisible: true,
    timerVisible: false,
    timeLeft: 45,
    revealLock: false,
    answerResult: null,
    scores: { A: 0, B: 0 },
    attempts: { A: 0, B: 0 }
  }
}

function getPresenterExplainWordsCount() {
  const explain = getPresenterExplainState()
  return Number(explain?.wordsCount || 4) === 6 ? 6 : 4
}

function getPresenterExplainUsedNumbers() {
  const explain = getPresenterExplainState()
  return (explain?.usedNumbers || []).map(Number)
}

function getPresenterExplainCurrentNumber() {
  const explain = getPresenterExplainState()
  return Number(explain?.currentNumber || 0)
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
  const explain = getPresenterExplainState()
  return !!explain?.revealLock
}

function getPresenterExplainCurrentWord() {
  const explain = getPresenterExplainState()
  const currentNumber = getPresenterExplainCurrentNumber()

  if (explain?.currentWord) {
    return explain.currentWord
  }

  const item = (explain?.words || []).find(row => {
    return Number(row.number) === Number(currentNumber)
  })

  return item?.word || ""
}

function getPresenterExplainWordByNumber(number) {
  const explain = getPresenterExplainState()

  const item = (explain?.words || []).find(row => {
    return Number(row.number) === Number(number)
  })

  return item?.word || ""
}

async function renderExplain() {
  const panel = document.getElementById("presenterPanel")
  if (!panel) return

  const explain = getPresenterExplainState()
  const count = getPresenterExplainWordsCount()
  const used = getPresenterExplainUsedNumbers()
  const currentNumber = getPresenterExplainCurrentNumber()
  const revealLock = getPresenterExplainRevealLock()

  panel.innerHTML = `
    <div class="presenterExplainLayout">

      <div class="presenterExplainLeft">

        <section class="presenterCard presenterExplainNumbersCard">
          <div class="presenterLabel">الأرقام</div>

          <div
            class="presenterExplainNumbersGrid"
            id="presenterExplainNumbersGrid"
            style="grid-template-columns:repeat(${count}, minmax(0,1fr));"
          >
            ${Array.from({ length: count }, (_, i) => i + 1).map(number => {
              const isUsed = used.includes(Number(number))
              const isCurrent = currentNumber === Number(number)
              const disabled = isUsed || !!currentNumber || revealLock

              return `
                <button
                  type="button"
                  class="presenterNumberBtn presenterExplainNumberCard ${isUsed ? "used presenterOpened" : ""} ${isCurrent ? "active selectedPresenterTeam" : ""}"
                  ${disabled ? "disabled" : ""}
                  onclick="openExplainPresenterNumber(${number}, event)"
                >
                  <span>${number}</span>
                </button>
              `
            }).join("")}
          </div>
        </section>

        <div class="presenterExplainActions">
          <button
            type="button"
            class="presenterBtn dark presenterExplainStartTimerBtn"
            onclick="sendCommand('startTimer')"
            ${!currentNumber || revealLock ? "disabled" : ""}
          >
            بدء المؤقت
          </button>

          <button
            type="button"
            class="presenterBtn blue presenterExplainToggleWordBtn"
            onclick="sendCommand('toggleWordVisible')"
            ${!currentNumber || revealLock ? "disabled" : ""}
          >
            إخفاء الكلمة
          </button>

          <button
            type="button"
            class="presenterBtn green presenterExplainCorrectBtn"
            onclick="sendCommand('correct')"
            ${!currentNumber || revealLock ? "disabled" : ""}
          >
            صح
          </button>

          <button
            type="button"
            class="presenterBtn red presenterExplainWrongBtn"
            onclick="sendCommand('wrong')"
            ${!currentNumber || revealLock ? "disabled" : ""}
          >
            خطأ
          </button>
        </div>

      </div>

      <div class="presenterExplainRight">

        <div class="presenterExplainTeamsBox">
          ${teamButtons()}
        </div>

        <section class="presenterCard presenterExplainWordCard">
          <div class="presenterLabel">الكلمة</div>

          <div
            id="presenterExplainWordText"
            class="presenterExplainWordBox ${explain.answerResult === "correct" ? "answerCorrect" : ""} ${explain.answerResult === "wrong" ? "answerWrong" : ""}"
          >
            ${
              currentNumber
                ? getPresenterExplainCurrentWord() || getPresenterExplainWordByNumber(currentNumber) || "—"
                : "—"
            }
          </div>
        </section>

        <section class="presenterCard presenterExplainTimerCard">
          <div class="presenterLabel">المؤقت</div>

          <div
            id="presenterExplainTimerText"
            class="presenterExplainTimerBox ${explain.timerVisible ? "" : "hidden"} ${explain.timerVisible && Number(explain.timeLeft || 45) <= 5 ? "danger presenterTimerDanger" : ""}"
          >
            ${explain.timerVisible ? Number(explain.timeLeft || 45) : "—"}
          </div>
        </section>

      </div>

    </div>
  `

  refreshPresenterExplainFromState()
}

function openExplainPresenterNumber(number, event) {
  number = Number(number || 0)

  const used = getPresenterExplainUsedNumbers()
  const currentNumber = getPresenterExplainCurrentNumber()
  const activeTeam = getPresenterExplainActiveTeam()
  const revealLock = getPresenterExplainRevealLock()

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

  if (used.includes(number)) {
    showToast("الرقم مستخدم")
    return
  }

  const btn = event?.currentTarget

  if (btn) {
    btn.disabled = true
    btn.classList.add("selectedPresenterTeam")
  }

  const wordBox = document.getElementById("presenterExplainWordText")
  const word = getPresenterExplainWordByNumber(number)

  if (wordBox) {
    wordBox.innerText = word || "—"
  }

  sendCommand("openNumber", {
    number,
    team: activeTeam
  })
}

function refreshPresenterExplainFromState() {
  if (presenterSegment !== "explain") return

  const explain = getPresenterExplainState()
  const count = getPresenterExplainWordsCount()
  const used = getPresenterExplainUsedNumbers()
  const currentNumber = getPresenterExplainCurrentNumber()
  const activeTeam = getPresenterExplainActiveTeam()
  const revealLock = getPresenterExplainRevealLock()

  updatePresenterTeamButtonsOnly(activeTeam)

  const wordBox = document.getElementById("presenterExplainWordText")
  const timerBox = document.getElementById("presenterExplainTimerText")
  const grid = document.getElementById("presenterExplainNumbersGrid")

  if (wordBox) {
    wordBox.classList.toggle("answerCorrect", explain.answerResult === "correct")
    wordBox.classList.toggle("answerWrong", explain.answerResult === "wrong")

    if (!currentNumber) {
      wordBox.innerText = "—"
    } else {
      wordBox.innerText =
        getPresenterExplainCurrentWord() ||
        getPresenterExplainWordByNumber(currentNumber) ||
        "—"
    }
  }

  if (timerBox) {
    if (explain.timerVisible) {
      timerBox.innerText = Number(explain.timeLeft || 45)
    } else {
      timerBox.innerText = "—"
    }

    timerBox.classList.toggle("hidden", !explain.timerVisible)
    timerBox.classList.toggle(
      "danger",
      explain.timerVisible && Number(explain.timeLeft || 45) <= 5
    )
    timerBox.classList.toggle(
      "presenterTimerDanger",
      explain.timerVisible && Number(explain.timeLeft || 45) <= 5
    )
  }

  if (grid) {
    grid.style.gridTemplateColumns = `repeat(${count}, minmax(0,1fr))`

    grid.innerHTML = Array.from({ length: count }, (_, i) => i + 1).map(number => {
      const isUsed = used.includes(Number(number))
      const isCurrent = currentNumber === Number(number)
      const disabled = isUsed || !!currentNumber || revealLock

      return `
        <button
          type="button"
          class="presenterNumberBtn presenterExplainNumberCard ${isUsed ? "used presenterOpened" : ""} ${isCurrent ? "active selectedPresenterTeam" : ""}"
          ${disabled ? "disabled" : ""}
          onclick="openExplainPresenterNumber(${number}, event)"
        >
          <span>${isUsed ? "" : number}</span>
        </button>
      `
    }).join("")
  }

  document.querySelectorAll(".presenterExplainActions .presenterBtn").forEach(btn => {
    btn.disabled = !currentNumber || revealLock
  })
}

/* =========================
   RANDOM CHALLENGE / التحدي
========================= */

let presenterRandomAuctionLocalPoints = 0
let presenterRandomLastUiMode = ""

function getPresenterRandomChallengeRoot() {
  return presenterLiveState?.randomChallenge || {}
}

function getPresenterRandomChallengeState() {
  return presenterLiveState?.randomChallenge || {
    scores: { A: 0, B: 0 },
    activeTeam: null,
    currentBox: null,
    completed: false,

    box1: {
      active: false,
      started: false,
      rolling: false,
      finished: false,
      pool: "",
      images: []
    },

    box2: {
      active: false,
      finished: false,
      numberInput: "",
      points: 0,
      calculatedPoints: 0,
      timer: 30,
      timerRunning: false
    },

    box3: {
      active: false,
      finished: false,
      activeTeam: null,
      errors: { A: 0, B: 0 },
      passUsed: { A: false, B: false },
      choosingPoints: false,
      timer: 5
    },

    box4: {
      active: false,
      finished: false
    }
  }
}

function getPresenterRandomCurrentBox() {
  const state = getPresenterRandomChallengeState()
  return Number(state?.currentBox || 0)
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
  const n = Number(box || 0)

  if (n === 1) return "اللاعب المشترك"
  if (n === 2) return "المزاد"
  if (n === 3) return "ماذا تعرف"
  if (n === 4) return "قريبًا"

  return "اختر مربع"
}

function getPresenterRandomUiMode() {
  const state = getPresenterRandomChallengeState()
  const box = Number(state?.currentBox || 0)

  if (!box) return "select"
  if (box === 2) return "auction"

  if (box === 3 && state.box3?.choosingPoints) {
    return "box3Score"
  }

  if (box === 3) return "box3Play"

  return `box${box}`
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

function getPresenterRandomBox1Players(state = getPresenterRandomChallengeState()) {
  const box1 = state?.box1 || {}

  if (Array.isArray(box1.images) && box1.images.length) {
    return box1.images
  }

  if (Array.isArray(box1.players) && box1.players.length) {
    return box1.players
  }

  if (Array.isArray(box1.currentPlayers) && box1.currentPlayers.length) {
    return box1.currentPlayers
  }

  if (Array.isArray(box1.selectedImages) && box1.selectedImages.length) {
    return box1.selectedImages
  }

  return [
    box1.currentPlayer || box1.currentName || "",
    box1.secondPlayer || box1.secondName || ""
  ]
}

/* فتح المربعات محليًا فورًا + إرسال للعرض */
function openPresenterRandomBox(box) {
  const n = Number(box || 0)
  if (!n) return

  const oldRandom = presenterLiveState?.randomChallenge || {}

  presenterLiveState = {
    ...(presenterLiveState || {}),
    randomChallenge: {
      ...oldRandom,
      currentBox: n,
      activeTeam: null,

      box1: {
        ...(oldRandom.box1 || {}),
        active: n === 1,
        started: n === 1 ? false : !!oldRandom.box1?.started,
        rolling: n === 1 ? false : !!oldRandom.box1?.rolling,
        flashing: n === 1 ? false : !!oldRandom.box1?.flashing,
        images: n === 1 ? [] : (oldRandom.box1?.images || [])
      },

      box2: {
        ...(oldRandom.box2 || {}),
        active: n === 2
      },

      box3: {
        ...(oldRandom.box3 || {}),
        active: n === 3,
        activeTeam: null
      },

      box4: {
        ...(oldRandom.box4 || {}),
        active: n === 4
      }
    }
  }

  presenterSelectedTeam = null

  if (n === 2) {
    presenterRandomAuctionLocalPoints = Number(
      presenterLiveState?.randomChallenge?.box2?.points ||
      presenterLiveState?.randomChallenge?.box2?.numberInput ||
      0
    )
  } else {
    presenterRandomAuctionLocalPoints = 0
  }

  markPresenterLocalSync("randomChallenge", 1400)
  renderPresenterRandomChallenge()

  sendCommand("randomOpenBox", {
    box: n
  })
}

/* بدء اللاعب المشترك محليًا فورًا */
function startPresenterRandomBox1(pool) {
  const cleanPool = pool === "world" ? "world" : "saudi"
  const oldRandom = presenterLiveState?.randomChallenge || {}

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

  markPresenterLocalSync("randomChallenge", 1200)

  renderPresenterRandomChallenge()

  sendCommand("randomStartBox1", {
    pool: cleanPool
  })
}

function setPresenterRandomAuctionPoints(value, shouldSync = true) {
  const input = document.getElementById("presenterRandomAuctionInput")
  const pointsBox = document.getElementById("presenterRandomAuctionPoints")

  const clean = Math.max(
    0,
    Number(String(value || "").replace(/\D/g, "") || 0)
  )

  presenterRandomAuctionLocalPoints = clean

  if (input) input.value = clean || ""
  if (pointsBox) pointsBox.innerText = clean

  if (shouldSync) {
    sendCommand("randomSetAuctionPoints", {
      points: clean
    })
  }
}

function decreasePresenterRandomAuctionPoints() {
  const current = Number(presenterRandomAuctionLocalPoints || 0)
  const next = Math.max(0, current - 1)

  setPresenterRandomAuctionPoints(next, true)
}

function sendPresenterRandomAuctionScore(type) {
  const points = Number(presenterRandomAuctionLocalPoints || 0)

  sendCommand(type, {
    points,
    presenterOnlyPoints: true
  })
}

function finishPresenterRandomBox3Round() {
  sendCommand("randomFinishRound")

  setTimeout(() => {
    presenterLiveState = {
      ...(presenterLiveState || {}),
      randomChallenge: {
        ...(presenterLiveState?.randomChallenge || {}),
        currentBox: 3,
        box3: {
          ...(presenterLiveState?.randomChallenge?.box3 || {}),
          choosingPoints: true
        }
      }
    }

    renderPresenterRandomChallenge()
  }, 180)
}

function renderPresenterRandomChallenge() {
  const panel = document.getElementById("presenterPanel")
  if (!panel) return

  const state = getPresenterRandomChallengeState()
  const currentBox = getPresenterRandomCurrentBox()
  const uiMode = getPresenterRandomUiMode()

  presenterRandomLastUiMode = uiMode

  const activeTeam = getPresenterRandomActiveTeam()

  const errorsA = Number(state.box3?.errors?.A || 0)
  const errorsB = Number(state.box3?.errors?.B || 0)

  const auctionCount = Number(
  presenterRandomAuctionLocalPoints ||
  state.box2?.points ||
  state.box2?.numberInput ||
  state.box2?.calculatedPoints ||
  0
)

  const box1Pool = state.box1?.pool || ""

  const box1Players = getPresenterRandomBox1Players(state)

const box1Started =
  !!state.box1?.currentPlayer ||
  !!state.box1?.started ||
  !!state.box1?.currentName ||
  box1Players.filter(Boolean).length > 0 ||
  !!state.box1?.rolling

const box1NameA = getPresenterRandomImageName(box1Players[0])
const box1NameB = getPresenterRandomImageName(box1Players[1])

  panel.innerHTML = `
    <div class="presenterRandomLayout" data-random-mode="${uiMode}">

      ${
        !currentBox
          ? `
            <section class="presenterCard presenterRandomChooseCard">

              <div class="presenterLabel">اختر نوع التحدي</div>

              <div class="presenterRandomChooseGrid">

                <button
                  type="button"
                  class="presenterRandomChooseBtn ${state.box1?.finished ? "presenterOpened" : ""}"
                  ${state.box1?.finished ? "disabled" : ""}
                  onclick="openPresenterRandomBox(1)"
                >
                  <span>1</span>
                  <strong>اللاعب المشترك</strong>
                </button>

                <button
                  type="button"
                  class="presenterRandomChooseBtn ${state.box2?.finished ? "presenterOpened" : ""}"
                  ${state.box2?.finished ? "disabled" : ""}
                  onclick="openPresenterRandomBox(2)"
                >
                  <span>2</span>
                  <strong>المزاد</strong>
                </button>

                <button
                  type="button"
                  class="presenterRandomChooseBtn ${state.box3?.finished ? "presenterOpened" : ""}"
                  ${state.box3?.finished ? "disabled" : ""}
                  onclick="openPresenterRandomBox(3)"
                >
                  <span>3</span>
                  <strong>ماذا تعرف</strong>
                </button>

                <button
                  type="button"
                  class="presenterRandomChooseBtn ${state.box4?.finished ? "presenterOpened" : ""}"
                  ${state.box4?.finished ? "disabled" : ""}
                  onclick="openPresenterRandomBox(4)"
                >
                  <span>4</span>
                  <strong>قريبًا</strong>
                </button>

              </div>

            </section>
          `
          : `
            <div class="presenterRandomPage">

              <div class="presenterRandomContent">

                ${
                  currentBox === 1 && !box1Started
                    ? `
                      <section class="presenterCard presenterRandomBoxCard">
                        <div class="presenterLabel">اللاعب المشترك</div>

                        <div class="presenterRandomChooseGrid presenterRandomPoolGrid">
                          <button
                            type="button"
                            class="presenterRandomChooseBtn ${box1Pool === "saudi" ? "active" : ""}"
                            onclick="startPresenterRandomBox1('saudi')"
                          >
                            <span>🇸🇦</span>
                            <strong>الدوري السعودي</strong>
                          </button>

                          <button
                            type="button"
                            class="presenterRandomChooseBtn ${box1Pool === "world" ? "active" : ""}"
                            onclick="startPresenterRandomBox1('world')"
                          >
                            <span>🌍</span>
                            <strong>عالمي</strong>
                          </button>
                        </div>
                      </section>
                    `
                    : ""
                }

                ${
                  currentBox === 1 && box1Started
                    ? `
                      <section class="presenterCard presenterRandomBoxCard">

                        <div class="presenterRandomPlayerNames">

                          <div class="presenterRandomPlayerNameCard">
                            <small>الاسم الأول</small>
                            <strong>${presenterSafeHtml(box1NameA || "—")}</strong>
                          </div>

                          <div class="presenterRandomVsText">VS</div>

                          <div class="presenterRandomPlayerNameCard">
                            <small>الاسم الثاني</small>
                            <strong>${presenterSafeHtml(box1NameB || "—")}</strong>
                          </div>

                        </div>

                        <div class="presenterRandomTeamsOnly miniTeams">
                          <div class="presenterRandomTeamName ${activeTeam === "A" ? "active" : ""}">
                            ${presenterTeamAName}
                          </div>

                          <div class="presenterRandomTeamName ${activeTeam === "B" ? "active" : ""}">
                            ${presenterTeamBName}
                          </div>
                        </div>

                      </section>
                    `
                    : ""
                }

                ${
                  currentBox === 2
                    ? `
                      <section class="presenterCard presenterRandomBoxCard presenterRandomAuctionCard">
                        <div class="presenterRandomTeamsOnly">
                          <div class="presenterRandomTeamName ${activeTeam === "A" ? "active" : ""}">
                            ${presenterTeamAName}
                          </div>

                          <div class="presenterRandomTeamName ${activeTeam === "B" ? "active" : ""}">
                            ${presenterTeamBName}
                          </div>
                        </div>

                        <div class="presenterRandomAuctionTool">
                          <input
                            id="presenterRandomAuctionInput"
                            class="presenterRandomAuctionInput"
                            type="tel"
                            inputmode="numeric"
                            placeholder="العدد"
                            value="${auctionCount || ""}"
                            oninput="setPresenterRandomAuctionPoints(this.value)"
                          >

                          <button
                            id="presenterRandomAuctionPoints"
                            type="button"
                            class="presenterRandomAuctionPoints"
                            onclick="decreasePresenterRandomAuctionPoints()"
                          >
                            ${auctionCount}
                          </button>
                        </div>
                      </section>
                    `
                    : ""
                }

                ${
                  currentBox === 3 && !state.box3?.choosingPoints
                    ? `
                      <section class="presenterCard presenterRandomBoxCard presenterRandomKnowCard">

                        <div
                          id="presenterRandomBox3Timer"
                          class="presenterRandomBox3Timer ${Number(state.box3?.timer || 5) <= 2 ? "danger presenterTimerDanger" : ""}"
                        >
                          ${Number(state.box3?.timer || 5)}
                        </div>

                        <div class="presenterRandomKnowBoard">
                          <div class="presenterRandomKnowTeam ${activeTeam === "A" ? "active" : ""}">
                            <span>${presenterTeamAName}</span>
                            <strong>${errorsA} / 3</strong>
                          </div>

                          <div class="presenterRandomKnowTeam ${activeTeam === "B" ? "active" : ""}">
                            <span>${presenterTeamBName}</span>
                            <strong>${errorsB} / 3</strong>
                          </div>
                        </div>
                      </section>
                    `
                    : ""
                }

                ${
                  currentBox === 3 && state.box3?.choosingPoints
                    ? `
                      <section class="presenterCard presenterRandomBoxCard">
                        <div class="presenterLabel">تسجيل النقاط</div>

                        <div class="presenterRandomScoreButtons">
                          <button type="button" class="presenterBtn green" onclick="sendCommand('randomBox3ScorePoints', { points: 1 })">1</button>
                          <button type="button" class="presenterBtn green" onclick="sendCommand('randomBox3ScorePoints', { points: 2 })">2</button>
                          <button type="button" class="presenterBtn green" onclick="sendCommand('randomBox3ScorePoints', { points: 3 })">3</button>
                        </div>
                      </section>
                    `
                    : ""
                }

                ${
                  currentBox === 4
                    ? `
                      <section class="presenterCard presenterRandomBoxCard">
                        <div class="presenterLabel">قريبًا</div>

                        <div class="presenterRandomSimpleText">
                          هذا المربع غير مفعّل حاليًا.
                        </div>
                      </section>
                    `
                    : ""
                }

              </div>

              ${
                currentBox === 1 || currentBox === 2 || currentBox === 3
                  ? `
                    <div class="presenterRandomSide">
                      <div class="presenterRandomTeamsBox">
                        ${teamButtons()}
                      </div>
                    </div>
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
                          <button type="button" class="presenterBtn gray" onclick="sendCommand('randomSkip')">
                            إعادة
                          </button>

                          <button type="button" class="presenterBtn green" onclick="sendCommand('correct')">
                            صح
                          </button>

                          <button type="button" class="presenterBtn red" onclick="sendCommand('wrong')">
                            خطأ
                          </button>
                        `
                        : ""
                    }

                    <button type="button" class="presenterBtn dark" onclick="sendCommand('randomFinishBox')">
                      إنهاء
                    </button>
                  `
                  : ""
              }

              ${
                currentBox === 2
                  ? `
                    <button type="button" class="presenterBtn dark" onclick="sendCommand('randomStartBox2Timer')">
                      بدء المؤقت
                    </button>

                    <button type="button" class="presenterBtn green" onclick="sendPresenterRandomAuctionScore('correct')">
                      صح
                    </button>

                    <button type="button" class="presenterBtn red" onclick="sendPresenterRandomAuctionScore('wrong')">
                      خطأ
                    </button>

                    <button type="button" class="presenterBtn gray" onclick="sendCommand('randomFinishBox')">
                      إنهاء
                    </button>
                  `
                  : ""
              }

              ${
                currentBox === 3 && !state.box3?.choosingPoints
                  ? `
                    <button type="button" class="presenterBtn red" onclick="sendCommand('randomBox3Wrong')">
                      خطأ
                    </button>

                    <button type="button" class="presenterBtn blue" onclick="sendCommand('randomBox3Pass')">
                      باس
                    </button>

                    <button type="button" class="presenterBtn gray" onclick="sendCommand('randomBox3SwitchTeam')">
                      تبديل
                    </button>

                    <button type="button" class="presenterBtn dark" onclick="finishPresenterRandomBox3Round()">
                      إنهاء الجولة
                    </button>
                  `
                  : ""
              }

              ${
                currentBox === 3 && state.box3?.choosingPoints
                  ? `
                    <button type="button" class="presenterBtn gray" onclick="sendCommand('randomFinishBox')">
                      إنهاء المربع
                    </button>
                  `
                  : ""
              }

              ${
                currentBox === 4
                  ? `
                    <button type="button" class="presenterBtn gray" onclick="sendCommand('randomFinishBox')">
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
}

function refreshPresenterRandomChallengeFromState() {
  if (presenterSegment !== "randomChallenge") return

  const state = getPresenterRandomChallengeState()
  const uiMode = getPresenterRandomUiMode()

  if (presenterRandomLastUiMode && presenterRandomLastUiMode !== uiMode) {
    renderPresenterRandomChallenge()
    return
  }

  const activeTeam = getPresenterRandomActiveTeam()
  updatePresenterTeamButtonsOnly(activeTeam)

  const currentBoxText = document.querySelector(".presenterRandomCurrentBox")
  const currentBox = getPresenterRandomCurrentBox()

  if (currentBoxText) {
    currentBoxText.innerText = currentBox
      ? getPresenterRandomBoxTitle(currentBox)
      : "اختر مربع"
  }

  document.querySelectorAll(".presenterRandomTeamName").forEach((box, index) => {
    const team = index === 0 ? "A" : "B"
    box.classList.toggle("active", activeTeam === team)
  })

const box1Players = getPresenterRandomBox1Players(state)
const playerNameCards = document.querySelectorAll(".presenterRandomPlayerNameCard strong")

if (playerNameCards?.[0]) {
  playerNameCards[0].innerText = getPresenterRandomImageName(box1Players[0]) || "—"
}

if (playerNameCards?.[1]) {
  playerNameCards[1].innerText = getPresenterRandomImageName(box1Players[1]) || "—"
}

  const errorsA = Number(state.box3?.errors?.A || 0)
  const errorsB = Number(state.box3?.errors?.B || 0)

  const knowTeams = document.querySelectorAll(".presenterRandomKnowTeam")

  if (knowTeams?.[0]) {
    knowTeams[0].classList.toggle("active", activeTeam === "A")

    const score = knowTeams[0].querySelector("strong")
    if (score) score.innerText = `${errorsA} / 3`
  }

  if (knowTeams?.[1]) {
    knowTeams[1].classList.toggle("active", activeTeam === "B")

    const score = knowTeams[1].querySelector("strong")
    if (score) score.innerText = `${errorsB} / 3`
  }

  const box3Timer = document.getElementById("presenterRandomBox3Timer")

  if (box3Timer) {
    const timer = Number(state.box3?.timer || 5)

    box3Timer.innerText = timer
    box3Timer.classList.toggle("danger", timer <= 2)
    box3Timer.classList.toggle("presenterTimerDanger", timer <= 2)
  }

  const pointsBox = document.getElementById("presenterRandomAuctionPoints")
  const input = document.getElementById("presenterRandomAuctionInput")

  if (pointsBox || input) {
    const statePoints = Number(
      state.box2?.points ??
      state.box2?.numberInput ??
      state.box2?.calculatedPoints ??
      0
    )

    const points =
      document.activeElement === input
        ? Number(presenterRandomAuctionLocalPoints || statePoints || 0)
        : statePoints

    presenterRandomAuctionLocalPoints = points

    if (pointsBox) {
      pointsBox.innerText = points
    }

    if (input && document.activeElement !== input) {
      input.value = points || ""
    }
  }
}
/* =========================
   FINAL - PRESENTER CLEAN VERSION
   مطابق للفاصلة الجديدة:
   1 بدون نقاط
   2 صح صحلي
   3 قصة
   4 التركيز
========================= */

let presenterFinalRound1Rows = []
let presenterFinalRound2Rows = []
let presenterFinalRound3Rows = []

let presenterFinalSelected = { round: 1, number: null }

let presenterFinalPreviewCache = {
  1: "",
  2: "",
  3: "",
  4: ""
}

let presenterFinalRound1FocusMode = false

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
  if (
    presenterFinalForcedRound &&
    Date.now() < presenterFinalForcedRoundUntil
  ) {
    return Number(presenterFinalForcedRound)
  }

  if (presenterFinalRoundOverride) {
    return Number(presenterFinalRoundOverride)
  }

  return Number(getPresenterFinalState()?.round || presenterFinalRound || 1)
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
  presenterFinalRound = Number(round || 1)
  presenterFinalSelected = { round: presenterFinalRound, number: null }

  setPresenterFinalRound1FocusMode(false)

  const title = document.getElementById("presenterSegmentTitle")
  if (title) {
    title.innerText = getPresenterFinalRoundTitle(presenterFinalRound)
  }

  sendCommand("setRound", { round: presenterFinalRound })

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
  if (presenterSegment !== "final") {
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

  if (round === 2) {
    presenterFinalRound2ImageLocalSelection = {
      number: null,
      indexes: [],
      expires: 0
    }

    presenterLiveState = {
      ...(presenterLiveState || {}),
      final: {
        ...(presenterLiveState?.final || {}),
        round: 2,
        round2: {
          ...(presenterLiveState?.final?.round2 || {}),
          activeTeam: null,
          currentNumber: null,
          selectedCorrectIndexes: [],
          hiddenSequence: [],
          imageAnswerShown: false
        }
      }
    }
  }

  if (round === 4) {
    presenterLiveState = {
      ...(presenterLiveState || {}),
      final: {
        ...(presenterLiveState?.final || {}),
        round: 4,
        round4: {
          ...(presenterLiveState?.final?.round4 || {}),
          activeTeam: null,
          teamMedia: {
            ...(presenterLiveState?.final?.round4?.teamMedia || {}),
            currentTeam: null
          }
        }
      }
    }
  }

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

  if (round === 1) {
    setPresenterFinalRound1FocusMode(false)
  }

  sendCommand("stopCurrentFinalVideo")

  const sent = await sendCommand("correct", {
    round,
    team: activeTeam || null
  })

  if (!sent) return

  resetPresenterFinalLocalChoice(round)
  markPresenterLocalSync("final", 900)

  setTimeout(() => {
    refreshPresenterFinalFromState()
    refreshPresenterEnhancements()
  }, 300)
}

async function presenterFinalWrong() {
  const round = getPresenterFinalRound()

  if (round === 1) {
    setPresenterFinalRound1FocusMode(false)
  }

  const sent = await sendCommand("wrong", {
    round
  })

  if (!sent) return

  resetPresenterFinalLocalChoice(round)
  markPresenterLocalSync("final", 900)

  setTimeout(() => {
    refreshPresenterFinalFromState()
    refreshPresenterEnhancements()
  }, 300)
}
/* =========================
   RENDER FINAL MAIN
========================= */

async function renderFinal() {
  const panel = document.getElementById("presenterPanel")
  if (!panel) return

  presenterFinalRound = Number(getPresenterFinalRound() || 1)

  const title = document.getElementById("presenterSegmentTitle")
  if (title) {
    title.innerText = getPresenterFinalRoundTitle(presenterFinalRound)
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
  markPresenterLocalSync("final", 900)

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
          onclick="clearPresenterFinalPreview(4); presenterFinalCorrect()"
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
  if (presenterSegment !== "final") return

  const round = Number(getPresenterFinalRound() || presenterFinalRound || 1)
  presenterFinalRound = round

  const title = document.getElementById("presenterSegmentTitle")
  if (title) {
    title.innerText = getPresenterFinalRoundTitle(round)
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

function openPresenterFinalNumber(round, number) {
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

  sendCommand("openNumber", {
    round,
    number,
    team: activeTeam
  })

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
  if (presenterFinalRound2Rows.length) return

  const { data } = await db
    .from("final_round2_items")
    .select("*")
    .eq("model", presenterModel)
    .order("number", { ascending: true })
    .order("item_order", { ascending: true })

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
    const selected = state.selectedCorrectIndexes || []

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
    const hidden = state.hiddenSequence || []

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
  if (presenterSegment !== "final") return
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

function presenterReaderLogout() {
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
  if (video) {
    return `
      <div
        class="readerMediaThumb readerVideoThumb"
        onclick="event.stopPropagation(); openReaderMediaViewer({ type:'video', src:'${readerEscape(video)}' })"
      >
        <video
          src="${readerEscape(video)}"
          controls
          muted
          playsinline
          preload="metadata"
        ></video>

        <div class="readerMediaHint">اضغط للتكبير / التشغيل</div>
      </div>
    `
  }

  if (image) {
    return `
      <div
        class="readerMediaThumb readerImageThumb"
        onclick="event.stopPropagation(); openReaderMediaViewer({ type:'image', src:'${readerEscape(image)}' })"
      >
        <img src="${readerEscape(image)}" alt="" loading="lazy">

        <div class="readerMediaHint">اضغط للتكبير</div>
      </div>
    `
  }

  return `
    <div class="readerMediaThumb readerNoMedia">
      لا توجد صورة
    </div>
  `
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
  segment = normalizePresenterSegmentKey(segment)

  await loadPresenterVisibleSegments()

  if (!isPresenterSegmentVisible(segment)) {
    showToast("هذه الفقرة معطلة من الأدمن")
    renderPresenterReaderHome()
    return
  }

  presenterReaderSegment = segment

  showPresenterReaderSegmentPage()

  const title = document.getElementById("presenterReaderSegmentTitle")
  const panel = document.getElementById("presenterReaderPanel")

  if (title) title.innerText = getPresenterReaderSegmentTitle(segment)

  if (panel) {
    panel.innerHTML = `
      <section class="readerLoadingCard">
        جارٍ تحميل البيانات...
      </section>
    `
  }

  try {
    if (segment === "warmup") await renderPresenterReaderWarmup()
    if (segment === "top10") await renderPresenterReaderTop10()
    if (segment === "auction") await renderPresenterReaderAuction()
    if (segment === "who") await renderPresenterReaderWho()
    if (segment === "explain") await renderPresenterReaderExplain()
    if (segment === "archive") await renderPresenterReaderArchive()

    if (segment === "randomChallenge") {
      if (panel) {
        panel.innerHTML = readerEmpty("فقرة التحدي لا تحتوي على أسئلة من الأدمن")
      }
      return
    }

    if (segment === "final_round1") await renderPresenterReaderFinalRound1()
    if (segment === "final_round2") await renderPresenterReaderFinalRound2()
    if (segment === "final_round3") await renderPresenterReaderFinalRound3()
    if (segment === "final_round4") await renderPresenterReaderFinalRound4()
  } catch (err) {
    console.log("READER SEGMENT ERROR:", err)

    if (panel) {
      panel.innerHTML = readerEmpty("تعذر تحميل بيانات الفقرة")
    }
  }
}

function reloadPresenterReaderSegment() {
  if (!presenterReaderSegment) {
    renderPresenterReaderHome()
    return
  }

  openPresenterReaderSegment(presenterReaderSegment)
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