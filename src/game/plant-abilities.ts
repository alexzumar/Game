function updateRipening(farm:Farm,now:number,random=Math.random,area:PlotArea=farm){
  let changed=false;
  area.plots.forEach((plot,index)=>{
    if(!plot||plot.mystery||plot.ready===null||plot.ready>now)return;
    const powers=effectiveGenome(farm,plot).powers;
    if(powers.value===undefined&&powers.stability===undefined)return;
    plot.ripening??={next:plot.ready+60000,checks:0,value:1};
    const ripe=plot.ripening;
    for(let steps=0;ripe.next<=now&&steps<1000;steps++){
      ripe.checks++;
      const risk=rotRisk(powers,ripe.checks);
      if(random()<risk){
        area.rot[index]={...(plot.line===undefined?{}:{line:plot.line}),crop:plot.crop,at:ripe.next,checks:ripe.checks,risk,value:ripe.value,name:plot.line===undefined?crops[plot.crop].name:farm.lines[plot.line].name,genome:cloneGenome(genome(farm,plot))};
        area.plots[index]=null;changed=true;break;
      }
      ripe.value*=1+(powers.value??0)/100;
      ripe.next+=40000+Math.floor(random()*40001);
      changed=true;
    }
  });
  return changed;
}


function advanceDryGrowth(farm:Farm,plot:Plant,now:number){
  const strength=Math.max(effectiveGenome(farm,plot).powers.drought??0,diamondCurve(diamondLevel(farm,'dryGrowth'))*100);
  if(!strength||plot.ready!==null)return false;
  plot.duration??=plantGrowthTime(farm,plot);
  plot.remaining??=plot.duration;
  const from=plot.dryThrough??plot.planted;
  if(now<=from)return false;
  plot.remaining=Math.max(0,plot.remaining-(now-from)*strength/100);
  plot.dryThrough=now;
  if(plot.remaining===0){plot.ready=now;plot.wetUntil=now;delete plot.remaining;}
  return now>from;
}
function updatePlantAbilities(farm:Farm,now:number,random=Math.random,area:PlotArea=farm){
  let changed=false;
  for(const plot of area.plots){
    if(!plot||plot.mystery)continue;
    changed=advanceDryGrowth(farm,plot,now)||changed;
    if(plot.ready===null||plot.ready<=now)continue;
    const powers=effectiveGenome(farm,plot).powers;
    const from=plot.abilityThrough??plot.watered??plot.planted;
    const end=Math.min(now,plot.wetUntil??now,plot.ready);
    const rainStart=area===farm?farm.weather.last??0:0,rainEnd=area===farm?farm.weather.end??0:0;
    const rainy=Math.max(0,Math.min(end,rainEnd)-Math.max(from,rainStart));
    const sunny=Math.max(0,end-from-rainy);
    if(powers.sunshine && sunny>0){plot.ready=Math.max(now,plot.ready-sunny*powers.sunshine/100);changed=true;}
    if(powers.leap){
      plot.boostCheck??=from+30000;
      for(let steps=0;plot.boostCheck<=end&&steps<2000;steps++){
        if(random()<powers.leap/100){plot.ready=plot.boostCheck+(plot.ready-plot.boostCheck)/2;changed=true;}
        plot.boostCheck+=30000;changed=true;
      }
    }
    plot.abilityThrough=now;
  }
  return changed;
}






function rotRisk(powers:Record<string,number>,check:number){
  const multiplier=2/(1+(powers.stability??0)/100);
  return check<=1?0:Math.min(1,.001*multiplier**(check-2));
}
function ripeningInfo(farm:Farm,plot:Plant){
  if(plot.ready===null || plot.mystery)return null;
  const powers=effectiveGenome(farm,plot).powers;
  if(powers.value===undefined&&powers.stability===undefined)return null;
  const ripe=plot.ripening??{next:plot.ready+60000,checks:0,value:1};
  return {next:ripe.next,risk:rotRisk(powers,ripe.checks+1),value:ripe.value,nextValue:ripe.value*(1+(powers.value??0)/100),check:ripe.checks+1};
}

function cloneGenome(data:Genome):Genome{return {genes:{...data.genes},powers:{...data.powers},enhancements:{...data.enhancements}};}




const mutationChance = (potential:number) => .08+.32*((Math.max(1,Math.min(30,potential))-1)/29)**2;
