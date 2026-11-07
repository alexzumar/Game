const diamondBranches = {
  find:'💎 Поиск кристаллов', double:'✨ Двойная находка', charge:'⚡ Кристальный заряд',
  income:'🪙 Монеты при сборе', seedReturn:'🌱 Возврат семян', dryGrowth:'🌿 Рост без полива',
  rainReserve:'💧 Запас дождевой влаги', rainGrowth:'🌧️ Рост под дождём',
  fruit:'🧺 Дополнительный плод', extract:'⏱️ Досрочная переработка', discount:'🛒 Скидка на семена'
} as const;
type DiamondBranch=keyof typeof diamondBranches;
type DiamondState={balance:number;charge:number;coinCarry:number;discountCarry:number;sets:boolean[];levels:Partial<Record<DiamondBranch,number>>};
const newDiamonds=():DiamondState=>({balance:0,charge:0,coinCarry:0,discountCarry:0,sets:[false,false,false,false],levels:{}});
const diamondLevel=(farm:Farm,branch:DiamondBranch)=>farm.diamonds?.levels[branch]??0;
const diamondCurve=(level:number)=>1-.99**level;
const diamondPrice=(level:number)=>Math.ceil(1.35**level);
function diamondBonusCount(value:number,random:()=>number){
  if(value<=0)return 0;
  const whole=Math.floor(value);
  return whole+(value>whole&&random()<value-whole?1:0);
}
function awardDiamondSets(farm:Farm){
  const state=farm.diamonds??=newDiamonds();
  let changed=false;
  collectionSets(farm).forEach((count,index)=>{
    if(count>0&&!state.sets[index]){
      state.sets[index]=true;
      state.balance++;
      changed=true;
    }
  });
  return changed;
}
function awardDiamonds(farm:Farm,crop:number,harvestIncome:number,random:()=>number){
  const state=farm.diamonds??=newDiamonds();
  const chance=cropTimes[crop]/120*.0005*(1+diamondLevel(farm,'find')/100);
  const extra=diamondLevel(farm,'double')*.0005;
  const stats=farmStatistics(farm);
  stats.crystalRolls++;
  const found=diamondBonusCount(chance,random);
  const reward=found*(1+Math.floor(extra))+sampleBinomial(found,extra%1,random);
  state.balance+=reward;
  stats.crystalDrops+=reward;
  const charge=diamondLevel(farm,'charge');
  if(charge){
    state.charge+=chance*(1+extra)*(1-.9*.99**(charge-1));
    const paid=Math.floor(state.charge);
    state.balance+=paid;
    state.charge-=paid;
  }
  const income=diamondLevel(farm,'income');
  if(income){
    state.coinCarry+=harvestIncome*income/100;
    const paid=Math.floor(state.coinCarry);
    farm.coins+=paid;
    state.coinCarry-=paid;
  }
  awardDiamondSets(farm);
}
function buyDiamondUpgrade(farm:Farm,branch:DiamondBranch){
  const state=farm.diamonds??=newDiamonds();
  const level=diamondLevel(farm,branch),price=diamondPrice(level);
  if(!Number.isFinite(price)||state.balance<price)return false;
  state.balance-=price;
  farmStatistics(farm).diamondsSpent+=price;
  state.levels[branch]=level+1;
  return true;
}
