/*
  src/core/context.js —— AI 上下文包构建器
  
  这是引擎与 AI 的接口：把所有状态打包成结构化 JSON
  AI 在 Lorebook 规则指导下解读这个 JSON 生成叙事
  
  依赖：STATE, VERSION, SCENE_LIBRARY, ACTION_LIBRARY, TRAINING_ACTIONS,
        STAGES, TOY_LIBRARY
*/

function buildContextPacket(trigger) {
  // 选择叙事模式
  let mode = 'observation';
  if (STATE.state.inDialogue) {
    mode = 'dialogue';
  }
  if (trigger && trigger.triggerType === 'scene') {
    const scene = SCENE_LIBRARY[trigger.triggerId];
    if (scene && scene.type === 'external') mode = 'outside';
    if (trigger.riskEvent) mode = 'tension';
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
