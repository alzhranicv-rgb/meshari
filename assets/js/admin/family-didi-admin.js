/* =========================================================
   FAMILY DIDI ADMIN
========================================================= */

/* =========================
   1) Local State
========================= */

const FAMILY_DIDI_MIN_ROUNDS = 1
const FAMILY_DIDI_MAX_ROUNDS = 5
const FAMILY_DIDI_MAX_ANSWERS = 8
const FAMILY_DIDI_DEFAULT_TIMER = 15

let familyDidiAdminRoundsCount = 3
let familyDidiAdminDraft = {}

/* =========================
   2) Draft Helpers
========================= */

function createFamilyDidiDraftAnswer() {
  return {
    answer: "",
    points: 0
  }
}

function normalizeFamilyDidiAnswersCount(value) {
  return Math.min(
    Math.max(
      Number(value || FAMILY_DIDI_MAX_ANSWERS),
      1
    ),
    FAMILY_DIDI_MAX_ANSWERS
  )
}

function normalizeFamilyDidiTotalPoints(value) {
  const text =
    String(value ?? "").trim()

  if (!text) {
    return ""
  }

  const total =
    Math.floor(
      Number(text)
    )

  if (
    !Number.isFinite(total) ||
    total < 1
  ) {
    return ""
  }

  return total
}

function getFamilyDidiDraftRound(roundNumber) {
  const roundNumberSafe = Math.min(
    Math.max(
      Number(roundNumber || 1),
      FAMILY_DIDI_MIN_ROUNDS
    ),
    FAMILY_DIDI_MAX_ROUNDS
  )

  if (!familyDidiAdminDraft[roundNumberSafe]) {
    familyDidiAdminDraft[roundNumberSafe] = {
  question: "",

  answersCount:
    FAMILY_DIDI_MAX_ANSWERS,

  totalPoints: "",

  timerSeconds:
    FAMILY_DIDI_DEFAULT_TIMER,

  answers: {}
}
  }

  const round =
    familyDidiAdminDraft[roundNumberSafe]

  round.question =
    String(round.question || "").trim()

  round.answersCount =
    normalizeFamilyDidiAnswersCount(
      round.answersCount
    )

  round.timerSeconds =
  FAMILY_DIDI_DEFAULT_TIMER

round.totalPoints =
  normalizeFamilyDidiTotalPoints(
    round.totalPoints
  )

  if (
    !round.answers ||
    typeof round.answers !== "object"
  ) {
    round.answers = {}
  }

  for (
    let position = 1;
    position <= FAMILY_DIDI_MAX_ANSWERS;
    position++
  ) {
    const current =
      round.answers[position]

    if (typeof current === "string") {
      round.answers[position] = {
        answer: current.trim(),
        points: 0
      }

      continue
    }

    round.answers[position] = {
      answer:
        String(
          current?.answer || ""
        ).trim(),

      points:
        Math.max(
          0,
          Number(
            current?.points || 0
          )
        )
    }
  }

  return round
}

function resetFamilyDidiAdminDraft() {
  familyDidiAdminDraft = {}

  for (
    let roundNumber = FAMILY_DIDI_MIN_ROUNDS;
    roundNumber <= FAMILY_DIDI_MAX_ROUNDS;
    roundNumber++
  ) {
    getFamilyDidiDraftRound(
      roundNumber
    )
  }
}

function resetFamilyDidiDraftRound(
  roundNumber
) {
  const roundNumberSafe = Math.min(
    Math.max(
      Number(roundNumber || 1),
      FAMILY_DIDI_MIN_ROUNDS
    ),
    FAMILY_DIDI_MAX_ROUNDS
  )

  delete familyDidiAdminDraft[
    roundNumberSafe
  ]

  return getFamilyDidiDraftRound(
    roundNumberSafe
  )
}

function getFamilyDidiInputValue(
  ids = []
) {
  for (const id of ids) {
    const element =
      document.getElementById(id)

    if (element) {
      return element.value
    }
  }

  return ""
}

function collectFamilyDidiCurrentDraft() {
  const totalRounds = Math.min(
    Math.max(
      Number(
        familyDidiAdminRoundsCount || 3
      ),
      FAMILY_DIDI_MIN_ROUNDS
    ),
    FAMILY_DIDI_MAX_ROUNDS
  )

  for (
    let roundNumber = FAMILY_DIDI_MIN_ROUNDS;
    roundNumber <= totalRounds;
    roundNumber++
  ) {
    const round =
      getFamilyDidiDraftRound(
        roundNumber
      )

    round.question =
      String(
        getFamilyDidiInputValue([
          `familyDidiQuestion${roundNumber}`,
          `topq${roundNumber}`
        ]) ||
        round.question ||
        ""
      ).trim()

    round.answersCount =
      normalizeFamilyDidiAnswersCount(
        getFamilyDidiInputValue([
          `familyDidiAnswersCount${roundNumber}`
        ]) ||
        round.answersCount
      )

    round.timerSeconds =
  FAMILY_DIDI_DEFAULT_TIMER

round.totalPoints =
  normalizeFamilyDidiTotalPoints(
    getFamilyDidiInputValue([
      `familyDidiTotalPoints${roundNumber}`
    ]) ||
    round.totalPoints
  )

    for (
      let position = 1;
      position <= FAMILY_DIDI_MAX_ANSWERS;
      position++
    ) {
      const current =
        round.answers[position] ||
        createFamilyDidiDraftAnswer()

      const answerValue =
        getFamilyDidiInputValue([
          `familyDidiAnswer${roundNumber}_${position}`,
          `top${roundNumber}_${position}`
        ])

      const pointsValue =
        getFamilyDidiInputValue([
          `familyDidiPoints${roundNumber}_${position}`
        ])

      round.answers[position] = {
        answer:
          String(
            answerValue !== ""
              ? answerValue
              : current.answer || ""
          ).trim(),

        points:
          Math.max(
            0,
            Number(
              pointsValue !== ""
                ? pointsValue
                : current.points || 0
            )
          )
      }
    }
  }
}

