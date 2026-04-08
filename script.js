const DATA_PATH = "quiz-data_rekishi3.json"
const DEFAULT_QUESTION_COUNT = 10

const questionEl = document.getElementById("question")
const choicesEl = document.getElementById("choices")
const resultEl = document.getElementById("result")
const summaryEl = document.getElementById("summary")
const progressEl = document.getElementById("progress")
const nextBtn = document.getElementById("next")
const restartBtn = document.getElementById("restart")
const reviewMissedBtn = document.getElementById("review-missed")
const changeSettingsBtn = document.getElementById("change-settings")
const eraEl = document.getElementById("era")
const modeEl = document.getElementById("mode")
const questionCountEl = document.getElementById("question-count")
const randomModeEl = document.getElementById("random-mode")
const startEraFieldEl = document.getElementById("start-era-field")
const startEraEl = document.getElementById("start-era")
const applySettingsBtn = document.getElementById("apply-settings")
const settingsCardEl = document.querySelector(".settings-card")

let allQuestions = []
let selectedQuestions = []
let activeQuestions = []
let currentIndex = 0
let initialCorrectCount = 0
let initialWrongCount = 0
let reviewRound = 0
let answered = false
let unresolvedQuestionKeys = new Set()
let initialMissedQuestionKeys = new Set()
let lastQuizMissedQuestions = []
let currentStreak = 0
let bestStreak = 0
let sessionMode = "normal"
let audioContext = null

function shuffle(array) {
  const copy = [...array]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function setMessage(message, options = {}) {
  const { hidden = false, success = false, error = false } = options
  resultEl.textContent = message
  resultEl.classList.toggle("hidden", hidden)
  resultEl.classList.toggle("success", success)
  resultEl.classList.toggle("error", error)
}

function clearSummary() {
  summaryEl.innerHTML = ""
  summaryEl.classList.add("hidden")
}

function resetChoiceArea() {
  choicesEl.innerHTML = ""
}

function scrollElementIntoView(element) {
  if (!element) {
    return
  }

  const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth"

  window.requestAnimationFrame(() => {
    window.setTimeout(() => {
      element.scrollIntoView({ behavior, block: "center" })
    }, 120)
  })
}

function stripAttachedReading(text) {
  if (typeof text !== "string" || text.length === 0) {
    return text
  }

  return text.replace(
    /([^\s、。,.!?「」『』（）()【】\[\]]+?[一-龯々ヶヵ][^\s、。,.!?「」『』（）()【】\[\]]*?)([ァ-ヴー]{2,})(?=[、。,.!?」』）】\]\s]|$)/g,
    "$1"
  )
}

function sanitizeQuestionItem(item) {
  return {
    ...item,
    questionKey: item.id ?? `${item.era || ""}::${item.question}`,
    answer: stripAttachedReading(item.answer || ""),
    wrongChoices: Array.isArray(item.wrongChoices)
      ? item.wrongChoices.map((choice) => stripAttachedReading(choice))
      : [],
    explanation: stripAttachedReading(item.explanation || "")
  }
}

function createRuntimeQuestion(item) {
  return {
    ...item,
    choices: shuffle([item.answer, ...(item.wrongChoices || [])])
  }
}

function cloneQuestion(item) {
  return {
    ...item,
    wrongChoices: [...(item.wrongChoices || [])]
  }
}

function getAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  if (!AudioContextClass) {
    return null
  }

  if (!audioContext) {
    audioContext = new AudioContextClass()
  }

  return audioContext
}

async function prepareAudio() {
  const context = getAudioContext()
  if (!context) {
    return null
  }

  if (context.state === "suspended") {
    await context.resume()
  }

  return context
}

function playTone(context, {
  type = "sine",
  frequency = 440,
  startOffset = 0,
  duration = 0.12,
  volume = 0.18,
  attack = 0.01,
  release = 0.08,
  endFrequency = frequency
}) {
  const oscillator = context.createOscillator()
  const gainNode = context.createGain()
  const now = context.currentTime
  const startTime = now + startOffset
  const stopTime = startTime + duration

  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, startTime)
  oscillator.frequency.linearRampToValueAtTime(endFrequency, stopTime)

  gainNode.gain.setValueAtTime(0.0001, startTime)
  gainNode.gain.linearRampToValueAtTime(volume, startTime + attack)
  gainNode.gain.exponentialRampToValueAtTime(0.0001, stopTime + release)

  oscillator.connect(gainNode)
  gainNode.connect(context.destination)

  oscillator.start(startTime)
  oscillator.stop(stopTime + release)
}

