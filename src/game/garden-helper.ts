const gardenHelperActions=['sow','water','collect'] as const;
type GardenHelperAction=typeof gardenHelperActions[number];
type GardenHelper={cycleRevision:2;crop:number|null;enabled:boolean;actions?:Record<GardenHelperAction,boolean>;levels:Record<GardenHelperAction,number>;next:Record<GardenHelperAction,number>};
const helperActionEnabled=(helper:GardenHelper,action:GardenHelperAction)=>
  (action!=='sow'||helper.crop!==null)&&(helper.actions?.[action]??true);
const gardenHelperCycles=(value:number)=>({sow:value,water:value,collect:value});
const newGardenHelper=():GardenHelper=>({cycleRevision:2,crop:null,enabled:false,levels:gardenHelperCycles(0),next:gardenHelperCycles(0)});
const gardenHelperIntervals=[10000,8500,7000,5800,4800,4000,3200,2500,2000,1600,1200,950,700,530,400,300,200,165,140,120,100];
const previousGardenHelperLevels=[0,2,5,8,10,12,14,16,20];
const gardenHelperMax=gardenHelperIntervals.length-1;
const gardenHelperUnlocked=(farm:Farm)=>farm.size>=2&&farm.collected>=4&&farm.extraction.processed>=1;
const gardenHelperRankTotal=(farm:Farm)=>(farm.knotRanks??[]).flat().reduce((sum,rank)=>sum+rank,0);
function gardenHelperUpgrade(farm:Farm,action:GardenHelperAction){
  const level=farm.gardenHelper?.levels[action]??0;
  const starterCosts=[4,9,18];
  if(level<starterCosts.length)return {ranks:0,cost:starterCosts[level],id:null};
  return level<gardenHelperMax?{
    ranks:Math.min(40,5+3*(level-starterCosts.length)),
    cost:Math.ceil((level-starterCosts.length+1)**1.4),
    id:knotMaterials[gardenHelperActions.indexOf(action)][0]
  }:null;
}
function gardenHelperUpgradeBalance(farm:Farm,price:NonNullable<ReturnType<typeof gardenHelperUpgrade>>){
  return price.id===null?farm.resources.orbs:(farm.resources.items[price.id]??0);
}
function buyGardenHelperUpgrade(farm:Farm,action:GardenHelperAction){
  const price=gardenHelperUpgrade(farm,action);
  if(!gardenHelperUnlocked(farm)||!price||gardenHelperRankTotal(farm)<price.ranks||
    gardenHelperUpgradeBalance(farm,price)<price.cost)return false;
  if(price.id===null)spendFarmOrbs(farm,price.cost);
  else farm.resources.items[price.id]-=price.cost;
  const helper=farm.gardenHelper??=newGardenHelper();
  helper.levels[action]++;
  helper.next[action]=0;
  return true;
}
function runGardenHelper(farm:Farm,now:number,harvest=collect,onCare?:(action:'sow'|'water',index:number,crop:number)=>void){
  const helper=farm.gardenHelper;
  if(!helper?.enabled||!gardenHelperUnlocked(farm)||helper.crop!==null&&!unlocked(farm,helper.crop))return false;
  const crop=helper.crop;
  const ownPlot=(plot:Plant|null)=>!!plot&&!plot.mystery&&(crop===null||plot.crop===crop&&plot.line===undefined);
  let changed=false;
  if(helperActionEnabled(helper,'collect')&&now>=helper.next.collect){
    let index=-1,oldest=Infinity;
    for(const [i,plot] of farm.plots.entries()){
      if(!plot||!ownPlot(plot)||plot.ready===null||plot.ready>now||(plot.wetUntil??Infinity)<plot.ready||plot.ready>=oldest)continue;
      const line=plot.line===undefined?undefined:farm.lines[plot.line];
      if(line&&(line.archived||line.seeds===0)&&hybridCount(farm)>=farm.hybridSlots)continue;
      index=i;
      oldest=plot.ready;
    }
    if(index>=0&&harvest(farm,index,now)){
      helper.next.collect=now+gardenHelperIntervals[helper.levels.collect];
      changed=true;
    }
  }
  if(crop!==null&&helperActionEnabled(helper,'sow')&&now>=helper.next.sow){
    const index=farm.plots.indexOf(null);
    if(index>=0&&plant(farm,index,crop,now)){
      onCare?.('sow',index,crop);
      helper.next.sow=now+gardenHelperIntervals[helper.levels.sow];
      changed=true;
    }
  }
  if(helperActionEnabled(helper,'water')&&now>=helper.next.water){
    let dry:Plant|undefined;
    for(const plot of farm.plots){
      if(!plot||!ownPlot(plot))continue;
      const needsWater=plot.ready===null||(plot.wetUntil!==undefined&&plot.wetUntil<=now&&plot.wetUntil<plot.ready);
      if(needsWater&&(!dry||(plot.watered??plot.planted)<(dry.watered??dry.planted)))dry=plot;
    }
    if(dry&&water(farm,dry,now)){
      onCare?.('water',farm.plots.indexOf(dry),dry.crop);
      helper.next.water=now+gardenHelperIntervals[helper.levels.water];
      changed=true;
    }
  }
  if(crop===null||!helperActionEnabled(helper,'sow'))return changed;
  const jobs=extractionJobs(farm.extraction).slice(0,farm.extraction.slots??1);
  const slot=jobs.findIndex(job=>!job);
  const managed=farm.plots.filter(plot=>plot===null||ownPlot(plot)).length;
  const needed=Math.min(extractionCapacity,managed-farm.seeds[crop],farm.harvest[crop]);
  if(slot>=0&&needed>0&&!jobs.some(job=>job?.crop===crop&&job.recycledHybrid===undefined)){
    changed=startExtraction(farm,crop,needed,now,Math.random,slot)||changed;
  }
  return changed;
}
