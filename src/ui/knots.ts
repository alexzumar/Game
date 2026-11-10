const knotDialog=document.createElement('dialog');
knotDialog.id='knots-dialog';
knotDialog.className='glass';
knotDialog.setAttribute('aria-labelledby','knots-title');
knotDialog.innerHTML='<div class="window-heading"><h2 id="knots-title">🌿 Узелки</h2><form method="dialog"><button class="quiet close" aria-label="Закрыть">×</button></form><div class="knot-stocks"></div></div><div class="knot-board"></div>';
document.body.append(knotDialog);
knotDialog.addEventListener('click',event=>{
  if(event.target!==knotDialog)return;
  const bounds=knotDialog.getBoundingClientRect();
  if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)knotDialog.close();
});
function knotCost(price:{id:string;count:number}[]){
  return price.map(({id,count})=>materialsBySaveKey.get(id)!.icon+' '+number(count)).join(' + ');
}
function createKnotExchange(set:number,trigger:HTMLButtonElement){
  const panel=document.createElement('section');
  panel.id='knot-exchange-'+set;
  panel.className='glass knot-exchange';
  panel.setAttribute('popover','auto');
  panel.setAttribute('aria-label','Обмен · '+cropSets[set].name);
  panel.innerHTML='<button type="button" class="quiet knot-exchange-target" aria-expanded="false"></button><div class="knot-exchange-options" hidden></div><p class="knot-exchange-cost"></p><div class="knot-exchange-quantity"><label>Количество <input type="number" min="1" step="1" value="1"></label><button type="button" class="quiet">Максимум</button></div><button type="button" class="quiet wide knot-exchange-confirm">Обменять</button>';
  trigger.setAttribute('aria-controls',panel.id);
  trigger.setAttribute('aria-expanded','false');
  const targetButton=panel.querySelector<HTMLButtonElement>('.knot-exchange-target')!;
  const options=panel.querySelector<HTMLElement>('.knot-exchange-options')!;
  const cost=panel.querySelector<HTMLElement>('.knot-exchange-cost')!;
  const quantity=panel.querySelector<HTMLInputElement>('input')!;
  const max=panel.querySelector<HTMLButtonElement>('.knot-exchange-quantity button')!;
  const confirm=panel.querySelector<HTMLButtonElement>('.knot-exchange-confirm')!;
  let target=-1;
  let closeTimer:ReturnType<typeof setTimeout>;
  const isOpen=()=>panel.matches(':popover-open');
  const close=()=>{if(isOpen())panel.hidePopover();};
  const render=()=>{
    const limit=knotExchangeLimit(farm,set,target);
    const count=quantity.valueAsNumber;
    const validCount=Number.isSafeInteger(count)&&count>=1;
    const price=knotExchangePrice(farm,set,target);
    const material=materialsBySaveKey.get(knotMaterials[set][target]);
    quantity.max=String(limit);
    quantity.disabled=!price;
    max.disabled=limit===0;
    confirm.disabled=!validCount||count>limit;
    targetButton.textContent=material?material.icon+' × '+(validCount?number(count):'—'):'Выбрать материал';
    targetButton.setAttribute('aria-label',material?material.name+' · '+targetButton.textContent+' · сменить материал':'Выбрать материал');
    const batch=validCount?knotExchangePrice(farm,set,target,count):null;
    cost.textContent=batch?'Нужно '+knotCost(batch):
      price?'Введи количество.':'Выбери материал открытой культуры.';
  };
  const place=()=>{
    const anchor=trigger.getBoundingClientRect();
    const width=Math.min(280,innerWidth-20);
    panel.style.width=width+'px';
    panel.style.left=Math.max(10,Math.min(anchor.left+(anchor.width-width)/2,innerWidth-width-10))+'px';
    const top=anchor.bottom+8;
    panel.style.top=top+'px';
    panel.style.maxHeight=Math.max(0,innerHeight-top-10)+'px';
  };
  const open=()=>{
    clearTimeout(closeTimer);
    if(!knotDialog.open||trigger.disabled||isOpen())return;
    options.hidden=true;
    targetButton.setAttribute('aria-expanded','false');
    render();
    place();
    panel.showPopover();
  };
  const closeSoon=()=>{closeTimer=setTimeout(()=>{
    if(!panel.matches(':focus-within'))close();
  },180);};
  trigger.addEventListener('pointerenter',event=>{if(event.pointerType!=='touch')open();});
  trigger.addEventListener('pointerleave',closeSoon);
  trigger.onclick=()=>{open();targetButton.focus({preventScroll:true});};
  panel.addEventListener('pointerenter',()=>clearTimeout(closeTimer));
  panel.addEventListener('pointerleave',closeSoon);
  panel.addEventListener('focusout',event=>{
    if(!panel.contains(event.relatedTarget as Node|null)&&event.relatedTarget!==trigger)closeSoon();
  });
  panel.addEventListener('toggle',()=>trigger.setAttribute('aria-expanded',String(isOpen())));
  knotDialog.addEventListener('scroll',()=>{if(isOpen())place();});
  window.addEventListener('resize',()=>{if(isOpen())place();});
  knotDialog.addEventListener('close',close);
  targetButton.onclick=()=>{
    options.hidden=!options.hidden;
    targetButton.setAttribute('aria-expanded',String(!options.hidden));
    if(options.hidden)return;
    options.replaceChildren();
    knotMaterials[set].forEach((id,tier)=>{
      if(!knotExchangePrice(farm,set,tier))return;
      const material=materialsBySaveKey.get(id)!;
      const option=document.createElement('button');
      option.type='button';
      option.className='quiet';
      option.textContent=material.icon+' '+material.name;
      option.onclick=()=>{
        target=tier;
        quantity.value='1';
        options.hidden=true;
        targetButton.setAttribute('aria-expanded','false');
        targetButton.focus({preventScroll:true});
        render();
      };
      options.append(option);
    });
    if(!options.childElementCount)options.textContent='В этом наборе пока нет открытых культур.';
  };
  quantity.oninput=render;
  max.onclick=()=>{quantity.value=quantity.max;render();};
  confirm.onclick=()=>{
    const count=quantity.valueAsNumber;
    if(!exchangeKnotMaterial(farm,set,target,count)){render();return;}
    const material=materialsBySaveKey.get(knotMaterials[set][target])!;
    showIslandEvent(material.icon+' '+material.name+' +'+number(count));
    commit();
    renderKnots();
    quantity.value='1';
    render();
  };
  return panel;
}
const knotOpen=document.createElement('button');
knotOpen.id='knots-open';
knotOpen.className='quiet wide';
knotOpen.textContent='🌿 Узелки';
knotOpen.onclick=()=>{renderKnots();knotDialog.showModal();};
button('upgrades-open').before(knotOpen);

