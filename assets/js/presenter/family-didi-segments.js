/* =========================================================
   FAMILY DIDI / فاملي ديدي
   PRESENTER CONTROL + READER
========================================================= */

/* =========================
   1) RUNTIME
========================= */

let presenterFamilyDidiRows = []
let presenterFamilyDidiLoadedModel = null
let presenterFamilyDidiRowsPromise = null

let presenterFamilyDidiActionBusy = false
let presenterFamilyDidiPendingPosition = null
let presenterFamilyDidiTimerInterval = null
let presenterFamilyDidiAdminMaxRounds =
  null
  const PRESENTER_FAMILY_DIDI_PLAY_TIMER =
  20

const PRESENTER_FAMILY_DIDI_STEAL_TIMER =
  30
const PRESENTER_FAMILY_DIDI_CACHE_TTL =
  5 * 60 * 1000

/* =========================
   2) STATE HELPERS
========================= */

function getPresenterFamilyDidiRoot() {
  return (
    presenterLiveState?.familyDidi ||
    {}
  )
}

function getPresenterFamilyDidiState() {
  const root =
    getPresenterFamilyDidiRoot()

  return (
    root?.familyDidiState ||
    root ||
    {
      round: 1,

      scores: {
        A: 0,
        B: 0
      },

      activeTeam: null,
      originalTeam: null,
      stealTeam: null,

      phase: "play",
      rounds: {}
    }
  )
}

function getPresenterFamilyDidiMaxRounds() {
  const root =
    getPresenterFamilyDidiRoot()

  const rowsMaxRound =
    presenterFamilyDidiRows.reduce(
      (maxRound, row) => {
        return Math.max(
          maxRound,
          Number(row.round || 0)
        )
      },
      0
    )

  const count =
    Number(
      presenterFamilyDidiAdminMaxRounds ||
      root?.familyDidiMaxRounds ||
      presenterLiveState
        ?.familyDidiMaxRounds ||
      localStorage.getItem(
        "family_didi_max_rounds"
      ) ||
      rowsMaxRound ||
      3
    )

  return Math.min(
    Math.max(
      Number.isFinite(count)
        ? count
        : 3,
      1
    ),
    5
  )
}

function getPresenterFamilyDidiRoundNumber() {
  return Math.min(
    Math.max(
      Number(
        getPresenterFamilyDidiState()
          ?.round || 1
      ),
      1
    ),
    getPresenterFamilyDidiMaxRounds()
  )
}

function createPresenterFamilyDidiRound() {
  return {
    question: "",
    questionRevealed: false,

    timerSeconds:
  PRESENTER_FAMILY_DIDI_PLAY_TIMER,
    answersCount: 8,

    answers: {},
    opened: [],

    errors: {
      A: 0,
      B: 0
    },

    initialOpenedCount: 0,
    previewErrorsCount: 0,

    roundPoints: 0,
    awardedTeam: null,

    resultRecorded: false,
    remainingAnswersRevealed: false,
    doubleRound: false,
    completed: false
  }
}

function getPresenterFamilyDidiRound(
  roundNumber =
    getPresenterFamilyDidiRoundNumber()
) {
  const state =
    getPresenterFamilyDidiState()

  return (
    state?.rounds?.[roundNumber] ||
    state?.rounds?.[
      String(roundNumber)
    ] ||
    createPresenterFamilyDidiRound()
  )
}

function getPresenterFamilyDidiActiveTeam() {
  const state =
    getPresenterFamilyDidiState()

  return (
    state?.activeTeam ||
    presenterSelectedTeam ||
    null
  )
}

function getPresenterFamilyDidiOpened() {
  const round =
    getPresenterFamilyDidiRound()

  return Array.isArray(round.opened)
    ? round.opened.map(Number)
    : []
}

function getPresenterFamilyDidiErrors() {
  const round =
    getPresenterFamilyDidiRound()

  return {
    A: Math.min(
      Math.max(
        Number(
          round?.errors?.A || 0
        ),
        0
      ),
      3
    ),

    B: Math.min(
      Math.max(
        Number(
          round?.errors?.B || 0
        ),
        0
      ),
      3
    )
  }
}

function getPresenterFamilyDidiAnswersCount() {
  const roundNumber =
    getPresenterFamilyDidiRoundNumber()

  const round =
    getPresenterFamilyDidiRound(
      roundNumber
    )

  const firstRow =
    getPresenterFamilyDidiRoundRows(
      roundNumber
    )[0] || null

  const count =
    Number(
      firstRow?.answers_count ||
      round?.answersCount ||
      Object.keys(
        round?.answers || {}
      ).length ||
      8
    )

  return Math.min(
    Math.max(
      Number.isFinite(count)
        ? count
        : 8,
      1
    ),
    8
  )
}

function isPresenterFamilyDidiDoubleRound() {
  const roundNumber =
    getPresenterFamilyDidiRoundNumber()

  const round =
    getPresenterFamilyDidiRound()

  return (
    Boolean(round.doubleRound) ||
    roundNumber ===
      getPresenterFamilyDidiMaxRounds()
  )
}

