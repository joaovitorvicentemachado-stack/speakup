// =============================================================
// armazenamento.js — guarda dados pequenos no próprio aparelho.
// Hoje usa localStorage; se um dia precisar de mais espaço (ex.: guardar
// áudios), troque só este arquivo por IndexedDB.
// =============================================================

const PREFIXO = 'ingles:';

export function ler(chave, padrao = null) {
  try {
    const v = localStorage.getItem(PREFIXO + chave);
    return v === null ? padrao : JSON.parse(v);
  } catch { return padrao; }
}

export function gravar(chave, valor) {
  try { localStorage.setItem(PREFIXO + chave, JSON.stringify(valor)); return true; } catch { return false; }
}

export function apagar(chave) {
  try { localStorage.removeItem(PREFIXO + chave); } catch { /* sem armazenamento: ignora */ }
}
