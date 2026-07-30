/* =========================================================
   RANDOM CHALLENGE ADMIN / إدارة فقرة التحدي
   CLEAN ORGANIZED VERSION
========================================================= */

/* =========================
   1) STATE + CONSTANTS
========================= */

let randomChallengeAdminSection = "auction"
let randomChallengeAdminRows = []
let randomChallengeAdminRowsLoadedModel = null
let randomChallengeAdminSaving = false

let fatblaAdminCount = 5
let fatblaAdminDraft = {}
let fatblaAdminLoaded = false
let fatblaAdminLoadedModel = null

// متغير قديم محفوظ للتوافق مع بقية ملفات المشروع.
let auctionAdminCount = 5

const RANDOM_CHALLENGE_ADMIN_DEFAULT_SECTION = "auction"
const RANDOM_CHALLENGE_TRUE_FALSE_ANSWERS = ["صح", "خطأ"]

const RANDOM_CHALLENGE_ADMIN_SECTIONS = [
  { key: "sharedPlayer", title: "اللاعب المشترك" },
  { key: "auction", title: "المزاد" },
  { key: "whatDoYouKnow", title: "ماذا تعرف" },
  { key: "trueFalse", title: "صح أو خطأ" },
  { key: "fatbla", title: "فتبلة" }
]

const RANDOM_CHALLENGE_ADMIN_SECTION_COUNTS = {
  auction: 2,
  whatDoYouKnow: 2,
  trueFalse: 10
}

/* =========================
   2) COMMON HELPERS
========================= */

function getRandomChallengeAdminSections() {
  return RANDOM_CHALLENGE_ADMIN_SECTIONS
}

function isRandomChallengeAdminSection(sectionKey) {
  return RANDOM_CHALLENGE_ADMIN_SECTIONS.some((section) => section.key === sectionKey)
}

function getRandomChallengeAdminSectionTitle(sectionKey) {
  return RANDOM_CHALLENGE_ADMIN_SECTIONS.find((section) => section.key === sectionKey)?.title || "التحدي"
}

function getRandomChallengeAdminSectionCount(boxKey) {
  return Number(RANDOM_CHALLENGE_ADMIN_SECTION_COUNTS[boxKey] || 0)
}

function getSafeRandomChallengeAdminSection(sectionKey) {
  return isRandomChallengeAdminSection(sectionKey) ? sectionKey : RANDOM_CHALLENGE_ADMIN_DEFAULT_SECTION
}

function getRandomChallengeAdminRowIndex(boxKey, number) {
  const safeBoxKey = String(boxKey || "")
  const safeNumber = Number(number || 0)

  return randomChallengeAdminRows.findIndex(
    (row) => String(row.box_key) === safeBoxKey && Number(row.number) === safeNumber
  )
}

function setRandomChallengeAdminLocalRow(boxKey, number, changes = {}) {
  const safeBoxKey = String(boxKey || "")
  const safeNumber = Number(number || 0)
  const existingIndex = getRandomChallengeAdminRowIndex(safeBoxKey, safeNumber)
  const oldRow = existingIndex >= 0 ? randomChallengeAdminRows[existingIndex] : {}

  const nextRow = {
    ...oldRow,
    model: Number(currentModel),
    box_key: safeBoxKey,
    number: safeNumber,
    ...changes
  }

  if (existingIndex >= 0) {
    randomChallengeAdminRows[existingIndex] = nextRow
  } else {
    randomChallengeAdminRows.push(nextRow)
  }

  return nextRow
}

function invalidateRandomChallengeAdminCache() {
  if (typeof invalidateAdminHomeCache === "function") {
    invalidateAdminHomeCache()
  }
}

function collectRandomChallengeDraftBeforeSectionChange(sectionKey) {
  if (sectionKey === "fatbla") {
    collectFatblaCurrentDraft()
    return
  }

  if (sectionKey !== "sharedPlayer") {
    collectRandomChallengeCurrentDraft(sectionKey)
  }
}


function isRandomChallengeAdminBusy() {
  return (
    randomChallengeAdminSaving === true ||
    (
      typeof isAdminSaving === "function" &&
      isAdminSaving()
    )
  )
}

async function confirmRandomChallengeAdminAction(
  message,
  {
    title = "تأكيد الحذف",
    okText = "حذف",
    cancelText = "إلغاء",
    danger = true
  } = {}
) {
  if (typeof showAdminConfirm === "function") {
    return showAdminConfirm(message, {
      title,
      okText,
      cancelText,
      danger
    })
  }

  return window.confirm(message)
}

function revokeRandomChallengePreviewUrl(value) {
  const url = String(value || "")

  if (!url.startsWith("blob:")) {
    return
  }

  try {
    URL.revokeObjectURL(url)
  } catch (error) {
    console.warn("REVOKE RANDOM CHALLENGE PREVIEW URL:", error)
  }
}

function resetFatblaAdminDraft() {
  Object.values(fatblaAdminDraft || {}).forEach((item) => {
    revokeRandomChallengePreviewUrl(item?.image)
    revokeRandomChallengePreviewUrl(item?.video)
  })

  fatblaAdminDraft = {}
}

function normalizeFatblaAdminCount(value) {
  if (typeof normalizeRandomChallengeAuctionCount === "function") {
    return normalizeRandomChallengeAuctionCount(value)
  }

  const count = Number(value || 5)

  if (count === 3) return 3
  if (count === 7) return 7

  return 5
}

function syncFatblaAdminCountFromSharedSetting() {
  const nextCount = normalizeFatblaAdminCount(
    auctionAdminCount || fatblaAdminCount || 5
  )

  if (nextCount !== Number(fatblaAdminCount || 5)) {
    fatblaAdminCount = nextCount
    fatblaAdminLoaded = false
  }

  return fatblaAdminCount
}

