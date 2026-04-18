/*
  回归测试：验证拆分后的 engine.js 与旧版 engine.js.backup 行为完全一致
  
  策略：
  1. 加载旧引擎，跑一系列固定操作，记录每步状态快照
  2. 加载新引擎，跑同样的操作，记录状态快照
  3. 逐一对比
  
  注意：涉及随机性的操作（visitScene 触发风险）需要用同一个 Math.random mock
*/

const fs = require('fs');

// 创建独立的沙盒运行环境
function runInSandbox(enginePath) {
  // 用一个伪 window 对象作为 global
  const sandbox = {};
  const code = fs.readFileSync(enginePath, 'utf8');
  
  // 用 Function 构造器在一个干净的作用域跑引擎
  const fn = new Function('window', 'global', 'Math', code + '; return window.InPalmEngine;');
  
  // 固定的 Math.random 序列，让测试可复现
  let randomSeed = 0;
  const fixedRandoms = [
    0.5, 0.9, 0.3, 0.7, 0.1, 0.6, 0.2, 0.8, 0.4, 0.5,
    0.5, 0.9, 0.3, 0.7, 0.1, 0.6, 0.2, 0.8, 0.4, 0.5,
    0.5, 0.9, 0.3, 0.7, 0.1, 0.6, 0.2, 0.8, 0.4, 0.5
  ];
  const mockMath = Object.create(Math);
  mockMath.random = () => fixedRandoms[randomSeed++ % fixedRandoms.length];
  
  const engine = fn(sandbox, sandbox, mockMath);
  
  return { engine, sandbox };
}

// 提取关键状态用于比对
function snapshot(engine) {
  const state = engine.getState();
  return {
    day: state.time.day,
    hour: state.time.hour,
    minute: state.time.minute,
    stage: state.time.stage,
    location: state.location.current,
    char: { ...state.char },
    charStatus: {
      consciousness: state.charStatus.consciousness,
      position: state.charStatus.position,
      clothed: state.charStatus.clothed,
      gagged: state.charStatus.gagged,
      blindfolded: state.charStatus.blindfolded,
      collared: state.charStatus.collared,
      toysEquipped: [...state.charStatus.toysEquipped]
    },
    state_: {
      distortion: state.state.distortion,
      riskLevel: state.state.riskLevel,
      inDialogue: state.state.inDialogue
    },
    inventory: { ...state.inventory },
    logCount: state.log.length,
    lastLogs: state.log.slice(-3).map(l => l.type + ':' + l.text)
  };
}

