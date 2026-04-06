const BUCKET_NAME = "r3-images"

let currentModel = null
let currentModelName = ""
let auctionAdminCount = 8
let gameToastTimer = null



document.addEventListener("DOMContentLoaded", async () => {
  await loadModels()
})

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

async function uploadImageFile(file, prefix = "file") {
  if (!file) return ""

  const ext = file.name.split(".").pop() || "png"
  const fileName = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

  const { error: uploadError } = await db.storage
    .from(BUCKET_NAME)
    .upload(fileName, file, { upsert: true })

  if (uploadError) {
    console.log("UPLOAD ERROR:", uploadError)
    showGameToast("تعذر رفع الصورة")
    return ""
  }

  const { data } = db.storage.from(BUCKET_NAME).getPublicUrl(fileName)
  return data.publicUrl
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
    archive: 0
  }

  if (!currentModel) return result

  const [q1, q2, q3, q4, q5, q6] = await Promise.all([
    db.from("questions").select("id", { count: "exact", head: true }).eq("model", currentModel).eq("segment", "warmup"),
    db.from("top10_questions").select("id", { count: "exact", head: true }).eq("model", currentModel),
    db.from("auction_questions").select("id", { count: "exact", head: true }).eq("model", currentModel),
    db.from("who_images").select("id", { count: "exact", head: true }).eq("model", currentModel),
    db.from("final_images").select("id", { count: "exact", head: true }).eq("model", currentModel),
    db.from("archive_boxes").select("id", { count: "exact", head: true }).eq("model", currentModel)
  ])

  result.warmup = q1.count || 0
  result.top10 = q2.count || 0
  result.auction = q3.count || 0
  result.who = q4.count || 0
  result.final = q5.count || 0
  result.archive = q6.count || 0

  return result
}

function isSegmentDone(key, count) {
  if (key === "warmup") return count >= 12
  if (key === "top10") return count >= 30
  if (key === "auction") return count >= 8
  if (key === "who") return count >= 15
  if (key === "final") return count >= 6
  if (key === "archive") return count >= 3
  return false
}

async function buildSegmentStatusGrid() {
  const counts = await getAdminCompletionCounts()

  const labels = {
    warmup: "التسخين",
    top10: "Top 10",
    auction: "المزاد",
    who: "من هو",
    final: "الفاصلة",
    archive: "الأرشيف"
  }

  return `
    <div class="segmentStatusGrid enhancedSegmentStatusGrid">
      ${Object.keys(labels).map(key => {
        const done = isSegmentDone(key, counts[key] || 0)

        return `
          <div class="segmentStatusCard ${done ? "doneCard" : ""}">
            <div class="segmentStatusHead">
              <div class="segmentStatusName">${labels[key]}</div>
              <div class="segmentStatusBadge ${done ? "done" : ""}">
                ${done ? "مكتمل" : "غير مكتمل"}
              </div>
            </div>
            <div class="segmentStatusMeta">عدد العناصر: ${counts[key] || 0}</div>
          </div>
        `
      }).join("")}
    </div>
  `
}

async function renderAdminHome() {
  if (!currentModel) {
    editor().innerHTML = `<div class="adminEmptyState">افتح نموذجًا ثم اختر الفقرة التي تريد تعديلها</div>`
    return
  }

  editor().innerHTML = `
    <div class="adminHomeInlineBar">
      <div class="adminHomeInlineModel">
        <span class="adminHomeInlineLabel">النموذج الحالي</span>
        <span class="adminHomeInlineName">${escapeHtml(getCurrentModelNameSafe())}</span>
      </div>

      <div class="adminHomeInlineHint">اختر الفقرة من الأعلى</div>
    </div>

    ${await buildSegmentStatusGrid()}
  `
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

  list.innerHTML = `<option value="">اختر النموذج</option>`

  ;(data || []).forEach(model => {
    const option = document.createElement("option")
    option.value = model.id
    option.textContent = model.name
    list.appendChild(option)
  })
}

async function createModel() {
  const input = document.getElementById("modelName")
  const name = (input?.value || "").trim()

  if (!name) {
    showGameToast("اكتب اسم النموذج")
    return
  }

  const { error } = await db.from("models").insert({ name })

  if (error) {
    console.log("CREATE MODEL ERROR:", error)
    showGameToast("تعذر إنشاء النموذج")
    return
  }

  input.value = ""
  await loadModels()
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

  const newName = prompt("اكتب الاسم الجديد للنموذج", currentName)

  if (newName === null) return

  const name = newName.trim()
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

  currentModelName = name
  await loadModels()

  const modelsList = document.getElementById("modelsList")
  if (modelsList) modelsList.value = String(id)

  await renderAdminHome()
  showGameToast("تم تعديل اسم النموذج")
}
function openSelectedModel() {
  const list = document.getElementById("modelsList")
  const id = Number(list?.value || 0)

  if (!id) {
    showGameToast("اختر النموذج")
    return
  }

  currentModel = id
  currentModelName = list.options[list.selectedIndex]?.textContent || `نموذج ${id}`

  tabs()?.classList.remove("hidden")
  renderAdminHome()
  showGameToast(`تم فتح ${currentModelName}`)
}

async function deleteSelectedModel() {
  const list = document.getElementById("modelsList")
  const id = Number(list?.value || 0)

  if (!id) {
    showGameToast("اختر النموذج")
    return
  }

  const ok = confirm("هل تريد حذف النموذج؟")
  if (!ok) return

  const { error } = await db.from("models").delete().eq("id", id)

  if (error) {
    console.log("DELETE MODEL ERROR:", error)
    showGameToast("تعذر حذف النموذج")
    return
  }

  if (currentModel === id) {
    currentModel = null
    currentModelName = ""
    tabs()?.classList.add("hidden")
    editor().innerHTML = `<div class="adminEmptyState">افتح نموذجًا ثم اختر الفقرة التي تريد تعديلها</div>`
  }

  await loadModels()
  showGameToast("تم حذف النموذج")
}

/* =========================
   Tabs
========================= */

function openAdminSegment(segment) {
  if (!currentModel) {
    showGameToast("افتح نموذج أولاً")
    return
  }

  if (segment === "warmup") renderWarmupAdmin()
  if (segment === "top10") renderTop10Admin()
  if (segment === "auction") renderAuctionAdmin()
  if (segment === "who") renderWhoAdmin()
  if (segment === "final") renderFinalAdmin()
  if (segment === "archive") renderArchiveAdmin()
}

/* =========================
   Delete Segment بالكامل
========================= */

async function deleteWarmupSegment() {
  if (!currentModel) return
  const ok = confirm("هل تريد حذف جميع أسئلة فقرة التسخين من قاعدة البيانات؟")
  if (!ok) return

  const { error } = await db
    .from("questions")
    .delete()
    .eq("model", Number(currentModel))
    .eq("segment", "warmup")

  if (error) {
    console.log(error)
    showGameToast("فشل حذف فقرة التسخين")
    return
  }

  showGameToast("تم حذف فقرة التسخين")
  await renderWarmupAdmin()
}

async function deleteTop10Segment() {
  if (!currentModel) return
  const ok = confirm("هل تريد حذف جميع جولات Top 10 من قاعدة البيانات؟")
  if (!ok) return

  const { error } = await db
    .from("top10_questions")
    .delete()
    .eq("model", currentModel)

  if (error) {
    console.log(error)
    showGameToast("فشل حذف Top 10")
    return
  }

  showGameToast("تم حذف Top 10")
  await renderTop10Admin()
}

async function deleteAuctionSegment() {
  if (!currentModel) return
  const ok = confirm("هل تريد حذف جميع أسئلة المزاد من قاعدة البيانات؟")
  if (!ok) return

  const { error } = await db
    .from("auction_questions")
    .delete()
    .eq("model", currentModel)

  if (error) {
    console.log(error)
    showGameToast("فشل حذف المزاد")
    return
  }

  showGameToast("تم حذف المزاد")
  await renderAuctionAdmin()
}

async function deleteWhoSegment() {
  if (!currentModel) return
  const ok = confirm("هل تريد حذف جميع عناصر من هو من قاعدة البيانات؟")
  if (!ok) return

  const { error } = await db
    .from("who_images")
    .delete()
    .eq("model", currentModel)

  if (error) {
    console.log(error)
    showGameToast("فشل حذف فقرة من هو")
    return
  }

  showGameToast("تم حذف فقرة من هو")
  await renderWhoAdmin()
}

async function deleteFinalSegment() {
  if (!currentModel) return
  const ok = confirm("هل تريد حذف جميع عناصر الفاصلة من قاعدة البيانات؟")
  if (!ok) return

  const { error } = await db
    .from("final_images")
    .delete()
    .eq("model", currentModel)

  if (error) {
    console.log(error)
    showGameToast("فشل حذف فقرة الفاصلة")
    return
  }

  showGameToast("تم حذف فقرة الفاصلة")
  await renderFinalAdmin()
}

