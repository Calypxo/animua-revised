import { API_BASE_URL } from "/src/utils/api.js";
import { getToken } from "/src/utils/storage.js";

/* ══════════════════════════════════════════════════════
   QUIZ DEFINITION
   Phase 0: Filters (3 questions — select tiles)
   Phases 1-4: Lifestyle / Social / Home / Affection (18 questions — 1-5 scale)
══════════════════════════════════════════════════════ */
const PHASES = [
  {
    id: 0, key: "filters", label: "Matching Preferences",
    icon: "bi-funnel-fill", iconBg: "#fdf0f0", iconColor: "var(--clay)",
    kicker: "Step 1 of 5", title: "Set your matching preferences",
    desc: "Piliin kung aling pets ang dapat isama sa matching.",
    questions: [
      {
        key: "preferredSpecies", label: "Preferred Species", isFilter: true,
        text: "Anong type of pet ang gusto mong makita sa matches?",
        hint: "Choose Dog, Cat, or No preference.",
        type: "tiles",
        options: [
          { label:"No preference", value:"Any", icon:"bi-grid-3x3-gap-fill" },
          { label:"Dog", value:"Dog", icon:"dog" },
          { label:"Cat", value:"Cat", icon:"cat" },
        ]
      },
      {
        key: "preferredSex", label: "Preferred Sex", isFilter: true,
        text: "May preferred sex ka ba for your pet?",
        hint: "Kapag Male or Female ang pinili, exact matches lang ang isasama.",
        type: "tiles",
        options: [
          { label:"No preference", value:"Any", icon:"bi-grid-3x3-gap-fill" },
          { label:"Male", value:"Male", icon:"bi-gender-male" },
          { label:"Female", value:"Female", icon:"bi-gender-female" },
        ]
      },
      {
        key: "acceptSpecialNeeds", label: "Significant Special-Care Needs", isFilter: true,
        text: "Open ka ba sa pets with significant special-care needs (rated 4-5/5)?",
        hint: "Pets rated 1-3 remain eligible; this filter applies only to ratings 4-5.",
        type: "toggle",
        options: [
          { label:"Hindi", value:"no", icon:"bi-x-circle" },
          { label:"Oo", value:"yes", icon:"bi-heart-fill" },
        ]
      },
    ]
  },
  {
    id: 1, key: "lifestyle", label: "Lifestyle",
    icon: "bi-lightning-charge-fill", iconBg: "#e6f7f7", iconColor: "var(--teal)",
    kicker: "Step 2 of 5", title: "Lifestyle & activity",
    desc: "Pamumuhay at aktibidad.",
    questions: [
      { key:"energyLevel",       label:"Energy Level",       text:"How energetic do you want your pet to be?",             hint:"Gaano ka-energetic ang pet na gusto mo?", scale:["Very calm","Low energy","Moderate","Active","Very energetic"] },
      { key:"exerciseNeeds",     label:"Exercise Capacity",  text:"How much daily exercise can you realistically provide?",hint:"Gaano karaming daily exercise ang kaya mong ibigay?", scale:["Very little","A little","Moderate","A lot","Very high"] },
      { key:"independenceLevel", label:"Independence",       text:"How independent should your pet be?",                   hint:"Gaano ka-independent dapat ang pet mo?", scale:["Needs constant companionship","Low independence","Balanced","Quite independent","Very independent"] },
      { key:"attentionNeeds",    label:"Attention Capacity", text:"How much daily attention can you give your pet?",        hint:"Gaano karaming daily attention ang kaya mong ibigay sa pet?", scale:["Very little","A little","Moderate","A lot","Very high"] },
      { key:"playfulness",       label:"Playfulness",        text:"How playful do you want your pet to be?",               hint:"Gaano ka-playful ang pet na gusto mo?", scale:["Very calm","Slightly playful","Balanced","Playful","Very playful"] },
      { key:"adaptability",      label:"Routine Stability",  text:"How often does your daily routine change?",             hint:"Gaano kadalas nagbabago ang daily routine mo?", scale:["Very stable","Slightly changing","Moderate changes","Often changing","Very unpredictable"] },
    ]
  },
  {
    id: 2, key: "social", label: "Social Environment",
    icon: "bi-people-fill", iconBg: "#fff8e6", iconColor: "var(--amber)",
    kicker: "Step 3 of 5", title: "Social environment",
    desc: "Social na kapaligiran.",
    questions: [
      { key:"friendlinessToHumans", label:"Household Sociability",  text:"How social is your household overall?",                         hint:"Gaano kasocial ang inyong household?", scale:["Very quiet","Slightly social","Moderately social","Social","Very social"] },
      { key:"goodWithKids",         label:"Kids at Home",           text:"How often will your pet interact with children?",                hint:"Gaano kadalas makakasalamuha ng pet ang mga bata?", scale:["Never","Rarely","Sometimes","Often","Daily - it's a must"] },
      { key:"goodWithOtherPets",    label:"Other Pets",             text:"Will your pet live with or interact with other pets?",           hint:"Makakasama ba ng pet ang ibang hayop?", scale:["No other pets","Rare contact","Sometimes","Often","Yes, definitely"] },
      { key:"strangerTolerance",    label:"Visitor Comfort",        text:"How comfortable should your pet be around visitors or strangers?",hint:"Gaano dapat kakomportable ang pet sa bisita o strangers?", scale:["Very cautious","Reserved","Balanced","Friendly","Very welcoming"] },
    ]
  },
  {
    id: 3, key: "care", label: "Home & Care",
    icon: "bi-house-heart-fill", iconBg: "#e8f7ee", iconColor: "var(--green)",
    kicker: "Step 4 of 5", title: "Home, care & maintenance",
    desc: "Bahay, alaga, at maintenance.",
    questions: [
      { key:"noiseLevel",        label:"Noise Tolerance",      text:"How much noise can you comfortably handle from a pet?",      hint:"Gaano karaming ingay mula sa pet ang kaya mong tanggapin?", scale:["Very little","Low","Moderate","High","Very high"] },
      { key:"spaceNeeds",        label:"Living Space",         text:"How much living space can you provide?",                     hint:"Gaano kalaking living space ang kaya mong ibigay?", scale:["Very small (studio)","Small","Average","Large","Very large with yard"] },
      { key:"climateTolerance",  label:"Climate Readiness",    text:"Can you care for a pet in Angeles City's warm climate?",     hint:"Kaya mo bang alagaan ang pet sa mainit na klima ng Angeles City?", scale:["Not ready","Slightly ready","Moderately ready","Ready","Fully prepared"] },
      { key:"groomingNeeds",     label:"Grooming Commitment",  text:"How willing are you to groom your pet regularly?",           hint:"Gaano ka kahandang mag-groom ng pet nang regular?", scale:["Not willing","Slightly willing","Moderate effort","Willing","Very willing"] },
      { key:"trainingDifficulty",label:"Training Commitment",  text:"How much training difficulty can you handle?",               hint:"Gaano kahirap na training ang kaya mong hawakan?", scale:["Very easy only","Low difficulty","Moderate","Can handle difficult","Very experienced trainer"] },
      { key:"healthRiskLevel",   label:"Vet Budget",           text:"How prepared are you for veterinary costs?",                 hint:"Gaano ka kahanda sa gastusing veterinary?", scale:["Not prepared","Slightly prepared","Somewhat prepared","Prepared","Fully prepared"] },
    ]
  },
  {
    id: 4, key: "affection", label: "Affection",
    icon: "bi-heart-fill", iconBg: "#fdf0f0", iconColor: "var(--clay)",
    kicker: "Step 5 of 5", title: "Affection & attachment",
    desc: "Lambing at attachment.",
    questions: [
      { key:"affectionLevel",    label:"Affection Preference",  text:"How affectionate do you want your pet to be?", hint:"Gaano kalambing ang pet na gusto mo?", scale:["Very independent","Not very affectionate","Balanced","Affectionate","Very cuddly"] },
      { key:"separationAnxiety", label:"Clinginess Tolerance",  text:"How comfortable are you with a clingy pet?",    hint:"Gaano ka kakomportable sa clingy na pet?", scale:["Not comfortable","Slightly OK","Neutral","Comfortable","Completely fine with it"] },
    ]
  }
];

