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