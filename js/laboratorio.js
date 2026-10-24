// =============================================================
// app.js — liga a interface aos módulos. Não contém lógica de áudio,
// de modelo nem de comparação: só orquestra.
// =============================================================

import { iniciarPWA } from './pwa.js';
import * as diag from './diagnostico.js';
import { Gravador, blobPara16k, cortarSilencio, temVoz } from './audio.js';
import { MOTORES, criarReconhecedor } from './fonemas.js';
import { analisarShipSheep, resumir, PALAVRAS } from './comparar.js';
import * as arm from './armazenamento.js';

const $ = (id) => document.getElementById(id);
const estadoPWA = iniciarPWA();

// ---------- ETAPA 0: diagnóstico ---------------------------------------
const resultadosDiag = {};
function mostrarDiag(idLi, r) {
  const li = $(idLi);
  li.dataset.estado = r.estado;
  li.querySelector('.det').textContent = `${r.resumo}${r.detalhe ? ' — ' + r.detalhe : ''}`;
}

$('btn-diag').onclick = async () => {
  $('btn-diag').disabled = true;
  const testes = [['d-mic', 'a) Microfone', diag.testarMicrofone], ['d-api', 'b) API externa', diag.testarGroq],
    ['d-mod', 'c) Modelos no navegador', diag.testarModelos], ['d-arm', 'd) Armazenamento', diag.testarArmazenamento]];
  for (const [id, nome, fn] of testes) {
    $(id).querySelector('.det').textContent = 'Testando…';
    let r;
    try { r = await fn(); } catch (e) { r = { estado: 'falha', resumo: 'Erro inesperado no teste', detalhe: e.message }; }
    resultadosDiag[nome] = r;
    mostrarDiag(id, r);
  }
  $('btn-diag').disabled = false;
  $('btn-copiar-diag').disabled = false;
};

$('btn-copiar-diag').onclick = async () => {
  const amb = diag.ambiente();
  const pwa = await estadoPWA;
  const linhas = ['RELATÓRIO ETAPA 0', `Endereço: ${amb.endereco} | HTTPS: ${amb.https} | em iframe: ${amb.emIframe} | instalado: ${amb.instalado} | service worker: ${pwa.sw}`];
  for (const [nome, r] of Object.entries(resultadosDiag)) linhas.push(`${nome}: ${r.estado.toUpperCase()} — ${r.resumo}. ${r.detalhe}`);
  linhas.push(`Navegador: ${amb.navegador}`);
  copiar(linhas.join('\n'), $('btn-copiar-diag'));
};

// ---------- ETAPA 1: carregar modelo -----------------------------------
let reconhecedor = null;
for (const [chave, m] of Object.entries(MOTORES)) $('sel-motor').add(new Option(m.nome, chave));
$('sel-motor').value = arm.ler('motor', 'navegador-speako');

// Acompanha o download de vários arquivos e mostra o total.
const progresso = new Map();
function aoProgredir(p) {
  if (p.status === 'progress' && p.total) progresso.set(p.file, { carregado: p.loaded, total: p.total });
  if (p.status === 'done' && progresso.has(p.file)) progresso.get(p.file).carregado = progresso.get(p.file).total;
  let c = 0, t = 0;
  for (const v of progresso.values()) { c += v.carregado; t += v.total; }
  if (t) {
    $('barra').style.width = `${(100 * c / t).toFixed(1)}%`;
    $('status-modelo').textContent = `Baixando: ${(c / 1e6).toFixed(0)} de ${(t / 1e6).toFixed(0)} MB (vem do cache se já baixou antes)…`;
  }
}

$('btn-carregar').onclick = async () => {
  const chave = $('sel-motor').value;
  arm.gravar('motor', chave);
  $('btn-carregar').disabled = true;
  $('btn-gravar').disabled = true;
  $('status-modelo').dataset.estado = '';
  $('status-modelo').textContent = 'Iniciando…';
  progresso.clear();
  try {
    const r = criarReconhecedor(chave);
    const info = await r.carregar(aoProgredir);
    $('barra').style.width = '100%';
    $('status-modelo').textContent = `Carregado em ${(info.ms / 1000).toFixed(1)} s (${info.detalhes}). Aquecendo…`;
    // A 1ª inferência é sempre mais lenta; fazemos uma "de aquecimento" com silêncio.
    const aq = await r.reconhecer(new Float32Array(16000));
    reconhecedor = r;
    $('status-modelo').dataset.estado = 'ok';
    $('status-modelo').textContent = `Pronto · ${info.detalhes} · carga ${(info.ms / 1000).toFixed(1)} s · aquecimento ${Math.round(aq.ms)} ms`;
    $('btn-gravar').disabled = false;
    $('btn-arquivo').disabled = false;
    $('status-gravacao').textContent = 'Toque em Gravar e diga a palavra.';
  } catch (e) {
    $('status-modelo').dataset.estado = 'falha';
    $('status-modelo').textContent = `Falhou: ${e.message}`;
  } finally {
    $('btn-carregar').disabled = false;
  }
};

