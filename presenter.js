/* =========================
   CONFIG
========================= */

const GAME_SESSION_ID = "main_game"

let presenterSession = null
let presenterSegment = null

let presenterTeamAName = "الفريق الأول"
let presenterTeamBName = "الفريق الثاني"

/* =========================
   START
========================= */

document.addEventListener("DOMContentLoaded", () => {
  startPresenterSessionWatcher()
})

/* =========================
   WATCH SESSION
========================= */

async function loadPresenterSession() {
  const { data, error } = await db
    .from("game_sessions")
    .select("*")
    .eq("id", GAME_SESSION_ID)
    .single()

  if (error) {
    console.log(error)
    return null
  }

  presenterSession = data
  return data
}

function startPresenterSessionWatcher() {
  loadPresenterSession()

  setInterval(async () => {
    const session = await loadPresenterSession()
    if (!session) return

    renderPresenterFromSession(session)
  }, 1000)
}

/* =========================
   RENDER FROM SESSION
========================= */

function renderPresenterFromSession(session) {
  presenterSegment = session.active_segment || null
  presenterTeamAName = session.team_a || "الفريق الأول"
  presenterTeamBName = session.team_b || "الفريق الثاني"

  updatePresenterUI()
}

/* =========================
   UI SWITCH
========================= */

function updatePresenterUI() {

  // 🏠 الصفحة الرئيسية
  if (!presenterSegment) {
    document.getElementById("presenterHome")?.classList.remove("hidden")
    document.getElementById("presenterPanel")?.classList.add("hidden")
    return
  }

  // 🎮 داخل الفقرة
  document.getElementById("presenterHome")?.classList.add("hidden")
  document.getElementById("presenterPanel")?.classList.remove("hidden")

  // 🎯 هنا نحدد الفقرة
  if (presenterSegment === "warmup") {
    document.getElementById("presenterTitle").innerText = "جولة التسخين"
  }

  if (presenterSegment === "top10") {
    document.getElementById("presenterTitle").innerText = "Top 10"
  }

  if (presenterSegment === "auction") {
    document.getElementById("presenterTitle").innerText = "جولة المزاد"
  }

  if (presenterSegment === "who") {
    document.getElementById("presenterTitle").innerText = "من هو"
  }

  if (presenterSegment === "final") {
    document.getElementById("presenterTitle").innerText = "الجولة النهائية"
  }

  if (presenterSegment === "archive") {
    document.getElementById("presenterTitle").innerText = "الأرشيف"
  }

  // 👥 تحديث أسماء الفرق
  const a = document.getElementById("presenterTeamAInput")
  const b = document.getElementById("presenterTeamBInput")

  if (a) a.value = presenterTeamAName
  if (b) b.value = presenterTeamBName
}

/* =========================
   SCREENS
========================= */

function renderPresenterHome() {
  const app = document.getElementById("presenterApp")

  app.innerHTML = `
    <div class="presenterHome">
      <h1>لوحة المقدم</h1>
      <p>في انتظار بدء اللعبة...</p>
    </div>
  `
}

function renderPresenterWarmup() {
  renderBasicScreen("جولة التسخين")
}

function renderPresenterTop10() {
  renderBasicScreen("Top 10")
}

function renderPresenterAuction() {
  renderBasicScreen("جولة المزاد")
}

function renderPresenterWho() {
  renderBasicScreen("من هو")
}

function renderPresenterFinal() {
  renderBasicScreen("الجولة النهائية")
}

function renderPresenterArchive() {
  renderBasicScreen("الأرشيف")
}

/* =========================
   BASIC TEMPLATE
========================= */

function renderBasicScreen(title) {
  const app = document.getElementById("presenterApp")

  app.innerHTML = `
    <div class="presenterScreen">
      <h2>${title}</h2>

      <div class="teams">
        <div class="team">${presenterTeamAName}</div>
        <div class="team">${presenterTeamBName}</div>
      </div>

      <div class="note">
        تم ربط الصفحة بالعرض ✅
      </div>
    </div>
  `
}