import {SoundSequence,CPU_WRITE_MS,launchSound,controlSound,blastSound,sonicSound,laserCharge,criDirectSound,lightningSound} from './sound.js';
import {deathEffect} from './death.js';
import {sinDeg,cosDeg} from './trig.js';
// Tank Wars 3.2 native simulation. Binary-derived values are documented in research/.
export const W = 320, H = 200, TOP = 31, LEFT = 11, RIGHT = 309, BOTTOM = 189;
export const AI_NAMES = ['Mr. Stupid','Lobber','Rifleman','Windless Wit','Lob & Shoot','Twanger','Wind Master'];
export const WALLS = ['Non Existent','Sticky','Elastic','Accelerating','Warping','Random'];
export const COLORS = ['#ff0000','#00ff00','#5555ff','#ffff00','#ff00ff','#00ffff','#ffffff','#ffaa00','#aa55ff','#aaaaaa'];
export const DEFAULTS = {players:2,rounds:10,crumble:50,walls:5,wind:2,background:9,tanksFall:true,computerBuy:true,trail:true,visible:true,sound:true,flySound:false,teams:false,paletteSpeed:3,mirvSpread:0,mirvDetonation:0};
// BOMB.CFG fall delay: 5 ms per pixel (OVR 0x1ac9e).
export const FALL_STEP_SECONDS = .005;
export const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
export class Random {
  constructor(seed=Date.now()){this.state=seed>>>0;}
  advance(){this.state=(Math.imul(this.state,0x08088405)+1)>>>0;return this.state;}
  next(){return this.advance()/4294967296;}
  int(n){const high=this.advance()>>>16;return n?high%n:0;}
}
// OVR 0x1114e..0x11216 and 0x11328..0x1141a: original Euler integrator.
export function launch(x,y,power,angle){const a=angle*Math.PI/180;return {x,y,vx:power/50*Math.cos(a),vy:-power/50*Math.sin(a),age:0};}
export function integrate(p,wind,dt=0.1){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=0.1*dt;p.vx+=wind/5000*dt;p.age+=dt;return p;}
export function wallBounce(p,wall){
  if(wall===4){if(Math.trunc(p.x)<=10)p.x+=300;else if(Math.trunc(p.x)>=310)p.x-=300;return;}
  if(wall<1||wall>3)return;
  const k=wall===1?0.7071059999998397:wall===3?1.4142100000008213:1;
  if(Math.trunc(p.x)<=10&&p.vx<0){p.vx=-p.vx*k;p.vy*=k;}
  if(Math.trunc(p.x)>=310&&p.vx>0){p.vx=-p.vx*k;p.vy*=k;}
  if(Math.trunc(p.y)<=30&&p.vy<0){p.vy=-p.vy*k;p.vx*=k;}
  if(Math.trunc(p.y)>=188&&p.vy>0){p.vy=-p.vy*k;p.vx*=k;if(Math.abs(p.vy)<.1)p.stopped=true;}
}
export function blastDamage(d,r){let n=0;if(d<=1.5*r)n+=Math.trunc(1.8*r-d);if(d<r)n+=10+2*Math.trunc(1.8*r-d);if(d<0.7*r)n+=150;return Math.max(0,n);}
const BODY=['000111000','011111110','011111110','111010111','111111111'];
export function tankPixel(p,x,y){
  const dx=x-p.x+4,dy=y-p.y+4;if(dy>=0&&dy<5&&dx>=0&&dx<9&&BODY[dy][dx]==='1')return true;
  const a=p.angle*Math.PI/180,x1=p.x+Math.trunc(8*Math.cos(a)),y1=p.y-Math.trunc(8*Math.sin(a));
  let xx=p.x,yy=p.y,ex=Math.abs(x1-xx),sx=xx<x1?1:-1,ey=-Math.abs(y1-yy),sy=yy<y1?1:-1,err=ex+ey;
  for(let i=0;i<12;i++){if(xx===x&&yy===y)return true;if(xx===x1&&yy===y1)break;const e=2*err;if(e>=ey){err+=ey;xx+=sx;}if(e<=ex){err+=ex;yy+=sy;}}
  return false;
}
export class Terrain {
  constructor(){this.data=new Uint8Array(W*H);this.version=0;}
  solid(x,y){x=Math.trunc(x);y=Math.trunc(y);return x>=LEFT&&x<=RIGHT&&y>=TOP&&y<=BOTTOM&&this.data[y*W+x]!==0;}
  set(x,y,v){if(x>=LEFT&&x<=RIGHT&&y>=TOP&&y<=BOTTOM)this.data[y*W+x]=v;}
  generate(rng,players=2){
    this.data.fill(0);let x=11,h=rng.int(150),slope=0,direction=1-2*rng.int(2);const margin=60-7*(players-2);
    const column=height=>{if(x>309)return;for(let y=Math.max(TOP,190-height);y<=189;y++)this.set(x,y,1);x++;};
    while(x<310){
      if(x<11+margin||x>309-margin){column(h);continue;}
      const sign=Math.sign(slope),abs=Math.abs(slope);
      if(abs===0){column(h);column(h);column(h);}
      else if(abs===1){column(h);column(h);column(h+sign);h+=sign;}
      else if(abs===2){column(h);column(h+sign);column(h+2*sign);h+=2*sign;}
      else if(abs===3){column(h);column(h+sign);h+=2*sign;}
      else {column(h);h+=2*sign;}
      if(rng.next()<.2)slope+=direction;
      if(rng.next()<.1||Math.abs(slope)>4)direction=-direction;
      slope=clamp(slope,-4,4);if(h<=20)direction=1;if(h>=140)direction=-1;if(h<=3)slope=1;if(h>=155)slope=-1;
    }
    this.version++;
  }
  surface(x,start=TOP){for(let y=Math.max(TOP,Math.round(start));y<=BOTTOM;y++)if(this.solid(x,y))return y;return BOTTOM+1;}
  circle(cx,cy,r,value=0){for(let y=Math.max(TOP,Math.ceil(cy-r));y<=Math.min(BOTTOM,Math.floor(cy+r));y++){const dx=Math.floor(Math.sqrt(Math.max(0,r*r-(y-cy)**2)));for(let x=Math.max(LEFT,Math.ceil(cx-dx));x<=Math.min(RIGHT,Math.floor(cx+dx));x++)this.set(x,y,value);}this.version++;}
  crumble(tanks=[]){let changed=false;for(let x=LEFT;x<=RIGHT;x++){let floor=BOTTOM;for(let y=BOTTOM;y>=TOP;y--){if(tanks.some(p=>p.alive&&tankPixel(p,x,y))){floor=y-1;continue;}if(this.data[y*W+x]){if(y!==floor){this.data[floor*W+x]=1;this.data[y*W+x]=0;changed=true;}floor--;}}}if(changed)this.version++;return changed;}
}
export class Game {
  constructor(weapons,options={},seed=Date.now()){
    this.weapons=weapons;this.options={...DEFAULTS,...options};this.rng=new Random(seed);this.terrain=new Terrain();this.players=[];this.round=0;this.phase='menu';this.events=[];this.shots=[];this.explosions=[];this.trails=[];this.turns=0;this.active=0;this.deathQueue=[];
  }
  emit(type,data={}){this.events.push({type,...data});}
  audio(sequence,block=false){if(!this.options.sound)return;this.emit('speaker',{sequence});this.audioWait=(this.audioWait||0)+sequence.ms/1000;if(block)this.blockSimulation=(this.blockSimulation||0)+sequence.ms/1000;}
  start(roster){
    this.players=roster.map((p,i)=>({id:i,name:p.name||`Player ${i+1}`,ai:p.ai??-1,team:this.options.teams?(p.team??i%2):i,color:COLORS[i],men:100,power:300,angle:45,weapon:1,ammo:Array(18).fill(0),guidance:[0,0],defense:[0,0,0],score:0,money:0,wins:0,kills:0,shots:0,hits:0,alive:true,x:0,y:0,lob:[],...p}));
    for(const p of this.players){p.ammo[0]=100;p.ammo[1]=3*this.options.rounds;p.ammo[11]=Math.min(10*this.options.rounds,999);}
    this.round=0;this.nextRound();
  }
  nextRound(){
    this.round++;this.turns=0;this.falling=null;this.terrainResolved=false;this.audioWait=0;this.blockSimulation=0;this.pendingLaser=null;this.deathQueue=[];this.deathAnimation=null;this.deathVisual=null;this.shots=[];this.explosions=[];this.trails=[];this.terrain.generate(this.rng,this.players.length);
    this.wall=this.options.walls===5?this.rng.int(5):this.options.walls;
    const level=this.options.wind===5?this.rng.int(5):this.options.wind;
    const range=[0,20,100,300,4000][level];
    do{this.wind=range/2-this.rng.int(range);}while(Math.abs(this.wind)<range/10);
    for(const chance of [.1,.1,.05,.05])if(this.rng.next()<chance)this.wind=(this.wind*4<<16)>>16;
    this.wind=clamp(this.wind,-30000,30000);
    this.background=this.options.background===9?this.rng.int(9):this.options.background;this.groundColor=this.rng.int(5);
    this.stars=[];this.palette=[];
    if(this.background===1){for(let i=0;i<20;i++){const v=5*(i%10);this.palette.push([v,v,i<10?v:0].map(n=>Math.round(n*255/63)));}const n=250+this.rng.int(500);for(let i=0;i<n;i++)this.stars.push([11+this.rng.int(299),31+this.rng.int(159),this.rng.int(20)]);}
    else{const anchors=Array.from({length:3},()=>Array.from({length:3},()=>this.rng.int(64)));for(let j=0;j<3;j++)for(let k=0;k<10;k++)this.palette.push(anchors[j].map((n,c)=>Math.round(Math.trunc(n+k*(anchors[(j+1)%3][c]-n)/10)*255/63)));}
    const order=[...this.players].sort(()=>0);for(let i=order.length-1;i>0;i--){const j=this.rng.int(i+1);[order[i],order[j]]=[order[j],order[i]];}
    const first=16+this.rng.int(28),last=305-this.rng.int(28);
    order.forEach((p,i)=>{p.x=first+i*Math.trunc((last-first)/(order.length-1));p.y=this.terrain.surface(p.x)-1;p.men=100;p.alive=true;p.angle=p.x<160?75:105;p.power=200;p.lob=[];p.target=null;p.armed=0;if(p.ammo[p.weapon]===0)p.weapon=1;if(p.ammo[1]===0)p.weapon=11;
      // Small launch pad prevents a tank straddling a steep hillside.
      for(let x=p.x-3;x<=p.x+3;x++)for(let y=p.y+1;y<=BOTTOM;y++)this.terrain.set(x,y,1);
    });
    this.terrain.version++;this.order=order.map(p=>p.id);this.active=this.order[this.rng.int(this.order.length)];this.phase='aim';this.aiTimer=0.8;this.emit('round');
    const queue=order.map(p=>({player:p.id,target:p.y,damage:0}));for(const p of order)p.y=Math.min(32,p.y);
    if(queue.some(f=>this.players[f.player].y<f.target)){this.falling={queue,elapsed:0,intro:true};this.phase='flight';}
  }
  get current(){return this.players[this.active];}
  get alive(){return this.players.filter(p=>p.alive);}
  enemies(p){return this.players.filter(t=>t.alive&&t.id!==p.id&&(!this.options.teams||t.team!==p.team));}
  setPower(v){if(this.phase!=='aim')return;this.audio(controlSound(v<this.current.power?'powerDown':'powerUp'));this.current.power=Math.round(clamp(v,0,this.current.men*100));}
  setAngle(v,flip=false){if(this.phase!=='aim')return;const delta=(v-this.current.angle)*(this.current.angle>90?-1:1);this.audio(controlSound(flip?'flip':delta>0?'angleUp':'angleDown'));this.current.angle=(Math.round(v)+181)%181;}
  cycleWeapon(dir=1){if(this.phase!=='aim')return;const p=this.current;for(let i=0;i<18;i++){p.weapon=(p.weapon+dir+18)%18;if(p.ammo[p.weapon]!==0)break;}}
  armGuidance(index){const p=this.current;if(this.phase!=='aim'||p.guidance[index]<=0)return false;p.armed^=1<<index;p.target=this.enemies(p)[0]?.id??null;return true;}
  fire(){
    if(this.phase!=='aim')return false;const p=this.current,id=p.weapon;
    if(p.ammo[id]===0)return false;
    if(id===5&&p.ammo[id]<100)return false;
    const a=p.angle*Math.PI/180;const shot={...launch(p.x+Math.cos(a)*10,p.y-Math.sin(a)*10,p.power,p.angle),weapon:id,owner:p.id,power:p.power,threshold:3*p.men+643,trail:[],target:p.target,guidance:p.armed};
    if(id===7)shot.guidance=0;
    else for(let i=0;i<2;i++)if(p.armed&(1<<i))p.guidance[i]--;
    p.armed=0;
    p.shots++;this.turns++;this.terrainResolved=false;this.trails=[];this.phase='flight';this.shots=[];this.explosions=[];this.mirvEndpoints=[];this.turnHit=false;
    if(this.rng.next()<.2)this.hurt(p,1,p.id);
    this.audio(id===5?laserCharge():launchSound(),true);
    if(id===5){const energy=Math.min(Math.max(100,p.power),p.ammo[id]);p.ammo[id]-=energy;this.pendingLaser={shot,energy};}else{if(p.ammo[id]>0)p.ammo[id]--;this.shots.push(shot);}
    this.emit('fire',{weapon:id});return true;
  }
  hurt(p,damage,owner,kind='blast'){
    if(!p.alive||damage<=0)return;
    if((kind==='blast'||kind==='death')&&p.defense[0]>0){const absorbed=Math.min(damage,p.defense[0]);p.defense[0]-=absorbed;damage-=absorbed;}
    if(kind==='fall'&&p.defense[1]>0){const absorbed=Math.min(damage,p.defense[1]);p.defense[1]-=absorbed;damage-=absorbed;}
    if(kind!=='fall'&&damage>0&&p.defense[2]>0&&this.rng.next()<Math.min(1,damage/40))p.defense[2]--;
    const dealt=Math.min(p.men,Math.trunc(damage));p.men=Math.max(0,p.men-dealt);p.power=Math.min(p.power,p.men*100);
    const source=this.players[owner],enemy=source&&source.team!==p.team;
    if(enemy&&dealt&&kind!=='fall'&&kind!=='laser'&&kind!=='death'){source.score+=dealt*10;source.money+=dealt*10;if(!this.turnHit){source.hits++;this.turnHit=true;}}
    if(p.men===0){p.alive=false;if(source){const bonus=enemy?1500:-1000;source.score+=bonus;source.money+=bonus;if(enemy)source.kills++;}this.deathQueue.push({...p,owner});this.emit('kill',{player:p.id});}
  }
  explode(x,y,r,owner,kind='blast',mirv=false){let sequence;if(kind==='sonic')sequence=sonicSound(this.rng,this.options.sound);else if(kind!=='dirt'&&this.options.sound)sequence=blastSound(r,this.rng,mirv?1:8);if(sequence)this.audio(sequence);this.explosions.push({x,y,r:0,max:r,owner,kind,age:0,duration:Math.max(.15,sequence?.ms/1000||r/55),applied:false});this.emit('explosion',{radius:r,kind});}
  impact(s){
    const {weapon:id,x,y,owner}=s;const direct=this.players.find(p=>p.alive&&(p.id===s.hitTank||tankPixel(p,Math.trunc(x),Math.trunc(y))));
    if(id===0){if(direct)this.hurt(direct,5,owner);return;}
    if(id>=13&&id<=16){this.explode(x,y,this.weapons[id].radius,owner,'dirt');return;}
    if(id===17){const tones=new SoundSequence(),n=300+this.rng.int(100),layers=3+this.rng.int(8),points=[];
      for(let j=1;j<=layers;j++)for(let i=0;i<n;i++){const h=this.rng.int(20*j),dx=Math.trunc(this.rng.int(h+1)-h/2);points.push([Math.trunc(x)+dx,Math.trunc(y)+2-h,j]);}
      for(const [xx,yy,j] of points){this.terrain.set(xx,yy,1);if(this.options.sound)tones.tone(100*j+this.rng.int(200),CPU_WRITE_MS);}this.audio(tones.stop());this.terrain.version++;this.forceCrumble=this.rng.next()*100<2*this.options.crumble;return;}

    if(id===18){this.terrain.circle(x,y,2,1);return;}
    if(id===12){this.forceCrumble=true;this.explode(x,y,30,owner,'sonic');return;}
    if([6,8,9,10].includes(id)){
      if(direct){this.hurt(direct,1+this.rng.int(id*6),owner);this.audio(criDirectSound());return;}
      const count={6:4,8:8,9:20,10:20}[id],sx=Math.trunc(x);let sy=Math.trunc(y);
      while(sy<BOTTOM&&![[0,-1],[1,0],[0,1],[-1,0]].some(([dx,dy])=>this.terrain.solid(sx+dx,sy+dy)))sy++;
      this.reaction={heads:Array.from({length:count},()=>({x:sx,y:sy})),owner,diagonals:id!==9};return;
    }
    this.explode(x,y,this.weapons[id]?.radius??10,owner,'blast',s.mirvChild);
    if(direct)this.hurt(direct,200,owner);
  }
  laser(s,energy){
    const tank=this.players[s.owner],a=tank.angle*Math.PI/180,p={x:tank.x+Math.cos(a)*7,y:tank.y-Math.sin(a)*7,vx:Math.cos(a),vy:-Math.sin(a)};const path=[],tones=new SoundSequence();let remaining=10*energy;
    for(let i=0;i<20000&&remaining>0;i++){p.x+=p.vx;p.y+=p.vy;const speed=Math.hypot(p.vx,p.vy);wallBounce(p,this.wall);const newspeed=Math.hypot(p.vx,p.vy);p.vx*=speed/newspeed;p.vy*=speed/newspeed;path.push([p.x,p.y]);remaining-=10;
      if(p.x<LEFT||p.x>RIGHT||p.y<TOP||p.y>BOTTOM)break;
      const hit=this.players.find(t=>t.alive&&Math.hypot(t.x-p.x,t.y-p.y)<3);
      if(hit){remaining-=10;this.hurt(hit,3,s.owner,'laser');p.x-=p.vx;p.y-=p.vy;}
      if(this.terrain.solid(p.x,p.y)){for(let j=0;j<15;j++){const x=Math.trunc(p.x-this.rng.int(20)*p.vx),y=Math.trunc(p.y-this.rng.int(20)*p.vy);if(!this.players.some(t=>t.alive&&Math.abs(t.x-x)<=4&&Math.abs(t.y-y)<=2))this.terrain.set(x,y,0);if(this.options.sound)tones.tone(500+this.rng.int((500*(j+1))&65535),CPU_WRITE_MS);}this.terrain.version++;}tones.wait(5);if(this.options.sound)tones.tone(100+this.rng.int((12*remaining)&65535));
    }
    this.audio(tones.stop(),true);this.trails.push({path,color:'#ff5555',laser:true});this.delay=0.4;
  }
  stepShot(s,dt,preview=false){
    s.substep=((s.substep??0)+1)%10;integrate(s,this.wind,dt);wallBounce(s,this.wall);
    if(Math.abs(s.vx)>500||Math.abs(s.vy)>500||s.age>1800)return 'gone';
    if(this.wall===0||this.wall===4){if(s.y>=190)return 'hit';if(s.x<-1500||s.x>1800||s.y<-5000)return 'gone';if(this.wall===0&&((s.x<LEFT&&s.vx<=0&&this.wind<=0)||(s.x>RIGHT&&s.vx>=0&&this.wind>=0)))return 'gone';}
    if(!preview&&s.guidance>0){const t=this.players[s.target];if(t?.alive){const dx=t.x-Math.trunc(s.x),dy=t.y-Math.trunc(s.y);if((s.guidance&2)&&Math.abs(dx)<=2){s.vx=0;s.y+=dy>0?.5:-.5;}if((s.guidance&1)&&dy>0&&dy<=4){s.vy=0;s.vx=s.vx===0?.1:s.vx*(dx*s.vx<0?-1.01:1.01);}}}
    if(s.weapon===7&&s.vy>0&&!preview)return 'split';
    if(!preview)for(const t of this.players){const dx=t.x-Math.trunc(s.x),dy=Math.trunc(s.y)-t.y,d2=dx*dx+dy*dy;if(t.id===s.owner&&!s.leftOrigin){if(Math.abs(dx)>40||Math.abs(dy)>40)s.leftOrigin=true;else continue;}if(t.alive&&t.defense[2]>0&&d2>0&&d2<=1600){const a=Math.trunc(Math.atan2(dy,dx)*180/Math.PI)*Math.PI/180,f=-600/d2*dt;s.vx+=Math.cos(a)*f;s.vy-=Math.sin(a)*f;}}
    const x=Math.trunc(s.x),y=Math.trunc(s.y);let collision=false;
    if(x>11&&x<309&&y>33&&y<187){
      for(const [dx,dy] of [[-1,0],[0,-1],[0,0],[0,1],[1,0]]){
        const tank=this.players.find(p=>p.alive&&tankPixel(p,x+dx,y+dy));
        if(tank){if(s.weapon>=12&&s.weapon<=16){collision=false;s.guidance=0;s.vy*=-1.2;}else {s.hitTank=tank.id;collision=true;}}
        else if(this.terrain.solid(x+dx,y+dy)){const shooter=this.players[s.owner],threshold=s.threshold??3*(shooter?.men??100)+643,power=s.power??shooter?.power??0;collision=power!==threshold&&(power<threshold||s.substep===0);}
      }
    }
    if(collision||s.stopped)return 'hit';
    return null;
  }
  update(dt){
    if(this.falling){this.updateFalling(dt);return;}
    this.audioWait=Math.max(0,(this.audioWait||0)-dt);if(this.blockSimulation>0){this.blockSimulation=Math.max(0,this.blockSimulation-dt);return;}
    if(this.pendingLaser){const {shot,energy}=this.pendingLaser;this.pendingLaser=null;this.laser(shot,energy);return;}
    if(this.phase==='aim'&&this.current?.ai>=0){this.aiTimer-=dt;if(this.aiTimer<=0){this.aimAI(this.current);this.fire();}return;}
    if(this.phase!=='flight')return;
    const iterations=Math.min(60,Math.max(1,Math.round(dt*600)));
    for(let k=0;k<iterations;k++){
      const active=this.shots;this.shots=[];
      for(const s of active){const event=this.stepShot(s,0.1);if(this.options.trail&&k%3===0)s.trail.push([s.x,s.y]);
        if(event==='split'){
          const mode=this.options.mirvSpread;
          for(let j=0;j<5;j++){let dx=0,dy=0;
            if(mode===0){dx=this.rng.next()*6-3;dy=this.rng.next()*6-3;}
            else if(mode===1)dx=(j-2)*1.75;else if(mode===2)dy=(j-2)*1.75;
            else if(mode===3)[dx,dy]=[[1.75,0],[-1.75,0],[0,-1.75],[0,1.75],[0,0]][j];
            else [dx,dy]=[[1.75,1.75],[-1.75,-1.75],[1.75,-1.75],[-1.75,1.75],[0,0]][j];
            this.shots.push({...s,vx:s.vx+dx,vy:s.vy+dy,weapon:2,mirvChild:true,guidance:0,trail:[]});
          }this.trails.push({path:s.trail,color:'#888'});
        }
        else if(event){if(!s.mirvChild)this.players[s.owner].lob.push({x:s.x,y:s.y,power:s.power,angle:this.players[s.owner].angle});this.trails.push({path:s.trail,color:COLORS[s.owner]});if(this.options.flySound)this.audio(new SoundSequence().stop());if(s.y<-5000){const tones=new SoundSequence();for(const [f,ms] of [[1525,15],[4674,5],[222,10],[121,14]])tones.tone(f,ms);this.audio(tones.stop());}if(event==='hit'){if(s.mirvChild&&this.options.mirvDetonation===1)this.mirvEndpoints.push(s);else if(!s.mirvChild||this.options.mirvDetonation!==2)this.impact(s);}}
        else this.shots.push(s);
      }
    }
    if(!this.shots.length&&this.mirvEndpoints?.length){for(const s of this.mirvEndpoints)this.impact(s);this.mirvEndpoints=[];}
    if(this.shots.length&&this.options.flySound){const tones=new SoundSequence();tones.tone(600-2*Math.trunc(this.shots.at(-1).y));this.audio(tones);}
    if(this.reaction){const tones=new SoundSequence(),r=this.reaction,dirs=r.diagonals?[[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]]:[[0,-1],[1,0],[0,1],[-1,0]];
      for(let step=0;step<50&&this.reaction;step++){
        for(const h of r.heads){if(!h.x)continue;const choices=dirs.filter(([dx,dy])=>this.terrain.solid(h.x+dx,h.y+dy)&&!this.players.some(p=>p.alive&&Math.abs(p.x-h.x-dx)<=4&&Math.abs(p.y-h.y-dy)<=2));if(choices.length){const [dx,dy]=choices[this.rng.int(choices.length)];h.x+=dx;h.y+=dy;if(this.options.sound)tones.tone(1+this.rng.int(500),CPU_WRITE_MS);this.terrain.set(h.x,h.y,0);}else h.x=0;}
        const live=r.heads.find(h=>h.x!==0);if(!live){this.reaction=null;break;}for(const h of r.heads)if(!h.x){h.x=live.x;h.y=live.y;}
      }this.terrain.version++;if(!this.reaction)tones.stop();this.audio(tones);
    }
    const effects=this.explosions;this.explosions=[];
    for(const e of effects){e.age+=dt;e.r=Math.min(e.max,e.r+dt*e.max/Math.max(.04,e.duration*.15));
      if(!e.applied&&e.r>=e.max){e.applied=true;if(e.kind==='dirt'){for(const dx of [-1,0,1])this.terrain.circle(e.x+dx,e.y,e.max,1);}
        else if(e.kind!=='sonic'){this.terrain.circle(e.x,e.y,e.max,0);for(const p of this.players){const d=Math.hypot(p.x-e.x,p.y-e.y);if(p.alive)this.hurt(p,blastDamage(d,e.max),e.owner,e.kind==='death'?'death':'blast');}}}
      if(e.age<e.duration+.08)this.explosions.push(e);
    }
    if(this.delay>0){this.delay-=dt;return;}
    if(!this.shots.length&&!this.explosions.length&&!this.reaction){if(this.audioWait>0)return;if(this.deathAnimation||this.deathQueue.length){this.terrainResolved=false;this.deathAnimation??=deathEffect(this,this.deathQueue.shift(),tankPixel);if(this.deathAnimation.next().done){this.deathAnimation=null;this.deathVisual=null;}return;}if(!this.terrainResolved){this.resolveTerrain();this.terrainResolved=true;}if(!this.falling&&!this.explosions.length&&!this.deathQueue.length)this.finishTurn();}
  }
  resolveTerrain(){
    if(this.forceCrumble||this.rng.next()*100<this.options.crumble)this.terrain.crumble(this.players);this.forceCrumble=false;
    const queue=[];
    if(this.options.tanksFall)for(const p of this.players){if(!p.alive)continue;const ground=Math.min(...[-2,-1,0,1,2].map(dx=>this.terrain.surface(p.x+dx,p.y+1))),target=Math.min(BOTTOM,ground-1);if(target>p.y)queue.push({player:p.id,target,damage:0});}
    if(queue.length)this.falling={queue,elapsed:0,intro:false};
  }
  updateFalling(dt){
    const fall=this.falling;fall.elapsed+=dt;
    while(fall.queue.length){const item=fall.queue[0],p=this.players[item.player];
      if(!p.alive){fall.queue.shift();continue;}
      if(p.y>=item.target){if(!fall.intro)this.hurt(p,item.damage,this.active,'fall');fall.queue.shift();continue;}
      if(fall.elapsed+1e-12<FALL_STEP_SECONDS)break;
      fall.elapsed-=FALL_STEP_SECONDS;p.y++;
      if(!fall.intro)item.damage+=this.rng.int(3)+1;
    }
    if(!fall.queue.length){this.falling=null;if(fall.intro)this.phase='aim';}
  }
  finishTurn(){
    if(this.alive.length<=1||(this.options.teams&&new Set(this.alive.map(p=>p.team)).size<=1)){
      const winningTeam=this.alive[0]?.team;const winners=this.players.filter(p=>p.team===winningTeam);for(const p of winners){if(p.alive)p.wins++;const bonus=Math.trunc(1000*this.players.length/winners.length);p.score+=bonus;p.money+=bonus;}this.phase='score';this.emit('roundEnd');return;
    }
    // Original has anti-stalemate lightning; threshold remains an approximation.
    if(this.turns>80&&this.turns%4===0){const t=this.alive[this.rng.int(this.alive.length)];this.audio(lightningSound(this.rng,this.options.sound),true);this.hurt(t,25,this.active);if(this.deathQueue.length){this.phase='flight';return;}}
    const start=this.order.indexOf(this.active);for(let i=1;i<=this.order.length;i++){const id=this.order[(start+i)%this.order.length];if(this.players[id].alive){this.active=id;break;}}
    if(this.current.ammo[this.current.weapon]===0)this.cycleAvailable();this.phase='aim';this.aiTimer=0.8;this.emit('turn');
  }
  cycleAvailable(){const p=this.current;p.weapon=p.ammo[1]>0?1:p.ammo[11]>0?11:Math.max(0,p.ammo.findIndex((n,i)=>i===5?n>=100:n>0));}
  trajectory(p,angle,power,wind=this.wind){
    const a=angle*Math.PI/180,s={...launch(p.x+Math.cos(a)*10,p.y-Math.sin(a)*10,power,angle),owner:p.id,weapon:1,power,threshold:3*p.men+643};const actual=this.wind;this.wind=wind;
    for(let i=0;i<15000;i++){if(this.stepShot(s,0.2,true))break;}
    this.wind=actual;return s;
  }
  aimAI(p){
    const enemies=this.enemies(p);if(!enemies.length)return;
    const solid=this.wall>=1&&this.wall<=3,ownIndex=this.order.indexOf(p.id);
    let ai=p.ai,target=enemies[0];
    if(ai===4)ai=solid?2:1;if(ai===5&&!solid)ai=2;
    const strongest=()=>{let id=11;for(let i=1;i<=4;i++)if(p.ammo[i]>0)id=i;return id;};
    const chooseEnemy=()=>{let t;do{t=this.players[this.rng.int(this.players.length)];}while(!enemies.includes(t));return t;};
    const orient=(angle,direction)=>direction>0?angle:180-angle;
    p.weapon=strongest();
    if(ai===0){
      const angle=this.rng.int(90);let direction;
      if(solid){do{direction=this.rng.int(3)-1;}while(!direction);p.power=20+this.rng.int(5000);}
      else{direction=ownIndex+1<=Math.floor(this.players.length/2)?1:-1;p.power=20+this.rng.int(300);}
      p.angle=orient(angle,direction);
    }
    if(ai===2||ai===5){
      // Rifleman temporarily draws scoring rays; later rays see the overwritten dirt.
      const overwritten=new Set();let best=-Infinity;
      for(const id of this.order){const t=this.players[id];let score=ai===5?-1:0;
        if(enemies.includes(t)){
          score=ai===2&&t.y>p.y+3?100:1000;
          const reflectedY=ai===5?56-t.y:t.y,dx=t.x-p.x,dy=reflectedY-p.y,length=Math.hypot(dx,dy);
          for(let k=1;k<=Math.trunc(length);k++){const x=p.x+Math.trunc(k*dx/length);let y=p.y+Math.trunc(k*dy/length);if(ai===5&&y<28)y=56-y;const key=y*W+x;if(this.terrain.solid(x,y)&&!overwritten.has(key))score--;overwritten.add(key);}
        }
        if(score>best){best=score;target=t;}
      }
      const dx=target.x-p.x||1,dy=p.y-target.y+4||1,direction=this.order.indexOf(target.id)<ownIndex?-1:1;
      p.angle=orient(Math.abs(Math.trunc(Math.atan(dy/dx)*180/Math.PI)),direction);p.power=1000;p.weapon=1;
      if(best>990){for(let i=2;i<=4;i++)if(p.ammo[i]>0&&this.weapons[i].radius<Math.hypot(dx,dy))p.weapon=i;}
      else if(p.ammo[5]>100)p.weapon=5;
      if(ai===5){p.angle=orient(Math.trunc(Math.atan(Math.abs((p.y+target.y-56)/dx))*180/Math.PI),Math.sign(dx));p.power=950+this.rng.int(51);}
      else if(target.y-4>p.y){let angle=10+this.rng.int(70);if(!solid){p.power=20+this.rng.int(280);angle=45;}p.angle=orient(angle,direction);p.weapon=1;}
    }
    if(ai===1){
      const history=p.lob,n=history.length+1;
      if(n<3){let step=p.angle<=90?1:-1;if(n===1&&this.rng.next()<=.5)step=-step;for(let i=1;i<this.order.length;i++){const t=this.players[this.order[(ownIndex+step*i+this.order.length)%this.order.length]];if(enemies.includes(t)){target=t;break;}}}
      else target=enemies.reduce((a,b)=>Math.abs(b.x-history.at(-1).x)<Math.abs(a.x-history.at(-1).x)?b:a);
      p.angle=target.x>p.x?75:105;
      if(n===1)p.power=100+this.rng.int(100);else if(n===2)p.power=200+this.rng.int(200);
      else{const a=history.at(-2),b=history.at(-1),error=target.x-a.x;const correction=Math.trunc(error*((b.power-a.power)||1)/((b.x-a.x)||1))%32767;let power=(a.power+correction<<16)>>16;if(power<0)power=-2*power;p.power=power;p.weapon=Math.abs(error)>30?4:Math.abs(error)>15?3:Math.abs(error)>5?2:1;while(p.weapon>0&&!p.ammo[p.weapon])p.weapon=p.weapon===1?11:p.weapon===11?0:p.weapon-1;}
    }
    if(ai===3){
      target=chooseEnemy();const dx=target.x-p.x,dy=target.y-p.y,direction=dx>0?1:-1;
      for(let trial=0;trial<41;trial++){const angle=this.rng.int(90),c=cosDeg(angle),s=sinDeg(angle),t=s/c,X=Math.trunc(dx-8*c*direction),Y=Math.trunc(dy+8*s)-1;
        const vx=Math.sqrt(Math.abs(.05*X*X/(Math.abs(X)*t+Y))),power=Math.trunc(Math.hypot(50*t*vx,50*vx));p.angle=orient(angle,direction);p.power=power;
        if(Number.isFinite(power)&&!(t<Math.abs(Y/X)&&Y<0)&&power<=10*p.men)break;
      }
    }
    if(ai===6){
      target=chooseEnemy();const X0=target.x-p.x,Y0=target.y-p.y;
      for(let trial=0;trial<41;trial++){
        const theta=this.rng.int(180),sin=sinDeg(theta),cos=cosDeg(theta),acc=this.wind/10000,grav=-.05;
        const X=Math.trunc(X0-8*cos),Y=-(Math.trunc(Y0+8*sin)-1),den=acc*sin-grav*cos;
        if(Math.abs(sin)<1e-12||Math.abs(cos)<1e-12||Math.abs(den)<1e-12)continue;
        const t2=(X*sin-Y*cos)/den;if(t2<=0)continue;const power=Math.trunc(50*(X-acc*t2)/(Math.sqrt(t2)*cos));
        if(power>=0&&power<=10*p.men){p.angle=theta;p.power=power;break;}
      }
    }
    p.target=target.id;
    for(let i=0;i<18&&(!p.ammo[p.weapon]||(p.weapon===5&&p.ammo[5]<100));i++)p.weapon=p.weapon<=0?12:p.weapon-1;
    p.power=clamp(Number.isFinite(p.power)?p.power:0,0,10*p.men);if(p.weapon===5)p.power=Math.min(p.power,p.ammo[5]);
    p.angle=clamp(Math.trunc(p.angle),0,180);
  }
  buy(player,index,count=1,kind='weapon',catalog=null){
    const p=this.players[player];const item=kind==='weapon'?this.weapons[index]:catalog?.[index];if(!item||item.price<0||!Number.isInteger(count)||count<=0)return false;
    const total=item.price*count;if(p.money<total)return false;p.money-=total;
    const dest=kind==='weapon'?p.ammo:kind==='guidance'?p.guidance:p.defense;dest[index]+=item.quantity*count;return true;
  }
  computerShop(){if(!this.options.computerBuy)return;for(const p of this.players.filter(p=>p.ai>=0)){for(let n=0;n<6;n++){const id=[1,2,3,4,6,7,8][this.rng.int(7)];this.buy(p.id,id);}}}
  serialize(){return JSON.stringify({version:1,options:this.options,players:this.players,round:this.round,phase:this.phase,active:this.active,order:this.order,wind:this.wind,wall:this.wall,background:this.background,groundColor:this.groundColor,stars:this.stars,palette:this.palette,shopPreparedRound:this.shopPreparedRound,rng:this.rng.state,terrain:Array.from(this.terrain.data),turns:this.turns});}
  static restore(json,weapons){const s=JSON.parse(json);if(s.version!==1||!Array.isArray(s.terrain)||s.terrain.length!==W*H||!Array.isArray(s.players)||s.players.length<2||s.players.length>10||!['aim','score'].includes(s.phase))throw Error('Invalid save');const g=new Game(weapons,s.options,s.rng);for(const k of ['players','round','phase','active','order','wind','wall','background','groundColor','turns','stars','palette','shopPreparedRound'])g[k]=s[k];g.terrain.data=Uint8Array.from(s.terrain);g.terrain.version++;g.aiTimer=1;return g;}
}
