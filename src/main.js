import { Conversation } from "@elevenlabs/client";
import { VOICES, findVoice } from "./voices.js";
import "./styles.css";

const AGENT_ID = "agent_5701m2kp5fnhe9z95yqhzmf5105s";
const BRANCH_ID =
  import.meta.env.VITE_BRANCH_ID === "false"
    ? ""
    : (import.meta.env.VITE_BRANCH_ID ?? "agtbrch_0101m2kp5gvme8a94x78vtqedj1v");

const CONVAI_TOKEN_SOURCE = "js_sdk";
const CONVAI_TOKEN_VERSION = "1.2.1";

/**
 * Konfiguracja sesji niedostępna w UI.
 * `llmModel` i `ttsModel` to wartości ustawione po stronie agenta — trzymamy je tu
 * tylko jako dokumentację i nie wysyłamy w overrides (nadpisanie LLM wymaga
 * osobnej zgody w ustawieniach bezpieczeństwa agenta).
 */
const SESSION_DEFAULTS = {
  llmModel: "gpt-4o",
  ttsModel: "eleven_flash_v2_5",
  language: "pl",
};

const BASE_PROMPT = `# Zadanie
Prowadzisz naturalną rozmowę głosową po polsku jako asystent ubezpieczeniowy. Pomagasz rozmówcy zrozumieć ofertę, odpowiadasz na pytania i dopytujesz o potrzeby.

# Język i ton
- Mów wyłącznie po polsku.
- Odpowiadaj krótko i naturalnie, jak w rozmowie telefonicznej.
- Zadawaj po jednym pytaniu i uważnie reaguj na odpowiedzi.
- Zachowuj ciepły, spokojny i uprzejmy ton.

# Zasady
- Liczby, daty, godziny, kwoty, jednostki i symbole zapisuj słownie, aby synteza mowy brzmiała naturalnie.
- Nie obiecuj warunków, których nie znasz — proponuj kontakt z konsultantem.
- Unikaj tematów politycznych i wrażliwych; łagodnie wracaj do rozmowy o ubezpieczeniu.
- Urozmaicaj sformułowania i nie powtarzaj tych samych zdań.`;

/** Persona zależna od płci wybranego głosu — steruje imieniem i formą gramatyczną. */
const PERSONAS = {
  female: {
    name: "Bianca",
    withName: "z Biancą",
    firstMessage:
      "Dzień dobry, nazywam się Bianca. Jestem asystentką ubezpieczeniową — w czym mogę pomóc?",
    identity: `# Tożsamość
Nazywasz się Bianca i jesteś kobietą. Przedstawiaj się jako „Bianca”.
O sobie mów zawsze w żeńskiej formie gramatycznej, na przykład: „powiedziałam”, „sprawdziłam”, „jestem gotowa”, „jestem asystentką”. Nigdy nie używaj o sobie form męskich.`,
  },
  male: {
    name: "Bianek",
    withName: "z Biankiem",
    firstMessage:
      "Dzień dobry, nazywam się Bianek. Jestem asystentem ubezpieczeniowym — w czym mogę pomóc?",
    identity: `# Tożsamość
Nazywasz się Bianek i jesteś mężczyzną. Przedstawiaj się jako „Bianek”.
O sobie mów zawsze w męskiej formie gramatycznej, na przykład: „powiedziałem”, „sprawdziłem”, „jestem gotowy”, „jestem asystentem”. Nigdy nie używaj o sobie form żeńskich.`,
  },
};

const voiceSelect = document.getElementById("voiceSelect");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const connStatus = document.getElementById("connStatus");
const modeStatus = document.getElementById("modeStatus");
const errorBox = document.getElementById("errorBox");
const callSurface = document.querySelector(".call-surface");
const callLabel = document.getElementById("callLabel");
const modeLine = document.getElementById("modeLine");

for (const v of VOICES) {
  const opt = document.createElement("option");
  opt.value = v.id;
  opt.textContent = v.label;
  voiceSelect.appendChild(opt);
}

let conversation = null;

function personaForVoice(voiceId) {
  return findVoice(voiceId)?.gender === "male" ? PERSONAS.male : PERSONAS.female;
}

function buildOverrides(voiceId) {
  const persona = personaForVoice(voiceId);
  return {
    tts: { voiceId },
    agent: {
      prompt: { prompt: `${persona.identity}\n\n${BASE_PROMPT}` },
      firstMessage: persona.firstMessage,
      language: SESSION_DEFAULTS.language,
    },
  };
}

function showError(msg) {
  if (!msg) {
    errorBox.hidden = true;
    errorBox.textContent = "";
    return;
  }
  errorBox.hidden = false;
  errorBox.textContent = msg;
}

function parseTokenResponse(text, httpStatus) {
  if (!text) {
    throw new Error(`Błąd tokenu HTTP ${httpStatus}`);
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(text.slice(0, 200) || `Błąd tokenu HTTP ${httpStatus}`);
  }
  if (!data.token) {
    throw new Error("W odpowiedzi API brakuje tokenu");
  }
  return data.token;
}

