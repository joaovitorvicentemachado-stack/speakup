// =============================================================
// fonemas-servidor.js — mesmo contrato de fonemas.js, mas quem
// reconhece é um servidor Python rodando no SEU PC (servidor-fonemas/).
// Só funciona no computador onde o servidor está ligado.
// =============================================================

export class ReconhecedorServidor {
  constructor({ url }) { this.url = url; }

  async carregar() {
    const t0 = performance.now();
    const r = await fetch(`${this.url}/saude`).catch(() => null);
    if (!r?.ok) throw new Error(`Servidor local não respondeu em ${this.url}. Ele está ligado? (veja servidor-fonemas/LEIA-ME.md)`);
    const info = await r.json();
    return { ms: performance.now() - t0, detalhes: `${info.modelo} · ${info.dispositivo}` };
  }

  async reconhecer(amostras) {
    const t0 = performance.now();
    // Envia o áudio cru (Float32, 16 kHz, mono) — sem conversões no servidor.
    const r = await fetch(`${this.url}/fonemas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: amostras.buffer.slice(amostras.byteOffset, amostras.byteOffset + amostras.byteLength),
    });
    if (!r.ok) throw new Error(`Servidor respondeu ${r.status}`);
    const { ipa } = await r.json();
    return { ipa, ms: performance.now() - t0 };
  }
}
