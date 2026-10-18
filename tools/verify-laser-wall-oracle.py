#!/usr/bin/env python3
"""Capture laser wall behavior by executing original OVR and Real arithmetic.

Requires local original binaries and optional Unicorn research dependency:
PYTHONPATH=/tmp/tankwars-research-pylib python3 tools/verify-laser-wall-oracle.py
"""

import json
import math
from pathlib import Path

from unicorn import Uc, UC_ARCH_X86, UC_MODE_16
from unicorn.x86_const import (
    UC_X86_REG_CS,
    UC_X86_REG_DS,
    UC_X86_REG_SP,
    UC_X86_REG_SS,
)

EXE = Path("research/original/BOMB.EXE").read_bytes()
OVR = Path("research/original/BOMB.OVR").read_bytes()


def real48(value):
    if value == 0:
        return bytes(6)
    fraction, exponent = math.frexp(abs(value))
    mantissa = round((fraction * 2 - 1) * 2**39)
    bits = mantissa | ((value < 0) << 39)
    return bytes([exponent + 128]) + bits.to_bytes(5, "little")


def from_real48(value):
    if not value[0]:
        return 0
    bits = int.from_bytes(value[1:], "little")
    return (
        (-1 if bits & (1 << 39) else 1)
        * (1 + (bits & ((1 << 39) - 1)) / 2**39)
        * 2 ** (value[0] - 129)
    )


def original_tail(wall, x, y, vx, vy):
    cpu = Uc(UC_ARCH_X86, UC_MODE_16)
    cpu.mem_map(0, 0x200000)
    cpu.mem_write(0, EXE[0x16A0:])
    cpu.mem_write(0x20000, OVR[0x10000:])
    cpu.mem_write(0x60000, EXE[0x163F0:])
    for register, value in [
        (UC_X86_REG_CS, 0x2000),
        (UC_X86_REG_DS, 0x6000),
        (UC_X86_REG_SS, 0x7000),
        (UC_X86_REG_SP, 0xF000),
    ]:
        cpu.reg_write(register, value)
    cpu.mem_write(0x64814, bytes([1 <= wall <= 3, wall == 4]))
    cpu.mem_write(0x64751, b"\0")
    for address, value in zip([0x4796, 0x479C, 0x47A2, 0x47A8], [x, y, vx, vy]):
        cpu.mem_write(0x60000 + address, real48(value))
    cpu.emu_start(0x24E06, 0x250AE, count=100000)
    result = dict(
        zip(
            ["x", "y", "vx", "vy"],
            [
                from_real48(cpu.mem_read(0x60000 + address, 6))
                for address in [0x4796, 0x479C, 0x47A2, 0x47A8]
            ],
        )
    )
    result["done"] = bool(cpu.mem_read(0x64751, 1)[0])
    return result


results = []
for wall in [0, 1, 2, 3, 4]:
    for x, y, vx, vy in [
        (11, 100, -1, 0),
        (11.25, 100, -1, 0),
        (309, 100, 1, 0),
        (308.75, 100, 1, 0),
        (100, 31, 0, -1),
        (100, 31.25, 0, -1),
        (100, 189, 0, 1),
        (100, 188.75, 0, 1),
        (11, 31, -0.5, -0.5),
        (11, 31, 0.5, 0.5),
        (10, 100, -1, 0),
        (310, 100, 1, 0),
        (10.25, 100, -1, 0),
        (309.75, 100, 1, 0),
    ]:
        case = {"wall": wall, "x": x, "y": y, "vx": vx, "vy": vy}
        results.append({**case, "expected": original_tail(**case)})
output = Path("tests/fixtures/laser-wall-oracle.json")
output.write_text(json.dumps(results, indent=2) + "\n")
print(f"Captured {len(results)} original laser wall cases in {output}")
