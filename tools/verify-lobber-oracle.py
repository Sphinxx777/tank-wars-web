#!/usr/bin/env python3
"""Execute BOMB.EXE's Lobber planner, replacing only RNG and graphics calls."""

import json, math, struct
from pathlib import Path
from unicorn import Uc, UC_ARCH_X86, UC_MODE_16, UC_HOOK_CODE
from unicorn.x86_const import *

EXE = Path("research/original/BOMB.EXE").read_bytes()
DATA, OBJECT, STACK = 0x60000, 0x90000, 0x70000


def signed_word(u, address):
    return int.from_bytes(u.mem_read(address, 2), "little", signed=True)


def real48(value):
    if not value:
        return bytes(6)
    fraction, exponent = math.frexp(abs(value))
    bits = round((fraction * 2 - 1) * 2**39) | ((value < 0) << 39)
    return bytes([exponent + 128]) + bits.to_bytes(5, "little")


def run(case):
    u = Uc(UC_ARCH_X86, UC_MODE_16)
    u.mem_map(0, 0x200000)
    u.mem_write(0, EXE[0x16A0:])
    u.mem_write(DATA, EXE[0x163F0:])

    def word(address, value):
        u.mem_write(address, struct.pack("<H", value & 65535))

    for reg, value in [
        (UC_X86_REG_CS, 0),
        (UC_X86_REG_DS, 0x6000),
        (UC_X86_REG_SS, 0x7000),
        (UC_X86_REG_SP, 0xF000),
    ]:
        u.reg_write(reg, value)
    u.mem_write(0x7F000, struct.pack("<HHHH", 0, 0x8000, 0, 0x9000))
    own = case["own"] + 1
    for off, value in [
        (3, case.get("power", 400)),
        (5, case.get("elevation", 75)),
        (7, case.get("direction", 1)),
        (9, 4),
        (0xC, own),
        (0x10, own),
    ]:
        word(OBJECT + off, value)
    word(DATA + 0x47DA, len(case["players"]))
    word(DATA + own * 0x74 + 0x408C, len(case["history"]) + 1)
    for i, p in enumerate(case["players"], 1):
        for off, value in [
            (0x403D, p["x"]),
            (0x403F, p.get("y", 150)),
            (0x404F, 100),
            (0x4094, p.get("team", i)),
        ]:
            word(DATA + i * 0x74 + off, value)
        u.mem_write(DATA + i * 0x74 + 0x4051, bytes([p.get("alive", True)]))
    for i, ammo in enumerate(case.get("ammo", [100] * 18)):
        word(DATA + own * 0x74 + 0x405C + i * 2, ammo)
    for i, h in enumerate(case["history"], 1):
        for off, key in [(0x4A82, "power"), (0x4A86, "x"), (0x4A88, "y")]:
            word(DATA + own * 0x7DA + i * 10 + off, h.get(key, 0))
    calls = []

    def ret(args=0):
        sp = u.reg_read(UC_X86_REG_SP)
        ip, cs = struct.unpack("<HH", u.mem_read(STACK + sp, 4))
        u.reg_write(UC_X86_REG_SP, sp + 4 + args)
        u.reg_write(UC_X86_REG_CS, cs)
        u.reg_write(UC_X86_REG_IP, ip)

    def hook(cpu, address, size, user):
        if address == 0x3797 - 0x16A0:
            cpu.emu_stop()
        elif address == 0x12CE0 + 0x1675:
            limit = signed_word(cpu, STACK + cpu.reg_read(UC_X86_REG_SP) + 4)
            calls.append(limit)
            cpu.reg_write(UC_X86_REG_AX, case.get("randomInt", 17) % limit)
            ret(2)
        elif address == 0x12CE0 + 0x168B:
            calls.append("real")
            r = real48(case.get("random", 0.75))
            for reg, start in [
                (UC_X86_REG_AX, 0),
                (UC_X86_REG_BX, 2),
                (UC_X86_REG_DX, 4),
            ]:
                cpu.reg_write(reg, int.from_bytes(r[start : start + 2], "little"))
            ret()
        elif address == 0x12CE0 + 0xA81:
            ret(10)
        elif address == 0xE260 + 0x1DC2:
            ret(2)
        elif address == 0xE260 + 0x11EA:
            ret(6)
        elif address == 0xE260 + 0x1C86:
            ret(8)

    u.hook_add(UC_HOOK_CODE, hook)
    u.emu_start(0x3026 - 0x16A0, 0x80000, count=2000000)
    assert (
        u.reg_read(UC_X86_REG_CS) * 16 + u.reg_read(UC_X86_REG_IP) == 0x3797 - 0x16A0
    ), case
    return {
        "target": signed_word(u, OBJECT + 0xC) - 1,
        "elevation": signed_word(u, OBJECT + 5),
        "direction": signed_word(u, OBJECT + 7),
        "power": signed_word(u, OBJECT + 3),
        "weapon": signed_word(u, OBJECT + 9),
        "historyLength": signed_word(u, DATA + own * 0x74 + 0x408C) - 1,
        "randomCalls": calls,
    }


