const PRESENTER_NOTES_KEY = "presenter_notes_by_model_final_v1"

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function nl2br(value) {
  return escapeHtml(value || "").replace(/\n/g, "<br>")
}

function getPresenterModel() {
  try {
    const saved = JSON.parse(localStorage.getItem("presenter_admin_model") || "null")
    if (saved?.id) return saved
  } catch (e) {
    console.log(e)
  }
  return null
}

function getPresenterNotesStore() {
  try {
    return JSON.parse(localStorage.getItem(PRESENTER_NOTES_KEY) || "{}")
  } catch {
    return {}
  }
}

function savePresenterNotesStore(store) {
  localStorage.setItem(PRESENTER_NOTES_KEY, JSON.stringify(store))
}

function buildNoteKey(modelId, segmentKey, itemKey) {
  return `${modelId}__${segmentKey}__${itemKey}`
}

function getSavedNoteValue(noteKey, field) {
  const store = getPresenterNotesStore()
  return store?.[noteKey]?.[field] || ""
}

async function loadModelName(modelId) {
  const { data, error } = await db
    .from("models")
    .select("name")
    .eq("id", modelId)
    .maybeSingle()

  if (error) {
    console.log(error)
    return `النموذج ${modelId}`
  }

  return data?.name || `النموذج ${modelId}`
}

/* =========================
   LOAD DATA
========================= */

async function loadWarmupItems(modelId) {
  const { data, error } = await db
    .from("questions")
    .select("*")
    .eq("model", modelId)
    .eq("segment", "warmup")
    .order("category", { ascending: true })
    .order("number", { ascending: true })

  if (error) {
    console.log(error)
    return []
  }

  return data || []
}

async function loadTop10Items(modelId) {
  const { data, error } = await db
    .from("top10_questions")
    .select("*")
    .eq("model", modelId)
    .order("round", { ascending: true })
    .order("position", { ascending: true })

  if (error) {
    console.log(error)
    return []
  }

  return data || []
}

async function loadAuctionItems(modelId) {
  const { data, error } = await db
    .from("auction_questions")
    .select("*")
    .eq("model", modelId)
    .order("number", { ascending: true })

  if (error) {
    console.log(error)
    return []
  }

  return data || []
}

async function loadWhoItems(modelId) {
  const { data, error } = await db
    .from("who_images")
    .select("*")
    .eq("model", modelId)
    .order("number", { ascending: true })

  if (error) {
    console.log(error)
    return []
  }

  return data || []
}

async function loadFinalRound1(modelId) {
  const { data, error } = await db
    .from("final_round1_items")
    .select("*")
    .eq("model", modelId)
    .order("number", { ascending: true })

  if (error) {
    console.log(error)
    return []
  }

  return data || []
}

async function loadFinalRound2(modelId) {
  const { data, error } = await db
    .from("final_round2_items")
    .select("*")
    .eq("model", modelId)
    .order("number", { ascending: true })
    .order("item_order", { ascending: true })

  if (error) {
    console.log(error)
    return []
  }

  return data || []
}

async function loadFinalRound3(modelId) {
  const { data, error } = await db
    .from("final_round3_items")
    .select("*")
    .eq("model", modelId)
    .order("number", { ascending: true })
    .order("image_order", { ascending: true })

  if (error) {
    console.log(error)
    return []
  }

  return data || []
}

async function loadArchiveData(modelId) {
  const [boxesRes, itemsRes] = await Promise.all([
    db.from("archive_boxes").select("*").eq("model", modelId).order("round", { ascending: true }),
    db.from("archive_items").select("*").eq("model", modelId).order("round", { ascending: true }).order("position", { ascending: true })
  ])

  if (boxesRes.error) console.log(boxesRes.error)
  if (itemsRes.error) console.log(itemsRes.error)

  return {
    boxes: boxesRes.data || [],
    items: itemsRes.data || []
  }
}

/* =========================
   COMMON HELPERS
========================= */

