type PackEntry={crop:number;first:boolean};
type PackOpening={pack:number;paid:number;entries:PackEntry[]};
type PackProgress={version:1;speed:number;slots:number;refund:number;luckGate:number;refundGate:boolean;refundUnits:number;pending:PackOpening|null};
const newPackProgress=():PackProgress=>({version:1,speed:0,slots:0,refund:0,luckGate:0,refundGate:false,refundUnits:0,pending:null});
function basePackOdds(){
 const inverse=crops.map((_,i)=>cropTiers[i]===0?1/cropPrices[i]:0),sum=total(inverse);
 const tierCounts=[0,0,0,0];
 for(const tier of cropTiers)tierCounts[tier]++;
 return crops.map((crop,i)=>crop.tier===0?90*inverse[i]/sum:[90,8,1.6,.4][crop.tier]/tierCounts[crop.tier]);
}
const packTierOdds=[
 [99.7975,.2,.002,.0005],
 [74.98995,25,.01,.00005],
 [56.995,8,35,.005],
 [84,8,4,4]
];
const legendaryLuckLimits=[5,6,8];
function openingOdds(farm:Farm,pack:number,luck=farm.luck){
 if(!seedPacks[pack])return crops.map(()=>0);
 const effectiveLuck=Math.max(0,luck+knotEffect(farm,0,0));
 const base=basePackOdds(),tier=pack,t=effectiveLuck/(effectiveLuck+100);
 const starts=packTierOdds[pack];
 const start=starts[tier],limit=[100-12e-7,80,50,legendaryLuckLimits[farm.packProgress.luckGate]][tier];
 const members=base.filter((_,i)=>cropTiers[i]===tier);
 const group=start+(limit-start)*t,baseGroup=total(members);
 return base.map((value,i)=>{
  const rarity=cropTiers[i];
  if(rarity===tier)return group*((1-t)*value/baseGroup+t/members.length);
  const rarityTotal=total(base.filter((_,crop)=>cropTiers[crop]===rarity));
  return (100-group)*starts[rarity]/(100-start)*value/rarityTotal;
 });
}
const packSlotLimit=(farm:Farm)=>1+farm.packProgress.slots;
function packOpeningPrice(pack:number,count:number){return Math.ceil(seedPacks[pack].price*count*(count>1?.75:1));}
function packOpeningCost(pack:number,count:number){
 return {coins:packOpeningPrice(pack,count),orbs:seedPacks[pack].orbs*count,items:{}};
}
const packOpeningTime=(farm:Farm)=>Math.max(500,Math.round(2800/1.06**farm.packProgress.speed));
const packRefundRate=(farm:Farm)=>5+5*farm.packProgress.refund;
function beginPackOpening(farm:Farm,index:number,count:number,random=Math.random){
 if(!seedPacks[index]||farm.packProgress.pending||!Number.isInteger(count)||count<1||count>packSlotLimit(farm))return [];
 const cost=packOpeningCost(index,count);
 if(!payPackCost(farm,{...cost,condition:true}))return [];
 const odds=openingOdds(farm,index),known=farm.collection.map(Boolean);
 const entries=Array.from({length:count},()=>{const crop=roll(odds,random),first=!known[crop];known[crop]=true;return {crop,first};});
 farm.packProgress.pending={pack:index,paid:cost.coins,entries};farm.opened++;farm.lastPack=entries.map(item=>item.crop);return [...farm.lastPack];
}
function finishPackOpening(farm:Farm,random=Math.random){
 const pending=farm.packProgress.pending;if(!pending)return null;
 let units=farm.packProgress.refundUnits,newKinds=0;
 const bonusSeeds:Record<number,number>={};
 for(const entry of pending.entries){
  if(entry.first){farm.collection[entry.crop]=Math.max(1,farm.collection[entry.crop]);farm.seeds[entry.crop]++;newKinds++;}
  else{const rate=cropTiers[entry.crop]===pending.pack?packRefundRate(farm):5;units+=pending.paid*rate*(60/pending.entries.length);
   const chance=knotEffect(farm,3,1);if(chance&&random()<chance){
    farm.seeds[entry.crop]+=2;
    bonusSeeds[entry.crop]=(bonusSeeds[entry.crop]??0)+2;
   }}
 }
 const returned=Math.floor(units/6000);farm.packProgress.refundUnits=units%6000;
 farm.coins+=returned;farm.packProgress.pending=null;
 return {...pending,returned,newKinds,bonusSeeds};
}
type PackUpgrade='speed'|'slots'|'refund';
function packUpgradeOffer(farm:Farm,id:PackUpgrade){
 const level=farm.packProgress[id];
 if(id==='speed')return {coins:Math.ceil(10*(level+1)**2.25),orbs:0,items:{} as Record<string,number>,condition:true,max:level>=35};
 if(id==='refund')return {coins:100*(level+1)**2,orbs:0,items:(level>=3?{'set2':level-2}:{}) as Record<string,number>,condition:level<3||farm.packProgress.refundGate,max:level>=14};
 const offers=[{coins:200,orbs:0,items:{}},{coins:5000,orbs:0,items:{set1:2}},{coins:250000,orbs:0,items:{set2:10}},{coins:25000000,orbs:250000,items:{set3:100}}];
 return {...offers[Math.min(level,3)],items:offers[Math.min(level,3)].items as Record<string,number>,condition:level<3||(farm.size>=8&&farm.collection.every(Boolean)),max:level>=4};
}
function payPackCost(farm:Farm,offer:{coins:number;orbs:number;items:Record<string,number>;condition:boolean;max?:boolean}){
 if(offer.max||!offer.condition||farm.coins<offer.coins||farm.resources.orbs<offer.orbs||Object.entries(offer.items).some(([id,n])=>(farm.resources.items[id]??0)<n))return false;
 spendFarmCoins(farm,offer.coins);spendFarmOrbs(farm,offer.orbs);for(const [id,n] of Object.entries(offer.items))farm.resources.items[id]-=n;return true;
}
function buyPackUpgrade(farm:Farm,id:PackUpgrade){if(!payPackCost(farm,packUpgradeOffer(farm,id)))return false;farm.packProgress[id]++;return true;}
function packGateOffer(farm:Farm,kind:'luck'|'refund'){
 if(kind==='refund')return {coins:0,orbs:100,items:{set1:3},condition:farm.packProgress.refund>=3&&!farm.packProgress.refundGate};
 const stage=farm.packProgress.luckGate;
 const legendaryKinds=farm.collection.filter((count,index)=>count>0&&cropTiers[index]===3).length;
 return stage===0?{coins:0,orbs:250,items:{set1:3},condition:legendaryKinds>=1}:
  {coins:0,orbs:2500,items:{set3:15},condition:stage===1&&legendaryKinds>=2};
}
function unlockPackGate(farm:Farm,kind:'luck'|'refund'){
 if(kind==='refund'&&farm.packProgress.refundGate||kind==='luck'&&farm.packProgress.luckGate>=2)return false;
 if(!payPackCost(farm,packGateOffer(farm,kind)))return false;
 if(kind==='refund')farm.packProgress.refundGate=true;else farm.packProgress.luckGate++;return true;
}
function needsStarterRescue(farm:Farm){return farm.coins<seedPurchaseQuote(farm,0,1)&&!farm.seeds.some(Boolean)&&!farm.harvest.some(Boolean)&&[...farm.plots,...(farm.greenhouse?.plots??[])].every(plot=>!plot)&&!farm.lines.some(line=>!line.archived&&line.seeds>0)&&!extractionJobs(farm.extraction).some(Boolean)&&!farm.packProgress.pending;}
function rescueStarterSeed(farm:Farm){if(!needsStarterRescue(farm))return false;farm.seeds[0]=1;farm.collection[0]=Math.max(1,farm.collection[0]);return true;}
function migratePackProgress(s:Farm){
 if(!s.packProgress){
  s.packProgress=newPackProgress();s.packProgress.speed=Math.min(60,s.discoveryUp?.speed??0);s.packProgress.slots=Math.min(4,s.discoveryUp?.slots??0);
  s.coins+=2*s.cascade*s.cascade+6*s.cascade;s.cascade=0;
  const retiredAmount=s.discoveryUp?.amount??0;s.coins+=5*retiredAmount+retiredAmount*(retiredAmount-1)/2;s.discoveryUp.amount=0;
  s.harvestValue=s.harvestValue.map((value,i)=>value*cropPrices[i]);
  if(s.extraction.job){s.extraction.job.unitValue??=cropPrices[s.extraction.job.crop];}
 }
 const p=s.packProgress;
 const int=(n:unknown,min:number,max:number)=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=min&&n<=max;
 if(p.version!==1||!int(p.speed,0,60)||!int(p.slots,0,4)||!int(p.refund,0,14)||!int(p.luckGate,0,2)||!int(p.refundUnits,0,5999)||typeof p.refundGate!=='boolean')throw new Error('Повреждены улучшения мешков');
 if(p.pending){const job=p.pending;if(!int(job.pack,0,3)||!int(job.paid,1,Number.MAX_SAFE_INTEGER)||!Array.isArray(job.entries)||job.entries.length<1||job.entries.length>5||!job.entries.every(item=>int(item.crop,0,crops.length-1)&&typeof item.first==='boolean'))throw new Error('Повреждено открытие мешка');}
}
