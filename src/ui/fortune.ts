const fortuneDialog=get<HTMLDialogElement>('fortune-dialog');
const fortuneStake=get<HTMLInputElement>('fortune-stake');
const fortuneWheel=document.querySelector<SVGSVGElement>('#fortune-wheel')!;
let selectedWheel:WheelKind='coins';
let spinningFortune=false;
const fortuneResults:Partial<Record<WheelKind,{label:string;chance:number}>>={};
const fortuneStakes:Partial<Record<WheelKind,number>>={};
const fortunePercents:Partial<Record<WheelKind,number>>={};
const svgNamespace='http://www.w3.org/2000/svg';

function fortunePoint(angle:number,radius:number){
  const radians=angle*Math.PI/180;
  return [200+Math.sin(radians)*radius,200-Math.cos(radians)*radius].join(' ');
}
function drawFortuneWheel(svg:SVGSVGElement,prizes:WheelPrize[]){
  svg.replaceChildren();
  let angle=0;
  const boundaries:number[]=[];
  for(const [index,prize] of prizes.entries()){
    const sweep=prize.weight*3.6,end=angle+sweep;
    const sector=document.createElementNS(svgNamespace,'path');
    sector.setAttribute('d','M 200 200 L '+fortunePoint(angle,192)+' A 192 192 0 '+(sweep>180?1:0)+' 1 '+fortunePoint(end,192)+' Z');
    sector.setAttribute('fill',prize.color);
    svg.append(sector);
    if(prize.type==='jackpot'&&svg===fortuneWheel){
      const marker=document.createElementNS(svgNamespace,'path');
      marker.setAttribute('class','fortune-jackpot-marker');
      marker.setAttribute('d','M '+fortunePoint(angle+sweep/2,199)+' L '+fortunePoint(angle+sweep/2,213));
      const title=document.createElementNS(svgNamespace,'title');
      title.textContent='Джекпот';
      marker.append(title);
      svg.append(marker);
      const label=document.createElementNS(svgNamespace,'text');
      const [x,y]=fortunePoint(angle+sweep/2,226).split(' ');
      label.setAttribute('x',x);
      label.setAttribute('y',y);
      label.setAttribute('class','fortune-jackpot-label');
      label.textContent='Джекпот';
      svg.append(label);
    }
    const previous=prizes[(index+prizes.length-1)%prizes.length];
    if(prize.weight>=.4&&previous.weight>=.4)boundaries.push(angle);
    angle=end;
  }
  for(const boundary of boundaries){
    const separator=document.createElementNS(svgNamespace,'path');
    separator.setAttribute('class','fortune-divider');
    separator.setAttribute('d','M 200 200 L '+fortunePoint(boundary,192));
    svg.append(separator);
  }
  const hub=document.createElementNS(svgNamespace,'circle');
  hub.setAttribute('cx','200');hub.setAttribute('cy','200');hub.setAttribute('r','26');
  hub.setAttribute('class','fortune-hub');
  svg.append(hub);
}
function fortuneChance(value:number){
  return value>0&&value<.1?'<0,1':value.toLocaleString('ru-RU',{maximumFractionDigits:1});
}

function chooseFortuneWheel(kind:WheelKind){
  if(spinningFortune)return;
  fortuneStakes[selectedWheel]=fortuneStake.valueAsNumber;
  selectedWheel=kind;
  fortuneStake.value=String(fortuneStakes[kind]||1);
  renderFortune();
}

function renderFortune(){
  const kind=selectedWheel,info=wheelInfo[kind],account=wheelAccount(farm,kind);
  const balance=wheelBalance(farm,kind),percent=fortunePercents[kind];
  if(!spinningFortune&&percent!==undefined)fortuneStake.value=String(Math.min(wheelStakeLimit,Math.max(1,Math.floor(balance*percent/100))));
  const raw=fortuneStake.valueAsNumber;
  const valid=Number.isSafeInteger(raw)&&raw>=1&&raw<=wheelStakeLimit;
  const stake=valid?raw:1;
  const state=wheelState(farm);
  for(const tab of document.querySelectorAll<HTMLButtonElement>('[data-wheel]')){
    tab.setAttribute('aria-pressed',String(tab.dataset.wheel===kind));
    tab.disabled=spinningFortune;
  }
  fortuneStake.disabled=spinningFortune;
  button('fortune-spin').disabled=spinningFortune||!valid||raw>balance||!!state.choice;
  button('fortune-spin').textContent=spinningFortune?'Крутим…':'Крутить · '+info.icon+' '+(valid?number(stake):'—');
  const outcome=get('fortune-result');
  const last=fortuneResults[kind];
  outcome.hidden=spinningFortune||!last;
  if(last&&!spinningFortune)outcome.textContent=last.label+'\nШанс '+fortuneChance(last.chance)+'%';
  if(spinningFortune)return;
  get('fortune-balance').textContent=info.icon+' '+number(balance);
  get('fortune-jackpot').textContent='Джекпот после ставки · '+info.icon+' '+number(Math.floor((account.bank+stake)/10));
  get('fortune-carry').textContent=kind==='diamonds'?'Остаток возврата · '+(account.carry/20).toLocaleString('ru-RU')+' / 1 💎':kind==='orbs'&&state.orbBoost?'Запас двойных орбов · '+number(state.orbBoost):'';
  fortuneWheel.style.transform='';
  const prizes=wheelLayout(farm,kind,stake);
  const jackpotChance=prizes.find(prize=>prize.type==='jackpot')!.weight;
  get('fortune-jackpot').textContent+=' · шанс '+(jackpotChance>0&&jackpotChance<.0001
    ?'<0,0001':jackpotChance.toLocaleString('ru-RU',{maximumFractionDigits:4}))+'%';
  drawFortuneWheel(fortuneWheel,prizes);
  get('fortune-odds').replaceChildren(...[...prizes].sort((a,b)=>b.weight-a.weight).map(prize=>{
    const row=document.createElement('li');
    const swatch=document.createElement('i');
    swatch.style.backgroundColor=prize.color;
    const label=document.createElement('span');
    label.textContent=prize.label+(prize.locked?(prize.weight===.99?' · ставка от '+number(info.minimum):' · награда 0'):'');
    const chance=document.createElement('strong');
    chance.textContent=fortuneChance(prize.weight)+'%';
    row.append(swatch,label,chance);
    return row;
  }));
  const choice=get('fortune-choice');
  choice.replaceChildren();
  if(state.choice){
    const title=document.createElement('p');
    title.textContent='Выбери приз · '+number(state.choice.amount)+' шт.';
    choice.append(title);
    for(const id of state.choice.items){
      const item=materials.find(entry=>entry.id===id)!;
      const control=document.createElement('button');
      control.className='quiet';
      control.textContent=item.icon+' '+item.name;
      control.onclick=()=>{
        const amount=state.choice?.amount??0;
        if(claimFortuneMaterial(farm,id)){
          commit('Получено: '+item.name);
          showIslandEvent('🎡 '+item.icon+' '+item.name+' +'+number(amount));
          renderFortune();
        }
      };
      choice.append(control);
    }
  }
}

