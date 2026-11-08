import {readFileSync} from 'node:fs';

// Shared by the single-page build, model tests, and simulations.
export const modelFiles = [
  'content/crops.ts', 'content/abilities.ts', 'content/materials.ts',
  'game/state.ts', 'game/cultivation.ts', 'game/seed-packs.ts', 'game/seed-shop.ts',
  'game/field.ts', 'game/weather.ts', 'game/extractor.ts', 'game/legacy-irrigation.ts', 'game/hybrids.ts', 'game/produce.ts',
  'game/plant-abilities.ts', 'game/diamonds.ts', 'game/statistics.ts',
  'game/resources.ts', 'game/packs.ts', 'game/fortune.ts', 'save/storage.ts',
];

export const uiFiles = [
  'ui/shell.ts', 'ui/field.ts', 'ui/seed-reels.ts', 'ui/field-actions.ts', 'ui/basket.ts', 'ui/debug.ts', 'ui/shop.ts', 'ui/field-input.ts',
  'ui/upgrades.ts', 'ui/legacy-collection.ts', 'ui/extractor.ts', 'ui/hybrids.ts', 'ui/greenhouse.ts', 'ui/runtime.ts',
  'ui/enhancements.ts', 'ui/collection.ts', 'ui/purchases.ts', 'ui/header-frost.ts',
  'ui/segmented-tabs.ts', 'ui/packs.ts', 'ui/save-slots.ts', 'ui/fortune.ts',
];

export const readSource = name => readFileSync(new URL('../src/'+name, import.meta.url), 'utf8');
export const readModelSource = () => modelFiles.map(readSource).join('\n');
