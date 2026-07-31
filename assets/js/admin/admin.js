
/* =========================
   1) Constants
========================= */

const BUCKET_NAME = "r3-images"

const ARCHIVE_TEXT_START_POSITION = 5
const ARCHIVE_MAX_TEXT_BOXES = 20

const ALL_GAME_SEGMENTS = [
  { key: "warmup", title: "التسخين", sort: 1 },
  { key: "top10", title: "Top 10", sort: 2 },
  { key: "letterli", title: "حرفلي", sort: 3 },
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
   2) Global State
========================= */

let currentModel = null
let currentModelSetupCompleted = true
let currentModelName = ""

let currentAdminSegment = ""
let adminNavBusy = false
let adminSavingLock = false

let gameToastTimer = null

let globalSegmentVisibilityMap = {}

let globalSegmentVisibilityLoadedAt = 0
let globalSegmentVisibilityLoadPromise = null

const GLOBAL_SEGMENT_VISIBILITY_CACHE_MS =
  60 * 1000


/* =========================
   Admin Home Cache
========================= */

let adminHomeCache = null
let adminHomeCacheModelId = null

function invalidateAdminHomeCache() {
  adminHomeCache = null
  adminHomeCacheModelId = null
  return true
}

let adminTabsRefreshTimer = null

function scheduleAdminTabsRefresh(delay = 120) {
  clearTimeout(adminTabsRefreshTimer)

  adminTabsRefreshTimer = setTimeout(async () => {
    adminTabsRefreshTimer = null

    try {
      await renderAdminTabsUnified()
    } catch (error) {
      console.error(
        "SCHEDULE ADMIN TABS REFRESH ERROR:",
        error
      )
    }
  }, Number(delay || 120))
}

window.scheduleAdminTabsRefresh =
  scheduleAdminTabsRefresh

window.invalidateAdminHomeCache =
  invalidateAdminHomeCache


/* =========================
   ADMIN AUTH DEVICE
========================= */

let adminAuthReadyPromise = null

async function ensureAdminAnonymousSession() {
  if (adminAuthReadyPromise) {
    return adminAuthReadyPromise
  }

  adminAuthReadyPromise = (async () => {
    const {
      data: sessionData,
      error: sessionError
    } = await db.auth.getSession()

    if (
      sessionError
    ) {
      console.log(
        "ADMIN AUTH SESSION ERROR:",
        sessionError
      )
    }

    if (
      sessionData?.session?.user?.id
    ) {
      window.adminAuthUserId =
        sessionData.session.user.id

      return sessionData.session.user
    }

    const {
      data,
      error
    } = await db.auth.signInAnonymously()

    if (error) {
      console.log(
        "ADMIN AUTH ANON ERROR:",
        error
      )

      throw error
    }

    window.adminAuthUserId =
      data?.user?.id || null

    return data?.user || null
  })()

  return adminAuthReadyPromise
}

async function checkAdminDeviceAccess() {
  await ensureAdminAnonymousSession()
  return true
}

async function claimAdminDeviceAccess() {
  await ensureAdminAnonymousSession()
  return true
}

window.ensureAdminAnonymousSession =
  ensureAdminAnonymousSession

window.checkAdminDeviceAccess =
  checkAdminDeviceAccess

window.claimAdminDeviceAccess =
  claimAdminDeviceAccess

document.addEventListener("DOMContentLoaded", () => {
  ensureAdminAnonymousSession().catch(error => {
    console.log(
      "ADMIN AUTH BOOT ERROR:",
      error
    )
  })
})

/* =========================
   Admin Saving Lock
========================= */

function isAdminSaving(showMessage = false) {
  const saving = adminSavingLock === true

  if (saving && showMessage) {
    showGameToast(
      "انتظر حتى تنتهي العملية الحالية",
      "warning"
    )
  }

  return saving
}

function canRunAdminDelete() {
  if (adminSavingLock) {
    showGameToast(
      "لا يمكن الحذف أثناء الحفظ",
      "warning"
    )

    return false
  }

  return true
}

function setAdminSaving(value, message = "") {
  adminSavingLock = Boolean(value)

  document.body?.classList.toggle(
    "adminIsSaving",
    adminSavingLock
  )

  document
    .querySelectorAll(`
      .adminSaveBtn,
      .adminModelCreateBtn,
      .adminWorkspaceActionBtn,
      .adminDeleteAllBtn,
      .adminDeleteBtn,
      .adminDeleteMiniBtn
    `)
    .forEach(button => {
      if (adminSavingLock) {
        if (!button.dataset.adminWasDisabled) {
          button.dataset.adminWasDisabled =
            button.disabled ? "1" : "0"
        }

        button.disabled = true
      } else {
        const wasDisabled =
          button.dataset.adminWasDisabled === "1"

        if (!wasDisabled) {
          button.disabled = false
        }

        delete button.dataset.adminWasDisabled
      }
    })

  if (adminSavingLock && message) {
    showGameToast(message, "info")
  }
}

/* =========================
   Upload Helpers
========================= */

function getFileSizeMB(file) {
  if (!file) return 0

  return Number(
    (
      Number(file.size || 0) /
      1024 /
      1024
    ).toFixed(2)
  )
}

function makeSafeFileExt(
  file,
  fallback = "bin"
) {
  const nameExtension =
    String(file?.name || "")
      .split(".")
      .pop()
      ?.toLowerCase()
      ?.replace(/[^a-z0-9]/g, "")

  if (
    nameExtension &&
    nameExtension.length <= 8
  ) {
    return nameExtension
  }

  const type =
    String(file?.type || "")
      .toLowerCase()

  const typeMap = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/heic": "heic",
    "image/heif": "heif",

    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/mov": "mov",
    "video/webm": "webm",
    "video/x-m4v": "m4v"
  }

  return typeMap[type] || fallback
}

function makeUploadPath(
  prefix = "file",
  extension = "bin"
) {
  const modelId =
    Number(currentModel || 0)

  if (!modelId) {
    return ""
  }

  const cleanPrefix =
    String(prefix || "file")
      .replace(
        /[^a-zA-Z0-9_-]/g,
        "_"
      )

  const cleanExtension =
    String(extension || "bin")
      .replace(
        /[^a-zA-Z0-9]/g,
        ""
      )
      .toLowerCase() || "bin"

  const uniqueId =
    globalThis.crypto
      ?.randomUUID
      ?.()
      ?.replaceAll("-", "") ||
    `${Date.now()}_${Math.random()
      .toString(36)
      .slice(2)}`

  return (
    `model_${modelId}/` +
    `${cleanPrefix}_${uniqueId}.` +
    cleanExtension
  )
}

function getAdminUploadErrorMessage(error) {
  return String(
    error?.message ||
    error?.error ||
    error?.statusCode ||
    "خطأ غير معروف"
  )
}

function isSupportedAdminVideo(file) {
  const mimeType =
    String(file?.type || "")
      .toLowerCase()

  const extension =
    makeSafeFileExt(file, "")

  const supportedTypes = [
    "video/mp4",
    "video/quicktime",
    "video/mov",
    "video/webm",
    "video/x-m4v"
  ]

  const supportedExtensions = [
    "mp4",
    "mov",
    "webm",
    "m4v"
  ]

  return (
    supportedTypes.includes(mimeType) ||
    supportedExtensions.includes(extension)
  )
}

async function uploadImageFile(
  file,
  prefix = "image"
) {
  if (!file) return ""

  if (!currentModel) {
    showGameToast(
      "افتح النموذج قبل رفع الصورة",
      "warning"
    )

    return ""
  }

  const sizeMB =
    getFileSizeMB(file)

  if (sizeMB > 15) {
    showGameToast(
      `حجم الصورة ${sizeMB}MB، الحد الأقصى 15MB`,
      "warning"
    )

    return ""
  }

  const mimeType =
    String(file.type || "")
      .toLowerCase()

  if (
    mimeType &&
    !mimeType.startsWith("image/")
  ) {
    showGameToast(
      "الملف المختار ليس صورة",
      "warning"
    )

    return ""
  }

  try {
    const extension =
      makeSafeFileExt(file, "png")

    const filePath =
      makeUploadPath(
        prefix,
        extension
      )

    if (!filePath) {
      showGameToast(
        "تعذر إنشاء مسار الصورة",
        "error"
      )

      return ""
    }

    const {
      error: uploadError
    } = await db.storage
      .from(BUCKET_NAME)
      .upload(
        filePath,
        file,
        {
          upsert: false,
          cacheControl: "31536000",
          contentType:
            file.type ||
            `image/${extension}`
        }
      )

    if (uploadError) {
      console.error(
        "UPLOAD IMAGE ERROR:",
        uploadError
      )

      showGameToast(
        `فشل رفع الصورة: ${getAdminUploadErrorMessage(uploadError)}`,
        "error"
      )

      return ""
    }

    const { data } =
      db.storage
        .from(BUCKET_NAME)
        .getPublicUrl(filePath)

    const publicUrl =
      data?.publicUrl || ""

    if (!publicUrl) {
      showGameToast(
        "تم رفع الصورة لكن تعذر إنشاء رابطها",
        "error"
      )

      return ""
    }

    return publicUrl
  } catch (error) {
    console.error(
      "UPLOAD IMAGE CATCH:",
      error
    )

    showGameToast(
      "حدث خطأ أثناء رفع الصورة",
      "error"
    )

    return ""
  }
}

async function uploadVideoFile(
  file,
  prefix = "video"
) {
  if (!file) return ""

  if (!currentModel) {
    showGameToast(
      "افتح النموذج قبل رفع الفيديو",
      "warning"
    )

    return ""
  }

  if (!isSupportedAdminVideo(file)) {
    showGameToast(
      "صيغة الفيديو غير مدعومة، استخدم MP4 أو MOV أو M4V أو WebM",
      "warning"
    )

    return ""
  }

  const sizeMB =
    getFileSizeMB(file)

  const maxVideoSizeMB = 45

  if (sizeMB > maxVideoSizeMB) {
    showGameToast(
      `حجم الفيديو ${sizeMB}MB، الحد الأقصى ${maxVideoSizeMB}MB`,
      "warning"
    )

    return ""
  }

  try {
    const extension =
      makeSafeFileExt(file, "mp4")

    const filePath =
      makeUploadPath(
        prefix,
        extension
      )

    if (!filePath) {
      showGameToast(
        "تعذر إنشاء مسار الفيديو",
        "error"
      )

      return ""
    }

    const {
      error: uploadError
    } = await db.storage
      .from(BUCKET_NAME)
      .upload(
        filePath,
        file,
        {
          upsert: false,
          cacheControl: "31536000",
          contentType:
            file.type ||
            "video/mp4"
        }
      )

    if (uploadError) {
      console.error(
        "UPLOAD VIDEO ERROR:",
        uploadError
      )

      showGameToast(
        `فشل رفع الفيديو: ${getAdminUploadErrorMessage(uploadError)}`,
        "error"
      )

      return ""
    }

    const { data } =
      db.storage
        .from(BUCKET_NAME)
        .getPublicUrl(filePath)

    const publicUrl =
      data?.publicUrl || ""

    if (!publicUrl) {
      showGameToast(
        "تم رفع الفيديو لكن تعذر إنشاء رابطه",
        "error"
      )

      return ""
    }

    return publicUrl
  } catch (error) {
    console.error(
      "UPLOAD VIDEO CATCH:",
      error
    )

    showGameToast(
      "حدث خطأ أثناء رفع الفيديو",
      "error"
    )

    return ""
  }
}

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
    text.insertAdjacentHTML(
      "beforebegin",
      `<span id="gameToastIcon" class="gameToastIcon"></span>`
    )

    icon = document.getElementById("gameToastIcon")
  }

  const safeType = ["success", "error", "warning", "info"].includes(type)
    ? type
    : "info"

  const icons = {
    success: "✓",
    error: "!",
    warning: "!",
    info: "●"
  }

  toast.classList.remove(
    "success",
    "error",
    "warning",
    "info",
    "hidden",
    "show"
  )

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

