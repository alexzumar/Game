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
