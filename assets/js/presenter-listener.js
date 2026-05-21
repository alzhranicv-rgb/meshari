
let presenterCommandChannel = null
let lastPresenterCommandId = 0
let handledPresenterCommandKeys = new Set()

function getDisplaySessionId() {
  return localStorage.getItem("game_session_id") || ""
}

function safeRunPresenterAction(fn) {
  try {
    if (typeof fn === "function") fn()
  } catch (e) {
    console.log("Presenter action error:", e)
  }
}

/* =========================
   DISPLAY CONTROLS
========================= */

function hideDisplayControls() {
  document.body.classList.add("presenterHideDisplayControls")
  localStorage.setItem("presenter_hide_controls", "1")

  if (typeof updateDisplayControlsEyeButton === "function") {
    updateDisplayControlsEyeButton(true)
  }

  if (typeof syncDisplayStateToSession === "function") {
    syncDisplayStateToSession()
  }
}

function showDisplayControls() {
  document.body.classList.remove("presenterHideDisplayControls")
  localStorage.setItem("presenter_hide_controls", "0")

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

  if (typeof updateDisplayControlsEyeButton === "function") {
    updateDisplayControlsEyeButton(isHidden)
  }
}

/* =========================
   LISTENER
========================= */

function listenPresenterCommands() {
  if (!window.db) {
    console.log("Presenter listener: db not ready")
    setTimeout(listenPresenterCommands, 300)
    return
  }

  const sessionId = getDisplaySessionId()

  if (!sessionId) {
    console.log("Presenter listener: no session id")
    setTimeout(listenPresenterCommands, 500)
    return
  }

  if (presenterCommandChannel) {
    db.removeChannel(presenterCommandChannel)
    presenterCommandChannel = null
  }

  presenterCommandChannel = db.channel("game_session_" + sessionId)

  presenterCommandChannel
    .on(
      "broadcast",
      { event: "presenter_command" },
      payload => {
        const cmd = payload?.payload
        if (!cmd) return

        handlePresenterCommandOnce(cmd, "broadcast")
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
        const cmd = payload.new
        if (!cmd) return

        handlePresenterCommandOnce(cmd, "database")
      }
    )
    .subscribe(status => {
      console.log("Presenter listener status:", status)
    })
}

function isValidPresenterTeam(team) {
  return team === "A" || team === "B"
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
  const segment = cmd.segment
  const action = cmd.action
  const data = { ...(cmd.payload || {}) }

  delete data.__client_command_id

  console.log("Handle presenter command:", segment, action, data)

  if (action === "openSegment") {
    return safeRunPresenterAction(() => openSegmentPage(data.segment))
  }

  if (action === "hideDisplayControls") return safeRunPresenterAction(hideDisplayControls)
  if (action === "showDisplayControls") return safeRunPresenterAction(showDisplayControls)
    
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
    if (
      segment === "final" &&
      window.finalState?.round === 3 &&
      window.finalState?.round3?.mode === "team_media" &&
      window.finalState?.round3?.teamMedia?.currentMedia
    ) {
      const type = window.finalState.round3.teamMedia.currentMediaType === "video"
        ? "video"
        : "image"

      openFinalRound3TeamMediaOverlay(type)
      return
    }

    if (
      segment === "final" &&
      window.finalState?.round === 3 &&
      Number(window.finalState?.round3?.currentNumber || 0)
    ) {
      toggleFinalRound3ImageOverlay()
      return
    }

    if (
      segment === "final" &&
      window.finalState?.round === 1 &&
      Number(window.finalState?.round1?.currentNumber || 0) >= 1 &&
      Number(window.finalState?.round1?.currentNumber || 0) <= 3
    ) {
      toggleFinalRound1Overlay()
      return
    }

    zoomCurrentDisplayImage()
  })
}

  if (action === "closeZoomImage") {
  return safeRunPresenterAction(() => {
    closeCurrentDisplayImageZoom()

    document.getElementById("auctionImageOverlay")?.remove()
    document.getElementById("whoImageOverlay")?.remove()
    document.getElementById("finalRound1Overlay")?.remove()
    document.getElementById("finalRound3ImageOverlay")?.remove()
  })
}
  if (action === "endSegment") return safeRunPresenterAction(() => endCurrentSegment())
  if (action === "goHome") return safeRunPresenterAction(() => goHome())

  if (segment === "warmup") return handleWarmupPresenterAction(action, data)
  if (segment === "top10") return handleTop10PresenterAction(action, data)
  if (segment === "auction") return handleAuctionPresenterAction(action, data)
  if (segment === "who") return handleWhoPresenterAction(action, data)
  if (segment === "final") return handleFinalPresenterAction(action, data)
  if (segment === "archive") return handleArchivePresenterAction(action, data)
}

/* =========================
   WARMUP
========================= */

