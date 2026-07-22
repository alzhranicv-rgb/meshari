/* =========================================================
   WHO ADMIN / من هو
========================================================= */

/* =========================
   1) Local State
========================= */

let whoAdminCount = 15
let whoAdminDraft = {}

/* =========================
   2) Count Helpers
========================= */

function setWhoAdminCount(count) {
  whoAdminCount = normalizeAdminSegmentCount(
    "who",
    Number(count || 15)
  )

  return whoAdminCount
}

function getWhoAdminCount() {
  return Number(whoAdminCount || 15)
}

/* =========================
   3) Draft Helpers
========================= */

function getWhoDraftItem(number) {
  const itemNumber = Number(number || 1)

  if (!whoAdminDraft[itemNumber]) {
    whoAdminDraft[itemNumber] = {
      image: "",
      answer: "",
      file: null
    }
  }

  return whoAdminDraft[itemNumber]
}

function resetWhoAdminDraft() {
  whoAdminDraft = {}

  const total = Math.max(
    Number(whoAdminCount || 15),
    15
  )

  for (
    let number = 1;
    number <= total;
    number++
  ) {
    getWhoDraftItem(number)
  }
}

function resetWhoDraftItem(number) {
  const itemNumber = Number(number || 1)

  whoAdminDraft[itemNumber] = {
    image: "",
    answer: "",
    file: null
  }

  return whoAdminDraft[itemNumber]
}

function collectWhoCurrentDraft() {
  const total = Number(
    whoAdminCount || 15
  )

  for (
    let number = 1;
    number <= total;
    number++
  ) {
    const item =
      getWhoDraftItem(number)

    item.answer = (
      document.getElementById(
        `whoAnswer${number}`
      )?.value || ""
    ).trim()

    const selectedFile =
      document.getElementById(
        `who${number}`
      )?.files?.[0] || null

    if (selectedFile) {
      item.file = selectedFile
    }
  }
}

/* =========================
   4) Completion Status
========================= */

function getWhoItemStatus(number) {
  const item =
    getWhoDraftItem(number)

  const hasImage =
    isAdminFieldFilled(item.image) ||
    !!item.file

  const fields = [
    item.answer,
    hasImage ? "image" : ""
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
   5) Load Who
========================= */

async function renderWhoAdmin() {
  if (!currentModel) {
    showGameToast(
      "افتح النموذج أولاً",
      "warning"
    )

    return false
  }

  const savedCount =
    await getAdminSegmentCount("who")

  setWhoAdminCount(savedCount)

  const result = await dbSelect(
    "who_images",

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
      logLabel: "LOAD WHO"
    }
  )

  if (!result.ok) {
    console.log(
      "LOAD WHO ERROR:",
      result.error
    )

    showGameToast(
      "تعذر تحميل من هو",
      "error"
    )

    return false
  }

  resetWhoAdminDraft()

  ;(result.data || []).forEach(
    (row) => {
      const number =
        Number(row.number || 1)

      if (
        number < 1 ||
        number > whoAdminCount
      ) {
        return
      }

      const item =
        getWhoDraftItem(number)

      item.image =
        row.image || ""

      item.answer =
        row.answer || ""

      item.file =
        null
    }
  )

  renderWhoAdminFromDraft()

  return true
}

/* =========================
   6) Render Editor
========================= */

function renderWhoAdminFromDraft() {
  const area = editor()

  if (!area) return

  const total = Number(
    whoAdminCount || 15
  )

  area.innerHTML = `
    <div class="whoAdminShell compactWhoAdminShell adminOnePageEditor">

      <div class="adminEditorTopBar compactAdminEditorTopBar adminEditorTopBarWithActions">

        <div>
          <h2 class="adminSectionTitle">
            من هو
          </h2>
        </div>

        <div class="adminInlineActions">

          <button
            type="button"
            class="adminSaveBtn"
            onclick="saveWho()"
          >
            حفظ من هو
          </button>

          <button
            type="button"
            class="adminDeleteAllBtn"
            onclick="deleteWhoSegment()"
          >
            حذف الفقرة
          </button>

        </div>

      </div>

      <div class="adminEditCardsGrid whoOnePageGrid">

        ${Array.from(
          {
            length: total
          },

          (_, index) =>
            buildWhoOnePageCard(
              index + 1
            )
        ).join("")}

      </div>

    </div>
  `

  normalizeAdminEditorCards()
}

/* =========================
   7) Item Card
========================= */

