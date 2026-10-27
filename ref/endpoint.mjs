// Reference BPv7 source and sink for the interop matrix.
//
//   node endpoint.mjs source <cl> <host> <port> <maxBundle>
//       sends the test cases (source ipn:1.1, destination ipn:2.1) to the first relay
//   node endpoint.mjs sink <cl> <port> <secs> <relays> <result.json>
//       catches what the last relay forwards and checks each case
//
// Every test bundle carries its case name in the payload, so the sink can tell them apart.
import fs from "node:fs";
import crypto from "node:crypto";
import { send, listen } from "./cl.mjs";
import { encodeBundle, decodeBundle, encodeEid, decodeEid, CRC_NONE, CRC16, CRC32C, BLOCK, BLOCK_FLAG } from "./bundle.mjs";
import { encode, decodeAt } from "./cbor.mjs";

const SRC = "ipn:1.1", DST = "ipn:2.1", LIFETIME = 3_600_000;
const UNKNOWN_KEEP = 200, UNKNOWN_DISCARD = 201;

// Deterministic payload: case name, then filler bytes derived from it
function payload(name, size) {
  const head = Buffer.from(`${name}:`);
  const fill = crypto.createHash("sha256").update(name).digest();
  const body = Buffer.alloc(Math.max(0, size - head.length));
  for (let i = 0; i < body.length; i++) body[i] = fill[i % fill.length];
  return Buffer.concat([head, body]);
}

function cases(maxBundle) {
  const now = Date.now() - Date.UTC(2000, 0, 1);
  const P = (name, size = 64, crcType = CRC_NONE) => ({ type: BLOCK.PAYLOAD, number: 1, flags: 0, crcType, data: payload(name, size) });
  const prim = (seq, over = {}) => ({ flags: 0, crcType: CRC32C, dest: DST, source: SRC, reportTo: "dtn:none",
    created: [now, seq], lifetime: LIFETIME, ...over });
  const big = Math.max(200, maxBundle - 200);
  return {
    basic: { primary: prim(1), blocks: [P("basic")] },
    crc16: { primary: prim(2, { crcType: CRC16 }), blocks: [P("crc16", 64, CRC16)] },
    crc32c_payload: { primary: prim(3), blocks: [P("crc32c_payload", 64, CRC32C)] },
    large: { primary: prim(4), blocks: [P("large", big)] },
    hop_count: { primary: prim(5), blocks: [
      { type: BLOCK.HOP_COUNT, number: 2, flags: 0, crcType: CRC_NONE, data: encode([30, 0]) }, P("hop_count")] },
    unknown_keep: { primary: prim(6), blocks: [
      { type: UNKNOWN_KEEP, number: 2, flags: 0, crcType: CRC_NONE, data: Buffer.from("keep-this-block!") }, P("unknown_keep")] },
    unknown_discard: { primary: prim(7), blocks: [
      { type: UNKNOWN_DISCARD, number: 2, flags: BLOCK_FLAG.DISCARD_BLOCK_IF_UNPROCESSED, crcType: CRC_NONE,
        data: Buffer.from("discard-this-one") }, P("unknown_discard")] },
    no_clock_age: { primary: prim(8, { created: [0, 8] }), blocks: [
      { type: BLOCK.BUNDLE_AGE, number: 2, flags: 0, crcType: CRC_NONE, data: encode(1000) }, P("no_clock_age")] },
    previous_node: { primary: prim(9), blocks: [
      { type: BLOCK.PREVIOUS_NODE, number: 2, flags: 0, crcType: CRC_NONE, data: encode(encodeEid("ipn:1.0")) }, P("previous_node")] },
  };
}

