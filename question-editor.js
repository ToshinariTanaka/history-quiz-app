const DATA_PATH = "quiz-data_rekishi3.json"
const SHEET_NAME = "questions"
const TEMPLATE_HEADERS = ["id", "era", "question", "answer", "wrong1", "wrong2", "wrong3", "explanation"]

const editorBodyEl = document.getElementById("editor-body")
const importFileEl = document.getElementById("import-file")
const loadCurrentJsonBtn = document.getElementById("load-current-json")
const downloadTemplateBtn = document.getElementById("download-template")
const addRowBtn = document.getElementById("add-row")
const validateDataBtn = document.getElementById("validate-data")
const normalizeIdsBtn = document.getElementById("normalize-ids")
const exportJsonBtn = document.getElementById("export-json")
const exportExcelBtn = document.getElementById("export-excel")
const copyJsonBtn = document.getElementById("copy-json")
const previewAreaEl = document.getElementById("preview-area")
const jsonOutputEl = document.getElementById("json-output")
const validationOutputEl = document.getElementById("validation-output")
const questionCountEl = document.getElementById("question-count")
const sourceLabelEl = document.getElementById("source-label")
const statusMessageEl = document.getElementById("status-message")

let rows = []
let activeIndex = -1
let sourceLabel = "未読込"

function createEmptyRow(id = "") {
  return {
    id: id,
    era: "",
    question: "",
    answer: "",
    wrong1: "",
    wrong2: "",
    wrong3: "",
    explanation: ""
  }
}

function setStatus(message, type = "ok") {
  statusMessageEl.textContent = message
  statusMessageEl.style.color = type === "error"
    ? "#b91c1c"
    : type === "warn"
      ? "#92400e"
      : "#166534"
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function normalizeCell(value) {
  if (value === undefined || value === null) {
    return ""
  }
  return String(value).replace(/\r\n/g, "\n").trim()
}

function suggestNextId() {
  const nums = rows
    .map((row) => Number.parseInt(String(row.id).trim(), 10))
    .filter((value) => Number.isFinite(value))
  if (nums.length === 0) {
    return "1"
  }
  return String(Math.max(...nums) + 1)
}

function convertCustomNotationToUnicode(text) {
  if (!text) {
    return ""
  }

  let result = String(text)

  const subMap = { "0":"₀","1":"₁","2":"₂","3":"₃","4":"₄","5":"₅","6":"₆","7":"₇","8":"₈","9":"₉","+":"₊","-":"₋","=":"₌","(":"₍", ")":"₎" }
  const supMap = { "0":"⁰","1":"¹","2":"²","3":"³","4":"⁴","5":"⁵","6":"⁶","7":"⁷","8":"⁸","9":"⁹","+":"⁺","-":"⁻","=":"⁼","(":"⁽", ")":"⁾","n":"ⁿ","i":"ⁱ" }

  function mapChars(content, map) {
    return content.split("").map((char) => map[char] || char).join("")
  }

  result = result.replace(/frac\(([^,]+),\s*([^\)]+)\)/g, (_, numerator, denominator) => `${numerator.trim()}/${denominator.trim()}`)
  result = result.replace(/sqrt\(([^\)]+)\)/g, (_, body) => `√(${body.trim()})`)
  result = result.replace(/root\(([^,]+),\s*([^\)]+)\)/g, (_, degree, body) => `${degree.trim()}√(${body.trim()})`)
  result = result.replace(/vec\(([^\)]+)\)/g, (_, body) => `→${body.trim()}`)
  result = result.replace(/sum_\{([^}]*)\}\^\{([^}]*)\}/g, (_, lower, upper) => `Σ(${lower}→${upper})`)
  result = result.replace(/int_\{([^}]*)\}\^\{([^}]*)\}/g, (_, lower, upper) => `∫(${lower}→${upper})`)
  result = result.replace(/int\b/g, "∫")
  result = result.replace(/<->/g, "⇄")
  result = result.replace(/->/g, "→")
  result = result.replace(/\*([0-9A-Za-z])/g, "·$1")
  result = result.replace(/_\{([^}]*)\}/g, (_, body) => mapChars(body, subMap))
  result = result.replace(/_([A-Za-z0-9+\-()=])/g, (_, body) => mapChars(body, subMap))
  result = result.replace(/\^\{([^}]*)\}/g, (_, body) => mapChars(body, supMap))
  result = result.replace(/\^([A-Za-z0-9+\-()=])/g, (_, body) => mapChars(body, supMap))
  result = result.replace(/\binf\b/g, "∞")

  return result
}

