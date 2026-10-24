// =============================================================
// exercicios.js — desenha cada tipo de exercício.
// Contrato: renderizar(ex, ctx) devolve { el, verificar? }.
//   ctx.podeVerificar(bool)  libera/bloqueia o botão "Verificar"
//   ctx.concluir(nota, info) para exercícios que se corrigem sozinhos
//   verificar() -> { nota: 'certo'|'quase'|'errado', esperado, detalhe? }
// =============================================================

import { h, trocar } from './dom.js';
import { conferir, coberturaPalavras } from '../motor/correcao.js';
import * as voz from '../motor/voz.js';
import { temReconhecimento, ouvir, gravarComparacao } from '../motor/fala.js';
import * as prog from '../motor/progresso.js';

const ICONE_SOM = '🔊';
const ICONE_LENTO = '🐢';

function botaoSom(texto, { grande = false, lento = false } = {}) {
  return h('button', {
    class: `botao-som ${grande ? 'grande' : ''}`, type: 'button',
    'aria-label': lento ? 'Ouvir devagar' : 'Ouvir', onclick: () => voz.falar(texto, { lento }),
  }, lento ? ICONE_LENTO : ICONE_SOM);
}

// ---------- múltipla escolha --------------------------------------
function escolha(ex, ctx) {
  let escolhida = null;
  const opcoes = ex.opcoes.map((op) => h('button', {
    class: 'opcao', type: 'button',
    onclick: (e) => {
      escolhida = op;
      opcoes.forEach((b) => b.setAttribute('aria-pressed', 'false'));
      e.currentTarget.setAttribute('aria-pressed', 'true');
      if (ex.falarOpcoes) voz.falar(op);
      ctx.podeVerificar(true);
    },
  }, op));
  const destaque = ex.destaque && h('div', { class: `destaque ${ex.destaqueIngles || ex.audio ? 'ingles' : 'emoji'}` },
    ex.audio && botaoSom(ex.audio), h('span', {}, ex.destaque));
  if (ex.audio) setTimeout(() => voz.falar(ex.audio), 250);
  return {
    el: h('div', { class: 'ex ex-escolha' }, destaque, h('div', { class: 'opcoes' }, opcoes)),
    verificar: () => ({ nota: escolhida === ex.certa ? 'certo' : 'errado', esperado: ex.certa }),
  };
}

// ---------- montar a frase ----------------------------------------
function montar(ex, ctx) {
  const resposta = h('div', { class: 'linha-resposta', 'aria-label': 'Sua resposta' });
  const banco = h('div', { class: 'banco' });
  const fichas = ex.fichas.map((t) => {
    const b = h('button', { class: 'ficha', type: 'button' }, t);
    b.onclick = () => {
      (b.parentElement === banco ? resposta : banco).append(b);
      if (ex.idioma === 'en' && b.parentElement === resposta) voz.falar(t);
      ctx.podeVerificar(resposta.children.length > 0);
    };
    return b;
  });
  banco.append(...fichas);
  return {
    el: h('div', { class: 'ex ex-montar' },
      h('div', { class: 'origem' }, ex.audioOrigem && botaoSom(ex.audioOrigem), h('span', {}, ex.origem)),
      resposta, banco),
    verificar: () => {
      const texto = [...resposta.children].map((b) => b.textContent).join(' ');
      const r = conferir(texto, ex.respostas);
      return { nota: r.resultado === 'quase' ? 'errado' : r.resultado, esperado: ex.respostas[0] };
    },
  };
}

// ---------- completar lacuna --------------------------------------
function lacuna(ex, ctx) {
  let escolhida = null;
  const vaga = h('span', { class: 'vaga' }, '____');
  const opcoes = ex.opcoes.map((op) => h('button', {
    class: 'ficha', type: 'button',
    onclick: (e) => {
      escolhida = op;
      vaga.textContent = op;
      vaga.classList.add('preenchida');
      opcoes.forEach((b) => b.setAttribute('aria-pressed', 'false'));
      e.currentTarget.setAttribute('aria-pressed', 'true');
      ctx.podeVerificar(true);
    },
  }, op));
  return {
    el: h('div', { class: 'ex ex-lacuna' },
      h('p', { class: 'frase-lacuna' }, ex.antes ? ex.antes + ' ' : '', vaga, ex.depois),
      h('p', { class: 'suave traducao' }, ex.traducao),
      h('div', { class: 'banco' }, opcoes)),
    verificar: () => ({ nota: escolhida?.toLowerCase() === ex.certa.toLowerCase() ? 'certo' : 'errado', esperado: `${ex.antes} ${ex.certa}${ex.depois}`.trim() }),
  };
}

