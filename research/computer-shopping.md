# Computer shopping in Tank Wars 3.2

Read-only reverse engineering of the supplied BOMB.EXE/BOMB.OVR, 2026-10-18.
All offsets below are hexadecimal file offsets. The selection branches were also
executed directly with Unicorn; 29 captured decisions are in
`tests/fixtures/computer-shop-oracle.json`. Reproduce them with
`PYTHONPATH=/tmp/tankwars-research-pylib python3 tools/verify-computer-shop-oracle.py`.
The local original binaries and optional Unicorn package are required only to
regenerate the fixture, not to play or test the recreation.

## Persistent shopping personality

The AI base constructor EXE **0x2930–0x29e4** chooses `1 + Random(4)` at
**0x29b7–0x29c4**, and retries until that value belongs to a constructor-specific
set (**0x29c8–0x29da**). The chosen shopping strategy occupies AI object word
**+0x0e**, independent of its aiming algorithm. Getter EXE **0x2abd–0x2ad3**
returns this word. It is serialized/restored by EXE **0x29f6–0x2aba**.

| Opponent | Allowed shopping strategies | Constant set in EXE |
| --- | --- | --- |
| Mr. Stupid | 1, 2, 4 | 0x2e1a |
| Lobber | 1, 2, 4 | 0x2fb8 |
| Rifleman | 1, 2, 3, 4 | 0x37ac |
| Lob & Shoot | 1, 2, 4 | 0x3d76 |
| Windless Wit | 1, 2, 4 | 0x3f22 |
| Twanger | 1, 2, 3, 4 | 0x4aa2 |
| Wind Master | 1, 2, 4 | 0x4422 |

These values are picked at AI construction, not freshly every shopping visit.
Construction calls in new-game setup are OVR **0x688–0x7de**. Save loading
constructs an object at **0xcf7d–0xd070** and restores its saved state at
**0xd099**, including the shopping strategy. New players start with zero score
and zero spent money, so there is no opening cash with which to shop.

## Eligibility and execution

The shop loops over every player, including dead ones, at OVR
**0x9997–0x99bf**. It does not filter on alive status. Computers are eligible
only if their strategy is nonzero and Computers Can Buy is enabled
(**0x99c2–0x99ee**). Available cash is cumulative score minus cumulative spent;
players below the cheapest positive-quantity lot price skip the shop
(**0x98c9–0x9995**, **0x99f1–0x9a1c**). Standard tables make that minimum
**3000**, the Incinerator lot, not 2000.

The original draws the same shop header and cards for a computer as for a
human. Its selection logic acts on that screen, repeatedly reserving one lot,
then chooses Done and commits the cart when no item qualifies. It is not six
random weapon purchase attempts. There is no explicit Delay call in the AI
selection/commit path; perceived pace depends on original rendering speed.

The visible cards remain in weapon ID order, then guidance, then defense.
Available cash for selection is `score - spent - cartCost`. Reservations are
counted before purchase, so all stock thresholds include reserved units.

## Four exact selection strategies

The following names are explanatory labels, not original visible text.

1. **Maintain a stock of conventional explosives** — OVR **0xa085–0xa1ac**.
   Select the lowest-ID affordable weapon among **1, 2, 3, 4** whose
   `owned + cartLots * lotQuantity < 20`. The reverse card scan overwrites
   the candidate rather than stopping at the first match, thus the lowest
   eligible ID wins. Stop when none qualifies. For example, with 30
   Incinerators, zero other explosives and 10000 cash, buy Mark II lots
   until its stock is at least20, then consider the nukes. With all four
   stocks at least20, this strategy saves all remaining money.
2. **Prefer the largest conventional explosive** — **0xa1af–0xa2b9**.
   Select the highest-ID affordable weapon among **1, 2, 3, 4**, with no
   stock threshold. Then override that choice with Incinerator if its
   owned-plus-reserved stock is below20. This replenishment override
   is checked at **0xa26c–0xa2a8**.
3. **Prefer laser over conventional explosives** — **0xa2bc–0xa3c6**.
   Same as strategy2, but the set is **1, 2, 3, 4, 5**, making Laser the
   priority when affordable. Incinerator replenishment still takes priority.
4. **Prefer defenses** — **0xa3c9–0xa4cf**.
   Select the lowest-ID affordable defense among **0, 1, 2** with no
   owned-stock threshold. Then apply the same Incinerator replenishment
   override. With standard prices this means Energy Shield at cash>=20000,
   otherwise Inertia Dampener at cash>=10000. Repulser is never preferred
   over a cheaper eligible Inertia Dampener under these standard prices.

Weapon eligibility sets are encoded at OVR **0x984b** = {1,2,3,4},
**0x986b** = {1,2,3,4,5}, and defense set **0x988b** = {0,1,2}.
Thus no original strategy here buys MIRVs, CRIs, Sonic, dirt weapons, or guidance.

Actual reservation checks cash again at **0xa807–0xa837**, increments cart
cost and lot count at **0xa83a–0xa84e**, and caps each card at **9 lots**
at **0xa78c–0xa7a2**. Done commits every reserved lot through the same shared
purchase path as humans (**0xaae4–0xacaf**). Score is not reduced; cumulative
spent increases, and inventories persist across rounds.

## Original no-progress edge cases

The selection branches themselves ignore the 9-lot reservation cap. With high
enough money, a strategy can continue selecting a card already at9 lots,
while the reservation code refuses to increment it. Similarly, strategies
2–4 force Incinerator replenishment below20 stock without checking whether
remaining unallocated money still covers that lot. The shared reservation
check then refuses the unaffordable choice. Neither selection path emits
Purchase or Done automatically in these states. These are static control-flow
findings; the oracle also confirms the bad candidate is returned.

A browser implementation should detect that no reservation can be made,
commit the accumulated cart, and leave the shop rather than intentionally
freeze. This is a deliberate safety difference, not claimed original parity.
The last two oracle cases capture these rejected selections so the guard can
be tested explicitly. Restricting execution to a bounded number of iterations
also prevents malformed save data from freezing the page.

## Oracle scope

The oracle executes the original selection instructions and original resident
getter, set-membership, and integer multiplication helpers. It supplies a
complete card list in original order; owned/unaffordable invisible cards do
not alter these candidates because branches apply their own affordability
checks. Each fixture's `money` is already-unallocated cash. `cart` contains
weapon IDs mapped to reserved lot counts. The oracle covers selection only;
9-lot limits, cash commitment, profile lifetime, and UI drawing are independently
identified in the surrounding disassembly above.
