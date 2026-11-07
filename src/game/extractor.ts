type ExtractionUpgrade = 'speed'|'yield';
const extractionCapacity = 1000;
const extractionSpeedMax = 50;
function extractionCost(level:number,upgrade:ExtractionUpgrade){
  return upgrade==='yield'
    ?Math.ceil(25*(level+1)**2.55)
    :Math.ceil(15*(level+1)**2.3);
}
const extractionTime = (level:number) => Math.round(20_000*4**(-Math.min(level,extractionSpeedMax)/extractionSpeedMax));
function extractionRange(level:number) {return {min:1,max:3+Math.floor(level*.25),extra:(level*.25)%1};}
function extractionJobs(machine:Extraction){
  return [machine.job,...(machine.extraJobs??[])];
}
function setExtractionJob(machine:Extraction,slot:number,job:ExtractionJob|null){
  if(slot===0)machine.job=job;
  else {
    machine.extraJobs??=[null,null];
    machine.extraJobs[slot-1]=job;
  }
}
function startExtraction(farm:Farm,crop:number,count:number,now:number,random=Math.random,slot=0) {
  const machine=farm.extraction;
  if(!Number.isInteger(slot)||slot<0||slot>=(machine.slots??1)||extractionJobs(machine)[slot] || !Number.isSafeInteger(count) || count<1 || count>extractionCapacity ||
    !crops[crop] || !unlocked(farm,crop) || count>farm.harvest[crop])return false;
  const bonus=extractionRange(machine.yield);
  const quality=farm.harvestQuality[crop]/farm.harvest[crop];
  const outputs=Array.from({length:count},()=>{
    if(random()<.01)return 0;
    const max=bonus.max+(random()<bonus.extra?1:0);
    return 1+Math.min(max-1,Math.floor(random()*max));
  });
  if(!outputs.some(Boolean)&&farm.seeds[crop]===0&&!farm.plots.some(plot=>plot?.crop===crop)&&farm.harvest[crop]===count){const max=bonus.max+(random()<bonus.extra?1:0);outputs[outputs.length-1]=1+Math.min(max-1,Math.floor(random()*max));}
  const output=total(outputs);
  const period=extractionTime(machine.speed);
  const early=diamondCurve(diamondLevel(farm,'extract'));
  let elapsed=0;
  const completionOffsets=early?outputs.map(()=>{
    const checks=Math.ceil(period/1000);
    let duration=period;
    for(let step=0;step<checks;step++){
      if(random()<early*(step+1)/checks){duration=step*1000;break;}
    }
    elapsed+=duration;
    return elapsed;
  }):undefined;
  const end=now+(completionOffsets?.at(-1)??period*count);
  if(!Number.isSafeInteger(end)||!Number.isSafeInteger(farm.seeds[crop]+output))return false;
  const removedValue=removeProduce(farm,crop,count);
  setExtractionJob(machine,slot,{completionOffsets,unitValue:removedValue/count,quality,crop,input:count,output,outputs,done:0,start:now,end});
  if(completionOffsets?.[0]===0)finishExtractionSlot(farm,now,slot);
  return true;
}
function finishExtraction(farm:Farm,now:number) {
  let changed=false;
  for(let slot=0;slot<(farm.extraction.slots??1);slot++){
    if(finishExtractionSlot(farm,now,slot))changed=true;
  }
  return changed;
}
function extractionDeadline(job:ExtractionJob,index:number){
  return job.start+(job.completionOffsets?.[index]??(index+1)*(job.end-job.start)/job.input);
}
function finishExtractionSlot(farm:Farm,now:number,slot:number){
  const machine=farm.extraction,job=extractionJobs(machine)[slot];
  if(!job)return false;
  let completed=job.done;
  while(completed<job.input&&extractionDeadline(job,completed)<=now)completed++;
  if(completed<=job.done)return false;
  const seeds=total(job.outputs.slice(job.done,completed));
  const processed=completed-job.done;
  farm.seeds[job.crop]+=seeds;
  const concentrate=sampleBinomial(processed,extractorConcentrateChance(job.crop));
  if(concentrate)addMaterial(farm,'set0',concentrate);
  machine.processed+=processed;machine.produced+=seeds;
  machine.last=crops[job.crop].name+' ×'+processed+' → '+seeds+' семян'+(concentrate?' · 🌱 +'+concentrate:'');
  machine.history=[{crop:job.crop,input:processed,seeds},...(machine.history??[])].slice(0,12);
  job.done=completed;
  if(completed===job.input)setExtractionJob(machine,slot,null);
  return true;
}
function stopExtraction(farm:Farm,now:number,slot=0) {
  finishExtractionSlot(farm,now,slot);
  const job=extractionJobs(farm.extraction)[slot];
  if(!job)return false;
  farm.harvest[job.crop]+=job.input-job.done;
  farm.harvestValue[job.crop]+=(job.input-job.done)*(job.unitValue??cropPrices[job.crop]);
  farm.harvestQuality[job.crop]+=(job.quality??0)*(job.input-job.done);
  setExtractionJob(farm.extraction,slot,null);
  return true;
}
const extractionUpgradeMaxed=(farm:Farm,id:ExtractionUpgrade)=>id==='speed'&&farm.extraction.speed>=extractionSpeedMax;
function buyExtraction(farm:Farm,id:ExtractionUpgrade) {
  if(extractionUpgradeMaxed(farm,id))return false;
  const machine=farm.extraction,price=extractionCost(machine[id],id);
  if(farm.coins<price)return false;
  spendFarmCoins(farm,price);machine[id]++;
  return true;
}
