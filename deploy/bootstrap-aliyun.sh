#!/usr/bin/env bash
# One-time Alibaba Cloud setup. Run as root on the server:
#   sudo bash bootstrap-aliyun.sh /home/admin/perspeak-github-actions.pub
# The public key file must contain the GitHub Actions deploy key only.
set -Eeuo pipefail

readonly DEPLOY_USER="admin"
readonly DEPLOY_SCRIPT="/usr/local/sbin/perspeak-deploy"

[[ ${EUID} -eq 0 ]] || { echo "Run this script with sudo." >&2; exit 1; }
[[ $# -eq 1 ]] || { echo "Usage: $0 /path/to/perspeak-github-actions.pub" >&2; exit 1; }
[[ -s "$1" ]] || { echo "Public key file is missing or empty." >&2; exit 1; }
id "$DEPLOY_USER" >/dev/null || { echo "User $DEPLOY_USER does not exist." >&2; exit 1; }

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[[ -f "${script_dir}/perspeak-deploy" ]] || { echo "perspeak-deploy must be beside this script." >&2; exit 1; }

install -d -m 0700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/${DEPLOY_USER}/.ssh"
touch "/home/${DEPLOY_USER}/.ssh/authorized_keys"
chown "$DEPLOY_USER:${DEPLOY_USER}" "/home/${DEPLOY_USER}/.ssh/authorized_keys"
chmod 0600 "/home/${DEPLOY_USER}/.ssh/authorized_keys"
grep -qxF "$(cat "$1")" "/home/${DEPLOY_USER}/.ssh/authorized_keys" || cat "$1" >>"/home/${DEPLOY_USER}/.ssh/authorized_keys"

install -m 0750 -o root -g root "${script_dir}/perspeak-deploy" "$DEPLOY_SCRIPT"
sudoers_tmp="$(mktemp)"
printf '%s\n' "${DEPLOY_USER} ALL=(root) NOPASSWD: ${DEPLOY_SCRIPT} *" >"$sudoers_tmp"
visudo -cf "$sudoers_tmp"
install -m 0440 -o root -g root "$sudoers_tmp" /etc/sudoers.d/perspeak-github-actions
rm -f "$sudoers_tmp"

echo "Bootstrap complete. The existing PerspeakAI service was not restarted."
