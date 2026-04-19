# 掌心的它 · 调教系统设计文档 Part 3-C

> **版本**:Design v1.0
> **范围**:文档六——代码改造路线图(**最终交付文档**)
> **依赖**:前五份文档全部
> **目标**:把前五份的设计翻译成**可执行、分阶段、可回滚**的代码改造计划

---

# 文档六 · 代码改造路线图

## 6.1 重要前提:大部分现有代码会保留

在开始路线图之前,**澄清一件事**:

| 类型 | 大约比例 |
|---|---|
| 完全保留不动 | **~60%** |
| 改造但保留思路 | **~25%** |
| 新增(全新文件) | **~14%** |
| 真正删除 | **~1%** |

具体来说:

### 完全保留不动的文件(15 个)
```
src/data/items.js / toys.js / scenes.js / risks.js / dialogue.js /
custom_templates.js
src/00_constants.js (仅微调)
src/core/time.js / conditions.js / inventory.js / risks.js / milestones.js
src/systems/toys.js / dialogue.js
lorebook/core_lorebook.json
```

### 真正删除的内容
**只有 4 项 STATE 数据**:`arousal`、`shame`、`trained`、`distortion`。
以及这 4 项相关的赋值代码(在 actions/training 的 effects 字段里)。

**没了**。其他都是改造或新增。

---

## 6.2 总体策略

### 6.2.1 核心原则

**1. 小步快跑,每步可验证**
- 每个阶段独立交付,独立测试
- 任一阶段崩了,前一阶段的版本能无损回退
- **不允许连续多阶段才能验证的改动**

**2. 灰盒期优先**
- 先让**引擎跑通**(后台能算 source/palam/珠),UI 暂不动
- 用 console.log 验证数值流转
- UI 改造放在引擎稳定之后

**3. 垂直切片优先于水平覆盖**
- 先做**一条完整链路**(比如"训练坐姿"这一个动作的 source→palam→珠→印痕注入)
- 跑通之后再复制扩展到其他动作

**4. 旧系统退休期**
- 改造开始时,旧 ABL 直接修改逻辑(`effects: char:{trained:+5}`)**立即冻结,不再维护**
- 旧数值 arousal/shame/trained/distortion **从 STATE 删除**,不兼容旧存档

### 6.2.2 版本规划

| 版本号 | 内容 | 阶段 |
|---|---|---|
| v0.5.3 | 当前版本(baseline) | - |
| v0.6.0-alpha.1 | 引擎三层架构(无 UI) | 阶段 1-3 |
| v0.6.0-alpha.2 | 人格模板系统 | 阶段 4 |
| v0.6.0-alpha.3 | 刻印系统 | 阶段 5 |
| v0.6.0-beta.1 | UI 改造一期(noir 主题) | 阶段 6 |
| v0.6.0-beta.2 | UI 改造二期(珠谱+结算) | 阶段 7 |
| v0.6.0-rc | 动作库扩展到 76 个 | 阶段 8 |
| v0.6.0 | 正式版(含 3 主题完整) | - |

### 6.2.3 Git 分支策略

**强烈建议:**
1. 当前 v0.5.3 已推到 main 分支,这是"安全岛"
2. 创建新分支:`git checkout -b refactor-v0.6.0`
3. 所有重构在这个分支上做
4. 每完成一个阶段:`git tag v0.6.0-alpha.1.dev1` 等
5. v0.6.0 完成前,**不合并到 main**

这样任何时候都能 `git checkout main` 回到稳定的 v0.5.3。

---

## 6.3 八大改造阶段总览

```
阶段 1: 数据层铺设 (不改逻辑,只加新数据文件)        ~2h  风险🟢
   ↓
阶段 2: 引擎核心改造 (Source→Palam 转化链路)        ~4h  风险🔴
   ↓
阶段 3: 珠系统 + 印痕注入 (会话结算 + prompt 改造)   ~3h  风险🟡
   ↓
阶段 4: 人格模板系统 (系数修正层)                   ~2h  风险🟡
   ↓
阶段 5: 刻印系统 (触发检查 + 修正器)                ~2h  风险🟡
   ↓
阶段 6: UI 重构一期 (数值区 + 会话面板)             ~4h  风险🟢
   ↓
阶段 7: UI 重构二期 (珠谱 + 刻印条 + 结算弹窗)       ~4h  风险🟡
   ↓
阶段 8: 动作库扩展 (35 → 76 个动作)                 ~3h  风险🟡
   ↓
[正式 v0.6.0 发布]
```

