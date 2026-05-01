let presenterSegment = null
let presenterModel = Number(localStorage.getItem("presenter_model") || localStorage.getItem("current_model") || 1)

function showToast(text = "تم الإرسال") {
  const toast = document.getElementById("presenterToast")
  if (!toast) return
  toast.innerText = text
  toast.classList.add("show")
  setTimeout(() => toast.classList.remove("show"), 1100)
}

async function sendCommand(action, payload = {}) {
  if (!presenterSegment) return

  const { error } = await db.from("presenter_commands").insert({
    model: presenterModel,
    segment: presenterSegment,
    action,
    payload
  })

  if (error) {
    console.log(error)
    showToast("فشل الإرسال")
    return
  }

  showToast("تم الإرسال")
}

function showPresenterHome() {
  presenterSegment = null
  document.getElementById("presenterHome").classList.remove("hidden")
  document.getElementById("presenterPanel").classList.add("hidden")
  document.getElementById("presenterBackBtn").classList.add("hidden")
  document.getElementById("presenterTitle").innerText = "لوحة المقدم"
}

function openPresenterSegment(segment) {
  presenterSegment = segment
  document.getElementById("presenterHome").classList.add("hidden")
  document.getElementById("presenterPanel").classList.remove("hidden")
  document.getElementById("presenterBackBtn").classList.remove("hidden")

  if (segment === "warmup") renderWarmupPresenter()
  if (segment === "top10") renderTop10Presenter()
  if (segment === "auction") renderAuctionPresenter()
  if (segment === "who") renderWhoPresenter()
  if (segment === "final") renderFinalPresenter()
  if (segment === "archive") renderArchivePresenter()
}

function teamControls() {
  return `
    <div class="teamRow">
      <button onclick="sendCommand('selectTeam',{team:'A'})">الفريق A</button>
      <button onclick="sendCommand('selectTeam',{team:'B'})">الفريق B</button>
    </div>
  `
}

function resultControls() {
  return `
    <div class="actionRow three">
      <button class="gray" onclick="sendCommand('double')">دبل</button>
      <button class="red" onclick="sendCommand('wrong')">خطأ</button>
      <button class="green" onclick="sendCommand('correct')">صح</button>
    </div>
  `
}
async function loadPresenterModels() {
  const select = document.getElementById("presenterModelSelect")
  if (!select) return

  const { data, error } = await db
    .from("models")
    .select("id, name")
    .order("id", { ascending: true })

  if (error) {
    console.log(error)
    showToast("تعذر تحميل النماذج")
    return
  }

  select.innerHTML = `<option value="">اختر النموذج</option>`

  ;(data || []).forEach(model => {
    select.innerHTML += `
      <option value="${model.id}">
        ${model.name || `النموذج ${model.id}`}
      </option>
    `
  })

  const savedModel = localStorage.getItem("presenter_model")
  if (savedModel) {
    select.value = savedModel
    presenterModel = Number(savedModel)
  }
}

function setPresenterModel() {
  const value = document.getElementById("presenterModelSelect")?.value

  if (!value) {
    showToast("اختر النموذج")
    return
  }

  presenterModel = Number(value)
  localStorage.setItem("presenter_model", value)
  showToast("تم اختيار النموذج")
}

document.addEventListener("DOMContentLoaded", () => {
  loadPresenterModels()
})
/* =========================
   WARMUP
========================= */

function renderWarmupPresenter() {
  document.getElementById("presenterTitle").innerText = "التسخين"

  document.getElementById("presenterPanel").innerHTML = `
    ${teamControls()}
    ${resultControls()}

    <div class="card">
      <div class="label">اختر السؤال</div>
      <div class="numberGrid">
        ${[1,2,3,4].map(cat => `
          <button onclick="openWarmupCat(${cat},1)">ف${cat} - 1</button>
          <button onclick="openWarmupCat(${cat},2)">ف${cat} - 2</button>
          <button onclick="openWarmupCat(${cat},4)">ف${cat} - 4</button>
        `).join("")}
      </div>
    </div>

    <div class="card">
      <div class="label">السؤال</div>
      <div class="questionText" id="presenterQuestionText">اختر سؤال</div>
    </div>

    <div class="card">
      <div class="label">الإجابة</div>
      <div class="answerText" id="presenterAnswerText">—</div>
    </div>
  `
}

async function openWarmupCat(category, number) {
  sendCommand("openNumber", { category, number })

  const { data } = await db
    .from("questions")
    .select("question, answer")
    .eq("model", presenterModel)
    .eq("segment", "warmup")
    .eq("category", category)
    .eq("number", number)
    .limit(1)

  const row = data?.[0]
  document.getElementById("presenterQuestionText").innerText = row?.question || "لا يوجد سؤال"
  document.getElementById("presenterAnswerText").innerText = row?.answer || "—"
}

/* =========================
   TOP 10
========================= */

function renderTop10Presenter() {
  document.getElementById("presenterTitle").innerText = "Top 10"

  document.getElementById("presenterPanel").innerHTML = `
    ${teamControls()}

    <div class="card">
      <div class="label">الجولة</div>
      <select id="top10Round" onchange="loadTop10Answers()">
        <option value="1">الجولة 1</option>
        <option value="2">الجولة 2</option>
        <option value="3">الجولة 3</option>
      </select>
    </div>

    <div class="card">
      <div class="label">الأرقام</div>
      <div class="numberGrid">
        ${[1,2,3,4,5,6,7,8,9,10].map(n => `
          <button onclick="sendCommand('openNumber',{number:${n}})">${n}</button>
        `).join("")}
      </div>
    </div>

    <div class="actionRow">
      <button class="red" onclick="sendCommand('wrong')">خطأ</button>
      <button onclick="sendCommand('showAnswer')">إظهار كل الإجابات</button>
    </div>

    <div class="card">
      <div class="label">الإجابات</div>
      <div id="top10Answers" class="answerText">—</div>
    </div>
  `

  loadTop10Answers()
}

