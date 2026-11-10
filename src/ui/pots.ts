const potsPanel=get('greenhouse-pots');
const potDialog=collectionOverlay('greenhouse-pot-dialog','Горшок');
const potBody=document.createElement('section');
potBody.className='glass panel pot-body';
potDialog.append(potBody);
const potTooltip=document.createElement('div');
potTooltip.className='glass pot-tooltip';
potTooltip.setAttribute('role','tooltip');
potTooltip.hidden=true;
document.body.append(potTooltip);
let selectedPot=0;
let hoveredPot:number|null=null;
function plantPot(index:number,line:number){
  if(!plantGreenhousePot(farm,index,line,nowTime()))return;
  commit();
  if(potDialog.open)renderPotDialog();
}
const potButtons=[...potsPanel.querySelectorAll('img')].map((image,index)=>{
  const control=document.createElement('button');
  control.type='button';
  control.className='greenhouse-pot';
  const badge=document.createElement('span');
  badge.className='pot-plant-icon';
  const timer=document.createElement('span');
  timer.className='glass pot-timer';
  timer.hidden=true;
  image.replaceWith(control);
  control.append(image,badge,timer);
  control.onclick=()=>{
    potTooltip.hidden=true;
    selectedPot=index;
    renderPotDialog();
    potDialog.showModal();
  };
  control.onpointerenter=()=>{hoveredPot=index;renderPotTooltip();};
  control.onpointerleave=()=>{hoveredPot=null;potTooltip.hidden=true;};
  control.ondragover=event=>{
    if(!farm.pots?.[index]&&event.dataTransfer?.types.includes('application/x-farm-hybrid'))event.preventDefault();
  };
  control.ondrop=event=>{
    const value=event.dataTransfer?.getData('application/x-farm-hybrid');
    if(value&&/^\d+$/.test(value)){event.preventDefault();plantPot(index,Number(value));}
  };
  return {control,badge,timer};
});
const potDropRow=document.createElement('div');
potDropRow.className='pot-drop-row greenhouse-only';
get('hybrid-grid').before(potDropRow);
const potDropTargets=potButtons.map((_,index)=>{
  const target=document.createElement('span');
  target.className='glass';
  target.textContent='Горшок '+(index+1);
  target.ondragover=event=>{
    if(!farm.pots?.[index]&&event.dataTransfer?.types.includes('application/x-farm-hybrid'))event.preventDefault();
  };
  target.ondrop=event=>{
    const value=event.dataTransfer?.getData('application/x-farm-hybrid');
    if(value&&/^\d+$/.test(value)){event.preventDefault();plantPot(index,Number(value));}
  };
  potDropRow.append(target);
  return target;
});
function potSummary(pot:GreenhousePot,now:number){
  const line=farm.lines[pot.line];
  const bonus='🍀 К шансу материалов: +'+number(Math.round(potMaterialBonus(pot,now)*10000)/100)+'% · максимум +5% через час после созревания';
  if(now<pot.ready)return [line.name,'Созреет через '+clock(pot.ready-now),bonus];
  const elapsed=Math.max(0,now-pot.since);
  const rows=[line.name,'Накопление · '+clock(elapsed),'Следующий цикл · '+clock(pot.next-now)];
  const rate=(count:number)=>elapsed?' | '+number(Math.round(count*36000000/elapsed)/10)+'/ч за этот период':'';
  const crop=crops[line.crop];
  if(pot.fruit)rows.push(crop.symbol+' '+crop.name+' ×'+number(pot.fruit)+rate(pot.fruit));
  for(const [id,count] of Object.entries(pot.items)){
    const material=materialsBySaveKey.get(id)!;
    rows.push(material.icon+' '+material.name+' ×'+number(count)+rate(count));
  }
  if(rows.length===3)rows.push('Пока ничего не выпало.');
  return [...rows,bonus];
}
function renderPotTooltip(){
  if(hoveredPot===null||potDialog.open)return;
  const pot=farm.pots?.[hoveredPot];
  potTooltip.textContent=pot?potSummary(pot,nowTime()).join('\n'):'Нажми или перетащи сюда гибрид.';
  potTooltip.hidden=false;
  const anchor=potButtons[hoveredPot].control.getBoundingClientRect();
  const bounds=potTooltip.getBoundingClientRect();
  potTooltip.style.left=Math.max(8,Math.min(anchor.right+8,innerWidth-bounds.width-8))+'px';
  potTooltip.style.top=Math.max(8,Math.min(anchor.top,innerHeight-bounds.height-8))+'px';
}
function renderPotDialog(){
  const pot=farm.pots?.[selectedPot];
  potBody.replaceChildren();
  if(!pot){
    const lines=farm.lines.flatMap((line,index)=>line.archived||!line.seeds?[]:[{line,index}]);
    if(!lines.length)potBody.textContent='В инвентаре пока нет семян гибридов.';
    for(const {line,index} of lines){
      const option=document.createElement('button');
      option.className='quiet wide';
      option.textContent=crops[line.crop].symbol+' '+line.name+' · 🌱 '+number(line.seeds);
      option.onclick=()=>plantPot(selectedPot,index);
      potBody.append(option);
    }
    return;
  }
  const summary=document.createElement('p');
  summary.className='pot-summary';
  const line=farm.lines[pot.line];
  const {genes,powers}=effectiveGenome(farm,{crop:line.crop,line:pot.line,planted:pot.ready,ready:pot.ready});
  const identity=document.createElement('div');
  identity.className='pot-identity';
  const name=document.createElement('strong');
  name.tabIndex=0;
  name.textContent=line.name;
  const traits=document.createElement('span');
  const geneText='⚡ Gr '+genes.gr+' · 💰 Ga '+genes.ga+' · 🛡️ Re '+genes.re;
  traits.textContent=geneText+line.traits.map(id=>{
    const value=powers[id];
    return ' · '+(abilityDefinitions[id]?.icon??'✦')+(value===undefined?'':' '+Math.round(value)+(id==='yield'?'':'%'));
  }).join('');
  const details=document.createElement('div');
  details.className='glass pot-trait-tip';
  details.setAttribute('role','tooltip');
  details.id='pot-hybrid-traits';
  name.setAttribute('aria-describedby',details.id);
  details.textContent=[line.name,geneText,...line.traits.map(id=>powerLabel(line,id))].join('\n');
  identity.append(name,traits,details);
  const claim=document.createElement('button');
  claim.className='quiet wide';
  claim.textContent='Забрать добычу';
  claim.onclick=()=>{
    if(claimGreenhousePot(farm,selectedPot,nowTime()))commit();
  };
  const remove=document.createElement('button');
  remove.className='quiet wide';
  remove.textContent='Убрать гибрид в инвентарь';
  remove.onclick=()=>{
    if(removeGreenhousePot(farm,selectedPot,nowTime())){commit();renderPotDialog();}
  };
  potBody.append(identity,summary,claim,remove);
  updatePotDialog(pot,nowTime());
}
function updatePotDialog(pot:GreenhousePot,now:number){
  const summary=potBody.querySelector('.pot-summary');
  if(!summary)return;
  const text=potSummary(pot,now).slice(1).join('\n');
  if(summary.textContent!==text)summary.textContent=text;
  const [claim,remove]=potBody.querySelectorAll('button');
  claim.disabled=now<pot.ready||(!pot.fruit&&!Object.keys(pot.items).length);
  const line=farm.lines[pot.line];
  remove.disabled=(line.archived||!line.seeds)&&hybridCount(farm)>=farm.hybridSlots;
  remove.title=remove.disabled?'Освободи место в инвентаре гибридов.':'';
}
function renderGreenhousePots(){
  const now=nowTime();
  potButtons.forEach(({control,badge,timer},index)=>{
    const pot=farm.pots?.[index];
    const crop=pot?crops[farm.lines[pot.line].crop]:null;
    control.setAttribute('aria-label','Горшок '+(index+1)+(crop?' · '+crop.name:' · Пусто'));
    potDropTargets[index].textContent='Горшок '+(index+1)+(crop?' · занят':' · перетащи гибрид');
    badge.textContent=crop?.symbol??'';
    badge.classList.toggle('pot-ripe',!!pot&&now>=pot.ready);
    timer.hidden=!pot;
    if(pot)timer.textContent=now<pot.ready?'🌱 '+clock(pot.ready-now):'⏱ '+clock(now-pot.since);
  });
  if(!document.body.classList.contains('in-greenhouse')){hoveredPot=null;potTooltip.hidden=true;}
  else renderPotTooltip();
  const pot=farm.pots?.[selectedPot];
  if(potDialog.open&&pot)updatePotDialog(pot,now);
}
var greenhousePotsReady=true;
renderGreenhousePots();
