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
  { key: "final_round4", title: "التركيز", sort: 10, finalRound: 4 }
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
  const alreadyJoined = localStorage.getItem("presenter_session_id")

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

  applyPresenterSessionData(data)
  subscribeToGameSession(data.id)
})
/* =========================
   PAGE MODE
========================= */

function showPresenterJoin() {
  document.getElementById("presenterJoin")?.classList.remove("hidden")
  document.getElementById("presenterHome")?.classList.add("hidden")
  document.getElementById("presenterSegmentPage")?.classList.add("hidden")
}

function showPresenterHomePage() {
  document.getElementById("presenterJoin")?.classList.add("hidden")
  document.getElementById("presenterHome")?.classList.remove("hidden")
  document.getElementById("presenterSegmentPage")?.classList.add("hidden")
}

function showPresenterSegmentPage() {
  document.getElementById("presenterJoin")?.classList.add("hidden")
  document.getElementById("presenterHome")?.classList.add("hidden")
  document.getElementById("presenterSegmentPage")?.classList.remove("hidden")
}

function getPresenterFinalRoundTitle(round) {
  round = Number(round || 1)

  if (round === 1) return "ٮدوں ٮڡاط"
  if (round === 2) return "صح صحلي"
  if (round === 3) return "قصة"
  if (round === 4) return "التركيز"

  return "الفاصلة"
}

function getPresenterSegmentName(segment) {
  if (segment === "final") {
    return getPresenterFinalRoundTitle(presenterFinalRound)
  }

  const item = ALL_PRESENTER_SEGMENTS.find(x => x.key === segment)
  return item?.title || "لوحة المقدم"
}

