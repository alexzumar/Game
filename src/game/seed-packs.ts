type DiscoveryUpgrade = 'speed'|'slots'|'amount';
const discoveryLimit = (id:DiscoveryUpgrade) => id==='slots'?2:id==='speed'?20:Number.MAX_SAFE_INTEGER;
const discoveryUpgradePrice = (farm:Farm,id:DiscoveryUpgrade) => id==='slots'?25*(farm.discoveryUp.slots+1):5+farm.discoveryUp[id];
function buyDiscoveryUpgrade(farm:Farm,id:DiscoveryUpgrade) {
  const price=discoveryUpgradePrice(farm,id);
  if(farm.discoveryUp[id]>=discoveryLimit(id)||farm.coins<price)return false;
  spendFarmCoins(farm,price);farm.discoveryUp[id]++;return true;
}
function finishDiscovery(farm:Farm) {
  for(const item of farm.pendingDiscovery)farm.collection[item.crop]+=item.amount;
  farm.pendingDiscovery=[];
}
const discoveryPrice = 5;
function discoveryOdds() {return basePackOdds();}
function discover(farm:Farm) {
  const price=farm.discoveries===0?0:discoveryPrice;
  if(farm.coins<price || farm.pendingDiscovery.length) return [];
  const bonus=farm.discoveryUp.amount*.05;
  const results=Array.from({length:1+farm.discoveryUp.slots},()=>({
    crop:roll(discoveryOdds()),amount:1+Math.floor(bonus)+(Math.random()<bonus%1?1:0)
  }));
  spendFarmCoins(farm,price);farm.discoveries++;
  farm.pendingDiscovery=results;
  return results;
}
function packOdds(farm:Farm,pack:number,luck=farm.luck) {return openingOdds(farm,pack,luck);}
function buyLuck(farm:Farm) {
  const price = luckPrice(farm.luck);
  if (farm.luck >= luckMax || farm.coins < price) return false;
  spendFarmCoins(farm,price);
  farm.luck++;
  return true;
}
function roll(odds:number[],random = Math.random) {
  let value = random()*100;
  let last = 0;
  for (const [i,chance] of odds.entries()) {
    if (!chance) continue;
    last = i;
    value -= chance;
    if (value < 0) return i;
  }
  return last;
}
const seedPacks = [
  {name:'Обычный',icon:'⬜',slots:1,price:20,size:1,boost:1},
  {name:'Редкий',icon:'🟦',slots:1,price:500,size:1,boost:1},
  {name:'Эпический',icon:'🟪',slots:1,price:10000,size:1,boost:1},
  {name:'Легендарный',icon:'🟨',slots:1,price:50000,size:1,boost:1},
];
