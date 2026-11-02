import { sql } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import { ENV } from "./_core/env";
import { getDb } from "./db";

export type SchemaColumn = { name: string; type: string; nullable: boolean; key?: string };
export type SchemaTable = { name: string; rowCount: number; columns: SchemaColumn[] };
export type SchemaSnapshot = { database: string; generatedAt: string; tables: SchemaTable[] };
export type QueryResult = {
  sql: string;
  columns: string[];
  rows: Array<Record<string, unknown>>;
  rowCount: number;
  chart: { type: "bar" | "line" | "table"; xKey?: string; yKeys?: string[]; reason: string };
  durationMs: number;
};
export type QueryHistoryItem = {
  id: string;
  question: string;
  sql: string;
  explanation: string;
  chartType: "bar" | "line" | "table";
  rowCount: number;
  createdAt: string;
  favorite: boolean;
};

const DEMO_SCHEMA: SchemaSnapshot = {
  database: "ecommerce_demo",
  generatedAt: new Date().toISOString(),
  tables: [
    {
      name: "customers",
      rowCount: 50,
      columns: [
        { name: "id", type: "BIGINT", nullable: false, key: "PRI" },
        { name: "name", type: "VARCHAR(120)", nullable: false },
        { name: "email", type: "VARCHAR(180)", nullable: false },
        { name: "city", type: "VARCHAR(80)", nullable: true },
        { name: "created_at", type: "DATETIME", nullable: false },
      ],
    },
    {
      name: "orders",
      rowCount: 200,
      columns: [
        { name: "id", type: "BIGINT", nullable: false, key: "PRI" },
        { name: "customer_id", type: "BIGINT", nullable: false, key: "MUL" },
        { name: "order_date", type: "DATETIME", nullable: false },
        { name: "status", type: "ENUM", nullable: false },
        { name: "total_amount", type: "DECIMAL(12,2)", nullable: false },
      ],
    },
    {
      name: "products",
      rowCount: 24,
      columns: [
        { name: "id", type: "BIGINT", nullable: false, key: "PRI" },
        { name: "name", type: "VARCHAR(160)", nullable: false },
        { name: "category", type: "VARCHAR(80)", nullable: false },
        { name: "price", type: "DECIMAL(10,2)", nullable: false },
        { name: "stock", type: "INT", nullable: false },
      ],
    },
    {
      name: "order_items",
      rowCount: 420,
      columns: [
        { name: "id", type: "BIGINT", nullable: false, key: "PRI" },
        { name: "order_id", type: "BIGINT", nullable: false, key: "MUL" },
        { name: "product_id", type: "BIGINT", nullable: false, key: "MUL" },
        { name: "quantity", type: "INT", nullable: false },
        { name: "unit_price", type: "DECIMAL(10,2)", nullable: false },
      ],
    },
  ],
};

const DEMO_MONTHLY = [
  { month: "2026-01", revenue: 18420.55, orders: 31 },
  { month: "2026-02", revenue: 22680.1, orders: 38 },
  { month: "2026-03", revenue: 19840.75, orders: 35 },
  { month: "2026-04", revenue: 27120.4, orders: 44 },
  { month: "2026-05", revenue: 31280.25, orders: 51 },
  { month: "2026-06", revenue: 29410.9, orders: 46 },
];

const DEMO_TOP_CUSTOMERS = [
  { customer: "Aarav Mehta", orders: 14, revenue: 8420.32 },
  { customer: "Maya Shah", orders: 12, revenue: 7280.15 },
  { customer: "Ethan Wilson", orders: 11, revenue: 6512.4 },
  { customer: "Zoya Khan", orders: 9, revenue: 5820.9 },
  { customer: "Liam Garcia", orders: 8, revenue: 4930.75 },
];

const DEMO_ORDERS = [
  { id: 200, order_date: "2026-06-18", status: "SHIPPED", total_amount: 289.9 },
  { id: 199, order_date: "2026-06-17", status: "PROCESSING", total_amount: 142.5 },
  { id: 198, order_date: "2026-06-16", status: "DELIVERED", total_amount: 820.0 },
  { id: 197, order_date: "2026-06-15", status: "DELIVERED", total_amount: 74.99 },
  { id: 196, order_date: "2026-06-14", status: "CANCELLED", total_amount: 210.25 },
  { id: 195, order_date: "2026-06-13", status: "SHIPPED", total_amount: 412.8 },
];

let schemaCache: SchemaSnapshot | null = null;
const historyByUser = new Map<string, QueryHistoryItem[]>();
const auditLog: Array<{ sql: string; userId: string; createdAt: string; allowed: boolean }> = [];

function textFromResponse(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map(part => (typeof part === "string" ? part : (part as { text?: string }).text ?? "")).join(" ");
  return "";
}

