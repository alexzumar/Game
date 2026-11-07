import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {stripTypeScriptTypes} from 'node:module';
const storage={value:null,getItem(){return this.value},setItem(_,value){this.value=value}};
const context=vm.createContext({assert,console,localStorage:storage});vm.runInContext(stripTypeScriptTypes(['farm.ts','resources.ts','packs.ts','fortune.ts','storage.ts'].map(f=>fs.readFileSync('src/'+f,'utf8')).join('\n')),context);
vm.runInContext(`
const starter=newFarm();assert.equal(starter.coins,0);assert.equal(starter.seeds[0],1);assert.equal(total(starter.seeds),1);assert.equal(expansionPrice(starter),1);assert.equal(expand(starter),false);starter.plots[0]={crop:0,planted:0,ready:0};starter.seeds[0]=0;assert.equal(collect(starter,0,1,()=>.5),1);assert.equal(starter.harvestValue[0],5);assert.equal(expand(starter),true);assert.equal(starter.size,2);assert.equal(expansionPrice(starter),15);assert.equal(starter.resources.orbs,0);assert.deepEqual(fieldOrbPrices,[1,15,50,150,400,1000,2500]);
assert.deepEqual([1,2,3,4,5].map(n=>packOpeningPrice(0,n)),[20,30,45,60,75]);assert.equal(seedPrice(15),2000000);assert.equal(seedPacks.length,4);
const f=newFarm();for(let pack=0;pack<4;pack++)for(const luck of [0,20,100,1000000000]){const odds=openingOdds(f,pack,luck);assert.ok(odds.every(n=>n>0));assert.ok(Math.abs(total(odds)-100)<1e-8);}
const group=(farm,pack,luck)=>total(openingOdds(farm,pack,luck).filter((_,i)=>cropTiers[i]===pack));assert.equal(group(f,3,0),.5);assert.ok(group(f,3,1e9)<1.000001);for(const i of [0,2,5,7])assert.ok(Math.abs(openingOdds(f,0,1e9)[i]-25)<.00001);
f.coins=100000;assert.equal(openPack(f,0,5).length,0);f.packProgress.slots=4;const beforeSeeds=f.seeds[15];assert.equal(openPack(f,0,5,()=>.999999999).length,5);assert.equal(unlocked(f,15),false);const result=finishPackOpening(f);assert.equal(result.newKinds,1);assert.equal(result.orbs,256);assert.equal(f.seeds[15],beforeSeeds+1);assert.equal(finishPackOpening(f),null);
const cash=newFarm();cash.coins=1000;cash.packProgress.slots=4;cash.packProgress.refund=14;cash.packProgress.refundGate=true;for(let i=0;i<4;i++){openPack(cash,0,5,()=>0);finishPackOpening(cash);}assert.equal(cash.coins,925);assert.equal(cash.resources.orbs,20);assert.equal(cash.seeds[0],1);assert.equal(cash.packProgress.refundUnits,0);
const off=newFarm();off.coins=500000;off.packProgress.refund=14;openPack(off,3,1,()=>0);assert.equal(finishPackOpening(off).returned,2500);assert.equal(off.coins,452500);
const pending=newFarm();pending.coins=100;openPack(pending,0,1,()=>0);saveFarm(pending);const reloaded=loadFarm();assert.equal(reloaded.resources.orbs,1);assert.equal(reloaded.packProgress.pending,null);assert.equal(loadFarm().resources.orbs,1);
const legacy=newFarm();delete legacy.packProgress;legacy.coins=100;legacy.cascade=2;legacy.discoveryUp.amount=2;legacy.harvest[0]=1;legacy.harvestValue[0]=1.5;saveFarm(legacy);const migrated=loadFarm();assert.equal(migrated.coins,131);assert.equal(migrated.harvestValue[0],7.5);assert.equal(migrated.cascade,0);saveFarm(migrated);assert.equal(loadFarm().coins,131);
const machine=newFarm();machine.seeds[0]=0;machine.harvest[0]=1;machine.harvestValue[0]=5;const t=machine.epoch;assert.equal(startExtraction(machine,0,1,t,()=>0),true);assert.ok(machine.extraction.job.output>=1);finishExtraction(machine,t+20000);assert.ok(machine.seeds[0]>=1);assert.equal(machine.extraction.history[0].input,1);saveFarm(machine);assert.equal(loadFarm().extraction.history[0].seeds,machine.seeds[0]);
const failed=newFarm();failed.harvest[0]=1;failed.harvestValue[0]=5;assert.equal(startExtraction(failed,0,1,failed.epoch,()=>0),true);assert.equal(failed.extraction.job.output,0);saveFarm(failed);assert.equal(loadFarm().extraction.job.output,0);
const hist=[0,0,0,0,0];let seed=4123;const rng=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
for(let batch=0;batch<20;batch++){const e=newFarm();e.extraction.yield=1;e.harvest[0]=1000;e.harvestValue[0]=5000;startExtraction(e,0,1000,e.epoch,rng);for(const count of e.extraction.job.outputs)hist[count]++;}
assert.ok(Math.abs(hist[4]/20000-.061875)<.01);assert.ok(Math.abs(hist[0]/20000-.01)<.005);console.log('Extractor first-upgrade distribution (20 000 fruits):',JSON.stringify(hist));
const gates=newFarm();gates.collection.fill(1);gates.resources.orbs=2000;gates.resources.items.set1=25;assert.equal(unlockPackGate(gates,'luck'),true);assert.ok(group(gates,3,1e9)<2.000001);gates.resources.orbs=1000000;gates.resources.items.set3=500;assert.equal(unlockPackGate(gates,'luck'),false);resize(gates,8);gates.collected=100000;assert.equal(unlockPackGate(gates,'luck'),true);assert.ok(group(gates,3,1e9)>4.99999);
gates.coins=100000000;gates.resources.orbs=1000000;gates.resources.items.set1=100;gates.resources.items.set2=100;gates.resources.items.set3=100;for(let i=0;i<4;i++)assert.equal(buyPackUpgrade(gates,'slots'),true);assert.equal(packSlotLimit(gates),5);assert.equal(buyPackUpgrade(gates,'slots'),false);gates.packProgress.speed=60;assert.equal(packOpeningTime(gates),500);gates.packProgress.speed=34;assert.equal(packOpeningTime(gates),500);gates.packProgress.speed=35;assert.equal(packOpeningTime(gates),500);assert.equal(moistureTime(0,0),60000);assert.equal(moistureTime(0,15),1800000);assert.equal(moistureTime(1,0),63000);
gates.packProgress.refund=3;gates.packProgress.refundGate=false;assert.equal(buyPackUpgrade(gates,'refund'),false);assert.equal(unlockPackGate(gates,'refund'),true);assert.equal(buyPackUpgrade(gates,'refund'),true);assert.equal(packRefundRate(gates),25);
const rescue=newFarm();rescue.seeds[0]=0;assert.equal(needsStarterRescue(rescue),true);assert.equal(rescueStarterSeed(rescue),true);assert.equal(rescueStarterSeed(rescue),false);
console.log('PASS: starter/expansion/prices, probability normalization and caps, 1–5 price, one-time gifts, orb duplicates, matched refund and integer carry, crash recovery, migration, extractor safety/distribution, material gates, speed floor and rescue');
`,context);

