/* =========================================================
   WARMUP ADMIN / إدارة فقرة التسخين
========================================================= */

/* =========================
   1) Local State
========================= */

let warmupAdminDraft = {}

/* =========================
   2) Draft Helpers
========================= */

function getWarmupDraftCategory(category) {
  const categoryNumber = Number(category || 1)

  if (!warmupAdminDraft[categoryNumber]) {
    warmupAdminDraft[categoryNumber] = {
      category_name: "",

      questions: {
        1: {
          id: null,
          question: "",
          answer: ""
        },

        2: {
          id: null,
          question: "",
          answer: ""
        },

        4: {
          id: null,
          question: "",
          answer: ""
        }
      }
    }
  }

  return warmupAdminDraft[categoryNumber]
}

function collectWarmupCurrentDraft() {
  for (let category = 1; category <= 4; category++) {
    const categoryDraft = getWarmupDraftCategory(category)

    categoryDraft.category_name = (
      document.getElementById(`cat${category}`)?.value || ""
    ).trim()

    for (const number of [1, 2, 4]) {
      if (!categoryDraft.questions[number]) {
        categoryDraft.questions[number] = {
          id: null,
          question: "",
          answer: ""
        }
      }

      categoryDraft.questions[number].question = (
        document.getElementById(`q${category}_${number}`)?.value || ""
      ).trim()

      categoryDraft.questions[number].answer = (
        document.getElementById(`a${category}_${number}`)?.value || ""
      ).trim()
    }
  }
}

function resetWarmupAdminDraft() {
  warmupAdminDraft = {}

  for (let category = 1; category <= 4; category++) {
    getWarmupDraftCategory(category)
  }
}

/* =========================
   3) Completion Status
========================= */

function getWarmupCategoryStatus(categoryNumber) {
  const categoryDraft = getWarmupDraftCategory(categoryNumber)

  const fields = [
    categoryDraft.category_name,

    categoryDraft.questions[1]?.question,
    categoryDraft.questions[1]?.answer,

    categoryDraft.questions[2]?.question,
    categoryDraft.questions[2]?.answer,

    categoryDraft.questions[4]?.question,
    categoryDraft.questions[4]?.answer
  ]

  const completed = fields.filter(isAdminFieldFilled).length

  return getAdminItemStatus(
    completed,
    fields.length
  )
}

function getWarmupQuestionStatus(categoryNumber, questionNumber) {
  const categoryDraft = getWarmupDraftCategory(categoryNumber)

  const questionDraft =
    categoryDraft.questions[questionNumber] || {}

  const fields = [
    questionDraft.question,
    questionDraft.answer
  ]

  const completed = fields.filter(isAdminFieldFilled).length

  return getAdminItemStatus(
    completed,
    fields.length
  )
}

/* =========================
   4) Load Warmup
========================= */

async function renderWarmupAdmin() {
  if (!currentModel) {
    showGameToast(
      "افتح النموذج أولاً",
      "warning"
    )

    return false
  }

  const result = await dbSelect(
    "questions",

    (query) =>
      query
        .eq(
          "model",
          Number(currentModel)
        )
        .eq(
          "segment",
          "warmup"
        )
        .order(
          "category",
          {
            ascending: true
          }
        )
        .order(
          "number",
          {
            ascending: true
          }
        ),

    {
      select: "*",
      fallback: [],
      logLabel: "LOAD WARMUP"
    }
  )

  if (!result.ok) {
    console.log(
      "LOAD WARMUP ERROR:",
      result.error
    )

    showGameToast(
      "تعذر تحميل التسخين",
      "error"
    )

    return false
  }

  resetWarmupAdminDraft()

  ;(result.data || []).forEach((row) => {
    const category = Number(row.category || 1)
    const number = Number(row.number || 1)

    if (
      category < 1 ||
      category > 4 ||
      ![1, 2, 4].includes(number)
    ) {
      return
    }

    const categoryDraft =
      getWarmupDraftCategory(category)

    if (isAdminFieldFilled(row.category_name)) {
      categoryDraft.category_name =
        String(row.category_name)
    }

    categoryDraft.questions[number] = {
      id: row.id || null,
      question: row.question || "",
      answer: row.answer || ""
    }
  })

  renderWarmupAdminFromDraft()

  return true
}

