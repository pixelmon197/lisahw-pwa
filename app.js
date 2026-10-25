/* L.i.s.a.H.W - Sistema de Noticias (PWA)
   app.js: navegación, Service Worker (registro y actualización), modo sin conexión,
   notificaciones locales, geolocalización/foto y 4 contenidos dinámicos
   (Axel, Omar, Juan, Amanda). */

const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
const escapar = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let DATOS = { axel: [], omar: [], juan: [], amanda: [] };

/* ---------- Mensajes breves ---------- */
let toastTimer;
function toast(msg, ms = 3500) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), ms);
}

/* ---------- Navegación (App Shell) ---------- */
const VISTAS = ['inicio', 'axel', 'omar', 'juan', 'amanda', 'reportes'];

function mostrarVista() {
  let id = location.hash.replace('#', '');
  if (!VISTAS.includes(id)) id = 'inicio';
  $$('.vista').forEach((v) => (v.hidden = v.id !== id));
  $$('[data-vista]').forEach((a) => a.classList.toggle('activa', a.dataset.vista === id));
  cerrarMenu();
  window.scrollTo({ top: 0 });
  id === 'omar' ? iniciarAutoCarrusel() : detenerAutoCarrusel();
  if (id === 'inicio') actualizarDiagnostico();
}

function abrirMenu() { $('#menu').classList.add('abierto'); $('#velo').hidden = false; $('#btnMenu').setAttribute('aria-expanded', 'true'); }
function cerrarMenu() { $('#menu').classList.remove('abierto'); $('#velo').hidden = true; $('#btnMenu').setAttribute('aria-expanded', 'false'); }

$('#btnMenu').addEventListener('click', () => ($('#menu').classList.contains('abierto') ? cerrarMenu() : abrirMenu()));
$('#velo').addEventListener('click', cerrarMenu);
window.addEventListener('hashchange', mostrarVista);
// Al pasar a modo teléfono, cierra el cajón si estaba abierto
window.matchMedia('(min-width: 900px)').addEventListener('change', cerrarMenu);

/* ---------- Estado de conexión ---------- */
let estabaOffline = !navigator.onLine;
function actualizarRed() {
  const en = navigator.onLine;
  const b = $('#estadoRed');
  b.textContent = en ? 'En línea' : 'Sin conexión';
  b.classList.toggle('offline', !en);
  $('#bannerOffline').hidden = en;
  $('#estadoConexion').textContent = en ? 'En línea' : 'Sin conexión (usando caché)';
  $('#btnActualizar').disabled = !en;
  $('#btnBuscarUpdate').disabled = !en;
  pintarReportes(); // los enlaces al mapa dependen de la conexión
}
window.addEventListener('offline', () => {
  estabaOffline = true;
  actualizarRed();
  toast('Sin conexión: se muestra la información guardada en el dispositivo.');
});
window.addEventListener('online', () => {
  actualizarRed();
  if (estabaOffline) {
    toast('Conexión restablecida.');
    notificar('Conexión restablecida', 'Ya puedes actualizar las noticias y ver mapas.', './#inicio');
  }
  estabaOffline = false;
});

/* ---------- Service Worker: registro, actualización y diagnóstico ---------- */
let swReg = null;
let swEsperando = null;
let usuarioPidioActualizar = false;

function mostrarAvisoActualizacion(sw) {
  swEsperando = sw;
  $('#bannerUpdate').hidden = false;
}

async function registrarSW() {
  const el = $('#estadoSW');
  if (!('serviceWorker' in navigator)) { el.textContent = 'no soportado en este navegador'; return; }
  try {
    swReg = await navigator.serviceWorker.register('sw.js');
    console.log('[PWA] Service Worker registrado. Scope:', swReg.scope);
    el.textContent = 'registrado ✔';

    // Si ya hay una versión nueva esperando (se descargó en una visita anterior)
    if (swReg.waiting && navigator.serviceWorker.controller) mostrarAvisoActualizacion(swReg.waiting);

    // Si se encuentra una versión nueva mientras la app está abierta
    swReg.addEventListener('updatefound', () => {
      const nuevo = swReg.installing;
      if (!nuevo) return;
      console.log('[PWA] Nueva versión del Service Worker encontrada');
      nuevo.addEventListener('statechange', () => {
        if (nuevo.state === 'installed' && navigator.serviceWorker.controller) mostrarAvisoActualizacion(nuevo);
      });
    });

    // Cuando la versión nueva toma el control, recargar (solo si el usuario lo pidió)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (usuarioPidioActualizar) location.reload();
    });

    await navigator.serviceWorker.ready;
    el.textContent = 'activo ✔ (scope: ' + swReg.scope.replace(location.origin, '') + ')';
    actualizarDiagnostico();

    // Buscar versiones nuevas al volver a la app
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && navigator.onLine) swReg.update().catch(() => {});
    });
  } catch (e) {
    console.error('[PWA] Error al registrar el SW', e);
    el.textContent = 'error: ' + e.message;
  }
}

