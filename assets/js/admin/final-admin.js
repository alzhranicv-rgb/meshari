/* =========================================================
   FINAL ADMIN / إدارة فقرة الفاصلة
   CLEAN ORGANIZED VERSION
========================================================= */

/* =========================
   1) STATE + CONSTANTS
========================= */

let finalRound1AdminCount = 7
let finalRound3AdminCount = 5
let finalRound4AdminCount = 5
let finalAdminRound = 1
let finalAdminDeleteBusy = false

const finalAdminPreviewObjectUrls = new Map()

const FINAL_ADMIN_MAX_IMAGE_SIZE_MB = 15
const FINAL_ADMIN_MAX_VIDEO_SIZE_MB = 45
const FINAL_ADMIN_ALLOWED_VIDEO_EXTENSIONS = ["mp4", "mov", "m4v", "webm"]

const FINAL_ADMIN_ROUND_TITLES = {
  1: "ٮدوں ٮڡاط",
  2: "صح صحلي",
  3: "قصة",
  4: "التركيز"
}

const FINAL_ROUND2_TYPES = {
  1: "scramble",
  2: "sequence",
  3: "image",
  4: "scramble",
  5: "sequence",
  6: "image"
}

const FINAL_ROUND2_IMAGE_DB_NUMBERS = {
  1: 101,
  2: 102,
  3: 101,
  6: 102
}

const FINAL_ROUND2_TEXT_NUMBERS = [1, 2, 4, 5]
const FINAL_ROUND2_IMAGE_NUMBERS = [3, 6]

const FINAL_ADMIN_ROUND_BUILDERS = {
  1: buildFinalRound1Admin,
  2: buildFinalRound2Admin,
  3: buildFinalRound3StoryAdmin,
  4: buildFinalRound3FocusAdmin
}

const FINAL_ADMIN_ROUND_SAVERS = {
  1: saveFinalRound1,
  2: saveFinalRound2,
  3: saveFinalRound3Story,
  4: saveFinalRound3Focus
}

/* =========================
   2) GENERAL HELPERS
========================= */

function getFinalAdminRoundTitle(round) {
  return FINAL_ADMIN_ROUND_TITLES[Number(round)] || "الفاصلة"
}

function getFinalStoryDbNumber(displayNumber) {
  return 200 + Number(displayNumber || 1)
}

function getFinalRound2ImageDbNumber(displayNumber) {
  return FINAL_ROUND2_IMAGE_DB_NUMBERS[Number(displayNumber)] || 0
}

/* Alias قديم للتوافق */
function getFinalRound4DbNumber(displayNumber) {
  return getFinalRound2ImageDbNumber(displayNumber)
}

function getFinalRound2Type(number) {
  return FINAL_ROUND2_TYPES[Number(number)] || ""
}

function isFinalRound2ImageNumber(number) {
  return getFinalRound2Type(number) === "image"
}

function isFinalRound2ScrambleNumber(number) {
  return getFinalRound2Type(number) === "scramble"
}

function isFinalRound2SequenceNumber(number) {
  return getFinalRound2Type(number) === "sequence"
}

function indexRowsBy(rows, getKey) {
  return (rows || []).reduce((map, row) => {
    map[getKey(row)] = row
    return map
  }, {})
}

function groupRowsBy(rows, getKey, initial = {}) {
  return (rows || []).reduce((groups, row) => {
    const key = getKey(row)
    ;(groups[key] ||= []).push(row)
    return groups
  }, initial)
}

function getRowsByOrder(rows, field) {
  return indexRowsBy(rows, (row) => Number(row[field]))
}

function invalidateFinalAdminCache() {
  if (typeof invalidateAdminHomeCache === "function") {
    invalidateAdminHomeCache()
  }
}


function getFinalAdminBucketName() {
  return typeof BUCKET_NAME !== "undefined" && BUCKET_NAME
    ? String(BUCKET_NAME)
    : "r3-images"
}

function getFinalAdminFileSizeMB(file) {
  return Number(((Number(file?.size) || 0) / 1024 / 1024).toFixed(2))
}

function getFinalAdminFileExtension(file, fallback = "bin") {
  const fileName = String(file?.name || "").trim()
  const lastDotIndex = fileName.lastIndexOf(".")

  const nameExtension =
    lastDotIndex > -1 && lastDotIndex < fileName.length - 1
      ? fileName
          .slice(lastDotIndex + 1)
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")
      : ""

  if (nameExtension) return nameExtension

  const mimeType = String(file?.type || "").toLowerCase()

  if (mimeType.includes("jpeg")) return "jpg"
  if (mimeType.includes("png")) return "png"
  if (mimeType.includes("webp")) return "webp"
  if (mimeType.includes("gif")) return "gif"
  if (mimeType.includes("quicktime")) return "mov"
  if (mimeType.includes("m4v")) return "m4v"
  if (mimeType.includes("webm")) return "webm"
  if (mimeType.includes("mp4")) return "mp4"
  if (mimeType.includes("hevc")) return "mov"

  return fallback
}

