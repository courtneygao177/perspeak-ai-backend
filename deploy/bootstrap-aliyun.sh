#!/usr/bin/env bash
# One-time Alibaba Cloud setup. Run as root on the server:
#   sudo bash bootstrap-aliyun.sh /home/admin/perspeak-github-actions.pub
# The public key file must contain the GitHub Actions deploy key only.
set -Eeuo pipefail

readonly DEPLOY_USER="admin"
readonly DEPLOY_SCRIPT="/usr/local/sbin/perspeak-deploy"
readonly STAGING_DEPLOY_SCRIPT="/usr/local/sbin/perspeak-staging-deploy"
readonly STAGING_USER="perspeak-staging"
readonly STAGING_ENV_FILE="/etc/perspeak-staging.env"
readonly STAGING_DATA_DIR="/var/lib/perspeak-staging"
readonly STAGING_SERVICE="perspeak-staging.service"
readonly STAGING_NGINX_CONFIG="/etc/nginx/conf.d/perspeak-staging.conf"

[[ ${EUID} -eq 0 ]] || { echo "Run this script with sudo." >&2; exit 1; }
[[ $# -eq 1 ]] || { echo "Usage: $0 /path/to/perspeak-github-actions.pub" >&2; exit 1; }
[[ -s "$1" ]] || { echo "Public key file is missing or empty." >&2; exit 1; }
id "$DEPLOY_USER" >/dev/null || { echo "User $DEPLOY_USER does not exist." >&2; exit 1; }

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[[ -f "${script_dir}/perspeak-deploy" ]] || { echo "perspeak-deploy must be beside this script." >&2; exit 1; }
[[ -f "${script_dir}/perspeak-staging-deploy" ]] || { echo "perspeak-staging-deploy must be beside this script." >&2; exit 1; }
[[ -f "${script_dir}/perspeak-staging-nginx.conf" ]] || { echo "perspeak-staging-nginx.conf must be beside this script." >&2; exit 1; }

install -d -m 0700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/${DEPLOY_USER}/.ssh"
touch "/home/${DEPLOY_USER}/.ssh/authorized_keys"
chown "$DEPLOY_USER:${DEPLOY_USER}" "/home/${DEPLOY_USER}/.ssh/authorized_keys"
chmod 0600 "/home/${DEPLOY_USER}/.ssh/authorized_keys"
grep -qxF "$(cat "$1")" "/home/${DEPLOY_USER}/.ssh/authorized_keys" || cat "$1" >>"/home/${DEPLOY_USER}/.ssh/authorized_keys"

install -m 0750 -o root -g root "${script_dir}/perspeak-deploy" "$DEPLOY_SCRIPT"
install -m 0750 -o root -g root "${script_dir}/perspeak-staging-deploy" "$STAGING_DEPLOY_SCRIPT"

# The preview environment deliberately has its own Unix account, data folder,
# environment file, TCP port and systemd unit. It can therefore never read or
# modify the production app's local data.
id "$STAGING_USER" >/dev/null 2>&1 || useradd --system --home-dir "$STAGING_DATA_DIR" --shell /sbin/nologin "$STAGING_USER"
install -d -m 0750 -o "$STAGING_USER" -g "$STAGING_USER" "$STAGING_DATA_DIR"

if [[ ! -f "$STAGING_ENV_FILE" ]]; then
  staging_env_tmp="$(mktemp)"
  {
    # Reuse only the API configuration required for preview requests. Generate
    # a distinct session secret and point all persistent preview state at its
    # own directory.
    grep -E '^(UNIFIED_API_KEY|UNIFIED_BASE_URL|ADMIN_EMAIL|SESSION_COOKIE_SECURE)=' /etc/perspeak-ai.env || true
    printf 'SESSION_SECRET=%s\n' "$(openssl rand -hex 32)"
    printf 'PERSPEAK_DATA_DIR=%s\n' "$STAGING_DATA_DIR"
  } >"$staging_env_tmp"
  install -m 0600 -o root -g root "$staging_env_tmp" "$STAGING_ENV_FILE"
  rm -f "$staging_env_tmp"
fi

cat >"/etc/systemd/system/${STAGING_SERVICE}" <<'EOF'
[Unit]
Description=PerspeakAI staging Flask application
After=network.target

[Service]
Type=simple
User=perspeak-staging
Group=perspeak-staging
WorkingDirectory=/opt/apps/perspeak-staging-current/artifacts/ai-presentation
EnvironmentFile=/etc/perspeak-staging.env
ExecStart=/opt/apps/perspeak-staging-current/.venv/bin/gunicorn --workers 2 --threads 2 --bind 127.0.0.1:8001 --timeout 180 --access-logfile - --error-logfile - --no-control-socket app:app
Restart=always
RestartSec=5
UMask=027
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

install -m 0644 -o root -g root "${script_dir}/perspeak-staging-nginx.conf" "$STAGING_NGINX_CONFIG"
nginx -t
systemctl daemon-reload
systemctl enable "$STAGING_SERVICE" >/dev/null
systemctl reload nginx

sudoers_tmp="$(mktemp)"
printf '%s\n' \
  "${DEPLOY_USER} ALL=(root) NOPASSWD: ${DEPLOY_SCRIPT} *" \
  "${DEPLOY_USER} ALL=(root) NOPASSWD: ${STAGING_DEPLOY_SCRIPT} *" >"$sudoers_tmp"
visudo -cf "$sudoers_tmp"
install -m 0440 -o root -g root "$sudoers_tmp" /etc/sudoers.d/perspeak-github-actions
rm -f "$sudoers_tmp"

echo "Bootstrap complete. The production service was not restarted; preview is ready for its first release."
