const BUCKET_NAME = "r3-images"

let currentModel = null
let currentModelName = ""
let auctionAdminCount = 8
let gameToastTimer = null

let finalAdminRound = 1
let archiveAdminRound = 1

let top10AdminRoundsCount = 3
let archiveAdminRoundsCount = 4
let archivePendingExtraCount = 0
let archiveExtraTextPositions = []
let archiveDraftState = {}

let currentAdminSegment = ""

const ARCHIVE_TEXT_START_POSITION = 5
const ARCHIVE_MAX_TEXT_BOXES = 20

async function initAdminPanel() {
  await loadModels()
  showAdminEmptyState()
  updateAdminBrandModel()
  await renderAdminTabsUnified()
}
/* =========================
   Toast
========================= */

function showGameToast(message) {
  const toast = document.getElementById("gameToast")
  const text = document.getElementById("gameToastText")

  if (!toast || !text) return

  text.innerText = message
  toast.classList.remove("hidden")

  requestAnimationFrame(() => {
    toast.classList.add("show")
  })

  clearTimeout(gameToastTimer)
  gameToastTimer = setTimeout(() => {
    toast.classList.remove("show")
    setTimeout(() => {
      toast.classList.add("hidden")
    }, 280)
  }, 3000)
}

/* =========================
   Segment Settings
========================= */

async function getSegmentRoundCount(segment, fallback = 3, max = 4) {
  if (!currentModel) return fallback

  const { data, error } = await db
    .from("segment_settings")
    .select("item_count")
    .eq("model", Number(currentModel))
    .eq("segment", segment)
    .maybeSingle()

  if (error) {
    console.log(error)
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
    console.log(error)
    showGameToast("تعذر حفظ عدد الجولات")
    return false
  }

  return true
}

/* =========================
   Helpers
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

function getCurrentModelNameSafe() {
  return currentModelName || `نموذج ${currentModel || ""}`
}

function clearActiveAdminTab() {
  currentAdminSegment = ""
}

/* توافق مع أي كود قديم يستدعي setActiveAdminTab */
function setActiveAdminTab(segment) {
  currentAdminSegment = segment || ""
  renderAdminTabsUnified()
}

function showAdminEmptyState(message = "افتح نموذجًا ثم اختر الفقرة التي تريد تعديلها") {
  const area = editor()
  if (!area) return

  area.innerHTML = `<div class="adminEmptyState">${message}</div>`
}

/* =========================
   Upload Helpers
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

  return `${cleanPrefix}_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
}

function getFileSizeMB(file) {
  return Number((file.size / 1024 / 1024).toFixed(2))
}

function getVideoContentType(file, ext) {
  const type = String(file?.type || "").trim()

  if (type) return type

  if (ext === "mov") return "video/quicktime"
  if (ext === "webm") return "video/webm"
  if (ext === "m4v") return "video/x-m4v"

  return "video/mp4"
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

  const MAX_VIDEO_SIZE_MB = 45
  const maxSize = MAX_VIDEO_SIZE_MB * 1024 * 1024

  if (file.size > maxSize) {
    const sizeMb = (file.size / 1024 / 1024).toFixed(1)

    showGameToast(
      `حجم الفيديو ${sizeMb}MB كبير جدًا. صغّر الفيديو لأقل من ${MAX_VIDEO_SIZE_MB}MB`
    )

    throw new Error(`Video too large: ${sizeMb}MB`)
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

    showGameToast(
      uploadError.message?.includes("maximum allowed size")
        ? "الفيديو أكبر من الحد المسموح في Supabase"
        : "فشل رفع الفيديو، لم يتم الحفظ"
    )

    throw uploadError
  }

  const { data } = db.storage
    .from(BUCKET_NAME)
    .getPublicUrl(fileName)

  return data?.publicUrl || ""
}

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
   Saving Lock
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
   UI Small Helpers
========================= */

function adminSectionHeader({ title, subtitle = "", meta = "", actions = "" }) {
  return `
    <div class="adminCleanSectionHeader">
      <div class="adminCleanSectionText">
        <h2>${escapeHtml(title)}</h2>
        ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ""}
      </div>

      <div class="adminCleanSectionRight">
        ${meta ? `<div class="adminCleanMeta">${meta}</div>` : ""}
        ${actions ? `<div class="adminCleanActions">${actions}</div>` : ""}
      </div>
    </div>
  `
}

function adminCollapseCard({ id, title, badge = "", body = "", open = false }) {
  return `
    <details class="adminCollapseCard" ${open ? "open" : ""}>
      <summary>
        <span class="adminCollapseTitle">${escapeHtml(title)}</span>
        ${badge ? `<span class="adminCollapseBadge">${badge}</span>` : ""}
      </summary>

      <div class="adminCollapseBody">
        ${body}
      </div>
    </details>
  `
}

function adminMiniActions(buttons = []) {
  return `
    <div class="adminMiniActions">
      ${buttons.join("")}
    </div>
  `
}

function adminSmallDeleteButton(onclick, text = "حذف") {
  return `
    <button
      type="button"
      class="adminSmallDangerBtn"
      onclick="${onclick}"
    >
      ${text}
    </button>
  `
}

function adminFieldHtml({ label, input }) {
  return `
    <div class="adminField">
      <label>${escapeHtml(label)}</label>
      ${input}
    </div>
  `
}
function arrangeAdminInnerTabs() {
  const area = editor()
  if (!area) return

  /*
    مهم:
    الفاصلة والأرشيف لا ننقل عناصرهم هنا
    لأن نقلهم هو سبب اللخبطة
    نخليهم في مكانهم الطبيعي ويتنسقون بالـ CSS
  */
  if (
    area.querySelector(".finalAdminShell") ||
    area.querySelector(".archiveAdminShell")
  ) {
    const finalTabs = area.querySelector(".finalAdminRoundsBar")
    const archiveTabs = area.querySelector(".archiveAdminRoundsBar")

    ;(finalTabs || archiveTabs)?.querySelectorAll("button").forEach(btn => {
      btn.classList.remove("innerTabActive")

      if (
        btn.classList.contains("activeFinalAdminRound") ||
        btn.classList.contains("activeArchiveRoundBtn")
      ) {
        btn.classList.add("innerTabActive")
      }
    })

    return
  }

  const topBar = area.querySelector(".adminEditorTopBar")
  if (!topBar) return

  const tabsEl =
    area.querySelector(".warmupCategoryTabs") ||
    area.querySelector(".top10RoundTabs") ||
    area.querySelector(".auctionNumberTabs") ||
    area.querySelector(".whoNumberTabs")

  const countEl =
    area.querySelector(".top10RoundCountBox") ||
    area.querySelector(".auctionCountBox")

  if (!tabsEl && !countEl) return

  topBar.classList.add("adminEditorTopBarWithTabs")

  let toolsBox = topBar.querySelector(".adminInlineTabsBox")

  if (!toolsBox) {
    toolsBox = document.createElement("div")
    toolsBox.className = "adminInlineTabsBox"
    topBar.appendChild(toolsBox)
  }

  toolsBox.innerHTML = ""

  if (countEl) {
    countEl.classList.add("adminInlineCountBox")
    toolsBox.appendChild(countEl)
  }

  if (tabsEl) {
    tabsEl.classList.add("adminInlineSectionTabs")
    toolsBox.appendChild(tabsEl)
  }

  toolsBox.querySelectorAll("button").forEach(btn => {
    btn.classList.remove("innerTabActive")
  })

  const activeSelectors = [
    ".activeWarmupCategoryTab",
    ".activeTop10RoundTab",
    ".activeAuctionNumberTab",
    ".activeWhoNumberTab"
  ]

  activeSelectors.forEach(selector => {
    toolsBox.querySelectorAll(selector).forEach(btn => {
      btn.classList.add("innerTabActive")
    })
  })
}

/* =========================
   Admin Home / Status
========================= */

async function getAdminCompletionCounts() {
  const result = {
    warmup: 0,
    top10: 0,
    auction: 0,
    who: 0,
    final: 0,
    archive: 0,

    top10RoundsCount: 3,
    auctionCount: 8,
    archiveRoundsCount: 4,
    finalRound1CardsCount: 6
  }

  if (!currentModel) return result

  const [
    q1,
    q2,
    q3,
    q4,
    q5,
    q6,
    top10Setting,
    auctionSetting,
    archiveSetting,
    finalMeta
  ] = await Promise.all([
    db.from("questions").select("id", { count: "exact", head: true }).eq("model", currentModel).eq("segment", "warmup"),
    db.from("top10_questions").select("id", { count: "exact", head: true }).eq("model", currentModel),
    db.from("auction_questions").select("id", { count: "exact", head: true }).eq("model", currentModel),
    db.from("who_images").select("id", { count: "exact", head: true }).eq("model", currentModel),
    db.from("final_round1_items").select("id", { count: "exact", head: true }).eq("model", currentModel),
    db.from("archive_boxes").select("id", { count: "exact", head: true }).eq("model", currentModel),

    db.from("segment_settings").select("item_count").eq("model", currentModel).eq("segment", "top10").maybeSingle(),
    db.from("segment_settings").select("item_count").eq("model", currentModel).eq("segment", "auction").maybeSingle(),
    db.from("segment_settings").select("item_count").eq("model", currentModel).eq("segment", "archive").maybeSingle(),
    db.from("final_round_meta").select("cards_count").eq("model", currentModel).eq("round", 1).maybeSingle()
  ])

  result.warmup = q1.count || 0
  result.top10 = q2.count || 0
  result.auction = q3.count || 0
  result.who = q4.count || 0
  result.final = q5.count || 0
  result.archive = q6.count || 0

  result.top10RoundsCount = Math.min(Math.max(Number(top10Setting.data?.item_count || 3), 1), 4)
  result.auctionCount = Math.min(Math.max(Number(auctionSetting.data?.item_count || 8), 1), 8)
  result.archiveRoundsCount = Math.min(Math.max(Number(archiveSetting.data?.item_count || 4), 1), 4)
  result.finalRound1CardsCount = Number(finalMeta.data?.cards_count || 6)

  return result
}

function isSegmentDone(key, count, counts = {}) {
  if (key === "warmup") return count >= 12

  if (key === "top10") {
    const rounds = Math.min(Math.max(Number(counts.top10RoundsCount || 3), 1), 4)
    return count >= rounds * 10
  }

  if (key === "auction") {
    const total = Math.min(Math.max(Number(counts.auctionCount || 8), 1), 8)
    return count >= total
  }

  if (key === "who") return count >= 15

  if (key === "final") {
    const r1Count = Number(counts.finalRound1CardsCount || 6)
    return count >= r1Count
  }

  if (key === "archive") {
    const rounds = Math.min(Math.max(Number(counts.archiveRoundsCount || 4), 1), 4)
    return count >= rounds
  }

  return false
}

/* ألغينا الشريط القديم حتى لا يتكرر مع التابات */
async function buildSegmentStatusGrid() {
  return ""
}

async function renderAdminTabsUnified() {
  const wrap = tabs()
  if (!wrap) return

  if (!currentModel) {
    wrap.classList.add("hidden")
    wrap.innerHTML = ""
    return
  }

  const counts = await getAdminCompletionCounts()

  const items = [
    { key: "warmup", title: "التسخين", count: counts.warmup || 0 },
    { key: "top10", title: "Top 10", count: counts.top10 || 0 },
    { key: "auction", title: "فتبلة", count: counts.auction || 0 },
    { key: "who", title: "من هو", count: counts.who || 0 },
    { key: "final", title: "الفاصلة", count: counts.final || 0 },
    { key: "archive", title: "الأرشيف", count: counts.archive || 0 }
  ]

  wrap.classList.remove("hidden")

  wrap.innerHTML = `
    <div class="adminTabsUnified">
      ${items.map(item => {
        const done = isSegmentDone(item.key, item.count, counts)
        const active = currentAdminSegment === item.key

        return `
          <button
            type="button"
            class="adminTabBtnUnified ${active ? "activeAdminTab" : ""} ${done ? "doneCard" : ""}"
            onclick="openAdminSegment('${item.key}')"
          >
            <span class="adminTabBtnLabel">${item.title}</span>
            <span class="adminTabBtnCount">${item.count}</span>
          </button>
        `
      }).join("")}
    </div>
  `
}