function getPresenterFamilyDidiTimerSync() {
  const root =
    getPresenterFamilyDidiRoot()

  return (
    root?.timerSync ||
    root?.familyDidiTimerSync ||
    presenterLiveState
      ?.familyDidiTimerSync ||
    null
  )
}

function getPresenterFamilyDidiTimerDuration() {
  const state =
    getPresenterFamilyDidiState()

  return state.phase === "steal"
    ? PRESENTER_FAMILY_DIDI_STEAL_TIMER
    : PRESENTER_FAMILY_DIDI_PLAY_TIMER
}

/* =========================
   3) DATA + CACHE
========================= */

function getPresenterFamilyDidiCacheKey() {
  return [
    "presenter_family_didi_rows",
    Number(presenterModel || 0)
  ].join("_")
}

function readPresenterFamilyDidiCache() {
  try {
    const saved =
      JSON.parse(
        localStorage.getItem(
          getPresenterFamilyDidiCacheKey()
        ) || "null"
      )

    if (
      !Array.isArray(saved?.rows) ||
      !saved?.savedAt
    ) {
      return null
    }

    if (
      Date.now() -
      Number(saved.savedAt) >
      PRESENTER_FAMILY_DIDI_CACHE_TTL
    ) {
      return null
    }

    return saved.rows
  } catch {
    return null
  }
}

function savePresenterFamilyDidiCache(
  rows
) {
  try {
    localStorage.setItem(
      getPresenterFamilyDidiCacheKey(),
      JSON.stringify({
        rows:
          Array.isArray(rows)
            ? rows
            : [],

        savedAt: Date.now()
      })
    )
  } catch (error) {
    console.log(
      "SAVE PRESENTER FAMILY DIDI CACHE ERROR:",
      error
    )
  }
}

async function loadPresenterFamilyDidiRows(
  options = {}
) {
  const modelId =
    Number(presenterModel || 0)

  if (!modelId) {
    return []
  }

  try {
  const settingsResult =
    await db
      .from("segment_settings")
      .select("item_count")
      .eq("model", modelId)
      .eq("segment", "familyDidi")
      .maybeSingle()

  if (
    !settingsResult.error &&
    settingsResult.data
  ) {
    presenterFamilyDidiAdminMaxRounds =
      Math.min(
        Math.max(
          Number(
            settingsResult.data
              .item_count || 3
          ),
          1
        ),
        5
      )

    localStorage.setItem(
      "family_didi_max_rounds",
      String(
        presenterFamilyDidiAdminMaxRounds
      )
    )
  }
} catch (error) {
  console.log(
    "LOAD PRESENTER FAMILY DIDI SETTINGS ERROR:",
    error
  )
}

  if (
    presenterFamilyDidiRowsPromise &&
    options.forceRefresh !== true
  ) {
    return presenterFamilyDidiRowsPromise
  }

  if (
    options.forceRefresh !== true
  ) {
    const cachedRows =
      readPresenterFamilyDidiCache()

    if (cachedRows?.length) {
      presenterFamilyDidiRows =
        cachedRows

      presenterFamilyDidiLoadedModel =
        modelId

      if (
        options.backgroundRefresh !==
        false
      ) {
        setTimeout(() => {
          loadPresenterFamilyDidiRows({
            forceRefresh: true,
            backgroundRefresh: false
          }).then(() => {
            if (
              presenterSegment ===
              "familyDidi"
            ) {
              renderPresenterFamilyDidiAnswersOnly()
              refreshPresenterFamilyDidiFromState()
            }
          })
        }, 0)
      }

      return cachedRows
    }
  }

  presenterFamilyDidiRowsPromise =
    (async () => {
      try {
        const {
          data,
          error
        } = await db
          .from(
            "family_didi_questions"
          )
          .select(`
            round,
            position,
            question,
            answer,
            points,
            answers_count,
            timer_seconds
          `)
          .eq(
            "model",
            modelId
          )
          .order("round", {
            ascending: true
          })
          .order("position", {
            ascending: true
          })

        if (error) {
          throw error
        }

        presenterFamilyDidiRows =
          Array.isArray(data)
            ? data
            : []

        presenterFamilyDidiLoadedModel =
          modelId

        savePresenterFamilyDidiCache(
          presenterFamilyDidiRows
        )

        return presenterFamilyDidiRows
      } catch (error) {
        console.log(
          "LOAD PRESENTER FAMILY DIDI ERROR:",
          error
        )

        return presenterFamilyDidiRows
      } finally {
        presenterFamilyDidiRowsPromise =
          null
      }
    })()

  return presenterFamilyDidiRowsPromise
}

function getPresenterFamilyDidiRoundRows(
  roundNumber =
    getPresenterFamilyDidiRoundNumber()
) {
  return presenterFamilyDidiRows
    .filter(row => {
      return (
        Number(row.round) ===
        Number(roundNumber)
      )
    })
    .sort((a, b) => {
      return (
        Number(a.position || 0) -
        Number(b.position || 0)
      )
    })
}

