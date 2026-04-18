/*
  src/systems/dialogue.js —— 对话模式管理
  
  - enterDialogueMode: 进入某个对话切入点（闲聊、审讯等）
  - exitDialogueMode: 退出对话模式
  
  进入时检查条件，应用开场效果，返回给 AI 的上下文包
  依赖：STATE, DIALOGUE_ENTRIES, EventBus, checkConditions,
        checkStatRequirements, applyEffects, addLog, buildContextPacket
*/

function enterDialogueMode(entryId) {
  const entry = DIALOGUE_ENTRIES[entryId];
  if (!entry) return null;
  
  // 检查条件
  const condCheck = checkConditions(entry.requiresCondition);
  if (!condCheck.ok) return { blocked: true, reason: condCheck };
  
  const statCheck = checkStatRequirements(entry.requiresStats);
  if (!statCheck.ok) return { blocked: true, reason: statCheck };
  
  STATE.state.inDialogue = true;
  STATE.state.dialogueContext = {
    entryId: entryId,
    entry: entry,
    startTime: { day: STATE.time.day, hour: STATE.time.hour, minute: STATE.time.minute },
    turns: 0
  };
  
  // 应用开场影响
  if (entry.openingEffects) {
    applyEffects(entry.openingEffects);
  }
  
  addLog('dialogue', `进入对话模式: ${entry.name}`);
  
  const packet = buildContextPacket({
    triggerType: 'dialogue_start',
    triggerId: entryId,
    triggerPrompt: entry.prompt
  });
  
  EventBus.emit('dialogueStarted', { entry: entry, packet: packet });
  return packet;
}

function exitDialogueMode() {
  if (!STATE.state.inDialogue) return null;
  
  const context = STATE.state.dialogueContext;
  STATE.state.inDialogue = false;
  STATE.state.dialogueContext = null;
  
  addLog('dialogue', `退出对话模式（持续 ${context ? context.turns : 0} 轮）`);
  EventBus.emit('dialogueEnded', { context: context });
  return context;
}
