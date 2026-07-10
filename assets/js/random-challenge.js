/* =========================================================
   RANDOM CHALLENGE / التحدي 
   DISPLAY ONLY - CLEAN VERSION
========================================================= */

const RANDOM_CHALLENGE_STORAGE_KEY = "random_challenge_state_v1"

let randomChallengeState = createDefaultRandomChallengeState()
window.randomChallengeState = randomChallengeState

let randomMediaItems = []
let randomBox1RouletteTimer = null
let randomBox1PreloadedImages = []
let randomBox2Timer = null
let randomBox3Timer = null
/* =========================
   DEFAULT STATE
========================= */

function createDefaultRandomChallengeState() {
  return {
    scores: { A: 0, B: 0 },
    activeTeam: null,
    currentBox: null,
    completed: false,

    usedMediaIds: [],

box1: {
  active: false,
  started: false,
  rolling: false,
  flashing: false,
  finished: false,
  pool: "",
  images: [],
  recentTeamKeys: []
},

box2: {
  active: false,
  finished: false,
  question: "",
  numberInput: "",
  calculatedPoints: 0,
  timer: 30,
  timerRunning: false
},

box3: {
  active: false,
  finished: false,
  question: "",
  activeTeam: null,
  scoringTeam: null,
  scoringBoth: false,
  errors: { A: 0, B: 0 },
  passUsed: { A: false, B: false },
  lastAction: null,
  timer: 5,
  timerRunning: false,
  choosingPoints: false
},

    box4: {
      active: false,
      finished: false
    }
  }
}

/* =========================
   STORAGE
========================= */

function getRandomChallengeState() {
  try {
    return JSON.parse(localStorage.getItem(RANDOM_CHALLENGE_STORAGE_KEY) || "null")
  } catch {
    return null
  }
}

function saveRandomChallengeState() {
  localStorage.setItem(
    RANDOM_CHALLENGE_STORAGE_KEY,
    JSON.stringify(randomChallengeState)
  )

  window.randomChallengeState = randomChallengeState

  window.currentSegmentScores = {
    A: Number(randomChallengeState.scores.A || 0),
    B: Number(randomChallengeState.scores.B || 0)
  }

  if (typeof syncDisplayStateToSession === "function") {
    syncDisplayStateToSession()
  }

  if (typeof updateEndRoundButtonState === "function") {
    updateEndRoundButtonState()
  }
}

function restoreRandomChallengeState() {
  const saved = getRandomChallengeState()

  if (saved) {
    randomChallengeState = {
      ...createDefaultRandomChallengeState(),
      ...saved,
      scores: {
        A: Number(saved?.scores?.A || 0),
        B: Number(saved?.scores?.B || 0)
      }
    }
  } else {
    randomChallengeState = createDefaultRandomChallengeState()
  }

  window.randomChallengeState = randomChallengeState

  window.currentSegmentScores = {
    A: Number(randomChallengeState.scores.A || 0),
    B: Number(randomChallengeState.scores.B || 0)
  }
}

/* =========================
   MEDIA
========================= */

async function loadRandomMediaItems() {
  try {
    const res = await fetch("assets/data/random_media.json?v=" + Date.now())
    const json = await res.json()

    randomMediaItems = Array.isArray(json) ? json : []
    preloadRandomBox1Images()
  } catch (err) {
    console.log("RANDOM MEDIA JSON ERROR:", err)
    randomMediaItems = []
  }
}
function preloadRandomBox1Images() {
  randomBox1PreloadedImages = []

  randomMediaItems.forEach(item => {
    if (!item?.image) return

    const img = new Image()
    img.src = item.image

    randomBox1PreloadedImages.push({
      ...item,
      preloadedSrc: item.image
    })
  })
}

function normalizeRandomBox1Pool(pool) {
  return pool === "world" ? "world" : "saudi"
}

function getRandomBox1PoolTitle(pool) {
  return normalizeRandomBox1Pool(pool) === "world"
    ? "عالمي"
    : "الدوري السعودي"
}

function getRandomBox1PoolItems(pool = "saudi") {
  const safePool = normalizeRandomBox1Pool(pool)

  const shared = window.randomSharedPlayerMedia || {}
  const list = Array.isArray(shared[safePool]) ? shared[safePool] : []

  if (list.length) {
    return list
      .filter(src => !!src)
      .map((src, index) => ({
        id: index + 1,
        image: src
      }))
  }

  return randomBox1PreloadedImages.length >= 2
    ? randomBox1PreloadedImages
    : randomMediaItems
}

function getRandomBox1ImageName(item) {
  const raw =
    item?.image ||
    item?.name ||
    item?.title ||
    ""

  return String(raw)
    .split("/")
    .pop()
    .split("\\")
    .pop()
    .replace(/\.[a-z0-9]+$/i, "")
    .trim()
}

function randomBox1ImageNameHasNumber(item) {
  const name = getRandomBox1ImageName(item)
  return /[0-9٠-٩]/.test(name)
}

function isSpecialImage(item) {
  return randomBox1ImageNameHasNumber(item)
}

function getRandomFromList(list) {
  if (!Array.isArray(list) || !list.length) return null
  return list[Math.floor(Math.random() * list.length)] || null
}