/* =========================
   3) Completion Status
========================= */

function getFamilyDidiRoundStatus(
  roundNumber
) {
  const round =
    getFamilyDidiDraftRound(
      roundNumber
    )

  const answersCount =
    normalizeFamilyDidiAnswersCount(
      round.answersCount
    )

  let completed = 0
  let total = 3

  if (
    isAdminFieldFilled(
      round.question
    )
  ) {
    completed++
  }

if (
  Number.isFinite(
    Number(round.totalPoints)
  ) &&
  Number(round.totalPoints) > 0
) {
  completed++
}

  if (
    Number.isFinite(
      Number(answersCount)
    ) &&
    answersCount >= 1
  ) {
    completed++
  }

  for (
    let position = 1;
    position <= answersCount;
    position++
  ) {
    const item =
      round.answers[position] ||
      createFamilyDidiDraftAnswer()

    total += 2

    if (
      isAdminFieldFilled(
        item.answer
      )
    ) {
      completed++
    }

    if (
      Number.isFinite(
        Number(item.points)
      ) &&
      Number(item.points) >= 0
    ) {
      completed++
    }
  }

  return getAdminItemStatus(
    completed,
    total
  )
}

function getFamilyDidiAnswerStatus(
  roundNumber,
  answerNumber
) {
  const round =
    getFamilyDidiDraftRound(
      roundNumber
    )

  const item =
    round.answers[answerNumber] ||
    createFamilyDidiDraftAnswer()

  let completed = 0

  if (
    isAdminFieldFilled(
      item.answer
    )
  ) {
    completed++
  }

  if (
    Number.isFinite(
      Number(item.points)
    ) &&
    Number(item.points) >= 0
  ) {
    completed++
  }

  return getAdminItemStatus(
    completed,
    2
  )
}
/* =========================
   4) Round Card Toggle
========================= */

function handleFamilyDidiRoundToggle(card) {
  if (!card) return

  if (
    typeof handleAdminEditCardToggle ===
    "function"
  ) {
    handleAdminEditCardToggle(card)
  }

  const grid =
    card.closest(
      ".familyDidiCleanRoundsGrid"
    )

  if (!grid) return

  const cards =
    grid.querySelectorAll(
      ".familyDidiCleanRoundCard"
    )

  if (card.open) {
    cards.forEach((item) => {
      if (item === card) return

      item.open = false

      item.classList.add(
        "familyDidiRoundHidden"
      )
    })

    return
  }

  cards.forEach((item) => {
    item.classList.remove(
      "familyDidiRoundHidden"
    )
  })
}

/* =========================
   5) Load فاملي ديدي
========================= */

async function renderFamilyDidiAdmin() {
  if (!currentModel) {
    showGameToast(
      "افتح النموذج أولاً",
      "warning"
    )

    return false
  }

  familyDidiAdminRoundsCount =
    await getSegmentRoundCount(
      "familyDidi",
      3,
      FAMILY_DIDI_MAX_ROUNDS
    )

  familyDidiAdminRoundsCount =
    Math.min(
      Math.max(
        Number(
          familyDidiAdminRoundsCount || 3
        ),
        FAMILY_DIDI_MIN_ROUNDS
      ),
      FAMILY_DIDI_MAX_ROUNDS
    )

  const result = await dbSelect(
    "family_didi_questions",

    query =>
      query
        .eq(
          "model",
          Number(currentModel)
        )
        .order(
          "round",
          {
            ascending: true
          }
        )
        .order(
          "position",
          {
            ascending: true
          }
        ),

    {
      select: `
        id,
model,
round,
position,
question,
answer,
points,
answers_count,
timer_seconds,
total_points
      `,
      fallback: [],
      logLabel:
        "LOAD FAMILY DIDI"
    }
  )

  if (!result.ok) {
    console.log(
      "LOAD FAMILY DIDI ERROR:",
      result.error
    )

    showGameToast(
      "تعذر تحميل فاملي ديدي",
      "error"
    )

    return false
  }

  resetFamilyDidiAdminDraft()

  ;(result.data || []).forEach(row => {
    const roundNumber =
      Number(row.round || 1)

    const position =
      Number(row.position || 1)

    if (
      roundNumber <
        FAMILY_DIDI_MIN_ROUNDS ||
      roundNumber >
        FAMILY_DIDI_MAX_ROUNDS ||
      position < 1 ||
      position >
        FAMILY_DIDI_MAX_ANSWERS
    ) {
      return
    }

    const round =
      getFamilyDidiDraftRound(
        roundNumber
      )

    if (
      isAdminFieldFilled(
        row.question
      )
    ) {
      round.question =
        String(
          row.question || ""
        ).trim()
    }

    round.answersCount =
      normalizeFamilyDidiAnswersCount(
        row.answers_count ||
        round.answersCount
      )

    round.totalPoints =
  normalizeFamilyDidiTotalPoints(
    row.total_points ??
    round.totalPoints
  )

round.timerSeconds =
  FAMILY_DIDI_DEFAULT_TIMER

    round.answers[position] = {
      answer:
        String(
          row.answer || ""
        ).trim(),

      points:
        Math.max(
          0,
          Number(
            row.points || 0
          )
        )
    }
  })

  renderFamilyDidiAdminFromDraft()

bindFamilyDidiEnglishNumbers()

return true
}
/* =========================
   6) Render Editor
========================= */