function buildWhoOnePageCard(number) {
  const itemNumber =
    Number(number || 1)

  const item =
    getWhoDraftItem(itemNumber)

  const status =
    getWhoItemStatus(itemNumber)

  const hasStoredImage =
    isAdminFieldFilled(item.image)

  const hasSelectedFile =
    !!item.file

  const hasImage =
    hasStoredImage ||
    hasSelectedFile

  const missing = []

  if (
    !isAdminFieldFilled(
      item.answer
    )
  ) {
    missing.push("الإجابة")
  }

  if (!hasImage) {
    missing.push("الصورة")
  }

  const imagePreview = hasStoredImage
    ? `
      <img
        src="${escapeHtml(item.image)}"
        class="previewImg"
        alt="معاينة صورة رقم ${itemNumber}"
      >
    `
    : hasSelectedFile
      ? `
        <div class="emptyImageHint">
          تم اختيار صورة جديدة وستظهر بعد الحفظ
        </div>
      `
      : `
        <div class="emptyImageHint">
          لا توجد صورة حالياً
        </div>
      `

  return `
    <details
      class="
        adminEditItemCard
        whoItemOnePageCard
        ${status.className}
      "
      ontoggle="handleAdminEditCardToggle(this)"
    >

      <summary>

        <div class="adminEditItemTitle">

          <strong>
            ${itemNumber}
          </strong>

          <span>
            ${
              status.isDone
                ? "بيانات الصورة مكتملة"
                : `ناقص: ${missing.join("، ")}`
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

        <div class="whoOnePageLayout">

          <div class="whoOnePageMedia">

            <div
              class="
                adminField
                ${hasImage
                  ? ""
                  : "adminMissingField"
                }
              "
            >

              <label for="who${itemNumber}">
                الصورة
              </label>

              <input
                type="file"
                id="who${itemNumber}"
                accept="image/*"
              >

            </div>

            ${
              !hasImage
                ? `
                  <div class="adminMissingHint">
                    الصورة مطلوبة
                  </div>
                `
                : ""
            }

            <div class="whoPreviewBox whoPreviewLarge">
              ${imagePreview}
            </div>

          </div>

          <div class="whoOnePageFields">

            <div
              class="
                adminField
                ${getAdminMissingFieldClass(
                  item.answer
                )}
              "
            >

              <label for="whoAnswer${itemNumber}">
                الإجابة
              </label>

              <input
                id="whoAnswer${itemNumber}"
                type="text"
                placeholder="اكتب اسم الشخصية / اللاعب / الإجابة"
                value="${escapeHtml(
                  item.answer || ""
                )}"
              >

              ${
                !isAdminFieldFilled(
                  item.answer
                )
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
              onclick="clearWhoItem(${itemNumber})"
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
   8) Save Who
========================= */

async function saveWho() {
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
    collectWhoCurrentDraft()

    setAdminSaving(
      true,
      "جارٍ حفظ من هو..."
    )

    setWhoAdminCount(
      whoAdminCount
    )

    const oldRowsResult =
      await dbSelect(
        "who_images",

        (query) =>
          query.eq(
            "model",
            Number(currentModel)
          ),

        {
          select:
            "number,image",

          fallback:
            [],

          logLabel:
            "READ OLD WHO"
        }
      )

    if (!oldRowsResult.ok) {
      console.log(
        "READ OLD WHO ERROR:",
        oldRowsResult.error
      )

      showGameToast(
        "تعذر قراءة بيانات من هو الحالية",
        "error"
      )

      return false
    }

    const oldRows =
      oldRowsResult.data || []

    const oldMap = {}

    oldRows.forEach((row) => {
      oldMap[
        Number(row.number)
      ] = row
    })

    const rows = []

    for (
      let number = 1;
      number <= whoAdminCount;
      number++
    ) {
      const item =
        getWhoDraftItem(number)

      const answer =
        String(
          item.answer || ""
        ).trim()

      const selectedFile =
        item.file ||
        document.getElementById(
          `who${number}`
        )?.files?.[0] ||
        null

      let image =
        String(
          item.image ||
          oldMap[number]?.image ||
          ""
        ).trim()

      if (selectedFile) {
        const uploadedImage =
          await uploadImageFile(
            selectedFile,
            `who_${number}`
          )

        if (!uploadedImage) {
          showGameToast(
            `فشل رفع صورة رقم ${number}`,
            "error"
          )

          return false
        }

        image = uploadedImage

        item.image =
          uploadedImage

        item.file =
          null
      }

      if (
        !image &&
        !answer
      ) {
        continue
      }

      rows.push({
        model:
          Number(currentModel),

        number:
          Number(number),

        image,
        answer
      })
    }

    if (rows.length) {
      const saveResult =
        await dbUpsert(
          "who_images",
          rows,
          {
            onConflict:
              "model,number",

            logLabel:
              "SAVE WHO"
          }
        )

      if (!saveResult.ok) {
        console.log(
          "SAVE WHO ERROR:",
          saveResult.error
        )

        showGameToast(
          "فشل حفظ من هو",
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
      oldRows.filter((oldRow) => {
        const oldNumber =
          Number(oldRow.number)

        return (
          oldNumber >
            whoAdminCount ||
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
                "who_images",

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
                    "DELETE OLD WHO"
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
          "DELETE OLD WHO ERROR:",
          failedDelete.error
        )

        invalidateAdminHomeCache()

        showGameToast(
          "تم الحفظ لكن تعذر تنظيف بعض عناصر من هو القديمة",
          "warning"
        )

        await renderWhoAdmin()

        return false
      }
    }

    invalidateAdminHomeCache()

    showGameToast(
      rows.length
        ? "تم حفظ من هو"
        : "تم حذف جميع عناصر من هو",
      "success"
    )

    await renderWhoAdmin()

    return true
  } catch (error) {
    console.log(
      "SAVE WHO CATCH:",
      error
    )

    showGameToast(
      "توقف حفظ من هو بسبب خطأ",
      "error"
    )

    return false
  } finally {
    setAdminSaving(false)
  }
}

/* =========================
   9) Delete One Item
========================= */

async function clearWhoItem(number) {
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
    itemNumber > whoAdminCount
  ) {
    showGameToast(
      "رقم العنصر غير صحيح",
      "error"
    )

    return false
  }

  collectWhoCurrentDraft()

  const item =
    getWhoDraftItem(itemNumber)

  const hasSavedData =
    isAdminFieldFilled(
      item.image
    )

  if (!hasSavedData) {
    resetWhoDraftItem(
      itemNumber
    )

    renderWhoAdminFromDraft()

    showGameToast(
      `تم تفريغ العنصر ${itemNumber}`,
      "success"
    )

    return true
  }

  const confirmed =
    await showAdminConfirm(
      `هل تريد حذف العنصر رقم ${itemNumber} نهائيًا؟`,
      {
        title:
          `حذف العنصر ${itemNumber}`,

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
        "who_images",

        (query) =>
          query
            .eq(
              "model",
              Number(currentModel)
            )
            .eq(
              "number",
              itemNumber
            ),

        {
          logLabel:
            "CLEAR WHO ITEM"
        }
      )

    if (!deleteResult.ok) {
      console.log(
        "CLEAR WHO ITEM ERROR:",
        deleteResult.error
      )

      showGameToast(
        "تعذر حذف العنصر",
        "error"
      )

      return false
    }

    resetWhoDraftItem(
      itemNumber
    )

    invalidateAdminHomeCache()
    renderWhoAdminFromDraft()

    showGameToast(
      `تم حذف العنصر ${itemNumber}`,
      "success"
    )

    return true
  } catch (error) {
    console.log(
      "CLEAR WHO ITEM CATCH:",
      error
    )

    showGameToast(
      "حدث خطأ أثناء حذف العنصر",
      "error"
    )

    return false
  }
}

/* =========================
   10) Delete Full Segment
========================= */

async function deleteWhoSegment() {
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
      "هل تريد حذف فقرة من هو كاملة نهائيًا؟",
      {
        title:
          "حذف فقرة من هو",

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
      rowsResult,
      settingsResult
    ] = await Promise.all([
      dbDelete(
        "who_images",

        (query) =>
          query.eq(
            "model",
            Number(currentModel)
          ),

        {
          logLabel:
            "DELETE WHO IMAGES"
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
              "who"
            ),

        {
          logLabel:
            "DELETE WHO SETTINGS"
        }
      )
    ])

    const failedResult =
      [
        rowsResult,
        settingsResult
      ].find(
        (result) =>
          !result?.ok
      )

    if (failedResult) {
      console.log(
        "DELETE WHO SEGMENT ERROR:",
        failedResult.error
      )

      showGameToast(
        "تعذر حذف فقرة من هو",
        "error"
      )

      return false
    }

    setWhoAdminCount(15)
    resetWhoAdminDraft()

    if (
      typeof updateAdminQuickSettingUI ===
      "function"
    ) {
      updateAdminQuickSettingUI(
        "who",
        whoAdminCount
      )
    }

    invalidateAdminHomeCache()
    renderWhoAdminFromDraft()

    showGameToast(
      "تم حذف فقرة من هو",
      "success"
    )

    return true
  } catch (error) {
    console.log(
      "DELETE WHO SEGMENT CATCH:",
      error
    )

    showGameToast(
      "حدث خطأ أثناء حذف فقرة من هو",
      "error"
    )

    return false
  }
}

/* =========================
   11) Global Exports
========================= */

window.renderWhoAdmin =
  renderWhoAdmin

window.saveWho =
  saveWho

window.clearWhoItem =
  clearWhoItem

window.deleteWhoSegment =
  deleteWhoSegment

window.setWhoAdminCount =
  setWhoAdminCount

window.getWhoAdminCount =
  getWhoAdminCount