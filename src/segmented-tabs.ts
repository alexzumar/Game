// Recessed segmented tracks preserve existing buttons and their handlers.
const segmentedTracks:HTMLElement[]=[];
type SegmentMotion={active:HTMLButtonElement;animation?:Animation};
const segmentMotions=new WeakMap<HTMLElement,SegmentMotion>();
function updateSegmentedTrack(track:HTMLElement){
 const indicator=track.querySelector<HTMLElement>(':scope>.segmented-indicator')!;
 const active=[...track.querySelectorAll<HTMLButtonElement>(':scope>button')].find(button=>button.getAttribute('aria-pressed')==='true'&&button.offsetWidth>0&&!button.hidden);
 if(!active||!track.offsetWidth){segmentMotions.get(track)?.animation?.cancel();segmentMotions.delete(track);indicator.hidden=true;return;}
 const previous=segmentMotions.get(track),first=indicator.hidden;
 const computed=getComputedStyle(indicator),matrix=new DOMMatrixReadOnly(computed.transform==='none'?undefined:computed.transform);
 const startX=matrix.m41,startY=matrix.m42,startWidth=parseFloat(computed.width)||active.offsetWidth,startHeight=parseFloat(computed.height)||active.offsetHeight;
 const x=active.offsetLeft,y=active.offsetTop,width=active.offsetWidth,height=active.offsetHeight;
 if(previous?.active===active&&!first){
  // Repeated game renders must not interrupt an in-progress category change.
  if(indicator.style.width===width+'px'&&indicator.style.height===height+'px'&&indicator.style.transform==='translate('+x+'px, '+y+'px)')return;
 }
 previous?.animation?.cancel();indicator.style.transition='none';
 const transform=(a:number,b:number)=>'translate('+a+'px, '+b+'px)';
 indicator.style.width=width+'px';indicator.style.height=height+'px';indicator.style.transform=transform(x,y);indicator.hidden=false;
 const motion:SegmentMotion={active};segmentMotions.set(track,motion);
 if(first||!previous||previous.active===active||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const dx=x-startX,dy=y-startY,distance=Math.hypot(dx,dy);if(distance<1)return;
 const overshoot=Math.min(18,Math.max(3,distance*.035)),ox=dx/distance*overshoot,oy=dy/distance*overshoot;
 motion.animation=indicator.animate([
  {transform:transform(startX,startY),width:startWidth+'px',height:startHeight+'px'},
  {transform:transform(x+ox,y+oy),width:width+'px',height:height+'px',offset:.74},
  {transform:transform(x-ox*.16,y-oy*.16),width:width+'px',height:height+'px',offset:.9},
  {transform:transform(x,y),width:width+'px',height:height+'px'}
 ],{duration:550+Math.min(350,distance*.45),easing:'cubic-bezier(.22,.7,.3,1)'});
}
function updateSegmentedTabs(){for(const track of segmentedTracks)updateSegmentedTrack(track);}
for(const nav of document.querySelectorAll<HTMLElement>('dialog .shop-tabs')){
 const buttons=[...nav.querySelectorAll<HTMLButtonElement>(':scope>button')];if(!buttons.length)continue;
 const track=document.createElement('div');track.className='segmented-track';
 const indicator=document.createElement('span');indicator.className='segmented-indicator';indicator.setAttribute('aria-hidden','true');indicator.hidden=true;
 track.append(indicator,...buttons);nav.append(track);segmentedTracks.push(track);
 new MutationObserver(records=>{if(!records.some(record=>record.target instanceof HTMLButtonElement))return;try{updateSegmentedTrack(track);}catch(error){console.error('Ферма: ошибка переключателя категорий',error);}}).observe(track,{subtree:true,attributes:true,attributeFilter:['aria-pressed','hidden']});
}
new MutationObserver(()=>{try{updateSegmentedTabs();}catch(error){console.error('Ферма: ошибка положения вкладок',error);}}).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});
new ResizeObserver(()=>{try{updateSegmentedTabs();}catch(error){console.error('Ферма: ошибка размера вкладок',error);}}).observe(document.documentElement);
window.addEventListener('resize',updateSegmentedTabs);
updateSegmentedTabs();