/* =========================
   3) OPEN + NAVIGATION
========================= */

async function openAdminRandomChallenge() {
  if (!currentModel) {
    showGameToast("افتح نموذج أولاً", "warning")
    return false
  }

  /*
    openAdminSegment يفعّل adminNavBusy قبل استدعاء هذه الدالة.
    لذلك نحدد مالك القفل بدل الخروج مباشرة.
  */
  const ownsNavLock = adminNavBusy !== true

  if (ownsNavLock) {
    adminNavBusy = true
  }

  try {
    const visibility = await loadGlobalSegmentVisibilityMap()

    if (!isAdminSegmentGloballyEnabled("randomChallenge", visibility)) {
      showGameToast("فقرة التحدي مخفية من إعدادات الفقرات", "warning")
      return false
    }

    currentAdminSegment = "randomChallenge"
    randomChallengeAdminSection = getSafeRandomChallengeAdminSection(
      randomChallengeAdminSection
    )

    renderAdminSegmentActions()
    scheduleAdminTabsRefresh()

    await loadRandomChallengeAdminRows(null, true)

    if (randomChallengeAdminSection === "fatbla") {
      syncFatblaAdminCountFromSharedSetting()
      await loadFatblaAdminDraft()
    }

    renderAdminRandomChallengePage()
    return true
  } catch (error) {
    console.error("OPEN RANDOM CHALLENGE ERROR:", error)
    showGameToast("تعذر فتح فقرة التحدي", "error")
    return false
  } finally {
    if (ownsNavLock) {
      adminNavBusy = false
    }
  }
}

async function switchRandomChallengeAdminSection(section, showToast = false) {
  if (isRandomChallengeAdminBusy()) {
    return false
  }

  if (!currentModel) {
    showGameToast("افتح نموذج أولاً", "warning")
    return false
  }

  const safeSection = getSafeRandomChallengeAdminSection(section)
  const previousSection = getSafeRandomChallengeAdminSection(
    randomChallengeAdminSection
  )

  try {
    if (previousSection !== safeSection) {
      collectRandomChallengeDraftBeforeSectionChange(previousSection)
    }

    randomChallengeAdminSection = safeSection

    if (safeSection === "fatbla") {
      syncFatblaAdminCountFromSharedSetting()
      await loadFatblaAdminDraft()
    } else if (safeSection !== "sharedPlayer") {
      await loadRandomChallengeAdminRows(safeSection)
    }

    renderAdminRandomChallengePage()

    if (showToast) {
      showGameToast(
        `تم فتح ${getRandomChallengeAdminSectionTitle(safeSection)}`,
        "success"
      )
    }

    return true
  } catch (error) {
    console.error("SWITCH RANDOM CHALLENGE SECTION ERROR:", error)
    showGameToast("تعذر فتح قسم التحدي", "error")
    return false
  }
}

async function openFatblaAdmin() {
  randomChallengeAdminSection = "fatbla"

  if (currentAdminSegment !== "randomChallenge") {
    return openAdminRandomChallenge()
  }

  syncFatblaAdminCountFromSharedSetting()
  await loadFatblaAdminDraft()
  renderAdminRandomChallengePage()

  return true
}

function renderFatblaAdmin() {
  return buildFatblaAdminContent()
}

function refreshFatblaAdmin() {
  renderAdminRandomChallengePage()
}

/* =========================
   4) LOAD DATA
========================= */

async function loadRandomChallengeAdminRows(_sectionKey = null, force = false) {
  if (!currentModel) {
    randomChallengeAdminRows = []
    randomChallengeAdminRowsLoadedModel = null
    return []
  }

  const model = Number(currentModel)

  if (!force && randomChallengeAdminRowsLoadedModel === model) {
    return randomChallengeAdminRows
  }

  const result = await dbSelect(
    "random_challenge_questions",
    (query) =>
      query
        .eq("model", model)
        .order("box_key", { ascending: true })
        .order("number", { ascending: true }),
    {
      select: "*",
      fallback: [],
      logLabel: "LOAD RANDOM CHALLENGE ADMIN"
    }
  )

  if (!result.ok) {
    console.error("LOAD RANDOM CHALLENGE ADMIN ERROR:", result.error)
    showGameToast("تعذر تحميل أسئلة التحدي", "error")

    randomChallengeAdminRows = []
    randomChallengeAdminRowsLoadedModel = null
    return []
  }

  randomChallengeAdminRows = Array.isArray(result.data) ? result.data : []
  randomChallengeAdminRowsLoadedModel = model

  return randomChallengeAdminRows
}

