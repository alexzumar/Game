function renderUpgradeChange(host:HTMLElement,level:number,current:string,next?:string,note='',description=''){
  const before='Ур. '+level+' · '+current;
  const after=next===undefined?'':'Ур. '+(level+1)+' · '+next;
  const signature=JSON.stringify([before,after,note,description]);
  if(host.dataset.change===signature)return;
  host.dataset.change=signature;
  host.textContent=before;
  if(description){
    const intro=document.createElement('span');
    intro.className='upgrade-description';
    intro.textContent=description;
    host.prepend(intro);
  }
  if(after){
    const result=document.createElement('strong');
    result.className='upgrade-next';
    result.textContent=after;
    const arrow=document.createElement('span');
    arrow.className='upgrade-arrow';
    arrow.textContent='↓';
    arrow.setAttribute('aria-hidden','true');
    host.append(arrow,result);
  }
  if(note){
    const hint=document.createElement('small');
    hint.className='upgrade-note';
    hint.textContent=note;
    host.append(hint);
  }
}

function addUpgradeDetails(anchor:HTMLElement,description:string){
  const details=document.createElement('div');
  details.className='upgrade-details';
  const summary=document.createElement('span');
  summary.textContent='Подробнее';
  summary.tabIndex=0;
  const content=document.createElement('span');
  content.id=anchor.id?anchor.id+'-help':'upgrade-help-'+document.querySelectorAll('.upgrade-details').length;
  content.className='upgrade-tooltip';
  content.setAttribute('role','tooltip');
  summary.setAttribute('aria-describedby',content.id);
  content.textContent=description;
  details.append(summary,content);
  anchor.after(details);
  bindUpgradeTooltip(summary,content);
}

function bindUpgradeTooltip(trigger:HTMLElement,tip:HTMLElement,placement?:()=>DOMRect){
  tip.setAttribute('popover','manual');
  tip.classList.add('upgrade-tooltip-card','glass','panel');
  let closeTimer:ReturnType<typeof setTimeout>;
  const hide=()=>{clearTimeout(closeTimer);if(tip.matches(':popover-open'))tip.hidePopover();};
  const hideSoon=()=>{clearTimeout(closeTimer);closeTimer=setTimeout(hide,180);};
  const show=()=>{
    clearTimeout(closeTimer);
    const dialog=trigger.closest('dialog');
    if(!dialog?.open||tip.hidden||tip.matches(':popover-open'))return;
    const card=trigger.closest('.panel')??trigger.parentElement??trigger;
    const target=placement?.();
    const bounds=target??card.getBoundingClientRect(),gap=10;
    const width=Math.min(bounds.width,innerWidth-2*gap);
    const height=Math.min(bounds.height,innerHeight-2*gap);
    let left=target?bounds.left:bounds.right+gap,top=bounds.top;
    if(!target&&left+width>innerWidth-gap){
      left=bounds.left-width-gap;
      if(left<gap){
        left=bounds.left;
        top=bounds.bottom+gap;
        if(top+height>innerHeight-gap)top=bounds.top-height-gap;
      }
    }
    tip.style.left=Math.max(gap,Math.min(left,innerWidth-width-gap))+'px';
    tip.style.top=Math.max(gap,Math.min(top,innerHeight-height-gap))+'px';
    tip.style.width=width+'px';
    tip.style.height=height+'px';
    tip.style.borderRadius=getComputedStyle(card).borderRadius;
    if(!tip.querySelector('.upgrade-tooltip-title')){
      const title=document.createElement('strong');
      title.className='upgrade-tooltip-title';
      title.textContent=card.querySelector(':scope > :is(h2,h3,strong)')?.textContent?.trim()||'Подробности';
      tip.prepend(title);
    }
    tip.showPopover();
  };
  trigger.addEventListener('pointerenter',show);
  trigger.addEventListener('pointerleave',event=>{
    if(!tip.classList.contains('knot-tooltip')){hideSoon();return;}
    if(!tip.matches(':popover-open'))return;
    if(tip.contains(event.relatedTarget as Node|null)){hideSoon();return;}
    const source=trigger.getBoundingClientRect();
    const target=tip.getBoundingClientRect();
    const towardsTip=target.left>=source.right?event.clientX>=source.right-2:
      target.right<=source.left&&event.clientX<=source.left+2;
    if(towardsTip&&event.clientY>source.top&&event.clientY<source.bottom&&event.clientY>=target.top&&event.clientY<=target.bottom)hideSoon();
    else hide();
  });
  tip.addEventListener('pointerenter',()=>clearTimeout(closeTimer));
  tip.addEventListener('pointerleave',hideSoon);
  trigger.addEventListener('focusin',show);
  trigger.addEventListener('focusout',hide);
  trigger.closest('dialog')?.addEventListener('close',hide);
}

