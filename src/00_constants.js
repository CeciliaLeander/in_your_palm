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