$('#btnUpdate').addEventListener('click', () => {
  if (!swEsperando) return;
  usuarioPidioActualizar = true;
  swEsperando.postMessage({ tipo: 'SKIP_WAITING' });
});

$('#btnBuscarUpdate').addEventListener('click', async () => {
  if (!swReg) { toast('El Service Worker no está disponible en este navegador.'); return; }
  if (!navigator.onLine) { toast('Buscar actualizaciones requiere conexión a internet.'); return; }
  try {
    await swReg.update();
    toast(swReg.installing || swReg.waiting ? 'Se encontró una nueva versión.' : 'Ya tienes la última versión.');
  } catch {
    toast('No se pudo buscar la actualización. Intenta de nuevo.');
  }
});

async function actualizarDiagnostico() {
  // Caché
  try {
    if ('caches' in window) {
      const nombres = (await caches.keys()).filter((k) => k.startsWith('lisahw-'));
      if (nombres.length) {
        const c = await caches.open(nombres[nombres.length - 1]);
        const n = (await c.keys()).length;
        $('#estadoCache').textContent = `${nombres[nombres.length - 1]} (${n} recursos)`;
      } else {
        $('#estadoCache').textContent = 'aún sin caché';
      }
    } else {
      $('#estadoCache').textContent = 'no soportado';
    }
  } catch { $('#estadoCache').textContent = 'no disponible'; }
  actualizarEstadoNotif();
  actualizarEstadoGeo();
}

/* ---------- Instalación ---------- */
let eventoInstalar = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  eventoInstalar = e;
  $('#btnInstalar').hidden = false;
});
$('#btnInstalar').addEventListener('click', async () => {
  if (!eventoInstalar) return;
  eventoInstalar.prompt();
  await eventoInstalar.userChoice;
  eventoInstalar = null;
  $('#btnInstalar').hidden = true;
});

/* ---------- Notificaciones locales (Notification API + SW showNotification) ---------- */
function textoPermiso() {
  if (!('Notification' in window)) return 'no soportadas en este navegador';
  return { granted: 'permitidas ✔', denied: 'bloqueadas ✖ (actívalas en el candado de la barra)', default: 'sin decidir' }[Notification.permission];
}
function actualizarEstadoNotif() { $('#estadoNotif').textContent = textoPermiso(); }

async function pedirPermisoNotif() {
  if (!('Notification' in window)) { toast('Este navegador no soporta notificaciones.'); return; }
  if (Notification.permission === 'denied') {
    toast('Las notificaciones están bloqueadas. Actívalas en la configuración del sitio.', 5000);
    return;
  }
  const permiso = await Notification.requestPermission(); // permiso del navegador: "notifications"
  actualizarEstadoNotif();
  if (permiso === 'granted') {
    toast('Notificaciones activadas');
    notificar('¡Notificaciones activadas!', 'Te avisaremos de reportes guardados, noticias nuevas y cambios de conexión.');
  } else {
    toast('No se concedió el permiso de notificaciones.');
  }
}

async function notificar(titulo, cuerpo, url = './#inicio') {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;
  const opciones = {
    body: cuerpo,
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    tag: 'lisahw-noticias',
    vibrate: [120, 60, 120],
    data: { url },
  };
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(titulo, opciones);
  } catch {
    try { new Notification(titulo, opciones); } catch { return false; } // respaldo si no hay SW
  }
  return true;
}

$('#btnNotif').addEventListener('click', pedirPermisoNotif);
$('#btnProbarNotif').addEventListener('click', async () => {
  if (Notification.permission !== 'granted') { toast('Primero activa las notificaciones.'); return; }
  await notificar('L.i.s.a.H.W', 'Notificación de prueba: ¡la PWA funciona!', './#inicio');
});

/* ---------- Carga de datos ---------- */
async function cargarDatos(forzar = false) {
  try {
    const r = await fetch('noticias.json', forzar ? { cache: 'no-cache' } : undefined);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    DATOS = await r.json();
    return true;
  } catch (e) {
    console.warn('[PWA] No se pudo cargar noticias.json', e);
    toast('No se pudieron cargar las noticias.');
    return false;
  }
}