/* =========================
   5) Render Editor
========================= */

function renderWarmupAdminFromDraft() {
  const area = editor()

  if (!area) return

  area.innerHTML = `
    <div class="warmupAdminShell compactWarmupAdminShell adminOnePageEditor">

      <div class="adminEditorTopBar compactAdminEditorTopBar adminEditorTopBarWithActions">

        <div>
          <h2 class="adminSectionTitle">
            التسخين
          </h2>
        </div>

        <div class="adminInlineActions">

          <button
            type="button"
            class="adminSaveBtn"
            onclick="saveWarmup()"
          >
            حفظ
          </button>

          <button
            type="button"
            class="adminDeleteAllBtn"
            onclick="deleteWarmupSegment()"
          >
            حذف الفقرة
          </button>

        </div>

      </div>

      <div class="adminEditCardsGrid warmupOnePageGrid">

        ${[1, 2, 3, 4]
          .map((category) =>
            buildWarmupCategoryOnePageCard(category)
          )
          .join("")}

      </div>

    </div>
  `

  normalizeAdminEditorCards()
}

/* =========================
   6) Category Card
========================= */

function buildWarmupCategoryOnePageCard(categoryNumber) {
  const category = Number(categoryNumber || 1)

  const categoryDraft =
    getWarmupDraftCategory(category)

  const status =
    getWarmupCategoryStatus(category)

  return `
    <details
      class="
        adminEditItemCard
        warmupCategoryOnePageCard
        ${status.className}
      "
      ontoggle="handleAdminEditCardToggle(this)"
    >

      <summary>

        <div class="adminEditItemTitle">
          <strong>
            الفئة ${category}
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
            ${getAdminMissingFieldClass(
              categoryDraft.category_name
            )}
          "
        >

          <input
            id="cat${category}"
            type="text"
            placeholder="اسم الفئة"
            value="${escapeHtml(
              categoryDraft.category_name || ""
            )}"
          >

        </div>

        <div class="adminEditSubGrid warmupQuestionsOnePageGrid">

          ${[1, 2, 4]
            .map((number) =>
              buildWarmupQuestionOnePageCard(
                category,
                number
              )
            )
            .join("")}

        </div>

      </div>

    </details>
  `
}

/* =========================
   7) Question Card
========================= */

function buildWarmupQuestionOnePageCard(
  categoryNumber,
  questionNumber
) {
  const category = Number(categoryNumber || 1)
  const number = Number(questionNumber || 1)

  const categoryDraft =
    getWarmupDraftCategory(category)

  const questionDraft =
    categoryDraft.questions[number] || {
      id: null,
      question: "",
      answer: ""
    }

  const status =
    getWarmupQuestionStatus(
      category,
      number
    )

  const rowId =
    questionDraft.id
      ? Number(questionDraft.id)
      : "null"

  return `
    <div
      class="
        adminEditSubCard
        warmupQuestionOnePageCard
        ${status.className}
      "
    >

      <div class="adminEditSubHead">

        <strong>
          ${number}
        </strong>

        <span>
          ${status.label} ${status.progress}
        </span>

      </div>

      <div
        class="
          adminField
          ${getAdminMissingFieldClass(
            questionDraft.question
          )}
        "
      >

        <textarea
          id="q${category}_${number}"
          placeholder="السؤال"
        >${escapeHtml(
          questionDraft.question || ""
        )}</textarea>

      </div>

      <div
        class="
          adminField
          ${getAdminMissingFieldClass(
            questionDraft.answer
          )}
        "
      >

        <input
          id="a${category}_${number}"
          type="text"
          placeholder="الإجابة"
          value="${escapeHtml(
            questionDraft.answer || ""
          )}"
        >

      </div>

      <button
        type="button"
        class="adminDeleteMiniBtn"
        onclick="clearWarmupQuestionById(
          ${rowId},
          ${category},
          ${number}
        )"
      >
        حذف
      </button>

    </div>
  `
}

/* =========================
   8) Save Warmup
========================= */