// ---------- TESTE ship × sheep ----------------------------------------
let tentativas = arm.ler('tentativas', []);   // [{alvo, ipa, analise, ms, msTotal}]
let ordem = arm.ler('ordem', null) || novaOrdem();
const audios = new Map();                      // índice -> URL do áudio (não persiste)

function novaOrdem() {
  const o = ['ship', 'ship', 'ship', 'ship', 'ship', 'sheep', 'sheep', 'sheep', 'sheep', 'sheep'];
  for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
  arm.gravar('ordem', o);
  return o;
}

let alvoAtual = ordem[Math.min(tentativas.length, 9)];
function definirAlvo(p) {
  alvoAtual = p;
  $('alvo').dataset.palavra = p;
  $('alvo-palavra').textContent = p;
  $('alvo-ipa').textContent = `/${PALAVRAS[p].ipa}/`;
  $('alvo-dica').textContent = PALAVRAS[p].dica;
  $('alvo-ship').setAttribute('aria-pressed', p === 'ship');
  $('alvo-sheep').setAttribute('aria-pressed', p === 'sheep');
  const n = tentativas.length;
  $('contador').textContent = n < 10 ? `Tentativa ${n + 1} de 10` : `Teste completo · tentativa extra ${n + 1}`;
}
$('alvo-ship').onclick = () => definirAlvo('ship');
$('alvo-sheep').onclick = () => definirAlvo('sheep');

// Voz de referência do próprio sistema (grátis, sem internet no Android/Windows).
$('btn-ouvir').onclick = () => {
  if (!('speechSynthesis' in window)) return ($('status-gravacao').textContent = 'Este navegador não tem voz sintetizada.');
  const u = new SpeechSynthesisUtterance(alvoAtual);
  u.lang = 'en-US';
  u.rate = 0.8;
  const voz = speechSynthesis.getVoices().find((v) => v.lang?.startsWith('en-US'));
  if (voz) u.voice = voz;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
};

const gravador = new Gravador({ limiteSegundos: 3 });
$('btn-gravar').onclick = async () => {
  const b = $('btn-gravar');
  if (gravador.gravando) return gravador.parar();
  try {
    b.dataset.gravando = 'true';
    b.textContent = 'Parar';
    $('status-gravacao').textContent = 'Gravando… fale agora.';
    await gravador.iniciar((nivel) => b.style.setProperty('--nivel', nivel));
    // Espera parar (novo toque ou limite de 3 s).
    const { blob, amostras } = await gravador.concluido;
    b.dataset.gravando = 'false';
    b.style.setProperty('--nivel', 0);
    b.textContent = 'Gravar';
    await processar(amostras, blob, alvoAtual, true);
  } catch (e) {
    b.dataset.gravando = 'false';
    b.textContent = 'Gravar';
    $('status-gravacao').textContent = e.name === 'NotAllowedError'
      ? 'Microfone bloqueado. Libere no cadeado da barra de endereço.'
      : `Erro ao gravar: ${e.message}`;
  }
};

async function processar(amostras, blob, alvo, contaNoTeste) {
  const st = contaNoTeste ? $('status-gravacao') : $('status-arquivo');
  if (!temVoz(amostras)) { st.textContent = 'Não captei voz. Fale mais perto do microfone.'; return; }
  st.textContent = 'Analisando fonemas…';
  $('btn-gravar').disabled = true;
  const t0 = performance.now();
  try {
    const { ipa, ms } = await reconhecedor.reconhecer(amostras);
    const msTotal = performance.now() - t0;
    const analise = analisarShipSheep(ipa, alvo);
    const duracao = (amostras.length / 16000).toFixed(1);
    if (!contaNoTeste) {
      st.textContent = `Arquivo (${duracao} s): reconhecido /${ipa}/ → modelo ouviu "${analise.ouvido}" ${analise.acertou ? '✓ correto' : '✗ diferente do esperado'} · ${Math.round(ms)} ms`;
      return;
    }
    tentativas.push({ alvo, ipa, analise, ms: Math.round(ms), msTotal: Math.round(msTotal), duracao: +duracao });
    audios.set(tentativas.length - 1, URL.createObjectURL(blob));
    arm.gravar('tentativas', tentativas);
    st.textContent = analise.acertou
      ? `✓ Reconhecido como ${alvo}.`
      : `✗ O modelo ouviu "${analise.ouvido}" (vogal ${analise.vogal ?? 'nenhuma'}). Escute o nativo e tente sentir a diferença.`;
    render();
    if (tentativas.length < 10) definirAlvo(ordem[tentativas.length]);
    else definirAlvo(alvo);
  } catch (e) {
    st.textContent = `Erro do modelo: ${e.message}`;
  } finally {
    $('btn-gravar').disabled = false;
  }
}

$('btn-refazer').onclick = () => {
  const ultima = tentativas.pop();
  if (!ultima) return;
  audios.delete(tentativas.length);
  arm.gravar('tentativas', tentativas);
  render();
  definirAlvo(ultima.alvo);
};