function renderSavedInfo(noteKey, options = {}) {
  const {
    hintTitle = "التلميحة",
    noteTitle = "التوضيح",
    showSingleImage = false
  } = options

  const privateHint = getSavedNoteValue(noteKey, "privateHint")
  const extraNote = getSavedNoteValue(noteKey, "extraNote")
  const questionImage = getSavedNoteValue(noteKey, "questionImage")

  const blocks = []

  if (privateHint && privateHint.trim()) {
    blocks.push(`
      <div class="presenterBlock">
        <div class="presenterBlockTitle">${escapeHtml(hintTitle)}</div>
        <div class="presenterBlockText">${nl2br(privateHint)}</div>
      </div>
    `)
  }

  if (extraNote && extraNote.trim()) {
    blocks.push(`
      <div class="presenterBlock">
        <div class="presenterBlockTitle">${escapeHtml(noteTitle)}</div>
        <div class="presenterBlockText">${nl2br(extraNote)}</div>
      </div>
    `)
  }

  if (showSingleImage && questionImage && questionImage.trim()) {
    blocks.push(`
      <div class="presenterBlock">
        <div class="presenterBlockTitle">الصورة الإضافية</div>
        <img class="presenterImage" src="${escapeHtml(questionImage)}" alt="">
      </div>
    `)
  }

  if (!blocks.length) return ""

  return `<div class="presenterSavedInfoGrid">${blocks.join("")}</div>`
}

function renderExtraControls(noteKey, options = {}) {
  const {
    hintTitle = "التلميحة",
    noteTitle = "التوضيح",
    showSingleImage = false
  } = options

  const store = getPresenterNotesStore()
  const saved = store[noteKey] || {}

  return `
    <div class="presenterControlsWrap no-print">
      <div class="presenterControlsGrid">
        <div class="presenterNoteBox">
          <div class="presenterNoteBoxTitle">${escapeHtml(hintTitle)}</div>
          <textarea
            class="presenterTextarea"
            data-note-key="${noteKey}"
            data-field="privateHint"
            placeholder="اكتب التلميحة"
          >${escapeHtml(saved.privateHint || "")}</textarea>
        </div>

        <div class="presenterNoteBox">
          <div class="presenterNoteBoxTitle">${escapeHtml(noteTitle)}</div>
          <textarea
            class="presenterTextarea"
            data-note-key="${noteKey}"
            data-field="extraNote"
            placeholder="اكتب التوضيح"
          >${escapeHtml(saved.extraNote || "")}</textarea>
        </div>
      </div>

      ${showSingleImage ? `
        <div class="presenterUploadRow">
          <div class="presenterUploadBox">
            <div class="presenterUploadTitle">صورة إضافية</div>
            <input
              type="file"
              class="presenterExtraImageInput"
              data-note-key="${noteKey}"
              data-field="questionImage"
              accept="image/*"
            >
            <div class="presenterUploadPreview" id="preview_questionImage_${noteKey}">
              ${saved.questionImage ? `<img src="${escapeHtml(saved.questionImage)}" alt="">` : ""}
            </div>
          </div>
        </div>
      ` : ""}
    </div>
  `
}

function sectionPage(title, subTitle, bodyHtml, extraClass = "") {
  return `
    <section class="presenterSection presenterPrintPage ${extraClass}">
      <div class="presenterSectionHead">
        <div class="presenterSectionTitle">${escapeHtml(title)}</div>
        <div class="presenterSectionCount">${escapeHtml(subTitle || "")}</div>
      </div>

      <div class="presenterSectionBody">
        ${bodyHtml}
      </div>
    </section>
  `
}

/* =========================
   WARMUP
========================= */

