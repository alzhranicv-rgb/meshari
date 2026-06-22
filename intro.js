let introModelsLoaded = false
let introStarting = false
let gameToastTimer = null
let presenterStartWatchTimer = null

window.openIntroSegmentsModal = function () {
  const modelSelect = document.getElementById("introModelSelect")
  const modal = document.getElementById("introSegmentsModal")

  if (!modal) return

  if (!modelSelect?.value) {
    showGameToast("اختر النموذج أولاً")
    modelSelect?.focus()
    return
  }

  modal.classList.remove("hidden")
  modal.classList.remove("show")

  requestAnimationFrame(() => {
    modal.classList.add("show")
  })
}

window.closeIntroSegmentsModal = function () {
  const modal = document.getElementById("introSegmentsModal")
  if (!modal) return

  modal.classList.remove("show")

  setTimeout(() => {
    modal.classList.add("hidden")
  }, 180)
}

const INTRO_MIN_SEGMENTS_COUNT = 6
const INTRO_MAX_SEGMENTS_COUNT = 10

const INTRO_ALL_GAME_SEGMENTS = [
  { key: "warmup", title: "التسخين", sort: 1 },
  { key: "top10", title: "Top 10", sort: 2 },
  { key: "auction", title: "فتبلة", sort: 3 },
  { key: "who", title: "من هو", sort: 4 },
  { key: "explain", title: "اشرح الكلمة", sort: 5 },

  { key: "finalRound1", title: "ٮدوں ٮڡاط", sort: 6 },
  { key: "finalRound2", title: "صح صحلي", sort: 7 },
  { key: "finalRound3", title: "قصة", sort: 8 },
  { key: "finalRound4", title: "التركيز", sort: 9 },

  { key: "archive", title: "الأرشيف", sort: 10 }
]

let introVisibleSegmentsClickOrder = []
let introVisibleSegmentsReady = false

document.addEventListener("DOMContentLoaded", async () => {
  await endOldIntroSessionIfExists()

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
  bindIntroModelSegmentsLoader()
})

/* =========================
   Toast
========================= */

function showGameToast(message) {
  const toast = document.getElementById("gameToast")
  const text = document.getElementById("gameToastText")

  if (!toast || !text) return

  clearTimeout(gameToastTimer)

  text.innerText = message

  toast.classList.remove("hidden")
  toast.classList.remove("show")

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.classList.add("show")
    })
  })

  gameToastTimer = setTimeout(() => {
    toast.classList.remove("show")

    setTimeout(() => {
      toast.classList.add("hidden")
    }, 240)
  }, 2400)
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

  setIntroSegmentsDisabled(isDisabled)
}

