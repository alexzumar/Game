const greenhouseGrid=get('greenhouse-grid');
type GreenhouseTool='trellis'|'move'|'buy';
let greenhouseTool:GreenhouseTool|null=null;
let movingBed=-1;

function greenhouseVisible(){return location.hash==='#greenhouse';}
function syncGreenhouseScreen(){
  const visible=greenhouseVisible();
  document.body.classList.toggle('in-greenhouse',visible);
  document.title=visible?'Теплица — Всходы':'Всходы — семенная ферма';
  get('quick-seeds').hidden=true;
  greenhouseTool=null;
  movingBed=-1;
  if(visible){
    farm.greenhouse??=newGreenhouse(nowTime());
    setDockState('open');
  }else if(hybridCount(farm)===0)setDockState('hidden');
}
syncGreenhouseScreen();
window.addEventListener('hashchange',()=>{syncGreenhouseScreen();render();});

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
for(const tool of ['trellis','move','buy'] as const){
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
function useGreenhouseCell(index:number,tile:HTMLButtonElement){
  const area=farm.greenhouse!;
  const now=nowTime();
  const changed=tickGreenhouse(now);
  if(changed)saveFarm(farm);
  const plot=area.plots[index];
  if(greenhouseTool==='buy'){
    const price=greenhouseBedPrice(area);
    const points=farm.mutationPoints??0;
    if(!area.beds[index]&&points>=price){
      farm.mutationPoints=points-price;
      area.beds[index]=true;
      commit('Добавлена грядка в теплице.');
    }
    return;
  }
  if(greenhouseTool==='move'){
    if(plot||area.rot[index])return;
    if(area.beds[index])movingBed=movingBed===index?-1:index;
    else if(movingBed>=0&&!area.plots[movingBed]&&!area.rot[movingBed]){
      area.beds[index]=true;
      area.trellises[index]=area.trellises[movingBed];
      area.beds[movingBed]=false;
      area.trellises[movingBed]=false;
      movingBed=-1;
      commit('Грядка перенесена.');
      return;
    }
    renderGreenhouse(now);
    return;
  }
  if(!area.beds[index])return;
  if(greenhouseTool==='trellis'){
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
  tile.append(document.createElement('strong'),document.createElement('small'));
  tile.onclick=()=>useGreenhouseCell(index,tile);
  tile.ondragover=event=>{
    const area=farm.greenhouse;
    if(area?.beds[index]&&!area.trellises[index]&&!area.plots[index]&&!area.rot[index]&&
      event.dataTransfer?.types.includes('application/x-farm-hybrid'))event.preventDefault();
  };
  tile.ondrop=event=>{
    event.preventDefault();
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
  get('greenhouse-no-trellis').hidden=area.trellises.some(Boolean);
  get('greenhouse-dry').hidden=!area.plots.some(plot=>plot&&!plot.mystery&&plot.ready===null);
  for(const tool of ['trellis','move','buy'] as const)button('greenhouse-'+tool).setAttribute('aria-pressed',String(greenhouseTool===tool));
  const buy=button('greenhouse-buy');
  buy.textContent='Новая грядка · 🧬 '+number(greenhouseBedPrice(area));
  buy.disabled=area.beds.every(Boolean)||(farm.mutationPoints??0)<greenhouseBedPrice(area);
  area.beds.forEach((bed,index)=>{
    const tile=greenhouseGrid.children[index] as HTMLButtonElement;
    const plot=area.plots[index],trellis=area.trellises[index],rot=area.rot[index];
    const ready=!!plot&&plot.ready!==null&&plot.ready<=now;
    tile.dataset.bed=String(bed);
    tile.dataset.trellis=String(trellis);
    tile.dataset.mystery=String(!!plot?.mystery);
    tile.setAttribute('aria-pressed',String(movingBed===index));
    tile.disabled=!bed&&greenhouseTool!=='buy'&&(greenhouseTool!=='move'||movingBed<0);
    const icon=plot?.mystery?'?':plot?(ready?crops[plot.crop].symbol:plot.ready===null?'🟤':'🌱'):rot?'🍂':'';
    if(tile.children[0].textContent!==icon)tile.children[0].textContent=icon;
    const status=plot?(ready?'Готово':plot.ready===null?'Сухо':clock(plot.ready-now)):'';
    if(tile.children[1].textContent!==status)tile.children[1].textContent=status;
    const name=plot?.mystery?'Неизвестное растение':plot?crops[plot.crop].name:rot?'Сгнило':trellis?'Шпалера':bed?'Пустая грядка':'Свободное место';
    const label=name+(status?' · '+status:'');
    tile.title=label;
    tile.setAttribute('aria-label',label);
  });
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