const upgradesDialog = get<HTMLDialogElement>('upgrades-dialog');
document.addEventListener('DOMContentLoaded',()=>{
  for(const heading of document.querySelectorAll<HTMLElement>(
    '#upgrades-dialog .panel > :is(h2,h3), #trait-list .panel > strong, #diamonds-dialog .panel > h3, .workspace .panel > h2'
  )){
    if(heading.children.length)continue;
    const label=heading.textContent?.trim()??'';
    const match=label.match(/^([\p{Extended_Pictographic}↩]\uFE0F?)\s+(.+)$/u);
    const icons:Record<string,string>={'Частота проверок':'⏱','Наследование генов':'🧬','Созревание находок':'🌱','Вместимость инвентаря':'📦'};
    const badge=document.createElement('span');
    badge.className='extractor-upgrade-icon';
    badge.setAttribute('aria-hidden','true');
    badge.textContent=match?.[1]??icons[label]??'✦';
    heading.replaceChildren(badge,document.createTextNode(match?.[2]??label));
  }
});
function renderMaterialPriceTip(buy:HTMLButtonElement,ids:string[],details='',title='Материалы для покупки'){
  const hasTip=ids.length>0||!!details;
  let price=buy.parentElement!;
  if(!price.classList.contains('upgrade-price')){
    if(!hasTip)return;
    price=document.createElement('div');
    price.className='upgrade-price';
    buy.before(price);
    const tip=document.createElement('span');
    tip.className='upgrade-tooltip';
    tip.id='upgrade-price-help-'+document.querySelectorAll('.upgrade-price').length;
    tip.setAttribute('role','tooltip');
    price.append(buy,tip);
    bindUpgradeTooltip(price,tip);
  }
  const tip=price.querySelector<HTMLElement>('.upgrade-tooltip')!;
  tip.hidden=!hasTip;
  if(!hasTip&&tip.matches(':popover-open'))tip.hidePopover();
  price.tabIndex=hasTip&&buy.disabled?0:-1;
  for(const target of [price,buy]){
    if(hasTip)target.setAttribute('aria-describedby',tip.id);
    else target.removeAttribute('aria-describedby');
  }
  const signature=JSON.stringify([ids,details,title]);
  if(price.dataset.materials===signature)return;
  price.dataset.materials=signature;
  const heading=document.createElement('strong');
  heading.className='upgrade-tooltip-title';
  heading.textContent=ids.length===1?materialsBySaveKey.get(ids[0])!.name:title;
  const sourcesText=ids.map(id=>{
    const item=materialsBySaveKey.get(id)!;
    if(id==='set0')return item.description;
    const sources=crops.filter(crop=>id.startsWith('set')?'set'+crop.set===id:
      Object.keys(crop.powers).some(power=>propertyMaterialId(power)===id));
    return item.icon+' '+item.name+' · выпадает при сборе: '+(id==='duplication'?'обычные культуры':sources.map(crop=>crop.name).join(', '))+'.';
  }).join('\n');
  tip.replaceChildren(heading,[sourcesText,details].filter(Boolean).join('\n\n'));
}
const upgradeWallet=get('upgrade-wallet');
const upgradeMaterialTip=document.createElement('span');
upgradeMaterialTip.id='upgrade-material-tip';
upgradeMaterialTip.setAttribute('role','tooltip');
upgradeMaterialTip.hidden=true;
upgradeWallet.append(upgradeMaterialTip);
var upgradeMaterialsReady=true;