**总预估工作量**:约 24 小时(分布在 8-15 个对话窗口)。

---

## 6.4 阶段 1 · 数据层铺设

### 6.4.1 目标
只新增数据文件,**不动任何逻辑**。引擎跑起来跟现在一模一样。

### 6.4.2 具体任务

**任务 1.1 · 新建 `src/data/sources.js`**
14 种 Source 定义。

**任务 1.2 · 新建 `src/data/palam.js`**
8 种 Palam 定义 + 阈值表。

**任务 1.3 · 新建 `src/data/juels.js`**
6 种珠定义 + 4 级阈值 + **120 条印痕文本**(全部从 Part 2 复制过来)。

**任务 1.4 · 新建 `src/data/imprints.js`**
9 种刻印定义 + 触发条件函数 + AI prompt 文本。

**任务 1.5 · 新建 `src/data/personas.js`**
5 种主模板 + 18 个 tag + 冲突规则 + 合并公式。

**任务 1.6 · 更新 `build.js`**
把新文件加到构建序列里。

### 6.4.3 验证方式
- `node build.js` 能正常构建,不报错
- 酒馆载入扩展,`window.InPalmEngine.SOURCE_DEFINITIONS` 等能访问到
- **旧功能完全不受影响**

### 6.4.4 风险:🟢 极低
纯新增文件,不改现有逻辑。

### 6.4.5 回归测试清单
- [ ] 扩展正常加载
- [ ] 顶栏按钮能打开抽屉
- [ ] 开场菜单走完 8 步能开始游戏
- [ ] 所有现有动作按钮都能点击
- [ ] 数值能正常变化(还是旧逻辑)

---

## 6.5 阶段 2 · 引擎核心改造 · Source → Palam 链路

### 6.5.1 目标
**核心逻辑切换**:动作不再直接改 ABL,而是产生 source → 转化 palam → 累积会话。

**这是整个重构中最危险的阶段**。

### 6.5.2 具体任务

**任务 2.1 · 改造 STATE 结构**
```javascript
// 新增
STATE.session = {
  active: false,
  startTime: null,
  actionCount: 0,
  palam: { /* 8 种 palam */ },
  lastActionTime: null,
  sourcesThisAction: null
};

// 删除(旧的)
delete STATE.char.arousal;
delete STATE.char.shame;
delete STATE.char.trained;
delete STATE.state.distortion;

// 新增永久珠存储
STATE.char.juels = {
  obedience: 0, distortion: 0, shame: 0,
  desire: 0, emptiness: 0, resistance: 0
};
STATE.char.juelsUnlocked = [];
```

**任务 2.2 · 新建 `src/core/session.js`**
- `startSession()` · 启动会话
- `endSession()` · 结束并触发结算
- `accumulatePalam(source, value)` · 把单次动作的 source 累积到会话 palam
- `checkSessionTimeout()` · 检查是否应自动结束(4 小时冷却)

**任务 2.3 · 改造 `src/core/effects.js`**
- **保留**:阶段乘数、重复衰减(沿用现有逻辑)
- **新增**:`convertSourceToPalam(source, value, charState, stageMod)`
- **新增**:`applyActionSources(action, char)` — 把动作的 sources 转成 palam 增量

**任务 2.4 · 改造动作执行入口**
找到现在执行动作的核心函数,改造流程:
```
新流程:
action →
  if (action.sources) {
    if (isSessionAction(action)) startSessionIfNeeded()
    sourcesAfterDecay = applyRepeatDecay(action.sources)
    for (each source)
      palam_delta = convertSourceToPalam(source, charState, stageMod)
      session.palam[target_palam] += palam_delta
  }
  if (action.physicalCost) applyPhysicalCost(action.physicalCost)
  if (action.statusChange) applyStatusChange(action.statusChange)
```