async function loadFatblaAdminDraft(force = false) {
  if (!currentModel) {
    resetFatblaAdminDraft()
    fatblaAdminLoaded = false
    fatblaAdminLoadedModel = null
    return false
  }

  const model = Number(currentModel)

  if (
    fatblaAdminLoaded &&
    fatblaAdminLoadedModel === model &&
    !force
  ) {
    return true
  }

  const [rowsResult, settingsResult] = await Promise.all([
    dbSelect(
      "auction_questions",
      (query) =>
        query
          .eq("model", model)
          .order("number", { ascending: true }),
      {
        select: "*",
        fallback: [],
        logLabel: "LOAD FATBLA"
      }
    ),

    dbSelect(
      "segment_settings",
      (query) =>
        query
          .eq("model", model)
          .eq("segment", "auction")
          .maybeSingle(),
      {
        select: "item_count",
        fallback: null,
        logLabel: "LOAD FATBLA SETTINGS"
      }
    )
  ])

  if (!rowsResult.ok) {
    console.error("LOAD FATBLA ERROR:", rowsResult.error)
    showGameToast("تعذر تحميل فتبلة", "error")

    fatblaAdminLoaded = false
    fatblaAdminLoadedModel = null
    return false
  }

  if (!settingsResult.ok) {
    console.error(
      "LOAD FATBLA SETTINGS ERROR:",
      settingsResult.error
    )
  }

  fatblaAdminCount = normalizeFatblaAdminCount(
    settingsResult.data?.item_count ||
    auctionAdminCount ||
    5
  )

  auctionAdminCount = fatblaAdminCount

  resetFatblaAdminDraft()

  for (
    let number = 1;
    number <= fatblaAdminCount;
    number++
  ) {
    getFatblaDraftItem(number)
  }

  for (const row of rowsResult.data || []) {
    const number = Number(row.number || 0)

    if (
      number < 1 ||
      number > fatblaAdminCount
    ) {
      continue
    }

    Object.assign(
      getFatblaDraftItem(number),
      {
        id: row.id || null,
        question: row.question || "",
        answer: row.answer || "",
        image: row.image || "",
        video: row.video || "",
        file: null,
        videoFile: null,
        cleared: false
      }
    )
  }

  fatblaAdminLoaded = true
  fatblaAdminLoadedModel = model

  return true
}

/* =========================
   5) DATA + STATUS HELPERS
========================= */

function getRandomChallengeAdminRow(boxKey, number) {
  const index = getRandomChallengeAdminRowIndex(boxKey, number)
  return index >= 0 ? randomChallengeAdminRows[index] : null
}

function getRandomChallengeQuestionStatus(boxKey, number) {
  const row = getRandomChallengeAdminRow(boxKey, number) || {}
  const requiresAnswer = boxKey === "trueFalse"
  const completed = [
    hasText(row.question),
    requiresAnswer && RANDOM_CHALLENGE_TRUE_FALSE_ANSWERS.includes(String(row.answer || ""))
  ].filter(Boolean).length

  return getAdminItemStatus(completed, requiresAnswer ? 2 : 1)
}

function getFatblaDraftItem(number) {
  const safeNumber = Number(number || 1)

  if (!fatblaAdminDraft[safeNumber]) {
    fatblaAdminDraft[safeNumber] = {
      id: null,
      question: "",
      answer: "",
      image: "",
      video: "",
      file: null,
      videoFile: null,
      cleared: false
    }
  }

  return fatblaAdminDraft[safeNumber]
}

function getFatblaItemStatus(number) {
  const item = getFatblaDraftItem(number)
  const hasMedia = hasText(item.image) || hasText(item.video) || !!item.file || !!item.videoFile
  const completed = [hasText(item.answer), hasMedia].filter(Boolean).length

  return getAdminItemStatus(completed, 2)
}

/* =========================
   6) MAIN RENDER
========================= */

function renderAdminRandomChallengePage() {
  const area = editor()
  if (!area) return

  const currentSection = getSafeRandomChallengeAdminSection(randomChallengeAdminSection)
  const isSharedPlayer = currentSection === "sharedPlayer"

  area.innerHTML = `
    <div class="randomChallengeAdminPage">
      <div class="adminEditorTopBar randomChallengeAdminTopBar">
        <div class="adminEditorTitleBox">
          <h2>فقرة التحدي</h2>
          <span>اختر المربع ثم أضف أسئلته وإجاباته</span>
        </div>
      </div>

      ${buildRandomChallengeAdminTabs(currentSection)}

      <div class="randomChallengeAdminContent">
        ${buildRandomChallengeAdminSectionContent(currentSection)}
      </div>

      ${isSharedPlayer ? "" : buildRandomChallengeAdminActions()}
    </div>
  `

  normalizeAdminEditorCards()
}

function buildRandomChallengeAdminTabs(currentSection) {
  return `
    <div class="randomChallengeAdminTabs">
      ${RANDOM_CHALLENGE_ADMIN_SECTIONS.map(({ key, title }) => {
        const activeClass = key === currentSection ? "active" : ""

        return `
          <button
            type="button"
            class="randomChallengeAdminTab ${activeClass}"
            onclick="switchRandomChallengeAdminSection('${escapeHtml(key)}')"
          >
            ${escapeHtml(title)}
          </button>
        `
      }).join("")}
    </div>
  `
}

function buildRandomChallengeAdminSectionContent(sectionKey) {
  if (sectionKey === "sharedPlayer") {
    return buildRandomChallengeSharedPlayer()
  }

  if (sectionKey === "fatbla") {
    return buildFatblaAdminContent()
  }

  return buildRandomChallengeQuestionsOnePage(
    sectionKey,
    getRandomChallengeAdminSectionCount(sectionKey)
  )
}

function buildRandomChallengeAdminActions() {
  return `
    <div class="randomChallengeAdminActions">
      <button
        type="button"
        class="adminBtn adminBtnMango adminSaveBtn"
        onclick="saveRandomChallengeCurrentSection()"
      >
        حفظ القسم
      </button>

      <button
        type="button"
        class="adminBtn adminBtnDanger adminDeleteAllBtn"
        onclick="deleteRandomChallengeCurrentSection()"
      >
        حذف القسم
      </button>
    </div>
  `
}

/* =========================
   7) SHARED PLAYER
========================= */

function buildRandomChallengeSharedPlayer() {
  return `
    <div class="adminEmptyState">
      اللاعب المشترك جاهز ولا يحتاج أسئلة
    </div>
  `
}

/* =========================
   8) CHALLENGE QUESTIONS BUILD
========================= */