function getPresenterFamilyDidiRow(
  position,
  roundNumber =
    getPresenterFamilyDidiRoundNumber()
) {
  return getPresenterFamilyDidiRoundRows(
    roundNumber
  ).find(row => {
    return (
      Number(row.position) ===
      Number(position)
    )
  }) || null
}

/* =========================
   4) POINTS
========================= */

function getPresenterFamilyDidiBaseTotalPoints() {
  const roundNumber =
    getPresenterFamilyDidiRoundNumber()

  const answersCount =
    getPresenterFamilyDidiAnswersCount()

  return getPresenterFamilyDidiRoundRows(
    roundNumber
  )
    .filter(row => {
      return (
        Number(row.position) >= 1 &&
        Number(row.position) <=
          answersCount
      )
    })
    .reduce((total, row) => {
      return (
        total +
        Math.max(
          0,
          Number(row.points || 0)
        )
      )
    }, 0)
}

function getPresenterFamilyDidiBaseOpenedPoints() {
  const opened =
    getPresenterFamilyDidiOpened()

  const round =
    getPresenterFamilyDidiRound()

  return opened.reduce(
    (total, position) => {
      const statePoints =
        Number(
          round?.answers?.[position]
            ?.points || 0
        )

      const rowPoints =
        Number(
          getPresenterFamilyDidiRow(
            position
          )?.points || 0
        )

      return (
        total +
        Math.max(
          0,
          statePoints || rowPoints
        )
      )
    },
    0
  )
}

function getPresenterFamilyDidiMultiplier() {
  return isPresenterFamilyDidiDoubleRound()
    ? 2
    : 1
}

function getPresenterFamilyDidiTotalPoints() {
  return (
    getPresenterFamilyDidiBaseTotalPoints() *
    getPresenterFamilyDidiMultiplier()
  )
}

function getPresenterFamilyDidiOpenedPoints() {
  return (
    getPresenterFamilyDidiBaseOpenedPoints() *
    getPresenterFamilyDidiMultiplier()
  )
}

/* =========================
   5) COMMAND
========================= */

async function sendPresenterFamilyDidiCommandSafe(
  action,
  payload = {}
) {
  if (
    typeof sendCommand !==
    "function"
  ) {
    return false
  }

  try {
    const result =
      await Promise.race([
        sendCommand(
          action,
          {
            ...payload,
            segment: "familyDidi"
          }
        ),

        new Promise(resolve => {
          setTimeout(() => {
            resolve(false)
          }, 2500)
        })
      ])

    return result !== false
  } catch (error) {
    console.log(
      "PRESENTER FAMILY DIDI COMMAND ERROR:",
      error
    )

    return false
  }
}

/* =========================
   6) HTML HELPERS
========================= */

function escapePresenterFamilyDidiHtml(
  value
) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function getPresenterFamilyDidiAnswer(
  position
) {
  const round =
    getPresenterFamilyDidiRound()

  return (
    round?.answers?.[position]
      ?.answer ||
    getPresenterFamilyDidiRow(position)
      ?.answer ||
    "—"
  )
}

function getPresenterFamilyDidiAnswerPoints(
  position
) {
  const round =
    getPresenterFamilyDidiRound()

  return Math.max(
    0,
    Number(
      round?.answers?.[position]
        ?.points ||
      getPresenterFamilyDidiRow(position)
        ?.points ||
      0
    )
  )
}

function canPresenterOpenFamilyDidiAnswer(
  position
) {
  const round =
    getPresenterFamilyDidiRound()

  const opened =
    getPresenterFamilyDidiOpened()

  const activeTeam =
    getPresenterFamilyDidiActiveTeam()

  const initialOpenedCount =
    Math.min(
      Math.max(
        Number(
          round.initialOpenedCount || 0
        ),
        0
      ),
      2
    )

  if (
    opened.includes(
      Number(position)
    ) ||
    round.completed ||
    round.resultRecorded ||
    presenterFamilyDidiActionBusy ||
    presenterFamilyDidiPendingPosition
  ) {
    return false
  }

  if (initialOpenedCount < 2) {
    return true
  }

  return Boolean(activeTeam)
}

function buildPresenterFamilyDidiAnswerButton(
  position
) {
  const opened =
    getPresenterFamilyDidiOpened()

  const isOpened =
    opened.includes(
      Number(position)
    )

  const isPending =
    presenterFamilyDidiPendingPosition ===
    Number(position)

  const answer =
    getPresenterFamilyDidiAnswer(
      position
    )

  const points =
    getPresenterFamilyDidiAnswerPoints(
      position
    )

  const disabled =
    !canPresenterOpenFamilyDidiAnswer(
      position
    )

  return `
    <button
      type="button"
      class="
        presenterFamilyDidiAnswerBtn
        ${isOpened ? "opened" : ""}
        ${isPending ? "pending" : ""}
      "
      data-family-didi-position="${position}"
      ${disabled ? "disabled" : ""}
      onclick="
        openPresenterFamilyDidiAnswer(
          ${position},
          event
        )
      "
    >
      <span
        class="presenterFamilyDidiAnswerNo"
      >
        ${position}
      </span>

      <span
        class="presenterFamilyDidiAnswerText"
      >
        ${escapePresenterFamilyDidiHtml(
          answer
        )}
      </span>

      <span
        class="presenterFamilyDidiAnswerPoints"
      >
        ${points}
      </span>
    </button>
  `
}

