type PlayTimeCounter='activePlayMs'|'backgroundPlayMs';
let playTimeCounter:PlayTimeCounter|null=null;
let playTimeStartedAt=0;
const playIdleLimitMs=60_000;
let playActiveUntil=0;
const totalPlayTime=()=>(farm.activePlayMs??0)+(farm.backgroundPlayMs??0);
let lastPlayTimeSave=totalPlayTime();
let reloadingFarm=false;
let helperChanged=false;

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
  if((helperChanged||elapsed!==lastPlayTimeSave)&&saveFarm(farm)){
    lastPlayTimeSave=elapsed;
    helperChanged=false;
  }
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

const currentFarmBuild=document.querySelector<HTMLMetaElement>('meta[name="farm-build"]')?.content;
async function checkFarmBuild(){
  if(!currentFarmBuild||!/^https?:$/.test(location.protocol)||reloadingFarm)return;
  try{
    const response=await fetch(new URL('version.json',location.href),{cache:'no-store'});
    if(!response.ok)return;
    const {version}=await response.json();
    if(typeof version!=='string'||!(/^[a-f0-9]{16}$/).test(version))return;
    const available=version!==currentFarmBuild;
    get('build-update').hidden=!available;
    button('settings-open').classList.toggle('build-available',available);
    get('build-update-status').textContent=available?'Доступна новая версия игры.':'';
    button('build-update-apply').onclick=()=>{
      updatePlayTime(playTimeCounter);
      if(!saveFarm(farm)){
        get('build-update-status').textContent='Сначала нужно сохранить игру. Повтори попытку.';
        return;
      }
      reloadingFarm=true;
      const destination=new URL(location.href);
      destination.searchParams.set('build',version+'-'+Date.now());
      location.replace(destination);
    };
  }catch{
    // The game can continue when the version file is unreachable.
  }
}
if(currentFarmBuild&&/^https?:$/.test(location.protocol)){
  void checkFarmBuild();
  window.addEventListener('focus',checkFarmBuild);
  setInterval(checkFarmBuild,60_000);
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
  recordIslandSpending();
  const weatherChanged=applyRain(farm,nowTime());
  const greenhouseChanged=tickGreenhouse(nowTime());
  const potsChanged=tickGreenhousePots(farm,nowTime());
  const sunHarvest=new Map<number,number>();
  const abilitiesChanged=updatePlantAbilities(farm,nowTime(),Math.random,farm,(crop,amount)=>{
    sunHarvest.set(crop,(sunHarvest.get(crop)??0)+amount);
  });
  if(sunHarvest.size)showIslandEvent(...[...sunHarvest].map(([crop,amount])=>'☀️ '+crops[crop].name+' · урожай +'+number(amount)));
  const ripened=updateRipening(farm,nowTime());
  const beforeSeeds=[...farm.seeds];
  const extracted=finishExtraction(farm,nowTime());
  if(extracted)notice=farm.extraction.last;
  if(greenhouseChanged || potsChanged || abilitiesChanged || ripened || weatherChanged || extracted || helperChanged || speed !== 1 ||
    totalPlayTime()-lastPlayTimeSave>=15_000){
    if(saveFarm(farm)){
      lastPlayTimeSave=totalPlayTime();
      helperChanged=false;
    }
  }
  const selection=document.getSelection();
  if(selection&&!selection.isCollapsed&&selection.anchorNode?.parentElement?.closest('dialog[open]'))renderField(nowTime());
  else render();
  if(extracted&&!extractionDialog.open)farm.seeds.forEach((count,crop)=>{if(count>beforeSeeds[crop])animateExtractedSeeds(crop,count-beforeSeeds[crop]);});
};
const extractionIslandBatch=new Map<number,{processed:number;seeds:number;concentrate:number}>();
const extractionIslandHybrids:string[]=[];
let extractionIslandTimer:ReturnType<typeof setTimeout>;
extractionResultListeners.set(farm,result=>{
  if('hybrid' in result)extractionIslandHybrids.push('⚙️ '+result.hybrid+' → 🧬 +'+number(result.points));
  else{
    const entry=extractionIslandBatch.get(result.crop)??{processed:0,seeds:0,concentrate:0};
    entry.processed+=result.processed;
    entry.seeds+=result.seeds;
    entry.concentrate+=result.concentrate;
    extractionIslandBatch.set(result.crop,entry);
  }
  clearTimeout(extractionIslandTimer);
  extractionIslandTimer=setTimeout(()=>{
    for(const [crop,{processed,seeds,concentrate}] of extractionIslandBatch){
      islandReadyPages.push('⚙️ '+crops[crop].name+' ×'+number(processed)+' → 🌱 +'+number(seeds)+
        (concentrate?' · Концентрат +'+number(concentrate):''));
    }
    islandReadyPages.push(...extractionIslandHybrids.splice(0));
    extractionIslandBatch.clear();
    playIslandEvents();
  },2000);
});
tick();
setInterval(tick,1000);
const gardenHelperHistory:string[]=[];
function logHelperAction(index:number,message:string){
  gardenHelperHistory.push((Math.floor(index/farm.size)+1)+':'+(index%farm.size+1)+' · '+message);
  if(gardenHelperHistory.length>80)gardenHelperHistory.shift();
}
setInterval(()=>{
  if(!reloadingFarm&&runGardenHelper(farm,nowTime(),(state,index,now)=>{
    const before={diamonds:state.diamonds?.balance??0,orbs:state.resources.orbs,items:{...state.resources.items}};
    const crop=crops[state.plots[index]!.crop].name;
    const amount=collect(state,index,now);
    if(amount){
      const loot=[[ '🔮',state.resources.orbs-before.orbs],['💎',(state.diamonds?.balance??0)-before.diamonds],
        ...materials.map(item=>[item.icon+' '+item.name,(state.resources.items[item.id]??0)-(before.items[item.id]??0)] as const)] as const;
      logHelperAction(index,'Сбор · '+crop+' ×'+number(amount)+loot.filter(([,count])=>count>0).map(([label,count])=>' · '+label+' +'+number(count)).join(''));
    }
    return amount;
  },(action,index,crop)=>logHelperAction(index,(action==='sow'?'Посадка':'Полив')+' · '+crops[crop].name))){
    helperChanged=true;
    if(document.querySelector('#garden-helper-dialog[open]'))renderHelperHistory();
  }
},50);









































































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
