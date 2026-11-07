import {writeFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {modelFiles, readSource, uiFiles} from './scripts/source-files.mjs';

const page=readSource('page.html');
const style=readSource('style.css');
const source=[...modelFiles,...uiFiles].map(readSource).join('\n');
await writeFile(new URL('index.html',import.meta.url),
  page.replace('/* CSS */',()=>style).replace('/* JS */',()=>stripTypeScriptTypes(source).replace(/^[ \t]+$/gm,'')));
