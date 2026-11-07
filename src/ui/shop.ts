const seedShop = get<HTMLDialogElement>('seed-shop-dialog');
button('seed-shop').onclick = () => seedShop.showModal();
for (const tab of ['packs','seeds','fortune']) button('tab-'+tab).onclick = () => {
  for (const category of ['packs','seeds','fortune']) {
    const active = category === tab;
    button('tab-'+category).setAttribute('aria-pressed',String(active));
    get('shop-'+category).hidden = !active;
  }
};
for (const [i,crop] of crops.entries()) {
  const item = document.createElement('button');
  item.id = 'buy-seed-'+i;
  item.className = 'quiet square-card';
  const icon = document.createElement('b');
  icon.textContent=crop.symbol;
  icon.setAttribute('aria-hidden','true');
  const label = document.createElement('span');
  label.textContent = crop.name;
  const price = document.createElement('small');
  price.id = 'buy-seed-price-'+i;
  item.append(icon,label,price);
  item.onclick = () => {if (buySeed(farm,i)) commit('Куплено семечко: '+crop.name+'.');};
  get('shop-seeds').append(item);
  const odds = document.createElement('li');
  odds.id = 'odds-'+i;
  get('pack-odds').append(odds);
}
button('buy-luck').onclick = () => {
  if (buyLuck(farm)) commit('Удача пакета повышена.');
};
for (const [i,pack] of seedPacks.entries()) {
  const card = document.createElement('button');
  card.className = 'quiet square-card';
  card.id = 'pack-card-'+i;
  const icon = document.createElement('b');
  icon.textContent = pack.icon;
  const label = document.createElement('span');
  label.textContent = pack.name;
  const detail = document.createElement('small');
  detail.id = 'pack-card-note-'+i;
  card.append(icon,label,detail);
  card.onclick = () => {selectedPack=i; render();};
  get('pack-catalog').append(card);
}
function renderShop(probabilities:number[]) {
  const shopPack = seedPacks[selectedPack];
  get('pack-details').hidden = !shopPack;
  if (shopPack) {
    get('pack-title').textContent=shopPack.icon+' '+shopPack.name;
  }
  seedPacks.forEach((pack,i) => {
    button('pack-card-'+i).setAttribute('aria-pressed',String(i===selectedPack));
  });
  sizePicker.value = String(farm.size);
  crops.forEach((crop,i) => {
    const locked = !unlocked(farm,i);
    const buy = button('buy-seed-'+i);
    buy.disabled = locked || farm.coins < seedPurchaseQuote(farm,i,1);
    const icon=buy.children[0] as HTMLElement;
    const label=buy.children[1] as HTMLElement;
    if(!locked) {
      cropArt(icon,i,'packet',crop.symbol);
      label.textContent=crop.name;
    } else {
      delete icon.dataset.art;
      icon.classList.remove('has-crop-art');
      icon.textContent=crop.symbol;
      label.textContent='Заблокировано';
    }
    get('buy-seed-price-'+i).textContent = locked ? 'Найди в пакете' : '🪙 '+seedPurchaseQuote(farm,i,1)+' · В наличии: '+number(farm.seeds[i]);
    const odds = get('odds-'+i);
    odds.hidden = locked || probabilities[i] === 0;
    odds.textContent = crop.symbol+' '+crop.name+' · '+formatChance(probabilities[i])+'%';
  });
}
button('clear-plots').onclick = () => {
  if (farm.plots.every(plot => !plot)) return;
  for (const plot of farm.plots) if (plot) {if(plot.line!==undefined)farm.lines[plot.line].seeds++;else farm.seeds[plot.crop]++;}
  farm.plots.fill(null);farm.rot.fill(null);
  commit('Грядки очищены, семена возвращены.');
};
document.addEventListener('click',event => {
  if (!(event.target instanceof Element) || event.target.closest('button, dialog, .debug')) return;
  if (seed < 0 && !isWatering() && !gathering) return;
  seed = -1;
  watering = false;gathering=false;
  render();
});
