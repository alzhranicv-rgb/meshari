/* =========================
   1) Constants
========================= */

const BUCKET_NAME = "r3-images"

const ARCHIVE_TEXT_START_POSITION = 5
const ARCHIVE_MAX_TEXT_BOXES = 20

const ALL_GAME_SEGMENTS = [
  { key: "warmup", title: "التسخين", sort: 1 },
  { key: "top10", title: "Top 10", sort: 2 },
  { key: "who", title: "من هو", sort: 3 },
  { key: "explain", title: "اشرح الكلمة", sort: 4 },
  { key: "letterli", title: "حرفلي", sort: 5 },

  { key: "finalRound1", title: "ٮدوں ٮڡاط", sort: 6 },
  { key: "finalRound2", title: "صح صحلي", sort: 7 },
  { key: "finalRound3", title: "قصة", sort: 8 },
  { key: "finalRound4", title: "التركيز", sort: 9 },

  { key: "archive", title: "الأرشيف", sort: 10 },
  { key: "randomChallenge", title: "التحدي", sort: 11 }
]

/* =========================
   2) Global State
========================= */

let currentModel = null
let currentModelName = ""

let currentAdminSegment = ""
let adminNavBusy = false
let adminSavingLock = false

let gameToastTimer = null

let whoAdminCount = 15
let finalRound1AdminCount = 7
let explainAdminCount = 5
let finalRound3AdminCount = 5
let finalRound4AdminCount = 5
let auctionAdminCount = 5

let finalAdminRound = 1

let explainAdminDraft = {}

let top10AdminRoundsCount = 3

let archiveAdminRoundsCount = 4
let archiveAdminRound = 1
let archivePendingExtraCount = 0
let archiveExtraTextPositions = []
let archiveDraftState = {}

let randomChallengeAdminSection = "auction"
let randomChallengeAdminRows = []

let fatblaAdminCount = 5
let fatblaAdminDraft = {}
let fatblaAdminLoaded = false

let globalSegmentVisibilityMap = {}

let adminCompletionCountsCache = null
let adminCompletionCountsCacheModel = null
let adminCompletionCountsCacheTime = 0

let adminVisibilityCacheTime = 0

const ADMIN_COUNTS_CACHE_TTL = 15000
const ADMIN_VISIBILITY_CACHE_TTL = 30000

/* =========================
   3) Initialization
========================= */

async function initAdminPanel() {
  await loadModels()

  currentModel = null
  currentModelName = ""
  currentAdminSegment = ""

  updateAdminBrandModel()
  showAdminModelGate()
}

/* =========================
   4) Toast & Confirm Dialog
========================= */

function showGameToast(message, type = "info") {
  const toast = document.getElementById("gameToast")
  const text = document.getElementById("gameToastText")

  if (!toast || !text) return

  let icon = document.getElementById("gameToastIcon")

  if (!icon) {
    text.insertAdjacentHTML("beforebegin", `<span id="gameToastIcon" class="gameToastIcon"></span>`)

    icon = document.getElementById("gameToastIcon")
  }

  const safeType = ["success", "error", "warning", "info"].includes(type) ? type : "info"

  const icons = {
    success: "✓",
    error: "!",
    warning: "!",
    info: "●"
  }

  toast.classList.remove("success", "error", "warning", "info", "hidden", "show")

  toast.classList.add(safeType)

  if (icon) {
    icon.innerText = icons[safeType]
  }

  text.innerText = String(message || "")

  requestAnimationFrame(() => {
    toast.classList.add("show")
  })

  clearTimeout(gameToastTimer)

  gameToastTimer = setTimeout(() => {
    toast.classList.remove("show")

    setTimeout(() => {
      toast.classList.add("hidden")
    }, 260)
  }, 2400)
}

function showAdminConfirm(message, { title = "تأكيد الإجراء", okText = "موافق", cancelText = "إلغاء", danger = false } = {}) {
  return new Promise((resolve) => {
    document.getElementById("adminConfirmModal")?.remove()

    document.body.insertAdjacentHTML(
      "beforeend",
      `
        <div class="adminConfirmOverlay" id="adminConfirmModal">
          <div class="adminConfirmCard ${danger ? "danger" : ""}">

            <div class="adminConfirmIcon">
              ${danger ? "!" : "؟"}
            </div>

            <div class="adminConfirmContent">
              <h3>${escapeHtml(title)}</h3>
              <p>${escapeHtml(message)}</p>
            </div>

            <div class="adminConfirmActions">

              <button
                type="button"
                class="adminConfirmCancelBtn"
                id="adminConfirmCancelBtn"
              >
                ${escapeHtml(cancelText)}
              </button>

              <button
                type="button"
                class="adminConfirmOkBtn"
                id="adminConfirmOkBtn"
              >
                ${escapeHtml(okText)}
              </button>

            </div>

          </div>
        </div>
      `
    )

    const modal = document.getElementById("adminConfirmModal")
    const cancelBtn = document.getElementById("adminConfirmCancelBtn")
    const okBtn = document.getElementById("adminConfirmOkBtn")

    let resolved = false

    function close(value) {
      if (resolved) return

      resolved = true
      modal?.remove()
      resolve(value)
    }

    cancelBtn?.addEventListener("click", () => {
      close(false)
    })

    okBtn?.addEventListener("click", () => {
      close(true)
    })

    modal?.addEventListener("click", (event) => {
      if (event.target === modal) {
        close(false)
      }
    })
  })
}

/* =========================
   5) Admin Model Access
========================= */

function getAdminModelAccessKey(modelId) {
  return `admin_model_access_${Number(modelId)}`
}

function isAdminModelUnlocked(modelId) {
  const id = Number(modelId || 0)

  if (!id) return false

  try {
    return sessionStorage.getItem(getAdminModelAccessKey(id)) === "1"
  } catch {
    return false
  }
}

function unlockAdminModel(modelId) {
  const id = Number(modelId || 0)

  if (!id) return false

  try {
    sessionStorage.setItem(getAdminModelAccessKey(id), "1")

    return true
  } catch {
    return false
  }
}

function closeAdminPinModal() {
  document.getElementById("adminPinModal")?.remove()
}

function requestAdminPinModal({ title = "الرقم السري", message = "اكتب الرقم السري للنموذج", confirmText = "تأكيد" } = {}) {
  return new Promise((resolve) => {
    closeAdminPinModal()

    document.body.insertAdjacentHTML(
      "beforeend",
      `
        <div class="adminModalOverlay" id="adminPinModal">

          <div class="adminModalCard">

            <div class="adminModalTitle">
              ${escapeHtml(title)}
            </div>

            <div class="adminField">

              <label for="adminModelPinInput">
                ${escapeHtml(message)}
              </label>

              <input
                id="adminModelPinInput"
                class="adminInput"
                type="password"
                inputmode="numeric"
                placeholder="الرقم السري"
                autocomplete="off"
              >

            </div>

            <div class="adminModalActions">

              <button
                type="button"
                class="adminBtn adminBtnLight"
                id="adminPinCancelBtn"
              >
                إلغاء
              </button>

              <button
                type="button"
                class="adminBtn adminBtnMango"
                id="adminPinConfirmBtn"
              >
                ${escapeHtml(confirmText)}
              </button>

            </div>

          </div>

        </div>
      `
    )

    const modal = document.getElementById("adminPinModal")
    const input = document.getElementById("adminModelPinInput")
    const cancelBtn = document.getElementById("adminPinCancelBtn")
    const confirmBtn = document.getElementById("adminPinConfirmBtn")

    let resolved = false

    function close(value) {
      if (resolved) return

      resolved = true
      closeAdminPinModal()
      resolve(value)
    }

    function cancel() {
      close("")
    }

    function confirm() {
      close((input?.value || "").trim())
    }

    cancelBtn?.addEventListener("click", cancel)
    confirmBtn?.addEventListener("click", confirm)

    modal?.addEventListener("click", (event) => {
      if (event.target === modal) {
        cancel()
      }
    })

    input?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault()
        confirm()
      }

      if (event.key === "Escape") {
        event.preventDefault()
        cancel()
      }
    })

    setTimeout(() => {
      input?.focus()
    }, 50)
  })
}

async function requestAdminModelAccess(modelId, fallbackName = "") {
  const id = Number(modelId || 0)

  if (!id) {
    showGameToast("اختر النموذج")
    return null
  }

  if (isAdminModelUnlocked(id)) {
    return {
      id,
      name: fallbackName || `نموذج ${id}`
    }
  }

  const result = await dbSelect("models", (query) => query.eq("id", id).maybeSingle(), {
    select: "id, name, admin_pin",
    fallback: null,
    logLabel: "MODEL PIN READ"
  })

  if (!result.ok || !result.data) {
    showGameToast("تعذر قراءة بيانات النموذج")
    return null
  }

  const data = result.data

  const modelName = data.name || fallbackName || `نموذج ${id}`

  const savedPin = String(data.admin_pin || "").trim()

  if (!savedPin) {
    const newPin = await requestAdminPinModal({
      title: `تأمين ${modelName}`,
      message: "هذا النموذج قديم وما له رقم سري، اكتب رقم سري جديد له",
      confirmText: "حفظ الرقم"
    })

    if (!newPin) {
      showGameToast("لازم تضيف رقم سري للنموذج")
      return null
    }

    const updateResult = await dbUpdate(
      "models",
      {
        admin_pin: newPin
      },
      (query) => query.eq("id", id),
      {
        logLabel: "SAVE OLD MODEL PIN"
      }
    )

    if (!updateResult.ok) {
      console.log("SAVE OLD MODEL PIN ERROR:", updateResult.error)

      showGameToast("تعذر حفظ الرقم السري للنموذج")

      return null
    }

    unlockAdminModel(id)

    showGameToast("تم حفظ الرقم السري للنموذج", "success")

    return {
      id,
      name: modelName
    }
  }

  const enteredPin = await requestAdminPinModal({
    title: `فتح ${modelName}`,
    message: "اكتب الرقم السري الخاص بهذا النموذج",
    confirmText: "فتح النموذج"
  })

  if (!enteredPin) {
    return null
  }

  if (enteredPin !== savedPin) {
    showGameToast("الرقم السري غير صحيح", "error")

    return null
  }

  unlockAdminModel(id)

  return {
    id,
    name: modelName
  }
}

/* =========================
   6) DOM & Text Helpers
========================= */

function editor() {
  return document.getElementById("adminEditor")
}

function tabs() {
  return document.getElementById("adminTabs")
}

function modelGate() {
  return document.getElementById("adminModelGate")
}

function workspace() {
  return document.getElementById("adminWorkspace")
}

function workspaceActions() {
  return document.getElementById("adminWorkspaceActions")
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function hasText(value) {
  return String(value ?? "").trim().length > 0
}

function getCurrentModelNameSafe() {
  if (currentModelName) {
    return currentModelName
  }

  if (currentModel) {
    return `نموذج ${currentModel}`
  }

  return ""
}

/* =========================
   Admin One Page Edit Helpers
========================= */

function isAdminFieldFilled(value) {
  return String(value || "").trim().length > 0
}

function getAdminMissingFieldClass(value) {
  return isAdminFieldFilled(value) ? "" : "adminMissingField"
}

function getAdminItemStatus(completed, total) {
  const done = Number(completed || 0)
  const max = Number(total || 1)
  const isDone = done >= max

  return {
    isDone,
    className: isDone ? "isDone" : "isMissing",
    label: isDone ? "مكتمل" : "ناقص",
    progress: `${done}/${max}`
  }
}

function getWarmupCategoryStatus(categoryNumber) {
  const cat = getWarmupDraftCategory(categoryNumber)

  const fields = [
    cat.category_name,
    cat.questions[1]?.question,
    cat.questions[1]?.answer,
    cat.questions[2]?.question,
    cat.questions[2]?.answer,
    cat.questions[4]?.question,
    cat.questions[4]?.answer
  ]

  const completed = fields.filter(isAdminFieldFilled).length
  return getAdminItemStatus(completed, fields.length)
}

function getWarmupQuestionStatus(categoryNumber, questionNumber) {
  const cat = getWarmupDraftCategory(categoryNumber)
  const row = cat.questions[questionNumber] || {}

  const fields = [row.question, row.answer]

  const completed = fields.filter(isAdminFieldFilled).length
  return getAdminItemStatus(completed, fields.length)
}

/* =========================
   7) Workspace State
========================= */

function showAdminModelGate() {
  modelGate()?.classList.remove("hidden")
  workspace()?.classList.add("hidden")

  const tabsWrap = tabs()

  if (tabsWrap) {
    tabsWrap.classList.add("hidden")
    tabsWrap.innerHTML = ""
  }

  showAdminEmptyState("افتح نموذجًا ثم اختر الفقرة التي تريد تعديلها")
}

function showAdminWorkspace() {
  modelGate()?.classList.add("hidden")
  workspace()?.classList.remove("hidden")
}

function showAdminEmptyState(message = "افتح نموذجًا ثم اختر الفقرة التي تريد تعديلها") {
  const area = editor()

  if (!area) return

  area.innerHTML = `
    <div class="adminEmptyState">
      ${escapeHtml(message)}
    </div>
  `
}

function clearActiveAdminTab() {
  currentAdminSegment = ""
}

function setActiveAdminTab(segment) {
  currentAdminSegment = String(segment || "")
  renderAdminTabsUnified()
}

/* =========================
   8) Workspace Actions
========================= */

function renderAdminHomeActions() {
  const actions = workspaceActions()

  if (!actions) return

  actions.className = "adminWorkspaceActions adminWorkspaceActionsHome"

  actions.innerHTML = `
    <button
      type="button"
      class="adminWorkspaceActionBtn primary"
      onclick="openAdminSegmentSettings()"
    >
      إعدادات الفقرات
    </button>

    <button
      type="button"
      class="adminWorkspaceActionBtn"
      onclick="checkCurrentModelReady()"
    >
      فحص النموذج
    </button>

    <button
      type="button"
      class="adminWorkspaceActionBtn exit"
      onclick="exitCurrentModel()"
    >
      خروج
    </button>
  `
}

function renderAdminSettingsActions() {
  const actions = workspaceActions()

  if (!actions) return

  actions.className = "adminWorkspaceActions adminWorkspaceActionsSettings"

  actions.innerHTML = `
    <button
      type="button"
      class="adminWorkspaceActionBtn primary"
      onclick="saveAdminSegmentSettingsPage()"
    >
      حفظ الإعدادات
    </button>

    <button
      type="button"
      class="adminWorkspaceActionBtn"
      onclick="goAdminHome()"
    >
      رجوع للفقرات
    </button>

    <button
      type="button"
      class="adminWorkspaceActionBtn exit"
      onclick="exitCurrentModel()"
    >
      خروج
    </button>
  `
}

function renderAdminSegmentActions() {
  const actions = workspaceActions()

  if (!actions) return

  actions.className = "adminWorkspaceActions adminWorkspaceActionsSegment"

  actions.innerHTML = `
    <button
      type="button"
      class="adminWorkspaceActionBtn"
      onclick="goAdminHome()"
    >
      رجوع للفقرات
    </button>

    <button
      type="button"
      class="adminWorkspaceActionBtn"
      onclick="checkCurrentModelReady()"
    >
      فحص النموذج
    </button>

    <button
      type="button"
      class="adminWorkspaceActionBtn exit"
      onclick="exitCurrentModel()"
    >
      خروج
    </button>
  `
}

/* =========================
   10) Global Segment Visibility
========================= */

async function loadGlobalSegmentVisibilityMap(
  forceReload = false
) {
  const now = Date.now()

  const hasCachedMap =
    globalSegmentVisibilityMap &&
    Object.keys(
      globalSegmentVisibilityMap
    ).length > 0

  const cacheStillValid =
    now - adminVisibilityCacheTime <
    ADMIN_VISIBILITY_CACHE_TTL

  if (
    !forceReload &&
    hasCachedMap &&
    cacheStillValid
  ) {
    return globalSegmentVisibilityMap
  }

  const defaultMap = {}

  ALL_GAME_SEGMENTS.forEach(
    segment => {
      defaultMap[
        segment.key
      ] = true
    }
  )

  const result = await dbSelect(
    "global_segment_visibility",
    null,
    {
      select:
        "segment_key,is_enabled",
      fallback: [],
      logLabel:
        "LOAD GLOBAL SEGMENT VISIBILITY"
    }
  )

  if (!result.ok) {
    globalSegmentVisibilityMap =
      defaultMap

    adminVisibilityCacheTime =
      Date.now()

    return globalSegmentVisibilityMap
  }

  ;(result.data || []).forEach(
    row => {
      const key =
        String(
          row.segment_key || ""
        ).trim()

      if (!key) return

      defaultMap[key] =
        row.is_enabled !== false
    }
  )

  globalSegmentVisibilityMap =
    defaultMap

  adminVisibilityCacheTime =
    Date.now()

  return globalSegmentVisibilityMap
}

function isAdminSegmentGloballyEnabled(segmentKey, globalMap = null) {
  const map = globalMap || globalSegmentVisibilityMap || {}

  return map[segmentKey] !== false
}

function getVisibleAdminSegments(globalMap = null) {
  const map = globalMap || globalSegmentVisibilityMap || {}

  return ALL_GAME_SEGMENTS.filter((segment) => {
    return isAdminSegmentGloballyEnabled(segment.key, map)
  })
}

function getHiddenAdminSegments(globalMap = null) {
  const map = globalMap || globalSegmentVisibilityMap || {}

  return ALL_GAME_SEGMENTS.filter((segment) => {
    return !isAdminSegmentGloballyEnabled(segment.key, map)
  })
}

async function setGlobalSegmentEnabled(segmentKey, enabled) {
  const key = String(segmentKey || "").trim()

  if (!key) {
    return false
  }

  const segmentTitle = getAdminSegmentTitle(key)

  const confirmed = await showAdminConfirm(
    enabled ? `هل تريد تفعيل فقرة "${segmentTitle}" عام؟` : `هل تريد تعطيل فقرة "${segmentTitle}" عام؟`,
    {
      title: enabled ? "تفعيل الفقرة" : "إخفاء الفقرة",

      okText: enabled ? "تفعيل" : "إخفاء",

      cancelText: "إلغاء",
      danger: !enabled
    }
  )

  if (!confirmed) {
    return false
  }

  try {
    const result = await dbUpsert(
      "global_segment_visibility",
      {
        segment_key: key,
        is_enabled: Boolean(enabled),
        updated_at: new Date().toISOString()
      },
      {
        onConflict: "segment_key",
        logLabel: "SAVE GLOBAL SEGMENT VISIBILITY"
      }
    )

    if (!result.ok) {
      console.log("SAVE GLOBAL SEGMENT VISIBILITY ERROR:", result.error)

      showGameToast("تعذر حفظ حالة الفقرة", "error")

      return false
    }

    adminVisibilityCacheTime = 0

await loadGlobalSegmentVisibilityMap(true)

    showGameToast(enabled ? "تم تفعيل الفقرة" : "تم تعطيل الفقرة", "success")

    return true
  } catch (error) {
    console.log("SAVE GLOBAL SEGMENT VISIBILITY CATCH:", error)

    showGameToast("حدث خطأ أثناء حفظ حالة الفقرة", "error")

    return false
  }
}

async function toggleAdminSegmentVisibility(segmentKey, nextValue) {
  return setGlobalSegmentEnabled(segmentKey, nextValue)
}

/* =========================
   11) Segment Settings Limits
========================= */

function getAdminSettingLimit(segment) {
  const limits = {
    auction: {
      fallback: 5,
      min: 3,
      max: 7,
      allowed: [3, 5, 7]
    },

    who: {
      fallback: 15,
      min: 10,
      max: 15,
      allowed: [10, 12, 15]
    },

    finalRound1: {
      fallback: 7,
      min: 5,
      max: 9,
      allowed: [5, 7, 9]
    },

    explain: {
      fallback: 5,
      min: 5,
      max: 9,
      allowed: [5, 7, 9]
    },

    finalRound3: {
      fallback: 5,
      min: 5,
      max: 9,
      allowed: [5, 7, 9]
    },

    finalRound4: {
      fallback: 5,
      min: 5,
      max: 9,
      allowed: [5, 7, 9]
    }
  }

  return (
    limits[segment] || {
      fallback: 4,
      min: 1,
      max: 8,
      allowed: []
    }
  )
}

function normalizeAdminSegmentCount(segment, value) {
  const limit = getAdminSettingLimit(segment)

  const parsedValue = Number(value)

  const number = Number.isFinite(parsedValue) ? parsedValue : limit.fallback

  if (limit.allowed.length) {
    return limit.allowed.includes(number) ? number : limit.fallback
  }

  return Math.min(Math.max(number, limit.min), limit.max)
}

function normalizeAdminRoundCount(value, fallback = 3, max = 4) {
  const parsedValue = Number(value)

  const number = Number.isFinite(parsedValue) ? parsedValue : fallback

  return Math.min(Math.max(number, 1), max)
}

/* =========================
   12) Segment Round Count
========================= */

async function getSegmentRoundCount(segment, fallback = 3, max = 4) {
  if (!currentModel) {
    return fallback
  }

  const result = await dbSelect(
    "segment_settings",
    (query) => query.eq("model", Number(currentModel)).eq("segment", segment).maybeSingle(),
    {
      select: "item_count",
      fallback: null,
      logLabel: "GET SEGMENT ROUND COUNT"
    }
  )

  if (!result.ok) {
    console.log("GET SEGMENT ROUND COUNT ERROR:", result.error)

    return fallback
  }

  return normalizeAdminRoundCount(result.data?.item_count, fallback, max)
}

async function saveSegmentRoundCount(segment, count) {
  if (!currentModel) {
    return false
  }

  const safeCount = normalizeAdminRoundCount(count, 1, 4)

  const result = await dbUpsert(
    "segment_settings",
    {
      model: Number(currentModel),
      segment,
      item_count: safeCount
    },
    {
      onConflict: "model,segment",
      logLabel: "SAVE SEGMENT ROUND COUNT"
    }
  )

  if (!result.ok) {
    console.log("SAVE SEGMENT ROUND COUNT ERROR:", result.error)

    showGameToast("تعذر حفظ عدد الجولات", "error")

    return false
  }

  return true
}

/* =========================
   13) Segment Item Count
========================= */

async function getAdminSegmentCount(segment) {
  const limit = getAdminSettingLimit(segment)

  if (!currentModel) {
    return limit.fallback
  }

  const result = await dbSelect(
    "segment_settings",
    (query) => query.eq("model", Number(currentModel)).eq("segment", segment).maybeSingle(),
    {
      select: "item_count",
      fallback: null,
      logLabel: "GET ADMIN SEGMENT COUNT"
    }
  )

  if (!result.ok) {
    console.log("GET ADMIN SEGMENT COUNT ERROR:", result.error)

    return limit.fallback
  }

  return normalizeAdminSegmentCount(segment, result.data?.item_count)
}

async function saveAdminSegmentCount(segment, count) {
  if (!currentModel) {
    showGameToast("افتح النموذج أولاً", "warning")

    return false
  }

  const safeCount = normalizeAdminSegmentCount(segment, count)

  const result = await dbUpsert(
    "segment_settings",
    {
      model: Number(currentModel),
      segment,
      item_count: safeCount
    },
    {
      onConflict: "model,segment",
      logLabel: "SAVE ADMIN SEGMENT COUNT"
    }
  )

  if (!result.ok) {
    console.log("SAVE ADMIN SEGMENT COUNT ERROR:", result.error)

    showGameToast("تعذر حفظ إعدادات الفقرة", "error")

    return false
  }

  return true
}

function updateAdminQuickSettingUI(segment, count) {
  const safeCount = normalizeAdminSegmentCount(segment, count)

  if (segment === "auction") {
    auctionAdminCount = safeCount
  }

  if (segment === "who") {
    whoAdminCount = safeCount
  }

  if (segment === "finalRound1") {
    finalRound1AdminCount = safeCount
  }

  if (segment === "explain") {
    explainAdminCount = safeCount
  }

  if (segment === "finalRound3") {
    finalRound3AdminCount = safeCount
  }

  if (segment === "finalRound4") {
    finalRound4AdminCount = safeCount
  }
}

async function setAdminSegmentCount(segment, count) {
  if (isAdminSaving()) {
    return false
  }

  if (!currentModel) {
    showGameToast("افتح النموذج أولاً", "warning")

    return false
  }

  try {
    setAdminSaving(true, "جارٍ حفظ الإعداد...")

    const safeCount = normalizeAdminSegmentCount(segment, count)

    const saved = await saveAdminSegmentCount(segment, safeCount)

    if (!saved) {
      return false
    }

    updateAdminQuickSettingUI(
  segment,
  safeCount
)

invalidateAdminHomeCache()

showGameToast(
  "تم حفظ الإعداد",
  "success"
)

return true

    return true
  } catch (error) {
    console.log("SET ADMIN SEGMENT COUNT ERROR:", error)

    showGameToast("تعذر حفظ الإعداد", "error")

    return false
  } finally {
    setAdminSaving(false)
  }
}

async function runAdminNavigation(task) {
  if (adminNavBusy) {
    return false
  }

  adminNavBusy = true

  try {
    await task()

    return true
  } catch (error) {
    console.log(
      "ADMIN NAVIGATION ERROR:",
      error
    )

    showGameToast(
      "تعذر الانتقال",
      "error"
    )

    return false
  } finally {
    adminNavBusy = false
  }
}

/* =========================
   9) Basic Navigation Helpers
========================= */

function ensureAdminEditorBackButton() {
  return
}

function addAdminBackButtonToEditor() {
  return
}

function toggleAdminQuickSettings() {
  openAdminSegmentSettings()
}

async function buildSegmentStatusGrid() {
  return ""
}

/* =========================
   8) Admin Brand
========================= */

function updateAdminBrandModel() {
  const brandModel = document.getElementById("adminBrandCurrentModel")
  const pill = document.getElementById("adminCurrentModelPill")

  if (!brandModel) return

  if (!currentModel) {
    brandModel.innerText = "لم يتم اختيار نموذج"
    if (pill) pill.classList.remove("hasModel")
    return
  }

  brandModel.innerText = getCurrentModelNameSafe()
  if (pill) pill.classList.add("hasModel")
}

document.addEventListener("click", (e) => {
  const wrap = document.querySelector(".adminMoreMenuWrap")
  const menu = document.getElementById("adminMoreMenu")

  if (!wrap || !menu) return

  if (!wrap.contains(e.target)) {
    menu.classList.add("hidden")
  }
})

/* =========================
   9) Inner Tabs Arrangement
========================= */

function arrangeAdminInnerTabs() {
  const area = editor()
  if (!area) return

  const topBar = area.querySelector(".adminEditorTopBar, .compactAdminEditorTopBar, .archiveAdminTopBar")

  if (!topBar) {
    normalizeAdminEditorCards()
    return
  }

  topBar.classList.add("adminSectionHeaderPro", "adminSectionHeaderInline")

  let toolsRow = topBar.querySelector(".adminSectionToolsRow")

  if (!toolsRow) {
    toolsRow = document.createElement("div")
    toolsRow.className = "adminSectionToolsRow adminSectionToolsRowInline"
    topBar.appendChild(toolsRow)
  }

  toolsRow.innerHTML = ""

  function moveTool(el, className = "") {
    if (!el) return

    el.classList.add("adminMovedTool")

    if (className) {
      className.split(" ").forEach((c) => {
        if (c) el.classList.add(c)
      })
    }

    toolsRow.appendChild(el)
  }

  const warmupTabs = area.querySelector(".warmupCategoryTabs")
  const top10Tabs = area.querySelector(".top10RoundTabs")
  const auctionTabs = area.querySelector(".auctionNumberTabs")
  const whoTabs = area.querySelector(".whoNumberTabs")
  const archiveTabs = area.querySelector(".archiveAdminRoundsBar")
  const archiveActions = area.querySelector(".archiveTopActions")

  if (warmupTabs) {
    topBar.dataset.toolsType = "warmup"
    moveTool(warmupTabs, "adminToolTabs adminToolTabsText")
  }

  if (top10Tabs) {
    topBar.dataset.toolsType = "top10"
    moveTool(top10Tabs, "adminToolTabs adminToolTabsText")
  }

  if (auctionTabs) {
    topBar.dataset.toolsType = "auction"
    moveTool(auctionTabs, "adminToolTabs adminToolNumberTabs")
  }

  if (whoTabs) {
    topBar.dataset.toolsType = "who"
    moveTool(whoTabs, "adminToolTabs adminToolNumberTabs")
  }

  if (archiveTabs || archiveActions) {
    topBar.dataset.toolsType = "archive"
    moveTool(archiveTabs, "adminToolTabs adminToolTabsText")
    moveTool(archiveActions, "adminToolActions")
  }

  area
    .querySelectorAll(
      ".top10RoundCountBox, .auctionCountBox, .whoCountBox, .explainCountBox, .finalTopCompactCountBox, .archiveRoundsControl"
    )
    .forEach((el) => el.remove())

  area
    .querySelectorAll(
      ".top10ControlPanel, .auctionControlPanel, .whoControlPanel, .explainControlPanel, .archiveAdminControlBar, .finalTopCompactRow"
    )
    .forEach((row) => {
      if (!row.children.length) row.remove()
    })

  toolsRow.querySelectorAll("button").forEach((btn) => {
    btn.classList.remove("innerTabActive")

    if (
      btn.classList.contains("activeWarmupCategoryTab") ||
      btn.classList.contains("activeTop10RoundTab") ||
      btn.classList.contains("activeAuctionNumberTab") ||
      btn.classList.contains("activeWhoNumberTab") ||
      btn.classList.contains("activeArchiveRoundBtn")
    ) {
      btn.classList.add("innerTabActive")
    }
  })

  if (!toolsRow.children.length) {
    toolsRow.remove()
  }

  normalizeAdminEditorCards()
}

function normalizeAdminEditorCards() {
  const area = editor()
  if (!area) return

  area.querySelectorAll(".adminCard, .adminQuestionCard, .finalAdminCard, .archiveMainInfoCard, .archiveImageCard").forEach((card) => {
    card.classList.add("adminEditorCleanCard")
  })

  area.querySelectorAll("textarea").forEach((textarea) => {
    textarea.classList.add("adminCleanTextarea")
  })

  area.querySelectorAll("input:not([type='file']), select").forEach((input) => {
    input.classList.add("adminCleanInput")
  })

  area.querySelectorAll("input[type='file']").forEach((input) => {
    input.classList.add("adminCleanFile")
  })
}

/* =========================
   10) Admin Home Counts
========================= */

function invalidateAdminHomeCache() {
  adminCompletionCountsCache = null
  adminCompletionCountsCacheModel = null
  adminCompletionCountsCacheTime = 0
}

async function getAdminCompletionCounts() {
    const now = Date.now()
  const modelId = Number(currentModel || 0)

  if (
    adminCompletionCountsCache &&
    adminCompletionCountsCacheModel === modelId &&
    now - adminCompletionCountsCacheTime <
      ADMIN_COUNTS_CACHE_TTL
  ) {
    return {
      ...adminCompletionCountsCache
    }
  }
  const result = {
    warmup: 0,
    top10: 0,
    auction: 0,
    who: 0,
    explain: 0,
    letterli: 1,

    finalRound1: 0,
    finalRound2: 0,
    finalRound3: 0,
    finalRound4: 0,

    archive: 0,

   randomChallenge: 0,
  randomChallengeTotal: 1,

    top10RoundsCount: 3,
    auctionCount: 5,
    archiveRoundsCount: 4,

    whoCount: 15,
    finalRound1CardsCount: 7,
    explainCount: 5,
    finalRound3Count: 5,
    finalRound4Count: 5
  }

  if (!currentModel) {
    return result
  }


  const [
    qWarmup,
    qTop10,
    qAuction,
    qWho,
    qExplain,

    qFinalRound1,
    qFinalRound2,
    qFinalRound2Images,
    qFinalRound3Story,
    qFinalRound4Focus,
    qArchive,

    qRandomChallenge,
    randomChallengeSettings,

    top10Setting,
    auctionSetting,
    archiveSetting,
    whoSetting,
    finalRound1Setting,
    explainSetting,
    finalRound3Setting,
    finalRound4Setting
  ] = await Promise.all([
    dbSelect("questions", (query) => query.eq("model", modelId).eq("segment", "warmup"), {
      select: "id",
      count: "exact",
      head: true,
      fallback: [],
      logLabel: "ADMIN COMPLETION WARMUP"
    }),

    dbSelect("top10_questions", (query) => query.eq("model", modelId), {
      select: "id",
      count: "exact",
      head: true,
      fallback: [],
      logLabel: "ADMIN COMPLETION TOP10"
    }),

    dbSelect("auction_questions", (query) => query.eq("model", modelId), {
      select: "id",
      count: "exact",
      head: true,
      fallback: [],
      logLabel: "ADMIN COMPLETION AUCTION"
    }),

    dbSelect("who_images", (query) => query.eq("model", modelId), {
      select: "id",
      count: "exact",
      head: true,
      fallback: [],
      logLabel: "ADMIN COMPLETION WHO"
    }),

    dbSelect("explain_words", (query) => query.eq("model", modelId), {
      select: "id",
      count: "exact",
      head: true,
      fallback: [],
      logLabel: "ADMIN COMPLETION EXPLAIN"
    }),

    dbSelect("final_round1_items", (query) => query.eq("model", modelId).gte("number", 1).lte("number", 9), {
      select: "id",
      count: "exact",
      head: true,
      fallback: [],
      logLabel: "ADMIN COMPLETION FINAL ROUND 1"
    }),

    dbSelect("final_round2_items", (query) => query.eq("model", modelId).in("number", [1, 2, 4, 5]), {
      select: "id",
      count: "exact",
      head: true,
      fallback: [],
      logLabel: "ADMIN COMPLETION FINAL ROUND 2"
    }),

    dbSelect("final_round3_items", (query) => query.eq("model", modelId).in("number", [101, 102]), {
      select: "id",
      count: "exact",
      head: true,
      fallback: [],
      logLabel: "ADMIN COMPLETION FINAL ROUND 2 IMAGES"
    }),

    dbSelect("final_round1_items", (query) => query.eq("model", modelId).gte("number", 201).lte("number", 209), {
      select: "id",
      count: "exact",
      head: true,
      fallback: [],
      logLabel: "ADMIN COMPLETION FINAL ROUND 3"
    }),

    dbSelect("final_round3_items", (query) => query.eq("model", modelId).gte("number", 1).lte("number", 9).eq("image_order", 1), {
      select: "id",
      count: "exact",
      head: true,
      fallback: [],
      logLabel: "ADMIN COMPLETION FINAL ROUND 4"
    }),

    dbSelect("archive_boxes", (query) => query.eq("model", modelId), {
      select: "id",
      count: "exact",
      head: true,
      fallback: [],
      logLabel: "ADMIN COMPLETION ARCHIVE"
    }),

    dbSelect(
  "random_challenge_questions",
  query =>
    query.eq(
      "model",
      modelId
    ),
  {
    select: "box_key,number,question,answer",
    fallback: [],
    logLabel:
      "ADMIN COMPLETION RANDOM CHALLENGE"
  }
),

dbSelect(
  "segment_settings",
  query =>
    query
      .eq(
        "model",
        modelId
      )
      .in("segment", [
        "randomChallengeBox1",
        "randomChallengeBox2",
        "randomChallengeBox3",
        "randomChallengeBox4",
        "randomChallengeAuction"
      ]),
  {
    select: "segment,item_count",
    fallback: [],
    logLabel:
      "ADMIN RANDOM CHALLENGE SETTINGS"
  }
),

    dbSelect("segment_settings", (query) => query.eq("model", modelId).eq("segment", "top10").maybeSingle(), {
      select: "item_count",
      fallback: null,
      logLabel: "ADMIN TOP10 SETTING"
    }),

    dbSelect("segment_settings", (query) => query.eq("model", modelId).eq("segment", "auction").maybeSingle(), {
      select: "item_count",
      fallback: null,
      logLabel: "ADMIN AUCTION SETTING"
    }),

    dbSelect("segment_settings", (query) => query.eq("model", modelId).eq("segment", "archive").maybeSingle(), {
      select: "item_count",
      fallback: null,
      logLabel: "ADMIN ARCHIVE SETTING"
    }),

    dbSelect("segment_settings", (query) => query.eq("model", modelId).eq("segment", "who").maybeSingle(), {
      select: "item_count",
      fallback: null,
      logLabel: "ADMIN WHO SETTING"
    }),

    dbSelect("segment_settings", (query) => query.eq("model", modelId).eq("segment", "finalRound1").maybeSingle(), {
      select: "item_count",
      fallback: null,
      logLabel: "ADMIN FINAL ROUND 1 SETTING"
    }),

    dbSelect("segment_settings", (query) => query.eq("model", modelId).eq("segment", "explain").maybeSingle(), {
      select: "item_count",
      fallback: null,
      logLabel: "ADMIN EXPLAIN SETTING"
    }),

    dbSelect("segment_settings", (query) => query.eq("model", modelId).eq("segment", "finalRound3").maybeSingle(), {
      select: "item_count",
      fallback: null,
      logLabel: "ADMIN FINAL ROUND 3 SETTING"
    }),

    dbSelect("segment_settings", (query) => query.eq("model", modelId).eq("segment", "finalRound4").maybeSingle(), {
      select: "item_count",
      fallback: null,
      logLabel: "ADMIN FINAL ROUND 4 SETTING"
    })

    
  ])

  result.warmup = qWarmup.count || 0
  result.top10 = qTop10.count || 0
  result.auction = qAuction.count || 0
  result.who = qWho.count || 0
  result.explain = qExplain.count || 0
  result.finalRound1 = qFinalRound1.count || 0

  result.finalRound2 = Number(qFinalRound2.count || 0) + Number(qFinalRound2Images.count || 0)

  result.finalRound3 = qFinalRound3Story.count || 0

  result.finalRound4 = qFinalRound4Focus.count || 0

  result.archive = qArchive.count || 0
  const randomSettingsMap = {}

;(randomChallengeSettings.data || [])
  .forEach(row => {
    randomSettingsMap[
      String(row.segment)
    ] = Number(row.item_count || 0)
  })

const randomBox2Enabled =
  randomSettingsMap.randomChallengeBox2 !== 0

const randomBox3Enabled =
  randomSettingsMap.randomChallengeBox3 !== 0

const randomBox4Enabled =
  randomSettingsMap.randomChallengeBox4 !== 0

const randomFatblaEnabled =
  randomSettingsMap.randomChallengeAuction !== 0

const randomRows =
  Array.isArray(qRandomChallenge.data)
    ? qRandomChallenge.data
    : []

const randomAuctionDone =
  randomRows.filter(row => {
    return (
      String(row.box_key) === "auction" &&
      Number(row.number) >= 1 &&
      Number(row.number) <= 2 &&
      hasText(row.question) &&
      hasText(row.answer)
    )
  }).length

const randomWhatDoYouKnowDone =
  randomRows.filter(row => {
    return (
      String(row.box_key) === "whatDoYouKnow" &&
      Number(row.number) >= 1 &&
      Number(row.number) <= 2 &&
      hasText(row.question) &&
      hasText(row.answer)
    )
  }).length

const randomTrueFalseDone =
  randomRows.filter(row => {
    return (
      String(row.box_key) === "trueFalse" &&
      Number(row.number) >= 1 &&
      Number(row.number) <= 10 &&
      hasText(row.question) &&
      hasText(row.answer)
    )
  }).length

const randomFatblaRequired =
  normalizeRandomChallengeAuctionCount(
    auctionSetting.data?.item_count || 5
  )

let randomChallengeDone = 0
let randomChallengeTotal = 0

if (randomBox2Enabled) {
  randomChallengeDone +=
    Math.min(randomAuctionDone, 2)

  randomChallengeTotal += 2
}

if (randomBox3Enabled) {
  randomChallengeDone +=
    Math.min(randomWhatDoYouKnowDone, 2)

  randomChallengeTotal += 2
}

if (randomBox4Enabled) {
  randomChallengeDone +=
    Math.min(randomTrueFalseDone, 10)

  randomChallengeTotal += 10
}

if (randomFatblaEnabled) {
  randomChallengeDone +=
    Math.min(
      Number(qAuction.count || 0),
      randomFatblaRequired
    )

  randomChallengeTotal +=
    randomFatblaRequired
}

if (randomChallengeTotal === 0) {
  result.randomChallenge = 1
  result.randomChallengeTotal = 1
} else {
  result.randomChallenge =
    randomChallengeDone

  result.randomChallengeTotal =
    randomChallengeTotal
}

  result.top10RoundsCount = Math.min(Math.max(Number(top10Setting.data?.item_count || 3), 1), 4)

  result.auctionCount = normalizeAdminSegmentCount("auction", auctionSetting.data?.item_count || 5)

  result.archiveRoundsCount = Math.min(Math.max(Number(archiveSetting.data?.item_count || 4), 1), 4)

  result.whoCount = normalizeAdminSegmentCount("who", whoSetting.data?.item_count || 15)

  result.finalRound1CardsCount = normalizeAdminSegmentCount("finalRound1", finalRound1Setting.data?.item_count || 7)

  result.explainCount = normalizeAdminSegmentCount("explain", explainSetting.data?.item_count || 5)

  result.finalRound3Count = normalizeAdminSegmentCount("finalRound3", finalRound3Setting.data?.item_count || 5)

  result.finalRound4Count = normalizeAdminSegmentCount("finalRound4", finalRound4Setting.data?.item_count || 5)

    adminCompletionCountsCache = {
    ...result
  }

  adminCompletionCountsCacheModel =
    modelId

  adminCompletionCountsCacheTime =
    Date.now()

  return result
}

function isSegmentDone(key, count, counts = {}) {
  if (key === "warmup") {
    return count >= 12
  }

  if (key === "top10") {
    const rounds = Math.min(Math.max(Number(counts.top10RoundsCount || 3), 1), 4)

    return count >= rounds * 10
  }

  if (key === "auction") {
    const total = normalizeAdminSegmentCount("auction", counts.auctionCount || 5)

    return count >= total
  }

  if (key === "letterli") {
    return true
  }

  if (key === "who") {
    const total = normalizeAdminSegmentCount("who", counts.whoCount || 15)

    return count >= total
  }

  if (key === "explain") {
    const total = normalizeAdminSegmentCount("explain", counts.explainCount || 5)

    return count >= total
  }

  if (key === "finalRound1") {
    const total = normalizeAdminSegmentCount("finalRound1", counts.finalRound1CardsCount || 7)

    return count >= total
  }

  if (key === "finalRound2") {
    return count >= 34
  }

  if (key === "finalRound3") {
    const total = normalizeAdminSegmentCount("finalRound3", counts.finalRound3Count || 5)

    return count >= total
  }

  if (key === "finalRound4") {
    const total = normalizeAdminSegmentCount("finalRound4", counts.finalRound4Count || 5)

    return count >= total
  }

  if (key === "archive") {
    const rounds = Math.min(Math.max(Number(counts.archiveRoundsCount || 4), 1), 4)

    return count >= rounds
  }

  if (key === "randomChallenge") {
  const total =
    Math.max(
      Number(
        counts.randomChallengeTotal || 1
      ),
      1
    )

  return count >= total
}

  return false
}

/* =========================
   11) Admin Home
========================= */

async function renderAdminHome() {
  const area = editor()
  if (!area) return

  renderAdminHomeActions()
  currentAdminSegment = "home"

  if (!currentModel) {
    area.innerHTML = `
      <div class="adminEmptyState">
        افتح نموذجًا أولاً ثم اختر الفقرة التي تريد تعديلها
      </div>
    `

    await renderAdminTabsUnified()
    return
  }

  await renderAdminTabsUnified()

  const [
  counts,
  visibility
] = await Promise.all([
  getAdminCompletionCounts(),
  loadGlobalSegmentVisibilityMap()
])

  const visibleSegments = getVisibleAdminSegments(visibility).sort((a, b) => {
    return Number(a.sort || 0) - Number(b.sort || 0)
  })

  const readyCount = visibleSegments.filter((segment) => {
    const done = Number(counts[segment.key] || 0)

    return isSegmentDone(segment.key, done, counts)
  }).length

  const enabledCount = visibleSegments.length

  const cards = visibleSegments
    .map((segment) => {
      const key = segment.key

      const title = segment.title || getAdminSegmentTitle(key)

      const rawDone = Number(counts[key] || 0)

      const total = getAdminSegmentRequiredCount(key, counts)

      const done = total > 0 ? Math.min(rawDone, total) : rawDone

      const isRandomChallenge = key === "randomChallenge"

      const isDone = isSegmentDone(key, done, counts)

      const isEnabled = visibility[key] !== false

      const progressText =
  total > 0
    ? `${done}/${total}`
    : String(done)

const progressWidth =
  total > 0
    ? Math.min(
        (done / total) * 100,
        100
      )
    : 0

      const openAction = isRandomChallenge ? "openAdminRandomChallenge()" : `openAdminSegment('${key}')`

      return `
          <div
            class="
              adminHomeSegmentCard
              ${isDone ? "isDone" : ""}
              ${!isEnabled ? "isDisabled" : ""}
            "
            data-segment="${escapeHtml(key)}"
          >
            <button
              type="button"
              class="adminHomeSegmentMain"
              onclick="${openAction}"
            >
              <div class="adminHomeSegmentTop">

                <div class="adminHomeSegmentTitleBox">
                  <div class="adminHomeSegmentTitle">
                    ${escapeHtml(title)}
                  </div>
                </div>

                <span
                  class="
                    adminHomeSegmentStatus
                    ${isDone ? "ready" : "missing"}
                  "
                >
                  ${isDone ? "جاهزة" : "ناقصة"}
                </span>

              </div>

              <div class="adminHomeProgress">

                <div class="adminHomeProgressInfo">
                  <strong>
                    ${escapeHtml(progressText)}
                  </strong>
                </div>

                <div class="adminHomeProgressBar">
                  <span
                    style="width:${progressWidth}%"
                  ></span>
                </div>

              </div>
            </button>
          </div>
        `
    })
    .join("")

  area.innerHTML = `
    <div class="adminHomePro adminHomeClean">

      <section class="adminHomeStats adminHomeStatsClean">

        <div class="adminHomeStatCard">
          <span>الفقرات الجاهزة</span>

          <strong>
            ${readyCount}/${visibleSegments.length}
          </strong>
        </div>

        <div class="adminHomeStatCard">
          <span>الفقرات الظاهرة</span>

          <strong>
            ${enabledCount}/${ALL_GAME_SEGMENTS.length}
          </strong>
        </div>

        <div class="adminHomeStatCard">
          <span>حالة النموذج</span>

          <strong>
            ${readyCount === visibleSegments.length ? "مكتمل" : "قيد التحرير"}
          </strong>
        </div>

      </section>

      <section class="adminHomeSection adminHomeSectionClean">
        <div class="adminHomeSegmentsGrid">
          ${cards}
        </div>
      </section>

    </div>
  `
}

function getAdminSegmentRequiredCount(key, counts = {}) {
  if (key === "warmup") {
    return 12
  }

  if (key === "top10") {
    const rounds = Math.min(Math.max(Number(counts.top10RoundsCount || 3), 1), 4)

    return rounds * 10
  }

  if (key === "auction") {
    return normalizeAdminSegmentCount("auction", counts.auctionCount || 5)
  }

  if (key === "who") {
    return normalizeAdminSegmentCount("who", counts.whoCount || 15)
  }

  if (key === "explain") {
    return normalizeAdminSegmentCount("explain", counts.explainCount || 5)
  }

  if (key === "letterli") {
    return 1
  }

  if (key === "finalRound1") {
    return normalizeAdminSegmentCount("finalRound1", counts.finalRound1CardsCount || 7)
  }

  if (key === "finalRound2") {
    return 34
  }

  if (key === "finalRound3") {
    return normalizeAdminSegmentCount("finalRound3", counts.finalRound3Count || 5)
  }

  if (key === "finalRound4") {
    return normalizeAdminSegmentCount("finalRound4", counts.finalRound4Count || 5)
  }

  if (key === "archive") {
    return Math.min(Math.max(Number(counts.archiveRoundsCount || 4), 1), 4)
  }

  if (key === "randomChallenge") {
  return Math.max(
    Number(
      counts.randomChallengeTotal || 1
    ),
    1
  )
}

  return 0
}

function normalizeRandomChallengeAuctionCount(value) {
  const count = Number(value || 5)

  if (count === 3) return 3
  if (count === 7) return 7

  return 5
}

function getAdminToggleValue(id, fallback = true) {
  const input = document.getElementById(id)

  if (!input) {
    return fallback ? 1 : 0
  }

  return input.value === "1" ? 1 : 0
}

function buildAdminToggleSettingCard({ key, title, desc, inputId, enabled }) {
  const isEnabled = enabled !== false

  return `
    <div class="adminSettingGameCard adminToggleSettingCard ${isEnabled ? "isEnabled" : "isDisabled"}">
      <div class="adminSettingGameHead">
        <div class="adminSettingGameTitleBox">
          <h3>
            ${escapeHtml(title)}
            <span>${escapeHtml(desc)}</span>
          </h3>
        </div>

        <button
          type="button"
          class="adminSettingToggleBtn ${isEnabled ? "active" : ""}"
          onclick="toggleAdminChallengeSetting('${escapeHtml(inputId)}', this)"
        >
          ${isEnabled ? "مفعّل" : "معطّل"}
        </button>
      </div>

      <input
        type="hidden"
        id="${escapeHtml(inputId)}"
        value="${isEnabled ? "1" : "0"}"
        data-segment="${escapeHtml(key)}"
      >
    </div>
  `
}

function toggleAdminChallengeSetting(inputId, button) {
  const input = document.getElementById(inputId)

  if (!input || !button) return

  const enabled = input.value !== "1"

  input.value = enabled ? "1" : "0"

  button.classList.toggle("active", enabled)

  button.innerText = enabled ? "مفعّل" : "معطّل"

  const card = button.closest(".adminToggleSettingCard")

  if (card) {
    card.classList.toggle("isEnabled", enabled)

    card.classList.toggle("isDisabled", !enabled)
  }

  if (inputId === "settingsRandomAuctionEnabled") {
    const auctionCard = document.getElementById("randomChallengeAuctionCard")

    auctionCard?.querySelectorAll(".adminSettingGameOption").forEach((option) => {
      option.disabled = !enabled
    })
  }
}

function buildAdminSettingCardPro({ key, title, desc, inputId, value, options }) {
  return `
    <div class="adminSettingGameCard">
      <div class="adminSettingGameHead">

        <div class="adminSettingGameTitleBox">
          <h3>
            ${escapeHtml(title)}
            <span>${escapeHtml(desc)}</span>
          </h3>
        </div>

        <div class="adminSettingGameSelected">
          <strong>${escapeHtml(String(value))}</strong>
        </div>

      </div>

      <div class="adminSettingGameOptions">
        ${options
          .map(
            (option) => `
          <button
            type="button"
            class="adminSettingGameOption ${Number(value) === Number(option) ? "selected" : ""}"
            onclick="selectAdminSettingOption(
              '${escapeHtml(inputId)}',
              ${Number(option)},
              this
            )"
          >
            ${Number(option)}
          </button>
        `
          )
          .join("")}
      </div>

      <input
        type="hidden"
        id="${escapeHtml(inputId)}"
        value="${escapeHtml(String(value))}"
        data-segment="${escapeHtml(key)}"
      >
    </div>
  `
}

