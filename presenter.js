let presenterSegment = null
let presenterModel = Number(
  localStorage.getItem("presenter_model") ||
  localStorage.getItem("current_model") ||
  localStorage.getItem("game_model") ||
  1
)

let presenterTeamAName = localStorage.getItem("teamAName") || "الفريق الأول"
let presenterTeamBName = localStorage.getItem("teamBName") || "الفريق الثاني"

let presenterSelectedTeam = null
let presenterTop10Round = 1
let presenterFinalRound = 1
let presenterArchiveRound = 1

function refreshPresenterTeamNames() {
  presenterTeamAName = localStorage.getItem("teamAName") || "الفريق الأول"
  presenterTeamBName = localStorage.getItem("teamBName") || "الفريق الثاني"

  const a = document.getElementById("presenterTeamA")
  const b = document.getElementById("presenterTeamB")

  if (a) a.innerText = presenterTeamAName
  if (b) b.innerText = presenterTeamBName
}

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

async function sendGlobalDisplayControlsToggle() {
  const oldSegment = presenterSegment
  presenterSegment = "global"
  await sendCommand("toggleDisplayControls")
  presenterSegment = oldSegment
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
  presenterSelectedTeam = null

  document.getElementById("presenterHome").classList.remove("hidden")
  document.getElementById("presenterPanel").classList.add("hidden")
  document.getElementById("presenterBackBtn").classList.add("hidden")

  document.getElementById("presenterTitle").innerText = "لوحة المقدم"
  document.getElementById("presenterSubtitle").innerText = "اختر النموذج ثم الفقرة"
}

