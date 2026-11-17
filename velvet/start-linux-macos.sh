#!/usr/bin/env bash
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "${DIR}/index.html"
elif command -v open >/dev/null 2>&1; then
  open "${DIR}/index.html"
else
  echo "Open ${DIR}/index.html in a WebGL 2-compatible browser."
fi
