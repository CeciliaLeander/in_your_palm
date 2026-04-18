/*
  src/01_state.js —— 全局状态对象与事件总线
  
  STATE: 所有游戏运行时数据的集中存储
  EventBus: UI 订阅状态变化的机制
  
  注意：状态对象在模块间共享（拼接后都在同一作用域）
  所有修改 STATE 的函数都会触发 EventBus 通知 UI
*/

const STATE = {
  // 初始化标记
  initialized: false,
  
  // 配置（玩家开场选择）
  config: {
    crimeType: null,      // passion | meticulous
    style: null,          // minimal | ornate | raw
    depth: null,          // psych | body | r18
    motive: null,         // obsession | antisocial | experiment | revenge | worship | custom
    relation: null,       // stranger | acquaintance | admirer | rival | fan | custom
    playerIdentity: '',   // 玩家自由填写
    playerTraits: [],     // 性格标签多选
    theme: 'minimal'
  },
  
  // 时间
  time: {
    day: 1,
    hour: 20,             // 开场默认晚上八点（{{char}} 刚醒来）
    minute: 0,
    stage: 'shock'
  },
  
  // 玩家位置
  location: {
    current: 'home_main',
    inCell: false
  },
  
  // {{char}} 状态（心理+生理）
  char: {
    // 心理 4 项
    sanity: 75,
    mood: 50,
    sincerity: 20,        // 起始值低（刚被囚禁，防备心强）
    compliance: 15,       // 起始值低
    // 生理 4 项
    stamina: 80,
    hunger: 20,
    sleep: 60,
    health: 95,
    // 训练/调教累积值（era 式独立数值）
    arousal: 0,           // 身体兴奋度（0-100）
    shame: 50,            // 羞耻值（0-100）
    trained: 0            // 训练累积度（0-100，长期积累）
  },
  
  // {{char}} 物理/意识状态（门控条件，决定哪些动作可用）
  charStatus: {
    consciousness: 'awake',   // awake | dazed | asleep | unconscious | drugged
    position: 'free',         // free | restrained_light | restrained_hard | chained | caged
    clothed: 'normal',        // normal | minimal | nude | custom
    gagged: false,
    blindfolded: false,
    collared: false,
    toysEquipped: []          // 当前正穿戴/使用的玩具 ID 列表
  },
  
  // 全局/关系状态
  state: {
    distortion: 0,        // 扭曲度（隐藏）
    riskLevel: 0,         // 玩家暴露风险累积
    inDialogue: false,    // 是否处于对话模式
    dialogueContext: null // 对话模式的上下文（切入点、持续时间等）
  },
  
  // 物品库存
  inventory: {},          // { item_id: quantity }
  
  // 已触发的关键时刻（防止重复提示）
  triggeredMilestones: new Set(),
  
  // 日志
  log: [],                // [{ timestamp, type, text }]
  
  // 动作重复追踪（用于衰减机制）
  recentActions: [],      // [{ actionId, timestamp }] 最近 10 个
  
  // 自定义动作预设（玩家保存的）
  customActionPresets: [] // [{ name, description, category, durationMinutes, notes }]
};

const EventBus = {
  listeners: {},
  on: function(event, handler) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(handler);
  },
  emit: function(event, data) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(h => {
      try { h(data); } catch(e) { console.error('EventBus error:', e); }
    });
  }
};
