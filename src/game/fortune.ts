const wheelKinds=['coins','orbs','diamonds'] as const;
type WheelKind=typeof wheelKinds[number];
type WheelPrize={label:string;weight:number;color:string;amount?:number;item?:string;crop?:number;locked?:boolean;choices?:string[];type:'empty'|'refund'|'item'|'seed'|'boost'|'choice'|'jackpot'};
type WheelAccount={seed:number;bank:number;carry:number};
type WheelState={accounts:Partial<Record<WheelKind,WheelAccount>>;orbBoost:number;choice?:{items:string[];amount:number}};
const wheelInfo={
  coins:{icon:'🪙',name:'Монеты',minimum:100000,reference:1000000},
  orbs:{icon:'🔮',name:'Орбы',minimum:250,reference:2500},
  diamonds:{icon:'💎',name:'Алмазы',minimum:5,reference:20}
};
const wheelStakeLimit=1_000_000_000_000;
function wheelMaterialAmount(stake:number,unit:number){
  if(stake<unit)return 0;
  return Math.floor(1+Math.log10(stake/unit));
}
const wheelState=(farm:Farm):WheelState=>farm.wheels??={accounts:{},orbBoost:0};
const wheelSeed=(random=Math.random)=>Math.floor(random()*2**32);
function wheelAccount(farm:Farm,kind:WheelKind){
  return wheelState(farm).accounts[kind]??={seed:(farm.epoch+Math.imul(wheelKinds.indexOf(kind)+1,2654435761))>>>0,bank:0,carry:0};
}
function wheelBalance(farm:Farm,kind:WheelKind){
  if(kind==='coins')return farm.coins;
  if(kind==='orbs')return farm.resources.orbs;
  return farm.diamonds?.balance??0;
}
function wheelLayout(farm:Farm,kind:WheelKind,stake:number):WheelPrize[]{
  const account=wheelAccount(farm,kind),info=wheelInfo[kind],unit=info.icon;
  let seed=account.seed;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
  const returns=[{percent:50,weight:4},{percent:100,weight:2},{percent:150,weight:1}];
  const weightTotal=total(returns.map(result=>result.weight));
  const materialPool=[...new Set(crops.flatMap((_,crop)=>unlocked(farm,crop)?Object.keys(basePowers[crop]).map(propertyMaterialId):[]))];
  const itemAt=(index:number)=>materialPool[(Math.floor(random()*materialPool.length)+index)%materialPool.length]??'property:growth';
  const itemPrize=(item:string,amount:number,weight:number,color:string):WheelPrize=>{
    const material=materials.find(entry=>entry.id===item)!;
    return {type:'item',item,amount,weight,color,label:material.icon+' '+material.name+' ×'+amount,locked:amount===0};
  };
  const bank=account.bank/10;
  const jackpotBase=.1+.1/(1+bank/info.reference);
  const jackpot=jackpotBase*Math.min(1,stake/info.reference);
  const rareLocked=stake<info.minimum;
  const rareWeight=.99;
  const colors=['#8bd2ad','#66a6d7','#626dc5'];
  const refundColors:Record<number,string>={50:'#df9664',100:'#d46281',150:'#884daa'};
  let regular:WheelPrize[],rare:WheelPrize;
  if(kind==='coins'){
    const common=crops.map((_,i)=>i).filter(i=>cropTiers[i]===0&&unlocked(farm,i));
    const crop=common[Math.floor(random()*common.length)]??0,amount=Math.floor(stake/100);
    regular=[
      {type:'seed',crop,amount,locked:amount===0,weight:7,color:colors[0],label:crops[crop].symbol+' Семена · '+crops[crop].name+' ×'+amount},
      itemPrize(itemAt(0),wheelMaterialAmount(stake,5000),4,colors[1]),
      itemPrize(itemAt(1),wheelMaterialAmount(stake,3000),3,colors[2])
    ];
    rare={...itemPrize('duplication',Math.max(1,Math.floor(stake/info.minimum)),rareWeight,'#b381d9'),locked:rareLocked};
  }else if(kind==='orbs'){
    regular=[
      itemPrize('set0',wheelMaterialAmount(stake,40),7,colors[0]),
      itemPrize('set1',wheelMaterialAmount(stake,60),4,colors[1]),
      itemPrize(random()<.25?'set3':'set2',wheelMaterialAmount(stake,100),3,colors[2])
    ];
    rare={type:'boost',amount:stake*2,weight:rareWeight,color:'#b381d9',locked:rareLocked,label:'Двойные орбы · запас +'+stake*2};
  }else{
    regular=colors.map((color,index)=>itemPrize(itemAt(index),stake*(index+1),[7,4,3][index],color));
    const choices=[...materialPool];
    const items=Array.from({length:Math.min(3,choices.length)},()=>choices.splice(Math.floor(random()*choices.length),1)[0]);
    rare={type:'choice',choices:items.length?items:['property:growth'],amount:stake*5,weight:rareWeight,color:'#b381d9',locked:rareLocked,label:'Выбор материала ×'+stake*5};
  }
  const refunds=returns.map(({percent,weight}):WheelPrize=>({
    type:'refund',amount:percent,weight:60*weight/weightTotal,color:refundColors[percent],
    label:percent+'% · '+unit+' '+(kind==='diamonds'?stake*percent/100:Math.floor(stake*percent/100)).toLocaleString('ru-RU')
  }));
  return [
    refunds[0],{type:'empty',label:'Ничего',weight:15,color:'#e3e7ed'},regular[0],refunds[1],regular[1],
    {type:'jackpot',weight:jackpot,color:'#ffc646',label:'Джекпот · '+unit+' '+Math.floor((account.bank+stake)/10).toLocaleString('ru-RU')},
    {type:'empty',label:'Ничего',weight:10+.01-jackpot,color:'#e3e7ed'},refunds[2],regular[2],rare
  ];
}
function spinFortune(farm:Farm,kind:WheelKind,stake:number,random=Math.random){
  if(!Number.isSafeInteger(stake)||stake<1||stake>wheelStakeLimit||stake>wheelBalance(farm,kind))return null;
  const state=wheelState(farm),account=wheelAccount(farm,kind);
  if(state.choice||!Number.isSafeInteger(account.bank+stake))return null;
  const prizes=wheelLayout(farm,kind,stake);
  let roll=random()*100,index=prizes.length-1;
  for(let i=0;i<prizes.length;i++){
    roll-=prizes[i].weight;
    if(roll<0){index=i;break;}
  }
  const prize=prizes[index];
  if(kind==='coins')spendFarmCoins(farm,stake);
  else if(kind==='orbs')spendFarmOrbs(farm,stake);
  else{farm.diamonds!.balance-=stake;farmStatistics(farm).diamondsSpent+=stake;}
  account.bank+=stake; // One unit is 5% of one currency unit.
  let payout=0;
  if(prize.type==='refund'){
    const units=stake*(prize.amount!/5)+(kind==='diamonds'?account.carry:0);
    payout=Math.floor(units/20);
    if(kind==='diamonds')account.carry=units%20;
  }
  if(prize.type==='jackpot'){payout=Math.floor(account.bank/10);account.bank=0;}
  if(kind==='coins')farm.coins+=payout;
  else if(kind==='orbs')farm.resources.orbs+=payout;
  else farm.diamonds!.balance+=payout;
  if(!prize.locked){
    if(prize.type==='item')addMaterial(farm,prize.item!,prize.amount!);
    if(prize.type==='seed')farm.seeds[prize.crop!]+=prize.amount!;
    if(prize.type==='boost')state.orbBoost+=prize.amount!;
    if(prize.type==='choice')state.choice={items:prize.choices!,amount:prize.amount!};
  }
  account.seed=wheelSeed(random);
  return {prizes,index,prize,payout};
}
function claimFortuneMaterial(farm:Farm,item:string){
  const state=wheelState(farm);
  if(!state.choice?.items.includes(item))return false;
  addMaterial(farm,item,state.choice.amount);
  delete state.choice;
  return true;
}
