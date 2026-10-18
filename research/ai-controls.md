# Incremental computer aiming

Tank Wars 3.2 uses a common executor after each strategist has selected a shot.
This pass changes execution/display, not the strategist's target selection.

## Command selection

EXE **0x2b00–0x2e19** normalizes ammunition and power, then returns a command.
Later conditions override earlier ones, producing this priority:

1. Weapon mismatch: command 8.
2. Direction mismatch: command 6.
3. Power mismatch: command 3 (decrease) or 4 (increase).
4. Elevation mismatch: command 1 or 2, accounting for direction.
5. All controls match: command 5 (fire), clearing the plan flag at object+2.

For a power difference greater than 99, the executor first changes the current
power by 90. It then independently tests the remaining difference against 9 and
changes it by 9. The common input handler adds the final unit. Effective steps
are therefore 100, 10, or 1. See **0x2cdd–0x2dfd** and OVR **0x1b467–0x1b4a5**.
The original stores elevation and direction separately. The browser keeps the
current AI direction separately too, so flipping a vertical gun cannot loop.

`tools/verify-ai-controls-oracle.py` executes the original resident instructions,
including original Real helpers for direction conversion, in Unicorn. Its 234
cases cover priority conflicts, both directions, vertical guns and power step
boundaries. The fixture captures the returned action and direct power writes;
tests add the handler's final ±1 separately.

## Weapon and sound presentation

Control 8 moves **forward** through IDs 0–17, skips empty ammunition and rejects
Laser reserves below 100 (OVR **0x1af24–0x1afcf**). Each eligible intermediate
weapon becomes selected; it does not jump straight to the requested weapon.

The palette loop **0x1afd2–0x1b02d** starts at 3, then increases by 4 through 63:
the jump into the first iteration skips one increment, while later iterations
execute all four increments. Thus its 16 counters are 3,7,…,63, correcting the
older shorthand in `icons.md`. The old icon goes from red to white, the new icon
from white to red. No explicit delay occurs inside this loop.

Angle and power commands use their original 10 ms speaker sequences. Direction
uses the four 5 ms notes. AI input type 3 skips the configurable input polling
Delay at OVR **0x1bf40–0x1bf4f**. CPU/rendering overhead remains hardware-dependent.
The browser deliberately presents ordinary commands every 1/30 second and icon
palette steps every 8 ms (128 ms per weapon). These are presentation choices,
not recovered DOS delays; muting sound does not hide the animation.

The engine plans once per turn and stores that plan through animation and saves.
Elapsed time is accumulated across frames, preserving the chosen shot, ammunition
and RNG at 30, 60 and 144 Hz. Firing occurs only after every command completes.