function getRandomBox1TeamKey(item) {
  return getRandomBox1ImageName(item)
    .toLowerCase()
    .replace(/[0-9٠-٩]/g, "")
    .replace(/[()]/g, "")
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function pairHasSameRandomBox1Team(pair = []) {
  if (!Array.isArray(pair) || pair.length < 2) return false

  const key1 = getRandomBox1TeamKey(pair[0])
  const key2 = getRandomBox1TeamKey(pair[1])

  if (!key1 || !key2) return false

  return key1 === key2
}

function pairHasTwoNumberedRandomBox1Images(pair = []) {
  if (!Array.isArray(pair) || pair.length < 2) return false

  return (
    randomBox1ImageNameHasNumber(pair[0]) &&
    randomBox1ImageNameHasNumber(pair[1])
  )
}

function getRandomBox1RecentTeamKeys() {
  if (!randomChallengeState.box1) {
    randomChallengeState.box1 = {}
  }

  if (!Array.isArray(randomChallengeState.box1.recentTeamKeys)) {
    randomChallengeState.box1.recentTeamKeys = []
  }

  return randomChallengeState.box1.recentTeamKeys
}

function rememberRandomBox1Teams(pair = []) {
  const recent = getRandomBox1RecentTeamKeys()

  pair.forEach(item => {
    const key = getRandomBox1TeamKey(item)
    if (!key) return

    recent.unshift(key)
  })

  randomChallengeState.box1.recentTeamKeys = recent.slice(0, 4)
}

function pairHasRecentRandomBox1Team(pair = []) {
  const recent = getRandomBox1RecentTeamKeys()

  return pair.some(item => {
    const key = getRandomBox1TeamKey(item)
    return key && recent.includes(key)
  })
}

function pickRandomPairWithTeamVariety(source = []) {
  let fallback = []

  for (let i = 0; i < 60; i++) {
    const pair = pickRandomPairWithRules(source)

    if (!pair.length) continue
    if (!fallback.length) fallback = pair

    if (pairHasSameRandomBox1Team(pair)) continue
    if (pairHasTwoNumberedRandomBox1Images(pair)) continue
    if (pairHasRecentRandomBox1Team(pair)) continue

    return pair
  }

  for (let i = 0; i < 60; i++) {
    const pair = pickRandomPairWithRules(source)

    if (!pair.length) continue

    if (pairHasSameRandomBox1Team(pair)) continue
    if (pairHasTwoNumberedRandomBox1Images(pair)) continue

    return pair
  }

  return fallback.length ? fallback : pickRandomPairWithRules(source)
}

function getPoolWithoutIds(source, excludedIds = []) {
  const excluded = excludedIds.map(Number)

  return (source || []).filter(item => {
    const id = Number(item?.id || 0)
    return item && item.image && !excluded.includes(id)
  })
}

function pickRandomPairWithRules(source = []) {
  const validSource = (source || []).filter(item => item && item.image)

  if (validSource.length < 2) return []

  const specialPool = validSource.filter(isSpecialImage)
  const normalPool = validSource.filter(item => !isSpecialImage(item))

  let first = null
  let second = null

  if (specialPool.length && normalPool.length) {
    const useSpecial = Math.random() < 0.5

    if (useSpecial) {
      first = getRandomFromList(specialPool)
      second = getRandomFromList(
        getPoolWithoutIds(normalPool, [first?.id])
      )
    } else {
      first = getRandomFromList(normalPool)
      second = getRandomFromList(
        getPoolWithoutIds(validSource, [first?.id]).filter(item => {
          if (isSpecialImage(first)) return !isSpecialImage(item)
          return true
        })
      )
    }
  } else {
    first = getRandomFromList(validSource)

    second = getRandomFromList(
      getPoolWithoutIds(validSource, [first?.id]).filter(item => {
        if (isSpecialImage(first)) return !isSpecialImage(item)
        return true
      })
    )
  }

  if (!first || !second) {
    first = getRandomFromList(validSource)

    second = getRandomFromList(
      getPoolWithoutIds(validSource, [first?.id]).filter(item => {
        if (isSpecialImage(first)) return !isSpecialImage(item)
        return true
      })
    )
  }

  if (!first || !second) return []

  return [first, second]
}
/* =========================
   MAIN RENDER
========================= */

window.renderRandomChallenge = async function () {
  restoreRandomChallengeState()
  await loadRandomMediaItems()

  localStorage.setItem("active_segment", "randomChallenge")

  openSegment("التحدي", buildRandomChallengeHTML())

  renderRandomChallengeScores()
  renderRandomChallengeStage()
  renderRandomChallengeControls()
  highlightRandomChallengeTeam(randomChallengeState.activeTeam)

  saveRandomChallengeState()
}

function buildRandomChallengeHTML() {
  return `
    <div class="randomChallengeWrap" data-segment-key="randomChallenge">

      <div class="randomHeader">

        <button class="randomHeaderBtn" type="button" onclick="handleRandomChallengeBack()">
         رجوع
        </button>

        <div class="randomTeamCard teamA" id="randomTeamABox" onclick="selectRandomChallengeTeam('A')">
          <strong>${escapeDisplayHtml(teamAName || "الفريق الأول")}</strong>
          <b id="randomScoreA">0</b>
        </div>

        <div class="randomTitleBox">
          <h1>التحدي</h1>
        </div>

        <div class="randomTeamCard teamB" id="randomTeamBBox" onclick="selectRandomChallengeTeam('B')">
          <b id="randomScoreB">0</b>
          <strong>${escapeDisplayHtml(teamBName || "الفريق الثاني")}</strong>
        </div>

        <button
  id="endRoundBtn"
  class="randomHeaderBtn danger"
  type="button"
  onclick="handleRandomChallengeEnd()"
>
  إنهاء
</button>

      </div>

      <div class="randomMainStage" id="randomMainStage"></div>

      <div class="randomControlsBar" id="randomControlsBar"></div>

    </div>
  `
}

function renderRandomChallengeScores() {
  const a = document.getElementById("randomScoreA")
  const b = document.getElementById("randomScoreB")

  if (a) a.innerText = Number(randomChallengeState.scores.A || 0)
  if (b) b.innerText = Number(randomChallengeState.scores.B || 0)

  window.currentSegmentScores = {
    A: Number(randomChallengeState.scores.A || 0),
    B: Number(randomChallengeState.scores.B || 0)
  }
}

/* =========================
   TEAM
========================= */

function selectRandomChallengeTeam(team) {
  if (team !== "A" && team !== "B") return

  randomChallengeState.activeTeam =
    randomChallengeState.activeTeam === team ? null : team

  if (typeof setGameActiveTeam === "function") {
    if (randomChallengeState.activeTeam) {
      setGameActiveTeam(randomChallengeState.activeTeam)
    } else {
      clearGameActiveTeam()
    }
  }

  if (
  randomChallengeState.currentBox === 3 &&
  randomChallengeState.activeTeam &&
  !randomChallengeState.box3.choosingPoints
) {
  randomChallengeState.box3.activeTeam = randomChallengeState.activeTeam

  highlightRandomChallengeTeam(randomChallengeState.activeTeam)
  renderRandomChallengeStage()
  renderRandomChallengeControls()
  saveRandomChallengeState()

  setTimeout(() => {
    startRandomBox3Timer()
  }, 80)

  return
}

  highlightRandomChallengeTeam(randomChallengeState.activeTeam)
  saveRandomChallengeState()
}

function highlightRandomChallengeTeam(team) {
  const a = document.getElementById("randomTeamABox")
  const b = document.getElementById("randomTeamBBox")

  if (a) a.classList.remove("active")
  if (b) b.classList.remove("active")

  if (team === "A" && a) a.classList.add("active")
  if (team === "B" && b) b.classList.add("active")
}

function clearRandomChallengeTeamSelection() {
  randomChallengeState.activeTeam = null

  if (randomChallengeState.box3) {
    randomChallengeState.box3.activeTeam = null
  }

  if (typeof clearGameActiveTeam === "function") {
    clearGameActiveTeam()
  }

  highlightRandomChallengeTeam(null)
}

function updateRandomBoxQuestion(box, value) {
  const cleanValue = String(value || "")

  if (box === 2) {
    randomChallengeState.box2.question = cleanValue
  }

  if (box === 3) {
    randomChallengeState.box3.question = cleanValue
  }

  saveRandomChallengeState()
}

function shakeRandomAuctionMetric(el) {
  if (!el) return

  const box =
    el.closest(".randomAuctionLiveCircle") ||
    el.closest(".randomAuctionPointsPro") ||
    el.closest(".randomAuctionInputPro") ||
    el

  box.classList.remove("randomAuctionShake")
  void box.offsetWidth
  box.classList.add("randomAuctionShake")

  setTimeout(() => {
    box.classList.remove("randomAuctionShake")
  }, 360)
}

function setRandomBox2NumberValue(value) {
  const cleanValue = String(value || "").replace(/\D/g, "").slice(0, 5)

  randomChallengeState.box2.numberInput = cleanValue
  const num = Number(cleanValue || 0)

randomChallengeState.box2.points = num

randomChallengeState.box2.calculatedPoints =
  num > 0 && num < 10
    ? 1
    : Math.floor(num / 10)

const input = document.getElementById("randomBox2NumberInput")
const pointsText = document.getElementById("randomBox2PointsText")
const countText = document.getElementById("randomBox2CountText")

if (input) input.value = cleanValue

if (pointsText) {
  const oldPoints = Number(pointsText.innerText || 0)
  const newPoints = Number(randomChallengeState.box2.calculatedPoints || 0)

  pointsText.innerText = newPoints

  if (oldPoints !== newPoints) {
    shakeRandomAuctionMetric(pointsText)
  }
}

if (countText) {
  const oldCount = Number(countText.innerText || 0)
  const newCount = Number(randomChallengeState.box2.points || 0)

  countText.innerText = newCount

  if (oldCount !== newCount) {
    shakeRandomAuctionMetric(countText)
  }
}

saveRandomChallengeState()
}

function appendRandomBox2Digit(digit) {
  const d = String(digit ?? "").replace(/\D/g, "")
  if (d === "") return

  const current = String(randomChallengeState.box2.numberInput || "")
  setRandomBox2NumberValue(current + d)
}

function deleteRandomBox2Digit() {
  const current = String(randomChallengeState.box2.numberInput || "")
  setRandomBox2NumberValue(current.slice(0, -1))
}

function clearRandomBox2Number() {
  setRandomBox2NumberValue("")
}

function increaseRandomBox2Number(step = 10) {
  const current = Number(randomChallengeState.box2.numberInput || 0)
  setRandomBox2NumberValue(String(current + Number(step || 10)))
}

function decreaseRandomBox2Number(step = 10) {
  const current = Number(randomChallengeState.box2.numberInput || 0)
  const next = Math.max(0, current - Number(step || 10))
  setRandomBox2NumberValue(String(next))
}

/* =========================
   STAGE
========================= */

function renderRandomChallengeStage() {
  const stage = document.getElementById("randomMainStage")
  if (!stage) return

  if (!randomChallengeState.currentBox) {
    stage.innerHTML = `
      <div class="randomBoxesGrid randomBoxesGridClean">

        <button class="randomMainBox randomChallengeChoiceBox ${randomChallengeState.box1.finished ? "locked" : ""}" onclick="openRandomChallengeBox(1)">
          <strong>اللاعب المشترك</strong>
        </button>

        <button class="randomMainBox randomChallengeChoiceBox ${randomChallengeState.box2.finished ? "locked" : ""}" onclick="openRandomChallengeBox(2)">
          <strong>المزاد</strong>
        </button>

        <button class="randomMainBox randomChallengeChoiceBox ${randomChallengeState.box3.finished ? "locked" : ""}" onclick="openRandomChallengeBox(3)">
          <strong>ماذا تعرف</strong>
        </button>

        <button class="randomMainBox randomChallengeChoiceBox ${randomChallengeState.box4.finished ? "locked" : ""}" onclick="openRandomChallengeBox(4)">
          <strong>قريبًا</strong>
        </button>

      </div>
    `
    return
  }

  if (randomChallengeState.currentBox === 1) {
    renderRandomChallengeBox1()
    return
  }

  if (randomChallengeState.currentBox === 2) {
    renderRandomChallengeBox2()
    return
  }

  if (randomChallengeState.currentBox === 3) {
    renderRandomChallengeBox3()
    return
  }

  if (randomChallengeState.currentBox === 4) {
    renderRandomChallengePlaceholder("قريبًا", "هذا المربع فارغ حاليًا")
    return
  }
}

function renderRandomChallengeBox1() {
  const stage = document.getElementById("randomMainStage")
  if (!stage) return

  const images = randomChallengeState.box1.images || []
  const img1 = images[0]?.image || ""
  const img2 = images[1]?.image || ""
  const poolTitle = getRandomBox1PoolTitle(randomChallengeState.box1.pool || "saudi")

  if (!randomChallengeState.box1.started) {
    stage.innerHTML = `
      <div class="randomBoxView">

        <div class="randomBoxTitle cleanTitle">
          <h2>اللاعب المشترك</h2>
        </div>

        <div class="randomStartBox randomSharedPlayerStartBox">
          <button class="randomStartBtn randomSaudiBtn" onclick="startRandomChallengeBox1('saudi')">
            الدوري السعودي
          </button>

          <button class="randomStartBtn randomWorldBtn" onclick="startRandomChallengeBox1('world')">
            عالمي
          </button>
        </div>

      </div>
    `
    return
  }

  stage.innerHTML = `
    <div class="randomBoxView">

      <div class="randomBoxTitle cleanTitle">
        <h2>اللاعب المشترك</h2>
        <span class="randomBox1PoolBadge">${poolTitle}</span>
      </div>

      <div class="randomImagesDuel">

        <div class="randomImageCard">
          <img id="randomRouletteImg1" src="${escapeDisplayHtml(img1)}" alt="">
        </div>

        <div class="randomVs">VS</div>

        <div class="randomImageCard">
          <img id="randomRouletteImg2" src="${escapeDisplayHtml(img2)}" alt="">
        </div>

      </div>

    </div>
  `
}

function renderRandomChallengeBox2() {
  const stage = document.getElementById("randomMainStage")
  if (!stage) return

  const numberValue = randomChallengeState.box2.numberInput || ""
  const questionValue = randomChallengeState.box2.question || ""
  const points = Number(randomChallengeState.box2.calculatedPoints || 0)
  const timer = Number(randomChallengeState.box2.timer || 30)
  const timerRunning = !!randomChallengeState.box2.timerRunning
  const timerDanger = timerRunning && timer <= 5

  const auctionFixedPoints = Number(
    randomChallengeState.box2.calculatedPoints || 0
  )

  const auctionCount = Number(
    randomChallengeState.box2.points || numberValue || 0
  )

  stage.innerHTML = `
    <div class="randomBoxView randomBox2CleanPro ${timerRunning ? "isLive" : "isSetup"}">

      <div class="randomQuestionHeader compactQuestionHeader">
        <div class="randomQuestionName">
          المزاد
        </div>

        <input
          class="randomQuestionInput randomQuestionInputOneLine"
          id="randomBox2QuestionInput"
          type="text"
          value="${escapeDisplayHtml(questionValue)}"
          oninput="updateRandomBoxQuestion(2, this.value)"
          placeholder="اكتب السؤال هنا..."
          autocomplete="off"
        />
      </div>

      ${
        !timerRunning
          ? `
            <div class="randomAuctionSetupPro">

              <div class="randomAuctionInputPro">
                <label>اكتب العدد</label>

                <input
                  id="randomBox2NumberInput"
                  type="text"
                  inputmode="numeric"
                  value="${escapeDisplayHtml(numberValue)}"
                  oninput="updateRandomBox2Number(this.value)"
                  placeholder="0"
                  autocomplete="off"
                />

                <div class="oldAuctionKeypad randomAuctionKeypadPro">
                  ${[1,2,3,4,5,6,7,8,9].map(n => `
                    <button type="button" onpointerdown="event.preventDefault(); appendRandomBox2Digit(${n})">${n}</button>
                  `).join("")}

                  <button type="button" class="clear" onpointerdown="event.preventDefault(); clearRandomBox2Number()">مسح</button>
                  <button type="button" onpointerdown="event.preventDefault(); appendRandomBox2Digit(0)">0</button>
                  <button type="button" class="back" onpointerdown="event.preventDefault(); deleteRandomBox2Digit()">⌫</button>
                </div>
              </div>

              <div class="randomAuctionPointsPro">
                <small>النقاط</small>
                <strong id="randomBox2PointsText">${points}</strong>
              </div>

            </div>
          `
          : `
            <div class="randomAuctionLivePro">

              <div class="randomAuctionLiveCircle randomAuctionLivePoints">
                <small>النقاط</small>
                <strong id="randomBox2PointsText">${auctionFixedPoints}</strong>
              </div>

              <div class="randomAuctionLiveCircle randomAuctionLiveTimer ${timerDanger ? "dangerPulse" : ""}">
                <small>المؤقت</small>
                <strong id="randomBox2TimerText">${timer}</strong>
              </div>

              <div class="randomAuctionLiveCircle randomAuctionLiveCount">
                <small>العدد</small>
                <strong id="randomBox2CountText">${auctionCount}</strong>
              </div>

            </div>
          `
      }

    </div>
  `
}

function renderRandomChallengeBox3() {
  const stage = document.getElementById("randomMainStage")
  if (!stage) return

  const activeTeam = randomChallengeState.box3.activeTeam || randomChallengeState.activeTeam || null
  const timer = Number(randomChallengeState.box3.timer || 5)
  const questionValue = randomChallengeState.box3.question || ""

  const errorsA = Number(randomChallengeState.box3.errors?.A || 0)
  const errorsB = Number(randomChallengeState.box3.errors?.B || 0)

  const teamAActive = activeTeam === "A" ? "active" : ""
  const teamBActive = activeTeam === "B" ? "active" : ""

  const errorsAHtml = [1, 2, 3].map(i => {
    return `<span class="${i <= errorsA ? "used" : ""}">×</span>`
  }).join("")

  const errorsBHtml = [1, 2, 3].map(i => {
    return `<span class="${i <= errorsB ? "used" : ""}">×</span>`
  }).join("")

if (randomChallengeState.box3.choosingPoints) {
  const scoringBoth = !!randomChallengeState.box3.scoringBoth
  const scoringTeam =
    randomChallengeState.box3.scoringTeam ||
    getRandomBox3ScoringInfo().team

  const scoringTeamName = scoringBoth
    ? "الفريقين"
    : scoringTeam === "A"
      ? (teamAName || "الفريق الأول")
      : (teamBName || "الفريق الثاني")

  stage.innerHTML = `
    <div class="randomBoxView">

      <div class="randomQuestionHeader resultOnly">
  <div class="randomQuestionName">
    نتيجة ماذا تعرف
  </div>

  <div class="randomQuestionText">
    ${escapeDisplayHtml(questionValue || "بدون سؤال")}
  </div>
</div>

      <div class="randomSpeedResult">

        <div class="randomSpeedResultWinner">
          <small>تسجيل النقاط للفريق</small>
          <strong>${escapeDisplayHtml(scoringTeamName)}</strong>
        </div>

        <div class="randomSpeedResultErrors">

          <div>
            <small>${escapeDisplayHtml(teamAName || "الفريق الأول")}</small>
            <strong>${errorsA}</strong>
            <span>أخطاء</span>
          </div>

          <div>
            <small>${escapeDisplayHtml(teamBName || "الفريق الثاني")}</small>
            <strong>${errorsB}</strong>
            <span>أخطاء</span>
          </div>

        </div>

        <div class="randomSpeedPointsBtns">
          <button onclick="scoreRandomBox3Points(1)">1</button>
          <button onclick="scoreRandomBox3Points(2)">2</button>
          <button onclick="scoreRandomBox3Points(3)">3</button>
        </div>

      </div>

    </div>
  `
  return
}

  stage.innerHTML = `
    <div class="randomBoxView">

      <div class="randomQuestionHeader compactQuestionHeader randomBox3QuestionHeader">
  <div class="randomQuestionName">
    ماذا تعرف
  </div>

  <input
    class="randomQuestionInput randomQuestionInputOneLine"
    id="randomBox3QuestionInput"
    type="text"
    value="${escapeDisplayHtml(questionValue)}"
    oninput="updateRandomBoxQuestion(3, this.value)"
    placeholder="اكتب السؤال هنا..."
    autocomplete="off"
  />
</div>

      <div class="randomSpeedChallenge">

        <div class="randomSpeedTeam ${teamAActive}">
  <strong class="randomSpeedTeamName">
    ${escapeDisplayHtml(teamAName || "الفريق الأول")}
  </strong>

  <div class="randomTeamErrors">
    ${errorsAHtml}
  </div>
</div>

        <div class="randomSpeedCenter">
          <small>المؤقت</small>
          <strong id="randomBox3TimerText">${timer}</strong>
        </div>

        <div class="randomSpeedTeam ${teamBActive}">
  <strong class="randomSpeedTeamName">
    ${escapeDisplayHtml(teamBName || "الفريق الثاني")}
  </strong>

  <div class="randomTeamErrors">
    ${errorsBHtml}
  </div>
</div>

      </div>

    </div>
  `
}

function updateRandomBox1RouletteImages(img1, img2) {
  const el1 = document.getElementById("randomRouletteImg1")
  const el2 = document.getElementById("randomRouletteImg2")

  if (el1 && img1?.image) {
    el1.src = img1.image
  }

  if (el2 && img2?.image) {
    el2.src = img2.image
  }
}



function renderRandomChallengePlaceholder(title, text) {
  const stage = document.getElementById("randomMainStage")
  if (!stage) return

  stage.innerHTML = `
    <div class="randomBoxView">

      <div class="randomBoxTitle">
        <span>التحدي</span>
        <h2>${escapeDisplayHtml(title)}</h2>
      </div>

      <div class="randomPlaceholder">
        ${escapeDisplayHtml(text)}
      </div>

    </div>
  `
}

/* =========================
   BOX ACTIONS
========================= */

function openRandomChallengeBox(number) {
  const n = Number(number)

  if (randomChallengeState.currentBox) {
    showGameToast("أنهِ المربع الحالي أولاً")
    return
  }

  if (n === 1 && randomChallengeState.box1.finished) return
  if (n === 2 && randomChallengeState.box2.finished) return
  if (n === 3 && randomChallengeState.box3.finished) return
  if (n === 4 && randomChallengeState.box4.finished) return

  randomChallengeState.currentBox = n
  clearRandomChallengeTeamSelection()

if (n === 1) {
  randomChallengeState.box1.active = true
  randomChallengeState.box1.started = false
  randomChallengeState.box1.pool = ""
  randomChallengeState.box1.images = []
}

  if (n === 2) {
    randomChallengeState.box2.active = true
  }

if (n === 3) {
  randomChallengeState.box3.active = true
  randomChallengeState.box3.activeTeam = randomChallengeState.activeTeam || null
  randomChallengeState.box3.scoringTeam = null
  randomChallengeState.box3.scoringBoth = false
  randomChallengeState.box3.errors = { A: 0, B: 0 }
  randomChallengeState.box3.passUsed = { A: false, B: false }
  randomChallengeState.box3.lastAction = null
  randomChallengeState.box3.timer = 5
  randomChallengeState.box3.timerRunning = false
  randomChallengeState.box3.choosingPoints = false
}

  if (n === 4) {
    randomChallengeState.box4.active = true
  }

  renderRandomChallengeStage()
  renderRandomChallengeControls()
  saveRandomChallengeState()

  if (typeof playGameSound === "function") {
    playGameSound("open")
  }
}

function updateRandomBox2Number(value) {
  setRandomBox2NumberValue(value)
}

function startRandomBox2Timer() {
  if (randomChallengeState.currentBox !== 2) {
    showGameToast("افتح المزاد أولاً")
    return
  }

  if (randomBox2Timer) {
    clearInterval(randomBox2Timer)
    randomBox2Timer = null
  }

  randomChallengeState.box2.timer = 30
  randomChallengeState.box2.timerRunning = true

  saveRandomChallengeState()
  renderRandomChallengeStage()
  renderRandomChallengeControls()

  randomBox2Timer = setInterval(() => {
    randomChallengeState.box2.timer -= 1

    const timerText = document.getElementById("randomBox2TimerText")
    const timerBox = document.querySelector(".randomAuctionLiveTimer")

    if (timerText) {
      timerText.innerText = randomChallengeState.box2.timer
    }
    if (timerBox) {
  timerBox.classList.toggle(
    "dangerPulse",
    randomChallengeState.box2.timer <= 5
  )

  if (randomChallengeState.box2.timer <= 5) {
    timerBox.classList.remove("randomAuctionTimerBeat")
    void timerBox.offsetWidth
    timerBox.classList.add("randomAuctionTimerBeat")
  }
}

    if (timerBox) {
      timerBox.classList.toggle(
        "dangerPulse",
        randomChallengeState.box2.timer <= 5
      )
    }

    if (randomChallengeState.box2.timer <= 0) {
      clearInterval(randomBox2Timer)
      randomBox2Timer = null

      randomChallengeState.box2.timer = 0
      randomChallengeState.box2.timerRunning = false

      saveRandomChallengeState()

      if (typeof playGameSound === "function") {
        playGameSound("timeout")
      }

     
    }
  }, 1000)
}

function resetRandomBox2AfterScore() {
  clearRandomChallengeTeamSelection()

  randomChallengeState.box2.question = ""
  randomChallengeState.box2.numberInput = ""
  randomChallengeState.box2.calculatedPoints = 0
  randomChallengeState.box2.timer = 30
  randomChallengeState.box2.timerRunning = false

  if (randomBox2Timer) {
    clearInterval(randomBox2Timer)
    randomBox2Timer = null
  }

  renderRandomChallengeScores()
  renderRandomChallengeStage()
  renderRandomChallengeControls()
  saveRandomChallengeState()
}

function getRandomBox2Points() {
  const numberValue = Number(randomChallengeState.box2.numberInput || 0)

  if (numberValue > 0 && numberValue < 10) {
    return 1
  }

  return Math.floor(numberValue / 10)
}

function startRandomChallengeBox1(pool = "saudi") {
  if (randomChallengeState.currentBox !== 1) {
    showGameToast("افتح المربع أولاً")
    return
  }

  const safePool = normalizeRandomBox1Pool(pool)
  const source = getRandomBox1PoolItems(safePool)

  if (!Array.isArray(source) || source.length < 2) {
    showGameToast(`لا توجد صور كافية في ${getRandomBox1PoolTitle(safePool)}`)
    return
  }

  if (randomBox1RouletteTimer) {
    clearInterval(randomBox1RouletteTimer)
    randomBox1RouletteTimer = null
  }

  clearRandomChallengeTeamSelection()

  const firstPair = pickRandomPairWithTeamVariety(source)

  if (firstPair.length < 2) {
    showGameToast("تعذر تجهيز الصورتين")
    return
  }

  randomChallengeState.box1.pool = safePool
  randomChallengeState.box1.started = true
  randomChallengeState.box1.rolling = true
  randomChallengeState.box1.flashing = false
  randomChallengeState.box1.images = firstPair

  renderRandomChallengeStage()
  renderRandomChallengeControls()

  if (typeof playGameSound === "function") {
    playGameSound("open")
  }

  let ticks = 0
  const maxTicks = 65

  randomBox1RouletteTimer = setInterval(() => {
    ticks++

    const pair = pickRandomPairWithTeamVariety(source)

    if (pair.length >= 2) {
      updateRandomBox1RouletteImages(pair[0], pair[1])
    }

    if (ticks >= maxTicks) {
      clearInterval(randomBox1RouletteTimer)
      randomBox1RouletteTimer = null

      const finalImages = pickRandomPairWithTeamVariety(source)

      if (finalImages.length < 2) {
        showGameToast("تعذر اختيار الصور")

        randomChallengeState.box1.started = false
        randomChallengeState.box1.rolling = false
        randomChallengeState.box1.flashing = false
        randomChallengeState.box1.pool = ""
        randomChallengeState.box1.images = []

        renderRandomChallengeStage()
        renderRandomChallengeControls()
        saveRandomChallengeState()
        return
      }

      randomChallengeState.box1.rolling = false
      randomChallengeState.box1.flashing = false
      randomChallengeState.box1.images = finalImages
      rememberRandomBox1Teams(finalImages)

      updateRandomBox1RouletteImages(finalImages[0], finalImages[1])
      renderRandomChallengeControls()
      saveRandomChallengeState()
    }
  }, 10)
}

function finishRandomChallengeCurrentBox() {
  const box = Number(randomChallengeState.currentBox || 0)
  if (randomBox1RouletteTimer) {
  clearInterval(randomBox1RouletteTimer)
  randomBox1RouletteTimer = null
}

  if (!box) return

if (box === 1) {
  randomChallengeState.box1.active = false
  randomChallengeState.box1.started = false
  randomChallengeState.box1.rolling = false
  randomChallengeState.box1.flashing = false
  randomChallengeState.box1.finished = true
  randomChallengeState.box1.pool = ""
  randomChallengeState.box1.images = []
}

if (box === 2) {
  if (randomBox2Timer) {
    clearInterval(randomBox2Timer)
    randomBox2Timer = null
  }

  randomChallengeState.box2.active = false
  randomChallengeState.box2.finished = true
  randomChallengeState.box2.numberInput = ""
  randomChallengeState.box2.question = ""
  randomChallengeState.box2.calculatedPoints = 0
  randomChallengeState.box2.timer = 30
  randomChallengeState.box2.timerRunning = false
}

if (box === 3) {
  if (randomBox3Timer) {
    clearInterval(randomBox3Timer)
    randomBox3Timer = null
  }

  randomChallengeState.box3.active = false
  randomChallengeState.box3.finished = true
  randomChallengeState.box3.activeTeam = null
  randomChallengeState.box3.errors = { A: 0, B: 0 }
  randomChallengeState.box3.passUsed = { A: false, B: false }
  randomChallengeState.box3.lastAction = null
  randomChallengeState.box3.question = ""
  randomChallengeState.box3.timer = 5
  randomChallengeState.box3.timerRunning = false
  randomChallengeState.box3.choosingPoints = false
}

  if (box === 4) {
    randomChallengeState.box4.active = false
    randomChallengeState.box4.finished = true
  }

  randomChallengeState.currentBox = null

  checkRandomChallengeCompleted()

  renderRandomChallengeScores()
  renderRandomChallengeStage()
  renderRandomChallengeControls()
  saveRandomChallengeState()
}

function randomChallengeCorrect() {
  const team = randomChallengeState.activeTeam

  if (!randomChallengeState.currentBox) {
    showGameToast("افتح مربع أولاً")
    return
  }

  if (!team) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  if (randomChallengeState.currentBox === 1 && !randomChallengeState.box1.started) {
    showGameToast("اضغط بدء أولاً")
    return
  }

  if (randomChallengeState.currentBox === 1 && randomChallengeState.box1.rolling) {
    showGameToast("انتظر انتهاء القرعة")
    return
  }

  if (randomChallengeState.currentBox === 1) {
    randomChallengeState.scores[team] += 1
    clearRandomChallengeTeamSelection()

    if (typeof flashScreen === "function") flashScreen("correct")
    if (typeof playGameSound === "function") playGameSound("correct")

    randomChallengeState.box1.started = false
    randomChallengeState.box1.rolling = false
    randomChallengeState.box1.flashing = false
    randomChallengeState.box1.pool = ""
    randomChallengeState.box1.images = []

    renderRandomChallengeScores()
    renderRandomChallengeStage()
    renderRandomChallengeControls()
    saveRandomChallengeState()
    return
  }

  if (randomChallengeState.currentBox === 2) {
    const points = getRandomBox2Points()
    if (!points) return

    randomChallengeState.scores[team] += points
    clearRandomChallengeTeamSelection()

    if (typeof flashScreen === "function") flashScreen("correct")
    if (typeof playGameSound === "function") playGameSound("correct")

    resetRandomBox2AfterScore()
    return
  }

  if (typeof flashScreen === "function") flashScreen("correct")
  if (typeof playGameSound === "function") playGameSound("correct")

  finishRandomChallengeCurrentBox()
}

function randomChallengeWrong() {
  if (!randomChallengeState.currentBox) {
    showGameToast("افتح مربع أولاً")
    return
  }

  if (randomChallengeState.currentBox === 2) {
    const team = randomChallengeState.activeTeam

    if (!team) {
      showGameToast("اختر الفريق أولاً")
      return
    }

    const numberValue = Number(randomChallengeState.box2.numberInput || 0)
    const points = getRandomBox2Points()

    if (!points) return

    if (numberValue >= 10) {
      const otherTeam = team === "A" ? "B" : "A"
      randomChallengeState.scores[otherTeam] += points
    }

    if (typeof flashScreen === "function") flashScreen("wrong")
    if (typeof playGameSound === "function") playGameSound("wrong")

    clearRandomChallengeTeamSelection()
    resetRandomBox2AfterScore()
    return
  }

  if (typeof flashScreen === "function") flashScreen("wrong")
  if (typeof playGameSound === "function") playGameSound("wrong")
}

function randomChallengeSkip() {
  if (!randomChallengeState.currentBox) {
    showGameToast("افتح مربع أولاً")
    return
  }

  if (randomChallengeState.currentBox === 1) {
    if (randomBox1RouletteTimer) {
      clearInterval(randomBox1RouletteTimer)
      randomBox1RouletteTimer = null
    }

    randomChallengeState.box1.started = false
    randomChallengeState.box1.rolling = false
    randomChallengeState.box1.flashing = false
    randomChallengeState.box1.images = []

    renderRandomChallengeStage()
    renderRandomChallengeControls()
    saveRandomChallengeState()

    setTimeout(() => {
      startRandomChallengeBox1(randomChallengeState.box1.pool || "saudi")
    }, 60)

    return
  }

  finishRandomChallengeCurrentBox()
}
function startRandomBox3Timer() {
  if (randomChallengeState.currentBox !== 3) return

  const selectedTeam = randomChallengeState.box3.activeTeam || randomChallengeState.activeTeam

  if (!selectedTeam) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  if (randomBox3Timer) {
    clearInterval(randomBox3Timer)
    randomBox3Timer = null
  }

  randomChallengeState.box3.activeTeam = selectedTeam
  randomChallengeState.activeTeam = selectedTeam
  randomChallengeState.box3.timer = 5
  randomChallengeState.box3.timerRunning = true

  highlightRandomChallengeTeam(selectedTeam)
  renderRandomChallengeStage()
  renderRandomChallengeControls()
  saveRandomChallengeState()

  randomBox3Timer = setInterval(() => {
    randomChallengeState.box3.timer -= 1

    const timerText = document.getElementById("randomBox3TimerText")
    if (timerText) timerText.innerText = randomChallengeState.box3.timer

    if (randomChallengeState.box3.timer <= 0) {
      clearInterval(randomBox3Timer)
      randomBox3Timer = null

      randomChallengeState.box3.timer = 0
      randomChallengeState.box3.timerRunning = false

      saveRandomChallengeState()

      if (typeof playGameSound === "function") {
        playGameSound("timeout")
      }

    }
  }, 1000)
}

function switchRandomBox3Team() {
  if (randomChallengeState.currentBox !== 3) return

  if (randomBox3Timer) {
    clearInterval(randomBox3Timer)
    randomBox3Timer = null
  }

  const current = randomChallengeState.box3.activeTeam || randomChallengeState.activeTeam

  if (!current) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  const nextTeam = current === "A" ? "B" : "A"

  randomChallengeState.box3.activeTeam = nextTeam
  randomChallengeState.activeTeam = nextTeam
  randomChallengeState.box3.timer = 5
  randomChallengeState.box3.timerRunning = false

  highlightRandomChallengeTeam(nextTeam)
  renderRandomChallengeStage()
  renderRandomChallengeControls()
  saveRandomChallengeState()

  setTimeout(() => {
    startRandomBox3Timer()
  }, 80)
}

function randomBox3Wrong() {
  if (randomChallengeState.currentBox !== 3) return

  const team = randomChallengeState.box3.activeTeam || randomChallengeState.activeTeam

  if (!team) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  if (!randomChallengeState.box3.errors || typeof randomChallengeState.box3.errors !== "object") {
    randomChallengeState.box3.errors = { A: 0, B: 0 }
  }

  randomChallengeState.box3.errors[team] =
    Number(randomChallengeState.box3.errors[team] || 0) + 1

  if (randomChallengeState.box3.errors[team] > 3) {
    randomChallengeState.box3.errors[team] = 3
  }

  randomChallengeState.box3.lastAction = "wrong"

  if (typeof flashScreen === "function") flashScreen("wrong")
  if (typeof playGameSound === "function") playGameSound("wrong")

  if (Number(randomChallengeState.box3.errors[team] || 0) >= 3) {
    finishRandomBox3ToPoints()
    return
  }

  switchRandomBox3Team()
}

function randomBox3Pass() {
  if (randomChallengeState.currentBox !== 3) return

  const team = randomChallengeState.box3.activeTeam || randomChallengeState.activeTeam

  if (!team) {
    showGameToast("اختر الفريق أولاً")
    return
  }

  if (!randomChallengeState.box3.errors || typeof randomChallengeState.box3.errors !== "object") {
    randomChallengeState.box3.errors = { A: 0, B: 0 }
  }

  if (!randomChallengeState.box3.passUsed || typeof randomChallengeState.box3.passUsed !== "object") {
    randomChallengeState.box3.passUsed = { A: false, B: false }
  }

  const teamErrors = Number(randomChallengeState.box3.errors[team] || 0)

  if (teamErrors !== 2) {
    showGameToast("الباس متاح فقط إذا كان على الفريق خطأين")
    return
  }

  if (randomChallengeState.box3.passUsed[team]) {
    showGameToast("الفريق استخدم الباس")
    return
  }

  if (randomChallengeState.box3.lastAction === "pass") {
    showGameToast("ما ينفع باس مرتين ورا بعض")
    return
  }

  randomChallengeState.box3.passUsed[team] = true
  randomChallengeState.box3.lastAction = "pass"

  switchRandomBox3Team()
}

function getRandomBox3ScoringInfo() {
  const errorsA = Number(randomChallengeState.box3.errors?.A || 0)
  const errorsB = Number(randomChallengeState.box3.errors?.B || 0)

  if (errorsA === 0 && errorsB === 0) {
    return {
      team: null,
      both: true
    }
  }

  if (errorsA < errorsB) {
    return {
      team: "A",
      both: false
    }
  }

  if (errorsB < errorsA) {
    return {
      team: "B",
      both: false
    }
  }

  return {
    team: randomChallengeState.box3.activeTeam || randomChallengeState.activeTeam || null,
    both: false
  }
}

function finishRandomBox3ToPoints() {
  if (randomChallengeState.currentBox !== 3) return

  if (randomBox3Timer) {
    clearInterval(randomBox3Timer)
    randomBox3Timer = null
  }

  const scoringInfo = getRandomBox3ScoringInfo()

  randomChallengeState.box3.scoringTeam = scoringInfo.team
  randomChallengeState.box3.scoringBoth = scoringInfo.both
  randomChallengeState.box3.timer = 5
  randomChallengeState.box3.timerRunning = false
  randomChallengeState.box3.choosingPoints = true

  if (scoringInfo.both) {
    randomChallengeState.activeTeam = null
    randomChallengeState.box3.activeTeam = null

    const a = document.getElementById("randomTeamABox")
    const b = document.getElementById("randomTeamBBox")

    if (a) a.classList.add("active")
    if (b) b.classList.add("active")
  } else if (scoringInfo.team) {
    randomChallengeState.activeTeam = scoringInfo.team
    randomChallengeState.box3.activeTeam = scoringInfo.team
    highlightRandomChallengeTeam(scoringInfo.team)
  }

  renderRandomChallengeStage()
  renderRandomChallengeControls()
  saveRandomChallengeState()
}

function scoreRandomBox3Points(points) {
  const value = Number(points || 0)

  if (![1, 2, 3].includes(value)) return

  const scoringBoth = !!randomChallengeState.box3.scoringBoth
  const team =
    randomChallengeState.box3.scoringTeam ||
    getRandomBox3ScoringInfo().team

  if (scoringBoth) {
    randomChallengeState.scores.A += value
    randomChallengeState.scores.B += value
  } else {
    if (!team) {
      showGameToast("لا يوجد فريق لتسجيل النقاط")
      return
    }

    randomChallengeState.scores[team] += value
  }

  if (typeof flashScreen === "function") flashScreen("correct")
  if (typeof playGameSound === "function") playGameSound("correct")

  if (typeof clearRandomChallengeTeamSelection === "function") {
    clearRandomChallengeTeamSelection()
  }

  randomChallengeState.box3.question = ""
  randomChallengeState.box3.scoringTeam = null
  randomChallengeState.box3.scoringBoth = false
  randomChallengeState.box3.activeTeam = null
  randomChallengeState.box3.errors = { A: 0, B: 0 }
  randomChallengeState.box3.passUsed = { A: false, B: false }
  randomChallengeState.box3.lastAction = null
  randomChallengeState.box3.timer = 5
  randomChallengeState.box3.timerRunning = false
  randomChallengeState.box3.choosingPoints = false

  renderRandomChallengeScores()
  renderRandomChallengeStage()
  renderRandomChallengeControls()
  saveRandomChallengeState()
}

function checkRandomChallengeCompleted() {
  randomChallengeState.completed =
    !!randomChallengeState.box1.finished &&
    !!randomChallengeState.box2.finished &&
    !!randomChallengeState.box3.finished &&
    !!randomChallengeState.box4.finished
}

/* =========================
   CONTROLS
========================= */

function renderRandomChallengeControls() {
  const controls = document.getElementById("randomControlsBar")
  if (!controls) return

  const hasCurrent = !!randomChallengeState.currentBox

  controls.classList.remove("cols4", "cols5")

  if (!hasCurrent) {
    controls.innerHTML = ""
    controls.style.display = "none"
    return
  }

  controls.style.display = "grid"

  const isBox1 = randomChallengeState.currentBox === 1
  const isBox2 = randomChallengeState.currentBox === 2
  const isBox3 = randomChallengeState.currentBox === 3
  const canSkip = !isBox1 || randomChallengeState.box1.started

  if (isBox2) {
    controls.classList.add("cols4")

    controls.innerHTML = `
      <button class="randomCtrlBtn" onclick="startRandomBox2Timer()">
        بدء المؤقت
      </button>

      <button class="randomCtrlBtn correct" onclick="randomChallengeCorrect()">
        صح
      </button>

      <button class="randomCtrlBtn wrong" onclick="randomChallengeWrong()">
        خطأ
      </button>

      <button class="randomCtrlBtn danger" onclick="finishRandomChallengeCurrentBox()">
        إنهاء المربع
      </button>
    `
    return
  }

  if (isBox3) {
    controls.classList.add("cols5")

    const box3Team = randomChallengeState.box3.activeTeam || randomChallengeState.activeTeam
    const box3Errors = randomChallengeState.box3.errors || { A: 0, B: 0 }
    const box3PassUsed = randomChallengeState.box3.passUsed || { A: false, B: false }

    const canBox3Pass =
      box3Team &&
      Number(box3Errors[box3Team] || 0) === 2 &&
      !box3PassUsed[box3Team] &&
      randomChallengeState.box3.lastAction !== "pass" &&
      !randomChallengeState.box3.choosingPoints

    controls.innerHTML = `
      <button class="randomCtrlBtn" onclick="finishRandomBox3ToPoints()">
        إنهاء الجولة
      </button>

      <button class="randomCtrlBtn wrong" onclick="randomBox3Wrong()" ${randomChallengeState.box3.choosingPoints ? "disabled" : ""}>
        خطأ
      </button>

      <button class="randomCtrlBtn" onclick="randomBox3Pass()" ${canBox3Pass ? "" : "disabled"}>
        باس
      </button>

      <button class="randomCtrlBtn" onclick="switchRandomBox3Team()" ${randomChallengeState.box3.choosingPoints ? "disabled" : ""}>
        تبديل الفريق
      </button>

      <button class="randomCtrlBtn danger" onclick="finishRandomChallengeCurrentBox()">
        إنهاء الرقم
      </button>
    `
    return
  }

  controls.classList.add("cols4")

  controls.innerHTML = `
    <button class="randomCtrlBtn correct" onclick="randomChallengeCorrect()" ${hasCurrent ? "" : "disabled"}>
      صح
    </button>

    <button class="randomCtrlBtn wrong" onclick="randomChallengeWrong()" ${hasCurrent ? "" : "disabled"}>
      خطأ
    </button>

    <button class="randomCtrlBtn" onclick="randomChallengeSkip()" ${canSkip ? "" : "disabled"}>
      ${isBox1 ? "إعادة القرعة" : "تخطي"}
    </button>

    <button class="randomCtrlBtn danger" onclick="finishRandomChallengeCurrentBox()" ${hasCurrent ? "" : "disabled"}>
      إنهاء المربع
    </button>
  `
}

/* =========================
   HEADER ACTIONS
========================= */

function hasRandomChallengeProgress() {
  return (
    !!randomChallengeState.box1?.finished ||
    !!randomChallengeState.box2?.finished ||
    !!randomChallengeState.box3?.finished ||
    !!randomChallengeState.box4?.finished ||
    Number(randomChallengeState.scores?.A || 0) > 0 ||
    Number(randomChallengeState.scores?.B || 0) > 0
  )
}

function goRandomChallengeHome() {
  if (typeof goHome === "function") {
    goHome()
    return
  }

  if (typeof showSegmentsScreen === "function") {
    showSegmentsScreen()
    return
  }

  if (typeof goBackToSegments === "function") {
    goBackToSegments()
    return
  }

  if (typeof backToSegments === "function") {
    backToSegments()
    return
  }

  if (typeof showDisplayHome === "function") {
    showDisplayHome()
    return
  }
}

function handleRandomChallengeBack() {
  /*
    داخل مربع = يرجع لشاشة المربعات
    في شاشة المربعات = يرجع للرئيسية
  */

  if (randomChallengeState.currentBox) {
    if (randomBox1RouletteTimer) {
      clearInterval(randomBox1RouletteTimer)
      randomBox1RouletteTimer = null
    }

    if (randomBox2Timer) {
      clearInterval(randomBox2Timer)
      randomBox2Timer = null
    }

    if (randomBox3Timer) {
      clearInterval(randomBox3Timer)
      randomBox3Timer = null
    }

    randomChallengeState.currentBox = null
    randomChallengeState.activeTeam = null

    if (randomChallengeState.box2) {
      randomChallengeState.box2.timerRunning = false
    }

    if (randomChallengeState.box3) {
      randomChallengeState.box3.activeTeam = null
      randomChallengeState.box3.timerRunning = false
    }

    if (typeof clearGameActiveTeam === "function") {
      clearGameActiveTeam()
    }

    highlightRandomChallengeTeam(null)
    renderRandomChallengeStage()
    renderRandomChallengeControls()
    saveRandomChallengeState()

    return
  }

  goRandomChallengeHome()
}

function handleRandomChallengeEnd() {
  if (!hasRandomChallengeProgress()) {
    showGameToast("أنهِ مربعًا واحدًا على الأقل")
    return
  }

  if (randomChallengeState.currentBox) {
    showGameToast("ارجع لشاشة المربعات أولاً")
    return
  }

  randomChallengeState.completed = true
  randomChallengeState.activeTeam = null

  if (randomBox1RouletteTimer) {
    clearInterval(randomBox1RouletteTimer)
    randomBox1RouletteTimer = null
  }

  if (randomBox2Timer) {
    clearInterval(randomBox2Timer)
    randomBox2Timer = null
  }

  if (randomBox3Timer) {
    clearInterval(randomBox3Timer)
    randomBox3Timer = null
  }

  if (typeof clearGameActiveTeam === "function") {
    clearGameActiveTeam()
  }

  highlightRandomChallengeTeam(null)
  renderRandomChallengeScores()
  renderRandomChallengeControls()
  saveRandomChallengeState()

  if (typeof updateEndRoundButtonState === "function") {
    updateEndRoundButtonState()
  }

  if (typeof endCurrentSegment === "function") {
    endCurrentSegment()
  }
}

/* =========================
   WINDOW EXPORTS
========================= */

window.setRandomBox2NumberValue = setRandomBox2NumberValue
window.appendRandomBox2Digit = appendRandomBox2Digit
window.deleteRandomBox2Digit = deleteRandomBox2Digit
window.clearRandomBox2Number = clearRandomBox2Number
window.increaseRandomBox2Number = increaseRandomBox2Number
window.decreaseRandomBox2Number = decreaseRandomBox2Number
window.selectRandomChallengeTeam = selectRandomChallengeTeam
window.openRandomChallengeBox = openRandomChallengeBox
window.startRandomChallengeBox1 = startRandomChallengeBox1
window.randomChallengeCorrect = randomChallengeCorrect
window.randomChallengeWrong = randomChallengeWrong
window.randomChallengeSkip = randomChallengeSkip
window.finishRandomChallengeCurrentBox = finishRandomChallengeCurrentBox
window.updateRandomBox2Number = updateRandomBox2Number
window.startRandomBox2Timer = startRandomBox2Timer
window.startRandomBox3Timer = startRandomBox3Timer
window.switchRandomBox3Team = switchRandomBox3Team
window.randomBox3Wrong = randomBox3Wrong
window.randomBox3Pass = randomBox3Pass
window.finishRandomBox3ToPoints = finishRandomBox3ToPoints
window.scoreRandomBox3Points = scoreRandomBox3Points
window.updateRandomBoxQuestion = updateRandomBoxQuestion
window.clearRandomChallengeTeamSelection = clearRandomChallengeTeamSelection

window.saveRandomChallengeState = saveRandomChallengeState
window.renderRandomChallengeScores = renderRandomChallengeScores
window.renderRandomChallengeStage = renderRandomChallengeStage
window.renderRandomChallengeControls = renderRandomChallengeControls
window.highlightRandomChallengeTeam = highlightRandomChallengeTeam
window.hasRandomChallengeProgress = hasRandomChallengeProgress
window.handleRandomChallengeBack = handleRandomChallengeBack
window.handleRandomChallengeEnd = handleRandomChallengeEnd
window.goRandomChallengeHome = goRandomChallengeHome