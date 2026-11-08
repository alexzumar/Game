const greenhouseGrid=get('greenhouse-grid');
type GreenhouseTool='trellis'|'buy'|'move';
let greenhouseTool:GreenhouseTool|null=null;
let movingBed=-1;
let greenhouseMoveHeld=false;
let greenhouseAltHeld=false;
let hoveredGreenhousePlot=-1;

function greenhouseVisible(){return location.hash==='#greenhouse';}
function syncGreenhouseScreen(){
  const visible=greenhouseVisible();
  document.body.classList.toggle('in-greenhouse',visible);
  document.title=visible?'Теплица — Всходы':'Всходы — семенная ферма';
  get('quick-seeds').hidden=true;
  const hint=get('field-tip');
  hint.hidden=true;
  hint.style.removeProperty('top');
  hint.style.removeProperty('left');
  get(visible?'greenhouse-board':'garden-field-head').append(hint);
  hoveredGreenhousePlot=-1;
  hoveredPlot=-1;
  greenhouseTool=null;
  movingBed=-1;
  greenhouseMoveHeld=false;
  greenhouseAltHeld=false;
  dockWrap.classList.remove('greenhouse-dock-expanded');
  if(visible){
    farm.greenhouse??=newGreenhouse(nowTime());
    setDockState('open');
  }else if(hybridCount(farm)===0)setDockState('hidden');
}
syncGreenhouseScreen();
window.addEventListener('hashchange',()=>{
  syncGreenhouseScreen();render();
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
    get(greenhouseVisible()?'greenhouse-board':'field').animate(
      [{opacity:.45,scale:'.985'},{opacity:1,scale:'1'}],{duration:240,easing:'ease-out'});
  }
});
const syncFarmContrast=()=>document.documentElement.classList.toggle('farm-background',document.hidden||!document.hasFocus());
window.addEventListener('focus',syncFarmContrast);
window.addEventListener('blur',syncFarmContrast);
document.addEventListener('visibilitychange',syncFarmContrast);
syncFarmContrast();
dockWrap.addEventListener('pointerenter',event=>{
  if(greenhouseVisible()&&event.pointerType==='mouse'&&dock.scrollWidth>dock.clientWidth+1)dockWrap.classList.add('greenhouse-dock-expanded');
});
dockWrap.addEventListener('pointerleave',()=>dockWrap.classList.remove('greenhouse-dock-expanded'));
const greenhouseRight=get('greenhouse-expansion').parentElement!;
new ResizeObserver(()=>{
  if(greenhouseVisible())get('greenhouse-pots').style.setProperty('--greenhouse-pots-height',greenhouseRight.offsetHeight+'px');
}).observe(greenhouseRight);

window.addEventListener('keydown',event=>{
  if(!greenhouseVisible()||document.querySelector('dialog[open]')||
    (event.target instanceof Element&&event.target.closest('input,textarea,select,[contenteditable]')))return;
  if(event.key==='Alt'){
    event.preventDefault();
    greenhouseAltHeld=true;
  }else if(event.code==='KeyM'&&!event.altKey&&!event.ctrlKey&&!event.metaKey){
    event.preventDefault();
    if(event.repeat)return;
    if(greenhouseTool==='move'){greenhouseTool=null;movingBed=-1;}
    else greenhouseMoveHeld=true;
  }else return;
  if(!event.repeat){
    get('quick-seeds').hidden=true;
    renderGreenhouse(nowTime());
  }
});
window.addEventListener('keyup',event=>{
  if(event.key==='Alt')greenhouseAltHeld=false;
  else if(event.code==='KeyM'){
    greenhouseMoveHeld=false;
    movingBed=-1;
  }else return;
  if(greenhouseVisible())renderGreenhouse(nowTime());
});
window.addEventListener('blur',()=>{
  greenhouseAltHeld=greenhouseMoveHeld=false;
  movingBed=-1;
  dockWrap.classList.remove('greenhouse-dock-expanded');
  if(greenhouseVisible())renderGreenhouse(nowTime());
});

function tickGreenhouse(now:number){
  const area=farm.greenhouse;
  if(!area)return false;
  const abilities=updatePlantAbilities(farm,now,Math.random,area);
  const ripening=updateRipening(farm,now,Math.random,area);
  const mutations=checkMutations(farm,now,Math.random,area);
  return abilities||ripening||mutations;
}

