// Purchase batches atomically; holding accelerates without looping over every seed.
const seedPurchasePopover=document.createElement('form');seedPurchasePopover.id='seed-purchase-popover';seedPurchasePopover.className='glass';seedPurchasePopover.setAttribute('popover','manual');seedPurchasePopover.hidden=true;
seedPurchasePopover.innerHTML='<strong id="purchase-name"></strong><div class="purchase-equation"><input type="number" id="purchase-count" min="1" max="1000000000" value="10" aria-label="Количество семян"> × <span id="purchase-unit"></span> = <strong id="purchase-total"></strong></div><button class="primary" id="purchase-confirm">Купить</button><small id="purchase-note"></small>';
seedShop.append(seedPurchasePopover);
let purchaseCrop=-1,purchaseAnchor:HTMLElement|null=null,purchaseHideTimer:ReturnType<typeof setTimeout>|undefined;
let holdPurchase:{crop:number;start:number;last:number;credit:number;timer:ReturnType<typeof setTimeout>|undefined}|null=null;
let suppressPurchaseClickUntil=0;
function stopSeedPurchase(){if(holdPurchase?.timer)clearTimeout(holdPurchase.timer);holdPurchase=null;}
function updatePurchaseQuote(){
 if(purchaseCrop<0)return;const count=get<HTMLInputElement>('purchase-count').valueAsNumber,unit=discountedSeedUnit(farm,purchaseCrop),valid=Number.isSafeInteger(count)&&count>0&&count<=1e9;
 const price=valid?seedPurchaseQuote(farm,purchaseCrop,count):0;
 get('purchase-unit').textContent='🪙 '+unit.toLocaleString('ru-RU',{maximumFractionDigits:3});get('purchase-total').textContent=valid?'🪙 '+number(price):'—';
 button('purchase-confirm').disabled=!valid||price>farm.coins;
 get('purchase-note').textContent=!valid?'Введи целое положительное число':price>farm.coins?'Недостаточно монет':'Удерживай карточку для ускоренной покупки.';
}
function showSeedPurchase(crop:number,anchor:HTMLElement){
 if(!unlocked(farm,crop))return;clearTimeout(purchaseHideTimer);purchaseCrop=crop;purchaseAnchor=anchor;
 get('purchase-name').textContent=crops[crop].symbol+' '+crops[crop].name;updatePurchaseQuote();if(seedPurchasePopover.matches(':popover-open'))seedPurchasePopover.hidePopover();seedPurchasePopover.hidden=false;seedPurchasePopover.showPopover();
 placeContextPopover(seedPurchasePopover,anchor,seedShop);
}
function closeSeedPurchase(){if(seedPurchasePopover.matches(':popover-open'))seedPurchasePopover.hidePopover();seedPurchasePopover.hidden=true;}
function hidePurchaseSoon(){clearTimeout(purchaseHideTimer);purchaseHideTimer=setTimeout(()=>{if(!seedPurchasePopover.matches(':hover')&&!purchaseAnchor?.matches(':hover')&&!seedPurchasePopover.contains(document.activeElement))closeSeedPurchase();},220);}
seedPurchasePopover.onpointerenter=()=>clearTimeout(purchaseHideTimer);seedPurchasePopover.onpointerleave=hidePurchaseSoon;
get('purchase-count').oninput=updatePurchaseQuote;
get('purchase-count').addEventListener('wheel',event=>{event.preventDefault();const input=get<HTMLInputElement>('purchase-count');input.value=String(Math.max(1,Math.min(1e9,(input.valueAsNumber||1)+(event.deltaY<0?1:-1))));updatePurchaseQuote();},{passive:false});
seedPurchasePopover.onsubmit=event=>{event.preventDefault();const input=get<HTMLInputElement>('purchase-count'),count=input.valueAsNumber;if(!Number.isSafeInteger(count)||count<1||count>1e9)return;const bought=buySeeds(farm,purchaseCrop,count);if(bought)commit('Куплено: '+crops[purchaseCrop].name+' ×'+number(bought));updatePurchaseQuote();};
function seedHoldStep(){
 const hold=holdPurchase;if(!hold)return;
 try{
 const now=performance.now(),elapsed=now-hold.start,dt=Math.min(150,now-hold.last);hold.last=now;
 if(elapsed>350){const rate=Math.min(10000,4*2**((elapsed-350)/600));hold.credit+=rate*dt/1000;const count=Math.floor(hold.credit);hold.credit-=count;
 if(count){const bought=buySeeds(farm,hold.crop,count,true);if(!bought){stopSeedPurchase();return;}commit('Куплено: '+crops[hold.crop].name+' ×'+number(bought));updatePurchaseQuote();}}
 hold.timer=setTimeout(seedHoldStep,60);
 }catch(error){stopSeedPurchase();console.error('Ферма: ошибка массовой покупки семян',error);}
}
for(const [i] of crops.entries()){
 const card=button('buy-seed-'+i);
 card.onclick=event=>{if(event.detail>0&&performance.now()<suppressPurchaseClickUntil)return;if(buySeed(farm,i))commit('Куплено семечко: '+crops[i].name);updatePurchaseQuote();};
 card.addEventListener('pointerenter',()=>showSeedPurchase(i,card));card.addEventListener('pointerleave',hidePurchaseSoon);
 card.addEventListener('focus',()=>showSeedPurchase(i,card));
 card.addEventListener('pointerdown',event=>{if(event.button!==0||!event.isPrimary||!unlocked(farm,i))return;event.preventDefault();stopSeedPurchase();
 const bought=buySeeds(farm,i,1);if(!bought)return;commit('Куплено семечко: '+crops[i].name);suppressPurchaseClickUntil=Infinity;
 const now=performance.now();holdPurchase={crop:i,start:now,last:now,credit:0,timer:undefined};seedHoldStep();
 });
}
function releaseSeedPurchase(){if(holdPurchase||suppressPurchaseClickUntil===Infinity)suppressPurchaseClickUntil=performance.now()+350;stopSeedPurchase();}
window.addEventListener('pointerup',releaseSeedPurchase);window.addEventListener('pointercancel',releaseSeedPurchase);window.addEventListener('blur',()=>{releaseSeedPurchase();closeSeedPurchase();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseSeedPurchase();});
seedShop.addEventListener('close',()=>{releaseSeedPurchase();closeSeedPurchase();});seedShop.addEventListener('scroll',()=>{closeSeedPurchase();});
window.addEventListener('resize',()=>{closeSeedPurchase();});

