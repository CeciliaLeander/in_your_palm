/*
  src/core/effects.js —— 状态变化核心逻辑
  
  包含:
  - clamp / clampStats: 数值边界限制
  - classifyEffect: 判断数值变化类别(用于阶段乘数)
  - getRepeatDecayMultiplier: 重复衰减计算
  - applyEffects: 应用状态变化(含阶段乘数+重复衰减的核心)
  - recordAction: 记录动作用于衰减追踪
  
  v0.6.0 阶段 2.3 · Source → Palam 转化链路:
  - PALAM_STAGE_CATEGORY: 8 个 palam 到 STAGE_MULTIPLIERS 分类的映射
  - resolveCoef: 阶段化系数解析器
  - buildEffectiveConversion: 人格合并矩阵构建
  - convertSourceToPalam: 单 Source → 多 Palam 增量转化
  - applyActionSources: 动作级入口(含会话启动 + 累积 + UI 漂浮数据记录)
  
  依赖:STATE, STAT_MIN/MAX, STAGE_MULTIPLIERS, REPEAT_DECAY, EventBus,
        SOURCE_TO_PALAM_MAP (data/sources.js), 
        PERSONA_TEMPLATES / TENDENCY_TAGS / PERSONA_TAG_WEIGHT (data/personas.js),
        startSession / accumulatePalam / isSessionAction (core/session.js),
        SOURCE_DEFINITIONS (data/sources.js, 供 UI 漂浮提示取中文名)
  被依赖:大部分系统函数都会调用 applyEffects / applyActionSources
  
  v0.6.0-alpha.1.dev2 改动(阶段 2.1b):
  - 删除对 arousal / shame / trained / distortion 四个废弃字段的处理
  - 新增 LEGACY_STAT_BLACKLIST,让旧 action.effects 里残留的这些字段被静默忽略
    (避免"幽灵回魂":旧 effects.char.shame=5 悄悄把 shame 字段写回 STATE)
  - classifyEffect 已不处理 physical/training/distortion 类别的判别
    (这些类别留在 STAGE_MULTIPLIERS 里,会在阶段 2.3 的 convertSourceToPalam 中启用)
  
  v0.6.0-alpha.1.dev2 改动(阶段 2.3):
  - 新增 Source→Palam 转化全链路函数(PALAM_STAGE_CATEGORY / resolveCoef /
    buildEffectiveConversion / convertSourceToPalam / applyActionSources)
  - 这些函数供 2.4 的动作执行入口调用,2.5 的动作迁移开始后会真正被触发
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
// v0.6.0 阶段 2.3 · Source → Palam 转化链路
// ============================================================
/*
  本节实现动作产生的 Source 如何转化为会话内累积的 Palam。
  整体流程:
    Action.sources (如 { shame: 5, submission: 8 })
      ↓ applyActionSources
    convertSourceToPalam(每个 source)
      ↓ 按 char 人格配置的 conversion 矩阵
    多个 Palam 增量 (如 shame_palam +5.5, resistance_palam +1.5)
      ↓ accumulatePalam (session.js)
    累积进 STATE.session.palam
  
  依赖:
    - STAGE_MULTIPLIERS (00_constants.js)
    - SOURCE_TO_PALAM_MAP (data/sources.js) —— 提供基础转化系数
    - PERSONA_TEMPLATES / TENDENCY_TAGS / PERSONA_MAIN_WEIGHT / PERSONA_TAG_WEIGHT (data/personas.js)
    - startSession / accumulatePalam / isSessionAction (core/session.js)
    - STATE.time.stage, STATE.char.config.persona, STATE.charStatus
*/

// 8 个 palam 到 STAGE_MULTIPLIERS 分类的映射
// 决定每个 palam 在不同故事阶段受到多大强度的修正
// 决策记录(STAGE2_MID_HANDOFF 问题 A):
//   - pleasure / desire / lewdness / shame → physical
//     (都按"身体反应"的阶段衰减曲线走。shame_palam 选 physical 而非 negative
//      是因为在这个作品里羞耻感与身体反应深度绑定)
//   - submission → training(训练累积)
//   - depression / resistance → negative(负面情绪阶段衰减)
//   - distortion → distortion(已有专属曲线,越到后期越强)
const PALAM_STAGE_CATEGORY = {
  pleasure_palam:    'physical',
  desire_palam:      'physical',
  lewdness_palam:    'physical',
  shame_palam:       'physical',
  submission_palam:  'training',
  depression_palam:  'negative',
  distortion_palam:  'distortion',
  resistance_palam:  'negative'
};