function greenhouseBedPrice(area:Greenhouse){
  return Math.ceil(3*(area.beds.filter(Boolean).length-2)**1.4);
}
button('greenhouse-research').onclick=()=>{button('upgrades-open').click();button('upgrade-tab-hybrids').click();};
for(const tool of ['trellis','buy','move'] as const){
  button('greenhouse-'+tool).onclick=()=>{
    greenhouseTool=greenhouseTool===tool?null:tool;
    movingBed=-1;
    watering=false;
    gathering=false;
    get('quick-seeds').hidden=true;
    render();
  };
}
for(const id of ['water','gather','hybrid-plant']){
  button(id).addEventListener('click',()=>{
    if(!greenhouseVisible())return;
    greenhouseTool=null;
    movingBed=-1;
    renderGreenhouse(nowTime());
  });
}
function sowGreenhouse(index:number,crop:number,line?:number){
  const area=farm.greenhouse;
  if(!area?.beds[index]||area.trellises[index]||area.rot[index])return;
  if(plant(farm,index,crop,nowTime(),line,area)){
    get('quick-seeds').hidden=true;
    commit('Семя посажено в теплице.');
  }
}
function canMoveGreenhouseBed(area:Greenhouse,index:number){
  return area.beds[index]&&!area.plots[index]&&!area.rot[index];
}
function moveGreenhouseBed(area:Greenhouse,from:number,to:number){
  if(!canMoveGreenhouseBed(area,from)||area.beds[to]||area.plots[to]||area.rot[to])return;
  area.beds[to]=true;
  area.trellises[to]=area.trellises[from];
  area.beds[from]=false;
  area.trellises[from]=false;
  movingBed=-1;
  commit('Грядка перенесена.');
}
function useGreenhouseCell(index:number,tile:HTMLButtonElement,event:MouseEvent){
  const area=farm.greenhouse!;
  const now=nowTime();
  const changed=tickGreenhouse(now);
  if(changed)saveFarm(farm);
  const plot=area.plots[index];
  const tool=greenhouseMoveHeld?'move':event.altKey||greenhouseAltHeld?'trellis':greenhouseTool;
  if(tool==='buy'){
    const price=greenhouseBedPrice(area);
    const points=farm.mutationPoints??0;
    if(!area.beds[index]&&points>=price){
      farm.mutationPoints=points-price;
      area.beds[index]=true;
      commit('Добавлена грядка в теплице.');
    }
    return;
  }
  if(tool==='move'){
    if(plot||area.rot[index])return;
    if(area.beds[index])movingBed=movingBed===index?-1:index;
    else if(movingBed>=0)return moveGreenhouseBed(area,movingBed,index);
    renderGreenhouse(now);
    return;
  }
  if(!area.beds[index])return;
  if(tool==='trellis'){
    if(plot||area.rot[index])return;
    area.trellises[index]=!area.trellises[index];
    commit(area.trellises[index]?'Шпалера установлена.':'Шпалера убрана.');
    return;
  }
  if(plot?.mystery){openMutation(index,area);return;}
  if(area.rot[index]){openRot(index,area);return;}
  if(plot&&isWatering()){
    if(water(farm,plot,now,Number.MAX_SAFE_INTEGER))commit('Грядка полита до сбора.');
    return;
  }
  if(plot&&isGathering()){
    if(collectAnimated(index,now,tile,area))commit('Урожай на складе.');
    else render();
    return;
  }
  if(!plot&&!area.trellises[index]&&!isWatering()&&!isGathering()){
    const line=selectedLine===undefined?undefined:farm.lines[selectedLine];
    if(line&&!line.archived&&line.seeds>0)sowGreenhouse(index,line.crop,selectedLine);
    else openQuickSeeds(index,tile,sowGreenhouse);
  }
}

for(let index=0;index<greenhouseCells;index++){
  const tile=document.createElement('button');
  tile.type='button';
  tile.className='greenhouse-cell';
  const icon=document.createElement('strong');
  icon.className='greenhouse-plant';
  icon.setAttribute('aria-hidden','true');
  tile.append(icon);
  tile.onpointerenter=()=>{hoveredGreenhousePlot=index;renderGreenhouseTooltip(nowTime());};
  tile.onpointerleave=()=>{
    if(hoveredGreenhousePlot===index){hoveredGreenhousePlot=-1;renderGreenhouseTooltip(nowTime());}
  };
  tile.onclick=event=>useGreenhouseCell(index,tile,event);
  tile.ondragstart=event=>{
    const area=farm.greenhouse;
    if(!area||!(greenhouseMoveHeld||greenhouseTool==='move')||!canMoveGreenhouseBed(area,index)||!event.dataTransfer){
      event.preventDefault();
      return;
    }
    event.dataTransfer.setData('application/x-farm-bed',String(index));
    event.dataTransfer.effectAllowed='move';
  };
  tile.ondragover=event=>{
    const area=farm.greenhouse;
    if(area&&!area.beds[index]&&(greenhouseMoveHeld||greenhouseTool==='move')&&
      event.dataTransfer?.types.includes('application/x-farm-bed')){
      event.preventDefault();
      event.dataTransfer.dropEffect='move';
      return;
    }
    if(area?.beds[index]&&!area.trellises[index]&&!area.plots[index]&&!area.rot[index]&&
      event.dataTransfer?.types.includes('application/x-farm-hybrid'))event.preventDefault();
  };
  tile.ondrop=event=>{
    event.preventDefault();
    const bed=event.dataTransfer?.getData('application/x-farm-bed');
    if(bed&&/^\d+$/.test(bed)){
      const area=farm.greenhouse;
      if(area&&(greenhouseMoveHeld||greenhouseTool==='move')){
        if(tickGreenhouse(nowTime()))saveFarm(farm);
        moveGreenhouseBed(area,Number(bed),index);
      }
      return;
    }
    const value=event.dataTransfer?.getData('application/x-farm-hybrid');
    if(!value||!/^\d+$/.test(value))return;
    const line=farm.lines[Number(value)];
    if(line)sowGreenhouse(index,line.crop,Number(value));
  };
  greenhouseGrid.append(tile);
}