function buildJsonData() {
  return rows.map((row) => ({
    id: Number.parseInt(String(row.id).trim(), 10) || String(row.id).trim(),
    era: normalizeCell(row.era),
    question: normalizeCell(row.question),
    answer: normalizeCell(row.answer),
    wrongChoices: [normalizeCell(row.wrong1), normalizeCell(row.wrong2), normalizeCell(row.wrong3)],
    explanation: normalizeCell(row.explanation)
  }))
}

function renderJsonOutput() {
  const data = buildJsonData()
  jsonOutputEl.value = JSON.stringify(data, null, 2)
}

function updateMeta() {
  questionCountEl.textContent = String(rows.length)
  sourceLabelEl.textContent = sourceLabel
}

function selectRow(index) {
  activeIndex = index
  renderTable()
  renderPreview()
}

function handleFieldChange(index, key, value) {
  rows[index][key] = value
  renderJsonOutput()
  if (activeIndex === index) {
    renderPreview()
  }
}

function cloneRow(index) {
  const source = rows[index]
  const cloned = {
    ...source,
    id: suggestNextId()
  }
  rows.splice(index + 1, 0, cloned)
  setStatus("問題を複製しました。", "ok")
  renderAll()
  selectRow(index + 1)
}

function deleteRow(index) {
  rows.splice(index, 1)
  if (rows.length === 0) {
    rows = [createEmptyRow(suggestNextId())]
    activeIndex = 0
  } else if (activeIndex >= rows.length) {
    activeIndex = rows.length - 1
  }
  setStatus("問題を削除しました。", "warn")
  renderAll()
}

function renderTable() {
  editorBodyEl.innerHTML = rows.map((row, index) => `
    <tr class="${index === activeIndex ? "active-row" : ""}" data-index="${index}">
      <td class="cell-short"><input data-key="id" value="${escapeHtml(row.id)}" /></td>
      <td class="cell-era"><input data-key="era" value="${escapeHtml(row.era)}" /></td>
      <td class="cell-long"><textarea data-key="question">${escapeHtml(row.question)}</textarea></td>
      <td class="cell-medium"><textarea data-key="answer">${escapeHtml(row.answer)}</textarea></td>
      <td class="cell-medium"><textarea data-key="wrong1">${escapeHtml(row.wrong1)}</textarea></td>
      <td class="cell-medium"><textarea data-key="wrong2">${escapeHtml(row.wrong2)}</textarea></td>
      <td class="cell-medium"><textarea data-key="wrong3">${escapeHtml(row.wrong3)}</textarea></td>
      <td class="cell-explanation"><textarea data-key="explanation">${escapeHtml(row.explanation)}</textarea></td>
      <td class="cell-actions">
        <div class="action-stack">
          <button type="button" class="row-clone" data-action="clone">複製</button>
          <button type="button" class="row-delete" data-action="delete">削除</button>
        </div>
      </td>
    </tr>
  `).join("")

  Array.from(editorBodyEl.querySelectorAll("tr")).forEach((rowEl) => {
    const index = Number.parseInt(rowEl.dataset.index, 10)
    rowEl.addEventListener("click", (event) => {
      if (event.target.closest("button")) {
        return
      }
      selectRow(index)
    })

    Array.from(rowEl.querySelectorAll("input, textarea")).forEach((field) => {
      field.addEventListener("focus", () => selectRow(index))
      field.addEventListener("input", (event) => {
        handleFieldChange(index, field.dataset.key, event.target.value)
      })
    })

    const cloneBtn = rowEl.querySelector('[data-action="clone"]')
    const deleteBtn = rowEl.querySelector('[data-action="delete"]')
    cloneBtn.addEventListener("click", () => cloneRow(index))
    deleteBtn.addEventListener("click", () => deleteRow(index))
  })
}