function renderFamilyDidiAdminFromDraft() {
  const area = editor()

  if (!area) return

  const totalRounds =
    Math.min(
      Math.max(
        Number(
          familyDidiAdminRoundsCount || 3
        ),
        FAMILY_DIDI_MIN_ROUNDS
      ),
      FAMILY_DIDI_MAX_ROUNDS
    )

  area.innerHTML = `
    <div
      class="
        familyDidiAdminShell
        familyDidiCleanShell
        adminOnePageEditor
      "
    >

      <div
        class="
          adminEditorTopBar
          familyDidiCleanTopBar
          adminEditorTopBarWithActions
        "
      >

        <div>
          <h2 class="adminSectionTitle">
            فاملي ديدي
          </h2>
        </div>

        <div class="adminInlineActions">

          <button
            type="button"
            class="adminSaveBtn"
            onclick="saveFamilyDidi()"
          >
            حفظ
          </button>

          <button
            type="button"
            class="adminDeleteAllBtn"
            onclick="deleteFamilyDidiSegment()"
          >
            حذف الفقرة
          </button>

        </div>

      </div>

      <div class="familyDidiCleanRoundsGrid">

        ${Array.from(
          {
            length: totalRounds
          },

          (_, index) =>
            buildFamilyDidiRoundOnePageCard(
              index + 1
            )
        ).join("")}

      </div>

    </div>
  `

  normalizeAdminEditorCards()
}

/* =========================
   7) Round Card
========================= */

function buildFamilyDidiRoundOnePageCard(
  roundNumber
) {
  const roundIndex =
    Math.min(
      Math.max(
        Number(roundNumber || 1),
        FAMILY_DIDI_MIN_ROUNDS
      ),
      FAMILY_DIDI_MAX_ROUNDS
    )

  const round =
    getFamilyDidiDraftRound(
      roundIndex
    )

  const answersCount =
    normalizeFamilyDidiAnswersCount(
      round.answersCount
    )

  const status =
    getFamilyDidiRoundStatus(
      roundIndex
    )

  const roundStateClass =
    status.isDone
      ? "familyDidiComplete"
      : "familyDidiIncomplete"

  const rightAnswers =
    Array.from(
      {
        length: Math.min(
          answersCount,
          4
        )
      },

      (_, index) =>
        index + 1
    )

  const leftAnswers =
    answersCount > 4
      ? Array.from(
          {
            length:
              answersCount - 4
          },

          (_, index) =>
            index + 5
        )
      : []

  return `
    <details
      class="
        adminEditItemCard
        familyDidiCleanRoundCard
        ${roundStateClass}
      "
      ontoggle="
        handleFamilyDidiRoundToggle(this)
      "
    >

      <summary>

        <div class="familyDidiCleanSummaryTitle">
          <strong>
            الجولة ${roundIndex}
          </strong>
        </div>

        <div class="adminEditItemMeta">

          <span class="adminEditStatusPill">
            ${status.label}
          </span>

          <span class="adminEditProgressPill">
            ${status.progress}
          </span>

        </div>

      </summary>

      <div
        class="
          adminEditItemBody
          familyDidiCleanBody
        "
      >

<div class="familyDidiRoundHeader">

  <div class="familyDidiCleanQuestionRow">

    <input
      id="familyDidiQuestion${roundIndex}"
      type="text"
      class="
        familyDidiCleanQuestionInput
        ${getAdminMissingFieldClass(
          round.question
        )}
      "
      placeholder="سؤال الجولة ${roundIndex}"
      value="${escapeHtml(
        round.question || ""
      )}"
    >

  </div>

  <div class="familyDidiRoundSettings">

  <label class="familyDidiSettingField">

    <span>عدد الإجابات</span>

    <select
      id="familyDidiAnswersCount${roundIndex}"
      onchange="
        handleFamilyDidiAnswersCountChange(
          ${roundIndex},
          this.value
        )
      "
    >
      ${Array.from(
        {
          length:
            FAMILY_DIDI_MAX_ANSWERS
        },

        (_, index) => {
          const value = index + 1

          return `
            <option
              value="${value}"
              ${
                value === answersCount
                  ? "selected"
                  : ""
              }
            >
              ${value}
            </option>
          `
        }
      ).join("")}
    </select>

  </label>

  <label class="familyDidiSettingField">

    <span>مجموع النقاط</span>

    <input
      id="familyDidiTotalPoints${roundIndex}"
      type="number"
      min="1"
      max="9999"
      inputmode="numeric"
      value="${round.totalPoints}"
      onchange="
        handleFamilyDidiTotalPointsChange(
          ${roundIndex},
          this.value
        )
      "
    >

  </label>

  <button
    type="button"
    class="adminWorkspaceActionBtn"
    onclick="
      redistributeFamilyDidiRoundPoints(
        ${roundIndex}
      )
    "
  >
    إعادة توزيع
  </button>

  <button
    type="button"
    class="
      adminDeleteBtn
      familyDidiCleanDeleteRoundBtn
    "
    onclick="
      clearFamilyDidiRound(
        ${roundIndex}
      )
    "
  >
    حذف الجولة
  </button>

  </div>

</div>

<div class="familyDidiCleanAnswersSplit">

          <div
            class="
              familyDidiCleanAnswersColumn
              familyDidiCleanRightColumn
            "
          >

            ${rightAnswers
              .map(answerNumber =>
                buildFamilyDidiAnswerOnePageCard(
                  roundIndex,
                  answerNumber
                )
              )
              .join("")}

          </div>

          <div
            class="
              familyDidiCleanAnswersColumn
              familyDidiCleanLeftColumn
              ${leftAnswers.length
                ? ""
                : "familyDidiEmptyColumn"
              }
            "
          >

            ${leftAnswers.length
              ? leftAnswers
                  .map(answerNumber =>
                    buildFamilyDidiAnswerOnePageCard(
                      roundIndex,
                      answerNumber
                    )
                  )
                  .join("")
              : ""
            }

          </div>

        </div>

      </div>

    </details>
  `
}

