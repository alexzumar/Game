var alphaReady=true;
const resourcesDialog=get<HTMLDialogElement>('resources-dialog');
let resourceCategory='cultures',resourceSignature='';
button('resources-open').onclick=()=>{renderAlpha();resourcesDialog.showModal();};
resourcesDialog.addEventListener('click',event=>{if(event.target!==resourcesDialog)return;const r=resourcesDialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)resourcesDialog.close();});
button('collection-open').addEventListener('click',()=>resourcesDialog.close());
for(const tab of document.querySelectorAll<HTMLButtonElement>('[data-resource-tab]'))tab.onclick=()=>{resourceCategory=tab.dataset.resourceTab!;resourceSignature='';renderAlpha();};
const enhancePanel=document.createElement('section');enhancePanel.className='glass panel';
enhancePanel.innerHTML='<h2>✨ Усиление свойств</h2><p id="enhance-panel-description">Выбери гибрид и свойство. При успехе усиление растёт на 1 уровень, при неудаче падает на 1.</p><label>Гибрид <select id="enhance-line" aria-label="Гибрид для усиления"></select></label><div id="enhance-options"></div><p id="enhance-result" role="status"></p>';
addUpgradeDetails(enhancePanel.querySelector('p')!,'Попытка всегда тратит один материал. Максимальное усиление — +100% к силе свойства. Для переноса усиления сначала собери оба гибрида с грядок.');
get('upgrade-hybrids').prepend(enhancePanel);
get('enhance-line').onchange=renderEnhancements;
const duplicatePanel=document.createElement('section');duplicatePanel.className='glass panel';duplicatePanel.innerHTML='<h2>✨ Дублирование материалов</h2><p id="duplicate-info"></p><button class="quiet" id="buy-duplicate"></button>';
get('upgrade-tools').append(duplicatePanel);
addUpgradeDetails(get('duplicate-info'),'Бонус действует на найденные материалы. Орбы и алмазы не удваиваются.');
button('buy-duplicate').onclick=()=>{if(buyDuplication(farm))commit('Дублирование улучшено.');};
const orbLuckPanel=document.createElement('section');
orbLuckPanel.className='glass panel';
orbLuckPanel.innerHTML='<h2>🔮 Удача добычи орбов</h2><p>Повышает шанс получить максимум, когда плоду выпадает добыча орбов.</p><p id="orb-luck-info"></p><button class="quiet" id="buy-orb-luck"></button>';
get('upgrade-tools').append(orbLuckPanel);
button('buy-orb-luck').onclick=()=>{if(buyOrbLuck(farm))commit('Удача добычи орбов улучшена.');};
function renderAlpha(){
 if(get<HTMLDialogElement>('diamonds-dialog').open)renderDiamondShop();
 get('resource-upgrade-title').dataset.upgradeTarget=resourceCategory==='cultures'?'discovery':resourceCategory==='properties'?'hybrids':resourceCategory==='special'?'tools':'seeds';
 get('orbs').textContent=number(farm.resources.orbs);get('upgrade-orbs').textContent=number(farm.resources.orbs);
 get('mutation-points').textContent=number(farm.mutationPoints??0);
 get('resources-balance').textContent='🪙 '+number(farm.coins)+' · 🔮 '+number(farm.resources.orbs)+' · 🧬 '+number(farm.mutationPoints??0);
 if(typeof refinementReady!=='undefined'&&refinementReady)renderResourceCollections();
 const level=farm.resources.duplication;
 const duplicationPercent=(rank:number)=>rank?1+(rank-1)*.1:0;
 const copyEffect=(percent:number)=>{
   const copies=1+Math.floor(percent/100),extra=percent%100;
   if(copies===1)return formatChance(extra)+'% на двойную порцию';
   return 'Всегда ×'+copies+(extra?' · '+formatChance(extra)+'% получить ×'+(copies+1):'');
 };
 renderUpgradeChange(get('duplicate-info'),level,copyEffect(duplicationPercent(level)),copyEffect(duplicationPercent(level+1)));
 button('buy-duplicate').textContent='✨ '+number(duplicationPrice(level));button('buy-duplicate').disabled=(farm.resources.items.duplication??0)<duplicationPrice(level);
 renderMaterialPriceTip(button('buy-duplicate'),['duplication']);
 const orbLuck=farm.resources.orbLuck;
 const orbLuckCapped=orbLuck>=orbLuckMax;
 const orbEffect=(rank:number)=>'Максимум орбов: '+formatChance(orbMaximumChance(0,rank)*100)+'% у обычных, '+formatChance(orbMaximumChance(1,rank)*100)+'% у остальных';
 renderUpgradeChange(get('orb-luck-info'),orbLuck,orbEffect(orbLuck),orbLuckCapped?undefined:orbEffect(orbLuck+1));
 button('buy-orb-luck').textContent=orbLuckCapped?'Максимальный уровень':'🔮 '+number(orbLuckPrice(orbLuck));
 button('buy-orb-luck').disabled=orbLuckCapped||farm.resources.orbs<orbLuckPrice(orbLuck);
 const selector=get<HTMLSelectElement>('enhance-line'),previous=selector.value;
 const ids=farm.lines.map((line,i)=>({line,i})).filter(({line})=>!line.archived&&line.seeds>0);
 const lineSignature=ids.map(({line,i})=>i+':'+line.name).join('|');
 if(selector.dataset.signature!==lineSignature){selector.dataset.signature=lineSignature;selector.replaceChildren(...ids.map(({line,i})=>new Option(line.name+' · #'+(i+1),String(i))));if(ids.some(({i})=>String(i)===previous))selector.value=previous;else selector.value='';}
 renderEnhancements();
}
function renderEnhancements(){
 const host=get('enhance-options'),index=get<HTMLSelectElement>('enhance-line').value===''?-1:Number(get<HTMLSelectElement>('enhance-line').value),line=farm.lines[index];
 const signature=JSON.stringify([index,line?.enhancements,line?.powers,line?.seeds,farm.resources.items,farm.lines.map(item=>[item.enhancements,item.seeds,item.archived]),farm.plots.map(plot=>plot?.line)]);
 if(typeof refinementReady!=='undefined'&&refinementReady)renderEnhancementSelection();
 if(host.dataset.signature===signature)return;host.dataset.signature=signature;
 host.replaceChildren();if(!line||line.archived||line.seeds<1){host.textContent='Забери гибрид в инвентарь, чтобы усилить его свойства.';return;}
 for(const id of line.traits){
 const level=line.enhancements?.[id]??0,material=materials.find(item=>item.id===propertyMaterialId(id))!;
 const row=document.createElement('section');row.className='glass enhancement-row';
 const text=document.createElement('p');text.textContent=powerLabel(line,id)+' · успех '+Math.round(enhancementChance(level)*100)+'%';
 const buy=document.createElement('button');buy.className='quiet';buy.textContent=level>=100?'Максимум':material.icon+' 1';buy.title=material.name+' · в запасе '+number(farm.resources.items[material.id]??0);buy.disabled=level>=100||line.powers?.[id]===0||(farm.resources.items[material.id]??0)<1;
 if(line.powers?.[id]===0)buy.textContent='Сначала повысь свойство селекцией';
 buy.onclick=()=>{
  const result=enhanceProperty(farm,index,id);
  if(!result)return;
  const message=result==='success'?'Успех! Усиление +1%.':
    result==='shielded'?'🛡️ Щит сохранил усиление. Материал израсходован.':
    'Неудача. Усиление снизилось на один уровень.';
  get('enhance-result').textContent=message;
  commit(message);
  if(result==='shielded'){
    const preview=get('enhancement-preview');
    preview.querySelector('.enhancement-shield')?.remove();
    const badge=document.createElement('span');
    badge.className='enhancement-shield';
    badge.textContent='🛡️';
    badge.setAttribute('aria-hidden','true');
    preview.append(badge);
    setTimeout(()=>badge.remove(),1100);
  }
 };
 row.append(text,buy);
 if(typeof refinementReady!=='undefined'&&refinementReady){const move=document.createElement('button');move.className='quiet transfer-enhancement';move.dataset.property=id;move.textContent='Перенести с другой линии';move.disabled=!farm.lines.some((_,source)=>canTransferEnhancement(farm,source,index,id));move.title='Выбери источник с большим усилением. Обе линии должны быть полностью собраны с грядок.';move.onclick=()=>startEnhancementTransfer(index,id);row.append(move);}
 host.append(row);
 }
}
function renderEnhancementShortcut(){
 button('hybrid-enhance').onclick=()=>openEnhancement(detailLine);
}
renderAlpha();

