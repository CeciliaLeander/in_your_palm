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
