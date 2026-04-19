# 掌心的它 · 调教系统设计文档 Part 1/3

> **版本**：Design v1.0
> **范围**：文档一(核心架构) + 文档二(动作库)
> **目标版本**:掌心 v0.6.0(重构版)
> **设计原则**:借鉴 era 系列 Source/Palam/珠 三层架构,完全替换现有数值逻辑

---

## 📖 阅读说明

**这是一份设计规范**,不是代码。代码改造在文档六规划。

**三层传导的直观示意**:

```
玩家点"训练坐姿"
       │
       ▼
┌─────────────────────────────┐
│ SOURCE(本次产出)             │
│ 屈従+3  羞耻+2  疲劳+4  不快+1│  ← 动作库里写死的"原始输出"
└──────────────┬──────────────┘
               │ 按 char 状态/素质/阶段修正
               ▼
┌─────────────────────────────┐
│ PALAM(会话累积)              │
│ 服从 45  羞耻 67  反感 23    │  ← 进入"本次调教会话"的水池
└──────────────┬──────────────┘
               │ 会话结束时按阈值结算
               ▼
┌─────────────────────────────┐
│ 珠(永久勋章)                 │
│ 服从珠·铜级 ✓已收藏          │  ← 永久记录,影响 AI 感知
└──────────────┬──────────────┘
               │ 印痕注入
               ▼
┌─────────────────────────────┐
│ AI PROMPT                   │
│ [印痕] char 对 user 已形成... │  ← 每次 prompt 都带着印痕
└─────────────────────────────┘
```

---

# 文档一 · 核心架构规范

## 1.1 四层数据模型总览

| 层级 | 生命周期 | 玩家可见? | 作用 |
|---|---|---|---|
| **Source(来源)** | 本次动作一次性 | 会话面板短暂显示 | 动作的原始产出 |
| **Palam(参数)** | 本次会话内累积 | 会话面板实时显示 | 进度累积 / 印象累积 |
| **珠(永久勋章)** | 永久 | 抽屉珠谱页显示 | 收藏成就 / AI 印痕来源 |
| **生理值 / ABL** | 永久,缓慢变化 | 抽屉数值区显示 | 体力、理智、健康等基础状态 |

**关键区分**:
- Source 是**瞬时**,本次动作产生,用完即毁
- Palam 是**会话累积**,只在当前调教会话内有效,结算后清零
- 珠是**永久**,一旦获得就存在,不会丢失
- 生理值是**永久且动态**,会随时间/事件上升或下降

---

## 1.2 Source 层定义(~14 种)

Source 是动作的**原始输出**,字面意思就是"这个动作产生了什么刺激来源"。

### 1.2.1 分组总表

| 分组 | Source ID | 中文名 | 说明 |
|---|---|---|---|
| **性快感组** | `pleasure_c` | 快感·C | 阴蒂/敏感部位刺激 |
| | `pleasure_v` | 快感·V | 深层刺激 |
| | `pleasure_a` | 快感·A | 后部刺激 |
| | `pleasure_b` | 快感·B | 胸部刺激 |
| **心理冲击组** | `shame` | 羞耻 | 被暴露、被羞辱 |
| | `terror` | 恐怖 | 精神压迫、未知感 |
| | `humiliation` | 屈辱 | 尊严被践踏 |
| | `exposure` | 暴露 | 裸露、被看、被展示 |
| **关系侵蚀组** | `intimacy` | 亲密 | 温柔接触产生 |
| | `dependence` | 依存 | 照料、供给产生 |
| | `submission` | 屈従 | 强制性的服从压力 |
| **抵抗组** | `disgust` | 反感 | 不适与反感 |
| | `fatigue` | 疲劳 | 体力/精神消耗 |
| | `pain` | 痛感 | 肉体疼痛 |

### 1.2.2 Source 的技术实现

```javascript
// 每个动作定义自己会产生哪些 source(原始值)
// 最终进入会话的 palam 会被当前 char 状态修正
{
  id: 'train_sit',
  name: '训练基本姿势',
  sources: {
    submission: 3,
    shame: 2,
    fatigue: 4,
    disgust: 1
  },
  // ...
}
```

