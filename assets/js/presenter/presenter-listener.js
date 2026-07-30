/* =========================================================
   PRESENTER LISTENER / مستقبل أوامر المقدم
   File: assets/js/presenter-listener.js

   هذا الملف خاص بشاشة العرض فقط.

   المسؤوليات:
   - استقبال أوامر المقدم عبر Realtime.
   - استقبال المسار الاحتياطي من presenter_commands.
   - منع تنفيذ الأمر مرتين.
   - توجيه كل أمر إلى دالة الفقرة المناسبة.
   - دعم أسماء الفقرات القديمة والجديدة.
   - عدم إنشاء اشتراك مكرر لقناة الجلسة الموجودة.
========================================================= */

(() => {
  "use strict"

  /* =========================
     1) SINGLE INSTANCE
  ========================= */

  if (window.__presenterListenerLoaded) {
    console.log(
      "PRESENTER LISTENER: already loaded"
    )
    return
  }

  window.__presenterListenerLoaded = true

  /* =========================
     2) CONSTANTS
  ========================= */

  const PRESENTER_COMMAND_EVENT =
    "presenter_command"

  const PRESENTER_COMMAND_TABLE =
    "presenter_commands"

  const PRESENTER_COMMAND_TTL =
    2 * 60 * 1000

  const PRESENTER_COMMAND_CACHE_LIMIT =
    500

  const PRESENTER_LISTENER_RETRY_DELAY =
    500

  const PRESENTER_LISTENER_SYNC_DELAY =
    80

  /* =========================
     3) RUNTIME STATE
  ========================= */

  let presenterListenerSessionId = ""
  let presenterListenerGameChannel = null
  let presenterListenerDbChannel = null

  let presenterListenerOwnsGameChannel = false
  let presenterListenerStarted = false
  let presenterListenerRetryTimer = null
  let presenterListenerSyncTimer = null

  let presenterProcessedCommands = new Map()

  /* =========================
     4) SAFE GLOBAL HELPERS
  ========================= */

  function getPresenterListenerDb() {
    if (window.db) {
      return window.db
    }

    try {
      if (typeof db !== "undefined") {
        return db
      }
    } catch {}

    return null
  }

  function readPresenterListenerStorage(key) {
    try {
      return String(
        localStorage.getItem(key) || ""
      ).trim()
    } catch {
      return ""
    }
  }

  function getPresenterListenerSessionId() {
    const globalCandidates = [
      window.gameSessionId,
      window.currentGameSessionId,
      window.currentSessionId,
      window.displaySessionId,
      window.sessionId
    ]

    for (const value of globalCandidates) {
      const clean = String(value || "").trim()

      if (clean) {
        return clean
      }
    }

    const storageKeys = [
      "game_session_id",
      "display_session_id",
      "current_session_id",
      "session_id",
      "presenter_session_id"
    ]

    for (const key of storageKeys) {
      const value =
        readPresenterListenerStorage(key)

      if (value) {
        return value
      }
    }

    try {
      const params =
        new URLSearchParams(
          window.location?.search || ""
        )

      return String(
        params.get("session_id") ||
        params.get("session") ||
        ""
      ).trim()
    } catch {
      return ""
    }
  }

  function getDisplayActiveSegment() {
    const globals = [
      window.activeSegment,
      window.currentSegment,
      window.gameActiveSegment,
      window.segmentKey
    ]

    for (const value of globals) {
      const clean = String(value || "").trim()

      if (clean) {
        return clean
      }
    }

    return (
      readPresenterListenerStorage(
        "active_segment"
      ) || "global"
    )
  }

  function setDisplayActiveSegment(segment) {
  const key =
    normalizeDisplayPresenterSegment(
      segment
    )

  try {
    if (!key || key === "global") {
      localStorage.removeItem(
        "active_segment"
      )
    } else {
      localStorage.setItem(
        "active_segment",
        key
      )
    }
  } catch {}

  window.activeSegment = key || ""
  window.currentSegment = key || ""
}

  function getWindowFunction(name) {
    const fn = window[name]

    return typeof fn === "function"
      ? fn
      : null
  }

  async function invokeDisplayFunction(
    names,
    args = []
  ) {
    const safeNames =
      Array.isArray(names)
        ? names
        : [names]

    for (const name of safeNames) {
      const fn = getWindowFunction(name)

      if (!fn) {
        continue
      }

      try {
        const result = fn(...args)

        if (
          result &&
          typeof result.then === "function"
        ) {
          await result
        }

        return {
          handled: true,
          name,
          result
        }
      } catch (error) {
        console.log(
          `PRESENTER COMMAND FUNCTION ERROR [${name}]:`,
          error
        )

        return {
          handled: true,
          name,
          error
        }
      }
    }

    return {
      handled: false,
      name: null,
      result: undefined
    }
  }

  async function invokeDisplayVariants(
    variants = []
  ) {
    for (const variant of variants) {
      const result =
        await invokeDisplayFunction(
          variant.names,
          variant.args || []
        )

      if (result.handled) {
        return result
      }
    }

    return {
      handled: false,
      name: null,
      result: undefined
    }
  }

  /* =========================
     5) NORMALIZERS
  ========================= */

  function isDeletedStandalonePresenterSegment(segment) {
  const key = String(segment || "")
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase()

  return (
    key === "auction" ||
    key === "fatbla" ||
    key === "fitbala" ||
    key === "فتبلة"
  )
}

function normalizeDisplayPresenterSegment(segment) {
  const key =
    String(segment || "")
      .trim()
      .replace(/\s+/g, "")

  if (!key) return ""

  if (isDeletedStandalonePresenterSegment(key)) {
    return ""
  }

  const aliases = {
    finalRound1: "final",
    finalRound2: "final",
    finalRound3: "final",
    finalRound4: "final",

    final_round1: "final",
    final_round2: "final",
    final_round3: "final",
    final_round4: "final",

    random_challenge: "randomChallenge",
    randomchallenge: "randomChallenge",

    top_10: "top10",
    topTen: "top10"
  }

  return aliases[key] || key
}

  function getFinalRoundFromSegment(
    segment,
    fallback = 1
  ) {
    const key = String(segment || "").trim()

    if (
      key === "finalRound1" ||
      key === "final_round1"
    ) {
      return 1
    }

    if (
      key === "finalRound2" ||
      key === "final_round2"
    ) {
      return 2
    }

    if (
      key === "finalRound3" ||
      key === "final_round3"
    ) {
      return 3
    }

    if (
      key === "finalRound4" ||
      key === "final_round4"
    ) {
      return 4
    }

    return Math.min(
      Math.max(
        Number(fallback || 1),
        1
      ),
      4
    )
  }

  function getFinalSegmentKey(round) {
    const safeRound = Math.min(
      Math.max(
        Number(round || 1),
        1
      ),
      4
    )

    return `finalRound${safeRound}`
  }

  function normalizePresenterCommandPayload(
    payload
  ) {
    if (!payload) {
      return {}
    }

    if (
      typeof payload === "string"
    ) {
      try {
        const parsed =
          JSON.parse(payload)

        return parsed &&
          typeof parsed === "object"
          ? parsed
          : {}
      } catch {
        return {}
      }
    }

    if (
      typeof payload !== "object"
    ) {
      return {}
    }

    return {
      ...payload
    }
  }

  function normalizeIncomingPresenterCommand(
    input
  ) {
    let command = input

    /*
      Broadcast:
      {
        type,
        event,
        payload: command
      }
    */
    if (
      command?.payload &&
      command?.event ===
        PRESENTER_COMMAND_EVENT
    ) {
      command = command.payload
    }

    /*
      بعض إصدارات Supabase تعيد:
      { payload: command }
    */
    if (
      command?.payload?.action &&
      !command?.action
    ) {
      command = command.payload
    }

    /*
      postgres_changes:
      { new: row }
    */
    if (
      command?.new &&
      !command?.action
    ) {
      command = command.new
    }

    if (
      !command ||
      typeof command !== "object"
    ) {
      return null
    }

    const payload =
      normalizePresenterCommandPayload(
        command.payload
      )

    const rawSegment =
      payload.segmentKey ||
      payload.activeSegment ||
      payload.segment ||
      command.segment ||
      getDisplayActiveSegment()

    const segment =
      normalizeDisplayPresenterSegment(
        rawSegment
      )

    const round =
      getFinalRoundFromSegment(
        rawSegment,
        payload.finalRound ||
        payload.round ||
        command.finalRound ||
        command.round ||
        1
      )

    return {
      id:
        command.id ||
        payload.__client_command_id ||
        "",

      session_id:
        String(
          command.session_id ||
          command.sessionId ||
          payload.session_id ||
          ""
        ).trim(),

      model:
        Number(
          command.model ||
          payload.model ||
          0
        ),

      segment,

      rawSegment:
        String(rawSegment || ""),

      round,

      action:
        String(
          command.action ||
          payload.action ||
          ""
        ).trim(),

      payload,

      created_at:
        command.created_at ||
        command.createdAt ||
        ""
    }
  }

  /* =========================
     6) DEDUPLICATION
  ========================= */

  function createPresenterCommandKey(
    command
  ) {
    const explicitId =
      command?.payload
        ?.__client_command_id ||
      command?.id

    if (explicitId) {
      return String(explicitId)
    }

    let payloadKey = ""

    try {
      payloadKey =
        JSON.stringify(
          command?.payload || {}
        )
    } catch {
      payloadKey = ""
    }

    return [
      command?.session_id || "",
      command?.created_at || "",
      command?.segment || "",
      command?.action || "",
      payloadKey
    ].join("|")
  }

  function cleanPresenterCommandCache() {
    const now = Date.now()

    for (
      const [key, createdAt]
      of presenterProcessedCommands.entries()
    ) {
      if (
        now - Number(createdAt || 0) >
        PRESENTER_COMMAND_TTL
      ) {
        presenterProcessedCommands.delete(
          key
        )
      }
    }

    if (
      presenterProcessedCommands.size <=
      PRESENTER_COMMAND_CACHE_LIMIT
    ) {
      return
    }

    presenterProcessedCommands = new Map(
      Array
        .from(
          presenterProcessedCommands.entries()
        )
        .slice(
          -Math.floor(
            PRESENTER_COMMAND_CACHE_LIMIT / 2
          )
        )
    )
  }

  function markPresenterCommandProcessed(
    command
  ) {
    cleanPresenterCommandCache()

    const key =
      createPresenterCommandKey(command)

    if (
      presenterProcessedCommands.has(key)
    ) {
      return false
    }

    presenterProcessedCommands.set(
      key,
      Date.now()
    )

    return true
  }

  /* =========================
     7) POST ACTION SYNC
  ========================= */

function scheduleDisplayStateSync() {
  clearTimeout(
    presenterListenerSyncTimer
  )

  presenterListenerSyncTimer =
    setTimeout(async () => {
      let unifiedHandled = false

      try {
        const saveUnified =
          getWindowFunction(
            "saveUnifiedGameState"
          )

        if (saveUnified) {
          await saveUnified()
          unifiedHandled = true
        }
      } catch (error) {
        console.log(
          "PRESENTER LISTENER SAVE STATE ERROR:",
          error
        )
      }

      if (!unifiedHandled) {
        try {
          const syncSession =
            getWindowFunction(
              "syncDisplayStateToSession"
            )

          if (syncSession) {
            await syncSession({
              immediate: true
            })
          }
        } catch (error) {
          console.log(
            "PRESENTER LISTENER SYNC ERROR:",
            error
          )
        }
      }

      try {
        const updateEndButton =
          getWindowFunction(
            "updateEndRoundButtonState"
          )

        updateEndButton?.()
      } catch {}
    }, PRESENTER_LISTENER_SYNC_DELAY)
}

  /* =========================
     8) GLOBAL COMMANDS
  ========================= */

  async function openDisplaySegmentFromPresenter(
    command
  ) {
    const payload = command.payload || {}

    const requestedSegment =
      payload.segmentKey ||
      payload.activeSegment ||
      payload.segment ||
      command.rawSegment ||
      command.segment

    if (isDeletedStandalonePresenterSegment(requestedSegment)) {
      return goDisplayHomeFromPresenter()
    }

    const normalized =
      normalizeDisplayPresenterSegment(
        requestedSegment
      )

    const round =
      getFinalRoundFromSegment(
        requestedSegment,
        payload.finalRound ||
        payload.round ||
        command.finalRound ||
        command.round ||
        1
      )

    const routeKey =
      normalized === "final"
        ? getFinalSegmentKey(round)
        : normalized

    setDisplayActiveSegment(routeKey)

    const general =
      await invokeDisplayVariants([
        {
          names: [
            "openSegmentFromPresenter",
            "openDisplaySegment",
            "openSegmentPage"
          ],
          args: [
           routeKey,
           round
           ]
        },
        {
  names: [
    "showSegment",
    "startSegment",
    "renderSegment"
  ],
  args: [routeKey]
}
      ])

    if (general.handled) {
      return true
    }

    if (normalized === "warmup") {
      return (
        await invokeDisplayFunction(
          [
            "renderWarmup",
            "startWarmup"
          ]
        )
      ).handled
    }

    if (normalized === "top10") {
      return (
        await invokeDisplayFunction(
          [
            "renderTop10",
            "startTop10"
          ]
        )
      ).handled
    }


    if (normalized === "who") {
      return (
        await invokeDisplayFunction(
          [
            "renderWho",
            "startWho"
          ]
        )
      ).handled
    }

    if (normalized === "explain") {
      return (
        await invokeDisplayFunction(
          [
            "renderExplain",
            "startExplain"
          ]
        )
      ).handled
    }

    if (normalized === "letterli") {
      return (
        await invokeDisplayFunction(
          [
            "renderLetterli",
            "startLetterli"
          ]
        )
      ).handled
    }

    if (
      normalized === "randomChallenge"
    ) {
      return (
        await invokeDisplayFunction(
          [
            "renderRandomChallenge",
            "startRandomChallenge"
          ]
        )
      ).handled
    }

    if (normalized === "archive") {
      return (
        await invokeDisplayFunction(
          [
            "renderArchive",
            "startArchive"
          ]
        )
      ).handled
    }

    if (normalized === "final") {
      const finalResult =
        await invokeDisplayVariants([
          {
            names: [
              "openFinalRound",
              "setFinalRound",
              "changeFinalRound"
            ],
            args: [round]
          },
          {
            names: [
              "renderFinal",
              "startFinal"
            ],
            args: [round]
          }
        ])

      return finalResult.handled
    }

    return false
  }

  async function goDisplayHomeFromPresenter() {
    setDisplayActiveSegment("")

    const result =
      await invokeDisplayFunction(
        [
          "goHome",
          "goToHome",
          "showDisplayHome",
          "showHome",
          "showSegmentsScreen",
          "goBackToSegments",
          "backToSegments",
          "returnToSegments",
          "renderHome"
        ]
      )

    return result.handled
  }

  function setDisplayControlsHiddenFallback(
    hidden
  ) {
    const safeHidden = !!hidden

    document.body?.classList.toggle(
      "displayControlsHidden",
      safeHidden
    )

    document.body?.classList.toggle(
      "presenterControlsHidden",
      safeHidden
    )

    const selectors = [
      "#displayControls",
      ".displayControls",
      ".gameControls",
      ".segmentControls",
      ".controlsBar",
      ".displayControlBar",
      ".displayActionBar"
    ]

    document
      .querySelectorAll(
        selectors.join(",")
      )
      .forEach(element => {
        element.classList.toggle(
          "hiddenByPresenter",
          safeHidden
        )

        element.setAttribute(
          "aria-hidden",
          safeHidden
            ? "true"
            : "false"
        )
      })

    window.displayControlsHidden =
      safeHidden
  }

  async function handleDisplayControlsCommand(
    action,
    payload
  ) {
    if (
      action ===
      "toggleDisplayControls"
    ) {
      const direct =
        await invokeDisplayFunction(
          [
            "toggleDisplayControls",
            "toggleGameControls",
            "toggleSegmentControls"
          ]
        )

      if (direct.handled) {
        return true
      }

      const current =
        !!window.displayControlsHidden

      setDisplayControlsHiddenFallback(
        !current
      )

      return true
    }

    const hidden =
      action === "hideDisplayControls"
        ? true
        : action === "showDisplayControls"
          ? false
          : !!payload.hidden

    const direct =
      await invokeDisplayVariants([
        {
          names: [
            "setDisplayControlsHidden"
          ],
          args: [hidden]
        },
        {
          names: [
            "setDisplayControlsVisibility"
          ],
          args: [!hidden]
        }
      ])

    if (direct.handled) {
      return true
    }

    setDisplayControlsHiddenFallback(
      hidden
    )

    return true
  }

  async function endDisplaySegmentFromPresenter(
    command
  ) {
    const payload = command.payload || {}

    const result =
      await invokeDisplayVariants([
        {
          names: [
            "endCurrentSegment",
            "finishCurrentSegment",
            "closeCurrentSegment"
          ],
          args: [payload]
        },
        {
          names: [
            "endSegment",
            "finishSegment",
            "closeSegment",
            "handleSegmentEnd"
          ],
          args: [
            command.segment,
            payload
          ]
        }
      ])

    if (!result.handled) {
      await goDisplayHomeFromPresenter()
    }

    return true
  }

  /* =========================
     9) TEAM SELECTION
  ========================= */

  async function handleSelectTeamCommand(
    command
  ) {
    const payload = command.payload || {}
    const team = String(
      payload.team || ""
    ).toUpperCase()

    if (
      team !== "A" &&
      team !== "B"
    ) {
      return false
    }

    const segment = command.segment

    const namesBySegment = {
      warmup: [
        "forceWarmupTeamFromPresenter",
        "setWarmupActiveTeam",
        "selectWarmupTeam"
      ],

      top10: [
        "forceTop10TeamFromPresenter",
        "setTop10ActiveTeam",
        "selectTop10Team"
      ],

      who: [
        "forceWhoTeamFromPresenter",
        "setWhoActiveTeam",
        "selectWhoTeam"
      ],

      explain: [
        "forceExplainTeamFromPresenter",
        "setExplainActiveTeam",
        "selectExplainTeam"
      ],

      letterli: [
        "setLetterliActiveTeam",
        "selectLetterliTeam"
      ],

      randomChallenge: [
        "selectRandomChallengeTeam",
        "highlightRandomChallengeTeam"
      ],

      archive: [
        "forceArchiveTeamFromPresenter",
        "setArchiveActiveTeam",
        "selectArchiveTeam"
      ],

      final: [
        "forceFinalTeamFromPresenter",
        "setFinalActiveTeam",
        "selectFinalTeam"
      ]
    }

    const specific =
      await invokeDisplayFunction(
        namesBySegment[segment] || [],
        [team]
      )

    if (specific.handled) {
      window.selectedTeam = team
      return true
    }

    const generic =
      await invokeDisplayFunction(
        [
          "forceTeamFromPresenter",
          "setActiveTeam",
          "selectTeam"
        ],
        [
          team,
          segment,
          command.round
        ]
      )

    if (generic.handled) {
      window.selectedTeam = team
      return true
    }

    window.selectedTeam = team
    return true
  }

  /* =========================
     10) WARMUP
  ========================= */

  async function handleWarmupCommand(
    action,
    payload
  ) {
    if (action === "openNumber") {
      const category =
        Number(payload.category || 0)

      const number =
        Number(payload.number || 0)

      return (
        await invokeDisplayVariants([
          {
            names: [
              "openWarmupQuestion",
              "selectWarmupQuestion",
              "showWarmupQuestion"
            ],
            args: [
              category,
              number
            ]
          },
          {
            names: [
              "openWarmupNumber"
            ],
            args: [
              number,
              category
            ]
          }
        ])
      ).handled
    }

    const actionMap = {
      double: [
        "activateWarmupDouble",
        "useWarmupDouble",
        "toggleWarmupDouble"
      ],

      correct: [
        "markWarmupCorrect",
        "warmupCorrect",
        "answerWarmupCorrect",
        "scoreWarmupCorrect"
      ],

      wrong: [
        "markWarmupWrong",
        "warmupWrong",
        "answerWarmupWrong",
        "scoreWarmupWrong"
      ],

      undo: [
        "undoWarmupAction",
        "warmupUndo"
      ],

      startTimer: [
        "startWarmupTimer",
        "resumeWarmupTimer"
      ],

      showAnswer: [
        "showWarmupAnswer",
        "revealWarmupAnswer"
      ]
    }

    const names =
      actionMap[action] || []

    if (!names.length) {
      return false
    }

    return (
      await invokeDisplayFunction(
        names,
        [
          payload.team,
          payload.number,
          payload
        ]
      )
    ).handled
  }

  /* =========================
     11) TOP 10
  ========================= */

  async function handleTop10Command(
    action,
    payload
  ) {
    if (action === "openNumber") {
      return (
        await invokeDisplayFunction(
          [
            "openTop10Number"
          ],
          [
            Number(payload.number || 0)
          ]
        )
      ).handled
    }

    if (action === "setRound") {
      const round =
        Number(payload.round || 1)

      const direct =
        await invokeDisplayFunction(
          [
            "setTop10Round",
            "goToTop10Round"
          ],
          [round]
        )

      if (direct.handled) {
        return true
      }

      return (
        await invokeDisplayFunction(
          [
            "renderCurrentRoundTop10UI"
          ],
          [round]
        )
      ).handled
    }

    const actionMap = {
      double: [
        "activateTop10Double"
      ],

      showAnswer: [
        "showTop10Answer"
      ],

      correct: [
        "showTop10Answer",
        "top10Correct"
      ],

      wrong: [
        "addTop10Error",
        "top10Wrong"
      ],

      undo: [
        "undoTop10Action"
      ],

      switchTurn: [
        "switchTop10Turn"
      ],

      nextRound: [
        "nextTop10Round"
      ],

      previousRound: [
        "prevTop10Round"
      ],

      startTimer: [
        "startTop10TimerButton",
        "startTop10Timer"
      ]
    }

    const names =
      actionMap[action] || []

    if (!names.length) {
      return false
    }

    return (
      await invokeDisplayFunction(
        names,
        [
          payload.team,
          payload.number,
          payload
        ]
      )
    ).handled
  }

  /* =========================
     13) WHO / من هو
  ========================= */

  async function handleWhoCommand(
    action,
    payload
  ) {
    if (action === "openNumber") {
  return (
    await invokeDisplayFunction(
      [
        "chooseWho",
        "openWhoNumber",
        "openWhoImage",
        "showWhoNumber"
      ],
      [
        Number(payload.number || 0)
      ]
    )
  ).handled
}

    if (action === "setPoints") {
      return (
        await invokeDisplayFunction(
          [
            "setWhoPoints",
            "selectWhoPoints",
            "setCurrentWhoPoints"
          ],
          [
            Number(payload.points || 0)
          ]
        )
      ).handled
    }

    const actionMap = {
      double: [
        "activateWhoDouble",
        "useWhoDouble"
      ],

      compensation: [
        "activateWhoCompensation",
        "startWhoCompensation",
        "enableWhoCompensation"
      ],

      correct: [
        "whoCorrect",
        "markWhoCorrect",
        "scoreWhoCorrect"
      ],

      wrong: [
        "whoWrong",
        "markWhoWrong",
        "scoreWhoWrong"
      ],

      undo: [
        "undoWhoAction",
        "whoUndo"
      ],

      zoomImage: [
        "zoomWhoImage",
        "openWhoImageViewer"
      ],

      playWhoVideo: [
        "playWhoVideo",
        "playCurrentWhoVideo"
      ]
    }

    const names =
      actionMap[action] || []

    if (!names.length) {
      return false
    }

    return (
      await invokeDisplayFunction(
        names,
        [
          payload.team,
          payload.number,
          payload.points,
          payload
        ]
      )
    ).handled
  }

  /* =========================
     14) EXPLAIN / اشرح الكلمة
  ========================= */

  async function handleExplainCommand(
    action,
    payload
  ) {
    if (action === "openNumber") {
      return (
        await invokeDisplayFunction(
          [
            "openExplainNumber",
            "openExplainWord",
            "showExplainWord"
          ],
          [
            Number(payload.number || 0)
          ]
        )
      ).handled
    }

const actionMap = {
  double: [
    "activateExplainDouble"
  ],

  startTimer: [
    "startExplainTimer",
    "startExplainWordTimer"
  ],

  toggleWordVisible: [
    "hideExplainWord",
    "toggleExplainWordVisible",
    "toggleExplainWord",
    "toggleWordVisible"
  ],

  showAnswer: [
    "showExplainWord",
    "revealExplainWord"
  ],

  correct: [
    "correctExplainAnswer",
    "explainCorrect",
    "markExplainCorrect",
    "scoreExplainCorrect"
  ],

  wrong: [
    "wrongExplainAnswer",
    "explainWrong",
    "markExplainWrong",
    "scoreExplainWrong"
  ],

  undo: [
    "undoExplainAction",
    "explainUndo"
  ]
}

    const names =
      actionMap[action] || []

    if (!names.length) {
      return false
    }

    return (
      await invokeDisplayFunction(
        names,
        [
          payload.team,
          payload.number,
          payload
        ]
      )
    ).handled
  }

  /* =========================
     15) LETTERLI / حرفلي
  ========================= */

async function handleLetterliCommand(
  action,
  payload = {}
) {
  if (
    action === "letterliStartSpin" ||
    action === "startLetterli" ||
    action === "startSpin"
  ) {
    return (
      await invokeDisplayFunction(
        [
          "startLetterliSpin",
          "window.startLetterliSpin"
        ],
        []
      )
    ).handled
  }

  if (
    action === "letterliChangeQuestion" ||
    action === "changeLetterliQuestion" ||
    action === "nextQuestion" ||
    action === "letterliNextQuestion"
  ) {
    return (
      await invokeDisplayFunction(
        [
          "changeLetterliQuestion",
          "window.changeLetterliQuestion"
        ],
        []
      )
    ).handled
  }

  if (
    action === "letterliShowQuestion" ||
    action === "letterliToggleQuestion" ||
    action === "toggleLetterliQuestion"
  ) {
    return (
      await invokeDisplayFunction(
        [
          "toggleLetterliQuestion",
          "window.toggleLetterliQuestion"
        ],
        []
      )
    ).handled
  }

  if (
    action === "letterliShowAnswer" ||
    action === "letterliToggleAnswer" ||
    action === "toggleLetterliAnswer"
  ) {
    return (
      await invokeDisplayFunction(
        [
          "markLetterliCorrectAnswer",
          "window.markLetterliCorrectAnswer"
        ],
        []
      )
    ).handled
  }

  if (
    action === "letterliStartTimer" ||
    action === "startTimer"
  ) {
    return (
      await invokeDisplayFunction(
        [
          "startLetterliCountdown",
          "window.startLetterliCountdown"
        ],
        []
      )
    ).handled
  }

  if (
    action === "letterliScoreTeam" ||
    action === "scoreTeam"
  ) {
    const team =
      payload?.team === "A" ||
      payload?.team === "B"
        ? payload.team
        : ""

    if (!team) {
      return false
    }

    return (
      await invokeDisplayFunction(
        [
          "selectLetterliTeam",
          "window.selectLetterliTeam"
        ],
        [team]
      )
    ).handled
  }

  return false
}
  /* =========================
     16) RANDOM CHALLENGE
  ========================= */

  async function handleRandomChallengeCommand(
    action,
    payload
  ) {
    if (action === "randomOpenBox") {
      return (
        await invokeDisplayFunction(
          [
            "openRandomChallengeBox"
          ],
          [
            Number(payload.box || 0)
          ]
        )
      ).handled
    }

    if (action === "randomStartBox1") {
      return (
        await invokeDisplayFunction(
          [
            "startRandomChallengeBox1"
          ],
          [
            payload.pool || "saudi"
          ]
        )
      ).handled
    }

    if (
      action ===
      "randomSetAuctionPoints"
    ) {
      const value =
        Number(
          payload.count ??
          payload.points ??
          0
        )

      return (
        await invokeDisplayFunction(
          [
            "setRandomBox2NumberValue",
            "updateRandomBox2Number"
          ],
          [
            value,
            payload
          ]
        )
      ).handled
    }

    if (
      action ===
      "randomStartBox2Timer"
    ) {
      return (
        await invokeDisplayFunction(
          [
            "startRandomBox2Timer"
          ]
        )
      ).handled
    }

          if (action === "randomStartBox3Timer") {
        if (payload.team) {
          await invokeDisplayFunction(
            [
              "setRandomChallengePresenterTeam"
            ],
            [
              payload.team
            ]
          )
        }

        return (
          await invokeDisplayFunction(
            [
              "startRandomBox3Timer"
            ]
          )
        ).handled
      }

      if (action === "randomFinishRound") {
        return (
          await invokeDisplayFunction(
            [
              "finishRandomBox3ToPoints"
            ]
          )
        ).handled
      }

      if (action === "randomStartBox4Game") {
        if (payload.team) {
          await invokeDisplayFunction(
            [
              "setRandomChallengePresenterTeam"
            ],
            [
              payload.team
            ]
          )
        }

        return (
          await invokeDisplayFunction(
            [
              "startRandomBox4Game"
            ]
          )
        ).handled
      }

      if (action === "randomStartBox4SecondTeam") {
        return (
          await invokeDisplayFunction(
            [
              "startRandomBox4SecondTeam"
            ]
          )
        ).handled
      }

      if (action === "randomBox4Answer") {
        return (
          await invokeDisplayFunction(
            [
              "answerRandomBox4"
            ],
            [
              payload.selectedAnswer ||
              payload.answer ||
              "صح"
            ]
          )
        ).handled
      }

      if (action === "randomBox4Next") {
        return (
          await invokeDisplayFunction(
            [
              "nextRandomBox4Question"
            ]
          )
        ).handled
      }

      if (action === "randomBox5OpenNumber") {
        return (
          await invokeDisplayFunction(
            [
              "openRandomBox5Number"
            ],
            [
              Number(payload.number || 0)
            ]
          )
        ).handled
      }

if (action === "randomBox5BlockTimer") {
  return (
    await invokeDisplayFunction(
      [
        "toggleRandomBox5BlockMode",
        "startRandomBox5BlockTimer"
      ],
      []
    )
  ).handled
}

            if (action === "randomBox5RevealAnswer") {
        return (
          await invokeDisplayFunction(
            [
              "revealRandomBox5Answer"
            ]
          )
        ).handled
      }

            if (action === "randomBox5PlayVideo") {
        return (
          await invokeDisplayFunction(
            [
              "playRandomBox5Video"
            ]
          )
        ).handled
      }

      if (action === "randomBox5CompleteNumber") {
        if (payload.team) {
          await invokeDisplayFunction(
            [
              "setRandomChallengePresenterTeam"
            ],
            [
              payload.team
            ]
          )
        }

        return (
          await invokeDisplayFunction(
            [
              "completeRandomBox5Number"
            ],
            [
              payload.correct === true ||
              payload.isCorrect === true
            ]
          )
        ).handled
      }

      if (action === "randomBox5CancelNumber") {
        return (
          await invokeDisplayFunction(
            [
              "cancelRandomBox5Number"
            ]
          )
        ).handled
      }

      if (action === "randomBackToBoxes") {
        return (
          await invokeDisplayFunction(
            [
              "handleRandomChallengeBack"
            ]
          )
        ).handled
      }

      if (action === "randomResetBox1") {
        return (
          await invokeDisplayFunction(
            [
              "resetRandomChallengeBox1"
            ]
          )
        ).handled
      }

      if (action === "randomSkip") {
        return (
          await invokeDisplayFunction(
            [
              "startRandomChallengeBox1"
            ],
            [
              payload.pool || "saudi"
            ]
          )
        ).handled
      }

    if (
      action ===
      "randomBox3ScorePoints"
    ) {
      return (
        await invokeDisplayFunction(
          [
            "scoreRandomBox3Points"
          ],
          [
            Number(payload.points || 0)
          ]
        )
      ).handled
    }

    if (
      action ===
      "randomBox3SwitchTeam"
    ) {
      return (
        await invokeDisplayFunction(
          [
            "switchRandomBox3Team"
          ]
        )
      ).handled
    }

    if (
      action ===
      "randomBox3Pass"
    ) {
      return (
        await invokeDisplayFunction(
          [
            "randomBox3Pass"
          ]
        )
      ).handled
    }

    if (
      action ===
      "randomBox3Wrong"
    ) {
      return (
        await invokeDisplayFunction(
          [
            "randomBox3Wrong"
          ]
        )
      ).handled
    }

    if (
      action ===
      "randomFinishBox"
    ) {
      return (
        await invokeDisplayFunction(
          [
            "finishRandomChallengeCurrentBox"
          ]
        )
      ).handled
    }

    const actionMap = {
      correct: [
        "randomChallengeCorrect"
      ],

      wrong: [
        "randomChallengeWrong"
      ],

      skip: [
        "randomChallengeSkip"
      ],

      nextQuestion: [
        "nextRandomBox2Question",
        "nextRandomBox3Question",
        "nextRandomBox4Question"
      ],

      showAnswer: [
        "revealRandomBox5Answer",
        "answerRandomBox4"
      ],

      finishSegment: [
        "handleRandomChallengeEnd"
      ],

      goHome: [
        "goRandomChallengeHome"
      ]
    }

    const names =
      actionMap[action] || []

    if (!names.length) {
      return false
    }

    return (
      await invokeDisplayFunction(
        names,
        [
          payload.team,
          payload.box,
          payload
        ]
      )
    ).handled
  }

  /* =========================
     17) ARCHIVE / الأرشيف
  ========================= */

  async function handleArchiveCommand(
    action,
    payload
  ) {
    if (action === "setRound") {
      return (
        await invokeDisplayFunction(
          [
            "setArchiveRound",
            "goToArchiveRound"
          ],
          [
            Number(payload.round || 1)
          ]
        )
      ).handled
    }

    if (action === "openNumber") {
      return (
        await invokeDisplayFunction(
          [
            "openArchiveNumber",
            "openArchiveItem"
          ],
          [
            Number(
              payload.number ||
              payload.position ||
              0
            )
          ]
        )
      ).handled
    }

    if (action === "showAnswer") {
      return (
        await invokeDisplayFunction(
          [
            "showArchiveAnswer",
            "revealArchiveAnswer",
            "openArchiveRequiredItem"
          ],
          [
            Number(
              payload.position ||
              payload.number ||
              0
            )
          ]
        )
      ).handled
    }

    const actionMap = {
      startTimer: [
        "startArchiveTimer"
      ],

      double: [
        "activateArchiveDouble",
        "useArchiveDouble"
      ],

      correct: [
        "archiveCorrect",
        "markArchiveCorrect"
      ],

      wrong: [
        "archiveWrong",
        "addArchiveError",
        "markArchiveWrong"
      ],

      undo: [
        "undoArchiveAction",
        "archiveUndo"
      ],

      nextRound: [
        "nextArchiveRound"
      ],

      switchTurn: [
        "switchArchiveTurn"
      ]
    }

    const names =
      actionMap[action] || []

    if (!names.length) {
      return false
    }

    return (
      await invokeDisplayFunction(
        names,
        [
          payload.team,
          payload
        ]
      )
    ).handled
  }

  /* =========================
     18) FINAL / الفاصلة
  ========================= */

  async function handleFinalCommand(
    action,
    payload,
    round
  ) {
    const safeRound = Math.min(
      Math.max(
        Number(
          payload.round ||
          round ||
          1
        ),
        1
      ),
      4
    )

    if (action === "setRound") {
      return (
        await invokeDisplayFunction(
          [
            "setFinalRound",
            "changeFinalRound",
            "openFinalRound"
          ],
          [safeRound]
        )
      ).handled
    }

    if (action === "openNumber") {
      const number =
        Number(payload.number || 0)

      const roundSpecificNames = {
        1: [
          "openFinalRound1Number",
          "openFinalRound1Card"
        ],

        2: [
          "openFinalRound2Number",
          "openFinalRound2Card"
        ],

        3: [
  "openFinalRound3StoryCard",
  "openFinalRound3Number",
  "openFinalRound3Card"
],

4: [
  "openFinalRound4TeamMediaCard",
  "openFinalRound4Number",
  "openFinalRound4Card"
]
      }

      return (
        await invokeDisplayVariants([
          {
            names:
              roundSpecificNames[
                safeRound
              ] || [],
            args: [number]
          },
          {
            names: [
              "openFinalNumber",
              "openFinalCard"
            ],
            args: [
              number,
              safeRound
            ]
          },
          {
            names: [
              "openFinalRoundNumber"
            ],
            args: [
              safeRound,
              number
            ]
          }
        ])
      ).handled
    }

        if (safeRound === 1) {
      if (action === "correct") {
        return (
          await invokeDisplayFunction(
            [
              "finalRound1Correct"
            ],
            []
          )
        ).handled
      }

      if (action === "wrong") {
        return (
          await invokeDisplayFunction(
            [
              "finalRound1Wrong"
            ],
            []
          )
        ).handled
      }

      if (action === "showAnswer") {
        return (
          await invokeDisplayFunction(
            [
              "showFinalRound1Answer"
            ],
            []
          )
        ).handled
      }

      if (action === "showQuestion") {
        return (
          await invokeDisplayFunction(
            [
              "showFinalRound1Question"
            ],
            []
          )
        ).handled
      }

if (action === "zoomImage") {
  const imageZoom =
    await invokeDisplayFunction(
      [
        "toggleFinalRound1ImageOverlay"
      ],
      []
    )

  const textZoom =
    await invokeDisplayFunction(
      [
        "toggleFinalRound1Overlay"
      ],
      []
    )

  return imageZoom.handled || textZoom.handled
}
    }

    if (safeRound === 3) {
  if (action === "showStoryPart") {
    return (
      await invokeDisplayFunction(
        [
          "showFinalRound3StoryPart"
        ],
        []
      )
    ).handled
  }

  if (action === "correct") {
    return (
      await invokeDisplayFunction(
        [
          "finalRound3StoryCorrect"
        ],
        []
      )
    ).handled
  }

  if (action === "wrong") {
    return (
      await invokeDisplayFunction(
        [
          "finalRound3StoryWrong"
        ],
        []
      )
    ).handled
  }
}

if (safeRound === 4) {
  if (action === "showQuestion") {
    return (
      await invokeDisplayFunction(
        [
          "showFinalRound4TeamMediaQuestion"
        ],
        []
      )
    ).handled
  }

  if (action === "correct") {
    return (
      await invokeDisplayFunction(
        [
          "finalRound4TeamMediaCorrect"
        ],
        []
      )
    ).handled
  }

  if (action === "wrong") {
    return (
      await invokeDisplayFunction(
        [
          "finalRound4TeamMediaWrong"
        ],
        []
      )
    ).handled
  }

  if (action === "playCurrentFinalVideo") {
    return (
      await invokeDisplayFunction(
        [
          "playFinalRound4TeamMediaVideo"
        ],
        []
      )
    ).handled
  }

  if (action === "restartCurrentFinalVideo") {
    return (
      await invokeDisplayFunction(
        [
          "restartFinalRound4TeamMediaVideo"
        ],
        []
      )
    ).handled
  }

  if (action === "restartCurrentFinalImage") {
    return (
      await invokeDisplayFunction(
        [
          "restartFinalRound4TeamMediaImage"
        ],
        []
      )
    ).handled
  }
}

    const actionMap = {
      double: [
        "activateFinalDouble",
        "useFinalDouble"
      ],

      correct: [
        "finalCorrect",
        "markFinalCorrect",
        "scoreFinalCorrect"
      ],

      wrong: [
        "finalWrong",
        "markFinalWrong",
        "scoreFinalWrong"
      ],

      undo: [
        "undoFinalAction",
        "finalUndo"
      ],

      zoomImage: [
        "zoomFinalImage",
        "zoomCurrentFinalImage",
        "openFinalImageViewer"
      ],

      showStoryPart: [
        "showStoryPart",
        "showNextStoryPart",
        "revealFinalStoryPart"
      ],

toggleRound2Correct: [
  "toggleFinalRound2CorrectSelection",
  "toggleRound2Correct",
  "toggleFinalRound2Correct"
],

toggleRound2ImageCorrect: [
  "toggleFinalRound2ImageCorrectSelection",
  "toggleRound2ImageCorrect",
  "toggleFinalRound2ImageCorrect"
],

hideRound2SequenceWord: [
  "hideFinalRound2SequenceWord",
  "hideRound2SequenceWord",
  "hideFinalSequenceWord"
],

decreaseCountdown: [
  "finalRound2DecreaseCountdown",
  "decreaseCountdown",
  "decreaseFinalCountdown"
],

showNextImage: [
  "finalRound2ShowNextImage",
  "showNextImage",
  "showFinalNextImage"
],

recordScrambleScore: [
  "finalRound2RecordScore",
  "recordScrambleScore"
],

recordSequenceScore: [
  "finalRound2RecordSequenceScore",
  "recordSequenceScore"
],

recordImageScore: [
  "finalRound2RecordImageScore",
  "recordImageScore"
],

showQuestion: [
  "showFinalRound4TeamMediaQuestion",
  "showFinalQuestion",
  "showQuestion"
],

      showAnswer: [
        "showFinalAnswer",
        "showAnswer"
      ],

playCurrentFinalVideo: [
  "playFinalRound4TeamMediaVideo",
  "playCurrentFinalVideo",
  "playFinalVideo"
],

restartCurrentFinalVideo: [
  "restartFinalRound4TeamMediaVideo",
  "restartCurrentFinalVideo",
  "restartFinalVideo"
],

restartCurrentFinalImage: [
  "restartFinalRound4TeamMediaImage",
  "restartCurrentFinalImage",
  "restartFinalImage"
],

      stopCurrentFinalVideo: [
        "stopCurrentFinalVideo",
        "stopFinalVideo"
      ],

      nextRound: [
        "nextFinalRound"
      ]
    }

    const names =
      actionMap[action] || []

    if (!names.length) {
      return false
    }

    const index =
      Number(payload.index ?? -1)

    return (
      await invokeDisplayFunction(
        names,
        [
          index >= 0
            ? index
            : payload.team,

          payload.number,
          safeRound,
          payload
        ]
      )
    ).handled
  }

  /* =========================
     19) GENERIC FALLBACK
  ========================= */

  async function handleGenericDirectCommand(
    command
  ) {
    const action = command.action
    const payload = command.payload || {}

    /*
      يدعم الأوامر التي يكون اسمها
      مطابقًا تمامًا لاسم الدالة في العرض،
      مثل أوامر حرفلي الجديدة.
    */
    const direct =
      await invokeDisplayFunction(
        [action],
        [payload]
      )

    if (direct.handled) {
      return true
    }

    const generic =
      await invokeDisplayVariants([
        {
          names: [
            "executePresenterCommand",
            "dispatchPresenterCommand"
          ],
          args: [command]
        },
        {
          names: [
            "handleSegmentCommand"
          ],
          args: [
            command.segment,
            action,
            payload
          ]
        }
      ])

    return generic.handled
  }

  /* =========================
     20) COMMAND DISPATCHER
  ========================= */

  async function dispatchPresenterCommand(
    command
  ) {
    const action = command.action
    const payload = command.payload || {}

    if (!action) {
      return false
    }

        if (
      isDeletedStandalonePresenterSegment(
        command.rawSegment
      )
    ) {
      if (
        action === "openSegment" ||
        action === "goHome"
      ) {
        return goDisplayHomeFromPresenter()
      }

      return false
    }

    if (action === "openSegment") {
      return openDisplaySegmentFromPresenter(
        command
      )
    }

    if (action === "goHome") {
      return goDisplayHomeFromPresenter()
    }

    if (
      action === "endSegment" ||
      action === "finishSegment" ||
      action === "closeSegment" ||
      action === "endRound"
    ) {
      return endDisplaySegmentFromPresenter(
        command
      )
    }

    if (
      action ===
        "toggleDisplayControls" ||
      action ===
        "showDisplayControls" ||
      action ===
        "hideDisplayControls" ||
      action ===
        "setDisplayControls"
    ) {
      return handleDisplayControlsCommand(
        action,
        payload
      )
    }

    if (action === "selectTeam") {
      return handleSelectTeamCommand(
        command
      )
    }

    let handled = false

    if (command.segment === "warmup") {
      handled =
        await handleWarmupCommand(
          action,
          payload
        )
    }

    if (
      !handled &&
      command.segment === "top10"
    ) {
      handled =
        await handleTop10Command(
          action,
          payload
        )
    }

    if (
      !handled &&
      command.segment === "who"
    ) {
      handled =
        await handleWhoCommand(
          action,
          payload
        )
    }

    if (
      !handled &&
      command.segment === "explain"
    ) {
      handled =
        await handleExplainCommand(
          action,
          payload
        )
    }

    if (
      !handled &&
      command.segment === "letterli"
    ) {
      handled =
        await handleLetterliCommand(
          action,
          payload
        )
    }

    if (
      !handled &&
      command.segment ===
        "randomChallenge"
    ) {
      handled =
        await handleRandomChallengeCommand(
          action,
          payload
        )
    }

    if (
      !handled &&
      command.segment === "archive"
    ) {
      handled =
        await handleArchiveCommand(
          action,
          payload
        )
    }

    if (
      !handled &&
      command.segment === "final"
    ) {
      handled =
        await handleFinalCommand(
          action,
          payload,
          command.round
        )
    }

    if (!handled) {
      handled =
        await handleGenericDirectCommand(
          command
        )
    }

    if (!handled) {
      console.warn(
        "PRESENTER COMMAND NOT HANDLED:",
        {
          segment: command.segment,
          action,
          payload
        }
      )

      return false
    }

    scheduleDisplayStateSync()
    return true
  }

  /* =========================
     21) PUBLIC COMMAND HANDLER
  ========================= */

  async function handlePresenterCommand(
    input
  ) {
    const command =
      normalizeIncomingPresenterCommand(
        input
      )

    if (!command) {
      return false
    }

    const activeSession =
      presenterListenerSessionId ||
      getPresenterListenerSessionId()

    if (
      command.session_id &&
      activeSession &&
      command.session_id !==
        activeSession
    ) {
      return false
    }

    if (
      !markPresenterCommandProcessed(
        command
      )
    ) {
      return false
    }

    try {
      return await dispatchPresenterCommand(
        command
      )
    } catch (error) {
      console.log(
        "PRESENTER COMMAND HANDLE ERROR:",
        error,
        command
      )

      return false
    }
  }

  /* =========================
     22) REALTIME CHANNEL
  ========================= */

  function isSameSupabaseChannel(
    channel,
    topic
  ) {
    const value = String(
      channel?.topic ||
      channel?.name ||
      ""
    )

    return (
      value === topic ||
      value === `realtime:${topic}` ||
      value.endsWith(`:${topic}`)
    )
  }

  function findExistingGameChannel(
    client,
    topic
  ) {
    const globalCandidates = [
      window.gameSessionChannel,
      window.displaySessionChannel,
      window.sessionChannel,
      window.gameChannel,
      window.realtimeChannel
    ]

    for (
      const channel
      of globalCandidates
    ) {
      if (
        channel &&
        isSameSupabaseChannel(
          channel,
          topic
        )
      ) {
        return channel
      }
    }

    try {
      const channels =
        typeof client.getChannels ===
          "function"
          ? client.getChannels()
          : []

      return (
        channels.find(channel =>
          isSameSupabaseChannel(
            channel,
            topic
          )
        ) || null
      )
    } catch {
      return null
    }
  }

  function isSupabaseChannelJoined(
    channel
  ) {
    const state =
      String(
        channel?.state ||
        channel?._state ||
        ""
      ).toLowerCase()

    return (
      state === "joined" ||
      state === "subscribed"
    )
  }

  function attachRealtimeCommandListener(
    channel
  ) {
    if (
      !channel ||
      typeof channel.on !== "function"
    ) {
      return false
    }

    if (
      channel.__presenterCommandHandlerAttached
    ) {
      return true
    }

    channel.__presenterCommandHandlerAttached =
      true

    channel.on(
      "broadcast",
      {
        event:
          PRESENTER_COMMAND_EVENT
      },
      payload => {
        handlePresenterCommand(
          payload?.payload ||
          payload
        )
      }
    )

    return true
  }

  function setupPresenterRealtimeChannel(
    client,
    sessionId
  ) {
    const topic =
      `game_session_${sessionId}`

    let channel =
      findExistingGameChannel(
        client,
        topic
      )

    presenterListenerOwnsGameChannel =
      !channel

    if (!channel) {
      channel = client.channel(
        topic,
        {
          config: {
            broadcast: {
              self: false,
              ack: true
            }
          }
        }
      )
    }

    if (
      !attachRealtimeCommandListener(
        channel
      )
    ) {
      return null
    }

    presenterListenerGameChannel =
      channel

    if (
      !isSupabaseChannelJoined(channel) &&
      typeof channel.subscribe ===
        "function"
    ) {
      channel.subscribe(status => {
        console.log(
          "PRESENTER LISTENER REALTIME:",
          status
        )
      })
    }

    return channel
  }

  /* =========================
     23) DATABASE FALLBACK
  ========================= */

  function setupPresenterDatabaseChannel(
    client,
    sessionId
  ) {
    const topic =
      [
        "display_presenter_commands",
        sessionId,
        Math.random()
          .toString(36)
          .slice(2, 8)
      ].join("_")

    const channel =
      client.channel(topic)

    channel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table:
            PRESENTER_COMMAND_TABLE,
          filter:
            `session_id=eq.${sessionId}`
        },
        payload => {
          handlePresenterCommand(
            payload?.new ||
            payload
          )
        }
      )
      .subscribe(status => {
        console.log(
          "PRESENTER LISTENER DATABASE:",
          status
        )
      })

    presenterListenerDbChannel =
      channel

    return channel
  }

  /* =========================
     24) START / STOP
  ========================= */

  async function stopPresenterListener() {
    clearTimeout(
      presenterListenerRetryTimer
    )

    clearTimeout(
      presenterListenerSyncTimer
    )

    const client =
      getPresenterListenerDb()

    if (
      client &&
      presenterListenerDbChannel
    ) {
      try {
        await client.removeChannel(
          presenterListenerDbChannel
        )
      } catch {}
    }

    if (
      client &&
      presenterListenerGameChannel &&
      presenterListenerOwnsGameChannel
    ) {
      try {
        await client.removeChannel(
          presenterListenerGameChannel
        )
      } catch {}
    }

    presenterListenerDbChannel = null
    presenterListenerGameChannel = null

    presenterListenerOwnsGameChannel =
      false

    presenterListenerStarted = false
  }

  function schedulePresenterListenerRetry() {
    clearTimeout(
      presenterListenerRetryTimer
    )

    presenterListenerRetryTimer =
      setTimeout(() => {
        startPresenterListener()
      }, PRESENTER_LISTENER_RETRY_DELAY)
  }

  async function startPresenterListener(
    options = {}
  ) {
    const client =
      getPresenterListenerDb()

    const sessionId =
      String(
        options.sessionId ||
        getPresenterListenerSessionId() ||
        ""
      ).trim()

    if (
      !client ||
      !sessionId
    ) {
      schedulePresenterListenerRetry()
      return false
    }

    if (
      presenterListenerStarted &&
      presenterListenerSessionId ===
        sessionId
    ) {
      return true
    }

    if (
      presenterListenerStarted &&
      presenterListenerSessionId !==
        sessionId
    ) {
      await stopPresenterListener()
    }

    presenterListenerSessionId =
      sessionId

    setupPresenterRealtimeChannel(
      client,
      sessionId
    )

    setupPresenterDatabaseChannel(
      client,
      sessionId
    )

    presenterListenerStarted = true

    console.log(
      "PRESENTER LISTENER: ready",
      sessionId
    )

    return true
  }

  /* =========================
     25) STATUS / DEBUG
  ========================= */

  function getPresenterListenerStatus() {
    return {
      loaded:
        !!window.__presenterListenerLoaded,

      started:
        presenterListenerStarted,

      sessionId:
        presenterListenerSessionId,

      realtimeChannel:
        !!presenterListenerGameChannel,

      databaseChannel:
        !!presenterListenerDbChannel,

      ownsRealtimeChannel:
        presenterListenerOwnsGameChannel,

      processedCommands:
        presenterProcessedCommands.size
    }
  }

  function clearPresenterListenerCommandCache() {
    presenterProcessedCommands.clear()
  }

  /* =========================
     26) GLOBAL EXPORTS
  ========================= */

  window.startPresenterListener =
    startPresenterListener

  window.stopPresenterListener =
    stopPresenterListener

  window.handlePresenterCommand =
    handlePresenterCommand

  window.dispatchPresenterCommand =
    dispatchPresenterCommand

  window.getPresenterListenerStatus =
    getPresenterListenerStatus

  window.clearPresenterListenerCommandCache =
    clearPresenterListenerCommandCache

  window.normalizeDisplayPresenterSegment =
    normalizeDisplayPresenterSegment

  /*
    توافق مع الاسم القديم الذي سبب الخطأ.
    الملف لا يعتمد عليه، لكنه يوفّره
    لبقية الملفات القديمة إن احتاجته.
  */
  if (
    typeof window.normalizeDisplaySegmentKey !==
    "function"
  ) {
    window.normalizeDisplaySegmentKey =
      normalizeDisplayPresenterSegment
  }

  /* =========================
     27) AUTO START
  ========================= */

  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        startPresenterListener()
      },
      {
        once: true
      }
    )
  } else {
    startPresenterListener()
  }

  window.addEventListener(
    "storage",
    event => {
const sessionKeys = new Set([
  "game_session_id",
  "display_session_id",
  "current_session_id",
  "session_id",
  "presenter_session_id"
])

      if (
        sessionKeys.has(event.key)
      ) {
        startPresenterListener()
      }
    }
  )

  window.addEventListener(
    "beforeunload",
    () => {
      stopPresenterListener()
    }
  )
})()
