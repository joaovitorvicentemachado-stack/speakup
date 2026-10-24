// =============================================================
// fonemas.js — PONTO ÚNICO DE TROCA do reconhecedor de fonemas.
// O resto do app só conhece esta interface:
//   const r = criarReconhecedor(config)
//   await r.carregar(aoProgredir)      -> { ms, detalhes }
//   await r.reconhecer(Float32 16 kHz) -> { ipa, ms }
// Para trocar de motor, adicione uma entrada em MOTORES.
// =============================================================

import { ReconhecedorServidor } from './fonemas-servidor.js';

export const MOTORES = {
  // Plano A: modelo no navegador (gratuito, offline depois do 1º download).
  'navegador-speako': {
    nome: 'No aparelho · speako (wav2vec2 TIMIT, ~355 MB)',
    criar: () => new ReconhecedorNavegador({
      modelo: 'robg/speako-phoneme-recognizer', dtype: 'q8', dispositivo: 'wasm',
    }),
  },
  // Mesmo modelo usando a GPU via WebGPU (pode ser mais rápido no PC; experimental).
  'navegador-speako-webgpu': {
    nome: 'No aparelho · speako via WebGPU (experimental)',
    criar: () => new ReconhecedorNavegador({
      modelo: 'robg/speako-phoneme-recognizer', dtype: 'q8', dispositivo: 'webgpu',
    }),
  },
  // Plano B: servidor Python local no PC (ver pasta servidor-fonemas/).
  'servidor-local': {
    nome: 'Servidor local no PC · wav2vec2-lv-60-espeak (plano B)',
    criar: () => new ReconhecedorServidor({ url: 'http://localhost:8765' }),
  },
};

export function criarReconhecedor(chave) {
  const m = MOTORES[chave];
  if (!m) throw new Error(`Motor desconhecido: ${chave}`);
  return m.criar();
}

/** Roda o modelo dentro de um Web Worker (js/fonemas-worker.js). */
class ReconhecedorNavegador {
  constructor(cfg) {
    this.cfg = cfg;
    this.pendentes = new Map();
    this.seq = 0;
  }

  _enviar(msg) {
    const id = ++this.seq;
    return new Promise((ok, falha) => {
      this.pendentes.set(id, { ok, falha });
      this.worker.postMessage({ ...msg, id }, msg.amostras ? [msg.amostras.buffer] : []);
    });
  }

  async carregar(aoProgredir) {
    this.worker = new Worker(new URL('./fonemas-worker.js', import.meta.url), { type: 'module' });
    this.worker.onmessage = ({ data }) => {
      if (data.tipo === 'progresso') return aoProgredir?.(data.p);
      const p = this.pendentes.get(data.id);
      if (!p) return;
      this.pendentes.delete(data.id);
      data.tipo === 'erro' ? p.falha(new Error(data.mensagem)) : p.ok(data);
    };
    this.worker.onerror = (e) => {
      const msg = e.message || 'Falha ao iniciar o worker (o script do modelo não carregou).';
      for (const p of this.pendentes.values()) p.falha(new Error(msg));
      this.pendentes.clear();
    };
    const r = await this._enviar({ tipo: 'carregar', ...this.cfg });
    return { ms: r.ms, detalhes: `${this.cfg.dispositivo.toUpperCase()} · ${r.threads} thread(s)` };
  }

  async reconhecer(amostras) {
    // Copiamos porque o buffer é transferido para o worker.
    const r = await this._enviar({ tipo: 'reconhecer', amostras: amostras.slice() });
    return { ipa: r.ipa, ms: r.ms };
  }
}
