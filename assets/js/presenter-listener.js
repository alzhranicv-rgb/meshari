let presenterCommandChannel = null
let presenterCommandChannelHealthy = false
let presenterCommandReconnectTimer = null
let presenterCommandListenerSessionId = ""

let lastPresenterCommandId = 0
let handledPresenterCommandKeys = new Set()

function getDisplaySessionId() {
  return localStorage.getItem("game_session_id") || ""
}

function safeRunPresenterAction(fn) {
  try {
    if (typeof fn !== "function") return

    const result = fn()

    if (result && typeof result.catch === "function") {
      result.catch(error => {
        console.log("Presenter async action error:", error)
      })
    }

    return result
  } catch (error) {
    console.log("Presenter action error:", error)
  }
}
/* =========================
   DISPLAY CONTROLS
========================= */

function hideDisplayControls() {
  document.body.classList.add("presenterHideDisplayControls")
  document.documentElement.classList.add("presenterHideDisplayControls")
  localStorage.setItem("presenter_hide_controls", "1")

  if (typeof applyPresenterHideDisplayControlsState === "function") {
    applyPresenterHideDisplayControlsState()
  }

  if (typeof updateDisplayControlsEyeButton === "function") {
    updateDisplayControlsEyeButton(true)
  }

  if (typeof syncDisplayStateToSession === "function") {
    syncDisplayStateToSession()
  }
}

function showDisplayControls() {
  document.body.classList.remove("presenterHideDisplayControls")
  document.documentElement.classList.remove("presenterHideDisplayControls")
  localStorage.setItem("presenter_hide_controls", "0")

  if (typeof applyPresenterHideDisplayControlsState === "function") {
    applyPresenterHideDisplayControlsState()
  }

  if (typeof updateDisplayControlsEyeButton === "function") {
    updateDisplayControlsEyeButton(false)
  }

  if (typeof syncDisplayStateToSession === "function") {
    syncDisplayStateToSession()
  }
}

function restoreDisplayControlsMode() {
  const isHidden = localStorage.getItem("presenter_hide_controls") === "1"

  document.body.classList.toggle("presenterHideDisplayControls", isHidden)
  document.documentElement.classList.toggle("presenterHideDisplayControls", isHidden)

  if (typeof updateDisplayControlsEyeButton === "function") {
    updateDisplayControlsEyeButton(isHidden)
  }
}

/* =========================
   LISTENER
   Broadcast سريع + Database احتياط
========================= */

function schedulePresenterCommandReconnect(delay = 1000) {
  clearTimeout(presenterCommandReconnectTimer)

  presenterCommandReconnectTimer = setTimeout(() => {
    presenterCommandReconnectTimer = null
    listenPresenterCommands(true)
  }, delay)
}

async function removePresenterCommandChannel() {
  presenterCommandChannelHealthy = false

  if (!presenterCommandChannel) return

  const oldChannel = presenterCommandChannel
  presenterCommandChannel = null

  try {
    if (window.db) {
      await db.removeChannel(oldChannel)
    }
  } catch (error) {
    console.log("Presenter listener remove channel error:", error)
  }
}

async function listenPresenterCommands(forceReconnect = false) {
  if (!window.db) {
    console.log("Presenter listener: db not ready")
    schedulePresenterCommandReconnect(300)
    return
  }

  const sessionId = getDisplaySessionId()

  if (!sessionId) {
    console.log("Presenter listener: no session id")
    schedulePresenterCommandReconnect(500)
    return
  }

  /*
    لا نعيد الاشتراك إذا القناة الحالية سليمة
    ومتصلة بنفس الجلسة.
  */
  if (
    !forceReconnect &&
    presenterCommandChannel &&
    presenterCommandChannelHealthy &&
    presenterCommandListenerSessionId === sessionId
  ) {
    return
  }

  clearTimeout(presenterCommandReconnectTimer)
  presenterCommandReconnectTimer = null

  await removePresenterCommandChannel()

  presenterCommandListenerSessionId = sessionId

  const channel = db.channel(
    "game_session_" + sessionId,
    {
      config: {
        broadcast: {
          self: false,
          ack: true
        }
      }
    }
  )

  presenterCommandChannel = channel

  channel
    .on(
      "broadcast",
      {
        event: "presenter_command"
      },
      payload => {
        const cmd = payload?.payload
        if (!cmd) return

        handlePresenterCommandOnce(
          cmd,
          "broadcast"
        )
      }
    )
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "presenter_commands",
        filter: `session_id=eq.${sessionId}`
      },
      payload => {
        const cmd = payload?.new
        if (!cmd) return

        handlePresenterCommandOnce(
          cmd,
          "database"
        )
      }
    )
    .subscribe(status => {
      console.log(
        "Presenter listener status:",
        status
      )

      if (
        presenterCommandChannel !== channel ||
        presenterCommandListenerSessionId !== sessionId
      ) {
        return
      }

      if (status === "SUBSCRIBED") {
        presenterCommandChannelHealthy = true
        return
      }

      if (
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT" ||
        status === "CLOSED"
      ) {
        presenterCommandChannelHealthy = false
        schedulePresenterCommandReconnect(1000)
      }
    })
}
/* =========================
   RANDOM CHALLENGE TIMER SYNC WATCHER
   مزامنة مؤقت ماذا تعرف مع المقدم
========================= */

let randomChallengeBox3TimerLastSyncKey = ""
let randomChallengeBox3TimerSyncInterval = null

function startRandomChallengeBox3TimerSessionSync() {
  if (randomChallengeBox3TimerSyncInterval) return

  randomChallengeBox3TimerSyncInterval = setInterval(() => {
    if (typeof randomChallengeState === "undefined") return

    const activeSegment = normalizeDisplaySegmentKey(
      localStorage.getItem("active_segment") || ""
    )

    if (activeSegment !== "randomChallenge") return
    if (Number(randomChallengeState.currentBox || 0) !== 3) return

    const timer = Number(randomChallengeState.box3?.timer || 0)
    const activeTeam = randomChallengeState.box3?.activeTeam || randomChallengeState.activeTeam || ""
    const errorsA = Number(randomChallengeState.box3?.errors?.A || 0)
    const errorsB = Number(randomChallengeState.box3?.errors?.B || 0)
    const choosingPoints = randomChallengeState.box3?.choosingPoints ? "1" : "0"

    const key = `${timer}_${activeTeam}_${errorsA}_${errorsB}_${choosingPoints}`

    if (key === randomChallengeBox3TimerLastSyncKey) return

    randomChallengeBox3TimerLastSyncKey = key

    if (typeof syncDisplayStateToSession === "function") {
      syncDisplayStateToSession()
    }
  }, 450)
}

/* =========================
   HANDLE COMMANDS
========================= */

function getPresenterCommandKey(cmd) {
  const payload = cmd?.payload || {}

  if (payload.__client_command_id) {
    return "client_" + payload.__client_command_id
  }

  if (cmd.id) {
    return "db_" + cmd.id
  }

  return [
    cmd.session_id || "",
    cmd.segment || "",
    cmd.action || "",
    JSON.stringify(cmd.payload || {}),
    cmd.created_at || ""
  ].join("_")
}

