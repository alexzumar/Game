function advanceDebug() {
  const real = Date.now();
  farm.offset += Math.max(0,real-lastTick)*(speed-1);
  lastTick = real;
}
get<HTMLSelectElement>('speed').onchange = event => {
  advanceDebug();
  speed = Number((event.target as HTMLSelectElement).value);
  saveFarm(farm);
};
button('skip-rain').onclick = () => {
  advanceDebug();
  if (!rainAt(farm,nowTime())) farm.offset += Math.max(0,farm.weather.next-nowTime());
  tick();
  saveFarm(farm);
};
function animateField() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  get('field').animate([{transform:'scale(.91)',opacity:.65},{transform:'scale(1)',opacity:1}],
    {duration:420,easing:'cubic-bezier(.22,1,.36,1)'});
}
const sizePicker = get<HTMLSelectElement>('debug-size');
for (let size=1;size<=maxSize;size++) sizePicker.add(new Option(size+' × '+size,String(size)));
sizePicker.onchange = () => {
  const oldSize = farm.size;
  const next = Number(sizePicker.value);
  if (!resize(farm,next)) return;
  selected = Math.min(next-1,Math.floor(selected/oldSize))*next + Math.min(next-1,selected%oldSize);
  animateField();
  commit('Отладка: поле '+next+' × '+next+'.');
};