function buildRandomChallengeQuestionsOnePage(boxKey, count) {
  return `
    <div class="randomChallengeQuestionsEditor adminOnePageEditor">
      <div class="adminEditCardsGrid randomChallengeOnePageGrid">
        ${Array.from(
          { length: Number(count || 0) },
          (_, index) => buildRandomChallengeOnePageCard(boxKey, index + 1)
        ).join("")}
      </div>
    </div>
  `
}

function buildRandomChallengeOnePageCard(boxKey, number) {
  const row = getRandomChallengeAdminRow(boxKey, number) || {
    id: null,
    question: "",
    answer: ""
  }

  const status = getRandomChallengeQuestionStatus(boxKey, number)
  const isTrueFalse = boxKey === "trueFalse"
  const title = isTrueFalse ? `العبارة ${number}` : `السؤال ${number}`
  const placeholder = isTrueFalse ? "اكتب العبارة" : "اكتب السؤال"

  return `
    <details
      class="adminEditItemCard randomChallengeOnePageCard ${status.className}"
      ontoggle="handleAdminEditCardToggle(this)"
    >
      <summary>
        <div class="adminEditItemTitle">
          <strong>${escapeHtml(title)}</strong>
        </div>

        <div class="adminEditItemMeta">
          <span class="adminEditStatusPill">${status.label}</span>
          <span class="adminEditProgressPill">${status.progress}</span>
        </div>
      </summary>

      <div class="adminEditItemBody">
        <div class="adminField ${getAdminMissingFieldClass(row.question)}">
          <textarea
            id="randomChallengeQuestionInput_${boxKey}_${number}"
            placeholder="${escapeHtml(placeholder)}"
          >${escapeHtml(row.question || "")}</textarea>
        </div>

        ${isTrueFalse ? buildRandomChallengeTrueFalseField(number, row.answer || "") : ""}

        <button
          type="button"
          class="adminDeleteMiniBtn"
          onclick="clearRandomChallengeAdminQuestion('${escapeHtml(boxKey)}', ${number})"
        >
          حذف
        </button>
      </div>
    </details>
  `
}

