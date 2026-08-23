import { API_BASE_URL } from "../../utils/api.js";

const CHATBOT_MIN_TYPING_MS = 1000;

initChatbotWidget();

function initChatbotWidget() {
  if (document.getElementById("animuaChatbot")) return;

  document.body.insertAdjacentHTML(
    "beforeend",
    `
      <section class="animua-chatbot" id="animuaChatbot" aria-live="polite">
        <button type="button" class="animua-chatbot-toggle" id="chatbotToggle" aria-label="Open ANIMUA chat assistant" aria-expanded="false" title="Need help finding a match?" data-tooltip="Need help finding a match?">
          <i class="fa-solid fa-comments"></i>
          <span class="chatbot-launcher-text">Need help finding a match?</span>
        </button>
        <span class="animua-chatbot-nudge" aria-hidden="true">Need help choosing a furbaby?</span>

        <div class="chatbot-panel hidden" id="chatbotPanel" role="dialog" aria-modal="false" aria-labelledby="chatbotTitle">
          <div class="chatbot-head">
            <div class="chatbot-brand-badge" aria-hidden="true">
              <span><i class="fa-solid fa-paw"></i></span>
            </div>
            <div class="chatbot-head-copy">
              <div class="chatbot-title-line" id="chatbotTitle">
                <strong>ANIMUA</strong>
                <span>Assistant</span>
              </div>
              <p id="chatbotSubtitle">Your companion for adoption and shelter services.</p>
            </div>
            <div class="chatbot-language-menu">
              <button type="button" class="chatbot-language-select" id="chatbotLanguageToggle" aria-label="Choose chatbot language" aria-expanded="false">
                <i class="fa-solid fa-globe" aria-hidden="true"></i>
                <span id="chatbotLanguageLabel">English</span>
                <i class="fa-solid fa-caret-down" aria-hidden="true"></i>
              </button>
              <div class="chatbot-language-options hidden" id="chatbotLanguageOptions" role="menu">
                <button type="button" data-chatbot-language-option="english" class="is-active" role="menuitem">English</button>
                <button type="button" data-chatbot-language-option="tagalog" role="menuitem">Tagalog</button>
              </div>
            </div>
            <button type="button" class="chatbot-close" id="chatbotClose" aria-label="Close chat assistant">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div class="chatbot-messages" id="chatbotMessages">
            <div class="chatbot-message-row bot">
              <div class="chatbot-bot-avatar" aria-hidden="true">
                <i class="fa-solid fa-dog"></i>
              </div>
              <div class="chatbot-message bot">
                <p id="chatbotGreeting">Hello! I can help with adoption, surrender requests, matching, events, and account support.</p>
              </div>
            </div>
            <div class="chatbot-message user chatbot-suggestions-row">
              <button type="button" class="chatbot-suggestions-toggle" id="chatbotSuggestionsToggle">
                Generate questions
              </button>
            </div>
          </div>

          <div class="chatbot-quick-actions" id="chatbotQuickActions" aria-label="Chatbot quick topics"></div>

          <form class="chatbot-form" id="chatbotForm">
            <label class="chatbot-search-field" for="chatbotInput">
              <input type="text" id="chatbotInput" placeholder="Ask about adoption or services..." autocomplete="off" maxlength="700" aria-label="Message ANIMUA Assistant">
              <button type="submit" class="chatbot-input-send" id="chatbotSend" aria-label="Send message">
                <i class="fa-solid fa-paper-plane"></i>
              </button>
            </label>
          </form>
        </div>
      </section>
    `
  );

  const toggle = document.getElementById("chatbotToggle");
  const widget = document.getElementById("animuaChatbot");
  const panel = document.getElementById("chatbotPanel");
  const close = document.getElementById("chatbotClose");
  const form = document.getElementById("chatbotForm");
  const input = document.getElementById("chatbotInput");
  const messages = document.getElementById("chatbotMessages");
  const sendButton = document.getElementById("chatbotSend");
  const languageToggle = document.getElementById("chatbotLanguageToggle");
  const languageOptions = document.getElementById("chatbotLanguageOptions");
  const languageLabel = document.getElementById("chatbotLanguageLabel");
  const greeting = document.getElementById("chatbotGreeting");
  const subtitle = document.getElementById("chatbotSubtitle");
  const quickActions = document.getElementById("chatbotQuickActions");
  const suggestionsToggle = document.getElementById("chatbotSuggestionsToggle");
  const history = [];
  let selectedLanguage = "english";

  renderChatbotQuickActions(quickActions, selectedLanguage);
  if (form && quickActions) {
    messages?.appendChild(quickActions);
    quickActions.classList.add("is-hidden");
  }
  updateChatbotInputPlaceholder(input, selectedLanguage);

  const openChat = () => {
    panel?.classList.remove("hidden");
    widget?.classList.add("is-open");
    toggle?.setAttribute("aria-expanded", "true");
    window.setTimeout(() => input?.focus(), 80);
  };

  const closeChat = () => {
    panel?.classList.add("hidden");
    widget?.classList.remove("is-open");
    toggle?.setAttribute("aria-expanded", "false");
    toggle?.focus();
  };

  toggle?.addEventListener("click", () => {
    if (panel?.classList.contains("hidden")) {
      openChat();
    } else {
      closeChat();
    }
  });

  close?.addEventListener("click", closeChat);
  languageToggle?.addEventListener("click", () => {
    const isOpen = !languageOptions?.classList.contains("hidden");
    languageOptions?.classList.toggle("hidden", isOpen);
    languageToggle.setAttribute("aria-expanded", String(!isOpen));
  });

  languageOptions?.addEventListener("click", (event) => {
    const option = event.target.closest("[data-chatbot-language-option]");
    if (!option) return;

    selectedLanguage = option.dataset.chatbotLanguageOption || "english";
    if (languageLabel) languageLabel.textContent = selectedLanguage === "tagalog" ? "Tagalog" : "English";
    updateChatbotGreeting(greeting, selectedLanguage);
    updateChatbotSubtitle(subtitle, selectedLanguage);
    updateChatbotInputPlaceholder(input, selectedLanguage);
    updateChatbotSuggestionsToggle(suggestionsToggle, selectedLanguage);
    renderChatbotQuickActions(quickActions, selectedLanguage);
    languageOptions.querySelectorAll("[data-chatbot-language-option]").forEach((button) => {
      button.classList.toggle("is-active", button === option);
    });
    languageOptions.classList.add("hidden");
    languageToggle?.setAttribute("aria-expanded", "false");
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && panel && !panel.classList.contains("hidden")) {
      if (languageOptions && !languageOptions.classList.contains("hidden")) {
        languageOptions.classList.add("hidden");
        languageToggle?.setAttribute("aria-expanded", "false");
      } else {
        closeChat();
      }
    }
  });

  document.addEventListener("click", (event) => {
    if (!languageOptions || languageOptions.classList.contains("hidden")) return;
    if (event.target.closest(".chatbot-language-menu")) return;
    languageOptions.classList.add("hidden");
    languageToggle?.setAttribute("aria-expanded", "false");
  });

  quickActions?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-chatbot-prompt]");
    if (!button || !input || !form) return;

    input.value = button.dataset.chatbotPrompt || button.textContent.trim();
    quickActions.classList.add("is-hidden");
    input.focus();
    form.requestSubmit();
  });

  suggestionsToggle?.addEventListener("click", () => {
    quickActions?.classList.remove("is-hidden");
    suggestionsToggle.hidden = true;
    if (messages) messages.scrollTop = messages.scrollHeight;
  });

  form?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-chatbot-prompt]");
    if (!button || button.closest("#chatbotQuickActions") || !input || !form) return;

    input.value = button.dataset.chatbotPrompt || button.textContent.trim();
    input.focus();
    form.requestSubmit();
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = input?.value.trim() || "";
    if (!message) return;

    if (suggestionsToggle) {
      suggestionsToggle.hidden = true;
    }
    quickActions?.classList.add("is-hidden");
    appendChatMessage(messages, "user", message);
    history.push({ role: "user", content: message });
    input.value = "";
    setChatbotLoading(sendButton, true);
    const typing = appendChatMessage(messages, "bot", "Typing...");
    typing?.classList.add("is-typing");
    const typingStartedAt = Date.now();
    const waitForTypingPause = () => new Promise((resolve) => {
      const elapsed = Date.now() - typingStartedAt;
      window.setTimeout(resolve, Math.max(0, CHATBOT_MIN_TYPING_MS - elapsed));
    });

    try {
      const response = await fetch(`${API_BASE_URL}/chatbot/message`, {
        method: "POST",
        credentials: "include",
        headers: getChatbotRequestHeaders(),
        body: JSON.stringify({
          message,
          language: selectedLanguage,
          history: history.slice(-8)
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "Unable to reach ANIMUA Assistant.");
      }

      await waitForTypingPause();
      typing?.remove();
      const reply = data.reply || "I could not answer that yet. Please try asking another way.";
      appendChatMessage(messages, "bot", reply);
      history.push({ role: "assistant", content: reply });
    } catch (error) {
      await waitForTypingPause();
      typing?.remove();
      const fallbackMessage = error instanceof TypeError && error.message === "Failed to fetch"
        ? "ANIMUA Assistant cannot connect to the server right now. Please make sure the backend is running, then try again."
        : error.message || "Chat is unavailable right now. Please try again later.";
      appendChatMessage(messages, "bot", fallbackMessage);
    } finally {
      setChatbotLoading(sendButton, false);
      trimChatHistory(history);
      input?.focus();
    }
  });
}