function handleWarmupPresenterAction(action, data) {
  if (action === "selectTeam") {
    if (!isValidPresenterTeam(data.team)) return
    return safeRunPresenterAction(() => selectWarmupTeam(data.team))
  }

  if (action === "openNumber") return safeRunPresenterAction(() => openWarmupQuestion(Number(data.category), Number(data.number)))
  if (action === "double") return safeRunPresenterAction(() => activateWarmupDouble())
  if (action === "correct") return safeRunPresenterAction(() => warmupCorrect())
  if (action === "wrong") return safeRunPresenterAction(() => warmupWrong())
}

/* =========================
   TOP 10
========================= */

function handleTop10PresenterAction(action, data) {
  if (action === "selectTeam") {
    if (!isValidPresenterTeam(data.team)) return
    return safeRunPresenterAction(() => selectTop10Team(data.team))
  }

  if (action === "openNumber") return safeRunPresenterAction(() => openTop10Number(Number(data.number)))
  if (action === "double") return safeRunPresenterAction(() => activateTop10Double())
  if (action === "showAnswer") return safeRunPresenterAction(() => showTop10Answer())
  if (action === "wrong") return safeRunPresenterAction(() => addTop10Error())
  if (action === "undo") return safeRunPresenterAction(() => undoTop10Action())
  if (action === "switchTurn") return safeRunPresenterAction(() => switchTop10Turn())
  if (action === "nextRound") return safeRunPresenterAction(() => nextTop10Round())

  if (action === "setRound") {
    return safeRunPresenterAction(() => {
      top10State.round = Number(data.round || 1)
      renderCurrentRoundTop10UI()
      saveTop10State()
    })
  }
}

/* =========================
   AUCTION
========================= */