async function loadPresenterVisibleSegments() {
  presenterVisibleSegments = ALL_PRESENTER_SEGMENTS
    .map(item => ({
      ...item,
      is_visible: true,
      sort_order: item.sort
    }))

  const modelId = Number(presenterModel || 0)

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

  if (!data || !data.length) {
    return presenterVisibleSegments
  }

  const map = {}

  ALL_PRESENTER_SEGMENTS.forEach(item => {
    map[item.key] = {
      ...item,
      is_visible: true,
      sort_order: item.sort
    }
  })

  data.forEach(row => {
    if (!map[row.segment_key]) return

    map[row.segment_key] = {
      ...map[row.segment_key],
      is_visible: !!row.is_visible,
      sort_order: Number(row.sort_order || map[row.segment_key].sort)
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
  return presenterVisibleSegments.some(item => item.key === segment)
}

async function renderPresenterSegmentsGrid() {
  const grid = document.getElementById("presenterSegmentsGrid")
  if (!grid) return

  await loadPresenterVisibleSegments()

  grid.innerHTML = presenterVisibleSegments.map(item => {
    const locked = !!presenterLiveState?.segmentStatus?.[item.key]?.locked

    const clickAction = item.finalRound
      ? `openPresenterFinalCard(${Number(item.finalRound)})`
      : `openPresenterSegment('${item.key}')`

    return `
      <button
        type="button"
        class="segmentCard presenterSegmentCard ${locked ? "presenterLockedSegment" : ""}"
        data-segment="${item.key}"
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
   SESSION WATCHER
========================= */

function refreshPresenterCurrentSegmentFromState() {
  if (presenterSegment === "warmup") {
    refreshPresenterWarmupFromState()
    return
  }

  if (presenterSegment === "top10") {
    refreshPresenterTop10FromState()
    return
  }

  if (presenterSegment === "auction") {
    refreshPresenterAuctionFromState()
    return
  }

  if (presenterSegment === "who") {
    refreshPresenterWhoFromState()
    return
  }

  if (presenterSegment === "explain") {
    refreshPresenterExplainFromState()
    return
  }

  if (presenterSegment === "archive") {
    refreshPresenterArchiveFromState()
    return
  }

  if (presenterSegment === "final") {
    refreshPresenterFinalFromState()
  }
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

function applyPresenterSessionData(data) {
  if (!data) return

  if (data.status === "ended") {
    renderPresenterEnded()
    return
  }

  const rawNextSegment = data.active_segment || null
  const nextSegment = normalizePresenterSegmentFromSession(rawNextSegment)

  const nextFinalRound = getPresenterFinalRoundFromSessionSegment(
    rawNextSegment,
    data.state?.final?.round || presenterFinalRound || 1
  )

  const segmentChanged = presenterSegment !== nextSegment
  const oldSessionId = presenterSessionId

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
    }

    presenterSegment = nextSegment

    if (!presenterSegment) {
      renderPresenterHome()
    }

    return
  }

  const toast = presenterLiveState?.toast
  if (toast?.text && toast?.time && toast.time !== lastPresenterToastTime) {
    lastPresenterToastTime = toast.time
    showToast(toast.text)
  }

  presenterSegment = nextSegment

  if (!presenterSegment) {
    renderPresenterHome()
    return
  }

  const panel = document.getElementById("presenterPanel")
  const panelIsEmpty = !panel || !panel.innerHTML.trim()

  if (segmentChanged || oldSessionId !== data.id || panelIsEmpty) {
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

  function subscribeToGameSession(sessionId) {
  presenterSessionId = sessionId

  if (presenterChannel) {
    db.removeChannel(presenterChannel)
  }

  if (presenterSyncTimer) {
    clearInterval(presenterSyncTimer)
    presenterSyncTimer = null
  }

  presenterChannel = db.channel("game_session_" + sessionId)

presenterChannel
  .on(
    "broadcast",
    { event: "session_state" },
    payload => {
      const data = payload?.payload
      if (!data) return

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
      applyPresenterSessionData(payload.new)
    }
  )
  .subscribe()

  presenterSyncTimer = setInterval(async () => {
    if (document.hidden) return

    const { data } = await db
      .from("game_sessions")
      .select("*")
      .eq("id", sessionId)
      .maybeSingle()

    if (!data) return

    const oldScores = JSON.stringify(presenterLiveState?.mainScores || {})
    const newScores = JSON.stringify(data.state?.mainScores || {})
    const oldLocked = JSON.stringify(presenterLiveState?.segmentStatus || {})
    const newLocked = JSON.stringify(data.state?.segmentStatus || {})

    const newSegment = normalizePresenterSegmentFromSession(data.active_segment || null)
    const currentSegment = presenterSegment || null

    if (
      newSegment !== currentSegment ||
      oldScores !== newScores ||
      oldLocked !== newLocked
    ) {
      applyPresenterSessionData(data)
    }
  }, 30000)
}

function renderPresenterEnded() {
  localStorage.removeItem("presenter_session_id")
  localStorage.removeItem("presenter_join_code")

  presenterSessionId = null
  presenterSegment = null
  presenterLiveState = null

  showPresenterJoin()

  const status = document.getElementById("presenterJoinStatus")

  if (status) {
    status.innerText = "انتهت اللعبة — أدخل كود جديد"
  }
}
/* =========================
   Presenter Button Guard
========================= */

let presenterCommandLocks = {}

function getPresenterActionLockTime(action) {
  if (action === "correct") return 1400
  if (action === "wrong") return 1400
  if (action === "undo") return 1000
  if (action === "openNumber") return 900
  if (action === "showAnswer") return 900
  if (action === "showQuestion") return 900
  if (action === "nextRound") return 1200
  if (action === "recordRound3Score") return 1400
  if (action === "recordScrambleScore") return 1400
  if (action === "recordSequenceScore") return 1400

  return 650
}

function getPresenterCommandLockKey(action, payload = {}) {
  if (action === "openNumber") {
    return `${presenterSegment || "global"}_${action}_${payload.round || ""}_${payload.category || ""}_${payload.number || ""}`
  }

  return `${presenterSegment || "global"}_${action}`
}

function lockPresenterActionButton(action, payload = {}) {
  const key = getPresenterCommandLockKey(action, payload)
  const now = Date.now()
  const lockTime = getPresenterActionLockTime(action)

  if (presenterCommandLocks[key] && now - presenterCommandLocks[key] < lockTime) {
    return false
  }

  presenterCommandLocks[key] = now

  setTimeout(() => {
    delete presenterCommandLocks[key]
  }, lockTime + 80)

  return true
}
/* =========================
   SEND COMMAND - FAST
========================= */
let presenterActionLocks = new Map()

function getPresenterCurrentNumberForLock() {
  if (presenterSegment === "explain") {
    return presenterLiveState?.explain?.explainState?.currentNumber || ""
  }

  if (presenterSegment === "who") {
    return presenterLiveState?.who?.currentNumber || ""
  }

  if (presenterSegment === "auction") {
    return presenterLiveState?.auction?.currentNumber || ""
  }

  if (presenterSegment === "archive") {
    return presenterLiveState?.archive?.currentNumber || ""
  }

  if (presenterSegment === "final") {
  return (
    presenterLiveState?.final?.round1?.currentNumber ||
    presenterLiveState?.final?.round2?.currentNumber ||
    presenterLiveState?.final?.round3?.currentNumber ||
    presenterLiveState?.final?.round3?.teamMedia?.currentNumber ||
    presenterLiveState?.final?.round4?.currentNumber ||
    presenterLiveState?.final?.round4?.teamMedia?.currentNumber ||
    ""
  )
}

  return ""
}

function getPresenterActionLockKey(action, payload = {}) {
  const segment = presenterSegment || "global"

  if (action === "correct" || action === "wrong") {
    return `${segment}_${action}_${getPresenterCurrentNumberForLock()}`
  }

  if (action === "openNumber") {
    return `${segment}_${action}_${payload.round || ""}_${payload.number || ""}`
  }

  if (action === "startTimer") {
    return `${segment}_${action}_${getPresenterCurrentNumberForLock()}`
  }

  if (action === "double") {
    return `${segment}_${action}_${getPresenterCurrentNumberForLock()}`
  }

  if (action === "nextRound") {
    return `${segment}_${action}`
  }

  if (action === "undo") {
    return `${segment}_${action}_${Date.now()}`
  }

  return `${segment}_${action}_${JSON.stringify(payload || {})}`
}

function lockPresenterActionButton(action, payload = {}) {
  const key = getPresenterActionLockKey(action, payload)
  const now = Date.now()

  /*
    أوامر النقاط لازم تكون محمية أكثر
    عشان لا تتسجل النقطة مرتين
  */
  const importantActions = [
    "correct",
    "wrong",
    "recordRound3Score",
    "recordScrambleScore",
    "recordSequenceScore",
    "openNumber",
    "startTimer",
    "double",
    "nextRound"
  ]

  const lockTime = importantActions.includes(action) ? 1200 : 500
  const lastTime = presenterActionLocks.get(key) || 0

  if (now - lastTime < lockTime) {
    return false
  }

  presenterActionLocks.set(key, now)

  if (presenterActionLocks.size > 100) {
    presenterActionLocks = new Map(
      Array.from(presenterActionLocks.entries()).slice(-50)
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

  const clientCommandId = `${Date.now()}_${Math.random().toString(36).slice(2)}`

  const commandPayload = {
    ...payload,
    __client_command_id: clientCommandId
  }

  const command = {
    session_id: sessionId,
    model: presenterModel,
    segment: presenterSegment || "global",
    action,
    payload: commandPayload,
    created_at: new Date().toISOString()
  }

  let broadcastSent = false

  try {
    if (presenterChannel) {
      await presenterChannel.send({
        type: "broadcast",
        event: "presenter_command",
        payload: command
      })

      broadcastSent = true
    }
  } catch (error) {
    console.log("Presenter broadcast error:", error)
  }

  db.from("presenter_commands")
    .insert(command)
    .then(({ error }) => {
      if (error) {
        console.log("Presenter command database error:", error)

        if (!broadcastSent) {
          showToast("تعذر تنفيذ الأمر")
        }
      }
    })

  return true
}
/* =========================
   HOME / NAV
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

  const panel = document.getElementById("presenterPanel")

  if (panel) panel.dataset.segment = ""

  renderPresenterSegmentsGrid()
  updatePresenterLockedSegments()
}
function updatePresenterHomeScoresOnly() {
  const scores = getPresenterTotalScores()

  const scoreA = document.getElementById("presenterHomeScoreA")
  const scoreB = document.getElementById("presenterHomeScoreB")

  if (scoreA) scoreA.innerText = scores.A
  if (scoreB) scoreB.innerText = scores.B
}
function updatePresenterLockedSegments() {
  const locked = presenterLiveState?.segmentStatus || {}

  document
    .querySelectorAll("#presenterSegmentsGrid .segmentCard")
    .forEach(card => {
      const key = card.dataset.segment
      if (!key) return

      const isLocked = !!locked?.[key]?.locked

      card.classList.toggle("presenterLockedSegment", isLocked)
      card.disabled = isLocked
    })
}

async function presenterGoHome() {
  presenterGoingHome = true

  presenterSegment = null
  presenterSelectedTeam = null

  renderPresenterHome()

  sendCommand("goHome")

  const sessionId = localStorage.getItem("presenter_session_id")

  if (sessionId) {
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
  }, 500)
}

async function openPresenterFinalCard(round) {
  round = Number(round || 1)

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

  showPresenterSegmentPage()

  const title = document.getElementById("presenterSegmentTitle")
  if (title) {
    title.innerText = getPresenterFinalRoundTitle(round)
  }

  const panel = document.getElementById("presenterPanel")
  if (panel) {
    panel.dataset.segment = "final"
    panel.innerHTML = `
      <section class="presenterCard">
        <div class="presenterLabel">جارٍ تحميل ${getPresenterFinalRoundTitle(round)}...</div>
      </section>
    `
  }

  await forcePresenterFinalRound(round)

  presenterFinalRound = round
  presenterFinalForcedRound = round
  presenterFinalForcedRoundUntil = Date.now() + 60000
  presenterFinalRoundOverride = round

  await renderFinal()
  await renderPresenterFinalRoundContent()
  refreshPresenterEnhancements()

  await sendCommand("openSegment", {
    segment: "final",
    round
  })

  setTimeout(async () => {
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

    const title = document.getElementById("presenterSegmentTitle")
    if (title) {
      title.innerText = getPresenterFinalRoundTitle(round)
    }

    await renderFinal()
    await renderPresenterFinalRoundContent()
    refreshPresenterEnhancements()
  }, 500)
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

async function openPresenterSegment(segment) {
  await loadPresenterVisibleSegments()

  if (!isPresenterSegmentVisible(segment)) {
    showToast("هذه الفقرة غير مفعلة في هذا النموذج")
    renderPresenterHome()
    return
  }

  const locked = !!presenterLiveState?.segmentStatus?.[segment]?.locked

  if (locked) {
    showToast("هذه الفقرة منتهية")
    return
  }

  presenterSelectedTeam = null
  presenterSegment = segment

  showPresenterSegmentPage()

  const title = document.getElementById("presenterSegmentTitle")
  if (title) {
    title.innerText = getPresenterSegmentName(segment)
  }

  const panel = document.getElementById("presenterPanel")
  if (panel) {
    panel.dataset.segment = ""
    panel.innerHTML = `
      <section class="presenterCard">
        <div class="presenterLabel">جارٍ التحميل...</div>
      </section>
    `
  }

  await openPresenterSegmentFromSync(segment)

  const sent = await sendCommand("openSegment", { segment })

  if (!sent) {
    showToast("تعذر فتح الفقرة في العرض")
  }
}

async function openPresenterSegmentFromSync(segment) {
  const panel = document.getElementById("presenterPanel")
  if (!panel) return

  showPresenterSegmentPage()

  const title = document.getElementById("presenterSegmentTitle")

  if (title) {
  title.innerText = segment === "final"
    ? getPresenterFinalRoundTitle(getPresenterFinalRound())
    : getPresenterSegmentName(segment)
}

  const currentRendered = panel.dataset.segment
  const panelText = panel.innerText || ""
  const panelIsEmpty =
    !panel.innerHTML.trim() ||
    panelText.includes("جارٍ التحميل") ||
    panelText.includes("حدث خطأ في تحميل الفقرة")

  if (currentRendered === segment && !panelIsEmpty) {
    if (segment === "warmup") {
      refreshPresenterWarmupFromState()
    } else if (segment === "top10") {
      refreshPresenterTop10FromState()
    } else if (segment === "auction") {
      refreshPresenterAuctionFromState()

      if (typeof ensurePresenterAuctionVideoButton === "function") {
        setTimeout(ensurePresenterAuctionVideoButton, 80)
      }
    } else if (segment === "who") {
      refreshPresenterWhoFromState()
    } else if (segment === "explain") {
      refreshPresenterExplainFromState()
    } else if (segment === "archive") {
      refreshPresenterArchiveFromState()
    } else if (segment === "final") {
      refreshPresenterFinalFromState()
    }

    if (typeof refreshPresenterEnhancements === "function") {
      refreshPresenterEnhancements()
    }

    return
  }

  panel.dataset.segment = segment

  panel.innerHTML = `
    <section class="presenterCard">
      <div class="presenterLabel">جارٍ التحميل...</div>
    </section>
  `

  try {
    if (segment === "warmup") {
      await renderWarmup()
    } else if (segment === "top10") {
      await renderTop10()
    } else if (segment === "auction") {
      await renderAuction()

      if (typeof ensurePresenterAuctionVideoButton === "function") {
        setTimeout(ensurePresenterAuctionVideoButton, 120)
      }
    } else if (segment === "who") {
      await renderWho()
    } else if (segment === "explain") {
      await renderExplain()
    } else if (segment === "archive") {
      await renderArchive()
    } else if (segment === "final") {
      await renderFinal()
    } else {
      renderPresenterHome()
      return
    }

    panel.dataset.segment = segment

    if (typeof refreshPresenterEnhancements === "function") {
      refreshPresenterEnhancements()
    }

  } catch (e) {
    console.log("Presenter render error:", e)

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

    if (typeof refreshPresenterEnhancements === "function") {
      refreshPresenterEnhancements()
    }
  }
}
/* =========================
   SHARED UI
========================= */

function getPresenterActiveTeamFromState() {
  if (presenterSegment === "warmup") {
    return presenterLiveState?.warmup?.selectedTeam || null
  }

  if (presenterSegment === "top10") {
    return presenterLiveState?.top10?.top10State?.activeTeam || null
  }

  if (presenterSegment === "auction") {
    return presenterLiveState?.auction?.auctionState?.activeTeam || null
  }

  if (presenterSegment === "who") {
    return presenterLiveState?.who?.whoState?.activeTeam || null
  }

  if (presenterSegment === "explain") {
    return presenterLiveState?.explain?.explainState?.currentTeam ||
           presenterLiveState?.explain?.explainState?.activeTeam ||
           null
  }

  if (presenterSegment === "archive") {
    return presenterLiveState?.archive?.archiveState?.activeTeam || null
  }

  if (presenterSegment === "final") {
    const round = presenterLiveState?.final?.round || presenterFinalRound || 1

    if (round === 1) {
      return presenterLiveState?.final?.round1?.activeTeam || null
    }

    if (round === 2) {
      return presenterLiveState?.final?.round2?.activeTeam || null
    }

    if (round === 3) {
      return presenterLiveState?.final?.round3?.activeTeam || null
    }

    if (round === 4) {
      return presenterLiveState?.final?.round4?.teamMedia?.currentTeam ||
             presenterLiveState?.final?.round4?.activeTeam ||
             null
    }
  }

  return presenterSelectedTeam
}
function getPresenterFinalTeamForRound(round = getPresenterFinalRound()) {
  const r = Number(round || 1)

  if (presenterSelectedTeam) {
    return presenterSelectedTeam
  }

  if (r === 2) {
    return presenterLiveState?.final?.round2?.activeTeam || null
  }

  if (r === 4) {
    return presenterLiveState?.final?.round4?.teamMedia?.currentTeam ||
           presenterLiveState?.final?.round4?.activeTeam ||
           null
  }

  return null
}

function updatePresenterTeamButtonsOnly(team) {
  document.getElementById("teamA")?.classList.toggle("selectedPresenterTeam", team === "A")
  document.getElementById("teamB")?.classList.toggle("selectedPresenterTeam", team === "B")
  document.getElementById("teamA")?.classList.toggle("activeTeam", team === "A")
  document.getElementById("teamB")?.classList.toggle("activeTeam", team === "B")
}

function syncPresenterSelectedTeamLocally(team) {
  if (team !== "A" && team !== "B") return

  if (presenterSegment === "explain") {
    presenterLiveState = {
      ...(presenterLiveState || {}),
      explain: {
        ...(presenterLiveState?.explain || {}),
        explainState: {
          ...(presenterLiveState?.explain?.explainState || {}),
          currentTeam: team,
          activeTeam: team
        }
      }
    }
  }

  if (presenterSegment === "final") {
    const round = Number(getPresenterFinalRound() || 1)

    if (round === 2) {
      presenterLiveState = {
        ...(presenterLiveState || {}),
        final: {
          ...(presenterLiveState?.final || {}),
          round,
          round2: {
            ...(presenterLiveState?.final?.round2 || {}),
            activeTeam: team
          }
        }
      }
    }

    if (round === 4) {
      presenterLiveState = {
        ...(presenterLiveState || {}),
        final: {
          ...(presenterLiveState?.final || {}),
          round,
          round4: {
            ...(presenterLiveState?.final?.round4 || {}),
            activeTeam: team,
            teamMedia: {
              ...(presenterLiveState?.final?.round4?.teamMedia || {}),
              currentTeam: team
            }
          }
        }
      }
    }
  }
}

function teamButtons() {
  const activeTeam =
    presenterSegment === "final"
      ? getPresenterFinalTeamForRound()
      : (getPresenterActiveTeamFromState() || presenterSelectedTeam)

  return `
    <div class="presenterTeams">
      <button
        class="presenterBtn orange ${activeTeam === "A" ? "selectedPresenterTeam" : ""}"
        onclick="selectTeam('A')"
        id="teamA"
      >
        ${presenterTeamAName}
      </button>

      <button
        class="presenterBtn orange ${activeTeam === "B" ? "selectedPresenterTeam" : ""}"
        onclick="selectTeam('B')"
        id="teamB"
      >
        ${presenterTeamBName}
      </button>
    </div>
  `
}

function selectTeam(team) {
  if (team !== "A" && team !== "B") return

  presenterSelectedTeam = team
  syncPresenterSelectedTeamLocally(team)
  updatePresenterTeamButtonsOnly(team)

  sendCommand("selectTeam", {
  team,
  round: presenterSegment === "final" ? getPresenterFinalRound() : null
})

  if (presenterSegment === "final") {
    refreshPresenterFinalFromState()
  }

  if (presenterSegment === "explain") {
    refreshPresenterExplainFromState()
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

function getPresenterWarmupState() {
  return presenterLiveState?.warmup || {}
}

function getPresenterWarmupUsed() {
  return getPresenterWarmupState()?.usedQuestions || {}
}

function getPresenterWarmupActiveTeam() {
  return getPresenterWarmupState()?.selectedTeam || presenterSelectedTeam || null
}

function getPresenterWarmupLocked() {
  return !!getPresenterWarmupState()?.warmupQuestionLocked
}

function getPresenterWarmupCurrentKey() {
  return getPresenterWarmupState()?.currentWarmupQuestionKey || null
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

      <!-- اليسار: الفئات والأرقام فقط -->
      <div class="presenterWarmupLeft">

        <section class="presenterCard presenterWarmupNumbersCard">
          <div class="presenterLabel">الفئات والأسئلة</div>

          <div class="presenterWarmupCats">
            ${[1, 2, 3, 4].map(cat => {
              const catRows = presenterWarmupRows.filter(r => Number(r.category) === cat)
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

      <!-- اليمين: الفرق + السؤال + الإجابة + التحكم -->
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
            class="presenterBtn gray presenterDoubleBtn"
            onclick="sendCommand('double')"
            ${locked || currentKey ? "disabled" : ""}
          >
            دوبيلا
          </button>

          <button class="presenterBtn red presenterWrongBtn" onclick="sendCommand('wrong')">
            ✕ خطأ
          </button>

          <button class="presenterBtn green presenterCorrectBtn" onclick="sendCommand('correct')">
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
}

function openWarmupPresenterQuestion(category, number, event) {
  const warmupState = getPresenterWarmupState()
  const used = getPresenterWarmupUsed()
  const key = `${category}_${number}`

  if (warmupState.warmupQuestionLocked) {
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

  presenterWarmupSelected = { category, number }

  const btn = event?.currentTarget
  if (btn) {
    btn.disabled = true
    btn.classList.add("presenterOpened", "selectedPresenterTeam")
    btn.innerText = ""
  }

  presenterWhoScoreLocked = false
  presenterWhoLastScoreKey = ""
  setPresenterWhoScoreButtonsDisabled(false)

  showPresenterWarmupPreview(category, number)

  sendCommand("openNumber", {
    category,
    number
  })
}

function showPresenterWarmupPreview(category, number) {
  const item = presenterWarmupRows.find(row => {
    return Number(row.category) === Number(category) &&
           Number(row.number) === Number(number)
  })

  const questionBox = document.getElementById("presenterWarmupQuestionText")
  const answerBox = document.getElementById("presenterWarmupAnswerText")

  if (questionBox) questionBox.innerText = item?.question || "لا يوجد سؤال"
  if (answerBox) answerBox.innerText = item?.answer || "لا توجد إجابة"
}
function refreshPresenterWarmupFromState() {
  if (presenterSegment !== "warmup") return

  const warmupState = getPresenterWarmupState()
  const used = getPresenterWarmupUsed()
  const locked = getPresenterWarmupLocked()
  const currentKey = getPresenterWarmupCurrentKey()
  const activeTeam = getPresenterWarmupActiveTeam()

  document.getElementById("teamA")?.classList.toggle(
    "selectedPresenterTeam",
    activeTeam === "A"
  )

  document.getElementById("teamB")?.classList.toggle(
    "selectedPresenterTeam",
    activeTeam === "B"
  )

  document.querySelectorAll(".presenterWarmupNumbers .presenterNumberBtn").forEach(btn => {
    btn.classList.remove("presenterOpened", "selectedPresenterTeam")
    btn.disabled = false

    const onclick = btn.getAttribute("onclick") || ""
    const match = onclick.match(/openWarmupPresenterQuestion\((\d+),\s*(\d+)/)

    if (!match) return

    const cat = Number(match[1])
    const num = Number(match[2])
    const key = `${cat}_${num}`

    const isUsed = !!used[key]
    const isCurrent = currentKey === key

    if (isUsed) {
      btn.classList.add("presenterOpened")
      btn.disabled = true
      btn.innerText = ""
    } else {
      btn.innerText = String(num)
    }

    if (isCurrent) {
      btn.classList.add("selectedPresenterTeam")
      btn.disabled = true
    }

    if (locked && !isCurrent) {
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

  const doubleBtn = document.querySelector(
  `.presenterWarmupActions .presenterBtn.gray[onclick="sendCommand('double')"]`
)

  if (doubleBtn) {
    doubleBtn.disabled = !!locked || !!currentKey
  }
}

/* =========================
   TOP 10
========================= */

let presenterTop10Rows = []
let presenterTop10LoadedRound = null
let presenterTop10OpenedBy = JSON.parse(localStorage.getItem("presenter_top10_opened_by") || "{}")

function savePresenterTop10OpenedBy() {
  localStorage.setItem("presenter_top10_opened_by", JSON.stringify(presenterTop10OpenedBy))
}

function getPresenterTop10MaxRound() {
  return Number(presenterLiveState?.top10?.top10MaxRound || 3)
}

function getPresenterTop10State() {
  return presenterLiveState?.top10?.top10State || {
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

function getPresenterTop10Round() {
  return Number(getPresenterTop10State()?.round || 1)
}

function getTop10OpenedTeamName(round, num) {
  const team = presenterTop10OpenedBy[`${round}_${num}`]

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
  const opened = top10.opened?.[round] || []
  const question = top10.question?.[round] || "السؤال يظهر هنا"
  const errorsA = Number(top10.errors?.[round]?.A || 0)
  const errorsB = Number(top10.errors?.[round]?.B || 0)

  await loadPresenterTop10RoundRows(round)

  function buildTop10AnswerButton(num) {
    const item = presenterTop10Rows.find(r => Number(r.position) === num)
    const isOpened = opened.includes(num)
    const openedName = getTop10OpenedTeamName(round, num)

    return `
      <button
        class="presenterTop10AnswerBtn ${isOpened ? "opened" : ""}"
        ${isOpened ? "disabled" : ""}
        onclick="openTop10PresenterNumber(${num}, event)"
      >
        <span class="presenterTop10AnswerNo">${num}</span>

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

      <!-- اليسار: الإجابات -->
      <div class="presenterTop10Left">

        <section class="presenterCard presenterTop10AnswersCard">
          <div class="presenterLabel">الإجابات</div>

          <div class="presenterTop10AnswersCols">

  <div class="presenterTop10AnswersCol presenterTop10RightCol">
    ${[1, 2, 3, 4, 5].map(num => buildTop10AnswerButton(num)).join("")}
  </div>

  <div class="presenterTop10AnswersCol presenterTop10LeftCol">
    ${[6, 7, 8, 9, 10].map(num => buildTop10AnswerButton(num)).join("")}
  </div>

</div>
        </section>

      </div>

      <!-- اليمين: الفرق + السؤال + الأخطاء + التحكم -->
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
          <button class="presenterBtn gray" onclick="sendCommand('double')">
            دوبيلا
          </button>

          <button class="presenterBtn green" onclick="sendCommand('showAnswer')">
            إظهار الإجابات
          </button>

          <button class="presenterBtn red" onclick="sendCommand('wrong')">
            خطأ الفريق
          </button>

          <button class="presenterBtn gray" onclick="sendCommand('undo')">
            تراجع
          </button>

          <button class="presenterBtn blue" onclick="sendCommand('switchTurn')">
            تبديل الدور
          </button>

          <button class="presenterBtn blue" onclick="sendCommand('nextRound')">
            الجولة التالية
          </button>
        </div>

      </div>

    </div>
  `
}

async function refreshPresenterTop10FromState() {
  if (presenterSegment !== "top10") return

  const top10 = getPresenterTop10State()
  const round = getPresenterTop10Round()

  if (presenterTop10LoadedRound !== round) {
    await loadPresenterTop10RoundRows(round)
  }

  const opened = top10.opened?.[round] || []
  const question = top10.question?.[round] || "السؤال يظهر هنا"
  const errorsA = Number(top10.errors?.[round]?.A || 0)
  const errorsB = Number(top10.errors?.[round]?.B || 0)
  const activeTeam = top10.activeTeam || presenterSelectedTeam || null

  document.getElementById("teamA")?.classList.toggle(
    "selectedPresenterTeam",
    activeTeam === "A"
  )

  document.getElementById("teamB")?.classList.toggle(
    "selectedPresenterTeam",
    activeTeam === "B"
  )

  

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
    const noBox = btn.querySelector(".presenterTop10AnswerNo")
    const textBox = btn.querySelector(".presenterTop10AnswerText")
    const openedByBox = btn.querySelector(".presenterTop10OpenedBy")

    const num = Number(noBox?.innerText || 0)
    if (!num) return

    const isOpened = opened.includes(num)
    const row = presenterTop10Rows.find(r => Number(r.position) === num)
    const answer = top10.answers?.[round]?.[num] || row?.answer || "-"

    btn.classList.toggle("opened", isOpened)
    btn.disabled = isOpened

    if (textBox) {
      textBox.innerText = answer
    }

    if (openedByBox) {
      const openedTeamName = getTop10OpenedTeamName(round, num)

      openedByBox.innerText = isOpened
        ? (openedTeamName || "تم الفتح")
        : ""
    }
  })
}

function setPresenterTop10Round(round) {
  const maxRound = getPresenterTop10MaxRound()
  const safeRound = Math.min(Math.max(Number(round || 1), 1), maxRound)

  sendCommand("setRound", { round: safeRound })
}

function openTop10PresenterNumber(number, event) {
  const top10 = getPresenterTop10State()
  const round = getPresenterTop10Round()
  const opened = top10.opened?.[round] || []
  const activeTeam = top10.activeTeam || presenterSelectedTeam

  if (!activeTeam) {
    showToast("اختر الفريق أولاً")
    return
  }

  if (opened.includes(number)) {
    showToast("الإجابة مفتوحة")
    return
  }

  const teamName = activeTeam === "A" ? presenterTeamAName : presenterTeamBName

  presenterTop10OpenedBy[`${round}_${number}`] = activeTeam
  savePresenterTop10OpenedBy()

  const btn = event?.currentTarget

  if (btn) {
    btn.classList.add("opened")
    btn.classList.add("top10RevealFx")
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
    number,
    round,
    team: activeTeam
  })
}
/* =========================
   AUCTION
========================= */

let presenterAuctionRows = []

function getPresenterAuctionState() {
  return presenterLiveState?.auction || {}
}

function getPresenterAuctionData() {
  return getPresenterAuctionState()?.auctionState || {
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
  return Number(getPresenterAuctionState()?.auctionMaxNumber || 8)
}

function isPresenterAuctionVideo(url = "") {
  const cleanUrl = String(url).split("?")[0].toLowerCase()

  return (
    cleanUrl.endsWith(".mp4") ||
    cleanUrl.endsWith(".webm") ||
    cleanUrl.endsWith(".mov") ||
    cleanUrl.endsWith(".m4v")
  )
}

async function renderAuction() {
  const panel = document.getElementById("presenterPanel")
  if (!panel) return

  const auction = getPresenterAuctionData()
  const maxNumber = getPresenterAuctionMaxNumber()
  const used = (auction.usedNumbers || []).map(Number)
  const currentNumber = Number(auction.currentQuestionNumber || 0)
  const pendingScore = !!auction.pendingScore

  const { data } = await db
    .from("auction_questions")
    .select("number, answer, image, video")
    .eq("model", presenterModel)
    .order("number", { ascending: true })

  presenterAuctionRows = data || []

  const auctionRoot = getPresenterAuctionState()

  const currentMediaVideo =
    !!auctionRoot.currentAuctionVideo ||
    !!auctionRoot.video

  const currentMediaImage =
    !currentMediaVideo && (
      !!auctionRoot.currentAuctionImage ||
      !!auctionRoot.image
    )

  const mediaActionText = currentMediaVideo ? "▶ تشغيل الفيديو" : "تكبير"

  const mediaActionCommand = currentMediaVideo
    ? "playAuctionVideo"
    : "zoomImage"

  const mediaActionDisabled =
    !currentNumber || (!currentMediaVideo && !currentMediaImage)

  panel.innerHTML = `
    <div class="presenterAuctionLayout">

      <div class="presenterAuctionLeft">

        <section class="presenterCard presenterAuctionNumbersCard">
          <div class="presenterLabel">الأرقام</div>

          <div class="presenterGrid four presenterAuctionGrid" id="presenterAuctionGrid">
            ${Array.from({ length: maxNumber }, (_, i) => i + 1).map(num => {
              const isUsed = used.includes(num)
              const isCurrent = currentNumber === num

              return `
                <button
                  class="presenterNumberBtn ${isUsed ? "presenterOpened" : ""} ${isCurrent ? "selectedPresenterTeam" : ""}"
                  ${isUsed || pendingScore ? "disabled" : ""}
                  onclick="openAuctionPresenterNumber(${num})"
                >
                  ${isUsed ? "" : num}
                </button>
              `
            }).join("")}
          </div>
        </section>

        <div class="presenterAuctionActions">
          <button
            class="presenterBtn gray"
            onclick="sendCommand('double')"
            ${currentNumber || pendingScore ? "disabled" : ""}
          >
            دوبيلا
          </button>

          <button class="presenterBtn green" onclick="sendCommand('correct')">
            ✓ صحيحة
          </button>

          <button class="presenterBtn red" onclick="sendCommand('wrong')">
            ✕ خطأ
          </button>

          <button
  id="presenterAuctionMediaActionBtn"
  class="presenterBtn blue"
  onclick="runPresenterAuctionMediaAction()"
  ${mediaActionDisabled ? "disabled" : ""}
>
  ${mediaActionText}
</button>

          <button class="presenterBtn gray" onclick="sendCommand('undo')">
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

          <div class="presenterLabel">الصورة / الفيديو</div>

          <div id="presenterAuctionImageBox" class="presenterImagePreviewBox hidden"></div>
        </section>

      </div>

    </div>
  `

  if (currentNumber) {
    refreshPresenterAuctionFromState()
  }
}



function playPresenterAuctionVideo() {
  const box = document.getElementById("presenterAuctionImageBox")
  if (!box) return

  const video = box.querySelector("video")

  if (!video) {
    showToast("لا يوجد فيديو للتشغيل")
    return
  }

  video.setAttribute("controls", "controls")

  video.play().catch(() => {
    showToast("اضغط على الفيديو للتشغيل")
  })
}
async function playAuctionVideoOnDisplay() {
  const auction = getPresenterAuctionData()

  if (!auction.currentQuestionNumber) {
    showToast("افتح رقم أولاً")
    return
  }

  const sent = await sendCommand("playAuctionVideo", {
    number: auction.currentQuestionNumber
  })

  if (!sent) return

  showToast("تم تشغيل الفيديو في العرض")
}

function getPresenterAuctionCurrentMediaType() {
  const auctionRoot = getPresenterAuctionState()
  const auction = getPresenterAuctionData()
  const currentNumber = Number(auction.currentQuestionNumber || 0)

  if (
    auctionRoot.currentAuctionVideo ||
    auctionRoot.video
  ) {
    return "video"
  }

  if (
    auctionRoot.currentAuctionImage ||
    auctionRoot.image
  ) {
    return "image"
  }

  const item = presenterAuctionRows.find(row => Number(row.number) === currentNumber)

  if (item?.video) return "video"
  if (item?.image) return "image"

  return ""
}

function updatePresenterAuctionMediaActionButton() {
  const btn = document.getElementById("presenterAuctionMediaActionBtn")
  if (!btn) return

  const auction = getPresenterAuctionData()
  const currentNumber = Number(auction.currentQuestionNumber || 0)
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
    await sendCommand("zoomImage")

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

function openAuctionPresenterNumber(number) {
  const auction = getPresenterAuctionData()
  const used = (auction.usedNumbers || []).map(Number)

  if (auction.pendingScore) {
    showToast("أنهِ الدور الحالي أولاً")
    return
  }

  if (used.includes(Number(number))) {
    showToast("الرقم مستخدم")
    return
  }

  showPresenterAuctionPreview(number)

  sendCommand("openNumber", {
    number
  })
}

function renderPresenterAuctionMedia(box, mediaUrl) {
  if (!box || !mediaUrl) return

  box.classList.remove("hidden")

  const safeUrl = String(mediaUrl)

  if (isPresenterAuctionVideo(safeUrl)) {
    box.innerHTML = `
      <div class="presenterVideoNoPreviewBox">
        <div class="presenterVideoNoPreviewIcon">▶</div>
        <div class="presenterVideoNoPreviewText">فيديو جاهز للتشغيل في العرض</div>
      </div>
    `
    return
  }

  box.innerHTML = `
    <img src="${safeUrl}" alt="">
  `
}

function showPresenterAuctionPreview(number) {
  const item = presenterAuctionRows.find(row => Number(row.number) === Number(number))

  const answerBox = document.getElementById("presenterAuctionAnswerText")
  const imageBox = document.getElementById("presenterAuctionImageBox")

  if (answerBox) {
    answerBox.innerText = item?.answer || "لا توجد إجابة"
  }

  if (imageBox) {
    const media = item?.video || item?.image || ""

    if (media) {
      renderPresenterAuctionMedia(imageBox, media)
    } else {
      imageBox.classList.add("hidden")
      imageBox.innerHTML = ""
      updatePresenterAuctionMediaActionButton()
    }
  }
}

function refreshPresenterAuctionFromState() {
  if (presenterSegment !== "auction") return

  const auctionRoot = getPresenterAuctionState()
  const auction = getPresenterAuctionData()

  const maxNumber = getPresenterAuctionMaxNumber()
  const used = (auction.usedNumbers || []).map(Number)
  const currentNumber = Number(auction.currentQuestionNumber || 0)
  const pendingScore = !!auction.pendingScore
  const activeTeam = auction.activeTeam || presenterSelectedTeam || null

  document.getElementById("teamA")?.classList.toggle(
    "selectedPresenterTeam",
    activeTeam === "A"
  )

  document.getElementById("teamB")?.classList.toggle(
    "selectedPresenterTeam",
    activeTeam === "B"
  )

  const grid = document.getElementById("presenterAuctionGrid")

  if (grid) {
    grid.innerHTML = Array.from({ length: maxNumber }, (_, i) => i + 1).map(num => {
      const isUsed = used.includes(num)
      const isCurrent = currentNumber === num

      return `
        <button
          class="presenterNumberBtn ${isUsed ? "presenterOpened" : ""} ${isCurrent ? "selectedPresenterTeam" : ""}"
          ${isUsed || pendingScore ? "disabled" : ""}
          onclick="openAuctionPresenterNumber(${num})"
        >
          ${isUsed ? "" : num}
        </button>
      `
    }).join("")
  }

  const answerBox = document.getElementById("presenterAuctionAnswerText")
  const imageBox = document.getElementById("presenterAuctionImageBox")

  const answer =
    auctionRoot.currentAuctionAnswer ||
    auctionRoot.answer ||
    ""

  const image =
  auctionRoot.currentAuctionVideo ||
  auctionRoot.video ||
  auctionRoot.currentAuctionImage ||
  auctionRoot.image ||
  ""

  if (currentNumber) {
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

  const doubleBtn = document.querySelector(
    `.presenterAuctionActions .presenterBtn.gray[onclick="sendCommand('double')"]`
  )

  if (doubleBtn) {
    doubleBtn.disabled = !!currentNumber || !!pendingScore
  }

  updatePresenterAuctionMediaActionButton()
}
/* =========================
   WHO
========================= */

let presenterWhoRows = []
let presenterWhoScoreLocked = false
let presenterWhoLastScoreKey = ""

function getPresenterWhoStateRoot() {
  return presenterLiveState?.who || {}
}

function getPresenterWhoState() {
  return getPresenterWhoStateRoot()?.whoState || {
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
  return !!getPresenterWhoStateRoot()?.whoQuestionLocked
}

function getPresenterWhoCurrentNumber() {
  return Number(getPresenterWhoStateRoot()?.whoCurrentNumber || 0)
}

function getPresenterWhoCompensationMode() {
  return !!getPresenterWhoStateRoot()?.whoCompensationMode
}

function getPresenterWhoScoreKey() {
  const who = getPresenterWhoState()
  const number = getPresenterWhoCurrentNumber()
  const team = who.activeTeam || presenterSelectedTeam || ""
  const points = Number(who.currentPoints || 0)

  return `${number}_${team}_${points}`
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

function sendPresenterWhoScore(action) {
  const who = getPresenterWhoState()
  const number = getPresenterWhoCurrentNumber()
  const team = who.activeTeam || presenterSelectedTeam || null
  const points = Number(who.currentPoints || 0)

  if (!number) {
    showToast("اختر رقمًا أولاً")
    return
  }

  if (!team && !getPresenterWhoCompensationMode()) {
    showToast("اختر الفريق أولاً")
    return
  }

  if (!points && !getPresenterWhoCompensationMode()) {
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
function selectPresenterWhoPoints(points) {
  points = Number(points || 0)

  document.querySelectorAll(".presenterWhoPointBtn").forEach(btn => {
    const isSelected = Number(btn.dataset.points) === points

    btn.classList.toggle("selectedPresenterTeam", isSelected)
    btn.classList.toggle("activeWhoPoint", isSelected)
  })

  sendCommand("setPoints", {
    points
  })
}

function canPresenterWhoCompensation() {
  const who = getPresenterWhoState()
  const used = (who.usedNumbers || []).map(Number)
  const remaining = []

  for (let i = 1; i <= 15; i++) {
    if (!used.includes(i)) remaining.push(i)
  }

  return (
    !getPresenterWhoLocked() &&
    !getPresenterWhoCurrentNumber() &&
    remaining.length === 1 &&
    remaining[0] === 15
  )
}

async function renderWho() {
  const panel = document.getElementById("presenterPanel")
  if (!panel) return

  const who = getPresenterWhoState()
  const used = (who.usedNumbers || []).map(Number)
  const currentNumber = getPresenterWhoCurrentNumber()
  const locked = getPresenterWhoLocked()
  const currentPoints = Number(who.currentPoints || 0)
  const compensationMode = getPresenterWhoCompensationMode()

  const lock15 = !used.includes(15) && used.length < 14
  const waitCompensation = !used.includes(15) && used.length === 14 && !compensationMode

  const { data } = await db
    .from("who_images")
    .select("number, answer, image, video")
    .eq("model", presenterModel)
    .order("number", { ascending: true })

  presenterWhoRows = data || []

  panel.innerHTML = `
    <div class="presenterWhoLayout">

      <!-- اليسار: النقاط + الأرقام + التحكم -->
      <div class="presenterWhoLeft">

        <section class="presenterCard presenterWhoNumbersCard">
          <div class="presenterLabel">النقاط</div>

          <div class="presenterWhoPointsGrid">
  ${[1, 2, 3, 4, 5].map(p => `
    <button
      class="presenterNumberBtn presenterWhoPointBtn ${currentPoints === p ? "selectedPresenterTeam activeWhoPoint" : ""}"
      data-points="${p}"
      ${locked || compensationMode ? "disabled" : ""}
      onclick="selectPresenterWhoPoints(${p})"
    >
      ${p}
    </button>
  `).join("")}
</div>

          <div class="presenterLabel presenterWhoNumbersLabel">الأرقام</div>

          <div class="presenterWhoGrid">
            ${Array.from({ length: 15 }, (_, i) => i + 1).map(num => {
              const isUsed = used.includes(num)
              const isCurrent = currentNumber === num
              const isLocked15 = num === 15 && (lock15 || waitCompensation)

              return `
                <button
                  class="presenterNumberBtn ${isUsed ? "presenterOpened" : ""} ${isCurrent ? "selectedPresenterTeam" : ""}"
                  ${(isUsed || locked || isLocked15) ? "disabled" : ""}
                  onclick="openWhoPresenterNumber(${num})"
                >
                  ${isUsed ? "" : num}
                </button>
              `
            }).join("")}
          </div>
        </section>

        <div class="presenterWhoActions">
          <button
            class="presenterBtn gray"
            onclick="sendCommand('double')"
            ${locked || currentNumber ? "disabled" : ""}
          >
            دوبيلا
          </button>

          <button
            class="presenterBtn gray"
            onclick="sendCommand('compensation')"
            ${canPresenterWhoCompensation() ? "" : "disabled"}
          >
            التعويض
          </button>

          <button
            id="presenterWhoCorrectBtn"
            class="presenterBtn green"
            onclick="sendPresenterWhoScore('correct')"
            ${!currentNumber ? "disabled" : ""}
          >
            ✓ صح
          </button>

          <button
            id="presenterWhoWrongBtn"
            class="presenterBtn red"
            onclick="sendPresenterWhoScore('wrong')"
            ${!currentNumber ? "disabled" : ""}
          >
            ✕ خطأ
          </button>
        </div>

      </div>

      <!-- اليمين: الفرق + المحتوى -->
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

  if (currentNumber) {
    showPresenterWhoPreview(currentNumber)
  }

  setPresenterWhoScoreButtonsDisabled(
    presenterWhoScoreLocked || !currentNumber
  )
}

function openWhoPresenterNumber(number) {
  const who = getPresenterWhoState()
  const used = (who.usedNumbers || []).map(Number)

  if (getPresenterWhoLocked()) {
    showToast("سجل النتيجة أولاً")
    return
  }

  if (used.includes(number)) {
    showToast("الرقم مستخدم")
    return
  }

  if (!(who.activeTeam || presenterSelectedTeam) && !getPresenterWhoCompensationMode()) {
    showToast("اختر الفريق أولاً")
    return
  }

  if (Number(who.currentPoints || 0) === 0 && !getPresenterWhoCompensationMode()) {
    showToast("اختر النقاط أولاً")
    return
  }

  resetPresenterWhoScoreGuard()

  showPresenterWhoPreview(number)
  sendCommand("openNumber", { number })
}

function showPresenterWhoPreview(number) {
  const item = presenterWhoRows.find(row => Number(row.number) === Number(number))

  const answerBox = document.getElementById("presenterWhoAnswerText")
  const imageBox = document.getElementById("presenterWhoImageBox")

  if (answerBox) answerBox.innerText = item?.answer || "لا توجد إجابة"

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

function refreshPresenterWhoFromState() {
  if (presenterSegment !== "who") return

  const whoRoot = getPresenterWhoStateRoot()
  const who = getPresenterWhoState()

  const used = (who.usedNumbers || []).map(Number)
  const currentNumber = getPresenterWhoCurrentNumber()
  const locked = getPresenterWhoLocked()
  const currentPoints = Number(who.currentPoints || 0)
  const compensationMode = getPresenterWhoCompensationMode()
  const activeTeam = who.activeTeam || presenterSelectedTeam || null

  document.getElementById("teamA")?.classList.toggle(
    "selectedPresenterTeam",
    activeTeam === "A"
  )

  document.getElementById("teamB")?.classList.toggle(
    "selectedPresenterTeam",
    activeTeam === "B"
  )

  document
  .querySelectorAll(".presenterWhoPointsGrid .presenterNumberBtn, .presenterWhoGrid .presenterNumberBtn")
  .forEach(btn => {
    const onclick = btn.getAttribute("onclick") || ""
    const pointsMatch = onclick.match(/setPoints.*points:(\d+)/)
    const numberMatch = onclick.match(/openWhoPresenterNumber\((\d+)\)/)

    if (pointsMatch || btn.dataset.points) {
  const p = Number(btn.dataset.points || pointsMatch?.[1] || 0)
  const selected = currentPoints === p

  btn.classList.toggle("selectedPresenterTeam", selected)
  btn.classList.toggle("activeWhoPoint", selected)
  btn.disabled = !!locked || !!compensationMode

  return
}

    if (numberMatch) {
      const num = Number(numberMatch[1])
      const isUsed = used.includes(num)
      const isCurrent = currentNumber === num

      const lock15 = !used.includes(15) && used.length < 14
      const waitCompensation = !used.includes(15) && used.length === 14 && !compensationMode
      const isLocked15 = num === 15 && (lock15 || waitCompensation)

      btn.classList.remove("presenterOpened", "selectedPresenterTeam")

      if (isUsed) {
        btn.classList.add("presenterOpened")
        btn.disabled = true
        btn.innerText = ""
      } else {
        btn.innerText = String(num)
        btn.disabled = !!locked || !!isLocked15
      }

      if (isCurrent) {
        btn.classList.add("selectedPresenterTeam")
        btn.disabled = true
      }
    }
  })

  const answerBox = document.getElementById("presenterWhoAnswerText")
  const imageBox = document.getElementById("presenterWhoImageBox")

  const answer =
    whoRoot.currentWhoAnswer ||
    whoRoot.answer ||
    ""

  const image =
    whoRoot.currentWhoImage ||
    whoRoot.image ||
    ""

  if (currentNumber) {
    if (answerBox) answerBox.innerText = answer || "لا توجد إجابة"

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
    if (answerBox) answerBox.innerText = "—"

    if (imageBox) {
      imageBox.classList.add("hidden")
      imageBox.innerHTML = ""
    }
  }

  const doubleBtn = document.querySelector(
    `.presenterActions .presenterBtn.gray[onclick="sendCommand('double')"]`
  )

  if (doubleBtn) {
    doubleBtn.disabled = !!locked || !!currentNumber
  }

  const compensationBtn = document.querySelector(
    `.presenterActions .presenterBtn.gray[onclick="sendCommand('compensation')"]`
  )

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
   EXPLAIN WORD - PRESENTER MATCH DISPLAY
========================= */

function getPresenterExplainRoot() {
  return presenterLiveState?.explain || {}
}

function getPresenterExplainState() {
  const root = presenterLiveState?.explain || {}

  return root.explainState || {
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
  return Number(getPresenterExplainState()?.wordsCount || 4) === 6 ? 6 : 4
}

function getPresenterExplainUsedNumbers() {
  return (getPresenterExplainState()?.usedNumbers || []).map(Number)
}

function getPresenterExplainCurrentNumber() {
  return Number(getPresenterExplainState()?.currentNumber || 0)
}

function getPresenterExplainCurrentTeam() {
  const explain = getPresenterExplainState()
  return explain.currentTeam || presenterSelectedTeam || null
}

function getPresenterExplainWord(number) {
  const explain = getPresenterExplainState()

  const item = (explain.words || []).find(row => {
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
  const revealLock = !!explain.revealLock

  panel.innerHTML = `
    <div class="presenterExplainLayout">

      <!-- اليسار: الأرقام + الكلمة + الأزرار -->
      <div class="presenterExplainLeft">

        <section class="presenterCard presenterExplainNumbersCard">
          <div class="presenterLabel">الأرقام</div>

          <div
            class="presenterExplainNumbersGrid"
            id="presenterExplainNumbersGrid"
            style="grid-template-columns:repeat(${count}, minmax(0,1fr));"
          >
            ${Array.from({ length: count }, (_, i) => i + 1).map(num => {
              const isUsed = used.includes(num)
              const isCurrent = currentNumber === num
              const disabled = isUsed || !!currentNumber || revealLock

              return `
                <button
                  type="button"
                  class="presenterNumberBtn presenterExplainNumberCard ${isUsed ? "used presenterOpened" : ""} ${isCurrent ? "active selectedPresenterTeam" : ""}"
                  ${disabled ? "disabled" : ""}
                  onclick="openExplainPresenterNumber(${num})"
                >
                  <span>${num}</span>
                </button>
              `
            }).join("")}
          </div>
        </section>

        <section class="presenterCard presenterExplainWordCard">
          <div class="presenterLabel">الكلمة</div>

          <div
            id="presenterExplainWordText"
            class="presenterExplainWordBox ${explain.answerResult === "correct" ? "answerCorrect" : ""} ${explain.answerResult === "wrong" ? "answerWrong" : ""}"
          >
            ${
              currentNumber
                ? explain.currentWord || getPresenterExplainWord(currentNumber) || "—"
                : "—"
            }
          </div>
        </section>

        <div class="presenterExplainActions">
  <button
    type="button"
    class="presenterBtn dark"
    onclick="sendCommand('startTimer')"
    ${!currentNumber || revealLock ? "disabled" : ""}
  >
    بدء المؤقت
  </button>

  <button
    type="button"
    class="presenterBtn blue"
    onclick="sendCommand('toggleWordVisible')"
    ${!currentNumber || revealLock ? "disabled" : ""}
  >
    إخفاء الكلمة
  </button>

  <button
    type="button"
    class="presenterBtn green"
    onclick="sendCommand('correct')"
    ${!currentNumber || revealLock ? "disabled" : ""}
  >
    صح
  </button>

  <button
    type="button"
    class="presenterBtn red"
    onclick="sendCommand('wrong')"
    ${!currentNumber || revealLock ? "disabled" : ""}
  >
    خطأ
  </button>
</div>

      </div>

      <!-- اليمين: الفرق + المؤقت فقط -->
      <div class="presenterExplainRight">

        <div class="presenterExplainTeamsBox">
          ${teamButtons()}
        </div>

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

function openExplainPresenterNumber(number) {
  const explain = getPresenterExplainState()
  const used = getPresenterExplainUsedNumbers()
  const currentNumber = getPresenterExplainCurrentNumber()
  const activeTeam = explain.currentTeam || presenterSelectedTeam || null

  if (!activeTeam) {
    showToast("اختر الفريق أولاً")
    return
  }

  if (currentNumber) {
    showToast("أنهِ الكلمة الحالية أولاً")
    return
  }

  if (used.includes(Number(number))) {
    showToast("الرقم مستخدم")
    return
  }

  sendCommand("openNumber", {
    number: Number(number),
    team: activeTeam
  })
}

function refreshPresenterExplainFromState() {
  if (presenterSegment !== "explain") return

  const explain = getPresenterExplainState()
  const count = getPresenterExplainWordsCount()
  const used = getPresenterExplainUsedNumbers()
  const currentNumber = getPresenterExplainCurrentNumber()
  const activeTeam = getPresenterExplainCurrentTeam()
  const revealLock = !!explain.revealLock

  const teamA = document.getElementById("teamA")
  const teamB = document.getElementById("teamB")
  const wordBox = document.getElementById("presenterExplainWordText")
  const timerBox = document.getElementById("presenterExplainTimerText")
  const grid = document.getElementById("presenterExplainNumbersGrid")

  if (teamA) {
    teamA.classList.toggle("activeTeam", activeTeam === "A")
    teamA.classList.toggle("selectedPresenterTeam", activeTeam === "A")
  }

  if (teamB) {
    teamB.classList.toggle("activeTeam", activeTeam === "B")
    teamB.classList.toggle("selectedPresenterTeam", activeTeam === "B")
  }

  if (wordBox) {
    wordBox.classList.toggle("answerCorrect", explain.answerResult === "correct")
    wordBox.classList.toggle("answerWrong", explain.answerResult === "wrong")

    if (!currentNumber) {
      wordBox.innerText = "—"
    } else {
      wordBox.innerText =
        explain.currentWord ||
        getPresenterExplainWord(currentNumber) ||
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
    grid.innerHTML = Array.from({ length: count }, (_, i) => i + 1).map(num => {
      const isUsed = used.includes(num)
      const isCurrent = currentNumber === num
      const disabled = isUsed || !!currentNumber || revealLock

      return `
        <button
          type="button"
          class="presenterNumberBtn presenterExplainNumberCard ${isUsed ? "used presenterOpened" : ""} ${isCurrent ? "active selectedPresenterTeam" : ""}"
          ${disabled ? "disabled" : ""}
          onclick="openExplainPresenterNumber(${num})"
        >
          <span>${num}</span>
        </button>
      `
    }).join("")
  }

  document
    .querySelectorAll(".presenterExplainActions .presenterBtn")
    .forEach(btn => {
      btn.disabled = !currentNumber || revealLock
    })
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

presenterFinalCorrect

async function presenterFinalWrong() {
  const round = getPresenterFinalRound()

  if (round === 1) {
    setPresenterFinalRound1FocusMode(false)
  }

  await sendCommand("wrong")

  resetPresenterFinalLocalChoice(round)

  setTimeout(() => {
    refreshPresenterFinalFromState()
    refreshPresenterEnhancements()
  }, 300)
}

async function presenterFinalWrong() {
  const round = getPresenterFinalRound()

  if (round === 1) {
    setPresenterFinalRound1FocusMode(false)
    presenterFinalSelected = { round: 1, number: null }
  }

  await sendCommand("wrong")

  resetPresenterFinalLocalChoice(round)

  setTimeout(() => {
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
  if (type === "scramble") {
    await sendCommand("recordScrambleScore")
  }

  if (type === "sequence") {
    await sendCommand("recordSequenceScore")
  }

  if (type === "image") {
    await sendCommand("recordImageScore")
  }

  resetPresenterFinalLocalChoice(2)

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
        <button class="presenterBtn gray" onclick="sendCommand('double')">دبل</button>
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
          دبل
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

    controlsBox.innerHTML = `
      <div class="presenterFinalControlsGrid">
        <button class="presenterBtn gray" onclick="sendCommand('double')">
          دبل
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
          دبل
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

  const activeTeam = presenterSelectedTeam || null

  document.getElementById("teamA")?.classList.toggle(
    "selectedPresenterTeam",
    activeTeam === "A"
  )

  document.getElementById("teamB")?.classList.toggle(
    "selectedPresenterTeam",
    activeTeam === "B"
  )

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
  if (round === 3) await renderPresenterFinalRound3Preview()
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

  const activeTeam = getPresenterFinalTeamForRound(round)

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
  if (round === 3) renderPresenterFinalRound3Preview()
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
            onclick="sendCommand('toggleRound2Correct',{index:${idx}})"
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
    presenterFinalSelected?.number ||
    0
  )

  const baseSelected =
    presenterFinalRound2ImageLocalSelection.number === currentNumber &&
    Date.now() < presenterFinalRound2ImageLocalSelection.expires
      ? [...presenterFinalRound2ImageLocalSelection.indexes]
      : Array.isArray(state.selectedCorrectIndexes)
        ? [...state.selectedCorrectIndexes]
        : []

  const i = Number(index)

  const nextSelected = baseSelected.includes(i)
    ? baseSelected.filter(x => Number(x) !== i)
    : [...baseSelected, i]

  presenterFinalRound2ImageLocalSelection = {
    number: currentNumber,
    indexes: nextSelected,
    expires: Date.now() + 15000
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
    index: i
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
  const selected =
  presenterFinalRound2ImageLocalSelection.number === Number(current) &&
  Date.now() < presenterFinalRound2ImageLocalSelection.expires
    ? presenterFinalRound2ImageLocalSelection.indexes
    : (state.selectedCorrectIndexes || [])

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
        <div class="presenterFinalPreviewLabel">الصور</div>
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
                class="presenterFinalAnswerCard ${selected.includes(idx) ? "selectedCorrect" : ""}"
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
  let answer = state.currentAnswer || ""

  if (!parts.length && !answer) {
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

      answer = data.answer || ""
    }
  }

  const shownPart = Number(state.shownPart || 0)
  const currentPoints = Number(state.currentPoints || 0)

  presenterFinalPreviewCache[3] = `
    <div class="presenterFinalStoryPreview presenterFinalStoryWidePreview">

      <div class="presenterFinalPreviewBlock answerBlock presenterFinalStoryAnswerSide">
        <div class="presenterFinalPreviewLabel">
          الإجابة ${currentPoints ? `- ${currentPoints} نقاط` : ""}
        </div>

        <div class="presenterFinalPreviewText answerText">
          ${presenterSafeHtml(answer || "لا توجد إجابة")}
        </div>
      </div>

      <div class="presenterFinalPreviewBlock questionBlock presenterFinalStoryPartsSide">
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

    </div>
  `

  previewBox.innerHTML = presenterFinalPreviewCache[3]
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
   ARCHIVE
========================= */

let presenterArchiveRows = []
let presenterArchiveBox = null
let presenterArchiveLoadedRound = null

function getPresenterArchiveRoot() {
  return presenterLiveState?.archive || {}
}

function getPresenterArchiveState() {
  return getPresenterArchiveRoot()?.archiveState || {
    round: 1,
    scores: { A: 0, B: 0 },
    activeTeam: null,
    errors: {}
  }
}

function getPresenterArchiveMaxRound() {
  return Number(getPresenterArchiveRoot()?.archiveMaxRound || 4)
}

function getPresenterArchiveRound() {
  return Number(getPresenterArchiveState()?.round || 1)
}

function getPresenterArchiveReveal() {
  return getPresenterArchiveRoot()?.archiveRevealState || {}
}

function getPresenterArchiveRoundReveal(round = getPresenterArchiveRound()) {
  return getPresenterArchiveReveal()?.[round] || {}
}

function getPresenterArchiveRemainingPoints() {
  return Number(getPresenterArchiveRoot()?.archiveRemainingPoints || 0)
}

async function loadPresenterArchiveRound(round) {
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

async function renderArchive() {
  const panel = document.getElementById("presenterPanel")
  if (!panel) return

  const round = getPresenterArchiveRound()
  const reveal = getPresenterArchiveRoundReveal(round)
  const remainingPoints = getPresenterArchiveRemainingPoints()

  await loadPresenterArchiveRound(round)

  const requiredItems = presenterArchiveRows
    .filter(item => String(item.label || "").trim() === "المطلوب")
    .sort((a, b) => Number(a.position) - Number(b.position))

  panel.innerHTML = `
    ${teamButtons()}

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
        ${
          requiredItems.length
            ? requiredItems.map(item => {
                const position = Number(item.position)
                const opened = !!reveal[position]

                return `
                  <button
                    class="presenterArchiveRequiredItem ${opened ? "opened" : ""}"
                    onclick="sendCommand('showAnswer')"
                    ${opened ? "disabled" : ""}
                  >
                    ${item.text || "المطلوب"}
                  </button>
                `
              }).join("")
            : `<div class="presenterArchiveEmpty">لا يوجد مطلوب</div>`
        }
      </div>

    </section>

    <div class="presenterActions">
      <button class="presenterBtn dark" onclick="sendCommand('startTimer')">
        بدء المؤقت
      </button>

      <button class="presenterBtn gray" onclick="sendCommand('double')">
        دوبيلا
      </button>

      <button class="presenterBtn red" onclick="sendCommand('wrong')">
        خطأ
      </button>
    </div>

    <div class="presenterActions">
      <button class="presenterBtn green" onclick="sendCommand('showAnswer')">
        إظهار الإجابة
      </button>

      <button class="presenterBtn gray" onclick="sendCommand('undo')">
        تراجع
      </button>

      <button class="presenterBtn blue" onclick="sendCommand('nextRound')">
        الجولة التالية
      </button>
    </div>
  `
}

async function refreshPresenterArchiveFromState() {
  if (presenterSegment !== "archive") return

  const archive = getPresenterArchiveState()
  const round = getPresenterArchiveRound()

  if (presenterArchiveLoadedRound !== round) {
    await loadPresenterArchiveRound(round)
  }

  const reveal = getPresenterArchiveRoundReveal(round)
  const remainingPoints = getPresenterArchiveRemainingPoints()
  const activeTeam = archive.activeTeam || presenterSelectedTeam || null

  document.getElementById("teamA")?.classList.toggle(
    "selectedPresenterTeam",
    activeTeam === "A"
  )

  document.getElementById("teamB")?.classList.toggle(
    "selectedPresenterTeam",
    activeTeam === "B"
  )

  const roundText = document.getElementById("presenterArchiveRoundText")
  if (roundText) roundText.innerText = round

  const scoreBox = document.querySelector(".presenterArchiveSimpleScore strong")
  if (scoreBox) scoreBox.innerText = remainingPoints

  const requiredItems = presenterArchiveRows
    .filter(item => String(item.label || "").trim() === "المطلوب")
    .sort((a, b) => Number(a.position) - Number(b.position))

  const list = document.querySelector(".presenterArchiveRequiredList")

  if (list) {
    list.innerHTML = requiredItems.length
      ? requiredItems.map(item => {
          const position = Number(item.position)
          const opened = !!reveal[position]

          return `
            <button
              class="presenterArchiveRequiredItem ${opened ? "opened" : ""}"
              onclick="sendCommand('showAnswer')"
              ${opened ? "disabled" : ""}
            >
              ${item.text || "المطلوب"}
            </button>
          `
        }).join("")
      : `<div class="presenterArchiveEmpty">لا يوجد مطلوب</div>`
  }

  const doubleBtn = document.querySelector(
    `.presenterActions .presenterBtn.gray[onclick="sendCommand('double')"]`
  )

  if (doubleBtn) doubleBtn.disabled = !activeTeam
}

function setPresenterArchiveRound(round) {
  const maxRound = getPresenterArchiveMaxRound()
  const safeRound = Math.min(Math.max(Number(round || 1), 1), maxRound)

  sendCommand("setRound", { round: safeRound })
}