async function renderAdminHome() {
  if (!currentModel) {
    clearActiveAdminTab()
    showAdminEmptyState()
    updateAdminBrandModel()
    await renderAdminTabsUnified()
    return
  }

  clearActiveAdminTab()
  updateAdminBrandModel()
  await renderAdminTabsUnified()

  const counts = await getAdminCompletionCounts()

  const segmentCards = [
    { key: "warmup", title: "التسخين", desc: "أسئلة البداية السريعة", count: counts.warmup || 0 },
    { key: "top10", title: "Top 10", desc: "جولات ترتيب حسب العدد المحدد", count: counts.top10 || 0 },
    { key: "auction", title: "فتبلة", desc: "أسئلة الصور والفتبلة", count: counts.auction || 0 },
    { key: "who", title: "من هو", desc: "تخمين الشخصية", count: counts.who || 0 },
    { key: "final", title: "الفاصلة", desc: "الجولات النهائية", count: counts.final || 0 },
    { key: "archive", title: "الأرشيف", desc: "بطولات وأرشيف", count: counts.archive || 0 }
  ]

  editor().innerHTML = `
    <div class="adminHomeShell">

      <div class="adminHomeTopActions">
        <button class="adminSaveBtn" onclick="checkCurrentModelReady()">
          فحص النموذج
        </button>

        <button class="adminReloadBtn" onclick="renderAdminHome()">
          تحديث
        </button>
      </div>

      <div class="adminSegmentPickerCompact">
        ${segmentCards.map(item => {
          const done = isSegmentDone(item.key, item.count, counts)

          return `
            <button class="adminSegmentCompactCard ${done ? "doneCard" : ""}" onclick="openAdminSegment('${item.key}')">
              <div class="adminSegmentCompactTop">
                <span class="adminSegmentCompactTitle">${item.title}</span>
                <span class="adminSegmentCompactBadge ${done ? "done" : ""}">
                  ${done ? "مكتمل" : "غير مكتمل"}
                </span>
              </div>

              <div class="adminSegmentCompactDesc">${item.desc}</div>

              <div class="adminSegmentCompactFooter">
                <span class="adminSegmentCompactMetaLabel">عدد العناصر</span>
                <span class="adminSegmentCompactMetaValue">${item.count}</span>
              </div>
            </button>
          `
        }).join("")}
      </div>
    </div>
  `
}

/* =========================
   Model Readiness Check
========================= */

function readinessItem(title, ok, details = []) {
  return {
    title,
    ok: !!ok,
    details: Array.isArray(details) ? details : [String(details || "")]
  }
}

function hasText(value) {
  return String(value || "").trim().length > 0
}

function closeModelCheckModal() {
  document.getElementById("modelCheckModal")?.remove()
}

function renderModelCheckModal(results) {
  const allOk = results.every(item => item.ok)

  const oldModal = document.getElementById("modelCheckModal")
  if (oldModal) oldModal.remove()

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
    const results = []

    results.push(await checkWarmupReady())
    results.push(await checkTop10Ready())
    results.push(await checkAuctionReady())
    results.push(await checkWhoReady())
    results.push(await checkFinalReady())
    results.push(await checkArchiveReady())

    renderModelCheckModal(results)
  } catch (err) {
    console.log("MODEL CHECK ERROR:", err)
    showGameToast("تعذر فحص النموذج")
  }
}

/* =========================
   Ready Checks
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
  const requiredCount = await getSegmentRoundCount("auction", 8, 8)

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
    if (!hasText(row.image)) missing.push(`السؤال ${i}: الصورة غير موجودة`)
  }

  return readinessItem(
    "فتبلة",
    missing.length === 0,
    missing.length ? missing : [`مكتملة حسب عدد الأسئلة: ${requiredCount}`]
  )
}

async function checkWhoReady() {
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

  for (let i = 1; i <= 15; i++) {
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
    missing.length ? missing : ["15 عنصر مكتملة"]
  )
}

async function checkFinalReady() {
  const [metaRes, r1Res, r2Res, r3Res] = await Promise.all([
    db.from("final_round_meta").select("*").eq("model", Number(currentModel)),
    db.from("final_round1_items").select("*").eq("model", Number(currentModel)),
    db.from("final_round2_items").select("*").eq("model", Number(currentModel)),
    db.from("final_round3_items").select("*").eq("model", Number(currentModel))
  ])

  if (metaRes.error || r1Res.error || r2Res.error || r3Res.error) {
    console.log(metaRes.error || r1Res.error || r2Res.error || r3Res.error)
    return readinessItem("الفاصلة", false, ["تعذر قراءة بيانات الفاصلة"])
  }

  const missing = []

  const metaMap = {}
  ;(metaRes.data || []).forEach(row => {
    metaMap[Number(row.round)] = row
  })

  const r1CardsCount = Number(metaMap[1]?.cards_count || 6)

  const r1Map = {}
  ;(r1Res.data || []).forEach(row => {
    r1Map[Number(row.number)] = row
  })

  for (let i = 1; i <= r1CardsCount; i++) {
    const row = r1Map[i]

    if (!row) {
      missing.push(`الفاصلة - الجولة 1 - رقم ${i} غير موجود`)
      continue
    }

    if (i <= 3) {
      if (!hasText(row.card_text) && !hasText(row.image)) {
        missing.push(`الفاصلة - الجولة 1 - رقم ${i}: لا يوجد نص قصاصة أو صورة`)
      }
    }

    if (i >= 4 && i <= 6) {
      const hasAnyQuestionPart =
        hasText(row.question_part1) ||
        hasText(row.question_part2) ||
        hasText(row.question_part3)

      if (!hasAnyQuestionPart) {
        missing.push(`الفاصلة - الجولة 1 - رقم ${i}: أجزاء السؤال فارغة`)
      }
    }

    if (!hasText(row.answer)) {
      missing.push(`الفاصلة - الجولة 1 - رقم ${i}: الإجابة فارغة`)
    }
  }

  const r2Map = {}
  ;(r2Res.data || []).forEach(row => {
    r2Map[`${Number(row.number)}_${Number(row.item_order)}`] = row
  })

  for (let number = 1; number <= 4; number++) {
    const isScramble = number === 1 || number === 3

    for (let i = 1; i <= 6; i++) {
      const row = r2Map[`${number}_${i}`]

      if (!row) {
        missing.push(`الفاصلة - الجولة 2 - رقم ${number} - العنصر ${i} غير موجود`)
        continue
      }

      if (!hasText(row.prompt)) {
        missing.push(`الفاصلة - الجولة 2 - رقم ${number} - العنصر ${i}: النص فارغ`)
      }

      if (isScramble && !hasText(row.answer)) {
        missing.push(`الفاصلة - الجولة 2 - رقم ${number} - العنصر ${i}: الإجابة فارغة`)
      }
    }
  }

  const r3Map = {}
  ;(r3Res.data || []).forEach(row => {
    r3Map[`${Number(row.number)}_${Number(row.image_order)}`] = row
  })

  for (let number = 1; number <= 2; number++) {
    for (let i = 1; i <= 5; i++) {
      const row = r3Map[`${number}_${i}`]

      if (!row) {
        missing.push(`الفاصلة - الجولة 3 - رقم ${number} - الصورة ${i} غير موجودة`)
        continue
      }

      if (!hasText(row.image)) {
        missing.push(`الفاصلة - الجولة 3 - رقم ${number} - الصورة ${i}: الصورة غير موجودة`)
      }

      if (!hasText(row.answer)) {
        missing.push(`الفاصلة - الجولة 3 - رقم ${number} - الصورة ${i}: الإجابة فارغة`)
      }
    }
  }

  return readinessItem(
    "الفاصلة",
    missing.length === 0,
    missing.length ? missing : ["الجولات الثلاث مكتملة"]
  )
}

async function checkArchiveReady() {
  const maxRound = await getSegmentRoundCount("archive", 4, 4)

  const [boxesRes, itemsRes] = await Promise.all([
    db.from("archive_boxes").select("*").eq("model", Number(currentModel)),
    db.from("archive_items").select("*").eq("model", Number(currentModel))
  ])

  if (boxesRes.error || itemsRes.error) {
    console.log(boxesRes.error || itemsRes.error)
    return readinessItem("الأرشيف", false, ["تعذر قراءة بيانات الأرشيف"])
  }

  const boxMap = {}
  ;(boxesRes.data || []).forEach(row => {
    boxMap[Number(row.round)] = row
  })

  const itemsByRound = {}
  ;(itemsRes.data || []).forEach(row => {
    const r = Number(row.round)
    if (!itemsByRound[r]) itemsByRound[r] = []
    itemsByRound[r].push(row)
  })

  const missing = []

  for (let r = 1; r <= maxRound; r++) {
    const box = boxMap[r]
    const items = itemsByRound[r] || []

    if (!box) {
      missing.push(`الأرشيف - الجولة ${r}: صندوق الجولة غير موجود`)
    } else {
      if (!hasText(box.tournament)) missing.push(`الأرشيف - الجولة ${r}: البطولة فارغة`)
      if (!hasText(box.season)) missing.push(`الأرشيف - الجولة ${r}: الموسم فارغ`)
      if (!hasText(box.score)) missing.push(`الأرشيف - الجولة ${r}: النتيجة فارغة`)
    }

    const map = {}
    items.forEach(item => {
      map[Number(item.position)] = item
    })

    for (const pos of [1, 2]) {
      if (!map[pos] || !hasText(map[pos].text)) {
        missing.push(`الأرشيف - الجولة ${r}: النص ${pos} فارغ`)
      }
    }

    for (const pos of [3, 4]) {
      if (!map[pos] || !hasText(map[pos].image)) {
        missing.push(`الأرشيف - الجولة ${r}: الصورة ${pos} غير موجودة`)
      }
    }

    const textItems = items.filter(item => Number(item.position) >= 5)
    const requiredItems = textItems.filter(item => String(item.label || "").trim() === "المطلوب")

    if (!textItems.length) {
      missing.push(`الأرشيف - الجولة ${r}: لا توجد عناصر نصية تحت الصور`)
    }

    if (!requiredItems.length) {
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
    missing.length ? missing : [`مكتمل حسب عدد الجولات: ${maxRound}`]
  )
}

/* =========================
   Model Actions
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

  const { data, error } = await db
    .from("models")
    .insert({ name })
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
    currentModel = data.id
    currentModelName = data.name || name
    updateAdminBrandModel()

    const list = document.getElementById("modelsList")
    if (list) list.value = String(data.id)

    tabs()?.classList.remove("hidden")
    await renderAdminHome()
  }

  showGameToast("تم إنشاء النموذج")
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

  const oldModal = document.getElementById("renameModelModal")
  if (oldModal) oldModal.remove()

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

    input.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault()
        submitRenameModel(id)
      }

      if (e.key === "Escape") {
        e.preventDefault()
        closeRenameModelModal()
      }
    })
  }
}

function closeRenameModelModal() {
  const modal = document.getElementById("renameModelModal")
  if (modal) modal.remove()
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

async function openSelectedModel() {
  const list = document.getElementById("modelsList")
  const id = Number(list?.value || 0)

  if (!id) {
    showGameToast("اختر النموذج")
    return
  }

  currentModel = id
  currentModelName = list.options[list.selectedIndex]?.textContent || `نموذج ${id}`

  updateAdminBrandModel()
  tabs()?.classList.remove("hidden")

  await renderAdminHome()
  showGameToast(`تم فتح ${currentModelName}`)
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

  const ok = confirm(
    `هل تريد حذف "${modelName}" نهائيًا؟\n\nسيتم حذف كل بيانات النموذج من جميع الفقرات.`
  )

  if (!ok) return

  try {
    showGameToast("جارٍ حذف النموذج...")

    const deleteJobs = [
      db.from("questions").delete().eq("model", id),
      db.from("top10_questions").delete().eq("model", id),
      db.from("auction_questions").delete().eq("model", id),
      db.from("who_images").delete().eq("model", id),

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
   Tabs
========================= */

async function openAdminSegment(segment) {
  if (!currentModel) {
    showGameToast("افتح نموذج أولاً")
    return
  }

  currentAdminSegment = segment
  await renderAdminTabsUnified()

  if (segment === "warmup") await renderWarmupAdmin()
  if (segment === "top10") await renderTop10Admin()
  if (segment === "auction") await renderAuctionAdmin()
  if (segment === "who") await renderWhoAdmin()
  if (segment === "final") await renderFinalAdmin()
  if (segment === "archive") await renderArchiveAdmin()
}

