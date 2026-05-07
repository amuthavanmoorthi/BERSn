#!/bin/sh
set -eu

cat > /usr/share/nginx/html/env.js <<EOF
window.__BERSN_ENV__ = {
  VITE_API_URL: "${VITE_API_URL:-}"
};
EOF
