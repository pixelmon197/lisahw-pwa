/* Service Worker - L.i.s.a.H.W Sistema de Noticias
   Ciclo de vida: install (precarga) -> waiting (espera aprobación) -> activate (limpia cachés viejos)
   Para publicar una versión nueva: cambiar VERSION. */
const VERSION = 'v3';
const CACHE = 'lisahw-' + VERSION;

// Recursos esenciales (App Shell + datos base) para abrir la app sin conexión
const RECURSOS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './noticias.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

// 1) INSTALACIÓN: precargar el App Shell.
//    No se llama skipWaiting() automáticamente: una versión nueva queda "en espera"
//    hasta que el usuario pulse "Actualizar" en la app (mensaje SKIP_WAITING).
self.addEventListener('install', (evento) => {
  console.log('[SW] Instalando', CACHE);
  evento.waitUntil(caches.open(CACHE).then((c) => c.addAll(RECURSOS)));
});

// 2) ACTIVACIÓN: borrar cachés de versiones anteriores y tomar control de las pestañas
self.addEventListener('activate', (evento) => {
  console.log('[SW] Activado', CACHE);
  evento.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k.startsWith('lisahw-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 3) ACTUALIZACIÓN: la página pide activar la versión que está en espera
self.addEventListener('message', (evento) => {
  if (!evento.data) return;
  if (evento.data.tipo === 'SKIP_WAITING') self.skipWaiting();
  if (evento.data.tipo === 'VERSION' && evento.source) evento.source.postMessage({ tipo: 'VERSION', cache: CACHE });
});

// 4) FETCH
//    - noticias.json: red primero (contenido fresco); si no hay red, usa la copia en caché
//    - resto: caché primero (rápido y funciona sin conexión)
//    - navegaciones sin red ni caché: se devuelve index.html
self.addEventListener('fetch', (evento) => {
  const req = evento.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // mapas y otros sitios externos no se interceptan

  if (url.pathname.endsWith('/noticias.json')) {
    evento.respondWith(
      fetch(req)
        .then((resp) => {
          if (resp.ok) {
            const copia = resp.clone();
            caches.open(CACHE).then((c) => c.put(req, copia));
          }
          return resp;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  evento.respondWith(
    caches.match(req, { ignoreSearch: true }).then((enCache) => {
      if (enCache) return enCache;
      return fetch(req)
        .then((resp) => {
          if (resp.ok) {
            const copia = resp.clone();
            caches.open(CACHE).then((c) => c.put(req, copia));
          }
          return resp;
        })
        .catch(() => (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()));
    })
  );
});

// 5) NOTIFICACIONES: al tocar una, abrir o enfocar la app en la sección indicada
self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const destino = (evento.notification.data && evento.notification.data.url) || './';
  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
      for (const v of ventanas) {
        if ('focus' in v) { v.navigate(destino); return v.focus(); }
      }
      return self.clients.openWindow(destino);
    })
  );
});
