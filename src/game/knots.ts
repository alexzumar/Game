const knotMaterials=cropSets.map(set=>set.crops.map(crop=>propertyMaterialId(Object.keys(crops[crop].powers)[0])));
const knotRank=(farm:Farm,set:number,tier:number)=>farm.knotRanks?.[set]?.[tier]??0;
const knotBundleSize=(rank:number)=>2+Math.floor((rank-1)/3);
const knotBase=[[15,.18,.12,.025],[.22,.25,.2,.16],[.22,.16,.18,.25],[.2,.25,.2,.12]];
function knotEffect(farm:Farm,set:number,tier:number,previewTier=-1){
  if(knotRank(farm,set,tier)+Number(previewTier===tier)===0)return 0;
  const ranks=knotMaterials[set].reduce((sum,_,index)=>sum+(index>=tier?knotRank(farm,set,index):0),0);
  const progress=ranks+Number(previewTier>=tier)-1;
  const base=knotBase[set][tier];
  if(set===0&&tier===0)return base*(1+.12*progress);
  if(set===1&&tier===2)return 1-.8/(1+.12*progress);
  if(set===0&&tier===2||set===3&&tier===0)return base*(1+.12*progress);
  const cap=set===0&&tier===3?.16:set===1&&tier===1?2:set===2&&tier===2?1:.85;
  return cap-(cap-base)/(1+.12*progress);
}
function knotMaterialTime(crop:number){
  return cropTimes[crop]*Object.keys(crops[crop].powers).length/harvestMaterialChance(crop);
}
function knotExchangeRates(farm:Farm,set:number,target:number){
  const discount=knotEffect(farm,1,2);
  const targetCrop=cropSets[set]?.crops[target];
  if(!discount||targetCrop===undefined||!unlocked(farm,targetCrop))return null;
  return knotMaterials[set].flatMap((id,index)=>{
    if(index===target)return [];
    const crop=cropSets[set].crops[index];
    const relative=knotMaterialTime(targetCrop)/knotMaterialTime(crop);
    return [{id,rate:relative*(2-discount)/3}];
  });
}
function knotExchangePrice(farm:Farm,set:number,target:number,quantity=1){
  if(!Number.isSafeInteger(quantity)||quantity<1)return null;
  return knotExchangeRates(farm,set,target)?.map(({id,rate})=>({id,count:Math.ceil(rate*quantity)}))??null;
}
function knotExchangeLimit(farm:Farm,set:number,target:number){
  const rates=knotExchangeRates(farm,set,target);
  if(!rates)return 0;
  let low=0,high=Number.MAX_SAFE_INTEGER-(farm.resources.items[knotMaterials[set][target]]??0);
  while(low<high){
    const quantity=low+Math.ceil((high-low)/2);
    if(rates.every(({id,rate})=>Math.ceil(rate*quantity)<=(farm.resources.items[id]??0)))low=quantity;
    else high=quantity-1;
  }
  return low;
}
function exchangeKnotMaterial(farm:Farm,set:number,target:number,quantity=1){
  const price=knotExchangePrice(farm,set,target,quantity);
  if(!price||quantity>Number.MAX_SAFE_INTEGER-(farm.resources.items[knotMaterials[set][target]]??0)||
    price.some(({id,count})=>(farm.resources.items[id]??0)<count))return false;
  for(const {id,count} of price)farm.resources.items[id]-=count;
  addMaterial(farm,knotMaterials[set][target],quantity,false);
  return true;
}

function knotPrice(farm:Farm,set:number,tier:number){
  const rank=knotRank(farm,set,tier);
  if((tier<3&&rank>=5)||(tier>0&&knotRank(farm,set,tier-1)<5))return null;
  const setCrops=cropSets[set].crops;
  return knotMaterials[set].slice(0,tier+1).map((id,index)=>{
    const progress=(tier-index)*5+rank;
    const relative=knotMaterialTime(setCrops[index])/knotMaterialTime(setCrops[0]);
    const count=1+Math.floor(progress**1.38/(3*Math.sqrt(relative)));
    return {id,count:Math.min(Number.MAX_SAFE_INTEGER,count)};
  });
}

function buyKnotRank(farm:Farm,set:number,tier:number){
  const price=knotPrice(farm,set,tier);
  if(!price||price.some(({id,count})=>(farm.resources.items[id]??0)<count))return false;
  const ranks=farm.knotRanks??=cropSets.map(()=>[0,0,0,0]);
  if(ranks[set][tier]>=Number.MAX_SAFE_INTEGER)return false;
  for(const {id,count} of price)farm.resources.items[id]-=count;
  ranks[set][tier]++;
  return true;
}