/* =========================
   Delete / Clear Helpers
========================= */

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
      console.log(error)
      showGameToast("تعذر حذف الجولة")
      return
    }

    showGameToast(`تم حذف الجولة ${r}`)
    await renderTop10Admin()
  } catch (err) {
    console.log(err)
    showGameToast("حدث خطأ أثناء حذف الجولة")
  }
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
    const { error } = await db
      .from("top10_questions")
      .delete()
      .eq("model", Number(currentModel))

    if (error) {
      console.log(error)
      showGameToast("تعذر حذف فقرة Top 10")
      return
    }

    showGameToast("تم حذف فقرة Top 10")
    await renderTop10Admin()
  } catch (err) {
    console.log(err)
    showGameToast("حدث خطأ أثناء حذف فقرة Top 10")
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
      console.log(error)
      showGameToast("تعذر حذف السؤال")
      return
    }

    showGameToast(`تم حذف السؤال ${i}`)
    await renderAuctionAdmin()
  } catch (err) {
    console.log(err)
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
    const { error: rowsError } = await db
      .from("auction_questions")
      .delete()
      .eq("model", Number(currentModel))

    if (rowsError) {
      console.log(rowsError)
      showGameToast("تعذر حذف الفقرة")
      return
    }

    const { error: settingsError } = await db
      .from("segment_settings")
      .delete()
      .eq("model", Number(currentModel))
      .eq("segment", "auction")

    if (settingsError) {
      console.log(settingsError)
    }

    auctionAdminCount = 8
    showGameToast("تم حذف فقرة فتبلة")
    await renderAuctionAdmin()
  } catch (err) {
    console.log(err)
    showGameToast("حدث خطأ أثناء حذف الفقرة")
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
      console.log(error)
      showGameToast("تعذر حذف العنصر")
      return
    }

    showGameToast(`تم حذف العنصر ${i}`)
    await renderWhoAdmin()
  } catch (err) {
    console.log(err)
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
    const { error } = await db
      .from("who_images")
      .delete()
      .eq("model", Number(currentModel))

    if (error) {
      console.log(error)
      showGameToast("تعذر حذف فقرة من هو")
      return
    }

    showGameToast("تم حذف فقرة من هو")
    await renderWhoAdmin()
  } catch (err) {
    console.log(err)
    showGameToast("حدث خطأ أثناء حذف فقرة من هو")
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
    console.log(error)
    showGameToast("تعذر حذف الإجابة")
    return
  }

  showGameToast(`تم حذف إجابة رقم ${position}`)
  await renderTop10Admin()
}

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
    console.log(error)
    showGameToast("تعذر حذف العنصر")
    return
  }

  showGameToast(`تم حذف العنصر ${position}`)
  await renderArchiveAdminRound(round)
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
      const { error: itemsError } = await db
        .from("archive_items")
        .delete()
        .eq("model", Number(currentModel))
        .eq("round", safeRound)

      if (itemsError) {
        console.log(itemsError)
        showGameToast("تعذر حذف عناصر الجولة")
        return
      }

      const { error: boxError } = await db
        .from("archive_boxes")
        .delete()
        .eq("model", Number(currentModel))
        .eq("round", safeRound)

      if (boxError) {
        console.log(boxError)
        showGameToast("تعذر حذف صندوق الجولة")
        return
      }

      showGameToast(`تم حذف الجولة ${safeRound}`)
      archivePendingExtraCount = 0
      archiveDraftState = {}

      await renderArchiveAdminRound(safeRound)
      return
    }

    const { error: itemsError } = await db
      .from("archive_items")
      .delete()
      .eq("model", Number(currentModel))

    if (itemsError) {
      console.log(itemsError)
      showGameToast("تعذر حذف عناصر الأرشيف")
      return
    }

    const { error: boxesError } = await db
      .from("archive_boxes")
      .delete()
      .eq("model", Number(currentModel))

    if (boxesError) {
      console.log(boxesError)
      showGameToast("تعذر حذف صناديق الأرشيف")
      return
    }

    const { error: settingsError } = await db
      .from("segment_settings")
      .delete()
      .eq("model", Number(currentModel))
      .eq("segment", "archive")

    if (settingsError) {
      console.log(settingsError)
    }

    archiveAdminRoundsCount = 4
    archiveAdminRound = 1
    archivePendingExtraCount = 0
    archiveDraftState = {}

    showGameToast("تم حذف الأرشيف بالكامل")
    await renderArchiveAdmin()
  } catch (err) {
    console.log("DELETE ARCHIVE SEGMENT ERROR:", err)
    showGameToast("حدث خطأ أثناء حذف الأرشيف")
  }
}
function isWarmupDraftComplete(category) {
  const cat = getWarmupDraftCategory(category)

  const categoryName = String(cat.category_name || "").trim()
  const q1 = cat.questions[1] || {}
  const q2 = cat.questions[2] || {}
  const q4 = cat.questions[4] || {}

  return (
    categoryName &&
    String(q1.question || "").trim() &&
    String(q1.answer || "").trim() &&
    String(q2.question || "").trim() &&
    String(q2.answer || "").trim() &&
    String(q4.question || "").trim() &&
    String(q4.answer || "").trim()
  )
}

function isTop10DraftComplete(roundNumber) {
  const round = getTop10DraftRound(roundNumber)
  const question = String(round.question || "").trim()

  if (!question) return false

  for (let i = 1; i <= 10; i++) {
    if (!String(round.answers[i] || "").trim()) return false
  }

  return true
}

function isAuctionDraftComplete(number) {
  const item = getAuctionDraftItem(number)

  return (
    String(item.question || "").trim() &&
    String(item.answer || "").trim() &&
    String(item.image || "").trim()
  )
}

function isWhoDraftComplete(number) {
  const item = getWhoDraftItem(number)

  return (
    String(item.image || "").trim() &&
    String(item.answer || "").trim()
  )
}
/* =========================
   Warmup - Compact Admin
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
  const c = Number(warmupAdminActiveCategory || 1)
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

function switchWarmupAdminCategory(category) {
  collectWarmupCurrentDraft()
  warmupAdminActiveCategory = Number(category || 1)
  renderWarmupAdminFromDraft()
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
      cat.questions[number].question = ""
      cat.questions[number].answer = ""
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

    const c = Number(warmupAdminActiveCategory || 1)
    const cat = getWarmupDraftCategory(c)

    for (const n of [1, 2, 4]) {
      if (Number(cat.questions[n]?.id) === Number(id)) {
        cat.questions[n] = { id: null, question: "", answer: "" }
      }
    }

    showGameToast("تم حذف السؤال")
    await renderWarmupAdmin()
  } catch (err) {
    console.log("DELETE WARMUP BY ID CATCH:", err)
    showGameToast("حدث خطأ أثناء حذف السؤال")
  }
}

async function deleteWarmupSegment() {
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
  } catch (err) {
    console.log("DELETE WARMUP SEGMENT CATCH:", err)
    showGameToast("حدث خطأ أثناء حذف فقرة التسخين")
  }
}

async function renderWarmupAdmin() {
  const { data, error } = await db
    .from("questions")
    .select("*")
    .eq("model", currentModel)
    .eq("segment", "warmup")
    .order("category", { ascending: true })
    .order("number", { ascending: true })

  if (error) {
    console.log(error)
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
  const c = Number(warmupAdminActiveCategory || 1)
  const cat = getWarmupDraftCategory(c)

  const q1 = cat.questions[1] || { id: null, question: "", answer: "" }
  const q2 = cat.questions[2] || { id: null, question: "", answer: "" }
  const q4 = cat.questions[4] || { id: null, question: "", answer: "" }

  const html = `
    <div class="warmupAdminShell compactWarmupAdminShell">
      <div class="adminEditorTopBar compactAdminEditorTopBar">
        <div>
          <h2 class="adminSectionTitle">التسخين</h2>
          
        </div>
      </div>

      ${await buildSegmentStatusGrid()}

      <div class="warmupCategoryTabs">
        ${[1, 2, 3, 4].map(num => {
  const complete = isWarmupDraftComplete(num)

  return `
    <button
      type="button"
      class="warmupCategoryTab
        ${c === num ? "activeWarmupCategoryTab" : ""}
        ${complete ? "innerTabDone warmupCategoryDone" : ""}
        ${c === num && complete ? "warmupCategoryActiveDone" : ""}"
      onclick="switchWarmupAdminCategory(${num})"
    >
      الفئة ${num}
    </button>
  `
}).join("")}
      </div>

      <div class="adminCard warmupSingleCategoryCard">
        <div class="warmupSingleCategoryHead">
          <div>
            <h3>الفئة ${c}</h3>
            
          </div>

          <div class="warmupCategoryBadge">الفئة الحالية</div>
        </div>

        <div class="adminField warmupCategoryNameField">
          <label>اسم الفئة</label>
          <input
            id="cat${c}"
            placeholder="مثال: رياضة، تاريخ، جغرافيا..."
            value="${escapeHtml(cat.category_name || "")}"
          >
        </div>

        <div class="warmupQuestionsCompactGrid">

          ${buildWarmupQuestionCompactCard(c, 1, q1)}
          ${buildWarmupQuestionCompactCard(c, 2, q2)}
          ${buildWarmupQuestionCompactCard(c, 4, q4)}

        </div>
      </div>

            <div class="adminActionRow warmupStickyActions">
        <button onclick="saveWarmup()" class="adminSaveBtn">حفظ التسخين</button>
        <button onclick="deleteWarmupSegment()" class="adminDeleteAllBtn">حذف الفقرة</button>
        <button onclick="renderWarmupAdmin()" class="adminReloadBtn">إعادة تحميل</button>
      </div>
    </div>
  `

  editor().innerHTML = html
  arrangeAdminInnerTabs()
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
        console.log(clearError)
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
      console.log(oldError)
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
      console.log(saveError)
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
          console.log(deleteError)
          showGameToast("تم الحفظ لكن تعذر تنظيف بعض الأسئلة القديمة")
          return false
        }
      }
    }

    showGameToast("تم حفظ التسخين")
    await renderWarmupAdmin()
    return true

  } catch (err) {
    console.log("SAVE WARMUP ERROR:", err)
    showGameToast("توقف حفظ التسخين بسبب خطأ")
    return false
  } finally {
    setAdminSaving(false)
  }
}

/* =========================
   Top10 - Compact Admin
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
  const r = Number(top10AdminActiveRound || 1)
  const round = getTop10DraftRound(r)

  round.question = (document.getElementById(`topq${r}`)?.value || "").trim()

  for (let i = 1; i <= 10; i++) {
    round.answers[i] = (document.getElementById(`top${r}_${i}`)?.value || "").trim()
  }
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

async function renderTop10Admin() {
  top10AdminRoundsCount = await getSegmentRoundCount("top10", 3, 4)

  const { data, error } = await db
    .from("top10_questions")
    .select("*")
    .eq("model", currentModel)
    .order("round", { ascending: true })
    .order("position", { ascending: true })

  if (error) {
    console.log(error)
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

  renderTop10AdminFromDraft()
}

async function renderTop10AdminFromDraft() {
  const r = Number(top10AdminActiveRound || 1)
  const round = getTop10DraftRound(r)

  const html = `
    <div class="top10AdminShell compactTop10AdminShell">
      <div class="adminEditorTopBar compactAdminEditorTopBar">
        <div>
          <h2 class="adminSectionTitle">Top 10</h2>
          
        </div>
      </div>

      ${await buildSegmentStatusGrid()}

      <div class="top10ControlPanel">
        <div class="top10RoundCountBox">
          <div class="adminField compactCountField">
            
            <div class="compactCountSelectWrap">
              <select id="top10RoundsCountInput" class="compactCountSelect">
                <option value="1" ${top10AdminRoundsCount === 1 ? "selected" : ""}>1</option>
                <option value="2" ${top10AdminRoundsCount === 2 ? "selected" : ""}>2</option>
                <option value="3" ${top10AdminRoundsCount === 3 ? "selected" : ""}>3</option>
                <option value="4" ${top10AdminRoundsCount === 4 ? "selected" : ""}>4</option>
              </select>
            </div>
          </div>

          <button onclick="applyTop10RoundsCount()" class="adminBtn adminBtnMango compactCountBtn">
            حفظ العدد
          </button>
        </div>

        <div class="top10RoundTabs">
          ${Array.from({ length: top10AdminRoundsCount }, (_, i) => i + 1).map(num => {
  const complete = isTop10DraftComplete(num)

  return `
    <button
      type="button"
      class="top10RoundTab
        ${r === num ? "activeTop10RoundTab" : ""}
        ${complete ? "innerTabDone top10RoundDone" : ""}
        ${r === num && complete ? "top10RoundActiveDone" : ""}"
      onclick="switchTop10AdminRound(${num})"
    >
      الجولة ${num}
    </button>
  `
}).join("")}
        </div>
      </div>

      <div class="adminCard top10SingleRoundCard">
        <div class="top10SingleRoundHead">
          <div>
            <h3>الجولة ${r}</h3>
            
          </div>

          <button class="adminDeleteBtn" onclick="clearTop10Round(${r})">
            حذف الجولة
          </button>
        </div>

        <div class="adminField top10QuestionField">
          <label>السؤال الرئيسي</label>
          <input
            id="topq${r}"
            placeholder="اكتب السؤال الرئيسي للجولة ${r}"
            value="${escapeHtml(round.question || "")}"
          >
        </div>

        <div class="top10AnswersCompactGrid">
          ${Array.from({ length: 10 }, (_, i) => i + 1).map(i => `
            <div class="top10AnswerCompactRow">
              <div class="top10AnswerNo">${i}</div>

              <input
                id="top${r}_${i}"
                placeholder="إجابة ${i}"
                value="${escapeHtml(round.answers[i] || "")}"
              >

              <button
                type="button"
                class="adminDeleteMiniBtn"
                onclick="deleteTop10Item(${r}, ${i})"
                ${round.answers[i] ? "" : "disabled"}
              >
                حذف
              </button>
            </div>
          `).join("")}
        </div>
      </div>

            <div class="adminActionRow top10StickyActions">
        <button onclick="saveTop10()" class="adminSaveBtn">حفظ Top 10</button>
        <button onclick="deleteTop10Segment()" class="adminDeleteAllBtn">حذف الفقرة</button>
        <button onclick="renderTop10Admin()" class="adminReloadBtn">إعادة تحميل</button>
      </div>
    </div>
  `

  editor().innerHTML = html
  arrangeAdminInnerTabs()
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

    const count = Number(
      document.getElementById("top10RoundsCountInput")?.value || 3
    )

    top10AdminRoundsCount = Math.min(Math.max(count, 1), 4)

    const saved = await saveSegmentRoundCount("top10", top10AdminRoundsCount)
    if (!saved) return false

    if (top10AdminActiveRound > top10AdminRoundsCount) {
      top10AdminActiveRound = top10AdminRoundsCount
    }

    showGameToast("تم حفظ عدد جولات Top 10")
    await renderTop10AdminFromDraft()
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

    top10AdminRoundsCount = Number(
      document.getElementById("top10RoundsCountInput")?.value ||
      top10AdminRoundsCount ||
      3
    )

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

    const savedCount = await saveSegmentRoundCount("top10", top10AdminRoundsCount)
    if (!savedCount) return false

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
        console.log(clearError)
        showGameToast("تعذر حذف بيانات Top 10")
        return false
      }

      top10AdminDraft = {}
      top10AdminActiveRound = 1

      showGameToast("تم حذف جميع بيانات Top 10")
      await renderTop10Admin()
      return true
    }

    const { error: saveError } = await db
      .from("top10_questions")
      .upsert(rows, {
        onConflict: "model,round,position"
      })

    if (saveError) {
      console.log(saveError)
      showGameToast("فشل حفظ Top 10")
      return false
    }

    const { data: oldRows, error: oldError } = await db
      .from("top10_questions")
      .select("round, position")
      .eq("model", Number(currentModel))

    if (oldError) {
      console.log(oldError)
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
          console.log(deleteError)
          showGameToast("تم الحفظ لكن تعذر تنظيف بعض بيانات Top 10")
          return false
        }
      }
    }

    showGameToast("تم حفظ Top 10")
    await renderTop10Admin()
    return true

  } catch (err) {
    console.log("SAVE TOP10 ERROR:", err)
    showGameToast("توقف حفظ Top 10 بسبب خطأ")
    return false
  } finally {
    setAdminSaving(false)
  }
}

/* =========================
   Auction - Compact Admin
========================= */

