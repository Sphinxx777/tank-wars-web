#!/usr/bin/env python3
"""Create a synthetic TWS QA save from verified Tank Wars 3.2 packed layout.
Does not modify game executable or existing save. Research fixture, not a real game.
"""

from pathlib import Path
import struct, json, hashlib

root = Path(__file__).resolve().parents[2]
exe = (root / "research/original/BOMB.EXE").read_bytes()
assert (
    hashlib.sha256(exe).hexdigest()
    == "659ace6b9a97c30191a8f65cf25f22322c087166909e9fa1d522e529adbafd9d"
)
# OVR c701..c96c: consecutive BlockWrite calls, loaded in cc60..cecb.
fields = [
    (0x47D8, 2, 0),
    (0x47DA, 2, 2),
    (0x47E2, 2, 1),
    (0x47E4, 2, 0),
    (0x47E6, 2, 0),
    (0x47E8, 2, 0),
    (0x47EA, 2, 1),
    (0x47EC, 2, 0),
    (0x47EE, 1, 0),
    (0x4812, 1, 1),
    (0x4814, 1, 0),
    (0x4815, 1, 0),
    (0xE8A2, 2, 0),
    (0xE8A4, 2, 75),
    (0xE8A6, 2, 10),
    (0xE8A8, 2, 0),
    (0xE8AA, 2, 0),
    (0xE8AC, 2, 0),
    (0xE8AE, 2, 0x1FF),
    (0xE8B2, 1, 0),
    (0xE8B3, 1, 1),
    (0xE8B4, 1, 0),
    (0xE8B5, 1, 1),
    (0xE8B8, 1, 1),
    (0xE8BA, 1, 0),
    (0xE8BC, 1, 0),
]
# Version is Pascal string of length4: b'3.2\x00'. NUL is significant to header validation.
version = exe[0x16447 : 0x16447 + exe[0x16446]]
header = b"Tank Wars Saved Game\r\nV" + version + b"\r\n\x1a"
b = bytearray(header)
layout = []
for ds, size, value in fields:
    layout.append({"offset": len(b), "ds": hex(ds), "size": size, "value": value})
    b += value.to_bytes(size, "little")
players = []
for i in (1, 2):
    p = bytearray(0x74)

    def u(off, value):
        struct.pack_into("<H", p, off, value)

    def d(off, value):
        struct.pack_into("<i", p, off, value)

    p[0] = i
    name = f"Player {i}".encode()
    p[1] = len(name)
    p[2 : 2 + len(name)] = name
    u(0x0F, 40 if i == 1 else 280)
    u(0x11, 150)
    d(0x13, 200000 if i == 1 else 0)
    d(0x17, 0)
    u(0x1B, 200)
    u(0x1D, 75)
    u(0x1F, 1 if i == 1 else 65535)
    u(0x21, 100)
    p[0x23] = 1
    u(0x24, 1)
    u(0x26, 0)
    # All types stocked for broad screenshot coverage; no armed guidance.
    u(0x2A, 5 if i == 1 else 0)
    u(0x2C, 5 if i == 1 else 0)
    for weapon in range(18):
        u(
            0x2E + 2 * weapon,
            100 if i == 1 else (30 if weapon == 1 else 100 if weapon == 0 else 0),
        )
    if i == 1:
        d(0x52, 1000)
        d(0x56, 100)
        d(0x5A, 1)
    for off, value in zip(
        (0x60, 0x62, 0x64), ((1, 32767, 32767) if i == 1 else (32767, 1, 32767))
    ):
        u(off, value)
    u(0x66, i)
    players.append(
        {
            "player": i,
            "recordOffset": len(b),
            "recordSize": 116,
            "cashOffset": len(b) + 0x13,
            "inputTypeOffset": len(b) + 116,
        }
    )
    b += p
    b += struct.pack("<H", 1)  # keyboard type1 => no variable AI object follows
# OVRca02: trailing 0x247-byte player statistics table DS4838. Empty is valid zero stats.
tail = len(b)
b += bytes(0x247)
for folder in (root / "research/fixtures", root / "research/original"):
    target = folder / "QA200K.TWS"
    if target.exists() and target.read_bytes() != b:
        # Replace only our known v1 fixture with the corrected length-prefixed version payload.
        assert (
            hashlib.sha256(target.read_bytes()).hexdigest()
            == "4a4a458c08389f41f07596d41b9731322a2c914e58477ff5c585c30a483c747b"
        ), f"refusing overwrite different fixture {target}"
    target.write_bytes(b)
metadata = {
    "headerLength": len(header),
    "globals": layout,
    "players": players,
    "statisticsOffset": tail,
    "size": len(b),
    "sha256": hashlib.sha256(b).hexdigest(),
    "dynamicValidation": "pending original DOS load",
}
(root / "research/fixtures/QA200K-layout.json").write_text(
    json.dumps(metadata, indent=2) + "\n"
)
print(json.dumps(metadata, indent=2))
