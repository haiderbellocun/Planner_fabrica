#!/usr/bin/env bash
# GCP infrastructure setup for TaskFlow Planner
#
# Run once to provision all cloud resources before the first deploy.
# Safe to re-run — existing resources are skipped.
#
# Usage:
#   PROJECT_ID=my-gcp-project \
#   REGION=us-central1 \
#   ./setup-gcp.sh
#
# Prerequisites:
#   - gcloud CLI installed and authenticated
#   - Billing enabled on the project
#   - Owner or Editor role on the project

set -euo pipefail

# ── Required variables ─────────────────────────────────────────────────────────
PROJECT_ID="${PROJECT_ID:?'ERROR: Set PROJECT_ID (e.g. my-gcp-project)'}"
REGION="${REGION:-us-central1}"

# ── Derived names ──────────────────────────────────────────────────────────────
ARTIFACT_REPO="taskflow-images"
CLOUD_RUN_SERVICE="taskflow-api"
GCS_BUCKET="gs://${PROJECT_ID}-taskflow-frontend"
SQL_INSTANCE="taskflow-db"
SQL_DATABASE="taskflow"
SQL_USER="taskflow"

echo "════════════════════════════════════════════════"
echo " TaskFlow — GCP Setup"
echo "════════════════════════════════════════════════"
echo " Project : $PROJECT_ID"
echo " Region  : $REGION"
echo "════════════════════════════════════════════════"
echo ""

# ── Set default project ────────────────────────────────────────────────────────
gcloud config set project "$PROJECT_ID"

# ── Enable required APIs ───────────────────────────────────────────────────────
echo "🔌 Enabling APIs..."
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  storage.googleapis.com \
  iam.googleapis.com \
  --quiet

# ── Artifact Registry ──────────────────────────────────────────────────────────
echo ""
echo "📦 Creating Artifact Registry repository..."
gcloud artifacts repositories create "$ARTIFACT_REPO" \
  --repository-format=docker \
  --location="$REGION" \
  --description="TaskFlow Docker images" \
  --quiet 2>/dev/null || echo "   ✓ Already exists"

# Configure Docker to authenticate with Artifact Registry
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

# ── Cloud SQL ─────────────────────────────────────────────────────────────────
echo ""
echo "🗄  Creating Cloud SQL instance (PostgreSQL 15)..."
echo "   This can take several minutes on first run..."
gcloud sql instances create "$SQL_INSTANCE" \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region="$REGION" \
  --storage-auto-increase \
  --storage-size=10GB \
  --backup-start-time=03:00 \
  --quiet 2>/dev/null || echo "   ✓ Already exists"

echo "   Creating database..."
gcloud sql databases create "$SQL_DATABASE" \
  --instance="$SQL_INSTANCE" \
  --quiet 2>/dev/null || echo "   ✓ Already exists"

echo "   Creating database user..."
SQL_PASSWORD="$(openssl rand -base64 24)"
gcloud sql users create "$SQL_USER" \
  --instance="$SQL_INSTANCE" \
  --password="$SQL_PASSWORD" \
  --quiet 2>/dev/null && \
  echo "   ⚠  Save this password — it will NOT be shown again:" && \
  echo "      $SQL_USER password: $SQL_PASSWORD" || \
  echo "   ✓ User already exists (password unchanged)"

# ── Secret Manager ────────────────────────────────────────────────────────────
echo ""
echo "🔐 Creating secrets in Secret Manager..."

# Helper: create secret if it doesn't exist
create_secret() {
  local name="$1"
  local value="$2"
  if gcloud secrets describe "$name" --quiet >/dev/null 2>&1; then
    echo "   ✓ Secret '$name' already exists"
  else
    echo -n "$value" | gcloud secrets create "$name" \
      --data-file=- \
      --replication-policy=automatic \
      --quiet
    echo "   ✓ Created secret '$name'"
  fi
}

JWT_SECRET_VAL="$(openssl rand -base64 64)"
DATABASE_URL_VAL="postgresql://${SQL_USER}:${SQL_PASSWORD:-CHANGE_ME}@/${SQL_DATABASE}?host=/cloudsql/${PROJECT_ID}:${REGION}:${SQL_INSTANCE}"
FRONTEND_URL="https://storage.googleapis.com/${PROJECT_ID}-taskflow-frontend"

create_secret "jwt-secret"    "$JWT_SECRET_VAL"
create_secret "database-url"  "$DATABASE_URL_VAL"
create_secret "cors-origin"   "$FRONTEND_URL"
create_secret "vite-api-url"  "https://CHANGE_ME_AFTER_FIRST_CLOUD_RUN_DEPLOY.run.app"

echo ""
echo "   ⚠  After first Cloud Run deploy, update 'vite-api-url' with the real URL:"
echo "      gcloud secrets versions add vite-api-url --data-file=- <<< 'https://your-service-xxx.run.app'"

# ── GCS Bucket (frontend) ─────────────────────────────────────────────────────
echo ""
echo "🪣 Creating GCS bucket for frontend..."
gsutil mb -l "$REGION" "$GCS_BUCKET" 2>/dev/null || echo "   ✓ Already exists"

# Make bucket publicly readable (needed for website hosting)
gsutil iam ch allUsers:objectViewer "$GCS_BUCKET"

# Configure as static website — all paths route through index.html for SPA
gsutil web set -m index.html -e index.html "$GCS_BUCKET"

# ── Cloud Build Service Account permissions ───────────────────────────────────
echo ""
echo "🔑 Granting Cloud Build SA permissions..."
CB_SA="${PROJECT_ID}@cloudbuild.gserviceaccount.com"

for role in \
  roles/run.admin \
  roles/iam.serviceAccountUser \
  roles/secretmanager.secretAccessor \
  roles/storage.objectAdmin \
  roles/artifactregistry.writer \
  roles/cloudsql.client; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${CB_SA}" \
    --role="$role" \
    --quiet >/dev/null
  echo "   ✓ $role"
done

# ── Cloud Run Service Account ─────────────────────────────────────────────────
echo ""
echo "🤖 Creating Cloud Run service account..."
CR_SA="taskflow-api-sa@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud iam service-accounts create "taskflow-api-sa" \
  --display-name="TaskFlow API Service Account" \
  --quiet 2>/dev/null || echo "   ✓ Already exists"

for role in \
  roles/secretmanager.secretAccessor \
  roles/cloudsql.client; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${CR_SA}" \
    --role="$role" \
    --quiet >/dev/null
  echo "   ✓ $role → $CR_SA"
done

# ── Connect Cloud Build to repository ────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════"
echo " ✅ Setup complete!"
echo "════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "  1. Connect your GitHub repo to Cloud Build:"
echo "     https://console.cloud.google.com/cloud-build/triggers"
echo ""
echo "  2. Create a trigger for 'push to main' using cloudbuild.yaml"
echo "     Set substitution variables:"
echo "       _REGION          = $REGION"
echo "       _ARTIFACT_REGISTRY = $ARTIFACT_REPO"
echo "       _CLOUD_RUN_SERVICE = $CLOUD_RUN_SERVICE"
echo "       _GCS_BUCKET      = $GCS_BUCKET"
echo "       _CLOUD_SQL_INSTANCE = $SQL_INSTANCE"
echo ""
echo "  3. Run database migrations:"
echo "     node database/migrate.js"
echo ""
echo "  4. After first deploy, update vite-api-url secret with the real Cloud Run URL"
