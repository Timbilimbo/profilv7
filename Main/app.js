// client/app.js

const API_BASE = "http://localhost:3000";

const els = {
  tabBtns: Array.from(document.querySelectorAll(".sb-navBtn")),
  tabs: {
    uploadTab: document.getElementById("uploadTab"),
    generateTab: document.getElementById("generateTab"),
    studyTab: document.getElementById("studyTab"),
  },
  pageTitle: document.getElementById("pageTitle"),
  pageHint: document.getElementById("pageHint"),

  sourceInfo: document.getElementById("sourceInfo"),
  modeInfo: document.getElementById("modeInfo"),
  countInfo: document.getElementById("countInfo"),
  statusInfo: document.getElementById("statusInfo"),
  openExportBtn: document.getElementById("openExportBtn"),
  resetBtn: document.getElementById("resetBtn"),

  apiPill: document.getElementById("apiPill"),

  dropzone: document.getElementById("dropzone"),
  pdfInput: document.getElementById("pdfInput"),
  dzFile: document.getElementById("dzFile"),
  pdfName: document.getElementById("pdfName"),
  removePdfBtn: document.getElementById("removePdfBtn"),
  sourceTextInput: document.getElementById("sourceTextInput"),
  goGenerateBtn: document.getElementById("goGenerateBtn"),
  demoBtn: document.getElementById("demoBtn"),
  uploadStatus: document.getElementById("uploadStatus"),

  modeSelect: document.getElementById("modeSelect"),
  countSelect: document.getElementById("countSelect"),
  generateBtn: document.getElementById("generateBtn"),
  goStudyBtn: document.getElementById("goStudyBtn"),
  generateStatus: document.getElementById("generateStatus"),
  inputPreview: document.getElementById("inputPreview"),
  resultBadge: document.getElementById("resultBadge"),
  resultEmpty: document.getElementById("resultEmpty"),
  resultFlashcards: document.getElementById("resultFlashcards"),
  resultQuiz: document.getElementById("resultQuiz"),
  flashcardsList: document.getElementById("flashcardsList"),
  quizListPreview: document.getElementById("quizListPreview"),
  flashcardsMeta: document.getElementById("flashcardsMeta"),
  quizMeta: document.getElementById("quizMeta"),
  studyFlashcardsBtn: document.getElementById("studyFlashcardsBtn"),
  studyQuizBtn: document.getElementById("studyQuizBtn"),

  studyEmpty: document.getElementById("studyEmpty"),
  flashStudyCard: document.getElementById("flashStudyCard"),
  quizStudyCard: document.getElementById("quizStudyCard"),

  flashProgressText: document.getElementById("flashProgressText"),
  flashProgressFill: document.getElementById("flashProgressFill"),
  flashCardBtn: document.getElementById("flashCardBtn"),
  flashSideLabel: document.getElementById("flashSideLabel"),
  flashMainText: document.getElementById("flashMainText"),
  prevFlashBtn: document.getElementById("prevFlashBtn"),
  nextFlashBtn: document.getElementById("nextFlashBtn"),
  shuffleFlashBtn: document.getElementById("shuffleFlashBtn"),
  restartFlashBtn: document.getElementById("restartFlashBtn"),

  quizProgressText: document.getElementById("quizProgressText"),
  quizProgressFill: document.getElementById("quizProgressFill"),
  quizRunnerMeta: document.getElementById("quizRunnerMeta"),
  quizRunnerQuestion: document.getElementById("quizRunnerQuestion"),
  quizRunnerOptions: document.getElementById("quizRunnerOptions"),
  quizAnswerBox: document.getElementById("quizAnswerBox"),
  quizCorrectAnswer: document.getElementById("quizCorrectAnswer"),
  checkQuizBtn: document.getElementById("checkQuizBtn"),
  nextQuizBtn: document.getElementById("nextQuizBtn"),
  restartQuizBtn: document.getElementById("restartQuizBtn"),

  exportModal: document.getElementById("exportModal"),
  exportBackdrop: document.getElementById("exportBackdrop"),
  closeExportBtn: document.getElementById("closeExportBtn"),
  closeExportBtn2: document.getElementById("closeExportBtn2"),
  exportText: document.getElementById("exportText"),
  copyExportBtn: document.getElementById("copyExportBtn"),
};

