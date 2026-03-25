let currentFinalAnswer = null
let currentFinalImage = null
let finalScoreA = 0
let finalScoreB = 0
let finalOpenedNumbers = []

window.finalOpenedNumbers = finalOpenedNumbers

const FINAL_STORAGE_KEY = "final_state_v1"

/* =========================
   Persistence
========================= */

function getFinalState() {
  try {
    return JSON.parse(localStorage.getItem(FINAL_STORAGE_KEY) || "null")
  } catch {
    return null
  }
}

function saveFinalState() {
  const state = {
    currentFinalAnswer,
    currentFinalImage,
    finalScoreA,
    finalScoreB,
    finalOpenedNumbers
  }

  localStorage.setItem(FINAL_STORAGE_KEY, JSON.stringify(state))
  localStorage.setItem("active_segment", "final")
}

function clearFinalState() {
  localStorage.removeItem(FINAL_STORAGE_KEY)
  localStorage.removeItem("active_segment")
}

function restoreFinalState(saved) {
  if (!saved) return

  currentFinalAnswer = saved.currentFinalAnswer || null
  currentFinalImage = saved.currentFinalImage || null
  finalScoreA = Number(saved.finalScoreA || 0)
  finalScoreB = Number(saved.finalScoreB || 0)
  finalOpenedNumbers = Array.isArray(saved.finalOpenedNumbers) ? saved.finalOpenedNumbers : []

  window.finalOpenedNumbers = finalOpenedNumbers
  window.currentSegmentScores = {
    A: finalScoreA,
    B: finalScoreB
  }

  const scoreABox = document.getElementById("finalScoreA")
  const scoreBBox = document.getElementById("finalScoreB")

  if (scoreABox) scoreABox.innerText = finalScoreA
  if (scoreBBox) scoreBBox.innerText = finalScoreB

  const grid = document.querySelector(".finalGrid")
  if (grid) {
    grid.innerHTML = `
      ${renderFinalCard(1)}
      ${renderFinalCard(2)}
      ${renderFinalCard(3)}
      ${renderFinalCard(4)}
      ${renderFinalCard(5)}
      ${renderFinalCard(6)}
    `
  }

  if (currentFinalImage) {
    showFinalImageFullscreen(currentFinalImage)
  }
}

/* =========================
   Render
========================= */

window.renderFinal = function () {
  const saved = getFinalState()

  currentFinalAnswer = null
  currentFinalImage = null
  finalScoreA = 0
  finalScoreB = 0
  finalOpenedNumbers = []

  window.finalOpenedNumbers = finalOpenedNumbers
  window.currentSegmentScores = { A: 0, B: 0 }

  openSegment("الفاصلة", buildFinalHTML())

  if (saved) {
    restoreFinalState(saved)
  } else {
    saveFinalState()
  }
}

function buildFinalHTML() {
  return `
    <div class="finalWrap">

      <div class="finalTopBar">

        <div class="finalTeamCard" onclick="addFinalPoint('A')">
          <div class="finalTeamName">${teamAName}</div>
          <div id="finalScoreA" class="finalTeamScore">${finalScoreA}</div>
        </div>

        <div class="finalCenterBox">
          <div class="finalCenterLabel">الفاصلة</div>
        </div>

        <div class="finalTeamCard" onclick="addFinalPoint('B')">
          <div class="finalTeamName">${teamBName}</div>
          <div id="finalScoreB" class="finalTeamScore">${finalScoreB}</div>
        </div>

      </div>

      <div id="finalImageStage" class="finalImageStage hidden"></div>

      <div class="finalGrid">
        ${renderFinalCard(1)}
        ${renderFinalCard(2)}
        ${renderFinalCard(3)}
        ${renderFinalCard(4)}
        ${renderFinalCard(5)}
        ${renderFinalCard(6)}
      </div>

    </div>
  `
}

function renderFinalCard(num) {
  if (finalOpenedNumbers.includes(num)) {
    return `<div class="finalCard used"></div>`
  }

  return `<div class="finalCard" onclick="openFinal(${num})">${num}</div>`
}

function addFinalPoint(team) {
  if (team === "A") {
    finalScoreA++

    if (finalScoreA > 2) {
      finalScoreA = 0
    }

    const box = document.getElementById("finalScoreA")
    if (box) box.innerText = finalScoreA
  }

  if (team === "B") {
    finalScoreB++

    if (finalScoreB > 2) {
      finalScoreB = 0
    }

    const box = document.getElementById("finalScoreB")
    if (box) box.innerText = finalScoreB
  }

  window.currentSegmentScores = {
    A: finalScoreA,
    B: finalScoreB
  }

  saveFinalState()
}

async function openFinal(num) {
  if (finalOpenedNumbers.includes(num)) return

  finalOpenedNumbers.push(num)
  window.finalOpenedNumbers = finalOpenedNumbers

  const { data, error } = await db
    .from("final_images")
    .select("*")
    .eq("model", currentModel)
    .eq("number", num)
    .single()

  if (error) {
    console.log(error)
    return
  }

  if (!data) return

  currentFinalAnswer = data.answer || ""
  currentFinalImage = data.image || ""

  showFinalImageFullscreen(currentFinalImage)

  const grid = document.querySelector(".finalGrid")
  if (grid) {
    grid.innerHTML = `
      ${renderFinalCard(1)}
      ${renderFinalCard(2)}
      ${renderFinalCard(3)}
      ${renderFinalCard(4)}
      ${renderFinalCard(5)}
      ${renderFinalCard(6)}
    `
  }

  saveFinalState()
}

function showFinalImageFullscreen(imageUrl) {
  const stage = document.getElementById("finalImageStage")
  if (!stage || !imageUrl) return

  stage.innerHTML = `
    <img src="${imageUrl}" class="finalImageFull" onclick="hideFinalImage()">
  `
  stage.classList.remove("hidden")
}

function hideFinalImage() {
  const stage = document.getElementById("finalImageStage")
  if (!stage) return

  stage.innerHTML = ""
  stage.classList.add("hidden")

  currentFinalImage = null
  saveFinalState()
}