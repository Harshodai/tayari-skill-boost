# Resume Graph API

## Overview
The Resume Graph API provides a knowledge‑graph representation of a user's resume. It supports pagination, raw export, JSON export, and deletion.

## Endpoints

### `GET /v1/resume-graph/{run_id}`
- Returns a paginated graph.
- Query parameters:
  - `page` (default 1)
  - `size` (default 10)
  - `format=raw` – returns the raw graph without pagination.
- Security headers added:
  - `Content‑Security‑Policy: default-src 'self'`
  - `X‑Content‑Type‑Options: nosniff`
- Rate‑limited to **5 requests per minute per IP**.

### `POST /v1/resume-graph`
- Body: `{ "run_id": "<id>", "resume_text": "..." }`
- Parses the resume and stores the resulting graph under the given `run_id`.
- Returns `{ "run_id": "...", "graph": { … } }`.

### `DELETE /v1/resume-graph/{run_id}`
- Deletes the stored graph for the given `run_id`.
- Returns **204 No Content** on success.

### `GET /v1/resume-graph/{run_id}/export`
- Returns the full graph as a downloadable JSON file.
- `Content‑Disposition` header sets a filename `resume-graph-<run_id>.json`.

## Graph Format
```json
{
  "nodes": [ { "id": "string", "label": "string" } ],
  "links": [ { "source": "nodeId", "target": "nodeId" } ]
}
```

## Usage (Frontend)
```ts
const response = await fetch(`/v1/resume-graph/${runId}`);
const { graph } = await response.json();
// Pass `graph` to <ResumeGraphViz graph={graph} />
```

## Testing
- Backend tests in `backend/python/app/tests/` verify pagination, security headers, raw format, and error handling.
- Frontend tests in `src/test/ResumeGraph*.test.tsx` validate rendering, export buttons, and deletion.