async function openAdminSegmentSettings() {
  if (!currentModel) {
    showGameToast("افتح نموذج أولاً")
    return
  }

  currentAdminSegment = "settings"
  renderAdminSettingsActions()

  await renderAdminTabsUnified()

  const [counts, visibility, challengeSettingsRes] = await Promise.all([
    getAdminCompletionCounts(),

    loadGlobalSegmentVisibilityMap(),

    dbSelect(
      "segment_settings",
      (query) =>
        query
          .eq("model", Number(currentModel))
          .in("segment", [
            "randomChallengeBox1",
            "randomChallengeBox2",
            "randomChallengeBox3",
            "randomChallengeBox4",
            "randomChallengeAuction"
          ]),
      {
        select: "segment,item_count",
        fallback: [],
        logLabel: "LOAD RANDOM CHALLENGE SETTINGS"
      }
    )
  ])

  if (!challengeSettingsRes.ok) {
    console.log("LOAD RANDOM CHALLENGE SETTINGS ERROR:", challengeSettingsRes.error)
  }

  const challengeMap = {}

  ;(challengeSettingsRes.data || []).forEach((row) => {
    challengeMap[row.segment] = Number(row.item_count || 0)
  })

  const challengeSettings = {
    box1: challengeMap.randomChallengeBox1 !== 0,

    box2: challengeMap.randomChallengeBox2 !== 0,

    box3: challengeMap.randomChallengeBox3 !== 0,

    box4: challengeMap.randomChallengeBox4 !== 0,

    auction: challengeMap.randomChallengeAuction !== 0
  }

  const settings = [
    {
      key: "top10",
      title: "Top 10",
      desc: "عدد الجولات",
      inputId: "settingsTop10Rounds",
      value: Math.min(Math.max(Number(counts.top10RoundsCount || 3), 1), 4),
      options: [1, 2, 3, 4]
    },

    {
      key: "who",
      title: "من هو",
      desc: "عدد الأرقام",
      inputId: "settingsWhoCount",
      value: normalizeAdminSegmentCount("who", counts.whoCount || 15),
      options: [10, 12, 15]
    },

    {
      key: "explain",
      title: "اشرح الكلمة",
      desc: "عدد الكلمات",
      inputId: "settingsExplainCount",
      value: normalizeAdminSegmentCount("explain", counts.explainCount || 5),
      options: [5, 7, 9]
    },

    {
      key: "finalRound1",
      title: "ٮدوں ٮڡاط",
      desc: "عدد الأرقام",
      inputId: "settingsFinalRound1Count",
      value: normalizeAdminSegmentCount("finalRound1", counts.finalRound1CardsCount || 7),
      options: [5, 7, 9]
    },

    {
      key: "finalRound3",
      title: "قصة",
      desc: "عدد الأرقام",
      inputId: "settingsFinalRound3Count",
      value: normalizeAdminSegmentCount("finalRound3", counts.finalRound3Count || 5),
      options: [5, 7, 9]
    },

    {
      key: "finalRound4",
      title: "التركيز",
      desc: "عدد الأرقام",
      inputId: "settingsFinalRound4Count",
      value: normalizeAdminSegmentCount("finalRound4", counts.finalRound4Count || 5),
      options: [5, 7, 9]
    },

    {
      key: "archive",
      title: "الأرشيف",
      desc: "عدد الجولات",
      inputId: "settingsArchiveRounds",
      value: Math.min(Math.max(Number(counts.archiveRoundsCount || 4), 1), 4),
      options: [1, 2, 3, 4]
    }
    
  ]

  const visibleSettings = settings.filter((item) => {
    return isAdminSegmentGloballyEnabled(item.key, visibility)
  })

  const auctionCount = normalizeRandomChallengeAuctionCount(counts.auctionCount || 5)

  editor().innerHTML = `
  <div class="adminSettingsGamePage">

    <div class="adminSettingsGameGrid">
      ${visibleSettings.map((item) => buildAdminSettingCardPro(item)).join("")}
    </div>

    <section class="adminChallengeSettingsSection">

      <div class="adminChallengeSettingsHead">
        <div>
          <h2>إعدادات فقرة التحدي</h2>
          <span>فعّل المربعات التي تريد ظهورها داخل الفقرة</span>
        </div>
      </div>

      <div class="adminChallengeSettingsGrid">

        ${buildAdminToggleSettingCard({
          key: "randomChallengeBox1",
          title: "اللاعب المشترك",
          desc: "إظهار أو إخفاء المربع",
          inputId: "settingsRandomBox1Enabled",
          enabled: challengeSettings.box1
        })}

        ${buildAdminToggleSettingCard({
          key: "randomChallengeBox2",
          title: "المزاد",
          desc: "إظهار أو إخفاء المربع",
          inputId: "settingsRandomBox2Enabled",
          enabled: challengeSettings.box2
        })}

        ${buildAdminToggleSettingCard({
          key: "randomChallengeBox3",
          title: "ماذا تعرف",
          desc: "إظهار أو إخفاء المربع",
          inputId: "settingsRandomBox3Enabled",
          enabled: challengeSettings.box3
        })}

        ${buildAdminToggleSettingCard({
          key: "randomChallengeBox4",
          title: "المربع الرابع",
          desc: "إظهار أو إخفاء المربع",
          inputId: "settingsRandomBox4Enabled",
          enabled: challengeSettings.box4
        })}

        <div
          id="randomChallengeAuctionCard"
          class="
            adminSettingGameCard
            adminToggleSettingCard
            adminChallengeAuctionCard
            ${challengeSettings.auction ? "isEnabled" : "isDisabled"}
          "
        >

          <div class="adminSettingGameHead">

            <div class="adminSettingGameTitleBox">
              <h3>
                فتبلة
                <span>تفعيل المربع وتحديد عدد الأرقام</span>
              </h3>
            </div>

            <button
              type="button"
              class="adminSettingToggleBtn ${challengeSettings.auction ? "active" : ""}"
              onclick="toggleAdminChallengeSetting(
                'settingsRandomAuctionEnabled',
                this
              )"
            >
              ${challengeSettings.auction ? "مفعّل" : "معطّل"}
            </button>

          </div>

          <div class="adminChallengeAuctionCount">

            <div class="adminChallengeAuctionCountTitle">
              عدد الأرقام
            </div>

            <div class="adminSettingGameOptions adminChallengeAuctionOptions">
              ${[3, 5, 7]
                .map(
                  (option) => `
                <button
                  type="button"
                  class="adminSettingGameOption ${auctionCount === option ? "selected" : ""}"
                  onclick="selectAdminSettingOption(
                    'settingsAuctionCount',
                    ${option},
                    this
                  )"
                  ${challengeSettings.auction ? "" : "disabled"}
                >
                  ${option}
                </button>
              `
                )
                .join("")}
            </div>

          </div>

          <input
            type="hidden"
            id="settingsRandomAuctionEnabled"
            value="${challengeSettings.auction ? "1" : "0"}"
            data-segment="randomChallengeAuction"
          >

          <input
            type="hidden"
            id="settingsAuctionCount"
            value="${auctionCount}"
            data-segment="auction"
          >

        </div>

      </div>

    </section>

  </div>
`
}

function selectAdminSettingOption(inputId, value, btn) {
  const input = document.getElementById(inputId)
  if (input) input.value = String(value)

  const card = btn.closest(".adminSettingGameCard")
  if (!card) return

  card.querySelectorAll(".adminSettingGameOption").forEach((item) => {
    item.classList.remove("selected")
  })

  btn.classList.add("selected")

  const selected = card.querySelector(".adminSettingGameSelected strong")
  if (selected) selected.innerText = String(value)
}

async function saveAdminSegmentSettingsPage() {
  if (isAdminSaving()) return false

  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")

    return false
  }

  try {
    setAdminSaving(true, "جارٍ حفظ الإعدادات...")

    const rows = [
      {
        model: Number(currentModel),

        segment: "top10",

        item_count: Math.min(Math.max(Number(document.getElementById("settingsTop10Rounds")?.value || 3), 1), 4)
      },

      {
        model: Number(currentModel),
        segment: "auction",
        item_count: normalizeRandomChallengeAuctionCount(document.getElementById("settingsAuctionCount")?.value || 5)
      },

      {
        model: Number(currentModel),
        segment: "randomChallengeBox1",
        item_count: getAdminToggleValue("settingsRandomBox1Enabled")
      },

      {
        model: Number(currentModel),
        segment: "randomChallengeBox2",
        item_count: getAdminToggleValue("settingsRandomBox2Enabled")
      },

      {
        model: Number(currentModel),
        segment: "randomChallengeBox3",
        item_count: getAdminToggleValue("settingsRandomBox3Enabled")
      },

      {
        model: Number(currentModel),
        segment: "randomChallengeBox4",
        item_count: getAdminToggleValue("settingsRandomBox4Enabled")
      },

      {
        model: Number(currentModel),
        segment: "randomChallengeAuction",
        item_count: getAdminToggleValue("settingsRandomAuctionEnabled")
      },

      {
        model: Number(currentModel),

        segment: "who",

        item_count: normalizeAdminSegmentCount("who", document.getElementById("settingsWhoCount")?.value || 15)
      },

      {
        model: Number(currentModel),

        segment: "explain",

        item_count: normalizeAdminSegmentCount("explain", document.getElementById("settingsExplainCount")?.value || 5)
      },

      {
        model: Number(currentModel),

        segment: "finalRound1",

        item_count: normalizeAdminSegmentCount("finalRound1", document.getElementById("settingsFinalRound1Count")?.value || 7)
      },

      {
        model: Number(currentModel),

        segment: "finalRound3",

        item_count: normalizeAdminSegmentCount("finalRound3", document.getElementById("settingsFinalRound3Count")?.value || 5)
      },

      {
        model: Number(currentModel),

        segment: "finalRound4",

        item_count: normalizeAdminSegmentCount("finalRound4", document.getElementById("settingsFinalRound4Count")?.value || 5)
      },

      {
        model: Number(currentModel),

        segment: "archive",

        item_count: Math.min(Math.max(Number(document.getElementById("settingsArchiveRounds")?.value || 4), 1), 4)
      }
    ]

    const result = await dbUpsert("segment_settings", rows, {
      onConflict: "model,segment",
      logLabel: "SAVE ADMIN SEGMENT SETTINGS PAGE"
    })

    if (!result.ok) {
      showGameToast("تعذر حفظ إعدادات الفقرات")

      return false
    }

    top10AdminRoundsCount = rows.find((row) => row.segment === "top10")?.item_count || 3

    auctionAdminCount = rows.find((row) => row.segment === "auction")?.item_count || 5

    whoAdminCount = rows.find((row) => row.segment === "who")?.item_count || 15

    explainAdminCount = rows.find((row) => row.segment === "explain")?.item_count || 5

    finalRound1AdminCount = rows.find((row) => row.segment === "finalRound1")?.item_count || 7

    finalRound3AdminCount = rows.find((row) => row.segment === "finalRound3")?.item_count || 5

    finalRound4AdminCount = rows.find((row) => row.segment === "finalRound4")?.item_count || 5

    archiveAdminRoundsCount = rows.find((row) => row.segment === "archive")?.item_count || 4

    invalidateAdminHomeCache()

showGameToast(
  "تم حفظ إعدادات الفقرات",
  "success"
)

await goAdminHome()

    return true
  } catch (err) {
    console.log("SAVE ADMIN SEGMENT SETTINGS PAGE CATCH:", err)

    showGameToast("حدث خطأ أثناء حفظ الإعدادات")

    return false
  } finally {
    setAdminSaving(false)
  }
}

function getAdminSegmentTitle(key) {
  const found = ALL_GAME_SEGMENTS.find((item) => item.key === key)
  return found?.title || key
}

function getAdminSegmentDescription(key) {
  const map = {
    warmup: "فئات وأسئلة التسخين",
    top10: "جولات Top 10 والإجابات",
    auction: "أسئلة فتبلة والصور",
    who: "صور وإجابات من هو",
    explain: "كلمات اشرح الكلمة",
    finalRound1: "فقرة من بدون نقط",
    finalRound2: "فقرة صح صحلي",
    finalRound3: "فقرة قصة",
    finalRound4: "فقرة التركيز",
    archive: "الأرشيف والجولات",
    randomChallenge: "فقرة التحدي"
  }

  return map[key] || "إدارة محتوى الفقرة"
}

/* =========================
   12) Main Tabs
========================= */

function renderAdminTabsUnified() {
  const wrap = tabs()
  if (!wrap) return

  if (!wrap.classList.contains("hidden")) {
    wrap.classList.add("hidden")
  }

  if (wrap.innerHTML) {
    wrap.innerHTML = ""
  }
}
/* =========================
   13) Readiness Check
========================= */

function readinessItem(title, ok, details = []) {
  return {
    title,
    ok: !!ok,
    details: Array.isArray(details) ? details : [String(details || "")]
  }
}

function closeModelCheckModal() {
  document.getElementById("modelCheckModal")?.remove()
}

function renderModelCheckModal(results) {
  const allOk = results.every((item) => item.ok)

  document.getElementById("modelCheckModal")?.remove()

  document.body.insertAdjacentHTML(
    "beforeend",
    `
    <div class="adminModalOverlay" id="modelCheckModal">
      <div class="adminModalCard modelCheckModalCard">
        <div class="adminModalTitle">
          ${allOk ? "النموذج جاهز للعب" : "تقرير فحص النموذج"}
        </div>

        <div class="modelCheckSummary ${allOk ? "ready" : "notReady"}">
          ${allOk ? "كل الفقرات مكتملة" : "يوجد نواقص تحتاج مراجعة"}
        </div>

        <div class="modelCheckList">
          ${results
            .map(
              (item) => `
            <div class="modelCheckItem ${item.ok ? "ok" : "bad"}">
              <div class="modelCheckItemHead">
                <span class="modelCheckIcon">${item.ok ? "✓" : "!"}</span>
                <strong>${escapeHtml(item.title)}</strong>
              </div>

              ${
                item.details.length
                  ? `<div class="modelCheckDetails">
                      ${item.details
                        .map(
                          (detail) => `
                        <div>${escapeHtml(detail)}</div>
                      `
                        )
                        .join("")}
                    </div>`
                  : ""
              }
            </div>
          `
            )
            .join("")}
        </div>

        <div class="adminModalActions">
          <button type="button" class="adminBtn adminBtnLight" onclick="closeModelCheckModal()">إغلاق</button>
        </div>
      </div>
    </div>
  `
  )

  const modal = document.getElementById("modelCheckModal")

  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModelCheckModal()
    })
  }
}

async function checkCurrentModelReady() {
  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")
    return
  }

  showGameToast("جارٍ فحص النموذج...")

  try {
    const visibility = await loadGlobalSegmentVisibilityMap()
    const results = []

    if (isAdminSegmentGloballyEnabled("warmup", visibility)) {
      results.push(await checkWarmupReady())
    }

    if (isAdminSegmentGloballyEnabled("top10", visibility)) {
      results.push(await checkTop10Ready())
    }

    if (isAdminSegmentGloballyEnabled("who", visibility)) {
      results.push(await checkWhoReady())
    }

    if (isAdminSegmentGloballyEnabled("explain", visibility)) {
      results.push(await checkExplainReady())
    }

    if (isAdminSegmentGloballyEnabled("letterli", visibility)) {
      results.push(checkLetterliReady())
    }

    if (isAdminSegmentGloballyEnabled("finalRound1", visibility)) {
      results.push(await checkFinalRoundReady(1))
    }

    if (isAdminSegmentGloballyEnabled("finalRound2", visibility)) {
      results.push(await checkFinalRoundReady(2))
    }

    if (isAdminSegmentGloballyEnabled("finalRound3", visibility)) {
      results.push(await checkFinalRoundReady(3))
    }

    if (isAdminSegmentGloballyEnabled("finalRound4", visibility)) {
      results.push(await checkFinalRoundReady(4))
    }

    if (isAdminSegmentGloballyEnabled("archive", visibility)) {
      results.push(await checkArchiveReady())
    }

    if (isAdminSegmentGloballyEnabled("randomChallenge", visibility)) {
      results.push(await checkRandomChallengeReady())
    }

    renderModelCheckModal(results)
  } catch (err) {
    console.error("MODEL CHECK ERROR:", err)
    showGameToast("تعذر فحص النموذج")
  }
}
/* =========================
   14) Ready Checks
========================= */

async function checkWarmupReady() {
  const warmupRes = await dbSelect("questions", (query) => query.eq("model", Number(currentModel)).eq("segment", "warmup"), {
    select: "*",
    fallback: [],
    logLabel: "CHECK WARMUP READY"
  })

  if (!warmupRes.ok) {
    console.log(warmupRes.error)

    return readinessItem("التسخين", false, ["تعذر قراءة بيانات التسخين"])
  }

  const data = warmupRes.data
  const map = {}

  ;(data || []).forEach((row) => {
    map[`${Number(row.category)}_${Number(row.number)}`] = row
  })

  const missing = []

  for (let c = 1; c <= 4; c++) {
    for (const n of [1, 2, 4]) {
      const row = map[`${c}_${n}`]

      if (!row) {
        missing.push(`الفئة ${c} - سؤال ${n} غير موجود`)
        continue
      }

      if (!hasText(row.question)) {
        missing.push(`الفئة ${c} - سؤال ${n}: نص السؤال فارغ`)
      }

      if (!hasText(row.answer)) {
        missing.push(`الفئة ${c} - سؤال ${n}: الإجابة فارغة`)
      }
    }
  }

  return readinessItem("التسخين", missing.length === 0, missing.length ? missing : ["12 سؤال مكتملة"])
}

function checkLetterliReady() {
  return readinessItem("حرفلي", true, ["الفقرة جاهزة بأسئلة ثابتة"])
}

async function checkTop10Ready() {
  const maxRound = await getSegmentRoundCount("top10", 3, 4)

  const top10Res = await dbSelect(
    "top10_questions",
    (query) => query.eq("model", Number(currentModel)).order("round", { ascending: true }).order("position", { ascending: true }),
    {
      select: "*",
      fallback: [],
      logLabel: "CHECK TOP10 READY"
    }
  )

  if (!top10Res.ok) {
    console.log(top10Res.error)

    return readinessItem("Top 10", false, ["تعذر قراءة بيانات Top 10"])
  }

  const data = top10Res.data
  const map = {}

  ;(data || []).forEach((row) => {
    map[`${Number(row.round)}_${Number(row.position)}`] = row
  })

  const missing = []

  for (let r = 1; r <= maxRound; r++) {
    for (let i = 1; i <= 10; i++) {
      const row = map[`${r}_${i}`]

      if (!row) {
        missing.push(`الجولة ${r} - الإجابة ${i} غير موجودة`)
        continue
      }

      if (!hasText(row.question)) {
        missing.push(`الجولة ${r}: السؤال الرئيسي فارغ`)
      }

      if (!hasText(row.answer)) {
        missing.push(`الجولة ${r} - الإجابة ${i} فارغة`)
      }
    }
  }

  return readinessItem("Top 10", missing.length === 0, missing.length ? missing : [`مكتمل حسب عدد الجولات: ${maxRound}`])
}