const debugResources=document.createElement('div');debugResources.className='debug-resource-tools';debugResources.innerHTML='<label>Орбы <input type="number" id="debug-orbs" min="1" max="1000000000" value="1000" aria-label="Добавить орбы клавишей Enter"></label><button class="quiet" id="debug-materials">+100 всех материалов</button>';document.querySelector('.debug')!.append(debugResources);
get('debug-orbs').addEventListener('keydown',event=>{if(event.key!=='Enter')return;event.preventDefault();const count=get<HTMLInputElement>('debug-orbs').valueAsNumber;if(!Number.isSafeInteger(count)||count<1||count>1e9)return;farm.resources.orbs+=count;commit('Отладка: добавлены орбы.');});
button('debug-materials').onclick=()=>{for(const item of materials)addMaterial(farm,item.id,100,false);commit('Отладка: добавлено по 100 материалов.');};

const specificMaterialTools=document.createElement('div');specificMaterialTools.className='debug-material-picker';
specificMaterialTools.innerHTML='<label>Материал <select id="debug-material-type" aria-label="Тип материала"></select></label><label>Количество <input id="debug-material-count" type="number" min="1" max="1000000000" value="1000"></label><button class="quiet" id="debug-material-add">Добавить материал</button>';
debugResources.append(specificMaterialTools);
get<HTMLSelectElement>('debug-material-type').add(new Option('🔮 Орбы','orbs'));
for(const material of materials)get<HTMLSelectElement>('debug-material-type').add(new Option(material.icon+' '+material.name,material.id));
get<HTMLSelectElement>('debug-material-type').value='property:growth';
function grantDebugMaterial(){const count=get<HTMLInputElement>('debug-material-count').valueAsNumber,id=get<HTMLSelectElement>('debug-material-type').value;if(!Number.isSafeInteger(count)||count<1||count>1e9||(id!=='orbs'&&!materials.some(item=>item.id===id)))return;if(id==='orbs')farm.resources.orbs+=count;else addMaterial(farm,id,count,false);commit('Отладка: добавлен выбранный материал ×'+number(count));}
button('debug-material-add').onclick=grantDebugMaterial;get('debug-material-count').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();grantDebugMaterial();}});