**任务 2.5 · 动作库过渡(仅 5 个动作试点)**
**不要一次改所有动作**。先改 5 个做试点:
- `train_sit` (训练类代表)
- `touch_face` (触碰类代表)
- `bind_wrists` (束缚类代表)
- `tease_light` (刺激类代表,如果 depth 允许)
- `cut_lights` (非会话类代表)

把这 5 个动作的 `effects` 字段替换成 `sources` 字段。
**其他动作暂时保留 effects**,引擎对它们使用兼容模式(或者视觉上报错"此动作待迁移")。

### 6.5.3 验证方式

**控制台测试序列**:
```javascript
InPalmEngine.STATE.session  // 验证初始化
InPalmEngine.executeAction('train_sit')
InPalmEngine.STATE.session.active  // 应为 true
InPalmEngine.STATE.session.palam  // 应有数值
InPalmEngine.STATE.session.sourcesThisAction  // 应显示屈従+3 等
```

### 6.5.4 风险:🔴 高
核心流程改造,任何一点 bug 都可能导致动作点击后数值完全不对或报错。

### 6.5.5 回归测试清单
- [ ] 5 个试点动作点击后,`session.palam` 有合理数值增加
- [ ] 非会话类动作(cut_lights)不启动会话
- [ ] 会话超时(4h)自动结束
- [ ] 现有生理值(stamina/hunger 等)变化仍正常
- [ ] 阶段乘数和重复衰减仍生效
- [ ] 其他 30 个未迁移动作点击不报错

### 6.5.6 失败回滚策略
- 必要:把阶段 1 的产物(所有新数据文件)打 git tag
- 如果阶段 2 出问题:`git reset --hard <阶段 1 tag>`,重新尝试

---

## 6.6 阶段 3 · 珠系统 + 印痕注入

### 6.6.1 目标
会话结算能产生珠,印痕能注入到 prompt。

### 6.6.2 具体任务

**任务 3.1 · 实现会话结算**
```javascript
function endSession() {
  for (each palam in session.palam) {
    const juelsGained = Math.floor(palam_value / 100)
    if (juelsGained > 0) {
      STATE.char.juels[juelToPalamMap[palam]] += juelsGained
      checkLevelUp(juelId)
    }
  }
  STATE.session.active = false
  STATE.session.palam = { /* 全 0 */ }
  return { juelsGained, levelsUnlocked }
}
```

**任务 3.2 · 珠等级检查**
```javascript
function checkLevelUp(juelId) {
  const juelTotal = STATE.char.juels[juelId]
  const thresholds = JUEL_DEFINITIONS[juelId].thresholds
  const currentLevel = getCurrentLevel(juelId)
  if (juelTotal >= thresholds[currentLevel + 1]) {
    const newLevel = currentLevel + 1
    STATE.char.juelsUnlocked.push({
      juelId,
      level: newLevel,
      unlockedAt: { day: STATE.time.day, hour: STATE.time.hour },
      triggerActionId: /* 最近动作 */,
      stateSnapshot: { /* 快照 */ }
    })
    return { juelId, level: newLevel }
  }
  return null
}
```

**任务 3.3 · 改造 `src/core/context.js` · 印痕注入**
```javascript
function buildImprintLine() {
  const lines = []
  for (each juelId) {
    const currentLevel = getCurrentLevel(juelId)
    if (currentLevel >= 0) {
      const persona = STATE.config.persona.main
      const text = JUEL_DEFINITIONS[juelId].levels[currentLevel].imprint[persona]
      lines.push(text)
    }
  }
  return lines.join(' / ')
}
```

**任务 3.4 · 改造 `index.js` 的 prompt 生成**
```
[Day X HH:00·阶段]
动作:名称
[印痕] <各珠最高级印痕,用 / 分隔>
[叙事] 模式提示...
```

