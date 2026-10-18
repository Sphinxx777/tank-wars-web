#!/usr/bin/env python3
"""Capture original AI shop selections by executing BOMB.OVR instructions.

Optional research dependency: unicorn (PYTHONPATH=/tmp/tankwars-research-pylib).
Original binaries are local-only and are not shipped by this repository.
The oracle runs selection OVR 0xa085..0xa4d2, including the resident getter,
set-membership, and integer multiplication routines from the original EXE.
"""

import json
import struct
from pathlib import Path

from unicorn import Uc, UC_ARCH_X86, UC_MODE_16
from unicorn.x86_const import (
    UC_X86_REG_BP,
    UC_X86_REG_CS,
    UC_X86_REG_DS,
    UC_X86_REG_SP,
    UC_X86_REG_SS,
)

EXE = Path("research/original/BOMB.EXE").read_bytes()
OVR = Path("research/original/BOMB.OVR").read_bytes()
WEAPONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14, 15, 16, 17]
ENTRIES = (
    [(0, index) for index in WEAPONS]
    + [(1, index) for index in range(2)]
    + [(2, index) for index in range(3)]
)
KINDS = ["weapon", "guidance", "defense"]


def select_original(strategy, money, ammo, cart=None):
    """money is the still-unallocated cash; cart maps weapon IDs to lots."""
    cpu = Uc(UC_ARCH_X86, UC_MODE_16)
    cpu.mem_map(0, 0x200000)
    cpu.mem_write(0, EXE[0x16A0:])
    cpu.mem_write(0x20000, OVR[0x8A8C:])
    cpu.mem_write(0x60000, EXE[0x163F0:])

    def word(address, value):
        cpu.mem_write(0x60000 + address, struct.pack("<H", value & 65535))

    def longword(address, value):
        cpu.mem_write(0x60000 + address, struct.pack("<i", value))

    for register, value in [
        (UC_X86_REG_CS, 0x2000),
        (UC_X86_REG_DS, 0x6000),
        (UC_X86_REG_SS, 0x7000),
        (UC_X86_REG_SP, 0xF000),
        (UC_X86_REG_BP, 0xF800),
    ]:
        cpu.reg_write(register, value)
    # Local player index and pointer; player 1 is DS:40a2.
    cpu.mem_write(0x7F800 - 0xC, struct.pack("<H", 1))
    cpu.mem_write(0x7F800 - 0x22, struct.pack("<HH", 0x40A2, 0x6000))
    word(0xE5A8, 3)  # Computer input type.
    word(0x3BEC, 0x5000)
    word(0x3BEE, 0x6000)
    word(0x500E, strategy)
    longword(0x40A2 + 0x13, money)
    # Already net of cart cost; spent and cart cost remain zero here.
    longword(0x3FDA, 0)
    longword(0x3FE2, 0)
    cpu.mem_write(0x63FD8, bytes([len(ENTRIES)]))
    cart = cart or {}
    for ordinal, (kind, index) in enumerate(ENTRIES, 1):
        address = 0x3BF8 + 32 * ordinal
        longword(address, index)
        longword(address + 4, kind)
        longword(address + 28, cart.get(index, 0) if kind == 0 else 0)
    for index in range(18):
        word(0x40A2 + 0x2E + 2 * index, ammo.get(index, 0))
    cpu.emu_start(
        0x20000 + 0xA085 - 0x8A8C,
        0x20000 + 0xA4D2 - 0x8A8C,
        count=100000,
    )
    ordinal = struct.unpack("<H", cpu.mem_read(0x7F800 - 4, 2))[0]
    if 1 <= ordinal <= len(ENTRIES):
        kind, index = ENTRIES[ordinal - 1]
        return {"kind": KINDS[kind], "index": index}
    return None


results = []
for strategy in range(1, 5):
    for money in [3000, 7000, 10000, 20000, 40000]:
        results.append({"strategy": strategy, "money": money, "ammo": {1: 30}})
for strategy in range(1, 5):
    results.append({"strategy": strategy, "money": 20000, "ammo": {1: 19}})
results.extend(
    [
        {"strategy": 1, "money": 40000, "ammo": {1: 20, 2: 20, 3: 20, 4: 20}},
        {"strategy": 1, "money": 40000, "ammo": {1: 30, 2: 15}, "cart": {2: 1}},
        {"strategy": 1, "money": 40000, "ammo": {1: 19}, "cart": {1: 1}},
        {"strategy": 2, "money": 2000, "ammo": {1: 19}},
        {"strategy": 2, "money": 10000, "ammo": {1: 30}, "cart": {4: 9}},
    ]
)
for case in results:
    case["expected"] = select_original(**case)
output = Path("tests/fixtures/computer-shop-oracle.json")
output.write_text(json.dumps(results, indent=2) + "\n")
print(f"Captured {len(results)} original shop selections in {output}")
