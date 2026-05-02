let presenterChannel = null
let lastPresenterCommandId = 0

function getDisplayModel() {
  return Number(
    window.currentModel ||
    localStorage.getItem("game_model") ||
    localStorage.getItem("current_model") ||
    localStorage.getItem("selected_model") ||
    1
  )
}

function safeRunPresenterAction(fn) {
  try {
    if (typeof fn === "function") fn()
  } catch (e) {
    console.log("Presenter action error:", e)
  }
}

function hideDisplayControls() {
  document.body.classList.add("presenterHideDisplayControls")
  localStorage.setItem("presenter_hide_controls", "1")
}

function showDisplayControls() {
  document.body.classList.remove("presenterHideDisplayControls")
  localStorage.setItem("presenter_hide_controls", "0")
}

function toggleDisplayControls() {
  if (document.body.classList.contains("presenterHideDisplayControls")) {
    showDisplayControls()
  } else {
    hideDisplayControls()
  }
}

function restoreDisplayControlsMode() {
  if (localStorage.getItem("presenter_hide_controls") === "1") {
    document.body.classList.add("presenterHideDisplayControls")
  }
}

function listenPresenterCommands() {
  if (!window.db) {
    console.log("Presenter listener: db not ready")
    return
  }

  const model = getDisplayModel()
  console.log("Presenter listener started, model =", model)

  if (presenterChannel) {
    db.removeChannel(presenterChannel)
  }

  presenterChannel = db.channel("presenter_commands_channel_" + model)

  presenterChannel
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "presenter_commands",
        filter: `model=eq.${model}`
      },
      payload => {
        console.log("Presenter command received:", payload.new)

        const cmd = payload.new
        if (!cmd || cmd.id === lastPresenterCommandId) return

        lastPresenterCommandId = cmd.id
        handlePresenterCommand(cmd)
      }
    )
    .subscribe(status => {
      console.log("Presenter listener status:", status)
    })
}