### 6.6.3 验证方式
**控制台作弊**:
```javascript
InPalmEngine.STATE.session.palam.submission_palam = 55
InPalmEngine.endSession()  // 应该获得 1 颗服从珠

InPalmEngine.STATE.char.juels.obedience = 60
InPalmEngine.endSession()  // 应该晋升到铜级,弹出解锁信息

InPalmEngine.executeAction('train_sit')
// 查看发给 AI 的 prompt,应包含 [印痕] 服从珠·铜级 文本
```

### 6.6.4 风险:🟡 中
印痕注入可能让 prompt 变长或格式错误。

### 6.6.5 回归测试清单
- [ ] 会话结束能产生珠
- [ ] 珠达到阈值能晋升等级
- [ ] 扭曲珠晋升**不弹通知**(悄悄出现)
- [ ] 其他 5 珠晋升**有返回信息**
- [ ] prompt 里出现印痕行
- [ ] 印痕根据主模板选择正确的文本
- [ ] 无珠解锁时,prompt 里无印痕行

---

## 6.7 阶段 4 · 人格模板系统

### 6.7.1 目标
主模板 + tag 修正 Source→Palam 转化系数。

### 6.7.2 具体任务

**任务 4.1 · 改造开场菜单**
在 opening_menu.html 新增第 9 步(按 §5.2 设计)。

**任务 4.2 · STATE.config.persona 存储**
把玩家的选择存进 `STATE.config.persona = { main, tags, custom }`。

**任务 4.3 · 改造 `convertSourceToPalam`**
加入人格系数:
```javascript
function convertSourceToPalam(source, value, palam) {
  const mainCoef = PERSONA_TEMPLATES[STATE.config.persona.main]
                     .conversion[source]?.[palam] || 0

  let tagDelta = 0
  for (const tagRef of STATE.config.persona.tags) {
    const tagId = typeof tagRef === 'string' ? tagRef : tagRef.id
    const tagDef = TENDENCY_TAGS[tagId]

    if (tagDef.conditional && !isTagActive(tagRef, currentAction)) continue

    const delta = tagDef.conversionDelta[source]?.[palam] || 0
    tagDelta += delta
  }

  const finalCoef = Math.max(0, mainCoef + tagDelta * 0.3)
  const stageCoef = getStageMultiplier(palam)

  return value * finalCoef * stageCoef
}
```

**任务 4.4 · 实现条件型 tag 检查**
处理 `phobic_trauma`、`intellectual_arrogance` 等条件型 tag。

**任务 4.5 · 印痕 tag 附加**
在 buildImprintLine 中拼接 tag 修饰语。

### 6.7.3 验证方式
开新局,分别测:
1. resistant 无 tag:intimacy source 应产生大量 resistance(早期)
2. devoted 无 tag:同样的 intimacy 应产生 distortion 而几乎无 resistance
3. resistant + strategic:对比无 tag,humiliation 的 resistance 应更高

### 6.7.4 风险:🟡 中
系数表数据多,容易填错。

### 6.7.5 回归测试清单
- [ ] 开场菜单第 9 步能选主模板
- [ ] 主模板切换能自动禁用冲突 tag
- [ ] phobic_trauma 能配置触发源
- [ ] 5 主模板分别测试,同一动作产生的 palam 差异明显
- [ ] 印痕行里包含 tag 附加片段

---

## 6.8 阶段 5 · 刻印系统

### 6.8.1 目标
刻印触发、修正器生效、prompt 注入。

### 6.8.2 具体任务

**任务 5.1 · STATE.char.imprints 存储**
**任务 5.2 · 新建 `src/core/imprints.js`**
**任务 5.3 · 集成到引擎主循环**(在 4 个时机检查刻印)
**任务 5.4 · 修正器应用**(在 convertSourceToPalam 末尾乘以刻印系数)
**任务 5.5 · prompt 注入刻印行**(在印痕行之前)

### 6.8.3 验证方式
**控制台作弊**:
```javascript
InPalmEngine.STATE.session.palam.resistance = 155
InPalmEngine.checkImprints('post_action')
InPalmEngine.STATE.char.imprints.active  // 应含 rebound

InPalmEngine.executeAction('train_sit')
// 查看 session.palam.submission_palam 增量,应只有正常的一半
```

