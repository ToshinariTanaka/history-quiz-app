const quiz = [
  { q: "大化の改新が始まった年は？", a: "645年" },
  { q: "平安京に都が移された年は？", a: "794年" },
  { q: "鎌倉幕府を開いた人物は？", a: "源頼朝" },
  { q: "応仁の乱が始まった年は？", a: "1467年" },
  { q: "明治維新が始まった年は？", a: "1868年" }
];

const questionEl = document.getElementById("question");
const answerEl = document.getElementById("answer");
const showAnswerBtn = document.getElementById("show-answer");
const nextBtn = document.getElementById("next");

let currentIndex = 0;

function renderQuestion() {
  const item = quiz[currentIndex];
  questionEl.textContent = item.q;
  answerEl.textContent = `答え：${item.a}`;
  answerEl.classList.add("hidden");
}

showAnswerBtn.addEventListener("click", () => {
  answerEl.classList.remove("hidden");
});

nextBtn.addEventListener("click", () => {
  currentIndex = (currentIndex + 1) % quiz.length;
  renderQuestion();
});

renderQuestion();
