import { describe, expect, it } from "vitest";

describe("Groq credential", () => {
  it("authenticates against the models endpoint when configured", async () => {
    const key = process.env.GROQ_API_KEY;
    if (!key) return;
    const response = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
    });
    expect(response.ok).toBe(true);
    const body = await response.json() as { data?: unknown[] };
    expect(Array.isArray(body.data)).toBe(true);
  }, 15000);
});
