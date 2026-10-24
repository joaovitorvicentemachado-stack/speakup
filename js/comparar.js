// =============================================================
// comparar.js — compara a sequência de FONEMAS reconhecida com a esperada.
// Não depende de nenhum modelo: recebe texto IPA e devolve a análise.
// Se você trocar o modelo de fonemas, só precisa ajustar NORMALIZACAO
// (caso o novo modelo use outros símbolos, ex.: "iː" em vez de "i").
// =============================================================

// Símbolos de mais de um caractere que precisam ser lidos como um fonema só.
const MULTI = ['aɪ', 'aʊ', 'eɪ', 'oʊ', 'ɔɪ', 'tʃ', 'dʒ'];

// Vogais do inventário (TIMIT em IPA) — usadas para achar o "núcleo" da sílaba.
const VOGAIS = new Set(['i', 'ɪ', 'e', 'ɛ', 'æ', 'ɑ', 'ʌ', 'ɔ', 'ʊ', 'u', 'ɝ', 'ɚ', 'ə',
  'aɪ', 'aʊ', 'eɪ', 'oʊ', 'ɔɪ', 'o', 'a', 'ɐ', 'ɒ', 'ɜ', 'ɨ', 'ʉ']);

// Equivalências para que modelos diferentes sejam comparáveis.
const NORMALIZACAO = { 'ʧ': 'tʃ', 'ʤ': 'dʒ', 'ɡ': 'g', 'ɹ': 'r', 'ɾ': 't' };

/** Separa uma string IPA em lista de fonemas (remove espaços, acentos e "ː"). */
export function tokenizar(ipa) {
  const limpo = (ipa || '')
    .normalize('NFC')
    .replace(/[ˈˌː|.\s]/g, '')            // tonicidade, duração e separadores
    .replace(/ʧ|ʤ|ɡ|ɹ/g, (c) => NORMALIZACAO[c]);
  const out = [];
  for (let i = 0; i < limpo.length;) {
    const dois = limpo.slice(i, i + 2);
    if (MULTI.includes(dois)) { out.push(dois); i += 2; } else { out.push(limpo[i]); i += 1; }
  }
  return out;
}

/** Distância de edição entre duas listas de fonemas (Levenshtein). */
export function distancia(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[a.length][b.length];
}

/** Primeira vogal da sequência (núcleo da sílaba em palavras de uma sílaba). */
export function nucleo(fonemas) {
  return fonemas.find((f) => VOGAIS.has(f)) ?? null;
}

// Pares mínimos do teste. "chave" é o que identifica cada palavra.
export const PALAVRAS = {
  ship:  { ipa: 'ʃɪp', fonemas: ['ʃ', 'ɪ', 'p'], vogal: 'ɪ', dica: 'i curto e relaxado, quase um "ê" fechado' },
  sheep: { ipa: 'ʃiːp', fonemas: ['ʃ', 'i', 'p'], vogal: 'i', dica: 'i longo, lábios esticados como num sorriso' },
};

/**
 * Analisa uma tentativa do teste ship × sheep.
 * @param {string} ipaReconhecido texto devolvido pelo modelo
 * @param {'ship'|'sheep'} alvo palavra que a pessoa tentou falar
 */
export function analisarShipSheep(ipaReconhecido, alvo) {
  const fon = tokenizar(ipaReconhecido);
  const v = nucleo(fon);
  let ouvido = 'outro';
  if (v === 'i') ouvido = 'sheep';
  else if (v === 'ɪ') ouvido = 'ship';
  const dShip = distancia(fon, PALAVRAS.ship.fonemas);
  const dSheep = distancia(fon, PALAVRAS.sheep.fonemas);
  return {
    fonemas: fon,
    vogal: v,
    ouvido,                                  // o que o modelo "ouviu"
    acertou: ouvido === alvo,
    consoantesOk: fon[0] === 'ʃ' && fon[fon.length - 1] === 'p',
    distancias: { ship: dShip, sheep: dSheep },
  };
}

/** Resume uma lista de tentativas {alvo, analise, ms}. */
export function resumir(tentativas) {
  const por = (p) => tentativas.filter((t) => t.alvo === p);
  const acertos = (p) => por(p).filter((t) => t.analise.acertou).length;
  const tempos = tentativas.map((t) => t.ms).filter(Number.isFinite);
  const media = tempos.length ? tempos.reduce((a, b) => a + b, 0) / tempos.length : null;
  const r = {
    ship: { feitas: por('ship').length, acertos: acertos('ship') },
    sheep: { feitas: por('sheep').length, acertos: acertos('sheep') },
    tempoMedioMs: media,
    tempoMaxMs: tempos.length ? Math.max(...tempos) : null,
  };
  const taxa = (x) => (x.feitas ? x.acertos / x.feitas : 0);
  if (r.ship.feitas < 5 || r.sheep.feitas < 5) r.veredito = 'incompleto';
  else if (taxa(r.ship) >= 0.8 && taxa(r.sheep) >= 0.8) r.veredito = 'distingue';
  else if (taxa(r.ship) >= 0.6 && taxa(r.sheep) >= 0.6) r.veredito = 'parcial';
  else r.veredito = 'nao-distingue';
  return r;
}
