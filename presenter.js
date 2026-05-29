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
const ALL_PRESENTER_SEGMENTS = [
  { key: "warmup", title: "التسخين", sort: 1 },
  { key: "top10", title: "Top 10", sort: 2 },
  { key: "auction", title: "فتبلة", sort: 3 },
  { key: "who", title: "من هو", sort: 4 },
  { key: "explain", title: "اشرح الكلمة", sort: 5 },
  { key: "final", title: "صح صحلي", sort: 6 },
  { key: "archive", title: "الأرشيف", sort: 7 }
]

let presenterVisibleSegments = ALL_PRESENTER_SEGMENTS
  .filter(item => item.sort <= 6)
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

function getPresenterSegmentName(segment) {
  const item = ALL_PRESENTER_SEGMENTS.find(x => x.key === segment)
  return item?.title || "لوحة المقدم"
}
async function loadPresenterVisibleSegments() {
  presenterVisibleSegments = ALL_PRESENTER_SEGMENTS
    .filter(item => item.sort <= 6)
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
      is_visible: item.sort <= 6,
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
    .sort((a, b) => Number(a.sort_order || a.sort) - Number(b.sort_order || b.sort))
    .slice(0, 6)

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

    return `
      <button
        type="button"
        class="segmentCard presenterSegmentCard ${locked ? "presenterLockedSegment" : ""}"
        data-segment="${item.key}"
        onclick="openPresenterSegment('${item.key}')"
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

function applyPresenterSessionData(data) {
  if (!data) return

  if (data.status === "ended") {
    renderPresenterEnded()
    return
  }

  const nextSegment = data.active_segment || null
  const segmentChanged = presenterSegment !== nextSegment
  const oldSessionId = presenterSessionId

  presenterSessionId = data.id
  presenterModel = Number(data.model || 1)
  presenterTeamAName = data.team_a || "الفريق الأول"
  presenterTeamBName = data.team_b || "الفريق الثاني"
  presenterLiveState = data.state || {}

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

    const newSegment = data.active_segment || null
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

  openPresenterSegmentFromSync(segment)

  const sent = await sendCommand("openSegment", { segment })

  if (!sent) {
    showToast("تعذر فتح الفقرة في العرض")
  }
}

async function openPresenterSegmentFromSync(segment) {
  const panel = document.getElementById("presenterPanel")
  const currentRendered = panel?.dataset.segment

  if (currentRendered === segment) {
    if (segment === "warmup") {
      refreshPresenterWarmupFromState()
    }

    if (segment === "top10") {
      refreshPresenterTop10FromState()
    }

    if (segment === "auction") {
      refreshPresenterAuctionFromState()
    }

    if (segment === "who") {
      refreshPresenterWhoFromState()
    }

    if (segment === "explain") {
  refreshPresenterExplainFromState()
}

    if (segment === "archive") {
      refreshPresenterArchiveFromState()
    }

    if (segment === "final") {
      refreshPresenterFinalFromState()
    }

    if (typeof refreshPresenterEnhancements === "function") {
      refreshPresenterEnhancements()
    }

    return
  }

  showPresenterSegmentPage()

  const title = document.getElementById("presenterSegmentTitle")

  if (title) {
    title.innerText = getPresenterSegmentName(segment)
  }

  if (panel) {
    panel.dataset.segment = segment

    panel.innerHTML = `
      <section class="presenterCard">
        <div class="presenterLabel">جارٍ التحميل...</div>
      </section>
    `
  }

  try {
if (segment === "warmup") {
  await renderWarmup()
} else if (segment === "top10") {
  await renderTop10()
} else if (segment === "auction") {
  await renderAuction()
} else if (segment === "who") {
  await renderWho()
} else if (segment === "explain") {
  await renderExplain()
} else if (segment === "final") {
  await renderFinal()
} else if (segment === "archive") {
  await renderArchive()
} else {
  renderPresenterHome()
}

    if (typeof refreshPresenterEnhancements === "function") {
      refreshPresenterEnhancements()
    }

  } catch (e) {
    console.log("Presenter render error:", e)

    if (panel) {
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

  if (presenterSegment === "final") {
    const round = presenterLiveState?.final?.round || presenterFinalRound || 1

    if (round === 1) return presenterLiveState?.final?.round1?.activeTeam || null
    if (round === 2) return presenterLiveState?.final?.round2?.activeTeam || null
    if (round === 3) return presenterLiveState?.final?.round3?.activeTeam || null
  }

  if (presenterSegment === "archive") {
    return presenterLiveState?.archive?.archiveState?.activeTeam || null
  }

  return presenterSelectedTeam
}

function teamButtons() {
  const activeTeam = getPresenterActiveTeamFromState() || presenterSelectedTeam

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

  document.getElementById("teamA")?.classList.toggle("selectedPresenterTeam", team === "A")
  document.getElementById("teamB")?.classList.toggle("selectedPresenterTeam", team === "B")
  document.getElementById("teamA")?.classList.toggle("activeTeam", team === "A")
  document.getElementById("teamB")?.classList.toggle("activeTeam", team === "B")

  sendCommand("selectTeam", { team })

  if (presenterSegment === "final") {
    renderPresenterFinalRoundContent()
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

      <!-- اليسار: الفئات + الفرق + التحكم -->
      <div class="presenterWarmupLeft">

        <section class="presenterCard presenterNumbersCard presenterWarmupNumbersCard">
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

        <div class="presenterWarmupBottom">
          ${teamButtons()}

          <div
  class="presenterWarmupActions"
  style="
    display:grid;
    grid-template-columns:repeat(3, 1fr);
    gap:6px;
    width:100%;
  "
>
  <button
    class="presenterBtn gray presenterDoubleBtn"
    style="
      height:42px;
      min-height:42px;
      border-radius:14px;
      font-size:.86rem;
      padding:5px;
      grid-column:auto;
    "
    onclick="sendCommand('double')"
    ${locked || currentKey ? "disabled" : ""}
  >
    دوبيلا
  </button>

  <button
    class="presenterBtn red presenterWrongBtn"
    style="
      height:42px;
      min-height:42px;
      border-radius:14px;
      font-size:.86rem;
      padding:5px;
      grid-column:auto;
    "
    onclick="sendCommand('wrong')"
  >
    ✕ خطأ
  </button>

  <button
    class="presenterBtn green presenterCorrectBtn"
    style="
      height:42px;
      min-height:42px;
      border-radius:14px;
      font-size:.86rem;
      padding:5px;
      grid-column:auto;
    "
    onclick="sendCommand('correct')"
  >
    ✓ صح
  </button>
</div>
        </div>

      </div>

      <!-- اليمين: السؤال + الإجابة -->
      <div class="presenterWarmupRight">

        <section class="presenterCard presenterWarmupPreviewCard presenterMainPreviewCard">
          <div class="presenterLabel">السؤال</div>

          <div id="presenterWarmupQuestionText" class="presenterQuestionBody presenterBigQuestionBody">
            اختر رقم السؤال
          </div>

          <div class="presenterLabel answerLabel">الإجابة</div>

          <div id="presenterWarmupAnswerText" class="presenterAnswerBody presenterBigAnswerBody">
            —
          </div>
        </section>

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
    `.presenterActions .presenterBtn.gray[onclick="sendCommand('double')"]`
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

  panel.innerHTML = `
    ${teamButtons()}

    <section class="presenterCard presenterTop10StatusCard">

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

    <section class="presenterCard">
      <div class="presenterLabel">الإجابات</div>

      <div class="presenterTop10Answers">
        ${Array.from({ length: 10 }, (_, i) => i + 1).map(num => {
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
        }).join("")}
      </div>
    </section>

    <div class="presenterActions">
      <button class="presenterBtn gray" onclick="sendCommand('double')">
        دوبيلا
      </button>

      <button class="presenterBtn green" onclick="sendCommand('showAnswer')">
        إظهار الإجابات
      </button>

      <button class="presenterBtn red" onclick="sendCommand('wrong')">
        خطأ الفريق
      </button>
    </div>

    <div class="presenterActions">
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
    .select("number, answer, image")
    .eq("model", presenterModel)
    .order("number", { ascending: true })

  presenterAuctionRows = data || []

  panel.innerHTML = `
    ${teamButtons()}

    <section class="presenterCard presenterAuctionPreviewCard">
      <div class="presenterLabel">الإجابة</div>

      <div id="presenterAuctionAnswerText" class="presenterAnswerBody">
        —
      </div>

      <div class="presenterLabel">الصورة</div>

      <div id="presenterAuctionImageBox" class="presenterImagePreviewBox hidden"></div>
    </section>

    <section class="presenterCard">
      <div class="presenterLabel">الأرقام</div>

      <div class="presenterGrid four" id="presenterAuctionGrid">
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

    <div class="presenterActions">
      <button
        class="presenterBtn gray"
        onclick="sendCommand('double')"
        ${currentNumber || pendingScore ? "disabled" : ""}
      >
        دوبيلا
      </button>

      <button class="presenterBtn green" onclick="sendCommand('correct')">
        ✓ إجابة صحيحة
      </button>

      <button class="presenterBtn red" onclick="sendCommand('wrong')">
        ✕ خطأ
      </button>
    </div>

    <div class="presenterActions">
      <button class="presenterBtn blue" onclick="sendCommand('zoomImage')">
        تكبير الصورة
      </button>

      <button class="presenterBtn gray" onclick="sendCommand('undo')">
        تراجع
      </button>
    </div>
  `

  if (currentNumber) {
    refreshPresenterAuctionFromState()
  }
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
  sendCommand("openNumber", { number })
}

