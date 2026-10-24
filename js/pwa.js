// =============================================================
// pwa.js — registra o service worker (app instalável + offline) e
// ativa o "cross-origin isolation", que libera o modelo a usar
// vários núcleos do processador (fica 2–4× mais rápido no PC).
// Se algo der errado, abra a página com ?coi=0 para desligar isso.
// =============================================================

export async function iniciarPWA() {
  if (!('serviceWorker' in navigator)) return { sw: false };
  const desligado = new URLSearchParams(location.search).get('coi') === '0';
  try {
    const reg = await navigator.serviceWorker.register('./sw.js');
    await navigator.serviceWorker.ready;
    // Na primeira visita a página carregou ANTES do service worker existir,
    // então ainda não está isolada. Recarrega uma única vez.
    // (Uma vez só por aba, para nunca entrar em loop se o navegador não suportar.)
    if (!desligado && !self.crossOriginIsolated) {
      if (!sessionStorage.getItem('recarregouCOI')) {
        sessionStorage.setItem('recarregouCOI', '1');
        location.reload();
      }
    }
    return { sw: true, escopo: reg.scope };
  } catch (e) {
    return { sw: false, erro: e.message };
  }
}
