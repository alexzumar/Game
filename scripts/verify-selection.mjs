import {readModelSource} from './source-files.mjs';
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {stripTypeScriptTypes} from 'node:module';
const storage={value:null,getItem(){return this.value},setItem(_,value){this.value=value}};
const context=vm.createContext({assert,console,localStorage:storage});
const model=readModelSource();
vm.runInContext(stripTypeScriptTypes(model),context);
vm.runInContext(`
const farm=newFarm(), t=farm.epoch;
farm.collection.fill(1);farm.seeds.fill(10);
const plot={crop:7,planted:t,ready:t,mystery:{parents:[7,7],parentNames:['A','B'],
 genomes:[{genes:{gr:1,ga:1,re:30},powers:{regrow:5}},{genes:{gr:30,ga:30,re:1},powers:{regrow:3000}}],traits:[]}};
const line=generateMutationLine(farm,plot,()=>.5);
assert.equal(line.powers.regrow,604);
assert.ok(line.genes.gr<15);
assert.equal(line.parents[0].name,'A');
line.parents[0].genome.genes.gr=20;
assert.equal(plot.mystery.genomes[0].genes.gr,1);
const common={...plot,mystery:{...plot.mystery,genomes:[0,1].map(()=>({genes:{gr:10,ga:10,re:20},powers:{growth:8,regrow:6,yield:2}}))}};
assert.equal(generateMutationLine(farm,common,()=>.5).traits.length,3);
farm.lines.push({...line,name:'Мой урожайный гибрид',seeds:1});
saveFarm(farm);
assert.equal(loadFarm().lines[0].name,'Мой урожайный гибрид');
const tomato={crop:10,planted:t,watered:t,ready:t,wetUntil:t,duration:1};
farm.plots[0]=tomato;
assert.equal(ripeningInfo(farm,tomato).risk,0);
updateRipening(farm,t+60000,()=>.99);
assert.equal(tomato.ripening.checks,1);
assert.equal(tomato.ripening.value,1.02);

const danger=ripeningInfo(farm,tomato);
assert.equal(danger.risk,.001);
updateRipening(farm,danger.next,()=>0);
assert.equal(farm.plots[0],null);
assert.equal(farm.rot[0].risk,.001);
assert.equal(farm.rot[0].checks,2);
assert.ok(farm.rot[0].value>1);
saveFarm(farm);
assert.equal(loadFarm().rot[0].checks,2);
assert.equal(plant(farm,0,0,danger.next),true);
assert.equal(farm.rot[0],null);
const f=newFarm();f.rot[0]=farm.rot[0];resize(f,3);
assert.equal(f.rot.length,9);
console.log('PASS: weak-parent inheritance, shared powers, ancestry, rename, ripening forecast, rot report and reload');
`,context);
const page=fs.readFileSync('index.html','utf8');
const script=page.split('<script>')[1].split('</script>')[0];
new vm.Script(script);
const ids=[...page.matchAll(/ id="([^"]+)"/g)].map(match=>match[1]);
assert.equal(new Set(ids).size,ids.length);
assert.ok(page.includes('id="hybrid-rename-form"'));
assert.ok(page.includes('id="rot-dialog"'));
console.log('PASS: build syntax and unique UI controls');


