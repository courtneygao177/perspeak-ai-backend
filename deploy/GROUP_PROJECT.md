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

Set `GROUP_PROJECT_URL=/group-project/` for Flask. This activates the Group
Project card on the scenario home.

## Release checks

Before enabling the card in production:

1. Run `npm ci`, `npm run test:scenario`, and the production build above.
2. Start Express only on `127.0.0.1:8787` under systemd or a process manager.
3. Verify `GET /group-project/api/health` through Nginx.
4. Verify a full Group Project run and Replay on the staging site.
5. Run the existing Flask test suite, then deploy through the existing rollback-safe release process.
