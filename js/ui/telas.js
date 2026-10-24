// =============================================================
// telas.js — telas principais: início, trilha, nivelamento,
// revisão, estatísticas e ajustes.
// =============================================================

import { h, trocar, aviso, confirmar, anel } from './dom.js';
import { iniciarSessao } from './sessao.js';
import * as prog from '../motor/progresso.js';
import * as voz from '../motor/voz.js';
import { gerarLicao, gerarRevisao, indexar } from '../motor/gerador.js';
import { vencidos, aprendido } from '../motor/srs.js';
import { nivelDoXP, METAS, CONQUISTAS } from '../motor/gamificacao.js';
import { hoje, somarDias } from '../motor/datas.js';
import { UNIDADES, todasLicoes, acharLicao } from '../dados/curriculo.js';
import { BLOCOS, calcularNivel, UNIDADE_INICIAL } from '../dados/nivelamento.js';

const ir = (rota) => { location.hash = rota; };
const indice = indexar(UNIDADES);

// ---------- regras da trilha ---------------------------------------
function indiceUnidadeInicial() {
  const id = UNIDADE_INICIAL[prog.obter().perfil.nivel] || 'u1';
  return UNIDADES.findIndex((u) => u.id === id);
}

/** Uma lição está aberta se: a unidade foi liberada pelo nivelamento, é a 1ª da unidade inicial,
 *  a anterior foi concluída, ou ela mesma já foi feita. */
export function licaoAberta(licaoId) {
  const lista = todasLicoes();
  const i = lista.findIndex((l) => l.id === licaoId);
  const l = lista[i];
  const est = prog.obter().licoes;
  if (est[licaoId]?.concluida) return true;
  const ui = UNIDADES.indexOf(l.unidade);
  const inicial = indiceUnidadeInicial();
  if (ui < inicial) return true;
  if (ui === inicial && l.unidade.licoes[0].id === licaoId) return true;
  return i > 0 && !!est[lista[i - 1].id]?.concluida;
}

/** Próxima lição a fazer ("Continuar de onde parei"). */
export function proximaLicao() {
  const est = prog.obter().licoes;
  const lista = todasLicoes();
  const inicial = indiceUnidadeInicial();
  return lista.find((l) => UNIDADES.indexOf(l.unidade) >= inicial && !est[l.id]?.concluida && licaoAberta(l.id))
    || lista.find((l) => !est[l.id]?.concluida && licaoAberta(l.id))
    || lista[lista.length - 1];
}

export function unidadesCompletas() {
  const est = prog.obter().licoes;
  return UNIDADES.filter((u) => u.licoes.every((l) => est[l.id]?.concluida)).length;
}

// ---------- cabeçalho de status (sequência, XP, vidas) --------------
function chips() {
  const e = prog.obter();
  const seq = prog.sequenciaAtual();
  return h('div', { class: 'chips' },
    h('span', { class: `chip-status fogo ${seq ? '' : 'apagado'}`, title: 'Sequência de dias' }, '🔥 ', h('b', {}, seq)),
    h('span', { class: 'chip-status xp', title: 'XP total' }, '⭐ ', h('b', {}, e.xp)),
    e.perfil.vidasAtivas ? h('span', { class: 'chip-status vida', title: 'Vidas' }, '❤️ ', h('b', {}, prog.vidas().qtd)) : null);
}

