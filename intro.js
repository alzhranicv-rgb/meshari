let introModelsLoaded = false
let introStarting = false
let gameToastTimer = null
let presenterStartWatchTimer = null

document.addEventListener("DOMContentLoaded", async () => {
  resetIntroPageState()
  prepareIntroInputs()

  const introCard = document.querySelector(".introCard")
  if (introCard) {
    introCard.classList.add("softEnter")
  }

  setIntroStartLoading(false, "بدء اللعبة", true)

  await loadIntroModels()
  fillSavedIntroValues()
  bindIntroEnterSubmit()
  bindIntroInputCleanup()
})

/* =========================
   Toast
========================= */

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
  }, 2800)
}

/* =========================
   Helpers
========================= */

function prepareIntroInputs() {
  const teamAInput = document.getElementById("teamANameInput")
  const teamBInput = document.getElementById("teamBNameInput")
  const startBtn = document.getElementById("startGameBtn")

  if (teamAInput) {
    teamAInput.setAttribute("maxlength", "18")
    teamAInput.setAttribute("aria-label", "اسم الفريق الأول")
  }

  if (teamBInput) {
    teamBInput.setAttribute("maxlength", "18")
    teamBInput.setAttribute("aria-label", "اسم الفريق الثاني")
  }

  if (startBtn) {
    startBtn.type = "button"
  }
}

function cleanTeamName(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 18)
}

function setIntroStartLoading(isLoading, text = "بدء اللعبة", disabledOverride = null) {
  const startBtn = document.getElementById("startGameBtn")
  if (!startBtn) return

  startBtn.disabled = disabledOverride !== null ? disabledOverride : !!isLoading
  startBtn.classList.toggle("loading", !!isLoading)
  startBtn.textContent = text
}

function setIntroFormDisabled(isDisabled) {
  const teamAInput = document.getElementById("teamANameInput")
  const teamBInput = document.getElementById("teamBNameInput")
  const modelSelect = document.getElementById("introModelSelect")

  if (teamAInput) teamAInput.disabled = !!isDisabled
  if (teamBInput) teamBInput.disabled = !!isDisabled
  if (modelSelect) modelSelect.disabled = !!isDisabled
}

function getSelectedModelName() {
  const modelSelect = document.getElementById("introModelSelect")
  if (!modelSelect) return ""

  return modelSelect.options[modelSelect.selectedIndex]?.text || ""
}

function createGameSessionId() {
  return "game_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8)
}

async function generateUniqueJoinCode() {
  for (let i = 0; i < 8; i++) {
    const code = String(Math.floor(1000 + Math.random() * 9000))

    const { data, error } = await db
      .from("game_sessions")
      .select("id")
      .eq("join_code", code)
      .eq("status", "active")
      .limit(1)

    if (error) {
      console.log("join code check error:", error)
      return code
    }

    if (!data || data.length === 0) {
      return code
    }
  }

  return String(Math.floor(1000 + Math.random() * 9000))
}

/* =========================
   Models
========================= */

async function loadIntroModels() {
  const select = document.getElementById("introModelSelect")
  if (!select) return

  introModelsLoaded = false
  select.disabled = true
  select.innerHTML = `<option value="">جارٍ تحميل النماذج...</option>`

  const { data, error } = await db
    .from("models")
    .select("*")
    .order("id", { ascending: true })

  if (error) {
    console.log("loadIntroModels error:", error)

    select.innerHTML = `<option value="">تعذر تحميل النماذج</option>`
    select.disabled = false

    setIntroStartLoading(false, "بدء اللعبة", false)
    showGameToast("تعذر تحميل النماذج")
    return
  }

  const rows = data || []

  select.innerHTML = `<option value="">اختر النموذج</option>`

  rows.forEach(row => {
    const option = document.createElement("option")
    option.value = row.id
    option.textContent = row.name || `نموذج ${row.id}`
    select.appendChild(option)
  })

  introModelsLoaded = true
  select.disabled = false

  setIntroStartLoading(false, "بدء اللعبة", false)
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

/* =========================
   Events
========================= */

function bindIntroEnterSubmit() {
  const inputs = [
    document.getElementById("teamANameInput"),
    document.getElementById("teamBNameInput"),
    document.getElementById("introModelSelect")
  ]

  inputs.forEach(el => {
    if (!el) return

    el.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault()
        startGameFromIntro()
      }
    })
  })
}

function bindIntroInputCleanup() {
  const inputs = [
    document.getElementById("teamANameInput"),
    document.getElementById("teamBNameInput"),
    document.getElementById("introModelSelect")
  ]

  inputs.forEach(el => {
    if (!el) return

    el.addEventListener("input", () => {
      el.classList.remove("introFieldError")
    })

    el.addEventListener("change", () => {
      el.classList.remove("introFieldError")
    })
  })
}

/* =========================
   Validation
========================= */

function validateIntroForm() {
  const teamAInput = document.getElementById("teamANameInput")
  const teamBInput = document.getElementById("teamBNameInput")
  const modelSelect = document.getElementById("introModelSelect")

  const teamA = cleanTeamName(teamAInput?.value)
  const teamB = cleanTeamName(teamBInput?.value)
  const model = modelSelect?.value || ""

  if (!introModelsLoaded) {
    showGameToast("انتظر تحميل النماذج")
    return false
  }

  if (!teamA) {
    showIntroFieldError(teamAInput, "اكتب اسم الفريق الأول")
    return false
  }

  if (!teamB) {
    showIntroFieldError(teamBInput, "اكتب اسم الفريق الثاني")
    return false
  }

  if (teamA === teamB) {
    showIntroFieldError(teamBInput, "اكتب اسمًا مختلفًا للفريق الثاني")
    return false
  }

  if (!model) {
    showIntroFieldError(modelSelect, "اختر النموذج أولاً")
    return false
  }

  if (teamAInput) teamAInput.value = teamA
  if (teamBInput) teamBInput.value = teamB

  return true
}

