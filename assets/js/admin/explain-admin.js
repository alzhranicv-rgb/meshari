/* =========================================================
   EXPLAIN ADMIN / اشرح الكلمة
========================================================= */

/* =========================
   1) Local State
========================= */

let explainAdminCount = 5
let explainAdminDraft = {}

/* =========================
   2) Count Helpers
========================= */

function setExplainAdminCount(count) {
  explainAdminCount =
    normalizeAdminSegmentCount(
      "explain",
      Number(count || 5)
    )

  return explainAdminCount
}

function getExplainAdminCount() {
  return Number(
    explainAdminCount || 5
  )
}

/* =========================
   3) Draft Helpers
========================= */

function getExplainDraftItem(number) {
  const itemNumber =
    Number(number || 1)

  if (!explainAdminDraft[itemNumber]) {
    explainAdminDraft[itemNumber] = {
      id: null,
      word: ""
    }
  }

  return explainAdminDraft[itemNumber]
}

function resetExplainAdminDraft() {
  explainAdminDraft = {}

  const total = Math.max(
    Number(explainAdminCount || 5),
    9
  )

  for (
    let number = 1;
    number <= total;
    number++
  ) {
    getExplainDraftItem(number)
  }
}

function resetExplainDraftItem(number) {
  const itemNumber =
    Number(number || 1)

  explainAdminDraft[itemNumber] = {
    id: null,
    word: ""
  }

  return explainAdminDraft[itemNumber]
}

function collectExplainDraft() {
  setExplainAdminCount(
    explainAdminCount
  )

  for (
    let number = 1;
    number <= explainAdminCount;
    number++
  ) {
    const item =
      getExplainDraftItem(number)

    item.word = (
      document.getElementById(
        `explainWord_${number}`
      )?.value || ""
    ).trim()
  }
}

/* =========================
   4) Completion Status
========================= */

function getExplainItemStatus(number) {
  const item =
    getExplainDraftItem(number)

  const fields = [
    item.word
  ]

  const completed =
    fields.filter(
      isAdminFieldFilled
    ).length

  return getAdminItemStatus(
    completed,
    fields.length
  )
}

/* =========================
   5) Load Explain
========================= */

async function renderExplainAdmin() {
  if (!currentModel) {
    showGameToast(
      "افتح النموذج أولاً",
      "warning"
    )

    return false
  }

  const savedCount =
    await getAdminSegmentCount(
      "explain"
    )

  setExplainAdminCount(
    savedCount
  )

  const result = await dbSelect(
    "explain_words",

    (query) =>
      query
        .eq(
          "model",
          Number(currentModel)
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
      logLabel: "LOAD EXPLAIN"
    }
  )

  if (!result.ok) {
    console.log(
      "LOAD EXPLAIN ERROR:",
      result.error
    )

    showGameToast(
      "تعذر تحميل اشرح الكلمة",
      "error"
    )

    return false
  }

  resetExplainAdminDraft()

  ;(result.data || []).forEach(
    (row) => {
      const number =
        Number(row.number || 1)

      if (
        number < 1 ||
        number > explainAdminCount
      ) {
        return
      }

      const item =
        getExplainDraftItem(number)

      item.id =
        row.id || null

      item.word =
        row.word || ""
    }
  )

  renderExplainAdminFromDraft()

  return true
}

/* =========================
   6) Render Editor
========================= */

function renderExplainAdminFromDraft() {
  const area = editor()

  if (!area) return

  const total = Number(
    explainAdminCount || 5
  )

  area.innerHTML = `
    <div class="explainAdminShell compactExplainAdminShell adminOnePageEditor">

      <div class="adminEditorTopBar compactAdminEditorTopBar adminEditorTopBarWithActions">

        <div>
          <h2 class="adminSectionTitle">
            اشرح الكلمة
          </h2>
        </div>

        <div class="adminInlineActions">

          <button
            type="button"
            class="adminSaveBtn"
            onclick="saveExplain()"
          >
            حفظ اشرح الكلمة
          </button>

          <button
            type="button"
            class="adminDeleteAllBtn"
            onclick="deleteExplainSegment()"
          >
            حذف الفقرة
          </button>

        </div>

      </div>

      <div class="adminEditCardsGrid explainOnePageGrid">

        ${Array.from(
          {
            length: total
          },

          (_, index) =>
            buildExplainOnePageCard(
              index + 1
            )
        ).join("")}

      </div>

    </div>
  `

  normalizeAdminEditorCards()
}

/* =========================
   7) Word Card
========================= */

