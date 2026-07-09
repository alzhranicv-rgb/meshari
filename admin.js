/* =========================================================
   ADMIN.JS - CLEAN ORDER
   PART 1: GLOBALS + HELPERS + SETTINGS + HOME + CHECKS + MODELS + TABS
========================================================= */

/* =========================
   1) Globals
========================= */

const BUCKET_NAME = "r3-images"

let currentModel = null
let currentModelName = ""
let gameToastTimer = null

let currentAdminSegment = ""
let adminNavBusy = false

let auctionAdminCount = 8
let whoAdminCount = 15
let finalRound1AdminCount = 6
let explainAdminCount = 4
let finalRound3AdminCount = 4
let finalRound4AdminCount = 4

let finalAdminRound = 1

let explainAdminDraft = {}

let top10AdminRoundsCount = 3
let archiveAdminRoundsCount = 4
let archiveAdminRound = 1
let archivePendingExtraCount = 0
let archiveExtraTextPositions = []
let archiveDraftState = {}

const ARCHIVE_TEXT_START_POSITION = 5
const ARCHIVE_MAX_TEXT_BOXES = 20

const ALL_GAME_SEGMENTS = [
  { key: "warmup", title: "التسخين", sort: 1 },
  { key: "top10", title: "Top 10", sort: 2 },
  { key: "auction", title: "فتبلة", sort: 3 },
  { key: "who", title: "من هو", sort: 4 },
  { key: "explain", title: "اشرح الكلمة", sort: 5 },

  { key: "finalRound1", title: "ٮدوں ٮڡاط", sort: 6 },
  { key: "finalRound2", title: "صح صحلي", sort: 7 },
  { key: "finalRound3", title: "قصة", sort: 8 },
  { key: "finalRound4", title: "التركيز", sort: 9 },

  { key: "archive", title: "الأرشيف", sort: 10 },
  { key: "randomChallenge", title: "التحدي", sort: 11 }
]

/* =========================
   2) Init
========================= */

async function initAdminPanel() {
  await loadModels()

  currentModel = null
  currentModelName = ""

  updateAdminBrandModel()
  showAdminModelGate()
}

/* =========================
   3) Toast
========================= */