const knotEffects=[
  ['Удача пакетов · повышает шанс получить культуру редкости пакета.',
   'Дружный сбор · даёт шанс получить вторую порцию урожая.',
   'Выручка с грядки · приносит монеты сразу при сборе.',
   'Глубокие корни · при сборе обычного урожая есть отдельный шанс найти материал этой культуры, даже если обычная добыча ничего не дала.'],
  ['Щедрая находка · даёт шанс удвоить выпавшие орбы.',
   'Чистая добыча · повышает шанс найти материал культуры.',
   'Обмен находок · сдаёшь материалы трёх культур одного набора и получаешь материал четвёртой. Целевую культуру сначала нужно открыть.',
   'Крупная находка · при выпадении материала он может прийти пачкой. Прокачка повышает шанс пачки и её размер.'],
  ['Семя в запас · даёт шанс вернуть семя при сборе.',
   'Удачная продажа · даёт шанс продать плод с наценкой.',
   'Катализатор партии · усиливает выход семян в длинных партиях.',
   'Солнечная отдача · даёт порцию плодов до основного сбора в ясную погоду.'],
  ['Общий сбор · урожай приближает денежную премию.',
   'Стручок в пакете · повтор открытой культуры может дать её семена.',
   'Досрочный урожай · посадка может созреть раньше срока.',
   'Второй оборот · после сбора обычная культура может сразу начать новый цикл с половины шкалы роста, без расхода семени.']
];
const knotNames=[
  ['Удача','Дружность','Выручка','Корни'],
  ['Щедрость','Добыча','Обмен','Изобилие'],
  ['Запас','Наценка','Катализ','Солнце'],
  ['Премия','Стручок','Рывок','Оборот']
];

