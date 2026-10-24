// =============================================================
// principal.js — ponto de entrada do app: rotas (#/...), barra de
// navegação, tema e voz. Cada tela fica em js/ui/telas.js.
// =============================================================

import { h } from './ui/dom.js';
import * as telas from './ui/telas.js';
import * as prog from './motor/progresso.js';
import * as voz from './motor/voz.js';
import { iniciarPWA } from './pwa.js';
import { vencidos } from './motor/srs.js';

const raiz = document.getElementById('tela');
const perfil = prog.obter().perfil;
telas.aplicarTema(perfil.tema);
voz.configurar({ vozURI: perfil.vozURI, velocidade: perfil.velocidade });
prog.definirResumoExtra(() => ({ unidadesCompletas: telas.unidadesCompletas() }));
iniciarPWA();

const ROTAS = [
  [/^#\/?$/, () => telas.telaInicio(raiz), 'inicio'],
  [/^#\/trilha$/, () => telas.telaTrilha(raiz), 'trilha'],
  [/^#\/licao\/([\w-]+)$/, (m) => telas.telaLicao(raiz, m[1]), null],
  [/^#\/revisao$/, () => telas.telaRevisao(raiz), 'revisao'],
  [/^#\/nivel$/, () => telas.telaNivelamento(raiz), null],
  [/^#\/progresso$/, () => telas.telaEstatisticas(raiz), 'progresso'],
  [/^#\/ajustes$/, () => telas.telaAjustes(raiz), 'ajustes'],
];

const ABAS = [
  ['inicio', '#/', '🏠', 'Início'],
  ['trilha', '#/trilha', '🗺️', 'Trilha'],
  ['revisao', '#/revisao', '🔁', 'Revisar'],
  ['progresso', '#/progresso', '📊', 'Progresso'],
  ['ajustes', '#/ajustes', '⚙️', 'Ajustes'],
];

const nav = h('nav', { class: 'abas', 'aria-label': 'Navegação' });
document.body.append(nav);

function desenharNav(ativa) {
  const pendentes = vencidos(prog.obter().srs).length;
  nav.replaceChildren(...ABAS.map(([id, href, icone, nome]) => h('a', { href, class: 'aba', 'aria-current': id === ativa ? 'page' : null },
    h('span', { class: 'aba-icone' }, icone, id === 'revisao' && pendentes ? h('i', { class: 'bolinha' }, pendentes > 99 ? '99+' : pendentes) : null),
    h('span', {}, nome))));
}

function rotear() {
  document.body.classList.remove('em-sessao');
  voz.parar();
  const hash = location.hash || '#/';
  for (const [re, fn, aba] of ROTAS) {
    const m = hash.match(re);
    if (m) {
      desenharNav(aba);
      raiz.classList.remove('entrando'); void raiz.offsetWidth; raiz.classList.add('entrando');
      fn(m);
      window.scrollTo(0, 0);
      return;
    }
  }
  location.hash = '#/';
}

window.addEventListener('hashchange', rotear);
rotear();
