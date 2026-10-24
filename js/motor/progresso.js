// =============================================================
// progresso.js — o "banco de dados" do aluno, salvo no aparelho.
// Tudo que muda o progresso passa por aqui. Também exporta e
// importa o progresso em JSON (para sincronizar PC e celular).
// =============================================================

import { ler, gravar } from '../armazenamento.js';
import { hoje, somarDias, diferencaDias } from './datas.js';
import { novoCartao, responder, aprendido } from './srs.js';
import { XP, VIDAS, vidasAtuais, novasConquistas } from './gamificacao.js';

const VERSAO = 1;
const CHAVE = 'progresso';
const CATEGORIAS = ['vocabulario', 'gramatica', 'escuta', 'pronuncia'];

function estadoInicial() {
  return {
    versao: VERSAO,
    criadoEm: new Date().toISOString(),
    perfil: { nivel: null, meta: 20, vidasAtivas: false, falarAtivo: true, vozURI: null, velocidade: 0.95, tema: 'sistema' },
    xp: 0,
    dias: {},                          // 'AAAA-MM-DD' -> { xp, minutos, exercicios }
    sequencia: { atual: 0, recorde: 0, ultimoDia: null },
    licoes: {},                        // id -> { concluida, melhor, vezes, ultima }
    srs: {},                           // id do item -> cartão SM-2
    estatisticas: Object.fromEntries(CATEGORIAS.map((c) => [c, { acertos: 0, erros: 0 }])),
    conquistas: {},                    // id -> data
    vidas: { qtd: VIDAS.maximo, desde: Date.now() },
    contadores: { revisoes: 0, falas: 0 },
    ultimaLicao: null,
    pularFalaAte: 0,
  };
}

let estado = carregar();

function carregar() {
  const salvo = ler(CHAVE, null);
  if (!salvo) return estadoInicial();
  // Completa campos novos de versões antigas.
  const base = estadoInicial();
  return { ...base, ...salvo, perfil: { ...base.perfil, ...salvo.perfil }, contadores: { ...base.contadores, ...salvo.contadores },
    estatisticas: { ...base.estatisticas, ...salvo.estatisticas } };
}

const ouvintes = new Set();
export const aoMudar = (fn) => (ouvintes.add(fn), () => ouvintes.delete(fn));
function salvar() {
  gravar(CHAVE, estado);
  ouvintes.forEach((fn) => fn(estado));
}

export const obter = () => estado;

export function atualizarPerfil(mudancas) {
  estado.perfil = { ...estado.perfil, ...mudancas };
  salvar();
}

// ---------- dia, XP e sequência ------------------------------------
function registrarDia(xp = 0, exercicios = 0) {
  const d = hoje();
  const dia = estado.dias[d] || { xp: 0, exercicios: 0 };
  dia.xp += xp;
  dia.exercicios += exercicios;
  estado.dias[d] = dia;
  // Sequência: conta dias com pelo menos 1 atividade concluída.
  const s = estado.sequencia;
  if (s.ultimoDia !== d && xp > 0) {
    s.atual = s.ultimoDia && diferencaDias(s.ultimoDia, d) === 1 ? s.atual + 1 : 1;
    s.ultimoDia = d;
    s.recorde = Math.max(s.recorde, s.atual);
  }
}

/** Sequência como o usuário vê hoje (zera se pulou um dia). */
export function sequenciaAtual() {
  const s = estado.sequencia;
  if (!s.ultimoDia) return 0;
  const dif = diferencaDias(s.ultimoDia, hoje());
  return dif <= 1 ? s.atual : 0;
}

export const xpHoje = () => estado.dias[hoje()]?.xp || 0;

function ganharXP(qtd) {
  estado.xp += qtd;
  registrarDia(qtd, 0);
}

// ---------- respostas ---------------------------------------------
/**
 * Registra uma resposta de exercício.
 * @param ex exercício (precisa de .cat e .ids)
 * @param nota 'certo' | 'quase' | 'errado' | 'pulado'
 */