let auctionAdminActiveNumber = 1
let auctionAdminDraft = {}

function getAuctionDraftItem(number) {
  const n = Number(number || 1)

  if (!auctionAdminDraft[n]) {
    auctionAdminDraft[n] = {
      question: "",
      answer: "",
      note: "",
      image: "",
      video: "",
      file: null,
      videoFile: null
    }
  }

  return auctionAdminDraft[n]
}

function collectAuctionCurrentDraft() {
  const n = Number(auctionAdminActiveNumber || 1)
  const item = getAuctionDraftItem(n)

  item.question = (document.getElementById(`auction${n}`)?.value || "").trim()
  item.answer = (document.getElementById(`auctionAnswer${n}`)?.value || "").trim()
  item.note = (document.getElementById(`auctionNote${n}`)?.value || "").trim()

  const file = document.getElementById(`auctionFile${n}`)?.files?.[0] || null
  if (file) item.file = file
  const videoFile = document.getElementById(`auctionVideo${n}`)?.files?.[0] || null
  if (videoFile) item.videoFile = videoFile
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
    console.log("AUCTION LOAD ERROR:", error)
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

  auctionAdminCount = Math.min(
    Math.max(Number(settingsData?.item_count || 8), 1),
    8
  )

  auctionAdminDraft = {}

  for (let i = 1; i <= 8; i++) {
    getAuctionDraftItem(i)
  }

  ;(data || []).forEach(row => {
    const n = Number(row.number || 1)
    const item = getAuctionDraftItem(n)

    item.question = row.question || ""
    item.answer = row.answer || ""
    item.note = row.note || ""
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


function isAuctionDraftComplete(number) {
  const item = getAuctionDraftItem(number)

  const question = String(item.question || "").trim()
  const answer = String(item.answer || "").trim()
  const image = String(item.image || "").trim()
  const video = String(item.video || "").trim()
  const file = item.file
  const videoFile = item.videoFile

  return !!(question && answer && (image || video || file || videoFile))
}

async function renderAuctionAdminFromDraft() {
  const n = Number(auctionAdminActiveNumber || 1)
  const item = getAuctionDraftItem(n)

  const area = editor()
  if (!area) return

  area.innerHTML = `
    <div class="auctionAdminShell compactAuctionAdminShell">
      <div class="adminEditorTopBar compactAdminEditorTopBar">
        <div>
          <h2 class="adminSectionTitle">فتبلة</h2>
        </div>
      </div>

      ${await buildSegmentStatusGrid()}

      <div class="auctionControlPanel">
        <div class="auctionCountBox">
          <div class="adminField compactCountField">
            <label for="auctionCountInput">عدد الأسئلة</label>

            <div class="compactCountSelectWrap">
              <select id="auctionCountInput" class="compactCountSelect">
                <option value="1" ${auctionAdminCount === 1 ? "selected" : ""}>1</option>
                <option value="2" ${auctionAdminCount === 2 ? "selected" : ""}>2</option>
                <option value="3" ${auctionAdminCount === 3 ? "selected" : ""}>3</option>
                <option value="4" ${auctionAdminCount === 4 ? "selected" : ""}>4</option>
                <option value="5" ${auctionAdminCount === 5 ? "selected" : ""}>5</option>
                <option value="6" ${auctionAdminCount === 6 ? "selected" : ""}>6</option>
                <option value="7" ${auctionAdminCount === 7 ? "selected" : ""}>7</option>
                <option value="8" ${auctionAdminCount === 8 ? "selected" : ""}>8</option>
              </select>
            </div>
          </div>

          <button onclick="applyAuctionCount()" class="adminBtn adminBtnMango compactCountBtn">
            حفظ العدد
          </button>
        </div>

        <div class="auctionNumberTabs">
          ${Array.from({ length: auctionAdminCount }, (_, idx) => idx + 1).map(num => {
            const complete = isAuctionDraftComplete(num)

            return `
              <button
                type="button"
                class="auctionNumberTab
                  ${n === num ? "activeAuctionNumberTab" : ""}
                  ${complete ? "auctionNumberDone" : ""}
                  ${n === num && complete ? "auctionNumberActiveDone" : ""}"
                onclick="switchAuctionAdminNumber(${num})"
              >
                ${num}
              </button>
            `
          }).join("")}
        </div>
      </div>

      <div class="adminCard auctionSingleQuestionCard">
        <div class="auctionSingleQuestionHead">
          <div>
            <h3>السؤال ${n}</h3>
            
          </div>

          <button class="adminDeleteBtn" onclick="clearAuctionQuestion(${n})">
            حذف السؤال
          </button>
        </div>

        <div class="auctionSingleLayout">
          <div class="auctionImagePanel">
            <div class="adminField">
              <label>الصورة</label>
              <input type="file" id="auctionFile${n}" accept="image/*">
<input type="file" id="auctionVideo${n}" accept="video/*">
            </div>

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

          <div class="auctionFieldsPanel">
            <div class="adminField">
              <label>السؤال</label>
              <textarea
                id="auction${n}"
                placeholder="اكتب نص السؤال"
              >${escapeHtml(item.question || "")}</textarea>
            </div>

            <div class="adminField">
              <label>الإجابة</label>
              <input
                id="auctionAnswer${n}"
                placeholder="الإجابة"
                value="${escapeHtml(item.answer || "")}"
              >
            </div>

            <div class="adminField">
              <label>ملاحظة اختيارية</label>
              <input
                id="auctionNote${n}"
                placeholder="ملاحظة اختيارية"
                value="${escapeHtml(item.note || "")}"
              >
            </div>
          </div>
        </div>
      </div>

      <div class="adminActionRow auctionStickyActions">
        <button onclick="saveAuction()" class="adminSaveBtn">حفظ فتبلة</button>
        <button onclick="deleteAuctionSegment()" class="adminDeleteAllBtn">حذف الفقرة</button>
        <button onclick="renderAuctionAdmin()" class="adminReloadBtn">إعادة تحميل</button>
      </div>
    </div>
  `

  arrangeAdminInnerTabs()
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
      console.log(error)
      showGameToast("تعذر حفظ عدد الأسئلة")
      return false
    }

    if (auctionAdminActiveNumber > auctionAdminCount) {
      auctionAdminActiveNumber = auctionAdminCount
    }

    showGameToast("تم حفظ عدد أسئلة فتبلة")
    await renderAuctionAdminFromDraft()
    return true

  } catch (err) {
    console.log("APPLY AUCTION COUNT ERROR:", err)
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

    const count = Number(
      document.getElementById("auctionCountInput")?.value ||
      auctionAdminCount ||
      8
    )

    const finalCount = Math.min(Math.max(count, 1), 8)

    const { data: oldRows, error: oldError } = await db
      .from("auction_questions")
      .select("number, image, video")
      .eq("model", Number(currentModel))

    if (oldError) {
      console.log(oldError)
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

      const question = String(item.question || "").trim()
      const answer = String(item.answer || "").trim()
      const note = String(item.note || "").trim()

      let image = oldMap[i]?.image || item.image || ""
      let video = oldMap[i]?.video || item.video || ""

      if (item.file) {
        image = await uploadImageFile(item.file, `auction_${i}`)
        item.file = null
        item.image = image
      }

      if (item.videoFile) {
        video = await uploadImageFile(item.videoFile, `auction_video_${i}`)
        item.videoFile = null
        item.video = video
      }

      if (!question && !answer && !image && !video && !note) continue

      rows.push({
        model: Number(currentModel),
        number: Number(i),
        question,
        answer,
        image,
        video,
        note
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
      console.log(settingsError)
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
        console.log(saveError)
        showGameToast("فشل حفظ فتبلة")
        return false
      }
    }

    const { data: existingRows, error: existingError } = await db
      .from("auction_questions")
      .select("number")
      .eq("model", Number(currentModel))

    if (existingError) {
      console.log(existingError)
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
          console.log(deleteError)
          showGameToast("تم الحفظ لكن تعذر تنظيف بعض أسئلة فتبلة")
          return false
        }
      }
    }

    auctionAdminCount = finalCount

    showGameToast(rows.length ? "تم حفظ فتبلة" : "تم حذف جميع أسئلة فتبلة")
    await renderAuctionAdmin()
    return true

  } catch (err) {
    console.log("SAVE AUCTION ERROR:", err)
    showGameToast("توقف الحفظ بسبب خطأ في الرفع أو البيانات")
    return false
  } finally {
    setAdminSaving(false)
  }
}
/* =========================
   Who - Compact Admin
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
  const n = Number(whoAdminActiveNumber || 1)
  const item = getWhoDraftItem(n)

  item.answer = (document.getElementById(`whoAnswer${n}`)?.value || "").trim()

  const file = document.getElementById(`who${n}`)?.files?.[0] || null
  if (file) {
    item.file = file
  }
}

function isWhoDraftComplete(number) {
  const item = getWhoDraftItem(number)

  const image = String(item.image || "").trim()
  const answer = String(item.answer || "").trim()
  const file = item.file

  return !!(answer && (image || file))
}

function switchWhoAdminNumber(number) {
  collectWhoCurrentDraft()

  const safeNumber = Math.min(
    Math.max(Number(number || 1), 1),
    15
  )

  whoAdminActiveNumber = safeNumber
  renderWhoAdminFromDraft()
}

async function renderWhoAdmin() {
  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")
    return
  }

  const { data, error } = await db
    .from("who_images")
    .select("*")
    .eq("model", Number(currentModel))
    .order("number", { ascending: true })

  if (error) {
    console.log(error)
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

  if (whoAdminActiveNumber < 1 || whoAdminActiveNumber > 15) {
    whoAdminActiveNumber = 1
  }

  await renderWhoAdminFromDraft()
}

async function renderWhoAdminFromDraft() {
  const n = Number(whoAdminActiveNumber || 1)
  const item = getWhoDraftItem(n)

  const area = editor()
  if (!area) return

  area.innerHTML = `
    <div class="whoAdminShell compactWhoAdminShell">
      <div class="adminEditorTopBar compactAdminEditorTopBar">
        <div>
          <h2 class="adminSectionTitle">من هو</h2>
        </div>
      </div>

      ${await buildSegmentStatusGrid()}

      <div class="whoNumberTabs">
        ${Array.from({ length: 15 }, (_, idx) => idx + 1).map(num => {
          const complete = isWhoDraftComplete(num)

          return `
            <button
              type="button"
              class="whoNumberTab
                ${n === num ? "activeWhoNumberTab" : ""}
                ${complete ? "innerTabDone whoNumberDone" : ""}
                ${n === num && complete ? "whoNumberActiveDone" : ""}"
              onclick="switchWhoAdminNumber(${num})"
            >
              ${num}
            </button>
          `
        }).join("")}
      </div>

      <div class="adminCard whoSingleCard">
        <div class="whoSingleHead">
          <div>
            <h3>العنصر ${n}</h3>
            
          </div>

          <button class="adminDeleteBtn" onclick="clearWhoItem(${n})">
            حذف العنصر
          </button>
        </div>

        <div class="whoSingleLayout">
          <div class="whoImagePanel">
            <div class="adminField">
              <label>الصورة</label>
              <input type="file" id="who${n}" accept="image/*">
            </div>

            <div class="whoPreviewBox whoPreviewLarge">
              ${
                item.image
                  ? `<img src="${escapeHtml(item.image)}" class="previewImg">`
                  : `<div class="emptyImageHint">لا توجد صورة حالياً</div>`
              }
            </div>
          </div>

          <div class="whoAnswerPanel">
            <div class="adminField">
              <label>الإجابة</label>
              <input
                id="whoAnswer${n}"
                placeholder="اكتب اسم الشخصية / اللاعب / الإجابة"
                value="${escapeHtml(item.answer || "")}"
              >
            </div>

            <div class="whoSmallHint">
              الأفضل تكون الصورة واضحة ومقصوصة بشكل مربع أو قريب من المربع.
            </div>
          </div>
        </div>
      </div>

      <div class="adminActionRow whoStickyActions">
        <button onclick="saveWho()" class="adminSaveBtn">حفظ من هو</button>
        <button onclick="deleteWhoSegment()" class="adminDeleteAllBtn">حذف الفقرة</button>
        <button onclick="renderWhoAdmin()" class="adminReloadBtn">إعادة تحميل</button>
      </div>
    </div>
  `

  arrangeAdminInnerTabs()
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

    const { data: oldRows, error: oldReadError } = await db
      .from("who_images")
      .select("number, image")
      .eq("model", Number(currentModel))

    if (oldReadError) {
      console.log(oldReadError)
      showGameToast("تعذر قراءة بيانات من هو القديمة")
      return false
    }

    const oldMap = {}
    ;(oldRows || []).forEach(row => {
      oldMap[Number(row.number)] = row
    })

    const rows = []

    for (let i = 1; i <= 15; i++) {
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
    }

    const keepNumbers = rows.map(row => Number(row.number))

    const { data: existingRows, error: existingError } = await db
      .from("who_images")
      .select("number")
      .eq("model", Number(currentModel))

    if (existingError) {
      console.log(existingError)
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
          console.log(deleteError)
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
        console.log(saveError)
        showGameToast("فشل حفظ من هو")
        return false
      }
    }

    showGameToast(rows.length ? "تم حفظ من هو" : "تم حذف جميع عناصر من هو")
    await renderWhoAdmin()
    return true

  } catch (err) {
    console.log("SAVE WHO ERROR:", err)
    showGameToast("توقف حفظ من هو بسبب خطأ")
    return false
  } finally {
    setAdminSaving(false)
  }
}

/* =========================
   Final - Admin كامل
========================= */

