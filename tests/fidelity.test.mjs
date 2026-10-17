import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Random,Game} from '../dist/engine.js';
import {SoundSequence,PITVoice,PIT_CLOCK,CPU_WRITE_MS,launchSound,blastSound,sonicSound,laserCharge,deathSweep,controlSound} from '../dist/sound.js';
import {shopItems,visibleShopItems,shopStock,cartCost,reserve} from '../dist/shop.js';
import icons from '../dist/assets/weapon-icons.js';
const catalog=JSON.parse(fs.readFileSync(new URL('../dist/assets/weapons.json',import.meta.url)));
test('original launch pitches and delay order, laser variant',()=>{const a=launchSound(),b=launchSound(true);assert.equal(a.ms,100);assert.equal(b.ms,201);assert.deepEqual(a.events.map(e=>e[0]),[0,3,6,11,16,21,26,31,36,41,50,63,80,100]);assert.deepEqual(a.events.map(e=>e[1]),[111,222,333,444,555,666,777,888,999,1111,1333,1777,2111,null]);});
test('PIT ignores zero and <=18, wraps uint16 and gates only at NoSound',()=>{const v=new PITVoice();v.write(111);assert.equal(v.divisor,Math.floor(PIT_CLOCK/111));const d=v.divisor;v.write(0);v.write(18);assert.equal(v.divisor,d);assert.equal(v.enabled,true);v.write(65536+2500);assert.equal(v.divisor,477);v.write(null);assert.equal(v.sample(),0);assert.equal(v.enabled,false);});
test('PIT samples integrate odd-divisor high/low periods on a single voice',()=>{const v=new PITVoice(PIT_CLOCK);v.write(Math.floor(PIT_CLOCK/19));assert.equal(v.divisor,19);assert.deepEqual(Array.from({length:38},()=>v.sample()),Array.from({length:38},(_,i)=>i%19<10?.12:-.12));});
test('blast consumes original shared RNG count and delays once per outer loop',()=>{for(const r of [2,10,15,30,60]){const rng=new Random(5),expected=new Random(5),n=(r+1)+3*(r+1)*(r+2)/2;for(let i=0;i<n;i++)expected.int(1);const s=blastSound(r,rng);assert.equal(rng.state,expected.state);assert.equal(s.events.length,n+1);assert.ok(Math.abs(s.ms-(3*(r+1)*8+n*CPU_WRITE_MS))<1e-8);}});
test('sonic preserves palette RNG with sound off; exact explicit delays',()=>{const a=new Random(7),b=new Random(7),s=sonicSound(a,false);for(let i=0;i<500;i++)b.advance();assert.equal(a.state,b.state);assert.equal(s.ms,1600);assert.equal(s.events.length,1);assert.ok(Math.abs(laserCharge().ms-(1600+201+100*CPU_WRITE_MS))<1e-8);assert.equal(deathSweep(5).ms,1616);assert.equal(deathSweep(6).ms,3224);assert.equal(controlSound('flip').ms,20);});
test('plain dirt and lead impacts have no fabricated explosion sound',()=>{for(const id of [0,13,14,15,16]){const g=new Game(catalog.weapons,{sound:true,wind:0});g.start([{name:'A'},{name:'B'}]);g.events=[];g.impact({weapon:id,x:160,y:150,owner:0});assert.equal(g.events.filter(e=>e.type==='speaker').length,0);}});
test('shop owned/affordable filtering, reservation budget and nine-lot limit',()=>{const items=shopItems(catalog),p={money:200000,ammo:Array(18).fill(0),guidance:[0,0],defense:[0,0,0]},cart=[];assert.equal(items.length,21);assert.equal(visibleShopItems(p,items).length,21);for(let i=0;i<9;i++)assert.equal(reserve(cart,items,p,0),true);assert.equal(reserve(cart,items,p,0),false);assert.equal(cartCost(cart,items),27000);assert.equal(shopStock(p,items[0]),0);p.money=3000;cart.length=0;assert.deepEqual(visibleShopItems(p,items),[0]);p.guidance[1]=1;assert.deepEqual(visibleShopItems(p,items),[0,17]);reserve(cart,items,p,0);assert.equal(reserve(cart,items,p,0),false);assert.deepEqual(visibleShopItems(p,items),[0,17]);reserve(cart,items,p,0,-1);assert.equal(cartCost(cart,items),0);});
test('all 20 shipped masks equal binary extraction, including H/V and frame',()=>{const raw=JSON.parse(fs.readFileSync(new URL('../research/icons-extracted.json',import.meta.url)));assert.deepEqual(icons,raw.icons.map(i=>i.rows));assert.ok(icons.every(rows=>rows.length===10&&rows.every(row=>row.length===15)));});

import {createHash} from 'node:crypto';
import {renderShopFixture} from '../tools/verify-shop.mjs';
test('shop renderer matches full DOS QA200K reference frame (64000 pixels)',()=>{assert.equal(createHash('sha256').update(renderShopFixture()).digest('hex'),'d863b72ff5ca85ba65bbac314c2c437763845717e117ed603ea29fc473c56dd4');});

import {titleFrame} from '../dist/title.js';
const titleSource=fs.readFileSync(new URL('../dist/assets/title-indexed.bin',import.meta.url));
test('title phase zero matches all 64000 pixels of the DOS capture',()=>{
 assert.equal(createHash('sha256').update(titleFrame(titleSource,0)).digest('hex'),'62a292b756459a5ce105af63d65c077bb7a677817ebd3f72b5ba96dbe5511e6e');
});
test('title palette cycles all twenty phases while keeping scenery and letter borders fixed',()=>{
 const first=titleFrame(titleSource,0),frames=new Set();
 for(let phase=0;phase<20;phase++){
  const frame=titleFrame(titleSource,phase);frames.add(createHash('sha256').update(frame).digest('hex'));
  for(let i=0;i<64000;i++)if(titleSource[i]<135||titleSource[i]>154)assert.deepEqual(frame.subarray(i*4,i*4+4),first.subarray(i*4,i*4+4));
 }
 assert.equal(frames.size,20);assert.deepEqual(titleFrame(titleSource,20),first);
});