function createFamilyDidiDescendingPoints(
  totalPoints,
  answersCount
) {
  const total =
    Math.floor(
      Number(totalPoints || 0)
    )

  const count =
    normalizeFamilyDidiAnswersCount(
      answersCount
    )

  if (
    !Number.isFinite(total) ||
    total < count
  ) {
    return null
  }

  if (count === 1) {
    return [total]
  }

  const cuts =
    new Set()

  while (cuts.size < count - 1) {
    cuts.add(
      Math.floor(
        Math.random() *
          (total - 1)
      ) + 1
    )
  }

  const orderedCuts =
    Array.from(cuts)
      .sort((a, b) => a - b)

  const parts = []
  let previous = 0

  orderedCuts.forEach(cut => {
    parts.push(
      cut - previous
    )

    previous = cut
  })

  parts.push(
    total - previous
  )

  return parts.sort(
    (a, b) => b - a
  )
}

function openFamilyDidiRoundCard(
  roundNumber
) {
  const cards =
    document.querySelectorAll(
      ".familyDidiCleanRoundCard"
    )

  const targetCard =
    cards[
      Number(roundNumber || 1) - 1
    ]

  if (targetCard) {
    targetCard.open = true
  }
}

function applyFamilyDidiRoundPoints(
  roundNumber,
  points = []
) {
  const round =
    getFamilyDidiDraftRound(
      roundNumber
    )

  const answersCount =
    normalizeFamilyDidiAnswersCount(
      round.answersCount
    )

  for (
    let position = 1;
    position <= answersCount;
    position++
  ) {
    const current =
      round.answers[position] ||
      createFamilyDidiDraftAnswer()

    round.answers[position] = {
      answer:
        String(
          current.answer || ""
        ).trim(),

      points:
        Math.max(
          0,
          Number(
            points[position - 1] || 0
          )
        )
    }
  }
}

function handleFamilyDidiTotalPointsChange(
  roundNumber,
  value
) {
  collectFamilyDidiCurrentDraft()

  const round =
    getFamilyDidiDraftRound(
      roundNumber
    )

  const totalPoints =
    normalizeFamilyDidiTotalPoints(
      value
    )

  round.totalPoints =
    totalPoints

  if (!totalPoints) {
    showGameToast(
      "اكتب مجموع نقاط الجولة",
      "warning"
    )

    renderFamilyDidiAdminFromDraft()
    openFamilyDidiRoundCard(
      roundNumber
    )

    return false
  }

  const answersCount =
    normalizeFamilyDidiAnswersCount(
      round.answersCount
    )

  if (totalPoints < answersCount) {
    showGameToast(
      `مجموع النقاط يجب ألا يقل عن ${answersCount}`,
      "warning"
    )

    renderFamilyDidiAdminFromDraft()
    openFamilyDidiRoundCard(
      roundNumber
    )

    return false
  }

  const points =
    createFamilyDidiDescendingPoints(
      totalPoints,
      answersCount
    )

  if (!points) {
    showGameToast(
      "تعذر توزيع النقاط",
      "error"
    )

    return false
  }

  applyFamilyDidiRoundPoints(
    roundNumber,
    points
  )

  renderFamilyDidiAdminFromDraft()
  openFamilyDidiRoundCard(
    roundNumber
  )

  return true
}

function redistributeFamilyDidiRoundPoints(
  roundNumber
) {
  collectFamilyDidiCurrentDraft()

  const round =
    getFamilyDidiDraftRound(
      roundNumber
    )

  const totalPoints =
    normalizeFamilyDidiTotalPoints(
      round.totalPoints
    )

  if (!totalPoints) {
    showGameToast(
      "حدد مجموع نقاط الجولة أولًا",
      "warning"
    )

    return false
  }

  const answersCount =
    normalizeFamilyDidiAnswersCount(
      round.answersCount
    )

  if (totalPoints < answersCount) {
    showGameToast(
      `مجموع النقاط يجب ألا يقل عن ${answersCount}`,
      "warning"
    )

    return false
  }

  const points =
    createFamilyDidiDescendingPoints(
      totalPoints,
      answersCount
    )

  if (!points) {
    showGameToast(
      "تعذر إعادة توزيع النقاط",
      "error"
    )

    return false
  }

  applyFamilyDidiRoundPoints(
    roundNumber,
    points
  )

  renderFamilyDidiAdminFromDraft()
  openFamilyDidiRoundCard(
    roundNumber
  )

  showGameToast(
    "تم تغيير توزيع النقاط",
    "success"
  )

  return true
}

