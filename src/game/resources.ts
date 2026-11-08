type Resources={barrierVersion:2;barriers:Record<string,number>;irrigation:number;orbs:number;orbLuck:number;items:Record<string,number>;found:Record<string,boolean>;duplication:number};
const newResources=():Resources=>({barrierVersion:2,barriers:{},irrigation:0,orbs:0,orbLuck:0,items:{},found:{},duplication:0});
// Exact geometric sampling for sparse results, bounded-cost normal approximation for large batches.
function extractorConcentrateChance(crop:number){
  return cropSets[0].crops.includes(crop)?.02:.001;
}
function sampleBinomial(n:number,p:number,random=Math.random):number{
 n=Math.max(0,Math.floor(n));if(p<=0||!n)return 0;if(p>=1)return n;
 if(p>.5)return n-sampleBinomial(n,1-p,random);
 if(n*p<30){let count=0,pos=-1;const log=Math.log1p(-p);while(true){pos+=1+Math.floor(Math.log(Math.max(Number.MIN_VALUE,1-random()))/log);if(pos>=n)return count;count++;}}
 const u=Math.max(Number.MIN_VALUE,random()),v=random();
 return Math.max(0,Math.min(n,Math.round(n*p+Math.sqrt(n*p*(1-p))*Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v))));
}
function addMaterial(farm:Farm,id:string,count:number,earned=true){
 if(earned&&count>0)farmStatistics(farm).materialsFound+=count;
 if(count<=0)return;farm.resources.items[id]=(farm.resources.items[id]??0)+count;farm.resources.found[id]=true;
}
function duplicateCount(farm:Farm,count:number,random=Math.random){
 const chance=farm.resources.duplication?1+(farm.resources.duplication-1)*.1:0;
 return count*(1+Math.floor(chance/100))+sampleBinomial(count,(chance%100)/100,random);
}
const harvestMaterialChance=(crop:number)=>[.01,.015,.02,.05][cropTiers[crop]];
const orbMaximums=[1,4,16,64];
const orbLuckMax=200;
function orbMaximumChance(tier:number,level:number){
 const base=tier===0?.8:.25;
 return 1-(1-base)*(1-level/orbLuckMax)**2;
}
const baseOrbYield=(crop:number)=>(1-2*harvestMaterialChance(crop))*orbMaximums[cropTiers[crop]]*(cropTiers[crop]===0?.8:.6875);
const orbLuckPrice=(level:number)=>Math.ceil(20*(level+1)**2.15);
function buyOrbLuck(farm:Farm){
 const level=farm.resources.orbLuck,price=orbLuckPrice(level);
 if(level>=orbLuckMax||farm.resources.orbs<price)return false;
 spendFarmOrbs(farm,price);
 farm.resources.orbLuck++;
 return true;
}
function rollHarvestOrbs(count:number,tier:number,level:number,random:()=>number){
 const maximum=orbMaximums[tier];
 const full=sampleBinomial(count,orbMaximumChance(tier,level),random);
 if(tier===0)return full;
 // Among the remaining rolls, the original weights for zero, half and three quarters are 10:20:45.
 const threeQuarters=sampleBinomial(count-full,45/75,random);
 const half=sampleBinomial(count-full-threeQuarters,20/30,random);
 return maximum*full+maximum/4*(3*threeQuarters+2*half);
}
const harvestDuplicationChance=(crop:number)=>Math.min(1,cropTimes[crop]/120*.0015);
function awardHarvestLoot(farm:Farm,crop:number,count:number,random=Math.random){
 const tier=cropTiers[crop],chance=harvestMaterialChance(crop);
 const setCount=sampleBinomial(count,chance,random);
 const propertyCount=sampleBinomial(count-setCount,chance/(1-chance),random);
 const orbs=rollHarvestOrbs(count-setCount-propertyCount,tier,farm.resources.orbLuck,random);
 const bonus=Math.min(orbs,farm.wheels?.orbBoost??0);
 if(farm.wheels)farm.wheels.orbBoost-=bonus;
 farm.resources.orbs+=orbs+bonus;
 const group=cropSets.findIndex(set=>set.crops.includes(crop));
 addMaterial(farm,'set'+group,duplicateCount(farm,setCount,random));
 const properties=Object.keys(basePowers[crop]);
 if(properties.length===1)addMaterial(farm,'property:'+properties[0],duplicateCount(farm,propertyCount,random));
 else{const first=sampleBinomial(propertyCount,.5,random);addMaterial(farm,'property:'+properties[0],duplicateCount(farm,first,random));addMaterial(farm,'property:'+properties[1],duplicateCount(farm,propertyCount-first,random));}
 addMaterial(farm,'duplication',sampleBinomial(count,harvestDuplicationChance(crop),random));
}
const duplicationPrice=(level:number)=>Math.ceil((level+1)**1.25);
function buyDuplication(farm:Farm){const price=duplicationPrice(farm.resources.duplication);if((farm.resources.items.duplication??0)<price)return false;farm.resources.items.duplication-=price;farm.resources.duplication++;return true;}
function inheritEnhancements(_parents:Genome[],_traits:string[]):Record<string,number>{return {};}
function canTransferEnhancement(farm:Farm,source:number,target:number,id:string){
 const from=farm.lines[source],to=farm.lines[target];
 return source!==target&&!!from&&!!to&&!from.archived&&!to.archived&&from.seeds>0&&to.seeds>0&&from.traits.includes(id)&&to.traits.includes(id)&&(to.powers?.[id]??1)>0&&
 (from.enhancements?.[id]??0)>(to.enhancements?.[id]??0)&&![...farm.plots,...(farm.greenhouse?.plots??[])].some(plot=>plot?.line===source||plot?.line===target);
}
function transferEnhancement(farm:Farm,source:number,target:number,id:string){
 if(!canTransferEnhancement(farm,source,target,id))return false;
 const from=farm.lines[source],to=farm.lines[target],old=to.enhancements?.[id]??0;
 from.enhancements??={};to.enhancements??={};to.enhancements[id]=from.enhancements[id];from.enhancements[id]=old;return true;
}
function enhancementChance(level:number){return Math.max(.45,.99-level*.01);}
function enhanceProperty(farm:Farm,index:number,id:string,random=Math.random):'success'|'failure'|'shielded'|null{
 const line=farm.lines[index];if(!line||!line.traits.includes(id)||line.archived)return null;
 const level=line.enhancements?.[id]??0,key=propertyMaterialId(id);
 if(level>=100||(line.powers?.[id]??1)<=0||(farm.resources.items[key]??0)<1)return null;
 farm.resources.items[key]--;line.enhancements??={};
 const success=random()<enhancementChance(level);
 const shield=enhancementShieldChance(diamondLevel(farm,'enhancementShield'));
 if(!success&&level>0&&shield>0&&random()<shield)return 'shielded';
 line.enhancements[id]=success?level+1:Math.max(0,level-1);
 return success?'success':'failure';
}