function handlePresenterCommandOnce(cmd, source = "unknown") {
  const key = getPresenterCommandKey(cmd)

  if (handledPresenterCommandKeys.has(key)) {
    return
  }

  handledPresenterCommandKeys.add(key)

  if (handledPresenterCommandKeys.size > 80) {
    handledPresenterCommandKeys = new Set(
      Array.from(handledPresenterCommandKeys).slice(-40)
    )
  }

  if (cmd.id) {
    lastPresenterCommandId = cmd.id
  }

  console.log("Presenter command source:", source)

  handlePresenterCommand(cmd)
}

function handlePresenterCommand(cmd) {
  const segment = normalizeDisplaySegmentKey(cmd.segment)
  const action = cmd.action
  const data = { ...(cmd.payload || {}) }

  delete data.__client_command_id

  console.log("Handle presenter command:", segment, action, data)

  if (action === "openSegment") {
  return safeRunPresenterAction(() => {
    const segmentKey = String(data.segment || "")
    const isFinalSegment =
      segmentKey === "final" ||
      segmentKey === "final_round1" ||
      segmentKey === "final_round2" ||
      segmentKey === "final_round3" ||
      segmentKey === "final_round4" ||
      segmentKey === "finalRound1" ||
      segmentKey === "finalRound2" ||
      segmentKey === "finalRound3" ||
      segmentKey === "finalRound4"

    if (isFinalSegment) {
      const round =
        segmentKey === "final_round1" || segmentKey === "finalRound1" ? 1 :
        segmentKey === "final_round2" || segmentKey === "finalRound2" ? 2 :
        segmentKey === "final_round3" || segmentKey === "finalRound3" ? 3 :
        segmentKey === "final_round4" || segmentKey === "finalRound4" ? 4 :
        Number(data.round || 1)

      forceDisplayFinalRoundFromPresenter(round)
      return
    }

    openSegmentPage(data.segment)
  })
}

  if (action === "hideDisplayControls") {
    return safeRunPresenterAction(hideDisplayControls)
  }

  if (action === "showDisplayControls") {
    return safeRunPresenterAction(showDisplayControls)
  }

  if (action === "toggleDisplayControls") {
    return safeRunPresenterAction(() => {
      if (document.body.classList.contains("presenterHideDisplayControls")) {
        showDisplayControls()
      } else {
        hideDisplayControls()
      }
    })
  }
if (action === "zoomImage") {
  return safeRunPresenterAction(() => {
    if (segment === "auction") {
      if (typeof zoomCurrentDisplayImage === "function") {
        zoomCurrentDisplayImage()
      }

      return
    }

    const isFinalSegment =
      segment === "final" ||
      isFinalSegmentKey(segment)

    if (
      isFinalSegment &&
      window.finalState?.round === 4 &&
      window.finalState?.round4?.teamMedia?.currentMedia
    ) {
      const type =
        window.finalState.round4.teamMedia.currentMediaType === "video"
          ? "video"
          : "image"

      if (typeof openFinalRound4TeamMediaOverlay === "function") {
        openFinalRound4TeamMediaOverlay(type)
      }

      return
    }

    if (
      isFinalSegment &&
      window.finalState?.round === 1 &&
      Number(window.finalState?.round1?.currentNumber || 0)
    ) {
      if (typeof toggleFinalRound1Overlay === "function") {
        toggleFinalRound1Overlay()
      }

      return
    }

    if (
      isFinalSegment &&
      window.finalState?.round === 2 &&
      window.finalState?.round2?.currentType === "image"
    ) {
      if (typeof toggleFinalRound2ImageOverlay === "function") {
        toggleFinalRound2ImageOverlay()
      }

      return
    }

    if (typeof zoomCurrentDisplayImage === "function") {
      zoomCurrentDisplayImage()
    }
  })
}

if (action === "closeZoomImage") {
  return safeRunPresenterAction(() => {
    if (typeof closeCurrentDisplayImageZoom === "function") {
      closeCurrentDisplayImageZoom()
    }

    if (typeof closeFinalRound2ImageAutoOverlay === "function") {
      closeFinalRound2ImageAutoOverlay()
    }

    if (typeof closeFinalRound4TeamMediaOverlay === "function") {
      closeFinalRound4TeamMediaOverlay()
    }

    const overlayIds = [
      "displayImageZoomOverlay",
      "auctionImageOverlay",
      "auctionVideoFullscreenOverlay",
      "whoImageOverlay",

      "finalRound1Overlay",
      "finalRound1ImageOverlay",

      "finalRound2ImageOverlay",
      "finalRound2ImageAutoOverlay",

      "finalRound3ImageOverlay",
      "finalRound3TeamMediaOverlay",

      "finalRound4TeamMediaOverlay"
    ]

    overlayIds.forEach(id => {
      document.getElementById(id)?.remove()
    })

    document.body.classList.remove(
      "auctionOverlayActive",
      "finalRound1OverlayActive",
      "displayImageZoomActive",
      "imageZoomActive",
      "finalImageZoomActive",
      "finalOverlayActive"
    )
  })
}

if (action === "selectTeam") {
  if (!isValidPresenterTeam(data.team)) return

  if (segment === "warmup") {
    return handleWarmupPresenterAction(action, data)
  }

  if (segment === "top10") {
    return handleTop10PresenterAction(action, data)
  }

  if (segment === "auction") {
    return handleAuctionPresenterAction(action, data)
  }

  if (segment === "who") {
    return handleWhoPresenterAction(action, data)
  }

  if (segment === "explain") {
    return handleExplainPresenterAction(action, data)
  }

  if (
    segment === "final" ||
    isFinalSegmentKey(segment)
  ) {
    if (!data.round) {
      data.round =
        getFinalRoundFromSegmentKey(segment) ||
        window.finalState?.round ||
        1
    }

    return handleFinalPresenterAction(action, data)
  }

  if (segment === "archive") {
    return handleArchivePresenterAction(action, data)
  }

  if (segment === "randomChallenge") {
    return handleRandomChallengePresenterAction(action, data)
  }

  return safeRunPresenterAction(() => {
    if (typeof selectDisplayTeamByPresenter === "function") {
      selectDisplayTeamByPresenter(data.team, data)
    }
  })
}

  if (action === "endSegment") {
  return safeRunPresenterAction(() => {
    if (typeof clearGameActiveTeam === "function") {
      clearGameActiveTeam()
    }

    endCurrentSegment()
  })
}

if (action === "goHome") {
  return safeRunPresenterAction(() => {
    if (typeof clearGameActiveTeam === "function") {
      clearGameActiveTeam()
    }

    goHome()
  })
}

  if (segment === "warmup") return handleWarmupPresenterAction(action, data)
  if (segment === "top10") return handleTop10PresenterAction(action, data)
  if (segment === "auction") return handleAuctionPresenterAction(action, data)
  if (segment === "who") return handleWhoPresenterAction(action, data)
  if (segment === "explain") return handleExplainPresenterAction(action, data)
  if (segment === "final" || isFinalSegmentKey(segment)) {
  if (!data.round) {
    data.round = getFinalRoundFromSegmentKey(segment) || window.finalState?.round || 1
  }

  return handleFinalPresenterAction(action, data)
}
  if (segment === "archive") return handleArchivePresenterAction(action, data)
if (segment === "randomChallenge") return handleRandomChallengePresenterAction(action, data)
}

/* =========================
   WARMUP
========================= */

