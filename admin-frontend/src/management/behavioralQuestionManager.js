import { validateFormFields } from "../components/management/requiredFields.js";
import {
  getBehavioralQuestions,
  saveBehavioralQuestions,
} from "../services/animal.service.js";
import {
  moveBehaviorQuestionWithinGroup,
  canDeactivateBehaviorQuestion,
  createBehaviorQuestionReplacement,
} from "./behavioralQuestionModel.js";
import { normalizeRole } from "../auth/permissions.js";

const EDITABLE_ROLES = new Set(["Admin", "Veterinarian"]);
let questions = [];
let dimensions = [];
let groups = [];
let version = 1;
let editingIndex = -1;
let loaded = false;
let notify = () => {};
let handleSaved = null;

const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

function cloneQuestions(items) {
  return items.map((question) => ({
    ...question,
    choices: question.choices.map((choice) => ({ ...choice })),
  }));
}

function dimensionLabel(key) {
  return dimensions.find((item) => item.key === key)?.label || key;
}

function groupLabel(key) {
  return groups.find((item) => item.key === key)?.label || key;
}

function setManagerOpen(isOpen) {
  const manager = document.getElementById("behaviorQuestionManagerBackdrop");
  const manageButton = document.getElementById("btnManageBehaviorQuestions");
  if (!manager) return;
  manager.classList.toggle("open", isOpen);
  if (manageButton) {
    manageButton.setAttribute("aria-expanded", String(isOpen));
  }
  if (isOpen && !loaded) loadQuestions();
  if (isOpen) document.getElementById("behaviorQuestionTitle")?.focus();
  else manageButton?.focus();
}

async function loadQuestions() {
  const list = document.getElementById("behaviorQuestionList");
  try {
    const data = await getBehavioralQuestions();
    questions = cloneQuestions(data.questions || []);
    dimensions = data.dimensions || [];
    groups = data.groups || [];
    version = Number(data.version) || 1;
    loaded = true;
    renderQuestions();
  } catch (error) {
    if (list) list.innerHTML = `<div class="ap-empty-state"><span><i class="bi bi-exclamation-triangle"></i></span><strong>Questions could not be loaded</strong><p>${escapeHtml(error.message || "Try again shortly.")}</p></div>`;
    notify("error", error.message || "Failed to load behavioral questions.");
  }
}

function renderQuestions() {
  const list = document.getElementById("behaviorQuestionList");
  const versionLabel = document.getElementById("behaviorConfigVersion");
  if (!list) return;
  if (versionLabel) versionLabel.textContent = `Version ${version}`;
  list.innerHTML = groups.map((group) => {
    const groupQuestions = questions
      .map((question, index) => ({ question, index }))
      .filter(({ question }) => question.groupKey === group.key);
    if (!groupQuestions.length) return "";
    return `<section class="behavior-question-group" aria-labelledby="behavior-group-${escapeHtml(group.key)}">
      <header><div><span class="ap-section-kicker">Assessment section</span><h3 id="behavior-group-${escapeHtml(group.key)}">${escapeHtml(group.label)}</h3></div><strong>${groupQuestions.length} question${groupQuestions.length === 1 ? "" : "s"}</strong></header>
      <div>${groupQuestions.map(({ question, index }, groupIndex) => `
        <article class="behavior-question-card${question.active ? "" : " is-inactive"}">
          <div class="behavior-question-number">${String(index + 1).padStart(2, "0")}</div>
          <div class="behavior-question-copy"><div class="behavior-question-card-head"><div><h4>${escapeHtml(question.label)}</h4><p>${escapeHtml(question.text)}</p></div><span class="behavior-status ${question.active ? "is-active" : ""}">${question.active ? "Active" : "Inactive"}</span></div>
            <div class="behavior-question-summary"><span><i class="bi bi-diagram-3"></i> Measures ${escapeHtml(dimensionLabel(question.traitKey))}</span><span><i class="bi bi-list-ol"></i> 1–5 scale</span></div>
            <div class="behavior-question-card-actions">
              <button type="button" class="is-primary" data-behavior-action="edit" data-index="${index}"><i class="bi bi-pencil-square"></i>Edit</button>
              <details class="behavior-question-more">
                <summary aria-label="More actions for ${escapeHtml(question.label)}"><i class="bi bi-three-dots"></i> More</summary>
                <div role="group" aria-label="Question actions">
                  <button type="button" data-behavior-action="up" data-index="${index}" ${groupIndex === 0 ? "disabled" : ""}><i class="bi bi-arrow-up"></i>Move up</button>
                  <button type="button" data-behavior-action="down" data-index="${index}" ${groupIndex === groupQuestions.length - 1 ? "disabled" : ""}><i class="bi bi-arrow-down"></i>Move down</button>
                  <button type="button" data-behavior-action="replace" data-index="${index}"><i class="bi bi-arrow-repeat"></i>Replace question</button>
                  <button type="button" data-behavior-action="toggle" data-index="${index}"><i class="bi ${question.active ? "bi-eye-slash" : "bi-eye"}"></i>${question.active ? "Deactivate" : "Activate"}</button>
                  ${question.active ? "" : `<button type="button" class="is-danger" data-behavior-action="remove" data-index="${index}"><i class="bi bi-trash3"></i>Delete question</button>`}
                </div>
              </details>
            </div>
          </div>
        </article>`).join("")}</div>
    </section>`;
  }).join("");

  list.querySelectorAll("[data-behavior-action]").forEach((button) => {
    button.addEventListener("click", () => handleCardAction(button.dataset.behaviorAction, Number(button.dataset.index)));
  });
}

