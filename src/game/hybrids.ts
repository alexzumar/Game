const cropRarities = cropTiers.map(tier=>[0,2,3,4][tier]);
const rarityColors = ['#C4CCD5','#84D7AC','#7FB7F7','#B29AF4','#F3C66F','#F59991','#F080C5'];

const lineTrait = (farm:Farm,plot:Plant,id:string) => plot.line===undefined?0:effectiveGenome(farm,plot).powers[id]??0;



function mutationCandidates(farm:Farm) {
  return farm.plots.flatMap((plot,index)=>{
    if(plot)return [];
    const row=Math.floor(index/farm.size),col=index%farm.size;
    const neighbors=[[row-1,col],[row+1,col],[row,col-1],[row,col+1]]
      .filter(([r,c])=>r>=0&&c>=0&&r<farm.size&&c<farm.size)
      .map(([r,c])=>farm.plots[r*farm.size+c]).filter((p):p is Plant=>!!p&&!p.mystery);
    return neighbors.length>=2?[{index,neighbors}]:[];
  });
}
function checkMutations(farm:Farm,now:number,random=Math.random) {
  if(now<farm.mutationCheck)return false;
  for(let checks=0;farm.mutationCheck<=now&&checks<2000;checks++){
  const at=farm.mutationCheck;
  farm.mutationCheck+=30000;
  for(const candidate of mutationCandidates(farm)) {
    const index=candidate.index,neighbors=candidate.neighbors.filter(p=>p.planted<=at && p.ready!==null && p.ready<=at && (p.wetUntil===undefined||p.wetUntil>=p.ready));
    if(neighbors.length<2)continue;
    const potential=neighbors.reduce((sum,p)=>sum+Math.min(30,genome(farm,p).genes.re+(effectiveGenome(farm,p).powers.resistance??0)),0)/neighbors.length;
    if(random()>=mutationChance(potential))continue;
    const first=Math.floor(random()*neighbors.length);
    const second=(first+1+Math.floor(random()*(neighbors.length-1)))%neighbors.length;
    const parents=[neighbors[first],neighbors[second]];
    const chosen=parents[random()<.5?0:1];
    const duration=chosen.duration??growthTime(chosen.crop,collectionGrowth(farm,chosen.crop));
    const inherited=parents.flatMap(p=>p.line===undefined?[]:farm.lines[p.line].traits);
    farm.plots[index]={crop:chosen.crop,planted:at,watered:at,ready:at+duration,wetUntil:at+duration,
      duration,mystery:{parentNames:parents.map(p=>p.line===undefined?crops[p.crop].name:farm.lines[p.line].name),genomes:parents.map(p=>genome(farm,p)),parents:parents.map(p=>p.crop),traits:inherited}};
    farm.rot[index]=null;
    farm.plots[index]!.mystery!.preview=generateMutationLine(farm,farm.plots[index]!,random);
  }
  }
  return true;
}
function acceptMutation(farm:Farm,index:number,now:number,random=Math.random) {
  const plot=farm.plots[index];
  if(!plot?.mystery || plot.ready===null || plot.ready>now || hybridCount(farm)>=farm.hybridSlots)return null;
  const line=plot.mystery.preview??generateMutationLine(farm,plot,random);
  line.enhancements={};
  line.name='Гибрид #'+(farm.lines.length+1);
  farm.lines.push(line);farm.plots[index]=null;
  if(random()<.001)farm.relics++;
  return {line,added:line.traits[0]??'growth',replaced:null};
}
function generateMutationLine(farm:Farm,plot:Plant,random=Math.random):Line {
  const parents=plot.mystery!.genomes??plot.mystery!.parents.map(crop=>genome(farm,{crop,planted:0,ready:null}));
  const genes:Genes={gr:1,ga:1,re:1};
  for(const id of ['gr','ga','re'] as const){
    const a=parents[0].genes[id],b=parents[1].genes[id],low=Math.min(a,b),high=Math.max(a,b);
    const value=low+(high-low)*.25;
    let stat=Math.floor(value)+(random()<value%1?1:0);
    const shift=random();const improvement=.2+(parents.reduce((s,p)=>s+(p.powers.mutation??0),0)/parents.length)/100;if(shift<improvement)stat+=1;else if(shift>.95)stat-=1;
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
const hybridExpansionPrice = (farm:Farm) => Math.ceil(50*(1+Math.floor((farm.hybridSlots-20)/5))**1.65);
function expandHybridInventory(farm:Farm) {
  const price=hybridExpansionPrice(farm);
  if(farm.coins<price)return false;
  spendFarmCoins(farm,price);farm.hybridSlots+=5;return true;
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


const xrayCost = 100000;
const xrayRelics = 5;
function buyXray(farm:Farm) {
  if(farm.xray||farm.coins<xrayCost||farm.relics<xrayRelics)return false;
  spendFarmCoins(farm,xrayCost);farm.relics-=xrayRelics;farm.xray=true;return true;
}



function effectiveGenome(farm:Farm,plot:Plant):Genome{
  const data=genome(farm,plot),powers={...data.powers};
  for(const id of Object.keys(powers))powers[id]*=1+(data.enhancements?.[id]??0)/100;
  const factor=1+(powers.catalyst??0)/100;
  for(const id of Object.keys(powers))if(id!=='catalyst')powers[id]*=factor;
  return {genes:data.genes,powers};
}
