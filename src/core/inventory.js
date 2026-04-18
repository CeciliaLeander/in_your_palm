/*
  src/core/inventory.js —— 物品库存管理
  
  - addItem: 增加物品到库存
  - removeItem: 消耗物品
  
  依赖：STATE, ITEM_LIBRARY, EventBus, addLog
*/

function addItem(itemId, quantity = 1) {
  STATE.inventory[itemId] = (STATE.inventory[itemId] || 0) + quantity;
  EventBus.emit('inventoryChanged', STATE.inventory);
  addLog('item', `获得物品: ${ITEM_LIBRARY[itemId]?.name || itemId} ×${quantity}`);
}

function removeItem(itemId, quantity = 1) {
  if (!STATE.inventory[itemId] || STATE.inventory[itemId] < quantity) return false;
  STATE.inventory[itemId] -= quantity;
  if (STATE.inventory[itemId] <= 0) delete STATE.inventory[itemId];
  EventBus.emit('inventoryChanged', STATE.inventory);
  return true;
}
