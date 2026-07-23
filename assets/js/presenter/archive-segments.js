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

async function loadPresenterArchiveRound(
  round,
  options = {}
) {
  const model = Number(presenterModel || 0)
  const safeRound = Number(round || 1)

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
    : { box: null, rows: [] }

  presenterArchiveBox = payload.box || null
  presenterArchiveRows =
    Array.isArray(payload.rows) ? payload.rows : []

  if (hasPayload) {
    presenterArchiveLoadedRound = safeRound
    presenterArchiveLoadedModel = model
  }

  if (result.error && !hasPayload) {
    console.log(
      "LOAD PRESENTER ARCHIVE ERROR:",
      result.error
    )
  }

  return payload
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
