// =============================================================
// gamificacao.js — regras de XP, níveis, vidas e conquistas.
// Tudo é calculado a partir do estado salvo (progresso.js).
// =============================================================

export const XP = { licao: 10, licaoPerfeita: 5, revisaoPorCartao: 1, revisaoMinima: 5, nivelamento: 10 };
export const VIDAS = { maximo: 5, minutosPorVida: 30 };
export const METAS = [{ xp: 10, nome: 'Leve' }, { xp: 20, nome: 'Normal' }, { xp: 30, nome: 'Puxada' }, { xp: 50, nome: 'Intensa' }];

/** Nível do jogador: cada nível pede 50 XP a mais que o anterior (50, 100, 150…). */
export function nivelDoXP(xp) {
  let nivel = 1, custo = 50, resto = xp;
  while (resto >= custo) { resto -= custo; nivel++; custo += 50; }
  return { nivel, noNivel: resto, paraProximo: custo };
}

/** Vidas atuais, regenerando 1 a cada 30 min. */
export function vidasAtuais(vidas, agora = Date.now()) {
  if (vidas.qtd >= VIDAS.maximo) return { qtd: VIDAS.maximo, proximaEmMin: null };
  const ganho = Math.floor((agora - vidas.desde) / (VIDAS.minutosPorVida * 60000));
  const qtd = Math.min(VIDAS.maximo, vidas.qtd + ganho);
  const proximaEmMin = qtd >= VIDAS.maximo ? null
    : Math.ceil(VIDAS.minutosPorVida - ((agora - vidas.desde) / 60000) % VIDAS.minutosPorVida);
  return { qtd, proximaEmMin };
}

// Cada conquista: id, nome, descrição e a regra (recebe o estado e um resumo).
export const CONQUISTAS = [
  { id: 'primeira', icone: '🌱', nome: 'Primeiro passo', desc: 'Concluir a primeira lição', ok: (e) => Object.keys(e.licoes).length >= 1 },
  { id: 'nivelado', icone: '🧭', nome: 'Sei onde estou', desc: 'Fazer o teste de nível', ok: (e) => !!e.perfil.nivel },
  { id: 'perfeita', icone: '💎', nome: 'Sem erros', desc: 'Terminar uma lição sem errar', ok: (e) => Object.values(e.licoes).some((l) => l.melhor === 100) },
  { id: 'seq3', icone: '🔥', nome: 'Pegando fogo', desc: 'Sequência de 3 dias', ok: (e) => e.sequencia.recorde >= 3 },
  { id: 'seq7', icone: '🏆', nome: 'Uma semana', desc: 'Sequência de 7 dias', ok: (e) => e.sequencia.recorde >= 7 },
  { id: 'seq30', icone: '👑', nome: 'Hábito formado', desc: 'Sequência de 30 dias', ok: (e) => e.sequencia.recorde >= 30 },
  { id: 'xp100', icone: '⭐', nome: '100 XP', desc: 'Juntar 100 XP', ok: (e) => e.xp >= 100 },
  { id: 'xp500', icone: '🌟', nome: '500 XP', desc: 'Juntar 500 XP', ok: (e) => e.xp >= 500 },
  { id: 'unidade', icone: '🎓', nome: 'Unidade completa', desc: 'Concluir todas as lições de uma unidade', ok: (e, r) => r.unidadesCompletas >= 1 },
  { id: 'palavras50', icone: '📚', nome: '50 itens firmes', desc: '50 palavras/frases com revisão de 7+ dias', ok: (e, r) => r.aprendidos >= 50 },
  { id: 'revisor', icone: '🔁', nome: 'Revisor', desc: 'Responder 100 revisões', ok: (e) => (e.contadores.revisoes || 0) >= 100 },
  { id: 'falante', icone: '🎙️', nome: 'Sem vergonha de falar', desc: 'Fazer 50 exercícios de fala', ok: (e) => (e.contadores.falas || 0) >= 50 },
];

/** Devolve as conquistas novas (ainda não registradas) que o estado já atingiu. */
export function novasConquistas(estado, resumo) {
  return CONQUISTAS.filter((c) => !estado.conquistas[c.id] && c.ok(estado, resumo));
}