async function deleteArchiveSegment(round = null) {
  if (!currentModel) return

  const message = round
    ? `هل تريد حذف الأرشيف للجولة ${round} من قاعدة البيانات؟`
    : "هل تريد حذف جميع جولات الأرشيف من قاعدة البيانات؟"

  const ok = confirm(message)
  if (!ok) return

  if (round) {
    const { error: boxErr } = await db
      .from("archive_boxes")
      .delete()
      .eq("model", currentModel)
      .eq("round", round)

    if (boxErr) {
      console.log(boxErr)
      showGameToast("فشل حذف صندوق الأرشيف")
      return
    }

    const { error: itemsErr } = await db
      .from("archive_items")
      .delete()
      .eq("model", currentModel)
      .eq("round", round)

    if (itemsErr) {
      console.log(itemsErr)
      showGameToast("فشل حذف عناصر الأرشيف")
      return
    }

    showGameToast(`تم حذف الأرشيف للجولة ${round}`)
    await renderArchiveAdminRound(round)
    return
  }

  const { error: boxErr } = await db
    .from("archive_boxes")
    .delete()
    .eq("model", currentModel)

  if (boxErr) {
    console.log(boxErr)
    showGameToast("فشل حذف صناديق الأرشيف")
    return
  }

  const { error: itemsErr } = await db
    .from("archive_items")
    .delete()
    .eq("model", currentModel)

  if (itemsErr) {
    console.log(itemsErr)
    showGameToast("فشل حذف عناصر الأرشيف")
    return
  }

  showGameToast("تم حذف جميع جولات الأرشيف")
  await renderArchiveAdmin()
}

/* =========================
   Delete / Clear Helpers
========================= */

function clearWarmupQuestion(c, n) {
  const ok = confirm("هل تريد حذف هذا السؤال من الواجهة؟ ثم احفظ ليتم حذفه نهائيًا.")
  if (!ok) return

  const q = document.getElementById(`q${c}_${n}`)
  const a = document.getElementById(`a${c}_${n}`)

  if (q) q.value = ""
  if (a) a.value = ""

  showGameToast("تم مسح السؤال من النموذج، اضغط حفظ")
}

function clearTop10Round(r) {
  const ok = confirm("هل تريد مسح الجولة كاملة؟ ثم احفظ")
  if (!ok) return

  const q = document.getElementById(`topq${r}`)
  if (q) q.value = ""

  for (let i = 1; i <= 10; i++) {
    const ans = document.getElementById(`top${r}_${i}`)
    if (ans) ans.value = ""
  }

  showGameToast("تم مسح الجولة، اضغط حفظ")
}

function clearAuctionQuestion(i) {
  const ok = confirm("هل تريد حذف هذا السؤال؟ ثم احفظ")
  if (!ok) return

  const q = document.getElementById(`auction${i}`)
  const a = document.getElementById(`auctionAnswer${i}`)
  const inc = document.getElementById(`auctionIncrement${i}`)

  if (q) q.value = ""
  if (a) a.value = ""
  if (inc) inc.value = 1

  showGameToast("تم مسح السؤال، اضغط حفظ")
}

function clearWhoItem(i) {
  const ok = confirm("هل تريد حذف هذا العنصر؟ ثم احفظ")
  if (!ok) return

  const a = document.getElementById(`whoAnswer${i}`)
  const f = document.getElementById(`who${i}`)

  if (a) a.value = ""
  if (f) f.value = ""

  showGameToast("تم مسح العنصر، اضغط حفظ")
}

function clearFinalItem(i) {
  const ok = confirm("هل تريد حذف هذا العنصر؟ ثم احفظ")
  if (!ok) return

  const a = document.getElementById(`finalAnswer${i}`)
  const f = document.getElementById(`final${i}`)

  if (a) a.value = ""
  if (f) f.value = ""

  showGameToast("تم مسح العنصر، اضغط حفظ")
}
/* =========================
  printer
========================= */
function getArchiveDisplayThemeClass(round) {
  if (Number(round) === 1) return "archiveThemeRound1"
  if (Number(round) === 2) return "archiveThemeRound2"
  if (Number(round) === 3) return "archiveThemeRound3"
  return "archiveThemeRound4"
}
function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