function buildPresenterFamilyDidiAnswersHtml() {
  const answersCount =
    getPresenterFamilyDidiAnswersCount()

  const rightPositions =
    Array.from(
      {
        length:
          Math.min(
            answersCount,
            4
          )
      },
      (_, index) =>
        index + 1
    )

  const leftPositions =
    Array.from(
      {
        length:
          Math.max(
            answersCount - 4,
            0
          )
      },
      (_, index) =>
        index + 5
    )

  return `
    <div
      class="
        presenterFamilyDidiAnswersCol
        presenterFamilyDidiRightCol
      "
    >
      ${rightPositions
        .map(position => {
          return buildPresenterFamilyDidiAnswerButton(
            position
          )
        })
        .join("")}
    </div>

    <div
      class="
        presenterFamilyDidiAnswersCol
        presenterFamilyDidiLeftCol
        ${
          leftPositions.length
            ? ""
            : "isEmpty"
        }
      "
    >
      ${leftPositions
        .map(position => {
          return buildPresenterFamilyDidiAnswerButton(
            position
          )
        })
        .join("")}
    </div>
  `
}

function renderPresenterFamilyDidiAnswersOnly() {
  const box =
    document.getElementById(
      "presenterFamilyDidiAnswersCols"
    )

  if (!box) {
    return
  }

  box.innerHTML =
    buildPresenterFamilyDidiAnswersHtml()
}

/* =========================
   7) MAIN RENDER
========================= */

