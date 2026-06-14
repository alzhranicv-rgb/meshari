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

function getPresenterDisplayFinalSegmentKey(round) {
  const r = Number(round || 1)

  if (r === 1) return "finalRound1"
  if (r === 2) return "finalRound2"
  if (r === 3) return "finalRound3"
  if (r === 4) return "finalRound4"

  return "finalRound1"
}

function forceDisplayFinalRoundFromPresenter(round, afterReady = null) {
  const r = Number(round || 1)
  const key = getPresenterDisplayFinalSegmentKey(r)

  const previousActive = normalizeDisplaySegmentKey(
    localStorage.getItem("active_segment") || ""
  )

  const finalStageIsOpen = !!document.getElementById("finalMainStage")
  const sameFinalRoundOpen =
    finalStageIsOpen &&
    previousActive === key &&
    Number(window.finalState?.round || r) === r

  window.displayFinalRound = r
  window.currentFinalRound = r
  localStorage.setItem("active_segment", key)

  const runAfterReady = () => {
    setTimeout(() => {
      if (typeof afterReady === "function") {
        afterReady()
      }
    }, 180)
  }

  if (sameFinalRoundOpen) {
    runAfterReady()
    return
  }

  if (finalStageIsOpen && typeof window.renderFinal === "function") {
    const result = window.renderFinal(r, key)

    if (result && typeof result.then === "function") {
      result.then(runAfterReady)
    } else {
      runAfterReady()
    }

    return
  }

  if (typeof openSegmentPage === "function") {
    const result = openSegmentPage(key, r)

    if (result && typeof result.then === "function") {
      result.then(runAfterReady)
    } else {
      runAfterReady()
    }

    return
  }

  if (typeof window.renderFinal === "function") {
    const result = window.renderFinal(r, key)

    if (result && typeof result.then === "function") {
      result.then(runAfterReady)
    } else {
      runAfterReady()
    }
  }
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

      if (
        segment === "final" &&
        window.finalState?.round === 3 &&
        window.finalState?.round3?.mode === "team_media" &&
        window.finalState?.round3?.teamMedia?.currentMedia
      ) {
        const type =
          window.finalState.round3.teamMedia.currentMediaType === "video"
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
  Number(window.finalState?.round1?.currentNumber || 0)
) {
  if (typeof toggleFinalRound1Overlay === "function") {
    toggleFinalRound1Overlay()
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

      document.getElementById("displayImageZoomOverlay")?.remove()
      document.getElementById("auctionImageOverlay")?.remove()
      document.getElementById("auctionVideoFullscreenOverlay")?.remove()
      document.getElementById("whoImageOverlay")?.remove()
      document.getElementById("finalRound1Overlay")?.remove()
      document.getElementById("finalRound3ImageOverlay")?.remove()
      document.getElementById("finalRound3TeamMediaOverlay")?.remove()
      document.getElementById("finalRound4TeamMediaOverlay")?.remove()

      document.body.classList.remove("auctionOverlayActive")
    })
  }

  if (action === "endSegment") {
    return safeRunPresenterAction(() => endCurrentSegment())
  }

  if (action === "goHome") {
    return safeRunPresenterAction(() => goHome())
  }

  if (segment === "warmup") return handleWarmupPresenterAction(action, data)
  if (segment === "top10") return handleTop10PresenterAction(action, data)
  if (segment === "auction") return handleAuctionPresenterAction(action, data)
  if (segment === "who") return handleWhoPresenterAction(action, data)
  if (segment === "explain") return handleExplainPresenterAction(action, data)
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