### 6.8.4 风险:🟡 中
刻印叠加可能让系数计算失控。

### 6.8.5 回归测试清单
- [ ] 9 种刻印都能单独触发
- [ ] 多个刻印同时存在时,修正器累乘
- [ ] 刻印修正叠加在人格系数之后
- [ ] prompt 里刻印行在印痕行之前
- [ ] 刻印永久存在

---

## 6.9 阶段 6 · UI 重构一期

### 6.9.1 目标
抽屉的**基础结构改造**——数值区简化 + 会话面板 + 人格查看。**本阶段不做珠谱和结算弹窗**。

### 6.9.2 具体任务

**任务 6.1 · 数值区改造**
- 移除 arousal/shame/trained/distortion 显示
- 按 §5.4 的新分组布局
- 等级颜色 + 变化动画

**任务 6.2 · 会话面板**
- 按 §5.5 的设计实现
- 仅 `session.active === true` 时显示
- 扭曲 palam 显示 `●●` 而非数值
- "结束本次调教"按钮含确认弹窗

**任务 6.3 · 人格查看**
- 底栏加"人格"按钮
- 点击弹窗(按 §5.10)

**任务 6.4 · noir 主题适配**
所有新元素的 noir 主题样式完成。ornate 和 raw 先占位。

### 6.9.3 验证方式
- 视觉检查抽屉布局
- 触发会话 → 面板应出现
- 结束会话 → 面板应消失
- 点击人格按钮 → 弹窗显示正确配置

### 6.9.4 风险:🟢 低
UI 改造不影响引擎逻辑,出 bug 也不会破坏数据。

### 6.9.5 回归测试清单
- [ ] noir 主题下视觉正常
- [ ] 数值区无 4 项 palam 化数值
- [ ] 会话面板显示/隐藏逻辑正确
- [ ] 扭曲 palam 不显示数值
- [ ] 数值变化有动画

---

## 6.10 阶段 7 · UI 重构二期

### 6.10.1 目标
**珠谱 + 刻印警示条 + 会话结算弹窗**——三个最有仪式感的元素。

### 6.10.2 具体任务

**任务 7.1 · 珠谱折叠区**(按 §5.8)
**任务 7.2 · 单珠详情弹窗**(扭曲珠特殊提示)
**任务 7.3 · 刻印警示条**(按 §5.7)
**任务 7.4 · 首次烙印全屏提示**(2s 渐入,打字机效果)
**任务 7.5 · 会话结算弹窗**(最复杂)

### 6.10.3 验证方式
- 玩一局完整游戏
- 触发会话 → 结束 → 结算弹窗流程顺畅
- 触发刻印 → 全屏提示出现
- 珠谱里所有珠状态正确

### 6.10.4 风险:🟡 中
动画和弹窗的时序容易出 bug。

### 6.10.5 回归测试清单
- [ ] 珠谱展开/折叠正常
- [ ] 单珠详情弹窗内容完整
- [ ] 扭曲珠详情含"未告知"提示
- [ ] 刻印警示条在无刻印时不显示
- [ ] 首次刻印全屏提示只出现一次
- [ ] 后续刻印只在警示条新增
- [ ] 结算弹窗不能 ESC 跳过
- [ ] 多级跳跃能依次显示
- [ ] 刻印优先于等级解锁展示

---

## 6.11 阶段 8 · 动作库扩展

### 6.11.1 目标
动作库从 **35 个** + **5 个已迁移** 扩展到 **76 个**。

### 6.11.2 具体任务

**任务 8.1 · 迁移现有 30 个动作**
把现有 actions.js 和 training.js 里 30 个动作从 effects 改为 sources。

**任务 8.2 · 新增动作**

