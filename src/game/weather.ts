type Weather = {intervalVersion?:1|2;chance:number; cooldown:number; duration:number; next:number; last:number|null; end:number|null};
type WeatherUpgrade = 'cooldown'|'duration';
const rainLength = (level:number) => 30_000+10_000*level;
const weatherMax = 20;
const rainCooldown = (level:number) => Math.max(30_000,120_000-level*5_000);
const weatherPrice = (level:number) => Math.ceil(10*(level+1)**2.2);
const weatherUpgradeMax = (option:WeatherUpgrade) => option==='cooldown'?18:weatherMax;
const randomWeatherSeconds = (spread:number,random:()=>number) => Math.floor(random()*(spread+1))*1000;
function rainRoll(from:number,level:number,random=Math.random) {
  const dryPause=rainCooldown(level)+randomWeatherSeconds(120,random);
  const wait=Math.floor(Math.log1p(-random())/Math.log1p(-.01))+1;
  return from+dryPause+wait*1000;
}
const newWeather = (now:number):Weather => ({intervalVersion:2,chance:0,cooldown:0,duration:0,last:null,end:null,next:rainRoll(now,0)});
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
  if(now>=start&&(now<end||farm.rainSoakedThrough!==end)){
    farm.rainSoaked??=farm.plots.map(()=>false);
    farm.plots.forEach((plot,index)=>{
      if(!plot&&!farm.rainSoaked![index]){
        farm.rainSoaked![index]=true;
        changed=true;
      }
    });
    if(farm.rainSoakedThrough!==end){
      farm.rainSoakedThrough=end;
      changed=true;
    }
  }
  for (const plot of farm.plots) {
    if (!plot || plot.planted>=end) continue;
    const until = end+moistureTime(plot.line===undefined?farm.levels[plot.crop].moisture:0,plot.crop)*(1+(effectiveGenome(farm,plot).powers.moisture??0)/100);
    const at = Math.max(start,plot.planted,plot.ready === null ? plot.wetUntil ?? 0 : 0);
    if (at > now || at >= until) continue;
    changed = dryPlot(plot,at) || changed;
    changed = water(farm,plot,at,until) || changed;
    const rainBoost=(5+diamondLevel(farm,"rainGrowth"))/100;
    const from=Math.max(start,plot.watered??plot.planted,plot.rainThrough??0);
    const to=Math.min(now,end);
    if(plot.ready!==null && to>from && plot.ready>from){
      plot.ready=Math.ceil(plot.ready<=from+(to-from)*(1+rainBoost)?from+(plot.ready-from)/(1+rainBoost):plot.ready-(to-from)*rainBoost);
      plot.rainThrough=to;changed=true;
    }
  }
  return changed;
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
  if (weather.last !== null && weather.end !== null) changed = rainWindow(farm,weather.last,weather.end,now);
  while (weather.next <= now) {
    weather.last = weather.next;
    weather.end = weather.last+rainLength(weather.duration)+randomWeatherSeconds(90,Math.random);
    weather.next = rainRoll(weather.end,weather.cooldown);
    rainWindow(farm,weather.last,weather.end,now);
    changed = true;
  }
  for (const plot of farm.plots) if (plot) {
    changed=irrigate(farm,plot,now)||changed;
    changed=dryPlot(plot,now)||changed;
  }
  return changed;
}
function buyWeather(farm:Farm,upgrade:WeatherUpgrade,now:number) {
  const weather = farm.weather;
  const level = weather[upgrade];
  const price = weatherPrice(level);
  if (level >= weatherUpgradeMax(upgrade) || farm.coins < price) return false;
  applyRain(farm,now);
  spendFarmCoins(farm,price);
  weather[upgrade]++;
  return true;
}