function renderPreview() {
  const row = rows[activeIndex]
  if (!row) {
    previewAreaEl.innerHTML = '<p class="preview-empty">行を選ぶと、質問と選択肢の見え方をここで確認できます。</p>'
    return
  }

  const previewQuestion = convertCustomNotationToUnicode(normalizeCell(row.question))
  const previewAnswer = convertCustomNotationToUnicode(normalizeCell(row.answer))
  const previewWrongs = [row.wrong1, row.wrong2, row.wrong3].map((value) => convertCustomNotationToUnicode(normalizeCell(value)))
  const previewExplanation = convertCustomNotationToUnicode(normalizeCell(row.explanation))

  previewAreaEl.innerHTML = `
    <div class="preview-block">
      <p class="preview-label">時代</p>
      <p class="preview-text">${escapeHtml(row.era || "未入力")}</p>
    </div>
    <div class="preview-block">
      <p class="preview-label">問題文</p>
      <p class="preview-text">${escapeHtml(previewQuestion)}</p>
    </div>
    <div class="preview-block">
      <p class="preview-label">選択肢</p>
      <div class="preview-choices">
        <div class="preview-choice">${escapeHtml(previewAnswer || "")}</div>
        ${previewWrongs.map((item) => `<div class="preview-choice">${escapeHtml(item || "")}</div>`).join("")}
      </div>
    </div>
    <div class="preview-block">
      <p class="preview-label">解説</p>
      <p class="preview-text">${escapeHtml(previewExplanation || "")}</p>
    </div>
  `
}

function renderValidation(items) {
  if (!items || items.length === 0) {
    validationOutputEl.innerHTML = '<p class="validation-item ok">問題は見つかりませんでした。</p>'
    return
  }

  const errorCount = items.filter((item) => item.level === "error").length
  const warnCount = items.filter((item) => item.level === "warn").length
  const summary = `エラー ${errorCount}件 / 注意 ${warnCount}件`

  validationOutputEl.innerHTML = `
    <p class="validation-summary">${summary}</p>
    <ul class="validation-list">
      ${items.map((item) => `<li><p class="validation-item ${item.level}">${escapeHtml(item.message)}</p></li>`).join("")}
    </ul>
  `
}

function validateRows() {
  const issues = []
  const seenIds = new Map()
  rows.forEach((row, index) => {
    const no = index + 1
    const id = normalizeCell(row.id)
    const era = normalizeCell(row.era)
    const question = normalizeCell(row.question)
    const answer = normalizeCell(row.answer)
    const wrongs = [normalizeCell(row.wrong1), normalizeCell(row.wrong2), normalizeCell(row.wrong3)]
    const explanation = normalizeCell(row.explanation)

    if (!id) {
      issues.push({ level: "warn", message: `${no}行目: id が空です。` })
    } else if (seenIds.has(id)) {
      issues.push({ level: "error", message: `${no}行目: id「${id}」が ${seenIds.get(id)}行目と重複しています。` })
    } else {
      seenIds.set(id, no)
    }

    if (!era) issues.push({ level: "warn", message: `${no}行目: era が空です。` })
    if (!question) issues.push({ level: "error", message: `${no}行目: question が空です。` })
    if (!answer) issues.push({ level: "error", message: `${no}行目: answer が空です。` })
    if (wrongs.some((value) => !value)) issues.push({ level: "error", message: `${no}行目: wrong1〜wrong3 をすべて入力してください。` })
    if (!explanation) issues.push({ level: "warn", message: `${no}行目: explanation が空です。` })

    const filteredWrongs = wrongs.filter(Boolean)
    if (filteredWrongs.includes(answer)) {
      issues.push({ level: "error", message: `${no}行目: 正解が誤答に混ざっています。` })
    }

    const duplicateWrongs = new Set(filteredWrongs)
    if (duplicateWrongs.size !== filteredWrongs.length) {
      issues.push({ level: "warn", message: `${no}行目: 誤答どうしが重複しています。` })
    }

    const mixedFullWidth = /[Ａ-Ｚａ-ｚ０-９（）]/.test([question, answer, ...wrongs, explanation].join(" "))
    if (mixedFullWidth) {
      issues.push({ level: "warn", message: `${no}行目: 全角英数字または全角括弧が含まれています。入力ルールを確認してください。` })
    }
  })

  renderValidation(issues)
  if (issues.length === 0) {
    setStatus("入力チェック: 問題は見つかりませんでした。", "ok")
  } else if (issues.some((item) => item.level === "error")) {
    setStatus("入力チェック: エラーがあります。下の一覧を確認してください。", "error")
  } else {
    setStatus("入力チェック: 注意点があります。下の一覧を確認してください。", "warn")
  }
}

