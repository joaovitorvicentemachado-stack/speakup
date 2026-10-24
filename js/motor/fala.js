// =============================================================
// fala.js — exercício "ouvir e repetir".
// Caminho 1 (com internet): reconhecimento de voz do navegador.
//   Ele diz QUAIS PALAVRAS entendeu, não avalia a pronúncia fina
//   (isso é a Etapa 4, com o modelo de fonemas).
// Caminho 2 (offline ou sem suporte): grava, toca sua voz ao lado da
//   voz modelo e você mesmo avalia.
// =============================================================

import { Gravador } from '../audio.js';

const Reconhecimento = window.SpeechRecognition || window.webkitSpeechRecognition;

export const temReconhecimento = () => !!Reconhecimento && navigator.onLine;

/** Escuta uma frase e devolve as transcrições possíveis (até 3). */
export function ouvir({ limiteMs = 7000 } = {}) {
  return new Promise((ok, falha) => {
    const r = new Reconhecimento();
    r.lang = 'en-US';
    r.interimResults = false;
    r.maxAlternatives = 3;
    let terminou = false;
    const acabar = (fn) => { if (!terminou) { terminou = true; clearTimeout(t); fn(); } };
    r.onresult = (e) => acabar(() => ok([...e.results[0]].map((a) => ({ texto: a.transcript, confianca: a.confidence }))));
    r.onerror = (e) => acabar(() => falha(new Error(e.error)));
    r.onend = () => acabar(() => ok([]));
    const t = setTimeout(() => { try { r.stop(); } catch { /* já parou */ } }, limiteMs);
    r.start();
  });
}

/** Grava a própria voz (para comparar de ouvido). */
export async function gravarComparacao(aoNivel) {
  const g = new Gravador({ limiteSegundos: 5 });
  await g.iniciar(aoNivel);
  return { parar: () => g.parar(), concluido: g.concluido };
}
