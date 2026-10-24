// =============================================================
// sw.js — service worker.
// 1) Guarda os arquivos do app para abrir sem internet.
// 2) Acrescenta os cabeçalhos COOP/COEP (o GitHub Pages não deixa
//    configurar cabeçalhos), o que libera multithread para o modelo.
// O modelo em si (~355 MB) NÃO passa por aqui: o transformers.js
// guarda ele no próprio cache.
// =============================================================

const VERSAO = 'ingles-v4';
const ARQUIVOS = [
  './',
  './css/app.css',
  './css/estilo.css',
  './icones/icone-192.png',
  './icones/icone-512.png',
  './index.html',
  './js/armazenamento.js',
  './js/audio.js',
  './js/comparar.js',
  './js/dados/curriculo.js',
  './js/dados/nivelamento.js',
  './js/diagnostico.js',
  './js/fonemas-servidor.js',
  './js/fonemas-worker.js',
  './js/fonemas.js',
  './js/laboratorio.js',
  './js/motor/correcao.js',
  './js/motor/datas.js',
  './js/motor/fala.js',
  './js/motor/gamificacao.js',
  './js/motor/gerador.js',
  './js/motor/progresso.js',
  './js/motor/srs.js',
  './js/motor/voz.js',
  './js/principal.js',
  './js/pwa.js',
  './js/ui/dom.js',
  './js/ui/exercicios.js',
  './js/ui/sessao.js',
  './js/ui/telas.js',
  './laboratorio.html',
  './manifest.webmanifest',
];
const CDN_CACHEAVEIS = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('ingles-') && k !== VERSAO) await caches.delete(k);
    await self.clients.claim();
  })());
});

/** Copia a resposta acrescentando os cabeçalhos de isolamento. */
function comIsolamento(resp) {
  if (!resp || resp.status === 0) return resp;
  const h = new Headers(resp.headers);
  h.set('Cross-Origin-Opener-Policy', 'same-origin');
  h.set('Cross-Origin-Embedder-Policy', 'credentialless');
  return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers: h });
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  // Arquivos do próprio app: rede primeiro (pega atualizações), cache se offline.
  if (url.origin === self.location.origin) {
    const isolar = !(e.request.mode === 'navigate' && url.searchParams.get('coi') === '0')
      && !(e.request.referrer && new URL(e.request.referrer).searchParams.get('coi') === '0');
    e.respondWith((async () => {
      let resp;
      try {
        resp = await fetch(e.request);
        if (resp.ok) (await caches.open(VERSAO)).put(e.request, resp.clone());
      } catch {
        resp = await caches.match(e.request, { ignoreSearch: true });
        if (!resp) return new Response('Sem internet e arquivo não guardado.', { status: 503 });
      }
      return isolar ? comIsolamento(resp) : resp;
    })());
    return;
  }

  // Biblioteca e fontes: cache primeiro (não mudam, versão fixada).
  if (CDN_CACHEAVEIS.includes(url.hostname)) {
    e.respondWith((async () => {
      const c = await caches.open(VERSAO + '-cdn');
      const salvo = await c.match(e.request);
      if (salvo) return salvo;
      const resp = await fetch(e.request);
      if (resp.ok && resp.type !== 'opaque') c.put(e.request, resp.clone());
      return resp;
    })());
  }
  // Todo o resto (Hugging Face, Groq…) passa direto.
});
