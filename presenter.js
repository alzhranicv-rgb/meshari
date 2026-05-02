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
let presenterControlsHidden = localStorage.getItem("presenter_hide_controls") === "1"

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

function refreshPresenterTeamNames() {
  presenterTeamAName = localStorage.getItem("teamAName") || "الفريق الأول"
  presenterTeamBName = localStorage.getItem("teamBName") || "الفريق الثاني"

  const a = document.getElementById("presenterTeamA")
  const b = document.getElementById("presenterTeamB")

  if (a) a.innerText = presenterTeamAName
  if (b) b.innerText = presenterTeamBName
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

async function sendGlobalCommand(action, payload = {}) {
  const oldSegment = presenterSegment
  presenterSegment = "global"
  await sendCommand(action, payload)
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

  if (presenterModel) select.value = String(presenterModel)
}

function getPresenterModelName() {
  const select = document.getElementById("presenterModelSelect")
  const selected = select?.options?.[select.selectedIndex]
  return selected?.textContent?.trim() || `النموذج ${presenterModel}`
}

function setPresenterModel() {
  const value = document.getElementById("presenterModelSelect")?.value

  if (!value) {
    showToast("اختر النموذج")
    return
  }

  presenterModel = Number(value)

  localStorage.setItem("presenter_model", value)
  localStorage.setItem("current_model", value)
  localStorage.setItem("game_model", value)

  const modelNameBox = document.getElementById("presenterCurrentModelName")
  if (modelNameBox) modelNameBox.innerText = getPresenterModelName()

  showToast("تم اختيار النموذج")
}

function applyPresenterHomeState() {
  const teamAInput = document.getElementById("presenterTeamAInput")
  const teamBInput = document.getElementById("presenterTeamBInput")
  const modelNameBox = document.getElementById("presenterCurrentModelName")
  const setupCard = document.querySelector(".presenterSetupCard")
  const gameHome = document.getElementById("presenterGameHome")

  if (teamAInput) teamAInput.value = localStorage.getItem("teamAName") || ""
  if (teamBInput) teamBInput.value = localStorage.getItem("teamBName") || ""

  if (modelNameBox) modelNameBox.innerText = getPresenterModelName()

  if (presenterModel && localStorage.getItem("presenter_ready") === "1") {
    setupCard?.classList.add("hidden")
    gameHome?.classList.remove("hidden")
  }

  updatePresenterControlsToggleUI()
}

function startPresenterSetup() {
  const teamA = document.getElementById("presenterTeamAInput")?.value.trim() || "الفريق الأول"
  const teamB = document.getElementById("presenterTeamBInput")?.value.trim() || "الفريق الثاني"

  if (!presenterModel) {
    showToast("اختر النموذج أولاً")
    return
  }

  localStorage.setItem("teamAName", teamA)
  localStorage.setItem("teamBName", teamB)
  localStorage.setItem("presenter_ready", "1")
  localStorage.setItem("current_model", String(presenterModel))
  localStorage.setItem("game_model", String(presenterModel))

  refreshPresenterTeamNames()

  document.querySelector(".presenterSetupCard")?.classList.add("hidden")
  document.getElementById("presenterGameHome")?.classList.remove("hidden")

  const modelNameBox = document.getElementById("presenterCurrentModelName")
  if (modelNameBox) modelNameBox.innerText = getPresenterModelName()

  showToast("تم تجهيز لوحة المقدم")
}

async function togglePresenterDisplayControlsBtn() {
  presenterControlsHidden = !presenterControlsHidden
  localStorage.setItem("presenter_hide_controls", presenterControlsHidden ? "1" : "0")

  await sendGlobalCommand("toggleDisplayControls")
  updatePresenterControlsToggleUI()
}

function updatePresenterControlsToggleUI() {
  const btn = document.getElementById("presenterGlobalToggleBtn")
  if (!btn) return

  btn.classList.toggle("isHiddenMode", presenterControlsHidden)

  btn.innerText = presenterControlsHidden
    ? "إظهار أزرار التحكم في العرض"
    : "إخفاء أزرار التحكم في العرض"
}

function setTitle(title, subtitle = "") {
  document.getElementById("presenterTitle").innerText = title
  document.getElementById("presenterSubtitle").innerText = subtitle
}

/* =========================
   PAGE NAVIGATION
========================= */

function showPresenterHome() {
  presenterSegment = null
  presenterSelectedTeam = null

  document.getElementById("presenterHome")?.classList.remove("hidden")
  document.getElementById("presenterPanel")?.classList.add("hidden")
  document.getElementById("presenterBackBtn")?.classList.add("hidden")
  document.getElementById("presenterEndBtn")?.classList.add("hidden")

  setTitle("لوحة المقدم", "اختر الفقرة")
  applyPresenterHomeState()
}

function getPresenterSegmentTitle(segment) {
  const titles = {
    warmup: "التسخين",
    top10: "Top 10",
    auction: "فتبلة",
    who: "من هو",
    final: "الفاصلة",
    archive: "الأرشيف"
  }

  return titles[segment] || "لوحة المقدم"
}

function openPresenterSegment(segment) {
  refreshPresenterTeamNames()

  if (!presenterModel) {
    showToast("اختر النموذج أولاً")
    return
  }

  if (localStorage.getItem("presenter_ready") !== "1") {
    showToast("اضغط بدء لوحة المقدم أولاً")
    return
  }

  presenterSegment = segment
  presenterSelectedTeam = null

  document.getElementById("presenterHome")?.classList.add("hidden")
  document.getElementById("presenterPanel")?.classList.remove("hidden")
  document.getElementById("presenterBackBtn")?.classList.remove("hidden")
  document.getElementById("presenterEndBtn")?.classList.remove("hidden")

  setTitle(getPresenterSegmentTitle(segment), "اختر الفريق ثم تحكم بالفقرة")

  if (segment === "warmup") renderWarmupPresenter()
  if (segment === "top10") renderTop10Presenter()
  if (segment === "auction") renderAuctionPresenter()
  if (segment === "who") renderWhoPresenter()
  if (segment === "final") renderFinalPresenter()
  if (segment === "archive") renderArchivePresenter()
}

async function presenterEndSegment() {
  if (!presenterSegment) {
    showToast("اختر الفقرة")
    return
  }

  await sendCommand("endSegment")
}

/* =========================
   SHARED CONTROLS
========================= */

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
      <button class="presenterBtn green" onclick="presenterCorrect()">صح</button>
      <button class="presenterBtn red" onclick="sendCommand('wrong')">خطأ</button>
      <button class="presenterBtn gray" onclick="sendCommand('double')">دبل</button>
    </div>
  `
}

function presenterCorrect() {
  sendCommand("closeZoomImage")

  setTimeout(() => {
    sendCommand("correct")
  }, 120)
}

function zoomDisplayImage() {
  sendCommand("zoomImage")
}

function markPresenterNumberUsed(btn) {
  if (!btn) return
  btn.classList.add("usedPresenterNumber", "presenterOpened")
  btn.disabled = true
  btn.innerText = ""
}

/* =========================
   WARMUP
========================= */

async function renderWarmupPresenter() {
  setTitle("التسخين", "اختر الفريق ثم السؤال")

  const categories = await loadPresenterWarmupCategories()

  document.getElementById("presenterPanel").innerHTML = `
    ${presenterTeamControls()}
    ${resultControls()}

    <section class="presenterCard">
      <div class="presenterLabel">الفئات والأسئلة</div>

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

    <section class="presenterCard presenterCompactQa">
      <div class="presenterLabel">السؤال</div>
      <div class="presenterQuestionText" id="warmupPresenterQuestion">اختر سؤال</div>

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
    if (row.category) categories[Number(row.category)] = row.category_name || `الفئة ${row.category}`
  })

  return categories
}

