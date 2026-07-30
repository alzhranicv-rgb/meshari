/* =========================
   ARCHIVE / الأرشيف
========================= */

let presenterArchiveRows = []
let presenterArchiveBox = null
let presenterArchiveLoadedRound = null
let presenterArchiveLoadedModel = null

const PRESENTER_ARCHIVE_CACHE_TTL = 10 * 60 * 1000

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

  const count = Number(
    root?.archiveMaxRound ||
    window.archiveMaxRound ||
    localStorage.getItem("archive_max_round") ||
    4
  )

  return Math.min(Math.max(count, 1), 4)
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

function getPresenterArchiveTimerSync() {
  const root = getPresenterArchiveRoot()

  return (
    root?.archiveTimerSync ||
    root?.archiveState?.timerSync ||
    null
  )
}

function getPresenterArchiveTimerValue() {
  const timerSync = getPresenterArchiveTimerSync()

  if (
    timerSync &&
    Number(timerSync.endsAt || 0) > Date.now()
  ) {
    return Math.max(
      0,
      Math.ceil((Number(timerSync.endsAt) - Date.now()) / 1000)
    )
  }

  const root = getPresenterArchiveRoot()

  return Number(
    root?.timerValue ||
    root?.archiveState?.timerValue ||
    30
  )
}

function isPresenterArchiveTimerRunning() {
  const timerSync = getPresenterArchiveTimerSync()

  return !!(
    timerSync &&
    Number(timerSync.endsAt || 0) > Date.now()
  )
}

function getPresenterArchiveDoubleState() {
  const root = getPresenterArchiveRoot()

  return root?.archiveDoubleState || {
    used: { A: false, B: false },
    activeTeam: null
  }
}

function getPresenterArchiveRoundErrors(round = getPresenterArchiveRound()) {
  const state = getPresenterArchiveState()
  const errors = state.errors || {}

  return errors?.[round] || {
    A: 0,
    B: 0
  }
}

function isPresenterArchiveRoundFinished(round = getPresenterArchiveRound()) {
  const reveal = getPresenterArchiveRoundReveal(round)
  const rows = presenterArchiveRows || []

  if (!rows.length) return false

  return rows.every(row => {
    return !!reveal[Number(row.position)]
  })
}

function canPresenterArchiveUseDouble() {
  const team = getPresenterArchiveActiveTeam()
  const doubleState = getPresenterArchiveDoubleState()

  if (!team) return false
  if (doubleState.activeTeam === team) return false
  if (doubleState.used?.[team]) return false
  if (doubleState.used?.A && doubleState.used?.B) return false

  return true
}

function canPresenterArchiveWrong() {
  const team = getPresenterArchiveActiveTeam()
  const round = getPresenterArchiveRound()
  const errors = getPresenterArchiveRoundErrors(round)

  if (!team) return false

  return Number(errors?.[team] || 0) < 3
}

function getPresenterArchiveRequiredItems() {
  return presenterArchiveRows
    .filter(item => String(item.label || "").trim() === "المطلوب")
    .sort((a, b) => Number(a.position) - Number(b.position))
}

async function loadPresenterArchiveRound(
  round,
  options = {}
) {
  const model = Number(
    presenterModel ||
    localStorage.getItem("game_model") ||
    0
  )

  const safeRound = Number(round || 1)

  if (!model || !safeRound) {
    presenterArchiveBox = null
    presenterArchiveRows = []
    presenterArchiveLoadedRound = safeRound
    presenterArchiveLoadedModel = model

    return {
      box: null,
      rows: []
    }
  }

  if (
    presenterArchiveLoadedModel === model &&
    presenterArchiveLoadedRound === safeRound &&
    options.forceRefresh !== true
  ) {
    return {
      box: presenterArchiveBox,
      rows: presenterArchiveRows
    }
  }

  const result = await loadPresenterCachedResource({
    cacheKey: getPresenterResourceCacheKey(
      "archive_round",
      [model, safeRound]
    ),
    ttl: PRESENTER_ARCHIVE_CACHE_TTL,
    forceRefresh: options.forceRefresh === true,
    staleWhileRevalidate:
      options.staleWhileRevalidate !== false,
    fetcher: async () => {
      const [boxResult, itemsResult] =
        await Promise.all([
          db
            .from("archive_boxes")
            .select("*")
            .eq("model", model)
            .eq("round", safeRound)
            .limit(1),

          db
            .from("archive_items")
            .select("*")
            .eq("model", model)
            .eq("round", safeRound)
            .order("position", { ascending: true })
        ])

      return {
        data: {
          box: boxResult.data?.[0] || null,
          rows: itemsResult.data || []
        },
        error: boxResult.error || itemsResult.error || null
      }
    }
  })

  const hasPayload =
    result.data &&
    typeof result.data === "object"

  const payload = hasPayload
    ? result.data
    : {
        box: null,
        rows: []
      }

  presenterArchiveBox = payload.box || null
  presenterArchiveRows =
    Array.isArray(payload.rows)
      ? payload.rows
      : []

  presenterArchiveLoadedRound = safeRound
  presenterArchiveLoadedModel = model

  if (result.error && !presenterArchiveRows.length) {
    console.log(
      "LOAD PRESENTER ARCHIVE ERROR:",
      result.error
    )
  }

  return {
    box: presenterArchiveBox,
    rows: presenterArchiveRows
  }
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
  const timerValue = getPresenterArchiveTimerValue()

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
            المؤقت ${timerValue}
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

  startPresenterArchiveTimerWatcher()
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
  const timerValue = getPresenterArchiveTimerValue()
  const timerRunning = isPresenterArchiveTimerRunning()
  const maxRound = getPresenterArchiveMaxRound()
  const roundFinished = isPresenterArchiveRoundFinished(round)

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
  const showAnswerBtn = document.querySelector(".presenterArchiveShowAnswerBtn")
  const nextBtn = document.querySelector(".presenterArchiveNextRoundBtn")

  if (doubleBtn) {
    const doubleState = getPresenterArchiveDoubleState()

    doubleBtn.disabled = !canPresenterArchiveUseDouble()

    if (activeTeam && doubleState.activeTeam === activeTeam) {
      doubleBtn.innerText = "الدوبيلا مفعّل"
    } else if (activeTeam && doubleState.used?.[activeTeam]) {
      doubleBtn.innerText = "استخدم الدوبيلا"
    } else {
      doubleBtn.innerText = "دوبيلا"
    }
  }

  if (wrongBtn) {
    wrongBtn.disabled = !canPresenterArchiveWrong()
  }

  if (timerBtn) {
    timerBtn.disabled = timerRunning
    timerBtn.innerText = timerRunning
      ? `المؤقت ${timerValue}`
      : "بدء المؤقت"
  }

  if (showAnswerBtn) {
    showAnswerBtn.disabled = !activeTeam
  }

  if (nextBtn) {
    nextBtn.disabled =
      round >= maxRound ||
      !roundFinished
  }
}

let presenterArchiveTimerWatcher = null

function startPresenterArchiveTimerWatcher() {
  clearInterval(presenterArchiveTimerWatcher)

  presenterArchiveTimerWatcher = setInterval(() => {
    if (presenterSegment !== "archive") return

    const timerBtn = document.querySelector(".presenterArchiveStartTimerBtn")
    if (!timerBtn) return

    const timerValue = getPresenterArchiveTimerValue()
    const timerRunning = isPresenterArchiveTimerRunning()

    timerBtn.disabled = timerRunning
    timerBtn.innerText = timerRunning
      ? `المؤقت ${timerValue}`
      : "بدء المؤقت"
  }, 500)
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
