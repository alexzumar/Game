function renderField(now:number) {
  const field = get('field');
  const dryCount=farm.plots.filter(plot=>
    plot&&!plot.mystery&&(plot.ready===null||(plot.wetUntil!==undefined&&plot.wetUntil<=now&&plot.wetUntil<plot.ready))
  ).length;
  const warning=get('dry-field-notice');
  warning.hidden=dryCount===0;
  const warningText=dryCount?'Нужен полив · грядок: '+dryCount:'';
  if(warning.textContent!==warningText)warning.textContent=warningText;
  field.style.setProperty('--size',String(farm.size));
  field.classList.toggle('dense',farm.size > 3);
  if (field.childElementCount !== farm.plots.length) {
    field.replaceChildren(...farm.plots.map((_,index) => {
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'tile';
      tile.dataset.index = String(index);
      tile.innerHTML = '<span class="tile-id"></span><span class="sprout" aria-hidden="true"></span><strong></strong><small></small>';
      tile.onpointerenter = () => {hoveredPlot=index; renderField(nowTime());};
      tile.onpointerleave = () => {hoveredPlot=-1; renderField(nowTime());};
      tile.onclick = () => {
        selected = index;
        const plot = farm.plots[index];
        if(plot)get('quick-seeds').hidden=true;
        const now = nowTime();
        if(!plot && farm.rot[index] && seed<0 && !isWatering()){openRot(index);return;}
        if(plot?.mystery){
          if(isGathering()||(!isWatering()&&(plot.ready??Infinity)>now))openMutation(index);
          return;
        }
        applyRain(farm,now);
        if (isGathering() && collectAnimated(index,now,tile)) return commit('Урожай на складе.');
        if (isWatering() && plot && water(farm,plot,now)) {
          return commit('Грядка полита.');
        }
        if (!isGathering() && !isWatering() && !plot && (selectedLine===undefined?farm.seeds[seed]>0:farm.lines[selectedLine]?.seeds>0)) return sow(index,seed);
        if(!plot&&!isWatering()&&!isGathering()){openQuickSeeds(index,tile);return;}
        render();
      };
      tile.ondragover = event => {
        if (!farm.plots[index] && (event.dataTransfer?.types.includes('application/x-farm-seed')||event.dataTransfer?.types.includes('application/x-farm-hybrid')))
          event.preventDefault();
      };
      tile.ondrop = event => {
        event.preventDefault();
        const hybrid=event.dataTransfer?.getData('application/x-farm-hybrid');
        if(hybrid && /^\d+$/.test(hybrid)){
          const line=farm.lines[Number(hybrid)];if(!line||line.archived||line.seeds<1)return;
          selectedLine=Number(hybrid);seed=line.crop;watering=false;gathering=false;sow(index,seed);return;
        }
        selectedLine=undefined;
        const value = event.dataTransfer?.getData('application/x-farm-seed');
        if (value && /^\d+$/.test(value)) sow(index,Number(value));
      };
      return tile;
    }));
  }
  farm.plots.forEach((plot,index) => {
    const tile = field.children[index] as HTMLElement;
    const crop = plot ? crops[plot.crop] : null;
    const rot=farm.rot[index];
    tile.classList.toggle("mystery-plot",!!plot?.mystery);
    const ready = !!plot && plot.ready !== null && plot.ready <= now;
    tile.setAttribute('aria-pressed',String(index===selected));
    tile.setAttribute('aria-label','Грядка '+(index+1)+(plot?.mystery?' · неизвестное растение':crop ? ' · '+crop.name : ' · пустая'));
    tile.dataset.wet=String((plot?.wetUntil??0)>now);
    tile.dataset.state = !plot ? rot?'rotten':'empty' : ready ? 'ready' : plot.ready === null ? 'dry' : 'growing';
    tile.style.setProperty('--crop',crop?.color ?? 'var(--accent)');
    tile.children[0].textContent = String(index+1);
    const remaining = plot ? remainingGrowth(plot,now) : undefined;
    const duration = plot ? (plot.duration ?? crops[plot.crop].seconds*1000) : 0;
    const halfway = remaining !== undefined && remaining <= duration/2;
    tile.dataset.stage = !plot ? 'empty' : ready ? 'ripe' : halfway ? 'sprout' : 'seed';
    const icon = !plot ? '' : ready ? crop!.symbol : halfway ? '🌱' : '🟤';
    const visual=tile.children[1] as HTMLElement;
    if(plot?.mystery){
      delete visual.dataset.art;visual.classList.remove("has-crop-art");visual.textContent=farm.xray&&ready?crops[plot.crop].symbol:"?";
      const progress=1-(remaining??duration)/duration;visual.style.setProperty("--mystery-size",String(.4+.6*Math.max(0,Math.min(1,progress))));
    } else if(plot){
      const progress=remaining===undefined?0:1-remaining/duration;
      const stage=ready?4:progress>=2/3?3:progress>=1/3?2:1;
      cropArt(visual,plot.crop,'stage-'+stage,icon);
    } else {
      delete visual.dataset.art;
      visual.classList.remove('has-crop-art');
      visual.textContent=rot?'🍂':'';
    }
    tile.children[2].textContent = !plot&&rot?'Сгнило':plot?.mystery?'Неизвестное растение':crop?.name ?? 'Пустая грядка';
    tile.children[3].textContent = !plot ? rot?'Нажми для отчёта':'Выбери семена' : ready ? 'Готово к сбору' :
      plot.ready === null ? (remaining === undefined ? 'Нужен полив' : 'Сухо · '+clock(remaining)) : clock(remaining!);
  });
  const hint = get('field-tip');
  const hovered = field.children[hoveredPlot];
  hint.hidden = !get('quick-seeds').hidden || !hovered || (!farm.plots[hoveredPlot] && !farm.rot[hoveredPlot]);
  hint.classList.toggle('hybrid-tip',!!farm.plots[hoveredPlot]?.line || farm.plots[hoveredPlot]?.line===0);
  if (!hint.hidden) {
    const wetUntil = farm.plots[hoveredPlot]?.wetUntil ?? 0;
    hint.textContent = hovered.children[2].textContent+' · '+hovered.children[3].textContent+
      (wetUntil > now ? ' · 💧 '+clock(wetUntil-now) : '');
    const plot=farm.plots[hoveredPlot];

    if(plot?.mystery && (plot.ready??Infinity)<=now && farm.xray && plot.mystery.preview){
      const genes=plot.mystery.preview.genes!;
      hint.textContent=crops[plot.crop].name+' · ⚡ Gr '+genes.gr+' / 💰 Ga '+genes.ga+' / 🛡️ Re '+genes.re+' · '+hovered.children[3].textContent;
    }
    if(plot?.line!==undefined){
      const line=farm.lines[plot.line],data=genome(farm,plot);
      hint.textContent=line.name+' · '+crops[line.crop].name+'\n⚡ Gr '+data.genes.gr+' / 💰 Ga '+data.genes.ga+' / 🛡️ Re '+data.genes.re+
        '\n'+line.traits.map(t=>powerLabel(line,t)).join(' · ')+'\n'+hovered.children[3].textContent;
    }
    if(plot){
      const forecast=ripeningInfo(farm,plot);
      if(forecast) {
        hint.classList.add('hybrid-tip');
        hint.textContent+=String.fromCharCode(10)+'Цена сейчас ×'+forecast.value.toFixed(2)+
          ' → ×'+forecast.nextValue.toFixed(2)+String.fromCharCode(10)+
          'Через '+clock(forecast.next-now)+' · риск гнили '+formatChance(forecast.risk*100)+'%';
      }
    } else if(farm.rot[hoveredPlot]){
      const record=farm.rot[hoveredPlot]!;
      hint.textContent=record.name+' · сгнило на проверке '+record.checks+' · риск '+formatChance(record.risk*100)+'% · цена ×'+record.value.toFixed(2);
    }
  }
  if(!hint.hidden)positionFieldTooltip(hint,hovered as HTMLElement);
}
function positionFieldTooltip(hint:HTMLElement,tile:HTMLElement){
  const margin=12,bounds=get('field').getBoundingClientRect(),cell=tile.getBoundingClientRect();
  hint.style.left='0px';hint.style.top='0px';
  const size=hint.getBoundingClientRect();
  const right=bounds.right+margin,left=bounds.left-size.width-margin;
  const nearLeft=cell.left+cell.width/2<bounds.left+bounds.width/2;
  const x=nearLeft?left:right;
  hint.style.left=Math.max(margin,Math.min(innerWidth-size.width-margin,x))+'px';
  hint.style.top=Math.max(margin,Math.min(innerHeight-size.height-margin,cell.top+(cell.height-size.height)/2))+'px';
}
window.addEventListener('resize',()=>{
  const hint=get('field-tip'),tile=get('field').children[hoveredPlot];
  if(!hint.hidden&&tile)positionFieldTooltip(hint,tile as HTMLElement);
});
let basketPulse:Animation|undefined;
function collectAnimated(index:number,now:number,tile:Element) {
  const plot = farm.plots[index];
  const beforeLoot={diamonds:farm.diamonds?.balance??0,orbs:farm.resources.orbs,items:{...farm.resources.items}};
  const amount = collect(farm,index,now);
  if(amount&&typeof packsUiReady!=='undefined'&&packsUiReady)animateCollectedLoot(tile,beforeLoot);
  if(!amount && plot?.line!==undefined && (plot.ready??Infinity)<=now && hybridCount(farm)>=farm.hybridSlots)notice='Инвентарь гибридов заполнен. Освободи место — растение остаётся на грядке.';
  if (!amount || !plot || matchMedia('(prefers-reduced-motion: reduce)').matches) return amount;
  try {
    const origin = tile.getBoundingClientRect();
    const icon = get('basket-icon');
    const target = icon.getBoundingClientRect();
    const flight = document.createElement('span');
    flight.className = 'harvest-flight';
    flight.textContent = crops[plot.crop].symbol+' +'+number(amount);
    flight.style.left = (origin.left+origin.width/2)+'px';
    flight.style.top = (origin.top+origin.height/2)+'px';
    document.documentElement.append(flight);
    const movement = flight.animate([
      {transform:'translate(-50%,-50%) scale(1)',opacity:1},
      {transform:'translate(calc(-50% + '+(target.left+target.width/2-origin.left-origin.width/2)+'px),calc(-50% + '+
        (target.top+target.height/2-origin.top-origin.height/2)+'px)) scale(.48)',opacity:.65}
    ],{duration:560,easing:'cubic-bezier(.35,0,.7,.85)'});
    movement.oncancel = () => flight.remove();
    movement.onfinish = () => {
      flight.remove();
      basketPulse?.cancel();
      const scale = Math.min(1.55,1.06+Math.log10(amount)*.08);
      basketPulse = button('basket').animate([{transform:'scale(1)'},{transform:'scale('+scale+') rotate(-3deg)',offset:.42},
        {transform:'scale(1)'}],{duration:amount >= 100 ? 620 : 290,easing:'ease-out'});
    };
  } catch (error) {
    console.error('Ферма: ошибка анимации сбора',error);
  }
  return amount;
}