function normalizeIds() {
  const used = new Set(
    rows.map((row) => Number.parseInt(String(row.id).trim(), 10)).filter((value) => Number.isFinite(value))
  )

  let nextId = used.size === 0 ? 1 : Math.max(...used) + 1
  let changed = 0

  rows.forEach((row) => {
    const current = Number.parseInt(String(row.id).trim(), 10)
    if (!Number.isFinite(current)) {
      while (used.has(nextId)) {
        nextId += 1
      }
      row.id = String(nextId)
      used.add(nextId)
      nextId += 1
      changed += 1
    }
  })

  renderAll()
  setStatus(changed === 0 ? "空の id はありませんでした。" : `空の id を ${changed}件 自動採番しました。`, changed === 0 ? "ok" : "warn")
}

function convertImportedRows(rawRows) {
  return rawRows
    .map((raw) => {
      const row = createEmptyRow()
      TEMPLATE_HEADERS.forEach((header) => {
        row[header] = normalizeCell(raw[header])
      })
      return row
    })
    .filter((row) => TEMPLATE_HEADERS.some((header) => row[header]))
}

function renderAll() {
  if (rows.length === 0) {
    rows = [createEmptyRow("1")]
  }
  if (activeIndex < 0) {
    activeIndex = 0
  }
  renderTable()
  renderPreview()
  renderJsonOutput()
  updateMeta()
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}

function exportExcel() {
  const exportRows = rows.map((row) => ({
    id: normalizeCell(row.id),
    era: normalizeCell(row.era),
    question: normalizeCell(row.question),
    answer: normalizeCell(row.answer),
    wrong1: normalizeCell(row.wrong1),
    wrong2: normalizeCell(row.wrong2),
    wrong3: normalizeCell(row.wrong3),
    explanation: normalizeCell(row.explanation)
  }))

  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(exportRows, { header: TEMPLATE_HEADERS })
  XLSX.utils.book_append_sheet(workbook, worksheet, SHEET_NAME)
  XLSX.writeFile(workbook, "history-question-bank.xlsx", { bookType: "xlsx" })
  setStatus("Excel を出力しました。", "ok")
}

function downloadTemplate() {
  const workbook = XLSX.utils.book_new()
  const templateRows = [
    {
      id: "1",
      era: "古代",
      question: "水の化学式は何か。",
      answer: "H_2O",
      wrong1: "CO_2",
      wrong2: "O_2",
      wrong3: "H_2",
      explanation: "水の化学式は H_2O である。"
    },
    {
      id: "2",
      era: "数学",
      question: "平方根の例として正しいものはどれか。",
      answer: "sqrt(2)",
      wrong1: "sum_{k=1}^{n} a_k",
      wrong2: "vec(AB)",
      wrong3: "int_{0}^{1} x dx",
      explanation: "平方根は sqrt(...) の記法で入力する。"
    }
  ]
  const worksheet = XLSX.utils.json_to_sheet(templateRows, { header: TEMPLATE_HEADERS })
  XLSX.utils.book_append_sheet(workbook, worksheet, SHEET_NAME)
  XLSX.writeFile(workbook, "question-template.xlsx", { bookType: "xlsx" })
  setStatus("Excel テンプレートを出力しました。", "ok")
}

