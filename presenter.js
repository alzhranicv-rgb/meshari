let presenterSegment = null
let presenterModel = Number(
  localStorage.getItem("presenter_model") ||
  localStorage.getItem("current_model") ||
  1
)

let presenterTop10Round = 1
let presenterFinalRound = 1
let presenterArchiveRound = 1

/* =========================
   BASIC
========================= */

function showToast(text = "تم الإرسال") {
  const toast = document.getElementById("presenterToast")
  if (!toast) return

  toast.innerText = text
  toast.classList.add("show")

  setTimeout(() => {
    toast.classList.remove("show")
  }, 1100)
}

async function sendCommand(action, payload = {}) {
  if (!presenterSegment) {
    showToast("اختر الفقرة")
    return
  }

  if (!presenterModel) {
    showToast("اختر النموذج")
    return
  }

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

  if (presenterModel) {
    select.value = String(presenterModel)
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

function showPresenterHome() {
  presenterSegment = null

  document.getElementById("presenterHome").classList.remove("hidden")
  document.getElementById("presenterPanel").classList.add("hidden")
  document.getElementById("presenterBackBtn").classList.add("hidden")

  document.getElementById("presenterTitle").innerText = "لوحة المقدم"
  document.getElementById("presenterSubtitle").innerText = "اختر النموذج ثم الفقرة"
}

function openPresenterSegment(segment) {
  if (!presenterModel) {
    showToast("اختر النموذج أولاً")
    return
  }

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

/* =========================
   SHARED HTML
========================= */

function teamControls() {
  return `
    <div class="presenterTeams">
      <button class="presenterBtn orange" onclick="sendCommand('selectTeam',{team:'A'})">الفريق A</button>
      <button class="presenterBtn orange" onclick="sendCommand('selectTeam',{team:'B'})">الفريق B</button>
    </div>
  `
}

function resultControls() {
  return `
    <div class="presenterActions">
      <button class="presenterBtn gray" onclick="sendCommand('double')">دبل</button>
      <button class="presenterBtn red" onclick="sendCommand('wrong')">خطأ</button>
      <button class="presenterBtn green" onclick="sendCommand('correct')">صح</button>
    </div>
  `
}

function setTitle(title, subtitle = "") {
  document.getElementById("presenterTitle").innerText = title
  document.getElementById("presenterSubtitle").innerText = subtitle
}

/* =========================
   WARMUP
========================= */

function renderWarmupPresenter() {
  setTitle("التسخين", "الفئات والأسئلة")

  document.getElementById("presenterPanel").innerHTML = `
    ${teamControls()}
    ${resultControls()}

    <section class="presenterCard">
      <div class="presenterLabel">اختر السؤال</div>

      <div class="presenterGrid">
        ${[1,2,3,4].map(cat => `
          <button class="presenterNumberBtn" onclick="openWarmupQuestionPresenter(${cat},1)">ف${cat} / 1</button>
          <button class="presenterNumberBtn" onclick="openWarmupQuestionPresenter(${cat},2)">ف${cat} / 2</button>
          <button class="presenterNumberBtn" onclick="openWarmupQuestionPresenter(${cat},4)">ف${cat} / 4</button>
        `).join("")}
      </div>
    </section>

    <section class="presenterCard">
      <div class="presenterLabel">السؤال</div>
      <div class="presenterQuestionText" id="warmupPresenterQuestion">اختر سؤال</div>
    </section>

    <section class="presenterCard">
      <div class="presenterLabel">الإجابة</div>
      <div class="presenterAnswerText" id="warmupPresenterAnswer">—</div>
    </section>
  `
}

async function openWarmupQuestionPresenter(category, number) {
  sendCommand("openNumber", { category, number })

  const { data, error } = await db
    .from("questions")
    .select("question, answer")
    .eq("model", presenterModel)
    .eq("segment", "warmup")
    .eq("category", Number(category))
    .eq("number", Number(number))
    .limit(1)

  if (error) {
    console.log(error)
    showToast("تعذر تحميل السؤال")
    return
  }

  const row = data?.[0]

  document.getElementById("warmupPresenterQuestion").innerText =
    row?.question || "لا يوجد سؤال"

  document.getElementById("warmupPresenterAnswer").innerText =
    row?.answer || "—"
}

/* =========================
   TOP 10
========================= */

function renderTop10Presenter() {
  setTitle("Top 10", "الجولات والإجابات")

  document.getElementById("presenterPanel").innerHTML = `
    ${teamControls()}

    <section class="presenterCard">
      <div class="presenterLabel">الجولة</div>
      <div class="presenterRoundTabs">
        <button id="top10RoundBtn1" onclick="setPresenterTop10Round(1)">1</button>
        <button id="top10RoundBtn2" onclick="setPresenterTop10Round(2)">2</button>
        <button id="top10RoundBtn3" onclick="setPresenterTop10Round(3)">3</button>
      </div>
    </section>

    <section class="presenterCard">
      <div class="presenterLabel">فتح إجابة</div>
      <div class="presenterGrid">
        ${[1,2,3,4,5,6,7,8,9,10].map(n => `
          <button class="presenterNumberBtn" onclick="sendCommand('openNumber',{number:${n}})">${n}</button>
        `).join("")}
      </div>
    </section>

    <div class="presenterMiniActions">
      <button class="presenterBtn red" onclick="sendCommand('wrong')">خطأ</button>
      <button class="presenterBtn dark" onclick="sendCommand('showAnswer')">إظهار الكل</button>
    </div>

    <section class="presenterCard">
      <div class="presenterLabel">الإجابات</div>
      <div class="presenterList" id="top10PresenterAnswers">—</div>
    </section>
  `

  setPresenterTop10Round(presenterTop10Round)
}

function setPresenterTop10Round(round) {
  presenterTop10Round = Number(round)

  for (let i = 1; i <= 3; i++) {
    const btn = document.getElementById(`top10RoundBtn${i}`)
    if (btn) btn.classList.toggle("active", i === presenterTop10Round)
  }

  loadPresenterTop10Answers()
}

async function loadPresenterTop10Answers() {
  const box = document.getElementById("top10PresenterAnswers")
  if (!box) return

  box.innerHTML = "جاري التحميل..."

  const { data, error } = await db
    .from("top10_questions")
    .select("position, question, answer")
    .eq("model", presenterModel)
    .eq("round", presenterTop10Round)
    .order("position", { ascending: true })

  if (error) {
    console.log(error)
    box.innerHTML = "تعذر تحميل الإجابات"
    return
  }

  box.innerHTML = (data || []).map(item => `
    <div class="presenterListItem">
      <strong>${item.position}</strong> - ${item.answer || "-"}
    </div>
  `).join("")
}

/* =========================
   AUCTION
========================= */

function renderAuctionPresenter() {
  setTitle("فتبلة", "الأرقام والإجابة")

  document.getElementById("presenterPanel").innerHTML = `
    ${teamControls()}
    ${resultControls()}

    <section class="presenterCard">
      <div class="presenterLabel">اختر الرقم</div>
      <div class="presenterGrid four">
        ${[1,2,3,4,5,6,7,8].map(n => `
          <button class="presenterNumberBtn" onclick="openAuctionPresenter(${n})">${n}</button>
        `).join("")}
      </div>
    </section>

    <button class="presenterBtn dark" onclick="sendCommand('showAnswer')">إظهار الإجابة في العرض</button>

    <section class="presenterCard">
      <div class="presenterLabel">الإجابة</div>
      <div class="presenterAnswerText" id="auctionPresenterAnswer">—</div>
    </section>

    <section class="presenterCard">
      <div class="presenterLabel">ملاحظة</div>
      <div class="presenterNoteText" id="auctionPresenterNote">—</div>
    </section>
  `
}

async function openAuctionPresenter(number) {
  sendCommand("openNumber", { number })

  const { data, error } = await db
    .from("auction_questions")
    .select("answer, note")
    .eq("model", presenterModel)
    .eq("number", Number(number))
    .single()

  if (error) {
    console.log(error)
    showToast("تعذر تحميل الإجابة")
    return
  }

  document.getElementById("auctionPresenterAnswer").innerText = data?.answer || "—"
  document.getElementById("auctionPresenterNote").innerText = data?.note || "—"
}

/* =========================
   WHO
========================= */

function renderWhoPresenter() {
  setTitle("من هو", "الأرقام والإجابة")

  document.getElementById("presenterPanel").innerHTML = `
    ${teamControls()}

    <section class="presenterCard">
      <div class="presenterLabel">اختر النقاط</div>
      <div class="presenterGrid">
        ${[1,2,3,4,5].map(n => `
          <button class="presenterNumberBtn" onclick="sendCommand('setPoints',{points:${n}})">${n}</button>
        `).join("")}
      </div>
    </section>

    ${resultControls()}

    <section class="presenterCard">
      <div class="presenterLabel">اختر الرقم</div>
      <div class="presenterGrid">
        ${Array.from({ length:15 }, (_,i) => i + 1).map(n => `
          <button class="presenterNumberBtn" onclick="openWhoPresenter(${n})">${n}</button>
        `).join("")}
      </div>
    </section>

    <button class="presenterBtn dark" onclick="sendCommand('showAnswer')">إظهار الإجابة في العرض</button>

    <section class="presenterCard">
      <div class="presenterLabel">الإجابة</div>
      <div class="presenterAnswerText" id="whoPresenterAnswer">—</div>
    </section>
  `
}

async function openWhoPresenter(number) {
  sendCommand("openNumber", { number })

  const { data, error } = await db
    .from("who_images")
    .select("answer")
    .eq("model", presenterModel)
    .eq("number", Number(number))
    .single()

  if (error) {
    console.log(error)
    showToast("تعذر تحميل الإجابة")
    return
  }

  document.getElementById("whoPresenterAnswer").innerText = data?.answer || "—"
}

/* =========================
   FINAL
========================= */

function renderFinalPresenter() {
  setTitle("الفاصلة", "الجولات والتحكم")

  document.getElementById("presenterPanel").innerHTML = `
    ${teamControls()}
    ${resultControls()}

    <section class="presenterCard">
      <div class="presenterLabel">الجولة</div>
      <div class="presenterRoundTabs">
        <button id="finalRoundBtn1" onclick="setPresenterFinalRound(1)">1</button>
        <button id="finalRoundBtn2" onclick="setPresenterFinalRound(2)">2</button>
        <button id="finalRoundBtn3" onclick="setPresenterFinalRound(3)">3</button>
      </div>
    </section>

    <section class="presenterCard">
      <div class="presenterLabel">فتح رقم</div>
      <div class="presenterGrid" id="finalPresenterNumbers"></div>
    </section>

    <div class="presenterMiniActions">
      <button class="presenterBtn blue" onclick="sendCommand('showQuestion')">إظهار السؤال</button>
      <button class="presenterBtn dark" onclick="sendCommand('showAnswer')">إظهار الإجابة</button>
    </div>

    <section class="presenterCard">
      <div class="presenterLabel">الإجابات / المعلومات</div>
      <div class="presenterList" id="finalPresenterAnswers">—</div>
    </section>
  `

  setPresenterFinalRound(presenterFinalRound)
}

function setPresenterFinalRound(round) {
  presenterFinalRound = Number(round)

  for (let i = 1; i <= 3; i++) {
    const btn = document.getElementById(`finalRoundBtn${i}`)
    if (btn) btn.classList.toggle("active", i === presenterFinalRound)
  }

  renderFinalPresenterNumbers()
  loadPresenterFinalAnswers()
}

function renderFinalPresenterNumbers() {
  const box = document.getElementById("finalPresenterNumbers")
  if (!box) return

  let nums = [1,2,3,4,5,6]
  if (presenterFinalRound === 2) nums = [1,2,3,4]
  if (presenterFinalRound === 3) nums = [1,2]

  box.className = presenterFinalRound === 3 ? "presenterGrid two" : "presenterGrid"

  box.innerHTML = nums.map(n => `
    <button class="presenterNumberBtn" onclick="openFinalPresenter(${n})">${n}</button>
  `).join("")
}

async function openFinalPresenter(number) {
  sendCommand("openNumber", { number, round: presenterFinalRound })
  loadPresenterFinalAnswers(number)
}

async function loadPresenterFinalAnswers(number = null) {
  const box = document.getElementById("finalPresenterAnswers")
  if (!box) return

  box.innerHTML = "جاري التحميل..."

  if (presenterFinalRound === 1) {
    let query = db
      .from("final_round1_items")
      .select("number, answer, note, card_text, question_part1, question_part2, question_part3")
      .eq("model", presenterModel)
      .order("number", { ascending: true })

    if (number) query = query.eq("number", Number(number))

    const { data, error } = await query

    if (error) {
      console.log(error)
      box.innerHTML = "تعذر تحميل البيانات"
      return
    }

    box.innerHTML = (data || []).map(item => `
      <div class="presenterListItem">
        <strong>${item.number}</strong><br>
        السؤال: ${[item.question_part1, item.question_part2, item.question_part3].filter(Boolean).join(" / ") || item.card_text || "-"}<br>
        الإجابة: ${item.answer || "-"}<br>
        ${item.note ? `ملاحظة: ${item.note}` : ""}
      </div>
    `).join("")
    return
  }

  if (presenterFinalRound === 2) {
    box.innerHTML = `
      <div class="presenterListItem">الجولة الثانية: يتم التحكم من شاشة العرض حسب نوع الرقم.</div>
    `
    return
  }

  if (presenterFinalRound === 3) {
    box.innerHTML = `
      <div class="presenterListItem">الجولة الثالثة: بعد عرض الصور اضغط إظهار الإجابة ثم سجل النتيجة.</div>
    `
  }
}

/* =========================
   ARCHIVE
========================= */

function renderArchivePresenter() {
  setTitle("الأرشيف", "الجولات والأرقام")

  document.getElementById("presenterPanel").innerHTML = `
    ${teamControls()}

    <div class="presenterMiniActions">
      <button class="presenterBtn red" onclick="sendCommand('wrong')">خطأ</button>
      <button class="presenterBtn green" onclick="sendCommand('correct')">إظهار المطلوب / صح</button>
    </div>

    <section class="presenterCard">
      <div class="presenterLabel">الجولة</div>
      <div class="presenterRoundTabs">
        <button id="archiveRoundBtn1" onclick="setPresenterArchiveRound(1)">1</button>
        <button id="archiveRoundBtn2" onclick="setPresenterArchiveRound(2)">2</button>
        <button id="archiveRoundBtn3" onclick="setPresenterArchiveRound(3)">3</button>
      </div>
    </section>

    <section class="presenterCard">
      <div class="presenterLabel">فتح رقم</div>
      <div class="presenterGrid">
        ${[1,2,3,4,5,6,7,8,9,10].map(n => `
          <button class="presenterNumberBtn" onclick="sendCommand('openNumber',{number:${n}})">${n}</button>
        `).join("")}
      </div>
    </section>

    <section class="presenterCard">
      <div class="presenterLabel">ملاحظة</div>
      <div class="presenterNoteText">الأرشيف يعتمد على الجولة المفتوحة في شاشة العرض.</div>
    </section>
  `

  setPresenterArchiveRound(presenterArchiveRound)
}

function setPresenterArchiveRound(round) {
  presenterArchiveRound = Number(round)

  for (let i = 1; i <= 3; i++) {
    const btn = document.getElementById(`archiveRoundBtn${i}`)
    if (btn) btn.classList.toggle("active", i === presenterArchiveRound)
  }
}

/* =========================
   INIT
========================= */

document.addEventListener("DOMContentLoaded", () => {
  loadPresenterModels()
})