// What each case must look like after crossing <relays> relays. Returns a list of problems.
function check(name, sent, got, relays) {
  const errs = [];
  const block = (b, t) => b.blocks.find((x) => x.type === t);
  for (const f of ["dest", "source", "lifetime"]) {
    if (got.primary[f] !== sent.primary[f]) errs.push(`primary ${f} changed: ${sent.primary[f]} -> ${got.primary[f]}`);
  }
  // The sink rebuilds the cases with its own clock, so only the sequence number and a
  // zero (clockless) creation time can be compared.
  if (got.primary.created[1] !== sent.primary.created[1]) errs.push("creation sequence number changed");
  if ((sent.primary.created[0] === 0) !== (got.primary.created[0] === 0)) errs.push("creation time changed");
  if (!block(got, BLOCK.PAYLOAD).data.equals(block(sent, BLOCK.PAYLOAD).data)) errs.push("payload changed");

  if (name === "hop_count") {
    const h = block(got, BLOCK.HOP_COUNT);
    if (!h) errs.push("hop count block removed");
    else {
      const [limit, count] = decodeAt(h.data).value;
      if (limit !== 30) errs.push(`hop limit changed to ${limit}`);
      if (count !== relays) errs.push(`hop count ${count}, expected ${relays}`);
    }
  }
  if (name === "unknown_keep") {
    const u = block(got, UNKNOWN_KEEP);
    if (!u) errs.push("unknown block (keep) removed");
    else if (!u.data.equals(block(sent, UNKNOWN_KEEP).data)) errs.push("unknown block (keep) data changed");
  }
  if (name === "unknown_discard" && block(got, UNKNOWN_DISCARD)) errs.push("unknown block (discard flag) kept");
  if (name === "no_clock_age") {
    const a = block(got, BLOCK.BUNDLE_AGE);
    if (!a) errs.push("bundle age block removed");
    else {
      const age = Number(decodeAt(a.data).value);
      if (age < 1000) errs.push(`bundle age decreased (${age} ms)`);
      // Unchanged can mean a dwell time under 1 ms, so it is a warning, not a failure
      else if (age === 1000) errs.push("WARN bundle age unchanged (dwell under 1 ms, or not updated)");
      else errs.note = `bundle age +${age - 1000} ms`;
    }
  }
  if (name === "previous_node") {
    // RFC 9171 5.4 step 4: the received Previous Node block MUST be removed; inserting a
    // new one is optional. So the block may be absent, but must not still name ipn:1.0.
    const p = block(got, BLOCK.PREVIOUS_NODE);
    if (p) {
      const eid = decodeEid(decodeAt(p.data).value);
      if (eid === "ipn:1.0") errs.push("previous node block not removed or replaced (still ipn:1.0)");
      else errs.note = `previous node ${eid}`;
    } else errs.note = "previous node block removed, none inserted";
  }
  return errs;
}

const [mode, ...args] = process.argv.slice(2);

if (mode === "source") {
  const [cl, host, port, maxS] = args;
  const all = cases(Number(maxS));
  await send(cl, host, Number(port), Object.values(all).map(encodeBundle));
  console.log(`[source] sent ${Object.keys(all).length} bundles over ${cl} to ${host}:${port}`);
} else if (mode === "sink") {
  const [cl, port, secsS, relaysS, out] = args;
  const relays = Number(relaysS);
  const sent = cases(1_000_000); // only names and fixed fields are compared
  const results = Object.fromEntries(Object.keys(sent).map((n) => [n, { status: "missing" }]));
  const extra = [];
  const stop = listen(cl, Number(port), (raw) => {
    let b;
    try { b = decodeBundle(raw); } catch (e) { extra.push(`undecodable bundle: ${e.message}`); return; }
    const pay = b.blocks.find((x) => x.type === BLOCK.PAYLOAD).data;
    const name = pay.subarray(0, pay.indexOf(":")).toString();
    if (!sent[name]) { extra.push(`unexpected bundle to ${b.primary.dest}`); return; }
    const ref = name === "large" ? { ...sent[name], blocks: [{ ...sent[name].blocks[0], data: pay }] } : sent[name];
    // "large" is sized by the source; compare it against the filler pattern instead
    const errs = check(name, ref, b, relays);
    if (name === "large" && !pay.equals(payload("large", pay.length))) errs.push("payload changed");
    const fails = errs.filter((e) => !e.startsWith("WARN "));
    const warns = errs.filter((e) => e.startsWith("WARN ")).map((e) => e.slice(5));
    if (fails.length) results[name] = { status: "fail", errors: [...fails, ...warns] };
    else if (warns.length) results[name] = { status: "warn", errors: warns };
    else results[name] = { status: "pass", ...(errs.note ? { note: errs.note } : {}) };
  });
  // Wait for every case to arrive, or until the timeout
  const deadline = Date.now() + Number(secsS) * 1000;
  while (Date.now() < deadline && Object.values(results).some((r) => r.status === "missing")) {
    await new Promise((r) => setTimeout(r, 250));
  }
  await new Promise((r) => setTimeout(r, 1000)); // catch duplicates arriving right after
  stop();
  const summary = { relays, cases: results, extra };
  fs.writeFileSync(out, JSON.stringify(summary, null, 2));
  for (const [n, r] of Object.entries(results)) {
    const why = r.errors ? ": " + r.errors.join("; ") : r.note ? ` (${r.note})` : "";
    console.log(`[sink] ${r.status.padEnd(7)} ${n}${why}`);
  }
  for (const e of extra) console.log(`[sink] ${e}`);
  process.exit(0);
} else {
  console.error("usage: endpoint.mjs source <cl> <host> <port> <maxBundle> | sink <cl> <port> <secs> <relays> <result.json>");
  process.exit(2);
}
