import {W,H,TOP,LEFT,RIGHT,BOTTOM,WALLS,COLORS,AI_NAMES} from './engine.js';
export class Renderer {
  constructor(canvas,fonts,bitmap){this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.fonts=fonts;this.bitmap=bitmap;this.hits=[];this.time=0;this.buttons=[];this.ctx.imageSmoothingEnabled=false;this.back=document.createElement('canvas');this.back.width=W;this.back.height=H;this.bc=this.back.getContext('2d');this.titleA=new Image();this.titleA.src='./assets/title.png';this.titleB=new Image();this.titleB.src='./assets/title-2.png';}
  rect(x,y,w,h,c){this.ctx.fillStyle=c;this.ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
  line(x0,y0,x1,y1,c){x0=Math.round(x0);y0=Math.round(y0);x1=Math.round(x1);y1=Math.round(y1);let dx=Math.abs(x1-x0),sx=x0<x1?1:-1,dy=-Math.abs(y1-y0),sy=y0<y1?1:-1,err=dx+dy;this.ctx.fillStyle=c;for(let n=0;n<2000;n++){this.ctx.fillRect(x0,y0,1,1);if(x0===x1&&y0===y1)break;const e=err*2;if(e>=dy){err+=dy;x0+=sx;}if(e<=dx){err+=dx;y0+=sy;}}}
  box(x,y,w,h,fill='#aaa',inset=false){this.rect(x,y,w,h,fill);const hi=inset?'#555':'#fff',lo=inset?'#fff':'#555';this.line(x,y,x+w-1,y,hi);this.line(x,y,x,y+h-1,hi);this.line(x+w-1,y+1,x+w-1,y+h-1,lo);this.line(x+1,y+h-1,x+w-1,y+h-1,lo);}
  textWidth(str,font='litt',scale=1){if(font==='bios')return String(str).length*8*scale;const f=this.fonts[font];return [...String(str)].reduce((n,c)=>n+(f.glyphs[c]?.width||f.glyphs[c.toUpperCase()]?.width||4)*scale,0);}
  text(str,x,y,color='#fff',font='litt',scale=1,align='left'){
    str=String(str);if(align==='center')x-=this.textWidth(str,font,scale)/2;if(align==='right')x-=this.textWidth(str,font,scale);
    if(font==='bios'){for(const c of str){const code=c.charCodeAt(0)&127;for(let row=0;row<8;row++)for(let col=0;col<8;col++)if(this.bitmap[code*8+row]&(128>>col))this.rect(x+col*scale,y+row*scale,scale,scale,color);x+=8*scale;}return;}
    const f=this.fonts[font];for(let c of str){let g=f.glyphs[c];if(!g?.width)g=f.glyphs[c.toUpperCase()];if(!g){x+=4*scale;continue;}let px=0,py=0;
      for(const [cmd,gx,gy] of g.commands){const nx=x+gx*scale,ny=y+(f.ascender-gy)*scale;if(cmd==='line')this.line(px,py,nx,ny,color);px=nx;py=ny;}x+=g.width*scale;}
  }
  hit(x,y,w,h,action,label){this.hits.push({x,y,w,h,action,label});}
  button(label,x,y,w,h,action,{color='#55ff55',font='litt',scale=1,selected=false,fill='#aaa'}={}){this.box(x,y,w,h,fill,selected);this.text(label,x+w/2,y+(h-(font==='bios'?8:this.fonts[font].ascender+1)*scale)/2,color,font,scale,'center');this.hit(x,y,w,h,action,label);}
  circle(x,y,r,color,fill=false){if(fill){for(let yy=-r;yy<=r;yy++){const xx=Math.floor(Math.sqrt(Math.max(0,r*r-yy*yy)));this.rect(x-xx,y+yy,xx*2+1,1,color);}}else{let xx=r,yy=0,e=1-r;while(xx>=yy){for(const [a,b] of [[xx,yy],[yy,xx],[-yy,xx],[-xx,yy],[-xx,-yy],[-yy,-xx],[yy,-xx],[xx,-yy]])this.rect(x+a,y+b,1,1,color);yy++;if(e<0)e+=2*yy+1;else{xx--;e+=2*(yy-xx)+1;}}}}
  background(kind=0,time=0,menu=false,palette=null,stars=[]){
    const im=this.bc.createImageData(W,H),d=im.data,phase=time*0.3;
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4;let v=0;if(menu){const q=Math.max(Math.abs(x-160)*0.65,Math.abs(y-100));v=((q+phase*8)%30)/30;}else{
        if(kind===0||kind===1)v=0;else if(kind===2)v=(y%30)/30;else if(kind===3)v=(Math.floor(Math.hypot(x-160,y-100))%30)/30;else if(kind===4)v=(Math.sin(x/15+phase)+Math.cos(y/13-phase)+2)/4;else if(kind===5)v=((Math.hypot(x-160,y-100)+phase*7)%30)/30;else if(kind===6)v=((Math.abs(x-160)+Math.abs(y-110)+phase*7)%25)/25;else if(kind===7)v=(Math.sin((x*y)/180+phase)+1)/2;else if(kind===8)v=((Math.max(Math.abs(x-160),Math.abs(y-100))+phase*10)%28)/28;else v=(Math.sin(x/8+Math.sin(y/12+phase)*4)+1)/2;}
      d[i]=menu?Math.round(90+160*v):kind===0?42:Math.round(10+v*35);d[i+1]=menu?0:kind===0?27:Math.round(4+v*15);d[i+2]=menu?Math.round(100+150*v):kind===0?31:Math.round(25+v*85);d[i+3]=255;if(!menu&&palette?.length&&kind>1){const color=palette[(Math.trunc(v*30)+Math.trunc(time*6))%palette.length];d[i]=color[0];d[i+1]=color[1];d[i+2]=color[2];}}
    this.bc.putImageData(im,0,0);this.ctx.drawImage(this.back,0,0);if(!menu&&kind===1&&palette?.length)for(const [x,y,i] of stars){const c=palette[(i+Math.trunc(time*4))%palette.length];this.rect(x,y,1,1,`rgb(${c.join(",")})`);}
  }
  heading(){this.box(8,4,304,40);this.text('TANK WARS  3.2',160,10,'#ffff55','euro',0.57,'center');this.text('TANK WARS  3.2',159,9,'#ff5555','euro',0.57,'center');}
  splash(){if(this.titleA.complete)this.ctx.drawImage(this.titleA,0,0);this.box(83,164,154,17,'#111');this.text('PRESS ENTER TO CONTINUE',160,169,'#ffff55','tiny',1,'center');this.hit(0,0,320,200,'menu','Продолжить');}
  menu(app){this.background(1,this.time,true);this.heading();this.box(116,61,88,18);this.text('Main Menu',160,66,'#0000aa','bios',1,'center');this.box(116,83,88,107);
    const labels=['Sound Options','Game Options',`Players: ${app.options.players}`,`Games: ${app.options.rounds}`,'START'];
    labels.forEach((l,i)=>this.button(l,120,89+i*20,80,14,['sound','options','playersCount','roundsCount','roster'][i],{color:i===4?'#ff55ff':'#55ff55',fill:'#750080',selected:app.selection===i}));
    this.button('Load Game',18,143,66,15,'load');this.button('Quick Start',226,143,77,15,'quick',{color:'#ffff55'});
    this.text('NATIVE WEB RECONSTRUCTION',160,194,'#ddd','tiny',1,'center');
  }
  options(app,sound=false){this.background(1,this.time,true);this.heading();this.box(27,52,266,137);this.text(sound?'Sound Options':'Game Options',160,58,'#0000aa','bios',1,'center');
    const rows=sound?[
      ['Sound Effects',app.options.sound?'ON':'OFF','sound'],['Fly Sound Effects',app.options.flySound?'ON':'OFF','flySound']
    ]:[['Crumbling Hills',app.options.crumble+'%','crumble'],['Walls',WALLS[app.options.walls],'walls'],['Shot Visible',app.options.visible?'YES':'NO','visible'],['Trail Visible',app.options.trail?'YES':'NO','trail'],['Background',['None','Stars','Bars','Circles','Spread','Sky','Static','Rectangle','Asterisk','RND'][app.options.background],'background'],['Tanks Fall',app.options.tanksFall?'YES':'NO','tanksFall'],['Computers Can Buy',app.options.computerBuy?'YES':'NO','computerBuy'],['Wind Force',['None','Low','Normal','High','Gale','Random'][app.options.wind],'wind'],['Team Play',app.options.teams?'ON':'OFF','teams'],['Palette Speed',String(app.options.paletteSpeed),'paletteSpeed']];
    rows.forEach(([label,value,id],i)=>{const y=73+i*10;if(i===(app.optionIndex||0))this.text('>',29,y,'#800000','tiny');this.text(label,37,y,'#000');this.text(value,278,y,'#ffff55','litt',1,'right');this.hit(32,y-1,254,10,'option:'+id,label);});this.button('OK',132,175,56,12,'menu',{color:'#000'});
  }
  roster(app){this.background(1,this.time,true);this.heading();for(let i=0;i<10;i++){const x=8+(i%5)*61,y=48+Math.floor(i/5)*61,enabled=i<app.options.players,p=app.roster[i];this.box(x,y,60,60,enabled?'#aaa':'#555');this.box(x+3,y+3,54,14,enabled?'#aaa':'#555',true);this.text(p.name.slice(0,10),x+30,y+6,enabled?COLORS[i]:'#000','litt',1,'center');if(enabled)this.hit(x+3,y+3,54,14,'name:'+i,'Имя игрока '+(i+1));
      for(let k=0;k<3;k++){const label=['KEYBOARD','MOUSE','COMPUTER'][k],selected=k===2?p.ai>=0:k===0&&p.ai<0;this.text(label,x+30,y+20+k*10,enabled&&selected?'#5555ff':'#000','litt',1,'center');if(enabled)this.hit(x+2,y+18+k*10,56,10,(k===2?'ai:':'human:')+i,label);}
      if(enabled){this.text(p.ai>=0?AI_NAMES[p.ai].slice(0,12):app.options.teams?'TEAM '+(p.team+1):'+',x+30,y+52,p.ai>=0?'#800000':'#aa00aa','tiny',1,'center');this.hit(x,y+49,60,10,app.options.teams?'team:'+i:'ai:'+i,'Тип игрока');}}
    this.button('START',70,172,180,26,'start',{font:'euro',scale:0.48,color:'#ffff55'});
  }
  ai(app){this.roster(app);this.box(111,56,98,105);this.text('Computer',160,61,'#0000aa','litt',1,'center');AI_NAMES.forEach((name,i)=>this.button(name,115,73+i*12,90,11,'setAI:'+i,{color:'#a50',selected:app.roster[app.editPlayer].ai===i}));}
  tank(p){const x=Math.round(p.x),y=Math.round(p.y),c=p.color;
    const rows=['000111000','011111110','011111110','111010111','111111111'];for(let r=0;r<rows.length;r++)for(let k=0;k<9;k++)if(rows[r][k]==='1')this.rect(x-4+k,y-4+r,1,1,c);
    const a=p.angle*Math.PI/180;this.line(x,y,x+Math.trunc(Math.cos(a)*8),y-Math.trunc(Math.sin(a)*8),c);
    if(p.defense[0])this.circle(x,y-1,8,'#55ffff');if(p.defense[2])this.circle(x,y-1,12,'#ff55ff');}
  icon(id,x,y,c){
    if(id===0)this.rect(x+7,y+5,1,1,c);else if(id<=4){const r=[0,1,2,3,4][id];this.circle(x+7,y+5,r,c,id>1);}
    else if(id===5){this.line(x+3,y+8,x+11,y+1,c);this.rect(x+2,y+7,2,2,c);}
    else if([6,8,9,10].includes(id)){for(let j=0;j<(id===6?4:id===8?8:20);j++)this.rect(x+3+(j%5)*2,y+1+Math.floor(j/5)*2,1,1,c);}
    else if(id===7){for(let j=-2;j<=2;j++)this.line(x+7,y+2,x+7+j*2,y+8,c);}
    else if(id===11){this.rect(x+6,y+3,4,5,c);this.line(x+8,y+3,x+10,y+1,c);}
    else if(id===12){this.line(x+4,y+2,x+10,y+8,c);this.line(x+10,y+2,x+4,y+8,c);}
    else if(id===13||id===14)this.circle(x+7,y+5,3,c,id===14);
    else if(id<=17){this.rect(x+6,y+4,3,3,c);for(let j=0;j<4;j++){const a=j*Math.PI/2;this.line(x+7+Math.cos(a)*3,y+5+Math.sin(a)*3,x+7+Math.cos(a)*6,y+5+Math.sin(a)*5,c);}}
    else this.text(id===18?'H':'V',x+3,y+1,c,'bios');
  }
  battle(app){const g=app.game,p=g.current;this.background(g.background,this.time/(1+g.options.paletteSpeed),false,g.palette,g.stars);
    const ground=['#00aa00','#aa5500','#aaaa00','#0088aa','#aa00aa'][g.groundColor];this.ctx.fillStyle=ground;for(let y=TOP;y<=BOTTOM;y++){let start=-1;for(let x=LEFT;x<=RIGHT+1;x++){const solid=x<=RIGHT&&g.terrain.data[y*W+x];if(solid&&start<0)start=x;if(!solid&&start>=0){this.ctx.fillRect(start,y,x-start,1);start=-1;}}}
    for(const trail of g.trails){if(g.options.trail||trail.laser)for(const [x,y] of trail.path)if(x>LEFT&&x<RIGHT&&y>TOP&&y<BOTTOM)this.rect(x,y,1,1,trail.color||'#888');}
    for(const s of g.shots){if(g.options.trail)for(const [x,y] of s.trail)if(x>LEFT&&x<RIGHT&&y>TOP&&y<BOTTOM)this.rect(x,y,1,1,COLORS[s.owner]);if(g.options.visible&&s.x>LEFT&&s.x<RIGHT&&s.y>TOP&&s.y<BOTTOM)this.rect(s.x,s.y,1,1,'#fff');}
    for(const t of g.players)if(t.alive)this.tank(t);
    this.ctx.save();this.ctx.beginPath();this.ctx.rect(LEFT,TOP,RIGHT-LEFT+1,BOTTOM-TOP+1);this.ctx.clip();
    for(const e of g.explosions){const r=Math.round(e.r);if(e.kind==='sonic'){this.circle(e.x,e.y,r,'#55ffff');continue;}if(e.kind==='dirt')this.circle(e.x,e.y,r,ground,true);else {this.circle(e.x,e.y,r,'#ff5500',true);this.circle(e.x,e.y,Math.max(0,r-2),'#ffff55',true);this.circle(e.x,e.y,Math.max(0,r-4),'#fff',true);}}
    const death=g.deathVisual;if(death){if(death.tank){this.ctx.globalAlpha=death.alpha;this.tank(death.tank);this.ctx.globalAlpha=1;}for(const [x,y] of death.points||[])this.rect(x,y,1,1,death.color);for(const [x,y,r] of death.discs||[])this.circle(x,y,r,death.color,true);}
    this.ctx.restore();
    this.rect(0,0,320,18,'#291b20');this.rect(0,18,8,182,'#291b20');this.rect(312,18,8,182,'#291b20');this.rect(0,193,320,7,'#291b20');
    this.text('Angle:',8,0,'#aa00aa','bios');this.text(Math.min(p.angle,180-p.angle),56,0,'#ffff55','bios');this.text('Power:',8,10,'#aa00aa','bios');this.text(p.power,56,10,'#ffff55','bios');
    this.text(p.name.slice(0,12),160,0,p.color,'bios',1,'center');this.text('Wind: '+Math.abs(g.wind)+(g.wind<0?' <':' >'),160,10,'#5555ff','bios',1,'center');
    this.text('Direction('+ (p.angle>90?'<':'>') +')',215,0,'#aa00aa','bios');this.text('Men:',215,10,'#aa00aa','bios');this.text(p.men,247,10,'#ffff55','bios');
    for(let i=0;i<20;i++){const x=10+i*15,loaded=i<18?p.weapon===i:Boolean(p.armed&(1<<(i-18))),have=i<18?p.ammo[i]!==0:p.guidance[i-18]>0,c=have?(loaded?'#ff3333':'#fff'):'#000';this.rect(x,18,15,10,'#291b20');this.line(x,18,x+14,18,c);this.line(x,18,x,27,c);this.line(x+14,18,x+14,27,c);this.icon(i,x,18,c);this.hit(x,18,15,10,'weapon:'+i,i<18?g.weapons[i].name:i===18?'Herb guidance':'Vick guidance');}
    for(let j=0;j<3;j++){const c=j===1?'#610061':'#ff55ff';this.line(8+j,28+j,312-j,28+j,c);this.line(8+j,28+j,8+j,192-j,c);this.line(312-j,28+j,312-j,192-j,c);this.line(8+j,192-j,312-j,192-j,c);}
    this.text(g.weapons[p.weapon].shortName+' '+p.ammo[p.weapon],12,194,'#ddd','tiny');this.text('ROUND '+g.round+'/'+g.options.rounds,308,194,'#ddd','tiny',1,'right');
    this.hit(8,0,90,9,'angle','Угол');this.hit(8,10,90,8,'power','Мощность');this.hit(215,0,95,9,'reverse','Развернуть ствол');for(const t of g.players)if(t.alive)this.hit(t.x-5,t.y-10,11,15,'tank:'+t.id,t.name);
  }
  score(app){this.background(1,this.time,true);const g=app.game;this.box(20,14,280,174);this.text(g.round>=g.options.rounds?'FINAL RESULTS':'CURRENT STANDINGS',160,23,'#0000aa','bios',1,'center');this.text('Round '+g.round+' of '+g.options.rounds,160,38,'#a0a','litt',1,'center');
    this.text('PLAYER',31,54,'#000','tiny');this.text('SCORE',169,54,'#000','tiny');this.text('WINS',226,54,'#000','tiny');this.text('KILLS',262,54,'#000','tiny');
    [...g.players].sort((a,b)=>b.score-a.score).forEach((p,i)=>{const y=65+i*9;this.text(p.name,31,y,p.color,'litt');this.text(p.score,202,y,'#000','tiny',1,'right');this.text(p.wins,239,y,'#000','tiny',1,'right');this.text(p.kills,278,y,'#000','tiny',1,'right');this.hit(28,y,260,9,'stats:'+p.id,p.name);});
    this.button('OK',43,167,60,14,'shop',{color:'#000'});this.button('ADD',130,167,60,14,'addRounds',{color:'#000'});this.button('SAVE',217,167,60,14,'save',{color:'#000'});
  }
  shop(app){this.background(1,this.time,true);const p=app.game.players[app.shopPlayer],items=app.shopItems;this.box(10,5,300,190);this.text(p.name+' - Equipment',160,10,p.color,'bios',1,'center');this.text('Money: '+p.money,20,24,'#000');this.text('Selected: '+app.cartCost(),300,24,'#000','litt',1,'right');
    this.text('WEAPON / EQUIPMENT',18,38,'#000','tiny');this.text('QTY',185,38,'#000','tiny');this.text('PRICE',218,38,'#000','tiny');this.text('BUY',278,38,'#000','tiny');
    items.forEach((it,i)=>{const y=48+i*6;this.text(it.name.slice(0,33),18,y,p.money>=it.price?'#000':'#555','tiny');this.text(it.quantity,202,y,'#000','tiny',1,'right');this.text(it.price,249,y,'#000','tiny',1,'right');this.text('- '+(app.cart[i]||0)+' +',280,y,'#000','tiny',1,'center');this.hit(259,y-1,13,6,'cartMinus:'+i,'Убрать '+it.name);this.hit(276,y-1,27,6,'cartPlus:'+i,'Купить '+it.name);});
    this.button('Purchase',70,178,80,13,'purchase',{color:'#000'});this.button('Done',175,178,70,13,'shopDone',{color:'#000'});
  }
  mirv(app){this.battle(app);this.box(70,55,180,103);this.text('MIRV SETUP',160,64,'#0000aa','bios',1,'center');this.text('Spread',82,83,'#000');this.button(['Random','Horizontal','Vertical','+4 Way','X4 Way'][app.game.options.mirvSpread],137,79,100,15,'mirvSpread',{color:'#800000'});this.text('Detonate',82,106,'#000');this.button(['Impact','Simultaneous','None'][app.game.options.mirvDetonation],137,102,100,15,'mirvDetonation',{color:'#800000'});this.button('FIRE',122,133,76,16,'mirvFire',{color:'#800000'});}
  pause(app){this.battle(app);this.box(55,55,210,95);this.text('GAME PAUSED',160,64,'#0000aa','bios',1,'center');this.text('Round '+app.game.round+' / '+app.game.options.rounds,160,80,'#000','litt',1,'center');this.button('Continue',75,99,75,16,'resume',{color:'#000'});this.button('Save',170,99,75,16,'save',{color:'#000'});this.button('Main Menu',110,124,100,16,'confirmMenu',{color:'#000'});}
  stats(app){this.battle(app);const p=app.game.players[app.statsPlayer];this.box(65,56,190,103);this.text(p.name,160,64,p.color,'bios',1,'center');const rows=[['Men',p.men],['Score',p.score],['Money',p.money],['Kills',p.kills],['Accuracy',Math.round(p.hits/Math.max(1,p.shots)*100)+'%']];rows.forEach(([k,v],i)=>{this.text(k,80,80+i*11,'#000');this.text(v,239,80+i*11,'#000','litt',1,'right');});this.button('OK',135,140,50,12,'resume',{color:'#000'});}
  render(app,time){this.time=time;this.hits=[];this.rect(0,0,W,H,'#000');if(app.screen==='splash')this.splash();else if(app.screen==='menu')this.menu(app);else if(app.screen==='options'||app.screen==='sound')this.options(app,app.screen==='sound');else if(app.screen==='roster')this.roster(app);else if(app.screen==='ai')this.ai(app);else if(app.screen==='battle')this.battle(app);else if(app.screen==='score')this.score(app);else if(app.screen==='shop')this.shop(app);else if(app.screen==='mirv')this.mirv(app);else if(app.screen==='pause')this.pause(app);else if(app.screen==='stats')this.stats(app);else if(app.screen==='boss'){this.rect(0,0,320,200,'#000');this.text('Microsoft(R) MS-DOS(R)',0,0,'#aaa','bios');this.text('C:\\>',0,24,'#aaa','bios');}return this.hits;}
}