async function checkRandomChallengeReady() {
  const requiredAuctionCount =
    await getAdminSegmentCount("auction")

  const [
    settingsRes,
    auctionRes,
    questionsRes
  ] = await Promise.all([
    dbSelect(
      "segment_settings",
      query =>
        query
          .eq(
            "model",
            Number(currentModel)
          )
          .in("segment", [
            "randomChallengeBox1",
            "randomChallengeBox2",
            "randomChallengeBox3",
            "randomChallengeBox4",
            "randomChallengeAuction"
          ]),
      {
        select: "segment,item_count",
        fallback: [],
        logLabel:
          "CHECK RANDOM CHALLENGE SETTINGS"
      }
    ),

    dbSelect(
      "auction_questions",
      query =>
        query
          .eq(
            "model",
            Number(currentModel)
          )
          .order("number", {
            ascending: true
          }),
      {
        select: "*",
        fallback: [],
        logLabel:
          "CHECK RANDOM CHALLENGE AUCTION"
      }
    ),

    dbSelect(
      "random_challenge_questions",
      query =>
        query
          .eq(
            "model",
            Number(currentModel)
          )
          .order("box_key", {
            ascending: true
          })
          .order("number", {
            ascending: true
          }),
      {
        select:
          "box_key,number,question,answer",
        fallback: [],
        logLabel:
          "CHECK RANDOM CHALLENGE QUESTIONS"
      }
    )
  ])

  if (!settingsRes.ok) {
    console.log(
      "CHECK RANDOM CHALLENGE SETTINGS ERROR:",
      settingsRes.error
    )

    return readinessItem(
      "التحدي",
      false,
      ["تعذر قراءة إعدادات فقرة التحدي"]
    )
  }

  if (!auctionRes.ok) {
    console.log(
      "CHECK RANDOM CHALLENGE AUCTION ERROR:",
      auctionRes.error
    )

    return readinessItem(
      "التحدي",
      false,
      ["تعذر قراءة بيانات فتبلة"]
    )
  }

  if (!questionsRes.ok) {
    console.log(
      "CHECK RANDOM CHALLENGE QUESTIONS ERROR:",
      questionsRes.error
    )

    return readinessItem(
      "التحدي",
      false,
      ["تعذر قراءة أسئلة التحدي"]
    )
  }

  const settingsMap = {}

  ;(settingsRes.data || []).forEach(
    row => {
      settingsMap[
        String(row.segment)
      ] = Number(row.item_count || 0)
    }
  )

  const box1Enabled =
    settingsMap.randomChallengeBox1 !== 0

  const box2Enabled =
    settingsMap.randomChallengeBox2 !== 0

  const box3Enabled =
    settingsMap.randomChallengeBox3 !== 0

  const box4Enabled =
    settingsMap.randomChallengeBox4 !== 0

  const fatblaEnabled =
    settingsMap.randomChallengeAuction !== 0

  const questionRows =
    Array.isArray(questionsRes.data)
      ? questionsRes.data
      : []

  const questionMap = {}

  questionRows.forEach(row => {
    const key =
      `${String(row.box_key)}_${Number(row.number)}`

    questionMap[key] = row
  })

  const missing = []

  if (
    !box1Enabled &&
    !box2Enabled &&
    !box3Enabled &&
    !box4Enabled &&
    !fatblaEnabled
  ) {
    missing.push(
      "لا يوجد أي مربع مفعّل داخل فقرة التحدي"
    )
  }

  /*
    اللاعب المشترك لا يحتاج
    أسئلة من قاعدة البيانات.
  */
  if (box2Enabled) {
    for (let number = 1; number <= 2; number++) {
      const row =
        questionMap[`auction_${number}`]

      if (!row) {
        missing.push(
          `المزاد - السؤال ${number} غير موجود`
        )

        continue
      }

      if (!hasText(row.question)) {
        missing.push(
          `المزاد - السؤال ${number}: نص السؤال فارغ`
        )
      }

      if (!hasText(row.answer)) {
        missing.push(
          `المزاد - السؤال ${number}: الإجابة فارغة`
        )
      }
    }
  }

  if (box3Enabled) {
    for (let number = 1; number <= 2; number++) {
      const row =
        questionMap[
          `whatDoYouKnow_${number}`
        ]

      if (!row) {
        missing.push(
          `ماذا تعرف - السؤال ${number} غير موجود`
        )

        continue
      }

      if (!hasText(row.question)) {
        missing.push(
          `ماذا تعرف - السؤال ${number}: نص السؤال فارغ`
        )
      }

      if (!hasText(row.answer)) {
        missing.push(
          `ماذا تعرف - السؤال ${number}: الإجابة فارغة`
        )
      }
    }
  }

  if (box4Enabled) {
    for (
      let number = 1;
      number <= 10;
      number++
    ) {
      const row =
        questionMap[
          `trueFalse_${number}`
        ]

      if (!row) {
        missing.push(
          `المربع الرابع - العبارة ${number} غير موجودة`
        )

        continue
      }

      if (!hasText(row.question)) {
        missing.push(
          `المربع الرابع - العبارة ${number}: النص فارغ`
        )
      }

      if (!hasText(row.answer)) {
        missing.push(
          `المربع الرابع - العبارة ${number}: الإجابة فارغة`
        )
      }
    }
  }

  if (fatblaEnabled) {
    const fatblaMap = {}

    ;(auctionRes.data || []).forEach(
      row => {
        fatblaMap[
          Number(row.number)
        ] = row
      }
    )

    for (
      let number = 1;
      number <= requiredAuctionCount;
      number++
    ) {
      const row =
        fatblaMap[number]

      if (!row) {
        missing.push(
          `فتبلة - الرقم ${number} غير موجود`
        )

        continue
      }

      /*
        لا نفحص question هنا لأن
        فتبلة تعتمد على الوسائط والإجابة.
      */
      if (!hasText(row.answer)) {
        missing.push(
          `فتبلة - الرقم ${number}: الإجابة فارغة`
        )
      }

      if (
        !hasText(row.image) &&
        !hasText(row.video)
      ) {
        missing.push(
          `فتبلة - الرقم ${number}: الصورة أو الفيديو غير موجود`
        )
      }
    }
  }

  const enabledNames = []

  if (box1Enabled) {
    enabledNames.push("اللاعب المشترك")
  }

  if (box2Enabled) {
    enabledNames.push("المزاد")
  }

  if (box3Enabled) {
    enabledNames.push("ماذا تعرف")
  }

  if (box4Enabled) {
    enabledNames.push("المربع الرابع")
  }

  if (fatblaEnabled) {
    enabledNames.push("فتبلة")
  }

  return readinessItem(
    "التحدي",
    missing.length === 0,
    missing.length
      ? missing
      : [
          `المربعات المفعّلة: ${enabledNames.join("، ")}`
        ]
  )
}

async function checkWhoReady() {
  const requiredCount = await getAdminSegmentCount("who")

  const whoRes = await dbSelect(
    "who_images",
    (query) =>
      query.eq("model", Number(currentModel)).order("number", {
        ascending: true
      }),
    {
      select: "*",
      fallback: [],
      logLabel: "CHECK WHO READY"
    }
  )

  if (!whoRes.ok) {
    console.log(whoRes.error)

    return readinessItem("من هو", false, ["تعذر قراءة بيانات من هو"])
  }

  const data = whoRes.data
  const map = {}

  ;(data || []).forEach((row) => {
    map[Number(row.number)] = row
  })

  const missing = []

  for (let i = 1; i <= requiredCount; i++) {
    const row = map[i]

    if (!row) {
      missing.push(`العنصر ${i} غير موجود`)
      continue
    }

    if (!hasText(row.image)) {
      missing.push(`العنصر ${i}: الصورة غير موجودة`)
    }

    if (!hasText(row.answer)) {
      missing.push(`العنصر ${i}: الإجابة فارغة`)
    }
  }

  return readinessItem("من هو", missing.length === 0, missing.length ? missing : [`من هو مكتملة بعدد ${requiredCount} عنصر`])
}

async function checkExplainReady() {
  const count = await getAdminSegmentCount("explain")

  const explainRes = await dbSelect(
    "explain_words",
    (query) =>
      query.eq("model", Number(currentModel)).order("number", {
        ascending: true
      }),
    {
      select: "*",
      fallback: [],
      logLabel: "CHECK EXPLAIN READY"
    }
  )

  if (!explainRes.ok) {
    console.log(explainRes.error)

    return readinessItem("اشرح الكلمة", false, ["تعذر قراءة بيانات اشرح الكلمة"])
  }

  const data = explainRes.data
  const map = {}

  ;(data || []).forEach((row) => {
    map[Number(row.number)] = row
  })

  const missing = []

  for (let i = 1; i <= count; i++) {
    const row = map[i]

    if (!row) {
      missing.push(`الكلمة ${i} غير موجودة`)
      continue
    }

    if (!hasText(row.word)) {
      missing.push(`الكلمة ${i} فارغة`)
    }
  }

  return readinessItem("اشرح الكلمة", missing.length === 0, missing.length ? missing : [`مكتملة بعدد ${count} كلمات`])
}

function getFinalRound1NoDotsCount(cardsCount) {
  const count = Number(cardsCount || 7)

  if (count === 5) return 5
  if (count === 9) return 9

  return 7
}

async function checkFinalRoundReady(round) {
  const [r1Res, r2Res, r3Res] = await Promise.all([
    dbSelect("final_round1_items", (query) => query.eq("model", Number(currentModel)), {
      select: "*",
      fallback: [],
      logLabel: "CHECK FINAL ROUND1 READY"
    }),

    dbSelect("final_round2_items", (query) => query.eq("model", Number(currentModel)), {
      select: "*",
      fallback: [],
      logLabel: "CHECK FINAL ROUND2 READY"
    }),

    dbSelect("final_round3_items", (query) => query.eq("model", Number(currentModel)), {
      select: "*",
      fallback: [],
      logLabel: "CHECK FINAL ROUND3 READY"
    })
  ])

  if (!r1Res.ok || !r2Res.ok || !r3Res.ok) {
    console.log(r1Res.error || r2Res.error || r3Res.error)

    return readinessItem(`الجولة ${round}`, false, ["تعذر قراءة بيانات الجولة"])
  }

  const missing = []

  if (round === 1) {
    const r1CardsCount = await getAdminSegmentCount("finalRound1")

    const r1Map = {}

    ;(r1Res.data || []).forEach((row) => {
      r1Map[Number(row.number)] = row
    })

    for (let i = 1; i <= r1CardsCount; i++) {
      const row = r1Map[i]

      if (!row) {
        missing.push(`ٮدوں ٮڡاط - رقم ${i} غير موجود`)
        continue
      }

      if (!hasText(row.card_text)) {
        missing.push(`ٮدوں ٮڡاط - رقم ${i}: نص بدون نقط فارغ`)
      }

      if (!hasText(row.answer)) {
        missing.push(`ٮدوں ٮڡاط - رقم ${i}: الإجابة فارغة`)
      }
    }

    return readinessItem("ٮدوں ٮڡاط", missing.length === 0, missing.length ? missing : [`مكتملة بعدد ${r1CardsCount} أرقام`])
  }

  if (round === 2) {
    const r2Map = {}

    ;(r2Res.data || []).forEach((row) => {
      r2Map[`${Number(row.number)}_${Number(row.item_order)}`] = row
    })

    for (const number of [1, 2, 4, 5]) {
      const isScramble = isFinalRound2ScrambleNumber(number)
      const typeName = isScramble ? "كلمات مبعثرة" : "ترتيب"

      for (let i = 1; i <= 6; i++) {
        const row = r2Map[`${number}_${i}`]

        if (!row) {
          missing.push(`صح صحلي - رقم ${number} (${typeName}) - العنصر ${i} غير موجود`)
          continue
        }

        if (!hasText(row.prompt)) {
          missing.push(`صح صحلي - رقم ${number} (${typeName}) - العنصر ${i}: النص فارغ`)
        }

        if (isScramble && !hasText(row.answer)) {
          missing.push(`صح صحلي - رقم ${number} (${typeName}) - العنصر ${i}: الإجابة فارغة`)
        }
      }
    }

    const imageMap = {}

    ;(r3Res.data || []).forEach((row) => {
      const dbNumber = Number(row.number)
      const imageOrder = Number(row.image_order || 1)

      if (dbNumber === 101 || dbNumber === 102) {
        imageMap[`${dbNumber}_${imageOrder}`] = row
      }
    })

    for (const displayNumber of [3, 6]) {
      const dbNumber = getFinalRound4DbNumber(displayNumber)

      for (let i = 1; i <= 5; i++) {
        const row = imageMap[`${dbNumber}_${i}`]

        if (!row) {
          missing.push(`صح صحلي - رقم ${displayNumber} (اشرح الصورة) - الصورة ${i} غير موجودة`)
          continue
        }

        if (!hasText(row.image)) {
          missing.push(`صح صحلي - رقم ${displayNumber} (اشرح الصورة) - الصورة ${i}: الصورة غير موجودة`)
        }

        if (!hasText(row.answer)) {
          missing.push(`صح صحلي - رقم ${displayNumber} (اشرح الصورة) - الصورة ${i}: الإجابة فارغة`)
        }
      }
    }

    return readinessItem(
      "صح صحلي",
      missing.length === 0,
      missing.length ? missing : ["صح صحلي مكتملة: 1 مبعثرة، 2 ترتيب، 3 صورة، 4 مبعثرة، 5 ترتيب، 6 صورة"]
    )
  }

  if (round === 3) {
    const requiredCount = await getAdminSegmentCount("finalRound3")
    const storyMap = {}

    ;(r1Res.data || []).forEach((row) => {
      const number = Number(row.number)

      if (number >= 201 && number <= 209) {
        storyMap[number] = row
      }
    })

    for (let displayNumber = 1; displayNumber <= requiredCount; displayNumber++) {
      const dbNumber = getFinalStoryDbNumber(displayNumber)
      const row = storyMap[dbNumber]

      if (!row) {
        missing.push(`قصة - رقم ${displayNumber} غير موجود`)
        continue
      }

      const hasAnyPart = hasText(row.question_part1) || hasText(row.question_part2) || hasText(row.question_part3)

      if (!hasAnyPart) {
        missing.push(`قصة - رقم ${displayNumber}: أجزاء القصة فارغة`)
      }

      if (!hasText(row.answer)) {
        missing.push(`قصة - رقم ${displayNumber}: الإجابة فارغة`)
      }
    }

    return readinessItem("قصة", missing.length === 0, missing.length ? missing : [`قصة مكتملة بعدد ${requiredCount} أرقام`])
  }

  if (round === 4) {
    const requiredCount = await getAdminSegmentCount("finalRound4")
    const focusMap = {}

    ;(r3Res.data || []).forEach((row) => {
      const number = Number(row.number)
      const imageOrder = Number(row.image_order || 1)

      if (number >= 1 && number <= 9 && imageOrder === 1) {
        focusMap[number] = row
      }
    })

    for (let number = 1; number <= requiredCount; number++) {
      const row = focusMap[number]

      if (!row) {
        missing.push(`التركيز - رقم ${number} غير موجود`)
        continue
      }

      if (!hasText(row.image) && !hasText(row.video)) {
        missing.push(`التركيز - رقم ${number}: الصورة أو الفيديو غير موجود`)
      }

      if (!hasText(row.question)) {
        missing.push(`التركيز - رقم ${number}: السؤال فارغ`)
      }

      if (!hasText(row.answer)) {
        missing.push(`التركيز - رقم ${number}: الإجابة فارغة`)
      }
    }

    return readinessItem("التركيز", missing.length === 0, missing.length ? missing : [`التركيز مكتملة بعدد ${requiredCount} أرقام`])
  }

  return readinessItem("الفاصلة", false, ["رقم الجولة غير صحيح"])
}

async function checkArchiveReady() {
  const rounds =
    await getSegmentRoundCount(
      "archive",
      4,
      4
    )

  const [
    boxesRes,
    itemsRes
  ] = await Promise.all([
    dbSelect(
      "archive_boxes",
      query =>
        query.eq(
          "model",
          Number(currentModel)
        ),
      {
        select: "*",
        fallback: [],
        logLabel:
          "CHECK ARCHIVE BOXES READY"
      }
    ),

    dbSelect(
      "archive_items",
      query =>
        query.eq(
          "model",
          Number(currentModel)
        ),
      {
        select: "*",
        fallback: [],
        logLabel:
          "CHECK ARCHIVE ITEMS READY"
      }
    )
  ])

  if (!boxesRes.ok || !itemsRes.ok) {
    console.log(
      boxesRes.error ||
      itemsRes.error
    )

    return readinessItem(
      "الأرشيف",
      false,
      ["تعذر قراءة بيانات الأرشيف"]
    )
  }

  const boxesMap = {}

  ;(boxesRes.data || []).forEach(
    box => {
      boxesMap[
        Number(box.round)
      ] = box
    }
  )

  const itemsByRound = {}

  ;(itemsRes.data || []).forEach(
    item => {
      const round =
        Number(item.round)

      if (!itemsByRound[round]) {
        itemsByRound[round] = []
      }

      itemsByRound[round].push(
        item
      )
    }
  )

  const missing = []

  for (
    let round = 1;
    round <= rounds;
    round++
  ) {
    const box =
      boxesMap[round]

    const items =
      itemsByRound[round] || []

    const map = {}

    items.forEach(item => {
      map[
        Number(item.position)
      ] = item
    })

    if (!box) {
      missing.push(
        `الأرشيف - الجولة ${round}: بيانات الجولة غير موجودة`
      )

      continue
    }

    if (!hasText(box.tournament)) {
      missing.push(
        `الأرشيف - الجولة ${round}: البطولة فارغة`
      )
    }

    if (!hasText(box.season)) {
      missing.push(
        `الأرشيف - الجولة ${round}: الموسم فارغ`
      )
    }

    if (!hasText(box.score)) {
      missing.push(
        `الأرشيف - الجولة ${round}: النتيجة فارغة`
      )
    }

    if (!hasText(map[3]?.image)) {
      missing.push(
        `الأرشيف - الجولة ${round}: الصورة 3 غير موجودة`
      )
    }

    if (!hasText(map[4]?.image)) {
      missing.push(
        `الأرشيف - الجولة ${round}: الصورة 4 غير موجودة`
      )
    }

    const textItems =
      items.filter(item => {
        return (
          Number(item.position) >=
          ARCHIVE_TEXT_START_POSITION
        )
      })

    if (!textItems.length) {
      missing.push(
        `الأرشيف - الجولة ${round}: لا توجد عناصر نصية`
      )

      continue
    }

    const hasRequired =
      textItems.some(item => {
        return (
          String(
            item.label || ""
          ).trim() === "المطلوب"
        )
      })

    if (!hasRequired) {
      missing.push(
        `الأرشيف - الجولة ${round}: لا يوجد عنصر بعنوان المطلوب`
      )
    }

    textItems.forEach(item => {
      if (!hasText(item.text)) {
        missing.push(
          `الأرشيف - الجولة ${round}: العنصر ${item.position} نصه فارغ`
        )
      }
    })
  }

  return readinessItem(
    "الأرشيف",
    missing.length === 0,
    missing.length
      ? missing
      : [
          `الأرشيف مكتمل بعدد ${rounds} جولات`
        ]
  )
}

/* =========================
   15) Model Actions
========================= */

async function loadModels() {
  const result = await dbSelect(
    "models",
    (query) =>
      query.order("id", {
        ascending: false
      }),
    {
      logLabel: "LOAD MODELS"
    }
  )

  if (!result.ok) {
    showGameToast("تعذر تحميل النماذج")
    return
  }

  const list = document.getElementById("modelsList")

  if (!list) return

  const currentValue = currentModel ? String(currentModel) : ""

  list.innerHTML = `
    <option value="">
      اختر النموذج
    </option>
  `

  result.data.forEach((model) => {
    const option = document.createElement("option")

    option.value = model.id

    option.textContent = model.name

    list.appendChild(option)
  })

  if (currentValue) {
    list.value = currentValue
  }
}

async function createModel() {
  const input = document.getElementById("modelName")
  const name = (input?.value || "").trim()

  if (!name) {
    showGameToast("اكتب اسم النموذج")
    return
  }

  const adminPin = await requestAdminPinModal({
    title: "إنشاء نموذج جديد",
    message: "اكتب رقم سري خاص بالأدمن لهذا النموذج",
    confirmText: "إنشاء النموذج"
  })

  if (!adminPin) {
    showGameToast("لازم تكتب رقم سري للنموذج")
    return
  }

  const result = await dbInsert(
    "models",
    {
      name,
      admin_pin: adminPin
    },
    {
      select: "*",
      single: true,
      logLabel: "CREATE MODEL"
    }
  )

  if (!result.ok) {
    showGameToast("تعذر إنشاء النموذج")
    return
  }

  const data = result.data

  input.value = ""

  await loadModels()

  if (data?.id) {
    unlockAdminModel(data.id)

    currentModel = data.id
    currentModelName = data.name || name

    updateAdminBrandModel()

    const list = document.getElementById("modelsList")
    if (list) list.value = String(data.id)

    showAdminWorkspace()
    renderAdminHomeActions()

    await renderAdminHome()
  }

  showGameToast("تم إنشاء النموذج")
}

async function openSelectedModel() {
  const list = document.getElementById("modelsList")
  const id = Number(list?.value || 0)

  if (!id) {
    showGameToast("اختر النموذج")
    return
  }

  const optionName = list.options[list.selectedIndex]?.textContent || `نموذج ${id}`

  const modelData = await requestAdminModelAccess(id, optionName)
  if (!modelData) return

  currentModel = id
  currentModelName = modelData.name || optionName

  updateAdminBrandModel()
  showAdminWorkspace()
  renderAdminHomeActions()

  await renderAdminHome()

  showGameToast(`تم فتح ${currentModelName}`)
}

async function exitCurrentModel() {
  invalidateAdminHomeCache()
  currentModel = null
  currentModelName = ""
  currentAdminSegment = ""

  updateAdminBrandModel()

  await loadModels()
  showAdminModelGate()

  showGameToast("تم الرجوع لاختيار النموذج")
}

async function renameSelectedModel() {
  const list = document.getElementById("modelsList")
  const id = Number(list?.value || currentModel || 0)

  if (!id) {
    showGameToast("اختر النموذج أولاً")
    return
  }

  const currentName = currentModelName || list?.options?.[list.selectedIndex]?.textContent || ""
  const modelData = await requestAdminModelAccess(id, currentName)
  if (!modelData) return

  document.getElementById("renameModelModal")?.remove()

  document.body.insertAdjacentHTML(
    "beforeend",
    `
    <div class="adminModalOverlay" id="renameModelModal">
      <div class="adminModalCard">
        <div class="adminModalTitle">تعديل اسم النموذج</div>

        <div class="adminField">
          <label for="renameModelInput">الاسم الجديد للنموذج</label>
          <input
            id="renameModelInput"
            class="adminInput"
            type="text"
            value="${escapeHtml(currentName)}"
            placeholder="اكتب الاسم الجديد"
          >
        </div>

        <div class="adminModalActions">
          <button type="button" class="adminBtn adminBtnLight" onclick="closeRenameModelModal()">إلغاء</button>
          <button type="button" class="adminBtn adminBtnMango" onclick="submitRenameModel(${id})">حفظ التعديل</button>
        </div>
      </div>
    </div>
  `
  )

  const modal = document.getElementById("renameModelModal")
  const input = document.getElementById("renameModelInput")

  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeRenameModelModal()
    })
  }

  if (input) {
    input.focus()
    input.select()
  }
}

function closeRenameModelModal() {
  document.getElementById("renameModelModal")?.remove()
}

async function submitRenameModel(id) {
  const input = document.getElementById("renameModelInput")
  const name = (input?.value || "").trim()

  if (!name) {
    showGameToast("اسم النموذج فارغ")
    return
  }

  const updateResult = await dbUpdate(
    "models",
    {
      name
    },
    (query) => query.eq("id", id),
    {
      logLabel: "RENAME MODEL"
    }
  )

  if (!updateResult.ok) {
    console.log(updateResult.error)

    showGameToast("تعذر تعديل اسم النموذج")

    return
  }

  currentModel = id
  currentModelName = name

  updateAdminBrandModel()
  closeRenameModelModal()

  await loadModels()

  const modelsList = document.getElementById("modelsList")
  if (modelsList) modelsList.value = String(id)

  await renderAdminHome()
  showGameToast("تم تعديل اسم النموذج")
}

async function listStorageFilesRecursive(path = "") {
  const allFiles = []

  const { data, error } = await db.storage.from(BUCKET_NAME).list(path, {
    limit: 1000,
    offset: 0
  })

  if (error) {
    console.log("LIST STORAGE ERROR:", error)
    return allFiles
  }

  for (const item of data || []) {
    const itemPath = path ? `${path}/${item.name}` : item.name

    if (item.metadata) {
      allFiles.push(itemPath)
    } else {
      const nested = await listStorageFilesRecursive(itemPath)
      allFiles.push(...nested)
    }
  }

  return allFiles
}

async function deleteModelStorageFiles(modelId) {
  const folder = `model_${Number(modelId)}`

  const files = await listStorageFilesRecursive(folder)

  if (!files.length) {
    return true
  }

  const { error } = await db.storage.from(BUCKET_NAME).remove(files)

  if (error) {
    console.log("DELETE MODEL STORAGE FILES ERROR:", error)
    showGameToast("تعذر حذف بعض ملفات الصور والفيديو")
    return false
  }

  return true
}

async function deleteSelectedModel() {
  const list = document.getElementById("modelsList")
  const id = Number(list?.value || currentModel || 0)

  if (!id) {
    showGameToast("اختر النموذج")
    return
  }

  const modelName = currentModelName || list?.options?.[list.selectedIndex]?.textContent || `نموذج ${id}`

  const modelData = await requestAdminModelAccess(id, modelName)
  if (!modelData) return

  const ok = confirm(`هل تريد حذف "${modelName}" نهائيًا؟\n\nسيتم حذف كل بيانات النموذج من جميع الفقرات.`)

  if (!ok) return

  try {
    showGameToast("جارٍ حذف ملفات النموذج...")

    const storageDeleted = await deleteModelStorageFiles(id)

    if (!storageDeleted) {
      showGameToast("توقف الحذف لأن ملفات النموذج لم تُحذف")
      return
    }

    showGameToast("جارٍ حذف بيانات النموذج...")

    const deleteJobs = [
      dbDelete("questions", (query) => query.eq("model", id), {
        logLabel: "DELETE QUESTIONS"
      }),

      dbDelete("top10_questions", (query) => query.eq("model", id), {
        logLabel: "DELETE TOP10 QUESTIONS"
      }),

      dbDelete("auction_questions", (query) => query.eq("model", id), {
        logLabel: "DELETE AUCTION QUESTIONS"
      }),

      dbDelete("who_images", (query) => query.eq("model", id), {
        logLabel: "DELETE WHO IMAGES"
      }),

      dbDelete("explain_words", (query) => query.eq("model", id), {
        logLabel: "DELETE EXPLAIN WORDS"
      }),

      dbDelete("explain_settings", (query) => query.eq("model", id), {
        logLabel: "DELETE EXPLAIN SETTINGS"
      }),

      dbDelete("final_round_meta", (query) => query.eq("model", id), {
        logLabel: "DELETE FINAL ROUND META"
      }),

      dbDelete("final_round1_items", (query) => query.eq("model", id), {
        logLabel: "DELETE FINAL ROUND 1"
      }),

      dbDelete("final_round2_items", (query) => query.eq("model", id), {
        logLabel: "DELETE FINAL ROUND 2"
      }),

      dbDelete("final_round3_items", (query) => query.eq("model", id), {
        logLabel: "DELETE FINAL ROUND 3"
      }),

      dbDelete("archive_boxes", (query) => query.eq("model", id), {
        logLabel: "DELETE ARCHIVE BOXES"
      }),

      dbDelete("archive_items", (query) => query.eq("model", id), {
        logLabel: "DELETE ARCHIVE ITEMS"
      }),

      dbDelete("segment_settings", (query) => query.eq("model", id), {
        logLabel: "DELETE SEGMENT SETTINGS"
      })
    ]

    const results = await Promise.all(deleteJobs)
    const failed = results.find((result) => result.error)

    if (failed) {
      console.log("DELETE MODEL RELATED DATA ERROR:", failed.error)
      showGameToast("تعذر حذف بعض بيانات النموذج")
      return
    }

    const modelResult = await dbDelete("models", (query) => query.eq("id", id), {
      logLabel: "DELETE MODEL"
    })

    if (!modelResult.ok) {
      console.log("DELETE MODEL ERROR:", modelResult.error)

      showGameToast("تعذر حذف النموذج")

      return
    }

    if (currentModel === id) {
      currentModel = null
      currentModelName = ""

      const tabsWrap = tabs()

      if (tabsWrap) {
        tabsWrap.classList.add("hidden")
        tabsWrap.innerHTML = ""
      }

      clearActiveAdminTab()
      showAdminEmptyState()
      updateAdminBrandModel()
    }

    await loadModels()

    const modelsList = document.getElementById("modelsList")
    if (modelsList) modelsList.value = ""

    showGameToast("تم حذف النموذج وكل بياناته")
  } catch (err) {
    console.log("DELETE SELECTED MODEL CATCH:", err)
    showGameToast("حدث خطأ أثناء حذف النموذج")
  }
}

async function openAdminSegment(segment) {
  if (!currentModel) {
    showGameToast("افتح نموذج أولاً")
    return false
  }

  if (segment === "home") {
    return goAdminHome()
  }

  if (segment === "randomChallenge") {
    return openAdminRandomChallenge()
  }

  if (adminNavBusy) {
    return false
  }

  adminNavBusy = true

  try {
    const visibility =
      await loadGlobalSegmentVisibilityMap()

    if (
      !isAdminSegmentGloballyEnabled(
        segment,
        visibility
      )
    ) {
      showGameToast(
        "هذه الفقرة مخفية من إعدادات الفقرات",
        "warning"
      )

      await renderAdminHome()

      return false
    }

    currentAdminSegment = segment

    renderAdminSegmentActions()
    renderAdminTabsUnified()

    showAdminSegmentLoading(
      `جارٍ فتح ${getAdminSegmentTitle(segment)}...`
    )

    if (segment === "warmup") {
      await renderWarmupAdmin()
      return true
    }

    if (segment === "top10") {
      await renderTop10Admin()
      return true
    }

    if (segment === "who") {
      await renderWhoAdmin()
      return true
    }

    if (segment === "explain") {
      await renderExplainAdmin()
      return true
    }

    if (segment === "finalRound1") {
      await renderFinalAdminRound(1)
      return true
    }

    if (segment === "finalRound2") {
      await renderFinalAdminRound(2)
      return true
    }

    if (segment === "finalRound3") {
      await renderFinalAdminRound(3)
      return true
    }

    if (segment === "finalRound4") {
      await renderFinalAdminRound(4)
      return true
    }

    if (segment === "archive") {
      await renderArchiveAdmin()
      return true
    }

    showGameToast(
      "الفقرة غير معروفة",
      "error"
    )

    await renderAdminHome()

    return false
  } catch (error) {
    console.error(
      "OPEN ADMIN SEGMENT ERROR:",
      error
    )

    showGameToast(
      "تعذر فتح الفقرة",
      "error"
    )

    await renderAdminHome()

    return false
  } finally {
    adminNavBusy = false
  }
}

/* =========================
   16) Open Segment Router
========================= */

async function goAdminHome() {
  return runAdminNavigation(
    async () => {
      await renderAdminHome()
    }
  )
}

function adminBackToCards() {
  goAdminHome()
}

function showAdminHomeCards() {
  goAdminHome()
}

function showAdminEditorPage() {
  const area = editor()
  if (area) area.classList.remove("hidden")
}

function openAdminSegmentCard(segmentKey) {
  openAdminSegment(segmentKey)
}

async function openAdminSegment(segment) {
  if (!currentModel) {
    showGameToast("افتح نموذج أولاً")
    return
  }

  if (segment === "home") {
    await goAdminHome()
    return
  }

  if (segment === "randomChallenge") {
    await openAdminRandomChallenge()
    return
  }

  const visibility = await loadGlobalSegmentVisibilityMap()

  if (!isAdminSegmentGloballyEnabled(segment, visibility)) {
    showGameToast("هذه الفقرة مخفية من إعدادات الفقرات")

    await goAdminHome()
    return
  }

  currentAdminSegment = segment

  renderAdminSegmentActions()

  await renderAdminTabsUnified()

  if (segment === "warmup") {
    await renderWarmupAdmin()
  }

  if (segment === "top10") {
    await renderTop10Admin()
  }

  if (segment === "who") {
    await renderWhoAdmin()
  }

  if (segment === "explain") {
    await renderExplainAdmin()
  }

  if (segment === "finalRound1") {
    await renderFinalAdminRound(1)
  }

  if (segment === "finalRound2") {
    await renderFinalAdminRound(2)
  }

  if (segment === "finalRound3") {
    await renderFinalAdminRound(3)
  }

  if (segment === "finalRound4") {
    await renderFinalAdminRound(4)
  }

  if (segment === "archive") {
    await renderArchiveAdmin()
  }
}

async function switchRandomChallengeAdminSection(section, showToast = false) {
  const validSections =
    typeof getRandomChallengeAdminSections === "function"
      ? getRandomChallengeAdminSections()
      : [
          {
            key: "sharedPlayer",
            title: "اللاعب المشترك"
          },
          {
            key: "auction",
            title: "المزاد"
          },
          {
            key: "whatDoYouKnow",
            title: "ماذا تعرف"
          },
          {
            key: "trueFalse",
            title: "صح أو خطأ"
          },
          {
            key: "fatbla",
            title: "فتبلة"
          }
        ]

  const sectionKeys = validSections.map((item) => {
    return typeof item === "string" ? item : item.key
  })

  const safeSection = sectionKeys.includes(section) ? section : "auction"

  randomChallengeAdminSection = safeSection

  try {
    if (safeSection === "fatbla") {
      if (typeof loadFatblaAdminDraft === "function") {
        await loadFatblaAdminDraft()
      }
    } else if (safeSection !== "sharedPlayer") {
      if (typeof loadRandomChallengeAdminRows === "function") {
        await loadRandomChallengeAdminRows(safeSection)
      }
    }

    renderAdminRandomChallengePage()

    if (showToast) {
      const title =
        typeof getRandomChallengeAdminSectionTitle === "function" ? getRandomChallengeAdminSectionTitle(safeSection) : safeSection

      showGameToast(`تم فتح ${title}`, "success")
    }
  } catch (error) {
    console.error("SWITCH RANDOM CHALLENGE SECTION ERROR:", error)

    showGameToast("تعذر فتح قسم التحدي", "error")
  }
}

