var packsUiReady=true;
let selectedOpeningCount=1;
let packKnownBefore:boolean[]|null=null;
const openAgain=document.createElement('button');openAgain.id='pack-open-again';openAgain.className='primary';packDone.before(openAgain);packDone.classList.remove('primary');packDone.classList.add('quiet');openAgain.onclick=()=>button('open-pack').click();
const preciseChance=(value:number)=>value>0&&value<.00001?value.toExponential(2):value.toLocaleString('ru-RU',{maximumFractionDigits:6});
const packCostText=(offer:{coins:number;orbs:number;items:Record<string,number>})=>[
 offer.coins?'🪙 '+number(offer.coins):'',offer.orbs?'🔮 '+number(offer.orbs):'',...Object.entries(offer.items).map(([id,n])=>(materials.find(item=>item.id===id)?.icon??'✦')+' '+number(n))].filter(Boolean).join(' · ');
function canPayPackOffer(offer:{coins:number;orbs:number;items:Record<string,number>;condition:boolean;max?:boolean}){return !offer.max&&offer.condition&&farm.coins>=offer.coins&&farm.resources.orbs>=offer.orbs&&Object.entries(offer.items).every(([id,n])=>(farm.resources.items[id]??0)>=n);}
for(const buttonElement of document.querySelectorAll<HTMLButtonElement>('[data-pack-count]'))buttonElement.onclick=()=>{selectedOpeningCount=Number(buttonElement.dataset.packCount);renderPackWorkshop();};
const packUpgradeLabels:Record<PackUpgrade,string>={speed:'⚡ Скорость открытия',slots:'🎰 Слоты открытия',refund:'↩ Возврат за повторки'};
for(const id of ['speed','slots','refund'] as const){const panel=document.createElement('section');panel.className='glass panel';const heading=document.createElement('h2');heading.textContent=packUpgradeLabels[id];const detail=document.createElement('p');detail.id='pack-upgrade-'+id;const buy=document.createElement('button');buy.className='quiet';buy.id='pack-buy-'+id;buy.onclick=()=>{if(id==='refund'&&farm.packProgress.refund>=3&&!farm.packProgress.refundGate){if(unlockPackGate(farm,'refund'))commit('Барьер возврата открыт.');return;}if(buyPackUpgrade(farm,id))commit('Улучшение мешков куплено.');};panel.append(heading,detail,buy);get('pack-upgrade-list').append(panel);}
for(const kind of ['luck'] as const){const panel=document.createElement('section');panel.className='glass panel';panel.innerHTML='<h2>'+('🍀 Предел легендарной удачи')+'</h2><p id="pack-gate-'+kind+'"></p><button class="quiet" id="pack-gate-buy-'+kind+'"></button>';get('pack-upgrade-list').append(panel);button('pack-gate-buy-'+kind).onclick=()=>{if(unlockPackGate(farm,kind))commit('Барьер мешков открыт.');};}
button('starter-rescue').onclick=()=>{if(rescueStarterSeed(farm))commit('Стартовое семя редиса восстановлено.');};
function renderPackWorkshop(){
 const pack=seedPacks[selectedPack],limit=packSlotLimit(farm);selectedOpeningCount=Math.min(limit,selectedOpeningCount);
 for(const control of document.querySelectorAll<HTMLButtonElement>('[data-pack-count]')){const count=Number(control.dataset.packCount);control.disabled=count>limit||rolling;control.setAttribute('aria-pressed',String(count===selectedOpeningCount));control.title=count>limit?'Открой дополнительные слоты в улучшениях мешков':count+' одновременных открытий';}
 if(pack){for(const i of crops.map((_,i)=>i).sort((a,b)=>cropTiers[a]-cropTiers[b]||cropTimes[a]-cropTimes[b])){const row=get('odds-'+i);row.parentElement!.append(row);}const odds=openingOdds(farm,selectedPack),target=total(odds.filter((_,i)=>cropTiers[i]===selectedPack)),price=packOpeningPrice(selectedPack,selectedOpeningCount);
 get('pack-note').textContent='Открытие вида · первое выпадение дарит 1 семя · целевая редкость: '+preciseChance(target)+'%';
 get('pack-price-total').textContent=selectedOpeningCount+' '+(selectedOpeningCount===1?'открытие':selectedOpeningCount<5?'открытия':'открытий')+' · итог 🪙 '+number(price)+(selectedOpeningCount>1?' · скидка 25%':'');
 button('open-pack').textContent='Открыть '+selectedOpeningCount+' · 🪙 '+number(price);openAgain.textContent='Открыть ещё '+selectedOpeningCount+' · 🪙 '+number(price);openAgain.disabled=rolling||!!farm.packProgress.pending||farm.coins<price;button('open-pack').disabled=rolling||!!farm.packProgress.pending||farm.coins<price;
 crops.forEach((crop,i)=>{const row=get('odds-'+i);row.hidden=odds[i]<=0;row.textContent=(unlocked(farm,i)?crop.symbol+' '+crop.name:'❔ Неизвестно · '+baseRarityNames[cropTiers[i]])+' · '+preciseChance(odds[i])+'%';row.classList.toggle('unknown-crop',!unlocked(farm,i));});}
 seedPacks.forEach((_,i)=>{get('pack-card-note-'+i).textContent='Упор: '+['обычные','редкие','эпические','легендарные'][i];});
 const chosen=Math.max(0,selectedPack),odds=openingOdds(farm,chosen),target=total(odds.filter((_,i)=>cropTiers[i]===chosen));
 get('luck-preview').textContent='Уровень '+farm.luck+' · '+seedPacks[chosen].name+': '+preciseChance(target)+'% своей редкости.';
 button('buy-luck').disabled=farm.coins<luckPrice(farm.luck);button('buy-luck').textContent='🪙 '+number(luckPrice(farm.luck));
 for(const id of ['speed','slots','refund'] as const){const level=farm.packProgress[id],blocked=id==='refund'&&level>=3&&!farm.packProgress.refundGate,offer=blocked?packGateOffer(farm,'refund'):packUpgradeOffer(farm,id);
 get('pack-upgrade-'+id).textContent=id==='speed'?'Уровень '+level+' · '+(packOpeningTime(farm)/1000).toLocaleString('ru-RU')+' с · минимум 0,5 с':id==='slots'?limit+' из 5 слотов.':'Уровень '+level+' · '+packRefundRate(farm)+'% за повторку редкости мешка, 5% за остальные.';
 if(id==='slots'&&limit===4&&!offer.condition){
   const missing=[];
   if(farm.size<8)missing.push('поле 8×8');
   const opened=farm.collection.filter(Boolean).length;
   if(opened<crops.length)missing.push('все виды семян ('+opened+'/'+crops.length+')');
   get('pack-upgrade-slots').textContent+=' Для пятого слота нужны '+missing.join(' и ')+'.';
 }
 button('pack-buy-'+id).disabled=!canPayPackOffer(offer);button('pack-buy-'+id).textContent=offer.max?'Максимум':packCostText(offer);}
 for(const kind of ['luck'] as const){const offer=packGateOffer(farm,kind),max=kind==='luck'?farm.packProgress.luckGate>=2:farm.packProgress.refundGate;
 get('pack-gate-'+kind).textContent=kind==='refund'?'Открывает возврат выше 20%. Достигни возврата 20% и внеси материалы.':farm.packProgress.luckGate===0?'Следующий предел: 2% легендарных суммарно. Требуются все 16 видов.':'Следующий предел: 5% легендарных суммарно. Требуются поле 8×8, все виды и 100 000 собранных плодов.';
 button('pack-gate-buy-'+kind).textContent=max?'Максимум':packCostText(offer);button('pack-gate-buy-'+kind).disabled=max||!canPayPackOffer(offer);}
 button('starter-rescue').hidden=!needsStarterRescue(farm);
 applyPlantGlows();
 if(typeof segmentedTracks!=='undefined')updateSegmentedTabs();
}
async function showPackOpening(results:number[]){
 const duration=packOpeningTime(farm),pool=crops.map((_,i)=>i),reels=get('reels'),summary=get('pack-summary'),grid=get('pack-results');
 summary.hidden=false;summary.style.visibility='hidden';grid.replaceChildren();if(duration===0){reels.replaceChildren();reels.hidden=true;return;}reels.hidden=false;
 const tracks=results.map(crop=>createReel(crop,pool,false));reels.replaceChildren(...tracks.map(item=>item.reel));
 await Promise.all(tracks.map(({track})=>spinReel(track,duration)));
}
function showPackOutcome(outcome:NonNullable<ReturnType<typeof finishPackOpening>>){
 const grid=get('pack-results'),grouped=new Map<number,{count:number;first:boolean}>();
 for(const entry of outcome.entries){const group=grouped.get(entry.crop)??{count:0,first:false};group.count++;group.first||=entry.first;grouped.set(entry.crop,group);}
 grid.replaceChildren(...[...grouped].map(([crop,data])=>{const item=resultCard(crop,data.count);const label=document.createElement('small');label.textContent=data.first?'Новый вид · подарочное семя ×1':'Повторка · 🔮 '+number(data.count*orbRewards[cropTiers[crop]]);item.card.append(label);return item.card;}));
 get('reels').hidden=false;get('pack-summary').hidden=false;get('pack-summary').style.visibility='visible';
 const outcomeTitle=[...grouped].map(([crop,data])=>crops[crop].symbol+' '+crops[crop].name+' ×'+data.count).join(' · ');get('pack-opening-title').textContent=outcomeTitle;get('pack-opening-title').title=outcomeTitle;
 outcome.entries.forEach((entry,i)=>{const track=get('reels').children[i]?.querySelector('.reel-track');if(track){const old=track.children[reelFinish];if(old){const revealed=reelItem(entry.crop);cropArt(revealed.children[0] as HTMLElement,entry.crop,'stage-4',crops[entry.crop].symbol);revealed.children[1].textContent=crops[entry.crop].name;old.replaceWith(revealed);}}});
 get('pack-summary-title').textContent=outcome.newKinds?'Новых видов: '+outcome.newKinds:'Повторные находки';
 packNote.textContent='🔮 +'+number(outcome.orbs)+' · возврат 🪙 '+number(outcome.returned)+(outcome.newKinds?' · подарочных семян '+outcome.newKinds:'')+'. Мелкий остаток возврата копится до целой монеты.';
}
button('open-pack').onclick=async()=>{
 if(rolling||selectedPack<0)return;rolling=true;skipRoll=false;lastPackPress=-Infinity;packDone.classList.add('skip-ready');
 try{
 packKnownBefore=farm.collection.map(Boolean);const results=openPack(farm,selectedPack,selectedOpeningCount);if(!results.length)return;
 saveFarm(farm);get('pack-opening-title').textContent='Открываем пакет…';get('pack-opening-title').removeAttribute('title');get('pack-summary').hidden=false;get('pack-summary').style.visibility='hidden';get('pack-results').replaceChildren();packNote.textContent='Открываем виды… Двойное нажатие пропускает анимацию.';
 if(!modal.open)modal.showModal();render();await showPackOpening(results);
 const outcome=finishPackOpening(farm);if(outcome){showPackOutcome(outcome);commit('Мешки открыты: '+outcome.newKinds+' новых видов, 🔮 +'+outcome.orbs+', возврат 🪙 '+outcome.returned);}
 }catch(error){console.error('Ферма: ошибка открытия мешков',error);const outcome=finishPackOpening(farm);if(outcome){showPackOutcome(outcome);commit('Результаты открытия сохранены.');}}
 finally{rolling=false;packKnownBefore=null;packDone.classList.remove('skip-ready');render();}
};
// Group large harvests into a few flights, preserving the exact reward counts.
let lootPulse:Animation|undefined;
function animateCollectedLoot(tile:Element,before:{diamonds:number;orbs:number;items:Record<string,number>}){
 if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 try{const origin=tile.getBoundingClientRect(),target=get('resources-open'),bounds=target.getBoundingClientRect();
 const rewards:{icon:string;amount:number}[]=[];if(farm.resources.orbs>before.orbs)rewards.push({icon:'🔮',amount:farm.resources.orbs-before.orbs});
 const diamonds=(farm.diamonds?.balance??0)-before.diamonds;if(diamonds>0)animateDiamondPickup(origin,diamonds);
 for(const material of materials){const count=(farm.resources.items[material.id]??0)-(before.items[material.id]??0);if(count>0)rewards.push({icon:material.icon,amount:count});}
 for(const [i,reward] of rewards.entries()){
 const flight=document.createElement('span');flight.className='harvest-flight loot-flight';flight.textContent=reward.icon+' +'+number(reward.amount);flight.setAttribute('aria-hidden','true');document.documentElement.append(flight);
 const x=origin.left+origin.width/2,y=origin.top+origin.height/2;flight.style.left=x+'px';flight.style.top=y+'px';
 const animation=flight.animate([{transform:'translate(-50%,-50%) scale(.8)',opacity:0},{transform:'translate(-50%,-65%) scale(1)',opacity:1,offset:.15},{transform:'translate(calc(-50% + '+(bounds.left+bounds.width/2-x)+'px),calc(-50% + '+(bounds.top+bounds.height/2-y)+'px)) scale(.5)',opacity:.75}],{duration:650,delay:i*65,easing:'cubic-bezier(.22,.6,.4,1)'});
 const cleanupTimer=setTimeout(()=>{animation.cancel();flight.remove();},900+i*65);
 animation.oncancel=()=>{clearTimeout(cleanupTimer);flight.remove();};animation.onfinish=()=>{clearTimeout(cleanupTimer);flight.remove();lootPulse?.cancel();lootPulse=target.animate([{transform:'scale(1)'},{transform:'scale(1.07)',offset:.45},{transform:'scale(1)'}],{duration:300,easing:'ease-out'});};
 }
 }catch(error){console.error('Ферма: ошибка перелёта ресурсов в коллекцию',error);}
}
renderPackWorkshop();