function buildExplainOnePageCard(number) {
  const itemNumber =
    Number(number || 1)

  const item =
    getExplainDraftItem(itemNumber)

  const status =
    getExplainItemStatus(itemNumber)

  const hasWord =
    isAdminFieldFilled(
      item.word
    )

  return `
    <details
      class="
        adminEditItemCard
        explainItemOnePageCard
        ${status.className}
      "
      ontoggle="handleAdminEditCardToggle(this)"
    >

      <summary>

        <div class="adminEditItemTitle">

          <strong>
            الكلمة ${itemNumber}
          </strong>

          <span>
            ${
              status.isDone
                ? "الكلمة مكتملة"
                : "ناقص: الكلمة"
            }
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

        <div class="explainOnePageLayout">

          <div
            class="
              adminField
              ${getAdminMissingFieldClass(
                item.word
              )}
            "
          >

            <label for="explainWord_${itemNumber}">
              الكلمة
            </label>

            <input
              id="explainWord_${itemNumber}"
              type="text"
              placeholder="اكتب الكلمة رقم ${itemNumber}"
              value="${escapeHtml(
                item.word || ""
              )}"
            >

            ${
              !hasWord
                ? `
                  <div class="adminMissingHint">
                    الكلمة ناقصة
                  </div>
                `
                : ""
            }

          </div>

          <button
            type="button"
            class="adminDeleteBtn"
            onclick="clearExplainWord(${itemNumber})"
          >
            حذف الكلمة
          </button>

        </div>

      </div>

    </details>
  `
}

/* =========================
   8) Save Explain
========================= */

async function saveExplain() {
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
    collectExplainDraft()

    setAdminSaving(
      true,
      "جارٍ حفظ اشرح الكلمة..."
    )

    setExplainAdminCount(
      explainAdminCount
    )

    const oldRowsResult =
      await dbSelect(
        "explain_words",

        (query) =>
          query.eq(
            "model",
            Number(currentModel)
          ),

        {
          select:
            "number",

          fallback:
            [],

          logLabel:
            "READ OLD EXPLAIN"
        }
      )

    if (!oldRowsResult.ok) {
      console.log(
        "READ OLD EXPLAIN ERROR:",
        oldRowsResult.error
      )

      showGameToast(
        "تعذر قراءة كلمات اشرح الحالية",
        "error"
      )

      return false
    }

    const settingsResult =
      await dbUpsert(
        "segment_settings",

        {
          model:
            Number(currentModel),

          segment:
            "explain",

          item_count:
            explainAdminCount
        },

        {
          onConflict:
            "model,segment",

          logLabel:
            "SAVE EXPLAIN SETTINGS"
        }
      )

    if (!settingsResult.ok) {
      console.log(
        "SAVE EXPLAIN SETTINGS ERROR:",
        settingsResult.error
      )

      showGameToast(
        "تعذر حفظ عدد كلمات اشرح الكلمة",
        "error"
      )

      return false
    }

    const rows = []

    for (
      let number = 1;
      number <= explainAdminCount;
      number++
    ) {
      const item =
        getExplainDraftItem(number)

      const word =
        String(
          item.word || ""
        ).trim()

      if (!word) {
        continue
      }

      rows.push({
        model:
          Number(currentModel),

        number:
          Number(number),

        word,

        updated_at:
          new Date().toISOString()
      })
    }

    if (rows.length) {
      const saveResult =
        await dbUpsert(
          "explain_words",
          rows,
          {
            onConflict:
              "model,number",

            logLabel:
              "SAVE EXPLAIN"
          }
        )

      if (!saveResult.ok) {
        console.log(
          "SAVE EXPLAIN ERROR:",
          saveResult.error
        )

        showGameToast(
          "فشل حفظ كلمات اشرح",
          "error"
        )

        return false
      }
    }

    const keepNumbers =
      new Set(
        rows.map(
          (row) =>
            Number(row.number)
        )
      )

    const oldRowsToDelete =
      (
        oldRowsResult.data || []
      ).filter((oldRow) => {
        const oldNumber =
          Number(oldRow.number)

        return (
          oldNumber >
            explainAdminCount ||
          !keepNumbers.has(
            oldNumber
          )
        )
      })

    if (oldRowsToDelete.length) {
      const deleteResults =
        await Promise.all(
          oldRowsToDelete.map(
            (oldRow) =>
              dbDelete(
                "explain_words",

                (query) =>
                  query
                    .eq(
                      "model",
                      Number(
                        currentModel
                      )
                    )
                    .eq(
                      "number",
                      Number(
                        oldRow.number
                      )
                    ),

                {
                  logLabel:
                    "DELETE OLD EXPLAIN"
                }
              )
          )
        )

      const failedDelete =
        deleteResults.find(
          (result) =>
            !result?.ok
        )

      if (failedDelete) {
        console.log(
          "DELETE OLD EXPLAIN ERROR:",
          failedDelete.error
        )

        invalidateAdminHomeCache()

        showGameToast(
          "تم الحفظ لكن تعذر تنظيف بعض كلمات اشرح القديمة",
          "warning"
        )

        await renderExplainAdmin()

        return false
      }
    }

    if (
      typeof updateAdminQuickSettingUI ===
      "function"
    ) {
      updateAdminQuickSettingUI(
        "explain",
        explainAdminCount
      )
    }

    invalidateAdminHomeCache()

    showGameToast(
      rows.length
        ? "تم حفظ اشرح الكلمة"
        : "تم حذف كلمات اشرح الكلمة",
      "success"
    )

    await renderExplainAdmin()

    return true
  } catch (error) {
    console.log(
      "SAVE EXPLAIN CATCH:",
      error
    )

    showGameToast(
      "توقف حفظ اشرح الكلمة بسبب خطأ",
      "error"
    )

    return false
  } finally {
    setAdminSaving(false)
  }
}

