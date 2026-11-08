const collectionDialog=get<HTMLDialogElement>('collection-dialog');
button('collection-open').onclick=()=>collectionDialog.showModal();
button('collection-close').onclick=()=>collectionDialog.close();
let discoveryBusy=false;
let selectedCollection=-1;
for(const [i] of crops.entries()) {
  const card=document.createElement('button');card.className='glass panel collection-card';
  card.id='collection-crop-'+i;
  card.onclick=()=>{
    if(!unlocked(farm,i))return;
    selectedCollection=i;
    get('collection-detail').hidden=false;
    renderCollection();
  renderDiscoveryUpgrades();
  renderExtraction();
  renderLines();
  renderDock();
  if(typeof mutationDialog!=="undefined" && mutationDialog.open && farm.plots[mutationIndex]?.mystery)button("mutation-accept").disabled=(farm.plots[mutationIndex]!.ready??Infinity)>nowTime()||hybridCount(farm)>=farm.hybridSlots;
  };
  get('collection-grid').append(card);
}
function renderCollection() {
  crops.forEach((crop,i)=>{
    const count=farm.collection[i];
    const card=button('collection-crop-'+i);
    card.textContent=count ? crop.symbol+' '+crop.name+' · '+count+' находок' : '🔒 Неизвестно';
    card.classList.toggle('unknown-crop',!count);
    card.disabled=!count;
  });
  button('discover').disabled=discoveryBusy || farm.discoveries>0 && farm.coins<discoveryPrice;
  button('discover').textContent=farm.discoveries===0?'Первое открытие бесплатно':'Рулетка видов · 🪙 '+discoveryPrice;
  button('collection-close').disabled=discoveryBusy;
  get('collection-coins').textContent=number(farm.coins);
  if(selectedCollection>=0) {
    const i=selectedCollection,count=farm.collection[i],level=collectionLevel(count);
    get('collection-detail').textContent=crops[i].symbol+' '+crops[i].name+' · Найдено за игру: '+number(count)+
      ' · ⚡ Уровень коллекции '+level+' · Рост '+clock(growthTime(i,collectionGrowth(farm,i))/growthMultiplier(farm))+
      ' · До следующего уровня: '+number(nextCollectionAt(count)-count)+' находок.';
  }
  get('sets-list').replaceChildren(...cropSets.map((set,index)=>{
    const row=document.createElement('section');row.className='glass panel set-row';
    const title=document.createElement('h3');title.textContent=set.name;
    const description=document.createElement('p');
    const completed=collectionSets(farm)[index]>0;
    description.textContent=(completed?'✓ Собран. ':'')+'Бонус будет определён позже.'+(index===2?' · Открывает покупку автополива.':'');
    const icons=document.createElement('div');icons.className='set-icons';
    set.crops.forEach(i=>{
      const item=document.createElement('span');const known=unlocked(farm,i);
      item.textContent=known?crops[i].symbol:'🔒';
      item.className=known?'':'unknown-crop';
      item.title=known?crops[i].name:'Шанс открытия: '+formatChance(discoveryOdds()[i])+'%';
      icons.append(item);
    });
    row.append(title,icons,description);return row;
  }));
}
button('show-sets').onclick=()=>{
  const panel=get('sets-list');panel.hidden=!panel.hidden;
  const setsVisible=!panel.hidden;
  get('collection-grid').hidden=setsVisible;
  get('collection-detail').hidden=true;
  for(const id of ['discover','discovery-reel','discovery-result'])get(id).hidden=setsVisible;
  button('show-sets').textContent=setsVisible?'К коллекции':'Наборы';
};
collectionDialog.oncancel=event=>{if(discoveryBusy)event.preventDefault();};
button('discover').onclick=async()=>{
  if(discoveryBusy)return;
  const results=discover(farm);
  if(!results.length)return;
  discoveryBusy=true;commit();
  try {
    get('discovery-result').textContent='Рулетки крутятся…';
    const pool=crops.map((_,i)=>i);
    const reels=results.map(result=>createReel(result.crop,pool,false));
    get('discovery-reel').replaceChildren(...reels.map(item=>item.reel));
    if(!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      await Promise.all(reels.map(({track},i)=>track.animate([
        {transform:'translateX(calc(var(--ticket) * -1.5))'},{transform:track.style.transform}
      ],{duration:Math.max(450,2900/(1+farm.discoveryUp.speed*.15))+i*90,easing:'cubic-bezier(.12,.66,.14,1)'}).finished));
    }
    get('sets-list').hidden=true;get('collection-grid').hidden=false;
    for(let i=0;i<results.length;i++){
      const result=results[i],card=button('collection-crop-'+result.crop);
      card.scrollIntoView({block:'nearest'});
      if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
        const from=reels[i].reel.getBoundingClientRect(),to=card.getBoundingClientRect();
        const frame=collectionDialog.getBoundingClientRect();
        const flight=document.createElement('span');flight.className='pack-seed-flight';
        flight.textContent=crops[result.crop].symbol+' +'+result.amount;
        flight.style.left=(from.left+from.width/2-frame.left+collectionDialog.scrollLeft)+'px';
        flight.style.top=(from.top+from.height/2-frame.top+collectionDialog.scrollTop)+'px';
        collectionDialog.append(flight);
        try {
          await flight.animate([
            {transform:'translate(-50%,-50%)'},
            {transform:'translate(calc(-50% + '+(to.left+to.width/2-from.left-from.width/2)+'px),calc(-50% + '+
              (to.top+to.height/2-from.top-from.height/2)+'px)) scale(.7)'}
          ],{duration:430,easing:'ease-out'}).finished;
        } finally {flight.remove();}
      }
    }
    const sums=new Map<number,number>();
    for(const item of results)sums.set(item.crop,(sums.get(item.crop)??0)+item.amount);
    get('discovery-result').textContent=Array.from(sums,([crop,count])=>crops[crop].symbol+' '+crops[crop].name+' +'+count).join(' · ');
  } catch(error){console.error('Ферма: ошибка рулетки коллекции',error);}
  finally{finishDiscovery(farm);discoveryBusy=false;commit();}
};
for(const [id,label] of [['speed','Скорость прокрутки'],['slots','Количество рулеток'],['amount','Находки в слоте']] as const){
  const panel=document.createElement('section');panel.className='glass panel';
  const title=document.createElement('h2');title.textContent=label;
  const info=document.createElement('p');info.id='discovery-up-info-'+id;
  const buy=document.createElement('button');buy.className='quiet';buy.id='discovery-up-buy-'+id;
  buy.onclick=()=>{if(buyDiscoveryUpgrade(farm,id))commit('Рулетка улучшена.');};
  panel.append(title,info,buy);get('discovery-upgrades').append(panel);
}
function renderDiscoveryUpgrades(){
  for(const id of ['speed','slots','amount'] as const){
    const level=farm.discoveryUp[id],price=discoveryUpgradePrice(farm,id);
    const bonus=level*.05;
    get('discovery-up-info-'+id).textContent=id==='slots'?(1+level)+' из 3 слотов':
      id==='speed'?(2900/(1+level*.15)/1000).toFixed(2)+' с':
      'Гарантировано '+(1+Math.floor(bonus))+' находок + '+formatChance(bonus%1*100)+'% на ещё одну.';
    const buy=button('discovery-up-buy-'+id);buy.disabled=level>=discoveryLimit(id)||farm.coins<price;
    buy.textContent=level>=discoveryLimit(id)?'Максимум':'Улучшить · 🪙 '+price;
  }
}
button('debug-unlock-crops').onclick=()=>{
  farm.collection=farm.collection.map(count=>Math.max(1,count));
  commit('Отладка: все культуры открыты.');
};
button('reset-game').onclick=()=>{
  if(discoveryBusy || rolling || !confirm('Удалить весь прогресс, коллекцию и улучшения?'))return;
  try{if(saveFarm({...newFarm(),saveCheats:farm.saveCheats}))reloadFarm();}
  catch(error){console.error('Ферма: не удалось сбросить прогресс',error);}
};
document.querySelectorAll<HTMLDialogElement>('dialog').forEach(dialog=>{
  dialog.addEventListener('click',event=>{
    if(event.target!==dialog || dialog===modal && rolling || dialog===collectionDialog && discoveryBusy)return;
    const r=dialog.getBoundingClientRect();
    if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();
  });
});
