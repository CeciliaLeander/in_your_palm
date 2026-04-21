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