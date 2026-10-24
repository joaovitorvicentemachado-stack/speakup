// =============================================================
// voz.js — fala em inglês com a voz do próprio navegador (Web Speech).
// Grátis. No Android e no Windows há vozes que funcionam offline;
// algumas vozes "Natural/Online" (Edge) precisam de internet.
// Na Etapa 3 este módulo ganha provedores extras (Orpheus, Kokoro).
// =============================================================

let vozes = [];
function carregarVozes() {
  vozes = (window.speechSynthesis?.getVoices() || []).filter((v) => /^en[-_]/i.test(v.lang));
}
if ('speechSynthesis' in window) {
  carregarVozes();
  speechSynthesis.onvoiceschanged = carregarVozes;
}

export const disponivel = () => 'speechSynthesis' in window;

/** Lista as vozes em inglês, as americanas e "naturais" primeiro. */
export function listarVozes() {
  if (!vozes.length) carregarVozes();
  const nota = (v) => (/en[-_]US/i.test(v.lang) ? 2 : 0) + (/natural|neural|google/i.test(v.name) ? 1 : 0) + (v.localService ? 0.5 : 0);
  return [...vozes].sort((a, b) => nota(b) - nota(a));
}

let config = { vozURI: null, velocidade: 0.95 };
export function configurar(c) { config = { ...config, ...c }; }

/** Fala o texto. Devolve uma Promise que resolve quando termina. */
export function falar(texto, { lento = false } = {}) {
  return new Promise((ok) => {
    if (!disponivel()) return ok(false);
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = 'en-US';
    u.rate = lento ? 0.6 : config.velocidade;
    const lista = listarVozes();
    const v = lista.find((x) => x.voiceURI === config.vozURI) || lista[0];
    if (v) { u.voice = v; u.lang = v.lang; }
    u.onend = () => ok(true);
    u.onerror = () => ok(false);
    speechSynthesis.speak(u);
    // Alguns Android não disparam "onend": garante que a Promise termina.
    setTimeout(() => ok(true), 1500 + texto.length * 120);
  });
}

export function parar() { if (disponivel()) speechSynthesis.cancel(); }
