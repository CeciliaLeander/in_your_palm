/*
  掌心的它 · In Your Palm —— 酒馆角色卡引擎
  
  !!! 此文件是自动生成的，请勿直接编辑 !!!
  要修改引擎，请编辑 src/ 下的对应源文件，然后运行 node build.js
  
  源文件清单（按加载顺序）：
    - 00_constants.js
    - 01_state.js
    - data/sources.js
    - data/palam.js
    - data/imprints.js
    - data/scenes.js
    - data/items.js
    - data/toys.js
    - data/actions.js
    - data/training.js
    - data/dialogue.js
    - data/risks.js
    - data/custom_templates.js
    - core/effects.js
    - core/milestones.js
    - core/time.js
    - core/conditions.js
    - core/inventory.js
    - core/context.js
    - core/risks.js
    - systems/toys.js
    - systems/dialogue.js
    - 98_api.js
    - 99_export.js
  
  构建时间: 2026-04-20T16:32:59.324Z
*/

(function(global) {
'use strict';


// ============================================================
// [00_constants.js]
// ============================================================

/*
  掌心的它 · In Your Palm
  00_constants.js —— 常量与版本
  
  包含：
  - VERSION
  - STAT_MIN / STAT_MAX
  - MILESTONES (阈值提示配置)
  - STAGES (阶段定义)
  - STAGE_MULTIPLIERS (阶段乘数)
  - REPEAT_DECAY (重复衰减配置)
  - DAY_PHASES (每日时间节点)
*/

const VERSION = '0.3.1';

// 状态值的边界
const STAT_MIN = 0;
const STAT_MAX = 100;

// 关键时刻提示阈值（触发后仅提醒，不改变剧情）
const MILESTONES = {
  sanity: [
    { value: 30, key: 'sanity_low', msg: '{{char}} 的理智已降至 30 以下。他/她的言语可能不再可信。' },
    { value: 10, key: 'sanity_critical', msg: '{{char}} 已接近精神崩溃。' }
  ],
  sincerity: [
    { value: 80, key: 'sincerity_high', msg: '{{char}} 的伪装已几乎褪去。', direction: 'above' }
  ],
  compliance: [
    { value: 85, key: 'compliance_high', msg: '{{char}} 的抗拒已极度微弱。', direction: 'above' },
    { value: 10, key: 'compliance_low', msg: '{{char}} 的敌意已达极端。' }
  ],
  health: [
    { value: 20, key: 'health_low', msg: '{{char}} 的身体正处于危险状态。' }
  ],
  distortion: [
    { value: 70, key: 'distortion_high', msg: '你和 {{char}} 之间的某些东西正在改变。', direction: 'above' }
  ],
  arousal: [
    { value: 70, key: 'arousal_high', msg: '{{char}} 的身体正在背叛他/她的意志。', direction: 'above' }
  ],
  shame: [
    { value: 20, key: 'shame_low', msg: '{{char}} 的羞耻感正在消退——这不一定是好消息。' }
  ],
  trained: [
    { value: 50, key: 'trained_mid', msg: '{{char}} 开始条件反射地配合某些动作。', direction: 'above' },
    { value: 85, key: 'trained_high', msg: '{{char}} 的身体记住了你。', direction: 'above' }
  ]
};

// 阶段划分（仅作为叙事参考，不触发剧情）
const STAGES = [
  { id: 'shock',      name: '震惊期', dayMin: 1,  dayMax: 3,  tone: '冲击感、求生本能、原始反应' },
  { id: 'resist',     name: '对抗期', dayMin: 4,  dayMax: 10, tone: '心理博弈、策略行动、情绪拉锯' },
  { id: 'adapt',      name: '适应期', dayMin: 11, dayMax: 30, tone: '日常化、细节化、关系深入' },
  { id: 'transform',  name: '转化期', dayMin: 31, dayMax: 999,tone: '累积状态决定的深化' }
];

// 阶段乘数系统 —— 决定动作的实际效果强度
// 用于真实化角色反应：早期温柔动作不会快速建立好感
const STAGE_MULTIPLIERS = {
  // 对"正向情感"类数值的影响乘数（mood +, sincerity +, compliance + 等）
  // 早期温柔的效果被大幅削弱甚至反转
  positive: {
    shock: -0.5,      // 震惊期：温柔动作反而让 {{char}} 厌恶/恐惧
    resist: 0.1,      // 对抗期：效果极小
    adapt: 0.5,       // 适应期：开始有效
    transform: 1.0    // 转化期：完整效果
  },
  // 对"负向情感"类数值的影响乘数（mood -, sanity - 等）
  // 早期负向动作冲击更大
  negative: {
    shock: 1.3,
    resist: 1.1,
    adapt: 0.9,
    transform: 0.7
  },
  // 身体反应类（arousal, shame）
  physical: {
    shock: 1.2,
    resist: 1.0,
    adapt: 0.8,
    transform: 0.6
  },
  // 训练度（trained）：逐渐加速
  training: {
    shock: 0.3,
    resist: 0.6,
    adapt: 1.0,
    transform: 1.3
  },
  // 扭曲度（distortion）：全程累积，但后期更快
  distortion: {
    shock: 0.8,
    resist: 1.0,
    adapt: 1.2,
    transform: 1.4
  }
};

// 重复衰减追踪（记录同一动作的连续使用次数）
const REPEAT_DECAY = {
  threshold: 3,
  decayFactor: 0.6,
  minMultiplier: 0.2
};

// 每日时间节点
const DAY_PHASES = [
  { hour: 7,  name: 'morning',   label: '早晨' },
  { hour: 12, name: 'noon',      label: '中午' },
  { hour: 19, name: 'evening',   label: '傍晚' },
  { hour: 23, name: 'night',     label: '深夜' },
  { hour: 3,  name: 'deepnight', label: '凌晨' }
];


// ============================================================
// [01_state.js]
// ============================================================

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


// ============================================================
// [data/sources.js]
// ============================================================

/*
  src/data/sources.js —— Source 层定义
  
  Source 是动作的"原始输出"——动作产生什么刺激来源（字面意思）。
  Source 本身是瞬时的：单次动作产生，用完即消。
  Source 在引擎里会被转化成 Palam（会话累积），再结算为珠（永久）。
  
  本文件包含三部分：
  1. SOURCE_DEFINITIONS     —— 14 种 Source 的定义（id、中文名、分组、描述）
  2. SOURCE_TO_PALAM_MAP    —— Source → Palam 的转化系数表
  3. SOURCE_GROUPS          —— 分组元信息（供 UI 分色/分组显示）
  
  设计规范来源：DESIGN_PART1_architecture_actions.md §1.2
  
  扩展方法：
  - 新增 Source：在 SOURCE_DEFINITIONS 添加条目，同时在 SOURCE_TO_PALAM_MAP 添加转化规则
  - 修改转化系数：只改 SOURCE_TO_PALAM_MAP，不要动引擎逻辑
  
  注意：fatigue 是特例 —— 它只消耗 stamina（通过动作的 physicalCost 字段），
  不产生任何 palam。保留它的 Source 定义只是为了统一动作数据结构。
*/

// ============================================================
// 1. Source 定义表（14 种）
// ============================================================

const SOURCE_DEFINITIONS = {
  // ---- 性快感组（pleasure） ----
  pleasure_c: {
    id: 'pleasure_c', name: '快感·C', group: 'pleasure',
    description: '阴蒂/敏感部位刺激'
  },
  pleasure_v: {
    id: 'pleasure_v', name: '快感·V', group: 'pleasure',
    description: '深层刺激'
  },
  pleasure_a: {
    id: 'pleasure_a', name: '快感·A', group: 'pleasure',
    description: '后部刺激'
  },
  pleasure_b: {
    id: 'pleasure_b', name: '快感·B', group: 'pleasure',
    description: '胸部刺激'
  },
  
  // ---- 心理冲击组（psych_impact） ----
  shame: {
    id: 'shame', name: '羞耻', group: 'psych_impact',
    description: '被暴露、被羞辱'
  },
  terror: {
    id: 'terror', name: '恐怖', group: 'psych_impact',
    description: '精神压迫、未知感'
  },
  humiliation: {
    id: 'humiliation', name: '屈辱', group: 'psych_impact',
    description: '尊严被践踏'
  },
  exposure: {
    id: 'exposure', name: '暴露', group: 'psych_impact',
    description: '裸露、被看、被展示'
  },
  
  // ---- 关系侵蚀组（relation_erosion） ----
  intimacy: {
    id: 'intimacy', name: '亲密', group: 'relation_erosion',
    description: '温柔接触产生 —— 早期反而让 {{char}} 反感，晚期才真正建立关系'
  },
  dependence: {
    id: 'dependence', name: '依存', group: 'relation_erosion',
    description: '照料、供给产生'
  },
  submission: {
    id: 'submission', name: '屈従', group: 'relation_erosion',
    description: '强制性的服从压力'
  },
  
  // ---- 抵抗组（resistance） ----
  disgust: {
    id: 'disgust', name: '反感', group: 'resistance',
    description: '不适与反感'
  },
  fatigue: {
    id: 'fatigue', name: '疲劳', group: 'resistance',
    description: '体力/精神消耗（仅消耗 stamina，不产生 palam）'
  },
  pain: {
    id: 'pain', name: '痛感', group: 'resistance',
    description: '肉体疼痛'
  }
};

// ============================================================
// 2. Source → Palam 转化表
// ============================================================
/*
  核心机制：一个 Source 可以贡献多个 Palam（按比例）。
  这让一个动作产生"心理涟漪"，而不是单点影响。
  
  数据结构：
    SOURCE_TO_PALAM_MAP[source_id] = {
      palam_id: coefficient | { type: 'staged', byStage: {...}, default: x }
    }
  
  阶段化系数（staged）：
    某些 Source 的转化系数会随故事阶段变化（shock/resist/adapt/transform）。
    典型例子：intimacy → disgust —— 早期（shock）反感高，晚期降低。
    引擎读取时按 STATE.time.stage 查表，找不到则取 default。
  
  设计规范来源：DESIGN_PART1 §1.2.3
*/

const SOURCE_TO_PALAM_MAP = {
  // ---- 快感组 ----
  pleasure_c: {
    pleasure: 1.0,
    desire: 0.7,
    depression: 0.2
  },
  pleasure_v: {
    pleasure: 1.0,
    desire: 0.8,
    distortion_palam: 0.3
  },
  pleasure_a: {
    pleasure: 1.0,
    desire: 0.8,
    distortion_palam: 0.3
  },
  pleasure_b: {
    pleasure: 0.8,
    shame_palam: 0.5
  },
  
  // ---- 心理冲击组 ----
  shame: {
    shame_palam: 1.0,
    resistance: 0.3,
    // 阶段化：早期震惊不生欲情，转化期羞耻才会反向转化为欲情
    desire: {
      type: 'staged',
      byStage: { shock: 0, resist: 0.2, adapt: 0.3, transform: 0.4 },
      default: 0.2
    }
  },
  terror: {
    resistance: 0.8,
    depression: 0.6,
    distortion_palam: 0.4
  },
  humiliation: {
    shame_palam: 0.8,
    submission_palam: 0.5,
    resistance: 0.4
  },
  exposure: {
    shame_palam: 0.7,
    desire: 0.3
  },
  
  // ---- 关系侵蚀组 ----
  intimacy: {
    distortion_palam: 0.6,
    depression: 0.3,
    // 阶段化：震惊期温柔反而被视为威胁（高反感），晚期关系建立后反感几乎消失
    resistance: {
      type: 'staged',
      byStage: { shock: 1.0, resist: 0.6, adapt: 0.3, transform: 0.1 },
      default: 0.4
    }
  },
  dependence: {
    distortion_palam: 0.8,
    submission_palam: 0.4
  },
  submission: {
    submission_palam: 1.0,
    depression: 0.3,
    // 阶段化：早期强制服从引起强烈反感，后期递减
    resistance: {
      type: 'staged',
      byStage: { shock: 0.7, resist: 0.6, adapt: 0.4, transform: 0.2 },
      default: 0.5
    }
  },
  
  // ---- 抵抗组 ----
  disgust: {
    resistance: 1.0
  },
  fatigue: {
    // 不产生任何 palam —— fatigue 只通过动作的 physicalCost 消耗 stamina
  },
  pain: {
    resistance: 0.7,
    distortion_palam: 0.3
  }
};

// ============================================================
// 3. 分组元信息
// ============================================================
/*
  SOURCE_DEFINITIONS 里每个 Source 都有 group 字段，这里给这些
  group 字符串一个"解释表"。UI 阶段会用它给不同组的 Source 上色/分组显示。
  
  视觉属性（uiColor 等）待 DESIGN_PART3B 的 UI 阶段（阶段 6-7）补充。
*/

const SOURCE_GROUPS = {
  pleasure:          { id: 'pleasure',          name: '性快感' },
  psych_impact:      { id: 'psych_impact',      name: '心理冲击' },
  relation_erosion:  { id: 'relation_erosion',  name: '关系侵蚀' },
  resistance:        { id: 'resistance',        name: '抵抗' }
};


// ============================================================
// [data/palam.js]
// ============================================================

/*
  src/data/palam.js —— Palam 层定义
  
  Palam（参数）是"单次调教会话"内的参数水池。
  每次动作产生的 Source 会转化为 Palam 累积到 session.palam，
  会话结束时按阈值结算为"临时珠"，临时珠累加到永久总量（STATE.char.juels）。
  
  本文件包含三部分：
  1. PALAM_DEFINITIONS       —— 8 种 Palam 的定义（id、中文名、可见性、产生哪种珠）
  2. PALAM_TO_JUEL_MAP       —— Palam → 珠 的映射（包含多源合并的特例）
  3. PALAM_SESSION_THRESHOLD —— 会话结算时每多少 palam 出 1 颗临时珠（默认 100）
  
  设计规范来源：
  - DESIGN_PART1_architecture_actions.md §1.3（Palam 定义）
  - DESIGN_PART2_juels_imprints.md §3.2（Palam → 珠对应）
  
  两种阈值的区分（重要）：
  - 本文件的 PALAM_SESSION_THRESHOLD = 会话结算系数（每 100 palam → 1 临时珠）
  - juels.js 的 juel 等级阈值 = 永久累积晋级门槛（50/200/500/1500 等）
  两者机制完全不同：前者结算单次会话，后者判定永久等级。
*/

// ============================================================
// 1. Palam 定义表（8 种）
// ============================================================
/*
  可见性约定：
  - displayed: true   → 会话面板直接显示数值
  - displayed: false  → 会话面板隐藏（扭曲 palam 是唯一的隐藏项，设计核心）
  
  命名约定（从设计文档继承）：
  - shame_palam / submission_palam / distortion_palam 用 _palam 后缀
    原因：它们的名字和 Source 同名（shame/submission/...），后缀用于消歧
  - pleasure / desire / lewdness / depression / resistance 无后缀
    原因：它们与 Source 名不冲突
  
  这种"后缀不统一"不是 bug，是设计文档约定。改动会影响后续引擎代码。
*/

const PALAM_DEFINITIONS = {
  // ---- 身体快感类（都产生欲望珠） ----
  pleasure: {
    id: 'pleasure', name: '快感参数', displayed: true,
    description: '本次身体快感累积（欲望珠主力来源）'
  },
  desire: {
    id: 'desire', name: '欲情', displayed: true,
    description: '本次性唤起程度'
  },
  lewdness: {
    id: 'lewdness', name: '淫欲', displayed: true,
    description: '深度性依赖（高阈值）'
  },
  
  // ---- 心理压力类 ----
  shame_palam: {
    id: 'shame_palam', name: '羞耻', displayed: true,
    description: '本次羞耻感（羞耻珠来源）'
  },
  submission_palam: {
    id: 'submission_palam', name: '屈従', displayed: true,
    description: '本次服从压力（服从珠来源）'
  },
  depression: {
    id: 'depression', name: '抑郁', displayed: true,
    description: '本次精神侵蚀（空虚珠来源）'
  },
  
  // ---- 隐藏类（设计核心） ----
  distortion_palam: {
    id: 'distortion_palam', name: '扭曲', displayed: false,
    description: '关系异化程度（扭曲珠来源，对玩家完全隐藏）'
  },
  
  // ---- 抵抗类 ----
  resistance: {
    id: 'resistance', name: '反感', displayed: true,
    description: '本次抵抗意识（反抗珠来源）'
  }
};

// ============================================================
// 2. Palam → 珠 映射表
// ============================================================
/*
  数据结构：
    PALAM_TO_JUEL_MAP[palam_id] = juel_id
  
  特殊情况：欲望珠（desire juel）是多源合并 ——
  pleasure / desire / lewdness 三种 Palam 都贡献到同一颗珠。
  引擎结算时需要把三者相加：total = pleasure + desire + lewdness，
  再按总量出临时珠。
  
  引擎可以通过反查这张表找出"贡献同一颗珠的所有 palam"。
  参考：DESIGN_PART2 §3.2
*/

const PALAM_TO_JUEL_MAP = {
  // 身体快感三合一 → 欲望珠
  pleasure:         'desire',
  desire:           'desire',
  lewdness:         'desire',
  
  // 其他 palam 一对一
  shame_palam:      'shame',
  submission_palam: 'obedience',
  depression:       'emptiness',
  distortion_palam: 'distortion',
  resistance:       'resistance'
};

// ============================================================
// 3. 会话结算阈值
// ============================================================
/*
  每次会话结束时，引擎把 session.palam 按这张表结算为"临时珠"：
    临时珠数 = Math.floor(session.palam[x] / PALAM_SESSION_THRESHOLD[x])
  
  临时珠加到永久总量（STATE.char.juels[juelId]），
  由 juels.js 判定是否晋级下一等级。
  
  默认都是 100，单独列表是为了以后调参方便
  （比如如果发现"扭曲累积过快"，可以只把 distortion_palam 调到 150
   而不影响其他 palam）。
  
  欲望珠特殊：按 (pleasure + desire + lewdness) 总和结算，
  这张表里这三个都写 100 只是语义占位，引擎会把三者相加后除以 100。
*/

const PALAM_SESSION_THRESHOLD = {
  pleasure:         100,
  desire:           100,
  lewdness:         100,
  shame_palam:      100,
  submission_palam: 100,
  depression:       100,
  distortion_palam: 100,
  resistance:       100
};


// ============================================================
// [data/imprints.js]
// ============================================================

/*
  src/data/imprints.js —— 刻印系统定义
  
  刻印（Imprint）是 char 心理上的永久性深度创伤/固化标记。
  - 触发：由单次会话或累积 Palam / 珠 的异常情况激活
  - 不可逆：一旦烙上永久存在
  - 双向影响：既修改数值转化，也直接注入 AI prompt
  
  本文件包含两部分：
  1. IMPRINT_DEFINITIONS  —— 9 种刻印的完整定义
  2. IMPRINT_CATEGORIES   —— 分类元信息（UI 分色用，待 UI 阶段补齐视觉属性）
  
  设计规范来源：DESIGN_PART3A_imprints.md §4.1 ~ §4.6
  
  ============================================================
  数据结构约定（请在修改时严格遵守）
  ============================================================
  
  每个刻印条目的字段：
  
  {
    id:        字符串，与 key 一致
    name:      中文名
    category:  'resistance' | 'dissolution' | 'numbness' | 'dependence' | 'special'
    
    trigger: {
      type:      'single_session' | 'post_session' | 'post_juel_levelup' | 'pre_action'
      condition: (ctx) => boolean
                 其中 ctx 含：{ session, action, char, recentSessions, triggerSource, juelId, newLevel, ...}
                 引擎阶段 5 实现时会根据 type 准备对应字段。
    }
    
    modifiers: {
      sourceMultipliers?: { [sourceId]: number }
        对应 Part 1 §1.2 的 14 种 Source。乘数作用于 Source → Palam 的转化。
      palamMultipliers?: { [palamId]: number }
        对应 Part 1 §1.3 的 8 种 Palam。乘数作用于 Palam 本身的累积。
      statModifiers?: { [statId]: { cap?: number, flatDelta?: number } }
        对 ABL/生理值的直接修改（如 sanity 上限 -20）。
      specialEffects?: string[]
        引擎需要做特殊逻辑的效果标签。引擎阶段 5 实现对应的处理分支。
    }
    
    aiPrompt: string
      注入到 AI prompt 的"[刻印·XXX] ..."文本。
      含 {占位符} 的会在运行时由引擎替换（目前仅 phobic_rupture 有 {trigger_list}）。
    
    reversible: boolean   —— 目前全部为 false
    
    meta?: object         —— 任意额外数据（如 phobic_rupture 存 triggerSources）
  }
  
  ============================================================
  关于触发检查时机（trigger.type 的约定）
  ============================================================
  
  引擎在以下时机遍历所有 IMPRINT_DEFINITIONS，按 type 过滤后调用 condition：
  
  - 'single_session'      每次动作结算后
  - 'post_session'        会话结束时
  - 'post_juel_levelup'   珠晋级时
  - 'pre_action'          每个动作执行前
  
  参考 Part 3A §4.4.2。
*/

// ============================================================
// IMPRINT_DEFINITIONS —— 9 种刻印的完整定义
// ============================================================

const IMPRINT_DEFINITIONS = {
  
  // ==========================================
  // 抵抗类（resistance）
  // ==========================================
  
  rebound: {
    id: 'rebound',
    name: '反発刻印',
    category: 'resistance',
    trigger: {
      type: 'single_session',
      condition: (ctx) => {
        const sessionResistance = ctx.session?.palam?.resistance ?? 0;
        const actionResistanceSource = ctx.action?.sources?.resistance ?? 0;
        return sessionResistance >= 150 || actionResistanceSource >= 8;
      }
    },
    modifiers: {
      sourceMultipliers: {
        intimacy: 0.3     // 温柔接触的效果打折
      },
      palamMultipliers: {
        submission_palam: 0.5,
        resistance: 1.3   // 抵抗反而加剧
      }
    },
    aiPrompt: '[刻印·反発] char 曾在某次处境下遭受超出其承受上限的压迫，内在已形成针对 user 的硬化防御层。该 char 现在对任何"顺化"尝试的接受速度显著降低，抗拒反应在 user 面前会有意或无意地被放大表现。',
    reversible: false
  },
  
  defiance_stasis: {
    id: 'defiance_stasis',
    name: '抵抗固化刻印',
    category: 'resistance',
    trigger: {
      type: 'post_session',
      // 条件：反抗珠金级 + 最近 3 次会话都产生 resistance palam ≥ 50
      condition: (ctx) => {
        const resistJuelLevel = ctx.char?.juels?.resistance ?? 0;
        const hasGoldResistJuel = resistJuelLevel >= 450;  // 金级阈值见 Part 2 §3.3.2
        if (!hasGoldResistJuel) return false;
        
        const recent = ctx.recentSessions ?? [];
        if (recent.length < 3) return false;
        return recent.slice(-3).every(s => (s.palam?.resistance ?? 0) >= 50);
      }
    },
    modifiers: {
      palamMultipliers: {
        submission_palam: 0.7,
        distortion_palam: 0.6
        // 注意：intimacy 和 dependence 不受影响（char 仍可建立亲密）
      }
    },
    aiPrompt: '[刻印·抵抗固化] char 已形成稳定且不可瓦解的抵抗核心。该核心与表面行为独立存在——char 可能在行为上深度顺从，但其核心自我始终保持清醒和完整。user 能获得 char 的表面、身体、甚至情感，但永远无法获得 char 的核心认同。',
    reversible: false
  },
  
  // ==========================================
  // 崩解类（dissolution）
  // ==========================================
  
  dissolution: {
    id: 'dissolution',
    name: '崩坏刻印',
    category: 'dissolution',
    trigger: {
      type: 'post_juel_levelup',
      // 条件：扭曲珠金级以上 AND 空虚珠金级以上
      condition: (ctx) => {
        const distortion = ctx.char?.juels?.distortion ?? 0;
        const emptiness = ctx.char?.juels?.emptiness ?? 0;
        return distortion >= 400 && emptiness >= 600;  // 各自金级阈值
      }
    },
    modifiers: {
      sourceMultipliers: {
        disgust: 0.3,
        pain: 0.3
      },
      palamMultipliers: {
        resistance: 0.3  // 已无力真正抵抗
      },
      statModifiers: {
        sanity: { cap: -20 }  // sanity 上限降低 20
      },
      specialEffects: ['dissociation_20pct']  // 每次动作 20% 概率触发短暂解离
    },
    aiPrompt: '[刻印·崩坏] char 的心理结构已出现不可修复的断裂——扭曲的深度与精神的空虚同时达到临界，导致 char 的自我同一性松动。该 char 在意识清醒时仍能正常反应，但解离事件会自发发生：短暂的眼神涣散、对当下事件的非同步反应、自我指代的偏移（"我"与"ta"混用）。该状态在 user 面前尤其明显。',
    reversible: false
  },
  
  personality_fracture: {
    id: 'personality_fracture',
    name: '人格断裂刻印',
    category: 'dissolution',
    trigger: {
      type: 'post_juel_levelup',
      // 条件：扭曲珠金级以上 AND 反抗珠银级以上
      condition: (ctx) => {
        const distortion = ctx.char?.juels?.distortion ?? 0;
        const resistance = ctx.char?.juels?.resistance ?? 0;
        return distortion >= 400 && resistance >= 180;  // 扭曲金级 + 反抗银级
      }
    },
    modifiers: {
      specialEffects: [
        'sanity_double_volatility',   // sanity 波动速度 ×2
        'behavior_dual_state'          // AI 提示允许行为双重性不合理化
      ]
    },
    aiPrompt: '[刻印·人格断裂] char 的心理中同时存在深度扭曲的依附与完整的核心抵抗，两者以不连续的方式切换。该切换对 char 本人是不可觉察的——char 每次表现出其中一种状态时，都感觉那就是自己完整的状态。user 观察到的行为反复是真实的，但 char 不会承认或察觉这种反复。',
    reversible: false
  },
  
  // ==========================================
  // 麻木类（numbness）
  // ==========================================
  
  numbness: {
    id: 'numbness',
    name: '麻木刻印',
    category: 'numbness',
    trigger: {
      type: 'post_juel_levelup',
      // 条件：空虚珠达到金级
      condition: (ctx) => {
        const emptiness = ctx.char?.juels?.emptiness ?? 0;
        return emptiness >= 600;
      }
    },
    modifiers: {
      sourceMultipliers: {
        // 所有"心理类"source × 0.5 —— 按设计文档列表 + exposure
        // 参考 DESIGN_PART3A §4.3.5 + Cecilia 确认的 7 项范围
        shame: 0.5,
        terror: 0.5,
        humiliation: 0.5,
        exposure: 0.5,      // 补：麻木的人对被看也失去反应（Cecilia 确认）
        intimacy: 0.5,
        dependence: 0.5,
        submission: 0.5
        // pleasure_* 系列不受影响，身体仍会反应
      }
    },
    aiPrompt: '[刻印·麻木] char 的情感系统已大范围失活——不是被压抑，而是真正的功能性消退。该 char 能执行、能回应、能承受，但其主观体验已从"经历"退化为"观察"。user 对 char 的大部分心理刺激会被 char 以近乎冷漠的方式接收。仅身体层的反应仍保留完整。',
    reversible: false
  },
  
  body_detachment: {
    id: 'body_detachment',
    name: '身心剥离刻印',
    category: 'numbness',
    trigger: {
      type: 'post_juel_levelup',
      // 条件：欲望珠金级以上 AND 空虚珠金级以上
      condition: (ctx) => {
        const desire = ctx.char?.juels?.desire ?? 0;
        const emptiness = ctx.char?.juels?.emptiness ?? 0;
        return desire >= 1000 && emptiness >= 600;  // 欲望金级 + 空虚金级
      }
    },
    modifiers: {
      sourceMultipliers: {
        pleasure_c: 1.3,
        pleasure_v: 1.3,
        pleasure_a: 1.3,
        pleasure_b: 1.3
      },
      palamMultipliers: {
        distortion_palam: 0.4  // 不再形成真正的情感联结
      }
    },
    aiPrompt: '[刻印·身心剥离] char 的身体和意识已进入明确的分离状态——身体对 user 的刺激表现出快速、强烈、甚至主动的反应；但 char 的主观体验与这些身体反应脱钩，以冷漠的旁观者视角体验这一切。该 char 的身体已不属于 char 本人，而是作为一个独立的、对 user 响应的生理系统存在。',
    reversible: false
  },
  
  // ==========================================
  // 依赖类（dependence）
  // ==========================================
  
  cage_syndrome: {
    id: 'cage_syndrome',
    name: '笼性依赖刻印',
    category: 'dependence',
    trigger: {
      type: 'post_juel_levelup',
      // 条件：扭曲珠达到黑曜级
      condition: (ctx) => {
        const distortion = ctx.char?.juels?.distortion ?? 0;
        return distortion >= 1200;  // 扭曲黑曜级阈值
      }
    },
    modifiers: {
      sourceMultipliers: {
        intimacy: 1.3,
        dependence: 1.3
      },
      palamMultipliers: {
        resistance: 0.2  // 近乎无法抵抗
      },
      specialEffects: ['cage_return_reaction']  // 强制外出时触发"回笼反应"
    },
    aiPrompt: '[刻印·笼性依赖] char 已将囚禁空间本身内化为"安全"的象征，将外部世界识别为威胁。该 char 在空间之外会表现出明显的焦虑、迷失、甚至主动请求返回。user 作为笼子的持有者，已成为 char 安全感的唯一来源。这种依赖已深度到空间感官层——离开密室的具体气味、光线、声音也会触发 char 的不适。',
    reversible: false
  },
  
  obedience_lock: {
    id: 'obedience_lock',
    name: '服从锁刻印',
    category: 'dependence',
    trigger: {
      type: 'post_juel_levelup',
      // 条件：服从珠达到黑曜级
      condition: (ctx) => {
        const obedience = ctx.char?.juels?.obedience ?? 0;
        return obedience >= 1500;  // 服从黑曜级阈值
      }
    },
    modifiers: {
      palamMultipliers: {
        submission_palam: 0.3,  // 顶点后进一步累积近乎无意义
        resistance: 0.1          // 近乎不可能抵抗
      },
      specialEffects: ['functional_paralysis']  // 无指令时功能性瘫痪
    },
    aiPrompt: '[刻印·服从锁] char 已丧失"自主行动"的能力——不是被禁止，而是系统性的无法启动。该 char 在没有 user 指令时处于完全的被动状态，连生理需求的表达都需要 user 先询问。该 char 的所有行为都必须等待来自 user 的许可或指令。这是服从的极端固化。',
    reversible: false
  },
  
  // ==========================================
  // 特殊类（special）
  // ==========================================
  
  phobic_rupture: {
    id: 'phobic_rupture',
    name: '恐惧撕裂刻印',
    category: 'special',
    trigger: {
      type: 'pre_action',
      // 条件：char 装备了 phobic_trauma tag AND 对应触发源激活次数 ≥ 5
      // 引擎需要维护一个计数器 STATE.char.phobicTriggerCount[triggerId]
      condition: (ctx) => {
        const tags = ctx.char?.config?.persona?.tags ?? [];
        const phobicTag = tags.find(t => (typeof t === 'object' ? t.id : t) === 'phobic_trauma');
        if (!phobicTag) return false;
        
        const triggerSources = (typeof phobicTag === 'object') ? (phobicTag.triggers ?? []) : [];
        const counts = ctx.char?.phobicTriggerCount ?? {};
        return triggerSources.some(src => (counts[src] ?? 0) >= 5);
      }
    },
    modifiers: {
      statModifiers: {
        sanity: { flatDelta: -15 }  // 每次触发源激活时额外 -15 sanity
      },
      specialEffects: [
        'phobic_trigger_double',     // 原 phobic 触发效果翻倍
        'dissolution_fasttrack_1w'   // 1 周内触发 dissolution 条件直接烙印
      ]
    },
    // 动态 prompt：{trigger_list} 在注入时由引擎替换为 char 的具体触发源（如"血、海鲜腥味"）
    aiPrompt: '[刻印·恐惧撕裂] char 对 {trigger_list} 的创伤回避反应已从"回避"升级为"撕裂"——该刺激现在不仅引发恐慌，还会触发短暂的精神崩溃。user 若再次引入这些元素，char 会表现出近乎失控的极端反应。',
    reversible: false,
    meta: {
      hasDynamicPrompt: true,
      promptPlaceholders: ['trigger_list']  // 引擎替换时的占位符清单
    }
  }
};

// ============================================================
// IMPRINT_CATEGORIES —— 分类元信息
// ============================================================
/*
  每个刻印 category 字段指向这里。
  UI 颜色属性（noir / ornate / raw 主题下的具体色值）待 DESIGN_PART3B
  UI 阶段（阶段 6-7）补充。
*/

const IMPRINT_CATEGORIES = {
  resistance:  { id: 'resistance',  name: '抵抗类' },
  dissolution: { id: 'dissolution', name: '崩解类' },
  numbness:    { id: 'numbness',    name: '麻木类' },
  dependence:  { id: 'dependence',  name: '依赖类' },
  special:     { id: 'special',     name: '特殊类' }
};


// ============================================================
// [data/scenes.js]
// ============================================================

/*
  src/data/scenes.js —— 场景库
  
  扩展方法：直接在 SCENE_LIBRARY 对象下新增条目即可
  每个场景结构：
    {
      id, name, type: 'internal' | 'external',
      availableFor: ['*'] | ['身份ID', ...],
      durationHours: 消耗的游戏时长,
      itemsAvailable: [在此场景可购买的物品ID列表],
      riskEvents: [{ id, probability }, ...],
      narrativeHint: 供 AI 生成叙事的场景描写提示
    }
*/

const SCENE_LIBRARY = {
  // ---- 内部场景（家/密室相关） ----
  home_main: {
    id: 'home_main', name: '家 · 主房间', type: 'internal',
    availableFor: ['*'],
    durationHours: 0,
    narrativeHint: '玩家在家中的起居区域，可随时进入密室或操作监控'
  },
  cell_room: {
    id: 'cell_room', name: '密室', type: 'internal',
    availableFor: ['*'],
    durationHours: 2,
    narrativeHint: '玩家进入密室与 {{char}} 直接接触的场景'
  },
  surveillance: {
    id: 'surveillance', name: '监控室', type: 'internal',
    availableFor: ['*'],
    durationHours: 1,
    narrativeHint: '玩家通过监控远程观察 {{char}}'
  },
  
  // ---- 外部通用场景（所有身份可用） ----
  supermarket: {
    id: 'supermarket', name: '超市', type: 'external',
    availableFor: ['*'],
    durationHours: 1,
    itemsAvailable: ['food_basic', 'food_premium', 'cleaning', 'sedative_otc', 'clothing_basic'],
    riskEvents: [
      { id: 'meet_acquaintance', probability: 0.05 },
      { id: 'surveillance_check', probability: 0.02 },
      { id: 'suspicious_purchase', probability: 0.08 }
    ],
    narrativeHint: '玩家采购日常物资的场景。AI 应描写货架、人流、结账，以及玩家内心关于 {{char}} 的思绪'
  },
  pharmacy: {
    id: 'pharmacy', name: '药店', type: 'external',
    availableFor: ['*'],
    durationHours: 0.5,
    itemsAvailable: ['medicine_basic', 'bandage', 'sedative_otc', 'painkiller'],
    riskEvents: [
      { id: 'pharmacist_question', probability: 0.15 },
      { id: 'prescription_required', probability: 0.10 }
    ],
    narrativeHint: '药店。药剂师可能盘问用途。AI 描写紧张氛围'
  },
  street: {
    id: 'street', name: '街道', type: 'external',
    availableFor: ['*'],
    durationHours: 0.5,
    itemsAvailable: [],
    riskEvents: [
      { id: 'stranger_gaze', probability: 0.08 },
      { id: 'police_patrol', probability: 0.03 },
      { id: 'missing_poster', probability: 0.05 }
    ],
    narrativeHint: '玩家行走在街道上。可能瞥见 {{char}} 相关信息（寻人启事、警察、熟人）'
  },
  cafe: {
    id: 'cafe', name: '咖啡厅', type: 'external',
    availableFor: ['*'],
    durationHours: 1.5,
    itemsAvailable: ['food_premium'],
    riskEvents: [
      { id: 'stranger_approach', probability: 0.10 },
      { id: 'overheard_conversation', probability: 0.08 }
    ],
    narrativeHint: '咖啡厅，玩家独处的短暂时刻，常触发内心独白'
  },
  
  // ==========================================================
  // 身份限定场景
  // ==========================================================
  
  // ---- 学生身份独有 ----
  school_class: {
    id: 'school_class', name: '学校 · 教室', type: 'external',
    availableFor: ['student'],
    durationHours: 6,
    itemsAvailable: [],
    riskEvents: [
      { id: 'meet_acquaintance', probability: 0.20 },
      { id: 'stranger_gaze', probability: 0.08 }
    ],
    narrativeHint: '玩家在课堂上。表面在听课，脑中却在反复推演密室里的 {{char}}。同学的喧闹与心中的秘密形成强烈反差。'
  },
  school_library: {
    id: 'school_library', name: '图书馆', type: 'external',
    availableFor: ['student'],
    durationHours: 2,
    itemsAvailable: [],
    riskEvents: [
      { id: 'overheard_conversation', probability: 0.06 }
    ],
    narrativeHint: '安静的图书馆。玩家在查资料（关于药物？心理学？地下室建造？）或单纯逃避人群。书页翻动的声音与内心的喧嚣形成对比。'
  },
  dorm_room: {
    id: 'dorm_room', name: '学生宿舍', type: 'external',
    availableFor: ['student'],
    durationHours: 3,
    itemsAvailable: [],
    riskEvents: [
      { id: 'roommate_suspicion', probability: 0.10 },
      { id: 'meet_acquaintance', probability: 0.05 }
    ],
    narrativeHint: '宿舍房间。室友可能问起玩家最近的异常——总是独自出门、经常深夜不归、眼神奇怪。'
  },
  internet_cafe: {
    id: 'internet_cafe', name: '网吧', type: 'external',
    availableFor: ['student'],
    durationHours: 2,
    itemsAvailable: [],
    riskEvents: [
      { id: 'suspicious_search', probability: 0.12 }
    ],
    narrativeHint: '网吧。玩家用公共电脑搜索某些不想留下痕迹的内容——匿名论坛、加密技术、心理学论文、或其他关于 {{char}} 的信息。'
  },
  
  // ---- 上班族身份独有 ----
  office_work: {
    id: 'office_work', name: '办公室', type: 'external',
    availableFor: ['worker'],
    durationHours: 8,
    itemsAvailable: [],
    riskEvents: [
      { id: 'meet_acquaintance', probability: 0.15 },
      { id: 'boss_notice', probability: 0.08 },
      { id: 'overheard_conversation', probability: 0.08 }
    ],
    narrativeHint: '办公室的一天。玩家表面专注工作，心却不在焉。同事可能注意到玩家最近的变化——疲惫、分神、或反而异常投入工作（掩饰）。'
  },
  commute: {
    id: 'commute', name: '通勤路上', type: 'external',
    availableFor: ['worker'],
    durationHours: 1.5,
    itemsAvailable: [],
    riskEvents: [
      { id: 'stranger_gaze', probability: 0.06 },
      { id: 'missing_poster', probability: 0.08 },
      { id: 'police_patrol', probability: 0.03 }
    ],
    narrativeHint: '地铁/公交/开车的通勤时间。被挤压在陌生人中，玩家的思绪脱离现实，反复回到那个房间。可能瞥见关于 {{char}} 的新闻或寻人启事。'
  },
  coworker_dinner: {
    id: 'coworker_dinner', name: '同事聚餐', type: 'external',
    availableFor: ['worker'],
    durationHours: 3,
    itemsAvailable: ['food_premium'],
    riskEvents: [
      { id: 'meet_acquaintance', probability: 0.25 },
      { id: 'overheard_conversation', probability: 0.15 },
      { id: 'suspicious_purchase', probability: 0.05 }
    ],
    narrativeHint: '被迫参加的同事聚餐。玩家心里只想回家（回到那个房间）。酒精、闲聊、同事的半醉问话。最煎熬的是必须表现"正常"。'
  },
  
  // ---- 自由职业身份独有 ----
  cafe_work: {
    id: 'cafe_work', name: '咖啡厅（工作）', type: 'external',
    availableFor: ['freelancer'],
    durationHours: 4,
    itemsAvailable: ['food_premium'],
    riskEvents: [
      { id: 'stranger_gaze', probability: 0.08 },
      { id: 'overheard_conversation', probability: 0.10 }
    ],
    narrativeHint: '玩家在咖啡厅办公。屏幕上是工作文件，屏幕外是无法切断的思绪。偶尔抬头看见窗外的人流，那种奇异的抽离感。'
  },
  studio: {
    id: 'studio', name: '工作室', type: 'external',
    availableFor: ['freelancer'],
    durationHours: 5,
    itemsAvailable: [],
    riskEvents: [
      { id: 'stranger_approach', probability: 0.02 }
    ],
    narrativeHint: '玩家的工作室（另一个独立空间）。这里是玩家的"第二个家"，和密室所在地点分开。正是因为生活分区清晰，才能维持双重生活。'
  },
  client_meeting: {
    id: 'client_meeting', name: '约稿碰头', type: 'external',
    availableFor: ['freelancer'],
    durationHours: 2,
    itemsAvailable: [],
    riskEvents: [
      { id: 'stranger_approach', probability: 0.08 },
      { id: 'overheard_conversation', probability: 0.12 }
    ],
    narrativeHint: '和客户/编辑/合作方的面对面会议。需要表现专业、热情、可靠。玩家熟练地切换面具，但会议后的疲惫是双倍的。'
  }
};

// 身份-场景映射
// 用于开场菜单根据玩家选择的身份决定可用的外部场景
const IDENTITY_SCENES_MAP = {
  _common: ['home_main', 'cell_room', 'surveillance', 'supermarket', 'pharmacy', 'street', 'cafe'],
  student: {
    label: '学生',
    description: '在校学生（高中/大学）。相对零用钱、容易接近同龄 {{char}}、同学老师家长会成为风险源。',
    exclusive: ['school_class', 'school_library', 'dorm_room', 'internet_cafe']
  },
  worker: {
    label: '上班族',
    description: '公司职员或企业雇员。稳定收入、规律作息、同事熟人风险高。',
    exclusive: ['office_work', 'commute', 'coworker_dinner']
  },
  freelancer: {
    label: '自由职业',
    description: '作家/设计师/艺术家/程序员等。时间自由、独居合理、经济上可能有波动。',
    exclusive: ['cafe_work', 'studio', 'client_meeting']
  }
};


// ============================================================
// [data/items.js]
// ============================================================

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


// ============================================================
// [data/toys.js]
// ============================================================

/*
  src/data/toys.js —— 调教道具库（era 式分类）
  
  5 大分类：约束 restraint / 刺激 stimulation / 羞辱 humiliation / 训练 training / 护理 care
  
  扩展方法：添加新条目到 TOY_LIBRARY
  道具结构：
    {
      id, name, category, subcategory,
      price, description,
      requiresDepth: 'body' | 'r18' (可选，需要特定档位才能使用),
      equipEffect: { charStatus: { ...改变 {{char}} 物理状态 } } (可选),
      equipStats: { char: { ... }, state: { ... } } (装备时的效果),
      useStats: { char: { ... } } (使用时的效果)
    }
*/

const TOY_LIBRARY = {
  // ==== 约束类 restraint ====
  toy_handcuff_soft: {
    id: 'toy_handcuff_soft', name: '软质手铐', category: 'restraint', subcategory: 'wrist',
    price: 2, description: '柔软材质的腕部约束',
    equipEffect: { charStatus: { position: 'restrained_light' } },
    equipStats: { char: { compliance: +3, shame: +5 } }
  },
  toy_handcuff_metal: {
    id: 'toy_handcuff_metal', name: '金属手铐', category: 'restraint', subcategory: 'wrist',
    price: 4, description: '冰冷的金属腕铐，无法挣脱',
    equipEffect: { charStatus: { position: 'restrained_hard' } },
    equipStats: { char: { compliance: +8, sincerity: -5, shame: +10, health: -2 } }
  },
  toy_ankle_cuff: {
    id: 'toy_ankle_cuff', name: '脚踝束缚', category: 'restraint', subcategory: 'ankle',
    price: 3, description: '限制行动的脚踝链',
    equipStats: { char: { compliance: +5, shame: +8 } }
  },
  toy_rope_soft: {
    id: 'toy_rope_soft', name: '柔软绳索', category: 'restraint', subcategory: 'full',
    price: 2, description: '柔软但牢固的捆绑绳',
    equipEffect: { charStatus: { position: 'restrained_light' } },
    equipStats: { char: { compliance: +4, shame: +6 } }
  },
  toy_rope_decorative: {
    id: 'toy_rope_decorative', name: '装饰性绑绳', category: 'restraint', subcategory: 'artistic',
    price: 5, description: '带有审美感的日式绑缚用绳',
    equipEffect: { charStatus: { position: 'restrained_light' } },
    equipStats: { char: { compliance: +6, shame: +15, arousal: +5 }, state: { distortion: +5 } }
  },
  toy_chain_heavy: {
    id: 'toy_chain_heavy', name: '重型锁链', category: 'restraint', subcategory: 'full',
    price: 6, description: '厚重的金属锁链',
    equipEffect: { charStatus: { position: 'chained' } },
    equipStats: { char: { compliance: +12, sincerity: -8, mood: -10, shame: +12 }, state: { distortion: +8 } }
  },
  toy_collar_leather: {
    id: 'toy_collar_leather', name: '皮革项圈', category: 'restraint', subcategory: 'neck',
    price: 3, description: '带扣环的皮质项圈',
    equipEffect: { charStatus: { collared: true } },
    equipStats: { char: { compliance: +8, shame: +15, sincerity: -5 }, state: { distortion: +10 } }
  },
  toy_collar_leash: {
    id: 'toy_collar_leash', name: '项圈 + 牵绳', category: 'restraint', subcategory: 'neck',
    price: 5, description: '可牵引的项圈',
    equipEffect: { charStatus: { collared: true } },
    equipStats: { char: { compliance: +12, shame: +20, trained: +3 }, state: { distortion: +12 } }
  },
  toy_gag_ball: {
    id: 'toy_gag_ball', name: '口球', category: 'restraint', subcategory: 'mouth',
    price: 3, description: '限制发声的口塞',
    equipEffect: { charStatus: { gagged: true } },
    equipStats: { char: { compliance: +5, shame: +12, mood: -8 } }
  },
  toy_blindfold: {
    id: 'toy_blindfold', name: '眼罩', category: 'restraint', subcategory: 'eyes',
    price: 2, description: '遮蔽视线的眼罩',
    equipEffect: { charStatus: { blindfolded: true } },
    equipStats: { char: { sanity: -3, shame: +8, arousal: +3 } }
  },
  
  // ==== 刺激类 stimulation ====
  toy_vibrator_small: {
    id: 'toy_vibrator_small', name: '小型震动器', category: 'stimulation', subcategory: 'external',
    price: 3, description: '温和的外部刺激工具',
    requiresDepth: 'r18',
    useStats: { char: { arousal: +20, shame: +10, mood: -3 } }
  },
  toy_vibrator_strong: {
    id: 'toy_vibrator_strong', name: '强力震动器', category: 'stimulation', subcategory: 'external',
    price: 5, description: '高强度刺激',
    requiresDepth: 'r18',
    useStats: { char: { arousal: +35, shame: +15, sincerity: +5, stamina: -10 }, state: { distortion: +5 } }
  },
  toy_feather: {
    id: 'toy_feather', name: '羽毛', category: 'stimulation', subcategory: 'light',
    price: 1, description: '轻柔的触觉刺激',
    useStats: { char: { arousal: +8, shame: +5, mood: +3 } }
  },
  toy_ice: {
    id: 'toy_ice', name: '冰块', category: 'stimulation', subcategory: 'temperature',
    price: 1, description: '温度冲击',
    useStats: { char: { arousal: +10, shame: +8, stamina: -5 } }
  },
  toy_hot_wax: {
    id: 'toy_hot_wax', name: '低温蜡烛', category: 'stimulation', subcategory: 'temperature',
    price: 2, description: '低温蜡',
    requiresDepth: 'body',
    useStats: { char: { arousal: +12, shame: +10, health: -3 }, state: { distortion: +3 } }
  },
  toy_electro_mild: {
    id: 'toy_electro_mild', name: '轻度电击棒', category: 'stimulation', subcategory: 'intense',
    price: 6, description: '低电流刺激设备',
    requiresDepth: 'body',
    useStats: { char: { arousal: +15, compliance: +8, stamina: -8, health: -5, shame: +10 }, state: { distortion: +10 } }
  },
  
  // ==== 羞辱类 humiliation ====
  toy_mirror: {
    id: 'toy_mirror', name: '全身镜', category: 'humiliation', subcategory: 'visual',
    price: 3, description: '让 {{char}} 必须看到自己',
    equipStats: { char: { shame: +15, sincerity: +8, mood: -5 }, state: { distortion: +5 } }
  },
  toy_camera: {
    id: 'toy_camera', name: '相机', category: 'humiliation', subcategory: 'record',
    price: 4, description: '记录每一个瞬间',
    useStats: { char: { shame: +20, sincerity: +5, mood: -8 }, state: { distortion: +8 } }
  },
  toy_special_clothing: {
    id: 'toy_special_clothing', name: '特殊服装', category: 'humiliation', subcategory: 'clothing',
    price: 5, description: '带有特殊意图的服装（制服/女仆装/人偶装/兽装等）',
    equipEffect: { charStatus: { clothed: 'custom' } },
    equipStats: { char: { shame: +25, compliance: +5, mood: -10 }, state: { distortion: +10 } }
  },
  toy_expose_clothing: {
    id: 'toy_expose_clothing', name: '暴露服装', category: 'humiliation', subcategory: 'clothing',
    price: 3, description: '羞耻感极强的衣物',
    requiresDepth: 'body',
    equipEffect: { charStatus: { clothed: 'minimal' } },
    equipStats: { char: { shame: +30, arousal: +5 }, state: { distortion: +5 } }
  },
  
  // ==== 训练类 training ====
  toy_counter: {
    id: 'toy_counter', name: '计数器', category: 'training', subcategory: 'tool',
    price: 2, description: '要求 {{char}} 报数的训练工具',
    useStats: { char: { trained: +5, shame: +10, compliance: +3 } }
  },
  toy_bell: {
    id: 'toy_bell', name: '铃铛', category: 'training', subcategory: 'tool',
    price: 1, description: '挂在项圈上的铃铛，让 {{char}} 的每个动作都有声音',
    equipEffect: {},
    equipStats: { char: { shame: +12, trained: +3 }, state: { distortion: +5 } }
  },
  toy_feeding_bowl: {
    id: 'toy_feeding_bowl', name: '专用食盆', category: 'training', subcategory: 'tool',
    price: 2, description: '要求 {{char}} 用特定方式进食',
    useStats: { char: { shame: +18, compliance: +5, trained: +8 }, state: { distortion: +8 } }
  },
  toy_command_whistle: {
    id: 'toy_command_whistle', name: '命令哨子', category: 'training', subcategory: 'signal',
    price: 2, description: '建立条件反射训练',
    useStats: { char: { trained: +6, compliance: +3, sanity: -2 } }
  },
  toy_reward: {
    id: 'toy_reward', name: '奖励物（糖果/小礼物）', category: 'training', subcategory: 'positive',
    price: 1, description: '正向训练奖励',
    useStats: { char: { trained: +4, compliance: +5, mood: +3, sincerity: +2 } }
  },
  
  // ==== 护理类 care ====
  toy_brush: {
    id: 'toy_brush', name: '梳子', category: 'care', subcategory: 'grooming',
    price: 1, description: '梳理 {{char}} 的头发',
    useStats: { char: { mood: +8, sincerity: +5, health: +2, trained: +2 } }
  },
  toy_bath_kit: {
    id: 'toy_bath_kit', name: '浴具套装', category: 'care', subcategory: 'hygiene',
    price: 4, description: '为 {{char}} 沐浴的工具',
    useStats: { char: { health: +15, mood: +10, shame: +8, sincerity: +5 } }
  },
  toy_lotion: {
    id: 'toy_lotion', name: '护肤乳液', category: 'care', subcategory: 'skin',
    price: 2, description: '涂抹护理',
    useStats: { char: { mood: +5, arousal: +3, sincerity: +3 } }
  },
  toy_feeding_by_hand: {
    id: 'toy_feeding_by_hand', name: '亲手喂食工具', category: 'care', subcategory: 'feeding',
    price: 2, description: '用勺子/手指/吸管亲自喂食',
    useStats: { char: { hunger: -30, mood: +5, sincerity: +8, shame: +10, trained: +5 } }
  }
};


// ============================================================
// [data/actions.js]
// ============================================================

/*
  src/data/actions.js —— 基础动作库
  
  环境控制、递送、接触、特殊触发等类别的预定义动作
  不包括调教/训练类动作（那些在 training.js）
  
  扩展方法：添加新条目到 ACTION_LIBRARY
  动作结构：
    {
      id, name, category, durationMinutes,
      requiresItem: 'id' | ['id1', 'id2'] (可选),
      requiresCondition: { consciousness: [...], position: [...] } (可选),
      requiresDepth: 'body' | 'r18' (可选),
      effects: { char: { ... }, state: { ... } },
      prompt: 给 AI 的叙事指导
    }
*/

const ACTION_LIBRARY = {
  // ---- 环境控制 ----
  cut_lights: {
    id: 'cut_lights', name: '切断照明', category: 'environment', durationMinutes: 5,
    effects: { char: { sanity: -3, mood: -5, sleep: -10 } },
    prompt: '玩家切断了密室的照明。整个房间陷入黑暗。以 Observation 模式描写 {{char}} 在黑暗中的反应——呼吸变化、动作、内心独白。'
  },
  restore_lights: {
    id: 'restore_lights', name: '恢复照明', category: 'environment', durationMinutes: 5,
    effects: { char: { mood: +3 } },
    prompt: '玩家恢复了照明。描写 {{char}} 从黑暗到光明的瞬间反应。'
  },
  lower_temp: {
    id: 'lower_temp', name: '降低室温', category: 'environment', durationMinutes: 30,
    effects: { char: { stamina: -10, health: -5, compliance: +3 } },
    prompt: '玩家调低了密室温度至令人不适的低温。描写 {{char}} 身体的反应。'
  },
  play_audio: {
    id: 'play_audio', name: '播放音频', category: 'environment', durationMinutes: 60,
    effects: { char: { sanity: -8, mood: -5 } },
    prompt: '玩家在密室播放某种音频（白噪音/特殊音乐/循环声音）。以 Observation 模式描写 {{char}} 在长时间刺激下的心理状态变化。'
  },
  cut_water: {
    id: 'cut_water', name: '切断供水', category: 'environment', durationMinutes: 240,
    effects: { char: { health: -8, stamina: -15, compliance: +5 } },
    prompt: '玩家切断了密室供水。描写 {{char}} 逐渐意识到这件事后的反应。'
  },
  
  // ---- 递送 ----
  deliver_food_basic: {
    id: 'deliver_food_basic', name: '送入简单食物', category: 'deliver', durationMinutes: 10,
    requiresItem: 'food_basic',
    effects: { char: { hunger: -40, mood: -2 } },
    prompt: '玩家通过送物口送入了一份简单食物。以 Dialogue 或 Observation 模式描写 {{char}} 看到食物的反应——接受、拒绝、质疑。'
  },
  deliver_food_premium: {
    id: 'deliver_food_premium', name: '送入精致食物', category: 'deliver', durationMinutes: 15,
    requiresItem: 'food_premium',
    effects: { char: { hunger: -50, mood: +5, sincerity: +2 } },
    prompt: '玩家送入了一份精心准备的食物。描写 {{char}} 的反应——疑虑、感动、警惕，依据当前状态选择侧重。'
  },
  deliver_clothing: {
    id: 'deliver_clothing', name: '送入衣物', category: 'deliver', durationMinutes: 10,
    requiresItem: ['clothing_basic', 'clothing_special'],
    effects: {},
    prompt: '玩家送入了干净的衣物。描写 {{char}} 看到的反应，以及是否更换的细节。'
  },
  take_away_food: {
    id: 'take_away_food', name: '收走食物', category: 'deliver', durationMinutes: 5,
    effects: { char: { hunger: +10, mood: -8, compliance: -5 } },
    prompt: '玩家突然收走了 {{char}} 未吃完的食物。描写 {{char}} 的情绪反应。'
  },
  
  // ---- 接触 ----
  broadcast_message: {
    id: 'broadcast_message', name: '广播讯息', category: 'contact', durationMinutes: 30,
    effects: { char: { sanity: -3, mood: -3 } },
    prompt: '玩家通过扬声器对 {{char}} 说话（内容由玩家描述或 AI 根据当前剧情生成）。{{char}} 听不到玩家的脸，只能听到声音。以 Observation 模式描写 {{char}} 听到声音时的反应。'
  },
  enter_room: {
    id: 'enter_room', name: '进入密室', category: 'contact', durationMinutes: 60,
    effects: {},
    prompt: '玩家打开密室大门，进入 {{char}} 所在的空间。切换到 Dialogue 模式，描写两人面对面的瞬间、{{char}} 的身体语言、玩家看到的细节。'
  },
  letter_slot: {
    id: 'letter_slot', name: '递纸条', category: 'contact', durationMinutes: 5,
    effects: { char: { sanity: -2, sincerity: +3 } },
    prompt: '玩家通过缝隙递入了一张纸条（内容由玩家描述）。描写 {{char}} 发现、阅读、反应的过程。'
  },
  silence_day: {
    id: 'silence_day', name: '沉默一整天', category: 'contact', durationMinutes: 1440,
    effects: { char: { sanity: -12, mood: -15, sincerity: +8 } },
    prompt: '玩家一整天没有任何接触或回应。以 Observation 模式用多段短描写，展现 {{char}} 在无回应状态下从早到晚的心理变化（困惑→焦虑→恐惧→麻木）。'
  },
  
  // ---- 特殊触发 ----
  fake_rescue_signal: {
    id: 'fake_rescue_signal', name: '伪造救援信号', category: 'trigger', durationMinutes: 180,
    effects: { char: { sanity: -20, mood: -15, sincerity: +15 }, state: { distortion: +10 } },
    prompt: '玩家故意制造"有人来救援"的假象（脚步声、呼喊、警笛等）。描写 {{char}} 从听到声音的瞬间希望燃起，到最终意识到这是假象的心理崩塌过程。'
  },
  reveal_truth: {
    id: 'reveal_truth', name: '揭示某个真相', category: 'trigger', durationMinutes: 60,
    effects: { char: { sanity: -10, sincerity: +12, mood: -8 }, state: { distortion: +5 } },
    prompt: '玩家对 {{char}} 揭示某件真相（外面发生的事、关于 {{char}} 的某些信息、关于玩家自己的）。描写 {{char}} 接收信息时的反应。'
  },
  wait_24h: {
    id: 'wait_24h', name: '什么都不做 24 小时', category: 'trigger', durationMinutes: 1440,
    effects: { char: { sanity: -8, stamina: -10, hunger: +30 } },
    prompt: '玩家决定完全不干预 24 小时。以 Observation 模式生成一份"监控记录"式的日志，记录 {{char}} 在这 24 小时里自主的行为（可能包括：尝试逃脱、探索房间、情绪波动、睡眠、沉思等）。'
  },
  show_memento: {
    id: 'show_memento', name: '展示 {{char}} 的旧物', category: 'trigger', durationMinutes: 30,
    requiresItem: 'char_memento',
    effects: { char: { mood: -15, sincerity: +10, sanity: -8 }, state: { distortion: +15 } },
    prompt: '玩家向 {{char}} 展示一件他/她过去的物品。描写 {{char}} 认出物品时的强烈情感反应——不需要玩家多说什么，物品本身就是刀。'
  }
};


// ============================================================
// [data/training.js]
// ============================================================

/*
  src/data/training.js —— 调教/训练动作库
  
  子类别：
  - training_equip: 装备/卸下道具
  - training: 训练（姿势、回应、进食方式等）
  - touch: 身体接触（抚摸、拥抱等）
  - bondage: 束缚操作
  - stimulation: 刺激（需要 body/r18 档位）
  - medical: 药物与医疗
  - state_change: 意识状态操作
  - care: 护理（由 care 类道具驱动的动作）
  
  扩展方法：添加新条目到 TRAINING_ACTIONS（结构同 actions.js）
  额外字段：
    requiresToy: 'toy_id' | ['id1','id2'] (需要已装备某个玩具),
    statusChange: { consciousness: '...' } (改变 {{char}} 物理状态)
*/

const TRAINING_ACTIONS = {
  // ==== 装备类动作（戴上/穿上道具） ====
  equip_toy: {
    id: 'equip_toy', name: '装备道具', category: 'training_equip', durationMinutes: 10,
    requiresToy: '*',
    prompt: '玩家为 {{char}} 装备某个道具。描写装备过程——{{char}} 的反应（抗拒、顺从、沉默）、身体接触的细节、装备后的身体感受。'
  },
  remove_toy: {
    id: 'remove_toy', name: '卸下道具', category: 'training_equip', durationMinutes: 5,
    prompt: '玩家为 {{char}} 卸下某个道具。描写卸下瞬间 {{char}} 的身心反应——释放感、某种奇怪的失落、或警觉。'
  },
  
  // ==== 基础训练动作 ====
  train_sit: {
    id: 'train_sit', name: '训练基本姿势', category: 'training', durationMinutes: 30,
    requiresCondition: { consciousness: ['awake'] },
    effects: { char: { trained: +5, shame: +12, compliance: +3, mood: -5 }, state: { distortion: +5 } },
    prompt: '玩家训练 {{char}} 以某种固定姿势坐/跪/站。这是基础的动物化训练——要求重复、保持、不动。以 Dialogue 模式展开，描写这段时间内 {{char}} 的身心消耗。'
  },
  train_response: {
    id: 'train_response', name: '训练回应', category: 'training', durationMinutes: 20,
    requiresCondition: { consciousness: ['awake'] },
    effects: { char: { trained: +6, compliance: +4, shame: +10 }, state: { distortion: +3 } },
    prompt: '玩家训练 {{char}} 对特定信号（名字、哨声、命令）做出预设回应。这是条件反射的建立。'
  },
  train_feeding: {
    id: 'train_feeding', name: '训练进食方式', category: 'training', durationMinutes: 30,
    requiresCondition: { consciousness: ['awake'] },
    effects: { char: { trained: +8, shame: +18, compliance: +6, hunger: -30 }, state: { distortion: +8 } },
    prompt: '玩家训练 {{char}} 以特定方式进食——从食盆、用手、或以某种姿势。这是最有效也最伤人的训练之一。{{char}} 的饥饿与羞耻在博弈。'
  },
  
  // ==== 身体接触动作（中等深度） ====
  touch_hair: {
    id: 'touch_hair', name: '抚摸头发', category: 'touch', durationMinutes: 10,
    requiresCondition: { consciousness: ['awake', 'dazed', 'asleep'] },
    effects: { char: { mood: +1, sincerity: +1, arousal: +1 } },
    prompt: '玩家抚摸 {{char}} 的头发。这是最温柔的动作——但在囚禁情境下，温柔本身就是扭曲。描写 {{char}} 对这个触碰的反应——僵硬、放松、或矛盾的舒适。重要：根据当前阶段，反应可能是厌恶（震惊期）、警惕（对抗期）、或微妙的默许（后期）。'
  },
  touch_face: {
    id: 'touch_face', name: '触摸脸庞', category: 'touch', durationMinutes: 10,
    requiresCondition: { consciousness: ['awake', 'dazed', 'asleep'] },
    effects: { char: { sincerity: +2, mood: +1, arousal: +2, shame: +2 } },
    prompt: '玩家触摸 {{char}} 的脸——指腹划过脸颊、下颌、唇。极近距离的动作，{{char}} 的呼吸变化、目光躲避、或对视的瞬间。早期阶段 {{char}} 可能试图避开或颤抖。'
  },
  hold_hand: {
    id: 'hold_hand', name: '牵/握手', category: 'touch', durationMinutes: 15,
    requiresCondition: { consciousness: ['awake', 'dazed'] },
    effects: { char: { mood: +2, sincerity: +2, compliance: +1 }, state: { distortion: +1 } },
    prompt: '玩家握住 {{char}} 的手。描写手掌接触的温度、{{char}} 是否挣扎或静止、两人之间的寂静。早期阶段抗拒可能很强。'
  },
  embrace: {
    id: 'embrace', name: '拥抱', category: 'touch', durationMinutes: 20,
    requiresCondition: { consciousness: ['awake', 'dazed'] },
    effects: { char: { mood: +3, sincerity: +3, arousal: +3, compliance: +2 }, state: { distortion: +3 } },
    prompt: '玩家拥抱 {{char}}。长时间的身体接触——{{char}} 能闻到玩家的气味、感受心跳。一切的矛盾在这个动作中达到顶峰。描写 {{char}} 从抗拒到放松到抗拒自己的放松的过程。'
  },
  brush_hair: {
    id: 'brush_hair', name: '梳头', category: 'care', durationMinutes: 20,
    requiresToy: 'toy_brush',
    requiresCondition: { consciousness: ['awake', 'dazed'] },
    effects: { char: { mood: +4, sincerity: +3, health: +1, trained: +2 } },
    prompt: '玩家用梳子为 {{char}} 梳头。这是最像"日常生活"的动作——但 {{char}} 不能动。描写这段时间的漫长、安静、以及 {{char}} 在梳子穿过头发的触感中的心理变化。早期阶段 {{char}} 可能感到极度不适和羞辱。'
  },
  
  // ==== 约束操作 ====
  bind_wrists: {
    id: 'bind_wrists', name: '束缚手腕', category: 'bondage', durationMinutes: 10,
    requiresToy: ['toy_handcuff_soft', 'toy_handcuff_metal', 'toy_rope_soft'],
    requiresCondition: { consciousness: ['awake', 'dazed', 'drugged'] },
    effects: { char: { compliance: +8, shame: +10, mood: -5 }, state: { distortion: +5 } },
    prompt: '玩家束缚 {{char}} 的手腕。描写束缚过程——{{char}} 是抗拒、顺从、还是已经习惯？束缚后身体的紧绷感。'
  },
  bind_full: {
    id: 'bind_full', name: '全身束缚', category: 'bondage', durationMinutes: 30,
    requiresToy: ['toy_rope_soft', 'toy_rope_decorative', 'toy_chain_heavy'],
    requiresCondition: { consciousness: ['awake', 'dazed', 'drugged'] },
    effects: { char: { compliance: +15, shame: +20, sincerity: -10, mood: -10 }, state: { distortion: +12 } },
    prompt: '玩家对 {{char}} 进行完整的束缚。整个过程——每一道绳索、每一次调整——都是漫长的仪式。描写 {{char}} 在这个过程中的心理剥离。'
  },
  
  // ==== 刺激动作（R18 档位） ====
  tease_light: {
    id: 'tease_light', name: '轻度挑逗', category: 'stimulation', durationMinutes: 20,
    requiresDepth: 'body',
    requiresCondition: { consciousness: ['awake', 'dazed'] },
    effects: { char: { arousal: +15, shame: +10, sincerity: +3 }, state: { distortion: +5 } },
    prompt: '玩家以非直接的方式挑逗 {{char}}——靠近、呼吸声、指尖划过、在敏感区域附近停留但不触碰。描写 {{char}} 身体的不自主反应与心理的抗拒之间的战争。'
  },
  stimulate_direct: {
    id: 'stimulate_direct', name: '直接刺激', category: 'stimulation', durationMinutes: 30,
    requiresDepth: 'r18',
    requiresCondition: { consciousness: ['awake', 'dazed'] },
    effects: { char: { arousal: +30, shame: +18, sincerity: +8, stamina: -10 }, state: { distortion: +8 } },
    prompt: '玩家对 {{char}} 进行直接的身体刺激（手、嘴、道具）。描写身体反应与心理拉扯的细节。{{char}} 的声音、动作、眼神变化。'
  },
  use_toy_stimulation: {
    id: 'use_toy_stimulation', name: '使用刺激道具', category: 'stimulation', durationMinutes: 25,
    requiresToy: ['toy_vibrator_small', 'toy_vibrator_strong', 'toy_feather', 'toy_ice', 'toy_hot_wax', 'toy_electro_mild'],
    requiresCondition: { consciousness: ['awake', 'dazed'] },
    effects: { char: { arousal: +25, shame: +15 }, state: { distortion: +5 } },
    prompt: '玩家使用道具对 {{char}} 进行刺激。根据道具类型（震动/羽毛/冰/热/电）描写不同的感官体验与 {{char}} 的反应。'
  },
  edge: {
    id: 'edge', name: '边缘控制', category: 'stimulation', durationMinutes: 45,
    requiresDepth: 'r18',
    requiresCondition: { consciousness: ['awake'] },
    effects: { char: { arousal: +40, shame: +20, sincerity: +15, sanity: -5, stamina: -15 }, state: { distortion: +10 } },
    prompt: '玩家反复让 {{char}} 接近高潮但不允许释放。这是心理与生理的双重折磨。描写长时间的拉扯——{{char}} 的请求、玩家的拒绝、身体的失控感。需要高水平的心理描写。'
  },
  
  // ==== 药物与意识控制 ====
  drug_sedative: {
    id: 'drug_sedative', name: '给予镇静剂', category: 'medical', durationMinutes: 15,
    requiresItem: ['sedative_otc', 'sedative_strong'],
    effects: { char: { sanity: -10, compliance: +15, sleep: -40, stamina: -15 }, state: { distortion: +5 } },
    statusChange: { consciousness: 'drugged' },
    prompt: '玩家给 {{char}} 使用镇静剂（通过食物/饮水/注射）。描写药效发作的过程——{{char}} 意识到被下药的瞬间、视野模糊、意志抵抗、最终滑入药效状态。'
  },
  
  // ==== 意识状态操作 ====
  wake_up: {
    id: 'wake_up', name: '唤醒 {{char}}', category: 'state_change', durationMinutes: 5,
    requiresCondition: { consciousness: ['asleep', 'dazed', 'drugged'] },
    effects: { char: { sleep: +5 } },
    statusChange: { consciousness: 'awake' },
    prompt: '玩家唤醒 {{char}}——摇晃、呼名、或其他方式。描写 {{char}} 从意识模糊到清醒的过程，以及意识到自己处境的瞬间（每一次醒来都是重新面对现实）。'
  },
  put_to_sleep: {
    id: 'put_to_sleep', name: '让 {{char}} 睡眠', category: 'state_change', durationMinutes: 480,
    requiresCondition: { consciousness: ['awake', 'dazed'] },
    effects: { char: { sleep: +60, stamina: +30, sanity: +5 } },
    statusChange: { consciousness: 'asleep' },
    prompt: '玩家要求/允许 {{char}} 睡眠。描写 {{char}} 努力入睡的过程——身体需要睡眠但环境让人警觉——最终沉入梦境。梦境可能出现（如果合适）。'
  }
};


// ============================================================
// [data/dialogue.js]
// ============================================================

/*
  src/data/dialogue.js —— 对话切入点库
  
  11 种对话基调，玩家选择切入点后进入专用对话模式
  
  扩展方法：添加新条目到 DIALOGUE_ENTRIES
  切入点结构：
    {
      id, name, category: 'dialogue',
      mood: 基调标识（casual/pressure/intimidation/tender/vulnerable/degrading/...）,
      tone: 一句话描述基调,
      requiresCondition: { consciousness: [...] } (可选),
      requiresStats: { compliance: 40, ... } (可选，数值门槛),
      openingEffects: { char: { ... } } (进入对话时立即应用),
      prompt: 给 AI 的叙事指导
    }
*/

const DIALOGUE_ENTRIES = {
  small_talk: {
    id: 'small_talk', name: '闲聊', category: 'dialogue',
    mood: 'casual', tone: '刻意放松的日常话题',
    requiresCondition: { consciousness: ['awake', 'dazed'] },
    openingEffects: { char: { mood: +2, sanity: +2 } },
    prompt: '玩家以闲聊的方式开启对话——像在普通的日常中那样，问些日常问题（今天感觉怎么样、想吃什么、喜欢什么音乐）。关键的恐怖感来自于——这种正常话题放在囚禁情境下的错位。以 Dialogue 模式展开，突出 {{char}} 对这种\"假装日常\"的复杂反应。'
  },
  interrogation: {
    id: 'interrogation', name: '审讯', category: 'dialogue',
    mood: 'pressure', tone: '质问、威压、信息探取',
    requiresCondition: { consciousness: ['awake'] },
    openingEffects: { char: { sanity: -3, mood: -5, sincerity: +3 } },
    prompt: '玩家以审讯的姿态开启对话——要求 {{char}} 回答问题，不接受沉默。以 Dialogue 模式展开，营造心理压迫感。{{char}} 可能选择对抗、沉默、谎言、或真相——取决于他/她的性格与当前状态。'
  },
  threat: {
    id: 'threat', name: '威胁', category: 'dialogue',
    mood: 'intimidation', tone: '明示或暗示的恐吓',
    requiresCondition: { consciousness: ['awake'] },
    openingEffects: { char: { mood: -8, compliance: +4, sanity: -3 } },
    prompt: '玩家用威胁性的语言（直接或含蓄）开启对话。暗示能对 {{char}} 做什么、外面的某人现在处境如何、如果不配合会怎样。以 Dialogue 模式展开，重点描写 {{char}} 听到威胁时的微表情变化和身体反应。'
  },
  seduction: {
    id: 'seduction', name: '温柔诱导', category: 'dialogue',
    mood: 'tender', tone: '异常柔软、诱导式、病态温柔',
    requiresCondition: { consciousness: ['awake', 'dazed'] },
    openingEffects: { char: { mood: +3, sincerity: -2 }, state: { distortion: +3 } },
    prompt: '玩家以异常温柔的语气开启对话——表现得像真正关心 {{char}}，说甜言蜜语、嘘寒问暖、解释\"为什么这样做\"。关键恐怖感：这种温柔比粗暴更让 {{char}} 混乱。以 Dialogue 模式，重点描写 {{char}} 面对扭曲温柔时的矛盾反应。'
  },
  humiliation_talk: {
    id: 'humiliation_talk', name: '羞辱', category: 'dialogue',
    mood: 'degrading', tone: '贬低、嘲弄、侮辱',
    requiresCondition: { consciousness: ['awake'] },
    openingEffects: { char: { shame: +15, mood: -10, sincerity: +3 }, state: { distortion: +5 } },
    prompt: '玩家用羞辱性的语言——贬低、嘲讽、揭短、强调 {{char}} 的无力。以 Dialogue 模式展开，重点描写 {{char}} 听到时的屈辱反应——愤怒反抗、沉默承受、或内化——取决于性格。'
  },
  probe_past: {
    id: 'probe_past', name: '探问过去', category: 'dialogue',
    mood: 'invasive', tone: '刻意挖掘 {{char}} 的过去',
    requiresCondition: { consciousness: ['awake'] },
    openingEffects: { char: { sanity: -5, sincerity: +8, mood: -5 } },
    prompt: '玩家刻意询问 {{char}} 的过去——童年、创伤、秘密、不愿提起的人或事。玩家可能早已通过某些渠道了解（监视、资料收集），问题带着\"我知道\"的味道。以 Dialogue 模式展开，重点描写 {{char}} 被刺中要害时的反应。'
  },
  confession: {
    id: 'confession', name: '表白/坦白', category: 'dialogue',
    mood: 'vulnerable', tone: '玩家向 {{char}} 展示自己',
    requiresCondition: { consciousness: ['awake', 'dazed'] },
    openingEffects: { char: { sanity: -3, sincerity: +5, mood: +2 }, state: { distortion: +10 } },
    prompt: '玩家向 {{char}} 吐露某种自己的真相——为什么选择囚禁、玩家自己的过去、对 {{char}} 的真实情感。关键恐怖感：玩家的坦诚不会让情况变好，反而加深 {{char}} 的困境。以 Dialogue 模式，重点描写 {{char}} 听完后的复杂情绪。'
  },
  silence_sit: {
    id: 'silence_sit', name: '沉默陪伴', category: 'dialogue',
    mood: 'still', tone: '不说话，只是在场',
    requiresCondition: {},
    openingEffects: { char: { sanity: -3, mood: -3 }, state: { distortion: +5 } },
    prompt: '玩家进入房间，什么也不说，只是坐在那里看 {{char}}。持续的凝视比任何话都难受。以 Dialogue 模式（或介于 Dialogue 与 Observation 之间的静态模式），重点描写 {{char}} 在长时间无言注视下的心理变化——从恼怒到不安到试图打破沉默到最终的压抑。'
  },
  
  // 需要特定条件才能开启的对话类型
  check_in: {
    id: 'check_in', name: '关心询问', category: 'dialogue',
    mood: 'concerned', tone: '关怀式问候',
    requiresCondition: { consciousness: ['awake', 'dazed'] },
    requiresStats: { compliance: 40 },  // 需要基础的互动意愿
    openingEffects: { char: { mood: +5, sincerity: +5 } },
    prompt: '玩家询问 {{char}} 的身体感受、是否冷、是否饿、是否需要什么。关键：真心还是表演？{{char}} 也在判断。以 Dialogue 模式展开。'
  },
  praise: {
    id: 'praise', name: '夸奖', category: 'dialogue',
    mood: 'rewarding', tone: '赞美、肯定、表扬',
    requiresCondition: { consciousness: ['awake'] },
    requiresStats: { trained: 20 },
    openingEffects: { char: { mood: +8, trained: +5, sincerity: +3 }, state: { distortion: +3 } },
    prompt: '玩家对 {{char}} 最近的某个行为表示赞许——表现好、学得快、配合度高等。对 {{char}} 来说接受夸奖意味着什么？抗拒？窃喜？自我厌恶？以 Dialogue 模式展开。'
  },
  command: {
    id: 'command', name: '下达命令', category: 'dialogue',
    mood: 'authority', tone: '命令式',
    requiresCondition: { consciousness: ['awake'] },
    openingEffects: { char: { compliance: +5, sincerity: -3, trained: +3 } },
    prompt: '玩家下达一个具体的命令——要求 {{char}} 做某个动作、说某句话、以某种方式回应。{{char}} 的反应是拒绝、被迫服从、或条件反射式服从。以 Dialogue 模式展开。'
  }
};


// ============================================================
// [data/risks.js]
// ============================================================

/*
  src/data/risks.js —— 风险事件库
  
  外出场景时可能触发的事件（熟人、警察、目击者等）
  扩展方法：
    1. 添加新条目到 RISK_EVENT_LIBRARY
    2. 在 scenes.js 的某个外部场景里加入 { id: 'xxx', probability: 0.x }
  
  事件结构：
    {
      id, severity: 'low' | 'medium' | 'high',
      prompt: 给 AI 的叙事指导
    }
*/

const RISK_EVENT_LIBRARY = {
  meet_acquaintance: {
    id: 'meet_acquaintance', severity: 'medium',
    prompt: '在外出场景中，玩家遇到了一位熟人（同事/同学/邻居）。对方询问近况。以 Tension 模式描写玩家必须伪装正常的心跳加速时刻。'
  },
  surveillance_check: {
    id: 'surveillance_check', severity: 'low',
    prompt: '玩家感觉被监控摄像头注视。描写一瞬间的紧张。'
  },
  suspicious_purchase: {
    id: 'suspicious_purchase', severity: 'medium',
    prompt: '玩家的购买组合（例如大量食物+药品+清洁用品）引起收银员侧目。描写玩家的内心紧张与应对。'
  },
  pharmacist_question: {
    id: 'pharmacist_question', severity: 'medium',
    prompt: '药剂师盘问玩家购买某种药物的用途。以 Tension 模式描写玩家编造理由的过程。'
  },
  prescription_required: {
    id: 'prescription_required', severity: 'low',
    prompt: '玩家想买的药物需要处方，被拒绝。描写玩家的应对。'
  },
  stranger_gaze: {
    id: 'stranger_gaze', severity: 'low',
    prompt: '一个陌生人在街上长时间注视玩家。可能只是偶然，也可能不是。描写玩家的警觉。'
  },
  police_patrol: {
    id: 'police_patrol', severity: 'high',
    prompt: '玩家遇到警察巡逻。以 Tension 模式描写玩家必须保持镇定、避免可疑动作的过程。'
  },
  missing_poster: {
    id: 'missing_poster', severity: 'medium',
    prompt: '玩家看到街头的寻人启事（或许就是 {{char}} 的）。描写玩家看到时的内心反应。'
  },
  stranger_approach: {
    id: 'stranger_approach', severity: 'low',
    prompt: '咖啡厅里有陌生人主动搭话。描写这段短暂、不自在的互动。'
  },
  overheard_conversation: {
    id: 'overheard_conversation', severity: 'low',
    prompt: '玩家无意中听到附近桌的人谈论某个与 {{char}} 相关的话题。描写玩家的反应。'
  },
  
  // ---- 身份限定风险 ----
  roommate_suspicion: {
    id: 'roommate_suspicion', severity: 'medium',
    prompt: '室友/家人察觉了玩家的异常——归来时间奇怪、表情不对、经常心不在焉。描写这段尴尬的对话和玩家的应对。'
  },
  boss_notice: {
    id: 'boss_notice', severity: 'medium',
    prompt: '上司/领导注意到玩家最近的状态变化。可能是关心（效率下降？有什么困扰？）也可能是警觉（你最近在外面忙什么？）。描写这段正式又微妙的谈话。'
  },
  suspicious_search: {
    id: 'suspicious_search', severity: 'high',
    prompt: '玩家在公共电脑/网络上搜索了某些敏感内容。也许是下次登录时的某个警示、也许是某人路过看到屏幕的一瞥、也许只是玩家事后的不安。描写这种留下痕迹后的心理压力。'
  }
};


// ============================================================
// [data/custom_templates.js]
// ============================================================

/*
  src/data/custom_templates.js —— 自定义动作的基础模板
  
  玩家自由输入动作描述时，选择一个类别；引擎根据类别应用基础数值变化。
  AI 会根据玩家的文字描述生成叙事，尊重玩家的创意。
  
  扩展方法：添加新模板到 CUSTOM_ACTION_TEMPLATES
  模板结构：
    {
      label: '显示给玩家看的名字',
      effects: { char: { ... }, state: { ... } },
      durationMinutes: 默认时长,
      requiresDepth: 'body' | 'r18' (可选)
    }
*/

const CUSTOM_ACTION_TEMPLATES = {
  touch_gentle:      { label: '温柔触碰', effects: { char: { mood: +1, sincerity: +1, arousal: +1, shame: +1 } }, durationMinutes: 10 },
  touch_rough:       { label: '粗暴接触', effects: { char: { mood: -3, sanity: -2, compliance: +2, shame: +4, health: -1 } }, durationMinutes: 10 },
  stimulation_mild:  { label: '轻度刺激', effects: { char: { arousal: +4, shame: +3, sanity: -1 } }, durationMinutes: 15, requiresDepth: 'body' },
  stimulation_heavy: { label: '强烈刺激', effects: { char: { arousal: +8, shame: +6, stamina: -4, sanity: -3 }, state: { distortion: +2 } }, durationMinutes: 25, requiresDepth: 'r18' },
  training_soft:     { label: '温和训练', effects: { char: { trained: +3, compliance: +2, mood: -1 } }, durationMinutes: 20 },
  training_harsh:    { label: '严苛训练', effects: { char: { trained: +5, compliance: +4, mood: -6, sanity: -3, shame: +5 }, state: { distortion: +3 } }, durationMinutes: 30 },
  verbal_sweet:      { label: '温柔言语', effects: { char: { mood: +1, sincerity: +1 } }, durationMinutes: 5 },
  verbal_harsh:      { label: '恶意言语', effects: { char: { mood: -5, sanity: -2, shame: +3, compliance: +1 } }, durationMinutes: 5 },
  punishment:        { label: '惩罚', effects: { char: { mood: -8, compliance: +5, sanity: -3, health: -3, shame: +6 }, state: { distortion: +4 } }, durationMinutes: 20 },
  reward:            { label: '奖励', effects: { char: { mood: +3, sincerity: +2, trained: +3, compliance: +2 } }, durationMinutes: 10 },
  observe:           { label: '观察（无接触）', effects: { char: { sanity: -1, shame: +2 } }, durationMinutes: 15 },
  neutral:           { label: '中性动作', effects: {}, durationMinutes: 10 }
};


// ============================================================
// [core/effects.js]
// ============================================================

/*
  src/core/effects.js —— 状态变化核心逻辑
  
  包含：
  - clamp / clampStats: 数值边界限制
  - classifyEffect: 判断数值变化类别（用于阶段乘数）
  - getRepeatDecayMultiplier: 重复衰减计算
  - applyEffects: 应用状态变化（含阶段乘数+重复衰减的核心）
  - recordAction: 记录动作用于衰减追踪
  
  依赖：STATE, STAT_MIN/MAX, STAGE_MULTIPLIERS, REPEAT_DECAY, EventBus
  被依赖：大部分系统函数都会调用 applyEffects
*/

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// 限制所有状态值在 [0, 100] 之间
function clampStats() {
  ['sanity', 'mood', 'sincerity', 'compliance', 'stamina', 'hunger', 'sleep', 'health',
   'arousal', 'shame', 'trained'].forEach(k => {
    if (STATE.char[k] !== undefined) {
      STATE.char[k] = clamp(STATE.char[k], STAT_MIN, STAT_MAX);
    }
  });
  STATE.state.distortion = clamp(STATE.state.distortion, 0, 100);
  STATE.state.riskLevel = clamp(STATE.state.riskLevel, 0, 100);
}

// 判断某个数值变化属于哪一类（正向/负向/身体/训练/扭曲）
function classifyEffect(key, delta) {
  if (key === 'trained') return 'training';
  if (key === 'distortion') return 'distortion';
  if (key === 'arousal' || key === 'shame') return 'physical';
  
  if (['mood', 'sincerity', 'compliance'].includes(key)) {
    return delta > 0 ? 'positive' : 'negative';
  }
  if (key === 'sanity') {
    return delta < 0 ? 'negative' : 'positive';
  }
  return null;
}

// 计算重复衰减乘数
function getRepeatDecayMultiplier(actionId) {
  if (!actionId) return 1.0;
  
  const recent = STATE.recentActions;
  let consecutiveCount = 0;
  for (let i = recent.length - 1; i >= 0; i--) {
    if (recent[i].actionId === actionId) {
      consecutiveCount++;
    } else {
      break;
    }
  }
  
  if (consecutiveCount < REPEAT_DECAY.threshold) return 1.0;
  
  const excessRepeats = consecutiveCount - REPEAT_DECAY.threshold + 1;
  const multiplier = Math.pow(REPEAT_DECAY.decayFactor, excessRepeats);
  return Math.max(multiplier, REPEAT_DECAY.minMultiplier);
}

// 应用状态变化（含阶段乘数 + 重复衰减）
function applyEffects(effects, actionId) {
  if (!effects) return;
  
  const currentStage = STATE.time.stage;
  const repeatMultiplier = getRepeatDecayMultiplier(actionId);
  
  if (effects.char) {
    Object.keys(effects.char).forEach(k => {
      let delta = effects.char[k];
      const category = classifyEffect(k, delta);
      
      if (category && STAGE_MULTIPLIERS[category]) {
        const stageMultiplier = STAGE_MULTIPLIERS[category][currentStage] || 1.0;
        delta = delta * stageMultiplier;
      }
      
      delta = delta * repeatMultiplier;
      delta = Math.round(delta);
      
      STATE.char[k] = (STATE.char[k] || 0) + delta;
    });
  }
  
  if (effects.state) {
    Object.keys(effects.state).forEach(k => {
      let delta = effects.state[k];
      const category = classifyEffect(k, delta);
      
      if (category && STAGE_MULTIPLIERS[category]) {
        const stageMultiplier = STAGE_MULTIPLIERS[category][currentStage] || 1.0;
        delta = delta * stageMultiplier;
      }
      delta = delta * repeatMultiplier;
      delta = Math.round(delta);
      
      STATE.state[k] = (STATE.state[k] || 0) + delta;
    });
  }
  
  clampStats();
  checkMilestones();
  EventBus.emit('stateChanged', STATE);
}

// 记录动作用于重复衰减
function recordAction(actionId) {
  if (!actionId) return;
  STATE.recentActions.push({ actionId: actionId, timestamp: Date.now() });
  if (STATE.recentActions.length > 10) STATE.recentActions.shift();
}


// ============================================================
// [core/milestones.js]
// ============================================================

/*
  src/core/milestones.js —— 关键时刻提示系统
  
  检查数值是否跨越阈值，触发 milestonesTriggered 事件
  每个阈值只会触发一次（STATE.triggeredMilestones 记录已触发的）
  
  依赖：STATE, MILESTONES, EventBus
*/

function checkMilestones() {
  const triggered = [];
  
  Object.keys(MILESTONES).forEach(key => {
    let statValue;
    if (key === 'distortion') statValue = STATE.state.distortion;
    else if (STATE.char[key] !== undefined) statValue = STATE.char[key];
    else return;
    
    MILESTONES[key].forEach(m => {
      if (STATE.triggeredMilestones.has(m.key)) return;
      const condition = m.direction === 'above' ? statValue >= m.value : statValue <= m.value;
      if (condition) {
        STATE.triggeredMilestones.add(m.key);
        triggered.push(m);
      }
    });
  });
  
  if (triggered.length > 0) {
    EventBus.emit('milestonesTriggered', triggered);
  }
  return triggered;
}


// ============================================================
// [core/time.js]
// ============================================================

/*
  src/core/time.js —— 时间与日志系统
  
  - advanceTime: 推进时间（分钟级），跨越小时/天时自动触发相应事件
  - updateStage: 根据天数更新当前阶段
  - addLog: 添加日志条目
  
  依赖：STATE, STAGES, EventBus, applyEffects（每日自然消耗时调用）
*/

function advanceTime(minutes) {
  STATE.time.minute += minutes;
  while (STATE.time.minute >= 60) {
    STATE.time.minute -= 60;
    STATE.time.hour += 1;
  }
  while (STATE.time.hour >= 24) {
    STATE.time.hour -= 24;
    STATE.time.day += 1;
    // 每过一天，应用"自然消耗"
    applyEffects({
      char: {
        hunger: +20,   // 每天自然增加饥饿感
        stamina: -5,   // 自然消耗体力
        sanity: -2     // 长期囚禁对理智的缓慢消耗
      }
    });
  }
  updateStage();
  EventBus.emit('timeChanged', STATE.time);
}

function updateStage() {
  const day = STATE.time.day;
  for (const s of STAGES) {
    if (day >= s.dayMin && day <= s.dayMax) {
      if (STATE.time.stage !== s.id) {
        STATE.time.stage = s.id;
        EventBus.emit('stageChanged', s);
        addLog('stage', `进入${s.name}（第 ${day} 天）`);
      }
      return;
    }
  }
}

function addLog(type, text) {
  STATE.log.push({
    timestamp: `D${STATE.time.day} ${String(STATE.time.hour).padStart(2,'0')}:${String(STATE.time.minute).padStart(2,'0')}`,
    type: type,
    text: text
  });
  if (STATE.log.length > 200) STATE.log.shift();
  EventBus.emit('logAdded', STATE.log[STATE.log.length - 1]);
}


// ============================================================
// [core/conditions.js]
// ============================================================

/*
  src/core/conditions.js —— 条件判定（门控系统）
  
  决定某个动作/对话/玩具是否可用：
  - checkConditions: 物理状态条件（意识、位置等）
  - checkStatRequirements: 数值门槛条件
  - checkDepthRequirement: 深度档位门控（psych/body/r18）
  
  依赖：STATE
*/

function checkConditions(requirements) {
  if (!requirements) return { ok: true };
  
  if (requirements.consciousness) {
    const current = STATE.charStatus.consciousness;
    if (!requirements.consciousness.includes(current)) {
      return { ok: false, reason: 'consciousness', required: requirements.consciousness, current: current };
    }
  }
  
  if (requirements.position) {
    const current = STATE.charStatus.position;
    if (!requirements.position.includes(current)) {
      return { ok: false, reason: 'position', required: requirements.position, current: current };
    }
  }
  
  return { ok: true };
}

function checkStatRequirements(requirements) {
  if (!requirements) return { ok: true };
  for (const key in requirements) {
    const requiredValue = requirements[key];
    const currentValue = STATE.char[key] || 0;
    if (currentValue < requiredValue) {
      return { ok: false, reason: 'stats', stat: key, required: requiredValue, current: currentValue };
    }
  }
  return { ok: true };
}

function checkDepthRequirement(requiredDepth) {
  if (!requiredDepth) return true;
  const depthRank = { psych: 1, body: 2, r18: 3 };
  const currentRank = depthRank[STATE.config.depth] || 1;
  const requiredRank = depthRank[requiredDepth] || 1;
  return currentRank >= requiredRank;
}


// ============================================================
// [core/inventory.js]
// ============================================================

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


// ============================================================
// [core/context.js]
// ============================================================

/*
  src/core/context.js —— AI 上下文包构建器
  
  这是引擎与 AI 的接口：把所有状态打包成结构化 JSON
  AI 在 Lorebook 规则指导下解读这个 JSON 生成叙事
  
  依赖：STATE, VERSION, SCENE_LIBRARY, ACTION_LIBRARY, TRAINING_ACTIONS,
        STAGES, TOY_LIBRARY
*/

// ============================================================
// 叙事模式的镜头/视角提示
// 
// 原则：
// - 只描述"镜头怎么拍、视角在哪、景别多大、节奏如何"
// - 不预设 char 的反应、心情、状态、服从度
// - 不暗示"应该写什么情绪"或"应该让 char 做什么"
// 
// 这些提示会被塞进 AI 看到的 prompt，用于引导叙事风格
// 但不对 char 的表演做任何指导
// ============================================================
const NARRATION_HINTS = {
  observation: '模式:远程监控观察。user 与 char 不在同一空间,user 正透过监控设备观察 char。以上帝视角客观描写 char 此刻的所见所为,聚焦环境细节与 char 的自然举动,不进入 user 视角。',
  
  // dialogue 模式暂不注入提示（phone 道具落地后再统一规划）
  dialogue: null,
  
  intimate: '模式:线下近距接触。user 与 char 处于同一空间且有直接互动。聚焦两人之间的行为、对话与感官细节,以场景实景的镜头感展开,避免跳脱到旁白或远景。',
  
  outside: '模式:外部场景。描写 user 离开囚禁空间后在外部世界的经历与见闻(如超市、街头、药店等)。此模式下 char 处于认知隔离状态,无法得知 user 在外的任何事件,叙事不应出现 char 的视角或感知。',
  
  // tension 合并到 outside：使用相同文案，风险事件本身由 trigger.riskEvent 传达
  tension: '模式:外部场景。描写 user 离开囚禁空间后在外部世界的经历与见闻(如超市、街头、药店等)。此模式下 char 处于认知隔离状态,无法得知 user 在外的任何事件,叙事不应出现 char 的视角或感知。'
};

function buildContextPacket(trigger) {
  // 选择叙事模式
  let mode = 'observation';
  if (STATE.state.inDialogue) {
    mode = 'dialogue';
  }
  if (trigger && trigger.triggerType === 'scene') {
    const scene = SCENE_LIBRARY[trigger.triggerId];
    if (scene && scene.type === 'external') mode = 'outside';
    // 风险事件不再切成独立的 tension，而是合并到 outside
    // （tension 文案与 outside 一致，事件细节通过 trigger.riskEvent 单独传达）
    if (trigger.riskEvent) mode = 'outside';
  } else if (trigger && trigger.triggerType === 'action') {
    const action = ACTION_LIBRARY[trigger.triggerId] || TRAINING_ACTIONS[trigger.triggerId];
    if (action) {
      if (action.category === 'contact') mode = 'dialogue';
      if (action.category === 'touch' || action.category === 'stimulation') mode = 'intimate';
      if (action.category === 'bondage' || action.category === 'training') mode = 'intimate';
    }
  } else if (trigger && trigger.triggerType === 'dialogue_start') {
    mode = 'dialogue';
  }
  
  return {
    meta: {
      version: VERSION,
      mode: mode,
      narrationHint: NARRATION_HINTS[mode] || null,
      config: STATE.config,
      depth: STATE.config.depth || 'psych'
    },
    time: {
      day: STATE.time.day,
      hour: STATE.time.hour,
      stage: STATE.time.stage,
      stageName: STAGES.find(s => s.id === STATE.time.stage)?.name,
      stageTone: STAGES.find(s => s.id === STATE.time.stage)?.tone
    },
    location: STATE.location,
    char: { ...STATE.char },
    charStatus: { ...STATE.charStatus },
    relationship: { ...STATE.state },
    inventory: { ...STATE.inventory },
    equippedToys: STATE.charStatus.toysEquipped.map(id => ({
      id: id,
      name: TOY_LIBRARY[id]?.name || id,
      category: TOY_LIBRARY[id]?.category
    })),
    dialogue: STATE.state.inDialogue ? STATE.state.dialogueContext : null,
    trigger: trigger || null,
    recentLogs: STATE.log.slice(-5)
  };
}

// ============================================================
// [core/risks.js]
// ============================================================

/*
  src/core/risks.js —— 风险事件判定
  
  rollRisk: 在场景切换时掷骰判定是否触发风险事件
  风险值越高，触发概率倍增（玩家越不小心越容易暴露）
  
  依赖：STATE, SCENE_LIBRARY, RISK_EVENT_LIBRARY
*/

function rollRisk(sceneId) {
  const scene = SCENE_LIBRARY[sceneId];
  if (!scene || !scene.riskEvents) return null;
  
  // 风险值越高，触发概率倍增
  const riskMultiplier = 1 + STATE.state.riskLevel / 100;
  
  for (const risk of scene.riskEvents) {
    if (Math.random() < risk.probability * riskMultiplier) {
      return RISK_EVENT_LIBRARY[risk.id];
    }
  }
  return null;
}


// ============================================================
// [systems/toys.js]
// ============================================================

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


// ============================================================
// [systems/dialogue.js]
// ============================================================

/*
  src/systems/dialogue.js —— 对话模式管理
  
  - enterDialogueMode: 进入某个对话切入点（闲聊、审讯等）
  - exitDialogueMode: 退出对话模式
  
  进入时检查条件，应用开场效果，返回给 AI 的上下文包
  依赖：STATE, DIALOGUE_ENTRIES, EventBus, checkConditions,
        checkStatRequirements, applyEffects, addLog, buildContextPacket
*/

function enterDialogueMode(entryId) {
  const entry = DIALOGUE_ENTRIES[entryId];
  if (!entry) return null;
  
  // 检查条件
  const condCheck = checkConditions(entry.requiresCondition);
  if (!condCheck.ok) return { blocked: true, reason: condCheck };
  
  const statCheck = checkStatRequirements(entry.requiresStats);
  if (!statCheck.ok) return { blocked: true, reason: statCheck };
  
  STATE.state.inDialogue = true;
  STATE.state.dialogueContext = {
    entryId: entryId,
    entry: entry,
    startTime: { day: STATE.time.day, hour: STATE.time.hour, minute: STATE.time.minute },
    turns: 0
  };
  
  // 应用开场影响
  if (entry.openingEffects) {
    applyEffects(entry.openingEffects);
  }
  
  addLog('dialogue', `进入对话模式: ${entry.name}`);
  
  const packet = buildContextPacket({
    triggerType: 'dialogue_start',
    triggerId: entryId,
    triggerPrompt: entry.prompt
  });
  
  EventBus.emit('dialogueStarted', { entry: entry, packet: packet });
  return packet;
}

function exitDialogueMode() {
  if (!STATE.state.inDialogue) return null;
  
  const context = STATE.state.dialogueContext;
  STATE.state.inDialogue = false;
  STATE.state.dialogueContext = null;
  
  addLog('dialogue', `退出对话模式（持续 ${context ? context.turns : 0} 轮）`);
  EventBus.emit('dialogueEnded', { context: context });
  return context;
}


// ============================================================
// [98_api.js]
// ============================================================

/*
  src/98_api.js —— 公开 API 对象
  
  InPalmEngine 是玩家/UI 与引擎交互的唯一入口
  所有内部函数通过这个对象的方法暴露出去
  
  API 分类：
  - 初始化: init
  - 动作执行: action, customAction, executePreset, visitScene
  - 对话管理: enterDialogue, exitDialogue
  - 玩具管理: equipToy, unequipToy, purchaseToy
  - 预设管理: saveCustomPreset, deleteCustomPreset, getCustomPresets
  - 物品购买: purchase
  - 查询: getState, getContextPacket, getAvailableActions, getAvailableDialogues
  - 工具: advanceTime, endSession, on
  - 静态数据: data, customActionTemplates
*/

const InPalmEngine = {
  VERSION: VERSION,
  
  init: function(config) {
    Object.assign(STATE.config, config || {});
    STATE.initialized = true;
    addLog('system', '系统初始化完成。{{char}} 已被囚禁。');
    EventBus.emit('initialized', STATE);
  },
  
  // 执行一个动作（按钮点击时调用）
  action: function(actionId, params) {
    // 同时查找 ACTION_LIBRARY 和 TRAINING_ACTIONS
    const action = ACTION_LIBRARY[actionId] || TRAINING_ACTIONS[actionId];
    if (!action) {
      console.error('Unknown action:', actionId);
      return null;
    }
    
    // 检查深度档位
    if (action.requiresDepth && !checkDepthRequirement(action.requiresDepth)) {
      EventBus.emit('actionBlocked', { reason: 'depth_locked', requires: action.requiresDepth });
      return null;
    }
    
    // 检查物理条件
    if (action.requiresCondition) {
      const condCheck = checkConditions(action.requiresCondition);
      if (!condCheck.ok) {
        EventBus.emit('actionBlocked', { reason: 'condition', detail: condCheck });
        return null;
      }
    }
    
    // 检查物品要求
    if (action.requiresItem) {
      const required = Array.isArray(action.requiresItem) ? action.requiresItem : [action.requiresItem];
      const hasOne = required.some(id => STATE.inventory[id] > 0);
      if (!hasOne) {
        EventBus.emit('actionBlocked', { reason: 'missing_item', required: required });
        return null;
      }
      for (const id of required) {
        if (STATE.inventory[id] > 0) {
          removeItem(id, 1);
          break;
        }
      }
    }
    
    // 检查玩具要求
    if (action.requiresToy) {
      const required = Array.isArray(action.requiresToy) ? action.requiresToy : [action.requiresToy];
      if (required[0] !== '*') {
        const hasEquipped = required.some(id => STATE.charStatus.toysEquipped.includes(id));
        if (!hasEquipped) {
          EventBus.emit('actionBlocked', { reason: 'missing_toy', required: required });
          return null;
        }
      }
    }
    
    advanceTime(action.durationMinutes || 10);
    applyEffects(action.effects, actionId);
    recordAction(actionId);
    
    if (action.statusChange) {
      Object.assign(STATE.charStatus, action.statusChange);
      EventBus.emit('statusChanged', STATE.charStatus);
    }
    
    addLog('action', action.name);
    
    if (STATE.state.inDialogue && STATE.state.dialogueContext) {
      STATE.state.dialogueContext.turns += 1;
    }
    
    const packet = buildContextPacket({
      triggerType: 'action',
      triggerId: actionId,
      triggerPrompt: action.prompt
    });
    
    EventBus.emit('actionPerformed', { action: action, packet: packet });
    return packet;
  },
  
  // 对话模式管理
  enterDialogue: function(entryId) { return enterDialogueMode(entryId); },
  exitDialogue: function() { return exitDialogueMode(); },
  
  // 玩具装备管理
  equipToy: function(toyId) { return equipToy(toyId); },
  unequipToy: function(toyId) { return unequipToy(toyId); },
  
  purchaseToy: function(toyId) {
    const toy = TOY_LIBRARY[toyId];
    if (!toy) return false;
    STATE.inventory[toyId] = (STATE.inventory[toyId] || 0) + 1;
    EventBus.emit('inventoryChanged', STATE.inventory);
    addLog('toy', `购入: ${toy.name}`);
    return true;
  },
  
  getAvailableActions: function(category) {
    const all = { ...ACTION_LIBRARY, ...TRAINING_ACTIONS };
    return Object.values(all).filter(action => {
      if (category && action.category !== category) return false;
      if (action.requiresDepth && !checkDepthRequirement(action.requiresDepth)) return false;
      if (action.requiresCondition && !checkConditions(action.requiresCondition).ok) return false;
      if (action.requiresStats && !checkStatRequirements(action.requiresStats).ok) return false;
      return true;
    });
  },
  
  getAvailableDialogues: function() {
    return Object.values(DIALOGUE_ENTRIES).filter(entry => {
      if (entry.requiresCondition && !checkConditions(entry.requiresCondition).ok) return false;
      if (entry.requiresStats && !checkStatRequirements(entry.requiresStats).ok) return false;
      return true;
    });
  },
  
  // 自定义动作模板（暴露给 UI 选择用）
  customActionTemplates: CUSTOM_ACTION_TEMPLATES,
  
  // 执行自定义动作
  customAction: function(params) {
    if (!params || !params.description) {
      console.error('customAction requires description');
      return null;
    }
    
    const template = this.customActionTemplates[params.category] || this.customActionTemplates.neutral;
    
    if (template.requiresDepth && !checkDepthRequirement(template.requiresDepth)) {
      EventBus.emit('actionBlocked', { reason: 'depth_locked', requires: template.requiresDepth });
      return null;
    }
    
    if (params.category !== 'observe' && params.category !== 'neutral') {
      const condCheck = checkConditions({ consciousness: ['awake', 'dazed', 'drugged', 'asleep'] });
      if (!condCheck.ok) {
        EventBus.emit('actionBlocked', { reason: 'condition', detail: condCheck });
        return null;
      }
    }
    
    const duration = params.customDuration || template.durationMinutes;
    advanceTime(duration);
    
    const virtualActionId = 'custom_' + (params.category || 'neutral');
    applyEffects(template.effects, virtualActionId);
    recordAction(virtualActionId);
    
    addLog('custom', `[${template.label}] ${params.description.substring(0, 40)}${params.description.length > 40 ? '...' : ''}`);
    
    const aiPrompt = `玩家执行了一个自定义动作。动作类别：${template.label}。玩家对动作的具体描述：「${params.description}」。请根据这段描述生成对应的叙事内容，尊重玩家的创意。严格遵守 Lorebook 中的叙事模式和状态解读规则，根据当前阶段（${STATE.time.stage}）和 {{char}} 的实际状态生成真实反应。`;
    
    const packet = buildContextPacket({
      triggerType: 'custom_action',
      triggerId: virtualActionId,
      triggerPrompt: aiPrompt,
      customDescription: params.description,
      customCategory: template.label
    });
    
    EventBus.emit('customActionPerformed', { params: params, packet: packet });
    return packet;
  },
  
  saveCustomPreset: function(preset) {
    if (!preset || !preset.name || !preset.description) return false;
    STATE.customActionPresets.push({
      name: preset.name,
      description: preset.description,
      category: preset.category || 'neutral',
      durationMinutes: preset.durationMinutes,
      notes: preset.notes || ''
    });
    EventBus.emit('customPresetsChanged', STATE.customActionPresets);
    return true;
  },
  
  deleteCustomPreset: function(index) {
    if (index < 0 || index >= STATE.customActionPresets.length) return false;
    STATE.customActionPresets.splice(index, 1);
    EventBus.emit('customPresetsChanged', STATE.customActionPresets);
    return true;
  },
  
  getCustomPresets: function() {
    return [...STATE.customActionPresets];
  },
  
  executePreset: function(index) {
    const preset = STATE.customActionPresets[index];
    if (!preset) return null;
    return this.customAction({
      description: preset.description,
      category: preset.category,
      customDuration: preset.durationMinutes
    });
  },
  
  // 公开的时间推进 API（用于调试/快进）
  advanceTime: function(minutes) {
    advanceTime(minutes || 60);
    EventBus.emit('stateChanged', STATE);
    return STATE.time;
  },
  
  // 访问外部场景
  visitScene: function(sceneId) {
    const scene = SCENE_LIBRARY[sceneId];
    if (!scene) return null;
    if (scene.type !== 'external') return null;
    
    STATE.location.current = sceneId;
    STATE.location.inCell = false;
    advanceTime(scene.durationHours * 60);
    
    const riskEvent = rollRisk(sceneId);
    if (riskEvent) {
      STATE.state.riskLevel += riskEvent.severity === 'high' ? 15 : riskEvent.severity === 'medium' ? 8 : 3;
      addLog('risk', `风险事件: ${riskEvent.id}`);
    }
    
    addLog('scene', `前往${scene.name}`);
    
    const packet = buildContextPacket({
      triggerType: 'scene',
      triggerId: sceneId,
      triggerPrompt: scene.narrativeHint,
      riskEvent: riskEvent
    });
    
    EventBus.emit('sceneVisited', { scene: scene, packet: packet });
    return packet;
  },
  
  // 购买消耗品
  purchase: function(itemId) {
    const item = ITEM_LIBRARY[itemId];
    if (!item) return false;
    addItem(itemId, 1);
    return true;
  },
  
  // 获取 AI 上下文包
  getContextPacket: function(trigger) { return buildContextPacket(trigger); },
  
  // 获取当前完整状态
  getState: function() { return JSON.parse(JSON.stringify(STATE)); },
  
  // 结束游戏
  endSession: function() {
    const packet = buildContextPacket({
      triggerType: 'end',
      triggerPrompt: '玩家主动结束了这段囚禁。基于 {{char}} 当前的所有状态值，自然地生成一个结束场景。不要套用任何预设模板，完全根据此刻的数值与累积的剧情，生成独一无二的结局。'
    });
    EventBus.emit('sessionEnded', packet);
    return packet;
  },
  
  // 事件订阅
  on: function(event, handler) { EventBus.on(event, handler); },
  
  // 静态数据访问
  data: {
    scenes: SCENE_LIBRARY,
    items: ITEM_LIBRARY,
    toys: TOY_LIBRARY,
    actions: ACTION_LIBRARY,
    trainingActions: TRAINING_ACTIONS,
    dialogueEntries: DIALOGUE_ENTRIES,
    risks: RISK_EVENT_LIBRARY,
    identityMap: IDENTITY_SCENES_MAP,
    stages: STAGES,
    milestones: MILESTONES
  }
};


// ============================================================
// [99_export.js]
// ============================================================

/*
  src/99_export.js —— 全局导出
  
  将 InPalmEngine 挂到全局对象
  在浏览器环境下是 window，node 环境下是 global/this
*/

global.InPalmEngine = InPalmEngine;


})(typeof window !== 'undefined' ? window : this);
