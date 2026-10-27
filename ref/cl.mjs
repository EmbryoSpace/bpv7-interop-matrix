// Reference convergence layers: hand raw BPv7 bundles to a DTN node, or catch the bundles
// it forwards, without touching the bundle bytes.
//
//   udp      one bundle per datagram (RFC 7122 style; ION, HDTN, bplib, dtn7-rs)
//   mtcp     TCP stream of CBOR byte strings (uD3TN, dtn7-rs)
//   stcp     TCP stream of 4-byte big-endian length + bundle, 0 = keepalive (ION, HDTN)
//   tcpclv4  RFC 9174 TCP Convergence Layer v4, no TLS (HDTN, Hardy, dtn7-rs)
//
// As a library: send(cl, host, port, bundles) and listen(cl, port, onBundle).
// As a tool:
//   node cl.mjs send <cl> <host> <port> <bundle.hex> [...]
//   node cl.mjs recv <cl> <port> <outdir> <count> [secs]
import fs from "node:fs";
import net from "node:net";
import dgram from "node:dgram";
import path from "node:path";
import { encode, bstr, decodeAt } from "./cbor.mjs";

const NODE_ID = process.env.REF_NODE_ID || "ipn:1.0";

// ---- TCPCLv4 (RFC 9174) ---------------------------------------------------------------

const T4 = { XFER_SEGMENT: 1, XFER_ACK: 2, XFER_REFUSE: 3, KEEPALIVE: 4, SESS_TERM: 5, MSG_REJECT: 6, SESS_INIT: 7 };
const SEG_END = 0x01, SEG_START = 0x02;

const u16 = (n) => { const b = Buffer.alloc(2); b.writeUInt16BE(n); return b; };
const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b; };
const u64 = (n) => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(n)); return b; };

const contactHeader = () => Buffer.concat([Buffer.from("dtn!"), Buffer.from([0x04, 0x00])]);

function sessInit(keepalive = 0) {
  const id = Buffer.from(NODE_ID);
  return Buffer.concat([Buffer.from([T4.SESS_INIT]), u16(keepalive), u64(1 << 20), u64(1 << 24),
    u16(id.length), id, u32(0)]);
}

function xferSegments(transferId, data, mru = 1 << 20) {
  const out = [];
  for (let off = 0; off < data.length || off === 0; off += mru) {
    const chunk = data.subarray(off, off + mru);
    let flags = 0;
    if (off === 0) flags |= SEG_START;
    if (off + mru >= data.length) flags |= SEG_END;
    const ext = flags & SEG_START ? u32(0) : Buffer.alloc(0);
    out.push(Buffer.concat([Buffer.from([T4.XFER_SEGMENT, flags]), u64(transferId), ext, u64(chunk.length), chunk]));
    if (data.length === 0) break;
  }
  return out;
}

// Incremental parser for one direction of a TCPCLv4 session (after the contact header).
// Returns the messages complete so far and how many bytes they used.
function parseT4(buf) {
  const msgs = [];
  let off = 0;
  const need = (n) => off + n <= buf.length;
  while (need(1)) {
    const start = off, type = buf[off];
    if (type === T4.KEEPALIVE) { msgs.push({ type }); off += 1; continue; }
    if (type === T4.SESS_INIT) {
      if (!need(1 + 2 + 8 + 8 + 2)) break;
      const keepalive = buf.readUInt16BE(off + 1);
      const segMru = buf.readBigUInt64BE(off + 3);
      const idLen = buf.readUInt16BE(off + 19);
      if (!need(21 + idLen + 4)) break;
      const nodeId = buf.subarray(off + 21, off + 21 + idLen).toString();
      const extLen = buf.readUInt32BE(off + 21 + idLen);
      if (!need(25 + idLen + extLen)) break;
      off += 25 + idLen + extLen;
      msgs.push({ type, keepalive, segMru, nodeId });
      continue;
    }
    if (type === T4.XFER_SEGMENT) {
      if (!need(10)) break;
      const flags = buf[off + 1], id = buf.readBigUInt64BE(off + 2);
      let p = off + 10;
      if (flags & SEG_START) { if (!need(p - off + 4)) break; p += 4 + buf.readUInt32BE(p); }
      if (p + 8 > buf.length) break;
      const len = Number(buf.readBigUInt64BE(p)); p += 8;
      if (p + len > buf.length) break;
      msgs.push({ type, flags, id, data: buf.subarray(p, p + len) });
      off = p + len;
      continue;
    }
    if (type === T4.XFER_ACK) { if (!need(18)) break; msgs.push({ type, id: buf.readBigUInt64BE(off + 2) }); off += 18; continue; }
    if (type === T4.XFER_REFUSE) { if (!need(10)) break; msgs.push({ type, reason: buf[off + 1], id: buf.readBigUInt64BE(off + 2) }); off += 10; continue; }
    if (type === T4.SESS_TERM) { if (!need(3)) break; msgs.push({ type, flags: buf[off + 1], reason: buf[off + 2] }); off += 3; continue; }
    if (type === T4.MSG_REJECT) { if (!need(3)) break; msgs.push({ type, reason: buf[off + 1] }); off += 3; continue; }
    throw new Error(`tcpclv4: unknown message type 0x${type.toString(16)} at offset ${start}`);
  }
  return { msgs, used: off };
}

