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