// ---------- digitar (ditado e tradução) ---------------------------
function campoTexto(ctx, placeholder) {
  const t = h('textarea', {
    class: 'campo', rows: 3, placeholder, autocapitalize: 'sentences', autocomplete: 'off', spellcheck: 'false', lang: 'en',
    oninput: () => ctx.podeVerificar(t.value.trim().length > 0),
    onkeydown: (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ctx.enter?.(); } },
  });
  setTimeout(() => t.focus({ preventScroll: true }), 300);
  return t;
}

function ditado(ex, ctx) {
  const t = campoTexto(ctx, 'Escreva em inglês o que ouviu');
  setTimeout(() => voz.falar(ex.audio), 250);
  return {
    el: h('div', { class: 'ex ex-ditado' },
      h('div', { class: 'sons' }, botaoSom(ex.audio, { grande: true }), botaoSom(ex.audio, { lento: true })), t),
    verificar: () => {
      const r = conferir(t.value, ex.respostas);
      return { nota: r.resultado, esperado: r.esperado, detalhe: ex.traducao };
    },
  };
}

function traduzir(ex, ctx) {
  const t = campoTexto(ctx, 'Escreva em inglês');
  return {
    el: h('div', { class: 'ex ex-traduzir' }, h('div', { class: 'origem' }, h('span', {}, ex.origem)), t),
    verificar: () => {
      const r = conferir(t.value, ex.respostas);
      return { nota: r.resultado, esperado: r.esperado };
    },
  };
}

