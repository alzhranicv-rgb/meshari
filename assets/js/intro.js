/* =========================================================
   INTRO
   تحميل سريع + كاش محلي + علاقات Supabase + تحميل خلفي
========================================================= */

let introModelsLoaded = false
let introStarting = false
let gameToastTimer = null
let presenterStartWatchTimer = null
let presenterStartWatchBusy = false
let introSegmentsRequestToken = 0

const INTRO_MODELS_CACHE_TTL = 10 * 60 * 1000
const INTRO_MODEL_DATA_CACHE_TTL = 5 * 60 * 1000
const INTRO_MODELS_FALLBACK_KEY =
  "intro_models_fallback_v1"

const INTRO_MIN_SEGMENTS_COUNT = 6
const INTRO_MAX_SEGMENTS_COUNT = 11

const INTRO_ALL_GAME_SEGMENTS = [
  {
    key: "warmup",
    title: "التسخين",
    sort: 1
  },

  {
    key: "top10",
    title: "Top 10",
    sort: 2
  },

  {
  key: "familyDidi",
  title: "فاملي ديدي",
  sort: 3
},

  {
    key: "who",
    title: "من هو",
    sort: 4
  },

  {
    key: "explain",
    title: "اشرح الكلمة",
    sort: 5
  },

  {
    key: "finalRound1",
    title: "ٮدوں ٮڡاط",
    sort: 6
  },

  {
    key: "finalRound2",
    title: "صح صحلي",
    sort: 7
  },

  {
    key: "finalRound3",
    title: "قصة",
    sort: 8
  },

  {
    key: "finalRound4",
    title: "التركيز",
    sort: 9
  },

  {
    key: "archive",
    title: "الأرشيف",
    sort: 10
  },

  {
    key: "randomChallenge",
    title: "التحدي",
    sort: 11
  }
]

let introVisibleSegmentsClickOrder = []
let introVisibleSegmentsReady = false
let introAvailableSegments = []

/* =========================================================
   INIT
========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
  ensureIntroLoadingStyles()

  const oldSessionId =
    localStorage.getItem("game_session_id")

  resetIntroPageState()
  prepareIntroInputs()

  const introCard =
    document.querySelector(".introCard")

  if (introCard) {
    introCard.classList.add("softEnter")
  }

  setIntroStartLoading(
    false,
    "بدء اللعبة",
    true
  )

  /*
    إنهاء الجلسة السابقة بالخلفية
    بعد حفظ رقمها وقبل أن يُحذف.
  */
  if (oldSessionId) {
    setTimeout(() => {
      endOldIntroSessionIfExists(
        oldSessionId
      )
    }, 0)
  }

  await loadIntroModels()

  fillSavedIntroValues()
  bindIntroEnterSubmit()
  bindIntroInputCleanup()
  bindIntroModelSegmentsLoader()
})

/* =========================================================
   MODALS
========================================================= */

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

/* =========================================================
   LOADING UI
========================================================= */

function ensureIntroLoadingStyles() {
  if (document.getElementById("introDynamicLoadingStyles")) return

  const style = document.createElement("style")
  style.id = "introDynamicLoadingStyles"

  style.textContent = `
    .introInlineLoading{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      gap:10px;
    }

    .introInlineSpinner{
      width:18px;
      height:18px;
      flex:0 0 18px;
      border-radius:50%;
      border:2px solid rgba(255,255,255,.38);
      border-top-color:currentColor;
      animation:introSpinnerRotation .7s linear infinite;
    }

    .introSegmentsLoadingState{
      min-height:120px;
      width:100%;
      display:flex;
      align-items:center;
      justify-content:center;
      flex-direction:column;
      gap:12px;
      text-align:center;
    }

    .introSegmentsLoadingState .introInlineSpinner{
      width:24px;
      height:24px;
      flex-basis:24px;
      color:#ff7a33;
      border-color:rgba(255,122,51,.2);
      border-top-color:#ff7a33;
    }

    @keyframes introSpinnerRotation{
      to{ transform:rotate(360deg); }
    }

    @media (prefers-reduced-motion:reduce){
      .introInlineSpinner{
        animation-duration:1.4s;
      }
    }
  `

  document.head.appendChild(style)
}

function getIntroLoadingMarkup(text) {
  return `
    <span class="introInlineLoading">
      <span class="introInlineSpinner" aria-hidden="true"></span>
      <span>${escapeIntroHtml(text)}</span>
    </span>
  `
}

function getIntroSegmentsLoadingMarkup(text = "جارٍ تحميل الفقرات...") {
  return `
    <div class="introSegmentsLoadingState">
      <span class="introInlineSpinner" aria-hidden="true"></span>
      <span>${escapeIntroHtml(text)}</span>
    </div>
  `
}

/* =========================================================
   TOAST
========================================================= */

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

/* =========================================================
   HELPERS
========================================================= */

function escapeIntroHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function normalizeIntroSegmentKey(key) {
  const value = String(key || "").trim()

  if (value === "final_round1") return "finalRound1"
  if (value === "final_round2") return "finalRound2"
  if (value === "final_round3") return "finalRound3"
  if (value === "final_round4") return "finalRound4"

  if (
    value === "auction" ||
    value === "fatbla" ||
    value === "fitbala" ||
    value === "فتبلة"
  ) {
    return ""
  }

  return value
}

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

function setIntroStartLoading(
  isLoading,
  text = "بدء اللعبة",
  disabledOverride = null
) {
  const startBtn = document.getElementById("startGameBtn")

  if (!startBtn) return

  startBtn.disabled =
    disabledOverride !== null
      ? disabledOverride
      : !!isLoading

  startBtn.classList.toggle("loading", !!isLoading)
  startBtn.setAttribute("aria-busy", isLoading ? "true" : "false")

  if (isLoading) {
    startBtn.innerHTML = getIntroLoadingMarkup(text)
  } else {
    startBtn.textContent = text
  }
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
  return (
    "game_" +
    Date.now() +
    "_" +
    Math.random().toString(36).slice(2, 8)
  )
}

