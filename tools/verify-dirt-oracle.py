#!/usr/bin/env python3
"""Record dirt rasters and Explosive Dirt from unmodified DOS instructions.

Run at repo root: PYTHONPATH=/tmp/tankwars-research-pylib python3 tools/verify-dirt-oracle.py
Requires optional Unicorn plus the local-only original EXE/OVR. The BGI generic
ellipse code executes unchanged, with its final pixel callback captured. The
Explosive Dirt branch executes original Pascal Real arithmetic and loops;
only graphics/audio I/O and deterministic Random input are intercepted.
"""

import hashlib
import json
import math
import struct
from pathlib import Path
from unicorn import Uc, UC_ARCH_X86, UC_MODE_16, UC_HOOK_CODE
from unicorn.x86_const import *

EXE = Path("research/original/BOMB.EXE").read_bytes()
OVR = Path("research/original/BOMB.OVR").read_bytes()


def word(cpu, address, value):
    cpu.mem_write(address, struct.pack("<H", value & 65535))


def signed(value):
    return value if value < 32768 else value - 65536


def real48(value):
    if value == 0:
        return bytes(6)
    fraction, exponent = math.frexp(abs(value))
    bits = round((fraction * 2 - 1) * 2**39) | ((value < 0) << 39)
    return bytes([exponent + 128]) + bits.to_bytes(5, "little")


def arguments(cpu, count):
    return struct.unpack(
        f"<{count}H", cpu.mem_read(0x70000 + cpu.reg_read(UC_X86_REG_SP) + 4, count * 2)
    )


def far_return(cpu, count):
    sp = cpu.reg_read(UC_X86_REG_SP)
    ip, cs = struct.unpack("<HH", cpu.mem_read(0x70000 + sp, 4))
    cpu.reg_write(UC_X86_REG_SP, sp + 4 + count)
    cpu.reg_write(UC_X86_REG_CS, cs)
    cpu.reg_write(UC_X86_REG_IP, ip)


class CircleOracle:
    def __init__(self):
        self.cpu = cpu = Uc(UC_ARCH_X86, UC_MODE_16)
        cpu.mem_map(0, 0x200000)
        # BGI dispatch adapter is relocated at runtime; its offsets are relative
        # to EXE 0x11b23. The game has equal axis aspect and one-pixel line width.
        cpu.mem_write(0x30000, EXE[0x11B23:0x13680])
        for reg, val in [
            (UC_X86_REG_CS, 0x3000),
            (UC_X86_REG_DS, 0x3000),
            (UC_X86_REG_SS, 0x7000),
        ]:
            cpu.reg_write(reg, val)
        cpu.mem_write(0x3006F, b"\x01")  # direct pixel sink; no driver color conversion
        word(cpu, 0x30097, 29)  # floor(199 * 1000 / 7000) + 1 from driver mode data
        self.points = []

        def instruction(cpu, address, size, data):
            if address == 0x3FF00:
                cpu.emu_stop()
            if address == 0x30000 + 0x12B8A - 0x11B23:
                self.points.append(
                    [
                        signed(cpu.reg_read(UC_X86_REG_SI)),
                        signed(cpu.reg_read(UC_X86_REG_DI)),
                    ]
                )
                sp = cpu.reg_read(UC_X86_REG_SP)
                ip = struct.unpack("<H", cpu.mem_read(0x70000 + sp, 2))[0]
                cpu.reg_write(UC_X86_REG_SP, sp + 2)
                cpu.reg_write(UC_X86_REG_IP, ip)

        cpu.hook_add(UC_HOOK_CODE, instruction)

    def circle(self, radius, cx=160, cy=100):
        cpu = self.cpu
        self.points = []
        cpu.reg_write(UC_X86_REG_SP, 0xFF00)
        word(cpu, 0x7FF00, 0xFF00)
        word(cpu, 0x30380, cx)
        word(cpu, 0x30382, cy)
        for reg, val in [
            (UC_X86_REG_AX, 0),
            (UC_X86_REG_BX, 360),
            (UC_X86_REG_CX, radius),
            (UC_X86_REG_DX, radius),
        ]:
            cpu.reg_write(reg, val)
        # Complete unfilled full-circle fallback entry, not a translated formula.
        cpu.emu_start(0x30000 + 0x12346 - 0x11B23, 0x3FF00, count=1000000)
        assert cpu.reg_read(UC_X86_REG_IP) == 0xFF00
        return self.points


def raster(points, clip=(0, 0, 319, 199)):
    pixels = bytearray(64000)
    left, top, right, bottom = clip
    for x, y in points:
        if left <= x <= right and top <= y <= bottom:
            pixels[y * 320 + x] = 2
    return {"pixels": pixels.count(2), "sha256": hashlib.sha256(pixels).hexdigest()}


