// Original menu drawing calls: BOMB.OVR 0x0ca5, 0x0ef1, 0x2466,
// 0x0fcf, 0x17b4, 0x54f6–0x5a9e and 0xe592–0xec60.
import {COLORS} from './engine.js';
import {SCREEN_COLOR} from './palette.js';
const GRAY='#aaa',WHITE='#fff',SHADOW='#555';
// SetUserCharSize has independent horizontal and vertical rational scales.
function text(r,str,x,y,color,font='litt',sx=1,sy=sx,h='left',v='top'){
  const f=r.fonts[font],width=Math.trunc(r.textWidth(str,font,sx)),height=Math.trunc((f.ascender-f.descender)*sy);
  if(h==='center')x-=Math.floor(width/2)-1;else if(h==='right')x-=width;
  const baseline=y+(v==='top'?height:v==='center'?Math.floor(height/2):0);
  for(const c of String(str)){const g=f.glyphs[c]||f.glyphs[c.toUpperCase()];if(!g){x+=Math.trunc(4*sx);continue;}let px=0,py=0;
    for(const [cmd,gx,gy] of g.commands){const nx=x+Math.trunc(gx*sx),ny=baseline-Math.trunc(gy*sy);if(cmd==='line')r.bgiLine(nx,ny,px,py,color);px=nx;py=ny;}x+=Math.trunc(g.width*sx);}
}
function cross(r,x,y,color=WHITE){r.rect(x-1,y,3,1,color);r.rect(x,y-1,1,3,color);}
export function menuHeading(){this.bevel(10,6,310,42);for(let n=3;n>0;n--)text(this,'TANK WARS  3.2',160+n,20+n,'#ffff55','euro',.6,.6,'center','center');text(this,'TANK WARS  3.2',160,20,'#ff5555','euro',.6,.6,'center','center');}
function insetBackground(r,x,y,w,h,speed){r.ctx.save();r.ctx.beginPath();r.ctx.rect(x,y,w,h);r.ctx.clip();r.menuBackground(speed);r.ctx.restore();}
export function menuLayout(app){
  this.menuBackground(app.options.paletteSpeed);menuHeading.call(this);
  this.bevel(118,63,202,77);this.text('Main Menu',161,66,'#0000aa','bios',1,'center');this.bevel(118,85,202,187);
  const labels=['Sound Options','Game Options','Players: ','Games: ','START'],actions=['sound','options','playersCount','roundsCount','roster'];
  for(let i=0;i<5;i++){const y=91+i*20;this.bevel(122,y,198,y+10,GRAY,SHADOW,WHITE);insetBackground(this,122,y,77,11,app.options.paletteSpeed);
    text(this,labels[i],160,y+4,i===4?'#ff55ff':'#55ff55','litt',1,1,'center','center');
    if(i===2||i===3)text(this,i===2?app.options.players:app.options.rounds,160+Math.floor(this.textWidth(labels[i])/2),y+4,'#ffff55','litt',1,1,'center','center');
    this.hit(120,y-2,81,15,actions[i],labels[i]);
  }
  this.bevel(20,145,80,155);text(this,'Load Game',50,149,'#55ff55','litt',1,1,'center','center');text(this,'L        ',50,149,'#ff5555','litt',1,1,'center','center');this.hit(18,143,65,15,'load','Load Game');
  if(app.screen==='menu'){const y=95+20*(app.selection||0);cross(this,112,y);cross(this,208,y);}
}
export const GAME_OPTION_KEYS=['crumble','walls','trail','visible','tanksFall','computerBuy','background','paletteSpeed','wind','teams'];
export function optionsLayout(app,sound=false){
  menuLayout.call(this,app);this.hits=[];this.hit(0,0,320,200,'menu','Close options');
  const o=app.options,yn=x=>x?'YES':'NO';
  const rows=sound?[['Effect:',o.sound?'ON':'OFF','sound'],['Flying:',o.flySound?'ON':'OFF','flySound']]:[
    ['Crumble Percent:',o.crumble+'%','crumble'],['Walls:',['NO','STICK','ELASTIC','ACCEL','WARP','RND'][o.walls],'walls'],['Trail Visible:',yn(o.trail),'trail'],['Ball Visible:',yn(o.visible),'visible'],['Tanks Fall:',yn(o.tanksFall),'tanksFall'],['Computer Can Buy:',yn(o.computerBuy),'computerBuy'],['Background:',['None','Stars','Bars','Circles','Spread','Sky','Static','Rectangle','Asterisk','RND','USER'][o.background],'background'],['Cycle Delay:',o.paletteSpeed,'paletteSpeed'],['Wind Force:',['None','Low','Norm','High','Gale','RND'][o.wind],'wind'],['Team Play:',yn(o.teams),'teams']];
  const x=sound?35:95,y=sound?55:47,right=sound?105:225,bottom=sound?85:153,step=sound?14:10,tx=sound?40:100,ty=sound?62:52,vx=sound?85:223;
  this.bevel(x,y,right,bottom);this.hit(x-2,y-2,right-x+5,bottom-y+5,'noop','Options');
  rows.forEach(([label,value,key],i)=>{text(this,label,tx,ty+i*step,'#000','litt',1,1,'left','center');text(this,value,vx,ty+i*step,'#ffff55','litt',1,1,sound?'left':'right','center');this.hit(x,ty+i*step-5,right-x+1,step,'option:'+key,label);});
  cross(this,sound?29:89,ty+step*(app.optionIndex||0));cross(this,sound?111:231,ty+step*(app.optionIndex||0));
}
export function rosterLayout(app){
  this.menuBackground(app.options.paletteSpeed);menuHeading.call(this);
  for(let i=0;i<10;i++){const x=10+(i%5)*61,y=i<5?50:111,p=app.roster[i],enabled=i<app.options.players,fill=enabled?GRAY:SHADOW,cx=x+27;
    this.bevel(x,y,x+55,y+55,fill);this.bevel(x+3,y+3,x+52,y+12,fill,SHADOW,WHITE);
    let numerator=100;while(numerator>1&&Math.trunc(this.textWidth(p.name,'litt',numerator/100))>49)numerator--;text(this,p.name,cx,y+1,enabled?COLORS[i]:'#000','litt',numerator/100,1,'center');
    const type=p.ai>=0?2:p.control==='mouse'?1:0;
    for(let k=0;k<3;k++){text(this,['KEYBOARD','MOUSE','COMPUTER'][k],cx,y+19+k*10,enabled&&type===k?'#5555ff':'#000','litt',1,k===1?1/3:1,'center','center');if(enabled)this.hit(x,y+14+k*10,56,10,(k===2?'ai:':k===1?'mouse:':'human:')+i,['Keyboard','Mouse','Computer'][k]);}
    if(enabled)this.hit(x+1,y+1,54,14,'name:'+i,p.name);else cross(this,cx,y+51,'#000');
    if(enabled){for(const [dx,dy] of [[0,0],[-1,0],[1,0],[0,-1],[0,1]])insetBackground(this,cx+dx,y+51+dy,1,1,app.options.paletteSpeed);if(i===(app.editPlayer||0))cross(this,cx,y+51);}
  }
  this.bevel(71,171,248,197);
  for(let n=1;n<=5;n++)for(const dx of [-n,n])for(const dy of [-n,n])text(this,'START',163+dx,182+dy,'#ffff55','euro',1,.3,'center','center');
  text(this,'START',163,182,'#ff5555','euro',1,.3,'center','center');this.hit(69,169,182,31,'start','START');
}
export function scoreLayout(app){
  this.shopBackground(app.options.paletteSpeed);const g=app.game,n=g.players.length,top=85-5*n,bottom=115+5*n;
  this.bevel(45,top,275,bottom);this.bevel(65,top-20,255,top-5);
  text(this,g.round+(g.round===1?' Game ':' Games ')+'Played out of '+g.options.rounds,160,top-13,'#aa5500','litt',1,1,'center','center');
  this.bgiLine(50,top+16,270,top+16,SHADOW);text(this,'Player',50,top+5,SHADOW);text(this,'Wins',185,top+5,SHADOW,'litt',1,1,'right');text(this,'Score',270,top+5,SHADOW,'litt',1,1,'right');
  const sorted=[...g.players].sort((a,b)=>b.wins-a.wins||b.score-a.score);let rank=1;
  sorted.forEach((p,i)=>{const y=top+20+i*10,color=COLORS[p.id];text(this,(rank<10?' ':'')+rank+'.',50,y,color);text(this,p.name,72,y,color);text(this,p.wins,185,y,color,'litt',1,1,'right');text(this,p.score,270,y,color,'litt',1,1,'right');this.hit(45,y,231,10,'stats:'+p.id,p.name);const next=sorted[i+1];if(!next||next.score!==p.score||next.wins!==p.wins)rank++;});
  for(const [left,label,action] of [[60,'Add','addRounds'],[135,g.round===g.options.rounds?'Exit':'Continue','shop'],[210,'Save','save']]){this.bevel(left,bottom+5,left+50,bottom+15);text(this,label,left+25,bottom+9,SCREEN_COLOR,'litt',1,1,'center','center');this.hit(left-2,bottom+3,55,15,action,label);}
}
// OVR 0x4e03–0x5181. Separate padded strings reproduce hotkey colors.
export function aiLayout(app){
  rosterLayout.call(this,app);this.hits=[];this.hit(0,0,320,200,'roster','Close computer selection');this.bevel(116,58,204,142);
  const rows=[
    [['Random (  ','        ? ','         )'],['#aa5500','#ffff55','#aa5500'],-1],
    [['Mr.       ','    S     ','     tupid'],['#aa5500','#ffff55','#aa5500'],0],
    [['L     ',' obber'],['#ffff55','#aa5500'],1],
    [['R       ',' ifleman'],['#ffff55','#aa5500'],2],
    [['Lob & Shoot (  ','             B ','              )'],['#aa5500','#ffff55','#aa5500'],4],
    [['W           ',' indless Wit'],['#ffff55','#aa5500'],3],
    [['T      ',' wanger'],['#ffff55','#aa5500'],5],
    [['Wind       ','     M     ','      aster'],['#aa5500','#ffff55','#aa5500'],6]
  ];
  rows.forEach(([parts,colors,id],i)=>{parts.forEach((part,j)=>text(this,part,160,63+i*10,colors[j],'litt',1,1,'center','center'));this.hit(116,58+i*10,89,10,id<0?'aiRandom':'setAI:'+id,parts.join(''));});
  const ai=app.roster[app.editPlayer].ai,index=app.aiSelection??([0,1,2,4,3,5,6].indexOf(ai)+1);cross(this,119,63+Math.max(0,index)*10);cross(this,201,63+Math.max(0,index)*10);
}
// Player statistics, OVR 0xaf95–0xb63c. Original spelling retained.
export function statsLayout(app){
  const g=app.game,p=g.players[app.statsPlayer];if(g.phase==='score')scoreLayout.call(this,app);else this.battle(app);this.hits=[];
  this.bevel(80,30,240,170);text(this,p.name,160,33,COLORS[p.id],'litt',1,1,'center');this.bgiLine(80,47,240,47,SCREEN_COLOR);
  const round=Math.max(1,g.round),deaths=p.deaths||0,shots=p.shots||0;
  const rows=[['Type:',p.ai>=0?'Computer':p.control==='mouse'?'Human (M)':'Human (K)'],['Score:',p.score],['Cash:',p.money],['Wins:',p.wins],['Hits:',p.hits],['Kills:',p.kills],['Shots:',shots],['Accuracy:',shots?Math.trunc(p.hits/shots*100)+'%':'Undefined'],['Kills per Round:',(p.kills/round).toFixed(2).padStart(5)],['Kill Rate:',shots?Math.round(p.kills/shots*100).toString().padStart(3)+'%':'Undefined'],['Fatalties:',deaths],['  per Round:',(deaths/round).toFixed(1).padStart(5)]];
  rows.forEach(([label,value],i)=>{text(this,label,84,46+10*i,SCREEN_COLOR);text(this,value,236,46+10*i,i>=10?'#aa0000':'#ffff55','litt',1,1,'right');});
  if(g.options.teams){this.bevel(2,180,84,195);text(this,'Team '+(p.team+1),42,181,COLORS[p.id],'litt',1,1,'center');}
  this.hit(0,0,320,200,'resume','Close statistics');
}
