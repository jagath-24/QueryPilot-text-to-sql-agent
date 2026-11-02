# QueryPilot — AI-Powered Text-to-SQL Agent

QueryPilot is a full-stack natural-language analytics workspace. It turns a business question into explainable MySQL SQL, validates the statement before execution, returns rows and column metadata, and suggests a chart for the result shape.

## Product surface

The managed preview is a polished React + Tailwind workspace with a dark data-operations visual system. It includes a sidebar, cached schema explorer, natural-language composer, generated-SQL disclosure, execution result table, Recharts visualization, query history, favorites, theme toggle, and visible safety guardrails. The preview uses the same contract through tRPC and REST: `GET /api/schema`, `POST /api/query/generate`, `POST /api/query/execute`, `GET /api/query/history`, and `POST /api/query/favorite`.

## Architecture

The repository contains two compatible runtimes. The managed WebDev runtime is the runnable preview: Vite/React/Tailwind on the client and Express/tRPC on the server, with platform-injected MySQL and LLM access. The `spring-backend/` directory is a portable reference implementation matching the requested interview stack: Spring Boot, JDBC/JdbcTemplate, Groq Llama 3.3 70B, JSQLParser, JWT, Bucket4j, DTOs, query audit logging, and Docker packaging.

The validation layer is intentionally the center of the design. It parses every candidate with JSQLParser, accepts only a single `SELECT`/`WITH` statement, blocks mutations and procedural keywords, rejects SQL comments and system schemas, caps user-provided limits at 100, and injects `LIMIT 100` when none is present. The managed preview mirrors the same rules so its behavior can be demonstrated without a local Java runtime.

## Local Docker run

1. Copy the values from [`ENV_EXAMPLE.md`](./ENV_EXAMPLE.md) into a local `.env` file.
2. Add a Groq API key if you want live `llama-3.3-70b-versatile` generation.
3. Run `docker compose up --build`.
4. Open `http://localhost:5173` for the React UI or import [`postman/querypilot.postman_collection.json`](./postman/querypilot.postman_collection.json) with `baseUrl=http://localhost:8080`.

MySQL initializes from `mysql/schema.sql` and `mysql/seed.sql`. The seed contains 50 customers, 24 products, 200 orders, and deterministic order items. The database schema also contains `query_history`, `query_favorites`, and `query_audit` tables.

## Configuration

The managed preview reads `GROQ_API_KEY` securely server-side. If the key is absent, generation uses the platform-managed LLM proxy when available and finally a deterministic demo generator so the UI remains inspectable. The Spring Boot runtime requires `GROQ_API_KEY` for live generation, plus `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, and `JWT_SECRET`; defaults are documented in [`ENV_EXAMPLE.md`](./ENV_EXAMPLE.md).

## API examples

```bash
curl http://localhost:8080/api/schema
curl -X POST http://localhost:8080/api/query/generate \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"question":"Which customers generated the most revenue?"}'
curl -X POST http://localhost:8080/api/query/execute \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"sql":"SELECT status, COUNT(*) AS orders FROM orders GROUP BY status"}'
```

## Build order implemented

The project follows the requested sequence: schema and deterministic seed plus introspection; Groq integration and the validation gateway; safe execution and JSON result mapping; React chat UI and result visualization; auth/JWT, history, favorites, audit logging, and a 20-query/hour Bucket4j limit in the Spring reference runtime; then Docker Compose, environment documentation, and Postman.

## Verification

From the managed project root:

```bash
pnpm check
pnpm vitest run
```

From the portable reference backend:

```bash
cd spring-backend
mvn test
```

The repository's managed integration test makes a lightweight authenticated request to Groq's `/v1/models` endpoint when `GROQ_API_KEY` is configured. The SQL validation unit tests demonstrate mutation blocking, limit injection, and limit capping.