const state = {
  pdfFile: null,
  lastGenerated: null,
  flash: { order: [], index: 0, flipped: false },
  quiz: { order: [], index: 0, selected: null, checked: false, typed: "" },
};

function setSidebarInfo({ source, mode, count, status }) {
  if (source !== undefined) els.sourceInfo.textContent = source;
  if (mode !== undefined) els.modeInfo.textContent = mode;
  if (count !== undefined) els.countInfo.textContent = count;
  if (status !== undefined) els.statusInfo.textContent = status;
}

function setStatus(el, msg) {
  el.textContent = msg || "";
}

function switchTab(tabId) {
  Object.values(els.tabs).forEach(t => t.classList.remove("is-active"));
  els.tabs[tabId].classList.add("is-active");
  els.tabBtns.forEach(b => b.classList.toggle("is-active", b.dataset.tab === tabId));

  if (tabId === "uploadTab") {
    els.pageTitle.textContent = "Upload";
    els.pageHint.textContent = "Lägg in text eller ladda upp en PDF.";
  } else if (tabId === "generateTab") {
    els.pageTitle.textContent = "Generate";
    els.pageHint.textContent = "Välj flashcards eller quiz, antal, och generera.";
  } else {
    els.pageTitle.textContent = "Study";
    els.pageHint.textContent = "Studera ditt genererade set.";
  }
}

async function checkApiHealth() {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    const data = await res.json();
    if (data && data.ok) {
      els.apiPill.textContent = "API: online";
      return;
    }
  } catch {}
  els.apiPill.textContent = "API: offline";
}

function updateInputPreview() {
  const t = (els.sourceTextInput.value || "").trim();
  const info = [
    state.pdfFile ? `PDF: ${state.pdfFile.name}` : "PDF: none",
    t ? `Text: ${t.slice(0, 140)}${t.length > 140 ? "…" : ""}` : "Text: none",
  ].join("\n");
  els.inputPreview.textContent = info;
  setSidebarInfo({ source: state.pdfFile ? "PDF + optional text" : "Text/topic" });
}

function setPdfFile(file) {
  state.pdfFile = file || null;
  if (state.pdfFile) {
    els.dzFile.hidden = false;
    els.pdfName.textContent = state.pdfFile.name;
  } else {
    els.dzFile.hidden = true;
    els.pdfName.textContent = "";
  }
  updateInputPreview();
}

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showGeneratedPreview(data) {
  els.resultEmpty.hidden = true;
  els.resultBadge.textContent = data.mode;

  if (data.mode === "flashcards") {
    els.resultFlashcards.hidden = false;
    els.resultQuiz.hidden = true;
    els.flashcardsMeta.textContent = `${data.flashcards.length} cards`;
    els.flashcardsList.innerHTML = "";

    data.flashcards.slice(0, 6).forEach((c) => {
      const div = document.createElement("div");
      div.className = "fcItem";
      div.innerHTML = `
        <div class="fcFront">${escapeHtml(c.front)}</div>
        <div class="fcBack">${escapeHtml(c.back)}</div>
      `;
      els.flashcardsList.appendChild(div);
    });
  } else {
    els.resultFlashcards.hidden = true;
    els.resultQuiz.hidden = false;
    els.quizMeta.textContent = `${data.quiz.length} questions`;
    els.quizListPreview.innerHTML = "";

    data.quiz.slice(0, 4).forEach((q, idx) => {
      const div = document.createElement("div");
      div.className = "quizPreviewItem";
      div.innerHTML = `
        <div class="quizPreviewTitle">Q${idx + 1}: ${escapeHtml(q.question)}</div>
        <div class="quizPreviewMeta">${escapeHtml(q.type)} • ${escapeHtml(q.level)}</div>
        ${q.options && q.options.length ? `<ul class="quizPreviewOptions">${q.options.map(o => `<li>${escapeHtml(o)}</li>`).join("")}</ul>` : ""}
        <div class="quizPreviewAnswer"><b>Answer:</b> ${escapeHtml(q.answer)}</div>
      `;
      els.quizListPreview.appendChild(div);
    });
  }
}