function handleFamilyDidiPointChange(
  roundNumber,
  positionNumber,
  value
) {
  collectFamilyDidiCurrentDraft()

  const round =
    getFamilyDidiDraftRound(
      roundNumber
    )

  const answersCount =
    normalizeFamilyDidiAnswersCount(
      round.answersCount
    )

  const totalPoints =
    normalizeFamilyDidiTotalPoints(
      round.totalPoints
    )

  if (!totalPoints) {
    showGameToast(
      "حدد مجموع نقاط الجولة أولًا",
      "warning"
    )

    return false
  }

  const position =
    Math.min(
      Math.max(
        Number(positionNumber || 1),
        1
      ),
      answersCount
    )

  const enteredPoints =
    Math.floor(
      Number(value || 0)
    )

  if (
    !Number.isFinite(enteredPoints) ||
    enteredPoints < 0
  ) {
    showGameToast(
      "قيمة النقاط غير صحيحة",
      "warning"
    )

    return false
  }

  if (enteredPoints > totalPoints) {
    showGameToast(
      "النقاط أكبر من مجموع الجولة",
      "warning"
    )

    return false
  }

  const remainingTotal =
    totalPoints - enteredPoints

  const remainingCount =
    answersCount - 1

  let generated = []

  if (remainingCount > 0) {
    generated =
      createFamilyDidiDescendingPoints(
        remainingTotal,
        remainingCount
      )

    if (!generated) {
      showGameToast(
        "تعذر توزيع بقية النقاط",
        "warning"
      )

      return false
    }
  }

  const result = []
  let generatedIndex = 0

  for (
    let i = 1;
    i <= answersCount;
    i++
  ) {
    if (i === position) {
      result.push(
        enteredPoints
      )
    } else {
      result.push(
        generated[
          generatedIndex
        ] || 0
      )

      generatedIndex++
    }
  }

  result.sort(
    (a, b) => b - a
  )

  applyFamilyDidiRoundPoints(
    roundNumber,
    result
  )

  renderFamilyDidiAdminFromDraft()

  openFamilyDidiRoundCard(
    roundNumber
  )

  return true
}

function handleFamilyDidiAnswersCountChange(
  roundNumber,
  value
) {
  collectFamilyDidiCurrentDraft()

  const round =
    getFamilyDidiDraftRound(
      roundNumber
    )

  round.answersCount =
    normalizeFamilyDidiAnswersCount(
      value
    )

  if (round.totalPoints) {
    handleFamilyDidiTotalPointsChange(
      roundNumber,
      round.totalPoints
    )
    return true
  }

  renderFamilyDidiAdminFromDraft()

  openFamilyDidiRoundCard(
    roundNumber
  )

  return true
}

/* =========================
   8) Answer Card
========================= */

function buildFamilyDidiAnswerOnePageCard(
  roundNumber,
  answerNumber
) {
  const roundIndex =
    Math.min(
      Math.max(
        Number(roundNumber || 1),
        FAMILY_DIDI_MIN_ROUNDS
      ),
      FAMILY_DIDI_MAX_ROUNDS
    )

  const position =
    Math.min(
      Math.max(
        Number(answerNumber || 1),
        1
      ),
      FAMILY_DIDI_MAX_ANSWERS
    )

  const round =
    getFamilyDidiDraftRound(
      roundIndex
    )

  const item =
    round.answers[position] ||
    createFamilyDidiDraftAnswer()

  const status =
    getFamilyDidiAnswerStatus(
      roundIndex,
      position
    )

  return `
    <div
      class="
        familyDidiCleanAnswerCard
        ${status.isDone
          ? "familyDidiComplete"
          : "familyDidiIncomplete"
        }
      "
    >

      <div class="familyDidiCleanAnswerNumber">
        ${position}
      </div>

      <input
        id="familyDidiAnswer${roundIndex}_${position}"
        type="text"
        class="
          familyDidiCleanAnswerInput
          ${getAdminMissingFieldClass(
            item.answer
          )}
        "
        placeholder="الإجابة ${position}"
        value="${escapeHtml(
          item.answer || ""
        )}"
      >

      <label class="familyDidiCleanPointsField">
        <span>النقاط</span>

       <input
  id="familyDidiPoints${roundIndex}_${position}"
  type="number"
  min="0"
  max="${round.totalPoints || 9999}"
  inputmode="numeric"
  class="familyDidiCleanPointsInput"
  value="${Math.max(
    0,
    Number(item.points || 0)
  )}"
  onchange="
    handleFamilyDidiPointChange(
      ${roundIndex},
      ${position},
      this.value
    )
  "
>
      </label>

      <button
        type="button"
        class="familyDidiCleanAnswerDelete"
        onclick="
          deleteFamilyDidiItem(
            ${roundIndex},
            ${position}
          )
        "
        aria-label="حذف الإجابة ${position}"
      >
        ×
      </button>

    </div>
  `
}

/* =========================
   9) Save فاملي ديدي
========================= */

