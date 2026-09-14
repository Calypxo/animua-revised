import "../css/compatibilityQuiz.css";
import "../css/managementTables.css";
import "../css/recordsPanelReference.css";
import { protectPageByModule } from "../auth/authGuard.js"; import { loadSidebar } from "../components/management/sidebarLoader.js"; import { renderTopbarUser } from "../components/management/topbarUser.js"; import { renderPageHeader } from "../components/management/pageHeader.js"; import { apiFetch } from "../utils/api.js"; import { getUserRole } from "../utils/storage.js";
const HEADER={variant:"workspace",headingId:"compatibilityTitle",eyebrow:"Adoption Management",title:"Compatibility Quiz",description:"Manage quiz availability, review saved recommendations, and coordinate fair retake access from one protected workspace.",watermarkIcon:"bi-stars",highlights:[{icon:"bi-shield-check",label:"Server-enforced access"},{icon:"bi-clock-history",label:"Retake oversight"},{icon:"bi-database-check",label:"Saved result history"}],queue:{liveLabel:"Matching service active",label:"Result directory",title:"Saved compatibility attempts",valueId:"heroResultCount",unit:"results"},actions:[{id:"reviewResultsBtn",icon:"bi-arrow-down",label:"Review user results"}],summaryLabel:"Compatibility summary",metrics:[{id:"statResults",icon:"bi-ui-checks-grid",label:"Total Attempts"},{id:"statUsers",icon:"bi-people-fill",label:"Matched Users",tone:"amber"},{id:"statLatest",icon:"bi-bookmark-check-fill",label:"Current Results",tone:"blue"},{id:"statAverage",icon:"bi-stars",label:"Average Top Match",tone:"green"},{id:"statCooldown",icon:"bi-calendar2-week-fill",label:"Cooldown Days",tone:"rose"}]};
const state={results:[],questions:[],savedQuestions:[],editorIndex:null,editorQuestion:null};const $=id=>document.getElementById(id);const esc=v=>String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");const date=v=>v?new Date(v).toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"}):"Not scheduled";const admin=()=>String(getUserRole()).toLowerCase()==="admin";const initials=n=>String(n||"AU").split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase();
const clone=value=>JSON.parse(JSON.stringify(value));
const QUESTION_TOPICS = {
  energyLevel: "Energy level", exerciseNeeds: "Exercise needs",
  independenceLevel: "Independence", attentionNeeds: "Daily attention",
  playfulness: "Playfulness", adaptability: "Adaptability",
  friendlinessToHumans: "Friendliness toward people", goodWithKids: "Comfort around children",
  goodWithOtherPets: "Comfort around other pets", strangerTolerance: "Comfort around visitors",
  noiseLevel: "Noise level", spaceNeeds: "Living space",
  climateTolerance: "Warm-climate care", groomingNeeds: "Grooming commitment",
  trainingDifficulty: "Training difficulty", healthRiskLevel: "Veterinary care budget",
  affectionLevel: "Affection", separationAnxiety: "Separation anxiety",
};
const PHASE_LABELS={lifestyle:"Lifestyle",social:"Social Environment",care:"Home & Care",affection:"Affection"};
function toast(message){$("cqToast").querySelector("span").textContent=message;$("cqToast").classList.add("show");setTimeout(()=>$("cqToast").classList.remove("show"),2600)}
function summary(settings){const scores=state.results.map(r=>Number(r.matches?.[0]?.compatibilityPercent)).filter(Number.isFinite);const values={heroResultCount:state.results.length,statResults:state.results.length,statUsers:new Set(state.results.map(r=>r.userId)).size,statLatest:state.results.filter(r=>r.isLatest).length,statAverage:scores.length?`${(scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(1)}%`:"0%",statCooldown:settings.retakeCooldownDays};Object.entries(values).forEach(([id,v])=>{if($(id))$(id).textContent=v})}
function matchesStrength(result, level) {
  const score = Number(result.matches?.[0]?.compatibilityPercent || 0);
  if (level === "excellent") return score >= 80;
  if (level === "strong") return score >= 65 && score < 80;
  if (level === "developing") return score < 65;
  return true;
}
function render() {
  const query = $("resultSearch").value.toLowerCase().trim();
  const attempt = $("attemptFilter").value;
  const strength = $("matchFilter")?.value || "";
  const rows = state.results.filter((result) => {
    const searchable = `${result.userName} ${result.userEmail} ${result.resultId}`.toLowerCase();
    const matchesAttempt = !attempt || (attempt === "latest" ? result.isLatest : !result.isLatest);
    return searchable.includes(query) && matchesAttempt && matchesStrength(result, strength);
  });
  $("resultCount").textContent = `${rows.length} ${rows.length === 1 ? "result" : "results"}`;
  $("resultsBody").innerHTML = rows.length
    ? rows.map((result) => {
        const top = result.matches?.[0] || {};
        const matchPercent = Number(top.compatibilityPercent || 0);
        const matchTone = matchPercent >= 80 ? "is-excellent" : matchPercent >= 65 ? "is-strong" : "is-developing";
        return `<tr class="management-card-row"><td class="management-card-primary cq-user-field"><span class="management-mobile-label" aria-hidden="true">User account</span><div class="cq-user"><span>${initials(result.userName)}</span><div><strong>${esc(result.userName)}</strong><small>${esc(result.userEmail)}</small></div></div></td><td class="cq-completed-field"><span class="management-mobile-label" aria-hidden="true">Completed</span><strong>${date(result.completedAt)}</strong><small class="cq-result-id"><span>Quiz ID</span>${esc(result.resultId)}</small></td><td class="cq-retake-field"><span class="management-mobile-label" aria-hidden="true">Next retake</span><span class="cq-date"><i class="bi bi-calendar2-check" aria-hidden="true"></i>${date(result.nextRetakeAt)}</span></td><td class="cq-recommendation-field"><span class="management-mobile-label" aria-hidden="true">Top recommendation</span><div class="cq-animal"><i class="bi bi-heart-fill" aria-hidden="true"></i><strong>${esc(top.animalName || "No match")}</strong></div></td><td class="cq-match-field"><span class="management-mobile-label" aria-hidden="true">Match</span><span class="cq-score ${matchTone}">${matchPercent.toFixed(1)}%</span></td><td class="cq-version-field"><span class="management-mobile-label" aria-hidden="true">Version</span><span class="cq-version">v${result.quizVersion || 1}</span></td><td class="management-card-actions"><span class="management-mobile-label" aria-hidden="true">Actions</span><div class="table-actions cq-result-actions"><button class="tbl-action-btn cq-view-result management-card-open management-view-action management-view-action--compact" data-view="${esc(result.resultId)}" title="View result" aria-label="View compatibility result details"><i class="bi bi-eye" aria-hidden="true"></i><span class="cq-result-action-text">View result</span></button></div></td></tr>`;
      }).join("")
    : `<tr><td colspan="7"><div class="cq-empty"><i class="bi bi-search"></i><strong>No matching results</strong><small>Adjust the search, attempt status, or match strength filter.</small></div></td></tr>`;
}
function setQuestionError(message=""){$("questionConfigError").hidden=!message;$("questionConfigError").textContent=message}
function validateQuestions(){
  if(!state.questions.length)return "At least one quiz question is required.";
  const active=new Set();
  for(let i=0;i<state.questions.length;i+=1){const q=state.questions[i];if(!String(q.label||"").trim())return `Question ${i+1} needs a short label.`;if(!String(q.text||"").trim())return `Question ${i+1} text cannot be empty.`;if(!Array.isArray(q.choices)||q.choices.length<2)return `Question ${i+1} needs at least two answer choices.`;for(let j=0;j<q.choices.length;j+=1){const choice=q.choices[j];if(!String(choice.text||"").trim())return `Answer ${j+1} in question ${i+1} cannot be empty.`;const score=Number(choice.value);if(!Number.isInteger(score)||score<1||score>5)return `Answer ${j+1} in question ${i+1} needs a score from 1 to 5.`}if(q.active){if(active.has(q.traitKey))return `Only one active question may use ${q.traitKey}.`;active.add(q.traitKey)}}
  return active.size?"":"At least one quiz question must remain active.";
}
function setEditorError(message=""){$("questionEditorError").hidden=!message;$("questionEditorError").textContent=message}
function hasQuestionChanges(){return JSON.stringify(state.questions)!==JSON.stringify(state.savedQuestions)}
function refreshDraftState(){$("questionDraftBar").hidden=!admin()||!hasQuestionChanges()}
function showWorkspaceTab(name,{focus=false,smooth=false}={}){
  let selectedButton=null;
  document.querySelectorAll("[data-cq-tab]").forEach(button=>{
    const active=button.dataset.cqTab===name;
    button.classList.toggle("active",active);
    button.setAttribute("aria-selected",String(active));
    button.tabIndex=active?0:-1;
    if(active)selectedButton=button;
  });
  document.querySelectorAll("[data-cq-panel]").forEach(panel=>{panel.hidden=panel.dataset.cqPanel!==name});
  if(!selectedButton)return;
  if(focus)selectedButton.focus({preventScroll:true});
  selectedButton.scrollIntoView?.({behavior:smooth?"smooth":"auto",block:"nearest",inline:"nearest"});
}
function handleWorkspaceTabKeydown(event){
  const tabs=[...document.querySelectorAll("[data-cq-tab]")];
  const currentIndex=tabs.indexOf(event.currentTarget);
  if(currentIndex<0)return;
  let nextIndex;
  if(event.key==="Home")nextIndex=0;
  else if(event.key==="End")nextIndex=tabs.length-1;
  else if(event.key==="ArrowRight"||event.key==="ArrowDown")nextIndex=(currentIndex+1)%tabs.length;
  else if(event.key==="ArrowLeft"||event.key==="ArrowUp")nextIndex=(currentIndex-1+tabs.length)%tabs.length;
  else return;
  event.preventDefault();
  showWorkspaceTab(tabs[nextIndex].dataset.cqTab,{focus:true,smooth:true});
}
function renderQuestionOverview() {
  const canManage = admin();
  $("activeQuestionCount").textContent = state.questions.filter(question => question.active).length;

  const groups = Object.entries(PHASE_LABELS).map(([phaseKey, phaseLabel]) => {
    const entries = state.questions
      .map((question, index) => ({ question, index }))
      .filter(item => item.question.phaseKey === phaseKey);
    if (!entries.length) return "";

    return `<section class="cq-question-group"><header><div><span>${esc(phaseLabel)}</span><strong>${entries.length} question${entries.length === 1 ? "" : "s"}</strong></div></header><div>${entries.map(({ question, index }, groupIndex) => {
      const questionLabel = esc(question.label || "Untitled question");
      return `<article class="cq-question-row ${question.active ? "" : "is-inactive"}" data-index="${index}"><span class="cq-question-number">${groupIndex + 1}</span><div class="cq-question-copy"><div><strong>${questionLabel}</strong><span class="cq-question-status">${question.active ? "Active" : "Inactive"}</span></div><p>${esc(question.text || "Question text has not been added yet.")}</p><small>${question.choices?.length || 0} answers <i></i> ${esc(QUESTION_TOPICS[question.traitKey] || question.traitKey)}</small></div>${canManage ? `<div class="cq-row-actions"><button type="button" data-action="edit" class="cq-edit-action" aria-label="Edit ${questionLabel}"><i class="bi bi-pencil" aria-hidden="true"></i><span>Edit</span></button></div>` : ""}</article>`;
    }).join("")}</div></section>`;
  }).join("");

  $("questionList").innerHTML = groups || `<div class="cq-empty"><strong>No quiz questions found</strong><small>Reload the page to load the fixed question set.</small></div>`;
  refreshDraftState();
}
function renderEditorChoices() {
  const choices = state.editorQuestion?.choices || [];
  $("editorChoiceList").innerHTML = choices.map((choice, index) => `
    <div class="cq-editor-choice cq-wording-choice" data-choice-index="${index}">
      <label><small>Answer ${index + 1}</small><input data-editor-choice="text" maxlength="160" value="${esc(choice.text)}" required></label>
      <div class="cq-fixed-score" aria-label="Fixed score: ${choice.value} out of 5"><small>Fixed score</small><strong>${choice.value}<span> / 5</span></strong></div>
    </div>`).join("");
}
function openQuestionEditor(index) {
  if (!admin() || !Number.isInteger(index) || !state.questions[index]) return;
  state.editorIndex = index;
  state.editorQuestion = clone(state.questions[index]);
  $("questionEditorTitle").textContent = "Edit question";
  $("editorQuestionText").value = state.editorQuestion.text || "";
  $("editorQuestionLabel").value = state.editorQuestion.label || "";
  $("editorQuestionPhase").textContent = PHASE_LABELS[state.editorQuestion.phaseKey] || state.editorQuestion.phaseKey;
  $("editorQuestionHint").value = state.editorQuestion.hint || "";
  $("editorQuestionTrait").textContent = QUESTION_TOPICS[state.editorQuestion.traitKey] || state.editorQuestion.traitKey;
  renderEditorChoices();
  setEditorError();
  const dialog = $("questionEditorDialog");
  dialog.classList.add("open");
  dialog.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  setTimeout(() => $("editorQuestionText").focus(), 50);
}
function closeQuestionEditor(){const dialog=$("questionEditorDialog");dialog.classList.remove("open");dialog.setAttribute("aria-hidden","true");state.editorIndex=null;state.editorQuestion=null;document.body.classList.remove("modal-open")}
function applyFocusedQuestionEdit() {
  if (!admin() || !state.editorQuestion || state.editorIndex === null) return;
  const question = state.editorQuestion;
  question.text = $("editorQuestionText").value.trim();
  question.label = $("editorQuestionLabel").value.trim();
  question.hint = $("editorQuestionHint").value.trim();
  if (!question.text) return setEditorError("Question text cannot be empty.");
  if (!question.label) return setEditorError("Enter a short title for this question.");
  if (question.choices.some(choice => !String(choice.text || "").trim())) return setEditorError("Every answer choice needs text.");
  state.questions[state.editorIndex] = question;
  closeQuestionEditor();
  renderQuestionOverview();
  setQuestionError();
  toast("Wording changes added to the draft.");
}
function handleQuestionOverview(event) {
  const button = event.target.closest('[data-action="edit"]');
  if (!button || !admin()) return;
  openQuestionEditor(Number(button.closest("[data-index]").dataset.index));
}
async function publishQuestionDraft(){const error=validateQuestions();if(error){setQuestionError(error);$("questionConfigError").scrollIntoView({behavior:"smooth",block:"center"});return}const button=$("saveQuestionsBtn");button.disabled=true;try{const result=await apiFetch("/match/admin/questions",{method:"PUT",body:JSON.stringify({questions:state.questions,version:state.questionVersion})});state.questionVersion=result.version;state.questions=result.questions||[];state.savedQuestions=clone(state.questions);$("quizVersion").value=result.version;renderQuestionOverview();setQuestionError();toast("Quiz changes published.")}catch(error){setQuestionError(error.message)}finally{button.disabled=false}}
async function load(){const [s,d,q]=await Promise.all([apiFetch("/match/admin/settings"),apiFetch("/match/admin/results"),apiFetch("/match/admin/questions")]);$("quizEnabled").checked=s.settings.quizEnabled;$("cooldownDays").value=s.settings.retakeCooldownDays;$("quizVersion").value=q.version||s.settings.quizVersion;state.results=d.results||[];state.questionVersion=q.version;state.questions=q.questions||[];state.savedQuestions=clone(state.questions);summary(s.settings);if(!admin()){document.querySelectorAll("#settingsForm input,#settingsForm button").forEach(el=>el.disabled=true);$("settingsRole").textContent="View only"}renderQuestionOverview();render();document.body.classList.remove("loading")}
$("settingsForm").addEventListener("submit",async e=>{e.preventDefault();try{const r=await apiFetch("/match/admin/settings",{method:"PUT",body:JSON.stringify({quizEnabled:$("quizEnabled").checked,retakeCooldownDays:Number($("cooldownDays").value),quizVersion:Number($("quizVersion").value)})});summary(r.settings);toast("Compatibility quiz settings saved.")}catch(x){toast(x.message)}});
$("resultSearch").addEventListener("input",render);
$("attemptFilter").addEventListener("change",render);
$("matchFilter").addEventListener("change",render);
$("clearFilters").addEventListener("click",()=>{$("resultSearch").value="";$("attemptFilter").value="";$("matchFilter").value="";render()});
document.querySelectorAll("[data-cq-tab]").forEach(button=>{
  button.addEventListener("click",()=>showWorkspaceTab(button.dataset.cqTab,{smooth:true}));
  button.addEventListener("keydown",handleWorkspaceTabKeydown);
});
$("questionList").addEventListener("click",handleQuestionOverview);
$("saveQuestionsBtn").addEventListener("click",publishQuestionDraft);
$("cancelQuestionsBtn").addEventListener("click",()=>{state.questions=clone(state.savedQuestions);renderQuestionOverview();setQuestionError();toast("Unpublished changes discarded.")});
document.querySelectorAll("[data-question-close]").forEach(button=>button.addEventListener("click",closeQuestionEditor));
$("questionEditorDialog").addEventListener("click",event=>{if(event.target===$("questionEditorDialog"))closeQuestionEditor()});
$("editorChoiceList").addEventListener("input", event => {
  const row = event.target.closest("[data-choice-index]");
  if (!row || event.target.dataset.editorChoice !== "text" || !state.editorQuestion) return;
  state.editorQuestion.choices[Number(row.dataset.choiceIndex)].text = event.target.value;
  setEditorError();
});
$("applyQuestionEdit").addEventListener("click",applyFocusedQuestionEdit);
$("resultsBody").addEventListener("click",e=>{const b=e.target.closest("[data-view]");if(!b)return;const r=state.results.find(x=>x.resultId===b.dataset.view);$("resultDetails").innerHTML=`<div class="cq-detail"><span>${initials(r.userName)}</span><div><small>${r.isLatest?"Current result":"Previous attempt"}</small><h2>${esc(r.userName)}</h2><p>${esc(r.userEmail)} &middot; ${esc(r.resultId)}</p></div><b>v${r.quizVersion||1}</b></div><div class="cq-facts"><p><small>Completed</small><strong>${date(r.completedAt)}</strong></p><p><small>Next retake</small><strong>${date(r.nextRetakeAt)}</strong></p></div><section class="cq-saved-recommendations"><div class="cq-saved-head"><div><small>Compatibility Results</small><h3>Your <em>matches</em> are here.</h3><p>Ranked recommendations saved when this quiz was completed.</p></div><div><strong>${r.matches?.length||0}</strong><span>Matches Found</span></div></div><div class="cq-public-match-list">${(r.matches||[]).map((m,i)=>{const pct=Math.round(Number(m.compatibilityPercent||0));const color=pct>=80?"#1a7a40":pct>=65?"#0d7377":pct>=50?"#f0a500":"#780116";const label=pct>=80?"Excellent Match":pct>=65?"Great Match":pct>=50?"Good Match":"Partial Match";const circumference=163.36;const offset=circumference-(pct/100)*circumference;return `<article class="cq-public-match ${i===0?"is-featured":""}">${i===0?`<div class="cq-recommended"><i class="bi bi-stars"></i> Recommended for You</div>`:""}<div class="cq-public-rank"><span>${i===0?"Best Match":`${i+1}${i===1?"nd":i===2?"rd":"th"} Match`}</span><b>${["🥇","🥈","🥉","4️⃣","5️⃣"][i]||i+1}</b></div><div class="cq-public-match-main"><div class="cq-pet-placeholder"><i class="bi bi-heart-fill"></i></div><div class="cq-public-pet"><h4>${esc(m.animalName||"Shelter animal")}</h4><p>Shelter recommendation</p><small>${esc(m.animalId||"Historical animal record")}</small></div><div class="cq-match-ring"><svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="26"/><circle cx="30" cy="30" r="26" style="stroke:${color};stroke-dasharray:${circumference};stroke-dashoffset:${offset}"/></svg><div><strong>${pct}%</strong><span>match</span></div><small style="color:${color}">${label}</small></div></div></article>`}).join("")||`<div class="cq-no-saved-match"><i class="bi bi-search"></i><p>No animals matched the selected filters.</p></div>`}</div><footer>These results are historical suggestions. Final adoption approval still depends on shelter review and animal availability.</footer></section>${admin()?`<div class="detail-actions"><button data-now>Allow immediate retake</button><input data-date type="datetime-local"><button data-set>Set custom date</button><button data-remove>Remove override</button></div>`:""}`;const dlg=$("resultDialog");dlg.dataset.userId=r.userId;dlg.classList.add("open");dlg.setAttribute("aria-hidden","false");document.body.classList.add("modal-open")});
$("resultsBody").addEventListener("click",e=>{if(!e.target.closest("[data-view]"))return;const actions=$("resultDetails").querySelector(".detail-actions");if(!actions)return;actions.querySelector("[data-now]")?.classList.add("management-primary-action");actions.querySelector("[data-remove]")?.classList.add("management-tertiary-action");actions.querySelector("[data-date]")?.setAttribute("aria-label","Custom retake date")});
$("resultDialog").addEventListener("click",async e=>{const dlg=$("resultDialog");const close=()=>{dlg.classList.remove("open");dlg.setAttribute("aria-hidden","true");document.body.classList.remove("modal-open")};if(e.target===dlg||e.target.closest("[data-close]")){close();return}try{if(e.target.closest("[data-now]"))await apiFetch(`/match/admin/users/${encodeURIComponent(dlg.dataset.userId)}/retake-date`,{method:"PATCH",body:JSON.stringify({immediate:true})});else if(e.target.closest("[data-set]")){const v=dlg.querySelector("[data-date]").value;if(!v)return toast("Choose a valid date");await apiFetch(`/match/admin/users/${encodeURIComponent(dlg.dataset.userId)}/retake-date`,{method:"PATCH",body:JSON.stringify({retakeAt:new Date(v).toISOString()})})}else if(e.target.closest("[data-remove]"))await apiFetch(`/match/admin/users/${encodeURIComponent(dlg.dataset.userId)}/retake-date`,{method:"DELETE"});else return;toast("User retake access updated.");close()}catch(x){toast(x.message)}});
document.addEventListener("keydown",e=>{if(e.key!=="Escape")return;if($("questionEditorDialog").classList.contains("open")){closeQuestionEditor();return}const dlg=$("resultDialog");dlg.classList.remove("open");dlg.setAttribute("aria-hidden","true");document.body.classList.remove("modal-open")});document.addEventListener("DOMContentLoaded",async()=>{try{await protectPageByModule("compatibility");renderPageHeader(HEADER);await loadSidebar();renderTopbarUser();$("reviewResultsBtn")?.addEventListener("click",()=>{showWorkspaceTab("records");$("resultCount").scrollIntoView({behavior:"smooth"})});await load();showWorkspaceTab("records");const requestedId=new URLSearchParams(window.location.search).get("id");if(requestedId){[...document.querySelectorAll("[data-view]")].find(button=>button.dataset.view===requestedId)?.click()}}catch(x){console.error(x);toast(x.message);document.body.classList.remove("loading")}});