window.openPresenterSheet = async function () {
  try {
    if (!currentModel) {
      showGameToast("افتح نموذجًا أولاً")
      return
    }

    const [
      warmupRes,
      top10Res,
      auctionRes,
      whoRes,
      archiveBoxesRes,
      archiveItemsRes,
      finalMetaRes,
      finalRound1Res,
      finalRound2Res,
      finalRound3Res
    ] = await Promise.all([
      db.from("questions")
        .select("*")
        .eq("model", Number(currentModel))
        .eq("segment", "warmup")
        .order("category", { ascending: true })
        .order("number", { ascending: true }),

      db.from("top10_questions")
        .select("*")
        .eq("model", currentModel)
        .order("round", { ascending: true })
        .order("position", { ascending: true }),

      db.from("auction_questions")
        .select("*")
        .eq("model", currentModel)
        .order("number", { ascending: true }),

      db.from("who_images")
        .select("*")
        .eq("model", currentModel)
        .order("number", { ascending: true }),

      db.from("archive_boxes")
        .select("*")
        .eq("model", currentModel)
        .order("round", { ascending: true }),

      db.from("archive_items")
        .select("*")
        .eq("model", currentModel)
        .order("round", { ascending: true })
        .order("position", { ascending: true }),

      db.from("final_round_meta")
        .select("*")
        .eq("model", currentModel)
        .order("round", { ascending: true }),

      db.from("final_round1_items")
        .select("*")
        .eq("model", currentModel)
        .order("number", { ascending: true }),

      db.from("final_round2_items")
        .select("*")
        .eq("model", currentModel)
        .order("number", { ascending: true })
        .order("item_order", { ascending: true }),

      db.from("final_round3_items")
        .select("*")
        .eq("model", currentModel)
        .order("number", { ascending: true })
        .order("image_order", { ascending: true })
    ])

    const warmupRows = warmupRes.data || []
    const top10Rows = top10Res.data || []
    const auctionRows = auctionRes.data || []
    const whoRows = whoRes.data || []
    const archiveBoxes = archiveBoxesRes.data || []
    const archiveItems = archiveItemsRes.data || []
    const finalMeta = finalMetaRes.data || []
    const finalRound1Rows = finalRound1Res.data || []
    const finalRound2Rows = finalRound2Res.data || []
    const finalRound3Rows = finalRound3Res.data || []

    const text = value => escapeHtml(value || "")

    const isImageLike = value =>
      typeof value === "string" &&
      /^(https?:\/\/|data:image\/|blob:|\/)/.test(String(value).trim())

    /* warmup */
    const groupedWarmup = {}
    warmupRows.forEach(row => {
      if (!groupedWarmup[row.category]) {
        groupedWarmup[row.category] = {
          title: row.category_name || `فئة ${row.category}`,
          items: [],
          seen: new Set()
        }
      }

      const key = `${row.number}__${(row.question || "").trim()}__${(row.answer || "").trim()}`
      if (!groupedWarmup[row.category].seen.has(key)) {
        groupedWarmup[row.category].seen.add(key)
        groupedWarmup[row.category].items.push(row)
      }
    })

    const warmupHtml = `
      <div class="presenterSectionCard">
        <div class="presenterSectionHead">التسخين</div>
        <div class="presenterSectionBody">
          <div class="presenterWarmupGrid">
            ${Object.values(groupedWarmup).map(group => `
              <div class="presenterSubCard presenterWarmupCard">
                <div class="presenterSubHead">${text(group.title)}</div>
                <div class="presenterListCompact">
                  ${group.items.map(row => `
                    <div class="presenterRowCompact">
                      <div class="presenterNumBox">${row.number}</div>
                      <div class="presenterTextBox">
                        <div class="presenterQuestionLine">${text(row.question)}</div>
                        <div class="presenterAnswerLine">الإجابة: ${text(row.answer)}</div>
                      </div>
                    </div>
                  `).join("")}
                </div>
              </div>
            `).join("") || `<div class="presenterEmptyBox">لا توجد بيانات</div>`}
          </div>
        </div>
      </div>
    `

    /* top10 */
    const groupedTop10 = {}
    top10Rows.forEach(row => {
      if (!groupedTop10[row.round]) {
        groupedTop10[row.round] = {
          question: "",
          items: []
        }
      }
      if (row.question) groupedTop10[row.round].question = row.question
      groupedTop10[row.round].items.push(row)
    })

    const top10Html = Object.entries(groupedTop10).map(([round, group]) => `
      <div class="presenterSectionCard">
        <div class="presenterSectionHead">Top 10 - الجولة ${round}</div>
        <div class="presenterSectionBody">
          <div class="presenterQuestionMain">${text(group.question)}</div>
          <div class="presenterTop10Grid">
            ${group.items
              .sort((a, b) => Number(a.position) - Number(b.position))
              .map(item => `
                <div class="presenterRowCompact presenterTop10Row">
                  <div class="presenterNumBox presenterNumBoxLarge">${item.position}</div>
                  <div class="presenterTextBox presenterTextBig">${text(item.answer)}</div>
                </div>
              `).join("")}
          </div>
        </div>
      </div>
    `).join("")

    /* auction */
    const auctionHtml = `
      <div class="presenterSectionCard">
        <div class="presenterSectionHead">المزاد</div>
        <div class="presenterSectionBody">
          <div class="presenterListCompact">
            ${auctionRows.map(row => `
              <div class="presenterRowCompact">
                <div class="presenterNumBox">${row.number}</div>
                <div class="presenterTextBox">
                  <div class="presenterQuestionLine">${text(row.question)}</div>
                  <div class="presenterMetaLine">
                    <span><strong>الإجابة:</strong> ${text(row.answer)}</span>
                    <span><strong>الزيادة:</strong> ${text(row.increment || row.value || row.points || "")}</span>
                  </div>
                </div>
              </div>
            `).join("") || `<div class="presenterEmptyBox">لا توجد بيانات</div>`}
          </div>
        </div>
      </div>
    `

    /* who */
    const whoHtml = `
      <div class="presenterSectionCard">
        <div class="presenterSectionHead">من هو</div>
        <div class="presenterSectionBody">
          <div class="presenterWhoGrid">
            ${whoRows.map(row => `
              <div class="presenterWhoCard">
                <div class="presenterWhoNum">${row.number}</div>
                <div class="presenterWhoAnswer">${text(row.answer)}</div>
              </div>
            `).join("") || `<div class="presenterEmptyBox">لا توجد بيانات</div>`}
          </div>
        </div>
      </div>
    `

    /* archive */
    const groupedArchive = {}
    archiveItems.forEach(item => {
      const round = Number(item.round || 1)
      if (!groupedArchive[round]) groupedArchive[round] = []
      groupedArchive[round].push(item)
    })

const archiveHtml = [1, 2, 3, 4].map(round => {
  const box = archiveBoxes.find(x => Number(x.round) === round)
  const items = (groupedArchive[round] || []).sort((a, b) => Number(a.position) - Number(b.position))

  const itemByPos = {}
  items.forEach(item => {
    itemByPos[Number(item.position)] = item
  })

  const under3Items = items.filter(
    item => Number(item.parent_position || item.column_group || 3) === 3 && Number(item.position) >= 5
  )
  const under4Items = items.filter(
    item => Number(item.parent_position || item.column_group || 3) === 4 && Number(item.position) >= 5
  )

  function renderPrimaryValue(position, fallbackText = "") {
    const item = itemByPos[position]
    if (!item) {
      return `<span>${text(fallbackText)}</span>`
    }

    const raw = item.image || item.text || ""
    if (isImageLike(raw)) {
      return `<img src="${text(raw)}" alt="">`
    }

    return `<span>${text(item.text || fallbackText)}</span>`
  }

  function renderBigValue(position) {
    const item = itemByPos[position]
    if (!item) {
      return `<span>${position}</span>`
    }

    const raw = item.image || item.text || ""
    if (isImageLike(raw)) {
      return `<img src="${text(raw)}" alt="">`
    }

    return `<span>${text(item.text || position)}</span>`
  }

  function renderBottomItem(item) {
    const labelText = (item.label || "").trim()
    const promptStyle = String(item.prompt_style || "shoe").trim().toLowerCase()
    const emoji = promptStyle === "ball" ? "⚽️" : "👟"
    const styleClass = promptStyle === "ball" ? "archivePromptBall" : "archivePromptShoe"
    const isWanted = labelText === "المطلوب"
    const displayText = (item.text || "").trim()

    return `
      <div class="archiveModernSmallCard ${styleClass} ${isWanted ? "archiveWantedItem" : ""}">
        <div class="archiveModernSmallMain">
          <div class="archiveModernSmallText">${text(displayText || labelText || "")}</div>
        </div>
        <div class="archiveModernSmallEmoji">${emoji}</div>
      </div>
    `
  }

  return `
    <div class="presenterSectionCard">
      <div class="presenterSectionHead">الأرشيف - الجولة ${round}</div>
      <div class="presenterSectionBody">
        <div class="archiveBoard archiveModernBoard ${getArchiveDisplayThemeClass(round)} presenterArchiveLiveClone">

          <div class="archiveModernTop">
            <div class="archiveModernInfoCard">
              <div class="archiveModernInfoLabel">البطولة</div>
              <div class="archiveModernInfoValue">
                ${renderPrimaryValue(1, box?.tournament || "")}
              </div>
            </div>

            <div class="archiveModernInfoCard">
              <div class="archiveModernInfoLabel">الموسم</div>
              <div class="archiveModernInfoValue">
                ${renderPrimaryValue(2, box?.season || "")}
              </div>
            </div>
          </div>

          <div class="archiveModernMiddle">
            <div class="archiveModernBigCard revealed">
              ${renderBigValue(4)}
            </div>

            <div class="archiveModernScoreCard">
              <div class="archiveModernScoreLabel">النتيجة</div>
              <div class="archiveModernScoreValue">${text(box?.score || "-")}</div>
            </div>

            <div class="archiveModernBigCard revealed">
              ${renderBigValue(3)}
            </div>
          </div>

          <div class="archiveBottomGrid">
            <div class="archiveBottomCol">
              ${under4Items.map(renderBottomItem).join("")}
            </div>

            <div class="archiveBottomCol">
              ${under3Items.map(renderBottomItem).join("")}
            </div>
          </div>

        </div>
      </div>
    </div>
  `
}).join("")

    /* final */
    const groupedFinal2 = {}
    finalRound2Rows.forEach(item => {
      if (!groupedFinal2[item.number]) groupedFinal2[item.number] = []
      groupedFinal2[item.number].push(item)
    })

    const groupedFinal3 = {}
    finalRound3Rows.forEach(item => {
      if (!groupedFinal3[item.number]) groupedFinal3[item.number] = []
      groupedFinal3[item.number].push(item)
    })

    const finalMetaMap = {}
    finalMeta.forEach(row => {
      finalMetaMap[row.round] = row
    })

    const finalHtml = `
      <div class="presenterSectionCard">
        <div class="presenterSectionHead">الفاصلة</div>
        <div class="presenterSectionBody presenterFinalAll">

          <div class="presenterFinalBlock">
            <div class="presenterFinalTitle">${text(finalMetaMap[1]?.title || "الجولة الأولى")}</div>
            <div class="presenterFinalHorizontal">
              ${finalRound1Rows.map(item => `
                <div class="presenterFinalImageCard">
                  <div class="presenterFinalImageHead">رقم ${item.number}</div>
                  <div class="presenterFinalImageBody">
                    ${
                      item.image
                        ? `<img src="${text(item.image)}" alt="">`
                        : `<div class="presenterFinalNoImage">لا توجد صورة</div>`
                    }
                    <div class="presenterAnswerLine">الإجابة: ${text(item.answer)}</div>
                    ${item.note ? `<div class="presenterHintLine">التوضيح: ${text(item.note)}</div>` : ""}
                  </div>
                </div>
              `).join("") || `<div class="presenterEmptyBox">لا توجد بيانات</div>`}
            </div>
          </div>

          <div class="presenterFinalBlock">
            <div class="presenterFinalTitle">${text(finalMetaMap[2]?.title || "الجولة الثانية")}</div>
            <div class="presenterFinalHorizontal">
              ${[1, 2, 3, 4].map(number => {
                const rows = groupedFinal2[number] || []
                const isScramble = number === 1 || number === 3

                return `
                  <div class="presenterMiniSection finalHorizontalCard">
                    <div class="presenterMiniSectionHead">رقم ${number}</div>
                    <div class="presenterMiniSectionBody">
                      ${rows.map((row, idx) => `
                        <div class="presenterMiniLine">
                          <strong>${idx + 1})</strong>
                          <span>الكلمة: ${text(row.prompt)}</span>
                          ${isScramble ? `<span>التلميحة: ${text(row.hint)}</span>` : ""}
                          ${isScramble ? `<span>الإجابة: ${text(row.answer)}</span>` : ""}
                        </div>
                      `).join("")}
                    </div>
                  </div>
                `
              }).join("")}
            </div>
          </div>

          <div class="presenterFinalBlock">
            <div class="presenterFinalTitle">${text(finalMetaMap[3]?.title || "الجولة الثالثة")}</div>
            <div class="presenterFinalHorizontal">
              ${[1, 2].map(number => {
                const rows = groupedFinal3[number] || []

                return `
                  <div class="presenterFinalImageCard largeFinalCard">
                    <div class="presenterFinalImageHead">رقم ${number}</div>
                    <div class="presenterFinalImageBody">
                      <div class="presenterFinalRound3List">
                        ${rows.map(row => `
                          <div class="presenterFinalRound3Item">
                            ${
                              row.image
                                ? `<img src="${text(row.image)}" alt="">`
                                : `<div class="presenterFinalNoImage">لا توجد صورة</div>`
                            }
                            <div class="presenterAnswerLine">الإجابة: ${text(row.answer)}</div>
                            ${row.note ? `<div class="presenterHintLine">التوضيح: ${text(row.note)}</div>` : ""}
                          </div>
                        `).join("")}
                      </div>
                    </div>
                  </div>
                `
              }).join("")}
            </div>
          </div>

        </div>
      </div>
    `

    const html = `
      <div class="presenterOverlay" id="presenterOverlay">
        <div class="presenterPanel">
          <div class="presenterTopBar">
            <div class="presenterTopTitle">ورقة المقدم - ${text(currentModel)}</div>
            <div class="presenterReaderActions">
              <button class="adminBtn" onclick="copyPresenterReaderLink()">نسخ رابط ورقة المقدم</button>
              <button class="adminBtn" onclick="savePresenterSheetHtml()">حفظ الصفحة</button>
              <button class="adminDeleteBtn" onclick="closePresenterSheet()">إغلاق</button>
            </div>
          </div>

          <div class="presenterContent">
            ${warmupHtml}
            ${top10Html}
            ${auctionHtml}
            ${whoHtml}
            ${archiveHtml}
            ${finalHtml}
          </div>
        </div>
      </div>
    `

    const old = document.getElementById("presenterOverlay")
    if (old) old.remove()

    document.body.insertAdjacentHTML("beforeend", html)
  } catch (error) {
    console.error(error)
    showGameToast("تعذر فتح ورقة المقدم")
  }
}

