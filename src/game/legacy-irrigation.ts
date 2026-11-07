function irrigationOffer(farm:Farm) {
  const sets=1;
  const work=farm.plots.reduce((sum,plot)=>sum+(plot?growthTime(plot.crop,collectionGrowth(farm,plot.crop)):0),0);
  return {price:Math.max(10,Math.ceil(work/30_000/sets)),duration:300_000*(1+(sets-1)*.1)*(1+farm.resources.irrigation*.25)};
}
function rentIrrigation(farm:Farm,now:number) {
  const offer=irrigationOffer(farm);
  if(!farm.convenience.irrigation||collectionSets(farm)[2]<1||farm.coins<offer.price)return false;
  spendFarmCoins(farm,offer.price);farm.irrigationUntil=Math.max(now,farm.irrigationUntil)+offer.duration;
  farm.automation.irrigation=true;return true;
}
