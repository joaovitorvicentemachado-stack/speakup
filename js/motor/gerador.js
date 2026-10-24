// =============================================================
// gerador.js — transforma os dados de uma lição em exercícios.
// Tipos: pares, escolha (múltipla escolha), montar (frase com fichas),
// lacuna (completar), ditado (ouvir e escrever), traduzir (digitar),
// falar (ouvir e repetir).
// Cada exercício leva "cat" (vocabulario/gramatica/escuta/pronuncia)
// para as estatísticas, e "ids" dos cartões de repetição espaçada.
// =============================================================

import { fichas } from './correcao.js';

const embaralhar = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
const sortear = (arr, n, excluir = []) => embaralhar(arr.filter((x) => !excluir.includes(x))).slice(0, n);
const sem = (s) => s.replace(/[.,!?]/g, '');

// ---------- itens e identificadores --------------------------------
export const idPalavra = (en) => 'w:' + en.toLowerCase();
export const idFrase = (licaoId, i) => `f:${licaoId}:${i}`;

const palavra = ([en, pt, emoji]) => ({ en, pt, emoji, id: idPalavra(en) });
const frase = (licaoId) => ([en, pt, alts = []], i) => ({ en, pt, alts, id: idFrase(licaoId, i) });

/** Índice id -> item, para a revisão encontrar o conteúdo de cada cartão. */
export function indexar(unidades) {
  const idx = new Map();
  for (const u of unidades) for (const l of u.licoes) {
    l.palavras.forEach((p) => idx.set(idPalavra(p[0]), { tipo: 'palavra', ...palavra(p), unidade: u, licao: l }));
    l.frases.forEach((f, i) => idx.set(idFrase(l.id, i), { tipo: 'frase', ...frase(l.id)(f, i), unidade: u, licao: l }));
  }
  return idx;
}

// ---------- construtores de cada tipo ------------------------------
function exPares(palavras) {
  return { tipo: 'pares', cat: 'vocabulario', titulo: 'Toque nos pares', itens: palavras.slice(0, 5), ids: palavras.map((p) => p.id) };
}

function exEscolhaPalavra(p, pool, sentido) {
  // Evita opções repetidas (ex.: "thanks" e "thank you" = "obrigado").
  const vistos = new Set([p.en.toLowerCase(), p.pt.toLowerCase()]);
  const outros = embaralhar(pool).filter((x) => {
    if (vistos.has(x.en.toLowerCase()) || vistos.has(x.pt.toLowerCase())) return false;
    vistos.add(x.en.toLowerCase()); vistos.add(x.pt.toLowerCase());
    return true;
  }).slice(0, 3);
  if (sentido === 'en-pt') {
    return { tipo: 'escolha', cat: 'vocabulario', titulo: 'O que significa?', destaque: p.en, audio: p.en,
      opcoes: embaralhar([p.pt, ...outros.map((o) => o.pt)]), certa: p.pt, ids: [p.id] };
  }
  return { tipo: 'escolha', cat: 'vocabulario', titulo: `Como se diz "${p.pt}"?`, destaque: p.emoji,
    opcoes: embaralhar([p.en, ...outros.map((o) => o.en)]), certa: p.en, falarOpcoes: true, ids: [p.id] };
}

function exEscolhaFrase(f, poolFrases) {
  const outras = sortear(poolFrases.filter((x) => x.en !== f.en), 3);
  return { tipo: 'escolha', cat: 'gramatica', titulo: 'Escolha a tradução', destaque: f.en, audio: f.en, destaqueIngles: true,
    opcoes: embaralhar([f.pt, ...outras.map((o) => o.pt)]), certa: f.pt, ids: [f.id] };
}

function exMontar(f, poolFrases, idioma = 'en') {
  const alvo = idioma === 'en' ? f.en : f.pt;
  const certas = fichas(alvo);
  const extras = sortear(
    [...new Set(poolFrases.filter((x) => x.en !== f.en).flatMap((x) => fichas(idioma === 'en' ? x.en : x.pt)))]
      .filter((w) => !certas.map((c) => c.toLowerCase()).includes(w.toLowerCase())), Math.min(3, Math.max(2, Math.round(certas.length / 3))));
  return { tipo: 'montar', cat: idioma === 'en' ? 'gramatica' : 'vocabulario',
    titulo: idioma === 'en' ? 'Monte a frase em inglês' : 'Monte a tradução',
    origem: idioma === 'en' ? f.pt : f.en, audioOrigem: idioma === 'en' ? null : f.en,
    fichas: embaralhar([...certas, ...extras]), respostas: idioma === 'en' ? [f.en, ...f.alts] : [f.pt],
    idioma, ids: [f.id] };
}

