const reelFinish = 24;
function reelItem(index:number) {
  const crop = crops[index];
  const item = document.createElement('div');
  item.className = 'reel-item';
  const mark = document.createElement('b');
  if((typeof packKnownBefore!=='undefined'&&packKnownBefore?packKnownBefore[index]:unlocked(farm,index)))cropArt(mark,index,'stage-4',crop.symbol);else mark.textContent='❔';
  const label = document.createElement('strong');
  label.textContent = (typeof packKnownBefore!=='undefined'&&packKnownBefore?packKnownBefore[index]:unlocked(farm,index))?crop.name:'Неизвестно';
  item.style.setProperty('--rarity',rarityColors[cropRarities[index]]);
  item.append(mark,label);
  return item;
}
let skipRoll = false;
let lastPackPress = -Infinity;
const runningAnimations = new Set<Animation>();
const packDone = button('pack-done');
const packNote = get('pack-animation-note');
packDone.onclick = () => {
  if (!rolling) {modal.close();return;}
  const now = performance.now();
  if (now-lastPackPress <= 450) {
    skipRoll = true;
    for (const animation of runningAnimations) animation.finish();
  }
  lastPackPress = now;
};
function runPackAnimation(element:HTMLElement,frames:Keyframe[],options:KeyframeAnimationOptions) {
  if (skipRoll || matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve();
  const animation = element.animate(frames,options);
  runningAnimations.add(animation);
  return animation.finished.then(() => {},error => {
    console.error('Ферма: анимация рулетки прервана',error);
  }).finally(() => {runningAnimations.delete(animation);});
}
function createReel(result:number,pool:number[],bonus:boolean) {
  const reel = document.createElement('div');
  reel.className = bonus ? 'reel bonus-reel' : 'reel';
  reel.setAttribute('aria-label',bonus ? 'Бонусный слот' : 'Основной слот');
  const track = document.createElement('div');
  track.className = 'reel-track';
  for (let i=0;i<=reelFinish+3;i++) track.append(reelItem(i===reelFinish ? result : pool[Math.floor(Math.random()*pool.length)]));
  reel.append(track);
  track.style.transform = 'translateX(calc(var(--ticket) * -'+(reelFinish+.5)+'))';
  return {reel,track};
}
function spinReel(track:HTMLElement,duration:number) {
  const offset=(Math.random()<.5?-1:1)*(.22+Math.random()*.22);
  return runPackAnimation(track,[
    {transform:'translateX(calc(var(--ticket) * -1.5))',offset:0,easing:'cubic-bezier(.12,.66,.14,1)'},
    {transform:'translateX(calc(var(--ticket) * -'+(reelFinish+.5+offset)+'))',offset:.82,easing:'cubic-bezier(.2,.8,.25,1)'},
    {transform:track.style.transform,offset:1}
  ],{duration,easing:'linear'});
}
function resultCard(cropIndex:number,baseCount:number) {
  const crop = crops[cropIndex];
  const card = document.createElement('div');
  card.className = 'glass pack-result';
  const icon = document.createElement('b');
  cropArt(icon,cropIndex,'stage-4',crop.symbol);
  icon.setAttribute('aria-hidden','true');
  const name = document.createElement('span');
  name.textContent = crop.name;
  const counts = document.createElement('span');
  counts.className = 'pack-result-counts';
  const base = document.createElement('strong');
  base.textContent = number(baseCount);
  base.setAttribute('aria-label','Из базовых слотов: '+baseCount);
  const bonus = document.createElement('strong');
  bonus.className = 'pack-result-bonus';
  bonus.hidden = true;
  counts.append(base,bonus);
  card.append(icon,name,counts);
  return {card,icon,bonus,count:0};
}
modal.oncancel=event=>{if(rolling)event.preventDefault();};
