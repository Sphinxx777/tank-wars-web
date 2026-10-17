// OVR death effects, translated in research/death-effects.md.
// Palette-only delays are shortened; their RNG calls are retained.
export function* deathEffect(g,dead,tankPixel,forcedMode){
  const R=n=>g.rng.int(n),U=()=>g.rng.next(),sound=g.options.sound,flash=()=>R(65535);
  const mode=forcedMode??R(7),pixels=new Map(),key=(x,y)=>y*320+x,inside=(x,y)=>x>=11&&x<=309&&y>=31&&y<=189;
  const read=(x,y)=>{if(pixels.has(key(x,y)))return pixels.get(key(x,y));const t=g.players.find(p=>(p.alive||p.id===dead.id)&&tankPixel(p,x,y));return t?20+t.id:g.terrain.solid(x,y)?2:(x===10||x===310||y===30||y===190)?13:0;};
  const put=(x,y,color)=>{if(inside(x,y)){pixels.set(key(x,y),color);g.terrain.set(x,y,color===2?1:0);}};
  const contact=(x,y,min,range)=>{const c=read(x,y);if(c>=20&&c<=29)g.hurt(g.players[c-20],min+R(range),dead.owner,'death');};
  const clearDisk=(x,y,r)=>{for(let yy=Math.max(31,y-r);yy<=Math.min(189,y+r);yy++)for(let xx=Math.max(11,x-r);xx<=Math.min(309,x+r);xx++)if((xx-x)**2+(yy-y)**2<=r*r)put(xx,yy,0);g.terrain.version++;};
  const show=()=>{g.deathVisual={color:dead.color,points:[...pixels].filter(([,c])=>c!==0&&c!==2).map(([k])=>[k%320,Math.floor(k/320)]).slice(-5000)};};
  const fold=p=>{if(p.x>309)p.x=618-p.x;if(p.y>189)p.y=378-p.y;if(p.y<31)p.y=62-p.y;if(p.x<11)p.x=22-p.x;return p;};
  const eraseBody=()=>{for(let y=dead.y-9;y<=dead.y+1;y++)for(let x=dead.x-9;x<=dead.x+9;x++)if(tankPixel(dead,x,y))put(x,y,0);g.terrain.version++;};
  if(mode===6){const q=R(10),max=q<2?1:q<5?2:q<8?3:4;for(let i=1;i<=max;i++){g.explode(dead.x,dead.y,g.weapons[i].radius,dead.owner,'death');yield;}eraseBody();return;}
  if(mode===5){for(let i=0;i<20;i++){g.deathVisual={tank:dead,alpha:i<10?i/10:(20-i)/10};yield;}eraseBody();g.deathVisual=null;return;}
  if(mode===4){const waves=30+R(30);for(let wave=1;wave<=waves;wave++){const count=R(400);for(let k=0;k<count;k++){const h=R(10*wave),dx=Math.trunc(R(h+10)-h/2-5),p={x:dead.x+dx,y:dead.y-h};while(!inside(p.x,p.y))fold(p);put(p.x,p.y,2);if(sound)R(1000);}g.terrain.version++;yield;}}
  if(mode===1||mode===3){const bursts=5+R(5);for(let b=0;b<bursts;b++){const count=2+R(390),direction=1+R(8),layers=[];
    for(let layer=1;layer<=5;layer++){const points=[];for(let k=0;k<count;k++){const h=R(10*layer),q=Math.trunc(R(h+10)-h/2-5);const [dx,dy]=[[q,-h],[q,h],[h,-q],[-h,-q],[q+h,-h],[q-h,-h],[q+h,h],[q-h,h]][direction-1];points.push(fold({x:dead.x+dx,y:dead.y+dy}));}layers.push(points);}
    for(let layer=0;layer<5;layer++){for(let k=0;k<count;k++){if(sound)R(500*(layer+1));const p=layers[layer][k];contact(p.x,p.y,1,3);
      if(mode===1){put(p.x,p.y,1+R(14));if(layer>0){const old=layers[layer-1][k];put(old.x,old.y,0);}}
      else{const color=201+R(14);put(p.x,p.y,color===202?2:color);}
    }g.terrain.version++;show();yield;}
    if(mode===1)for(const p of layers[4])put(p.x,p.y,0);
  }}
  if(mode===0||mode===2){
    for(let i=0;i<104;i++){if(sound)R(500);flash();}
    const make=()=>{if(sound)R(500);return {x:dead.x-11,y:dead.y-31,vx:.5-U(),vy:.1-U(),stopped:false};};
    const step=p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=.006999999999997897;p.vx+=g.wind/5000;const x=Math.trunc(p.x),y=Math.trunc(p.y),c=read(x+11,y+31);if(c===2||c===13)p.stopped=true;contact(x+11,y+31,mode===0?5:10,10);if(x>(mode===0?320:298)||x<0||y>(mode===0?200:158)||y<0)p.stopped=true;if(mode===0)flash();put(x+11,y+31,20+dead.id);};
    function* landing(p){R(3);const q=R(10),scale=q<3?1:q<6?2:q<8?3:q===8?4:5,r=4*scale,x=Math.trunc(p.x)+11,y=Math.trunc(p.y)+31;
      for(let pass=0;pass<2;pass++)for(let i=0;i<=r;i++){if(sound)R(2500);flash();}
      clearDisk(x,y,r);clearDisk(x+1,y,r);g.deathVisual={discs:[[x,y,r]],color:'#ffaa00'};yield;
    }
    if(mode===0){for(let i=0;i<11;i++){const p=make();let steps=0;do{step(p);if(++steps%8===0){show();yield;}}while(!p.stopped);yield* landing(p);}}
    else{const particles=Array.from({length:11},make);let active;do{active=false;flash();for(const p of particles)if(!p.stopped){active=true;step(p);}show();yield;}while(active);for(const p of particles)yield* landing(p);}
    for(let pair=0;pair<15;pair++)for(let i=0;i<10;i++){if(sound)R(1300-40*(2*pair+1));flash();}
    for(let i=0;i<15;i++){if(sound)R(200);R(63);R(63);R(63);}
    clearDisk(dead.x,dead.y,30);clearDisk(dead.x+1,dead.y,30);
  }
  for(const [k,c] of pixels)if(c!==2)g.terrain.set(k%320,Math.floor(k/320),0);
  eraseBody();g.deathVisual=null;
}
