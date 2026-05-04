/* =========================
   PRESENTER - FINAL VERSION
========================= */

const GAME_SESSION_ID = "main_game"

let presenterModel = 1
let presenterSegment = null
let presenterTeamAName = "الفريق الأول"
let presenterTeamBName = "الفريق الثاني"
let presenterSelectedTeam = null

/* =========================
   INIT
========================= */

document.addEventListener("DOMContentLoaded", () => {
  startPresenterSessionWatcher()
})

/* =========================
   WATCH DISPLAY SESSION
========================= */

async function loadPresenterSession() {
  const { data } = await db
    .from("game_sessions")
    .select("*")
    .eq("id", GAME_SESSION_ID)
    .maybeSingle()

  if (!data) return null

  presenterModel = Number(data.model || 1)
  presenterTeamAName = data.team_a || "الفريق الأول"
  presenterTeamBName = data.team_b || "الفريق الثاني"
  presenterSegment = data.active_segment || null

  updatePresenterUI()
}

function startPresenterSessionWatcher() {
  setInterval(loadPresenterSession, 700)
}

/* =========================
   SEND COMMAND
========================= */

async function sendCommand(action, payload = {}) {
  const { error } = await db.from("presenter_commands").insert({
    model: presenterModel,
    segment: presenterSegment || "global",
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
function presenterGoHome() {
  sendCommand("goHome")

  presenterSegment = null
  renderPresenterHome()
}
/* =========================
   UI
========================= */
function openPresenterSegment(segment) {
  presenterSegment = segment

  document.getElementById("presenterHome")?.classList.add("hidden")
  document.getElementById("presenterPanel")?.classList.remove("hidden")
  document.getElementById("presenterBackBtn")?.classList.remove("hidden")
  document.getElementById("presenterEndBtn")?.classList.remove("hidden")

  if (segment === "warmup") renderWarmup()
  if (segment === "top10") renderTop10()
  if (segment === "auction") renderAuction()
  if (segment === "who") renderWho()
  if (segment === "final") renderFinal()
  if (segment === "archive") renderArchive()
}

function updatePresenterUI() {
  if (!presenterSegment) {
    renderPresenterHome()
    return
  }

  document.getElementById("presenterHome")?.classList.add("hidden")
  document.getElementById("presenterPanel")?.classList.remove("hidden")
  document.getElementById("presenterBackBtn")?.classList.remove("hidden")
  document.getElementById("presenterEndBtn")?.classList.remove("hidden")

  if (presenterSegment === "warmup") renderWarmup()
  if (presenterSegment === "top10") renderTop10()
  if (presenterSegment === "auction") renderAuction()
  if (presenterSegment === "who") renderWho()
  if (presenterSegment === "final") renderFinal()
  if (presenterSegment === "archive") renderArchive()
}

function renderPresenterHome() {
  document.getElementById("presenterHome")?.classList.remove("hidden")
  document.getElementById("presenterPanel")?.classList.add("hidden")
  document.getElementById("presenterBackBtn")?.classList.add("hidden")
  document.getElementById("presenterEndBtn")?.classList.add("hidden")

  const status = document.getElementById("presenterConnectionStatus")
  const teamA = document.getElementById("presenterHomeTeamA")
  const teamB = document.getElementById("presenterHomeTeamB")

  if (status) status.innerText = "متصل بالعرض ✅ افتح فقرة من شاشة العرض"
  if (teamA) teamA.innerText = presenterTeamAName
  if (teamB) teamB.innerText = presenterTeamBName
}

function renderHome() {
  document.getElementById("presenterHome")?.classList.remove("hidden")
  document.getElementById("presenterPanel")?.classList.add("hidden")

  const box = document.querySelector(".presenterSetupCard")
  if (!box) return

  box.innerHTML = `
    <div class="presenterSetupTitle">لوحة المقدم</div>

    <div class="presenterCard">
      <div class="presenterLabel">الحالة</div>
      <div class="presenterAnswerText">متصل بالعرض ✅</div>
    </div>

    <div class="presenterTeams">
      <button class="presenterBtn orange">${presenterTeamAName}</button>
      <button class="presenterBtn orange">${presenterTeamBName}</button>
    </div>

    <button class="presenterStartBtn" onclick="sendCommand('toggleDisplayControls')">
      إظهار / إخفاء التحكم
    </button>
  `
}

function teamButtons() {
  return `
    <div class="presenterTeams">
      <button class="presenterBtn orange" onclick="selectTeam('A')" id="teamA">${presenterTeamAName}</button>
      <button class="presenterBtn orange" onclick="selectTeam('B')" id="teamB">${presenterTeamBName}</button>
    </div>
  `
}

function selectTeam(team) {
  presenterSelectedTeam = team
  sendCommand("selectTeam", { team })

  document.getElementById("teamA")?.classList.remove("selectedPresenterTeam")
  document.getElementById("teamB")?.classList.remove("selectedPresenterTeam")

  document.getElementById(`team${team}`)?.classList.add("selectedPresenterTeam")
}

function actions() {
  return `
    <div class="presenterActions">
      <button class="presenterBtn green" onclick="sendCommand('correct')">صح</button>
      <button class="presenterBtn red" onclick="sendCommand('wrong')">خطأ</button>
      <button class="presenterBtn gray" onclick="sendCommand('undo')">تراجع</button>
    </div>
  `
}

/* =========================
   WARMUP
========================= */

function renderWarmup() {
  document.getElementById("presenterPanel").innerHTML = `
    ${teamButtons()}

    <div class="presenterActions">
      <button class="presenterBtn gray" onclick="sendCommand('double')">دوبيلا</button>
      <button class="presenterBtn red" onclick="sendCommand('wrong')">✕ خطأ</button>
      <button class="presenterBtn green" onclick="sendCommand('correct')">✓ صح</button>
    </div>

    <section class="presenterCard">
      <div class="presenterLabel">الفئات والأسئلة</div>

      <div class="presenterWarmupCats">
        ${[1,2,3,4].map(cat => `
          <div class="presenterWarmupCat">
            <div class="presenterWarmupCatTitle">الفئة ${cat}</div>

            <div class="presenterWarmupNumbers">
              <button class="presenterNumberBtn" onclick="sendCommand('openNumber',{category:${cat},number:1})">1</button>
              <button class="presenterNumberBtn" onclick="sendCommand('openNumber',{category:${cat},number:2})">2</button>
              <button class="presenterNumberBtn" onclick="sendCommand('openNumber',{category:${cat},number:4})">4</button>
            </div>
          </div>
        `).join("")}
      </div>
    </section>
  `
}

function openWarmup(cat, num) {
  sendCommand("openNumber", { category: cat, number: num })
}

/* =========================
   TOP10
========================= */

function renderTop10() {
  document.getElementById("presenterPanel").innerHTML = `
    ${teamButtons()}

    <div class="presenterActions">
      <button class="presenterBtn gray" onclick="sendCommand('double')">دوبيلا</button>
      <button class="presenterBtn green" onclick="sendCommand('showAnswer')">إظهار الإجابات</button>
      <button class="presenterBtn red" onclick="sendCommand('wrong')">خطأ</button>
    </div>

    <div class="presenterActions">
      <button class="presenterBtn gray" onclick="sendCommand('undo')">تراجع</button>
      <button class="presenterBtn blue" onclick="sendCommand('switchTurn')">تبديل الدور</button>
      <button class="presenterBtn blue" onclick="sendCommand('nextRound')">الجولة التالية</button>
    </div>

    <section class="presenterCard">
      <div class="presenterLabel">الأرقام</div>
      <div class="presenterGrid">
        ${Array.from({ length: 10 }, (_, i) => i + 1).map(n => `
          <button class="presenterNumberBtn" onclick="sendCommand('openNumber',{number:${n}})">${n}</button>
        `).join("")}
      </div>
    </section>
  `
}

/* =========================
   AUCTION
========================= */

function renderAuction() {
  document.getElementById("presenterPanel").innerHTML = `
    ${teamButtons()}

    <div class="presenterActions">
      <button class="presenterBtn gray" onclick="sendCommand('double')">دوبيلا</button>
      <button class="presenterBtn green" onclick="sendCommand('correct')">✓ إجابة صحيحة</button>
      <button class="presenterBtn red" onclick="sendCommand('wrong')">✕ خطأ</button>
    </div>

    <div class="presenterActions">
  <button class="presenterBtn gray" onclick="sendCommand('undo')">تراجع</button>
  <button class="presenterBtn blue" onclick="sendCommand('zoomImage')">تكبير الصورة</button>
</div>

    <section class="presenterCard">
      <div class="presenterLabel">الأرقام</div>
      <div class="presenterGrid four">
        ${Array.from({ length: 8 }, (_, i) => i + 1).map(n => `
          <button class="presenterNumberBtn" onclick="sendCommand('openNumber',{number:${n}})">${n}</button>
        `).join("")}
      </div>
    </section>
  `
}

/* =========================
   WHO
========================= */

function renderWho() {
  document.getElementById("presenterPanel").innerHTML = `
    ${teamButtons()}

    <section class="presenterCard">
      <div class="presenterLabel">اختر النقاط</div>
      <div class="presenterGrid">
        ${[1,2,3,4,5].map(p => `
          <button class="presenterNumberBtn" onclick="sendCommand('setPoints',{points:${p}})">${p}</button>
        `).join("")}
      </div>
    </section>

    <div class="presenterActions">
      <button class="presenterBtn gray" onclick="sendCommand('double')">دوبيلا</button>
      <button class="presenterBtn gray" onclick="sendCommand('compensation')">التعويض</button>
      <button class="presenterBtn green" onclick="sendCommand('correct')">✓ صح</button>
    </div>

    <div class="presenterActions">
      <button class="presenterBtn red" onclick="sendCommand('wrong')">✕ خطأ</button>
    </div>

    <section class="presenterCard">
      <div class="presenterLabel">الأرقام</div>
      <div class="presenterGrid">
        ${Array.from({ length: 15 }, (_, i) => i + 1).map(n => `
          <button class="presenterNumberBtn" onclick="sendCommand('openNumber',{number:${n}})">${n}</button>
        `).join("")}
      </div>
    </section>
  `
}

/* =========================
   FINAL
========================= */

function renderFinal() {
  document.getElementById("presenterPanel").innerHTML = `
    ${teamButtons()}

    <section class="presenterCard">
      <div class="presenterLabel">الجولة</div>
      <div class="presenterRoundTabs">
        <button onclick="setPresenterFinalRound(1)">1</button>
        <button onclick="setPresenterFinalRound(2)">2</button>
        <button onclick="setPresenterFinalRound(3)">3</button>
      </div>
    </section>

    <section class="presenterCard">
      <div class="presenterLabel">الأرقام</div>
      <div class="presenterGrid" id="presenterFinalNumbers"></div>
    </section>

    <div id="presenterFinalControls"></div>
  `

  setPresenterFinalRound(presenterFinalRound || 1)
}

function setPresenterFinalRound(round) {
  presenterFinalRound = Number(round)
  sendCommand("setRound", { round: presenterFinalRound })

  const numbersBox = document.getElementById("presenterFinalNumbers")
  const controlsBox = document.getElementById("presenterFinalControls")
  if (!numbersBox || !controlsBox) return

  let nums = [1, 2, 3, 4, 5, 6]
  if (presenterFinalRound === 2) nums = [1, 2, 3, 4]
  if (presenterFinalRound === 3) nums = [1, 2]

  numbersBox.innerHTML = nums.map(n => `
    <button class="presenterNumberBtn" onclick="sendCommand('openNumber',{round:${presenterFinalRound},number:${n}})">
      ${n}
    </button>
  `).join("")

  if (presenterFinalRound === 1) {
    controlsBox.innerHTML = `
      <div class="presenterActions">
        <button class="presenterBtn gray" onclick="sendCommand('double')">دبل</button>
        <button class="presenterBtn blue" onclick="sendCommand('showQuestion')">إظهار السؤال</button>
        <button class="presenterBtn green" onclick="sendCommand('correct')">إجابة صحيحة</button>
      </div>

      <div class="presenterActions">
        <button class="presenterBtn red" onclick="sendCommand('wrong')">خطأ</button>
        <button class="presenterBtn gray" onclick="sendCommand('undo')">تراجع</button>
        <button class="presenterBtn blue" onclick="sendCommand('nextRound')">الجولة التالية</button>
      </div>
    `
    return
  }

  if (presenterFinalRound === 2) {
    controlsBox.innerHTML = `
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

  controlsBox.innerHTML = `
    <div class="presenterActions">
      <button class="presenterBtn gray" onclick="sendCommand('double')">دبل</button>
      <button class="presenterBtn dark" onclick="sendCommand('startSequence')">بدء عرض الصور</button>
      <button class="presenterBtn blue" onclick="sendCommand('zoomImage')">تكبير الصورة</button>
    </div>

    <div class="presenterActions">
      <button class="presenterBtn green" onclick="sendCommand('showAnswer')">إظهار الإجابة</button>
      <button class="presenterBtn green" onclick="sendCommand('recordRound3Score')">تسجيل النتيجة</button>
      <button class="presenterBtn gray" onclick="sendCommand('undo')">تراجع</button>
    </div>
  `
}

/* =========================
   ARCHIVE
========================= */

function renderArchive() {
  document.getElementById("presenterPanel").innerHTML = `
    ${teamButtons()}

    <div class="presenterActions">
      <button class="presenterBtn dark" onclick="sendCommand('startTimer')">بدء المؤقت</button>
      <button class="presenterBtn gray" onclick="sendCommand('double')">دوبيلا</button>
      <button class="presenterBtn red" onclick="sendCommand('wrong')">خطأ</button>
    </div>

    <div class="presenterActions">
      <button class="presenterBtn green" onclick="sendCommand('showAnswer')">إظهار الإجابة</button>
      <button class="presenterBtn gray" onclick="sendCommand('undo')">تراجع</button>
      <button class="presenterBtn blue" onclick="sendCommand('nextRound')">الجولة التالية</button>
    </div>

    <section class="presenterCard">
      <div class="presenterLabel">العناصر</div>
      <div class="presenterGrid">
        ${Array.from({ length: 12 }, (_, i) => i + 1).map(n => `
          <button class="presenterNumberBtn" onclick="sendCommand('openNumber',{number:${n}})">${n}</button>
        `).join("")}
      </div>
    </section>
  `
}

/* =========================
   HELPERS
========================= */

function showToast(text) {
  const t = document.getElementById("presenterToast")
  if (!t) return

  t.innerText = text
  t.classList.add("show")

  setTimeout(()=>t.classList.remove("show"),1000)
}