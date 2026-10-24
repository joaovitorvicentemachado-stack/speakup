// =============================================================
// dom.js — utilidades pequenas de interface (sem framework).
// h('button', {class:'x', onclick}, 'texto') cria elementos.
// =============================================================

export function h(tag, props = {}, ...filhos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'html') el.innerHTML = v;            // só para conteúdo nosso (SVG fixo)
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const f of filhos.flat(Infinity)) {
    if (f == null || f === false) continue;
    el.append(f instanceof Node ? f : document.createTextNode(String(f)));
  }
  return el;
}

/** Troca o conteúdo de um elemento, ignorando null/false (replaceChildren escreveria "null"). */
export function trocar(el, ...filhos) {
  el.replaceChildren(...filhos.flat(Infinity).filter((f) => f != null && f !== false));
}

/** Aviso rápido no topo da tela. */
export function aviso(texto, tipo = 'info', ms = 2600) {
  let caixa = document.getElementById('avisos');
  if (!caixa) { caixa = h('div', { id: 'avisos', 'aria-live': 'polite' }); document.body.append(caixa); }
  const el = h('div', { class: `aviso aviso-${tipo}` }, texto);
  caixa.append(el);
  setTimeout(() => { el.classList.add('saindo'); setTimeout(() => el.remove(), 300); }, ms);
}

/** Diálogo de confirmação feito na própria página (sem confirm()). */
export function confirmar({ titulo, texto, sim = 'Confirmar', nao = 'Cancelar', perigo = false }) {
  return new Promise((ok) => {
    const fechar = (v) => { fundo.remove(); ok(v); };
    const fundo = h('div', { class: 'modal-fundo', onclick: (e) => e.target === fundo && fechar(false) },
      h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': titulo },
        h('h2', {}, titulo), texto && h('p', { class: 'suave' }, texto),
        h('div', { class: 'modal-botoes' },
          h('button', { class: 'botao botao-secundario', onclick: () => fechar(false) }, nao),
          h('button', { class: `botao ${perigo ? 'botao-perigo' : 'botao-primario'}`, onclick: () => fechar(true) }, sim))));
    document.body.append(fundo);
    fundo.querySelector('.botao-primario, .botao-perigo').focus();
  });
}

/** Anel de progresso em SVG (meta diária). */
export function anel(valor, total, tamanho = 120) {
  const r = tamanho / 2 - 9, circ = 2 * Math.PI * r;
  const p = Math.min(1, total ? valor / total : 0);
  return h('div', {
    class: 'anel', style: { width: tamanho + 'px', height: tamanho + 'px' },
    html: `<svg viewBox="0 0 ${tamanho} ${tamanho}" width="${tamanho}" height="${tamanho}" aria-hidden="true">
      <circle cx="${tamanho / 2}" cy="${tamanho / 2}" r="${r}" fill="none" stroke="var(--linha)" stroke-width="12"/>
      <circle cx="${tamanho / 2}" cy="${tamanho / 2}" r="${r}" fill="none" stroke="var(--xp)" stroke-width="12" stroke-linecap="round"
        stroke-dasharray="${circ}" stroke-dashoffset="${circ * (1 - p)}" transform="rotate(-90 ${tamanho / 2} ${tamanho / 2})" class="anel-progresso"/>
    </svg>`,
  });
}

export const reduzirMovimento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