function renderGreenhouse(now:number){
  const area=farm.greenhouse;
  if(!area)return;
  const candidates=mutationCandidates(farm,area,false)
    .filter(({neighbors})=>neighbors.filter(plot=>plot.planted<=now).length>=2);
  get('greenhouse-no-trellis').hidden=!candidates.length||candidates.some(({index})=>area.trellises[index])||
    area.plots.some((plot,index)=>plot?.mystery&&area.trellises[index]);
  get('greenhouse-dry').hidden=!area.plots.some(plot=>plot&&!plot.mystery&&plot.ready===null);
  button('greenhouse-trellis').setAttribute('aria-pressed',String(greenhouseAltHeld||greenhouseTool==='trellis'));
  button('greenhouse-buy').setAttribute('aria-pressed',String(greenhouseTool==='buy'));
  const moving=greenhouseMoveHeld||greenhouseTool==='move';
  button('greenhouse-move').setAttribute('aria-pressed',String(moving));
  const buy=button('greenhouse-buy');
  buy.textContent='Новая грядка · 🧬 '+number(greenhouseBedPrice(area));
  buy.disabled=area.beds.every(Boolean)||(farm.mutationPoints??0)<greenhouseBedPrice(area);
  area.beds.forEach((bed,index)=>{
    const tile=greenhouseGrid.children[index] as HTMLButtonElement;
    const plot=area.plots[index],trellis=area.trellises[index],rot=area.rot[index];
    tile.dataset.bed=String(bed);
    tile.dataset.wet=String(!plot?.mystery&&(plot?.wetUntil??0)>now);
    tile.dataset.trellis=String(trellis&&!plot?.mystery);
    tile.dataset.mystery=String(!!plot?.mystery);
    tile.setAttribute('aria-pressed',String(movingBed===index));
    tile.disabled=!bed&&!moving&&(greenhouseTool!=='buy'||greenhouseAltHeld);
    tile.draggable=moving&&canMoveGreenhouseBed(area,index);
    tile.classList.toggle('greenhouse-movable',tile.draggable);
    tile.classList.toggle('greenhouse-move-target',moving&&!bed);
    renderPlotArt(tile,tile.children[0] as HTMLElement,plot,rot,now);
    const name=plot||rot?plotTitle(plot,rot):trellis?'Шпалера':bed?'Пустая грядка':'Свободное место';
    tile.setAttribute('aria-label',plot?name+' · '+plotStatus(plot,rot,now):name);
  });
  renderGreenhouseTooltip(now);
}

function renderGreenhouseTooltip(now:number){
  const area=farm.greenhouse;
  renderPlotTooltip(area?.plots[hoveredGreenhousePlot],area?.rot[hoveredGreenhousePlot],now);
}

const mutationDebug=document.createElement('label');
mutationDebug.textContent='Очки мутации ';
const mutationDebugAmount=document.createElement('input');
mutationDebugAmount.type='number';
mutationDebugAmount.min='1';
mutationDebugAmount.value='10';
mutationDebugAmount.title='Enter — выдать очки мутации';
mutationDebug.append(mutationDebugAmount);
get('debug-unlock-crops').after(mutationDebug);
mutationDebugAmount.addEventListener('keydown',event=>{
  if(event.key!=='Enter'||!farm.saveCheats)return;
  event.preventDefault();
  const amount=mutationDebugAmount.valueAsNumber;
  const next=(farm.mutationPoints??0)+amount;
  if(!Number.isSafeInteger(amount)||amount<1||!Number.isSafeInteger(next))return;
  farm.mutationPoints=next;
  commit('Отладка: 🧬 +'+number(amount));
});
