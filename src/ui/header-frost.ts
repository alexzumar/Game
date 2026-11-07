// Explicitly blur only the covered part of cards. Nested backdrop filters alone
// do not reliably blur composited glass cards in Chromium.
var headerFrostReady=true;
const frostClips=new Map<HTMLElement,string>();
let frostFrame=0;
const frostCardSelector='#upgrade-catalog>button,.square-card,.resource-card,.hybrid-card,.harvest-item,.pack-result,.reel-item,#pack-luck-upgrade,#pack-upgrade-list>.panel,#extractor-upgrades>.panel,#convenience-list>.panel,#automation-list>.panel,#upgrade-extractor>.panel,#upgrade-tools>.panel,#upgrade-automation>.panel,#enhance-options>.enhancement-row,#upgrades-dialog>.trait-panel';
const frostCopyProperties=['display','box-sizing','background','border','border-radius','box-shadow','color','font-family','font-size','font-weight','line-height','text-align','white-space','overflow-wrap','padding','gap','align-items','justify-items','justify-content','place-content','flex-direction','grid-template-columns','grid-template-rows','width','height','opacity','object-fit','border-color','filter'];
function frostClone(original:HTMLElement){
 const clone=original.cloneNode(true) as HTMLElement;
 const sources=[original,...original.querySelectorAll<HTMLElement>('*')],copies=[clone,...clone.querySelectorAll<HTMLElement>('*')];
 for(let i=0;i<sources.length;i++){
  const source=sources[i],copy=copies[i],style=getComputedStyle(source);
  for(const attribute of [...copy.attributes])if(attribute.name==='id'||attribute.name.startsWith('data-')||attribute.name==='tabindex')copy.removeAttribute(attribute.name);
  for(const property of frostCopyProperties)copy.style.setProperty(property,style.getPropertyValue(property));
  copy.style.pointerEvents='none';copy.style.transition='none';copy.style.animation='none';
 }
 clone.inert=true;clone.setAttribute('aria-hidden','true');return clone;
}
function updateHeaderFrost(){
 for(const [card,clip] of frostClips)if(card.isConnected)card.style.clipPath=clip;frostClips.clear();
 document.querySelectorAll<HTMLElement>('.header-frost-cards').forEach(layer=>layer.replaceChildren());
 for(const dialog of document.querySelectorAll<HTMLDialogElement>('dialog[open]')){
  const header=dialog.querySelector<HTMLElement>(':scope>.window-heading,:scope>.basket-heading');if(!header)continue;
  const bounds=header.getBoundingClientRect();if(!bounds.width||!bounds.height)continue;
  let layer=header.querySelector<HTMLElement>(':scope>.header-frost-cards');
  if(!layer){layer=document.createElement('div');layer.className='header-frost-cards';layer.inert=true;layer.setAttribute('aria-hidden','true');header.append(layer);}
  for(const card of dialog.querySelectorAll<HTMLElement>(frostCardSelector)){
   if(card.closest('.window-heading,.basket-heading')||card.hidden||getComputedStyle(card).display==='none')continue;
   const rect=card.getBoundingClientRect();
   if(rect.bottom<=bounds.top||rect.top>=bounds.bottom||rect.right<=bounds.left||rect.left>=bounds.right||!rect.height)continue;
   const clone=frostClone(card);
   Object.assign(clone.style,{position:'absolute',left:(rect.left-bounds.left)+'px',top:(rect.top-bounds.top)+'px',width:rect.width+'px',height:rect.height+'px',margin:'0',transform:'none',filter:'blur(9px)',opacity:'.65',clipPath:'none'});
   layer.append(clone);frostClips.set(card,card.style.clipPath);
   card.style.clipPath='inset('+Math.min(rect.height,Math.max(0,bounds.bottom-rect.top))+'px 0 0 0)';
  }
 }
}
function scheduleHeaderFrost(){if(frostFrame)return;frostFrame=requestAnimationFrame(()=>{frostFrame=0;try{updateHeaderFrost();}catch(error){console.error('Ферма: ошибка размытия шапки',error);}});}
document.addEventListener('scroll',scheduleHeaderFrost,true);
document.addEventListener('close',scheduleHeaderFrost,true);
window.addEventListener('resize',scheduleHeaderFrost);
updateHeaderFrost();