// ---------- INÍCIO --------------------------------------------------
export function telaInicio(raiz) {
  const e = prog.obter();
  const meta = e.perfil.meta;
  const xpDia = prog.xpHoje();
  const prox = proximaLicao();
  const pendentes = vencidos(e.srs).length;
  const nv = nivelDoXP(e.xp);
  const metaBatida = xpDia >= meta;

  // Últimos 7 dias
  const semana = Array.from({ length: 7 }, (_, i) => somarDias(hoje(), i - 6)).map((d) => {
    const xp = e.dias[d]?.xp || 0;
    const nome = new Date(d + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'narrow' });
    return h('div', { class: `dia ${xp ? 'feito' : ''} ${d === hoje() ? 'hoje' : ''}`, title: `${d}: ${xp} XP` }, h('i', {}), h('span', {}, nome));
  });

  trocar(raiz, 
    h('header', { class: 'topo-tela' }, h('div', {}, h('p', { class: 'sobretitulo' }, saudacao()), h('h1', {}, 'Seu inglês hoje')), chips()),
    h('section', { class: 'cartao meta-dia' },
      h('div', { class: 'meta-anel' }, anel(xpDia, meta, 132), h('div', { class: 'meta-numero' }, h('b', {}, xpDia), h('span', {}, `de ${meta} XP`))),
      h('div', { class: 'meta-texto' },
        h('h2', {}, metaBatida ? 'Meta do dia batida!' : 'Meta diária'),
        h('p', { class: 'suave' }, metaBatida ? 'Tudo o que vier agora é bônus.' : `Faltam ${meta - xpDia} XP. Uma lição vale 10 a 15 XP.`),
        h('div', { class: 'semana' }, semana))),
    h('button', { class: 'botao botao-primario botao-gigante', type: 'button', onclick: () => ir(`#/licao/${prox.id}`) },
      h('span', { class: 'gigante-rotulo' }, 'Continuar de onde parei'),
      h('span', { class: 'gigante-sub' }, `${prox.unidade.icone} ${prox.unidade.titulo} · ${prox.titulo}`)),
    pendentes ? h('button', { class: 'botao botao-secundario botao-largo', type: 'button', onclick: () => ir('#/revisao') },
      `🔁 Revisar ${pendentes} ${pendentes === 1 ? 'item' : 'itens'} (repetição espaçada)`) : null,
    !e.perfil.nivel ? h('section', { class: 'cartao convite' },
      h('div', {}, h('h2', {}, 'Descubra seu nível'), h('p', { class: 'suave' }, '15 perguntas, uns 3 minutos. O app pula o que você já sabe.')),
      h('button', { class: 'botao botao-secundario', type: 'button', onclick: () => ir('#/nivel') }, 'Fazer teste')) : null,
    h('section', { class: 'cartao nivel-jogador' },
      h('div', { class: 'nivel-selo' }, nv.nivel),
      h('div', { class: 'nivel-info' },
        h('div', {}, h('b', {}, `Nível ${nv.nivel}`), h('span', { class: 'suave' }, ` · faltam ${nv.paraProximo - nv.noNivel} XP para o próximo`)),
        h('div', { class: 'barra-fina' }, h('i', { style: { width: `${(100 * nv.noNivel) / nv.paraProximo}%` } })))),
  );
}

function saudacao() {
  const hr = new Date().getHours();
  return hr < 12 ? 'Bom dia' : hr < 18 ? 'Boa tarde' : 'Boa noite';
}

// ---------- TRILHA -------------------------------------------------
export function telaTrilha(raiz) {
  const est = prog.obter().licoes;
  const prox = proximaLicao();
  trocar(raiz, 
    h('header', { class: 'topo-tela' }, h('div', {}, h('p', { class: 'sobretitulo' }, `${todasLicoes().filter((l) => est[l.id]?.concluida).length} de ${todasLicoes().length} lições`), h('h1', {}, 'Trilha')), chips()),
    ...UNIDADES.map((u, ui) => h('section', { class: `unidade cor-${u.cor}` },
      h('div', { class: 'unidade-topo' },
        h('span', { class: 'unidade-icone' }, u.icone),
        h('div', {}, h('p', { class: 'sobretitulo' }, `Unidade ${ui + 1} · ${u.nivel}`), h('h2', {}, u.titulo)),
        h('span', { class: 'unidade-conta' }, `${u.licoes.filter((l) => est[l.id]?.concluida).length}/${u.licoes.length}`)),
      h('ol', { class: 'caminho' }, u.licoes.map((l, i) => {
        const aberta = licaoAberta(l.id);
        const feita = est[l.id]?.concluida;
        const atual = l.id === prox.id;
        return h('li', { class: `no ${feita ? 'feito' : ''} ${atual ? 'atual' : ''} ${aberta ? '' : 'trancado'}`, style: { '--desvio': ['0', '1', '1.6', '1', '0', '-1', '-1.6', '-1', '0'][i % 9] } },
          h('button', {
            type: 'button', 'aria-label': `${l.titulo}${feita ? ', concluída' : aberta ? '' : ', bloqueada'}`,
            onclick: () => (aberta ? ir(`#/licao/${l.id}`) : aviso('Conclua a lição anterior primeiro.')),
          }, feita ? '✓' : aberta ? String(i + 1) : '🔒'),
          h('span', { class: 'no-nome' }, l.titulo, feita && est[l.id].melhor === 100 ? ' 💎' : ''));
      }))),
    ));
  raiz.querySelector('.no.atual')?.scrollIntoView({ block: 'center' });
}

