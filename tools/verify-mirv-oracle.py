#!/usr/bin/env python3
"""Run original MIRV slices with original Pascal Real arithmetic.

PYTHONPATH=/tmp/tankwars-research-pylib python3 tools/verify-mirv-oracle.py
The original binaries are local inputs, never included in the fixture.
"""

import json
import math
import struct
from pathlib import Path

from unicorn import Uc, UC_ARCH_X86, UC_MODE_16, UC_HOOK_CODE
from unicorn.x86_const import (
    UC_X86_REG_AX,
    UC_X86_REG_BX,
    UC_X86_REG_DX,
    UC_X86_REG_BP,
    UC_X86_REG_CS,
    UC_X86_REG_DS,
    UC_X86_REG_SP,
    UC_X86_REG_SS,
    UC_X86_REG_IP,
)

EXE = Path("research/original/BOMB.EXE").read_bytes()
OVR = Path("research/original/BOMB.OVR").read_bytes()
BP = 0xF000
STACK = 0x70000
DATA = 0x60000


def real48(value):
    if not value:
        return bytes(6)
    fraction, exponent = math.frexp(abs(value))
    mantissa = round((fraction * 2 - 1) * 2**39)
    bits = mantissa | ((value < 0) << 39)
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


def machine():
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
    return cpu


def set_state(cpu, index, state):
    for offset, key in zip([-0x6E, -0x92, -0xB6, -0xDA], ["x", "y", "vx", "vy"]):
        cpu.mem_write(STACK + BP + offset + index * 6, real48(state[key]))


def state(cpu, index):
    return {
        key: decode(cpu.mem_read(STACK + BP + offset + index * 6, 6))
        for offset, key in zip([-0x6E, -0x92, -0xB6, -0xDA], ["x", "y", "vx", "vy"])
    }


def integration(case):
    cpu = machine()
    index = case["index"]
    set_state(cpu, index, case)
    word(cpu, STACK + BP - 0xE6, index)
    word(cpu, DATA + 0x4744, case["subdivisions"])
    word(cpu, DATA + 0xE8A2, case["wind"])
    cpu.emu_start(0x22C52, 0x22E08, count=100000)
    return {
        **state(cpu, index),
        "pixelX": read_word(cpu, STACK + BP - 0x3E + index * 2),
        "pixelY": read_word(cpu, STACK + BP - 0x4A + index * 2),
    }


def spread(mode):
    cpu = machine()
    source = dict(x=130.25, y=70.5, vx=4.125, vy=0.125)
    set_state(cpu, 0, source)
    word(cpu, STACK + BP - 0x102, mode)
    random_values = [i / 16 for i in range(1, 11)]
    calls = []

    def random_hook(cpu, address, size, data):
        # Skip only Random's call; execute the caller's Real arithmetic unchanged.
        if address in [0x23D48, 0x23D9C]:
            value = random_values[len(calls)]
            calls.append(value)
            packed = real48(value)
            for reg, off in [
                (UC_X86_REG_AX, 0),
                (UC_X86_REG_BX, 2),
                (UC_X86_REG_DX, 4),
            ]:
                cpu.reg_write(reg, int.from_bytes(packed[off : off + 2], "little"))
            cpu.reg_write(UC_X86_REG_IP, address - 0x20000 + 5)

    cpu.hook_add(UC_HOOK_CODE, random_hook)
    cpu.emu_start(0x23C88, 0x2408C, count=1000000)
    return {
        "mode": mode,
        "source": source,
        "random": calls,
        "expected": [state(cpu, i) for i in range(1, 6)],
    }


def subdivisions(configured, alive):
    cpu = machine()
    cpu.mem_write(STACK + BP - 0xDB, b"\1")
    word(cpu, STACK + BP - 0x106, alive)
    word(cpu, DATA + 0xE8CA, configured)
    word(cpu, DATA + 0x4744, configured)
    cpu.emu_start(0x23C3D, 0x23C74, count=1000)
    return read_word(cpu, DATA + 0x4744)


