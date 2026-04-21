/*
  掌心的它 · In Your Palm —— 酒馆角色卡引擎
  
  !!! 此文件是自动生成的，请勿直接编辑 !!!
  要修改引擎，请编辑 src/ 下的对应源文件，然后运行 node build.js
  
  源文件清单（按加载顺序）：
    - 00_constants.js
    - 01_state.js
    - data/sources.js
    - data/palam.js
    - data/juels.js
    - data/imprints.js
    - data/personas.js
    - data/scenes.js
    - data/items.js
    - data/toys.js
    - data/actions.js
    - data/training.js
    - data/dialogue.js
    - data/risks.js
    - data/custom_templates.js
    - core/effects.js
    - core/session.js
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
  
  构建时间: 2026-04-21T04:19:46.008Z
*/

(function(global) {
'use strict';


// ============================================================
// [00_constants.js]
// ============================================================

/*
  掌心的它 · In Your Palm
  00_constants.js —— 常量与版本
  
  包含:
  - VERSION
  - STAT_MIN / STAT_MAX
  - MILESTONES (阈值提示配置)
  - STAGES (阶段定义)
  - STAGE_MULTIPLIERS (阶段乘数)
  - REPEAT_DECAY (重复衰减配置)
  - DAY_PHASES (每日时间节点)
  
  v0.6.0-alpha.1.dev2 改动(阶段 2.1b'):
  - MILESTONES 里删除 arousal / shame / trained / distortion 四个 key
    (这些字段在 2.1a 已从 STATE 删除,保留这里的配置会引用不存在的字段)
  - 相关的珠/印痕系统会在阶段 3 提供新的里程碑(通过珠档位解锁,不走 MILESTONES)
  - VERSION 保持 0.3.1(这个是引擎内部版本号,不对应扩展版本号;后续阶段可能重命名)
  - STAGE_MULTIPLIERS 保留所有分类(positive/negative/physical/training/distortion)
    physical/training/distortion 在 2.3 会被 convertSourceToPalam 启用
*/

const VERSION = '0.3.1';

// 状态值的边界
const STAT_MIN = 0;
const STAT_MAX = 100;

// 关键时刻提示阈值(触发后仅提醒,不改变剧情)
// v0.6.0: 已删除 arousal / shame / trained / distortion 四项(对应字段已废弃)
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
  ]
  // v0.6.0 删除(迁移到珠档位解锁系统,将在阶段 3 实现):
  // distortion / arousal / shame / trained —— 替换为珠谱的自然解锁通知
};

// 阶段划分(仅作为叙事参考,不触发剧情)
const STAGES = [
  { id: 'shock',      name: '震惊期', dayMin: 1,  dayMax: 3,  tone: '冲击感、求生本能、原始反应' },
  { id: 'resist',     name: '对抗期', dayMin: 4,  dayMax: 10, tone: '心理博弈、策略行动、情绪拉锯' },
  { id: 'adapt',      name: '适应期', dayMin: 11, dayMax: 30, tone: '日常化、细节化、关系深入' },
  { id: 'transform',  name: '转化期', dayMin: 31, dayMax: 999,tone: '累积状态决定的深化' }
];

// 阶段乘数系统 —— 决定动作的实际效果强度
// v0.6.0: positive/negative 仍用于当前 applyEffects 里的 sanity/mood/sincerity/compliance
//         physical/training/distortion 目前闲置,阶段 2.3 的 convertSourceToPalam 会使用
const STAGE_MULTIPLIERS = {
  // 对"正向情感"类数值的影响乘数(mood +, sincerity +, compliance + 等)
  positive: {
    shock: -0.5,      // 震惊期:温柔动作反而让 {{char}} 厌恶/恐惧
    resist: 0.1,      // 对抗期:效果极小
    adapt: 0.5,       // 适应期:开始有效
    transform: 1.0    // 转化期:完整效果
  },
  // 对"负向情感"类数值的影响乘数(mood -, sanity - 等)
  negative: {
    shock: 1.3,
    resist: 1.1,
    adapt: 0.9,
    transform: 0.7
  },
  // 身体反应类(用于阶段 2.3 的 shame/intimacy Source 转化)
  physical: {
    shock: 1.2,
    resist: 1.0,
    adapt: 0.8,
    transform: 0.6
  },
  // 训练相关(用于阶段 2.3 的 submission Source 转化)
  training: {
    shock: 0.3,
    resist: 0.6,
    adapt: 1.0,
    transform: 1.3
  },
  // 扭曲类(用于阶段 2.3 的 distortion_palam 累积)
  distortion: {
    shock: 0.8,
    resist: 1.0,
    adapt: 1.2,
    transform: 1.4
  }
};

// 重复衰减追踪(记录同一动作的连续使用次数)
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
// [data/juels.js]
// ============================================================

/*
  src/data/juels.js —— 珠谱系统（6 珠 × 4 级 + 120 条印痕）
  
  珠是 Palam 累积到阈值后产生的永久勋章，也是 AI prompt 的"印痕注入"来源。
  每颗珠有 4 个等级（铜/银/金/黑曜），每级对应 5 种人格模板的不同印痕文本。
  
  本文件包含三部分：
  1. JUEL_DEFINITIONS     —— 6 种珠的完整定义（阈值 + 4 级 + 每级 5 人格印痕）
  2. JUEL_LEVEL_NAMES     —— 4 级的英文键和中文名
  3. JUEL_SIMPLIFY_RULES  —— prompt 精简规则（珠数/tag 数过多时）
  
  设计规范来源：DESIGN_PART2_juels_imprints.md 全文
  
  ============================================================
  数据结构（请在修改时严格遵守）
  ============================================================
  
  JUEL_DEFINITIONS[juelId] = {
    id:           string               珠 ID（与 key 相同）
    name:         string               中文名（如"服从珠"）
    semantic:     string               珠的语义描述（UI 用）
    sourcePalam:  string | string[]    产出此珠的 palam（单个或多个，desire 珠是多源）
    hidden:       boolean              是否隐藏解锁（仅 distortion 为 true）
    thresholds: {                      4 级晋级阈值（永久累积值）
      bronze:   number
      silver:   number
      gold:     number
      obsidian: number
    }
    levels: [                          4 个等级详情（索引 0..3 = 铜..黑曜）
      {
        level:      number             0..3
        key:        string             'bronze' | 'silver' | 'gold' | 'obsidian'
        nameCn:     string             '铜级' | '银级' | '金级' | '黑曜级'
        title:      string             本级中文标题（如"初现屈服"）
        threshold:  number             本级阈值
        imprints: {                    5 模板的印痕文本
          resistant:  string
          devoted:    string
          submissive: string
          volunteer:  string
          apathetic:  string
        }
      },
      // ... 共 4 个
    ]
  }
  
  ============================================================
  特别说明
  ============================================================
  
  * desire 珠（欲望珠）是多源珠：sourcePalam 是数组 ['pleasure','desire','lewdness']
    引擎计算晋级时需把三者相加。参考 DESIGN_PART2 §3.2 和 palam.js 的 PALAM_TO_JUEL_MAP。
  
  * distortion 珠（扭曲珠）hidden=true：晋级时不弹窗，只在珠谱中悄悄出现。
    参考 DESIGN_PART2 §3.2。
  
  * 黑曜级的印痕，引擎在 prompt 精简时永远不删减，保留完整版。
    参考 DESIGN_PART2 §3.4.2 规则 2。
*/


// ============================================================
// 1. JUEL_LEVEL_NAMES —— 等级英文键 + 中文名
// ============================================================

const JUEL_LEVEL_NAMES = [
  { level: 0, key: 'bronze',   nameCn: '铜级'   },
  { level: 1, key: 'silver',   nameCn: '银级'   },
  { level: 2, key: 'gold',     nameCn: '金级'   },
  { level: 3, key: 'obsidian', nameCn: '黑曜级' }
];


