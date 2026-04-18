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