function openPresenterSegment(segment) {
  refreshPresenterTeamNames()

  if (!presenterModel) {
    showToast("اختر النموذج أولاً")
    return
  }

  presenterSegment = segment
  presenterSelectedTeam = null

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

function setTitle(title, subtitle = "") {
  document.getElementById("presenterTitle").innerText = title
  document.getElementById("presenterSubtitle").innerText = subtitle
}

/* =========================
   SHARED HTML
========================= */

function presenterTopControls() {
  return `
    <div class="presenterOneAction">
      <button class="presenterBtn red" onclick="sendCommand('endSegment')">إنهاء الفقرة</button>
    </div>
  `
}

function presenterTeamControls() {
  refreshPresenterTeamNames()

  return `
    <div class="presenterTeams">
      <button id="presenterTeamA" class="presenterBtn orange" onclick="selectPresenterTeam('A')">
        ${presenterTeamAName}
      </button>
      <button id="presenterTeamB" class="presenterBtn orange" onclick="selectPresenterTeam('B')">
        ${presenterTeamBName}
      </button>
    </div>
  `
}

function selectPresenterTeam(team) {
  presenterSelectedTeam = team

  document.getElementById("presenterTeamA")?.classList.remove("selectedPresenterTeam")
  document.getElementById("presenterTeamB")?.classList.remove("selectedPresenterTeam")

  if (team === "A") document.getElementById("presenterTeamA")?.classList.add("selectedPresenterTeam")
  if (team === "B") document.getElementById("presenterTeamB")?.classList.add("selectedPresenterTeam")

  sendCommand("selectTeam", { team })
}

function resultControls() {
  return `
    <div class="presenterActions">
      <button class="presenterBtn gray" onclick="sendCommand('double')">دبل</button>
      <button class="presenterBtn red" onclick="sendCommand('wrong')">خطأ</button>
      <button class="presenterBtn green" onclick="presenterCorrect()">إجابة صحيحة</button>
    </div>
  `
}

/* =========================
   WARMUP
========================= */

async function renderWarmupPresenter() {
  setTitle("التسخين", "الفئات والأسئلة")

  const categories = await loadPresenterWarmupCategories()

  document.getElementById("presenterPanel").innerHTML = `
    ${presenterTopControls()}
    ${presenterTeamControls()}
    ${resultControls()}

    <section class="presenterCard">
      <div class="presenterLabel">أسئلة التسخين</div>

      <div class="presenterWarmupCats">
        ${[1,2,3,4].map(cat => `
          <div class="presenterWarmupCat">
            <div class="presenterWarmupCatTitle">${categories[cat] || `الفئة ${cat}`}</div>

            <div class="presenterWarmupNumbers">
              <button id="pw_${cat}_1" class="presenterNumberBtn" onclick="openWarmupQuestionPresenter(${cat},1)">1</button>
              <button id="pw_${cat}_2" class="presenterNumberBtn" onclick="openWarmupQuestionPresenter(${cat},2)">2</button>
              <button id="pw_${cat}_4" class="presenterNumberBtn" onclick="openWarmupQuestionPresenter(${cat},4)">4</button>
            </div>
          </div>
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

async function loadPresenterWarmupCategories() {
  const { data, error } = await db
    .from("questions")
    .select("category, category_name")
    .eq("model", presenterModel)
    .eq("segment", "warmup")
    .order("category", { ascending: true })

  if (error) {
    console.log(error)
    return {}
  }

  const categories = {}

  ;(data || []).forEach(row => {
    if (row.category) {
      categories[Number(row.category)] = row.category_name || `الفئة ${row.category}`
    }
  })

  return categories
}

async function openWarmupQuestionPresenter(category, number) {
  const btn = document.getElementById(`pw_${category}_${number}`)

  if (btn?.classList.contains("usedPresenterNumber")) {
    showToast("السؤال مستخدم")
    return
  }

  sendCommand("openNumber", { category, number })

  if (btn) {
    btn.classList.add("usedPresenterNumber")
    btn.disabled = true
    btn.innerText = ""
  }

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
  setTitle("Top 10", "لوحة التحكم والإجابات")

  document.getElementById("presenterPanel").innerHTML = `
    ${presenterTopControls()}
    ${presenterTeamControls()}

    <section class="presenterCard">
      <div class="presenterLabel">الجولة</div>
      <div class="presenterRoundTabs">
        <button id="top10RoundBtn1" onclick="setPresenterTop10Round(1)">1</button>
        <button id="top10RoundBtn2" onclick="setPresenterTop10Round(2)">2</button>
        <button id="top10RoundBtn3" onclick="setPresenterTop10Round(3)">3</button>
      </div>
    </section>

    <section class="presenterCard">
      <div class="presenterLabel">الأرقام</div>
      <div class="presenterGrid">
        ${[1,2,3,4,5,6,7,8,9,10].map(n => `
          <button class="presenterNumberBtn" onclick="sendCommand('openNumber',{number:${n}, round:presenterTop10Round})">${n}</button>
        `).join("")}
      </div>
    </section>

    <div class="presenterActions">
      <button class="presenterBtn dark" onclick="sendCommand('startTimer')">بدء المؤقت</button>
      <button class="presenterBtn dark" onclick="sendCommand('showAnswer')">إظهار الإجابات</button>
      <button class="presenterBtn red" onclick="sendCommand('wrong')">خطأ</button>
    </div>

    <div class="presenterMiniActions">
      <button class="presenterBtn gray" onclick="sendCommand('undo')">تراجع</button>
      <button class="presenterBtn blue" onclick="sendCommand('switchTurn')">تبديل الدور</button>
    </div>

    <button class="presenterBtn blue" onclick="sendCommand('nextRound')">الجولة التالية</button>

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
    .select("position, answer")
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
  setTitle("فتبلة", "لوحة التحكم والإجابة")

  document.getElementById("presenterPanel").innerHTML = `
    ${presenterTopControls()}
    ${presenterTeamControls()}

    <section class="presenterCard">
      <div class="presenterLabel">اختر الرقم</div>
      <div class="presenterGrid four">
        ${[1,2,3,4,5,6,7,8].map(n => `
          <button class="presenterNumberBtn" onclick="openAuctionPresenter(${n})">${n}</button>
        `).join("")}
      </div>
    </section>

    <div class="presenterActions">
      <button class="presenterBtn dark" onclick="sendCommand('startTimer')">بدء المؤقت</button>
      <button class="presenterBtn dark" onclick="sendCommand('showAnswer')">إظهار الإجابة</button>
      <button class="presenterBtn green" onclick="presenterCorrect()">إجابة صحيحة</button>
    </div>

    <div class="presenterMiniActions">
      <button class="presenterBtn red" onclick="sendCommand('wrong')">خطأ</button>
      <button class="presenterBtn gray" onclick="sendCommand('undo')">تراجع</button>
    </div>

    <section class="presenterCard">
    <button id="auctionPresenterImageBtn" class="presenterBtn blue hidden">
  تكبير الصورة
</button>
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
    .select("answer, note, image")
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

  const imgBtn = document.getElementById("auctionPresenterImageBtn")
  if (imgBtn) {
    if (data?.image) {
      imgBtn.classList.remove("hidden")
      imgBtn.onclick = () => openPresenterImageZoom(data.image)
    } else {
      imgBtn.classList.add("hidden")
    }
  }
}

/* =========================
   WHO
========================= */

function renderWhoPresenter() {
  setTitle("من هو", "الأرقام والإجابة")

  document.getElementById("presenterPanel").innerHTML = `
    ${presenterTopControls()}
    ${presenterTeamControls()}

    <section class="presenterCard">
      <div class="presenterLabel">اختر النقاط</div>
      <div class="presenterGrid">
        ${[1,2,3,4,5].map(n => `
          <button class="presenterNumberBtn" onclick="sendCommand('setPoints',{points:${n}})">${n}</button>
        `).join("")}
      </div>
    </section>

    <div class="presenterMiniActions">
      <button class="presenterBtn dark" onclick="sendCommand('showAnswer')">إظهار الإجابة</button>
      <button class="presenterBtn green" onclick="sendCommand('correct')">صح</button>
    </div>

    <div class="presenterMiniActions">
      <button class="presenterBtn red" onclick="sendCommand('wrong')">خطأ</button>
      <button class="presenterBtn gray" onclick="sendCommand('double')">دبل</button>
    </div>

    <section class="presenterCard">
      <div class="presenterLabel">اختر الرقم</div>
      <div class="presenterGrid">
        ${Array.from({ length:15 }, (_,i) => i + 1).map(n => `
          <button class="presenterNumberBtn" onclick="openWhoPresenter(${n})">${n}</button>
        `).join("")}
      </div>
    </section>

    <section class="presenterCard">
    <button id="whoPresenterImageBtn" class="presenterBtn blue hidden">
  تكبير الصورة
</button>
      <div class="presenterLabel">الإجابة</div>
      <div class="presenterAnswerText" id="whoPresenterAnswer">—</div>
    </section>
  `
}

async function openWhoPresenter(number) {
  sendCommand("openNumber", { number })

  const { data, error } = await db
    .from("who_images")
    .select("answer, image")
    .eq("model", presenterModel)
    .eq("number", Number(number))
    .single()

  if (error) {
    console.log(error)
    showToast("تعذر تحميل الإجابة")
    return
  }

  document.getElementById("whoPresenterAnswer").innerText = data?.answer || "—"

  const imgBtn = document.getElementById("whoPresenterImageBtn")
  if (imgBtn) {
    if (data?.image) {
      imgBtn.classList.remove("hidden")
      imgBtn.onclick = () => openPresenterImageZoom(data.image)
    } else {
      imgBtn.classList.add("hidden")
    }
  }
}

/* =========================
   FINAL
========================= */

function renderFinalPresenter() {
  setTitle("الفاصلة", "الجولات والتحكم")

  document.getElementById("presenterPanel").innerHTML = `
    ${presenterTopControls()}
    ${presenterTeamControls()}

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

    <div class="presenterMiniActions">
      <button class="presenterBtn green" onclick="presenterCorrect()">إجابة صحيحة</button>
      <button class="presenterBtn red" onclick="sendCommand('wrong')">خطأ</button>
    </div>

    <div class="presenterMiniActions">
      <button class="presenterBtn gray" onclick="sendCommand('double')">دبل</button>
      <button class="presenterBtn dark" onclick="sendCommand('startSequence')">بدء عرض الصور</button>
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

  box.innerHTML = `
    <div class="presenterListItem">
      تحكم الجولة ${presenterFinalRound} من الأزرار أعلاه.
    </div>
  `
}

/* =========================
   ARCHIVE
========================= */

function renderArchivePresenter() {
  setTitle("الأرشيف", "الجولات والمطلوب")

  document.getElementById("presenterPanel").innerHTML = `
    ${presenterTopControls()}
    ${presenterTeamControls()}

    <section class="presenterCard">
      <div class="presenterLabel">الجولة</div>
      <div class="presenterRoundTabs">
        <button id="archiveRoundBtn1" onclick="setPresenterArchiveRound(1)">1</button>
        <button id="archiveRoundBtn2" onclick="setPresenterArchiveRound(2)">2</button>
        <button id="archiveRoundBtn3" onclick="setPresenterArchiveRound(3)">3</button>
        <button id="archiveRoundBtn4" onclick="setPresenterArchiveRound(4)">4</button>
      </div>
    </section>

    <div class="presenterActions">
      <button class="presenterBtn gray" onclick="sendCommand('double')">دبل</button>
      <button class="presenterBtn red" onclick="sendCommand('wrong')">خطأ</button>
      <button class="presenterBtn green" onclick="sendCommand('showAnswer')">إظهار الإجابة</button>
    </div>

    <div class="presenterMiniActions">
      <button class="presenterBtn dark" onclick="sendCommand('startTimer')">بدء المؤقت</button>
      <button class="presenterBtn dark" onclick="sendCommand('undo')">تراجع</button>
    </div>

    <button class="presenterBtn blue" onclick="sendCommand('nextRound')">
      الجولة التالية
    </button>

    <section class="presenterCard">
      <div class="presenterLabel">فتح رقم</div>
      <div class="presenterGrid" id="archivePresenterNumbers"></div>
    </section>

    <section class="presenterCard">
      <div class="presenterLabel">المطلوب</div>
      <div class="presenterAnswerText" id="archivePresenterRequired">—</div>
    </section>

    <section class="presenterCard">
      <div class="presenterLabel">أسئلة / عناصر الجولة</div>
      <div class="presenterList" id="archivePresenterItems">—</div>
    </section>
  `

  setPresenterArchiveRound(presenterArchiveRound)
}

function setPresenterArchiveRound(round) {
  presenterArchiveRound = Number(round)

  for (let i = 1; i <= 4; i++) {
    const btn = document.getElementById(`archiveRoundBtn${i}`)
    if (btn) btn.classList.toggle("active", i === presenterArchiveRound)
  }

  loadPresenterArchiveItems()
}

async function loadPresenterArchiveItems() {
  const listBox = document.getElementById("archivePresenterItems")
  const requiredBox = document.getElementById("archivePresenterRequired")
  const numbersBox = document.getElementById("archivePresenterNumbers")

  if (listBox) listBox.innerHTML = "جاري التحميل..."
  if (requiredBox) requiredBox.innerText = "—"

  const { data, error } = await db
    .from("archive_items")
    .select("*")
    .eq("model", presenterModel)
    .eq("round", presenterArchiveRound)
    .order("position", { ascending: true })

  if (error) {
    console.log(error)
    if (listBox) listBox.innerHTML = "تعذر تحميل الأرشيف"
    return
  }

  const items = data || []
  const requiredItem = items.find(item => String(item.label || "").trim() === "المطلوب")

  if (requiredBox) {
    requiredBox.innerText = requiredItem
      ? `رقم ${requiredItem.position} — ${requiredItem.text || requiredItem.label || "المطلوب"}`
      : "لا يوجد مطلوب"
  }

  if (numbersBox) {
    numbersBox.innerHTML = items.map(item => `
      <button
        class="presenterNumberBtn"
        onclick="openArchivePresenterItem(${Number(item.position)})"
      >
        ${item.position}
      </button>
    `).join("")
  }

  if (listBox) {
    listBox.innerHTML = items.map(item => {
      const label = item.label ? `<strong>${item.label}</strong><br>` : ""
      const text = item.text || item.answer || item.title || "-"
      const imageText = item.image ? `<br>صورة: موجودة` : ""

      return `
        <div class="presenterListItem">
          <strong>رقم ${item.position}</strong><br>
          ${label}
          ${text}
          ${imageText}
        </div>
      `
    }).join("")
  }
}

function openArchivePresenterItem(number) {
  sendCommand("openNumber", {
    number,
    round: presenterArchiveRound
  })
}
let presenterZoomImageUrl = ""

function openPresenterImageZoom(imageUrl = "") {
  if (!imageUrl) {
    showToast("لا توجد صورة")
    return
  }

  presenterZoomImageUrl = imageUrl

  let modal = document.getElementById("presenterImageZoomModal")
  if (!modal) {
    modal = document.createElement("div")
    modal.id = "presenterImageZoomModal"
    modal.className = "presenterImageZoomModal hidden"
    modal.innerHTML = `
      <div class="presenterImageZoomCard">
        <button class="presenterImageZoomClose" onclick="closePresenterImageZoom()">×</button>
        <img id="presenterImageZoomImg" class="presenterImageZoomImg" alt="">
      </div>
    `
    document.body.appendChild(modal)
  }

  document.getElementById("presenterImageZoomImg").src = imageUrl
  modal.classList.remove("hidden")
}

function closePresenterImageZoom() {
  document.getElementById("presenterImageZoomModal")?.classList.add("hidden")
}

function presenterCorrect() {
  closePresenterImageZoom()
  sendCommand("correct")
}
/* =========================
   INIT
========================= */

document.addEventListener("DOMContentLoaded", () => {
  refreshPresenterTeamNames()
  loadPresenterModels()
})