function renderAdminRandomChallengePage() {
  const area = editor()

  if (!area) {
    return
  }

  const sections =
    typeof getRandomChallengeAdminSections === "function"
      ? getRandomChallengeAdminSections()
      : [
          {
            key: "sharedPlayer",
            title: "اللاعب المشترك"
          },
          {
            key: "auction",
            title: "المزاد"
          },
          {
            key: "whatDoYouKnow",
            title: "ماذا تعرف"
          },
          {
            key: "trueFalse",
            title: "صح أو خطأ"
          },
          {
            key: "fatbla",
            title: "فتبلة"
          }
        ]

  const currentSection = randomChallengeAdminSection || "auction"

  let content = ""

  if (currentSection === "sharedPlayer") {
    content =
      typeof buildRandomChallengeSharedPlayer === "function"
        ? buildRandomChallengeSharedPlayer()
        : `
          <div class="adminEmptyState">
            اللاعب المشترك لا يحتاج أسئلة
          </div>
        `
  } else if (currentSection === "fatbla") {
    content =
      typeof buildFatblaAdminContent === "function"
        ? buildFatblaAdminContent()
        : `
          <div class="adminEmptyState">
            دالة عرض فتبلة غير موجودة
          </div>
        `
  } else {
  content =
    typeof buildRandomChallengeQuestionsOnePage ===
    "function"
      ? buildRandomChallengeQuestionsOnePage(
          currentSection,
          getRandomChallengeAdminSectionCount(
            currentSection
          )
        )
      : `
        <div class="adminEmptyState">
          دالة عرض أسئلة التحدي غير موجودة
        </div>
      `
}

  const isSharedPlayer = currentSection === "sharedPlayer"

  area.innerHTML = `
    <div class="randomChallengeAdminPage">

      <div class="adminEditorTopBar randomChallengeAdminTopBar">

        <div class="adminEditorTitleBox">
          <h2>فقرة التحدي</h2>

          <span>
            اختر المربع ثم أضف أسئلته وإجاباته
          </span>
        </div>

      </div>

      <div class="randomChallengeAdminTabs">

        ${sections
          .map((item) => {
            const key = typeof item === "string" ? item : item.key

            const title =
              typeof item === "string"
                ? typeof getRandomChallengeAdminSectionTitle === "function"
                  ? getRandomChallengeAdminSectionTitle(item)
                  : item
                : item.title

            const active = key === currentSection

            return `
            <button
              type="button"
              class="
                randomChallengeAdminTab
                ${active ? "active" : ""}
              "
              onclick="
                switchRandomChallengeAdminSection(
                  '${escapeHtml(key)}'
                )
              "
            >
              ${escapeHtml(title)}
            </button>
          `
          })
          .join("")}

      </div>

      <div class="randomChallengeAdminContent">
        ${content}
      </div>

      ${
        isSharedPlayer
          ? ""
          : `
            <div class="randomChallengeAdminActions">

              <button
                type="button"
                class="adminBtn adminBtnMango"
                onclick="
                  saveRandomChallengeCurrentSection()
                "
              >
                حفظ القسم
              </button>

              <button
                type="button"
                class="adminBtn adminBtnDanger"
                onclick="
                  deleteRandomChallengeCurrentSection()
                "
              >
                حذف القسم
              </button>

            </div>
          `
      }

    </div>
  `

  normalizeAdminEditorCards()
}

/* =========================
   1) COMMON HELPERS
========================= */

function getRandomChallengeAdminSections() {
  return [
    {
      key: "sharedPlayer",
      title: "اللاعب المشترك"
    },
    {
      key: "auction",
      title: "المزاد"
    },
    {
      key: "whatDoYouKnow",
      title: "ماذا تعرف"
    },
    {
      key: "trueFalse",
      title: "صح أو خطأ"
    },
    {
      key: "fatbla",
      title: "فتبلة"
    }
  ]
}

function isRandomChallengeAdminSection(sectionKey) {
  return getRandomChallengeAdminSections().some((section) => section.key === sectionKey)
}

function getRandomChallengeAdminSectionTitle(sectionKey) {
  return getRandomChallengeAdminSections().find((section) => section.key === sectionKey)?.title || "التحدي"
}

function getRandomChallengeAdminSectionCount(boxKey) {
  switch (boxKey) {
    case "auction":
      return 2

    case "whatDoYouKnow":
      return 2

    case "trueFalse":
      return 10

    default:
      return 0
  }
}

/* =========================
   LOAD DATA
========================= */

async function loadRandomChallengeAdminRows() {
  if (!currentModel) {
    randomChallengeAdminRows = []
    return []
  }

  const result = await dbSelect(
    "random_challenge_questions",
    (query) =>
      query
        .eq("model", Number(currentModel))
        .order("box_key", {
          ascending: true
        })
        .order("number", {
          ascending: true
        }),
    {
      select: "*",
      fallback: [],
      logLabel: "LOAD RANDOM CHALLENGE ADMIN"
    }
  )

  if (!result.ok) {
    showGameToast("تعذر تحميل أسئلة التحدي")

    randomChallengeAdminRows = []

    return []
  }

  randomChallengeAdminRows = Array.isArray(result.data) ? result.data : []

  return randomChallengeAdminRows
}

/* =========================
   DATA HELPERS
========================= */

function getRandomChallengeAdminRow(boxKey, number) {
  return randomChallengeAdminRows.find((row) => String(row.box_key) === String(boxKey) && Number(row.number) === Number(number)) || null
}

function getRandomChallengeQuestionStatus(boxKey, number) {
  const row = getRandomChallengeAdminRow(boxKey, number) || {}

  const requiresAnswer = boxKey === "trueFalse"

  const total = requiresAnswer ? 2 : 1

  let completed = 0

  if (hasText(row.question)) {
    completed++
  }

  if (requiresAnswer && ["صح", "خطأ"].includes(String(row.answer || ""))) {
    completed++
  }

  return getAdminItemStatus(completed, total)
}

/* =========================
   2) SHARED PLAYER
========================= */

function buildRandomChallengeSharedPlayer() {
  return `
    <div class="adminEmptyState">
      اللاعب المشترك جاهز ولا يحتاج أسئلة
    </div>
  `
} /* =========================
   3) AUCTION
========================= */

function collectRandomChallengeCurrentDraft() {
  const boxKey = randomChallengeAdminSection

  const count = getRandomChallengeAdminSectionCount(boxKey)

  if (!count) {
    return
  }

  for (let number = 1; number <= count; number++) {
    const questionInput = document.getElementById(`randomChallengeQuestionInput_${boxKey}_${number}`)

    const answerInput = document.getElementById(`randomChallengeAnswerInput_${boxKey}_${number}`)

    if (!questionInput && !answerInput) {
      continue
    }

    const question = String(questionInput?.value || "").trim()

    const answer = boxKey === "trueFalse" ? String(answerInput?.value || "").trim() : ""

    const existingIndex = randomChallengeAdminRows.findIndex(
      (row) => String(row.box_key) === String(boxKey) && Number(row.number) === Number(number)
    )

    const oldRow = existingIndex >= 0 ? randomChallengeAdminRows[existingIndex] : {}

    const nextRow = {
      ...oldRow,
      model: Number(currentModel),
      box_key: boxKey,
      number: Number(number),
      question,
      answer
    }

    if (existingIndex >= 0) {
      randomChallengeAdminRows[existingIndex] = nextRow
    } else {
      randomChallengeAdminRows.push(nextRow)
    }
  }
}

/* =========================
   RANDOM CHALLENGE
   SAVE / CLEAR / DELETE
========================= */

let randomChallengeAdminSaving = false

async function saveRandomChallengeCurrentSection() {
  if (randomChallengeAdminSaving) {
    return false
  }

  if (!currentModel) {
    showGameToast(
      "افتح النموذج أولاً",
      "warning"
    )

    return false
  }

  const boxKey =
    randomChallengeAdminSection

  if (boxKey === "sharedPlayer") {
    showGameToast(
      "اللاعب المشترك لا يحتاج أسئلة",
      "warning"
    )

    return false
  }

  if (boxKey === "fatbla") {
    return await saveFatblaSection()
  }

  const count =
    getRandomChallengeAdminSectionCount(
      boxKey
    )

  if (!count) {
    showGameToast(
      "قسم التحدي غير معروف",
      "error"
    )

    return false
  }

  collectRandomChallengeCurrentDraft()

  const sectionRows =
    randomChallengeAdminRows
      .filter(row => {
        return (
          String(row.box_key) ===
            String(boxKey) &&
          Number(row.number) >= 1 &&
          Number(row.number) <= count
        )
      })
      .map(row => {
        return {
          model: Number(currentModel),
          box_key: String(boxKey),
          number: Number(row.number),
          question: String(
            row.question || ""
          ).trim(),
          answer:
            boxKey === "trueFalse"
              ? String(
                  row.answer || ""
                ).trim()
              : ""
        }
      })

  const incompleteNumber =
    sectionRows.find(row => {
      if (!row.question) {
        return true
      }

      if (
        boxKey === "trueFalse" &&
        !["صح", "خطأ"].includes(
          row.answer
        )
      ) {
        return true
      }

      return false
    })?.number

  if (incompleteNumber) {
    const message =
      boxKey === "trueFalse"
        ? `أكمل العبارة وحدد صح أو خطأ للرقم ${incompleteNumber}`
        : `اكتب السؤال رقم ${incompleteNumber}`

    showGameToast(
      message,
      "warning"
    )

    return false
  }

  if (sectionRows.length !== count) {
    showGameToast(
      "أكمل جميع أسئلة القسم",
      "warning"
    )

    return false
  }

  randomChallengeAdminSaving = true

  try {
    const result = await dbUpsert(
      "random_challenge_questions",
      sectionRows,
      {
        onConflict:
          "model,box_key,number",
        select: "*",
        logLabel:
          `SAVE RANDOM CHALLENGE ${boxKey}`
      }
    )

    if (!result.ok) {
      showGameToast(
        "تعذر حفظ أسئلة التحدي",
        "error"
      )

      return false
    }

    await loadRandomChallengeAdminRows(
      boxKey
    )

    renderAdminRandomChallengePage()

    showGameToast(
      `تم حفظ ${getRandomChallengeAdminSectionTitle(
        boxKey
      )}`,
      "success"
    )

    return true
  } catch (error) {
    console.error(
      "SAVE RANDOM CHALLENGE SECTION ERROR:",
      error
    )

    showGameToast(
      "حدث خطأ أثناء حفظ القسم",
      "error"
    )

    return false
  } finally {
    randomChallengeAdminSaving = false
  }
}

function clearRandomChallengeAdminQuestion(
  boxKey,
  number
) {
  collectRandomChallengeCurrentDraft()

  const safeBoxKey =
    String(boxKey || "")

  const safeNumber =
    Number(number || 0)

  const existingIndex =
    randomChallengeAdminRows.findIndex(
      row => {
        return (
          String(row.box_key) ===
            safeBoxKey &&
          Number(row.number) ===
            safeNumber
        )
      }
    )

  const clearedRow = {
    model: Number(currentModel),
    box_key: safeBoxKey,
    number: safeNumber,
    question: "",
    answer: ""
  }

  if (existingIndex >= 0) {
    randomChallengeAdminRows[
      existingIndex
    ] = {
      ...randomChallengeAdminRows[
        existingIndex
      ],
      ...clearedRow
    }
  } else {
    randomChallengeAdminRows.push(
      clearedRow
    )
  }

  renderAdminRandomChallengePage()
}

async function deleteRandomChallengeCurrentSection() {
  if (randomChallengeAdminSaving) {
    return false
  }

  if (!currentModel) {
    showGameToast(
      "افتح النموذج أولاً",
      "warning"
    )

    return false
  }

  const boxKey =
    randomChallengeAdminSection

  if (boxKey === "sharedPlayer") {
    return false
  }

  if (boxKey === "fatbla") {
    return await deleteFatblaSection()
  }

  const sectionTitle =
    getRandomChallengeAdminSectionTitle(
      boxKey
    )

  const confirmed =
    window.confirm(
      `هل تريد حذف جميع أسئلة ${sectionTitle}؟`
    )

  if (!confirmed) {
    return false
  }

  randomChallengeAdminSaving = true

  try {
    const result = await dbDelete(
      "random_challenge_questions",
      query => {
        return query
          .eq(
            "model",
            Number(currentModel)
          )
          .eq(
            "box_key",
            boxKey
          )
      },
      {
        logLabel:
          `DELETE RANDOM CHALLENGE ${boxKey}`
      }
    )

    if (!result.ok) {
      showGameToast(
        "تعذر حذف أسئلة القسم",
        "error"
      )

      return false
    }

    randomChallengeAdminRows =
      randomChallengeAdminRows.filter(
        row => {
          return (
            String(row.box_key) !==
            String(boxKey)
          )
        }
      )

    renderAdminRandomChallengePage()

    showGameToast(
      `تم حذف أسئلة ${sectionTitle}`,
      "success"
    )

    return true
  } catch (error) {
    console.error(
      "DELETE RANDOM CHALLENGE SECTION ERROR:",
      error
    )

    showGameToast(
      "حدث خطأ أثناء حذف القسم",
      "error"
    )

    return false
  } finally {
    randomChallengeAdminSaving = false
  }
}

/* =========================
   BUILD
========================= */

function buildRandomChallengeOnePageCard(boxKey, number) {
  const row = getRandomChallengeAdminRow(boxKey, number) || {
    id: null,
    question: "",
    answer: ""
  }

  const status = getRandomChallengeQuestionStatus(boxKey, number)

  const title = boxKey === "trueFalse" ? `العبارة ${number}` : `السؤال ${number}`

  const placeholder = boxKey === "trueFalse" ? "اكتب العبارة" : "اكتب السؤال"

  return `
    <details
      class="
        adminEditItemCard
        randomChallengeOnePageCard
        ${status.className}
      "
      ontoggle="
        handleAdminEditCardToggle(this)
      "
    >

      <summary>

        <div class="adminEditItemTitle">
          <strong>
            ${escapeHtml(title)}
          </strong>
        </div>

        <div class="adminEditItemMeta">

          <span class="adminEditStatusPill">
            ${status.label}
          </span>

          <span class="adminEditProgressPill">
            ${status.progress}
          </span>

        </div>

      </summary>

      <div class="adminEditItemBody">

        <div
          class="
            adminField
            ${getAdminMissingFieldClass(row.question)}
          "
        >

          <textarea
            id="randomChallengeQuestionInput_${boxKey}_${number}"
            placeholder="${escapeHtml(placeholder)}"
          >${escapeHtml(row.question || "")}</textarea>

        </div>

        ${boxKey === "trueFalse" ? buildRandomChallengeTrueFalseField(number, row.answer || "") : ""}

        <button
          type="button"
          class="adminDeleteMiniBtn"
          onclick="
            clearRandomChallengeAdminQuestion(
              '${boxKey}',
              ${number}
            )
          "
        >
          حذف
        </button>

      </div>

    </details>
  `
}

function buildRandomChallengeQuestionsOnePage(boxKey, count) {
  return `
    <div
      class="
        randomChallengeQuestionsEditor
        adminOnePageEditor
      "
    >

      <div
        class="
          adminEditCardsGrid
          randomChallengeOnePageGrid
        "
      >

        ${Array.from({ length: count }, (_, index) => buildRandomChallengeOnePageCard(boxKey, index + 1)).join("")}

      </div>

    </div>
  `
}

/* =========================
   4) WHAT DO YOU KNOW
   ماذا تعرف
========================= */

/*
  يستخدم نفس الدوال المشتركة الخاصة بالمزاد:

*/

/* =========================
   5) TRUE / FALSE
   صح أو خطأ
========================= */

function buildRandomChallengeTrueFalseField(number, currentAnswer) {
  const answer = currentAnswer === "صح" ? "صح" : currentAnswer === "خطأ" ? "خطأ" : ""

  return `
    <div
      class="
        adminField
        ${getAdminMissingFieldClass(answer)}
      "
    >

      <div class="randomChallengeTrueFalseOptions">

        <button
          type="button"
          class="
            randomChallengeTrueFalseBtn
            ${answer === "صح" ? "selected correct" : ""}
          "
          onclick="
            selectRandomChallengeTrueFalseAnswer(
              ${number},
              'صح',
              this
            )
          "
        >
          صح
        </button>

        <button
          type="button"
          class="
            randomChallengeTrueFalseBtn
            ${answer === "خطأ" ? "selected wrong" : ""}
          "
          onclick="
            selectRandomChallengeTrueFalseAnswer(
              ${number},
              'خطأ',
              this
            )
          "
        >
          خطأ
        </button>

      </div>

      <input
        type="hidden"
        id="randomChallengeAnswerInput_trueFalse_${number}"
        value="${escapeHtml(answer)}"
      >

    </div>
  `
}

function selectRandomChallengeTrueFalseAnswer(number, answer, button) {
  const safeAnswer = answer === "خطأ" ? "خطأ" : "صح"

  const input = document.getElementById(`randomChallengeAnswerInput_trueFalse_${number}`)

  if (!input || !button) {
    return
  }

  input.value = safeAnswer

  const card = button.closest(".randomChallengeOnePageCard")

  card?.querySelectorAll(".randomChallengeTrueFalseBtn").forEach((item) => {
    item.classList.remove("selected", "correct", "wrong")
  })

  button.classList.add("selected", safeAnswer === "صح" ? "correct" : "wrong")

  const existingIndex = randomChallengeAdminRows.findIndex(
    (row) => String(row.box_key) === "trueFalse" && Number(row.number) === Number(number)
  )

  if (existingIndex >= 0) {
    randomChallengeAdminRows[existingIndex].answer = safeAnswer
  }
}
/* =========================
   FATBLA HELPERS
========================= */

function getFatblaDraftItem(number) {
  const n = Number(number || 1)

  if (!fatblaAdminDraft[n]) {
    fatblaAdminDraft[n] = {
      id: null,
      question: "",
      answer: "",
      image: "",
      video: "",
      file: null,
      videoFile: null
    }
  }

  return fatblaAdminDraft[n]
}

function collectFatblaCurrentDraft() {
  const total = Number(fatblaAdminCount || 5)

  for (let number = 1; number <= total; number++) {
    const item = getFatblaDraftItem(number)

    const answerInput = document.getElementById(`fatblaAnswer${number}`)

    const imageInput = document.getElementById(`fatblaFile${number}`)

    const videoInput = document.getElementById(`fatblaVideo${number}`)

    if (answerInput) {
      item.answer = String(answerInput.value || "").trim()
    }

    const imageFile = imageInput?.files?.[0] || null

    const videoFile = videoInput?.files?.[0] || null

    if (imageFile) {
      item.file = imageFile
      item.videoFile = null
    }

    if (videoFile) {
      item.videoFile = videoFile
      item.file = null
    }
  }
}

function getFatblaItemStatus(number) {
  const item = getFatblaDraftItem(number)

  const hasMedia = hasText(item.image) || hasText(item.video) || !!item.file || !!item.videoFile

  const completed = [hasText(item.answer), hasMedia].filter(Boolean).length

  return getAdminItemStatus(completed, 2)
}
/* =========================
   FATBLA LOAD
========================= */

async function loadFatblaAdminDraft(force = false) {
  if (!currentModel) {
    fatblaAdminDraft = {}
    fatblaAdminLoaded = false
    return false
  }

  if (fatblaAdminLoaded && !force) {
    return true
  }

  const [rowsResult, settingsResult] = await Promise.all([
    dbSelect(
      "auction_questions",
      (query) =>
        query.eq("model", Number(currentModel)).order("number", {
          ascending: true
        }),
      {
        select: "*",
        fallback: [],
        logLabel: "LOAD FATBLA"
      }
    ),

    dbSelect("segment_settings", (query) => query.eq("model", Number(currentModel)).eq("segment", "auction").maybeSingle(), {
      select: "item_count",
      fallback: null,
      logLabel: "LOAD FATBLA SETTINGS"
    })
  ])

  if (!rowsResult.ok) {
    console.log("LOAD FATBLA ERROR:", rowsResult.error)

    showGameToast("تعذر تحميل فتبلة")

    return false
  }

  if (!settingsResult.ok) {
    console.log("LOAD FATBLA SETTINGS ERROR:", settingsResult.error)
  }

  fatblaAdminCount = normalizeRandomChallengeAuctionCount(settingsResult.data?.item_count || 5)

  fatblaAdminDraft = {}

  for (let number = 1; number <= fatblaAdminCount; number++) {
    getFatblaDraftItem(number)
  }

  ;(rowsResult.data || []).forEach((row) => {
    const number = Number(row.number || 0)

    if (number < 1 || number > fatblaAdminCount) {
      return
    }

    const item = getFatblaDraftItem(number)

    item.id = row.id || null
    item.question = row.question || ""
    item.answer = row.answer || ""
    item.image = row.image || ""
    item.video = row.video || ""
    item.file = null
    item.videoFile = null
  })

  fatblaAdminLoaded = true

  return true
}
/* =========================
   FATBLA BUILD (1)
========================= */

function buildFatblaAdminContent() {
  const total = Number(fatblaAdminCount || 5)

  return `
    <div
      class="
        fatblaAdminShell
        compactFatblaAdminShell
        adminOnePageEditor
      "
    >
      <div
        class="
          adminEditCardsGrid
          fatblaOnePageGrid
        "
      >
        ${Array.from({ length: total }, (_, index) => buildFatblaOnePageCard(index + 1)).join("")}
      </div>
    </div>
  `
}

function buildFatblaOnePageCard(number) {
  const n = Number(number || 1)

  const item = getFatblaDraftItem(n)

  const status = getFatblaItemStatus(n)

  const hasMedia = hasText(item.image) || hasText(item.video) || !!item.file || !!item.videoFile

  const missing = []

  if (!hasText(item.answer)) {
    missing.push("الإجابة")
  }

  if (!hasMedia) {
    missing.push("الصورة أو الفيديو")
  }

  return `
    <details
      class="
        adminEditItemCard
        fatblaQuestionOnePageCard
        ${status.className}
      "
      ontoggle="
        handleAdminEditCardToggle(this)
      "
    >

      <summary>

        <div class="adminEditItemTitle">

          <strong>
            الرقم ${n}
          </strong>

          <span>
            ${status.isDone ? "مكتمل" : `ناقص: ${missing.join("، ")}`}
          </span>

        </div>

        <div class="adminEditItemMeta">

          <span class="adminEditStatusPill">
            ${status.label}
          </span>

          <span class="adminEditProgressPill">
            ${status.progress}
          </span>

        </div>

      </summary>
            <div class="adminEditItemBody">

        <div
          class="
            fatblaOnePageLayout
            fatblaOnePageLayoutAnswerOnly
          "
        >

          <div class="fatblaOnePageMedia">

            <div
              class="
                adminField
                ${hasMedia ? "" : "adminMissingField"}
              "
            >
              <label>الصورة</label>

              <input
                type="file"
                id="fatblaFile${n}"
                accept="image/*"
              >
            </div>

            <div
              class="
                adminField
                ${hasMedia ? "" : "adminMissingField"}
              "
            >
              <label>الفيديو</label>

              <input
                type="file"
                id="fatblaVideo${n}"
                accept="video/*"
              >
            </div>

            ${
              !hasMedia
                ? `
                  <div class="adminMissingHint">
                    أضف صورة أو فيديو
                  </div>
                `
                : ""
            }

            <div
              class="
                fatblaPreviewBox
                fatblaPreviewLarge
              "
            >
              ${
                item.video
                  ? `
                    <video
                      src="${escapeHtml(item.video)}"
                      class="previewImg"
                      controls
                    ></video>
                  `
                  : item.image
                    ? `
                      <img
                        src="${escapeHtml(item.image)}"
                        class="previewImg"
                        alt=""
                      >
                    `
                    : `
                      <div class="emptyImageHint">
                        لا توجد صورة أو فيديو
                      </div>
                    `
              }
            </div>

          </div>

          <div class="fatblaOnePageFields">

            <div
              class="
                adminField
                ${getAdminMissingFieldClass(item.answer)}
              "
            >
              <label>الإجابة</label>

              <input
                id="fatblaAnswer${n}"
                placeholder="اكتب الإجابة"
                value="${escapeHtml(item.answer || "")}"
              >

              ${
                !hasText(item.answer)
                  ? `
                    <div class="adminMissingHint">
                      الإجابة ناقصة
                    </div>
                  `
                  : ""
              }
            </div>
                        <button
              type="button"
              class="adminDeleteBtn"
              onclick="
                clearFatblaQuestion(${n})
              "
            >
              حذف الرقم
            </button>

          </div>

        </div>

      </div>

    </details>
  `
}
/* =========================
   FATBLA SAVE
========================= */

async function saveFatblaSection() {
  if (isAdminSaving()) {
    return false
  }

  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")

    return false
  }

  try {
    collectFatblaCurrentDraft()

    setAdminSaving(true, "جارٍ حفظ فتبلة...")

    const finalCount = normalizeRandomChallengeAuctionCount(fatblaAdminCount || 5)

    fatblaAdminCount = finalCount

    const oldRowsResult = await dbSelect("auction_questions", (query) => query.eq("model", Number(currentModel)), {
      select: "id,number,image,video",
      fallback: [],
      logLabel: "READ OLD FATBLA"
    })

    if (!oldRowsResult.ok) {
      console.log("READ OLD FATBLA ERROR:", oldRowsResult.error)

      showGameToast("تعذر قراءة بيانات فتبلة")

      return false
    }

    const oldRows = oldRowsResult.data

    const oldMap = {}

    ;(oldRows || []).forEach((row) => {
      oldMap[Number(row.number)] = row
    })

    const rows = []
    const keepNumbers = []

    for (let number = 1; number <= finalCount; number++) {
      const item = getFatblaDraftItem(number)

      const answer = String(item.answer || "").trim()

      let image = item.image || oldMap[number]?.image || ""

      let video = item.video || oldMap[number]?.video || ""

      if (item.file) {
        image = await uploadImageFile(item.file, `fatbla_${number}`)

        if (!image) {
          showGameToast(`تعذر رفع صورة الرقم ${number}`)

          return false
        }

        video = ""

        item.image = image
        item.video = ""
        item.file = null
        item.videoFile = null
      }

      if (item.videoFile) {
        video = await uploadVideoFile(item.videoFile, `fatbla_video_${number}`)

        if (!video) {
          showGameToast(`تعذر رفع فيديو الرقم ${number}`)

          return false
        }

        image = ""

        item.video = video
        item.image = ""
        item.videoFile = null
        item.file = null
      }

      if (!answer && !image && !video) {
        continue
      }

      if (!answer) {
        showGameToast(`اكتب إجابة الرقم ${number}`)

        return false
      }

      if (!image && !video) {
        showGameToast(`أضف صورة أو فيديو للرقم ${number}`)

        return false
      }

      rows.push({
        model: Number(currentModel),

        number: Number(number),

        question: "",

        answer,

        image,

        video,

        note: ""
      })

      keepNumbers.push(Number(number))
    }
    const settingsResult = await dbUpsert(
      "segment_settings",
      {
        model: Number(currentModel),

        segment: "auction",

        item_count: finalCount
      },
      {
        onConflict: "model,segment",

        logLabel: "SAVE FATBLA SETTINGS"
      }
    )

    if (!settingsResult.ok) {
      showGameToast("تعذر حفظ عدد أرقام فتبلة")

      return false
    }

    if (rows.length) {
      const saveResult = await dbUpsert("auction_questions", rows, {
        onConflict: "model,number",

        logLabel: "SAVE FATBLA"
      })

      if (!saveResult.ok) {
        showGameToast("تعذر حفظ فتبلة")

        return false
      }
    }

    for (const oldRow of oldRows || []) {
      const oldNumber = Number(oldRow.number)

      if (keepNumbers.includes(oldNumber)) {
        continue
      }

      const deleteResult = await dbDelete("auction_questions", (query) => query.eq("model", Number(currentModel)).eq("number", oldNumber), {
        logLabel: "DELETE OLD FATBLA"
      })

      if (!deleteResult.ok) {
        console.log("DELETE OLD FATBLA ERROR:", deleteResult.error)

        showGameToast("تم الحفظ لكن تعذر حذف بعض البيانات القديمة")

        return false
      }
    }

    fatblaAdminLoaded = false

    await loadFatblaAdminDraft(true)

    showGameToast(rows.length ? "تم حفظ فتبلة" : "تم حذف جميع أرقام فتبلة", "success")

    renderAdminRandomChallengePage()

    return true
  } catch (error) {
    console.log("SAVE FATBLA CATCH:", error)

    showGameToast("حدث خطأ أثناء حفظ فتبلة")

    return false
  } finally {
    setAdminSaving(false)
  }
}



/* =========================
   FATBLA DELETE
========================= */

function clearFatblaQuestion(number) {
  const item = getFatblaDraftItem(number)

  item.answer = ""
  item.image = ""
  item.video = ""

  item.file = null
  item.videoFile = null

  renderAdminRandomChallengePage()
}

async function deleteFatblaSection() {
  if (isAdminSaving()) {
    return false
  }

  if (!currentModel) {
    showGameToast(
      "افتح النموذج أولاً",
      "warning"
    )

    return false
  }

  const confirmed =
    window.confirm(
      "هل تريد حذف جميع بيانات فتبلة؟"
    )

  if (!confirmed) {
    return false
  }

  try {
    setAdminSaving(
      true,
      "جارٍ حذف فتبلة..."
    )

    const deleteQuestionsResult =
      await dbDelete(
        "auction_questions",
        query =>
          query.eq(
            "model",
            Number(currentModel)
          ),
        {
          logLabel:
            "DELETE FATBLA QUESTIONS"
        }
      )

    if (!deleteQuestionsResult.ok) {
      console.error(
        "DELETE FATBLA QUESTIONS ERROR:",
        deleteQuestionsResult.error
      )

      showGameToast(
        "تعذر حذف بيانات فتبلة",
        "error"
      )

      return false
    }

    const deleteSettingsResult =
      await dbDelete(
        "segment_settings",
        query =>
          query
            .eq(
              "model",
              Number(currentModel)
            )
            .eq(
              "segment",
              "auction"
            ),
        {
          logLabel:
            "DELETE FATBLA SETTINGS"
        }
      )

    if (!deleteSettingsResult.ok) {
      console.error(
        "DELETE FATBLA SETTINGS ERROR:",
        deleteSettingsResult.error
      )

      showGameToast(
        "تم حذف الأسئلة لكن تعذر حذف إعدادات فتبلة",
        "warning"
      )
    }

    fatblaAdminDraft = {}
    fatblaAdminCount = 5
    fatblaAdminLoaded = false

    await loadFatblaAdminDraft(true)

    renderAdminRandomChallengePage()

    showGameToast(
      "تم حذف جميع بيانات فتبلة",
      "success"
    )

    return true
  } catch (error) {
    console.error(
      "DELETE FATBLA CATCH:",
      error
    )

    showGameToast(
      "حدث خطأ أثناء حذف فتبلة",
      "error"
    )

    return false
  } finally {
    setAdminSaving(false)
  }
}

/* =========================
   FATBLA FILES
========================= */

async function changeFatblaImage(number, file) {
  if (!file) {
    return
  }

  const item = getFatblaDraftItem(number)

  item.file = file
  item.videoFile = null
  item.video = ""

  item.image = URL.createObjectURL(file)

  renderAdminRandomChallengePage()
}

async function changeFatblaVideo(number, file) {
  if (!file) {
    return
  }

  const item = getFatblaDraftItem(number)

  item.videoFile = file
  item.file = null
  item.image = ""

  item.video = URL.createObjectURL(file)

  renderAdminRandomChallengePage()
}
/* =========================
   OPEN / RENDER
========================= */

async function openFatblaAdmin() {
  await loadFatblaAdminDraft()

  renderAdminRandomChallengePage()
}

function renderFatblaAdmin() {
  return buildFatblaAdminContent()
}

function refreshFatblaAdmin() {
  renderAdminRandomChallengePage()
}

/* =========================
   RANDOM CHALLENGE OPEN
========================= */

async function openAdminRandomChallenge() {
  if (adminNavBusy) {
    return
  }

  if (!currentModel) {
    showGameToast("افتح نموذج أولاً", "warning")

    return
  }

  adminNavBusy = true

  try {
    const visibility = await loadGlobalSegmentVisibilityMap()

    if (!isAdminSegmentGloballyEnabled("randomChallenge", visibility)) {
      showGameToast("فقرة التحدي مخفية من إعدادات الفقرات", "warning")

      await goAdminHome()
      return
    }

    currentAdminSegment = "randomChallenge"

    randomChallengeAdminSection = randomChallengeAdminSection || "auction"

    renderAdminSegmentActions()

    await renderAdminTabsUnified()

    if (typeof loadRandomChallengeAdminRows === "function") {
      await loadRandomChallengeAdminRows(randomChallengeAdminSection)
    }

    if (typeof loadFatblaAdminDraft === "function" && randomChallengeAdminSection === "fatbla") {
      await loadFatblaAdminDraft()
    }

    if (typeof renderAdminRandomChallengePage === "function") {
      renderAdminRandomChallengePage()
      return
    }

    showGameToast("دالة عرض فقرة التحدي غير موجودة", "error")

    console.error("Missing function: renderAdminRandomChallengePage")
  } catch (error) {
    console.error("OPEN RANDOM CHALLENGE ERROR:", error)

    showGameToast("تعذر فتح فقرة التحدي", "error")
  } finally {
    adminNavBusy = false
  }
}

/* =========================
   18) Warmup - التسخين
========================= */

let warmupAdminActiveCategory = 1
let warmupAdminDraft = {}

function getWarmupDraftCategory(c) {
  if (!warmupAdminDraft[c]) {
    warmupAdminDraft[c] = {
      category_name: "",
      questions: {
        1: { id: null, question: "", answer: "" },
        2: { id: null, question: "", answer: "" },
        4: { id: null, question: "", answer: "" }
      }
    }
  }

  return warmupAdminDraft[c]
}

function collectWarmupCurrentDraft() {
  for (let c = 1; c <= 4; c++) {
    const cat = getWarmupDraftCategory(c)

    cat.category_name = (document.getElementById(`cat${c}`)?.value || "").trim()

    for (const n of [1, 2, 4]) {
      if (!cat.questions[n]) {
        cat.questions[n] = { id: null, question: "", answer: "" }
      }

      cat.questions[n].question = (document.getElementById(`q${c}_${n}`)?.value || "").trim()
      cat.questions[n].answer = (document.getElementById(`a${c}_${n}`)?.value || "").trim()
    }
  }
}

function isWarmupDraftComplete(category) {
  const cat = getWarmupDraftCategory(category)

  const categoryName = String(cat.category_name || "").trim()
  const q1 = cat.questions[1] || {}
  const q2 = cat.questions[2] || {}
  const q4 = cat.questions[4] || {}

  return !!(
    categoryName &&
    String(q1.question || "").trim() &&
    String(q1.answer || "").trim() &&
    String(q2.question || "").trim() &&
    String(q2.answer || "").trim() &&
    String(q4.question || "").trim() &&
    String(q4.answer || "").trim()
  )
}

function switchWarmupAdminCategory(category) {
  collectWarmupCurrentDraft()
  warmupAdminActiveCategory = Number(category || 1)
  renderWarmupAdminFromDraft()
}

