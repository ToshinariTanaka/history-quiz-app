const DATA_PATH = "quiz-data_rekishi3.json";
const DEFAULT_QUESTION_COUNT = 10;

const questionEl = document.getElementById("question");
const choicesEl = document.getElementById("choices");
const resultEl = document.getElementById("result");
const progressEl = document.getElementById("progress");
const nextBtn = document.getElementById("next");
const restartBtn = document.getElementById("restart");
const eraEl = document.getElementById("era");
const questionCountEl = document.getElementById("question-count");
const randomModeEl = document.getElementById("random-mode");
const applySettingsBtn = document.getElementById("apply-settings");

let allQuestions = [];
let quiz = [];
let currentIndex = 0;
let score = 0;
let answered = false;
let audioContext = null;

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function setMessage(message, options = {}) {
  const { hidden = false, success = false, error = false } = options;
  resultEl.textContent = message;
  resultEl.classList.toggle("hidden", hidden);
  resultEl.classList.toggle("success", success);
  resultEl.classList.toggle("error", error);
}

function resetChoiceArea() {
  choicesEl.innerHTML = "";
}

function stripAttachedReading(text) {
  if (typeof text !== "string" || text.length === 0) {
    return text;
  }

  return text.replace(
    /([^\s、。,.!?「」『』（）()【】\[\]]+?[一-龯々ヶヵ][^\s、。,.!?「」『』（）()【】\[\]]*?)([ァ-ヴー]{2,})(?=[、。,.!?」』）】\]\s]|$)/g,
    "$1"
  );
}

function sanitizeQuestionItem(item) {
  return {
    ...item,
    answer: stripAttachedReading(item.answer || ""),
    wrongChoices: Array.isArray(item.wrongChoices)
      ? item.wrongChoices.map((choice) => stripAttachedReading(choice))
      : [],
    explanation: stripAttachedReading(item.explanation || "")
  };
}

function createRuntimeQuestion(item) {
  return {
    ...item,
    choices: shuffle([item.answer, ...(item.wrongChoices || [])])
  };
}

function getAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return null;
  }

  if (!audioContext) {
    audioContext = new AudioContextClass();
  }

  return audioContext;
}

async function prepareAudio() {
  const context = getAudioContext();
  if (!context) {
    return null;
  }

  if (context.state === "suspended") {
    await context.resume();
  }

  return context;
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
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();
  const now = context.currentTime;
  const startTime = now + startOffset;
  const stopTime = startTime + duration;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startTime);
  oscillator.frequency.linearRampToValueAtTime(endFrequency, stopTime);

  gainNode.gain.setValueAtTime(0.0001, startTime);
  gainNode.gain.linearRampToValueAtTime(volume, startTime + attack);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, stopTime + release);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);

  oscillator.start(startTime);
  oscillator.stop(stopTime + release);
}

async function playCorrectSound() {
  try {
    const context = await prepareAudio();
    if (!context) {
      return;
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
    });

    playTone(context, {
      type: "triangle",
      frequency: 1175,
      endFrequency: 1318,
      startOffset: 0.11,
      duration: 0.16,
      volume: 0.14,
      attack: 0.01,
      release: 0.12
    });

    playTone(context, {
      type: "sine",
      frequency: 1568,
      endFrequency: 1760,
      startOffset: 0.22,
      duration: 0.24,
      volume: 0.1,
      attack: 0.01,
      release: 0.18
    });
  } catch (error) {
    console.error("correct sound error", error);
  }
}

async function playIncorrectSound() {
  try {
    const context = await prepareAudio();
    if (!context) {
      return;
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
    });

    playTone(context, {
      type: "square",
      frequency: 145,
      endFrequency: 105,
      startOffset: 0.06,
      duration: 0.28,
      volume: 0.08,
      attack: 0.01,
      release: 0.1
    });
  } catch (error) {
    console.error("incorrect sound error", error);
  }
}

function populateQuestionCountOptions(totalQuestions) {
  questionCountEl.innerHTML = "";

  const presets = [10, 20, 30, 50, 100].filter((count) => count < totalQuestions);
  const counts = [...presets, totalQuestions];

  counts.forEach((count) => {
    const option = document.createElement("option");
    option.value = String(count);
    option.textContent = count === totalQuestions ? `全部（${count}問）` : `${count}問`;
    questionCountEl.appendChild(option);
  });

  const defaultCount = counts.includes(DEFAULT_QUESTION_COUNT)
    ? DEFAULT_QUESTION_COUNT
    : totalQuestions;

  questionCountEl.value = String(defaultCount);
  randomModeEl.checked = true;
  questionCountEl.disabled = false;
  randomModeEl.disabled = false;
  applySettingsBtn.disabled = false;
}

