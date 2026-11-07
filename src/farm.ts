const crops = [
  {name:'Редис', symbol:'🫜', color:'#d87882', seconds:120},
  {name:'Листовой салат', symbol:'🥬', color:'#91ad68', seconds:192},
  {name:'Кабачок', symbol:'🟢', color:'#b4ae65', seconds:252},
  ...[
    ['Горох','🫛',300],['Свёкла','🔴',480],['Лук','🧅',504],['Чеснок','🧄',480],
    ['Картофель','🥔',432],['Морковь','🥕',480],['Огурцы','🥒',252],['Помидоры','🍅',528],
    ['Болгарский перец','🫑',600],['Баклажаны','🍆',600],['Белокочанная капуста','🥬',648],
    ['Цветная капуста','🥦',504],['Сельдерей','🌿',648],
  ].map(([name,symbol,seconds]) => ({name:String(name),symbol:String(symbol),seconds:Number(seconds),
    color:'#9aae73'})),
];
const cropTiers=[0,1,0,1,2,0,1,0,3,2,1,2,3,2,3,3];
const cropTimes=[120,360,270,780,1080,150,480,210,2520,2040,600,1680,3240,1380,2880,3600];
crops.forEach((crop,index)=>{crop.seconds=cropTimes[index];});
const baseRarityNames=["Обычная","Редкая","Эпическая","Легендарная"];
type Genes = {gr:number;ga:number;re:number};
type Genome = {genes:Genes;powers:Record<string,number>;enhancements?:Record<string,number>};
type ParentRecord = {name:string;crop:number;genome:Genome};
type RotRecord = {line?:number;crop:number;at:number;checks:number;risk:number;value:number;name:string;genome:Genome};
type Line = {enhancements?:Record<string,number>;parents?:ParentRecord[];genes?:Genes;powers?:Record<string,number>;archived?:boolean;name:string;crop:number;traits:string[];seeds:number};
type Mystery = {parentNames?:string[];preview?:Line;genomes?:Genome[];parents:number[];traits:string[]};
type Plant = {abilityThrough?:number;dryThrough?:number;boostCheck?:number;ripening?:{next:number;checks:number;value:number};rainThrough?:number;mystery?:Mystery;line?:number;crop:number; planted:number; ready:number|null; watered?:number; wetUntil?:number; remaining?:number; duration?:number};
const traits = [
  {id:'growth', label:'⚡ Скорость роста'},
  {id:'yield', label:'🧺 Урожайность'},
  {id:'moisture', label:'💧 Запас влаги'},
] as const;
type Trait = typeof traits[number]['id'];
type CropLevels = Record<Trait,number>;
const traitMax = Number.MAX_SAFE_INTEGER;
const emptyLevels = ():CropLevels[] => crops.map(() => ({growth:0,yield:0,moisture:0}));
const conveniences = [
  {id:'sowAll',label:'Массовый посев',description:'Двойной клик по семенам засаживает свободные грядки.',price:5000},
  {id:'waterAll',label:'Массовый полив',description:'Двойной клик по лейке поливает все посадки.',price:5000},
  {id:'irrigation',label:'Система орошения',description:'Поддерживает влагу до созревания на всех грядках.',price:10000},
  {id:'replant',label:'Автопосев после сбора',description:'Сажает ту же культуру после сбора, если на складе есть семена.',price:150},
] as const;
type Convenience = typeof conveniences[number]['id'];
const emptyConveniences = ():Record<Convenience,boolean> => ({sowAll:false,waterAll:false,irrigation:false,replant:false});
const defaultGlass = () => ({transparency:30,strength:60});
type ExtractionJob = {completionOffsets?:number[];unitValue?:number;quality?:number;crop:number;input:number;output:number;outputs:number[];done:number;start:number;end:number};
type Extraction = {extraJobs?: (ExtractionJob|null)[];slots?:number;history?:{crop:number;input:number;seeds:number}[];speed:number;yield:number;job:ExtractionJob|null;processed:number;produced:number;last:string};
const newExtraction = ():Extraction => ({speed:0,yield:0,job:null,processed:0,produced:0,last:""});
type Farm = {
  wheels?:WheelState;
  pausedAt?:number;
  statistics?:FarmStatistics;
  diamonds?:DiamondState;
  rainSoaked?:boolean[];
  rainSoakedThrough?:number;
  saveCheats?:boolean;
  resources:Resources;epoch:number;size:number;plots:(Plant|null)[];seeds:number[];harvest:number[];
  harvestValue:number[];harvestQuality:number[];rot:(RotRecord|null)[];
  lines:Line[];hybridSlots:number;mutationCheck:number;
  packProgress:PackProgress;harvested:number[];collection:number[];discoveries:number;discoveryUp:{speed:number;slots:number;amount:number};
  pendingDiscovery:{crop:number;amount:number}[];
  levels:CropLevels[];coins:number;luck:number;cascade:number;relics:number;xray:boolean;
  convenience:Record<Convenience,boolean>;glass:{transparency:number;strength:number};
  automation:{irrigation:boolean;replant:boolean};automationRevision:number;
  irrigationUntil:number;replantCrop:number|null;extraction:Extraction;
  collected:number;offset:number;opened:number;lastPack:number[];
  skin:'classic'|'glossy';theme:'light'|'dark';accent:number;weather:Weather;
};
type Weather = {intervalVersion?:1|2;chance:number; cooldown:number; duration:number; next:number; last:number|null; end:number|null};
type WeatherUpgrade = 'cooldown'|'duration';
const rainLength = (level:number) => 30_000+10_000*level;
const weatherMax = 20;
const rainCooldown = (level:number) => Math.max(30_000,120_000-level*5_000);
const weatherPrice = (level:number) => Math.ceil(10*(level+1)**2.2);
const weatherUpgradeMax = (option:WeatherUpgrade) => option==='cooldown'?18:weatherMax;
const randomWeatherSeconds = (spread:number,random:()=>number) => Math.floor(random()*(spread+1))*1000;
function rainRoll(from:number,level:number,random=Math.random) {
  const dryPause=rainCooldown(level)+randomWeatherSeconds(120,random);
  const wait=Math.floor(Math.log1p(-random())/Math.log1p(-.01))+1;
  return from+dryPause+wait*1000;
}
const newWeather = (now:number):Weather => ({intervalVersion:2,chance:0,cooldown:0,duration:0,last:null,end:null,next:rainRoll(now,0)});
const total = (counts:number[]) => counts.reduce((sum,count) => sum + count,0);
const newFarm = ():Farm => {
  const now = Date.now();
  return {packProgress:newPackProgress(),harvested:crops.map(()=>0),resources:newResources(),rot:[null],harvestQuality:crops.map(()=>0),harvestValue:crops.map(()=>0),relics:0,xray:false,hybridSlots:20,mutationCheck:now+30000,lines:[],automationRevision:1,irrigationUntil:0,replantCrop:null,automation:{irrigation:false,replant:false},extraction:newExtraction(),discoveryUp:{speed:0,slots:0,amount:0},pendingDiscovery:[],collection:crops.map((_,i)=>i===0?1:0),discoveries:0,convenience:emptyConveniences(),glass:defaultGlass(),epoch:now,size:1,plots:[null],seeds:crops.map((_,i)=>i===0?1:0),harvest:crops.map(()=>0),
    levels:emptyLevels(),coins:0,luck:0,cascade:0,skin:'glossy',collected:0,offset:0,opened:0,lastPack:[],
    theme:'light',accent:0,weather:newWeather(now)};
};
const requiredSize = (crop:number) => crop < 3 ? 1 : crop < 10 ? 2 : 3;
const traitPrice = (level:number) => Math.ceil(5*(level+1)**2);
const traitOrbPrice = (level:number) => Math.ceil(Math.max(0,level-9)**1.15);
function buyTrait(farm:Farm,crop:number,trait:Trait) {
  if (!crops[crop] || !unlocked(farm,crop)) return false;
  const level = farm.levels[crop][trait];
  const price = traitPrice(level),orbs=traitOrbPrice(level);
  if (barrierClosed(farm,crop,trait) || level >= traitMax || farm.coins < price || farm.resources.orbs<orbs) return false;
  spendFarmCoins(farm,price);spendFarmOrbs(farm,orbs);
  farm.levels[crop][trait]++;
  return true;
}
const growthTime = (crop:number,level:number) => Math.max(1,Math.round(1000*crops[crop].seconds/1.01**Math.min(100000,level)));
const moistureTime = (level:number,crop=0) => Math.round(cropTimes[crop]*500*(1+level*.05));
function harvestAmount(level:number,random = Math.random,bonus=0) {
  let amount = 1;
  for (let chance = level*.01; chance > 0 && random() < Math.min(1,chance); chance /= 2) amount+=1+Math.floor(bonus)+(random()<bonus%1?1:0);
  return amount;
}
const luckMax = Number.MAX_SAFE_INTEGER;
const luckPrice = (level:number) => Math.ceil(25*(level+1)**2.2);
const unlocked = (farm:Farm,crop:number) => farm.collection[crop]>0;
const cropSets = [
  {name:'Корнеплоды и зелень',crops:[0,1,4,8],bonus:'×1,1 к скорости роста всех культур'},
  {name:'Луковые и капустные',crops:[5,6,13,14],bonus:'×1,25 к удержанию влаги всех культур'},
  {name:'Паслёновые',crops:[7,10,11,12],bonus:'+1 гарантированного урожая всем культурам'},
  {name:'Бахчевые и бобовые',crops:[2,3,9,15],bonus:'×2 к скорости роста и +5 урожая всем культурам'},
];
function collectionSets(farm:Farm) {
  return cropSets.map(set=>Math.min(...set.crops.map(i=>farm.harvested[i])));
}
const collectionLevel = (count:number) => count<10?0:Math.floor(Math.log2(count/10))+1;
const nextCollectionAt = (count:number) => 10*2**collectionLevel(count);
function collectionGrowth(farm:Farm,crop:number) {
  return farm.levels[crop].growth;
}
function growthMultiplier(farm:Farm) {return 1;}
type DiscoveryUpgrade = 'speed'|'slots'|'amount';
const discoveryLimit = (id:DiscoveryUpgrade) => id==='slots'?2:id==='speed'?20:Number.MAX_SAFE_INTEGER;
const discoveryUpgradePrice = (farm:Farm,id:DiscoveryUpgrade) => id==='slots'?25*(farm.discoveryUp.slots+1):5+farm.discoveryUp[id];
function buyDiscoveryUpgrade(farm:Farm,id:DiscoveryUpgrade) {
  const price=discoveryUpgradePrice(farm,id);
  if(farm.discoveryUp[id]>=discoveryLimit(id)||farm.coins<price)return false;
  spendFarmCoins(farm,price);farm.discoveryUp[id]++;return true;
}
function finishDiscovery(farm:Farm) {
  for(const item of farm.pendingDiscovery)farm.collection[item.crop]+=item.amount;
  farm.pendingDiscovery=[];
}
const discoveryPrice = 5;
function discoveryOdds() {return basePackOdds();}
function discover(farm:Farm) {
  const price=farm.discoveries===0?0:discoveryPrice;
  if(farm.coins<price || farm.pendingDiscovery.length) return [];
  const bonus=farm.discoveryUp.amount*.05;
  const results=Array.from({length:1+farm.discoveryUp.slots},()=>({
    crop:roll(discoveryOdds()),amount:1+Math.floor(bonus)+(Math.random()<bonus%1?1:0)
  }));
  spendFarmCoins(farm,price);farm.discoveries++;
  farm.pendingDiscovery=results;
  return results;
}
function packOdds(farm:Farm,pack:number,luck=farm.luck) {return openingOdds(farm,pack,luck);}
function buyLuck(farm:Farm) {
  const price = luckPrice(farm.luck);
  if (farm.luck >= luckMax || farm.coins < price) return false;
  spendFarmCoins(farm,price);
  farm.luck++;
  return true;
}
function roll(odds:number[],random = Math.random) {
  let value = random()*100;
  let last = 0;
  for (const [i,chance] of odds.entries()) {
    if (!chance) continue;
    last = i;
    value -= chance;
    if (value < 0) return i;
  }
  return last;
}
const seedPacks = [
  {name:'Обычный',icon:'⬜',slots:1,price:20,size:1,boost:1},
  {name:'Редкий',icon:'🟦',slots:1,price:500,size:1,boost:1},
  {name:'Эпический',icon:'🟪',slots:1,price:10000,size:1,boost:1},
  {name:'Легендарный',icon:'🟨',slots:1,price:50000,size:1,boost:1},
];
const cropPrices=[5,150,20,1200,10000,8,300,12,250000,80000,600,40000,650000,20000,400000,1000000];
const seedPrice = (crop:number) => cropPrices[crop]*2;
function discountedSeedUnit(farm:Farm,crop:number){
  return seedPrice(crop)*(1-.5*(1-.9**diamondLevel(farm,'discount')));
}
function seedPurchaseQuote(farm:Farm,crop:number,count:number){
  return Math.ceil(discountedSeedUnit(farm,crop)*count-(farm.diamonds?.discountCarry??0)-1e-9);
}
function buySeed(farm:Farm,crop:number) {return buySeeds(farm,crop,1)>0;}
function buySeeds(farm:Farm,crop:number,count:number,partial=false){
 if(!crops[crop]||!unlocked(farm,crop)||!Number.isSafeInteger(count)||count<1)return 0;
 const available=Math.min(Math.floor((farm.coins+(farm.diamonds?.discountCarry??0)+1e-9)/discountedSeedUnit(farm,crop)),Number.MAX_SAFE_INTEGER-farm.seeds[crop]);
 if(!partial&&count>available)return 0;
 const amount=Math.min(count,available);if(amount<1)return 0;
 const price=seedPurchaseQuote(farm,crop,amount);
 if(price>farm.coins)return 0;
 const state=farm.diamonds??=newDiamonds();
 state.discountCarry=Math.max(0,Math.min(1,price-discountedSeedUnit(farm,crop)*amount+state.discountCarry));
 spendFarmCoins(farm,price);farm.seeds[crop]+=amount;return amount;
}
// Legacy bounds retained only to validate and migrate old saves.
const cascadeMax=100;
const packResultLimit=64;
function openPack(farm:Farm,index:number,count=1,random=Math.random) {return beginPackOpening(farm,index,count,random);}
function plant(farm:Farm, index:number, crop:number, now:number,line?:number) {
  if (!unlocked(farm,crop) || index < 0 || index >= farm.plots.length || farm.plots[index] || !(line===undefined?farm.seeds[crop]>0:farm.lines[line]?.seeds>0)) return false;
  if(line!==undefined){const seedLine=farm.lines[line];if(!seedLine||seedLine.archived||seedLine.crop!==crop||seedLine.seeds<1)return false;seedLine.seeds--;}
  else farm.seeds[crop]--;
  farm.rot[index]=null;
  farm.plots[index] = {crop, planted:now, ready:null,...(line===undefined?{}:{line})};
  const planted=farm.plots[index]!;
  if(Math.random()<(effectiveGenome(farm,planted).powers.sprout??0)/100){planted.duration=plantGrowthTime(farm,planted);planted.remaining=Math.round(planted.duration*.8);}
  if(farm.rainSoaked?.[index]){
    farm.rainSoaked[index]=false;
    water(farm,planted,now,now+cropTimes[crop]*10*(25+diamondLevel(farm,"rainReserve")));
  }
  irrigate(farm,planted,now);
  return true;
}
function water(farm:Farm,plot:Plant,now:number,until = now+moistureTime(plot.line===undefined?farm.levels[plot.crop].moisture:0,plot.crop)*(1+(effectiveGenome(farm,plot).powers.moisture??0)/100)) {
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
function rainAt(farm:Farm,now:number) {
  return farm.weather.end !== null && now < farm.weather.end;
}
function dryPlot(plot:Plant,now:number) {
  if (plot.ready === null || plot.wetUntil === undefined || plot.wetUntil >= plot.ready || plot.wetUntil > now) return false;
  plot.remaining = plot.ready-plot.wetUntil;
  plot.dryThrough=plot.wetUntil;
  plot.ready = null;
  delete plot.watered;
  return true;
}
function rainWindow(farm:Farm,start:number,end:number,now:number) {
  let changed = false;
  if(now>=start&&(now<end||farm.rainSoakedThrough!==end)){
    farm.rainSoaked??=farm.plots.map(()=>false);
    farm.plots.forEach((plot,index)=>{
      if(!plot&&!farm.rainSoaked![index]){
        farm.rainSoaked![index]=true;
        changed=true;
      }
    });
    if(farm.rainSoakedThrough!==end){
      farm.rainSoakedThrough=end;
      changed=true;
    }
  }
  for (const plot of farm.plots) {
    if (!plot || plot.planted>=end) continue;
    const until = end+moistureTime(plot.line===undefined?farm.levels[plot.crop].moisture:0,plot.crop)*(1+(effectiveGenome(farm,plot).powers.moisture??0)/100);
    const at = Math.max(start,plot.planted,plot.ready === null ? plot.wetUntil ?? 0 : 0);
    if (at > now || at >= until) continue;
    changed = dryPlot(plot,at) || changed;
    changed = water(farm,plot,at,until) || changed;
    const rainBoost=(5+diamondLevel(farm,"rainGrowth"))/100;
    const from=Math.max(start,plot.watered??plot.planted,plot.rainThrough??0);
    const to=Math.min(now,end);
    if(plot.ready!==null && to>from && plot.ready>from){
      plot.ready=Math.ceil(plot.ready<=from+(to-from)*(1+rainBoost)?from+(plot.ready-from)/(1+rainBoost):plot.ready-(to-from)*rainBoost);
      plot.rainThrough=to;changed=true;
    }
  }
  return changed;
}
function irrigate(farm:Farm,plot:Plant,now:number) {
  if(!farm.convenience.irrigation || !farm.automation.irrigation || now>=farm.irrigationUntil)return false;
  let changed=dryPlot(plot,now);
  changed=water(farm,plot,now)||changed;
  if(plot.ready!==null && plot.ready>now && (plot.wetUntil??0)<plot.ready) {
    plot.wetUntil=Math.max(plot.wetUntil??0,Math.min(plot.ready,farm.irrigationUntil));changed=true;
  }
  return changed;
}
function applyRain(farm:Farm,now:number) {
  const weather = farm.weather;
  let changed = false;
  if (weather.last !== null && weather.end !== null) changed = rainWindow(farm,weather.last,weather.end,now);
  while (weather.next <= now) {
    weather.last = weather.next;
    weather.end = weather.last+rainLength(weather.duration)+randomWeatherSeconds(90,Math.random);
    weather.next = rainRoll(weather.end,weather.cooldown);
    rainWindow(farm,weather.last,weather.end,now);
    changed = true;
  }
  for (const plot of farm.plots) if (plot) {
    changed=irrigate(farm,plot,now)||changed;
    changed=dryPlot(plot,now)||changed;
  }
  return changed;
}
function buyWeather(farm:Farm,upgrade:WeatherUpgrade,now:number) {
  const weather = farm.weather;
  const level = weather[upgrade];
  const price = weatherPrice(level);
  if (level >= weatherUpgradeMax(upgrade) || farm.coins < price) return false;
  applyRain(farm,now);
  spendFarmCoins(farm,price);
  weather[upgrade]++;
  return true;
}
function remainingGrowth(plot:Plant,now:number) {
  return plot.ready === null ? plot.remaining : Math.max(0,plot.ready-now);
}
function collect(farm:Farm,index:number,now:number,random=Math.random) {
  const plot = farm.plots[index];
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
  if(random()<.001)farm.relics++;
  farm.plots[index] = null;
  const renew=random()<(powers.renew??0)/100;
  const secondCut=random()<(powers.cut??0)/100;
  if(renew||secondCut||random()<Math.min(1,(powers.regrow??0)/100)) {
    if(plot.line!==undefined)farm.lines[plot.line].seeds--;
    farm.plots[index]={crop:plot.crop,planted:now,ready:null,...(plot.line===undefined?{}:{line:plot.line})};
    const planted=farm.plots[index]!;
    if(renew){planted.duration=plantGrowthTime(farm,planted);planted.remaining=Math.round(planted.duration*.5);}
    irrigate(farm,planted,now);
  } else if(farm.convenience.replant && farm.automation.replant && farm.replantCrop===plot.crop) plant(farm,index,plot.crop,now,plot.line);
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
  const rainSoaked=Array<boolean>(next**2).fill(false);
  farm.rainSoaked?.forEach((wet,index)=>{
    const row=Math.floor(index/farm.size),column=index%farm.size;
    if(row<next&&column<next)rainSoaked[row*next+column]=wet;
  });
  farm.rainSoaked=rainSoaked;
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



const salePrice = 1;
const basketSaleValue=(farm:Farm)=>farm.harvestValue.reduce((sum,value)=>sum+Math.ceil(value),0);
function sellBasket(farm:Farm,receipt:number[]) {
  if (receipt.length !== farm.harvest.length || !receipt.every((count,i) => count === farm.harvest[i])) return 0;
  const amount = total(receipt);
  farm.coins += basketSaleValue(farm);farm.harvestValue.fill(0);farm.harvestQuality.fill(0);
  farm.harvest.fill(0);
  return amount;
}











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
const cropRarities = cropTiers.map(tier=>[0,2,3,4][tier]);
const rarityColors = ['#C4CCD5','#84D7AC','#7FB7F7','#B29AF4','#F3C66F','#F59991','#F080C5'];

const lineTrait = (farm:Farm,plot:Plant,id:string) => plot.line===undefined?0:effectiveGenome(farm,plot).powers[id]??0;
const traitNames:Record<string,string>={growth:'⚡ +10% скорости',yield:'🧺 +1 урожая',regrow:'🌱 +5% отрастания',value:'🍅 Рост цены',stability:'💀 Стабильность гнили',catalyst:'🫑 Усиление свойств'};



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
function produceValue(farm:Farm,crop:number,count:number){
  return farm.harvestValue[crop]*count/farm.harvest[crop];
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
function updateRipening(farm:Farm,now:number,random=Math.random){
  let changed=false;
  farm.plots.forEach((plot,index)=>{
    if(!plot||plot.mystery||plot.ready===null||plot.ready>now)return;
    const powers=effectiveGenome(farm,plot).powers;
    if(powers.value===undefined&&powers.stability===undefined)return;
    plot.ripening??={next:plot.ready+60000,checks:0,value:1};
    const ripe=plot.ripening;
    for(let steps=0;ripe.next<=now&&steps<1000;steps++){
      ripe.checks++;
      const risk=rotRisk(powers,ripe.checks);
      if(random()<risk){
        farm.rot[index]={...(plot.line===undefined?{}:{line:plot.line}),crop:plot.crop,at:ripe.next,checks:ripe.checks,risk,value:ripe.value,name:plot.line===undefined?crops[plot.crop].name:farm.lines[plot.line].name,genome:cloneGenome(genome(farm,plot))};
        farm.plots[index]=null;changed=true;break;
      }
      ripe.value*=1+(powers.value??0)/100;
      ripe.next+=40000+Math.floor(random()*40001);
      changed=true;
    }
  });
  return changed;
}


const abilityDefinitions:Record<string,{icon:string;name:string;description:string}>={
 growth:{icon:'⏱️',name:'Скороспелость',description:'Ускоряет собственный рост.'},
 sprout:{icon:'🤝',name:'Дружные всходы',description:'При посадке шанс сразу получить 20% прогресса роста.'},
 bounty:{icon:'💠',name:'Обильный урожай',description:'Шанс удвоить сбор.'},
 pod:{icon:'🎰',name:'Стручок',description:'Шанс получить дополнительно два семени того же вида или линии.'},
 sweet:{icon:'🍭',name:'Сахаристость',description:'Увеличивает цену плодов при продаже.'},
 moisture:{icon:'💧',name:'Запас влаги',description:'Продлевает действие полива.'},
 resistance:{icon:'💪',name:'Устойчивость',description:'Повышает селекционный потенциал при проверке селекции, не меняя генетику.'},
 regrow:{icon:'🔄',name:'Отрастание',description:'Шанс после сбора начать новый цикл без расхода семени.'},
 drought:{icon:'⚓',name:'Крепкий корень',description:'Продолжает расти без воды с долей обычной скорости.'},
 leap:{icon:'🚀',name:'Рывок роста',description:'Каждые 30 секунд влажного роста шанс убрать половину оставшегося времени.'},
 value:{icon:'⏳',name:'Дозревание',description:'Цена растёт после созревания; позже появляется риск гнили.'},
 stability:{icon:'💀',name:'Стабильность',description:'Снижает множитель нарастания риска гнили.'},
 catalyst:{icon:'🧪',name:'Катализатор',description:'Усиливает другие способности, не себя.'},
 sunshine:{icon:'🔥',name:'Теплолюбие',description:'Ускоряет рост в ясную погоду.'},
 head:{icon:'🏋️',name:'Крупный кочан',description:'Повышает размер каждого успеха каскада урожая.'},
 mutation:{icon:'🎲',name:'Изменчивость',description:'Повышает вероятность улучшения генетики потомка.'},
 renew:{icon:'🌀',name:'Возобновление',description:'Шанс после сбора начать новый цикл с половины роста без семени.'},
 cut:{icon:'🥬',name:'Второй срез',description:'Шанс повторно начать рост после сбора.'}
};
const basePowers:Record<string,number>[]=[
 {growth:5},{sprout:5},{bounty:3},{pod:5},{sweet:8},{moisture:10},{resistance:1},{regrow:5},
 {drought:10},{leap:1},{value:2,stability:0},{catalyst:5},{sunshine:8},{head:10},{mutation:2},{renew:3}
];
for(const [id,ability] of Object.entries(abilityDefinitions))traitNames[id]=ability.icon+' '+ability.name;
function advanceDryGrowth(farm:Farm,plot:Plant,now:number){
  const strength=Math.max(effectiveGenome(farm,plot).powers.drought??0,diamondCurve(diamondLevel(farm,'dryGrowth'))*100);
  if(!strength||plot.ready!==null)return false;
  plot.duration??=plantGrowthTime(farm,plot);
  plot.remaining??=plot.duration;
  const from=plot.dryThrough??plot.planted;
  if(now<=from)return false;
  plot.remaining=Math.max(0,plot.remaining-(now-from)*strength/100);
  plot.dryThrough=now;
  if(plot.remaining===0){plot.ready=now;plot.wetUntil=now;delete plot.remaining;}
  return now>from;
}
function updatePlantAbilities(farm:Farm,now:number,random=Math.random){
  let changed=false;
  for(const plot of farm.plots){
    if(!plot||plot.mystery)continue;
    changed=advanceDryGrowth(farm,plot,now)||changed;
    if(plot.ready===null||plot.ready<=now)continue;
    const powers=effectiveGenome(farm,plot).powers;
    const from=plot.abilityThrough??plot.watered??plot.planted;
    const end=Math.min(now,plot.wetUntil??now,plot.ready);
    const rainStart=farm.weather.last??0,rainEnd=farm.weather.end??0;
    const rainy=Math.max(0,Math.min(end,rainEnd)-Math.max(from,rainStart));
    const sunny=Math.max(0,end-from-rainy);
    if(powers.sunshine && sunny>0){plot.ready=Math.max(now,plot.ready-sunny*powers.sunshine/100);changed=true;}
    if(powers.leap){
      plot.boostCheck??=from+30000;
      for(let steps=0;plot.boostCheck<=end&&steps<2000;steps++){
        if(random()<powers.leap/100){plot.ready=plot.boostCheck+(plot.ready-plot.boostCheck)/2;changed=true;}
        plot.boostCheck+=30000;changed=true;
      }
    }
    plot.abilityThrough=now;
  }
  return changed;
}






function rotRisk(powers:Record<string,number>,check:number){
  const multiplier=2/(1+(powers.stability??0)/100);
  return check<=1?0:Math.min(1,.001*multiplier**(check-2));
}
function ripeningInfo(farm:Farm,plot:Plant){
  if(plot.ready===null || plot.mystery)return null;
  const powers=effectiveGenome(farm,plot).powers;
  if(powers.value===undefined&&powers.stability===undefined)return null;
  const ripe=plot.ripening??{next:plot.ready+60000,checks:0,value:1};
  return {next:ripe.next,risk:rotRisk(powers,ripe.checks+1),value:ripe.value,nextValue:ripe.value*(1+(powers.value??0)/100),check:ripe.checks+1};
}

function cloneGenome(data:Genome):Genome{return {genes:{...data.genes},powers:{...data.powers},enhancements:{...data.enhancements}};}




const mutationChance = (potential:number) => .08+.32*((Math.max(1,Math.min(30,potential))-1)/29)**2;








const diamondBranches = {
  find:'💎 Поиск кристаллов', double:'✨ Двойная находка', charge:'⚡ Кристальный заряд',
  income:'🪙 Монеты при сборе', seedReturn:'🌱 Возврат семян', dryGrowth:'🌿 Рост без полива',
  rainReserve:'💧 Запас дождевой влаги', rainGrowth:'🌧️ Рост под дождём',
  fruit:'🧺 Дополнительный плод', extract:'⏱️ Досрочная переработка', discount:'🛒 Скидка на семена'
} as const;
type DiamondBranch=keyof typeof diamondBranches;
type DiamondState={balance:number;charge:number;coinCarry:number;discountCarry:number;sets:boolean[];levels:Partial<Record<DiamondBranch,number>>};
const newDiamonds=():DiamondState=>({balance:0,charge:0,coinCarry:0,discountCarry:0,sets:[false,false,false,false],levels:{}});
const diamondLevel=(farm:Farm,branch:DiamondBranch)=>farm.diamonds?.levels[branch]??0;
const diamondCurve=(level:number)=>1-.99**level;
const diamondPrice=(level:number)=>Math.ceil(1.35**level);
function diamondBonusCount(value:number,random:()=>number){
  if(value<=0)return 0;
  const whole=Math.floor(value);
  return whole+(value>whole&&random()<value-whole?1:0);
}
function awardDiamondSets(farm:Farm){
  const state=farm.diamonds??=newDiamonds();
  let changed=false;
  collectionSets(farm).forEach((count,index)=>{
    if(count>0&&!state.sets[index]){
      state.sets[index]=true;
      state.balance++;
      changed=true;
    }
  });
  return changed;
}
function awardDiamonds(farm:Farm,crop:number,harvestIncome:number,random:()=>number){
  const state=farm.diamonds??=newDiamonds();
  const chance=cropTimes[crop]/120*.0005*(1+diamondLevel(farm,'find')/100);
  const extra=diamondLevel(farm,'double')*.0005;
  const stats=farmStatistics(farm);
  stats.crystalRolls++;
  const found=diamondBonusCount(chance,random);
  const reward=found*(1+Math.floor(extra))+sampleBinomial(found,extra%1,random);
  state.balance+=reward;
  stats.crystalDrops+=reward;
  const charge=diamondLevel(farm,'charge');
  if(charge){
    state.charge+=chance*(1+extra)*(1-.9*.99**(charge-1));
    const paid=Math.floor(state.charge);
    state.balance+=paid;
    state.charge-=paid;
  }
  const income=diamondLevel(farm,'income');
  if(income){
    state.coinCarry+=harvestIncome*income/100;
    const paid=Math.floor(state.coinCarry);
    farm.coins+=paid;
    state.coinCarry-=paid;
  }
  awardDiamondSets(farm);
}
function buyDiamondUpgrade(farm:Farm,branch:DiamondBranch){
  const state=farm.diamonds??=newDiamonds();
  const level=diamondLevel(farm,branch),price=diamondPrice(level);
  if(!Number.isFinite(price)||state.balance<price)return false;
  state.balance-=price;
  farmStatistics(farm).diamondsSpent+=price;
  state.levels[branch]=level+1;
  return true;
}


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
