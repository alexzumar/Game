function plant(farm:Farm, index:number, crop:number, now:number,line?:number,area:PlotArea=farm) {
  if (!unlocked(farm,crop) || index < 0 || index >= area.plots.length || area.plots[index] || !(line===undefined?farm.seeds[crop]>0:farm.lines[line]?.seeds>0)) return false;
  if(line!==undefined){const seedLine=farm.lines[line];if(!seedLine||seedLine.archived||seedLine.crop!==crop||seedLine.seeds<1)return false;seedLine.seeds--;}
  else farm.seeds[crop]--;
  area.rot[index]=null;
  area.plots[index] = {crop, planted:now, ready:null,...(line===undefined?{}:{line})};
  const planted=area.plots[index]!;
  if(Math.random()<(effectiveGenome(farm,planted).powers.sprout??0)/100){planted.duration=plantGrowthTime(farm,planted);planted.remaining=Math.round(planted.duration*.8);}
  irrigate(farm,planted,now);
  return true;
}
function wateringDuration(farm:Farm,plot:Plant,level=plot.line===undefined?farm.levels[plot.crop].moisture:0){
  const growth=plot.duration??plantGrowthTime(farm,plot);
  const moisturePower=effectiveGenome(farm,plot).powers.moisture??0;
  return Math.max(1,Math.round(growth*.25*(1+level*.05)*(1+moisturePower/100)));
}
function water(farm:Farm,plot:Plant,now:number,until=now+wateringDuration(farm,plot)) {
  advanceDryGrowth(farm,plot,now);
  if (plot.ready !== null) {
    if (plot.ready <= now || plot.wetUntil === undefined) return false;
    if (until <= plot.wetUntil) return false;
    plot.watered = now;
    plot.wetUntil = until;
    return true;
  }
  plot.duration ??= plantGrowthTime(farm,plot);
  plot.abilityThrough=now;
  plot.boostCheck??=now+30000;
  plot.watered = now;
  plot.ready = now+Math.ceil(plot.remaining ?? plot.duration);
  delete plot.remaining;
  plot.watered = now;
  plot.wetUntil = until;
  return true;
}
function buyConvenience(farm:Farm,id:Convenience) {
  const option = conveniences.find(item => item.id === id);
  if (!option || farm.convenience[id] || farm.coins < option.price ||
      id==="irrigation" && collectionSets(farm)[2]<1) return false;
  const material=id==='irrigation'?5:id==='replant'?1:0;
  if((farm.resources.items.set2??0)<material)return false;
  if(material)farm.resources.items.set2-=material;
  spendFarmCoins(farm,option.price);
  farm.convenience[id] = true;
  return true;
}
function sowAll(farm:Farm,crop:number,now:number) {
  if (!farm.convenience.sowAll) return 0;
  let count = 0;
  for (let index=0;index<farm.plots.length && farm.seeds[crop]>0;index++)
    if (plant(farm,index,crop,now)) count++;
  return count;
}
function waterAll(farm:Farm,now:number) {
  if (!farm.convenience.waterAll) return 0;
  let count = 0;
  for (const plot of farm.plots) if (plot && water(farm,plot,now)) count++;
  return count;
}
function remainingGrowth(plot:Plant,now:number) {
  return plot.ready === null ? plot.remaining : Math.max(0,plot.ready-now);
}
function collect(farm:Farm,index:number,now:number,random=Math.random,area:PlotArea=farm) {
  const plot = area.plots[index];
  if (!plot || plot.mystery || plot.ready === null || plot.ready > now || (plot.wetUntil !== undefined && plot.wetUntil < plot.ready)) return 0;
  const powers=effectiveGenome(farm,plot).powers;
  const amount = (plot.line===undefined?harvestAmount(farm.levels[plot.crop].yield+farm.collection.filter(value=>value>0).length-1,random,(powers.head??0)/100):genome(farm,plot).genes.ga+harvestAmount(genome(farm,plot).genes.ga-1,random,(powers.head??0)/100)-1);
  const baseAmount=amount+lineTrait(farm,plot,"yield");
  const finalAmount=baseAmount*(random()<(powers.bounty??0)/100?2:1)+diamondBonusCount(diamondLevel(farm,"fruit")/100,random);
  if(plot.line!==undefined){
    const line=farm.lines[plot.line];
    if((line.archived||line.seeds===0)&&hybridCount(farm)>=farm.hybridSlots)return 0;
    line.archived=false;line.seeds+=1;
  }
  if(plot.line===undefined)awardHarvestLoot(farm,plot.crop,Math.floor(finalAmount),random);
  farm.harvested[plot.crop]+=finalAmount;
  farm.harvest[plot.crop]+=finalAmount;
  const harvestIncome=finalAmount*cropPrices[plot.crop]*(plot.ripening?.value??1)*(1+(powers.sweet??0)/100)*(1+collectionLevel(farm.harvested[plot.crop])/100);
  farm.harvestValue[plot.crop]+=harvestIncome;
  awardDiamonds(farm,plot.crop,harvestIncome,random);
  if(plot.line===undefined&&diamondLevel(farm,'seedReturn')&&random()<diamondCurve(diamondLevel(farm,'seedReturn')))farm.seeds[plot.crop]++;
  if(plot.line!==undefined){const genes=genome(farm,plot).genes;farm.harvestQuality[plot.crop]+=finalAmount*((genes.ga-1)/29+(genes.gr-1)/58+(genes.re-1)/58);}
  if(random()<(powers.pod??0)/100){if(plot.line===undefined)farm.seeds[plot.crop]+=2;else farm.lines[plot.line].seeds+=2;}
  farm.collected += finalAmount;
  area.plots[index] = null;
  const renew=random()<(powers.renew??0)/100;
  const secondCut=random()<(powers.cut??0)/100;
  if(renew||secondCut||random()<Math.min(1,(powers.regrow??0)/100)) {
    if(plot.line!==undefined)farm.lines[plot.line].seeds--;
    area.plots[index]={crop:plot.crop,planted:now,ready:null,...(plot.line===undefined?{}:{line:plot.line})};
    const planted=area.plots[index]!;
    if(renew){planted.duration=plantGrowthTime(farm,planted);planted.remaining=Math.round(planted.duration*.5);}
    irrigate(farm,planted,now);
  } else if(farm.convenience.replant && farm.automation.replant && farm.replantCrop===plot.crop) plant(farm,index,plot.crop,now,plot.line,area);
  return finalAmount;
}
const maxSize = 8;
function resize(farm:Farm,next:number) {
  if (!Number.isInteger(next) || next < 1 || next > maxSize || next === farm.size) return false;
  const plots = Array<Plant|null>(next ** 2).fill(null);
  farm.plots.forEach((plot,i) => {
    if (!plot) return;
    const row = Math.floor(i/farm.size);
    const column = i%farm.size;
    if (row < next && column < next) plots[row*next+column] = plot;
    else if(!plot.mystery){if(plot.line!==undefined)farm.lines[plot.line].seeds++;else farm.seeds[plot.crop]++;}
  });
  const rot=Array<RotRecord|null>(next**2).fill(null);
  farm.rot.forEach((record,i)=>{const row=Math.floor(i/farm.size),column=i%farm.size;if(row<next&&column<next)rot[row*next+column]=record;});
  farm.rot=rot;
  farm.size = next;
  farm.plots = plots;
  return true;
}
const fieldOrbPrices = [1,15,50,150,400,1000,2500];
const expansionPrice = (farm:Farm) => fieldOrbPrices[farm.size-1] ?? Infinity;
function expand(farm:Farm) {
  const price = expansionPrice(farm);
  if (farm.resources.orbs < price || !resize(farm,farm.size+1)) return false;
  spendFarmOrbs(farm,price);
  return true;
}
