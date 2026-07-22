/* =========================================================
   TOP 10 ADMIN
========================================================= */

/* =========================
   1) Local State
========================= */

let top10AdminRoundsCount = 3
let top10AdminDraft = {}

/* =========================
   2) Draft Helpers
========================= */

function getTop10DraftRound(roundNumber) {
  const round = Number(roundNumber || 1)

  if (!top10AdminDraft[round]) {
    top10AdminDraft[round] = {
      question: "",
      answers: {}
    }

    for (let position = 1; position <= 10; position++) {
      top10AdminDraft[round].answers[position] = ""
    }
  }

  return top10AdminDraft[round]
}

function resetTop10AdminDraft() {
  top10AdminDraft = {}

  for (let round = 1; round <= 4; round++) {
    getTop10DraftRound(round)
  }
}

function resetTop10DraftRound(roundNumber) {
  const round = Number(roundNumber || 1)

  top10AdminDraft[round] = {
    question: "",
    answers: {}
  }

  for (let position = 1; position <= 10; position++) {
    top10AdminDraft[round].answers[position] = ""
  }

  return top10AdminDraft[round]
}

function collectTop10CurrentDraft() {
  const totalRounds = Math.min(
    Math.max(
      Number(top10AdminRoundsCount || 3),
      1
    ),
    4
  )

  for (let roundNumber = 1; roundNumber <= totalRounds; roundNumber++) {
    const round = getTop10DraftRound(roundNumber)

    round.question = (
      document.getElementById(`topq${roundNumber}`)?.value || ""
    ).trim()

    for (let position = 1; position <= 10; position++) {
      round.answers[position] = (
        document.getElementById(`top${roundNumber}_${position}`)?.value || ""
      ).trim()
    }
  }
}

/* =========================
   3) Completion Status
========================= */

function getTop10RoundStatus(roundNumber) {
  const round = getTop10DraftRound(roundNumber)

  const fields = [
    round.question,

    ...Array.from(
      {
        length: 10
      },

      (_, index) =>
        round.answers[index + 1]
    )
  ]

  const completed = fields.filter(
    isAdminFieldFilled
  ).length

  return getAdminItemStatus(
    completed,
    fields.length
  )
}

function getTop10AnswerStatus(
  roundNumber,
  answerNumber
) {
  const round =
    getTop10DraftRound(roundNumber)

  const answer =
    round.answers[answerNumber] || ""

  const completed =
    isAdminFieldFilled(answer)
      ? 1
      : 0

  return getAdminItemStatus(
    completed,
    1
  )
}

/* =========================
   4) Round Card Toggle
========================= */

function handleTop10RoundToggle(card) {
  if (!card) return

  if (
    typeof handleAdminEditCardToggle ===
    "function"
  ) {
    handleAdminEditCardToggle(card)
  }

  const grid =
    card.closest(
      ".top10CleanRoundsGrid"
    )

  if (!grid) return

  const cards =
    grid.querySelectorAll(
      ".top10CleanRoundCard"
    )

  if (card.open) {
    cards.forEach((item) => {
      if (item === card) return

      item.open = false

      item.classList.add(
        "top10RoundHidden"
      )
    })

    return
  }

  cards.forEach((item) => {
    item.classList.remove(
      "top10RoundHidden"
    )
  })
}

/* =========================
   5) Load Top 10
========================= */

async function renderTop10Admin() {
  if (!currentModel) {
    showGameToast(
      "افتح النموذج أولاً",
      "warning"
    )

    return false
  }

  top10AdminRoundsCount =
    await getSegmentRoundCount(
      "top10",
      3,
      4
    )

  top10AdminRoundsCount =
    Math.min(
      Math.max(
        Number(
          top10AdminRoundsCount || 3
        ),
        1
      ),
      4
    )

  const result = await dbSelect(
    "top10_questions",

    (query) =>
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
      select: "*",
      fallback: [],
      logLabel: "LOAD TOP10"
    }
  )

  if (!result.ok) {
    console.log(
      "LOAD TOP10 ERROR:",
      result.error
    )

    showGameToast(
      "تعذر تحميل Top 10",
      "error"
    )

    return false
  }

  resetTop10AdminDraft()

  ;(result.data || []).forEach((row) => {
    const roundNumber =
      Number(row.round || 1)

    const position =
      Number(row.position || 1)

    if (
      roundNumber < 1 ||
      roundNumber > 4 ||
      position < 1 ||
      position > 10
    ) {
      return
    }

    const round =
      getTop10DraftRound(
        roundNumber
      )

    if (
      isAdminFieldFilled(
        row.question
      )
    ) {
      round.question =
        String(row.question)
    }

    round.answers[position] =
      row.answer || ""
  })

  renderTop10AdminFromDraft()

  return true
}

