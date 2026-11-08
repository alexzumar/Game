var alphaReady=true;
const resourcesDialog=get<HTMLDialogElement>('resources-dialog');
let resourceCategory='cultures',resourceSignature='';
button('resources-open').onclick=()=>{renderAlpha();resourcesDialog.showModal();};
resourcesDialog.addEventListener('click',event=>{if(event.target!==resourcesDialog)return;const r=resourcesDialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)resourcesDialog.close();});
button('collection-open').addEventListener('click',()=>resourcesDialog.close());
for(const tab of document.querySelectorAll<HTMLButtonElement>('[data-resource-tab]'))tab.onclick=()=>{resourceCategory=tab.dataset.resourceTab!;resourceSignature='';renderAlpha();};
const enhancePanel=document.createElement('section');enhancePanel.className='glass panel';
enhancePanel.innerHTML='<h2>✨ Усиление свойств</h2><p>Сила свойства сохраняется отдельно. Успех: +1% усиления, неудача: −1 уровень. Материал расходуется всегда. Максимум +100%. Усиление закреплено за линией. На другую линию его можно перенести. Для переноса сначала собери обе линии с грядок.</p><label>Гибрид <select id="enhance-line" aria-label="Гибрид для усиления"></select></label><div id="enhance-options"></div><p id="enhance-result" role="status"></p>';
get('upgrade-hybrids').prepend(enhancePanel);
get('enhance-line').onchange=renderEnhancements;
const duplicatePanel=document.createElement('section');duplicatePanel.className='glass panel';duplicatePanel.innerHTML='<h2>✨ Дублирование материалов</h2><p id="duplicate-info"></p><button class="quiet" id="buy-duplicate"></button>';
get('upgrade-tools').append(duplicatePanel);
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
 const level=farm.resources.duplication,chance=level?1+(level-1)*.1:0;
 get('duplicate-info').textContent='Шанс: '+formatChance(chance)+'% · '+Math.floor(chance/100)+' дополнительных копий гарантированно + '+formatChance(chance%100)+'% ещё одной. Орбы и кристалл не дублируются.';
 button('buy-duplicate').textContent='Улучшить · ✨ '+number(duplicationPrice(level));button('buy-duplicate').disabled=(farm.resources.items.duplication??0)<duplicationPrice(level);
 const orbLuck=farm.resources.orbLuck;
 const orbLuckCapped=orbLuck>=orbLuckMax;
 const orbChance=(tier:number)=>formatChance(orbMaximumChance(tier,orbLuck)*100)+'%'+
   (orbLuckCapped?'':' → '+formatChance(orbMaximumChance(tier,orbLuck+1)*100)+'%');
 get('orb-luck-info').textContent='Ур. '+orbLuck+'/'+orbLuckMax+' · Обычные '+orbChance(0)+' · Остальные '+orbChance(1);
 button('buy-orb-luck').textContent=orbLuckCapped?'Максимальный уровень':'Улучшить · 🔮 '+number(orbLuckPrice(orbLuck));
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
 const buy=document.createElement('button');buy.className='quiet';buy.textContent=level>=100?'Максимальное усиление':'Усилить · '+material.icon+' 1 (есть '+number(farm.resources.items[material.id]??0)+')';buy.disabled=level>=100||line.powers?.[id]===0||(farm.resources.items[material.id]??0)<1;
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
 let action=document.getElementById('hybrid-enhance');if(!action){action=document.createElement('button');action.id='hybrid-enhance';action.className='quiet';action.textContent='✨ Усилить свойства';get('hybrid-detail-traits').after(action);}
 action.onclick=()=>openEnhancement(detailLine);
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
const diamondEffects:Record<DiamondBranch,(level:number)=>string>={
  find:level=>'+'+level+'% к базовому шансу. Редис: '+diamondPercent(.0005*(1+level/100))+' за грядку.',
  double:level=>diamondPercent(level*.0005)+' дополнительной добычи при находке.',
  charge:level=>diamondPercent(level?1-.9*.99**(level-1):0)+' ожидаемой добычи добавляется в заряд.',
  income:level=>level+'% цены плодов начисляется сразу при сборе.',
  seedReturn:level=>diamondPercent(diamondCurve(level))+' шанс получить обычное семя за грядку.',
  dryGrowth:level=>diamondPercent(diamondCurve(level))+' обычной скорости на сухой грядке.',
  fruit:level=>level+'% дополнительного урожая в пересчёте на один плод за грядку.',
  extract:level=>'Шанс закончить плод раньше растёт каждую секунду до '+diamondPercent(diamondCurve(level))+'.',
  discount:level=>diamondPercent(.5*(1-.9**level))+' скидки в магазине семян.',
  enhancementShield:level=>diamondPercent(enhancementShieldChance(level))+' защитить уровень усиления при неудаче. Материал расходуется.'
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
  get('diamond-upgrades').append(card);
  return {branch,detail,buy};
});
function renderDiamondShop(){
  const state=farm.diamonds;
  get('diamond-shop-balance').textContent=number(state?.balance??0);
  for(const {branch,detail,buy} of diamondCards){
    const level=diamondLevel(farm,branch),price=diamondPrice(level);
    const charge=branch==='charge'&&level?' Заряд: '+diamondPercent(state?.charge??0)+'.':'';
    detail.textContent='Ур. '+level+'. '+diamondEffects[branch](level)+' Далее: '+diamondEffects[branch](level+1)+charge;
    buy.textContent=Number.isFinite(price)?'💎 '+number(price):'Цена слишком велика';
    buy.disabled=!Number.isFinite(price)||(state?.balance??0)<price;
  }
}
button('diamonds-open').onclick=()=>{renderDiamondShop();diamondDialog.showModal();};