async function generate() {
  const mode = els.modeSelect.value;
  const count = els.countSelect.value;
  const text = (els.sourceTextInput.value || "").trim();
  const pdf = state.pdfFile;

  if (!text && !pdf) {
    setStatus(els.generateStatus, "Skriv ett ämne / klistra in text eller ladda upp en PDF.");
    return;
  }

  setSidebarInfo({ mode, count, status: "Generating…" });
  setStatus(els.generateStatus, "Generating…");
  els.generateBtn.disabled = true;
  els.goStudyBtn.disabled = true;

  try {
    const form = new FormData();
    form.append("mode", mode);
    form.append("count", count);
    form.append("text", text);
    if (pdf) form.append("pdf", pdf);

    const res = await fetch(`${API_BASE}/api/generate`, { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setStatus(els.generateStatus, "Error: " + (data.error || "Något gick fel."));
      setSidebarInfo({ status: "Error" });
      return;
    }

    state.lastGenerated = data;
    els.openExportBtn.disabled = false;
    els.goStudyBtn.disabled = false;

    setSidebarInfo({ status: "Ready", mode: data.mode, count: String(count) });
    setStatus(els.generateStatus, "Done.");
    showGeneratedPreview(data);
  } catch {
    setStatus(els.generateStatus, "Kunde inte kontakta servern. Är den igång?");
    setSidebarInfo({ status: "API error" });
  } finally {
    els.generateBtn.disabled = false;
  }
}

function openExport() {
  if (!state.lastGenerated) return;
  els.exportText.value = state.lastGenerated.exportText || "";
  els.exportModal.hidden = false;
}

function closeExport() {
  els.exportModal.hidden = true;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    setSidebarInfo({ status: "Copied" });
  } catch {
    setSidebarInfo({ status: "Copy failed" });
  }
}

/* Flashcards study */
function initFlashStudy() {
  const data = state.lastGenerated;
  if (!data || data.mode !== "flashcards") return;

  state.flash.order = Array.from({ length: data.flashcards.length }, (_, i) => i);
  state.flash.index = 0;
  state.flash.flipped = false;

  els.studyEmpty.hidden = true;
  els.quizStudyCard.hidden = true;
  els.flashStudyCard.hidden = false;

  renderFlashCard();
}

function renderFlashCard() {
  const data = state.lastGenerated;
  const total = data.flashcards.length;
  const idx = state.flash.order[state.flash.index];
  const card = data.flashcards[idx];

  const showBack = state.flash.flipped;
  els.flashSideLabel.textContent = showBack ? "BAKSIDA" : "FRAMSIDA";
  els.flashMainText.textContent = showBack ? card.back : card.front;

  els.flashProgressText.textContent = `${state.flash.index + 1}/${total}`;
  els.flashProgressFill.style.width = `${Math.round(((state.flash.index + 1) / total) * 100)}%`;

  els.prevFlashBtn.disabled = state.flash.index === 0;
  els.nextFlashBtn.disabled = state.flash.index === total - 1;
}

