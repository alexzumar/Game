import {readFile,writeFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
const read = name => readFile(new URL('src/'+name,import.meta.url),'utf8');
const [page,style,...source] = await Promise.all(['page.html','style.css','farm.ts','resources.ts','packs.ts','fortune.ts','storage.ts','ui.ts','alpha-ui.ts','collections-ui.ts','purchases-ui.ts','header-frost.ts','segmented-tabs.ts','packs-ui.ts','save-slots-ui.ts','fortune-ui.ts'].map(read));
await writeFile(new URL('index.html',import.meta.url),
  page.replace('/* CSS */',()=>style).replace('/* JS */',()=>stripTypeScriptTypes(source.join('\n'))));