def collision(case):
    cpu = machine()
    index = 1
    word(cpu, STACK + BP - 0xE6, index)
    word(cpu, STACK + BP - 0x3E + index * 2, case["x"])
    word(cpu, STACK + BP - 0x4A + index * 2, case["y"])
    word(cpu, DATA + 0x404F + 0x74, case.get("men", 100))
    word(cpu, DATA + 0xE8A2, 0)
    cpu.mem_write(DATA + 0x4814, b"\0\0")
    samples = []

    def pixel_hook(cpu, address, size, data):
        if address != 0x233A6:
            return
        sp = cpu.reg_read(UC_X86_REG_SP)
        x = read_word(cpu, STACK + sp + 2)
        y = read_word(cpu, STACK + sp)
        samples.append([x, y])
        color = next((c for px, py, c in case["pixels"] if (px, py) == (x, y)), 0)
        cpu.reg_write(UC_X86_REG_AX, color)
        cpu.reg_write(UC_X86_REG_SP, sp + 4)
        cpu.reg_write(UC_X86_REG_IP, 0x33AB)

    cpu.hook_add(UC_HOOK_CODE, pixel_hook)
    cpu.emu_start(0x2330D, 0x238D7, count=100000)
    return {
        "stopped": bool(cpu.mem_read(STACK + BP - 0xF6 + index, 1)[0]),
        "color": read_word(cpu, STACK + BP - 0x1A + index * 2),
        "samples": samples,
    }


def wall_tail(case):
    cpu = machine()
    index = 1
    set_state(cpu, index, case)
    word(cpu, STACK + BP - 0xE6, index)
    word(cpu, STACK + BP - 0x3E + index * 2, math.trunc(case["x"]))
    word(cpu, STACK + BP - 0x4A + index * 2, math.trunc(case["y"]))
    word(cpu, DATA + 0xE8A2, case["wind"])
    wall = case["wall"]
    cpu.mem_write(DATA + 0x4814, bytes([1 <= wall <= 3, wall == 4]))
    factor = 0.7071059999998397 if wall == 1 else 1.4142100000008213 if wall == 3 else 1
    cpu.mem_write(DATA + 0x47D2, real48(factor))
    cpu.emu_start(0x23417, 0x238D7, count=100000)
    return {
        **state(cpu, index),
        "stopped": bool(cpu.mem_read(STACK + BP - 0xF6 + index, 1)[0]),
    }


fixture = {
    "integration": [],
    "spreads": [spread(mode) for mode in range(5)],
    "subdivisions": [],
    "collisions": [],
    "walls": [],
}
for count in [1, 2, 3, 4, 5, 10]:
    for index, source in enumerate(
        [
            dict(x=120.25, y=70.5, vx=3.75, vy=-0.003, wind=50),
            dict(x=125.75, y=80.1, vx=-7.125, vy=2.75, wind=-200),
        ]
    ):
        case = {**source, "index": index * 5, "subdivisions": count}
        fixture["integration"].append({**case, "expected": integration(case)})
for configured in [1, 2, 3, 5, 10, 17]:
    for alive in range(1, 6):
        fixture["subdivisions"].append(
            {
                "configured": configured,
                "alive": alive,
                "expected": subdivisions(configured, alive),
            }
        )
for case in [
    dict(x=100, y=100, pixels=[]),
    dict(x=100, y=100, pixels=[[101, 100, 2]]),
    dict(x=100, y=100, pixels=[[99, 100, 20]], men=100),
    dict(x=100, y=100, pixels=[[99, 100, 20]], men=0),
    dict(x=100, y=100, pixels=[[99, 100, 20], [101, 100, 2]], men=0),
    dict(x=100, y=100, pixels=[[99, 100, 2], [101, 100, 20]], men=100),
    dict(x=100, y=33, pixels=[[100, 33, 2]]),
    dict(x=11, y=100, pixels=[[11, 100, 2]]),
    dict(x=100, y=187, pixels=[[100, 187, 2]]),
]:
    fixture["collisions"].append({**case, "expected": collision(case)})
for wall in range(5):
    for x, y, vx, vy, wind in [
        (10, 100, -3, 2, -20),
        (310, 100, 3, 2, 20),
        (100, 30, 3, -2, 0),
        (100, 188, 3, 2, 0),
        (100, 188, 3, 0.01, 0),
        (100, 188, 0.01, 0.01, 0),
        (9, 100, -3, 2, -20),
        (311, 100, 3, 2, 20),
        (9, 100, 0.5, 2, -20),
        (311, 100, 0.5, 2, 20),
    ]:
        case = dict(wall=wall, x=x, y=y, vx=vx, vy=vy, wind=wind)
        fixture["walls"].append({**case, "expected": wall_tail(case)})
output = Path("tests/fixtures/mirv-oracle.json")
output.write_text(json.dumps(fixture, indent=2) + "\n")
print(f"Captured {sum(map(len, fixture.values()))} original MIRV cases in {output}")