function renderUpgradeMaterials(){
  if(upgradeMaterialTip.hidden||!upgradesDialog.open)return;
  const items=materials.map(item=>({item,count:farm.resources.items[item.id]??0}))
    .filter(({count})=>count>0).sort((a,b)=>b.count-a.count);
  const signature=JSON.stringify(items.map(({item,count})=>[item.id,count]));
  if(upgradeMaterialTip.dataset.signature===signature)return;
  upgradeMaterialTip.dataset.signature=signature;
  upgradeMaterialTip.replaceChildren(...items.map(({item,count})=>{
    const entry=document.createElement('span');
    entry.textContent=item.icon+' '+number(count);
    entry.setAttribute('aria-label',item.name+' '+number(count));
    return entry;
  }));
  if(!items.length)upgradeMaterialTip.textContent='Материалов пока нет';
}
function showUpgradeMaterials(event:PointerEvent){
  if(event.pointerType!=='mouse'||!upgradesDialog.open||!upgradeMaterialTip.hidden)return;
  upgradeMaterialTip.hidden=false;
  delete upgradeMaterialTip.dataset.signature;
  renderUpgradeMaterials();
}
function hideUpgradeMaterials(){upgradeMaterialTip.hidden=true;}
upgradeWallet.addEventListener('pointermove',showUpgradeMaterials);
upgradeWallet.addEventListener('pointerleave',hideUpgradeMaterials);
upgradesDialog.addEventListener('scroll',hideUpgradeMaterials);
upgradesDialog.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&!upgradeMaterialTip.hidden){hideUpgradeMaterials();event.preventDefault();}
});
button('upgrades-open').onclick = () => {
  hideUpgradeMaterials();
  upgradesDialog.showModal();
};
const upgradeTabs = ['packs','seeds','tools','discovery','extractor','hybrids','helper'];
for (const tab of upgradeTabs) button('upgrade-tab-'+tab).onclick = () => {
  get('trait-panel').hidden = true;
  for (const category of upgradeTabs) {
    const active = category === tab;
    button('upgrade-tab-'+category).setAttribute('aria-pressed',String(active));
    get('upgrade-'+category).hidden = !active;
  }
};
const traitPanel = get('trait-panel');
button('trait-close').onclick = () => {traitPanel.hidden=true;};
upgradesDialog.onclose = () => {if(upgradesDialog.open)return;traitPanel.hidden=true;hideUpgradeMaterials();};
upgradesDialog.addEventListener('click',event => {
  if (!(event.target instanceof Element)) return;
  if (!event.target.closest('#trait-panel,#upgrade-catalog button')) traitPanel.hidden=true;
});
let upgradeCrop = 0;
let guardedBarrier:{crop:number;trait:Trait;bounds:DOMRect}|null=null;
const barrierSafetyMargin=32;
document.addEventListener('pointermove',event=>{
  if(!guardedBarrier||event.pointerType!=='mouse')return;
  const {bounds}=guardedBarrier;
  if(event.clientX>=bounds.left-barrierSafetyMargin&&event.clientX<=bounds.right+barrierSafetyMargin&&
    event.clientY>=bounds.top-barrierSafetyMargin&&event.clientY<=bounds.bottom+barrierSafetyMargin)return;
  guardedBarrier=null;
  if(upgradesDialog.open)renderTraits();
});
for (const i of crops.map((_,index)=>index).sort((a,b)=>cropTiers[a]-cropTiers[b]||cropTimes[a]-cropTimes[b])) {
  const crop=crops[i];
  const card = document.createElement('button');
  card.id = 'upgrade-crop-'+i;
  card.className = 'quiet';
  const icon = document.createElement('b');
  icon.textContent = crop.symbol;
  const label = document.createElement('span');
  label.textContent = crop.name;
  const hint=document.createElement('small');
  hint.textContent='Найди в пакете';
  card.append(icon,label,hint);
  card.onclick = () => {if(!unlocked(farm,i))return;upgradeCrop=i; renderTraits(); traitPanel.hidden=false;};
  get('upgrade-catalog').append(card);
}
for (const {id,label} of traits) {
  const card = document.createElement('div');
  card.className = 'glass panel';
  const title = document.createElement('strong');
  title.textContent = label;
  const detail = document.createElement('p');
  detail.id = 'trait-detail-'+id;
  const buy = document.createElement('button');
  buy.id = 'trait-buy-'+id;
  buy.className = 'quiet';
  buy.onclick = event => {
    if(barrierClosed(farm,upgradeCrop,id)){
      if(guardedBarrier?.crop===upgradeCrop&&guardedBarrier.trait===id)return;
      if(unlockBarrier(farm,upgradeCrop,id))commit('Теперь можно улучшать до '+barrierThreshold(barrierLevel(farm,upgradeCrop,id))+' уровня.');
      return;
    }
    if(!buyTrait(farm,upgradeCrop,id))return;
    const mouseClick=event instanceof PointerEvent?event.pointerType==='mouse':event.detail>0;
    if(mouseClick&&barrierClosed(farm,upgradeCrop,id)){
      guardedBarrier={crop:upgradeCrop,trait:id,bounds:buy.getBoundingClientRect()};
    }
    commit(label+' улучшена.');
  };
  card.append(title,detail,buy);
  get('trait-list').append(card);
}
function renderTraits() {
  const index = upgradeCrop;
  const crop = crops[index];
  const locked = !unlocked(farm,index);
  get('trait-title').textContent = locked ? 'Неизвестно' : crop.symbol+' '+crop.name;
  get('crop-rarity-time').textContent=locked?'':baseRarityNames[cropTiers[index]]+' · Базовое время '+clock(crop.seconds*1000);
  get('trait-list').hidden=locked;
  get('trait-lock').hidden = !locked;
  get('trait-lock').textContent = 'Открой культуру из пакета семян.';
  get('crop-ability').textContent = locked ? '' : Object.keys(basePowers[index]).map(id=>powerLabel({name:'',crop:index,seeds:0,traits:[id],powers:basePowers[index]},id)).join(' · ');
  crops.forEach((crop,i) => {
    const card=button('upgrade-crop-'+i);
    card.disabled=!unlocked(farm,i);
    card.setAttribute('aria-pressed',String(i===index));
    const symbol=crop.symbol;
    if(card.children[0].textContent!==symbol)card.children[0].textContent=symbol;
    card.children[1].textContent=card.disabled?'Заблокировано':crop.name;
    (card.children[2] as HTMLElement).hidden=!card.disabled;
    card.children[0].classList.toggle('muted-crop',card.disabled);
  });
  for (const {id} of traits) {
    const level = id === "growth" ? collectionGrowth(farm,index) : farm.levels[index][id];
    const maxed = level === traitMax;
    const price=traitPrice(index,farm.levels[index][id]);
    const orbs=traitOrbPrice(index,farm.levels[index][id]);
    const effect = (n:number) => id === 'growth' ? clock(growthTime(index,n)) :
      id === 'yield' ? formatChance(n)+'%' : clock(wateringDuration(farm,{crop:index,planted:0,ready:null},n));
    const description=id==='growth'?'Культура созревает быстрее.':
      id==='yield'?'При сборе чаще выпадает дополнительный плод.':'После полива грядка дольше остаётся влажной.';
    renderUpgradeChange(get('trait-detail-'+id),level,effect(level),maxed?undefined:effect(level+1),'',description);
    const buy = button('trait-buy-'+id);
    buy.disabled = locked || maxed || farm.coins < price || farm.resources.orbs<orbs;
    buy.textContent = maxed ? 'Максимальный уровень' : '🪙 '+number(price)+(orbs?' · 🔮 '+number(orbs):'');
    buy.removeAttribute('title');
    if(!locked&&barrierClosed(farm,index,id)){
      const cost=barrierPrice(farm,index,id);
      const material=barrierMaterial(index,id);
      const guarded=guardedBarrier?.crop===index&&guardedBarrier.trait===id;
      buy.textContent=material.icon+' '+number(cost);
      buy.title=guarded?'Отведи курсор от кнопки, чтобы открыть барьер':material.name;
      buy.disabled=guarded||(farm.resources.items[material.id]??0)<cost;
    }
    renderMaterialPriceTip(buy,!locked&&barrierClosed(farm,index,id)?[barrierMaterial(index,id).id]:[]);
  }
  applyPlantGlows();
}

