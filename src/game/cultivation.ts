const requiredSize = (crop:number) => crop < 3 ? 1 : crop < 10 ? 2 : 3;
const traitTimeFactor=(crop:number)=>Math.sqrt(cropTimes[crop]/cropTimes[0]);
const traitPrice=(crop:number,level:number)=>Math.ceil(.4*cropPrices[crop]*traitTimeFactor(crop)*(1+level/10)**2.2);
const traitOrbPrice=(crop:number,level:number)=>Math.ceil(.15*baseOrbYield(crop)*traitTimeFactor(crop)*(Math.max(0,level-4)/5)**1.6);
function buyTrait(farm:Farm,crop:number,trait:Trait) {
  if (!crops[crop] || !unlocked(farm,crop)) return false;
  const level = farm.levels[crop][trait];
  const price=traitPrice(crop,level),orbs=traitOrbPrice(crop,level);
  if (barrierClosed(farm,crop,trait) || level >= traitMax || farm.coins < price || farm.resources.orbs<orbs) return false;
  spendFarmCoins(farm,price);spendFarmOrbs(farm,orbs);
  farm.levels[crop][trait]++;
  return true;
}
const growthTime = (crop:number,level:number) => Math.max(1,Math.round(1000*crops[crop].seconds*.975**level));
function harvestAmount(level:number,random = Math.random,bonus=0) {
  let amount = 1;
  for (let chance = level*.01; chance > 0 && random() < Math.min(1,chance); chance /= 2) amount+=1+Math.floor(bonus)+(random()<bonus%1?1:0);
  return amount;
}
const luckMax = Number.MAX_SAFE_INTEGER;
const luckPrice = (level:number) => Math.ceil(25*(level+1)**2.2);
const unlocked = (farm:Farm,crop:number) => farm.collection[crop]>0;
function collectionSets(farm:Farm) {
  return cropSets.map(set=>Math.min(...set.crops.map(i=>farm.harvested[i])));
}
const collectionLevel = (count:number) => count<10?0:Math.floor(Math.log2(count/10))+1;
const nextCollectionAt = (count:number) => 10*2**collectionLevel(count);
function collectionGrowth(farm:Farm,crop:number) {
  return farm.levels[crop].growth;
}
function growthMultiplier(farm:Farm) {return 1;}
