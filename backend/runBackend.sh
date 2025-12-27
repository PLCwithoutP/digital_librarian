#!/bin/bash
set -euo pipefail

# runBackend.sh (NO pip)
# - Uses only apt/system tools
# - Ensures PDF parsing dependency exists (pypdf or PyPDF2) for year fallback
# - Ensures GROBID is running locally (Docker)
# - Runs parse_pdfs.py using input.json
# - Runs make_bibtex.py to generate bibtex_pdfs.json alongside parsed_pdfs.json

PY="/usr/bin/python3"
GROBID_BASE="http://localhost:8070"
GROBID_IMAGE="grobid/grobid:0.8.2-crf"
GROBID_CONTAINER="grobid"
PARSER_SCRIPT="parse_pdfs.py"
INPUT_JSON="input.json"
BIBTEX_SCRIPT="make_bibtex.py"

cd "$(dirname "$0")"

info() { echo "[INFO] $*"; }
warn() { echo "[WARN] $*" >&2; }
err()  { echo "[ERROR] $*" >&2; }

need_file() {
  [[ -f "$1" ]] || { err "Missing file: $1"; exit 1; }
}

have_cmd() {
  command -v "$1" >/dev/null 2>&1
}

need_sudo() {
  if ! have_cmd sudo; then
    err "sudo is required but not found. Run this script as root or install sudo."
    exit 1
  fi
}

apt_install() {
  need_sudo
  local pkgs=("$@")
  info "Installing via apt: ${pkgs[*]}"
  sudo apt-get update || warn "apt-get update failed (maybe offline). Continuing..."
  sudo apt-get install -y "${pkgs[@]}"
}

python_has_pdf_lib() {
  "$PY" - <<'PY'
try:
    import pypdf
    raise SystemExit(0)
except Exception:
    pass
try:
    import PyPDF2
    raise SystemExit(0)
except Exception:
    raise SystemExit(1)
PY
}

ensure_pdf_lib() {
  if python_has_pdf_lib >/dev/null 2>&1; then
    info "PDF library available (pypdf/PyPDF2)."
    return 0
  fi

  warn "Missing PDF library (pypdf/PyPDF2). Installing via apt..."

  # Prefer python3-pypdf, fallback to python3-pypdf2
  apt_install python3-pypdf || true
  if python_has_pdf_lib >/dev/null 2>&1; then
    info "PDF library installed successfully."
    return 0
  fi

  apt_install python3-pypdf2 || true
  if python_has_pdf_lib >/dev/null 2>&1; then
    info "PDF library installed successfully."
    return 0
  fi

  err "Could not import pypdf or PyPDF2 after apt installs."
  err "Try: sudo apt-cache search pypdf"
  exit 2
}

grobid_is_alive() {
  "$PY" - <<PY
import urllib.request, sys
try:
    urllib.request.urlopen("${GROBID_BASE}/api/isalive", timeout=3).read()
    sys.exit(0)
except Exception:
    sys.exit(1)
PY
}

ensure_docker() {
  if ! have_cmd docker; then
    warn "docker not found. Installing docker.io ..."
    apt_install docker.io
  fi

  # Start service if systemd is present
  if have_cmd systemctl; then
    sudo systemctl start docker || true
  fi
}

ensure_grobid() {
  if grobid_is_alive; then
    info "GROBID already reachable at ${GROBID_BASE}"
    return 0
  fi

  info "GROBID not reachable. Starting Docker container '${GROBID_CONTAINER}'..."

  # Pull image if not present (requires internet the first time)
  if ! sudo docker image inspect "${GROBID_IMAGE}" >/dev/null 2>&1; then
    info "Pulling image ${GROBID_IMAGE} (first time needs internet)..."
    sudo docker pull "${GROBID_IMAGE}"
  fi

  if sudo docker ps -a --format '{{.Names}}' | grep -qx "${GROBID_CONTAINER}"; then
    sudo docker start "${GROBID_CONTAINER}" >/dev/null
  else
    sudo docker run -d --name "${GROBID_CONTAINER}" --restart unless-stopped \
      --init --ulimit core=0 -p 8070:8070 "${GROBID_IMAGE}" >/dev/null
  fi

  info "Waiting for GROBID health..."
  for _ in $(seq 1 60); do
    if grobid_is_alive; then
      info "GROBID is alive at ${GROBID_BASE}"
      return 0
    fi
    sleep 1
  done

  err "GROBID did not become reachable."
  err "Check logs: sudo docker logs --tail=200 ${GROBID_CONTAINER}"
  exit 3
}

main() {
  need_file "$PARSER_SCRIPT"
  need_file "$INPUT_JSON"
  need_file "$BIBTEX_SCRIPT"

  info "Using Python: $PY"
  $PY -V

  # Ensure PDF parsing lib exists (needed for year fallback)
  ensure_pdf_lib

  # Ensure GROBID via Docker
  ensure_docker
  ensure_grobid

  info "Running parser..."
  "$PY" "$PARSER_SCRIPT" --input "$INPUT_JSON" --grobid "$GROBID_BASE"

  info "Creating BibTeX JSON outputs..."
  "$PY" "$BIBTEX_SCRIPT" --input "$INPUT_JSON"
}

main "$@"