### 1.2.3 Source → Palam 转化表

**核心机制**:一个 Source 可以贡献多个 Palam(按比例)。这让一个动作产生"**心理涟漪**"而不是单点影响。

| Source | 贡献的 Palam | 比例 |
|---|---|---|
| pleasure_c | 快感参数(全局) | × 1.0 |
| | 欲情 | × 0.7 |
| | 抑郁 | × 0.2 |
| pleasure_v / a | 快感参数 | × 1.0 |
| | 欲情 | × 0.8 |
| | 扭曲 | × 0.3 |
| pleasure_b | 快感参数 | × 0.8 |
| | 羞耻 | × 0.5 |
| shame | 羞耻 | × 1.0 |
| | 反感 | × 0.3 |
| | 欲情 | × 0.2(震惊期 0,转化期 0.4) |
| terror | 反感 | × 0.8 |
| | 抑郁 | × 0.6 |
| | 扭曲 | × 0.4 |
| humiliation | 羞耻 | × 0.8 |
| | 屈従 | × 0.5 |
| | 反感 | × 0.4 |
| exposure | 羞耻 | × 0.7 |
| | 欲情 | × 0.3 |
| intimacy | 扭曲 | × 0.6 |
| | 抑郁 | × 0.3 |
| | 反感 | × 0.4(震惊期 1.0,转化期 0.1) |
| dependence | 扭曲 | × 0.8 |
| | 屈従 | × 0.4 |
| submission | 屈従 | × 1.0 |
| | 反感 | × 0.5(随阶段递减) |
| | 抑郁 | × 0.3 |
| disgust | 反感 | × 1.0 |
| fatigue | (仅消耗 stamina,不产生 palam) | — |
| pain | 反感 | × 0.7 |
| | 扭曲 | × 0.3 |

**注意**:`intimacy` 和 `submission` 的反感系数**随阶段变化**——这是 era 的精髓:早期温柔反而让 char 反感,晚期才真正"建立关系"。

---

## 1.3 Palam 层定义(8 种)

Palam 是**单次调教会话**内的参数水池。会话结束时按阈值**转化为珠**,然后清零。

### 1.3.1 Palam 总表

| Palam ID | 中文名 | 显示? | 产生珠 | 说明 |
|---|---|---|---|---|
| `pleasure` | 快感参数 | ✅ | 欲望珠 | 本次身体快感累积 |
| `desire` | 欲情 | ✅ | 欲望珠 | 本次性唤起程度 |
| `lewdness` | 淫欲 | ✅ | 欲望珠(高阈值) | 深度性依赖 |
| `shame_palam` | 羞耻 | ✅ | 羞耻珠 | 本次羞耻感 |
| `submission_palam` | 屈従 | ✅ | 服从珠 | 本次服从压力 |
| `depression` | 抑郁 | ✅ | 空虚珠 | 本次精神侵蚀 |
| `distortion_palam` | 扭曲 | ❌**隐藏** | 扭曲珠 | 关系异化程度 |
| `resistance` | 反感 | ✅ | 反抗珠 | 本次抵抗意识 |

### 1.3.2 `distortion_palam` 隐藏的原因

这个参数代表"**关系正在向扭曲依赖方向演变**"——一旦让玩家直接看见它,玩家会本能地规避(因为"扭曲"听起来是负面的)。但它恰恰是你作品**最核心的心理推演目标**。让它隐形,玩家只有从 char 的反应里**间接感知**,才能创造"原来我已经把 ta 变成这样了"的震撼时刻。

会话结束时,玩家能看到其他参数转化出的珠,但**扭曲珠是"悄悄出现"的**。

### 1.3.3 Palam → 珠 转化阈值

**统一规则**:每 100 Palam = 1 颗珠(临时颗粒),但**珠的"晋级"是按累积总量计算**(见文档三)。

