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
   Print Presenter
========================= */

async function printPresenterSheet() {
  if (!currentModel) {
    showGameToast("افتح نموذج أولاً")
    return
  }

  const [warmupRes, top10Res, whoRes, archiveBoxesRes, archiveItemsRes] = await Promise.all([
    db
      .from("questions")
      .select("*")
      .eq("model", currentModel)
      .eq("segment", "warmup")
      .order("category", { ascending: true })
      .order("number", { ascending: true }),

    db
      .from("top10_questions")
      .select("*")
      .eq("model", currentModel)
      .order("round", { ascending: true })
      .order("position", { ascending: true }),

    db
      .from("who_images")
      .select("*")
      .eq("model", currentModel)
      .order("number", { ascending: true }),

    db
      .from("archive_boxes")
      .select("*")
      .eq("model", currentModel)
      .order("round", { ascending: true }),

    db
      .from("archive_items")
      .select("*")
      .eq("model", currentModel)
      .order("round", { ascending: true })
      .order("position", { ascending: true })
  ])

  const warmup = warmupRes.data || []
  const top10 = top10Res.data || []
  const whoItems = whoRes.data || []
  const archiveBoxes = archiveBoxesRes.data || []
  const archiveItems = archiveItemsRes.data || []

  const warmupMap = {}
  warmup.forEach(row => {
    const cat = Number(row.category || 0)
    if (!warmupMap[cat]) {
      warmupMap[cat] = {
        category_name: row.category_name || `الفئة ${cat}`,
        questions: []
      }
    }

    warmupMap[cat].questions.push({
      number: row.number,
      question: row.question || "",
      answer: row.answer || ""
    })
  })

  const top10Map = {}
  top10.forEach(row => {
    const round = Number(row.round || 0)
    if (!top10Map[round]) {
      top10Map[round] = {
        question: row.question || "",
        answers: {}
      }
    }

    top10Map[round].question = row.question || top10Map[round].question
    top10Map[round].answers[Number(row.position)] = row.answer || ""
  })

  const archiveBoxMap = {}
  archiveBoxes.forEach(row => {
    archiveBoxMap[Number(row.round)] = row
  })

  const archiveItemsMap = {}
  archiveItems.forEach(row => {
    const round = Number(row.round || 0)
    if (!archiveItemsMap[round]) archiveItemsMap[round] = []
    archiveItemsMap[round].push(row)
  })

  let host = document.getElementById("printPresenterArea")
  if (!host) {
    host = document.createElement("div")
    host.id = "printPresenterArea"
    document.body.appendChild(host)
  }

  host.innerHTML = `
    <div class="printPresenterWrap">

      <div class="printPresenterHeader">
        <div class="printPresenterTitle">ورقة المقدم</div>
        <div class="printPresenterModel">${escapeHtml(getCurrentModelNameSafe())}</div>
      </div>

      <div class="printSegmentBlock">
        <div class="printSegmentName">فقرة التسخين</div>

        <div class="printWarmupGrid">
          ${[1, 2, 3, 4].map(cat => {
            const item = warmupMap[cat] || {
              category_name: `الفئة ${cat}`,
              questions: []
            }

            return `
              <div class="printWarmupCard">
                <div class="printWarmupCategory">${escapeHtml(item.category_name || `الفئة ${cat}`)}</div>

                ${(item.questions.length ? item.questions : []).map(q => `
                  <div class="printWarmupItem">
                    <div class="printWarmupQ">
                      <span class="printWarmupNum">(${q.number})</span>
                      <span>${escapeHtml(q.question)}</span>
                    </div>
                    <div class="printWarmupA">الإجابة: ${escapeHtml(q.answer)}</div>
                  </div>
                `).join("") || `<div class="printWarmupItem empty">لا توجد أسئلة</div>`}
              </div>
            `
          }).join("")}
        </div>
      </div>

      <div class="printSegmentBlock">
        <div class="printSegmentName">فقرة Top 10</div>

        ${[1, 2, 3].map(round => {
          const item = top10Map[round] || {
            question: "",
            answers: {}
          }

          return `
            <div class="printTop10Board">
              <div class="printTop10Header">
                <div class="printTop10RoundBadge">الجولة ${round}</div>
                <div class="printTop10QuestionBox">${escapeHtml(item.question || "لا يوجد سؤال")}</div>
              </div>

              <div class="printTop10Boxes">
                ${Array.from({ length: 10 }, (_, i) => i + 1).map(pos => `
                  <div class="printTop10Box">
                    <div class="printTop10BoxNum">${pos}</div>
                    <div class="printTop10BoxAnswer">${escapeHtml(item.answers[pos] || "—")}</div>
                  </div>
                `).join("")}
              </div>
            </div>
          `
        }).join("")}
      </div>

      <div class="printSegmentBlock">
        <div class="printSegmentName">فقرة من هو</div>

        <div class="printWhoGrid">
          ${Array.from({ length: 15 }, (_, i) => i + 1).map(num => {
            const row = whoItems.find(x => Number(x.number) === num)
            return `
              <div class="printWhoCard">
                <div class="printWhoNum">${num}</div>
                <div class="printWhoAnswer">${escapeHtml(row?.answer || "—")}</div>
              </div>
            `
          }).join("")}
        </div>
      </div>

      <div class="printSegmentBlock">
        <div class="printSegmentName">فقرة الأرشيف</div>

        ${[1, 2, 3].map(round => {
          const box = archiveBoxMap[round] || {}
          const items = archiveItemsMap[round] || []
          const byPos = {}
          items.forEach(item => {
            byPos[Number(item.position)] = item
          })

          const bottomItems = items
            .filter(item => Number(item.position) >= 5)
            .sort((a, b) => Number(a.position) - Number(b.position))

          const leftItems = bottomItems.filter(item => Number(item.column_group || 4) === 4)
          const rightItems = bottomItems.filter(item => Number(item.column_group || 3) === 3)

          return `
            <div class="printArchiveBoard">
              <div class="printArchiveRound">الجولة ${round}</div>

              <div class="printArchiveTop">
                <div class="printArchiveInfoCard">
                  <div class="printArchiveInfoLabel">البطولة</div>
                  <div class="printArchiveInfoValue">${escapeHtml(byPos[1]?.text || box?.tournament || "—")}</div>
                </div>

                <div class="printArchiveInfoCard">
                  <div class="printArchiveInfoLabel">الموسم</div>
                  <div class="printArchiveInfoValue">${escapeHtml(byPos[2]?.text || box?.season || "—")}</div>
                </div>
              </div>

              <div class="printArchiveMiddle">
                <div class="printArchiveBigCard">${byPos[4]?.image ? `<img src="${escapeHtml(byPos[4].image)}" alt="">` : "الصورة 4"}</div>

                <div class="printArchiveScoreCard">
                  <div class="printArchiveScoreLabel">النتيجة</div>
                  <div class="printArchiveScoreValue">${escapeHtml(box?.score || "—")}</div>
                </div>

                <div class="printArchiveBigCard">${byPos[3]?.image ? `<img src="${escapeHtml(byPos[3].image)}" alt="">` : "الصورة 3"}</div>
              </div>

              <div class="printArchiveBottom">
                <div class="printArchiveCol">
                  ${leftItems.map(item => `
                    <div class="printArchiveSmallCard ${String(item.label || "").trim() === "المطلوب" ? "required" : ""}">
                      <div class="printArchiveSmallHead">
                        <div class="printArchiveSmallNum">${item.position}</div>
                        ${item.label ? `<div class="printArchiveSmallLabel ${String(item.label || "").trim() === "المطلوب" ? "requiredLabel" : ""}">${escapeHtml(item.label)}</div>` : ""}
                      </div>
                      <div class="printArchiveSmallText">${escapeHtml(item.text || "—")}</div>
                    </div>
                  `).join("")}
                </div>

                <div class="printArchiveCol">
                  ${rightItems.map(item => `
                    <div class="printArchiveSmallCard ${String(item.label || "").trim() === "المطلوب" ? "required" : ""}">
                      <div class="printArchiveSmallHead">
                        <div class="printArchiveSmallNum">${item.position}</div>
                        ${item.label ? `<div class="printArchiveSmallLabel ${String(item.label || "").trim() === "المطلوب" ? "requiredLabel" : ""}">${escapeHtml(item.label)}</div>` : ""}
                      </div>
                      <div class="printArchiveSmallText">${escapeHtml(item.text || "—")}</div>
                    </div>
                  `).join("")}
                </div>
              </div>
            </div>
          `
        }).join("")}
      </div>

    </div>
  `

  window.print()
}

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
   Final
