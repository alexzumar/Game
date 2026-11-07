const cropFolders = ['radish','lettuce','zucchini','peas','beetroot','onion','garlic','potato','carrot','cucumber','tomato','bell-pepper','eggplant','cabbage','cauliflower','celery'];
const unavailableArt = new Set<string>();
function cropArt(host:HTMLElement,crop:number,asset:string,fallback:string) {
  const path='assets/crops/'+cropFolders[crop]+'/'+asset+'.png';
  if(host.dataset.art===path)return;
  host.dataset.art=path;
  host.classList.remove('has-crop-art');
  host.textContent=fallback;
  if(unavailableArt.has(path))return;
  const img=document.createElement('img');
  img.alt='';
  img.draggable=false;
  img.className='crop-art';
  img.onload=()=>{
    if(host.dataset.art!==path)return;
    host.replaceChildren(img);
    host.classList.add('has-crop-art');
  };
  img.onerror=()=>{
    unavailableArt.add(path);
    console.info('Ферма: изображение пока отсутствует, используется эмодзи',path);
  };
  img.src=path;
}
const get = <T extends HTMLElement = HTMLElement>(id:string) => document.getElementById(id) as T;
const farm = loadFarm();
farm.automation.replant=false;
farm.automation.irrigation=false;
document.querySelector<HTMLElement>('.debug')!.hidden=farm.saveCheats!==true;
let selected = 0;
let seed = -1;
let selectedLine:number|undefined;
let watering = false;
let gathering = false;
let shiftGather=false;
let controlWater=false;
const isWatering=()=>watering||controlWater;
const isGathering=()=>!controlWater&&(gathering||shiftGather);
let speed = 1;
let lastTick = Date.now();
const nowTime = () => Date.now() + farm.offset;
let rolling = false;
let notice = '';
const accents = ['Мята','Сирень','Персик','Голубой','Розовый'];
const clock = (ms:number) => {
  const seconds = Math.max(0,Math.ceil(ms/1000));
  return Math.floor(seconds/60) + ':' + String(seconds%60).padStart(2,'0');
};
const number = (value:number) => value.toLocaleString('ru-RU');
const formatChance = (value:number) => value.toLocaleString('ru-RU',{maximumFractionDigits:4});
const button = (id:string) => get<HTMLButtonElement>(id);
const modal = get<HTMLDialogElement>('pack-dialog');
let selectedPack = -1;
let hoveredPlot = -1;
function commit(message = '') {
  notice = message;
  saveFarm(farm);
  render();
}
function render() {
  const now = nowTime();
  const rain = rainAt(farm,now);
  document.documentElement.dataset.theme = farm.theme;
  document.documentElement.dataset.skin = farm.skin;
  get("skin").textContent = farm.skin === "glossy" ? "✧ Глянец" : "◈ Классика";
  document.documentElement.dataset.accent = String(farm.accent);
  document.body.classList.toggle('raining',rain);
  get('weather').textContent = rain ? '🌧️ Дождь · рост +'+(5+diamondLevel(farm,'rainGrowth'))+'% · ещё '+clock((farm.weather.end ?? now)-now) : '☀️ Ясно';
  get('theme').textContent = farm.theme === 'light' ? '☾ Тёмная' : '☀ Светлая';
  get('diamond-balance').textContent=number(farm.diamonds?.balance??0);
  get('dimensions').textContent = farm.size + ' × ' + farm.size;
  get('counter').textContent = number(total(farm.harvest));
  get('save-state').textContent = storageError ? 'Ошибка сохранения' : 'Сохранение на устройстве';
  get('notice').textContent = notice;
  get('basket-coins').textContent = number(farm.coins);
  get('basket-empty').hidden = total(farm.harvest) > 0;
  get('basket-dialog').classList.toggle('empty-basket',total(farm.harvest)===0);
  button('sell-basket').disabled = total(farm.harvest) === 0;
  for (const id of ['coins','seed-shop-coins','upgrade-coins']) get(id).textContent = number(farm.coins);
  button('water').setAttribute('aria-pressed',String(isWatering()));
  button('gather').setAttribute('aria-pressed',String(isGathering()));
  button('water').title = farm.convenience.waterAll ? 'Двойной клик: полить все посадки' : '';


  button('expand').hidden = farm.size >= maxSize;
  button('expand').disabled = farm.resources.orbs < expansionPrice(farm);
  button('expand').textContent = '🔮 ' + number(expansionPrice(farm));
  button('expand').setAttribute('aria-describedby','expand-note');
  get('expand-note').textContent = farm.size === maxSize ? 'Поле полностью открыто в этой версии.' :
    'Поле ' + (farm.size+1) + ' × ' + (farm.size+1);
  document.querySelectorAll<HTMLButtonElement>('.swatch').forEach((item,i) =>
    item.setAttribute('aria-pressed',String(i === farm.accent)));
  const odds = packOdds(farm,Math.max(0,selectedPack));
  renderSeeds();
  renderTraits();
  renderWeather();
  renderConveniences();
  renderCollection();
  renderDiscoveryUpgrades();
  renderExtraction();
  renderLines();
  renderDock();
  if(typeof mutationDialog!=="undefined" && mutationDialog.open && farm.plots[mutationIndex]?.mystery)button("mutation-accept").disabled=(farm.plots[mutationIndex]!.ready??Infinity)>nowTime()||hybridCount(farm)>=farm.hybridSlots;
  renderShop(odds);
  renderField(now);
  applyPlantGlows();
  if(typeof alphaReady!=='undefined'&&alphaReady)renderAlpha();
  if(typeof packsUiReady!=='undefined'&&packsUiReady)renderPackWorkshop();
  if(typeof headerFrostReady!=='undefined'&&headerFrostReady)updateHeaderFrost();
}
function renderSeeds() {
  get('yields').style.setProperty('--varieties',String(Math.max(1,Math.min(4,farm.harvest.filter(Boolean).length))));
  for (let i=0;i<crops.length;i++) {
    const row = button('seed-'+i);
    row.setAttribute('aria-pressed',String(!isWatering() && seed === i));
    const locked = !unlocked(farm,i);
    row.hidden = locked;
    row.disabled = locked;
    row.classList.toggle("out-of-stock",!farm.seeds[i]);
    row.draggable = !locked && farm.seeds[i] > 0;
    row.style.order=String(-(get<HTMLSelectElement>('seed-sort').value==='rarity'?cropRarities[i]:farm.seeds[i]));
    row.removeAttribute('title');
    get('seed-note-'+i).textContent = locked ? 'Открой в коллекции' :
      'Урожай · 🪙 '+cropPrices[i]+' за ед.';
    if(!locked)cropArt(row.querySelector('i')!,i,'packet',crops[i].symbol);
    get('seed-count-'+i).textContent = number(farm.seeds[i]);
    get('yield-'+i).textContent = number(farm.harvest[i]);
    const entry = get('harvest-row-'+i);
    entry.hidden = !farm.harvest[i];
    const sortMode=get<HTMLSelectElement>('basket-sort').value;
    const direction=Number(get<HTMLSelectElement>('basket-direction').value);
    entry.style.order=String((sortMode==='rarity'?cropRarities[i]:farm.harvest[i])*direction);
    (entry.firstElementChild as HTMLElement).draggable = !!farm.harvest[i];
  }
}
function renderField(now:number) {
  const field = get('field');
  const dryCount=rainAt(farm,now)?0:farm.plots.filter(plot=>
    plot&&!plot.mystery&&(plot.ready===null||(plot.wetUntil!==undefined&&plot.wetUntil<=now&&plot.wetUntil<plot.ready))
  ).length;
  const warning=get('dry-field-notice');
  warning.hidden=dryCount===0;
  const warningText=dryCount?'Нужен полив · грядок: '+dryCount:'';
  if(warning.textContent!==warningText)warning.textContent=warningText;
  field.style.setProperty('--size',String(farm.size));
  field.classList.toggle('dense',farm.size > 3);
  if (field.childElementCount !== farm.plots.length) {
    field.replaceChildren(...farm.plots.map((_,index) => {
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'tile';
      tile.dataset.index = String(index);
      tile.innerHTML = '<span class="tile-id"></span><span class="sprout" aria-hidden="true"></span><strong></strong><small></small>';
      tile.onpointerenter = () => {hoveredPlot=index; renderField(nowTime());};
      tile.onpointerleave = () => {hoveredPlot=-1; renderField(nowTime());};
      tile.onclick = () => {
        selected = index;
        const plot = farm.plots[index];
        if(plot)get('quick-seeds').hidden=true;
        const now = nowTime();
        if(!plot && farm.rot[index] && seed<0 && !isWatering()){openRot(index);return;}
        if(plot?.mystery){if(isGathering())takeMystery(index,tile);return;}
        applyRain(farm,now);
        if (isGathering() && collectAnimated(index,now,tile)) return commit('Урожай на складе.');
        if (isWatering() && plot && water(farm,plot,now)) {
          return commit('Грядка полита.');
        }
        if (!isGathering() && !isWatering() && !plot && (selectedLine===undefined?farm.seeds[seed]>0:farm.lines[selectedLine]?.seeds>0)) return sow(index,seed);
        if(!plot&&!isWatering()&&!isGathering()){openQuickSeeds(index,tile);return;}
        render();
      };
      tile.ondragover = event => {
        if (!farm.plots[index] && (event.dataTransfer?.types.includes('application/x-farm-seed')||event.dataTransfer?.types.includes('application/x-farm-hybrid')))
          event.preventDefault();
      };
      tile.ondrop = event => {
        event.preventDefault();
        const hybrid=event.dataTransfer?.getData('application/x-farm-hybrid');
        if(hybrid && /^\d+$/.test(hybrid)){
          const line=farm.lines[Number(hybrid)];if(!line||line.archived||line.seeds<1)return;
          selectedLine=Number(hybrid);seed=line.crop;watering=false;gathering=false;sow(index,seed);return;
        }
        selectedLine=undefined;
        const value = event.dataTransfer?.getData('application/x-farm-seed');
        if (value && /^\d+$/.test(value)) sow(index,Number(value));
      };
      return tile;
    }));
  }
  farm.plots.forEach((plot,index) => {
    const tile = field.children[index] as HTMLElement;
    const crop = plot ? crops[plot.crop] : null;
    const rot=farm.rot[index];
    tile.classList.toggle("mystery-plot",!!plot?.mystery);
    const ready = !!plot && plot.ready !== null && plot.ready <= now;
    tile.setAttribute('aria-pressed',String(index===selected));
    tile.setAttribute('aria-label','Грядка '+(index+1)+(plot?.mystery?' · неизвестное растение':crop ? ' · '+crop.name : ' · пустая'));
    tile.dataset.wet=String(rainAt(farm,now)||(plot?(plot.wetUntil??0)>now:!!farm.rainSoaked?.[index]));
    tile.dataset.state = !plot ? rot?'rotten':'empty' : ready ? 'ready' : plot.ready === null ? 'dry' : 'growing';
    tile.style.setProperty('--crop',crop?.color ?? 'var(--accent)');
    tile.children[0].textContent = String(index+1);
    const remaining = plot ? remainingGrowth(plot,now) : undefined;
    const duration = plot ? (plot.duration ?? crops[plot.crop].seconds*1000) : 0;
    const halfway = remaining !== undefined && remaining <= duration/2;
    tile.dataset.stage = !plot ? 'empty' : ready ? 'ripe' : halfway ? 'sprout' : 'seed';
    const icon = !plot ? '' : ready ? crop!.symbol : halfway ? '🌱' : '🟤';
    const visual=tile.children[1] as HTMLElement;
    if(plot?.mystery){
      delete visual.dataset.art;visual.classList.remove("has-crop-art");visual.textContent=farm.xray?crops[plot.crop].symbol:"?";
      const progress=1-(remaining??duration)/duration;visual.style.setProperty("--mystery-size",String(.4+.6*Math.max(0,Math.min(1,progress))));
    } else if(plot){
      const progress=remaining===undefined?0:1-remaining/duration;
      const stage=ready?4:progress>=2/3?3:progress>=1/3?2:1;
      cropArt(visual,plot.crop,'stage-'+stage,icon);
    } else {
      delete visual.dataset.art;
      visual.classList.remove('has-crop-art');
      visual.textContent=rot?'🍂':'';
    }
    tile.children[2].textContent = !plot&&rot?'Сгнило':plot?.mystery?'Неизвестное растение':crop?.name ?? 'Пустая грядка';
    tile.children[3].textContent = !plot ? rot?'Нажми для отчёта':'Выбери семена' : ready ? 'Готово к сбору' :
      plot.ready === null ? (remaining === undefined ? 'Нужен полив' : 'Сухо · '+clock(remaining)) : clock(remaining!);
  });
  const hint = get('field-tip');
  const hovered = field.children[hoveredPlot];
  hint.hidden = !get('quick-seeds').hidden || !hovered || (!farm.plots[hoveredPlot] && !farm.rot[hoveredPlot] && !rainAt(farm,now));
  hint.classList.toggle('hybrid-tip',!!farm.plots[hoveredPlot]?.line || farm.plots[hoveredPlot]?.line===0);
  if (!hint.hidden) {
    const wetUntil = farm.plots[hoveredPlot]?.wetUntil ?? 0;
    hint.textContent = hovered.children[2].textContent+' · '+hovered.children[3].textContent+
      (rainAt(farm,now) ? ' · Полито' : wetUntil > now ? ' · 💧 '+clock(wetUntil-now) : '');
    const plot=farm.plots[hoveredPlot];

    if(plot?.mystery && farm.xray && plot.mystery.preview){
      const genes=plot.mystery.preview.genes!;
      hint.textContent=crops[plot.crop].name+' · ⚡ Gr '+genes.gr+' / 💰 Ga '+genes.ga+' / 🛡️ Re '+genes.re+' · '+hovered.children[3].textContent;
    }
    if(plot?.line!==undefined){
      const line=farm.lines[plot.line],data=genome(farm,plot);
      hint.textContent=line.name+' · '+crops[line.crop].name+'\n⚡ Gr '+data.genes.gr+' / 💰 Ga '+data.genes.ga+' / 🛡️ Re '+data.genes.re+
        '\n'+line.traits.map(t=>powerLabel(line,t)).join(' · ')+'\n'+hovered.children[3].textContent;
    }
    if(plot){
      const forecast=ripeningInfo(farm,plot);
      if(forecast) {
        hint.classList.add('hybrid-tip');
        hint.textContent+=String.fromCharCode(10)+'Цена сейчас ×'+forecast.value.toFixed(2)+
          ' → ×'+forecast.nextValue.toFixed(2)+String.fromCharCode(10)+
          'Через '+clock(forecast.next-now)+' · риск гнили '+formatChance(forecast.risk*100)+'%';
      }
    } else if(farm.rot[hoveredPlot]){
      const record=farm.rot[hoveredPlot]!;
      hint.textContent=record.name+' · сгнило на проверке '+record.checks+' · риск '+formatChance(record.risk*100)+'% · цена ×'+record.value.toFixed(2);
    }
  }
  if(!hint.hidden)positionFieldTooltip(hint,hovered as HTMLElement);
}
function positionFieldTooltip(hint:HTMLElement,tile:HTMLElement){
  const margin=12,bounds=get('field').getBoundingClientRect(),cell=tile.getBoundingClientRect();
  hint.style.left='0px';hint.style.top='0px';
  const size=hint.getBoundingClientRect();
  const right=bounds.right+margin,left=bounds.left-size.width-margin;
  const nearLeft=cell.left+cell.width/2<bounds.left+bounds.width/2;
  const x=nearLeft?left:right;
  hint.style.left=Math.max(margin,Math.min(innerWidth-size.width-margin,x))+'px';
  hint.style.top=Math.max(margin,Math.min(innerHeight-size.height-margin,cell.top+(cell.height-size.height)/2))+'px';
}
window.addEventListener('resize',()=>{
  const hint=get('field-tip'),tile=get('field').children[hoveredPlot];
  if(!hint.hidden&&tile)positionFieldTooltip(hint,tile as HTMLElement);
});
let basketPulse:Animation|undefined;
function collectAnimated(index:number,now:number,tile:Element) {
  const plot = farm.plots[index];
  const beforeLoot={diamonds:farm.diamonds?.balance??0,orbs:farm.resources.orbs,items:{...farm.resources.items}};
  const amount = collect(farm,index,now);
  if(amount&&typeof packsUiReady!=='undefined'&&packsUiReady)animateCollectedLoot(tile,beforeLoot);
  if(!amount && plot?.line!==undefined && (plot.ready??Infinity)<=now && hybridCount(farm)>=farm.hybridSlots)notice='Инвентарь гибридов заполнен. Освободи место — растение остаётся на грядке.';
  if (!amount || !plot || matchMedia('(prefers-reduced-motion: reduce)').matches) return amount;
  try {
    const origin = tile.getBoundingClientRect();
    const icon = get('basket-icon');
    const target = icon.getBoundingClientRect();
    const flight = document.createElement('span');
    flight.className = 'harvest-flight';
    flight.textContent = crops[plot.crop].symbol+' +'+number(amount);
    flight.style.left = (origin.left+origin.width/2)+'px';
    flight.style.top = (origin.top+origin.height/2)+'px';
    document.documentElement.append(flight);
    const movement = flight.animate([
      {transform:'translate(-50%,-50%) scale(1)',opacity:1},
      {transform:'translate(calc(-50% + '+(target.left+target.width/2-origin.left-origin.width/2)+'px),calc(-50% + '+
        (target.top+target.height/2-origin.top-origin.height/2)+'px)) scale(.48)',opacity:.65}
    ],{duration:560,easing:'cubic-bezier(.35,0,.7,.85)'});
    movement.oncancel = () => flight.remove();
    movement.onfinish = () => {
      flight.remove();
      basketPulse?.cancel();
      const scale = Math.min(1.55,1.06+Math.log10(amount)*.08);
      basketPulse = button('basket').animate([{transform:'scale(1)'},{transform:'scale('+scale+') rotate(-3deg)',offset:.42},
        {transform:'scale(1)'}],{duration:amount >= 100 ? 620 : 290,easing:'ease-out'});
    };
  } catch (error) {
    console.error('Ферма: ошибка анимации сбора',error);
  }
  return amount;
}
const reelFinish = 24;
function reelItem(index:number) {
  const crop = crops[index];
  const item = document.createElement('div');
  item.className = 'reel-item';
  const mark = document.createElement('b');
  if((typeof packKnownBefore!=='undefined'&&packKnownBefore?packKnownBefore[index]:unlocked(farm,index)))cropArt(mark,index,'stage-4',crop.symbol);else mark.textContent='❔';
  const label = document.createElement('strong');
  label.textContent = (typeof packKnownBefore!=='undefined'&&packKnownBefore?packKnownBefore[index]:unlocked(farm,index))?crop.name:'Неизвестно';
  item.style.setProperty('--rarity',rarityColors[cropRarities[index]]);
  item.append(mark,label);
  return item;
}
let skipRoll = false;
let lastPackPress = -Infinity;
const runningAnimations = new Set<Animation>();
const packDone = button('pack-done');
const packNote = get('pack-animation-note');
packDone.onclick = () => {
  if (!rolling) {modal.close();return;}
  const now = performance.now();
  if (now-lastPackPress <= 450) {
    skipRoll = true;
    for (const animation of runningAnimations) animation.finish();
  }
  lastPackPress = now;
};
function runPackAnimation(element:HTMLElement,frames:Keyframe[],options:KeyframeAnimationOptions) {
  if (skipRoll || matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve();
  const animation = element.animate(frames,options);
  runningAnimations.add(animation);
  return animation.finished.then(() => {},error => {
    console.error('Ферма: анимация рулетки прервана',error);
  }).finally(() => {runningAnimations.delete(animation);});
}
function createReel(result:number,pool:number[],bonus:boolean) {
  const reel = document.createElement('div');
  reel.className = bonus ? 'reel bonus-reel' : 'reel';
  reel.setAttribute('aria-label',bonus ? 'Бонусный слот' : 'Основной слот');
  const track = document.createElement('div');
  track.className = 'reel-track';
  for (let i=0;i<=reelFinish+3;i++) track.append(reelItem(i===reelFinish ? result : pool[Math.floor(Math.random()*pool.length)]));
  reel.append(track);
  track.style.transform = 'translateX(calc(var(--ticket) * -'+(reelFinish+.5)+'))';
  return {reel,track};
}
function spinReel(track:HTMLElement,duration:number) {
  const offset=(Math.random()<.5?-1:1)*(.22+Math.random()*.22);
  return runPackAnimation(track,[
    {transform:'translateX(calc(var(--ticket) * -1.5))',offset:0,easing:'cubic-bezier(.12,.66,.14,1)'},
    {transform:'translateX(calc(var(--ticket) * -'+(reelFinish+.5+offset)+'))',offset:.82,easing:'cubic-bezier(.2,.8,.25,1)'},
    {transform:track.style.transform,offset:1}
  ],{duration,easing:'linear'});
}
function resultCard(cropIndex:number,baseCount:number) {
  const crop = crops[cropIndex];
  const card = document.createElement('div');
  card.className = 'glass pack-result';
  const icon = document.createElement('b');
  cropArt(icon,cropIndex,'stage-4',crop.symbol);
  icon.setAttribute('aria-hidden','true');
  const name = document.createElement('span');
  name.textContent = crop.name;
  const counts = document.createElement('span');
  counts.className = 'pack-result-counts';
  const base = document.createElement('strong');
  base.textContent = number(baseCount);
  base.setAttribute('aria-label','Из базовых слотов: '+baseCount);
  const bonus = document.createElement('strong');
  bonus.className = 'pack-result-bonus';
  bonus.hidden = true;
  counts.append(base,bonus);
  card.append(icon,name,counts);
  return {card,icon,bonus,count:0};
}
modal.oncancel=event=>{if(rolling)event.preventDefault();};
function sow(index:number,crop:number) {
  get('quick-seeds').hidden=true;
  if (!unlocked(farm,crop) || farm.plots[index] || !(selectedLine===undefined?farm.seeds[crop]>0:farm.lines[selectedLine]?.seeds>0)) return;
  const now = nowTime();
  selected = index;
  seed = crop;
  watering = false;gathering=false;
  plant(farm,index,crop,now,selectedLine);
  applyRain(farm,now);
  commit('Семя посажено.');
}
button('water').onclick = event => {
  if (event.detail > 1 && farm.convenience.waterAll) return;
  gathering=false;
  watering = !watering;
  seed = -1;
  render();
};
button('water').ondblclick = () => {
  if (!farm.convenience.waterAll) return;
  const now = nowTime();
  gathering=false;
  watering = true;
  seed = -1;
  const weatherChanged = applyRain(farm,now);
  const count = waterAll(farm,now);
  if (count || weatherChanged) commit(count ? 'Полито грядок: '+count+'.' : notice);
  else render();
};
button('expand').onclick = () => {
  const previousSize = farm.size;
  if (!expand(farm)) return;
  animateField();
  selected = Math.floor(selected/previousSize)*farm.size + selected%previousSize;
  commit('Поле расширено.');
};
button('skin').onclick = () => {farm.skin = farm.skin === 'glossy' ? 'classic' : 'glossy'; commit(notice);};
button('theme').onclick = () => {farm.theme = farm.theme === 'light' ? 'dark' : 'light'; commit(notice);};
for (const [i,name] of accents.entries()) {
  const swatch = document.createElement('button');
  swatch.className = 'swatch';
  swatch.dataset.color = String(i);
  swatch.title = name;
  swatch.setAttribute('aria-label',name);
  swatch.onclick = () => {farm.accent=i; commit(notice);};
  get('accents').append(swatch);
}
for (const [i,crop] of crops.entries()) {
  const row = document.createElement('button');
  row.id = 'seed-'+i;
  row.className = 'seed';
  row.style.setProperty('--crop',crop.color);
  row.innerHTML = '<i aria-hidden="true">'+crop.symbol+'</i><span><strong>'+crop.name+'</strong><small id="seed-note-'+i+'"></small></span><b id="seed-count-'+i+'"></b>';
  row.onpointerenter=()=>showSeedTooltip(i,row);
  row.onpointerleave=hideSeedTooltip;
  row.onfocus=()=>showSeedTooltip(i,row);
  row.onblur=hideSeedTooltip;
  row.addEventListener('dragstart',hideSeedTooltip);
  row.onclick = event => {
    selectedLine=undefined;
    if (event.detail > 1 && farm.convenience.sowAll) return;
    seed=!isWatering() && seed===i ? -1 : i;
    watering=false;gathering=false;
    render();
  };
  row.ondblclick = () => {
    selectedLine=undefined;
    if (!farm.convenience.sowAll) return;
    const now = nowTime();
    seed = i;
    watering = false;gathering=false;
    const count = sowAll(farm,i,now);
    const weatherChanged = applyRain(farm,now);
    if (count || weatherChanged) commit(count ? 'Засажено грядок: '+count+'.' : notice);
    else render();
  };
  row.ondragstart = event => event.dataTransfer?.setData('application/x-farm-seed',String(i));
  get('seeds').append(row);
  const entry = document.createElement('li');
  const item = document.createElement('button');
  item.className = 'quiet harvest-item';
  item.innerHTML = '<span class="harvest-icon" aria-hidden="true">'+crop.symbol+'</span><span>'+crop.name+'</span><strong id="yield-'+i+'"></strong>';
  item.onclick = () => offerSale(i);
  item.ondragstart = event => event.dataTransfer?.setData('application/x-farm-yield',String(i));
  entry.id = 'harvest-row-'+i;
  entry.append(item);
  get('yields').append(entry);
}
const basket = get<HTMLDialogElement>('basket-dialog');
const saleDialog = get<HTMLDialogElement>('sale-dialog');
const sale = get<HTMLFormElement>('sale');
const quantity = get<HTMLInputElement>('quantity');
const skipSingle = get<HTMLInputElement>('skip-single');
let skipConfirmation = false;
let selling = -1;
let confirmAll = false;
function saleQuantity(mode:string){
  const available=farm.harvest[selling]??0;
  if(mode==='one')return 1;
  if(mode==='half')return Math.floor(available/2);
  if(mode==='all')return available;
  return quantity.valueAsNumber;
}
function renderSaleQuote(mode=confirmAll?'all':'custom'){
  const count=saleQuantity(mode);
  const valid=Number.isSafeInteger(count)&&count>0&&count<=(farm.harvest[selling]??0);
  get('sale-coins').textContent=valid?'+'+number(produceSalePrice(farm,selling,count)):'—';
}

function resetAll() {
  confirmAll = false;
  get("sale-hint").textContent = "";
  button("sell-all").setAttribute("aria-pressed","false");
}
function sell(index:number,count:number) {
  if (!Number.isSafeInteger(count) || count < 1 || !(count <= farm.harvest[index])) return;
  if (farm.harvest[index] === 1 && saleDialog.open && skipSingle.checked) skipConfirmation = true;
  const earned=produceSalePrice(farm,index,count);
  removeProduce(farm,index,count);
  farm.coins += earned;
  selling = -1;
  if (saleDialog.open) saleDialog.close();
  commit('Продано: '+count+' · 🪙 +'+number(earned));
}
function offerSale(index:number) {
  const count = farm.harvest[index];
  if (!count || saleDialog.open) return;
  const single = count === 1;
  if (single && skipConfirmation) return sell(index,1);
  selling = index;
  resetAll();
  skipSingle.checked = false;
  get('skip-single-row').hidden = !single;
  for (const id of ['sell-half','sell-all','quantity-row','sell-custom']) get(id).hidden = single;
  get('sale-title').textContent = crops[index].symbol+' '+crops[index].name+' · в корзине '+count;
  quantity.max = String(count);
  quantity.value = '1';
  saleDialog.showModal();
  renderSaleQuote();
}
button('basket').onclick = () => {skipConfirmation=false; basket.showModal();};
basket.onclose = () => {skipConfirmation=false;};
saleDialog.onclose = () => {selling=-1;};
const receiptDialog = get<HTMLDialogElement>('receipt-dialog');
let receipt:number[] = [];
button('sell-basket').onclick = () => {
  receipt = [...farm.harvest];
  if (!total(receipt)) return;
  const rows = receipt.flatMap((count,i) => {
    if (!count) return [];
    const row = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = crops[i].symbol+' '+crops[i].name;
    const quantity = document.createElement('strong');
    quantity.textContent = '× '+number(count)+' · 🪙 '+number(Math.ceil(farm.harvestValue[i]));
    row.append(label,quantity);
    return [row];
  });
  get('receipt-items').replaceChildren(...rows);
  get('receipt-total').textContent = '🪙 '+number(basketSaleValue(farm));
  receiptDialog.showModal();
};
button('receipt-confirm').onclick = () => {
  if (!receiptDialog.open) return;
  const earned=basketSaleValue(farm);
  const amount = sellBasket(farm,receipt);
  receiptDialog.close();
  commit(amount ? 'Продан весь урожай: '+number(amount)+' · 🪙 +'+number(earned) :
    'Корзина изменилась. Открой чек ещё раз.');
};
const shop = get('shop');
shop.ondragover = event => {
  if (event.dataTransfer?.types.includes('application/x-farm-yield')) event.preventDefault();
};
shop.ondrop = event => {
  event.preventDefault();
  const value = event.dataTransfer?.getData('application/x-farm-yield');
  if (value && /^\d+$/.test(value)) offerSale(Number(value));
};
sale.onsubmit = event => {event.preventDefault(); sell(selling,quantity.valueAsNumber);};
quantity.addEventListener('wheel',event => {
  if (!event.deltaY) return;
  event.preventDefault();
  quantity.value = String(Math.max(1,Math.min(Number(quantity.max),(quantity.valueAsNumber || 1)+(event.deltaY < 0 ? 1 : -1))));
  resetAll();
  renderSaleQuote();
},{passive:false});
quantity.oninput=()=>{resetAll();renderSaleQuote();};
for(const mode of ['one','half','all','custom']){
  const action=button('sell-'+mode);
  action.onpointerenter=action.onfocus=()=>renderSaleQuote(mode);
  action.onpointerleave=action.onblur=()=>renderSaleQuote();
}
for (const mode of ['one','half','all']) button('sell-'+mode).onclick = () => {
  if (mode === 'all' && !confirmAll) {
    confirmAll = true;
    renderSaleQuote();
    get('sale-hint').textContent = 'Нажми «Всё» ещё раз, чтобы подтвердить продажу.';
    button('sell-all').setAttribute('aria-pressed','true');
    return;
  }
  sell(selling,saleQuantity(mode));
};
function advanceDebug() {
  const real = Date.now();
  farm.offset += Math.max(0,real-lastTick)*(speed-1);
  lastTick = real;
}
get<HTMLSelectElement>('speed').onchange = event => {
  advanceDebug();
  speed = Number((event.target as HTMLSelectElement).value);
  saveFarm(farm);
};
button('skip-rain').onclick = () => {
  advanceDebug();
  if (!rainAt(farm,nowTime())) farm.offset += Math.max(0,farm.weather.next-nowTime());
  tick();
  saveFarm(farm);
};
function animateField() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  get('field').animate([{transform:'scale(.91)',opacity:.65},{transform:'scale(1)',opacity:1}],
    {duration:420,easing:'cubic-bezier(.22,1,.36,1)'});
}
const sizePicker = get<HTMLSelectElement>('debug-size');
for (let size=1;size<=maxSize;size++) sizePicker.add(new Option(size+' × '+size,String(size)));
sizePicker.onchange = () => {
  const oldSize = farm.size;
  const next = Number(sizePicker.value);
  if (!resize(farm,next)) return;
  selected = Math.min(next-1,Math.floor(selected/oldSize))*next + Math.min(next-1,selected%oldSize);
  animateField();
  commit('Отладка: поле '+next+' × '+next+'.');
};
const seedShop = get<HTMLDialogElement>('seed-shop-dialog');
button('seed-shop').onclick = () => seedShop.showModal();
for (const tab of ['packs','seeds','fortune']) button('tab-'+tab).onclick = () => {
  for (const category of ['packs','seeds','fortune']) {
    const active = category === tab;
    button('tab-'+category).setAttribute('aria-pressed',String(active));
    get('shop-'+category).hidden = !active;
  }
};
for (const [i,crop] of crops.entries()) {
  const item = document.createElement('button');
  item.id = 'buy-seed-'+i;
  item.className = 'quiet square-card';
  const icon = document.createElement('b');
  icon.textContent=crop.symbol;
  icon.setAttribute('aria-hidden','true');
  const label = document.createElement('span');
  label.textContent = crop.name;
  const price = document.createElement('small');
  price.id = 'buy-seed-price-'+i;
  item.append(icon,label,price);
  item.onclick = () => {if (buySeed(farm,i)) commit('Куплено семечко: '+crop.name+'.');};
  get('shop-seeds').append(item);
  const odds = document.createElement('li');
  odds.id = 'odds-'+i;
  get('pack-odds').append(odds);
}
button('buy-luck').onclick = () => {
  if (buyLuck(farm)) commit('Удача пакета повышена.');
};
for (const [i,pack] of seedPacks.entries()) {
  const card = document.createElement('button');
  card.className = 'quiet square-card';
  card.id = 'pack-card-'+i;
  const icon = document.createElement('b');
  icon.textContent = pack.icon;
  const label = document.createElement('span');
  label.textContent = pack.name;
  const detail = document.createElement('small');
  detail.id = 'pack-card-note-'+i;
  card.append(icon,label,detail);
  card.onclick = () => {selectedPack=i; render();};
  get('pack-catalog').append(card);
}
function renderShop(probabilities:number[]) {
  const shopPack = seedPacks[selectedPack];
  get('pack-details').hidden = !shopPack;
  if (shopPack) {
    get('pack-title').textContent=shopPack.icon+' '+shopPack.name;
  }
  seedPacks.forEach((pack,i) => {
    button('pack-card-'+i).setAttribute('aria-pressed',String(i===selectedPack));
  });
  sizePicker.value = String(farm.size);
  crops.forEach((crop,i) => {
    const locked = !unlocked(farm,i);
    const buy = button('buy-seed-'+i);
    buy.disabled = locked || farm.coins < seedPurchaseQuote(farm,i,1);
    const icon=buy.children[0] as HTMLElement;
    const label=buy.children[1] as HTMLElement;
    if(!locked) {
      cropArt(icon,i,'packet',crop.symbol);
      label.textContent=crop.name;
    } else {
      delete icon.dataset.art;
      icon.classList.remove('has-crop-art');
      icon.textContent=crop.symbol;
      label.textContent='Заблокировано';
    }
    get('buy-seed-price-'+i).textContent = locked ? 'Найди в пакете' : '🪙 '+seedPurchaseQuote(farm,i,1)+' · В наличии: '+number(farm.seeds[i]);
    const odds = get('odds-'+i);
    odds.hidden = locked || probabilities[i] === 0;
    odds.textContent = crop.symbol+' '+crop.name+' · '+formatChance(probabilities[i])+'%';
  });
}
button('clear-plots').onclick = () => {
  if (farm.plots.every(plot => !plot)) return;
  for (const plot of farm.plots) if (plot) {if(plot.line!==undefined)farm.lines[plot.line].seeds++;else farm.seeds[plot.crop]++;}
  farm.plots.fill(null);farm.rot.fill(null);
  commit('Грядки очищены, семена возвращены.');
};
document.addEventListener('click',event => {
  if (!(event.target instanceof Element) || event.target.closest('button, dialog, .debug')) return;
  if (seed < 0 && !isWatering() && !gathering) return;
  seed = -1;
  watering = false;gathering=false;
  render();
});
const rainLayer = document.querySelector('.rain')!;
for (let i=0;i<28;i++) {
  const drop = document.createElement('span');
  drop.textContent = '💧';
  drop.style.setProperty('--x',((i*37)%101)+'%');
  drop.style.setProperty('--delay',-(i%11)*.32+'s');
  drop.style.setProperty('--duration',(2.1+(i%7)*.23)+'s');
  drop.style.setProperty('--drop-size',(12+(i%5)*4)+'px');
  rainLayer.append(drop);
}
button('debug-coins').onclick = () => {
  const input = get<HTMLInputElement>('debug-amount');
  const amount = input.valueAsNumber;
  if (!input.reportValidity() || !Number.isSafeInteger(amount) || amount < 1 ||
      !Number.isSafeInteger(farm.coins+amount)) return;
  farm.coins += amount;
  commit('Отладка: 🪙 +'+amount);
};
const fieldSurface = get('field');
type Sweep = {id:number;x:number;y:number;active:boolean;tool:'collect'|'water'|'plant';crop:number;visited:Set<number>};
let sweep:Sweep|null = null;
let suppressTileClick = false;
fieldSurface.onpointerdown = event => {
  if (!event.isPrimary || event.button !== 0) return;
  suppressTileClick = false;
  const tile = (event.target as Element).closest<HTMLElement>('.tile');
  const start = tile ? farm.plots[Number(tile.dataset.index)] : null;
  const ready = start?.ready != null && start.ready <= nowTime();
  if(!isGathering()&&!isWatering()&&seed<0)return;
  const tool = isGathering() ? 'collect' : isWatering() ? 'water' : 'plant';
  sweep = {id:event.pointerId,x:event.clientX,y:event.clientY,active:false,tool,crop:seed,visited:new Set()};
};
function workAt(stroke:Sweep,x:number,y:number,now:number) {
  const tile = document.elementFromPoint(x,y)?.closest<HTMLElement>('.tile');
  if (!tile || !fieldSurface.contains(tile)) return false;
  const index = Number(tile.dataset.index);
  if (stroke.visited.has(index)) return false;
  stroke.visited.add(index);
  if (stroke.tool === 'collect') {
    if(!isGathering())return false;
    if(farm.plots[index]?.mystery){takeMystery(index,tile);return true;}
    return collectAnimated(index,now,tile)>0;
  }
  if (stroke.tool === 'plant') return plant(farm,index,stroke.crop,now,selectedLine);
  const plot = farm.plots[index];
  return !!plot && water(farm,plot,now);
}
fieldSurface.onpointermove = event => {
  if (!sweep || event.pointerId !== sweep.id) return;
  const dx = event.clientX-sweep.x;
  const dy = event.clientY-sweep.y;
  const distance = Math.hypot(dx,dy);
  if (!sweep.active && distance < 6) return;
  if (!sweep.active) {
    sweep.active = true;
    suppressTileClick = true;
    fieldSurface.setPointerCapture(event.pointerId);
  }
  const steps = Math.max(1,Math.ceil(distance/8));
  let changed = false;
  const now = nowTime();
  const weatherChanged = applyRain(farm,now);
  for (let i=0;i<=steps;i++) if (workAt(sweep,sweep.x+dx*i/steps,sweep.y+dy*i/steps,now)) changed = true;
  sweep.x = event.clientX;
  sweep.y = event.clientY;
  if (weatherChanged && !changed) saveFarm(farm);
  if (changed) {
    applyRain(farm,now);
    const messages = {collect:'Урожай на складе.',plant:'Семена посажены.',water:'Грядки политы.'};
    commit(messages[sweep.tool]);
  }
};
function endSweep(event:PointerEvent) {
  if (sweep?.id === event.pointerId) sweep = null;
}
window.addEventListener('pointerup',endSweep);
window.addEventListener('pointercancel',endSweep);
fieldSurface.addEventListener('click',event => {
  if (!suppressTileClick || event.detail === 0) return;
  suppressTileClick = false;
  event.stopPropagation();
},true);
function syncFocus() {
  document.documentElement.classList.toggle('background-paused',document.hidden || !document.hasFocus());
}
window.addEventListener('focus',syncFocus);
window.addEventListener('blur',syncFocus);
document.addEventListener('visibilitychange',syncFocus);
syncFocus();
const canTilt = matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
const tiltTargets = '.seed:not(.out-of-stock), .square-card, .harvest-item, #shop-seeds button, #seed-shop, #open-pack, #upgrades-open, #upgrade-catalog button';
let tilted:HTMLElement|null = null;
function resetTilt() {
  tilted?.classList.remove('tilting');
  tilted = null;
}
document.addEventListener('pointermove',event => {
  if (!canTilt.matches || event.pointerType !== 'mouse' || event.buttons ||
      !(event.target instanceof Element)) return resetTilt();
  const card = event.target.closest<HTMLElement>(tiltTargets);
  if (card !== tilted) resetTilt();
  if (!card || card.matches(':disabled')) return;
  const bounds = card.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;
  const x = Math.max(-.5,Math.min(.5,(event.clientX-bounds.left)/bounds.width-.5));
  const y = Math.max(-.5,Math.min(.5,(event.clientY-bounds.top)/bounds.height-.5));
  card.style.setProperty('--glare-x',((x+.5)*100)+'%');
  card.style.setProperty('--glare-y',((y+.5)*100)+'%');
  card.style.setProperty('--tilt-x',(-y*7)+'deg');
  card.style.setProperty('--tilt-y',(x*7)+'deg');
  card.classList.add('tilting');
  tilted = card;
});
document.documentElement.addEventListener('pointerleave',resetTilt);
document.addEventListener('pointerdown',resetTilt);
window.addEventListener('blur',resetTilt);
canTilt.addEventListener('change',resetTilt);
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
const collectionDialog=get<HTMLDialogElement>('collection-dialog');
button('collection-open').onclick=()=>collectionDialog.showModal();
button('collection-close').onclick=()=>collectionDialog.close();
let discoveryBusy=false;
let selectedCollection=-1;
for(const [i] of crops.entries()) {
  const card=document.createElement('button');card.className='glass panel collection-card';
  card.id='collection-crop-'+i;
  card.onclick=()=>{
    if(!unlocked(farm,i))return;
    selectedCollection=i;
    get('collection-detail').hidden=false;
    renderCollection();
  renderDiscoveryUpgrades();
  renderExtraction();
  renderLines();
  renderDock();
  if(typeof mutationDialog!=="undefined" && mutationDialog.open && farm.plots[mutationIndex]?.mystery)button("mutation-accept").disabled=(farm.plots[mutationIndex]!.ready??Infinity)>nowTime()||hybridCount(farm)>=farm.hybridSlots;
  };
  get('collection-grid').append(card);
}
function renderCollection() {
  crops.forEach((crop,i)=>{
    const count=farm.collection[i];
    const card=button('collection-crop-'+i);
    card.textContent=count ? crop.symbol+' '+crop.name+' · '+count+' находок' : '🔒 Неизвестно';
    card.classList.toggle('unknown-crop',!count);
    card.disabled=!count;
  });
  button('discover').disabled=discoveryBusy || farm.discoveries>0 && farm.coins<discoveryPrice;
  button('discover').textContent=farm.discoveries===0?'Первое открытие бесплатно':'Рулетка видов · 🪙 '+discoveryPrice;
  button('collection-close').disabled=discoveryBusy;
  get('collection-coins').textContent=number(farm.coins);
  if(selectedCollection>=0) {
    const i=selectedCollection,count=farm.collection[i],level=collectionLevel(count);
    get('collection-detail').textContent=crops[i].symbol+' '+crops[i].name+' · Найдено за игру: '+number(count)+
      ' · ⚡ Уровень коллекции '+level+' · Рост '+clock(growthTime(i,collectionGrowth(farm,i))/growthMultiplier(farm))+
      ' · До следующего уровня: '+number(nextCollectionAt(count)-count)+' находок.';
  }
  get('sets-list').replaceChildren(...cropSets.map((set,index)=>{
    const row=document.createElement('section');row.className='glass panel set-row';
    const title=document.createElement('h3');title.textContent=set.name;
    const description=document.createElement('p');
    const completed=collectionSets(farm)[index]>0;
    description.textContent=(completed?'✓ Собран. ':'')+'Бонус будет определён позже.'+(index===2?' · Открывает покупку автополива.':'');
    const icons=document.createElement('div');icons.className='set-icons';
    set.crops.forEach(i=>{
      const item=document.createElement('span');const known=unlocked(farm,i);
      item.textContent=known?crops[i].symbol:'🔒';
      item.className=known?'':'unknown-crop';
      item.title=known?crops[i].name:'Шанс открытия: '+formatChance(discoveryOdds()[i])+'%';
      icons.append(item);
    });
    row.append(title,icons,description);return row;
  }));
}
button('show-sets').onclick=()=>{
  const panel=get('sets-list');panel.hidden=!panel.hidden;
  const setsVisible=!panel.hidden;
  get('collection-grid').hidden=setsVisible;
  get('collection-detail').hidden=true;
  for(const id of ['discover','discovery-reel','discovery-result'])get(id).hidden=setsVisible;
  button('show-sets').textContent=setsVisible?'К коллекции':'Наборы';
};
collectionDialog.oncancel=event=>{if(discoveryBusy)event.preventDefault();};
button('discover').onclick=async()=>{
  if(discoveryBusy)return;
  const results=discover(farm);
  if(!results.length)return;
  discoveryBusy=true;commit();
  try {
    get('discovery-result').textContent='Рулетки крутятся…';
    const pool=crops.map((_,i)=>i);
    const reels=results.map(result=>createReel(result.crop,pool,false));
    get('discovery-reel').replaceChildren(...reels.map(item=>item.reel));
    if(!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      await Promise.all(reels.map(({track},i)=>track.animate([
        {transform:'translateX(calc(var(--ticket) * -1.5))'},{transform:track.style.transform}
      ],{duration:Math.max(450,2900/(1+farm.discoveryUp.speed*.15))+i*90,easing:'cubic-bezier(.12,.66,.14,1)'}).finished));
    }
    get('sets-list').hidden=true;get('collection-grid').hidden=false;
    for(let i=0;i<results.length;i++){
      const result=results[i],card=button('collection-crop-'+result.crop);
      card.scrollIntoView({block:'nearest'});
      if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
        const from=reels[i].reel.getBoundingClientRect(),to=card.getBoundingClientRect();
        const frame=collectionDialog.getBoundingClientRect();
        const flight=document.createElement('span');flight.className='pack-seed-flight';
        flight.textContent=crops[result.crop].symbol+' +'+result.amount;
        flight.style.left=(from.left+from.width/2-frame.left+collectionDialog.scrollLeft)+'px';
        flight.style.top=(from.top+from.height/2-frame.top+collectionDialog.scrollTop)+'px';
        collectionDialog.append(flight);
        try {
          await flight.animate([
            {transform:'translate(-50%,-50%)'},
            {transform:'translate(calc(-50% + '+(to.left+to.width/2-from.left-from.width/2)+'px),calc(-50% + '+
              (to.top+to.height/2-from.top-from.height/2)+'px)) scale(.7)'}
          ],{duration:430,easing:'ease-out'}).finished;
        } finally {flight.remove();}
      }
    }
    const sums=new Map<number,number>();
    for(const item of results)sums.set(item.crop,(sums.get(item.crop)??0)+item.amount);
    get('discovery-result').textContent=Array.from(sums,([crop,count])=>crops[crop].symbol+' '+crops[crop].name+' +'+count).join(' · ');
  } catch(error){console.error('Ферма: ошибка рулетки коллекции',error);}
  finally{finishDiscovery(farm);discoveryBusy=false;commit();}
};
for(const [id,label] of [['speed','Скорость прокрутки'],['slots','Количество рулеток'],['amount','Находки в слоте']] as const){
  const panel=document.createElement('section');panel.className='glass panel';
  const title=document.createElement('h2');title.textContent=label;
  const info=document.createElement('p');info.id='discovery-up-info-'+id;
  const buy=document.createElement('button');buy.className='quiet';buy.id='discovery-up-buy-'+id;
  buy.onclick=()=>{if(buyDiscoveryUpgrade(farm,id))commit('Рулетка улучшена.');};
  panel.append(title,info,buy);get('discovery-upgrades').append(panel);
}
function renderDiscoveryUpgrades(){
  for(const id of ['speed','slots','amount'] as const){
    const level=farm.discoveryUp[id],price=discoveryUpgradePrice(farm,id);
    const bonus=level*.05;
    get('discovery-up-info-'+id).textContent=id==='slots'?(1+level)+' из 3 слотов':
      id==='speed'?(2900/(1+level*.15)/1000).toFixed(2)+' с':
      'Гарантировано '+(1+Math.floor(bonus))+' находок + '+formatChance(bonus%1*100)+'% на ещё одну.';
    const buy=button('discovery-up-buy-'+id);buy.disabled=level>=discoveryLimit(id)||farm.coins<price;
    buy.textContent=level>=discoveryLimit(id)?'Максимум':'Улучшить · 🪙 '+price;
  }
}
button('debug-unlock-crops').onclick=()=>{
  farm.collection=farm.collection.map(count=>Math.max(1,count));
  commit('Отладка: все культуры открыты.');
};
button('reset-game').onclick=()=>{
  if(discoveryBusy || rolling || !confirm('Удалить весь прогресс, коллекцию и улучшения?'))return;
  try{if(saveFarm({...newFarm(),saveCheats:farm.saveCheats}))location.reload();}
  catch(error){console.error('Ферма: не удалось сбросить прогресс',error);}
};
document.querySelectorAll<HTMLDialogElement>('dialog').forEach(dialog=>{
  dialog.addEventListener('click',event=>{
    if(event.target!==dialog || dialog===modal && rolling || dialog===collectionDialog && discoveryBusy)return;
    const r=dialog.getBoundingClientRect();
    if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();
  });
});
const extractionDialog=get<HTMLDialogElement>('extractor-dialog');
let extractionCrop=0;
button('extractor-open').onclick=()=>{extractionDialog.showModal();renderExtraction();};
button('extraction-toast').onclick=()=>{extractionDialog.showModal();renderExtraction();};
extractionDialog.onclose=renderExtraction;
const extractionPicker=get<HTMLDialogElement>('extractor-picker');
let selectedExtractionSlot=0;
const extractionCards=Array.from({length:3},(_,slot)=>{
  const card=document.createElement('button');
  card.className='glass extractor-slot';
  card.innerHTML='<b></b><span></span><small></small>';
  const fill=document.createElement('span');
  fill.className='extractor-fill';
  fill.setAttribute('aria-hidden','true');
  card.prepend(fill);
  card.onclick=()=>{
    if(extractionJobs(farm.extraction)[slot]){
      if(confirm('Остановить эту партию и вернуть оставшиеся плоды?')&&stopExtraction(farm,nowTime(),slot))commit('Остаток урожая возвращён в корзину.');
      return;
    }
    selectedExtractionSlot=slot;
    extractionCrop=farm.harvest.findIndex(count=>count>0);
    if(extractionCrop<0)extractionCrop=0;
    extractionInput.value='1';
    extractionPicker.showModal();
    renderExtraction();
  };
  get('extractor-slots').append(card);
  return card;
});
const extractionSlotUpgrade=document.createElement('button');
extractionSlotUpgrade.className='quiet';
const extractionSlotPanel=document.createElement('section');
extractionSlotPanel.className='glass panel';
extractionSlotPanel.innerHTML='<h3>Слоты переработки</h3><p id="extractor-slot-detail"></p>';
extractionSlotPanel.append(extractionSlotUpgrade);
get('extractor-upgrades').append(extractionSlotPanel);
const extractionSlotCosts=[{orbs:50,material:1},{orbs:250,material:5}];
extractionSlotUpgrade.onclick=()=>{
  const slots=farm.extraction.slots??1,cost=extractionSlotCosts[slots-1];
  if(!cost||farm.resources.orbs<cost.orbs||(farm.resources.items.set0??0)<cost.material)return;
  spendFarmOrbs(farm,cost.orbs);
  farm.resources.items.set0-=cost.material;
  farm.extraction.slots=slots+1;
  commit('Открыт новый слот экстрактора.');
};
const extractionInput=get<HTMLInputElement>('extractor-count');
for(const [i,crop] of crops.entries()){
  const card=document.createElement('button');card.className='quiet square-card';card.id='extractor-crop-'+i;
  card.onclick=()=>{extractionCrop=i;extractionInput.value='1';renderExtraction();};
  get('extractor-crops').append(card);
}
for(const [id,label] of [['speed','⚡ Скорость переработки'],['yield','🌱 Выход семян']] as const){
  const panel=document.createElement('section');panel.className='glass panel';
  const title=document.createElement('h3');title.textContent=label;
  const info=document.createElement('p');info.id='extraction-info-'+id;
  const buy=document.createElement('button');buy.id='extraction-buy-'+id;buy.className='quiet';
  buy.onclick=()=>{if(buyExtraction(farm,id))commit('Экстрактор улучшен.');};
  panel.append(title,info,buy);get('extractor-upgrades').append(panel);
}
function renderExtraction(){
  const machine=farm.extraction,now=nowTime();
  const available=farm.harvest[extractionCrop];
  get('extractor-coins').textContent=number(farm.coins);
  const jobs=extractionJobs(machine),slots=machine.slots??1;
  const cost=extractionSlotCosts[slots-1];
  extractionSlotUpgrade.disabled=!cost||farm.resources.orbs<cost.orbs||(farm.resources.items.set0??0)<cost.material;
  get('extractor-slot-detail').textContent=cost?slots+' из 3. Следующее улучшение добавит ещё одну параллельную партию.':'Доступны 3 параллельные партии.';
  extractionSlotUpgrade.textContent=cost?'🔮 '+number(cost.orbs)+' · 🌱 '+number(cost.material):'Максимум';
  extractionCards.forEach((card,slot)=>{
    card.hidden=slot>=slots;
    const current=jobs[slot];
    const start=current&&current.done?extractionDeadline(current,current.done-1):current?.start??now;
    const period=current?Math.max(1,extractionDeadline(current,current.done)-start):1;
    const elapsed=current?now-start:0;
    const fill=card.querySelector<HTMLElement>('.extractor-fill')!;
    const cycle=current?[current.start,current.done,speed].join(':'):'';
    if(card.dataset.progressCycle!==cycle){
      fill.getAnimations().forEach(animation=>animation.cancel());
      if(current){
        const remaining=Math.max(0,period-elapsed);
        fill.animate([{transform:'scaleY('+(1-Math.min(1,remaining/period))+')'},{transform:'scaleY(1)'}],{
          duration:remaining/speed,fill:'forwards',easing:'linear'
        });
      }else if(card.dataset.progressCycle&&now>=Number(card.dataset.batchEnd)){
        fill.animate([{transform:'scaleY(1)',opacity:1},{transform:'scaleY(1)',opacity:1,offset:.45},{transform:'scaleY(1)',opacity:0}],{duration:420});
      }
      card.dataset.progressCycle=cycle;
      card.dataset.batchEnd=current?String(current.end):'';
    }
    card.querySelector('b')!.textContent=current?crops[current.crop].symbol:'+';
    card.querySelector('span:not(.extractor-fill)')!.textContent=current?crops[current.crop].name+' ×'+(current.input-current.done):'Слот '+(slot+1);
    card.querySelector('small')!.textContent=current?clock(period-elapsed)+' · 🌱 '+total(current.outputs.slice(0,current.done)):'Добавить урожай';
    card.title=current?'Нажми, чтобы остановить партию':'Выбрать урожай и количество';
  });
  const activeJobs=jobs.filter(Boolean);
  const toast=get('extraction-toast');
  toast.hidden=extractionDialog.open||!activeJobs.length;
  get('extraction-toast-label').textContent='⚙️ Партий в работе: '+activeJobs.length;
  get('extraction-toast-time').textContent=machine.last;
  get('extractor-last').textContent=machine.last||'Результат появится после обработки первого плода.';
  crops.forEach((crop,i)=>{
    const card=button('extractor-crop-'+i);card.hidden=!farm.harvest[i];
    card.textContent=crop.symbol+' '+crop.name+' · '+number(farm.harvest[i]);
    card.setAttribute('aria-pressed',String(i===extractionCrop));card.classList.toggle('out-of-stock',!farm.harvest[i]);
  });
  get('extractor-empty').textContent=total(farm.harvest)?'':'Собери урожай, чтобы извлечь из него семена.';
  get('extractor-selection').textContent=crops[extractionCrop].symbol+' '+crops[extractionCrop].name+' · доступно '+available;
  extractionInput.max=String(Math.min(extractionCapacity,available));
  const count=extractionInput.valueAsNumber;
  const bonus=extractionRange(machine.yield);
  get('extractor-estimate').textContent=Number.isSafeInteger(count)&&count>0 ?
    'Время: '+clock(extractionTime(machine.speed)*count)+' · от 1 до '+bonus.max+' семян с плода'+(bonus.extra?' · '+formatChance(bonus.extra*100)+'% расширить диапазон до '+(bonus.max+1):'')+' · неудача 1%, последний посевной материал защищён.' : 'Введи целое количество.';
  button('extractor-start').disabled=!!jobs[selectedExtractionSlot] || !Number.isSafeInteger(count)||count<1||count>Math.min(extractionCapacity,available);
  for(const id of ['speed','yield'] as const){
    const level=machine[id],price=extractionCost(level,id);
    get('extraction-info-'+id).textContent='Ур. '+level+' · '+(id==='speed'?(extractionTime(level)/1000).toLocaleString('ru-RU',{maximumFractionDigits:2})+' с на плод':
      'Равномерно 1–'+bonus.max+' · '+formatChance(bonus.extra*100)+'% расширить до 1–'+(bonus.max+1)+'. Каждый уровень +25 п. п.');
    const buy=button('extraction-buy-'+id);buy.disabled=extractionUpgradeMaxed(farm,id)||farm.coins<price;buy.textContent=extractionUpgradeMaxed(farm,id)?'Максимум':'🪙 '+number(price);
  }
}
extractionInput.oninput=renderExtraction;
button('extractor-half').onclick=()=>{extractionInput.value=String(Math.max(1,Math.min(extractionCapacity,Math.floor(farm.harvest[extractionCrop]/2))));renderExtraction();};
button('extractor-all').onclick=()=>{extractionInput.value=String(Math.max(1,Math.min(extractionCapacity,farm.harvest[extractionCrop])));renderExtraction();};
get<HTMLFormElement>('extractor-form').onsubmit=event=>{
  event.preventDefault();
  if(startExtraction(farm,extractionCrop,extractionInput.valueAsNumber,nowTime(),Math.random,selectedExtractionSlot)){extractionPicker.close();commit('Урожай отправлен в экстрактор.');}
};
extractionDialog.addEventListener('click',event=>{
  if(event.target!==extractionDialog)return;
  const r=extractionDialog.getBoundingClientRect();
  if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)extractionDialog.close();
});
document.querySelectorAll<HTMLElement>('[data-upgrade-target]').forEach(title=>{
  title.title='Нажми дважды, чтобы перейти к прокачке';
  title.tabIndex=0;
  title.setAttribute('role','button');
  const navigate=()=>{
    const target=title.id==='seed-shop-upgrade-title'?(get('shop-seeds').hidden?'packs':'seeds'):title.dataset.upgradeTarget;
    if(!target || rolling || discoveryBusy)return;
    const parent=title.closest<HTMLDialogElement>('dialog');
    if(parent && parent!==upgradesDialog)parent.close();
    if(!upgradesDialog.open)upgradesDialog.showModal();
    button('upgrade-tab-'+target).click();
    button('upgrade-tab-'+target).focus();
  };
  title.ondblclick=event=>{event.preventDefault();event.stopPropagation();navigate();};
  title.onkeydown=event=>{
    if(event.key==='Enter'||event.key===' '){event.preventDefault();navigate();}
  };
});
function animateExtractedSeeds(crop:number,count:number) {
  if(count<=0||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const row=button('seed-'+crop);
  if(row.hidden)return;
  const start=get('seed-stock-title').getBoundingClientRect(),end=row.getBoundingClientRect();
  const flight=document.createElement('span');flight.className='harvest-flight';
  flight.textContent=crops[crop].symbol+' '+crops[crop].name+' ×'+number(count);
  flight.style.left=(start.right+8)+'px';flight.style.top=(start.top+start.height/2)+'px';
  document.documentElement.append(flight);
  try{
    const animation=flight.animate([
      {transform:'translate(0,-50%)',opacity:1},
      {transform:'translate('+(end.left+end.width/2-start.right-8)+'px,'+(end.top+end.height/2-start.top-start.height/2)+'px) scale(.6)',opacity:.6}
    ],{duration:620,easing:'ease-in-out'});
    animation.onfinish=()=>{
      flight.remove();
      row.animate([{transform:'scale(1)'},{transform:'scale(1.045)',offset:.4},{transform:'none'}],{duration:250});
    };
    animation.oncancel=()=>flight.remove();
  }catch(error){flight.remove();console.error('Ферма: ошибка перелёта извлечённых семян',error);}
}
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
}
button('hybrid-plant').onclick=()=>{
  const line=farm.lines[detailLine];if(!line||line.archived||line.seeds<1)return;
  selectedLine=detailLine;seed=line.crop;watering=false;gathering=false;
  inventoryDockNext="open";
  setDockState("open");
  hybridDetail.close();hybridsDialog.close();commit('Выбран '+line.name);
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
function renderLines(){
  const used=hybridCount(farm);
  for(const i of markedHybrids)if(farm.lines[i]?.archived||!farm.lines[i]?.seeds)markedHybrids.delete(i);
  get('hybrid-capacity').textContent=used+'/'+farm.hybridSlots;
  get('hybrid-coins').textContent=number(farm.coins);
  const price=hybridExpansionPrice(farm);
  button('hybrid-expand').disabled=farm.coins<price;
  button('hybrid-expand').textContent='+5 мест · 🪙 '+number(price);
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
function openMutation(index:number){
  mutationIndex=index;
  const plot=farm.plots[index];
  if(!plot?.mystery)return;
  const ready=plot.ready!==null&&plot.ready<=nowTime();
  get('mutation-icon').textContent=crops[plot.crop].symbol;
  get('mutation-info').textContent='Гибрид '+plot.mystery.parents.map(i=>crops[i].name).join(' × ')+
    ' · Время роста '+clock(plot.duration!)+(ready?' · Созрел':' · До созревания '+clock(plot.ready!-nowTime()));
  get('mutation-result').textContent='';
  if(plot.mystery.preview)renderComparison(mutationDialog,plot.mystery.preview,'mutation-genes','mutation-traits');
  button('mutation-accept').disabled=!ready||hybridCount(farm)>=farm.hybridSlots;
  if(hybridCount(farm)>=farm.hybridSlots)get('mutation-result').textContent='Инвентарь заполнен. Расширь его или освободи место — находка останется на грядке.';
  button('mutation-discard').hidden=false;resetDeletePress(button('mutation-discard'));
  if(!mutationDialog.open)mutationDialog.showModal();
}
button('mutation-accept').onclick=()=>{
  const result=acceptMutation(farm,mutationIndex,nowTime());
  if(!result)return;
  get('mutation-result').textContent='Получено семя линии. '+(result.replaced?
    'Заменено: '+traitNames[result.replaced]+' → '+traitNames[result.added]:
    'Добавлено: '+traitNames[result.added])+'. Все свойства: '+result.line.traits.map(t=>traitNames[t]).join(' · ');
  button('mutation-accept').disabled=true;button('mutation-discard').hidden=true;
  if(result.line.parents)renderComparison(mutationDialog,result.line,'mutation-genes','mutation-traits');
  mutationDialog.close();
  commit('Новая линия на складе.');
};
button('mutation-discard').onclick=()=>{
  if(!farm.plots[mutationIndex]?.mystery||!confirmDeletePress(button('mutation-discard')))return;
  farm.plots[mutationIndex]=null;mutationDialog.close();commit('Находка удалена.');
};
mutationDialog.addEventListener('click',event=>{
  if(event.target!==mutationDialog)return;
  const r=mutationDialog.getBoundingClientRect();
  if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)mutationDialog.close();
});
get<HTMLInputElement>('debug-amount').addEventListener('keydown',event=>{
  if(event.key==='Enter'){event.preventDefault();button('debug-coins').click();}
});
function takeMystery(index:number,tile:HTMLElement){
  const plot=farm.plots[index];if(!plot?.mystery)return;
  if((plot.ready??Infinity)>nowTime()){notice='Находка ещё растёт.';render();return;}
  openMutation(index);
}
button('buy-xray').onclick=()=>{if(buyXray(farm))commit('Xray открыт.');};
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
  if(!sweep&&(x<bounds.left-safety||x>bounds.right+safety||y<bounds.top-safety||y>bounds.bottom+safety)){setDockState('peek');return;}
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
window.addEventListener('blur',()=>{if(dockState==='open')setDockState('peek');else stopDock();});
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
  get('xray-price').textContent='🪙 '+number(xrayCost)+' + 🔮 '+xrayRelics+' · найдено предметов '+farm.relics;
  button('buy-xray').disabled=farm.xray||farm.coins<xrayCost||farm.relics<xrayRelics;
  button('buy-xray').textContent=farm.xray?'Открыто':'Открыть Xray';
  const signature=get<HTMLSelectElement>('hybrid-sort').value+';'+get<HTMLSelectElement>('hybrid-direction').value+';'+farm.lines.map((line,i)=>!line.archived&&line.seeds>0?i+':'+line.seeds:'').join('|');
  if(hybridCount(farm)===0 && dockState!=='hidden')setDockState('hidden');
  dockWrap.hidden=dockState==='hidden'||hybridsDialog.open;
  if(signature===dockSignature)return;
  dockSignature=signature;dockTip.hidden=true;hideDockMagnifier();
  dock.replaceChildren(...farm.lines.map((line,i)=>({line,i})).sort((a,b)=>compareHybridOrder(a.line,b.line)*Number(get<HTMLSelectElement>('hybrid-direction').value)||a.i-b.i).flatMap(({line,i})=>{
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
  }));
}
function applyPlantGlows(){
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  const texts:Text[]=[];
  while(walker.nextNode()){
    const text=walker.currentNode as Text;
    if(text.parentElement?.closest('#field,script,style,textarea,option,.plant-glow,.muted-crop,.resource-locked')||!text.textContent)continue;
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
    if(host.closest('#field'))return;
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
function openRot(index:number){
  const report=farm.rot[index];if(!report)return;rotIndex=index;
  get('rot-description').textContent=report.name+' · погибло на проверке '+report.checks+
    ' · риск был '+formatChance(report.risk*100)+'% · стоимость на момент гибели ×'+report.value.toFixed(2);
  get('rot-genetics').textContent=report.line===undefined?'': '⚡ Gr '+report.genome.genes.gr+' / 💰 Ga '+report.genome.genes.ga+' / 🛡️ Re '+report.genome.genes.re;
  get('rot-properties').textContent=Object.entries(report.genome.powers).map(([id,value])=>powerLabel({name:'',crop:report.crop,seeds:0,traits:[id],powers:{[id]:value}},id)).join(' · ');
  if(!rotDialog.open)rotDialog.showModal();
}
button('rot-clear').onclick=()=>{farm.rot[rotIndex]=null;rotDialog.close();commit('Остатки убраны.');};
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
const tick = () => {
  advanceDebug();
  const abilitiesChanged=updatePlantAbilities(farm,nowTime());
  const ripened=updateRipening(farm,nowTime());
  const mutated=checkMutations(farm,nowTime());
  const weatherChanged=applyRain(farm,nowTime());
  const beforeSeeds=[...farm.seeds];
  const extracted=finishExtraction(farm,nowTime());
  if(extracted)notice=farm.extraction.last;
  if(abilitiesChanged || ripened || mutated || weatherChanged || extracted || speed !== 1)saveFarm(farm);
  const selection=document.getSelection();
  if(selection&&!selection.isCollapsed&&selection.anchorNode?.parentElement?.closest('dialog[open]'))renderField(nowTime());
  else render();
  if(extracted&&!extractionDialog.open)farm.seeds.forEach((count,crop)=>{if(count>beforeSeeds[crop])animateExtractedSeeds(crop,count-beforeSeeds[crop]);});
};
tick();
setInterval(tick,1000);









































































// Capture on the document so wheel works without focusing a native select.
document.addEventListener('wheel',event=>{
  const select=event.target instanceof Element?event.target.closest('select'):null;
  if(!(select instanceof HTMLSelectElement)||select.disabled||!event.deltaY)return;
  event.preventDefault();
  const direction=event.deltaY>0?1:-1;
  let next=select.selectedIndex+direction;
  while(next>=0&&next<select.options.length&&select.options[next].disabled)next+=direction;
  if(next<0||next>=select.options.length)return;
  select.selectedIndex=next;
  select.dispatchEvent(new Event('input',{bubbles:true}));
  select.dispatchEvent(new Event('change',{bubbles:true}));
},{passive:false,capture:true});

button('seed-sort').onchange=renderSeeds;
function openQuickSeeds(index:number,tile:HTMLElement){
  const menu=get('quick-seeds');menu.replaceChildren();
  const available=crops.map((_,i)=>i).filter(i=>unlocked(farm,i)&&farm.seeds[i]>0);
  available.sort((a,b)=>get<HTMLSelectElement>('seed-sort').value==='rarity'?cropRarities[b]-cropRarities[a]:farm.seeds[b]-farm.seeds[a]);
  for(const i of available){
    const item=document.createElement('button');item.type='button';item.className='quiet';
    item.setAttribute('aria-label',crops[i].name+' · '+number(farm.seeds[i]));
    item.title=crops[i].name+' · '+number(farm.seeds[i]);
    const icon=document.createElement('span');icon.className='plant-glow';icon.textContent=crops[i].symbol;
    icon.style.setProperty('--icon-rarity',rarityColors[cropRarities[i]]);
    const count=document.createElement('small');count.textContent=number(farm.seeds[i]);item.append(icon,count);
    item.onclick=()=>{selectedLine=undefined;sow(index,i);};menu.append(item);
  }
  if(!available.length){menu.textContent='Нет семян на складе';}
  menu.hidden=false;menu.style.left='12px';menu.style.top='12px';
  const cell=tile.getBoundingClientRect(),size=menu.getBoundingClientRect();
  menu.style.left=Math.max(12,Math.min(innerWidth-size.width-12,cell.left+cell.width/2-size.width/2))+'px';
  menu.style.top=Math.max(12,Math.min(innerHeight-size.height-12,cell.top-size.height-10))+'px';
  get('field-tip').hidden=true;
}
document.addEventListener('click',event=>{
  if(!(event.target instanceof Element)||event.target.closest('#quick-seeds,#field .tile'))return;
  get('quick-seeds').hidden=true;
});
window.addEventListener('resize',()=>{get('quick-seeds').hidden=true;});
document.addEventListener('keydown',event=>{if(event.key==='Escape')get('quick-seeds').hidden=true;});

const deletePresses=new WeakMap<HTMLButtonElement,number>();
function resetDeletePress(control:HTMLButtonElement){deletePresses.delete(control);control.classList.remove('delete-armed');control.setAttribute('aria-pressed','false');control.title='Двойной клик — удалить';}
function confirmDeletePress(control:HTMLButtonElement){
 const now=performance.now(),previous=deletePresses.get(control);
 if(previous!==undefined&&now-previous<=500){resetDeletePress(control);return true;}
 deletePresses.set(control,now);control.classList.add('delete-armed');control.setAttribute('aria-pressed','true');
 setTimeout(()=>{if(deletePresses.get(control)===now)resetDeletePress(control);},550);return false;
}


