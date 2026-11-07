const upgradesDialog = get<HTMLDialogElement>('upgrades-dialog');
button('upgrades-open').onclick = () => upgradesDialog.showModal();
const upgradeTabs = ['packs','seeds','weather','tools','discovery','extractor','hybrids'];
for (const tab of upgradeTabs) button('upgrade-tab-'+tab).onclick = () => {
  get('trait-panel').hidden = true;
  get('weather-panel').hidden = true;
  for (const category of upgradeTabs) {
    const active = category === tab;
    button('upgrade-tab-'+category).setAttribute('aria-pressed',String(active));
    get('upgrade-'+category).hidden = !active;
  }
};
const traitPanel = get('trait-panel');
const weatherPanel = get('weather-panel');
button('trait-close').onclick = () => {traitPanel.hidden=true;};
button('weather-close').onclick = () => {weatherPanel.hidden=true;};
upgradesDialog.onclose = () => {if(upgradesDialog.open)return;traitPanel.hidden=true;weatherPanel.hidden=true;};
upgradesDialog.addEventListener('click',event => {
  if (!(event.target instanceof Element)) return;
  if (!event.target.closest('#trait-panel,#upgrade-catalog button')) traitPanel.hidden=true;
  if (!event.target.closest('#weather-panel,#weather-catalog button')) weatherPanel.hidden=true;
});
let upgradeCrop = 0;
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
  buy.onclick = () => {if(barrierClosed(farm,upgradeCrop,id)){if(unlockBarrier(farm,upgradeCrop,id))commit('Теперь можно улучшать до '+barrierThreshold(barrierLevel(farm,upgradeCrop,id))+' уровня.');}else if (buyTrait(farm,upgradeCrop,id)) commit(label+' улучшена.');};
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
  get('trait-lock').textContent = 'Открой культуру в коллекции.';
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
    const price = traitPrice(farm.levels[index][id]);
    const orbs=traitOrbPrice(farm.levels[index][id]);
    const effect = (n:number) => id === 'growth' ? clock(growthTime(index,n)) :
      id === 'yield' ? formatChance(n)+'%' : clock(moistureTime(n,index));
    const explanation = id === 'growth' ? ' до сбора после полива' :
      id === 'yield' ? ' стартового шанса дополнительного урожая' : ' влаги от лейки или после дождя';
    get('trait-detail-'+id).textContent = 'Ур. '+level+' · '+effect(level)+
      (maxed ? '' : ' → '+effect(level+1))+explanation;
    const buy = button('trait-buy-'+id);
    buy.disabled = locked || maxed || farm.coins < price || farm.resources.orbs<orbs;
    buy.textContent = maxed ? 'Максимальный уровень' : 'Улучшить · 🪙 '+number(price)+(orbs?' · 🔮 '+number(orbs):'');
    buy.removeAttribute('title');
    if(!locked&&barrierClosed(farm,index,id)){const cost=barrierPrice(farm,index,id);const material=barrierMaterial(index,id);buy.textContent=material.icon+' '+number(cost);buy.title=material.name;buy.disabled=(farm.resources.items[material.id]??0)<cost;}
  }
  applyPlantGlows();
}

document.addEventListener('pointermove',event => {
  if (!canTilt.matches || event.pointerType !== 'mouse') return;
  document.body.style.setProperty('--background-x',((event.clientX/window.innerWidth-.5)*150)+'px');
  document.body.style.setProperty('--background-y',((event.clientY/window.innerHeight-.5)*120)+'px');
});
button('rain-card').onclick = () => {weatherPanel.hidden=!weatherPanel.hidden; renderWeather();};
const weatherOptions:WeatherUpgrade[] = ['cooldown','duration'];
for (const option of weatherOptions) button('buy-weather-'+option).onclick = () => {
  if (buyWeather(farm,option,nowTime())) commit('Погода улучшена.');
};
function renderWeather() {
  button('rain-card').setAttribute('aria-pressed',String(!weatherPanel.hidden));
  for (const option of weatherOptions) {
    const level = farm.weather[option];
    const maxed = level >= weatherUpgradeMax(option);
    const price = weatherPrice(level);
    const effect = (n:number) => {
      const duration=option==='duration';
      const minimum=duration?rainLength(n):rainCooldown(n);
      return clock(minimum)+'–'+clock(minimum+(duration?90_000:120_000));
    };
    get('weather-'+option+'-preview').textContent = 'Ур. '+level+' · '+effect(level)+(maxed ? '' : ' → '+effect(level+1));
    const buy = button('buy-weather-'+option);
    buy.disabled = maxed || farm.coins < price;
    buy.textContent = maxed ? 'Максимальный уровень' : 'Улучшить · 🪙 '+price;
  }
}
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
    buy.textContent=owned?'Открыто':'Купить · 🪙 '+option.price;
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