function handleWarmupPresenterAction(action, data) {
  if (action === "selectTeam") {
  if (!isValidPresenterTeam(data.team)) return

  return safeRunPresenterAction(() => {
    applyPresenterActiveTeam(data.team)

    if (
      typeof forceWarmupTeamFromPresenter ===
      "function"
    ) {
      forceWarmupTeamFromPresenter(data.team)
      return
    }

    selectWarmupTeam(data.team, {
      force: true
    })
  })
}

  if (action === "openNumber") {
    return safeRunPresenterAction(() => {
      openWarmupQuestion(Number(data.category), Number(data.number))
    })
  }

  if (action === "double") {
    return safeRunPresenterAction(() => activateWarmupDouble())
  }

  if (action === "correct") {
    return safeRunPresenterAction(() => warmupCorrect())
  }

  if (action === "wrong") {
    return safeRunPresenterAction(() => warmupWrong())
  }
}

/* =========================
   TOP 10
========================= */

function syncAfterTop10PresenterAction(
  options = {}
) {
  if (
    typeof renderCurrentRoundTop10UI ===
    "function"
  ) {
    renderCurrentRoundTop10UI()
  }

  if (
    typeof saveTop10State ===
    "function"
  ) {
    saveTop10State({
      immediate:
        options.immediate === true
    })

    return
  }

  if (
    typeof syncDisplayStateToSession ===
    "function"
  ) {
    syncDisplayStateToSession({
      immediate:
        options.immediate === true
    })
  }
}

function forceTop10PresenterTeam(team) {
  if (!isValidPresenterTeam(team)) {
    return false
  }

  if (
    typeof forceTop10TeamFromPresenter ===
    "function"
  ) {
    return forceTop10TeamFromPresenter(
      team
    )
  }

  if (
    typeof selectTop10Team ===
    "function"
  ) {
    return selectTop10Team(team, {
      force: true,
      sync: true
    })
  }

  if (
    typeof top10State !==
    "undefined"
  ) {
    top10State.activeTeam = team
  }

  window.selectedTeam = team

  if (
    typeof setGameActiveTeam ===
    "function"
  ) {
    setGameActiveTeam(team)
  }

  return true
}

function handleTop10PresenterAction(
  action,
  data = {}
) {
  if (action === "selectTeam") {
    if (
      !isValidPresenterTeam(data.team)
    ) {
      return
    }

    return safeRunPresenterAction(() => {
      forceTop10PresenterTeam(
        data.team
      )
    })
  }

  if (action === "openNumber") {
    return safeRunPresenterAction(
      async () => {
        const number = Number(
          data.number || 0
        )

        if (
          !number ||
          number < 1 ||
          number > 10
        ) {
          return
        }

        if (
          isValidPresenterTeam(data.team)
        ) {
          forceTop10PresenterTeam(
            data.team
          )
        }

        if (
          typeof openTop10Number !==
          "function"
        ) {
          console.log(
            "openTop10Number not ready"
          )

          return
        }

        await openTop10Number(number)
      }
    )
  }

  if (action === "double") {
    return safeRunPresenterAction(() => {
      if (
        typeof activateTop10Double !==
        "function"
      ) {
        console.log(
          "activateTop10Double not ready"
        )

        return
      }

      activateTop10Double()
    })
  }

  if (action === "showAnswer") {
    return safeRunPresenterAction(
      async () => {
        if (
          typeof showTop10Answer !==
          "function"
        ) {
          console.log(
            "showTop10Answer not ready"
          )

          return
        }

        await showTop10Answer()
      }
    )
  }

  if (action === "wrong") {
    return safeRunPresenterAction(() => {
      if (
        typeof addTop10Error !==
        "function"
      ) {
        console.log(
          "addTop10Error not ready"
        )

        return
      }

      addTop10Error()
    })
  }

  if (action === "undo") {
    return safeRunPresenterAction(() => {
      if (
        typeof undoTop10Action !==
        "function"
      ) {
        console.log(
          "undoTop10Action not ready"
        )

        return
      }

      undoTop10Action()
    })
  }

  if (action === "switchTurn") {
    return safeRunPresenterAction(() => {
      if (
        typeof switchTop10Turn !==
        "function"
      ) {
        console.log(
          "switchTop10Turn not ready"
        )

        return
      }

      switchTop10Turn()
    })
  }

  if (action === "nextRound") {
    return safeRunPresenterAction(
      async () => {
        if (
          typeof nextTop10Round !==
          "function"
        ) {
          console.log(
            "nextTop10Round not ready"
          )

          return
        }

        await nextTop10Round()
      }
    )
  }

  if (action === "setRound") {
    return safeRunPresenterAction(
      async () => {
        if (
          typeof top10State ===
          "undefined"
        ) {
          return
        }

        const maxRound = Math.min(
          Math.max(
            Number(
              window.top10MaxRound || 3
            ),
            1
          ),
          4
        )

        const round = Math.min(
          Math.max(
            Number(data.round || 1),
            1
          ),
          maxRound
        )

        if (
          Number(top10State.round) ===
          round
        ) {
          renderCurrentRoundTop10UI?.()
          return
        }

        if (
          typeof stopTop10Timer ===
          "function"
        ) {
          stopTop10Timer(0, {
            save: false
          })
        }

        top10State.round = round
        top10State.activeTeam = null
        top10State.lastTeam = null

        if (
          typeof currentTop10Answer !==
          "undefined"
        ) {
          currentTop10Answer = null
        }

        if (
          typeof currentTop10Number !==
          "undefined"
        ) {
          currentTop10Number = null
        }

        if (
          typeof top10TimerStarted !==
          "undefined"
        ) {
          top10TimerStarted = false
        }

        if (
          typeof top10AnimatingNumber !==
          "undefined"
        ) {
          top10AnimatingNumber = null
        }

        if (
          typeof top10DoubleState !==
          "undefined"
        ) {
          top10DoubleState.activeTeam =
            null
        }

        if (
          typeof setTop10ActiveTeam ===
          "function"
        ) {
          setTop10ActiveTeam(null, {
            sync: false,
            save: false
          })
        }

        if (
          typeof loadTop10RoundQuestion ===
          "function"
        ) {
          await loadTop10RoundQuestion(
            round
          )
        }

        syncAfterTop10PresenterAction({
          immediate: true
        })
      }
    )
  }
}
/* =========================
   AUCTION
========================= */

