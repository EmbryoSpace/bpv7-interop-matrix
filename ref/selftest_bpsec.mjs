// The BIB code reproduces RFC 9173 Appendix A.1 byte for byte.  node ref/selftest_bpsec.mjs
import assert from "node:assert/strict";
import { encodeBundle, decodeBundle, BLOCK } from "./bundle.mjs";
import { addBib, verifyBibs, SHA } from "./bpsec.mjs";

const hex = (s) => Buffer.from(s.replace(/\s+/g, ""), "hex");
const KEY = hex("1a2b1a2b1a2b1a2b1a2b1a2b1a2b1a2b");
const PAYLOAD = Buffer.from("Ready to generate a 32-byte payload");
const ORIGINAL = hex(`9f88070000820282010282028202018202820201820018281a000f424085010100
  005823526561647920746f2067656e657261746520612033322d62797465207061796c6f6164ff`);
const base = () => ({
  primary: { flags: 0, crcType: 0, dest: "ipn:1.2", source: "ipn:2.1", reportTo: "ipn:2.1", created: [0, 40], lifetime: 1000000 },
  blocks: [{ type: BLOCK.PAYLOAD, number: 1, flags: 0, crcType: 0, data: PAYLOAD }],
});

assert.ok(encodeBundle(base()).equals(ORIGINAL), "Appendix A original bundle");
const out = addBib(base(), { targets: [1], key: KEY, source: "ipn:2.1", shaVariant: SHA.HMAC512, scope: 0, number: 2 });
assert.equal(encodeBundle(out).toString("hex"), hex(`9f88070000820282010282028202018202820201820018281a000f4240850b0200
  005856810101018202820201828201078203008181820158403bdc69b3a34a2b5d3a
  8554368bd1e808f606219d2a10a846eae3886ae4ecc83c4ee550fdfb1cc636b904e2
  f1a73e303dcd4b6ccece003e95e8164dcc89a156e185010100005823526561647920
  746f2067656e657261746520612033322d62797465207061796c6f6164ff`).toString("hex"), "A.1 final bundle");
assert.equal(verifyBibs(decodeBundle(encodeBundle(out)), KEY).ok, true, "A.1 verifies");
console.log("PASS RFC 9173 A.1 byte for byte, and verifies");

// What the relay cases rely on: a change a relay could make breaks verification
const signed = (targets, scope) => decodeBundle(encodeBundle(addBib(base(), { targets, key: KEY, source: "ipn:2.1", scope })));
const reason = (b) => verifyBibs(decodeBundle(encodeBundle(b)), KEY, { a3Primary: false }).reason;
let b = signed([1], 0);
b.blocks.find((x) => x.type === BLOCK.PAYLOAD).data = Buffer.from("Ready to generate a 32-byte payloaD");
assert.equal(reason(b), "mac_mismatch", "payload changed");
b = signed([1], 0);
b.primary.lifetime += 1;
assert.equal(verifyBibs(b, KEY).ok, true, "scope 0: primary not covered");
b = signed([1], 0x7);
b.primary.lifetime += 1;
assert.equal(reason(b), "mac_mismatch", "scope 0x7: primary changed");
b = signed([1], 0x7);
b.blocks.find((x) => x.type === BLOCK.PAYLOAD).flags = 0x01;
assert.equal(reason(b), "mac_mismatch", "scope 0x7: target header changed");
b = signed([0], 0);
assert.equal(verifyBibs(b, KEY).ok, true, "BIB over the primary block verifies");
b.primary.crcType = 2;
assert.equal(reason(b), "target_has_crc", "CRC added back to the primary block");
b = signed([0], 0);
b.primary.created = [0, 41];
assert.equal(reason(b), "mac_mismatch", "primary block changed");
console.log("PASS changes to signed blocks are detected");
