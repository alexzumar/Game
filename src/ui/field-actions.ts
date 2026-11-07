function sow(index:number,crop:number) {
  get('quick-seeds').hidden=true;
  if (!unlocked(farm,crop) || farm.plots[index] || !(selectedLine===undefined?farm.seeds[crop]>0:farm.lines[selectedLine]?.seeds>0)) return;
  const now = nowTime();
  selected = index;
  seed = crop;
  watering = false;gathering=false;
  plant(farm,index,crop,now,selectedLine);
  applyRain(farm,now);
  commit('Семя посажено.');
}
button('water').onclick = event => {
  if (event.detail > 1 && farm.convenience.waterAll) return;
  gathering=false;
  watering = !watering;
  seed = -1;
  render();
};
button('water').ondblclick = () => {
  if (!farm.convenience.waterAll) return;
  const now = nowTime();
  gathering=false;
  watering = true;
  seed = -1;
  const weatherChanged = applyRain(farm,now);
  const count = waterAll(farm,now);
  if (count || weatherChanged) commit(count ? 'Полито грядок: '+count+'.' : notice);
  else render();
};
button('expand').onclick = () => {
  const previousSize = farm.size;
  if (!expand(farm)) return;
  animateField();
  selected = Math.floor(selected/previousSize)*farm.size + selected%previousSize;
  commit('Поле расширено.');
};
button('skin').onclick = () => {farm.skin = farm.skin === 'glossy' ? 'classic' : 'glossy'; commit(notice);};
button('theme').onclick = () => {farm.theme = farm.theme === 'light' ? 'dark' : 'light'; commit(notice);};
for (const [i,name] of accents.entries()) {
  const swatch = document.createElement('button');
  swatch.className = 'swatch';
  swatch.dataset.color = String(i);
  swatch.title = name;
  swatch.setAttribute('aria-label',name);
  swatch.onclick = () => {farm.accent=i; commit(notice);};
  get('accents').append(swatch);
}
for (const [i,crop] of crops.entries()) {
  const row = document.createElement('button');
  row.id = 'seed-'+i;
  row.className = 'seed';
  row.style.setProperty('--crop',crop.color);
  row.innerHTML = '<i aria-hidden="true">'+crop.symbol+'</i><span><strong>'+crop.name+'</strong><small id="seed-note-'+i+'"></small></span><b id="seed-count-'+i+'"></b>';
  row.onpointerenter=()=>showSeedTooltip(i,row);
  row.onpointerleave=hideSeedTooltip;
  row.onfocus=()=>showSeedTooltip(i,row);
  row.onblur=hideSeedTooltip;
  row.addEventListener('dragstart',hideSeedTooltip);
  row.onclick = event => {
    selectedLine=undefined;
    if (event.detail > 1 && farm.convenience.sowAll) return;
    seed=!isWatering() && seed===i ? -1 : i;
    watering=false;gathering=false;
    render();
  };
  row.ondblclick = () => {
    selectedLine=undefined;
    if (!farm.convenience.sowAll) return;
    const now = nowTime();
    seed = i;
    watering = false;gathering=false;
    const count = sowAll(farm,i,now);
    const weatherChanged = applyRain(farm,now);
    if (count || weatherChanged) commit(count ? 'Засажено грядок: '+count+'.' : notice);
    else render();
  };
  row.ondragstart = event => event.dataTransfer?.setData('application/x-farm-seed',String(i));
  get('seeds').append(row);
  const entry = document.createElement('li');
  const item = document.createElement('button');
  item.className = 'quiet harvest-item';
  item.innerHTML = '<span class="harvest-icon" aria-hidden="true">'+crop.symbol+'</span><span>'+crop.name+'</span><strong id="yield-'+i+'"></strong>';
  item.onclick = () => offerSale(i);
  item.ondragstart = event => event.dataTransfer?.setData('application/x-farm-yield',String(i));
  entry.id = 'harvest-row-'+i;
  entry.append(item);
  get('yields').append(entry);
}
