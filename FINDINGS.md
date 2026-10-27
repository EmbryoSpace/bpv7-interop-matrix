# Findings

From the run of 2026-10-27 ([results/MATRIX.md](results/MATRIX.md)): 7 single relays and 32
relay pairs across 6 implementations and 7 convergence layers, 12 test cases each.

**Overall:** every pair that shares a convergence layer forwards bundles for the other.
Payloads, both CRC types, large bundles, hop count, unknown extension blocks, the
Previous Node block and BPSec integrity blocks over the payload all come through correctly
in every delivered run. The differences are
in the details below.

## 1. HDTN keeps unknown blocks flagged "discard" (single relay)

RFC 9171 section 5.6 step 4: a block that can't be processed and has the "discard block if
it can't be processed" flag (0x10) must be removed. HDTN as a single relay forwards the
type 201 test block with that flag still in place.

In pairs this is hidden whenever the next relay is another implementation, because that
relay removes the block itself.

Reported: [nasa/HDTN#81](https://github.com/nasa/HDTN/issues/81).

## 2. ION to HDTN over LTP: nothing delivered with ION's default aggregation

ION aggregates several bundles into one LTP block by default. HDTN receives the LTP
sessions but delivers none of the bundles. With one bundle per LTP block (`ltp-1`), all
nine cases pass, and HDTN to ION passes in both modes.

Asked upstream: [nasa/HDTN#82](https://github.com/nasa/HDTN/issues/82).

## 3. Bundle Age: this test can't yet tell a fast relay from one that ignores it

For a bundle created without a clock (creation time 0), every relay must increase the
Bundle Age block by the time it held the bundle (RFC 9171 sections 4.4.2 and 5.4). In
most runs the age arrives unchanged, which is reported as a warning: a relay that holds a
bundle for under a millisecond can correctly add 0.

ION, uD3TN and dtn7-rs increased it in the single-relay runs (+1 to +2 ms; ION and uD3TN
add their dwell time in code). HDTN, Hardy and bplib with fixes left it unchanged. For HDTN no
BPv7 Bundle Age update was found in the code: [nasa/HDTN#80](https://github.com/nasa/HDTN/issues/80).
A case that makes each relay hold the bundle for a known time would settle the rest.

## 4. Upstream bplib drops bundles with no creation time

bplib's bpcat (7.0.5) drops the bundle with creation time 0, so the bundle age case is
never delivered through it, singly or in any pair. The build with the proposed fixes
(`bplib + fixes`) delivers it.

Reported: [nasa/bplib#269](https://github.com/nasa/bplib/issues/269), fix in
[nasa/bplib#272](https://github.com/nasa/bplib/pull/272).

## 5. Convergence layer coverage

- ION speaks TCPCLv3 only (`bpv7/tcp/tcpcli.c` sends version 3), so it has no TCP path to
  Hardy, which speaks TCPCLv4 only.
- bplib's bpcat has UDP only.
- The only convergence layer shared by all of ION, HDTN and dtn7-rs is UDP; uD3TN and
  Hardy join through TCPCLv3, MTCP or TCPCLv4.

## 6. dtn7-rs master does not build

After the v0.22.0 release commit, `examples/Cargo.toml` still requires `dtn7 = "^0.21.0"`,
so a fresh clone fails to build. The image here patches the version.

Fix proposed: [dtn7/dtn7-rs#89](https://github.com/dtn7/dtn7-rs/pull/89).

## 7. BPSec: integrity blocks survive relays, except over the primary block in ION and bplib

Three cases carry a Block Integrity Block (RFC 9172) with the BIB-HMAC-SHA2 context
(RFC 9173), signed with a test key the relays do not have. The sink verifies it.

- **BIB over the payload** (scope 0, and scope 0x7, which also covers the primary block and
  both block headers): verifies after every relay and every pair that delivers. No relay
  re-encodes the primary block or changes a block header.
- **BIB over the primary block**, with the primary block's CRC removed (RFC 9171 section
  4.3.1 allows CRC type 0 only in that case): HDTN, uD3TN, Hardy and dtn7-rs forward it
  and it verifies. ION and bplib drop it, so it is lost on every path through either.
  - **ION** (`bpv7/library/ext/bpsec/bib.c`, `bpsec_verify`): at a waypoint with no
    policy rule for the BIB, the target is skipped ("Missing rule is not a problem at a
    waypoint node"), so `primeBibcheck` is never set; the later check for a primary block
    with neither a CRC nor a BIB then marks the bundle inauthentic, and it is discarded
    ("No primary block BIB or primary block CRC."). The rule-less path for a non-waypoint
    sets `primeBibcheck`; the waypoint path does not. Reported:
    [nasa-jpl/ION-DTN#139](https://github.com/nasa-jpl/ION-DTN/issues/139).
  - **bplib** (7.0.5, `bplib_cbor_decode_primary.c`): rejects a primary block with CRC type
    0. Documented in the code: security blocks are not supported yet.

`ref/selftest_bpsec.mjs` checks the signing code against RFC 9173 Appendix A.1 and that a
changed payload, primary block or block header, or a CRC put back on the primary block,
fails verification.

## 8. Network management: no common interface

Each implementation has its own management path, found in the shipped code:

| | Management interface |
| --- | --- |
| ION | `ionadmin`, `bpadmin` and other admin programs; `nm_agent` and `nm_mgr` for remote network management |
| HDTN | telemetry and command module (`telem_cmd_interface`) with a websocket server |
| uD3TN | AAP 2.0 (protobuf): links and forwarding are set by an outside agent over the same interface |
| Hardy | gRPC between the BPA, its convergence layers and applications; static routes in configuration |
| dtn7-rs | HTTP web interface and API (`--web-port`, default 3000) |
| bplib / BPNode | cFS ground commands (contact setup, start, stop) and housekeeping telemetry |

Only ION ships a remote network management agent. Managing a mixed network (a Mars relay
built from several of these) would need an adapter per implementation, or a common agent
such as DTNMA (RFC 9675) on each.

## Notes on the adapters

Two adapter mistakes showed up as "no delivery" in the first run and are fixed here: ION
needs a TCPCLv3 induct before it can send over TCPCLv3, and uD3TN must enable its outbound
convergence layer when it differs from the inbound one. Neither is a bug in the
implementation.
