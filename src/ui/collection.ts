// Unified collections, contextual details and a dedicated enhancement workflow.
var refinementReady=true;
const cultureTab=get('resources-dialog').querySelector('[data-resource-tab="cultures"]');
if(cultureTab)get('resources-dialog').querySelector('[data-resource-tab="seeds"]')?.after(cultureTab);
var selectingEnhancement=false;
var skipEnhancementFold=false;
var enhancementTransfer:{target:number;id:string}|null=null;
let collectionViewSignature='',selectedSet=-1,selectedHarvest=-1;
const collectionTip=document.createElement('div');collectionTip.className='glass collection-tooltip';collectionTip.setAttribute('popover','manual');collectionTip.hidden=true;
function collectionTooltip(host:HTMLElement,text:string){
 host.removeAttribute('title');host.setAttribute('aria-label',text);
 const show=()=>{const dialog=host.closest('dialog');if(!dialog?.open)return;if(collectionTip.matches(':popover-open'))collectionTip.hidePopover();dialog.append(collectionTip);collectionTip.textContent=text;collectionTip.hidden=false;if(!collectionTip.matches(':popover-open'))collectionTip.showPopover();collectionTip.style.left='12px';collectionTip.style.top='12px';
 placeContextPopover(collectionTip,host,dialog);};
 host.onpointerenter=show;host.onpointerleave=()=>{collectionTip.hidden=true;};host.onfocus=show;host.onblur=()=>{collectionTip.hidden=true;};
}
function collectionOverlay(id:string,title:string){
 const dialog=document.createElement('dialog');dialog.id=id;dialog.className='glass basket collection-detail-dialog';
 const header=document.createElement('div');header.className='window-heading';const heading=document.createElement('h2');heading.className='glass basket-chip';heading.textContent=title;heading.id=id+'-title';
 const form=document.createElement('form');form.method='dialog';const close=document.createElement('button');close.className='quiet close';close.textContent='×';close.setAttribute('aria-label','Закрыть');form.append(close);header.append(heading,form);dialog.append(header);dialog.setAttribute('aria-labelledby',heading.id);document.body.append(dialog);
 dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
 dialog.addEventListener('close',()=>{collectionTip.hidden=true;});dialog.addEventListener('scroll',()=>{collectionTip.hidden=true;});return dialog;
}
const setDetails=collectionOverlay('set-details-dialog','Набор');const setBody=document.createElement('section');setDetails.append(setBody);
const harvestDetails=collectionOverlay('harvest-details-dialog','Культура');const harvestBody=document.createElement('section');harvestDetails.append(harvestBody);
const gameHelp=collectionOverlay('game-help-dialog','Справка');
const gameHelpBody=document.createElement('section');
gameHelp.append(gameHelpBody);
function addGameHelp(anchor:Element,title:string,paragraphs:string[],greenhouseOnly=false){
 const trigger=document.createElement('button');
 trigger.type='button';
 trigger.className='quiet game-help'+(greenhouseOnly?' greenhouse-only':'');
 trigger.textContent='?';
 trigger.setAttribute('aria-label','Справка — '+title);
 trigger.setAttribute('aria-haspopup','dialog');
 trigger.onclick=()=>{
   if(gameHelp.open)return;
   get('game-help-dialog-title').textContent=title;
   gameHelpBody.replaceChildren(...paragraphs.map(text=>{
     const paragraph=document.createElement('p');
     paragraph.textContent=text;
     return paragraph;
   }));
   gameHelp.showModal();
 };
 anchor.after(trigger);
}
addGameHelp(get('garden-link'),'Теплица',[
 'Посади два растения рядом с пустой грядкой. Поставь на неё шпалеру кнопкой «Шпалера» или удерживая Alt.',
 'На шпалере может появиться гибрид. Зрелые родители повышают шанс, а высокий Re ускоряет проверки. Когда находка созреет, нажми на неё, чтобы забрать семя.'
],true);
addGameHelp(get('resources-dialog').querySelector('.window-heading h2')!,'Коллекция',[
 '«Семена» показывают, какие культуры открыты и сколько семян осталось. В «Культурах» можно посмотреть прогресс сбора и шансы добычи.',
 'Орбы, материалы и алмазы выпадают при сборе обычного урожая. Во вкладках «Предметы» и «Наборы» можно узнать, для чего нужны материалы. За первый полный набор дают алмаз.',
 'Очки мутаций дают за созревшие находки и переработку семян гибридов.'
]);
addGameHelp(get('fortune-dialog').querySelector('.window-heading h2')!,'Колесо фортуны',[
 'Выбери валюту и ставку. Колесо может вернуть половину ставки, всю ставку или полторы ставки. Например, за 100 монет можно получить 50, 100 или 150.',
 'Пустой сектор ничего не даёт. У некоторых наград есть минимальная ставка. Джекпот растёт с прокрутками и сбрасывается после выигрыша.'
]);
const setLabels=['Корнеплоды','Луковые','Паслёновые','Бахчевые'];
function renderSetDetails(){
 if(selectedSet<0)return;const set=cropSets[selectedSet],material=materials.find(item=>item.id==='set'+selectedSet)!;
 get('set-details-dialog-title').textContent=set.name;setBody.replaceChildren();
 const intro=document.createElement('p');const count=set.crops.filter(i=>farm.harvested[i]>0).length;
 intro.textContent='Собрано '+count+'/4. Для полного набора собери хотя бы один плод каждого вида. Новые виды находятся в пакетах семян. Урожай не расходуется.';
 const grid=document.createElement('div');grid.className='set-crop-grid';
 for(const i of set.crops){const found=farm.harvested[i]>0,card=document.createElement('div');card.className='glass resource-card set-crop'+(found?'':' unknown-crop');card.tabIndex=0;
 const icon=document.createElement('span');icon.textContent=crops[i].symbol;icon.className=found?'plant-glow':'muted-crop';icon.style.setProperty('--icon-rarity',rarityColors[cropRarities[i]]);
 const name=document.createElement('small');name.textContent=found?crops[i].name:'Не найдено';const tier=document.createElement('small');tier.textContent=baseRarityNames[cropTiers[i]];card.append(icon,name,tier);
 collectionTooltip(card,crops[i].name+'\nБазовый шанс в обычном пакете без удачи: '+formatChance(openingOdds(farm,0,0)[i])+'%\n'+(found?'Урожай этого вида уже собран':unlocked(farm,i)?'Семена открыты. Собери первый урожай.':'Найди семя в пакете и собери урожай.'));grid.append(card);}
 const reward=document.createElement('p');reward.textContent=material.icon+' '+material.name+' · В запасе: '+number(farm.resources.items[material.id]??0)+'\n'+material.description+'\nШанс с каждого плода: обычные 1%, редкие 1,5%, эпические 2%, легендарные 5%.';
 const bonus=document.createElement('p');bonus.textContent='Материал можно добывать с каждой открытой культуры набора, не дожидаясь полного сбора. Постоянный бонус за полный набор пока не назначен.';
 const gift=document.createElement('p');gift.textContent=farm.diamonds?.sets[selectedSet]?'💎 Награда за набор получена.':'💎 За первый полный набор — 1 алмаз.';
 setBody.append(intro,grid,reward,bonus,gift);
}
function renderHarvestDetails(){
 const i=selectedHarvest;if(i<0)return;get('harvest-details-dialog-title').textContent=crops[i].symbol+' '+crops[i].name;
 const count=farm.harvested[i],level=collectionLevel(count),crop=crops[i],powers=basePowers[i];
 const chance=harvestMaterialChance(i),tier=cropTiers[i],set=cropSets.findIndex(group=>group.crops.includes(i));
 const properties=Object.keys(powers);
 const specimen={name:crop.name,crop:i,seeds:0,traits:properties,powers};
 const lines=[
   baseRarityNames[tier]+' · Базовый рост '+clock(cropTimes[i]*1000)+' · С улучшениями '+clock(growthTime(i,farm.levels[i].growth)),
   '🪙 Цена свежего плода: '+number(cropPrices[i]*(1+(powers.sweet??0)/100)*(1+level/100)),
   'Собрано: '+number(count)+' / '+number(nextCollectionAt(count))+' · Уровень коллекции '+level+' · Бонус к стоимости урожая +'+level+'%',
   '',
   'Свойства',
   ...properties.map(id=>powerLabel(specimen,id)+' — '+abilityDefinitions[id].description),
   '',
   'Добыча с обычного плода',
   '🔮 Добыча орбов — '+formatChance((1-2*chance)*100)+'% · количество 0–'+orbMaximums[tier],
   '🔮 Шанс максимума при добыче орбов — '+formatChance(orbMaximumChance(tier,farm.resources.orbLuck)*100)+'%',
   ...['set'+set,...properties.map(propertyMaterialId),'duplication'].map(id=>{
     const material=materials.find(item=>item.id===id)!;
     const probability=id==='duplication'?harvestDuplicationChance(i):id.startsWith('set')?chance:chance/properties.length;
     return material.icon+' '+material.name+' — '+formatChance(probability*100)+'%';
   }),
   '✨ Дополнительные копии материалов — '+formatChance(farm.resources.duplication?1+(farm.resources.duplication-1)*.1:0)+'%',
   '💎 Алмаз за грядку — '+formatChance(cropTimes[i]/120*.05*(1+diamondLevel(farm,'find')/100))+'%'
 ];
 harvestBody.textContent=lines.join('\n');
}
function renderResourceCollections(){
 get('resource-upgrade-title').dataset.upgradeTarget=resourceCategory==='materials'?'tools':'seeds';
 get('resource-cultures').hidden=resourceCategory!=='cultures';get('resource-grid').hidden=resourceCategory==='cultures'||resourceCategory==='stats';
 get('resource-stats').hidden=resourceCategory!=='stats';
 for(const tab of document.querySelectorAll<HTMLButtonElement>('[data-resource-tab]'))tab.setAttribute('aria-pressed',String(tab.dataset.resourceTab===resourceCategory));
 if(resourceCategory==='stats'){
   collectionViewSignature='';
   collectionTip.hidden=true;
   renderFarmStatistics();
   get('resource-note').textContent='';
   return;
 }
 const categoryData=resourceCategory==='cultures'?farm.harvested:
   resourceCategory==='seeds'?[farm.collection,farm.seeds]:
   resourceCategory==='sets'?[farm.harvested,farm.collection,farm.resources.items]:
   [farm.resources.items,farm.resources.found];
 const signature=JSON.stringify([resourceCategory,categoryData]);
 if(signature===collectionViewSignature)return;collectionViewSignature=signature;collectionTip.hidden=true;
 const cropGrid=get('resource-crop-grid');cropGrid.replaceChildren();
 const order=crops.map((_,i)=>i).sort((a,b)=>cropTiers[a]-cropTiers[b]||cropTimes[a]-cropTimes[b]);
 for(const i of order){const found=farm.harvested[i]>0,card=document.createElement('button');card.type='button';card.className='glass resource-card'+(found?'':' resource-locked');card.dataset.crop=String(i);
 const icon=document.createElement('span');icon.textContent=crops[i].symbol;card.append(icon);
 if(found){icon.className='plant-glow';icon.style.setProperty('--icon-rarity',rarityColors[cropRarities[i]]);const count=document.createElement('small');count.textContent=number(farm.harvested[i])+'/'+number(nextCollectionAt(farm.harvested[i]));card.append(count);
 collectionTooltip(card,crops[i].name+' · '+baseRarityNames[cropTiers[i]]+'\nСобрано: '+number(farm.harvested[i])+'/'+number(nextCollectionAt(farm.harvested[i]))+'\nСтоимость урожая: +'+collectionLevel(farm.harvested[i])+'%\nДо следующего уровня: '+number(Math.max(0,nextCollectionAt(farm.harvested[i])-farm.harvested[i])));card.onclick=()=>{selectedHarvest=i;renderHarvestDetails();harvestDetails.showModal();};}
 else{icon.className='muted-crop';card.disabled=true;card.setAttribute('aria-label','Неизвестная культура');}cropGrid.append(card);}
 const grid=get('resource-grid');grid.replaceChildren();
 if(resourceCategory==='seeds'){
 for(const i of order){const found=unlocked(farm,i),card=document.createElement('div');card.className='glass resource-card'+(found?'':' resource-locked');card.dataset.seed=String(i);const icon=document.createElement('span');icon.textContent=crops[i].symbol;const name=document.createElement('small');name.textContent=found?crops[i].name:'Не открыто';const count=document.createElement('strong');count.textContent=found?'🌱 '+number(farm.seeds[i]):'—';card.append(icon,name,count);if(found){icon.className='plant-glow';icon.style.setProperty('--icon-rarity',rarityColors[cropRarities[i]]);collectionTooltip(card,crops[i].name+' · '+baseRarityNames[cropTiers[i]]+'\nСемян на складе: '+number(farm.seeds[i])+'\nВид открыт — семена доступны в магазине.');}grid.append(card);}
 }else if(resourceCategory==='sets'){

 cropSets.forEach((set,index)=>{const count=set.crops.filter(i=>farm.harvested[i]>0).length;const card=document.createElement('button');card.type='button';card.className='glass resource-card set-collection-card';card.dataset.set=String(index);card.style.setProperty('--completion',count*25+'%');
 const icon=document.createElement('span');icon.textContent=materials.find(item=>item.id==='set'+index)!.icon;const name=document.createElement('strong');name.textContent=setLabels[index];const progress=document.createElement('small');progress.textContent=count+'/4';card.append(icon,name,progress);
 card.onclick=()=>{selectedSet=index;renderSetDetails();setDetails.showModal();};grid.append(card);});
 }else for(const item of materials.filter(item=>resourceCategory==='materials'||item.category===resourceCategory)){
 const found=!!farm.resources.found[item.id]||(farm.resources.items[item.id]??0)>0,card=document.createElement('div');card.className='glass resource-card material-card'+(found?'':' resource-locked');card.tabIndex=0;
 const icon=document.createElement('span');icon.textContent=item.icon;const count=document.createElement('small');count.textContent=number(farm.resources.items[item.id]??0);card.append(icon,count);if(resourceCategory==='materials'&&found){const name=document.createElement('small');name.textContent=item.name;card.append(name);}
 collectionTooltip(card,item.name+'\n'+item.description+(item.category==='sets'?'\nДобывается с плодов своего набора; собирать весь набор для выпадения не требуется.':item.id==='duplication'?'\nПервый уровень: 1%, следующие: +0,1 п. п. Цена в кристаллах дублирования растёт с уровнем. Улучшения → Инструменты.':'\nОдна попытка усиления тратит 1 материал. Открой «Усиление гибридов» справа.')+'\n'+(found?'В запасе: '+number(farm.resources.items[item.id]??0):'Ещё не найдено'));grid.append(card);}
 get('resource-note').textContent=resourceCategory==='seeds'?'Открытые виды семян и их запас. Новый вид можно найти в пакете семян.':resourceCategory==='materials'?'Все материалы в одном месте. Наведи на найденный предмет, чтобы узнать его применение.':resourceCategory==='cultures'?'Каждый уровень коллекции даёт +1% к стоимости урожая. Нажми на культуру, чтобы увидеть прогресс.':resourceCategory==='sets'?'Нажми на набор: состав, базовые шансы и применение материала.':'Наведи на предмет, чтобы узнать его действие и применение.';
 if(setDetails.open)renderSetDetails();if(harvestDetails.open)renderHarvestDetails();
}
// The old species roulette has been superseded by discoveries from seed packs.
button('collection-open').hidden=true;button('upgrade-tab-discovery').hidden=true;get('upgrade-discovery').hidden=true;
const enhancementDialog=collectionOverlay('enhancement-dialog','✨ Усиление гибридов');
const chooseEnhancement=document.createElement('button');chooseEnhancement.id='choose-enhancement-hybrid';chooseEnhancement.className='primary';chooseEnhancement.textContent='Выберите гибрид';enhancementDialog.append(chooseEnhancement);
const enhancementPreview=document.createElement('div');enhancementPreview.id='enhancement-preview';enhancementDialog.append(enhancementPreview,enhancePanel);
enhancePanel.querySelector('h2')?.remove();get('enhance-line').closest('label')!.hidden=true;
const enhancementOpen=document.createElement('button');enhancementOpen.id='enhancement-open';enhancementOpen.className='quiet wide';enhancementOpen.textContent='✨ Усиление гибридов';button('hybrids-open').after(enhancementOpen);
enhancementOpen.onclick=()=>openEnhancement();
function openEnhancement(index?:number){
 if(hybridDetail.open)hybridDetail.close();if(hybridsDialog.open)hybridsDialog.close();if(upgradesDialog.open)upgradesDialog.close();
 renderAlpha();if(index!==undefined)get<HTMLSelectElement>('enhance-line').value=String(index);renderEnhancements();if(!enhancementDialog.open)enhancementDialog.showModal();
}
function beginEnhancementPicker(){
 enhancementDialog.close();selectingEnhancement=true;deleteMode=false;searchHybrids.value='';hybridsDialog.dataset.picker='enhancement';
 const title=hybridsDialog.querySelector<HTMLElement>('h2 [data-upgrade-target]');if(title){title.textContent=enhancementTransfer?'Выберите источник усиления':'Выберите гибрид';title.dataset.upgradeTarget='';}
 button('hybrid-delete-mode').hidden=true;openHybridInventory();
}
chooseEnhancement.onclick=()=>{enhancementTransfer=null;beginEnhancementPicker();};
function startEnhancementTransfer(target:number,id:string){enhancementTransfer={target,id};beginEnhancementPicker();}
function chooseEnhancementHybrid(index:number){
 const request=enhancementTransfer;enhancementTransfer=null;
 if(!request)get<HTMLSelectElement>('enhance-line').value=String(index);
 skipEnhancementFold=true;hybridsDialog.close();finishEnhancementPicker();
 if(request)showEnhancementTransfer(index,request.target,request.id);
}
function finishEnhancementPicker(){if(hybridsDialog.dataset.picker!=='enhancement')return;delete hybridsDialog.dataset.picker;selectingEnhancement=false;enhancementTransfer=null;const title=hybridsDialog.querySelector<HTMLElement>('h2 [data-upgrade-target]');if(title){title.textContent='🧬 Инвентарь гибридов';title.dataset.upgradeTarget='hybrids';}button('hybrid-delete-mode').hidden=false;renderEnhancements();if(!enhancementDialog.open)enhancementDialog.showModal();}
hybridsDialog.addEventListener('close',finishEnhancementPicker);
function renderEnhancementSelection(){
 const raw=get<HTMLSelectElement>('enhance-line').value,line=raw===''?undefined:farm.lines[Number(raw)];
 if(!line){enhancementPreview.textContent='';chooseEnhancement.textContent='Выберите гибрид';return;}
 const caption=crops[line.crop].symbol+' '+line.name+' · ⚡ Gr '+(line.genes?.gr??1)+' / 💰 Ga '+(line.genes?.ga??1)+' / 🛡️ Re '+(line.genes?.re??1);
 if(enhancementPreview.firstChild?.nodeValue!==caption)enhancementPreview.textContent=caption;
 chooseEnhancement.textContent='Выбран '+line.name+' · сменить';
}
renderAlpha();

