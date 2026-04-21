/*
  src/01_state.js —— 全局状态对象与事件总线
  
  STATE: 所有游戏运行时数据的集中存储
  EventBus: UI 订阅状态变化的机制
  
  注意:状态对象在模块间共享(拼接后都在同一作用域)
  所有修改 STATE 的函数都会触发 EventBus 通知 UI
  
  v0.6.0-alpha.1.dev2 改动(阶段 2.1):
  - 删除 STATE.char.arousal / shame / trained(迁移到 Source→Palam 链路)
  - 删除 STATE.state.distortion(迁移到 STATE.char.juels.distortion)
  - 新增 STATE.char.juels(6 种珠的永久累积)
  - 新增 STATE.char.juelsUnlocked(已解锁印痕的档位)
  - 新增 STATE.session(调教会话容器,Palam 的累积场所)
*/

const STATE = {
  // 初始化标记
  initialized: false,
  
  // 配置(玩家开场选择)
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
    hour: 20,             // 开场默认晚上八点({{char}} 刚醒来)
    minute: 0,
    stage: 'shock'
  },
  
  // 玩家位置
  location: {
    current: 'home_main',
    inCell: false
  },
  
  // {{char}} 状态(心理+生理)
  char: {
    // 心理 4 项(保留)
    sanity: 75,
    mood: 50,
    sincerity: 20,        // 起始值低(刚被囚禁,防备心强)
    compliance: 15,       // 起始值低
    // 生理 4 项(保留)
    stamina: 80,
    hunger: 20,
    sleep: 60,
    health: 95,
    
    // ========== v0.6.0 新增:永久珠累积 ==========
    // 6 种珠的累积值,每种 0-∞(达到阈值解锁档位)
    juels: {
      obedience: 0,       // 服从珠
      distortion: 0,      // 扭曲珠(隐藏,不弹通知)
      shame: 0,           // 羞耻珠
      desire: 0,          // 欲望珠
      emptiness: 0,       // 空虚珠
      resistance: 0       // 反抗珠
    },
    
    // 已解锁的印痕标识(存 "珠ID:档位" 字符串,如 "obedience:copper")
    // 用于防止重复解锁通知,以及 UI 展示珠谱进度
    juelsUnlocked: []
    
    // ========== v0.6.0 删除(迁移到 Source→Palam→珠 链路) ==========
    // arousal: 已废弃 → 通过 desire_palam 转化为欲望珠
    // shame:   已废弃 → 通过 shame_palam 转化为羞耻珠
    // trained: 已废弃 → 通过 submission_palam 转化为服从珠
  },
  
  // {{char}} 物理/意识状态(门控条件,决定哪些动作可用)
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
    riskLevel: 0,         // 玩家暴露风险累积
    inDialogue: false,    // 是否处于对话模式
    dialogueContext: null // 对话模式的上下文(切入点、持续时间等)
    
    // ========== v0.6.0 删除 ==========
    // distortion: 已废弃 → 迁移到 STATE.char.juels.distortion
  },
  
  // ========== v0.6.0 新增:调教会话(Palam 容器) ==========
  // 会话是 Palam 的生命周期容器:动作进入会话后产生的 Source 会转化为 Palam 累积在这里
  // 会话结束时(玩家主动结束 / 4h 超时 / 特定触发)统一结算为珠的增量
  session: {
    active: false,              // 当前是否处于会话中
    startTime: null,            // 会话起始时间戳(Date.now())
    actionCount: 0,             // 本次会话内执行的动作数量
    lastActionTime: null,       // 最近一次动作的时间戳(用于超时判定)
    
    // 8 种 Palam 的会话累积值(会话结束时统一结算为珠)
    palam: {
      submission_palam: 0,      // 服从 Palam
      shame_palam: 0,           // 羞耻 Palam
      desire_palam: 0,          // 欲望 Palam
      distortion_palam: 0,      // 扭曲 Palam
      emptiness_palam: 0,       // 空虚 Palam
      resistance_palam: 0,      // 反抗 Palam
      intimacy_palam: 0,        // 亲密 Palam(转化到服从/扭曲)
      dependence_palam: 0       // 依赖 Palam(转化到服从)
    },
    
    // 本次动作(最近一次)产生的 Source 详情,用于 UI 短暂展示"+3 屈従"之类的漂浮提示
    // 格式: [{ sourceId: 'submission', value: 3, displayText: '屈従 +3' }, ...]
    sourcesThisAction: null
  },
  
  // 物品库存
  inventory: {},          // { item_id: quantity }
  
  // 已触发的关键时刻(防止重复提示)
  triggeredMilestones: new Set(),
  
  // 日志
  log: [],                // [{ timestamp, type, text }]
  
  // 动作重复追踪(用于衰减机制)
  recentActions: [],      // [{ actionId, timestamp }] 最近 10 个
  
  // 自定义动作预设(玩家保存的)
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