function buildWarmupPage(rows, modelId) {
  const grouped = {}

  rows.forEach(row => {
    if (!grouped[row.category]) {
      grouped[row.category] = {
        category: row.category,
        category_name: row.category_name || `الفئة ${row.category}`,
        items: []
      }
    }
    grouped[row.category].items.push(row)
  })

  const categoriesHtml = Object.values(grouped).map(cat => `
    <div class="presenterWarmupCategory">
      <div class="presenterWarmupCategoryTitle">${escapeHtml(cat.category_name)}</div>

      <div class="presenterWarmupQuestionsList">
        ${cat.items.map(q => {
          const noteKey = buildNoteKey(modelId, "warmup", `cat${q.category}_q${q.number}`)

          return `
            <div class="presenterWarmupQuestion">
              <div class="presenterWarmupQHead">
                <span class="presenterWarmupQNo">سؤال ${q.number}</span>
              </div>

              <div class="presenterMiniGrid">
                <div class="presenterBlock">
                  <div class="presenterBlockTitle">السؤال</div>
                  <div class="presenterBlockText">${nl2br(q.question || "—")}</div>
                </div>

                <div class="presenterBlock">
                  <div class="presenterBlockTitle">الجواب</div>
                  <div class="presenterBlockText">${nl2br(q.answer || "—")}</div>
                </div>
              </div>

              ${renderSavedInfo(noteKey, {
                hintTitle: "التلميحة",
                noteTitle: "التوضيح",
                showSingleImage: false
              })}

              ${renderExtraControls(noteKey, {
                hintTitle: "التلميحة",
                noteTitle: "التوضيح",
                showSingleImage: false
              })}
            </div>
          `
        }).join("")}
      </div>
    </div>
  `).join("")

  return sectionPage(
    "التسخين",
    `${rows.length} سؤال`,
    `<div class="presenterWarmupGrid">${categoriesHtml}</div>`,
    "presenterWarmupPage"
  )
}

/* =========================
   TOP10
========================= */

function buildTop10Pages(rows, modelId) {
  const grouped = {}
  rows.forEach(row => {
    if (!grouped[row.round]) grouped[row.round] = []
    grouped[row.round].push(row)
  })

  return [1, 2, 3].map(round => {
    const roundRows = grouped[round] || []
    if (!roundRows.length) return ""

    const question = roundRows[0]?.question || ""
    const noteKey = buildNoteKey(modelId, "top10", `round_${round}`)

    const body = `
      <div class="presenterTop10RoundWrap">
        <div class="presenterBlock">
          <div class="presenterBlockTitle">السؤال</div>
          <div class="presenterBlockText">${nl2br(question || "—")}</div>
        </div>

        <div class="presenterBlock">
          <div class="presenterBlockTitle">الإجابات</div>
          <div class="presenterTop10AnswersList">
            ${roundRows.map(item => `
              <div class="presenterTop10AnswerRow">
                <div class="presenterTop10Rank">${item.position}</div>
                <div class="presenterTop10AnswerText">${escapeHtml(item.answer || "—")}</div>
              </div>
            `).join("")}
          </div>
        </div>

        ${renderSavedInfo(noteKey, {
          hintTitle: "تلميحة السؤال",
          noteTitle: "توضيح السؤال",
          showSingleImage: false
        })}

        ${renderExtraControls(noteKey, {
          hintTitle: "تلميحة السؤال",
          noteTitle: "توضيح السؤال",
          showSingleImage: false
        })}
      </div>
    `

    return sectionPage(`Top 10 - الجولة ${round}`, `${roundRows.length} إجابة`, body, "presenterTop10Page")
  }).join("")
}

/* =========================
   AUCTION
========================= */

function buildAuctionPage(rows, modelId) {
  const cards = rows.map(item => {
    const noteKey = buildNoteKey(modelId, "auction", `auction_${item.number}`)

    return `
      <div class="presenterAuctionCardClean">
        <div class="presenterAuctionHead">السؤال ${item.number}</div>

        <div class="presenterBlock">
          <div class="presenterBlockTitle">الإجابة</div>
          <div class="presenterBlockText">${nl2br(item.answer || "—")}</div>
        </div>

        ${renderSavedInfo(noteKey, {
          hintTitle: "التلميحة",
          noteTitle: "التوضيح",
          showSingleImage: true
        })}

        ${renderExtraControls(noteKey, {
          hintTitle: "التلميحة",
          noteTitle: "التوضيح",
          showSingleImage: true
        })}
      </div>
    `
  }).join("")

  return sectionPage(
    "فتبلة",
    `${rows.length} سؤال`,
    `<div class="presenterAuctionGridClean">${cards}</div>`,
    "presenterAuctionPage"
  )
}

/* =========================
   WHO
========================= */