function placeContextPopover(popover:HTMLElement,anchor:HTMLElement,owner:HTMLElement){
 const bounds=owner.getBoundingClientRect(),r=anchor.getBoundingClientRect();
 popover.style.maxWidth=Math.min(340,innerWidth-24,Math.max(100,bounds.width-24))+'px';popover.style.left='0px';popover.style.top='0px';
 const size=popover.getBoundingClientRect(),minX=Math.max(12,bounds.left+8),maxX=Math.min(innerWidth-12,bounds.right-8)-size.width;
 const minY=Math.max(12,bounds.top+8),maxY=Math.min(innerHeight-12,bounds.bottom-8)-size.height;
 popover.style.left=Math.max(minX,Math.min(maxX,r.left+r.width/2-size.width/2))+'px';
 const above=r.top-size.height-8;popover.style.top=Math.max(minY,Math.min(maxY,above>=minY?above:r.bottom+8))+'px';
}

const transferDialog=collectionOverlay('enhancement-transfer-dialog','Перенос усиления');
const transferReview=document.createElement('p');transferReview.className='transfer-review';
const transferConfirm=document.createElement('button');transferConfirm.id='transfer-enhancement-confirm';transferConfirm.className='primary';transferConfirm.textContent='Подтвердить перенос';transferDialog.append(transferReview,transferConfirm);
let transferSelection:{source:number;target:number;id:string}|null=null;
function showEnhancementTransfer(source:number,target:number,id:string){
 if(!canTransferEnhancement(farm,source,target,id))return;
 transferSelection={source,target,id};const from=farm.lines[source],to=farm.lines[target],a=from.enhancements?.[id]??0,b=to.enhancements?.[id]??0;
 transferReview.textContent=(abilityDefinitions[id]?.name??traitNames[id])+'\n'+from.name+': +'+a+'% → +'+b+'%\n'+to.name+': +'+b+'% → +'+a+'%\n'+(b?'Существующие усиления поменяются местами.':'Усиление уйдёт с источника и появится у выбранной линии.')+'\nПеренос применяется ко всем семенам обеих линий. Врождённая сила свойств не меняется.';
 transferDialog.showModal();
}
transferConfirm.onclick=()=>{const choice=transferSelection;if(!choice)return;if(!transferEnhancement(farm,choice.source,choice.target,choice.id)){transferReview.textContent='Перенос сейчас недоступен. Собери обе линии с грядок и выбери источник заново.';return;}transferDialog.close();transferSelection=null;commit('Усиление перенесено без копирования.');};


