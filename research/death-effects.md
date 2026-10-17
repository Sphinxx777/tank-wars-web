# Death effects0..5 — executable gameplay translation

Read-only static analysis of BOMB.OVR/BOMB.EXE, 2026-10-18. Addresses below are hexadecimal file offsets. No new emulator was started and no original file or dist asset changed. Case6 is intentionally omitted: see remaining-mechanics.md.

The six cases are quite different:0/2 throw11 small particles and excavate terrain,1/3 scatter point clouds,4 deposits dirt,5 only fades the tank. **None of cases0..5 invokes the conventional radial explosion-damage routine.** Direct particle/point contact damage is explicitly stated below. Later falling and death-chain handling occur outside these routines.

## Helpers, coordinates and accuracy boundary

Use `R(n)`=the linked Turbo Pascal bounded Random and `U()`=Random Real from fidelity-details.md. `trunc` is toward zero. `damage(i,n)` invokes the common **type0** damage helper, so the energy shield absorbs it; these death routines do not award10points/man locally. Tank-pixel colors20..29 identify player=color−19. Dead tanks and trails carrying that color remain distinguishable from the alive flag.

`BG` below is the saved original background pixel buffer (sky/background, not a snapshot preserving the destructible earth). `restorePoint(x,y)` copies BG[x,y] into framebuffer unconditionally, even when that erases dirt or a tank pixel. `eraseCircle(cx,cy,r)` restores the rasterized circle outline from BG, clipped to the current viewport. Calling it for all integer radii0..R produces a cleared disk. The original ellipse helpers0xcc8:351 and:687 **draw/restore outlines**, not mathematical filled circles: EXE0xe85f–0xe8b4 and0xeb95–0xebf3 write four symmetric pixels per midpoint step. For pixel-perfect parity use that ellipse rasterizer; a conventional circle rasterizer remains a small rasterization approximation.

The outline helpers add viewport origin, confirmed EXE0xe677–0xe680 and0xe9ad–0xe9b6. Particle cases0/2 use local coordinates: viewport origin(11,31), width299, height159. Point-cloud cases1/3/4 use global physical-screen coordinates and the direct pixel helpers.

`flash()` is a palette-only flicker helper, OVR0x1613c–0x16158, which consumes **one R(65535)** regardless of sound. Its precise historical low-memory palette reads need not be replicated to reproduce gameplay, but the random call must remain for a seed-matched port. Optional sound calls below consume the same RNG and must remain if sound is enabled, even if audio is synthesized differently.

## Case4: permanent dirt fountain — complete gameplay logic

Routine **OVR0x1879e–0x18a17**. No velocities, gravity, tank damage or terrain deletion. It writes permanent dirt pixels, including on top of other framebuffer colors, then redraws alive tanks and removes the dead tank's sprite.

```js
function death4(dead) {
  const waves = 30 + R(30);             //30..59, once
  for (let wave=1; wave<=waves; wave++) {
    const count = R(400);               //0..399, once per wave
    for (let k=1; k<=count; k++) {
      const h = R(10*wave);
      const dx = trunc(R(h+10) - h/2 - 5);
      let x=dead.x+dx, y=dead.y-h;
      //Repeat the whole ordered reflection pass until inside.
      while (x>309 || y<31 || x<11 || y>189) {
        if (x>309) x=618-x;
        if (y>189) y=378-y;
        if (y<31) y=62-y;
        if (x<11) x=22-x;
      }
      framebuffer[y][x]=2;
      if (sound) R(1000);               //pitch =100*wave+R(1000)
    }
  }
  redrawAliveTanks();
  eraseDeadBodyAndBarrelFromBG(dead);
}
```

Counts0x187a4–0x187e8; h/dx0x187f0–0x1885f; ordered repeated reflections0x188a7–0x18982; pixel write0x18985–0x1899e; sound RNG0x189aa–0x189c6; end0x189e6–0x18a14. Reflections occur even when the configured walls are None. They are spatial folding of generated points, not projectile wall physics.

## Case5: fade and remove — complete gameplay logic

Routine **OVR0x18a1a–0x18ad9**:

```js
function death5(dead) {
  for (let intensity=0; intensity<=100; intensity++) {
    setTankPaletteIntensity(dead,intensity);
    //optional deterministic pitch=2000+100*intensity; no RNG
    waitExplosionSpeed();
  }
  for (let intensity=100; intensity>=0; intensity--) {
    setTankPaletteIntensity(dead,intensity);
    waitExplosionSpeed();
  }
  restoreNormalTankPalette(dead);       //helper argument -1
  eraseDeadBodyAndBarrelFromBG(dead);
}
```

No Random call, damage call or terrain ellipse exists in this routine. Body removal is exact sprite-shaped BG restoration, EXE0x6287–0x6376; it is not a generic blast disk.