function buildWhoPage(rows, modelId) {
  const cards = rows.map(item => {
    const noteKey = buildNoteKey(modelId, "who", `who_${item.number}`)

    return `
      <div class="presenterWhoCardClean">
        <div class="presenterWhoNo">رقم ${item.number}</div>

        <div class="presenterBlock">
          <div class="presenterBlockTitle">الإجابة</div>
          <div class="presenterBlockText">${nl2br(item.answer || "—")}</div>
        </div>

        ${renderSavedInfo(noteKey, {
          hintTitle: "التلميحة",
          noteTitle: "التوضيح",
          showSingleImage: true
        })}

        ${renderExtraControls(noteKey, {
          hintTitle: "التلميحة",
          noteTitle: "التوضيح",
          showSingleImage: true
        })}
      </div>
    `
  }).join("")

  return sectionPage(
    "من هو",
    `${rows.length} عنصر`,
    `<div class="presenterWhoGridClean">${cards}</div>`,
    "presenterWhoPage"
  )
}

/* =========================
   FINAL HELPERS
========================= */

function getFinalRound1Question(item) {
  const num = Number(item?.number || 0)

  if (num >= 1 && num <= 3) {
    return item?.card_text || ""
  }

  if (num >= 4 && num <= 6) {
    const parts = [
      item?.question_part1 || "",
      item?.question_part2 || "",
      item?.question_part3 || ""
    ].filter(Boolean)

    return parts.map((part, index) => `${index + 1}) ${part}`).join("\n")
  }

  return ""
}

/* =========================
   FINAL ROUND 1
========================= */

function buildFinalRound1Page(rows, modelId) {
  const cards = rows.map(item => {
    const noteKey = buildNoteKey(modelId, "final", `r1_${item.number}`)
    const qText = getFinalRound1Question(item)
    const num = Number(item.number || 0)

    if (num >= 1 && num <= 3) {
      return `
        <div class="presenterFinalOnlyAnswerCard presenterFinalCleanCard">
          <div class="presenterFinalSmallHead">رقم ${item.number}</div>

          ${item.image ? `
            <div class="presenterFinalTopMedia">
              <img class="presenterImage" src="${escapeHtml(item.image)}" alt="">
            </div>
          ` : ""}

          <div class="presenterBlock presenterFinalMiniBlock">
            <div class="presenterBlockTitle">الجواب</div>
            <div class="presenterBlockText">${nl2br(item.answer || "—")}</div>
          </div>

          ${renderSavedInfo(noteKey, {
            hintTitle: "تلميحة المقدم",
            noteTitle: "توضيح المقدم",
            showSingleImage: false
          })}

          ${renderExtraControls(noteKey, {
            hintTitle: "تلميحة المقدم",
            noteTitle: "توضيح المقدم",
            showSingleImage: false
          })}
        </div>
      `
    }

    return `
      <div class="presenterFinalWideQuestionCard presenterFinalCleanCard">
        <div class="presenterFinalSmallHead">رقم ${item.number}</div>

        ${item.image ? `
          <div class="presenterFinalTopMedia">
            <img class="presenterImage" src="${escapeHtml(item.image)}" alt="">
          </div>
        ` : ""}

        <div class="presenterFinalQuestionAnswerStack">
          <div class="presenterBlock presenterFinalMiniBlock">
            <div class="presenterBlockTitle">السؤال</div>
            <div class="presenterBlockText">${qText ? nl2br(qText) : "—"}</div>
          </div>

          <div class="presenterBlock presenterFinalMiniBlock">
            <div class="presenterBlockTitle">الجواب</div>
            <div class="presenterBlockText">${nl2br(item.answer || "—")}</div>
          </div>

          ${item.note ? `
            <div class="presenterBlock presenterFinalMiniBlock">
              <div class="presenterBlockTitle">التلميحة الأساسية</div>
              <div class="presenterBlockText">${nl2br(item.note)}</div>
            </div>
          ` : ""}
        </div>

        ${renderSavedInfo(noteKey, {
          hintTitle: "تلميحة المقدم",
          noteTitle: "توضيح المقدم",
          showSingleImage: false
        })}

        ${renderExtraControls(noteKey, {
          hintTitle: "تلميحة المقدم",
          noteTitle: "توضيح المقدم",
          showSingleImage: false
        })}
      </div>
    `
  }).join("")

  return sectionPage(
    "الفاصلة - الجولة الأولى",
    `${rows.length} عناصر`,
    `<div class="presenterFinalRound1CustomGrid">${cards}</div>`,
    "presenterFinalR1Page"
  )
}

/* =========================
   FINAL ROUND 2
========================= */