export function registrarResposta(ex, nota, { revisao = false } = {}) {
  if (nota === 'pulado') return;
  const certo = nota !== 'errado';
  const est = estado.estatisticas[ex.cat];
  if (est) certo ? est.acertos++ : est.erros++;
  if (ex.tipo === 'falar') estado.contadores.falas++;
  if (revisao) estado.contadores.revisoes++;
  const qualidade = nota === 'certo' ? 4 : nota === 'quase' ? 3 : 1;
  for (const id of ex.ids || []) {
    // Na lição, só cria cartão novo; o 1º acerto não conta como revisão.
    const c = estado.srs[id] || novoCartao(id);
    if (!estado.srs[id] && certo && !revisao) estado.srs[id] = { ...c, vence: somarDias(hoje(), 1) };
    else estado.srs[id] = responder(c, qualidade);
  }
  registrarDia(0, 1);
  if (!certo && estado.perfil.vidasAtivas && !revisao) perderVida();
  salvar();
}

// ---------- vidas --------------------------------------------------
export const vidas = () => vidasAtuais(estado.vidas);

function perderVida() {
  const agora = Date.now();
  const atual = vidasAtuais(estado.vidas, agora);
  const intervalo = VIDAS.minutosPorVida * 60000;
  const desde = atual.qtd >= VIDAS.maximo ? agora
    : estado.vidas.desde + Math.floor((agora - estado.vidas.desde) / intervalo) * intervalo;
  estado.vidas = { qtd: Math.max(0, atual.qtd - 1), desde };
}

// ---------- fim de lição / revisão / nivelamento --------------------
/** @returns {{xp:number, conquistas:Array}} */
export function concluirLicao(id, { acertos, total }) {
  const pct = total ? Math.round((100 * acertos) / total) : 0;
  const l = estado.licoes[id] || { concluida: false, melhor: 0, vezes: 0 };
  const xp = XP.licao + (pct === 100 ? XP.licaoPerfeita : 0);
  estado.licoes[id] = { concluida: true, melhor: Math.max(l.melhor, pct), vezes: l.vezes + 1, ultima: hoje() };
  estado.ultimaLicao = id;
  ganharXP(xp);
  return finalizar(xp);
}

export function concluirRevisao(qtdCartoes) {
  const xp = Math.max(XP.revisaoMinima, qtdCartoes * XP.revisaoPorCartao);
  ganharXP(xp);
  return finalizar(xp);
}

export function concluirNivelamento(nivel) {
  estado.perfil.nivel = nivel;
  ganharXP(XP.nivelamento);
  return finalizar(XP.nivelamento);
}

let resumoExtra = () => ({ unidadesCompletas: 0 });
/** O app informa como contar unidades completas (depende do currículo). */
export function definirResumoExtra(fn) { resumoExtra = fn; }

function finalizar(xp) {
  const resumo = { ...resumoExtra(estado), aprendidos: Object.values(estado.srs).filter(aprendido).length };
  const novas = novasConquistas(estado, resumo);
  for (const c of novas) estado.conquistas[c.id] = hoje();
  salvar();
  return { xp, conquistas: novas };
}

export function pularFala(minutos = 15) {
  estado.pularFalaAte = Date.now() + minutos * 60000;
  salvar();
}
export const falaPausada = () => Date.now() < (estado.pularFalaAte || 0);

// ---------- exportar / importar -----------------------------------
export function exportar() {
  return JSON.stringify({ app: 'laboratorio-pronuncia', versao: VERSAO, exportadoEm: new Date().toISOString(), dados: estado }, null, 1);
}

/** Valida e substitui o progresso. Guarda o atual como backup para desfazer. */
export function importar(texto) {
  let obj;
  try { obj = JSON.parse(texto); } catch { throw new Error('O arquivo não é um JSON válido.'); }
  if (obj?.app !== 'laboratorio-pronuncia' || !obj.dados?.perfil) throw new Error('Este arquivo não é um progresso deste app.');
  gravar('backup-antes-importar', { em: new Date().toISOString(), dados: estado });
  estado = { ...estadoInicial(), ...obj.dados };
  salvar();
  return { exportadoEm: obj.exportadoEm, xp: estado.xp };
}

export const temBackup = () => !!ler('backup-antes-importar', null);
export function desfazerImportacao() {
  const b = ler('backup-antes-importar', null);
  if (!b) return false;
  estado = b.dados;
  gravar('backup-antes-importar', null);
  salvar();
  return true;
}

export function apagarTudo() {
  gravar('backup-antes-importar', { em: new Date().toISOString(), dados: estado });
  estado = estadoInicial();
  salvar();
}