function getSelectedQuestionCount() {
  const selectedCount = Number.parseInt(questionCountEl.value, 10);
  if (!Number.isFinite(selectedCount) || selectedCount <= 0) {
    return Math.min(DEFAULT_QUESTION_COUNT, allQuestions.length);
  }

  return Math.min(selectedCount, allQuestions.length);
}

function buildQuizFromSettings() {
  const shouldShuffleQuestions = randomModeEl.checked;
  const questionCount = getSelectedQuestionCount();

  const source = shouldShuffleQuestions ? shuffle(allQuestions) : [...allQuestions];
  return source.slice(0, questionCount).map(createRuntimeQuestion);
}

function renderQuestion() {
  const item = quiz[currentIndex];
  if (!item) {
    showFinalScore();
    return;
  }

  answered = false;
  questionEl.textContent = item.question;
  eraEl.textContent = item.era || "";
  eraEl.classList.toggle("hidden", !item.era);

  setMessage("", { hidden: true });
  nextBtn.disabled = true;
  nextBtn.classList.add("hidden");
  restartBtn.classList.add("hidden");
  progressEl.textContent = `${currentIndex + 1} / ${quiz.length} 問`;

  resetChoiceArea();

  item.choices.forEach((choice) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice-btn";
    button.textContent = choice;
    button.setAttribute("role", "listitem");
    button.addEventListener("click", () => selectChoice(choice));
    choicesEl.appendChild(button);
  });
}

function selectChoice(selectedChoice) {
  if (answered) return;
  answered = true;

  const item = quiz[currentIndex];
  const buttons = Array.from(document.querySelectorAll(".choice-btn"));

  buttons.forEach((button) => {
    button.disabled = true;
    if (button.textContent === item.answer) {
      button.classList.add("correct");
    } else if (button.textContent === selectedChoice) {
      button.classList.add("incorrect");
    }
  });

  if (selectedChoice === item.answer) {
    score += 1;
    setMessage(`正解です。${item.explanation}`, { success: true });
    void playCorrectSound();
  } else {
    setMessage(`不正解です。正解は「${item.answer}」です。${item.explanation}`, { error: true });
    void playIncorrectSound();
  }

  nextBtn.disabled = false;
  nextBtn.classList.remove("hidden");
}

function showFinalScore() {
  eraEl.classList.add("hidden");
  questionEl.textContent = "クイズ終了";
  resetChoiceArea();
  setMessage(`${quiz.length}問中 ${score}問正解でした。`, { success: true });
  progressEl.textContent = "";
  nextBtn.classList.add("hidden");
  restartBtn.classList.remove("hidden");
}

function startQuiz() {
  if (allQuestions.length === 0) {
    return;
  }

  quiz = buildQuizFromSettings();
  currentIndex = 0;
  score = 0;
  renderQuestion();
}

async function loadQuiz() {
  try {
    questionEl.textContent = "問題を読み込み中…";
    eraEl.classList.add("hidden");
    resetChoiceArea();
    setMessage("", { hidden: true });
    progressEl.textContent = "";
    nextBtn.classList.add("hidden");
    restartBtn.classList.add("hidden");
    questionCountEl.disabled = true;
    randomModeEl.disabled = true;
    applySettingsBtn.disabled = true;

    const response = await fetch(DATA_PATH, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("問題データを読み込めませんでした。");
    }

    const rawQuiz = await response.json();
    if (!Array.isArray(rawQuiz) || rawQuiz.length === 0) {
      throw new Error("出題できる問題が見つかりませんでした。");
    }

    allQuestions = rawQuiz.map(sanitizeQuestionItem);
    populateQuestionCountOptions(allQuestions.length);
    startQuiz();
  } catch (error) {
    eraEl.classList.add("hidden");
    questionEl.textContent = "読み込みエラー";
    resetChoiceArea();
    progressEl.textContent = "";
    nextBtn.classList.add("hidden");
    restartBtn.classList.add("hidden");
    questionCountEl.innerHTML = "";
    questionCountEl.disabled = true;
    randomModeEl.disabled = true;
    applySettingsBtn.disabled = true;
    setMessage(error.message || "問題データを読み込めませんでした。", { error: true });
  }
}

nextBtn.addEventListener("click", () => {
  currentIndex += 1;
  if (currentIndex < quiz.length) {
    renderQuestion();
  } else {
    showFinalScore();
  }
});

restartBtn.addEventListener("click", () => {
  startQuiz();
});

applySettingsBtn.addEventListener("click", () => {
  startQuiz();
});

loadQuiz();