const barrierLevel=(farm:Farm,crop:number,id:Trait)=>farm.resources.barriers[crop+':'+id]??0;
const barrierThreshold=(cleared:number)=>(cleared+1)*10;
const barrierClosed=(farm:Farm,crop:number,id:Trait)=>farm.levels[crop][id]>=barrierThreshold(barrierLevel(farm,crop,id));
function barrierPrice(farm:Farm,crop:number,id:Trait){
 const cleared=barrierLevel(farm,crop,id);
 if(cleared===0)return 1;
 const propertyRate=harvestMaterialChance(crop)/Object.keys(basePowers[crop]).length;
 const relativeDropRate=propertyRate/harvestMaterialChance(0)*cropTimes[0]/cropTimes[crop];
 return Math.ceil((cleared+1)**1.25*Math.sqrt(relativeDropRate));
}
function barrierMaterial(crop:number,id:Trait){
 const properties=Object.keys(basePowers[crop]);
 const property=id==='moisture'&&properties.length>1?properties[1]:properties[0];
 return materialsBySaveKey.get(propertyMaterialId(property))!;
}
function unlockBarrier(farm:Farm,crop:number,id:Trait){
 if(!unlocked(farm,crop)||!barrierClosed(farm,crop,id))return false;
 const price=barrierPrice(farm,crop,id),material=barrierMaterial(crop,id).id;
 if((farm.resources.items[material]??0)<price)return false;
 farm.resources.items[material]-=price;
 farm.resources.barriers[crop+':'+id]=barrierLevel(farm,crop,id)+1;
 return true;
}
function upgradeIrrigation(farm:Farm){
 const price=farm.resources.irrigation+1;if(!farm.convenience.irrigation||(farm.resources.items.set3??0)<price)return false;
 farm.resources.items.set3-=price;farm.resources.irrigation++;return true;
}

const propertyMaterialId=(id:string)=>'property:'+(id==='yield'?'bounty':id==='cut'?'sprout':id);
