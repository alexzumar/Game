type Weather = {intervalVersion?:1|2|3;chance:number; cooldown:number; duration:number; next:number; last:number|null; end:number|null;surgeAt?:number;surged?:boolean};
const weatherMax = 20;
const weatherPrice = (level:number) => Math.ceil(10*(level+1)**2.2);
const randomWeatherSeconds = (spread:number,random:()=>number) => Math.floor(random()*(spread+1))*1000;
function rainRoll(from:number,random=Math.random) {
  const wait=Math.floor(Math.log1p(-random())/Math.log1p(-.0036))+1;
  return from+wait*1000;
}
const newWeather = (now:number):Weather => ({intervalVersion:3,chance:0,cooldown:0,duration:0,last:null,end:null,next:rainRoll(now)});
function rainAt(farm:Farm,now:number) {
  return farm.weather.end !== null && now < farm.weather.end;
}
function dryPlot(plot:Plant,now:number) {
  if (plot.ready === null || plot.wetUntil === undefined || plot.wetUntil >= plot.ready || plot.wetUntil > now) return false;
  plot.remaining = plot.ready-plot.wetUntil;
  plot.dryThrough=plot.wetUntil;
  plot.ready = null;
  delete plot.watered;
  return true;
}
function rainWindow(farm:Farm,start:number,end:number,now:number) {
  let changed = false;
  for (const plot of farm.plots) {
    if (!plot || plot.mystery || plot.ready===null || plot.wetUntil===undefined) continue;
    const rainBoost=.05;
    const from=Math.max(start,plot.watered??plot.planted,plot.rainThrough??0);
    const to=Math.min(now,end,from+2*(plot.wetUntil-from));
    if(to>from && plot.ready>from){
      plot.wetUntil+=Math.floor((to-start)/2)-Math.floor((from-start)/2);
      plot.ready=Math.ceil(plot.ready<=from+(to-from)*(1+rainBoost)?from+(plot.ready-from)/(1+rainBoost):plot.ready-(to-from)*rainBoost);
      plot.rainThrough=to;changed=true;
    }
  }
  return changed;
}
function applyRainWindow(farm:Farm,start:number,end:number,now:number){
  const weather=farm.weather;
  const surge=weather.surgeAt;
  if(surge===undefined||surge>now)return rainWindow(farm,start,end,now);
  rainWindow(farm,start,end,surge);
  delete weather.surgeAt;
  for(const plot of farm.plots){
    if(!plot||plot.mystery||plot.ready===null||plot.ready<=surge||
      (plot.wetUntil??0)<=surge||(plot.watered??plot.planted)>surge)continue;
    const skipped=Math.max(1,Math.round((plot.ready-surge)*.05));
    plot.ready=Math.max(surge,plot.ready-skipped);
    weather.surged=true;
  }
  rainWindow(farm,start,end,now);
  return true;
}
function irrigate(farm:Farm,plot:Plant,now:number) {
  if(!farm.convenience.irrigation || !farm.automation.irrigation || now>=farm.irrigationUntil)return false;
  let changed=dryPlot(plot,now);
  changed=water(farm,plot,now)||changed;
  if(plot.ready!==null && plot.ready>now && (plot.wetUntil??0)<plot.ready) {
    plot.wetUntil=Math.max(plot.wetUntil??0,Math.min(plot.ready,farm.irrigationUntil));changed=true;
  }
  return changed;
}
function applyRain(farm:Farm,now:number) {
  const weather = farm.weather;
  let changed = false;
  if (weather.last !== null && weather.end !== null) changed = applyRainWindow(farm,weather.last,weather.end,now);
  while (weather.next <= now) {
    weather.last = weather.next;
    weather.end = weather.last+30_000+randomWeatherSeconds(90,Math.random);
    weather.next = rainRoll(weather.end);
    const surgeDelay=(Math.floor(Math.log1p(-Math.random())/Math.log1p(-.005))+1)*1000;
    const surgeAt=weather.last+surgeDelay;
    weather.surgeAt=surgeAt<=weather.end?surgeAt:undefined;
    weather.surged=false;
    applyRainWindow(farm,weather.last,weather.end,now);
    changed = true;
  }
  for (const plot of farm.plots) if (plot) {
    changed=irrigate(farm,plot,now)||changed;
    changed=dryPlot(plot,now)||changed;
  }
  return changed;
}
