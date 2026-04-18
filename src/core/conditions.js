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
