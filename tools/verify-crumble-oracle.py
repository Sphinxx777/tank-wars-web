#!/usr/bin/env python3
"""Record crumble sweeps by running the original unmodified resident instructions.

Requires the local DOS executable and optional Unicorn research dependency:
PYTHONPATH=/tmp/tankwars-research-pylib python3 tools/verify-crumble-oracle.py
"""

import hashlib
import json
import struct
from pathlib import Path

from unicorn import UC_ARCH_X86, UC_HOOK_CODE, UC_MODE_16, Uc
from unicorn.x86_const import (
    UC_X86_REG_CS,
    UC_X86_REG_DS,
    UC_X86_REG_IP,
    UC_X86_REG_SP,
    UC_X86_REG_SS,
)

executable = Path("research/original/BOMB.EXE").read_bytes()
fixtures = [
    {
        "name": "floating stack",
        "dirt": [[100, y] for y in range(183, 186)],
        "blockers": [],
    },
    {
        "name": "uneven island",
        "dirt": [[x, y] for x in range(100, 104) for y in range(183, 186 + x % 2)],
        "blockers": [],
    },
    {
        "name": "tank and barrel obstruct earth",
        "dirt": [[x, y] for x in range(100, 105) for y in range(181, 184)],
        "blockers": [[101, 186, 20], [102, 185, 20], [103, 187, 20]],
    },
    {
        "name": "background palette membership",
        "dirt": [[x, 184] for x in range(100, 107)],
        "blockers": [
            [x, 187, color]
            for x, color in zip(range(100, 107), [0, 29, 30, 99, 100, 13, 19])
        ],
    },
]
results = []
for fixture in fixtures:
    emulator = Uc(UC_ARCH_X86, UC_MODE_16)
    emulator.mem_map(0, 0x200000)
    emulator.mem_write(0, executable[0x16A0:])
    framebuffer = bytearray(65536)
    background = bytearray(65536)
    # The original boundary redraw precedes crumble. The bottom is palette 13.
    for x in range(320):
        framebuffer[190 * 320 + x] = 13
    for x, y, color in fixture["blockers"]:
        framebuffer[y * 320 + x] = color
        if 30 <= color <= 99:
            background[y * 320 + x] = color
    for x, y in fixture["dirt"]:
        framebuffer[y * 320 + x] = 2
    emulator.mem_write(0xA0000, bytes(framebuffer))
    emulator.mem_write(0x90000, bytes(background))
    emulator.reg_write(UC_X86_REG_SS, 0x6000)
    emulator.reg_write(UC_X86_REG_DS, 0x6000)
    emulator.reg_write(UC_X86_REG_SP, 0xFF00)
    emulator.mem_write(0x6FF00, struct.pack("<6H", 0, 0x8000, 0, 0x9000, 0, 0x7000))
    snapshots = []
    active_order = []

    def snapshot():
        frame = bytes(emulator.mem_read(0xA0000, 64000))
        earth = [
            [offset % 320, offset // 320]
            for offset, color in enumerate(frame)
            if color == 2
        ]
        if not snapshots or snapshots[-1] != earth:
            snapshots.append(earth)

    def on_instruction(uc, address, size, data):
        if address == 0x5EAD - 0x16A0:
            words = struct.unpack("<32000H", bytes(uc.mem_read(0x70000, 64000)))
            for offset in words:
                if offset == 0xFFFF:
                    break
                active_order.append([offset % 320, offset // 320])
        if address == 0x5EB4 - 0x16A0:
            snapshot()
        if address == 0x80000:
            snapshot()
            uc.emu_stop()

    emulator.hook_add(UC_HOOK_CODE, on_instruction)
    emulator.reg_write(UC_X86_REG_CS, 0x431)
    emulator.reg_write(UC_X86_REG_IP, 0x496)
    emulator.emu_start(0x47A6, 0x80000, count=2000000)
    assert emulator.reg_read(UC_X86_REG_CS) == 0x8000, "Crumble did not return"
    results.append({**fixture, "initialActiveOrder": active_order, "sweeps": snapshots})

output = {
    "executableSha256": hashlib.sha256(executable).hexdigest(),
    "routine": "EXE 0x5e46..0x5f1a",
    "fixtures": results,
}
Path("tests/fixtures/crumble-oracle.json").write_text(
    json.dumps(output, indent=2) + "\n"
)
print("Captured", len(results), "original crumble fixtures")
