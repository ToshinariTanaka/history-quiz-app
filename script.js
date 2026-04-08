const DATA_PATH = "quiz-data_rekishi3.json";

const questionEl = document.getElementById("question");
const choicesEl = document.getElementById("choices");
const resultEl = document.getElementById("result");
const progressEl = document.getElementById("progress");
const nextBtn = document.getElementById("next");
const restartBtn = document.getElementById("restart");
const eraEl = document.getElementById("era");

let quiz = [];
let currentIndex = 0;
let score = 0;
let answered = false;

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

function createRuntimeQuestion(item) {
  return {
    ...item,
    choices: shuffle([item.answer, ...(item.wrongChoices || [])])
  };
}

function renderQuestion() {
  const item = quiz[currentIndex];
  if (!item) return;

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
  } else {
    setMessage(`不正解です。正解は「${item.answer}」です。${item.explanation}`, { error: true });
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

async function loadQuiz() {
  try {
    questionEl.textContent = "問題を読み込み中…";
    eraEl.classList.add("hidden");
    resetChoiceArea();
    setMessage("", { hidden: true });
    progressEl.textContent = "";
    nextBtn.classList.add("hidden");
    restartBtn.classList.add("hidden");

    const response = await fetch(DATA_PATH, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("問題データを読み込めませんでした。");
    }

    const rawQuiz = await response.json();
    if (!Array.isArray(rawQuiz) || rawQuiz.length === 0) {
      throw new Error("出題できる問題が見つかりませんでした。");
    }

    quiz = rawQuiz.map(createRuntimeQuestion);
    currentIndex = 0;
    score = 0;
    renderQuestion();
  } catch (error) {
    eraEl.classList.add("hidden");
    questionEl.textContent = "読み込みエラー";
    resetChoiceArea();
    progressEl.textContent = "";
    nextBtn.classList.add("hidden");
    restartBtn.classList.add("hidden");
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
  if (quiz.length === 0) {
    loadQuiz();
    return;
  }

  currentIndex = 0;
  score = 0;
  quiz = shuffle(quiz).map(createRuntimeQuestion);
  renderQuestion();
});

loadQuiz();