const PHASE_TIPS = [
  "Inaalis ng choices dito ang pets na hindi pasok bago i-calculate ang compatibility score.",
  "Maging tapat sa tunay mong routine, hindi sa ideal version nito.",
  "Isaalang-alang ang buong household - bata, kasama sa bahay, at ibang pets.",
  "Isipin ang kasalukuyang bahay at setup mo, hindi future plan lang.",
  "Mahalaga rin ang bond na gusto mo, hindi lang practical needs.",
];

/* ══════════════════════════════════════════════════════
   STATE
══════════════════════════════════════════════════════ */
let answers     = {};
let currentPhase= 0;
const totalQ    = PHASES.reduce((s,p) => s+p.questions.length, 0);
let isSubmitting = false;

function isPhaseComplete(phaseIdx = currentPhase) {
  return PHASES[phaseIdx].questions.every((q) => answers[q.key] !== undefined);
}

function getUnansweredQuestions(phaseIdx = currentPhase) {
  return PHASES[phaseIdx].questions.filter((q) => answers[q.key] === undefined);
}

function getTileIcon(opt) {
  const key = String(opt.value || opt.label || "").toLowerCase();
  const animalIcons = {
    dog: `
      <svg class="select-tile-animal" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <path d="M7.5 16.6c0-5.4 3.5-9.2 8.5-9.2s8.5 3.8 8.5 9.2v6.1"/>
        <path d="M10.7 18.9v3.5c0 2 1.6 3.6 3.6 3.6h3.4c2 0 3.6-1.6 3.6-3.6v-3.5"/>
        <circle cx="12.4" cy="15.2" r="1.3"/>
        <circle cx="19.6" cy="15.2" r="1.3"/>
        <path d="M14.6 19.1h2.8"/>
        <path d="M16 19.1v2.1"/>
        <path d="M10.7 22.3c1.4 2.5 4.4 2.3 5.3-.4"/>
        <path d="M21.3 22.3c-1.4 2.5-4.4 2.3-5.3-.4"/>
      </svg>`,
    cat: `
      <svg class="select-tile-animal" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <path d="M6.6 10.2 11 13.4c1.5-.6 3.2-.9 5-.9s3.5.3 5 .9l4.4-3.2v9.5c0 4.6-3.7 7.7-9.4 7.7s-9.4-3.1-9.4-7.7v-9.5Z"/>
        <circle cx="12.4" cy="18.2" r="1.3"/>
        <circle cx="19.6" cy="18.2" r="1.3"/>
        <path d="M14.9 22h2.2"/>
      </svg>`,
  };
  if (animalIcons[key]) {
    return animalIcons[key];
  }
  const icons = {
    any: "bi-grid-3x3-gap-fill",
    male: "bi-gender-male",
    female: "bi-gender-female",
  };
  const icon = icons[key] || "bi-check2-circle";
  return `<i class="bi ${icon}" aria-hidden="true"></i>`;
}