async function renderWarmupAdmin() {
  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")
    return
  }

  const result = await dbSelect(
    "questions",
    (query) =>
      query
        .eq("model", Number(currentModel))
        .eq("segment", "warmup")
        .order("category", {
          ascending: true
        })
        .order("number", {
          ascending: true
        }),
    {
      select: "*",
      fallback: [],
      logLabel: "LOAD WARMUP"
    }
  )

  if (!result.ok) {
    console.log("LOAD WARMUP ERROR:", result.error)

    showGameToast("تعذر تحميل التسخين")
    return
  }

  warmupAdminDraft = {}

  for (let c = 1; c <= 4; c++) {
    getWarmupDraftCategory(c)
  }

  ;(result.data || []).forEach((row) => {
    const c = Number(row.category || 1)
    const n = Number(row.number || 1)

    const cat = getWarmupDraftCategory(c)

    if (row.category_name && String(row.category_name).trim() !== "") {
      cat.category_name = row.category_name
    }

    if ([1, 2, 4].includes(n)) {
      cat.questions[n] = {
        id: row.id || null,
        question: row.question || "",
        answer: row.answer || ""
      }
    }
  })

  renderWarmupAdminFromDraft()
}

async function renderWarmupAdminFromDraft() {
  editor().innerHTML = `
    <div class="warmupAdminShell compactWarmupAdminShell adminOnePageEditor">

      <div class="adminEditorTopBar compactAdminEditorTopBar adminEditorTopBarWithActions">
        <div>
          <h2 class="adminSectionTitle">التسخين</h2>
        </div>

        <div class="adminInlineActions">
          <button onclick="saveWarmup()" class="adminSaveBtn">حفظ</button>
          <button onclick="deleteWarmupSegment()" class="adminDeleteAllBtn">حذف الفقرة</button>
        </div>
      </div>

      <div class="adminEditCardsGrid warmupOnePageGrid">
        ${[1, 2, 3, 4].map((c) => buildWarmupCategoryOnePageCard(c)).join("")}
      </div>

    </div>
  `

  normalizeAdminEditorCards()
}

function buildWarmupCategoryOnePageCard(categoryNumber) {
  const c = Number(categoryNumber || 1)
  const cat = getWarmupDraftCategory(c)
  const status = getWarmupCategoryStatus(c)

  return `
    <details class="adminEditItemCard warmupCategoryOnePageCard ${status.className}" ontoggle="handleAdminEditCardToggle(this)">
      <summary>
        <div class="adminEditItemTitle">
          <strong>الفئة ${c}</strong>
        </div>

        <div class="adminEditItemMeta">
          <span class="adminEditStatusPill">${status.label}</span>
          <span class="adminEditProgressPill">${status.progress}</span>
        </div>
      </summary>

      <div class="adminEditItemBody">
        <div class="adminField ${getAdminMissingFieldClass(cat.category_name)}">
          <input
            id="cat${c}"
            placeholder="اسم الفئة"
            value="${escapeHtml(cat.category_name || "")}"
          >
        </div>

        <div class="adminEditSubGrid warmupQuestionsOnePageGrid">
          ${[1, 2, 4].map((n) => buildWarmupQuestionOnePageCard(c, n)).join("")}
        </div>
      </div>
    </details>
  `
}

function handleAdminEditCardToggle(card) {
  const grid = card?.closest(".adminEditCardsGrid")
  if (!grid) return

  if (card.open) {
    grid.querySelectorAll(".adminEditItemCard").forEach((item) => {
      if (item !== card) item.open = false
    })

    grid.classList.add("hasOpenCard")
  } else {
    const hasOpen = !!grid.querySelector(".adminEditItemCard[open]")
    if (!hasOpen) grid.classList.remove("hasOpenCard")
  }
}

function buildWarmupQuestionOnePageCard(category, number) {
  const c = Number(category || 1)
  const n = Number(number || 1)

  const cat = getWarmupDraftCategory(c)
  const row = cat.questions[n] || { id: null, question: "", answer: "" }
  const status = getWarmupQuestionStatus(c, n)

  return `
    <div class="adminEditSubCard warmupQuestionOnePageCard ${status.className}">
      <div class="adminEditSubHead">
        <strong>${n}</strong>
        <span>${status.label} ${status.progress}</span>
      </div>

      <div class="adminField ${getAdminMissingFieldClass(row.question)}">
        <textarea
          id="q${c}_${n}"
          placeholder="السؤال"
        >${escapeHtml(row.question || "")}</textarea>
      </div>

      <div class="adminField ${getAdminMissingFieldClass(row.answer)}">
        <input
          id="a${c}_${n}"
          placeholder="الإجابة"
          value="${escapeHtml(row.answer || "")}"
        >
      </div>

      <button
        class="adminDeleteMiniBtn"
        type="button"
        onclick="
          window.__warmupDeleteNumber = ${n};
          warmupAdminActiveCategory = ${c};
          clearWarmupQuestionById(${row?.id ?? "null"});
        "
      >
        حذف
      </button>
    </div>
  `
}

function buildWarmupQuestionCompactCard(category, number, row) {
  return `
    <div class="adminQuestionCard warmupQuestionCardCompact">
      <div class="adminQuestionCardTop">
        <div class="adminQuestionTitle">سؤال ${number}</div>

        <button
          class="adminDeleteMiniBtn"
          type="button"
          onclick="
            window.__warmupDeleteNumber = ${number};
            clearWarmupQuestionById(${row?.id ?? "null"});
          "
        >
          حذف
        </button>
      </div>

      <div class="warmupQuestionFieldsCompact">
        <div class="adminField">
          <label>نص السؤال</label>
          <textarea
            id="q${category}_${number}"
            placeholder="اكتب سؤال ${number}"
          >${escapeHtml(row?.question || "")}</textarea>
        </div>

        <div class="adminField">
          <label>الإجابة</label>
          <input
            id="a${category}_${number}"
            placeholder="الإجابة"
            value="${escapeHtml(row?.answer || "")}"
          >
        </div>
      </div>
    </div>
  `
}

async function saveWarmup() {
  if (isAdminSaving()) return false

  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")
    return false
  }

  try {
    collectWarmupCurrentDraft()

    setAdminSaving(true, "جارٍ حفظ التسخين...")
    showGameToast("جارٍ حفظ التسخين...")

    const rows = []

    for (let c = 1; c <= 4; c++) {
      const cat = getWarmupDraftCategory(c)
      const category_name = String(cat.category_name || "").trim()

      for (const n of [1, 2, 4]) {
        const question = String(cat.questions[n]?.question || "").trim()
        const answer = String(cat.questions[n]?.answer || "").trim()

        if (!question && !answer) continue

        rows.push({
          model: Number(currentModel),
          segment: "warmup",
          category: Number(c),
          category_name,
          number: Number(n),
          question,
          answer
        })
      }
    }

    if (!rows.length) {
      const ok = confirm("التسخين فارغ، هل تريد حذف جميع أسئلة التسخين؟")

      if (!ok) {
        showGameToast("تم إلغاء الحفظ")
        return false
      }

      const clearResult = await dbDelete("questions", (query) => query.eq("model", Number(currentModel)).eq("segment", "warmup"), {
        logLabel: "CLEAR WARMUP"
      })

      if (!clearResult.ok) {
        console.log("CLEAR WARMUP ERROR:", clearResult.error)

        showGameToast("تعذر حذف أسئلة التسخين")

        return false
      }

      warmupAdminDraft = {}
      warmupAdminActiveCategory = 1

      showGameToast("تم حذف جميع أسئلة التسخين")

      await renderWarmupAdmin()

      return true
    }

    const oldRowsResult = await dbSelect("questions", (query) => query.eq("model", Number(currentModel)).eq("segment", "warmup"), {
      select: "id, category, number",
      fallback: [],
      logLabel: "READ OLD WARMUP"
    })

    if (!oldRowsResult.ok) {
      console.log("READ OLD WARMUP ERROR:", oldRowsResult.error)

      showGameToast("تعذر قراءة بيانات التسخين الحالية")

      return false
    }

    const oldRows = oldRowsResult.data

    const keepKeys = rows.map((row) => `${row.category}_${row.number}`)

    const saveResult = await dbUpsert("questions", rows, {
      onConflict: "model,segment,category,number",
      logLabel: "SAVE WARMUP"
    })

    if (!saveResult.ok) {
      showGameToast("فشل حفظ التسخين")
      return false
    }

    for (const oldRow of oldRows || []) {
      const key = `${Number(oldRow.category)}_${Number(oldRow.number)}`

      if (!keepKeys.includes(key)) {
        const deleteResult = await dbDelete("questions", (query) => query.eq("id", Number(oldRow.id)), {
          logLabel: "DELETE OLD WARMUP"
        })

        if (!deleteResult.ok) {
          console.log("DELETE OLD WARMUP ERROR:", deleteResult.error)

          showGameToast("تم الحفظ لكن تعذر تنظيف بعض الأسئلة القديمة")

          return false
        }
      }
    }

    showGameToast("تم حفظ التسخين")
    await renderWarmupAdmin()
    await renderAdminTabsUnified()
    return true
  } catch (err) {
    console.log("SAVE WARMUP CATCH:", err)
    showGameToast("توقف حفظ التسخين بسبب خطأ")
    return false
  } finally {
    setAdminSaving(false)
  }
}

async function clearWarmupQuestionById(id) {
  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")
    return
  }

  if (!id) {
    const c = Number(warmupAdminActiveCategory || 1)
    const cat = getWarmupDraftCategory(c)

    const number = Number(window.__warmupDeleteNumber || 0)

    if (number && cat.questions[number]) {
      cat.questions[number] = { id: null, question: "", answer: "" }
      renderWarmupAdminFromDraft()
      showGameToast("تم تفريغ السؤال")
      return
    }

    showGameToast("لا يوجد سؤال محفوظ لحذفه")
    return
  }

  const ok = confirm("هل تريد حذف هذا السؤال نهائيًا؟")
  if (!ok) return

  try {
    const result = await dbDelete("questions", (query) => query.eq("id", Number(id)), {
      select: "*",
      fallback: [],
      logLabel: "DELETE WARMUP BY ID"
    })

    if (!result.ok) {
      console.log("DELETE WARMUP BY ID ERROR:", result.error)

      showGameToast("تعذر مسح السؤال")
      return
    }

    if (!result.data.length) {
      showGameToast("لم يتم العثور على السؤال لحذفه")
      return
    }

    showGameToast("تم مسح السؤال")

    await renderWarmupAdmin()
    await renderAdminTabsUnified()
  } catch (err) {
    console.log("DELETE WARMUP BY ID CATCH:", err)

    showGameToast("حدث خطأ أثناء مسح السؤال")
  }
}

async function deleteWarmupSegment() {
  if (!canRunAdminDelete()) return

  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")
    return
  }

  const ok = confirm("هل تريد حذف جميع أسئلة فقرة التسخين نهائيًا؟")
  if (!ok) return

  try {
    const deleteResult = await dbDelete("questions", (query) => query.eq("model", Number(currentModel)).eq("segment", "warmup"), {
      logLabel: "DELETE WARMUP SEGMENT"
    })

    if (!deleteResult.ok) {
      console.log("DELETE WARMUP SEGMENT ERROR:", deleteResult.error)

      showGameToast("تعذر حذف فقرة التسخين")

      return
    }

    warmupAdminDraft = {}
    warmupAdminActiveCategory = 1

    showGameToast("تم حذف جميع أسئلة التسخين")
    await renderWarmupAdmin()
    await renderAdminTabsUnified()
  } catch (err) {
    console.log("DELETE WARMUP SEGMENT CATCH:", err)
    showGameToast("حدث خطأ أثناء حذف فقرة التسخين")
  }
}

/* =========================
   19) Top 10
========================= */

let top10AdminActiveRound = 1
let top10AdminDraft = {}

function getTop10DraftRound(round) {
  const r = Number(round || 1)

  if (!top10AdminDraft[r]) {
    top10AdminDraft[r] = {
      question: "",
      answers: {}
    }

    for (let i = 1; i <= 10; i++) {
      top10AdminDraft[r].answers[i] = ""
    }
  }

  return top10AdminDraft[r]
}

function collectTop10CurrentDraft() {
  const totalRounds = Number(top10AdminRoundsCount || 3)

  for (let r = 1; r <= totalRounds; r++) {
    const round = getTop10DraftRound(r)

    round.question = (document.getElementById(`topq${r}`)?.value || "").trim()

    for (let i = 1; i <= 10; i++) {
      round.answers[i] = (document.getElementById(`top${r}_${i}`)?.value || "").trim()
    }
  }
}

function getTop10RoundStatus(roundNumber) {
  const round = getTop10DraftRound(roundNumber)

  const fields = [round.question, ...Array.from({ length: 10 }, (_, i) => round.answers[i + 1])]

  const completed = fields.filter(isAdminFieldFilled).length
  return getAdminItemStatus(completed, fields.length)
}

function getTop10AnswerStatus(roundNumber, answerNumber) {
  const round = getTop10DraftRound(roundNumber)
  const answer = round.answers[answerNumber] || ""

  const completed = isAdminFieldFilled(answer) ? 1 : 0
  return getAdminItemStatus(completed, 1)
}

function switchTop10AdminRound(round) {
  collectTop10CurrentDraft()

  const safeRound = Math.min(Math.max(Number(round || 1), 1), Number(top10AdminRoundsCount || 3))

  top10AdminActiveRound = safeRound
  renderTop10AdminFromDraft()
}

function handleTop10RoundToggle(card) {
  if (typeof handleAdminEditCardToggle === "function") {
    handleAdminEditCardToggle(card)
  }

  const grid = card.closest(".top10CleanRoundsGrid")
  if (!grid) return

  const cards = grid.querySelectorAll(".top10CleanRoundCard")

  if (card.open) {
    cards.forEach((item) => {
      if (item !== card) {
        item.classList.add("top10RoundHidden")
        item.open = false
      }
    })
  } else {
    cards.forEach((item) => {
      item.classList.remove("top10RoundHidden")
    })
  }
}

async function renderTop10Admin() {
  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")
    return
  }

  top10AdminRoundsCount = await getSegmentRoundCount("top10", 3, 4)

  const result = await dbSelect(
    "top10_questions",
    (query) =>
      query
        .eq("model", Number(currentModel))
        .order("round", {
          ascending: true
        })
        .order("position", {
          ascending: true
        }),
    {
      select: "*",
      fallback: [],
      logLabel: "LOAD TOP10"
    }
  )

  if (!result.ok) {
    console.log("LOAD TOP10 ERROR:", result.error)

    showGameToast("تعذر تحميل Top 10")
    return
  }

  const data = result.data

  top10AdminDraft = {}

  for (let r = 1; r <= 4; r++) {
    getTop10DraftRound(r)
  }

  ;(data || []).forEach((row) => {
    const r = Number(row.round || 1)
    const p = Number(row.position || 1)
    const round = getTop10DraftRound(r)

    if (row.question && String(row.question).trim() !== "") {
      round.question = row.question
    }

    if (p >= 1 && p <= 10) {
      round.answers[p] = row.answer || ""
    }
  })

  if (top10AdminActiveRound > top10AdminRoundsCount) {
    top10AdminActiveRound = top10AdminRoundsCount
  }

  if (top10AdminActiveRound < 1) {
    top10AdminActiveRound = 1
  }

  await renderTop10AdminFromDraft()
}

async function renderTop10AdminFromDraft() {
  const totalRounds = Number(top10AdminRoundsCount || 3)

  editor().innerHTML = `
    <div class="top10AdminShell top10CleanShell adminOnePageEditor">

      <div class="adminEditorTopBar top10CleanTopBar adminEditorTopBarWithActions">
        <div>
          <h2 class="adminSectionTitle">Top 10</h2>
        </div>

        <div class="adminInlineActions">
          <button onclick="saveTop10()" class="adminSaveBtn">حفظ</button>
          <button onclick="deleteTop10Segment()" class="adminDeleteAllBtn">حذف الفقرة</button>
        </div>
      </div>

      <div class="top10CleanRoundsGrid">
        ${Array.from({ length: totalRounds }, (_, i) => {
          return buildTop10RoundOnePageCard(i + 1)
        }).join("")}
      </div>

    </div>
  `

  normalizeAdminEditorCards()
}

function buildTop10RoundOnePageCard(roundNumber) {
  const r = Number(roundNumber || 1)
  const round = getTop10DraftRound(r)
  const status = getTop10RoundStatus(r)
  const roundStateClass = status.isDone ? "top10Complete" : "top10Incomplete"

  return `
    <details
      class="adminEditItemCard top10CleanRoundCard ${roundStateClass}"
      ontoggle="handleTop10RoundToggle(this)"
    >
      <summary>
        <div class="top10CleanSummaryTitle">
          <strong>الجولة ${r}</strong>
        </div>

        <div class="adminEditItemMeta">
          <span class="adminEditStatusPill">${status.label}</span>
          <span class="adminEditProgressPill">${status.progress}</span>
        </div>
      </summary>

      <div class="adminEditItemBody top10CleanBody">

        <div class="top10CleanQuestionRow">
          <input
            id="topq${r}"
            class="top10CleanQuestionInput ${getAdminMissingFieldClass(round.question)}"
            placeholder="سؤال الجولة ${r}"
            value="${escapeHtml(round.question || "")}"
          >

          <button class="adminDeleteBtn top10CleanDeleteRoundBtn" onclick="clearTop10Round(${r})">
            حذف الجولة
          </button>
        </div>

        <div class="top10CleanAnswersSplit">
          <div class="top10CleanAnswersColumn">
            ${[1, 2, 3, 4, 5]
              .map((answerNumber) => {
                return buildTop10AnswerOnePageCard(r, answerNumber)
              })
              .join("")}
          </div>

          <div class="top10CleanAnswersColumn">
            ${[6, 7, 8, 9, 10]
              .map((answerNumber) => {
                return buildTop10AnswerOnePageCard(r, answerNumber)
              })
              .join("")}
          </div>
        </div>

      </div>
    </details>
  `
}

function buildTop10AnswerOnePageCard(roundNumber, answerNumber) {
  const r = Number(roundNumber || 1)
  const i = Number(answerNumber || 1)

  const round = getTop10DraftRound(r)
  const answer = round.answers[i] || ""
  const isDone = isAdminFieldFilled(answer)

  return `
    <div class="top10CleanAnswerCard ${isDone ? "top10Complete" : "top10Incomplete"}">
      <div class="top10CleanAnswerNumber">${i}</div>

      <input
        id="top${r}_${i}"
        class="top10CleanAnswerInput ${getAdminMissingFieldClass(answer)}"
        placeholder="الإجابة"
        value="${escapeHtml(answer)}"
      >

      <button
        type="button"
        class="top10CleanAnswerDelete"
        onclick="deleteTop10Item(${r}, ${i})"
        ${answer ? "" : "disabled"}
      >
        ×
      </button>
    </div>
  `
}

async function applyTop10RoundsCount() {
  if (isAdminSaving()) return false

  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")
    return false
  }

  try {
    collectTop10CurrentDraft()

    setAdminSaving(true, "جارٍ حفظ العدد...")

    const count = Number(document.getElementById("top10RoundsCountInput")?.value || 3)

    top10AdminRoundsCount = Math.min(Math.max(count, 1), 4)

    const saved = await saveSegmentRoundCount("top10", top10AdminRoundsCount)
    if (!saved) return false

    if (top10AdminActiveRound > top10AdminRoundsCount) {
      top10AdminActiveRound = top10AdminRoundsCount
    }

    showGameToast("تم حفظ عدد جولات Top 10")
    await renderTop10AdminFromDraft()
    await renderAdminTabsUnified()
    return true
  } catch (err) {
    console.log("APPLY TOP10 ROUNDS COUNT ERROR:", err)
    showGameToast("تعذر حفظ عدد جولات Top 10")
    return false
  } finally {
    setAdminSaving(false)
  }
}

async function saveTop10() {
  if (isAdminSaving()) return false

  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")
    return false
  }

  try {
    collectTop10CurrentDraft()

    setAdminSaving(true, "جارٍ حفظ Top 10...")
    showGameToast("جارٍ حفظ Top 10...")

    top10AdminRoundsCount = Number(top10AdminRoundsCount || 3)
    top10AdminRoundsCount = Math.min(Math.max(top10AdminRoundsCount, 1), 4)

    const rows = []
    const keepKeys = []

    for (let r = 1; r <= top10AdminRoundsCount; r++) {
      const round = getTop10DraftRound(r)
      const question = String(round.question || "").trim()

      for (let i = 1; i <= 10; i++) {
        const answer = String(round.answers[i] || "").trim()

        if (!question && !answer) continue

        rows.push({
          model: Number(currentModel),
          round: Number(r),
          position: Number(i),
          question,
          answer
        })

        keepKeys.push(`${r}_${i}`)
      }
    }

    if (!rows.length) {
      const ok = confirm("Top 10 فارغ، هل تريد حذف جميع بياناته؟")

      if (!ok) {
        showGameToast("تم إلغاء الحفظ")
        return false
      }

      const clearResult = await dbDelete("top10_questions", (query) => query.eq("model", Number(currentModel)), {
        logLabel: "CLEAR TOP10"
      })

      if (!clearResult.ok) {
        console.log("CLEAR TOP10 ERROR:", clearResult.error)

        showGameToast("تعذر حذف بيانات Top 10")

        return false
      }

      top10AdminDraft = {}
      top10AdminActiveRound = 1

      showGameToast("تم حذف جميع بيانات Top 10")
      await renderTop10Admin()
      await renderAdminTabsUnified()
      return true
    }

    const saveResult = await dbUpsert("top10_questions", rows, {
      onConflict: "model,round,position",
      logLabel: "SAVE TOP10"
    })

    if (!saveResult.ok) {
      showGameToast("فشل حفظ Top 10")
      return false
    }

    const oldRowsResult = await dbSelect("top10_questions", (query) => query.eq("model", Number(currentModel)), {
      select: "round, position",
      fallback: [],
      logLabel: "READ OLD TOP10"
    })

    if (!oldRowsResult.ok) {
      console.log("READ OLD TOP10 ERROR:", oldRowsResult.error)

      showGameToast("تم الحفظ لكن تعذر قراءة القديم للتنظيف")

      return false
    }

    const oldRows = oldRowsResult.data

    for (const oldRow of oldRows || []) {
      const key = `${Number(oldRow.round)}_${Number(oldRow.position)}`

      if (!keepKeys.includes(key)) {
        const deleteResult = await dbDelete(
          "top10_questions",
          (query) => query.eq("model", Number(currentModel)).eq("round", Number(oldRow.round)).eq("position", Number(oldRow.position)),
          {
            logLabel: "DELETE OLD TOP10"
          }
        )

        if (!deleteResult.ok) {
          console.log("DELETE OLD TOP10 ERROR:", deleteResult.error)

          showGameToast("تم الحفظ لكن تعذر تنظيف بعض بيانات Top 10")

          return false
        }
      }
    }

    showGameToast("تم حفظ Top 10")
    await renderTop10Admin()
    await renderAdminTabsUnified()
    return true
  } catch (err) {
    console.log("SAVE TOP10 CATCH:", err)
    showGameToast("توقف حفظ Top 10 بسبب خطأ")
    return false
  } finally {
    setAdminSaving(false)
  }
}

async function clearTop10Round(r) {
  if (!canRunAdminDelete()) return

  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")
    return
  }

  const ok = confirm(`هل تريد حذف الجولة ${r} من Top 10 نهائيًا؟`)
  if (!ok) return

  try {
    const deleteResult = await dbDelete("top10_questions", (query) => query.eq("model", Number(currentModel)).eq("round", Number(r)), {
      logLabel: "CLEAR TOP10 ROUND"
    })

    if (!deleteResult.ok) {
      console.log("CLEAR TOP10 ROUND ERROR:", deleteResult.error)

      showGameToast("تعذر حذف الجولة")

      return
    }

    showGameToast(`تم حذف الجولة ${r}`)
    await renderTop10Admin()
    await renderAdminTabsUnified()
  } catch (err) {
    console.log("CLEAR TOP10 ROUND CATCH:", err)
    showGameToast("حدث خطأ أثناء حذف الجولة")
  }
}

async function deleteTop10Item(round, position) {
  if (!canRunAdminDelete()) return

  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")
    return
  }

  const ok = confirm(`هل تريد حذف إجابة رقم ${position} من الجولة ${round}؟`)
  if (!ok) return

  const deleteResult = await dbDelete(
    "top10_questions",
    (query) => query.eq("model", Number(currentModel)).eq("round", Number(round)).eq("position", Number(position)),
    {
      logLabel: "DELETE TOP10 ITEM"
    }
  )

  if (!deleteResult.ok) {
    console.log("DELETE TOP10 ITEM ERROR:", deleteResult.error)

    showGameToast("تعذر حذف الإجابة")

    return
  }

  showGameToast(`تم حذف إجابة رقم ${position}`)
  await renderTop10Admin()
  await renderAdminTabsUnified()
}

async function deleteTop10Segment() {
  if (!canRunAdminDelete()) return

  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")
    return
  }

  const ok = confirm("هل تريد حذف فقرة Top 10 كاملة نهائيًا؟")
  if (!ok) return

  try {
    const [rowsRes, settingsRes] = await Promise.all([
      dbDelete("top10_questions", (query) => query.eq("model", Number(currentModel)), {
        logLabel: "DELETE TOP10 QUESTIONS"
      }),

      dbDelete("segment_settings", (query) => query.eq("model", Number(currentModel)).eq("segment", "top10"), {
        logLabel: "DELETE TOP10 SETTINGS"
      })
    ])

    if (rowsRes.error || settingsRes.error) {
      console.log(rowsRes.error || settingsRes.error)
      showGameToast("تعذر حذف فقرة Top 10")
      return
    }

    top10AdminRoundsCount = 3
    top10AdminActiveRound = 1
    top10AdminDraft = {}

    showGameToast("تم حذف فقرة Top 10")
    await renderTop10Admin()
    await renderAdminTabsUnified()
  } catch (err) {
    console.log("DELETE TOP10 SEGMENT CATCH:", err)
    showGameToast("حدث خطأ أثناء حذف فقرة Top 10")
  }
}

/* =========================
   21) Who - من هو
========================= */

let whoAdminActiveNumber = 1
let whoAdminDraft = {}

function getWhoDraftItem(number) {
  const n = Number(number || 1)

  if (!whoAdminDraft[n]) {
    whoAdminDraft[n] = {
      image: "",
      answer: "",
      file: null
    }
  }

  return whoAdminDraft[n]
}

function collectWhoCurrentDraft() {
  const total = Number(whoAdminCount || 15)

  for (let n = 1; n <= total; n++) {
    const item = getWhoDraftItem(n)

    item.answer = (document.getElementById(`whoAnswer${n}`)?.value || "").trim()

    const file = document.getElementById(`who${n}`)?.files?.[0] || null
    if (file) item.file = file
  }
}

function isWhoDraftComplete(number) {
  const item = getWhoDraftItem(number)

  const image = String(item.image || "").trim()
  const answer = String(item.answer || "").trim()

  return !!(answer && (image || item.file))
}

function getWhoItemStatus(number) {
  const item = getWhoDraftItem(number)

  const hasImage = isAdminFieldFilled(item.image) || !!item.file

  const fields = [item.answer, hasImage ? "image" : ""]

  const completed = fields.filter(isAdminFieldFilled).length
  return getAdminItemStatus(completed, fields.length)
}

function switchWhoAdminNumber(number) {
  collectWhoCurrentDraft()

  const safeNumber = Math.min(Math.max(Number(number || 1), 1), Number(whoAdminCount || 15))

  whoAdminActiveNumber = safeNumber
  renderWhoAdminFromDraft()
}

async function renderWhoAdmin() {
  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")
    return
  }

  whoAdminCount = await getAdminSegmentCount("who")

  const result = await dbSelect(
    "who_images",
    (query) =>
      query.eq("model", Number(currentModel)).order("number", {
        ascending: true
      }),
    {
      select: "*",
      fallback: [],
      logLabel: "LOAD WHO"
    }
  )

  if (!result.ok) {
    console.log("LOAD WHO ERROR:", result.error)

    showGameToast("تعذر تحميل من هو")
    return
  }

  const data = result.data

  whoAdminDraft = {}

  for (let i = 1; i <= 15; i++) {
    getWhoDraftItem(i)
  }

  ;(data || []).forEach((row) => {
    const n = Number(row.number || 1)
    const item = getWhoDraftItem(n)

    item.image = row.image || ""
    item.answer = row.answer || ""
    item.file = null
  })

  if (whoAdminActiveNumber < 1 || whoAdminActiveNumber > whoAdminCount) {
    whoAdminActiveNumber = 1
  }

  await renderWhoAdminFromDraft()
}

async function renderWhoAdminFromDraft() {
  const total = Number(whoAdminCount || 15)

  editor().innerHTML = `
    <div class="whoAdminShell compactWhoAdminShell adminOnePageEditor">

      <div class="adminEditorTopBar compactAdminEditorTopBar adminEditorTopBarWithActions">
        <div>
          <h2 class="adminSectionTitle">من هو</h2>
        </div>

        <div class="adminInlineActions">
          <button onclick="saveWho()" class="adminSaveBtn">حفظ من هو</button>
          <button onclick="deleteWhoSegment()" class="adminDeleteAllBtn">حذف الفقرة</button>
        </div>
      </div>

      <div class="adminEditCardsGrid whoOnePageGrid">
        ${Array.from({ length: total }, (_, idx) => {
          const number = idx + 1
          return buildWhoOnePageCard(number)
        }).join("")}
      </div>

    </div>
  `

  normalizeAdminEditorCards()
}

function buildWhoOnePageCard(number) {
  const n = Number(number || 1)
  const item = getWhoDraftItem(n)
  const status = getWhoItemStatus(n)

  const hasImage = isAdminFieldFilled(item.image) || !!item.file

  const missing = []

  if (!isAdminFieldFilled(item.answer)) missing.push("الإجابة")
  if (!hasImage) missing.push("الصورة")

  return `
    <details class="adminEditItemCard whoItemOnePageCard ${status.className}" ontoggle="handleAdminEditCardToggle(this)">
      <summary>
        <div class="adminEditItemTitle">
          <strong>${n}</strong>
          <span>
            ${status.isDone ? "بيانات الصورة مكتملة" : `ناقص: ${missing.join("، ")}`}
          </span>
        </div>

        <div class="adminEditItemMeta">
          <span class="adminEditStatusPill">${status.label}</span>
          <span class="adminEditProgressPill">${status.progress}</span>
        </div>
      </summary>

      <div class="adminEditItemBody">
        <div class="whoOnePageLayout">

          <div class="whoOnePageMedia">
            <div class="adminField ${hasImage ? "" : "adminMissingField"}">
              <label>الصورة</label>
              <input type="file" id="who${n}" accept="image/*">
            </div>

            ${!hasImage ? `<div class="adminMissingHint">الصورة مطلوبة</div>` : ""}

            <div class="whoPreviewBox whoPreviewLarge">
              ${
                item.image
                  ? `<img src="${escapeHtml(item.image)}" class="previewImg">`
                  : `<div class="emptyImageHint">لا توجد صورة حالياً</div>`
              }
            </div>
          </div>

          <div class="whoOnePageFields">
            <div class="adminField ${getAdminMissingFieldClass(item.answer)}">
              <label>الإجابة</label>
              <input
                id="whoAnswer${n}"
                placeholder="اكتب اسم الشخصية / اللاعب / الإجابة"
                value="${escapeHtml(item.answer || "")}"
              >

              ${!isAdminFieldFilled(item.answer) ? `<div class="adminMissingHint">الإجابة ناقصة</div>` : ""}
            </div>

            <button class="adminDeleteBtn" onclick="clearWhoItem(${n})">
              حذف الرقم
            </button>
          </div>

        </div>
      </div>
    </details>
  `
}

function changeWhoCount() {
  collectWhoCurrentDraft()

  const count = Number(document.getElementById("whoCountInput")?.value || 15)
  whoAdminCount = normalizeAdminSegmentCount("who", count)

  if (whoAdminActiveNumber > whoAdminCount) {
    whoAdminActiveNumber = whoAdminCount
  }

  renderWhoAdminFromDraft()
}

async function saveWhoSettingsOnly() {
  if (isAdminSaving()) return false

  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")
    return false
  }

  try {
    collectWhoCurrentDraft()
    setAdminSaving(true, "جارٍ حفظ العدد...")

    const count = Number(document.getElementById("whoCountInput")?.value || 15)
    whoAdminCount = normalizeAdminSegmentCount("who", count)

    const saved = await saveAdminSegmentCount("who", whoAdminCount)
    if (!saved) return false

    updateAdminQuickSettingUI("who", whoAdminCount)

    if (whoAdminActiveNumber > whoAdminCount) {
      whoAdminActiveNumber = whoAdminCount
    }

    showGameToast("تم حفظ عدد أرقام من هو")
    await renderWhoAdminFromDraft()
    await renderAdminTabsUnified()
    return true
  } catch (err) {
    console.log("SAVE WHO SETTINGS CATCH:", err)
    showGameToast("تعذر حفظ عدد من هو")
    return false
  } finally {
    setAdminSaving(false)
  }
}

async function saveWho() {
  if (isAdminSaving()) return false

  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")
    return false
  }

  try {
    collectWhoCurrentDraft()

    setAdminSaving(true, "جارٍ حفظ من هو...")
    showGameToast("جارٍ حفظ من هو...")

    whoAdminCount = normalizeAdminSegmentCount("who", Number(whoAdminCount || 15))

    const oldRowsResult = await dbSelect("who_images", (query) => query.eq("model", Number(currentModel)), {
      select: "number, image",
      fallback: [],
      logLabel: "READ OLD WHO"
    })

    if (!oldRowsResult.ok) {
      console.log("READ OLD WHO ERROR:", oldRowsResult.error)

      showGameToast("تعذر قراءة بيانات من هو القديمة")

      return false
    }

    const oldRows = oldRowsResult.data

    const oldMap = {}

    ;(oldRows || []).forEach((row) => {
      oldMap[Number(row.number)] = row
    })

    const rows = []
    const keepNumbers = []

    for (let i = 1; i <= whoAdminCount; i++) {
      const item = getWhoDraftItem(i)
      const answer = String(item.answer || "").trim()
      const file = item.file || document.getElementById(`who${i}`)?.files?.[0] || null

      let image = oldMap[i]?.image || item.image || ""

      if (file) {
        image = await uploadImageFile(file, `who_${i}`)

        if (!image) {
          showGameToast(`فشل رفع صورة رقم ${i}`)
          return false
        }

        item.file = null
        item.image = image
      }

      if (!image && !answer) continue

      rows.push({
        model: Number(currentModel),
        number: Number(i),
        image,
        answer
      })

      keepNumbers.push(Number(i))
    }

    const existingRowsResult = await dbSelect("who_images", (query) => query.eq("model", Number(currentModel)), {
      select: "number",
      fallback: [],
      logLabel: "READ EXISTING WHO"
    })

    if (!existingRowsResult.ok) {
      console.log("READ EXISTING WHO ERROR:", existingRowsResult.error)

      showGameToast("تعذر قراءة عناصر من هو الحالية")

      return false
    }

    const existingRows = existingRowsResult.data

    for (const oldRow of existingRows || []) {
      const oldNumber = Number(oldRow.number)

      if (!keepNumbers.includes(oldNumber)) {
        const deleteResult = await dbDelete("who_images", (query) => query.eq("model", Number(currentModel)).eq("number", oldNumber), {
          logLabel: "DELETE OLD WHO"
        })

        if (!deleteResult.ok) {
          console.log("DELETE OLD WHO ERROR:", deleteResult.error)

          showGameToast("تعذر تنظيف عناصر من هو القديمة")

          return false
        }
      }
    }

    if (rows.length) {
      const saveResult = await dbUpsert("who_images", rows, {
        onConflict: "model,number",
        logLabel: "SAVE WHO"
      })

      if (!saveResult.ok) {
        showGameToast("فشل حفظ من هو")
        return false
      }
    }

    showGameToast(rows.length ? "تم حفظ من هو" : "تم حذف جميع عناصر من هو")
    await renderWhoAdmin()
    await renderAdminTabsUnified()
    return true
  } catch (err) {
    console.log("SAVE WHO CATCH:", err)
    showGameToast("توقف حفظ من هو بسبب خطأ")
    return false
  } finally {
    setAdminSaving(false)
  }
}