async function openWarmupQuestionPresenter(category, number) {
  const btn = document.getElementById(`pw_${category}_${number}`)

  if (btn?.classList.contains("usedPresenterNumber")) {
    showToast("السؤال مستخدم")
    return
  }

  if (!presenterSelectedTeam) {
    showToast("اختر الفريق أولاً")
    return
  }

  await sendCommand("openNumber", { category, number })
  markPresenterNumberUsed(btn)

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

  document.getElementById("warmupPresenterQuestion").innerText = row?.question || "لا يوجد سؤال"
  document.getElementById("warmupPresenterAnswer").innerText = row?.answer || "—"
}

/* =========================
   TOP 10
========================= */

function renderTop10Presenter() {
  setTitle("Top 10", "اختر الفريق والجولة")

  document.getElementById("presenterPanel").innerHTML = `
    ${presenterTeamControls()}

    <section class="presenterCard">
      <div class="presenterLabel">الجولة</div>
      <div class="presenterRoundTabs">
        <button id="top10RoundBtn1" onclick="setPresenterTop10Round(1)">1</button>
        <button id="top10RoundBtn2" onclick="setPresenterTop10Round(2)">2</button>
        <button id="top10RoundBtn3" onclick="setPresenterTop10Round(3)">3</button>
      </div>
    </section>

    <div class="presenterActions">
      <button class="presenterBtn dark" onclick="sendCommand('startTimer')">بدء المؤقت</button>
      <button class="presenterBtn green" onclick="sendCommand('showAnswer')">إظهار الإجابات</button>
      <button class="presenterBtn red" onclick="sendCommand('wrong')">خطأ</button>
    </div>

    <div class="presenterMiniActions">
      <button class="presenterBtn gray" onclick="sendCommand('undo')">تراجع</button>
      <button class="presenterBtn blue" onclick="sendCommand('switchTurn')">تبديل الدور</button>
    </div>

    <button class="presenterBtn blue" onclick="sendCommand('nextRound')">الجولة التالية</button>

    <section class="presenterCard">
      <div class="presenterLabel">الأرقام والإجابات</div>
      <div class="presenterGrid" id="top10PresenterNumbers"></div>
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
  const box = document.getElementById("top10PresenterNumbers")
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
    <button
      id="ptop10_${presenterTop10Round}_${item.position}"
      class="presenterNumberBtn"
      onclick="openTop10PresenterNumber(${Number(item.position)})"
      title="${item.answer || "-"}"
    >
      ${item.position}
    </button>
  `).join("")
}

