// Build results/MATRIX.md from results/*.json.  node report.mjs > results/MATRIX.md
import fs from "node:fs";

const dir = new URL("./results/", import.meta.url);
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
const load = (f) => JSON.parse(fs.readFileSync(new URL(f, dir), "utf8"));

const CASES = ["basic", "crc16", "crc32c_payload", "large", "hop_count", "unknown_keep", "unknown_discard",
  "no_clock_age", "previous_node", "bib_payload", "bib_payload_scoped", "bib_primary"];
const SHORT = { basic: "basic", crc16: "CRC-16", crc32c_payload: "CRC-32C", large: "large", hop_count: "hop count",
  unknown_keep: "unknown keep", unknown_discard: "unknown discard", no_clock_age: "bundle age",
  previous_node: "prev node", bib_payload: "BIB payload", bib_payload_scoped: "BIB payload+scope",
  bib_primary: "BIB primary" };
const MARK = { pass: "✓", warn: "~", fail: "✗", missing: "–" };
const IMPLS = ["ion", "hdtn", "ud3tn", "hardy", "bplib", "bplib-fixed", "dtn7"];
const NAME = { ion: "ION", hdtn: "HDTN", ud3tn: "uD3TN", hardy: "Hardy", bplib: "bplib", "bplib-fixed": "bplib + fixes",
  dtn7: "dtn7-rs" };

const out = [];
const p = (s = "") => out.push(s);

p("# Results");
p();
p(`Generated ${new Date().toISOString().slice(0, 10)} from ${files.length} test runs.`);
p("✓ pass, ~ warning, ✗ fail, – not delivered.");
p();

// Single relays
p("## Single relay");
p();
p("Reference source -> implementation -> reference sink.");
p();
p(`| Implementation | CL | ${CASES.map((c) => SHORT[c]).join(" | ")} |`);
p(`|---|---|${CASES.map(() => ":-:").join("|")}|`);
for (const impl of IMPLS) {
  const f = files.find((x) => x.startsWith(`single_${impl}_`) && !x.startsWith(`single_${impl}-`));
  if (!f) continue;
  const r = load(f);
  const cl = f.replace(`single_${impl}_`, "").replace(".json", "").split("_")[0];
  p(`| ${NAME[impl]} | ${cl} | ${CASES.map((c) => MARK[r.cases[c]?.status ?? "missing"]).join(" | ")} |`);
}
p();

// Pairs, one table per convergence layer
const pairs = files.filter((f) => f.startsWith("pair_")).map((f) => {
  const [, x, y, ...rest] = f.replace(".json", "").split("_");
  return { x, y, cl: rest.join("_"), r: load(f) };
});
const cls = [...new Set(pairs.map((t) => t.cl))].sort();

function cell(r) {
  const st = CASES.map((c) => r.cases[c]?.status ?? "missing");
  if (st.every((s) => s === "missing")) return "no delivery";
  const ok = st.filter((s) => s === "pass" || s === "warn").length;
  const bad = CASES.flatMap((c, i) => (st[i] === "fail" || st[i] === "missing" ? [`${MARK[st[i]]} ${SHORT[c]}`] : []));
  const of = `${ok}/${CASES.length}`;
  return bad.length ? `${of}: ${bad.join(", ")}` : of;
}

p("## Pairs");
p();
p("Reference source -> X -> Y -> reference sink, with X and Y linked by the named convergence layer.");
p(`Rows are X (sender), columns are Y (receiver). A cell lists the checks that passed out of ${CASES.length}`);
p("(warnings count as passed) and names any check that failed or whose bundle did not arrive.");
for (const cl of cls) {
  const t = pairs.filter((q) => q.cl === cl);
  const xs = IMPLS.filter((i) => t.some((q) => q.x === i));
  const ys = IMPLS.filter((i) => t.some((q) => q.y === i));
  p();
  p(`### ${cl}`);
  p();
  p(`| X \\ Y | ${ys.map((y) => NAME[y]).join(" | ")} |`);
  p(`|---|${ys.map(() => "---").join("|")}|`);
  for (const x of xs) {
    p(`| ${NAME[x]} | ${ys.map((y) => { const q = t.find((v) => v.x === x && v.y === y); return q ? cell(q.r) : ""; }).join(" | ")} |`);
  }
}
p();

// Every failure and warning, with the sink's explanation
p("## Details");
p();
for (const f of files.sort()) {
  const r = load(f);
  const notes = Object.entries(r.cases).filter(([, v]) => v.status !== "pass");
  if (!notes.length && !r.extra?.length) continue;
  p(`- **${f.replace(".json", "")}**: ` + [
    ...notes.map(([c, v]) => `${SHORT[c]} ${v.status}${v.errors ? ` (${v.errors.join("; ")})` : ""}`),
    ...(r.extra || []),
  ].join("; "));
}
console.log(out.join("\n"));