async function renderFinalAdmin() {
  finalAdminRound = 1
  await renderFinalAdminRound(1)
}

async function getFinalAdminDoneMap() {
  const doneMap = {
    1: false,
    2: false,
    3: false
  }

  if (!currentModel) return doneMap

  const [metaRes, r1Res, r2Res, r3Res] = await Promise.all([
    db.from("final_round_meta").select("*").eq("model", Number(currentModel)),
    db.from("final_round1_items").select("*").eq("model", Number(currentModel)),
    db.from("final_round2_items").select("*").eq("model", Number(currentModel)),
    db.from("final_round3_items").select("*").eq("model", Number(currentModel))
  ])

  if (metaRes.error || r1Res.error || r2Res.error || r3Res.error) {
    console.log(metaRes.error || r1Res.error || r2Res.error || r3Res.error)
    return doneMap
  }

  const metaMap = {}
  ;(metaRes.data || []).forEach(row => {
    metaMap[Number(row.round)] = row
  })

  /* الجولة الأولى */
  const r1CardsCount = Number(metaMap[1]?.cards_count || 6)

  const r1Map = {}
  ;(r1Res.data || []).forEach(row => {
    r1Map[Number(row.number)] = row
  })

  let round1Done = true

  for (let i = 1; i <= r1CardsCount; i++) {
    const row = r1Map[i]

    if (!row) {
      round1Done = false
      break
    }

    const hasAnswer = String(row.answer || "").trim()
    const hasImage = String(row.image || "").trim()
    const hasCardText = String(row.card_text || "").trim()

    const hasQuestionPart =
      String(row.question_part1 || "").trim() ||
      String(row.question_part2 || "").trim() ||
      String(row.question_part3 || "").trim()

    if (!hasAnswer) {
      round1Done = false
      break
    }

    if (i <= 3 && !hasCardText && !hasImage) {
      round1Done = false
      break
    }

    if (i >= 4 && i <= 6 && !hasQuestionPart) {
      round1Done = false
      break
    }
  }

  doneMap[1] = round1Done

  /* الجولة الثانية */
  const r2Map = {}
  ;(r2Res.data || []).forEach(row => {
    r2Map[`${Number(row.number)}_${Number(row.item_order)}`] = row
  })

  let round2Done = true

  for (let number = 1; number <= 4; number++) {
    const isScramble = number === 1 || number === 3

    for (let i = 1; i <= 6; i++) {
      const row = r2Map[`${number}_${i}`]

      if (!row) {
        round2Done = false
        break
      }

      const prompt = String(row.prompt || "").trim()
      const answer = String(row.answer || "").trim()

      if (!prompt) {
        round2Done = false
        break
      }

      if (isScramble && !answer) {
        round2Done = false
        break
      }
    }

    if (!round2Done) break
  }

  doneMap[2] = round2Done

  /* الجولة الثالثة */
  const round3Mode = metaMap[3]?.round3_mode || "classic"

  if (round3Mode === "team_media") {
    const r3Map = {}

    ;(r3Res.data || []).forEach(row => {
      r3Map[Number(row.number)] = row
    })

    let round3Done = true

    for (let number = 1; number <= 4; number++) {
      const row = r3Map[number]

      if (!row) {
        round3Done = false
        break
      }

      const image = String(row.image || "").trim()
      const video = String(row.video || "").trim()
      const answer = String(row.answer || "").trim()

      if ((!image && !video) || !answer) {
        round3Done = false
        break
      }
    }

    doneMap[3] = round3Done
    return doneMap
  }

  const r3Map = {}

  ;(r3Res.data || []).forEach(row => {
    r3Map[`${Number(row.number)}_${Number(row.image_order)}`] = row
  })

  let round3Done = true

  for (let number = 1; number <= 2; number++) {
    for (let i = 1; i <= 5; i++) {
      const row = r3Map[`${number}_${i}`]

      if (!row) {
        round3Done = false
        break
      }

      const image = String(row.image || "").trim()
      const answer = String(row.answer || "").trim()

      if (!image || !answer) {
        round3Done = false
        break
      }
    }

    if (!round3Done) break
  }

  doneMap[3] = round3Done

  return doneMap
}

async function renderFinalAdminRound(round) {
  finalAdminRound = round

  const { data: metaData, error: metaError } = await db
    .from("final_round_meta")
    .select("*")
    .eq("model", currentModel)
    .eq("round", round)
    .maybeSingle()

  if (metaError) {
    console.log(metaError)
    showGameToast("تعذر تحميل بيانات الفاصلة")
    return
  }

  const doneMap = await getFinalAdminDoneMap()
  const round1CardsCount = Number(metaData?.cards_count || 6)
  const round3Mode = metaData?.round3_mode || "classic"

  const round1CountBox = round === 1
    ? `
      <div class="finalTopCompactBox finalTopCompactCountBox">
        <div class="adminField compactCountField">
          <div class="compactCountSelectWrap">
            <select id="finalRound1CardsCount" class="compactCountSelect">
              <option value="4" ${round1CardsCount === 4 ? "selected" : ""}>4</option>
              <option value="6" ${round1CardsCount === 6 ? "selected" : ""}>6</option>
            </select>
          </div>
        </div>
      </div>
    `
    : ""

  const round3ModeBox = round === 3
    ? `
      <div class="finalTopCompactBox finalTopCompactCountBox">
        <div class="adminField compactCountField">
          <div class="compactCountSelectWrap">
            <select id="finalRound3Mode" class="compactCountSelect" onchange="handleFinalRound3ModeChange()">
              <option value="classic" ${round3Mode === "classic" ? "selected" : ""}>
                اشرح الصورة
              </option>
              <option value="team_media" ${round3Mode === "team_media" ? "selected" : ""}>
                التركيز
              </option>
            </select>
          </div>
        </div>
      </div>
    `
    : ""

  let html = `
    <div class="finalAdminShell cleanFinalAdminShell">
      <div class="adminEditorTopBar compactAdminEditorTopBar">
        <div>
          <h2 class="adminSectionTitle">الفاصلة</h2>
        </div>
      </div>

      ${await buildSegmentStatusGrid()}

      <div class="finalTopCompactRow">
        <div class="finalTopCompactBox finalTopCompactTitleBox">
          <div class="adminField">
            <input
              id="finalRoundTitle"
              value="${escapeHtml(metaData?.title || `الجولة ${round}`)}"
              placeholder="اسم الجولة"
            >
          </div>
        </div>

        <div class="finalTopCompactBox finalTopCompactTabsBox">
          <div class="finalAdminRoundsBar cleanRoundsBar">
            ${[1, 2, 3].map(num => {
              const complete = !!doneMap[num]

              return `
                <button
                  type="button"
                  class="
                    ${round === num ? "activeFinalAdminRound" : ""}
                    ${complete ? "innerTabDone finalRoundDone" : ""}
                    ${round === num && complete ? "finalRoundActiveDone" : ""}
                  "
                  onclick="renderFinalAdminRound(${num})"
                >
                  الجولة ${num}
                </button>
              `
            }).join("")}
          </div>
        </div>

        ${round1CountBox}
        ${round3ModeBox}
      </div>
  `

  if (round === 1) html += await buildFinalRound1Admin(metaData, true)
  if (round === 2) html += await buildFinalRound2Admin()
  if (round === 3) html += await buildFinalRound3Admin(round3Mode)

  html += `
      <div class="finalAdminActions">
        <button onclick="saveFinalRound(${round})" class="adminSaveBtn">حفظ الجولة</button>
        <button onclick="deleteFinalRound(${round})" class="adminDeleteBtn">حذف هذه الجولة</button>
        <button onclick="deleteFinalSegment()" class="adminDeleteAllBtn">حذف الفقرة كاملة</button>
        <button onclick="renderFinalAdminRound(${round})" class="adminReloadBtn">إعادة تحميل</button>
      </div>
    </div>
  `

  editor().innerHTML = html
  arrangeAdminInnerTabs()
}

