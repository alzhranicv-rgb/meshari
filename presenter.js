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
let presenterWarmupManualSelectionDone = false
let presenterWarmupLastAnsweredTeam = null
let presenterWarmupAnswerWait = false

/* =========================
   PRESENTER PERSISTENCE
========================= */

const PRESENTER_STATE_KEY = "presenter_state_v1"

let presenterOpened = {
  warmup: {},
  top10: { 1: [], 2: [], 3: [] },
  auction: [],
  who: [],
  final: { 1: [], 2: [], 3: [] },
  archive: { 1: [], 2: [], 3: [], 4: [] }
}

function savePresenterState() {
  localStorage.setItem(PRESENTER_STATE_KEY, JSON.stringify({
    segment: presenterSegment,
    model: presenterModel,
    selectedTeam: presenterSelectedTeam,
    top10Round: presenterTop10Round,
    finalRound: presenterFinalRound,
    archiveRound: presenterArchiveRound,
    controlsHidden: presenterControlsHidden,
    warmupManualSelectionDone: presenterWarmupManualSelectionDone,
    warmupLastAnsweredTeam: presenterWarmupLastAnsweredTeam,
    opened: presenterOpened,
    ready: localStorage.getItem("presenter_ready") || "0"
  }))
}

function getPresenterState() {
  try {
    return JSON.parse(localStorage.getItem(PRESENTER_STATE_KEY) || "null")
  } catch {
    return null
  }
}

function clearPresenterState() {
  localStorage.removeItem(PRESENTER_STATE_KEY)
}

function savePresenterOpened(segment, number, extra = {}) {
  if (segment === "warmup") {
    const key = `${extra.category}_${number}`
    presenterOpened.warmup[key] = true
  }

  if (segment === "top10") {
    const round = Number(extra.round || presenterTop10Round)
    if (!presenterOpened.top10[round].includes(number)) {
      presenterOpened.top10[round].push(number)
    }
  }

  if (segment === "auction") {
    if (!presenterOpened.auction.includes(number)) {
      presenterOpened.auction.push(number)
    }
  }

  if (segment === "who") {
    if (!presenterOpened.who.includes(number)) {
      presenterOpened.who.push(number)
    }
  }

  if (segment === "final") {
    const round = Number(extra.round || presenterFinalRound)
    if (!presenterOpened.final[round].includes(number)) {
      presenterOpened.final[round].push(number)
    }
  }

  if (segment === "archive") {
    const round = Number(extra.round || presenterArchiveRound)
    if (!presenterOpened.archive[round].includes(number)) {
      presenterOpened.archive[round].push(number)
    }
  }

  savePresenterState()
}

function restorePresenterOpenedButtons() {
  Object.keys(presenterOpened.warmup || {}).forEach(key => {
    const btn = document.getElementById(`pw_${key}`)
    if (btn) markPresenterNumberUsed(btn)
  })

  ;(presenterOpened.top10?.[presenterTop10Round] || []).forEach(n => {
    const btn = document.getElementById(`ptop10_${presenterTop10Round}_${n}`)
    if (btn) {
      btn.classList.add("opened")
      btn.disabled = true
    }
  })

  ;(presenterOpened.auction || []).forEach(n => {
    const btn = document.getElementById(`pauction_${n}`)
    if (btn) markPresenterNumberUsed(btn)
  })

  ;(presenterOpened.who || []).forEach(n => {
    const btn = document.getElementById(`pwho_${n}`)
    if (btn) markPresenterNumberUsed(btn)
  })

  ;(presenterOpened.final?.[presenterFinalRound] || []).forEach(n => {
    const btn = document.getElementById(`pfinal_${presenterFinalRound}_${n}`)
    if (btn) markPresenterNumberUsed(btn)
  })

  ;(presenterOpened.archive?.[presenterArchiveRound] || []).forEach(n => {
    const btn = document.getElementById(`parchive_${presenterArchiveRound}_${n}`)
    if (btn) {
      btn.classList.add("opened")
      btn.disabled = true
    }
  })
}