// The four sculptures in the artwork run from celery on the left to carrot on the right.
const knotColumns=[3,1,2,0].map(set=>{
  const stock=document.createElement('div');
  stock.className='knot-stock';
  stock.setAttribute('aria-label',cropSets[set].name);
  const amounts=document.createElement('div');
  amounts.className='knot-stock-amounts';
  const heading=document.createElement('strong');
  heading.className='knot-stock-name';
  heading.textContent=cropSets[set].name;
  const exchange=document.createElement('button');
  exchange.type='button';
  exchange.className='quiet';
  exchange.textContent='Обменять материалы';
  stock.append(heading,amounts,exchange,createKnotExchange(set,exchange));
  knotDialog.querySelector('.knot-stocks')!.append(stock);
  const column=document.createElement('section');
  column.className='knot-column';
  column.setAttribute('aria-label',cropSets[set].name);
  knotDialog.querySelector('.knot-board')!.append(column);
  const nodes=[3,2,1,0].map(tier=>{
    const crop=crops[cropSets[set].crops[tier]];
    const node=document.createElement('button');
    node.type='button';
    node.className='glass panel knot-node';
    const icon=document.createElement('span');
    icon.className='knot-icon';icon.textContent=crop.symbol;
    icon.setAttribute('aria-hidden','true');
    const progress=document.createElement('span');
    const name=document.createElement('span');
    name.className='knot-name';
    name.textContent=knotNames[set][tier];
    const label=document.createElement('strong');
    const dots=document.createElement('span');
    dots.className='knot-dots';dots.setAttribute('aria-hidden','true');
    if(tier<3)for(let i=0;i<5;i++)dots.append(document.createElement('i'));
    progress.append(name,label,dots);node.append(icon,progress);
    const tip=document.createElement('span');
    tip.id='knot-help-'+set+'-'+tier;
    tip.className='upgrade-tooltip knot-tooltip';tip.setAttribute('role','tooltip');
    const title=document.createElement('strong');
    title.className='upgrade-tooltip-title';title.textContent=crop.symbol+' '+crop.name;
    const body=document.createElement('span');
    tip.append(title,body);
    node.setAttribute('aria-describedby',tip.id);
    column.append(node,tip);
    bindUpgradeTooltip(node,tip,()=>{
      const next=column.nextElementSibling;
      const neighbor=next&&next.getBoundingClientRect().right<=innerWidth-10?next:column.previousElementSibling??next;
      const bounds=(neighbor??column).getBoundingClientRect();
      const board=column.parentElement!.getBoundingClientRect();
      return new DOMRect(bounds.left,board.top+board.height*.07,bounds.width,board.height*.88);
    });
    node.onclick=()=>{
      if(!buyKnotRank(farm,set,tier))return;
      commit(crop.name+' · уровень '+knotRank(farm,set,tier));
      renderKnots();
    };
    return {tier,crop,node,label,dots,body};
  });
  return {set,amounts,exchange,nodes};
});