function renderFarmStatistics(){
  const stats=farmStatistics(farm);
  const entries:[string,number][]=[
    ['🧺 Собрано плодов за игру',farm.collected],
    ['📦 Открыто пакетов',farm.opened],
    ['⚙️ Переработано плодов',farm.extraction.processed],
    ['🌱 Семян из экстрактора',farm.extraction.produced],
    ['✨ Добыто материалов',stats.materialsFound],
    ['💎 Проверок на выпадение',stats.crystalRolls],
    ['💎 Выпало при сборе',stats.crystalDrops],
    ['🪙 Потрачено монет',stats.coinsSpent],
    ['🔮 Потрачено орбов',stats.orbsSpent],
    ['💎 Потрачено алмазов',stats.diamondsSpent]
  ];
  const host=get('resource-stats');
  const timers=[
    {id:'total-play-time',label:'⏱ Общее время игры',ms:totalPlayTime()},
    {id:'active-play-time',label:'⏱ Активное время',ms:farm.activePlayMs}
  ].map(({id,label,ms})=>{
    const elapsed=Math.floor((ms??0)/1000);
    return {id,label,text:Math.floor(elapsed/3600)+' ч '+Math.floor(elapsed/60)%60+' мин '+elapsed%60+' с'};
  });
  const signature=JSON.stringify(entries);
  if(host.dataset.signature===signature){
    for(const {id,text} of timers){
      const amount=get(id);
      if(amount.textContent!==text)amount.textContent=text;
    }
    return;
  }
  host.dataset.signature=signature;
  const list=document.createElement('dl');
  for(const {id,label,text} of [...timers,...entries.map(([label,value])=>({id:'',label,text:number(value)}))]){
    const row=document.createElement('div');
    row.className='glass panel';
    const name=document.createElement('dt');
    name.textContent=label;
    const amount=document.createElement('dd');
    if(id)amount.id=id;
    amount.textContent=text;
    row.append(name,amount);
    list.append(row);
  }
  const note=document.createElement('p');
  note.textContent='Добыча материалов, броски на алмазы и расходы учитываются с этого обновления.';
  host.replaceChildren(list,note);
}