async function clearWhoItem(i) {
  if (!canRunAdminDelete()) return

  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")
    return
  }

  const ok = confirm(`هل تريد حذف العنصر رقم ${i} نهائيًا؟`)
  if (!ok) return

  try {
    const deleteResult = await dbDelete("who_images", (query) => query.eq("model", Number(currentModel)).eq("number", Number(i)), {
      logLabel: "CLEAR WHO ITEM"
    })

    if (!deleteResult.ok) {
      console.log("CLEAR WHO ITEM ERROR:", deleteResult.error)

      showGameToast("تعذر حذف العنصر")

      return
    }

    showGameToast(`تم حذف العنصر ${i}`)
    await renderWhoAdmin()
    await renderAdminTabsUnified()
  } catch (err) {
    console.log("CLEAR WHO ITEM CATCH:", err)
    showGameToast("حدث خطأ أثناء حذف العنصر")
  }
}

async function deleteWhoSegment() {
  if (!canRunAdminDelete()) return

  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")
    return
  }

  const ok = confirm("هل تريد حذف فقرة من هو كاملة نهائيًا؟")
  if (!ok) return

  try {
    const [rowsRes, settingsRes] = await Promise.all([
      dbDelete("who_images", (query) => query.eq("model", Number(currentModel)), {
        logLabel: "DELETE WHO IMAGES"
      }),

      dbDelete("segment_settings", (query) => query.eq("model", Number(currentModel)).eq("segment", "who"), {
        logLabel: "DELETE WHO SETTINGS"
      })
    ])

    if (rowsRes.error || settingsRes.error) {
      console.log(rowsRes.error || settingsRes.error)
      showGameToast("تعذر حذف فقرة من هو")
      return
    }

    whoAdminCount = 15
    whoAdminActiveNumber = 1
    whoAdminDraft = {}

    updateAdminQuickSettingUI("who", whoAdminCount)

    showGameToast("تم حذف فقرة من هو")
    await renderWhoAdmin()
    await renderAdminTabsUnified()
  } catch (err) {
    console.log("DELETE WHO SEGMENT CATCH:", err)
    showGameToast("حدث خطأ أثناء حذف فقرة من هو")
  }
}

/* =========================
   22) Explain - اشرح الكلمة
========================= */

function getExplainDraftItem(number) {
  const n = Number(number || 1)

  if (!explainAdminDraft[n]) {
    explainAdminDraft[n] = {
      id: null,
      word: ""
    }
  }

  return explainAdminDraft[n]
}

function collectExplainDraft() {
  explainAdminCount = normalizeAdminSegmentCount("explain", Number(explainAdminCount || 5))

  for (let i = 1; i <= explainAdminCount; i++) {
    const item = getExplainDraftItem(i)
    item.word = (document.getElementById(`explainWord_${i}`)?.value || "").trim()
  }
}

function isExplainDraftComplete(number) {
  const item = getExplainDraftItem(number)
  return String(item.word || "").trim().length > 0
}

function getExplainItemStatus(number) {
  const item = getExplainDraftItem(number)

  const fields = [item.word]

  const completed = fields.filter(isAdminFieldFilled).length
  return getAdminItemStatus(completed, fields.length)
}

async function renderExplainAdmin() {
  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")
    return
  }

  explainAdminCount = await getAdminSegmentCount("explain")

  const result = await dbSelect(
    "explain_words",
    (query) =>
      query.eq("model", Number(currentModel)).order("number", {
        ascending: true
      }),
    {
      select: "*",
      fallback: [],
      logLabel: "LOAD EXPLAIN"
    }
  )

  if (!result.ok) {
    console.log("LOAD EXPLAIN ERROR:", result.error)

    showGameToast("تعذر تحميل اشرح الكلمة")

    return
  }

  const data = result.data

  explainAdminDraft = {}

  for (let i = 1; i <= 9; i++) {
    getExplainDraftItem(i)
  }

  ;(data || []).forEach((row) => {
    const n = Number(row.number || 1)
    const item = getExplainDraftItem(n)

    item.id = row.id || null
    item.word = row.word || ""
  })

  renderExplainAdminFromDraft()
}

async function renderExplainAdminFromDraft() {
  const total = Number(explainAdminCount || 5)

  editor().innerHTML = `
    <div class="explainAdminShell compactExplainAdminShell adminOnePageEditor">

      <div class="adminEditorTopBar compactAdminEditorTopBar adminEditorTopBarWithActions">
        <div>
          <h2 class="adminSectionTitle">اشرح الكلمة</h2>
        </div>

        <div class="adminInlineActions">
          <button onclick="saveExplain()" class="adminSaveBtn">حفظ اشرح الكلمة</button>
          <button onclick="deleteExplainSegment()" class="adminDeleteAllBtn">حذف الفقرة</button>
        </div>
      </div>

      <div class="adminEditCardsGrid explainOnePageGrid">
        ${Array.from({ length: total }, (_, idx) => {
          const number = idx + 1
          return buildExplainOnePageCard(number)
        }).join("")}
      </div>

    </div>
  `

  normalizeAdminEditorCards()
}

function buildExplainOnePageCard(number) {
  const n = Number(number || 1)
  const item = getExplainDraftItem(n)
  const status = getExplainItemStatus(n)

  const missing = []

  if (!isAdminFieldFilled(item.word)) missing.push("الكلمة")

  return `
    <details class="adminEditItemCard explainItemOnePageCard ${status.className}" ontoggle="handleAdminEditCardToggle(this)">
      <summary>
        <div class="adminEditItemTitle">
          <strong>الكلمة ${n}</strong>
          <span>
            ${status.isDone ? "الكلمة مكتملة" : `ناقص: ${missing.join("، ")}`}
          </span>
        </div>

        <div class="adminEditItemMeta">
          <span class="adminEditStatusPill">${status.label}</span>
          <span class="adminEditProgressPill">${status.progress}</span>
        </div>
      </summary>

      <div class="adminEditItemBody">
        <div class="explainOnePageLayout">

          <div class="adminField ${getAdminMissingFieldClass(item.word)}">
            <label>الكلمة</label>
            <input
              id="explainWord_${n}"
              placeholder="اكتب الكلمة رقم ${n}"
              value="${escapeHtml(item.word || "")}"
            >

            ${!isAdminFieldFilled(item.word) ? `<div class="adminMissingHint">الكلمة ناقصة</div>` : ""}
          </div>

          <button
            type="button"
            class="adminDeleteBtn"
            onclick="clearExplainWord(${n})"
            ${!item.word ? "disabled" : ""}
          >
            حذف الكلمة
          </button>

        </div>
      </div>
    </details>
  `
}

function changeExplainWordsCount() {
  collectExplainDraft()

  const count = Number(document.getElementById("explainWordsCountInput")?.value || 5)
  explainAdminCount = normalizeAdminSegmentCount("explain", count)

  renderExplainAdminFromDraft()
}

async function saveExplainSettingsOnly() {
  if (isAdminSaving()) return false

  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")
    return false
  }

  try {
    collectExplainDraft()
    setAdminSaving(true, "جارٍ حفظ العدد...")

    const count = Number(document.getElementById("explainWordsCountInput")?.value || 5)
    explainAdminCount = normalizeAdminSegmentCount("explain", count)

    const saved = await saveAdminSegmentCount("explain", explainAdminCount)
    if (!saved) return false

    updateAdminQuickSettingUI("explain", explainAdminCount)

    showGameToast("تم حفظ عدد كلمات اشرح الكلمة")
    await renderExplainAdminFromDraft()
    await renderAdminTabsUnified()
    return true
  } catch (err) {
    console.log("SAVE EXPLAIN SETTINGS CATCH:", err)
    showGameToast("تعذر حفظ عدد الكلمات")
    return false
  } finally {
    setAdminSaving(false)
  }
}

async function saveExplain() {
  if (isAdminSaving()) return false

  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")
    return false
  }

  try {
    collectExplainDraft()

    setAdminSaving(true, "جارٍ حفظ اشرح الكلمة...")
    showGameToast("جارٍ حفظ اشرح الكلمة...")

    explainAdminCount = normalizeAdminSegmentCount("explain", Number(explainAdminCount || 5))

    const rows = []
    const keepNumbers = []

    const settingsResult = await dbUpsert(
      "segment_settings",
      {
        model: Number(currentModel),
        segment: "explain",
        item_count: explainAdminCount
      },
      {
        onConflict: "model,segment",
        logLabel: "SAVE EXPLAIN SETTINGS"
      }
    )

    if (!settingsResult.ok) {
      showGameToast("تعذر حفظ عدد كلمات اشرح الكلمة")

      return false
    }

    for (let i = 1; i <= explainAdminCount; i++) {
      const item = getExplainDraftItem(i)
      const word = String(item.word || "").trim()

      if (!word) continue

      rows.push({
        model: Number(currentModel),
        number: Number(i),
        word,
        updated_at: new Date().toISOString()
      })

      keepNumbers.push(Number(i))
    }

    const oldRowsResult = await dbSelect("explain_words", (query) => query.eq("model", Number(currentModel)), {
      select: "number",
      fallback: [],
      logLabel: "READ OLD EXPLAIN"
    })

    if (!oldRowsResult.ok) {
      console.log("READ OLD EXPLAIN ERROR:", oldRowsResult.error)

      showGameToast("تعذر قراءة كلمات اشرح القديمة")

      return false
    }

    const oldRows = oldRowsResult.data

    for (const oldRow of oldRows || []) {
      const oldNumber = Number(oldRow.number)

      if (!keepNumbers.includes(oldNumber)) {
        const deleteResult = await dbDelete("explain_words", (query) => query.eq("model", Number(currentModel)).eq("number", oldNumber), {
          logLabel: "DELETE OLD EXPLAIN"
        })

        if (!deleteResult.ok) {
          console.log("DELETE OLD EXPLAIN ERROR:", deleteResult.error)

          showGameToast("تعذر تنظيف بعض كلمات اشرح")

          return false
        }
      }
    }

    if (rows.length) {
      const saveResult = await dbUpsert("explain_words", rows, {
        onConflict: "model,number",
        logLabel: "SAVE EXPLAIN"
      })

      if (!saveResult.ok) {
        showGameToast("فشل حفظ كلمات اشرح")
        return false
      }
    }

    showGameToast(rows.length ? "تم حفظ اشرح الكلمة" : "تم حذف كلمات اشرح الكلمة")
    await renderExplainAdmin()
    await renderAdminTabsUnified()
    return true
  } catch (err) {
    console.log("SAVE EXPLAIN CATCH:", err)
    showGameToast("توقف حفظ اشرح الكلمة بسبب خطأ")
    return false
  } finally {
    setAdminSaving(false)
  }
}

async function clearExplainWord(number) {
  const n = Number(number || 0)
  if (!n) return

  const item = getExplainDraftItem(n)
  item.word = ""

  const input = document.getElementById(`explainWord_${n}`)
  if (input) input.value = ""

  showGameToast(`تم تفريغ الكلمة ${n}`)
  await renderExplainAdminFromDraft()
}

async function deleteExplainSegment() {
  if (!canRunAdminDelete()) return

  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")
    return
  }

  const ok = confirm("هل تريد حذف فقرة اشرح الكلمة كاملة؟")
  if (!ok) return

  try {
    const [wordsRes, settingsRes] = await Promise.all([
      dbDelete("explain_words", (query) => query.eq("model", Number(currentModel)), {
        logLabel: "DELETE EXPLAIN WORDS"
      }),

      dbDelete("segment_settings", (query) => query.eq("model", Number(currentModel)).eq("segment", "explain"), {
        logLabel: "DELETE EXPLAIN SETTINGS"
      })
    ])

    if (wordsRes.error || settingsRes.error) {
      console.log(wordsRes.error || settingsRes.error)
      showGameToast("تعذر حذف فقرة اشرح الكلمة")
      return
    }

    explainAdminCount = 5
    explainAdminDraft = {}

    updateAdminQuickSettingUI("explain", explainAdminCount)

    showGameToast("تم حذف فقرة اشرح الكلمة")
    await renderExplainAdmin()
    await renderAdminTabsUnified()
  } catch (err) {
    console.log("DELETE EXPLAIN CATCH:", err)
    showGameToast("حدث خطأ أثناء حذف اشرح الكلمة")
  }
}

/* =========================
   23) Final Helpers
========================= */

async function renderFinalAdmin() {
  finalAdminRound = 1
  await renderFinalAdminRound(1)
}

function getFinalAdminRoundTitle(round) {
  if (round === 1) return "ٮدوں ٮڡاط"
  if (round === 2) return "صح صحلي"
  if (round === 3) return "قصة"
  if (round === 4) return "التركيز"

  return "الفاصلة"
}
function getFinalStoryDbNumber(displayNumber) {
  return 200 + Number(displayNumber || 1)
}

function getFinalRound4DbNumber(displayNumber) {
  const n = Number(displayNumber || 0)

  if (n === 3) return 101
  if (n === 6) return 102

  // توافق مع الكود القديم لو كان يرسل 1 و 2
  if (n === 1) return 101
  if (n === 2) return 102

  return 0
}

function isFinalRound2ImageNumber(number) {
  const n = Number(number || 0)
  return n === 3 || n === 6
}

function isFinalRound2ScrambleNumber(number) {
  const n = Number(number || 0)
  return n === 1 || n === 4
}

function isFinalRound2SequenceNumber(number) {
  const n = Number(number || 0)
  return n === 2 || n === 5
}

async function getFinalAdminDoneMap() {
  const doneMap = {
    1: false,
    2: false,
    3: false,
    4: false
  }

  if (!currentModel) return doneMap

  const [r1Res, r2Res, r3Res] = await Promise.all([
    dbSelect("final_round1_items", (query) => query.eq("model", Number(currentModel)), {
      select: "*",
      fallback: [],
      logLabel: "LOAD FINAL ROUND 1"
    }),

    dbSelect("final_round2_items", (query) => query.eq("model", Number(currentModel)), {
      select: "*",
      fallback: [],
      logLabel: "LOAD FINAL ROUND 2"
    }),

    dbSelect("final_round3_items", (query) => query.eq("model", Number(currentModel)), {
      select: "*",
      fallback: [],
      logLabel: "LOAD FINAL ROUND 3"
    })
  ])

  if (!r1Res.ok || !r2Res.ok || !r3Res.ok) {
    console.log(r1Res.error || r2Res.error || r3Res.error)

    return doneMap
  }

  /* Round 1 - ٮدوں ٮڡاط */
  const r1Count = await getAdminSegmentCount("finalRound1")
  const r1Map = {}

  ;(r1Res.data || []).forEach((row) => {
    const number = Number(row.number)

    if (number >= 1 && number <= 9) {
      r1Map[number] = row
    }
  })

  let round1Done = true

  for (let i = 1; i <= r1Count; i++) {
    const row = r1Map[i]

    if (!row) {
      round1Done = false
      break
    }

    if (!hasText(row.card_text) || !hasText(row.answer)) {
      round1Done = false
      break
    }
  }

  doneMap[1] = round1Done

  /* Round 2 - صح صحلي */
  const r2Map = {}

  ;(r2Res.data || []).forEach((row) => {
    r2Map[`${Number(row.number)}_${Number(row.item_order)}`] = row
  })

  let round2Done = true

  for (const number of [1, 2, 4, 5]) {
    const isScramble = isFinalRound2ScrambleNumber(number)

    for (let i = 1; i <= 6; i++) {
      const row = r2Map[`${number}_${i}`]

      if (!row || !hasText(row.prompt)) {
        round2Done = false
        break
      }

      if (isScramble && !hasText(row.answer)) {
        round2Done = false
        break
      }
    }

    if (!round2Done) break
  }

  /* Round 2 image numbers - رقم 3 و 6 */
  const imageMap = {}

  ;(r3Res.data || []).forEach((row) => {
    const dbNumber = Number(row.number)
    const imageOrder = Number(row.image_order || 1)

    if (dbNumber === 101 || dbNumber === 102) {
      imageMap[`${dbNumber}_${imageOrder}`] = row
    }
  })

  for (const displayNumber of [3, 6]) {
    const dbNumber = getFinalRound4DbNumber(displayNumber)

    for (let i = 1; i <= 5; i++) {
      const row = imageMap[`${dbNumber}_${i}`]

      if (!row || !hasText(row.image) || !hasText(row.answer)) {
        round2Done = false
        break
      }
    }

    if (!round2Done) break
  }

  doneMap[2] = round2Done

  /* Round 3 - قصة */
  const storyCount = await getAdminSegmentCount("finalRound3")
  const storyMap = {}

  ;(r1Res.data || []).forEach((row) => {
    const number = Number(row.number)

    if (number >= 201 && number <= 209) {
      storyMap[number] = row
    }
  })

  let round3Done = true

  for (let displayNumber = 1; displayNumber <= storyCount; displayNumber++) {
    const dbNumber = getFinalStoryDbNumber(displayNumber)
    const row = storyMap[dbNumber]

    if (!row) {
      round3Done = false
      break
    }

    const hasAnyPart = hasText(row.question_part1) || hasText(row.question_part2) || hasText(row.question_part3)

    if (!hasAnyPart || !hasText(row.answer)) {
      round3Done = false
      break
    }
  }

  doneMap[3] = round3Done

  /* Round 4 - التركيز */

  const focusCount = await getAdminSegmentCount("finalRound4")

  const focusMap = {}

  ;(r3Res.data || []).forEach((row) => {
    const number = Number(row.number)

    const imageOrder = Number(row.image_order || 1)

    if (number >= 1 && number <= focusCount && imageOrder === 1) {
      focusMap[number] = row
    }
  })

  let round4Done = focusCount > 0

  for (let number = 1; number <= focusCount; number++) {
    const row = focusMap[number]

    if (!row) {
      round4Done = false
      break
    }

    if (!hasText(row.image) && !hasText(row.video)) {
      round4Done = false
      break
    }

    if (!hasText(row.question) || !hasText(row.answer)) {
      round4Done = false
      break
    }
  }

  doneMap[4] = round4Done

  return doneMap
}

/* =========================
   24) Final Main Render
========================= */

function getFinalRound1ItemStatus(row = {}) {
  const fields = [row.card_text, row.answer]

  const completed = fields.filter(isAdminFieldFilled).length
  return getAdminItemStatus(completed, fields.length)
}

function getFinalRound1InputStatus(number, map) {
  const row = map[number] || {}
  return getFinalRound1ItemStatus(row)
}

async function renderFinalAdminRound(round) {
  finalAdminRound = Number(round || 1)

  const safeRound = Math.min(Math.max(Number(round || 1), 1), 4)
  const title = getFinalAdminRoundTitle(safeRound)

  let html = `
    <div class="finalAdminShell cleanFinalAdminShell adminOnePageEditor">
      <div class="adminEditorTopBar compactAdminEditorTopBar adminEditorTopBarWithActions">
        <div>
          <h2 class="adminSectionTitle">${escapeHtml(title)}</h2>
        </div>

        <div class="adminInlineActions">
          <button onclick="saveFinalRound(${safeRound})" class="adminSaveBtn">
            حفظ ${escapeHtml(title)}
          </button>

          <button onclick="deleteFinalRound(${safeRound})" class="adminDeleteAllBtn">
            حذف الفقرة
          </button>
        </div>
      </div>
  `

  if (safeRound === 1) html += await buildFinalRound1Admin()
  if (safeRound === 2) html += await buildFinalRound2Admin()
  if (safeRound === 3) html += await buildFinalRound3StoryAdmin()
  if (safeRound === 4) html += await buildFinalRound3FocusAdmin()

  html += `
    </div>
  `

  editor().innerHTML = html
  normalizeAdminEditorCards()
}

async function changeFinalRound1CardsCount() {
  const count = Number(document.getElementById("finalRound1CardsCount")?.value || 7)

  finalRound1AdminCount = normalizeAdminSegmentCount("finalRound1", count)

  await saveAdminSegmentCount("finalRound1", finalRound1AdminCount)

  updateAdminQuickSettingUI("finalRound1", finalRound1AdminCount)

  await renderFinalAdminRound(1)
  await renderAdminTabsUnified()
}

async function changeFinalRound3Count() {
  const count = Number(document.getElementById("finalRound3Count")?.value || 5)

  finalRound3AdminCount = normalizeAdminSegmentCount("finalRound3", count)

  await saveAdminSegmentCount("finalRound3", finalRound3AdminCount)

  updateAdminQuickSettingUI("finalRound3", finalRound3AdminCount)

  await renderFinalAdminRound(3)
  await renderAdminTabsUnified()
}

async function changeFinalRound4Count() {
  const count = Number(document.getElementById("finalRound4Count")?.value || 5)

  finalRound4AdminCount = normalizeAdminSegmentCount("finalRound4", count)

  await saveAdminSegmentCount("finalRound4", finalRound4AdminCount)

  updateAdminQuickSettingUI("finalRound4", finalRound4AdminCount)

  await renderFinalAdminRound(4)
  await renderAdminTabsUnified()
}

async function saveFinalRound(round) {
  if (isAdminSaving()) return false

  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")
    return false
  }

  try {
    const safeRound = Number(round || 1)
    const title = getFinalAdminRoundTitle(safeRound)

    setAdminSaving(true, `جارٍ حفظ ${title}...`)

    const metaResult = await dbUpsert(
      "final_round_meta",
      [
        {
          model: Number(currentModel),
          round: Number(safeRound),
          title,
          cards_count: null,
          round3_mode: safeRound === 4 ? "team_media" : null
        }
      ],
      {
        onConflict: "model,round",
        logLabel: "SAVE FINAL ROUND META"
      }
    )

    if (!metaResult.ok) {
      showGameToast("تعذر حفظ بيانات الجولة")
      return false
    }

    let saved = false

    if (safeRound === 1) saved = await saveFinalRound1(true)
    if (safeRound === 2) saved = await saveFinalRound2(true)
    if (safeRound === 3) saved = await saveFinalRound3Story(true)
    if (safeRound === 4) saved = await saveFinalRound3Focus(true)

    if (!saved) return false

    showGameToast(`تم حفظ ${title}`)
    await renderFinalAdminRound(safeRound)
    await renderAdminTabsUnified()
    return true
  } catch (err) {
    console.log("SAVE FINAL ROUND ERROR:", err)
    showGameToast("توقف حفظ الفقرة بسبب خطأ")
    return false
  } finally {
    setAdminSaving(false)
  }
}

/* =========================
   25) Final Round 1 - ٮدوں ٮڡاط
========================= */

async function buildFinalRound1Admin() {
  const result = await dbSelect(
    "final_round1_items",
    (query) =>
      query.eq("model", Number(currentModel)).gte("number", 1).lte("number", 9).order("number", {
        ascending: true
      }),
    {
      select: "*",
      fallback: [],
      logLabel: "LOAD FINAL ROUND 1"
    }
  )

  if (!result.ok) {
    console.log("LOAD FINAL ROUND 1 ERROR:", result.error)

    return `
      <div class="adminCard">
        تعذر تحميل ٮدوں ٮڡاط
      </div>
    `
  }

  const map = {}

  ;(result.data || []).forEach((row) => {
    map[Number(row.number)] = row
  })

  const cardsCount = await getAdminSegmentCount("finalRound1")

  return `
    <div class="adminEditCardsGrid finalRound1OnePageGrid">
      ${Array.from({ length: cardsCount }, (_, idx) => {
        const number = idx + 1

        return buildFinalRound1OnePageCard(number, map)
      }).join("")}
    </div>
  `
}

function buildFinalRound1OnePageCard(number, map = {}) {
  const n = Number(number || 1)
  const row = map[n] || {}
  const status = getFinalRound1InputStatus(n, map)

  const missing = []

  if (!isAdminFieldFilled(row.card_text)) missing.push("السؤال بدون نقط")
  if (!isAdminFieldFilled(row.answer)) missing.push("الإجابة")

  return `
    <details class="adminEditItemCard finalRound1OnePageCard ${status.className}" ontoggle="handleAdminEditCardToggle(this)">
      <summary>
        <div class="adminEditItemTitle">
          <strong>رقم ${n}</strong>
          <span>
            ${status.isDone ? "بيانات الرقم مكتملة" : `ناقص: ${missing.join("، ")}`}
          </span>
        </div>

        <div class="adminEditItemMeta">
  <span class="adminEditStatusPill">${status.label}</span>
  <span class="adminEditProgressPill">${status.progress}</span>

  <button
    type="button"
    class="adminDeleteBtn finalRound1SummaryDeleteBtn"
    onclick="event.preventDefault(); event.stopPropagation(); clearFinalRound1Item(${n});"
  >
    حذف
  </button>
</div>
      </summary>

      <div class="adminEditItemBody">
        <div class="finalRound1OnePageLayout">

          <div class="adminField ${getAdminMissingFieldClass(row.card_text)}">
            <label>السؤال بدون نقط</label>
            <textarea
              id="finalRound1CardText_${n}"
              placeholder="اكتب السؤال بدون نقط"
            >${escapeHtml(row.card_text || "")}</textarea>

            ${!isAdminFieldFilled(row.card_text) ? `<div class="adminMissingHint">السؤال ناقص</div>` : ""}
          </div>

          <div class="adminField ${getAdminMissingFieldClass(row.answer)}">
            <label>الإجابة</label>
            <textarea
  id="finalRound1Answer_${n}"
  placeholder="الإجابة"
>${escapeHtml(row.answer || "")}</textarea>

            ${!isAdminFieldFilled(row.answer) ? `<div class="adminMissingHint">الإجابة ناقصة</div>` : ""}
          </div>

        </div>
      </div>
    </details>
  `
}

async function saveFinalRound1(skipSavingLock = false) {
  if (!skipSavingLock && isAdminSaving()) return false

  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")
    return false
  }

  try {
    if (!skipSavingLock) {
      setAdminSaving(true, "جارٍ حفظ ٮدوں ٮڡاط...")
    }

    const safeCardsCount = normalizeAdminSegmentCount(
      "finalRound1",
      Number(finalRound1AdminCount || (await getAdminSegmentCount("finalRound1")))
    )

    finalRound1AdminCount = safeCardsCount

    const countSaved = await saveAdminSegmentCount("finalRound1", safeCardsCount)

    if (!countSaved) {
      return false
    }

    const rows = []

    for (let i = 1; i <= safeCardsCount; i++) {
      const answer = (document.getElementById(`finalRound1Answer_${i}`)?.value || "").trim()

      const cardText = (document.getElementById(`finalRound1CardText_${i}`)?.value || "").trim()

      if (!answer && !cardText) continue

      rows.push({
        model: Number(currentModel),
        number: Number(i),
        image: "",
        answer,
        note: "",
        card_text: cardText,
        question_part1: "",
        question_part2: "",
        question_part3: ""
      })
    }

    const keepNumbers = rows.map((row) => Number(row.number))

    const existingRowsResult = await dbSelect(
      "final_round1_items",
      (query) => query.eq("model", Number(currentModel)).gte("number", 1).lte("number", 9),
      {
        select: "number",
        fallback: [],
        logLabel: "READ FINAL ROUND 1 EXISTING"
      }
    )

    if (!existingRowsResult.ok) {
      console.log("READ FINAL ROUND 1 EXISTING ERROR:", existingRowsResult.error)

      showGameToast("تعذر قراءة عناصر ٮدوں ٮڡاط الحالية")

      return false
    }

    const existingRows = existingRowsResult.data

    for (const oldRow of existingRows || []) {
      const oldNumber = Number(oldRow.number)

      if (!keepNumbers.includes(oldNumber)) {
        const deleteResult = await dbDelete(
          "final_round1_items",
          (query) => query.eq("model", Number(currentModel)).eq("number", oldNumber),
          {
            logLabel: "DELETE FINAL ROUND 1 OLD"
          }
        )

        if (!deleteResult.ok) {
          console.log("DELETE FINAL ROUND 1 OLD ERROR:", deleteResult.error)

          showGameToast("تعذر تنظيف عناصر ٮدوں ٮڡاط")

          return false
        }
      }
    }

    if (rows.length) {
      const saveResult = await dbUpsert("final_round1_items", rows, {
        onConflict: "model,number",
        logLabel: "SAVE FINAL ROUND 1"
      })

      if (!saveResult.ok) {
        showGameToast("فشل حفظ ٮدوں ٮڡاط")
        return false
      }
    }

    showGameToast(rows.length ? "تم حفظ ٮدوں ٮڡاط" : "تم حذف بيانات ٮدوں ٮڡاط")
    return true
  } catch (err) {
    console.log("SAVE FINAL ROUND 1 CATCH:", err)
    showGameToast("توقف حفظ ٮدوں ٮڡاط بسبب خطأ")
    return false
  } finally {
    if (!skipSavingLock) setAdminSaving(false)
  }
}

/* =========================
   26) Final Round 2 - صح صحلي
========================= */
function getFinalRound2TextStatus(number, rows = []) {
  const isScramble = isFinalRound2ScrambleNumber(number)

  const fields = []

  for (let i = 1; i <= 6; i++) {
    const row = rows.find((x) => Number(x.item_order) === i) || {}

    fields.push(row.prompt)

    if (isScramble) {
      fields.push(row.hint)
      fields.push(row.answer)
    }
  }

  const completed = fields.filter(isAdminFieldFilled).length
  return getAdminItemStatus(completed, fields.length)
}

function getFinalRound2ImageStatus(displayNumber, rows = []) {
  const fields = []

  for (let i = 1; i <= 5; i++) {
    const row = rows.find((x) => Number(x.image_order) === i) || {}

    fields.push(row.image)
    fields.push(row.answer)
  }

  const completed = fields.filter(isAdminFieldFilled).length
  return getAdminItemStatus(completed, fields.length)
}

async function buildFinalRound2Admin() {
  const [textRes, imageRes] = await Promise.all([
    dbSelect(
      "final_round2_items",
      (query) =>
        query
          .eq("model", Number(currentModel))
          .order("number", {
            ascending: true
          })
          .order("item_order", {
            ascending: true
          }),
      {
        select: "*",
        fallback: [],
        logLabel: "LOAD FINAL ROUND 2"
      }
    ),

    dbSelect(
      "final_round3_items",
      (query) =>
        query
          .eq("model", Number(currentModel))
          .order("number", {
            ascending: true
          })
          .order("image_order", {
            ascending: true
          }),
      {
        select: "*",
        fallback: [],
        logLabel: "LOAD FINAL ROUND 2 IMAGES"
      }
    )
  ])

  if (!textRes.ok) {
    console.log("LOAD FINAL ROUND 2 ERROR:", textRes.error)

    return `
      <div class="adminCard">
        تعذر تحميل صح صحلي
      </div>
    `
  }

  if (!imageRes.ok) {
    console.log("LOAD FINAL ROUND 2 IMAGES ERROR:", imageRes.error)

    return `
      <div class="adminCard">
        تعذر تحميل صور صح صحلي
      </div>
    `
  }

  const grouped = {
    1: [],
    2: [],
    4: [],
    5: []
  }

  ;(textRes.data || []).forEach((row) => {
    const n = Number(row.number || 1)

    if (!grouped[n]) {
      grouped[n] = []
    }

    grouped[n].push(row)
  })

  const imageGrouped = {
    3: [],
    6: []
  }

  ;(imageRes.data || []).forEach((row) => {
    const dbNumber = Number(row.number)

    if (dbNumber === 101) {
      imageGrouped[3].push(row)
    }

    if (dbNumber === 102) {
      imageGrouped[6].push(row)
    }
  })

  return `
    <div class="adminEditCardsGrid finalRound2OnePageGrid">
      ${[1, 2, 3, 4, 5, 6]
        .map((number) => {
          if (isFinalRound2ImageNumber(number)) {
            return buildFinalRound2ImageOnePageCard(number, imageGrouped[number] || [])
          }

          return buildFinalRound2TextOnePageCard(number, grouped[number] || [])
        })
        .join("")}
    </div>
  `
}

function buildFinalRound2TextOnePageCard(number, rows = []) {
  const n = Number(number || 1)
  const isScramble = isFinalRound2ScrambleNumber(n)
  const title = isScramble ? "كلمات مبعثرة" : "ترتيب / تسلسل"
  const status = getFinalRound2TextStatus(n, rows)

  const missing = []

  for (let i = 1; i <= 6; i++) {
    const row = rows.find((x) => Number(x.item_order) === i) || {}

    if (!isAdminFieldFilled(row.prompt)) missing.push(`${i}: النص`)

    if (isScramble) {
      if (!isAdminFieldFilled(row.hint)) missing.push(`${i}: التلميحة`)
      if (!isAdminFieldFilled(row.answer)) missing.push(`${i}: الإجابة`)
    }
  }

  return `
    <details class="adminEditItemCard finalRound2OnePageCard ${status.className}" ontoggle="handleAdminEditCardToggle(this)">
      <summary>
        <div class="adminEditItemTitle">
          <strong>رقم ${n} - ${title}</strong>
          <span>
            ${status.isDone ? "بيانات الرقم مكتملة" : `ناقص: ${missing.slice(0, 4).join("، ")}${missing.length > 4 ? "..." : ""}`}
          </span>
        </div>

        <div class="adminEditItemMeta">
          <span class="adminEditStatusPill">${status.label}</span>
          <span class="adminEditProgressPill">${status.progress}</span>

          <button
            type="button"
            class="adminDeleteBtn finalRound2SummaryDeleteBtn"
            onclick="event.preventDefault(); event.stopPropagation(); clearFinalRound2Item(${n});"
          >
            حذف
          </button>
        </div>
      </summary>

      <div class="adminEditItemBody">
        ${isScramble ? buildFinalRound2ScrambleBody(n, rows) : buildFinalRound2SequenceBody(n, rows)}
      </div>
    </details>
  `
}

function syncFinalRound2Answer(number, order) {
  const prompt = document.getElementById(`finalRound2Prompt_${number}_${order}`)
  const answer = document.getElementById(`finalRound2Answer_${number}_${order}`)

  if (!prompt || !answer) return
  answer.value = prompt.value
}

function buildFinalRound2ScrambleBody(number, rows = []) {
  return `
    <div class="finalRound2ScrambleOnePageGrid">
      ${Array.from({ length: 6 }, (_, idx) => {
        const i = idx + 1
        const row = rows.find((x) => Number(x.item_order) === i) || {}

        return `
          <div class="finalRound2ScrambleItemCard">
            <div class="finalRound2CompactIndex">${i}</div>

            <div class="adminField ${getAdminMissingFieldClass(row.prompt)}">
              <label>الكلمة</label>
              <input
                id="finalRound2Prompt_${number}_${i}"
                placeholder="الكلمة"
                value="${escapeHtml(row.prompt || "")}"
                oninput="syncFinalRound2Answer(${number}, ${i})"
              >
            </div>

            <div class="adminField ${getAdminMissingFieldClass(row.hint)}">
              <label>التلميحة</label>
              <input
                id="finalRound2Hint_${number}_${i}"
                placeholder="التلميحة"
                value="${escapeHtml(row.hint || "")}"
              >
            </div>

            <input
              type="hidden"
              id="finalRound2Answer_${number}_${i}"
              value="${escapeHtml(row.answer || row.prompt || "")}"
            >
          </div>
        `
      }).join("")}
    </div>
  `
}

