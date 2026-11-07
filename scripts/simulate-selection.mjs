import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
const context=vm.createContext({});
vm.runInContext(stripTypeScriptTypes(['farm.ts','resources.ts','packs.ts'].map(file=>fs.readFileSync('src/'+file,'utf8')).join('\n')),context);
const result=vm.runInContext(`
function seeded(seed){return ()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};}
function simulate(seed){
 const random=seeded(seed),farm=newFarm();
 let parents=[{gr:1,ga:1,re:1},{gr:1,ga:1,re:1}],expectedSeconds=0,previousExpectedSeconds=0;
 const score=g=>g.gr+g.ga+g.re;
 const order=(a,b)=>score(b)-score(a)||Math.min(b.gr,b.ga,b.re)-Math.min(a.gr,a.ga,a.re);
 for(let attempts=1;attempts<=100000;attempts++){
  const re=(parents[0].re+parents[1].re)/2;
  const probability=mutationChance(re);
  previousExpectedSeconds+=30/(.02+.18*((re-1)/29)**2)+(120/parents[0].gr+120/parents[1].gr)/2;
  expectedSeconds+=30/probability+(120/parents[0].gr+120/parents[1].gr)/2;
  const plot={crop:0,planted:0,ready:0,mystery:{parents:[0,0],traits:[],genomes:parents.map(genes=>({genes,powers:{}}))}};
  const child=generateMutationLine(farm,plot,random).genes;
  parents=[...parents,child].sort(order).slice(0,2);
  if(parents[0].gr===30&&parents[0].ga===30&&parents[0].re===30)return {attempts,expectedHours:expectedSeconds/3600,previousExpectedHours:previousExpectedSeconds/3600};
 }
 return null;
}
function summary(values){
 const sorted=[...values].sort((a,b)=>a-b);
 return {min:sorted[0],median:sorted[Math.floor(sorted.length*.5)],p90:sorted[Math.floor(sorted.length*.9)],max:sorted.at(-1),mean:sorted.reduce((a,b)=>a+b,0)/sorted.length};
}
const runs=Array.from({length:300},(_,i)=>simulate(1000+i));
const completed=runs.filter(Boolean);
({runs:runs.length,completed:completed.length,offspring:summary(completed.map(r=>r.attempts)),oneCellExpectedGameHours:summary(completed.map(r=>r.expectedHours)),previousOneCellExpectedGameHours:summary(completed.map(r=>r.previousExpectedHours))});
`,context);
console.log(JSON.stringify(result,null,2));
fs.writeFileSync('SelectionSimulation.md', '# Проверка наследования\n\n300 воспроизводимых прогонов. Начало 1/1/1 и 1/1/1. После каждого потомка остаются два лучших растения по Gr + Ga + Re, при равенстве более ровные характеристики. Цель — первый потомок 30/30/30. Симуляция вызывает настоящую функцию generateMutationLine из farm.ts.\n\nЧисло потомков — основной результат. Оценка времени дана для одной свободной клетки, готовых родителей, стартового времени вида 120 секунд и без бонусов способностей. Ожидание мутации оценено как 30 / вероятность, к нему прибавлено среднее время роста одного родителя с учётом Gr. Это модель ожидаемого времени, не точная симуляция кликов, влажности и последовательности посадок. Параллельные клетки ускорят поиск, ручные действия и нехватка ресурсов могут его замедлить.\n\n'+JSON.stringify(result,null,2)+'\n');