// 把系数解析成具体数字(处理"普通数字"和"阶段化对象"两种形态)
// 输入:
//   coef  - 可能是 number (如 0.5),也可能是 { type: 'staged', byStage: {...}, default: x }
//   stage - 当前故事阶段 ('shock' | 'resist' | 'adapt' | 'transform')
// 输出:
//   number - 对应阶段下的实际系数;解析失败兜底为 0
//
// 使用场景:
//   sources.js 里部分 Source→Palam 系数会随阶段变化(如 intimacy→resistance_palam
//   早期 1.0、晚期 0.1)。这个函数把这种动态值解析成当前阶段的单一数字,
//   方便后续直接乘算。
function resolveCoef(coef, stage) {
  // 普通数字:原样返回
  if (typeof coef === 'number') return coef;
  
  // 阶段化对象:按 stage 查 byStage,找不到用 default
  if (coef && typeof coef === 'object' && coef.type === 'staged') {
    const val = coef.byStage && coef.byStage[stage];
    if (typeof val === 'number') return val;
    return typeof coef.default === 'number' ? coef.default : 0;
  }
  
  // 其他异常情况:返回 0(不破坏引擎,方便后续排查)
  return 0;
}

// 构建 char 身上的"最终 Source→Palam 转化矩阵"
// 
// 输入:
//   personaConfig - char 的人格配置,形如 { main: 'resistant', tags: [{id:'masochistic'}, ...] }
//                   若传 null/undefined,兜底走 { main: 'resistant', tags: [] }
//   action        - 可选,当前动作对象。用于判断 conditionalWhen.actionFlag 类 tag
//                   传 null 视为"调试模式",见下方 ⚠️ 注释
//
// 输出:
//   { conversion: {...}, stageModifiers: {...} }
//   conversion      - 14 个 source × 8 个 palam 的完整转化矩阵(合并后,负值已归零)
//   stageModifiers  - 主模板的阶段化覆盖表(tag 目前不参与 stageModifiers)
//
// 合并公式(参考 personas.js §1):
//   finalCoef = mainCoef + tagDelta * PERSONA_TAG_WEIGHT
//   最后 Math.max(0, finalCoef) 兜底
//
// ⚠️ conditionalWhen 的"调试兜底"逻辑 ⚠️
//   当 action 参数为 null/undefined 时,actionFlag 类 tag 会被"全部当作启用"。
//   这是为了让 console 调试(如 _debug.buildEffectiveConversion(persona, null))
//   能看到所有 tag 的完整效果。
//   真实游戏路径下 action 永远存在,不会走这条兜底。
//   如果你看到这里的矩阵数字和实际动作跑出来的不一样,99% 是因为这条兜底规则。
function buildEffectiveConversion(personaConfig, action) {
  // 1. 兜底:无人格配置 → resistant + 无 tag
  const config = personaConfig || {};
  const mainId = config.main || 'resistant';
  const tagEntries = Array.isArray(config.tags) ? config.tags : [];
  
  const mainTemplate = PERSONA_TEMPLATES[mainId];
  if (!mainTemplate) {
    console.warn('[buildEffectiveConversion] unknown main persona:', mainId, '—— fallback to resistant');
    return buildEffectiveConversion({ main: 'resistant', tags: tagEntries }, action);
  }
  
  // 2. 深拷贝主模板的 conversion 作为起点
  const conversion = {};
  Object.keys(mainTemplate.conversion).forEach(sourceId => {
    conversion[sourceId] = Object.assign({}, mainTemplate.conversion[sourceId]);
  });
  
  // 3. 遍历 tag,叠加 delta
  tagEntries.forEach(entry => {
    const tagId = (typeof entry === 'string') ? entry : entry && entry.id;
    if (!tagId) return;
    
    const tag = TENDENCY_TAGS[tagId];
    if (!tag) {
      console.warn('[buildEffectiveConversion] unknown tag:', tagId);
      return;
    }
    
    // 判断条件型 tag 是否启用
    if (tag.conditionalWhen) {
      const cond = tag.conditionalWhen;
      
      // charState 条件 —— 不管有没有 action 都要判
      if (cond.charState) {
        const charStatus = (STATE && STATE.charStatus) || {};
        let matched = true;
        Object.keys(cond.charState).forEach(key => {
          const expected = cond.charState[key];
          const actual = charStatus[key];
          if (Array.isArray(expected)) {
            if (!expected.includes(actual)) matched = false;
          } else {
            if (actual !== expected) matched = false;
          }
        });
        if (!matched) return;
      }
      
      // actionFlag / actionFlags 条件 —— 依赖 action 参数
      if (cond.actionFlag || cond.actionFlags) {
        if (action) {
          const actionFlags = Array.isArray(action.flags) ? action.flags : [];
          if (cond.actionFlag && !actionFlags.includes(cond.actionFlag)) return;
          if (cond.actionFlags) {
            const anyMatch = cond.actionFlags.some(f => actionFlags.includes(f));
            if (!anyMatch) return;
          }
        }
        // ⚠️ 无 action 时,actionFlag 类 tag 全部启用(调试兜底,详见函数头部注释)
      }
    }
    
    // 应用 tag 的 conversionDelta
    const delta = tag.conversionDelta;
    if (!delta) return;
    
    Object.keys(delta).forEach(sourceId => {
      if (!conversion[sourceId]) conversion[sourceId] = {};
      const srcDelta = delta[sourceId];
      Object.keys(srcDelta).forEach(palamId => {
        const current = conversion[sourceId][palamId] || 0;
        conversion[sourceId][palamId] = current + srcDelta[palamId] * PERSONA_TAG_WEIGHT;
      });
    });
  });
  
  // 4. 负值归零兜底
  Object.keys(conversion).forEach(sourceId => {
    Object.keys(conversion[sourceId]).forEach(palamId => {
      if (conversion[sourceId][palamId] < 0) conversion[sourceId][palamId] = 0;
    });
  });
  
  // 5. 返回矩阵 + 主模板的 stageModifiers(tag 不参与 stageModifiers,保持语义清晰)
  return {
    conversion: conversion,
    stageModifiers: mainTemplate.stageModifiers || {}
  };
}

