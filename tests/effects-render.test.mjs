import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {bgiEllipse,blastRaster,blastPalette,blastTimeline,blastState,drawSonic} from '../dist/effects-render.js';

const oracle=JSON.parse(readFileSync(new URL('./fixtures/bgi-ellipse-oracle.json',import.meta.url)));
test('ellipse raster matches original EXE execution: 171 circle sizes and six noncircular ellipses',()=>{
  for(const sample of oracle){
    const pixels=new Uint8Array(320*200);
    bgiEllipse(160,100,sample.rx,sample.ry,(x,y)=>{if(x>=0&&x<320&&y>=0&&y<200)pixels[y*320+x]=17;});
    assert.equal(createHash('sha256').update(pixels).digest('hex'),sample.sha256,`${sample.rx} x ${sample.ry}`);
  }
});
test('blast palette follows all original in-place palette writes',()=>{
  for(const radius of [2,10,15,30,60]){
    const unit=Math.trunc(63/radius),reference=Uint8Array.from({length:radius+1},(_,j)=>(radius-j)*unit);
    assert.deepEqual(blastPalette(radius),reference);
    for(let phase=0;phase<3;phase++)for(let i=0;i<=radius;i++){
      if(phase===0)for(let j=i;j<=radius;j++)reference[j]=(radius-j+i)*unit;
      if(phase===1)for(let j=i;j>=0;j--)reference[j]=(radius-i+j)*unit;
      if(phase===2)for(let j=i;j<=radius;j++)reference[j]=(j-i)*unit;
      assert.deepEqual(blastPalette(radius,phase,i),reference);
    }
  }
});
test('normal blast palette timing remains three complete passes with sound disabled',()=>{
  for(const radius of [2,10,15,30,60]){
    const t=blastTimeline(radius);
    assert.equal(t.duration,3*(radius+1)*8/1000);
    assert.equal(t.frames.length,3*(radius+1));
    assert.equal(blastState({max:radius,age:t.duration-0.00001}).done,false);
    assert.equal(blastState({max:radius,age:t.duration}).done,true);
  }
});
test('blast disk uses all three shifted original centers',()=>{
  const {indices,width,height}=blastRaster(10);
  assert.equal(width,23);assert.equal(height,21);
  assert.equal(indices[10*width],10);assert.equal(indices[10*width+22],10);
  assert.equal(indices[10*width+11],1); // r=1 at x±1 overwrites the center's original r=0 index.
});
test('Sonic paints only its original five-pixel red cross',()=>{
  const points=[];drawSonic({rect:(...args)=>points.push(args)},{x:100,y:90,age:0,visualFrames:[{red:63,ground:null}]});
  assert.deepEqual(points,[[100,90,1,1,'rgb(255,0,0)'],[101,90,1,1,'rgb(255,0,0)'],[99,90,1,1,'rgb(255,0,0)'],[100,91,1,1,'rgb(255,0,0)'],[100,89,1,1,'rgb(255,0,0)']]);
});
