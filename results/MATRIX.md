# Results

Generated 2026-10-27 from 39 test runs.
✓ pass, ~ warning, ✗ fail, – not delivered.

## Single relay

Reference source -> implementation -> reference sink.

| Implementation | CL | basic | CRC-16 | CRC-32C | large | hop count | unknown keep | unknown discard | bundle age | prev node | BIB payload | BIB payload+scope | BIB primary |
|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| ION | udp | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – |
| HDTN | udp | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ~ | ✓ | ✓ | ✓ | ✓ |
| uD3TN | mtcp | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Hardy | tcpclv4 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ~ | ✓ | ✓ | ✓ | ✓ |
| bplib | udp | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – | ✓ | ✓ | ✓ | – |
| bplib + fixes | udp | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ~ | ✓ | ✓ | ✓ | – |
| dtn7-rs | udp | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

## Pairs

Reference source -> X -> Y -> reference sink, with X and Y linked by the named convergence layer.
Rows are X (sender), columns are Y (receiver). A cell lists the checks that passed out of 12
(warnings count as passed) and names any check that failed or whose bundle did not arrive.

### ltp

| X \ Y | ION | HDTN |
|---|---|---|
| ION |  | no delivery |
| HDTN | 11/12: – BIB primary |  |

### ltp-1

| X \ Y | ION | HDTN |
|---|---|---|
| ION |  | 11/12: – BIB primary |
| HDTN | 11/12: – BIB primary |  |

### mtcp

| X \ Y | uD3TN | dtn7-rs |
|---|---|---|
| uD3TN |  | 12/12 |
| dtn7-rs | 12/12 |  |

### stcp

| X \ Y | ION | HDTN |
|---|---|---|
| ION |  | 11/12: – BIB primary |
| HDTN | 11/12: – BIB primary |  |

### tcpclv3

| X \ Y | ION | HDTN | uD3TN |
|---|---|---|---|
| ION |  | 11/12: – BIB primary | 11/12: – BIB primary |
| HDTN | 11/12: – BIB primary |  | 12/12 |
| uD3TN | 11/12: – BIB primary | 12/12 |  |

### tcpclv4

| X \ Y | HDTN | Hardy | dtn7-rs |
|---|---|---|---|
| HDTN |  | 12/12 | 12/12 |
| Hardy | 12/12 |  | 12/12 |
| dtn7-rs | 12/12 | 12/12 |  |

### udp

| X \ Y | ION | HDTN | bplib | dtn7-rs |
|---|---|---|---|---|
| ION |  | 11/12: – BIB primary | 10/12: – bundle age, – BIB primary | 11/12: – BIB primary |
| HDTN | 11/12: – BIB primary |  | 10/12: – bundle age, – BIB primary | 12/12 |
| bplib | 10/12: – bundle age, – BIB primary | 10/12: – bundle age, – BIB primary |  | 10/12: – bundle age, – BIB primary |
| dtn7-rs | 11/12: – BIB primary | 12/12 | 10/12: – bundle age, – BIB primary |  |

## Details

- **pair_bplib_dtn7_udp**: bundle age missing; BIB primary missing
- **pair_bplib_hdtn_udp**: bundle age missing; BIB primary missing
- **pair_bplib_ion_udp**: bundle age missing; BIB primary missing
- **pair_dtn7_bplib_udp**: bundle age missing; BIB primary missing
- **pair_dtn7_hardy_tcpclv4**: bundle age warn (bundle age unchanged (dwell under 1 ms, or not updated))
- **pair_dtn7_hdtn_tcpclv4**: bundle age warn (bundle age unchanged (dwell under 1 ms, or not updated))
- **pair_dtn7_hdtn_udp**: bundle age warn (bundle age unchanged (dwell under 1 ms, or not updated))
- **pair_dtn7_ion_udp**: BIB primary missing
- **pair_dtn7_ud3tn_mtcp**: bundle age warn (bundle age unchanged (dwell under 1 ms, or not updated))
- **pair_hardy_dtn7_tcpclv4**: bundle age warn (bundle age unchanged (dwell under 1 ms, or not updated))
- **pair_hardy_hdtn_tcpclv4**: bundle age warn (bundle age unchanged (dwell under 1 ms, or not updated))
- **pair_hdtn_bplib_udp**: bundle age missing; BIB primary missing
- **pair_hdtn_dtn7_udp**: bundle age warn (bundle age unchanged (dwell under 1 ms, or not updated))
- **pair_hdtn_ion_ltp-1**: bundle age warn (bundle age unchanged (dwell under 1 ms, or not updated)); BIB primary missing
- **pair_hdtn_ion_ltp**: BIB primary missing
- **pair_hdtn_ion_stcp**: bundle age warn (bundle age unchanged (dwell under 1 ms, or not updated)); BIB primary missing
- **pair_hdtn_ion_tcpclv3**: BIB primary missing
- **pair_hdtn_ion_udp**: bundle age warn (bundle age unchanged (dwell under 1 ms, or not updated)); BIB primary missing
- **pair_hdtn_ud3tn_tcpclv3**: bundle age warn (bundle age unchanged (dwell under 1 ms, or not updated))
- **pair_ion_bplib_udp**: bundle age missing; BIB primary missing
- **pair_ion_dtn7_udp**: bundle age warn (bundle age unchanged (dwell under 1 ms, or not updated)); BIB primary missing
- **pair_ion_hdtn_ltp-1**: bundle age warn (bundle age unchanged (dwell under 1 ms, or not updated)); BIB primary missing
- **pair_ion_hdtn_ltp**: basic missing; CRC-16 missing; CRC-32C missing; large missing; hop count missing; unknown keep missing; unknown discard missing; bundle age missing; prev node missing; BIB payload missing; BIB payload+scope missing; BIB primary missing
- **pair_ion_hdtn_stcp**: BIB primary missing
- **pair_ion_hdtn_tcpclv3**: bundle age warn (bundle age unchanged (dwell under 1 ms, or not updated)); BIB primary missing
- **pair_ion_hdtn_udp**: bundle age warn (bundle age unchanged (dwell under 1 ms, or not updated)); BIB primary missing
- **pair_ion_ud3tn_tcpclv3**: bundle age warn (bundle age unchanged (dwell under 1 ms, or not updated)); BIB primary missing
- **pair_ud3tn_ion_tcpclv3**: BIB primary missing
- **single_bplib-fixed_udp_udp**: bundle age warn (bundle age unchanged (dwell under 1 ms, or not updated)); BIB primary missing
- **single_bplib_udp_udp**: bundle age missing; BIB primary missing
- **single_hardy_tcpclv4_tcpclv4**: bundle age warn (bundle age unchanged (dwell under 1 ms, or not updated))
- **single_hdtn_udp_udp**: unknown discard fail (unknown block (discard flag) kept); bundle age warn (bundle age unchanged (dwell under 1 ms, or not updated))
- **single_ion_udp_udp**: BIB primary missing
