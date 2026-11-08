const cropRarities = cropTiers.map(tier=>[0,2,3,4][tier]);
const seedRarityOrder=crops.map((_,index)=>index).sort((a,b)=>cropTiers[b]-cropTiers[a]||cropPrices[b]-cropPrices[a]);
const rarityColors = ['#C4CCD5','#84D7AC','#7FB7F7','#B29AF4','#F3C66F','#F59991','#F080C5'];

const lineTrait = (farm:Farm,plot:Plant,id:string) => plot.line===undefined?0:effectiveGenome(farm,plot).powers[id]??0;



function mutationCandidates(farm:Farm,greenhouse?:Greenhouse,requireTrellis=true) {
  const {plots}=greenhouse??farm;
  const width=greenhouse?greenhouseWidth:farm.size;
  return plots.flatMap((plot,index)=>{
    if(plot||(greenhouse&&(!greenhouse.beds[index]||greenhouse.rot[index]||(requireTrellis&&!greenhouse.trellises[index]))))return [];
    const row=Math.floor(index/width),col=index%width;
    const neighbors=[[row-1,col],[row+1,col],[row,col-1],[row,col+1]]
      .filter(([r,c])=>r>=0&&c>=0&&r<plots.length/width&&c<width)
      .map(([r,c])=>plots[r*width+c]).filter((p):p is Plant=>!!p&&!p.mystery);
    return neighbors.length>=2?[{index,neighbors}]:[];
  });
}
function matureMutationParent(plot:Plant,at:number){
  return plot.planted<=at&&plot.ready!==null&&plot.ready<=at&&
    (plot.wetUntil===undefined||plot.wetUntil>=plot.ready);
}
function mutationParentProgress(farm:Farm,plot:Plant,at:number){
  if(matureMutationParent(plot,at))return 1;
  const duration=plot.duration??plantGrowthTime(farm,plot);
  const growthThrough=Math.min(at,plot.wetUntil??at);
  const remaining=plot.ready===null?plot.remaining??duration:plot.ready-growthThrough;
  return Math.max(0,Math.min(1,1-remaining/duration));
}
type MutationUpgrade = "interval"|"genetics"|"maturity";
const mutationUpgradeIds:MutationUpgrade[]=["interval","genetics","maturity"];
const mutationUpgradeMax=10;
const mutationLevel=(farm:Farm,id:MutationUpgrade)=>farm.mutationUpgrades?.[id]??0;
const mutationUpgradePrices=[2,6,15,30,50,80,120,175,250,350];
const mutationUpgradeCost=(level:number)=>mutationUpgradePrices[level]??Infinity;
function buyMutationUpgrade(farm:Farm,id:MutationUpgrade){
  const level=mutationLevel(farm,id),cost=mutationUpgradeCost(level);
  if(level>=mutationUpgradeMax||(farm.mutationPoints??0)<cost)return false;
  farm.mutationPoints=(farm.mutationPoints??0)-cost;
  (farm.mutationUpgrades??={})[id]=level+1;
  return true;
}
const mutationInterval = (re:number) => Math.round(30-20*(re-1)/29)*1000;
const upgradedMutationInterval=(re:number,level:number)=>Math.max(6000,Math.round(mutationInterval(re)*.94**level));
const mutationMaturityDuration=(growth:number,level:number)=>Math.max(1,Math.round(Math.min(growth,120000)*.96**level));
const mutationInheritanceWeight=(level:number)=>.5+.02*level;
const mutationStatGainChance=(level:number)=>.2+.01*level;

