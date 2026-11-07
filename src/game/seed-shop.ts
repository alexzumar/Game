const seedPrice = (crop:number) => cropPrices[crop]*2;
function discountedSeedUnit(farm:Farm,crop:number){
  return seedPrice(crop)*(1-.5*(1-.9**diamondLevel(farm,'discount')));
}
function seedPurchaseQuote(farm:Farm,crop:number,count:number){
  return Math.ceil(discountedSeedUnit(farm,crop)*count-(farm.diamonds?.discountCarry??0)-1e-9);
}
function buySeed(farm:Farm,crop:number) {return buySeeds(farm,crop,1)>0;}
function buySeeds(farm:Farm,crop:number,count:number,partial=false){
 if(!crops[crop]||!unlocked(farm,crop)||!Number.isSafeInteger(count)||count<1)return 0;
 const available=Math.min(Math.floor((farm.coins+(farm.diamonds?.discountCarry??0)+1e-9)/discountedSeedUnit(farm,crop)),Number.MAX_SAFE_INTEGER-farm.seeds[crop]);
 if(!partial&&count>available)return 0;
 const amount=Math.min(count,available);if(amount<1)return 0;
 const price=seedPurchaseQuote(farm,crop,amount);
 if(price>farm.coins)return 0;
 const state=farm.diamonds??=newDiamonds();
 state.discountCarry=Math.max(0,Math.min(1,price-discountedSeedUnit(farm,crop)*amount+state.discountCarry));
 spendFarmCoins(farm,price);farm.seeds[crop]+=amount;return amount;
}
// Legacy bounds retained only to validate and migrate old saves.
const cascadeMax=100;
const packResultLimit=64;
function openPack(farm:Farm,index:number,count=1,random=Math.random) {return beginPackOpening(farm,index,count,random);}
