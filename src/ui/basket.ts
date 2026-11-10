const basket = get<HTMLDialogElement>('basket-dialog');
const saleDialog = get<HTMLDialogElement>('sale-dialog');
const sale = get<HTMLFormElement>('sale');
const quantity = get<HTMLInputElement>('quantity');
const skipSingle = get<HTMLInputElement>('skip-single');
let skipConfirmation = false;
let selling = -1;
let confirmAll = false;
function saleQuantity(mode:string){
  const available=farm.harvest[selling]??0;
  if(mode==='one')return 1;
  if(mode==='half')return Math.floor(available/2);
  if(mode==='all')return available;
  return quantity.valueAsNumber;
}
function renderSaleQuote(mode=confirmAll?'all':'custom'){
  const count=saleQuantity(mode);
  const valid=Number.isSafeInteger(count)&&count>0&&count<=(farm.harvest[selling]??0);
  get('sale-coins').textContent=valid?'+'+number(produceSalePrice(farm,selling,count)):'—';
}

function resetAll() {
  confirmAll = false;
  get("sale-hint").textContent = "";
  button("sell-all").setAttribute("aria-pressed","false");
}
function sell(index:number,count:number) {
  if (!Number.isSafeInteger(count) || count < 1 || !(count <= farm.harvest[index])) return;
  if (farm.harvest[index] === 1 && saleDialog.open && skipSingle.checked) skipConfirmation = true;
  const earned=produceSalePrice(farm,index,count)+knotSaleBonus(farm,index,count);
  removeProduce(farm,index,count);
  farm.coins += earned;
  selling = -1;
  if (saleDialog.open) saleDialog.close();
  commit('Продано: '+count+' · 🪙 +'+number(earned));
}
function offerSale(index:number) {
  const count = farm.harvest[index];
  if (!count || saleDialog.open) return;
  const single = count === 1;
  if (single && skipConfirmation) return sell(index,1);
  selling = index;
  resetAll();
  skipSingle.checked = false;
  get('skip-single-row').hidden = !single;
  for (const id of ['sell-half','sell-all','quantity-row','sell-custom']) get(id).hidden = single;
  get('sale-title').textContent = crops[index].symbol+' '+crops[index].name+' · в корзине '+count;
  quantity.max = String(count);
  quantity.value = '1';
  saleDialog.showModal();
  renderSaleQuote();
}
button('sale-extract').onclick=()=>{
  if(selling<0||!farm.harvest[selling])return;
  const slot=Array.from({length:farm.extraction.slots??1},(_,i)=>i).find(i=>!extractionJobs(farm.extraction)[i]);
  if(slot===undefined){
    get('sale-hint').textContent='Все слоты экстрактора заняты.';
    return;
  }
  const crop=selling;
  saleDialog.close();
  openExtractionPicker(slot,crop);
};
button('basket').onclick = () => {skipConfirmation=false; basket.showModal();};
basket.onclose = () => {skipConfirmation=false;};
saleDialog.onclose = () => {selling=-1;};
const receiptDialog = get<HTMLDialogElement>('receipt-dialog');
let receipt:number[] = [];
button('sell-basket').onclick = () => {
  receipt = [...farm.harvest];
  if (!total(receipt)) return;
  const rows = receipt.flatMap((count,i) => {
    if (!count) return [];
    const row = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = crops[i].symbol+' '+crops[i].name;
    const quantity = document.createElement('strong');
    quantity.textContent = '× '+number(count)+' · 🪙 '+number(Math.ceil(farm.harvestValue[i]));
    row.append(label,quantity);
    return [row];
  });
  get('receipt-items').replaceChildren(...rows);
  get('receipt-total').textContent = '🪙 '+number(basketSaleValue(farm));
  receiptDialog.showModal();
};
button('receipt-confirm').onclick = () => {
  if (!receiptDialog.open) return;
  const before=farm.coins;
  const amount = sellBasket(farm,receipt);
  const earned=farm.coins-before;
  receiptDialog.close();
  commit(amount ? 'Продан весь урожай: '+number(amount)+' · 🪙 +'+number(earned) :
    'Корзина изменилась. Открой чек ещё раз.');
};
const shop = get('shop');
shop.ondragover = event => {
  if (event.dataTransfer?.types.includes('application/x-farm-yield')) event.preventDefault();
};
shop.ondrop = event => {
  event.preventDefault();
  const value = event.dataTransfer?.getData('application/x-farm-yield');
  if (value && /^\d+$/.test(value)) offerSale(Number(value));
};
sale.onsubmit = event => {event.preventDefault(); sell(selling,quantity.valueAsNumber);};
quantity.addEventListener('wheel',event => {
  if (!event.deltaY) return;
  event.preventDefault();
  quantity.value = String(Math.max(1,Math.min(Number(quantity.max),(quantity.valueAsNumber || 1)+(event.deltaY < 0 ? 1 : -1))));
  resetAll();
  renderSaleQuote();
},{passive:false});
quantity.oninput=()=>{resetAll();renderSaleQuote();};
for(const mode of ['one','half','all','custom']){
  const action=button('sell-'+mode);
  action.onpointerenter=action.onfocus=()=>renderSaleQuote(mode);
  action.onpointerleave=action.onblur=()=>renderSaleQuote();
}
for (const mode of ['one','half','all']) button('sell-'+mode).onclick = () => {
  if (mode === 'all' && !confirmAll) {
    confirmAll = true;
    renderSaleQuote();
    get('sale-hint').textContent = 'Нажми «Всё» ещё раз, чтобы подтвердить продажу.';
    button('sell-all').setAttribute('aria-pressed','true');
    return;
  }
  sell(selling,saleQuantity(mode));
};
