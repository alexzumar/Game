const gardenHelperDialog=collectionOverlay('garden-helper-dialog','Помощник сада');
const gardenHelperPanel=document.createElement('section');
gardenHelperPanel.className='glass panel garden-helper-panel';
gardenHelperPanel.innerHTML='<p>Для выбранной культуры помощник может сажать, поливать, собирать и пополнять семена через экстрактор. В режиме «Любая доступная» он поливает и собирает все посадки в саду, если эти действия включены. Посев и автопереработка в этом режиме недоступны.</p><p class="garden-helper-gate"></p><label>Культура <select></select></label><button type="button" class="quiet wide"></button>';
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
function helperActionLabel(action:GardenHelperAction){return {collect:'Сбор',sow:'Посадка',water:'Полив'}[action];}
const helperActionsRow=document.createElement('div');
helperActionsRow.className='helper-actions-row';
helperToggle.before(helperActionsRow);
const helperActionControls=(['collect','sow','water'] as const).map(action=>{
  const control=document.createElement('button');
  control.type='button';
  control.className='quiet helper-switch';
  control.textContent=helperActionLabel(action);
  if(action==='sow')control.title='Посадка и пополнение семян через экстрактор';
  control.onclick=()=>{
    if(!gardenHelperUnlocked(farm))return;
    const helper=farm.gardenHelper??=newGardenHelper();
    if(action==='sow'&&helper.crop===null)return;
    const actions=helper.actions??={collect:true,sow:true,water:true};
    actions[action]=!actions[action];
    commit();
    renderGardenHelper();
  };
  helperActionsRow.append(control);
  return {action,control};
});
helperToggle.classList.add('helper-switch');
const helperUnlockText='Для открытия расширь поле до 2 × 2, собери 4 плода и переработай хотя бы один в экстракторе.';
const helperOpen=document.createElement('button');
helperOpen.type='button';
helperOpen.id='garden-helper-open';
helperOpen.className='quiet wide';
helperOpen.textContent='🌱 Помощник сада';
button('knots-open').before(helperOpen);
renderHelperIndicator();

function renderHelperIndicator(){
  const helper=farm.gardenHelper;
  const actions=gardenHelperActions.filter(action=>helper&&helperActionEnabled(helper,action));
  const running=!!helper?.enabled&&gardenHelperUnlocked(farm)&&(helper.crop===null||unlocked(farm,helper.crop))&&actions.length>0;
  const dot=get('helper-island-dot');
  dot.hidden=!running;
  const description='Помощник сада работает · '+actions.map(helperActionLabel).join(', ');
  if(dot.title!==description){dot.title=description;dot.setAttribute('aria-label',description);}
  const control=get('garden-helper-open');
  const label='🌱 Помощник сада'+(running?' · Работает':'');
  if(control&&control.textContent!==label)control.textContent=label;
}

function renderGardenHelper(){
  const helper=farm.gardenHelper??newGardenHelper();
  const open=gardenHelperUnlocked(farm);
  helperGate.hidden=open;
  helperGate.textContent=helperUnlockText;
  helperCrop.replaceChildren(new Option('Любая доступная',''),...crops.flatMap((crop,index)=>
    unlocked(farm,index)?[new Option(crop.symbol+' '+crop.name,String(index))]:[]));
  helperCrop.value=helper.crop===null?'':String(helper.crop);
  helperCrop.disabled=!open;
  helperToggle.disabled=!open;
  helperToggle.textContent=helper.enabled?'Выключить':'Включить';
  helperToggle.setAttribute('aria-pressed',String(helper.enabled));
  for(const {action,control} of helperActionControls){
    control.disabled=!open||action==='sow'&&helper.crop===null;
    control.setAttribute('aria-pressed',String(helperActionEnabled(helper,action)));
  }
}
helperOpen.onclick=()=>{renderGardenHelper();gardenHelperDialog.showModal();renderHelperHistory();};
helperCrop.onchange=()=>{
  if(!gardenHelperUnlocked(farm))return;
  const helper=farm.gardenHelper??=newGardenHelper();
  helper.crop=helperCrop.value===''?null:Number(helperCrop.value);
  commit();
  renderGardenHelper();
};
helperToggle.onclick=()=>{
  if(!gardenHelperUnlocked(farm))return;
  const helper=farm.gardenHelper??=newGardenHelper();
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
    const icon=price?.id?materialsBySaveKey.get(price.id)!.icon:'🔮';
    buy.textContent=price?icon+' '+price.cost+(ranks<price.ranks?' · Узелки '+ranks+'/'+price.ranks:''):'Максимум';
    buy.disabled=!open||!price||ranks<price.ranks||gardenHelperUpgradeBalance(farm,price)<price.cost;
    const requirement=price?.ranks?'Ранги суммируются по всем четырём монументам. Каждое купленное улучшение узелка даёт один ранг. Сейчас '+ranks+' из '+price.ranks+' нужных.':'';
    renderMaterialPriceTip(buy,price?.id?[price.id]:[],
      price?.id===null?'Орбы выпадают при сборе обычных культур.':requirement,'Орбы');
  }
}