// ---------- LIÇÃO ----------------------------------------------------
export function telaLicao(raiz, id) {
  const l = acharLicao(id);
  if (!l) return ir('#/trilha');
  if (!licaoAberta(id)) { aviso('Essa lição ainda está bloqueada.'); return ir('#/trilha'); }
  const e = prog.obter();
  const exercicios = gerarLicao(l, l.unidade, { falar: e.perfil.falarAtivo && !prog.falaPausada() });
  iniciarSessao(raiz, {
    titulo: l.titulo, dica: l.dica, exercicios,
    aoTerminar: (r) => prog.concluirLicao(id, r),
    aoSair: () => ir('#/'),
  });
}

// ---------- REVISÃO ---------------------------------------------------
export function telaRevisao(raiz) {
  const e = prog.obter();
  const lista = vencidos(e.srs);
  if (!lista.length) {
    const proximos = Object.values(e.srs).map((c) => c.vence).sort()[0];
    trocar(raiz, 
      h('header', { class: 'topo-tela' }, h('div', {}, h('h1', {}, 'Revisar')), chips()),
      h('section', { class: 'cartao vazio' },
        h('div', { class: 'fim-icone' }, '🧠'),
        h('h2', {}, 'Nada para revisar agora'),
        h('p', { class: 'suave' }, proximos ? `A próxima revisão vence em ${new Date(proximos + 'T12:00').toLocaleDateString('pt-BR')}. A repetição espaçada traz cada item de volta pouco antes de você esquecer.`
          : 'Faça lições: cada palavra e frase vira um cartão que volta para revisão no momento certo.'),
        h('button', { class: 'botao botao-primario', type: 'button', onclick: () => ir(`#/licao/${proximaLicao().id}`) }, 'Fazer uma lição')));
    return;
  }
  const exercicios = gerarRevisao(lista, indice, { falar: e.perfil.falarAtivo && !prog.falaPausada() });
  iniciarSessao(raiz, {
    titulo: 'Revisão', revisao: true, exercicios,
    aoTerminar: () => prog.concluirRevisao(exercicios.length),
    aoSair: () => ir('#/'),
  });
}

