
/* =========================================================
   ARCHIVE ADMIN
========================================================= */

let archiveAdminRound = 1
let archiveAdminRoundsCount = 4
let archivePendingExtraCount = 0
let archiveDraftState = {}
let archiveDraftStateByRound = {}
let archiveExtraTextPositions = []

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

archiveDraftStateByRound[
  Number(archiveAdminRound || 1)
] = draft
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
archiveDraftStateByRound = {}

  await renderArchiveAdminRound(1)
}

function openArchiveOnePageRound(round) {
  const nextRound = Number(round || 1)

  if (nextRound === Number(archiveAdminRound)) {
    return
  }

  collectArchiveDraftState()

  archiveAdminRound = nextRound
  archivePendingExtraCount = 0

  archiveDraftState =
    archiveDraftStateByRound[nextRound] || {}

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
    scheduleAdminTabsRefresh()
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

delete archiveDraftStateByRound[round]

invalidateAdminHomeCache()

    showGameToast(`تم حفظ الجولة ${round}`)
    await renderArchiveAdminRound(round)
    scheduleAdminTabsRefresh()
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

  const safeRound =
    Number(round || 1)

  const safePosition =
    Number(position || 0)

  const confirmed =
    await showAdminConfirm(
      `هل تريد حذف العنصر ${safePosition} من الجولة ${safeRound}؟\n\nسيتم حذف الصورة المرتبطة به إن وجدت.`,
      {
        title: "حذف عنصر من الأرشيف",
        okText: "حذف",
        cancelText: "إلغاء",
        danger: true
      }
    )

  if (!confirmed) {
    return false
  }

  try {
    const currentModelId =
      Number(currentModel)

    const itemResult =
      await dbSelect(
        "archive_items",
        query =>
          query
            .eq(
              "model",
              currentModelId
            )
            .eq(
              "round",
              safeRound
            )
            .eq(
              "position",
              safePosition
            )
            .maybeSingle(),
        {
          select: "image",
          fallback: null,
          logLabel:
            "LOAD ARCHIVE ITEM BEFORE DELETE"
        }
      )

    if (!itemResult.ok) {
      console.error(
        "LOAD ARCHIVE ITEM BEFORE DELETE ERROR:",
        itemResult.error
      )

      showGameToast(
        "تعذر قراءة صورة العنصر",
        "error"
      )

      return false
    }

    const storageDeleted =
      await deleteAdminStorageUrls([
        itemResult.data?.image
      ])

    if (!storageDeleted) {
      showGameToast(
        "توقف الحذف لأن صورة العنصر لم تُحذف",
        "error"
      )

      return false
    }

    const deleteResult =
      await dbDelete(
        "archive_items",
        query =>
          query
            .eq(
              "model",
              currentModelId
            )
            .eq(
              "round",
              safeRound
            )
            .eq(
              "position",
              safePosition
            ),
        {
          logLabel: "DELETE ARCHIVE ITEM"
        }
      )

    if (!deleteResult.ok) {
      console.error(
        "DELETE ARCHIVE ITEM ERROR:",
        deleteResult.error
      )

      showGameToast(
        "تعذر حذف العنصر",
        "error"
      )

      return false
    }

    invalidateAdminHomeCache()

    showGameToast(
      `تم حذف العنصر ${safePosition}`,
      "success"
    )

    await renderArchiveAdminRound(safeRound)
    scheduleAdminTabsRefresh()

    return true
  } catch (error) {
    console.error(
      "DELETE ARCHIVE ITEM CATCH:",
      error
    )

    showGameToast(
      "حدث خطأ أثناء حذف العنصر",
      "error"
    )

    return false
  }
}

