/*
  src/98_api.js —— 公开 API 对象
  
  InPalmEngine 是玩家/UI 与引擎交互的唯一入口
  所有内部函数通过这个对象的方法暴露出去
  
  API 分类：
  - 初始化: init
  - 动作执行: action, customAction, executePreset, visitScene
  - 对话管理: enterDialogue, exitDialogue
  - 玩具管理: equipToy, unequipToy, purchaseToy
  - 预设管理: saveCustomPreset, deleteCustomPreset, getCustomPresets
  - 物品购买: purchase
  - 查询: getState, getContextPacket, getAvailableActions, getAvailableDialogues
  - 工具: advanceTime, endSession, on
  - 静态数据: data, customActionTemplates
*/

const InPalmEngine = {
  VERSION: VERSION,
  
  init: function(config) {
    Object.assign(STATE.config, config || {});
    STATE.initialized = true;
    addLog('system', '系统初始化完成。{{char}} 已被囚禁。');
    EventBus.emit('initialized', STATE);
  },
  
  // 执行一个动作（按钮点击时调用）
  action: function(actionId, params) {
    // 同时查找 ACTION_LIBRARY 和 TRAINING_ACTIONS
    const action = ACTION_LIBRARY[actionId] || TRAINING_ACTIONS[actionId];
    if (!action) {
      console.error('Unknown action:', actionId);
      return null;
    }
    
    // 检查深度档位
    if (action.requiresDepth && !checkDepthRequirement(action.requiresDepth)) {
      EventBus.emit('actionBlocked', { reason: 'depth_locked', requires: action.requiresDepth });
      return null;
    }
    
    // 检查物理条件
    if (action.requiresCondition) {
      const condCheck = checkConditions(action.requiresCondition);
      if (!condCheck.ok) {
        EventBus.emit('actionBlocked', { reason: 'condition', detail: condCheck });
        return null;
      }
    }
    
    // 检查物品要求
    if (action.requiresItem) {
      const required = Array.isArray(action.requiresItem) ? action.requiresItem : [action.requiresItem];
      const hasOne = required.some(id => STATE.inventory[id] > 0);
      if (!hasOne) {
        EventBus.emit('actionBlocked', { reason: 'missing_item', required: required });
        return null;
      }
      for (const id of required) {
        if (STATE.inventory[id] > 0) {
          removeItem(id, 1);
          break;
        }
      }
    }
    
    // 检查玩具要求
    if (action.requiresToy) {
      const required = Array.isArray(action.requiresToy) ? action.requiresToy : [action.requiresToy];
      if (required[0] !== '*') {
        const hasEquipped = required.some(id => STATE.charStatus.toysEquipped.includes(id));
        if (!hasEquipped) {
          EventBus.emit('actionBlocked', { reason: 'missing_toy', required: required });
          return null;
        }
      }
    }
    
    advanceTime(action.durationMinutes || 10);
    applyEffects(action.effects, actionId);
    recordAction(actionId);
    
    if (action.statusChange) {
      Object.assign(STATE.charStatus, action.statusChange);
      EventBus.emit('statusChanged', STATE.charStatus);
    }
    
    addLog('action', action.name);
    
    if (STATE.state.inDialogue && STATE.state.dialogueContext) {
      STATE.state.dialogueContext.turns += 1;
    }
    
    const packet = buildContextPacket({
      triggerType: 'action',
      triggerId: actionId,
      triggerPrompt: action.prompt
    });
    
    EventBus.emit('actionPerformed', { action: action, packet: packet });
    return packet;
  },
  
  // 对话模式管理
  enterDialogue: function(entryId) { return enterDialogueMode(entryId); },
  exitDialogue: function() { return exitDialogueMode(); },
  
  // 玩具装备管理
  equipToy: function(toyId) { return equipToy(toyId); },
  unequipToy: function(toyId) { return unequipToy(toyId); },
  
  purchaseToy: function(toyId) {
    const toy = TOY_LIBRARY[toyId];
    if (!toy) return false;
    STATE.inventory[toyId] = (STATE.inventory[toyId] || 0) + 1;
    EventBus.emit('inventoryChanged', STATE.inventory);
    addLog('toy', `购入: ${toy.name}`);
    return true;
  },
  
  getAvailableActions: function(category) {
    const all = { ...ACTION_LIBRARY, ...TRAINING_ACTIONS };
    return Object.values(all).filter(action => {
      if (category && action.category !== category) return false;
      if (action.requiresDepth && !checkDepthRequirement(action.requiresDepth)) return false;
      if (action.requiresCondition && !checkConditions(action.requiresCondition).ok) return false;
      if (action.requiresStats && !checkStatRequirements(action.requiresStats).ok) return false;
      return true;
    });
  },
  
  getAvailableDialogues: function() {
    return Object.values(DIALOGUE_ENTRIES).filter(entry => {
      if (entry.requiresCondition && !checkConditions(entry.requiresCondition).ok) return false;
      if (entry.requiresStats && !checkStatRequirements(entry.requiresStats).ok) return false;
      return true;
    });
  },
  
  // 自定义动作模板（暴露给 UI 选择用）
  customActionTemplates: CUSTOM_ACTION_TEMPLATES,
  
  // 执行自定义动作
  customAction: function(params) {
    if (!params || !params.description) {
      console.error('customAction requires description');
      return null;
    }
    
    const template = this.customActionTemplates[params.category] || this.customActionTemplates.neutral;
    
    if (template.requiresDepth && !checkDepthRequirement(template.requiresDepth)) {
      EventBus.emit('actionBlocked', { reason: 'depth_locked', requires: template.requiresDepth });
      return null;
    }
    
    if (params.category !== 'observe' && params.category !== 'neutral') {
      const condCheck = checkConditions({ consciousness: ['awake', 'dazed', 'drugged', 'asleep'] });
      if (!condCheck.ok) {
        EventBus.emit('actionBlocked', { reason: 'condition', detail: condCheck });
        return null;
      }
    }
    
    const duration = params.customDuration || template.durationMinutes;
    advanceTime(duration);
    
    const virtualActionId = 'custom_' + (params.category || 'neutral');
    applyEffects(template.effects, virtualActionId);
    recordAction(virtualActionId);
    
    addLog('custom', `[${template.label}] ${params.description.substring(0, 40)}${params.description.length > 40 ? '...' : ''}`);
    
    const aiPrompt = `玩家执行了一个自定义动作。动作类别：${template.label}。玩家对动作的具体描述：「${params.description}」。请根据这段描述生成对应的叙事内容，尊重玩家的创意。严格遵守 Lorebook 中的叙事模式和状态解读规则，根据当前阶段（${STATE.time.stage}）和 {{char}} 的实际状态生成真实反应。`;
    
    const packet = buildContextPacket({
      triggerType: 'custom_action',
      triggerId: virtualActionId,
      triggerPrompt: aiPrompt,
      customDescription: params.description,
      customCategory: template.label
    });
    
    EventBus.emit('customActionPerformed', { params: params, packet: packet });
    return packet;
  },
  
  saveCustomPreset: function(preset) {
    if (!preset || !preset.name || !preset.description) return false;
    STATE.customActionPresets.push({
      name: preset.name,
      description: preset.description,
      category: preset.category || 'neutral',
      durationMinutes: preset.durationMinutes,
      notes: preset.notes || ''
    });
    EventBus.emit('customPresetsChanged', STATE.customActionPresets);
    return true;
  },
  
  deleteCustomPreset: function(index) {
    if (index < 0 || index >= STATE.customActionPresets.length) return false;
    STATE.customActionPresets.splice(index, 1);
    EventBus.emit('customPresetsChanged', STATE.customActionPresets);
    return true;
  },
  
  getCustomPresets: function() {
    return [...STATE.customActionPresets];
  },
  
  executePreset: function(index) {
    const preset = STATE.customActionPresets[index];
    if (!preset) return null;
    return this.customAction({
      description: preset.description,
      category: preset.category,
      customDuration: preset.durationMinutes
    });
  },
  
  // 公开的时间推进 API（用于调试/快进）
  advanceTime: function(minutes) {
    advanceTime(minutes || 60);
    EventBus.emit('stateChanged', STATE);
    return STATE.time;
  },
  
  // 访问外部场景
  visitScene: function(sceneId) {
    const scene = SCENE_LIBRARY[sceneId];
    if (!scene) return null;
    if (scene.type !== 'external') return null;
    
    STATE.location.current = sceneId;
    STATE.location.inCell = false;
    advanceTime(scene.durationHours * 60);
    
    const riskEvent = rollRisk(sceneId);
    if (riskEvent) {
      STATE.state.riskLevel += riskEvent.severity === 'high' ? 15 : riskEvent.severity === 'medium' ? 8 : 3;
      addLog('risk', `风险事件: ${riskEvent.id}`);
    }
    
    addLog('scene', `前往${scene.name}`);
    
    const packet = buildContextPacket({
      triggerType: 'scene',
      triggerId: sceneId,
      triggerPrompt: scene.narrativeHint,
      riskEvent: riskEvent
    });
    
    EventBus.emit('sceneVisited', { scene: scene, packet: packet });
    return packet;
  },
  
  // 购买消耗品
  purchase: function(itemId) {
    const item = ITEM_LIBRARY[itemId];
    if (!item) return false;
    addItem(itemId, 1);
    return true;
  },
  
  // 获取 AI 上下文包
  getContextPacket: function(trigger) { return buildContextPacket(trigger); },
  
  // 获取当前完整状态
  getState: function() { return JSON.parse(JSON.stringify(STATE)); },
  
  // 结束游戏
  endSession: function() {
    const packet = buildContextPacket({
      triggerType: 'end',
      triggerPrompt: '玩家主动结束了这段囚禁。基于 {{char}} 当前的所有状态值，自然地生成一个结束场景。不要套用任何预设模板，完全根据此刻的数值与累积的剧情，生成独一无二的结局。'
    });
    EventBus.emit('sessionEnded', packet);
    return packet;
  },
  
  // 事件订阅
  on: function(event, handler) { EventBus.on(event, handler); },
  
  // 静态数据访问
  data: {
    scenes: SCENE_LIBRARY,
    items: ITEM_LIBRARY,
    toys: TOY_LIBRARY,
    actions: ACTION_LIBRARY,
    trainingActions: TRAINING_ACTIONS,
    dialogueEntries: DIALOGUE_ENTRIES,
    risks: RISK_EVENT_LIBRARY,
    identityMap: IDENTITY_SCENES_MAP,
    stages: STAGES,
    milestones: MILESTONES
  }
};
