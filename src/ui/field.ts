function renderField(now:number) {
  const field = get('field');
  const dryCount=farm.plots.filter(plot=>
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
        if(shoveling){if(clearGardenPlot(index))commit();return;}
        if(!plot && farm.rot[index] && seed<0 && !isWatering()){openRot(index);return;}
        if(plot?.mystery){
          if(isGathering()||(!isWatering()&&(plot.ready??Infinity)>now))openMutation(index);
          return;
        }
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
    tile.dataset.wet=String((plot?.wetUntil??0)>now);
    tile.dataset.state = !plot ? rot?'rotten':'empty' : ready ? 'ready' : plot.ready === null ? 'dry' : 'growing';
    tile.style.setProperty('--crop',crop?.color ?? 'var(--accent)');
    tile.children[0].textContent = String(index+1);
    renderPlotArt(tile,tile.children[1] as HTMLElement,plot,rot,now);
    tile.children[2].textContent=plotTitle(plot,rot);
    tile.children[3].textContent=plotStatus(plot,rot,now);
  });
  const hovered=field.children[hoveredPlot] as HTMLElement|undefined;
  if(renderPlotTooltip(farm.plots[hoveredPlot],farm.rot[hoveredPlot],now)&&hovered)positionFieldTooltip(get('field-tip'),hovered);
}
function renderPlotArt(tile:HTMLElement,visual:HTMLElement,plot:Plant|null,rot:RotRecord|null,now:number){
  const crop=plot?crops[plot.crop]:null;
  const ready=!!plot&&plot.ready!==null&&plot.ready<=now;
  const remaining = plot ? remainingGrowth(plot,now) : undefined;
  const duration = plot ? (plot.duration ?? crops[plot.crop].seconds*1000) : 0;
  const halfway = remaining !== undefined && remaining <= duration/2;
  tile.dataset.stage = !plot ? 'empty' : ready ? 'ripe' : halfway ? 'sprout' : 'seed';
  const icon = !plot ? '' : ready ? crop!.symbol : halfway ? '🌱' : '🟤';
  if(plot?.mystery){
    delete visual.dataset.art;visual.classList.remove("has-crop-art");visual.textContent="?";
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
}
function plotTitle(plot:Plant|null|undefined,rot:RotRecord|null|undefined){
  return plot?.mystery?'Неизвестное растение':plot?crops[plot.crop].name:rot?'Сгнило':'Пустая грядка';
}
function plotStatus(plot:Plant|null|undefined,rot:RotRecord|null|undefined,now:number){
  if(!plot)return rot?'Нажми для отчёта':'Выбери семена';
  if(plot.ready===null)return plot.remaining===undefined?'Нужен полив':'Сухо · '+clock(plot.remaining);
  return plot.ready<=now?'Готово к сбору':clock(plot.ready-now);
}
function renderPlotTooltip(plot:Plant|null|undefined,rot:RotRecord|null|undefined,now:number){
  const hint=get('field-tip');
  hint.hidden=!get('quick-seeds').hidden||(!plot&&!rot);
  if(hint.hidden)return false;
  let title=plotTitle(plot,rot);
  const lines:string[]=[];
  if(plot){
    const ripe=plot.ready!==null&&plot.ready<=now;
    if(plot.line!==undefined){
      const line=farm.lines[plot.line],genes=genome(farm,plot).genes;
      title=line.name+' · '+crops[line.crop].name;
      lines.push('⚡ Gr '+genes.gr+' / 💰 Ga '+genes.ga+' / 🛡️ Re '+genes.re);
      if(line.traits.length)lines.push(line.traits.map(id=>powerLabel(line,id)).join(' · '));
    }
    lines.push(plotStatus(plot,rot,now));
    if(!ripe&&plot.ready!==null&&(plot.wetUntil??0)>now){
      lines.push(plot.wetUntil!>=plot.ready?'💧 Полито до созревания':'💧 Влаги ещё '+clock(plot.wetUntil!-now));
    }
    if(!plot.mystery)lines.push("💧 Поливов: "+(plot.wateringCount??0));
    const forecast=!plot.mystery?ripeningInfo(farm,plot):null;
    if(forecast)lines.push('Цена сейчас ×'+forecast.value.toFixed(2)+' → ×'+forecast.nextValue.toFixed(2),
      'Через '+clock(forecast.next-now)+' · риск гнили '+formatChance(forecast.risk*100)+'%');
  }else if(rot){
    title=rot.name;
    lines.push('Сгнило на проверке '+rot.checks+' · риск '+formatChance(rot.risk*100)+'% · цена ×'+rot.value.toFixed(2));
  }
  const text=[title,...lines].join('\n');
  if(hint.textContent!==text)hint.textContent=text;
  return true;
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
  if(!document.body.classList.contains('in-greenhouse')&&!hint.hidden&&tile)positionFieldTooltip(hint,tile as HTMLElement);
});
let basketPulse:Animation|undefined;
function collectAnimated(index:number,now:number,tile:Element,area:PlotArea=farm) {
  const plot = area.plots[index];
  const beforeLoot={diamonds:farm.diamonds?.balance??0,orbs:farm.resources.orbs,items:{...farm.resources.items}};
  const beforeCoins=farm.coins;
  const beforeSeeds=plot?farm.seeds[plot.crop]:0;
  const amount = collect(farm,index,now,Math.random,area);
  if(amount&&plot)recordIslandHarvest(amount,beforeLoot,{
    coins:farm.coins-beforeCoins,
    seeds:plot.line===undefined?farm.seeds[plot.crop]-beforeSeeds:0,
    crop:plot.crop,
    restarted:area.plots[index]?.crop===plot.crop&&area.plots[index]?.remaining!==undefined
  });
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
let islandHarvest:{start:number;last:number;plants:number;fruit:number;loot:Record<string,number>}|null=null;
let islandHarvestTimer:ReturnType<typeof setTimeout>;
let islandDisplayTimer:ReturnType<typeof setTimeout>;
let islandQueueTimer:ReturnType<typeof setTimeout>|undefined;
const islandPendingPages:string[]=[];
const islandReadyPages:string[]=[];
let islandCurrentPages:string[]=[];
let islandPendingSpend=0;
let islandCoinsSpent=farm.statistics?.coinsSpent??0;
function recordIslandSpending(){
  const spent=farm.statistics?.coinsSpent??0;
  if(spent>islandCoinsSpent){
    islandPendingSpend+=spent-islandCoinsSpent;
    scheduleIslandEvents();
  }
  islandCoinsSpent=spent;
}
function scheduleIslandEvents(){
  refreshIslandList();
  clearTimeout(islandQueueTimer);
  islandQueueTimer=setTimeout(()=>{
    islandQueueTimer=undefined;
    islandReadyPages.push(...islandPendingPages.splice(0));
    if(islandPendingSpend){
      islandReadyPages.push('🪙 Потрачено −'+number(islandPendingSpend));
      islandPendingSpend=0;
    }
    playIslandEvents();
  },2000);
}
function resizeIsland(change:()=>void){
  const island=get('activity-island');
  const before=island.getBoundingClientRect().width;
  island.getAnimations().forEach(animation=>animation.cancel());
  change();
  const after=island.getBoundingClientRect().width;
  if(before&&before!==after&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
    island.animate([{width:before+'px'},{width:after+'px'}],{duration:240,easing:'ease-out'});
  }
}
function renderIslandWeather(rain:boolean,now:number){
  const weather=get('weather');
  const inside=document.body.classList.contains('in-greenhouse');
  const effect=inside?'':farm.weather.surged?' | 💧⚡✦':' | 💧⚡';
  const label=rain?'🌧️ '+(inside?'Дождь снаружи':'Дождь')+' | ещё '+clock((farm.weather.end??now)-now)+effect:'☀️ Ясно';
  if(weather.textContent===label)return;
  const change=()=>{
    weather.textContent=label;
    weather.title=rain&&!inside?'💧 Расход влаги ×0,5 · ⚡ Скорость роста +5%'+(farm.weather.surged?' · ✦ Рывок роста сработал':''):'';
  };
  if(weather.hidden)change();else resizeIsland(change);
}
const activityOval=get('activity-island');
const extractorOval=get('extractor-island');
const islandHeader=activityOval.parentElement!;
const islandDialogs:HTMLDialogElement[]=[];
const islandList=document.createElement('ol');
islandList.className='island-event-list';
islandList.hidden=true;
activityOval.append(islandList);
function refreshIslandList(){
  if(islandList.hidden)return;
  const pages=[...islandCurrentPages,...islandReadyPages,...islandPendingPages];
  if(islandPendingSpend)pages.push('🪙 Потрачено −'+number(islandPendingSpend));
  islandList.replaceChildren(...pages.map(page=>{
    const row=document.createElement('li');
    row.textContent=page;
    return row;
  }));
}
function placeTopIslands(){
  const bounds=islandHeader.getBoundingClientRect();
  const narrow=matchMedia('(max-width:760px)').matches;
  const stacked=matchMedia('(max-width:1100px)').matches;
  const height=islandList.hidden?activityOval.offsetHeight:36;
  const activityTop=narrow?53:(bounds.height-height-(stacked&&!extractorOval.hidden?28:0))/2;
  activityOval.style.top=(activityTop+(activityOval.matches(':popover-open')?bounds.top:0))+'px';
  extractorOval.style.top=(stacked?bounds.height-extractorOval.offsetHeight-5:
    (bounds.height-extractorOval.offsetHeight)/2)+'px';
  extractorOval.style.left='calc(50% + '+(stacked?0:activityOval.offsetWidth/2+8)+'px)';
}
function raiseActivityEvent(){
  if(!activityOval.classList.contains('island-summary'))return;
  if(activityOval.matches(':popover-open'))activityOval.hidePopover();
  const host=islandDialogs.at(-1)??islandHeader;
  if(activityOval.parentElement!==host)host.append(activityOval);
  activityOval.setAttribute('popover','manual');
  activityOval.showPopover();
  placeTopIslands();
}
new MutationObserver(records=>{
  let changed=false;
  for(const {target} of records){
    if(!(target instanceof HTMLDialogElement))continue;
    changed=true;
    const index=islandDialogs.indexOf(target);
    if(index>=0)islandDialogs.splice(index,1);
    if(target.open)islandDialogs.push(target);
  }
  if(changed)raiseActivityEvent();
}).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});
window.addEventListener('resize',placeTopIslands);
const islandResize=new ResizeObserver(placeTopIslands);
for(const element of [activityOval,extractorOval,islandHeader])islandResize.observe(element);
placeTopIslands();
function showIslandEvent(...pages:string[]){
  islandPendingPages.push(...pages);
  scheduleIslandEvents();
}
function playIslandEvents(){
  refreshIslandList();
  const island=get('island-event'),weather=get('weather');
  const oval=get('activity-island');
  if(islandCurrentPages.length||!islandReadyPages.length)return;
  const pages=islandReadyPages.splice(0);
  islandCurrentPages=pages;
  clearTimeout(islandDisplayTimer);
  resizeIsland(()=>{
    oval.style.width='';
    oval.classList.add('island-summary');
    weather.hidden=true;
    island.hidden=false;
    let width=0;
    for(const page of pages){
      island.textContent=page;
      width=Math.max(width,oval.getBoundingClientRect().width);
    }
    oval.style.width=Math.ceil(width)+'px';
    raiseActivityEvent();
  });
  let index=0;
  const show=()=>{
    if(index===pages.length){finishIslandEvent();playIslandEvents();return;}
    island.textContent=pages[index++];
    island.title=island.textContent;
    islandDisplayTimer=setTimeout(show,2600);
  };
  show();
}
function finishIslandEvent(){
  resizeIsland(()=>{
    activityOval.style.width='';
    activityOval.classList.remove('island-summary','island-expanded');
    if(activityOval.matches(':popover-open'))activityOval.hidePopover();
    activityOval.removeAttribute('popover');
    if(activityOval.parentElement!==islandHeader)islandHeader.append(activityOval);
    islandCurrentPages=[];
    islandList.hidden=true;
    get('island-event').hidden=true;
    get('weather').hidden=false;
    placeTopIslands();
  });
}
let islandHoverClose:ReturnType<typeof setTimeout>;
activityOval.addEventListener('pointerenter',event=>{
  clearTimeout(islandHoverClose);
  if(event.pointerType==='touch'||!islandCurrentPages.length||!islandList.hidden)return;
  clearTimeout(islandDisplayTimer);
  activityOval.classList.add('island-expanded');
  get('island-event').hidden=true;
  islandList.hidden=false;
  refreshIslandList();
  placeTopIslands();
});
activityOval.addEventListener('pointerleave',()=>{
  if(islandList.hidden)return;
  islandHoverClose=setTimeout(()=>{
    islandReadyPages.length=0;
    islandPendingPages.length=0;
    islandPendingSpend=0;
    finishIslandEvent();
  },350);
});
function recordIslandHarvest(amount:number,before:{diamonds:number;orbs:number;items:Record<string,number>},
  extras:{coins:number;seeds:number;crop:number;restarted:boolean}){
  const time=performance.now();
  const batch=islandHarvest??={start:time,last:time,plants:0,fruit:0,loot:{}};
  batch.last=time;
  batch.fruit+=amount;
  batch.plants++;
  const add=(label:string,count:number)=>{if(count>0)batch.loot[label]=(batch.loot[label]??0)+count;};
  add('🔮',(farm.resources.orbs-before.orbs));
  add('💎',(farm.diamonds?.balance??0)-before.diamonds);
  add('🪙 Монеты со сбора',extras.coins);
  add('🌱 Семена · '+crops[extras.crop].name,extras.seeds);
  add('🔄 Новый цикл с половины роста',Number(extras.restarted));
  for(const material of materials)add(material.icon+' '+material.name,(farm.resources.items[material.id]??0)-(before.items[material.id]??0));
  clearTimeout(islandHarvestTimer);
  islandHarvestTimer=setTimeout(()=>{
    islandHarvest=null;
    const duration=Math.round((batch.last-batch.start)/1000);
    islandReadyPages.push('За последние '+Math.max(1,duration)+' с · 🌱 Грядок: '+number(batch.plants),
      '🧺 Урожай +'+number(batch.fruit),
      ...Object.entries(batch.loot).map(([label,count])=>label+' +'+number(count)));
    playIslandEvents();
  },2000);
}