$('btn-zerar').onclick = () => {
  tentativas = [];
  audios.clear();
  arm.gravar('tentativas', tentativas);
  ordem = novaOrdem();
  render();
  definirAlvo(ordem[0]);
};

function render() {
  const corpo = $('corpo-tabela');
  corpo.replaceChildren();
  if (!tentativas.length) {
    corpo.innerHTML = '<tr><td colspan="9" class="suave">As tentativas aparecem aqui.</td></tr>';
  }
  tentativas.forEach((t, i) => {
    const tr = document.createElement('tr');
    const celula = (txt, cls) => { const td = document.createElement('td'); td.textContent = txt; if (cls) td.className = cls; tr.append(td); return td; };
    celula(i + 1);
    celula('').append(chip(t.alvo));
    celula(`/${t.ipa || '∅'}/`, 'ipa');
    celula(t.analise.vogal ?? '–', 'ipa');
    celula('').append(chip(t.analise.ouvido));
    celula(t.analise.acertou ? '✓' : '✗', t.analise.acertou ? 'certo' : 'errado');
    celula(`${t.ms} ms`);
    celula(`${t.msTotal} ms`);
    const tdAudio = celula('');
    const url = audios.get(i);
    if (url) {
      const b = document.createElement('button');
      b.textContent = '▶';
      b.setAttribute('aria-label', `Ouvir tentativa ${i + 1}`);
      b.onclick = () => new Audio(url).play();
      tdAudio.append(b);
    } else tdAudio.textContent = '–';
    corpo.append(tr);
  });
  $('btn-refazer').disabled = !tentativas.length;

  const r = resumir(tentativas);
  $('p-ship').textContent = `${r.ship.acertos}/${r.ship.feitas}`;
  $('p-sheep').textContent = `${r.sheep.acertos}/${r.sheep.feitas}`;
  $('p-tempo').textContent = r.tempoMedioMs ? `${Math.round(r.tempoMedioMs)} ms` : '–';
  const v = $('veredito');
  v.dataset.v = r.veredito;
  v.textContent = {
    incompleto: `Faltam ${Math.max(0, 5 - r.ship.feitas)} ship e ${Math.max(0, 5 - r.sheep.feitas)} sheep para o veredito.`,
    distingue: 'Sim: o modelo separou os dois sons de forma consistente (≥ 80% em cada). Dá para usar no app.',
    parcial: 'Mais ou menos (60–79%). Calibre com o áudio nativo abaixo para saber se o erro é do modelo ou da pronúncia.',
    'nao-distingue': 'Não de forma confiável. Antes de culpar o modelo, teste com o áudio nativo abaixo: se ele também errar o nativo, partimos para o plano B.',
  }[r.veredito];
}

function chip(p) {
  const s = document.createElement('span');
  s.className = `chip ${p}`;
  s.textContent = p;
  return s;
}

$('btn-copiar-resumo').onclick = async () => {
  const r = resumir(tentativas);
  const motor = $('sel-motor').selectedOptions[0]?.textContent;
  const linhas = [
    'RESULTADO ETAPA 1 — ship × sheep',
    `Motor: ${motor} | ${$('status-modelo').textContent}`,
    `ship→ship: ${r.ship.acertos}/${r.ship.feitas} | sheep→sheep: ${r.sheep.acertos}/${r.sheep.feitas} | tempo médio do modelo: ${Math.round(r.tempoMedioMs || 0)} ms (máx ${r.tempoMaxMs ?? '–'} ms) | veredito: ${r.veredito}`,
    ...tentativas.map((t, i) => `${i + 1}. alvo=${t.alvo} reconhecido=/${t.ipa}/ vogal=${t.analise.vogal} ouviu=${t.analise.ouvido} ${t.analise.acertou ? 'OK' : 'ERRO'} modelo=${t.ms}ms total=${t.msTotal}ms áudio=${t.duracao}s`),
    `Aparelho: ${navigator.userAgent}`,
  ];
  copiar(linhas.join('\n'), $('btn-copiar-resumo'));
};

// ---------- Calibração com arquivo -----------------------------------
$('btn-arquivo').onclick = async () => {
  const f = $('arquivo').files[0];
  if (!f) return ($('status-arquivo').textContent = 'Escolha um arquivo de áudio primeiro.');
  try {
    const amostras = cortarSilencio(await blobPara16k(f));
    await processar(amostras, f, $('arquivo-alvo').value, false);
  } catch (e) {
    $('status-arquivo').textContent = `Não consegui ler o arquivo: ${e.message}`;
  }
};

// ---------- utilidades -----------------------------------------------
async function copiar(texto, botao) {
  const antes = botao.textContent;
  try { await navigator.clipboard.writeText(texto); botao.textContent = 'Copiado'; } catch {
    // Sem permissão de área de transferência: mostra o texto para copiar à mão.
    const ta = document.createElement('textarea');
    ta.value = texto; ta.rows = 8; ta.style.width = '100%';
    botao.closest('section').append(ta); ta.select();
    botao.textContent = 'Selecione e copie o texto abaixo';
  }
  setTimeout(() => (botao.textContent = antes), 2500);
}

render();
definirAlvo(alvoAtual);