function openTop10PresenterNumber(number) {
  if (!presenterSelectedTeam) {
    showToast("اختر الفريق أولاً")
    return
  }

  sendCommand("openNumber", { number, round: presenterTop10Round })
  markPresenterNumberUsed(document.getElementById(`ptop10_${presenterTop10Round}_${number}`))
}

/* =========================
   AUCTION
========================= */

function renderAuctionPresenter() {
  setTitle("فتبلة", "اختر الفريق ثم الرقم")

  document.getElementById("presenterPanel").innerHTML = `
    ${presenterTeamControls()}

    <section class="presenterCard">
      <div class="presenterLabel">اختر الرقم</div>
      <div class="presenterGrid four">
        ${[1,2,3,4,5,6,7,8].map(n => `
          <button id="pauction_${n}" class="presenterNumberBtn" onclick="openAuctionPresenter(${n})">${n}</button>
        `).join("")}
      </div>
    </section>

    <div class="presenterActions">
      <button class="presenterBtn dark" onclick="sendCommand('startTimer')">بدء المؤقت</button>
      <button class="presenterBtn green" onclick="sendCommand('showAnswer')">إظهار الإجابة</button>
      <button class="presenterBtn blue" onclick="zoomDisplayImage()">تكبير الصورة</button>
    </div>

    <div class="presenterActions">
      <button class="presenterBtn green" onclick="presenterCorrect()">صح</button>
      <button class="presenterBtn red" onclick="sendCommand('wrong')">خطأ</button>
      <button class="presenterBtn gray" onclick="sendCommand('undo')">تراجع</button>
    </div>

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
  if (!presenterSelectedTeam) {
    showToast("اختر الفريق أولاً")
    return
  }

  sendCommand("openNumber", { number })
  markPresenterNumberUsed(document.getElementById(`pauction_${number}`))

  const { data, error } = await db
    .from("auction_questions")
    .select("*")
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
  setTitle("من هو", "اختر الفريق والنقاط ثم الرقم")

  document.getElementById("presenterPanel").innerHTML = `
    ${presenterTeamControls()}

    <section class="presenterCard">
      <div class="presenterLabel">اختر النقاط</div>
      <div class="presenterGrid">
        ${[1,2,3,4,5].map(n => `
          <button id="pwhoPoint_${n}" class="presenterNumberBtn" onclick="setWhoPresenterPoints(${n})">${n}</button>
        `).join("")}
      </div>
    </section>

    <div class="presenterActions">
      <button class="presenterBtn dark" onclick="sendCommand('showAnswer')">إظهار الإجابة</button>
      <button class="presenterBtn green" onclick="presenterCorrect()">صح</button>
      <button class="presenterBtn red" onclick="sendCommand('wrong')">خطأ</button>
    </div>

    <div class="presenterMiniActions">
      <button class="presenterBtn gray" onclick="sendCommand('double')">دبل</button>
      <button class="presenterBtn blue" onclick="zoomDisplayImage()">تكبير الصورة</button>
    </div>

    <section class="presenterCard">
      <div class="presenterLabel">اختر الرقم</div>
      <div class="presenterGrid">
        ${Array.from({ length:15 }, (_,i) => i + 1).map(n => `
          <button id="pwho_${n}" class="presenterNumberBtn" onclick="openWhoPresenter(${n})">${n}</button>
        `).join("")}
      </div>
    </section>

    <section id="whoPresenterImageBox" class="presenterImagePreviewBox hidden"></section>

    <section class="presenterCard">
      <div class="presenterLabel">الإجابة</div>
      <div class="presenterAnswerText" id="whoPresenterAnswer">—</div>
    </section>
  `
}

function setWhoPresenterPoints(points) {
  sendCommand("setPoints", { points })

  for (let i = 1; i <= 5; i++) {
    document.getElementById(`pwhoPoint_${i}`)?.classList.remove("active")
  }

  document.getElementById(`pwhoPoint_${points}`)?.classList.add("active")
}

async function openWhoPresenter(number) {
  if (!presenterSelectedTeam) {
    showToast("اختر الفريق أولاً")
    return
  }

  sendCommand("openNumber", { number })
  markPresenterNumberUsed(document.getElementById(`pwho_${number}`))

  const { data, error } = await db
    .from("who_images")
    .select("*")
    .eq("model", presenterModel)
    .eq("number", Number(number))
    .single()

  if (error) {
    console.log(error)
    showToast("تعذر تحميل الإجابة")
    return
  }

  const imageUrl = data?.image || data?.image_url || data?.url || ""

  document.getElementById("whoPresenterAnswer").innerText = data?.answer || "—"

  const imgBox = document.getElementById("whoPresenterImageBox")
  if (imgBox) {
    if (imageUrl) {
      imgBox.classList.remove("hidden")
      imgBox.innerHTML = `<img src="${imageUrl}" alt="">`
    } else {
      imgBox.classList.add("hidden")
      imgBox.innerHTML = ""
    }
  }
}

/* =========================
   FINAL
========================= */

function renderFinalPresenter() {
  setTitle("الفاصلة", "اختر الجولة والرقم")

  document.getElementById("presenterPanel").innerHTML = `
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

    <div id="finalPresenterControls"></div>

    <section class="presenterCard">
      <div class="presenterLabel">معلومات الرقم المختار</div>
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
  renderFinalPresenterControls()
  loadPresenterFinalAnswers()
}