async function renderPresenterFamilyDidi() {
  const panel =
    document.getElementById(
      "presenterPanel"
    )

  if (!panel) {
    return
  }

  const cachedRows =
    readPresenterFamilyDidiCache()

  if (cachedRows?.length) {
    presenterFamilyDidiRows =
      cachedRows

    presenterFamilyDidiLoadedModel =
      Number(presenterModel || 0)
  }

  const roundNumber =
    getPresenterFamilyDidiRoundNumber()

  const round =
    getPresenterFamilyDidiRound()

  const errors =
    getPresenterFamilyDidiErrors()

  panel.dataset.segment =
    "familyDidi"

  panel.innerHTML = `
    <section
      class="presenterFamilyDidiScreen"
      aria-label="لوحة تحكم فاملي ديدي"
    >

      <main
        class="presenterFamilyDidiMain"
      >

        <section
          class="
            presenterCard
            presenterFamilyDidiAnswersCard
          "
        >
          <div
            id="presenterFamilyDidiAnswersCols"
            class="presenterFamilyDidiAnswersCols"
          >
            ${
              presenterFamilyDidiRows.length
                ? buildPresenterFamilyDidiAnswersHtml()
                : `
                  <div
                    class="presenterFamilyDidiLoading"
                  >
                    ${getPresenterLoadingMarkup(
                      "جارٍ تحميل الإجابات..."
                    )}
                  </div>
                `
            }
          </div>
        </section>

        <section
          class="
            presenterCard
            presenterFamilyDidiControlCard
          "
        >

          <div
            class="presenterFamilyDidiRoundLine"
          >
            <div
              class="presenterFamilyDidiRoundBadge"
            >
              <span>الجولة</span>

              <strong
                id="presenterFamilyDidiRoundText"
              >
                ${roundNumber}
              </strong>
            </div>

            <button
              type="button"
              id="presenterFamilyDidiTimer"
              class="presenterFamilyDidiTimer"
              onclick="
                runPresenterFamilyDidiAction(
                  'startTimer'
                )
              "
            >
              ${getPresenterFamilyDidiTimerDuration()}
            </button>
          </div>

          <div
            class="presenterFamilyDidiPointsLine"
          >
            <div
              class="presenterFamilyDidiPointsBox"
            >
              <span>
                إجمالي الجولة
              </span>

              <strong
                id="presenterFamilyDidiTotalPoints"
              >
                ${getPresenterFamilyDidiTotalPoints()}
              </strong>
            </div>

            <div
              class="
                presenterFamilyDidiPointsBox
                presenterFamilyDidiOpenedPointsBox
              "
            >
              <span>
                النقاط المفتوحة
              </span>

              <strong
                id="presenterFamilyDidiOpenedPoints"
              >
                ${getPresenterFamilyDidiOpenedPoints()}
              </strong>
            </div>
          </div>

          <div
            class="presenterFamilyDidiErrorsLine"
          >
            <div
              class="
                presenterFamilyDidiErrorBox
                teamA
              "
            >
              <span>A</span>

              <strong
                id="presenterFamilyDidiErrorsA"
              >
                ${errors.A} / 3
              </strong>
            </div>

            <div
              class="
                presenterFamilyDidiErrorBox
                teamB
              "
            >
              <span>B</span>

              <strong
                id="presenterFamilyDidiErrorsB"
              >
                ${errors.B} / 3
              </strong>
            </div>
          </div>

          <button
            type="button"
            <div
  id="presenterFamilyDidiQuestion"
  class="
    presenterFamilyDidiQuestion
    revealed
  "
>
  ${escapePresenterFamilyDidiHtml(
    round.question ||
    getPresenterFamilyDidiRoundRows(
      roundNumber
    )[0]?.question ||
    "—"
  )}
</div>
            class="
              presenterFamilyDidiQuestion
              ${
                round.questionRevealed
                  ? "revealed"
                  : "hiddenQuestion"
              }
            "
            onclick="
              runPresenterFamilyDidiAction(
                'revealQuestion'
              )
            "
            ${
              round.questionRevealed
                ? "disabled"
                : ""
            }
          >
            ${
              round.questionRevealed
                ? escapePresenterFamilyDidiHtml(
                    round.question ||
                    getPresenterFamilyDidiRoundRows(
                      roundNumber
                    )[0]?.question ||
                    "—"
                  )
                : "إظهار السؤال"
            }
          </button>

          <div
            id="presenterFamilyDidiStatus"
            class="presenterFamilyDidiStatus"
          ></div>

          <div
            class="presenterFamilyDidiActions"
          >
            <button
              type="button"
              id="presenterFamilyDidiWrongBtn"
              class="
                presenterBtn
                presenterFamilyDidiWrongBtn
              "
              onclick="
                runPresenterFamilyDidiAction(
                  'wrong'
                )
              "
            >
              خطأ
            </button>

            <button
              type="button"
              id="presenterFamilyDidiAwardBtn"
              class="
                presenterBtn
                presenterFamilyDidiAwardBtn
              "
              onclick="
                runPresenterFamilyDidiAction(
                  'awardRound'
                )
              "
            >
              اعتماد الجولة
            </button>

            <button
              type="button"
              id="presenterFamilyDidiShowAnswersBtn"
              class="
                presenterBtn
                presenterFamilyDidiShowAnswersBtn
              "
              onclick="
                runPresenterFamilyDidiAction(
                  'showRemainingAnswers'
                )
              "
            >
              إظهار الإجابات
            </button>

            <button
              type="button"
              id="presenterFamilyDidiUndoBtn"
              class="
                presenterBtn
                presenterFamilyDidiUndoBtn
              "
              onclick="
                runPresenterFamilyDidiAction(
                  'undo'
                )
              "
            >
              تراجع
            </button>

            <button
              type="button"
              id="presenterFamilyDidiSwitchBtn"
              class="
                presenterBtn
                presenterFamilyDidiSwitchBtn
              "
              onclick="
                runPresenterFamilyDidiAction(
                  'switchTurn'
                )
              "
            >
              تبديل
            </button>

            <button
              type="button"
              id="presenterFamilyDidiNextBtn"
              class="
                presenterBtn
                presenterFamilyDidiNextBtn
              "
              onclick="
                runPresenterFamilyDidiAction(
                  'nextRound'
                )
              "
            >
              الجولة التالية
            </button>
          </div>

        </section>

      </main>

    </section>
  `

  refreshPresenterFamilyDidiFromState()
  startPresenterFamilyDidiTimerWatcher()

  if (!presenterFamilyDidiRows.length) {
    await loadPresenterFamilyDidiRows({
      backgroundRefresh: false
    })

    if (
      presenterSegment !==
      "familyDidi"
    ) {
      return
    }

    renderPresenterFamilyDidiAnswersOnly()
    refreshPresenterFamilyDidiFromState()
    return
  }

  loadPresenterFamilyDidiRows({
    backgroundRefresh: false
  }).then(() => {
    if (
      presenterSegment !==
      "familyDidi"
    ) {
      return
    }

    renderPresenterFamilyDidiAnswersOnly()
    refreshPresenterFamilyDidiFromState()
  })
}

/* =========================
   8) OPEN ANSWER
========================= */

async function openPresenterFamilyDidiAnswer(
  position,
  event
) {
  const safePosition =
    Number(position || 0)

  if (
    !safePosition ||
    presenterFamilyDidiActionBusy ||
    presenterFamilyDidiPendingPosition
  ) {
    return
  }

  if (
    !canPresenterOpenFamilyDidiAnswer(
      safePosition
    )
  ) {
    const round =
      getPresenterFamilyDidiRound()

    if (
      Number(
        round.initialOpenedCount || 0
      ) >= 2 &&
      !getPresenterFamilyDidiActiveTeam()
    ) {
      showToast(
        "اختر الفريق أولاً"
      )
    }

    return
  }

  const activeTeam =
    getPresenterFamilyDidiActiveTeam()

  presenterFamilyDidiPendingPosition =
    safePosition

  presenterFamilyDidiActionBusy = true

  const button =
    event?.currentTarget

  button?.classList.add(
    "pending"
  )

  if (button) {
    button.disabled = true
  }

  const sent =
    await sendPresenterFamilyDidiCommandSafe(
      "openAnswer",
      {
        position: safePosition,
        number: safePosition,
        round:
          getPresenterFamilyDidiRoundNumber(),

        team:
          activeTeam || null
      }
    )

  if (!sent) {
    presenterFamilyDidiActionBusy =
      false

    presenterFamilyDidiPendingPosition =
      null

    showToast(
      "تعذر فتح الإجابة"
    )

    refreshPresenterFamilyDidiFromState()

    return
  }

  setTimeout(() => {
    presenterFamilyDidiActionBusy =
      false

    presenterFamilyDidiPendingPosition =
      null

    refreshPresenterFamilyDidiFromState()
  }, 260)
}