vm.runInContext(`
const parallel=newFarm(),started=parallel.epoch;
parallel.extraction.slots=3;
parallel.harvest[0]=6;
parallel.harvestValue[0]=30;
for(let slot=0;slot<3;slot++)assert.equal(startExtraction(parallel,0,2,started,()=>.5,slot),true);
assert.equal(parallel.harvest[0],0);
saveFarm(parallel);
const resumed=loadFarm();
assert.equal(extractionJobs(resumed.extraction).filter(Boolean).length,3);
finishExtraction(resumed,started+20000);
assert.equal(resumed.seeds[0],7);
assert.equal(stopExtraction(resumed,started+20000,1),true);
assert.equal(resumed.harvest[0],1);
finishExtraction(resumed,started+40000);
assert.equal(resumed.seeds[0],11);
assert.equal(extractionJobs(resumed.extraction).filter(Boolean).length,0);
console.log('PASS: parallel extraction, save/reload and individual cancellation');
`,context);

vm.runInContext(`
const gemFarm=newFarm();
for(const crop of cropSets[0].crops)gemFarm.harvested[crop]=1;
assert.equal(awardDiamondSets(gemFarm),true);
assert.equal(awardDiamondSets(gemFarm),false);
assert.equal(buyDiamondUpgrade(gemFarm,'discount'),true);
gemFarm.coins=19;
assert.equal(seedPurchaseQuote(gemFarm,0,1),10);
assert.equal(buySeeds(gemFarm,0,1),1);
assert.equal(seedPurchaseQuote(gemFarm,0,1),9);
assert.equal(buySeeds(gemFarm,0,1),1);
assert.equal(gemFarm.coins,0);
gemFarm.diamonds.levels.dryGrowth=1;
assert.equal(plant(gemFarm,0,0,gemFarm.epoch),true);
advanceDryGrowth(gemFarm,gemFarm.plots[0],gemFarm.epoch+101);
assert.ok(gemFarm.plots[0].remaining<gemFarm.plots[0].duration);
saveFarm(gemFarm);
assert.equal(loadFarm().diamonds.balance,0);
assert.equal(loadFarm().diamonds.levels.discount,1);
assert.equal(extractionTime(100),5000);
const speedy=newFarm();
speedy.diamonds=newDiamonds();
speedy.diamonds.levels.extract=1;
speedy.harvest[0]=2;
speedy.harvestValue[0]=10;
let rolls=0;
assert.equal(startExtraction(speedy,0,2,speedy.epoch,()=>++rolls>6?0:.5),true);
assert.equal(speedy.extraction.job,null);
assert.equal(speedy.seeds[0],5);
console.log('PASS: one-time diamond sets, discount carry, dry growth, instant extraction and save/reload');
`,context);

