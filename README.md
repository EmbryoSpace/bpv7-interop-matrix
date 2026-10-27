# bpv7-interop-matrix

Can one Bundle Protocol v7 (RFC 9171) implementation forward bundles for another? This
repository runs open-source DTN implementations as relays, singly and in every pair, over
every convergence layer they share, and checks what comes out the far end.

```
reference source --> relay X --(convergence layer)--> relay Y --> reference sink
```

The reference source sends nine test bundles; the reference sink decodes everything that
arrives (CRCs included) and checks each case against RFC 9171:

| Case | The relay must |
| --- | --- |
| basic, CRC-16, CRC-32C | deliver the bundle with the payload unchanged |
| large | deliver a large payload (60 KB, or one UDP datagram) unchanged |
| hop count | increase the hop count by one per relay (4.4.3) |
| unknown keep | keep an unknown extension block, byte for byte (4.2.4) |
| unknown discard | remove an unknown block flagged "discard block if it can't be processed" (5.6 step 4) |
| bundle age | increase the Bundle Age of a bundle without a creation time (4.4.2, 5.4 step 4) |
| previous node | remove the received Previous Node block, optionally inserting its own (5.4 step 4) |

A bundle age left unchanged is reported as a warning, not a failure: it can mean the relay
held the bundle for less than a millisecond.

## Implementations

| | Version | Convergence layers used |
| --- | --- | --- |
| [ION](https://github.com/nasa-jpl/ION-DTN) (NASA JPL) | `f3b5265d066a` | UDP, STCP, TCPCLv3, LTP |
| [HDTN](https://github.com/nasa/HDTN) (NASA Glenn) | `7fbe90cdbe3c` (2.0.0) | UDP, STCP, TCPCLv3, TCPCLv4, LTP |
| [bplib](https://github.com/nasa/bplib) bpcat (NASA Goddard) | `c5fb8358dd99` (7.0.5) | UDP |
| [uD3TN](https://gitlab.com/d3tn/ud3tn) | `v0.15.2` | MTCP, TCPCLv3 |
| [Hardy](https://github.com/ricktaylor/hardy) | `260fe751a0d8` | TCPCLv4 |
| [dtn7-rs](https://github.com/dtn7/dtn7-rs) | `dc26e2adcb50` | UDP, MTCP, TCPCLv4 |

Every implementation is built from upstream source, or from its published images pinned by
digest (Hardy), in `impls/<name>/Dockerfile`. Each has a `relay.sh` that configures it as a
relay from the same environment variables (node number, inbound and outbound convergence
layer, next hop).

`ltp-1` is LTP with one bundle per LTP block. ION aggregates several bundles into one LTP
block by default (`ltp`).

## Running

Needs Docker and Node.js.

```bash
./build.sh            # build the implementation images
./matrix.sh           # every single relay, then every pair (about an hour)
node report.mjs > results/MATRIX.md
```

One test:

```bash
./run.sh single hdtn udp udp
./run.sh pair ion hdtn ltp-1
```

`ref/selftest.mjs` checks the reference convergence layers (UDP, MTCP, STCP, TCPCLv4) in
loopback, and `ref/selftest_bpsec.mjs` checks the BIB code against RFC 9173 Appendix A.1.

## Results

See [results/MATRIX.md](results/MATRIX.md) and [FINDINGS.md](FINDINGS.md).

## Adding an implementation

Add `impls/<name>/Dockerfile` and `relay.sh` (see `impls/ion/relay.sh` for the
environment), its convergence layers to `CLS` in `matrix.sh`, and its reference
convergence layer to `ref_cl` in `run.sh` and `matrix.sh`.

## License

Apache-2.0