function handleAuctionPresenterAction(action, data) {
  if (action === "selectTeam") {
  if (!isValidPresenterTeam(data.team)) return

  return safeRunPresenterAction(() => {
    applyPresenterActiveTeam(data.team)
    selectAuctionTeam(data.team)
  })
}

  if (action === "openNumber") {
    return safeRunPresenterAction(() => openAuction(Number(data.number)))
  }

  if (action === "double") {
    return safeRunPresenterAction(() => activateAuctionDouble())
  }

  if (action === "correct") {
    return safeRunPresenterAction(() => {
      auctionCorrect()
    })
  }

  if (action === "wrong") {
    return safeRunPresenterAction(() => {
      auctionWrong()
    })
  }

  /* تشغيل فيديو الفتبلة من المقدم */
  if (action === "playAuctionVideo") {
    return safeRunPresenterAction(() => {
      if (typeof playCurrentAuctionVideo === "function") {
        playCurrentAuctionVideo()
        return
      }

      if (typeof openAuctionVideoFullscreen === "function") {
        openAuctionVideoFullscreen()
      }
    })
  }

  if (action === "restartAuctionVideo") {
    return safeRunPresenterAction(() => {
      if (typeof restartCurrentAuctionVideo === "function") {
        restartCurrentAuctionVideo()
        return
      }

      if (typeof closeAuctionVideoFullscreen === "function") {
        closeAuctionVideoFullscreen()
      }

      if (typeof openAuctionVideoFullscreen === "function") {
        setTimeout(() => {
          openAuctionVideoFullscreen()
        }, 80)
      }
    })
  }

  if (action === "stopAuctionVideo") {
    return safeRunPresenterAction(() => {
      if (typeof stopCurrentAuctionVideo === "function") {
        stopCurrentAuctionVideo()
        return
      }

      if (typeof closeAuctionVideoFullscreen === "function") {
        closeAuctionVideoFullscreen()
      }
    })
  }

  if (action === "undo") {
    return safeRunPresenterAction(() => {
      if (typeof closeAuctionZoomOverlays === "function") {
        closeAuctionZoomOverlays()
      } else if (typeof closeCurrentDisplayImageZoom === "function") {
        closeCurrentDisplayImageZoom()
      }

      undoAuctionAction()
    })
  }
}
/* =========================
   WHO
========================= */

let displayWhoHandledScoreKeys = new Set()

function getDisplayWhoScoreKey(action, data = {}) {
  if (data.__who_score_key) {
    return String(data.__who_score_key)
  }

  const number =
    Number(window.whoCurrentNumber || 0) ||
    Number(window.whoState?.currentNumber || 0)

  const points =
    Number(
      window.whoState?.currentPoints || 0
    )

  const team =
    window.whoState?.activeTeam || ""

  return `${action}_${number}_${team}_${points}`
}

function runDisplayWhoScoreOnce(
  action,
  data,
  fn
) {
  const key =
    getDisplayWhoScoreKey(
      action,
      data
    )

  if (
    !key ||
    key === `${action}_0__0`
  ) {
    return
  }

  if (
    displayWhoHandledScoreKeys.has(
      key
    )
  ) {
    return
  }

  displayWhoHandledScoreKeys.add(
    key
  )

  if (
    displayWhoHandledScoreKeys.size >
    40
  ) {
    displayWhoHandledScoreKeys =
      new Set(
        Array.from(
          displayWhoHandledScoreKeys
        ).slice(-20)
      )
  }

  if (typeof fn === "function") {
    fn()
  }
}

function handleWhoPresenterAction(
  action,
  data = {}
) {
  if (action === "selectTeam") {
    if (
      !isValidPresenterTeam(
        data.team
      )
    ) {
      return
    }

    return safeRunPresenterAction(
      () => {
        if (
          typeof forceWhoTeamFromPresenter ===
          "function"
        ) {
          forceWhoTeamFromPresenter(
            data.team
          )

          return
        }

        if (
          typeof selectWhoTeam ===
          "function"
        ) {
          selectWhoTeam(
            data.team,
            {
              force: true,
              sync: true
            }
          )
        }
      }
    )
  }

  if (action === "setPoints") {
    return safeRunPresenterAction(
      () => {
        const points =
          Number(data.points || 0)

        if (
          !Number.isFinite(points) ||
          points < 1 ||
          points > 5
        ) {
          return
        }

        if (
          typeof setWhoPoints ===
          "function"
        ) {
          setWhoPoints(points)
        }
      }
    )
  }

  if (action === "openNumber") {
    return safeRunPresenterAction(
      () => {
        const number =
          Number(data.number || 0)

        if (
          !Number.isFinite(number) ||
          number < 1
        ) {
          return
        }

        displayWhoHandledScoreKeys.clear()

        const openNumber = () => {
          if (
            typeof chooseWho ===
            "function"
          ) {
            chooseWho(number)
          }
        }

        if (
          isValidPresenterTeam(
            data.team
          )
        ) {
          if (
            typeof forceWhoTeamFromPresenter ===
            "function"
          ) {
            forceWhoTeamFromPresenter(
              data.team
            )
          } else if (
            typeof selectWhoTeam ===
            "function"
          ) {
            selectWhoTeam(
              data.team,
              {
                force: true,
                sync: true
              }
            )
          }

          setTimeout(
            openNumber,
            50
          )

          return
        }

        openNumber()
      }
    )
  }

  if (action === "double") {
    return safeRunPresenterAction(
      () => {
        if (
          isValidPresenterTeam(
            data.team
          )
        ) {
          if (
            typeof forceWhoTeamFromPresenter ===
            "function"
          ) {
            forceWhoTeamFromPresenter(
              data.team
            )
          }
        }

        if (
          typeof activateWhoDouble ===
          "function"
        ) {
          activateWhoDouble()
        }
      }
    )
  }

  if (action === "compensation") {
    return safeRunPresenterAction(
      () => {
        displayWhoHandledScoreKeys.clear()

        if (
          typeof startWhoCompensation ===
          "function"
        ) {
          startWhoCompensation()
        }
      }
    )
  }

  if (action === "correct") {
    return safeRunPresenterAction(
      () => {
        if (
          isValidPresenterTeam(
            data.team
          ) &&
          window.whoState
            ?.activeTeam !==
            data.team
        ) {
          if (
            typeof forceWhoTeamFromPresenter ===
            "function"
          ) {
            forceWhoTeamFromPresenter(
              data.team
            )
          }
        }

        runDisplayWhoScoreOnce(
          "correct",
          data,
          () => {
            if (
              typeof whoCorrect ===
              "function"
            ) {
              whoCorrect()
            }
          }
        )
      }
    )
  }

  if (action === "wrong") {
    return safeRunPresenterAction(
      () => {
        if (
          isValidPresenterTeam(
            data.team
          ) &&
          window.whoState
            ?.activeTeam !==
            data.team
        ) {
          if (
            typeof forceWhoTeamFromPresenter ===
            "function"
          ) {
            forceWhoTeamFromPresenter(
              data.team
            )
          }
        }

        runDisplayWhoScoreOnce(
          "wrong",
          data,
          () => {
            if (
              typeof whoWrong ===
              "function"
            ) {
              whoWrong()
            }
          }
        )
      }
    )
  }
}
/* =========================
   EXPLAIN WORD
========================= */

let displayExplainHandledScoreKeys = new Set()

function getDisplayExplainScoreKey(action) {
  const number = Number(
    window.explainState?.currentNumber || 0
  )

  const team =
    window.explainState?.currentTeam || ""

  const word =
    window.explainState?.currentWord || ""

  if (!number || !team) return ""

  return `${action}_${number}_${team}_${word}`
}

function runDisplayExplainScoreOnce(
  action,
  fn
) {
  const key =
    getDisplayExplainScoreKey(action)

  if (!key) return false

  if (
    displayExplainHandledScoreKeys.has(key)
  ) {
    return false
  }

  displayExplainHandledScoreKeys.add(key)

  if (
    displayExplainHandledScoreKeys.size >
    40
  ) {
    displayExplainHandledScoreKeys =
      new Set(
        Array.from(
          displayExplainHandledScoreKeys
        ).slice(-20)
      )
  }

  if (typeof fn === "function") {
    fn()
  }

  return true
}

