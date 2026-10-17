import fs from 'node:fs';
const source=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
const fixture=source.replace('<head>','<head><base href="/dist/">').replace('<script type="module" src="./app.js"></script>',`<script type="module">
import {app,beginShop} from './app.js';import {Game} from './engine.js';
const catalog=await(await fetch('./assets/weapons.json')).json();app.game=new Game(catalog.weapons,{rounds:10,computerBuy:false,wind:0},42);app.game.start([{name:'Player 1'},{name:'Player 2'}]);app.game.phase='score';app.game.players[0].money=200000;app.game.players[0].ammo=Array(18).fill(100);app.game.players[0].guidance=[5,5];app.game.players[0].defense=[1000,100,1];beginShop();
</script>`);
fs.writeFileSync(new URL('../research/fixtures/shop-ui.html',import.meta.url),fixture);
console.log('QA page: /research/fixtures/shop-ui.html (serve repository root)');