async function saveWarmup() {
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
    collectWarmupCurrentDraft()

    setAdminSaving(
      true,
      "جارٍ حفظ التسخين..."
    )

    const rows = []

    for (
      let category = 1;
      category <= 4;
      category++
    ) {
      const categoryDraft =
        getWarmupDraftCategory(category)

      const categoryName = String(
        categoryDraft.category_name || ""
      ).trim()

      for (const number of [1, 2, 4]) {
        const question = String(
          categoryDraft.questions[number]?.question || ""
        ).trim()

        const answer = String(
          categoryDraft.questions[number]?.answer || ""
        ).trim()

        if (!question && !answer) {
          continue
        }

        rows.push({
          model: Number(currentModel),
          segment: "warmup",
          category: Number(category),
          category_name: categoryName,
          number: Number(number),
          question,
          answer
        })
      }
    }

    if (!rows.length) {
      const confirmed = await showAdminConfirm(
        "التسخين فارغ، هل تريد حذف جميع أسئلة التسخين؟",
        {
          title: "حذف أسئلة التسخين",
          okText: "حذف الكل",
          cancelText: "إلغاء",
          danger: true
        }
      )

      if (!confirmed) {
        showGameToast(
          "تم إلغاء الحفظ",
          "info"
        )

        return false
      }

      const clearResult = await dbDelete(
        "questions",

        (query) =>
          query
            .eq(
              "model",
              Number(currentModel)
            )
            .eq(
              "segment",
              "warmup"
            ),

        {
          logLabel: "CLEAR WARMUP"
        }
      )

      if (!clearResult.ok) {
        console.log(
          "CLEAR WARMUP ERROR:",
          clearResult.error
        )

        showGameToast(
          "تعذر حذف أسئلة التسخين",
          "error"
        )

        return false
      }

      resetWarmupAdminDraft()
      invalidateAdminHomeCache()

      renderWarmupAdminFromDraft()

      showGameToast(
        "تم حذف جميع أسئلة التسخين",
        "success"
      )

      return true
    }

    const oldRowsResult = await dbSelect(
      "questions",

      (query) =>
        query
          .eq(
            "model",
            Number(currentModel)
          )
          .eq(
            "segment",
            "warmup"
          ),

      {
        select: "id,category,number",
        fallback: [],
        logLabel: "READ OLD WARMUP"
      }
    )

    if (!oldRowsResult.ok) {
      console.log(
        "READ OLD WARMUP ERROR:",
        oldRowsResult.error
      )

      showGameToast(
        "تعذر قراءة بيانات التسخين الحالية",
        "error"
      )

      return false
    }

    const saveResult = await dbUpsert(
      "questions",
      rows,
      {
        onConflict:
          "model,segment,category,number",

        logLabel:
          "SAVE WARMUP"
      }
    )

    if (!saveResult.ok) {
      console.log(
        "SAVE WARMUP ERROR:",
        saveResult.error
      )

      showGameToast(
        "فشل حفظ التسخين",
        "error"
      )

      return false
    }

    const keepKeys = new Set(
      rows.map(
        (row) =>
          `${Number(row.category)}_${Number(row.number)}`
      )
    )

    const oldRowsToDelete = (
      oldRowsResult.data || []
    ).filter((oldRow) => {
      const key =
        `${Number(oldRow.category)}_${Number(oldRow.number)}`

      return !keepKeys.has(key)
    })

    if (oldRowsToDelete.length) {
      const deleteResults = await Promise.all(
        oldRowsToDelete.map((oldRow) =>
          dbDelete(
            "questions",

            (query) =>
              query.eq(
                "id",
                Number(oldRow.id)
              ),

            {
              logLabel:
                "DELETE OLD WARMUP"
            }
          )
        )
      )

      const failedDelete =
        deleteResults.find(
          (result) => !result?.ok
        )

      if (failedDelete) {
        console.log(
          "DELETE OLD WARMUP ERROR:",
          failedDelete.error
        )

        invalidateAdminHomeCache()

        showGameToast(
          "تم الحفظ لكن تعذر تنظيف بعض الأسئلة القديمة",
          "warning"
        )

        await renderWarmupAdmin()

        return false
      }
    }

    invalidateAdminHomeCache()

    showGameToast(
      "تم حفظ التسخين",
      "success"
    )

    await renderWarmupAdmin()

    return true
  } catch (error) {
    console.log(
      "SAVE WARMUP CATCH:",
      error
    )

    showGameToast(
      "توقف حفظ التسخين بسبب خطأ",
      "error"
    )

    return false
  } finally {
    setAdminSaving(false)
  }
}

