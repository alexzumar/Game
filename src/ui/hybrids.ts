let inventoryDockNext:DockState='peek';
let inventoryOrigin:DOMRect|null=null;
const hybridsDialog=get<HTMLDialogElement>('hybrids-dialog');
button('hybrids-open').onclick=openHybridInventory;
button('hybrid-expand').onclick=()=>{if(expandHybridInventory(farm))commit('Инвентарь расширен на 5 мест.');};
hybridsDialog.addEventListener('click',event=>{
  if(event.target!==hybridsDialog)return;
  const r=hybridsDialog.getBoundingClientRect();
  if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)hybridsDialog.close();
});
const hybridDetail=get<HTMLDialogElement>('hybrid-detail-dialog');
let detailLine=-1,deleteMode=false,lastDeletePress=-Infinity;
const markedHybrids=new Set<number>();
const shortTrait:Record<string,string>={growth:'⏱️ +10%',yield:'💰 +1',regrow:'🔄 +5%'};
const searchHybrids=get<HTMLInputElement>('hybrid-search');
searchHybrids.oninput=renderLines;
function showHybrid(index:number){
  const line=farm.lines[index];if(!line||!line.seeds||line.archived)return;
  detailLine=index;resetDeletePress(button('hybrid-remove'));
  get('hybrid-detail-title').textContent=line.name;
  get('hybrid-detail-icon').textContent=crops[line.crop].symbol;
  get('hybrid-detail-count').textContent='Семян: '+number(line.seeds);
  get('hybrid-stable-id').textContent='ID #'+(index+1);
  get('hybrid-rename-form').hidden=true;
  renderComparison(hybridDetail,line,'hybrid-genetics','hybrid-detail-traits');
  hybridDetail.showModal();
  renderEnhancementShortcut();
  button('hybrid-recycle').disabled=Array.from({length:farm.extraction.slots??1},(_,slot)=>extractionJobs(farm.extraction)[slot]).every(Boolean);
}
button('hybrid-plant').onclick=()=>{
  const line=farm.lines[detailLine];if(!line||line.archived||line.seeds<1)return;
  selectedLine=detailLine;seed=line.crop;watering=false;gathering=false;
  inventoryDockNext="open";
  setDockState("open");
  hybridDetail.close();hybridsDialog.close();commit('Выбран '+line.name);
};
const recycleDialog=get<HTMLDialogElement>('hybrid-recycle-dialog');
button('hybrid-recycle').onclick=()=>{
  const line=farm.lines[detailLine];
  if(!line||line.archived||line.seeds<1)return;
  const {points,duration}=hybridRecyclingQuote(line,farm.extraction.speed);
  get('hybrid-recycle-quote').textContent='Одно семя «'+line.name+'» → 🧬 '+points+' за '+clock(duration)+'.';
  get('hybrid-recycle-status').textContent='';
  recycleDialog.showModal();
};
button('hybrid-recycle-confirm').onclick=()=>{
  if(!startHybridRecycling(farm,detailLine,nowTime())){
    get('hybrid-recycle-status').textContent='Нужно доступное семя и свободный слот экстрактора.';
    return;
  }
  recycleDialog.close();
  if(selectedLine===detailLine&&farm.lines[detailLine].seeds===0){selectedLine=undefined;seed=-1;}
  hybridDetail.close();
  hybridsDialog.close();
  button('extractor-open').click();
  commit('Семя гибрида отправлено в экстрактор.');
};
button('hybrid-remove').onclick=()=>{
  if(!confirmDeletePress(button('hybrid-remove')))return;
  if(discardHybrid(farm,detailLine)){
    if(selectedLine===detailLine){selectedLine=undefined;seed=-1;}
    hybridDetail.close();commit('Семена гибрида удалены.');
  }
};
hybridDetail.addEventListener('click',event=>{
  if(event.target!==hybridDetail)return;
  const r=hybridDetail.getBoundingClientRect();
  if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)hybridDetail.close();
});
button('hybrid-delete-mode').onclick=()=>{
  if(!deleteMode){deleteMode=true;markedHybrids.clear();lastDeletePress=-Infinity;renderLines();return;}
  if(!markedHybrids.size){deleteMode=false;renderLines();return;}
  const now=performance.now();
  if(now-lastDeletePress<=450){
    for(const i of markedHybrids)if(discardHybrid(farm,i)&&selectedLine===i){selectedLine=undefined;seed=-1;}
    markedHybrids.clear();deleteMode=false;lastDeletePress=-Infinity;commit('Выбранные семена удалены.');return;
  }
  lastDeletePress=now;
  get('hybrid-delete-hint').textContent='Нажми ещё раз для удаления выбранных семян.';
};
hybridsDialog.addEventListener('close',()=>{
  deleteMode=false;markedHybrids.clear();lastDeletePress=-Infinity;
  if(typeof skipEnhancementFold!=='undefined'&&skipEnhancementFold){skipEnhancementFold=false;return;}
  if(hybridsDialog.dataset.picker==='enhancement')return;
  if(hybridCount(farm)>0){setDockState(inventoryDockNext);animateInventoryFold();}
  inventoryDockNext='peek';
});
let hybridStroke:{pointer:number;visited:Set<number>;select:boolean}|null=null;
let suppressHybridClick=false;
const hybridGrid=get('hybrid-grid');
function markAt(x:number,y:number){
  const card=document.elementFromPoint(x,y)?.closest<HTMLElement>('[data-hybrid-index]');
  if(!card||!hybridGrid.contains(card)||!hybridStroke)return;
  const index=Number(card.dataset.hybridIndex);
  if(hybridStroke.visited.has(index))return;
  hybridStroke.visited.add(index);
  if(hybridStroke.select)markedHybrids.add(index);else markedHybrids.delete(index);
  card.setAttribute('aria-pressed',String(markedHybrids.has(index)));
}
hybridGrid.onpointerdown=event=>{
  suppressHybridClick=false;
  if(!deleteMode||!event.isPrimary||event.button!==0)return;
  const card=(event.target as Element).closest<HTMLElement>('[data-hybrid-index]');
  if(!card)return;
  event.preventDefault();suppressHybridClick=true;
  hybridStroke={pointer:event.pointerId,visited:new Set(),select:!markedHybrids.has(Number(card.dataset.hybridIndex))};
  markAt(event.clientX,event.clientY);
};
window.addEventListener('pointermove',event=>{
  if(hybridStroke?.pointer===event.pointerId)markAt(event.clientX,event.clientY);
});
function finishHybridStroke(event:PointerEvent){
  if(hybridStroke?.pointer!==event.pointerId)return;
  hybridStroke=null;renderLines();
}
window.addEventListener('pointerup',finishHybridStroke);
window.addEventListener('pointercancel',finishHybridStroke);
let hybridGridSignature="";
const mutationUpgradeLabels:Record<MutationUpgrade,[string,string]>={
  interval:['Частота проверок','Как часто теплица проверяет появление гибрида.'],
  genetics:['Наследование генов','Потомок чаще получает сильные гены родителей.'],
  maturity:['Созревание находок','Сколько ждать, прежде чем забрать находку.']
};
const mutationUpgradeCards=mutationUpgradeIds.map(id=>{
  const card=document.createElement('section');card.className='glass panel';
  const title=document.createElement('h3'),progress=document.createElement('small'),description=document.createElement('p'),effect=document.createElement('p'),buy=document.createElement('button');
  [title.textContent,description.textContent]=mutationUpgradeLabels[id];
  progress.className='mutation-upgrade-limit';
  description.className='mutation-upgrade-description';
  effect.style.whiteSpace='pre-line';
  buy.className='quiet';
  buy.onclick=()=>{if(buyMutationUpgrade(farm,id))commit('Селекция улучшена.');};
  card.append(title,progress,description,effect,buy);get('mutation-upgrades').append(card);
  return {id,progress,effect,buy};
});
function mutationUpgradeEffect(id:MutationUpgrade,level:number){
  const seconds=(ms:number)=>(ms/1000).toLocaleString('ru-RU',{maximumFractionDigits:1})+' с';
  if(id==='interval')return seconds(upgradedMutationInterval(1,level))+' при Re 1, '+seconds(upgradedMutationInterval(30,level))+' при Re 30';
  if(id==='maturity')return 'До '+seconds(mutationMaturityDuration(120000,level));
  return formatChance(mutationInheritanceWeight(level)*100)+'% веса сильного родителя · '+formatChance(mutationStatGainChance(level)*100)+'% на +1 к гену';
}
function renderLines(){
  for(const {id,progress,effect,buy} of mutationUpgradeCards){
    const level=mutationLevel(farm,id),cost=mutationUpgradeCost(level);
    progress.textContent='До '+mutationUpgradeMax+' уровней';
    renderUpgradeChange(effect,level,mutationUpgradeEffect(id,level),level===mutationUpgradeMax?undefined:mutationUpgradeEffect(id,level+1));
    buy.textContent=level===mutationUpgradeMax?'Максимум':'🧬 '+number(cost);
    buy.disabled=level===mutationUpgradeMax||(farm.mutationPoints??0)<cost;
  }
  const used=hybridCount(farm);
  for(const i of markedHybrids)if(farm.lines[i]?.archived||!farm.lines[i]?.seeds)markedHybrids.delete(i);
  get('hybrid-capacity').textContent=used+'/'+farm.hybridSlots;
  get('hybrid-coins').textContent=number(farm.coins);
  const price=hybridExpansionPrice(farm);
  renderUpgradeChange(get('hybrid-expand-effect'),Math.floor((farm.hybridSlots-20)/5),farm.hybridSlots+' мест',farm.hybridSlots+5+' мест');
  button('hybrid-expand').disabled=(farm.mutationPoints??0)<price;
  button('hybrid-expand').textContent='🧬 '+number(price);
  button('hybrid-delete-mode').textContent=deleteMode?(markedHybrids.size?'Удалить ('+markedHybrids.size+')':'Отменить'):'Удалить';
  get('hybrid-delete-hint').textContent=deleteMode?'Выдели семена кликом или протягиванием. Двойное нажатие «Удалить» подтверждает.':'';
  const query=searchHybrids.value.trim().toLocaleLowerCase('ru');
  const signature=JSON.stringify([farm.lines,query,deleteMode,[...markedHybrids],
    get<HTMLSelectElement>('hybrid-sort').value,get<HTMLSelectElement>('hybrid-direction').value,typeof enhancementTransfer!=='undefined'?enhancementTransfer:null]);
  if(signature===hybridGridSignature)return;
  hybridGridSignature=signature;
  const ordered=farm.lines.map((line,i)=>({line,i})).sort((a,b)=>compareHybridOrder(a.line,b.line)*Number(get<HTMLSelectElement>("hybrid-direction").value)||a.i-b.i);
  const cards=ordered.flatMap(({line,i})=>{
    if(line.archived||!line.seeds)return [];
    if(typeof enhancementTransfer!=='undefined'&&enhancementTransfer&&!canTransferEnhancement(farm,i,enhancementTransfer.target,enhancementTransfer.id))return [];
    const haystack=(line.name+' #'+(i+1)+' '+crops[line.crop].name+' '+line.traits.map(t=>[traitNames[t],powerLabel(line,t),abilityDefinitions[t]?.description??'',t==='growth'?'скорость роста ускорение скороспелость':t==='regrow'?'отрастание автопосев повторная посадка':t==='yield'?'урожай урожайность':''].join(' ')).join(' ')).toLocaleLowerCase('ru');
    if(query&&!haystack.includes(query))return [];
    const card=document.createElement('button');card.className='glass hybrid-card';
    card.dataset.hybridIndex=String(i);
    card.setAttribute('aria-pressed',String(markedHybrids.has(i)));
    const title=document.createElement('strong');title.className='hybrid-card-title';
    title.textContent=line.name+' ×'+number(line.seeds);
    const icon=document.createElement('b');icon.textContent=crops[line.crop].symbol;
    const genes=line.genes??{gr:1,ga:1,re:1};
    const genetics=document.createElement('span');genetics.className='hybrid-card-genes';
    genetics.textContent='⚡ Gr '+genes.gr+' / 💰 Ga '+genes.ga+' / 🛡️ Re '+genes.re;
    const explanation='Gr '+genes.gr+' — скорость роста, больше лучше. Ga '+genes.ga+' — урожайность, больше лучше. Re '+genes.re+
      ' — селекционный потенциал, больше лучше. Средняя генетика: '+((genes.gr+genes.ga+genes.re)/3).toFixed(2);
    card.title=line.name+' · ID #'+(i+1)+' · '+explanation;
    genetics.title=explanation;
    const slots=document.createElement('div');slots.className='hybrid-card-slots';
    for(let slot=0;slot<3;slot++){
      const property=document.createElement('small');
      const id=line.traits[slot];
      property.textContent=id?(line.powers?powerLabel(line,id):shortTrait[id]??traitNames[id]):'—';
      slots.append(property);
    }
    card.append(title,icon,genetics,slots);
    card.onclick=event=>{
      if(event.detail>0&&suppressHybridClick){suppressHybridClick=false;return;}
      if(deleteMode){if(markedHybrids.has(i))markedHybrids.delete(i);else markedHybrids.add(i);renderLines();}
      else if(typeof selectingEnhancement!=='undefined'&&selectingEnhancement)chooseEnhancementHybrid(i);else showHybrid(i);
    };
    return [card];
  });

  get('hybrid-grid').replaceChildren(...cards);
  get('hybrid-empty-message').hidden=cards.length>0;
  get('hybrid-empty-message').textContent=query?'Ничего не найдено.':'Гибридов пока нет.';
}
const mutationDialog=get<HTMLDialogElement>('mutation-dialog');
let mutationIndex=-1;
let mutationArea:PlotArea=farm;
let mutationRevealed=false;
function openMutation(index:number,area:PlotArea=farm){
  mutationArea=area;
  mutationIndex=index;
  const plot=mutationArea.plots[index];
  if(!plot?.mystery)return;
  const ready=plot.ready!==null&&plot.ready<=nowTime();
  mutationRevealed=ready;
  get('mutation-icon').textContent=ready?crops[plot.crop].symbol:'?';
  get('mutation-info').textContent=ready
    ?'Гибрид '+plot.mystery.parents.map(i=>crops[i].name).join(' × ')+' · Время роста '+clock(plot.duration??crops[plot.crop].seconds*1000)+' · Созрел'
    :'Находка ещё растёт. Вид и свойства станут известны после полного созревания.';
  get('mutation-result').textContent='';
  for(const section of mutationDialog.querySelectorAll<HTMLElement>('#mutation-genes,#mutation-traits,#mutation-comparison-note,.parent-panel')){
    section.hidden=!ready;
    if(section.id!=='mutation-comparison-note')section.replaceChildren();
  }
  if(ready&&plot.mystery.preview)renderComparison(mutationDialog,plot.mystery.preview,'mutation-genes','mutation-traits');
  button('mutation-accept').hidden=!ready;
  button('mutation-accept').disabled=!ready||hybridCount(farm)>=farm.hybridSlots;
  if(ready&&hybridCount(farm)>=farm.hybridSlots)get('mutation-result').textContent='Инвентарь заполнен. Расширь его или освободи место — находка останется на грядке.';
  const discard=button('mutation-discard');
  discard.hidden=false;
  delete discard.dataset.confirmEarly;
  discard.textContent='Удалить находку';
  resetDeletePress(discard);
  if(!ready)discard.removeAttribute('title');
  if(!mutationDialog.open)mutationDialog.showModal();
}
button('mutation-accept').onclick=()=>{
  const result=acceptMutation(farm,mutationIndex,nowTime(),Math.random,mutationArea);
  if(!result)return;
  get('mutation-result').textContent='Получено семя линии. '+(result.replaced?
    'Заменено: '+traitNames[result.replaced]+' → '+traitNames[result.added]:
    'Добавлено: '+traitNames[result.added])+'. Все свойства: '+result.line.traits.map(t=>traitNames[t]).join(' · ');
  button('mutation-accept').disabled=true;button('mutation-discard').hidden=true;
  if(result.line.parents)renderComparison(mutationDialog,result.line,'mutation-genes','mutation-traits');
  mutationDialog.close();
  commit('Новая линия на складе · 🧬 +'+result.points);
};
button('mutation-discard').onclick=()=>{
  if(!mutationArea.plots[mutationIndex]?.mystery)return;
  const control=button('mutation-discard');
  if(!mutationRevealed){
    if(control.dataset.confirmEarly!=='true'){
      control.dataset.confirmEarly='true';
      control.textContent='Да, удалить';
      get('mutation-result').textContent='Находка ещё не созрела. Точно удалить её? Вид и свойства останутся неизвестными.';
      return;
    }
  }else if(!confirmDeletePress(control))return;
  const points=discardMutation(farm,mutationIndex,nowTime(),mutationArea);
  mutationDialog.close();
  commit('Находка удалена.'+(points?' 🧬 +'+points:''));
};
mutationDialog.addEventListener('click',event=>{
  if(event.target!==mutationDialog)return;
  const r=mutationDialog.getBoundingClientRect();
  if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)mutationDialog.close();
});
get<HTMLInputElement>('debug-amount').addEventListener('keydown',event=>{
  if(event.key==='Enter'){event.preventDefault();button('debug-coins').click();}
});
const dock=get('hybrid-dock'),dockWrap=get('hybrid-dock-wrap'),dockTip=get('dock-tooltip');
type DockState = 'hidden'|'peek'|'open';
let dockState:DockState='hidden';
let dockSignature='',dockDirection=0,dockFrame=0,dockPrevious=0;
let dockHoverTimer:ReturnType<typeof setTimeout>|undefined;
let dockEditTimer:ReturnType<typeof setTimeout>|undefined;
function setDockState(state:DockState){
  clearTimeout(dockHoverTimer);clearTimeout(dockEditTimer);
  dockState=state;
  dockWrap.dataset.state=state;
  dockWrap.hidden=state==='hidden'||hybridsDialog.open;
  dockTip.hidden=true;
  hideDockMagnifier();
  stopDock();
}
button('dock-close').onclick=event=>{
  event.stopPropagation();
  setDockState(dockState==='open'?'peek':'hidden');
};
button('dock-handle').onclick=event=>{event.stopPropagation();setDockState('open');};
dockWrap.addEventListener('click',event=>{
  if(event.target instanceof Element&&event.target.closest('#dock-close'))return;
  if(dockState==='peek')setDockState('open');else if(dockState==='open')openHybridInventory();
});
dockWrap.onpointerenter=()=>{if(dockState==='peek')setDockState('open');};
function stopDock(){dockDirection=0;dockPrevious=0;if(dockFrame)cancelAnimationFrame(dockFrame);dockFrame=0;}
function scrollDock(time:number){
  if(!dockDirection){dockFrame=0;return;}
  if(dockPrevious)dock.scrollLeft+=dockDirection*Math.min(40,time-dockPrevious);
  dockPrevious=time;dockFrame=requestAnimationFrame(scrollDock);
}
document.addEventListener('pointermove',event=>{
  if(dockState!=='open'||hybridsDialog.open){stopDock();return;}
  const bounds=dockWrap.getBoundingClientRect();
  const y=event.clientY,x=event.clientX;
  const safety=64;
  if(!document.body.classList.contains('in-greenhouse')&&!sweep&&(x<bounds.left-safety||x>bounds.right+safety||y<bounds.top-safety||y>bounds.bottom+safety)){setDockState('peek');return;}
  if(y<bounds.top||y>bounds.bottom||x<bounds.left-24||x>bounds.right+24){stopDock();return;}
  if(event.target instanceof Element && event.target.closest('#dock-close')){stopDock();return;}
  const left=x<bounds.left+35,right=x>bounds.right-35;
  if(!left&&!right){stopDock();return;}
  const outside=left?bounds.left-x:x-bounds.right;
  const speed=outside>=-24?.85:.07;
  dockDirection=(left?-1:1)*speed;
  if(!dockFrame)dockFrame=requestAnimationFrame(scrollDock);
});
dockWrap.onpointerleave=()=>{clearTimeout(dockHoverTimer);dockTip.hidden=true;hideDockMagnifier();};
dock.addEventListener('wheel',event=>{if(dock.scrollWidth<=dock.clientWidth)return;event.preventDefault();dock.scrollLeft+=Math.abs(event.deltaX)>Math.abs(event.deltaY)?event.deltaX:event.deltaY;},{passive:false});
window.addEventListener('blur',()=>{if(!document.body.classList.contains('in-greenhouse')&&dockState==='open')setDockState('peek');else stopDock();});
let dockMagnifier:HTMLElement|null=null;
function hideDockMagnifier(){
  dockMagnifier?.remove();dockMagnifier=null;
}
function magnifyDockCard(card:HTMLElement){
  hideDockMagnifier();
  const bounds=card.getBoundingClientRect();
  dockMagnifier=card.cloneNode(true) as HTMLElement;
  dockMagnifier.removeAttribute('draggable');
  dockMagnifier.setAttribute('aria-hidden','true');
  dockMagnifier.tabIndex=-1;
  dockMagnifier.classList.add('dock-magnifier');
  Object.assign(dockMagnifier.style,{left:bounds.left+'px',top:bounds.top+'px',width:bounds.width+'px',height:bounds.height+'px'});
  document.documentElement.append(dockMagnifier);
}
function renderDock(){
  const signature=get<HTMLSelectElement>('hybrid-sort').value+';'+get<HTMLSelectElement>('hybrid-direction').value+';'+farm.lines.map((line,i)=>!line.archived&&line.seeds>0?i+':'+line.seeds:'').join('|');
  if(document.body.classList.contains('in-greenhouse')&&dockState!=='open')setDockState('open');
  if(!document.body.classList.contains('in-greenhouse')&&hybridCount(farm)===0 && dockState!=='hidden')setDockState('hidden');
  dockWrap.hidden=dockState==='hidden'||hybridsDialog.open;
  if(signature===dockSignature)return;
  dockSignature=signature;dockTip.hidden=true;hideDockMagnifier();
  const cards=farm.lines.map((line,i)=>({line,i})).sort((a,b)=>compareHybridOrder(a.line,b.line)*Number(get<HTMLSelectElement>('hybrid-direction').value)||a.i-b.i).flatMap(({line,i})=>{
    if(line.archived||line.seeds<1)return [];
    const card=document.createElement('button');card.className='dock-hybrid';card.draggable=true;
    const genes=line.genes??{gr:1,ga:1,re:1};
    const icon=document.createElement('b');icon.textContent=crops[line.crop].symbol;
    const title=document.createElement('strong');title.textContent=line.name;
    const stats=document.createElement('small');stats.textContent='⚡ Gr '+genes.gr+' / 💰 Ga '+genes.ga+' / 🛡️ Re '+genes.re;
    const powers=document.createElement('small');powers.textContent=line.traits.map(id=>powerLabel(line,id).replace('Скорость ','').replace('Отрастание ','').replace('Урожай ','')).join(' · ');
    card.append(icon,title,stats,powers);
    card.onclick=event=>{
      if(event.detail>1)return;
      clearTimeout(dockEditTimer);
      hideDockMagnifier();dockTip.hidden=true;stopDock();openHybridInventory();
    };
    card.ondragstart=event=>{clearTimeout(dockEditTimer);dockTip.hidden=true;hideDockMagnifier();stopDock();event.dataTransfer?.setData('application/x-farm-hybrid',String(i));};
    card.onpointerenter=()=>{
      magnifyDockCard(card);
      const bounds=card.getBoundingClientRect();
      const newline=String.fromCharCode(10);
      dockTip.textContent=line.name+' · '+crops[line.crop].name+' · семян '+line.seeds+newline+
        'Gr '+genes.gr+' — скорость / Ga '+genes.ga+' — урожайность / Re '+genes.re+' — селекционный потенциал'+newline+
        line.traits.map(id=>powerLabel(line,id)).join(newline);
      dockTip.style.left='0px';
      dockTip.style.bottom=(window.innerHeight-bounds.top+bounds.height*.48+14)+'px';dockTip.hidden=false;
      const tooltipWidth=dockTip.getBoundingClientRect().width;
      dockTip.style.left=Math.max(8,Math.min(window.innerWidth-tooltipWidth-8,bounds.left+bounds.width/2-tooltipWidth/2))+'px';
    };
    card.onpointerleave=()=>{dockTip.hidden=true;hideDockMagnifier();};
    return [card];
  });
  const group=document.createElement('div');
  group.className='dock-card-group';
  group.style.setProperty('--dock-columns',String(Math.max(1,Math.ceil(cards.length/2))));
  group.append(...cards);
  dock.replaceChildren(group);
  if(cards.length<2)dockWrap.classList.remove("greenhouse-dock-expanded");
}
function applyPlantGlows(){
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  const texts:Text[]=[];
  while(walker.nextNode()){
    const text=walker.currentNode as Text;
    if(text.parentElement?.closest('#field,#greenhouse-grid,script,style,textarea,option,.plant-glow,.muted-crop,.resource-locked')||!text.textContent)continue;
    if(crops.some(crop=>text.textContent!.includes(crop.symbol)))texts.push(text);
  }
  const symbols=[...new Set(crops.map(crop=>crop.symbol))].sort((a,b)=>b.length-a.length);
  for(const text of texts){
    const source=text.textContent!,fragment=document.createDocumentFragment();
    let cursor=0;
    while(cursor<source.length){
      const symbol=symbols.find(symbol=>source.startsWith(symbol,cursor));
      if(!symbol){let end=cursor+1;while(end<source.length&&!symbols.some(s=>source.startsWith(s,end)))end++;
        fragment.append(document.createTextNode(source.slice(cursor,end)));cursor=end;continue;}
      const context=text.parentElement?.textContent??source;
      const matches=crops.map((crop,i)=>({crop,i})).filter(item=>item.crop.symbol===symbol);
      const index=(matches.find(item=>context.includes(item.crop.name))??matches[0]).i;
      const glow=document.createElement('span');glow.className='plant-glow';
      glow.style.setProperty('--icon-rarity',rarityColors[cropRarities[index]]);
      glow.textContent=symbol;fragment.append(glow);cursor+=symbol.length;
    }
    text.replaceWith(fragment);
  }
  document.querySelectorAll<HTMLElement>('.has-crop-art').forEach(host=>{
    if(host.closest('#field,#greenhouse-grid'))return;
    const path=host.dataset.art??'';
    const index=cropFolders.findIndex(folder=>path.includes('/'+folder+'/'));
    if(index>=0)host.style.filter='drop-shadow(0 0 7px '+rarityColors[cropRarities[index]]+')';
  });
}
function hideSeedTooltip(){get('seed-tooltip').hidden=true;}
function showSeedTooltip(index:number,row:HTMLElement){
  if(!unlocked(farm,index))return;
  const tooltip=get('seed-tooltip');
  const current=plantGrowthTime(farm,{crop:index,planted:nowTime(),ready:null});
  tooltip.textContent=
    '⚡ Рост: '+clock(current)+String.fromCharCode(10)+'🪙 Продажа урожая: '+(cropPrices[index]*(1+(basePowers[index].sweet??0)/100)*(1+collectionLevel(farm.harvested[index])/100)).toLocaleString('ru-RU')+' за единицу'+String.fromCharCode(10)+
    Object.entries(basePowers[index]).map(([id,value])=>abilityDefinitions[id].icon+' '+abilityDefinitions[id].name+' · '+value+(id==='resistance'?' пункт':'%')+String.fromCharCode(10)+abilityDefinitions[id].description).join(String.fromCharCode(10))+
    (farm.convenience.sowAll?String.fromCharCode(10)+'Двойной клик — засадить всё':'');
  const bounds=row.getBoundingClientRect();
  tooltip.hidden=false;tooltip.style.left='0px';tooltip.style.top='0px';
  const size=tooltip.getBoundingClientRect();
  tooltip.style.left=Math.max(8,Math.min(window.innerWidth-size.width-8,bounds.right+12))+'px';
  tooltip.style.top=Math.max(8,Math.min(window.innerHeight-size.height-8,bounds.top+(bounds.height-size.height)/2))+'px';
}
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('close',hideSeedTooltip));
window.addEventListener('blur',hideSeedTooltip);
get('seeds').addEventListener('scroll',hideSeedTooltip);
button('gather').onclick=()=>{
  gathering=!gathering;watering=false;seed=-1;selectedLine=undefined;render();
};
for(const id of ['basket-sort','basket-direction','hybrid-direction','hybrid-sort'])get(id).onchange=render;
function geneticQuality(line:Line){
  const genes=line.genes??{gr:1,ga:1,re:1};
  return (genes.gr+genes.ga+genes.re)/3;
}
function compareHybridOrder(a:Line,b:Line){
  return get<HTMLSelectElement>('hybrid-sort').value==='genes'?geneticQuality(a)-geneticQuality(b):compareHybridQuality(a,b);
}
function compareHybridQuality(a:Line,b:Line){
  const values=(line:Line)=>line.traits.map(id=>(line.powers?.[id]??(id==='growth'?10:id==='regrow'?5:1))*(1+(line.enhancements?.[id]??0)/100)).sort((x,y)=>y-x);
  const left=values(a),right=values(b);
  for(let i=0;i<3;i++){const difference=(left[i]??0)-(right[i]??0);if(difference)return difference;}
  return 0;
}
for(const id of ['seed-shop-dialog','collection-dialog','extractor-dialog','upgrades-dialog']){
  const dialog=get(id);
  const title=dialog.querySelector(':scope > h2');
  if(!title)continue;
  const header=document.createElement('div');header.className='window-heading';
  dialog.insertBefore(header,dialog.firstChild);
  const close=dialog.querySelector(':scope > form[method="dialog"], :scope > .collection-close');
  header.append(title);
  const wallet=title.querySelector('.basket-wallet');
  if(wallet)header.append(wallet);
  if(close)header.append(close);
  const tabs=dialog.querySelector(':scope > .shop-tabs');
  if(tabs)header.append(tabs);
}
document.querySelectorAll<HTMLElement>('.window-heading').forEach(header=>{
  header.querySelectorAll<HTMLElement>(':scope > h2, :scope > .basket-wallet').forEach(item=>{
    item.classList.add('glass','basket-chip');
  });
});
const hybridHeader=get('hybrids-dialog').querySelector('.window-heading')!;
hybridHeader.append(get('hybrid-search'));
function comparisonArrow(value:number,baseline:number,betterLow:boolean,dialog:HTMLElement){
  const difference=value-baseline;
  const better=betterLow?difference<0:difference>0;
  const arrow=document.createElement('button');
  arrow.type='button';arrow.className='comparison-arrow '+(difference===0?'equal':better?'better':'worse');
  arrow.textContent=difference===0?'~':better?'↑':'↓';
  arrow.title='Лучший родитель: '+Number(baseline.toFixed(2))+'. Родители показаны слева и справа.';
  arrow.onpointerenter=()=>dialog.classList.add('show-parents');
  arrow.onpointerleave=()=>dialog.classList.remove('show-parents');
  arrow.onfocus=()=>dialog.classList.add('show-parents');
  arrow.onblur=()=>dialog.classList.remove('show-parents');
  return arrow;
}
function renderComparison(dialog:HTMLElement,line:Line,genesId:string,traitsId:string){
  const parents=line.parents??[];
  dialog.classList.toggle('has-parents',parents.length===2);
  const genes=line.genes??{gr:1,ga:1,re:1};
  const labels={gr:'⚡ Gr',ga:'💰 Ga',re:'🛡️ Re'};
  get(genesId).replaceChildren(...(['gr','ga','re'] as const).map(id=>{
    const cell=document.createElement('span');cell.textContent=labels[id]+' '+genes[id]+' ';
    cell.title=id==='gr'?'Скорость роста. Больше — быстрее.':id==='ga'?'Урожайность. Больше — больше плодов.':'Селекционный потенциал. Больше — чаще потомство.';
    if(parents.length===2)cell.append(comparisonArrow(genes[id],Math.max(parents[0].genome.genes[id],parents[1].genome.genes[id]),false,dialog));
    return cell;
  }));
  get(traitsId).replaceChildren(...Array.from({length:3},(_,i)=>{
    const row=document.createElement('p'),id=line.traits[i];
    row.textContent=id?powerLabel(line,id):'Пустое свойство';
    if(id&&parents.length===2)row.append(comparisonArrow(line.powers?.[id]??0,
      Math.max(parents[0].genome.powers[id]??0,parents[1].genome.powers[id]??0),false,dialog));
    return row;
  }));
  dialog.querySelectorAll<HTMLElement>('.parent-panel').forEach((panel,i)=>{
    panel.replaceChildren();
    const parent=parents[i];if(!parent)return;
    const title=document.createElement('strong');title.textContent='Родитель '+(i+1);
    const name=document.createElement('p');name.textContent=crops[parent.crop].symbol+' '+parent.name;
    const stats=document.createElement('p');const g=parent.genome.genes;stats.textContent='⚡ Gr '+g.gr+' / 💰 Ga '+g.ga+' / 🛡️ Re '+g.re;
    panel.append(title,name,stats);
    for(const [id,value] of Object.entries(parent.genome.powers)){
      const property=document.createElement('p');property.textContent=powerLabel({name:'',crop:parent.crop,seeds:0,traits:[id],powers:{[id]:value},enhancements:parent.genome.enhancements},id);panel.append(property);
    }
  });
}
button('hybrid-rename').onclick=()=>{
  get('hybrid-rename-form').hidden=false;
  const input=get<HTMLInputElement>('hybrid-new-name');
  input.value=farm.lines[detailLine]?.name??'';input.focus();input.select();
};
get<HTMLFormElement>('hybrid-rename-form').onsubmit=event=>{
  event.preventDefault();
  const line=farm.lines[detailLine];if(!line)return;
  const name=get<HTMLInputElement>('hybrid-new-name').value.trim().slice(0,40);
  if(!name)return;
  line.name=name;get('hybrid-detail-title').textContent=name;get('hybrid-rename-form').hidden=true;
  dockSignature='';commit('Название сохранено. ID #'+(detailLine+1));
};
const rotDialog=get<HTMLDialogElement>('rot-dialog');
let rotIndex=-1;
let rotArea:PlotArea=farm;
function openRot(index:number,area:PlotArea=farm){
  rotArea=area;
  const report=rotArea.rot[index];if(!report)return;rotIndex=index;
  get('rot-description').textContent=report.name+' · погибло на проверке '+report.checks+
    ' · риск был '+formatChance(report.risk*100)+'% · стоимость на момент гибели ×'+report.value.toFixed(2);
  get('rot-genetics').textContent=report.line===undefined?'': '⚡ Gr '+report.genome.genes.gr+' / 💰 Ga '+report.genome.genes.ga+' / 🛡️ Re '+report.genome.genes.re;
  get('rot-properties').textContent=Object.entries(report.genome.powers).map(([id,value])=>powerLabel({name:'',crop:report.crop,seeds:0,traits:[id],powers:{[id]:value}},id)).join(' · ');
  if(!rotDialog.open)rotDialog.showModal();
}
button('rot-clear').onclick=()=>{rotArea.rot[rotIndex]=null;rotDialog.close();commit('Остатки убраны.');};
rotDialog.addEventListener('click',event=>{
  if(event.target!==rotDialog)return;const r=rotDialog.getBoundingClientRect();
  if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)rotDialog.close();
});
document.addEventListener('keydown',event=>{
  if(!['Shift','Control'].includes(event.key)||event.repeat||document.querySelector('dialog[open]')||
      event.target instanceof Element&&event.target.closest('input,textarea,select,[contenteditable=true]'))return;
  if(event.key==='Shift')shiftGather=true;
  else controlWater=true;
  render();
});
document.addEventListener('keyup',event=>{
  if(event.key==='Shift')shiftGather=false;
  else if(event.key==='Control')controlWater=false;
  else return;
  render();
});
window.addEventListener('blur',()=>{
  if(shiftGather||controlWater){shiftGather=false;controlWater=false;render();}
});
function openHybridInventory(){
  if(hybridsDialog.open)return;
  const source=dockWrap.hidden?null:dockWrap.getBoundingClientRect();
  clearTimeout(dockEditTimer);clearTimeout(dockHoverTimer);
  if(hybridDetail.open)hybridDetail.close();
  inventoryDockNext='peek';
  renderLines();
  if(!hybridsDialog.open)hybridsDialog.showModal();
  inventoryOrigin=hybridsDialog.getBoundingClientRect();
  dockWrap.hidden=true;dockTip.hidden=true;hideDockMagnifier();stopDock();
  if(source&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
    const target=inventoryOrigin;
    hybridsDialog.animate([
      {transform:'translate('+(source.left+source.width/2-target.left-target.width/2)+'px,'+(source.top+source.height/2-target.top-target.height/2)+'px) scale('+source.width/target.width+','+Math.max(.04,source.height/target.height)+')',opacity:.35},
      {transform:'translate(0,0) scale(1)',opacity:1}
    ],{duration:430,easing:'cubic-bezier(.22,1,.36,1)'});
  }
}
function animateInventoryFold(){
  if(!inventoryOrigin||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const origin=inventoryOrigin;
  const target=dockWrap.getBoundingClientRect();
  const ghost=document.createElement('div');ghost.className='glass inventory-fold';
  ghost.textContent='🧬 Гибриды';
  Object.assign(ghost.style,{left:origin.left+'px',top:origin.top+'px',width:origin.width+'px',height:origin.height+'px'});
  document.documentElement.append(ghost);
  const animation=ghost.animate([
    {transform:'translate(0,0) scale(1)',opacity:.7,borderRadius:'24px'},
    {transform:'translate('+(target.left-origin.left)+'px,'+(target.top-origin.top)+'px) scale('+target.width/origin.width+','+Math.min(1,28/origin.height)+')',opacity:0,borderRadius:'40px'}
  ],{duration:430,easing:'cubic-bezier(.3,.05,.25,1)'});
  animation.onfinish=()=>ghost.remove();animation.oncancel=()=>ghost.remove();
}
