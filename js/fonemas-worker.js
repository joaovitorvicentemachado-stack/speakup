// =============================================================
// fonemas-worker.js — roda o modelo de FONEMAS fora da tela principal
// (a interface não trava enquanto o modelo pensa).
// Motor: transformers.js + ONNX Runtime Web, 100% no aparelho, sem custo.
// =============================================================

// Build "min" = arquivo único, sem dependências externas. Versão fixada.
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0/dist/transformers.min.js';

env.allowLocalModels = false;   // sempre baixa do Hugging Face…
env.useBrowserCache = true;     // …uma vez só: fica guardado no Cache Storage

let reconhecedor = null;

self.onmessage = async ({ data }) => {
  const { tipo, id } = data;
  try {
    if (tipo === 'carregar') {
      const { modelo, dispositivo, dtype } = data;
      // Multithread só existe com "cross-origin isolation" (o service worker cuida disso).
      const threads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1;
      if (env.backends?.onnx?.wasm) env.backends.onnx.wasm.numThreads = threads;
      const t0 = performance.now();
      reconhecedor = await pipeline('automatic-speech-recognition', modelo, {
        device: dispositivo,
        dtype,
        progress_callback: (p) => self.postMessage({ tipo: 'progresso', p }),
      });
      self.postMessage({ tipo: 'pronto', id, ms: performance.now() - t0, threads });
    } else if (tipo === 'reconhecer') {
      if (!reconhecedor) throw new Error('Modelo ainda não carregado.');
      const t0 = performance.now();
      const { text } = await reconhecedor(data.amostras);
      self.postMessage({ tipo: 'resultado', id, ipa: (text || '').trim(), ms: performance.now() - t0 });
    }
  } catch (e) {
    self.postMessage({ tipo: 'erro', id, mensagem: e?.message || String(e) });
  }
};
