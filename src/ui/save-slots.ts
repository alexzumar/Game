const saveSlots=collectionOverlay('save-slots','Сохранения');
const saveSlotStatus=document.createElement('p');
saveSlotStatus.setAttribute('role','status');
const saveSlotList=document.createElement('div');
saveSlotList.id='save-slot-list';
const saveCreate=document.createElement('form');
saveCreate.className='glass panel save-create';
saveCreate.innerHTML='<h3>Новый мир</h3><label>Название <input name="world" maxlength="60" required></label><label><input name="cheats" type="checkbox"> Включить читы</label><button class="quiet wide">Создать мир</button>';
saveSlots.append(saveCreate,saveSlotStatus,saveSlotList);

function storedSaveSlots(){
  const slots:number[]=[];
  for(let index=0;index<localStorage.length;index++){
    const name=localStorage.key(index);
    if(name===slotKey(1)){slots.push(1);continue;}
    const match=name?.match(/^glass-farm\.v1\.slot-([1-9]\d*)$/);
    const slot=Number(match?.[1]);
    if(Number.isSafeInteger(slot)&&slot>1)slots.push(slot);
  }
  return slots.sort((a,b)=>a-b);
}

function renderSaveSlots(){
  saveSlotList.replaceChildren();
  try{
    const slots=storedSaveSlots();
    if(!slots.includes(activeSlot))slots.push(activeSlot);
    for(const [index,slot] of slots.entries()){
      const isActive=slot===activeSlot;
      const raw=localStorage.getItem(slotKey(slot));
      let state:Farm|null=isActive&&!activeSaveUnreadable?farm:null;
      if(!isActive&&raw){
        try{state=JSON.parse(raw) as Farm;}catch{/* The damaged world can still be deleted. */}
      }
      const control=document.createElement('button');
      control.type='button';
      control.className='quiet';
      const name=typeof state?.saveName==='string'&&state.saveName.trim()?state.saveName:'Мир '+(index+1);
      control.textContent=name+(state?' · 🪙 '+number(state.coins??0)+(state.saveCheats?' · Читы':''):' · Не читается')+(isActive?' · Активен':'');
      control.onclick=()=>{if(!isActive&&state)switchSaveSlot(slot);};
      bindSaveDeletion(control,slot);
      saveSlotList.append(control);
    }
  }catch(error){
    saveSlotStatus.textContent='Не удалось прочитать сохранения.';
    console.error('Ферма: ошибка списка сохранений',error);
  }
}

function switchSaveSlot(slot:number,newWorld?:Farm){
  let created=false;
  try{
    syncPlayTime();
    if(!activeSaveUnreadable&&!saveFarm({...farm,pausedAt:Date.now()}))throw new Error('Не удалось сохранить текущий мир');
    if(newWorld){
      if(!saveFarm(newWorld,slotKey(slot)))throw new Error('Не удалось создать мир');
      created=true;
    }
    localStorage.setItem(activeSlotKey,String(slot));
    reloadFarm();
  }catch(error){
    if(created)localStorage.removeItem(slotKey(slot));
    saveSlotStatus.textContent='Не удалось открыть мир.';
    console.error('Ферма: ошибка переключения сохранения',error);
  }
}
button('save-slots-open').onclick=()=>{
  saveSlotStatus.textContent='';
  renderSaveSlots();
  saveSlots.showModal();
};
saveCreate.onsubmit=event=>{
  event.preventDefault();
  const data=new FormData(saveCreate);
  const name=String(data.get('world')??'').trim();
  if(!name){saveSlotStatus.textContent='Введи название мира.';return;}
  try{
    const slots=new Set([...storedSaveSlots(),activeSlot]);
    let slot=1;
    while(slots.has(slot))slot++;
    switchSaveSlot(slot,{...newFarm(),saveName:name,saveCheats:data.has('cheats')});
  }catch(error){
    saveSlotStatus.textContent='Не удалось создать мир.';
    console.error('Ферма: ошибка создания мира',error);
  }
};

function bindSaveDeletion(control:HTMLButtonElement,slot:number){
  control.title='Удерживай 5 секунд для удаления';
  let timer:ReturnType<typeof setTimeout>|undefined;
  const cancel=()=>{
    clearTimeout(timer);
    window.removeEventListener('blur',cancel);
    control.classList.remove('deleting-save');
  };
  control.onpointerdown=event=>{
    if(event.button!==0||!event.isPrimary)return;
    control.setPointerCapture(event.pointerId);
    window.addEventListener('blur',cancel);
    control.classList.add('deleting-save');
    timer=setTimeout(()=>{
      if(document.hasFocus()&&saveSlots.open)deleteSaveSlot(slot);
      cancel();
    },5000);
  };
  control.onpointerup=cancel;
  control.onpointercancel=cancel;
  control.onlostpointercapture=cancel;
}

function deleteSaveSlot(slot:number){
  try{
    if(slot===activeSlot){
      const next=storedSaveSlots().find(id=>id!==slot)??1;
      localStorage.setItem(activeSlotKey,String(next));
      try{localStorage.removeItem(slotKey(slot));}
      catch(error){localStorage.setItem(activeSlotKey,String(activeSlot));throw error;}
      reloadFarm();
      return;
    }
    localStorage.removeItem(slotKey(slot));
    renderSaveSlots();
  }catch(error){
    saveSlotStatus.textContent='Не удалось удалить сохранение.';
    console.error('Ферма: ошибка удаления сохранения',error);
  }
}