| 类别 | 当前 | 目标 | 新增数 |
|---|---|---|---|
| environment | 5 | 8 | 3 |
| deliver | 4 | 6 | 2 |
| contact | 4 | 6 | 2 |
| trigger | 4 | 6 | 2 |
| touch | 5 | 8 | 3 |
| training | 3 | 10 | 7 |
| bondage | 2 | 6 | 4 |
| stimulation | 4 | 8 | 4 |
| humiliation | 0 | 6 | **6(新)** |
| care | 1 | 4 | 3 |
| medical | 1 | 4 | 3 |
| state_change | 2 | 4 | 2 |
| **合计** | 35 | 76 | **41 个新** |

**任务 8.3 · 动作 flag 标记**
给相应动作打 `crude`, `status_strip`, `orality`, `rival_reference`, `exposure_intensive` 等 flag。

**任务 8.4 · console.html 按钮更新**
按 §5.9 的 tab 分组(13 个 tab)。

**任务 8.5 · 解锁机制**
按 §2.4 实现:默认/阶段/深度/R18 分别解锁。

### 6.11.3 验证方式
逐类别测试每个新动作:source 产出、palam 转化、flag 激活。

### 6.11.4 风险:🟡 中
41 个新动作,容易填错。

### 6.11.5 回归测试清单
- [ ] 76 个动作全部可点击
- [ ] 每个动作的 source 产出与设计一致
- [ ] flag 标记正确激活条件型 tag
- [ ] 动作解锁逻辑正确
- [ ] 新增的"羞辱"类别完整可用

---

## 6.12 代码文件改动汇总

### 6.12.1 新增文件
```
src/data/sources.js         阶段 1
src/data/palam.js           阶段 1
src/data/juels.js           阶段 1(含 120 条印痕)
src/data/imprints.js        阶段 1
src/data/personas.js        阶段 1
src/core/session.js         阶段 2
src/core/juels.js           阶段 3
src/core/imprints.js        阶段 5
```

### 6.12.2 大改文件
```
src/01_state.js             阶段 2(STATE 结构)
src/core/effects.js         阶段 2(核心转化逻辑)
src/core/context.js         阶段 3-5(prompt 注入)
src/data/actions.js         阶段 8(30 个迁移 + 新增)
src/data/training.js        阶段 8(30 个迁移 + 新增)
templates/console.html      阶段 6-8(UI 大改)
index.js                    阶段 3(prompt 改造)
```

### 6.12.3 小改文件
```
src/00_constants.js         微调(新增常量)
manifest.json               每阶段改版本号
build.js                    阶段 1(加新文件到序列)
opening_menu.html           阶段 4(第 9 步)
style.css                   阶段 6-7(新样式)
```

### 6.12.4 不动的文件
```
src/data/items.js           保留
src/data/toys.js            保留
src/data/scenes.js          保留
src/data/risks.js           保留
src/data/dialogue.js        保留
src/data/custom_templates.js 保留
lorebook/core_lorebook.json 保留
src/core/time.js / conditions.js / inventory.js / risks.js / milestones.js
src/systems/toys.js / dialogue.js
```

---

## 6.13 每阶段的交付产物

| 阶段 | 版本号 | 玩家能感受到什么 |
|---|---|---|
| 1 | v0.6.0-alpha.1.dev1 | 无感(只是数据铺设) |
| 2 | v0.6.0-alpha.1.dev2 | 部分动作"失灵"(旧数值不动了,新 palam 只在 console 里) |
| 3 | v0.6.0-alpha.1 | Prompt 里出现 [印痕] 行 |
| 4 | v0.6.0-alpha.2 | 能选人格模板 |
| 5 | v0.6.0-alpha.3 | 触发条件下 prompt 里出现 [刻印] 行 |
| 6 | v0.6.0-beta.1 | 数值区重构 + 会话面板出现 |
| 7 | v0.6.0-beta.2 | 珠谱 + 刻印条 + 结算弹窗全部到位 |
| 8 | v0.6.0-rc.1 | 76 个动作完整可用 |
| — | **v0.6.0** | ornate/raw 主题优化完成 |

---

## 6.14 两个关键"灰盒期"