function buildFinalRound2Page(rows, modelId) {
  const grouped = {}
  rows.forEach(row => {
    if (!grouped[row.number]) grouped[row.number] = []
    grouped[row.number].push(row)
  })

  const blocks = [1, 2, 3, 4].map(number => {
    const items = grouped[number] || []
    if (!items.length) return ""

    const isHintsAnswersLayout = number === 1 || number === 3

    if (isHintsAnswersLayout) {
      return `
        <div class="presenterFinalR2WideCard presenterFinalCleanCard">
          <div class="presenterFinalR2Head">رقم ${number}</div>

          <div class="presenterFinalR2HintsAnswersWrap">
            <div class="presenterFinalR2HintsRow">
              ${items.map(row => `
                <div class="presenterBlock presenterFinalMiniBlock">
                  <div class="presenterBlockTitle">التلميحة</div>
                  <div class="presenterBlockText">${nl2br(row.hint || "—")}</div>
                </div>
              `).join("")}
            </div>

            <div class="presenterFinalR2AnswersRow">
              ${items.map(row => `
                <div class="presenterBlock presenterFinalMiniBlock">
                  <div class="presenterBlockTitle">الجواب</div>
                  <div class="presenterBlockText">${nl2br(row.answer || "—")}</div>
                </div>
              `).join("")}
            </div>
          </div>
        </div>
      `
    }

    return `
      <div class="presenterFinalR2Card presenterFinalCleanCard">
        <div class="presenterFinalR2Head">رقم ${number}</div>

        <div class="presenterFinalWordsWrap">
          ${items.map(row => `
            <div class="presenterFinalR2WordChip">${escapeHtml(row.prompt || "—")}</div>
          `).join("")}
        </div>
      </div>
    `
  }).join("")

  return sectionPage(
    "الفاصلة - الجولة الثانية",
    "4 أرقام",
    `<div class="presenterFinalR2CustomLayout">${blocks}</div>`,
    "presenterFinalR2Page"
  )
}

/* =========================
   FINAL ROUND 3
========================= */

function buildFinalRound3Page(rows, modelId) {
  const grouped = {}
  rows.forEach(row => {
    if (!grouped[row.number]) grouped[row.number] = []
    grouped[row.number].push(row)
  })

  const blocks = [1, 2].map(number => {
    const items = grouped[number] || []
    if (!items.length) return ""

    return `
      <div class="presenterFinalR3Block presenterFinalCleanCard">
        <div class="presenterFinalR3Head">رقم ${number}</div>

        <div class="presenterFinalR3GroupedWrap">
          <div class="presenterFinalR3ImagesRow">
            ${items.map(row => `
              <div class="presenterFinalR3TopImage presenterFinalImageBox">
                ${row.image ? `<img class="presenterImage" src="${escapeHtml(row.image)}" alt="">` : ""}
              </div>
            `).join("")}
          </div>

          <div class="presenterFinalR3AnswersRow">
            ${items.map(row => `
              <div class="presenterBlock presenterFinalMiniBlock">
                <div class="presenterBlockTitle">الإجابة</div>
                <div class="presenterBlockText">${nl2br(row.answer || "—")}</div>
              </div>
            `).join("")}
          </div>
        </div>
      </div>
    `
  }).join("")

  return sectionPage(
    "الفاصلة - الجولة الثالثة",
    "عرض صور",
    `<div class="presenterFinalR3SingleColumn">${blocks}</div>`,
    "presenterFinalR3Page"
  )
}

/* =========================
   ARCHIVE
========================= */