function showGameToast(message, type = "info") {
  const toast = document.getElementById("gameToast")
  const text = document.getElementById("gameToastText")

  if (!toast || !text) return

  let icon = document.getElementById("gameToastIcon")

  if (!icon) {
    text.insertAdjacentHTML("beforebegin", `
      <span id="gameToastIcon" class="gameToastIcon"></span>
    `)

    icon = document.getElementById("gameToastIcon")
  }

  toast.classList.remove("success", "error", "warning", "info")
  toast.classList.add(type || "info")

  const icons = {
    success: "✓",
    error: "!",
    warning: "!",
    info: "●"
  }

  if (icon) icon.innerText = icons[type] || icons.info

  text.innerText = message

  toast.classList.remove("hidden", "show")

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

function showAdminConfirm(message, {
  title = "تأكيد الإجراء",
  okText = "موافق",
  cancelText = "إلغاء",
  danger = false
} = {}) {
  return new Promise(resolve => {
    document.getElementById("adminConfirmModal")?.remove()

    document.body.insertAdjacentHTML("beforeend", `
      <div class="adminConfirmOverlay" id="adminConfirmModal">
        <div class="adminConfirmCard ${danger ? "danger" : ""}">
          <div class="adminConfirmIcon">${danger ? "!" : "؟"}</div>

          <div class="adminConfirmContent">
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(message)}</p>
          </div>

          <div class="adminConfirmActions">
            <button type="button" class="adminConfirmCancelBtn" id="adminConfirmCancelBtn">
              ${escapeHtml(cancelText)}
            </button>

            <button type="button" class="adminConfirmOkBtn" id="adminConfirmOkBtn">
              ${escapeHtml(okText)}
            </button>
          </div>
        </div>
      </div>
    `)

    const modal = document.getElementById("adminConfirmModal")
    const cancelBtn = document.getElementById("adminConfirmCancelBtn")
    const okBtn = document.getElementById("adminConfirmOkBtn")

    function close(value) {
      modal?.remove()
      resolve(value)
    }

    cancelBtn.onclick = () => close(false)
    okBtn.onclick = () => close(true)

    modal.onclick = e => {
      if (e.target === modal) close(false)
    }
  })
}
/* =========================
   Admin Model PIN
   الرقم السري للنموذج داخل الأدمن فقط
========================= */

function getAdminModelAccessKey(modelId) {
  return `admin_model_access_${Number(modelId)}`
}

function isAdminModelUnlocked(modelId) {
  return false
}

function unlockAdminModel(modelId) {
}

function closeAdminPinModal() {
  document.getElementById("adminPinModal")?.remove()
}

function requestAdminPinModal({
  title = "الرقم السري",
  message = "اكتب الرقم السري للنموذج",
  confirmText = "تأكيد"
} = {}) {
  return new Promise(resolve => {
    closeAdminPinModal()

    document.body.insertAdjacentHTML("beforeend", `
      <div class="adminModalOverlay" id="adminPinModal">
        <div class="adminModalCard">
          <div class="adminModalTitle">${escapeHtml(title)}</div>

          <div class="adminField">
            <label>${escapeHtml(message)}</label>
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
            <button type="button" class="adminBtn adminBtnLight" id="adminPinCancelBtn">
              إلغاء
            </button>

            <button type="button" class="adminBtn adminBtnMango" id="adminPinConfirmBtn">
              ${escapeHtml(confirmText)}
            </button>
          </div>
        </div>
      </div>
    `)

    const modal = document.getElementById("adminPinModal")
    const input = document.getElementById("adminModelPinInput")
    const cancelBtn = document.getElementById("adminPinCancelBtn")
    const confirmBtn = document.getElementById("adminPinConfirmBtn")

    function cancel() {
      closeAdminPinModal()
      resolve("")
    }

    function confirm() {
      const value = (input?.value || "").trim()
      closeAdminPinModal()
      resolve(value)
    }

    cancelBtn.onclick = cancel
    confirmBtn.onclick = confirm

    modal.onclick = e => {
      if (e.target === modal) cancel()
    }

    input.addEventListener("keydown", e => {
      if (e.key === "Enter") confirm()
      if (e.key === "Escape") cancel()
    })

    setTimeout(() => {
      input.focus()
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

  const { data, error } = await db
    .from("models")
    .select("id, name, admin_pin")
    .eq("id", id)
    .maybeSingle()

  if (error || !data) {
    console.log("MODEL PIN READ ERROR:", error)
    showGameToast("تعذر قراءة بيانات النموذج")
    return null
  }

  const savedPin = String(data.admin_pin || "").trim()

  /* النموذج قديم وما له رقم سري */
  if (!savedPin) {
    const newPin = await requestAdminPinModal({
      title: `تأمين ${data.name || fallbackName || "النموذج"}`,
      message: "هذا النموذج قديم وما له رقم سري، اكتب رقم سري جديد له",
      confirmText: "حفظ الرقم"
    })

    if (!newPin) {
      showGameToast("لازم تضيف رقم سري للنموذج")
      return null
    }

    const { error: updateError } = await db
      .from("models")
      .update({
        admin_pin: newPin
      })
      .eq("id", id)

    if (updateError) {
      console.log("SAVE OLD MODEL PIN ERROR:", updateError)
      showGameToast("تعذر حفظ الرقم السري للنموذج")
      return null
    }

    unlockAdminModel(id)
showGameToast("تم حفظ الرقم السري للنموذج")

return {
  id,
  name: data.name || fallbackName || `نموذج ${id}`
}
  }

  /* النموذج عنده رقم سري */
  const enteredPin = await requestAdminPinModal({
    title: `فتح ${data.name || fallbackName || "النموذج"}`,
    message: "اكتب الرقم السري الخاص بهذا النموذج",
    confirmText: "فتح النموذج"
  })

  if (!enteredPin) return null

  if (String(enteredPin) !== savedPin) {
    showGameToast("الرقم السري غير صحيح")
    return null
  }

  unlockAdminModel(id)

return {
  id,
  name: data.name || fallbackName || `نموذج ${id}`
}
}

/* =========================
   4) Basic Helpers
========================= */

function editor() {
  return document.getElementById("adminEditor")
}

function tabs() {
  return document.getElementById("adminTabs")
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function modelGate() {
  return document.getElementById("adminModelGate")
}

function workspace() {
  return document.getElementById("adminWorkspace")
}

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

function getCurrentModelNameSafe() {
  return currentModelName || `نموذج ${currentModel || ""}`
}

function clearActiveAdminTab() {
  currentAdminSegment = ""
}

function setActiveAdminTab(segment) {
  currentAdminSegment = segment || ""
  renderAdminTabsUnified()
}

function showAdminEmptyState(message = "افتح نموذجًا ثم اختر الفقرة التي تريد تعديلها") {
  const area = editor()
  if (!area) return

  area.innerHTML = `<div class="adminEmptyState">${escapeHtml(message)}</div>`
}

function workspaceActions() {
  return document.getElementById("adminWorkspaceActions")
}

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
   Admin One Page Navigation
========================= */

function ensureAdminEditorBackButton() {
  return
}

function toggleAdminQuickSettings() {
  openAdminSegmentSettings()
}
function hasText(value) {
  return String(value || "").trim().length > 0
}

/* هذا يلغي الشريط القديم داخل الفقرات */
async function buildSegmentStatusGrid() {
  return ""
}

/* =========================
   Global Segment Visibility
   تعطيل / تفعيل الفقرات عام
========================= */

let globalSegmentVisibilityMap = {}

async function loadGlobalSegmentVisibilityMap() {
  const map = {}

  ALL_GAME_SEGMENTS.forEach(segment => {
    map[segment.key] = true
  })

  try {
    const { data, error } = await db
      .from("global_segment_visibility")
      .select("segment_key,is_enabled")

    if (error) {
      console.log("LOAD GLOBAL SEGMENT VISIBILITY ERROR:", error)
      globalSegmentVisibilityMap = map
      return globalSegmentVisibilityMap
    }

    ;(data || []).forEach(row => {
      map[row.segment_key] = row.is_enabled !== false
    })

    globalSegmentVisibilityMap = map
    return globalSegmentVisibilityMap
  } catch (err) {
    console.log("LOAD GLOBAL SEGMENT VISIBILITY CATCH:", err)
    globalSegmentVisibilityMap = map
    return globalSegmentVisibilityMap
  }
}

function isAdminSegmentGloballyEnabled(segmentKey, globalMap = null) {
  const map = globalMap || globalSegmentVisibilityMap || {}
  return map[segmentKey] !== false
}

function getVisibleAdminSegments(globalMap = null) {
  const map = globalMap || globalSegmentVisibilityMap || {}
  return ALL_GAME_SEGMENTS.filter(segment => isAdminSegmentGloballyEnabled(segment.key, map))
}

function getHiddenAdminSegments(globalMap = null) {
  const map = globalMap || globalSegmentVisibilityMap || {}
  return ALL_GAME_SEGMENTS.filter(segment => !isAdminSegmentGloballyEnabled(segment.key, map))
}

async function setGlobalSegmentEnabled(segmentKey, enabled) {
  const key = String(segmentKey || "").trim()
  if (!key) return false

  const segmentTitle = getAdminSegmentTitle(key)

  const ok = await showAdminConfirm(
  enabled
    ? `هل تريد تفعيل فقرة "${segmentTitle}" عام؟`
    : `هل تريد تعطيل فقرة "${segmentTitle}" عام؟`,
  {
    title: enabled ? "تفعيل الفقرة" : "إخفاء الفقرة",
    okText: enabled ? "تفعيل" : "إخفاء",
    cancelText: "إلغاء",
    danger: !enabled
  }
)

if (!ok) return false

  try {
    const { error } = await db
      .from("global_segment_visibility")
      .upsert(
        {
          segment_key: key,
          is_enabled: !!enabled,
          updated_at: new Date().toISOString()
        },
        {
          onConflict: "segment_key"
        }
      )

    if (error) {
      console.log("SAVE GLOBAL SEGMENT VISIBILITY ERROR:", error)
      showGameToast("تعذر حفظ حالة الفقرة")
      return false
    }

    await loadGlobalSegmentVisibilityMap()

    showGameToast(enabled ? "تم تفعيل الفقرة" : "تم تعطيل الفقرة")
    return true
  } catch (err) {
    console.log("SAVE GLOBAL SEGMENT VISIBILITY CATCH:", err)
    showGameToast("حدث خطأ أثناء حفظ حالة الفقرة")
    return false
  }
}

async function toggleAdminSegmentVisibility(segmentKey, nextValue) {
  return await setGlobalSegmentEnabled(segmentKey, nextValue)
}
/* =========================
   5) Segment Settings
========================= */

function getAdminSettingLimit(segment) {

  if (segment === "auction") {
  return { fallback: 8, min: 4, max: 8, allowed: [4, 6, 8] }
}

  if (segment === "who") {
    return { fallback: 15, min: 10, max: 15, allowed: [10, 12, 15] }
  }

  if (segment === "finalRound1") {
    return { fallback: 6, min: 4, max: 8, allowed: [4, 6, 8] }
  }

  if (segment === "explain") {
    return { fallback: 4, min: 4, max: 8, allowed: [4, 6, 8] }
  }

  if (segment === "finalRound3") {
    return { fallback: 4, min: 4, max: 8, allowed: [4, 6, 8] }
  }

  if (segment === "finalRound4") {
    return { fallback: 4, min: 4, max: 8, allowed: [4, 6, 8] }
  }

  return { fallback: 4, min: 1, max: 8, allowed: [] }
}

function normalizeAdminSegmentCount(segment, value) {
  const limit = getAdminSettingLimit(segment)
  const num = Number(value || limit.fallback)

  if (limit.allowed.length) {
    return limit.allowed.includes(num) ? num : limit.fallback
  }

  return Math.min(Math.max(num, limit.min), limit.max)
}


async function getSegmentRoundCount(segment, fallback = 3, max = 4) {
  if (!currentModel) return fallback

  const { data, error } = await db
    .from("segment_settings")
    .select("item_count")
    .eq("model", Number(currentModel))
    .eq("segment", segment)
    .maybeSingle()

  if (error) {
    console.log("GET SEGMENT ROUND COUNT ERROR:", error)
    return fallback
  }

  return Math.min(Math.max(Number(data?.item_count || fallback), 1), max)
}

async function saveSegmentRoundCount(segment, count) {
  if (!currentModel) return false

  const safeCount = Math.min(Math.max(Number(count || 1), 1), 4)

  const { error } = await db
    .from("segment_settings")
    .upsert(
      {
        model: Number(currentModel),
        segment,
        item_count: safeCount
      },
      {
        onConflict: "model,segment"
      }
    )

  if (error) {
    console.log("SAVE SEGMENT ROUND COUNT ERROR:", error)
    showGameToast("تعذر حفظ عدد الجولات")
    return false
  }

  return true
}

async function getAdminSegmentCount(segment) {
  if (!currentModel) {
    return getAdminSettingLimit(segment).fallback
  }

  const limit = getAdminSettingLimit(segment)

  const { data, error } = await db
    .from("segment_settings")
    .select("item_count")
    .eq("model", Number(currentModel))
    .eq("segment", segment)
    .maybeSingle()

  if (error) {
    console.log("GET ADMIN SEGMENT COUNT ERROR:", error)
    return limit.fallback
  }

  return normalizeAdminSegmentCount(segment, data?.item_count || limit.fallback)
}

async function saveAdminSegmentCount(segment, count) {
  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")
    return false
  }

  const safeCount = normalizeAdminSegmentCount(segment, count)

  const { error } = await db
    .from("segment_settings")
    .upsert(
      {
        model: Number(currentModel),
        segment,
        item_count: safeCount
      },
      {
        onConflict: "model,segment"
      }
    )

  if (error) {
    console.log("SAVE ADMIN SEGMENT COUNT ERROR:", error)
    showGameToast("تعذر حفظ إعدادات الفقرة")
    return false
  }

  return true
}

function updateAdminQuickSettingUI(segment, count) {
  const safeCount = normalizeAdminSegmentCount(segment, count)

  if (segment === "auction") auctionAdminCount = safeCount
  if (segment === "who") whoAdminCount = safeCount
  if (segment === "finalRound1") finalRound1AdminCount = safeCount
  if (segment === "explain") explainAdminCount = safeCount
  if (segment === "finalRound3") finalRound3AdminCount = safeCount
  if (segment === "finalRound4") finalRound4AdminCount = safeCount
}

async function setAdminSegmentCount(segment, count) {
  if (isAdminSaving()) return false

  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")
    return false
  }

  try {
    setAdminSaving(true, "جارٍ حفظ الإعداد...")

    const safeCount = normalizeAdminSegmentCount(segment, count)
    const saved = await saveAdminSegmentCount(segment, safeCount)

    if (!saved) return false

    updateAdminQuickSettingUI(segment, safeCount)

    showGameToast("تم حفظ الإعداد")

    if (currentAdminSegment === segment) {
      await openAdminSegment(segment)
    }

    return true
  } catch (err) {
    console.log("SET ADMIN SEGMENT COUNT ERROR:", err)
    showGameToast("تعذر حفظ الإعداد")
    return false
  } finally {
    setAdminSaving(false)
  }
}

/* =========================
   6) Upload Helpers
========================= */

function makeSafeFileExt(file, fallback = "bin") {
  const nameExt = String(file?.name || "")
    .split(".")
    .pop()
    ?.toLowerCase()
    ?.replace(/[^a-z0-9]/g, "")

  if (nameExt) return nameExt

  const type = String(file?.type || "").toLowerCase()

  if (type.includes("jpeg")) return "jpg"
  if (type.includes("png")) return "png"
  if (type.includes("webp")) return "webp"
  if (type.includes("gif")) return "gif"
  if (type.includes("mp4")) return "mp4"
  if (type.includes("quicktime")) return "mov"
  if (type.includes("webm")) return "webm"

  return fallback
}

function makeUploadPath(prefix = "file", ext = "bin") {
  const cleanPrefix = String(prefix || "file")
    .replace(/[^a-zA-Z0-9_-]/g, "_")

  const modelFolder = currentModel
    ? `model_${Number(currentModel)}`
    : "model_unknown"

  return `${modelFolder}/${cleanPrefix}_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
}

function getFileSizeMB(file) {
  return Number((file.size / 1024 / 1024).toFixed(2))
}

async function uploadImageFile(file, prefix = "file") {
  if (!file) return ""

  const maxImageSizeMB = 15
  const sizeMB = getFileSizeMB(file)

  if (sizeMB > maxImageSizeMB) {
    showGameToast(`حجم الصورة كبير: ${sizeMB}MB`)
    return ""
  }

  const ext = makeSafeFileExt(file, "png")
  const fileName = makeUploadPath(prefix, ext)

  const { error: uploadError } = await db.storage
    .from(BUCKET_NAME)
    .upload(fileName, file, {
      upsert: true,
      cacheControl: "31536000",
      contentType: file.type || `image/${ext}`
    })

  if (uploadError) {
    console.log("UPLOAD IMAGE ERROR FULL:", uploadError)

    const msg =
      uploadError.message ||
      uploadError.error ||
      uploadError.statusCode ||
      "خطأ غير معروف"

    showGameToast(`فشل رفع الصورة: ${msg}`)
    return ""
  }

  const { data } = db.storage
    .from(BUCKET_NAME)
    .getPublicUrl(fileName)

  return data?.publicUrl || ""
}

async function uploadVideoFile(file, prefix = "video") {
  if (!file) return ""

  const maxSizeMB = 45
  const fileSizeMB = file.size / (1024 * 1024)

  if (fileSizeMB > maxSizeMB) {
    showGameToast(`حجم الفيديو ${fileSizeMB.toFixed(1)}MB أكبر من المسموح ${maxSizeMB}MB`)
    throw new Error("VIDEO_FILE_TOO_LARGE")
  }

  const ext = makeSafeFileExt(file, "mp4")
  const fileName = makeUploadPath(prefix, ext)

  const { error: uploadError } = await db.storage
    .from(BUCKET_NAME)
    .upload(fileName, file, {
      upsert: true,
      cacheControl: "31536000",
      contentType: file.type || "video/mp4"
    })

  if (uploadError) {
    console.log("UPLOAD VIDEO ERROR FULL:", uploadError)
    showGameToast("فشل رفع الفيديو")
    throw uploadError
  }

  const { data } = db.storage
    .from(BUCKET_NAME)
    .getPublicUrl(fileName)

  return data?.publicUrl || ""
}

/* =========================
   7) Saving Lock
========================= */

let adminSavingLock = false

function setAdminSaving(isSaving, message = "جارٍ الحفظ...") {
  adminSavingLock = !!isSaving

  const saveButtons = document.querySelectorAll(
    ".adminSaveBtn, .compactCountBtn"
  )

  saveButtons.forEach(btn => {
    if (isSaving) {
      if (!btn.dataset.originalText) {
        btn.dataset.originalText = btn.innerText
      }

      btn.disabled = true
      btn.classList.add("adminSavingBtn")
      btn.innerText = message
    } else {
      btn.disabled = false
      btn.classList.remove("adminSavingBtn")

      if (btn.dataset.originalText) {
        btn.innerText = btn.dataset.originalText
        delete btn.dataset.originalText
      }
    }
  })
}

function isAdminSaving() {
  if (adminSavingLock) {
    showGameToast("انتظر حتى ينتهي الحفظ")
    return true
  }

  return false
}

function canRunAdminDelete() {
  if (adminSavingLock) {
    showGameToast("لا يمكن الحذف أثناء الحفظ")
    return false
  }

  return true
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

document.addEventListener("click", e => {
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

  const topBar = area.querySelector(
    ".adminEditorTopBar, .compactAdminEditorTopBar, .archiveAdminTopBar"
  )

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
      className.split(" ").forEach(c => {
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
    .forEach(el => el.remove())

  area
    .querySelectorAll(
      ".top10ControlPanel, .auctionControlPanel, .whoControlPanel, .explainControlPanel, .archiveAdminControlBar, .finalTopCompactRow"
    )
    .forEach(row => {
      if (!row.children.length) row.remove()
    })

  toolsRow.querySelectorAll("button").forEach(btn => {
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

  area
    .querySelectorAll(
      ".adminCard, .adminQuestionCard, .finalAdminCard, .archiveMainInfoCard, .archiveImageCard"
    )
    .forEach(card => {
      card.classList.add("adminEditorCleanCard")
    })

  area
    .querySelectorAll("textarea")
    .forEach(textarea => {
      textarea.classList.add("adminCleanTextarea")
    })

  area
    .querySelectorAll("input:not([type='file']), select")
    .forEach(input => {
      input.classList.add("adminCleanInput")
    })

  area
    .querySelectorAll("input[type='file']")
    .forEach(input => {
      input.classList.add("adminCleanFile")
    })
}

/* =========================
   10) Admin Home Counts
========================= */

async function getAdminCompletionCounts() {
  const result = {
    warmup: 0,
    top10: 0,
    auction: 0,
    who: 0,
    explain: 0,

    finalRound1: 0,
    finalRound2: 0,
    finalRound3: 0,
    finalRound4: 0,

    archive: 0,
    randomChallenge: 0,

    top10RoundsCount: 3,
    auctionCount: 8,
    archiveRoundsCount: 4,

    whoCount: 15,
    finalRound1CardsCount: 6,
    explainCount: 4,
    finalRound3Count: 4,
    finalRound4Count: 4
  }

  if (!currentModel) return result

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

    top10Setting,
    auctionSetting,
    archiveSetting,
    whoSetting,
    finalRound1Setting,
    explainSetting,
    finalRound3Setting,
    finalRound4Setting
  ] = await Promise.all([
    db.from("questions")
      .select("id", { count: "exact", head: true })
      .eq("model", Number(currentModel))
      .eq("segment", "warmup"),

    db.from("top10_questions")
      .select("id", { count: "exact", head: true })
      .eq("model", Number(currentModel)),

    db.from("auction_questions")
      .select("id", { count: "exact", head: true })
      .eq("model", Number(currentModel)),

    db.from("who_images")
      .select("id", { count: "exact", head: true })
      .eq("model", Number(currentModel)),

    db.from("explain_words")
      .select("id", { count: "exact", head: true })
      .eq("model", Number(currentModel)),

    db.from("final_round1_items")
      .select("id", { count: "exact", head: true })
      .eq("model", Number(currentModel))
      .gte("number", 1)
      .lte("number", 8),

    db.from("final_round2_items")
  .select("id", { count: "exact", head: true })
  .eq("model", Number(currentModel))
  .in("number", [1, 2, 4, 5]),

    db.from("final_round3_items")
       .select("id", { count: "exact", head: true })
       .eq("model", Number(currentModel))
       .in("number", [101, 102]),

    db.from("final_round1_items")
      .select("id", { count: "exact", head: true })
      .eq("model", Number(currentModel))
      .gte("number", 201)
      .lte("number", 208),

    db.from("final_round3_items")
      .select("id", { count: "exact", head: true })
      .eq("model", Number(currentModel))
      .gte("number", 1)
      .lte("number", 8)
      .eq("image_order", 1),

    db.from("archive_boxes")
      .select("id", { count: "exact", head: true })
      .eq("model", Number(currentModel)),

    db.from("segment_settings")
      .select("item_count")
      .eq("model", Number(currentModel))
      .eq("segment", "top10")
      .maybeSingle(),

    db.from("segment_settings")
      .select("item_count")
      .eq("model", Number(currentModel))
      .eq("segment", "auction")
      .maybeSingle(),

    db.from("segment_settings")
      .select("item_count")
      .eq("model", Number(currentModel))
      .eq("segment", "archive")
      .maybeSingle(),

    db.from("segment_settings")
      .select("item_count")
      .eq("model", Number(currentModel))
      .eq("segment", "who")
      .maybeSingle(),

    db.from("segment_settings")
      .select("item_count")
      .eq("model", Number(currentModel))
      .eq("segment", "finalRound1")
      .maybeSingle(),

    db.from("segment_settings")
      .select("item_count")
      .eq("model", Number(currentModel))
      .eq("segment", "explain")
      .maybeSingle(),

    db.from("segment_settings")
      .select("item_count")
      .eq("model", Number(currentModel))
      .eq("segment", "finalRound3")
      .maybeSingle(),

    db.from("segment_settings")
      .select("item_count")
      .eq("model", Number(currentModel))
      .eq("segment", "finalRound4")
      .maybeSingle()
  ])

  result.warmup = qWarmup.count || 0
  result.top10 = qTop10.count || 0
  result.auction = qAuction.count || 0
  result.who = qWho.count || 0
  result.explain = qExplain.count || 0

  result.finalRound1 = qFinalRound1.count || 0
  result.finalRound2 = (qFinalRound2.count || 0) + (qFinalRound2Images.count || 0)
  result.finalRound3 = qFinalRound3Story.count || 0
  result.finalRound4 = qFinalRound4Focus.count || 0

  result.archive = qArchive.count || 0

  result.top10RoundsCount = Math.min(Math.max(Number(top10Setting.data?.item_count || 3), 1), 4)
  result.auctionCount = normalizeAdminSegmentCount("auction", auctionSetting.data?.item_count || 8)
  result.archiveRoundsCount = Math.min(Math.max(Number(archiveSetting.data?.item_count || 4), 1), 4)

  result.whoCount = normalizeAdminSegmentCount("who", whoSetting.data?.item_count || 15)
  result.finalRound1CardsCount = normalizeAdminSegmentCount("finalRound1", finalRound1Setting.data?.item_count || 6)
  result.explainCount = normalizeAdminSegmentCount("explain", explainSetting.data?.item_count || 4)
  result.finalRound3Count = normalizeAdminSegmentCount("finalRound3", finalRound3Setting.data?.item_count || 4)
  result.finalRound4Count = normalizeAdminSegmentCount("finalRound4", finalRound4Setting.data?.item_count || 4)

  return result
}

function isSegmentDone(key, count, counts = {}) {
  if (key === "warmup") return count >= 12

  if (key === "top10") {
    const rounds = Math.min(Math.max(Number(counts.top10RoundsCount || 3), 1), 4)
    return count >= rounds * 10
  }

  if (key === "auction") {
    const total = normalizeAdminSegmentCount("auction", counts.auctionCount || 8)
    return count >= total
  }

  if (key === "who") {
    const total = normalizeAdminSegmentCount("who", counts.whoCount || 15)
    return count >= total
  }

  if (key === "explain") {
    const total = normalizeAdminSegmentCount("explain", counts.explainCount || 4)
    return count >= total
  }

  if (key === "finalRound1") {
    const total = normalizeAdminSegmentCount("finalRound1", counts.finalRound1CardsCount || 6)
    return count >= total
  }

  if (key === "finalRound2") {
  return count >= 34
}

  if (key === "finalRound3") {
    const total = normalizeAdminSegmentCount("finalRound3", counts.finalRound3Count || 4)
    return count >= total
  }

  if (key === "finalRound4") {
    const total = normalizeAdminSegmentCount("finalRound4", counts.finalRound4Count || 4)
    return count >= total
  }

  if (key === "archive") {
    const rounds = Math.min(Math.max(Number(counts.archiveRoundsCount || 4), 1), 4)
    return count >= rounds
  }

  if (key === "randomChallenge") {
  return true
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

  const counts = await getAdminCompletionCounts()
  const visibility = await loadGlobalSegmentVisibilityMap()
 const visibleSegments = getVisibleAdminSegments(visibility)

  const readyCount = visibleSegments.filter(segment => {
    const done = Number(counts[segment.key] || 0)
    return isSegmentDone(segment.key, done, counts)
  }).length

  const enabledCount = visibleSegments.length

  const cards = visibleSegments.map(segment => {
    const key = segment.key
    const title = segment.title || getAdminSegmentTitle(key)
    const done = Number(counts[key] || 0)
    const total = getAdminSegmentRequiredCount(key, counts)
    const isDone = isSegmentDone(key, done, counts)
    const isEnabled = visibility[key] !== false
    const isComingSoon = key === "randomChallenge"

    return `
      <div class="adminHomeSegmentCard ${isDone ? "isDone" : ""} ${!isEnabled ? "isDisabled" : ""}">
        <button
          type="button"
          class="adminHomeSegmentMain"
          ${isComingSoon ? "disabled" : `onclick="openAdminSegment('${key}')"` }
        >
          <div class="adminHomeSegmentTop">
  <div>
    <div class="adminHomeSegmentTitle">${escapeHtml(title)}</div>
  </div>

  <span class="adminHomeSegmentStatus ${isDone ? "ready" : "missing"}">
    ${isComingSoon ? "" : isDone ? "جاهزة" : "ناقصة"}
  </span>
</div>

          <div class="adminHomeProgress">
            <div class="adminHomeProgressInfo">
              <strong>${total > 0 ? `${done}/${total}` : done}</strong>
            </div>

            <div class="adminHomeProgressBar">
              <span style="width:${total > 0 ? Math.min((done / total) * 100, 100) : 0}%"></span>
            </div>
          </div>
        </button>
      </div>
    `
  }).join("")

  area.innerHTML = `
    <div class="adminHomePro adminHomeClean">

      <section class="adminHomeStats adminHomeStatsClean">
        <div class="adminHomeStatCard">
          <span>الفقرات الجاهزة</span>
          <strong>${readyCount}/${visibleSegments.length}</strong>
        </div>

        <div class="adminHomeStatCard">
          <span>الفقرات الظاهرة</span>
          <strong>${enabledCount}/${ALL_GAME_SEGMENTS.length}</strong>
        </div>

        <div class="adminHomeStatCard">
          <span>حالة النموذج</span>
          <strong>${readyCount === visibleSegments.length ? "مكتمل" : "قيد التحرير"}</strong>
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
  if (key === "warmup") return 12

  if (key === "top10") {
    const rounds = Math.min(Math.max(Number(counts.top10RoundsCount || 3), 1), 4)
    return rounds * 10
  }

  if (key === "auction") {
    return normalizeAdminSegmentCount("auction", counts.auctionCount || 8)
  }

  if (key === "who") {
    return normalizeAdminSegmentCount("who", counts.whoCount || 15)
  }

  if (key === "explain") {
    return normalizeAdminSegmentCount("explain", counts.explainCount || 4)
  }

  if (key === "finalRound1") {
    return normalizeAdminSegmentCount("finalRound1", counts.finalRound1CardsCount || 6)
  }

  if (key === "finalRound2") return 34

  if (key === "finalRound3") {
    return normalizeAdminSegmentCount("finalRound3", counts.finalRound3Count || 4)
  }

  if (key === "finalRound4") {
    return normalizeAdminSegmentCount("finalRound4", counts.finalRound4Count || 4)
  }

  if (key === "archive") {
    return Math.min(Math.max(Number(counts.archiveRoundsCount || 4), 1), 4)
  }

  if (key === "randomChallenge") return 1

  return 0
}


async function openAdminSegmentSettings() {
  if (!currentModel) {
    showGameToast("افتح نموذج أولاً")
    return
  }

  currentAdminSegment = "settings"
  renderAdminSettingsActions()
  await renderAdminTabsUnified()

  const counts = await getAdminCompletionCounts()
  const visibility = await loadGlobalSegmentVisibilityMap()

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
  key: "auction",
  title: "فتبلة",
  desc: "عدد الأرقام",
  inputId: "settingsAuctionCount",
  value: normalizeAdminSegmentCount("auction", counts.auctionCount || 8),
  options: [4, 6, 8]
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
      value: normalizeAdminSegmentCount("explain", counts.explainCount || 4),
      options: [4, 6, 8]
    },
    {
      key: "finalRound1",
      title: "ٮدوں ٮڡاط",
      desc: "عدد الأرقام",
      inputId: "settingsFinalRound1Count",
      value: normalizeAdminSegmentCount("finalRound1", counts.finalRound1CardsCount || 6),
      options: [4, 6, 8]
    },
    {
      key: "finalRound3",
      title: "قصة",
      desc: "عدد الأرقام",
      inputId: "settingsFinalRound3Count",
      value: normalizeAdminSegmentCount("finalRound3", counts.finalRound3Count || 4),
      options: [4, 6, 8]
    },
    {
      key: "finalRound4",
      title: "التركيز",
      desc: "عدد الأرقام",
      inputId: "settingsFinalRound4Count",
      value: normalizeAdminSegmentCount("finalRound4", counts.finalRound4Count || 4),
      options: [4, 6, 8]
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

  const visibleSettings = settings.filter(item => {
  return isAdminSegmentGloballyEnabled(item.key, visibility)
})

editor().innerHTML = `
  <div class="adminSettingsGamePage">
    <div class="adminSettingsGameGrid">
      ${visibleSettings.map(item => buildAdminSettingCardPro(item)).join("")}
    </div>
  </div>
`
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
        ${options.map(option => `
          <button
            type="button"
            class="adminSettingGameOption ${Number(value) === Number(option) ? "selected" : ""}"
            onclick="selectAdminSettingOption('${escapeHtml(inputId)}', ${Number(option)}, this)"
          >
            ${option}
          </button>
        `).join("")}
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

function selectAdminSettingOption(inputId, value, btn) {
  const input = document.getElementById(inputId)
  if (input) input.value = String(value)

  const card = btn.closest(".adminSettingGameCard")
  if (!card) return

  card.querySelectorAll(".adminSettingGameOption").forEach(item => {
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
  item_count: normalizeAdminSegmentCount("auction", document.getElementById("settingsAuctionCount")?.value || 8)
},
      {
        model: Number(currentModel),
        segment: "who",
        item_count: normalizeAdminSegmentCount("who", document.getElementById("settingsWhoCount")?.value || 15)
      },
      {
        model: Number(currentModel),
        segment: "explain",
        item_count: normalizeAdminSegmentCount("explain", document.getElementById("settingsExplainCount")?.value || 4)
      },
      {
        model: Number(currentModel),
        segment: "finalRound1",
        item_count: normalizeAdminSegmentCount("finalRound1", document.getElementById("settingsFinalRound1Count")?.value || 6)
      },
      {
        model: Number(currentModel),
        segment: "finalRound3",
        item_count: normalizeAdminSegmentCount("finalRound3", document.getElementById("settingsFinalRound3Count")?.value || 4)
      },
      {
        model: Number(currentModel),
        segment: "finalRound4",
        item_count: normalizeAdminSegmentCount("finalRound4", document.getElementById("settingsFinalRound4Count")?.value || 4)
      },
      {
        model: Number(currentModel),
        segment: "archive",
        item_count: Math.min(Math.max(Number(document.getElementById("settingsArchiveRounds")?.value || 4), 1), 4)
      }
    ]

    const { error } = await db
      .from("segment_settings")
      .upsert(rows, {
        onConflict: "model,segment"
      })

    if (error) {
      console.log("SAVE ADMIN SEGMENT SETTINGS PAGE ERROR:", error)
      showGameToast("تعذر حفظ إعدادات الفقرات")
      return false
    }

    top10AdminRoundsCount = rows.find(row => row.segment === "top10")?.item_count || 3
    auctionAdminCount = rows.find(row => row.segment === "auction")?.item_count || 8
    whoAdminCount = rows.find(row => row.segment === "who")?.item_count || 15
    explainAdminCount = rows.find(row => row.segment === "explain")?.item_count || 4
    finalRound1AdminCount = rows.find(row => row.segment === "finalRound1")?.item_count || 6
    finalRound3AdminCount = rows.find(row => row.segment === "finalRound3")?.item_count || 4
    finalRound4AdminCount = rows.find(row => row.segment === "finalRound4")?.item_count || 4
    archiveAdminRoundsCount = rows.find(row => row.segment === "archive")?.item_count || 4

    showGameToast("تم حفظ إعدادات الفقرات")
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
  const found = ALL_GAME_SEGMENTS.find(item => item.key === key)
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

async function renderAdminTabsUnified() {
  const wrap = tabs()
  if (!wrap) return

  wrap.classList.add("hidden")
  wrap.innerHTML = ""
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
  const allOk = results.every(item => item.ok)

  document.getElementById("modelCheckModal")?.remove()

  document.body.insertAdjacentHTML("beforeend", `
    <div class="adminModalOverlay" id="modelCheckModal">
      <div class="adminModalCard modelCheckModalCard">
        <div class="adminModalTitle">
          ${allOk ? "النموذج جاهز للعب" : "تقرير فحص النموذج"}
        </div>

        <div class="modelCheckSummary ${allOk ? "ready" : "notReady"}">
          ${allOk ? "كل الفقرات مكتملة" : "يوجد نواقص تحتاج مراجعة"}
        </div>

        <div class="modelCheckList">
          ${results.map(item => `
            <div class="modelCheckItem ${item.ok ? "ok" : "bad"}">
              <div class="modelCheckItemHead">
                <span class="modelCheckIcon">${item.ok ? "✓" : "!"}</span>
                <strong>${escapeHtml(item.title)}</strong>
              </div>

              ${
                item.details.length
                  ? `<div class="modelCheckDetails">
                      ${item.details.map(detail => `
                        <div>${escapeHtml(detail)}</div>
                      `).join("")}
                    </div>`
                  : ""
              }
            </div>
          `).join("")}
        </div>

        <div class="adminModalActions">
          <button type="button" class="adminBtn adminBtnLight" onclick="closeModelCheckModal()">إغلاق</button>
        </div>
      </div>
    </div>
  `)

  const modal = document.getElementById("modelCheckModal")

  if (modal) {
    modal.addEventListener("click", e => {
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

    if (isAdminSegmentGloballyEnabled("auction", visibility)) {
      results.push(await checkAuctionReady())
    }

    if (isAdminSegmentGloballyEnabled("who", visibility)) {
      results.push(await checkWhoReady())
    }

    if (isAdminSegmentGloballyEnabled("explain", visibility)) {
      results.push(await checkExplainReady())
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

    renderModelCheckModal(results)
  } catch (err) {
    console.log("MODEL CHECK ERROR:", err)
    showGameToast("تعذر فحص النموذج")
  }
}

/* =========================
   14) Ready Checks
========================= */

async function checkWarmupReady() {
  const { data, error } = await db
    .from("questions")
    .select("*")
    .eq("model", Number(currentModel))
    .eq("segment", "warmup")

  if (error) {
    console.log(error)
    return readinessItem("التسخين", false, ["تعذر قراءة بيانات التسخين"])
  }

  const map = {}

  ;(data || []).forEach(row => {
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

      if (!hasText(row.question)) missing.push(`الفئة ${c} - سؤال ${n}: نص السؤال فارغ`)
      if (!hasText(row.answer)) missing.push(`الفئة ${c} - سؤال ${n}: الإجابة فارغة`)
    }
  }

  return readinessItem(
    "التسخين",
    missing.length === 0,
    missing.length ? missing : ["12 سؤال مكتملة"]
  )
}

async function checkTop10Ready() {
  const maxRound = await getSegmentRoundCount("top10", 3, 4)

  const { data, error } = await db
    .from("top10_questions")
    .select("*")
    .eq("model", Number(currentModel))
    .order("round", { ascending: true })
    .order("position", { ascending: true })

  if (error) {
    console.log(error)
    return readinessItem("Top 10", false, ["تعذر قراءة بيانات Top 10"])
  }

  const map = {}

  ;(data || []).forEach(row => {
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

      if (!hasText(row.question)) missing.push(`الجولة ${r}: السؤال الرئيسي فارغ`)
      if (!hasText(row.answer)) missing.push(`الجولة ${r} - الإجابة ${i} فارغة`)
    }
  }

  return readinessItem(
    "Top 10",
    missing.length === 0,
    missing.length ? missing : [`مكتمل حسب عدد الجولات: ${maxRound}`]
  )
}

async function checkAuctionReady() {
  const requiredCount = await getAdminSegmentCount("auction")

  const { data, error } = await db
    .from("auction_questions")
    .select("*")
    .eq("model", Number(currentModel))
    .order("number", { ascending: true })

  if (error) {
    console.log(error)
    return readinessItem("فتبلة", false, ["تعذر قراءة بيانات فتبلة"])
  }

  const map = {}

  ;(data || []).forEach(row => {
    map[Number(row.number)] = row
  })

  const missing = []

  for (let i = 1; i <= requiredCount; i++) {
    const row = map[i]

    if (!row) {
      missing.push(`السؤال ${i} غير موجود`)
      continue
    }

    if (!hasText(row.question)) missing.push(`السؤال ${i}: نص السؤال فارغ`)
    if (!hasText(row.answer)) missing.push(`السؤال ${i}: الإجابة فارغة`)

    if (!hasText(row.image) && !hasText(row.video)) {
      missing.push(`السؤال ${i}: الصورة أو الفيديو غير موجود`)
    }
  }

  return readinessItem(
    "فتبلة",
    missing.length === 0,
    missing.length ? missing : [`مكتملة حسب عدد الأسئلة: ${requiredCount}`]
  )
}

async function checkWhoReady() {
  const requiredCount = await getAdminSegmentCount("who")

  const { data, error } = await db
    .from("who_images")
    .select("*")
    .eq("model", Number(currentModel))
    .order("number", { ascending: true })

  if (error) {
    console.log(error)
    return readinessItem("من هو", false, ["تعذر قراءة بيانات من هو"])
  }

  const map = {}

  ;(data || []).forEach(row => {
    map[Number(row.number)] = row
  })

  const missing = []

  for (let i = 1; i <= requiredCount; i++) {
    const row = map[i]

    if (!row) {
      missing.push(`العنصر ${i} غير موجود`)
      continue
    }

    if (!hasText(row.image)) missing.push(`العنصر ${i}: الصورة غير موجودة`)
    if (!hasText(row.answer)) missing.push(`العنصر ${i}: الإجابة فارغة`)
  }

  return readinessItem(
    "من هو",
    missing.length === 0,
    missing.length ? missing : [`من هو مكتملة بعدد ${requiredCount} عنصر`]
  )
}

async function checkExplainReady() {
  const count = await getAdminSegmentCount("explain")

  const { data, error } = await db
    .from("explain_words")
    .select("*")
    .eq("model", Number(currentModel))
    .order("number", { ascending: true })

  if (error) {
    console.log(error)
    return readinessItem("اشرح الكلمة", false, ["تعذر قراءة بيانات اشرح الكلمة"])
  }

  const map = {}

  ;(data || []).forEach(row => {
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

  return readinessItem(
    "اشرح الكلمة",
    missing.length === 0,
    missing.length ? missing : [`مكتملة بعدد ${count} كلمات`]
  )
}

function getFinalRound1NoDotsCount(cardsCount) {
  const count = Number(cardsCount || 6)

  if (count === 4) return 4
  if (count === 8) return 8
  return 6
}

async function checkFinalRoundReady(round) {
  const [r1Res, r2Res, r3Res] = await Promise.all([
    db.from("final_round1_items").select("*").eq("model", Number(currentModel)),
    db.from("final_round2_items").select("*").eq("model", Number(currentModel)),
    db.from("final_round3_items").select("*").eq("model", Number(currentModel))
  ])

  if (r1Res.error || r2Res.error || r3Res.error) {
    console.log(r1Res.error || r2Res.error || r3Res.error)
    return readinessItem(`الجولة ${round}`, false, ["تعذر قراءة بيانات الجولة"])
  }

  const missing = []

  if (round === 1) {
    const r1CardsCount = await getAdminSegmentCount("finalRound1")

    const r1Map = {}

    ;(r1Res.data || []).forEach(row => {
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

    return readinessItem(
      "ٮدوں ٮڡاط",
      missing.length === 0,
      missing.length ? missing : [`مكتملة بعدد ${r1CardsCount} أرقام`]
    )
  }

  if (round === 2) {
  const r2Map = {}

  ;(r2Res.data || []).forEach(row => {
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

  ;(r3Res.data || []).forEach(row => {
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

  ;(r1Res.data || []).forEach(row => {
    const number = Number(row.number)

    if (number >= 201 && number <= 208) {
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

    const hasAnyPart =
      hasText(row.question_part1) ||
      hasText(row.question_part2) ||
      hasText(row.question_part3)

    if (!hasAnyPart) {
      missing.push(`قصة - رقم ${displayNumber}: أجزاء القصة فارغة`)
    }

    if (!hasText(row.answer)) {
      missing.push(`قصة - رقم ${displayNumber}: الإجابة فارغة`)
    }
  }

  return readinessItem(
    "قصة",
    missing.length === 0,
    missing.length ? missing : [`قصة مكتملة بعدد ${requiredCount} أرقام`]
  )
}

  if (round === 4) {
  const requiredCount = await getAdminSegmentCount("finalRound4")
  const focusMap = {}

  ;(r3Res.data || []).forEach(row => {
    const number = Number(row.number)
    const imageOrder = Number(row.image_order || 1)

    if (number >= 1 && number <= 8 && imageOrder === 1) {
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

  return readinessItem(
    "التركيز",
    missing.length === 0,
    missing.length ? missing : [`التركيز مكتملة بعدد ${requiredCount} أرقام`]
  )
}

  return readinessItem("الفاصلة", false, ["رقم الجولة غير صحيح"])
}

async function checkArchiveReady() {
  const rounds = await getSegmentRoundCount("archive", 4, 4)

  const [boxesRes, itemsRes] = await Promise.all([
    db.from("archive_boxes").select("*").eq("model", Number(currentModel)),
    db.from("archive_items").select("*").eq("model", Number(currentModel))
  ])

  if (boxesRes.error || itemsRes.error) {
    console.log(boxesRes.error || itemsRes.error)
    return readinessItem("الأرشيف", false, ["تعذر قراءة بيانات الأرشيف"])
  }

  const boxesMap = {}

  ;(boxesRes.data || []).forEach(box => {
    boxesMap[Number(box.round)] = box
  })

  const itemsByRound = {}

  ;(itemsRes.data || []).forEach(item => {
    const r = Number(item.round)
    if (!itemsByRound[r]) itemsByRound[r] = []
    itemsByRound[r].push(item)
  })

  const missing = []

  for (let r = 1; r <= rounds; r++) {
    const box = boxesMap[r]
    const items = itemsByRound[r] || []

    const map = {}
    items.forEach(item => {
      map[Number(item.position)] = item
    })

    if (!box) {
      missing.push(`الأرشيف - الجولة ${r}: بيانات الجولة غير موجودة`)
      continue
    }

    if (!hasText(box.tournament)) missing.push(`الأرشيف - الجولة ${r}: البطولة فارغة`)
    if (!hasText(box.season)) missing.push(`الأرشيف - الجولة ${r}: الموسم فارغ`)
    if (!hasText(box.score)) missing.push(`الأرشيف - الجولة ${r}: النتيجة فارغة`)

    if (!hasText(map[3]?.image)) missing.push(`الأرشيف - الجولة ${r}: الصورة 3 غير موجودة`)
    if (!hasText(map[4]?.image)) missing.push(`الأرشيف - الجولة ${r}: الصورة 4 غير موجودة`)

    const textItems = items.filter(item => Number(item.position) >= 5)

    if (!textItems.length) {
      missing.push(`الأرشيف - الجولة ${r}: لا توجد عناصر نصية`)
      continue
    }

    const hasRequired = textItems.some(item => {
      return String(item.label || "").trim() === "المطلوب"
    })

    if (!hasRequired) {
      missing.push(`الأرشيف - الجولة ${r}: لا يوجد عنصر بعنوان المطلوب`)
    }

    textItems.forEach(item => {
      if (!hasText(item.text)) {
        missing.push(`الأرشيف - الجولة ${r}: العنصر ${item.position} نصه فارغ`)
      }
    })
  }

  return readinessItem(
    "الأرشيف",
    missing.length === 0,
    missing.length ? missing : [`الأرشيف مكتمل بعدد ${rounds} جولات`]
  )
}

/* =========================
   15) Model Actions
========================= */

async function loadModels() {
  const { data, error } = await db
    .from("models")
    .select("*")
    .order("id", { ascending: false })

  if (error) {
    console.log("LOAD MODELS ERROR:", error)
    showGameToast("تعذر تحميل النماذج")
    return
  }

  const list = document.getElementById("modelsList")
  if (!list) return

  const currentValue = currentModel ? String(currentModel) : ""
  list.innerHTML = `<option value="">اختر النموذج</option>`

  ;(data || []).forEach(model => {
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

  const { data, error } = await db
    .from("models")
    .insert({
      name,
      admin_pin: adminPin
    })
    .select()
    .single()

  if (error) {
    console.log("CREATE MODEL ERROR:", error)
    showGameToast("تعذر إنشاء النموذج")
    return
  }

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

  const currentName =
    currentModelName ||
    list?.options?.[list.selectedIndex]?.textContent ||
    ""
    const modelData = await requestAdminModelAccess(id, currentName)
    if (!modelData) return

  document.getElementById("renameModelModal")?.remove()

  document.body.insertAdjacentHTML("beforeend", `
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
  `)

  const modal = document.getElementById("renameModelModal")
  const input = document.getElementById("renameModelInput")

  if (modal) {
    modal.addEventListener("click", e => {
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

  const { error } = await db
    .from("models")
    .update({ name })
    .eq("id", id)

  if (error) {
    console.log(error)
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

  const { data, error } = await db.storage
    .from(BUCKET_NAME)
    .list(path, {
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

  const { error } = await db.storage
    .from(BUCKET_NAME)
    .remove(files)

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

  const modelName =
    currentModelName ||
    list?.options?.[list.selectedIndex]?.textContent ||
    `نموذج ${id}`

    const modelData = await requestAdminModelAccess(id, modelName)
    if (!modelData) return

  const ok = confirm(
    `هل تريد حذف "${modelName}" نهائيًا؟\n\nسيتم حذف كل بيانات النموذج من جميع الفقرات.`
  )

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
      db.from("questions").delete().eq("model", id),
      db.from("top10_questions").delete().eq("model", id),
      db.from("auction_questions").delete().eq("model", id),
      db.from("who_images").delete().eq("model", id),

      db.from("explain_words").delete().eq("model", id),
      db.from("explain_settings").delete().eq("model", id),

      db.from("final_round_meta").delete().eq("model", id),
      db.from("final_round1_items").delete().eq("model", id),
      db.from("final_round2_items").delete().eq("model", id),
      db.from("final_round3_items").delete().eq("model", id),

      db.from("archive_boxes").delete().eq("model", id),
      db.from("archive_items").delete().eq("model", id),

      db.from("segment_settings").delete().eq("model", id)
    ]

    const results = await Promise.all(deleteJobs)
    const failed = results.find(result => result.error)

    if (failed) {
      console.log("DELETE MODEL RELATED DATA ERROR:", failed.error)
      showGameToast("تعذر حذف بعض بيانات النموذج")
      return
    }

    const { error: modelError } = await db
      .from("models")
      .delete()
      .eq("id", id)

    if (modelError) {
      console.log("DELETE MODEL ERROR:", modelError)
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

/* =========================
   16) Open Segment Router
========================= */

async function goAdminHome() {
  if (adminNavBusy) return

  adminNavBusy = true

  try {
    currentAdminSegment = "home"
    renderAdminHomeActions()
    await renderAdminHome()
  } finally {
    adminNavBusy = false
  }
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

  const visibility = await loadGlobalSegmentVisibilityMap()

if (!isAdminSegmentGloballyEnabled(segment, visibility)) {
  showGameToast("هذه الفقرة مخفية من إعدادات الفقرات")
  await goAdminHome()
  return
}

  currentAdminSegment = segment
  renderAdminSegmentActions()
  await renderAdminTabsUnified()

  if (segment === "warmup") await renderWarmupAdmin()
  if (segment === "top10") await renderTop10Admin()
  if (segment === "auction") await renderAuctionAdmin()
  if (segment === "who") await renderWhoAdmin()
  if (segment === "explain") await renderExplainAdmin()

  if (segment === "finalRound1") await renderFinalAdminRound(1)
  if (segment === "finalRound2") await renderFinalAdminRound(2)
  if (segment === "finalRound3") await renderFinalAdminRound(3)
  if (segment === "finalRound4") await renderFinalAdminRound(4)

  if (segment === "archive") await renderArchiveAdmin()


}

function addAdminBackButtonToEditor(segment) {
  return
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

  const fields = [
    row.question,
    row.answer
  ]

  const completed = fields.filter(isAdminFieldFilled).length
  return getAdminItemStatus(completed, fields.length)
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

  const { data, error } = await db
    .from("questions")
    .select("*")
    .eq("model", Number(currentModel))
    .eq("segment", "warmup")
    .order("category", { ascending: true })
    .order("number", { ascending: true })

  if (error) {
    console.log("LOAD WARMUP ERROR:", error)
    showGameToast("تعذر تحميل التسخين")
    return
  }

  warmupAdminDraft = {}

  for (let c = 1; c <= 4; c++) {
    getWarmupDraftCategory(c)
  }

  ;(data || []).forEach(row => {
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
        ${[1, 2, 3, 4].map(c => buildWarmupCategoryOnePageCard(c)).join("")}
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
          ${[1, 2, 4].map(n => buildWarmupQuestionOnePageCard(c, n)).join("")}
        </div>
      </div>
    </details>
  `
}

function handleAdminEditCardToggle(card) {
  const grid = card?.closest(".adminEditCardsGrid")
  if (!grid) return

  if (card.open) {
    grid.querySelectorAll(".adminEditItemCard").forEach(item => {
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

      const { error: clearError } = await db
        .from("questions")
        .delete()
        .eq("model", Number(currentModel))
        .eq("segment", "warmup")

      if (clearError) {
        console.log("CLEAR WARMUP ERROR:", clearError)
        showGameToast("تعذر حذف أسئلة التسخين")
        return false
      }

      warmupAdminDraft = {}
      warmupAdminActiveCategory = 1

      showGameToast("تم حذف جميع أسئلة التسخين")
      await renderWarmupAdmin()
      return true
    }

    const { data: oldRows, error: oldError } = await db
      .from("questions")
      .select("id, category, number")
      .eq("model", Number(currentModel))
      .eq("segment", "warmup")

    if (oldError) {
      console.log("READ OLD WARMUP ERROR:", oldError)
      showGameToast("تعذر قراءة بيانات التسخين الحالية")
      return false
    }

    const keepKeys = rows.map(row => `${row.category}_${row.number}`)

    const { error: saveError } = await db
      .from("questions")
      .upsert(rows, {
        onConflict: "model,segment,category,number"
      })

    if (saveError) {
      console.log("SAVE WARMUP ERROR:", saveError)
      showGameToast("فشل حفظ التسخين")
      return false
    }

    for (const oldRow of oldRows || []) {
      const key = `${Number(oldRow.category)}_${Number(oldRow.number)}`

      if (!keepKeys.includes(key)) {
        const { error: deleteError } = await db
          .from("questions")
          .delete()
          .eq("id", Number(oldRow.id))

        if (deleteError) {
          console.log("DELETE OLD WARMUP ERROR:", deleteError)
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
    const { data, error } = await db
      .from("questions")
      .delete()
      .eq("id", Number(id))
      .select()

    if (error) {
      console.log("DELETE WARMUP BY ID ERROR:", error)
      showGameToast("تعذر حذف السؤال")
      return
    }

    if (!data || !data.length) {
      showGameToast("لم يتم العثور على السؤال لحذفه")
      return
    }

    showGameToast("تم حذف السؤال")
    await renderWarmupAdmin()
    await renderAdminTabsUnified()
  } catch (err) {
    console.log("DELETE WARMUP BY ID CATCH:", err)
    showGameToast("حدث خطأ أثناء حذف السؤال")
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
    const { error } = await db
      .from("questions")
      .delete()
      .eq("model", Number(currentModel))
      .eq("segment", "warmup")

    if (error) {
      console.log("DELETE WARMUP SEGMENT ERROR:", error)
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

  const fields = [
    round.question,
    ...Array.from({ length: 10 }, (_, i) => round.answers[i + 1])
  ]

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

  const safeRound = Math.min(
    Math.max(Number(round || 1), 1),
    Number(top10AdminRoundsCount || 3)
  )

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
    cards.forEach(item => {
      if (item !== card) {
        item.classList.add("top10RoundHidden")
        item.open = false
      }
    })
  } else {
    cards.forEach(item => {
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

  const { data, error } = await db
    .from("top10_questions")
    .select("*")
    .eq("model", Number(currentModel))
    .order("round", { ascending: true })
    .order("position", { ascending: true })

  if (error) {
    console.log("LOAD TOP10 ERROR:", error)
    showGameToast("تعذر تحميل Top 10")
    return
  }

  top10AdminDraft = {}

  for (let r = 1; r <= 4; r++) {
    getTop10DraftRound(r)
  }

  ;(data || []).forEach(row => {
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
            ${[1, 2, 3, 4, 5].map(answerNumber => {
              return buildTop10AnswerOnePageCard(r, answerNumber)
            }).join("")}
          </div>

          <div class="top10CleanAnswersColumn">
            ${[6, 7, 8, 9, 10].map(answerNumber => {
              return buildTop10AnswerOnePageCard(r, answerNumber)
            }).join("")}
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

      const { error: clearError } = await db
        .from("top10_questions")
        .delete()
        .eq("model", Number(currentModel))

      if (clearError) {
        console.log("CLEAR TOP10 ERROR:", clearError)
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

    const { error: saveError } = await db
      .from("top10_questions")
      .upsert(rows, {
        onConflict: "model,round,position"
      })

    if (saveError) {
      console.log("SAVE TOP10 ERROR:", saveError)
      showGameToast("فشل حفظ Top 10")
      return false
    }

    const { data: oldRows, error: oldError } = await db
      .from("top10_questions")
      .select("round, position")
      .eq("model", Number(currentModel))

    if (oldError) {
      console.log("READ OLD TOP10 ERROR:", oldError)
      showGameToast("تم الحفظ لكن تعذر قراءة القديم للتنظيف")
      return false
    }

    for (const oldRow of oldRows || []) {
      const key = `${Number(oldRow.round)}_${Number(oldRow.position)}`

      if (!keepKeys.includes(key)) {
        const { error: deleteError } = await db
          .from("top10_questions")
          .delete()
          .eq("model", Number(currentModel))
          .eq("round", Number(oldRow.round))
          .eq("position", Number(oldRow.position))

        if (deleteError) {
          console.log("DELETE OLD TOP10 ERROR:", deleteError)
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
    const { error } = await db
      .from("top10_questions")
      .delete()
      .eq("model", Number(currentModel))
      .eq("round", Number(r))

    if (error) {
      console.log("CLEAR TOP10 ROUND ERROR:", error)
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

  const { error } = await db
    .from("top10_questions")
    .delete()
    .eq("model", Number(currentModel))
    .eq("round", Number(round))
    .eq("position", Number(position))

  if (error) {
    console.log("DELETE TOP10 ITEM ERROR:", error)
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
      db.from("top10_questions").delete().eq("model", Number(currentModel)),
      db.from("segment_settings").delete().eq("model", Number(currentModel)).eq("segment", "top10")
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
   20) Auction - فتبلة
========================= */

let auctionAdminActiveNumber = 1
let auctionAdminDraft = {}

function getAuctionDraftItem(number) {
  const n = Number(number || 1)

  if (!auctionAdminDraft[n]) {
    auctionAdminDraft[n] = {
      question: "",
      answer: "",
      image: "",
      video: "",
      file: null,
      videoFile: null
    }
  }

  return auctionAdminDraft[n]
}

function collectAuctionCurrentDraft() {
  const total = Number(auctionAdminCount || 8)

  for (let n = 1; n <= total; n++) {
    const item = getAuctionDraftItem(n)

    item.question = ""
    item.answer = (document.getElementById(`auctionAnswer${n}`)?.value || "").trim()

    const file = document.getElementById(`auctionFile${n}`)?.files?.[0] || null
    if (file) item.file = file

    const videoFile = document.getElementById(`auctionVideo${n}`)?.files?.[0] || null
    if (videoFile) item.videoFile = videoFile
  }
}

function isAuctionDraftComplete(number) {
  const item = getAuctionDraftItem(number)

  const answer = String(item.answer || "").trim()
  const image = String(item.image || "").trim()
  const video = String(item.video || "").trim()

  return !!(answer && (image || video || item.file || item.videoFile))
}

function getAuctionItemStatus(number) {
  const item = getAuctionDraftItem(number)

  const hasMedia =
    isAdminFieldFilled(item.image) ||
    isAdminFieldFilled(item.video) ||
    !!item.file ||
    !!item.videoFile

  const fields = [
    item.answer,
    hasMedia ? "media" : ""
  ]

  const completed = fields.filter(isAdminFieldFilled).length
  return getAdminItemStatus(completed, fields.length)
}

function switchAuctionAdminNumber(number) {
  collectAuctionCurrentDraft()

  const safeNumber = Math.min(
    Math.max(Number(number || 1), 1),
    Number(auctionAdminCount || 8)
  )

  auctionAdminActiveNumber = safeNumber
  renderAuctionAdminFromDraft()
}

async function renderAuctionAdmin() {
  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")
    return
  }

  const { data, error } = await db
    .from("auction_questions")
    .select("*")
    .eq("model", Number(currentModel))
    .order("number", { ascending: true })

  if (error) {
    console.log("LOAD AUCTION ERROR:", error)
    showGameToast("تعذر تحميل فتبلة")
    return
  }

  const { data: settingsData, error: settingsError } = await db
    .from("segment_settings")
    .select("item_count")
    .eq("model", Number(currentModel))
    .eq("segment", "auction")
    .maybeSingle()

  if (settingsError) {
    console.log("AUCTION SETTINGS ERROR:", settingsError)
  }

  auctionAdminCount = normalizeAdminSegmentCount("auction", settingsData?.item_count || 8)

  auctionAdminDraft = {}

  for (let i = 1; i <= 8; i++) {
    getAuctionDraftItem(i)
  }

  ;(data || []).forEach(row => {
    const n = Number(row.number || 1)
    const item = getAuctionDraftItem(n)

    item.question = row.question || ""
    item.answer = row.answer || ""
    item.image = row.image || ""
    item.video = row.video || ""
    item.file = null
    item.videoFile = null
  })

  if (auctionAdminActiveNumber > auctionAdminCount) {
    auctionAdminActiveNumber = auctionAdminCount
  }

  if (auctionAdminActiveNumber < 1) {
    auctionAdminActiveNumber = 1
  }

  await renderAuctionAdminFromDraft()
}

async function renderAuctionAdminFromDraft() {
  const total = Number(auctionAdminCount || 8)

  editor().innerHTML = `
    <div class="auctionAdminShell compactAuctionAdminShell adminOnePageEditor">

      <div class="adminEditorTopBar compactAdminEditorTopBar adminEditorTopBarWithActions">
        <div>
          <h2 class="adminSectionTitle">فتبلة</h2>
        </div>

        <div class="adminInlineActions">
          <button onclick="saveAuction()" class="adminSaveBtn">حفظ فتبلة</button>
          <button onclick="deleteAuctionSegment()" class="adminDeleteAllBtn">حذف الفقرة</button>
        </div>
      </div>

      <div class="adminEditCardsGrid auctionOnePageGrid">
        ${Array.from({ length: total }, (_, idx) => {
          const number = idx + 1
          return buildAuctionOnePageCard(number)
        }).join("")}
      </div>

    </div>
  `

  normalizeAdminEditorCards()
}

function buildAuctionOnePageCard(number) {
  const n = Number(number || 1)
  const item = getAuctionDraftItem(n)
  const status = getAuctionItemStatus(n)

  const hasMedia =
    isAdminFieldFilled(item.image) ||
    isAdminFieldFilled(item.video) ||
    !!item.file ||
    !!item.videoFile

  const missing = []

  if (!isAdminFieldFilled(item.answer)) missing.push("الإجابة")
  if (!hasMedia) missing.push("الصورة أو الفيديو")

  return `
    <details class="adminEditItemCard auctionQuestionOnePageCard ${status.className}" ontoggle="handleAdminEditCardToggle(this)">
      <summary>
        <div class="adminEditItemTitle">
          <strong>السؤال ${n}</strong>
          <span>
            ${
              status.isDone
                ? "بيانات السؤال مكتملة"
                : `ناقص: ${missing.join("، ")}`
            }
          </span>
        </div>

        <div class="adminEditItemMeta">
          <span class="adminEditStatusPill">${status.label}</span>
          <span class="adminEditProgressPill">${status.progress}</span>
        </div>
      </summary>

      <div class="adminEditItemBody">
        <div class="auctionOnePageLayout auctionOnePageLayoutAnswerOnly">

          <div class="auctionOnePageMedia">
            <div class="adminField ${hasMedia ? "" : "adminMissingField"}">
              <label>الصورة</label>
              <input type="file" id="auctionFile${n}" accept="image/*">
            </div>

            <div class="adminField ${hasMedia ? "" : "adminMissingField"}">
              <label>الفيديو</label>
              <input type="file" id="auctionVideo${n}" accept="video/*">
            </div>

            ${
              !hasMedia
                ? `<div class="adminMissingHint">الصورة أو الفيديو مطلوبة</div>`
                : ""
            }

            <div class="auctionPreviewBox auctionPreviewLarge">
              ${
                item.video
                  ? `<video src="${escapeHtml(item.video)}" class="previewImg" controls></video>`
                  : item.image
                    ? `<img src="${escapeHtml(item.image)}" class="previewImg">`
                    : `<div class="emptyImageHint">لا توجد صورة أو فيديو حالياً</div>`
              }
            </div>
          </div>

          <div class="auctionOnePageFields">
            <div class="adminField ${getAdminMissingFieldClass(item.answer)}">
              <label>الإجابة</label>
              <input
                id="auctionAnswer${n}"
                placeholder="الإجابة"
                value="${escapeHtml(item.answer || "")}"
              >

              ${
                !isAdminFieldFilled(item.answer)
                  ? `<div class="adminMissingHint">الإجابة ناقصة</div>`
                  : ""
              }
            </div>

            <button class="adminDeleteBtn" onclick="clearAuctionQuestion(${n})">
              حذف السؤال
            </button>
          </div>

        </div>
      </div>
    </details>
  `
}

async function applyAuctionCount() {
  if (isAdminSaving()) return false

  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")
    return false
  }

  try {
    collectAuctionCurrentDraft()
    setAdminSaving(true, "جارٍ حفظ العدد...")

    const count = Number(document.getElementById("auctionCountInput")?.value || 8)
    auctionAdminCount = Math.min(Math.max(count, 1), 8)

    const { error } = await db
      .from("segment_settings")
      .upsert(
        {
          model: Number(currentModel),
          segment: "auction",
          item_count: auctionAdminCount
        },
        {
          onConflict: "model,segment"
        }
      )

    if (error) {
      console.log("SAVE AUCTION COUNT ERROR:", error)
      showGameToast("تعذر حفظ عدد الأسئلة")
      return false
    }

    if (auctionAdminActiveNumber > auctionAdminCount) {
      auctionAdminActiveNumber = auctionAdminCount
    }

    showGameToast("تم حفظ عدد أسئلة فتبلة")
    await renderAuctionAdminFromDraft()
    await renderAdminTabsUnified()
    return true
  } catch (err) {
    console.log("APPLY AUCTION COUNT CATCH:", err)
    showGameToast("تعذر حفظ عدد أسئلة فتبلة")
    return false
  } finally {
    setAdminSaving(false)
  }
}

async function saveAuction() {
  if (isAdminSaving()) return false

  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")
    return false
  }

  try {
    collectAuctionCurrentDraft()

    setAdminSaving(true, "جارٍ حفظ فتبلة...")
    showGameToast("جارٍ حفظ فتبلة...")

    const finalCount = normalizeAdminSegmentCount("auction", auctionAdminCount || 8)
    auctionAdminCount = finalCount

    const { data: oldRows, error: oldError } = await db
      .from("auction_questions")
      .select("number, image, video")
      .eq("model", Number(currentModel))

    if (oldError) {
      console.log("READ OLD AUCTION ERROR:", oldError)
      showGameToast("تعذر قراءة بيانات فتبلة القديمة")
      return false
    }

    const oldMap = {}

    ;(oldRows || []).forEach(row => {
      oldMap[Number(row.number)] = row
    })

    const rows = []
    const keepNumbers = []

    for (let i = 1; i <= finalCount; i++) {
      const item = getAuctionDraftItem(i)

      const question = ""
      const answer = String(item.answer || "").trim()

      let image = oldMap[i]?.image || item.image || ""
      let video = oldMap[i]?.video || item.video || ""

      if (item.file) {
        image = await uploadImageFile(item.file, `auction_${i}`)
        item.file = null
        item.image = image
        video = ""
      }

      if (item.videoFile) {
        video = await uploadVideoFile(item.videoFile, `auction_video_${i}`)
        item.videoFile = null
        item.video = video
        image = ""
      }

      if (!answer && !image && !video) continue

      rows.push({
        model: Number(currentModel),
        number: Number(i),
        question,
        answer,
        image,
        video,
        note: ""
      })

      keepNumbers.push(Number(i))
    }

    const { error: settingsError } = await db
      .from("segment_settings")
      .upsert(
        {
          model: Number(currentModel),
          segment: "auction",
          item_count: finalCount
        },
        {
          onConflict: "model,segment"
        }
      )

    if (settingsError) {
      console.log("SAVE AUCTION SETTINGS ERROR:", settingsError)
      showGameToast("تعذر حفظ عدد أسئلة فتبلة")
      return false
    }

    if (rows.length) {
      const { error: saveError } = await db
        .from("auction_questions")
        .upsert(rows, {
          onConflict: "model,number"
        })

      if (saveError) {
        console.log("SAVE AUCTION ERROR:", saveError)
        showGameToast("فشل حفظ فتبلة")
        return false
      }
    }

    const { data: existingRows, error: existingError } = await db
      .from("auction_questions")
      .select("number")
      .eq("model", Number(currentModel))

    if (existingError) {
      console.log("READ EXISTING AUCTION ERROR:", existingError)
      showGameToast("تم الحفظ لكن تعذر قراءة القديم للتنظيف")
      return false
    }

    for (const oldRow of existingRows || []) {
      const oldNumber = Number(oldRow.number)

      if (!keepNumbers.includes(oldNumber)) {
        const { error: deleteError } = await db
          .from("auction_questions")
          .delete()
          .eq("model", Number(currentModel))
          .eq("number", oldNumber)

        if (deleteError) {
          console.log("DELETE OLD AUCTION ERROR:", deleteError)
          showGameToast("تم الحفظ لكن تعذر تنظيف بعض أسئلة فتبلة")
          return false
        }
      }
    }

    showGameToast(rows.length ? "تم حفظ فتبلة" : "تم حذف جميع أسئلة فتبلة")
    await renderAuctionAdmin()
    await renderAdminTabsUnified()
    return true
  } catch (err) {
    console.log("SAVE AUCTION CATCH:", err)
    showGameToast("توقف الحفظ بسبب خطأ في الرفع أو البيانات")
    return false
  } finally {
    setAdminSaving(false)
  }
}

async function clearAuctionQuestion(i) {
  if (!canRunAdminDelete()) return

  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")
    return
  }

  const ok = confirm(`هل تريد حذف سؤال فتبلة رقم ${i} نهائيًا؟`)
  if (!ok) return

  try {
    const { error } = await db
      .from("auction_questions")
      .delete()
      .eq("model", Number(currentModel))
      .eq("number", Number(i))

    if (error) {
      console.log("CLEAR AUCTION QUESTION ERROR:", error)
      showGameToast("تعذر حذف السؤال")
      return
    }

    showGameToast(`تم حذف السؤال ${i}`)
    await renderAuctionAdmin()
    await renderAdminTabsUnified()
  } catch (err) {
    console.log("CLEAR AUCTION QUESTION CATCH:", err)
    showGameToast("حدث خطأ أثناء حذف السؤال")
  }
}

async function deleteAuctionSegment() {
  if (!canRunAdminDelete()) return

  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")
    return
  }

  const ok = confirm("هل تريد حذف فقرة فتبلة كاملة نهائيًا؟")
  if (!ok) return

  try {
    const [rowsRes, settingsRes] = await Promise.all([
      db.from("auction_questions").delete().eq("model", Number(currentModel)),
      db.from("segment_settings").delete().eq("model", Number(currentModel)).eq("segment", "auction")
    ])

    if (rowsRes.error || settingsRes.error) {
      console.log(rowsRes.error || settingsRes.error)
      showGameToast("تعذر حذف فقرة فتبلة")
      return
    }

    auctionAdminCount = 8
    auctionAdminActiveNumber = 1
    auctionAdminDraft = {}

    showGameToast("تم حذف فقرة فتبلة")
    await renderAuctionAdmin()
    await renderAdminTabsUnified()
  } catch (err) {
    console.log("DELETE AUCTION SEGMENT CATCH:", err)
    showGameToast("حدث خطأ أثناء حذف الفقرة")
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

  const hasImage =
    isAdminFieldFilled(item.image) ||
    !!item.file

  const fields = [
    item.answer,
    hasImage ? "image" : ""
  ]

  const completed = fields.filter(isAdminFieldFilled).length
  return getAdminItemStatus(completed, fields.length)
}

function switchWhoAdminNumber(number) {
  collectWhoCurrentDraft()

  const safeNumber = Math.min(
    Math.max(Number(number || 1), 1),
    Number(whoAdminCount || 15)
  )

  whoAdminActiveNumber = safeNumber
  renderWhoAdminFromDraft()
}

async function renderWhoAdmin() {
  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")
    return
  }

  whoAdminCount = await getAdminSegmentCount("who")

  const { data, error } = await db
    .from("who_images")
    .select("*")
    .eq("model", Number(currentModel))
    .order("number", { ascending: true })

  if (error) {
    console.log("LOAD WHO ERROR:", error)
    showGameToast("تعذر تحميل من هو")
    return
  }

  whoAdminDraft = {}

  for (let i = 1; i <= 15; i++) {
    getWhoDraftItem(i)
  }

  ;(data || []).forEach(row => {
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

  const hasImage =
    isAdminFieldFilled(item.image) ||
    !!item.file

  const missing = []

  if (!isAdminFieldFilled(item.answer)) missing.push("الإجابة")
  if (!hasImage) missing.push("الصورة")

  return `
    <details class="adminEditItemCard whoItemOnePageCard ${status.className}" ontoggle="handleAdminEditCardToggle(this)">
      <summary>
        <div class="adminEditItemTitle">
          <strong>${n}</strong>
          <span>
            ${
              status.isDone
                ? "بيانات الصورة مكتملة"
                : `ناقص: ${missing.join("، ")}`
            }
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

            ${
              !hasImage
                ? `<div class="adminMissingHint">الصورة مطلوبة</div>`
                : ""
            }

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

              ${
                !isAdminFieldFilled(item.answer)
                  ? `<div class="adminMissingHint">الإجابة ناقصة</div>`
                  : ""
              }
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

    const { data: oldRows, error: oldReadError } = await db
      .from("who_images")
      .select("number, image")
      .eq("model", Number(currentModel))

    if (oldReadError) {
      console.log("READ OLD WHO ERROR:", oldReadError)
      showGameToast("تعذر قراءة بيانات من هو القديمة")
      return false
    }

    const oldMap = {}

    ;(oldRows || []).forEach(row => {
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

    const { data: existingRows, error: existingError } = await db
      .from("who_images")
      .select("number")
      .eq("model", Number(currentModel))

    if (existingError) {
      console.log("READ EXISTING WHO ERROR:", existingError)
      showGameToast("تعذر قراءة عناصر من هو الحالية")
      return false
    }

    for (const oldRow of existingRows || []) {
      const oldNumber = Number(oldRow.number)

      if (!keepNumbers.includes(oldNumber)) {
        const { error: deleteError } = await db
          .from("who_images")
          .delete()
          .eq("model", Number(currentModel))
          .eq("number", oldNumber)

        if (deleteError) {
          console.log("DELETE OLD WHO ERROR:", deleteError)
          showGameToast("تعذر تنظيف عناصر من هو القديمة")
          return false
        }
      }
    }

    if (rows.length) {
      const { error: saveError } = await db
        .from("who_images")
        .upsert(rows, {
          onConflict: "model,number"
        })

      if (saveError) {
        console.log("SAVE WHO ERROR:", saveError)
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
    const { error } = await db
      .from("who_images")
      .delete()
      .eq("model", Number(currentModel))
      .eq("number", Number(i))

    if (error) {
      console.log("CLEAR WHO ITEM ERROR:", error)
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
      db.from("who_images").delete().eq("model", Number(currentModel)),
      db.from("segment_settings").delete().eq("model", Number(currentModel)).eq("segment", "who")
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
  explainAdminCount = normalizeAdminSegmentCount(
    "explain",
    Number(explainAdminCount || 4)
  )

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

  const fields = [
    item.word
  ]

  const completed = fields.filter(isAdminFieldFilled).length
  return getAdminItemStatus(completed, fields.length)
}

async function renderExplainAdmin() {
  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")
    return
  }

  explainAdminCount = await getAdminSegmentCount("explain")

  const { data, error } = await db
    .from("explain_words")
    .select("*")
    .eq("model", Number(currentModel))
    .order("number", { ascending: true })

  if (error) {
    console.log("LOAD EXPLAIN ERROR:", error)
    showGameToast("تعذر تحميل اشرح الكلمة")
    return
  }

  explainAdminDraft = {}

  for (let i = 1; i <= 8; i++) {
    getExplainDraftItem(i)
  }

  ;(data || []).forEach(row => {
    const n = Number(row.number || 1)
    const item = getExplainDraftItem(n)

    item.id = row.id || null
    item.word = row.word || ""
  })

  renderExplainAdminFromDraft()
}

async function renderExplainAdminFromDraft() {
  const total = Number(explainAdminCount || 4)

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
            ${
              status.isDone
                ? "الكلمة مكتملة"
                : `ناقص: ${missing.join("، ")}`
            }
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

            ${
              !isAdminFieldFilled(item.word)
                ? `<div class="adminMissingHint">الكلمة ناقصة</div>`
                : ""
            }
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

  const count = Number(document.getElementById("explainWordsCountInput")?.value || 4)
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

    const count = Number(document.getElementById("explainWordsCountInput")?.value || 4)
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

    explainAdminCount = normalizeAdminSegmentCount(
  "explain",
  Number(explainAdminCount || 4)
)

    const rows = []
    const keepNumbers = []

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

    const { data: oldRows, error: oldError } = await db
      .from("explain_words")
      .select("number")
      .eq("model", Number(currentModel))

    if (oldError) {
      console.log("READ OLD EXPLAIN ERROR:", oldError)
      showGameToast("تعذر قراءة كلمات اشرح القديمة")
      return false
    }

    for (const oldRow of oldRows || []) {
      const oldNumber = Number(oldRow.number)

      if (!keepNumbers.includes(oldNumber)) {
        const { error: deleteError } = await db
          .from("explain_words")
          .delete()
          .eq("model", Number(currentModel))
          .eq("number", oldNumber)

        if (deleteError) {
          console.log("DELETE OLD EXPLAIN ERROR:", deleteError)
          showGameToast("تعذر تنظيف بعض كلمات اشرح")
          return false
        }
      }
    }

    if (rows.length) {
      const { error: saveError } = await db
        .from("explain_words")
        .upsert(rows, {
          onConflict: "model,number"
        })

      if (saveError) {
        console.log("SAVE EXPLAIN ERROR:", saveError)
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
      db.from("explain_words").delete().eq("model", Number(currentModel)),
      db.from("segment_settings").delete().eq("model", Number(currentModel)).eq("segment", "explain")
    ])

    if (wordsRes.error || settingsRes.error) {
      console.log(wordsRes.error || settingsRes.error)
      showGameToast("تعذر حذف فقرة اشرح الكلمة")
      return
    }

    explainAdminCount = 4
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
    db.from("final_round1_items").select("*").eq("model", Number(currentModel)),
    db.from("final_round2_items").select("*").eq("model", Number(currentModel)),
    db.from("final_round3_items").select("*").eq("model", Number(currentModel))
  ])

  if (r1Res.error || r2Res.error || r3Res.error) {
    console.log(r1Res.error || r2Res.error || r3Res.error)
    return doneMap
  }

  /* Round 1 - ٮدوں ٮڡاط */
  const r1Count = await getAdminSegmentCount("finalRound1")
  const r1Map = {}

  ;(r1Res.data || []).forEach(row => {
    const number = Number(row.number)

    if (number >= 1 && number <= 8) {
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

;(r2Res.data || []).forEach(row => {
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

;(r3Res.data || []).forEach(row => {
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

  ;(r1Res.data || []).forEach(row => {
    const number = Number(row.number)

    if (number >= 201 && number <= 208) {
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

    const hasAnyPart =
      hasText(row.question_part1) ||
      hasText(row.question_part2) ||
      hasText(row.question_part3)

    if (!hasAnyPart || !hasText(row.answer)) {
      round3Done = false
      break
    }
  }

  doneMap[3] = round3Done

  /* Round 4 - التركيز */
  const focusCount = await getAdminSegmentCount("finalRound4")
  const focusMap = {}

  ;(r3Res.data || []).forEach(row => {
    const number = Number(row.number)
    const imageOrder = Number(row.image_order || 1)

    if (number >= 1 && number <= 8 && imageOrder === 1) {
      focusMap[number] = row
    }
  })

  let round4Done = true

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
  const fields = [
    row.card_text,
    row.answer
  ]

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
  const count = Number(document.getElementById("finalRound1CardsCount")?.value || 6)
  finalRound1AdminCount = normalizeAdminSegmentCount("finalRound1", count)

  await saveAdminSegmentCount("finalRound1", finalRound1AdminCount)
  updateAdminQuickSettingUI("finalRound1", finalRound1AdminCount)

  await renderFinalAdminRound(1)
  await renderAdminTabsUnified()
}

async function changeFinalRound3Count() {
  const count = Number(document.getElementById("finalRound3Count")?.value || 4)
  finalRound3AdminCount = normalizeAdminSegmentCount("finalRound3", count)

  await saveAdminSegmentCount("finalRound3", finalRound3AdminCount)
  updateAdminQuickSettingUI("finalRound3", finalRound3AdminCount)

  await renderFinalAdminRound(3)
  await renderAdminTabsUnified()
}

async function changeFinalRound4Count() {
  const count = Number(document.getElementById("finalRound4Count")?.value || 4)
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

    await db
      .from("final_round_meta")
      .upsert(
        [{
          model: Number(currentModel),
          round: Number(safeRound),
          title,
          cards_count: null,
          round3_mode: safeRound === 4 ? "team_media" : null
        }],
        {
          onConflict: "model,round"
        }
      )

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
  const { data, error } = await db
    .from("final_round1_items")
    .select("*")
    .eq("model", Number(currentModel))
    .gte("number", 1)
    .lte("number", 8)
    .order("number", { ascending: true })

  if (error) {
    console.log("LOAD FINAL ROUND 1 ERROR:", error)
    return `<div class="adminCard">تعذر تحميل ٮدوں ٮڡاط</div>`
  }

  const map = {}

  ;(data || []).forEach(row => {
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
            ${
              status.isDone
                ? "بيانات الرقم مكتملة"
                : `ناقص: ${missing.join("، ")}`
            }
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

            ${
              !isAdminFieldFilled(row.card_text)
                ? `<div class="adminMissingHint">السؤال ناقص</div>`
                : ""
            }
          </div>

          <div class="adminField ${getAdminMissingFieldClass(row.answer)}">
            <label>الإجابة</label>
            <textarea
  id="finalRound1Answer_${n}"
  placeholder="الإجابة"
>${escapeHtml(row.answer || "")}</textarea>

            ${
              !isAdminFieldFilled(row.answer)
                ? `<div class="adminMissingHint">الإجابة ناقصة</div>`
                : ""
            }
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
  Number(finalRound1AdminCount || await getAdminSegmentCount("finalRound1"))
)

finalRound1AdminCount = safeCardsCount

    const rows = []

    for (let i = 1; i <= safeCardsCount; i++) {
      const answer =
        (document.getElementById(`finalRound1Answer_${i}`)?.value || "").trim()

      const cardText =
        (document.getElementById(`finalRound1CardText_${i}`)?.value || "").trim()

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

    const keepNumbers = rows.map(row => Number(row.number))

    const { data: existingRows, error: existingError } = await db
      .from("final_round1_items")
      .select("number")
      .eq("model", Number(currentModel))
      .gte("number", 1)
      .lte("number", 8)

    if (existingError) {
      console.log("READ FINAL ROUND 1 EXISTING ERROR:", existingError)
      showGameToast("تعذر قراءة عناصر ٮدوں ٮڡاط الحالية")
      return false
    }

    for (const oldRow of existingRows || []) {
      const oldNumber = Number(oldRow.number)

      if (!keepNumbers.includes(oldNumber)) {
        const { error: deleteError } = await db
          .from("final_round1_items")
          .delete()
          .eq("model", Number(currentModel))
          .eq("number", oldNumber)

        if (deleteError) {
          console.log("DELETE FINAL ROUND 1 OLD ERROR:", deleteError)
          showGameToast("تعذر تنظيف عناصر ٮدوں ٮڡاط")
          return false
        }
      }
    }

    if (rows.length) {
      const { error: saveError } = await db
        .from("final_round1_items")
        .upsert(rows, {
          onConflict: "model,number"
        })

      if (saveError) {
        console.log("SAVE FINAL ROUND 1 ERROR:", saveError)
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
    const row = rows.find(x => Number(x.item_order) === i) || {}

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
    const row = rows.find(x => Number(x.image_order) === i) || {}

    fields.push(row.image)
    fields.push(row.answer)
  }

  const completed = fields.filter(isAdminFieldFilled).length
  return getAdminItemStatus(completed, fields.length)
}

async function buildFinalRound2Admin() {
  const [textRes, imageRes] = await Promise.all([
    db
      .from("final_round2_items")
      .select("*")
      .eq("model", Number(currentModel))
      .order("number", { ascending: true })
      .order("item_order", { ascending: true }),

    db
      .from("final_round3_items")
      .select("*")
      .eq("model", Number(currentModel))
      .order("number", { ascending: true })
      .order("image_order", { ascending: true })
  ])

  if (textRes.error) {
    console.log("LOAD FINAL ROUND 2 ERROR:", textRes.error)
    return `<div class="adminCard">تعذر تحميل صح صحلي</div>`
  }

  if (imageRes.error) {
    console.log("LOAD FINAL ROUND 2 IMAGES ERROR:", imageRes.error)
    return `<div class="adminCard">تعذر تحميل صور صح صحلي</div>`
  }

  const grouped = { 1: [], 2: [], 4: [], 5: [] }

  ;(textRes.data || []).forEach(row => {
    const n = Number(row.number || 1)
    if (!grouped[n]) grouped[n] = []
    grouped[n].push(row)
  })

  const imageGrouped = { 3: [], 6: [] }

  ;(imageRes.data || []).forEach(row => {
    const dbNumber = Number(row.number)
    if (dbNumber === 101) imageGrouped[3].push(row)
    if (dbNumber === 102) imageGrouped[6].push(row)
  })

  return `
    <div class="adminEditCardsGrid finalRound2OnePageGrid">
      ${[1, 2, 3, 4, 5, 6].map(number => {
        if (isFinalRound2ImageNumber(number)) {
          return buildFinalRound2ImageOnePageCard(number, imageGrouped[number] || [])
        }

        return buildFinalRound2TextOnePageCard(number, grouped[number] || [])
      }).join("")}
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
    const row = rows.find(x => Number(x.item_order) === i) || {}

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
            ${
              status.isDone
                ? "بيانات الرقم مكتملة"
                : `ناقص: ${missing.slice(0, 4).join("، ")}${missing.length > 4 ? "..." : ""}`
            }
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
        ${
          isScramble
            ? buildFinalRound2ScrambleBody(n, rows)
            : buildFinalRound2SequenceBody(n, rows)
        }
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
        const row = rows.find(x => Number(x.item_order) === i) || {}

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
        const row = rows.find(x => Number(x.item_order) === i) || {}

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
    const row = rows.find(x => Number(x.image_order) === i) || {}

    if (!isAdminFieldFilled(row.image)) missing.push(`${i}: الصورة`)
    if (!isAdminFieldFilled(row.answer)) missing.push(`${i}: الإجابة`)
  }

  return `
    <details class="adminEditItemCard finalRound2OnePageCard ${status.className}" ontoggle="handleAdminEditCardToggle(this)">
      <summary>
        <div class="adminEditItemTitle">
          <strong>رقم ${n} - اشرح الصورة</strong>
          <span>
            ${
              status.isDone
                ? "بيانات الرقم مكتملة"
                : `ناقص: ${missing.slice(0, 4).join("، ")}${missing.length > 4 ? "..." : ""}`
            }
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
            const row = rows.find(x => Number(x.image_order) === i) || {}

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
                    row.image
                      ? `<img src="${escapeHtml(row.image)}" class="previewImg">`
                      : `<div class="emptyImageHint">لا توجد صورة</div>`
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
        const prompt =
          (document.getElementById(`finalRound2Prompt_${number}_${i}`)?.value || "").trim()

        const hint = gameType === "scramble"
          ? (document.getElementById(`finalRound2Hint_${number}_${i}`)?.value || "").trim()
          : ""

        const answer = gameType === "scramble"
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

    const keepKeys = rows.map(row => `${Number(row.number)}_${Number(row.item_order)}`)

    const { data: existingRows, error: existingError } = await db
      .from("final_round2_items")
      .select("number,item_order")
      .eq("model", Number(currentModel))

    if (existingError) {
      console.log("READ FINAL ROUND 2 EXISTING ERROR:", existingError)
      showGameToast("تعذر قراءة صح صحلي الحالية")
      return false
    }

    for (const oldRow of existingRows || []) {
      const key = `${Number(oldRow.number)}_${Number(oldRow.item_order)}`

      if (!keepKeys.includes(key)) {
        const { error: deleteError } = await db
          .from("final_round2_items")
          .delete()
          .eq("model", Number(currentModel))
          .eq("number", Number(oldRow.number))
          .eq("item_order", Number(oldRow.item_order))

        if (deleteError) {
          console.log("DELETE FINAL ROUND 2 OLD ERROR:", deleteError)
          showGameToast("تعذر تنظيف عناصر صح صحلي")
          return false
        }
      }
    }

    if (rows.length) {
      const { error: saveError } = await db
        .from("final_round2_items")
        .upsert(rows, {
          onConflict: "model,number,item_order"
        })

      if (saveError) {
        console.log("SAVE FINAL ROUND 2 ERROR:", saveError)
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
  const fields = [
    row.question_part1,
    row.question_part2,
    row.question_part3,
    row.answer
  ]

  const completed = fields.filter(isAdminFieldFilled).length
  return getAdminItemStatus(completed, fields.length)
}

async function buildFinalRound3StoryAdmin() {
  const count = await getAdminSegmentCount("finalRound3")

  const { data, error } = await db
    .from("final_round1_items")
    .select("*")
    .eq("model", Number(currentModel))
    .gte("number", 201)
    .lte("number", 208)
    .order("number", { ascending: true })

  if (error) {
    console.log("LOAD FINAL STORY ERROR:", error)
    return `<div class="adminCard">تعذر تحميل قصة</div>`
  }

  const map = {}

  ;(data || []).forEach(row => {
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
            ${
              status.isDone
                ? "بيانات القصة مكتملة"
                : `ناقص: ${missing.join("، ")}`
            }
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

            ${
              !isAdminFieldFilled(row.question_part1)
                ? `<div class="adminMissingHint">جزء القصة 1 ناقص</div>`
                : ""
            }
          </div>

          <div class="adminField ${getAdminMissingFieldClass(row.question_part2)}">
            <label>جزء القصة 2</label>
            <textarea
              id="finalRound3StoryPart2_${n}"
              placeholder="الجزء الثاني"
            >${escapeHtml(row.question_part2 || "")}</textarea>

            ${
              !isAdminFieldFilled(row.question_part2)
                ? `<div class="adminMissingHint">جزء القصة 2 ناقص</div>`
                : ""
            }
          </div>

          <div class="adminField ${getAdminMissingFieldClass(row.question_part3)}">
            <label>جزء القصة 3</label>
            <textarea
              id="finalRound3StoryPart3_${n}"
              placeholder="الجزء الثالث"
            >${escapeHtml(row.question_part3 || "")}</textarea>

            ${
              !isAdminFieldFilled(row.question_part3)
                ? `<div class="adminMissingHint">جزء القصة 3 ناقص</div>`
                : ""
            }
          </div>

          <div class="adminField finalStoryAnswerBox ${getAdminMissingFieldClass(row.answer)}">
            <label>الإجابة</label>
            <textarea
              id="finalRound3StoryAnswer_${n}"
              placeholder="الإجابة"
            >${escapeHtml(row.answer || "")}</textarea>

            ${
              !isAdminFieldFilled(row.answer)
                ? `<div class="adminMissingHint">الإجابة ناقصة</div>`
                : ""
            }
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
  Number(finalRound3AdminCount || await getAdminSegmentCount("finalRound3"))
)

finalRound3AdminCount = safeCount

    const rows = []

    for (let i = 1; i <= safeCount; i++) {
      const dbNumber = getFinalStoryDbNumber(i)

      const part1 =
        (document.getElementById(`finalRound3StoryPart1_${i}`)?.value || "").trim()

      const part2 =
        (document.getElementById(`finalRound3StoryPart2_${i}`)?.value || "").trim()

      const part3 =
        (document.getElementById(`finalRound3StoryPart3_${i}`)?.value || "").trim()

      const answer =
        (document.getElementById(`finalRound3StoryAnswer_${i}`)?.value || "").trim()

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

    const keepNumbers = rows.map(row => Number(row.number))

    const { data: existingRows, error: existingError } = await db
      .from("final_round1_items")
      .select("number")
      .eq("model", Number(currentModel))
      .gte("number", 201)
      .lte("number", 208)

    if (existingError) {
      console.log("READ FINAL STORY EXISTING ERROR:", existingError)
      showGameToast("تعذر قراءة عناصر قصة الحالية")
      return false
    }

    for (const oldRow of existingRows || []) {
      const oldNumber = Number(oldRow.number)

      if (!keepNumbers.includes(oldNumber)) {
        const { error: deleteError } = await db
          .from("final_round1_items")
          .delete()
          .eq("model", Number(currentModel))
          .eq("number", oldNumber)

        if (deleteError) {
          console.log("DELETE FINAL STORY OLD ERROR:", deleteError)
          showGameToast("تعذر تنظيف عناصر قصة")
          return false
        }
      }
    }

    if (rows.length) {
      const { error: saveError } = await db
        .from("final_round1_items")
        .upsert(rows, {
          onConflict: "model,number"
        })

      if (saveError) {
        console.log("SAVE FINAL STORY ERROR:", saveError)
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

  const { error } = await db
    .from("final_round1_items")
    .delete()
    .eq("model", Number(currentModel))
    .eq("number", Number(dbNumber))

  if (error) {
    console.log("CLEAR FINAL STORY ITEM ERROR:", error)
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
  const hasMedia =
    isAdminFieldFilled(row.image) ||
    isAdminFieldFilled(row.video)

  const fields = [
    hasMedia ? "media" : "",
    row.question,
    row.answer
  ]

  const completed = fields.filter(isAdminFieldFilled).length
  return getAdminItemStatus(completed, fields.length)
}

async function buildFinalRound3FocusAdmin() {
  const count = await getAdminSegmentCount("finalRound4")

  const { data, error } = await db
    .from("final_round3_items")
    .select("*")
    .eq("model", Number(currentModel))
    .order("number", { ascending: true })

  if (error) {
    console.log("LOAD FINAL ROUND 3 ERROR:", error)
    return `<div class="adminCard">تعذر تحميل التركيز</div>`
  }

  const map = {}

  ;(data || []).forEach(row => {
    const number = Number(row.number)
    const imageOrder = Number(row.image_order || 1)

    if (number >= 1 && number <= 8 && imageOrder === 1) {
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

  const hasMedia =
    isAdminFieldFilled(row.image) ||
    isAdminFieldFilled(row.video)

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
            ${
              status.isDone
                ? "بيانات الرقم مكتملة"
                : `ناقص: ${missing.join("، ")}`
            }
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

            ${
              !hasMedia
                ? `<div class="adminMissingHint">الصورة أو الفيديو مطلوب</div>`
                : ""
            }

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

              ${
                !isAdminFieldFilled(row.question)
                  ? `<div class="adminMissingHint">السؤال ناقص</div>`
                  : ""
              }
            </div>

            <div class="adminField ${getAdminMissingFieldClass(row.answer)}">
              <label>الإجابة</label>
              <textarea
                id="finalRound3TeamAnswer_${n}"
                placeholder="الإجابة"
              >${escapeHtml(row.answer || "")}</textarea>

              ${
                !isAdminFieldFilled(row.answer)
                  ? `<div class="adminMissingHint">الإجابة ناقصة</div>`
                  : ""
              }
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
  Number(finalRound4AdminCount || await getAdminSegmentCount("finalRound4"))
)

finalRound4AdminCount = safeCount

    const { data: oldRows, error: oldError } = await db
      .from("final_round3_items")
      .select("*")
      .eq("model", Number(currentModel))

    if (oldError) {
      console.log("READ OLD FINAL ROUND 3 ERROR:", oldError)
      showGameToast("تعذر قراءة بيانات التركيز القديمة")
      return false
    }

    const oldMap = {}

    ;(oldRows || []).forEach(row => {
      const number = Number(row.number)
      const imageOrder = Number(row.image_order || 1)

      if (number >= 1 && number <= 8 && imageOrder === 1) {
        oldMap[number] = row
      }
    })

    const rows = []

    for (let number = 1; number <= safeCount; number++) {
      const imageFile =
        document.getElementById(`finalRound3TeamImage_${number}`)?.files?.[0] || null

      const videoFile =
        document.getElementById(`finalRound3TeamVideo_${number}`)?.files?.[0] || null

      const question =
        (document.getElementById(`finalRound3TeamQuestion_${number}`)?.value || "").trim()

      const answer =
        (document.getElementById(`finalRound3TeamAnswer_${number}`)?.value || "").trim()

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

    const keepNumbers = rows.map(row => Number(row.number))

    const { data: existingRows, error: existingError } = await db
      .from("final_round3_items")
      .select("number")
      .eq("model", Number(currentModel))

    if (existingError) {
      console.log("READ EXISTING FINAL ROUND 3 ERROR:", existingError)
      showGameToast("تعذر قراءة عناصر التركيز الحالية")
      return false
    }

    for (const oldRow of existingRows || []) {
      const oldNumber = Number(oldRow.number)

      if (oldNumber >= 1 && oldNumber <= 8 && !keepNumbers.includes(oldNumber)) {
        const { error: deleteError } = await db
          .from("final_round3_items")
          .delete()
          .eq("model", Number(currentModel))
          .eq("number", oldNumber)

        if (deleteError) {
          console.log("DELETE OLD FINAL ROUND 3 ERROR:", deleteError)
          showGameToast("تعذر تنظيف التركيز")
          return false
        }
      }
    }

    if (rows.length) {
      const { error: saveError } = await db
        .from("final_round3_items")
        .upsert(rows, {
          onConflict: "model,number,image_order"
        })

      if (saveError) {
        console.log("SAVE FINAL ROUND 3 ERROR:", saveError)
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
  const { data, error } = await db
    .from("final_round3_items")
    .select("*")
    .eq("model", Number(currentModel))
    .order("number", { ascending: true })
    .order("image_order", { ascending: true })

  if (error) {
    console.log("LOAD FINAL ROUND 2 IMAGE NUMBERS ERROR:", error)
    return `<div class="adminCard">تعذر تحميل صور صح صحلي</div>`
  }

  const grouped = {
    101: [],
    102: []
  }

  ;(data || []).forEach(row => {
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
      const row = rows.find(x => Number(x.image_order) === i) || {}

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
            ${
              row.image
                ? `<img src="${escapeHtml(row.image)}" class="previewImg">`
                : `<div class="emptyImageHint">لا توجد صورة</div>`
            }
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

    const { data: oldRows, error: oldError } = await db
      .from("final_round3_items")
      .select("*")
      .eq("model", Number(currentModel))

    if (oldError) {
      console.log("READ OLD FINAL ROUND 2 IMAGES ERROR:", oldError)
      showGameToast("تعذر قراءة الصور القديمة")
      return false
    }

    const oldMap = {}

    ;(oldRows || []).forEach(row => {
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
        const file =
          document.getElementById(`finalRound4File_${displayNumber}_${i}`)?.files?.[0] || null

        const answer =
          (document.getElementById(`finalRound4Answer_${displayNumber}_${i}`)?.value || "").trim()

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

    const keepKeys = rows.map(row => `${Number(row.number)}_${Number(row.image_order)}`)

    const { data: existingRows, error: existingError } = await db
      .from("final_round3_items")
      .select("number,image_order")
      .eq("model", Number(currentModel))

    if (existingError) {
      console.log("READ EXISTING FINAL ROUND 2 IMAGES ERROR:", existingError)
      showGameToast("تعذر قراءة صور صح صحلي الحالية")
      return false
    }

    for (const oldRow of existingRows || []) {
      const oldNumber = Number(oldRow.number)
      const key = `${oldNumber}_${Number(oldRow.image_order)}`

      if ((oldNumber === 101 || oldNumber === 102) && !keepKeys.includes(key)) {
        const { error: deleteError } = await db
          .from("final_round3_items")
          .delete()
          .eq("model", Number(currentModel))
          .eq("number", oldNumber)
          .eq("image_order", Number(oldRow.image_order))

        if (deleteError) {
          console.log("DELETE OLD FINAL ROUND 2 IMAGES ERROR:", deleteError)
          showGameToast("تعذر تنظيف صور صح صحلي")
          return false
        }
      }
    }

    if (rows.length) {
      const { error: saveError } = await db
        .from("final_round3_items")
        .upsert(rows, {
          onConflict: "model,number,image_order"
        })

      if (saveError) {
        console.log("SAVE FINAL ROUND 2 IMAGES ERROR:", saveError)
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
    await db
      .from("final_round_meta")
      .delete()
      .eq("model", Number(currentModel))
      .eq("round", safeRound)

    if (safeRound === 1) {
      await db
        .from("final_round1_items")
        .delete()
        .eq("model", Number(currentModel))
        .gte("number", 1)
        .lte("number", 8)

      await db
        .from("segment_settings")
        .delete()
        .eq("model", Number(currentModel))
        .eq("segment", "finalRound1")

      finalRound1AdminCount = 6
    }

    if (safeRound === 2) {
      await db
        .from("final_round2_items")
        .delete()
        .eq("model", Number(currentModel))

      for (const dbNumber of [101, 102]) {
        await db
          .from("final_round3_items")
          .delete()
          .eq("model", Number(currentModel))
          .eq("number", dbNumber)
      }
    }

    if (safeRound === 3) {
      await db
        .from("final_round1_items")
        .delete()
        .eq("model", Number(currentModel))
        .gte("number", 201)
        .lte("number", 208)

      await db
        .from("segment_settings")
        .delete()
        .eq("model", Number(currentModel))
        .eq("segment", "finalRound3")

      finalRound3AdminCount = 4
    }

    if (safeRound === 4) {
      await db
        .from("final_round3_items")
        .delete()
        .eq("model", Number(currentModel))
        .gte("number", 1)
        .lte("number", 8)

      await db
        .from("segment_settings")
        .delete()
        .eq("model", Number(currentModel))
        .eq("segment", "finalRound4")

      finalRound4AdminCount = 4
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

  const { error } = await db
    .from("final_round1_items")
    .delete()
    .eq("model", Number(currentModel))
    .eq("number", Number(number))

  if (error) {
    console.log("CLEAR FINAL ROUND 1 ITEM ERROR:", error)
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

  const { error } = await db
    .from("final_round2_items")
    .delete()
    .eq("model", Number(currentModel))
    .eq("number", Number(number))

  if (error) {
    console.log("CLEAR FINAL ROUND 2 ITEM ERROR:", error)
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

  const { error } = await db
    .from("final_round3_items")
    .delete()
    .eq("model", Number(currentModel))
    .eq("number", Number(number))

  if (error) {
    console.log("CLEAR FINAL ROUND 3 ITEM ERROR:", error)
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

  const { error } = await db
    .from("final_round3_items")
    .delete()
    .eq("model", Number(currentModel))
    .eq("number", Number(dbNumber))

  if (error) {
    console.log("CLEAR FINAL ROUND 4 ITEM ERROR:", error)
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

  items.forEach(item => {
    map[Number(item.position)] = item
  })

  if (!map[3]?.image) return false
  if (!map[4]?.image) return false

  const textItems = items.filter(item => Number(item.position) >= ARCHIVE_TEXT_START_POSITION)

  if (!textItems.length) return false

  const hasRequired = textItems.some(item => {
    return String(item.label || "").trim() === "المطلوب"
  })

  if (!hasRequired) return false

  const hasEmptyText = textItems.some(item => {
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

  ;(items || []).forEach(item => {
    map[Number(item.position)] = item
  })

  fields.push(map[3]?.image || "")
  fields.push(map[4]?.image || "")

  const textItems = (items || []).filter(item => Number(item.position) >= ARCHIVE_TEXT_START_POSITION)

  if (!textItems.length) {
    fields.push("")
  } else {
    textItems.forEach(item => {
      fields.push(item.text || "")
    })

    const hasRequired = textItems.some(item => String(item.label || "").trim() === "المطلوب")
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
    db.from("archive_boxes").select("*").eq("model", Number(currentModel)),
    db.from("archive_items").select("*").eq("model", Number(currentModel))
  ])

  if (boxesRes.error || itemsRes.error) {
    console.log("ARCHIVE DONE MAP ERROR:", boxesRes.error || itemsRes.error)
    return doneMap
  }

  const boxesMap = {}

  ;(boxesRes.data || []).forEach(box => {
    boxesMap[Number(box.round)] = box
  })

  const itemsByRound = {}

  ;(itemsRes.data || []).forEach(item => {
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

  const parentPosition = Number(
    mergedItem.parent_position ||
    mergedItem.column_group ||
    3
  )

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
    db
      .from("archive_boxes")
      .select("*")
      .eq("model", Number(currentModel)),

    db
      .from("archive_items")
      .select("*")
      .eq("model", Number(currentModel))
      .order("round", { ascending: true })
      .order("position", { ascending: true })
  ])

  if (boxesRes.error || itemsRes.error) {
    console.log("LOAD ARCHIVE ERROR:", boxesRes.error || itemsRes.error)
    showGameToast("تعذر تحميل الأرشيف")
    return
  }

  const boxesMap = {}
  const itemsByRound = {}

  ;(boxesRes.data || []).forEach(box => {
    boxesMap[Number(box.round)] = box
  })

  ;(itemsRes.data || []).forEach(item => {
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
  ;(items || []).forEach(item => {
    map[Number(item.position)] = item
  })

  if (!isAdminFieldFilled(map[3]?.image)) missing.push("الصورة 3")
  if (!isAdminFieldFilled(map[4]?.image)) missing.push("الصورة 4")

  const textItems = (items || []).filter(item => Number(item.position) >= ARCHIVE_TEXT_START_POSITION)
  const hasRequired = textItems.some(item => String(item.label || "").trim() === "المطلوب")

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
            ${
              status.isDone
                ? "بيانات الجولة مكتملة"
                : `ناقص: ${missing.slice(0, 4).join("، ")}${missing.length > 4 ? "..." : ""}`
            }
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

      ${
        isActive
          ? `<div class="adminEditItemBody">${buildArchiveActiveRoundBody(activeBox, activeItems)}</div>`
          : ""
      }
    </details>
  `
}
function buildArchiveActiveRoundBody(box, items = []) {
  const map = {}

  ;(items || []).forEach(item => {
    map[Number(item.position)] = getArchiveDraftItem(Number(item.position), item)
  })

  const savedTextPositions = (items || [])
    .map(item => Number(item.position || 0))
    .filter(pos => pos >= ARCHIVE_TEXT_START_POSITION)

  const savedCount = Math.max(4, savedTextPositions.length || 4)

  const targetCount = Math.min(
    ARCHIVE_MAX_TEXT_BOXES,
    Math.max(4, savedCount + archivePendingExtraCount)
  )

  const maxPos = ARCHIVE_TEXT_START_POSITION + targetCount - 1

  archiveExtraTextPositions = []

  for (let p = ARCHIVE_TEXT_START_POSITION; p <= maxPos; p++) {
    archiveExtraTextPositions.push(p)
  }

  const under3Positions = archiveExtraTextPositions
    .filter(pos => {
      const currentParent = Number(
        archiveDraftState[pos]?.parent_position ||
        map[pos]?.parent_position ||
        map[pos]?.column_group ||
        3
      )

      return currentParent === 3
    })
    .sort((a, b) => a - b)

  const under4Positions = archiveExtraTextPositions
    .filter(pos => {
      const currentParent = Number(
        archiveDraftState[pos]?.parent_position ||
        map[pos]?.parent_position ||
        map[pos]?.column_group ||
        3
      )

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

          ${under4Positions.map(pos => renderArchiveAdminItem(pos, map[pos])).join("")}
        </div>

        <div class="archiveAdminBottomCol archiveTextGroup">
          <div class="archiveAdminColumnTitle">
            <span>تحت الصورة 3</span>
            <small>${under3Positions.length} عناصر</small>
          </div>

          ${under3Positions.map(pos => renderArchiveAdminItem(pos, map[pos])).join("")}
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

      ${
        !hasImage
          ? `<div class="adminMissingHint">الصورة ${position} ناقصة</div>`
          : ""
      }

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

    const { data: oldRows, error: oldRowsError } = await db
      .from("archive_items")
      .select("*")
      .eq("model", Number(currentModel))
      .eq("round", round)

    if (oldRowsError) {
      console.log("READ OLD ARCHIVE ERROR:", oldRowsError)
      showGameToast("تعذر قراءة عناصر الأرشيف القديمة")
      return false
    }

    const oldMap = {}

    ;(oldRows || []).forEach(row => {
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

      const parentPosition = Number(
        document.getElementById(`archiveItemParent_${position}`)?.value || 3
      )

      const promptStyle = (
        document.getElementById(`archiveItemPromptStyle_${position}`)?.value || "shoe"
      ).trim()

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

    const { error: boxError } = await db
      .from("archive_boxes")
      .upsert(
        [{
          model: Number(currentModel),
          round,
          tournament: text1,
          season: text2,
          score: scoreValue
        }],
        {
          onConflict: "model,round"
        }
      )

    if (boxError) {
      console.log("SAVE ARCHIVE BOX ERROR:", boxError)
      showGameToast("فشل حفظ صندوق الأرشيف")
      return false
    }

    const keepPositions = rows.map(row => Number(row.position))

    const { data: existingRows, error: existingError } = await db
      .from("archive_items")
      .select("position")
      .eq("model", Number(currentModel))
      .eq("round", round)

    if (existingError) {
      console.log("READ EXISTING ARCHIVE ERROR:", existingError)
      showGameToast("تعذر قراءة عناصر الأرشيف الحالية")
      return false
    }

    for (const oldRow of existingRows || []) {
      const oldPosition = Number(oldRow.position)

      if (!keepPositions.includes(oldPosition)) {
        const { error: deleteError } = await db
          .from("archive_items")
          .delete()
          .eq("model", Number(currentModel))
          .eq("round", round)
          .eq("position", oldPosition)

        if (deleteError) {
          console.log("DELETE OLD ARCHIVE ERROR:", deleteError)
          showGameToast("فشل تنظيف عناصر الأرشيف")
          return false
        }
      }
    }

    const { error: itemsError } = await db
      .from("archive_items")
      .upsert(rows, {
        onConflict: "model,round,position"
      })

    if (itemsError) {
      console.log("SAVE ARCHIVE ITEMS ERROR:", itemsError)
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

  const { error } = await db
    .from("archive_items")
    .delete()
    .eq("model", Number(currentModel))
    .eq("round", Number(round))
    .eq("position", Number(position))

  if (error) {
    console.log("DELETE ARCHIVE ITEM ERROR:", error)
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

  const ok = confirm(
    hasRound
      ? `هل تريد حذف الجولة ${safeRound} من الأرشيف؟`
      : "هل تريد حذف جميع جولات الأرشيف؟"
  )

  if (!ok) return

  try {
    if (hasRound) {
      const [itemsRes, boxRes] = await Promise.all([
        db.from("archive_items")
          .delete()
          .eq("model", Number(currentModel))
          .eq("round", safeRound),

        db.from("archive_boxes")
          .delete()
          .eq("model", Number(currentModel))
          .eq("round", safeRound)
      ])

      if (itemsRes.error || boxRes.error) {
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
      db.from("archive_items").delete().eq("model", Number(currentModel)),
      db.from("archive_boxes").delete().eq("model", Number(currentModel)),
      db.from("segment_settings").delete().eq("model", Number(currentModel)).eq("segment", "archive")
    ])

    if (itemsRes.error || boxesRes.error || settingsRes.error) {
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
    ...ALL_GAME_SEGMENTS.filter(segment => isAdminSegmentGloballyEnabled(segment.key, map)),
    ...ALL_GAME_SEGMENTS.filter(segment => !isAdminSegmentGloballyEnabled(segment.key, map))
  ]

  grid.innerHTML = `
    <div class="globalSegmentCardsGrid">
      ${sortedSegments.map(segment => {
        const enabled = isAdminSegmentGloballyEnabled(segment.key, map)
        return buildGlobalSegmentToggleCard(segment, enabled)
      }).join("")}
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

window.openGlobalSegmentVisibilityPanel = openGlobalSegmentVisibilityPanel
window.closeGlobalSegmentVisibilityPanel = closeGlobalSegmentVisibilityPanel
window.toggleGlobalSegmentVisibilityFromGate = toggleGlobalSegmentVisibilityFromGate
window.loadGlobalSegmentVisibilityMap = loadGlobalSegmentVisibilityMap
window.isAdminSegmentGloballyEnabled = isAdminSegmentGloballyEnabled
window.toggleAdminSegmentVisibility = toggleAdminSegmentVisibility
window.setGlobalSegmentEnabled = setGlobalSegmentEnabled