/* =========================================================
   JOIN CODE
   طلب واحد بدل عدة طلبات
========================================================= */

async function generateUniqueJoinCode() {
  try {
    const { data, error } = await db
      .from("game_sessions")
      .select("join_code")
      .eq("status", "active")
      .not("join_code", "is", null)

    if (error) {
      console.log("join code list error:", error)

      return String(
        Math.floor(1000 + Math.random() * 9000)
      )
    }

    const usedCodes = new Set(
      (data || [])
        .map(row => String(row.join_code || "").trim())
        .filter(Boolean)
    )

    for (let attempt = 0; attempt < 30; attempt++) {
      const code = String(
        Math.floor(1000 + Math.random() * 9000)
      )

      if (!usedCodes.has(code)) {
        return code
      }
    }
  } catch (error) {
    console.log("generateUniqueJoinCode error:", error)
  }

  return String(
    Math.floor(1000 + Math.random() * 9000)
  )
}

/* =========================================================
   MODELS
========================================================= */


function readIntroModelsFallback() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(
        INTRO_MODELS_FALLBACK_KEY
      ) || "[]"
    )

    return Array.isArray(saved)
      ? saved
      : []
  } catch {
    return []
  }
}

function saveIntroModelsFallback(rows = []) {
  try {
    const cleanRows = (Array.isArray(rows) ? rows : [])
      .map(row => ({
        id: row.id,
        name: row.name || `نموذج ${row.id}`
      }))
      .filter(row => row.id)

    if (!cleanRows.length) return

    localStorage.setItem(
      INTRO_MODELS_FALLBACK_KEY,
      JSON.stringify(cleanRows)
    )
  } catch (error) {
    console.log(
      "SAVE INTRO MODELS FALLBACK ERROR:",
      error
    )
  }
}


function renderIntroModelOptions(rows, options = {}) {
  const select = document.getElementById("introModelSelect")

  if (!select) return false

  const preserveValue =
    options.preserveValue !== false
      ? String(select.value || "")
      : ""

  const models = Array.isArray(rows) ? rows : []

  if (!models.length) {
    select.innerHTML = `
      <option value="">
        لا توجد نماذج متاحة
      </option>
    `

    select.disabled = false
    introModelsLoaded = false

    setIntroStartLoading(
      false,
      "بدء اللعبة",
      true
    )

    return false
  }

  select.innerHTML = `
    <option value="">
      اختر النموذج
    </option>
  `

  models.forEach(row => {
    const option = document.createElement("option")

    option.value = String(row.id)
    option.textContent =
      row.name || `نموذج ${row.id}`

    select.appendChild(option)
  })

  if (
    preserveValue &&
    models.some(row => String(row.id) === preserveValue)
  ) {
    select.value = preserveValue
  }

  introModelsLoaded = true
  select.disabled = false

  setIntroStartLoading(
    false,
    "بدء اللعبة",
    false
  )

  return true
}

async function loadIntroModels() {
  const select = document.getElementById("introModelSelect")

  if (!select) return

  introModelsLoaded = false
  select.disabled = true

  select.innerHTML = `
    <option value="">
      جارٍ تحميل النماذج...
    </option>
  `

  if (!window.db || typeof window.cachedSupabaseSelect !== "function") {
    select.innerHTML = `
      <option value="">
        تعذر الاتصال بقاعدة البيانات
      </option>
    `

    select.disabled = false

    setIntroStartLoading(
      false,
      "بدء اللعبة",
      true
    )

    showGameToast("تعذر الاتصال بقاعدة البيانات")
    return
  }

  const result = await window.cachedSupabaseSelect("models", {
    select: "id,name",
    order: {
      column: "id",
      ascending: true
    },
    ttl: INTRO_MODELS_CACHE_TTL,
    staleWhileRevalidate: true,
    onBackgroundUpdate: freshRows => {
      renderIntroModelOptions(freshRows, {
        preserveValue: true
      })
    }
  })

  if (result.error && !result.data?.length) {
    console.log(
      "loadIntroModels error:",
      result.error
    )

    const fallbackModels =
      readIntroModelsFallback()

    if (fallbackModels.length) {
      renderIntroModelOptions(
        fallbackModels,
        {
          preserveValue: false
        }
      )

      showGameToast(
        "تم تحميل النماذج من الكاش"
      )

      return
    }

    select.innerHTML = `
      <option value="">
        تعذر تحميل النماذج
      </option>
    `

    select.disabled = false

    setIntroStartLoading(
      false,
      "بدء اللعبة",
      true
    )

    showGameToast("تعذر تحميل النماذج")
    return
  }

  const rendered = renderIntroModelOptions(
    result.data || [],
    {
      preserveValue: false
    }
  )

  if (rendered) {
    saveIntroModelsFallback(
      result.data || []
    )
  }

  if (!rendered) {
    showGameToast("لا توجد نماذج متاحة")
  }
}

function fillSavedIntroValues() {
  const teamAInput = document.getElementById("teamANameInput")
  const teamBInput = document.getElementById("teamBNameInput")
  const modelSelect = document.getElementById("introModelSelect")

  if (teamAInput) teamAInput.value = ""
  if (teamBInput) teamBInput.value = ""

  if (modelSelect) {
    modelSelect.value = ""
  }
}

/* =========================================================
   EVENTS
========================================================= */

