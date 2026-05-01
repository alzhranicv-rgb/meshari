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

    if (action === "wrong") safeRunPresenterAction(() => addTop10Error())
    if (action === "showAnswer") safeRunPresenterAction(() => showTop10Answer())
  }

  /* =========================
     FINAL
  ========================= */

  if (segment === "final") {
    if (action === "selectTeam") safeRunPresenterAction(() => selectFinalTeam(data.team))

    if (action === "openNumber") {
      safeRunPresenterAction(() => {
        if (data.round && finalState.round !== Number(data.round)) {
          goToFinalRound(Number(data.round))
        }

        setTimeout(() => {
          if (finalState.round === 1) openFinalRound1Card(Number(data.number))
          if (finalState.round === 2) openFinalRound2Card(Number(data.number))
          if (finalState.round === 3) openFinalRound3Card(Number(data.number))
        }, 150)
      })
    }

    if (action === "double") safeRunPresenterAction(() => activateFinalDouble())

    if (action === "startSequence") {
      safeRunPresenterAction(() => {
        if (finalState.round === 3) startFinalRound3Sequence()
      })
    }

    if (action === "correct") {
      safeRunPresenterAction(() => {
        if (finalState.round === 1) finalRound1Correct()

        if (finalState.round === 2) {
          if (finalState.round2.currentType === "sequence") {
            finalRound2RecordSequenceScore()
          } else {
            finalRound2RecordScore()
          }
        }

        if (finalState.round === 3) finalRound3RecordScore()
      })
    }

    if (action === "wrong") {
      safeRunPresenterAction(() => {
        if (finalState.round === 1) finalRound1Wrong()
      })
    }

    if (action === "showQuestion") {
      safeRunPresenterAction(() => {
        if (finalState.round === 1) showFinalRound1Question()
      })
    }

    if (action === "showAnswer") {
      safeRunPresenterAction(() => {
        if (finalState.round === 1) showFinalRound1Answer()
        if (finalState.round === 2) showFinalRound2Answer()
        if (finalState.round === 3) showFinalRound3Answer()
      })
    }
  }

  /* =========================
     ARCHIVE
  ========================= */

  if (segment === "archive") {
    if (action === "selectTeam") {
      safeRunPresenterAction(() => selectArchiveTeam(data.team))
    }

    if (action === "openNumber") {
      safeRunPresenterAction(() => {
        if (data.round && archiveState.round !== Number(data.round)) {
          archiveState.round = Number(data.round)
          archiveState.activeTeam = null
          archiveLastTeam = null
          archiveTurnLocked = false
          archiveRemainingPoints = 0
          archiveTimerStarted = false
          archiveLastTickPlayed = null

          clearInterval(archiveTimer)
          archiveTimer = null

          renderArchiveRoundUI()
          saveArchiveState()
        }

        setTimeout(() => {
          toggleArchiveItem(Number(data.number))
        }, 150)
      })
    }

    if (action === "double") {
      safeRunPresenterAction(() => activateArchiveDouble())
    }

    if (action === "startTimer") {
      safeRunPresenterAction(() => startArchiveTimer())
    }

    if (action === "showAnswer") {
      safeRunPresenterAction(() => showArchiveAnswer())
    }

    if (action === "correct") {
      safeRunPresenterAction(() => showArchiveAnswer())
    }

    if (action === "wrong") {
      safeRunPresenterAction(() => addArchiveError())
    }

    if (action === "undo") {
      safeRunPresenterAction(() => undoArchiveAction())
    }

    if (action === "nextRound") {
      safeRunPresenterAction(() => nextArchiveRound())
    }
  }

}

window.addEventListener("load", () => {
  restoreDisplayControlsMode()
  setTimeout(listenPresenterCommands, 1500)
})