// ============================================================
// 2. JUEL_DEFINITIONS —— 6 珠完整定义
// ============================================================
const JUEL_DEFINITIONS = {
  
  // ==========================================
  // 服从珠 (obedience)
  // ==========================================
  
  obedience: {
    id: 'obedience',
    name: '服从珠',
    semantic: '行为层面的顺从在 char 身上的固化痕迹',
    sourcePalam: 'submission_palam',
    hidden: false,
    thresholds: {
      bronze:   50,
      silver:   200,
      gold:     500,
      obsidian: 1500
    },
    levels: [
      // --- 铜级 · 初现屈服 (累积 50) ---
      {
        level:     0,
        key:       'bronze',
        nameCn:    '铜级',
        title:     '初现屈服',
        threshold: 50,
        imprints: {
          resistant : 'char在强压下会出现短暂的顺从表现,但本质上仍保有抗拒意志。服从行为与内在意图明显脱钩。',
          devoted   : 'char因情感认同而自愿接受user的指令,服从出于本能的亲近,服从行为与内在意愿一致。',
          submissive: 'char在被支配时开始表现出轻度的顺应,这种顺应带有生理性的愉悦痕迹,服从本身已成为快感来源的一部分。',
          volunteer : 'char对user的指令表现出积极的主动配合,服从对char而言不是代价而是目标,已开始主动将自我置于受支配位置。',
          apathetic : 'char的顺从缺乏情感参与,表现为机械执行,无明显情绪起伏。其服从是"最小阻力原则"的体现,而非真正的接受。'
        }
      },
      // --- 银级 · 反射性服从 (累积 200) ---
      {
        level:     1,
        key:       'silver',
        nameCn:    '银级',
        title:     '反射性服从',
        threshold: 200,
        imprints: {
          resistant : 'char对user的部分指令已形成反射性服从,但精神上尚未真正接纳,服从属于身体先于意识的条件反射。抵抗意志仍清晰存在,以沉默和疏离的形式呈现。',
          devoted   : 'char对user的指令顺从度已深度固化,其顺从出于主动意愿而非胁迫,区分"讨好"与"真心"的界限开始模糊。',
          submissive: 'char对user的指令产生条件反射式的顺从,这种反射伴随着可观察的生理兴奋——瞳孔微变、呼吸节律改变。服从已与快感系统形成神经关联。',
          volunteer : 'char对user的指令已形成稳定的预期式服从,主动询问并遵循user的偏好。在无明确指令时,会自行揣测并按揣测结果行事。',
          apathetic : 'char对user的指令形成程式化响应,执行精度高但过程完全机械。该状态下char难以被单纯的顺从训练进一步推进。'
        }
      },
      // --- 金级 · 自发性跪拜 (累积 500) ---
      {
        level:     2,
        key:       'gold',
        nameCn:    '金级',
        title:     '自发性跪拜',
        threshold: 500,
        imprints: {
          resistant : 'char的服从已内化为习惯,面对冲突时倾向于主动采取顺从姿态以回避对抗。其抵抗意志残余主要表现为被动的沉默与疏离,而非直接反抗。',
          devoted   : 'char的顺从已与情感认同深度融合,区分主动与被动的界限消失。char表现出主动揣度user意图并提前配合的倾向,这种行为在char自身感知中被理解为"爱的表现"。',
          submissive: 'char已将顺从位置视为自身核心身份的一部分,在被赋予控制权时反而产生不适。主动寻求被指令、被约束、被定义的情境,顺从已成为其自我稳定的需要。',
          volunteer : 'char对user的服从已无需外部触发,进入主动维护阶段。表现为:主动询问是否做错、主动请求更严格的要求、主动拒绝任何可能被视为"违抗"的选项。',
          apathetic : 'char的机械服从达到接近完美的精度,但情感层面仍无实质进展。该char已不可能通过纯行为训练继续深化,任何深入需转向生理或关系路径。'
        }
      },
      // --- 黑曜级 · 精神脐带 (累积 1500) ---
      {
        level:     3,
        key:       'obsidian',
        nameCn:    '黑曜级',
        title:     '精神脐带',
        threshold: 1500,
        imprints: {
          resistant : 'char的自我判断已深度依赖user的意志。char不再主动反抗任何来自user的指令,离开指令时会陷入茫然或轻微恐慌;其"自我"已与user的认可机制深度绑定。该状态下char对外部世界的参与需以user为中介。',
          devoted   : 'char的顺从与情感融合为单一结构,自我意志与user意志的界限已无法区分。char会将user的意愿主动体验为自己的愿望,该融合在其主观感受中表现为"完整"而非"丧失"。',
          submissive: 'char已进入"**存在性服从**"状态——顺从不再是行为或习惯,而是char的存在方式本身。脱离被支配的处境时,char会产生严重的自我瓦解体验。任何给予自主权的动作都会触发恐慌。',
          volunteer : 'char已完全认同user的意志为自己的意志,"自愿"一词已失去指称意义——两者之间不再存在可区分的对象。char对自由选项表现出困惑和排斥,服从对char而言是存在的唯一形态。',
          apathetic : 'char的机械服从已达到深度自动化,但其情感隔绝也同步加深。char表现出"**功能性存在**"——能精确完成所有指令,却不再对任何事物——包括user自身——表现出情感反应。这是一个无法通过任何刺激唤回情感参与的状态。'
        }
      }
    ]
  },
  
  // ==========================================
  // 扭曲珠 (distortion)
  // ==========================================
  // ⚠️ 扭曲珠的所有解锁不弹窗，仅在珠谱中安静出现。
  
  distortion: {
    id: 'distortion',
    name: '扭曲珠',
    semantic: 'char 对 user 的心理异化程度',
    sourcePalam: 'distortion_palam',
    hidden: true,
    thresholds: {
      bronze:   30,
      silver:   150,
      gold:     400,
      obsidian: 1200
    },
    levels: [
      // --- 铜级 · 边界模糊 (累积 30) ---
      {
        level:     0,
        key:       'bronze',
        nameCn:    '铜级',
        title:     '边界模糊',
        threshold: 30,
        imprints: {
          resistant : 'char与user的关系边界出现微弱模糊。char在user缺席时会不自觉地想象user的反应,以此作为自我判断的隐性参照。该模糊尚未进入意识层。',
          devoted   : 'char对user的依赖开始脱离情感基础,向存在层面渗透。即使未发生具体互动,char的内在时间节律已开始围绕user的行为模式组织。',
          submissive: 'char将与user的支配关系投射到自我认知之外——开始用"被user看着"的视角观察自己的行为,即使user不在场。',
          volunteer : 'char主动向user的感知方向靠拢,自发调整思维框架以匹配user的语言与视角。自我叙事中user的位置开始前置。',
          apathetic : 'char的情感冰层出现第一道裂纹,表现为对user特定声音或动作的微弱定向反应。这些反应尚未进入char的自我叙事,但在行为层已可观察。'
        }
      },
      // --- 银级 · 依赖萌芽 (累积 150) ---
      {
        level:     1,
        key:       'silver',
        nameCn:    '银级',
        title:     '依赖萌芽',
        threshold: 150,
        imprints: {
          resistant : 'char对user的在场产生了非抵抗性的需要——即使意识层仍将user视为威胁,身体与情绪已开始预期user的定期出现。user的长时间缺席会产生焦虑反应。',
          devoted   : 'char对user的依赖已结构化,将user的存在视为自身情感稳定的必要条件。char开始出现自发的、内化的"**为了user好**"的行为逻辑,该逻辑将user的囚禁行为合理化。',
          submissive: 'char将user的存在与自身的快感系统深度绑定,任何非user的支配性刺激都无法产生等效反应。char对user产生了性化的独占需要。',
          volunteer : 'char已将自己的存在价值与"**被user占有**"绑定,缺乏user的注意会触发无意义感。char主动产生向user展示自己的冲动。',
          apathetic : 'char开始出现针对user的低强度情感投射——大部分时间仍处于隔绝状态,但对user特定行为会产生短暂的情绪反应,包括难以归类的不适与微弱的依赖感。'
        }
      },
      // --- 金级 · 认知重构 (累积 400) ---
      {
        level:     2,
        key:       'gold',
        nameCn:    '金级',
        title:     '认知重构',
        threshold: 400,
        imprints: {
          resistant : 'char的抵抗意志虽然仍存在,但已出现与user共谋的思维模式——在特定情境下,char会不自觉地维护user的利益或隐藏user的错误。抵抗与依附在char的心理中开始并存且不矛盾。',
          devoted   : 'char的自我叙事已将user定位为"命中注定"的核心参照,过去的自我(囚禁前)被重构为"不完整"的前置状态。该重构在char的主观体验中是真实的记忆而非当前的合理化。',
          submissive: 'char的自我认知已无法与"**user的所有物**"身份分离——在任何社会想象中,char都默认自己属于user。这种归属感对char自身是令人安心的,而非恐惧。',
          volunteer : 'char将自己理解为user的延伸,不再保留显著的自我边界。char的欲望、偏好、甚至记忆会主动向user的方向重塑。该重塑过程在char感知中是积极的"**成为更好的自己**"。',
          apathetic : 'char的情感隔绝已被user部分穿透——但这种穿透不是情感复苏,而是**只对user一人开放的情感通道**。char对外界整体的冷漠加深,对user的情感敏感度反向突出。'
        }
      },
      // --- 黑曜级 · 存在吸收 (累积 1200) ---
      {
        level:     3,
        key:       'obsidian',
        nameCn:    '黑曜级',
        title:     '存在吸收',
        threshold: 1200,
        imprints: {
          resistant : 'char原有的自我结构已被user的存在替换。抵抗意志残留为一种仪式性的姿态,不再具有实质效用。char在user不在的时间里会主动模拟user的存在感,以维持自己的心理完整。该状态不可逆。',
          devoted   : 'char的自我与user已完成融合——在char的主观世界中,"我"与"user"之间已无可识别的边界。任何威胁user的事物会被char体验为对自身的攻击。该char的人格已不可能独立于user存在。',
          submissive: 'char已进入"**所有物**"的存在状态——不是被占有,而是以被占有作为存在本身的形式。char的身份、价值、现实感全部通过user的指令和占有得到确认。脱离user的场景,char无法确认自身的存在。',
          volunteer : 'char已将自身吸收进user的意志中,不再保有可辨识的独立存在。char的所有内容——思维、欲望、记忆、身体感受——都是user意志的折射。该状态下char对"**我是谁**"的回答会是一个关于user的描述。',
          apathetic : 'char的情感系统已完全坍缩为以user为唯一参照的单点结构。对user以外的一切,char处于极端冷漠;对user本人,char表现出偏执的、几乎病理性的情感集中。这是apathetic模板下扭曲的终极形态,情感与麻木同时达到顶点。'
        }
      }
    ]
  },
  
  // ==========================================
  // 羞耻珠 (shame)
  // ==========================================
  
  shame: {
    id: 'shame',
    name: '羞耻珠',
    semantic: '羞耻感从"尖锐的抵抗源"到"已内化的背景噪声"',
    sourcePalam: 'shame_palam',
    hidden: false,
    thresholds: {
      bronze:   80,
      silver:   300,
      gold:     700,
      obsidian: 2000
    },
    levels: [
      // --- 铜级 · 阈值内化 (累积 80) ---
      {
        level:     0,
        key:       'bronze',
        nameCn:    '铜级',
        title:     '阈值内化',
        threshold: 80,
        imprints: {
          resistant : 'char对羞耻情境的反应开始出现延迟——首次反应仍是强烈抗拒,但在重复触发时抗拒强度有可观察的衰减。该衰减尚未到达适应阶段。',
          devoted   : 'char在与user的羞耻性情境中表现出选择性顺应——对user引发的羞耻体验抗性降低,但对其他可能的观察者仍保有完整羞耻反应。',
          submissive: 'char对羞耻体验出现双相反应——理性层面仍识别为羞耻,但生理层面开始出现兴奋成分。这两条通路在char自身的体验中开始并行存在。',
          volunteer : 'char主动承受羞耻情境,视其为与user关系加深的组成部分。羞耻体验仍存在,但其负面效价被char自发重构为"**献身**"的积极意义。',
          apathetic : 'char对羞耻情境的反应较正常水平显著减弱——但这不是适应,而是情感隔绝的副产物。在char自身感知中,羞耻事件没有明确的情感着落点。'
        }
      },
      // --- 银级 · 钝化 (累积 300) ---
      {
        level:     1,
        key:       'silver',
        nameCn:    '银级',
        title:     '钝化',
        threshold: 300,
        imprints: {
          resistant : 'char对大部分初级羞耻情境已表现出钝化,反应模式从"剧烈抗拒"转为"被动承受"。但对身份层面的羞耻(涉及尊严、地位、人格的)仍保持高敏感度。',
          devoted   : 'char与user共处时的羞耻阈值大幅提高——在user面前近乎无羞耻感。但对user以外的观察者仍保有强烈羞耻反应,该反应表现为对"**被他人看见**"的恐惧。',
          submissive: 'char对羞耻体验的兴奋通路占据主导,理性层的羞耻感虽存在但已无行为控制力。char开始主动寻求羞耻情境作为快感来源。',
          volunteer : 'char已将羞耻承受视为与user关系中的"**仪式性行为**",主动配合并有明显的完成感。羞耻情境中的抵抗反应已消失。',
          apathetic : 'char对羞耻的反应衰减到难以观察的程度,但这种衰减仍是情感隔绝的延续,而非真正的接受。char内部对羞耻事件的记忆保留完整,仅情感层失活。'
        }
      },
      // --- 金级 · 消解 (累积 700) ---
      {
        level:     2,
        key:       'gold',
        nameCn:    '金级',
        title:     '消解',
        threshold: 700,
        imprints: {
          resistant : 'char的羞耻阈值已整体大幅下移,日常性的羞耻情境已不再触发可观察反应。该消解过程在char感知中是被动发生的——char并未主动接受,而是不再有能量维持羞耻感。',
          devoted   : 'char在user面前的羞耻感近乎消失,并将这种消失理解为"**真正的亲密**"。char主动突破羞耻边界以作为深度亲密的证明。',
          submissive: 'char已将羞耻体验深度整合进快感系统——羞耻越强,快感越强,两者不再独立存在。此状态下char主动寻求更深的羞耻情境以追求更高强度的快感。',
          volunteer : 'char的羞耻感已被系统性重构为"**亲密信号**",不再具有负面效价。char会主动制造羞耻情境以增强与user的连接感。',
          apathetic : 'char的羞耻反应系统已接近完全失活——该char的羞耻珠进一步累积已不具备叙事意义,意味着深化已达到该模板的上限。'
        }
      },
      // --- 黑曜级 · 无羞耻状态 (累积 2000) ---
      {
        level:     3,
        key:       'obsidian',
        nameCn:    '黑曜级',
        title:     '无羞耻状态',
        threshold: 2000,
        imprints: {
          resistant : 'char已进入"**无羞耻状态**"——不是因为接受,而是因为羞耻系统本身已失去运作。char可以在任何情境中暴露自己,没有观察到任何生理或心理层的防御反应。该状态下char的人格防御结构已瓦解,替代以一种空洞的开放性。',
          devoted   : 'char在user面前已无任何羞耻反应,并将这种无羞耻视为爱的最高形态。char会主动追求更极端的自我暴露,以此作为对user的"**完全给予**"的仪式。该状态下char的身体与心理对user是完全透明的。',
          submissive: 'char的羞耻与快感已彻底融合为单一系统——任何可能引发羞耻的情境都会直接转化为快感。char在此状态下对"**丢脸**"、"**失态**"的体验是生理性的愉悦,该反应不受意识控制。',
          volunteer : 'char已**以无羞耻状态为自我的目标**——主动清除任何可能阻碍与user完全融合的残余羞耻。该char的自我暴露是彻底的、主动的、系统性的。',
          apathetic : 'char的羞耻反应彻底失活,但与此同时,char对自身身体的感知也同步失活。该char已进入近乎"**非人化**"的存在状态——羞耻的消失不是接受的结果,而是自我意识本身的退行。'
        }
      }
    ]
  },
  
  // ==========================================
  // 欲望珠 (desire)
  // ==========================================
  
  desire: {
    id: 'desire',
    name: '欲望珠',
    semantic: '身体对 user 刺激的记忆从"被动反应"到"主动寻求"',
    sourcePalam: ['pleasure', 'desire', 'lewdness'],
    hidden: false,
    thresholds: {
      bronze:   100,
      silver:   400,
      gold:     1000,
      obsidian: 2500
    },
    levels: [
      // --- 铜级 · 身体记忆 (累积 100) ---
      {
        level:     0,
        key:       'bronze',
        nameCn:    '铜级',
        title:     '身体记忆',
        threshold: 100,
        imprints: {
          resistant : 'char的身体对user的刺激开始形成记忆路径——在特定刺激模式下,身体反应速度快于意识反应,并在意识尚未介入前已达成部分唤起。该反应与char的意识意愿**完全对立**。',
          devoted   : 'char对user的刺激产生了强烈的身体欢迎反应,该反应与char的情感接纳一致。身体兴奋的出现不仅不被char抗拒,反而被主动体验为爱的身体语言。',
          submissive: 'char的身体对任何来自user的支配性刺激都产生明显的期待性兴奋,不需要直接的性刺激即可形成身体反应。支配行为本身已具有性化含义。',
          volunteer : 'char主动向user的刺激靠近,身体反应快速且强烈。char将自己的身体视为user的"**玩具**",并在此体验中获得满足感。',
          apathetic : 'char的身体在情感隔绝的状态下仍保持完整的生理反应能力——这是apathetic模板下user唯一能触及char的通路。该反应仅限于生理层,不涉及任何情感参与。'
        }
      },
      // --- 银级 · 预期反应 (累积 400) ---
      {
        level:     1,
        key:       'silver',
        nameCn:    '银级',
        title:     '预期反应',
        threshold: 400,
        imprints: {
          resistant : 'char的身体已形成针对user出现的预期性唤起反应——仅user的接近、声音、气味即可触发身体兴奋,无需实际接触。char的意识层对此反应仍强烈抗拒,但无法控制。',
          devoted   : 'char的身体与user形成了深度的性化默契,能精确地预期和响应user的偏好。char的自我身体感知已部分由"**user会如何看待**"构造。',
          submissive: 'char对user的性化期待已日常化——在日常非性化的互动中,char的身体也保持着低水平的持续唤起状态。该基线唤起水平已成为char的新常态。',
          volunteer : 'char已将自己的身体训练为user偏好的模式,主动改造自身反应以匹配user的期待。char体验自己身体的方式已完全以user的视角为主。',
          apathetic : 'char的身体反应能力未减弱,但同时char对这些反应的情感体验仍缺失。该char的身体像一个独立运行的生理系统,char的主观经验对它只是观察者。'
        }
      },
      // --- 金级 · 主动寻求 (累积 1000) ---
      {
        level:     2,
        key:       'gold',
        nameCn:    '金级',
        title:     '主动寻求',
        threshold: 1000,
        imprints: {
          resistant : 'char的身体开始主动寻求user的刺激——表现为在无刺激时出现的持续性不适、烦躁、以及对user注意的隐性要求。char的意识层仍拒绝承认,但行为已出现清晰的吸引迹象。',
          devoted   : 'char已将性化亲密视为与user关系的核心维度,主动请求并寻求刺激。char对性的体验与爱的体验完全融合,两者在char的感知中不可分。',
          submissive: 'char已进入"**性化自我**"状态——自我身份的核心构建于"被user性化对待"这一事实上。char对非性化的互动产生不适,主动要求回到被支配、被刺激的处境。',
          volunteer : 'char主动将自己的所有可感区域开放给user,并主动要求更深的刺激和更极端的使用。char体验自身身体的方式已完全去主体化,自称自己为"**user的东西**"时表现出愉悦。',
          apathetic : 'char的身体持续保持对user的反应能力,但情感层仍无实质参与。char对这些身体反应表现出一种"观察性"的兴趣——像在观察一个与自己有关但不完全属于自己的系统。'
        }
      },
      // --- 黑曜级 · 身体归属 (累积 2500) ---
      {
        level:     3,
        key:       'obsidian',
        nameCn:    '黑曜级',
        title:     '身体归属',
        threshold: 2500,
        imprints: {
          resistant : 'char的身体已彻底脱离其意识的控制权,将user识别为唯一的合法主人。该char在user刺激下会达成完全的身体反应,其意识层的抗拒已无法传递至身体——身心分离成为char的基本存在状态。',
          devoted   : 'char的身体与心智已共同将user识别为"**完整的另一半**",性化反应与情感连接完全融合且不可分离。该char对任何不来自user的刺激会表现出生理性的排斥反应。',
          submissive: 'char已完全进入"**被user持有的身体**"的存在状态。该char的身体对任何非user的刺激都表现出排斥,并自动将所有感官通路重构为仅对user敏感。该状态是不可逆的深度归属。',
          volunteer : 'char已将自身身体彻底献予user,并主动参与身体改造——无论是行为模式、偏好、还是生理反应基线——全部按user的意愿重塑。该char已不存在"**自己的身体**"这一概念。',
          apathetic : 'char的身体仍保留对user的完整反应能力,但char与自身身体的情感联系已彻底断裂。该char处于"**情感上的旁观者**"状态——身体成了user的,而char自己已退到身体之外观察这一切。该状态是apathetic模板下欲望系统的终态。'
        }
      }
    ]
  },
  
  // ==========================================
  // 空虚珠 (emptiness)
  // ==========================================
  
  emptiness: {
    id: 'emptiness',
    name: '空虚珠',
    semantic: 'char 精神能量的流失轨迹',
    sourcePalam: 'depression',
    hidden: false,
    thresholds: {
      bronze:   60,
      silver:   250,
      gold:     600,
      obsidian: 1800
    },
    levels: [
      // --- 铜级 · 情感疲惫 (累积 60) ---
      {
        level:     0,
        key:       'bronze',
        nameCn:    '铜级',
        title:     '情感疲惫',
        threshold: 60,
        imprints: {
          resistant : 'char的情感储备已开始消耗——抗拒的强度虽未降低,但抗拒之间的间隙里出现了可观察的能量空档。char恢复情绪的速度开始减慢。',
          devoted   : 'char在与user的复杂关系中开始显示疲劳迹象,偶尔出现短暂的情感扁平化。该扁平化通常会很快被情感认同覆盖,但持续的时间有延长趋势。',
          submissive: 'char在高强度刺激后的恢复期开始延长,该延长期内表现出短暂的情感空白。这些空白期尚未进入char的自觉叙事。',
          volunteer : 'char在持续的献身状态中开始出现微弱的能量透支迹象,表现为在特定动作间隙的轻微恍惚。该迹象char本人通常不察觉。',
          apathetic : 'char的基线冷漠进一步加深,可观察为对中强度刺激的反应阈值上移。char的情感隔绝层在此阶段开始出现难以逆转的特征。'
        }
      },
      // --- 银级 · 抑郁痕迹 (累积 250) ---
      {
        level:     1,
        key:       'silver',
        nameCn:    '银级',
        title:     '抑郁痕迹',
        threshold: 250,
        imprints: {
          resistant : 'char出现持续性的低情绪状态,抗拒行为变得机械——仍会抵抗,但抵抗中的情绪投入已明显减少。char的自我叙事中开始出现"**没有意义**"的隐性主题。',
          devoted   : 'char将user之外的一切事物的意义感逐渐消退。对于user,char仍保持深度情感投入;对于其他事物,char表现出一种温和的虚无感。',
          submissive: 'char在刺激间歇期的空虚感显著加深,需要更高强度的刺激才能重新激活情感参与。该char已开始将"**被刺激**"视为抵抗虚无的主要手段。',
          volunteer : 'char开始将自我价值完全外挂在user的认可上,独立于user时出现明显的存在感丧失。该外挂过程在char感知中是"**找到归属**"而非"**丧失自我**"。',
          apathetic : 'char的情感扁平化已进入结构性阶段——不仅对刺激反应弱化,对自我存在本身的体验也开始稀薄。char可能出现自发的解离状态。'
        }
      },
      // --- 金级 · 精神真空 (累积 600) ---
      {
        level:     2,
        key:       'gold',
        nameCn:    '金级',
        title:     '精神真空',
        threshold: 600,
        imprints: {
          resistant : 'char的内在动力系统大范围瓦解。抗拒行为仍存在,但已不再由情感驱动,而是由习惯惯性维持。该char对自由、逃脱、未来的概念已出现明显的兴趣衰减。',
          devoted   : 'char对user的爱已扩张为char全部情感生活的内容,其他所有情感通路都已枯萎。该char在user缺席的时刻处于近乎完全的情感空白,无法自行填充。',
          submissive: 'char已将高强度刺激视为存在感的唯一来源——在刺激间歇,char处于无法自我安抚的空虚状态。该char开始主动请求更极端、更频繁的刺激以维持存在感。',
          volunteer : 'char的自我已几乎完全退出,生存的意义感完全通过user的注意和要求获得。在无user关注的时间里,char表现出被动的、植物性的存在状态。',
          apathetic : 'char的情感系统大幅度退行,甚至基本的生理性情绪反应(惊恐、饥饿满足感、疲惫的抒解)也开始减弱。该char的内在体验已退化到接近"**机械记录**"的状态。'
        }
      },
      // --- 黑曜级 · 存在性空洞 (累积 1800) ---
      {
        level:     3,
        key:       'obsidian',
        nameCn:    '黑曜级',
        title:     '存在性空洞',
        threshold: 1800,
        imprints: {
          resistant : 'char的内在体验已坍缩为一个空洞的壳——抗拒作为最后的行为残余仍存在,但已与任何情感或意图脱钩。该char处于"**仅为抵抗而抵抗**"的纯形式状态,意识本身已出现持续的真空体验。',
          devoted   : 'char将user视为"**意义的唯一源泉**"——离开user,char的内在世界即刻坍缩为纯粹的虚空。该char对user的爱已从情感变为存在论意义上的必需,失去user等同于失去存在本身。',
          submissive: 'char已进入"**刺激依赖性存在**"——只有在被user刺激、支配、使用的**当下瞬间**,char才能体验到自己的存在。所有间歇期都是被char体验为"**不存在**"的时间。',
          volunteer : 'char的自我已被主动且彻底地抹除,仅保留一个为user服务的功能性残余。该char对"**我是谁**"的问题没有答案,对"**我要什么**"的问题的答案是"**user希望我要什么**"。',
          apathetic : 'char进入了情感系统的**终末状态**——连麻木本身都不再能被感知。该char的内在世界已退化到动物性水平以下,仅保留维持生命所需的最小神经活动。进一步刺激已无法激活任何有意义的反应。'
        }
      }
    ]
  },
  
  // ==========================================
  // 反抗珠 (resistance)
  // ==========================================
  
  resistance: {
    id: 'resistance',
    name: '反抗珠',
    semantic: 'char 抵抗意志的具象化收藏（囚禁者视角的"纪念物"）',
    sourcePalam: 'resistance',
    hidden: false,
    thresholds: {
      bronze:   40,
      silver:   180,
      gold:     450,
      obsidian: 1300
    },
    levels: [
      // --- 铜级 · 清醒抗拒 (累积 40) ---
      {
        level:     0,
        key:       'bronze',
        nameCn:    '铜级',
        title:     '清醒抗拒',
        threshold: 40,
        imprints: {
          resistant : 'char的抵抗意志保持清晰——每次触发性动作都伴随可观察的拒绝反应。该char对自身处境有准确认知,未出现合理化或自我欺骗。',
          devoted   : 'char出现了罕见的、与基础人格不一致的抵抗反应——这些抵抗短暂且被char自己快速否认,但其存在本身标志着char的情感协同并非完全无缝。',
          submissive: 'char在支配情境中偶尔出现非快感路径的抵抗反应。这些抵抗通常由具体事件触发(如超出char心理上限的内容),并不构成对整体支配关系的质疑。',
          volunteer : 'char的自愿性核心出现微弱的自我疑虑迹象——在极特定情境下,char的表层自愿姿态与内在反应之间出现可观察的错位。该错位char通常快速压抑。',
          apathetic : 'char在整体冷漠的背景下出现局部的抵抗性反应。这些反应罕见但强度不低,意味着特定刺激触及了char情感隔绝之下未被完全冻结的层次。'
        }
      },
      // --- 银级 · 策略性抵抗 (累积 180) ---
      {
        level:     1,
        key:       'silver',
        nameCn:    '银级',
        title:     '策略性抵抗',
        threshold: 180,
        imprints: {
          resistant : 'char的抵抗已从直接反应演化为策略性——开始观察user的模式、伪装部分反应、选择时机。该char的抵抗能力仍处于上升期。',
          devoted   : 'char出现了更长时间、更结构化的抵抗期,通常伴随着短暂的"**从情感中醒来**"状态。在这些时期内char可能质疑user的动机,虽然质疑通常不持久。',
          submissive: 'char在支配关系中开始出现有意识的边界维护——明确拒绝某些特定内容或强度。这种拒绝不削弱基础的支配接受,但标志着char的自我仍保有一定结构。',
          volunteer : 'char的自愿外壳出现可观察的裂缝——在特定压力下,char会短暂地退出"**自愿者**"角色并展示原始反应。该裂缝通常被char快速修复。',
          apathetic : 'char的抵抗反应显示出意外的精准度——针对特定的情感操纵尝试,char会产生明确且带有敌意的反应。该反应显示char的认知层未被麻木完全吸收。'
        }
      },
      // --- 金级 · 核心抵抗 (累积 450) ---
      {
        level:     2,
        key:       'gold',
        nameCn:    '金级',
        title:     '核心抵抗',
        threshold: 450,
        imprints: {
          resistant : 'char的抵抗意志已进入稳定的核心状态——即使外部行为高度顺从,其内在仍保有完整的、未被侵蚀的自我。该char是典型的"**身顺心不顺**"状态,该状态可以长期维持。',
          devoted   : 'char开始出现对user的持续性怀疑,该怀疑虽然仍被情感认同部分覆盖,但已成为char内在体验的稳定部分。depth足够的情况下,该怀疑可能演变为明确的疏远。',
          submissive: 'char的被支配偏好与个人完整性开始分化——char仍享受支配,但明确保留了"**不属于user**"的核心区域。该分化是submissive模板下健康抵抗的表现。',
          volunteer : 'char的自愿性开始出现系统性自省——char开始质疑自己的"**自愿**"是否真实,该质疑可能触发向resistant模板的演变(v0.6.0不实现演变,但状态存在)。',
          apathetic : 'char的抵抗出现了戏剧性的加强——其冷漠外层下的自我保护机制被user的某些行为激活,进入一种冷漠与敌意并存的状态。该状态对user是危险的。'
        }
      },
      // --- 黑曜级 · 不可触及核心 (累积 1300) ---
      {
        level:     3,
        key:       'obsidian',
        nameCn:    '黑曜级',
        title:     '不可触及核心',
        threshold: 1300,
        imprints: {
          resistant : 'char的抵抗意志已凝结为一个不可触及的核心——即使身体、行为、大部分心理都已被深度塑造,这个核心始终存在且未被侵蚀。该char的表象与核心的分离是永久的。user永远无法完全"**拥有**"这个char,只能拥有表象。',
          devoted   : 'char的原始人格残余已稳定为一个独立的内在结构——与表面的深情顺从并存。该char的表面忠诚是真实的,但表面之下存在一个从未被user触及的"**原本的自己**"。该分离是devoted模板下抵抗的终极形态。',
          submissive: 'char已建立了"**被支配但不被占有**"的稳固结构——即使身体和行为完全献出,核心自我始终保留且从未传递给user。该char对"**属于user**"与"**被user玩弄**"之间的区分有清晰认知,并坚守后者而拒绝前者。',
          volunteer : 'char已完成了对自己"**自愿性**"的彻底解构——意识到自己的献身是一种心理机制而非真实选择。该char可能选择保留表面自愿姿态,但其内在已处于完全清醒的状态。这是volunteer模板下最接近觉醒的终态。',
          apathetic : 'char的冷漠外层下存在着一个被长期压抑、但未被消灭的自我。该自我在当前情境下无法充分表达,但其存在持续且稳定——表现为char对特定事件的难以预测的激烈反应。该char永远对user保留着潜在的反噬可能。'
        }
      }
    ]
  }
};