## Cases1 and3: five-layer directional point clouds — complete gameplay logic

Shared generator **OVR0x16edc–0x17d17**. Case1 passes variant0; case3 passes variant1. Neither integrates velocity. Every burst builds five independent point clouds at increasing distance; the two renderers differ in what is left on the ground.

```js
function makeCloud(dead, count, direction) {
  const points = Array.from({length:5},()=>[]);
  for (let layer=1; layer<=5; layer++) {
    for (let k=0; k<count; k++) {
      const h=R(10*layer);
      const q=trunc(R(h+10)-h/2-5);
      let x,y;
      switch(direction) {
        case 1: x=dead.x+q;   y=dead.y-h; break;
        case 2: x=dead.x+q;   y=dead.y+h; break;
        case 3: x=dead.x+h;   y=dead.y-q; break;
        case 4: x=dead.x-h;   y=dead.y-q; break;
        case 5: x=dead.x+q+h; y=dead.y-h; break;
        case 6: x=dead.x+q-h; y=dead.y-h; break;
        case 7: x=dead.x+q+h; y=dead.y+h; break;
        case 8: x=dead.x+q-h; y=dead.y+h; break;
      }
      //Generator stores everything, THEN runs this ordered single pass
      //over all layers/points. No RNG occurs during reflection.
      points[layer-1].push({x,y});
    }
  }
  for (const layer of points) for (const p of layer) {
    if(p.x>309) p.x=618-p.x;
    if(p.y>189) p.y=378-p.y;
    if(p.y<31) p.y=62-p.y;
    if(p.x<11) p.x=22-p.x;
  }
  return points;
}
function pointContact(p) {
  const color=framebuffer[p.y][p.x];
  if(color>=20 && color<=29) damage(color-19,1+R(3));
}
function deathCloud(dead, variant) {
  const bursts=5+R(5);                  //5..9, once
  for(let b=0;b<bursts;b++) {
    const count=2+R(390);               //2..391
    const direction=1+R(8);
    const points=makeCloud(dead,count,direction);
    for(let layer=0;layer<5;layer++) for(let k=0;k<count;k++) {
      if(sound) R(500*(layer+1));       //pitch +100
      const p=points[layer][k];
      pointContact(p);
      if(variant===0) {
        framebuffer[p.y][p.x]=1+R(14);
        if(layer>0) restorePoint(points[layer-1][k].x,points[layer-1][k].y);
      } else {
        let color=201+R(14);
        if(color===202) color=2;        //roughly1/14 points persist as dirt
        framebuffer[p.y][p.x]=color;
      }
    }
    if(variant===0)
      for(const p of points[4]) restorePoint(p.x,p.y);
  }
  redrawAliveTanks();
  eraseDeadBodyAndBarrelFromBG(dead);
  restoreAllPixelsWhoseCurrentColorIsBetween(201,220,BG);
}
```

The generator first samples **all** point positions for each burst, then renders; do not interleave position RNG with contact/color RNG. Direction branches:1 at0x16f58,2 at0x170c9,3 at0x17237,4 at0x173a5,5 at0x17513,6 at0x1769a,7 at0x17821,8 at0x179a8. Shared reflection pass0x17b2c–0x17ca1.

Variant0 renderer **0x16b28–0x16da5**: first layer is painted; later layers paint the new point and restore the corresponding previous-layer point immediately, in that order. Last layer restored after all five. Therefore it erodes dirt at visited locations rather than simply showing harmless particles over preserved terrain. Coincident point coordinates can also erase a point just drawn.

Variant1 renderer **0x16da8–0x16ed9**: paints all layers without per-layer restoration; color202 becomes dirt2. Final global color cleanup at0x17d01–0x17d0f removes201..220 but preserves2. This variant both erodes terrain at transient-colored points and leaves some new dirt. Existing dirt is not protected. Contact checks read the current framebuffer, so previous points/overwrites affect later tank hits. Both renderers invoke only raw contact damage1..3, not radial damage.

## Shared physics for cases0 and2

Both initialize **11 particles**, indices0..10, at the dead tank center in local viewport coordinates `(dead.x-11,dead.y-31)`.

```
vx = 0.5-U();        //(-.5,.5]
vy = 0.1-U();        //approximately(-.9,.1]
```

Each step, without configured shot subdivisions:

```js
p.x += p.vx;
p.y += p.vy;
p.vy += 0.007;                     //Real tuple3779,4189,6560
p.vx += wind/5000;
x=trunc(p.x); y=trunc(p.y);
color=getPixelLocal(x,y);
if(color===2 || color===13) p.stopped=true;
if(color>=20 && color<=29) damage(color-19,hitDamage());
//Boundary predicate differs between cases; see below.
putPixelLocal(x,y,dead.index+19);   //even on final step; trails remain
```

