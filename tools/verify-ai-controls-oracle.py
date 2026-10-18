#!/usr/bin/env python3
"""Execute the original AI command selector (BOMB.EXE 0x2b00..0x2e19).

Requires Unicorn and local research/original/BOMB.EXE. The fixture captures
command codes and direct power writes; it contains no copied executable bytes.
"""

import json
import struct
from pathlib import Path
from unicorn import Uc, UC_ARCH_X86, UC_MODE_16
from unicorn.x86_const import (
    UC_X86_REG_CS,
    UC_X86_REG_DS,
    UC_X86_REG_SS,
    UC_X86_REG_SP,
    UC_X86_REG_AX,
    UC_X86_REG_IP,
)

exe = Path("research/original/BOMB.EXE").read_bytes()
fixtures = []
for angle, target_angle in [
    (30, 60),
    (60, 30),
    (90, 120),
    (120, 90),
    (120, 150),
    (150, 120),
    (30, 150),
    (150, 30),
    (90, 90),
]:
    for difference in [-201, -100, -99, -10, -9, -1, 0, 1, 9, 10, 99, 100, 201]:
        for weapon, target_weapon in [(1, 1), (1, 4)]:
            u = Uc(UC_ARCH_X86, UC_MODE_16)
            u.mem_map(0, 0x200000)
            u.mem_write(0, exe[0x16A0:])
            u.mem_write(0x60000, exe[0x163F0:])

            def word(address, value):
                u.mem_write(address, struct.pack("<H", value & 65535))

            def read_word(address):
                return struct.unpack("<h", u.mem_read(address, 2))[0]

            for reg, value in [
                (UC_X86_REG_CS, 0),
                (UC_X86_REG_DS, 0x6000),
                (UC_X86_REG_SS, 0x7000),
                (UC_X86_REG_SP, 0xF000),
            ]:
                u.reg_write(reg, value)
            u.mem_write(0x7F000, struct.pack("<HHHH", 0, 0x8000, 0, 0x9000))
            for offset, value in [
                (3, 400 + difference),
                (5, min(target_angle, 180 - target_angle)),
                (7, -1 if target_angle > 90 else 1),
                (9, target_weapon),
                (0x10, 1),
            ]:
                word(0x90000 + offset, value)
            for offset, value in [
                (0x4049, 400),
                (0x404B, min(angle, 180 - angle)),
                (0x404D, -1 if angle > 90 else 1),
                (0x404F, 100),
                (0x4052, weapon),
            ]:
                word(0x60000 + 0x74 + offset, value)
            for i in range(18):
                word(0x60000 + 0x74 + 0x405C + i * 2, 1000)
            u.emu_start(0x2B00 - 0x16A0, 0x80000, count=100000)
            assert u.reg_read(UC_X86_REG_CS) * 16 + u.reg_read(UC_X86_REG_IP) == 0x80000
            fixtures.append(
                {
                    "player": {"angle": angle, "power": 400, "weapon": weapon},
                    "plan": {
                        "angle": target_angle,
                        "power": 400 + difference,
                        "weapon": target_weapon,
                    },
                    "command": u.reg_read(UC_X86_REG_AX),
                    "powerBeforeHandler": read_word(0x60000 + 0x74 + 0x4049),
                }
            )
Path("tests/fixtures/ai-controls-oracle.json").write_text(
    json.dumps(fixtures, indent=2) + "\n"
)
print(f"{len(fixtures)} original command-selection cases")
