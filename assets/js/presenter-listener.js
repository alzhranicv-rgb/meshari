let presenterChannel = null
let lastPresenterCommandId = 0

function getDisplayModel() {
  return Number(window.currentModel || localStorage.getItem("current_model") || localStorage.getItem("selected_model") || 1)
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

  if (segment === "warmup") {
    if (action === "selectTeam") selectWarmupTeam(data.team)
    if (action === "openNumber") openWarmupQuestion(Number(data.category || 1), Number(data.number))
    if (action === "double") activateWarmupDouble()
    if (action === "correct") warmupCorrect()
    if (action === "wrong") warmupWrong()
  }

  if (segment === "auction") {
    if (action === "selectTeam") selectAuctionTeam(data.team)
    if (action === "openNumber") openAuction(Number(data.number))
    if (action === "correct") auctionCorrect()
    if (action === "wrong") auctionWrong()
    if (action === "showAnswer") showAuctionAnswer()
  }

  if (segment === "who") {
  if (action === "selectTeam") selectWhoTeam(data.team)
  if (action === "setPoints") setWhoPoints(Number(data.points))
  if (action === "openNumber") chooseWho(Number(data.number))
  if (action === "correct") whoCorrect()
  if (action === "wrong") whoWrong()
  if (action === "showAnswer") showWhoAnswer()
}

  if (segment === "top10") {
    if (action === "selectTeam") selectTop10Team(data.team)
    if (action === "openNumber") openTop10Number(Number(data.number))
    if (action === "wrong") addTop10Error()
    if (action === "showAnswer") showTop10Answer()
  }

  if (segment === "final") {
    if (action === "selectTeam") selectFinalTeam(data.team)

    if (action === "openNumber") {
      if (finalState.round === 1) openFinalRound1Card(Number(data.number))
      if (finalState.round === 2) openFinalRound2Card(Number(data.number))
      if (finalState.round === 3) openFinalRound3Card(Number(data.number))
    }

    if (action === "double") activateFinalDouble()

    if (action === "correct") {
      if (finalState.round === 1) finalRound1Correct()
      if (finalState.round === 2) finalRound2RecordScore()
      if (finalState.round === 3) finalRound3RecordScore()
    }

    if (action === "wrong") {
      if (finalState.round === 1) finalRound1Wrong()
    }

    if (action === "showQuestion") {
      if (finalState.round === 1) showFinalRound1Question()
    }

    if (action === "showAnswer") {
      if (finalState.round === 1) showFinalRound1Answer()
      if (finalState.round === 2) showFinalRound2Answer()
      if (finalState.round === 3) showFinalRound3Answer()
    }
  }

  if (segment === "archive") {
    if (action === "selectTeam") selectArchiveTeam(data.team)
    if (action === "openNumber") toggleArchiveItem(Number(data.number))
    if (action === "correct") showArchiveAnswer()
    if (action === "wrong") addArchiveError()
    if (action === "showAnswer") showArchiveAnswer()
  }
}

window.addEventListener("load", () => {
  setTimeout(listenPresenterCommands, 1500)
})