function buildFinalRound2SequenceBody(number, rows = []) {
  return `
    <div class="finalRound2SequenceOnePageGrid">
      ${Array.from({ length: 6 }, (_, idx) => {
        const i = idx + 1
        const row = rows.find((x) => Number(x.item_order) === i) || {}

        return `
          <div class="finalRound2SequenceItemCard">
            <div class="finalRound2CompactIndex">${i}</div>

            <input
              id="finalRound2Prompt_${number}_${i}"
              placeholder="اكتب النص"
              value="${escapeHtml(row.prompt || "")}"
              class="${getAdminMissingFieldClass(row.prompt)}"
            >
          </div>
        `
      }).join("")}
    </div>
  `
}

function buildFinalRound2ImageOnePageCard(displayNumber, rows = []) {
  const n = Number(displayNumber || 3)
  const status = getFinalRound2ImageStatus(n, rows)
  const missing = []

  for (let i = 1; i <= 5; i++) {
    const row = rows.find((x) => Number(x.image_order) === i) || {}

    if (!isAdminFieldFilled(row.image)) missing.push(`${i}: الصورة`)
    if (!isAdminFieldFilled(row.answer)) missing.push(`${i}: الإجابة`)
  }

  return `
    <details class="adminEditItemCard finalRound2OnePageCard ${status.className}" ontoggle="handleAdminEditCardToggle(this)">
      <summary>
        <div class="adminEditItemTitle">
          <strong>رقم ${n} - اشرح الصورة</strong>
          <span>
            ${status.isDone ? "بيانات الرقم مكتملة" : `ناقص: ${missing.slice(0, 4).join("، ")}${missing.length > 4 ? "..." : ""}`}
          </span>
        </div>

        <div class="adminEditItemMeta">
          <span class="adminEditStatusPill">${status.label}</span>
          <span class="adminEditProgressPill">${status.progress}</span>

          <button
            type="button"
            class="adminDeleteBtn finalRound2SummaryDeleteBtn"
            onclick="event.preventDefault(); event.stopPropagation(); clearFinalRound4Item(${n});"
          >
            حذف
          </button>
        </div>
      </summary>

      <div class="adminEditItemBody">
        <div class="finalRound2ImageOnePageGrid">
          ${Array.from({ length: 5 }, (_, idx) => {
            const i = idx + 1
            const row = rows.find((x) => Number(x.image_order) === i) || {}

            return `
              <div class="finalRound2ImageItemCard">
                <div class="finalRound2ImageLineTitle">
  <span>الصورة</span>
  <strong>${i}</strong>
</div>

                <div class="adminField ${getAdminMissingFieldClass(row.image)}">
                  <label>الصورة</label>
                  <input
                    type="file"
                    id="finalRound4File_${n}_${i}"
                    accept="image/*"
                  >
                </div>

                <div class="adminField ${getAdminMissingFieldClass(row.answer)}">
                  <label>الإجابة</label>
                  <input
                    id="finalRound4Answer_${n}_${i}"
                    placeholder="الإجابة"
                    value="${escapeHtml(row.answer || "")}"
                  >
                </div>

                <div class="finalAdminImagePreview">
                  ${
                    row.image ? `<img src="${escapeHtml(row.image)}" class="previewImg">` : `<div class="emptyImageHint">لا توجد صورة</div>`
                  }
                </div>
              </div>
            `
          }).join("")}
        </div>
      </div>
    </details>
  `
}

async function saveFinalRound2(skipSavingLock = false) {
  if (!skipSavingLock && isAdminSaving()) return false

  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")
    return false
  }

  try {
    if (!skipSavingLock) setAdminSaving(true, "جارٍ حفظ صح صحلي...")

    const rows = []

    for (const number of [1, 2, 4, 5]) {
      const gameType = isFinalRound2ScrambleNumber(number) ? "scramble" : "sequence"

      for (let i = 1; i <= 6; i++) {
        const prompt = (document.getElementById(`finalRound2Prompt_${number}_${i}`)?.value || "").trim()

        const hint = gameType === "scramble" ? (document.getElementById(`finalRound2Hint_${number}_${i}`)?.value || "").trim() : ""

        const answer =
          gameType === "scramble"
            ? (
                document.getElementById(`finalRound2Answer_${number}_${i}`)?.value ||
                document.getElementById(`finalRound2Prompt_${number}_${i}`)?.value ||
                ""
              ).trim()
            : ""

        if (!prompt && !answer && !hint) continue

        rows.push({
          model: Number(currentModel),
          number: Number(number),
          game_type: gameType,
          title: "",
          item_order: Number(i),
          prompt,
          answer,
          hint
        })
      }
    }

    const keepKeys = rows.map((row) => `${Number(row.number)}_${Number(row.item_order)}`)

    const existingRowsResult = await dbSelect("final_round2_items", (query) => query.eq("model", Number(currentModel)), {
      select: "number,item_order",
      fallback: [],
      logLabel: "READ FINAL ROUND 2 EXISTING"
    })

    if (!existingRowsResult.ok) {
      console.log("READ FINAL ROUND 2 EXISTING ERROR:", existingRowsResult.error)

      showGameToast("تعذر قراءة صح صحلي الحالية")

      return false
    }

    const existingRows = existingRowsResult.data

    for (const oldRow of existingRows || []) {
      const key = `${Number(oldRow.number)}_${Number(oldRow.item_order)}`

      if (!keepKeys.includes(key)) {
        const deleteResult = await dbDelete(
          "final_round2_items",
          (query) =>
            query.eq("model", Number(currentModel)).eq("number", Number(oldRow.number)).eq("item_order", Number(oldRow.item_order)),
          {
            logLabel: "DELETE FINAL ROUND 2 OLD"
          }
        )

        if (!deleteResult.ok) {
          console.log("DELETE FINAL ROUND 2 OLD ERROR:", deleteResult.error)

          showGameToast("تعذر تنظيف عناصر صح صحلي")

          return false
        }
      }
    }

    if (rows.length) {
      const saveResult = await dbUpsert("final_round2_items", rows, {
        onConflict: "model,number,item_order",
        logLabel: "SAVE FINAL ROUND 2"
      })

      if (!saveResult.ok) {
        showGameToast("فشل حفظ صح صحلي")
        return false
      }
    }

    const imageSaved = await saveFinalRound4Image(true)

    if (!imageSaved) {
      showGameToast("تم حفظ صح صحلي لكن تعذر حفظ صور 3 و 6")
      return false
    }

    showGameToast("تم حفظ صح صحلي")
    return true
  } catch (err) {
    console.log("SAVE FINAL ROUND 2 CATCH:", err)
    showGameToast("توقف حفظ صح صحلي بسبب خطأ")
    return false
  } finally {
    if (!skipSavingLock) setAdminSaving(false)
  }
}

/* =========================
   27) Final Round 3 - قصة
========================= */

function getFinalStoryItemStatus(row = {}) {
  const fields = [row.question_part1, row.question_part2, row.question_part3, row.answer]

  const completed = fields.filter(isAdminFieldFilled).length
  return getAdminItemStatus(completed, fields.length)
}

async function buildFinalRound3StoryAdmin() {
  const count = await getAdminSegmentCount("finalRound3")

  const result = await dbSelect(
    "final_round1_items",
    (query) =>
      query.eq("model", Number(currentModel)).gte("number", 201).lte("number", 209).order("number", {
        ascending: true
      }),
    {
      select: "*",
      fallback: [],
      logLabel: "LOAD FINAL STORY"
    }
  )

  if (!result.ok) {
    console.log("LOAD FINAL STORY ERROR:", result.error)

    return `
    <div class="adminCard">
      تعذر تحميل قصة
    </div>
  `
  }

  const data = result.data

  const map = {}

  ;(data || []).forEach((row) => {
    map[Number(row.number)] = row
  })

  return `
    <div class="adminEditCardsGrid finalStoryOnePageGrid">
      ${Array.from({ length: count }, (_, idx) => {
        const number = idx + 1
        return buildFinalStoryOnePageCard(number, map)
      }).join("")}
    </div>
  `
}

function buildFinalStoryOnePageCard(number, map = {}) {
  const n = Number(number || 1)
  const dbNumber = getFinalStoryDbNumber(n)
  const row = map[dbNumber] || {}
  const status = getFinalStoryItemStatus(row)

  const missing = []

  if (!isAdminFieldFilled(row.question_part1)) missing.push("جزء 1")
  if (!isAdminFieldFilled(row.question_part2)) missing.push("جزء 2")
  if (!isAdminFieldFilled(row.question_part3)) missing.push("جزء 3")
  if (!isAdminFieldFilled(row.answer)) missing.push("الإجابة")

  return `
    <details class="adminEditItemCard finalStoryOnePageCard ${status.className}" ontoggle="handleAdminEditCardToggle(this)">
      <summary>
        <div class="adminEditItemTitle">
          <strong>رقم ${n}</strong>
          <span>
            ${status.isDone ? "بيانات القصة مكتملة" : `ناقص: ${missing.join("، ")}`}
          </span>
        </div>

        <div class="adminEditItemMeta">
          <span class="adminEditStatusPill">${status.label}</span>
          <span class="adminEditProgressPill">${status.progress}</span>

          <button
            type="button"
            class="adminDeleteBtn finalStorySummaryDeleteBtn"
            onclick="event.preventDefault(); event.stopPropagation(); clearFinalRound3StoryItem(${n});"
          >
            حذف
          </button>
        </div>
      </summary>

      <div class="adminEditItemBody">
        <div class="finalStoryOnePageLayout">

          <div class="adminField ${getAdminMissingFieldClass(row.question_part1)}">
            <label>جزء القصة 1</label>
            <textarea
              id="finalRound3StoryPart1_${n}"
              placeholder="الجزء الأول"
            >${escapeHtml(row.question_part1 || "")}</textarea>

            ${!isAdminFieldFilled(row.question_part1) ? `<div class="adminMissingHint">جزء القصة 1 ناقص</div>` : ""}
          </div>

          <div class="adminField ${getAdminMissingFieldClass(row.question_part2)}">
            <label>جزء القصة 2</label>
            <textarea
              id="finalRound3StoryPart2_${n}"
              placeholder="الجزء الثاني"
            >${escapeHtml(row.question_part2 || "")}</textarea>

            ${!isAdminFieldFilled(row.question_part2) ? `<div class="adminMissingHint">جزء القصة 2 ناقص</div>` : ""}
          </div>

          <div class="adminField ${getAdminMissingFieldClass(row.question_part3)}">
            <label>جزء القصة 3</label>
            <textarea
              id="finalRound3StoryPart3_${n}"
              placeholder="الجزء الثالث"
            >${escapeHtml(row.question_part3 || "")}</textarea>

            ${!isAdminFieldFilled(row.question_part3) ? `<div class="adminMissingHint">جزء القصة 3 ناقص</div>` : ""}
          </div>

          <div class="adminField finalStoryAnswerBox ${getAdminMissingFieldClass(row.answer)}">
            <label>الإجابة</label>
            <textarea
              id="finalRound3StoryAnswer_${n}"
              placeholder="الإجابة"
            >${escapeHtml(row.answer || "")}</textarea>

            ${!isAdminFieldFilled(row.answer) ? `<div class="adminMissingHint">الإجابة ناقصة</div>` : ""}
          </div>

        </div>
      </div>
    </details>
  `
}

async function saveFinalRound3Story(skipSavingLock = false) {
  if (!skipSavingLock && isAdminSaving()) return false

  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")
    return false
  }

  try {
    if (!skipSavingLock) {
      setAdminSaving(true, "جارٍ حفظ قصة...")
    }

    const safeCount = normalizeAdminSegmentCount(
      "finalRound3",
      Number(finalRound3AdminCount || (await getAdminSegmentCount("finalRound3")))
    )

    finalRound3AdminCount = safeCount

    const countSaved = await saveAdminSegmentCount("finalRound3", safeCount)

    if (!countSaved) {
      return false
    }

    const rows = []

    for (let i = 1; i <= safeCount; i++) {
      const dbNumber = getFinalStoryDbNumber(i)

      const part1 = (document.getElementById(`finalRound3StoryPart1_${i}`)?.value || "").trim()

      const part2 = (document.getElementById(`finalRound3StoryPart2_${i}`)?.value || "").trim()

      const part3 = (document.getElementById(`finalRound3StoryPart3_${i}`)?.value || "").trim()

      const answer = (document.getElementById(`finalRound3StoryAnswer_${i}`)?.value || "").trim()

      if (!part1 && !part2 && !part3 && !answer) continue

      rows.push({
        model: Number(currentModel),
        number: Number(dbNumber),
        image: "",
        answer,
        note: "",
        card_text: "",
        question_part1: part1,
        question_part2: part2,
        question_part3: part3
      })
    }

    const keepNumbers = rows.map((row) => Number(row.number))

    const existingRowsResult = await dbSelect(
      "final_round1_items",
      (query) => query.eq("model", Number(currentModel)).gte("number", 201).lte("number", 209),
      {
        select: "number",
        fallback: [],
        logLabel: "READ FINAL STORY EXISTING"
      }
    )

    if (!existingRowsResult.ok) {
      console.log("READ FINAL STORY EXISTING ERROR:", existingRowsResult.error)

      showGameToast("تعذر قراءة عناصر قصة الحالية")

      return false
    }

    const existingRows = existingRowsResult.data

    for (const oldRow of existingRows || []) {
      const oldNumber = Number(oldRow.number)

      if (!keepNumbers.includes(oldNumber)) {
        const deleteResult = await dbDelete(
          "final_round1_items",
          (query) => query.eq("model", Number(currentModel)).eq("number", oldNumber),
          {
            logLabel: "DELETE FINAL STORY OLD"
          }
        )

        if (!deleteResult.ok) {
          console.log("DELETE FINAL STORY OLD ERROR:", deleteResult.error)

          showGameToast("تعذر تنظيف عناصر قصة")

          return false
        }
      }
    }

    if (rows.length) {
      const saveResult = await dbUpsert("final_round1_items", rows, {
        onConflict: "model,number",
        logLabel: "SAVE FINAL STORY"
      })

      if (!saveResult.ok) {
        showGameToast("فشل حفظ قصة")
        return false
      }
    }

    showGameToast(rows.length ? "تم حفظ قصة" : "تم حذف بيانات قصة")
    return true
  } catch (err) {
    console.log("SAVE FINAL STORY CATCH:", err)
    showGameToast("توقف حفظ قصة بسبب خطأ")
    return false
  } finally {
    if (!skipSavingLock) setAdminSaving(false)
  }
}

async function clearFinalRound3StoryItem(number) {
  if (!canRunAdminDelete()) return

  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")
    return
  }

  const confirmed = window.confirm(`حذف رقم ${number} من قصة؟`)
  if (!confirmed) return

  const dbNumber = getFinalStoryDbNumber(number)

  const deleteResult = await dbDelete(
    "final_round1_items",
    (query) => query.eq("model", Number(currentModel)).eq("number", Number(dbNumber)),
    {
      logLabel: "CLEAR FINAL STORY ITEM"
    }
  )

  if (!deleteResult.ok) {
    console.log("CLEAR FINAL STORY ITEM ERROR:", deleteResult.error)

    showGameToast("تعذر حذف العنصر")

    return
  }

  showGameToast(`تم حذف رقم ${number}`)
  await renderFinalAdminRound(3)
  await renderAdminTabsUnified()
}

/* =========================
   28) Final Round 4 - التركيز
========================= */

function getFinalFocusItemStatus(row = {}) {
  const hasMedia = isAdminFieldFilled(row.image) || isAdminFieldFilled(row.video)

  const fields = [hasMedia ? "media" : "", row.question, row.answer]

  const completed = fields.filter(isAdminFieldFilled).length
  return getAdminItemStatus(completed, fields.length)
}

async function buildFinalRound3FocusAdmin() {
  const count = await getAdminSegmentCount("finalRound4")

  const result = await dbSelect(
    "final_round3_items",
    (query) =>
      query.eq("model", Number(currentModel)).order("number", {
        ascending: true
      }),
    {
      select: "*",
      fallback: [],
      logLabel: "LOAD FINAL ROUND 3"
    }
  )

  if (!result.ok) {
    console.log("LOAD FINAL ROUND 3 ERROR:", result.error)

    return `
    <div class="adminCard">
      تعذر تحميل التركيز
    </div>
  `
  }

  const data = result.data

  const map = {}

  ;(data || []).forEach((row) => {
    const number = Number(row.number)
    const imageOrder = Number(row.image_order || 1)

    if (number >= 1 && number <= 9 && imageOrder === 1) {
      map[number] = row
    }
  })

  return `
    <div class="adminEditCardsGrid finalFocusOnePageGrid">
      ${Array.from({ length: count }, (_, idx) => {
        const number = idx + 1
        return buildFinalFocusOnePageCard(number, map)
      }).join("")}
    </div>
  `
}

function buildFinalFocusOnePageCard(number, map = {}) {
  const n = Number(number || 1)
  const row = map[n] || {}
  const status = getFinalFocusItemStatus(row)

  const hasMedia = isAdminFieldFilled(row.image) || isAdminFieldFilled(row.video)

  const missing = []

  if (!hasMedia) missing.push("الصورة أو الفيديو")
  if (!isAdminFieldFilled(row.question)) missing.push("السؤال")
  if (!isAdminFieldFilled(row.answer)) missing.push("الإجابة")

  return `
    <details class="adminEditItemCard finalFocusOnePageCard ${status.className}" ontoggle="handleAdminEditCardToggle(this)">
      <summary>
        <div class="adminEditItemTitle">
          <strong>رقم ${n}</strong>
          <span>
            ${status.isDone ? "بيانات الرقم مكتملة" : `ناقص: ${missing.join("، ")}`}
          </span>
        </div>

        <div class="adminEditItemMeta">
          <span class="adminEditStatusPill">${status.label}</span>
          <span class="adminEditProgressPill">${status.progress}</span>

          <button
            type="button"
            class="adminDeleteBtn finalFocusSummaryDeleteBtn"
            onclick="event.preventDefault(); event.stopPropagation(); clearFinalRound3Item(${n});"
          >
            حذف
          </button>
        </div>
      </summary>

      <div class="adminEditItemBody">
        <div class="finalFocusOnePageLayout">

          <div class="finalFocusMediaBox">
            <div class="adminField ${hasMedia ? "" : "adminMissingField"}">
              <label>الصورة</label>
              <input
                type="file"
                id="finalRound3TeamImage_${n}"
                accept="image/*"
              >
            </div>

            <div class="adminField ${hasMedia ? "" : "adminMissingField"}">
              <label>الفيديو</label>
              <input
                type="file"
                id="finalRound3TeamVideo_${n}"
                accept="video/*"
              >
            </div>

            ${!hasMedia ? `<div class="adminMissingHint">الصورة أو الفيديو مطلوب</div>` : ""}

            <div class="finalAdminPreviewBox">
              ${
                row.video
                  ? `<video src="${escapeHtml(row.video)}" class="previewImg" controls></video>`
                  : row.image
                    ? `<img src="${escapeHtml(row.image)}" class="previewImg">`
                    : `<div class="emptyImageHint">لا توجد صورة أو فيديو</div>`
              }
            </div>
          </div>

          <div class="finalFocusTextBox">
            <div class="adminField ${getAdminMissingFieldClass(row.question)}">
              <label>السؤال</label>
              <textarea
                id="finalRound3TeamQuestion_${n}"
                placeholder="اكتب السؤال"
              >${escapeHtml(row.question || "")}</textarea>

              ${!isAdminFieldFilled(row.question) ? `<div class="adminMissingHint">السؤال ناقص</div>` : ""}
            </div>

            <div class="adminField ${getAdminMissingFieldClass(row.answer)}">
              <label>الإجابة</label>
              <textarea
                id="finalRound3TeamAnswer_${n}"
                placeholder="الإجابة"
              >${escapeHtml(row.answer || "")}</textarea>

              ${!isAdminFieldFilled(row.answer) ? `<div class="adminMissingHint">الإجابة ناقصة</div>` : ""}
            </div>
          </div>

        </div>
      </div>
    </details>
  `
}

async function saveFinalRound3Focus(skipSavingLock = false) {
  if (!skipSavingLock && isAdminSaving()) return false

  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")
    return false
  }

  try {
    if (!skipSavingLock) {
      setAdminSaving(true, "جارٍ حفظ التركيز...")
    }

    const safeCount = normalizeAdminSegmentCount(
      "finalRound4",
      Number(finalRound4AdminCount || (await getAdminSegmentCount("finalRound4")))
    )

    finalRound4AdminCount = safeCount

    const countSaved = await saveAdminSegmentCount("finalRound4", safeCount)

    if (!countSaved) {
      return false
    }

    const oldRowsResult = await dbSelect("final_round3_items", (query) => query.eq("model", Number(currentModel)), {
      select: "*",
      fallback: [],
      logLabel: "READ OLD FINAL ROUND 3"
    })

    if (!oldRowsResult.ok) {
      console.log("READ OLD FINAL ROUND 3 ERROR:", oldRowsResult.error)

      showGameToast("تعذر قراءة بيانات التركيز القديمة")

      return false
    }

    const oldRows = oldRowsResult.data

    const oldMap = {}

    ;(oldRows || []).forEach((row) => {
      const number = Number(row.number)
      const imageOrder = Number(row.image_order || 1)

      if (number >= 1 && number <= 9 && imageOrder === 1) {
        oldMap[number] = row
      }
    })

    const rows = []

    for (let number = 1; number <= safeCount; number++) {
      const imageFile = document.getElementById(`finalRound3TeamImage_${number}`)?.files?.[0] || null

      const videoFile = document.getElementById(`finalRound3TeamVideo_${number}`)?.files?.[0] || null

      const question = (document.getElementById(`finalRound3TeamQuestion_${number}`)?.value || "").trim()

      const answer = (document.getElementById(`finalRound3TeamAnswer_${number}`)?.value || "").trim()

      let image = oldMap[number]?.image || ""
      let video = oldMap[number]?.video || ""

      if (imageFile) {
        image = await uploadImageFile(imageFile, `final_r3_focus_img_${number}`)

        if (!image) {
          showGameToast(`تعذر رفع صورة رقم ${number}`)
          return false
        }

        video = ""
      }

      if (videoFile) {
        video = await uploadVideoFile(videoFile, `final_r3_focus_video_${number}`)

        if (!video) {
          showGameToast(`تعذر رفع فيديو رقم ${number}`)
          return false
        }

        image = ""
      }

      if (!image && !video && !question && !answer) continue

      rows.push({
        model: Number(currentModel),
        number: Number(number),
        image_order: 1,
        image,
        video,
        question,
        answer
      })
    }

    const keepNumbers = rows.map((row) => Number(row.number))

    const existingRowsResult = await dbSelect("final_round3_items", (query) => query.eq("model", Number(currentModel)), {
      select: "number",
      fallback: [],
      logLabel: "READ EXISTING FINAL ROUND 3"
    })

    if (!existingRowsResult.ok) {
      console.log("READ EXISTING FINAL ROUND 3 ERROR:", existingRowsResult.error)

      showGameToast("تعذر قراءة عناصر التركيز الحالية")

      return false
    }

    const existingRows = existingRowsResult.data

    for (const oldRow of existingRows || []) {
      const oldNumber = Number(oldRow.number)

      if (oldNumber >= 1 && oldNumber <= 9 && !keepNumbers.includes(oldNumber)) {
        const deleteResult = await dbDelete(
          "final_round3_items",
          (query) => query.eq("model", Number(currentModel)).eq("number", oldNumber),
          {
            logLabel: "DELETE OLD FINAL ROUND 3"
          }
        )

        if (!deleteResult.ok) {
          console.log("DELETE OLD FINAL ROUND 3 ERROR:", deleteResult.error)

          showGameToast("تعذر تنظيف التركيز")

          return false
        }
      }
    }

    if (rows.length) {
      const saveResult = await dbUpsert("final_round3_items", rows, {
        onConflict: "model,number,image_order",
        logLabel: "SAVE FINAL ROUND 3"
      })

      if (!saveResult.ok) {
        showGameToast("فشل حفظ التركيز")
        return false
      }
    }

    showGameToast(rows.length ? "تم حفظ التركيز" : "تم حذف بيانات التركيز")
    return true
  } catch (err) {
    console.log("SAVE FINAL ROUND 3 CATCH:", err)
    showGameToast("توقف حفظ التركيز بسبب خطأ")
    return false
  } finally {
    if (!skipSavingLock) setAdminSaving(false)
  }
}

/* =========================
   28.5) Final Round 2 Images - صور صح صحلي
========================= */

async function buildFinalRound4ImageAdmin() {
  const result = await dbSelect(
    "final_round3_items",
    (query) =>
      query
        .eq("model", Number(currentModel))
        .order("number", {
          ascending: true
        })
        .order("image_order", {
          ascending: true
        }),
    {
      select: "*",
      fallback: [],
      logLabel: "LOAD FINAL ROUND 2 IMAGE NUMBERS"
    }
  )

  if (!result.ok) {
    console.log("LOAD FINAL ROUND 2 IMAGE NUMBERS ERROR:", result.error)

    return `
    <div class="adminCard">
      تعذر تحميل صور صح صحلي
    </div>
  `
  }

  const data = result.data

  const grouped = {
    101: [],
    102: []
  }

  ;(data || []).forEach((row) => {
    const number = Number(row.number)

    if (number === 101 || number === 102) {
      grouped[number].push(row)
    }
  })

  let html = `<div class="finalAdminRound3Wrap">`

  for (const displayNumber of [3, 6]) {
    const dbNumber = getFinalRound4DbNumber(displayNumber)
    const rows = grouped[dbNumber] || []

    html += `
      <div class="finalAdminCard finalAdminWideCard finalRound4CleanCard">
        <div class="finalAdminCardHead">
          <h3>رقم ${displayNumber}</h3>

          <button class="adminDeleteBtn" onclick="clearFinalRound4Item(${displayNumber})">
            حذف
          </button>
        </div>
    `

    for (let i = 1; i <= 5; i++) {
      const row = rows.find((x) => Number(x.image_order) === i) || {}

      html += `
        <div class="finalAdminImageRow">
          <div class="finalAdminWordIndex">الصورة ${i}</div>

          <div class="finalAdminImageFields">
            <input
              type="file"
              id="finalRound4File_${displayNumber}_${i}"
              accept="image/*"
            >

            <input
              id="finalRound4Answer_${displayNumber}_${i}"
              placeholder="الإجابة"
              value="${escapeHtml(row.answer || "")}"
            >
          </div>

          <div class="finalAdminImagePreview">
            ${row.image ? `<img src="${escapeHtml(row.image)}" class="previewImg">` : `<div class="emptyImageHint">لا توجد صورة</div>`}
          </div>
        </div>
      `
    }

    html += `</div>`
  }

  html += `</div>`
  return html
}

async function saveFinalRound4Image(skipSavingLock = false) {
  if (!skipSavingLock && isAdminSaving()) return false

  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")
    return false
  }

  try {
    if (!skipSavingLock) {
      setAdminSaving(true, "جارٍ حفظ صور صح صحلي...")
    }

    const oldRowsResult = await dbSelect("final_round3_items", (query) => query.eq("model", Number(currentModel)), {
      select: "*",
      fallback: [],
      logLabel: "READ OLD FINAL ROUND 2 IMAGES"
    })

    if (!oldRowsResult.ok) {
      console.log("READ OLD FINAL ROUND 2 IMAGES ERROR:", oldRowsResult.error)

      showGameToast("تعذر قراءة الصور القديمة")

      return false
    }

    const oldRows = oldRowsResult.data

    const oldMap = {}

    ;(oldRows || []).forEach((row) => {
      const number = Number(row.number)
      const imageOrder = Number(row.image_order || 1)

      if (number === 101 || number === 102) {
        oldMap[`${number}_${imageOrder}`] = row
      }
    })

    const rows = []

    for (const displayNumber of [3, 6]) {
      const dbNumber = getFinalRound4DbNumber(displayNumber)

      for (let i = 1; i <= 5; i++) {
        const file = document.getElementById(`finalRound4File_${displayNumber}_${i}`)?.files?.[0] || null

        const answer = (document.getElementById(`finalRound4Answer_${displayNumber}_${i}`)?.value || "").trim()

        let image = oldMap[`${dbNumber}_${i}`]?.image || ""

        if (file) {
          image = await uploadImageFile(file, `final_r2_image_${displayNumber}_${i}`)

          if (!image) {
            showGameToast(`تعذر رفع صورة ${i} للرقم ${displayNumber}`)
            return false
          }
        }

        if (!image && !answer) continue

        rows.push({
          model: Number(currentModel),
          number: Number(dbNumber),
          image_order: Number(i),
          image,
          video: "",
          question: "",
          answer
        })
      }
    }

    const keepKeys = rows.map((row) => `${Number(row.number)}_${Number(row.image_order)}`)

    const existingRowsResult = await dbSelect("final_round3_items", (query) => query.eq("model", Number(currentModel)), {
      select: "number,image_order",
      fallback: [],
      logLabel: "READ EXISTING FINAL ROUND 2 IMAGES"
    })

    if (!existingRowsResult.ok) {
      console.log("READ EXISTING FINAL ROUND 2 IMAGES ERROR:", existingRowsResult.error)

      showGameToast("تعذر قراءة صور صح صحلي الحالية")

      return false
    }

    const existingRows = existingRowsResult.data

    for (const oldRow of existingRows || []) {
      const oldNumber = Number(oldRow.number)
      const key = `${oldNumber}_${Number(oldRow.image_order)}`

      if ((oldNumber === 101 || oldNumber === 102) && !keepKeys.includes(key)) {
        const deleteResult = await dbDelete(
          "final_round3_items",
          (query) => query.eq("model", Number(currentModel)).eq("number", oldNumber).eq("image_order", Number(oldRow.image_order)),
          {
            logLabel: "DELETE OLD FINAL ROUND 2 IMAGES"
          }
        )

        if (!deleteResult.ok) {
          console.log("DELETE OLD FINAL ROUND 2 IMAGES ERROR:", deleteResult.error)

          showGameToast("تعذر تنظيف صور صح صحلي")

          return false
        }
      }
    }

    if (rows.length) {
      const saveResult = await dbUpsert("final_round3_items", rows, {
        onConflict: "model,number,image_order",
        logLabel: "SAVE FINAL ROUND 2 IMAGES"
      })

      if (!saveResult.ok) {
        console.log("SAVE FINAL ROUND 2 IMAGES ERROR:", saveResult.error)

        showGameToast("فشل حفظ صور صح صحلي")

        return false
      }
    }

    showGameToast(rows.length ? "تم حفظ صور صح صحلي" : "تم حذف صور صح صحلي")
    return true
  } catch (err) {
    console.log("SAVE FINAL ROUND 2 IMAGES CATCH:", err)
    showGameToast("توقف حفظ صور صح صحلي بسبب خطأ")
    return false
  } finally {
    if (!skipSavingLock) setAdminSaving(false)
  }
}

/* =========================
   29) Final Delete Helpers
========================= */

async function deleteFinalRound(round) {
  if (!canRunAdminDelete()) return

  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")
    return
  }

  const safeRound = Number(round || 1)
  const title = getFinalAdminRoundTitle(safeRound)

  const confirmed = window.confirm(`هل تريد حذف "${title}"؟`)

  if (!confirmed) return

  try {
    const metaResult = await dbDelete("final_round_meta", (query) => query.eq("model", Number(currentModel)).eq("round", safeRound), {
      logLabel: "DELETE FINAL ROUND META"
    })

    if (!metaResult.ok) {
      console.log("DELETE FINAL ROUND META ERROR:", metaResult.error)

      showGameToast("تعذر حذف الفقرة")

      return
    }

    if (safeRound === 1) {
      const [itemsResult, settingsResult] = await Promise.all([
        dbDelete("final_round1_items", (query) => query.eq("model", Number(currentModel)).gte("number", 1).lte("number", 9), {
          logLabel: "DELETE FINAL ROUND 1 ITEMS"
        }),

        dbDelete("segment_settings", (query) => query.eq("model", Number(currentModel)).eq("segment", "finalRound1"), {
          logLabel: "DELETE FINAL ROUND 1 SETTINGS"
        })
      ])

      if (!itemsResult.ok || !settingsResult.ok) {
        console.log(itemsResult.error || settingsResult.error)

        showGameToast("تعذر حذف الفقرة")

        return
      }

      finalRound1AdminCount = 7
    }

    if (safeRound === 2) {
      const [textResult, imagesResult] = await Promise.all([
        dbDelete("final_round2_items", (query) => query.eq("model", Number(currentModel)), {
          logLabel: "DELETE FINAL ROUND 2 ITEMS"
        }),

        dbDelete("final_round3_items", (query) => query.eq("model", Number(currentModel)).in("number", [101, 102]), {
          logLabel: "DELETE FINAL ROUND 2 IMAGES"
        })
      ])

      if (!textResult.ok || !imagesResult.ok) {
        console.log(textResult.error || imagesResult.error)

        showGameToast("تعذر حذف الفقرة")

        return
      }
    }

    if (safeRound === 3) {
      const [itemsResult, settingsResult] = await Promise.all([
        dbDelete("final_round1_items", (query) => query.eq("model", Number(currentModel)).gte("number", 201).lte("number", 209), {
          logLabel: "DELETE FINAL ROUND 3 ITEMS"
        }),

        dbDelete("segment_settings", (query) => query.eq("model", Number(currentModel)).eq("segment", "finalRound3"), {
          logLabel: "DELETE FINAL ROUND 3 SETTINGS"
        })
      ])

      if (!itemsResult.ok || !settingsResult.ok) {
        console.log(itemsResult.error || settingsResult.error)

        showGameToast("تعذر حذف الفقرة")

        return
      }

      finalRound3AdminCount = 5
    }

    if (safeRound === 4) {
      const [itemsResult, settingsResult] = await Promise.all([
        dbDelete("final_round3_items", (query) => query.eq("model", Number(currentModel)).gte("number", 1).lte("number", 9), {
          logLabel: "DELETE FINAL ROUND 4 ITEMS"
        }),

        dbDelete("segment_settings", (query) => query.eq("model", Number(currentModel)).eq("segment", "finalRound4"), {
          logLabel: "DELETE FINAL ROUND 4 SETTINGS"
        })
      ])

      if (!itemsResult.ok || !settingsResult.ok) {
        console.log(itemsResult.error || settingsResult.error)

        showGameToast("تعذر حذف الفقرة")

        return
      }

      finalRound4AdminCount = 5
    }

    showGameToast(`تم حذف ${title}`)

    await renderFinalAdminRound(safeRound)

    await renderAdminTabsUnified()
  } catch (err) {
    console.log("DELETE FINAL ROUND CATCH:", err)

    showGameToast("تعذر حذف الفقرة")
  }
}