```
会话结束时:
  每种 palam 有一个阈值(默认 100)
  超过阈值 → 获得 1 颗"临时珠"
  临时珠累加到永久总量
  根据永久总量决定是否晋级到下一等级
```

例:第一次调教会话结束,获得 `屈従 palam = 120`:
- 先转化出 1 颗"临时服从珠"(消耗 100 palam,剩 20 也消耗,下次不会继承)
- 永久服从珠总量 +1(之前 0 → 现在 1)
- 判定等级:1 颗未达铜级阈值(50),不晋级

---

## 1.4 调教会话(Session)定义

"调教会话"是新架构最关键的概念——**它是 Palam 的容器**。

### 1.4.1 会话的定义

一段**连续时间内的调教行为集合**。符合以下任一条件,视为会话结束:

| 触发条件 | 类型 | 说明 |
|---|---|---|
| char 进入 `asleep` 状态 | 自动 | 睡眠打断 |
| char 意识状态变为 `unconscious` | 自动 | 昏迷打断 |
| 玩家离开密室(外出场景) | 自动 | 空间切换 |
| 距上次调教动作超过 4 小时(游戏时间) | 自动 | 冷却超时 |
| 玩家点击"结束本次调教"按钮 | 手动 | 显式结束 |
| 开启新对话(切换到 dialogue 模式) | 自动 | 转入非调教互动 |

### 1.4.2 会话数据结构

```javascript
STATE.session = {
  active: false,              // 当前是否有活跃会话
  startTime: null,            // 开始时的 { day, hour }
  actionCount: 0,             // 本次会话动作数
  palam: {                    // 本次累积的 palam
    pleasure: 0,
    desire: 0,
    lewdness: 0,
    shame_palam: 0,
    submission_palam: 0,
    depression: 0,
    distortion_palam: 0,
    resistance: 0
  },
  lastActionTime: null,       // 上次动作时间(用于判定冷却超时)
  sourcesThisAction: null     // 最近一次动作产生的 source(用于 UI 显示)
}
```

### 1.4.3 会话的生命周期

```
[非会话状态]
     │
     │ 玩家触发第一个调教类动作
     ▼
[会话开始] session.active = true
     │
     │ 动作 → 产生 source → 转化 palam → 累积到 session.palam
     │ 动作 → 产生 source → 转化 palam → 累积到 session.palam
     │ 动作 → ...
     │
     │ 满足任一结束条件
     ▼
[会话结算]
  1. 按阈值计算本次获得的临时珠
  2. 累加到永久珠总量
  3. 判定等级晋升
  4. 弹窗展示结算结果
  5. 清空 session.palam
  6. 记录一条会话日志
     │
     ▼
[会话结束] session.active = false
```

### 1.4.4 哪些动作会触发/延续会话?

**触发**(启动会话):
- `category === 'touch'` 触摸类
- `category === 'stimulation'` 刺激类
- `category === 'bondage'` 束缚类
- `category === 'training'` 训练类
- `category === 'humiliation'`(新增) 羞辱类

**不触发**(不进入会话):
- `category === 'environment'` 环境控制
- `category === 'deliver'` 递送
- `category === 'care'` 护理(梳头等)
- `category === 'state_change'` 意识操作(可能结束会话)
- `category === 'medical'` 医疗
- `category === 'trigger'` 特殊剧情触发

---

## 1.5 ABL / 生理值层(保留大部分旧逻辑)

这一层几乎完全保留你现有的 11 维数值中的**基础生理和长期心理**部分。

### 1.5.1 保留的数值(旧 → 新重命名)

| 旧字段 | 新字段 | 新定位 | 说明 |
|---|---|---|---|
| `sanity` | `sanity` | ABL | 理智(不变) |
| `mood` | `mood` | ABL | 心情(不变) |
| `sincerity` | `sincerity` | ABL | 真心度(不变) |
| `compliance` | `compliance` | ABL | 友好度(不变) |
| `stamina` | `stamina` | 生理 | 体力(不变) |
| `hunger` | `hunger` | 生理 | 饥饿(不变) |
| `sleep` | `sleep` | 生理 | 睡眠(不变) |
| `health` | `health` | 生理 | 健康(不变) |