// ---------- pares --------------------------------------------------
function pares(ex, ctx) {
  const embaralhar = (a) => [...a].sort(() => Math.random() - 0.5);
  let selEn = null, selPt = null, erros = 0, feitos = 0;
  const tentar = () => {
    if (!selEn || !selPt) return;
    const [a, b] = [selEn, selPt];
    selEn = selPt = null;
    if (a.dataset.par === b.dataset.par) {
      [a, b].forEach((x) => { x.classList.add('casou'); x.disabled = true; x.setAttribute('aria-pressed', 'false'); });
      if (++feitos === ex.itens.length) setTimeout(() => ctx.concluir(erros === 0 ? 'certo' : erros <= 1 ? 'quase' : 'errado', { erros }), 350);
    } else {
      erros++;
      [a, b].forEach((x) => { x.classList.add('errou'); x.setAttribute('aria-pressed', 'false'); setTimeout(() => x.classList.remove('errou'), 450); });
    }
  };
  const col = (lado) => embaralhar(ex.itens).map((it) => {
    const b = h('button', { class: 'par', type: 'button', dataset: { par: it.en } },
      lado === 'en' ? it.en : h('span', {}, h('span', { class: 'emoji' }, it.emoji), ' ', it.pt));
    b.onclick = () => {
      b.parentElement.querySelectorAll('.par').forEach((x) => x.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true');
      if (lado === 'en') { selEn = b; voz.falar(it.en); } else selPt = b;
      tentar();
    };
    return b;
  });
  return { el: h('div', { class: 'ex ex-pares' }, h('div', { class: 'coluna' }, col('en')), h('div', { class: 'coluna' }, col('pt'))) };
}

// ---------- ouvir e repetir ---------------------------------------
function falar(ex, ctx) {
  let resultado = null, melhor = 0, tentativas = 0;
  const status = h('p', { class: 'status-fala', 'aria-live': 'polite' });
  const area = h('div', { class: 'acoes-fala' });
  const pular = h('button', { class: 'link', type: 'button', onclick: () => { prog.pularFala(15); ctx.concluir('pulado'); } }, 'Não posso falar agora (pausa a fala por 15 min)');

  if (temReconhecimento()) {
    const mic = h('button', { class: 'botao-mic', type: 'button', 'aria-label': 'Falar' }, '🎙️');
    mic.onclick = async () => {
      mic.disabled = true; mic.classList.add('ouvindo'); voz.parar();
      status.textContent = 'Ouvindo… fale a frase.';
      try {
        const alts = await ouvir();
        tentativas++;
        const pct = Math.max(0, ...alts.map((a) => coberturaPalavras(a.texto, ex.alvo)));
        const ouvido = alts[0]?.texto || '';
        if (pct >= melhor) melhor = pct;
        status.textContent = ouvido ? `Entendi: "${ouvido}" (${Math.round(pct * 100)}% das palavras)` : 'Não captei nada. Tente de novo, mais perto do microfone.';
        resultado = { nota: melhor >= 0.85 ? 'certo' : melhor >= 0.6 ? 'quase' : 'errado', esperado: ex.alvo, detalhe: ouvido ? `Entendido: "${ouvido}"` : '' };
        ctx.podeVerificar(tentativas > 0);
      } catch (e) {
        status.textContent = e.message === 'not-allowed' ? 'Microfone bloqueado. Libere nas permissões do navegador.' : `Não consegui ouvir (${e.message}). Tente de novo.`;
      } finally { mic.disabled = false; mic.classList.remove('ouvindo'); }
    };
    area.append(mic);
    status.textContent = 'Toque no microfone e leia a frase. O app confere se as palavras foram entendidas.';
  } else {
    // Sem reconhecimento (offline): grava e compara de ouvido.
    const mic = h('button', { class: 'botao-mic', type: 'button', 'aria-label': 'Gravar' }, '🎙️');
    const avaliar = h('div', { class: 'autoavaliacao', hidden: true },
      h('button', { class: 'botao botao-secundario', type: 'button', onclick: () => fim('errado') }, 'Ainda não'),
      h('button', { class: 'botao botao-primario', type: 'button', onclick: () => fim('certo') }, 'Soou parecido'));
    const fim = (nota) => { resultado = { nota, esperado: ex.alvo, detalhe: 'Autoavaliação' }; ctx.podeVerificar(true); ctx.enter?.(); };
    let gravando = null;
    mic.onclick = async () => {
      if (gravando) return gravando.parar();
      voz.parar();
      try {
        mic.classList.add('ouvindo'); status.textContent = 'Gravando… toque de novo para parar.';
        gravando = await gravarComparacao();
        const { blob } = await gravando.concluido;
        gravando = null; mic.classList.remove('ouvindo');
        const url = URL.createObjectURL(blob);
        trocar(status, 'Compare: ',
          h('button', { class: 'botao-som', type: 'button', onclick: () => new Audio(url).play() }, '▶ Você'), ' ',
          h('button', { class: 'botao-som', type: 'button', onclick: () => voz.falar(ex.alvo) }, '▶ Modelo'));
        avaliar.hidden = false;
      } catch (e) {
        gravando = null; mic.classList.remove('ouvindo');
        status.textContent = `Não consegui gravar: ${e.message}`;
      }
    };
    area.append(mic);
    status.textContent = 'Sem internet: grave sua voz e compare com a voz modelo.';
    area.append(avaliar);
  }

  setTimeout(() => voz.falar(ex.alvo), 250);
  return {
    el: h('div', { class: 'ex ex-falar' },
      h('div', { class: 'destaque ingles' }, botaoSom(ex.alvo), h('span', {}, ex.alvo)),
      h('p', { class: 'suave traducao' }, ex.traducao), area, status, pular),
    verificar: () => resultado || { nota: 'errado', esperado: ex.alvo },
  };
}

const RENDERIZADORES = { escolha, montar, lacuna, ditado, traduzir, pares, falar };

export function renderizar(ex, ctx) {
  const fn = RENDERIZADORES[ex.tipo];
  if (!fn) throw new Error(`Tipo de exercício desconhecido: ${ex.tipo}`);
  return fn(ex, ctx);
}

/** Exercícios que se corrigem sozinhos (não usam o botão Verificar). */
export const autoCorrigido = (ex) => ex.tipo === 'pares';