/* =========================
   9) ACTIONS
========================= */

async function runPresenterFamilyDidiAction(
  action
) {
  if (
    presenterFamilyDidiActionBusy
  ) {
    return
  }

  const roundNumber =
    getPresenterFamilyDidiRoundNumber()

  const maxRounds =
    getPresenterFamilyDidiMaxRounds()

  const round =
    getPresenterFamilyDidiRound()

  const activeTeam =
    getPresenterFamilyDidiActiveTeam()

  if (
    action === "revealQuestion" &&
    round.questionRevealed
  ) {
    return
  }

  if (
    action === "awardRound"
  ) {
    if (!activeTeam) {
      showToast(
        "اختر الفريق الفائز"
      )

      return
    }

    if (
      !getPresenterFamilyDidiOpened()
        .length
    ) {
      showToast(
        "افتح إجابة أولاً"
      )

      return
    }
  }

  if (
    action ===
      "showRemainingAnswers" &&
    (
      !round.resultRecorded ||
      !round.completed
    )
  ) {
    showToast(
      "سجّل نتيجة الجولة أولاً"
    )

    return
  }

  if (
    action === "switchTurn" &&
    !activeTeam
  ) {
    showToast(
      "اختر الفريق أولاً"
    )

    return
  }

  if (
    action === "startTimer" &&
    !activeTeam
  ) {
    showToast(
      "اختر الفريق أولاً"
    )

    return
  }

  if (
    action === "nextRound"
  ) {
    if (!round.completed) {
      showToast(
        "اعتمد الجولة أولاً"
      )

      return
    }

    if (
      !round.remainingAnswersRevealed
    ) {
      showToast(
        "أظهر بقية الإجابات أولاً"
      )

      return
    }

    if (
      roundNumber >= maxRounds
    ) {
      showToast(
        "هذه آخر جولة"
      )

      return
    }
  }

  presenterFamilyDidiActionBusy =
    true

  updatePresenterFamilyDidiButtons()

  const sent =
    await sendPresenterFamilyDidiCommandSafe(
      action,
      {
        round: roundNumber,
        team:
          activeTeam || null
      }
    )

  if (!sent) {
    presenterFamilyDidiActionBusy =
      false

    updatePresenterFamilyDidiButtons()

    showToast(
      "تعذر تنفيذ الأمر"
    )

    return
  }

  setTimeout(() => {
    presenterFamilyDidiActionBusy =
      false

    refreshPresenterFamilyDidiFromState()
  }, action === "nextRound"
    ? 2300
    : 320
  )
}

/* =========================
   10) BUTTONS
========================= */

function updatePresenterFamilyDidiButtons() {
  const roundNumber =
    getPresenterFamilyDidiRoundNumber()

  const maxRounds =
    getPresenterFamilyDidiMaxRounds()

  const round =
    getPresenterFamilyDidiRound()

  const activeTeam =
    getPresenterFamilyDidiActiveTeam()

  const openedCount =
    getPresenterFamilyDidiOpened()
      .length

  const busy =
    presenterFamilyDidiActionBusy

  const questionButton =
    document.getElementById(
      "presenterFamilyDidiQuestion"
    )

  const wrongButton =
    document.getElementById(
      "presenterFamilyDidiWrongBtn"
    )

  const awardButton =
    document.getElementById(
      "presenterFamilyDidiAwardBtn"
    )

  const showAnswersButton =
    document.getElementById(
      "presenterFamilyDidiShowAnswersBtn"
    )

  const undoButton =
    document.getElementById(
      "presenterFamilyDidiUndoBtn"
    )

  const switchButton =
    document.getElementById(
      "presenterFamilyDidiSwitchBtn"
    )

  const nextButton =
    document.getElementById(
      "presenterFamilyDidiNextBtn"
    )

  if (questionButton) {
    questionButton.disabled =
      busy ||
      round.questionRevealed
  }

  if (wrongButton) {
    wrongButton.disabled =
      busy ||
      round.completed ||
      round.resultRecorded
  }

  if (awardButton) {
    awardButton.disabled =
      busy ||
      !activeTeam ||
      !openedCount ||
      round.resultRecorded ||
      round.completed
  }

  if (showAnswersButton) {
    showAnswersButton.disabled =
      busy ||
      !round.resultRecorded ||
      !round.completed ||
      round.remainingAnswersRevealed
  }

  if (undoButton) {
    undoButton.disabled = busy
  }

  if (switchButton) {
    switchButton.disabled =
      busy ||
      !activeTeam ||
      round.completed
  }

  if (nextButton) {
    nextButton.disabled =
      busy ||
      !round.completed ||
      !round.remainingAnswersRevealed ||
      roundNumber >= maxRounds

    nextButton.innerText =
      roundNumber >= maxRounds
        ? "آخر جولة"
        : "الجولة التالية"
  }
}