async function restorePresenterState() {
  const saved = getPresenterState()
  if (!saved) return

  presenterModel = Number(saved.model || presenterModel)
  presenterSegment = saved.segment || null
  presenterSelectedTeam = saved.selectedTeam || null
  presenterTop10Round = Number(saved.top10Round || 1)
  presenterFinalRound = Number(saved.finalRound || 1)
  presenterArchiveRound = Number(saved.archiveRound || 1)
  presenterControlsHidden = !!saved.controlsHidden
  presenterWarmupManualSelectionDone = !!saved.warmupManualSelectionDone
  presenterWarmupLastAnsweredTeam = saved.warmupLastAnsweredTeam || null
  presenterOpened = saved.opened || presenterOpened

  if (saved.ready === "1") {
    localStorage.setItem("presenter_ready", "1")
  }

  const select = document.getElementById("presenterModelSelect")
  if (select && presenterModel) select.value = String(presenterModel)

  applyPresenterHomeState()

  if (presenterSegment) {
    openPresenterSegment(presenterSegment)

    setTimeout(() => {
      restorePresenterOpenedButtons()

      if (presenterSelectedTeam) {
        document.getElementById("presenterTeamA")?.classList.remove("selectedPresenterTeam")
        document.getElementById("presenterTeamB")?.classList.remove("selectedPresenterTeam")

        if (presenterSelectedTeam === "A") {
          document.getElementById("presenterTeamA")?.classList.add("selectedPresenterTeam")
        }

        if (presenterSelectedTeam === "B") {
          document.getElementById("presenterTeamB")?.classList.add("selectedPresenterTeam")
        }
      }
    }, 500)
  }
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

  savePresenterState()
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

  savePresenterState()
  showToast("تم تجهيز لوحة المقدم")
}

async function togglePresenterDisplayControlsBtn() {
  presenterControlsHidden = !presenterControlsHidden
  localStorage.setItem("presenter_hide_controls", presenterControlsHidden ? "1" : "0")

  await sendGlobalCommand("toggleDisplayControls")
  updatePresenterControlsToggleUI()
  savePresenterState()
}

function updatePresenterControlsToggleUI() {
  const btn = document.getElementById("presenterGlobalToggleBtn")
  if (!btn) return

  btn.classList.toggle("presenterShowControlsMode", presenterControlsHidden)
  btn.classList.toggle("presenterHideControlsMode", !presenterControlsHidden)

  btn.innerText = presenterControlsHidden
    ? "إظهار أزرار التحكم"
    : "إخفاء أزرار التحكم"
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
  savePresenterState()

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
  savePresenterState()

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

  setTimeout(restorePresenterOpenedButtons, 500)
}

async function presenterEndSegment() {
  if (!presenterSegment) {
    showToast("اختر الفقرة")
    return
  }

  await sendCommand("endSegment")
  clearPresenterState()
  presenterOpened = {
    warmup: {},
    top10: { 1: [], 2: [], 3: [] },
    auction: [],
    who: [],
    final: { 1: [], 2: [], 3: [] },
    archive: { 1: [], 2: [], 3: [], 4: [] }
  }
  showPresenterHome()
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
  if (presenterSegment === "warmup") {
    if (presenterWarmupManualSelectionDone && team !== presenterSelectedTeam) {
      showToast("بعد البداية الأولى يتحدد الدور تلقائيًا")
      return
    }

    if (presenterWarmupLastAnsweredTeam === team) {
      showToast("لا يمكن لنفس الفريق اللعب مرتين متتاليتين")
      return
    }

    presenterWarmupManualSelectionDone = true
  }

  presenterSelectedTeam = team
  savePresenterState()

  document.getElementById("presenterTeamA")?.classList.remove("selectedPresenterTeam")
  document.getElementById("presenterTeamB")?.classList.remove("selectedPresenterTeam")

  if (team === "A") document.getElementById("presenterTeamA")?.classList.add("selectedPresenterTeam")
  if (team === "B") document.getElementById("presenterTeamB")?.classList.add("selectedPresenterTeam")

  sendCommand("selectTeam", { team })
}

function getNextPresenterWarmupTeam() {
  if (presenterWarmupLastAnsweredTeam === "A") return "B"
  if (presenterWarmupLastAnsweredTeam === "B") return "A"
  return null
}

