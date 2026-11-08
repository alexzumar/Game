type PlayTimeCounter='activePlayMs'|'backgroundPlayMs';
let playTimeCounter:PlayTimeCounter|null=null;
let playTimeStartedAt=0;
const playIdleLimitMs=60_000;
let playActiveUntil=0;
const totalPlayTime=()=>(farm.activePlayMs??0)+(farm.backgroundPlayMs??0);
let lastPlayTimeSave=totalPlayTime();
let reloadingFarm=false;

function updatePlayTime(nextCounter:PlayTimeCounter|null){
  const now=Math.floor(performance.now());
  if(playTimeCounter!==null){
    const activeMs=playTimeCounter==='activePlayMs'
      ?Math.max(0,Math.min(now,playActiveUntil)-playTimeStartedAt)
      :0;
    farm.activePlayMs=(farm.activePlayMs??0)+activeMs;
    farm.backgroundPlayMs=(farm.backgroundPlayMs??0)+now-playTimeStartedAt-activeMs;
  }
  playTimeStartedAt=now;
  playTimeCounter=nextCounter;
  if(nextCounter!=='activePlayMs')playActiveUntil=0;
}

function recordPlayInput(event:Event){
  if(!event.isTrusted||reloadingFarm||document.hidden||!document.hasFocus())return;
  updatePlayTime('activePlayMs');
  playActiveUntil=playTimeStartedAt+playIdleLimitMs;
}

function savePlayTime(){
  const elapsed=totalPlayTime();
  if(elapsed!==lastPlayTimeSave&&saveFarm(farm))lastPlayTimeSave=elapsed;
}

function syncPlayTime(){
  if(reloadingFarm)return;
  const active=!document.hidden&&document.hasFocus();
  updatePlayTime(active?'activePlayMs':'backgroundPlayMs');
  savePlayTime();
}

function reloadFarm(){
  reloadingFarm=true;
  location.reload();
}

document.addEventListener('visibilitychange',syncPlayTime);
for(const type of ['pointerdown','keydown','wheel']){
  document.addEventListener(type,recordPlayInput,{capture:true,passive:true});
}
window.addEventListener('focus',syncPlayTime);
window.addEventListener('blur',()=>{
  if(reloadingFarm)return;
  updatePlayTime('backgroundPlayMs');
  savePlayTime();
});
window.addEventListener('pagehide',()=>{
  if(reloadingFarm)return;
  updatePlayTime(null);
  savePlayTime();
});
window.addEventListener('pageshow',syncPlayTime);
syncPlayTime();

const tick = () => {
  if(reloadingFarm)return;
  updatePlayTime(playTimeCounter);
  advanceDebug();
  const weatherChanged=applyRain(farm,nowTime());
  const greenhouseChanged=tickGreenhouse(nowTime());
  const abilitiesChanged=updatePlantAbilities(farm,nowTime());
  const ripened=updateRipening(farm,nowTime());
  const mutated=checkMutations(farm,nowTime());
  const beforeSeeds=[...farm.seeds];
  const extracted=finishExtraction(farm,nowTime());
  if(extracted)notice=farm.extraction.last;
  if(greenhouseChanged || abilitiesChanged || ripened || mutated || weatherChanged || extracted || speed !== 1 ||
    totalPlayTime()-lastPlayTimeSave>=15_000){
    if(saveFarm(farm))lastPlayTimeSave=totalPlayTime();
  }
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
const quickSeedsMenu=get('quick-seeds');
let quickSeedsAnchor:HTMLElement|null=null;
let quickSeedsCloseTimer:ReturnType<typeof setTimeout>|undefined;
function insideQuickSeeds(target:EventTarget|null){
  return target instanceof Node&&(quickSeedsMenu.contains(target)||!!quickSeedsAnchor?.contains(target));
}
function openQuickSeeds(index:number,tile:HTMLElement,plantSeed:(index:number,crop:number)=>void=sow){
  clearTimeout(quickSeedsCloseTimer);
  quickSeedsAnchor=tile;
  const menu=quickSeedsMenu;menu.replaceChildren();
  const available=crops.map((_,i)=>i).filter(i=>unlocked(farm,i)&&farm.seeds[i]>0);
  available.sort((a,b)=>get<HTMLSelectElement>('seed-sort').value==='rarity'?seedRarityOrder.indexOf(a)-seedRarityOrder.indexOf(b):farm.seeds[b]-farm.seeds[a]);
  for(const i of available){
    const item=document.createElement('button');item.type='button';item.className='quiet';
    item.setAttribute('aria-label',crops[i].name+' · '+number(farm.seeds[i]));
    item.title=crops[i].name+' · '+number(farm.seeds[i]);
    const icon=document.createElement('span');icon.className='plant-glow';icon.textContent=crops[i].symbol;
    icon.style.setProperty('--icon-rarity',rarityColors[cropRarities[i]]);
    const count=document.createElement('small');count.textContent=number(farm.seeds[i]);item.append(icon,count);
    item.onclick=()=>{selectedLine=undefined;plantSeed(index,i);};menu.append(item);
  }
  if(!available.length){menu.textContent='Нет семян на складе';}
  menu.hidden=false;menu.style.left='12px';menu.style.top='12px';
  const cell=tile.getBoundingClientRect(),size=menu.getBoundingClientRect();
  menu.style.left=Math.max(12,Math.min(innerWidth-size.width-12,cell.left+cell.width/2-size.width/2))+'px';
  menu.style.top=Math.max(12,Math.min(innerHeight-size.height-12,cell.top-size.height-10))+'px';
  get('field-tip').hidden=true;
}
document.addEventListener('pointerout',event=>{
  if(event.pointerType!=='mouse'||quickSeedsMenu.hidden||!insideQuickSeeds(event.target)||insideQuickSeeds(event.relatedTarget))return;
  clearTimeout(quickSeedsCloseTimer);
  quickSeedsCloseTimer=setTimeout(()=>{quickSeedsMenu.hidden=true;},200);
});
document.addEventListener('pointerover',event=>{
  if(event.pointerType==='mouse'&&insideQuickSeeds(event.target))clearTimeout(quickSeedsCloseTimer);
});
document.addEventListener('click',event=>{
  if(!(event.target instanceof Element)||event.target.closest('#quick-seeds,#field .tile,#greenhouse-grid button'))return;
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
