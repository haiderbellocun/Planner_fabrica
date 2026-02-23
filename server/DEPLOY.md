# Deploy backend en Google Cloud Run

## Ubicación del Dockerfile

- **Ruta:** `server/Dockerfile`
- **Contexto de build:** `server/` (no la raíz del repo).

## Entrypoint

- **Archivo que se ejecuta al final:** `dist/index.js`
- **Comando:** `node dist/index.js` (ver `CMD` en el Dockerfile).
- La app usa `config/env.ts` y lee `process.env.PORT`; Cloud Run inyecta `PORT=8080`.

## Probar en local

Desde la raíz del repo (o desde `server/` si tu `.env` está ahí):

```bash
# Build (contexto = server/)
docker build -t planner-api ./server

# Run (mapear 8080 y pasar env; ajusta --env-file si tu .env está en otra ruta)
docker run -p 8080:8080 --env-file server/.env planner-api
```

Si no tienes `server/.env`, pasa las variables a mano:

```bash
docker run -p 8080:8080 \
  -e NODE_ENV=production \
  -e PORT=8080 \
  -e JWT_SECRET=tu-secreto-min-8-chars \
  -e CORS_ORIGIN=http://localhost:5173 \
  -e PGHOST=host.docker.internal \
  -e PGPORT=5432 \
  -e PGDATABASE=tu_db \
  -e PGUSER=postgres \
  -e PGPASSWORD=tu_password \
  planner-api
```

Comprobar:

- `curl http://localhost:8080/healthz`
- `curl http://localhost:8080/readyz`

## Deploy a Cloud Run (gcloud)

Sustituye `TU_PROYECTO` y `TU_REGION` (ej. `us-central1`). Imagen en Artifact Registry o Container Registry.

**Opción A – Build y push con Cloud Build, luego deploy:**

```bash
# Configurar proyecto
gcloud config set project TU_PROYECTO

# Build y push (reemplaza REGION y REPO con los tuyos, ej. us-central1 y planner)
gcloud builds submit --tag gcr.io/TU_PROYECTO/planner-api ./server

# Deploy (env vars se configuran en la consola o con --set-env-vars)
gcloud run deploy planner-api \
  --image gcr.io/TU_PROYECTO/planner-api \
  --region TU_REGION \
  --platform managed \
  --allow-unauthenticated
```

**Opción B – Deploy con env vars por línea:**

```bash
gcloud run deploy planner-api \
  --image gcr.io/TU_PROYECTO/planner-api \
  --region TU_REGION \
  --platform managed \
  --set-env-vars "NODE_ENV=production,PORT=8080,CORS_ORIGIN=https://tu-front.com" \
  --set-secrets "JWT_SECRET=jwt-secret:latest,DATABASE_URL=db-url:latest" \
  --allow-unauthenticated
```

Para secretos (JWT_SECRET, DATABASE_URL) es mejor usar **Secret Manager** y referenciarlos con `--set-secrets` como arriba.

## Variables de entorno en Cloud Run

Configurar en la consola (Cloud Run → servicio → Edit & deploy → Variables and secrets) o con `--set-env-vars` / `--set-secrets`.

| Variable        | Obligatoria | Descripción |
|----------------|-------------|-------------|
| `NODE_ENV`     | No          | `production` en Cloud Run. |
| `PORT`         | No          | Cloud Run lo fija (8080). |
| `JWT_SECRET`   | **Sí**      | Mínimo 8 caracteres. Usar Secret Manager. |
| `JWT_EXPIRES_IN` | No        | Ej. `7d`. |
| `CORS_ORIGIN`  | **Sí**      | Origen del frontend (ej. `https://tu-app.web.app`). |
| `DATABASE_URL` | **Sí***     | URL de conexión Postgres (Cloud SQL). *O bien todas las PG* below. |
| `PGHOST`       | *           | Si no usas DATABASE_URL. |
| `PGPORT`       | *           | Si no usas DATABASE_URL. |
| `PGDATABASE`   | *           | Si no usas DATABASE_URL. |
| `PGUSER`       | *           | Si no usas DATABASE_URL. |
| `PGPASSWORD`   | *           | Si no usas DATABASE_URL. |

\* O bien `DATABASE_URL` o bien las cinco variables `PG*`. No incluir secretos en la imagen; usar Secret Manager o Variables secretas de Cloud Run.