function showAdminConfirm(
  message,
  {
    title = "تأكيد الإجراء",
    okText = "موافق",
    cancelText = "إلغاء",
    danger = false
  } = {}
) {
  return new Promise(resolve => {
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

    modal?.addEventListener("click", event => {
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
    return sessionStorage.getItem(
      getAdminModelAccessKey(id)
    ) === "1"
  } catch {
    return false
  }
}

function unlockAdminModel(modelId) {
  const id = Number(modelId || 0)

  if (!id) return false

  try {
    sessionStorage.setItem(
      getAdminModelAccessKey(id),
      "1"
    )

    return true
  } catch {
    return false
  }
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

    modal?.addEventListener("click", event => {
      if (event.target === modal) {
        cancel()
      }
    })

    input?.addEventListener("keydown", event => {
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

async function requestAdminModelAccess(
  modelId,
  fallbackName = ""
) {
  const id = Number(modelId || 0)

  if (!id) {
    showGameToast("اختر النموذج")
    return null
  }

  const result = await dbSelect(
    "models",
    query =>
      query
        .eq("id", id)
        .maybeSingle(),
    {
      select:
        "id, name, admin_pin, setup_completed, created_by_user_id",
      fallback: null,
      logLabel: "MODEL PIN READ"
    }
  )

  if (!result.ok || !result.data) {
    showGameToast("تعذر قراءة بيانات النموذج")
    return null
  }

  const data = result.data

  const modelName =
    data.name ||
    fallbackName ||
    `نموذج ${id}`

  const modelInfo = {
    id,
    name: modelName,
    setup_completed:
      data.setup_completed !== false
  }

  const savedPin =
    String(data.admin_pin || "").trim()

  if (!savedPin) {
    const newPin =
      await requestAdminPinModal({
        title: `تأمين ${modelName}`,
        message:
          "هذا النموذج قديم وما له رقم سري، اكتب رقم سري جديد له",
        confirmText: "حفظ الرقم"
      })

    if (!newPin) {
      showGameToast(
        "لازم تضيف رقم سري للنموذج"
      )

      return null
    }

    const updateResult = await dbUpdate(
      "models",
      {
        admin_pin: newPin
      },
      query =>
        query.eq("id", id),
      {
        logLabel: "SAVE OLD MODEL PIN"
      }
    )

    if (!updateResult.ok) {
      console.log(
        "SAVE OLD MODEL PIN ERROR:",
        updateResult.error
      )

      showGameToast(
        "تعذر حفظ الرقم السري للنموذج"
      )

      return null
    }

    unlockAdminModel(id)

    showGameToast(
      "تم حفظ الرقم السري للنموذج",
      "success"
    )

    return modelInfo
  }

  const enteredPin =
    await requestAdminPinModal({
      title: `فتح ${modelName}`,
      message:
        "اكتب الرقم السري الخاص بهذا النموذج",
      confirmText: "فتح النموذج"
    })

  if (!enteredPin) {
    return null
  }

  if (enteredPin !== savedPin) {
    showGameToast(
      "الرقم السري غير صحيح",
      "error"
    )

    return null
  }

  unlockAdminModel(id)

  return modelInfo
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

  const fields = [
    row.question,
    row.answer
  ]

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

  document
    .getElementById("adminModelGateStart")
    ?.classList.remove("hidden")

  document
    .getElementById("adminModelLoginBox")
    ?.classList.add("hidden")

  document
    .getElementById("adminModelCreateBox")
    ?.classList.add("hidden")

  showAdminEmptyState(
    "اختر دخول نموذج أو إنشاء نموذج جديد"
  )
}

function showAdminWorkspace() {
  modelGate()?.classList.add("hidden")
  workspace()?.classList.remove("hidden")
}

function showAdminEmptyState(
  message = "افتح نموذجًا ثم اختر الفقرة التي تريد تعديلها"
) {
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
  scheduleAdminTabsRefresh()
}

/* =========================
   8) Workspace Actions
========================= */

function renderAdminHomeActions() {
  const actions = workspaceActions()

  if (!actions) return

  actions.className =
    "adminWorkspaceActions adminWorkspaceActionsHome"

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
  class="adminWorkspaceActionBtn settings"
  onclick="openModelSegmentVisibilityPanel()"
>
  ظهور الفقرات
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

  actions.className =
    "adminWorkspaceActions adminWorkspaceActionsSettings"

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

/* =========================
   SUPABASE CLEANUP SCANNER
   فحص فقط بدون حذف
========================= */

const SUPABASE_CLEANUP_TABLES = [
  {
    table: "questions",
    label: "التسخين / الأسئلة"
  },
  {
    table: "top10_questions",
    label: "Top 10"
  },
  {
    table: "auction_questions",
    label: "فتبلة"
  },
  {
    table: "who_images",
    label: "من هو"
  },
  {
    table: "explain_words",
    label: "اشرح الكلمة"
  },
  {
    table: "segment_settings",
    label: "إعدادات الفقرات"
  },
  {
    table: "visible_segments",
    label: "إظهار الفقرات"
  },
  {
    table: "final_round_meta",
    label: "بيانات الفاصلة"
  },
  {
    table: "final_round1_items",
    label: "الفاصلة الجولة 1 / قصة"
  },
  {
    table: "final_round2_items",
    label: "الفاصلة الجولة 2"
  },
  {
    table: "final_round3_items",
    label: "الفاصلة صور / تركيز"
  },
  {
    table: "archive_boxes",
    label: "الأرشيف الجولات"
  },
  {
    table: "archive_items",
    label: "الأرشيف العناصر"
  },
  {
    table: "random_challenge_questions",
    label: "التحدي"
  },
  {
    table: "game_sessions",
    label: "جلسات اللعب / أسماء الفرق"
  },
  {
    table: "presenter_commands",
    label: "أوامر المقدم"
  }
]

const SUPABASE_CLEANUP_MEDIA_TABLES = [
  {
    table: "questions",
    columns: ["image"]
  },
  {
    table: "auction_questions",
    columns: ["image", "video"]
  },
  {
    table: "who_images",
    columns: ["image"]
  },
  {
    table: "archive_items",
    columns: ["image"]
  },
  {
    table: "final_round1_items",
    columns: ["image"]
  },
  {
    table: "final_round3_items",
    columns: ["image", "video"]
  }
]

function normalizeCleanupStoragePath(value) {
  const path =
    getAdminStoragePathFromUrl(value)

  return String(path || "").trim()
}

async function getSupabaseCleanupUsedStoragePaths() {
  const usedPaths = new Set()

  for (const item of SUPABASE_CLEANUP_MEDIA_TABLES) {
    const select =
      item.columns.join(",")

    const result = await dbSelect(
      item.table,
      query => query,
      {
        select,
        fallback: [],
        logLabel:
          `CLEANUP USED MEDIA ${item.table}`
      }
    )

    if (!result.ok) {
      console.error(
        `CLEANUP USED MEDIA ${item.table} ERROR:`,
        result.error
      )

      continue
    }

    ;(result.data || []).forEach(row => {
      item.columns.forEach(column => {
        const path =
          normalizeCleanupStoragePath(row[column])

        if (path) {
          usedPaths.add(path)
        }
      })
    })
  }

  return usedPaths
}
function chunkSupabaseCleanupItems(items, size = 100) {
  const chunks = []

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }

  return chunks
}

async function getSupabaseCleanupModelIds() {
  const result = await dbSelect(
    "models",
    query =>
      query.order(
        "id",
        { ascending: true }
      ),
    {
      select: "id",
      fallback: [],
      logLabel: "CLEANUP DELETE MODELS"
    }
  )

  if (!result.ok) {
    console.error(
      "CLEANUP DELETE MODELS ERROR:",
      result.error
    )

    return null
  }

  return new Set(
    (result.data || [])
      .map(model => Number(model.id))
      .filter(Boolean)
  )
}

function getSupabaseCleanupMediaConfig(table) {
  return SUPABASE_CLEANUP_MEDIA_TABLES.find(item => {
    return item.table === table
  }) || null
}

async function collectSupabaseCleanupDeletePlan(modelIds) {
  const tablePlans = []
  const mediaCandidates = []
  const keptMediaPaths = new Set()

  for (const item of SUPABASE_CLEANUP_TABLES) {
    const mediaConfig =
      getSupabaseCleanupMediaConfig(item.table)

    const selectColumns =
      mediaConfig
        ? [
            "id",
            "model",
            ...mediaConfig.columns
          ].join(",")
        : "id,model"

    const result = await dbSelect(
      item.table,
      query => query,
      {
        select: selectColumns,
        fallback: [],
        logLabel:
          `CLEANUP DELETE READ ${item.table}`
      }
    )

    if (!result.ok) {
      console.error(
        `CLEANUP DELETE READ ${item.table} ERROR:`,
        result.error
      )

      tablePlans.push({
        table: item.table,
        label: item.label,
        ids: [],
        failed: true
      })

      continue
    }

    const rows =
      result.data || []

    const deleteRows = []

    rows.forEach(row => {
      const modelId =
        getCleanupModelId(row.model)

      const shouldDelete =
        !modelId ||
        !modelIds.has(modelId)

      if (
        mediaConfig &&
        !shouldDelete &&
        modelIds.has(modelId)
      ) {
        mediaConfig.columns.forEach(column => {
          const path =
            normalizeCleanupStoragePath(
              row[column]
            )

          if (path) {
            keptMediaPaths.add(path)
          }
        })
      }

      if (shouldDelete) {
        deleteRows.push(row)

        if (mediaConfig) {
          mediaConfig.columns.forEach(column => {
            const path =
              normalizeCleanupStoragePath(
                row[column]
              )

            if (path) {
              mediaCandidates.push(path)
            }
          })
        }
      }
    })

    tablePlans.push({
      table: item.table,
      label: item.label,
      ids: deleteRows
        .map(row => row.id)
        .filter(value => {
          return (
            value !== null &&
            typeof value !== "undefined" &&
            value !== ""
          )
        }),
      failed: false
    })
  }

  const mediaPaths =
    Array.from(
      new Set(mediaCandidates)
    ).filter(path => {
      return !keptMediaPaths.has(path)
    })

  return {
    tablePlans,
    mediaPaths
  }
}

async function deleteSupabaseCleanupRowsByIds(table, ids) {
  const cleanIds =
    Array.from(
      new Set(ids || [])
    ).filter(value => {
      return (
        value !== null &&
        typeof value !== "undefined" &&
        value !== ""
      )
    })

  if (!cleanIds.length) {
    return true
  }

  const chunks =
    chunkSupabaseCleanupItems(
      cleanIds,
      100
    )

  for (const chunk of chunks) {
    const result = await dbDelete(
      table,
      query =>
        query.in(
          "id",
          chunk
        ),
      {
        logLabel:
          `CLEANUP DELETE ROWS ${table}`
      }
    )

    if (!result.ok) {
      console.error(
        `CLEANUP DELETE ROWS ${table} ERROR:`,
        result.error
      )

      return false
    }
  }

  return true
}

async function deleteSupabaseCleanupUnusedStorage() {
  const usedPaths =
    await getSupabaseCleanupUsedStoragePaths()

  let storageFiles = []

  try {
    storageFiles =
      await listStorageFilesRecursive("")
  } catch (error) {
    console.error(
      "CLEANUP UNUSED STORAGE LIST ERROR:",
      error
    )

    return false
  }

  const unusedPaths =
    storageFiles.filter(path => {
      return !usedPaths.has(path)
    })

  if (!unusedPaths.length) {
    return true
  }

  return deleteAdminStorageUrls(unusedPaths)
}

async function cleanupSupabaseSafeResidues() {
  if (isAdminSaving()) {
    return false
  }

  const confirmed =
    await showAdminConfirm(
      "سيتم حذف البقايا الآمنة فقط:\n\n- صفوف الجداول التابعة لنماذج محذوفة\n- الصفوف التي بدون model\n- ملفات Storage غير المستخدمة\n\nلن يتم حذف أي ملف مستخدم داخل نموذج موجود.",
      {
        title: "حذف البقايا الآمنة",
        okText: "نعم، احذف البقايا",
        cancelText: "إلغاء",
        danger: true
      }
    )

  if (!confirmed) {
    return false
  }

  try {
    setAdminSaving(
      true,
      "جارٍ تنظيف Supabase..."
    )

    const modelIds =
      await getSupabaseCleanupModelIds()

    if (!modelIds) {
      showGameToast(
        "تعذر قراءة النماذج",
        "error"
      )

      return false
    }

    const plan =
      await collectSupabaseCleanupDeletePlan(
        modelIds
      )

    if (plan.mediaPaths.length) {
      const mediaDeleted =
        await deleteAdminStorageUrls(
          plan.mediaPaths
        )

      if (!mediaDeleted) {
        showGameToast(
          "توقف التنظيف لأن بعض ملفات البقايا لم تُحذف",
          "error"
        )

        return false
      }
    }

    for (const tablePlan of plan.tablePlans) {
      if (tablePlan.failed) {
        showGameToast(
          `تعذر فحص ${tablePlan.label}`,
          "error"
        )

        return false
      }

      const rowsDeleted =
        await deleteSupabaseCleanupRowsByIds(
          tablePlan.table,
          tablePlan.ids
        )

      if (!rowsDeleted) {
        showGameToast(
          `تعذر حذف بقايا ${tablePlan.label}`,
          "error"
        )

        return false
      }
    }

    const unusedStorageDeleted =
      await deleteSupabaseCleanupUnusedStorage()

    if (!unusedStorageDeleted) {
      showGameToast(
        "تم حذف الجداول لكن تعذر حذف بعض ملفات Storage غير المستخدمة",
        "warning"
      )

      await scanSupabaseCleanup()

      return false
    }

    invalidateAdminHomeCache()

    await scanSupabaseCleanup()

    showGameToast(
      "تم حذف البقايا الآمنة",
      "success"
    )

    return true
  } catch (error) {
    console.error(
      "CLEANUP SAFE RESIDUES ERROR:",
      error
    )

    showGameToast(
      "حدث خطأ أثناء تنظيف Supabase",
      "error"
    )

    return false
  } finally {
    setAdminSaving(false)
  }
}
async function cleanupSupabaseRuntimeLogs() {
  if (isAdminSaving()) {
    return false
  }

  const confirmed =
    await showAdminConfirm(
      "سيتم حذف سجلات اللعب القديمة فقط:\n\n- جلسات اللعب\n- أسماء الفرق المحفوظة داخل الجلسات\n- أوامر المقدم\n- أكواد الدخول القديمة\n\nلن يتم حذف أي نموذج أو سؤال أو صورة.\n\nلا تستخدم هذا الزر أثناء وجود لعبة شغالة.",
      {
        title: "حذف سجلات اللعب",
        okText: "نعم، احذف السجلات",
        cancelText: "إلغاء",
        danger: true
      }
    )

  if (!confirmed) {
    return false
  }

  try {
    setAdminSaving(
      true,
      "جارٍ حذف سجلات اللعب..."
    )

    const sessionsResult =
      await dbSelect(
        "game_sessions",
        query => query,
        {
          select: "id",
          fallback: [],
          logLabel:
            "CLEANUP GAME SESSIONS READ"
        }
      )

    if (!sessionsResult.ok) {
      console.error(
        "CLEANUP GAME SESSIONS READ ERROR:",
        sessionsResult.error
      )

      showGameToast(
        "تعذر قراءة جلسات اللعب",
        "error"
      )

      return false
    }

    const commandsResult =
      await dbSelect(
        "presenter_commands",
        query => query,
        {
          select: "id",
          fallback: [],
          logLabel:
            "CLEANUP PRESENTER COMMANDS READ"
        }
      )

    if (!commandsResult.ok) {
      console.error(
        "CLEANUP PRESENTER COMMANDS READ ERROR:",
        commandsResult.error
      )

      showGameToast(
        "تعذر قراءة أوامر المقدم",
        "error"
      )

      return false
    }

    const commandIds =
      (commandsResult.data || [])
        .map(row => row.id)
        .filter(value => {
          return (
            value !== null &&
            typeof value !== "undefined" &&
            value !== ""
          )
        })

    const sessionIds =
      (sessionsResult.data || [])
        .map(row => row.id)
        .filter(value => {
          return (
            value !== null &&
            typeof value !== "undefined" &&
            value !== ""
          )
        })

    if (
      !commandIds.length &&
      !sessionIds.length
    ) {
      showGameToast(
        "لا توجد سجلات لعب للحذف",
        "success"
      )

      await scanSupabaseCleanup()

      return true
    }

    const commandsDeleted =
      await deleteSupabaseCleanupRowsByIds(
        "presenter_commands",
        commandIds
      )

    if (!commandsDeleted) {
      showGameToast(
        "تعذر حذف أوامر المقدم",
        "error"
      )

      return false
    }

    const sessionsDeleted =
      await deleteSupabaseCleanupRowsByIds(
        "game_sessions",
        sessionIds
      )

    if (!sessionsDeleted) {
      showGameToast(
        "تعذر حذف جلسات اللعب",
        "error"
      )

      return false
    }

    invalidateAdminHomeCache()

    await scanSupabaseCleanup()

    showGameToast(
      "تم حذف سجلات اللعب",
      "success"
    )

    return true
  } catch (error) {
    console.error(
      "CLEANUP RUNTIME LOGS ERROR:",
      error
    )

    showGameToast(
      "حدث خطأ أثناء حذف سجلات اللعب",
      "error"
    )

    return false
  } finally {
    setAdminSaving(false)
  }
}

function renderSupabaseCleanupActions() {
  const actions = workspaceActions()

  if (!actions) return

  actions.className =
    "adminWorkspaceActions adminWorkspaceActionsHome"

  actions.innerHTML = `
    <button
      type="button"
      class="adminWorkspaceActionBtn primary"
      onclick="scanSupabaseCleanup()"
    >
      فحص الآن
    </button>

    <button
      type="button"
      class="adminWorkspaceActionBtn exit"
      onclick="cleanupSupabaseSafeResidues()"
    >
      حذف البقايا الآمنة
    </button>

    <button
      type="button"
      class="adminWorkspaceActionBtn exit"
      onclick="cleanupSupabaseRuntimeLogs()"
    >
      حذف سجلات اللعب
    </button>

    <button
      type="button"
      class="adminWorkspaceActionBtn"
      onclick="showAdminModelGate()"
    >
      رجوع للنماذج
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

function getCleanupModelId(value) {
  const id = Number(value || 0)

  return Number.isFinite(id)
    ? id
    : 0
}

function buildSupabaseCleanupTableRows(items) {
  if (!items.length) {
    return `
      <tr>
        <td colspan="5">لا توجد بيانات</td>
      </tr>
    `
  }

  return items.map(item => `
    <tr>
      <td>${escapeHtml(item.label)}</td>
      <td>${Number(item.total || 0)}</td>
      <td>${Number(item.current || 0)}</td>
      <td>${Number(item.orphan || 0)}</td>
      <td>${Number(item.empty || 0)}</td>
    </tr>
  `).join("")
}

function buildSupabaseCleanupStorageRows(storage) {
  const folders =
    storage.folders || []

  if (!folders.length) {
    return `
      <tr>
        <td colspan="6">لا توجد ملفات في Storage</td>
      </tr>
    `
  }

  return folders.map(folder => `
    <tr>
      <td>${escapeHtml(folder.folder)}</td>
      <td>${Number(folder.files || 0)}</td>
      <td>${Number(folder.usedFiles || 0)}</td>
      <td>${Number(folder.unusedFiles || 0)}</td>
      <td>${folder.exists ? "مربوط بنموذج" : "بقايا / غير مربوط"}</td>
      <td>${folder.isCurrent ? "النموذج الحالي" : "-"}</td>
    </tr>
  `).join("")
}

function renderSupabaseCleanupReport(report) {
  const area = editor()

  if (!area) return

  const orphanTotal =
    report.tables.reduce((sum, item) => {
      return sum + Number(item.orphan || 0)
    }, 0)

  const emptyTotal =
    report.tables.reduce((sum, item) => {
      return sum + Number(item.empty || 0)
    }, 0)

  area.innerHTML = `
    <div class="adminEditorPage">
      <div class="adminEditorHeader">
        <div>
          <h2>تنظيف Supabase</h2>
          <p>
            هذا التقرير للفحص فقط، ولا يحذف أي بيانات.
          </p>
        </div>
      </div>

      <div class="adminEmptyState">
        النماذج الموجودة: ${Number(report.modelsCount || 0)}
        <br>
        بقايا الجداول لنماذج محذوفة: ${Number(orphanTotal)}
        <br>
        صفوف بدون رقم نموذج: ${Number(emptyTotal)}
        <br>
        مجلدات Storage اليتيمة: ${Number(report.storage.orphanFolders || 0)}
        <br>
ملفات Storage المستخدمة: ${Number(report.storage.usedFiles || 0)}
<br>
ملفات Storage غير المستخدمة: ${Number(report.storage.unusedFiles || 0)}
        <br>
        ملفات Storage داخل model_unknown: ${Number(report.storage.unknownFiles || 0)}
      </div>

      <div class="adminEditorBlock">
        <h3>تقرير الجداول</h3>

        <div style="overflow:auto">
          <table class="adminTable">
            <thead>
              <tr>
                <th>الجدول</th>
                <th>الإجمالي</th>
                <th>النموذج الحالي</th>
                <th>بقايا نماذج محذوفة</th>
                <th>بدون model</th>
              </tr>
            </thead>
            <tbody>
              ${buildSupabaseCleanupTableRows(report.tables)}
            </tbody>
          </table>
        </div>
      </div>

      <div class="adminEditorBlock">
        <h3>تقرير Storage</h3>

        <div style="overflow:auto">
          <table class="adminTable">
            <thead>
             <tr>
  <th>المجلد / الملف</th>
  <th>عدد الملفات</th>
  <th>مستخدمة</th>
  <th>غير مستخدمة</th>
  <th>الحالة</th>
  <th>ملاحظة</th>
</tr>
            </thead>
            <tbody>
              ${buildSupabaseCleanupStorageRows(report.storage)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
}

async function openSupabaseCleanupGatePage() {
  currentModel = null
  currentModelName = ""
  currentAdminSegment = "cleanup"

  updateAdminBrandModel()
  showAdminWorkspace()
  renderSupabaseCleanupActions()
  scheduleAdminTabsRefresh()

  const area = editor()

  if (area) {
    area.innerHTML = `
      <div class="adminEmptyState">
        جارٍ فحص Supabase...
      </div>
    `
  }

  await scanSupabaseCleanup()

  return true
}

async function scanSupabaseCleanup() {
  const area = editor()

  if (area) {
    area.innerHTML = `
      <div class="adminEmptyState">
        جارٍ فحص البيانات والملفات...
      </div>
    `
  }

  try {
    const modelsResult = await dbSelect(
      "models",
      query =>
        query.order(
          "id",
          { ascending: true }
        ),
      {
        select: "id,name",
        fallback: [],
        logLabel: "CLEANUP MODELS"
      }
    )

    if (!modelsResult.ok) {
      console.error(
        "CLEANUP MODELS ERROR:",
        modelsResult.error
      )

      showGameToast(
        "تعذر قراءة النماذج",
        "error"
      )

      return false
    }

    const models =
      modelsResult.data || []

    const modelIds =
      new Set(
        models.map(model =>
          Number(model.id)
        )
      )

    const currentModelId =
      getCleanupModelId(currentModel)

    const tableReports = []

    for (const item of SUPABASE_CLEANUP_TABLES) {
      const result = await dbSelect(
        item.table,
        query => query,
        {
          select: "id,model",
          fallback: [],
          logLabel:
            `CLEANUP ${item.table}`
        }
      )

      if (!result.ok) {
        tableReports.push({
          table: item.table,
          label: `${item.label} / تعذر الفحص`,
          total: 0,
          current: 0,
          orphan: 0,
          empty: 0
        })

        continue
      }

      const rows =
        result.data || []

      let current = 0
      let orphan = 0
      let empty = 0

      rows.forEach(row => {
        const modelId =
          getCleanupModelId(row.model)

        if (!modelId) {
          empty += 1
          return
        }

        if (
          currentModelId &&
          modelId === currentModelId
        ) {
          current += 1
        }

        if (!modelIds.has(modelId)) {
          orphan += 1
        }
      })

      tableReports.push({
        table: item.table,
        label: item.label,
        total: rows.length,
        current,
        orphan,
        empty
      })
    }

        const usedStoragePaths =
      await getSupabaseCleanupUsedStoragePaths()

    let storageFiles = []

    try {
      storageFiles =
        await listStorageFilesRecursive("")
    } catch (storageError) {
      console.error(
        "CLEANUP STORAGE SCAN ERROR:",
        storageError
      )

      storageFiles = []
    }

    const folderMap = {}

    storageFiles.forEach(path => {
      const text =
        String(path || "").trim()

      if (!text) return

      const folder =
        text.split("/")[0] || ""

      if (!folder) return

      if (!folderMap[folder]) {
        folderMap[folder] = 0
      }

      folderMap[folder] += 1
    })

    const folders =
      Object.keys(folderMap)
        .sort()
        .map(folder => {
          const match =
            folder.match(/^model_(\d+)$/)

          const folderModelId =
            match ? Number(match[1]) : 0

          const isUnknown =
            folder === "model_unknown"

          const exists =
            folderModelId
              ? modelIds.has(folderModelId)
              : false

          const folderFiles =
            storageFiles.filter(path => {
              return (
                String(path || "")
                  .split("/")[0] === folder
              )
            })

          const usedFiles =
            folderFiles.filter(path => {
              return usedStoragePaths.has(path)
            }).length

          const unusedFiles =
            Math.max(
              0,
              folderFiles.length - usedFiles
            )

          return {
            folder,
            files: folderMap[folder],
            usedFiles,
            unusedFiles,
            exists,
            isCurrent:
              currentModelId &&
              folderModelId === currentModelId,
            isUnknown
          }
        })

    const storage = {
      folders,
      totalFiles: storageFiles.length,
      usedFiles:
        folders.reduce((sum, folder) => {
          return sum + Number(folder.usedFiles || 0)
        }, 0),
      unusedFiles:
        folders.reduce((sum, folder) => {
          return sum + Number(folder.unusedFiles || 0)
        }, 0),
      orphanFolders:
        folders.filter(folder => {
          return (
            !folder.exists ||
            folder.isUnknown
          )
        }).length,
      unknownFiles:
        folders
          .filter(folder => folder.isUnknown)
          .reduce((sum, folder) => {
            return sum + Number(folder.files || 0)
          }, 0)
    }

    renderSupabaseCleanupReport({
      modelsCount: models.length,
      currentModelId,
      tables: tableReports,
      storage
    })

    showGameToast(
      "تم فحص Supabase بدون حذف",
      "success"
    )

    return true
  } catch (error) {
    console.error(
      "SCAN SUPABASE CLEANUP ERROR:",
      error
    )

    showGameToast(
      "حدث خطأ أثناء فحص Supabase",
      "error"
    )

    if (area) {
      area.innerHTML = `
        <div class="adminEmptyState">
          حدث خطأ أثناء فحص Supabase
        </div>
      `
    }

    return false
  }
}

function renderAdminSegmentActions() {
  const actions = workspaceActions()

  if (!actions) return

  actions.className =
    "adminWorkspaceActions adminWorkspaceActionsSegment"

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

let modelSegmentVisibilityMap = {}
let modelSegmentVisibilityLoadedModel = null
let modelSegmentVisibilityLoadedAt = 0
let modelSegmentVisibilityLoadPromise = null

const MODEL_SEGMENT_VISIBILITY_CACHE_MS = 15000

async function loadModelSegmentVisibilityMap(
  modelId = currentModel,
  forceRefresh = false
) {
  const numericModelId =
    Number(modelId || 0)

  const defaultMap = {}

  ALL_GAME_SEGMENTS.forEach(segment => {
    defaultMap[segment.key] = true
  })

  if (!numericModelId) {
    modelSegmentVisibilityMap = defaultMap
    modelSegmentVisibilityLoadedModel = null
    modelSegmentVisibilityLoadedAt = Date.now()

    return modelSegmentVisibilityMap
  }

  const now = Date.now()

  const isSameModel =
    Number(modelSegmentVisibilityLoadedModel || 0) ===
    numericModelId

  const hasCachedMap =
    isSameModel &&
    modelSegmentVisibilityMap &&
    Object.keys(modelSegmentVisibilityMap).length > 0

  const cacheStillValid =
    hasCachedMap &&
    now - modelSegmentVisibilityLoadedAt <
      MODEL_SEGMENT_VISIBILITY_CACHE_MS

  if (!forceRefresh && cacheStillValid) {
    return modelSegmentVisibilityMap
  }

  if (
    !forceRefresh &&
    modelSegmentVisibilityLoadPromise
  ) {
    return modelSegmentVisibilityLoadPromise
  }

  modelSegmentVisibilityLoadPromise =
    (async () => {
      const result = await dbSelect(
        "visible_segments",
        query =>
          query
            .eq("model", numericModelId)
            .order("sort_order", {
              ascending: true
            }),
        {
          select:
            "segment_key,is_visible,sort_order",

          fallback: [],

          logLabel:
            "LOAD MODEL VISIBLE SEGMENTS"
        }
      )

      if (!result.ok) {
        modelSegmentVisibilityMap = defaultMap
        modelSegmentVisibilityLoadedModel = numericModelId
        modelSegmentVisibilityLoadedAt = Date.now()

        return modelSegmentVisibilityMap
      }

      ;(result.data || []).forEach(row => {
        const key =
          String(row.segment_key || "").trim()

        if (!key) return

        const isKnownSegment =
          ALL_GAME_SEGMENTS.some(segment => {
            return segment.key === key
          })

        if (!isKnownSegment) return

        defaultMap[key] =
          row.is_visible !== false
      })

      modelSegmentVisibilityMap = defaultMap
      modelSegmentVisibilityLoadedModel = numericModelId
      modelSegmentVisibilityLoadedAt = Date.now()

      return modelSegmentVisibilityMap
    })()

  try {
    return await modelSegmentVisibilityLoadPromise
  } finally {
    modelSegmentVisibilityLoadPromise = null
  }
}

function isAdminSegmentVisibleForModel(
  segmentKey,
  modelMap = null
) {
  const map =
    modelMap ||
    modelSegmentVisibilityMap ||
    {}

  return map[segmentKey] !== false
}

function getVisibleAdminSegmentsForModel(
  modelMap = null
) {
  const map =
    modelMap ||
    modelSegmentVisibilityMap ||
    {}

  return ALL_GAME_SEGMENTS.filter(segment => {
    return isAdminSegmentVisibleForModel(
      segment.key,
      map
    )
  })
}

function buildModelSegmentVisibilitySection(
  visibility = {}
) {
  const sortedSegments =
    [...ALL_GAME_SEGMENTS].sort((a, b) => {
      return Number(a.sort || 0) - Number(b.sort || 0)
    })

  return `
    <section class="adminModelVisibilitySection">
      <div class="adminModelVisibilityHead">
        <div>
          <h2>إعداد ظهور الفقرات داخل النموذج</h2>
          <span>الفقرات المفعّلة هنا هي نفسها التي تظهر في صفحة البداية عند اختيار هذا النموذج</span>
        </div>
      </div>

      <div class="adminModelVisibilityGrid">
        ${sortedSegments.map(segment => {
          const enabled =
            isAdminSegmentVisibleForModel(
              segment.key,
              visibility
            )

          return `
            <button
              type="button"
              class="adminModelVisibilityCard ${enabled ? "isEnabled" : "isDisabled"}"
              onclick="toggleModelSegmentVisibility('${segment.key}')"
            >
              <span class="adminModelVisibilityTitle">
                ${escapeHtml(segment.title)}
              </span>

              <span class="adminModelVisibilitySwitch">
                <span></span>
              </span>
            </button>
          `
        }).join("")}
      </div>
    </section>
  `
}


async function openModelSegmentVisibilityPanel() {
  if (!currentModel) {
    showGameToast(
      "افتح نموذج أولاً",
      "warning"
    )

    return false
  }

  document
    .getElementById("modelSegmentVisibilityModal")
    ?.remove()

  document.body.insertAdjacentHTML(
    "beforeend",
    `
      <div
        class="adminModalOverlay"
        id="modelSegmentVisibilityModal"
      >
        <div class="adminModalCard adminModelVisibilityModal">

          <div class="adminModalTitle">
            ظهور الفقرات داخل النموذج
          </div>

          <div
            id="modelSegmentVisibilityModalBody"
            class="adminModelVisibilityModalBody"
          >
            <div class="adminEmptyState">
              جاري تحميل الفقرات...
            </div>
          </div>

          <div class="adminModalActions">
            <button
              type="button"
              class="adminBtn adminBtnLight"
              onclick="closeModelSegmentVisibilityPanel()"
            >
              إغلاق
            </button>
          </div>

        </div>
      </div>
    `
  )

  const modal =
    document.getElementById(
      "modelSegmentVisibilityModal"
    )

  if (modal) {
    modal.addEventListener("click", event => {
      if (event.target === modal) {
        closeModelSegmentVisibilityPanel()
      }
    })
  }

  await loadModelSegmentVisibilityMap(
    currentModel,
    true
  )

  renderModelSegmentVisibilityPanel()

  return true
}

function closeModelSegmentVisibilityPanel() {
  document
    .getElementById("modelSegmentVisibilityModal")
    ?.remove()
}

function renderModelSegmentVisibilityPanel() {
  const body =
    document.getElementById(
      "modelSegmentVisibilityModalBody"
    )

  if (!body) return

  body.innerHTML =
    buildModelSegmentVisibilitySection(
      modelSegmentVisibilityMap
    )
}

async function toggleModelSegmentVisibility(
  segmentKey
) {
  const key =
    String(segmentKey || "").trim()

  if (!key || !currentModel) {
    return false
  }

  const current =
    isAdminSegmentVisibleForModel(key)

  const next =
    !current

  const isKnownSegment =
    ALL_GAME_SEGMENTS.some(segment => {
      return segment.key === key
    })

  if (!isKnownSegment) {
    showGameToast(
      "مفتاح الفقرة غير معروف",
      "error"
    )

    return false
  }

  const result = await dbUpsert(
    "visible_segments",
    {
      model: Number(currentModel),
      segment_key: key,
      is_visible: Boolean(next),
      sort_order:
        ALL_GAME_SEGMENTS.find(segment => {
          return segment.key === key
        })?.sort || 0,
      updated_at: new Date().toISOString()
    },
    {
      onConflict: "model,segment_key",
      logLabel: "SAVE MODEL VISIBLE SEGMENT"
    }
  )

  if (!result.ok) {
    console.log(
      "SAVE MODEL VISIBLE SEGMENT ERROR:",
      result.error
    )

    showGameToast(
      "تعذر حفظ ظهور الفقرة",
      "error"
    )

    return false
  }

  if (typeof window.invalidateModelCache === "function") {
    window.invalidateModelCache(currentModel)
  }

  try {
    localStorage.removeItem(
      `intro_visible_segments:${Number(currentModel)}`
    )
  } catch {}

await loadModelSegmentVisibilityMap(
  currentModel,
  true
)

renderModelSegmentVisibilityPanel()

await renderAdminHome()

  showGameToast(
    next
      ? "تم تفعيل الفقرة داخل النموذج"
      : "تم إخفاء الفقرة داخل النموذج",
    "success"
  )

  return true
}

async function loadGlobalSegmentVisibilityMap(
  forceRefresh = false
) {
  const now = Date.now()

  const hasCachedMap =
    globalSegmentVisibilityMap &&
    Object.keys(
      globalSegmentVisibilityMap
    ).length > 0

  const cacheStillValid =
    hasCachedMap &&
    now -
      globalSegmentVisibilityLoadedAt <
      GLOBAL_SEGMENT_VISIBILITY_CACHE_MS

  if (
    !forceRefresh &&
    cacheStillValid
  ) {
    return globalSegmentVisibilityMap
  }

  if (
    !forceRefresh &&
    globalSegmentVisibilityLoadPromise
  ) {
    return globalSegmentVisibilityLoadPromise
  }

  globalSegmentVisibilityLoadPromise =
    (async () => {
      const defaultMap = {}

      ALL_GAME_SEGMENTS.forEach(
        segment => {
          defaultMap[segment.key] = true
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

        globalSegmentVisibilityLoadedAt =
          Date.now()

        return globalSegmentVisibilityMap
      }

      ;(result.data || []).forEach(
        row => {
          const key =
            String(
              row.segment_key || ""
            ).trim()

          if (!key) {
            return
          }

          const isKnownSegment =
            ALL_GAME_SEGMENTS.some(segment => {
              return segment.key === key
            })

          if (!isKnownSegment) {
            return
          }

          defaultMap[key] =
            row.is_enabled !== false
        }
      )

      globalSegmentVisibilityMap =
        defaultMap

      globalSegmentVisibilityLoadedAt =
        Date.now()

      return globalSegmentVisibilityMap
    })()

  try {
    return await globalSegmentVisibilityLoadPromise
  } finally {
    globalSegmentVisibilityLoadPromise =
      null
  }
}

function isAdminSegmentGloballyEnabled(
  segmentKey,
  globalMap = null
) {
  const map =
    globalMap ||
    globalSegmentVisibilityMap ||
    {}

  return map[segmentKey] !== false
}

function getVisibleAdminSegments(globalMap = null) {
  const map =
    globalMap ||
    globalSegmentVisibilityMap ||
    {}

  return ALL_GAME_SEGMENTS.filter(segment => {
    return isAdminSegmentGloballyEnabled(
      segment.key,
      map
    )
  })
}

function getHiddenAdminSegments(globalMap = null) {
  const map =
    globalMap ||
    globalSegmentVisibilityMap ||
    {}

  return ALL_GAME_SEGMENTS.filter(segment => {
    return !isAdminSegmentGloballyEnabled(
      segment.key,
      map
    )
  })
}

async function setGlobalSegmentEnabled(
  segmentKey,
  enabled
) {
  const key =
    String(segmentKey || "").trim()

  if (!key) {
    return false
  }

    const isKnownSegment =
    ALL_GAME_SEGMENTS.some(segment => {
      return segment.key === key
    })

  if (!isKnownSegment) {
    showGameToast(
      "مفتاح الفقرة غير معروف",
      "error"
    )

    return false
  }

  const segmentTitle =
    getAdminSegmentTitle(key)

  const confirmed =
    await showAdminConfirm(
      enabled
        ? `هل تريد تفعيل فقرة "${segmentTitle}" عام؟`
        : `هل تريد تعطيل فقرة "${segmentTitle}" عام؟`,
      {
        title: enabled
          ? "تفعيل الفقرة"
          : "إخفاء الفقرة",

        okText: enabled
          ? "تفعيل"
          : "إخفاء",

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
      console.log(
        "SAVE GLOBAL SEGMENT VISIBILITY ERROR:",
        result.error
      )

      showGameToast(
        "تعذر حفظ حالة الفقرة",
        "error"
      )

      return false
    }

    await loadGlobalSegmentVisibilityMap(true)

    showGameToast(
      enabled
        ? "تم تفعيل الفقرة"
        : "تم تعطيل الفقرة",
      "success"
    )

    return true
  } catch (error) {
    console.log(
      "SAVE GLOBAL SEGMENT VISIBILITY CATCH:",
      error
    )

    showGameToast(
      "حدث خطأ أثناء حفظ حالة الفقرة",
      "error"
    )

    return false
  }
}

async function toggleAdminSegmentVisibility(
  segmentKey,
  nextValue
) {
  return setGlobalSegmentEnabled(
    segmentKey,
    nextValue
  )
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

  return limits[segment] || {
    fallback: 4,
    min: 1,
    max: 8,
    allowed: []
  }
}

function normalizeAdminSegmentCount(
  segment,
  value
) {
  const limit =
    getAdminSettingLimit(segment)

  const parsedValue =
    Number(value)

  const number =
    Number.isFinite(parsedValue)
      ? parsedValue
      : limit.fallback

  if (limit.allowed.length) {
    return limit.allowed.includes(number)
      ? number
      : limit.fallback
  }

  return Math.min(
    Math.max(number, limit.min),
    limit.max
  )
}

function normalizeAdminRoundCount(
  value,
  fallback = 3,
  max = 4
) {
  const parsedValue =
    Number(value)

  const number =
    Number.isFinite(parsedValue)
      ? parsedValue
      : fallback

  return Math.min(
    Math.max(number, 1),
    max
  )
}

/* =========================
   12) Segment Round Count
========================= */

async function getSegmentRoundCount(
  segment,
  fallback = 3,
  max = 4
) {
  if (!currentModel) {
    return fallback
  }

  const result = await dbSelect(
    "segment_settings",
    query =>
      query
        .eq("model", Number(currentModel))
        .eq("segment", segment)
        .maybeSingle(),
    {
      select: "item_count",
      fallback: null,
      logLabel: "GET SEGMENT ROUND COUNT"
    }
  )

  if (!result.ok) {
    console.log(
      "GET SEGMENT ROUND COUNT ERROR:",
      result.error
    )

    return fallback
  }

  return normalizeAdminRoundCount(
    result.data?.item_count,
    fallback,
    max
  )
}

async function saveSegmentRoundCount(
  segment,
  count
) {
  if (!currentModel) {
    return false
  }

  const safeCount =
    normalizeAdminRoundCount(
      count,
      1,
      4
    )

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
    console.log(
      "SAVE SEGMENT ROUND COUNT ERROR:",
      result.error
    )

    showGameToast(
      "تعذر حفظ عدد الجولات",
      "error"
    )

    return false
  }

  return true
}

/* =========================
   13) Segment Item Count
========================= */

async function getAdminSegmentCount(segment) {
  const limit =
    getAdminSettingLimit(segment)

  if (!currentModel) {
    return limit.fallback
  }

  const result = await dbSelect(
    "segment_settings",
    query =>
      query
        .eq("model", Number(currentModel))
        .eq("segment", segment)
        .maybeSingle(),
    {
      select: "item_count",
      fallback: null,
      logLabel: "GET ADMIN SEGMENT COUNT"
    }
  )

  if (!result.ok) {
    console.log(
      "GET ADMIN SEGMENT COUNT ERROR:",
      result.error
    )

    return limit.fallback
  }

  return normalizeAdminSegmentCount(
    segment,
    result.data?.item_count
  )
}

async function saveAdminSegmentCount(
  segment,
  count
) {
  if (!currentModel) {
    showGameToast(
      "افتح النموذج أولاً",
      "warning"
    )

    return false
  }

  const safeCount =
    normalizeAdminSegmentCount(
      segment,
      count
    )

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
    console.log(
      "SAVE ADMIN SEGMENT COUNT ERROR:",
      result.error
    )

    showGameToast(
      "تعذر حفظ إعدادات الفقرة",
      "error"
    )

    return false
  }

  return true
}

function updateAdminQuickSettingUI(
  segment,
  count
) {
  const safeCount =
    normalizeAdminSegmentCount(
      segment,
      count
    )

  if (
    segment === "auction" &&
    typeof auctionAdminCount !==
      "undefined"
  ) {
    auctionAdminCount = safeCount
  }

  if (
    segment === "who" &&
    typeof whoAdminCount !==
      "undefined"
  ) {
    whoAdminCount = safeCount
  }

  if (
    segment === "finalRound1" &&
    typeof finalRound1AdminCount !==
      "undefined"
  ) {
    finalRound1AdminCount =
      safeCount
  }

  if (
    segment === "explain" &&
    typeof explainAdminCount !==
      "undefined"
  ) {
    explainAdminCount = safeCount
  }

  if (
    segment === "finalRound3" &&
    typeof finalRound3AdminCount !==
      "undefined"
  ) {
    finalRound3AdminCount =
      safeCount
  }

  if (
    segment === "finalRound4" &&
    typeof finalRound4AdminCount !==
      "undefined"
  ) {
    finalRound4AdminCount =
      safeCount
  }

  return safeCount
}

async function setAdminSegmentCount(
  segment,
  count
) {
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

  try {
    setAdminSaving(
      true,
      "جارٍ حفظ الإعداد..."
    )

    const safeCount =
      normalizeAdminSegmentCount(
        segment,
        count
      )

    const saved =
      await saveAdminSegmentCount(
        segment,
        safeCount
      )

    if (!saved) {
      return false
    }

    updateAdminQuickSettingUI(
      segment,
      safeCount
    )

    showGameToast(
      "تم حفظ الإعداد",
      "success"
    )

    if (
      currentAdminSegment === segment
    ) {
      await openAdminSegment(segment)
    }

    return true
  } catch (error) {
    console.log(
      "SET ADMIN SEGMENT COUNT ERROR:",
      error
    )

    showGameToast(
      "تعذر حفظ الإعداد",
      "error"
    )

    return false
  } finally {
    setAdminSaving(false)
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
      ".top10RoundCountBox, .whoCountBox, .explainCountBox, .finalTopCompactCountBox, .archiveRoundsControl"
    )
    .forEach(el => el.remove())

  area
    .querySelectorAll(
      ".top10ControlPanel, .whoControlPanel, .explainControlPanel, .archiveAdminControlBar, .finalTopCompactRow"
    )
    .forEach(row => {
      if (!row.children.length) row.remove()
    })

  toolsRow.querySelectorAll("button").forEach(btn => {
    btn.classList.remove("innerTabActive")

    if (
      btn.classList.contains("activeWarmupCategoryTab") ||
      btn.classList.contains("activeTop10RoundTab") ||
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

  if (!area) {
    return
  }

  area
    .querySelectorAll(
      `
        .adminCard,
        .adminQuestionCard,
        .finalAdminCard,
        .archiveMainInfoCard,
        .archiveImageCard
      `
    )
    .forEach(card => {
      card.classList.add(
        "adminEditorCleanCard"
      )
    })

  area
    .querySelectorAll("textarea")
    .forEach(textarea => {
      textarea.classList.add(
        "adminCleanTextarea"
      )
    })

  area
    .querySelectorAll(
      `
        input:not([type="file"]),
        select
      `
    )
    .forEach(input => {
      input.classList.add(
        "adminCleanInput"
      )
    })

  area
    .querySelectorAll(
      'input[type="file"]'
    )
    .forEach(input => {
      input.classList.add(
        "adminCleanFile"
      )
    })

  area
    .querySelectorAll("img")
    .forEach(image => {
      image.loading = "lazy"
      image.decoding = "async"

      image.setAttribute(
        "fetchpriority",
        "low"
      )
    })

  area
    .querySelectorAll("video")
    .forEach(video => {
      video.preload = "metadata"

      video.setAttribute(
        "playsinline",
        ""
      )
    })
}

/* =========================
   10) Admin Home Counts
========================= */

async function getAdminCompletionCounts() {
  const result = {
    warmup: 0,
    top10: 0,
    who: 0,
    explain: 0,
    letterli: 1,

    finalRound1: 0,
    finalRound2: 0,
    finalRound3: 0,
    finalRound4: 0,

    archive: 0,
    randomChallenge: 0,

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

  const modelId = Number(currentModel)

  const [
    qWarmup,
    qTop10,
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
    dbSelect(
      "questions",
      query =>
        query
          .eq("model", modelId)
          .eq("segment", "warmup"),
      {
        select: "id",
        count: "exact",
        head: true,
        fallback: [],
        logLabel: "ADMIN COMPLETION WARMUP"
      }
    ),

    dbSelect(
      "top10_questions",
      query =>
        query.eq("model", modelId),
      {
        select: "id",
        count: "exact",
        head: true,
        fallback: [],
        logLabel: "ADMIN COMPLETION TOP10"
      }
    ),

    dbSelect(
      "who_images",
      query =>
        query.eq("model", modelId),
      {
        select: "id",
        count: "exact",
        head: true,
        fallback: [],
        logLabel: "ADMIN COMPLETION WHO"
      }
    ),

    dbSelect(
      "explain_words",
      query =>
        query.eq("model", modelId),
      {
        select: "id",
        count: "exact",
        head: true,
        fallback: [],
        logLabel: "ADMIN COMPLETION EXPLAIN"
      }
    ),

    dbSelect(
      "final_round1_items",
      query =>
        query
          .eq("model", modelId)
          .gte("number", 1)
          .lte("number", 9),
      {
        select: "id",
        count: "exact",
        head: true,
        fallback: [],
        logLabel: "ADMIN COMPLETION FINAL ROUND 1"
      }
    ),

    dbSelect(
      "final_round2_items",
      query =>
        query
          .eq("model", modelId)
          .in("number", [1, 2, 4, 5]),
      {
        select: "id",
        count: "exact",
        head: true,
        fallback: [],
        logLabel: "ADMIN COMPLETION FINAL ROUND 2"
      }
    ),

    dbSelect(
      "final_round3_items",
      query =>
        query
          .eq("model", modelId)
          .in("number", [101, 102]),
      {
        select: "id",
        count: "exact",
        head: true,
        fallback: [],
        logLabel: "ADMIN COMPLETION FINAL ROUND 2 IMAGES"
      }
    ),

    dbSelect(
      "final_round1_items",
      query =>
        query
          .eq("model", modelId)
          .gte("number", 201)
          .lte("number", 209),
      {
        select: "id",
        count: "exact",
        head: true,
        fallback: [],
        logLabel: "ADMIN COMPLETION FINAL ROUND 3"
      }
    ),

    dbSelect(
      "final_round3_items",
      query =>
        query
          .eq("model", modelId)
          .gte("number", 1)
          .lte("number", 9)
          .eq("image_order", 1),
      {
        select: "id",
        count: "exact",
        head: true,
        fallback: [],
        logLabel: "ADMIN COMPLETION FINAL ROUND 4"
      }
    ),

    dbSelect(
      "archive_boxes",
      query =>
        query.eq("model", modelId),
      {
        select: "id",
        count: "exact",
        head: true,
        fallback: [],
        logLabel: "ADMIN COMPLETION ARCHIVE"
      }
    ),

    dbSelect(
      "segment_settings",
      query =>
        query
          .eq("model", modelId)
          .eq("segment", "top10")
          .maybeSingle(),
      {
        select: "item_count",
        fallback: null,
        logLabel: "ADMIN TOP10 SETTING"
      }
    ),

    dbSelect(
      "segment_settings",
      query =>
        query
          .eq("model", modelId)
          .eq("segment", "auction")
          .maybeSingle(),
      {
        select: "item_count",
        fallback: null,
        logLabel: "ADMIN AUCTION SETTING"
      }
    ),

    dbSelect(
      "segment_settings",
      query =>
        query
          .eq("model", modelId)
          .eq("segment", "archive")
          .maybeSingle(),
      {
        select: "item_count",
        fallback: null,
        logLabel: "ADMIN ARCHIVE SETTING"
      }
    ),

    dbSelect(
      "segment_settings",
      query =>
        query
          .eq("model", modelId)
          .eq("segment", "who")
          .maybeSingle(),
      {
        select: "item_count",
        fallback: null,
        logLabel: "ADMIN WHO SETTING"
      }
    ),

    dbSelect(
      "segment_settings",
      query =>
        query
          .eq("model", modelId)
          .eq("segment", "finalRound1")
          .maybeSingle(),
      {
        select: "item_count",
        fallback: null,
        logLabel: "ADMIN FINAL ROUND 1 SETTING"
      }
    ),

    dbSelect(
      "segment_settings",
      query =>
        query
          .eq("model", modelId)
          .eq("segment", "explain")
          .maybeSingle(),
      {
        select: "item_count",
        fallback: null,
        logLabel: "ADMIN EXPLAIN SETTING"
      }
    ),

    dbSelect(
      "segment_settings",
      query =>
        query
          .eq("model", modelId)
          .eq("segment", "finalRound3")
          .maybeSingle(),
      {
        select: "item_count",
        fallback: null,
        logLabel: "ADMIN FINAL ROUND 3 SETTING"
      }
    ),

    dbSelect(
      "segment_settings",
      query =>
        query
          .eq("model", modelId)
          .eq("segment", "finalRound4")
          .maybeSingle(),
      {
        select: "item_count",
        fallback: null,
        logLabel: "ADMIN FINAL ROUND 4 SETTING"
      }
    )
  ])

  result.warmup = qWarmup.count || 0
  result.top10 = qTop10.count || 0
  result.who = qWho.count || 0
  result.explain = qExplain.count || 0
  result.finalRound1 = qFinalRound1.count || 0

  result.finalRound2 =
    Number(qFinalRound2.count || 0) +
    Number(qFinalRound2Images.count || 0)

  result.finalRound3 =
    qFinalRound3Story.count || 0

  result.finalRound4 =
    qFinalRound4Focus.count || 0

  result.archive =
    qArchive.count || 0

  result.top10RoundsCount =
    Math.min(
      Math.max(
        Number(
          top10Setting.data?.item_count || 3
        ),
        1
      ),
      4
    )

  result.auctionCount =
    normalizeRandomChallengeAuctionCount(
      auctionSetting.data?.item_count || 5
    )

  result.archiveRoundsCount =
    Math.min(
      Math.max(
        Number(
          archiveSetting.data?.item_count || 4
        ),
        1
      ),
      4
    )

  result.whoCount =
    normalizeAdminSegmentCount(
      "who",
      whoSetting.data?.item_count || 15
    )

  result.finalRound1CardsCount =
    normalizeAdminSegmentCount(
      "finalRound1",
      finalRound1Setting.data?.item_count || 7
    )

  result.explainCount =
    normalizeAdminSegmentCount(
      "explain",
      explainSetting.data?.item_count || 5
    )

  result.finalRound3Count =
    normalizeAdminSegmentCount(
      "finalRound3",
      finalRound3Setting.data?.item_count || 5
    )

  result.finalRound4Count =
    normalizeAdminSegmentCount(
      "finalRound4",
      finalRound4Setting.data?.item_count || 5
    )

  return result
}

function isSegmentDone(key, count, counts = {}) {
  if (key === "warmup") {
    return count >= 12
  }

  if (key === "top10") {
    const rounds = Math.min(
      Math.max(
        Number(
          counts.top10RoundsCount || 3
        ),
        1
      ),
      4
    )

    return count >= rounds * 10
  }

if (key === "letterli") {
  return true
}

  if (key === "who") {
    const total =
      normalizeAdminSegmentCount(
        "who",
        counts.whoCount || 15
      )

    return count >= total
  }

  if (key === "explain") {
    const total =
      normalizeAdminSegmentCount(
        "explain",
        counts.explainCount || 5
      )

    return count >= total
  }

  if (key === "finalRound1") {
    const total =
      normalizeAdminSegmentCount(
        "finalRound1",
        counts.finalRound1CardsCount || 7
      )

    return count >= total
  }

  if (key === "finalRound2") {
    return count >= 34
  }

  if (key === "finalRound3") {
    const total =
      normalizeAdminSegmentCount(
        "finalRound3",
        counts.finalRound3Count || 5
      )

    return count >= total
  }

  if (key === "finalRound4") {
    const total =
      normalizeAdminSegmentCount(
        "finalRound4",
        counts.finalRound4Count || 5
      )

    return count >= total
  }

  if (key === "archive") {
    const rounds = Math.min(
      Math.max(
        Number(
          counts.archiveRoundsCount || 4
        ),
        1
      ),
      4
    )

    return count >= rounds
  }

  if (key === "randomChallenge") {
  return (
    counts.randomChallengeReady ===
      true ||
    Number(count || 0) >= 1
  )
}

  return false
}

/* =========================
   11) Admin Home
========================= */
async function renderAdminHome() {
  const area = editor()

  if (!area) {
    return false
  }

  renderAdminHomeActions()
  currentAdminSegment = "home"

  if (!currentModel) {
    area.innerHTML = `
      <div class="adminEmptyState">
        افتح نموذجًا أولاً ثم اختر الفقرة التي تريد تعديلها
      </div>
    `

    scheduleAdminTabsRefresh()

    return false
  }

  try {
    scheduleAdminTabsRefresh()

const [
  counts,
  visibility
] = await Promise.all([
  getAdminCompletionCounts(),
  loadModelSegmentVisibilityMap(
    currentModel
  )
])


const visibleSegments =
  getVisibleAdminSegmentsForModel(visibility)
    .sort((a, b) => {
      return (
        Number(a.sort || 0) -
        Number(b.sort || 0)
      )
    })

    const hasRandomChallenge =
      visibleSegments.some(segment => {
        return (
          segment.key ===
          "randomChallenge"
        )
      })

    counts.randomChallengeReady = false
    counts.randomChallenge = 0

    if (hasRandomChallenge) {
      try {
        if (
          typeof checkRandomChallengeReady ===
          "function"
        ) {
          const challengeStatus =
            await checkRandomChallengeReady()

          counts.randomChallengeReady =
            challengeStatus?.ok === true

          counts.randomChallenge =
            counts.randomChallengeReady
              ? 1
              : 0
        } else {
          console.error(
            "Missing function: checkRandomChallengeReady"
          )
        }
      } catch (error) {
        console.error(
          "ADMIN HOME RANDOM CHALLENGE STATUS ERROR:",
          error
        )

        counts.randomChallengeReady = false
        counts.randomChallenge = 0
      }
    }

    const readyCount =
      visibleSegments.filter(segment => {
        const done =
          Number(
            counts[segment.key] || 0
          )

        return isSegmentDone(
          segment.key,
          done,
          counts
        )
      }).length

    const enabledCount =
      visibleSegments.length

    const cards =
      visibleSegments
        .map(segment => {
          const key =
            String(segment.key || "")

          const title =
            segment.title ||
            getAdminSegmentTitle(key)

          const rawDone =
            Number(
              counts[key] || 0
            )

          const total =
            getAdminSegmentRequiredCount(
              key,
              counts
            )

          const done =
            total > 0
              ? Math.min(
                  rawDone,
                  total
                )
              : rawDone
const isRandomChallenge =
  key === "randomChallenge"

const isLetterli =
  key === "letterli"

const isDone =
  isSegmentDone(
    key,
    done,
    counts
  )

const isEnabled =
  visibility[key] !== false

const progressText =
  isLetterli
    ? "بدون إعداد"
    : isRandomChallenge
      ? isDone
        ? "المحتوى جاهز"
        : "يحتاج مراجعة"
      : total > 0
        ? `${done}/${total}`
        : String(done)

const progressWidth =
  isLetterli
    ? 100
    : isRandomChallenge
      ? isDone
        ? 100
        : 0
      : total > 0
        ? Math.min(
            Math.max(
              (done / total) * 100,
              0
            ),
            100
          )
        : 0

const openAction =
  isLetterli
    ? "showLetterliAdminInfo()"
    : `openAdminSegment('${key}')`

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
                ${isEnabled ? "" : "disabled"}
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

    const modelCompleted =
      visibleSegments.length > 0 &&
      readyCount === visibleSegments.length

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
              ${
                modelCompleted
                  ? "مكتمل"
                  : visibleSegments.length
                    ? "قيد التحرير"
                    : "لا توجد فقرات"
              }
            </strong>
          </div>

        </section>

        <section class="adminHomeSection adminHomeSectionClean">

<section class="adminHomeSection adminHomeSectionClean">

  ${
    cards
      ? `
        <div class="adminHomeSegmentsGrid">
          ${cards}
        </div>
      `
      : `
        <div class="adminEmptyState">
          لا توجد فقرات مفعّلة حاليًا
        </div>
      `
  }

</section>

      </div>
    `

    return true
  } catch (error) {
    console.error(
      "RENDER ADMIN HOME ERROR:",
      error
    )

    area.innerHTML = `
      <div class="adminEmptyState">
        تعذر تحميل الصفحة الرئيسية للأدمن
      </div>
    `

    showGameToast(
      "تعذر تحميل بيانات النموذج",
      "error"
    )

    return false
  }
}

function getAdminSegmentRequiredCount(
  key,
  counts = {}
) {
  if (key === "warmup") {
    return 12
  }

  if (key === "top10") {
    const rounds = Math.min(
      Math.max(
        Number(
          counts.top10RoundsCount || 3
        ),
        1
      ),
      4
    )

    return rounds * 10
  }


  if (key === "letterli") {
    return 1
  }

  if (key === "who") {
    return normalizeAdminSegmentCount(
      "who",
      counts.whoCount || 15
    )
  }

  if (key === "explain") {
    return normalizeAdminSegmentCount(
      "explain",
      counts.explainCount || 5
    )
  }

  if (key === "finalRound1") {
    return normalizeAdminSegmentCount(
      "finalRound1",
      counts.finalRound1CardsCount || 7
    )
  }

  if (key === "finalRound2") {
    return 34
  }

  if (key === "finalRound3") {
    return normalizeAdminSegmentCount(
      "finalRound3",
      counts.finalRound3Count || 5
    )
  }

  if (key === "finalRound4") {
    return normalizeAdminSegmentCount(
      "finalRound4",
      counts.finalRound4Count || 5
    )
  }

  if (key === "archive") {
    return Math.min(
      Math.max(
        Number(
          counts.archiveRoundsCount || 4
        ),
        1
      ),
      4
    )
  }

  if (key === "randomChallenge") {
    return 1
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

function buildAdminToggleSettingCard({
  key,
  title,
  desc,
  inputId,
  enabled
}) {
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

function toggleAdminChallengeSetting(
  inputId,
  button
) {
  const input =
    document.getElementById(inputId)

  if (!input || !button) return

  const enabled =
    input.value !== "1"

  input.value =
    enabled ? "1" : "0"

  button.classList.toggle(
    "active",
    enabled
  )

  button.innerText =
    enabled ? "مفعّل" : "معطّل"

  const card =
    button.closest(
      ".adminToggleSettingCard"
    )

  if (card) {
    card.classList.toggle(
      "isEnabled",
      enabled
    )

    card.classList.toggle(
      "isDisabled",
      !enabled
    )
  }

  if (
    inputId ===
    "settingsRandomAuctionEnabled"
  ) {
    const auctionCard =
      document.getElementById(
        "randomChallengeAuctionCard"
      )

    auctionCard
      ?.querySelectorAll(
        ".adminSettingGameOption"
      )
      .forEach(option => {
        option.disabled = !enabled
      })
  }
}

function buildAdminSettingCardPro({
  key,
  title,
  desc,
  inputId,
  value,
  options
}) {
  const hasValue =
    value !== "" &&
    value !== null &&
    typeof value !== "undefined" &&
    Number(value) > 0

  const displayValue =
    hasValue
      ? String(value)
      : "اختر"

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
          <strong>${escapeHtml(displayValue)}</strong>
        </div>

      </div>

      <div class="adminSettingGameOptions">
        ${options.map(option => `
          <button
            type="button"
            class="adminSettingGameOption ${
              hasValue &&
              Number(value) === Number(option)
                ? "selected"
                : ""
            }"
            onclick="selectAdminSettingOption(
              '${escapeHtml(inputId)}',
              ${Number(option)},
              this
            )"
          >
            ${Number(option)}
          </button>
        `).join("")}
      </div>

      <input
        type="hidden"
        id="${escapeHtml(inputId)}"
        value="${hasValue ? escapeHtml(String(value)) : ""}"
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

  scheduleAdminTabsRefresh()

  const [
  counts,
  visibility,
  challengeSettingsRes
] = await Promise.all([
  getAdminCompletionCounts(),

  loadGlobalSegmentVisibilityMap(),

  dbSelect(
    "segment_settings",
    query =>
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
  console.log(
    "LOAD RANDOM CHALLENGE SETTINGS ERROR:",
    challengeSettingsRes.error
  )
}

  const challengeMap = {}

  const isInitialSegmentSetup =
  currentModelSetupCompleted === false

function getInitialSettingValue(value) {
  return isInitialSegmentSetup
    ? ""
    : value
}

  ;(challengeSettingsRes.data || []).forEach(row => {
    challengeMap[row.segment] =
      Number(row.item_count || 0)
  })

    const challengeSettings = {
    box1:
      isInitialSegmentSetup
        ? false
        : challengeMap.randomChallengeBox1 !== 0,

    box2:
      isInitialSegmentSetup
        ? false
        : challengeMap.randomChallengeBox2 !== 0,

    box3:
      isInitialSegmentSetup
        ? false
        : challengeMap.randomChallengeBox3 !== 0,

    box4:
      isInitialSegmentSetup
        ? false
        : challengeMap.randomChallengeBox4 !== 0,

    auction:
      isInitialSegmentSetup
        ? false
        : challengeMap.randomChallengeAuction !== 0
  }

  const settings = [
    {
      key: "top10",
      title: "Top 10",
      desc: "عدد الجولات",
      inputId: "settingsTop10Rounds",
      value: getInitialSettingValue(
        Math.min(
          Math.max(
            Number(
              counts.top10RoundsCount || 3
            ),
            1
          ),
          4
        )
      ),
      options: [1, 2, 3, 4]
    },

    {
      key: "who",
      title: "من هو",
      desc: "عدد الأرقام",
      inputId: "settingsWhoCount",
      value: getInitialSettingValue(
        normalizeAdminSegmentCount(
          "who",
          counts.whoCount || 15
        )
      ),
      options: [10, 12, 15]
    },

    {
      key: "explain",
      title: "اشرح الكلمة",
      desc: "عدد الكلمات",
      inputId: "settingsExplainCount",
      value: getInitialSettingValue(
        normalizeAdminSegmentCount(
          "explain",
          counts.explainCount || 5
        )
      ),
      options: [5, 7, 9]
    },

    {
      key: "finalRound1",
      title: "ٮدوں ٮڡاط",
      desc: "عدد الأرقام",
      inputId: "settingsFinalRound1Count",
      value: getInitialSettingValue(
        normalizeAdminSegmentCount(
          "finalRound1",
          counts.finalRound1CardsCount || 7
        )
      ),
      options: [5, 7, 9]
    },

    {
      key: "finalRound3",
      title: "قصة",
      desc: "عدد الأرقام",
      inputId: "settingsFinalRound3Count",
      value: getInitialSettingValue(
        normalizeAdminSegmentCount(
          "finalRound3",
          counts.finalRound3Count || 5
        )
      ),
      options: [5, 7, 9]
    },

    {
      key: "finalRound4",
      title: "التركيز",
      desc: "عدد الأرقام",
      inputId: "settingsFinalRound4Count",
      value: getInitialSettingValue(
        normalizeAdminSegmentCount(
          "finalRound4",
          counts.finalRound4Count || 5
        )
      ),
      options: [5, 7, 9]
    },

    {
      key: "archive",
      title: "الأرشيف",
      desc: "عدد الجولات",
      inputId: "settingsArchiveRounds",
      value: getInitialSettingValue(
        Math.min(
          Math.max(
            Number(
              counts.archiveRoundsCount || 4
            ),
            1
          ),
          4
        )
      ),
      options: [1, 2, 3, 4]
    }
  ]

  const visibleSettings =
    settings.filter(item => {
      return isAdminSegmentGloballyEnabled(
        item.key,
        visibility
      )
    })

const auctionCount =
  isInitialSegmentSetup
    ? ""
    : normalizeRandomChallengeAuctionCount(
        counts.auctionCount || 5
      )

editor().innerHTML = `
  <div class="adminSettingsGamePage">

    <div class="adminSettingsGameGrid">
      ${visibleSettings
        .map(item =>
          buildAdminSettingCardPro(item)
        )
        .join("")}
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
          title: "صح أو خطأ",
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
            ${
              challengeSettings.auction
                ? "isEnabled"
                : "isDisabled"
            }
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
              class="adminSettingToggleBtn ${
                challengeSettings.auction
                  ? "active"
                  : ""
              }"
              onclick="toggleAdminChallengeSetting(
                'settingsRandomAuctionEnabled',
                this
              )"
            >
              ${
                challengeSettings.auction
                  ? "مفعّل"
                  : "معطّل"
              }
            </button>

          </div>

          <div class="adminChallengeAuctionCount">

            <div class="adminChallengeAuctionCountTitle">
              عدد الأرقام
            </div>

            <div class="adminSettingGameOptions adminChallengeAuctionOptions">
              ${[3, 5, 7].map(option => `
                <button
                  type="button"
                  class="adminSettingGameOption ${
                    auctionCount === option
                      ? "selected"
                      : ""
                  }"
                  onclick="selectAdminSettingOption(
                    'settingsAuctionCount',
                    ${option},
                    this
                  )"
                  ${
                    challengeSettings.auction
                      ? ""
                      : "disabled"
                  }
                >
                  ${option}
                </button>
              `).join("")}
            </div>

          </div>

          <input
            type="hidden"
            id="settingsRandomAuctionEnabled"
            value="${
              challengeSettings.auction
                ? "1"
                : "0"
            }"
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

  card.querySelectorAll(".adminSettingGameOption").forEach(item => {
    item.classList.remove("selected")
  })

  btn.classList.add("selected")

  const selected = card.querySelector(".adminSettingGameSelected strong")
  if (selected) selected.innerText = String(value)
}


async function saveAdminSegmentSettingsPage() {
  if (isAdminSaving(true)) {
    return false
  }

  if (!currentModel) {
    showGameToast(
      "افتح النموذج أولاً",
      "warning"
    )

    return false
  }

  try {
    setAdminSaving(
      true,
      "جارٍ حفظ الإعدادات..."
    )

    const model =
      Number(currentModel)

    const rows = []

    function addSetting(
      segment,
      itemCount
    ) {
      rows.push({
        model,
        segment,
        item_count:
          Number(itemCount || 0)
      })
    }

    function getSettingInput(id) {
      return document.getElementById(id)
    }
    
        const isInitialSegmentSetup =
      currentModelSetupCompleted === false

    function requireInitialSetting(
      id,
      label
    ) {
      const input =
        getSettingInput(id)

      if (
        !isInitialSegmentSetup ||
        !input
      ) {
        return true
      }

      if (!String(input.value || "").trim()) {
        showGameToast(
          "اكمل إعدادات الفقرات",
          "warning"
        )

        return false
      }

      return true
    }

    if (
      !requireInitialSetting(
        "settingsTop10Rounds",
        "عدد جولات Top 10"
      ) ||
      !requireInitialSetting(
        "settingsWhoCount",
        "عدد أرقام من هو"
      ) ||
      !requireInitialSetting(
        "settingsExplainCount",
        "عدد كلمات اشرح الكلمة"
      ) ||
      !requireInitialSetting(
        "settingsFinalRound1Count",
        "عدد أرقام بدون نقاط"
      ) ||
      !requireInitialSetting(
        "settingsFinalRound3Count",
        "عدد أرقام قصة"
      ) ||
      !requireInitialSetting(
        "settingsFinalRound4Count",
        "عدد أرقام التركيز"
      ) ||
      !requireInitialSetting(
        "settingsArchiveRounds",
        "عدد جولات الأرشيف"
      )
    ) {
      return false
    }

    const randomAuctionEnabled =
      getSettingInput(
        "settingsRandomAuctionEnabled"
      )

    const randomAuctionCountInput =
      getSettingInput(
        "settingsAuctionCount"
      )

    if (
      isInitialSegmentSetup &&
      randomAuctionEnabled?.value === "1" &&
      !String(randomAuctionCountInput?.value || "").trim()
    ) {
      showGameToast(
        "اكمل إعدادات الفقرات",
        "warning"
      )

      return false
    }

    const top10Input =
      getSettingInput(
        "settingsTop10Rounds"
      )

    if (top10Input) {
      addSetting(
        "top10",
        normalizeAdminRoundCount(
          top10Input.value,
          3,
          4
        )
      )
    }

    const auctionInput =
      getSettingInput(
        "settingsAuctionCount"
      )

    if (auctionInput) {
      addSetting(
        "auction",
        normalizeRandomChallengeAuctionCount(
          auctionInput.value
        )
      )
    }

    const whoInput =
      getSettingInput(
        "settingsWhoCount"
      )

    if (whoInput) {
      addSetting(
        "who",
        normalizeAdminSegmentCount(
          "who",
          whoInput.value
        )
      )
    }

    const explainInput =
      getSettingInput(
        "settingsExplainCount"
      )

    if (explainInput) {
      addSetting(
        "explain",
        normalizeAdminSegmentCount(
          "explain",
          explainInput.value
        )
      )
    }

    const finalRound1Input =
      getSettingInput(
        "settingsFinalRound1Count"
      )

    if (finalRound1Input) {
      addSetting(
        "finalRound1",
        normalizeAdminSegmentCount(
          "finalRound1",
          finalRound1Input.value
        )
      )
    }

    const finalRound3Input =
      getSettingInput(
        "settingsFinalRound3Count"
      )

    if (finalRound3Input) {
      addSetting(
        "finalRound3",
        normalizeAdminSegmentCount(
          "finalRound3",
          finalRound3Input.value
        )
      )
    }

    const finalRound4Input =
      getSettingInput(
        "settingsFinalRound4Count"
      )

    if (finalRound4Input) {
      addSetting(
        "finalRound4",
        normalizeAdminSegmentCount(
          "finalRound4",
          finalRound4Input.value
        )
      )
    }

    const archiveInput =
      getSettingInput(
        "settingsArchiveRounds"
      )

    if (archiveInput) {
      addSetting(
        "archive",
        normalizeAdminRoundCount(
          archiveInput.value,
          4,
          4
        )
      )
    }

    const challengeInputs = [
      {
        id:
          "settingsRandomBox1Enabled",
        segment:
          "randomChallengeBox1"
      },
      {
        id:
          "settingsRandomBox2Enabled",
        segment:
          "randomChallengeBox2"
      },
      {
        id:
          "settingsRandomBox3Enabled",
        segment:
          "randomChallengeBox3"
      },
      {
        id:
          "settingsRandomBox4Enabled",
        segment:
          "randomChallengeBox4"
      },
      {
        id:
          "settingsRandomAuctionEnabled",
        segment:
          "randomChallengeAuction"
      }
    ]

    challengeInputs.forEach(item => {
      const input =
        getSettingInput(item.id)

      if (!input) return

      addSetting(
        item.segment,
        input.value === "1"
          ? 1
          : 0
      )
    })

    if (!rows.length) {
      showGameToast(
        "لا توجد إعدادات للحفظ",
        "warning"
      )

      return false
    }

    const result =
      await dbUpsert(
        "segment_settings",
        rows,
        {
          onConflict:
            "model,segment",

          logLabel:
            "SAVE ADMIN SEGMENT SETTINGS PAGE"
        }
      )

    if (!result.ok) {
      console.error(
        "SAVE ADMIN SEGMENT SETTINGS PAGE ERROR:",
        result.error
      )

      showGameToast(
        "تعذر حفظ إعدادات الفقرات",
        "error"
      )

      return false
    }

    const setupResult =
      await dbUpdate(
        "models",
        {
          setup_completed: true
        },
        query =>
          query.eq(
            "id",
            model
          ),
        {
          logLabel:
            "MARK MODEL SETUP COMPLETED"
        }
      )

    if (!setupResult.ok) {
      console.error(
        "MARK MODEL SETUP COMPLETED ERROR:",
        setupResult.error
      )

      showGameToast(
        "تم حفظ الإعدادات لكن تعذر إكمال إعداد النموذج",
        "error"
      )

      return false
    }

    currentModelSetupCompleted = true

    const savedSettingsMap = {}

    rows.forEach(row => {
      savedSettingsMap[row.segment] =
        Number(row.item_count || 0)
    })

    if (
      Object.hasOwn(
        savedSettingsMap,
        "top10"
      ) &&
      typeof top10AdminRoundsCount !==
        "undefined"
    ) {
      top10AdminRoundsCount =
        savedSettingsMap.top10
    }

    if (
      Object.hasOwn(
        savedSettingsMap,
        "archive"
      ) &&
      typeof archiveAdminRoundsCount !==
        "undefined"
    ) {
      archiveAdminRoundsCount =
        savedSettingsMap.archive
    }

    ;[
      "auction",
      "who",
      "explain",
      "finalRound1",
      "finalRound3",
      "finalRound4"
    ].forEach(segment => {
      if (
        Object.hasOwn(
          savedSettingsMap,
          segment
        )
      ) {
        updateAdminQuickSettingUI(
          segment,
          savedSettingsMap[segment]
        )
      }
    })

    invalidateAdminHomeCache()

    showGameToast(
      "تم حفظ إعدادات الفقرات",
      "success"
    )

    await goAdminHome()

    return true
  } catch (error) {
    console.error(
      "SAVE ADMIN SEGMENT SETTINGS PAGE CATCH:",
      error
    )

    showGameToast(
      "حدث خطأ أثناء حفظ الإعدادات",
      "error"
    )

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
    letterli: "فقرة جاهزة بدون أسئلة من الأدمن",
    who: "صور وإجابات من هو",
    explain: "كلمات اشرح الكلمة",
    finalRound1: "فقرة من بدون نقط",
    finalRound2: "فقرة صح صحلي",
    finalRound3: "فقرة قصة",
    finalRound4: "فقرة التركيز",
    archive: "الأرشيف والجولات",
    randomChallenge: "مربعات وأسئلة التحدي"
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
    const visibility =
      await loadGlobalSegmentVisibilityMap()

    const results = []

    if (isAdminSegmentGloballyEnabled("warmup", visibility)) {
      results.push(await checkWarmupReady())
    }

    if (isAdminSegmentGloballyEnabled("top10", visibility)) {
      results.push(await checkTop10Ready())
    }

    if (isAdminSegmentGloballyEnabled("letterli", visibility)) {
      results.push(checkLetterliReady())
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

    if (isAdminSegmentGloballyEnabled("randomChallenge", visibility)) {
      results.push(await checkRandomChallengeReady())
    }

    renderModelCheckModal(results)
  } catch (err) {
    console.error("MODEL CHECK ERROR:", err)

    showGameToast(
      "تعذر فحص النموذج",
      "error"
    )
  }
}
/* =========================
   14) Ready Checks
========================= */

async function checkWarmupReady() {
  const warmupRes = await dbSelect(
    "questions",
    query =>
      query
        .eq("model", Number(currentModel))
        .eq("segment", "warmup"),
    {
      select: "*",
      fallback: [],
      logLabel: "CHECK WARMUP READY"
    }
  )

  if (!warmupRes.ok) {
    console.log(warmupRes.error)

    return readinessItem(
      "التسخين",
      false,
      ["تعذر قراءة بيانات التسخين"]
    )
  }

  const data = warmupRes.data
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

      if (!hasText(row.question)) {
        missing.push(`الفئة ${c} - سؤال ${n}: نص السؤال فارغ`)
      }

      if (!hasText(row.answer)) {
        missing.push(`الفئة ${c} - سؤال ${n}: الإجابة فارغة`)
      }
    }
  }

  return readinessItem(
    "التسخين",
    missing.length === 0,
    missing.length
      ? missing
      : ["12 سؤال مكتملة"]
  )
}

function checkLetterliReady() {
  return readinessItem(
    "حرفلي",
    true,
    ["الفقرة جاهزة بأسئلة ثابتة"]
  )
}

async function checkTop10Ready() {
  const maxRound =
    await getSegmentRoundCount("top10", 3, 4)

  const top10Res = await dbSelect(
    "top10_questions",
    query =>
      query
        .eq("model", Number(currentModel))
        .order("round", { ascending: true })
        .order("position", { ascending: true }),
    {
      select: "*",
      fallback: [],
      logLabel: "CHECK TOP10 READY"
    }
  )

  if (!top10Res.ok) {
    console.log(top10Res.error)

    return readinessItem(
      "Top 10",
      false,
      ["تعذر قراءة بيانات Top 10"]
    )
  }

  const data = top10Res.data
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

      if (!hasText(row.question)) {
        missing.push(`الجولة ${r}: السؤال الرئيسي فارغ`)
      }

      if (!hasText(row.answer)) {
        missing.push(`الجولة ${r} - الإجابة ${i} فارغة`)
      }
    }
  }

  return readinessItem(
    "Top 10",
    missing.length === 0,
    missing.length
      ? missing
      : [`مكتمل حسب عدد الجولات: ${maxRound}`]
  )
}

async function checkRandomChallengeReady() {
  const model =
    Number(currentModel)

  const requiredFatblaCount =
    await getAdminSegmentCount(
      "auction"
    )

  const [
    settingsResult,
    questionsResult,
    fatblaResult
  ] = await Promise.all([
    dbSelect(
      "segment_settings",
      query =>
        query
          .eq("model", model)
          .in("segment", [
            "randomChallengeBox1",
            "randomChallengeBox2",
            "randomChallengeBox3",
            "randomChallengeBox4",
            "randomChallengeAuction"
          ]),
      {
        select:
          "segment,item_count",

        fallback: [],

        logLabel:
          "CHECK RANDOM CHALLENGE SETTINGS"
      }
    ),

    dbSelect(
      "random_challenge_questions",
      query =>
        query
          .eq("model", model)
          .order(
            "box_key",
            { ascending: true }
          )
          .order(
            "number",
            { ascending: true }
          ),
      {
        select:
          "box_key,number,question,answer",

        fallback: [],

        logLabel:
          "CHECK RANDOM CHALLENGE QUESTIONS"
      }
    ),

    dbSelect(
      "auction_questions",
      query =>
        query
          .eq("model", model)
          .order(
            "number",
            { ascending: true }
          ),
      {
        select:
          "number,answer,image,video",

        fallback: [],

        logLabel:
          "CHECK RANDOM CHALLENGE FATBLA"
      }
    )
  ])

  if (!settingsResult.ok) {
    return readinessItem(
      "التحدي",
      false,
      ["تعذر قراءة إعدادات فقرة التحدي"]
    )
  }

  const settingsMap = {}

  ;(settingsResult.data || [])
    .forEach(row => {
      settingsMap[row.segment] =
        Number(row.item_count || 0)
    })

  function isChallengeBoxEnabled(
    settingKey
  ) {
    return settingsMap[settingKey] !== 0
  }

  const box1Enabled =
    isChallengeBoxEnabled(
      "randomChallengeBox1"
    )

  const box2Enabled =
    isChallengeBoxEnabled(
      "randomChallengeBox2"
    )

  const box3Enabled =
    isChallengeBoxEnabled(
      "randomChallengeBox3"
    )

  const box4Enabled =
    isChallengeBoxEnabled(
      "randomChallengeBox4"
    )

  const fatblaEnabled =
    isChallengeBoxEnabled(
      "randomChallengeAuction"
    )

  const anyQuestionBoxEnabled =
    box2Enabled ||
    box3Enabled ||
    box4Enabled

  if (
    anyQuestionBoxEnabled &&
    !questionsResult.ok
  ) {
    return readinessItem(
      "التحدي",
      false,
      ["تعذر قراءة أسئلة فقرة التحدي"]
    )
  }

  if (
    fatblaEnabled &&
    !fatblaResult.ok
  ) {
    return readinessItem(
      "التحدي",
      false,
      ["تعذر قراءة بيانات فتبلة"]
    )
  }

  const missing = []
  const enabledNames = []

  if (box1Enabled) {
    enabledNames.push(
      "اللاعب المشترك"
    )
  }

  const questionMap = {}

  ;(questionsResult.data || [])
    .forEach(row => {
      const key =
        `${String(row.box_key)}_` +
        `${Number(row.number)}`

      questionMap[key] = row
    })

  function validateQuestionBox({
    enabled,
    title,
    boxKey,
    count,
    requiresAnswer = false
  }) {
    if (!enabled) return

    enabledNames.push(title)

    for (
      let number = 1;
      number <= count;
      number++
    ) {
      const row =
        questionMap[
          `${boxKey}_${number}`
        ]

      if (!row) {
        missing.push(
          `${title} - السؤال ${number} غير موجود`
        )

        continue
      }

      if (!hasText(row.question)) {
        missing.push(
          `${title} - السؤال ${number}: النص فارغ`
        )
      }

      if (
        requiresAnswer &&
        !["صح", "خطأ"].includes(
          String(row.answer || "")
        )
      ) {
        missing.push(
          `${title} - السؤال ${number}: لم يتم تحديد صح أو خطأ`
        )
      }
    }
  }

  validateQuestionBox({
    enabled: box2Enabled,
    title: "المزاد",
    boxKey: "auction",
    count: 2
  })

  validateQuestionBox({
    enabled: box3Enabled,
    title: "ماذا تعرف",
    boxKey: "whatDoYouKnow",
    count: 2
  })

  validateQuestionBox({
    enabled: box4Enabled,
    title: "صح أو خطأ",
    boxKey: "trueFalse",
    count: 10,
    requiresAnswer: true
  })

  if (fatblaEnabled) {
    enabledNames.push("فتبلة")

    const fatblaMap = {}

    ;(fatblaResult.data || [])
      .forEach(row => {
        fatblaMap[
          Number(row.number)
        ] = row
      })

    for (
      let number = 1;
      number <= requiredFatblaCount;
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

  if (!enabledNames.length) {
    missing.push(
      "لا يوجد أي مربع مفعّل داخل فقرة التحدي"
    )
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
  const requiredCount =
    await getAdminSegmentCount("who")

  const whoRes = await dbSelect(
    "who_images",
    query =>
      query
        .eq("model", Number(currentModel))
        .order("number", {
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

    return readinessItem(
      "من هو",
      false,
      ["تعذر قراءة بيانات من هو"]
    )
  }

  const data = whoRes.data
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

    if (!hasText(row.image)) {
      missing.push(`العنصر ${i}: الصورة غير موجودة`)
    }

    if (!hasText(row.answer)) {
      missing.push(`العنصر ${i}: الإجابة فارغة`)
    }
  }

  return readinessItem(
    "من هو",
    missing.length === 0,
    missing.length
      ? missing
      : [`من هو مكتملة بعدد ${requiredCount} عنصر`]
  )
}

async function checkExplainReady() {
  const count =
    await getAdminSegmentCount("explain")

  const explainRes = await dbSelect(
    "explain_words",
    query =>
      query
        .eq("model", Number(currentModel))
        .order("number", {
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

    return readinessItem(
      "اشرح الكلمة",
      false,
      ["تعذر قراءة بيانات اشرح الكلمة"]
    )
  }

  const data = explainRes.data
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
    missing.length
      ? missing
      : [`مكتملة بعدد ${count} كلمات`]
  )
}

function getFinalRound1NoDotsCount(cardsCount) {
  const count = Number(cardsCount || 7)

  if (count === 5) return 5
  if (count === 9) return 9

  return 7
}

async function checkFinalRoundReady(round) {
  const [r1Res, r2Res, r3Res] = await Promise.all([
  dbSelect(
    "final_round1_items",
    query =>
      query.eq("model", Number(currentModel)),
    {
      select: "*",
      fallback: [],
      logLabel: "CHECK FINAL ROUND1 READY"
    }
  ),

  dbSelect(
    "final_round2_items",
    query =>
      query.eq("model", Number(currentModel)),
    {
      select: "*",
      fallback: [],
      logLabel: "CHECK FINAL ROUND2 READY"
    }
  ),

  dbSelect(
    "final_round3_items",
    query =>
      query.eq("model", Number(currentModel)),
    {
      select: "*",
      fallback: [],
      logLabel: "CHECK FINAL ROUND3 READY"
    }
  )
])

if (
  !r1Res.ok ||
  !r2Res.ok ||
  !r3Res.ok
) {
  console.log(
    r1Res.error ||
    r2Res.error ||
    r3Res.error
  )

  return readinessItem(
    `الجولة ${round}`,
    false,
    ["تعذر قراءة بيانات الجولة"]
  )
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

    if (
  number >= 201 &&
  number <= 209
) {
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
  dbSelect(
    "archive_boxes",
    query =>
      query.eq("model", Number(currentModel)),
    {
      select: "*",
      fallback: [],
      logLabel: "CHECK ARCHIVE BOXES READY"
    }
  ),

  dbSelect(
    "archive_items",
    query =>
      query.eq("model", Number(currentModel)),
    {
      select: "*",
      fallback: [],
      logLabel: "CHECK ARCHIVE ITEMS READY"
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

function buildNewModelSegmentsList() {
  const box =
    document.getElementById(
      "newModelSegmentsList"
    )

  if (!box) return

  box.innerHTML =
    ALL_GAME_SEGMENTS.map(segment => `
      <label class="adminSegmentMiniToggle">
        <input
          type="checkbox"
          class="newModelSegmentCheck"
          value="${escapeHtml(segment.key)}"
        >
        <span>${escapeHtml(segment.title)}</span>
      </label>
    `).join("")
}

function showAdminModelGateStart() {
  document
    .getElementById("adminModelGateStart")
    ?.classList.remove("hidden")

  document
    .getElementById("adminModelLoginBox")
    ?.classList.add("hidden")

  document
    .getElementById("adminModelCreateBox")
    ?.classList.add("hidden")
}

function showAdminModelLoginMode() {
  document
    .getElementById("adminModelGateStart")
    ?.classList.add("hidden")

  document
    .getElementById("adminModelLoginBox")
    ?.classList.remove("hidden")

  document
    .getElementById("adminModelCreateBox")
    ?.classList.add("hidden")

  loadModels()
}

function showAdminModelCreateMode() {
  document
    .getElementById("adminModelGateStart")
    ?.classList.add("hidden")

  document
    .getElementById("adminModelLoginBox")
    ?.classList.add("hidden")

  document
    .getElementById("adminModelCreateBox")
    ?.classList.remove("hidden")

  buildNewModelSegmentsList()
}

window.showAdminModelGateStart =
  showAdminModelGateStart

window.showAdminModelLoginMode =
  showAdminModelLoginMode

window.showAdminModelCreateMode =
  showAdminModelCreateMode



async function loadModels() {
  const result = await dbSelect(
    "models",
    query =>
      query.order(
        "id",
        {
          ascending: false
        }
      ),
    {
      logLabel: "LOAD MODELS"
    }
  )

  if (!result.ok) {
    showGameToast("تعذر تحميل النماذج")
    return
  }

  const list =
    document.getElementById(
      "modelsList"
    )

  if (!list) return

  const currentValue =
    currentModel
      ? String(currentModel)
      : ""

  list.innerHTML = `
    <option value="">
      اختر النموذج
    </option>
  `

  result.data.forEach(model => {
    const option =
      document.createElement(
        "option"
      )

    option.value =
      model.id

    option.textContent =
      model.name

    list.appendChild(option)
  })

  if (currentValue) {
    list.value =
      currentValue
  }
}

async function createModel() {
  const input =
    document.getElementById("modelName")

  const pinInput =
    document.getElementById("modelAdminPin")

  const pinConfirmInput =
    document.getElementById(
      "modelAdminPinConfirm"
    )

  const name =
    String(input?.value || "").trim()

  const adminPin =
    String(pinInput?.value || "").trim()

  const adminPinConfirm =
    String(pinConfirmInput?.value || "").trim()

  const selectedSegments =
    Array.from(
      document.querySelectorAll(
        ".newModelSegmentCheck:checked"
      )
    ).map(input => input.value)

  if (!name) {
    showGameToast("اكتب اسم النموذج")
    return
  }

  if (!adminPin) {
    showGameToast("اكتب الرقم السري للنموذج")
    return
  }

  if (adminPin !== adminPinConfirm) {
    showGameToast(
      "تأكيد الرقم السري غير مطابق",
      "warning"
    )
    return
  }

  if (!selectedSegments.length) {
    showGameToast(
      "اختر فقرة واحدة على الأقل",
      "warning"
    )
    return
  }

  const adminUser =
    await ensureAdminAnonymousSession()

  if (!adminUser?.id) {
    showGameToast(
      "تعذر التحقق من صلاحية الأدمن",
      "error"
    )
    return
  }

  const result = await dbInsert(
    "models",
    {
      name,
      admin_pin: adminPin,
      created_by_user_id: adminUser.id,
      setup_completed: false
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

  if (data?.id) {
    const segmentRows =
      ALL_GAME_SEGMENTS.map(segment => ({
        model: Number(data.id),
        segment_key: segment.key,
        is_visible:
          selectedSegments.includes(
            segment.key
          ),
        sort_order: segment.sort
      }))

    const visibleResult = await dbUpsert(
      "visible_segments",
      segmentRows,
      {
        onConflict: "model,segment_key",
        logLabel: "CREATE MODEL VISIBLE SEGMENTS"
      }
    )

    if (!visibleResult.ok) {
      console.log(
        "CREATE MODEL VISIBLE SEGMENTS ERROR:",
        visibleResult.error
      )

      showGameToast(
        "تم إنشاء النموذج لكن تعذر حفظ الفقرات المفعلة",
        "warning"
      )
    }

    unlockAdminModel(data.id)

    currentModel = data.id
    currentModelName = data.name || name
    currentModelSetupCompleted = false

    if (input) input.value = ""
    if (pinInput) pinInput.value = ""
    if (pinConfirmInput) pinConfirmInput.value = ""

    await loadModels()

    updateAdminBrandModel()
    showAdminWorkspace()
    renderAdminSettingsActions()

    await openAdminSegmentSettings()

    showGameToast(
      "تم إنشاء النموذج، أكمل إعدادات الفقرات",
      "success"
    )
  }
}

async function openSelectedModel() {
  const list =
    document.getElementById("modelsList")

  const id =
    Number(list?.value || 0)

  if (!id) {
    showGameToast("اختر النموذج")
    return
  }

  const optionName =
    list.options[list.selectedIndex]?.textContent ||
    `نموذج ${id}`

  const modelData =
    await requestAdminModelAccess(
      id,
      optionName
    )

  if (!modelData) return

  currentModel = id

  currentModelName =
    modelData.name || optionName

  currentModelSetupCompleted =
    modelData.setup_completed !== false

  updateAdminBrandModel()
  showAdminWorkspace()

  if (currentModelSetupCompleted === false) {
    renderAdminSettingsActions()

    await openAdminSegmentSettings()

    showGameToast(
      "أكمل إعدادات الفقرات أولاً",
      "warning"
    )

    return
  }

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

  const updateResult = await dbUpdate(
  "models",
  {
    name
  },
  query =>
    query.eq(
      "id",
      id
    ),
  {
    logLabel: "RENAME MODEL"
  }
)

if (!updateResult.ok) {
  console.log(
    updateResult.error
  )

  showGameToast(
    "تعذر تعديل اسم النموذج"
  )

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

function getAdminStoragePathFromUrl(url) {
  const value =
    String(url || "").trim()

  if (!value) return ""

  if (!/^https?:\/\//i.test(value)) {
    return value
      .split("?")[0]
      .replace(/^\/+/, "")
  }

  const publicMarker =
    `/storage/v1/object/public/${BUCKET_NAME}/`

  const signedMarker =
    `/storage/v1/object/sign/${BUCKET_NAME}/`

  let index =
    value.indexOf(publicMarker)

  let marker =
    publicMarker

  if (index < 0) {
    index = value.indexOf(signedMarker)
    marker = signedMarker
  }

  if (index < 0) {
    return ""
  }

  return decodeURIComponent(
    value
      .slice(index + marker.length)
      .split("?")[0]
      .replace(/^\/+/, "")
  )
}

async function deleteAdminStorageUrls(urls = []) {
  const paths =
    Array.from(
      new Set(
        []
          .concat(urls || [])
          .map(getAdminStoragePathFromUrl)
          .filter(Boolean)
      )
    )

  if (!paths.length) {
    return true
  }

  const chunks = []

  for (let i = 0; i < paths.length; i += 100) {
    chunks.push(paths.slice(i, i + 100))
  }

  for (const chunk of chunks) {
    const { error } =
      await db.storage
        .from(BUCKET_NAME)
        .remove(chunk)

    if (error) {
      console.error(
        "DELETE ADMIN STORAGE URLS ERROR:",
        error
      )

      showGameToast(
        "تعذر حذف بعض ملفات الصور والفيديو",
        "error"
      )

      return false
    }
  }

  return true
}

window.deleteAdminStorageUrls =
  deleteAdminStorageUrls

async function deleteSelectedModel() {
  const list =
    document.getElementById("modelsList")

  const id =
    Number(list?.value || currentModel || 0)

  if (!id) {
    showGameToast("اختر النموذج")
    return false
  }

  const modelName =
    list?.options?.[list.selectedIndex]?.textContent ||
    currentModelName ||
    `نموذج ${id}`

  const modelData =
    await requestAdminModelAccess(
      id,
      modelName
    )

  if (!modelData) {
    return false
  }

  const confirmed =
    await showAdminConfirm(
      `تحذير مهم:\n\nسيتم حذف النموذج "${modelName}" نهائيًا من Supabase.\n\nسيتم حذف:\n- كل أسئلة النموذج\n- كل إعدادات النموذج\n- كل الصور والفيديوهات\n- كل بيانات الفقرات المرتبطة بالنموذج\n\nلا يمكن التراجع بعد الحذف.`,
      {
        title: "حذف النموذج نهائيًا",
        okText: "نعم، احذف كل شيء",
        cancelText: "إلغاء",
        danger: true
      }
    )

  if (!confirmed) {
    return false
  }

  try {
    showGameToast(
      "جارٍ حذف صور وفيديوهات النموذج..."
    )

    const storageDeleted =
      await deleteModelStorageFiles(id)

    if (!storageDeleted) {
      showGameToast(
        "توقف الحذف لأن ملفات النموذج لم تُحذف",
        "error"
      )

      return false
    }

    showGameToast(
      "جارٍ حذف بيانات النموذج..."
    )

    const deleteJobs = [
      dbDelete(
        "archive_items",
        query => query.eq("model", id),
        {
          logLabel: "DELETE ARCHIVE ITEMS"
        }
      ),

      dbDelete(
        "archive_boxes",
        query => query.eq("model", id),
        {
          logLabel: "DELETE ARCHIVE BOXES"
        }
      ),

      dbDelete(
        "final_round3_items",
        query => query.eq("model", id),
        {
          logLabel: "DELETE FINAL ROUND 3 ITEMS"
        }
      ),

      dbDelete(
        "final_round2_items",
        query => query.eq("model", id),
        {
          logLabel: "DELETE FINAL ROUND 2 ITEMS"
        }
      ),

      dbDelete(
        "final_round1_items",
        query => query.eq("model", id),
        {
          logLabel: "DELETE FINAL ROUND 1 ITEMS"
        }
      ),

      dbDelete(
        "final_round_meta",
        query => query.eq("model", id),
        {
          logLabel: "DELETE FINAL ROUND META"
        }
      ),

      dbDelete(
        "explain_settings",
        query => query.eq("model", id),
        {
          logLabel: "DELETE EXPLAIN SETTINGS"
        }
      ),

      dbDelete(
        "explain_words",
        query => query.eq("model", id),
        {
          logLabel: "DELETE EXPLAIN WORDS"
        }
      ),

      dbDelete(
        "who_images",
        query => query.eq("model", id),
        {
          logLabel: "DELETE WHO IMAGES"
        }
      ),

      dbDelete(
        "random_challenge_questions",
        query => query.eq("model", id),
        {
          logLabel: "DELETE RANDOM CHALLENGE QUESTIONS"
        }
      ),

      dbDelete(
        "auction_questions",
        query => query.eq("model", id),
        {
          logLabel: "DELETE AUCTION QUESTIONS"
        }
      ),

      dbDelete(
        "top10_questions",
        query => query.eq("model", id),
        {
          logLabel: "DELETE TOP10 QUESTIONS"
        }
      ),

      dbDelete(
        "questions",
        query => query.eq("model", id),
        {
          logLabel: "DELETE QUESTIONS"
        }
      ),

      dbDelete(
        "segment_settings",
        query => query.eq("model", id),
        {
          logLabel: "DELETE SEGMENT SETTINGS"
        }
      ),

      dbDelete(
        "visible_segments",
        query => query.eq("model", id),
        {
          logLabel: "DELETE VISIBLE SEGMENTS"
        }
      )
    ]

    const results =
      await Promise.all(deleteJobs)

    const failed =
      results.find(result => !result?.ok)

    if (failed) {
      console.error(
        "DELETE MODEL RELATED DATA ERROR:",
        failed.error
      )

      showGameToast(
        "تعذر حذف بعض بيانات النموذج",
        "error"
      )

      return false
    }

    const modelResult =
      await dbDelete(
        "models",
        query => query.eq("id", id),
        {
          logLabel: "DELETE MODEL"
        }
      )

    if (!modelResult.ok) {
      console.error(
        "DELETE MODEL ERROR:",
        modelResult.error
      )

      showGameToast(
        "تعذر حذف النموذج",
        "error"
      )

      return false
    }

    if (Number(currentModel || 0) === id) {
      currentModel = null
      currentModelName = ""
      currentModelSetupCompleted = true
      currentAdminSegment = "home"

      updateAdminBrandModel()
      showAdminModelGate()
    }

    await loadModels()

    if (list) {
      list.value = ""
    }

    invalidateAdminHomeCache()

    showGameToast(
      "تم حذف النموذج وكل بياناته",
      "success"
    )

    return true
  } catch (error) {
    console.error(
      "DELETE SELECTED MODEL CATCH:",
      error
    )

    showGameToast(
      "حدث خطأ أثناء حذف النموذج",
      "error"
    )

    return false
  }
}

/* =========================
   16) Open Segment Router
========================= */

async function goAdminHome() {
  if (
    currentModelSetupCompleted === false &&
    currentAdminSegment === "settings"
  ) {
    showGameToast(
      "اكمل إعدادات الفقرات ",
      "warning"
    )

    return false
  }

  if (adminNavBusy) {
    return false
  }

  adminNavBusy = true

  try {
    currentAdminSegment = "home"
    renderAdminHomeActions()
    await renderAdminHome()

    return true
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

function showLetterliAdminInfo() {
  showGameToast(
    "فقرة حرفلي جاهزة ولا تحتاج تعديل من الأدمن",
    "info"
  )

  return true
}

async function openAdminSegment(segment) {
  if (!currentModel) {
    showGameToast("افتح نموذج أولاً")
    return false
  }

  if (segment === "home") {
    return goAdminHome()
  }

    const isKnownSegment =
    ALL_GAME_SEGMENTS.some(item => {
      return item.key === segment
    })

  if (!isKnownSegment) {
    showGameToast(
      "الفقرة غير معروفة",
      "error"
    )

    await renderAdminHome()
    return false
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

    if (segment === "letterli") {
  return showLetterliAdminInfo()
}

    currentAdminSegment = segment

    renderAdminSegmentActions()
    scheduleAdminTabsRefresh()

    if (typeof showAdminSegmentLoading === "function") {
      showAdminSegmentLoading(
        `جارٍ فتح ${getAdminSegmentTitle(segment)}...`
      )
    }

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

    if (segment === "randomChallenge") {
      await openAdminRandomChallenge()
      return true
    }

    showGameToast("الفقرة غير معروفة", "error")
    await renderAdminHome()

    return false
  } catch (error) {
    console.error("OPEN ADMIN SEGMENT ERROR:", error)
    showGameToast("تعذر فتح الفقرة", "error")

    await renderAdminHome()
    return false
  } finally {
    adminNavBusy = false
  }
}

function handleAdminEditCardToggle(card) {
  const grid =
    card?.closest(
      ".adminEditCardsGrid"
    )

  if (!grid) {
    return
  }

  if (card.open) {
    grid.classList.add(
      "hasOpenCard"
    )

    const openedCards =
      grid.querySelectorAll(
        ":scope > .adminEditItemCard[open]"
      )

    openedCards.forEach(item => {
      if (item !== card) {
        item.open = false
      }
    })

    return
  }

  const remainingOpenCard =
    grid.querySelector(
      ":scope > .adminEditItemCard[open]"
    )

  grid.classList.toggle(
    "hasOpenCard",
    Boolean(remainingOpenCard)
  )
}

/* =========================
   MODEL SEGMENT VISIBILITY EXPORTS
========================= */

window.loadModelSegmentVisibilityMap =
  loadModelSegmentVisibilityMap

window.toggleModelSegmentVisibility =
  toggleModelSegmentVisibility

window.openModelSegmentVisibilityPanel =
  openModelSegmentVisibilityPanel

window.closeModelSegmentVisibilityPanel =
  closeModelSegmentVisibilityPanel



/* =========================
   ADMIN CORE EXPORTS
========================= */

Object.assign(window, {
  initAdminPanel,

  showGameToast,
  showAdminConfirm,

  isAdminSaving,
  setAdminSaving,
  canRunAdminDelete,

  uploadImageFile,
  uploadVideoFile,
  makeSafeFileExt,
  makeUploadPath,
  getFileSizeMB,

  createModel,
  openSelectedModel,
  renameSelectedModel,
  closeRenameModelModal,
  submitRenameModel,
  deleteSelectedModel,
  exitCurrentModel,

  openSupabaseCleanupGatePage,
  scanSupabaseCleanup,
  cleanupSupabaseSafeResidues,
  cleanupSupabaseRuntimeLogs,

  renderAdminHome,
  goAdminHome,
  adminBackToCards,
  showAdminHomeCards,
  showAdminEditorPage,
showLetterliAdminInfo,

  openAdminSegment,
  openAdminSegmentCard,
  openAdminSegmentSettings,
  saveAdminSegmentSettingsPage,

  selectAdminSettingOption,
  toggleAdminChallengeSetting,

  checkCurrentModelReady,
  closeModelCheckModal,

  handleAdminEditCardToggle,
  normalizeAdminEditorCards,
  arrangeAdminInnerTabs,

  getAdminSegmentCount,
  saveAdminSegmentCount,
  getSegmentRoundCount,
  saveSegmentRoundCount,

  normalizeAdminSegmentCount,
  normalizeAdminRoundCount,
  updateAdminQuickSettingUI,

  invalidateAdminHomeCache
})