function handlePresenterCommand(cmd) {
  const segment = cmd.segment
  const action = cmd.action
  const data = cmd.payload || {}

  console.log("Handle:", segment, action, data)

  if (action === "toggleDisplayControls") {
    toggleDisplayControls()
    return
  }

  if (action === "hideDisplayControls") {
    hideDisplayControls()
    return
  }

  if (action === "showDisplayControls") {
    showDisplayControls()
    return
  }

  if (action === "zoomImage") {
    safeRunPresenterAction(() => zoomCurrentDisplayImage())
    return
  }

  if (action === "closeZoomImage") {
    safeRunPresenterAction(() => closeCurrentDisplayImageZoom())
    return
  }

  if (action === "endSegment") {
    safeRunPresenterAction(() => endCurrentSegment())
    return
  }

  /* =========================
     WARMUP
  ========================= */

  if (segment === "warmup") {
    if (action === "selectTeam") safeRunPresenterAction(() => selectWarmupTeam(data.team))
    if (action === "openNumber") safeRunPresenterAction(() => openWarmupQuestion(Number(data.category || 1), Number(data.number)))
    if (action === "double") safeRunPresenterAction(() => activateWarmupDouble())
    if (action === "correct") safeRunPresenterAction(() => warmupCorrect())
    if (action === "wrong") safeRunPresenterAction(() => warmupWrong())
  }

  /* =========================
     AUCTION
  ========================= */

  if (segment === "auction") {
    if (action === "selectTeam") safeRunPresenterAction(() => selectAuctionTeam(data.team))
    if (action === "openNumber") safeRunPresenterAction(() => openAuction(Number(data.number)))
    if (action === "double") safeRunPresenterAction(() => activateAuctionDouble())
    if (action === "startTimer") safeRunPresenterAction(() => startAuctionTimerButton())
    if (action === "correct") safeRunPresenterAction(() => auctionCorrect())
    if (action === "wrong") safeRunPresenterAction(() => auctionWrong())
    if (action === "undo") safeRunPresenterAction(() => undoAuctionAction())
    if (action === "showAnswer") safeRunPresenterAction(() => showAuctionAnswer())
  }

  /* =========================
     WHO
  ========================= */

  if (segment === "who") {
    if (action === "selectTeam") safeRunPresenterAction(() => selectWhoTeam(data.team))
    if (action === "setPoints") safeRunPresenterAction(() => setWhoPoints(Number(data.points)))
    if (action === "openNumber") safeRunPresenterAction(() => chooseWho(Number(data.number)))
    if (action === "double") safeRunPresenterAction(() => activateWhoDouble())
    if (action === "correct") safeRunPresenterAction(() => whoCorrect())
    if (action === "wrong") safeRunPresenterAction(() => whoWrong())
    if (action === "showAnswer") safeRunPresenterAction(() => showWhoAnswer())
  }

  /* =========================
     TOP 10
  ========================= */

  if (segment === "top10") {
    if (action === "selectTeam") safeRunPresenterAction(() => selectTop10Team(data.team))

    if (action === "openNumber") {
      safeRunPresenterAction(() => {
        if (data.round && top10State.round !== Number(data.round)) {
          top10State.round = Number(data.round)
          renderCurrentRoundTop10UI()
          saveTop10State()
        }

        setTimeout(() => {
          openTop10Number(Number(data.number))
        }, 150)
      })
    }

    if (action === "startTimer") safeRunPresenterAction(() => startTop10TimerButton())
if (action === "undo") safeRunPresenterAction(() => undoTop10Action())
if (action === "switchTurn") safeRunPresenterAction(() => switchTop10Turn())
if (action === "nextRound") safeRunPresenterAction(() => nextTop10Round())
if (action === "double") safeRunPresenterAction(() => activateTop10Double())
if (action === "showAnswer") safeRunPresenterAction(() => showTop10Answer())
if (action === "wrong") safeRunPresenterAction(() => addTop10Error())
  }

  /* =========================
     FINAL
  ========================= */

if (segment === "final") {
  if (action === "selectTeam") {
    safeRunPresenterAction(() => selectFinalTeam(data.team))
    return
  }

  if (action === "openNumber") {
    safeRunPresenterAction(() => {
      if (data.round && data.round !== finalState.round) {
        goToFinalRound(Number(data.round))
      }

      if (Number(data.round) === 1) openFinalRound1Card(Number(data.number))
      if (Number(data.round) === 2) openFinalRound2Card(Number(data.number))
      if (Number(data.round) === 3) openFinalRound3Card(Number(data.number))
    })
    return
  }

  if (action === "double") {
    safeRunPresenterAction(() => activateFinalDouble())
    return
  }

  if (action === "showQuestion") {
    safeRunPresenterAction(() => showFinalRound1Question())
    return
  }

  if (action === "showAnswer") {
    safeRunPresenterAction(() => {
      if (finalState.round === 1) showFinalRound1Answer()
      if (finalState.round === 2) showFinalRound2Answer()
      if (finalState.round === 3) showFinalRound3Answer()
    })
    return
  }

  if (action === "correct") {
    safeRunPresenterAction(() => {
      if (finalState.round === 1) finalRound1Correct()
    })
    return
  }

  if (action === "wrong") {
    safeRunPresenterAction(() => {
      if (finalState.round === 1) finalRound1Wrong()
    })
    return
  }

  if (action === "decreaseCountdown") {
    safeRunPresenterAction(() => finalRound2DecreaseCountdown())
    return
  }

  if (action === "recordScrambleScore") {
    safeRunPresenterAction(() => finalRound2RecordScore())
    return
  }

  if (action === "recordSequenceScore") {
    safeRunPresenterAction(() => finalRound2RecordSequenceScore())
    return
  }

  if (action === "startSequence") {
    safeRunPresenterAction(() => startFinalRound3Sequence())
    return
  }

  if (action === "recordRound3Score") {
    safeRunPresenterAction(() => finalRound3RecordScore())
    return
  }

  if (action === "undo") {
    safeRunPresenterAction(() => undoFinalAction())
    return
  }

  if (action === "nextRound") {
    safeRunPresenterAction(() => goToFinalRound(Number(finalState.round) + 1))
    return
  }
}
  /* =========================
     ARCHIVE
  ========================= */

  if (segment === "archive") {
    if (action === "selectTeam") {
      safeRunPresenterAction(() => selectArchiveTeam(data.team))
      return
    }

    if (action === "setRound") {
      safeRunPresenterAction(() => {
        if (Number(data.round) !== archiveState.round) {
          archiveState.round = Number(data.round)
          archiveState.activeTeam = null
          renderArchiveRoundUI()
        }
      })
      return
    }

    if (action === "openNumber") {
      safeRunPresenterAction(() => {
        if (Number(data.round) !== archiveState.round) {
          archiveState.round = Number(data.round)
          archiveState.activeTeam = null
          renderArchiveRoundUI()
        }

        toggleArchiveItem(Number(data.number))
      })
      return
    }

    if (action === "double") {
      safeRunPresenterAction(() => activateArchiveDouble())
      return
    }

    if (action === "startTimer") {
      safeRunPresenterAction(() => startArchiveTimer())
      return
    }

    if (action === "showAnswer") {
      safeRunPresenterAction(() => showArchiveAnswer())
      return
    }

    if (action === "wrong") {
      safeRunPresenterAction(() => addArchiveError())
      return
    }

    if (action === "undo") {
      safeRunPresenterAction(() => undoArchiveAction())
      return
    }

    if (action === "nextRound") {
      safeRunPresenterAction(() => nextArchiveRound())
      return
    }
  }
}

window.addEventListener("load", () => {
  restoreDisplayControlsMode()
  setTimeout(listenPresenterCommands, 1500)
})