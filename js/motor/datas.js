// =============================================================
// datas.js — datas no fuso do aparelho, no formato AAAA-MM-DD.
// (Usar UTC faria o "dia" virar às 21h no Brasil.)
// =============================================================

const doisDigitos = (n) => String(n).padStart(2, '0');

export function formatar(d) {
  return `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`;
}

export const hoje = () => formatar(new Date());

export function somarDias(dia, n) {
  const [a, m, d] = dia.split('-').map(Number);
  return formatar(new Date(a, m - 1, d + n));
}

export function diferencaDias(de, ate) {
  const [a1, m1, d1] = de.split('-').map(Number);
  const [a2, m2, d2] = ate.split('-').map(Number);
  return Math.round((new Date(a2, m2 - 1, d2) - new Date(a1, m1 - 1, d1)) / 86400000);
}