function renderFinalPresenterControls() {
  const box = document.getElementById("finalPresenterControls")
  if (!box) return

  if (presenterFinalRound === 1) {
    box.innerHTML = `
      <div class="presenterActions">
        <button class="presenterBtn blue" onclick="sendCommand('showQuestion')">إظهار السؤال</button>
        <button class="presenterBtn green" onclick="sendCommand('showAnswer')">إظهار الإجابة</button>
        <button class="presenterBtn gray" onclick="sendCommand('double')">دبل</button>
      </div>
      <div class="presenterActions">
        <button class="presenterBtn green" onclick="presenterCorrect()">صح</button>
        <button class="presenterBtn red" onclick="sendCommand('wrong')">خطأ</button>
        <button class="presenterBtn gray" onclick="sendCommand('undo')">تراجع</button>
      </div>
    `
    return
  }

  if (presenterFinalRound === 2) {
    box.innerHTML = `
      <div class="presenterActions">
        <button class="presenterBtn blue" onclick="sendCommand('showHint')">إظهار التلميحة</button>
        <button class="presenterBtn green" onclick="sendCommand('showAnswer')">إظهار الإجابة</button>
        <button class="presenterBtn gray" onclick="sendCommand('double')">دبل</button>
      </div>
      <div class="presenterActions">
        <button class="presenterBtn green" onclick="presenterCorrect()">صح</button>
        <button class="presenterBtn red" onclick="sendCommand('wrong')">خطأ</button>
        <button class="presenterBtn gray" onclick="sendCommand('undo')">تراجع</button>
      </div>
    `
    return
  }

  box.innerHTML = `
    <div class="presenterActions">
      <button class="presenterBtn dark" onclick="sendCommand('startSequence')">بدء الصور</button>
      <button class="presenterBtn blue" onclick="zoomDisplayImage()">تكبير الصورة</button>
      <button class="presenterBtn gray" onclick="sendCommand('double')">دبل</button>
    </div>
    <div class="presenterActions">
      <button class="presenterBtn green" onclick="presenterCorrect()">صح</button>
      <button class="presenterBtn red" onclick="sendCommand('wrong')">خطأ</button>
      <button class="presenterBtn gray" onclick="sendCommand('undo')">تراجع</button>
    </div>
  `
}