async function deleteArchiveSegment(round = null) {
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

  const hasRound =
    round !== null &&
    round !== undefined

  const safeRound =
    Number(round || archiveAdminRound || 1)

  const confirmed = await showAdminConfirm(
    hasRound
      ? `هل تريد حذف الجولة ${safeRound} من الأرشيف؟`
      : "هل تريد حذف جميع جولات الأرشيف؟",
    {
      title: hasRound
        ? "حذف جولة من الأرشيف"
        : "حذف الأرشيف بالكامل",

      okText: hasRound
        ? "حذف الجولة"
        : "حذف الأرشيف",

      cancelText: "إلغاء",
      danger: true
    }
  )

  if (!confirmed) {
    return false
  }

  try {
    if (hasRound) {
            const currentModelId =
        Number(currentModel)

      const roundImagesResult =
        await dbSelect(
          "archive_items",
          query =>
            query
              .eq(
                "model",
                currentModelId
              )
              .eq(
                "round",
                safeRound
              ),
          {
            select: "image",
            fallback: [],
            logLabel:
              "LOAD ARCHIVE ROUND IMAGES BEFORE DELETE"
          }
        )

      if (!roundImagesResult.ok) {
        console.error(
          "LOAD ARCHIVE ROUND IMAGES BEFORE DELETE ERROR:",
          roundImagesResult.error
        )

        showGameToast(
          "تعذر قراءة صور الجولة",
          "error"
        )

        return false
      }

      const storageDeleted =
        await deleteAdminStorageUrls(
          (roundImagesResult.data || [])
            .map(item => item.image)
        )

      if (!storageDeleted) {
        showGameToast(
          "توقف الحذف لأن صور الجولة لم تُحذف",
          "error"
        )

        return false
      }
      
      const [
        itemsRes,
        boxRes
      ] = await Promise.all([
        dbDelete(
          "archive_items",

          (query) =>
            query
              .eq(
                "model",
                Number(currentModel)
              )
              .eq(
                "round",
                safeRound
              ),

          {
            logLabel:
              "DELETE ARCHIVE ROUND ITEMS"
          }
        ),

        dbDelete(
          "archive_boxes",

          (query) =>
            query
              .eq(
                "model",
                Number(currentModel)
              )
              .eq(
                "round",
                safeRound
              ),

          {
            logLabel:
              "DELETE ARCHIVE ROUND BOXES"
          }
        )
      ])

      if (!itemsRes.ok || !boxRes.ok) {
        console.log(
          itemsRes.error ||
          boxRes.error
        )

        showGameToast(
          "تعذر حذف الجولة",
          "error"
        )

        return false
      }

      archivePendingExtraCount = 0
      archiveDraftState = {}

      delete archiveDraftStateByRound[safeRound]

      invalidateAdminHomeCache()

      showGameToast(
        `تم حذف الجولة ${safeRound}`,
        "success"
      )

      await renderArchiveAdminRound(safeRound)
      scheduleAdminTabsRefresh()

      return true
    }

        const currentModelId =
      Number(currentModel)

    const archiveImagesResult =
      await dbSelect(
        "archive_items",
        query =>
          query.eq(
            "model",
            currentModelId
          ),
        {
          select: "image",
          fallback: [],
          logLabel:
            "LOAD ARCHIVE IMAGES BEFORE DELETE"
        }
      )

    if (!archiveImagesResult.ok) {
      console.error(
        "LOAD ARCHIVE IMAGES BEFORE DELETE ERROR:",
        archiveImagesResult.error
      )

      showGameToast(
        "تعذر قراءة صور الأرشيف",
        "error"
      )

      return false
    }

    const storageDeleted =
      await deleteAdminStorageUrls(
        (archiveImagesResult.data || [])
          .map(item => item.image)
      )

    if (!storageDeleted) {
      showGameToast(
        "توقف الحذف لأن صور الأرشيف لم تُحذف",
        "error"
      )

      return false
    }

    const [
      itemsRes,
      boxesRes,
      settingsRes
    ] = await Promise.all([
      dbDelete(
        "archive_items",

        (query) =>
          query.eq(
            "model",
            Number(currentModel)
          ),

        {
          logLabel:
            "DELETE ARCHIVE ITEMS"
        }
      ),

      dbDelete(
        "archive_boxes",

        (query) =>
          query.eq(
            "model",
            Number(currentModel)
          ),

        {
          logLabel:
            "DELETE ARCHIVE BOXES"
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
              "archive"
            ),

        {
          logLabel:
            "DELETE ARCHIVE SETTINGS"
        }
      )
    ])

    if (
      !itemsRes.ok ||
      !boxesRes.ok ||
      !settingsRes.ok
    ) {
      console.log(
        itemsRes.error ||
        boxesRes.error ||
        settingsRes.error
      )

      showGameToast(
        "تعذر حذف الأرشيف",
        "error"
      )

      return false
    }

    archiveAdminRoundsCount = 4
    archiveAdminRound = 1
    archivePendingExtraCount = 0
    archiveDraftState = {}
    archiveDraftStateByRound = {}

    if (
      typeof updateAdminQuickSettingUI ===
      "function"
    ) {
      updateAdminQuickSettingUI(
        "archive",
        archiveAdminRoundsCount
      )
    }

    invalidateAdminHomeCache()

    showGameToast(
      "تم حذف الأرشيف بالكامل",
      "success"
    )

    await renderArchiveAdmin()
    scheduleAdminTabsRefresh()

    return true
  } catch (error) {
    console.log(
      "DELETE ARCHIVE SEGMENT ERROR:",
      error
    )

    showGameToast(
      "حدث خطأ أثناء حذف الأرشيف",
      "error"
    )

    return false
  }
}

/* =========================
   35) Global Exports
========================= */

Object.assign(window, {
  renderArchiveAdmin,
  renderArchiveAdminRound,
  openArchiveOnePageRound,

  addArchiveTextBox,
  removeArchiveTextBox,
  applyArchiveRoundsCount,

  saveArchiveRoundNew,
  deleteArchiveItem,
  deleteArchiveSegment,

  handleArchiveParentChange,
  getArchiveDoneMap
})