async function handleFinalRound3ModeChange() {
  const select = document.getElementById("finalRound3Mode")
  const mode = select?.value || "classic"

  const area = editor()
  if (!area) return

  const oldWrap =
    area.querySelector(".finalAdminRound3Wrap") ||
    area.querySelector(".finalAdminRound3TeamMediaWrap")

  if (!oldWrap) return

  const newHtml = await buildFinalRound3Admin(mode)
  oldWrap.outerHTML = newHtml
}

async function saveFinalRound(round) {
  if (isAdminSaving()) return false

  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")
    return false
  }

  try {
    setAdminSaving(true, `جارٍ حفظ الجولة ${round}...`)

    const title =
      (document.getElementById("finalRoundTitle")?.value || "").trim() ||
      `الجولة ${round}`

    let cardsCount = null

    if (round === 1) {
      cardsCount = Number(
        document.getElementById("finalRound1CardsCount")?.value || 6
      )
    }

    const round3Mode =
      round === 3
        ? (document.getElementById("finalRound3Mode")?.value || "classic")
        : null

    const metaPayload = {
      model: Number(currentModel),
      round: Number(round),
      title,
      cards_count: cardsCount
    }

    if (round === 3) {
      metaPayload.round3_mode = round3Mode
    }

    const { error: insertMetaError } = await db
      .from("final_round_meta")
      .upsert(
        [metaPayload],
        {
          onConflict: "model,round"
        }
      )

    if (insertMetaError) {
      console.log(insertMetaError)
      showGameToast("تعذر حفظ اسم الجولة")
      return false
    }

    let saved = false

    if (round === 1) saved = await saveFinalRound1(cardsCount, true)
    if (round === 2) saved = await saveFinalRound2(true)
    if (round === 3) saved = await saveFinalRound3(round3Mode, true)

    if (!saved) return false

    showGameToast(`تم حفظ الجولة ${round}`)
    await renderFinalAdminRound(round)
    return true

  } catch (err) {
    console.log("SAVE FINAL ROUND ERROR:", err)
    showGameToast("توقف حفظ الجولة بسبب خطأ")
    return false
  } finally {
    setAdminSaving(false)
  }
}

/* =========================
   Round 1 Admin
========================= */

async function buildFinalRound1Admin(metaData, countAlreadyShown = false) {
  const { data, error } = await db
    .from("final_round1_items")
    .select("*")
    .eq("model", currentModel)
    .order("number", { ascending: true })

  if (error) {
    console.log(error)
    return `<div class="adminCard">تعذر تحميل الجولة الأولى</div>`
  }

  const map = {}
  ;(data || []).forEach(row => {
    map[row.number] = row
  })

  const cardsCount = Number(metaData?.cards_count || 6)

  let html = `
    ${countAlreadyShown ? "" : `
      <div class="finalAdminHeadOptions">
        <div class="finalAdminTitleCard finalAdminSubCard">
          <div class="adminField">
            <label>عدد الأرقام</label>
            <select id="finalRound1CardsCount">
              <option value="4" ${cardsCount === 4 ? "selected" : ""}>4</option>
              <option value="6" ${cardsCount === 6 ? "selected" : ""}>6</option>
            </select>
          </div>
        </div>
      </div>
    `}

    <div class="finalAdminGrid finalAdminGridRound1">
  `

  for (let i = 1; i <= 6; i++) {
    const dimmed = i > cardsCount ? 'style="opacity:.38;"' : ''
    const isTextCard = i <= 3
    const isQuestionCard = i >= 4 && i <= 6

    html += `
      <div class="finalAdminCard finalRound1AdminCard" ${dimmed}>
        <div class="finalAdminCardHead">
          <h3>رقم ${i}</h3>
          <button class="adminDeleteBtn" onclick="clearFinalRound1Item(${i})">حذف</button>
        </div>

        <div class="finalAdminRowSingle finalAdminRound1Fields">
          <div class="adminField">
            <label>الصورة</label>
            <input type="file" id="finalRound1File_${i}" accept="image/*">
          </div>

          <div class="adminField">
            <label>الإجابة</label>
            <input
              id="finalRound1Answer_${i}"
              placeholder="الإجابة"
              value="${escapeHtml(map[i]?.answer || "")}"
            >
          </div>

          <div class="adminField">
            <label>التلميحة / التوضيح</label>
            <input
              id="finalRound1Note_${i}"
              placeholder="تظهر مع الصورة مباشرة"
              value="${escapeHtml(map[i]?.note || "")}"
            >
          </div>
        </div>

        ${
          isTextCard ? `
            <div class="finalAdminRowSingle finalAdminRowSingleText">
              <div class="adminField finalTextCardField">
                <label>نص القصاصة</label>
                <textarea
                  id="finalRound1CardText_${i}"
                  placeholder="اكتب النص الذي سيظهر في القصاصة التاريخية"
                  rows="4"
                >${escapeHtml(map[i]?.card_text || "")}</textarea>
              </div>
            </div>
          ` : ""
        }

        ${
          isQuestionCard ? `
            <div class="finalAdminRowSingle finalAdminRowSingleText">
              <div class="adminField finalTextCardField">
                <label>جزء السؤال 1</label>
                <textarea
                  id="finalRound1QuestionPart1_${i}"
                  placeholder="اكتب الجزء الأول"
                  rows="2"
                >${escapeHtml(map[i]?.question_part1 || "")}</textarea>
              </div>
            </div>

            <div class="finalAdminRowSingle finalAdminRowSingleText">
              <div class="adminField finalTextCardField">
                <label>جزء السؤال 2</label>
                <textarea
                  id="finalRound1QuestionPart2_${i}"
                  placeholder="اكتب الجزء الثاني"
                  rows="2"
                >${escapeHtml(map[i]?.question_part2 || "")}</textarea>
              </div>
            </div>

            <div class="finalAdminRowSingle finalAdminRowSingleText">
              <div class="adminField finalTextCardField">
                <label>جزء السؤال 3</label>
                <textarea
                  id="finalRound1QuestionPart3_${i}"
                  placeholder="اكتب الجزء الثالث"
                  rows="2"
                >${escapeHtml(map[i]?.question_part3 || "")}</textarea>
              </div>
            </div>
          ` : ""
        }

        <div class="finalAdminPreviewBox">
          ${map[i]?.image ? `<img src="${escapeHtml(map[i].image)}" class="previewImg">` : ""}
        </div>
      </div>
    `
  }

  html += `</div>`
  return html
}

async function saveFinalRound1(cardsCount, skipSavingLock = false) {
  if (!skipSavingLock && isAdminSaving()) return false

  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")
    return false
  }

  try {
    if (!skipSavingLock) {
      setAdminSaving(true, "جارٍ حفظ الجولة الأولى...")
    }

    showGameToast("جارٍ حفظ الجولة الأولى...")

    const finalCardsCount = Number(
      cardsCount || document.getElementById("finalRound1CardsCount")?.value || 6
    )

    const safeCardsCount = finalCardsCount === 4 ? 4 : 6

    const { data: oldRows, error: oldError } = await db
      .from("final_round1_items")
      .select("*")
      .eq("model", Number(currentModel))

    if (oldError) {
      console.log(oldError)
      showGameToast("تعذر قراءة بيانات الجولة الأولى القديمة")
      return false
    }

    const oldMap = {}
    ;(oldRows || []).forEach(row => {
      oldMap[row.number] = row
    })

    const rows = []

    for (let i = 1; i <= safeCardsCount; i++) {
      const file = document.getElementById(`finalRound1File_${i}`)?.files?.[0]
      const answer = (document.getElementById(`finalRound1Answer_${i}`)?.value || "").trim()
      const note = (document.getElementById(`finalRound1Note_${i}`)?.value || "").trim()

      const cardText = i <= 3
        ? (document.getElementById(`finalRound1CardText_${i}`)?.value || "").trim()
        : ""

      const questionPart1 = i >= 4 && i <= 6
        ? (document.getElementById(`finalRound1QuestionPart1_${i}`)?.value || "").trim()
        : ""

      const questionPart2 = i >= 4 && i <= 6
        ? (document.getElementById(`finalRound1QuestionPart2_${i}`)?.value || "").trim()
        : ""

      const questionPart3 = i >= 4 && i <= 6
        ? (document.getElementById(`finalRound1QuestionPart3_${i}`)?.value || "").trim()
        : ""

      let image = oldMap[i]?.image || ""

      if (file) {
        image = await uploadImageFile(file, `final_r1_${i}`)

        if (!image) {
          showGameToast(`تعذر رفع صورة رقم ${i}`)
          return false
        }
      }

      if (
        !image &&
        !answer &&
        !note &&
        !cardText &&
        !questionPart1 &&
        !questionPart2 &&
        !questionPart3
      ) {
        continue
      }

      rows.push({
        model: Number(currentModel),
        number: Number(i),
        image,
        answer,
        note,
        card_text: cardText,
        question_part1: questionPart1,
        question_part2: questionPart2,
        question_part3: questionPart3
      })
    }

    

    if (!rows.length) {
      const ok = confirm("الجولة الأولى فارغة، هل تريد حذف بياناتها؟")
      if (!ok) {
        showGameToast("تم إلغاء الحفظ")
        return false
      }

      const { error: clearError } = await db
        .from("final_round1_items")
        .delete()
        .eq("model", Number(currentModel))

      if (clearError) {
        console.log(clearError)
        showGameToast("تعذر تفريغ الجولة الأولى")
        return false
      }

      showGameToast("تم تفريغ الجولة الأولى")
      return true
    }

    const keepNumbers = rows.map(row => Number(row.number))

    const { data: existingRows, error: existingError } = await db
      .from("final_round1_items")
      .select("number")
      .eq("model", Number(currentModel))

    if (existingError) {
      console.log(existingError)
      showGameToast("تعذر قراءة عناصر الجولة الأولى الحالية")
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
          console.log(deleteError)
          showGameToast("تعذر تنظيف عناصر الجولة الأولى")
          return false
        }
      }
    }

    const { error: saveError } = await db
      .from("final_round1_items")
      .upsert(rows, {
        onConflict: "model,number"
      })

    if (saveError) {
      console.log(saveError)
      showGameToast("فشل حفظ الجولة الأولى")
      return false
    }

    showGameToast("تم حفظ الجولة الأولى")
    return true

    } catch (err) {
    console.log("SAVE FINAL ROUND 1 ERROR:", err)
    showGameToast("توقف الحفظ بسبب خطأ في الرفع أو البيانات")
    return false
  } finally {
    if (!skipSavingLock) {
      setAdminSaving(false)
    }
  }
}

/* =========================
   Round 2 Admin
========================= */