window.closePresenterSheet = function () {
  const overlay = document.getElementById("presenterOverlay")
  if (overlay) overlay.remove()
}

window.printPresenterSheet = function () {
  openPresenterSheet()
}

window.savePresenterSheetHtml = function () {
  try {
    const overlay = document.getElementById("presenterOverlay")
    if (!overlay) {
      showGameToast("افتح ورقة المقدم أولاً")
      return
    }

    const panel = overlay.querySelector(".presenterPanel")
    if (!panel) {
      showGameToast("تعذر العثور على الصفحة المعروضة")
      return
    }

    const clone = panel.cloneNode(true)

    const actions = clone.querySelector(".presenterReaderActions")
    if (actions) {
      actions.innerHTML = `
       <div class="presenterReaderActions">
  <button class="adminBtn" onclick="printPresenterAsPdf()">حفظ PDF</button>
  <button class="adminBtn" onclick="copyPresenterReaderLink()">نسخ رابط ورقة المقدم</button>
  <button class="adminBtn" onclick="savePresenterSheetHtml()">حفظ الصفحة</button>
  <button class="adminDeleteBtn" onclick="closePresenterSheet()">إغلاق</button>
</div>
      `
    }

    let cssText = ""
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules || [])) {
          cssText += rule.cssText + "\n"
        }
      } catch (err) {}
    }

    const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ورقة المقدم - ${escapeHtml(currentModel)}</title>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      direction: rtl;
      background: #f8fafc;
      color: #111827;
      font-family: Tahoma, Arial, sans-serif;
    }

    body {
      padding: 16px;
      box-sizing: border-box;
    }

    .presenterOverlay {
      position: static !important;
      inset: auto !important;
      background: transparent !important;
      padding: 0 !important;
      display: block !important;
    }

    .presenterPanel {
      width: 100% !important;
      height: auto !important;
      max-height: none !important;
      margin: 0 auto !important;
      box-shadow: none !important;
      border-radius: 18px !important;
      overflow: visible !important;
      background: #fff !important;
    }

    .presenterContent {
      overflow: visible !important;
      max-height: none !important;
    }

    ${cssText}
  </style>
</head>
<body>
  <div class="presenterOverlay">
    ${clone.outerHTML}
  </div>