### 1.5.2 废弃的数值(迁移到新架构)

| 旧字段 | 去向 |
|---|---|
| `arousal` | **废弃**。被 `pleasure palam` + `desire palam` 取代(会话级) |
| `shame` | **废弃**。被 `shame palam`(会话级) + 羞耻珠(永久) 取代 |
| `trained` | **废弃**。被 `submission palam`(会话级) + 服从珠(永久) 取代 |
| `distortion`(在 state 里) | **废弃**。被 `distortion_palam`(会话级) + 扭曲珠(永久) 取代 |
| `riskLevel` | **保留**(不在本次重构范围) |

### 1.5.3 ABL 的变化方式

ABL 在新架构下**不再由单个动作直接修改**,而是通过**两种路径**缓慢变化:

**路径 1:生理值自动流转(不变)**
- 饥饿随时间 +
- 睡眠随时间 -
- 健康受饥饿/伤害影响
- (这部分沿用现有逻辑)

**路径 2:珠解锁时对 ABL 产生长期影响**
```
解锁"服从珠·银级" → compliance 上限 +10, 初始值 +5
解锁"扭曲珠·铜级" → sincerity +8
解锁"空虚珠·银级" → sanity 上限 -15
(具体数字在文档三规定)
```

这样设计的好处:**ABL 变化变成"里程碑事件"**,而不是每次动作的 +1 -1 噪音。玩家看到 compliance 跳涨时,是因为 char 刚跨过一个心理门槛,而不是因为 "哦又点了几次"。

---

## 1.6 阶段乘数(保留现有逻辑)

你现有的 `STAGE_MULTIPLIERS` 完全保留,但**作用对象变了**:

**旧逻辑**:乘数作用于动作对 ABL 的直接影响
**新逻辑**:乘数作用于 **Source → Palam 转化**阶段

```javascript
// 新的转化公式:
palam_gained = source_value × conversion_ratio × stage_multiplier × repeat_decay
```

具体到各 Palam 使用哪个乘数组:

| Palam | 使用的乘数组 |
|---|---|
| pleasure / desire / lewdness | `physical` |
| shame_palam | `physical` |
| submission_palam | `training` |
| depression | `negative` |
| distortion_palam | `distortion` |
| resistance | `negative`(但反向:震惊期高) |

---

## 1.7 重复衰减(保留现有逻辑)

`REPEAT_DECAY` 完全保留,**作用对象**同样从 ABL 变化改为 Source → Palam 转化。

同一动作连续重复超过阈值(3 次),后续触发的 Source 会按衰减系数递减。

---

## 1.8 刻印(Imprint)系统预告

刻印是**负面永久 tag**,由过量 Palam 累积触发。详细规则在文档四。

预览:
- `反発刻印`:单次会话 resistance palam 超过 150 → 烙印,后续所有动作产生的 submission 减半,直到用特定方式清除
- `崩坏刻印`:累积 distortion 珠 3 颗 → 烙印,char 出现解离症状
- `麻木刻印`:空虚珠金级以上 → 烙印,char 对一般刺激无反应

这里先不展开。

---

# 文档二 · 动作库规范

## 2.1 动作的新数据结构

**旧结构**(直接改 ABL 数值):
```javascript
{
  id: 'train_sit',
  effects: { char: { trained: +5, shame: +12, compliance: +3 } }
}
```

**新结构**(产出 Source):
```javascript
{
  id: 'train_sit',
  name: '训练基本姿势',
  category: 'training',
  durationMinutes: 30,
  
  // 新:产生哪些 source(原始值)
  sources: {
    submission: 3,
    humiliation: 2,
    fatigue: 4,
    disgust: 1
  },
  
  // 新:生理直接消耗(不走 palam 通道)
  physicalCost: {
    stamina: -15
  },
  
  // 保留:前置条件
  requiresCondition: { consciousness: ['awake'] },
  requiresDepth: null,
  requiresToy: null,
  requiresItem: null,
  
  // 保留但简化:prompt(只描述客观,不预设反应)
  prompt: '玩家要求 {{char}} 以固定姿势坐/跪/站并保持不动,进行基础姿势训练。'
}
```

