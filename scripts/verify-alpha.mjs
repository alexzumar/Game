import {readModelSource} from './source-files.mjs';
import vm from 'node:vm';import assert from 'node:assert/strict';import {stripTypeScriptTypes} from 'node:module';
const storage={value:null,getItem(){return this.value},setItem(_,value){this.value=value}};
const context=vm.createContext({assert,console,localStorage:storage});
vm.runInContext(stripTypeScriptTypes(readModelSource()),context);
vm.runInContext(`
let seed=123456;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const f=newFarm();assert.equal(f.resources.orbs,0);assert.equal(crops[0].seconds,120);assert.equal(crops[15].seconds,3600);
for(const set of cropSets)assert.deepEqual(set.crops.map(i=>cropTiers[i]),[0,1,2,3]);
assert.ok(Math.abs(growthTime(0,100)/growthTime(15,100)-1/30)<.00001);
for(let tier=0;tier<4;tier++){
 const crop=cropTiers.indexOf(tier),farm=newFarm(),n=100000;
 awardHarvestLoot(farm,crop,n,random);
 const chance=[.01,.015,.02,.05][tier],group=cropSets.findIndex(s=>s.crops.includes(crop));
 const sets=farm.resources.items['set'+group]??0,props=Object.entries(farm.resources.items).filter(([id])=>id.startsWith('property:')).reduce((s,[,n])=>s+n,0);
 assert.equal(farm.resources.orbs/[1,4,16,64][tier]+sets+props,n);
 assert.ok(Math.abs(sets/n-chance)<.003);assert.ok(Math.abs(props/n-chance)<.003);
 assert.ok(Math.abs((farm.resources.items.duplication??0)/n-cropTimes[crop]/120*.0015)<.002);
}
const tomato=newFarm();awardHarvestLoot(tomato,10,100000,random);assert.ok(tomato.resources.items['property:value']>0);assert.ok(tomato.resources.items['property:stability']>0);
f.resources.duplication=1001;assert.equal(duplicateCount(f,10,()=>.5),20);f.resources.duplication=2001;assert.equal(duplicateCount(f,10,()=>.5),30);
const line={name:'Test',crop:0,seeds:1,traits:['growth'],genes:{gr:1,ga:1,re:1},powers:{growth:1500}};f.lines.push(line);f.resources.items['property:growth']=10;
assert.equal(enhanceProperty(f,0,'growth',()=>0),'success');assert.equal(line.powers.growth,1500);assert.equal(line.enhancements.growth,1);
assert.equal(effectiveGenome(f,{crop:0,line:0,planted:0,ready:null}).powers.growth,1515);assert.ok(powerLabel(line,'growth').includes('(+1%=1515%)'));
assert.equal(enhanceProperty(f,0,'growth',()=>.999),'failure');assert.equal(line.enhancements.growth,0);assert.equal(f.resources.items['property:growth'],8);
line.enhancements.growth=100;assert.equal(enhanceProperty(f,0,'growth',()=>0),null);assert.equal(f.resources.items['property:growth'],8);assert.equal(enhancementChance(99),.45);
assert.deepEqual(inheritEnhancements([{genes:line.genes,powers:{growth:10},enhancements:{growth:40}},{genes:line.genes,powers:{growth:10},enhancements:{growth:80}}],['growth']),{});
const parents=[40,80].map(level=>({genes:{gr:1,ga:1,re:1},powers:{growth:5},enhancements:{growth:level}}));
const child=generateMutationLine(f,{crop:0,planted:0,ready:0,mystery:{parents:[0,0],genomes:parents,traits:[]}},()=>.5);assert.equal(child.enhancements.growth,undefined);assert.equal(child.parents[0].genome.enhancements.growth,40);
const hybridFarm=newFarm();hybridFarm.lines.push({...line,enhancements:{growth:1}});hybridFarm.plots[0]={crop:0,line:0,planted:0,ready:0};collect(hybridFarm,0,1,()=>.5);assert.equal(hybridFarm.resources.orbs,0);assert.equal(hybridFarm.lines[0].seeds,2);
const baseFarm=newFarm();baseFarm.plots[0]={crop:0,planted:0,ready:0};assert.ok(collect(baseFarm,0,1,()=>.5)>0);assert.ok(baseFarm.resources.orbs>0);
saveFarm(f);const loaded=loadFarm();assert.equal(loaded.lines[0].enhancements.growth,100);assert.equal(loaded.resources.items['property:growth'],8);
const legacy=JSON.parse(localStorage.value);delete legacy.resources;localStorage.value=JSON.stringify(legacy);assert.equal(loadFarm().resources.orbs,0);
f.coins=10000;f.collection[0]=1;f.levels[0].growth=10;f.resources.orbs=0;assert.equal(buyTrait(f,0,'growth'),false);f.resources.orbs=1;f.resources.items.set1=1;f.resources.items['property:growth']=0;assert.equal(unlockBarrier(f,0,'growth'),false);f.resources.items['property:growth']=1;assert.equal(unlockBarrier(f,0,'growth'),true);assert.equal(f.resources.items.set1,1);assert.equal(f.resources.items['property:growth'],0);assert.equal(barrierThreshold(barrierLevel(f,0,'growth')),50);assert.equal(buyTrait(f,0,'growth'),true);assert.equal(f.resources.orbs,0);
const automated=newFarm();automated.coins=100000;automated.collection.fill(1);automated.harvested.fill(1);automated.resources.items.set2=6;
assert.equal(buyConvenience(automated,'irrigation'),true);assert.equal(automated.resources.items.set2,1);assert.equal(buyConvenience(automated,'replant'),true);assert.equal(automated.resources.items.set2,0);
automated.resources.items.set3=1;const duration=irrigationOffer(automated).duration;assert.equal(upgradeIrrigation(automated),true);assert.equal(irrigationOffer(automated).duration,duration*1.25);
console.log('PASS: all rarity sets, proportional growth, categorical loot, tomato materials, duplication, enhancement success/failure/cap/effects, inheritance, hybrid exclusion, migration and orb spending');
`,context);