The decoded .007 is0.006999999999997897. Gravity is much smaller than a normal projectile's .1. No repulser, guidance or wall rebound/warp adjustment is called. Color13 is the border. Tank contact **does not stop the particle**; it damages and keeps moving, overwriting that pixel with the dead tank's color. Trails are retained until end cleanup, not restored every frame. Both effects can therefore hit the same live tank multiple times along the path, and later pixel checks may see dead-tank-colored trails instead of the victim.

Initialization: case0 OVR0x16384–0x16404; case2 0x17f44–0x17ffe. Integrator: case0 0x16409–0x164d0; case2 0x1802d–0x18184. Neither has a fixed particle lifetime/time cap: stop on dirt/border/out-of-bounds.

## Case0: sequential particles and excavations

Routine **OVR0x1615b–0x16b25**. Each particle flies and its landing disk is erased **before the next particle is initialized**. This ordering changes later random values and the terrain later particles encounter.

```js
function death0(dead) {
  preFlash();                         //RNG schedule described below
  for(let i=0;i<=10;i++) {
    if(sound) R(500);
    const p={x:dead.x-11,y:dead.y-31,vx:.5-U(),vy:.1-U(),stopped:false};
    do {
      stepAsAbove(p,()=>5+R(10));     //raw damage5..14 on tank contact
      if(x>320 || x<0 || y>200 || y<0) p.stopped=true;
      flash();
      //putPixelLocal occurs after this flash in the original.
    } while(!p.stopped);
    landingExcavation(p);             //defined below, consumes RNG
  }
  centerExcavationAndFade(dead);
  redrawAliveTanks();
  restoreAllPixelsWhoseCurrentColorEquals(dead.index+19,BG);
  restoreAllPixelsWhoseCurrentColorIsBetween(130,159,BG);
}
```

Use step body's pixel write after `flash()` for literal ordering. Bounds are the observed local **0..320,0..200**, despite the viewport being smaller. Do not silently replace them with case2's narrower checks. Dirt/border/contact checks are0x164d3–0x1652a; bounds0x1652a–0x16549; flash and put0x1657b–0x1658b; repeat0x16590–0x16597; next particle0x16772–0x16779.

Earlier remaining-mechanics.md incorrectly suggested case0's later stages could deal1..3. Those damage calls belong to the separate cloud renderers starting0x16b28, not to case0. Case0's only direct damage is5+R(10) during flight.

## Case2: simultaneous particle flight, then excavations

Routine **OVR0x17d1a–0x1879b**. Initialize all11 particles first, then round-robin integrate each still-active particle once per outer pass. Stop after a whole pass finds no active particles. The code actually performs one extra empty pass after all particles stop; that pass consumes a flash RNG call.

```js
function death2(dead) {
  preFlash();
  const particles=[];
  for(let i=0;i<=10;i++) {
    if(sound) R(500);
    particles.push({x:dead.x-11,y:dead.y-31,vx:.5-U(),vy:.1-U(),stopped:false});
  }
  while(true) {
    let hadActive=false;
    flash();                         //once per outer frame, including final empty frame
    for(const p of particles) if(!p.stopped) {
      hadActive=true;
      stepAsAbove(p,()=>10+R(10));   //raw damage10..19
      if(x>298 || x<0 || y>158 || y<0) p.stopped=true;
      //putPixelLocal after checking bounds, even if stopped
    }
    if(!hadActive) break;
  }
  for(const p of particles) landingExcavation(p);
  centerExcavationAndFade(dead);
  redrawAliveTanks();
  restoreAllPixelsWhoseCurrentColorEquals(dead.index+19,BG);
  restoreAllPixelsWhoseCurrentColorIsBetween(130,154,BG);
}
```

Activity sentinel/flash0x18008–0x18014, raw damage0x181bf–0x181e2, bounds0x181e7–0x18205, loop0x1826f–0x18280. Landings processed in particle index order0x18283–0x18453. The case2 common step has no per-particle flash, only per-frame flash. Optional in-flight pitch is deterministic `1500+5*(localDeadY-trunc(p.y))`, with no random call.

## Landing excavation shared by cases0/2

**No radial health damage** occurs here. A colored expanding disk is drawn using repeated outlines and then unconditionally restored from BG, deleting dirt within it. Each landing independently chooses radius4,8,12,16,20 with probabilities30%,30%,20%,10%,10% under the modulo RNG.

