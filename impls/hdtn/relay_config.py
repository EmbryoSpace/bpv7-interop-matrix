"""Write HDTN's config and contact plan for a relay (see relay.sh for the environment)."""
import json
import os
import socket

env = os.environ
node = int(env["NODE"])
out_node = int(env["OUT_NODE"])
dest = int(env.get("DEST_NODE", "2"))
# "ltp-1" (one bundle per LTP block) only changes the sender side, which is not HDTN here
in_cl, out_cl = env["IN_CL"].replace("ltp-1", "ltp"), env["OUT_CL"].replace("ltp-1", "ltp")
in_port, out_port = int(env.get("IN_PORT", "4556")), int(env.get("OUT_PORT", "4556"))
out_host = env["OUT_HOST"]
LTP_PORT = 1113

NAMES = {"udp": "udp", "stcp": "stcp", "tcpclv3": "tcpcl_v3", "tcpclv4": "tcpcl_v4", "ltp": "ltp_over_udp"}
for cl in (in_cl, out_cl):
    if cl not in NAMES:
        raise SystemExit(f"hdtn: unsupported convergence layer {cl}")


def ip(host):
    return socket.gethostbyname(host)


ltp_common = {
    "ltpRandomNumberSizeBits": 32, "ltpMaxRetriesPerSerialNumber": 5, "oneWayLightTimeMs": 100,
    "oneWayMarginTimeMs": 100, "clientServiceId": 1, "numRxCircularBufferElements": 100,
    "keepActiveSessionDataOnDisk": False, "activeSessionDataOnDiskNewFileDurationMs": 2000,
    "activeSessionDataOnDiskDirectory": "./",
}

if in_cl == "ltp":
    induct = {"name": "in", "convergenceLayer": "ltp_over_udp", "boundPort": LTP_PORT, **ltp_common,
              "thisLtpEngineId": node, "remoteLtpEngineId": int(env["IN_PEER_NODE"]), "ltpReportSegmentMtu": 1000,
              "preallocatedRedDataBytes": 200000, "ltpRemoteUdpHostname": ip(env["IN_PEER_HOST"]),
              "ltpRemoteUdpPort": LTP_PORT, "ltpRxDataSegmentSessionNumberRecreationPreventerHistorySize": 1000,
              "ltpMaxExpectedSimultaneousSessions": 500, "ltpMaxUdpPacketsToSendPerSystemCall": 1,
              "delaySendingOfReportSegmentsTimeMsOrZeroToDisable": 20}
else:
    # HDTN rejects fields that do not belong to the convergence layer
    induct = {"name": "in", "convergenceLayer": NAMES[in_cl], "boundPort": in_port, "numRxCircularBufferElements": 200}
    if in_cl in ("udp", "tcpclv3", "tcpclv4"):
        induct["numRxCircularBufferBytesPerElement"] = 100000
    if in_cl in ("stcp", "tcpclv3", "tcpclv4"):
        induct["keepAliveIntervalSeconds"] = 15
    if in_cl == "tcpclv3":
        induct["tcpclV3MyMaxTxSegmentSizeBytes"] = 100000000
    if in_cl == "tcpclv4":
        induct.update({"tcpclV4MyMaxRxSegmentSizeBytes": 2000000, "tlsIsRequired": False, "certificatePemFile": "",
                       "privateKeyPemFile": "", "diffieHellmanParametersPemFile": ""})

outduct = {"name": "out", "convergenceLayer": NAMES[out_cl], "nextHopNodeId": out_node,
           "remoteHostname": ip(out_host), "remotePort": LTP_PORT if out_cl == "ltp" else out_port,
           "maxNumberOfBundlesInPipeline": 50, "maxSumOfBundleBytesInPipeline": 50000000}
if out_cl == "ltp":
    outduct.update({**ltp_common, "thisLtpEngineId": node, "remoteLtpEngineId": out_node, "ltpDataSegmentMtu": 1400,
                    "ltpCheckpointEveryNthDataSegment": 0, "ltpSenderBoundPort": LTP_PORT,
                    "ltpMaxUdpPacketsToSendPerSystemCall": 1, "ltpSenderPingSecondsOrZeroToDisable": 15,
                    "delaySendingOfDataSegmentsTimeMsOrZeroToDisable": 20})
elif out_cl in ("stcp", "tcpclv3", "tcpclv4"):
    outduct["keepAliveIntervalSeconds"] = 15
    if out_cl == "tcpclv3":
        outduct.update({"tcpclV3MyMaxTxSegmentSizeBytes": 200000, "tcpclAllowOpportunisticReceiveBundles": True})
    if out_cl == "tcpclv4":
        outduct.update({"tcpclAllowOpportunisticReceiveBundles": True, "tcpclV4MyMaxRxSegmentSizeBytes": 2000000,
                        "tryUseTls": False, "tlsIsRequired": False, "useTlsVersion1_3": False,
                        "doX509CertificateVerification": False, "verifySubjectAltNameInX509Certificate": False,
                        "certificationAuthorityPemFileForVerification": ""})

config = {
    "hdtnConfigName": "interop relay", "userInterfaceOn": False, "mySchemeName": "unused_scheme_name",
    "myNodeId": node, "myBpEchoServiceId": 2047, "myCustodialSsp": "unused_custodial_ssp", "myCustodialServiceId": 0,
    "myRouterServiceId": 100, "isAcsAware": False, "acsMaxFillsPerAcsPacket": 100, "acsSendPeriodMilliseconds": 1000,
    "retransmitBundleAfterNoCustodySignalMilliseconds": 10000, "maxBundleSizeBytes": 10000000,
    "maxIngressBundleWaitOnEgressMilliseconds": 2000, "bufferRxToStorageOnLinkUpSaturation": False,
    "maxLtpReceiveUdpPacketSizeBytes": 65536, "neighborDepletedStorageDelaySeconds": 0,
    "fragmentBundlesLargerThanBytes": 0, "enforceBundlePriority": False,
    "zmqBoundRouterPubSubPortPath": 10200, "zmqBoundTelemApiPortPath": 10305,
    "inductsConfig": {"inductConfigName": "in", "inductVector": [induct]},
    "outductsConfig": {"outductConfigName": "out", "outductVector": [outduct]},
    "storageConfig": {"storageImplementation": "asio_single_threaded", "tryToRestoreFromDisk": False,
                      "autoDeleteFilesOnExit": True, "totalStorageCapacityBytes": 1024000000,
                      "storageDeletionPolicy": "never",
                      "storageDiskConfigVector": [{"name": "d1", "storeFilePath": "/tmp/hdtn/store1.bin"}]},
}

nodes = sorted({node, out_node, dest} | ({int(env["IN_PEER_NODE"])} if env.get("IN_PEER_NODE") else set()))
contacts, n = [], 0
for a in nodes:
    for b in nodes:
        if a != b:
            n += 1
            contacts.append({"contact": n, "source": a, "dest": b, "startTime": 0, "endTime": 1000000,
                             "rateBitsPerSec": 100000000, "owlt": 0})

os.makedirs("/tmp/hdtn", exist_ok=True)
json.dump(config, open("/tmp/hdtn/hdtn.json", "w"), indent=1)
json.dump({"contacts": contacts}, open("/tmp/hdtn/plan.json", "w"), indent=1)
print(f"hdtn: ipn:{node} in {in_cl}:{in_port} -> out {out_cl} {out_host}:{outduct['remotePort']} (ipn:{out_node})")