// One TCPCLv4 session on a connected socket. Calls onBundle for each complete transfer,
// and resolves ready() once both SESS_INITs have been exchanged.
function t4Session(sock, active, onBundle) {
  let buf = Buffer.alloc(0), gotHeader = false, ready, readyP = new Promise((r) => (ready = r));
  const parts = new Map();
  const acks = new Map();
  sock.on("data", (d) => {
    buf = Buffer.concat([buf, d]);
    if (!gotHeader) {
      if (buf.length < 6) return;
      if (buf.subarray(0, 4).toString() !== "dtn!" || buf[4] !== 4) {
        sock.destroy(new Error(`tcpclv4: peer contact header ${buf.subarray(0, 6).toString("hex")}`));
        return;
      }
      gotHeader = true;
      buf = buf.subarray(6);
      if (!active) sock.write(contactHeader());
      sock.write(sessInit());
    }
    const { msgs, used } = parseT4(buf);
    buf = buf.subarray(used);
    for (const m of msgs) {
      if (m.type === T4.SESS_INIT) ready();
      else if (m.type === T4.KEEPALIVE) sock.write(Buffer.from([T4.KEEPALIVE]));
      else if (m.type === T4.XFER_SEGMENT) {
        const key = m.id.toString();
        const acc = Buffer.concat([parts.get(key) || Buffer.alloc(0), m.data]);
        parts.set(key, acc);
        sock.write(Buffer.concat([Buffer.from([T4.XFER_ACK, m.flags]), u64(m.id), u64(acc.length)]));
        if (m.flags & SEG_END) { parts.delete(key); onBundle(acc); }
      } else if (m.type === T4.XFER_ACK) { acks.get(m.id.toString())?.(); }
      else if (m.type === T4.XFER_REFUSE) { acks.get(m.id.toString())?.(new Error(`refused, reason ${m.reason}`)); }
      else if (m.type === T4.SESS_TERM) {
        // Reply unless this SESS_TERM is itself a reply (RFC 9174 6.1)
        if (!(m.flags & 0x01)) sock.write(Buffer.from([T4.SESS_TERM, 0x01, m.reason]));
        sock.end();
      }
    }
  });
  if (active) sock.write(contactHeader());
  let nextId = 0;
  return {
    ready: () => readyP,
    sendBundle: (data) => new Promise((resolve, reject) => {
      const id = BigInt(nextId++);
      acks.set(id.toString(), (err) => (err ? reject(err) : resolve()));
      for (const seg of xferSegments(id, data)) sock.write(seg);
    }),
    end: () => { sock.write(Buffer.from([T4.SESS_TERM, 0x00, 0x00])); setTimeout(() => sock.end(), 500); },
  };
}

// ---- public API -----------------------------------------------------------------------

export async function send(cl, host, port, bundles) {
  if (cl === "udp") {
    const s = dgram.createSocket("udp4");
    for (const b of bundles) await new Promise((r, j) => s.send(b, port, host, (e) => (e ? j(e) : r())));
    s.close();
    return;
  }
  const sock = await new Promise((resolve, reject) => {
    const s = net.connect(port, host, () => resolve(s));
    s.on("error", reject);
  });
  if (cl === "tcpclv4") {
    const sess = t4Session(sock, true, () => {});
    await sess.ready();
    for (const b of bundles) await sess.sendBundle(b);
    sess.end();
    return;
  }
  for (const b of bundles) {
    if (cl === "mtcp") sock.write(encode(bstr(b)));
    else if (cl === "stcp") sock.write(Buffer.concat([u32(b.length), b]));
    else throw new Error(`unknown cl ${cl}`);
  }
  await new Promise((r) => setTimeout(r, 2000));
  sock.end();
}

export function listen(cl, port, onBundle) {
  if (cl === "udp") {
    const s = dgram.createSocket("udp4");
    s.on("message", (m) => onBundle(Buffer.from(m)));
    s.bind(port, "0.0.0.0");
    return () => s.close();
  }
  const server = net.createServer((sock) => {
    sock.on("error", () => {});
    if (cl === "tcpclv4") { t4Session(sock, false, onBundle); return; }
    let buf = Buffer.alloc(0);
    sock.on("data", (d) => {
      buf = Buffer.concat([buf, d]);
      for (;;) {
        if (cl === "stcp") {
          if (buf.length < 4) break;
          const n = buf.readUInt32BE(0);
          if (buf.length < 4 + n) break;
          if (n > 0) onBundle(buf.subarray(4, 4 + n));
          buf = buf.subarray(4 + n);
        } else if (cl === "mtcp") {
          let r;
          try { r = decodeAt(buf, 0); } catch { break; } // incomplete CBOR item
          onBundle(Buffer.from(r.value));
          buf = buf.subarray(r.end);
        } else throw new Error(`unknown cl ${cl}`);
      }
    });
  });
  server.listen(port, "0.0.0.0");
  return () => server.close();
}

// ---- command line ---------------------------------------------------------------------

if (import.meta.url === `file://${process.argv[1]}`) {
  const [mode, cl, ...rest] = process.argv.slice(2);
  if (mode === "send") {
    const [host, port, ...files] = rest;
    const bundles = files.map((f) => Buffer.from(fs.readFileSync(f, "utf8").trim(), "hex"));
    await send(cl, host, Number(port), bundles);
  } else if (mode === "recv") {
    const [port, outdir, countS, secsS] = rest;
    const count = Number(countS), secs = Number(secsS || 60);
    fs.mkdirSync(outdir, { recursive: true });
    let n = 0;
    const stop = listen(cl, Number(port), (b) => {
      fs.writeFileSync(path.join(outdir, `${String(n++).padStart(3, "0")}.hex`), b.toString("hex"));
      if (n >= count) { stop(); process.exit(0); }
    });
    setTimeout(() => { console.error(`[${cl}] received ${n}/${count} in ${secs} s`); process.exit(1); }, secs * 1000);
  } else {
    console.error("usage: cl.mjs send <cl> <host> <port> <bundle.hex>... | recv <cl> <port> <outdir> <count> [secs]");
    process.exit(2);
  }
}