function applyPresenterWarmupAutoTeam() {
  const nextTeam = getNextPresenterWarmupTeam()
  if (!nextTeam) return

  presenterSelectedTeam = nextTeam
  savePresenterState()

  document.getElementById("presenterTeamA")?.classList.remove("selectedPresenterTeam")
  document.getElementById("presenterTeamB")?.classList.remove("selectedPresenterTeam")

  if (nextTeam === "A") document.getElementById("presenterTeamA")?.classList.add("selectedPresenterTeam")
  if (nextTeam === "B") document.getElementById("presenterTeamB")?.classList.add("selectedPresenterTeam")

  sendCommand("selectTeam", { team: nextTeam })
}

function lockPresenterWarmupNumbers(lock) {
  document.querySelectorAll(".presenterWarmupNumbers .presenterNumberBtn").forEach(btn => {
    if (!btn.classList.contains("usedPresenterNumber")) {
      btn.disabled = lock
    }
  })
}

function resultControls() {
  return `
    <div class="presenterActions">
      <button class="presenterBtn green" onclick="presenterCorrect()">صح</button>
      <button class="presenterBtn red" onclick="presenterWrong()">خطأ</button>
      <button class="presenterBtn gray" onclick="sendCommand('double')">دبل</button>
    </div>
  `
}

function presenterCorrect() {
  if (presenterSegment === "warmup") {
    presenterWarmupLastAnsweredTeam = presenterSelectedTeam
    presenterSelectedTeam = null
    presenterWarmupAnswerWait = true
    lockPresenterWarmupNumbers(true)
    savePresenterState()

    sendCommand("correct")

    setTimeout(() => {
      presenterWarmupAnswerWait = false
      applyPresenterWarmupAutoTeam()
      lockPresenterWarmupNumbers(false)
      showToast("اختر الرقم التالي")
      savePresenterState()
    }, 3000)

    return
  }

  if (presenterSegment === "who") {
    presenterWhoAnswerWait = true

    sendCommand("closeZoomImage")

    setTimeout(() => {
      sendCommand("correct")
    }, 120)

    setTimeout(() => {
      presenterWhoAnswerWait = false
      showToast("اختر السؤال التالي")
    }, 5000)

    return
  }

  sendCommand("closeZoomImage")

  setTimeout(() => {
    sendCommand("correct")
  }, 120)
}