function syncAfterExplainAction(
  options = {}
) {
  if (
    typeof saveExplainState ===
    "function"
  ) {
    saveExplainState(options)
    return
  }

  if (
    typeof syncDisplayStateToSession ===
    "function"
  ) {
    syncDisplayStateToSession({
      immediate:
        options.immediate === true
    })
  }
}

function forceExplainPresenterTeam(team) {
  if (!isValidPresenterTeam(team)) {
    return false
  }

  if (
    typeof forceExplainTeamFromPresenter ===
    "function"
  ) {
    return forceExplainTeamFromPresenter(
      team
    )
  }

  if (
    typeof selectExplainTeam ===
    "function"
  ) {
    return selectExplainTeam(team, {
      force: true,
      sync: true
    })
  }

  if (
    window.explainState
  ) {
    window.explainState.currentTeam =
      team
  }

  window.selectedTeam = team

  if (
    typeof selectedTeam !==
    "undefined"
  ) {
    selectedTeam = team
  }

  if (
    typeof setGameActiveTeam ===
    "function"
  ) {
    setGameActiveTeam(team)
  }

  return true
}

function handleExplainPresenterAction(
  action,
  data = {}
) {
  if (action === "selectTeam") {
    if (
      !isValidPresenterTeam(data.team)
    ) {
      return
    }

    return safeRunPresenterAction(() => {
      forceExplainPresenterTeam(
        data.team
      )

      syncAfterExplainAction({
        immediate: true
      })
    })
  }

  if (action === "openNumber") {
    return safeRunPresenterAction(
      async () => {
        const number = Number(
          data.number || 0
        )

        const team =
          isValidPresenterTeam(data.team)
            ? data.team
            : window.explainState
                ?.currentTeam ||
              window.selectedTeam ||
              null

        if (!number) return

        if (team) {
          forceExplainPresenterTeam(team)
        }

        if (
          typeof openExplainNumber !==
          "function"
        ) {
          console.log(
            "openExplainNumber not ready"
          )

          return
        }

        displayExplainHandledScoreKeys.clear()

        openExplainNumber(number)

        syncAfterExplainAction({
          immediate: true
        })
      }
    )
  }

  if (
    action === "toggleWordVisible"
  ) {
    return safeRunPresenterAction(() => {
      if (
        typeof toggleExplainWordVisibility ===
        "function"
      ) {
        toggleExplainWordVisibility()
      } else if (
        typeof toggleExplainWord ===
        "function"
      ) {
        toggleExplainWord()
      } else if (
        typeof hideExplainWord ===
        "function"
      ) {
        hideExplainWord()
      } else {
        console.log(
          "Explain word toggle not ready"
        )

        return
      }

      syncAfterExplainAction({
        immediate: true
      })
    })
  }

  if (action === "startTimer") {
    return safeRunPresenterAction(() => {
      if (
        typeof startExplainTimer !==
        "function"
      ) {
        console.log(
          "startExplainTimer not ready"
        )

        return
      }

      startExplainTimer()

      syncAfterExplainAction({
        immediate: true
      })
    })
  }

  if (action === "correct") {
    return safeRunPresenterAction(() => {
      if (
        typeof correctExplainAnswer !==
        "function"
      ) {
        console.log(
          "correctExplainAnswer not ready"
        )

        return
      }

      runDisplayExplainScoreOnce(
        "correct",
        () => {
          correctExplainAnswer()

          syncAfterExplainAction({
            immediate: true
          })
        }
      )
    })
  }

  if (action === "wrong") {
    return safeRunPresenterAction(() => {
      if (
        typeof wrongExplainAnswer !==
        "function"
      ) {
        console.log(
          "wrongExplainAnswer not ready"
        )

        return
      }

      runDisplayExplainScoreOnce(
        "wrong",
        () => {
          wrongExplainAnswer()

          syncAfterExplainAction({
            immediate: true
          })
        }
      )
    })
  }
}
/* =========================
   FINAL
   استقبال أوامر الفاصلة الجديدة
========================= */

function closePresenterFinalRound1Zoom() {
  if (typeof closeCurrentDisplayImageZoom === "function") {
    closeCurrentDisplayImageZoom()
  }

  if (typeof closeFinalRound1Overlay === "function") {
    closeFinalRound1Overlay()
  }

  if (typeof closeFinalRound1ImageOverlay === "function") {
    closeFinalRound1ImageOverlay()
  }

  document
    .querySelectorAll(`
      #finalRound1Overlay,
      #finalRound1ImageOverlay,
      #displayImageZoomOverlay,
      .finalRound1Overlay,
      .finalRound1ImageOverlay,
      .displayImageZoomOverlay,
      [id*="finalRound1"][id*="Overlay"],
      [id*="FinalRound1"][id*="Overlay"],
      [class*="finalRound1"][class*="Overlay"],
      [class*="FinalRound1"][class*="Overlay"]
    `)
    .forEach(el => el.remove())

  document.body.classList.remove(
    "finalRound1OverlayActive",
    "displayImageZoomActive",
    "imageZoomActive",
    "auctionOverlayActive",
    "finalImageZoomActive",
    "finalOverlayActive"
  )
}

function forceFinalTeamFromPresenter(team) {
  if (!isValidPresenterTeam(team)) return

  applyPresenterActiveTeam(team)

  const round = Number(window.finalState?.round || 1)
  const roundKey = `round${round}`

  if (typeof selectFinalTeam === "function") {
    selectFinalTeam(team)
  }

  if (typeof selectedTeam !== "undefined") {
    selectedTeam = team
  }

  window.selectedTeam = team

  if (window.finalState) {
    window.finalState.activeTeam = team
    window.finalState.selectedTeam = team

    window.finalState[roundKey] = {
      ...(window.finalState[roundKey] || {}),
      activeTeam: team,
      selectedTeam: team
    }

    if (round === 4) {
      window.finalState.round4 = {
        ...(window.finalState.round4 || {}),
        activeTeam: team,
        selectedTeam: team,
        teamMedia: {
          ...(window.finalState.round4?.teamMedia || {}),
          currentTeam: team
        }
      }
    }
  }

  document.getElementById("teamA")?.classList.toggle("selectedTeam", team === "A")
  document.getElementById("teamB")?.classList.toggle("selectedTeam", team === "B")
  document.getElementById("teamA")?.classList.toggle("activeTeam", team === "A")
  document.getElementById("teamB")?.classList.toggle("activeTeam", team === "B")

  if (typeof saveFinalState === "function") {
    saveFinalState()
    return
  }

  if (typeof syncDisplayStateToSession === "function") {
    syncDisplayStateToSession()
  }
}

function shakeFinalRound2CountdownBox() {
  const target =
    document.querySelector(".finalRound2CountdownBox") ||
    document.querySelector(".finalRound2TimerBox") ||
    document.querySelector("#finalRound2Countdown") ||
    document.querySelector("[data-final-round2-countdown]")

  if (!target) return

  target.classList.remove("finalRound2MiniShakeFx")
  void target.offsetWidth
  target.classList.add("finalRound2MiniShakeFx")

  setTimeout(() => {
    target.classList.remove("finalRound2MiniShakeFx")
  }, 420)
}