async function buildFinalRound2Admin() {
  const { data, error } = await db
    .from("final_round2_items")
    .select("*")
    .eq("model", currentModel)
    .order("number", { ascending: true })
    .order("item_order", { ascending: true })

  if (error) {
    console.log(error)
    return `<div class="adminCard">تعذر تحميل الجولة الثانية</div>`
  }

  const grouped = { 1: [], 2: [], 3: [], 4: [] }
  ;(data || []).forEach(row => {
    grouped[row.number].push(row)
  })

  let html = `<div class="finalAdminRound2Wrap finalAdminRound2SingleColumn">`

  for (let number = 1; number <= 4; number++) {
    const isScramble = number === 1 || number === 3
    const rows = grouped[number] || []

    html += `
      <div class="finalAdminCard finalAdminWideCard">
        <div class="finalAdminCardHead">
          <h3>رقم ${number}</h3>

          <div class="finalAdminCardHeadActions">
            <div class="finalAdminTypeBadge">${isScramble ? "كلمات مبعثرة" : "ترتيب / تسلسل"}</div>
            <button class="adminDeleteBtn" onclick="clearFinalRound2Item(${number})">حذف</button>
          </div>
        </div>

        <div class="finalAdminRound2RowsWrap">
    `

    for (let i = 1; i <= 6; i++) {
      const row = rows.find(x => Number(x.item_order) === i) || {}

      if (isScramble) {
        html += `
          <div class="finalAdminWordRow finalAdminWordRowInline finalAdminRound2Inline">
            <div class="finalAdminWordIndex">العنصر ${i}</div>

            <div class="finalAdminWordFields finalAdminWordFields3 finalAdminWordFieldsInline3">
              <input
                id="finalRound2Prompt_${number}_${i}"
                placeholder="الكلمة الأساسية"
                value="${escapeHtml(row.prompt || "")}"
              >

              <input
                id="finalRound2Hint_${number}_${i}"
                placeholder="التلميحة"
                value="${escapeHtml(row.hint || "")}"
              >

              <input
                id="finalRound2Answer_${number}_${i}"
                placeholder="الإجابة الصحيحة"
                value="${escapeHtml(row.answer || "")}"
              >
            </div>
          </div>
        `
      } else {
        html += `
          <div class="finalAdminWordRow finalAdminWordRowInline finalAdminRound2Inline">
            <div class="finalAdminWordIndex">العنصر ${i}</div>

            <div class="finalAdminWordFields finalAdminWordFields1 finalAdminWordFieldsInline1">
              <input
                id="finalRound2Prompt_${number}_${i}"
                placeholder="الكلمة / الترتيب"
                value="${escapeHtml(row.prompt || "")}"
              >
            </div>
          </div>
        `
      }
    }

    html += `
        </div>
      </div>
    `
  }

  html += `</div>`
  return html
}

async function saveFinalRound2(skipSavingLock = false) {
  if (!skipSavingLock && isAdminSaving()) return false

  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")
    return false
  }

  try {
    if (!skipSavingLock) {
      setAdminSaving(true, "جارٍ حفظ الجولة الثانية...")
    }

    showGameToast("جارٍ حفظ الجولة الثانية...")

    const rows = []

    for (let number = 1; number <= 4; number++) {
      const gameType = number === 1 || number === 3 ? "scramble" : "sequence"

      for (let i = 1; i <= 6; i++) {
        const prompt = (document.getElementById(`finalRound2Prompt_${number}_${i}`)?.value || "").trim()

        const hint = gameType === "scramble"
          ? (document.getElementById(`finalRound2Hint_${number}_${i}`)?.value || "").trim()
          : ""

        const answer = gameType === "scramble"
          ? (document.getElementById(`finalRound2Answer_${number}_${i}`)?.value || "").trim()
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

   
    if (!rows.length) {
      const ok = confirm("الجولة الثانية فارغة، هل تريد حذف بياناتها؟")
      if (!ok) {
        showGameToast("تم إلغاء الحفظ")
        return false
      }

      const { error: clearError } = await db
        .from("final_round2_items")
        .delete()
        .eq("model", Number(currentModel))

      if (clearError) {
        console.log(clearError)
        showGameToast("تعذر تفريغ الجولة الثانية")
        return false
      }

      showGameToast("تم تفريغ الجولة الثانية")
      return true
    }

    const keepKeys = rows.map(row => `${Number(row.number)}_${Number(row.item_order)}`)

    const { data: existingRows, error: existingError } = await db
      .from("final_round2_items")
      .select("number,item_order")
      .eq("model", Number(currentModel))

    if (existingError) {
      console.log(existingError)
      showGameToast("تعذر قراءة الجولة الثانية الحالية")
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
          console.log(deleteError)
          showGameToast("تعذر تنظيف عناصر الجولة الثانية")
          return false
        }
      }
    }

    const { error: saveError } = await db
      .from("final_round2_items")
      .upsert(rows, {
        onConflict: "model,number,item_order"
      })

    if (saveError) {
      console.log(saveError)
      showGameToast("فشل حفظ الجولة الثانية")
      return false
    }

    showGameToast("تم حفظ الجولة الثانية")
    return true

    } catch (err) {
    console.log("SAVE FINAL ROUND 2 ERROR:", err)
    showGameToast("توقف حفظ الجولة الثانية بسبب خطأ")
    return false
  } finally {
    if (!skipSavingLock) {
      setAdminSaving(false)
    }
  }
}
/* =========================
   Round 3 Admin
========================= */

async function buildFinalRound3Admin(mode = "classic") {
  const { data, error } = await db
    .from("final_round3_items")
    .select("*")
    .eq("model", Number(currentModel))
    .order("number", { ascending: true })
    .order("image_order", { ascending: true })

  if (error) {
    console.log(error)
    return `<div class="adminCard">تعذر تحميل الجولة الثالثة</div>`
  }

  if (mode === "team_media") {
    return buildFinalRound3TeamMediaAdmin(data || [])
  }

  return buildFinalRound3ClassicAdmin(data || [])
}

/* =========================
   Round 3 Classic Admin
========================= */

function buildFinalRound3ClassicAdmin(data = []) {
  const grouped = { 1: [], 2: [] }

  ;(data || []).forEach(row => {
    const number = Number(row.number || 1)
    if (!grouped[number]) grouped[number] = []
    grouped[number].push(row)
  })

  let html = `<div class="finalAdminRound3Wrap">`

  for (let number = 1; number <= 2; number++) {
    const rows = grouped[number] || []

    html += `
      <div class="finalAdminCard finalAdminWideCard">
        <div class="finalAdminCardHead">
          <h3>رقم ${number}</h3>
          <button class="adminDeleteBtn" onclick="clearFinalRound3Item(${number})">حذف</button>
        </div>
    `

    for (let i = 1; i <= 5; i++) {
      const row = rows.find(x => Number(x.image_order) === i) || {}

      html += `
        <div class="finalAdminImageRow">
          <div class="finalAdminWordIndex">الصورة ${i}</div>

          <div class="finalAdminImageFields">
            <input type="file" id="finalRound3File_${number}_${i}" accept="image/*">

            <input
              id="finalRound3Answer_${number}_${i}"
              placeholder="الإجابة"
              value="${escapeHtml(row.answer || "")}"
            >
          </div>

          <div class="finalAdminImagePreview">
            ${row.image ? `<img src="${escapeHtml(row.image)}" class="previewImg">` : ""}
          </div>
        </div>
      `
    }

    html += `</div>`
  }

  html += `</div>`
  return html
}

/* =========================
   Round 3 Team Media Admin
========================= */

function buildFinalRound3TeamMediaAdmin(data = []) {
  const map = {}

  ;(data || []).forEach(row => {
    map[Number(row.number)] = row
  })

  let html = `
    <div class="finalAdminRound3TeamMediaWrap">
      <div class="adminCard finalRound3ModeNote">
        <div class="adminCleanSectionText">
          <h3>الجولة الثالثة الجديدة</h3>
          <p>4 أرقام، كل فريق له رقمين. لكل رقم صورة أو فيديو + سؤال + إجابة.</p>
        </div>
      </div>

      <div class="finalAdminGrid finalAdminGridRound1">
  `

  for (let number = 1; number <= 4; number++) {
    const row = map[number] || {}
    const teamName = number <= 2 ? "الفريق الأول" : "الفريق الثاني"

    html += `
      <div class="finalAdminCard finalRound1AdminCard">
        <div class="finalAdminCardHead">
          <h3>رقم ${number}</h3>
          <div class="finalAdminTypeBadge">${teamName}</div>
          <button class="adminDeleteBtn" onclick="clearFinalRound3Item(${number})">حذف</button>
        </div>

        <div class="finalAdminRowSingle finalAdminRound1Fields">
          <div class="adminField">
            <label>الصورة</label>
            <input type="file" id="finalRound3TeamImage_${number}" accept="image/*">
          </div>

          <div class="adminField">
            <label>الفيديو</label>
            <input type="file" id="finalRound3TeamVideo_${number}" accept="video/*">
          </div>

          <div class="adminField">
            <label>الإجابة</label>
            <input
              id="finalRound3TeamAnswer_${number}"
              placeholder="الإجابة"
              value="${escapeHtml(row.answer || "")}"
            >
          </div>
        </div>

        <div class="finalAdminRowSingle finalAdminRowSingleText">
          <div class="adminField finalTextCardField">
            <label>السؤال</label>
            <textarea
              id="finalRound3TeamQuestion_${number}"
              placeholder="اكتب السؤال الذي يظهر في العرض عند الضغط على زر إظهار السؤال"
              rows="3"
            >${escapeHtml(row.question || "")}</textarea>
          </div>
        </div>

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
    `
  }

  html += `
      </div>
    </div>
  `

  return html
}

/* =========================
   Save Round 3
========================= */

async function saveFinalRound3(mode = "classic", skipSavingLock = false) {
  if (!skipSavingLock && isAdminSaving()) return false

  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")
    return false
  }

  try {
    if (!skipSavingLock) {
      setAdminSaving(true, "جارٍ حفظ الجولة الثالثة...")
    }

    showGameToast("جارٍ حفظ الجولة الثالثة...")

    if (mode === "team_media") {
      return await saveFinalRound3TeamMedia(true)
    }

    return await saveFinalRound3Classic(true)

  } catch (err) {
    console.log("SAVE FINAL ROUND 3 ERROR:", err)
    showGameToast("توقف حفظ الجولة الثالثة بسبب خطأ")
    return false
  } finally {
    if (!skipSavingLock) {
      setAdminSaving(false)
    }
  }
}

/* =========================
   Save Round 3 Team Media
========================= */