function getChatbotRequestHeaders() {
  return { "Content-Type": "application/json" };
}

function appendChatMessage(container, type, text) {
  if (!container) return null;

  const item = document.createElement("div");
  item.className = `chatbot-message ${type}`;

  const paragraph = document.createElement("p");
  paragraph.textContent = type === "bot" ? cleanChatbotReplyText(text) : text;
  item.appendChild(paragraph);

  if (type === "bot") {
    const row = document.createElement("div");
    row.className = "chatbot-message-row bot";

    const avatar = document.createElement("div");
    avatar.className = "chatbot-bot-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.innerHTML = '<i class="fa-solid fa-dog"></i>';

    row.append(avatar, item);
    container.appendChild(row);
    container.scrollTop = container.scrollHeight;
    return row;
  }

  container.appendChild(item);
  container.scrollTop = container.scrollHeight;
  return item;
}

function cleanChatbotReplyText(value = "") {
  return String(value)
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function renderChatbotQuickActions(container, language = "english") {
  if (!container) return;

  const actions = language === "tagalog"
    ? [
        { prompt: "Paano ako mag-aadopt ng pet?", icon: "fa-heart", label: "Adoption" },
        { prompt: "Ipakita ang furbabies na ready for adoption", icon: "fa-paw", label: "Find Furbabies" },
        { prompt: "Paano gumagana ang compatibility matching?", icon: "fa-puzzle-piece", label: "Match Quiz" },
        { prompt: "Paano ako magsusumite ng surrender request?", icon: "fa-hand-holding-heart", label: "Surrender" },
        { prompt: "May upcoming events ba?", icon: "fa-calendar", label: "Upcoming Events", regular: true },
        { prompt: "Tulungan ako sa account o email OTP", icon: "fa-circle-question", label: "Account Help" }
      ]
    : [
        { prompt: "How can I adopt a pet?", icon: "fa-heart", label: "Adoption" },
        { prompt: "Show animals ready for adoption", icon: "fa-paw", label: "Find Furbabies" },
        { prompt: "How does compatibility matching work?", icon: "fa-puzzle-piece", label: "Match Quiz" },
        { prompt: "How do I submit a surrender request?", icon: "fa-hand-holding-heart", label: "Surrender" },
        { prompt: "What upcoming events are available?", icon: "fa-calendar", label: "Upcoming Events", regular: true },
        { prompt: "Help me with my account or email OTP", icon: "fa-circle-question", label: "Account Help" }
      ];

  container.innerHTML = "";

  actions.forEach((action) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.chatbotPrompt = action.prompt;

    const icon = document.createElement("i");
    icon.className = `${action.regular ? "fa-regular" : "fa-solid"} ${action.icon}`;

    const label = document.createElement("span");
    label.textContent = action.label;

    button.append(icon, label);
    container.appendChild(button);
  });
}

