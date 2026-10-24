// =============================================================
// audio.js — captura do microfone e preparo do áudio para o modelo.
// Saída padrão: Float32Array mono a 16 kHz (o que modelos wav2vec2 esperam).
// Não sabe nada sobre modelos nem sobre a interface.
// =============================================================

export const TAXA_MODELO = 16000;

/** Grava do microfone. Uso: await g.iniciar(nivel => ...); const r = await g.parar(); */
export class Gravador {
  constructor({ limiteSegundos = 3 } = {}) {
    this.limiteSegundos = limiteSegundos;
    this.gravando = false;
  }

  async iniciar(aoMudarNivel) {
    // Desligamos os "filtros" do navegador: eles alteram o som da vogal,
    // e aqui queremos o som mais fiel possível.
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: true },
    });
    this.ctx = new AudioContext();
    const fonte = this.ctx.createMediaStreamSource(this.stream);
    const analisador = this.ctx.createAnalyser();
    analisador.fftSize = 1024;
    fonte.connect(analisador);
    const buf = new Float32Array(analisador.fftSize);
    const medir = () => {
      if (!this.gravando) return;
      analisador.getFloatTimeDomainData(buf);
      let soma = 0;
      for (const v of buf) soma += v * v;
      aoMudarNivel?.(Math.min(1, Math.sqrt(soma / buf.length) * 6));
      this.raf = requestAnimationFrame(medir);
    };

    // "concluido" resolve quando a gravação termina (por toque ou pelo limite).
    this.concluido = new Promise((ok, falha) => { this._ok = ok; this._falha = falha; });
    this.partes = [];
    this.recorder = new MediaRecorder(this.stream);
    this.recorder.ondataavailable = (e) => e.data.size && this.partes.push(e.data);
    this.terminou = new Promise((ok) => (this.recorder.onstop = ok));
    this.recorder.start();
    this.gravando = true;
    medir();
    // Para sozinho depois do limite (uma palavra cabe com folga em 3 s).
    this.timer = setTimeout(() => this.parar(), this.limiteSegundos * 1000);
  }

  async parar() {
    if (!this.gravando) return this.resultado;
    this.gravando = false;
    clearTimeout(this.timer);
    cancelAnimationFrame(this.raf);
    try {
      this.recorder.stop();
      await this.terminou;
      this.stream.getTracks().forEach((t) => t.stop());
      await this.ctx.close();
      const blob = new Blob(this.partes, { type: this.recorder.mimeType || 'audio/webm' });
      const amostras = await blobPara16k(blob);
      this.resultado = { blob, amostras: cortarSilencio(amostras) };
      this._ok(this.resultado);
    } catch (e) {
      this._falha(e);
    }
    return this.concluido;
  }
}

/** Converte qualquer áudio (webm, ogg, mp3, wav…) em Float32 mono 16 kHz. */
export async function blobPara16k(blob) {
  const dados = await blob.arrayBuffer();
  const ctx = new AudioContext();
  let original;
  try { original = await ctx.decodeAudioData(dados); } finally { ctx.close(); }
  const quadros = Math.max(1, Math.ceil(original.duration * TAXA_MODELO));
  // OfflineAudioContext com 1 canal já mistura estéreo → mono e reamostra.
  const off = new OfflineAudioContext(1, quadros, TAXA_MODELO);
  const src = off.createBufferSource();
  src.buffer = original;
  src.connect(off.destination);
  src.start();
  const r = await off.startRendering();
  return r.getChannelData(0).slice();
}

/** Remove silêncio do começo e do fim (deixa 150 ms de margem). Acelera o modelo. */
export function cortarSilencio(x, taxa = TAXA_MODELO) {
  const q = Math.round(taxa * 0.02); // janelas de 20 ms
  const energias = [];
  for (let i = 0; i < x.length; i += q) {
    let s = 0;
    const fim = Math.min(x.length, i + q);
    for (let j = i; j < fim; j++) s += x[j] * x[j];
    energias.push(Math.sqrt(s / (fim - i)));
  }
  const pico = Math.max(...energias, 0);
  if (pico < 0.003) return x; // só silêncio: devolve como está
  const limiar = Math.max(0.004, pico * 0.08);
  const ini = energias.findIndex((e) => e > limiar);
  const fim = energias.length - 1 - [...energias].reverse().findIndex((e) => e > limiar);
  const margem = Math.round(taxa * 0.15);
  return x.slice(Math.max(0, ini * q - margem), Math.min(x.length, (fim + 1) * q + margem));
}

/** true se o áudio tem algo além de silêncio. */
export function temVoz(x) {
  let pico = 0;
  for (const v of x) pico = Math.max(pico, Math.abs(v));
  return pico > 0.02;
}
