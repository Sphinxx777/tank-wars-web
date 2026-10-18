#!/usr/bin/env python3
"""Execute original Tank Wars 3.2 ordinary projectile loop slices.

Run from the repository root with:
PYTHONPATH=/tmp/tankwars-research-pylib python3 tools/verify-ordinary-oracle.py
Only original-code observations are written; no original binaries are distributed.
"""

import json
import math
import struct
from pathlib import Path

from unicorn import Uc, UC_ARCH_X86, UC_MODE_16, UC_HOOK_CODE
from unicorn.x86_const import (
    UC_X86_REG_AX,
    UC_X86_REG_BP,
    UC_X86_REG_CS,
    UC_X86_REG_DS,
    UC_X86_REG_SP,
    UC_X86_REG_SS,
    UC_X86_REG_IP,
)

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
    word(cpu, STACK + BP + 6, 1)
    cpu.mem_write(DATA + 0x4750, b"\1\0")
    cpu.mem_write(DATA + 0x4814, b"\0\0")
    cpu.mem_write(DATA + 0xE8B3, b"\0")
    word(cpu, DATA + 0x47DE, 0)
    return cpu


def set_state(cpu, state):
    for offset, key in zip([0x4796, 0x479C, 0x47A2, 0x47A8], ["x", "y", "vx", "vy"]):
        cpu.mem_write(DATA + offset, real48(state[key]))


def state(cpu):
    return {
        key: decode(cpu.mem_read(DATA + offset, 6))
        for offset, key in zip([0x4796, 0x479C, 0x47A2, 0x47A8], ["x", "y", "vx", "vy"])
    }


def flags(cpu):
    return {
        "stopped": bool(cpu.mem_read(DATA + 0x4751, 1)[0]),
        "impact": bool(cpu.mem_read(DATA + 0x4750, 1)[0]),
    }


def initial_counter(players, subdivisions):
    cpu = machine()
    word(cpu, DATA + 0x47DA, players)
    word(cpu, DATA + 0x4744, subdivisions)
    cpu.emu_start(0x212B3, 0x2130F, count=10000)
    initial = read_word(cpu, DATA + 0x4740)
    steps = []
    for _ in range(2 * (subdivisions + 1)):
        cpu.emu_start(0x2130F, 0x21329, count=1000)
        steps.append(
            {
                "substep": read_word(cpu, DATA + 0x4740),
                "groups": int.from_bytes(cpu.mem_read(STACK + BP - 0x2E, 4), "little"),
            }
        )
    return {
        "players": players,
        "subdivisions": subdivisions,
        "expected": {"initial": initial, "steps": steps},
    }


def integration(case):
    cpu = machine()
    set_state(cpu, case)
    word(cpu, DATA + 0x4744, case["subdivisions"])
    word(cpu, DATA + 0xE8A2, case["wind"])
    cpu.emu_start(0x21329, 0x21444, count=100000)
    return {
        **state(cpu),
        "pixelX": read_word(cpu, STACK + BP - 0x18),
        "pixelY": read_word(cpu, STACK + BP - 0x1A),
    }


def collision(case):
    cpu = machine()
    set_state(cpu, dict(x=case["x"], y=case["y"], vx=1, vy=case.get("vy", 2)))
    word(cpu, STACK + BP - 0x18, case["x"])
    word(cpu, STACK + BP - 0x1A, case["y"])
    word(cpu, STACK + BP - 2, case["threshold"])
    word(cpu, DATA + 0x4740, case["substep"])
    word(cpu, DATA + 0x4744, case["subdivisions"])
    word(cpu, DATA + 0x4049 + 0x74, case["power"])
    word(cpu, DATA + 0x4052 + 0x74, case.get("weapon", 1))
    word(cpu, DATA + 0x4054 + 0x74, case.get("guidance", 3))
    word(cpu, DATA + 0x47DE, case.get("priorColor", 0))
    samples, palettes = [], []

    def hook(cpu, address, size, data):
        if address == 0x21B63:
            cpu.emu_stop()
        elif address == 0x21A79:
            sp = cpu.reg_read(UC_X86_REG_SP)
            x, y = read_word(cpu, STACK + sp + 2), read_word(cpu, STACK + sp)
            samples.append([x, y])
            color = next((c for px, py, c in case["pixels"] if (px, py) == (x, y)), 0)
            cpu.reg_write(UC_X86_REG_AX, color)
            cpu.reg_write(UC_X86_REG_SP, sp + 4)
            cpu.reg_write(UC_X86_REG_IP, 0x1A7E)
        elif address == 0x21B48:
            sp = cpu.reg_read(UC_X86_REG_SP)
            palettes.append(
                [read_word(cpu, STACK + sp + offset) for offset in [6, 4, 2, 0]]
            )
            cpu.reg_write(UC_X86_REG_SP, sp + 8)
            cpu.reg_write(UC_X86_REG_IP, 0x1B4C)

    cpu.hook_add(UC_HOOK_CODE, hook)
    cpu.emu_start(0x21A05, 0x21E62, count=100000)
    return {
        "stopped": flags(cpu)["stopped"],
        "color": read_word(cpu, DATA + 0x47DE),
        "vy": state(cpu)["vy"],
        "guidance": read_word(cpu, DATA + 0x4054 + 0x74),
        "samples": samples,
        "palettes": palettes,
    }