async function playCorrectSound() {
  try {
    const context = await prepareAudio()
    if (!context) {
      return
    }

    playTone(context, {
      type: "triangle",
      frequency: 880,
      endFrequency: 1040,
      startOffset: 0,
      duration: 0.12,
      volume: 0.12,
      attack: 0.01,
      release: 0.1
    })

    playTone(context, {
      type: "triangle",
      frequency: 1175,
      endFrequency: 1318,
      startOffset: 0.11,
      duration: 0.16,
      volume: 0.14,
      attack: 0.01,
      release: 0.12
    })

    playTone(context, {
      type: "sine",
      frequency: 1568,
      endFrequency: 1760,
      startOffset: 0.22,
      duration: 0.24,
      volume: 0.1,
      attack: 0.01,
      release: 0.18
    })
  } catch (error) {
    console.error("correct sound error", error)
  }
}

async function playIncorrectSound() {
  try {
    const context = await prepareAudio()
    if (!context) {
      return
    }

    playTone(context, {
      type: "sawtooth",
      frequency: 190,
      endFrequency: 130,
      startOffset: 0,
      duration: 0.22,
      volume: 0.13,
      attack: 0.01,
      release: 0.08
    })

    playTone(context, {
      type: "square",
      frequency: 145,
      endFrequency: 105,
      startOffset: 0.06,
      duration: 0.28,
      volume: 0.08,
      attack: 0.01,
      release: 0.1
    })
  } catch (error) {
    console.error("incorrect sound error", error)
  }
}

function populateQuestionCountOptions(totalQuestions) {
  questionCountEl.innerHTML = ""

  const presets = [10, 20, 30, 50, 100].filter((count) => count < totalQuestions)
  const counts = [...presets, totalQuestions]

  counts.forEach((count) => {
    const option = document.createElement("option")
    option.value = String(count)
    option.textContent = count === totalQuestions ? `全部（${count}問）` : `${count}問`
    questionCountEl.appendChild(option)
  })

  const defaultCount = counts.includes(DEFAULT_QUESTION_COUNT)
    ? DEFAULT_QUESTION_COUNT
    : totalQuestions

  questionCountEl.value = String(defaultCount)
  questionCountEl.disabled = false
}

function populateStartEraOptions(questions) {
  const eras = []
  const seen = new Set()

  questions.forEach((item) => {
    if (!item.era || seen.has(item.era)) {
      return
    }

    seen.add(item.era)
    eras.push(item.era)
  })

  startEraEl.innerHTML = ""

  eras.forEach((era) => {
    const option = document.createElement("option")
    option.value = era
    option.textContent = `${era}から`
    startEraEl.appendChild(option)
  })

  if (eras.length > 0) {
    startEraEl.value = eras[0]
  }
}

function updateStartEraVisibility() {
  const shouldShow = !randomModeEl.checked && startEraEl.options.length > 0
  startEraFieldEl.classList.toggle("hidden", !shouldShow)
  startEraEl.disabled = !shouldShow
}

function getSelectedQuestionCount() {
  const selectedCount = Number.parseInt(questionCountEl.value, 10)
  if (!Number.isFinite(selectedCount) || selectedCount <= 0) {
    return Math.min(DEFAULT_QUESTION_COUNT, allQuestions.length)
  }

  return Math.min(selectedCount, allQuestions.length)
}

function getStartIndexForSelectedEra() {
  if (randomModeEl.checked) {
    return 0
  }

  const selectedEra = startEraEl.value
  const startIndex = allQuestions.findIndex((item) => item.era === selectedEra)
  return startIndex >= 0 ? startIndex : 0
}

function buildQuizFromSettings() {
  const shouldShuffleQuestions = randomModeEl.checked
  const questionCount = getSelectedQuestionCount()

  let source

  if (shouldShuffleQuestions) {
    source = shuffle(allQuestions)
  } else {
    const startIndex = getStartIndexForSelectedEra()
    source = allQuestions.slice(startIndex)
  }

  return source.slice(0, questionCount).map(cloneQuestion)
}

function clearProgress() {
  progressEl.innerHTML = ""
}

function renderStreakChip() {
  if (currentStreak <= 0) {
    return '<span class="progress-item">連続正解0</span>'
  }

  const fire = currentStreak >= 3 ? "🔥 " : ""
  return `<span class="progress-item">${fire}連続正解${currentStreak}</span>`
}

