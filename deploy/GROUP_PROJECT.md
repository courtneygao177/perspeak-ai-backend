# Group Project module deployment

The Group Project simulator is a Vite/React client plus an Express API. It is
kept separate from the Flask process so its director runtime can remain Node
based, while all three PerspeakAI scenarios share the same public domain.

## Production shape

```text
perspeakai.cn/
  Flask: scenario home, Presentation, Thesis Defense
perspeakai.cn/group-project/
  Vite static build
perspeakai.cn/group-project/api/
  Nginx reverse proxy -> Group Project Express on 127.0.0.1:8787/api/
```

The Nginx locations must use Flask's internal
`/x/group-project-auth` subrequest before serving either the static app or its
API. This keeps a direct `/group-project/` URL behind the existing PerspeakAI
login instead of exposing a paid model endpoint to anonymous traffic.

## Build variables

Build the client from `artifacts/group-project` with:

```bash
GROUP_PROJECT_BASE=/group-project/ \
VITE_GROUP_PROJECT_API_BASE=/group-project/api \
npm run build
```

Serve the resulting `dist/` directory at `/group-project/`, including its
SPA fallback to `index.html`.

## Runtime variables

The Express service requires an OpenAI-compatible provider. It accepts either
the Group Project-specific `AGGREGATOR_API_BASE_URL`, `AGGREGATOR_API_KEY`, and
`AGGREGATOR_MODEL`, or falls back to the existing Flask application's
`UNIFIED_BASE_URL`, `UNIFIED_API_KEY`, and `TEXT_MODEL` values. Do not expose
either set in the browser or commit them to this repository.

When `TEXT_MODEL` is not set, the director uses `gpt-4o`, matching the Flask
application's established default. A host may set `AGGREGATOR_MODEL` to
override it without changing application code.

Set `GROUP_PROJECT_URL=/group-project/` for Flask. This activates the Group
Project card on the scenario home.

## Release checks

Before enabling the card in production:

1. Run `npm ci`, `npm run test:scenario`, and the production build above.
2. Start Express only on `127.0.0.1:8787` under systemd or a process manager.
3. Verify `GET /group-project/api/health` through Nginx.
4. Verify a full Group Project run and Replay on the staging site.
5. Run the existing Flask test suite, then deploy through the existing rollback-safe release process.

## Rollout order

Run the `Deploy PerspeakAI preview` GitHub Action first with
`bootstrap_server=true`. It writes only the isolated preview service, its
Nginx route, and its own release files. Once the preview is accepted, use the
separately approved production workflow to install the production Group
Project service. Then merge
`deploy/perspeak-production-group-project-nginx.snippet` into the existing
HTTPS `perspeakai.cn` server block, run `nginx -t`, and reload Nginx before
enabling the card for users.