</body>
</html>
    `

    const newWindow = window.open("", "_blank")
    if (!newWindow) {
      showGameToast("اسمح بالنوافذ المنبثقة أولاً")
      return
    }

    newWindow.document.open()
    newWindow.document.write(html)
    newWindow.document.close()

    showGameToast("تم فتح النسخة المحفوظة في تبويب جديد")
  } catch (error) {
    console.error(error)
    showGameToast("تعذر حفظ الصفحة")
  }
}

window.copyPresenterReaderLink = async function () {
  try {
    if (!currentModel) {
      showGameToast("افتح نموذجًا أولاً")
      return
    }

    const url = `${window.location.origin}${window.location.pathname}?presenter=1&model=${encodeURIComponent(currentModel)}`

    try {
      await navigator.clipboard.writeText(url)
      showGameToast("تم نسخ رابط ورقة المقدم")
    } catch (err) {
      prompt("انسخ الرابط:", url)
    }
  } catch (error) {
    console.error(error)
    showGameToast("تعذر إنشاء الرابط")
  }
}

window.addEventListener("load", () => {
  try {
    const params = new URLSearchParams(window.location.search)
    const presenterMode = params.get("presenter")
    const modelFromUrl = params.get("model")

    if (!presenterMode) return

    if (modelFromUrl) {
      currentModel = modelFromUrl

      const modelInput = document.querySelector(".adminModelInput")
      if (modelInput) modelInput.value = modelFromUrl
    }

    setTimeout(() => {
      if (typeof openPresenterSheet === "function") {
        openPresenterSheet()
      }
    }, 500)
  } catch (error) {
    console.error(error)
  }
})
/* =========================
   Warmup
========================= */

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

  const map = {}
  ;(data || []).forEach(row => {
    if (!map[row.category]) {
      map[row.category] = { category_name: "", questions: {} }
    }

    if (row.category_name && String(row.category_name).trim() !== "") {
      map[row.category].category_name = row.category_name
    }

    map[row.category].questions[row.number] = row
  })

  let html = `
    <h2 class="adminSectionTitle">التسخين</h2>
    ${await buildSegmentStatusGrid()}
    <div class="adminGrid2">
  `

  for (let c = 1; c <= 4; c++) {
    const cat = map[c] || { category_name: "", questions: {} }

    html += `
      <div class="adminCard">
        <h3>الفئة ${c}</h3>

        <input id="cat${c}" placeholder="اسم الفئة" value="${escapeHtml(cat.category_name || "")}">

        <div class="adminQuestionCard">
          <div class="adminQuestionCardTop">
            <div class="adminQuestionTitle">سؤال 1</div>
            <button class="adminDeleteBtn" onclick="clearWarmupQuestion(${c},1)">حذف</button>
          </div>
          <textarea id="q${c}_1" placeholder="سؤال 1">${escapeHtml(cat.questions[1]?.question || "")}</textarea>
          <input id="a${c}_1" placeholder="إجابة 1" value="${escapeHtml(cat.questions[1]?.answer || "")}">
        </div>

        <div class="adminQuestionCard">
          <div class="adminQuestionCardTop">
            <div class="adminQuestionTitle">سؤال 2</div>
            <button class="adminDeleteBtn" onclick="clearWarmupQuestion(${c},2)">حذف</button>
          </div>
          <textarea id="q${c}_2" placeholder="سؤال 2">${escapeHtml(cat.questions[2]?.question || "")}</textarea>
          <input id="a${c}_2" placeholder="إجابة 2" value="${escapeHtml(cat.questions[2]?.answer || "")}">
        </div>

        <div class="adminQuestionCard">
          <div class="adminQuestionCardTop">
            <div class="adminQuestionTitle">سؤال 4</div>
            <button class="adminDeleteBtn" onclick="clearWarmupQuestion(${c},4)">حذف</button>
          </div>
          <textarea id="q${c}_4" placeholder="سؤال 4">${escapeHtml(cat.questions[4]?.question || "")}</textarea>
          <input id="a${c}_4" placeholder="إجابة 4" value="${escapeHtml(cat.questions[4]?.answer || "")}">
        </div>
      </div>
    `
  }

  html += `</div>
    <div class="adminActionRow">
      <button onclick="saveWarmup()">حفظ التسخين</button>
      <button onclick="deleteWarmupSegment()" class="adminDeleteBtn">حذف الفقرة</button>
      <button onclick="renderWarmupAdmin()">إعادة تحميل</button>
    </div>
  `

  editor().innerHTML = html
}
window.printPresenterAsPdf = function () {
  try {
    const overlay = document.getElementById("presenterOverlay")
    if (!overlay) {
      showGameToast("افتح ورقة المقدم أولاً")
      return
    }

    document.body.classList.add("presenter-print-mode")

    setTimeout(() => {
      window.print()
      setTimeout(() => {
        document.body.classList.remove("presenter-print-mode")
      }, 500)
    }, 150)
  } catch (error) {
    console.error(error)
    showGameToast("تعذر فتح الطباعة")
  }
}
async function saveWarmup() {
  const rows = []

  for (let c = 1; c <= 4; c++) {
    const category_name = (document.getElementById(`cat${c}`)?.value || "").trim()

    for (const n of [1, 2, 4]) {
      const question = (document.getElementById(`q${c}_${n}`)?.value || "").trim()
      const answer = (document.getElementById(`a${c}_${n}`)?.value || "").trim()

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

  const { error: delError } = await db
    .from("questions")
    .delete()
    .eq("model", Number(currentModel))
    .eq("segment", "warmup")

  if (delError) {
    console.log(delError)
    showGameToast("فشل حذف القديم")
    return
  }

  if (!rows.length) {
    showGameToast("تم حذف جميع أسئلة التسخين")
    await renderWarmupAdmin()
    return
  }

  const { error: insError } = await db.from("questions").insert(rows)

  if (insError) {
    console.log(insError)
    showGameToast("فشل حفظ التسخين")
    return
  }

  showGameToast("تم حفظ التسخين")
  await renderWarmupAdmin()
}

/* =========================
   Top10
========================= */

async function renderTop10Admin() {
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

  const map = {}
  ;(data || []).forEach(row => {
    if (!map[row.round]) map[row.round] = { question: "", answers: {} }

    if (row.question && String(row.question).trim() !== "") {
      map[row.round].question = row.question
    }

    map[row.round].answers[row.position] = row.answer || ""
  })

  let html = `
    <h2 class="adminSectionTitle">Top 10</h2>
    ${await buildSegmentStatusGrid()}
    <div class="adminGrid2">
  `

  for (let r = 1; r <= 3; r++) {
    const round = map[r] || { question: "", answers: {} }

    html += `
      <div class="adminCard">
        <div class="adminQuestionCardTop">
          <h3>الجولة ${r}</h3>
          <button class="adminDeleteBtn" onclick="clearTop10Round(${r})">حذف الجولة</button>
        </div>
        <input id="topq${r}" placeholder="السؤال" value="${escapeHtml(round.question || "")}">
        ${Array.from({ length: 10 }, (_, i) => i + 1).map(i => `
          <input id="top${r}_${i}" placeholder="إجابة ${i}" value="${escapeHtml(round.answers[i] || "")}">
        `).join("")}
      </div>
    `
  }

  html += `</div>
    <div class="adminActionRow">
      <button onclick="saveTop10()">حفظ Top 10</button>
      <button onclick="deleteTop10Segment()" class="adminDeleteBtn">حذف الفقرة</button>
      <button onclick="renderTop10Admin()">إعادة تحميل</button>
    </div>
  `

  editor().innerHTML = html
}

async function saveTop10() {
  const { error: delError } = await db
    .from("top10_questions")
    .delete()
    .eq("model", currentModel)

  if (delError) {
    console.log(delError)
    showGameToast("فشل حذف القديم")
    return
  }

  const rows = []

  for (let r = 1; r <= 3; r++) {
    const question = (document.getElementById(`topq${r}`)?.value || "").trim()

    for (let i = 1; i <= 10; i++) {
      const answer = (document.getElementById(`top${r}_${i}`)?.value || "").trim()
      if (!question && !answer) continue

      rows.push({
        model: currentModel,
        round: r,
        position: i,
        question,
        answer
      })
    }
  }

  if (!rows.length) {
    showGameToast("تم حذف جميع بيانات Top 10")
    await renderTop10Admin()
    return
  }

  const { error: insError } = await db.from("top10_questions").insert(rows)

  if (insError) {
    console.log(insError)
    showGameToast("فشل حفظ Top 10")
    return
  }

  showGameToast("تم حفظ Top 10")
  await renderTop10Admin()
}

/* =========================
   Auction
========================= */

async function renderAuctionAdmin() {
  const { data, error } = await db
    .from("auction_questions")
    .select("*")
    .eq("model", currentModel)
    .order("number", { ascending: true })

  if (error) {
    console.log(error)
    showGameToast("تعذر تحميل المزاد")
    return
  }

  const map = {}
  let maxNumber = 0

  ;(data || []).forEach(row => {
    map[row.number] = row
    if (Number(row.number) > maxNumber) maxNumber = Number(row.number)
  })

  auctionAdminCount = Math.max(maxNumber || 0, 8)

  editor().innerHTML = `
    <h2 class="adminSectionTitle">المزاد</h2>
    ${await buildSegmentStatusGrid()}

    <div class="adminAuctionTopBar">
      <div class="adminField adminAuctionCountField">
        <label for="auctionCountInput">عدد أسئلة المزاد</label>
        <input id="auctionCountInput" type="number" min="4" value="${auctionAdminCount}">
      </div>

      <div class="adminAuctionTopActions">
        <button onclick="applyAuctionCount()">تحديث العدد</button>
      </div>
    </div>

    <div class="adminGrid2">
      ${Array.from({ length: auctionAdminCount }, (_, idx) => idx + 1).map(i => `
        <div class="adminCard">
          <div class="adminQuestionCardTop">
            <h3>السؤال ${i}</h3>
            <button class="adminDeleteBtn" onclick="clearAuctionQuestion(${i})">حذف</button>
          </div>
          <textarea id="auction${i}" placeholder="السؤال">${escapeHtml(map[i]?.question || "")}</textarea>
          <input id="auctionAnswer${i}" placeholder="الإجابة" value="${escapeHtml(map[i]?.answer || "")}">
          <input id="auctionIncrement${i}" type="number" min="1" placeholder="الزيادة" value="${Number(map[i]?.increment || 1)}">
        </div>
      `).join("")}
    </div>

    <div class="adminActionRow">
      <button onclick="saveAuction()">حفظ المزاد</button>
      <button onclick="deleteAuctionSegment()" class="adminDeleteBtn">حذف الفقرة</button>
      <button onclick="renderAuctionAdmin()">إعادة تحميل</button>
    </div>
  `
}

function applyAuctionCount() {
  const count = Number(document.getElementById("auctionCountInput")?.value || 8)
  auctionAdminCount = Math.max(count, 4)
  renderAuctionAdminWithCount(auctionAdminCount)
  showGameToast("تم تحديث عدد أسئلة المزاد")
}

async function renderAuctionAdminWithCount(count) {
  const { data, error } = await db
    .from("auction_questions")
    .select("*")
    .eq("model", currentModel)
    .order("number", { ascending: true })

  if (error) {
    console.log(error)
    showGameToast("تعذر تحميل المزاد")
    return
  }

  const map = {}
  ;(data || []).forEach(row => {
    map[row.number] = row
  })

  editor().innerHTML = `
    <h2 class="adminSectionTitle">المزاد</h2>
    ${await buildSegmentStatusGrid()}

    <div class="adminAuctionTopBar">
      <div class="adminField adminAuctionCountField">
        <label for="auctionCountInput">عدد أسئلة المزاد</label>
        <input id="auctionCountInput" type="number" min="4" value="${count}">
      </div>

      <div class="adminAuctionTopActions">
        <button onclick="applyAuctionCount()">تحديث العدد</button>
      </div>
    </div>

    <div class="adminGrid2">
      ${Array.from({ length: count }, (_, idx) => idx + 1).map(i => `
        <div class="adminCard">
          <div class="adminQuestionCardTop">
            <h3>السؤال ${i}</h3>
            <button class="adminDeleteBtn" onclick="clearAuctionQuestion(${i})">حذف</button>
          </div>
          <textarea id="auction${i}" placeholder="السؤال">${escapeHtml(map[i]?.question || "")}</textarea>
          <input id="auctionAnswer${i}" placeholder="الإجابة" value="${escapeHtml(map[i]?.answer || "")}">
          <input id="auctionIncrement${i}" type="number" min="1" placeholder="الزيادة" value="${Number(map[i]?.increment || 1)}">
        </div>
      `).join("")}
    </div>

    <div class="adminActionRow">
      <button onclick="saveAuction()">حفظ المزاد</button>
      <button onclick="deleteAuctionSegment()" class="adminDeleteBtn">حذف الفقرة</button>
      <button onclick="renderAuctionAdmin()">إعادة تحميل</button>
    </div>
  `
}

async function saveAuction() {
  const count = Number(document.getElementById("auctionCountInput")?.value || auctionAdminCount || 8)
  const finalCount = Math.max(count, 4)

  const { error: delError } = await db
    .from("auction_questions")
    .delete()
    .eq("model", currentModel)

  if (delError) {
    console.log(delError)
    showGameToast("فشل حذف القديم")
    return
  }

  const rows = []

  for (let i = 1; i <= finalCount; i++) {
    const question = (document.getElementById(`auction${i}`)?.value || "").trim()
    const answer = (document.getElementById(`auctionAnswer${i}`)?.value || "").trim()
    const increment = Number(document.getElementById(`auctionIncrement${i}`)?.value || 1)

    if (!question && !answer) continue

    rows.push({
      model: currentModel,
      number: i,
      question,
      answer,
      increment
    })
  }

  if (!rows.length) {
    showGameToast("تم حذف جميع أسئلة المزاد")
    auctionAdminCount = finalCount
    await renderAuctionAdmin()
    return
  }

  const { error: insError } = await db.from("auction_questions").insert(rows)

  if (insError) {
    console.log(insError)
    showGameToast("فشل حفظ المزاد")
    return
  }

  auctionAdminCount = finalCount
  showGameToast("تم حفظ المزاد")
  await renderAuctionAdmin()
}

/* =========================
   Who
========================= */

async function renderWhoAdmin() {
  const { data, error } = await db
    .from("who_images")
    .select("*")
    .eq("model", currentModel)
    .order("number", { ascending: true })

  if (error) {
    console.log(error)
    showGameToast("تعذر تحميل من هو")
    return
  }

  const map = {}
  ;(data || []).forEach(row => {
    map[row.number] = row
  })

  let html = `
    <h2 class="adminSectionTitle">من هو</h2>
    ${await buildSegmentStatusGrid()}
    <div class="adminGrid2">
  `

  for (let i = 1; i <= 15; i++) {
    html += `
      <div class="adminCard">
        <div class="adminQuestionCardTop">
          <h3>رقم ${i}</h3>
          <button class="adminDeleteBtn" onclick="clearWhoItem(${i})">حذف</button>
        </div>
        <input type="file" id="who${i}" accept="image/*">
        <input id="whoAnswer${i}" placeholder="الإجابة" value="${escapeHtml(map[i]?.answer || "")}">
        ${map[i]?.image ? `<img src="${escapeHtml(map[i].image)}" class="previewImg">` : ""}
      </div>
    `
  }

  html += `</div>
    <div class="adminActionRow">
      <button onclick="saveWho()">حفظ من هو</button>
      <button onclick="deleteWhoSegment()" class="adminDeleteBtn">حذف الفقرة</button>
      <button onclick="renderWhoAdmin()">إعادة تحميل</button>
    </div>
  `

  editor().innerHTML = html
}

async function saveWho() {
  const { error: delError } = await db
    .from("who_images")
    .delete()
    .eq("model", currentModel)

  if (delError) {
    console.log(delError)
    showGameToast("تعذر حذف القديم")
    return
  }

  const rows = []

  for (let i = 1; i <= 15; i++) {
    const file = document.getElementById(`who${i}`)?.files[0]
    const answer = (document.getElementById(`whoAnswer${i}`)?.value || "").trim()

    let oldImage = ""
    const existing = await db.from("who_images").select("image").eq("model", currentModel).eq("number", i).maybeSingle()
    if (existing?.data?.image) oldImage = existing.data.image

    let image = oldImage
    if (file) image = await uploadImageFile(file, `who_${i}`)

    if (!image && !answer) continue

    rows.push({
      model: currentModel,
      number: i,
      image,
      answer
    })
  }

  if (!rows.length) {
    showGameToast("تم حذف جميع عناصر من هو")
    await renderWhoAdmin()
    return
  }

  const { error: insError } = await db.from("who_images").insert(rows)

  if (insError) {
    console.log(insError)
    showGameToast("فشل حفظ من هو")
    return
  }

  showGameToast("تم حفظ من هو")
  await renderWhoAdmin()
}

/* =========================
   Final - Admin كامل
========================= */

let finalAdminRound = 1

async function renderFinalAdmin() {
  finalAdminRound = 1
  await renderFinalAdminRound(1)
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

  let html = `
    <div class="finalAdminShell">
      <h2 class="adminSectionTitle">الفاصلة</h2>
      ${await buildSegmentStatusGrid()}

      <div class="finalAdminTopBar">
        <div class="finalAdminRoundsBar">
          <button class="${round === 1 ? "activeFinalAdminRound" : ""}" onclick="renderFinalAdminRound(1)">الجولة 1</button>
          <button class="${round === 2 ? "activeFinalAdminRound" : ""}" onclick="renderFinalAdminRound(2)">الجولة 2</button>
          <button class="${round === 3 ? "activeFinalAdminRound" : ""}" onclick="renderFinalAdminRound(3)">الجولة 3</button>
        </div>

        <div class="finalAdminTitleCard">
          <div class="adminField">
            <label>اسم الجولة</label>
            <input id="finalRoundTitle" value="${escapeHtml(metaData?.title || `الجولة ${round}`)}" placeholder="اسم الجولة">
          </div>
        </div>
      </div>
  `

  if (round === 1) {
    html += await buildFinalRound1Admin(metaData)
  }

  if (round === 2) {
    html += await buildFinalRound2Admin()
  }

  if (round === 3) {
    html += await buildFinalRound3Admin()
  }

  html += `
      <div class="finalAdminActions">
        <button onclick="saveFinalRound(${round})">حفظ الجولة</button>
        <button onclick="deleteFinalRound(${round})" class="adminDeleteBtn">حذف هذه الجولة</button>
        <button onclick="deleteFinalSegment()" class="adminDeleteBtn">حذف الفقرة كاملة</button>
        <button onclick="renderFinalAdminRound(${round})">إعادة تحميل</button>
      </div>
    </div>
  `

  editor().innerHTML = html
}

/* =========================
   Round 1 Admin
========================= */

async function buildFinalRound1Admin(metaData) {
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

  const cardsCount = Number(metaData?.cards_count || 4)

  let html = `
    <div class="finalAdminTitleCard finalAdminSubCard">
      <div class="adminField">
        <label>عدد الأرقام</label>
        <select id="finalRound1CardsCount">
          <option value="4" ${cardsCount === 4 ? "selected" : ""}>4</option>
          <option value="6" ${cardsCount === 6 ? "selected" : ""}>6</option>
        </select>
      </div>
    </div>

    <div class="finalAdminGrid finalAdminGridRound1">
  `

  for (let i = 1; i <= 6; i++) {
    const dimmed = i > cardsCount ? 'style="opacity:.35;"' : ''

    html += `
      <div class="finalAdminCard" ${dimmed}>
        <div class="finalAdminCardHead">
          <h3>رقم ${i}</h3>
          <button class="adminDeleteBtn" onclick="clearFinalRound1Item(${i})">حذف</button>
        </div>

        <div class="finalAdminRowSingle">
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

        <div class="finalAdminPreviewBox">
          ${map[i]?.image ? `<img src="${escapeHtml(map[i].image)}" class="previewImg">` : ""}
        </div>
      </div>
    `
  }

  html += `</div>`
  return html
}

async function saveFinalRound1(cardsCount) {
  const { data: oldRows } = await db
    .from("final_round1_items")
    .select("*")
    .eq("model", currentModel)

  const oldMap = {}
  ;(oldRows || []).forEach(row => {
    oldMap[row.number] = row
  })

  const { error: delError } = await db
    .from("final_round1_items")
    .delete()
    .eq("model", currentModel)

  if (delError) {
    console.log(delError)
    showGameToast("تعذر حذف الجولة الأولى القديمة")
    return
  }

  const rows = []

  for (let i = 1; i <= cardsCount; i++) {
    const file = document.getElementById(`finalRound1File_${i}`)?.files?.[0]
    const answer = (document.getElementById(`finalRound1Answer_${i}`)?.value || "").trim()
    const note = (document.getElementById(`finalRound1Note_${i}`)?.value || "").trim()

    let image = oldMap[i]?.image || ""
    if (file) {
      image = await uploadImageFile(file, `final_r1_${i}`)
    }

    if (!image && !answer && !note) continue

    rows.push({
      model: currentModel,
      number: i,
      image,
      answer,
      note
    })
  }

  if (rows.length) {
    const { error: insError } = await db.from("final_round1_items").insert(rows)
    if (insError) {
      console.log(insError)
      showGameToast("فشل حفظ الجولة الأولى")
    }
  }
}

async function clearFinalRound1Item(number) {
  const confirmed = window.confirm(`حذف العنصر ${number} من الجولة الأولى؟`)
  if (!confirmed) return

  const { error } = await db
    .from("final_round1_items")
    .delete()
    .eq("model", currentModel)
    .eq("number", number)

  if (error) {
    console.log(error)
    showGameToast("تعذر حذف العنصر")
    return
  }

  showGameToast(`تم حذف العنصر ${number}`)
  await renderFinalAdminRound(1)
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

  let html = `
    <div class="finalAdminRound2Wrap finalAdminRound2SingleColumn">
  `

  for (let number = 1; number <= 4; number++) {
    const isScramble = number === 1 || number === 3
    const rows = grouped[number] || []

    html += `
      <div class="finalAdminCard finalAdminWideCard">
        <div class="finalAdminCardHead">
          <h3>رقم ${number}</h3>
          <div class="finalAdminTypeBadge">${isScramble ? "كلمات مبعثرة" : "15 تلميحة او اقل"}</div>
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

