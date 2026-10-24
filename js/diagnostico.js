// =============================================================
// diagnostico.js — ETAPA 0: testa de verdade o que o ambiente permite.
// Cada teste devolve { estado: 'ok' | 'aviso' | 'falha', resumo, detalhe }.
// Nenhum teste simula resultado: se não deu para testar, diz isso.
// =============================================================

const ok = (resumo, detalhe = '') => ({ estado: 'ok', resumo, detalhe });
const aviso = (resumo, detalhe = '') => ({ estado: 'aviso', resumo, detalhe });
const falha = (resumo, detalhe = '') => ({ estado: 'falha', resumo, detalhe });

/** a) Microfone — pede permissão de verdade e confere se chega som. */
export async function testarMicrofone() {
  if (!window.isSecureContext) return falha('Página sem HTTPS', 'O navegador só libera o microfone em https:// ou em localhost.');
  if (!navigator.mediaDevices?.getUserMedia) return falha('API de microfone ausente', 'Este navegador/ambiente não expõe getUserMedia.');
  if (!window.MediaRecorder) return falha('Gravação não suportada', 'MediaRecorder indisponível.');
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true });
    const trilha = s.getAudioTracks()[0];
    const nome = trilha?.label || 'microfone padrão';
    s.getTracks().forEach((t) => t.stop());
    return ok('Microfone liberado', nome);
  } catch (e) {
    if (e.name === 'NotAllowedError') return falha('Permissão negada', 'Libere o microfone no cadeado da barra de endereço e teste de novo. Se nem apareceu pedido, o ambiente bloqueia (ex.: artefato do Claude).');
    if (e.name === 'NotFoundError') return falha('Nenhum microfone encontrado', e.message);
    return falha(`Erro: ${e.name}`, e.message);
  }
}

/** b) API externa (Groq). Sem chave a resposta esperada é 401 — isso PROVA que a rede chegou lá. */
export async function testarGroq() {
  const t0 = performance.now();
  try {
    const r = await fetch('https://api.groq.com/openai/v1/models', { method: 'GET' });
    const ms = Math.round(performance.now() - t0);
    if (r.status === 401) return ok('api.groq.com acessível', `Respondeu 401 (sem chave, como esperado) em ${ms} ms. Com uma chave gratuita da Groq vai funcionar.`);
    if (r.ok) return ok('api.groq.com acessível', `HTTP ${r.status} em ${ms} ms.`);
    return aviso(`api.groq.com respondeu ${r.status}`, 'A rede chega lá, mas a resposta foi inesperada.');
  } catch (e) {
    return falha('Chamada bloqueada', 'O navegador não deixou a página falar com api.groq.com (política de segurança da página, rede ou CORS). ' + (e.message || ''));
  }
}

/** c) Modelos no navegador: WASM, WebGPU, acesso ao Hugging Face e à CDN do transformers.js. */
export async function testarModelos() {
  const partes = [];
  let pior = 'ok';
  const piora = (e) => { if (e === 'falha' || (e === 'aviso' && pior === 'ok')) pior = e; };

  const wasm = typeof WebAssembly === 'object';
  partes.push(`WASM: ${wasm ? 'sim' : 'NÃO'}`);
  if (!wasm) piora('falha');

  partes.push(`Multithread (cross-origin isolated): ${self.crossOriginIsolated ? 'sim' : 'não — modelo roda em 1 thread, mais lento'}`);
  if (!self.crossOriginIsolated) piora('aviso');

  if (navigator.gpu) {
    try {
      const ad = await navigator.gpu.requestAdapter();
      partes.push(`WebGPU: ${ad ? 'sim' : 'API presente, mas sem adaptador'}`);
    } catch { partes.push('WebGPU: erro ao pedir adaptador'); }
  } else partes.push('WebGPU: não (normal no celular; usamos WASM)');

  try {
    const r = await fetch('https://huggingface.co/robg/speako-phoneme-recognizer/resolve/main/config.json');
    partes.push(`Hugging Face: ${r.ok ? 'acessível' : 'HTTP ' + r.status}`);
    if (!r.ok) piora('falha');
  } catch { partes.push('Hugging Face: BLOQUEADO'); piora('falha'); }

  try {
    const r = await fetch('https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0/package.json');
    partes.push(`CDN do transformers.js: ${r.ok ? 'acessível' : 'HTTP ' + r.status}`);
    if (!r.ok) piora('falha');
  } catch { partes.push('CDN do transformers.js: BLOQUEADA'); piora('falha'); }

  if (navigator.deviceMemory) partes.push(`Memória informada pelo navegador: ~${navigator.deviceMemory} GB`);
  partes.push(`Núcleos de CPU: ${navigator.hardwareConcurrency || '?'}`);

  const resumo = pior === 'falha' ? 'Algo impede baixar/rodar o modelo' : pior === 'aviso' ? 'Funciona, com ressalvas' : 'Tudo pronto para rodar o modelo';
  return { estado: pior, resumo, detalhe: partes.join(' · ') };
}

/** d) Armazenamento local: localStorage, IndexedDB, Cache Storage e espaço livre. */
export async function testarArmazenamento() {
  const partes = [];
  let pior = 'ok';
  try {
    localStorage.setItem('__teste', '1');
    const lido = localStorage.getItem('__teste');
    localStorage.removeItem('__teste');
    partes.push(`localStorage: ${lido === '1' ? 'sim' : 'falhou'}`);
  } catch { partes.push('localStorage: bloqueado'); pior = 'aviso'; }

  try {
    await new Promise((ok, erro) => {
      const req = indexedDB.open('__teste_ingles', 1);
      req.onsuccess = () => { req.result.close(); indexedDB.deleteDatabase('__teste_ingles'); ok(); };
      req.onerror = () => erro(req.error);
    });
    partes.push('IndexedDB: sim');
  } catch { partes.push('IndexedDB: bloqueado'); pior = 'aviso'; }

  // É no Cache Storage que o transformers.js guarda o modelo (para não baixar de novo).
  try {
    const c = await caches.open('__teste');
    await caches.delete('__teste');
    partes.push(c ? 'Cache Storage: sim' : 'Cache Storage: ?');
  } catch { partes.push('Cache Storage: bloqueado — o modelo seria baixado a cada visita'); pior = 'falha'; }

  if (navigator.storage?.estimate) {
    const { quota = 0, usage = 0 } = await navigator.storage.estimate();
    const gb = (n) => (n / 1e9).toFixed(1);
    partes.push(`Espaço: ${gb(usage)} GB usados de ~${gb(quota)} GB disponíveis`);
    if (quota && quota < 0.6e9) pior = pior === 'falha' ? pior : 'aviso';
  }
  if (navigator.storage?.persist) {
    const fixo = await navigator.storage.persisted() || await navigator.storage.persist();
    partes.push(`Armazenamento persistente: ${fixo ? 'sim' : 'não (o navegador pode apagar o modelo se faltar espaço)'}`);
  }
  const resumo = pior === 'ok' ? 'Dá para guardar dados e o modelo' : pior === 'aviso' ? 'Guarda, com limitações' : 'Não dá para guardar o modelo';
  return { estado: pior, resumo, detalhe: partes.join(' · ') };
}

/** Informações gerais do ambiente, para o relatório. */
export function ambiente() {
  return {
    endereco: location.origin,
    https: window.isSecureContext,
    emIframe: window.self !== window.top,
    instalado: matchMedia('(display-mode: standalone)').matches,
    navegador: navigator.userAgent,
  };
}