========================= */

async function renderFinalAdmin() {
  const { data, error } = await db
    .from("final_images")
    .select("*")
    .eq("model", currentModel)
    .order("number", { ascending: true })

  if (error) {
    console.log(error)
    showGameToast("تعذر تحميل الفاصلة")
    return
  }

  const map = {}
  ;(data || []).forEach(row => {
    map[row.number] = row
  })

  let html = `
    <h2 class="adminSectionTitle">الفاصلة</h2>
    ${await buildSegmentStatusGrid()}
    <div class="adminGrid2">
  `

  for (let i = 1; i <= 6; i++) {
    html += `
      <div class="adminCard">
        <div class="adminQuestionCardTop">
          <h3>رقم ${i}</h3>
          <button class="adminDeleteBtn" onclick="clearFinalItem(${i})">حذف</button>
        </div>
        <input type="file" id="final${i}" accept="image/*">
        <input id="finalAnswer${i}" placeholder="الإجابة" value="${escapeHtml(map[i]?.answer || "")}">
        ${map[i]?.image ? `<img src="${escapeHtml(map[i].image)}" class="previewImg">` : ""}
      </div>
    `
  }

  html += `</div>
    <div class="adminActionRow">
      <button onclick="saveFinal()">حفظ الفاصلة</button>
      <button onclick="deleteFinalSegment()" class="adminDeleteBtn">حذف الفقرة</button>
      <button onclick="renderFinalAdmin()">إعادة تحميل</button>
    </div>
  `

  editor().innerHTML = html
}

async function saveFinal() {
  const { error: delError } = await db
    .from("final_images")
    .delete()
    .eq("model", currentModel)

  if (delError) {
    console.log(delError)
    showGameToast("تعذر حذف القديم")
    return
  }

  const rows = []

  for (let i = 1; i <= 6; i++) {
    const file = document.getElementById(`final${i}`)?.files[0]
    const answer = (document.getElementById(`finalAnswer${i}`)?.value || "").trim()

    let oldImage = ""
    const existing = await db.from("final_images").select("image").eq("model", currentModel).eq("number", i).maybeSingle()
    if (existing?.data?.image) oldImage = existing.data.image

    let image = oldImage
    if (file) image = await uploadImageFile(file, `final_${i}`)

    if (!image && !answer) continue

    rows.push({
      model: currentModel,
      number: i,
      image,
      answer
    })
  }

  if (!rows.length) {
    showGameToast("تم حذف جميع عناصر الفاصلة")
    await renderFinalAdmin()
    return
  }

  const { error: insError } = await db.from("final_images").insert(rows)

  if (insError) {
    console.log(insError)
    showGameToast("فشل حفظ الفاصلة")
    return
  }

  showGameToast("تم حفظ الفاصلة")
  await renderFinalAdmin()
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