function handleAuctionPresenterAction(action, data) {
  if (action === "selectTeam") {
    if (!isValidPresenterTeam(data.team)) return
    return safeRunPresenterAction(() => selectAuctionTeam(data.team))
  }

  if (action === "openNumber") {
    return safeRunPresenterAction(() => openAuction(Number(data.number)))
  }

  if (action === "double") {
    return safeRunPresenterAction(() => activateAuctionDouble())
  }

  if (action === "correct") {
    return safeRunPresenterAction(() => {
      if (typeof closeAuctionZoomOverlays === "function") {
        closeAuctionZoomOverlays()
      } else if (typeof closeCurrentDisplayImageZoom === "function") {
        closeCurrentDisplayImageZoom()
      }

      auctionCorrect()
    })
  }

  if (action === "wrong") {
    return safeRunPresenterAction(() => {
      auctionWrong()
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

function handleWhoPresenterAction(action, data) {
  if (action === "selectTeam") {
    if (!isValidPresenterTeam(data.team)) return
    return safeRunPresenterAction(() => selectWhoTeam(data.team))
  }

  if (action === "setPoints") return safeRunPresenterAction(() => setWhoPoints(Number(data.points)))
  if (action === "openNumber") return safeRunPresenterAction(() => chooseWho(Number(data.number)))
  if (action === "double") return safeRunPresenterAction(() => activateWhoDouble())
  if (action === "compensation") return safeRunPresenterAction(() => startWhoCompensation())
  if (action === "correct") return safeRunPresenterAction(() => whoCorrect())
  if (action === "wrong") return safeRunPresenterAction(() => whoWrong())
}

/* =========================
   FINAL
========================= */

function handleFinalPresenterAction(action, data) {
  if (action === "selectTeam") {
    if (!isValidPresenterTeam(data.team)) return
    return safeRunPresenterAction(() => selectFinalTeam(data.team))
  }

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
        if (round === 1) {
          openFinalRound1Card(Number(data.number))
          return
        }

        if (round === 2) {
          openFinalRound2Card(Number(data.number))
          return
        }

        if (round === 3) {
          if (finalState.round3?.mode === "team_media") {
            openFinalRound3TeamMediaCard(Number(data.number))
          } else {
            openFinalRound3Card(Number(data.number))
          }
        }
      }, 120)
    })
  }

  if (action === "double") {
    return safeRunPresenterAction(() => activateFinalDouble())
  }

  if (action === "showQuestion") {
    return safeRunPresenterAction(() => {
      if (finalState.round === 1) {
        showFinalRound1Question()
        return
      }

      if (
        finalState.round === 3 &&
        finalState.round3?.mode === "team_media"
      ) {
        showFinalRound3TeamMediaQuestion()
      }
    })
  }

  if (action === "showAnswer") {
    return safeRunPresenterAction(() => {
      if (finalState.round === 1) {
        showFinalRound1Answer()
        return
      }

      if (finalState.round === 2 && typeof showFinalRound2Answer === "function") {
        showFinalRound2Answer()
        return
      }

      if (finalState.round === 3) {
        if (finalState.round3?.mode === "team_media") {
          const state = finalState.round3.teamMedia

          if (!state.currentNumber) {
            showGameToast("افتح رقم أولاً")
            return
          }

          pushFinalHistory()
          state.answerShown = true
          renderFinalRound3TeamMedia()
          saveFinalState()
        } else {
          showFinalRound3Answer()
        }
      }
    })
  }

  if (action === "correct") {
    return safeRunPresenterAction(() => {
      if (finalState.round === 1) {
        finalRound1Correct()
        return
      }

      if (
        finalState.round === 3 &&
        finalState.round3?.mode === "team_media"
      ) {
        finalRound3TeamMediaCorrect()
      }
    })
  }

  if (action === "wrong") {
    return safeRunPresenterAction(() => {
      if (finalState.round === 1) {
        finalRound1Wrong()
        return
      }

      if (
        finalState.round === 3 &&
        finalState.round3?.mode === "team_media"
      ) {
        finalRound3TeamMediaWrong()
      }
    })
  }

  if (action === "toggleRound2Correct") {
    return safeRunPresenterAction(() => {
      finalRound2ToggleCorrectFromPresenter(Number(data.index))
    })
  }

  if (action === "hideRound2SequenceWord") {
    return safeRunPresenterAction(() => {
      hideFinalRound2SequenceWord(Number(data.index))
    })
  }

  if (action === "toggleRound3Correct") {
    return safeRunPresenterAction(() => {
      if (
        finalState.round3?.mode === "team_media"
      ) {
        return
      }

      toggleFinalRound3CorrectSelection(Number(data.index))
    })
  }

  if (action === "decreaseCountdown") {
    return safeRunPresenterAction(() => finalRound2DecreaseCountdown())
  }

  if (action === "recordScrambleScore") {
    return safeRunPresenterAction(() => finalRound2RecordScore())
  }

  if (action === "recordSequenceScore") {
    return safeRunPresenterAction(() => finalRound2RecordSequenceScore())
  }

  if (action === "startSequence") {
    return safeRunPresenterAction(() => {
      if (
        finalState.round3?.mode === "team_media" &&
        finalState.round3?.teamMedia?.currentMediaType === "video"
      ) {
        openFinalRound3TeamMediaOverlay("video")

        setTimeout(() => {
          playFinalRound3TeamMediaVideo()
        }, 120)

        return
      }

      startFinalRound3Sequence()
    })
  }

  if (action === "restartTeamMediaVideo") {
    return safeRunPresenterAction(() => {
      if (
        finalState.round !== 3 ||
        finalState.round3?.mode !== "team_media" ||
        finalState.round3?.teamMedia?.currentMediaType !== "video"
      ) {
        return
      }

      openFinalRound3TeamMediaOverlay("video")

      setTimeout(() => {
        restartFinalRound3TeamMediaVideo()

        setTimeout(() => {
          playFinalRound3TeamMediaVideo()
        }, 80)
      }, 120)
    })
  }

  if (action === "playTeamMediaVideo") {
    return safeRunPresenterAction(() => {
      if (
        finalState.round !== 3 ||
        finalState.round3?.mode !== "team_media" ||
        finalState.round3?.teamMedia?.currentMediaType !== "video"
      ) {
        return
      }

      openFinalRound3TeamMediaOverlay("video")

      setTimeout(() => {
        playFinalRound3TeamMediaVideo()
      }, 120)
    })
  }

  if (action === "recordRound3Score") {
    return safeRunPresenterAction(() => {
      if (finalState.round3?.mode === "team_media") {
        finalRound3TeamMediaCorrect()
      } else {
        finalRound3RecordScore()
      }
    })
  }

  if (action === "undo") {
    return safeRunPresenterAction(() => undoFinalAction())
  }

  if (action === "nextRound") {
    return safeRunPresenterAction(() => {
      goToFinalRound(Number(finalState.round) + 1)
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
  if (action === "openNumber") return safeRunPresenterAction(() => toggleArchiveItem(Number(data.number)))

 if (action === "setRound") {
  return safeRunPresenterAction(() => {
    archiveState.round = Number(data.round || 1)
    renderArchiveRoundUI()
    saveArchiveState()
  })
}

  if (action === "double") return safeRunPresenterAction(() => activateArchiveDouble())
  if (action === "startTimer") return safeRunPresenterAction(() => startArchiveTimer())
  if (action === "showAnswer") return safeRunPresenterAction(() => showArchiveAnswer())
  if (action === "wrong") return safeRunPresenterAction(() => addArchiveError())
  if (action === "undo") return safeRunPresenterAction(() => undoArchiveAction())
  if (action === "nextRound") return safeRunPresenterAction(() => nextArchiveRound())
}

/* =========================
   INIT
========================= */

window.addEventListener("load", () => {
  restoreDisplayControlsMode()
  listenPresenterCommands()
})