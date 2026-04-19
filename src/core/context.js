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