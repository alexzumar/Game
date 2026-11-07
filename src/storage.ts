const activeSlotKey = 'glass-farm.active-slot';
const slotKey = (slot:number) => slot===1?'glass-farm.v1':'glass-farm.v1.slot-'+slot;
function readActiveSlot(){
  try{
    const slot=Number(localStorage.getItem(activeSlotKey));
    return Number.isInteger(slot)&&slot>=1&&slot<=3?slot:1;
  }catch(error){
    console.error('Ферма: не удалось прочитать активный слот',error);
    return 1;
  }
}
const activeSlot=readActiveSlot();
const key=slotKey(activeSlot);
let storageError = false;
const int = (value:unknown,min:number,max = Number.MAX_SAFE_INTEGER) =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
function loadFarm():Farm {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return newFarm();
    const s = JSON.parse(raw);
    const resumed=s.pausedAt!==undefined;
    if(resumed){
      if(!int(s.pausedAt,0))throw new Error('Повреждена отметка паузы сохранения');
      s.offset=(s.offset??0)-Math.max(0,Date.now()-s.pausedAt);
      delete s.pausedAt;
    }
    if(s.statistics!==undefined){
      for(const name of ['coinsSpent','orbsSpent','diamondsSpent','materialsFound','crystalRolls','crystalDrops']){
        const value=s.statistics?.[name];
        if(!Number.isInteger(value)||value<0)throw new Error('Повреждена статистика фермы');
      }
    }
        s.coins ??= 0;
    if(typeof s.coins==='number'&&Number.isFinite(s.coins)&&s.coins>=0)s.coins=Math.ceil(s.coins);
    s.harvestQuality ??= crops.map(()=>0);
    if(!Array.isArray(s.harvestQuality)||s.harvestQuality.length!==16||!s.harvestQuality.every((n:unknown)=>typeof n==="number"&&Number.isFinite(n)&&n>=0))throw new Error("Повреждено качество урожая");
    s.harvestValue ??= [...(s.harvest??[])];
    if(s.harvestValue.length===3)s.harvestValue=s.harvestValue.concat(Array(13).fill(0));
    if(!Array.isArray(s.harvestValue)||s.harvestValue.length!==16||!s.harvestValue.every((v:unknown)=>typeof v==="number"&&Number.isFinite(v)&&v>=0))throw new Error("Повреждена стоимость урожая");
    s.relics ??= 0;s.xray ??= false;
    if(!int(s.relics,0)||typeof s.xray!=="boolean")throw new Error("Повреждены предметы");
    s.mutationCheck ??= Date.now()+(s.offset??0)+30000;
    if(!int(s.mutationCheck,0))throw new Error("Повреждён таймер селекции");
    s.lines ??= [];
    const validGenome=(data:Genome)=>data && ['gr','ga','re'].every(id=>int(data.genes?.[id as keyof Genes],1,30)) &&
      data.powers && Object.entries(data.powers).every(([id,value])=>traitNames[id]&&typeof value==='number'&&Number.isFinite(value)&&value>=0);
    if(s.lines.some((line:Line)=>line.genes!==undefined||line.powers!==undefined ? !validGenome({genes:line.genes!,powers:line.powers!}):false))
      throw new Error('Повреждена генетика линии');
    s.lines.forEach((line:Line,i:number)=>{if(line){if(!line.name || /^Полевой гибрид /u.test(line.name))line.name="Гибрид #"+(i+1);if(Array.isArray(line.traits))line.traits=line.traits.slice(0,3);}});
    s.hybridSlots ??= Math.max(20,20+5*Math.ceil(Math.max(0,s.lines.length-20)/5));
    if(!int(s.hybridSlots,20))throw new Error("Повреждён размер инвентаря");
    if(!Array.isArray(s.lines)||!s.lines.every((line:Line)=>line && typeof line.name==="string" &&
      (line.archived===undefined||typeof line.archived==="boolean")&&int(line.crop,0,15)&&int(line.seeds,0)&&Array.isArray(line.traits)&&line.traits.length<=5&&line.traits.every(t=>traitNames[t])))
      throw new Error("Повреждены линии селекции");
    s.extraction ??= newExtraction();
    const machine=s.extraction;
    if(machine.history!==undefined&&(!Array.isArray(machine.history)||machine.history.length>12||machine.history.some(entry=>!entry||!int(entry.crop,0,15)||!int(entry.input,1,extractionCapacity)||!int(entry.seeds,0))))throw new Error('Повреждён журнал переработки');
    if(!int(machine.slots??1,1,3)|| (machine.extraJobs!==undefined&&(!Array.isArray(machine.extraJobs)||machine.extraJobs.length>2||machine.extraJobs.some((job,index)=>job!==null&&index+2>(machine.slots??1)))))throw new Error("Повреждены слоты экстрактора");
    if (!int(machine.speed,0) || !int(machine.yield,0) || !int(machine.processed,0) ||
        !int(machine.produced,0) || typeof machine.last!=="string")throw new Error("Повреждены данные экстрактора");
    machine.speed=Math.min(machine.speed,extractionSpeedMax);
    for(const job of extractionJobs(machine)){
      if
        (job!==null && (!job || !int(job.crop,0,15) || !int(job.input,1,extractionCapacity) ||
          !int(job.output,0) || !int(job.start,0) || !int(job.end,job.start)))
      throw new Error("Повреждены данные экстрактора");
    if(job) {
      if(job.completionOffsets!==undefined){
        const offsets=job.completionOffsets;
        if(!Array.isArray(offsets)||offsets.length!==job.input||offsets.at(-1)!==job.end-job.start||
          offsets.some((value,index)=>!int(value,index?offsets[index-1]:0)))throw new Error('Повреждены сроки переработки');
      }else if(job.end<=job.start)throw new Error('Повреждён срок переработки');
      if(job.unitValue!==undefined&&(typeof job.unitValue!=='number'||!Number.isFinite(job.unitValue)||job.unitValue<0))throw new Error('Повреждена стоимость сырья');
      job.done ??= 0;
      if(!job.outputs) {
        const base=Math.floor(job.output/job.input),remainder=job.output%job.input;
        job.outputs=Array.from({length:job.input},(_,i)=>base+(i<remainder?1:0));
      }
      if(!int(job.done,0,job.input) || !Array.isArray(job.outputs) || job.outputs.length!==job.input ||
         !job.outputs.every((n:unknown)=>int(n,0)) || total(job.outputs)!==job.output)
        throw new Error('Повреждена очередь экстрактора');
    }
    }
    if(s.rainSoaked!==undefined&&(!Array.isArray(s.rainSoaked)||s.rainSoaked.length!==s.size**2||s.rainSoaked.some(value=>typeof value!=='boolean')))throw new Error('Повреждена влажность пустых грядок');
    if(s.rainSoakedThrough!==undefined&&!int(s.rainSoakedThrough,0))throw new Error('Повреждена отметка дождя');
    s.discoveries ??= 0;
    s.discoveryUp ??= {speed:0,slots:0,amount:0};
    s.pendingDiscovery ??= [];
    if (!["speed","slots","amount"].every(id=>int(s.discoveryUp[id],0,discoveryLimit(id as DiscoveryUpgrade))) ||
        !Array.isArray(s.pendingDiscovery) || s.pendingDiscovery.length>3 ||
        !s.pendingDiscovery.every((item:{crop:number;amount:number})=>item && int(item.crop,0,15) && int(item.amount,1)))
      throw new Error("Повреждена рулетка коллекции");
    s.collection ??= crops.map((_,i)=> i===0 || s.seeds?.[i]>0 || s.harvest?.[i]>0 || s.plots?.some((p:Plant|null)=>p?.crop===i) ? 1 : 0);
    if (!int(s.discoveries,0) || !Array.isArray(s.collection) || s.collection.length!==crops.length ||
        !s.collection.every((value:unknown)=>int(value,0))) throw new Error("Повреждена коллекция");
    s.luck ??= 0;
    s.cascade ??= 0;
    s.skin ??= "glossy";
    s.levels ??= emptyLevels();
    s.convenience = {...emptyConveniences(),...s.convenience};
    s.automation ??= {irrigation:false,replant:false};
    if(s.automationRevision!==1){s.automation={irrigation:false,replant:false};s.automationRevision=1;}
    s.irrigationUntil ??= 0;s.replantCrop ??= null;
    if(!int(s.irrigationUntil,0) || s.replantCrop!==null && !int(s.replantCrop,0,15))
      throw new Error("Повреждены сеансы автоматизации");
    if(typeof s.automation.irrigation!=="boolean" || typeof s.automation.replant!=="boolean")
      throw new Error("Повреждены настройки автоматизации");
    s.glass ??= defaultGlass();
    if (s.glass.transparency === 42 && s.glass.strength === 65) s.glass = defaultGlass();
    if (!conveniences.every(({id}) => typeof s.convenience[id] === "boolean") ||
        !int(s.glass.transparency,0,100) || !int(s.glass.strength,0,100))
      throw new Error("Повреждены настройки фермы");
    if (!Array.isArray(s.levels) || s.levels.length !== crops.length ||
        !s.levels.every((level:CropLevels) => level && traits.every(({id}) => int(level[id],0,traitMax))))
      throw new Error("Повреждены уровни культур");
    s.offset ??= 0;
    delete s.scale;
    for (const field of ['seeds','harvest']) {
      if (Array.isArray(s[field]) && s[field].length === 3)
        s[field] = s[field].concat(Array(crops.length - 3).fill(0));
    }
    const counts = (a:unknown) => Array.isArray(a) && a.length === crops.length && a.every(n => int(n,0));
    if (!["classic","glossy"].includes(s.skin) || !int(s.cascade,0,cascadeMax) || !int(s.luck,0,luckMax) || !(typeof s.coins==="number"&&Number.isFinite(s.coins)&&s.coins>=0) || !int(s.offset,Number.MIN_SAFE_INTEGER) || !int(s.epoch,0) || !int(s.size,1,Math.max(10,maxSize)) || !counts(s.seeds) || !counts(s.harvest) ||
        !int(s.opened,0) || !Array.isArray(s.lastPack) || !int(s.lastPack.length,s.opened ? 1 : 0,s.opened ? packResultLimit : 0) ||
        !s.lastPack.every((n:unknown) => int(n,0,crops.length-1)) || !int(s.accent,0,4) ||
        !['light','dark'].includes(s.theme) || !Array.isArray(s.plots) || s.plots.length !== s.size**2 ||
        !s.plots.every((p:Plant|null) => p === null || (p && int(p.crop,0,crops.length-1) && int(p.planted,0) &&
          (p.ready === null || int(p.ready,p.planted)) &&
          (p.watered === undefined || (p.ready !== null && int(p.watered,p.planted,p.ready))) &&
          (p.wetUntil === undefined || int(p.wetUntil,p.planted)) &&
          (p.remaining === undefined || (Number.isFinite(p.remaining)&&p.remaining>0)) &&
          (p.duration === undefined || int(p.duration,1))))) throw new Error('Повреждённые данные фермы');
    s.collected ??= total(s.harvest) + s.coins;
    if (!int(s.collected,0)) throw new Error("Повреждён счётчик урожая");
    s.weather ??= newWeather(Date.now()+s.offset);
    s.weather.duration ??= 0;
    if (!int(s.weather.duration,0,weatherMax) || !int(s.weather.chance,0,weatherMax) || !int(s.weather.cooldown,0,weatherMax) ||
        !int(s.weather.next,0) || (s.weather.last !== null && !int(s.weather.last,0,s.weather.next-1)))
      throw new Error('Повреждены данные погоды');
    if (s.weather.end === undefined) {
      s.weather.end = s.weather.last === null ? null : s.weather.last+120_000+10_000*s.weather.duration;
      if (s.weather.end !== null) {
        const eligible = Math.max(Date.now()+s.offset,s.weather.end+rainCooldown(s.weather.cooldown));
        s.weather.next = rainRoll(eligible,s.weather.cooldown);
      }
    }
    if (s.weather.last === null ? s.weather.end !== null :
        !int(s.weather.end,s.weather.last+1,s.weather.next-1)) throw new Error('Повреждена длительность дождя');
    if(s.plots.some((p:Plant|null)=>p?.line!==undefined && (!int(p.line,0,s.lines.length-1)||s.lines[p.line].crop!==p.crop))) throw new Error("Повреждено растение линии");
    if(s.plots.some((p:Plant|null)=>p?.mystery && (!Array.isArray(p.mystery.parents)||p.mystery.parents.length!==2||!p.mystery.parents.every(i=>int(i,0,15))||!Array.isArray(p.mystery.traits)||p.mystery.traits.length>10||!p.mystery.traits.every(t=>traitNames[t]))))throw new Error("Повреждена мутация");
    if(s.plots.some((plot:Plant|null)=>plot?.mystery?.genomes && (plot.mystery.genomes.length!==2 || !plot.mystery.genomes.every(validGenome))))throw new Error("Повреждена генетика родителей");
    for(const plot of s.plots)if(plot?.mystery){
      if(plot.mystery.preview && !plot.mystery.preview.parents && plot.mystery.genomes){
        plot.mystery.preview.parents=plot.mystery.genomes.map((data:Genome,i:number)=>({name:plot.mystery.parentNames?.[i]??crops[plot.mystery.parents[i]].name,crop:plot.mystery.parents[i],genome:cloneGenome(data)}));
      }
      if(plot.mystery.preview){
        const line=plot.mystery.preview;
        if(!int(line.crop,0,15)||!validGenome({genes:line.genes,powers:line.powers})||!Array.isArray(line.traits)||line.traits.length>3||!line.traits.every((t:string)=>traitNames[t]))throw new Error("Повреждён генотип находки");
      }else plot.mystery.preview=generateMutationLine(s,plot);
    }
    s.rot ??= Array(s.plots.length).fill(null);
    if(!Array.isArray(s.rot)||s.rot.length!==s.plots.length||!s.rot.every((r:RotRecord|null)=>r===null||(r&&int(r.crop,0,15)&&int(r.at,0)&&int(r.checks,1)&&typeof r.risk==="number"&&r.risk>=0&&r.risk<=1&&typeof r.value==="number"&&Number.isFinite(r.value)&&r.value>=0&&typeof r.name==="string"&&validGenome(r.genome))))throw new Error("Повреждена история гнили");
    for(const line of s.lines)if(line.parents && (!Array.isArray(line.parents)||line.parents.length!==2||!line.parents.every((p:ParentRecord)=>p&&typeof p.name==="string"&&int(p.crop,0,15)&&validGenome(p.genome))))throw new Error("Повреждена родословная");
    s.harvested??=s.harvest.map((count:number)=>count);
    if(!Array.isArray(s.harvested)||s.harvested.length!==crops.length||!s.harvested.every((n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&n>=0))throw new Error('Повреждена коллекция урожая');
    s.resources??=newResources();
    s.resources.barriers??={};s.resources.irrigation??=0;
    if(!s.resources.barriers||!int(s.resources.irrigation,0))throw new Error('Повреждены ресурсные улучшения');
    for(const [key,value] of Object.entries(s.resources.barriers))if(!/^([0-9]|1[0-5]):(growth|yield|moisture)$/.test(key)||!int(value,0))throw new Error('Повреждены барьеры');
    for(let crop=0;crop<crops.length;crop++)for(const {id} of traits){const key=crop+':'+id;s.resources.barriers[key]=Math.max(s.resources.barriers[key]??0,s.levels[crop][id]>10?Math.ceil(s.levels[crop][id]/50):0);}
    if(!s.resources||!int(s.resources.orbs,0)||!int(s.resources.duplication,0)||!s.resources.items||!s.resources.found)throw new Error('Повреждены ресурсы');
    for(const [id,count] of Object.entries(s.resources.items))if(!materials.some(item=>item.id===id)||!int(count,0))throw new Error('Повреждён материал');
    for(const [id,value] of Object.entries(s.resources.found))if(!materials.some(item=>item.id===id)||typeof value!=='boolean')throw new Error('Повреждена коллекция предметов');
    const validateEnhancements=(data:Genome|Line)=>{if(data.enhancements&&Object.entries(data.enhancements).some(([id,n])=>!traitNames[id]||!int(n,0,100)))throw new Error('Повреждены усиления');};
    for(const line of s.lines){validateEnhancements(line);for(const parent of line.parents??[])validateEnhancements(parent.genome);}
    for(const plot of s.plots)if(plot?.mystery){if(plot.mystery.preview){validateEnhancements(plot.mystery.preview);plot.mystery.preview.enhancements={};}for(const data of plot.mystery.genomes??[])validateEnhancements(data);}
    const weatherMigrated=s.weather.intervalVersion!==2;
    if(weatherMigrated){
      const weather=s.weather;
      if(weather.intervalVersion!==1)s.coins+=5*weather.chance*(weather.chance+1);
      weather.chance=0;
      weather.next=rainRoll(Math.max(Date.now()+s.offset,weather.end??0),weather.cooldown);
      weather.intervalVersion=2;
    }
    if(s.wheels!==undefined){
      const wheel=s.wheels;
      if(!wheel?.accounts||!int(wheel.orbBoost,0)||Object.entries(wheel.accounts).some(([kind,account])=>
        !['coins','orbs','diamonds'].includes(kind)||!account||!int(account.seed,0,2**32-1)||!int(account.bank,0)||!int(account.carry,0,19)))
        throw new Error('Повреждено колесо фортуны');
      if(wheel.choice&&(!int(wheel.choice.amount,1)||!Array.isArray(wheel.choice.items)||wheel.choice.items.length<1||
        wheel.choice.items.length>3||!wheel.choice.items.every(id=>materials.some(item=>item.id===id&&item.category==='properties'))))
        throw new Error('Повреждён приз колеса');
    }
    s.diamonds??=newDiamonds();
    const diamonds=s.diamonds;
    if(!Number.isInteger(diamonds.balance)||diamonds.balance<0||
      ![diamonds.charge,diamonds.coinCarry,diamonds.discountCarry].every(value=>Number.isFinite(value)&&value>=0&&value<=1)||
      !Array.isArray(diamonds.sets)||diamonds.sets.length!==4||!diamonds.sets.every(value=>typeof value==='boolean')||
      !diamonds.levels||Object.entries(diamonds.levels).some(([branch,level])=>!Object.hasOwn(diamondBranches,branch)||!int(level,0)))
      throw new Error('Повреждены алмазные улучшения');
    const awardedSets=awardDiamondSets(s);
    finishDiscovery(s);
    migratePackProgress(s);
    if(finishPackOpening(s)||weatherMigrated||awardedSets||resumed)saveFarm(s);
    return s;
  } catch (error) {
    storageError = true;
    console.error('Ферма: ошибка загрузки сохранения',error);
    return newFarm();
  }
}
function saveFarm(state:Farm,targetKey=key) {
  try {
    localStorage.setItem(targetKey,JSON.stringify(state));
    storageError = false;
    return true;
  } catch (error) {
    storageError = true;
    console.error('Ферма: ошибка записи сохранения',error);
    return false;
  }
}






