**关键变化**:
1. `effects.char.xxx` 全部删除,改为 `sources`
2. `physicalCost` 专门管理体力/饥饿/睡眠/健康这类生理损耗(因为它们不进 palam 通道)
3. `prompt` 不再写"描写身心消耗"这种指导语,只描述客观行为

---

## 2.2 九大动作分类(从现有 5 类扩展)

| 类别 | category | 是否启动会话? | 现有数量 | 目标数量 |
|---|---|---|---|---|
| 环境控制 | `environment` | ❌ | 5 | 8 |
| 递送 | `deliver` | ❌ | 4 | 6 |
| 接触/对话 | `contact` | ❌(进入 dialogue mode) | 4 | 6 |
| 特殊触发 | `trigger` | ❌ | 4 | 6 |
| **触碰** | `touch` | ✅ | 5 | 8 |
| **训练** | `training` | ✅ | 3 | 10 |
| **束缚** | `bondage` | ✅ | 2 | 6 |
| **刺激** | `stimulation` | ✅(R18) | 4 | 8 |
| **羞辱**(新增) | `humiliation` | ✅ | 0 | 6 |
| 护理 | `care` | ❌ | 1 | 4 |
| 医疗 | `medical` | ❌ | 1 | 4 |
| 状态操作 | `state_change` | ❌(可结束会话) | 2 | 4 |
| **合计** | | | **35** | **76** |

**新增的"羞辱"类**填补了你作品的一大空白——你的作品主题是"囚禁心理推演",但现有动作库**只有身体层面**,没有**纯心理羞辱**的动作。这是非常关键的缺失。

---

## 2.3 完整动作库设计

### 2.3.1 触碰类(touch · 8 个)

所有触碰类会**启动会话**。Source 以 `intimacy`(亲密) 为主,晚期会转化为扭曲珠。

| ID | 名称 | 时长 | 主要 Source | 深度 | 条件 |
|---|---|---|---|---|---|
| `touch_hair` | 抚摸头发 | 10m | intimacy 2 | psych | — |
| `touch_face` | 触摸脸庞 | 10m | intimacy 3, shame 1 | psych | — |
| `hold_hand` | 牵手 | 15m | intimacy 2, submission 1 | psych | — |
| `embrace` | 拥抱 | 20m | intimacy 4, dependence 2 | psych | awake/dazed |
| `wipe_tears` | 擦拭眼泪 | 5m | intimacy 3, dependence 3 | psych | — |
| `kiss_forehead` | 吻额头 | 5m | intimacy 4, exposure 1 | psych | — |
| `cheek_to_cheek` | 贴脸 | 15m | intimacy 3, shame 2 | psych | awake |
| `lap_pillow` | 膝枕 | 30m | intimacy 5, dependence 4 | psych | awake/dazed |

**设计意图**:触碰类主要产生扭曲(通过 intimacy),配合早期 `intimacy → 反感` 的高系数,真实反映"温柔 ≠ 亲近"的心理。

---

### 2.3.2 训练类(training · 10 个)

所有训练类会**启动会话**。主打 `submission`,辅以 `humiliation`。