function shuffleArray(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* Quiz study */
function initQuizStudy() {
  const data = state.lastGenerated;
  if (!data || data.mode !== "quiz") return;

  state.quiz.order = Array.from({ length: data.quiz.length }, (_, i) => i);
  state.quiz.index = 0;
  state.quiz.selected = null;
  state.quiz.checked = false;
  state.quiz.typed = "";

  els.studyEmpty.hidden = true;
  els.flashStudyCard.hidden = true;
  els.quizStudyCard.hidden = false;

  renderQuizQuestion();
}

function renderQuizQuestion() {
  const data = state.lastGenerated;
  const total = data.quiz.length;
  const idx = state.quiz.order[state.quiz.index];
  const q = data.quiz[idx];

  els.quizRunnerMeta.textContent = `${q.type} • ${q.level}`;
  els.quizRunnerQuestion.textContent = q.question;

  els.quizProgressText.textContent = `${state.quiz.index + 1}/${total}`;
  els.quizProgressFill.style.width = `${Math.round(((state.quiz.index + 1) / total) * 100)}%`;

  els.quizRunnerOptions.innerHTML = "";
  els.quizAnswerBox.hidden = true;
  els.quizCorrectAnswer.textContent = q.answer;

  state.quiz.selected = null;
  state.quiz.checked = false;
  state.quiz.typed = "";

  // UI per typ:
  if (q.type === "short_answer") {
    const wrap = document.createElement("div");
    wrap.className = "saWrap";
    wrap.innerHTML = `
      <div class="saLabel">Skriv ditt svar</div>
      <input class="saInput" id="shortAnswerInput" type="text" placeholder="Skriv här..." />
    `;
    els.quizRunnerOptions.appendChild(wrap);

    const inp = wrap.querySelector("#shortAnswerInput");
    inp.addEventListener("input", () => {
      state.quiz.typed = inp.value;
    });
  } else {
    const options = (q.type === "true_false")
      ? ["Sant", "Falskt"]
      : (Array.isArray(q.options) ? q.options : []);

    options.forEach((opt) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "optionBtn";
      btn.textContent = opt;

      btn.addEventListener("click", () => {
        if (state.quiz.checked) return;
        state.quiz.selected = opt;
        Array.from(els.quizRunnerOptions.querySelectorAll(".optionBtn"))
          .forEach(b => b.classList.remove("is-selected"));
        btn.classList.add("is-selected");
      });

      els.quizRunnerOptions.appendChild(btn);
    });
  }

  els.checkQuizBtn.disabled = false;
  els.nextQuizBtn.textContent = state.quiz.index === total - 1 ? "Finish" : "Next →";
}

function checkQuizAnswer() {
  const data = state.lastGenerated;
  const q = data.quiz[state.quiz.order[state.quiz.index]];

  els.quizAnswerBox.hidden = false;
  state.quiz.checked = true;

  if (q.type === "short_answer") {
    // Vi rättar inte automatiskt för fritext. Visar facit.
    return;
  }

  const buttons = Array.from(els.quizRunnerOptions.querySelectorAll(".optionBtn"));
  buttons.forEach(b => {
    const label = b.textContent;
    if (label === q.answer) b.classList.add("is-correct");
    if (state.quiz.selected && label === state.quiz.selected && label !== q.answer) b.classList.add("is-wrong");
  });
}

/* Events */
els.tabBtns.forEach(btn => btn.addEventListener("click", () => switchTab(btn.dataset.tab)));

els.dropzone.addEventListener("click", () => els.pdfInput.click());
els.dropzone.addEventListener("dragover", (e) => { e.preventDefault(); els.dropzone.classList.add("is-over"); });
els.dropzone.addEventListener("dragleave", () => els.dropzone.classList.remove("is-over"));
els.dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  els.dropzone.classList.remove("is-over");
  const f = e.dataTransfer.files?.[0];
  if (f && f.name.toLowerCase().endsWith(".pdf")) setPdfFile(f);
  else setStatus(els.uploadStatus, "Please drop a .pdf file.");
});

els.pdfInput.addEventListener("change", () => {
  const f = els.pdfInput.files?.[0];
  if (f) setPdfFile(f);
});

els.removePdfBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  els.pdfInput.value = "";
  setPdfFile(null);
});

els.sourceTextInput.addEventListener("input", updateInputPreview);

els.demoBtn.addEventListener("click", () => {
  els.sourceTextInput.value =
`Anatomi och fysiologi handlar om kroppens uppbyggnad (anatomi) och funktion (fysiologi).
Skelettet ger stöd, skyddar organ och fungerar som hävstång för rörelse.
Kroppen har 206 ben; lårbenet är störst och stigbygeln i örat är minst.
Leder möjliggör rörelse och stötdämpning, till exempel knäleden med menisker och korsband.
Muskler kan arbeta koncentriskt, excentriskt eller isometriskt.
Nervsystemet består av CNS (hjärna/ryggmärg) och PNS (nerver) och skickar signaler i kroppen.`;
  updateInputPreview();
  setStatus(els.uploadStatus, "Demo text added.");
});