function shakeFinalRound2HiddenWord(index) {
  const i = Number(index)

  const target =
    document.querySelector(`[data-round2-word-index="${i}"]`) ||
    document.querySelector(`[data-index="${i}"].finalRound2Word`) ||
    document.querySelector(`[data-index="${i}"].finalRound2WordCard`) ||
    document.querySelectorAll(".finalRound2WordCard, .finalRound2Word, .finalRound2SequenceWord")[i]

  if (!target) return

  target.classList.remove("finalRound2MiniShakeFx")
  void target.offsetWidth
  target.classList.add("finalRound2MiniShakeFx")

  setTimeout(() => {
    target.classList.remove("finalRound2MiniShakeFx")
  }, 420)
}

function syncAfterFinalPresenterAction() {
  if (typeof saveFinalState === "function") {
    saveFinalState()
    return
  }

  if (typeof syncDisplayStateToSession === "function") {
    syncDisplayStateToSession()
  }
}

function handleFinalPresenterAction(action, data) {
  if (action === "selectTeam") {
    if (!isValidPresenterTeam(data.team)) return

    return safeRunPresenterAction(() => {
      forceFinalTeamFromPresenter(data.team)
    })
  }

  if (action === "setRound") {
    return safeRunPresenterAction(() => {
      const round = Number(data.round || 1)
      forceDisplayFinalRoundFromPresenter(round)
    })
  }

if (action === "openNumber") {
  return safeRunPresenterAction(() => {
    const round = Number(data.round || window.finalState?.round || 1)
    const number = Number(data.number || 0)
    const team = data.team

    if (!number) return

    forceDisplayFinalRoundFromPresenter(round, () => {
      setTimeout(() => {
        const applyTeamAfterOpen = () => {
          if (isValidPresenterTeam(team)) {
            forceFinalTeamFromPresenter(team)
          }
        }

        if (round === 1) {
          openFinalRound1Card(number)

          setTimeout(() => {
            applyTeamAfterOpen()
          }, 220)

          return
        }

        if (round === 2) {
          applyTeamAfterOpen()
          openFinalRound2Card(number)
          return
        }

        if (round === 3) {
          if (typeof openFinalRound3StoryCard === "function") {
            openFinalRound3StoryCard(number)

            setTimeout(() => {
              applyTeamAfterOpen()
            }, 220)
          }

          return
        }

        if (round === 4) {
          applyTeamAfterOpen()

          if (typeof openFinalRound4TeamMediaCard === "function") {
            openFinalRound4TeamMediaCard(number)
          }
        }
      }, 120)
    })
  })
}

  if (action === "double") {
    return safeRunPresenterAction(() => activateFinalDouble())
  }

  if (action === "showQuestion") {
    return safeRunPresenterAction(() => {
      if (window.finalState?.round === 1) {
        if (typeof showFinalRound1Question === "function") {
          showFinalRound1Question()
        }
        return
      }

      if (window.finalState?.round === 4) {
        if (typeof showFinalRound4TeamMediaQuestion === "function") {
          showFinalRound4TeamMediaQuestion()
        }
      }
    })
  }

  if (action === "showStoryPart") {
    return safeRunPresenterAction(() => {
      if (window.finalState?.round !== 3) return

      if (typeof showFinalRound3StoryPart === "function") {
        showFinalRound3StoryPart()
      }
    })
  }

  if (action === "decreaseCountdown") {
  return safeRunPresenterAction(() => {
    if (window.finalState?.round !== 2) return

    if (typeof finalRound2DecreaseCountdown === "function") {
      finalRound2DecreaseCountdown()
    }
  })
}

  if (action === "showNextImage") {
    return safeRunPresenterAction(() => {
      if (window.finalState?.round !== 2) return

      if (typeof finalRound2ShowNextImage === "function") {
        finalRound2ShowNextImage()
      }
    })
  }



if (action === "toggleRound2Correct") {
  return safeRunPresenterAction(() => {
    if (window.finalState?.round !== 2) return

    const index = Number(data.index)

    if (!Number.isFinite(index) || index < 0) {
      return
    }

    if (
      typeof finalRound2ToggleCorrectFromPresenter ===
      "function"
    ) {
      finalRound2ToggleCorrectFromPresenter(index)
      return
    }

    const round2 = window.finalState?.round2
    if (!round2) return

    const oldSelected = Array.isArray(
      round2.selectedCorrectIndexes
    )
      ? round2.selectedCorrectIndexes.map(Number)
      : []

    const nextSelected = Array.isArray(
      data.selectedCorrectIndexes
    )
      ? data.selectedCorrectIndexes
          .map(Number)
          .filter(
            value =>
              Number.isFinite(value) &&
              value >= 0
          )
      : oldSelected.includes(index)
        ? oldSelected.filter(
            value => value !== index
          )
        : [...oldSelected, index]

    round2.selectedCorrectIndexes =
      nextSelected

    round2.correctCount =
      nextSelected.length

    if (
      typeof renderFinalRound2Words ===
      "function"
    ) {
      renderFinalRound2Words(
        !!round2.answerShown
      )
    }

    if (
      typeof renderFinalRoundTitle ===
      "function"
    ) {
      renderFinalRoundTitle()
    }

    syncAfterFinalPresenterAction()
  })
}

if (action === "toggleRound2ImageCorrect") {
  return safeRunPresenterAction(() => {
    if (window.finalState?.round !== 2) return

    const index = Number(data.index)

    if (!Number.isFinite(index) || index < 0) {
      return
    }

    if (
      typeof toggleFinalRound2ImageCorrectSelection ===
      "function"
    ) {
      toggleFinalRound2ImageCorrectSelection(
        index
      )
      return
    }

    const round2 = window.finalState?.round2
    if (!round2) return

    const oldSelected = Array.isArray(
      round2.selectedCorrectIndexes
    )
      ? round2.selectedCorrectIndexes.map(Number)
      : []

    const nextSelected = Array.isArray(
      data.selectedCorrectIndexes
    )
      ? data.selectedCorrectIndexes
          .map(Number)
          .filter(
            value =>
              Number.isFinite(value) &&
              value >= 0
          )
      : oldSelected.includes(index)
        ? oldSelected.filter(
            value => value !== index
          )
        : [...oldSelected, index]

    round2.selectedCorrectIndexes =
      nextSelected

    round2.correctCount =
      nextSelected.length

    if (
      typeof renderFinalRound2Words ===
      "function"
    ) {
      renderFinalRound2Words(false)
    }

    if (
      typeof renderFinalRoundTitle ===
      "function"
    ) {
      renderFinalRoundTitle()
    }

    syncAfterFinalPresenterAction()
  })
}
  if (action === "hideRound2SequenceWord") {
  return safeRunPresenterAction(() => {
    if (window.finalState?.round !== 2) return

    if (typeof hideFinalRound2SequenceWord === "function") {
      hideFinalRound2SequenceWord(Number(data.index))
    }
  })
}

  if (action === "recordScrambleScore") {
    return safeRunPresenterAction(() => {
      if (window.finalState?.round !== 2) return

      if (typeof finalRound2RecordScore === "function") {
        finalRound2RecordScore()
      }
    })
  }

  if (action === "recordSequenceScore") {
    return safeRunPresenterAction(() => {
      if (window.finalState?.round !== 2) return

      if (typeof finalRound2RecordSequenceScore === "function") {
        finalRound2RecordSequenceScore()
      }
    })
  }

  if (action === "recordImageScore") {
    return safeRunPresenterAction(() => {
      if (window.finalState?.round !== 2) return

      if (typeof finalRound2RecordImageScore === "function") {
        finalRound2RecordImageScore()
      }
    })
  }

  if (action === "playCurrentFinalVideo") {
    return safeRunPresenterAction(() => {
      if (typeof playCurrentFinalVideo === "function") {
        playCurrentFinalVideo()
        return
      }

      if (typeof playFinalRound4TeamMediaVideo === "function") {
        playFinalRound4TeamMediaVideo()
      }
    })
  }

  if (action === "restartCurrentFinalVideo") {
    return safeRunPresenterAction(() => {
      if (typeof restartCurrentFinalVideo === "function") {
        restartCurrentFinalVideo()
        return
      }

      if (typeof restartFinalRound4TeamMediaVideo === "function") {
        restartFinalRound4TeamMediaVideo()
      }
    })
  }

  if (action === "restartCurrentFinalImage") {
    return safeRunPresenterAction(() => {
      if (typeof restartFinalRound4TeamMediaImage === "function") {
        restartFinalRound4TeamMediaImage()
      }
    })
  }

  if (action === "stopCurrentFinalVideo") {
    return safeRunPresenterAction(() => {
      if (typeof stopCurrentFinalVideo === "function") {
        stopCurrentFinalVideo()
        return
      }

      const overlayVideo = document.getElementById("finalRound4TeamMediaOverlayVideo")
      const inlineVideo = document.getElementById("finalRound4TeamMediaInlineVideo")

      ;[overlayVideo, inlineVideo].forEach(video => {
        if (!video) return

        try {
          video.pause()
          video.currentTime = 0
        } catch (e) {
          console.log("STOP FINAL VIDEO ERROR:", e)
        }
      })
    })
  }

  if (action === "finalWrongVideoOnly") {
    return safeRunPresenterAction(() => {
      if (typeof finalWrongVideoOnly === "function") {
        finalWrongVideoOnly()
      }
    })
  }

if (action === "correct") {
  return safeRunPresenterAction(() => {
    const round = Number(window.finalState?.round || 1)

    const team = data.team || null

if ((round === 1 || round === 3) && isValidPresenterTeam(team)) {
  forceFinalTeamFromPresenter(team)
}

    if (round === 1) {
  closePresenterFinalRound1Zoom()

  setTimeout(() => {
    closePresenterFinalRound1Zoom()
  }, 40)

  if (typeof finalRound1Correct === "function") {
    finalRound1Correct()
  }

  setTimeout(() => {
    closePresenterFinalRound1Zoom()
  }, 160)

  setTimeout(() => {
    closePresenterFinalRound1Zoom()
  }, 320)

  return
}

    if (round === 2) {
      const type =
        window.finalState?.round2?.currentType ||
        (
          Number(window.finalState?.round2?.currentNumber || 0) === 1 ||
          Number(window.finalState?.round2?.currentNumber || 0) === 4
            ? "scramble"
            : Number(window.finalState?.round2?.currentNumber || 0) === 2 ||
              Number(window.finalState?.round2?.currentNumber || 0) === 5
                ? "sequence"
                : Number(window.finalState?.round2?.currentNumber || 0) === 3 ||
                  Number(window.finalState?.round2?.currentNumber || 0) === 6
                    ? "image"
                    : ""
        )

      if (type === "scramble") {
        if (typeof finalRound2RecordScore === "function") {
          finalRound2RecordScore()
        }
        return
      }

      if (type === "sequence") {
        if (typeof finalRound2RecordSequenceScore === "function") {
          finalRound2RecordSequenceScore()
        }
        return
      }

      if (type === "image") {
        if (typeof finalRound2RecordImageScore === "function") {
          finalRound2RecordImageScore()
        }
        return
      }

      return
    }

    if (round === 3) {
      if (typeof finalRound3StoryCorrect === "function") {
        finalRound3StoryCorrect()
      }
      return
    }

    if (round === 4) {
      if (typeof finalRound4TeamMediaCorrect === "function") {
        finalRound4TeamMediaCorrect()
      }
    }
  })
}

  if (action === "wrong") {
    return safeRunPresenterAction(() => {
      const round = Number(window.finalState?.round || 1)

      if (round === 1) {
        finalRound1Wrong()
        return
      }

      if (round === 3) {
        if (typeof finalRound3StoryWrong === "function") {
          finalRound3StoryWrong()
        }
        return
      }

      if (round === 4) {
        if (typeof finalRound4TeamMediaWrong === "function") {
          finalRound4TeamMediaWrong()
        }
      }
    })
  }

  if (action === "undo") {
    return safeRunPresenterAction(() => {
      if (typeof undoFinalAction === "function") {
        undoFinalAction()
      }
    })
  }

  if (action === "nextRound") {
    return safeRunPresenterAction(() => {
      const nextRound = Number(window.finalState?.round || 1) + 1

      if (nextRound > 4) return

      forceDisplayFinalRoundFromPresenter(nextRound)
    })
  }
}

