# Persistent projectile trails

Bounded inspection of Tank Wars 3.2 original instructions, 2026-10-19. Offsets
are hexadecimal file offsets in the locally supplied `BOMB.EXE` / `BOMB.OVR`.

## Storage and lifetime

The trail is part of the saved background, not a temporary list for the current
shot. Resident EXE **0x5f1d–0x5f41** receives x, y, palette index and the saved
background pointer. It computes `y*320+x` and writes the same palette byte both
to VGA segment A000 and to the passed background segment. The pointer's offset
word is ignored by this assembly helper; the game's allocation is segment based.

Ordinary flight calls this helper at OVR **0x11982**, passing the pointer
`DS:e5c0/e5c2`. MIRV flight uses the identical helper at **0x13242**, with the
same saved background and owner color. Neither call creates a new background
for its shot. The ordinary launch initializes palette entries (below), but does
not clear prior trail pixels. Consequently traces survive subsequent shots and
turns, including their owner's death.

A new battle background clears the full saved 64000-byte bitmap at OVR
**0x1c0c6–0x1c0d3** before generating its new pattern. That is the round-level
reset. A browser save/restore during a round must preserve trails too; the
native save format is not being claimed to match the DOS save format.

## Color and order

OVR **0x11246–0x11294** initializes each player's trail at palette index
`100 - oneBasedPlayerIndex` (99 down to90). Each DAC component is integer
`32 / playerColorDivisor`, independent of tank MEN. These colors are outside the
background animation's palette range (30..49 or30..59). They stay dim and do not
fade with time or with damage to the owner.

At **0x11939–0x11987**, ordinary flight handles the previous integer center:

1. Require x>11, x<309 and y>31. This caller has no upper-y guard.
2. If the projectile is visible, restore its old five-pixel cross from saved
   background using EXE **0x5dbf–0x5e1d**.
3. If trails are enabled, write only the old center using the dual-buffer helper.

MIRV does the same at **0x131d0–0x13247**. The collision/position center is the
cached integer position, not a newly rounded render-time coordinate. Crossings
are last-write-wins: a later owner's trail replaces the earlier color at that
pixel in both buffers. Turning trail drawing off does not erase already written
background bytes.

## Earth and restoration effects

Adding dirt writes palette2 to the visible framebuffer without deleting the
saved trail. Dirt therefore covers the trace; when the dirt is removed by a
background restore, the trace reappears. Conversely, writing a new trace directly
onto dirt overwrites the visible dirt at that one pixel. The trail is background
palette90..99, so it does not block ordinary projectile collision and permits
crumble just like other background pixels. Crumble's background test accepts
palette0 and30..99 (EXE **0x5e46–0x5f1a**).

Explosion cleanup, Sonic cleanup, laser cleanup and lightning restore from this
same background pointer. References include OVR **0x19473–0x194ad** (explosion
outlines), **0x19e98–0x19ea2** (Sonic cross), **0x1510d–0x15115** (laser cleanup),
and **0x1a6e2–0x1a734** (lightning). Therefore these effects do not erase trails:
“original sky” in older research means the saved background, which can already
contain traces. Newly drawn effects can temporarily cover a trace.

A persistent owner byte map beneath terrain is an appropriate native
representation for these trail rules. It must be updated in flight order,
retained across shots, and serialized. Rendering all historical polyline arrays
above terrain is incorrect both at trail crossings and under added earth.

## Independent original-instruction check

Executed the unmodified resident dual-buffer writer and five-pixel restorer in
Unicorn, with VGA at A0000, saved background at90000, x80,y80. The observed center
bytes `[visible, saved]` were:

| Action | Bytes |
| --- | --- |
| Player1 trail write | `[99,99]` |
| Cover visible pixel with dirt | `[2,99]` |
| Original cross background restore | `[99,99]` |
| Player2 trail crosses this pixel | `[98,98]` |

The experiment uses original instructions for both writes and restoration; only
the dirt-cover step is an explicit framebuffer write. It establishes this storage
interaction, not full pixel-for-pixel battle equivalence. Other transient pixels
and projectile-cross restoration still require careful ordering in a layered
renderer.