function exportJson() {
  const text = JSON.stringify(buildJsonData(), null, 2)
  jsonOutputEl.value = text
  const blob = new Blob([text], { type: "application/json;charset=utf-8" })
  downloadBlob(blob, DATA_PATH)
  setStatus("JSON を出力しました。", "ok")
}

async function copyJson() {
  try {
    if (!jsonOutputEl.value.trim()) {
      renderJsonOutput()
    }
    await navigator.clipboard.writeText(jsonOutputEl.value)
    setStatus("JSON をコピーしました。", "ok")
  } catch (error) {
    console.error(error)
    setStatus("JSON のコピーに失敗しました。", "error")
  }
}

async function loadCurrentJson() {
  try {
    const response = await fetch(DATA_PATH, { cache: "no-store" })
    if (!response.ok) {
      throw new Error("現在の JSON を読み込めませんでした。")
    }
    const data = await response.json()
    rows = data.map((item) => ({
      id: normalizeCell(item.id),
      era: normalizeCell(item.era),
      question: normalizeCell(item.question),
      answer: normalizeCell(item.answer),
      wrong1: normalizeCell(item.wrongChoices?.[0]),
      wrong2: normalizeCell(item.wrongChoices?.[1]),
      wrong3: normalizeCell(item.wrongChoices?.[2]),
      explanation: normalizeCell(item.explanation)
    }))
    sourceLabel = DATA_PATH
    activeIndex = 0
    renderAll()
    setStatus("現在の JSON を読み込みました。", "ok")
  } catch (error) {
    console.error(error)
    setStatus(error.message || "現在の JSON の読込に失敗しました。", "error")
  }
}

function handleImportedWorkbook(workbook, label) {
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: "" })
  const importedRows = convertImportedRows(rawRows)
  if (importedRows.length === 0) {
    setStatus("有効な行が見つかりませんでした。テンプレートの列名を確認してください。", "error")
    return
  }
  rows = importedRows
  sourceLabel = label
  activeIndex = 0
  renderAll()
  setStatus(`${label} を読み込みました。`, "ok")
}

function importWorkbook(file) {
  const reader = new FileReader()
  reader.onload = (event) => {
    try {
      const data = event.target.result
      const workbook = XLSX.read(data, { type: "array" })
      handleImportedWorkbook(workbook, file.name)
    } catch (error) {
      console.error(error)
      setStatus("ファイルの読込に失敗しました。Excel または CSV を確認してください。", "error")
    }
  }
  reader.readAsArrayBuffer(file)
}

importFileEl.addEventListener("change", (event) => {
  const file = event.target.files?.[0]
  if (!file) {
    return
  }
  importWorkbook(file)
  importFileEl.value = ""
})

loadCurrentJsonBtn.addEventListener("click", loadCurrentJson)
downloadTemplateBtn.addEventListener("click", downloadTemplate)
addRowBtn.addEventListener("click", () => {
  rows.push(createEmptyRow(suggestNextId()))
  renderAll()
  selectRow(rows.length - 1)
  setStatus("新しい問題行を追加しました。", "ok")
})
validateDataBtn.addEventListener("click", validateRows)
normalizeIdsBtn.addEventListener("click", normalizeIds)
exportJsonBtn.addEventListener("click", exportJson)
exportExcelBtn.addEventListener("click", exportExcel)
copyJsonBtn.addEventListener("click", copyJson)

rows = [createEmptyRow("1")]
renderAll()
setStatus("編集ツールを開きました。現在の JSON を読むか、Excel を取り込んで始めてください。", "ok")