/* =========================
   Round 3 Admin
========================= */

async function buildFinalRound3Admin() {
  const { data, error } = await db
    .from("final_round3_items")
    .select("*")
    .eq("model", currentModel)
    .order("number", { ascending: true })
    .order("image_order", { ascending: true })

  if (error) {
    console.log(error)
    return `<div class="adminCard">تعذر تحميل الجولة الثالثة</div>`
  }

  const grouped = { 1: [], 2: [] }
  ;(data || []).forEach(row => {
    grouped[row.number].push(row)
  })

  let html = `<div class="finalAdminRound3Wrap">`

  for (let number = 1; number <= 2; number++) {
    const rows = grouped[number] || []

    html += `
      <div class="finalAdminCard finalAdminWideCard">
        <div class="finalAdminCardHead">
          <h3>رقم ${number}</h3>
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
   Save Final Round
========================= */

async function saveFinalRound(round) {
  const title = (document.getElementById("finalRoundTitle")?.value || "").trim() || `الجولة ${round}`

  let cardsCount = null
  if (round === 1) {
    cardsCount = Number(document.getElementById("finalRound1CardsCount")?.value || 4)
  }

  const { error: deleteMetaError } = await db
    .from("final_round_meta")
    .delete()
    .eq("model", currentModel)
    .eq("round", round)

  if (deleteMetaError) {
    console.log(deleteMetaError)
    showGameToast("تعذر حذف بيانات الجولة")
    return
  }

  const { error: insertMetaError } = await db
    .from("final_round_meta")
    .insert([{
      model: currentModel,
      round,
      title,
      cards_count: cardsCount
    }])

  if (insertMetaError) {
    console.log(insertMetaError)
    showGameToast("تعذر حفظ اسم الجولة")
    return
  }

  if (round === 1) {
    await saveFinalRound1(cardsCount)
  }

  if (round === 2) {
    await saveFinalRound2()
  }

  if (round === 3) {
    await saveFinalRound3()
  }

  showGameToast(`تم حفظ الجولة ${round}`)
  await renderFinalAdminRound(round)
}

async function saveFinalRound1(cardsCount) {
  const { data: oldRows } = await db
    .from("final_round1_items")
    .select("*")
    .eq("model", currentModel)

  const oldMap = {}
  ;(oldRows || []).forEach(row => {
    oldMap[row.number] = row
  })

  const { error: delError } = await db
    .from("final_round1_items")
    .delete()
    .eq("model", currentModel)

  if (delError) {
    console.log(delError)
    showGameToast("تعذر حذف الجولة الأولى القديمة")
    return
  }

  const rows = []

  for (let i = 1; i <= cardsCount; i++) {
    const file = document.getElementById(`finalRound1File_${i}`)?.files?.[0]
    const answer = (document.getElementById(`finalRound1Answer_${i}`)?.value || "").trim()
const note = (document.getElementById(`finalRound1Note_${i}`)?.value || "").trim()
    let image = oldMap[i]?.image || ""
    if (file) {
      image = await uploadImageFile(file, `final_r1_${i}`)
    }

    if (!image && !answer && !note) continue

    rows.push({
  model: currentModel,
  number: i,
  image,
  answer,
  note
})
  }

  if (rows.length) {
    const { error: insError } = await db.from("final_round1_items").insert(rows)
    if (insError) {
      console.log(insError)
      showGameToast("فشل حفظ الجولة الأولى")
    }
  }
}

async function saveFinalRound2() {
  const { error: delError } = await db
    .from("final_round2_items")
    .delete()
    .eq("model", currentModel)

  if (delError) {
    console.log(delError)
    showGameToast("تعذر حذف الجولة الثانية القديمة")
    return
  }

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
        model: currentModel,
        number,
        game_type: gameType,
        title: "",
        item_order: i,
        prompt,
        answer,
        hint
      })
    }
  }

  if (rows.length) {
    const { error: insError } = await db.from("final_round2_items").insert(rows)
    if (insError) {
      console.log(insError)
      showGameToast("فشل حفظ الجولة الثانية")
    }
  }
}

async function saveFinalRound3() {
  const { data: oldRows } = await db
    .from("final_round3_items")
    .select("*")
    .eq("model", currentModel)

  const oldMap = {}
  ;(oldRows || []).forEach(row => {
    oldMap[`${row.number}_${row.image_order}`] = row
  })

  const { error: delError } = await db
    .from("final_round3_items")
    .delete()
    .eq("model", currentModel)

  if (delError) {
    console.log(delError)
    showGameToast("تعذر حذف الجولة الثالثة القديمة")
    return
  }

  const rows = []

  for (let number = 1; number <= 2; number++) {
    for (let i = 1; i <= 5; i++) {
      const file = document.getElementById(`finalRound3File_${number}_${i}`)?.files?.[0]
      const answer = (document.getElementById(`finalRound3Answer_${number}_${i}`)?.value || "").trim()

      let image = oldMap[`${number}_${i}`]?.image || ""
      if (file) {
        image = await uploadImageFile(file, `final_r3_${number}_${i}`)
      }

      if (!image && !answer) continue

      rows.push({
        model: currentModel,
        number,
        image_order: i,
        image,
        answer
      })
    }
  }

  if (rows.length) {
    const { error: insError } = await db.from("final_round3_items").insert(rows)
    if (insError) {
      console.log(insError)
      showGameToast("فشل حفظ الجولة الثالثة")
    }
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
    const { error } = await db.from("final_round1_items").delete().eq("model", currentModel)
    if (error) console.log(error)
  }

  if (round === 2) {
    const { error } = await db.from("final_round2_items").delete().eq("model", currentModel)
    if (error) console.log(error)
  }

  if (round === 3) {
    const { error } = await db.from("final_round3_items").delete().eq("model", currentModel)
    if (error) console.log(error)
  }

  showGameToast(`تم حذف الجولة ${round}`)
  await renderFinalAdminRound(round)
}

async function deleteFinalSegment() {
  const confirmed = window.confirm("هل تريد حذف فقرة الفاصلة كاملة؟")
  if (!confirmed) return

  await db.from("final_round_meta").delete().eq("model", currentModel)
  await db.from("final_round1_items").delete().eq("model", currentModel)
  await db.from("final_round2_items").delete().eq("model", currentModel)
  await db.from("final_round3_items").delete().eq("model", currentModel)

  showGameToast("تم حذف فقرة الفاصلة")
  await renderFinalAdmin()
}

async function clearFinalRound1Item(number) {
  const confirmed = window.confirm(`حذف العنصر ${number} من الجولة الأولى؟`)
  if (!confirmed) return

  const { error } = await db
    .from("final_round1_items")
    .delete()
    .eq("model", currentModel)
    .eq("number", number)

  if (error) {
    console.log(error)
    showGameToast("تعذر حذف العنصر")
    return
  }

  showGameToast(`تم حذف العنصر ${number}`)
  await renderFinalAdminRound(1)
}
/* =========================
   Archive
========================= */

let archiveAdminRound = 1
let archivePendingExtraCount = 0
let archiveExtraTextPositions = []
let archiveDraftState = {}

const ARCHIVE_TEXT_START_POSITION = 5
const ARCHIVE_MAX_TEXT_BOXES = 20

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

  return `
    <div class="archiveAdminItem archiveAdminItemEnhanced">
      <div class="archiveAdminItemHead">
        <div class="archiveAdminItemTitle">العنصر ${position}</div>
      </div>

      <div class="archiveAdminFields">
        <select id="archiveItemParent_${position}" onchange="handleArchiveParentChange()">
          <option value="3" ${parentPosition === 3 ? "selected" : ""}>تحت الصورة 3</option>
          <option value="4" ${parentPosition === 4 ? "selected" : ""}>تحت الصورة 4</option>
        </select>

        <input
          id="archiveItemLabel_${position}"
          type="text"
          placeholder="عنوان صغير - اختياري"
          value="${escapeHtml(mergedItem.label || "")}"
        >

        <select id="archiveItemPromptStyle_${position}">
          <option value="ball" ${promptStyle === "ball" ? "selected" : ""}>⚽️ أسود</option>
          <option value="shoe" ${promptStyle === "shoe" ? "selected" : ""}>👟 أبيض</option>
        </select>

        <textarea
          id="archiveItemText_${position}"
          placeholder="النص"
        >${escapeHtml(mergedItem.text || "")}</textarea>
      </div>
    </div>
  `
}

async function renderArchiveAdmin() {
  archiveAdminRound = 1
  archivePendingExtraCount = 0
  archiveDraftState = {}
  await renderArchiveAdminRound(1)
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

  editor().innerHTML = `
    <h2 class="adminSectionTitle">الأرشيف</h2>
    ${await buildSegmentStatusGrid()}

    <div class="archiveAdminShell">

      <div class="archiveAdminRoundsBar">
        <button class="${round === 1 ? "activeArchiveRoundBtn" : ""}" onclick="renderArchiveAdminRound(1)">الجولة 1</button>
        <button class="${round === 2 ? "activeArchiveRoundBtn" : ""}" onclick="renderArchiveAdminRound(2)">الجولة 2</button>
        <button class="${round === 3 ? "activeArchiveRoundBtn" : ""}" onclick="renderArchiveAdminRound(3)">الجولة 3</button>
        <button class="${round === 4 ? "activeArchiveRoundBtn" : ""}" onclick="renderArchiveAdminRound(4)">الجولة 4</button>
      </div>

      <div class="archiveAdminLayout">

        <div class="archiveAdminBoard ${round === 4 ? "archiveAdminBoardRound4" : ""}">

          <div class="archiveAdminSketchTop">
            <div class="archiveAdminSketchRow">
              <div class="archiveAdminText">
                <input
                  id="archiveItemText_1"
                  type="text"
                  placeholder="قيمة البطولة"
                  value="${escapeHtml(archiveDraftState.__top?.text1 || map[1]?.text || "")}"
                >
              </div>
              <div class="archiveAdminLabel">البطولة</div>
            </div>

            <div class="archiveAdminSketchRow">
              <div class="archiveAdminText">
                <input
                  id="archiveItemText_2"
                  type="text"
                  placeholder="قيمة الموسم"
                  value="${escapeHtml(archiveDraftState.__top?.text2 || map[2]?.text || "")}"
                >
              </div>
              <div class="archiveAdminLabel">الموسم</div>
            </div>
          </div>

          <div class="archiveAdminSketchMiddle">
            <div class="archiveAdminImageBox">
              <div class="archiveAdminItemTitle">الصورة 4</div>
              <input id="archiveItemFile_4" type="file" accept="image/*">
              ${map[4]?.image ? `<img src="${escapeHtml(map[4].image)}" class="archiveAdminPreviewImg">` : ""}
            </div>

            <div class="archiveAdminResultCenter">
              <div class="archiveAdminResultLabel">النتيجة</div>
              <div class="archiveAdminResultValue">
                <input
                  id="archiveScore"
                  type="text"
                  placeholder="النتيجة"
                  value="${escapeHtml(archiveDraftState.__top?.score || box?.score || "")}"
                >
              </div>
            </div>

            <div class="archiveAdminImageBox">
              <div class="archiveAdminItemTitle">الصورة 3</div>
              <input id="archiveItemFile_3" type="file" accept="image/*">
              ${map[3]?.image ? `<img src="${escapeHtml(map[3].image)}" class="archiveAdminPreviewImg">` : ""}
            </div>
          </div>

          <div class="archiveAdminBottomGrid">
            <div class="archiveAdminBottomCol">
              <div class="archiveAdminColumnTitle">تحت الصورة 4</div>
              ${under4Positions.map(pos => renderArchiveAdminItem(pos, map[pos])).join("")}
            </div>

            <div class="archiveAdminBottomCol">
              <div class="archiveAdminColumnTitle">تحت الصورة 3</div>
              ${under3Positions.map(pos => renderArchiveAdminItem(pos, map[pos])).join("")}
            </div>
          </div>
        </div>

        <div class="archiveAdminTools">
          <div class="adminCard archiveToolsCard">
            <h3>أدوات الجولة ${round}</h3>

            <div class="archiveToolsButtons">
              <button onclick="addArchiveTextBox()">إضافة مربع نص</button>
              <button onclick="removeArchiveTextBox()">حذف آخر مربع</button>
              <button onclick="saveArchiveRoundNew()">حفظ الجولة</button>
              <button onclick="deleteArchiveSegment(${round})" class="adminDeleteBtn">حذف هذه الجولة</button>
              <button onclick="deleteArchiveSegment()" class="adminDeleteBtn">حذف جميع الجولات</button>
            </div>
          </div>
        </div>

      </div>
    </div>
  `
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
  collectArchiveDraftState()

  const round = archiveAdminRound

  const scoreValue = (document.getElementById("archiveScore")?.value || "").trim()
  const text1 = (document.getElementById("archiveItemText_1")?.value || "").trim()
  const text2 = (document.getElementById("archiveItemText_2")?.value || "").trim()

  const { data: oldRows, error: oldRowsError } = await db
    .from("archive_items")
    .select("*")
    .eq("model", currentModel)
    .eq("round", round)

  if (oldRowsError) {
    console.log(oldRowsError)
    showGameToast("تعذر قراءة عناصر الأرشيف القديمة")
    return
  }

  const oldMap = {}
  ;(oldRows || []).forEach(row => {
    oldMap[row.position] = row
  })

  const { error: delBoxError } = await db
    .from("archive_boxes")
    .delete()
    .eq("model", currentModel)
    .eq("round", round)

  if (delBoxError) {
    console.log(delBoxError)
    showGameToast("فشل حذف بيانات الجولة")
    return
  }

  const { error: insBoxError } = await db
    .from("archive_boxes")
    .insert([{
      model: currentModel,
      round,
      tournament: text1,
      season: text2,
      score: scoreValue
    }])

  if (insBoxError) {
    console.log(insBoxError)
    showGameToast("فشل حفظ صندوق الأرشيف")
    return
  }

  const { error: delItemsError } = await db
    .from("archive_items")
    .delete()
    .eq("model", currentModel)
    .eq("round", round)

  if (delItemsError) {
    console.log(delItemsError)
    showGameToast("فشل حذف عناصر الجولة")
    return
  }

  const rows = []

  rows.push({
    model: currentModel,
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
    model: currentModel,
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
    const file = document.getElementById(`archiveItemFile_${position}`)?.files?.[0]

    if (file) {
      image = await uploadImageFile(file, `archive_r${round}_${position}`)
    }

    rows.push({
      model: currentModel,
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

  for (const position of archiveExtraTextPositions) {
    const label = (document.getElementById(`archiveItemLabel_${position}`)?.value || "").trim()
    const text = (document.getElementById(`archiveItemText_${position}`)?.value || "").trim()

    if (!label && !text) continue

    const parentPosition = Number(
      document.getElementById(`archiveItemParent_${position}`)?.value || 3
    )

    rows.push({
      model: currentModel,
      round,
      position,
      item_type: "text",
      label,
      text,
      image: "",
      parent_position: parentPosition,
      column_group: parentPosition,
      prompt_style: (document.getElementById(`archiveItemPromptStyle_${position}`)?.value || "shoe").trim()
    })
  }

  const { error: insItemsError } = await db
    .from("archive_items")
    .insert(rows)

  if (insItemsError) {
    console.log(insItemsError)
    showGameToast("فشل حفظ عناصر الأرشيف")
    return
  }

  archivePendingExtraCount = 0
  archiveDraftState = {}
  showGameToast(`تم حفظ الجولة ${round}`)
  await renderArchiveAdminRound(round)
}

async function deleteArchiveSegment(round = null) {
  if (!currentModel) {
    showGameToast("افتح النموذج أولاً")
    return
  }

  const deleteOneRound = round !== null && round !== undefined
  const confirmMessage = deleteOneRound
    ? `هل تريد حذف الجولة ${round} من الأرشيف؟`
    : "هل تريد حذف جميع جولات الأرشيف؟"

  const confirmed = window.confirm(confirmMessage)
  if (!confirmed) return

  try {
    let deleteBoxesQuery = db.from("archive_boxes").delete().eq("model", currentModel)
    let deleteItemsQuery = db.from("archive_items").delete().eq("model", currentModel)

    if (deleteOneRound) {
      deleteBoxesQuery = deleteBoxesQuery.eq("round", round)
      deleteItemsQuery = deleteItemsQuery.eq("round", round)
    }

    const { error: itemsError } = await deleteItemsQuery
    if (itemsError) {
      console.log(itemsError)
      showGameToast("تعذر حذف عناصر الأرشيف")
      return
    }

    const { error: boxesError } = await deleteBoxesQuery
    if (boxesError) {
      console.log(boxesError)
      showGameToast("تعذر حذف صناديق الأرشيف")
      return
    }

    archivePendingExtraCount = 0
    archiveDraftState = {}

    if (deleteOneRound) {
      showGameToast(`تم حذف الجولة ${round}`)
      await renderArchiveAdminRound(round)
    } else {
      showGameToast("تم حذف جميع جولات الأرشيف")
      archiveAdminRound = 1
      await renderArchiveAdminRound(1)
    }
  } catch (err) {
    console.log(err)
    showGameToast("حدث خطأ أثناء حذف الأرشيف")
  }
}