| ID | 名称 | 时长 | 主要 Source | 深度 | 条件 |
|---|---|---|---|---|---|
| `train_sit` | 训练基本姿势 | 30m | submission 3, humiliation 2, fatigue 4 | psych | awake |
| `train_response` | 训练回应 | 20m | submission 4, humiliation 1 | psych | awake |
| `train_feeding` | 训练进食方式 | 30m | submission 5, humiliation 6, exposure 3 | body | awake |
| `train_walk_leash` | 牵引行走 | 30m | submission 4, humiliation 4 | body | awake, collared |
| `train_use_toilet` | 训练如厕方式 | 20m | submission 6, humiliation 8 | body | awake |
| `train_beg` | 训练乞求 | 15m | submission 5, humiliation 5, exposure 2 | body | awake |
| `train_dance` | 训练表演 | 40m | submission 3, humiliation 6, exposure 4 | body | awake |
| `train_clean_self` | 训练自我清洁(被观看) | 30m | submission 2, humiliation 5, exposure 6 | body | awake |
| `train_praise_user` | 训练赞美{{user}} | 10m | submission 4, humiliation 3, dependence 2 | psych | awake |
| `train_self_identify` | 训练自我称呼 | 10m | submission 6, humiliation 4, terror 2 | psych | awake |

**设计意图**:训练类是**服从珠的主力来源**。覆盖行为层(姿势)、生理层(进食/如厕)、表演层(跳舞)、认知层(自我称呼),构成完整的"驯化阶梯"。

---

### 2.3.3 束缚类(bondage · 6 个)

所有束缚类会**启动会话**。主打 `submission` + `terror`。

| ID | 名称 | 时长 | 主要 Source | 深度 | 条件 |
|---|---|---|---|---|---|
| `bind_wrists` | 束缚手腕 | 10m | submission 3, terror 1 | psych | 需玩具 |
| `bind_full` | 全身束缚 | 30m | submission 6, terror 3, exposure 2 | body | 需玩具 |
| `suspend_light` | 吊缚(轻) | 45m | submission 5, terror 4, humiliation 3 | body | 需玩具 |
| `collar_on` | 戴上项圈 | 5m | submission 4, humiliation 3 | psych | 需玩具 |
| `gag_on` | 戴上口塞 | 5m | terror 3, submission 2, humiliation 2 | body | 需玩具 |
| `blindfold_on` | 戴上眼罩 | 5m | terror 4, submission 1 | psych | 需玩具 |

**设计意图**:束缚类的核心是**剥夺 char 的控制权**,通过 terror 制造恐惧扭曲。后三项是"状态性束缚",会改变 charStatus(gagged/blindfolded/collared)。

---

### 2.3.4 刺激类(stimulation · 8 个)

R18 档位动作。主打 `pleasure_*`,辅以 `shame`。

| ID | 名称 | 时长 | 主要 Source | 深度 |
|---|---|---|---|---|
| `tease_light` | 轻度挑逗 | 20m | pleasure_c 2, pleasure_b 1, shame 2 | body |
| `tease_hard` | 强挑逗 | 30m | pleasure_c 4, desire 3, shame 3 | body |
| `stimulate_direct` | 直接刺激 | 30m | pleasure_c 5, pleasure_v 3, shame 2 | r18 |
| `stimulate_deep` | 深度刺激 | 45m | pleasure_v 6, pleasure_a 3, shame 3 | r18 |
| `use_toy_vibrator` | 使用震动道具 | 25m | pleasure_c 5, shame 2 | r18 |
| `use_toy_restraint_sexual` | 使用拘束道具(性向) | 30m | pleasure_v 4, submission 3, shame 3 | r18 |
| `edge` | 边缘控制 | 45m | pleasure_c 6, desire 5, humiliation 3, fatigue 5 | r18 |
| `force_climax` | 强制达成 | 30m | pleasure_c 8, lewdness 4, shame 5 | r18 |

**设计意图**:这是"欲望珠"和"羞耻珠"的主力来源。`edge` 和 `force_climax` 是**高阶动作**,单次产出极高但对 stamina 消耗大。

---

### 2.3.5 羞辱类(humiliation · 6 个)· **全新**

不涉及直接身体接触,纯粹的心理压迫。非 R18 也能玩,是 psych 档位的主力。