document.addEventListener('pointermove',event => {
  if (!canTilt.matches || event.pointerType !== 'mouse') return;
  document.body.style.setProperty('--background-x',((event.clientX/window.innerWidth-.5)*150)+'px');
  document.body.style.setProperty('--background-y',((event.clientY/window.innerHeight-.5)*120)+'px');
});
const toolConveniences=conveniences.filter(option=>option.id!=='irrigation'&&option.id!=='replant');
for(const option of toolConveniences){
  const panel=document.createElement('section');
  panel.className='glass panel';
  const label=document.createElement('h2');
  label.textContent=option.label;
  const description=document.createElement('p');
  description.textContent=option.description;
  const buy=document.createElement('button');
  buy.id='convenience-'+option.id;
  buy.className='quiet';
  buy.onclick=()=>{if(buyConvenience(farm,option.id))commit('Улучшение открыто.');};
  panel.append(label,description,buy);
  get('convenience-list').append(panel);
}
function renderConveniences(){
  for(const option of toolConveniences){
    const owned=farm.convenience[option.id];
    const buy=button('convenience-'+option.id);
    buy.disabled=owned||farm.coins<option.price;
    buy.textContent=owned?'Открыто':'🪙 '+option.price;
  }
}
function applyGlass() {
  const style = document.documentElement.style;
  style.setProperty('--surface-opacity',(100-farm.glass.transparency)+'%');
  style.setProperty('--glass-blur',(farm.glass.strength*.34)+'px');
  style.setProperty('--glass-saturation',(100+farm.glass.strength*.55)+'%');
}
const unifiedGlass = get<HTMLInputElement>('glass-unified');
function glassPreset(value:number) {
  return value <= 50 ? {transparency:Math.round(value*.6),strength:Math.round(value*1.2)} :
    {transparency:Math.round(30+(value-50)*.8),strength:Math.round(60+(value-50)*.8)};
}
function syncUnifiedGlass() {
  const current = farm.glass;
  let best = 50;
  let distance = Infinity;
  for (let value=0;value<=100;value++) {
    const preset = glassPreset(value);
    const difference = (preset.transparency-current.transparency)**2+(preset.strength-current.strength)**2;
    if (difference < distance) {best=value;distance=difference;}
  }
  unifiedGlass.value = String(best);
}
const glassSettings = ['transparency','strength'] as const;
unifiedGlass.oninput = () => {
  farm.glass = glassPreset(unifiedGlass.valueAsNumber);
  for (const setting of glassSettings) {
    const value = String(farm.glass[setting]);
    get<HTMLInputElement>('glass-'+setting).value = value;
    get('glass-'+setting+'-value').textContent = value+'%';
  }
  applyGlass();
};
unifiedGlass.onchange = () => saveFarm(farm);
syncUnifiedGlass();
for (const setting of glassSettings) {
  const slider = get<HTMLInputElement>('glass-'+setting);
  const output = get('glass-'+setting+'-value');
  slider.value = String(farm.glass[setting]);
  output.textContent = slider.value+'%';
  slider.oninput = () => {
    farm.glass[setting] = slider.valueAsNumber;
    output.textContent = slider.value+'%';
    syncUnifiedGlass();
    applyGlass();
  };
  slider.onchange = () => saveFarm(farm);
}
applyGlass();
