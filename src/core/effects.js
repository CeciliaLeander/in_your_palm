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