// 单 Source 转化:把一个 Source 强度分发到多个 Palam 增量
//
// 输入:
//   sourceId    - Source 标识(如 'shame', 'intimacy', 'submission')
//   sourceValue - 该 Source 的强度数值(由动作的 sources 字段提供)
//   ctx         - 可选上下文对象,形如:
//                 { stage, personaConfig, action, actionId }
//                 各字段都可选,缺省时从 STATE 读取兜底值
//
// 输出:
//   [{ palam: 'shame_palam', delta: 13 }, { palam: 'resistance_palam', delta: 4 }, ...]
//   delta 是已取整的正整数;delta === 0 的条目不出现在结果里
//
// 计算链路:
//   rawCoef (人格矩阵)
//     → stageModifiers 覆盖 或 resolveCoef 解析
//     → × STAGE_MULTIPLIERS[category][stage]
//     → × getRepeatDecayMultiplier(actionId)
//     → Math.round
function convertSourceToPalam(sourceId, sourceValue, ctx) {
  // 1. 校验输入
  if (typeof sourceValue !== 'number' || !isFinite(sourceValue)) {
    console.warn('[convertSourceToPalam] invalid sourceValue:', sourceValue);
    return [];
  }
  
  // 2. 解析上下文(各字段都可选,缺省从 STATE 读)
  ctx = ctx || {};
  const stage         = ctx.stage         || (STATE && STATE.time && STATE.time.stage)   || 'shock';
  const personaConfig = ctx.personaConfig || (STATE && STATE.char && STATE.char.config && STATE.char.config.persona) || null;
  const action        = ctx.action || null;
  const actionId      = ctx.actionId || (action && action.id) || null;
  
  // 3. 构建 char 的人格转化矩阵
  const effective = buildEffectiveConversion(personaConfig, action);
  const sourceRow = effective.conversion[sourceId];
  if (!sourceRow) {
    // 该 Source 在当前人格下不产生任何 palam(正常情况,如 fatigue)
    return [];
  }
  
  const stageModifiers = effective.stageModifiers || {};
  const repeatMul = getRepeatDecayMultiplier(actionId);
  
  // 4. 遍历 sourceRow,对每个 palam 配对算 delta
  const result = [];
  Object.keys(sourceRow).forEach(palamId => {
    const rawCoef = sourceRow[palamId];
    let coef;
    
    // 4a. stageModifiers 优先:若主模板定义了 source.palam 的阶段覆盖,按 stage 直接查
    const modKey = sourceId + '.' + palamId;
    if (stageModifiers[modKey]) {
      const modByStage = stageModifiers[modKey];
      coef = (typeof modByStage[stage] === 'number') ? modByStage[stage] : 0;
    } else {
      // 4b. 无覆盖:走 resolveCoef,处理普通数字和 staged 对象
      coef = resolveCoef(rawCoef, stage);
    }
    
    if (coef <= 0) return;  // 系数为 0 或负 → 不产出这个 palam
    
    // 4c. 按 palam 分类取 stage 乘数
    const category = PALAM_STAGE_CATEGORY[palamId];
    const stageMul = (category && STAGE_MULTIPLIERS[category] && STAGE_MULTIPLIERS[category][stage]) || 1.0;
    
    // 4d. 合成 delta
    let delta = sourceValue * coef * stageMul * repeatMul;
    delta = Math.round(delta);
    
    if (delta > 0) {
      result.push({ palam: palamId, delta: delta });
    }
  });
  
  return result;
}