function updateChatbotGreeting(greeting, language) {
  if (!greeting) return;

  greeting.textContent = language === "tagalog"
    ? "Magandang araw! Makakatulong ako sa adoption, surrender requests, matching, events, at account support."
    : "Hello! I can help with adoption, surrender requests, matching, events, and account support.";
}

function updateChatbotSubtitle(subtitle, language) {
  if (!subtitle) return;
  subtitle.textContent = language === "tagalog"
    ? "Kasama mo sa adoption at shelter services."
    : "Your companion for adoption and shelter services.";
}

function updateChatbotInputPlaceholder(input, language) {
  if (!input) return;

  input.placeholder = language === "tagalog"
    ? "Magtanong tungkol sa adoption o services..."
    : "Ask about adoption or services...";
  input.setAttribute(
    "aria-label",
    language === "tagalog" ? "Mensahe sa ANIMUA Assistant" : "Message ANIMUA Assistant"
  );
}

function updateChatbotSuggestionsToggle(button, language) {
  if (!button) return;
  button.textContent = language === "tagalog" ? "Gumawa ng mga tanong" : "Generate questions";
}

function setChatbotLoading(button, isLoading) {
  if (!button) return;
  button.disabled = isLoading;
  button.innerHTML = isLoading
    ? '<i class="fa-solid fa-spinner fa-spin"></i>'
    : '<i class="fa-solid fa-paper-plane"></i>';
}

function trimChatHistory(history) {
  while (history.length > 8) history.shift();
}