function setIntroSegmentsDisabled(isDisabled) {
  document.querySelectorAll(".introSegmentPickBtn").forEach(btn => {
    btn.disabled = !!isDisabled
  })
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

  if (!window.db) {
    select.innerHTML = `<option value="">تعذر الاتصال بقاعدة البيانات</option>`
    select.disabled = false

    setIntroStartLoading(false, "بدء اللعبة", true)
    showGameToast("تعذر الاتصال بقاعدة البيانات")
    return
  }

  const { data, error } = await db
    .from("models")
    .select("*")
    .order("id", { ascending: true })

  if (error) {
    console.log("loadIntroModels error:", error)

    select.innerHTML = `<option value="">تعذر تحميل النماذج</option>`
    select.disabled = false

    setIntroStartLoading(false, "بدء اللعبة", true)
    showGameToast("تعذر تحميل النماذج")
    return
  }

  const rows = data || []

  if (!rows.length) {
    select.innerHTML = `<option value="">لا توجد نماذج متاحة</option>`
    select.disabled = false

    introModelsLoaded = false
    setIntroStartLoading(false, "بدء اللعبة", true)
    showGameToast("لا توجد نماذج متاحة")
    return
  }

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

  if (!introVisibleSegmentsReady) {
    showGameToast("انتظر تحميل الفقرات")
    return false
  }

  if (
    introVisibleSegmentsClickOrder.length < INTRO_MIN_SEGMENTS_COUNT ||
    introVisibleSegmentsClickOrder.length > INTRO_MAX_SEGMENTS_COUNT
  ) {
    showGameToast(`اختر من ${INTRO_MIN_SEGMENTS_COUNT} إلى ${INTRO_MAX_SEGMENTS_COUNT} فقرات للعرض`)
    return false
  }

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
   Old Session Cleanup
========================= */

async function endOldIntroSessionIfExists() {
  const oldSessionId = localStorage.getItem("game_session_id")

  if (!oldSessionId || !window.db) return

  try {
    await db
      .from("game_sessions")
      .update({
        status: "ended",
        active_segment: null,
        ended_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", oldSessionId)
  } catch (e) {
    console.log("end old intro session error:", e)
  }
}

/* =========================
   Reset
========================= */

function clearGameLocalState() {
  localStorage.removeItem("main_score_a")
  localStorage.removeItem("main_score_b")
  localStorage.removeItem("active_segment")
  localStorage.removeItem("segment_status_v1")

  localStorage.removeItem("warmup_state_v1")
  localStorage.removeItem("top10_state_v1")
  localStorage.removeItem("auction_state_v1")
  localStorage.removeItem("auction_state_v2")
  localStorage.removeItem("who_state_v1")
  localStorage.removeItem("explain_state_v1")
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

function resetIntroPageState() {
  clearGameLocalState()
}

function resetGameStateBeforeStart() {
  clearGameLocalState()

  localStorage.setItem("main_score_a", "0")
  localStorage.setItem("main_score_b", "0")
}

function defaultIntroSegmentStatus() {
  return {
    warmup: { locked: false, winner: "" },
    top10: { locked: false, winner: "" },
    auction: { locked: false, winner: "" },
    who: { locked: false, winner: "" },
    explain: { locked: false, winner: "" },

    final: { locked: false, winner: "" },
    finalRound1: { locked: false, winner: "" },
    finalRound2: { locked: false, winner: "" },
    finalRound3: { locked: false, winner: "" },
    finalRound4: { locked: false, winner: "" },

    archive: { locked: false, winner: "" }
  }
}

/* =========================
   Intro Visible Segments
========================= */

function bindIntroModelSegmentsLoader() {
  const modelSelect = document.getElementById("introModelSelect")
  if (!modelSelect) return

  modelSelect.addEventListener("change", async () => {
    modelSelect.classList.remove("introFieldError")
    await loadIntroVisibleSegments()
  })
}

function getIntroDefaultVisibleSegmentsMap() {
  const map = {}

  INTRO_ALL_GAME_SEGMENTS.forEach(item => {
    map[item.key] = {
      is_visible: item.sort <= INTRO_MIN_SEGMENTS_COUNT,
      sort_order: item.sort
    }
  })

  return map
}

async function getIntroVisibleSegmentsMap(modelId) {
  const map = getIntroDefaultVisibleSegmentsMap()

  if (!modelId) return map

  const { data, error } = await db
    .from("visible_segments")
    .select("*")
    .eq("model", Number(modelId))
    .order("sort_order", { ascending: true })

  if (error) {
    console.log("INTRO GET VISIBLE SEGMENTS ERROR:", error)
    return map
  }

  ;(data || []).forEach(row => {
    if (!map[row.segment_key]) return

    map[row.segment_key] = {
      is_visible: !!row.is_visible,
      sort_order: Number(row.sort_order || map[row.segment_key].sort_order)
    }
  })

  return map
}

async function ensureIntroVisibleSegmentsDefaults(modelId) {
  if (!modelId) return false

  const { data: existingRows, error: readError } = await db
    .from("visible_segments")
    .select("segment_key")
    .eq("model", Number(modelId))

  if (readError) {
    console.log("INTRO READ VISIBLE SEGMENTS DEFAULTS ERROR:", readError)
    showGameToast("تعذر قراءة فقرات العرض")
    return false
  }

  const existingKeys = (existingRows || []).map(row => row.segment_key)

  const rows = INTRO_ALL_GAME_SEGMENTS
    .filter(item => !existingKeys.includes(item.key))
    .map(item => ({
      model: Number(modelId),
      segment_key: item.key,
      is_visible: item.sort <= INTRO_MIN_SEGMENTS_COUNT,
      sort_order: item.sort,
      updated_at: new Date().toISOString()
    }))

  if (!rows.length) return true

  const { error } = await db
    .from("visible_segments")
    .insert(rows)

  if (error) {
    console.log("INTRO ENSURE VISIBLE SEGMENTS ERROR:", error)
    showGameToast("تعذر تجهيز فقرات العرض")
    return false
  }

  return true
}

async function loadIntroVisibleSegments() {
  const modelSelect = document.getElementById("introModelSelect")
  const modelId = Number(modelSelect?.value || 0)

  introVisibleSegmentsReady = false
  introVisibleSegmentsClickOrder = []

  const grid = document.getElementById("introSegmentsGrid")
  const counter = document.getElementById("introSegmentsCounter")
  const order = document.getElementById("introSegmentsOrder")

  if (counter) counter.innerText = `0 / ${INTRO_MIN_SEGMENTS_COUNT}-${INTRO_MAX_SEGMENTS_COUNT}`
if (order) order.innerHTML = ""

const triggerCounter = document.getElementById("introSegmentsTriggerCounter")
const triggerSummary = document.getElementById("introSegmentsTriggerSummary")

if (triggerCounter) {
  triggerCounter.innerText = `0 / ${INTRO_MIN_SEGMENTS_COUNT}-${INTRO_MAX_SEGMENTS_COUNT}`
  triggerCounter.classList.remove("ok")
  triggerCounter.classList.add("bad")
}

if (triggerSummary) {
  triggerSummary.textContent = modelId ? "جارٍ تحميل الفقرات..." : "اختر النموذج أولاً"
}

  if (!grid) return

  if (!modelId) {
  grid.innerHTML = `<div class="introSegmentsEmpty">اختر النموذج أولاً</div>`

  const triggerCounter = document.getElementById("introSegmentsTriggerCounter")
  const triggerSummary = document.getElementById("introSegmentsTriggerSummary")

  if (triggerCounter) {
    triggerCounter.innerText = `0 / ${INTRO_MIN_SEGMENTS_COUNT}-${INTRO_MAX_SEGMENTS_COUNT}`
    triggerCounter.classList.remove("ok")
    triggerCounter.classList.add("bad")
  }

  if (triggerSummary) {
    triggerSummary.textContent = "اختر النموذج أولاً"
  }

  return
}

  grid.innerHTML = `<div class="introSegmentsEmpty">جارٍ تحميل الفقرات...</div>`

  await ensureIntroVisibleSegmentsDefaults(modelId)

  const visibleMap = await getIntroVisibleSegmentsMap(modelId)

  const sortedSegments = [...INTRO_ALL_GAME_SEGMENTS].sort((a, b) => {
    const av = Number(visibleMap[a.key]?.sort_order || a.sort)
    const bv = Number(visibleMap[b.key]?.sort_order || b.sort)
    return av - bv
  })

  introVisibleSegmentsClickOrder = sortedSegments
    .filter(item => visibleMap[item.key]?.is_visible)
    .map(item => item.key)
    .slice(0, INTRO_MAX_SEGMENTS_COUNT)

  introVisibleSegmentsReady = true

  renderIntroSegmentsPicker()
}

function renderIntroSegmentsPicker() {
  const grid = document.getElementById("introSegmentsGrid")
  if (!grid) return

  grid.innerHTML = INTRO_ALL_GAME_SEGMENTS.map(item => {
    const selectedIndex = introVisibleSegmentsClickOrder.indexOf(item.key)
    const selected = selectedIndex !== -1

    return `
      <button
        type="button"
        class="introSegmentPickBtn ${selected ? "selected" : ""}"
        id="introSegmentBtn_${item.key}"
        onclick="toggleIntroVisibleSegment('${item.key}')"
      >
        <span class="introSegmentPickTitle">${item.title}</span>
        <span class="introSegmentPickState">
          ${selected ? `مختارة ${selectedIndex + 1}` : "اضغط للاختيار"}
        </span>
      </button>
    `
  }).join("")

  refreshIntroSegmentsPickerUI()
}

function buildIntroSegmentsOrderPreview() {
  if (!introVisibleSegmentsClickOrder.length) {
    return `
      <div class="introSegmentsOrderEmpty">
        لم يتم اختيار فقرات بعد
      </div>
    `
  }

  return `
    <div class="introSegmentsOrderBar">

      <div class="introSegmentsOrderHead">
        <span>ترتيب الظهور</span>
        <strong>${introVisibleSegmentsClickOrder.length}</strong>
      </div>

      <div class="introSegmentsOrderTrack">
        ${introVisibleSegmentsClickOrder.map((key, index) => {
          const item = INTRO_ALL_GAME_SEGMENTS.find(seg => seg.key === key)

          return `
            <div class="introSegmentsOrderStep">
              <div class="introSegmentsOrderStepNo">${index + 1}</div>
              <div class="introSegmentsOrderStepText">${item?.title || key}</div>
            </div>
          `
        }).join("")}
      </div>

    </div>
  `
}

function refreshIntroSegmentsPickerUI() {
  const count = introVisibleSegmentsClickOrder.length
  const counter = document.getElementById("introSegmentsCounter")
  const order = document.getElementById("introSegmentsOrder")

  const triggerCounter = document.getElementById("introSegmentsTriggerCounter")
  const triggerSummary = document.getElementById("introSegmentsTriggerSummary")

  const countOk =
    count >= INTRO_MIN_SEGMENTS_COUNT &&
    count <= INTRO_MAX_SEGMENTS_COUNT

  if (counter) {
    counter.innerText = `${count} / ${INTRO_MIN_SEGMENTS_COUNT}-${INTRO_MAX_SEGMENTS_COUNT}`
    counter.classList.toggle("ok", countOk)
    counter.classList.toggle("bad", !countOk)
  }

  if (triggerCounter) {
  triggerCounter.innerText = `${count} / ${INTRO_MIN_SEGMENTS_COUNT}-${INTRO_MAX_SEGMENTS_COUNT}`
  triggerCounter.classList.toggle("ok", countOk)
  triggerCounter.classList.toggle("bad", !countOk)
}

if (triggerSummary) {
  if (!introVisibleSegmentsReady) {
    triggerSummary.textContent = "اختر النموذج أولاً"
  } else if (!count) {
    triggerSummary.textContent = "لم يتم اختيار فقرات بعد"
  } else {
    triggerSummary.textContent = `تم اختيار ${count} فقرات`
  }
}

  INTRO_ALL_GAME_SEGMENTS.forEach(item => {
    const btn = document.getElementById(`introSegmentBtn_${item.key}`)
    if (!btn) return

    const selectedIndex = introVisibleSegmentsClickOrder.indexOf(item.key)
    const selected = selectedIndex !== -1
    const state = btn.querySelector(".introSegmentPickState")

    btn.classList.toggle("selected", selected)

    if (state) {
      state.textContent = selected ? `مختارة ${selectedIndex + 1}` : "اضغط للاختيار"
    }
  })

  if (order) {
    order.innerHTML = buildIntroSegmentsOrderPreview()
  }
}

function toggleIntroVisibleSegment(key) {
  const currentIndex = introVisibleSegmentsClickOrder.indexOf(key)

  if (currentIndex !== -1) {
    introVisibleSegmentsClickOrder.splice(currentIndex, 1)
    refreshIntroSegmentsPickerUI()
    return
  }

  if (introVisibleSegmentsClickOrder.length >= INTRO_MAX_SEGMENTS_COUNT) {
    showGameToast(`مسموح اختيار ${INTRO_MAX_SEGMENTS_COUNT} فقرات كحد أقصى`)
    return
  }

  introVisibleSegmentsClickOrder.push(key)
  refreshIntroSegmentsPickerUI()
}

async function saveIntroVisibleSegments() {
  const modelSelect = document.getElementById("introModelSelect")
  const modelId = Number(modelSelect?.value || 0)

  if (!modelId) {
    showGameToast("اختر النموذج أولاً")
    return false
  }

  if (!introVisibleSegmentsReady) {
    showGameToast("انتظر تحميل الفقرات")
    return false
  }

  if (
    introVisibleSegmentsClickOrder.length < INTRO_MIN_SEGMENTS_COUNT ||
    introVisibleSegmentsClickOrder.length > INTRO_MAX_SEGMENTS_COUNT
  ) {
    showGameToast(`لازم تختار من ${INTRO_MIN_SEGMENTS_COUNT} إلى ${INTRO_MAX_SEGMENTS_COUNT} فقرات`)
    return false
  }

  const rows = INTRO_ALL_GAME_SEGMENTS.map(item => {
    const selectedIndex = introVisibleSegmentsClickOrder.indexOf(item.key)
    const visible = selectedIndex !== -1

    return {
      model: Number(modelId),
      segment_key: item.key,
      is_visible: visible,
      sort_order: visible ? selectedIndex + 1 : 99 + item.sort,
      updated_at: new Date().toISOString()
    }
  })

  const { error } = await db
    .from("visible_segments")
    .upsert(rows, {
      onConflict: "model,segment_key"
    })

  if (error) {
    console.log("INTRO SAVE VISIBLE SEGMENTS ERROR:", error)
    showGameToast("تعذر حفظ فقرات العرض")
    return false
  }

  localStorage.setItem(
    "intro_visible_segments_order",
    JSON.stringify(introVisibleSegmentsClickOrder)
  )

  return true
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

  clearInterval(presenterStartWatchTimer)
  presenterStartWatchTimer = null

  setIntroStartLoading(true, "جارٍ تجهيز اللعبة...")
  setIntroFormDisabled(true)

  const teamA = cleanTeamName(teamAInput.value)
  const teamB = cleanTeamName(teamBInput.value)
  const model = modelSelect.value
  const modelText = getSelectedModelName()

  try {
    resetGameStateBeforeStart()

    const segmentsSaved = await saveIntroVisibleSegments()

    if (!segmentsSaved) {
      introStarting = false
      setIntroFormDisabled(false)
      setIntroStartLoading(false, "بدء اللعبة", false)
      return
    }

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
      presenterStartedAt: null,

      segmentStatus: defaultIntroSegmentStatus(),

      warmup: null,
      top10: null,
      auction: null,
      who: null,
      explain: null,

      final: null,
      finalRound1: null,
      finalRound2: null,
      finalRound3: null,
      finalRound4: null,

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

function renderPresenterIntroCode(code) {
  const codeWrap = document.querySelector(".presenterIntroCodeBox")
  const finalCode = String(code || "").trim() || "----"

  if (!codeWrap) return

  codeWrap.innerHTML = `
    <div class="presenterIntroCodeLabel">
      كود الدخول
    </div>

    <div id="presenterIntroCode" class="presenterIntroCodeValue">
      ${finalCode}
    </div>
  `
}

function openPresenterIntroModal() {
  const modal = document.getElementById("presenterIntroModal")
  const qr = document.getElementById("presenterIntroQr")
  const linkBox = document.getElementById("presenterIntroLink")

  const joinCode =
    localStorage.getItem("game_join_code") ||
    localStorage.getItem("presenter_join_code_temp") ||
    ""

  const url = getPresenterIntroUrl()
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=420x420&data=${encodeURIComponent(url)}`

  if (qr) {
    qr.alt = "QR صفحة المقدم"
    qr.src = qrUrl
  }

  if (linkBox) {
    linkBox.innerText = url
  }

  renderPresenterIntroCode(joinCode)
  bindPresenterIntroCopyActions()

  if (modal) {
    modal.classList.remove("hidden")
    modal.classList.remove("show")

    requestAnimationFrame(() => {
      modal.classList.add("show")
    })
  }

  startPresenterStartWatcher()
}

async function copyIntroText(value, successMessage = "تم النسخ") {
  const text = String(value || "").trim()

  if (!text || text === "----") {
    showGameToast("لا يوجد شيء للنسخ")
    return
  }

  try {
    await navigator.clipboard.writeText(text)
    showGameToast(successMessage)
  } catch (e) {
    console.log("copy error:", e)

    const textarea = document.createElement("textarea")
    textarea.value = text
    textarea.style.position = "fixed"
    textarea.style.opacity = "0"

    document.body.appendChild(textarea)

    textarea.focus()
    textarea.select()

    try {
      document.execCommand("copy")
      showGameToast(successMessage)
    } catch {
      showGameToast("تعذر النسخ")
    }

    textarea.remove()
  }
}

window.copyPresenterIntroLink = function () {
  const linkBox = document.getElementById("presenterIntroLink")
  const url = linkBox?.innerText || getPresenterIntroUrl()

  copyIntroText(url, "تم نسخ رابط المقدم")
}

window.copyPresenterIntroCode = function () {
  const codeBox = document.getElementById("presenterIntroCode")
  const code = codeBox?.innerText || localStorage.getItem("game_join_code") || ""

  copyIntroText(code, "تم نسخ كود المقدم")
}

function bindPresenterIntroCopyActions() {
  const linkBox = document.getElementById("presenterIntroLink")
  const codeBox = document.getElementById("presenterIntroCode")

  if (linkBox) {
    linkBox.title = "اضغط لنسخ الرابط"
    linkBox.style.cursor = "pointer"

    linkBox.onclick = () => {
      window.copyPresenterIntroLink()
    }
  }

  if (codeBox) {
    codeBox.title = "اضغط لنسخ الكود"
    codeBox.style.cursor = "pointer"

    codeBox.onclick = () => {
      window.copyPresenterIntroCode()
    }
  }
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
  const modal = document.getElementById("presenterIntroModal")
  if (!modal) return

  modal.classList.remove("show")

  setTimeout(() => {
    modal.classList.add("hidden")
  }, 220)
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

window.addEventListener("beforeunload", () => {
  clearInterval(presenterStartWatchTimer)
  presenterStartWatchTimer = null
})