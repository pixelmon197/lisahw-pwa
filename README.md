# L.i.s.a.H.W · Sistema de Noticias (PWA)

PWA de noticias con modo sin conexión, notificaciones locales, geolocalización y captura de foto.
Equipo: Axel · Omar · Juan · Amanda.

## Ejecutar en local
Los Service Workers solo funcionan en `localhost` o HTTPS (no abriendo el archivo directamente):

```bash
python3 -m http.server 8000
# abrir http://localhost:8000 en Chrome o Edge
```

## Publicar en GitHub Pages (URL pública con HTTPS)
1. Crear un repositorio y subir todos los archivos de esta carpeta a la rama `main`.
2. En GitHub: **Settings → Pages → Branch: main / (root) → Save**.
3. La URL queda como `https://<usuario>.github.io/<repositorio>/` (todas las rutas son relativas, funciona en subcarpetas).

## Estructura
| Archivo | Función |
|---|---|
| `index.html` | App Shell (encabezado, menú web, barra móvil, pie) y todas las vistas |
| `style.css` | Estilos |
| `app.js` | Navegación, registro/actualización del SW, notificaciones, geolocalización, foto y contenidos |
| `sw.js` | Service Worker: precarga, activación, actualización, caché y clic en notificación |
| `manifest.json` | Manifest de la PWA |
| `noticias.json` | Contenido editable de las noticias |
| `icons/` | Iconos 192, 512 y maskable |

## Funciones y conectividad
| Función | Sin conexión | Requiere conexión |
|---|---|---|
| Abrir la app, navegar, leer noticias (Axel, Omar, Juan) | ✔ (caché) | |
| Publicar noticias (Amanda) y guardar reportes con ubicación y foto | ✔ (localStorage) | |
| Botón "Actualizar" noticias, buscar nueva versión de la app | | ✔ (se deshabilita y avisa) |
| Ver la ubicación en el mapa (OpenStreetMap) | | ✔ (avisa con un mensaje) |

## Característica del dispositivo
- **Geolocalización** (`navigator.geolocation.getCurrentPosition`): permiso "Ubicación", solo HTTPS/localhost.
- **Foto**: `<input type="file" accept="image/*" capture="environment">` abre la cámara en el teléfono; en escritorio abre el selector de archivos.

## Notificaciones (locales)
`Notification.requestPermission()` + `registration.showNotification()`. Se muestran al: guardar un reporte, publicar una noticia, recuperar la conexión, encontrar noticias nuevas y al activar las notificaciones.

## Actualizar la app
Cambiar `VERSION` en `sw.js` (ej. `'v4'`). Los usuarios verán el aviso "Hay una nueva versión" y al pulsar **Actualizar** se activa y se borra el caché anterior.

## Limitaciones conocidas
- Las notificaciones **push reales** (servidor + suscripción) no están implementadas; son solo locales.
- Safari/iOS solo permite notificaciones si la PWA está instalada en la pantalla de inicio (iOS 16.4+).
- Los reportes se guardan en `localStorage` (~5 MB): las fotos se reducen a 480 px para ahorrar espacio.
- La precisión de la ubicación depende del dispositivo (GPS en teléfono, Wi-Fi/IP en escritorio).