/* =========================
   ARCHIVE
========================= */

function handleArchivePresenterAction(action, data) {
  if (action === "selectTeam") {
    if (!isValidPresenterTeam(data.team)) return
    return safeRunPresenterAction(() => selectArchiveTeam(data.team))
  }

  if (action === "openNumber") {
    return safeRunPresenterAction(() => toggleArchiveItem(Number(data.number)))
  }

  if (action === "setRound") {
    return safeRunPresenterAction(() => {
      archiveState.round = Number(data.round || 1)
      renderArchiveRoundUI()
      saveArchiveState()
    })
  }

  if (action === "double") {
    return safeRunPresenterAction(() => activateArchiveDouble())
  }

  if (action === "startTimer") {
    return safeRunPresenterAction(() => startArchiveTimer())
  }

  if (action === "showAnswer") {
    return safeRunPresenterAction(() => showArchiveAnswer())
  }

  if (action === "wrong") {
    return safeRunPresenterAction(() => addArchiveError())
  }

  if (action === "undo") {
    return safeRunPresenterAction(() => undoArchiveAction())
  }

  if (action === "nextRound") {
    return safeRunPresenterAction(() => nextArchiveRound())
  }
}

/* =========================
   RANDOM CHALLENGE
========================= */

function syncAfterRandomChallengeAction() {
  if (typeof saveRandomChallengeState === "function") {
    saveRandomChallengeState()
  }

  if (typeof renderRandomChallengeScores === "function") {
    renderRandomChallengeScores()
  }

  if (typeof renderRandomChallengeStage === "function") {
    renderRandomChallengeStage()
  }

  if (typeof renderRandomChallengeControls === "function") {
    renderRandomChallengeControls()
  }

  if (typeof syncDisplayStateToSession === "function") {
    syncDisplayStateToSession()
  }
}

function forceRandomChallengeTeamFromPresenter(team) {
  if (!isValidPresenterTeam(team)) return

  if (typeof randomChallengeState !== "undefined") {
    randomChallengeState.activeTeam = team

    if (!randomChallengeState.box3) {
      randomChallengeState.box3 = {}
    }

    if (Number(randomChallengeState.currentBox || 0) === 3) {
      randomChallengeState.box3.activeTeam = team
    }
  }

  if (typeof selectRandomChallengeTeam === "function") {
    selectRandomChallengeTeam(team)
  }

  if (typeof highlightRandomChallengeTeam === "function") {
    highlightRandomChallengeTeam(team)
  }

  syncAfterRandomChallengeAction()
}

