import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {stripTypeScriptTypes} from 'node:module';
import {modelFiles, readSource, uiFiles} from './scripts/source-files.mjs';

const page=readSource('page.html');
const style=readSource('style.css');
const source=[...modelFiles,...uiFiles].map(readSource).join('\n');
const html=page.replace('/* CSS */',()=>style).replace('/* JS */',()=>stripTypeScriptTypes(source).replace(/^[ \t]+$/gm,''));
const version=createHash('sha256').update(html).digest('hex').slice(0,16);
await writeFile(new URL('index.html',import.meta.url),html.replace('<!-- BUILD_VERSION -->',`<meta name="farm-build" content="${version}">`));
await writeFile(new URL('version.json',import.meta.url),JSON.stringify({version})+'\n');