async function saveFamilyDidi() {
  if (isAdminSaving()) {
    return false
  }

  if (!currentModel) {
    showGameToast(
      "افتح النموذج أولاً",
      "warning"
    )

    return false
  }

  try {
    collectFamilyDidiCurrentDraft()

    setAdminSaving(
      true,
      "جارٍ حفظ فاملي ديدي..."
    )

    familyDidiAdminRoundsCount =
      Math.min(
        Math.max(
          Number(
            familyDidiAdminRoundsCount || 3
          ),
          FAMILY_DIDI_MIN_ROUNDS
        ),
        FAMILY_DIDI_MAX_ROUNDS
      )

    const rows = []
    const missing = []

    for (
      let roundNumber = FAMILY_DIDI_MIN_ROUNDS;
      roundNumber <= familyDidiAdminRoundsCount;
      roundNumber++
    ) {
      const round =
        getFamilyDidiDraftRound(
          roundNumber
        )

      const question =
        String(
          round.question || ""
        ).trim()

      const answersCount =
        normalizeFamilyDidiAnswersCount(
          round.answersCount
        )

      const timerSeconds =
  FAMILY_DIDI_DEFAULT_TIMER

const totalPoints =
  normalizeFamilyDidiTotalPoints(
    round.totalPoints
  )

  const roundPoints = []

for (
  let position = 1;
  position <= answersCount;
  position++
) {
  const item =
    round.answers[position] ||
    createFamilyDidiDraftAnswer()

  roundPoints.push(
    Math.max(
      0,
      Math.floor(
        Number(
          item.points || 0
        )
      )
    )
  )
}

const currentPointsTotal =
  roundPoints.reduce(
    (sum, value) =>
      sum + Number(value || 0),
    0
  )

const isDescending =
  roundPoints.every(
    (value, index) => {
      if (index === 0) {
        return true
      }

      return (
        Number(
          roundPoints[index - 1]
        ) >=
        Number(value)
      )
    }
  )

      const hasAnyRoundData =
        Boolean(question) ||
        Array.from(
          {
            length:
              FAMILY_DIDI_MAX_ANSWERS
          },

          (_, index) =>
            round.answers[index + 1]
        ).some(item => {
          return Boolean(
            String(
              item?.answer || ""
            ).trim()
          )
        })

      if (!hasAnyRoundData) {
        continue
      }

      if (!question) {
        missing.push(
          `الجولة ${roundNumber}: السؤال`
        )
      }

      if (!totalPoints) {
  missing.push(
    `الجولة ${roundNumber}: مجموع النقاط`
  )
}
if (
  totalPoints &&
  currentPointsTotal !== totalPoints
) {
  missing.push(
    `الجولة ${roundNumber}: مجموع النقاط الحالي ${currentPointsTotal} لا يساوي ${totalPoints}`
  )
}

if (!isDescending) {
  missing.push(
    `الجولة ${roundNumber}: النقاط يجب أن تكون تنازلية`
  )
}

      for (
        let position = 1;
        position <= answersCount;
        position++
      ) {
        const item =
          round.answers[position] ||
          createFamilyDidiDraftAnswer()

        const answer =
          String(
            item.answer || ""
          ).trim()

        const points =
  Math.max(
    0,
    Math.floor(
      Number(
        item.points || 0
      )
    )
  )

        if (!answer) {
          missing.push(
            `الجولة ${roundNumber}: الإجابة ${position}`
          )

          continue
        }

        rows.push({
          model:
            Number(currentModel),

          round:
            Number(roundNumber),

          position:
            Number(position),

          question,
          answer,
          points,

          answers_count:
            Number(answersCount),

          timer_seconds:
  FAMILY_DIDI_DEFAULT_TIMER,

total_points:
  Number(totalPoints)
        })
      }
    }

    if (missing.length) {
      showGameToast(
        `أكمل البيانات الناقصة: ${missing
          .slice(0, 4)
          .join("، ")}${
            missing.length > 4
              ? "..."
              : ""
          }`,
        "warning"
      )

      return false
    }

    if (!rows.length) {
      const confirmed =
        await showAdminConfirm(
          "فاملي ديدي فارغ، هل تريد حذف جميع بياناته؟",
          {
            title:
              "حذف بيانات فاملي ديدي",

            okText:
              "حذف الكل",

            cancelText:
              "إلغاء",

            danger:
              true
          }
        )

      if (!confirmed) {
        showGameToast(
          "تم إلغاء الحفظ",
          "info"
        )

        return false
      }

      const clearResult =
        await dbDelete(
          "family_didi_questions",

          query =>
            query.eq(
              "model",
              Number(currentModel)
            ),

          {
            logLabel:
              "CLEAR FAMILY DIDI"
          }
        )

      if (!clearResult.ok) {
        console.log(
          "CLEAR FAMILY DIDI ERROR:",
          clearResult.error
        )

        showGameToast(
          "تعذر حذف بيانات فاملي ديدي",
          "error"
        )

        return false
      }

      resetFamilyDidiAdminDraft()
      invalidateAdminHomeCache()
      renderFamilyDidiAdminFromDraft()

      showGameToast(
        "تم حذف جميع بيانات فاملي ديدي",
        "success"
      )

      return true
    }

    const oldRowsResult =
      await dbSelect(
        "family_didi_questions",

        query =>
          query.eq(
            "model",
            Number(currentModel)
          ),

        {
          select:
            "round,position",

          fallback:
            [],

          logLabel:
            "READ OLD FAMILY DIDI"
        }
      )

    if (!oldRowsResult.ok) {
      console.log(
        "READ OLD FAMILY DIDI ERROR:",
        oldRowsResult.error
      )

      showGameToast(
        "تعذر قراءة بيانات فاملي ديدي الحالية",
        "error"
      )

      return false
    }

    const saveResult =
      await dbUpsert(
        "family_didi_questions",
        rows,
        {
          onConflict:
            "model,round,position",

          logLabel:
            "SAVE FAMILY DIDI"
        }
      )

    if (!saveResult.ok) {
      console.log(
        "SAVE FAMILY DIDI ERROR:",
        saveResult.error
      )

      showGameToast(
        "فشل حفظ فاملي ديدي",
        "error"
      )

      return false
    }

    const keepKeys =
      new Set(
        rows.map(row => {
          return `${Number(
            row.round
          )}_${Number(
            row.position
          )}`
        })
      )

    const oldRowsToDelete =
      (
        oldRowsResult.data || []
      ).filter(oldRow => {
        const key =
          `${Number(
            oldRow.round
          )}_${Number(
            oldRow.position
          )}`

        return !keepKeys.has(key)
      })

    if (oldRowsToDelete.length) {
      const deleteResults =
        await Promise.all(
          oldRowsToDelete.map(
            oldRow =>
              dbDelete(
                "family_didi_questions",

                query =>
                  query
                    .eq(
                      "model",
                      Number(currentModel)
                    )
                    .eq(
                      "round",
                      Number(
                        oldRow.round
                      )
                    )
                    .eq(
                      "position",
                      Number(
                        oldRow.position
                      )
                    ),

                {
                  logLabel:
                    "DELETE OLD FAMILY DIDI"
                }
              )
          )
        )

      const failedDelete =
        deleteResults.find(
          result =>
            !result?.ok
        )

      if (failedDelete) {
        console.log(
          "DELETE OLD FAMILY DIDI ERROR:",
          failedDelete.error
        )

        invalidateAdminHomeCache()

        showGameToast(
          "تم الحفظ لكن تعذر تنظيف بعض البيانات القديمة",
          "warning"
        )

        await renderFamilyDidiAdmin()

        return false
      }
    }

    invalidateAdminHomeCache()

    showGameToast(
      "تم حفظ فاملي ديدي",
      "success"
    )

    await renderFamilyDidiAdmin()

    return true
  } catch (error) {
    console.log(
      "SAVE FAMILY DIDI CATCH:",
      error
    )

    showGameToast(
      "توقف حفظ فاملي ديدي بسبب خطأ",
      "error"
    )

    return false
  } finally {
    setAdminSaving(false)
  }
}

