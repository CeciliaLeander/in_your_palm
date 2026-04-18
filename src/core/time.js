/*
  src/core/time.js —— 时间与日志系统
  
  - advanceTime: 推进时间（分钟级），跨越小时/天时自动触发相应事件
  - updateStage: 根据天数更新当前阶段
  - addLog: 添加日志条目
  
  依赖：STATE, STAGES, EventBus, applyEffects（每日自然消耗时调用）
*/

function advanceTime(minutes) {
  STATE.time.minute += minutes;
  while (STATE.time.minute >= 60) {
    STATE.time.minute -= 60;
    STATE.time.hour += 1;
  }
  while (STATE.time.hour >= 24) {
    STATE.time.hour -= 24;
    STATE.time.day += 1;
    // 每过一天，应用"自然消耗"
    applyEffects({
      char: {
        hunger: +20,   // 每天自然增加饥饿感
        stamina: -5,   // 自然消耗体力
        sanity: -2     // 长期囚禁对理智的缓慢消耗
      }
    });
  }
  updateStage();
  EventBus.emit('timeChanged', STATE.time);
}

function updateStage() {
  const day = STATE.time.day;
  for (const s of STAGES) {
    if (day >= s.dayMin && day <= s.dayMax) {
      if (STATE.time.stage !== s.id) {
        STATE.time.stage = s.id;
        EventBus.emit('stageChanged', s);
        addLog('stage', `进入${s.name}（第 ${day} 天）`);
      }
      return;
    }
  }
}

function addLog(type, text) {
  STATE.log.push({
    timestamp: `D${STATE.time.day} ${String(STATE.time.hour).padStart(2,'0')}:${String(STATE.time.minute).padStart(2,'0')}`,
    type: type,
    text: text
  });
  if (STATE.log.length > 200) STATE.log.shift();
  EventBus.emit('logAdded', STATE.log[STATE.log.length - 1]);
}