function buildRandomChallengeTrueFalseField(number, currentAnswer) {
  const answer = RANDOM_CHALLENGE_TRUE_FALSE_ANSWERS.includes(currentAnswer) ? currentAnswer : ""

  return `
    <div class="adminField ${getAdminMissingFieldClass(answer)}">
      <div class="randomChallengeTrueFalseOptions">
        <button
          type="button"
          class="randomChallengeTrueFalseBtn ${answer === "صح" ? "selected correct" : ""}"
          onclick="selectRandomChallengeTrueFalseAnswer(${number}, 'صح', this)"
        >
          صح
        </button>

        <button
          type="button"
          class="randomChallengeTrueFalseBtn ${answer === "خطأ" ? "selected wrong" : ""}"
          onclick="selectRandomChallengeTrueFalseAnswer(${number}, 'خطأ', this)"
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

/* =========================
   9) FATBLA BUILD
========================= */

function buildFatblaAdminContent() {
  const total = Number(fatblaAdminCount || 5)

  return `
    <div class="fatblaAdminShell compactFatblaAdminShell adminOnePageEditor">
      <div class="adminEditCardsGrid fatblaOnePageGrid">
        ${Array.from({ length: total }, (_, index) => buildFatblaOnePageCard(index + 1)).join("")}
      </div>
    </div>
  `
}

function buildFatblaOnePageCard(number) {
  const safeNumber = Number(number || 1)
  const item = getFatblaDraftItem(safeNumber)
  const status = getFatblaItemStatus(safeNumber)
  const hasMedia = hasText(item.image) || hasText(item.video) || !!item.file || !!item.videoFile
  const missing = []

  if (!hasText(item.answer)) missing.push("الإجابة")
  if (!hasMedia) missing.push("الصورة أو الفيديو")

  return `
    <details
      class="adminEditItemCard fatblaQuestionOnePageCard ${status.className}"
      ontoggle="handleAdminEditCardToggle(this)"
    >
      <summary>
        <div class="adminEditItemTitle">
          <strong>الرقم ${safeNumber}</strong>
          <span>${status.isDone ? "مكتمل" : `ناقص: ${missing.join("، ")}`}</span>
        </div>

        <div class="adminEditItemMeta">
          <span class="adminEditStatusPill">${status.label}</span>
          <span class="adminEditProgressPill">${status.progress}</span>
        </div>
      </summary>

      <div class="adminEditItemBody">
        <div class="fatblaOnePageLayout fatblaOnePageLayoutAnswerOnly">
          <div class="fatblaOnePageMedia">
            <div class="adminField ${hasMedia ? "" : "adminMissingField"}">
              <label>الصورة</label>
              <input
                type="file"
                id="fatblaFile${safeNumber}"
                accept="image/*"
                onchange="changeFatblaImage(${safeNumber}, this.files?.[0])"
              >
            </div>

            <div class="adminField ${hasMedia ? "" : "adminMissingField"}">
              <label>الفيديو</label>
              <input
                type="file"
                id="fatblaVideo${safeNumber}"
                accept="video/*"
                onchange="changeFatblaVideo(${safeNumber}, this.files?.[0])"
              >
            </div>

            ${
              hasMedia
                ? ""
                : `
                  <div class="adminMissingHint">
                    أضف صورة أو فيديو
                  </div>
                `
            }

            <div class="fatblaPreviewBox fatblaPreviewLarge">
              ${buildFatblaMediaPreview(item)}
            </div>
          </div>

          <div class="fatblaOnePageFields">
            <div class="adminField ${getAdminMissingFieldClass(item.answer)}">
              <label>الإجابة</label>
              <input
                id="fatblaAnswer${safeNumber}"
                placeholder="اكتب الإجابة"
                value="${escapeHtml(item.answer || "")}"
              >

              ${
                hasText(item.answer)
                  ? ""
                  : `
                    <div class="adminMissingHint">
                      الإجابة ناقصة
                    </div>
                  `
              }
            </div>

            <button
              type="button"
              class="adminDeleteBtn"
              onclick="clearFatblaQuestion(${safeNumber})"
            >
              حذف الرقم
            </button>
          </div>
        </div>
      </div>
    </details>
  `
}

function buildFatblaMediaPreview(item = {}) {
  if (item.video) {
    return `
      <video
        src="${escapeHtml(item.video)}"
        class="previewImg"
        controls
      ></video>
    `
  }

  if (item.image) {
    return `
      <img
        src="${escapeHtml(item.image)}"
        class="previewImg"
        alt=""
      >
    `
  }

  return `
    <div class="emptyImageHint">
      لا توجد صورة أو فيديو
    </div>
  `
}

/* =========================
   10) DRAFT COLLECTION + INPUT ACTIONS
========================= */

function collectRandomChallengeCurrentDraft(boxKey = randomChallengeAdminSection) {
  const safeBoxKey = String(boxKey || "")
  const count = getRandomChallengeAdminSectionCount(safeBoxKey)

  if (!count) return

  for (let number = 1; number <= count; number++) {
    const questionInput = document.getElementById(
      `randomChallengeQuestionInput_${safeBoxKey}_${number}`
    )
    const answerInput = document.getElementById(
      `randomChallengeAnswerInput_${safeBoxKey}_${number}`
    )

    if (!questionInput && !answerInput) continue

    setRandomChallengeAdminLocalRow(safeBoxKey, number, {
      question: String(questionInput?.value || "").trim(),
      answer:
        safeBoxKey === "trueFalse"
          ? String(answerInput?.value || "").trim()
          : ""
    })
  }
}

async function clearRandomChallengeAdminQuestion(boxKey, number) {
  if (isRandomChallengeAdminBusy()) {
    return false
  }

  if (!currentModel) {
    showGameToast("افتح النموذج أولاً", "warning")
    return false
  }

  const safeBoxKey = getSafeRandomChallengeAdminSection(boxKey)
  const safeNumber = Number(number || 0)

  if (
    safeBoxKey === "sharedPlayer" ||
    safeBoxKey === "fatbla" ||
    safeNumber < 1
  ) {
    return false
  }

  collectRandomChallengeCurrentDraft(safeBoxKey)

  const existingRow = getRandomChallengeAdminRow(
    safeBoxKey,
    safeNumber
  )

  const hasPersistedRow = Boolean(existingRow?.id)

  if (hasPersistedRow) {
    const confirmed = await confirmRandomChallengeAdminAction(
      `هل تريد حذف الرقم ${safeNumber} من ${getRandomChallengeAdminSectionTitle(safeBoxKey)}؟`,
      {
        title: "حذف السؤال",
        okText: "حذف",
        danger: true
      }
    )

    if (!confirmed) {
      return false
    }

    randomChallengeAdminSaving = true
    setAdminSaving(true, "جارٍ حذف السؤال...")

    try {
      const deleteResult = await dbDelete(
        "random_challenge_questions",
        (query) =>
          query
            .eq("model", Number(currentModel))
            .eq("box_key", safeBoxKey)
            .eq("number", safeNumber),
        {
          logLabel: "DELETE RANDOM CHALLENGE ITEM"
        }
      )

      if (!deleteResult.ok) {
        console.error(
          "DELETE RANDOM CHALLENGE ITEM ERROR:",
          deleteResult.error
        )

        showGameToast("تعذر حذف السؤال", "error")
        return false
      }
    } catch (error) {
      console.error(
        "DELETE RANDOM CHALLENGE ITEM CATCH:",
        error
      )

      showGameToast("حدث خطأ أثناء حذف السؤال", "error")
      return false
    } finally {
      randomChallengeAdminSaving = false
      setAdminSaving(false)
    }
  }

  setRandomChallengeAdminLocalRow(
    safeBoxKey,
    safeNumber,
    {
      id: null,
      question: "",
      answer: ""
    }
  )

  invalidateRandomChallengeAdminCache()
  renderAdminRandomChallengePage()

  showGameToast(
    hasPersistedRow
      ? "تم حذف السؤال"
      : "تم مسح السؤال",
    "success"
  )

  return true
}

function selectRandomChallengeTrueFalseAnswer(number, answer, button) {
  const safeAnswer = answer === "خطأ" ? "خطأ" : "صح"
  const input = document.getElementById(`randomChallengeAnswerInput_trueFalse_${number}`)

  if (!input || !button) return

  input.value = safeAnswer

  const card = button.closest(".randomChallengeOnePageCard")

  card?.querySelectorAll(".randomChallengeTrueFalseBtn").forEach((item) => {
    item.classList.remove("selected", "correct", "wrong")
  })

  button.classList.add("selected", safeAnswer === "صح" ? "correct" : "wrong")

  setRandomChallengeAdminLocalRow("trueFalse", number, {
    answer: safeAnswer
  })
}

function collectFatblaCurrentDraft() {
  const total = Number(fatblaAdminCount || 5)

  for (let number = 1; number <= total; number++) {
    const item = getFatblaDraftItem(number)
    const answerInput = document.getElementById(`fatblaAnswer${number}`)
    const imageFile = document.getElementById(`fatblaFile${number}`)?.files?.[0] || null
    const videoFile = document.getElementById(`fatblaVideo${number}`)?.files?.[0] || null

    if (answerInput) {
      item.answer = String(answerInput.value || "").trim()
    }

    if (imageFile) {
      item.file = imageFile
      item.videoFile = null
      item.cleared = false
    }

    if (videoFile) {
      item.videoFile = videoFile
      item.file = null
      item.cleared = false
    }
  }
}

async function changeFatblaImage(number, file) {
  if (!file) return false

  collectFatblaCurrentDraft()

  const item = getFatblaDraftItem(number)

  revokeRandomChallengePreviewUrl(item.image)
  revokeRandomChallengePreviewUrl(item.video)

  item.file = file
  item.videoFile = null
  item.video = ""
  item.image = URL.createObjectURL(file)
  item.cleared = false

  renderAdminRandomChallengePage()
  return true
}

async function changeFatblaVideo(number, file) {
  if (!file) return false

  collectFatblaCurrentDraft()

  const item = getFatblaDraftItem(number)

  revokeRandomChallengePreviewUrl(item.image)
  revokeRandomChallengePreviewUrl(item.video)

  item.videoFile = file
  item.file = null
  item.image = ""
  item.video = URL.createObjectURL(file)
  item.cleared = false

  renderAdminRandomChallengePage()
  return true
}

function clearFatblaQuestion(number) {
  collectFatblaCurrentDraft()

  const item = getFatblaDraftItem(number)

  revokeRandomChallengePreviewUrl(item.image)
  revokeRandomChallengePreviewUrl(item.video)

  Object.assign(item, {
    answer: "",
    image: "",
    video: "",
    file: null,
    videoFile: null,
    cleared: true
  })

  renderAdminRandomChallengePage()

  showGameToast(
    "تم مسح الرقم، اضغط حفظ القسم لتثبيت الحذف",
    "info"
  )
}

/* =========================
   11) SAVE
========================= */

async function saveRandomChallengeCurrentSection() {
  if (isRandomChallengeAdminBusy()) {
    return false
  }

  if (!currentModel) {
    showGameToast("افتح النموذج أولاً", "warning")
    return false
  }

  const boxKey = getSafeRandomChallengeAdminSection(
    randomChallengeAdminSection
  )

  if (boxKey === "sharedPlayer") {
    showGameToast(
      "اللاعب المشترك لا يحتاج أسئلة",
      "warning"
    )

    return false
  }

  if (boxKey === "fatbla") {
    return saveFatblaSection()
  }

  const count = getRandomChallengeAdminSectionCount(
    boxKey
  )

  if (!count) {
    showGameToast("قسم التحدي غير معروف", "error")
    return false
  }

  collectRandomChallengeCurrentDraft(boxKey)

  const sectionRows = Array.from(
    { length: count },
    (_, index) => {
      const number = index + 1
      const row =
        getRandomChallengeAdminRow(
          boxKey,
          number
        ) || {}

      return {
        model: Number(currentModel),
        box_key: boxKey,
        number,
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
    }
  )

  const incompleteRow = sectionRows.find(
    (row) => {
      if (!row.question) {
        return true
      }

      return (
        boxKey === "trueFalse" &&
        !RANDOM_CHALLENGE_TRUE_FALSE_ANSWERS.includes(
          row.answer
        )
      )
    }
  )

  if (incompleteRow) {
    const message =
      boxKey === "trueFalse"
        ? `أكمل العبارة وحدد صح أو خطأ للرقم ${incompleteRow.number}`
        : `اكتب السؤال رقم ${incompleteRow.number}`

    showGameToast(message, "warning")
    return false
  }

  randomChallengeAdminSaving = true
  setAdminSaving(
    true,
    `جارٍ حفظ ${getRandomChallengeAdminSectionTitle(boxKey)}...`
  )

  try {
    const result = await dbUpsert(
      "random_challenge_questions",
      sectionRows,
      {
        onConflict: "model,box_key,number",
        select: "*",
        logLabel:
          `SAVE RANDOM CHALLENGE ${boxKey}`
      }
    )

    if (!result.ok) {
      console.error(
        `SAVE RANDOM CHALLENGE ${boxKey} ERROR:`,
        result.error
      )

      showGameToast(
        "تعذر حفظ أسئلة التحدي",
        "error"
      )

      return false
    }

    await loadRandomChallengeAdminRows(
      boxKey,
      true
    )

    invalidateRandomChallengeAdminCache()
    renderAdminRandomChallengePage()

    showGameToast(
      `تم حفظ ${getRandomChallengeAdminSectionTitle(boxKey)}`,
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
    setAdminSaving(false)
  }
}

async function saveFatblaSection() {
  if (isRandomChallengeAdminBusy()) {
    return false
  }

  if (!currentModel) {
    showGameToast("افتح النموذج أولاً", "warning")
    return false
  }

  randomChallengeAdminSaving = true

  try {
    collectFatblaCurrentDraft()
    setAdminSaving(true, "جارٍ حفظ فتبلة...")

    const model = Number(currentModel)
    const finalCount = normalizeFatblaAdminCount(
      fatblaAdminCount || auctionAdminCount || 5
    )

    fatblaAdminCount = finalCount
    auctionAdminCount = finalCount

    const oldRowsResult = await dbSelect(
      "auction_questions",
      (query) => query.eq("model", model),
      {
        select: "id,number,image,video",
        fallback: [],
        logLabel: "READ OLD FATBLA"
      }
    )

    if (!oldRowsResult.ok) {
      console.error(
        "READ OLD FATBLA ERROR:",
        oldRowsResult.error
      )

      showGameToast(
        "تعذر قراءة بيانات فتبلة",
        "error"
      )

      return false
    }

    const oldRows = oldRowsResult.data || []

    const oldMap = Object.fromEntries(
      oldRows.map((row) => [
        Number(row.number),
        row
      ])
    )
        const fatblaStorageUrlsToDelete = []

    const rows = []
    const keepNumbers = new Set()

    for (
      let number = 1;
      number <= finalCount;
      number++
    ) {
      const item = getFatblaDraftItem(number)
      const answer = String(
        item.answer || ""
      ).trim()

      const explicitlyCleared =
        item.cleared === true

      let image = explicitlyCleared
        ? ""
        : (
            item.image ||
            oldMap[number]?.image ||
            ""
          )

      let video = explicitlyCleared
        ? ""
        : (
            item.video ||
            oldMap[number]?.video ||
            ""
          )

      if (item.file) {
        image = await uploadImageFile(
          item.file,
          `fatbla_${number}`
        )

        if (!image) {
          showGameToast(
            `تعذر رفع صورة الرقم ${number}`,
            "error"
          )

          return false
        }

                fatblaStorageUrlsToDelete.push(
          oldMap[number]?.image,
          oldMap[number]?.video
        )

        video = ""

        Object.assign(item, {
          image,
          video: "",
          file: null,
          videoFile: null,
          cleared: false
        })
      }

      if (item.videoFile) {
        video = await uploadVideoFile(
          item.videoFile,
          `fatbla_video_${number}`
        )

        if (!video) {
          showGameToast(
            `تعذر رفع فيديو الرقم ${number}`,
            "error"
          )

          return false
        }
                fatblaStorageUrlsToDelete.push(
          oldMap[number]?.image,
          oldMap[number]?.video
        )

        image = ""

        Object.assign(item, {
          video,
          image: "",
          videoFile: null,
          file: null,
          cleared: false
        })
      }

      if (!answer && !image && !video) {
        continue
      }

      if (!answer) {
        showGameToast(
          `اكتب إجابة الرقم ${number}`,
          "warning"
        )

        return false
      }

      if (!image && !video) {
        showGameToast(
          `أضف صورة أو فيديو للرقم ${number}`,
          "warning"
        )

        return false
      }

      rows.push({
        model,
        number,
        question: "",
        answer,
        image,
        video,
        note: ""
      })

      keepNumbers.add(number)
      item.cleared = false
    }

    const settingsResult = await dbUpsert(
      "segment_settings",
      {
        model,
        segment: "auction",
        item_count: finalCount
      },
      {
        onConflict: "model,segment",
        logLabel: "SAVE FATBLA SETTINGS"
      }
    )

    if (!settingsResult.ok) {
      console.error(
        "SAVE FATBLA SETTINGS ERROR:",
        settingsResult.error
      )

      showGameToast(
        "تعذر حفظ عدد أرقام فتبلة",
        "error"
      )

      return false
    }

    if (rows.length) {
      const saveResult = await dbUpsert(
        "auction_questions",
        rows,
        {
          onConflict: "model,number",
          logLabel: "SAVE FATBLA"
        }
      )

      if (!saveResult.ok) {
        console.error(
          "SAVE FATBLA ERROR:",
          saveResult.error
        )

        showGameToast(
          "تعذر حفظ فتبلة",
          "error"
        )

        return false
      }
    }

    const staleRows = oldRows.filter(
      (row) =>
        !keepNumbers.has(
          Number(row.number)
        )
    )

    if (staleRows.length) {
      const staleStorageDeleted =
        await deleteAdminStorageUrls(
          staleRows.flatMap(row => [
            row.image,
            row.video
          ])
        )

      if (!staleStorageDeleted) {
        showGameToast(
          "توقف الحذف لأن ملفات فتبلة القديمة لم تُحذف",
          "error"
        )

        return false
      }
      

      const deleteResults = await Promise.all(
        staleRows.map((oldRow) =>
          dbDelete(
            "auction_questions",
            (query) =>
              query
                .eq("model", model)
                .eq(
                  "number",
                  Number(oldRow.number)
                ),
            {
              logLabel: "DELETE OLD FATBLA"
            }
          )
        )
      )

      const failedDelete = deleteResults.find(
        (result) => !result?.ok
      )

      if (failedDelete) {
        console.error(
          "DELETE OLD FATBLA ERROR:",
          failedDelete.error
        )

        showGameToast(
          "تم الحفظ لكن تعذر حذف بعض البيانات القديمة",
          "warning"
        )

        return false
      }
    }

        if (fatblaStorageUrlsToDelete.length) {
      const replacedStorageDeleted =
        await deleteAdminStorageUrls(
          fatblaStorageUrlsToDelete
        )

      if (!replacedStorageDeleted) {
        showGameToast(
          "تم الحفظ لكن تعذر حذف بعض ملفات فتبلة القديمة",
          "warning"
        )

        return false
      }
    }

    fatblaAdminLoaded = false
    fatblaAdminLoadedModel = null

    await loadFatblaAdminDraft(true)

    if (
  typeof updateAdminQuickSettingUI ===
  "function"
) {
  updateAdminQuickSettingUI(
    "auction",
    fatblaAdminCount
  )
}

    invalidateRandomChallengeAdminCache()
    renderAdminRandomChallengePage()

    showGameToast(
      rows.length
        ? "تم حفظ فتبلة"
        : "تم حذف جميع أرقام فتبلة",
      "success"
    )

    return true
  } catch (error) {
    console.error(
      "SAVE FATBLA CATCH:",
      error
    )

    showGameToast(
      "حدث خطأ أثناء حفظ فتبلة",
      "error"
    )

    return false
  } finally {
    randomChallengeAdminSaving = false
    setAdminSaving(false)
  }
}

/* =========================
   12) DELETE
========================= */

async function deleteRandomChallengeCurrentSection() {
  if (isRandomChallengeAdminBusy()) {
    return false
  }

  if (!currentModel) {
    showGameToast("افتح النموذج أولاً", "warning")
    return false
  }

  const boxKey = getSafeRandomChallengeAdminSection(
    randomChallengeAdminSection
  )

  if (boxKey === "sharedPlayer") {
    return false
  }

  if (boxKey === "fatbla") {
    return deleteFatblaSection()
  }

  const sectionTitle =
    getRandomChallengeAdminSectionTitle(
      boxKey
    )

  const confirmed =
    await confirmRandomChallengeAdminAction(
      `هل تريد حذف جميع أسئلة ${sectionTitle}؟`,
      {
        title: "حذف القسم",
        okText: "حذف القسم",
        danger: true
      }
    )

  if (!confirmed) {
    return false
  }

  randomChallengeAdminSaving = true
  setAdminSaving(
    true,
    `جارٍ حذف ${sectionTitle}...`
  )

  try {
    const result = await dbDelete(
      "random_challenge_questions",
      (query) =>
        query
          .eq(
            "model",
            Number(currentModel)
          )
          .eq("box_key", boxKey),
      {
        logLabel:
          `DELETE RANDOM CHALLENGE ${boxKey}`
      }
    )

    if (!result.ok) {
      console.error(
        `DELETE RANDOM CHALLENGE ${boxKey} ERROR:`,
        result.error
      )

      showGameToast(
        "تعذر حذف أسئلة القسم",
        "error"
      )

      return false
    }

    randomChallengeAdminRows =
      randomChallengeAdminRows.filter(
        (row) =>
          String(row.box_key) !== boxKey
      )

    invalidateRandomChallengeAdminCache()
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
    setAdminSaving(false)
  }
}

async function deleteFatblaSection() {
  if (isRandomChallengeAdminBusy()) {
    return false
  }

  if (!currentModel) {
    showGameToast("افتح النموذج أولاً", "warning")
    return false
  }

  const confirmed =
    await confirmRandomChallengeAdminAction(
      "هل تريد حذف جميع بيانات فتبلة؟",
      {
        title: "حذف فتبلة",
        okText: "حذف الكل",
        danger: true
      }
    )

  if (!confirmed) {
    return false
  }

  randomChallengeAdminSaving = true

  try {
    setAdminSaving(
      true,
      "جارٍ حذف فتبلة..."
    )

    const model =
      Number(currentModel)

    const mediaResult =
      await dbSelect(
        "auction_questions",
        query =>
          query.eq(
            "model",
            model
          ),
        {
          select: "image,video",
          fallback: [],
          logLabel:
            "LOAD FATBLA MEDIA BEFORE DELETE"
        }
      )

    if (!mediaResult.ok) {
      console.error(
        "LOAD FATBLA MEDIA BEFORE DELETE ERROR:",
        mediaResult.error
      )

      showGameToast(
        "تعذر قراءة صور وفيديوهات فتبلة",
        "error"
      )

      return false
    }

    const storageDeleted =
      await deleteAdminStorageUrls(
        (mediaResult.data || [])
          .flatMap(item => [
            item.image,
            item.video
          ])
      )

    if (!storageDeleted) {
      showGameToast(
        "توقف الحذف لأن ملفات فتبلة لم تُحذف",
        "error"
      )

      return false
    }

    const [
      deleteQuestionsResult,
      deleteSettingsResult
    ] = await Promise.all([
      dbDelete(
        "auction_questions",
        (query) =>
          query.eq("model", model),
        {
          logLabel:
            "DELETE FATBLA QUESTIONS"
        }
      ),

      dbDelete(
        "segment_settings",
        (query) =>
          query
            .eq("model", model)
            .eq("segment", "auction"),
        {
          logLabel:
            "DELETE FATBLA SETTINGS"
        }
      )
    ])

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

    if (!deleteSettingsResult.ok) {
      console.error(
        "DELETE FATBLA SETTINGS ERROR:",
        deleteSettingsResult.error
      )
    }

    resetFatblaAdminDraft()

    fatblaAdminCount = 5
    auctionAdminCount = 5
    fatblaAdminLoaded = false
    fatblaAdminLoadedModel = null

    await loadFatblaAdminDraft(true)
    if (
  typeof updateAdminQuickSettingUI ===
  "function"
) {
  updateAdminQuickSettingUI(
    "auction",
    fatblaAdminCount
  )
}

    invalidateRandomChallengeAdminCache()
    renderAdminRandomChallengePage()

    if (deleteSettingsResult.ok) {
      showGameToast(
        "تم حذف جميع بيانات فتبلة",
        "success"
      )
    } else {
      showGameToast(
        "تم حذف الأسئلة لكن تعذر حذف إعدادات فتبلة",
        "warning"
      )
    }

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
    randomChallengeAdminSaving = false
    setAdminSaving(false)
  }
}
/* =========================
   13) PUBLIC API
========================= */

Object.assign(window, {
  getRandomChallengeAdminSections,

  openAdminRandomChallenge,
  switchRandomChallengeAdminSection,

  openFatblaAdmin,
  renderFatblaAdmin,
  refreshFatblaAdmin,

  saveRandomChallengeCurrentSection,
  deleteRandomChallengeCurrentSection,
  clearRandomChallengeAdminQuestion,

  selectRandomChallengeTrueFalseAnswer,

  changeFatblaImage,
  changeFatblaVideo,
  clearFatblaQuestion,
  deleteFatblaSection
})