function showPresenterAuctionPreview(number) {
  const item = presenterAuctionRows.find(row => Number(row.number) === Number(number))

  const answerBox = document.getElementById("presenterAuctionAnswerText")
  const imageBox = document.getElementById("presenterAuctionImageBox")

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
    auctionRoot.currentAuctionImage ||
    auctionRoot.image ||
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

  const doubleBtn = document.querySelector(
    `.presenterActions .presenterBtn.gray[onclick="sendCommand('double')"]`
  )

  if (doubleBtn) {
    doubleBtn.disabled = !!currentNumber || !!pendingScore
  }
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
    .select("number, answer, image")
    .eq("model", presenterModel)
    .order("number", { ascending: true })

  presenterWhoRows = data || []

  panel.innerHTML = `
    ${teamButtons()}

    <section class="presenterCard">
      <div class="presenterLabel">النقاط</div>

      <div class="presenterGrid">
        ${[1, 2, 3, 4, 5].map(p => `
          <button
            class="presenterNumberBtn ${currentPoints === p ? "selectedPresenterTeam" : ""}"
            ${locked || compensationMode ? "disabled" : ""}
            onclick="sendCommand('setPoints',{points:${p}})"
          >
            ${p}
          </button>
        `).join("")}
      </div>
    </section>

    <section class="presenterCard presenterWhoPreviewCard">
      <div class="presenterLabel">الإجابة</div>

      <div id="presenterWhoAnswerText" class="presenterAnswerBody">
        —
      </div>

      <div class="presenterLabel">الصورة</div>

      <div id="presenterWhoImageBox" class="presenterImagePreviewBox hidden"></div>
    </section>

    <section class="presenterCard">
      <div class="presenterLabel">الأرقام</div>

      <div class="presenterGrid">
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

    <div class="presenterActions">
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
    </div>

    <div class="presenterActions">
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

  document.querySelectorAll(".presenterGrid .presenterNumberBtn").forEach(btn => {
    const onclick = btn.getAttribute("onclick") || ""
    const pointsMatch = onclick.match(/setPoints.*points:(\d+)/)
    const numberMatch = onclick.match(/openWhoPresenterNumber\((\d+)\)/)

    if (pointsMatch) {
      const p = Number(pointsMatch[1])

      btn.classList.toggle("selectedPresenterTeam", currentPoints === p)
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
  const activeTeam = getPresenterExplainCurrentTeam()
  const revealLock = !!explain.revealLock

  panel.innerHTML = `
    <div class="presenterExplainGameShell explainGameShell">

      <div class="explainTopBoard presenterExplainTopBoard">

        <button
          type="button"
          id="teamA"
          class="explainTeamBox presenterExplainTeamBox ${activeTeam === "A" ? "activeTeam selectedPresenterTeam" : ""}"
          onclick="selectTeam('A')"
        >
          <span class="explainTeamLabel">${presenterTeamAName}</span>
          <strong id="presenterExplainScoreA">${Number(explain.scores?.A || 0)}</strong>
          <small id="presenterExplainAttemptsA">${Number(explain.attempts?.A || 0)}</small>
        </button>

        <div class="explainCenterTitle presenterExplainCenterTitle">
          <h3 id="presenterExplainActiveTeam">
            ${
              activeTeam === "A"
                ? presenterTeamAName
                : activeTeam === "B"
                  ? presenterTeamBName
                  : "اختر الفريق"
            }
          </h3>
        </div>

        <button
          type="button"
          id="teamB"
          class="explainTeamBox presenterExplainTeamBox ${activeTeam === "B" ? "activeTeam selectedPresenterTeam" : ""}"
          onclick="selectTeam('B')"
        >
          <span class="explainTeamLabel">${presenterTeamBName}</span>
          <strong id="presenterExplainScoreB">${Number(explain.scores?.B || 0)}</strong>
          <small id="presenterExplainAttemptsB">${Number(explain.attempts?.B || 0)}</small>
        </button>

      </div>

      <div class="explainNumbersGrid presenterExplainNumbersGrid" id="presenterExplainNumbersGrid">
        ${Array.from({ length: count }, (_, i) => i + 1).map(num => {
          const isUsed = used.includes(num)
          const isCurrent = currentNumber === num
          const disabled = isUsed || !!currentNumber || revealLock

          return `
            <button
              type="button"
              class="explainNumberCard presenterExplainNumberCard ${isUsed ? "used presenterOpened" : ""} ${isCurrent ? "active selectedPresenterTeam" : ""}"
              ${disabled ? "disabled" : ""}
              onclick="openExplainPresenterNumber(${num})"
            >
              <span>${num}</span>
            </button>
          `
        }).join("")}
      </div>

      <div class="explainMainStage presenterExplainMainStage">

        <div
          id="presenterExplainWordText"
          class="explainWordBox presenterExplainWordBox ${explain.answerResult === "correct" ? "answerCorrect" : ""} ${explain.answerResult === "wrong" ? "answerWrong" : ""}"
        >
          ${
            currentNumber
              ? explain.currentWord || getPresenterExplainWord(currentNumber) || "—"
              : ""
          }
        </div>

        <div
          id="presenterExplainTimerText"
          class="explainTimerBox presenterExplainTimerBox ${explain.timerVisible ? "" : "hidden"} ${explain.timerVisible && Number(explain.timeLeft || 45) <= 5 ? "danger presenterTimerDanger" : ""}"
        >
          ${Number(explain.timeLeft || 45)}
        </div>

      </div>

      <div class="explainControls presenterExplainControls">

        <button
          type="button"
          class="explainControlBtn explainStartBtn"
          onclick="sendCommand('startTimer')"
          ${!currentNumber || revealLock ? "disabled" : ""}
        >
          بدء المؤقت
        </button>

        <button
          type="button"
          class="explainControlBtn explainCorrectBtn"
          onclick="sendCommand('correct')"
          ${!currentNumber || revealLock ? "disabled" : ""}
        >
          صح
        </button>

        <button
          type="button"
          class="explainControlBtn explainWrongBtn"
          onclick="sendCommand('wrong')"
          ${!currentNumber || revealLock ? "disabled" : ""}
        >
          خطأ
        </button>

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
  const scoreA = document.getElementById("presenterExplainScoreA")
  const scoreB = document.getElementById("presenterExplainScoreB")
  const attemptsA = document.getElementById("presenterExplainAttemptsA")
  const attemptsB = document.getElementById("presenterExplainAttemptsB")
  const activeTeamBox = document.getElementById("presenterExplainActiveTeam")
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

  if (scoreA) scoreA.innerText = Number(explain.scores?.A || 0)
  if (scoreB) scoreB.innerText = Number(explain.scores?.B || 0)
  if (attemptsA) attemptsA.innerText = Number(explain.attempts?.A || 0)
  if (attemptsB) attemptsB.innerText = Number(explain.attempts?.B || 0)

  if (activeTeamBox) {
    activeTeamBox.innerText =
      activeTeam === "A"
        ? presenterTeamAName
        : activeTeam === "B"
          ? presenterTeamBName
          : "اختر الفريق"
  }

  /*
    مهم:
    هنا الكلمة تبقى ظاهرة للمقدم دائمًا
    حتى لو explain.wordVisible صار false في شاشة العرض
  */
  if (wordBox) {
    wordBox.classList.toggle("hasWord", !!currentNumber)
    wordBox.classList.toggle("emptyWord", !currentNumber)
    wordBox.classList.toggle("answerCorrect", explain.answerResult === "correct")
    wordBox.classList.toggle("answerWrong", explain.answerResult === "wrong")

    if (!currentNumber) {
      wordBox.innerText = ""
    } else {
      wordBox.innerText =
        explain.currentWord ||
        getPresenterExplainWord(currentNumber) ||
        "—"
    }
  }

  if (timerBox) {
    timerBox.innerText = Number(explain.timeLeft || 45)
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
          class="explainNumberCard presenterExplainNumberCard ${isUsed ? "used presenterOpened" : ""} ${isCurrent ? "active selectedPresenterTeam" : ""}"
          ${disabled ? "disabled" : ""}
          onclick="openExplainPresenterNumber(${num})"
        >
          <span>${num}</span>
        </button>
      `
    }).join("")
  }

  document
    .querySelectorAll(".presenterExplainControls .explainControlBtn")
    .forEach(btn => {
      btn.disabled = !currentNumber || revealLock
    })
}

/* =========================
   FINAL
========================= */

let presenterFinalRound1Rows = []
let presenterFinalRound2Rows = []
let presenterFinalRound3Rows = []

let presenterFinalSelected = { round: 1, number: null }

let presenterFinalPreviewCache = {
  1: "",
  2: "",
  3: ""
}

let presenterFinalRound1FocusMode = false

function getPresenterFinalState() {
  return presenterLiveState?.final || { round: 1 }
}

function getPresenterFinalRound() {
  return Number(getPresenterFinalState()?.round || presenterFinalRound || 1)
}

function getPresenterFinalRoundState(round = getPresenterFinalRound()) {
  const state = getPresenterFinalState()

  if (round === 1) return state.round1 || {}
  if (round === 2) return state.round2 || {}
  if (round === 3) return state.round3 || {}

  return {}
}

function isPresenterFinalRound3TeamMedia() {
  const state = getPresenterFinalRoundState(3)
  return state?.mode === "team_media"
}

function getPresenterFinalRound3TeamMediaState() {
  const state = getPresenterFinalRoundState(3)

  return state.teamMedia || {
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
    videoPlayed: false
  }
}

function clearPresenterFinalPreview(round = presenterFinalRound) {
  presenterFinalPreviewCache[round] = ""
  presenterFinalSelected = { round, number: null }

  const previewBox = document.getElementById("presenterFinalPreview")
  if (previewBox) previewBox.innerHTML = "اختر رقمًا"
}

/* =========================
   FINAL HELPERS
========================= */

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

async function presenterFinalCorrect() {
  const round = getPresenterFinalRound()

  if (round === 1) {
    setPresenterFinalRound1FocusMode(false)
    presenterFinalSelected = { round: 1, number: null }
  }

  await sendCommand("stopCurrentFinalVideo")
  await sendCommand("correct")

  setTimeout(() => {
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

  setTimeout(() => {
    refreshPresenterEnhancements()
  }, 300)
}

/* =========================
   RENDER FINAL
========================= */

async function renderFinal() {
  const panel = document.getElementById("presenterPanel")
  if (!panel) return

  presenterFinalRound = getPresenterFinalRound()

  panel.innerHTML = `
    <div class="presenterFinalLayout">

      <div class="presenterFinalTeamsArea">
        ${teamButtons()}
      </div>

      <section class="presenterCard presenterFinalPreviewCard">
        <div class="presenterFinalRoundHeader">
          <span>الجولة الحالية</span>
          <strong id="presenterFinalRoundText">${presenterFinalRound}</strong>
        </div>

        <div id="presenterFinalPreview" class="presenterFinalPreviewBox">
          ${presenterFinalPreviewCache[presenterFinalRound] || "اختر رقمًا"}
        </div>
      </section>

      <section class="presenterCard presenterFinalNumbersCard">
        <div class="presenterLabel">الأرقام</div>
        <div class="presenterGrid" id="presenterFinalNumbers"></div>
      </section>

      <div id="presenterFinalControls" class="presenterFinalControlsArea"></div>

    </div>
  `

  await renderPresenterFinalRoundContent()
  refreshPresenterEnhancements()
}

async function setPresenterFinalRound(round) {
  presenterFinalRound = Number(round)
  presenterFinalSelected = { round: presenterFinalRound, number: null }

  setPresenterFinalRound1FocusMode(false)

  sendCommand("setRound", { round: presenterFinalRound })
  await renderPresenterFinalRoundContent()
  refreshPresenterEnhancements()
}

/* =========================
   ROUND CONTENT
========================= */

async function renderPresenterFinalRoundContent() {
  const numbersBox = document.getElementById("presenterFinalNumbers")
  const controlsBox = document.getElementById("presenterFinalControls")
  const previewBox = document.getElementById("presenterFinalPreview")

  if (!numbersBox || !controlsBox || !previewBox) return

  const round = Number(presenterFinalRound || 1)
  const state = getPresenterFinalRoundState(round)

  const isTeamMedia = round === 3 && isPresenterFinalRound3TeamMedia()
  const teamMediaState = getPresenterFinalRound3TeamMediaState()

  let nums = [1, 2, 3, 4, 5, 6]
  if (round === 2) nums = [1, 2, 3, 4]
  if (round === 3) nums = isTeamMedia ? [1, 2, 3, 4] : [1, 2]

  const openedNumbers = isTeamMedia
    ? (teamMediaState.usedNumbers || [])
    : (state.opened || [])

  const selectedNumber =
    Number(isTeamMedia ? teamMediaState.currentNumber : state.currentNumber || 0) ||
    (
      presenterFinalSelected?.round === round
        ? Number(presenterFinalSelected.number || 0)
        : 0
    )

  const pendingScore = !!state.pendingScore || !!teamMediaState.currentNumber

  numbersBox.innerHTML = nums.map(n => {
    const opened = openedNumbers.includes(n)
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
  } else {
    previewBox.innerHTML = presenterFinalPreviewCache[round] || "اختر رقمًا"
  }

  controlsBox.dataset.round = String(round)

if (round === 1) {
  controlsBox.innerHTML = `
    <div class="presenterActions presenterFinalRound1TwoRows">
      <button class="presenterBtn gray" onclick="sendCommand('double')">
        دبل
      </button>

      <button class="presenterBtn blue" onclick="sendCommand('showQuestion')">
        إظهار السؤال
      </button>

      <button class="presenterBtn blue" onclick="sendCommand('zoomImage')">
        تكبير
      </button>

      <button class="presenterBtn green" onclick="presenterFinalCorrect()">
        إجابة صحيحة
      </button>

      <button class="presenterBtn red" onclick="presenterFinalWrong()">
        خطأ
      </button>

      <button class="presenterBtn gray" onclick="sendCommand('undo')">
        تراجع
      </button>

      <button class="presenterBtn blue" onclick="sendCommand('nextRound')">
        الجولة التالية
      </button>
    </div>
  `

  refreshPresenterFinalControlsOnly(1)
  refreshPresenterEnhancements()
  return
}

  if (round === 2) {
    const finalCurrentNumber = Number(
      state.currentNumber ||
      (
        presenterFinalSelected?.round === 2
          ? presenterFinalSelected.number
          : 0
      )
    )

    const isScrambleNumber = finalCurrentNumber === 1 || finalCurrentNumber === 3
    const isSequenceNumber = finalCurrentNumber === 2 || finalCurrentNumber === 4

    controlsBox.innerHTML = `
      <div class="presenterActions finalTwoActions">
        <button class="presenterBtn gray" onclick="sendCommand('double')">
          دبل
        </button>

        <button class="presenterBtn dark" onclick="sendCommand('decreaseCountdown')">
          ${isSequenceNumber ? `العداد ${state.countdown ?? 15}` : "العداد"}
        </button>
      </div>

      <div class="presenterActions">
        <button
          class="presenterBtn green"
          onclick="clearPresenterFinalPreview(2); sendCommand('recordScrambleScore')"
          ${(!finalCurrentNumber || isSequenceNumber) ? "disabled" : ""}
        >
          تسجيل المبعثرة
        </button>

        <button
          class="presenterBtn green"
          onclick="clearPresenterFinalPreview(2); sendCommand('recordSequenceScore')"
          ${(!finalCurrentNumber || isScrambleNumber) ? "disabled" : ""}
        >
          تسجيل التلميح
        </button>
      </div>

      <div class="presenterActions">
        <button class="presenterBtn gray" onclick="sendCommand('undo')">
          تراجع
        </button>

        <button class="presenterBtn blue" onclick="sendCommand('nextRound')">
          الجولة التالية
        </button>
      </div>
    `

    refreshPresenterFinalControlsOnly(2)
    refreshPresenterEnhancements()
    return
  }

  if (isTeamMedia) {
    const hasCurrent = !!teamMediaState.currentNumber
    const isVideo = teamMediaState.currentMediaType === "video"

    controlsBox.innerHTML = `
      <div class="presenterActions">
        <button
          class="presenterBtn blue"
          onclick="sendCommand('showQuestion')"
          ${hasCurrent && teamMediaState.currentQuestion ? "" : "disabled"}
        >
          إظهار السؤال
        </button>

        <button
          class="presenterBtn dark presenterPlayVideoBtn"
          onclick="presenterPlayCurrentFinalVideo()"
          ${hasCurrent && isVideo ? "" : "disabled"}
        >
          تشغيل الفيديو
        </button>
      </div>

      <div class="presenterActions">
        <button
          class="presenterBtn blue"
          onclick="presenterRestartCurrentFinalVideo()"
          ${hasCurrent && isVideo ? "" : "disabled"}
        >
          إعادة تشغيل الفيديو
        </button>

        <button
          class="presenterBtn green"
          onclick="clearPresenterFinalPreview(3); presenterFinalCorrect()"
          ${hasCurrent ? "" : "disabled"}
        >
          إجابة صحيحة
        </button>
      </div>

      <div class="presenterActions">
        <button
          class="presenterBtn red"
          onclick="presenterFinalWrong()"
          ${hasCurrent ? "" : "disabled"}
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

  controlsBox.innerHTML = `
    <div class="presenterActions">
      <button class="presenterBtn gray" onclick="sendCommand('double')">
        دبل
      </button>

      <button class="presenterBtn dark" onclick="sendCommand('startSequence')">
        بدء عرض الصور
      </button>
    </div>

    <div class="presenterActions">
      <button class="presenterBtn blue" onclick="sendCommand('zoomImage')">
        تكبير الصورة
      </button>

      <button
        class="presenterBtn green"
        onclick="clearPresenterFinalPreview(3); sendCommand('recordRound3Score')"
        ${!Number(state.currentNumber || 0) ? "disabled" : ""}
      >
        تسجيل النتيجة
      </button>
    </div>

    <div class="presenterActions">
      <button class="presenterBtn gray" onclick="sendCommand('undo')">
        تراجع
      </button>
    </div>
  `

  refreshPresenterFinalControlsOnly(3)
  refreshPresenterEnhancements()
}

/* =========================
   REFRESH FINAL
========================= */

async function refreshPresenterFinalFromState() {
  if (presenterSegment !== "final") return

  const round = getPresenterFinalRound()
  presenterFinalRound = round

  const activeTeam = getPresenterActiveTeamFromState() || presenterSelectedTeam || null

  document.getElementById("teamA")?.classList.toggle(
    "selectedPresenterTeam",
    activeTeam === "A"
  )

  document.getElementById("teamB")?.classList.toggle(
    "selectedPresenterTeam",
    activeTeam === "B"
  )

  const roundText = document.getElementById("presenterFinalRoundText")
  if (roundText) roundText.innerText = round

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
  const numbersBox = document.getElementById("presenterFinalNumbers")
  if (!numbersBox) return

  const state = getPresenterFinalRoundState(round)
  const isTeamMedia = round === 3 && isPresenterFinalRound3TeamMedia()
  const teamMediaState = getPresenterFinalRound3TeamMediaState()

  let nums = [1, 2, 3, 4, 5, 6]
  if (round === 2) nums = [1, 2, 3, 4]
  if (round === 3) nums = isTeamMedia ? [1, 2, 3, 4] : [1, 2]

  const openedNumbers = isTeamMedia
    ? (teamMediaState.usedNumbers || [])
    : (state.opened || [])

  const selectedNumber =
    Number(isTeamMedia ? teamMediaState.currentNumber : state.currentNumber || 0) ||
    (
      presenterFinalSelected?.round === round
        ? Number(presenterFinalSelected.number || 0)
        : 0
    )

  const pendingScore = !!state.pendingScore || !!teamMediaState.currentNumber

  numbersBox.innerHTML = nums.map(n => {
    const opened = openedNumbers.includes(n)
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
  const previewBox = document.getElementById("presenterFinalPreview")
  if (!previewBox) return

  const state = getPresenterFinalRoundState(round)
  const isTeamMedia = round === 3 && isPresenterFinalRound3TeamMedia()
  const teamMediaState = getPresenterFinalRound3TeamMediaState()

  const currentNumber =
    Number(isTeamMedia ? teamMediaState.currentNumber : state.currentNumber || 0) ||
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
}

function refreshPresenterFinalControlsOnly(round) {
  const controlsBox = document.getElementById("presenterFinalControls")
  if (!controlsBox) return

  const state = getPresenterFinalRoundState(round)
  const allButtons = [...controlsBox.querySelectorAll(".presenterBtn")]

  if (round === 1) {
    const currentNumber = Number(state.currentNumber || 0)
    const isQuestionCard = currentNumber >= 4 && currentNumber <= 6

    const showQuestionBtn = allButtons.find(btn =>
      (btn.getAttribute("onclick") || "").includes("showQuestion")
    )

    const correctBtn = allButtons.find(btn =>
      (btn.getAttribute("onclick") || "").includes("presenterFinalCorrect")
    )

    const wrongBtn = allButtons.find(btn =>
      (btn.getAttribute("onclick") || "").includes("presenterFinalWrong")
    )

    if (showQuestionBtn) showQuestionBtn.disabled = !isQuestionCard
    if (correctBtn) correctBtn.disabled = !state.pendingScore
    if (wrongBtn) wrongBtn.disabled = !state.pendingScore

    return
  }

  if (round === 2) {
    const currentNumber = Number(state.currentNumber || 0)
    const isScrambleNumber = currentNumber === 1 || currentNumber === 3
    const isSequenceNumber = currentNumber === 2 || currentNumber === 4

    const countdownBtn = allButtons.find(btn =>
      (btn.getAttribute("onclick") || "").includes("decreaseCountdown")
    )

    const scrambleBtn = allButtons.find(btn =>
      (btn.getAttribute("onclick") || "").includes("recordScrambleScore")
    )

    const sequenceBtn = allButtons.find(btn =>
      (btn.getAttribute("onclick") || "").includes("recordSequenceScore")
    )

    if (countdownBtn) {
      countdownBtn.disabled = !isSequenceNumber
      countdownBtn.innerText = isSequenceNumber
        ? `العداد ${state.countdown ?? 15}`
        : "العداد"
    }

    if (scrambleBtn) scrambleBtn.disabled = !currentNumber || isSequenceNumber
    if (sequenceBtn) sequenceBtn.disabled = !currentNumber || isScrambleNumber

    return
  }

  if (round === 3) {
    const isTeamMedia = isPresenterFinalRound3TeamMedia()
    const teamMediaState = getPresenterFinalRound3TeamMediaState()

    if (isTeamMedia) {
  const hasCurrent = !!teamMediaState.currentNumber
  const isVideo = teamMediaState.currentMediaType === "video"
  const questionShown = !!teamMediaState.questionShown
  const answerShown = !!teamMediaState.answerShown
  const videoPlayed = !!teamMediaState.videoPlayed

  allButtons.forEach(btn => {
    const onclick = btn.getAttribute("onclick") || ""

    if (onclick.includes("showQuestion")) {
      btn.disabled = !(
        hasCurrent &&
        teamMediaState.currentQuestion &&
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

    if (onclick.includes("presenterRestartCurrentFinalVideo")) {
      btn.disabled = !(
        hasCurrent &&
        isVideo &&
        !questionShown &&
        !answerShown
      )
    }

    if (onclick.includes("presenterFinalCorrect")) {
      btn.disabled = !hasCurrent || answerShown
    }

    if (onclick.includes("presenterFinalWrong")) {
      btn.disabled = !hasCurrent || answerShown
    }
  })

  return
}

    const currentNumber = Number(state.currentNumber || 0)

    const recordBtn = allButtons.find(btn =>
      (btn.getAttribute("onclick") || "").includes("recordRound3Score")
    )

    if (recordBtn) recordBtn.disabled = !currentNumber
  }
}

/* =========================
   OPEN FINAL NUMBER
========================= */

function openPresenterFinalNumber(round, number) {
  const state = getPresenterFinalRoundState(round)
  const isTeamMedia = round === 3 && isPresenterFinalRound3TeamMedia()
  const teamMediaState = getPresenterFinalRound3TeamMediaState()

  const openedNumbers = isTeamMedia
    ? (teamMediaState.usedNumbers || [])
    : (state.opened || [])

  if (state.pendingScore || teamMediaState.currentNumber) {
    showToast("أنهِ الرقم الحالي أولاً")
    return
  }

  if (openedNumbers.includes(number)) {
    showToast("الرقم مستخدم")
    return
  }

  presenterFinalSelected = { round, number }

  if (round === 1) {
    setPresenterFinalRound1FocusMode(true)
    renderPresenterFinalRound1Preview()
  }

  if (round === 2) renderPresenterFinalRound2Preview()
  if (round === 3) renderPresenterFinalRound3Preview()

  sendCommand("openNumber", { round, number })

  if (round === 1) {
    setPresenterFinalRound1FocusMode(true)
    document.body.classList.add("presenterFinalRound1FocusMode")
  }
}

/* =========================
   ROUND 1 PREVIEW
========================= */

async function renderPresenterFinalRound1Preview() {
  const previewBox = document.getElementById("presenterFinalPreview")
  if (!previewBox) return

  const state = getPresenterFinalRoundState(1)

  const current = Number(
    state.currentNumber ||
    (presenterFinalSelected?.round === 1 ? presenterFinalSelected.number : 0)
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
      <div class="presenterFinalCleanPreview">
        <div class="presenterFinalPreviewNumber">الرقم ${current}</div>

        <div class="presenterFinalPreviewBlock presenterFinalAnswerOnlyBig">
          <div class="presenterFinalPreviewLabel">الإجابة</div>
          <div class="presenterFinalPreviewText">لا توجد بيانات لهذا الرقم</div>
        </div>
      </div>
    `

    previewBox.innerHTML = presenterFinalPreviewCache[1]
    return
  }

  const questionParts = [
    data.question_part1 || "",
    data.question_part2 || "",
    data.question_part3 || "",
    data.question || ""
  ].filter(Boolean)

  const questionText = questionParts.length
    ? questionParts.join("<br>")
    : "لا يوجد سؤال"

  const answerText = data.answer || "لا توجد إجابة"

  if (current >= 1 && current <= 3) {
    presenterFinalPreviewCache[1] = `
      <div class="presenterFinalCleanPreview presenterFinalAnswerOnlyMode">
        <div class="presenterFinalPreviewNumber">
          الرقم ${current}
        </div>

        <div class="presenterFinalPreviewBlock presenterFinalAnswerOnlyBig">
          <div class="presenterFinalPreviewLabel">الإجابة</div>

          <div class="presenterFinalPreviewText presenterFinalAnswerOnlyText">
            ${answerText}
          </div>
        </div>
      </div>
    `

    previewBox.innerHTML = presenterFinalPreviewCache[1]
    return
  }

  presenterFinalPreviewCache[1] = `
    <div class="presenterFinalCleanPreview">
      <div class="presenterFinalPreviewNumber">
        الرقم ${current}
      </div>

      <div class="presenterFinalPreviewBlock">
        <div class="presenterFinalPreviewLabel">السؤال</div>

        <div class="presenterFinalPreviewText">
          ${questionText}
        </div>
      </div>

      <div class="presenterFinalPreviewBlock">
        <div class="presenterFinalPreviewLabel">الإجابة</div>

        <div class="presenterFinalPreviewText">
          ${answerText}
        </div>
      </div>
    </div>
  `

  previewBox.innerHTML = presenterFinalPreviewCache[1]
}

/* =========================
   ROUND 2 PREVIEW
========================= */

async function renderPresenterFinalRound2Preview() {
  const previewBox = document.getElementById("presenterFinalPreview")
  if (!previewBox) return

  const state = getPresenterFinalRoundState(2)

  const current = Number(
    state.currentNumber ||
    (presenterFinalSelected?.round === 2 ? presenterFinalSelected.number : 0)
  )

  if (!state.pendingScore && !state.currentNumber && presenterFinalSelected?.round === 2) {
    presenterFinalPreviewCache[2] = ""
    presenterFinalSelected = { round: 2, number: null }
    previewBox.innerHTML = "اختر رقمًا"
    return
  }

  if (!current) {
    previewBox.innerHTML = presenterFinalPreviewCache[2] || "اختر رقمًا"
    return
  }

  const { data } = await db
    .from("final_round2_items")
    .select("*")
    .eq("model", presenterModel)
    .eq("number", current)
    .order("item_order", { ascending: true })

  const rows = data || []
  const isScramble = current === 1 || current === 3

  if (isScramble) {
    const selected = state.selectedCorrectIndexes || []

    presenterFinalPreviewCache[2] = `
      <div class="presenterFinalRound2SimpleGrid">
        ${rows.map((r, idx) => `
          <button
            class="presenterFinalRound2SimpleCard ${selected.includes(idx) ? "selectedCorrect" : ""}"
            type="button"
            onclick="sendCommand('toggleRound2Correct',{index:${idx}})"
          >
            ${r.answer || r.prompt || "-"}
          </button>
        `).join("")}
      </div>
    `
  } else {
    const hidden = state.hiddenSequence || []

    presenterFinalPreviewCache[2] = `
      <div class="presenterAnswerBody">
        العداد: ${state.countdown ?? 15}
      </div>

      <div class="finalRound2WordsStage presenterFinalRound2PreviewStage">
        <div class="finalSequenceWordsWrap">
          ${rows.map((r, idx) => {
            if (hidden.includes(idx)) return ""

            return `
              <button
                class="finalSequenceWordBtn"
                type="button"
                onclick="sendCommand('hideRound2SequenceWord',{index:${idx}})"
              >
                ${r.prompt || r.answer || "-"}
              </button>
            `
          }).join("")}
        </div>
      </div>
    `
  }

  const freshBox = document.getElementById("presenterFinalPreview")
  if (freshBox) freshBox.innerHTML = presenterFinalPreviewCache[2]
}

/* =========================
   ROUND 3 PREVIEW
========================= */

async function renderPresenterFinalRound3Preview() {
  const previewBox = document.getElementById("presenterFinalPreview")
  if (!previewBox) return

  const state = getPresenterFinalRoundState(3)
  const isTeamMedia = isPresenterFinalRound3TeamMedia()
  const teamMediaState = getPresenterFinalRound3TeamMediaState()

  const current = Number(
    isTeamMedia
      ? teamMediaState.currentNumber
      : state.currentNumber ||
        (presenterFinalSelected?.round === 3 ? presenterFinalSelected.number : 0)
  )

  if (!state.pendingScore && !state.currentNumber && !teamMediaState.currentNumber && presenterFinalSelected?.round === 3) {
    presenterFinalPreviewCache[3] = ""
    presenterFinalSelected = { round: 3, number: null }
    previewBox.innerHTML = "اختر رقمًا"
    return
  }

  if (!current) {
    previewBox.innerHTML = presenterFinalPreviewCache[3] || "اختر رقمًا"
    return
  }

  if (isTeamMedia) {
    const { data } = await db
      .from("final_round3_items")
      .select("*")
      .eq("model", presenterModel)
      .eq("number", current)
      .eq("image_order", 1)
      .maybeSingle()

    const mediaType =
      teamMediaState.currentMediaType ||
      (data?.video ? "video" : data?.image ? "image" : "")

    const media =
      teamMediaState.currentMedia ||
      data?.video ||
      data?.image ||
      ""

    const question =
      teamMediaState.currentQuestion ||
      data?.question ||
      ""

    const answer =
      teamMediaState.currentAnswer ||
      data?.answer ||
      ""

    presenterFinalPreviewCache[3] = `
      <div class="presenterFinalTeamMediaPreview">

        <div class="presenterFinalPreviewNumber">
          الرقم ${current}
        </div>

        ${
          media
            ? mediaType === "video"
              ? `
                <div class="presenterImagePreviewBox presenterVideoPreviewBox">
                  <video src="${media}" muted playsinline preload="metadata"></video>
                </div>
              `
              : `
                <div class="presenterImagePreviewBox">
                  <img src="${media}" alt="">
                </div>
              `
            : `
              <div class="presenterAnswerBody">
                لا توجد صورة أو فيديو
              </div>
            `
        }

        <div class="presenterFinalCleanPreview">
          <div class="presenterFinalPreviewBlock">
            <div class="presenterFinalPreviewLabel">السؤال</div>
            <div class="presenterFinalPreviewText">
              ${question || "لا يوجد سؤال"}
            </div>
          </div>

          <div class="presenterFinalPreviewBlock">
            <div class="presenterFinalPreviewLabel">الإجابة</div>
            <div class="presenterFinalPreviewText">
              ${answer || "لا توجد إجابة"}
            </div>
          </div>
        </div>

      </div>
    `

    const freshBox = document.getElementById("presenterFinalPreview")
    if (freshBox) freshBox.innerHTML = presenterFinalPreviewCache[3]
    return
  }

  const { data } = await db
    .from("final_round3_items")
    .select("*")
    .eq("model", presenterModel)
    .eq("number", current)
    .order("image_order", { ascending: true })

  const rows = data || []
  const selected = state.selectedCorrectIndexes || []
  const shownCount = Number(state.shownCount || 0)
  const currentImageIndex = Math.max(0, Math.min(shownCount - 1, rows.length - 1))
  const currentImage = rows[currentImageIndex]?.image || ""

  presenterFinalPreviewCache[3] = `
    <div class="presenterFinalRound3Preview">
      <div class="finalRound3AnswersList">
        ${rows.map((r, idx) => `
          <button
            class="finalRound3AnswerCard ${selected.includes(idx) ? "selectedCorrect" : ""}"
            type="button"
            onclick="sendCommand('toggleRound3Correct',{index:${idx}})"
          >
            ${r.answer || "-"}
          </button>
        `).join("")}
      </div>

      <div class="presenterFinalRound3ImageStage">
        ${
          currentImage
            ? `
              <div class="presenterImagePreviewBox">
                <img src="${currentImage}" alt="">
              </div>
            `
            : `
              <div class="presenterAnswerBody">
                لم تبدأ الصور بعد
              </div>
            `
        }
      </div>
    </div>
  `

  const freshBox = document.getElementById("presenterFinalPreview")
  if (freshBox) freshBox.innerHTML = presenterFinalPreviewCache[3]
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