/* =========================
   9) Delete One Question
========================= */

async function clearWarmupQuestionById(
  id,
  categoryNumber,
  questionNumber
) {
  if (!currentModel) {
    showGameToast(
      "افتح النموذج أولاً",
      "warning"
    )

    return false
  }

  const category = Number(categoryNumber || 0)
  const number = Number(questionNumber || 0)

  if (
    category < 1 ||
    category > 4 ||
    ![1, 2, 4].includes(number)
  ) {
    showGameToast(
      "بيانات السؤال غير صحيحة",
      "error"
    )

    return false
  }

  collectWarmupCurrentDraft()

  const categoryDraft =
    getWarmupDraftCategory(category)

  if (!id) {
    categoryDraft.questions[number] = {
      id: null,
      question: "",
      answer: ""
    }

    renderWarmupAdminFromDraft()

    showGameToast(
      "تم تفريغ السؤال",
      "success"
    )

    return true
  }

  const confirmed = await showAdminConfirm(
    `هل تريد حذف سؤال ${number} من الفئة ${category} نهائيًا؟`,
    {
      title: "حذف السؤال",
      okText: "حذف",
      cancelText: "إلغاء",
      danger: true
    }
  )

  if (!confirmed) {
    return false
  }

  try {
    const result = await dbDelete(
      "questions",

      (query) =>
        query.eq(
          "id",
          Number(id)
        ),

      {
        logLabel:
          "DELETE WARMUP BY ID"
      }
    )

    if (!result.ok) {
      console.log(
        "DELETE WARMUP BY ID ERROR:",
        result.error
      )

      showGameToast(
        "تعذر حذف السؤال",
        "error"
      )

      return false
    }

    categoryDraft.questions[number] = {
      id: null,
      question: "",
      answer: ""
    }

    invalidateAdminHomeCache()
    renderWarmupAdminFromDraft()

    showGameToast(
      "تم حذف السؤال",
      "success"
    )

    return true
  } catch (error) {
    console.log(
      "DELETE WARMUP BY ID CATCH:",
      error
    )

    showGameToast(
      "حدث خطأ أثناء حذف السؤال",
      "error"
    )

    return false
  }
}

/* =========================
   10) Delete Full Segment
========================= */

async function deleteWarmupSegment() {
  if (!canRunAdminDelete()) {
    return false
  }

  if (!currentModel) {
    showGameToast(
      "افتح النموذج أولاً",
      "warning"
    )

    return false
  }

  const confirmed = await showAdminConfirm(
    "هل تريد حذف جميع أسئلة فقرة التسخين نهائيًا؟",
    {
      title: "حذف فقرة التسخين",
      okText: "حذف الفقرة",
      cancelText: "إلغاء",
      danger: true
    }
  )

  if (!confirmed) {
    return false
  }

  try {
    const deleteResult = await dbDelete(
      "questions",

      (query) =>
        query
          .eq(
            "model",
            Number(currentModel)
          )
          .eq(
            "segment",
            "warmup"
          ),

      {
        logLabel:
          "DELETE WARMUP SEGMENT"
      }
    )

    if (!deleteResult.ok) {
      console.log(
        "DELETE WARMUP SEGMENT ERROR:",
        deleteResult.error
      )

      showGameToast(
        "تعذر حذف فقرة التسخين",
        "error"
      )

      return false
    }

    resetWarmupAdminDraft()
    invalidateAdminHomeCache()

    renderWarmupAdminFromDraft()

    showGameToast(
      "تم حذف جميع أسئلة التسخين",
      "success"
    )

    return true
  } catch (error) {
    console.log(
      "DELETE WARMUP SEGMENT CATCH:",
      error
    )

    showGameToast(
      "حدث خطأ أثناء حذف فقرة التسخين",
      "error"
    )

    return false
  }
}

/* =========================
   11) Global Exports
========================= */

window.renderWarmupAdmin =
  renderWarmupAdmin

window.saveWarmup =
  saveWarmup

window.clearWarmupQuestionById =
  clearWarmupQuestionById

window.deleteWarmupSegment =
  deleteWarmupSegment