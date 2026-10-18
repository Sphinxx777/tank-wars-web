import fs from 'node:fs';
import {Renderer} from '../dist/render.js';
import {menuLayout,rosterLayout,optionsLayout,scoreLayout} from '../dist/menu-render.js';
import {createMenuBackground,backgroundFrame} from '../dist/background.js';
const root=new URL('../',import.meta.url).pathname;
export function renderMenuFixture(screen){
const pixels=Buffer.alloc(192000),r=Object.create(Renderer.prototype);r.fonts={};for(const font of ['tiny','litt','euro'])r.fonts[font]=JSON.parse(fs.readFileSync(root+'dist/assets/'+font+'-font.json'));r.bitmap=fs.readFileSync(root+'dist/assets/font8.bin');r.hits=[];r.time=0;
let clip=[0,0,320,200],saved=[],newClip;
r.ctx={fillStyle:'#000',save(){saved.push(clip);},restore(){clip=saved.pop();},beginPath(){},rect(x,y,w,h){newClip=[x,y,w,h]},clip(){clip=newClip;},fillRect(x,y,w,h){let c=this.fillStyle;if(c.startsWith('rgb'))c=c.match(/\d+/g).map(Number);else{c=c.slice(1);if(c.length===3)c=[...c].map(x=>x+x).join('');c=[0,2,4].map(i=>parseInt(c.slice(i,i+2),16));}for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)if(xx>=clip[0]&&xx<clip[0]+clip[2]&&yy>=clip[1]&&yy<clip[1]+clip[3]&&xx>=0&&xx<320&&yy>=0&&yy<200)for(let k=0;k<3;k++)pixels[(yy*320+xx)*3+k]=c[k];}};
const bg=backgroundFrame(createMenuBackground(0,100));r.menuBackground=()=>{for(let y=0;y<200;y++)for(let x=0;x<320;x++){const i=(y*320+x)*4;r.rect(x,y,1,1,`rgb(${bg[i]},${bg[i+1]},${bg[i+2]})`);}};
const app={screen,selection:0,editPlayer:0,optionIndex:0,options:{players:2,rounds:10,paletteSpeed:0,sound:true,flySound:false,crumble:75,walls:0,trail:true,visible:true,tanksFall:true,computerBuy:true,background:9,wind:2,teams:false},roster:Array.from({length:10},(_,i)=>({name:'Player '+(i+1),ai:-1})),game:{round:1,options:{rounds:10},players:[{id:0,name:'Player 1',wins:1,score:2000},{id:1,name:'Player 2',wins:0,score:-1000}]}};
({menu:menuLayout,roster:rosterLayout,options:optionsLayout,sound:optionsLayout,score:scoreLayout}[screen]).call(r,app,screen==='sound');return pixels;
}
export function normalizeMenuPalette(pixels){const p=Buffer.from(pixels);for(let i=0;i<p.length;i+=3)if(p[i]===p[i+2]&&p[i]>90&&p[i+1]===0){p[i]=255;p[i+2]=255;}return p;}
if(process.argv[1]?.endsWith('/verify-menu.mjs'))for(const screen of ['menu','roster','options','sound','score']){const pixels=renderMenuFixture(screen);fs.writeFileSync(root+'research/screenshots/web-'+screen+'.ppm',Buffer.concat([Buffer.from('P6\n320 200\n255\n'),pixels]));console.log('Rendered',screen);}