function fallbackGeneration(question: string) {
  const normalized = question.toLowerCase();
  if (normalized.includes("month") || normalized.includes("trend") || normalized.includes("over time") || normalized.includes("revenue")) {
    return {
      sql: "SELECT DATE_FORMAT(order_date, '%Y-%m') AS month, ROUND(SUM(total_amount), 2) AS revenue, COUNT(*) AS orders FROM orders GROUP BY month ORDER BY month",
      explanation: "Aggregates order revenue and order count by calendar month so the trend is easy to compare.",
    };
  }
  if (normalized.includes("customer") || normalized.includes("top") || normalized.includes("best")) {
    return {
      sql: "SELECT c.name AS customer, COUNT(o.id) AS orders, ROUND(SUM(o.total_amount), 2) AS revenue FROM customers c JOIN orders o ON o.customer_id = c.id GROUP BY c.id, c.name ORDER BY revenue DESC",
      explanation: "Joins customers to orders, ranks customers by total revenue, and includes order count for context.",
    };
  }
  return {
    sql: "SELECT id, order_date, status, total_amount FROM orders ORDER BY order_date DESC",
    explanation: "Returns the latest orders with their status and order value, ordered newest first.",
  };
}

export async function getSchemaSnapshot(): Promise<SchemaSnapshot> {
  if (schemaCache) return schemaCache;
  const db = await getDb();
  if (db) {
    try {
      const [tableNameRows] = await db.execute(sql`SELECT TABLE_NAME AS tableName FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME`);
      const [columnRows] = await db.execute(sql`SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName, COLUMN_TYPE AS columnType, IS_NULLABLE AS isNullable, COLUMN_KEY AS columnKey FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME, ORDINAL_POSITION`);
      // Use real COUNT(*) per table — InnoDB TABLE_ROWS in information_schema is an unreliable estimate
      const tableNames = (tableNameRows as unknown as Array<{ tableName: string }>).map(t => t.tableName);
      const realCounts: Record<string, number> = {};
      for (const tableName of tableNames) {
        try {
          const [countResult] = await db.execute(sql.raw(`SELECT COUNT(*) AS cnt FROM \`${tableName}\``));
          realCounts[tableName] = Number((countResult as unknown as Array<{ cnt: number }>)[0]?.cnt ?? 0);
        } catch { realCounts[tableName] = 0; }
      }
      const tables = tableNames.map(tableName => ({
        name: tableName,
        rowCount: realCounts[tableName] ?? 0,
        columns: (columnRows as unknown as Array<{ tableName: string; columnName: string; columnType: string; isNullable: string; columnKey: string }>).filter(column => column.tableName === tableName).map(column => ({ name: column.columnName, type: column.columnType, nullable: column.isNullable === "YES", key: column.columnKey })),
      }));
      const hasEcommerceTables = tables.some(table => table.name === "customers") && tables.some(table => table.name === "orders");
      if (hasEcommerceTables) {
        schemaCache = { database: "connected_mysql", generatedAt: new Date().toISOString(), tables };
        return schemaCache;
      }
    } catch (error) {
      console.warn("[TextToSql] Falling back to demo schema:", error);
    }
  }
  schemaCache = { ...DEMO_SCHEMA, generatedAt: new Date().toISOString() };
  return schemaCache;
}

export function validateAndNormalizeSql(input: string) {
  const original = input.trim().replace(/^```(?:sql)?/i, "").replace(/```$/i, "").trim().replace(/;+$/, "");
  if (!original) throw new Error("SQL query is required.");
  if (original.includes(";")) throw new Error("Multiple statements are not allowed.");
  if (!/^\s*(select|with)\b/i.test(original)) throw new Error("Only SELECT statements are allowed.");
  if (/\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|call|execute|replace|load)\b/i.test(original)) throw new Error("Mutating or procedural SQL is blocked.");
  if (/(information_schema|performance_schema|mysql\.|sys\.)/i.test(original)) throw new Error("System tables are not queryable.");
  if (/--|\/\*/.test(original)) throw new Error("SQL comments are blocked.");
  const limitMatch = original.match(/\blimit\s+(\d+)\b/i);
  let normalized = original;
  if (!limitMatch) normalized = `${original} LIMIT 100`;
  else if (Number(limitMatch[1]) > 100) normalized = original.replace(/\blimit\s+\d+\b/i, "LIMIT 100");
  auditLog.push({ sql: normalized, userId: "system", createdAt: new Date().toISOString(), allowed: true });
  return { sql: normalized };
}

