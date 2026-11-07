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
const total = (counts:number[]) => counts.reduce((sum,count) => sum + count,0);
const newFarm = ():Farm => {
  const now = Date.now();
  return {packProgress:newPackProgress(),harvested:crops.map(()=>0),resources:newResources(),rot:[null],harvestQuality:crops.map(()=>0),harvestValue:crops.map(()=>0),relics:0,xray:false,hybridSlots:20,mutationCheck:now+30000,lines:[],automationRevision:1,irrigationUntil:0,replantCrop:null,automation:{irrigation:false,replant:false},extraction:newExtraction(),discoveryUp:{speed:0,slots:0,amount:0},pendingDiscovery:[],collection:crops.map((_,i)=>i===0?1:0),discoveries:0,convenience:emptyConveniences(),glass:defaultGlass(),epoch:now,size:1,plots:[null],seeds:crops.map((_,i)=>i===0?1:0),harvest:crops.map(()=>0),
    levels:emptyLevels(),coins:0,luck:0,cascade:0,skin:'glossy',collected:0,offset:0,opened:0,lastPack:[],
    theme:'light',accent:0,weather:newWeather(now)};
};
