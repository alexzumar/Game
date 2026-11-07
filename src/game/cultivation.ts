const requiredSize = (crop:number) => crop < 3 ? 1 : crop < 10 ? 2 : 3;
const traitPrice = (level:number) => Math.ceil(5*(level+1)**2);
const traitOrbPrice = (level:number) => Math.ceil(Math.max(0,level-9)**1.15);
function buyTrait(farm:Farm,crop:number,trait:Trait) {
  if (!crops[crop] || !unlocked(farm,crop)) return false;
  const level = farm.levels[crop][trait];
  const price = traitPrice(level),orbs=traitOrbPrice(level);
  if (barrierClosed(farm,crop,trait) || level >= traitMax || farm.coins < price || farm.resources.orbs<orbs) return false;
  spendFarmCoins(farm,price);spendFarmOrbs(farm,orbs);
  farm.levels[crop][trait]++;
  return true;
}
const growthTime = (crop:number,level:number) => Math.max(1,Math.round(1000*crops[crop].seconds/1.01**Math.min(100000,level)));
const moistureTime = (level:number,crop=0) => Math.round(cropTimes[crop]*500*(1+level*.05));
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