/* =========================
   10) Delete One Round
========================= */

async function clearFamilyDidiRound(
  roundNumber
) {
  if (!canRunAdminDelete()) {
    return false
  }

  if (!currentModel) {
    showGameToast(
      "افتح النموذج أولاً",
      "warning"
    )

    return false
  }

  const roundIndex =
    Number(roundNumber || 0)

  if (
    roundIndex < 1 ||
    roundIndex > FAMILY_DIDI_MAX_ROUNDS
  ) {
    showGameToast(
      "رقم الجولة غير صحيح",
      "error"
    )

    return false
  }

  collectFamilyDidiCurrentDraft()

  const confirmed =
    await showAdminConfirm(
      `هل تريد حذف الجولة ${roundIndex} من فاملي ديدي نهائيًا؟`,
      {
        title:
          `حذف الجولة ${roundIndex}`,

        okText:
          "حذف الجولة",

        cancelText:
          "إلغاء",

        danger:
          true
      }
    )

  if (!confirmed) {
    return false
  }

  try {
    const deleteResult =
      await dbDelete(
        "family_didi_questions",

        (query) =>
          query
            .eq(
              "model",
              Number(currentModel)
            )
            .eq(
              "round",
              roundIndex
            ),

        {
          logLabel:
            "CLEAR FAMILY DIDI ROUND"
        }
      )

    if (!deleteResult.ok) {
      console.log(
        "CLEAR FAMILY DIDI ROUND ERROR:",
        deleteResult.error
      )

      showGameToast(
        "تعذر حذف الجولة",
        "error"
      )

      return false
    }

    resetFamilyDidiDraftRound(
      roundIndex
    )

    invalidateAdminHomeCache()
    renderFamilyDidiAdminFromDraft()

    showGameToast(
      `تم حذف الجولة ${roundIndex}`,
      "success"
    )

    return true
  } catch (error) {
    console.log(
      "CLEAR FAMILY DIDI ROUND CATCH:",
      error
    )

    showGameToast(
      "حدث خطأ أثناء حذف الجولة",
      "error"
    )

    return false
  }
}

/* =========================
   11) Delete One Answer
========================= */

async function deleteFamilyDidiItem(
  roundNumber,
  positionNumber
) {
  if (!canRunAdminDelete()) {
    return false
  }

  if (!currentModel) {
    showGameToast(
      "افتح النموذج أولاً",
      "warning"
    )

    return false
  }

  const roundIndex =
    Number(roundNumber || 0)

  const position =
    Number(positionNumber || 0)

  if (
    roundIndex < 1 ||
    roundIndex > FAMILY_DIDI_MAX_ROUNDS ||
    position < 1 ||
    position > FAMILY_DIDI_MAX_ANSWERS
  ) {
    showGameToast(
      "بيانات الإجابة غير صحيحة",
      "error"
    )

    return false
  }

  collectFamilyDidiCurrentDraft()

  const confirmed =
    await showAdminConfirm(
      `هل تريد حذف إجابة رقم ${position} من الجولة ${roundIndex}؟`,
      {
        title:
          "حذف الإجابة",

        okText:
          "حذف",

        cancelText:
          "إلغاء",

        danger:
          true
      }
    )

  if (!confirmed) {
    return false
  }

  try {
    const deleteResult =
      await dbDelete(
        "family_didi_questions",

        (query) =>
          query
            .eq(
              "model",
              Number(currentModel)
            )
            .eq(
              "round",
              roundIndex
            )
            .eq(
              "position",
              position
            ),

        {
          logLabel:
            "DELETE FAMILY DIDI ITEM"
        }
      )

    if (!deleteResult.ok) {
      console.log(
        "DELETE FAMILY DIDI ITEM ERROR:",
        deleteResult.error
      )

      showGameToast(
        "تعذر حذف الإجابة",
        "error"
      )

      return false
    }

    const round =
      getFamilyDidiDraftRound(
        roundIndex
      )

    round.answers[position] =
  createFamilyDidiDraftAnswer()

  const currentAnswersCount =
  normalizeFamilyDidiAnswersCount(
    round.answersCount
  )

const newAnswers = {}

let newPosition = 1

for (
  let oldPosition = 1;
  oldPosition <= currentAnswersCount;
  oldPosition++
) {
  if (oldPosition === position) {
    continue
  }

  const current =
    round.answers[oldPosition] ||
    createFamilyDidiDraftAnswer()

  newAnswers[newPosition] = {
    answer:
      String(
        current.answer || ""
      ).trim(),

    points:
      Math.max(
        0,
        Number(
          current.points || 0
        )
      )
  }

  newPosition++
}

round.answers =
  newAnswers

round.answersCount =
  Math.max(
    1,
    currentAnswersCount - 1
  )

  if (
  round.totalPoints
) {
  handleFamilyDidiTotalPointsChange(
    roundIndex,
    round.totalPoints
  )
}


    invalidateAdminHomeCache()
    renderFamilyDidiAdminFromDraft()

    showGameToast(
      `تم حذف إجابة رقم ${position}`,
      "success"
    )

    return true
  } catch (error) {
    console.log(
      "DELETE FAMILY DIDI ITEM CATCH:",
      error
    )

    showGameToast(
      "حدث خطأ أثناء حذف الإجابة",
      "error"
    )

    return false
  }
}