els.goGenerateBtn.addEventListener("click", () => { updateInputPreview(); switchTab("generateTab"); });

els.generateBtn.addEventListener("click", generate);

els.goStudyBtn.addEventListener("click", () => {
  if (!state.lastGenerated) return;
  switchTab("studyTab");
  if (state.lastGenerated.mode === "flashcards") initFlashStudy();
  if (state.lastGenerated.mode === "quiz") initQuizStudy();
});

els.studyFlashcardsBtn.addEventListener("click", () => { switchTab("studyTab"); initFlashStudy(); });
els.studyQuizBtn.addEventListener("click", () => { switchTab("studyTab"); initQuizStudy(); });

els.flashCardBtn.addEventListener("click", () => { state.flash.flipped = !state.flash.flipped; renderFlashCard(); });
els.prevFlashBtn.addEventListener("click", () => { state.flash.index = Math.max(0, state.flash.index - 1); state.flash.flipped = false; renderFlashCard(); });
els.nextFlashBtn.addEventListener("click", () => {
  const total = state.lastGenerated.flashcards.length;
  state.flash.index = Math.min(total - 1, state.flash.index + 1);
  state.flash.flipped = false;
  renderFlashCard();
});
els.shuffleFlashBtn.addEventListener("click", () => { shuffleArray(state.flash.order); state.flash.index = 0; state.flash.flipped = false; renderFlashCard(); });
els.restartFlashBtn.addEventListener("click", () => { state.flash.index = 0; state.flash.flipped = false; renderFlashCard(); });

els.checkQuizBtn.addEventListener("click", () => { if (!state.lastGenerated) return; checkQuizAnswer(); });

els.nextQuizBtn.addEventListener("click", () => {
  const total = state.lastGenerated.quiz.length;
  if (state.quiz.index >= total - 1) {
    setSidebarInfo({ status: "Quiz finished" });
    return;
  }
  state.quiz.index += 1;
  renderQuizQuestion();
});

els.restartQuizBtn.addEventListener("click", () => { state.quiz.index = 0; renderQuizQuestion(); });

els.openExportBtn.addEventListener("click", openExport);
els.exportBackdrop.addEventListener("click", closeExport);
els.closeExportBtn.addEventListener("click", closeExport);
els.closeExportBtn2.addEventListener("click", closeExport);
els.copyExportBtn.addEventListener("click", () => copyText(els.exportText.value || ""));

els.resetBtn.addEventListener("click", () => {
  state.pdfFile = null;
  els.pdfInput.value = "";
  els.sourceTextInput.value = "";
  setPdfFile(null);

  state.lastGenerated = null;
  els.openExportBtn.disabled = true;
  els.goStudyBtn.disabled = true;

  els.resultBadge.textContent = "—";
  els.resultEmpty.hidden = false;
  els.resultFlashcards.hidden = true;
  els.resultQuiz.hidden = true;
  els.flashcardsList.innerHTML = "";
  els.quizListPreview.innerHTML = "";
  els.flashcardsMeta.textContent = "—";
  els.quizMeta.textContent = "—";

  els.studyEmpty.hidden = false;
  els.flashStudyCard.hidden = true;
  els.quizStudyCard.hidden = true;

  setStatus(els.uploadStatus, "");
  setStatus(els.generateStatus, "");
  setSidebarInfo({ source: "—", mode: "—", count: "—", status: "Idle" });

  closeExport();
  updateInputPreview();
  switchTab("uploadTab");
});

(function init() {
  switchTab("uploadTab");
  updateInputPreview();
  setSidebarInfo({ source: "—", mode: "—", count: "—", status: "Idle" });
  checkApiHealth();
  setInterval(checkApiHealth, 8000);
})();