const diamondDialog=get<HTMLDialogElement>('diamonds-dialog');
const diamondPercent=(fraction:number)=>fraction.toLocaleString('ru-RU',{style:'percent',maximumFractionDigits:4});
const diamondDescriptions:Record<DiamondBranch,string>={
  find:'Алмазы чаще выпадают при сборе.',
  double:'Шанс получить второй алмаз при находке.',
  charge:'Сбор наполняет заряд. Полный заряд даёт алмаз.',
  income:'Плоды гибридов продаются дороже.',
  seedReturn:'Экстрактор чаще выдаёт максимум семян.',
  dryGrowth:'Растения продолжают расти без воды.',
  fruit:'Горшки приносят больше плодов.',
  extract:'Экстрактор может обработать плод раньше.',
  discount:'Семена в магазине стоят дешевле.',
  enhancementShield:'Щит может сохранить усиление при неудаче.'
};
const diamondEffects:Record<DiamondBranch,(level:number)=>string>={
  find:level=>'×'+number(1+level*.25),
  double:level=>diamondPercent(diamondDoubleChance(level)),
  charge:level=>diamondPercent(level?1-.9*.99**(level-1):0)+' в заряд',
  income:level=>'×'+number(diamondHybridValue(level)),
  seedReturn:level=>diamondPercent(diamondMaxSeedsChance(extractionRange(farm.extraction.yield).max,level)),
  dryGrowth:level=>diamondPercent(diamondDryGrowth(level))+' скорости',
  fruit:level=>'×'+number(diamondPotFruit(level)),
  extract:level=>'До '+diamondPercent(diamondCurve(level)),
  discount:level=>diamondPercent(.5*(1-.9**level))+' скидки',
  enhancementShield:level=>diamondPercent(enhancementShieldChance(level))
};
const diamondCards=Object.entries(diamondBranches).map(([id,label])=>{
  const branch=id as DiamondBranch;
  const card=document.createElement('section');
  card.className='glass panel';
  const title=document.createElement('h3');
  title.textContent=label;
  const detail=document.createElement('p');
  const buy=document.createElement('button');
  buy.className='quiet';
  buy.onclick=()=>{
    const now=nowTime();
    applyRain(farm,now);
    updatePlantAbilities(farm,now);
    if(!buyDiamondUpgrade(farm,branch))return;
    if(branch==='dryGrowth')for(const plot of farm.plots)if(plot&&plot.ready===null)plot.dryThrough=now;
    commit('Улучшение куплено.');
    renderDiamondShop();
  };
  card.append(title,detail,buy);
  const charge=document.createElement('small');
  if(branch==='find')addUpgradeDetails(detail,'Точный шанс зависит от культуры и указан в коллекции.');
  if(branch==='seedReturn')addUpgradeDetails(detail,'Карточка показывает шанс для обычного выхода. При расширении диапазона бонус применяется к новому максимуму.');
  if(branch==='enhancementShield')addUpgradeDetails(detail,'При срабатывании щита уровень остаётся прежним. Материал расходуется.');
  if(branch==='charge'){
    addUpgradeDetails(detail,'Каждый сбор добавляет немного заряда, даже если алмаз не выпал. Чем выше шанс найти алмаз, тем больше заряд за сбор. За каждые 100% заряда получаешь дополнительный алмаз.');
    buy.before(charge);
  }
  get('diamond-upgrades').append(card);
  return {branch,detail,buy,charge};
});
function renderDiamondShop(){
  const state=farm.diamonds;
  get('diamond-shop-balance').textContent=number(state?.balance??0);
  for(const {branch,detail,buy,charge} of diamondCards){
    const level=diamondLevel(farm,branch),price=diamondPrice(level);
    renderUpgradeChange(detail,level,diamondEffects[branch](level),Number.isFinite(price)?diamondEffects[branch](level+1):undefined,'',diamondDescriptions[branch]);
    if(branch==='charge')charge.textContent='Накоплено '+diamondPercent(state?.charge??0)+' из 100%';
    buy.textContent=Number.isFinite(price)?'💎 '+number(price):'Цена слишком велика';
    buy.disabled=!Number.isFinite(price)||(state?.balance??0)<price;
  }
}
button('diamonds-open').onclick=()=>{renderDiamondShop();diamondDialog.showModal();};
