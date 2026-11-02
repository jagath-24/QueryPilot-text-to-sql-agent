import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useTheme } from "@/contexts/ThemeContext";
import { Streamdown } from "streamdown";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, ArrowRight, BarChart3, CheckCircle2, ChevronDown, ChevronRight, Clock3, Code2, Database, History, LayoutDashboard, Moon, Play, Plus, RefreshCw, Search, Server, ShieldCheck, Sparkles, Star, Sun, Table2, Terminal, Zap } from "lucide-react";

type Result = { sql: string; columns: string[]; rows: Array<Record<string, unknown>>; rowCount: number; chart: { type: "bar" | "line" | "table"; xKey?: string; yKeys?: string[]; reason: string }; durationMs: number };
type Message = { role: "user" | "assistant"; content: string; sql?: string; result?: Result; provider?: string };

const suggestions = [
  { label: "Revenue trend", question: "Show monthly revenue and order count for the last six months" },
  { label: "Top customers", question: "Which customers generated the most revenue?" },
  { label: "Recent orders", question: "Show the latest orders with status and total amount" },
];

function formatValue(value: unknown) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return String(value);
}

function ResultChart({ result }: { result: Result }) {
  const data = result.rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === "string" && !Number.isNaN(Number(value)) ? Number(value) : value])));
  if (result.chart.type === "table" || !result.chart.xKey || !result.chart.yKeys?.length) return null;
  const Chart = result.chart.type === "line" ? AreaChart : BarChart;
  return (
    <div className="h-64 w-full pt-4">
      <ResponsiveContainer width="100%" height="100%">
        <Chart data={data} margin={{ top: 8, right: 18, left: 4, bottom: 4 }}>
          <defs><linearGradient id="querypilotFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#69f0ae" stopOpacity={0.34} /><stop offset="100%" stopColor="#69f0ae" stopOpacity={0} /></linearGradient></defs>
          <CartesianGrid stroke="#25334a" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey={result.chart.xKey} tick={{ fill: "#7890ad", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "#7890ad", fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ background: "#111c2c", border: "1px solid #263952", borderRadius: 10, color: "#eaf2ff" }} />
          {result.chart.yKeys.map((key, index) => result.chart.type === "line" ? <Area key={key} type="monotone" dataKey={key} stroke={index ? "#88a9ff" : "#69f0ae"} fill="url(#querypilotFill)" strokeWidth={2} /> : <Bar key={key} dataKey={key} fill={index ? "#88a9ff" : "#69f0ae"} radius={[4, 4, 0, 0]} />)}
        </Chart>
      </ResponsiveContainer>
    </div>
  );
}

function SchemaPanel({ schema }: { schema?: { tables: Array<{ name: string; rowCount: number; columns: Array<{ name: string; type: string; nullable: boolean }> }> } }) {
  const [open, setOpen] = useState<string | null>(schema?.tables?.[0]?.name ?? null);
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1"><div><p className="eyebrow">LIVE CATALOG</p><h2 className="text-sm font-semibold text-white">Database schema</h2></div><span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[10px] font-semibold text-emerald-300">CACHED</span></div>
      <div className="space-y-1.5">
        {schema?.tables?.map(table => <div key={table.name} className="rounded-xl border border-white/[0.06] bg-white/[0.025] transition hover:border-white/10">
          <button className="flex w-full items-center justify-between px-3 py-2.5 text-left" onClick={() => setOpen(open === table.name ? null : table.name)}><span className="flex items-center gap-2 text-xs font-medium text-slate-200"><Database className="h-3.5 w-3.5 text-cyan-300" />{table.name}</span><span className="flex items-center gap-2 text-[10px] text-slate-500">{table.rowCount} rows {open === table.name ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}</span></button>
          {open === table.name && <div className="border-t border-white/[0.05] px-3 pb-2.5 pt-1.5">{table.columns.map(column => <div key={column.name} className="flex items-center justify-between py-1 text-[11px]"><span className="font-mono text-slate-400">{column.name}</span><span className="text-slate-600">{column.type}</span></div>)}</div>}
        </div>)}
      </div>
    </section>
  );
}