/* =========================
   11) TIMER
========================= */

function getPresenterFamilyDidiRemainingSeconds() {
  const timerSync =
    getPresenterFamilyDidiTimerSync()

  if (
    timerSync?.running &&
    Number(timerSync.endsAt) >
      Date.now()
  ) {
    return Math.max(
      0,
      Math.ceil(
        (
          Number(timerSync.endsAt) -
          Date.now()
        ) / 1000
      )
    )
  }

  return getPresenterFamilyDidiTimerDuration()
}

function updatePresenterFamilyDidiTimer() {
  const timer =
    document.getElementById(
      "presenterFamilyDidiTimer"
    )

  if (!timer) {
    return
  }

  const value =
    getPresenterFamilyDidiRemainingSeconds()

  timer.innerText =
    String(value)

  timer.classList.toggle(
    "timerDanger",
    value > 0 &&
    value <= 5
  )

  timer.classList.toggle(
    "isRunning",
    Boolean(
      getPresenterFamilyDidiTimerSync()
        ?.running
    )
  )
}

function startPresenterFamilyDidiTimerWatcher() {
  stopPresenterFamilyDidiTimerWatcher()

  updatePresenterFamilyDidiTimer()

  presenterFamilyDidiTimerInterval =
    setInterval(() => {
      if (
        presenterSegment !==
        "familyDidi"
      ) {
        stopPresenterFamilyDidiTimerWatcher()
        return
      }

      updatePresenterFamilyDidiTimer()
    }, 250)
}

function stopPresenterFamilyDidiTimerWatcher() {
  if (
    presenterFamilyDidiTimerInterval
  ) {
    clearInterval(
      presenterFamilyDidiTimerInterval
    )

    presenterFamilyDidiTimerInterval =
      null
  }
}

/* =========================
   12) REFRESH
========================= */

async function refreshPresenterFamilyDidiFromState() {
  if (
    presenterSegment !==
    "familyDidi"
  ) {
    stopPresenterFamilyDidiTimerWatcher()
    return
  }

  const roundNumber =
    getPresenterFamilyDidiRoundNumber()

  const round =
    getPresenterFamilyDidiRound()

  const opened =
    getPresenterFamilyDidiOpened()

  const errors =
    getPresenterFamilyDidiErrors()

  const activeTeam =
    getPresenterFamilyDidiActiveTeam()

  updatePresenterTeamButtonsOnly(
    activeTeam
  )

  const roundText =
    document.getElementById(
      "presenterFamilyDidiRoundText"
    )

  if (roundText) {
    roundText.innerText =
      String(roundNumber)
  }

  const totalPoints =
    document.getElementById(
      "presenterFamilyDidiTotalPoints"
    )

  const openedPoints =
    document.getElementById(
      "presenterFamilyDidiOpenedPoints"
    )

  if (totalPoints) {
    totalPoints.innerText =
      String(
        getPresenterFamilyDidiTotalPoints()
      )
  }

  if (openedPoints) {
    openedPoints.innerText =
      String(
        getPresenterFamilyDidiOpenedPoints()
      )
  }

  const errorsA =
    document.getElementById(
      "presenterFamilyDidiErrorsA"
    )

  const errorsB =
    document.getElementById(
      "presenterFamilyDidiErrorsB"
    )

  if (errorsA) {
    errorsA.innerText =
      `${errors.A} / 3`
  }

  if (errorsB) {
    errorsB.innerText =
      `${errors.B} / 3`
  }

  const question =
    document.getElementById(
      "presenterFamilyDidiQuestion"
    )

if (question) {
  question.innerText =
    round.question ||
    getPresenterFamilyDidiRoundRows(
      roundNumber
    )[0]?.question ||
    "—"

  question.classList.add(
    "revealed"
  )

  question.classList.remove(
    "hiddenQuestion"
  )
}

  const status =
    document.getElementById(
      "presenterFamilyDidiStatus"
    )

  if (status) {
    if (round.resultRecorded) {
      const winner =
        round.awardedTeam === "A"
          ? presenterTeamAName
          : round.awardedTeam === "B"
            ? presenterTeamBName
            : ""

      status.innerText =
        winner
          ? `تم اعتماد الجولة لـ ${winner}`
          : "تم اعتماد الجولة"
    } else if (
      getPresenterFamilyDidiState()
        .phase === "steal"
    ) {
      status.innerText =
        "فرصة السرقة"
    } else if (!activeTeam) {
      status.innerText =
        Number(
          round.initialOpenedCount || 0
        ) < 2
          ? "يمكن فتح إجابتين قبل تحديد الفريق"
          : "اختر الفريق"
    } else {
      status.innerText =
        activeTeam === "A"
          ? `الدور على ${presenterTeamAName}`
          : `الدور على ${presenterTeamBName}`
    }
  }

  document
    .querySelectorAll(
      ".presenterFamilyDidiAnswerBtn"
    )
    .forEach(button => {
      const position =
        Number(
          button.dataset
            .familyDidiPosition || 0
        )

      if (!position) {
        return
      }

      const isOpened =
        opened.includes(position)

      const isPending =
        presenterFamilyDidiPendingPosition ===
        position

      button.classList.toggle(
        "opened",
        isOpened
      )

      button.classList.toggle(
        "pending",
        isPending
      )

      button.disabled =
        !canPresenterOpenFamilyDidiAnswer(
          position
        )

      const text =
        button.querySelector(
          ".presenterFamilyDidiAnswerText"
        )

      const points =
        button.querySelector(
          ".presenterFamilyDidiAnswerPoints"
        )

      if (text) {
        text.innerText =
          getPresenterFamilyDidiAnswer(
            position
          )
      }

      if (points) {
        points.innerText =
          String(
            getPresenterFamilyDidiAnswerPoints(
              position
            )
          )
      }
    })

  updatePresenterFamilyDidiButtons()
  updatePresenterFamilyDidiTimer()
}