const tarjeta = (n, extra = '') => `
  <article class="tarjeta">
    <span class="etiqueta">${escapar(n.categoria || 'General')}</span>
    <h4>${escapar(n.titulo)}</h4>
    <p>${escapar(n.resumen)}</p>
    <small>${escapar(n.fecha || '')}</small>${extra}
  </article>`;

/* ===== AXEL: tarjetas desde JSON + botón actualizar (requiere conexión) ===== */
function pintarAxel() {
  $('#axelLista').innerHTML = DATOS.axel.map((n) => tarjeta(n)).join('');
  $('#axelActualizado').textContent = 'Última actualización: ' + new Date().toLocaleTimeString('es-MX');
}
$('#btnActualizar').addEventListener('click', async () => {
  if (!navigator.onLine) {
    toast('Actualizar requiere conexión. Se muestran las noticias guardadas.');
    return;
  }
  const antes = DATOS.axel.length;
  if (!(await cargarDatos(true))) return;
  pintarAxel(); pintarCarrusel(); pintarJuan();
  toast('Contenido de Axel actualizado');
  if (DATOS.axel.length > antes) {
    notificar('Noticias nuevas', `Hay ${DATOS.axel.length - antes} noticia(s) nueva(s) en Tecnología.`, './#axel');
  }
});

/* ===== OMAR: carrusel automático ===== */
let carIndice = 0, carTimer = null;
function pintarCarrusel() {
  const lista = DATOS.omar;
  if (!lista.length) return;
  carIndice = (carIndice + lista.length) % lista.length;
  const n = lista[carIndice];
  $('#carruselItem').innerHTML = `
    <span class="etiqueta">${escapar(n.categoria)}</span>
    <h3>${escapar(n.titulo)}</h3>
    <p>${escapar(n.resumen)}</p>
    <small>${escapar(n.fecha)}</small>`;
  $('#carPuntos').innerHTML = lista.map((_, i) => `<button class="punto ${i === carIndice ? 'activo' : ''}" data-i="${i}" aria-label="Noticia ${i + 1}"></button>`).join('');
}
function iniciarAutoCarrusel() { detenerAutoCarrusel(); carTimer = setInterval(() => { carIndice++; pintarCarrusel(); }, 5000); }
function detenerAutoCarrusel() { clearInterval(carTimer); }
$('#carPrev').addEventListener('click', () => { carIndice--; pintarCarrusel(); iniciarAutoCarrusel(); });
$('#carNext').addEventListener('click', () => { carIndice++; pintarCarrusel(); iniciarAutoCarrusel(); });
$('#carPuntos').addEventListener('click', (e) => {
  const p = e.target.closest('.punto');
  if (p) { carIndice = Number(p.dataset.i); pintarCarrusel(); iniciarAutoCarrusel(); }
});

/* ===== JUAN: buscador + filtros por categoría ===== */
let juanCategoria = 'Todas';
function pintarJuan() {
  const cats = ['Todas', ...new Set(DATOS.juan.map((n) => n.categoria))];
  $('#juanFiltros').innerHTML = cats.map((c) => `<button class="chip ${c === juanCategoria ? 'activo' : ''}" data-cat="${escapar(c)}">${escapar(c)}</button>`).join('');
  const q = $('#juanBuscar').value.trim().toLowerCase();
  const res = DATOS.juan.filter((n) =>
    (juanCategoria === 'Todas' || n.categoria === juanCategoria) &&
    (n.titulo + ' ' + n.resumen).toLowerCase().includes(q));
  $('#juanLista').innerHTML = res.map((n) => `
    <li><span class="etiqueta">${escapar(n.categoria)}</span>
      <h4>${escapar(n.titulo)}</h4><p>${escapar(n.resumen)}</p><small>${escapar(n.fecha)}</small></li>`).join('');
  $('#juanVacio').hidden = res.length > 0;
}
$('#juanBuscar').addEventListener('input', pintarJuan);
$('#juanFiltros').addEventListener('click', (e) => {
  const c = e.target.closest('.chip');
  if (c) { juanCategoria = c.dataset.cat; pintarJuan(); }
});

