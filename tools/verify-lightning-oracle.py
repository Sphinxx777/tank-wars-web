#!/usr/bin/env python3
"""Capture lightning paths and gates from original Tank Wars 3.2 instructions.

Run from repository root with PYTHONPATH=/tmp/tankwars-research-pylib.
Requires optional Unicorn and the local-only original EXE/OVR. Deterministic
bounded RNG inputs replace Random; original Pascal Real arithmetic, path loops,
and trigger comparisons execute unchanged. Graphics/audio I/O are intercepted.
"""

import hashlib
import json
import struct
from pathlib import Path

from unicorn import UC_ARCH_X86, UC_HOOK_CODE, UC_MODE_16, Uc
from unicorn.x86_const import (
    UC_X86_REG_AX,
    UC_X86_REG_BP,
    UC_X86_REG_CS,
    UC_X86_REG_DS,
    UC_X86_REG_IP,
    UC_X86_REG_SP,
    UC_X86_REG_SS,
)

EXE = Path("research/original/BOMB.EXE").read_bytes()
OVR = Path("research/original/BOMB.OVR").read_bytes()


def setup(file_start):
    cpu = Uc(UC_ARCH_X86, UC_MODE_16)
    cpu.mem_map(0, 0x200000)
    cpu.mem_write(0, EXE[0x16A0:])
    cpu.mem_write(0x20000, OVR[file_start:])
    cpu.mem_write(0x60000, EXE[0x163F0:])
    for register, value in [
        (UC_X86_REG_CS, 0x2000),
        (UC_X86_REG_DS, 0x6000),
        (UC_X86_REG_SS, 0x7000),
        (UC_X86_REG_SP, 0xF000),
        (UC_X86_REG_BP, 0xF800),
    ]:
        cpu.reg_write(register, value)
    return cpu


def word(cpu, address, value):
    cpu.mem_write(address, struct.pack("<H", value & 65535))


def arguments(cpu, count):
    stack = 0x70000 + cpu.reg_read(UC_X86_REG_SP) + 4
    return struct.unpack(f"<{count}H", cpu.mem_read(stack, count * 2))


def far_return(cpu, argument_bytes):
    stack = cpu.reg_read(UC_X86_REG_SP)
    ip, cs = struct.unpack("<HH", cpu.mem_read(0x70000 + stack, 4))
    cpu.reg_write(UC_X86_REG_SP, stack + 4 + argument_bytes)
    cpu.reg_write(UC_X86_REG_CS, cs)
    cpu.reg_write(UC_X86_REG_IP, ip)


def capture_path(x_start, x_end, sound, salt):
    cpu = setup(0x18000)
    word(cpu, 0x7F800 - 8, x_start)
    word(cpu, 0x7F800 - 12, x_end)
    cpu.mem_write(0x6E8B3, bytes([sound]))
    random_calls = []
    paths = []
    sound_count = 0
    restore_count = 0
    stops = 0

    def instruction(cpu, address, size, data):
        nonlocal sound_count, restore_count, stops
        if address == 0x12CE0 + 0x1675:
            limit = arguments(cpu, 1)[0]
            result = (len(random_calls) * 13 + salt) % limit
            random_calls.append([limit, result])
            cpu.reg_write(UC_X86_REG_AX, result)
            far_return(cpu, 2)
        elif address == 0x20000 + 0x1A55E - 0x18000:
            row = struct.unpack("<H", cpu.mem_read(0x7F800 - 2, 2))[0]
            if row == 31:
                paths.append([])
        elif address == 0xCC80 + 0xBFF:
            # No tanks in this fixture; the native read routine otherwise reads VGA.
            cpu.reg_write(UC_X86_REG_AX, 0)
            far_return(cpu, 4)
        elif address == 0xCC80 + 0xBB6:
            color, row, column = arguments(cpu, 3)
            if color == 200:
                paths[-1].append(column if column < 32768 else column - 65536)
            far_return(cpu, 6)
        elif address == 0xCC80 + 0xBD8:
            restore_count += 1
            far_return(cpu, 8)
        elif address == 0x11F80 + 0x2C7:
            sound_count += 1
            far_return(cpu, 2)
        elif address == 0x11F80 + 0x2F4:
            stops += 1
            far_return(cpu, 0)
        elif address == 0x20000 + 0x1A777 - 0x18000:
            cpu.emu_stop()

    cpu.hook_add(UC_HOOK_CODE, instruction)
    cpu.emu_start(0x20000 + 0x1A459 - 0x18000, 0x30000, count=5000000)
    assert cpu.reg_read(UC_X86_REG_IP) == 0x2777
    assert all(len(path) == 159 for path in paths)
    return {
        "xStart": x_start,
        "xEnd": x_end,
        "sound": bool(sound),
        "randomSalt": salt,
        "randomRule": "(callIndex * 13 + randomSalt) % limit",
        "randomCalls": len(random_calls),
        "passes": len(paths),
        "paths": paths,
        "soundCalls": sound_count,
        "stopCalls": stops,
        "restoredPixels": restore_count,
    }


def capture_trigger(rounds, death, roll):
    cpu = setup(0x15000)
    word(cpu, 0x647EA, rounds)
    cpu.mem_write(0x6480F, bytes([death]))
    calls = []
    strikes = 0

    def instruction(cpu, address, size, data):
        nonlocal strikes
        if address == 0x12CE0 + 0x1675:
            calls.append(arguments(cpu, 1)[0])
            cpu.reg_write(UC_X86_REG_AX, roll)
            far_return(cpu, 2)
        elif address == 0xB130 + 0x25:
            strikes += 1
            far_return(cpu, 2)

    cpu.hook_add(UC_HOOK_CODE, instruction)
    cpu.emu_start(0x20A71, 0x20AA9, count=1000)
    assert cpu.reg_read(UC_X86_REG_IP) == 0xAA9
    return {
        "roundCounter": rounds,
        "deathThisPass": bool(death),
        "roll": roll,
        "randomLimits": calls,
        "strikes": strikes,
        "repeatDeathPass": bool(cpu.mem_read(0x6480F, 1)[0]),
    }


output = {
    "executableSha256": hashlib.sha256(EXE).hexdigest(),
    "overlaySha256": hashlib.sha256(OVR).hexdigest(),
    "pathRoutine": "OVR 0x1a459..0x1a777; original resident Real arithmetic",
    "triggerRoutine": "OVR 0x15a71..0x15aa9",
    "paths": [
        capture_path(40, 280, False, 2),
        capture_path(309, 10, True, 7),
        capture_path(10, 10, False, 0),
        capture_path(173, 81, True, 4),
    ],
    "triggers": [
        capture_trigger(rounds, death, roll)
        for rounds, death, roll in [
            (1, False, 0),
            (10, False, 0),
            (11, False, 0),
            (11, False, 10),
            (11, False, 11),
            (11, False, 99),
            (99, False, 98),
            (99, False, 99),
            (100, False, 99),
            (11, True, 0),
            (100, True, 0),
        ]
    ],
}
Path("tests/fixtures/lightning-oracle.json").write_text(
    json.dumps(output, indent=2) + "\n"
)
print("Captured 4 original path sequences and 11 trigger cases")