/* =========================
   13) READER
========================= */

async function renderPresenterReaderFamilyDidi() {
  const panel =
    document.getElementById(
      "presenterReaderPanel"
    )

  if (!panel) {
    return
  }

  const {
    data,
    error
  } = await db
    .from(
      "family_didi_questions"
    )
    .select(`
      round,
      position,
      question,
      answer,
      points,
      answers_count,
      timer_seconds
    `)
    .eq(
      "model",
      Number(presenterModel)
    )
    .order("round", {
      ascending: true
    })
    .order("position", {
      ascending: true
    })

  if (error) {
    throw error
  }

  const rows =
    Array.isArray(data)
      ? data
      : []

  if (!rows.length) {
    panel.innerHTML =
      readerEmpty(
        "لا توجد بيانات في فاملي ديدي"
      )

    return
  }

  const rounds =
    [
      ...new Set(
        rows.map(row => {
          return Number(
            row.round || 0
          )
        })
      )
    ]
      .filter(Boolean)
      .sort((a, b) => a - b)

  panel.innerHTML = `
    <section class="readerRoundsStack">
      ${rounds
        .map(roundNumber => {
          const roundRows =
            rows.filter(row => {
              return (
                Number(row.round) ===
                Number(roundNumber)
              )
            })

          const firstRow =
            roundRows[0] || {}

          const answersCount =
            Math.min(
              Math.max(
                Number(
                  firstRow.answers_count ||
                  roundRows.length ||
                  8
                ),
                1
              ),
              8
            )

          return `
            <section class="readerRoundPage">

              <header class="readerRoundHead">
                <h2>
                  الجولة ${roundNumber}
                </h2>

                <span>
                  فاملي ديدي
                </span>
              </header>

              <article
                class="readerQuestionCard"
              >
                ${escapePresenterFamilyDidiHtml(
                  firstRow.question || "—"
                )}
              </article>

              <div class="readerSimpleGrid">
                ${roundRows
                  .filter(row => {
                    return (
                      Number(row.position) <=
                      answersCount
                    )
                  })
                  .map(row => {
                    return `
                      <article
                        class="readerMiniCard"
                      >
                        <div class="readerBlock">
                          <label>الرقم</label>

                          <p>
                            ${Number(
                              row.position || 0
                            )}
                          </p>
                        </div>

                        <div class="readerBlock">
                          <label>الإجابة</label>

                          <p>
                            ${escapePresenterFamilyDidiHtml(
                              row.answer || "—"
                            )}
                          </p>
                        </div>

                        <div class="readerBlock">
                          <label>النقاط</label>

                          <p>
                            ${Math.max(
                              0,
                              Number(
                                row.points || 0
                              )
                            )}
                          </p>
                        </div>
                      </article>
                    `
                  })
                  .join("")}
              </div>

            </section>
          `
        })
        .join("")}
    </section>
  `
}

/* =========================
   14) EXPORTS
========================= */

window.renderPresenterFamilyDidi =
  renderPresenterFamilyDidi

window.refreshPresenterFamilyDidiFromState =
  refreshPresenterFamilyDidiFromState

window.openPresenterFamilyDidiAnswer =
  openPresenterFamilyDidiAnswer

window.runPresenterFamilyDidiAction =
  runPresenterFamilyDidiAction

window.renderPresenterReaderFamilyDidi =
  renderPresenterReaderFamilyDidi

window.stopPresenterFamilyDidiTimerWatcher =
  stopPresenterFamilyDidiTimerWatcher

window.addEventListener(
  "beforeunload",
  stopPresenterFamilyDidiTimerWatcher
)