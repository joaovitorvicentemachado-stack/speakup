// =============================================================
// sessao.js — roda uma sequência de exercícios (lição ou revisão):
// barra de progresso, botão Verificar, feedback de acerto/erro,
// repetição dos errados no fim, vidas e tela final.
// =============================================================

import { h, trocar, confirmar } from './dom.js';
import { renderizar, autoCorrigido } from './exercicios.js';
import * as prog from '../motor/progresso.js';
import * as voz from '../motor/voz.js';
import { VIDAS } from '../motor/gamificacao.js';

/**
 * @param raiz elemento onde desenhar
 * @param cfg { titulo, exercicios, revisao, dica, aoTerminar(resumo) -> {xp, conquistas}, aoSair() }
 */
export function iniciarSessao(raiz, cfg) {
  const fila = [...cfg.exercicios];
  const total = fila.length;
  const repetidos = new Set();
  let feitos = 0, acertosPrimeira = 0, avaliados = 0, indice = 0;
  const inicio = Date.now();
  let atual = null, estado = 'respondendo';
  document.body.classList.add('em-sessao');

  const barra = h('i');
  const vidasEl = h('span', { class: 'vidas-sessao', hidden: !prog.obter().perfil.vidasAtivas });
  const sair = h('button', { class: 'fechar', type: 'button', 'aria-label': 'Sair da lição', onclick: tentarSair }, '✕');
  const corpo = h('div', { class: 'sessao-corpo' });
  const botao = h('button', { class: 'botao botao-primario botao-largo', type: 'button', disabled: true, onclick: acao }, 'Verificar');
  const feedback = h('div', { class: 'feedback', hidden: true });
  const rodape = h('div', { class: 'sessao-rodape' }, feedback, botao);

  trocar(raiz, h('div', { class: 'sessao' },
    h('div', { class: 'sessao-topo' }, sair, h('div', { class: 'progresso-sessao', role: 'progressbar', 'aria-label': 'Progresso' }, barra), vidasEl),
    corpo, rodape));

  const teclado = (e) => {
    if (e.key === 'Enter' && !botao.disabled && document.activeElement?.tagName !== 'TEXTAREA') { e.preventDefault(); acao(); }
  };
  document.addEventListener('keydown', teclado);

  function atualizarTopo() {
    barra.style.width = `${(100 * feitos) / (total + repetidos.size)}%`;
    if (prog.obter().perfil.vidasAtivas) vidasEl.textContent = `❤️ ${prog.vidas().qtd}`;
  }

  async function tentarSair() {
    if (feitos === 0 || await confirmar({ titulo: 'Sair da lição?', texto: 'O progresso desta lição será perdido.', sim: 'Sair', nao: 'Continuar estudando', perigo: true })) {
      encerrar(); cfg.aoSair();
    }
  }

  function encerrar() {
    voz.parar();
    document.removeEventListener('keydown', teclado);
    // A classe "em-sessao" (esconde as abas) sai quando a rota muda (principal.js).
  }

  // Se uma dica existe, mostra antes do primeiro exercício.
  if (cfg.dica) {
    trocar(corpo, h('div', { class: 'dica-inicial' },
      h('span', { class: 'etiqueta' }, 'Dica da lição'), h('h2', {}, cfg.titulo), h('p', {}, cfg.dica)));
    botao.disabled = false; botao.textContent = 'Começar'; estado = 'dica';
  } else proximo();

  function proximo() {
    atualizarTopo();
    if (prog.obter().perfil.vidasAtivas && !cfg.revisao && prog.vidas().qtd <= 0) return semVidas();
    // Pula exercícios de fala se estiverem pausados ou desligados.
    while (fila[indice]?.tipo === 'falar' && (prog.falaPausada() || !prog.obter().perfil.falarAtivo)) { fila.splice(indice, 1); }
    const ex = fila[indice];
    if (!ex) return terminar();
    estado = 'respondendo';
    feedback.hidden = true;
    feedback.className = 'feedback';
    botao.textContent = 'Verificar';
    botao.className = 'botao botao-primario botao-largo';
    botao.disabled = true;
    botao.hidden = autoCorrigido(ex);
    const ctx = {
      podeVerificar: (v) => { if (estado === 'respondendo') botao.disabled = !v; },
      concluir: (nota, info) => mostrarResultado(ex, { nota, ...info }),
      enter: () => { if (!botao.disabled) acao(); },
    };
    atual = { ex, ...renderizar(ex, ctx) };
    trocar(corpo, h('div', { class: 'ex-cabecalho' },
      repetidos.has(ex) ? h('span', { class: 'etiqueta etiqueta-repetir' }, 'Revisando um erro') : null,
      h('h2', {}, ex.titulo)), atual.el);
    corpo.scrollTop = 0;
  }

  function acao() {
    if (estado === 'dica') return proximo();
    if (estado === 'respondendo') return mostrarResultado(atual.ex, atual.verificar());
    if (estado === 'resultado') { indice++; return proximo(); }
  }

  function mostrarResultado(ex, r) {
    estado = 'resultado';
    botao.hidden = false;
    if (r.nota === 'pulado') { indice++; return proximo(); }
    prog.registrarResposta(ex, r.nota, { revisao: !!cfg.revisao });
    const certo = r.nota !== 'errado';
    if (!repetidos.has(ex)) { avaliados++; if (certo) acertosPrimeira++; }
    if (!certo && !repetidos.has(ex)) { repetidos.add(ex); fila.push(ex); }
    feitos++;
    atualizarTopo();
    corpo.classList.remove('treme');
    if (!certo) { void corpo.offsetWidth; corpo.classList.add('treme'); }

    const titulo = r.nota === 'certo' ? ['Muito bem!', 'Isso aí!', 'Perfeito!', 'Mandou bem!'][Math.floor(Math.random() * 4)]
      : r.nota === 'quase' ? 'Quase! Atenção à escrita.' : 'Resposta certa:';
    const mostrarEsperado = r.nota !== 'certo' || ex.tipo === 'ditado';
    feedback.className = `feedback ${certo ? 'bom' : 'ruim'}`;
    trocar(feedback, 
      h('strong', {}, titulo),
      mostrarEsperado && r.esperado ? h('p', { class: 'esperado' },
        /[a-z]/i.test(r.esperado) ? h('button', { class: 'botao-som', type: 'button', onclick: () => voz.falar(r.esperado) }, '🔊') : null, ' ', r.esperado) : null,
      r.detalhe ? h('p', { class: 'detalhe' }, r.detalhe) : null);
    feedback.hidden = false;
    botao.textContent = 'Continuar';
    botao.disabled = false;
    botao.className = `botao ${certo ? 'botao-sucesso' : 'botao-perigo'} botao-largo`;
    botao.focus();
  }

  function semVidas() {
    encerrar();
    const { proximaEmMin } = prog.vidas();
    trocar(corpo, h('div', { class: 'fim' },
      h('div', { class: 'fim-icone' }, '💔'), h('h2', {}, 'Acabaram as vidas'),
      h('p', { class: 'suave' }, `Uma vida volta em ${proximaEmMin} min. Enquanto isso, a revisão não gasta vidas.`)));
    feedback.hidden = true;
    botao.hidden = false; botao.disabled = false; botao.textContent = 'Voltar';
    botao.className = 'botao botao-primario botao-largo';
    botao.onclick = () => cfg.aoSair();
  }

  function terminar() {
    encerrar();
    const pct = avaliados ? Math.round((100 * acertosPrimeira) / avaliados) : 100;
    const minutos = Math.max(1, Math.round((Date.now() - inicio) / 60000));
    const r = cfg.aoTerminar({ acertos: acertosPrimeira, total: avaliados, pct, minutos });
    barra.style.width = '100%';
    trocar(corpo, h('div', { class: 'fim' },
      h('div', { class: 'fim-icone pula' }, pct === 100 ? '💎' : '🎉'),
      h('h2', {}, pct === 100 ? 'Lição perfeita!' : cfg.revisao ? 'Revisão concluída!' : 'Lição concluída!'),
      h('div', { class: 'fim-numeros' },
        h('div', {}, h('b', {}, `+${r.xp}`), h('span', {}, 'XP')),
        h('div', {}, h('b', {}, `${pct}%`), h('span', {}, 'acertos de primeira')),
        h('div', {}, h('b', {}, `${minutos}`), h('span', {}, minutos === 1 ? 'minuto' : 'minutos'))),
      r.conquistas.length ? h('div', { class: 'conquistas-novas' },
        h('span', { class: 'etiqueta' }, 'Conquista nova'),
        r.conquistas.map((c) => h('div', { class: 'conquista' }, h('span', { class: 'conquista-icone' }, c.icone), h('div', {}, h('b', {}, c.nome), h('p', { class: 'suave' }, c.desc))))) : null));
    feedback.hidden = true;
    botao.hidden = false; botao.disabled = false; botao.textContent = 'Continuar';
    botao.className = 'botao botao-primario botao-largo';
    botao.onclick = () => cfg.aoSair();
    botao.focus();
  }
}

export { VIDAS };
