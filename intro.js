let introModelsLoaded = false
let gameToastTimer = null

document.addEventListener("DOMContentLoaded", async () => {
  resetIntroPageState()

  const introCard = document.querySelector(".introCard")
  if (introCard) {
    introCard.classList.add("softEnter")
  }

  await loadIntroModels()
  fillSavedIntroValues()
  bindIntroEnterSubmit()
})

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

async function loadIntroModels() {
  const select = document.getElementById("introModelSelect")
  if (!select) return

  select.innerHTML = `<option value="">جارٍ تحميل النماذج...</option>`

  const { data, error } = await db
    .from("models")
    .select("*")
    .order("id", { ascending: true })

  if (error) {
    console.log(error)
    select.innerHTML = `<option value="">تعذر تحميل النماذج</option>`
    showGameToast("تعذر تحميل النماذج")
    return
  }

  const rows = data || []
  select.innerHTML = `<option value="">اختر النموذج</option>`

  rows.forEach((row) => {
    const option = document.createElement("option")
    option.value = row.id
    option.textContent = row.name || `نموذج ${row.id}`
    select.appendChild(option)
  })

  introModelsLoaded = true
}

function fillSavedIntroValues() {
  const teamAInput = document.getElementById("teamANameInput")
  const teamBInput = document.getElementById("teamBNameInput")
  const modelSelect = document.getElementById("introModelSelect")

  if (teamAInput) teamAInput.value = ""
  if (teamBInput) teamBInput.value = ""

  if (modelSelect) {
    const resetModel = () => {
      modelSelect.value = ""
    }

    if (introModelsLoaded) {
      resetModel()
    } else {
      setTimeout(resetModel, 300)
    }
  }
}

function bindIntroEnterSubmit() {
  const inputs = [
    document.getElementById("teamANameInput"),
    document.getElementById("teamBNameInput"),
    document.getElementById("introModelSelect")
  ]

  inputs.forEach((el) => {
    if (!el) return

    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault()
        startGameFromIntro()
      }
    })
  })
}

function validateIntroForm() {
  const teamAInput = document.getElementById("teamANameInput")
  const teamBInput = document.getElementById("teamBNameInput")
  const modelSelect = document.getElementById("introModelSelect")

  const teamA = (teamAInput?.value || "").trim()
  const teamB = (teamBInput?.value || "").trim()
  const model = modelSelect?.value || ""

  if (!teamA) {
    showIntroFieldError(teamAInput, "اكتب اسم الفريق الأول")
    return false
  }

  if (!teamB) {
    showIntroFieldError(teamBInput, "اكتب اسم الفريق الثاني")
    return false
  }

  if (!model) {
    showIntroFieldError(modelSelect, "اختر النموذج أولاً")
    return false
  }

  return true
}

function showIntroFieldError(field, message) {
  if (!field) return

  field.focus()
  field.classList.add("introFieldError")

  setTimeout(() => {
    field.classList.remove("introFieldError")
  }, 1200)

  showGameToast(message)
}

function resetIntroPageState() {
  localStorage.removeItem("main_score_a")
  localStorage.removeItem("main_score_b")
  localStorage.removeItem("active_segment")
  localStorage.removeItem("segment_status_v1")

  localStorage.removeItem("warmup_state_v1")
  localStorage.removeItem("top10_state_v1")
  localStorage.removeItem("auction_state_v1")
  localStorage.removeItem("auction_state_v2")
  localStorage.removeItem("who_state_v1")
  localStorage.removeItem("final_state_v2")
  localStorage.removeItem("final_state_v3")
  localStorage.removeItem("archive_state_v1")

  localStorage.removeItem("teamAName")
  localStorage.removeItem("teamBName")
  localStorage.removeItem("game_model")
  localStorage.removeItem("game_model_name")
}

function resetGameStateBeforeStart() {
  localStorage.removeItem("main_score_a")
  localStorage.removeItem("main_score_b")
  localStorage.removeItem("active_segment")
  localStorage.removeItem("segment_status_v1")

  localStorage.removeItem("warmup_state_v1")
  localStorage.removeItem("top10_state_v1")
  localStorage.removeItem("auction_state_v1")
  localStorage.removeItem("auction_state_v2")
  localStorage.removeItem("who_state_v1")
  localStorage.removeItem("final_state_v2")
  localStorage.removeItem("final_state_v3")
  localStorage.removeItem("archive_state_v1")

  localStorage.removeItem("teamAName")
  localStorage.removeItem("teamBName")
  localStorage.removeItem("game_model")
  localStorage.removeItem("game_model_name")

  localStorage.setItem("main_score_a", 0)
  localStorage.setItem("main_score_b", 0)
}

window.startGameFromIntro = function () {
  const teamAInput = document.getElementById("teamANameInput")
  const teamBInput = document.getElementById("teamBNameInput")
  const modelSelect = document.getElementById("introModelSelect")
  const startBtn = document.getElementById("startGameBtn")
  const introCard = document.querySelector(".introCard")

  if (!validateIntroForm()) return

  const teamA = teamAInput.value.trim()
  const teamB = teamBInput.value.trim()
  const model = modelSelect.value
  const modelText = modelSelect.options[modelSelect.selectedIndex]?.text || ""

  resetGameStateBeforeStart()

  localStorage.setItem("teamAName", teamA)
  localStorage.setItem("teamBName", teamB)
  localStorage.setItem("game_model", model)
  localStorage.setItem("game_model_name", modelText)

  localStorage.setItem("main_score_a", 0)
  localStorage.setItem("main_score_b", 0)

  if (startBtn) {
    startBtn.disabled = true
    startBtn.textContent = "جارٍ البدء..."
  }

  document.body.classList.add("softExit")

  if (introCard) {
    introCard.classList.add("softExit")
  }

  setTimeout(() => {
    window.location.href = "display.html"
  }, 230)
}
function getPresenterIntroUrl() {
  return `${window.location.origin}${window.location.pathname.replace("intro.html", "")}presenter.html`
}

function openPresenterIntroModal() {
  const modal = document.getElementById("presenterIntroModal")
  const qr = document.getElementById("presenterIntroQr")
  const linkBox = document.getElementById("presenterIntroLink")

  const url = getPresenterIntroUrl()
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=420x420&data=${encodeURIComponent(url)}`

  if (qr) qr.src = qrUrl
  if (linkBox) linkBox.innerText = url
  if (modal) modal.classList.remove("hidden")
}

function closePresenterIntroModal() {
  document.getElementById("presenterIntroModal")?.classList.add("hidden")
}

async function copyPresenterIntroLink() {
  const url = getPresenterIntroUrl()

  try {
    await navigator.clipboard.writeText(url)
    if (typeof showGameToast === "function") {
      showGameToast("تم نسخ رابط المقدم")
    }
  } catch (e) {
    console.log(e)
  }
}