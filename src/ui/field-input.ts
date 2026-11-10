const rainLayer = document.querySelector('.rain')!;
for (let i=0;i<28;i++) {
  const drop = document.createElement('span');
  drop.textContent = '💧';
  drop.style.setProperty('--x',((i*37)%101)+'%');
  drop.style.setProperty('--delay',-(i%11)*.32+'s');
  drop.style.setProperty('--duration',(2.1+(i%7)*.23)+'s');
  drop.style.setProperty('--drop-size',(12+(i%5)*4)+'px');
  rainLayer.append(drop);
}
button('debug-coins').onclick = () => {
  const input = get<HTMLInputElement>('debug-amount');
  const amount = input.valueAsNumber;
  if (!input.reportValidity() || !Number.isSafeInteger(amount) || amount < 1 ||
      !Number.isSafeInteger(farm.coins+amount)) return;
  farm.coins += amount;
  commit('Отладка: 🪙 +'+amount);
};
const fieldSurface = get('field');
type Sweep = {id:number;x:number;y:number;active:boolean;tool:'collect'|'water'|'plant';crop:number;visited:Set<number>};
let sweep:Sweep|null = null;
let suppressTileClick = false;
fieldSurface.onpointerdown = event => {
  if (!event.isPrimary || event.button !== 0) return;
  suppressTileClick = false;
  const tile = (event.target as Element).closest<HTMLElement>('.tile');
  const start = tile ? farm.plots[Number(tile.dataset.index)] : null;
  const ready = start?.ready != null && start.ready <= nowTime();
  if(!isGathering()&&!isWatering()&&seed<0)return;
  const tool = isGathering() ? 'collect' : isWatering() ? 'water' : 'plant';
  sweep = {id:event.pointerId,x:event.clientX,y:event.clientY,active:false,tool,crop:seed,visited:new Set()};
};
function workAt(stroke:Sweep,x:number,y:number,now:number) {
  const tile = document.elementFromPoint(x,y)?.closest<HTMLElement>('.tile');
  if (!tile || !fieldSurface.contains(tile)) return false;
  const index = Number(tile.dataset.index);
  if (stroke.visited.has(index)) return false;
  stroke.visited.add(index);
  if (stroke.tool === 'collect') {
    if(!isGathering())return false;
    if(farm.plots[index]?.mystery){openMutation(index);return true;}
    return collectAnimated(index,now,tile)>0;
  }
  if (stroke.tool === 'plant') return plant(farm,index,stroke.crop,now,selectedLine);
  const plot = farm.plots[index];
  return !!plot && water(farm,plot,now);
}
fieldSurface.onpointermove = event => {
  if (!sweep || event.pointerId !== sweep.id) return;
  const dx = event.clientX-sweep.x;
  const dy = event.clientY-sweep.y;
  const distance = Math.hypot(dx,dy);
  if (!sweep.active && distance < 6) return;
  if (!sweep.active) {
    sweep.active = true;
    suppressTileClick = true;
    fieldSurface.setPointerCapture(event.pointerId);
  }
  const steps = Math.max(1,Math.ceil(distance/8));
  let changed = false;
  const now = nowTime();
  const weatherChanged = applyRain(farm,now);
  for (let i=0;i<=steps;i++) if (workAt(sweep,sweep.x+dx*i/steps,sweep.y+dy*i/steps,now)) changed = true;
  sweep.x = event.clientX;
  sweep.y = event.clientY;
  if (weatherChanged && !changed) saveFarm(farm);
  if (changed) {
    applyRain(farm,now);
    const messages = {collect:'Урожай на складе.',plant:'Семена посажены.',water:'Грядки политы.'};
    commit(messages[sweep.tool]);
  }
};
function endSweep(event:PointerEvent) {
  if (sweep?.id === event.pointerId) sweep = null;
}
window.addEventListener('pointerup',endSweep);
window.addEventListener('pointercancel',endSweep);
fieldSurface.addEventListener('click',event => {
  if (!suppressTileClick || event.detail === 0) return;
  suppressTileClick = false;
  event.stopPropagation();
},true);
function syncFocus() {
  document.documentElement.classList.toggle('background-paused',document.hidden || !document.hasFocus());
}
window.addEventListener('focus',syncFocus);
window.addEventListener('blur',syncFocus);
document.addEventListener('visibilitychange',syncFocus);
syncFocus();
const canTilt = matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
const tiltTargets = '.seed:not(.out-of-stock), .square-card, .harvest-item, #shop-seeds button, #seed-shop, #open-pack, #upgrades-open, #upgrade-catalog button, .glass.panel, .resource-card, .hybrid-card, .pack-result, .extractor-slot';
let tilted:HTMLElement|null = null;
function resetTilt() {
  tilted?.classList.remove('tilting');
  tilted = null;
}
document.addEventListener('pointermove',event => {
  if (!canTilt.matches || event.pointerType !== 'mouse' || event.buttons ||
      !(event.target instanceof Element)) return resetTilt();
  const card = event.target.closest<HTMLElement>('.workspace .glass.panel') ??
    event.target.closest<HTMLElement>(tiltTargets);
  if (card !== tilted) resetTilt();
  if (!card || card.matches(':disabled')) return;
  const bounds = card.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;
  const x = Math.max(-.5,Math.min(.5,(event.clientX-bounds.left)/bounds.width-.5));
  const y = Math.max(-.5,Math.min(.5,(event.clientY-bounds.top)/bounds.height-.5));
  card.style.setProperty('--glare-x',((x+.5)*100)+'%');
  card.style.setProperty('--glare-y',((y+.5)*100)+'%');
  card.classList.add('tilting');
  tilted = card;
});
document.documentElement.addEventListener('pointerleave',resetTilt);
document.addEventListener('pointerdown',resetTilt);
window.addEventListener('blur',resetTilt);
canTilt.addEventListener('change',resetTilt);