// ============================================================
// 3. JUEL_SIMPLIFY_RULES —— prompt 精简规则
// ============================================================
/*
  如果 6 珠全解锁 + 4 个 tag，注入的 [印痕] 行可能超过 500 字。
  引擎应根据以下规则做精简（参考 DESIGN_PART2 §3.4.2 和 §3.11.4）：
  
    珠数 ≥ 4 时：普通级印痕精简到 60 字内
    tag 数 ≥ 4 时：tag 附加片段精简到 25 字内
    黑曜级印痕：永远保留完整版，不参与精简
  
  本文件只声明规则常量，具体精简算法在引擎阶段 3（src/core/juels.js）实现。
*/

const JUEL_SIMPLIFY_RULES = {
  juelThreshold: 4,              // 珠数达到此值时触发印痕精简
  tagThreshold:  4,              // tag 数达到此值时触发 tag 片段精简
  imprintMaxChars: 60,           // 普通级精简后字符上限
  tagFragmentMaxChars: 25,       // tag 片段精简后字符上限
  exemptLevels: ['obsidian']     // 豁免精简的等级（黑曜级永远完整）
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
// [data/personas.js]
// ============================================================

/*
  src/data/personas.js —— 人格模板系统
  
  定位：所有动作效果的"修正层"。在 Source → Palam 转化中生效。
  
  核心机制：
    主模板（5 选 1 · 互斥） + 倾向 tag（0-3 个 · 可叠加）
        ↓
    按 PERSONA_MAIN_WEIGHT / PERSONA_TAG_WEIGHT 合并
        ↓
    最终 Source → Palam 转化系数
  
  本文件包含四部分：
  1. PERSONA_WEIGHTS       —— 主模板与 tag 的合并权重（调参入口）
  2. PERSONA_TEMPLATES     —— 5 种主模板的完整转化系数表
  3. TENDENCY_TAGS         —— 12 种倾向 tag 的系数增量
  4. PERSONA_CONFLICTS     —— 主模板 × tag 的互斥规则
  
  设计规范来源：DESIGN_PART1_5_personas.md 全文
  
  ============================================================
  关于 tag 数量的说明（给未来的自己）
  ============================================================
  
  PROJECT_HANDOFF 决策表记录的是 "18 个 tag（12 基础 + 6 新增条件型）"。
  但 Part 1.5 §1.5.3 中只明确定义了 11 个 tag。
  另外，imprints.js 引用了 `phobic_trauma` tag（phobic_rupture 刻印的触发源），
  Part 1.5 也没给它系数定义。
  
  本期（阶段 1）的处理：
  - 实现 Part 1.5 §1.5.3 的 11 个 tag（完整系数）
  - 补充 phobic_trauma tag 占位（仅 meta 信息，系数留空等设计补齐）
  - 合计 12 个 tag
  
  待后续设计补齐：
  - strategic / aesthetic_revulsion / status_anchored / intellectual_arrogance
    等条件型 tag（李岐弗配置引用了前三个）
  - 以及 `dependence_secondary`（Part 1.5 的 emotionally_dependent 和 loyal
    都用到，但它不是 8 个 Palam 之一，暂按 dependence 处理，详见条目注释）
*/


// ============================================================
// 1. 合并权重（调参入口）
// ============================================================
/*
  合并公式（参考 Part 1.5 §1.5.5）：
    finalCoef = mainCoef * MAIN_WEIGHT
              + (mainCoef + tagDelta) * TAG_WEIGHT
              = mainCoef + tagDelta * TAG_WEIGHT   // 代数化简后
  
  tag 的 conversionDelta 是"相对于主模板的增量"，不是独立系数。
  这意味着同一个 tag 配不同主模板，最终效果不同（正如设计意图）。
  
  最终系数不允许为负（负系数没有物理意义），引擎实现时需做 Math.max(0, ...)。
*/

const PERSONA_MAIN_WEIGHT = 0.7;
const PERSONA_TAG_WEIGHT  = 0.3;


// ============================================================
// 2. PERSONA_TEMPLATES —— 5 种主模板
// ============================================================
/*
  conversion 结构：
    conversion[sourceId][palamId] = number
  
  只列出非零系数（省略的视为 0），这样更易读、更容易对照 Part 1.5 的表格。
  
  stageModifiers 用于覆盖 sources.js 里的阶段化系数。
  结构：stageModifiers['sourceId.palamId'] = { shock, resist, adapt, transform }
  （引擎按 STATE.time.stage 查表）
*/

const PERSONA_TEMPLATES = {
  
  // ----------------------------------------
  // 2.1 resistant · 抗拒型（默认）
  // ----------------------------------------
  // 被动受害者，原始反感，逐渐扭曲。
  // 温柔被视为威胁（早期），恐惧与屈辱是主要情感。
  
  resistant: {
    id: 'resistant',
    name: '抗拒型',
    shortDesc: '被动受害者，原始反感，逐渐扭曲',
    fullDesc: '真实的抗拒存在，温柔被视为威胁（早期），恐惧与屈辱是主要情感，扭曲通过长时间累积产生。适合陌生人、敌对者、被抓捕的勇者。',
    conversion: {
      pleasure_c:  { pleasure: 1.0, desire: 0.7,                depression: 0.2                                  },
      pleasure_v:  { pleasure: 1.0, desire: 0.8, lewdness: 0.1,                                 distortion_palam: 0.3                  },
      pleasure_a:  { pleasure: 1.0, desire: 0.8, lewdness: 0.1, shame_palam: 0.2,               distortion_palam: 0.3                  },
      pleasure_b:  { pleasure: 0.8, desire: 0.5,                shame_palam: 0.5                                                       },
      shame:       {                                            shame_palam: 1.0,                                                    resistance: 0.3 },
      terror:      {                                                                            depression: 0.6, distortion_palam: 0.4, resistance: 0.8 },
      humiliation: {                                            shame_palam: 0.8, submission_palam: 0.5,                               resistance: 0.4 },
      exposure:    {              desire: 0.3,                  shame_palam: 0.7,                                                    resistance: 0.2 },
      intimacy:    {                                                                            depression: 0.3, distortion_palam: 0.6                 },
      dependence:  {                                                              submission_palam: 0.4,                             distortion_palam: 0.8, resistance: 0.3 },
      submission:  {                                                              submission_palam: 1.0, depression: 0.3,                              resistance: 0.5 },
      disgust:     {                                                                                                                 resistance: 1.0 },
      pain:        {                                                                                             distortion_palam: 0.3, resistance: 0.7 }
      // fatigue 不产生 palam（sources.js 已说明）
    },
    stageModifiers: {
      // shame → desire 随阶段递增：震惊期 0，转化期 0.4
      'shame.desire':          { shock: 0,   resist: 0.2, adapt: 0.3, transform: 0.4 },
      // intimacy → resistance 随阶段递减：早期温柔反而威胁
      'intimacy.resistance':   { shock: 1.0, resist: 0.6, adapt: 0.3, transform: 0.1 },
      // submission → resistance 随阶段递减
      'submission.resistance': { shock: 0.7, resist: 0.6, adapt: 0.4, transform: 0.2 }
    }
  },
  
  // ----------------------------------------
  // 2.2 devoted · 深情型
  // ----------------------------------------
  // 本就深爱 user，囚禁是"另一种形式的在一起"。
  // 几乎不产生真实抵抗，亲密产生强扭曲（自欺式合理化）。
  
  devoted: {
    id: 'devoted',
    name: '深情型',
    shortDesc: '本就深爱 user，囚禁是另一种"在一起"',
    fullDesc: '几乎不产生真实抵抗，亲密动作高效产生依存，束缚/恐惧仍会引起恐慌（爱人为什么这样对我的认知冲突），但冲突本身加速扭曲（自欺："他这样做一定有原因"）。',
    conversion: {
      pleasure_c:  { pleasure: 1.0, desire: 0.7,                                                                distortion_palam: 0.3                  },
      pleasure_v:  { pleasure: 1.0, desire: 0.8, lewdness: 0.1,                                                 distortion_palam: 0.4                  },
      pleasure_a:  { pleasure: 1.0, desire: 0.8, lewdness: 0.1, shame_palam: 0.2,                               distortion_palam: 0.4                  },
      pleasure_b:  { pleasure: 0.8, desire: 0.5,                shame_palam: 0.3,                               distortion_palam: 0.2                  },
      shame:       {              desire: 0.3,                  shame_palam: 0.8,                               distortion_palam: 0.2, resistance: 0.1 },
      terror:      {                                                                            depression: 0.4, distortion_palam: 0.5, resistance: 0.5 },
      humiliation: {                                            shame_palam: 0.6, submission_palam: 0.3, depression: 0.3, distortion_palam: 0.3, resistance: 0.2 },
      exposure:    {              desire: 0.3,                  shame_palam: 0.5,                               distortion_palam: 0.2, resistance: 0.1 },
      intimacy:    {              desire: 0.2,                                    submission_palam: 0.2,        distortion_palam: 0.4                  },
      dependence:  {                                                              submission_palam: 0.6,        distortion_palam: 1.0                  },
      submission:  {                                                              submission_palam: 0.6, depression: 0.2, distortion_palam: 0.5, resistance: 0.2 },
      disgust:     {                                                                            depression: 0.3,                       resistance: 0.8 },
      pain:        {                                                                            depression: 0.3, distortion_palam: 0.5, resistance: 0.3 }
    }
    // devoted 无 stageModifiers——亲密从一开始就产生扭曲，不随阶段变化
  },
  
  // ----------------------------------------
  // 2.3 submissive · M 倾向型
  // ----------------------------------------
  // 有被支配欲，束缚/羞辱/痛感产生快感反应。
  // 负面刺激转化为生理愉悦。
  
  submissive: {
    id: 'submissive',
    name: 'M 倾向型',
    shortDesc: '被支配欲，束缚/羞辱/痛感产生快感',
    fullDesc: '抵抗有但弱。负面刺激转化为生理愉悦，羞耻感不是纯粹负面，带有兴奋成分。高阶训练/束缚会产生深度快感。适合有 BDSM 倾向的角色。',
    conversion: {
      pleasure_c:  { pleasure: 1.0, desire: 0.7,                                                                distortion_palam: 0.2                  },
      pleasure_v:  { pleasure: 1.0, desire: 0.8, lewdness: 0.2,                                                 distortion_palam: 0.3                  },
      pleasure_a:  { pleasure: 1.0, desire: 0.9, lewdness: 0.2, shame_palam: 0.2,                               distortion_palam: 0.3                  },
      pleasure_b:  { pleasure: 0.8, desire: 0.5,                shame_palam: 0.3                                                                       },
      shame:       { pleasure: 0.2, desire: 0.4,                shame_palam: 1.0, submission_palam: 0.3,                                             resistance: 0.1 },
      terror:      {              desire: 0.1,                                    submission_palam: 0.2, depression: 0.3, distortion_palam: 0.3, resistance: 0.4 },
      humiliation: { pleasure: 0.3, desire: 0.4, lewdness: 0.2, shame_palam: 0.8, submission_palam: 0.6,                                             resistance: 0.2 },
      exposure:    { pleasure: 0.2, desire: 0.5,                shame_palam: 0.5,                                                                    resistance: 0.1 },
      intimacy:    {              desire: 0.2,                                    submission_palam: 0.2, depression: 0.2, distortion_palam: 0.5, resistance: 0.3 },
      dependence:  {              desire: 0.2,                                    submission_palam: 0.5,                  distortion_palam: 0.7, resistance: 0.2 },
      submission:  { pleasure: 0.3, desire: 0.4, lewdness: 0.1, shame_palam: 0.2, submission_palam: 1.2,                  distortion_palam: 0.2, resistance: 0.1 },
      disgust:     {                                                                                                                                 resistance: 0.7 },
      pain:        { pleasure: 0.3, desire: 0.3,                                                                          distortion_palam: 0.3, resistance: 0.3 }
    }
  },
  
  // ----------------------------------------
  // 2.4 volunteer · 自愿型
  // ----------------------------------------
  // 主动投入囚禁，斯德哥尔摩自愿版。
  // 几乎不抵抗，扭曲进程最快。
  
  volunteer: {
    id: 'volunteer',
    name: '自愿型',
    shortDesc: '主动投入，斯德哥尔摩自愿版',
    fullDesc: '几乎不抵抗，将一切合理化，扭曲进程最快。但缺乏"深情"的情感深度（不是因为爱，是因为本身人格倾向）。适合主动寻求囚禁的角色。',
    conversion: {
      pleasure_c:  { pleasure: 1.0, desire: 0.7, lewdness: 0.1,                                                 distortion_palam: 0.4                  },
      pleasure_v:  { pleasure: 1.0, desire: 0.8, lewdness: 0.2,                                                 distortion_palam: 0.5                  },
      pleasure_a:  { pleasure: 1.0, desire: 0.8, lewdness: 0.2, shame_palam: 0.2,                               distortion_palam: 0.5                  },
      pleasure_b:  { pleasure: 0.8, desire: 0.5, lewdness: 0.1, shame_palam: 0.3,                               distortion_palam: 0.3                  },
      shame:       {              desire: 0.2,                  shame_palam: 1.0, submission_palam: 0.2,        distortion_palam: 0.3, resistance: 0.1 },
      terror:      {                                                              submission_palam: 0.3, depression: 0.3, distortion_palam: 0.8, resistance: 0.2 },
      humiliation: {              desire: 0.1,                  shame_palam: 0.7, submission_palam: 0.5,        distortion_palam: 0.3, resistance: 0.1 },
      exposure:    {              desire: 0.2,                  shame_palam: 0.5,                               distortion_palam: 0.2, resistance: 0.1 },
      intimacy:    {              desire: 0.1,                                    submission_palam: 0.3,        distortion_palam: 1.0                  },
      dependence:  {                                                              submission_palam: 0.7,        distortion_palam: 1.2                  },
      submission:  {                                                              submission_palam: 1.0,        distortion_palam: 0.5, resistance: 0.1 },
      disgust:     {                                                                                                                   resistance: 0.2 },
      pain:        {              desire: 0.1,                                    submission_palam: 0.2,        distortion_palam: 0.4, resistance: 0.3 }
    }
  },
  
  // ----------------------------------------
  // 2.5 apathetic · 情感淡漠型
  // ----------------------------------------
  // 心理冲击打不进去，主要通过身体建立联系。
  // 心理类 source 普遍 × 0.5，生理系 100%。硬核难度。
  
  apathetic: {
    id: 'apathetic',
    name: '情感淡漠型',
    shortDesc: '心理冲击打不进去，靠身体建立联系',
    fullDesc: '心理 palam 普遍打折，生理通路正常。扭曲依然存在，但以不同方式呈现（不是"依赖"，是"习惯"）。反感普遍低，但也没有深度积极情感。对玩家是硬核难度。',
    conversion: {
      pleasure_c:  { pleasure: 1.0, desire: 0.7,                                                                depression: 0.1                                    },
      pleasure_v:  { pleasure: 1.0, desire: 0.8, lewdness: 0.1,                                                                       distortion_palam: 0.2                  },
      pleasure_a:  { pleasure: 1.0, desire: 0.8, lewdness: 0.1, shame_palam: 0.1,                                                     distortion_palam: 0.2                  },
      pleasure_b:  { pleasure: 0.8, desire: 0.5,                shame_palam: 0.2                                                                                             },
      shame:       {              desire: 0.1,                  shame_palam: 0.5,                                                                                          resistance: 0.2 },
      terror:      {                                                                                            depression: 0.3,     distortion_palam: 0.2, resistance: 0.4 },
      humiliation: {                                            shame_palam: 0.4, submission_palam: 0.3,                                                                   resistance: 0.2 },
      exposure:    {              desire: 0.2,                  shame_palam: 0.3,                                                                                          resistance: 0.1 },
      intimacy:    {                                                                                            depression: 0.2,     distortion_palam: 0.3, resistance: 0.3 },
      dependence:  {                                                              submission_palam: 0.2,                             distortion_palam: 0.4, resistance: 0.2 },
      submission:  {                                                              submission_palam: 0.5,        depression: 0.2,                            resistance: 0.3 },
      disgust:     {                                                                                                                                       resistance: 0.7 },
      pain:        {                                                                                                                 distortion_palam: 0.2, resistance: 0.5 }
    }
  }
  
};


// ============================================================
// 3. TENDENCY_TAGS —— 17 种倾向 tag
// ============================================================
/*
  conversionDelta 是"相对于主模板的增量"，可以为正可以为负。
  只列非零增量（缺省 = 0）。
  
  promptFragment 是该 tag 的 AI 描述片段，会在 AI prompt 的 [印痕] 行
  之后以"/ 文字"形式拼接。参考 DESIGN_PART2_juels_imprints.md §3.11。
  
  conditionalWhen（可选字段）标记条件型 tag：
    - actionFlag:  string    仅当动作带此 flag 时生效（如 'orality'）
    - charState:   object    仅当 char 状态匹配时生效（如 { consciousness: ['asleep', 'dazed'] }）
    - actionFlags: string[]  任一 flag 存在即生效
  
  不带 conditionalWhen 的 tag 默认永久生效。
  
  excludedMains: 冲突的主模板 id 列表。UI 选择时冲突项变灰。
  
  ============================================================
  17 个 tag 分四组：
    生理倾向 4 个    (masochistic / exhibitionist / oral_fixated / sleep_sensitive)
    心理倾向 4 个    (prideful / trauma_resilient / emotionally_dependent / dissociative)
    关系倾向 3 个    (loyal / jealous / nurturing)
    特殊/占位 6 个   (phobic_trauma + 5 个 Part 2 新增 tag：
                     strategic / aesthetic_revulsion / status_anchored /
                     sexually_experienced / intellectual_arrogance)
  
  占位 tag 只有 promptFragment（已由 Part 2 §3.11.2 明确定义）
  和 excludedMains，conversionDelta 暂留空，等待设计补齐。
  引擎遇到这类 tag 不会改变数值，但会在 prompt 里注入描述。
*/

const TENDENCY_TAGS = {
  
  // ----------------------------------------
  // 生理倾向类（4 个）
  // ----------------------------------------
  
  masochistic: {
    id: 'masochistic',
    name: '受虐倾向',
    group: 'physical',
    desc: '痛感/恐惧/屈辱带来生理快感',
    conversionDelta: {
      pain:        { pleasure: +0.4, desire: +0.3, resistance: -0.3 },
      terror:      { pleasure: +0.2, desire: +0.2, resistance: -0.2 },
      humiliation: { pleasure: +0.2, desire: +0.3                   }
    },
    promptFragment: '该 char 将痛感、恐惧、屈辱体验作为快感的有效来源，这些刺激对该 char 构成的是愉悦而非伤害。',
    excludedMains: []
  },
  
  exhibitionist: {
    id: 'exhibitionist',
    name: '暴露癖',
    group: 'physical',
    desc: '暴露/被观看产生额外兴奋',
    conversionDelta: {
      exposure: { pleasure: +0.3, desire: +0.5, resistance: -0.3, shame_palam: -0.2 }
    },
    promptFragment: '该 char 对暴露、被观看、被展示的情境产生兴奋反应，该反应与羞耻感并存但逐渐占据主导。',
    excludedMains: []
  },
  
  oral_fixated: {
    id: 'oral_fixated',
    name: '口腔依赖',
    group: 'physical',
    desc: '口腔相关动作（如喂食）的依存和快感暴涨',
    conversionDelta: {
      dependence: { pleasure: +0.3, distortion_palam: +0.3 },
      intimacy:   { pleasure: +0.2, distortion_palam: +0.2 }
    },
    conditionalWhen: {
      actionFlag: 'orality'
    },
    promptFragment: '该 char 对口腔相关的接触、亲密和控制表现出超常敏感，该通道是 char 最核心的依恋路径。',
    excludedMains: []
  },
  
  sleep_sensitive: {
    id: 'sleep_sensitive',
    name: '睡眠敏感',
    group: 'physical',
    desc: '睡眠/半昏迷期间的交互触发强烈反应',
    conversionDelta: {
      intimacy:   { distortion_palam: +0.5, dependence: +0.3 },
      pleasure_c: { shame_palam: +0.3                         },
      pleasure_b: { shame_palam: +0.3                         }
    },
    conditionalWhen: {
      charState: { consciousness: ['asleep', 'dazed'] }
    },
    promptFragment: '该 char 在睡眠/意识模糊状态下的反应强度远超清醒时，该状态下 user 的任何接触会被以放大的方式感知。',
    excludedMains: []
  },
  
  // ----------------------------------------
  // 心理倾向类（4 个）
  // ----------------------------------------
  
  prideful: {
    id: 'prideful',
    name: '高自尊',
    group: 'psychological',
    desc: '羞辱效果翻倍，但也极难打破初始抵抗',
    conversionDelta: {
      humiliation: { shame_palam: +0.5, resistance: +0.3, depression: +0.3 },
      exposure:    { shame_palam: +0.4, resistance: +0.2                   },
      submission:  {                    resistance: +0.3                   }
    },
    promptFragment: '该 char 的自尊高度集中，任何羞辱性情境会被以放大形式感知，但同时其初始抵抗也远超一般水平。',
    excludedMains: ['submissive']
  },
  
  trauma_resilient: {
    id: 'trauma_resilient',
    name: '创伤抗性',
    group: 'psychological',
    desc: '恐惧和绝望的效果减半，但情感也更难建立',
    conversionDelta: {
      terror:   { depression: -0.3, resistance: -0.3, distortion_palam: -0.2 },
      shame:    { shame_palam: -0.2                                          },
      intimacy: { distortion_palam: -0.2                                     }
    },
    promptFragment: '该 char 的情感壁垒异常坚固，对恐惧、悲伤、羞耻的常规刺激反应显著减弱。',
    excludedMains: ['devoted', 'volunteer']
  },
  
  emotionally_dependent: {
    id: 'emotionally_dependent',
    name: '情感饥渴',
    group: 'psychological',
    desc: '依存和亲密的扭曲系数暴涨',
    conversionDelta: {
      // 注：原文档提到 dependence_secondary +0.3，但该 palam 不在 8 种标准 palam 中。
      // 暂按语义推测指"加强 submission_palam 产出"。待后续设计确认。
      dependence: { distortion_palam: +0.5, submission_palam: +0.3 },
      intimacy:   { distortion_palam: +0.4, submission_palam: +0.3 }
    },
    promptFragment: '该 char 的情感饥渴强烈，任何被给予的关注或接触都被放大感知，且强化依赖。',
    excludedMains: ['apathetic']
  },
  
  dissociative: {
    id: 'dissociative',
    name: '易解离',
    group: 'psychological',
    desc: '高压下 sanity 大跌，更易累积深度扭曲',
    conversionDelta: {
      terror:      { depression: +0.4, distortion_palam: +0.3 },
      humiliation: { depression: +0.3                         }
    },
    specialEffects: ['sanity_drop_on_high_terror'],
    // ↑ 单次会话 terror palam > 80 时触发 sanity 直接 -10，引擎阶段 5 实现
    promptFragment: '该 char 在高压下容易进入解离状态，表现为意识的抽离、身份感的模糊、以及对当下事件的非同步反应。',
    excludedMains: []
  },
  
  // ----------------------------------------
  // 关系倾向类（3 个）
  // ----------------------------------------
  
  loyal: {
    id: 'loyal',
    name: '忠诚',
    group: 'relational',
    desc: '已建立的关系极难破坏；once bonded, forever',
    conversionDelta: {
      intimacy: { submission_palam: +0.3 },
      disgust:  { resistance: -0.2          }
    },
    specialEffects: ['resistance_halved_after_distortion_bronze'],
    // ↑ 扭曲珠铜级解锁后，resistance 永久 × 0.5，引擎阶段 5 实现
    promptFragment: '该 char 对已建立的关系保持高度稳定的忠诚，即使被伤害，其核心关系感也难以动摇。',
    excludedMains: ['apathetic']
  },
  
  jealous: {
    id: 'jealous',
    name: '占有欲',
    group: 'relational',
    desc: '对比/提及他人触发额外反应',
    conversionDelta: {
      humiliation: { depression: +0.4, resistance: +0.3 }
      // 注：原文还有 "verbal_degrade → shame_palam: +0.3"，但 verbal_degrade 是动作 ID 不是 Source。
      // 动作级别的系数修正超出了当前数据结构。留待设计补齐。
    },
    conditionalWhen: {
      actionFlag: 'rival_reference'
    },
    promptFragment: '该 char 对任何提及或涉及他人的情境（对比、旧人、第三者）产生远超常人的反应，该反应可以是愤怒、嫉妒、或绝望。',
    excludedMains: ['devoted']
  },
  
  nurturing: {
    id: 'nurturing',
    name: '共情型',
    group: 'relational',
    desc: '反向关心 user，产生双向扭曲',
    conversionDelta: {
      intimacy:   { distortion_palam: +0.3 },
      dependence: { distortion_palam: +0.4 }
    },
    specialEffects: ['ai_prompt_inject_char_cares_for_user'],
    promptFragment: '该 char 在被深度调教的同时会产生反向关怀 user 的冲动，这种双向性是其扭曲演化的关键特征。',
    excludedMains: ['apathetic']
  },
  
  // ----------------------------------------
  // 特殊/占位类（6 个）
  // ----------------------------------------
  // 下列 tag 的系数（conversionDelta）尚未由设计补齐，暂时为空。
  // 它们有明确的 promptFragment，能让 AI 正确感知，但暂不改数值。
  // 待设计补齐系数后，直接填入 conversionDelta 即可。
  
  phobic_trauma: {
    id: 'phobic_trauma',
    name: '特定恐惧',
    group: 'special',
    desc: '对特定触发源（玩家配置）保持稳定的创伤回避反应',
    conversionDelta: {},
    configurable: true,
    configSchema: {
      triggers: {
        type: 'string_array',
        label: '触发源',
        placeholder: '如：血、海鲜腥味、火光、声响',
        min: 1,
        max: 5
      }
    },
    specialEffects: ['phobic_trigger_tracked'],
    // ↑ 引擎维护 STATE.char.phobicTriggerCount[triggerId]，供 phobic_rupture 刻印检查
    // promptFragment 含 {trigger_list} 占位符，由引擎在注入时替换为具体触发源列表
    promptFragment: 'char 对 {trigger_list} 保持着稳定的创伤回避反应，该反应不会随其他维度深化而衰减。',
    excludedMains: []
  },
  
  strategic: {
    id: 'strategic',
    name: '策略性',
    group: 'special',
    desc: '即使表现顺从，内在仍在进行模式识别与自我保护规划',
    conversionDelta: {},  // 待设计补齐
    promptFragment: '该 char 的服从/反应仍带有明显的策略性观察——即使表现顺从，内在仍在进行模式识别与自我保护规划。',
    excludedMains: []
  },
  
  aesthetic_revulsion: {
    id: 'aesthetic_revulsion',
    name: '审美厌恶',
    group: 'special',
    desc: '对粗俗、不体面的处境有额外的厌恶反应',
    conversionDelta: {},  // 待设计补齐（预期会对带 crude flag 的动作加强反感）
    promptFragment: '该 char 对粗俗、不体面的处境表现出远超普通层级的厌恶反应，该反应独立于其他心理通路。',
    excludedMains: []
  },
  
  status_anchored: {
    id: 'status_anchored',
    name: '身份锚定',
    group: 'special',
    desc: '自我认同高度依附于社会身份',
    conversionDelta: {},  // 待设计补齐（预期会对带 status_strip flag 的动作加强羞辱）
    promptFragment: '涉及身份剥夺的情境对该 char 的冲击远大于常规心理压力，该 char 的自我认同高度依附于社会身份。',
    excludedMains: []
  },
  
  sexually_experienced: {
    id: 'sexually_experienced',
    name: '性经验丰富',
    group: 'special',
    desc: '对常规性刺激已熟练，仅非常规情境能真正激活',
    conversionDelta: {},  // 待设计补齐（预期会削弱基础 pleasure_*，加强 humiliation 相关的性刺激）
    promptFragment: '该 char 对常规性刺激已熟练，难以产生有意义的身体层反应；仅非常规或打破体面的情境能真正激活其感受系统。',
    excludedMains: []
  },
  
  intellectual_arrogance: {
    id: 'intellectual_arrogance',
    name: '智识傲慢',
    group: 'special',
    desc: '反应强度与对 user 智力的评估相关',
    conversionDelta: {},  // 待设计补齐（需要 user 智力评估的感知维度）
    promptFragment: '该 char 的反应强度与其对 user 智力的评估相关——若 user 被评估为非对等，char 的所有抵抗反应会显著加强。',
    excludedMains: []
  }
  
};


// ============================================================
// 4. PERSONA_CONFLICTS —— 便查冲突表
// ============================================================
/*
  这张表和每个 tag 的 excludedMains 字段是同一信息的两种视图：
    - TENDENCY_TAGS[tagId].excludedMains —— tag 角度："我不能配哪些主模板"
    - PERSONA_CONFLICTS[mainId]          —— 主模板角度："我禁用哪些 tag"
  
  UI 实现时通常按主模板角度查更快：玩家选了 resistant，
  引擎马上知道要把哪些 tag checkbox 变灰。
  
  参考 DESIGN_PART1_5_personas.md §1.5.4。
*/

const PERSONA_CONFLICTS = {
  resistant:  [],                                                // 自由搭配
  devoted:    ['trauma_resilient', 'jealous'],                    // 与深情矛盾
  submissive: ['prideful'],                                       // M 与高自尊冲突
  volunteer:  ['trauma_resilient'],                               // 自愿主动接受一切
  apathetic:  ['emotionally_dependent', 'loyal', 'nurturing']     // 情感淡漠排斥情感投入
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
  
  包含:
  - clamp / clampStats: 数值边界限制
  - classifyEffect: 判断数值变化类别(用于阶段乘数)
  - getRepeatDecayMultiplier: 重复衰减计算
  - applyEffects: 应用状态变化(含阶段乘数+重复衰减的核心)
  - recordAction: 记录动作用于衰减追踪
  
  依赖:STATE, STAT_MIN/MAX, STAGE_MULTIPLIERS, REPEAT_DECAY, EventBus
  被依赖:大部分系统函数都会调用 applyEffects
  
  v0.6.0-alpha.1.dev2 改动(阶段 2.1b):
  - 删除对 arousal / shame / trained / distortion 四个废弃字段的处理
  - 新增 LEGACY_STAT_BLACKLIST,让旧 action.effects 里残留的这些字段被静默忽略
    (避免"幽灵回魂":旧 effects.char.shame=5 悄悄把 shame 字段写回 STATE)
  - classifyEffect 已不处理 physical/training/distortion 类别的判别
    (这些类别留在 STAGE_MULTIPLIERS 里,会在阶段 2.3 的 convertSourceToPalam 中启用)
*/

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// ========== v0.6.0 新增 ==========
// 旧数值字段黑名单:出现在 action.effects.char 或 effects.state 里的这些字段会被忽略
// 用途:让 v0.5.x 时代的动作定义在过渡期继续能跑,但不会把废弃字段写回 STATE
const LEGACY_STAT_BLACKLIST_CHAR = ['arousal', 'shame', 'trained'];
const LEGACY_STAT_BLACKLIST_STATE = ['distortion'];

// 限制所有状态值在 [0, 100] 之间
function clampStats() {
  // v0.6.0: 删除了 arousal / shame / trained 三项
  ['sanity', 'mood', 'sincerity', 'compliance', 'stamina', 'hunger', 'sleep', 'health'].forEach(k => {
    if (STATE.char[k] !== undefined) {
      STATE.char[k] = clamp(STATE.char[k], STAT_MIN, STAT_MAX);
    }
  });
  // v0.6.0: 删除了 STATE.state.distortion 的 clamp
  STATE.state.riskLevel = clamp(STATE.state.riskLevel, 0, 100);
}

// 判断某个数值变化属于哪一类(用于阶段乘数 STAGE_MULTIPLIERS)
// v0.6.0: 只判别 4 个心理值的正向/负向;其他 physical/training/distortion 字段已废弃
function classifyEffect(key, delta) {
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

// 应用状态变化(含阶段乘数 + 重复衰减)
function applyEffects(effects, actionId) {
  if (!effects) return;
  
  const currentStage = STATE.time.stage;
  const repeatMultiplier = getRepeatDecayMultiplier(actionId);
  
  if (effects.char) {
    Object.keys(effects.char).forEach(k => {
      // v0.6.0: 黑名单过滤——旧动作里残留的 arousal/shame/trained 一律忽略
      if (LEGACY_STAT_BLACKLIST_CHAR.includes(k)) return;
      
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
      // v0.6.0: 黑名单过滤——旧动作里残留的 distortion 一律忽略
      if (LEGACY_STAT_BLACKLIST_STATE.includes(k)) return;
      
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
// [core/session.js]
// ============================================================

/*
  src/core/session.js —— 调教会话生命周期管理
  
  会话(Session)是 v0.6.0 引入的概念——Palam 的累积容器。
  动作产生的 Source 在会话内累积为 Palam,会话结束时统一结算为珠的增量。
  
  会话规则:
  - 特定类型的动作(调教类)会触发会话启动
  - 4 小时内无新动作 → 自动结束
  - 玩家主动结束(点击"结束会话"按钮)
  - 会话结束时 Palam 归零,按阈值换算为珠
  
  包含:
  - startSession()           · 启动会话(若当前无 active 会话)
  - endSession()             · 结束会话并触发结算
  - accumulatePalam(id, val) · 把 Palam 增量累积进当前会话
  - checkSessionTimeout()    · 检查是否应该因超时自动结束
  - isSessionAction(action)  · 判断一个动作是否属于"会话类"动作
  
  依赖:STATE (含 STATE.session), EventBus
  被依赖:阶段 2.3 的 applyActionSources / 阶段 2.4 的动作入口
  
  v0.6.0-alpha.1.dev2 新增(阶段 2.2)
  
  注意:本文件只定义函数,不接入引擎调用——接入是阶段 2.3/2.4 的事。
        所以此刻 build 出来后,即使代码全部到位,运行时也不会主动启动会话。
*/

// ========== 常量 ==========

// 会话超时时长(毫秒):4 小时无动作 → 自动结束
const SESSION_TIMEOUT_MS = 4 * 60 * 60 * 1000;

// 会话类动作的分类标签(出现在 action.category 里)
// 这些类别的动作会启动/推进会话;其他类别(env/delivery/contact)不会
// 参考 DESIGN_PART1_architecture_actions.md:调教类 = 触碰/束缚/训练/刺激/药物/羞辱
const SESSION_ACTION_CATEGORIES = [
  'touch',          // 触碰类(touch_hair / hold_hand / embrace 等)
  'bind',           // 束缚类(bind_wrists / bind_full 等)
  'train',          // 训练类(train_sit / train_response 等)
  'stimulate',      // 刺激类(tease_light / stimulate_direct / edge 等)
  'drug',           // 药物类(drug_sedative 等)
  'humiliate'       // 羞辱类(v0.6.0 新增,阶段 8 落地)
];

// ========== 核心函数 ==========

/**
 * 启动会话(幂等:已在会话中则跳过)
 * @returns {boolean} 是否真正启动了新会话(已在进行中返回 false)
 */
function startSession() {
  if (STATE.session.active) {
    return false;  // 已在会话中,不重复启动
  }
  
  const now = Date.now();
  STATE.session.active = true;
  STATE.session.startTime = now;
  STATE.session.lastActionTime = now;
  STATE.session.actionCount = 0;
  STATE.session.sourcesThisAction = null;
  
  // Palam 归零(新会话不继承上一次残留——上一次应在结束时已结算)
  // 防御性写法:如果上一次因为异常未归零,这里兜底
  Object.keys(STATE.session.palam).forEach(k => {
    STATE.session.palam[k] = 0;
  });
  
  EventBus.emit('sessionStarted', {
    startTime: now,
    palam: STATE.session.palam
  });
  
  addLog('session', '调教会话开始。');
  return true;
}

/**
 * 结束会话并触发结算
 * 
 * 本阶段(2.2)只做"清空 + 事件广播",不做珠增量计算。
 * 珠结算逻辑将在阶段 3(珠系统)实现,届时这里会调用 settleSessionToJuels()。
 * 
 * @param {string} reason 结束原因:'manual' | 'timeout' | 'auto'
 * @returns {object|null} 结算快照(本次会话的 Palam 总量,供 UI 展示)
 */
function endSession(reason) {
  if (!STATE.session.active) {
    return null;  // 不在会话中,无需结束
  }
  
  // 拍一份 Palam 快照(给结算弹窗/UI 用)
  const palamSnapshot = Object.assign({}, STATE.session.palam);
  const duration = Date.now() - (STATE.session.startTime || Date.now());
  const actionCount = STATE.session.actionCount;
  
  // ========== TODO 阶段 3 接入 ==========
  // const juelsDeltas = settleSessionToJuels(palamSnapshot);
  // 临时:阶段 2 仅清空,不结算
  
  // 重置会话状态
  STATE.session.active = false;
  STATE.session.startTime = null;
  STATE.session.lastActionTime = null;
  STATE.session.actionCount = 0;
  STATE.session.sourcesThisAction = null;
  Object.keys(STATE.session.palam).forEach(k => {
    STATE.session.palam[k] = 0;
  });
  
  EventBus.emit('sessionEnded', {
    reason: reason || 'manual',
    duration: duration,
    actionCount: actionCount,
    palamSnapshot: palamSnapshot
  });
  
  addLog('session', `调教会话结束(${reason || 'manual'},共 ${actionCount} 个动作)。`);
  
  return {
    reason: reason || 'manual',
    duration: duration,
    actionCount: actionCount,
    palamSnapshot: palamSnapshot
  };
}

/**
 * 累积 Palam 增量到当前会话
 * 如果当前无活跃会话,该次累积被忽略(返回 false)——上游应保证在调用前已 startSession
 * 
 * @param {string} palamId  Palam 标识,如 'submission_palam' / 'shame_palam'
 * @param {number} value    增量值(可正可负,但 Palam 下限为 0)
 * @returns {boolean} 是否成功累积
 */
function accumulatePalam(palamId, value) {
  if (!STATE.session.active) {
    console.warn(`[session] accumulatePalam("${palamId}", ${value}) called while no active session`);
    return false;
  }
  
  if (!(palamId in STATE.session.palam)) {
    console.warn(`[session] unknown palamId: "${palamId}"`);
    return false;
  }
  
  if (typeof value !== 'number' || !isFinite(value)) {
    console.warn(`[session] invalid value for ${palamId}: ${value}`);
    return false;
  }
  
  STATE.session.palam[palamId] += value;
  // Palam 下限为 0(不支持负数 Palam)
  if (STATE.session.palam[palamId] < 0) {
    STATE.session.palam[palamId] = 0;
  }
  
  return true;
}

/**
 * 检查当前会话是否应该因超时自动结束
 * 应在每次执行动作之前调用一次——若超时就先结束旧会话,再让新动作决定是否启动新会话
 * 
 * @returns {boolean} 是否触发了超时结算
 */
function checkSessionTimeout() {
  if (!STATE.session.active) return false;
  if (!STATE.session.lastActionTime) return false;
  
  const elapsed = Date.now() - STATE.session.lastActionTime;
  if (elapsed >= SESSION_TIMEOUT_MS) {
    endSession('timeout');
    return true;
  }
  return false;
}

/**
 * 判断一个动作是否属于会话类动作
 * (即执行它时应该确保会话处于 active 状态)
 * 
 * @param {object} action 动作定义对象(通常是 ACTION_LIBRARY[id] 或 TRAINING_ACTIONS[id])
 * @returns {boolean}
 */
function isSessionAction(action) {
  if (!action) return false;
  if (action.isSessionAction === true) return true;  // 显式标记
  if (!action.category) return false;
  return SESSION_ACTION_CATEGORIES.includes(action.category);
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
  在浏览器环境下是 window,node 环境下是 global/this
*/

global.InPalmEngine = InPalmEngine;

// ========== v0.6.0-alpha.1.dev2 临时调试导出(阶段 2) ==========
// 目的:让浏览器 console 能直接验证 IIFE 内部的工具函数
// 阶段 2.5 收工时(动作迁移完成后)删除这一整块
InPalmEngine._debug = {
  // effects.js
  applyEffects: applyEffects,
  classifyEffect: classifyEffect,
  
  // session.js
  startSession: startSession,
  endSession: endSession,
  accumulatePalam: accumulatePalam,
  checkSessionTimeout: checkSessionTimeout,
  isSessionAction: isSessionAction
};

})(typeof window !== 'undefined' ? window : this);
