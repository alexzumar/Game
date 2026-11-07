type Material={id:string;contentId:string;icon:string;name:string;description:string;category:'sets'|'properties'|'special'};
const materialNames:Record<string,[string,string,string]>={
  growth: ["growth_spark","⏱️","Искра скороспелости"],
  sprout: ["sprout_knot","🤝","Узел всходов"],
  bounty: ["abundance_zucchini","💠","Кабачок изобилия"],
  pod: ["lucky_pea","🎰","Счастливая горошина"],
  sweet: ["sugar_crystal","🍬","Сахарный кристалл"],
  moisture: ["moisture_drop","💧","Капля запаса"],
  resistance: ["warding_core","🧿","Защитная сердцевина"],
  regrow: ["regrowth_bud","🔄","Почка отрастания"],
  drought: ["root_anchor","⚓","Корневой стержень"],
  leap: ["growth_impulse","🚀","Импульс роста"],
  value: ["ripening_grain","⌛","Песчинка дозревания"],
  stability: ["decay_spore","💀","Спора распада"],
  catalyst: ["catalytic_essence","🧪","Каталитическая эссенция"],
  sunshine: ["heat_grain","🔥","Тепловое зерно"],
  head: ["dense_core","🏋️","Плотное ядро"],
  mutation: ["mutable_fragment","🎲","Изменчивый фрагмент"],
  renew: ["renewal_spiral","🌀","Спираль возобновления"]
};
const materials:Material[]=[
 {id:'set0',contentId:'farm:growth_concentrate',icon:'🌱',name:'Ростовой концентрат',description:'Нужен для открытия дополнительных слотов экстрактора. Выпадает с урожая «Корнеплоды и зелень» и при переработке плодов. Шанс за плод в экстракторе — 2% для этого набора, 0,1% для остальных.',category:'sets'},
 {id:'set1',contentId:'farm:plant_fiber',icon:'🧵',name:'Растительное волокно',description:'Нужно для дополнительных слотов пакетов, возврата за повторки и легендарной удачи.',category:'sets'},
 {id:'set2',contentId:'farm:active_extract',icon:'⚗️',name:'Активный экстракт',description:'Оплачивает уровни возврата за повторки выше 20% после снятия барьера.',category:'sets'},
 {id:'set3',contentId:'farm:renewal_core',icon:'🌀',name:'Ядро возобновления',description:'Нужно для пятого слота открытия пакетов и позднего улучшения легендарной удачи.',category:'sets'},
 ...Object.entries(materialNames).map(([id,[contentName,icon,name]])=>({contentId:'farm:'+contentName,id:'property:'+id,icon:abilityDefinitions[id]?.icon??icon,name,description:'Усиление свойства «'+(abilityDefinitions[id]?.name??traitNames[id])+'» конкретного гибрида. '+(abilityDefinitions[id]?.description??'Увеличивает урожай.'),category:'properties' as const})),
 {id:'duplication',contentId:'farm:duplication_crystal',icon:'✨',name:'Кристалл дублирования',description:'Шанс от 0,15% до 4,5% за обычный плод, пропорционально базовому времени роста. Покупает шанс дополнительных копий материалов. Не дублируется сам.',category:'special'}
];

const materialsById=new Map(materials.map(material=>[material.contentId,material]));
const materialsBySaveKey=new Map(materials.map(material=>[material.id,material]));

if(materialsById.size!==materials.length||materialsBySaveKey.size!==materials.length)throw new Error('Повтор ID в каталоге материалов');