function animateDiamondPickup(origin:DOMRect,amount:number){
  const field=get('field').getBoundingClientRect();
  const target=get('diamond-balance').parentElement!;
  const counter=target.getBoundingClientRect();
  const x=origin.left+origin.width/2,y=origin.top+origin.height/2;
  const flight=document.createElement('span');
  flight.className='diamond-flight';
  flight.setAttribute('aria-hidden','true');
  flight.textContent=amount>1?'💎 ×'+number(amount):'💎';
  flight.style.left=x+'px';
  flight.style.top=y+'px';
  const pose=(bounds:DOMRect,scale:number)=>
    'translate(calc(-50% + '+(bounds.left+bounds.width/2-x)+'px),calc(-50% + '+(bounds.top+bounds.height/2-y)+'px)) scale('+scale+')';
  document.documentElement.append(flight);
  try{
    const animation=flight.animate([
      {transform:pose(origin,.45),opacity:0},
      {transform:pose(origin,.85),opacity:1,offset:.12,easing:'ease-in-out'},
      {transform:pose(field,2.35),opacity:1,offset:.55},
      {transform:pose(field,2.15),opacity:1,offset:.72,easing:'ease-in'},
      {transform:pose(counter,.28),opacity:.15}
    ],{duration:1450});
    animation.onfinish=()=>{
      flight.remove();
      target.animate([{scale:'1'},{scale:'1.18'},{scale:'1'}],{duration:260});
    };
    animation.oncancel=()=>flight.remove();
  }catch(error){
    flight.remove();
    console.error('Ферма: ошибка анимации алмаза',error);
  }
}