function presenterWrong() {
  if (presenterSegment === "warmup") {
    presenterWarmupLastAnsweredTeam = presenterSelectedTeam
    presenterSelectedTeam = null
    presenterWarmupAnswerWait = true
    lockPresenterWarmupNumbers(true)
    savePresenterState()

    sendCommand("wrong")

    setTimeout(() => {
      presenterWarmupAnswerWait = false
      applyPresenterWarmupAutoTeam()
      lockPresenterWarmupNumbers(false)
      showToast("اختر الرقم التالي")
      savePresenterState()
    }, 3000)

    return
  }

  if (presenterSegment === "who") {
    presenterWhoAnswerWait = true

    sendCommand("closeZoomImage")

    setTimeout(() => {
      sendCommand("wrong")
    }, 120)

    setTimeout(() => {
      presenterWhoAnswerWait = false
      showToast("اختر السؤال التالي")
    }, 5000)

    return
  }

  sendCommand("wrong")
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

  restorePresenterOpenedButtons()
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

  if (presenterWarmupAnswerWait) {
    showToast("انتظر ظهور الإجابة")
    return
  }

  if (btn?.classList.contains("usedPresenterNumber")) {
    showToast("السؤال مستخدم")
    return
  }

  if (!presenterSelectedTeam) {
    if (!presenterWarmupManualSelectionDone) {
      showToast("اختر الفريق أولاً")
      return
    }

    applyPresenterWarmupAutoTeam()

    if (!presenterSelectedTeam) {
      showToast("اختر الفريق أولاً")
      return
    }
  }

  await sendCommand("openNumber", { category, number })
  markPresenterNumberUsed(btn)
  savePresenterOpened("warmup", number, { category })

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
  setTitle("Top 10", "اختر الفريق ثم افتح الإجابة")

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
      <button class="presenterBtn gray" onclick="sendCommand('double')">دبل</button>
      <button class="presenterBtn green" onclick="sendCommand('showAnswer')">إظهار الإجابات</button>
<button class="presenterBtn red" onclick="presenterWrong()">خطأ</button>
<button class="presenterBtn gray" onclick="sendCommand('undo')">تراجع</button>
<button class="presenterBtn blue" onclick="sendCommand('switchTurn')">تبديل الدور</button>

    <button class="presenterBtn blue" onclick="sendCommand('nextRound')">الجولة التالية</button>

    <section class="presenterCard">
      <div class="presenterLabel">الإجابات</div>
      <div class="presenterTop10Answers" id="top10PresenterAnswers">جاري التحميل...</div>
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
  savePresenterState()
  setTimeout(restorePresenterOpenedButtons, 100)
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
    <button
      id="ptop10_${presenterTop10Round}_${item.position}"
      class="presenterTop10AnswerBtn"
      onclick="openTop10PresenterNumber(${Number(item.position)})"
    >
      <span class="presenterTop10AnswerNo">${item.position}</span>
      <span class="presenterTop10AnswerText">${item.answer || "-"}</span>
    </button>
  `).join("")

  restorePresenterOpenedButtons()
}

function openTop10PresenterNumber(number) {
  if (!presenterSelectedTeam) {
    showToast("اختر الفريق أولاً")
    return
  }

  const btn = document.getElementById(`ptop10_${presenterTop10Round}_${number}`)

  if (btn?.classList.contains("opened")) {
    showToast("الإجابة مفتوحة")
    return
  }

  sendCommand("openNumber", {
    number,
    round: presenterTop10Round
  })

  if (btn) {
    btn.classList.add("opened")
    btn.disabled = true
  }

  savePresenterOpened("top10", number, { round: presenterTop10Round })
}

/* =========================
   AUCTION
========================= */

let presenterAuctionMaxNumber = 8
let presenterAuctionCurrentImage = ""

async function loadPresenterAuctionMaxNumber() {
  const { data, error } = await db
    .from("segment_settings")
    .select("item_count")
    .eq("model", presenterModel)
    .eq("segment", "auction")
    .maybeSingle()

  if (error) {
    console.log(error)
    presenterAuctionMaxNumber = 8
    return
  }

  presenterAuctionMaxNumber = Math.min(
    Math.max(Number(data?.item_count || 8), 1),
    8
  )
}

async function renderAuctionPresenter() {
  setTitle("فتبلة", "اختر الفريق ثم الرقم")

  await loadPresenterAuctionMaxNumber()

  const numbers = Array.from(
    { length: presenterAuctionMaxNumber },
    (_, i) => i + 1
  )

  document.getElementById("presenterPanel").innerHTML = `
    ${presenterTeamControls()}

    <section class="presenterCard">
      <div class="presenterLabel">اختر الرقم</div>
      <div class="presenterGrid four">
        ${numbers.map(n => `
          <button id="pauction_${n}" class="presenterNumberBtn" onclick="openAuctionPresenter(${n})">${n}</button>
        `).join("")}
      </div>
    </section>

    <div class="presenterActions">
  <button class="presenterBtn gray" onclick="sendCommand('double')">دبل</button>
  <button class="presenterBtn green" onclick="presenterCorrect()">إجابة صحيحة</button>
  <button class="presenterBtn red" onclick="presenterWrong()">خطأ</button>
</div>

<div class="presenterActions">
  <button class="presenterBtn gray" onclick="sendCommand('undo')">تراجع</button>
  <button class="presenterBtn blue" onclick="zoomDisplayImage()">تكبير الصورة</button>
</div>

    <section class="presenterCard">
      <div class="presenterLabel">ملاحظة</div>
      <div class="presenterNoteText" id="auctionPresenterNote">—</div>
    </section>
  `

  restorePresenterOpenedButtons()
}

async function openAuctionPresenter(number) {
  if (!presenterSelectedTeam) {
    showToast("اختر الفريق أولاً")
    return
  }

  const btn = document.getElementById(`pauction_${number}`)

  if (btn?.classList.contains("usedPresenterNumber")) {
    showToast("الرقم مستخدم")
    return
  }

  await sendCommand("openNumber", { number })
  markPresenterNumberUsed(btn)
  savePresenterOpened("auction", number)

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

  presenterAuctionCurrentImage = data?.image || ""

  document.getElementById("auctionPresenterAnswer").innerText = data?.answer || "—"
  document.getElementById("auctionPresenterNote").innerText = data?.note || "—"

  const imgBox = document.getElementById("auctionPresenterImageBox")
  if (imgBox) {
    if (presenterAuctionCurrentImage) {
      imgBox.classList.remove("hidden")
      imgBox.innerHTML = `<img src="${presenterAuctionCurrentImage}" alt="">`
    } else {
      imgBox.classList.add("hidden")
      imgBox.innerHTML = ""
    }
  }
}

/* =========================
   WHO
========================= */

let presenterWhoCurrentImage = ""
let presenterWhoManualStartDone = false
let presenterWhoAnswerWait = false

function renderWhoPresenter() {
  setTitle("من هو", "اختر الفريق ثم النقاط ثم الرقم")

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
  <button class="presenterBtn gray" onclick="sendCommand('double')">دبل</button>
  <button class="presenterBtn green" onclick="presenterCorrect()">صح</button>
  <button class="presenterBtn red" onclick="presenterWrong()">خطأ</button>
</div>

<div class="presenterActions">
  <button class="presenterBtn blue" onclick="zoomDisplayImage()">تكبير الصورة</button>
</div>

    <div class="presenterActions">
      <button class="presenterBtn green" onclick="presenterCorrect()">صح</button>
      <button class="presenterBtn red" onclick="presenterWrong()">خطأ</button>
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

  presenterWhoManualStartDone = false
  presenterWhoAnswerWait = false
  restorePresenterOpenedButtons()
}

function setWhoPresenterPoints(points) {
  sendCommand("setPoints", { points })

  for (let i = 1; i <= 5; i++) {
    document.getElementById(`pwhoPoint_${i}`)?.classList.remove("active")
  }

  document.getElementById(`pwhoPoint_${points}`)?.classList.add("active")
}

async function openWhoPresenter(number) {
  if (presenterWhoAnswerWait) {
    showToast("انتظر انتهاء الإجابة")
    return
  }

  if (!presenterSelectedTeam) {
    showToast("اختر الفريق أولاً")
    return
  }

  const btn = document.getElementById(`pwho_${number}`)

  if (btn?.classList.contains("usedPresenterNumber")) {
    showToast("الرقم مستخدم")
    return
  }

  await sendCommand("openNumber", { number })
  markPresenterNumberUsed(btn)
  savePresenterOpened("who", number)

  const { data, error } = await db
    .from("who_images")
    .select("*")
    .eq("model", presenterModel)
    .eq("number", Number(number))
    .single()

  if (error) {
    console.log(error)
    showToast("تعذر تحميل البيانات")
    return
  }

  presenterWhoCurrentImage = data?.image || ""

  document.getElementById("whoPresenterAnswer").innerText = data?.answer || "—"

  const imgBox = document.getElementById("whoPresenterImageBox")
  if (imgBox) {
    if (presenterWhoCurrentImage) {
      imgBox.classList.remove("hidden")
      imgBox.innerHTML = `<img src="${presenterWhoCurrentImage}" alt="">`
    } else {
      imgBox.classList.add("hidden")
      imgBox.innerHTML = ""
    }
  }
}


/* =========================
   FINAL
========================= */

let presenterFinalCurrentImage = ""

function renderFinalPresenter() {
  setTitle("الفاصلة", "اختر الجولة ثم تحكم بنفس نظام العرض")

  document.getElementById("presenterPanel").innerHTML = `
    ${presenterTeamControls()}

    <section class="presenterCard">
      <div class="presenterLabel">الجولة</div>
      <div class="presenterRoundTabs">
        <button id="finalRoundBtn1" onclick="setPresenterFinalRound(1)">الجولة 1</button>
        <button id="finalRoundBtn2" onclick="setPresenterFinalRound(2)">الجولة 2</button>
        <button id="finalRoundBtn3" onclick="setPresenterFinalRound(3)">الجولة 3</button>
      </div>
    </section>

    <section class="presenterCard">
      <div class="presenterLabel">فتح رقم</div>
      <div class="presenterGrid" id="finalPresenterNumbers"></div>
    </section>

    <div id="finalPresenterControls"></div>

    <section id="finalPresenterImageBox" class="presenterImagePreviewBox hidden"></section>

    <section class="presenterCard">
      <div class="presenterLabel">معلومات الرقم</div>
      <div class="presenterList" id="finalPresenterInfo">اختر رقم</div>
    </section>
  `

  setPresenterFinalRound(presenterFinalRound)
}

function setPresenterFinalRound(round) {
  presenterFinalRound = Number(round)

  for (let i = 1; i <= 3; i++) {
    document.getElementById(`finalRoundBtn${i}`)?.classList.toggle("active", i === presenterFinalRound)
  }

  renderFinalPresenterNumbers()
  renderFinalPresenterControls()

  document.getElementById("finalPresenterInfo").innerHTML = "اختر رقم"
  document.getElementById("finalPresenterImageBox")?.classList.add("hidden")

  savePresenterState()
  setTimeout(restorePresenterOpenedButtons, 100)
}

function renderFinalPresenterNumbers() {
  const box = document.getElementById("finalPresenterNumbers")
  if (!box) return

  let nums = [1, 2, 3, 4, 5, 6]
  if (presenterFinalRound === 2) nums = [1, 2, 3, 4]
  if (presenterFinalRound === 3) nums = [1, 2]

  box.className = presenterFinalRound === 3 ? "presenterGrid two" : "presenterGrid"

  box.innerHTML = nums.map(n => `
    <button id="pfinal_${presenterFinalRound}_${n}" class="presenterNumberBtn" onclick="openFinalPresenter(${n})">${n}</button>
  `).join("")
}

function renderFinalPresenterControls() {
  const box = document.getElementById("finalPresenterControls")
  if (!box) return

  if (presenterFinalRound === 1) {
    box.innerHTML = `
  <div class="presenterActions">
    <button class="presenterBtn gray" onclick="sendCommand('double')">دبل</button>
    <button class="presenterBtn blue" onclick="sendCommand('showQuestion')">إظهار السؤال</button>
    <button class="presenterBtn green" onclick="presenterCorrect()">إجابة صحيحة</button>
  </div>

  <div class="presenterActions">
    <button class="presenterBtn red" onclick="presenterWrong()">خطأ</button>
    <button class="presenterBtn gray" onclick="sendCommand('undo')">تراجع</button>
    <button class="presenterBtn blue" onclick="sendCommand('nextRound')">الجولة التالية</button>
  </div>
`
    return
  }

  if (presenterFinalRound === 2) {
    box.innerHTML = `
      <div class="presenterActions">
        <button class="presenterBtn gray" onclick="sendCommand('double')">دبل</button>
        <button class="presenterBtn green" onclick="sendCommand('showAnswer')">إظهار الإجابة</button>
        <button class="presenterBtn dark" onclick="sendCommand('decreaseCountdown')">العداد</button>
      </div>

      <div class="presenterActions">
        <button class="presenterBtn green" onclick="sendCommand('recordScrambleScore')">تسجيل نتيجة المبعثرة</button>
        <button class="presenterBtn green" onclick="sendCommand('recordSequenceScore')">تسجيل نتيجة التلميح</button>
        <button class="presenterBtn gray" onclick="sendCommand('undo')">تراجع</button>
      </div>

      <button class="presenterBtn blue" onclick="sendCommand('nextRound')">الجولة التالية</button>
    `
    return
  }

  box.innerHTML = `
    <div class="presenterActions">
      <button class="presenterBtn gray" onclick="sendCommand('double')">دبل</button>
      <button class="presenterBtn dark" onclick="sendCommand('startSequence')">بدء عرض الصور</button>
      <button class="presenterBtn blue" onclick="zoomDisplayImage()">تكبير صورة العرض</button>
    </div>

    <div class="presenterActions">
      <button class="presenterBtn green" onclick="sendCommand('showAnswer')">إظهار الإجابة</button>
      <button class="presenterBtn green" onclick="sendCommand('recordRound3Score')">تسجيل النتيجة</button>
      <button class="presenterBtn gray" onclick="sendCommand('undo')">تراجع</button>
    </div>
  `
}

async function openFinalPresenter(number) {
  if (!presenterSelectedTeam) {
    showToast("اختر الفريق أولاً")
    return
  }

  const btn = document.getElementById(`pfinal_${presenterFinalRound}_${number}`)

  if (btn?.classList.contains("usedPresenterNumber")) {
    showToast("الرقم مستخدم")
    return
  }

  await sendCommand("openNumber", {
    round: presenterFinalRound,
    number
  })

  markPresenterNumberUsed(btn)
  savePresenterOpened("final", number, { round: presenterFinalRound })

  if (presenterFinalRound === 1) loadPresenterFinalRound1Info(number)
  if (presenterFinalRound === 2) loadPresenterFinalRound2Info(number)
  if (presenterFinalRound === 3) loadPresenterFinalRound3Info(number)
}

async function loadPresenterFinalRound1Info(number) {
  const box = document.getElementById("finalPresenterInfo")
  const imgBox = document.getElementById("finalPresenterImageBox")

  box.innerHTML = "جاري التحميل..."
  imgBox?.classList.add("hidden")

  const { data, error } = await db
    .from("final_round1_items")
    .select("*")
    .eq("model", presenterModel)
    .eq("number", Number(number))
    .single()

  if (error) {
    console.log(error)
    box.innerHTML = "تعذر تحميل البيانات"
    return
  }

  if (data?.image && imgBox) {
    imgBox.classList.remove("hidden")
    imgBox.innerHTML = `<img src="${data.image}" alt="">`
  }

  const questionParts = [
    data?.question_part1,
    data?.question_part2,
    data?.question_part3
  ].filter(Boolean)

  if ([1, 2, 3].includes(Number(number))) {
    box.innerHTML = `
      <div class="presenterListItem">
        <strong>الإجابة:</strong><br>
        ${data?.answer || "-"}
      </div>
      ${data?.note ? `<div class="presenterListItem"><strong>ملاحظة:</strong><br>${data.note}</div>` : ""}
    `
    return
  }

  box.innerHTML = `
    <div class="presenterListItem">
      <strong>السؤال:</strong><br>
      ${questionParts.map((q, i) => `${i + 1}- ${q}`).join("<br>") || "-"}
    </div>
    <div class="presenterListItem">
      <strong>الإجابة:</strong><br>
      ${data?.answer || "-"}
    </div>
    ${data?.note ? `<div class="presenterListItem"><strong>ملاحظة:</strong><br>${data.note}</div>` : ""}
  `
}

async function loadPresenterFinalRound2Info(number) {
  const box = document.getElementById("finalPresenterInfo")
  box.innerHTML = "جاري التحميل..."

  const { data, error } = await db
    .from("final_round2_items")
    .select("*")
    .eq("model", presenterModel)
    .eq("number", Number(number))
    .order("item_order", { ascending: true })

  if (error) {
    console.log(error)
    box.innerHTML = "تعذر تحميل البيانات"
    return
  }

  const isScramble = Number(number) === 1 || Number(number) === 3

  box.innerHTML = (data || []).map((item, idx) => `
    <div class="presenterListItem">
      <strong>${idx + 1}</strong><br>
      ${isScramble ? `التلميحة: ${item.hint || "-"}<br>` : ""}
      الكلمة: ${item.prompt || "-"}<br>
      الإجابة: ${item.answer || item.prompt || "-"}
    </div>
  `).join("")
}

async function loadPresenterFinalRound3Info(number) {
  const box = document.getElementById("finalPresenterInfo")
  const imgBox = document.getElementById("finalPresenterImageBox")

  box.innerHTML = "جاري التحميل..."
  imgBox?.classList.add("hidden")

  const { data, error } = await db
    .from("final_round3_items")
    .select("*")
    .eq("model", presenterModel)
    .eq("number", Number(number))
    .order("image_order", { ascending: true })

  if (error) {
    console.log(error)
    box.innerHTML = "تعذر تحميل الصور"
    return
  }

  const rows = data || []

  if (imgBox) {
    imgBox.classList.remove("hidden")
    imgBox.innerHTML = rows.map(row => `
      <img src="${row.image || ""}" alt="">
    `).join("")
  }

  box.innerHTML = rows.map((row, idx) => `
    <div class="presenterListItem">
      <strong>صورة ${idx + 1}</strong><br>
      الإجابة: ${row.answer || "-"}
      ${row.note ? `<br>ملاحظة: ${row.note}` : ""}
    </div>
  `).join("")
}

/* =========================
   ARCHIVE
========================= */

async function renderArchivePresenter() {
  setTitle("الأرشيف", "اختر الفريق ثم افتح العناصر")

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
      <button class="presenterBtn dark" onclick="sendCommand('startTimer')">بدء المؤقت</button>
      <button class="presenterBtn green" onclick="sendCommand('showAnswer')">إظهار الإجابة</button>
    </div>

    <div class="presenterActions">
      <button class="presenterBtn red" onclick="presenterWrong()">خطأ</button>
      <button class="presenterBtn gray" onclick="sendCommand('undo')">تراجع</button>
      <button class="presenterBtn blue" onclick="sendCommand('nextRound')">الجولة التالية</button>
    </div>

    <button class="presenterBtn blue" onclick="zoomDisplayImage()">تكبير صورة العرض</button>

    <section class="presenterCard">
      <div class="presenterLabel">المطلوب</div>
      <div class="presenterAnswerText" id="archivePresenterRequired">—</div>
    </section>

    <section class="presenterCard">
      <div class="presenterLabel">العناصر</div>
      <div class="presenterArchiveItems" id="archivePresenterItems">جاري التحميل...</div>
    </section>
  `

  setPresenterArchiveRound(presenterArchiveRound)
}

