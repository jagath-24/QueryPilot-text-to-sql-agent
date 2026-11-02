# Environment template

Use these values as the contents of a local `.env` file for Docker Compose. The managed project keeps secrets in the platform secret store rather than committing `.env` files.

```dotenv
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile
DB_USERNAME=querypilot
DB_PASSWORD=querypilot
DB_ROOT_PASSWORD=root
JWT_SECRET=replace-with-a-long-random-secret
QUERY_RATE_LIMIT=20
```

The managed preview also supports the platform-injected `DATABASE_URL`, `BUILT_IN_FORGE_API_URL`, and `BUILT_IN_FORGE_API_KEY` values. Never commit real keys.
