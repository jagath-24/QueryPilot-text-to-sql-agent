import type { Express, Request } from "express";
import { executeSql, generateSql, getHistory, getSchemaSnapshot, toggleFavorite } from "./textToSql";

function userId(req: Request) {
  return String(req.headers["x-user-id"] ?? "demo");
}

export function registerRestApi(app: Express) {
  app.get("/api/schema", async (_req, res) => res.json(await getSchemaSnapshot()));
  app.post("/api/query/generate", async (req, res) => {
    try {
      const question = String(req.body?.question ?? "");
      if (question.length < 3) return res.status(400).json({ error: "question must be at least 3 characters" });
      return res.json(await generateSql(question));
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : "generation failed" });
    }
  });
  app.post("/api/query/execute", async (req, res) => {
    try {
      return res.json(await executeSql(String(req.body?.sql ?? ""), userId(req)));
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "query rejected" });
    }
  });
  app.get("/api/query/history", (req, res) => res.json(getHistory(userId(req))));
  app.post("/api/query/favorite", (req, res) => res.json(toggleFavorite(userId(req), String(req.body?.id ?? ""))));
  app.post("/api/auth/signup", (req, res) => res.status(201).json({ user: { id: `demo-${Date.now()}`, email: req.body?.email ?? "demo@example.com", name: req.body?.name ?? "Demo Analyst" }, token: "demo-session" }));
  app.post("/api/auth/login", (req, res) => res.json({ user: { id: "demo-user", email: req.body?.email ?? "demo@example.com", name: "Demo Analyst" }, token: "demo-session" }));
}