cases = []
players = [{"x": 30}, {"x": 90}, {"x": 170}, {"x": 260}]
for own in range(4):
    for direction in [-1, 1]:
        for count in [0, 1, 2, 4]:
            for roll in [0.25, 0.5, 0.75]:
                cases.append(
                    {
                        "own": own,
                        "players": players,
                        "direction": direction,
                        "random": roll,
                        "history": [
                            {"x": 50 + i * 45, "power": 150 + i * 80}
                            for i in range(count)
                        ],
                    }
                )
for first_x, last_x, first_power, last_power in [
    (40, 40, 120, 120),
    (40, 40, 100, 900),
    (32760, -32760, 100, 900),
    (-32760, 32760, 100, 900),
    (10, 11, 30000, -30000),
    (200, 201, 100, 1000),
    (200, 201, 1000, 100),
    (0, 3, 10, 11),
    (0, 7, 10, 11),
    (0, 100, 500, 501),
    (100, 110, 50, 100),
    (100, 200, 200, 100),
    (1, 2, 32767, -32768),
]:
    for elevation in [45, 75]:
        cases.append(
            {
                "own": 0,
                "players": [{"x": 30}, {"x": 260}],
                "elevation": elevation,
                "history": [
                    {"x": first_x, "power": first_power},
                    {"x": last_x, "power": last_power},
                ],
            }
        )
for error in [0, 5, 6, 15, 16, 30, 31, -5, -6, -15, -16, -30, -31]:
    for available in [0, 1, 2, 3, 4, 11]:
        ammo = [0] * 18
        ammo[0] = 100
        ammo[available] = 10
        cases.append(
            {
                "own": 0,
                "players": [{"x": 30}, {"x": 160}],
                "history": [{"x": 160 - error, "power": 150}, {"x": 160, "power": 200}],
                "ammo": ammo,
            }
        )
for p in [
    [{"x": 30}, {"x": 90, "alive": False}, {"x": 170}, {"x": 260}],
    [
        {"x": 30, "team": 1},
        {"x": 90, "team": 1},
        {"x": 170, "team": 2},
        {"x": 260, "team": 1},
    ],
    [{"x": 300}, {"x": 200}, {"x": 100}, {"x": 0}],
]:
    for count in [0, 1, 2]:
        cases.append(
            {
                "own": 0,
                "players": p,
                "history": [{"x": 150, "power": 150}, {"x": 130, "power": 200}][:count],
            }
        )
# Integer-looking quotients can land just below an integer after Real48 division.
for delta_x in range(1, 31):
    for delta_power in [1, 7, 25, 80, 199]:
        cases.append(
            {
                "own": 0,
                "players": [{"x": 30}, {"x": 260}],
                "history": [
                    {"x": 50, "power": 150},
                    {"x": 50 + delta_x, "power": 150 + delta_power},
                ],
            }
        )
for c in cases:
    c["expected"] = run(c)
Path("tests/fixtures/lobber-oracle.json").write_text(json.dumps(cases, indent=2) + "\n")
print(f"{len(cases)} original Lobber plans")


# The post-flight writer is common to ordinary, laser and MIRV dispatches.
def history_entry(x, y, power, elevation, direction):
    u = Uc(UC_ARCH_X86, UC_MODE_16)
    u.mem_map(0, 0x200000)
    u.mem_write(0, EXE[0x16A0:])
    u.mem_write(0x20000, Path("research/original/BOMB.OVR").read_bytes()[0x10000:])
    u.mem_write(DATA, EXE[0x163F0:])

    def word(address, value):
        u.mem_write(address, struct.pack("<H", value & 65535))

    for reg, value in [
        (UC_X86_REG_CS, 0x2000),
        (UC_X86_REG_DS, 0x6000),
        (UC_X86_REG_SS, 0x7000),
        (UC_X86_REG_SP, 0xE000),
        (UC_X86_REG_BP, 0xF000),
    ]:
        u.reg_write(reg, value)
    word(STACK + 0xF000 - 2, 1)
    for off, value in [
        (0x408C, 3),
        (0x4049, power),
        (0x404B, elevation),
        (0x404D, direction),
    ]:
        word(DATA + 0x74 + off, value)
    u.mem_write(DATA + 0x4796, real48(x))
    u.mem_write(DATA + 0x479C, real48(y))
    u.emu_start(0x25710, 0x25850, count=100000)
    return {
        key: signed_word(u, DATA + 0x7DA + 30 + off)
        for key, off in [
            ("angle", 0x4A80),
            ("power", 0x4A82),
            ("direction", 0x4A84),
            ("x", 0x4A86),
            ("y", 0x4A88),
        ]
    }


record_cases = []
for x, y in [
    (123.9, -15.9),
    (32766.999, 190.1),
    (32767.1, 190.9),
    (40000, 32768.5),
    (-32769, -32768.9),
    (-40000, 40000),
    (0, 0),
]:
    for direction in [-1, 1]:
        c = {"x": x, "y": y, "power": 410, "elevation": 75, "direction": direction}
        c["expected"] = history_entry(**c)
        record_cases.append(c)
Path("tests/fixtures/lobber-history-oracle.json").write_text(
    json.dumps(record_cases, indent=2) + "\n"
)
print(f"{len(record_cases)} original history writes")