async function saveFinalRound3TeamMedia(skipSavingLock = false) {
  try {
    const { data: oldRows, error: oldError } = await db
      .from("final_round3_items")
      .select("*")
      .eq("model", Number(currentModel))

    if (oldError) {
      console.log(oldError)
      showGameToast("تعذر قراءة الجولة الثالثة القديمة")
      return false
    }

    const oldMap = {}

    ;(oldRows || []).forEach(row => {
      oldMap[Number(row.number)] = row
    })

    const rows = []

    for (let number = 1; number <= 4; number++) {
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
        showGameToast(`جارٍ رفع صورة رقم ${number}...`)

        image = await uploadImageFile(imageFile, `final_r3_team_img_${number}`)

        if (!image) {
          showGameToast(`تعذر رفع صورة رقم ${number}`)
          return false
        }

        video = ""
      }

      if (videoFile) {
        showGameToast(`جارٍ رفع فيديو رقم ${number}...`)

        video = await uploadVideoFile(videoFile, `final_r3_team_video_${number}`)

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

    if (!rows.length) {
      const ok = confirm("الجولة الثالثة الجديدة فارغة، هل تريد حذف بياناتها؟")

      if (!ok) {
        showGameToast("تم إلغاء الحفظ")
        return false
      }

      const { error: clearError } = await db
        .from("final_round3_items")
        .delete()
        .eq("model", Number(currentModel))

      if (clearError) {
        console.log(clearError)
        showGameToast("تعذر تفريغ الجولة الثالثة")
        return false
      }

      showGameToast("تم تفريغ الجولة الثالثة")
      return true
    }

    const keepNumbers = rows.map(row => Number(row.number))

    const { data: existingRows, error: existingError } = await db
      .from("final_round3_items")
      .select("number")
      .eq("model", Number(currentModel))

    if (existingError) {
      console.log(existingError)
      showGameToast("تعذر قراءة الجولة الثالثة الحالية")
      return false
    }

    for (const oldRow of existingRows || []) {
      const oldNumber = Number(oldRow.number)

      if (!keepNumbers.includes(oldNumber)) {
        const { error: deleteError } = await db
          .from("final_round3_items")
          .delete()
          .eq("model", Number(currentModel))
          .eq("number", oldNumber)

        if (deleteError) {
          console.log(deleteError)
          showGameToast("تعذر تنظيف الجولة الثالثة")
          return false
        }
      }
    }

    const { error: saveError } = await db
      .from("final_round3_items")
      .upsert(rows, {
        onConflict: "model,number,image_order"
      })

    if (saveError) {
      console.log(saveError)
      showGameToast("فشل حفظ الجولة الثالثة الجديدة")
      return false
    }

    showGameToast("تم حفظ الجولة الثالثة الجديدة")
    return true

  } catch (err) {
    console.log("SAVE FINAL ROUND 3 TEAM MEDIA ERROR:", err)

    const msg =
      err?.message ||
      err?.error ||
      err?.statusCode ||
      "خطأ غير معروف"

    showGameToast(`توقف حفظ الجولة الثالثة: ${msg}`)
    return false
  }
}

/* =========================
   Delete Final
========================= */

async function deleteFinalRound(round) {
  const confirmed = window.confirm(`هل تريد حذف الجولة ${round}؟`)
  if (!confirmed) return

  const { error: metaError } = await db
    .from("final_round_meta")
    .delete()
    .eq("model", currentModel)
    .eq("round", round)

  if (metaError) console.log(metaError)

  if (round === 1) {
    const { error } = await db
      .from("final_round1_items")
      .delete()
      .eq("model", currentModel)

    if (error) console.log(error)
  }

  if (round === 2) {
    const { error } = await db
      .from("final_round2_items")
      .delete()
      .eq("model", currentModel)

    if (error) console.log(error)
  }

  if (round === 3) {
    const { error } = await db
      .from("final_round3_items")
      .delete()
      .eq("model", currentModel)

    if (error) console.log(error)
  }

  showGameToast(`تم حذف الجولة ${round}`)
  await renderFinalAdminRound(round)
}

async function deleteFinalSegment() {
  const confirmed = window.confirm("هل تريد حذف فقرة الفاصلة كاملة؟")
  if (!confirmed) return

  try {
    await db.from("final_round_meta").delete().eq("model", currentModel)
    await db.from("final_round1_items").delete().eq("model", currentModel)
    await db.from("final_round2_items").delete().eq("model", currentModel)
    await db.from("final_round3_items").delete().eq("model", currentModel)

    showGameToast("تم حذف فقرة الفاصلة")
    await renderFinalAdmin()
  } catch (err) {
    console.log(err)
    showGameToast("تعذر حذف فقرة الفاصلة")
  }
}

async function clearFinalRound1Item(number) {
  const confirmed = window.confirm(`حذف العنصر ${number} من الجولة الأولى؟`)
  if (!confirmed) return

  const { error } = await db
    .from("final_round1_items")
    .delete()
    .eq("model", currentModel)
    .eq("number", Number(number))

  if (error) {
    console.log(error)
    showGameToast("تعذر حذف العنصر")
    return
  }

  showGameToast(`تم حذف العنصر ${number}`)
  await renderFinalAdminRound(1)
}

async function clearFinalRound2Item(number) {
  const confirmed = window.confirm(`حذف الرقم ${number} من الجولة الثانية؟`)
  if (!confirmed) return

  const { error } = await db
    .from("final_round2_items")
    .delete()
    .eq("model", currentModel)
    .eq("number", Number(number))

  if (error) {
    console.log(error)
    showGameToast("تعذر حذف الرقم")
    return
  }

  showGameToast(`تم حذف الرقم ${number}`)
  await renderFinalAdminRound(2)
}

async function clearFinalRound3Item(number) {
  const confirmed = window.confirm(`حذف الرقم ${number} من الجولة الثالثة؟`)
  if (!confirmed) return

  const { error } = await db
    .from("final_round3_items")
    .delete()
    .eq("model", currentModel)
    .eq("number", Number(number))

  if (error) {
    console.log(error)
    showGameToast("تعذر حذف الرقم")
    return
  }

  showGameToast(`تم حذف الرقم ${number}`)
  await renderFinalAdminRound(3)
}

/* =========================
   Archive
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

function renderArchiveAdminItem(position, item = {}) {
  const mergedItem = getArchiveDraftItem(position, item)
  const parentPosition = Number(mergedItem.parent_position || mergedItem.column_group || 3)
  const promptStyle = mergedItem.prompt_style || "shoe"
  const isRequired = String(mergedItem.label || "").trim() === "المطلوب"
  const hasTextValue = String(mergedItem.text || "").trim() !== ""
  const labelText = String(mergedItem.label || "").trim()

  return `
    <div class="archiveAdminItem archiveAdminItemCompact ${isRequired ? "archiveAdminItemRequired" : ""}">
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
          class="${hasTextValue ? "hasValue" : ""}"
          placeholder="النص الذي سيظهر داخل البطاقة"
        >${escapeHtml(mergedItem.text || "")}</textarea>
      </div>
    </div>
  `
}

async function renderArchiveAdmin() {
  archiveAdminRoundsCount = await getSegmentRoundCount("archive", 4, 4)
  archiveAdminRound = 1
  archivePendingExtraCount = 0
  archiveDraftState = {}
  await renderArchiveAdminRound(1)
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

  const textItems = items.filter(item => Number(item.position) >= 5)
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
    console.log(boxesRes.error || itemsRes.error)
    return doneMap
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

  for (let r = 1; r <= archiveAdminRoundsCount; r++) {
    doneMap[r] = isArchiveRoundComplete(boxesMap[r], itemsByRound[r] || [])
  }

  return doneMap
}
async function renderArchiveAdminRound(round) {
  archiveAdminRound = round

  const { data: boxData, error: boxError } = await db
    .from("archive_boxes")
    .select("*")
    .eq("model", currentModel)
    .eq("round", round)
    .limit(1)

  const { data: itemsData, error: itemsError } = await db
    .from("archive_items")
    .select("*")
    .eq("model", currentModel)
    .eq("round", round)
    .order("position", { ascending: true })

  if (boxError || itemsError) {
    console.log(boxError || itemsError)
    showGameToast("تعذر تحميل الأرشيف")
    return
  }

  const box = boxData?.[0] || null
  const items = itemsData || []
  const map = {}

  items.forEach(item => {
    map[item.position] = getArchiveDraftItem(item.position, item)
  })

  const savedTextPositions = items
    .map(x => Number(x.position || 0))
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

  const totalTextItems = archiveExtraTextPositions.length
const archiveDoneMap = await getArchiveDoneMap()

  editor().innerHTML = `
    <div class="archiveAdminShell archiveAdminCleanV2">
      <div class="adminEditorTopBar archiveAdminTopBar">
        <div>
          <h2 class="adminSectionTitle">الأرشيف</h2>
          <div class="adminSectionSubTitle">
           
          </div>
        </div>

        <div class="archiveTopActions">
          <button onclick="saveArchiveRoundNew()" class="adminSaveBtn">حفظ الجولة</button>
          <button onclick="addArchiveTextBox()" class="adminBtnMango">إضافة عنصر</button>
          <button onclick="removeArchiveTextBox()" class="adminBtnLight">حذف آخر عنصر</button>
          <button onclick="deleteArchiveSegment(${round})" class="adminDeleteBtn">حذف الجولة</button>
          <button onclick="deleteArchiveSegment()" class="adminDeleteAllBtn">حذف الأرشيف</button>
        </div>
      </div>

      ${await buildSegmentStatusGrid()}

      <div class="archiveAdminControlBar">
  <div class="archiveRoundsControl">
    

    <div class="archiveRoundsInline">
      <div class="compactCountSelectWrap">
        <select id="archiveRoundsCountInput" class="compactCountSelect">
          <option value="1" ${archiveAdminRoundsCount === 1 ? "selected" : ""}>1</option>
          <option value="2" ${archiveAdminRoundsCount === 2 ? "selected" : ""}>2</option>
          <option value="3" ${archiveAdminRoundsCount === 3 ? "selected" : ""}>3</option>
          <option value="4" ${archiveAdminRoundsCount === 4 ? "selected" : ""}>4</option>
        </select>
      </div>

      <button onclick="applyArchiveRoundsCount()" class="adminBtn adminBtnMango compactCountBtn">
        حفظ 
      </button>
    </div>
  </div>

  <div class="archiveAdminRoundsBar cleanRoundsBar">
    ${Array.from({ length: archiveAdminRoundsCount }, (_, i) => i + 1).map(r => {
      const complete = !!archiveDoneMap[r]

      return `
        <button
          type="button"
          class="
            ${round === r ? "activeArchiveRoundBtn" : ""}
            ${complete ? "innerTabDone archiveRoundDone" : ""}
            ${round === r && complete ? "archiveRoundActiveDone" : ""}
          "
          onclick="renderArchiveAdminRound(${r})"
        >
          الجولة ${r}
        </button>
      `
    }).join("")}
  </div>
</div>

      <div class="archiveAdminBoard archiveAdminBoardClean archiveAdminBoardV2 ${round === 4 ? "archiveAdminBoardRound4" : ""}">
        <div class="archiveMainInfoCard">
          <div class="archiveMainInfoHead">
            <h3>بيانات الجولة</h3>
            <span>البطولة / الموسم / النتيجة</span>
          </div>

          <div class="archiveMainInfoGrid">
            <div class="adminField">
              <label>البطولة</label>
              <input
                id="archiveItemText_1"
                type="text"
                placeholder="مثال: دوري أبطال أوروبا"
                value="${escapeHtml(archiveDraftState.__top?.text1 || map[1]?.text || "")}"
              >
            </div>

            <div class="adminField">
              <label>الموسم</label>
              <input
                id="archiveItemText_2"
                type="text"
                placeholder="مثال: 2016 / 2017"
                value="${escapeHtml(archiveDraftState.__top?.text2 || map[2]?.text || "")}"
              >
            </div>

            <div class="adminField">
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

        <div class="archiveImagesRow">
          <div class="archiveImageCard">
            <div class="archiveImageCardHead">
              <h3>الصورة 4</h3>

              <button
                type="button"
                class="adminDeleteMiniBtn"
                onclick="deleteArchiveItem(${round}, 4)"
                ${map[4]?.image ? "" : "disabled"}
              >
                حذف
              </button>
            </div>

            <input id="archiveItemFile_4" type="file" accept="image/*">

            <div class="archiveImagePreviewBox">
              ${map[4]?.image ? `<img src="${escapeHtml(map[4].image)}" class="archiveAdminPreviewImg">` : `<div class="archiveNoImage">لا توجد صورة</div>`}
            </div>
          </div>

          <div class="archiveImageCard">
            <div class="archiveImageCardHead">
              <h3>الصورة 3</h3>

              <button
                type="button"
                class="adminDeleteMiniBtn"
                onclick="deleteArchiveItem(${round}, 3)"
                ${map[3]?.image ? "" : "disabled"}
              >
                حذف
              </button>
            </div>

            <input id="archiveItemFile_3" type="file" accept="image/*">

            <div class="archiveImagePreviewBox">
              ${map[3]?.image ? `<img src="${escapeHtml(map[3].image)}" class="archiveAdminPreviewImg">` : `<div class="archiveNoImage">لا توجد صورة</div>`}
            </div>
          </div>
        </div>

        <div class="archiveAdminBottomGrid archiveAdminBottomGridClean archiveTextGroupsGrid">
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
    </div>
  `

  arrangeAdminInnerTabs()
}

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
      console.log(oldRowsError)
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
      .upsert([{
        model: Number(currentModel),
        round,
        tournament: text1,
        season: text2,
        score: scoreValue
      }], {
        onConflict: "model,round"
      })

    if (boxError) {
      console.log(boxError)
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
      console.log(existingError)
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
          console.log(deleteError)
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
      console.log(itemsError)
      showGameToast("فشل حفظ عناصر الأرشيف")
      return false
    }

    archivePendingExtraCount = 0
    archiveDraftState = {}

    showGameToast(`تم حفظ الجولة ${round}`)
    await renderArchiveAdminRound(round)

    return true

  } catch (err) {
    console.log("SAVE ARCHIVE ROUND ERROR:", err)
    showGameToast("توقف حفظ الأرشيف بسبب خطأ")
    return false
  } finally {
    setAdminSaving(false)
  }
}

async function applyArchiveRoundsCount() {
  if (isAdminSaving()) return false

  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")
    return false
  }

  try {
    setAdminSaving(true, "جارٍ حفظ العدد...")

    const count = Number(
      document.getElementById("archiveRoundsCountInput")?.value || 4
    )

    archiveAdminRoundsCount = Math.min(Math.max(count, 1), 4)

    const saved = await saveSegmentRoundCount("archive", archiveAdminRoundsCount)
    if (!saved) return false

    if (archiveAdminRound > archiveAdminRoundsCount) {
      archiveAdminRound = archiveAdminRoundsCount
    }

    showGameToast("تم حفظ عدد جولات الأرشيف")
    await renderArchiveAdminRound(archiveAdminRound)
    return true

  } catch (err) {
    console.log("APPLY ARCHIVE ROUNDS COUNT ERROR:", err)
    showGameToast("تعذر حفظ عدد جولات الأرشيف")
    return false
  } finally {
    setAdminSaving(false)
  }
}