**灰盒期 1:阶段 2 结束 ~ 阶段 6 开始**
- 引擎已改但 UI 没变
- 旧 4 项数值在界面消失,新数据只在 console.log 看得到
- **应对**:v0.6.0-alpha 系列对外不发布,只本地测试

**灰盒期 2:阶段 6 结束 ~ 阶段 7 开始**
- 数值区新了,但还看不到珠谱和刻印
- **应对**:这段时间比较短

---

## 6.15 调试接口

为了方便测试,建议加一个调试接口:
```javascript
window.InPalmDebug = {
  givePalam: (palam, value) => { STATE.session.palam[palam] = value },
  giveJuel: (juelId, value) => {
    STATE.char.juels[juelId] = value
    checkLevelUp(juelId)
  },
  setStage: (stageId) => { STATE.time.stage = stageId },
  setDay: (day) => { STATE.time.day = day },
  forceImprint: (imprintId) => { applyImprint(imprintId, { forced: true }) },
  dump: () => { console.log(JSON.stringify(STATE, null, 2)) }
}
```

仅开发期使用,可保留到正式版(藏在 console 里不影响玩家)。

---

## 6.16 时间分配建议

假设每天能投入 2 小时:

| 周 | 预计完成 |
|---|---|
| 第 1 周 | 阶段 1 + 阶段 2 |
| 第 2 周 | 阶段 3 + 阶段 4 |
| 第 3 周 | 阶段 5 + 阶段 6 开头 |
| 第 4 周 | 阶段 6 完 + 阶段 7 |
| 第 5 周 | 阶段 8 |
| 第 6 周 | ornate/raw 主题优化 + v0.6.0 发布 |

**总时长**:约 5-6 周(每天 2 小时)。

### 心态建议
- **不要求一次性走完全流程**
- **每完成一个阶段稳定后再走下一个**
- **保持每天都能回到最近一个稳定版本**
- **UI 阶段可以让步**,做不出来的占位先走

---

## 6.17 风险控制表

| 阶段 | 最大风险 | 缓解措施 |
|---|---|---|
| 1 | 🟢 低 | - |
| 2 | 🔴 核心流程 bug | 5 个试点动作,不一次改全 |
| 3 | 🟡 印痕注入格式 | 先 console.log,再接 prompt |
| 4 | 🟡 系数表填错 | 每模板单独测试 |
| 5 | 🟡 刻印叠加失控 | 每种刻印单独触发测试 |
| 6 | 🟢 视觉问题 | 分主题独立开发 |
| 7 | 🟡 动画时序 bug | 一个弹窗一个弹窗做 |
| 8 | 🟡 动作数据填错 | 批量迁移前先做迁移脚本 |

---

## 6.18 每阶段开工前的准备

在每个新对话窗口开始之前,准备以下材料:

1. 当前版本号(manifest.json 里的 version)
2. 已完成的阶段(1-N 已完成)
3. 当前进行中的阶段(正在做阶段 N+1)
4. 需要新窗口 Claude 做什么(具体任务)
5. 当前仓库文件结构(如果有大改动)
6. 最近一次 commit 的 message 和 hash

**这些信息可以写成一个"阶段 N 交接卡"**,和 `PROJECT_HANDOFF.md` 一起放在项目根目录。

---

# 📋 文档六完结 · 整个设计文档系列完成

---

## 📚 最终文档清单

你现在有 **6 份完整的设计文档**:

| 文档 | 文件 | 字数 | 核心内容 |
|---|---|---|---|
| Part 1 | DESIGN_PART1_architecture_actions.md | ~26k | 架构总览 + 动作库 |
| Part 1.5 | DESIGN_PART1.5_personas.md | ~22k | 人格模板 |
| Part 2 | DESIGN_PART2_juels_imprints.md | ~42k | 珠谱 + 120 条印痕 |
| Part 3-A | DESIGN_PART3A_imprints.md | ~18k | 刻印系统 |
| Part 3-B | DESIGN_PART3B_ui.md | ~31k | UI 改造 |
| Part 3-C | DESIGN_PART3C_roadmap.md | ~13k | 代码路线图 |

**总字符约 15 万字符**。