function ensureRandomChallengeBoxState(box) {
  const n = Number(box || 0)
  if (!n) return

  if (typeof randomChallengeState === "undefined") return

  randomChallengeState.currentBox = n
  randomChallengeState.activeTeam = null

  if (!randomChallengeState.box1) randomChallengeState.box1 = {}
  if (!randomChallengeState.box2) randomChallengeState.box2 = {}
  if (!randomChallengeState.box3) randomChallengeState.box3 = {}
  if (!randomChallengeState.box4) randomChallengeState.box4 = {}

  randomChallengeState.box1.active = n === 1
  randomChallengeState.box2.active = n === 2
  randomChallengeState.box3.active = n === 3
  randomChallengeState.box4.active = n === 4
}

function handleRandomChallengePresenterAction(action, data) {
  if (action === "selectTeam") {
    if (!isValidPresenterTeam(data.team)) return

    return safeRunPresenterAction(() => {
      forceRandomChallengeTeamFromPresenter(data.team)
    })
  }

  if (action === "randomOpenBox") {
    return safeRunPresenterAction(() => {
      const box = Number(data.box || 0)
      if (!box) return

      ensureRandomChallengeBoxState(box)

      if (typeof openRandomChallengeBox === "function") {
        openRandomChallengeBox(box)
      }

      setTimeout(() => {
        ensureRandomChallengeBoxState(box)
        syncAfterRandomChallengeAction()
      }, 80)
    })
  }

  if (action === "randomStartBox1") {
    return safeRunPresenterAction(() => {
      const pool = data.pool === "world" ? "world" : "saudi"

      ensureRandomChallengeBoxState(1)

      if (typeof randomChallengeState !== "undefined") {
        if (!randomChallengeState.box1) randomChallengeState.box1 = {}

        randomChallengeState.currentBox = 1
        randomChallengeState.box1.active = true
        randomChallengeState.box1.pool = pool
        randomChallengeState.box1.started = true
        randomChallengeState.box1.rolling = true
      }

      if (typeof startRandomChallengeBox1 === "function") {
        startRandomChallengeBox1(pool)
      }

      setTimeout(() => {
        ensureRandomChallengeBoxState(1)
        syncAfterRandomChallengeAction()
      }, 120)
    })
  }

  if (action === "randomSkip") {
    return safeRunPresenterAction(() => {
      ensureRandomChallengeBoxState(1)

      const pool =
        data.pool === "world" || randomChallengeState?.box1?.pool === "world"
          ? "world"
          : "saudi"

      if (typeof startRandomChallengeBox1 === "function") {
        startRandomChallengeBox1(pool)
      }

      setTimeout(() => {
        ensureRandomChallengeBoxState(1)
        syncAfterRandomChallengeAction()
      }, 120)
    })
  }

if (action === "randomSetAuctionPoints") {
  return safeRunPresenterAction(() => {
    const count = Math.max(
      0,
      Number(data.count ?? data.points ?? 0)
    )

    const incomingFixed = Number(data.calculatedPoints || 0)
    const keepFixed = !!data.keepFixedPoints

    if (typeof randomChallengeState !== "undefined") {
      if (!randomChallengeState.box2) {
        randomChallengeState.box2 = {}
      }

      const oldFixed = Number(randomChallengeState.box2.calculatedPoints || 0)

      randomChallengeState.box2.numberInput = String(count || "")
      randomChallengeState.box2.points = count

      randomChallengeState.box2.calculatedPoints =
        keepFixed
          ? Number(incomingFixed || oldFixed || 0)
          : Number(
              incomingFixed ||
              (
                count > 0 && count < 10
                  ? 1
                  : Math.floor(count / 10)
              )
            )
    }

    syncAfterRandomChallengeAction()
  })
}

  if (action === "randomStartBox2Timer") {
    return safeRunPresenterAction(() => {
      ensureRandomChallengeBoxState(2)

      if (typeof startRandomBox2Timer === "function") {
        startRandomBox2Timer()
      } else if (typeof startRandomChallengeBox2Timer === "function") {
        startRandomChallengeBox2Timer()
      }

      syncAfterRandomChallengeAction()
    })
  }

  if (action === "correct") {
    return safeRunPresenterAction(() => {
      if (typeof randomChallengeCorrect === "function") {
        randomChallengeCorrect()
      }

      syncAfterRandomChallengeAction()
    })
  }

  if (action === "wrong") {
    return safeRunPresenterAction(() => {
      if (typeof randomChallengeWrong === "function") {
        randomChallengeWrong()
      }

      syncAfterRandomChallengeAction()
    })
  }

  if (action === "randomFinishBox") {
    return safeRunPresenterAction(() => {
      const currentBox = Number(randomChallengeState?.currentBox || 0)

      if (typeof finishRandomChallengeCurrentBox === "function") {
        finishRandomChallengeCurrentBox(currentBox)
      } else if (typeof finishRandomChallengeBox === "function") {
        finishRandomChallengeBox(currentBox)
      }

      syncAfterRandomChallengeAction()
    })
  }

  if (action === "randomFinishRound") {
    return safeRunPresenterAction(() => {
      ensureRandomChallengeBoxState(3)

      if (typeof finishRandomBox3ToPoints === "function") {
        finishRandomBox3ToPoints()
      }

      syncAfterRandomChallengeAction()
    })
  }

  if (action === "randomBox3Wrong") {
    return safeRunPresenterAction(() => {
      ensureRandomChallengeBoxState(3)

      if (typeof randomBox3Wrong === "function") {
        randomBox3Wrong()
      }

      syncAfterRandomChallengeAction()
    })
  }

  if (action === "randomBox3Pass") {
    return safeRunPresenterAction(() => {
      ensureRandomChallengeBoxState(3)

      if (typeof randomBox3Pass === "function") {
        randomBox3Pass()
      }

      syncAfterRandomChallengeAction()
    })
  }

  if (action === "randomBox3SwitchTeam") {
    return safeRunPresenterAction(() => {
      ensureRandomChallengeBoxState(3)

      if (typeof switchRandomBox3Team === "function") {
        switchRandomBox3Team()
      }

      syncAfterRandomChallengeAction()
    })
  }

  if (action === "randomBox3ScorePoints") {
    return safeRunPresenterAction(() => {
      const points = Number(data.points || 0)

      ensureRandomChallengeBoxState(3)

      if (typeof scoreRandomBox3Points === "function") {
        scoreRandomBox3Points(points)
      }

      syncAfterRandomChallengeAction()
    })
  }
}
/* =========================
   INIT
========================= */

window.addEventListener("load", () => {
  restoreDisplayControlsMode()
  listenPresenterCommands()
  startRandomChallengeBox3TimerSessionSync()
})

window.addEventListener("online", () => {
  listenPresenterCommands(true)
})

window.addEventListener("pageshow", () => {
  listenPresenterCommands()
})

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    listenPresenterCommands()
  }
})

window.addEventListener("beforeunload", () => {
  clearTimeout(presenterCommandReconnectTimer)
  presenterCommandReconnectTimer = null

  if (
    presenterCommandChannel &&
    window.db
  ) {
    db.removeChannel(
      presenterCommandChannel
    )
  }

  presenterCommandChannel = null
  presenterCommandChannelHealthy = false
})