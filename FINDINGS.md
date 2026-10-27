# Findings

From the run of 2026-10-27 ([results/MATRIX.md](results/MATRIX.md)): 7 single relays and 32
relay pairs across 6 implementations and 7 convergence layers.

**Overall:** every pair that shares a convergence layer forwards bundles for the other.
Payloads, both CRC types, large bundles, hop count, unknown extension blocks and the
Previous Node block all come through correctly in every delivered run. The differences are
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

ION and uD3TN add their dwell time in code, and runs through them show +1 ms. For HDTN no
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

## Notes on the adapters

Two adapter mistakes showed up as "no delivery" in the first run and are fixed here: ION
needs a TCPCLv3 induct before it can send over TCPCLv3, and uD3TN must enable its outbound
convergence layer when it differs from the inbound one. Neither is a bug in the
implementation.
