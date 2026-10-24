// =============================================================
// correcao.js — confere respostas digitadas ou faladas.
// Regras: ignora maiúsculas, pontuação e espaços extras; aceita
// contrações ("I'm" = "I am"); tolera 1 erro de digitação a cada
// ~8 letras como "quase certo" (conta como acerto, com aviso).
// =============================================================

const CONTRACOES = {
  "i'm": 'i am', "you're": 'you are', "we're": 'we are', "they're": 'they are', "he's": 'he is', "she's": 'she is',
  "it's": 'it is', "that's": 'that is', "there's": 'there is', "what's": 'what is', "where's": 'where is', "how's": 'how is',
  "don't": 'do not', "doesn't": 'does not', "didn't": 'did not', "isn't": 'is not', "aren't": 'are not', "wasn't": 'was not',
  "weren't": 'were not', "can't": 'cannot', "couldn't": 'could not', "won't": 'will not', "wouldn't": 'would not',
  "i'll": 'i will', "you'll": 'you will', "we'll": 'we will', "i'd": 'i would', "you'd": 'you would', "i've": 'i have',
  "you've": 'you have', "we've": 'we have', "haven't": 'have not', "hasn't": 'has not', "let's": 'let us',
  // Sem apóstrofo (muito comum ao digitar no celular).
  im: 'i am', dont: 'do not', doesnt: 'does not', didnt: 'did not', isnt: 'is not', arent: 'are not', wasnt: 'was not',
  werent: 'were not', cant: 'cannot', couldnt: 'could not', wouldnt: 'would not', ive: 'i have', youre: 'you are',
  theyre: 'they are', whats: 'what is', thats: 'that is', theres: 'there is', hes: 'he is', shes: 'she is', lets: 'let us',
  havent: 'have not', hasnt: 'has not',
};

/** Deixa o texto comparável. */
export function normalizar(t) {
  let s = (t || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')       // tira acentos (para respostas em português)
    .replace(/[’‘`´]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')                            // tira pontuação
    .replace(/\s+/g, ' ').trim();
  s = s.split(' ').map((p) => CONTRACOES[p] || p).join(' ');
  return s.replace(/'/g, '').replace(/\bcan not\b/g, 'cannot');
}

export function levenshtein(a, b) {
  const v = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = v[0];
    v[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = v[j];
      v[j] = Math.min(v[j] + 1, v[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return v[b.length];
}

/**
 * Compara a resposta com uma ou mais respostas certas.
 * @returns {{resultado: 'certo'|'quase'|'errado', esperado: string}}
 */
export function conferir(resposta, certas) {
  const r = normalizar(resposta);
  const lista = (Array.isArray(certas) ? certas : [certas]).filter(Boolean);
  let melhor = { dist: Infinity, texto: lista[0] };
  for (const c of lista) {
    const n = normalizar(c);
    if (r === n) return { resultado: 'certo', esperado: c };
    const d = levenshtein(r, n);
    if (d < melhor.dist) melhor = { dist: d, texto: c, n };
  }
  const tolerancia = Math.min(3, Math.max(1, Math.floor((melhor.n || '').length / 8)));
  // "Quase" só se não faltou palavra inteira.
  const mesmasPalavras = r.split(' ').length === (melhor.n || '').split(' ').length;
  if (melhor.dist <= tolerancia && mesmasPalavras && r.length > 0) return { resultado: 'quase', esperado: melhor.texto };
  return { resultado: 'errado', esperado: melhor.texto };
}

/** Porcentagem de palavras do alvo que aparecem na fala reconhecida (para "ouvir e repetir"). */
export function coberturaPalavras(falado, alvo) {
  const f = normalizar(falado).split(' ');
  const a = normalizar(alvo).split(' ').filter(Boolean);
  if (!a.length) return 0;
  const restante = [...f];
  let ok = 0;
  for (const p of a) {
    const i = restante.findIndex((x) => x === p || (p.length > 3 && levenshtein(x, p) <= 1));
    if (i >= 0) { ok++; restante.splice(i, 1); }
  }
  return ok / a.length;
}

/** Separa uma frase em "fichas" para o exercício de montar (mantém contrações juntas). */
export function fichas(frase) {
  return frase.replace(/[.,!?]/g, '').split(/\s+/).filter(Boolean);
}
