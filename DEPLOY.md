# Despliegue del frontend (Cloud Storage + Cloud Run)

Frontend en **Google Cloud Storage**; API y avatares en **Cloud Run**.

## Requisitos

- **`.env.production`** en la raíz del frontend con la URL del backend:

  ```env
  VITE_API_URL=https://planner-api-688781705159.us-central1.run.app
  ```

- **gsutil** instalado y autenticado (`gcloud auth login` + acceso al bucket).

---

## 1. VITE_API_URL en el frontend

En **`src/lib/api.ts`** la base del API se lee así:

```ts
export const apiBaseUrl = import.meta.env.VITE_API_URL ?? '';
```

En `vite build` (modo production), Vite sustituye `import.meta.env.VITE_API_URL` por el valor de **`.env.production`**.

---

## 2. Avatares: buildAvatarSrc

- **`src/lib/avatar.ts`** define `buildAvatarSrc(avatar_url)`: convierte rutas relativas `/avatars/...` en URLs absolutas usando `apiBaseUrl` (VITE_API_URL).
- **`src/components/ui/avatar.tsx`** usa `buildAvatarSrc` en todo `<AvatarImage src={...}>`, así que no hace falta tocar cada página.

En producción, todas las `src` tipo `/avatars/xxx.png` se convierten en  
`https://planner-api-688781705159.us-central1.run.app/avatars/xxx.png`.

---

## 3. Imágenes en src/assets

Las imágenes en **`src/assets/`** (importadas con `import ... from '@/assets/...'`) las incluye Vite en el build y quedan en **`dist/assets/`** con nombre hasheado. No hace falta configuración extra.

---

## 4. Comandos de build y deploy

Desde la **raíz del frontend** (donde está `package.json`):

### Build

```bash
npm run build
```

### Deploy al bucket (solo rsync)

```bash
gsutil -m rsync -r -d dist gs://it-fab-contenido-edu-1-planner-web
```

### Deploy completo (recomendado): build + rsync + headers de cache

Para que los cambios se reflejen al abrir la app y que los assets se cacheen bien:

```bash
npm run deploy
```

El script hace:

1. `npm run build`
2. `gsutil -m rsync -r -d dist gs://it-fab-contenido-edu-1-planner-web`
3. **index.html**: `Cache-Control: no-cache, max-age=0` → el navegador siempre revalida y obtiene el último `index.html` (con los hashes de JS/CSS nuevos).
4. **assets/\***: `Cache-Control: public, max-age=31536000, immutable` → cache largo (1 año); como los nombres tienen hash, es seguro.

Así el navegador deja de servir una versión vieja de `index.html` que apuntaba a JS/CSS antiguos.

---

## 5. Por qué el deploy no se veía: cache

Si tras hacer deploy abrías la URL y seguías viendo la versión vieja:

- **index.html** estaba cacheado (navegador o CDN) y seguía referenciando `assets/index-XXXXX.js` antiguos.
- Aunque en el bucket ya estuvieran los archivos nuevos, el navegador seguía usando el `index.html` viejo en cache.

**Solución:** aplicar a `index.html` `Cache-Control: no-cache, max-age=0` tras cada deploy (lo hace `npm run deploy`). Así siempre se pide el `index.html` actualizado y este apunta a los assets con hash nuevo.

---

## 6. Verificar que el bucket tiene lo último

Después del deploy, comprobar fechas y tamaños:

```bash
gsutil ls -l gs://it-fab-contenido-edu-1-planner-web/
gsutil ls -l gs://it-fab-contenido-edu-1-planner-web/assets/
```

Compara con el contenido local de `dist/` (p. ej. fecha de `dist/index.html` y `dist/assets/index-*.js`). Las fechas del bucket deberían ser recientes.

Comprobar headers de cache en un objeto:

```bash
gsutil stat gs://it-fab-contenido-edu-1-planner-web/index.html
gsutil stat gs://it-fab-contenido-edu-1-planner-web/assets/index-*.js
```

Deben verse `Cache-Control: no-cache, max-age=0` en `index.html` y `Cache-Control: public, max-age=31536000, immutable` en los de `assets/`.

---

## 7. URL correcta para abrir la app

- **Recomendada (raíz, sin `index.html`):**  
  **https://storage.googleapis.com/it-fab-contenido-edu-1-planner-web/**  

  Si el bucket está configurado como “sitio web” (main page = `index.html`), esa URL sirve `index.html`. Si no, usa la siguiente.

- **Alternativa explícita:**  
  **https://storage.googleapis.com/it-fab-contenido-edu-1-planner-web/index.html**

Usa la raíz (con la barra final) cuando puedas para que sea la URL canónica de la app.

---

## 8. Validar en DevTools que los assets vienen del bucket actualizado

1. Abre la app con **https://storage.googleapis.com/it-fab-contenido-edu-1-planner-web/** (o la URL que uses).
2. **DevTools** (F12) → pestaña **Network**.
3. Recarga (Ctrl+F5 o “Empty cache and hard reload” si quieres evitar cache local).
4. Filtra por **JS** o **Doc**:
   - **Doc:** la primera petición debe ser `index.html` a `storage.googleapis.com/.../index.html` (o `/`) con status 200.
   - **JS/CSS:** las de `index-*.js` y `index-*.css` deben ser a `storage.googleapis.com/.../assets/index-XXXXX.js` (y el hash debe coincidir con los archivos de tu `dist/assets/` actual).
5. En una de esas peticiones (p. ej. `index.html`), en **Headers** → **Response Headers** deberías ver algo como `Cache-Control: no-cache, max-age=0` para `index.html` y `Cache-Control: public, max-age=31536000, immutable` para los de `assets/`.

Si los hashes de los JS/CSS en Network coinciden con los de tu `dist/assets/` recién desplegado, el navegador está cargando la versión actualizada del bucket.

---

## 9. Validar en producción que los avatares van a Cloud Run

1. Abrir la app desde la URL del bucket (o el dominio que apunte a ese bucket).
2. **DevTools** (F12) → pestaña **Network**.
3. Recargar y filtrar por `avatars` o por tipo **Img**.
4. Comprobar las peticiones de avatares:
   - **Correcto:**  
     `https://planner-api-688781705159.us-central1.run.app/avatars/...`  
     (dominio Cloud Run).
   - **Incorrecto:**  
     `https://storage.googleapis.com/.../avatars/...` o la URL del dominio del bucket.

Si el host de las imágenes de avatar es **planner-api-688781705159.us-central1.run.app**, el frontend está usando bien `VITE_API_URL` y los avatares se piden al Cloud Run, no al bucket.
