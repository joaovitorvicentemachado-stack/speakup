// =============================================================
// srs.js — repetição espaçada (algoritmo SM-2, o mesmo base do Anki).
// Um "cartão" é um item (palavra ou frase) com quando revisar de novo.
// Nota (qualidade) de 0 a 5: <3 = errou; 3 = acertou com dificuldade;
// 4 = acertou; 5 = acertou fácil.
// =============================================================

import { hoje, somarDias } from './datas.js';

export function novoCartao(id) {
  return { id, ef: 2.5, intervalo: 0, reps: 0, vence: hoje(), lapsos: 0, acertos: 0, erros: 0 };
}

/** Aplica uma resposta ao cartão e devolve o cartão atualizado (não altera o original). */
export function responder(cartao, qualidade, dia = hoje()) {
  const c = { ...cartao };
  if (qualidade < 3) {
    c.reps = 0;
    c.intervalo = 1;            // volta amanhã
    c.lapsos += 1;
    c.erros += 1;
  } else {
    c.reps += 1;
    c.acertos += 1;
    c.intervalo = c.reps === 1 ? 1 : c.reps === 2 ? 3 : Math.round(c.intervalo * c.ef);
  }
  // Fórmula do SM-2 para a "facilidade" do cartão (mínimo 1.3).
  c.ef = Math.max(1.3, c.ef + (0.1 - (5 - qualidade) * (0.08 + (5 - qualidade) * 0.02)));
  c.vence = somarDias(dia, c.intervalo);
  return c;
}

/** Cartões vencidos (para revisar hoje), os mais atrasados e mais errados primeiro. */
export function vencidos(cartoes, dia = hoje()) {
  return Object.values(cartoes)
    .filter((c) => c.vence <= dia)
    .sort((a, b) => (a.vence < b.vence ? -1 : a.vence > b.vence ? 1 : b.lapsos - a.lapsos));
}

/** Um cartão é "aprendido" quando já tem intervalo de 7+ dias. */
export const aprendido = (c) => c.intervalo >= 7;
