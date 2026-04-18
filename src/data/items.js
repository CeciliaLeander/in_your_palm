/*
  src/data/items.js —— 消耗品库
  
  食物、药物、约束、生活用品、特殊物品
  扩展方法：添加新条目到 ITEM_LIBRARY
*/

const ITEM_LIBRARY = {
  // ---- 食物类 ----
  food_basic: {
    id: 'food_basic', name: '简单食物', category: 'food',
    price: 1, description: '便利店式简餐',
    onUse: { char: { hunger: -40, mood: -2 } }
  },
  food_premium: {
    id: 'food_premium', name: '精致食物', category: 'food',
    price: 3, description: '用心准备的美食',
    onUse: { char: { hunger: -50, mood: +5, sincerity: +2 } }
  },
  food_poor: {
    id: 'food_poor', name: '粗糙食物', category: 'food',
    price: 0.5, description: '冷的、变质的、或敷衍的食物',
    onUse: { char: { hunger: -25, mood: -8, compliance: -3 } }
  },
  
  // ---- 药物类 ----
  sedative_otc: {
    id: 'sedative_otc', name: '非处方镇静剂', category: 'drug',
    price: 2, description: '药店能买到的温和镇静剂',
    onUse: { char: { sanity: -5, compliance: +8, sleep: -30, stamina: -10 } }
  },
  sedative_strong: {
    id: 'sedative_strong', name: '强效镇静剂', category: 'drug',
    price: 5, description: '医院级别的镇静药物',
    onUse: { char: { sanity: -15, compliance: +20, sleep: -60, stamina: -25, health: -5 } }
  },
  painkiller: {
    id: 'painkiller', name: '止痛药', category: 'drug',
    price: 1.5, description: '缓解身体疼痛',
    onUse: { char: { health: +8, mood: +3 } }
  },
  medicine_basic: {
    id: 'medicine_basic', name: '常规药品', category: 'drug',
    price: 1, description: '感冒药、消毒水等',
    onUse: { char: { health: +10 } }
  },
  
  // ---- 约束类（基础版，复杂版在 toys.js） ----
  restraint_soft: {
    id: 'restraint_soft', name: '软质束缚', category: 'restraint',
    price: 2, description: '丝巾、软绳等',
    onUse: { char: { compliance: +5, sincerity: -3 }, state: { distortion: +5 } }
  },
  restraint_hard: {
    id: 'restraint_hard', name: '硬质束缚', category: 'restraint',
    price: 4, description: '手铐、金属锁链',
    onUse: { char: { compliance: +15, sincerity: -8, mood: -10, health: -3 }, state: { distortion: +10 } }
  },
  
  // ---- 生活类 ----
  clothing_basic: {
    id: 'clothing_basic', name: '基础衣物', category: 'living',
    price: 2, description: '干净的普通衣物',
    onUse: { char: { health: +3, mood: +5, sincerity: +2 } }
  },
  clothing_special: {
    id: 'clothing_special', name: '特殊衣物', category: 'living',
    price: 5, description: '玩家精心挑选的衣物（可能带有某种意图）',
    onUse: { char: { mood: -3, sincerity: -5 }, state: { distortion: +8 } }
  },
  bandage: {
    id: 'bandage', name: '绷带/急救', category: 'living',
    price: 1, description: '处理伤口',
    onUse: { char: { health: +15 } }
  },
  cleaning: {
    id: 'cleaning', name: '清洁用品', category: 'living',
    price: 1, description: '卫生维护',
    onUse: { char: { health: +5, mood: +3 } }
  },
  
  // ---- 特殊物品 ----
  char_memento: {
    id: 'char_memento', name: '{{char}} 的旧物', category: 'special',
    price: 0, description: '玩家从 {{char}} 过去生活中取得的物品（照片、衣物、信件等）',
    onUse: { char: { mood: -15, sincerity: +10, sanity: -8 }, state: { distortion: +15 } }
  }
};
