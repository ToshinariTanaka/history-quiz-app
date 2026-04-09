function filterQuestionsToSelectedEra(sourceQuestions) {
  if (!Array.isArray(sourceQuestions)) {
    return []
  }

  if (typeof shouldUseStartEraFilter !== "function" || !shouldUseStartEraFilter()) {
    return [...sourceQuestions]
  }

  const selectedEra = startEraEl?.value || ""
  if (!selectedEra) {
    return [...sourceQuestions]
  }

  return sourceQuestions.filter((item) => item.era === selectedEra)
}

populateStartEraOptions = function (questions) {
  const eras = []
  const seen = new Set()

  questions.forEach((item) => {
    if (!item.era || seen.has(item.era)) {
      return
    }

    seen.add(item.era)
    eras.push(item.era)
  })

  if (!startEraEl) {
    return
  }

  const previousValue = startEraEl.value
  startEraEl.innerHTML = ""

  const defaultOption = document.createElement("option")
  defaultOption.value = ""
  defaultOption.textContent = "指定なし"
  startEraEl.appendChild(defaultOption)

  eras.forEach((era) => {
    const option = document.createElement("option")
    option.value = era
    option.textContent = `${era}だけ`
    startEraEl.appendChild(option)
  })

  const validValue = Array.from(startEraEl.options).some((option) => option.value === previousValue)
    ? previousValue
    : ""
  startEraEl.value = validValue
}

updateStartEraVisibility = function () {
  const isAllRange = !rangeModeEl?.value || rangeModeEl.value === "all"
  const isNormalMode = !practiceModeEl?.value || practiceModeEl.value === "normal"
  const hasEraOptions = Boolean(startEraEl && startEraEl.options.length > 1)
  const shouldShow = isAllRange && isNormalMode && hasEraOptions

  if (startEraFieldEl) {
    startEraFieldEl.classList.toggle("hidden", !shouldShow)
  }

  if (startEraEl) {
    startEraEl.disabled = !shouldShow
    if (!shouldShow) {
      startEraEl.value = ""
    }
  }
}

shouldUseStartEraFilter = function () {
  const isAllRange = !rangeModeEl?.value || rangeModeEl.value === "all"
  const isNormalMode = !practiceModeEl?.value || practiceModeEl.value === "normal"
  const hasEraOptions = Boolean(startEraEl && startEraEl.options.length > 1)
  return isAllRange && isNormalMode && hasEraOptions && Boolean(startEraEl?.value)
}

getSelectedQuestionCount = function () {
  let source = applyPracticeModeToQuestions(getQuestionsForSelectedRange())
  source = filterQuestionsToSelectedEra(source)

  const availableQuestions = source.length
  const selectedCount = Number.parseInt(questionCountEl?.value || "", 10)
  if (!Number.isFinite(selectedCount) || selectedCount <= 0) {
    return Math.min(DEFAULT_QUESTION_COUNT, availableQuestions)
  }

  return Math.min(selectedCount, availableQuestions)
}

buildQuizFromSettings = function () {
  const shouldShuffleQuestions = Boolean(randomModeEl?.checked)
  const questionCount = getSelectedQuestionCount()
  const practiceMode = practiceModeEl?.value || "normal"

  let source = applyPracticeModeToQuestions(getQuestionsForSelectedRange())

  if (practiceMode === "normal") {
    source = filterQuestionsToSelectedEra(source)

    if (shouldShuffleQuestions) {
      source = shuffle(source)
    }
  }

  return source.slice(0, questionCount).map(cloneQuestion)
}

refreshSettingOptions = function () {
  const rangeQuestions = getQuestionsForSelectedRange()
  populateStartEraOptions(rangeQuestions)
  updateStartEraVisibility()

  const practiceQuestions = applyPracticeModeToQuestions(rangeQuestions)
  const filteredQuestions = filterQuestionsToSelectedEra(practiceQuestions)
  const previousCount = Number.parseInt(questionCountEl?.value || "", 10)

  populateQuestionCountOptions(filteredQuestions.length)

  if (Number.isFinite(previousCount) && previousCount > 0 && questionCountEl) {
    const adjustedCount = Math.min(previousCount, filteredQuestions.length || previousCount)
    if (adjustedCount > 0) {
      questionCountEl.value = String(adjustedCount)
    }
  }

  if (typeof renderStudyRecord === "function") {
    renderStudyRecord()
  }
}

function applyStartEraUiText() {
  const label = document.querySelector('label[for="start-era"] .setting-label')
  if (label) {
    label.textContent = "時代指定"
  }

  if (startEraEl) {
    startEraEl.setAttribute("aria-label", "時代指定")
  }
}

if (startEraEl) {
  startEraEl.addEventListener("change", () => {
    if (typeof refreshSettingOptions === "function") {
      refreshSettingOptions()
    }
  })
}

applyStartEraUiText()

window.setTimeout(() => {
  if (typeof refreshSettingOptions === "function") {
    refreshSettingOptions()
  }
}, 0)