export default function Home() {
  const { theme, toggleTheme } = useTheme();
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeTab, setActiveTab] = useState<"workspace" | "history">("workspace");
  const [showSql, setShowSql] = useState(false);
  const schemaQuery = trpc.schema.useQuery();
  const historyQuery = trpc.query.history.useQuery();
  const generate = trpc.query.generate.useMutation();
  const execute = trpc.query.execute.useMutation();
  const favorite = trpc.query.favorite.useMutation({ onSuccess: () => historyQuery.refetch() });
  const isBusy = generate.isPending || execute.isPending;

  const latestResult = useMemo(() => [...messages].reverse().find(message => message.result)?.result, [messages]);
  const ask = async (preset?: string) => {
    const prompt = (preset ?? question).trim();
    if (!prompt || isBusy) return;
    setQuestion("");
    setMessages(current => [...current, { role: "user", content: prompt }]);
    try {
      const generated = await generate.mutateAsync({ question: prompt });
      const result = await execute.mutateAsync({ sql: generated.sql });
      setMessages(current => [...current, { role: "assistant", content: generated.explanation, sql: generated.sql, result, provider: generated.provider }]);
    } catch (error) {
      setMessages(current => [...current, { role: "assistant", content: error instanceof Error ? error.message : "The query could not be completed." }]);
    }
  };

  return (
    <div className="min-h-screen bg-[#08111e] text-slate-100">
      <div className="flex min-h-screen">
        <aside className="hidden w-[246px] shrink-0 border-r border-white/[0.07] bg-[#0a1524] px-4 py-5 lg:flex lg:flex-col">
          <div className="flex items-center gap-3 px-2"><div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-300 text-[#07121e] shadow-[0_0_28px_rgba(105,240,174,0.18)]"><Terminal className="h-4.5 w-4.5" /></div><div><p className="text-[13px] font-bold tracking-tight text-white">Query<span className="text-emerald-300">Pilot</span></p><p className="text-[9px] uppercase tracking-[0.22em] text-slate-500">AI data workspace</p></div></div>
          <div className="mt-9 space-y-1"><p className="eyebrow px-3 pb-2">WORKSPACE</p><button onClick={() => setActiveTab("workspace")} className={`nav-item ${activeTab === "workspace" ? "nav-item-active" : ""}`}><LayoutDashboard className="h-4 w-4" />Query workspace</button><button onClick={() => setActiveTab("history")} className={`nav-item ${activeTab === "history" ? "nav-item-active" : ""}`}><History className="h-4 w-4" />Query history<span className="ml-auto rounded-full bg-white/10 px-1.5 py-0.5 text-[9px]">{historyQuery.data?.length ?? 0}</span></button></div>
          <div className="mt-8 space-y-3"><p className="eyebrow px-3">GUARDRAILS</p><div className="space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.025] p-3"><div className="flex items-center gap-2 text-xs text-slate-300"><ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />SELECT-only validation</div><div className="flex items-center gap-2 text-xs text-slate-300"><Zap className="h-3.5 w-3.5 text-amber-300" />LIMIT 100 enforced</div><div className="flex items-center gap-2 text-xs text-slate-300"><Activity className="h-3.5 w-3.5 text-cyan-300" />Audit logging active</div></div></div>
          <div className="mt-auto rounded-xl border border-emerald-300/10 bg-emerald-300/[0.04] p-3"><div className="mb-2 flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_10px_#69f0ae]" /><span className="text-[11px] font-semibold text-emerald-200">Connected</span></div><p className="text-[10px] leading-relaxed text-slate-500">MySQL demo catalog · 4 tables · 674 rows indexed</p></div>
        </aside>
        <main className="min-w-0 flex-1">
          <header className="flex h-[72px] items-center justify-between border-b border-white/[0.07] px-5 sm:px-8"><div><div className="flex items-center gap-2 text-[11px] text-slate-500"><span>Workspace</span><ChevronRight className="h-3 w-3" /><span className="text-slate-300">{activeTab === "history" ? "Query history" : "Ask your data"}</span></div><h1 className="mt-1 text-lg font-semibold tracking-tight text-white">{activeTab === "history" ? "Query history" : "Ask your data"}</h1></div><div className="flex items-center gap-2"><span className="hidden rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[10px] text-slate-500 sm:inline-flex"><Server className="mr-1.5 h-3 w-3 text-emerald-300" />MySQL / ecommerce_demo</span><button onClick={toggleTheme} className="icon-button" title="Toggle theme">{theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button><div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-cyan-300 to-emerald-300 text-[11px] font-bold text-[#06121d]">DA</div></div></header>
          {activeTab === "history" ? <div className="mx-auto max-w-6xl p-5 sm:p-8"><div className="mb-6 flex items-end justify-between"><div><p className="eyebrow">AUDIT TRAIL</p><h2 className="mt-1 text-2xl font-semibold text-white">Saved questions & validated SQL</h2></div><button onClick={() => historyQuery.refetch()} className="ghost-button"><RefreshCw className="h-3.5 w-3.5" />Refresh</button></div><div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0e1a2b]">{historyQuery.data?.length ? historyQuery.data.map(item => <div key={item.id} className="flex flex-col gap-3 border-b border-white/[0.06] px-5 py-4 last:border-0 sm:flex-row sm:items-center"><div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-cyan-400/10 text-cyan-300"><History className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-200">{item.question}</p><p className="mt-1 truncate font-mono text-[11px] text-slate-500">{item.sql}</p></div><div className="flex items-center gap-4 text-[10px] text-slate-500"><span>{item.rowCount} rows</span><span className="rounded-full bg-white/5 px-2 py-1 uppercase">{item.chartType}</span><button onClick={() => favorite.mutate({ id: item.id })} className={item.favorite ? "text-amber-300" : "text-slate-600 hover:text-amber-300"}><Star className="h-4 w-4" fill={item.favorite ? "currentColor" : "none"} /></button></div></div>) : <div className="p-16 text-center text-sm text-slate-500">Run a query to populate your audit trail.</div>}</div></div> : <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 p-5 sm:p-8 xl:grid-cols-[minmax(0,1fr)_292px]">
            <div className="min-w-0 space-y-5"><section className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#101f32] via-[#0d1929] to-[#0a1422] p-5 sm:p-7"><div className="pointer-events-none absolute -right-12 -top-20 h-56 w-56 rounded-full bg-emerald-300/10 blur-3xl" /><div className="relative"><div className="mb-3 flex items-center gap-2"><Sparkles className="h-4 w-4 text-emerald-300" /><p className="eyebrow text-emerald-200">NATURAL LANGUAGE INTERFACE</p></div><h2 className="max-w-xl text-2xl font-semibold leading-tight tracking-tight text-white sm:text-3xl">What would you like to <span className="text-emerald-300">understand?</span></h2><p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-400">Ask a question in plain English. QueryPilot will compile it into safe SQL, validate every clause, and shape the answer for you.</p><div className="mt-6 rounded-xl border border-white/10 bg-[#07111e]/80 p-2 shadow-[0_18px_50px_rgba(0,0,0,0.16)]"><textarea value={question} onChange={event => setQuestion(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) ask(); }} placeholder="e.g. Show monthly revenue for the last six months..." className="min-h-[84px] w-full resize-none bg-transparent px-3 py-2 text-sm leading-relaxed text-slate-100 outline-none placeholder:text-slate-600" /><div className="flex items-center justify-between border-t border-white/[0.07] px-2 pt-2"><span className="text-[10px] text-slate-600">⌘ + Enter to run</span><button disabled={!question.trim() || isBusy} onClick={() => ask()} className="primary-button"><Play className="h-3.5 w-3.5 fill-current" />{isBusy ? "Thinking..." : "Run query"}<ArrowRight className="h-3.5 w-3.5" /></button></div></div><div className="mt-4 flex flex-wrap gap-2">{suggestions.map(suggestion => <button key={suggestion.label} onClick={() => ask(suggestion.question)} className="suggestion-chip"><Plus className="h-3 w-3" />{suggestion.label}</button>)}</div></div></section>
              {messages.length === 0 ? <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{[{ icon: ShieldCheck, title: "Safe by default", copy: "SELECT-only SQL with system table blocking and LIMIT injection.", color: "text-emerald-300" }, { icon: Code2, title: "Explainable", copy: "Every generated query includes a plain-language rationale.", color: "text-cyan-300" }, { icon: BarChart3, title: "Chart-ready", copy: "Heuristics choose the right visualization for the result shape.", color: "text-violet-300" }].map(feature => <div key={feature.title} className="rounded-xl border border-white/[0.07] bg-[#0d1929] p-4"><feature.icon className={`h-4 w-4 ${feature.color}`} /><p className="mt-4 text-xs font-semibold text-slate-200">{feature.title}</p><p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">{feature.copy}</p></div>)}</div> : <section className="space-y-3">{messages.map((message, index) => message.role === "user" ? <div key={index} className="flex justify-end"><div className="max-w-[85%] rounded-2xl rounded-br-md bg-emerald-300 px-4 py-3 text-sm font-medium text-[#07121e] shadow-[0_8px_28px_rgba(105,240,174,0.12)]">{message.content}</div></div> : <div key={index} className="rounded-2xl border border-white/[0.08] bg-[#0d1929] p-4 sm:p-5"><div className="flex items-start gap-3"><div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-cyan-400/10 text-cyan-300"><Sparkles className="h-3.5 w-3.5" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-semibold text-slate-200">QueryPilot</p><span className="rounded-full bg-emerald-300/10 px-2 py-0.5 text-[9px] uppercase tracking-wider text-emerald-300">validated</span>{message.provider && <span className="text-[9px] text-slate-600">via {message.provider}</span>}</div><div className="mt-2 text-sm leading-relaxed text-slate-400"><Streamdown>{message.content}</Streamdown></div>{message.sql && <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.07] bg-[#07111e]"><button onClick={() => setShowSql(!showSql)} className="flex w-full items-center justify-between px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500"><span className="flex items-center gap-2"><Code2 className="h-3.5 w-3.5 text-cyan-300" />Generated SQL</span>{showSql ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}</button>{showSql && <pre className="overflow-x-auto border-t border-white/[0.06] px-3 py-3 font-mono text-[11px] leading-relaxed text-cyan-100/75">{message.sql}</pre>}</div>}{message.result && <div className="mt-4 rounded-xl border border-white/[0.07] bg-[#0a1524] p-3 sm:p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><Table2 className="h-3.5 w-3.5 text-emerald-300" /><span className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">Result preview</span><span className="text-[10px] text-slate-600">{message.result!.rowCount} rows · {message.result!.durationMs}ms</span></div><span className="text-[10px] text-slate-500">{message.result!.chart.reason}</span></div><ResultChart result={message.result} /><div className="mt-3 overflow-x-auto rounded-lg border border-white/[0.06]"><table className="w-full min-w-[560px] text-left text-xs"><thead className="bg-white/[0.03] text-[10px] uppercase tracking-wider text-slate-500"><tr>{message.result!.columns.map(column => <th key={column} className="px-3 py-2 font-medium">{column}</th>)}</tr></thead><tbody>{message.result!.rows.slice(0, 8).map((row, rowIndex) => <tr key={rowIndex} className="border-t border-white/[0.05] text-slate-400"><td className="hidden" />{message.result!.columns.map(column => <td key={column} className="px-3 py-2.5">{formatValue(row[column])}</td>)}</tr>)}</tbody></table></div></div>}</div></div></div>)}</section>}
            </div><aside className="space-y-7"><SchemaPanel schema={schemaQuery.data} /><section className="space-y-3"><div className="flex items-center justify-between px-1"><div><p className="eyebrow">RECENT RUNS</p><h2 className="text-sm font-semibold text-white">Query history</h2></div><button onClick={() => setActiveTab("history")} className="text-[10px] font-semibold text-emerald-300 hover:text-emerald-200">View all</button></div><div className="space-y-2">{historyQuery.data?.slice(0, 4).map(item => <button key={item.id} className="group flex w-full gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] p-3 text-left hover:border-white/10" onClick={() => setQuestion(item.question)}><div className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white/[0.05] text-slate-500 group-hover:text-emerald-300"><Clock3 className="h-3.5 w-3.5" /></div><div className="min-w-0"><p className="truncate text-[11px] font-medium text-slate-300">{item.question}</p><p className="mt-1 text-[10px] text-slate-600">{item.rowCount} rows · {item.chartType}</p></div></button>)}{!historyQuery.data?.length && <div className="rounded-xl border border-dashed border-white/10 p-5 text-center text-[11px] text-slate-600">Your recent queries will appear here.</div>}</div></section></aside>
          </div>}
        </main>
      </div>
    </div>
  );
}
