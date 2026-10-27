// Loopback check of the reference convergence layers: every bundle sent must come back
// byte-identical.  node ref/selftest.mjs
import crypto from "node:crypto";
import { send, listen } from "./cl.mjs";

const CASES = {
  udp: [10, 1400, 9000],
  mtcp: [10, 70000, 3_000_000],
  stcp: [10, 70000, 3_000_000],
  tcpclv4: [10, 70000, 3_000_000], // 3 MB spans several 1 MiB segments
};

let failed = 0;
let port = 47000;
for (const [cl, sizes] of Object.entries(CASES)) {
  const bundles = sizes.map((n) => crypto.randomBytes(n));
  const got = [];
  const stop = listen(cl, ++port, (b) => got.push(Buffer.from(b)));
  await new Promise((r) => setTimeout(r, 200));
  await send(cl, "127.0.0.1", port, bundles);
  const deadline = Date.now() + 10000;
  while (got.length < bundles.length && Date.now() < deadline) await new Promise((r) => setTimeout(r, 50));
  stop();
  const ok = got.length === bundles.length && bundles.every((b, i) => b.equals(got[i]));
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"} ${cl}: ${got.length}/${bundles.length} bundles back, sizes ${sizes.join(", ")}`);
}
process.exit(failed ? 1 : 0);