function checkMutations(farm:Farm,now:number,random=Math.random,greenhouse?:Greenhouse) {
  if(!greenhouse)return false;
  const area=greenhouse;
  if(now<area.mutationCheck)return false;
  for(let checks=0;area.mutationCheck<=now&&checks<2000;checks++){
  const at=area.mutationCheck;
  const candidates=mutationCandidates(farm,greenhouse);
  let fastestRe=1;
  for(const candidate of candidates) {
    const index=candidate.index,neighbors=candidate.neighbors.filter(plot=>plot.planted<=at);
    if(neighbors.length<2)continue;
    const strongest=neighbors.map(plot=>genome(farm,plot).genes.re).sort((a,b)=>b-a);
    fastestRe=Math.max(fastestRe,(strongest[0]+strongest[1])/2);
    const first=Math.floor(random()*neighbors.length);
    const second=(first+1+Math.floor(random()*(neighbors.length-1)))%neighbors.length;
    const parents=[neighbors[first],neighbors[second]];
    const potential=parents.reduce((sum,p)=>sum+Math.min(30,genome(farm,p).genes.re+(effectiveGenome(farm,p).powers.resistance??0)),0)/2;
    const progress=parents.reduce((sum,p)=>sum+mutationParentProgress(farm,p,at),0)/2;
    if(random()>=mutationChance(potential)*(.2+.8*progress))continue;
    const chosen=parents[random()<.5?0:1];
    const growth=chosen.duration??growthTime(chosen.crop,collectionGrowth(farm,chosen.crop));
    const duration=mutationMaturityDuration(growth,mutationLevel(farm,"maturity"));
    const inherited=parents.flatMap(p=>p.line===undefined?[]:farm.lines[p.line].traits);
    area.plots[index]={crop:chosen.crop,planted:at,watered:at,ready:at+duration,wetUntil:at+duration,
      duration,mystery:{parentNames:parents.map(p=>p.line===undefined?crops[p.crop].name:farm.lines[p.line].name),genomes:parents.map(p=>genome(farm,p)),parents:parents.map(p=>p.crop),traits:inherited}};
    area.rot[index]=null;
    area.plots[index]!.mystery!.preview=generateMutationLine(farm,area.plots[index]!,random);
  }
  area.mutationCheck=at+upgradedMutationInterval(fastestRe,mutationLevel(farm,"interval"));
  }
  return true;
}
function mutationReward(line:Line){
  const parents=line.parents??[];
  if(!parents.length)return 1;
  const strongerGene=(['gr','ga','re'] as const).some(id=>
    (line.genes?.[id]??1)>Math.max(...parents.map(parent=>parent.genome.genes[id])));
  const strongerPower=Object.entries(line.powers??{}).some(([id,value])=>
    parents.some(parent=>(parent.genome.powers[id]??0)>0)&&
    value>Math.max(...parents.map(parent=>parent.genome.powers[id]??0)));
  return 1+Number(strongerGene)+Number(strongerPower);
}
function discardMutation(farm:Farm,index:number,now:number,area:PlotArea=farm){
  const plot=area.plots[index];
  if(!plot?.mystery)return 0;
  const points=plot.ready!==null&&plot.ready<=now?mutationReward(plot.mystery.preview??generateMutationLine(farm,plot)):0;
  farm.mutationPoints=(farm.mutationPoints??0)+points;
  area.plots[index]=null;
  return points;
}
function acceptMutation(farm:Farm,index:number,now:number,random=Math.random,area:PlotArea=farm) {
  const plot=area.plots[index];
  if(!plot?.mystery || plot.ready===null || plot.ready>now || hybridCount(farm)>=farm.hybridSlots)return null;
  const line=plot.mystery.preview??generateMutationLine(farm,plot,random);
  line.enhancements={};
  line.name='Гибрид #'+(farm.lines.length+1);
  farm.lines.push(line);area.plots[index]=null;
  const points=mutationReward(line);
  farm.mutationPoints=(farm.mutationPoints??0)+points;
  return {line,added:line.traits[0]??'growth',replaced:null,points};
}
function generateMutationLine(farm:Farm,plot:Plant,random=Math.random):Line {
  const parents=plot.mystery!.genomes??plot.mystery!.parents.map(crop=>genome(farm,{crop,planted:0,ready:null}));
  const genes:Genes={gr:1,ga:1,re:1};
  for(const id of ['gr','ga','re'] as const){
    const a=parents[0].genes[id],b=parents[1].genes[id],low=Math.min(a,b),high=Math.max(a,b);
    const value=low+(high-low)*mutationInheritanceWeight(mutationLevel(farm,"genetics"));
    let stat=Math.floor(value)+(random()<value%1?1:0);
    const shift=random();const improvement=mutationStatGainChance(mutationLevel(farm,"genetics"))+(parents.reduce((s,p)=>s+(p.powers.mutation??0),0)/parents.length)/100;if(shift<improvement)stat+=1;else if(shift>.95)stat-=1;
    genes[id]=Math.max(1,Math.min(30,stat));
  }
  const powers:Record<string,number>={};
  for(const id of new Set([...Object.keys(parents[0].powers),...Object.keys(parents[1].powers)])){
    const a=parents[0].powers[id]??0,b=parents[1].powers[id]??0;
    const re=(parents[0].genes.re+parents[1].genes.re)/2;
    const share=(a===0||b===0)? .6+.3*(re-1)/29 : .2;
    const base=Math.min(a,b)+Math.abs(a-b)*share;
    const potential=parents.reduce((sum,parent)=>sum+parent.genes.re,0)/parents.length;
    const progress=(potential-1)/29;
    const chance=.30+.35*progress,variation=random();
    const gain=variation<chance?Math.max(.05,base*(.005+.02*progress)*(.7+.6*random())):variation>.90?-Math.max(.01,base*.0025):0;
    powers[id]=Math.max(0,Math.round((base+gain)*100)/100);
  }
  const common=Object.keys(powers).filter(id=>parents.every(parent=>parent.powers[id]!==undefined));
  const traits=common.slice(0,3);
  const incoming=Object.keys(powers).filter(id=>!common.includes(id));
  for(const id of incoming){
    if(random()>=.6+.3*((parents[0].genes.re+parents[1].genes.re)/2-1)/29)continue;
    // No second penalty for a property already inherited from one parent.
    if(traits.length<3)traits.push(id);
    else if(random()<.25)traits[Math.floor(random()*3)]=id;
  }
  if(!traits.length&&Object.keys(powers).length)traits.push(Object.keys(powers)[0]);
  for(const id of Object.keys(powers))if(!traits.includes(id))delete powers[id];
  return {name:'',crop:plot.crop,traits,powers,genes,enhancements:inheritEnhancements(parents,traits),seeds:1,parents:parents.map((genome,i)=>({name:plot.mystery!.parentNames?.[i]??crops[plot.mystery!.parents[i]].name,crop:plot.mystery!.parents[i],genome:cloneGenome(genome)}))};
}
const hybridCount = (farm:Farm) => farm.lines.filter(line=>!line.archived && line.seeds>0).length;
const hybridExpansionPrice = (farm:Farm) => Math.ceil(5*(1+Math.floor((farm.hybridSlots-20)/5))**1.65);
function expandHybridInventory(farm:Farm) {
  const price=hybridExpansionPrice(farm);
  if((farm.mutationPoints??0)<price)return false;
  farm.mutationPoints=farm.mutationPoints!-price;
  farm.hybridSlots+=5;
  return true;
}
function discardHybrid(farm:Farm,index:number) {
  const line=farm.lines[index];
  if(!line || line.archived || line.seeds<1)return false;
  line.seeds=0;line.archived=true;return true;
}