function showIntroFieldError(field, message) {
  if (!field) return

  field.focus()
  field.classList.remove("introFieldError")

  void field.offsetWidth

  field.classList.add("introFieldError")

  setTimeout(() => {
    field.classList.remove("introFieldError")
  }, 1200)

  showGameToast(message)
}

/* =========================
   Reset
========================= */

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

  localStorage.removeItem("game_session_id")
  localStorage.removeItem("game_join_code")
  localStorage.removeItem("presenter_join_code_temp")
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

  localStorage.removeItem("game_session_id")
  localStorage.removeItem("game_join_code")
  localStorage.removeItem("presenter_join_code_temp")

  localStorage.setItem("main_score_a", "0")
  localStorage.setItem("main_score_b", "0")
}

/* =========================
   Start Game
========================= */

window.startGameFromIntro = async function () {
  if (introStarting) return

  const teamAInput = document.getElementById("teamANameInput")
  const teamBInput = document.getElementById("teamBNameInput")
  const modelSelect = document.getElementById("introModelSelect")

  if (!validateIntroForm()) return

  introStarting = true
  setIntroStartLoading(true, "جارٍ تجهيز اللعبة...")
  setIntroFormDisabled(true)

  const teamA = cleanTeamName(teamAInput.value)
  const teamB = cleanTeamName(teamBInput.value)
  const model = modelSelect.value
  const modelText = getSelectedModelName()

  try {
    resetGameStateBeforeStart()

    localStorage.setItem("teamAName", teamA)
    localStorage.setItem("teamBName", teamB)
    localStorage.setItem("game_model", model)
    localStorage.setItem("game_model_name", modelText)

    const gameSessionId = createGameSessionId()
    const joinCode = await generateUniqueJoinCode()

    localStorage.setItem("game_session_id", gameSessionId)
    localStorage.setItem("game_join_code", joinCode)
    localStorage.setItem("presenter_join_code_temp", joinCode)

    const sessionState = {
      mainScores: { A: 0, B: 0 },
      currentModelName: modelText,
      displayControlsHidden: false,
      presenterStarted: false,
      segmentStatus: {},
      warmup: null,
      top10: null,
      auction: null,
      who: null,
      final: null,
      archive: null,
      toast: null
    }

    const { error } = await db.from("game_sessions").upsert({
      id: gameSessionId,
      join_code: joinCode,
      status: "active",
      model: Number(model),
      team_a: teamA,
      team_b: teamB,
      active_segment: null,
      state: sessionState,
      updated_at: new Date().toISOString()
    })

    if (error) {
      console.log("create session error:", error)
      throw error
    }

    localStorage.setItem("main_score_a", "0")
    localStorage.setItem("main_score_b", "0")

    openPresenterIntroModal()

    setIntroStartLoading(false, "الجلسة جاهزة", true)
    showGameToast("تم تجهيز صفحة المقدم")
  } catch (e) {
    console.log("startGameFromIntro error:", e)

    introStarting = false
    setIntroFormDisabled(false)
    setIntroStartLoading(false, "بدء اللعبة", false)

    showGameToast("تعذر إنشاء جلسة المقدم")
  }
}

/* =========================
   Presenter Modal
========================= */

function getPresenterIntroUrl() {
  return new URL("presenter.html?join=1", window.location.href).href
}

function openPresenterIntroModal() {
  const modal = document.getElementById("presenterIntroModal")
  const qr = document.getElementById("presenterIntroQr")
  const linkBox = document.getElementById("presenterIntroLink")
  const codeBox = document.getElementById("presenterIntroCode")

  const joinCode = localStorage.getItem("game_join_code") || ""
  const url = getPresenterIntroUrl()
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=420x420&data=${encodeURIComponent(url)}`

  if (qr) {
    qr.alt = "QR صفحة المقدم"
    qr.src = qrUrl
  }

  if (linkBox) linkBox.innerText = url
  if (codeBox) codeBox.innerText = joinCode || "----"

  if (modal) {
  modal.classList.remove("hidden")
}

startPresenterStartWatcher()
}

function startPresenterStartWatcher() {
  clearInterval(presenterStartWatchTimer)

  presenterStartWatchTimer = setInterval(async () => {
    const sessionId = localStorage.getItem("game_session_id")
    if (!sessionId || !window.db) return

    const { data, error } = await db
      .from("game_sessions")
      .select("state")
      .eq("id", sessionId)
      .maybeSingle()

    if (error) {
      console.log("presenter start watch error:", error)
      return
    }

    if (data?.state?.presenterStarted) {
      clearInterval(presenterStartWatchTimer)
      presenterStartWatchTimer = null

      window.location.href = "display.html"
    }
  }, 900)
}

function closePresenterIntroModal() {
  document.getElementById("presenterIntroModal")?.classList.add("hidden")
}

async function copyPresenterIntroLink() {
  const url = getPresenterIntroUrl()

  try {
    await navigator.clipboard.writeText(url)
    showGameToast("تم نسخ رابط المقدم")
  } catch (e) {
    console.log("copy link error:", e)
    showGameToast("تعذر نسخ الرابط")
  }
}

function goToDisplayFromIntro() {
  const sessionId = localStorage.getItem("game_session_id")

  if (!sessionId) {
    showGameToast("أنشئ الجلسة أولاً")
    return
  }

  clearInterval(presenterStartWatchTimer)
  presenterStartWatchTimer = null

  window.location.href = "display.html"
}