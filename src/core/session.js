/*
  src/core/session.js —— 调教会话生命周期管理
  
  会话(Session)是 v0.6.0 引入的概念——Palam 的累积容器。
  动作产生的 Source 在会话内累积为 Palam,会话结束时统一结算为珠的增量。
  
  会话规则:
  - 特定类型的动作(调教类)会触发会话启动
  - 4 小时内无新动作 → 自动结束
  - 玩家主动结束(点击"结束会话"按钮)
  - 会话结束时 Palam 归零,按阈值换算为珠
  
  包含:
  - startSession()           · 启动会话(若当前无 active 会话)
  - endSession()             · 结束会话并触发结算
  - accumulatePalam(id, val) · 把 Palam 增量累积进当前会话
  - checkSessionTimeout()    · 检查是否应该因超时自动结束
  - isSessionAction(action)  · 判断一个动作是否属于"会话类"动作
  
  依赖:STATE (含 STATE.session), EventBus
  被依赖:阶段 2.3 的 applyActionSources / 阶段 2.4 的动作入口
  
  v0.6.0-alpha.1.dev2 新增(阶段 2.2)
  
  注意:本文件只定义函数,不接入引擎调用——接入是阶段 2.3/2.4 的事。
        所以此刻 build 出来后,即使代码全部到位,运行时也不会主动启动会话。
*/

// ========== 常量 ==========

// 会话超时时长(毫秒):4 小时无动作 → 自动结束
const SESSION_TIMEOUT_MS = 4 * 60 * 60 * 1000;

// 会话类动作的分类标签(出现在 action.category 里)
// 这些类别的动作会启动/推进会话;其他类别(env/delivery/contact)不会
// 参考 DESIGN_PART1_architecture_actions.md:调教类 = 触碰/束缚/训练/刺激/药物/羞辱
const SESSION_ACTION_CATEGORIES = [
  'touch',          // 触碰类(touch_hair / hold_hand / embrace 等)
  'bind',           // 束缚类(bind_wrists / bind_full 等)
  'train',          // 训练类(train_sit / train_response 等)
  'stimulate',      // 刺激类(tease_light / stimulate_direct / edge 等)
  'drug',           // 药物类(drug_sedative 等)
  'humiliate'       // 羞辱类(v0.6.0 新增,阶段 8 落地)
];

// ========== 核心函数 ==========

/**
 * 启动会话(幂等:已在会话中则跳过)
 * @returns {boolean} 是否真正启动了新会话(已在进行中返回 false)
 */
function startSession() {
  if (STATE.session.active) {
    return false;  // 已在会话中,不重复启动
  }
  
  const now = Date.now();
  STATE.session.active = true;
  STATE.session.startTime = now;
  STATE.session.lastActionTime = now;
  STATE.session.actionCount = 0;
  STATE.session.sourcesThisAction = null;
  
  // Palam 归零(新会话不继承上一次残留——上一次应在结束时已结算)
  // 防御性写法:如果上一次因为异常未归零,这里兜底
  Object.keys(STATE.session.palam).forEach(k => {
    STATE.session.palam[k] = 0;
  });
  
  EventBus.emit('sessionStarted', {
    startTime: now,
    palam: STATE.session.palam
  });
  
  addLog('session', '调教会话开始。');
  return true;
}

/**
 * 结束会话并触发结算
 * 
 * 本阶段(2.2)只做"清空 + 事件广播",不做珠增量计算。
 * 珠结算逻辑将在阶段 3(珠系统)实现,届时这里会调用 settleSessionToJuels()。
 * 
 * @param {string} reason 结束原因:'manual' | 'timeout' | 'auto'
 * @returns {object|null} 结算快照(本次会话的 Palam 总量,供 UI 展示)
 */
function endSession(reason) {
  if (!STATE.session.active) {
    return null;  // 不在会话中,无需结束
  }
  
  // 拍一份 Palam 快照(给结算弹窗/UI 用)
  const palamSnapshot = Object.assign({}, STATE.session.palam);
  const duration = Date.now() - (STATE.session.startTime || Date.now());
  const actionCount = STATE.session.actionCount;
  
  // ========== TODO 阶段 3 接入 ==========
  // const juelsDeltas = settleSessionToJuels(palamSnapshot);
  // 临时:阶段 2 仅清空,不结算
  
  // 重置会话状态
  STATE.session.active = false;
  STATE.session.startTime = null;
  STATE.session.lastActionTime = null;
  STATE.session.actionCount = 0;
  STATE.session.sourcesThisAction = null;
  Object.keys(STATE.session.palam).forEach(k => {
    STATE.session.palam[k] = 0;
  });
  
  EventBus.emit('sessionEnded', {
    reason: reason || 'manual',
    duration: duration,
    actionCount: actionCount,
    palamSnapshot: palamSnapshot
  });
  
  addLog('session', `调教会话结束(${reason || 'manual'},共 ${actionCount} 个动作)。`);
  
  return {
    reason: reason || 'manual',
    duration: duration,
    actionCount: actionCount,
    palamSnapshot: palamSnapshot
  };
}

/**
 * 累积 Palam 增量到当前会话
 * 如果当前无活跃会话,该次累积被忽略(返回 false)——上游应保证在调用前已 startSession
 * 
 * @param {string} palamId  Palam 标识,如 'submission_palam' / 'shame_palam'
 * @param {number} value    增量值(可正可负,但 Palam 下限为 0)
 * @returns {boolean} 是否成功累积
 */
function accumulatePalam(palamId, value) {
  if (!STATE.session.active) {
    console.warn(`[session] accumulatePalam("${palamId}", ${value}) called while no active session`);
    return false;
  }
  
  if (!(palamId in STATE.session.palam)) {
    console.warn(`[session] unknown palamId: "${palamId}"`);
    return false;
  }
  
  if (typeof value !== 'number' || !isFinite(value)) {
    console.warn(`[session] invalid value for ${palamId}: ${value}`);
    return false;
  }
  
  STATE.session.palam[palamId] += value;
  // Palam 下限为 0(不支持负数 Palam)
  if (STATE.session.palam[palamId] < 0) {
    STATE.session.palam[palamId] = 0;
  }
  
  return true;
}

/**
 * 检查当前会话是否应该因超时自动结束
 * 应在每次执行动作之前调用一次——若超时就先结束旧会话,再让新动作决定是否启动新会话
 * 
 * @returns {boolean} 是否触发了超时结算
 */
function checkSessionTimeout() {
  if (!STATE.session.active) return false;
  if (!STATE.session.lastActionTime) return false;
  
  const elapsed = Date.now() - STATE.session.lastActionTime;
  if (elapsed >= SESSION_TIMEOUT_MS) {
    endSession('timeout');
    return true;
  }
  return false;
}

/**
 * 判断一个动作是否属于会话类动作
 * (即执行它时应该确保会话处于 active 状态)
 * 
 * @param {object} action 动作定义对象(通常是 ACTION_LIBRARY[id] 或 TRAINING_ACTIONS[id])
 * @returns {boolean}
 */
function isSessionAction(action) {
  if (!action) return false;
  if (action.isSessionAction === true) return true;  // 显式标记
  if (!action.category) return false;
  return SESSION_ACTION_CATEGORIES.includes(action.category);
}