// 动作链路总入口:把动作的所有 sources 转化并累积进会话
//
// 输入:
//   action - 动作对象,必须含 sources 字段,形如:
//            { id: 'train_sit', category: 'train', sources: { shame: 5, submission: 8 }, flags: [...] }
//   ctx    - 可选上下文(透传给 convertSourceToPalam),允许传入预构建的 personaConfig 等
//
// 副作用:
//   - 若动作属于 6 种调教类 → startSession()
//   - 对每个 Source 调 convertSourceToPalam → accumulatePalam(入 session.palam)
//   - 填充 STATE.session.sourcesThisAction(供 UI 短暂展示"+3 屈従"类漂浮提示)
//
// 返回:
//   {
//     sessionStarted: boolean,
//     sources: [  // 本次动作所有 Source 的完整明细
//       { sourceId, sourceName, sourceValue, palamDeltas: [{palam, delta}, ...] },
//       ...
//     ]
//   }
//
// 本函数不调用 applyEffects —— Source→Palam 链路和旧的 effects 链路是两条独立通路。
// 2.4 的动作执行入口会在同一个动作上同时调用两者(过渡期共存)。
function applyActionSources(action, ctx) {
  if (!action || !action.sources) {
    return { sessionStarted: false, sources: [] };
  }
  
  // 1. 会话类动作 → 启动会话(幂等,已启动则跳过)
  let sessionStarted = false;
  if (typeof isSessionAction === 'function' && isSessionAction(action)) {
    if (typeof startSession === 'function') {
      sessionStarted = startSession() === true;
    }
  }
  
  // 2. 准备上下文(补全 action / actionId,透传给 convertSourceToPalam)
  const effectiveCtx = Object.assign({}, ctx || {}, {
    action: action,
    actionId: (ctx && ctx.actionId) || action.id || null
  });
  
  // 3. 遍历 sources,转化并累积
  const sourcesDetail = [];
  Object.keys(action.sources).forEach(sourceId => {
    const sourceValue = action.sources[sourceId];
    const deltas = convertSourceToPalam(sourceId, sourceValue, effectiveCtx);
    
    // 累积进 session.palam(若会话未启动,accumulatePalam 会自己返回 false 并 warn)
    deltas.forEach(d => {
      if (typeof accumulatePalam === 'function') {
        accumulatePalam(d.palam, d.delta);
      }
    });
    
    // 记录明细(供 UI 漂浮提示)
    const sourceDef = (typeof SOURCE_DEFINITIONS !== 'undefined') ? SOURCE_DEFINITIONS[sourceId] : null;
    sourcesDetail.push({
      sourceId: sourceId,
      sourceName: (sourceDef && sourceDef.name) || sourceId,
      sourceValue: sourceValue,
      palamDeltas: deltas
    });
  });
  
  // 4. 写入 sourcesThisAction(覆盖上一次动作的数据)
  if (STATE && STATE.session) {
    STATE.session.sourcesThisAction = sourcesDetail;
  }
  
  return { sessionStarted: sessionStarted, sources: sourcesDetail };
}