/* ══════════════════════════════════════════════════════
   RENDER
══════════════════════════════════════════════════════ */
function renderPhase(phaseIdx) {
  const phase = PHASES[phaseIdx];
  const area  = document.getElementById("questionArea");

  // Update sidebar tip
  document.getElementById("tipText").textContent  = PHASE_TIPS[phaseIdx];
  document.getElementById("phaseBadge").textContent= phase.label;

  // Update phase steps in sidebar
  document.querySelectorAll(".phase-step").forEach((el, i) => {
    el.classList.remove("active","done");
    if (i < phaseIdx)  el.classList.add("done");
    if (i === phaseIdx) el.classList.add("active");
    // update dot icon
    const dot = el.querySelector(".phase-step-dot");
    if (dot) {
      dot.innerHTML = i < phaseIdx
        ? `<i class="bi bi-check2"></i>`
        : `<i class="bi ${PHASES[i].icon}"></i>`;
    }
  });

  let html = `
    <div class="phase-intro slide-in">
      <div class="phase-intro-icon" style="background:${phase.iconBg};color:${phase.iconColor}">
        <i class="bi ${phase.icon}"></i>
      </div>
      <div>
        <div class="phase-intro-kicker">${phase.kicker}</div>
        <div class="phase-intro-title">${phase.title}</div>
        <div class="phase-intro-desc">${phase.desc}</div>
      </div>
    </div>`;

  phase.questions.forEach((q, qi) => {
    const globalIdx = PHASES.slice(0, phaseIdx).reduce((s,p) => s+p.questions.length,0) + qi + 1;
    const answered  = answers[q.key] !== undefined;

    if (q.type === "tiles") {
      html += `
        <div class="filter-section slide-in ${answered?"answered":""}" data-key="${q.key}" style="animation-delay:${qi*40}ms">
          <div class="q-num">Question ${globalIdx}</div>
          <div class="q-text">${q.text}</div>
          <div class="q-hint">${q.hint}</div>
          <div class="select-tiles">
            ${q.options.map(opt => `
              <div class="select-tile ${answers[q.key]===opt.value?"selected":""}"
                   data-key="${q.key}" data-value="${opt.value}">
                <div class="select-tile-icon">${getTileIcon(opt)}</div>
                <div class="select-tile-label">${opt.label}</div>
              </div>`).join("")}
          </div>
        </div>`;
    } else if (q.type === "toggle") {
      html += `
        <div class="filter-section slide-in ${answered?"answered":""}" data-key="${q.key}" style="animation-delay:${qi*40}ms">
          <div class="q-num">Question ${globalIdx}</div>
          <div class="q-text">${q.text}</div>
          <div class="q-hint">${q.hint}</div>
          <div class="toggle-group">
            ${q.options.map(opt => `
              <div class="toggle-tile ${answers[q.key]===opt.value?(opt.value==="yes"?"selected-yes":"selected-no"):""}"
                   data-key="${q.key}" data-value="${opt.value}">
                <i class="bi ${opt.icon}"></i>${opt.label}
              </div>`).join("")}
          </div>
        </div>`;
    } else {
      // 1-5 scale
      html += `
        <div class="question-card slide-in ${answered?"answered":""}" data-key="${q.key}" style="animation-delay:${qi*40}ms">
          <div class="q-num">Question ${globalIdx}</div>
          <div class="q-text">${q.text}</div>
          <div class="q-hint">${q.hint}</div>
          <div class="option-group">
            ${q.scale.map((lbl, val) => `
              <button class="option-btn ${answers[q.key]===(val+1)?"selected":""}"
                      data-key="${q.key}" data-value="${val+1}" type="button">
                <span class="option-num">${val+1}</span>
                <span class="option-label">${lbl}</span>
              </button>`).join("")}
          </div>
        </div>`;
    }
  });

  // Navigation
  const isLast = phaseIdx === PHASES.length - 1;
  html += `
    <div class="quiz-validation-message" id="quizValidationMessage" role="alert" hidden>
      <i class="bi bi-exclamation-circle"></i>
      <span>Please answer all questions in this section before continuing.</span>
    </div>
    <div class="quiz-nav slide-in" style="animation-delay:${phase.questions.length*40+40}ms">
      <button class="btn-prev" id="btnPrev" ${phaseIdx===0?"disabled":""}>
        <i class="bi bi-arrow-left"></i> Previous
      </button>
      ${isLast
        ? `<button class="btn-submit" id="btnSubmit" type="button">
             <i class="bi bi-stars"></i> Find My Matches
           </button>`
        : `<button class="btn-next" id="btnNext" type="button">
             Next <i class="bi bi-arrow-right"></i>
           </button>`
      }
    </div>`;

  area.innerHTML = html;
  updateNavState();

  // Bind events
  area.querySelectorAll(".option-btn, .select-tile, .toggle-tile").forEach(el => {
    el.addEventListener("click", () => handleAnswer(el.dataset.key, el.dataset.value));
  });

  document.getElementById("btnPrev")?.addEventListener("click", () => {
    if (currentPhase > 0) { currentPhase--; renderPhase(currentPhase); updateProgress(); }
  });

  document.getElementById("btnNext")?.addEventListener("click", () => {
    if (!validateCurrentPhase()) return;
    if (currentPhase < PHASES.length - 1) {
      currentPhase++;
      renderPhase(currentPhase);
      updateProgress();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });

  document.getElementById("btnSubmit")?.addEventListener("click", () => {
    if (!validateCurrentPhase()) return;
    handleSubmit();
  });

}

function handleAnswer(key, value, silent = false) {
  const wasAnswered = answers[key] !== undefined;
  answers[key] = isNaN(value) ? value : Number(value);

  if (!silent) {
    // Update the clicked element visually
    const card = document.querySelector(`[data-key="${key}"]`)?.closest(".question-card, .filter-section");
    if (card) card.classList.add("answered");
    if (card) card.classList.remove("needs-answer");

    // Deselect siblings
    document.querySelectorAll(`[data-key="${key}"]`).forEach(el => {
      el.classList.remove("selected","selected-yes","selected-no");
    });

    // Select clicked
    const clicked = document.querySelector(`[data-key="${key}"][data-value="${value}"]`);
    if (clicked) {
      if (clicked.classList.contains("toggle-tile")) {
        clicked.classList.add(value==="yes"?"selected-yes":"selected-no");
      } else {
        clicked.classList.add("selected");
      }
    }
  }

  updateProgress();
  updateAnswerChips();
  updateNavState();
  if (isPhaseComplete()) hideValidationMessage();
}

function updateProgress() {
  const pct = Math.round((Object.keys(answers).length / totalQ) * 100);
  document.getElementById("progressFill").style.width  = pct + "%";

  // Count answered in all phases
  let done = 0, total = 0;
  PHASES.forEach(p => { p.questions.forEach(() => total++); });
  Object.keys(answers).forEach(() => done++);
  document.getElementById("progressLabel").textContent = `Question ${Math.min(done, total)} of ${total}`;
}

function updateNavState() {
  const isComplete = isPhaseComplete();
  const nextButton = document.getElementById("btnNext");
  const submitButton = document.getElementById("btnSubmit");
  if (nextButton) {
    nextButton.classList.toggle("needs-completion", !isComplete);
    nextButton.setAttribute("aria-disabled", String(!isComplete));
  }
  if (submitButton) {
    submitButton.classList.toggle("needs-completion", !isComplete);
    submitButton.setAttribute("aria-disabled", String(!isComplete));
  }
}

function hideValidationMessage() {
  const message = document.getElementById("quizValidationMessage");
  if (!message) return;
  message.hidden = true;
}

function validateCurrentPhase() {
  const unanswered = getUnansweredQuestions();
  const message = document.getElementById("quizValidationMessage");

  document.querySelectorAll(".question-card, .filter-section").forEach((card) => {
    card.classList.remove("needs-answer");
  });

  if (!unanswered.length) {
    hideValidationMessage();
    return true;
  }

  unanswered.forEach((q) => {
    document.querySelector(`[data-key="${q.key}"]`)?.classList.add("needs-answer");
  });

  if (message) {
    const label = unanswered.length === 1 ? "question" : "questions";
    message.querySelector("span").textContent =
      `Please answer ${unanswered.length} remaining ${label} in this section before continuing.`;
    message.hidden = false;
  }

  document.querySelector(`[data-key="${unanswered[0].key}"]`)?.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });

  return false;
}

