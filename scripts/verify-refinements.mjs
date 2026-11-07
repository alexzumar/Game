import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {stripTypeScriptTypes} from 'node:module';
const storage={value:null,getItem(){return this.value},setItem(_,v){this.value=v}};const context=vm.createContext({assert,console,localStorage:storage});
vm.runInContext(stripTypeScriptTypes(['farm.ts','resources.ts','packs.ts','storage.ts'].map(f=>fs.readFileSync('src/'+f,'utf8')).join('\n')),context);
vm.runInContext(`
const f=newFarm();f.coins=10000;const coins=f.coins;assert.equal(buySeeds(f,0,100),100);assert.equal(f.seeds[0],101);assert.equal(f.coins,coins-100*seedPrice(0));assert.equal(buySeeds(f,0,100000),0);assert.equal(buySeeds(f,1,1),0);assert.equal(buySeeds(f,0,1.5),0);
f.coins=25;assert.equal(buySeeds(f,0,100,true),2);assert.equal(f.coins,5);
const farm=newFarm();farm.plots[0]={crop:0,planted:0,ready:0};farm.harvested[0]=9;const growth=growthTime(0,collectionGrowth(farm,0));collect(farm,0,1,()=>.5);assert.equal(farm.harvested[0],10);assert.equal(farm.harvestValue[0],5.05);assert.equal(growthTime(0,collectionGrowth(farm,0)),growth);
assert.deepEqual([10,20,40,80].map(n=>collectionLevel(n)),[1,2,3,4]);saveFarm(farm);assert.equal(loadFarm().harvested[0],10);
function child(re){return generateMutationLine(farm,{crop:0,planted:0,ready:0,mystery:{parents:[0,1],traits:[],genomes:[{genes:{gr:1,ga:1,re},powers:{moisture:.3}},{genes:{gr:1,ga:1,re},powers:{}}]}},()=>.5);}
assert.equal(child(1).powers.moisture,.18);assert.equal(child(30).powers.moisture,.32);
const pack=newFarm(),before=Math.random;pack.coins=100;try{Math.random=()=>.999999;const result=openPack(pack,0);assert.equal(result[0],15);finishPackOpening(pack);assert.ok(unlocked(pack,15));assert.equal(pack.harvested[15],0);}finally{Math.random=before;}
const barriers=newFarm();barriers.collection[0]=1;barriers.levels[0].growth=10;barriers.resources.items.set1=1;assert.equal(unlockBarrier(barriers,0,'growth'),true);barriers.levels[0].growth=109;assert.equal(barrierClosed(barriers,0,'growth'),false);barriers.levels[0].growth=110;assert.equal(barrierClosed(barriers,0,'growth'),true);
const money=newFarm();money.harvest[0]=1;money.harvestValue[0]=9.059555;assert.equal(sellBasket(money,[...money.harvest]),1);assert.equal(money.coins,10);money.coins=9059.555;saveFarm(money);assert.equal(loadFarm().coins,9060);
let sequence=81723;const rng=()=>((sequence=(Math.imul(sequence,1664525)+1013904223)>>>0)/4294967296);const histogram={up:0,down:0,same:0};
const sample={crop:0,planted:0,ready:0,mystery:{parents:[0,0],traits:['growth'],genomes:[{genes:{gr:2,ga:1,re:2},powers:{growth:5.05}},{genes:{gr:2,ga:1,re:1},powers:{growth:5.05}}]}};
for(let i=0;i<1000;i++){const value=generateMutationLine(farm,sample,rng).powers.growth;histogram[value>5.05?'up':value<5.05?'down':'same']++;}
assert.ok(histogram.up>250&&histogram.down>60&&histogram.same>400);console.log('Property variation at user genetics (1000 children):',JSON.stringify(histogram));
const moved=newFarm();moved.lines=[{name:'Donor',crop:0,seeds:3,traits:['growth'],powers:{growth:5},genes:{gr:1,ga:1,re:1},enhancements:{growth:45}},{name:'Target',crop:0,seeds:2,traits:['growth'],powers:{growth:6},genes:{gr:1,ga:1,re:1},enhancements:{}}];
assert.equal(transferEnhancement(moved,0,1,'growth'),true);assert.equal(moved.lines[0].enhancements.growth,0);assert.equal(moved.lines[1].enhancements.growth,45);assert.equal(moved.lines[1].powers.growth,6);assert.equal(moved.lines[0].seeds,3);
moved.lines[0].enhancements.growth=20;assert.equal(transferEnhancement(moved,1,0,'growth'),true);assert.equal(moved.lines[0].enhancements.growth,45);assert.equal(moved.lines[1].enhancements.growth,20);
moved.plots[0]={crop:0,line:0,planted:0,ready:null};assert.equal(transferEnhancement(moved,0,1,'growth'),false);moved.plots[0]=null;assert.equal(transferEnhancement(moved,0,0,'growth'),false);
const future={crop:0,planted:0,ready:0,mystery:{parents:[0,0],traits:['growth'],genomes:moved.lines.map(l=>({genes:l.genes,powers:l.powers,enhancements:l.enhancements}))}};assert.deepEqual(generateMutationLine(moved,future,()=>.5).enhancements,{});
future.mystery.preview={name:'',crop:0,seeds:1,traits:['growth'],genes:{gr:1,ga:1,re:1},powers:{growth:5},enhancements:{growth:45}};moved.plots[0]=future;assert.deepEqual(acceptMutation(moved,0,1,()=>.5).line.enhancements,{});
saveFarm(moved);assert.equal(loadFarm().lines[0].enhancements.growth,45);
console.log('PASS: atomic/partial bulk purchases, harvest collection price bonus without growth bonus, save/reload, Re retention, and new species from packs');
`,context);
