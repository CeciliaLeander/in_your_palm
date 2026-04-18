/*
  src/core/milestones.js —— 关键时刻提示系统
  
  检查数值是否跨越阈值，触发 milestonesTriggered 事件
  每个阈值只会触发一次（STATE.triggeredMilestones 记录已触发的）
  
  依赖：STATE, MILESTONES, EventBus
*/

function checkMilestones() {
  const triggered = [];
  
  Object.keys(MILESTONES).forEach(key => {
    let statValue;
    if (key === 'distortion') statValue = STATE.state.distortion;
    else if (STATE.char[key] !== undefined) statValue = STATE.char[key];
    else return;
    
    MILESTONES[key].forEach(m => {
      if (STATE.triggeredMilestones.has(m.key)) return;
      const condition = m.direction === 'above' ? statValue >= m.value : statValue <= m.value;
      if (condition) {
        STATE.triggeredMilestones.add(m.key);
        triggered.push(m);
      }
    });
  });
  
  if (triggered.length > 0) {
    EventBus.emit('milestonesTriggered', triggered);
  }
  return triggered;
}