function makeFinalAdminUploadPath(prefix, extension) {
  const safePrefix = String(prefix || "final_file")
    .replace(/[^a-zA-Z0-9_-]/g, "_")

  const safeExtension = String(extension || "bin")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "") || "bin"

  const modelFolder = currentModel
    ? `model_${Number(currentModel)}`
    : "model_unknown"

  const uniquePart = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`

  return `${modelFolder}/final/${safePrefix}_${uniquePart}.${safeExtension}`
}

function validateFinalAdminImageFile(file, showMessage = true) {
  if (!file) return false

  const type = String(file.type || "").toLowerCase()
  const extension = getFinalAdminFileExtension(file, "")
  const allowedExtensions = ["jpg", "jpeg", "png", "webp", "gif"]
  const isImage = type.startsWith("image/") || allowedExtensions.includes(extension)

  if (!isImage) {
    if (showMessage) showGameToast("اختر ملف صورة صحيح", "warning")
    return false
  }

  const sizeMB = getFinalAdminFileSizeMB(file)

  if (sizeMB > FINAL_ADMIN_MAX_IMAGE_SIZE_MB) {
    if (showMessage) {
      showGameToast(
        `حجم الصورة ${sizeMB}MB أكبر من المسموح ${FINAL_ADMIN_MAX_IMAGE_SIZE_MB}MB`,
        "warning"
      )
    }

    return false
  }

  return true
}

function validateFinalAdminVideoFile(file, showMessage = true) {
  if (!file) return false

  const type = String(file.type || "").toLowerCase()
  const extension = getFinalAdminFileExtension(file, "")

  const hasSupportedMimeType =
    type === "video/mp4" ||
    type === "video/webm" ||
    type === "video/quicktime" ||
    type === "video/x-m4v" ||
    type === "video/hevc"

  const hasSupportedExtension =
    FINAL_ADMIN_ALLOWED_VIDEO_EXTENSIONS.includes(extension)

  if (!hasSupportedMimeType && !hasSupportedExtension) {
    if (showMessage) {
      showGameToast(
        "صيغة الفيديو غير مدعومة. استخدم MP4 أو MOV أو M4V أو WebM",
        "warning"
      )
    }

    return false
  }

  const sizeMB = getFinalAdminFileSizeMB(file)

  if (sizeMB > FINAL_ADMIN_MAX_VIDEO_SIZE_MB) {
    if (showMessage) {
      showGameToast(
        `حجم الفيديو ${sizeMB}MB أكبر من المسموح ${FINAL_ADMIN_MAX_VIDEO_SIZE_MB}MB`,
        "warning"
      )
    }

    return false
  }

  return true
}

async function uploadFinalAdminFile(file, prefix, kind) {
  if (!file) return ""

  const isVideo = kind === "video"
  const valid = isVideo
    ? validateFinalAdminVideoFile(file)
    : validateFinalAdminImageFile(file)

  if (!valid) return ""

  if (typeof db === "undefined" || !db?.storage) {
    console.error("FINAL ADMIN STORAGE ERROR: Supabase storage is unavailable")
    showGameToast("خدمة رفع الملفات غير متاحة", "error")
    return ""
  }

  let extension = getFinalAdminFileExtension(
    file,
    isVideo ? "mp4" : "png"
  )

  if (
    isVideo &&
    !FINAL_ADMIN_ALLOWED_VIDEO_EXTENSIONS.includes(extension)
  ) {
    const mimeType = String(file.type || "").toLowerCase()

    if (mimeType.includes("quicktime") || mimeType.includes("hevc")) {
      extension = "mov"
    } else if (mimeType.includes("m4v")) {
      extension = "m4v"
    } else if (mimeType.includes("webm")) {
      extension = "webm"
    } else {
      extension = "mp4"
    }
  }

  const path = makeFinalAdminUploadPath(prefix, extension)
  const bucket = getFinalAdminBucketName()

  try {
    const { error: uploadError } = await db.storage
      .from(bucket)
      .upload(path, file, {
        upsert: false,
        cacheControl: "31536000",
        contentType:
          file.type ||
          (isVideo ? "video/mp4" : `image/${extension}`)
      })

    if (uploadError) {
      console.error("FINAL ADMIN FILE UPLOAD ERROR:", uploadError)

      const message =
        uploadError.message ||
        uploadError.error ||
        uploadError.statusCode ||
        "خطأ غير معروف"

      showGameToast(
        `${isVideo ? "فشل رفع الفيديو" : "فشل رفع الصورة"}: ${message}`,
        "error"
      )

      return ""
    }

    const { data } = db.storage
      .from(bucket)
      .getPublicUrl(path)

    const publicUrl = String(data?.publicUrl || "").trim()

    if (!publicUrl) {
      console.error("FINAL ADMIN PUBLIC URL ERROR:", { bucket, path })
      showGameToast("تم رفع الملف لكن تعذر إنشاء رابطه", "error")
      return ""
    }

    return publicUrl
  } catch (error) {
    console.error("FINAL ADMIN FILE UPLOAD CATCH:", error)
    showGameToast(
      isVideo ? "حدث خطأ أثناء رفع الفيديو" : "حدث خطأ أثناء رفع الصورة",
      "error"
    )
    return ""
  }
}

async function uploadFinalAdminImageFile(file, prefix = "final_image") {
  return uploadFinalAdminFile(file, prefix, "image")
}

async function uploadFinalAdminVideoFile(file, prefix = "final_video") {
  return uploadFinalAdminFile(file, prefix, "video")
}

function releaseFinalAdminPreviewUrl(key) {
  const safeKey = String(key || "")
  const oldUrl = finalAdminPreviewObjectUrls.get(safeKey)

  if (oldUrl) {
    URL.revokeObjectURL(oldUrl)
    finalAdminPreviewObjectUrls.delete(safeKey)
  }
}

function releaseAllFinalAdminPreviewUrls() {
  for (const url of finalAdminPreviewObjectUrls.values()) {
    URL.revokeObjectURL(url)
  }

  finalAdminPreviewObjectUrls.clear()
}

function setFinalAdminPreviewObjectUrl(key, file) {
  const safeKey = String(key || "")
  releaseFinalAdminPreviewUrl(safeKey)

  const objectUrl = URL.createObjectURL(file)
  finalAdminPreviewObjectUrls.set(safeKey, objectUrl)

  return objectUrl
}

function handleFinalFocusMediaChange(number, mediaType, input) {
  const safeNumber = Number(number || 0)
  const file = input?.files?.[0] || null

  if (!safeNumber || !file) return false

  const isVideo = mediaType === "video"
  const valid = isVideo
    ? validateFinalAdminVideoFile(file)
    : validateFinalAdminImageFile(file)

  if (!valid) {
    input.value = ""
    return false
  }

  const imageInput = document.getElementById(
    `finalRound3TeamImage_${safeNumber}`
  )

  const videoInput = document.getElementById(
    `finalRound3TeamVideo_${safeNumber}`
  )

  if (isVideo && imageInput) imageInput.value = ""
  if (!isVideo && videoInput) videoInput.value = ""

  const preview = document.getElementById(
    `finalFocusPreview_${safeNumber}`
  )

  if (!preview) return true

  const objectUrl = setFinalAdminPreviewObjectUrl(
    `focus_${safeNumber}`,
    file
  )

  preview.innerHTML = isVideo
    ? `
        <video
          src="${objectUrl}"
          class="previewImg"
          controls
          playsinline
          preload="metadata"
        ></video>
      `
    : `
        <img
          src="${objectUrl}"
          class="previewImg"
          alt=""
        >
      `

  preview.closest(".finalFocusMediaBox")
    ?.querySelectorAll(".adminField")
    .forEach((field) => field.classList.remove("adminMissingField"))

  return true
}

function handleFinalRound2ImageChange(displayNumber, imageOrder, input) {
  const safeDisplayNumber = Number(displayNumber || 0)
  const safeImageOrder = Number(imageOrder || 0)
  const file = input?.files?.[0] || null

  if (!safeDisplayNumber || !safeImageOrder || !file) return false

  if (!validateFinalAdminImageFile(file)) {
    input.value = ""
    return false
  }

  const preview = document.getElementById(
    `finalRound2ImagePreview_${safeDisplayNumber}_${safeImageOrder}`
  )

  if (!preview) return true

  const objectUrl = setFinalAdminPreviewObjectUrl(
    `round2_${safeDisplayNumber}_${safeImageOrder}`,
    file
  )

  preview.innerHTML = `
    <img
      src="${objectUrl}"
      class="previewImg"
      alt=""
    >
  `

  preview.closest(".finalRound2ImageItemCard")
    ?.querySelector(".adminField")
    ?.classList.remove("adminMissingField")

  return true
}

function canRunFinalAdminDelete() {
  if (finalAdminDeleteBusy) {
    showGameToast("انتظر حتى ينتهي الحذف", "warning")
    return false
  }

  if (typeof isAdminSaving === "function" && isAdminSaving()) {
    showGameToast("لا يمكن الحذف أثناء الحفظ", "warning")
    return false
  }

  return true
}

async function syncFinalAdminRoundCountState(round) {
  const safeRound = Number(round || 1)

  if (safeRound === 1) {
    finalRound1AdminCount = normalizeAdminSegmentCount(
      "finalRound1",
      await getAdminSegmentCount("finalRound1")
    )
  }

  if (safeRound === 3) {
    finalRound3AdminCount = normalizeAdminSegmentCount(
      "finalRound3",
      await getAdminSegmentCount("finalRound3")
    )
  }

  if (safeRound === 4) {
    finalRound4AdminCount = normalizeAdminSegmentCount(
      "finalRound4",
      await getAdminSegmentCount("finalRound4")
    )
  }
}

async function getFinalAdminMetaCardsCount(round) {
  const safeRound = Number(round || 1)

  if (safeRound === 1) return getAdminSegmentCount("finalRound1")
  if (safeRound === 2) return 6
  if (safeRound === 3) return getAdminSegmentCount("finalRound3")
  if (safeRound === 4) return getAdminSegmentCount("finalRound4")

  return 0
}

/* =========================
   3) COMPLETION STATUS
========================= */

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

  for (const number of FINAL_ROUND2_TEXT_NUMBERS) {
    const isScramble = isFinalRound2ScrambleNumber(number)

    for (let i = 1; i <= 6; i++) {
      const row = r2Map[`${number}_${i}`]

      if (!row || !hasText(row.prompt)) {
        round2Done = false
        break
      }

      if (
        isScramble &&
        (!hasText(row.hint) || !hasText(row.answer))
      ) {
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

  for (const displayNumber of FINAL_ROUND2_IMAGE_NUMBERS) {
    const dbNumber = getFinalRound2ImageDbNumber(displayNumber)

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

    const hasAllParts =
      hasText(row.question_part1) &&
      hasText(row.question_part2) &&
      hasText(row.question_part3)

    if (!hasAllParts || !hasText(row.answer)) {
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

function getFinalRound1ItemStatus(row = {}) {
  const fields = [row.card_text, row.answer]

  const completed = fields.filter(isAdminFieldFilled).length
  return getAdminItemStatus(completed, fields.length)
}

function getFinalRound1InputStatus(number, map) {
  const row = map[number] || {}
  return getFinalRound1ItemStatus(row)
}

function getFinalRound2TextStatus(number, rows = []) {
  const rowsByOrder = getRowsByOrder(rows, "item_order")
  const isScramble = isFinalRound2ScrambleNumber(number)
  const fields = []

  for (let i = 1; i <= 6; i++) {
    const row = rowsByOrder[i] || {}
    fields.push(row.prompt)

    if (isScramble) fields.push(row.hint, row.answer)
  }

  return getAdminItemStatus(fields.filter(isAdminFieldFilled).length, fields.length)
}

function getFinalRound2ImageStatus(displayNumber, rows = []) {
  const rowsByOrder = getRowsByOrder(rows, "image_order")
  const fields = []

  for (let i = 1; i <= 5; i++) {
    const row = rowsByOrder[i] || {}
    fields.push(row.image, row.answer)
  }

  return getAdminItemStatus(fields.filter(isAdminFieldFilled).length, fields.length)
}

function getFinalStoryItemStatus(row = {}) {
  const fields = [row.question_part1, row.question_part2, row.question_part3, row.answer]

  const completed = fields.filter(isAdminFieldFilled).length
  return getAdminItemStatus(completed, fields.length)
}

function getFinalFocusItemStatus(row = {}) {
  const hasMedia = isAdminFieldFilled(row.image) || isAdminFieldFilled(row.video)

  const fields = [hasMedia ? "media" : "", row.question, row.answer]

  const completed = fields.filter(isAdminFieldFilled).length
  return getAdminItemStatus(completed, fields.length)
}

/* =========================
   4) MAIN RENDER
========================= */

async function renderFinalAdmin() {
  finalAdminRound = 1
  await renderFinalAdminRound(1)
}

async function renderFinalAdminRound(round) {
  const safeRound = Math.min(Math.max(Number(round || 1), 1), 4)

  finalAdminRound = safeRound

  releaseAllFinalAdminPreviewUrls()
  await syncFinalAdminRoundCountState(safeRound)

  const title = getFinalAdminRoundTitle(safeRound)

  let html = `
    <div class="finalAdminShell cleanFinalAdminShell adminOnePageEditor">
      <div class="adminEditorTopBar compactAdminEditorTopBar adminEditorTopBarWithActions">
        <div>
          <h2 class="adminSectionTitle">${escapeHtml(title)}</h2>
        </div>

        <div class="adminInlineActions">
          <button type="button" onclick="saveFinalRound(${safeRound})" class="adminSaveBtn">
            حفظ ${escapeHtml(title)}
          </button>

          <button type="button" onclick="deleteFinalRound(${safeRound})" class="adminDeleteAllBtn">
            حذف الفقرة
          </button>
        </div>
      </div>
  `

  const builder = FINAL_ADMIN_ROUND_BUILDERS[safeRound]
  if (builder) html += await builder()

  html += `
    </div>
  `

  editor().innerHTML = html
  normalizeAdminEditorCards()
}

/* =========================
   5) COUNT SETTINGS
========================= */

async function changeFinalRound1CardsCount() {
  if (isAdminSaving()) return false

  const count = Number(
    document.getElementById("finalRound1CardsCount")?.value || 7
  )

  const safeCount = normalizeAdminSegmentCount("finalRound1", count)

  try {
    setAdminSaving(true, "جارٍ حفظ العدد...")

    const saved = await saveAdminSegmentCount("finalRound1", safeCount)

    if (!saved) return false

    finalRound1AdminCount = safeCount

    invalidateFinalAdminCache()
    updateAdminQuickSettingUI("finalRound1", safeCount)

    await renderFinalAdminRound(1)
    scheduleAdminTabsRefresh()

    showGameToast("تم حفظ العدد", "success")
    return true
  } finally {
    setAdminSaving(false)
  }
}

async function changeFinalRound3Count() {
  if (isAdminSaving()) return false

  const count = Number(
    document.getElementById("finalRound3Count")?.value || 5
  )

  const safeCount = normalizeAdminSegmentCount("finalRound3", count)

  try {
    setAdminSaving(true, "جارٍ حفظ العدد...")

    const saved = await saveAdminSegmentCount("finalRound3", safeCount)

    if (!saved) return false

    finalRound3AdminCount = safeCount

    invalidateFinalAdminCache()
    updateAdminQuickSettingUI("finalRound3", safeCount)

    await renderFinalAdminRound(3)
    scheduleAdminTabsRefresh()

    showGameToast("تم حفظ العدد", "success")
    return true
  } finally {
    setAdminSaving(false)
  }
}

async function changeFinalRound4Count() {
  if (isAdminSaving()) return false

  const count = Number(
    document.getElementById("finalRound4Count")?.value || 5
  )

  const safeCount = normalizeAdminSegmentCount("finalRound4", count)

  try {
    setAdminSaving(true, "جارٍ حفظ العدد...")

    const saved = await saveAdminSegmentCount("finalRound4", safeCount)

    if (!saved) return false

    finalRound4AdminCount = safeCount

    invalidateFinalAdminCache()
    updateAdminQuickSettingUI("finalRound4", safeCount)

    await renderFinalAdminRound(4)
    scheduleAdminTabsRefresh()

    showGameToast("تم حفظ العدد", "success")
    return true
  } finally {
    setAdminSaving(false)
  }
}

/* =========================
   6) MAIN SAVE ROUTER
========================= */

async function saveFinalRound(round) {
  if (isAdminSaving()) return false

  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")
    return false
  }

  try {
    const safeRound = Math.min(Math.max(Number(round || 1), 1), 4)
    const title = getFinalAdminRoundTitle(safeRound)

    setAdminSaving(true, `جارٍ حفظ ${title}...`)

    const metaRow = {
      model: Number(currentModel),
      round: safeRound,
      title,
      cards_count: Number(await getFinalAdminMetaCardsCount(safeRound) || 0)
    }

    if (safeRound === 4) {
      metaRow.round3_mode = "team_media"
    }

    const metaResult = await dbUpsert(
      "final_round_meta",
      [metaRow],
      {
        onConflict: "model,round",
        logLabel: "SAVE FINAL ROUND META"
      }
    )

    if (!metaResult.ok) {
      console.error("SAVE FINAL ROUND META ERROR:", metaResult.error)
      showGameToast("تعذر حفظ بيانات الجولة", "error")
      return false
    }

    const saveRound = FINAL_ADMIN_ROUND_SAVERS[safeRound]
    const saved = saveRound ? await saveRound(true) : false

    if (!saved) return false

    invalidateFinalAdminCache()
    showGameToast(`تم حفظ ${title}`, "success")
    await renderFinalAdminRound(safeRound)
    scheduleAdminTabsRefresh()
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
   7) ROUND 1 - ٮدوں ٮڡاط
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
      await getAdminSegmentCount("finalRound1")
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

    const keepNumbers = new Set(rows.map((row) => Number(row.number)))

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

      if (!keepNumbers.has(oldNumber)) {
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

    invalidateFinalAdminCache()

    if (!skipSavingLock) {
      showGameToast(
        rows.length ? "تم حفظ ٮدوں ٮڡاط" : "تم حذف بيانات ٮدوں ٮڡاط",
        "success"
      )
    }

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
   8) ROUND 2 - صح صحلي
========================= */

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

  const grouped = groupRowsBy(textRes.data, (row) => Number(row.number || 1), {
    1: [],
    2: [],
    4: [],
    5: []
  })

  const imageGrouped = groupRowsBy(
    (imageRes.data || []).filter((row) => [101, 102].includes(Number(row.number))),
    (row) => (Number(row.number) === 101 ? 3 : 6),
    { 3: [], 6: [] }
  )

  return `
    <div class="adminEditCardsGrid finalRound2OnePageGrid">
      ${Object.keys(FINAL_ROUND2_TYPES).map(Number)
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

function syncFinalRound2Answer(number, order) {
  const prompt = document.getElementById(`finalRound2Prompt_${number}_${order}`)
  const answer = document.getElementById(`finalRound2Answer_${number}_${order}`)

  if (!prompt || !answer) return
  answer.value = prompt.value
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
            onclick="event.preventDefault(); event.stopPropagation(); clearFinalRound2ImageItem(${n});"
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
                    onchange="handleFinalRound2ImageChange(${n}, ${i}, this)"
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

                <div
                  id="finalRound2ImagePreview_${n}_${i}"
                  class="finalAdminImagePreview"
                >
                  ${
                    row.image
                      ? `<img src="${escapeHtml(row.image)}" class="previewImg" alt="">`
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

async function buildFinalRound4ImageAdmin() {
  const result = await dbSelect(
    "final_round3_items",
    (query) =>
      query
        .eq("model", Number(currentModel))
        .order("number", { ascending: true })
        .order("image_order", { ascending: true }),
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

  const grouped = groupRowsBy(
    (result.data || []).filter((row) => [101, 102].includes(Number(row.number))),
    (row) => Number(row.number),
    { 101: [], 102: [] }
  )

  return `
    <div class="finalAdminRound3Wrap">
      ${FINAL_ROUND2_IMAGE_NUMBERS.map((displayNumber) => {
        const dbNumber = getFinalRound2ImageDbNumber(displayNumber)
        const rowsByOrder = getRowsByOrder(grouped[dbNumber] || [], "image_order")

        return `
          <div class="finalAdminCard finalAdminWideCard finalRound4CleanCard">
            <div class="finalAdminCardHead">
              <h3>رقم ${displayNumber}</h3>

              <button class="adminDeleteBtn" onclick="clearFinalRound2ImageItem(${displayNumber})">
                حذف
              </button>
            </div>

            ${Array.from({ length: 5 }, (_, index) => {
              const imageOrder = index + 1
              const row = rowsByOrder[imageOrder] || {}

              return `
                <div class="finalAdminImageRow">
                  <div class="finalAdminWordIndex">الصورة ${imageOrder}</div>

                  <div class="finalAdminImageFields">
                    <input
                      type="file"
                      id="finalRound4File_${displayNumber}_${imageOrder}"
                      accept="image/*"
                    >

                    <input
                      id="finalRound4Answer_${displayNumber}_${imageOrder}"
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
        `
      }).join("")}
    </div>
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

    for (const number of FINAL_ROUND2_TEXT_NUMBERS) {
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

    const keepKeys = new Set(rows.map((row) => `${Number(row.number)}_${Number(row.item_order)}`))

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

      if (!keepKeys.has(key)) {
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

    const imageSaved = await saveFinalRound2Image(true)

    if (!imageSaved) {
      showGameToast("تم حفظ صح صحلي لكن تعذر حفظ صور 3 و 6")
      return false
    }

    invalidateFinalAdminCache()

    if (!skipSavingLock) {
      showGameToast("تم حفظ صح صحلي", "success")
    }

    return true
  } catch (err) {
    console.log("SAVE FINAL ROUND 2 CATCH:", err)
    showGameToast("توقف حفظ صح صحلي بسبب خطأ")
    return false
  } finally {
    if (!skipSavingLock) setAdminSaving(false)
  }
}

async function saveFinalRound2Image(skipSavingLock = false) {
  if (!skipSavingLock && isAdminSaving()) return false

  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")
    return false
  }

  try {
    if (!skipSavingLock) {
      setAdminSaving(true, "جارٍ حفظ صور صح صحلي...")
    }

    const model = Number(currentModel)

    const oldRowsResult = await dbSelect(
      "final_round3_items",
      (query) => query.eq("model", model),
      {
        select: "*",
        fallback: [],
        logLabel: "READ OLD FINAL ROUND 2 IMAGES"
      }
    )

    if (!oldRowsResult.ok) {
      console.log("READ OLD FINAL ROUND 2 IMAGES ERROR:", oldRowsResult.error)
      showGameToast("تعذر قراءة الصور القديمة")
      return false
    }

    const oldMap = indexRowsBy(
      (oldRowsResult.data || []).filter((row) => [101, 102].includes(Number(row.number))),
      (row) => `${Number(row.number)}_${Number(row.image_order || 1)}`
    )

    const rows = []

    for (const displayNumber of FINAL_ROUND2_IMAGE_NUMBERS) {
      const dbNumber = getFinalRound2ImageDbNumber(displayNumber)

      for (let imageOrder = 1; imageOrder <= 5; imageOrder++) {
        const file = document.getElementById(`finalRound4File_${displayNumber}_${imageOrder}`)?.files?.[0] || null
        const answer = (document.getElementById(`finalRound4Answer_${displayNumber}_${imageOrder}`)?.value || "").trim()
        const key = `${dbNumber}_${imageOrder}`

        let image = oldMap[key]?.image || ""

        if (file) {
          image = await uploadFinalAdminImageFile(file, `final_r2_image_${displayNumber}_${imageOrder}`)

          if (!image) {
            showGameToast(`تعذر رفع صورة ${imageOrder} للرقم ${displayNumber}`)
            return false
          }
        }

        if (!image && !answer) continue

        rows.push({
          model,
          number: dbNumber,
          image_order: imageOrder,
          image,
          video: "",
          question: "",
          answer
        })
      }
    }

    const keepKeys = new Set(rows.map((row) => `${row.number}_${row.image_order}`))

    const existingRowsResult = await dbSelect(
      "final_round3_items",
      (query) => query.eq("model", model),
      {
        select: "number,image_order",
        fallback: [],
        logLabel: "READ EXISTING FINAL ROUND 2 IMAGES"
      }
    )

    if (!existingRowsResult.ok) {
      console.log("READ EXISTING FINAL ROUND 2 IMAGES ERROR:", existingRowsResult.error)
      showGameToast("تعذر قراءة صور صح صحلي الحالية")
      return false
    }

    for (const oldRow of existingRowsResult.data || []) {
      const oldNumber = Number(oldRow.number)
      const imageOrder = Number(oldRow.image_order)
      const key = `${oldNumber}_${imageOrder}`

      if (![101, 102].includes(oldNumber) || keepKeys.has(key)) continue

      const deleteResult = await dbDelete(
        "final_round3_items",
        (query) =>
          query
            .eq("model", model)
            .eq("number", oldNumber)
            .eq("image_order", imageOrder),
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

    invalidateFinalAdminCache()

    if (!skipSavingLock) {
      showGameToast(
        rows.length ? "تم حفظ صور صح صحلي" : "تم حذف صور صح صحلي",
        "success"
      )
    }

    return true
  } catch (err) {
    console.log("SAVE FINAL ROUND 2 IMAGES CATCH:", err)
    showGameToast("توقف حفظ صور صح صحلي بسبب خطأ")
    return false
  } finally {
    if (!skipSavingLock) setAdminSaving(false)
  }
}

/* Alias قديم للتوافق */
async function saveFinalRound4Image(skipSavingLock = false) {
  return saveFinalRound2Image(skipSavingLock)
}

/* =========================
   9) ROUND 3 - قصة
========================= */

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
      await getAdminSegmentCount("finalRound3")
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

    const keepNumbers = new Set(rows.map((row) => Number(row.number)))

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

      if (!keepNumbers.has(oldNumber)) {
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

    invalidateFinalAdminCache()

    if (!skipSavingLock) {
      showGameToast(
        rows.length ? "تم حفظ قصة" : "تم حذف بيانات قصة",
        "success"
      )
    }

    return true
  } catch (err) {
    console.log("SAVE FINAL STORY CATCH:", err)
    showGameToast("توقف حفظ قصة بسبب خطأ")
    return false
  } finally {
    if (!skipSavingLock) setAdminSaving(false)
  }
}

/* =========================
   10) ROUND 4 - التركيز
========================= */

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
                onchange="handleFinalFocusMediaChange(${n}, 'image', this)"
              >
            </div>

            <div class="adminField ${hasMedia ? "" : "adminMissingField"}">
              <label>الفيديو</label>
              <input
                type="file"
                id="finalRound3TeamVideo_${n}"
                accept="video/mp4,video/webm,video/quicktime,video/x-m4v,.mp4,.mov,.m4v,.webm"
                onchange="handleFinalFocusMediaChange(${n}, 'video', this)"
              >

              <small class="adminFieldHelp">
                الصيغ المدعومة: MP4 وMOV وM4V وWebM — الحد الأقصى ${FINAL_ADMIN_MAX_VIDEO_SIZE_MB}MB
              </small>
            </div>

            ${!hasMedia ? `<div class="adminMissingHint">الصورة أو الفيديو مطلوب</div>` : ""}

            <div
              id="finalFocusPreview_${n}"
              class="finalAdminPreviewBox"
            >
              ${
                row.video
                  ? `
                      <video
                        src="${escapeHtml(row.video)}"
                        class="previewImg"
                        controls
                        playsinline
                        preload="metadata"
                      ></video>
                    `
                  : row.image
                    ? `<img src="${escapeHtml(row.image)}" class="previewImg" alt="">`
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
      await getAdminSegmentCount("finalRound4")
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

      if (imageFile && videoFile) {
        showGameToast(
          `اختر صورة أو فيديو فقط للرقم ${number}`,
          "warning"
        )
        return false
      }

      if (imageFile) {
        setAdminSaving(true, `جارٍ رفع صورة رقم ${number}...`)

        image = await uploadFinalAdminImageFile(
          imageFile,
          `final_r3_focus_img_${number}`
        )

        if (!image) {
          showGameToast(`تعذر رفع صورة رقم ${number}`)
          return false
        }

        video = ""
      }

      if (videoFile) {
        setAdminSaving(true, `جارٍ رفع فيديو رقم ${number}...`)

        video = await uploadFinalAdminVideoFile(
          videoFile,
          `final_r3_focus_video_${number}`
        )

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

    const keepNumbers = new Set(rows.map((row) => Number(row.number)))

    const existingRowsResult = await dbSelect("final_round3_items", (query) => query.eq("model", Number(currentModel)), {
      select: "number,image_order",
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
      const oldImageOrder = Number(oldRow.image_order || 1)

      if (
        oldNumber >= 1 &&
        oldNumber <= 9 &&
        oldImageOrder === 1 &&
        !keepNumbers.has(oldNumber)
      ) {
        const deleteResult = await dbDelete(
          "final_round3_items",
          (query) =>
            query
              .eq("model", Number(currentModel))
              .eq("number", oldNumber)
              .eq("image_order", 1),
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
        console.error("SAVE FINAL FOCUS ERROR:", saveResult.error)
        showGameToast("فشل حفظ التركيز", "error")
        return false
      }
    }

    invalidateFinalAdminCache()

    if (!skipSavingLock) {
      showGameToast(
        rows.length ? "تم حفظ التركيز" : "تم حذف بيانات التركيز",
        "success"
      )
    }

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
   11) DELETE HELPERS
========================= */

function getFinalRoundDeleteOperations(round, model) {
  const operations = {
    1: [
      dbDelete(
        "final_round1_items",
        (query) => query.eq("model", model).gte("number", 1).lte("number", 9),
        { logLabel: "DELETE FINAL ROUND 1 ITEMS" }
      ),
      dbDelete(
        "segment_settings",
        (query) => query.eq("model", model).eq("segment", "finalRound1"),
        { logLabel: "DELETE FINAL ROUND 1 SETTINGS" }
      )
    ],

    2: [
      dbDelete(
        "final_round2_items",
        (query) => query.eq("model", model),
        { logLabel: "DELETE FINAL ROUND 2 ITEMS" }
      ),
      dbDelete(
        "final_round3_items",
        (query) => query.eq("model", model).in("number", [101, 102]),
        { logLabel: "DELETE FINAL ROUND 2 IMAGES" }
      )
    ],

    3: [
      dbDelete(
        "final_round1_items",
        (query) => query.eq("model", model).gte("number", 201).lte("number", 209),
        { logLabel: "DELETE FINAL ROUND 3 ITEMS" }
      ),
      dbDelete(
        "segment_settings",
        (query) => query.eq("model", model).eq("segment", "finalRound3"),
        { logLabel: "DELETE FINAL ROUND 3 SETTINGS" }
      )
    ],

    4: [
      dbDelete(
        "final_round3_items",
        (query) => query.eq("model", model).gte("number", 1).lte("number", 9),
        { logLabel: "DELETE FINAL ROUND 4 ITEMS" }
      ),
      dbDelete(
        "segment_settings",
        (query) => query.eq("model", model).eq("segment", "finalRound4"),
        { logLabel: "DELETE FINAL ROUND 4 SETTINGS" }
      )
    ]
  }

  return operations[round] || []
}


async function deleteFinalRoundStorageFiles(round) {
  const safeRound =
    Number(round || 0)

  const operations = {
    1: [
      {
        table: "final_round1_items",
        buildQuery: query =>
          query
            .gte("number", 1)
            .lte("number", 9),
        logLabel: "DELETE FINAL ROUND 1 STORAGE"
      }
    ],

    2: [
      {
        table: "final_round2_items",
        buildQuery: query => query,
        logLabel: "DELETE FINAL ROUND 2 STORAGE"
      },
      {
        table: "final_round3_items",
        buildQuery: query =>
          query.in("number", [101, 102]),
        logLabel: "DELETE FINAL ROUND 2 IMAGES STORAGE"
      }
    ],

    3: [
      {
        table: "final_round1_items",
        buildQuery: query =>
          query
            .gte("number", 201)
            .lte("number", 209),
        logLabel: "DELETE FINAL ROUND 3 STORAGE"
      }
    ],

    4: [
      {
        table: "final_round3_items",
        buildQuery: query =>
          query
            .gte("number", 1)
            .lte("number", 9),
        logLabel: "DELETE FINAL ROUND 4 STORAGE"
      }
    ]
  }

  const list =
    operations[safeRound] || []

  for (const item of list) {
    const deleted =
      await deleteFinalAdminStorageForQuery(item)

    if (!deleted) {
      return false
    }
  }

  return true
}

function resetFinalRoundAdminCount(round) {
  const resetters = {
    1: () => {
      finalRound1AdminCount = 7
    },
    3: () => {
      finalRound3AdminCount = 5
    },
    4: () => {
      finalRound4AdminCount = 5
    }
  }

  resetters[round]?.()
}

async function refreshFinalAdminAfterDelete(round) {
  invalidateFinalAdminCache()
  await renderFinalAdminRound(round)
  scheduleAdminTabsRefresh()
}

function collectFinalAdminStorageUrls(rows = []) {
  return []
    .concat(rows || [])
    .flatMap(row => {
      return Object
        .values(row || {})
        .filter(value => {
          const text =
            String(value || "").trim()

          return (
            text.startsWith("model_") ||
            text.includes("/storage/v1/object/")
          )
        })
    })
}

async function deleteFinalAdminStorageForQuery({
  table,
  buildQuery,
  logLabel
}) {
  const model =
    Number(currentModel)

  const readResult =
    await dbSelect(
      table,
      query =>
        buildQuery(
          query.eq(
            "model",
            model
          )
        ),
      {
        select: "*",
        fallback: [],
        logLabel:
          `${logLabel} STORAGE READ`
      }
    )

  if (!readResult.ok) {
    console.error(
      `${logLabel} STORAGE READ ERROR:`,
      readResult.error
    )

    showGameToast(
      "تعذر قراءة ملفات الصور والفيديو",
      "error"
    )

    return false
  }

  const urls =
    collectFinalAdminStorageUrls(
      readResult.data || []
    )

  const storageDeleted =
    await deleteAdminStorageUrls(urls)

  if (!storageDeleted) {
    showGameToast(
      "توقف الحذف لأن ملفات الصور والفيديو لم تُحذف",
      "error"
    )

    return false
  }

  return true
}

async function clearFinalAdminItem({
  confirmMessage,
  table,
  buildQuery,
  logLabel,
  errorLabel,
  successMessage,
  renderRound
}) {
  if (!canRunFinalAdminDelete()) return false

  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")
    return false
  }

  const confirmed =
    await showAdminConfirm(
      confirmMessage,
      {
        title: "تأكيد الحذف",
        okText: "حذف",
        cancelText: "إلغاء",
        danger: true
      }
    )

  if (!confirmed) {
    return false
  }

  finalAdminDeleteBusy = true

  try {
    const storageDeleted =
      await deleteFinalAdminStorageForQuery({
        table,
        buildQuery,
        logLabel
      })

    if (!storageDeleted) {
      return false
    }

    const result = await dbDelete(
      table,
      (query) => buildQuery(query.eq("model", Number(currentModel))),
      { logLabel }
    )

    if (!result.ok) {
      console.error(`${logLabel} ERROR:`, result.error)
      showGameToast(errorLabel, "error")
      return false
    }

    showGameToast(successMessage, "success")
    await refreshFinalAdminAfterDelete(renderRound)
    return true
  } finally {
    finalAdminDeleteBusy = false
  }
}

/* =========================
   12) DELETE ACTIONS
========================= */

async function deleteFinalRound(round) {
  if (!canRunFinalAdminDelete()) return

  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")
    return
  }

  const safeRound = Math.min(Math.max(Number(round || 1), 1), 4)
  const title = getFinalAdminRoundTitle(safeRound)

  const confirmed =
    await showAdminConfirm(
      `هل تريد حذف "${title}"؟`,
      {
        title: "حذف فقرة من الفاصلة",
        okText: "حذف الفقرة",
        cancelText: "إلغاء",
        danger: true
      }
    )

  if (!confirmed) {
    return false
  }

  finalAdminDeleteBusy = true

  try {
    const model =
      Number(currentModel)

    const storageDeleted =
      await deleteFinalRoundStorageFiles(
        safeRound
      )

    if (!storageDeleted) {
      showGameToast(
        "توقف الحذف لأن ملفات الفقرة لم تُحذف",
        "error"
      )

      return false
    }

    const metaResult = await dbDelete(
      "final_round_meta",
      (query) => query.eq("model", model).eq("round", safeRound),
      {
        logLabel: "DELETE FINAL ROUND META"
      }
    )

    if (!metaResult.ok) {
      console.log("DELETE FINAL ROUND META ERROR:", metaResult.error)
      showGameToast("تعذر حذف الفقرة")
      return
    }

    const results = await Promise.all(getFinalRoundDeleteOperations(safeRound, model))
    const failedResult = results.find((result) => !result.ok)

    if (failedResult) {
      console.log(failedResult.error)
      showGameToast("تعذر حذف الفقرة")
      return
    }

    resetFinalRoundAdminCount(safeRound)

    showGameToast(`تم حذف ${title}`)
    await refreshFinalAdminAfterDelete(safeRound)
  } catch (err) {
    console.error("DELETE FINAL ROUND CATCH:", err)
    showGameToast("تعذر حذف الفقرة", "error")
  } finally {
    finalAdminDeleteBusy = false
  }
}

async function clearFinalRound1Item(number) {
  const safeNumber = Number(number)

  return clearFinalAdminItem({
    confirmMessage: `حذف رقم ${safeNumber} من ٮدوں ٮڡاط؟`,
    table: "final_round1_items",
    buildQuery: (query) => query.eq("number", safeNumber),
    logLabel: "CLEAR FINAL ROUND 1 ITEM",
    errorLabel: "تعذر حذف العنصر",
    successMessage: `تم حذف رقم ${safeNumber}`,
    renderRound: 1
  })
}

async function clearFinalRound2Item(number) {
  const safeNumber = Number(number)

  return clearFinalAdminItem({
    confirmMessage: `حذف رقم ${safeNumber} من صح صحلي؟`,
    table: "final_round2_items",
    buildQuery: (query) => query.eq("number", safeNumber),
    logLabel: "CLEAR FINAL ROUND 2 ITEM",
    errorLabel: "تعذر حذف الرقم",
    successMessage: `تم حذف رقم ${safeNumber}`,
    renderRound: 2
  })
}

async function clearFinalRound3StoryItem(number) {
  if (!canRunFinalAdminDelete()) return false

  if (!currentModel) {
    showGameToast("افتح النموذج أولاً", "warning")
    return false
  }

  const safeNumber = Number(number || 0)
  const confirmed =
    await showAdminConfirm(
      `حذف رقم ${safeNumber} من قصة؟`,
      {
        title: "حذف رقم من قصة",
        okText: "حذف",
        cancelText: "إلغاء",
        danger: true
      }
    )

  if (!confirmed) return false

  finalAdminDeleteBusy = true

  try {
    const dbNumber = getFinalStoryDbNumber(safeNumber)

    const storageDeleted =
      await deleteFinalAdminStorageForQuery({
        table: "final_round1_items",
        buildQuery: query =>
          query.eq(
            "number",
            Number(dbNumber)
          ),
        logLabel: "CLEAR FINAL STORY ITEM"
      })

    if (!storageDeleted) {
      return false
    }

    const deleteResult = await dbDelete(
      "final_round1_items",
      (query) =>
        query
          .eq("model", Number(currentModel))
          .eq("number", Number(dbNumber)),
      {
        logLabel: "CLEAR FINAL STORY ITEM"
      }
    )

    if (!deleteResult.ok) {
      console.error("CLEAR FINAL STORY ITEM ERROR:", deleteResult.error)
      showGameToast("تعذر حذف العنصر", "error")
      return false
    }

    invalidateFinalAdminCache()
    showGameToast(`تم حذف رقم ${safeNumber}`, "success")
    await renderFinalAdminRound(3)
    scheduleAdminTabsRefresh()

    return true
  } finally {
    finalAdminDeleteBusy = false
  }
}

async function clearFinalRound3Item(number) {
  const safeNumber = Number(number)

  return clearFinalAdminItem({
    confirmMessage: `حذف رقم ${safeNumber} من التركيز؟`,
    table: "final_round3_items",
    buildQuery: (query) => query.eq("number", safeNumber),
    logLabel: "CLEAR FINAL ROUND 3 ITEM",
    errorLabel: "تعذر حذف الرقم",
    successMessage: `تم حذف رقم ${safeNumber}`,
    renderRound: 4
  })
}

async function clearFinalRound2ImageItem(displayNumber) {
  const safeDisplayNumber = Number(displayNumber)
  const dbNumber = getFinalRound2ImageDbNumber(safeDisplayNumber)

  return clearFinalAdminItem({
    confirmMessage: `حذف رقم ${safeDisplayNumber} من صور صح صحلي؟`,
    table: "final_round3_items",
    buildQuery: (query) => query.eq("number", dbNumber),
    logLabel: "CLEAR FINAL ROUND 2 IMAGE ITEM",
    errorLabel: "تعذر حذف الرقم",
    successMessage: `تم حذف رقم ${safeDisplayNumber}`,
    renderRound: 2
  })
}

/* Alias قديم للتوافق */
async function clearFinalRound4Item(displayNumber) {
  return clearFinalRound2ImageItem(displayNumber)
}

/* =========================
   13) PUBLIC EXPORTS
========================= */

Object.assign(window, {
  renderFinalAdmin,
  renderFinalAdminRound,
  saveFinalRound,
  deleteFinalRound,

  changeFinalRound1CardsCount,
  changeFinalRound3Count,
  changeFinalRound4Count,

  syncFinalRound2Answer,
  handleFinalRound2ImageChange,
  handleFinalFocusMediaChange,

  clearFinalRound1Item,
  clearFinalRound2Item,
  clearFinalRound2ImageItem,
  clearFinalRound3StoryItem,
  clearFinalRound3Item,
  clearFinalRound4Item,

  getFinalAdminDoneMap,
  getFinalStoryDbNumber,
  getFinalRound2ImageDbNumber,
  getFinalRound4DbNumber,
  isFinalRound2ImageNumber,
  isFinalRound2ScrambleNumber,
  isFinalRound2SequenceNumber
})