// legacySlot is the numeric identity stored in existing saves. Never reuse it.
type CropDefinition={
  id:`farm:${string}`;legacySlot:number;name:string;symbol:string;color:string;
  seconds:number;tier:number;price:number;set:number;assetFolder:string;
  powers:Record<string,number>;
};
const cropCatalog:CropDefinition[]=[
  {id:"farm:radish",legacySlot:0,name:"Редис",symbol:"🫜",color:"#d87882",
   seconds:120,tier:0,price:5,set:0,assetFolder:"radish",powers:{"growth":5}},
  {id:"farm:lettuce",legacySlot:1,name:"Листовой салат",symbol:"🥬",color:"#91ad68",
   seconds:360,tier:1,price:150,set:0,assetFolder:"lettuce",powers:{"sprout":5}},
  {id:"farm:zucchini",legacySlot:2,name:"Кабачок",symbol:"🟢",color:"#b4ae65",
   seconds:270,tier:0,price:20,set:3,assetFolder:"zucchini",powers:{"bounty":3}},
  {id:"farm:peas",legacySlot:3,name:"Горох",symbol:"🫛",color:"#9aae73",
   seconds:780,tier:1,price:1200,set:3,assetFolder:"peas",powers:{"pod":5}},
  {id:"farm:beetroot",legacySlot:4,name:"Свёкла",symbol:"🔴",color:"#9aae73",
   seconds:1080,tier:2,price:10000,set:0,assetFolder:"beetroot",powers:{"sweet":8}},
  {id:"farm:onion",legacySlot:5,name:"Лук",symbol:"🧅",color:"#9aae73",
   seconds:150,tier:0,price:8,set:1,assetFolder:"onion",powers:{"moisture":10}},
  {id:"farm:garlic",legacySlot:6,name:"Чеснок",symbol:"🧄",color:"#9aae73",
   seconds:480,tier:1,price:300,set:1,assetFolder:"garlic",powers:{"resistance":1}},
  {id:"farm:potato",legacySlot:7,name:"Картофель",symbol:"🥔",color:"#9aae73",
   seconds:210,tier:0,price:12,set:2,assetFolder:"potato",powers:{"regrow":5}},
  {id:"farm:carrot",legacySlot:8,name:"Морковь",symbol:"🥕",color:"#9aae73",
   seconds:2520,tier:3,price:250000,set:0,assetFolder:"carrot",powers:{"drought":10}},
  {id:"farm:cucumber",legacySlot:9,name:"Огурцы",symbol:"🥒",color:"#9aae73",
   seconds:2040,tier:2,price:80000,set:3,assetFolder:"cucumber",powers:{"leap":1}},
  {id:"farm:tomato",legacySlot:10,name:"Помидоры",symbol:"🍅",color:"#9aae73",
   seconds:600,tier:1,price:600,set:2,assetFolder:"tomato",powers:{"value":2,"stability":0}},
  {id:"farm:bell_pepper",legacySlot:11,name:"Болгарский перец",symbol:"🫑",color:"#9aae73",
   seconds:1680,tier:2,price:40000,set:2,assetFolder:"bell-pepper",powers:{"catalyst":5}},
  {id:"farm:eggplant",legacySlot:12,name:"Баклажаны",symbol:"🍆",color:"#9aae73",
   seconds:3240,tier:3,price:650000,set:2,assetFolder:"eggplant",powers:{"sunshine":8}},
  {id:"farm:cabbage",legacySlot:13,name:"Белокочанная капуста",symbol:"🥬",color:"#9aae73",
   seconds:1380,tier:2,price:20000,set:1,assetFolder:"cabbage",powers:{"head":10}},
  {id:"farm:cauliflower",legacySlot:14,name:"Цветная капуста",symbol:"🥦",color:"#9aae73",
   seconds:2880,tier:3,price:400000,set:1,assetFolder:"cauliflower",powers:{"mutation":2}},
  {id:"farm:celery",legacySlot:15,name:"Сельдерей",symbol:"🌿",color:"#9aae73",
   seconds:3600,tier:3,price:1000000,set:3,assetFolder:"celery",powers:{"renew":3}}
];
const crops=[...cropCatalog].sort((a,b)=>a.legacySlot-b.legacySlot);
const cropsById=new Map<string,CropDefinition>(crops.map(crop=>[crop.id,crop]));
if(cropsById.size!==crops.length||crops.some((crop,index)=>crop.legacySlot!==index))throw new Error('Повтор ID или разрыв номеров в каталоге культур');
const cropTiers=crops.map(crop=>crop.tier);
const cropTimes=crops.map(crop=>crop.seconds);
const cropPrices=crops.map(crop=>crop.price);
const basePowers=crops.map(crop=>crop.powers);
const cropFolders=crops.map(crop=>crop.assetFolder);
const baseRarityNames=['Обычная','Редкая','Эпическая','Легендарная'];

const cropSets=[
  {name:"Корнеплоды и зелень",bonus:"×1,1 к скорости роста всех культур"},
  {name:"Луковые и капустные",bonus:"×1,25 к удержанию влаги всех культур"},
  {name:"Паслёновые",bonus:"+1 гарантированного урожая всем культурам"},
  {name:"Бахчевые и бобовые",bonus:"×2 к скорости роста и +5 урожая всем культурам"}
].map((set,index)=>({
  ...set,
  crops:crops.filter(crop=>crop.set===index).sort((a,b)=>a.tier-b.tier).map(crop=>crop.legacySlot)
}));

const traitNames:Record<string,string>={growth:'⚡ +10% скорости',yield:'🧺 +1 урожая',regrow:'🌱 +5% отрастания',value:'🍅 Рост цены',stability:'💀 Стабильность гнили',catalyst:'🫑 Усиление свойств'};