```js
function landingExcavation(p) {
  const paletteBase=100+10*(3+R(3));  //130/140/150
  const q=R(10);
  const scale=q<3?1:q<6?2:q<8?3:q===8?4:5;
  const radius=4*scale;
  for(let r=0;r<=radius;r++) {
    if(sound) R(2500);
    //case2 flash occurs here; case0 flash occurs after draw/delay
    paintCircle(trunc(p.x),trunc(p.y),r,paletteBase+trunc(r/scale));
    paintCircle(trunc(p.x)+1,trunc(p.y),r,paletteBase+trunc(r/scale));
    flash();                          //exactly one per r either way
  }
  for(let r=radius;r>=0;r--) {
    if(sound) R(2500);
    //case2 flash before restore; case0 flash after restore
    eraseCircle(trunc(p.x),trunc(p.y),r);
    eraseCircle(trunc(p.x)+1,trunc(p.y),r);
    flash();
  }
}
```

Choice and loops: case0 0x165c0–0x16772; case2 0x182a8–0x18449. Since no Random occurs between flash and circle operations, the two visual orderings consume the same number/order of RNG calls. The clipped ellipse raster itself and restoration order can affect colored framebuffer pixels, but no collision processing runs inside this animation.

## Center excavation and nonvisual RNG preservation

After all landing disks, both cases erase a **radius30 disk at the dead tank center and a second at x+1**, by BG-restoring all circle outlines r=30 down to0. Evidence case0 **0x16a0d–0x16a7a**, case2 **0x18685–0x186f2**. This is terrain removal only, no bomb damage helper. The preceding expanding ring sequence reaches radius30; cases differ slightly in whether intermediate outlines also have an x+1 companion, but final terrain excavation has both centers in both cases.

To omit elaborate palette animation while keeping RNG schedule before physics, `preFlash()` is:

```js
function preFlash() {
  for(let i=0;i<104;i++) { if(sound) R(500); flash(); }
}
```

There are three initial palette phases with one flash each, then101 flashes (loop0..100). Evidence case0 0x161c7–0x16307 and case2 0x17d87–0x17ec7.

After landing excavations and before final radius30 restoration, center expanding/fading graphics consume:

```js
function centerExcavationAndFade(dead) {
  //15 iterations; each draws radii odd and even with five flashes each.
  for(let pair=0;pair<15;pair++) {
    const oddRadius=2*pair+1;
    for(let half=0;half<2;half++) for(let k=0;k<5;k++) {
      if(sound) R(1300-40*oddRadius);
      flash();
    }
  }
  //15 palette-fade iterations; each has three unconditional random RGB calls.
  for(let i=0;i<15;i++) {
    if(sound) R(200);
    R(63); R(63); R(63);
  }
  for(let r=30;r>=0;r--) {
    eraseCircle(dead.x-11,dead.y-31,r);
    eraseCircle(dead.x-10,dead.y-31,r);
  }
}
```

Expanding/fading evidence case0 0x1677c–0x16a0d, case2 0x18453–0x18685. These hooks preserve RNG consumption without requiring original palette flashes. The code assumes viewport-local ellipse coordinates until the end of the effect. Finally restore full-screen viewport and original dead-player coordinate fields, then perform redraw/color cleanup.

## Remaining strict-parity boundaries

Gameplay counts, velocities, raw damage, terrain writes, order and termination above come directly from the listed instructions. Exact ellipse rasterization, software Pascal Real rounding on every arithmetic operation, and VGA palette memory reads are not implemented by this report. The pseudocode calls collision/drawing helpers explicitly so that a web implementation can use its pixel framebuffer; replacing it with circle hitboxes or a heightmap loses the original overwriting/collision behavior.

## Attribution and chained death accounting

Confirmed from caller/helper instructions: the raw damage helper OVR0x1f123 accepts damage, defense type and a target record pointer; it has no attacker parameter and does not award points. Particle effects therefore award no10-per-man points. Later kill processing always uses the current shooter index `byte DS[0x47ee]`, not the dying tank's index. OVR0x15995–0x159b4 compares the team of dead `word DS[0x4740]` against the current shooter. OVR0x159b6–0x15a07 adds1500 and increments kills for an enemy death; 0x15a0d–0x15a3b subtracts1000 for a same-team death. This remains the attribution for deaths caused by death effects.

Case6 has a distinct scratch-record detail: OVR0x18b9b–0x18bb2 copies the dying player's entire0x74-byte record into player0 at DS0x402e; 0x18c28–0x18c47 calls the ordinary explosion with source index0. The radial damage loop OVR0x19732–0x19767 awards10*actualMenLost into the record identified by its source argument, after comparing that record's team with the victim's. Thus case6 uses the dead tank's copied team but awards those damage points only to scratch player0. The effect returns without copying this score back. Neither the real dead player nor the current shooter receives these per-man points; later kill bonuses still go to the current shooter as above.

The death-resolution pass marks a tank no longer alive before invoking its death effect (0x158a6–0x158af), then applies that tank's kill accounting after the effect returns. It scans players in ascending index, repeats the pass while deaths/falls/crumbling caused a change (0x15aa9–0x15ab0), and does not recursively dispatch a death effect immediately on every particle hit.