function renderFinalPresenterNumbers() {
  const box = document.getElementById("finalPresenterNumbers")
  if (!box) return

  let nums = [1,2,3,4,5,6]
  if (presenterFinalRound === 2) nums = [1,2,3,4]
  if (presenterFinalRound === 3) nums = [1,2]

  box.className = presenterFinalRound === 3 ? "presenterGrid two" : "presenterGrid"

  box.innerHTML = nums.map(n => `
    <button id="pfinal_${presenterFinalRound}_${n}" class="presenterNumberBtn" onclick="openFinalPresenter(${n})">${n}</button>
  `).join("")
}

async function openFinalPresenter(number) {
  if (!presenterSelectedTeam) {
    showToast("اختر الفريق أولاً")
    return
  }

  sendCommand("openNumber", { number, round: presenterFinalRound })
  markPresenterNumberUsed(document.getElementById(`pfinal_${presenterFinalRound}_${number}`))
  loadPresenterFinalAnswers(number)
}

async function loadPresenterFinalAnswers(number = null) {
  const box = document.getElementById("finalPresenterAnswers")
  if (!box) return

  box.innerHTML = "جاري التحميل..."

  if (presenterFinalRound === 1) {
    let query = db
      .from("final_round1_items")
      .select("*")
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
        <strong>رقم ${item.number}</strong><br>
        ${Number(item.number) <= 3 ? "" : `السؤال: ${[item.question_part1, item.question_part2, item.question_part3].filter(Boolean).join(" / ") || item.card_text || "-"}<br>`}
        الإجابة: ${item.answer || "-"}<br>
        ${item.note ? `ملاحظة: ${item.note}` : ""}
      </div>
    `).join("")
    return
  }

  if (presenterFinalRound === 2) {
    box.innerHTML = `
      <div class="presenterListItem">
        الجولة الثانية: استخدم أزرار التحكم حسب الرقم المختار.
      </div>
    `
    return
  }

  box.innerHTML = `
    <div class="presenterListItem">
      الجولة الثالثة: تظهر الصور في العرض، ويمكن تكبير صورة العرض من زر التكبير.
    </div>
  `
}

/* =========================
   ARCHIVE
========================= */

function renderArchivePresenter() {
  setTitle("الأرشيف", "اختر الفريق والجولة")

  document.getElementById("presenterPanel").innerHTML = `
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

    <div class="presenterActions">
      <button class="presenterBtn dark" onclick="sendCommand('startTimer')">بدء المؤقت</button>
      <button class="presenterBtn gray" onclick="sendCommand('undo')">تراجع</button>
      <button class="presenterBtn blue" onclick="sendCommand('nextRound')">الجولة التالية</button>
    </div>

    <section class="presenterCard">
      <div class="presenterLabel">فتح رقم</div>
      <div class="presenterGrid" id="archivePresenterNumbers"></div>
    </section>

    <section class="presenterCard">
      <div class="presenterLabel">المطلوب</div>
      <div class="presenterAnswerText" id="archivePresenterRequired">—</div>
    </section>

    <section class="presenterCard">
      <div class="presenterLabel">عناصر الجولة</div>
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
        id="parchive_${presenterArchiveRound}_${Number(item.position)}"
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
  if (!presenterSelectedTeam) {
    showToast("اختر الفريق أولاً")
    return
  }

  sendCommand("openNumber", {
    number,
    round: presenterArchiveRound
  })

  markPresenterNumberUsed(document.getElementById(`parchive_${presenterArchiveRound}_${number}`))
}

/* =========================
   INIT
========================= */

document.addEventListener("DOMContentLoaded", () => {
  refreshPresenterTeamNames()
  loadPresenterModels().then(() => {
    applyPresenterHomeState()
  })
})