function bindIntroEnterSubmit() {
  const inputs = [
    document.getElementById("teamANameInput"),
    document.getElementById("teamBNameInput"),
    document.getElementById("introModelSelect")
  ]

  inputs.forEach(el => {
    if (!el) return

    el.addEventListener("keydown", event => {
      if (event.key !== "Enter") return

      event.preventDefault()
      startGameFromIntro()
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

/* =========================================================
   VALIDATION
========================================================= */

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
    showIntroFieldError(
      teamAInput,
      "اكتب اسم الفريق الأول"
    )

    return false
  }

  if (!teamB) {
    showIntroFieldError(
      teamBInput,
      "اكتب اسم الفريق الثاني"
    )

    return false
  }

  if (teamA === teamB) {
    showIntroFieldError(
      teamBInput,
      "اكتب اسمًا مختلفًا للفريق الثاني"
    )

    return false
  }

  if (!model) {
    showIntroFieldError(
      modelSelect,
      "اختر النموذج أولاً"
    )

    return false
  }

  if (teamAInput) teamAInput.value = teamA
  if (teamBInput) teamBInput.value = teamB

  if (!introVisibleSegmentsReady) {
    showGameToast("انتظر تحميل الفقرات")
    return false
  }

  if (
    introVisibleSegmentsClickOrder.length <
      INTRO_MIN_SEGMENTS_COUNT ||
    introVisibleSegmentsClickOrder.length >
      INTRO_MAX_SEGMENTS_COUNT
  ) {
    showGameToast(
      `اختر من ${INTRO_MIN_SEGMENTS_COUNT} إلى ${INTRO_MAX_SEGMENTS_COUNT} فقرات للعرض`
    )

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

/* =========================================================
   OLD SESSION CLEANUP
========================================================= */

async function endOldIntroSessionIfExists(
  sessionId = null
) {
  const oldSessionId =
    sessionId ||
    localStorage.getItem(
      "game_session_id"
    )

  if (
    !oldSessionId ||
    !window.db
  ) {
    return false
  }

  try {
    const now =
      new Date().toISOString()

    const { error } = await db
      .from("game_sessions")
      .update({
        status: "ended",
        active_segment: null,
        ended_at: now,
        updated_at: now
      })
      .eq("id", oldSessionId)
      .eq("status", "active")

    if (error) {
      console.log(
        "END OLD INTRO SESSION ERROR:",
        error
      )

      return false
    }

    return true
  } catch (error) {
    console.log(
      "END OLD INTRO SESSION CATCH:",
      error
    )

    return false
  }
}

/* =========================================================
   RESET
========================================================= */

function clearGameLocalState() {
  localStorage.removeItem("segment_start_lottery_v1")
  localStorage.removeItem("main_score_a")
  localStorage.removeItem("main_score_b")

  localStorage.removeItem("active_segment")
  localStorage.removeItem("active_team_v1")
  localStorage.removeItem("segment_status_v1")

  localStorage.removeItem("warmup_state_v1")
  localStorage.removeItem("top10_state_v1")
  localStorage.removeItem(
  "family_didi_state_v1"
)

localStorage.removeItem(
  "family_didi_max_rounds"
)
  localStorage.removeItem("who_state_v1")
  localStorage.removeItem("explain_state_v1")

  localStorage.removeItem("final_state_v1")
  localStorage.removeItem("final_state_v2")
  localStorage.removeItem("final_state_v3")

  localStorage.removeItem("archive_state_v1")
  localStorage.removeItem(
    "random_challenge_state_v1"
  )

  localStorage.removeItem("teamAName")
  localStorage.removeItem("teamBName")

  localStorage.removeItem("game_model")
  localStorage.removeItem("game_model_name")

  localStorage.removeItem("game_session_id")
  localStorage.removeItem("game_join_code")
  localStorage.removeItem(
    "presenter_join_code_temp"
  )
  localStorage.removeItem(
  "selected_game_segments"
  
)

}

function resetIntroPageState() {
  clearGameLocalState()
}

function resetGameStateBeforeStart() {
  clearGameLocalState()

  localStorage.setItem("main_score_a", "0")
  localStorage.setItem("main_score_b", "0")

  localStorage.setItem(
    "segment_status_v1",
    JSON.stringify(
      defaultIntroSegmentStatus()
    )
  )
}

function defaultIntroSegmentStatus() {
  const createStatus = () => ({
    locked: false,
    winner: "",
    scoreA: 0,
    scoreB: 0
  })

  return {
    warmup: createStatus(),
    top10: createStatus(),
    familyDidi: createStatus(),
    who: createStatus(),
    explain: createStatus(),

    final: createStatus(),
    finalRound1: createStatus(),
    finalRound2: createStatus(),
    finalRound3: createStatus(),
    finalRound4: createStatus(),

    archive: createStatus(),
    randomChallenge: createStatus()
  }
}

/* =========================================================
   SEGMENTS LOADER
========================================================= */

function bindIntroModelSegmentsLoader() {
  const modelSelect =
    document.getElementById("introModelSelect")

  if (!modelSelect) return

  modelSelect.addEventListener("change", () => {
    modelSelect.classList.remove("introFieldError")

    introVisibleSegmentsReady = false
    introVisibleSegmentsClickOrder = []
    introAvailableSegments = []

    clearIntroSegmentSelectionUI()

    loadIntroVisibleSegments()
  })
}

function clearIntroSegmentSelectionUI() {
  const counter =
    document.getElementById("introSegmentsCounter")

  const triggerCounter =
    document.getElementById("introSegmentsTriggerCounter")

  const triggerSummary =
    document.getElementById("introSegmentsTriggerSummary")

  const order =
    document.getElementById("introSegmentsOrder")

  const grid =
    document.getElementById("introSegmentsGrid")

  if (counter) {
    counter.innerText =
      `0 / ${INTRO_MIN_SEGMENTS_COUNT}-${INTRO_MAX_SEGMENTS_COUNT}`

    counter.classList.remove("ok")
    counter.classList.add("bad")
  }

  if (triggerCounter) {
    triggerCounter.innerText =
      `0 / ${INTRO_MIN_SEGMENTS_COUNT}-${INTRO_MAX_SEGMENTS_COUNT}`

    triggerCounter.classList.remove("ok")
    triggerCounter.classList.add("bad")
  }

  if (triggerSummary) {
    triggerSummary.textContent = "اختر الفقرات"
  }

  if (order) {
    order.innerHTML = ""
  }

  if (grid) {
    grid.innerHTML = `
      <div class="introSegmentsEmpty">
        اختر النموذج أولاً
      </div>
    `
  }
}

function getIntroDefaultVisibleSegmentsMap() {
  const map = {}

  INTRO_ALL_GAME_SEGMENTS.forEach(item => {
    map[item.key] = {
      is_visible:
        item.sort <= INTRO_MIN_SEGMENTS_COUNT,
      sort_order: item.sort
    }
  })

  return map
}

function buildIntroVisibleSegmentsMap(
  rows = []
) {
  const map =
    getIntroDefaultVisibleSegmentsMap()

  ;(rows || []).forEach(row => {
    const segmentKey = normalizeIntroSegmentKey(row.segment_key)

if (!segmentKey || !map[segmentKey]) {
  return
}

    map[segmentKey] = {
      is_visible:
        !!row.is_visible,

      sort_order:
        Number(
          row.sort_order ||
          map[segmentKey].sort_order
        )
    }
  })

  return map
}


/* =========================================================
   DEFAULT SEGMENTS
========================================================= */

async function ensureIntroVisibleSegmentsDefaults(
  modelId,
  currentRows = []
) {
  if (!modelId) return false

  const existingKeys = new Set(
  (currentRows || []).map(row => {
    return normalizeIntroSegmentKey(
      row.segment_key
    )
  })
)

  const now = new Date().toISOString()

  const rows = INTRO_ALL_GAME_SEGMENTS
    .filter(item => !existingKeys.has(item.key))
    .map(item => ({
      model: Number(modelId),
      segment_key: item.key,
      is_visible:
        item.sort <= INTRO_MIN_SEGMENTS_COUNT,
      sort_order: item.sort,
      updated_at: now
    }))

  if (!rows.length) {
    return true
  }

  try {
    let result

    if (typeof window.upsertData === "function") {
      result = await window.upsertData(
        "visible_segments",
        rows,
        {
          onConflict: "model,segment_key"
        }
      )
    } else {
      const { data, error } = await db
        .from("visible_segments")
        .upsert(rows, {
          onConflict: "model,segment_key"
        })
        .select()

      result = { data, error }
    }

    if (result?.error) {
      console.log(
        "INTRO ENSURE VISIBLE SEGMENTS ERROR:",
        result.error
      )

      return false
    }

    if (typeof window.invalidateModelCache === "function") {
      window.invalidateModelCache(modelId)
    }

    return true
  } catch (error) {
    console.log(
      "INTRO ENSURE VISIBLE SEGMENTS CATCH:",
      error
    )

    return false
  }
}

/* =========================================================
   RELATIONAL MODEL DATA
========================================================= */

function getIntroSupabaseCachePrefix() {
  return typeof window.SUPABASE_CACHE_PREFIX === "string"
    ? window.SUPABASE_CACHE_PREFIX
    : "supabase_cache_"
}

async function loadIntroModelRelations(
  modelId,
  options = {}
) {
  const numericModelId =
    Number(modelId || 0)

  if (!numericModelId) {
    return {
      data: null,
      error: new Error(
        "رقم النموذج غير صالح"
      ),
      source: "validation"
    }
  }

  /*
    المحاولة الأولى:
    استعلام واحد بالعلاقات.
  */
  if (
    typeof window.loadModelWithRelations ===
    "function"
  ) {
    const relationResult =
      await window.loadModelWithRelations(
        numericModelId,
        {
          ttl:
            INTRO_MODEL_DATA_CACHE_TTL,

          staleWhileRevalidate:
            options
              .staleWhileRevalidate !==
            false,

          forceRefresh:
            options.forceRefresh === true,

          onBackgroundUpdate:
            options.onBackgroundUpdate
        }
      )

    if (
      relationResult?.data &&
      !relationResult?.error
    ) {
      return relationResult
    }

    console.log(
      "INTRO RELATION QUERY FAILED, USING FALLBACK:",
      relationResult?.error
    )
  }

  /*
    البديل:
    يعمل حتى لو لم توجد Foreign Keys.
  */
  try {
    const modelCacheKey =
      `intro_model_basic:${numericModelId}`

    const visibleCacheKey =
      `intro_visible_segments:${numericModelId}`

    const settingsCacheKey =
      `intro_segment_settings:${numericModelId}`

    const [
      modelResult,
      visibleResult,
      settingsResult
    ] = await Promise.all([
      window.cachedSupabaseSelect(
        "models",
        {
          select: "id,name",

          filters: {
            id: numericModelId
          },

          maybeSingle: true,

          ttl:
            INTRO_MODEL_DATA_CACHE_TTL,

          forceRefresh:
            options.forceRefresh === true,

          staleWhileRevalidate:
            options
              .staleWhileRevalidate !==
            false,

          cacheKey:
  `${getIntroSupabaseCachePrefix()}${modelCacheKey}`
        }
      ),

      window.cachedSupabaseSelect(
        "visible_segments",
        {
          select:
            "segment_key,is_visible,sort_order",

          filters: {
            model: numericModelId
          },

          order: {
            column: "sort_order",
            ascending: true
          },

          ttl:
            INTRO_MODEL_DATA_CACHE_TTL,

          forceRefresh:
            options.forceRefresh === true,

          staleWhileRevalidate:
            options
              .staleWhileRevalidate !==
            false,

          cacheKey:
  `${getIntroSupabaseCachePrefix()}${visibleCacheKey}`
        }
      ),

      window.cachedSupabaseSelect(
        "segment_settings",
        {
          select:
            "segment,item_count",

          filters: {
            model: numericModelId
          },

          ttl:
            INTRO_MODEL_DATA_CACHE_TTL,

          forceRefresh:
            options.forceRefresh === true,

          staleWhileRevalidate:
            options
              .staleWhileRevalidate !==
            false,

          cacheKey:
  `${getIntroSupabaseCachePrefix()}${settingsCacheKey}`
        }
      )
    ])

    if (
      modelResult.error &&
      !modelResult.data
    ) {
      return {
        data: null,
        error: modelResult.error,
        source: "fallback-error"
      }
    }

    const combinedData = {
      ...(modelResult.data || {
        id: numericModelId,
        name: ""
      }),

      visible_segments:
        visibleResult.data || [],

      segment_settings:
        settingsResult.data || []
    }

    return {
      data: combinedData,
      error:
        modelResult.error ||
        visibleResult.error ||
        settingsResult.error ||
        null,
      source: "fallback"
    }
  } catch (error) {
    console.log(
      "INTRO MODEL FALLBACK ERROR:",
      error
    )

    return {
      data: null,
      error,
      source: "error"
    }
  }
}

/* =========================================================
   APPLY SEGMENT DATA
========================================================= */

function applyIntroSegmentsData({
  modelId,
  visibleRows = [],
  preserveSelection = false
}) {
  const selectedModelId = Number(
    document.getElementById("introModelSelect")?.value || 0
  )

  if (
    !modelId ||
    selectedModelId !== Number(modelId)
  ) {
    return
  }

  const visibleMap =
    buildIntroVisibleSegmentsMap(visibleRows)

  const sortedSegments = [
    ...INTRO_ALL_GAME_SEGMENTS
  ]
    .filter(item => {
      const row =
        visibleMap[item.key]

      return (
        row &&
        row.is_visible !== false
      )
    })
    .sort((a, b) => {
      const firstOrder = Number(
        visibleMap[a.key]?.sort_order ||
        a.sort
      )

      const secondOrder = Number(
        visibleMap[b.key]?.sort_order ||
        b.sort
      )

      return firstOrder - secondOrder
    })

  introAvailableSegments = sortedSegments

  if (!preserveSelection) {
    introVisibleSegmentsClickOrder = []
  } else {
    introVisibleSegmentsClickOrder =
      introVisibleSegmentsClickOrder.filter(key => {
        return introAvailableSegments.some(
          item => item.key === key
        )
      })
  }

  introVisibleSegmentsReady = true

  renderIntroSegmentsPicker(
    introAvailableSegments
  )
}

/* =========================================================
   LOAD VISIBLE SEGMENTS
========================================================= */

async function loadIntroVisibleSegments() {
  const modelSelect =
    document.getElementById("introModelSelect")

  const modelId = Number(
    modelSelect?.value || 0
  )

  const grid =
    document.getElementById("introSegmentsGrid")

  const counter =
    document.getElementById("introSegmentsCounter")

  const triggerCounter =
    document.getElementById("introSegmentsTriggerCounter")

  const triggerSummary =
    document.getElementById("introSegmentsTriggerSummary")

  const order =
    document.getElementById("introSegmentsOrder")

  const requestToken =
    ++introSegmentsRequestToken

  introVisibleSegmentsReady = false
  introVisibleSegmentsClickOrder = []
  introAvailableSegments = []

  if (counter) {
    counter.innerText =
      `0 / ${INTRO_MIN_SEGMENTS_COUNT}-${INTRO_MAX_SEGMENTS_COUNT}`

    counter.classList.remove("ok")
    counter.classList.add("bad")
  }

  if (triggerCounter) {
    triggerCounter.innerText =
      `0 / ${INTRO_MIN_SEGMENTS_COUNT}-${INTRO_MAX_SEGMENTS_COUNT}`

    triggerCounter.classList.remove("ok")
    triggerCounter.classList.add("bad")
  }

  if (triggerSummary) {
    triggerSummary.textContent =
      modelId
        ? "جارٍ تحميل الفقرات..."
        : "اختر النموذج أولاً"
  }

  if (order) {
    order.innerHTML = ""
  }

  if (!grid) return

  if (!modelId) {
    grid.innerHTML = `
      <div class="introSegmentsEmpty">
        اختر النموذج أولاً
      </div>
    `

    return
  }

  grid.innerHTML =
    getIntroSegmentsLoadingMarkup(
      "جارٍ تحميل الفقرات..."
    )

  const modelResult =
    await loadIntroModelRelations(
      modelId,
      {
        staleWhileRevalidate: true,

        onBackgroundUpdate: freshModel => {
          const currentModelId =
            Number(
              document.getElementById(
                "introModelSelect"
              )?.value || 0
            )

          if (
            currentModelId !== modelId ||
            requestToken !== introSegmentsRequestToken
          ) {
            return
          }

          applyIntroSegmentsData({
            modelId,
            visibleRows:
              freshModel?.visible_segments || [],
            preserveSelection: true
          })
        }
      }
    )

  if (
    requestToken !==
    introSegmentsRequestToken
  ) {
    return
  }

  if (
    modelResult.error &&
    !modelResult.data
  ) {
    console.log(
      "INTRO MODEL RELATIONS ERROR:",
      modelResult.error
    )

    grid.innerHTML = `
      <div class="introSegmentsEmpty">
        تعذر تحميل الفقرات
      </div>
    `

    if (triggerSummary) {
      triggerSummary.textContent =
        "تعذر تحميل الفقرات"
    }

    showGameToast("تعذر تحميل الفقرات")
    return
  }

  const modelData =
    modelResult.data || {}

  const visibleRows =
    Array.isArray(modelData.visible_segments)
      ? modelData.visible_segments
      : []

  applyIntroSegmentsData({
    modelId,
    visibleRows,
    preserveSelection: false
  })

  setTimeout(async () => {
    const currentModelId =
      Number(
        document.getElementById(
          "introModelSelect"
        )?.value || 0
      )

    if (
      currentModelId !== modelId ||
      requestToken !== introSegmentsRequestToken
    ) {
      return
    }

    const defaultsReady =
      await ensureIntroVisibleSegmentsDefaults(
        modelId,
        visibleRows
      )

    if (!defaultsReady) return

    if (
      visibleRows.length >=
      INTRO_ALL_GAME_SEGMENTS.length
    ) {
      return
    }

    const freshResult =
      await loadIntroModelRelations(
        modelId,
        {
          forceRefresh: true,
          staleWhileRevalidate: false
        }
      )

    const latestSelectedModelId =
      Number(
        document.getElementById(
          "introModelSelect"
        )?.value || 0
      )

    if (
      latestSelectedModelId !== modelId ||
      requestToken !== introSegmentsRequestToken
    ) {
      return
    }

    if (!freshResult?.data) return

    applyIntroSegmentsData({
      modelId,
      visibleRows:
        freshResult.data.visible_segments || [],
      preserveSelection: true
    })
  }, 0)
}

/* =========================================================
   RENDER SEGMENTS
========================================================= */

function renderIntroSegmentsPicker(
  segmentsList = introAvailableSegments
) {
  const grid =
    document.getElementById("introSegmentsGrid")

  if (!grid) return

  const list = Array.isArray(segmentsList)
    ? segmentsList
    : introAvailableSegments

  if (!list.length) {
    grid.innerHTML = `
      <div class="introSegmentsEmpty">
        لا توجد فقرات مفعلة حاليًا
      </div>
    `

    refreshIntroSegmentsPickerUI()
    return
  }

  grid.innerHTML = list
    .map(item => {
      const selectedIndex =
        introVisibleSegmentsClickOrder.indexOf(
          item.key
        )

      const selected =
        selectedIndex !== -1

      return `
        <button
          type="button"
          class="introSegmentPickBtn ${
            selected ? "selected" : ""
          }"
          id="introSegmentBtn_${escapeIntroHtml(item.key)}"
          data-order="${
            selected
              ? selectedIndex + 1
              : ""
          }"
          onclick="toggleIntroVisibleSegment('${escapeIntroHtml(item.key)}')"
        >
          <span class="introSegmentPickTitle">
            ${escapeIntroHtml(item.title)}
          </span>

          <span class="introSegmentPickState"></span>
        </button>
      `
    })
    .join("")

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
        <strong>
          ${introVisibleSegmentsClickOrder.length}
        </strong>
      </div>

      <div class="introSegmentsOrderTrack">

        ${introVisibleSegmentsClickOrder
          .map((key, index) => {
            const item =
              introAvailableSegments.find(
                segment => segment.key === key
              ) ||
              INTRO_ALL_GAME_SEGMENTS.find(
                segment => segment.key === key
              )

            return `
              <div class="introSegmentsOrderStep">

                <div class="introSegmentsOrderStepNo">
                  ${index + 1}
                </div>

                <div class="introSegmentsOrderStepText">
                  ${escapeIntroHtml(item?.title || key)}
                </div>

              </div>
            `
          })
          .join("")}

      </div>

    </div>
  `
}

function refreshIntroSegmentsPickerUI() {
  const count =
    introVisibleSegmentsClickOrder.length

  const counter =
    document.getElementById("introSegmentsCounter")

  const triggerCounter =
    document.getElementById("introSegmentsTriggerCounter")

  const triggerSummary =
    document.getElementById("introSegmentsTriggerSummary")

  const order =
    document.getElementById("introSegmentsOrder")

  const countOk =
    count >= INTRO_MIN_SEGMENTS_COUNT &&
    count <= INTRO_MAX_SEGMENTS_COUNT

  if (counter) {
    counter.innerText =
      `${count} / ${INTRO_MIN_SEGMENTS_COUNT}-${INTRO_MAX_SEGMENTS_COUNT}`

    counter.classList.toggle("ok", countOk)
    counter.classList.toggle("bad", !countOk)
  }

  if (triggerCounter) {
    triggerCounter.innerText =
      `${count} / ${INTRO_MIN_SEGMENTS_COUNT}-${INTRO_MAX_SEGMENTS_COUNT}`

    triggerCounter.classList.toggle("ok", countOk)
    triggerCounter.classList.toggle("bad", !countOk)
  }

  if (triggerSummary) {
    if (!introVisibleSegmentsReady) {
      triggerSummary.textContent =
        "اختر النموذج أولاً"
    } else if (!introAvailableSegments.length) {
      triggerSummary.textContent =
        "لا توجد فقرات مفعلة"
    } else if (!count) {
      triggerSummary.textContent =
        "اختر الفقرات"
    } else {
      triggerSummary.textContent =
        `تم اختيار ${count} فقرات`
    }
  }

  introAvailableSegments.forEach(item => {
    const btn = document.getElementById(
      `introSegmentBtn_${item.key}`
    )

    if (!btn) return

    const selectedIndex =
      introVisibleSegmentsClickOrder.indexOf(
        item.key
      )

    const selected =
      selectedIndex !== -1

    btn.classList.toggle(
      "selected",
      selected
    )

    if (selected) {
      btn.dataset.order =
        String(selectedIndex + 1)
    } else {
      btn.removeAttribute("data-order")
    }

    const state = btn.querySelector(
      ".introSegmentPickState"
    )

    if (state) {
      state.textContent = selected
        ? `مختارة ${selectedIndex + 1}`
        : "اضغط للاختيار"
    }
  })

  if (order) {
    order.innerHTML =
      buildIntroSegmentsOrderPreview()
  }
}

function getIntroSelectedSegmentsForSession() {
  const availableMap =
    new Map(
      introAvailableSegments.map(item => [
        item.key,
        item
      ])
    )

  return introVisibleSegmentsClickOrder
    .map((key, index) => {
      const item =
        availableMap.get(key)

      if (!item) return null

      return {
        key: item.key,
        segment_key: item.key,
        title: item.title || item.name || "",
        sort_order: index + 1,
        is_visible: true
      }
    })
    .filter(Boolean)
}

window.toggleIntroVisibleSegment =
  function (key) {
    const exists =
      introAvailableSegments.some(
        item => item.key === key
      )

    if (!exists) {
      showGameToast(
        "هذه الفقرة معطلة من الأدمن"
      )

      return
    }

    const currentIndex =
      introVisibleSegmentsClickOrder.indexOf(key)

    if (currentIndex !== -1) {
      introVisibleSegmentsClickOrder.splice(
        currentIndex,
        1
      )

      refreshIntroSegmentsPickerUI()
      return
    }

    if (
      introVisibleSegmentsClickOrder.length >=
      INTRO_MAX_SEGMENTS_COUNT
    ) {
      showGameToast(
        `مسموح اختيار ${INTRO_MAX_SEGMENTS_COUNT} فقرات كحد أقصى`
      )

      return
    }

    introVisibleSegmentsClickOrder.push(key)
    refreshIntroSegmentsPickerUI()
  }

/* =========================================================
   SAVE SEGMENTS
========================================================= */

async function saveIntroVisibleSegments() {
  const modelSelect =
    document.getElementById("introModelSelect")

  const modelId = Number(
    modelSelect?.value || 0
  )

  if (!modelId) {
    showGameToast("اختر النموذج أولاً")
    return false
  }

  if (!introVisibleSegmentsReady) {
    showGameToast("انتظر تحميل الفقرات")
    return false
  }

  introVisibleSegmentsClickOrder =
    introVisibleSegmentsClickOrder.filter(key => {
      return introAvailableSegments.some(
        item => item.key === key
      )
    })

  const selectedCount =
    introVisibleSegmentsClickOrder.length

  if (
    selectedCount < INTRO_MIN_SEGMENTS_COUNT ||
    selectedCount > INTRO_MAX_SEGMENTS_COUNT
  ) {
    showGameToast(
      `لازم تختار من ${INTRO_MIN_SEGMENTS_COUNT} إلى ${INTRO_MAX_SEGMENTS_COUNT} فقرات`
    )

    return false
  }

  localStorage.setItem(
    "selected_game_segments",
    JSON.stringify(
      introVisibleSegmentsClickOrder
    )
  )

  return true
}

/* =========================================================
   START GAME
========================================================= */

window.startGameFromIntro = async function () {
  if (introStarting) return

  const teamAInput = document.getElementById("teamANameInput")
  const teamBInput = document.getElementById("teamBNameInput")
  const modelSelect = document.getElementById("introModelSelect")

  if (!validateIntroForm()) return

  introStarting = true

  clearInterval(presenterStartWatchTimer)
  presenterStartWatchTimer = null
  presenterStartWatchBusy = false

  setIntroStartLoading(
    true,
    "جارٍ تجهيز اللعبة..."
  )

  setIntroFormDisabled(true)

  const teamA = cleanTeamName(teamAInput?.value)
  const teamB = cleanTeamName(teamBInput?.value)
  const model = modelSelect?.value || ""
  const modelText = getSelectedModelName()

  try {
    resetGameStateBeforeStart()

    const segmentsSaved =
      await saveIntroVisibleSegments()

    if (!segmentsSaved) {
      introStarting = false
      setIntroFormDisabled(false)

      setIntroStartLoading(
        false,
        "بدء اللعبة",
        false
      )

      return
    }

    localStorage.setItem("teamAName", teamA)
    localStorage.setItem("teamBName", teamB)
    localStorage.setItem("game_model", model)
    localStorage.setItem("game_model_name", modelText)

    const gameSessionId = createGameSessionId()
    const joinCode = await generateUniqueJoinCode()

    localStorage.setItem(
      "game_session_id",
      gameSessionId
    )

    localStorage.setItem(
      "game_join_code",
      joinCode
    )

    localStorage.setItem(
      "presenter_join_code_temp",
      joinCode
    )

    const sessionState = {
  mainScores: {
    A: 0,
    B: 0
  },

  activeTeam: "",

  currentModelName:
    modelText,

  displayControlsHidden:
    false,

  presenterStarted:
    false,

  presenterStartedAt:
    null,

  currentSegmentScores: 
    null,

  segmentStatus:
    defaultIntroSegmentStatus(),

  warmup:
    null,

  top10:
    null,

  familyDidi:
  null,

  who:
    null,

  explain:
    null,

  final:
    null,

  finalRound1:
    null,

  finalRound2:
    null,

  finalRound3:
    null,

  finalRound4:
    null,

  archive:
    null,

  randomChallenge:
    null,

  selectedSegments:
    getIntroSelectedSegmentsForSession(),

  selectedSegmentKeys:
    introVisibleSegmentsClickOrder.slice(),

  toast:
    null
}

    const { error } = await db
      .from("game_sessions")
      .upsert({
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
      console.log(
        "create session error:",
        error
      )

      throw error
    }

    localStorage.setItem("main_score_a", "0")
    localStorage.setItem("main_score_b", "0")

    openPresenterIntroModal()

    setIntroStartLoading(
      false,
      "الجلسة جاهزة",
      true
    )

    showGameToast("تم تجهيز صفحة المقدم")
  } catch (error) {
    console.log(
      "startGameFromIntro error:",
      error
    )

    introStarting = false
    setIntroFormDisabled(false)

    setIntroStartLoading(
      false,
      "بدء اللعبة",
      false
    )

    showGameToast("تعذر إنشاء جلسة المقدم")
  }
}

/* =========================================================
   PRESENTER MODAL
========================================================= */

function getPresenterIntroUrl() {
  return new URL(
    "presenter.html?join=1",
    window.location.href
  ).href
}

function renderPresenterIntroCode(code) {
  const codeWrap =
    document.querySelector(
      ".presenterIntroCodeBox"
    )

  const finalCode =
    String(code || "").trim() || "----"

  if (!codeWrap) return

  codeWrap.innerHTML = `
    <div class="presenterIntroCodeLabel">
      كود الدخول
    </div>

    <div
      id="presenterIntroCode"
      class="presenterIntroCodeValue"
    >
      ${escapeIntroHtml(finalCode)}
    </div>
  `
}

function openPresenterIntroModal() {
  const modal =
    document.getElementById(
      "presenterIntroModal"
    )

  const qr =
    document.getElementById(
      "presenterIntroQr"
    )

  const linkBox =
    document.getElementById(
      "presenterIntroLink"
    )

  const joinCode =
    localStorage.getItem("game_join_code") ||
    localStorage.getItem(
      "presenter_join_code_temp"
    ) ||
    ""

  const url = getPresenterIntroUrl()

  const qrUrl =
    `https://api.qrserver.com/v1/create-qr-code/?size=420x420&data=${encodeURIComponent(url)}`

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

async function copyIntroText(
  value,
  successMessage = "تم النسخ"
) {
  const text = String(value || "").trim()

  if (!text || text === "----") {
    showGameToast("لا يوجد شيء للنسخ")
    return
  }

  try {
    await navigator.clipboard.writeText(text)
    showGameToast(successMessage)
  } catch (error) {
    console.log("copy error:", error)

    const textarea =
      document.createElement("textarea")

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
  const linkBox =
    document.getElementById(
      "presenterIntroLink"
    )

  const url =
    linkBox?.innerText ||
    getPresenterIntroUrl()

  copyIntroText(
    url,
    "تم نسخ رابط المقدم"
  )
}

window.copyPresenterIntroCode = function () {
  const codeBox =
    document.getElementById(
      "presenterIntroCode"
    )

  const code =
    codeBox?.innerText ||
    localStorage.getItem("game_join_code") ||
    ""

  copyIntroText(
    code,
    "تم نسخ كود المقدم"
  )
}

function bindPresenterIntroCopyActions() {
  const linkBox =
    document.getElementById(
      "presenterIntroLink"
    )

  const codeBox =
    document.getElementById(
      "presenterIntroCode"
    )

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

/* =========================================================
   PRESENTER START WATCHER
========================================================= */

function startPresenterStartWatcher() {
  clearInterval(presenterStartWatchTimer)

  presenterStartWatchBusy = false

  presenterStartWatchTimer =
    setInterval(async () => {
      if (presenterStartWatchBusy) return

      const sessionId =
        localStorage.getItem(
          "game_session_id"
        )

      if (!sessionId || !window.db) return

      presenterStartWatchBusy = true

      try {
        const { data, error } = await db
          .from("game_sessions")
          .select("state")
          .eq("id", sessionId)
          .maybeSingle()

        if (error) {
          console.log(
            "presenter start watch error:",
            error
          )

          return
        }

        if (data?.state?.presenterStarted) {
          clearInterval(
            presenterStartWatchTimer
          )

          presenterStartWatchTimer = null
          presenterStartWatchBusy = false

          window.location.href =
            "display.html"
        }
      } catch (error) {
        console.log(
          "presenter start watcher catch:",
          error
        )
      } finally {
        presenterStartWatchBusy = false
      }
    }, 1800)
}

function closePresenterIntroModal() {
  const modal =
    document.getElementById(
      "presenterIntroModal"
    )

  if (!modal) return

  modal.classList.remove("show")

  setTimeout(() => {
    modal.classList.add("hidden")
  }, 220)
}

function goToDisplayFromIntro() {
  const sessionId =
    localStorage.getItem(
      "game_session_id"
    )

  if (!sessionId) {
    showGameToast("أنشئ الجلسة أولاً")
    return
  }

  clearInterval(presenterStartWatchTimer)

  presenterStartWatchTimer = null
  presenterStartWatchBusy = false

  window.location.href = "display.html"
}

/* =========================================================
   GLOBAL EXPORTS
========================================================= */

window.openPresenterIntroModal =
  openPresenterIntroModal

window.closePresenterIntroModal =
  closePresenterIntroModal

window.goToDisplayFromIntro =
  goToDisplayFromIntro

window.loadIntroVisibleSegments =
  loadIntroVisibleSegments

window.saveIntroVisibleSegments =
  saveIntroVisibleSegments

/* =========================================================
   CLEANUP
========================================================= */

window.addEventListener(
  "beforeunload",
  () => {
    clearInterval(
      presenterStartWatchTimer
    )

    presenterStartWatchTimer = null
    presenterStartWatchBusy = false
  }
)