function genome(farm:Farm,plot:Plant):Genome {
  const line=plot.line===undefined?undefined:farm.lines[plot.line];
  if(line)return {enhancements:line.enhancements,genes:line.genes??{gr:1,ga:1,re:1},powers:line.powers??Object.fromEntries(line.traits.map(id=>[id,id==='growth'?10:id==='regrow'?5:1]))};
  return {genes:{gr:1,ga:1,re:1},powers:basePowers[plot.crop]};
}
function plantGrowthTime(farm:Farm,plot:Plant) {
  const data=effectiveGenome(farm,plot);
  const base=plot.line===undefined?growthTime(plot.crop,collectionGrowth(farm,plot.crop)):crops[plot.crop].seconds*1000;
  return Math.max(1,Math.round(base/growthMultiplier(farm)/data.genes.gr/(1+(data.powers.growth??0)/100)));
}
function powerLabel(line:Line,id:string) {
  const value=line.powers?.[id];
  const suffix=(line.enhancements?.[id]??0)>0?' (+'+line.enhancements![id]+'%='+Number(((value??0)*(1+line.enhancements![id]/100)).toFixed(4))+'%)':'';
  return (value===undefined?traitNames[id]:id==='value'?(abilityDefinitions.value.icon+' Цена +')+value+'%/мин':id==='stability'?'💀 Стабильность '+value:id==='catalyst'?'🧪 Усиление +'+value+'%':id==='growth'?'⏱️ Скорость +'+value+'%':id==='regrow'?'🔄 Отрастание '+value+'%':id==='yield'?'💰 Урожай +'+value:(abilityDefinitions[id]?.icon??'✦')+' '+(abilityDefinitions[id]?.name??id)+' '+value+'%')+suffix;
}





function effectiveGenome(farm:Farm,plot:Plant):Genome{
  const data=genome(farm,plot),powers={...data.powers};
  for(const id of Object.keys(powers))powers[id]*=1+(data.enhancements?.[id]??0)/100;
  const factor=1+(powers.catalyst??0)/100;
  for(const id of Object.keys(powers))if(id!=='catalyst')powers[id]*=factor;
  return {genes:data.genes,powers};
}