function updateModeBadge() {
  if (reviewRound > 0) {
    const prefix = sessionMode === "review-missed" ? "❌だけ復習モード" : "❌だった問題の復習"
    modeEl.textContent = `${prefix}（${reviewRound}周目）`
    modeEl.classList.remove("hidden")
    return
  }

  if (sessionMode === "review-missed") {
    modeEl.textContent = "❌だけ復習モード"
    modeEl.classList.remove("hidden")
    return
  }

  modeEl.textContent = ""
  modeEl.classList.add("hidden")
}

function getInitialAccuracy() {
  if (selectedQuestions.length === 0) {
    return 0
  }

  return Math.round((initialCorrectCount / selectedQuestions.length) * 100)
}

function updateProgress(answeredThisQuestion = false) {
  if (selectedQuestions.length === 0) {
    clearProgress()
    return
  }

  if (reviewRound === 0) {
    const questionNumber = Math.min(currentIndex + 1, selectedQuestions.length)
    const answeredCount = Math.min(
      currentIndex + (answeredThisQuestion ? 1 : 0),
      selectedQuestions.length
    )
    const accuracy = answeredCount === 0
      ? null
      : Math.round((initialCorrectCount / answeredCount) * 100)

    progressEl.innerHTML = `
      <span class="progress-item progress-primary">${questionNumber}/${selectedQuestions.length}問</span>
      <span class="progress-item">${initialCorrectCount}/${answeredCount}正解</span>
      <span class="progress-item">${accuracy === null ? "正解率--" : `正解率${accuracy}％`}</span>
      ${renderStreakChip()}
    `
    return
  }

  const reviewPosition = Math.min(currentIndex + 1, activeQuestions.length)
  progressEl.innerHTML = `
    <span class="progress-item progress-primary">復習${reviewRound}周目 ${reviewPosition}/${activeQuestions.length}問</span>
    <span class="progress-item">のこり${unresolvedQuestionKeys.size}問</span>
    <span class="progress-item">初回正解率${getInitialAccuracy()}％</span>
    ${renderStreakChip()}
  `
}

function getCurrentQuestion() {
  return activeQuestions[currentIndex]
}

function renderQuestion() {
  const item = getCurrentQuestion()
  if (!item) {
    showFinalScore()
    return
  }

  answered = false
  clearSummary()
  updateModeBadge()
  questionEl.textContent = item.question
  eraEl.textContent = item.era || ""
  eraEl.classList.toggle("hidden", !item.era)

  setMessage("", { hidden: true })
  nextBtn.disabled = true
  nextBtn.classList.add("hidden")
  restartBtn.classList.add("hidden")
  reviewMissedBtn.classList.add("hidden")
  changeSettingsBtn.classList.add("hidden")
  updateProgress(false)

  resetChoiceArea()

  item.choices.forEach((choice) => {
    const button = document.createElement("button")
    button.type = "button"
    button.className = "choice-btn"
    button.textContent = choice
    button.setAttribute("role", "listitem")
    button.addEventListener("click", () => selectChoice(choice))
    choicesEl.appendChild(button)
  })
}

function selectChoice(selectedChoice) {
  if (answered) {
    return
  }

  answered = true

  const item = getCurrentQuestion()
  const buttons = Array.from(document.querySelectorAll(".choice-btn"))
  const isCorrect = selectedChoice === item.answer

  buttons.forEach((button) => {
    button.disabled = true
    if (button.textContent === item.answer) {
      button.classList.add("correct")
    } else if (button.textContent === selectedChoice) {
      button.classList.add("incorrect")
    }
  })

  if (reviewRound === 0) {
    if (isCorrect) {
      initialCorrectCount += 1
      currentStreak += 1
      bestStreak = Math.max(bestStreak, currentStreak)
      setMessage(`正解です。${item.explanation}`, { success: true })
      void playCorrectSound()
    } else {
      currentStreak = 0
      unresolvedQuestionKeys.add(item.questionKey)
      initialMissedQuestionKeys.add(item.questionKey)
      setMessage(`不正解です。正解は「${item.answer}」です。この問題はあとでもう一度出ます。${item.explanation}`, { error: true })
      void playIncorrectSound()
    }
  } else if (isCorrect) {
    currentStreak += 1
    bestStreak = Math.max(bestStreak, currentStreak)
    unresolvedQuestionKeys.delete(item.questionKey)
    setMessage(`正解です。これでこの問題はクリアです。${item.explanation}`, { success: true })
    void playCorrectSound()
  } else {
    currentStreak = 0
    unresolvedQuestionKeys.add(item.questionKey)
    setMessage(`不正解です。正解は「${item.answer}」です。この問題はあとでもう一度出ます。${item.explanation}`, { error: true })
    void playIncorrectSound()
  }

  updateProgress(true)
  nextBtn.disabled = false
  nextBtn.classList.remove("hidden")
  scrollElementIntoView(nextBtn)
}

