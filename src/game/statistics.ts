type FarmStatistics={coinsSpent:number;orbsSpent:number;diamondsSpent:number;materialsFound:number;crystalRolls:number;crystalDrops:number};
function farmStatistics(farm:Farm):FarmStatistics{
  return farm.statistics??={coinsSpent:0,orbsSpent:0,diamondsSpent:0,materialsFound:0,crystalRolls:0,crystalDrops:0};
}
function spendFarmCoins(farm:Farm,amount:number){
  farm.coins-=amount;
  farmStatistics(farm).coinsSpent+=amount;
}
function spendFarmOrbs(farm:Farm,amount:number){
  farm.resources.orbs-=amount;
  farmStatistics(farm).orbsSpent+=amount;
}