| ID | 名称 | 时长 | 主要 Source | 深度 |
|---|---|---|---|---|
| `verbal_degrade` | 言语贬低 | 10m | humiliation 4, terror 2, resistance 3 | psych |
| `force_self_describe` | 强迫自我描述 | 15m | humiliation 6, shame 3, submission 2 | psych |
| `compare_to_others` | 与他人比较 | 10m | humiliation 5, depression 3 | psych |
| `display_weakness` | 展示弱点 | 20m | humiliation 4, exposure 5, shame 4 | psych |
| `mock_former_life` | 嘲笑过往生活 | 15m | humiliation 5, depression 4, dependence 2 | psych |
| `praise_rival` | 赞美对手/旧人 | 15m | humiliation 3, depression 5, resistance 4 | psych |

**设计意图**:填补"纯心理推演"空白。这些动作完全不需要 body/r18 档位,是**psych 档位玩家**的主要互动。非常符合"尊重 char 原始人格,只推演极端情境"的作品原则——**羞辱是心理层面的,不一定要脱衣服**。

---

### 2.3.6 环境控制类(environment · 8 个)

不启动会话,不产生 palam,只改生理值。

| ID | 名称 | 时长 | 生理影响 | 说明 |
|---|---|---|---|---|
| `cut_lights` | 切断照明 | 5m | sanity -3, mood -5, sleep -10 | 现有 |
| `restore_lights` | 恢复照明 | 5m | mood +3 | 现有 |
| `lower_temp` | 降低室温 | 30m | stamina -10, health -5 | 现有 |
| `raise_temp` | 升高室温 | 30m | stamina -5, sleep -8 | 新 |
| `play_audio` | 播放音频 | 60m | sanity -8, mood -5 | 现有 |
| `cut_water` | 切断供水 | 240m | health -8, stamina -15 | 现有 |
| `flood_light` | 强光照射 | 60m | sanity -10, sleep -20 | 新 |
| `sound_deprive` | 完全隔音 | 120m | sanity -15, mood -8 | 新 |

---

### 2.3.7 递送类(deliver · 6 个)

不启动会话。

| ID | 名称 | 生理影响 | 说明 |
|---|---|---|---|
| `deliver_food_basic` | 送简单食物 | hunger -40 | 现有 |
| `deliver_food_premium` | 送精致食物 | hunger -50, mood +5 | 现有 |
| `deliver_clothing` | 送衣物 | — | 现有 |
| `take_away_food` | 收走食物 | hunger +10, mood -8 | 现有 |
| `deliver_water_only` | 只送水 | health +3, hunger -5 | 新 |
| `deliver_personal_item` | 送私人物品 | mood +8, sanity +3 | 新 |

---

### 2.3.8 接触/对话类(contact · 6 个)

不启动调教会话(但进入 dialogue mode)。

| ID | 名称 | 说明 |
|---|---|---|
| `broadcast_message` | 广播讯息 | 现有 |
| `enter_room` | 进入密室 | 现有(会话终止条件) |
| `letter_slot` | 递纸条 | 现有 |
| `silence_day` | 沉默一整天 | 现有 |
| `intercom_call` | 对讲机通话 | 新 |
| `leave_note_with_food` | 食物附字条 | 新 |

---

### 2.3.9 特殊触发类(trigger · 6 个)

| ID | 名称 | 说明 |
|---|---|---|
| `fake_rescue_signal` | 伪造救援信号 | 现有 |
| `reveal_truth` | 揭示真相 | 现有 |
| `wait_24h` | 24 小时无干预 | 现有 |
| `show_memento` | 展示旧物 | 现有 |
| `fake_visitor` | 伪造访客声音 | 新 |
| `reveal_user_face` | 首次露脸 | 新(一局仅一次) |

---

### 2.3.10 护理类(care · 4 个)

不启动会话,正面生理值修正。

| ID | 名称 | 主要 Source | 说明 |
|---|---|---|---|
| `brush_hair` | 梳头 | intimacy 2, dependence 1 | 现有 |
| `bathe_assist` | 协助沐浴 | intimacy 3, exposure 4, dependence 3 | 新 |
| `treat_wound` | 处理伤口 | dependence 5, intimacy 2 | 新 |
| `feed_by_hand` | 亲手喂食 | dependence 6, humiliation 2 | 新 |