// ---------- NIVELAMENTO ------------------------------------------------
export function telaNivelamento(raiz) {
  const acertos = [0, 0, 0];
  let bloco = 0, q = 0;
  const embaralhar = (a) => [...a].sort(() => Math.random() - 0.5);
  document.body.classList.add('em-sessao');
  const sair = () => { document.body.classList.remove('em-sessao'); voz.parar(); ir('#/'); };

  function desenhar() {
    const b = BLOCOS[bloco];
    if (!b) return terminar();
    const questao = b.questoes[q];
    const n = bloco * 5 + q + 1;
    const opcoes = embaralhar(questao.op.map((t, i) => ({ t, certo: i === questao.c })));
    trocar(raiz, h('div', { class: 'sessao' },
      h('div', { class: 'sessao-topo' },
        h('button', { class: 'fechar', type: 'button', 'aria-label': 'Sair do teste', onclick: sair }, '✕'),
        h('div', { class: 'progresso-sessao' }, h('i', { style: { width: `${(100 * (n - 1)) / 15}%` } })),
        h('span', { class: 'etiqueta' }, b.nivel)),
      h('div', { class: 'sessao-corpo' },
        h('div', { class: 'ex-cabecalho' }, h('p', { class: 'sobretitulo' }, `Pergunta ${n} de 15`), h('h2', {}, questao.p)),
        questao.audio ? h('div', { class: 'sons' },
          h('button', { class: 'botao-som grande', type: 'button', onclick: () => voz.falar(questao.audio) }, '🔊'),
          h('button', { class: 'botao-som', type: 'button', onclick: () => voz.falar(questao.audio, { lento: true }) }, '🐢')) : null,
        h('div', { class: 'opcoes' },
          opcoes.map((o) => h('button', { class: 'opcao', type: 'button', onclick: () => responder(o.certo) }, o.t)),
          h('button', { class: 'opcao opcao-nao-sei', type: 'button', onclick: () => responder(false) }, 'Não sei')))));
    if (questao.audio) setTimeout(() => voz.falar(questao.audio), 300);
  }

  function responder(certo) {
    if (certo) acertos[bloco]++;
    q++;
    if (q >= 5) {
      // Parou de passar? Não faz sentido seguir para o nível de cima.
      if (acertos[bloco] < 4) return terminar();
      bloco++; q = 0;
    }
    desenhar();
  }

  function terminar() {
    const nivel = calcularNivel(acertos);
    const r = prog.concluirNivelamento(nivel);
    const unidade = UNIDADES.find((u) => u.id === UNIDADE_INICIAL[nivel]);
    trocar(raiz, h('div', { class: 'sessao' }, h('div', { class: 'sessao-corpo' }, h('div', { class: 'fim' },
      h('div', { class: 'fim-icone pula' }, '🧭'),
      h('p', { class: 'sobretitulo' }, 'Seu nível estimado'),
      h('h2', { class: 'nivel-grande' }, nivel === 'Iniciante' ? 'Iniciante (pré-A1)' : nivel),
      h('p', { class: 'suave' }, `Acertos: A1 ${acertos[0]}/5 · A2 ${acertos[1]}/5 · B1 ${acertos[2]}/5. Sua trilha começa em "${unidade.titulo}". As unidades anteriores continuam abertas para revisar.`),
      r.conquistas.length ? h('p', {}, `Conquista: ${r.conquistas.map((c) => c.icone + ' ' + c.nome).join(', ')}`) : null)),
      h('div', { class: 'sessao-rodape' }, h('button', { class: 'botao botao-primario botao-largo', type: 'button', onclick: () => ir('#/') }, 'Começar'))));
  }
  desenhar();
}

// ---------- ESTATÍSTICAS ---------------------------------------------
const NOMES_CAT = { vocabulario: 'Vocabulário', gramatica: 'Gramática', escuta: 'Escuta', pronuncia: 'Pronúncia (fala)' };

export function telaEstatisticas(raiz) {
  const e = prog.obter();
  const cartoes = Object.values(e.srs);
  const fracos = cartoes.filter((c) => c.erros > 0).sort((a, b) => b.erros - a.erros || b.lapsos - a.lapsos).slice(0, 10);
  const dias = Array.from({ length: 35 }, (_, i) => somarDias(hoje(), i - 34));
  const diasEstudados = dias.filter((d) => e.dias[d]?.xp).length;
  const maxXP = Math.max(1, ...dias.map((d) => e.dias[d]?.xp || 0));

  trocar(raiz, 
    h('header', { class: 'topo-tela' }, h('div', {}, h('h1', {}, 'Progresso')), chips()),
    h('section', { class: 'cartao numeros' },
      h('div', {}, h('b', {}, e.xp), h('span', {}, 'XP total')),
      h('div', {}, h('b', {}, e.sequencia.recorde), h('span', {}, 'maior sequência')),
      h('div', {}, h('b', {}, Object.values(e.licoes).filter((l) => l.concluida).length), h('span', {}, 'lições feitas')),
      h('div', {}, h('b', {}, cartoes.filter(aprendido).length), h('span', {}, 'itens firmes'))),

    h('section', { class: 'cartao' },
      h('h2', {}, 'Erros por tipo'),
      h('p', { class: 'suave pequeno' }, 'Taxa de erro em cada habilidade (quanto maior a barra, mais atenção precisa).'),
      h('div', { class: 'barras' }, Object.entries(NOMES_CAT).map(([k, nome]) => {
        const s = e.estatisticas[k];
        const tot = s.acertos + s.erros;
        const taxa = tot ? s.erros / tot : 0;
        return h('div', { class: 'barra-linha' },
          h('span', { class: 'barra-nome' }, nome),
          h('div', { class: 'barra-trilho' }, h('i', { class: taxa > 0.3 ? 'alta' : taxa > 0.15 ? 'media' : 'baixa', style: { width: `${Math.max(2, taxa * 100)}%` } })),
          h('span', { class: 'barra-valor' }, tot ? `${Math.round(taxa * 100)}% de ${tot}` : '–'));
      }))),

    h('section', { class: 'cartao' },
      h('h2', {}, 'Palavras e frases fracas'),
      fracos.length ? h('ul', { class: 'lista-fracos' }, fracos.map((c) => {
        const it = indice.get(c.id);
        if (!it) return null;
        return h('li', {},
          h('button', { class: 'botao-som', type: 'button', onclick: () => voz.falar(it.en), 'aria-label': `Ouvir ${it.en}` }, '🔊'),
          h('div', {}, h('b', {}, it.en), h('span', { class: 'suave' }, ` · ${it.pt}`)),
          h('span', { class: 'erros-conta' }, `${c.erros}× erro`));
      })) : h('p', { class: 'suave' }, 'Ainda sem erros registrados. Eles aparecem aqui conforme você estuda.')),

    h('section', { class: 'cartao' },
      h('h2', {}, 'Frequência de estudo'),
      h('p', { class: 'suave pequeno' }, `${diasEstudados} dias estudados nas últimas 5 semanas.`),
      h('div', { class: 'calendario' }, dias.map((d) => {
        const xp = e.dias[d]?.xp || 0;
        const nivel = xp === 0 ? 0 : Math.ceil((xp / maxXP) * 4);
        return h('i', { class: `n${nivel} ${d === hoje() ? 'hoje' : ''}`, title: `${new Date(d + 'T12:00').toLocaleDateString('pt-BR')}: ${xp} XP` });
      }))),

    h('section', { class: 'cartao' },
      h('h2', {}, 'Conquistas'),
      h('div', { class: 'grade-conquistas' }, CONQUISTAS.map((c) => {
        const tem = e.conquistas[c.id];
        return h('div', { class: `conquista ${tem ? '' : 'bloqueada'}` },
          h('span', { class: 'conquista-icone' }, tem ? c.icone : '🔒'),
          h('div', {}, h('b', {}, c.nome), h('p', { class: 'suave' }, tem ? `${c.desc} · ${new Date(tem + 'T12:00').toLocaleDateString('pt-BR')}` : c.desc)));
      }))));
}