function buildArchivePages(boxes, items, modelId) {
  return boxes.map(box => {
    const round = Number(box.round || 1)
    const roundItems = items.filter(x => Number(x.round) === round)

    const image3 = roundItems.find(x => Number(x.position) === 3 && x.item_type === "image")
    const image4 = roundItems.find(x => Number(x.position) === 4 && x.item_type === "image")

    const col3 = roundItems.filter(x =>
      x.item_type === "text" &&
      Number(x.position) >= 5 &&
      Number(x.parent_position || x.column_group || 3) === 3
    )

    const col4 = roundItems.filter(x =>
      x.item_type === "text" &&
      Number(x.position) >= 5 &&
      Number(x.parent_position || x.column_group || 3) === 4
    )

    const noteKey = buildNoteKey(modelId, "archive", `round_${round}`)

    const renderItem = item => {
      const isRequired = String(item.label || "").trim() === "المطلوب"
      return `
        <div class="presenterArchiveMiniCard ${isRequired ? "required" : ""}">
          <div class="presenterArchiveMiniText">
            ${escapeHtml(item.label || "")}${item.label ? " : " : ""}${escapeHtml(item.text || "")}
          </div>
        </div>
      `
    }

    return sectionPage(
      `الأرشيف - الجولة ${round}`,
      `الجولة ${round}`,
      `
        <div class="presenterArchiveA4Wrap archiveThemeRound${round}">
          <div class="presenterArchiveBoardA4">
            <div class="presenterArchiveTopA4">
              <div class="presenterArchiveInfoCard">
                <div class="presenterArchiveInfoLabel">البطولة</div>
                <div class="presenterArchiveInfoValue">${escapeHtml(box.tournament || "—")}</div>
              </div>

              <div class="presenterArchiveInfoCard">
                <div class="presenterArchiveInfoLabel">الموسم</div>
                <div class="presenterArchiveInfoValue">${escapeHtml(box.season || "—")}</div>
              </div>
            </div>

            <div class="presenterArchiveMiddleA4">
              <div class="presenterArchiveImageCard">
                ${image4?.image ? `<img src="${escapeHtml(image4.image)}" alt="">` : ""}
              </div>

              <div class="presenterArchiveScoreCard">
                <div class="presenterArchiveScoreLabel">النتيجة</div>
                <div class="presenterArchiveScoreValue">${escapeHtml(box.score || "-")}</div>
              </div>

              <div class="presenterArchiveImageCard">
                ${image3?.image ? `<img src="${escapeHtml(image3.image)}" alt="">` : ""}
              </div>
            </div>

            <div class="presenterArchiveBottomA4">
              <div class="presenterArchiveCol">${col4.map(renderItem).join("")}</div>
              <div class="presenterArchiveCol">${col3.map(renderItem).join("")}</div>
            </div>
          </div>

          ${renderSavedInfo(noteKey, {
            hintTitle: "تلميحة الجولة",
            noteTitle: "توضيح الجولة",
            showSingleImage: false
          })}

          ${renderExtraControls(noteKey, {
            hintTitle: "تلميحة الجولة",
            noteTitle: "توضيح الجولة",
            showSingleImage: false
          })}
        </div>
      `,
      "presenterArchivePage"
    )
  }).join("")
}

/* =========================
   BINDINGS
========================= */

function bindPresenterTextareas() {
  document.querySelectorAll(".presenterTextarea").forEach(el => {
    el.addEventListener("input", () => {
      const key = el.getAttribute("data-note-key")
      const field = el.getAttribute("data-field")
      const store = getPresenterNotesStore()

      if (!store[key]) store[key] = {}
      store[key][field] = el.value

      savePresenterNotesStore(store)
    })
  })
}

function bindPresenterExtraImages() {
  document.querySelectorAll(".presenterExtraImageInput").forEach(input => {
    input.addEventListener("change", () => {
      const file = input.files?.[0]
      if (!file) return

      const key = input.getAttribute("data-note-key")
      const field = input.getAttribute("data-field")
      const reader = new FileReader()

      reader.onload = function (e) {
        const store = getPresenterNotesStore()
        if (!store[key]) store[key] = {}
        store[key][field] = e.target?.result || ""
        savePresenterNotesStore(store)

        const preview = document.getElementById(`preview_${field}_${key}`)
        if (preview) {
          preview.innerHTML = `<img src="${store[key][field]}" alt="">`
          preview.style.display = "block"
        }

        renderPresenterPage(true)
      }

      reader.readAsDataURL(file)
    })
  })

  document.querySelectorAll(".presenterUploadPreview").forEach(box => {
    if (box.innerHTML.trim()) box.style.display = "block"
  })
}

window.savePresenterNotes = function () {
  const store = getPresenterNotesStore()

  document.querySelectorAll(".presenterTextarea").forEach(el => {
    const key = el.getAttribute("data-note-key")
    const field = el.getAttribute("data-field")

    if (!store[key]) store[key] = {}
    store[key][field] = el.value
  })

  savePresenterNotesStore(store)
  alert("تم حفظ ملاحظات ورقة المقدم")
}

/* =========================
   PRINT
========================= */