function setPresenterArchiveRound(round) {
  presenterArchiveRound = Number(round)

  for (let i = 1; i <= 4; i++) {
    document.getElementById(`archiveRoundBtn${i}`)?.classList.toggle("active", i === presenterArchiveRound)
  }

  sendCommand("setRound", { round: presenterArchiveRound })
  loadPresenterArchiveItems()

  savePresenterState()
  setTimeout(restorePresenterOpenedButtons, 150)
}

async function loadPresenterArchiveItems() {
  const listBox = document.getElementById("archivePresenterItems")
  const requiredBox = document.getElementById("archivePresenterRequired")

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

  if (listBox) {
    listBox.innerHTML = items.map(item => {
      const isRequired = String(item.label || "").trim() === "المطلوب"
      const hasLabel = String(item.label || "").trim().length > 0
      const title = item.label || `رقم ${item.position}`
      const text = item.text || item.answer || item.title || "-"
      const imageText = item.image ? `<div class="presenterArchiveImageTag">صورة موجودة</div>` : ""

      return `
        <button
          id="parchive_${presenterArchiveRound}_${item.position}"
          class="presenterArchiveItemBtn ${isRequired ? "required" : ""} ${hasLabel ? "hasLabel" : ""}"
          onclick="openArchivePresenterItem(${Number(item.position)}, ${hasLabel ? "true" : "false"})"
        >
          <span class="presenterArchiveItemNo">${item.position}</span>
          <span class="presenterArchiveItemText">
            <strong>${title}</strong>
            <em>${text}</em>
            ${imageText}
          </span>
        </button>
      `
    }).join("")

    restorePresenterOpenedButtons()
  }

  savePresenterState()
}

function openArchivePresenterItem(number, hasLabel = false) {
  if (!presenterSelectedTeam) {
    showToast("اختر الفريق أولاً")
    return
  }

  const btn = document.getElementById(`parchive_${presenterArchiveRound}_${number}`)

  if (btn?.classList.contains("opened")) {
    showToast("العنصر مفتوح")
    return
  }

  if (hasLabel) {
    showToast("هذا العنصر يفتح من زر إظهار الإجابة")
    return
  }

  sendCommand("openNumber", {
    round: presenterArchiveRound,
    number
  })

  btn?.classList.add("opened")
  btn.disabled = true

  savePresenterOpened("archive", number, { round: presenterArchiveRound })
}
/* =========================
   INIT
========================= */

document.addEventListener("DOMContentLoaded", () => {
  refreshPresenterTeamNames()
  loadPresenterModels().then(() => {
    restorePresenterState()
  })
})