def boundary(case):
    cpu = machine()
    set_state(cpu, case)
    word(cpu, STACK + BP - 0x18, math.trunc(case["x"]))
    word(cpu, STACK + BP - 0x1A, math.trunc(case["y"]))
    word(cpu, DATA + 0xE8A2, case["wind"])
    word(cpu, DATA + 0x4054 + 0x74, case["guidance"])
    wall = case["wall"]
    cpu.mem_write(DATA + 0x4814, bytes([1 <= wall <= 3, wall == 4]))
    factor = 0.7071059999998397 if wall == 1 else 1.4142100000008213 if wall == 3 else 1
    cpu.mem_write(DATA + 0x47D2, real48(factor))
    cpu.mem_write(STACK + BP - 0x2E, case["groups"].to_bytes(4, "little"))
    cpu.emu_start(0x21B63, 0x21EF3, count=100000)
    cpu.emu_start(0x21F94, 0x21FD8, count=100000)
    return {
        **state(cpu),
        **flags(cpu),
        "pixelX": read_word(cpu, STACK + BP - 0x18),
        "pixelY": read_word(cpu, STACK + BP - 0x1A),
    }


fixture = {"counters": [], "integration": [], "collisions": [], "boundaries": []}
for subdivisions in [1, 2, 5, 10, 20]:
    for players in [2, 3, 5, 8, 10]:
        fixture["counters"].append(initial_counter(players, subdivisions))
    for source in [
        dict(x=120.25, y=70.5, vx=3.75, vy=-0.003, wind=50),
        dict(x=125.75, y=80.1, vx=-7.125, vy=2.75, wind=-200),
        dict(x=-9.999, y=-0.001, vx=-0.02, vy=-0.01, wind=0),
    ]:
        case = {**source, "subdivisions": subdivisions}
        fixture["integration"].append({**case, "expected": integration(case)})
for men in [1, 50, 100]:
    for power_delta in [-1, 0, 1]:
        for substep in [0, 1, 9, 10]:
            for pixels in [
                [[100, 100, 2]],
                [[99, 100, 20], [101, 100, 2]],
                [[99, 100, 2], [101, 100, 20]],
            ]:
                case = dict(
                    x=100,
                    y=100,
                    threshold=men * 3 + 643,
                    power=men * 3 + 643 + power_delta,
                    substep=substep,
                    subdivisions=10,
                    pixels=pixels,
                )
                fixture["collisions"].append({**case, "expected": collision(case)})
for weapon in [11, 12, 13, 16, 17]:
    case = dict(
        x=100,
        y=100,
        threshold=943,
        power=1000,
        substep=1,
        subdivisions=10,
        pixels=[[99, 100, 20], [100, 100, 21], [101, 100, 22]],
        weapon=weapon,
    )
    fixture["collisions"].append({**case, "expected": collision(case)})
for x, y in [
    (11, 100),
    (12, 100),
    (309, 100),
    (308, 100),
    (100, 33),
    (100, 34),
    (100, 187),
    (100, 186),
]:
    case = dict(
        x=x,
        y=y,
        threshold=943,
        power=100,
        substep=1,
        subdivisions=10,
        pixels=[[x, y, 2]],
        priorColor=21,
    )
    fixture["collisions"].append({**case, "expected": collision(case)})
for wall in range(5):
    for source in [
        dict(x=9, y=100, vx=0.5, vy=2, wind=-20),
        dict(x=9, y=100, vx=1, vy=2, wind=-20),
        dict(x=311, y=100, vx=1, vy=2, wind=20),
        dict(x=311, y=100, vx=1.001, vy=2, wind=20),
        dict(x=311, y=100, vx=4, vy=2, wind=0),
        dict(x=100, y=188, vx=4, vy=0.01, wind=0),
        dict(x=100, y=190, vx=4, vy=2, wind=0),
        dict(x=100, y=-5000, vx=4, vy=-2, wind=0),
        dict(x=100, y=-5001, vx=4, vy=-2, wind=0),
    ]:
        for guidance in [0, 1]:
            case = {**source, "wall": wall, "guidance": guidance, "groups": 0}
            fixture["boundaries"].append({**case, "expected": boundary(case)})
for groups in [1000, 1001]:
    for vx, vy, y in [
        (4, 2, 100),
        (30, 30, 100),
        (30.001, 0, 100),
        (0, -30.001, 100),
        (0, -2, -5001),
        (0, -30.001, -5001),
    ]:
        case = dict(x=100, y=y, vx=vx, vy=vy, wind=0, wall=0, guidance=0, groups=groups)
        fixture["boundaries"].append({**case, "expected": boundary(case)})
output = Path("tests/fixtures/ordinary-oracle.json")
output.write_text(json.dumps(fixture, indent=2) + "\n")
print(
    f"Captured {sum(map(len,fixture.values()))} original ordinary projectile cases in {output}"
)