function buildPrintAreaFromScreen() {
  const printArea = document.getElementById("printPresenterArea")
  const content = document.getElementById("presenterContent")
  if (!printArea || !content) return

  printArea.innerHTML = content.innerHTML

  printArea.querySelectorAll(".no-print").forEach(el => el.remove())
  printArea.querySelectorAll(".presenterControlsWrap").forEach(el => el.remove())

  printArea.querySelectorAll(".presenterSavedInfoGrid").forEach(grid => {
    if (!grid.innerHTML.trim()) {
      grid.remove()
      return
    }

    const visibleBlocks = Array.from(grid.querySelectorAll(".presenterBlock")).filter(block => {
      const text = (block.innerText || "").trim()
      const hasImg = !!block.querySelector("img")
      return (text !== "" && text !== "—") || hasImg
    })

    if (!visibleBlocks.length) {
      grid.remove()
      return
    }

    Array.from(grid.querySelectorAll(".presenterBlock")).forEach(block => {
      if (!visibleBlocks.includes(block)) {
        block.remove()
      }
    })
  })

  const pages = Array.from(printArea.querySelectorAll(".presenterPrintPage"))

  pages.forEach(page => {
    page.classList.remove("pdf-page-force", "pdf-page-first", "pdf-page-last")
    page.classList.add("pdf-page-force")
  })

  if (pages[0]) {
    pages[0].classList.add("pdf-page-first")
  }

  if (pages[pages.length - 1]) {
    pages[pages.length - 1].classList.add("pdf-page-last")
  }
}

window.printPresenterPdf = function () {
  window.savePresenterNotes()
  buildPrintAreaFromScreen()

  requestAnimationFrame(() => {
    setTimeout(() => {
      window.print()
    }, 350)
  })
}

/* =========================
   MAIN RENDER
========================= */

async function renderPresenterPage(keepScroll = false) {
  const presenterModel = getPresenterModel()
  const content = document.getElementById("presenterContent")
  const titleBox = document.getElementById("presenterPageTitle")

  if (!content) return

  if (!presenterModel?.id) {
    content.innerHTML = `<div class="presenterEmptyState">لم يتم تحديد نموذج لورقة المقدم</div>`
    if (titleBox) titleBox.innerText = "ورقة المقدم"
    return
  }

  const scrollY = window.scrollY
  const modelId = Number(presenterModel.id || 0)
  const modelName = presenterModel.name || await loadModelName(modelId)

  if (titleBox) {
    titleBox.innerText = modelName
      ? `ورقة المقدم - ${modelName}`
      : `ورقة المقدم - نموذج ${modelId}`
  }

  const [
    warmupRows,
    top10Rows,
    auctionRows,
    whoRows,
    finalR1Rows,
    finalR2Rows,
    finalR3Rows,
    archiveData
  ] = await Promise.all([
    loadWarmupItems(modelId),
    loadTop10Items(modelId),
    loadAuctionItems(modelId),
    loadWhoItems(modelId),
    loadFinalRound1(modelId),
    loadFinalRound2(modelId),
    loadFinalRound3(modelId),
    loadArchiveData(modelId)
  ])

  let html = `<div class="presenterPagesWrap">`

  if (warmupRows.length) html += buildWarmupPage(warmupRows, modelId)
  if (top10Rows.length) html += buildTop10Pages(top10Rows, modelId)
  if (auctionRows.length) html += buildAuctionPage(auctionRows, modelId)
  if (whoRows.length) html += buildWhoPage(whoRows, modelId)
  if (finalR1Rows.length) html += buildFinalRound1Page(finalR1Rows, modelId)
  if (finalR2Rows.length) html += buildFinalRound2Page(finalR2Rows, modelId)
  if (finalR3Rows.length) html += buildFinalRound3Page(finalR3Rows, modelId)
  if (archiveData.boxes.length) html += buildArchivePages(archiveData.boxes, archiveData.items, modelId)

  html += `</div>`

  content.innerHTML = html || `<div class="presenterEmptyState">لا توجد بيانات في هذا النموذج</div>`

  bindPresenterTextareas()
  bindPresenterExtraImages()

  if (keepScroll) {
    window.scrollTo({ top: scrollY })
  }
}

document.addEventListener("DOMContentLoaded", () => {
  renderPresenterPage()
})