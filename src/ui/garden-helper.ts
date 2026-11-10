const gardenHelperDialog=collectionOverlay('garden-helper-dialog','Помощник сада');
const gardenHelperPanel=document.createElement('section');
gardenHelperPanel.className='glass panel garden-helper-panel';
gardenHelperPanel.innerHTML='<p>Сажает, поливает и собирает выбранную культуру в саду. В экстрактор отправляет урожай для запаса семян на поле. Остальное оставляет в корзине.</p><p class="garden-helper-gate"></p><label>Культура <select></select></label><button type="button" class="quiet wide"></button>';
gardenHelperDialog.append(gardenHelperPanel);
const helperHistory=document.createElement('section');
helperHistory.className='glass panel helper-history';
helperHistory.innerHTML='<h3>История помощника</h3><p>Грядки указаны как ряд:столбец.</p><ol tabindex="0" aria-label="Действия помощника"></ol>';
gardenHelperDialog.append(helperHistory);
function renderHelperHistory(){
  const list=helperHistory.querySelector('ol')!;
  const atEnd=list.scrollHeight-list.clientHeight-list.scrollTop<12;
  list.replaceChildren(...(gardenHelperHistory.length?gardenHelperHistory:['Действий пока нет.']).map(message=>{
    const row=document.createElement('li');
    row.textContent=message;
    return row;
  }));
  if(atEnd)list.scrollTop=list.scrollHeight;
}
const helperGate=gardenHelperPanel.querySelector<HTMLElement>('.garden-helper-gate')!;
const helperCrop=gardenHelperPanel.querySelector<HTMLSelectElement>('select')!;
const helperToggle=gardenHelperPanel.querySelector<HTMLButtonElement>('button')!;
const helperUnlockText='Для открытия расширь поле до 2 × 2, собери 4 плода и переработай хотя бы один в экстракторе.';
const helperOpen=document.createElement('button');
helperOpen.type='button';
helperOpen.id='garden-helper-open';
helperOpen.className='quiet wide';
helperOpen.textContent='🌱 Помощник сада';
button('knots-open').before(helperOpen);

function renderGardenHelper(){
  const helper=farm.gardenHelper??newGardenHelper();
  const open=gardenHelperUnlocked(farm);
  helperGate.hidden=open;
  helperGate.textContent=helperUnlockText;
  helperCrop.replaceChildren(new Option('Выбери культуру',''),...crops.flatMap((crop,index)=>
    unlocked(farm,index)?[new Option(crop.symbol+' '+crop.name,String(index))]:[]));
  helperCrop.value=helper.crop===null?'':String(helper.crop);
  helperCrop.disabled=!open;
  helperToggle.disabled=!open||helper.crop===null;
  helperToggle.textContent=helper.enabled?'Выключить':'Включить';
}
helperOpen.onclick=()=>{renderGardenHelper();gardenHelperDialog.showModal();renderHelperHistory();};
helperCrop.onchange=()=>{
  if(!gardenHelperUnlocked(farm))return;
  const helper=farm.gardenHelper??=newGardenHelper();
  helper.crop=helperCrop.value===''?null:Number(helperCrop.value);
  if(helper.crop===null)helper.enabled=false;
  commit();
  renderGardenHelper();
};
helperToggle.onclick=()=>{
  const helper=farm.gardenHelper;
  if(!gardenHelperUnlocked(farm)||!helper||helper.crop===null)return;
  helper.enabled=!helper.enabled;
  commit();
  renderGardenHelper();
};
const helperCards=gardenHelperActions.map((action,index)=>{
  const card=document.createElement('article');
  card.className='glass panel';
  const title=document.createElement('h3');
  title.textContent=['🌱 Посадка','💧 Полив','🧺 Сбор'][index];
  const effect=document.createElement('p');
  const buy=document.createElement('button');
  buy.type='button';
  buy.className='quiet';
  buy.onclick=()=>{if(buyGardenHelperUpgrade(farm,action))commit();};
  card.append(title,effect,buy);
  get('helper-upgrades').append(card);
  return {action,effect,buy};
});
var gardenHelperCardsReady=true;
button('upgrade-tab-helper').addEventListener('click',renderGardenHelperUpgrades);
button('upgrades-open').addEventListener('click',renderGardenHelperUpgrades);
function renderGardenHelperUpgrades(){
  const open=gardenHelperUnlocked(farm),ranks=gardenHelperRankTotal(farm);
  const gate=get('helper-upgrade-gate');
  gate.textContent=helperUnlockText;
  gate.hidden=open;
  for(const {action,effect,buy} of helperCards){
    const level=farm.gardenHelper?.levels[action]??0;
    const interval=(rank:number)=>'1 грядка каждые '+number(gardenHelperIntervals[rank]/1000)+' с';
    const price=gardenHelperUpgrade(farm,action);
    renderUpgradeChange(effect,level,interval(level),price?interval(level+1):undefined);
    const material=price&&materialsBySaveKey.get(price.id)!;
    buy.textContent=price&&material?material.icon+' '+price.cost+(ranks<price.ranks?' · нужно '+price.ranks+' рангов узелков':''):'Максимум';
    buy.disabled=!open||!price||ranks<price.ranks||(farm.resources.items[price.id]??0)<price.cost;
  }
}
