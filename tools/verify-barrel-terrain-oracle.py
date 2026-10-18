#!/usr/bin/env python3
"""Execute original old-barrel restore and tank redraw against a dirt framebuffer.

Requires local-only BOMB.EXE/BOMB.OVR and Unicorn. The overlay object-preparation
stub is skipped; all endpoint arithmetic, line rasterization and body writes
execute original instructions. No executable bytes are included in the fixture.
"""

import hashlib
import json
import struct
from pathlib import Path

from unicorn import Uc, UC_ARCH_X86, UC_HOOK_CODE, UC_MODE_16
from unicorn.x86_const import (
    UC_X86_REG_BP,
    UC_X86_REG_CS,
    UC_X86_REG_DS,
    UC_X86_REG_IP,
    UC_X86_REG_SP,
    UC_X86_REG_SS,
)

exe = Path("research/original/BOMB.EXE").read_bytes()
ovr = Path("research/original/BOMB.OVR").read_bytes()
fixtures = []
for angle in range(181):
    u = Uc(UC_ARCH_X86, UC_MODE_16)
    u.mem_map(0, 0x200000)
    u.mem_write(0, exe[0x16A0:])
    u.mem_write(0x60000, exe[0x163F0:])
    u.mem_write(0x20000, ovr[0x10000:])
    u.mem_write(0x90000, bytes([99]) * 64000)
    u.mem_write(0xA0000, bytes([2]) * 64000)

    def word(address, value):
        u.mem_write(address, struct.pack("<H", value & 65535))

    for register, value in [
        (UC_X86_REG_DS, 0x6000),
        (UC_X86_REG_SS, 0x7000),
        (UC_X86_REG_SP, 0xF000),
        (UC_X86_REG_BP, 0xF800),
        (UC_X86_REG_CS, 0x2000),
    ]:
        u.reg_write(register, value)
    for address, value in [
        (0x6403D + 0x74, 100),
        (0x6403F + 0x74, 100),
        (0x6404B + 0x74, min(angle, 180 - angle)),
        (0x6404D + 0x74, 1 if angle <= 90 else -1),
        (0x6E904, 0xA000),
        (0x6E5C2, 0x9000),
        (0x6E5C0, 0),
        (0x7F806, 1),
    ]:
        word(address, value)
    # Original angle-control old-line restore, ending before modifying angle.
    u.emu_start(0x2B177, 0x2B23E, count=100000)
    restored = bytes(u.mem_read(0xA0000, 64000))
    barrel = [
        [i % 320 - 100, i // 320 - 100] for i, v in enumerate(restored) if v == 99
    ]
    assert all(v in (2, 99) for v in restored)

    # Redraw on fresh dirt to distinguish all overwritten pixels.
    u.mem_write(0xA0000, bytes([2]) * 64000)
    u.mem_write(0x7F000, struct.pack("<HHH", 0, 0x8000, 1))
    u.reg_write(UC_X86_REG_CS, 0x431)
    u.reg_write(UC_X86_REG_SP, 0xF000)
    u.mem_write(0x64051 + 0x74, b"\x01")

    def skip_object_overlay(machine, address, size, user_data):
        if address == 0xB22A:
            sp = machine.reg_read(UC_X86_REG_SP)
            ip, cs = struct.unpack("<HH", machine.mem_read(0x70000 + sp, 4))
            machine.reg_write(UC_X86_REG_SP, sp + 8)
            machine.reg_write(UC_X86_REG_CS, cs)
            machine.reg_write(UC_X86_REG_IP, ip)

    u.hook_add(UC_HOOK_CODE, skip_object_overlay)
    u.emu_start(0x4ACA, 0x80000, count=100000)
    drawn = bytes(u.mem_read(0xA0000, 64000))
    assert all(v in (2, 20) for v in drawn)
    fixtures.append(
        {
            "angle": angle,
            "barrel": barrel,
            "drawnPixels": sum(v == 20 for v in drawn),
            "drawSha256": hashlib.sha256(drawn).hexdigest(),
        }
    )
Path("tests/fixtures/barrel-terrain-oracle.json").write_text(
    json.dumps(fixtures, indent=2) + "\n"
)
print(f"{len(fixtures)} original barrel restore and tank redraw cases")
