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
  const rainLabel=document.body.classList.contains('in-greenhouse')?'🌧️ Дождь снаружи':
    '🌧️ Дождь · расход влаги ×0,5 · рост +5%'+(farm.weather.surged?' · Рывок роста':'');
  get('weather').textContent=rain?rainLabel+' · ещё '+clock((farm.weather.end??now)-now):'☀️ Ясно';
  get('theme').textContent = farm.theme === 'light' ? '☾ Тёмная' : '☀ Светлая';
  get('diamond-balance').textContent=number(farm.diamonds?.balance??0);
  get('dimensions').textContent = farm.size + ' × ' + farm.size;
  get('counter').textContent = number(total(farm.harvest));
  get('save-state').textContent = storageError ? 'Ошибка сохранения' : '';
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
  get('upgrade-field').classList.toggle('field-expansion-complete',farm.size===maxSize);
  get('expand-note').textContent = farm.size === maxSize ? '8×8 · Максимум' :
    'Поле ' + (farm.size+1) + ' × ' + (farm.size+1);
  document.querySelectorAll<HTMLButtonElement>('.swatch').forEach((item,i) =>
    item.setAttribute('aria-pressed',String(i === farm.accent)));
  const odds = packOdds(farm,Math.max(0,selectedPack));
  renderSeeds();
  renderTraits();
  if(typeof upgradeMaterialsReady!=='undefined'&&upgradeMaterialsReady)renderUpgradeMaterials();
  renderConveniences();
  renderCollection();
  renderDiscoveryUpgrades();
  renderExtraction();
  renderLines();
  renderDock();
  if(typeof mutationDialog!=="undefined" && mutationDialog.open && mutationArea.plots[mutationIndex]?.mystery)button("mutation-accept").disabled=(mutationArea.plots[mutationIndex]!.ready??Infinity)>nowTime()||hybridCount(farm)>=farm.hybridSlots;
  renderShop(odds);
  if(document.body.classList.contains('in-greenhouse'))renderGreenhouse(now);
  else renderField(now);
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
    row.style.order=String(get<HTMLSelectElement>('seed-sort').value==='rarity'?seedRarityOrder.indexOf(i):-farm.seeds[i]);
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