/* ===== AMANDA: publicar noticias (localStorage) ===== */
const CLAVE_AMANDA = 'lisahw_amanda';
function leerAmanda() {
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE_AMANDA));
    if (Array.isArray(g)) return g;
  } catch { /* ignorar */ }
  return [...DATOS.amanda];
}
function guardarAmanda(lista) {
  try { localStorage.setItem(CLAVE_AMANDA, JSON.stringify(lista)); } catch { /* ignorar */ }
}
let listaAmanda = [];
function pintarAmanda() {
  $('#amandaLista').innerHTML = listaAmanda.map((n) =>
    tarjeta(n, `<br><button class="btn btn-borrar" data-id="${escapar(n.id)}">Eliminar</button>`)).join('')
    || '<p class="nota">Aún no hay noticias. ¡Publica la primera!</p>';
}
$('#formNoticia').addEventListener('submit', async (e) => {
  e.preventDefault();
  const titulo = $('#amTitulo').value.trim();
  const resumen = $('#amResumen').value.trim();
  if (!titulo || !resumen) return;
  const nueva = { id: 'm' + Date.now(), titulo, resumen, categoria: 'Cultura', fecha: new Date().toISOString().slice(0, 10) };
  listaAmanda = [nueva, ...listaAmanda];
  guardarAmanda(listaAmanda);
  pintarAmanda();
  e.target.reset();
  toast('Noticia publicada');
  await notificar('Nueva noticia de Amanda', titulo, './#amanda');
});
$('#amandaLista').addEventListener('click', (e) => {
  const b = e.target.closest('.btn-borrar');
  if (!b) return;
  listaAmanda = listaAmanda.filter((n) => n.id !== b.dataset.id);
  guardarAmanda(listaAmanda);
  pintarAmanda();
});

/* ===== REPORTES: geolocalización (Geolocation API) + foto (input capture) ===== */
const CLAVE_REPORTES = 'lisahw_reportes';
let listaReportes = [];
let ubicacionActual = null; // { lat, lon, precision }
let fotoActual = null;      // dataURL reducida

function leerReportes() {
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE_REPORTES));
    if (Array.isArray(g)) return g;
  } catch { /* ignorar */ }
  return [];
}
function guardarReportes() {
  try { localStorage.setItem(CLAVE_REPORTES, JSON.stringify(listaReportes)); return true; }
  catch { return false; } // cuota llena o almacenamiento bloqueado
}

async function actualizarEstadoGeo() {
  const el = $('#estadoGeo');
  if (!('geolocation' in navigator)) { el.textContent = 'no soportada en este navegador'; return; }
  if (!navigator.permissions || !navigator.permissions.query) { el.textContent = 'disponible (permiso se pide al usarla)'; return; }
  try {
    const p = await navigator.permissions.query({ name: 'geolocation' });
    const txt = { granted: 'permitida ✔', denied: 'bloqueada ✖ (actívala en el candado de la barra)', prompt: 'se pedirá permiso al usarla' };
    el.textContent = txt[p.state] || p.state;
    p.onchange = actualizarEstadoGeo;
  } catch { el.textContent = 'disponible (permiso se pide al usarla)'; }
}

function mensajeErrorGeo(err) {
  if (!window.isSecureContext) return 'La ubicación solo funciona en HTTPS o localhost.';
  switch (err && err.code) {
    case 1: return 'Permiso de ubicación denegado. Actívalo en el candado de la barra de direcciones y vuelve a intentarlo.';
    case 2: return 'No se pudo determinar tu posición (señal GPS o red no disponible).';
    case 3: return 'La búsqueda de ubicación tardó demasiado. Inténtalo de nuevo.';
    default: return (err && err.message) || 'Error desconocido al obtener la ubicación.';
  }
}

