// =============================================================
// nivelamento.js — teste de nível inicial (A1 → B1).
// 15 questões em 3 blocos. Se errar muito um bloco, o teste para
// ali (não faz sentido cansar com o nível de cima).
// "ouvir": true faz o app ler a frase em voz alta em vez de mostrar.
// =============================================================

export const BLOCOS = [
  {
    nivel: 'A1',
    questoes: [
      { p: 'Complete: "My name ___ Pedro."', op: ['is', 'are', 'am', 'be'], c: 0, cat: 'gramatica' },
      { p: 'O que significa "Where are you from?"', op: ['De onde você é?', 'Onde você está?', 'Para onde você vai?', 'Onde você mora?'], c: 0, cat: 'vocabulario' },
      { p: 'Ouça e escolha o que foi dito.', audio: 'I wake up at seven.', op: ['I wake up at seven.', 'I walk up at seven.', 'I wake up at eleven.', 'I make up at seven.'], c: 0, cat: 'escuta' },
      { p: 'Complete: "She ___ in an office."', op: ['works', 'work', 'working', 'is work'], c: 0, cat: 'gramatica' },
      { p: 'Como se diz "Eu não gosto de café"?', op: ["I don't like coffee.", "I not like coffee.", "I doesn't like coffee.", "I no like coffee."], c: 0, cat: 'gramatica' },
    ],
  },
  {
    nivel: 'A2',
    questoes: [
      { p: 'Complete: "We ___ very tired yesterday."', op: ['were', 'was', 'are', 'been'], c: 0, cat: 'gramatica' },
      { p: 'Complete: "Do you have ___ sugar?"', op: ['any', 'some', 'many', 'a'], c: 0, cat: 'gramatica' },
      { p: 'O que significa "I missed the bus"?', op: ['Eu perdi o ônibus.', 'Eu senti falta do ônibus.', 'Eu peguei o ônibus.', 'Eu esperei o ônibus.'], c: 0, cat: 'vocabulario' },
      { p: 'Ouça e escolha o que foi dito.', audio: "I'm going to travel next year.", op: ["I'm going to travel next year.", 'I went to travel last year.', 'I want to travel next year.', 'I go to travel every year.'], c: 0, cat: 'escuta' },
      { p: 'Qual frase é a mais educada para pedir comida?', op: ["I'd like the chicken, please.", 'Give me the chicken.', 'I want chicken.', 'Chicken now.'], c: 0, cat: 'vocabulario' },
    ],
  },
  {
    nivel: 'B1',
    questoes: [
      { p: 'Complete: "Have you ever ___ to London?"', op: ['been', 'went', 'go', 'gone to'], c: 0, cat: 'gramatica' },
      { p: 'Complete: "I ___ here since 2024."', op: ['have lived', 'live', 'am living', 'lived'], c: 0, cat: 'gramatica' },
      { p: 'O que significa "The deadline is by Friday"?', op: ['O prazo é até sexta.', 'A reunião é na sexta.', 'O prazo começa na sexta.', 'A entrega foi na sexta.'], c: 0, cat: 'vocabulario' },
      { p: 'Ouça e escolha o que foi dito.', audio: 'Would you mind opening the window?', op: ['Would you mind opening the window?', 'Would you like to open the window?', 'Do you mind if I open the window?', 'Could you open the window?'], c: 0, cat: 'escuta' },
      { p: 'Complete: "If I ___ more time, I would study more."', op: ['had', 'have', 'will have', 'would have'], c: 0, cat: 'gramatica' },
    ],
  },
];

/**
 * Decide o nível pelos acertos de cada bloco.
 * Passa no bloco com 4 de 5 (80%). O nível final é o último bloco aprovado;
 * se não passar no A1, o nível é "A1 iniciante" e começa do zero.
 */
export function calcularNivel(acertosPorBloco) {
  let nivel = 'Iniciante';
  for (let i = 0; i < BLOCOS.length; i++) {
    if ((acertosPorBloco[i] ?? 0) >= 4) nivel = BLOCOS[i].nivel; else break;
  }
  return nivel;
}

/** Qual unidade abrir para cada nível. */
export const UNIDADE_INICIAL = { Iniciante: 'u1', A1: 'u3', A2: 'u5', B1: 'u6' };