function handleCardAction(action, index) {
  if (action === "up" || action === "down") {
    questions = moveBehaviorQuestionWithinGroup(questions, index, action === "up" ? -1 : 1);
    renderQuestions();
    return;
  }
  if (action === "edit") return openEditor(index);
  if (action === "replace") return replaceQuestion(index);
  if (action === "remove") {
    const question = questions[index];
    if (question.active) {
      notify("warning", `Replace ${question.label} before deleting the active question.`);
      return;
    }
    questions.splice(index, 1);
    renderQuestions();
    notify("info", "Question removed from the draft. Save changes to apply it.");
    return;
  }
  if (action !== "toggle") return;
  const question = questions[index];
  if (question.active && !canDeactivateBehaviorQuestion(questions, question.id)) {
    notify("warning", `Use Replace first so ${dimensionLabel(question.traitKey)} always has an active question.`);
    return;
  }
  if (!question.active) {
    questions.forEach((item) => {
      if (item.id !== question.id && item.traitKey === question.traitKey) item.active = false;
    });
  }
  question.active = !question.active;
  renderQuestions();
}

function replaceQuestion(index) {
  const question = questions[index];
  if (!question) return;
  const id = `behavior-question-${Date.now()}`;
  const replacement = createBehaviorQuestionReplacement(question, id);
  questions.push(replacement);
  renderQuestions();
  openEditor(questions.length - 1);
}

function openEditor(index) {
  editingIndex = index;
  const question = questions[index];
  document.getElementById("behaviorQuestionModalTitle").textContent = question.__new ? "Add question" : "Edit question";
  document.getElementById("behaviorQuestionLabel").value = question.label;
  document.getElementById("behaviorQuestionText").value = question.text;
  document.getElementById("behaviorQuestionTrait").innerHTML = dimensions.map((item) => `<option value="${escapeHtml(item.key)}">${escapeHtml(item.label)}</option>`).join("");
  document.getElementById("behaviorQuestionTrait").value = question.traitKey;
  document.getElementById("behaviorQuestionGroup").innerHTML = groups.map((item) => `<option value="${escapeHtml(item.key)}">${escapeHtml(item.label)}</option>`).join("");
  document.getElementById("behaviorQuestionGroup").value = question.groupKey;
  document.getElementById("behaviorQuestionActive").checked = question.active;
  document.getElementById("behaviorAnswerFields").innerHTML = question.choices.map((choice, choiceIndex) => `<label><span>Score ${choice.value}</span><input class="form-inp" data-answer-index="${choiceIndex}" required maxlength="120" value="${escapeHtml(choice.text)}" /></label>`).join("");
  document.getElementById("behaviorQuestionError").textContent = "";
  document.getElementById("behaviorQuestionModalBackdrop").classList.add("open");
}

function closeEditor({ discardNew = false } = {}) {
  if (discardNew && questions[editingIndex]?.__new) questions.splice(editingIndex, 1);
  document.getElementById("behaviorQuestionModalBackdrop")?.classList.remove("open");
  editingIndex = -1;
  renderQuestions();
}