document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!seedPurchasePopover.hidden){event.preventDefault();closeSeedPurchase();releaseSeedPurchase();}});
// All modal titles use the same pinned glass header, including compact dialogs.
for(const dialog of document.querySelectorAll<HTMLDialogElement>('dialog')){
 if(dialog.querySelector(':scope > .window-heading, :scope > .basket-heading'))continue;
 const title=dialog.querySelector<HTMLElement>(':scope > .detail-heading, :scope > h2');if(!title)continue;
 const heading=document.createElement('div');heading.className='window-heading';
 const close=dialog.querySelector(':scope > form[method="dialog"]');
 dialog.insertBefore(heading,dialog.firstChild);heading.append(title);if(close)heading.append(close);const kicker=dialog.querySelector(':scope > .kicker');if(kicker)heading.prepend(kicker);
 if(title.tagName==='H2')title.classList.add('glass','basket-chip');
}

// Use the same rarity and growth order as the collection and pack odds.
for(const i of crops.map((_,i)=>i).sort((a,b)=>cropTiers[a]-cropTiers[b]||cropTimes[a]-cropTimes[b]))get('shop-seeds').append(button('buy-seed-'+i));

const settingsDialog=get<HTMLDialogElement>('settings-dialog');
button('settings-open').onclick=()=>{if(!settingsDialog.open)settingsDialog.showModal();};
settingsDialog.addEventListener('click',event=>{if(event.target!==settingsDialog)return;const r=settingsDialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)settingsDialog.close();});


