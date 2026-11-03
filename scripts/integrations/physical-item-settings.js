/** Register the public physical-item rules and the GM-owned ground-loot store. */
import { MODULE_ID } from '../core/constants.js';
import { PHYSICAL_SETTINGS, DEFAULT_PHYSICAL_SETTINGS, PHYSICAL_SCENE_STORE } from '../core/physical-items.js';
import { PHYSICAL_TRANSACTION_LEDGER } from '../core/physical-transaction-ledger.js';

export function registerPhysicalItemSettings() {
  game.settings.register(MODULE_ID, PHYSICAL_TRANSACTION_LEDGER, {
    name: 'Buxa Item Transaction Ledger', scope: 'world', config: false,
    type: Object, default: {version:1,records:{}}
  });
  game.settings.register(MODULE_ID, PHYSICAL_SCENE_STORE, {
    name: 'Buxa Physical Scene Items', scope: 'world', config: false,
    type: Object, default: {},
    onChange: () => Hooks.callAll('buxaPhysicalSceneItemsChanged')
  });
  game.settings.register(MODULE_ID, PHYSICAL_SETTINGS, {
    name: 'Buxa Physical Items · GM Controls', scope: 'world', config: false, type: Object,
    default: { ...DEFAULT_PHYSICAL_SETTINGS },
    onChange: () => Hooks.callAll('buxaPhysicalVisualSettingsChanged')
  });
}