**注意**:care 类动作**会产生 source 但不启动会话**——这是有意设计的边界。梳头、喂食、处理伤口这些"照料"动作,应该归类为日常而非调教,但它们对**扭曲珠**的贡献不可忽略。

> ⚠️ 设计决策:care 类的 source 会在**最近的一次会话内**被追加累积。如果没有活跃会话,这些 source 进入一个"隐形缓冲池",**在下次会话开始时合并**。这样避免"我只做日常护理就永远不结算"的 bug。

---

### 2.3.11 医疗类(medical · 4 个)

| ID | 名称 | 改变状态 |
|---|---|---|
| `drug_sedative` | 给予镇静剂 | consciousness → drugged |
| `give_medicine` | 给予药物(治疗) | health +15 |
| `iv_drip` | 静脉输液(强制营养) | hunger -60, health +5 |
| `drug_aphrodisiac` | 给予催情剂(R18) | 刺激动作产出 ×1.5 |

---

### 2.3.12 状态操作类(state_change · 4 个)

| ID | 名称 | 改变状态 |
|---|---|---|
| `wake_up` | 唤醒 | → awake |
| `put_to_sleep` | 让睡眠 | → asleep(会话终止) |
| `strip` | 脱除衣物 | clothed 变化 |
| `dress` | 穿戴衣物 | clothed 变化 |

---

## 2.4 动作的解锁机制

**重要原则**:不是所有 76 个动作一开始都可用。解锁条件:

| 解锁层级 | 触发 |
|---|---|
| **默认可用** | 环境/递送/接触/特殊触发(28 个)+ 部分基础触碰/训练/束缚(约 15 个) |
| **阶段解锁** | 进入适应期(Day 11+)自动解锁高阶训练/羞辱(约 15 个) |
| **深度解锁** | 开启 body 档位自动解锁 body 级动作(约 10 个) |
| **R18 解锁** | 开启 r18 档位自动解锁刺激类(约 8 个) |

**后续扩展**:未来可加入"**珠解锁高阶动作**"机制——比如"服从珠银级后才能点 train_use_toilet"——但这是**文档外**的扩展,v0.6.0 不做。

---

## 2.5 动作库的技术组织

新的文件组织:

```
src/data/
  sources.js              新增:Source 定义和 Source → Palam 转化表
  palam.js                新增:Palam 定义和阈值
  juels.js                新增:珠的分级定义和印痕文本(文档三详解)
  imprints.js             新增:刻印定义(文档四详解)
  
  actions.js              改造:基础动作(环境/递送/接触/特殊触发/护理/医疗/状态)
  training.js             改造:调教动作(触碰/训练/束缚/刺激/羞辱)
  
  items.js                保留:消耗品
  toys.js                 保留:调教玩具
  scenes.js               保留:外部场景
  risks.js                保留:风险事件
  dialogue.js             保留:对话切入点
  custom_templates.js     保留:自定义模板
```

`actions.js` 和 `training.js` 的分界改为"**是否启动会话**":
- `actions.js` = 不启动会话的所有动作
- `training.js` = 启动会话的所有动作(触碰/训练/束缚/刺激/羞辱 5 类)

---

# 📋 Part 1 完结 · 下一步

这份文档定义了:
- ✅ 四层架构(Source / Palam / 珠 / ABL)
- ✅ 14 种 Source、8 种 Palam 的完整定义
- ✅ 调教会话的边界和生命周期
- ✅ 76 个动作的完整分类和数据结构
- ✅ Source → Palam 的转化公式
- ✅ 新架构与旧数值的迁移对应表

**接下来 Part 2 会交付**:
- 文档三:珠谱规范(6 珠 × 4 级 = 24 条印痕文本)
- 文档四:刻印系统(负面惩罚机制)

**审阅方式**:通读完整份文档,有疑问/异议/想改的地方列出来,我在 Part 2 动笔前处理。

> 🔒 这是设计文档,没有一行代码。改起来成本极低。