/* =========================
   6) Render Editor
========================= */

function renderTop10AdminFromDraft() {
  const area = editor()

  if (!area) return

  const totalRounds =
    Math.min(
      Math.max(
        Number(
          top10AdminRoundsCount || 3
        ),
        1
      ),
      4
    )

  area.innerHTML = `
    <div class="top10AdminShell top10CleanShell adminOnePageEditor">

      <div class="adminEditorTopBar top10CleanTopBar adminEditorTopBarWithActions">

        <div>
          <h2 class="adminSectionTitle">
            Top 10
          </h2>
        </div>

        <div class="adminInlineActions">

          <button
            type="button"
            class="adminSaveBtn"
            onclick="saveTop10()"
          >
            حفظ
          </button>

          <button
            type="button"
            class="adminDeleteAllBtn"
            onclick="deleteTop10Segment()"
          >
            حذف الفقرة
          </button>

        </div>

      </div>

      <div class="top10CleanRoundsGrid">

        ${Array.from(
          {
            length: totalRounds
          },

          (_, index) =>
            buildTop10RoundOnePageCard(
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

function buildTop10RoundOnePageCard(
  roundNumber
) {
  const roundIndex =
    Number(roundNumber || 1)

  const round =
    getTop10DraftRound(
      roundIndex
    )

  const status =
    getTop10RoundStatus(
      roundIndex
    )

  const roundStateClass =
    status.isDone
      ? "top10Complete"
      : "top10Incomplete"

  return `
    <details
      class="
        adminEditItemCard
        top10CleanRoundCard
        ${roundStateClass}
      "
      ontoggle="handleTop10RoundToggle(this)"
    >

      <summary>

        <div class="top10CleanSummaryTitle">
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

      <div class="adminEditItemBody top10CleanBody">

        <div class="top10CleanQuestionRow">

          <input
            id="topq${roundIndex}"
            type="text"
            class="
              top10CleanQuestionInput
              ${getAdminMissingFieldClass(
                round.question
              )}
            "
            placeholder="سؤال الجولة ${roundIndex}"
            value="${escapeHtml(
              round.question || ""
            )}"
          >

          <button
            type="button"
            class="adminDeleteBtn top10CleanDeleteRoundBtn"
            onclick="clearTop10Round(${roundIndex})"
          >
            حذف الجولة
          </button>

        </div>

        <div class="top10CleanAnswersSplit">

          <div class="top10CleanAnswersColumn">

            ${[1, 2, 3, 4, 5]
              .map((answerNumber) =>
                buildTop10AnswerOnePageCard(
                  roundIndex,
                  answerNumber
                )
              )
              .join("")}

          </div>

          <div class="top10CleanAnswersColumn">

            ${[6, 7, 8, 9, 10]
              .map((answerNumber) =>
                buildTop10AnswerOnePageCard(
                  roundIndex,
                  answerNumber
                )
              )
              .join("")}

          </div>

        </div>

      </div>

    </details>
  `
}

/* =========================
   8) Answer Card
========================= */

function buildTop10AnswerOnePageCard(
  roundNumber,
  answerNumber
) {
  const roundIndex =
    Number(roundNumber || 1)

  const position =
    Number(answerNumber || 1)

  const round =
    getTop10DraftRound(
      roundIndex
    )

  const answer =
    round.answers[position] || ""

  const status =
    getTop10AnswerStatus(
      roundIndex,
      position
    )

  return `
    <div
      class="
        top10CleanAnswerCard
        ${status.isDone
          ? "top10Complete"
          : "top10Incomplete"
        }
      "
    >

      <div class="top10CleanAnswerNumber">
        ${position}
      </div>

      <input
        id="top${roundIndex}_${position}"
        type="text"
        class="
          top10CleanAnswerInput
          ${getAdminMissingFieldClass(
            answer
          )}
        "
        placeholder="الإجابة"
        value="${escapeHtml(answer)}"
      >

      <button
        type="button"
        class="top10CleanAnswerDelete"
        onclick="deleteTop10Item(
          ${roundIndex},
          ${position}
        )"
        aria-label="حذف الإجابة ${position}"
      >
        ×
      </button>

    </div>
  `
}

/* =========================
   9) Save Top 10
========================= */

async function saveTop10() {
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
    collectTop10CurrentDraft()

    setAdminSaving(
      true,
      "جارٍ حفظ Top 10..."
    )

    top10AdminRoundsCount =
      Math.min(
        Math.max(
          Number(
            top10AdminRoundsCount || 3
          ),
          1
        ),
        4
      )

    const rows = []

    for (
      let roundNumber = 1;
      roundNumber <=
      top10AdminRoundsCount;
      roundNumber++
    ) {
      const round =
        getTop10DraftRound(
          roundNumber
        )

      const question =
        String(
          round.question || ""
        ).trim()

      for (
        let position = 1;
        position <= 10;
        position++
      ) {
        const answer =
          String(
            round.answers[position] || ""
          ).trim()

        if (
          !question &&
          !answer
        ) {
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
          answer
        })
      }
    }

    if (!rows.length) {
      const confirmed =
        await showAdminConfirm(
          "Top 10 فارغ، هل تريد حذف جميع بياناته؟",
          {
            title:
              "حذف بيانات Top 10",

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
          "top10_questions",

          (query) =>
            query.eq(
              "model",
              Number(currentModel)
            ),

          {
            logLabel:
              "CLEAR TOP10"
          }
        )

      if (!clearResult.ok) {
        console.log(
          "CLEAR TOP10 ERROR:",
          clearResult.error
        )

        showGameToast(
          "تعذر حذف بيانات Top 10",
          "error"
        )

        return false
      }

      resetTop10AdminDraft()
      invalidateAdminHomeCache()

      renderTop10AdminFromDraft()

      showGameToast(
        "تم حذف جميع بيانات Top 10",
        "success"
      )

      return true
    }

    const oldRowsResult =
      await dbSelect(
        "top10_questions",

        (query) =>
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
            "READ OLD TOP10"
        }
      )

    if (!oldRowsResult.ok) {
      console.log(
        "READ OLD TOP10 ERROR:",
        oldRowsResult.error
      )

      showGameToast(
        "تعذر قراءة بيانات Top 10 الحالية",
        "error"
      )

      return false
    }

    const saveResult =
      await dbUpsert(
        "top10_questions",
        rows,
        {
          onConflict:
            "model,round,position",

          logLabel:
            "SAVE TOP10"
        }
      )

    if (!saveResult.ok) {
      console.log(
        "SAVE TOP10 ERROR:",
        saveResult.error
      )

      showGameToast(
        "فشل حفظ Top 10",
        "error"
      )

      return false
    }

    const keepKeys =
      new Set(
        rows.map(
          (row) =>
            `${Number(
              row.round
            )}_${Number(
              row.position
            )}`
        )
      )

    const oldRowsToDelete =
      (
        oldRowsResult.data || []
      ).filter((oldRow) => {
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
            (oldRow) =>
              dbDelete(
                "top10_questions",

                (query) =>
                  query
                    .eq(
                      "model",
                      Number(
                        currentModel
                      )
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
                    "DELETE OLD TOP10"
                }
              )
          )
        )

      const failedDelete =
        deleteResults.find(
          (result) =>
            !result?.ok
        )

      if (failedDelete) {
        console.log(
          "DELETE OLD TOP10 ERROR:",
          failedDelete.error
        )

        invalidateAdminHomeCache()

        showGameToast(
          "تم الحفظ لكن تعذر تنظيف بعض بيانات Top 10 القديمة",
          "warning"
        )

        await renderTop10Admin()

        return false
      }
    }

    invalidateAdminHomeCache()

    showGameToast(
      "تم حفظ Top 10",
      "success"
    )

    await renderTop10Admin()

    return true
  } catch (error) {
    console.log(
      "SAVE TOP10 CATCH:",
      error
    )

    showGameToast(
      "توقف حفظ Top 10 بسبب خطأ",
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

async function clearTop10Round(
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
    roundIndex > 4
  ) {
    showGameToast(
      "رقم الجولة غير صحيح",
      "error"
    )

    return false
  }

  collectTop10CurrentDraft()

  const confirmed =
    await showAdminConfirm(
      `هل تريد حذف الجولة ${roundIndex} من Top 10 نهائيًا؟`,
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
        "top10_questions",

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
            "CLEAR TOP10 ROUND"
        }
      )

    if (!deleteResult.ok) {
      console.log(
        "CLEAR TOP10 ROUND ERROR:",
        deleteResult.error
      )

      showGameToast(
        "تعذر حذف الجولة",
        "error"
      )

      return false
    }

    resetTop10DraftRound(
      roundIndex
    )

    invalidateAdminHomeCache()
    renderTop10AdminFromDraft()

    showGameToast(
      `تم حذف الجولة ${roundIndex}`,
      "success"
    )

    return true
  } catch (error) {
    console.log(
      "CLEAR TOP10 ROUND CATCH:",
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

async function deleteTop10Item(
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
    roundIndex > 4 ||
    position < 1 ||
    position > 10
  ) {
    showGameToast(
      "بيانات الإجابة غير صحيحة",
      "error"
    )

    return false
  }

  collectTop10CurrentDraft()

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
        "top10_questions",

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
            "DELETE TOP10 ITEM"
        }
      )

    if (!deleteResult.ok) {
      console.log(
        "DELETE TOP10 ITEM ERROR:",
        deleteResult.error
      )

      showGameToast(
        "تعذر حذف الإجابة",
        "error"
      )

      return false
    }

    const round =
      getTop10DraftRound(
        roundIndex
      )

    round.answers[position] = ""

    invalidateAdminHomeCache()
    renderTop10AdminFromDraft()

    showGameToast(
      `تم حذف إجابة رقم ${position}`,
      "success"
    )

    return true
  } catch (error) {
    console.log(
      "DELETE TOP10 ITEM CATCH:",
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

async function deleteTop10Segment() {
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
      "هل تريد حذف فقرة Top 10 كاملة نهائيًا؟",
      {
        title:
          "حذف فقرة Top 10",

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
        "top10_questions",

        (query) =>
          query.eq(
            "model",
            Number(currentModel)
          ),

        {
          logLabel:
            "DELETE TOP10 QUESTIONS"
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
              "top10"
            ),

        {
          logLabel:
            "DELETE TOP10 SETTINGS"
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
        "DELETE TOP10 SEGMENT ERROR:",
        failedResult.error
      )

      showGameToast(
        "تعذر حذف فقرة Top 10",
        "error"
      )

      return false
    }

    top10AdminRoundsCount = 3

    resetTop10AdminDraft()
    invalidateAdminHomeCache()

    renderTop10AdminFromDraft()

    showGameToast(
      "تم حذف فقرة Top 10",
      "success"
    )

    return true
  } catch (error) {
    console.log(
      "DELETE TOP10 SEGMENT CATCH:",
      error
    )

    showGameToast(
      "حدث خطأ أثناء حذف فقرة Top 10",
      "error"
    )

    return false
  }
}

/* =========================
   13) Global Exports
========================= */

window.renderTop10Admin =
  renderTop10Admin

window.saveTop10 =
  saveTop10

window.handleTop10RoundToggle =
  handleTop10RoundToggle

window.clearTop10Round =
  clearTop10Round

window.deleteTop10Item =
  deleteTop10Item

window.deleteTop10Segment =
  deleteTop10Segment