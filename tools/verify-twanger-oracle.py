#!/usr/bin/env python3
"""Execute Twanger's original complete solid-wall planner, including Pascal Real.

Local-only BOMB.EXE is required; fixtures contain observations, never code bytes.
The harness starts after the UI-only palette call and stops before command output.
"""

import json
import struct
import hashlib
from pathlib import Path
from unicorn import Uc, UC_ARCH_X86, UC_MODE_16, UC_HOOK_CODE
from unicorn.x86_const import *

EXE = Path("research/original/BOMB.EXE").read_bytes()
DATA, STACK, OBJECT = 0x60000, 0x70000, 0x90000


def word(u, a, v):
    u.mem_write(a, struct.pack("<H", v & 65535))


def read(u, a):
    return int.from_bytes(u.mem_read(a, 2), "little", signed=True)


def run(case):
    u = Uc(UC_ARCH_X86, UC_MODE_16)
    u.mem_map(0, 0x200000)
    u.mem_write(0, EXE[0x16A0:])
    u.mem_write(DATA, EXE[0x163F0:])
    for reg, val in [
        (UC_X86_REG_CS, 0),
        (UC_X86_REG_DS, 0x6000),
        (UC_X86_REG_SS, 0x7000),
        (UC_X86_REG_SP, 0xEC00),
        (UC_X86_REG_BP, 0xF000),
    ]:
        u.reg_write(reg, val)
    word(u, STACK + 0xF006, 0)
    word(u, STACK + 0xF008, 0x9000)
    word(u, OBJECT + 0x10, case["own"] + 1)
    word(u, DATA + 0x47DA, len(case["players"]))
    word(u, DATA + 0xE5BC, 0)
    word(u, DATA + 0xE5BE, 0xB000)
    word(u, DATA + 0xE904, 0xA000)
    frame = bytearray(64000)
    for x1, y1, x2, y2 in case.get("dirt", []):
        for y in range(y1, y2 + 1):
            for x in range(x1, x2 + 1):
                frame[y * 320 + x] = 2
    for x, y, color in case.get("pixels", []):
        frame[y * 320 + x] = color
    u.mem_write(0xA0000, bytes(frame))
    u.mem_write(0xB0000, bytes(frame))
    for i, p in enumerate(case["players"], 1):
        base = DATA + 0x74 * i
        word(u, base + 0x403D, p["x"])
        word(u, base + 0x403F, p["y"])
        word(u, base + 0x4094, p.get("team", i))
        u.mem_write(base + 0x4051, bytes([int(p.get("alive", True))]))
        for weapon, ammo in enumerate(p.get("ammo", [1000] * 18)):
            word(u, base + 0x405C + 2 * weapon, ammo)
    observations = {}
    samples = []
    random = []

    def hook(cpu, address, size, data):
        off = address + 0x16A0
        if off == 0x4FE2:
            observations["scores"] = [
                read(u, OBJECT + 0x14 + 2 * i)
                for i in range(1, len(case["players"]) + 1)
            ]
        if off == 0x5227:
            observations["ranking"] = [
                read(u, OBJECT + 0x2A + 2 * i)
                for i in range(1, len(case["players"]) + 1)
            ]
        if off in [0x4E32, 0x4FA6, 0x5462, 0x55D6]:
            sp = cpu.reg_read(UC_X86_REG_SP)
            samples.append([read(u, STACK + sp + 2), read(u, STACK + sp)])
        if off == 0x566B:
            random.append(51)
            cpu.reg_write(UC_X86_REG_AX, case.get("random", 25))
            cpu.reg_write(UC_X86_REG_SP, cpu.reg_read(UC_X86_REG_SP) + 2)
            cpu.reg_write(UC_X86_REG_IP, address + 5)

    u.hook_add(UC_HOOK_CODE, hook, begin=0x4B7D - 0x16A0, end=0x5868 - 0x16A0)
    u.emu_start(0x4B7D - 0x16A0, 0x5868 - 0x16A0, count=20000000)
    assert (
        u.reg_read(UC_X86_REG_IP) == 0x5868 - 0x16A0
        or u.reg_read(UC_X86_REG_IP) == 0x57F6 - 0x16A0
    ), hex(u.reg_read(UC_X86_REG_IP))
    angle = read(u, OBJECT + 5)
    direction = read(u, OBJECT + 7)
    return dict(
        **observations,
        target=read(u, OBJECT + 0xC) - 1,
        angle=angle if direction > 0 else 180 - angle,
        power=read(u, OBJECT + 3),
        weapon=read(u, OBJECT + 9),
        weaponScore=read(u, OBJECT + 0x14 + 2 * read(u, OBJECT + 0xC)),
        random=random,
        samplesSha256=hashlib.sha256(
            json.dumps(samples, separators=(",", ":")).encode()
        ).hexdigest(),
        samplesCount=len(samples),
    )


def main():
    cases = []
    positions = [
        [(35, 155), (110, 140), (190, 110), (275, 165)],
        [(40, 100), (80, 100), (160, 100), (280, 100)],
        [(40, 40), (100, 150), (180, 70), (280, 175)],
        [(40, 150), (100, 100), (160, 150), (280, 100)],
    ]
    dirt = [
        [],
        [[11, 100, 309, 189]],
        [[65, 31, 90, 189]],
        [[11, 31, 309, 189]],
        [[120, 50, 170, 130]],
        [[80, 80, 200, 81]],
        [[11, 31, 309, 33]],
    ]
    for pos in positions:
        for own in range(4):
            for earth in dirt:
                cases.append(
                    dict(
                        own=own,
                        players=[dict(x=x, y=y) for x, y in pos],
                        dirt=earth,
                        random=(own * 13) % 51,
                    )
                )
    for dead, team in [(True, False), (False, True)]:
        case = dict(own=0, players=[dict(x=x, y=y) for x, y in positions[0]], dirt=[])
        case["players"][1]["alive"] = not dead
        if team:
            case["players"][0]["team"] = 1
            case["players"][1]["team"] = 1
        cases.append(case)
    for count in [0, 100, 101]:
        case = dict(
            own=0,
            players=[dict(x=35, y=155), dict(x=275, y=165)],
            dirt=[[11, 100, 309, 189]],
        )
        case["players"][0]["ammo"] = [1000] * 18
        case["players"][0]["ammo"][5] = count
        cases.append(case)
    for i in range(60):
        positions = [(25 + 70 * j, 40 + (i * 31 + j * 47) % 145) for j in range(4)]
        cases.append(
            dict(
                own=i % 4,
                players=[dict(x=x, y=y) for x, y in positions],
                dirt=dirt[i % len(dirt)],
                random=i % 51,
            )
        )
    for own_y, target_x, target_y in [
        (100, 184, 100),
        (100, 100, 36),
        (100, 88, 68),
        (32, 90, 70),
        (185, 290, 170),
        (90, 71, 91),
    ]:
        cases.append(
            dict(
                own=0,
                players=[dict(x=40, y=own_y), dict(x=target_x, y=target_y)],
                dirt=[[11, 31, 309, 189]],
            )
        )
    cases.append(
        dict(
            own=0,
            players=[dict(x=35, y=155), dict(x=110, y=140)],
            dirt=[[11, 31, 309, 189]],
            pixels=[[35, 154, 20], [35, 153, 20], [36, 152, 20], [36, 151, 20]],
        )
    )
    for case in cases:
        case["expected"] = run(case)
    Path("tests/fixtures/twanger-oracle.json").write_text(
        json.dumps(cases, indent=2) + "\n"
    )
    print(len(cases), "original Twanger plans")


if __name__ == "__main__":
    main()
