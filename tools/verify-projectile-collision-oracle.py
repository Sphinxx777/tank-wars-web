#!/usr/bin/env python3
"""Execute ordinary projectile cross classification and dirt/sonic ricochets.

PYTHONPATH=/tmp/tankwars-research-pylib python3 tools/verify-projectile-collision-oracle.py
Only VGA reads and the palette I/O call are stubbed. Original executable and
Pascal Real arithmetic are executed unchanged; original binaries remain local.
"""

import json
import math
import struct
from pathlib import Path
from unicorn import Uc, UC_ARCH_X86, UC_MODE_16, UC_HOOK_CODE
from unicorn.x86_const import *

EXE = Path("research/original/BOMB.EXE").read_bytes()
OVR = Path("research/original/BOMB.OVR").read_bytes()
BP, STACK, DATA = 0xF000, 0x70000, 0x60000


def real48(value):
    if not value:
        return bytes(6)
    fraction, exponent = math.frexp(abs(value))
    bits = round((fraction * 2 - 1) * 2**39) | ((value < 0) << 39)
    return bytes([exponent + 128]) + bits.to_bytes(5, "little")


def decode(value):
    if not value[0]:
        return 0
    bits = int.from_bytes(value[1:], "little")
    return (
        (-1 if bits & (1 << 39) else 1)
        * (1 + (bits & ((1 << 39) - 1)) / 2**39)
        * 2 ** (value[0] - 129)
    )


def word(cpu, address, value):
    cpu.mem_write(address, struct.pack("<H", value & 65535))


def read_word(cpu, address):
    return int.from_bytes(cpu.mem_read(address, 2), "little", signed=True)


def collision(case):
    cpu = Uc(UC_ARCH_X86, UC_MODE_16)
    cpu.mem_map(0, 0x200000)
    cpu.mem_write(0, EXE[0x16A0:])
    cpu.mem_write(0x20000, OVR[0x10000:])
    cpu.mem_write(DATA, EXE[0x163F0:])
    for reg, value in [
        (UC_X86_REG_CS, 0x2000),
        (UC_X86_REG_DS, 0x6000),
        (UC_X86_REG_SS, 0x7000),
        (UC_X86_REG_SP, 0xEC00),
        (UC_X86_REG_BP, BP),
    ]:
        cpu.reg_write(reg, value)
    word(cpu, STACK + BP + 6, 1)
    word(cpu, STACK + BP - 0x18, 100)
    word(cpu, STACK + BP - 0x1A, 100)
    word(cpu, STACK + BP - 2, 943)
    word(cpu, DATA + 0x4049 + 0x74, case["power"])
    word(cpu, DATA + 0x4052 + 0x74, case["weapon"])
    word(cpu, DATA + 0x4054 + 0x74, 3)
    word(cpu, DATA + 0x4740, case["substep"])
    word(cpu, DATA + 0x4744, 10)
    word(cpu, DATA + 0x47DE, case.get("previousColor", 0))
    cpu.mem_write(DATA + 0x4751, b"\0")
    cpu.mem_write(DATA + 0x47A8, real48(2.5))
    samples, palettes = [], []

    def hook(cpu, address, size, data):
        sp = cpu.reg_read(UC_X86_REG_SP)
        if address == 0x21A79:
            x, y = read_word(cpu, STACK + sp + 2), read_word(cpu, STACK + sp)
            samples.append([x, y])
            value = next(
                (color for px, py, color in case["pixels"] if (px, py) == (x, y)), 0
            )
            cpu.reg_write(UC_X86_REG_AX, value)
            cpu.reg_write(UC_X86_REG_SP, sp + 4)
            cpu.reg_write(UC_X86_REG_IP, 0x1A7E)
        if address == 0x21B48:
            palettes.append(
                [read_word(cpu, STACK + sp + offset) for offset in [6, 4, 2, 0]]
            )
            cpu.reg_write(UC_X86_REG_SP, sp + 8)
            cpu.reg_write(UC_X86_REG_IP, 0x1B4C)

    cpu.hook_add(UC_HOOK_CODE, hook)
    cpu.emu_start(0x21A05, 0x21B60, count=100000)
    return dict(
        stopped=bool(cpu.mem_read(DATA + 0x4751, 1)[0]),
        color=read_word(cpu, DATA + 0x47DE),
        vy=decode(cpu.mem_read(DATA + 0x47A8, 6)),
        guidance=read_word(cpu, DATA + 0x4054 + 0x74),
        samples=samples,
        palettes=palettes,
    )


cases = []
for weapon in [0, 1, 6, 12, 13, 16, 17]:
    for pixels in [
        [],
        [[99, 100, 20], [101, 100, 2]],
        [[99, 100, 2], [101, 100, 21]],
        [[99, 100, 20], [100, 99, 21], [100, 100, 22]],
        [[99, 100, 20], [101, 100, 99]],
    ]:
        for power, substep in [(500, 1), (943, 10), (1000, 1), (1000, 10)]:
            case = dict(weapon=weapon, pixels=pixels, power=power, substep=substep)
            cases.append({**case, "expected": collision(case)})
case = dict(weapon=1, pixels=[], power=1000, substep=1, previousColor=2)
cases.append({**case, "expected": collision(case)})
output = Path("tests/fixtures/projectile-collision-oracle.json")
output.write_text(json.dumps(cases, indent=2) + "\n")
print(f"Captured {len(cases)} original collision cases in {output}")