function updateAnswerChips() {
  const container = document.getElementById("answerChips");
  const entries   = Object.entries(answers);
  if (!entries.length) {
    container.innerHTML = `<div style="font-size:0.78rem;color:var(--stone-2);text-align:center;padding:8px">No answers yet</div>`;
    return;
  }
  container.innerHTML = entries.slice(-8).reverse().map(([k,v]) => {
    // Find label
    let label = k;
    PHASES.forEach(p => p.questions.forEach(q => { if (q.key===k) label = q.label; }));
    return `<div class="answer-chip"><span class="answer-chip-key">${label}</span><span class="answer-chip-val">${v}</span></div>`;
  }).join("");
}

async function handleSubmit() {
  if (isSubmitting) return;
  isSubmitting = true;

  const submitButton = document.getElementById("btnSubmit");
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.innerHTML = `<i class="bi bi-arrow-repeat"></i> Finding matches...`;
  }

  const preferences = PHASES
    .flatMap((phase) => phase.questions)
    .filter((question) => !question.isFilter)
    .reduce((payload, question) => {
      payload[question.key] = answers[question.key];
      return payload;
    }, {});

  const quizData = {
    filters: {
      preferredSpecies:    answers.preferredSpecies    || "Any",
      preferredSex:        answers.preferredSex        || "Any",
      needAllergyFriendly: answers.needAllergyFriendly || "no",
      acceptSpecialNeeds:  answers.acceptSpecialNeeds  || "yes",
    },
    preferences
  };

  try {
    const response = await fetch(`${API_BASE_URL}/match`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`
      },
      body: JSON.stringify(quizData)
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Failed to fetch compatibility matches.");
    const matched = result.matches || [];

    localStorage.setItem("animua_quiz_data", JSON.stringify(quizData));
    localStorage.setItem("animua_match_results", JSON.stringify(matched));
    localStorage.setItem("animua_match_metadata", JSON.stringify({ resultId: result.resultId, completedAt: result.completedAt, nextRetakeAt: result.nextRetakeAt }));

    window.location.href = "/pages/public/compatibilityResults.html";
  } catch (err) {
    console.error("Matching failed:", err);
    localStorage.setItem("animua_quiz_data", JSON.stringify(quizData));
    localStorage.setItem("animua_match_results", JSON.stringify([]));
    document.getElementById("quizMain").style.display = "none";
    document.getElementById("completionScreen").style.display = "flex";
    document.querySelector(".quiz-phase-nav")?.setAttribute("hidden", "");
    document.getElementById("completionScreen").innerHTML = `
      <div class="complete-card">
        <span class="complete-icon"><i class="bi bi-exclamation-circle"></i></span>
        <h2 class="complete-title">We could not load matches.</h2>
        <p class="complete-sub">${String(err.message || "Please try again.").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</p>
        <button class="btn-submit" id="retryMatchBtn" type="button">
          <i class="bi bi-arrow-clockwise"></i>
          Try Again
        </button>
      </div>`;
    document.getElementById("retryMatchBtn")?.addEventListener("click", () => {
      isSubmitting = false;
      document.getElementById("completionScreen").style.display = "none";
      document.getElementById("quizMain").style.display = "";
      document.querySelector(".quiz-phase-nav")?.removeAttribute("hidden");
      renderPhase(currentPhase);
      updateProgress();
    });
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.innerHTML = `<i class="bi bi-stars"></i> Find My Matches`;
    }
    isSubmitting = false;
  }
}



/* ── Init ─────────────────────────────────────────── */
async function initializeQuiz() {
  const token = getToken();
  const access = document.getElementById("quizAccessCard");
  if (!token) {
    document.getElementById("questionArea").hidden = true;
    document.querySelector(".quiz-phase-nav")?.setAttribute("hidden", "");
    access.hidden = false;
    access.innerHTML = `<i class="bi bi-person-lock"></i><h2>Log in to take the compatibility quiz</h2><p>Your result is securely saved to your ANIMUA account.</p><a href="/pages/public/home.html#login">Log in</a>`;
    return;
  }
  try {
    const response = await fetch(`${API_BASE_URL}/match/eligibility`, { headers: { Authorization: `Bearer ${token}` } });
    const info = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(info.message || "Please log in again.");
    if (!info.canTakeQuiz) {
      document.getElementById("questionArea").hidden = true;
      document.querySelector(".quiz-phase-nav")?.setAttribute("hidden", "");
      access.hidden = false;
      const result = info.latestResult || {};
      const top = result.matches?.[0] || {};
      const nextDate = info.nextRetakeAt ? new Date(info.nextRetakeAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "To be announced";
      const completedDate = info.lastCompletedAt ? new Date(info.lastCompletedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "Saved to your account";
      const safe = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
      const traitLabels = {
        energyLevel:"Energy", exerciseNeeds:"Exercise", independenceLevel:"Independence",
        attentionNeeds:"Attention", playfulness:"Playfulness", adaptability:"Routine stability",
        friendlinessToHumans:"Friendliness", goodWithKids:"Kids", goodWithOtherPets:"Other pets",
        strangerTolerance:"Strangers", noiseLevel:"Noise", spaceNeeds:"Living space",
        climateTolerance:"Climate readiness", groomingNeeds:"Grooming commitment",
        trainingDifficulty:"Training commitment",
        healthRiskLevel:"Vet budget", affectionLevel:"Affection", separationAnxiety:"Clinginess tolerance"
      };
      const traits = Object.entries(result.preferences || {}).map(([key, value]) => `<div class="saved-trait"><span>${safe(traitLabels[key] || key)}</span><div><i style="width:${Math.max(0, Math.min(100, Number(value) * 20))}%"></i></div><b>${safe(value)}/5</b></div>`).join("");
      if (info.reason === "QUIZ_DISABLED") {
        access.innerHTML = `<section class="saved-result-state is-disabled"><div class="saved-state-icon"><i class="bi bi-pause-circle"></i></div><span class="saved-state-kicker">Compatibility matching</span><h1>Quiz temporarily unavailable</h1><p>The shelter has paused new compatibility attempts. Your previous results remain safely stored in your account.</p><div class="saved-result-actions"><a href="/pages/public/my-submissions.html"><i class="bi bi-person-circle"></i>View my account</a><a class="is-secondary" href="/pages/public/home.html">Return home</a></div></section>`;
      } else {
        access.innerHTML = `<section class="saved-result-state"><header><div><span class="saved-state-kicker">Compatibility result saved</span><h1>Your best matches are waiting.</h1><p>Your recommendation is stored securely in your ANIMUA account until your next quiz attempt.</p></div><span class="saved-lock-badge"><i class="bi bi-shield-check"></i>Saved & protected</span></header><div class="saved-result-overview"><article class="saved-top-match"><span class="saved-match-label"><i class="bi bi-stars"></i>Top recommendation</span><div class="saved-match-body"><span class="saved-pet-mark"><i class="bi bi-heart-fill"></i></span><div><small>Best match</small><h2>${safe(top.animalName || "Your saved shelter match")}</h2><p>Based on your lifestyle and care preferences</p></div><strong>${Number(top.compatibilityPercent || 0).toFixed(1)}<small>%</small></strong></div></article><aside class="saved-date-stack"><article><span><i class="bi bi-check2-circle"></i></span><div><small>Completed</small><strong>${safe(completedDate)}</strong></div></article><article><span><i class="bi bi-calendar2-week"></i></span><div><small>Next allowed retake</small><strong>${safe(nextDate)}</strong></div></article><p><i class="bi bi-clock-history"></i>${info.remainingDays || 0} day${info.remainingDays === 1 ? "" : "s"} remaining</p></aside></div>${traits ? `<section class="saved-trait-profile"><div><span class="saved-state-kicker">Your profile</span><h3>Compatibility trait summary</h3></div><div class="saved-trait-grid">${traits}</div></section>` : ""}<div class="saved-result-actions"><a href="/pages/public/compatibilityResults.html"><i class="bi bi-stars"></i>View full results</a><a class="is-secondary" href="/pages/public/my-submissions.html"><i class="bi bi-person-circle"></i>Open my account</a></div><footer><i class="bi bi-info-circle"></i>You can take the quiz again beginning ${safe(nextDate)}.</footer></section>`;
      }
      if (info.latestResult) localStorage.setItem("animua_saved_result", JSON.stringify(info.latestResult));
      return;
    }
    if (info.hasPreviousResult) {
      access.hidden = false;
      access.innerHTML = `<strong>Retake available</strong><span>Your previous result remains in your account history.</span><button type="button" id="beginRetake">Retake Compatibility Quiz</button>`;
      document.getElementById("questionArea").hidden = true;
      document.getElementById("beginRetake").addEventListener("click", () => { access.hidden = true; document.getElementById("questionArea").hidden = false; });
    }
    renderPhase(0); updateProgress();
  } catch (error) {
    document.getElementById("questionArea").hidden = true; access.hidden = false;
    access.innerHTML = `<h2>Unable to open the quiz</h2><p>${error.message}</p><a href="/pages/public/home.html#login">Log in again</a>`;
  }
}
initializeQuiz();

function openConfirmModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("confirm-open");
  modal.querySelector("[data-confirm-close], a, button")?.focus();
}

function closeConfirmModal(modal) {
  if (!modal) return;
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("confirm-open");
}

document.getElementById("exitQuizLink")?.addEventListener("click", (event) => {
  event.preventDefault();
  openConfirmModal("exitQuizModal");
});

document.querySelectorAll("[data-confirm-close]").forEach((button) => {
  button.addEventListener("click", () => closeConfirmModal(button.closest(".quiz-confirm-overlay")));
});

document.querySelectorAll(".quiz-confirm-overlay").forEach((modal) => {
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeConfirmModal(modal);
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  const openModal = document.querySelector(".quiz-confirm-overlay:not(.hidden)");
  if (openModal) closeConfirmModal(openModal);
});