function obtenerUbicacion() {
  return new Promise((resolver, rechazar) => {
    if (!('geolocation' in navigator)) { rechazar({ code: 0, message: 'Este navegador no soporta geolocalización.' }); return; }
    navigator.geolocation.getCurrentPosition(resolver, rechazar, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  });
}

$('#btnUbicacion').addEventListener('click', async () => {
  const msg = $('#repUbicacion');
  const btn = $('#btnUbicacion');
  btn.disabled = true;
  msg.className = 'nota';
  msg.textContent = 'Obteniendo ubicación… acepta el permiso si el navegador lo solicita.';
  try {
    const pos = await obtenerUbicacion();
    ubicacionActual = { lat: pos.coords.latitude, lon: pos.coords.longitude, precision: Math.round(pos.coords.accuracy) };
    msg.className = 'nota msg-ok';
    msg.textContent = `✔ Ubicación obtenida: ${ubicacionActual.lat.toFixed(5)}, ${ubicacionActual.lon.toFixed(5)} (±${ubicacionActual.precision} m)`;
  } catch (err) {
    ubicacionActual = null;
    msg.className = 'nota msg-error';
    msg.textContent = '✖ ' + mensajeErrorGeo(err);
  } finally {
    btn.disabled = false;
    actualizarEstadoGeo();
  }
});

// Foto: se reduce a 480 px y JPEG 60% para ocupar poco en localStorage
$('#repFoto').addEventListener('change', (e) => {
  const archivo = e.target.files && e.target.files[0];
  const vista = $('#repVista');
  fotoActual = null;
  vista.hidden = true;
  if (!archivo) return;
  if (!archivo.type.startsWith('image/')) { toast('El archivo seleccionado no es una imagen.'); e.target.value = ''; return; }
  const url = URL.createObjectURL(archivo);
  const img = new Image();
  img.onload = () => {
    const escala = Math.min(1, 480 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * escala);
    c.height = Math.round(img.height * escala);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    fotoActual = c.toDataURL('image/jpeg', 0.6);
    vista.src = fotoActual;
    vista.hidden = false;
    URL.revokeObjectURL(url);
  };
  img.onerror = () => { toast('No se pudo leer la imagen.'); URL.revokeObjectURL(url); };
  img.src = url;
});

function urlMapa(u) {
  return `https://www.openstreetmap.org/?mlat=${u.lat}&mlon=${u.lon}#map=17/${u.lat}/${u.lon}`;
}

function pintarReportes() {
  const cont = $('#repLista');
  if (!cont) return;
  const online = navigator.onLine;
  cont.innerHTML = listaReportes.map((r) => `
    <article class="tarjeta">
      <span class="etiqueta">Reporte</span>
      <h4>${escapar(r.titulo)}</h4>
      <p>${escapar(r.descripcion)}</p>
      ${r.foto ? `<img class="foto" src="${r.foto}" alt="Foto del reporte">` : ''}
      ${r.ubicacion
        ? `<span class="coords">📍 ${r.ubicacion.lat.toFixed(5)}, ${r.ubicacion.lon.toFixed(5)} (±${r.ubicacion.precision} m)</span>
           <a class="enlace-mapa ${online ? '' : 'sin-red'}" data-mapa href="${urlMapa(r.ubicacion)}" target="_blank" rel="noopener">${online ? 'Ver en el mapa ↗' : 'Ver en el mapa (requiere conexión)'}</a>`
        : '<small>Sin ubicación</small>'}
      <br><small>${escapar(r.fecha)}</small>
      <br><button class="btn btn-borrar" data-id="${escapar(r.id)}">Eliminar</button>
    </article>`).join('') || '<p class="nota">Aún no hay reportes guardados.</p>';
}

$('#repLista').addEventListener('click', (e) => {
  const mapa = e.target.closest('[data-mapa]');
  if (mapa && !navigator.onLine) {
    e.preventDefault();
    toast('Ver el mapa requiere conexión a internet. Las coordenadas sí están guardadas.');
    return;
  }
  const b = e.target.closest('.btn-borrar');
  if (!b) return;
  listaReportes = listaReportes.filter((r) => r.id !== b.dataset.id);
  guardarReportes();
  pintarReportes();
});

$('#formReporte').addEventListener('submit', async (e) => {
  e.preventDefault();
  const titulo = $('#repTitulo').value.trim();
  const descripcion = $('#repDescripcion').value.trim();
  if (!titulo || !descripcion) return;
  const nuevo = {
    id: 'r' + Date.now(), titulo, descripcion,
    ubicacion: ubicacionActual, foto: fotoActual,
    fecha: new Date().toLocaleString('es-MX'),
  };
  listaReportes = [nuevo, ...listaReportes];
  if (!guardarReportes()) {
    listaReportes = listaReportes.slice(1);
    toast('No hay espacio para guardar el reporte (prueba sin foto o elimina reportes).', 5000);
    return;
  }
  pintarReportes();
  e.target.reset();
  ubicacionActual = null; fotoActual = null;
  $('#repVista').hidden = true;
  $('#repUbicacion').className = 'nota';
  $('#repUbicacion').textContent = 'Aún no se ha obtenido la ubicación.';
  toast(navigator.onLine ? 'Reporte guardado' : 'Reporte guardado sin conexión en tu dispositivo');
  await notificar('Reporte guardado', titulo, './#reportes');
});

/* ---------- Arranque ---------- */
async function iniciar() {
  actualizarRed();
  actualizarEstadoNotif();
  actualizarEstadoGeo();
  registrarSW();
  await cargarDatos();
  pintarAxel();
  pintarCarrusel();
  pintarJuan();
  listaAmanda = leerAmanda();
  pintarAmanda();
  listaReportes = leerReportes();
  pintarReportes();
  mostrarVista();
}
iniciar();
