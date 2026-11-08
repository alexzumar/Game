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
    const job=extractionJobs(farm.extraction)[slot];
    if(job?.recycledHybrid!==undefined)return;
    if(job){
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
    card.querySelector('span:not(.extractor-fill)')!.textContent=current?current.recycledHybrid??crops[current.crop].name+' ×'+(current.input-current.done):'Слот '+(slot+1);
    card.querySelector('small')!.textContent=current?clock(period-elapsed)+(current.recycledHybrid!==undefined?' · 🧬 +'+current.output:' · 🌱 '+total(current.outputs.slice(0,current.done))):'Добавить урожай';
    card.title=current?(current.recycledHybrid!==undefined?'Утилизация семени':'Нажми, чтобы остановить партию'):'Выбрать урожай и количество';
  });
  const activeJobs=jobs.filter(Boolean);
  const toast=get('extraction-toast');
  toast.hidden=extractionDialog.open||!activeJobs.length;
  get('extraction-toast-label').textContent='⚙️ Партий в работе: '+activeJobs.length;
  get('extraction-toast-time').textContent=activeJobs.length?'До ближайшего результата: '+clock(Math.max(0,Math.min(...activeJobs.map(job=>extractionDeadline(job!,job!.done)))-now)):'';
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
  const freeSlots=extractionCards.filter((_,slot)=>slot<slots&&!jobs[slot]).length;
  button('extractor-split').hidden=slots<2;
  button('extractor-split').disabled=freeSlots<2||available<2;
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
button('extractor-split').onclick=()=>{
  if(!splitExtraction(farm,extractionCrop,nowTime()))return;
  extractionPicker.close();
  commit('Урожай распределён по свободным слотам.');
};
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
  const inGreenhouse=greenhouseVisible();
  const row=button(inGreenhouse?'garden-link':'seed-'+crop);
  if(row.hidden)return;
  const start=get(inGreenhouse?'garden-link':'seed-stock-title').getBoundingClientRect(),end=row.getBoundingClientRect();
  const startX=inGreenhouse?start.right-165:start.right+8;
  const startY=inGreenhouse?start.bottom+34:start.top+start.height/2;
  const flight=document.createElement('span');flight.className='harvest-flight';
  flight.textContent=crops[crop].symbol+' '+crops[crop].name+' ×'+number(count);
  flight.style.left=startX+'px';flight.style.top=startY+'px';
  document.documentElement.append(flight);
  try{
    const animation=flight.animate([
      {transform:'translate(0,-50%)',opacity:1},
      {transform:'translate('+(end.left+end.width/2-startX)+'px,'+(end.top+end.height/2-startY)+'px) scale(.6)',opacity:.6}
    ],{duration:620,easing:'ease-in-out'});
    animation.onfinish=()=>{
      flight.remove();
      row.animate([{transform:'scale(1)'},{transform:'scale(1.045)',offset:.4},{transform:'none'}],{duration:250});
    };
    animation.oncancel=()=>flight.remove();
  }catch(error){flight.remove();console.error('Ферма: ошибка перелёта извлечённых семян',error);}
}
