const saveSlots = get<HTMLDetailsElement>('save-slots');
const saveSlotStatus = get('save-slot-status');

function renderSaveSlots(){
  const list=get('save-slot-list');
  list.replaceChildren();
  try{
    for(let slot=1;slot<=3;slot++){
      const raw=localStorage.getItem(slotKey(slot));
      const state=raw?(slot===activeSlot?farm:JSON.parse(raw) as Farm):null;
      const control=document.createElement('button');
      control.className='quiet';
      control.textContent='Слот '+slot+(state?' · 🪙 '+number(state.coins??0)+(state.saveCheats?' · Читы':''):' · Пусто');
      const isActive=slot===activeSlot&&state!==null;
      if(isActive)control.textContent+=' · Активен';
      control.onclick=()=>{if(!isActive)switchSaveSlot(slot);};
      if(state)bindSaveDeletion(control,slot);
      list.append(control);
    }
  }catch(error){
    saveSlotStatus.textContent='Не удалось прочитать сохранения.';
    console.error('Ферма: ошибка списка сохранений',error);
  }
}

function switchSaveSlot(slot:number){
  try{
    const target=slotKey(slot);
    if(localStorage.getItem(target)===null){
      const cheats=get<HTMLInputElement>('save-slot-cheats').checked;
      if(!saveFarm({...newFarm(),saveCheats:cheats},target))throw new Error('Не удалось создать ферму');
    }
    if(slot!==activeSlot&&!saveFarm({...farm,pausedAt:Date.now()}))throw new Error('Не удалось сохранить текущую ферму');
    localStorage.setItem(activeSlotKey,String(slot));
    location.reload();
  }catch(error){
    saveSlotStatus.textContent='Не удалось переключить слот.';
    console.error('Ферма: ошибка переключения сохранения',error);
  }
}

saveSlots.addEventListener('toggle',()=>{if(saveSlots.open)renderSaveSlots();});

function bindSaveDeletion(control:HTMLButtonElement,slot:number){
  control.title='Зажми для удаления';
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
    },10000);
  };
  control.onpointerup=cancel;
  control.onpointercancel=cancel;
  control.onlostpointercapture=cancel;
}

function deleteSaveSlot(slot:number){
  try{
    if(slot!==activeSlot&&!saveFarm(farm))throw new Error('Не удалось сохранить текущую ферму');
    const previous=[1,2,3].map(id=>localStorage.getItem(slotKey(id)));
    const activeBefore=localStorage.getItem(activeSlotKey);
    const remaining=previous.filter((raw,index)=>raw!==null&&index!==slot-1);
    const keptActive=slot===activeSlot?null:previous[activeSlot-1];
    const nextActive=keptActive===null?1:previous.slice(0,activeSlot).filter((raw,index)=>raw!==null&&index!==slot-1).length;
    try{
      for(let index=0;index<3;index++){
        const raw=remaining[index],target=slotKey(index+1);
        if(raw===undefined)localStorage.removeItem(target);
        else localStorage.setItem(target,raw);
      }
      localStorage.setItem(activeSlotKey,String(nextActive));
    }catch(error){
      previous.forEach((raw,index)=>{
        const target=slotKey(index+1);
        if(raw===null)localStorage.removeItem(target);
        else localStorage.setItem(target,raw);
      });
      if(activeBefore===null)localStorage.removeItem(activeSlotKey);
      else localStorage.setItem(activeSlotKey,activeBefore);
      throw error;
    }
    location.reload();
  }catch(error){
    saveSlotStatus.textContent='Не удалось удалить сохранение.';
    console.error('Ферма: ошибка удаления сохранения',error);
  }
}