// ---------- AJUSTES -------------------------------------------------------
export function telaAjustes(raiz) {
  const e = prog.obter();
  const p = e.perfil;
  const linha = (rotulo, desc, controle) => h('div', { class: 'ajuste' }, h('div', {}, h('b', {}, rotulo), desc && h('p', { class: 'suave pequeno' }, desc)), controle);
  const interruptor = (id, valor, aoMudar) => h('input', { type: 'checkbox', role: 'switch', id, class: 'interruptor', checked: valor, onchange: (ev) => aoMudar(ev.target.checked) });

  const selMeta = h('select', { id: 'aj-meta', onchange: (ev) => prog.atualizarPerfil({ meta: +ev.target.value }) },
    METAS.map((m) => h('option', { value: m.xp, selected: m.xp === p.meta }, `${m.nome} · ${m.xp} XP/dia`)));

  const vozes = voz.listarVozes();
  const selVoz = h('select', { id: 'aj-voz', onchange: (ev) => { prog.atualizarPerfil({ vozURI: ev.target.value }); voz.configurar({ vozURI: ev.target.value }); voz.falar('Hello! This is my voice.'); } },
    vozes.length ? vozes.map((v) => h('option', { value: v.voiceURI, selected: v.voiceURI === p.vozURI }, `${v.name} (${v.lang})${v.localService ? '' : ' · online'}`))
      : h('option', {}, 'Nenhuma voz em inglês encontrada'));
  const selVel = h('select', { id: 'aj-vel', onchange: (ev) => { prog.atualizarPerfil({ velocidade: +ev.target.value }); voz.configurar({ velocidade: +ev.target.value }); voz.falar('This is the new speed.'); } },
    [[0.75, 'Devagar'], [0.95, 'Normal'], [1.1, 'Rápida']].map(([v, n]) => h('option', { value: v, selected: v === p.velocidade }, n)));
  const selTema = h('select', { id: 'aj-tema', onchange: (ev) => { prog.atualizarPerfil({ tema: ev.target.value }); aplicarTema(ev.target.value); } },
    [['sistema', 'Igual ao aparelho'], ['claro', 'Claro'], ['escuro', 'Escuro']].map(([v, n]) => h('option', { value: v, selected: v === p.tema }, n)));

  const arquivo = h('input', { type: 'file', accept: 'application/json,.json', id: 'aj-importar', hidden: true, onchange: importar });

  async function importar() {
    const f = arquivo.files[0];
    if (!f) return;
    if (!await confirmar({ titulo: 'Substituir o progresso deste aparelho?', texto: `O progresso atual (${prog.obter().xp} XP) será trocado pelo do arquivo. Dá para desfazer logo depois.`, sim: 'Substituir' })) return (arquivo.value = '');
    try {
      const r = prog.importar(await f.text());
      aviso(`Progresso importado: ${r.xp} XP (exportado em ${new Date(r.exportadoEm).toLocaleString('pt-BR')}).`, 'ok', 4000);
      telaAjustes(raiz);
    } catch (err) { aviso(err.message, 'erro', 5000); }
    arquivo.value = '';
  }

  function exportar() {
    const blob = new Blob([prog.exportar()], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `ingles-progresso-${hoje()}.json` });
    document.body.append(a); a.click(); a.remove();
    aviso('Arquivo salvo. Envie para o outro aparelho (Drive, WhatsApp, e-mail) e importe lá.', 'ok', 4500);
  }

  trocar(raiz, 
    h('header', { class: 'topo-tela' }, h('div', {}, h('h1', {}, 'Ajustes'))),
    h('section', { class: 'cartao lista-ajustes' },
      h('h2', {}, 'Estudo'),
      linha('Meta diária', 'Quanto XP você quer fazer por dia.', selMeta),
      linha('Vidas', 'Cada erro em lição gasta uma vida; volta 1 a cada 30 min.', interruptor('aj-vidas', p.vidasAtivas, (v) => prog.atualizarPerfil({ vidasAtivas: v }))),
      linha('Exercícios de fala', 'Desligue se estiver em lugar onde não pode falar.', interruptor('aj-fala', p.falarAtivo, (v) => prog.atualizarPerfil({ falarAtivo: v }))),
      linha('Refazer teste de nível', p.nivel ? `Nível atual: ${p.nivel}` : 'Ainda não feito.', h('button', { class: 'botao botao-secundario', type: 'button', onclick: () => ir('#/nivel') }, 'Fazer'))),
    h('section', { class: 'cartao lista-ajustes' },
      h('h2', {}, 'Voz e aparência'),
      linha('Voz em inglês', 'Vozes "online" precisam de internet.', selVoz),
      linha('Velocidade da voz', null, selVel),
      linha('Tema', null, selTema)),
    h('section', { class: 'cartao lista-ajustes' },
      h('h2', {}, 'Sincronizar PC e celular'),
      h('p', { class: 'suave pequeno' }, 'O progresso fica só neste aparelho. Para levar ao outro: Exportar aqui, mandar o arquivo para lá e Importar.'),
      h('div', { class: 'linha-botoes' },
        h('button', { class: 'botao botao-primario', type: 'button', onclick: exportar }, 'Exportar progresso'),
        h('button', { class: 'botao botao-secundario', type: 'button', onclick: () => arquivo.click() }, 'Importar progresso'), arquivo),
      prog.temBackup() ? h('button', { class: 'link', type: 'button', onclick: () => { prog.desfazerImportacao(); aviso('Progresso anterior restaurado.', 'ok'); telaAjustes(raiz); } }, 'Desfazer última importação/apagamento') : null),
    h('section', { class: 'cartao lista-ajustes' },
      h('h2', {}, 'Ferramentas'),
      h('a', { class: 'botao botao-secundario', href: 'laboratorio.html' }, '🔬 Laboratório de pronúncia (Etapa 1)'),
      h('button', { class: 'link perigo', type: 'button', onclick: async () => {
        if (await confirmar({ titulo: 'Apagar todo o progresso?', texto: 'XP, lições, revisões e estatísticas voltam a zero. Dá para desfazer logo depois.', sim: 'Apagar', perigo: true })) { prog.apagarTudo(); aviso('Progresso apagado.'); telaAjustes(raiz); }
      } }, 'Apagar todo o progresso')),
  );
}

export function aplicarTema(tema) {
  if (tema === 'sistema') document.documentElement.removeAttribute('data-tema');
  else document.documentElement.setAttribute('data-tema', tema);
}
