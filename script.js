const quiz = [
  {
    question: "大化の改新が始まった年は？",
    choices: ["645年", "710年", "794年", "1192年"],
    answerIndex: 0
  },
  {
    question: "平安京に都が移された年は？",
    choices: ["645年", "710年", "794年", "1185年"],
    answerIndex: 2
  },
  {
    question: "鎌倉幕府を開いた人物は？",
    choices: ["源頼朝", "平清盛", "足利尊氏", "徳川家康"],
    answerIndex: 0
  },
  {
    question: "応仁の乱が始まった年は？",
    choices: ["1333年", "1467年", "1600年", "1868年"],
    answerIndex: 1
  },
  {
    question: "明治維新が始まった年は？",
    choices: ["1549年", "1603年", "1776年", "1868年"],
    answerIndex: 3
  }
];

const questionEl = document.getElementById("question");
const choicesEl = document.getElementById("choices");
const resultEl = document.getElementById("result");
const progressEl = document.getElementById("progress");
const nextBtn = document.getElementById("next");

let currentIndex = 0;
let answered = false;

function renderQuestion() {
  const item = quiz[currentIndex];
  answered = false;
  questionEl.textContent = item.question;
  resultEl.textContent = "";
  resultEl.classList.add("hidden");
  nextBtn.disabled = true;
  progressEl.textContent = `${currentIndex + 1} / ${quiz.length} 問`;

  choicesEl.innerHTML = "";
  item.choices.forEach((choice, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice-btn";
    button.textContent = choice;
    button.setAttribute("role", "listitem");
    button.addEventListener("click", () => selectChoice(index));
    choicesEl.appendChild(button);
  });
}

function selectChoice(selectedIndex) {
  if (answered) return;
  answered = true;

  const item = quiz[currentIndex];
  const buttons = Array.from(document.querySelectorAll(".choice-btn"));

  buttons.forEach((button, index) => {
    button.disabled = true;
    if (index === item.answerIndex) {
      button.classList.add("correct");
    } else if (index === selectedIndex) {
      button.classList.add("incorrect");
    }
  });

  if (selectedIndex === item.answerIndex) {
    resultEl.textContent = "正解です。";
  } else {
    resultEl.textContent = `不正解です。正解は「${item.choices[item.answerIndex]}」です。`;
  }

  resultEl.classList.remove("hidden");
  nextBtn.disabled = false;
}

nextBtn.addEventListener("click", () => {
  currentIndex = (currentIndex + 1) % quiz.length;
  renderQuestion();
});

renderQuestion();
