type GreenhousePot={line:number;ready:number;since:number;next:number;fruit:number;carry:number;items:Record<string,number>};
const greenhousePotCount=3;
const potMaterialBonusHour=3_600_000;
const potMaterialBonus=(pot:GreenhousePot,now:number)=>.05*Math.max(0,Math.min(1,(now-pot.ready)/potMaterialBonusHour));
function potInterval(gr:number){
  return Math.round(30000*6**(-(Math.max(1,Math.min(30,gr))-1)/29));
}
function plantGreenhousePot(farm:Farm,index:number,lineId:number,now:number){
  const line=farm.lines[lineId];
  if(!Number.isInteger(index)||index<0||index>=greenhousePotCount||farm.pots?.[index]||!line||line.archived||line.seeds<1)return false;
  const plot={crop:line.crop,line:lineId,planted:now,ready:null};
  const ready=now+plantGrowthTime(farm,plot);
  const gr=genome(farm,plot).genes.gr;
  const pots=farm.pots??=Array<GreenhousePot|null>(greenhousePotCount).fill(null);
  line.seeds--;
  pots[index]={line:lineId,ready,since:ready,next:ready+potInterval(gr),fruit:0,carry:0,items:{}};
  return true;
}
function tickGreenhousePots(farm:Farm,now:number,random=Math.random){
  let changed=false;
  for(const pot of farm.pots??[]){
    if(!pot||now<pot.next)continue;
    const line=farm.lines[pot.line];
    const crop=line.crop;
    const {genes,powers}=effectiveGenome(farm,{crop,line:pot.line,planted:pot.ready,ready:pot.ready});
    const interval=potInterval(genes.gr);
    const firstCycle=pot.next;
    const cycles=1+Math.floor((now-firstCycle)/interval);
    pot.next+=cycles*interval;
    let expected=genes.ga+(powers.yield??0);
    let reach=1;
    for(let chance=(genes.ga-1)*.01;chance>=1e-6;chance/=2){
      reach*=chance;
      expected+=reach*(1+(powers.head??0)/100);
    }
    expected*=1+(powers.bounty??0)/100;
    expected+=diamondLevel(farm,'fruit')/100;
    const fruit=pot.carry+cycles*expected*15/cropTimes[crop];
    pot.fruit+=Math.floor(fruit);
    pot.carry=fruit%1;
    const chance=harvestMaterialChance(crop);
    const set=cropSets.findIndex(group=>group.crops.includes(crop));
    const rampCycles=Math.min(cycles,Math.max(0,Math.ceil((pot.ready+potMaterialBonusHour-firstCycle)/interval)));
    let setDrops=0,propertyDrops=0;
    for(let i=0;i<rampCycles;i++){
      const rate=chance*(1+potMaterialBonus(pot,firstCycle+i*interval));
      const roll=random();
      if(roll<rate)setDrops++;
      else if(roll<2*rate)propertyDrops++;
    }
    const maxRate=chance*1.05;
    const matureCycles=cycles-rampCycles;
    const matureSets=sampleBinomial(matureCycles,maxRate,random);
    setDrops+=matureSets;
    propertyDrops+=sampleBinomial(matureCycles-matureSets,maxRate/(1-maxRate),random);
    const properties=Object.keys(basePowers[crop]);
    const first=properties.length===1?propertyDrops:sampleBinomial(propertyDrops,.5,random);
    const add=(id:string,count:number)=>{
      if(count)pot.items[id]=(pot.items[id]??0)+duplicateCount(farm,count,random);
    };
    add('set'+set,setDrops);
    properties.forEach((id,index)=>add(propertyMaterialId(id),index===0?first:propertyDrops-first));
    changed=true;
  }
  return changed;
}
function claimGreenhousePot(farm:Farm,index:number,now:number){
  const pot=farm.pots?.[index];
  if(!pot||now<pot.ready)return false;
  const crop=farm.lines[pot.line].crop;
  const plot={crop,line:pot.line,planted:pot.ready,ready:pot.ready};
  const {genes,powers}=effectiveGenome(farm,plot);
  farm.harvest[crop]+=pot.fruit;
  farm.harvestValue[crop]+=pot.fruit*cropPrices[crop]*(1+(powers.sweet??0)/100)*(1+collectionLevel(farm.harvested[crop])/100);
  farm.harvestQuality[crop]+=pot.fruit*((genes.ga-1)/29+(genes.gr-1)/58+(genes.re-1)/58);
  farm.harvested[crop]+=pot.fruit;
  farm.collected+=pot.fruit;
  for(const [id,count] of Object.entries(pot.items))addMaterial(farm,id,count);
  pot.fruit=0;
  pot.items={};
  pot.since=now;
  return true;
}
function removeGreenhousePot(farm:Farm,index:number,now:number){
  const pot=farm.pots?.[index];
  if(!pot)return false;
  const line=farm.lines[pot.line];
  if((line.archived||!line.seeds)&&hybridCount(farm)>=farm.hybridSlots)return false;
  claimGreenhousePot(farm,index,now);
  line.archived=false;
  line.seeds++;
  farm.pots![index]=null;
  return true;
}