/* =========================
   9) Clear One Word
========================= */

async function clearExplainWord(number) {
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

  const itemNumber =
    Number(number || 0)

  if (
    itemNumber < 1 ||
    itemNumber > explainAdminCount
  ) {
    showGameToast(
      "رقم الكلمة غير صحيح",
      "error"
    )

    return false
  }

  collectExplainDraft()

  const item =
    getExplainDraftItem(
      itemNumber
    )

  const hasSavedRow =
    Number(item.id || 0) > 0

  if (!hasSavedRow) {
    resetExplainDraftItem(
      itemNumber
    )

    renderExplainAdminFromDraft()

    showGameToast(
      `تم تفريغ الكلمة ${itemNumber}`,
      "success"
    )

    return true
  }

  const confirmed =
    await showAdminConfirm(
      `هل تريد حذف الكلمة رقم ${itemNumber} نهائيًا؟`,
      {
        title:
          `حذف الكلمة ${itemNumber}`,

        okText:
          "حذف",

        cancelText:
          "إلغاء",

        danger:
          true
      }
    )

  if (!confirmed) {
    return false
  }

  try {
    const deleteResult =
      await dbDelete(
        "explain_words",

        (query) =>
          query.eq(
            "id",
            Number(item.id)
          ),

        {
          logLabel:
            "DELETE EXPLAIN WORD"
        }
      )

    if (!deleteResult.ok) {
      console.log(
        "DELETE EXPLAIN WORD ERROR:",
        deleteResult.error
      )

      showGameToast(
        "تعذر حذف الكلمة",
        "error"
      )

      return false
    }

    resetExplainDraftItem(
      itemNumber
    )

    invalidateAdminHomeCache()
    renderExplainAdminFromDraft()

    showGameToast(
      `تم حذف الكلمة ${itemNumber}`,
      "success"
    )

    return true
  } catch (error) {
    console.log(
      "DELETE EXPLAIN WORD CATCH:",
      error
    )

    showGameToast(
      "حدث خطأ أثناء حذف الكلمة",
      "error"
    )

    return false
  }
}

/* =========================
   10) Delete Full Segment
========================= */

async function deleteExplainSegment() {
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

  const confirmed =
    await showAdminConfirm(
      "هل تريد حذف فقرة اشرح الكلمة كاملة؟",
      {
        title:
          "حذف فقرة اشرح الكلمة",

        okText:
          "حذف الفقرة",

        cancelText:
          "إلغاء",

        danger:
          true
      }
    )

  if (!confirmed) {
    return false
  }

  try {
    const [
      wordsResult,
      settingsResult
    ] = await Promise.all([
      dbDelete(
        "explain_words",

        (query) =>
          query.eq(
            "model",
            Number(currentModel)
          ),

        {
          logLabel:
            "DELETE EXPLAIN WORDS"
        }
      ),

      dbDelete(
        "segment_settings",

        (query) =>
          query
            .eq(
              "model",
              Number(currentModel)
            )
            .eq(
              "segment",
              "explain"
            ),

        {
          logLabel:
            "DELETE EXPLAIN SETTINGS"
        }
      )
    ])

    const failedResult =
      [
        wordsResult,
        settingsResult
      ].find(
        (result) =>
          !result?.ok
      )

    if (failedResult) {
      console.log(
        "DELETE EXPLAIN SEGMENT ERROR:",
        failedResult.error
      )

      showGameToast(
        "تعذر حذف فقرة اشرح الكلمة",
        "error"
      )

      return false
    }

    setExplainAdminCount(5)
    resetExplainAdminDraft()

    if (
      typeof updateAdminQuickSettingUI ===
      "function"
    ) {
      updateAdminQuickSettingUI(
        "explain",
        explainAdminCount
      )
    }

    invalidateAdminHomeCache()
    renderExplainAdminFromDraft()

    showGameToast(
      "تم حذف فقرة اشرح الكلمة",
      "success"
    )

    return true
  } catch (error) {
    console.log(
      "DELETE EXPLAIN SEGMENT CATCH:",
      error
    )

    showGameToast(
      "حدث خطأ أثناء حذف اشرح الكلمة",
      "error"
    )

    return false
  }
}

/* =========================
   11) Global Exports
========================= */

window.renderExplainAdmin =
  renderExplainAdmin

window.saveExplain =
  saveExplain

window.clearExplainWord =
  clearExplainWord

window.deleteExplainSegment =
  deleteExplainSegment

window.setExplainAdminCount =
  setExplainAdminCount

window.getExplainAdminCount =
  getExplainAdminCount