function beginReviewRound() {
  reviewRound += 1
  const remainingQuestions = selectedQuestions.filter((item) => unresolvedQuestionKeys.has(item.questionKey))
  activeQuestions = shuffle(remainingQuestions).map(createRuntimeQuestion)
  currentIndex = 0
  renderQuestion()
}

function getRankLabel(accuracy) {
  if (accuracy === 100) {
    return "S"
  }
  if (accuracy >= 80) {
    return "A"
  }
  if (accuracy >= 60) {
    return "B"
  }
  if (accuracy >= 40) {
    return "C"
  }
  return "D"
}

function getEvaluationComment(accuracy) {
  if (accuracy === 100) {
    return "完璧です！"
  }
  if (accuracy >= 80) {
    return "とてもよくできました！"
  }
  if (accuracy >= 60) {
    return "あと少しで高得点です！"
  }
  if (accuracy >= 40) {
    return "復習するとさらに伸びます！"
  }
  return "もう一度挑戦して覚えよう！"
}

function getEraComment() {
  const eras = [...new Set(selectedQuestions.map((item) => item.era).filter(Boolean))]
  if (eras.length === 0) {
    return ""
  }
  if (eras.length === 1) {
    return `${eras[0]}時代の重要事項を復習できました。`
  }
  return `${eras[0]}から${eras[eras.length - 1]}までを復習できました。`
}

function buildCelebrationBlock(isPerfectFirstTry) {
  const title = isPerfectFirstTry ? "💮 一発で全問クリア！ 💮" : "💮 ぜんぶクリア！ 💮"
  const sub = isPerfectFirstTry ? "すばらしいです。まちがいゼロでした。" : "❌だった問題も最後まで解き切りました。"
  return `
    <div class="summary-celebration" role="status" aria-live="polite">
      <div class="celebration-stamp">${title}</div>
      <div class="celebration-sub">${sub}</div>
      <div class="celebration-confetti" aria-hidden="true">🌸 ✨ 🌸 ✨ 🌸</div>
    </div>
  `
}

function showFinalScore() {
  const totalQuestions = selectedQuestions.length
  const accuracy = getInitialAccuracy()
  const rank = getRankLabel(accuracy)
  const comment = getEvaluationComment(accuracy)
  const wrongCountLabel = `${initialWrongCount}問`
  const reviewRoundsLabel = initialWrongCount === 0 ? "なし" : `${reviewRound}周`
  const masteryComment = initialWrongCount === 0
    ? "全問一発クリアです。"
    : "❌だった問題もすべてクリアしました。"
  const missedQuestions = selectedQuestions.filter((item) => initialMissedQuestionKeys.has(item.questionKey))
  const celebrationHtml = buildCelebrationBlock(initialWrongCount === 0)

  lastQuizMissedQuestions = missedQuestions.map(cloneQuestion)

  modeEl.classList.add("hidden")
  eraEl.classList.add("hidden")
  questionEl.textContent = "クイズ終了"
  resetChoiceArea()
  setMessage("", { hidden: true })
  clearProgress()

  summaryEl.innerHTML = `
    ${celebrationHtml}
    <p class="summary-heading">総合結果</p>
    <p class="summary-score">${totalQuestions}問中 ${initialCorrectCount}問正解！</p>
    <p class="summary-subscore">初回正解率 ${accuracy}％</p>
    <div class="summary-meta">
      <div class="summary-item">
        <span class="summary-label">ランク</span>
        <span class="summary-value">${rank}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">まちがえた問題</span>
        <span class="summary-value">${wrongCountLabel}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">復習周回</span>
        <span class="summary-value">${reviewRoundsLabel}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">最高連続正解</span>
        <span class="summary-value">${bestStreak}問</span>
      </div>
    </div>
    <p class="summary-comment">${comment}<br>${masteryComment}${getEraComment() ? `<br>${getEraComment()}` : ""}</p>
  `
  summaryEl.classList.remove("hidden")

  nextBtn.classList.add("hidden")
  restartBtn.classList.remove("hidden")
  changeSettingsBtn.classList.remove("hidden")
  reviewMissedBtn.classList.toggle("hidden", !(sessionMode === "normal" && lastQuizMissedQuestions.length > 0))
  scrollElementIntoView(summaryEl)
}