async function fetchConversationTokenFromDevServer() {
  const res = await fetch("/api/token");
  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try {
      const j = JSON.parse(text);
      detail = j.detail?.map((d) => d.msg).join("; ") || JSON.stringify(j);
    } catch {
      /* raw text */
    }
    throw new Error(detail || `Błąd tokenu HTTP ${res.status}`);
  }
  return parseTokenResponse(text, res.status);
}

async function fetchConversationTokenFromBrowser() {
  const url = new URL("https://api.elevenlabs.io/v1/convai/conversation/token");
  url.searchParams.set("agent_id", AGENT_ID);
  if (BRANCH_ID) {
    url.searchParams.set("branch_id", BRANCH_ID);
  }
  url.searchParams.set("source", CONVAI_TOKEN_SOURCE);
  url.searchParams.set("version", CONVAI_TOKEN_VERSION);

  const res = await fetch(url.toString());
  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try {
      const j = JSON.parse(text);
      detail = j.detail?.map((d) => d.msg).join("; ") || JSON.stringify(j);
    } catch {
      /* raw text */
    }
    throw new Error(detail || `Błąd tokenu HTTP ${res.status}`);
  }
  return parseTokenResponse(text, res.status);
}

function isGitHubPagesHost() {
  return typeof location !== "undefined" && /\.github\.io$/i.test(location.hostname);
}

function buildCallbacks() {
  return {
    onConnect: () => {
      connStatus.textContent = "Połączono";
      stopBtn.disabled = false;
      voiceSelect.disabled = true;
      setCallUi("active");
    },
    onDisconnect: () => {
      connStatus.textContent = "Rozłączono";
      startBtn.disabled = false;
      stopBtn.disabled = true;
      modeStatus.textContent = "—";
      voiceSelect.disabled = false;
      conversation = null;
      setCallUi("idle");
    },
    onError: (err) => {
      console.error(err);
      showError(typeof err === "string" ? err : err?.message || String(err));
    },
    onModeChange: ({ mode }) => {
      modeStatus.textContent = mode === "speaking" ? "Mówi" : "Słucha";
      if (callSurface?.dataset.state === "active" && modeLine) {
        modeLine.textContent =
          mode === "speaking" ? "Głos mówi." : "Możesz mówić.";
      }
    },
  };
}

function setCallUi(state) {
  if (!callSurface) return;
  const persona = personaForVoice(voiceSelect.value);
  callSurface.dataset.state = state;
  if (!callLabel || !modeLine) return;
  if (state === "idle") {
    callLabel.textContent = "Gotowy";
    modeLine.textContent = `Wybrany głos: ${persona.name}. Na start poprosimy o mikrofon.`;
  } else if (state === "connecting") {
    callLabel.textContent = "Łączenie…";
    modeLine.textContent = "Zezwól na mikrofon, jeśli przeglądarka o to poprosi.";
  } else if (state === "active") {
    callLabel.textContent = "Test trwa";
    modeLine.textContent = `Słuchasz głosu: ${persona.name}.`;
  }
}

async function startConversation() {
  showError(null);
  startBtn.disabled = true;
  setCallUi("connecting");

  try {
    const voiceId = voiceSelect.value;
    const overrides = buildOverrides(voiceId);
    const callbacks = buildCallbacks();

    const useLocalTokenServer =
      import.meta.env.DEV && import.meta.env.VITE_DEV_USE_TOKEN_SERVER !== "false";
    if (useLocalTokenServer) {
      const conversationToken = await fetchConversationTokenFromDevServer();
      conversation = await Conversation.startSession({
        conversationToken,
        overrides,
        ...callbacks,
      });
      return;
    }

    if (import.meta.env.VITE_USE_WEBSOCKET === "true") {
      conversation = await Conversation.startSession({
        agentId: AGENT_ID,
        connectionType: "websocket",
        overrides,
        ...callbacks,
      });
      return;
    }

    if (import.meta.env.VITE_USE_AGENT_ID_ONLY === "true") {
      conversation = await Conversation.startSession({
        agentId: AGENT_ID,
        overrides,
        ...callbacks,
      });
      return;
    }

    // GitHub Pages: same transport as pjatk workshop pages (WebSocket + agentId) — WebRTC often dies here.
    // Optional: VITE_PAGES_FORCE_WEBRTC=true in build to use token+branch+WebRTC on github.io anyway.
    if (isGitHubPagesHost() && import.meta.env.VITE_PAGES_FORCE_WEBRTC !== "true") {
      conversation = await Conversation.startSession({
        agentId: AGENT_ID,
        connectionType: "websocket",
        overrides,
        ...callbacks,
      });
      return;
    }

    const conversationToken = await fetchConversationTokenFromBrowser();
    conversation = await Conversation.startSession({
      conversationToken,
      overrides,
      ...callbacks,
    });
  } catch (e) {
    console.error(e);
    showError(e instanceof Error ? e.message : String(e));
    startBtn.disabled = false;
    stopBtn.disabled = true;
    setCallUi("idle");
  }
}

async function stopConversation() {
  if (conversation) {
    await conversation.endSession();
    conversation = null;
  }
}

voiceSelect.addEventListener("change", () => {
  if (callSurface?.dataset.state === "idle") {
    setCallUi("idle");
  }
});

startBtn.addEventListener("click", startConversation);
stopBtn.addEventListener("click", stopConversation);

setCallUi("idle");