/* =========================
   12) Delete Full Segment
========================= */

async function deleteFamilyDidiSegment() {
  if (!canRunAdminDelete()) {
    return false
  }

  if (!currentModel) {
    showGameToast(
      "افتح النموذج أولاً",
      "warning"
    )

    return false
  }

  const confirmed =
    await showAdminConfirm(
      "هل تريد حذف فقرة فاملي ديدي كاملة نهائيًا؟",
      {
        title:
          "حذف فقرة فاملي ديدي",

        okText:
          "حذف الفقرة",

        cancelText:
          "إلغاء",

        danger:
          true
      }
    )

  if (!confirmed) {
    return false
  }

  try {
    const [
      questionsResult,
      settingsResult
    ] = await Promise.all([
      dbDelete(
        "family_didi_questions",

        (query) =>
          query.eq(
            "model",
            Number(currentModel)
          ),

        {
          logLabel:
            "DELETE FAMILY DIDI QUESTIONS"
        }
      ),

      dbDelete(
        "segment_settings",

        (query) =>
          query
            .eq(
              "model",
              Number(currentModel)
            )
            .eq(
              "segment",
              "familyDidi"
            ),

        {
          logLabel:
            "DELETE FAMILY DIDI SETTINGS"
        }
      )
    ])

    const failedResult =
      [
        questionsResult,
        settingsResult
      ].find(
        (result) =>
          !result?.ok
      )

    if (failedResult) {
      console.log(
        "DELETE FAMILY DIDI SEGMENT ERROR:",
        failedResult.error
      )

      showGameToast(
        "تعذر حذف فقرة فاملي ديدي",
        "error"
      )

      return false
    }

    familyDidiAdminRoundsCount = 3

    resetFamilyDidiAdminDraft()
    invalidateAdminHomeCache()

    renderFamilyDidiAdminFromDraft()

    showGameToast(
      "تم حذف فقرة فاملي ديدي",
      "success"
    )

    return true
  } catch (error) {
    console.log(
      "DELETE FAMILY DIDI SEGMENT CATCH:",
      error
    )

    showGameToast(
      "حدث خطأ أثناء حذف فقرة فاملي ديدي",
      "error"
    )

    return false
  }
}

function familyDidiToEnglishNumbers(value) {
  return String(value || "")
    .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
}

function bindFamilyDidiEnglishNumbers() {
  if (window.familyDidiEnglishNumbersBound) {
    return
  }

  window.familyDidiEnglishNumbersBound = true

  document.addEventListener("input", event => {
    const input = event.target

    if (
      input.closest(".familyDidiAdminShell")
    ) {
      input.value =
        familyDidiToEnglishNumbers(
          input.value
        )
    }
  })
}

/* =========================
   13) Global Exports
========================= */

window.renderFamilyDidiAdmin =
  renderFamilyDidiAdmin

window.saveFamilyDidi =
  saveFamilyDidi

window.handleFamilyDidiRoundToggle =
  handleFamilyDidiRoundToggle

  window.handleFamilyDidiAnswersCountChange =
  handleFamilyDidiAnswersCountChange

window.clearFamilyDidiRound =
  clearFamilyDidiRound

window.deleteFamilyDidiItem =
  deleteFamilyDidiItem

window.deleteFamilyDidiSegment =
  deleteFamilyDidiSegment
  window.handleFamilyDidiTotalPointsChange =
  handleFamilyDidiTotalPointsChange

window.redistributeFamilyDidiRoundPoints =
  redistributeFamilyDidiRoundPoints

window.handleFamilyDidiPointChange =
  handleFamilyDidiPointChange
  window.openFamilyDidiRoundCard =
  openFamilyDidiRoundCard

window.applyFamilyDidiRoundPoints =
  applyFamilyDidiRoundPoints

  window.handleFamilyDidiPointChange =
  handleFamilyDidiPointChange

window.handleFamilyDidiTotalPointsChange =
  handleFamilyDidiTotalPointsChange

window.redistributeFamilyDidiRoundPoints =
  redistributeFamilyDidiRoundPoints

window.openFamilyDidiRoundCard =
  openFamilyDidiRoundCard

window.applyFamilyDidiRoundPoints =
  applyFamilyDidiRoundPoints