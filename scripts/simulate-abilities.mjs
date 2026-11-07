import {readModelSource} from './source-files.mjs';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
const context=vm.createContext({});
vm.runInContext(stripTypeScriptTypes(readModelSource()),context);
const result=vm.runInContext(`
function seeded(seed){return ()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};}
function run(re,start,target,seed){
 const rng=seeded(seed),farm=newFarm();
 let parents=[start,start];
 for(let attempts=1;attempts<=100000;attempts++){
  const plot={crop:7,planted:0,ready:0,mystery:{parents:[7,7],traits:[],genomes:parents.map(value=>({genes:{gr:1,ga:1,re},powers:{growth:value}}))}};
  const child=generateMutationLine(farm,plot,rng).powers.growth;
  parents=[...parents,child].sort((a,b)=>b-a).slice(0,2);
  if(parents[0]>=target)return attempts;
 }
 return null;
}
function summary(re,start,target){
 const runs=Array.from({length:200},(_,i)=>run(re,start,target,500+i)).filter(value=>value!==null).sort((a,b)=>a-b);
 return {re,start,target,completed:runs.length,runs:200,median:runs[Math.floor(runs.length*.5)],p90:runs[Math.floor(runs.length*.9)],min:runs[0],max:runs.at(-1)};
}
[summary(1,1500,3000),summary(15,1500,3000),summary(30,1500,3000),summary(30,5,1500)];
`,context);
console.log(JSON.stringify(result,null,2));
fs.writeFileSync('docs/AbilitySimulation.md','# Проверка роста способностей\n\n200 воспроизводимых прогонов на сценарий. Два родителя с одинаковым стартовым эффектом; после потомка сохраняются два лучших значения. Re в сценарии фиксируется, генетические улучшения не учитываются, цель — измерить именно влияние Re на силу способности. Используется настоящая generateMutationLine. Числа ниже — полученные потомки, без ожидания мутации и роста.\n\n'+JSON.stringify(result,null,2)+'\n');