function advanceQuiz() {
  currentIndex += 1

  if (currentIndex < activeQuestions.length) {
    renderQuestion()
    return
  }

  if (reviewRound === 0) {
    initialWrongCount = unresolvedQuestionKeys.size
  }

  if (unresolvedQuestionKeys.size > 0) {
    beginReviewRound()
    return
  }

  showFinalScore()
}

function resetQuizState() {
  currentIndex = 0
  initialCorrectCount = 0
  initialWrongCount = 0
  reviewRound = 0
  answered = false
  unresolvedQuestionKeys = new Set()
  initialMissedQuestionKeys = new Set()
  currentStreak = 0
  bestStreak = 0
  clearSummary()
}

function startQuiz() {
  if (allQuestions.length === 0) {
    return
  }

  sessionMode = "normal"
  selectedQuestions = buildQuizFromSettings()
  activeQuestions = selectedQuestions.map(createRuntimeQuestion)
  lastQuizMissedQuestions = []
  resetQuizState()
  renderQuestion()
}

function startMissedReviewQuiz() {
  if (lastQuizMissedQuestions.length === 0) {
    return
  }

  sessionMode = "review-missed"
  selectedQuestions = lastQuizMissedQuestions.map(cloneQuestion)
  activeQuestions = selectedQuestions.map(createRuntimeQuestion)
  resetQuizState()
  renderQuestion()
}

async function loadQuiz() {
  try {
    questionEl.textContent = "問題を読み込み中…"
    eraEl.classList.add("hidden")
    modeEl.classList.add("hidden")
    resetChoiceArea()
    clearSummary()
    setMessage("", { hidden: true })
    clearProgress()
    nextBtn.classList.add("hidden")
    restartBtn.classList.add("hidden")
    reviewMissedBtn.classList.add("hidden")
    changeSettingsBtn.classList.add("hidden")
    questionCountEl.disabled = true
    randomModeEl.disabled = true
    startEraEl.disabled = true
    applySettingsBtn.disabled = true

    const response = await fetch(DATA_PATH, { cache: "no-store" })
    if (!response.ok) {
      throw new Error("問題データを読み込めませんでした。")
    }

    const rawQuiz = await response.json()
    if (!Array.isArray(rawQuiz) || rawQuiz.length === 0) {
      throw new Error("出題できる問題が見つかりませんでした。")
    }

    allQuestions = rawQuiz.map(sanitizeQuestionItem)
    populateQuestionCountOptions(allQuestions.length)
    populateStartEraOptions(allQuestions)
    randomModeEl.checked = true
    randomModeEl.disabled = false
    updateStartEraVisibility()
    applySettingsBtn.disabled = false
    startQuiz()
  } catch (error) {
    eraEl.classList.add("hidden")
    modeEl.classList.add("hidden")
    questionEl.textContent = "読み込みエラー"
    resetChoiceArea()
    clearSummary()
    clearProgress()
    nextBtn.classList.add("hidden")
    restartBtn.classList.add("hidden")
    reviewMissedBtn.classList.add("hidden")
    changeSettingsBtn.classList.add("hidden")
    questionCountEl.innerHTML = ""
    questionCountEl.disabled = true
    randomModeEl.disabled = true
    startEraEl.innerHTML = ""
    startEraEl.disabled = true
    updateStartEraVisibility()
    applySettingsBtn.disabled = true
    setMessage(error.message || "問題データを読み込めませんでした。", { error: true })
  }
}

nextBtn.addEventListener("click", () => {
  advanceQuiz()
})

restartBtn.addEventListener("click", () => {
  startQuiz()
})

reviewMissedBtn.addEventListener("click", () => {
  startMissedReviewQuiz()
})

changeSettingsBtn.addEventListener("click", () => {
  scrollElementIntoView(settingsCardEl)
})

randomModeEl.addEventListener("change", () => {
  updateStartEraVisibility()
})

applySettingsBtn.addEventListener("click", () => {
  startQuiz()
})

loadQuiz()