vm.runInContext(`
const parked=newFarm();
parked.pausedAt=Date.now()-60000;
parked.coins=20;
spendFarmCoins(parked,5);
saveFarm(parked);
const returnedFarm=loadFarm();
assert.ok(returnedFarm.offset<=-60000);
assert.equal(returnedFarm.pausedAt,undefined);
assert.equal(loadFarm().offset,returnedFarm.offset);
assert.equal(returnedFarm.statistics.coinsSpent,5);
console.log('PASS: inactive save clock and persisted spending');
`,context);

vm.runInContext(`
const gambler=newFarm();
gambler.coins=1000000;
const layout=wheelLayout(gambler,'coins',1000000);
assert.equal(layout.length,10);
assert.ok(Math.abs(total(layout.map(prize=>prize.weight))-100)<1e-9);
assert.equal(layout.filter(prize=>prize.type==='empty')[0].color,layout.filter(prize=>prize.type==='empty')[1].color);
assert.deepEqual(wheelLayout(gambler,'coins',1000000),layout);
const jackpotIndex=layout.findIndex(prize=>prize.type==='jackpot');
const jackpotRoll=(total(layout.slice(0,jackpotIndex).map(prize=>prize.weight))+.005)/100;
assert.equal(spinFortune(gambler,'coins',1000000,()=>jackpotRoll).payout,100000);
assert.equal(wheelAccount(gambler,'coins').bank,0);
gambler.diamonds=newDiamonds();
gambler.diamonds.balance=2;
const diamondLayout=wheelLayout(gambler,'diamonds',1);
assert.equal(diamondLayout.at(-1).locked,true);
const refund=spinFortune(gambler,'diamonds',1,()=>0);
assert.equal(wheelAccount(gambler,'diamonds').carry,refund.prize.amount/5%20);
saveFarm(gambler);
assert.equal(loadFarm().wheels.accounts.diamonds.carry,wheelAccount(gambler,'diamonds').carry);
console.log('PASS: wheel odds, jackpot, locked prizes, fractional diamond returns and save/reload');
`,context);
