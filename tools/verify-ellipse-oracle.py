#!/usr/bin/env python3
"""Refresh bgi-ellipse-oracle.json by executing the original ellipse instructions.

Optional research dependency: unicorn (pip target /tmp/tankwars-research-pylib).
Run from repository root with PYTHONPATH=/tmp/tankwars-research-pylib.
No screenshot matching, JS implementation, or copied circle pixels is used to
produce the expected hashes. The original binary stays local and unmodified.
"""

import struct, json, hashlib
from pathlib import Path
from unicorn import *
from unicorn.x86_const import *

u = Uc(UC_ARCH_X86, UC_MODE_16)
u.mem_map(0, 0x200000)
b = Path("research/original/BOMB.EXE").read_bytes()
u.mem_write(0, b[0x16A0:])
u.reg_write(UC_X86_REG_DS, 0x6000)
u.reg_write(UC_X86_REG_ES, 0xA000)
u.reg_write(UC_X86_REG_SS, 0x7000)


def wr(o, n):
    u.mem_write(0x60000 + o, struct.pack("<H", n))


for o, n in [
    (0xE8FA, 0),
    (0xE8FC, 0),
    (0xE8FE, 319),
    (0xE900, 199),
    (0xE902, 1),
    (0xE904, 0xA000),
]:
    wr(o, n)
# far return to an unmapped routine bypassed with code hook.
u.hook_add(UC_HOOK_CODE, lambda uc, a, s, data: uc.emu_stop() if a == 0x80000 else None)
results = []
for rx, ry in [(r, r) for r in range(171)] + [
    (12, 7),
    (7, 12),
    (30, 1),
    (1, 30),
    (80, 150),
    (150, 80),
]:
    u.reg_write(UC_X86_REG_CS, 0xCC8)
    u.reg_write(UC_X86_REG_IP, 0x351)
    u.mem_write(0xA0000, bytes(65536))
    u.reg_write(UC_X86_REG_SP, 0xFF00)
    u.mem_write(0x7FF00, struct.pack("<7H", 0, 0x8000, 17, ry, rx, 100, 160))
    try:
        u.emu_start(0xCC80 + 0x351, 0x80000, count=1000000)
    except UcError as e:
        print(e, hex(u.reg_read(UC_X86_REG_CS)), hex(u.reg_read(UC_X86_REG_IP)))
        raise
    assert u.reg_read(UC_X86_REG_CS) == 0x8000, "Ellipse did not return"
    data = bytes(u.mem_read(0xA0000, 64000))
    results.append(
        {
            "rx": rx,
            "ry": ry,
            "pixels": data.count(17),
            "sha256": hashlib.sha256(data).hexdigest(),
        }
    )
Path("tests/fixtures/bgi-ellipse-oracle.json").write_text(
    json.dumps(results, indent=2) + "\n"
)
print("captured", len(results))
