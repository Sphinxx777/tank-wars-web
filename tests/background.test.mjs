import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createBattleBackground,createMenuBackground,backgroundFrame,backgroundPhase,BIOS_TICK_HZ} from '../dist/background.js';
const hash=p=>createHash('sha256').update(p).digest('hex');

test('battle backdrop rasters match original machine-code line oracle',()=>{
  const expected={2:'7ea4616489734d5d7442017e65351595c4b78df3c5c27b42910772e2046e5b87',4:'3c1545ca903acaa8c6d5f9c567331c4323482bf24ab5b17e3f9f62f80c8f6d73',5:'b9024746e9d9e2e997ccb12c33130b513bd71f61c0a4c83504282839f83c1c40',7:'2e2fda7b43192f6ce917d9878ae22985ebd8a7d78cd28acc0238026330ad380e',8:'f64a6b27cb64bab9bf1c044c8284e7db30d66f5f897320e2fd5a166ea86d735b'};
  for(const [kind,digest] of Object.entries(expected))assert.equal(hash(createBattleBackground(Number(kind),{int:()=>0}).pixels),digest,`mode ${kind}`);
});
test('only generation consumes RNG; Sky and None only draw the direction toggle, static pixels are column-major',()=>{
  for(const [kind,count] of [[0,1],[1,752],[2,10],[3,10],[4,10],[5,1],[6,47551],[7,11],[8,10]]){
    let calls=0;const bg=createBattleBackground(kind,{int:n=>{calls++;return 0;}});
    assert.equal(calls,count,`mode ${kind}`);backgroundFrame(bg,10);backgroundFrame(bg,20);assert.equal(calls,count);
  }
  let calls=0;const bg=createBattleBackground(6,{int:n=>(calls++)%n});
  assert.equal(bg.pixels[31*320+11],30+9);assert.equal(bg.pixels[32*320+11],30+10);assert.equal(bg.pixels[31*320+12],30+(9+159)%30);
});
test('palette rotates fixed indices at original tick delays and Sky remains still',()=>{
  const menu=createMenuBackground(),stars=createBattleBackground(1,{int:()=>0,next:()=>.75}),sky=createBattleBackground(5,{int:()=>0});
  assert.equal(backgroundPhase(menu,3/BIOS_TICK_HZ,3),0);assert.equal(backgroundPhase(menu,6.01/BIOS_TICK_HZ,3),1);
  assert.equal(backgroundPhase(stars,24.01/BIOS_TICK_HZ,3),1);assert.equal(backgroundPhase(stars,12/BIOS_TICK_HZ,3),0);
  assert.deepEqual(backgroundFrame(sky,0),backgroundFrame(sky,100));assert.deepEqual(sky.palette[0],[0,0,255]);assert.deepEqual(sky.palette[19],[77,0,178]);
});
test('menu rings preserve crossing geometry and reference magenta ramp',()=>{
  const a=createMenuBackground(0,100),b=createMenuBackground(0,160);
  assert.equal(hash(a.pixels),'e0f294d650423f4155485d30dfac7b4cb20cda6c44bbf92662ece55eb91b1fa3');
  assert.equal(hash(b.pixels),'6ccf24cca5a167f4b0556d2975b20b09207d45ac9aea92d80be54eb3983ab02b');
  assert.deepEqual(a.palette[0],[121,0,121]);assert.deepEqual(a.palette[29],[239,0,239]);
});

test('round palette direction toggles using exactly one random draw',()=>{
  const a=createBattleBackground(2,{int:()=>0,next:()=>.25},{direction:1});
  assert.equal(a.direction,-1);assert.equal(backgroundPhase(a,6.01/BIOS_TICK_HZ,3),29);
  const b=createBattleBackground(0,{int:()=>0,next:()=>.25},{direction:a.direction});assert.equal(b.direction,1);
});
