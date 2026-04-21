const BUCKET_NAME = "r3-images"

let currentModel = null
let currentModelName = ""
let auctionAdminCount = 8
let gameToastTimer = null

let finalAdminRound = 1
let archiveAdminRound = 1
let archivePendingExtraCount = 0
let archiveExtraTextPositions = []
let archiveDraftState = {}

const ARCHIVE_TEXT_START_POSITION = 5
const ARCHIVE_MAX_TEXT_BOXES = 20

document.addEventListener("DOMContentLoaded", async () => {
  await loadModels()
  showAdminEmptyState()
  updateAdminBrandModel()
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

function setActiveAdminTab(segment) {
  const wrap = tabs()
  if (!wrap) return

  wrap.querySelectorAll(".adminTabBtn").forEach(btn => {
    btn.classList.remove("activeAdminTab")
  })

  const map = {
    warmup: 0,
    top10: 1,
    auction: 2,
    who: 3,
    final: 4,
    archive: 5
  }

  const index = map[segment]
  if (index === undefined) return

  const btn = wrap.querySelectorAll(".adminTabBtn")[index]
  if (btn) btn.classList.add("activeAdminTab")
}

function clearActiveAdminTab() {
  const wrap = tabs()
  if (!wrap) return

  wrap.querySelectorAll(".adminTabBtn").forEach(btn => {
    btn.classList.remove("activeAdminTab")
  })
}

function showAdminEmptyState(message = "افتح نموذجًا ثم اختر الفقرة التي تريد تعديلها") {
  const area = editor()
  if (!area) return

  area.innerHTML = `<div class="adminEmptyState">${message}</div>`
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
function updateAdminBrandModel() {
  const brandModel = document.getElementById("adminBrandCurrentModel")
  if (!brandModel) return

  if (!currentModel) {
    brandModel.classList.add("hidden")
    brandModel.innerHTML = ""
    return
  }

  brandModel.classList.remove("hidden")
  brandModel.innerHTML = `
    <div class="adminBrandCurrentModelLabel">النموذج الحالي</div>
    <div class="adminBrandCurrentModelName">${escapeHtml(getCurrentModelNameSafe())}</div>
  `
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
    db.from("final_round1_items").select("id", { count: "exact", head: true }).eq("model", currentModel),
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
    auction: "فتبلة",
    who: "من هو",
    final: "الفاصلة",
    archive: "الأرشيف"
  }

  return `
    <div class="adminStatusStrip">
      ${Object.keys(labels).map(key => {
        const done = isSegmentDone(key, counts[key] || 0)

        return `
          <div class="adminStatusStripItem ${done ? "doneCard" : ""}">
            <span class="adminStatusStripName">${labels[key]}</span>
            <span class="adminStatusStripCount">${counts[key] || 0}</span>
          </div>
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
    return
  }

  clearActiveAdminTab()
  updateAdminBrandModel()

  const counts = await getAdminCompletionCounts()

  const segmentCards = [
    {
      key: "warmup",
      title: "التسخين",
      desc: "أسئلة البداية السريعة",
      count: counts.warmup || 0
    },
    {
      key: "top10",
      title: "Top 10",
      desc: "ثلاث جولات ترتيب",
      count: counts.top10 || 0
    },
    {
      key: "auction",
      title: "فتبلة",
      desc: "أسئلة الصور والفتبلة",
      count: counts.auction || 0
    },
    {
      key: "who",
      title: "من هو",
      desc: "تخمين الشخصية",
      count: counts.who || 0
    },
    {
      key: "final",
      title: "الفاصلة",
      desc: "الجولات النهائية",
      count: counts.final || 0
    },
    {
      key: "archive",
      title: "الأرشيف",
      desc: "بطولات وأرشيف",
      count: counts.archive || 0
    }
  ]

  editor().innerHTML = `
    <div class="adminHomeShell">
      <div class="adminSegmentPickerCompact">
        ${segmentCards.map(item => {
          const done = isSegmentDone(item.key, item.count)

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
  clearActiveAdminTab()
  showAdminEmptyState()
  updateAdminBrandModel()
}

  await loadModels()
  showGameToast("تم حذف النموذج")
}

/* =========================
   Tabs
========================= */

async function openAdminSegment(segment) {
  if (!currentModel) {
    showGameToast("افتح نموذج أولاً")
    return
  }

  setActiveAdminTab(segment)

  if (segment === "warmup") await renderWarmupAdmin()
  if (segment === "top10") await renderTop10Admin()
  if (segment === "auction") await renderAuctionAdmin()
  if (segment === "who") await renderWhoAdmin()
  if (segment === "final") await renderFinalAdmin()
  if (segment === "archive") await renderArchiveAdmin()
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
  const ok = confirm("هل تريد حذف جميع أسئلة الفتبلة من قاعدة البيانات؟")
  if (!ok) return

  const { error } = await db
    .from("auction_questions")
    .delete()
    .eq("model", currentModel)

  if (error) {
    console.log(error)
    showGameToast("فشل حذف الفتبلة")
    return
  }

  showGameToast("تم حذف الفتبلة")
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
  const ok = confirm("هل تريد حذف فقرة الفاصلة كاملة؟")
  if (!ok) return

  await db.from("final_round_meta").delete().eq("model", currentModel)
  await db.from("final_round1_items").delete().eq("model", currentModel)
  await db.from("final_round2_items").delete().eq("model", currentModel)
  await db.from("final_round3_items").delete().eq("model", currentModel)

  showGameToast("تم حذف فقرة الفاصلة")
  await renderFinalAdmin()
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
  const note = document.getElementById(`auctionNote${i}`)

  if (q) q.value = ""
  if (a) a.value = ""
  if (note) note.value = ""

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
    <div class="warmupAdminShell">
      <div class="adminEditorTopBar">
        <div>
          <h2 class="adminSectionTitle">التسخين</h2>
          <div class="adminSectionSubTitle">تحرير أسئلة البداية بشكل مرتب وواضح</div>
        </div>
      </div>

      ${await buildSegmentStatusGrid()}

      <div class="warmupAdminGrid">
  `

  for (let c = 1; c <= 4; c++) {
    const cat = map[c] || { category_name: "", questions: {} }

    html += `
      <div class="adminCard warmupCategoryCard">
        <div class="warmupCategoryHead">
          <h3>الفئة ${c}</h3>
        </div>

        <div class="adminField">
          <label>اسم الفئة</label>
          <input
            id="cat${c}"
            placeholder="اسم الفئة"
            value="${escapeHtml(cat.category_name || "")}"
          >
        </div>

        <div class="adminQuestionCard warmupQuestionCard">
          <div class="adminQuestionCardTop">
            <div class="adminQuestionTitle">سؤال 1</div>
            <button class="adminDeleteBtn" onclick="clearWarmupQuestion(${c},1)">حذف</button>
          </div>

          <div class="adminField">
            <label>نص السؤال</label>
            <textarea id="q${c}_1" placeholder="سؤال 1">${escapeHtml(cat.questions[1]?.question || "")}</textarea>
          </div>

          <div class="adminField">
            <label>الإجابة</label>
            <input id="a${c}_1" placeholder="إجابة 1" value="${escapeHtml(cat.questions[1]?.answer || "")}">
          </div>
        </div>

        <div class="adminQuestionCard warmupQuestionCard">
          <div class="adminQuestionCardTop">
            <div class="adminQuestionTitle">سؤال 2</div>
            <button class="adminDeleteBtn" onclick="clearWarmupQuestion(${c},2)">حذف</button>
          </div>

          <div class="adminField">
            <label>نص السؤال</label>
            <textarea id="q${c}_2" placeholder="سؤال 2">${escapeHtml(cat.questions[2]?.question || "")}</textarea>
          </div>

          <div class="adminField">
            <label>الإجابة</label>
            <input id="a${c}_2" placeholder="إجابة 2" value="${escapeHtml(cat.questions[2]?.answer || "")}">
          </div>
        </div>

        <div class="adminQuestionCard warmupQuestionCard">
          <div class="adminQuestionCardTop">
            <div class="adminQuestionTitle">سؤال 4</div>
            <button class="adminDeleteBtn" onclick="clearWarmupQuestion(${c},4)">حذف</button>
          </div>

          <div class="adminField">
            <label>نص السؤال</label>
            <textarea id="q${c}_4" placeholder="سؤال 4">${escapeHtml(cat.questions[4]?.question || "")}</textarea>
          </div>

          <div class="adminField">
            <label>الإجابة</label>
            <input id="a${c}_4" placeholder="إجابة 4" value="${escapeHtml(cat.questions[4]?.answer || "")}">
          </div>
        </div>
      </div>
    `
  }

  html += `
      </div>

      <div class="adminActionRow">
        <button onclick="saveWarmup()" class="adminSaveBtn">حفظ التسخين</button>
        <button onclick="deleteWarmupSegment()" class="adminDeleteAllBtn">حذف الفقرة</button>
        <button onclick="renderWarmupAdmin()" class="adminReloadBtn">إعادة تحميل</button>
      </div>
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
    <div class="top10AdminShell">
      <div class="adminEditorTopBar">
        <div>
          <h2 class="adminSectionTitle">Top 10</h2>
          <div class="adminSectionSubTitle">تحرير جولات الترتيب بشكل واضح ومنظم</div>
        </div>
      </div>

      ${await buildSegmentStatusGrid()}

      <div class="top10AdminGrid">
  `

  for (let r = 1; r <= 3; r++) {
    const round = map[r] || { question: "", answers: {} }

    html += `
      <div class="adminCard top10RoundCard">
        <div class="adminQuestionCardTop top10RoundHead">
          <h3>الجولة ${r}</h3>
          <button class="adminDeleteBtn" onclick="clearTop10Round(${r})">حذف الجولة</button>
        </div>

        <div class="adminField">
          <label>السؤال الرئيسي</label>
          <input id="topq${r}" placeholder="السؤال" value="${escapeHtml(round.question || "")}">
        </div>

        <div class="top10AnswersGrid">
          ${Array.from({ length: 10 }, (_, i) => i + 1).map(i => `
            <div class="top10AnswerRow">
              <div class="top10AnswerNo">${i}</div>
              <input id="top${r}_${i}" placeholder="إجابة ${i}" value="${escapeHtml(round.answers[i] || "")}">
            </div>
          `).join("")}
        </div>
      </div>
    `
  }

  html += `
      </div>

      <div class="adminActionRow">
        <button onclick="saveTop10()" class="adminSaveBtn">حفظ Top 10</button>
        <button onclick="deleteTop10Segment()" class="adminDeleteAllBtn">حذف الفقرة</button>
        <button onclick="renderTop10Admin()" class="adminReloadBtn">إعادة تحميل</button>
      </div>
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
    showGameToast("تعذر تحميل الفقرة")
    return
  }

  const { data: settingsData, error: settingsError } = await db
    .from("segment_settings")
    .select("item_count")
    .eq("model", currentModel)
    .eq("segment", "auction")
    .maybeSingle()

  if (settingsError) {
    console.log(settingsError)
  }

  auctionAdminCount = Math.min(
    Math.max(Number(settingsData?.item_count || 8), 1),
    8
  )

  const map = {}
  ;(data || []).forEach(row => {
    map[row.number] = row
  })

  editor().innerHTML = `
    <div class="auctionAdminShell">
      <div class="adminEditorTopBar">
        <div>
          <h2 class="adminSectionTitle">فتبلة</h2>
          <div class="adminSectionSubTitle">تحرير أسئلة الصور والفتبلة بشكل منظم</div>
        </div>
      </div>

      ${await buildSegmentStatusGrid()}

      <div class="auctionTopCompactRow">
        <div class="auctionTopCompactBox auctionTopCompactTitleBox">
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
        </div>

        <div class="auctionTopCompactBox auctionTopCompactActionBox">
          <button onclick="applyAuctionCount()" class="adminBtn adminBtnMango compactCountBtn">تحديث العدد</button>
        </div>
      </div>

      <div class="auctionAdminGrid">
        ${Array.from({ length: auctionAdminCount }, (_, idx) => idx + 1).map(i => `
          <div class="adminCard auctionQuestionCard">
            <div class="adminQuestionCardTop auctionQuestionHead">
              <h3>السؤال ${i}</h3>
              <button class="adminDeleteBtn" onclick="clearAuctionQuestion(${i})">حذف</button>
            </div>

            <div class="adminField">
              <label>الصورة</label>
              <input type="file" id="auctionFile${i}" accept="image/*">
            </div>

            <div class="adminField">
              <label>السؤال</label>
              <textarea id="auction${i}" placeholder="السؤال">${escapeHtml(map[i]?.question || "")}</textarea>
            </div>

            <div class="adminField">
              <label>الإجابة</label>
              <input
                id="auctionAnswer${i}"
                placeholder="الإجابة"
                value="${escapeHtml(map[i]?.answer || "")}"
              >
            </div>

            <div class="adminField">
              <label>ملاحظة اختيارية</label>
              <input
                id="auctionNote${i}"
                placeholder="ملاحظة اختيارية"
                value="${escapeHtml(map[i]?.note || "")}"
              >
            </div>

            <div class="auctionPreviewBox">
              ${map[i]?.image ? `<img src="${escapeHtml(map[i].image)}" class="previewImg">` : ""}
            </div>
          </div>
        `).join("")}
      </div>

      <div class="adminActionRow">
        <button onclick="saveAuction()" class="adminSaveBtn">حفظ الفقرة</button>
        <button onclick="deleteAuctionSegment()" class="adminDeleteAllBtn">حذف الفقرة</button>
        <button onclick="renderAuctionAdmin()" class="adminReloadBtn">إعادة تحميل</button>
      </div>
    </div>
  `
}

function applyAuctionCount() {
  const count = Number(document.getElementById("auctionCountInput")?.value || 8)
  auctionAdminCount = Math.min(Math.max(count, 1), 8)
  renderAuctionAdminWithCount(auctionAdminCount)
  showGameToast("تم تحديث عدد الأسئلة")
}

async function renderAuctionAdminWithCount(count) {
  const { data, error } = await db
    .from("auction_questions")
    .select("*")
    .eq("model", currentModel)
    .order("number", { ascending: true })

  if (error) {
    console.log(error)
    showGameToast("تعذر تحميل الفقرة")
    return
  }

  const map = {}
  ;(data || []).forEach(row => {
    map[row.number] = row
  })

  auctionAdminCount = Math.min(Math.max(count, 1), 8)

  editor().innerHTML = `
    <div class="auctionAdminShell">
      <div class="adminEditorTopBar">
        <div>
          <h2 class="adminSectionTitle">فتبلة</h2>
          <div class="adminSectionSubTitle">تحرير أسئلة الصور والفتبلة بشكل منظم</div>
        </div>
      </div>

      ${await buildSegmentStatusGrid()}

      <div class="auctionTopCompactRow">
        <div class="auctionTopCompactBox auctionTopCompactTitleBox">
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
        </div>

        <div class="auctionTopCompactBox auctionTopCompactActionBox">
          <button onclick="applyAuctionCount()" class="adminBtn adminBtnMango compactCountBtn">تحديث العدد</button>
        </div>
      </div>

      <div class="auctionAdminGrid">
        ${Array.from({ length: auctionAdminCount }, (_, idx) => idx + 1).map(i => `
          <div class="adminCard auctionQuestionCard">
            <div class="adminQuestionCardTop auctionQuestionHead">
              <h3>السؤال ${i}</h3>
              <button class="adminDeleteBtn" onclick="clearAuctionQuestion(${i})">حذف</button>
            </div>

            <div class="adminField">
              <label>الصورة</label>
              <input type="file" id="auctionFile${i}" accept="image/*">
            </div>

            <div class="adminField">
              <label>السؤال</label>
              <textarea id="auction${i}" placeholder="السؤال">${escapeHtml(map[i]?.question || "")}</textarea>
            </div>

            <div class="adminField">
              <label>الإجابة</label>
              <input
                id="auctionAnswer${i}"
                placeholder="الإجابة"
                value="${escapeHtml(map[i]?.answer || "")}"
              >
            </div>

            <div class="adminField">
              <label>ملاحظة اختيارية</label>
              <input
                id="auctionNote${i}"
                placeholder="ملاحظة اختيارية"
                value="${escapeHtml(map[i]?.note || "")}"
              >
            </div>

            <div class="auctionPreviewBox">
              ${map[i]?.image ? `<img src="${escapeHtml(map[i].image)}" class="previewImg">` : ""}
            </div>
          </div>
        `).join("")}
      </div>

      <div class="adminActionRow">
        <button onclick="saveAuction()" class="adminSaveBtn">حفظ الفقرة</button>
        <button onclick="deleteAuctionSegment()" class="adminDeleteAllBtn">حذف الفقرة</button>
        <button onclick="renderAuctionAdmin()" class="adminReloadBtn">إعادة تحميل</button>
      </div>
    </div>
  `
}

async function saveAuction() {
  const count = Number(document.getElementById("auctionCountInput")?.value || auctionAdminCount || 8)
  const finalCount = Math.min(Math.max(count, 1), 8)

  const { data: oldRows, error: oldError } = await db
    .from("auction_questions")
    .select("number, image")
    .eq("model", currentModel)

  if (oldError) {
    console.log(oldError)
    showGameToast("تعذر قراءة البيانات القديمة")
    return
  }

  const oldMap = {}
  ;(oldRows || []).forEach(row => {
    oldMap[row.number] = row
  })

  const rows = []

  for (let i = 1; i <= finalCount; i++) {
    const file = document.getElementById(`auctionFile${i}`)?.files[0]
    const question = (document.getElementById(`auction${i}`)?.value || "").trim()
    const answer = (document.getElementById(`auctionAnswer${i}`)?.value || "").trim()
    const note = (document.getElementById(`auctionNote${i}`)?.value || "").trim()

    let image = oldMap[i]?.image || ""

    if (file) {
      image = await uploadImageFile(file, `auction_${i}`)
    }

    if (!question && !answer && !image && !note) continue

    rows.push({
      model: currentModel,
      number: i,
      question,
      answer,
      image,
      note
    })
  }

  const { error: delError } = await db
    .from("auction_questions")
    .delete()
    .eq("model", currentModel)

  if (delError) {
    console.log(delError)
    showGameToast("فشل حذف البيانات القديمة")
    return
  }

  if (rows.length) {
    const { error: insError } = await db
      .from("auction_questions")
      .insert(rows)

    if (insError) {
      console.log(insError)
      showGameToast("فشل حفظ الفقرة")
      return
    }
  }

  const { error: settingsError } = await db
    .from("segment_settings")
    .upsert(
      {
        model: currentModel,
        segment: "auction",
        item_count: finalCount
      },
      {
        onConflict: "model,segment"
      }
    )

  if (settingsError) {
    console.log(settingsError)
    showGameToast("تم حفظ الفقرة لكن تعذر حفظ عدد الأسئلة")
    return
  }

  auctionAdminCount = finalCount

  if (!rows.length) {
    showGameToast("تم حذف جميع الأسئلة")
  } else {
    showGameToast("تم حفظ الفقرة")
  }

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
    <div class="whoAdminShell">
      <div class="adminEditorTopBar">
        <div>
          <h2 class="adminSectionTitle">من هو</h2>
          <div class="adminSectionSubTitle">ارفع الصور واكتب الإجابات بشكل مرتب وسريع</div>
        </div>
      </div>

      ${await buildSegmentStatusGrid()}

      <div class="whoAdminGrid">
  `

  for (let i = 1; i <= 15; i++) {
    html += `
      <div class="adminCard whoItemCard">
        <div class="adminQuestionCardTop whoItemHead">
          <h3>رقم ${i}</h3>
          <button class="adminDeleteBtn" onclick="clearWhoItem(${i})">حذف</button>
        </div>

        <div class="adminField">
          <label>الصورة</label>
          <input type="file" id="who${i}" accept="image/*">
        </div>

        <div class="adminField">
          <label>الإجابة</label>
          <input
            id="whoAnswer${i}"
            placeholder="الإجابة"
            value="${escapeHtml(map[i]?.answer || "")}"
          >
        </div>

        <div class="whoPreviewBox">
          ${map[i]?.image ? `<img src="${escapeHtml(map[i].image)}" class="previewImg">` : ""}
        </div>
      </div>
    `
  }

  html += `
      </div>

      <div class="adminActionRow">
        <button onclick="saveWho()" class="adminSaveBtn">حفظ من هو</button>
        <button onclick="deleteWhoSegment()" class="adminDeleteAllBtn">حذف الفقرة</button>
        <button onclick="renderWhoAdmin()" class="adminReloadBtn">إعادة تحميل</button>
      </div>
    </div>
  `

  editor().innerHTML = html
}

async function saveWho() {
  const { data: oldRows, error: oldReadError } = await db
    .from("who_images")
    .select("*")
    .eq("model", currentModel)

  if (oldReadError) {
    console.log(oldReadError)
    showGameToast("تعذر قراءة بيانات من هو القديمة")
    return
  }

  const oldMap = {}
  ;(oldRows || []).forEach(row => {
    oldMap[row.number] = row
  })

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

    let image = oldMap[i]?.image || ""
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

  const round1CountBox = round === 1
  ? `
    <div class="finalTopCompactBox finalTopCompactCountBox">
      <div class="adminField compactCountField">
        <label>عدد الأرقام</label>
        <div class="compactCountSelectWrap">
          <select id="finalRound1CardsCount" class="compactCountSelect">
            <option value="4" ${Number(metaData?.cards_count || 4) === 4 ? "selected" : ""}>4</option>
            <option value="6" ${Number(metaData?.cards_count || 4) === 6 ? "selected" : ""}>6</option>
          </select>
        </div>
      </div>
    </div>
  `
  : `<div class="finalTopCompactBox finalTopCompactGhost"></div>`

  let html = `
    <div class="finalAdminShell cleanFinalAdminShell">
      <div class="adminEditorTopBar">
        <div>
          <h2 class="adminSectionTitle">الفاصلة</h2>
          <div class="adminSectionSubTitle">تحرير الجولات النهائية بشكل مرتب وواضح</div>
        </div>
      </div>

      ${await buildSegmentStatusGrid()}

      <div class="finalTopCompactRow">
        <div class="finalTopCompactBox finalTopCompactTitleBox">
          <div class="adminField">
            <label>اسم الجولة</label>
            <input
              id="finalRoundTitle"
              value="${escapeHtml(metaData?.title || `الجولة ${round}`)}"
              placeholder="اسم الجولة"
            >
          </div>
        </div>

        <div class="finalTopCompactBox finalTopCompactTabsBox">
          <div class="finalAdminRoundsBar cleanRoundsBar">
            <button class="${round === 1 ? "activeFinalAdminRound" : ""}" onclick="renderFinalAdminRound(1)">الجولة 1</button>
            <button class="${round === 2 ? "activeFinalAdminRound" : ""}" onclick="renderFinalAdminRound(2)">الجولة 2</button>
            <button class="${round === 3 ? "activeFinalAdminRound" : ""}" onclick="renderFinalAdminRound(3)">الجولة 3</button>
          </div>
        </div>

        ${round1CountBox}
      </div>
  `

  if (round === 1) {
    html += await buildFinalRound1Admin(metaData, true)
  }

  if (round === 2) {
    html += await buildFinalRound2Admin()
  }

  if (round === 3) {
    html += await buildFinalRound3Admin()
  }

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
}

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

  const cardsCount = Number(metaData?.cards_count || 4)

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
          isTextCard
            ? `
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
            `
            : ""
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

async function saveFinalRound1(cardsCount) {
  const finalCardsCount = Number(cardsCount || document.getElementById("finalRound1CardsCount")?.value || 4)

  const { data: oldRows, error: oldError } = await db
    .from("final_round1_items")
    .select("*")
    .eq("model", currentModel)

  if (oldError) {
    console.log(oldError)
    showGameToast("تعذر قراءة الجولة الأولى القديمة")
    return
  }

  const oldMap = {}
  ;(oldRows || []).forEach(row => {
    oldMap[row.number] = row
  })

  const rows = []

  for (let i = 1; i <= finalCardsCount; i++) {
    const file = document.getElementById(`finalRound1File_${i}`)?.files?.[0]
    const answer = (document.getElementById(`finalRound1Answer_${i}`)?.value || "").trim()
    const note = (document.getElementById(`finalRound1Note_${i}`)?.value || "").trim()
    const cardText = i <= 3
      ? (document.getElementById(`finalRound1CardText_${i}`)?.value || "").trim()
      : ""

    let image = oldMap[i]?.image || ""
    if (file) {
      image = await uploadImageFile(file, `final_r1_${i}`)
    }

    if (!image && !answer && !note && !cardText) continue

    rows.push({
      model: currentModel,
      number: i,
      image,
      answer,
      note,
      card_text: cardText
    })
  }

  const { error: delError } = await db
    .from("final_round1_items")
    .delete()
    .eq("model", currentModel)

  if (delError) {
    console.log(delError)
    showGameToast("تعذر حذف الجولة الأولى القديمة")
    return
  }

  if (!rows.length) {
    showGameToast("لا توجد بيانات للحفظ في الجولة الأولى")
    return
  }

  const { error: insError } = await db
    .from("final_round1_items")
    .insert(rows)

  if (insError) {
    console.log(insError)
    showGameToast("فشل حفظ الجولة الأولى")
    return
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
          <div class="finalAdminTypeBadge">${isScramble ? "كلمات مبعثرة" : "ترتيب / تسلسل"}</div>
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

  return `
    <div class="archiveAdminItem archiveAdminItemEnhanced ${isRequired ? "archiveAdminItemRequired" : ""}">
      <div class="archiveAdminItemHead">
        <div class="archiveAdminItemTitle">العنصر ${position}</div>
        ${isRequired ? `<div class="archiveAdminRequiredBadge">المطلوب</div>` : ""}
      </div>

      <div class="archiveAdminFields">
        <input
          id="archiveItemLabel_${position}"
          type="text"
          placeholder="عنوان صغير - مثال: المطلوب"
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

        <div></div>

        <textarea
          id="archiveItemText_${position}"
          placeholder="النص الذي سيظهر داخل البطاقة"
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
    <div class="archiveAdminShell cleanArchiveAdminShell">
      <div class="adminEditorTopBar">
        <div>
          <h2 class="adminSectionTitle">الأرشيف</h2>
          <div class="adminSectionSubTitle">حرر الجولة بشكل قريب من صفحة العرض حتى تكون القراءة أسهل</div>
        </div>
      </div>

      ${await buildSegmentStatusGrid()}

      <div class="archiveAdminRoundsBar cleanRoundsBar">
        <button class="${round === 1 ? "activeArchiveRoundBtn" : ""}" onclick="renderArchiveAdminRound(1)">الجولة 1</button>
        <button class="${round === 2 ? "activeArchiveRoundBtn" : ""}" onclick="renderArchiveAdminRound(2)">الجولة 2</button>
        <button class="${round === 3 ? "activeArchiveRoundBtn" : ""}" onclick="renderArchiveAdminRound(3)">الجولة 3</button>
        <button class="${round === 4 ? "activeArchiveRoundBtn" : ""}" onclick="renderArchiveAdminRound(4)">الجولة 4</button>
      </div>

      <div class="archiveAdminLayout cleanArchiveLayout">

        <div class="archiveAdminBoard ${round === 4 ? "archiveAdminBoardRound4" : ""} archiveAdminBoardClean">

          <div class="archiveAdminSketchTop archiveAdminSketchTopClean">
            <div class="archiveAdminSketchRow archiveDisplayLikeBox">
              <div class="archiveAdminLabel">البطولة</div>
              <div class="archiveAdminText">
                <input
                  id="archiveItemText_1"
                  type="text"
                  placeholder="مثال: دوري أبطال أوروبا"
                  value="${escapeHtml(archiveDraftState.__top?.text1 || map[1]?.text || "")}"
                >
              </div>
            </div>

            <div class="archiveAdminSketchRow archiveDisplayLikeBox">
              <div class="archiveAdminLabel">الموسم</div>
              <div class="archiveAdminText">
                <input
                  id="archiveItemText_2"
                  type="text"
                  placeholder="مثال: 2016 / 2017"
                  value="${escapeHtml(archiveDraftState.__top?.text2 || map[2]?.text || "")}"
                >
              </div>
            </div>
          </div>

          <div class="archiveAdminSketchMiddle archiveAdminSketchMiddleClean">
            <div class="archiveAdminImageBox archiveDisplayLikeBox">
              <div class="archiveAdminItemTitle">الصورة 4</div>
              <input id="archiveItemFile_4" type="file" accept="image/*">
              ${map[4]?.image ? `<img src="${escapeHtml(map[4].image)}" class="archiveAdminPreviewImg">` : ""}
            </div>

            <div class="archiveAdminResultCenter archiveDisplayLikeBox">
              <div class="archiveAdminResultLabel">النتيجة</div>
              <div class="archiveAdminResultValue">
                <input
                  id="archiveScore"
                  type="text"
                  placeholder="مثال: 3 - 1"
                  value="${escapeHtml(archiveDraftState.__top?.score || box?.score || "")}"
                >
              </div>
            </div>

            <div class="archiveAdminImageBox archiveDisplayLikeBox">
              <div class="archiveAdminItemTitle">الصورة 3</div>
              <input id="archiveItemFile_3" type="file" accept="image/*">
              ${map[3]?.image ? `<img src="${escapeHtml(map[3].image)}" class="archiveAdminPreviewImg">` : ""}
            </div>
          </div>

          <div class="archiveAdminBottomGrid archiveAdminBottomGridClean">
            <div class="archiveAdminBottomCol">
              <div class="archiveAdminColumnTitle">العناصر تحت الصورة 4</div>
              ${under4Positions.map(pos => renderArchiveAdminItem(pos, map[pos])).join("")}
            </div>

            <div class="archiveAdminBottomCol">
              <div class="archiveAdminColumnTitle">العناصر تحت الصورة 3</div>
              ${under3Positions.map(pos => renderArchiveAdminItem(pos, map[pos])).join("")}
            </div>
          </div>
        </div>

        <div class="archiveAdminTools archiveAdminToolsClean">
          <div class="adminCard archiveToolsCard">
            <h3>أدوات الجولة ${round}</h3>

            <div class="archiveToolsButtons archiveToolsButtonsClean">
              <button onclick="saveArchiveRoundNew()" class="adminSaveBtn">حفظ الجولة</button>
              <button onclick="addArchiveTextBox()" class="adminBtnMango">إضافة مربع نص</button>
              <button onclick="removeArchiveTextBox()" class="adminBtnLight">حذف آخر مربع</button>
              <button onclick="deleteArchiveSegment(${round})" class="adminDeleteBtn">حذف هذه الجولة</button>
              <button onclick="deleteArchiveSegment()" class="adminDeleteAllBtn">حذف جميع الجولات</button>
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

/* =========================
   PRESENTER PDF - CLEAN ONLY
========================= */

function presenterText(value) {
  return escapeHtml(value || "")
}

function presenterIsImageLike(value) {
  return typeof value === "string" &&
    /^(https?:\/\/|data:image\/|blob:|\/)/.test(String(value).trim())
}

function waitForPresenterImages(container) {
  const images = Array.from(container.querySelectorAll("img"))
  if (!images.length) return Promise.resolve()

  return Promise.all(
    images.map(img => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve()

      return new Promise(resolve => {
        img.onload = () => resolve()
        img.onerror = () => resolve()
      })
    })
  )
}

function sanitizeColorsForCanvas(root) {
  if (!root) return

  root.querySelectorAll("*").forEach(el => {
    const style = window.getComputedStyle(el)

    const props = [
      "color",
      "backgroundColor",
      "borderTopColor",
      "borderRightColor",
      "borderBottomColor",
      "borderLeftColor",
      "outlineColor",
      "textDecorationColor",
      "caretColor"
    ]

    props.forEach(prop => {
      const value = style[prop]

      if (typeof value === "string" && value.includes("color(")) {
        if (prop === "backgroundColor") {
          el.style.backgroundColor = "#ffffff"
        } else if (prop.includes("border")) {
          el.style[prop] = "#d9e0e0"
        } else {
          el.style[prop] = "#243447"
        }
      }
    })

    el.style.filter = "none"
    el.style.backdropFilter = "none"
    el.style.webkitBackdropFilter = "none"
  })
}

function getArchiveDisplayThemeClass(round) {
  if (Number(round) === 1) return "archiveThemeRound1"
  if (Number(round) === 2) return "archiveThemeRound2"
  if (Number(round) === 3) return "archiveThemeRound3"
  return "archiveThemeRound4"
}

function buildPresenterPage(title, bodyHtml, key = "") {
  return `
    <section class="presenterPdfPage" data-pdf-page="${presenterText(key || title)}">
      <div class="presenterPdfPageInner">
        <div class="presenterPdfPageHead">
          <div class="presenterPdfPageTitle">${presenterText(title)}</div>
          <div class="presenterPdfPageModel">${presenterText(getCurrentModelNameSafe())}</div>
        </div>

        <div class="presenterPdfPageContent">
          ${bodyHtml}
        </div>
      </div>
    </section>
  `
}

async function buildPresenterPagesHtml() {
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

  const normalizedWarmup = {}
warmupRows.forEach(row => {
  const categoryKey = String(row.category ?? "")
  if (!normalizedWarmup[categoryKey]) {
    normalizedWarmup[categoryKey] = {
      title: row.category_name || `الفئة ${row.category}`,
      items: []
    }
  }

  normalizedWarmup[categoryKey].items.push(row)
})

const warmupHtml = buildPresenterPage(
  "التسخين",
  `
    <div class="presenterWarmupGrid">
      ${[1, 2, 3, 4].map(category => {
        const rawGroup = normalizedWarmup[String(category)] || {
          title: `الفئة ${category}`,
          items: []
        }

        const uniqueMap = new Map()

        rawGroup.items.forEach(item => {
          const uniqueKey = [
            Number(item.number || 0),
            String(item.question || "").trim(),
            String(item.answer || "").trim()
          ].join("||")

          if (!uniqueMap.has(uniqueKey)) {
            uniqueMap.set(uniqueKey, item)
          }
        })

        const sortedItems = Array.from(uniqueMap.values())
          .sort((a, b) => Number(a.number) - Number(b.number))

        return `
          <div class="presenterWarmupCard">
            <div class="presenterWarmupCardHead">
              <div class="presenterWarmupCardTitle">${presenterText(rawGroup.title)}</div>
            </div>

            <div class="presenterWarmupCardBody">
              ${
                sortedItems.length
                  ? sortedItems.map(item => `
                      <div class="presenterWarmupLine">
                        <div class="presenterQaBadge">${item.number}</div>
                        <div class="presenterWarmupLineBody">
                          <div class="presenterQaQuestion">${presenterText(item.question)}</div>
                          <div class="presenterQaAnswer">الإجابة: ${presenterText(item.answer)}</div>
                        </div>
                      </div>
                    `).join("")
                  : `<div class="presenterEmpty">لا توجد أسئلة</div>`
              }
            </div>
          </div>
        `
      }).join("")}
    </div>
  `,
  "warmup"
)

  const groupedTop10 = {}
  top10Rows.forEach(row => {
    if (!groupedTop10[row.round]) {
      groupedTop10[row.round] = { question: "", items: [] }
    }
    if (row.question) groupedTop10[row.round].question = row.question
    groupedTop10[row.round].items.push(row)
  })

  const top10Html = [1, 2, 3].map(round => {
    const group = groupedTop10[round] || { question: "", items: [] }

    return buildPresenterPage(
      `Top 10 - الجولة ${round}`,
      `
        <div class="presenterWideQuestionBox">${presenterText(group.question)}</div>
        <div class="presenterAnswerGrid">
          ${group.items
            .sort((a, b) => Number(a.position) - Number(b.position))
            .map(item => `
              <div class="presenterAnswerCard">
                <div class="presenterQaBadge">${item.position}</div>
                <div class="presenterAnswerOnly">${presenterText(item.answer)}</div>
              </div>
            `).join("") || `<div class="presenterEmpty">لا توجد بيانات</div>`}
        </div>
      `,
      `top10-${round}`
    )
  }).join("")

  const auctionHtml = buildPresenterPage(
    "فتبلة",
    `
      <div class="presenterQaList presenterQaListOne">
        ${auctionRows.map(item => `
          <div class="presenterQaCard presenterQaCardFull">
            <div class="presenterQaBadge">${item.number}</div>
            <div class="presenterQaQuestion">${presenterText(item.question)}</div>
            <div class="presenterQaAnswer">الإجابة: ${presenterText(item.answer)}</div>
            ${item.note ? `<div class="presenterQaNote">ملاحظة: ${presenterText(item.note)}</div>` : ""}
          </div>
        `).join("") || `<div class="presenterEmpty">لا توجد بيانات</div>`}
      </div>
    `,
    "auction"
  )

  const whoHtml = buildPresenterPage(
  "من هو",
  `
    <div class="presenterWhoGrid">
      ${whoRows.map(item => `
        <div class="presenterWhoCard">
          <div class="presenterQaBadge">${item.number}</div>
          <div class="presenterAnswerOnly">${presenterText(item.answer)}</div>
        </div>
      `).join("") || `<div class="presenterEmpty">لا توجد بيانات</div>`}
    </div>
  `,
  "who"
)

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
    if (!item) return `<span>${presenterText(fallbackText)}</span>`

    const raw = item.image || item.text || ""
    if (presenterIsImageLike(raw)) {
      return `<img src="${presenterText(raw)}" alt="">`
    }

    return `<span>${presenterText(item.text || fallbackText)}</span>`
  }

  function renderBigValue(position) {
    const item = itemByPos[position]
    if (!item) return `<span>${position}</span>`

    const raw = item.image || item.text || ""
    if (presenterIsImageLike(raw)) {
      return `<img src="${presenterText(raw)}" alt="">`
    }

    return `<span>${presenterText(item.text || position)}</span>`
  }

  function renderBottomItem(item) {
    const labelText = (item.label || "").trim()
    const promptStyle = String(item.prompt_style || "shoe").trim().toLowerCase()
    const emoji = promptStyle === "ball" ? "⚽️" : "👟"
    const isWanted = labelText === "المطلوب"
    const displayText = (item.text || "").trim()

    return `
      <div class="presenterArchiveHintCard ${isWanted ? "wanted" : ""}">
        <div class="presenterArchiveHintText">${presenterText(displayText || labelText || "")}</div>
        <div class="presenterArchiveHintIcon">${emoji}</div>
      </div>
    `
  }

  return buildPresenterPage(
    `الأرشيف - الجولة ${round}`,
    `
      <div class="presenterArchiveBoard">
        <div class="presenterArchiveTop">
          <div class="presenterArchiveInfoCard">
            <div class="presenterArchiveInfoLabel">البطولة</div>
            <div class="presenterArchiveInfoValue">${renderPrimaryValue(1, box?.tournament || "")}</div>
          </div>

          <div class="presenterArchiveInfoCard">
            <div class="presenterArchiveInfoLabel">الموسم</div>
            <div class="presenterArchiveInfoValue">${renderPrimaryValue(2, box?.season || "")}</div>
          </div>
        </div>

        <div class="presenterArchiveMiddle">
          <div class="presenterArchiveBigCard">
            ${renderBigValue(4)}
          </div>

          <div class="presenterArchiveScoreCard">
            <div class="presenterArchiveScoreLabel">النتيجة</div>
            <div class="presenterArchiveScoreValue">${presenterText(box?.score || "-")}</div>
          </div>

          <div class="presenterArchiveBigCard">
            ${renderBigValue(3)}
          </div>
        </div>

        <div class="presenterArchiveBottom">
          <div class="presenterArchiveColumn">
            <div class="presenterArchiveColumnTitle">تحت الصورة 4</div>
            <div class="presenterArchiveHints">
              ${under4Items.length ? under4Items.map(renderBottomItem).join("") : `<div class="presenterEmpty">لا توجد عناصر</div>`}
            </div>
          </div>

          <div class="presenterArchiveColumn">
            <div class="presenterArchiveColumnTitle">تحت الصورة 3</div>
            <div class="presenterArchiveHints">
              ${under3Items.length ? under3Items.map(renderBottomItem).join("") : `<div class="presenterEmpty">لا توجد عناصر</div>`}
            </div>
          </div>
        </div>
      </div>
    `,
    `archive-${round}`
  )
}).join("")

  const finalMetaMap = {}
  finalMeta.forEach(row => {
    finalMetaMap[row.round] = row
  })

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

  const final1Html = buildPresenterPage(
    finalMetaMap[1]?.title || "الجولة الأولى",
    `
      <div class="presenterFinalCardGrid">
        ${finalRound1Rows.map(item => `
          <div class="presenterFinalImageCard">
            <div class="presenterFinalImageHead">رقم ${item.number}</div>
            <div class="presenterFinalImageBody">
              ${item.image ? `<img src="${presenterText(item.image)}" alt="">` : `<div class="presenterNoImage">لا توجد صورة</div>`}
              <div class="presenterQaAnswer">الإجابة: ${presenterText(item.answer)}</div>
              ${item.note ? `<div class="presenterQaNote">التوضيح: ${presenterText(item.note)}</div>` : ""}
            </div>
          </div>
        `).join("") || `<div class="presenterEmpty">لا توجد بيانات</div>`}
      </div>
    `,
    "final-1"
  )

  const final2Html = buildPresenterPage(
    finalMetaMap[2]?.title || "الجولة الثانية",
    `
      <div class="presenterFinalBlocks">
        ${[1, 2, 3, 4].map(number => {
          const rows = groupedFinal2[number] || []
          const isScramble = number === 1 || number === 3

          return `
            <div class="presenterSectionBlock">
              <div class="presenterSectionBlockHead">رقم ${number}</div>
              <div class="presenterMiniList">
                ${rows.map((row, idx) => `
                  <div class="presenterMiniLine">
                    <strong>${idx + 1})</strong>
                    <span>الكلمة: ${presenterText(row.prompt)}</span>
                    ${isScramble ? `<span>التلميحة: ${presenterText(row.hint)}</span>` : ""}
                    ${isScramble ? `<span>الإجابة: ${presenterText(row.answer)}</span>` : ""}
                  </div>
                `).join("") || `<div class="presenterEmpty">لا توجد بيانات</div>`}
              </div>
            </div>
          `
        }).join("")}
      </div>
    `,
    "final-2"
  )

  const final3Html = buildPresenterPage(
    finalMetaMap[3]?.title || "الجولة الثالثة",
    `
      <div class="presenterFinalCardGrid presenterFinalCardGridTwo">
        ${[1, 2].map(number => {
          const rows = groupedFinal3[number] || []

          return `
            <div class="presenterFinalImageCard">
              <div class="presenterFinalImageHead">رقم ${number}</div>
              <div class="presenterFinalImageBody">
                <div class="presenterFinalRound3List">
                  ${rows.map(row => `
                    <div class="presenterFinalRound3Item">
                      ${row.image ? `<img src="${presenterText(row.image)}" alt="">` : `<div class="presenterNoImage">لا توجد صورة</div>`}
                      <div class="presenterQaAnswer">الإجابة: ${presenterText(row.answer)}</div>
                      ${row.note ? `<div class="presenterQaNote">التوضيح: ${presenterText(row.note)}</div>` : ""}
                    </div>
                  `).join("")}
                </div>
              </div>
            </div>
          `
        }).join("") || `<div class="presenterEmpty">لا توجد بيانات</div>`}
      </div>
    `,
    "final-3"
  )

  return [warmupHtml, top10Html, auctionHtml, whoHtml, archiveHtml, final1Html, final2Html, final3Html].join("")
}

window.openPresenterSheet = function () {
  showGameToast("الحفظ أصبح PDF مباشر")
}

window.closePresenterSheet = function () {}

window.printPresenterSheet = async function () {
  if (!currentModel) {
    showGameToast("افتح نموذجًا أولاً")
    return
  }

  if (typeof html2canvas === "undefined") {
    showGameToast("html2canvas غير محمل")
    return
  }

  if (!window.jspdf || !window.jspdf.jsPDF) {
    showGameToast("jsPDF غير محمل")
    return
  }

  let exportRoot = null

  try {
    const pagesHtml = await buildPresenterPagesHtml()

    exportRoot = document.createElement("div")
    exportRoot.id = "presenterPdfExportRoot"
    exportRoot.style.position = "fixed"
    exportRoot.style.left = "-99999px"
    exportRoot.style.top = "0"
    exportRoot.style.width = "1240px"
    exportRoot.style.background = "#ffffff"
    exportRoot.style.direction = "rtl"
    exportRoot.style.zIndex = "-1"
    exportRoot.innerHTML = `<div class="presenterPdfPages">${pagesHtml}</div>`

    document.body.appendChild(exportRoot)
    exportRoot.classList.add("presenter-export-safe")

    sanitizeColorsForCanvas(exportRoot)

    await waitForPresenterImages(exportRoot)
    await new Promise(resolve => setTimeout(resolve, 1000))

    const pageNodes = Array.from(exportRoot.querySelectorAll("[data-pdf-page]"))
    if (!pageNodes.length) {
      throw new Error("لم يتم إنشاء صفحات التصدير")
    }

    const { jsPDF } = window.jspdf
    const pdf = new jsPDF("p", "mm", "a4")

    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 8
    const usableWidth = pageWidth - margin * 2
    const usableHeight = pageHeight - margin * 2

    for (let i = 0; i < pageNodes.length; i++) {
      const node = pageNodes[i]

      const canvas = await html2canvas(node, {
  backgroundColor: "#ffffff",
  scale: 2,
  useCORS: true,
  allowTaint: true,
  logging: false,
  imageTimeout: 0,
  scrollX: 0,
  scrollY: 0,
  width: node.scrollWidth,
  height: node.scrollHeight,
  windowWidth: node.scrollWidth,
  windowHeight: node.scrollHeight,
  onclone: (clonedDoc) => {
    injectPresenterSafeStyles(clonedDoc)

    const clonedRoot = clonedDoc.getElementById("presenterPdfExportRoot")
    if (clonedRoot) {
      clonedRoot.querySelectorAll("*").forEach(el => {
        el.style.filter = "none"
        el.style.backdropFilter = "none"
        el.style.webkitBackdropFilter = "none"
        el.style.textShadow = "none"
        el.style.boxShadow = "none"
      })
    }
  }
})


      const imgData = canvas.toDataURL("image/jpeg", 1.0)
      const imgWidthPx = canvas.width
      const imgHeightPx = canvas.height
      const imgHeightMm = (imgHeightPx * usableWidth) / imgWidthPx

      if (i > 0) pdf.addPage()

      if (imgHeightMm <= usableHeight) {
        pdf.addImage(imgData, "JPEG", margin, margin, usableWidth, imgHeightMm)
      } else {
        const pageCanvasHeightPx = Math.floor((usableHeight * imgWidthPx) / usableWidth)
        let offsetY = 0
        let first = true

        while (offsetY < imgHeightPx) {
          const sliceHeight = Math.min(pageCanvasHeightPx, imgHeightPx - offsetY)

          const sliceCanvas = document.createElement("canvas")
          sliceCanvas.width = imgWidthPx
          sliceCanvas.height = sliceHeight

          const ctx = sliceCanvas.getContext("2d")
          ctx.fillStyle = "#ffffff"
          ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height)

          ctx.drawImage(
            canvas,
            0, offsetY, imgWidthPx, sliceHeight,
            0, 0, imgWidthPx, sliceHeight
          )

          const sliceData = sliceCanvas.toDataURL("image/jpeg", 1.0)
          const sliceHeightMm = (sliceHeight * usableWidth) / imgWidthPx

          if (!first) pdf.addPage()
          pdf.addImage(sliceData, "JPEG", margin, margin, usableWidth, sliceHeightMm)

          offsetY += sliceHeight
          first = false
        }
      }
    }
    function injectPresenterSafeStyles(doc) {
  const style = doc.createElement("style")
  style.id = "presenter-export-safe-style"
  style.textContent = `
    #presenterPdfExportRoot,
    #presenterPdfExportRoot *{
      color: #243447 !important;
      background-image: none !important;
      text-shadow: none !important;
      box-shadow: none !important;
      filter: none !important;
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
      border-color: #d9e0e0 !important;
      outline-color: #d9e0e0 !important;
      text-decoration-color: #243447 !important;
      caret-color: #243447 !important;
    }

    #presenterPdfExportRoot{
      background: #ffffff !important;
    }

    #presenterPdfExportRoot .presenterPdfPage,
    #presenterPdfExportRoot .presenterPdfPageInner,
    #presenterPdfExportRoot .presenterPdfPageHead,
    #presenterPdfExportRoot .presenterPdfPageContent,
    #presenterPdfExportRoot .presenterSectionBlock,
    #presenterPdfExportRoot .presenterQaCard,
    #presenterPdfExportRoot .presenterAnswerCard,
    #presenterPdfExportRoot .presenterFinalImageCard,
    #presenterPdfExportRoot .presenterWideQuestionBox,
    #presenterPdfExportRoot .presenterMiniLine,
    #presenterPdfExportRoot .presenterFinalRound3Item,
    #presenterPdfExportRoot .presenterNoImage,
    #presenterPdfExportRoot .archiveBoard,
    #presenterPdfExportRoot .archiveModernBoard,
    #presenterPdfExportRoot .archiveModernInfoCard,
    #presenterPdfExportRoot .archiveModernBigCard,
    #presenterPdfExportRoot .archiveModernScoreCard,
    #presenterPdfExportRoot .archiveModernSmallCard,
    #presenterPdfExportRoot .archiveBottomCol,
    #presenterPdfExportRoot .archiveBottomGrid{
      background: #ffffff !important;
      background-image: none !important;
    }

    #presenterPdfExportRoot .presenterPdfPageModel,
    #presenterPdfExportRoot .presenterQaBadge{
      background: #2f4158 !important;
      color: #ffffff !important;
      border-color: #2f4158 !important;
    }

    #presenterPdfExportRoot .presenterQaAnswer{
      color: #ff9b51 !important;
    }

    #presenterPdfExportRoot .archiveWantedItem,
    #presenterPdfExportRoot .archiveAdminRequiredBadge{
      background: #ffd7b8 !important;
      color: #243447 !important;
      border-color: #ffd7b8 !important;
    }

    #presenterPdfExportRoot *::before,
    #presenterPdfExportRoot *::after{
      color: #243447 !important;
      background: transparent !important;
      background-image: none !important;
      box-shadow: none !important;
      text-shadow: none !important;
      border-color: #d9e0e0 !important;
    }
  `
  doc.head.appendChild(style)
}

    pdf.save(`presenter-sheet-${currentModel || "export"}.pdf`)
    showGameToast("تم حفظ PDF")
  } catch (error) {
    console.error("PRESENTER PDF ERROR:", error)
    showGameToast(`تعذر التصدير: ${error.message || error}`)
  } finally {
    if (exportRoot && exportRoot.parentNode) {
      exportRoot.parentNode.removeChild(exportRoot)
    }
  }
}