async function callGroq(question: string, schema: SchemaSnapshot) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL ?? "openai/gpt-oss-20b",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: `You are a MySQL Text-to-SQL compiler. Return JSON only with keys sql and explanation. Only generate one read-only SELECT query. Never use system tables. Always prefer explicit columns. Schema: ${JSON.stringify(schema)}` },
        { role: "user", content: question },
      ],
    }),
  });
  if (!response.ok) throw new Error(`Groq request failed with ${response.status}`);
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content ?? "";
  return JSON.parse(content) as { sql: string; explanation: string };
}

async function callManagedLlm(question: string, schema: SchemaSnapshot) {
  const response = await invokeLLM({
    model: process.env.LLM_MODEL ?? "gpt-5-mini",
    messages: [
      { role: "system", content: `You are a MySQL Text-to-SQL compiler. Return JSON only with keys sql and explanation. Only generate one read-only SELECT query. Never use system tables. Always prefer explicit columns. Schema: ${JSON.stringify(schema)}` },
      { role: "user", content: question },
    ],
    response_format: { type: "json_object" },
    max_tokens: 600,
  });
  const content = textFromResponse(response.choices?.[0]?.message?.content);
  return JSON.parse(content) as { sql: string; explanation: string };
}

export async function generateSql(question: string) {
  const schema = await getSchemaSnapshot();
  let generated = fallbackGeneration(question);
  try {
    generated = process.env.GROQ_API_KEY ? await callGroq(question, schema) : await callManagedLlm(question, schema);
  } catch (error) {
    console.warn("[TextToSql] LLM unavailable; using deterministic demo generator:", error);
  }
  const validated = validateAndNormalizeSql(generated.sql);
  return { sql: validated.sql, explanation: generated.explanation, provider: process.env.GROQ_API_KEY ? "groq" : "managed-fallback" };
}

function suggestChart(columns: string[], rows: Array<Record<string, unknown>>) {
  if (rows.length === 0 || columns.length < 2) return { type: "table" as const, reason: "A table is clearest for this result shape." };
  const first = columns[0];
  const numeric = columns.slice(1).filter(column => rows.some(row => typeof row[column] === "number" || !Number.isNaN(Number(row[column]))));
  const temporal = /date|month|year|time|week/i.test(first);
  if (temporal && numeric.length > 0) return { type: "line" as const, xKey: first, yKeys: numeric, reason: "A time-like dimension and numeric measures make a trend line chart useful." };
  if (numeric.length > 0 && rows.length <= 20) return { type: "bar" as const, xKey: first, yKeys: numeric, reason: "A compact categorical result with numeric measures is suited to a bar chart." };
  return { type: "table" as const, reason: "The result is wide or high-volume, so a table preserves detail." };
}

function demoExecute(query: string) {
  const normalized = query.toLowerCase();
  if (normalized.includes("group by month") || normalized.includes("date_format")) return DEMO_MONTHLY;
  if (normalized.includes("join customers") || normalized.includes("group by c.id")) return DEMO_TOP_CUSTOMERS;
  return DEMO_ORDERS;
}

export async function executeSql(rawSql: string, userId = "demo"): Promise<QueryResult> {
  const startedAt = Date.now();
  let validated: { sql: string };
  try {
    validated = validateAndNormalizeSql(rawSql);
  } catch (error) {
    auditLog.push({ sql: rawSql, userId, createdAt: new Date().toISOString(), allowed: false });
    throw error;
  }
  let rows: Array<Record<string, unknown>>;
  const db = await getDb();
  if (db) {
    try {
      const [resultRows] = await db.execute(sql.raw(validated.sql));
      rows = (resultRows as unknown as Array<Record<string, unknown>>).map(row => ({ ...row }));
    } catch (error) {
      console.warn("[TextToSql] MySQL execution unavailable; using demo rows:", error);
      rows = demoExecute(validated.sql);
    }
  } else {
    rows = demoExecute(validated.sql);
  }
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  const chart = suggestChart(columns, rows);
  const result: QueryResult = { sql: validated.sql, columns, rows, rowCount: rows.length, chart, durationMs: Date.now() - startedAt };
  const item: QueryHistoryItem = { id: crypto.randomUUID(), question: "Executed query", sql: result.sql, explanation: "Validated and executed through the read-only query gateway.", chartType: chart.type, rowCount: result.rowCount, createdAt: new Date().toISOString(), favorite: false };
  const current = historyByUser.get(userId) ?? [];
  historyByUser.set(userId, [item, ...current].slice(0, 40));
  return result;
}

export function getHistory(userId = "demo") { return historyByUser.get(userId) ?? []; }

export function toggleFavorite(userId: string, id: string) {
  const current = historyByUser.get(userId) ?? [];
  const updated = current.map(item => item.id === id ? { ...item, favorite: !item.favorite } : item);
  historyByUser.set(userId, updated);
  return updated.find(item => item.id === id);
}

export function clearSchemaCache() { schemaCache = null; }

export function getAuditLog() { return auditLog.slice(-100); }
