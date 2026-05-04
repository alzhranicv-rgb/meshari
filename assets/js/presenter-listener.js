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

  if (action === "toggleDisplayControls") return safeRunPresenterAction(toggleDisplayControls)
  if (action === "hideDisplayControls") return safeRunPresenterAction(hideDisplayControls)
  if (action === "showDisplayControls") return safeRunPresenterAction(showDisplayControls)
  if (action === "zoomImage") return safeRunPresenterAction(() => zoomCurrentDisplayImage())
  if (action === "closeZoomImage") return safeRunPresenterAction(() => closeCurrentDisplayImageZoom())
  if (action === "endSegment") return safeRunPresenterAction(() => endCurrentSegment())
  if (action === "goHome") return safeRunPresenterAction(() => goHome())

  if (segment === "warmup") {
  if (action === "selectTeam") return safeRunPresenterAction(() => selectWarmupTeam(data.team))
  if (action === "openNumber") return safeRunPresenterAction(() => openWarmupQuestion(Number(data.category), Number(data.number)))
  if (action === "double") return safeRunPresenterAction(() => activateWarmupDouble())
  if (action === "correct") return safeRunPresenterAction(() => warmupCorrect())
  if (action === "wrong") return safeRunPresenterAction(() => warmupWrong())
}

  if (segment === "auction") {
  if (action === "selectTeam") return safeRunPresenterAction(() => selectAuctionTeam(data.team))
  if (action === "openNumber") return safeRunPresenterAction(() => openAuction(Number(data.number)))
  if (action === "double") return safeRunPresenterAction(() => activateAuctionDouble())
  if (action === "correct") return safeRunPresenterAction(() => auctionCorrect())
  if (action === "wrong") return safeRunPresenterAction(() => auctionWrong())
  if (action === "undo") return safeRunPresenterAction(() => undoAuctionAction())
  if (action === "zoomImage") return safeRunPresenterAction(() => zoomCurrentDisplayImage())
}

  if (segment === "who") {
  if (action === "selectTeam") return safeRunPresenterAction(() => selectWhoTeam(data.team))
  if (action === "setPoints") return safeRunPresenterAction(() => setWhoPoints(Number(data.points)))
  if (action === "openNumber") return safeRunPresenterAction(() => chooseWho(Number(data.number)))
  if (action === "double") return safeRunPresenterAction(() => activateWhoDouble())
  if (action === "compensation") return safeRunPresenterAction(() => startWhoCompensation())
  if (action === "correct") return safeRunPresenterAction(() => whoCorrect())
  if (action === "wrong") return safeRunPresenterAction(() => whoWrong())
}

  if (segment === "top10") {
  if (action === "selectTeam") return safeRunPresenterAction(() => selectTop10Team(data.team))
  if (action === "openNumber") return safeRunPresenterAction(() => openTop10Number(Number(data.number)))
  if (action === "double") return safeRunPresenterAction(() => activateTop10Double())
  if (action === "showAnswer") return safeRunPresenterAction(() => showTop10Answer())
  if (action === "wrong") return safeRunPresenterAction(() => addTop10Error())
  if (action === "undo") return safeRunPresenterAction(() => undoTop10Action())
  if (action === "switchTurn") return safeRunPresenterAction(() => switchTop10Turn())
  if (action === "nextRound") return safeRunPresenterAction(() => nextTop10Round())
}

  if (segment === "final") {
    if (action === "selectTeam") return safeRunPresenterAction(() => selectFinalTeam(data.team))

    if (action === "setRound") {
  return safeRunPresenterAction(() => {
    const round = Number(data.round || 1)
    if (round !== finalState.round) goToFinalRound(round)
  })
}

    if (action === "openNumber") {
      return safeRunPresenterAction(() => {
        const round = Number(data.round || finalState.round || 1)

        if (round !== finalState.round) {
          goToFinalRound(round)
        }

        setTimeout(() => {
          if (round === 1) openFinalRound1Card(Number(data.number))
          if (round === 2) openFinalRound2Card(Number(data.number))
          if (round === 3) openFinalRound3Card(Number(data.number))
        }, 120)
      })
    }

    if (action === "double") return safeRunPresenterAction(() => activateFinalDouble())
    if (action === "showQuestion") return safeRunPresenterAction(() => showFinalRound1Question())

    if (action === "showAnswer") {
      return safeRunPresenterAction(() => {
        if (finalState.round === 1) showFinalRound1Answer()
        if (finalState.round === 2) showFinalRound2Answer()
        if (finalState.round === 3) showFinalRound3Answer()
      })
    }

    if (action === "correct") {
      return safeRunPresenterAction(() => {
        if (finalState.round === 1) finalRound1Correct()
      })
    }

    if (action === "wrong") {
      return safeRunPresenterAction(() => {
        if (finalState.round === 1) finalRound1Wrong()
      })
    }

    if (action === "decreaseCountdown") return safeRunPresenterAction(() => finalRound2DecreaseCountdown())
    if (action === "recordScrambleScore") return safeRunPresenterAction(() => finalRound2RecordScore())
    if (action === "recordSequenceScore") return safeRunPresenterAction(() => finalRound2RecordSequenceScore())
    if (action === "startSequence") return safeRunPresenterAction(() => startFinalRound3Sequence())
    if (action === "recordRound3Score") return safeRunPresenterAction(() => finalRound3RecordScore())
    if (action === "undo") return safeRunPresenterAction(() => undoFinalAction())
    if (action === "nextRound") return safeRunPresenterAction(() => goToFinalRound(Number(finalState.round) + 1))
  }

  if (segment === "archive") {
  if (action === "selectTeam") return safeRunPresenterAction(() => selectArchiveTeam(data.team))

  if (action === "openNumber") {
    return safeRunPresenterAction(() => toggleArchiveItem(Number(data.number)))
  }

  if (action === "double") return safeRunPresenterAction(() => activateArchiveDouble())
  if (action === "startTimer") return safeRunPresenterAction(() => startArchiveTimer())
  if (action === "showAnswer") return safeRunPresenterAction(() => showArchiveAnswer())
  if (action === "wrong") return safeRunPresenterAction(() => addArchiveError())
  if (action === "undo") return safeRunPresenterAction(() => undoArchiveAction())
  if (action === "nextRound") return safeRunPresenterAction(() => nextArchiveRound())
}
}


window.addEventListener("load", () => {
  restoreDisplayControlsMode()
  setTimeout(listenPresenterCommands, 1500)
})