async function clearFinalRound1Item(number) {
  if (!canRunAdminDelete()) return

  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")
    return
  }

  const confirmed = window.confirm(`حذف رقم ${number} من ٮدوں ٮڡاط؟`)
  if (!confirmed) return

  const result = await dbDelete("final_round1_items", (query) => query.eq("model", Number(currentModel)).eq("number", Number(number)), {
    logLabel: "CLEAR FINAL ROUND 1 ITEM"
  })

  if (!result.ok) {
    console.log("CLEAR FINAL ROUND 1 ITEM ERROR:", result.error)

    showGameToast("تعذر حذف العنصر")

    return
  }

  showGameToast(`تم حذف رقم ${number}`)

  await renderFinalAdminRound(1)
  await renderAdminTabsUnified()
}

async function clearFinalRound2Item(number) {
  if (!canRunAdminDelete()) return

  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")
    return
  }

  const confirmed = window.confirm(`حذف رقم ${number} من صح صحلي؟`)
  if (!confirmed) return

  const deleteResult = await dbDelete(
    "final_round2_items",
    (query) => query.eq("model", Number(currentModel)).eq("number", Number(number)),
    {
      logLabel: "CLEAR FINAL ROUND 2 ITEM"
    }
  )

  if (!deleteResult.ok) {
    console.log("CLEAR FINAL ROUND 2 ITEM ERROR:", deleteResult.error)

    showGameToast("تعذر حذف الرقم")

    return
  }

  showGameToast(`تم حذف رقم ${number}`)
  await renderFinalAdminRound(2)
  await renderAdminTabsUnified()
}

async function clearFinalRound3Item(number) {
  if (!canRunAdminDelete()) return

  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")
    return
  }

  const confirmed = window.confirm(`حذف رقم ${number} من التركيز؟`)
  if (!confirmed) return

  const deleteResult = await dbDelete(
    "final_round3_items",
    (query) => query.eq("model", Number(currentModel)).eq("number", Number(number)),
    {
      logLabel: "CLEAR FINAL ROUND 3 ITEM"
    }
  )

  if (!deleteResult.ok) {
    console.log("CLEAR FINAL ROUND 3 ITEM ERROR:", deleteResult.error)

    showGameToast("تعذر حذف الرقم")

    return
  }

  showGameToast(`تم حذف رقم ${number}`)
  await renderFinalAdminRound(4)
  await renderAdminTabsUnified()
}

async function clearFinalRound4Item(displayNumber) {
  if (!canRunAdminDelete()) return

  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")
    return
  }

  const dbNumber = getFinalRound4DbNumber(displayNumber)

  const confirmed = window.confirm(`حذف رقم ${displayNumber} من اشرح الصورة؟`)
  if (!confirmed) return

  const deleteResult = await dbDelete(
    "final_round3_items",
    (query) => query.eq("model", Number(currentModel)).eq("number", Number(dbNumber)),
    {
      logLabel: "CLEAR FINAL ROUND 4 ITEM"
    }
  )

  if (!deleteResult.ok) {
    console.log("CLEAR FINAL ROUND 4 ITEM ERROR:", deleteResult.error)

    showGameToast("تعذر حذف الرقم")

    return
  }

  showGameToast(`تم حذف رقم ${displayNumber}`)
  await renderFinalAdminRound(2)
  await renderAdminTabsUnified()
}

/* =========================
   30) Archive Draft Helpers
========================= */

function collectArchiveDraftState() {
  const draft = {}

  for (const position of archiveExtraTextPositions || []) {
    draft[position] = {
      parent_position: Number(document.getElementById(`archiveItemParent_${position}`)?.value || 3),
      label: document.getElementById(`archiveItemLabel_${position}`)?.value || "",
      prompt_style: document.getElementById(`archiveItemPromptStyle_${position}`)?.value || "shoe",
      text: document.getElementById(`archiveItemText_${position}`)?.value || ""
    }
  }

  const text1 = document.getElementById("archiveItemText_1")
  const text2 = document.getElementById("archiveItemText_2")
  const score = document.getElementById("archiveScore")

  draft.__top = {
    text1: text1 ? text1.value : "",
    text2: text2 ? text2.value : "",
    score: score ? score.value : ""
  }

  archiveDraftState = draft
}

function getArchiveDraftItem(position, dbItem = {}) {
  const draftItem = archiveDraftState[position] || {}

  return {
    ...dbItem,
    ...draftItem
  }
}

function handleArchiveParentChange() {
  collectArchiveDraftState()
  renderArchiveAdminRound(archiveAdminRound)
}

function isArchiveRoundComplete(box, items = []) {
  if (!box) return false

  const tournament = String(box.tournament || "").trim()
  const season = String(box.season || "").trim()
  const score = String(box.score || "").trim()

  if (!tournament || !season || !score) return false

  const map = {}

  items.forEach((item) => {
    map[Number(item.position)] = item
  })

  if (!map[3]?.image) return false
  if (!map[4]?.image) return false

  const textItems = items.filter((item) => Number(item.position) >= ARCHIVE_TEXT_START_POSITION)

  if (!textItems.length) return false

  const hasRequired = textItems.some((item) => {
    return String(item.label || "").trim() === "المطلوب"
  })

  if (!hasRequired) return false

  const hasEmptyText = textItems.some((item) => {
    return !String(item.text || "").trim()
  })

  if (hasEmptyText) return false

  return true
}
function getArchiveRoundStatus(box, items = []) {
  const fields = []

  fields.push(box?.tournament || "")
  fields.push(box?.season || "")
  fields.push(box?.score || "")

  const map = {}

  ;(items || []).forEach((item) => {
    map[Number(item.position)] = item
  })

  fields.push(map[3]?.image || "")
  fields.push(map[4]?.image || "")

  const textItems = (items || []).filter((item) => Number(item.position) >= ARCHIVE_TEXT_START_POSITION)

  if (!textItems.length) {
    fields.push("")
  } else {
    textItems.forEach((item) => {
      fields.push(item.text || "")
    })

    const hasRequired = textItems.some((item) => String(item.label || "").trim() === "المطلوب")
    fields.push(hasRequired ? "required" : "")
  }

  const completed = fields.filter(isAdminFieldFilled).length
  return getAdminItemStatus(completed, fields.length)
}

async function getArchiveDoneMap() {
  const doneMap = {}

  for (let r = 1; r <= archiveAdminRoundsCount; r++) {
    doneMap[r] = false
  }

  if (!currentModel) return doneMap

  const [boxesRes, itemsRes] = await Promise.all([
    dbSelect("archive_boxes", (query) => query.eq("model", Number(currentModel)), {
      select: "*",
      fallback: [],
      logLabel: "ARCHIVE DONE MAP BOXES"
    }),

    dbSelect("archive_items", (query) => query.eq("model", Number(currentModel)), {
      select: "*",
      fallback: [],
      logLabel: "ARCHIVE DONE MAP ITEMS"
    })
  ])

  if (!boxesRes.ok || !itemsRes.ok) {
    console.log("ARCHIVE DONE MAP ERROR:", boxesRes.error || itemsRes.error)

    return doneMap
  }

  const boxesMap = {}

  ;(boxesRes.data || []).forEach((box) => {
    boxesMap[Number(box.round)] = box
  })

  const itemsByRound = {}

  ;(itemsRes.data || []).forEach((item) => {
    const r = Number(item.round)

    if (!itemsByRound[r]) {
      itemsByRound[r] = []
    }

    itemsByRound[r].push(item)
  })

  for (let r = 1; r <= archiveAdminRoundsCount; r++) {
    doneMap[r] = isArchiveRoundComplete(boxesMap[r], itemsByRound[r] || [])
  }

  return doneMap
}

/* =========================
   31) Archive Render Item
========================= */

function renderArchiveAdminItem(position, item = {}) {
  const mergedItem = getArchiveDraftItem(position, item)

  const parentPosition = Number(mergedItem.parent_position || mergedItem.column_group || 3)

  const promptStyle = mergedItem.prompt_style || "shoe"
  const labelText = String(mergedItem.label || "").trim()
  const isRequired = labelText === "المطلوب"
  const hasTextValue = String(mergedItem.text || "").trim() !== ""

  return `
    <div class="archiveAdminItem archiveAdminItemCompact ${isRequired ? "archiveAdminItemRequired" : ""} ${hasTextValue ? "isDone" : "isMissing"}">
      <div class="archiveAdminItemHead">
        <div class="archiveAdminItemTitleWrap">
          <div class="archiveAdminItemTitle">العنصر ${position}</div>

          <div class="archiveAdminItemMeta">
            ${labelText ? `<span>${escapeHtml(labelText)}</span>` : `<span>بدون عنوان</span>`}
            <span>${promptStyle === "ball" ? "⚽️ الهدف" : "👟 الاسيست"}</span>
          </div>
        </div>

        <div class="archiveAdminItemActions">
          ${isRequired ? `<div class="archiveAdminRequiredBadge">المطلوب</div>` : ""}

          <button
            type="button"
            class="adminDeleteMiniBtn"
            onclick="deleteArchiveItem(${archiveAdminRound}, ${position})"
          >
            حذف
          </button>
        </div>
      </div>

      <div class="archiveAdminFields archiveAdminFieldsCompact">
        <input
          id="archiveItemLabel_${position}"
          type="text"
          placeholder="العنوان - مثال: المطلوب"
          value="${escapeHtml(mergedItem.label || "")}"
        >

        <div class="compactCountSelectWrap">
          <select
            id="archiveItemParent_${position}"
            class="compactCountSelect"
            onchange="handleArchiveParentChange()"
          >
            <option value="3" ${parentPosition === 3 ? "selected" : ""}>تحت الصورة 3</option>
            <option value="4" ${parentPosition === 4 ? "selected" : ""}>تحت الصورة 4</option>
          </select>
        </div>

        <div class="compactCountSelectWrap">
          <select
            id="archiveItemPromptStyle_${position}"
            class="compactCountSelect"
          >
            <option value="ball" ${promptStyle === "ball" ? "selected" : ""}>⚽️ الهدف</option>
            <option value="shoe" ${promptStyle === "shoe" ? "selected" : ""}>👟 الاسيست</option>
          </select>
        </div>

        <textarea
          id="archiveItemText_${position}"
          class="${hasTextValue ? "hasValue" : ""} ${hasTextValue ? "" : "adminMissingField"}"
          placeholder="النص الذي سيظهر داخل البطاقة"
        >${escapeHtml(mergedItem.text || "")}</textarea>
      </div>
    </div>
  `
}

/* =========================
   32) Archive Main Render
========================= */

async function renderArchiveAdmin() {
  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")
    return
  }

  archiveAdminRoundsCount = await getSegmentRoundCount("archive", 4, 4)
  archiveAdminRound = 1
  archivePendingExtraCount = 0
  archiveDraftState = {}

  await renderArchiveAdminRound(1)
}

function openArchiveOnePageRound(round) {
  if (Number(round) === Number(archiveAdminRound)) return

  collectArchiveDraftState()

  archiveAdminRound = Number(round || 1)
  archivePendingExtraCount = 0
  archiveDraftState = {}

  renderArchiveAdminRound(archiveAdminRound)
}

async function renderArchiveAdminRound(round) {
  archiveAdminRound = Number(round || 1)

  const [boxesRes, itemsRes] = await Promise.all([
    dbSelect("archive_boxes", (query) => query.eq("model", Number(currentModel)), {
      select: "*",
      fallback: [],
      logLabel: "LOAD ARCHIVE BOXES"
    }),

    dbSelect(
      "archive_items",
      (query) =>
        query
          .eq("model", Number(currentModel))
          .order("round", {
            ascending: true
          })
          .order("position", {
            ascending: true
          }),
      {
        select: "*",
        fallback: [],
        logLabel: "LOAD ARCHIVE ITEMS"
      }
    )
  ])

  if (!boxesRes.ok || !itemsRes.ok) {
    console.log("LOAD ARCHIVE ERROR:", boxesRes.error || itemsRes.error)

    showGameToast("تعذر تحميل الأرشيف")

    return
  }

  const boxesMap = {}
  const itemsByRound = {}

  ;(boxesRes.data || []).forEach((box) => {
    boxesMap[Number(box.round)] = box
  })

  ;(itemsRes.data || []).forEach((item) => {
    const r = Number(item.round)

    if (!itemsByRound[r]) itemsByRound[r] = []
    itemsByRound[r].push(item)
  })

  const activeBox = boxesMap[archiveAdminRound] || null
  const activeItems = itemsByRound[archiveAdminRound] || []

  editor().innerHTML = `
    <div class="archiveAdminShell archiveAdminCleanV2 adminOnePageEditor">

      <div class="adminEditorTopBar archiveAdminTopBar adminEditorTopBarWithActions">
        <div>
          <h2 class="adminSectionTitle">الأرشيف</h2>
          <p class="adminSectionHint">افتح الجولة التي تريد تعديلها فقط.</p>
        </div>

        <div class="adminInlineActions archiveInlineActions">
          <button onclick="saveArchiveRoundNew()" class="adminSaveBtn">حفظ الجولة</button>
          <button onclick="addArchiveTextBox()" class="adminBtnMango">إضافة عنصر</button>
          <button onclick="removeArchiveTextBox()" class="adminBtnLight">حذف آخر عنصر</button>
          <button onclick="deleteArchiveSegment(archiveAdminRound)" class="adminDeleteBtn">حذف الجولة</button>
          <button onclick="deleteArchiveSegment()" class="adminDeleteAllBtn">حذف الأرشيف</button>
        </div>
      </div>

      <div class="adminEditCardsGrid archiveOnePageGrid">
        ${Array.from({ length: archiveAdminRoundsCount }, (_, idx) => {
          const r = idx + 1
          const box = boxesMap[r] || null
          const items = itemsByRound[r] || []

          return buildArchiveRoundOnePageCard(r, box, items, r === archiveAdminRound, activeBox, activeItems)
        }).join("")}
      </div>

    </div>
  `

  normalizeAdminEditorCards()

  const grid = document.querySelector(".archiveOnePageGrid")
  if (grid) grid.classList.add("hasOpenCard")
}

function buildArchiveRoundOnePageCard(round, box, items = [], isActive = false, activeBox = null, activeItems = []) {
  const status = getArchiveRoundStatus(box, items)

  const missing = []

  if (!isAdminFieldFilled(box?.tournament)) missing.push("البطولة")
  if (!isAdminFieldFilled(box?.season)) missing.push("الموسم")
  if (!isAdminFieldFilled(box?.score)) missing.push("النتيجة")

  const map = {}
  ;(items || []).forEach((item) => {
    map[Number(item.position)] = item
  })

  if (!isAdminFieldFilled(map[3]?.image)) missing.push("الصورة 3")
  if (!isAdminFieldFilled(map[4]?.image)) missing.push("الصورة 4")

  const textItems = (items || []).filter((item) => Number(item.position) >= ARCHIVE_TEXT_START_POSITION)
  const hasRequired = textItems.some((item) => String(item.label || "").trim() === "المطلوب")

  if (!hasRequired) missing.push("المطلوب")

  return `
    <details
      class="adminEditItemCard archiveRoundOnePageCard ${status.className}"
      ${isActive ? "open" : ""}
      ontoggle="${isActive ? "handleAdminEditCardToggle(this)" : `if(this.open){event.preventDefault(); openArchiveOnePageRound(${round});}`}"
    >
      <summary>
        <div class="adminEditItemTitle">
          <strong>الجولة ${round}</strong>
          <span>
            ${status.isDone ? "بيانات الجولة مكتملة" : `ناقص: ${missing.slice(0, 4).join("، ")}${missing.length > 4 ? "..." : ""}`}
          </span>
        </div>

        <div class="adminEditItemMeta">
          <span class="adminEditStatusPill">${status.label}</span>
          <span class="adminEditProgressPill">${status.progress}</span>

          <button
            type="button"
            class="adminDeleteBtn archiveSummaryDeleteBtn"
            onclick="event.preventDefault(); event.stopPropagation(); deleteArchiveSegment(${round});"
          >
            حذف
          </button>
        </div>
      </summary>

      ${isActive ? `<div class="adminEditItemBody">${buildArchiveActiveRoundBody(activeBox, activeItems)}</div>` : ""}
    </details>
  `
}
function buildArchiveActiveRoundBody(box, items = []) {
  const map = {}

  ;(items || []).forEach((item) => {
    map[Number(item.position)] = getArchiveDraftItem(Number(item.position), item)
  })

  const savedTextPositions = (items || []).map((item) => Number(item.position || 0)).filter((pos) => pos >= ARCHIVE_TEXT_START_POSITION)

  const savedCount = Math.max(4, savedTextPositions.length || 4)

  const targetCount = Math.min(ARCHIVE_MAX_TEXT_BOXES, Math.max(4, savedCount + archivePendingExtraCount))

  const maxPos = ARCHIVE_TEXT_START_POSITION + targetCount - 1

  archiveExtraTextPositions = []

  for (let p = ARCHIVE_TEXT_START_POSITION; p <= maxPos; p++) {
    archiveExtraTextPositions.push(p)
  }

  const under3Positions = archiveExtraTextPositions
    .filter((pos) => {
      const currentParent = Number(archiveDraftState[pos]?.parent_position || map[pos]?.parent_position || map[pos]?.column_group || 3)

      return currentParent === 3
    })
    .sort((a, b) => a - b)

  const under4Positions = archiveExtraTextPositions
    .filter((pos) => {
      const currentParent = Number(archiveDraftState[pos]?.parent_position || map[pos]?.parent_position || map[pos]?.column_group || 3)

      return currentParent === 4
    })
    .sort((a, b) => a - b)

  return `
    <div class="archiveAdminBoard archiveAdminBoardClean archiveAdminBoardV2 archiveOnePageBody">

      <div class="archiveMainInfoCard archiveOnePageInfoCard">
        <div class="archiveMainInfoGrid">
          <div class="adminField ${getAdminMissingFieldClass(archiveDraftState.__top?.text1 || map[1]?.text)}">
            <label>البطولة</label>
            <input
              id="archiveItemText_1"
              type="text"
              placeholder="مثال: دوري أبطال أوروبا"
              value="${escapeHtml(archiveDraftState.__top?.text1 || map[1]?.text || "")}"
            >
          </div>

          <div class="adminField ${getAdminMissingFieldClass(archiveDraftState.__top?.text2 || map[2]?.text)}">
            <label>الموسم</label>
            <input
              id="archiveItemText_2"
              type="text"
              placeholder="مثال: 2016 / 2017"
              value="${escapeHtml(archiveDraftState.__top?.text2 || map[2]?.text || "")}"
            >
          </div>

          <div class="adminField ${getAdminMissingFieldClass(archiveDraftState.__top?.score || box?.score)}">
            <label>النتيجة</label>
            <input
              id="archiveScore"
              type="text"
              placeholder="مثال: 3 - 1"
              value="${escapeHtml(archiveDraftState.__top?.score || box?.score || "")}"
            >
          </div>
        </div>
      </div>

      <div class="archiveImagesRow archiveOnePageImagesRow">

        ${buildArchiveImageOnePageCard(4, map[4])}
        ${buildArchiveImageOnePageCard(3, map[3])}

      </div>

      <div class="archiveAdminBottomGrid archiveAdminBottomGridClean archiveTextGroupsGrid archiveOnePageTextGroups">
        <div class="archiveAdminBottomCol archiveTextGroup">
          <div class="archiveAdminColumnTitle">
            <span>تحت الصورة 4</span>
            <small>${under4Positions.length} عناصر</small>
          </div>

          ${under4Positions.map((pos) => renderArchiveAdminItem(pos, map[pos])).join("")}
        </div>

        <div class="archiveAdminBottomCol archiveTextGroup">
          <div class="archiveAdminColumnTitle">
            <span>تحت الصورة 3</span>
            <small>${under3Positions.length} عناصر</small>
          </div>

          ${under3Positions.map((pos) => renderArchiveAdminItem(pos, map[pos])).join("")}
        </div>
      </div>

    </div>
  `
}

function buildArchiveImageOnePageCard(position, item = {}) {
  const hasImage = isAdminFieldFilled(item?.image)

  return `
    <div class="archiveImageCard archiveOnePageImageCard ${hasImage ? "isDone" : "isMissing"}">
      <div class="archiveImageCardHead">
        <h3>الصورة ${position}</h3>

        <button
          type="button"
          class="adminDeleteMiniBtn"
          onclick="deleteArchiveItem(${archiveAdminRound}, ${position})"
          ${hasImage ? "" : "disabled"}
        >
          حذف
        </button>
      </div>

      <div class="adminField ${hasImage ? "" : "adminMissingField"}">
        <label>رفع الصورة</label>
        <input id="archiveItemFile_${position}" type="file" accept="image/*">
      </div>

      ${!hasImage ? `<div class="adminMissingHint">الصورة ${position} ناقصة</div>` : ""}

      <div class="archiveImagePreviewBox">
        ${
          hasImage
            ? `<img src="${escapeHtml(item.image)}" class="archiveAdminPreviewImg">`
            : `<div class="archiveNoImage">لا توجد صورة</div>`
        }
      </div>
    </div>
  `
}
/* =========================
   33) Archive Actions
========================= */

function addArchiveTextBox() {
  collectArchiveDraftState()

  if (archiveExtraTextPositions.length >= ARCHIVE_MAX_TEXT_BOXES) {
    showGameToast("وصلت للحد الأقصى: 20 مربع")
    return
  }

  archivePendingExtraCount += 1
  renderArchiveAdminRound(archiveAdminRound)
}

function removeArchiveTextBox() {
  collectArchiveDraftState()

  if (archiveExtraTextPositions.length <= 4) {
    showGameToast("الحد الأدنى 4 مربعات")
    return
  }

  const lastPosition = archiveExtraTextPositions[archiveExtraTextPositions.length - 1]

  if (lastPosition) {
    delete archiveDraftState[lastPosition]
  }

  archivePendingExtraCount -= 1
  renderArchiveAdminRound(archiveAdminRound)
}

async function applyArchiveRoundsCount() {
  if (isAdminSaving()) return false

  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")
    return false
  }

  try {
    setAdminSaving(true, "جارٍ حفظ العدد...")

    const count = Number(document.getElementById("archiveRoundsCountInput")?.value || 4)

    archiveAdminRoundsCount = Math.min(Math.max(count, 1), 4)

    const saved = await saveSegmentRoundCount("archive", archiveAdminRoundsCount)
    if (!saved) return false

    if (archiveAdminRound > archiveAdminRoundsCount) {
      archiveAdminRound = archiveAdminRoundsCount
    }

    showGameToast("تم حفظ عدد جولات الأرشيف")
    await renderArchiveAdminRound(archiveAdminRound)
    await renderAdminTabsUnified()
    return true
  } catch (err) {
    console.log("APPLY ARCHIVE ROUNDS COUNT ERROR:", err)
    showGameToast("تعذر حفظ عدد جولات الأرشيف")
    return false
  } finally {
    setAdminSaving(false)
  }
}

async function saveArchiveRoundNew() {
  if (isAdminSaving()) return false

  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")
    return false
  }

  try {
    setAdminSaving(true, "جارٍ حفظ الأرشيف...")
    collectArchiveDraftState()

    const round = Number(archiveAdminRound || 1)

    showGameToast(`جارٍ حفظ الأرشيف - الجولة ${round}...`)

    const scoreValue = (document.getElementById("archiveScore")?.value || "").trim()
    const text1 = (document.getElementById("archiveItemText_1")?.value || "").trim()
    const text2 = (document.getElementById("archiveItemText_2")?.value || "").trim()

    const oldRowsResult = await dbSelect("archive_items", (query) => query.eq("model", Number(currentModel)).eq("round", round), {
      select: "*",
      fallback: [],
      logLabel: "READ OLD ARCHIVE"
    })

    if (!oldRowsResult.ok) {
      console.log("READ OLD ARCHIVE ERROR:", oldRowsResult.error)

      showGameToast("تعذر قراءة عناصر الأرشيف القديمة")

      return false
    }

    const oldRows = oldRowsResult.data

    const oldMap = {}

    ;(oldRows || []).forEach((row) => {
      oldMap[Number(row.position)] = row
    })

    const rows = []

    rows.push({
      model: Number(currentModel),
      round,
      position: 1,
      item_type: "text",
      label: "",
      text: text1,
      image: "",
      parent_position: null,
      column_group: null,
      prompt_style: null
    })

    rows.push({
      model: Number(currentModel),
      round,
      position: 2,
      item_type: "text",
      label: "",
      text: text2,
      image: "",
      parent_position: null,
      column_group: null,
      prompt_style: null
    })

    for (const position of [3, 4]) {
      let image = oldMap[position]?.image || ""
      const file = document.getElementById(`archiveItemFile_${position}`)?.files?.[0] || null

      if (file) {
        image = await uploadImageFile(file, `archive_r${round}_${position}`)

        if (!image) {
          showGameToast(`فشل رفع صورة ${position}`)
          return false
        }
      }

      rows.push({
        model: Number(currentModel),
        round,
        position,
        item_type: "image",
        label: "",
        text: "",
        image,
        parent_position: null,
        column_group: null,
        prompt_style: null
      })
    }

    for (const position of archiveExtraTextPositions || []) {
      const label = (document.getElementById(`archiveItemLabel_${position}`)?.value || "").trim()
      const text = (document.getElementById(`archiveItemText_${position}`)?.value || "").trim()

      if (!label && !text) continue

      const parentPosition = Number(document.getElementById(`archiveItemParent_${position}`)?.value || 3)

      const promptStyle = (document.getElementById(`archiveItemPromptStyle_${position}`)?.value || "shoe").trim()

      rows.push({
        model: Number(currentModel),
        round,
        position: Number(position),
        item_type: "text",
        label,
        text,
        image: "",
        parent_position: parentPosition,
        column_group: parentPosition,
        prompt_style: promptStyle
      })
    }

    const boxResult = await dbUpsert(
      "archive_boxes",
      [
        {
          model: Number(currentModel),
          round,
          tournament: text1,
          season: text2,
          score: scoreValue
        }
      ],
      {
        onConflict: "model,round",
        logLabel: "SAVE ARCHIVE BOX"
      }
    )

    if (!boxResult.ok) {
      showGameToast("فشل حفظ صندوق الأرشيف")
      return false
    }

    const keepPositions = rows.map((row) => Number(row.position))

    const existingRowsResult = await dbSelect("archive_items", (query) => query.eq("model", Number(currentModel)).eq("round", round), {
      select: "position",
      fallback: [],
      logLabel: "READ EXISTING ARCHIVE"
    })

    if (!existingRowsResult.ok) {
      console.log("READ EXISTING ARCHIVE ERROR:", existingRowsResult.error)

      showGameToast("تعذر قراءة عناصر الأرشيف الحالية")

      return false
    }

    const existingRows = existingRowsResult.data

    for (const oldRow of existingRows || []) {
      const oldPosition = Number(oldRow.position)

      if (!keepPositions.includes(oldPosition)) {
        const deleteResult = await dbDelete(
          "archive_items",
          (query) => query.eq("model", Number(currentModel)).eq("round", round).eq("position", oldPosition),
          {
            logLabel: "DELETE OLD ARCHIVE"
          }
        )

        if (!deleteResult.ok) {
          console.log("DELETE OLD ARCHIVE ERROR:", deleteResult.error)

          showGameToast("فشل تنظيف عناصر الأرشيف")

          return false
        }
      }
    }

    const itemsResult = await dbUpsert("archive_items", rows, {
      onConflict: "model,round,position",
      logLabel: "SAVE ARCHIVE ITEMS"
    })

    if (!itemsResult.ok) {
      showGameToast("فشل حفظ عناصر الأرشيف")
      return false
    }

    archivePendingExtraCount = 0
    archiveDraftState = {}

    showGameToast(`تم حفظ الجولة ${round}`)
    await renderArchiveAdminRound(round)
    await renderAdminTabsUnified()
    return true
  } catch (err) {
    console.log("SAVE ARCHIVE ROUND CATCH:", err)
    showGameToast("توقف حفظ الأرشيف بسبب خطأ")
    return false
  } finally {
    setAdminSaving(false)
  }
}

/* =========================
   34) Archive Delete Helpers
========================= */

async function deleteArchiveItem(round, position) {
  if (!canRunAdminDelete()) return

  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")
    return
  }

  const ok = confirm(`هل تريد حذف العنصر ${position} من الجولة ${round}؟`)
  if (!ok) return

  const deleteResult = await dbDelete(
    "archive_items",
    (query) => query.eq("model", Number(currentModel)).eq("round", Number(round)).eq("position", Number(position)),
    {
      logLabel: "DELETE ARCHIVE ITEM"
    }
  )

  if (!deleteResult.ok) {
    console.log("DELETE ARCHIVE ITEM ERROR:", deleteResult.error)

    showGameToast("تعذر حذف العنصر")

    return
  }

  showGameToast(`تم حذف العنصر ${position}`)
  await renderArchiveAdminRound(round)
  await renderAdminTabsUnified()
}

async function deleteArchiveSegment(round = null) {
  if (!canRunAdminDelete()) return

  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")
    return
  }

  const hasRound = round !== null && round !== undefined

  const safeRound = Number(round || archiveAdminRound || 1)

  const ok = confirm(hasRound ? `هل تريد حذف الجولة ${safeRound} من الأرشيف؟` : "هل تريد حذف جميع جولات الأرشيف؟")

  if (!ok) return

  try {
    if (hasRound) {
      const [itemsRes, boxRes] = await Promise.all([
        dbDelete("archive_items", (query) => query.eq("model", Number(currentModel)).eq("round", safeRound), {
          logLabel: "DELETE ARCHIVE ROUND ITEMS"
        }),

        dbDelete("archive_boxes", (query) => query.eq("model", Number(currentModel)).eq("round", safeRound), {
          logLabel: "DELETE ARCHIVE ROUND BOXES"
        })
      ])

      if (!itemsRes.ok || !boxRes.ok) {
        console.log(itemsRes.error || boxRes.error)

        showGameToast("تعذر حذف الجولة")

        return
      }

      showGameToast(`تم حذف الجولة ${safeRound}`)

      archivePendingExtraCount = 0
      archiveDraftState = {}

      await renderArchiveAdminRound(safeRound)

      await renderAdminTabsUnified()

      return
    }

    const [itemsRes, boxesRes, settingsRes] = await Promise.all([
      dbDelete("archive_items", (query) => query.eq("model", Number(currentModel)), {
        logLabel: "DELETE ARCHIVE ITEMS"
      }),

      dbDelete("archive_boxes", (query) => query.eq("model", Number(currentModel)), {
        logLabel: "DELETE ARCHIVE BOXES"
      }),

      dbDelete("segment_settings", (query) => query.eq("model", Number(currentModel)).eq("segment", "archive"), {
        logLabel: "DELETE ARCHIVE SETTINGS"
      })
    ])

    if (!itemsRes.ok || !boxesRes.ok || !settingsRes.ok) {
      console.log(itemsRes.error || boxesRes.error || settingsRes.error)

      showGameToast("تعذر حذف الأرشيف")

      return
    }

    archiveAdminRoundsCount = 4
    archiveAdminRound = 1
    archivePendingExtraCount = 0
    archiveDraftState = {}

    showGameToast("تم حذف الأرشيف بالكامل")

    await renderArchiveAdmin()
    await renderAdminTabsUnified()
  } catch (err) {
    console.log("DELETE ARCHIVE SEGMENT ERROR:", err)

    showGameToast("حدث خطأ أثناء حذف الأرشيف")
  }
}

async function openGlobalSegmentVisibilityPanel() {
  const overlay = document.getElementById("globalSegmentVisibilityOverlay")
  const grid = document.getElementById("globalSegmentVisibilityGrid")

  if (!overlay || !grid) return

  overlay.classList.remove("hidden")
  grid.innerHTML = `<div class="adminEmptyState">جاري تحميل إعدادات الفقرات...</div>`

  if (typeof loadGlobalSegmentVisibilityMap === "function") {
    await loadGlobalSegmentVisibilityMap()
  }

  renderGlobalSegmentVisibilityGrid()
}

function closeGlobalSegmentVisibilityPanel() {
  const overlay = document.getElementById("globalSegmentVisibilityOverlay")
  if (overlay) overlay.classList.add("hidden")
}

function renderGlobalSegmentVisibilityGrid() {
  const grid = document.getElementById("globalSegmentVisibilityGrid")
  if (!grid) return

  const map = globalSegmentVisibilityMap || {}

  const sortedSegments = [
    ...ALL_GAME_SEGMENTS.filter((segment) => isAdminSegmentGloballyEnabled(segment.key, map)),
    ...ALL_GAME_SEGMENTS.filter((segment) => !isAdminSegmentGloballyEnabled(segment.key, map))
  ]

  grid.innerHTML = `
    <div class="globalSegmentCardsGrid">
      ${sortedSegments
        .map((segment) => {
          const enabled = isAdminSegmentGloballyEnabled(segment.key, map)
          return buildGlobalSegmentToggleCard(segment, enabled)
        })
        .join("")}
    </div>
  `
}

function buildGlobalSegmentToggleCard(segment, enabled) {
  return `
    <button
      type="button"
      class="globalSegmentToggleCard ${enabled ? "isEnabled" : "isDisabled"}"
      onclick="toggleGlobalSegmentVisibilityFromGate('${segment.key}')"
    >
      <span class="globalSegmentToggleTitle">
        ${escapeHtml(segment.title)}
      </span>

      <span class="globalSegmentToggleSwitch">
        <span></span>
      </span>
    </button>
  `
}

async function toggleGlobalSegmentVisibilityFromGate(segmentKey) {
  const current = isAdminSegmentGloballyEnabled(segmentKey)
  const next = !current

  const saved = await setGlobalSegmentEnabled(segmentKey, next)
  if (!saved) return

  renderGlobalSegmentVisibilityGrid()

  if (currentModel && typeof renderAdminHome === "function") {
    await renderAdminHome()
  }
}

/* =========================
   GLOBAL SEGMENT VISIBILITY EXPORTS
========================= */

window.openGlobalSegmentVisibilityPanel = openGlobalSegmentVisibilityPanel

window.closeGlobalSegmentVisibilityPanel = closeGlobalSegmentVisibilityPanel

window.loadGlobalSegmentVisibilityMap = loadGlobalSegmentVisibilityMap

window.isAdminSegmentGloballyEnabled = isAdminSegmentGloballyEnabled

window.toggleAdminSegmentVisibility = toggleAdminSegmentVisibility

window.setGlobalSegmentEnabled = setGlobalSegmentEnabled

window.toggleGlobalSegmentVisibilityFromGate = toggleGlobalSegmentVisibilityFromGate

/* =========================
   RANDOM CHALLENGE EXPORTS
========================= */

window.openAdminRandomChallenge = openAdminRandomChallenge

window.switchRandomChallengeAdminSection = switchRandomChallengeAdminSection

window.saveRandomChallengeCurrentSection = saveRandomChallengeCurrentSection

window.clearRandomChallengeAdminQuestion = clearRandomChallengeAdminQuestion

window.deleteRandomChallengeCurrentSection = deleteRandomChallengeCurrentSection

window.selectRandomChallengeTrueFalseAnswer = selectRandomChallengeTrueFalseAnswer

window.saveFatblaSection = saveFatblaSection

window.clearFatblaQuestion = clearFatblaQuestion

window.deleteFatblaSection = deleteFatblaSection