const knotEffectUnits=[
  ['от шкалы удачи пакетов (100 ур.)','шанс удвоить урожай','от цены урожая монетами','шанс дополнительно найти материал'],
  ['шанс удвоить орбы','к шансу добыть материал','скидка на наценку обмена','шанс получить пачку материалов'],
  ['шанс вернуть семя','шанс продать на 50% дороже','шанс получить лишнее семя после первого плода','доля обычного урожая в ясную погоду'],
  ['от цены каждых 20 плодов монетами','шанс получить два семени за повтор','шанс созреть на середине роста','шанс начать новый цикл с половины роста']
];
const knotPercent=new Intl.NumberFormat('ru',{style:'percent',maximumFractionDigits:2});
function renderKnots(){
  for(const {set,amounts,exchange,nodes} of knotColumns){
    exchange.disabled=!knotEffect(farm,1,2);
    exchange.title=exchange.disabled?'Открой «Обмен» в ветке чеснока и капусты.':'';
    amounts.replaceChildren(...knotMaterials[set].map(id=>{
      const material=materialsBySaveKey.get(id)!;
      const item=document.createElement('span');
      item.title=material.name;
      item.textContent=material.icon+' '+number(farm.resources.items[id]??0);
      return item;
    }));
    for(const {tier,crop,node,label,dots,body} of nodes){
      const rank=knotRank(farm,set,tier),price=knotPrice(farm,set,tier);
      const locked=tier>0&&knotRank(farm,set,tier-1)<5;
      const affordable=!!price&&price.every(({id,count})=>(farm.resources.items[id]??0)>=count);
      label.textContent=(locked?'🔒 ':'')+'Ур. '+(rank||1);
      node.dataset.locked=String(locked);
      node.dataset.active=String(!locked);
      node.setAttribute('aria-disabled',String(!affordable));
      node.setAttribute('aria-label',crop.name+' · '+(rank?'уровень '+rank:'ещё не улучшено'));
      [...dots.children].forEach((dot,index)=>dot.classList.toggle('filled',index<rank));
      const description=document.createElement('p');
      description.textContent=knotEffects[set][tier];
      const levels=document.createElement('p');
      renderUpgradeChange(levels,rank,rank?'ранг сохранён':'бонус ещё не открыт',
        price?'следующий ранг':undefined);
      const effects=document.createElement('span');
      effects.className='knot-effect-list';
      for(let index=0;index<=tier;index++){
        const current=knotEffect(farm,set,index);
        if(!current&&index!==tier)continue;
        const next=price?knotEffect(farm,set,index,tier):current;
        const line=document.createElement('span');
        const name=document.createElement('strong');
        name.textContent=crops[cropSets[set].crops[index]].name+' · ';
        const change=document.createElement('b');
        const scale=set===0&&index===0?100:1;
        change.textContent=next!==current?' → '+knotPercent.format(next/scale):'';
        line.append(name,knotPercent.format(current/scale),change,' '+knotEffectUnits[set][index]);
        if(set===1&&index===3&&(current||next)){
          const rank=knotRank(farm,set,index);
          const size=rank?knotBundleSize(rank):0;
          const nextSize=price&&tier===index?knotBundleSize(rank+1):size;
          line.append(' · пачка '+size+(nextSize!==size?' → '+nextSize:''));
        }
        effects.append(line);
      }
      const requirement=document.createElement('p');
      requirement.className='knot-tooltip-price';
      if(price){
        requirement.append('Вложить для прокачки');
        price.forEach(({id,count})=>{
          const item=document.createElement('span');
          item.classList.toggle('knot-cost-missing',(farm.resources.items[id]??0)<count);
          const material=materialsBySaveKey.get(id)!;
          item.textContent=material.icon+' '+material.name+' · '+number(count);
          requirement.append(item);
        });
        if(!affordable)requirement.append(' Материалов пока не хватает.');
      }else{
        requirement.textContent=locked?'Сначала улучши «'+knotNames[set][tier-1]+'» до 5-го уровня.':'Достигнут 5-й уровень.';
      }
      body.replaceChildren(description,levels,effects,requirement);
    }
  }
}