async function loadTop10Answers() {
  const round = Number(document.getElementById("top10Round")?.value || 1)

  const { data } = await db
    .from("top10_questions")
    .select("position, answer")
    .eq("model", presenterModel)
    .eq("round", round)
    .order("position", { ascending:true })

  document.getElementById("top10Answers").innerHTML = (data || [])
    .map(x => `${x.position} - ${x.answer || "-"}`)
    .join("<br>")
}

/* =========================
   AUCTION
========================= */

function renderAuctionPresenter() {
  document.getElementById("presenterTitle").innerText = "فتبلة"

  document.getElementById("presenterPanel").innerHTML = `
    ${teamControls()}
    ${resultControls()}

    <div class="card">
      <div class="label">اختر الرقم</div>
      <div class="numberGrid">
        ${[1,2,3,4,5,6,7,8].map(n => `
          <button onclick="openAuctionPresenter(${n})">${n}</button>
        `).join("")}
      </div>
    </div>

    <button onclick="sendCommand('showAnswer')">إظهار الإجابة في العرض</button>

    <div class="card">
      <div class="label">الإجابة</div>
      <div class="answerText" id="auctionAnswer">—</div>
    </div>

    <div class="card">
      <div class="label">ملاحظة</div>
      <div class="questionText" id="auctionNote">—</div>
    </div>
  `
}

async function openAuctionPresenter(number) {
  sendCommand("openNumber", { number })

  const { data } = await db
    .from("auction_questions")
    .select("answer, note")
    .eq("model", presenterModel)
    .eq("number", number)
    .single()

  document.getElementById("auctionAnswer").innerText = data?.answer || "—"
  document.getElementById("auctionNote").innerText = data?.note || "—"
}

/* =========================
   WHO
========================= */

function renderWhoPresenter() {
  document.getElementById("presenterTitle").innerText = "من هو"

  document.getElementById("presenterPanel").innerHTML = `
    ${teamControls()}
    ${resultControls()}

    <div class="card">
      <div class="label">اختر الرقم</div>
      <div class="numberGrid">
        ${Array.from({length:15},(_,i)=>i+1).map(n => `
          <button onclick="openWhoPresenter(${n})">${n}</button>
        `).join("")}
      </div>
    </div>

    <button onclick="sendCommand('showAnswer')">إظهار الإجابة في العرض</button>

    <div class="card">
      <div class="label">الإجابة</div>
      <div class="answerText" id="whoAnswerText">—</div>
    </div>
  `
}

async function openWhoPresenter(number) {
  sendCommand("openNumber", { number })

  const { data } = await db
    .from("who_images")
    .select("answer")
    .eq("model", presenterModel)
    .eq("number", number)
    .single()

  document.getElementById("whoAnswerText").innerText = data?.answer || "—"
}

/* =========================
   FINAL
========================= */

function renderFinalPresenter() {
  document.getElementById("presenterTitle").innerText = "الفاصلة"

  document.getElementById("presenterPanel").innerHTML = `
    ${teamControls()}
    ${resultControls()}

    <div class="card">
      <div class="label">رقم الجولة</div>
      <select id="finalRoundSelect">
        <option value="1">الجولة 1</option>
        <option value="2">الجولة 2</option>
        <option value="3">الجولة 3</option>
      </select>
    </div>

    <div class="card">
      <div class="label">فتح رقم</div>
      <div class="numberGrid">
        ${[1,2,3,4,5,6].map(n => `
          <button onclick="openFinalPresenter(${n})">${n}</button>
        `).join("")}
      </div>
    </div>

    <div class="actionRow">
      <button onclick="sendCommand('showQuestion')">إظهار السؤال</button>
      <button onclick="sendCommand('showAnswer')">إظهار الإجابة</button>
    </div>

    <div class="card">
      <div class="label">الإجابة</div>
      <div class="answerText" id="finalAnswerText">—</div>
    </div>
  `
}

async function openFinalPresenter(number) {
  sendCommand("openNumber", { number })

  const round = Number(document.getElementById("finalRoundSelect")?.value || 1)

  if (round === 1) {
    const { data } = await db
      .from("final_round1_items")
      .select("answer")
      .eq("model", presenterModel)
      .eq("number", number)
      .single()

    document.getElementById("finalAnswerText").innerText = data?.answer || "—"
  }
}

/* =========================
   ARCHIVE
========================= */

function renderArchivePresenter() {
  document.getElementById("presenterTitle").innerText = "الأرشيف"

  document.getElementById("presenterPanel").innerHTML = `
    ${teamControls()}

    <div class="actionRow">
      <button class="red" onclick="sendCommand('wrong')">خطأ</button>
      <button class="green" onclick="sendCommand('correct')">إظهار المطلوب / صح</button>
    </div>

    <div class="card">
      <div class="label">فتح رقم</div>
      <div class="numberGrid">
        ${[1,2,3,4,5,6,7,8,9,10].map(n => `
          <button onclick="sendCommand('openNumber',{number:${n}})">${n}</button>
        `).join("")}
      </div>
    </div>
  `
}