for(const kind of wheelKinds){
  const preview=document.createElement('button');
  preview.className='glass fortune-preview';
  const svg=document.createElementNS(svgNamespace,'svg');
  svg.setAttribute('viewBox','0 0 400 400');
  svg.setAttribute('aria-hidden','true');
  drawFortuneWheel(svg,wheelLayout(farm,kind,wheelInfo[kind].reference));
  preview.append(svg,document.createTextNode(wheelInfo[kind].icon+' '+wheelInfo[kind].name));
  preview.onclick=()=>{
    chooseFortuneWheel(kind);
    fortuneDialog.showModal();
  };
  get('shop-fortune').append(preview);
}
for(const tab of document.querySelectorAll<HTMLButtonElement>('[data-wheel]'))tab.onclick=()=>chooseFortuneWheel(tab.dataset.wheel as WheelKind);
for(const percent of [25,50,75,100]){
  const shortcut=document.createElement('button');
  shortcut.type='button';
  shortcut.className='quiet';
  shortcut.textContent=percent+'%';
  shortcut.dataset.fortunePercent=String(percent);
  shortcut.onclick=()=>{
    if(spinningFortune)return;
    fortunePercents[selectedWheel]=percent;
    renderFortune();
  };
  get('fortune-shortcuts').append(shortcut);
}
fortuneStake.oninput=()=>{
  delete fortunePercents[selectedWheel];
  renderFortune();
};
fortuneDialog.oncancel=event=>{if(spinningFortune)event.preventDefault();};
fortuneDialog.addEventListener('click',event=>{
  if(spinningFortune||event.target!==fortuneDialog)return;
  const bounds=fortuneDialog.getBoundingClientRect();
  if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)fortuneDialog.close();
});
get<HTMLFormElement>('fortune-form').onsubmit=async event=>{
  event.preventDefault();
  if(spinningFortune)return;
  const result=spinFortune(farm,selectedWheel,fortuneStake.valueAsNumber);
  if(!result)return;
  const {prizes,index,prize,payout}=result;
  spinningFortune=true;
  fortuneDialog.querySelector<HTMLButtonElement>('.close')!.disabled=true;
  get('fortune-result').textContent='';
  renderFortune();
  saveFarm(farm);
  try{
    const angle=(total(prizes.slice(0,index).map(entry=>entry.weight))+prize.weight/2)*3.6;
    if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
      const destination=360*5+(360-angle);
      await fortuneWheel.animate([
        {transform:'rotate(0deg)',easing:'cubic-bezier(.13,.68,.19,1)'},
        {transform:'rotate('+destination+'deg)',offset:.88},
        {transform:'rotate('+destination+'deg)'}
      ],{duration:3300,fill:'forwards'}).finished;
      fortuneWheel.getAnimations().forEach(animation=>animation.cancel());
    }
  }catch(error){
    console.error('Ферма: ошибка анимации колеса',error);
  }finally{
    spinningFortune=false;
    fortuneDialog.querySelector<HTMLButtonElement>('.close')!.disabled=false;
    const currency=wheelInfo[selectedWheel].icon;
    const fraction=prize.type==='refund'&&selectedWheel==='diamonds'&&payout===0;
    const message=prize.locked||prize.type==='empty'?'Ничего':
      fraction?'Возврат '+prize.amount+'% · в остаток':
      prize.type==='refund'?'Возврат '+prize.amount+'% · '+currency+' +'+number(payout):
      prize.type==='jackpot'?'Джекпот · '+currency+' +'+number(payout):prize.label;
    fortuneResults[selectedWheel]={label:message,chance:prize.weight};
    commit(message);
    showIslandEvent('🎡 '+message);
    renderFortune();
  }
};