function exLacuna(f, palavrasLicao, pool) {
  const tokens = f.en.split(' ');
  const limpos = tokens.map((t) => sem(t).toLowerCase());
  let i = limpos.findIndex((t) => palavrasLicao.some((p) => p.en.toLowerCase() === t));
  if (i < 0) i = limpos.reduce((m, t, k) => (t.length > limpos[m].length ? k : m), 0);
  const certa = sem(tokens[i]);
  // Opções erradas sem repetir palavra (ignorando maiúsculas).
  const vistas = new Set([certa.toLowerCase()]);
  const outros = embaralhar(pool.flatMap((x) => fichas(x.en))).filter((w) => {
    const k = w.toLowerCase();
    if (vistas.has(k) || w.length < 2) return false;
    vistas.add(k);
    return true;
  }).slice(0, 3);
  const pont = tokens[i].slice(certa.length);
  return { tipo: 'lacuna', cat: 'gramatica', titulo: 'Complete a frase',
    antes: tokens.slice(0, i).join(' '), depois: pont + (i < tokens.length - 1 ? ' ' + tokens.slice(i + 1).join(' ') : ''),
    traducao: f.pt, opcoes: embaralhar([certa, ...outros]), certa, audio: f.en, ids: [f.id] };
}

const exDitado = (f) => ({ tipo: 'ditado', cat: 'escuta', titulo: 'Ouça e escreva', audio: f.en, respostas: [f.en, ...f.alts], traducao: f.pt, ids: [f.id] });
const exTraduzir = (f) => ({ tipo: 'traduzir', cat: 'gramatica', titulo: 'Escreva em inglês', origem: f.pt, respostas: [f.en, ...f.alts], ids: [f.id] });
const exFalar = (f) => ({ tipo: 'falar', cat: 'pronuncia', titulo: 'Ouça e repita', alvo: f.en, traducao: f.pt, ids: [f.id] });

// ---------- lição completa ----------------------------------------
/**
 * @param licao lição do currículo
 * @param unidade unidade da lição (para tirar opções erradas)
 * @param opcoes {falar: boolean}
 */
export function gerarLicao(licao, unidade, { falar = true } = {}) {
  const P = licao.palavras.map(palavra);
  const F = licao.frases.map(frase(licao.id));
  const poolP = unidade.licoes.flatMap((l) => l.palavras.map(palavra));
  const poolF = unidade.licoes.flatMap((l) => l.frases.map(frase(l.id)));
  const f = (i) => F[i % F.length];
  const p = (i) => P[i % P.length];

  const lista = [
    exEscolhaPalavra(p(0), poolP, 'en-pt'),
    exEscolhaPalavra(p(1), poolP, 'pt-en'),
    exPares(P),
    exLacuna(f(0), P, poolF),
    exMontar(f(1), poolF, 'en'),
    exDitado(f(2)),
    exEscolhaPalavra(p(2), poolP, 'en-pt'),
    exEscolhaFrase(f(3), poolF),
    exMontar(f(2), poolF, 'pt'),
    exTraduzir(f(0)),
  ];
  if (falar) lista.push(exFalar(f(3)), exFalar(f(1)));
  return lista;
}

/** Exercícios para a revisão espaçada, a partir dos cartões vencidos. */
export function gerarRevisao(cartoes, indice, { falar = true, maximo = 15 } = {}) {
  const lista = [];
  for (const c of cartoes.slice(0, maximo)) {
    const item = indice.get(c.id);
    if (!item) continue;
    const poolP = item.unidade.licoes.flatMap((l) => l.palavras.map(palavra));
    const poolF = item.unidade.licoes.flatMap((l) => l.frases.map(frase(l.id)));
    const sorte = Math.random();
    if (item.tipo === 'palavra') {
      lista.push(exEscolhaPalavra(item, poolP, sorte < 0.5 ? 'en-pt' : 'pt-en'));
    } else if (sorte < 0.3) lista.push(exMontar(item, poolF, 'en'));
    else if (sorte < 0.55) lista.push(exDitado(item));
    else if (sorte < 0.8 || !falar) lista.push(exTraduzir(item));
    else lista.push(exFalar(item));
  }
  return lista;
}