function handleTop10PresenterAction(action, data) {
  if (action === "selectTeam") {
    if (!isValidPresenterTeam(data.team)) return
    return safeRunPresenterAction(() => selectTop10Team(data.team))
  }

  if (action === "openNumber") {
    return safeRunPresenterAction(() => openTop10Number(Number(data.number)))
  }

  if (action === "double") {
    return safeRunPresenterAction(() => activateTop10Double())
  }

  if (action === "showAnswer") {
    return safeRunPresenterAction(() => showTop10Answer())
  }

  if (action === "wrong") {
    return safeRunPresenterAction(() => addTop10Error())
  }

  if (action === "undo") {
    return safeRunPresenterAction(() => undoTop10Action())
  }

  if (action === "switchTurn") {
    return safeRunPresenterAction(() => switchTop10Turn())
  }

  if (action === "nextRound") {
    return safeRunPresenterAction(() => nextTop10Round())
  }

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

  const points = Number(window.whoState?.currentPoints || 0)
  const team = window.whoState?.activeTeam || ""

  return `${number}_${team}_${points}`
}

function runDisplayWhoScoreOnce(action, data, fn) {
  const key = getDisplayWhoScoreKey(action, data)

  if (!key || key === "0__0") return

  if (displayWhoHandledScoreKeys.has(key)) {
    return
  }

  displayWhoHandledScoreKeys.add(key)

  if (displayWhoHandledScoreKeys.size > 40) {
    displayWhoHandledScoreKeys = new Set(
      Array.from(displayWhoHandledScoreKeys).slice(-20)
    )
  }

  if (typeof fn === "function") {
    fn()
  }
}

function handleWhoPresenterAction(action, data) {
  if (action === "selectTeam") {
    if (!isValidPresenterTeam(data.team)) return
    return safeRunPresenterAction(() => selectWhoTeam(data.team))
  }

  if (action === "setPoints") {
    return safeRunPresenterAction(() => setWhoPoints(Number(data.points)))
  }

  if (action === "openNumber") {
    return safeRunPresenterAction(() => {
      displayWhoHandledScoreKeys.clear()
      chooseWho(Number(data.number))
    })
  }

  if (action === "double") {
    return safeRunPresenterAction(() => activateWhoDouble())
  }

  if (action === "compensation") {
    return safeRunPresenterAction(() => {
      displayWhoHandledScoreKeys.clear()
      startWhoCompensation()
    })
  }

  if (action === "correct") {
    return safeRunPresenterAction(() => {
      runDisplayWhoScoreOnce("correct", data, () => whoCorrect())
    })
  }

  if (action === "wrong") {
    return safeRunPresenterAction(() => {
      runDisplayWhoScoreOnce("wrong", data, () => whoWrong())
    })
  }
}

/* =========================
   EXPLAIN WORD
========================= */

let displayExplainHandledScoreKeys = new Set()

function getDisplayExplainScoreKey(action) {
  const number = Number(window.explainState?.currentNumber || 0)
  const team = window.explainState?.currentTeam || ""
  const word = window.explainState?.currentWord || ""

  if (!number || !team) return ""

  return `${action}_${number}_${team}_${word}`
}

function runDisplayExplainScoreOnce(action, fn) {
  const key = getDisplayExplainScoreKey(action)

  if (!key) return

  if (displayExplainHandledScoreKeys.has(key)) {
    return
  }

  displayExplainHandledScoreKeys.add(key)

  if (displayExplainHandledScoreKeys.size > 40) {
    displayExplainHandledScoreKeys = new Set(
      Array.from(displayExplainHandledScoreKeys).slice(-20)
    )
  }

  if (typeof fn === "function") {
    fn()
  }
}

function syncAfterExplainAction() {
  if (typeof saveExplainState === "function") {
    saveExplainState()
    return
  }

  if (typeof syncDisplayStateToSession === "function") {
    syncDisplayStateToSession()
  }
}

