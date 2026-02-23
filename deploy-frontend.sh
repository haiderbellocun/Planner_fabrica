#!/usr/bin/env bash
# Manual frontend deploy to Google Cloud Storage
#
# Usage:
#   API_URL=https://taskflow-api-xxx.run.app \
#   GCS_BUCKET=gs://taskflow-frontend \
#   ./deploy-frontend.sh
#
# Prerequisites:
#   - gcloud CLI authenticated (gcloud auth login)
#   - gsutil available (comes with gcloud SDK)
#   - Node 20+

set -euo pipefail

# ── Configuration ──────────────────────────────────────────────────────────────
API_URL="${API_URL:?'ERROR: Set API_URL to your Cloud Run backend URL (e.g. https://taskflow-api-xxx.run.app)'}"
GCS_BUCKET="${GCS_BUCKET:?'ERROR: Set GCS_BUCKET to your GCS bucket (e.g. gs://taskflow-frontend)'}"
BUILD_DIR="dist"

echo "════════════════════════════════════════════════"
echo " TaskFlow — Frontend Deploy to GCS"
echo "════════════════════════════════════════════════"
echo " API URL : $API_URL"
echo " Bucket  : $GCS_BUCKET"
echo "════════════════════════════════════════════════"
echo ""

# ── Install dependencies ───────────────────────────────────────────────────────
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm ci
fi

# ── Build ──────────────────────────────────────────────────────────────────────
echo "🏗  Building frontend (VITE_API_URL=$API_URL)..."
VITE_API_URL="$API_URL" npm run build

# ── Upload to GCS ──────────────────────────────────────────────────────────────
echo ""
echo "🚀 Uploading $BUILD_DIR/ → $GCS_BUCKET ..."
gsutil -m rsync -r -d "$BUILD_DIR/" "$GCS_BUCKET"

# ── Cache headers ──────────────────────────────────────────────────────────────
echo ""
echo "📋 Setting cache headers..."

# Hashed asset files (JS/CSS/images) — immutable, cache 1 year
gsutil -m setmeta \
  -h "Cache-Control:public, max-age=31536000, immutable" \
  "${GCS_BUCKET}/assets/**" 2>/dev/null || true

# index.html — must never be cached so users always get the latest
gsutil setmeta \
  -h "Cache-Control:no-cache, no-store, must-revalidate" \
  "${GCS_BUCKET}/index.html"

# ── Done ───────────────────────────────────────────────────────────────────────
echo ""
echo "✅ Frontend deployed successfully!"
echo ""
echo "Next steps (if first deploy):"
echo "  1. Enable public access on the bucket:"
echo "     gsutil iam ch allUsers:objectViewer $GCS_BUCKET"
echo ""
echo "  2. Configure the bucket as a website:"
echo "     gsutil web set -m index.html -e index.html $GCS_BUCKET"
echo ""
echo "  3. For SPA routing (all paths → index.html), set the error page:"
echo "     gsutil web set -m index.html -e index.html $GCS_BUCKET"