// 测试脚本：一系列操作
function runTestSequence(engine, label) {
  console.log(`\n--- ${label} ---`);
  const snapshots = [];
  
  engine.init({
    crimeType: 'meticulous', style: 'ornate', depth: 'r18',
    motive: 'obsession', relation: 'admirer',
    playerIdentity: '测试', playerTraits: ['冷静'], theme: 'minimal'
  });
  snapshots.push({ step: 'init', snap: snapshot(engine) });
  
  // 操作 1：环境动作
  engine.action('cut_lights');
  snapshots.push({ step: 'cut_lights', snap: snapshot(engine) });
  
  engine.action('restore_lights');
  snapshots.push({ step: 'restore_lights', snap: snapshot(engine) });
  
  // 操作 2：购买+装备玩具
  engine.purchaseToy('toy_collar_leather');
  engine.equipToy('toy_collar_leather');
  snapshots.push({ step: 'equip_collar', snap: snapshot(engine) });
  
  engine.purchaseToy('toy_handcuff_metal');
  engine.equipToy('toy_handcuff_metal');
  snapshots.push({ step: 'equip_cuffs', snap: snapshot(engine) });
  
  // 操作 3：触碰类动作（震惊期）
  engine.action('touch_hair');
  engine.action('touch_hair');
  engine.action('touch_hair');
  snapshots.push({ step: 'touch_hair_x3', snap: snapshot(engine) });
  
  // 操作 4：对话模式
  engine.enterDialogue('interrogation');
  snapshots.push({ step: 'enter_interrogation', snap: snapshot(engine) });
  
  engine.exitDialogue();
  snapshots.push({ step: 'exit_dialogue', snap: snapshot(engine) });
  
  // 操作 5：购买消耗品
  engine.purchase('food_premium');
  engine.purchase('sedative_otc');
  snapshots.push({ step: 'purchase', snap: snapshot(engine) });
  
  // 操作 6：送食物
  engine.action('deliver_food_premium');
  snapshots.push({ step: 'deliver_food', snap: snapshot(engine) });
  
  // 操作 7：自定义动作
  engine.customAction({
    description: '测试描述',
    category: 'training_harsh'
  });
  snapshots.push({ step: 'custom_action', snap: snapshot(engine) });
  
  // 操作 8：时间推进
  engine.advanceTime(1440 * 5);  // 5 天
  snapshots.push({ step: 'advance_5days', snap: snapshot(engine) });
  
  // 操作 9：适应期的触碰
  engine.action('embrace');
  snapshots.push({ step: 'embrace_adapt', snap: snapshot(engine) });
  
  // 操作 10：访问外部场景
  engine.visitScene('supermarket');
  snapshots.push({ step: 'visit_supermarket', snap: snapshot(engine) });
  
  // 操作 11：特殊动作
  engine.action('fake_rescue_signal');
  snapshots.push({ step: 'fake_rescue', snap: snapshot(engine) });
  
  // 操作 12：卸下玩具
  engine.unequipToy('toy_collar_leather');
  snapshots.push({ step: 'unequip_collar', snap: snapshot(engine) });
  
  // 操作 13：药物+意识切换
  engine.purchase('sedative_otc');
  engine.action('drug_sedative');
  snapshots.push({ step: 'drug', snap: snapshot(engine) });
  
  // 操作 14：结束
  engine.endSession();
  snapshots.push({ step: 'end', snap: snapshot(engine) });
  
  console.log(`  完成 ${snapshots.length} 步`);
  return snapshots;
}

function compareSnapshots(oldSnaps, newSnaps) {
  let pass = 0, fail = 0;
  const diffs = [];
  
  if (oldSnaps.length !== newSnaps.length) {
    console.log(`  ✗ 步数不一致: old=${oldSnaps.length}, new=${newSnaps.length}`);
    return false;
  }
  
  for (let i = 0; i < oldSnaps.length; i++) {
    const o = oldSnaps[i];
    const n = newSnaps[i];
    
    if (o.step !== n.step) {
      diffs.push(`步骤名不一致: ${o.step} vs ${n.step}`);
      fail++;
      continue;
    }
    
    const oStr = JSON.stringify(o.snap);
    const nStr = JSON.stringify(n.snap);
    
    if (oStr === nStr) {
      pass++;
    } else {
      fail++;
      diffs.push(`步骤 "${o.step}" 不一致:`);
      // 找出具体哪里不同
      Object.keys(o.snap).forEach(k => {
        const oVal = JSON.stringify(o.snap[k]);
        const nVal = JSON.stringify(n.snap[k]);
        if (oVal !== nVal) {
          diffs.push(`  ${k}:`);
          diffs.push(`    old: ${oVal}`);
          diffs.push(`    new: ${nVal}`);
        }
      });
    }
  }
  
  console.log(`\n=== 对比结果 ===`);
  console.log(`  通过: ${pass} / ${oldSnaps.length}`);
  console.log(`  失败: ${fail}`);
  
  if (diffs.length > 0) {
    console.log(`\n差异详情:`);
    diffs.slice(0, 30).forEach(d => console.log('  ' + d));
    if (diffs.length > 30) console.log(`  ... 还有 ${diffs.length - 30} 条`);
  }
  
  return fail === 0;
}

// 主逻辑
console.log('=== 回归测试：对比新旧 engine 行为 ===');

const old = runInSandbox('./engine.js.backup');
const oldSnaps = runTestSequence(old.engine, '旧版 engine.js.backup');

const neu = runInSandbox('./engine.js');
const newSnaps = runTestSequence(neu.engine, '新版 engine.js');

const ok = compareSnapshots(oldSnaps, newSnaps);

if (ok) {
  console.log('\n✅ 回归测试完全通过：新旧引擎行为一致');
  process.exit(0);
} else {
  console.log('\n❌ 回归测试失败：存在行为差异');
  process.exit(1);
}
