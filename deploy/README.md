# Alibaba Cloud deployment

This directory migrates PerspeakAI from a hand-copied server directory to
immutable, rollback-safe releases managed by GitHub Actions.

## Design

- GitHub Actions tests with Python 3.11, builds Linux wheels, and sends a
  release archive to the server over SSH.
- The server never fetches from GitHub. This is intentional because the
  production server cannot currently access GitHub reliably.
- Each release has its own virtual environment. The `/opt/apps/perspeak-current`
  symlink selects the source and dependencies used by systemd.
- `/etc/perspeak-ai.env` and `/var/lib/perspeak` stay in place; no secret or
  user data is copied into the repository or a release archive.
- A failed restart or HTTP health check restores the prior symlink and restarts
  the prior release.

## One-time server setup

1. Create an Ed25519 SSH key pair on a trusted local computer. Its public key
   is installed for the existing `admin` server user; its private key is stored
   only in GitHub Actions secrets.
2. Upload `bootstrap-aliyun.sh` and `perspeak-deploy` together to the server,
   along with the public key file. Run:

   ```bash
   sudo bash bootstrap-aliyun.sh /home/admin/perspeak-github-actions.pub
   ```

   This installs a root-owned deployment switcher and grants `admin` passwordless
   sudo for that switcher only. It does not restart PerspeakAI.
3. In the GitHub repository, add these Actions secrets:

   - `DEPLOY_HOST`: server public IP or hostname
   - `DEPLOY_USER`: `admin`
   - `DEPLOY_KNOWN_HOSTS`: the complete output of `ssh-keyscan -H <host>`
   - `DEPLOY_SSH_PRIVATE_KEY`: the full private key, including BEGIN/END lines
4. Run **Deploy PerspeakAI to Alibaba Cloud** manually from the Actions tab.
   Confirm the health check succeeds before setting repository variable
   `PERSPEAK_AUTODEPLOY` to `true`.

## Rollback

The release switcher automatically rolls back a failed deployment. To manually
return to an older release, point `/opt/apps/perspeak-current` at its directory
and restart `perspeak-ai`; do this only with a reviewed operational change.
