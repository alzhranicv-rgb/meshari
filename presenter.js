function getPresenterModel() {
  return Number(document.getElementById("presenterModel")?.value || 1)
}

function getPresenterSegment() {
  return document.getElementById("presenterSegment")?.value || "warmup"
}

function showPresenterToast(text = "تم الإرسال") {
  const toast = document.getElementById("presenterToast")
  if (!toast) return

  toast.innerText = text
  toast.classList.add("show")

  setTimeout(() => {
    toast.classList.remove("show")
  }, 1200)
}

async function presenterCommand(action, payload = {}) {
  const model = getPresenterModel()
  const segment = getPresenterSegment()

  const { error } = await db
    .from("presenter_commands")
    .insert({
      model,
      segment,
      action,
      payload
    })

  if (error) {
    console.log(error)
    showPresenterToast("فشل الإرسال")
    return
  }

  showPresenterToast("تم الإرسال")
}

function openPresenterNumber() {
  const number = Number(document.getElementById("presenterNumber")?.value || 0)

  if (!number) {
    showPresenterToast("اكتب الرقم")
    return
  }

  presenterCommand("openNumber", { number })
}