function applyEditor() {
  if (!validateFormFields(document.getElementById("behaviorQuestionForm"))) return;
  const question = questions[editingIndex];
  if (!question) return;
  const label = document.getElementById("behaviorQuestionLabel").value.trim();
  const text = document.getElementById("behaviorQuestionText").value.trim();
  const traitKey = document.getElementById("behaviorQuestionTrait").value;
  const groupKey = document.getElementById("behaviorQuestionGroup").value;
  const active = document.getElementById("behaviorQuestionActive").checked;
  const answerInputs = [...document.querySelectorAll("#behaviorAnswerFields [data-answer-index]")];
  const error = document.getElementById("behaviorQuestionError");
  if (!label || !text) { error.textContent = "Question title and text are required."; return; }
  if (answerInputs.some((input) => !input.value.trim())) { error.textContent = "All five answer choices need wording."; return; }
  if (!active && question.active && !canDeactivateBehaviorQuestion(questions, question.id)) {
    error.textContent = `Add or activate a replacement for ${dimensionLabel(question.traitKey)} before deactivating this question.`;
    return;
  }
  if (active && traitKey !== question.traitKey && !questions.some((item, index) => index !== editingIndex && item.active && item.traitKey === question.traitKey)) {
    error.textContent = `Activate a replacement for ${dimensionLabel(question.traitKey)} before changing this active behavior link.`;
    return;
  }
  if (active) {
    questions.forEach((item, index) => {
      if (index !== editingIndex && item.active && item.traitKey === traitKey) item.active = false;
    });
  }
  Object.assign(question, { label, text, traitKey, groupKey, active });
  answerInputs.forEach((input, index) => { question.choices[index].text = input.value.trim(); });
  delete question.__new;
  closeEditor();
}

function addQuestion() {
  if (!dimensions.length) return;
  const id = `behavior-question-${Date.now()}`;
  const dimension = dimensions[0];
  questions.push({
    id,
    traitKey: dimension.key,
    groupKey: dimension.groupKey,
    label: "New behavioral question",
    text: "Describe the behavior to assess.",
    active: false,
    order: questions.length + 1,
    __new: true,
    choices: [1, 2, 3, 4, 5].map((value) => ({ id: `${id}-${value}`, text: String(value), value, order: value })),
  });
  renderQuestions();
  openEditor(questions.length - 1);
}

async function persistQuestions() {
  const button = document.getElementById("saveBehaviorQuestions");
  try {
    button.disabled = true;
    const payload = questions.map(({ __new, ...question }, index) => ({ ...question, order: index + 1 }));
    const data = await saveBehavioralQuestions(payload, version);
    questions = cloneQuestions(data.questions || payload);
    version = Number(data.version) || version + 1;
    renderQuestions();
    await handleSaved?.(data);
    notify("success", "Behavioral assessment questions saved.");
  } catch (error) {
    notify("error", error.message || "Failed to save behavioral questions.");
  } finally {
    button.disabled = false;
  }
}

export function initializeBehavioralQuestionManager({ role, showToast, onSaved } = {}) {
  if (!EDITABLE_ROLES.has(normalizeRole(role))) return;
  const manager = document.getElementById("behaviorQuestionManagerBackdrop");
  if (!manager) return;
  notify = showToast;
  handleSaved = typeof onSaved === "function" ? onSaved : null;
  document.getElementById("btnManageBehaviorQuestions")?.addEventListener("click", () => setManagerOpen(true));
  document.getElementById("closeBehaviorQuestionManager")?.addEventListener("click", () => setManagerOpen(false));
  manager.addEventListener("click", (event) => {
    if (event.target === manager) setManagerOpen(false);
  });
  document.getElementById("addBehaviorQuestion")?.addEventListener("click", addQuestion);
  document.getElementById("saveBehaviorQuestions")?.addEventListener("click", persistQuestions);
  document.getElementById("behaviorQuestionModalApply")?.addEventListener("click", applyEditor);
  document.getElementById("behaviorQuestionModalClose")?.addEventListener("click", () => closeEditor({ discardNew: true }));
  document.getElementById("behaviorQuestionModalCancel")?.addEventListener("click", () => closeEditor({ discardNew: true }));
  document.getElementById("behaviorQuestionModalBackdrop")?.addEventListener("click", (event) => {
    if (event.target.id === "behaviorQuestionModalBackdrop") closeEditor({ discardNew: true });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const editor = document.getElementById("behaviorQuestionModalBackdrop");
    if (editor?.classList.contains("open")) closeEditor({ discardNew: true });
    else if (manager.classList.contains("open")) setManagerOpen(false);
  });
}