function handleExplainPresenterAction(action, data) {
  if (action === "selectTeam") {
    if (!isValidPresenterTeam(data.team)) return

    return safeRunPresenterAction(() => {
      selectedTeam = data.team

      if (typeof selectExplainTeam === "function") {
        selectExplainTeam(data.team)
      }

      syncAfterExplainAction()
    })
  }

  if (action === "openNumber") {
    return safeRunPresenterAction(() => {
      const number = Number(data.number || 0)
      const team = data.team

      if (!number) return

      if (isValidPresenterTeam(team)) {
        selectedTeam = team

        if (typeof selectExplainTeam === "function") {
          selectExplainTeam(team)
        }
      }

      setTimeout(() => {
        if (typeof openExplainNumber !== "function") {
          console.log("openExplainNumber not ready")
          return
        }

        displayExplainHandledScoreKeys.clear()

        openExplainNumber(number)
        syncAfterExplainAction()
      }, 60)
    })
  }

  if (action === "toggleWordVisible") {
    return safeRunPresenterAction(() => {
      if (typeof toggleExplainWordVisibility === "function") {
        toggleExplainWordVisibility()
        syncAfterExplainAction()
        return
      }

      if (typeof toggleExplainWord === "function") {
        toggleExplainWord()
        syncAfterExplainAction()
        return
      }

      if (typeof hideExplainWord === "function") {
        hideExplainWord()
        syncAfterExplainAction()
      }
    })
  }

  if (action === "startTimer") {
    return safeRunPresenterAction(() => {
      if (typeof startExplainTimer !== "function") {
        console.log("startExplainTimer not ready")
        return
      }

      startExplainTimer()
      syncAfterExplainAction()
    })
  }

  if (action === "correct") {
    return safeRunPresenterAction(() => {
      if (typeof correctExplainAnswer !== "function") {
        console.log("correctExplainAnswer not ready")
        return
      }

      runDisplayExplainScoreOnce("correct", () => {
        correctExplainAnswer()
        syncAfterExplainAction()
      })
    })
  }

  if (action === "wrong") {
    return safeRunPresenterAction(() => {
      if (typeof wrongExplainAnswer !== "function") {
        console.log("wrongExplainAnswer not ready")
        return
      }

      runDisplayExplainScoreOnce("wrong", () => {
        wrongExplainAnswer()
        syncAfterExplainAction()
      })
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
          if (isValidPresenterTeam(team)) {
  forceFinalTeamFromPresenter(team)
}

          setTimeout(() => {
            if (round === 1) {
              openFinalRound1Card(number)
              return
            }

            if (round === 2) {
              openFinalRound2Card(number)
              return
            }

            if (round === 3) {
              if (typeof openFinalRound3StoryCard === "function") {
                openFinalRound3StoryCard(number)
              }
              return
            }

            if (round === 4) {
              if (typeof openFinalRound4TeamMediaCard === "function") {
                openFinalRound4TeamMediaCard(number)
              }
              return
            }
          }, 80)
        }, 80)
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

      if (typeof finalRound2ToggleCorrectFromPresenter === "function") {
        finalRound2ToggleCorrectFromPresenter(Number(data.index))
        return
      }

      if (typeof toggleFinalRound2CorrectSelection === "function") {
        toggleFinalRound2CorrectSelection(Number(data.index))
      }
    })
  }

if (action === "toggleRound2ImageCorrect") {
  return safeRunPresenterAction(() => {
    if (window.finalState?.round !== 2) return

    const index = Number(data.index)
    if (!Number.isFinite(index)) return

    const currentNumber = Number(
      data.number ||
      window.finalState?.round2?.currentNumber ||
      0
    )

    const selectedFromPresenter = Array.isArray(data.selectedCorrectIndexes)
      ? data.selectedCorrectIndexes.map(Number)
      : null

    window.finalState.round2 = {
      ...(window.finalState.round2 || {}),
      currentNumber,
      selectedCorrectIndexes: selectedFromPresenter || []
    }

    if (!selectedFromPresenter) {
      const oldSelected = Array.isArray(window.finalState.round2.selectedCorrectIndexes)
        ? window.finalState.round2.selectedCorrectIndexes.map(Number)
        : []

      window.finalState.round2.selectedCorrectIndexes = oldSelected.includes(index)
        ? oldSelected.filter(x => Number(x) !== index)
        : [...oldSelected, index]
    }

    if (typeof saveFinalState === "function") {
      saveFinalState()
    }

    if (typeof syncDisplayStateToSession === "function") {
      syncDisplayStateToSession()
    }
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
   INIT
========================= */

window.addEventListener("load", () => {
  restoreDisplayControlsMode()
  listenPresenterCommands()
})