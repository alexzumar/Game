const salePrice = 1;
const basketSaleValue=(farm:Farm)=>farm.harvestValue.reduce((sum,value)=>sum+Math.ceil(value),0);
function sellBasket(farm:Farm,receipt:number[]) {
  if (receipt.length !== farm.harvest.length || !receipt.every((count,i) => count === farm.harvest[i])) return 0;
  const amount = total(receipt);
  farm.coins += basketSaleValue(farm)+receipt.reduce((sum,count,crop)=>sum+knotSaleBonus(farm,crop,count),0);farm.harvestValue.fill(0);farm.harvestQuality.fill(0);
  farm.harvest.fill(0);
  return amount;
}

function produceValue(farm:Farm,crop:number,count:number){
  return farm.harvestValue[crop]*count/farm.harvest[crop];
}
function knotSaleBonus(farm:Farm,crop:number,count:number,random=Math.random){
  const chance=knotEffect(farm,2,1);
  if(!chance||!count)return 0;
  return Math.floor(produceValue(farm,crop,1)*.5*sampleBinomial(Math.floor(count),chance,random));
}
function produceSalePrice(farm:Farm,crop:number,count:number){
  const value=produceValue(farm,crop,count);
  return count===farm.harvest[crop]?Math.ceil(value):Math.floor(value);
}
function removeProduce(farm:Farm,crop:number,count:number){
  if(count<1||count>farm.harvest[crop])return 0;
  const value=produceValue(farm,crop,count);
  farm.harvestQuality[crop]*=(1-count/farm.harvest[crop]);
  farm.harvest[crop]-=count;farm.harvestValue[crop]=Math.max(0,farm.harvestValue[crop]-value);
  return value;
}