def explosive(x, y, sound, salt, crumble, roll):
    cpu = Uc(UC_ARCH_X86, UC_MODE_16)
    cpu.mem_map(0, 0x200000)
    cpu.mem_write(0, EXE[0x16A0:])
    cpu.mem_write(0x20000, OVR[0x18000:])
    cpu.mem_write(0x60000, EXE[0x163F0:])
    for reg, val in [
        (UC_X86_REG_CS, 0x2000),
        (UC_X86_REG_DS, 0x6000),
        (UC_X86_REG_SS, 0x7000),
        (UC_X86_REG_SP, 0xF000),
        (UC_X86_REG_BP, 0xF800),
    ]:
        cpu.reg_write(reg, val)
    cpu.mem_write(0x7F80E, real48(x))
    cpu.mem_write(0x7F808, real48(y))
    cpu.mem_write(0x6E8B3, bytes([sound]))
    word(cpu, 0x6E8A4, crumble)
    calls = []
    points = []
    tones = []
    stops = []
    collapses = []
    events = []

    def instruction(cpu, address, size, data):
        if address == 0x14355:
            limit = arguments(cpu, 1)[0]
            value = (len(calls) * 13 + salt) % limit
            calls.append([limit, value])
            cpu.reg_write(UC_X86_REG_AX, value)
            far_return(cpu, 2)
        elif address == 0x1436B:
            for reg, val in zip(
                [UC_X86_REG_AX, UC_X86_REG_BX, UC_X86_REG_DX],
                struct.unpack("<3H", real48(roll)),
            ):
                cpu.reg_write(reg, val)
            events.append("crumble roll")
            far_return(cpu, 0)
        elif address == 0xE260 + 0xF93:
            far_return(cpu, 10)
        elif address == 0xE260 + 0x1072:
            cpu.reg_write(UC_X86_REG_AX, 319)
            far_return(cpu, 0)
        elif address == 0xE260 + 0x1085:
            cpu.reg_write(UC_X86_REG_AX, 199)
            far_return(cpu, 0)
        elif address == 0xE260 + 0x1FE4:
            color, py, px = arguments(cpu, 3)
            points.append([signed(px) + 11, signed(py) + 31])
            far_return(cpu, 6)
        elif address == 0x11F80 + 0x2C7:
            tones.append(arguments(cpu, 1)[0])
            far_return(cpu, 2)
        elif address == 0x11F80 + 0x2F4:
            stops.append(len(points))
            far_return(cpu, 0)
        elif address == 0x4310 + 0x496:
            collapses.append(len(points))
            far_return(cpu, 8)

    cpu.hook_add(UC_HOOK_CODE, instruction)
    cpu.emu_start(0x220C3, 0x223EB, count=10000000)
    assert cpu.reg_read(UC_X86_REG_IP) == 0x23EB
    return {
        "x": x,
        "y": y,
        "sound": bool(sound),
        "randomSalt": salt,
        "randomRule": "(callIndex * 13 + randomSalt) % limit",
        "crumble": crumble,
        "roll": roll,
        "randomCalls": len(calls),
        "points": points,
        "toneCount": len(tones),
        "tonesSha256": hashlib.sha256(
            struct.pack(f"<{len(tones)}H", *tones)
        ).hexdigest(),
        "stopAtPoint": stops,
        "crumbleAtPoint": collapses,
        "events": events,
        "raster": raster(points, (11, 31, 309, 189)),
    }


oracle = CircleOracle()
circles = [{"radius": r, **raster(oracle.circle(r))} for r in range(61)]
disks = []
for radius in [10, 15, 30, 60]:
    for x, y in [(160, 100), (12, 32), (308, 188)]:
        points = []
        for r in range(radius + 1):
            for shift in [1, -1, 0]:
                points.extend(oracle.circle(r, x + shift, y))
        disks.append(
            {"radius": radius, "x": x, "y": y, **raster(points, (11, 31, 309, 189))}
        )
particles = [explosive(160.75, 170.5, sound, 5, 50, 0.999) for sound in [0, 1]]
particles += [
    explosive(12.75, 40.5, False, 1, 0, 0),
    explosive(308.75, 188.5, False, 2, 25, 0.5),
]
output = Path("tests/fixtures/dirt-oracle.json")
output.write_text(
    json.dumps({"circles": circles, "disks": disks, "explosive": particles}, indent=2)
    + "\n"
)
print(
    f"Captured {len(circles)} circles, {len(disks)} dirt disks, {len(particles)} Explosive Dirt runs in {output}"
)
