/*
  src/systems/toys.js —— 玩具装备/卸下系统
  
  - equipToy: 装备玩具（处理同部位冲突、深度档位检查、状态改变）
  - unequipToy: 卸下玩具（按剩余装备重新计算物理状态）
  
  依赖：STATE, TOY_LIBRARY, EventBus, addLog, applyEffects,
        checkDepthRequirement
*/

function equipToy(toyId) {
  const toy = TOY_LIBRARY[toyId];
  if (!toy) return { ok: false, reason: 'unknown_toy' };
  
  // 检查深度档位
  if (toy.requiresDepth && !checkDepthRequirement(toy.requiresDepth)) {
    return { ok: false, reason: 'depth_locked', requires: toy.requiresDepth };
  }
  
  // 同一 subcategory 的道具只能同时装备一个
  const conflicting = STATE.charStatus.toysEquipped.filter(id => {
    const existing = TOY_LIBRARY[id];
    return existing && existing.subcategory === toy.subcategory;
  });
  conflicting.forEach(id => unequipToy(id, true));
  
  STATE.charStatus.toysEquipped.push(toyId);
  
  // 应用装备影响
  if (toy.equipEffect) {
    if (toy.equipEffect.charStatus) {
      Object.assign(STATE.charStatus, toy.equipEffect.charStatus);
    }
  }
  if (toy.equipStats) {
    applyEffects(toy.equipStats);
  }
  
  addLog('toy', `装备: ${toy.name}`);
  EventBus.emit('toyEquipped', { toy: toy });
  return { ok: true };
}

function unequipToy(toyId, silent) {
  const idx = STATE.charStatus.toysEquipped.indexOf(toyId);
  if (idx === -1) return false;
  
  STATE.charStatus.toysEquipped.splice(idx, 1);
  
  const toy = TOY_LIBRARY[toyId];
  if (toy && toy.equipEffect && toy.equipEffect.charStatus) {
    // 根据剩余装备重新计算物理状态
    const remaining = STATE.charStatus.toysEquipped.map(id => TOY_LIBRARY[id]).filter(Boolean);
    
    if (toy.equipEffect.charStatus.collared && !remaining.some(t => t.subcategory === 'neck')) {
      STATE.charStatus.collared = false;
    }
    if (toy.equipEffect.charStatus.gagged && !remaining.some(t => t.subcategory === 'mouth')) {
      STATE.charStatus.gagged = false;
    }
    if (toy.equipEffect.charStatus.blindfolded && !remaining.some(t => t.subcategory === 'eyes')) {
      STATE.charStatus.blindfolded = false;
    }
    if (toy.equipEffect.charStatus.position) {
      // 回到最宽松的位置约束
      const posRank = { free: 0, restrained_light: 1, restrained_hard: 2, chained: 3, caged: 4 };
      let newPos = 'free';
      remaining.forEach(t => {
        if (t.equipEffect && t.equipEffect.charStatus && t.equipEffect.charStatus.position) {
          if (posRank[t.equipEffect.charStatus.position] > posRank[newPos]) {
            newPos = t.equipEffect.charStatus.position;
          }
        }
      });
      STATE.charStatus.position = newPos;
    }
    if (toy.equipEffect.charStatus.clothed && !remaining.some(t => t.category === 'humiliation' && t.equipEffect && t.equipEffect.charStatus && t.equipEffect.charStatus.clothed)) {
      STATE.charStatus.clothed = 'normal';
    }
  }
  
  if (!silent) {
    addLog('toy', `卸下: ${toy ? toy.name : toyId}`);
    EventBus.emit('toyUnequipped', { toyId: toyId });
  }
  return true;
}
