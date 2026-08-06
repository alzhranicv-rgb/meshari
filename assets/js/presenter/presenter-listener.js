/* =========================================================
   PRESENTER LISTENER / مستقبل أوامر المقدم
   File: assets/js/presenter/presenter-listener.js

   DISPLAY ONLY - MATCHED WITH DISPLAY EXPORTS
========================================================= */

(() => {
  "use strict"

  if (window.__presenterListenerLoaded) {
    console.log("PRESENTER LISTENER: already loaded")
    return
  }

  window.__presenterListenerLoaded = true

  const PRESENTER_COMMAND_EVENT = "presenter_command"
  const PRESENTER_COMMAND_TABLE = "presenter_commands"

  const COMMAND_TTL = 2 * 60 * 1000
  const COMMAND_CACHE_LIMIT = 500
  const RETRY_DELAY = 400
  const POST_SYNC_DELAY = 20

  let listenerSessionId = ""
  let gameChannel = null
  let dbChannel = null
  let ownsGameChannel = false
  let listenerStarted = false
  let retryTimer = null
  let syncTimer = null
  let processedCommands = new Map()

  /* =========================
     HELPERS
  ========================= */

  function getDb() {
    if (window.db) return window.db

    try {
      if (typeof db !== "undefined") return db
    } catch {}

    return null
  }

  function readStorage(key) {
    try {
      return String(localStorage.getItem(key) || "").trim()
    } catch {
      return ""
    }
  }

  function getSessionId() {
    const globals = [
      window.gameSessionId,
      window.currentGameSessionId,
      window.currentSessionId,
      window.displaySessionId,
      window.sessionId
    ]

    for (const value of globals) {
      const clean = String(value || "").trim()
      if (clean) return clean
    }

    const keys = [
      "game_session_id",
      "display_session_id",
      "current_session_id",
      "session_id",
      "presenter_session_id"
    ]

    for (const key of keys) {
      const value = readStorage(key)
      if (value) return value
    }

    try {
      const params =
        new URLSearchParams(window.location.search || "")

      return String(
        params.get("session_id") ||
        params.get("session") ||
        ""
      ).trim()
    } catch {
      return ""
    }
  }

  function getActiveSegment() {
    const globals = [
      window.activeSegment,
      window.currentSegment,
      window.gameActiveSegment,
      window.segmentKey
    ]

    for (const value of globals) {
      const clean = String(value || "").trim()
      if (clean) return clean
    }

    return readStorage("active_segment") || "global"
  }

  function getFn(name) {
    const fn = window[name]
    return typeof fn === "function" ? fn : null
  }

  async function callFn(names, args = []) {
    const list =
      Array.isArray(names)
        ? names
        : [names]

    for (const name of list) {
      const fn = getFn(name)

      if (!fn) continue

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
          `PRESENTER COMMAND ERROR [${name}]:`,
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

  async function callVariants(variants = []) {
    for (const variant of variants) {
      const result =
        await callFn(
          variant.names,
          variant.args || []
        )

      if (result.handled) return result
    }

    return {
      handled: false,
      name: null,
      result: undefined
    }
  }

  function normalizeSegment(segment) {
    const key =
      String(segment || "")
        .trim()
        .replace(/\s+/g, "")

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
      topTen: "top10",

      fatbla: "auction",
      fitbala: "auction",
      فتبلة: "auction"
    }

    return aliases[key] || key || "global"
  }

  function getFinalRoundFromSegment(
    segment,
    fallback = 1
  ) {
    const key = String(segment || "").trim()

    if (
      key === "finalRound1" ||
      key === "final_round1"
    ) return 1

    if (
      key === "finalRound2" ||
      key === "final_round2"
    ) return 2

    if (
      key === "finalRound3" ||
      key === "final_round3"
    ) return 3

    if (
      key === "finalRound4" ||
      key === "final_round4"
    ) return 4

    return Math.min(
      Math.max(Number(fallback || 1), 1),
      4
    )
  }

  function getFinalSegmentKey(round) {
    const r =
      Math.min(
        Math.max(Number(round || 1), 1),
        4
      )

    return `finalRound${r}`
  }

  function setActiveSegment(segment) {
    const normalized =
      normalizeSegment(segment)

    try {
      localStorage.setItem(
        "active_segment",
        normalized
      )
    } catch {}

    window.activeSegment = normalized
    window.currentSegment = normalized
  }

  function normalizePayload(payload) {
    if (!payload) return {}

    if (typeof payload === "string") {
      try {
        const parsed = JSON.parse(payload)

        return parsed &&
          typeof parsed === "object"
          ? parsed
          : {}
      } catch {
        return {}
      }
    }

    if (typeof payload !== "object") return {}

    return { ...payload }
  }

  function normalizeCommand(input) {
    let command = input

    if (
      command?.payload &&
      command?.event === PRESENTER_COMMAND_EVENT
    ) {
      command = command.payload
    }

    if (
      command?.payload?.action &&
      !command?.action
    ) {
      command = command.payload
    }

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
      normalizePayload(command.payload)

    const rawSegment =
      payload.segmentKey ||
      payload.activeSegment ||
      command.segment ||
      payload.segment ||
      getActiveSegment()

    const segment =
      normalizeSegment(rawSegment)

    const round =
      getFinalRoundFromSegment(
        payload.activeSegment ||
        payload.segmentKey ||
        rawSegment,
        payload.round ||
        payload.finalRound ||
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
      rawSegment: String(rawSegment || ""),
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
     DEDUPE
  ========================= */

  function commandKey(command) {
    const id =
      command?.payload?.__client_command_id ||
      command?.id

    if (id) return String(id)

    let payloadKey = ""

    try {
      payloadKey =
        JSON.stringify(command?.payload || {})
    } catch {}

    return [
      command?.session_id || "",
      command?.created_at || "",
      command?.segment || "",
      command?.action || "",
      payloadKey
    ].join("|")
  }

  function cleanCommandCache() {
    const now = Date.now()

    for (
      const [key, createdAt]
      of processedCommands.entries()
    ) {
      if (now - Number(createdAt || 0) > COMMAND_TTL) {
        processedCommands.delete(key)
      }
    }

    if (processedCommands.size <= COMMAND_CACHE_LIMIT) {
      return
    }

    processedCommands =
      new Map(
        Array
          .from(processedCommands.entries())
          .slice(-Math.floor(COMMAND_CACHE_LIMIT / 2))
      )
  }

  function markProcessed(command) {
    cleanCommandCache()

    const key = commandKey(command)

    if (processedCommands.has(key)) {
      return false
    }

    processedCommands.set(key, Date.now())
    return true
  }

  /* =========================
     POST SYNC
  ========================= */

  function schedulePostSync() {
    clearTimeout(syncTimer)

    syncTimer =
      setTimeout(async () => {
        try {
          const saveUnified =
            getFn("saveUnifiedGameState")

          if (saveUnified) {
            await saveUnified()
          }
        } catch (error) {
          console.log(
            "PRESENTER LISTENER SAVE ERROR:",
            error
          )
        }

        try {
          const syncDisplay =
            getFn("syncDisplayStateToSession")

          if (syncDisplay) {
            await syncDisplay({
              immediate: true
            })
          }
        } catch (error) {
          console.log(
            "PRESENTER LISTENER SESSION SYNC ERROR:",
            error
          )
        }

        try {
          getFn("updateEndRoundButtonState")?.()
        } catch {}
      }, POST_SYNC_DELAY)
  }

  /* =========================
     GLOBAL
  ========================= */

  async function openSegmentFromPresenter(command) {
    const payload = command.payload || {}

    const requested =
      payload.activeSegment ||
      payload.segmentKey ||
      payload.segment ||
      command.rawSegment ||
      command.segment

    const normalized =
      normalizeSegment(requested)

    const round =
      getFinalRoundFromSegment(
        requested,
        payload.round ||
        payload.finalRound ||
        command.round ||
        1
      )

    const routeKey =
      normalized === "final"
        ? getFinalSegmentKey(round)
        : normalized

    setActiveSegment(routeKey)

    const opened =
      await callVariants([
        {
          names: [
            "openSegmentFromPresenter",
            "openDisplaySegment",
            "openSegmentPage"
          ],
          args: [
            routeKey,
            round,
            payload
          ]
        },
        {
          names: [
            "openMainSegment",
            "openMaToSegment"
          ],
          args: [routeKey]
        }
      ])

    if (opened.handled) return true

    const renderMap = {
      warmup: ["renderWarmup"],
      top10: ["renderTop10"],
      who: ["renderWho"],
      explain: ["renderExplain"],
      familyDidi: [
  "selectFamilyDidiTeam"
],
      archive: ["renderArchive"],
      randomChallenge: ["renderRandomChallenge"]
    }

    if (normalized === "final") {
      return (
        await callFn(
          ["renderFinal"],
          [
            round,
            routeKey
          ]
        )
      ).handled
    }

    return (
      await callFn(
        renderMap[normalized] || [],
        [payload]
      )
    ).handled
  }

  async function goHomeFromPresenter() {
    setActiveSegment("")

    return (
      await callFn([
        "goHome",
        "goToHome",
        "showDisplayHome",
        "showHome",
        "showSegmentsScreen",
        "goBackToSegments",
        "backToSegments",
        "returnToSegments",
        "renderHome"
      ])
    ).handled
  }

  function setControlsHiddenFallback(hidden) {
    const safeHidden = !!hidden

    document.body?.classList.toggle(
      "displayControlsHidden",
      safeHidden
    )

    document.body?.classList.toggle(
      "presenterControlsHidden",
      safeHidden
    )

    document
      .querySelectorAll(
        [
          "#displayControls",
          ".displayControls",
          ".gameControls",
          ".segmentControls",
          ".controlsBar",
          ".displayControlBar",
          ".displayActionBar",
          ".randomControlsBar",
          ".randomChallengeActions"
        ].join(",")
      )
      .forEach(element => {
        element.classList.toggle(
          "hiddenByPresenter",
          safeHidden
        )

        element.setAttribute(
          "aria-hidden",
          safeHidden ? "true" : "false"
        )
      })

    window.displayControlsHidden = safeHidden
  }

async function handleControls(action, payload = {}) {
  if (action === "toggleDisplayControls") {
    if (typeof payload.hidden === "boolean") {
      action =
        payload.hidden
          ? "hideDisplayControls"
          : "showDisplayControls"
    } else {
      if (
        typeof window.toggleDisplayControlsFromScreen === "function"
      ) {
        window.toggleDisplayControlsFromScreen()
        return true
      }

      setControlsHiddenFallback(
        !window.displayControlsHidden
      )

      return true
    }
  }

  const hidden =
    action === "hideDisplayControls"
      ? true
      : action === "showDisplayControls"
        ? false
        : !!payload.hidden

  localStorage.setItem(
    "presenter_hide_controls",
    hidden ? "1" : "0"
  )

  if (
    typeof window.applyPresenterHideDisplayControlsState === "function"
  ) {
    window.applyPresenterHideDisplayControlsState()
  }

  if (
    typeof window.updateDisplayControlsEyeButton === "function"
  ) {
    window.updateDisplayControlsEyeButton(hidden)
  }

  setControlsHiddenFallback(hidden)

  return true
}

async function endSegmentFromPresenter(payload = {}) {
  if (typeof window.endSegment === "function") {
    window.endSegment()
    return true
  }

  if (typeof window.finishSegment === "function") {
    window.finishSegment()
    return true
  }

  const endButton =
    document.querySelector("[onclick='endSegment()']") ||
    document.querySelector('[onclick="endSegment()"]') ||
    document.querySelector("[onclick='finishSegment()']") ||
    document.querySelector('[onclick="finishSegment()"]') ||
    document.querySelector("#endSegmentBtn") ||
    document.querySelector("#displayEndSegmentBtn") ||
    document.querySelector("#megaEndBtn") ||
    document.querySelector(".endSegmentBtn") ||
    document.querySelector(".displayEndSegmentBtn") ||
    document.querySelector(".megaEndBtn")

  if (
    endButton &&
    typeof endButton.click === "function" &&
    !endButton.disabled
  ) {
    endButton.click()
    return true
  }

  return false
}

  /* =========================
     TEAM
  ========================= */

  async function handleTeam(command) {
    const payload = command.payload || {}
    const team =
      String(payload.team || "").toUpperCase()

    if (team !== "A" && team !== "B") {
      return false
    }

    const segment = command.segment

    const map = {
      warmup: [
        "forceWarmupTeamFromPresenter",
        "selectWarmupTeam"
      ],
      top10: [
        "forceTop10TeamFromPresenter",
        "selectTop10Team"
      ],
      who: [
        "forceWhoTeamFromPresenter",
        "selectWhoTeam"
      ],
      explain: [
        "forceExplainTeamFromPresenter",
        "selectExplainTeam"
      ],
      familyDidi: [
  "openFamilyDidiSegment",
  "renderFamilyDidi"
],
      archive: [
        "forceArchiveTeamFromPresenter",
        "selectArchiveTeam"
      ],
      final: [
        "selectFinalTeam"
      ],
      randomChallenge: [
        "setRandomChallengePresenterTeam",
        "selectRandomChallengeTeam",
        "highlightRandomChallengeTeam"
      ]
    }

    const specific =
      await callFn(
        map[segment] || [],
        [
          team,
          command.round,
          payload
        ]
      )

    if (!specific.handled) {
      await callFn(
        [
          "setGameActiveTeam",
          "selectTeam"
        ],
        [
          team,
          segment,
          command.round,
          payload
        ]
      )
    }

    window.selectedTeam = team
    return true
  }

  /* =========================
     LOTTERY
  ========================= */

  function getLotterySegmentKey(command) {
    const payload = command.payload || {}

    if (payload.activeSegment) {
      return payload.activeSegment
    }

    if (
      command.segment === "final" ||
      payload.segment === "final"
    ) {
      return getFinalSegmentKey(
        payload.round ||
        payload.finalRound ||
        command.round ||
        1
      )
    }

    return (
      payload.segmentKey ||
      payload.segment ||
      command.rawSegment ||
      command.segment ||
      ""
    )
  }

  async function handleLottery(command) {
    const action = command.action
    const payload = command.payload || {}

    const team =
      payload.team === "A" || payload.team === "B"
        ? payload.team
        : null

    const segmentKey =
      getLotterySegmentKey(command)

    if (action === "startLottery") {
      await callFn(
        [
          "startSegmentStartLotteryFromPresenter"
        ],
        [segmentKey]
      )

      if (team) {
        await callFn(
          [
            "selectSegmentStartLotteryTeamFromPresenter"
          ],
          [
            team,
            segmentKey
          ]
        )

        await handleTeam({
          ...command,
          action: "selectTeam",
          payload: {
            ...payload,
            team
          }
        })
      }

      return true
    }

    if (action === "selectLotteryTeam") {
      if (!team) return false

      await callFn(
        [
          "selectSegmentStartLotteryTeamFromPresenter"
        ],
        [
          team,
          segmentKey
        ]
      )

      await handleTeam({
        ...command,
        action: "selectTeam",
        payload: {
          ...payload,
          team
        }
      })

      return true
    }

    if (action === "confirmLottery") {
      await callFn(
        [
          "confirmSegmentStartLotteryFromPresenter"
        ],
        [segmentKey]
      )

      if (team) {
        await handleTeam({
          ...command,
          action: "selectTeam",
          payload: {
            ...payload,
            team
          }
        })
      }

      return true
    }

    if (action === "retryLottery") {
      await callFn(
        [
          "retrySegmentStartLotteryFromPresenter"
        ],
        [segmentKey]
      )

      return true
    }

    return false
  }

  /* =========================
     WARMUP
  ========================= */

async function handleWarmup(action, payload = {}) {
  async function syncWarmupTeamBeforeAction() {
    const team =
      String(payload.team || "").toUpperCase()

    if (team !== "A" && team !== "B") {
      return false
    }

    const result =
      await callFn(
        [
          "forceWarmupTeamFromPresenter",
          "selectWarmupTeam",
          "setWarmupActiveTeam",
          "setGameActiveTeam"
        ],
        [
          team,
          {
            force: true,
            immediate: true,
            sync: false
          },
          payload
        ]
      )

    window.selectedTeam = team
    return result.handled
  }

  if (action === "openNumber") {
    await syncWarmupTeamBeforeAction()

    return (
      await callFn(
        [
          "openWarmupQuestion",
          "selectWarmupQuestion",
          "showWarmupQuestion"
        ],
        [
          Number(payload.category || 0),
          Number(payload.number || 0),
          payload
        ]
      )
    ).handled
  }

  if (
    action === "double" ||
    action === "correct" ||
    action === "wrong"
  ) {
    await syncWarmupTeamBeforeAction()
  }

  const map = {
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
    startTimer: [
      "startWarmupTimer"
    ],
    showAnswer: [
      "showWarmupQuestion"
    ],
    undo: [
      "undoWarmupAction"
    ]
  }

  return (
    await callFn(
      map[action] || [],
      [
        payload.team,
        payload.number,
        payload
      ]
    )
  ).handled
}

  /* =========================
     TOP 10
  ========================= */

async function handleTop10(action, payload = {}) {
  async function syncTop10TeamBeforeAction() {
    const team =
      String(payload.team || "").toUpperCase()

    if (team !== "A" && team !== "B") {
      return false
    }

    await callFn(
      [
        "forceTop10TeamFromPresenter",
        "selectTop10Team"
      ],
      [
        team,
        {
          force: true,
          immediate: true,
          sync: false
        },
        payload
      ]
    )

    if (
      window.top10State &&
      typeof window.top10State === "object"
    ) {
      window.top10State.activeTeam = team
    }

    window.selectedTeam = team
    return true
  }

  if (action === "openNumber") {
    await syncTop10TeamBeforeAction()

    return (
      await callFn(
        [
          "openTop10Number"
        ],
        [
          Number(payload.number || 0),
          payload
        ]
      )
    ).handled
  }

  if (action === "setRound") {
    const round =
      Number(payload.round || 1)

    if (
      window.top10State &&
      typeof window.top10State === "object"
    ) {
      window.top10State.round = round
    }

    return (
      await callFn(
        [
          "renderCurrentRoundTop10UI"
        ],
        [
          round,
          payload
        ]
      )
    ).handled
  }

  if (
    action === "double" ||
    action === "wrong" ||
    action === "switchTurn" ||
    action === "startTimer"
  ) {
    await syncTop10TeamBeforeAction()
  }

  const map = {
    double: [
      "activateTop10Double"
    ],
    showAnswer: [
      "showTop10Answer"
    ],
    correct: [
      "showTop10Answer"
    ],
    wrong: [
      "addTop10Error"
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

  return (
    await callFn(
      map[action] || [],
      [
        payload.team,
        payload.number,
        payload
      ]
    )
  ).handled
}

  /* =========================
     WHO
  ========================= */

async function handleWho(action, payload = {}) {
  async function syncWhoTeamBeforeAction() {
    const team =
      String(payload.team || "").toUpperCase()

    if (team !== "A" && team !== "B") {
      return false
    }

    await callFn(
      [
        "forceWhoTeamFromPresenter",
        "selectWhoTeam"
      ],
      [
        team,
        {
          force: true,
          immediate: true,
          sync: false
        },
        payload
      ]
    )

    if (
      window.whoState &&
      typeof window.whoState === "object"
    ) {
      window.whoState.activeTeam = team
    }

    window.selectedTeam = team
    return true
  }

  async function syncWhoPointsBeforeOpen() {
    const points =
      Number(payload.points || 0)

    if (!points) {
      return false
    }

    if (
      window.whoState &&
      typeof window.whoState === "object"
    ) {
      window.whoState.currentPoints = points
    }

    return (
      await callFn(
        [
          "setWhoPoints"
        ],
        [
          points,
          payload
        ]
      )
    ).handled
  }

  function syncWhoPointsSilently() {
    const points =
      Number(payload.points || 0)

    if (!points) {
      return false
    }

    if (
      window.whoState &&
      typeof window.whoState === "object"
    ) {
      window.whoState.currentPoints = points
      return true
    }

    return false
  }

  if (action === "setPoints") {
    return (
      await callFn(
        [
          "setWhoPoints"
        ],
        [
          Number(payload.points || 0),
          payload
        ]
      )
    ).handled
  }

  if (action === "openNumber") {
    await syncWhoPointsBeforeOpen()
    await syncWhoTeamBeforeAction()

    return (
      await callFn(
        [
          "chooseWho"
        ],
        [
          Number(payload.number || 0),
          payload
        ]
      )
    ).handled
  }

  if (
    action === "double" ||
    action === "correct" ||
    action === "wrong"
  ) {
    await syncWhoTeamBeforeAction()
    syncWhoPointsSilently()
  }

  const map = {
    double: [
      "activateWhoDouble"
    ],
    compensation: [
      "startWhoCompensation"
    ],
    correct: [
      "whoCorrect"
    ],
    wrong: [
      "whoWrong"
    ],
    zoomImage: [
      "toggleWhoImageOverlay",
      "openWhoImageOverlay"
    ],
    showAnswer: [
      "showWhoAnswer"
    ],
    startTimer: [
      "startWhoTimer"
    ],
    undo: [
      "undoWhoAction"
    ]
  }

  return (
    await callFn(
      map[action] || [],
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
     EXPLAIN
  ========================= */

async function handleExplain(action, payload = {}) {
  async function syncExplainTeamBeforeAction() {
    const team =
      String(payload.team || "").toUpperCase()

    if (team !== "A" && team !== "B") {
      return false
    }

    await callFn(
      [
        "forceExplainTeamFromPresenter",
        "selectExplainTeam"
      ],
      [
        team,
        {
          force: true,
          immediate: true,
          sync: false
        },
        payload
      ]
    )

    if (
      window.explainState &&
      typeof window.explainState === "object"
    ) {
      window.explainState.currentTeam = team
      window.explainState.activeTeam = team
      window.explainState.selectedTeam = team
    }

    window.selectedTeam = team
    return true
  }

  if (action === "openNumber") {
    if (payload.team) {
      await syncExplainTeamBeforeAction()
    }

    return (
      await callFn(
        [
          "openExplainNumber"
        ],
        [
          Number(payload.number || 0),
          {
            ...payload,
            compensation:
              payload.compensation === true
          }
        ]
      )
    ).handled
  }

  if (
    action === "double" ||
    action === "startTimer" ||
    action === "toggleWordVisible" ||
    action === "showAnswer" ||
    action === "correct" ||
    action === "wrong"
  ) {
    await syncExplainTeamBeforeAction()
  }

  const map = {
    double: [
      "activateExplainDouble"
    ],
    startTimer: [
      "startExplainTimer"
    ],
    toggleWordVisible: [
      "hideExplainWord"
    ],
    showAnswer: [
      "hideExplainWord"
    ],
    correct: [
      "correctExplainAnswer"
    ],
    wrong: [
      "wrongExplainAnswer"
    ]
  }

  return (
    await callFn(
      map[action] || [],
      [
        payload.team,
        payload.number,
        payload
      ]
    )
  ).handled
}
/* =========================
   FAMILY DIDI
========================= */

async function handleFamilyDidi(
  action,
  payload = {}
) {
  const team =
    String(
      payload.team || ""
    ).toUpperCase()

  const hasTeam =
    team === "A" ||
    team === "B"

  async function syncFamilyDidiTeam() {
    if (!hasTeam) {
      return false
    }

    await callFn(
      [
        "selectFamilyDidiTeam"
      ],
      [
        team,
        {
          history: false,
          timer: false,
          sync: false
        },
        payload
      ]
    )

    if (
      window.familyDidiState &&
      typeof window.familyDidiState ===
        "object"
    ) {
      window.familyDidiState.activeTeam =
        team
    }

    window.selectedTeam = team

    return true
  }

  /*
    فتح السؤال لا يحتاج فريق.
  */
  if (
    action === "revealQuestion"
  ) {
    return (
      await callFn(
        [
          "revealFamilyDidiQuestion"
        ],
        [
          {
            sync: true
          },
          payload
        ]
      )
    ).handled
  }

  /*
    أول إجابتين يمكن فتحهما بدون فريق.
    إذا أُرسل فريق نزامنه أولًا.
  */
  if (
    action === "openAnswer"
  ) {
    if (hasTeam) {
      await syncFamilyDidiTeam()
    }

    return (
      await callFn(
        [
          "openFamilyDidiAnswer"
        ],
        [
          Number(
            payload.position ||
            payload.number ||
            0
          ),
          {
            sync: true
          },
          payload
        ]
      )
    ).handled
  }

  /*
    اعتماد الجولة يحتاج الفريق الفائز.
  */
  if (
    action === "awardRound"
  ) {
    if (hasTeam) {
      await syncFamilyDidiTeam()
    }

    return (
      await callFn(
        [
          "awardFamilyDidiRound"
        ],
        [
          hasTeam
            ? team
            : null,
          {
            sync: true
          },
          payload
        ]
      )
    ).handled
  }

  /*
    الخطأ يمكن أن يعمل قبل تحديد الفريق
    كتأثير فقط حسب منطق العرض.
  */
  if (
    action === "wrong"
  ) {
    if (hasTeam) {
      await syncFamilyDidiTeam()
    }

    return (
      await callFn(
        [
          "addFamilyDidiError"
        ],
        [
          {
            sync: true
          },
          payload
        ]
      )
    ).handled
  }

  if (
    (
      action === "switchTurn" ||
      action === "startTimer"
    ) &&
    hasTeam
  ) {
    await syncFamilyDidiTeam()
  }

  const map = {
    showRemainingAnswers: [
      "showRemainingFamilyDidiAnswers"
    ],

    showAnswer: [
      "showRemainingFamilyDidiAnswers"
    ],

    undo: [
      "undoFamilyDidiAction"
    ],

    switchTurn: [
      "switchFamilyDidiTurn"
    ],

    startTimer: [
      "startFamilyDidiTimerButton",
      "startFamilyDidiTimer"
    ],

    nextRound: [
      "nextFamilyDidiRound"
    ],

    previousRound: [
      "previousFamilyDidiRound"
    ]
  }

  return (
    await callFn(
      map[action] || [],
      [
        payload
      ]
    )
  ).handled
}
  /* =========================
     RANDOM CHALLENGE
  ========================= */

  async function handleRandom(action, payload = {}) {
    if (action === "randomOpenBox") {
      return (
        await callFn(
          ["openRandomChallengeBox"],
          [
            Number(payload.box || 0),
            payload
          ]
        )
      ).handled
    }

    if (action === "randomStartBox1") {
      return (
        await callFn(
          ["startRandomChallengeBox1"],
          [
            payload.pool || "saudi",
            payload
          ]
        )
      ).handled
    }

    if (action === "randomResetBox1") {
      return (
        await callFn(
          ["resetRandomChallengeBox1"],
          [payload]
        )
      ).handled
    }

    if (action === "randomBackToBoxes") {
      return (
        await callFn(
          ["handleRandomChallengeBack"],
          [payload]
        )
      ).handled
    }

    if (action === "randomFinishBox") {
      return (
        await callFn(
          ["finishRandomChallengeCurrentBox"],
          [payload]
        )
      ).handled
    }

    if (action === "randomSetAuctionPoints") {
      const value =
        Number(
          payload.count ??
          payload.points ??
          0
        )

      return (
        await callFn(
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

    if (action === "randomStartBox2Timer") {
      return (
        await callFn(
          ["startRandomBox2Timer"],
          [payload]
        )
      ).handled
    }

    if (action === "randomStartBox3Timer") {
      return (
        await callFn(
          ["startRandomBox3Timer"],
          [payload]
        )
      ).handled
    }

    if (action === "randomFinishRound") {
      return (
        await callFn(
          ["finishRandomBox3ToPoints"],
          [payload]
        )
      ).handled
    }

    if (action === "randomBox3ScorePoints") {
      return (
        await callFn(
          ["scoreRandomBox3Points"],
          [
            Number(payload.points || 0),
            payload
          ]
        )
      ).handled
    }

    if (action === "randomBox3Wrong") {
      return (
        await callFn(
          ["randomBox3Wrong"],
          [payload]
        )
      ).handled
    }

    if (action === "randomBox3Pass") {
      return (
        await callFn(
          ["nextRandomBox3Question"],
          [payload]
        )
      ).handled
    }

    if (action === "randomBox3SwitchTeam") {
      return (
        await callFn(
          ["switchRandomBox3Team"],
          [payload]
        )
      ).handled
    }

    if (action === "randomStartBox4Game") {
      return (
        await callFn(
          ["startRandomBox4Game"],
          [
            payload.team,
            payload
          ]
        )
      ).handled
    }

    if (action === "randomStartBox4SecondTeam") {
      return (
        await callFn(
          ["startRandomBox4SecondTeam"],
          [payload]
        )
      ).handled
    }

    if (action === "randomBox4Answer") {
      return (
        await callFn(
          ["answerRandomBox4"],
          [
            payload.answer ||
            payload.selectedAnswer ||
            "",
            payload
          ]
        )
      ).handled
    }

    if (action === "randomBox4Next") {
      return (
        await callFn(
          ["nextRandomBox4Question"],
          [payload]
        )
      ).handled
    }

    if (action === "randomBox5OpenNumber") {
      return (
        await callFn(
          ["openRandomBox5Number"],
          [
            Number(payload.number || 0),
            payload
          ]
        )
      ).handled
    }

    if (action === "randomBox5RevealAnswer") {
      return (
        await callFn(
          ["revealRandomBox5Answer"],
          [payload]
        )
      ).handled
    }

    if (action === "randomBox5CompleteNumber") {
      return (
        await callFn(
          ["completeRandomBox5Number"],
          [
            payload.correct ??
            payload.isCorrect ??
            false,
            payload
          ]
        )
      ).handled
    }

    if (action === "randomBox5CancelNumber") {
      return (
        await callFn(
          ["cancelRandomBox5Number"],
          [payload]
        )
      ).handled
    }

    if (action === "randomBox5BlockTimer") {
      return (
        await callFn(
          ["startRandomBox5BlockTimer"],
          [payload]
        )
      ).handled
    }

    if (action === "randomSkip") {
      return (
        await callFn(
          ["startRandomChallengeBox1"],
          [
            payload.pool || "saudi",
            {
              ...payload,
              skip: true
            }
          ]
        )
      ).handled
    }

    if (action === "randomBox5PlayVideo") {
      return (
        await callFn(
          ["playRandomBox5Video"],
          [payload]
        )
      ).handled
    }

    if (action === "zoomImage") {
      return (
        await callFn(
          ["zoomRandomBox5Image"],
          [
            Number(payload.number || 0),
            payload
          ]
        )
      ).handled
    }

    const map = {
      correct: [
        "randomChallengeCorrect"
      ],
      wrong: [
        "randomChallengeWrong"
      ],
      showAnswer: [
        "revealRandomBox5Answer"
      ],
      finishSegment: [
        "handleRandomChallengeEnd"
      ],
      goHome: [
        "goRandomChallengeHome"
      ]
    }

    return (
      await callFn(
        map[action] || [],
        [
          payload.team,
          payload.box,
          payload
        ]
      )
    ).handled
  }

  /* =========================
     ARCHIVE
  ========================= */

  async function handleArchive(action, payload = {}) {
    if (action === "setRound") {
      return (
        await callFn(
          ["setArchiveRound"],
          [
            Number(payload.round || 1),
            payload
          ]
        )
      ).handled
    }

    if (action === "openNumber") {
      return (
        await callFn(
          [
            "openArchiveNumber",
            "openArchiveItem"
          ],
          [
            Number(
              payload.number ||
              payload.position ||
              0
            ),
            payload
          ]
        )
      ).handled
    }

    if (action === "showAnswer") {
      return (
        await callFn(
          ["showArchiveAnswer"],
          [
            Number(
              payload.position ||
              payload.number ||
              0
            ),
            payload
          ]
        )
      ).handled
    }

    const map = {
      startTimer: [
        "startArchiveTimer"
      ],
      double: [
        "activateArchiveDouble"
      ],
      wrong: [
        "addArchiveError",
        "addArchiveWrong",
        "archiveWrong"
      ],
      correct: [
        "showArchiveAnswer"
      ],
      undo: [
        "undoArchiveAction"
      ],
      nextRound: [
        "nextArchiveRound"
      ]
    }

    return (
      await callFn(
        map[action] || [],
        [
          payload.team,
          payload
        ]
      )
    ).handled
  }

  /* =========================
     FINAL
  ========================= */

async function handleFinal(action, payload = {}, round = 1) {
  const safeRound =
    Math.min(
      Math.max(
        Number(
          payload.round ||
          payload.finalRound ||
          round ||
          1
        ),
        1
      ),
      4
    )

  async function syncFinalTeamBeforeAction() {
    const team =
      String(payload.team || "").toUpperCase()

    if (team !== "A" && team !== "B") {
      return false
    }

    return (
      await callFn(
        [
          "forceFinalTeamFromPresenter"
        ],
        [
          team,
          {
            ...payload,
            round: safeRound,
            finalRound: safeRound
          }
        ]
      )
    ).handled
  }

  if (action === "setRound") {
    return (
      await callFn(
        ["renderFinal"],
        [
          safeRound,
          getFinalSegmentKey(safeRound)
        ]
      )
    ).handled
  }

  if (action === "openNumber") {
    const number =
      Number(payload.number || 0)

    if (safeRound === 2) {
      await syncFinalTeamBeforeAction()
    }

    if (
      safeRound === 4 &&
      payload.compensation !== true
    ) {
      await syncFinalTeamBeforeAction()
    }

    if (safeRound === 1) {
      return (
        await callFn(
          ["openFinalRound1Card"],
          [
            number,
            {
              ...payload,
              round: 1,
              finalRound: 1
            }
          ]
        )
      ).handled
    }

    if (safeRound === 2) {
      return (
        await callFn(
          ["openFinalRound2Card"],
          [
            number,
            {
              ...payload,
              round: 2,
              finalRound: 2
            }
          ]
        )
      ).handled
    }

    if (safeRound === 3) {
      return (
        await callFn(
          ["openFinalRound3StoryCard"],
          [
            number,
            {
              ...payload,
              round: 3,
              finalRound: 3
            }
          ]
        )
      ).handled
    }

    if (safeRound === 4) {
      return (
        await callFn(
          ["openFinalRound4TeamMediaCard"],
          [
            number,
            {
              ...payload,
              round: 4,
              finalRound: 4
            }
          ]
        )
      ).handled
    }
  }

  if (
    action === "correct" ||
    action === "wrong" ||
    action === "recordScrambleScore" ||
    action === "recordSequenceScore" ||
    action === "recordImageScore"
  ) {
    await syncFinalTeamBeforeAction()
  }

  if (action === "correct") {
    const map = {
      1: ["finalRound1Correct"],
      3: ["finalRound3StoryCorrect"],
      4: ["finalRound4TeamMediaCorrect"]
    }

    if (safeRound === 2) {
      return (
        await callFn(
          ["finalRound2RecordScore"],
          [
            true,
            payload.team,
            payload
          ]
        )
      ).handled
    }

    return (
      await callFn(
        map[safeRound] || [],
        [payload]
      )
    ).handled
  }

  if (action === "wrong") {
    const map = {
      1: ["finalRound1Wrong"],
      3: ["finalRound3StoryWrong"],
      4: ["finalRound4TeamMediaWrong"]
    }

    if (safeRound === 2) {
      return (
        await callFn(
          ["finalRound2RecordScore"],
          [
            false,
            payload.team,
            payload
          ]
        )
      ).handled
    }

    return (
      await callFn(
        map[safeRound] || [],
        [payload]
      )
    ).handled
  }

  const map = {
    double: [
      "activateFinalDouble"
    ],
    undo: [
      "undoFinalAction"
    ],
    showQuestion: [
      "showFinalRound1Question",
      "showFinalRound4TeamMediaQuestion"
    ],
    showAnswer: [
      "showFinalRound1Answer"
    ],
    showStoryPart: [
      "showFinalRound3StoryPart"
    ],
    showNextImage: [
      "finalRound2ShowNextImage"
    ],
    toggleRound2Correct: [
      "toggleFinalRound2CorrectSelection"
    ],
    toggleRound2ImageCorrect: [
      "toggleFinalRound2ImageCorrectSelection"
    ],
    hideRound2SequenceWord: [
      "hideFinalRound2SequenceWord"
    ],
    decreaseCountdown: [
      "finalRound2DecreaseCountdown"
    ],
    recordScrambleScore: [
      "finalRound2RecordScore"
    ],
    recordSequenceScore: [
      "finalRound2RecordSequenceScore"
    ],
    recordImageScore: [
      "finalRound2RecordImageScore"
    ],
    recordRound3Score: [
      "finalRound3StoryCorrect"
    ],
    playCurrentFinalVideo: [
      "playCurrentFinalVideo",
      "playFinalRound4TeamMediaVideo"
    ],
    restartCurrentFinalVideo: [
      "restartCurrentFinalVideo",
      "restartFinalRound4TeamMediaVideo"
    ],
    restartCurrentFinalImage: [
      "restartFinalRound4TeamMediaImage"
    ],
    stopCurrentFinalVideo: [
      "stopCurrentFinalVideo"
    ],
    zoomImage: [
      "toggleFinalRound1ImageOverlay",
      "openFinalRound4TeamMediaOverlay"
    ]
  }

  const value =
    getFinalScoreValue(payload, true)

  const argsMap = {
    showStoryPart: [
      Number(payload.index || payload.part || 0),
      payload
    ],
    toggleRound2Correct: [
      Number(payload.index || 0),
      payload
    ],
    toggleRound2ImageCorrect: [
      Number(payload.index || 0),
      payload
    ],
    hideRound2SequenceWord: [
      Number(payload.index || 0),
      payload
    ],
    recordScrambleScore: [
      value,
      payload.team,
      payload
    ],
    recordSequenceScore: [
      value,
      payload.team,
      payload
    ],
    recordImageScore: [
      value,
      payload.team,
      payload
    ],
    decreaseCountdown: [
      payload
    ],
    showNextImage: [
      payload
    ],
    zoomImage: [
      payload.type || "image",
      payload
    ]
  }

  return (
    await callFn(
      map[action] || [],
      argsMap[action] || [payload]
    )
  ).handled
}
  /* =========================
     GENERIC
  ========================= */

  async function handleGeneric(command) {
    const action = command.action
    const payload = command.payload || {}

    const direct =
      await callFn(
        [action],
        [payload]
      )

    if (direct.handled) return true

    return (
      await callVariants([
        {
          names: ["executePresenterCommand"],
          args: [command]
        },
        {
          names: ["handleSegmentCommand"],
          args: [
            command.segment,
            action,
            payload
          ]
        }
      ])
    ).handled
  }

  /* =========================
     DISPATCH
  ========================= */

  async function dispatchPresenterCommand(command) {
    const action = command.action
    const payload = command.payload || {}

    if (!action) return false

    if (action === "openSegment") {
      const handled =
        await openSegmentFromPresenter(command)

      if (handled) schedulePostSync()
      return handled
    }

    if (action === "goHome") {
      const handled =
        await goHomeFromPresenter()

      if (handled) schedulePostSync()
      return handled
    }

    if (
      action === "endSegment" ||
      action === "finishSegment" ||
      action === "closeSegment" ||
      action === "endRound"
    ) {
      const handled =
        await endSegmentFromPresenter(payload)

      if (handled) schedulePostSync()
      return handled
    }

    if (
      action === "toggleDisplayControls" ||
      action === "showDisplayControls" ||
      action === "hideDisplayControls" ||
      action === "setDisplayControls"
    ) {
      const handled =
        await handleControls(action, payload)

      if (handled) schedulePostSync()
      return handled
    }

    if (action === "selectTeam") {
      const handled =
        await handleTeam(command)

      if (handled) schedulePostSync()
      return handled
    }

    if (
      action === "startLottery" ||
      action === "selectLotteryTeam" ||
      action === "confirmLottery" ||
      action === "retryLottery"
    ) {
      const handled =
        await handleLottery(command)

      if (handled) schedulePostSync()
      return handled
    }

    let handled = false

    if (command.segment === "warmup") {
      handled = await handleWarmup(action, payload)
    }

    if (!handled && command.segment === "top10") {
      handled = await handleTop10(action, payload)
    }

    if (!handled && command.segment === "who") {
      handled = await handleWho(action, payload)
    }

    if (!handled && command.segment === "explain") {
      handled = await handleExplain(action, payload)
    }

    if (
  !handled &&
  command.segment === "familyDidi"
) {
  handled =
    await handleFamilyDidi(
      action,
      payload
    )
}

    if (!handled && command.segment === "randomChallenge") {
      handled = await handleRandom(action, payload)
    }

    if (!handled && command.segment === "archive") {
      handled = await handleArchive(action, payload)
    }

    if (!handled && command.segment === "final") {
      handled =
        await handleFinal(
          action,
          payload,
          command.round
        )
    }

    if (!handled) {
      handled = await handleGeneric(command)
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

    schedulePostSync()
    return true
  }

  async function handlePresenterCommand(input) {
    const command = normalizeCommand(input)

    if (!command) return false

    const activeSession =
      listenerSessionId ||
      getSessionId()

    if (
      command.session_id &&
      activeSession &&
      command.session_id !== activeSession
    ) {
      return false
    }

    if (!markProcessed(command)) {
      return false
    }

    try {
      return await dispatchPresenterCommand(command)
    } catch (error) {
      console.log(
        "PRESENTER COMMAND HANDLE ERROR:",
        error
      )

      return false
    }
  }

  /* =========================
     CHANNELS
  ========================= */

  function isChannelJoined(channel) {
    const state =
      channel?.state ||
      channel?.joinRef ||
      ""

    return (
      state === "joined" ||
      state === "joining" ||
      channel?.joinedOnce === true
    )
  }

  function findGameChannel(client, topic) {
    try {
      const channels =
        typeof client.getChannels === "function"
          ? client.getChannels()
          : []

      return channels.find(channel => {
        return (
          channel.topic === topic ||
          channel.topic === `realtime:${topic}` ||
          channel.subTopic === topic
        )
      }) || null
    } catch {
      return null
    }
  }

  function attachBroadcast(channel) {
    if (!channel) return false

    if (channel.__presenterCommandAttached) {
      return true
    }

    channel.__presenterCommandAttached = true

    channel.on(
      "broadcast",
      {
        event: PRESENTER_COMMAND_EVENT
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

  function setupBroadcast(client, sessionId) {
    const topic =
      `game_session_${sessionId}`

    let channel =
      findGameChannel(client, topic)

    ownsGameChannel = !channel

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

    if (!attachBroadcast(channel)) {
      return null
    }

    gameChannel = channel

    if (
      !isChannelJoined(channel) &&
      typeof channel.subscribe === "function"
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

  function setupDatabase(client, sessionId) {
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
          table: PRESENTER_COMMAND_TABLE,
          filter: `session_id=eq.${sessionId}`
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

    dbChannel = channel
    return channel
  }

  /* =========================
     START / STOP
  ========================= */

  async function stopPresenterListener() {
    clearTimeout(retryTimer)
    clearTimeout(syncTimer)

    const client = getDb()

    if (client && dbChannel) {
      try {
        await client.removeChannel(dbChannel)
      } catch {}
    }

    if (
      client &&
      gameChannel &&
      ownsGameChannel
    ) {
      try {
        await client.removeChannel(gameChannel)
      } catch {}
    }

    gameChannel = null
    dbChannel = null
    ownsGameChannel = false
    listenerStarted = false
  }

  function retryStart() {
    clearTimeout(retryTimer)

    retryTimer =
      setTimeout(() => {
        startPresenterListener()
      }, RETRY_DELAY)
  }

  async function startPresenterListener(options = {}) {
    const client = getDb()

    const sessionId =
      String(
        options.sessionId ||
        getSessionId() ||
        ""
      ).trim()

    if (!client || !sessionId) {
      retryStart()
      return false
    }

    if (
      listenerStarted &&
      listenerSessionId === sessionId
    ) {
      return true
    }

    if (
      listenerStarted &&
      listenerSessionId !== sessionId
    ) {
      await stopPresenterListener()
    }

    listenerSessionId = sessionId

    setupBroadcast(client, sessionId)
    setupDatabase(client, sessionId)

    listenerStarted = true

    console.log(
      "PRESENTER LISTENER READY:",
      sessionId
    )

    return true
  }

  /* =========================
     EXPORTS
  ========================= */

  function getPresenterListenerStatus() {
    return {
      loaded: !!window.__presenterListenerLoaded,
      started: listenerStarted,
      sessionId: listenerSessionId,
      realtimeChannel: !!gameChannel,
      databaseChannel: !!dbChannel,
      ownsRealtimeChannel: ownsGameChannel,
      processedCommands: processedCommands.size
    }
  }

  function clearPresenterListenerCommandCache() {
    processedCommands.clear()
  }

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
    normalizeSegment

  if (
    typeof window.normalizeDisplaySegmentKey !==
    "function"
  ) {
    window.normalizeDisplaySegmentKey =
      normalizeSegment
  }

  /* =========================
     AUTO START
  ========================= */

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        startPresenterListener()
      },
      { once: true }
    )
  } else {
    startPresenterListener()
  }

  window.addEventListener(
    "storage",
    event => {
      const keys = new Set([
        "game_session_id",
        "display_session_id",
        "current_session_id",
        "session_id"
      ])

      if (keys.has(event.key)) {
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