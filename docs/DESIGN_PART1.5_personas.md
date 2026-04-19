# 掌心的它 · 调教系统设计文档 Part 1.5/N

> **版本**:Design v1.0 · Persona Supplement
> **范围**:Part 1 的补丁——人格模板系统
> **定位**:所有动作效果的**修正层**,在 Source → Palam 转化中生效

---

## 📖 为什么需要这份补丁

Part 1 的四层架构(Source / Palam / 珠 / ABL)默认假设 char 是**被动受害者**——所有转化系数都按"抗拒、反感、逐渐扭曲"的心理曲线设定。

但你作品的 char 是**载入的任何角色卡**:可能是深爱 user 的青梅竹马,可能是本身有 M 倾向的角色,可能是情感淡漠的反社会者。

Part 1.5 引入**人格模板系统**,让同一套架构能正确处理不同人格的 char。

---

## 1.5.1 系统总览

```
┌───────────────────────────────────────┐
│  主模板(5 选 1 · 互斥)                │
│  - resistant / devoted / submissive   │
│  - volunteer / apathetic              │
└──────────────────┬────────────────────┘
                   │
                   │ 加权合并(0.7 主 + 0.3 tag)
                   │
┌──────────────────┴────────────────────┐
│  倾向 tag(0-3 个 · 可叠加)            │
│  - masochistic / exhibitionist / ...  │
└──────────────────┬────────────────────┘
                   ▼
        ┌─────────────────────┐
        │ 最终转化系数         │
        │ (14 source × 8 palam)│
        └──────────┬──────────┘
                   │ 用于 Source→Palam 计算
                   ▼
             引擎按此系数进行数值转化
```

---

## 1.5.2 主模板定义(5 种)

每个主模板定义**完整的 Source → Palam 转化系数表**。玩家开新局时必须选一个。

### 1.5.2.1 resistant · 抗拒型(默认)

**定位**:被动受害者,原始反感,逐渐扭曲。

**适合角色卡**:陌生人、敌对者、被抓捕的勇者、正义方代表

**核心心理**:
- 真实的抗拒存在
- 温柔被视为威胁(早期)
- 恐惧与屈辱是主要情感
- 扭曲通过长时间累积产生

**转化系数表**(这是 Part 1 §1.2.3 的完整版):

| Source | pleasure | desire | lewdness | shame_palam | submission_palam | depression | distortion_palam | resistance |
|---|---|---|---|---|---|---|---|---|
| pleasure_c | 1.0 | 0.7 | 0 | 0 | 0 | 0.2 | 0 | 0 |
| pleasure_v | 1.0 | 0.8 | 0.1 | 0 | 0 | 0 | 0.3 | 0 |
| pleasure_a | 1.0 | 0.8 | 0.1 | 0.2 | 0 | 0 | 0.3 | 0 |
| pleasure_b | 0.8 | 0.5 | 0 | 0.5 | 0 | 0 | 0 | 0 |
| shame | 0 | 0.2* | 0 | 1.0 | 0 | 0 | 0 | 0.3 |
| terror | 0 | 0 | 0 | 0 | 0 | 0.6 | 0.4 | 0.8 |
| humiliation | 0 | 0 | 0 | 0.8 | 0.5 | 0 | 0 | 0.4 |
| exposure | 0 | 0.3 | 0 | 0.7 | 0 | 0 | 0 | 0.2 |
| intimacy | 0 | 0 | 0 | 0 | 0 | 0.3 | 0.6 | 0.4** |
| dependence | 0 | 0 | 0 | 0 | 0.4 | 0 | 0.8 | 0.3 |
| submission | 0 | 0 | 0 | 0 | 1.0 | 0.3 | 0 | 0.5 |
| disgust | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1.0 |
| pain | 0 | 0 | 0 | 0 | 0 | 0 | 0.3 | 0.7 |

*shame → desire 系数随阶段递增(震惊期 0,转化期 0.4)
**intimacy → resistance 系数随阶段递减(震惊期 1.0,转化期 0.1)

---

### 1.5.2.2 devoted · 深情型

**定位**:本就深爱 user,囚禁是"另一种形式的在一起"。

**适合角色卡**:青梅竹马、痴情恋人、暗恋者、为 user 献身的角色

**核心心理**:
- 几乎不产生真实抵抗
- 亲密动作高效产生依存
- 束缚/恐惧仍会引起恐慌(因为爱人为什么要这样对我的认知冲突)
- 但冲突本身会加速扭曲(自欺:"他这样做一定有原因")

**转化系数表**(差异标红):

| Source | pleasure | desire | lewdness | shame_palam | submission_palam | depression | distortion_palam | resistance |
|---|---|---|---|---|---|---|---|---|
| pleasure_c | 1.0 | 0.7 | 0 | 0 | 0 | 0 | 0.3 | 0 |
| pleasure_v | 1.0 | 0.8 | 0.1 | 0 | 0 | 0 | 0.4 | 0 |
| pleasure_a | 1.0 | 0.8 | 0.1 | 0.2 | 0 | 0 | 0.4 | 0 |
| pleasure_b | 0.8 | 0.5 | 0 | 0.3 | 0 | 0 | 0.2 | 0 |
| shame | 0 | 0.3 | 0 | 0.8 | 0 | 0 | 0.2 | 0.1 |
| terror | 0 | 0 | 0 | 0 | 0 | 0.4 | 0.5 | 0.5 |
| humiliation | 0 | 0 | 0 | 0.6 | 0.3 | 0.3 | 0.3 | 0.2 |
| exposure | 0 | 0.3 | 0 | 0.5 | 0 | 0 | 0.2 | 0.1 |
| **intimacy** | 0 | **0.2** | 0 | 0 | **0.2** | 0 | **0.4** | **0** |
| **dependence** | 0 | 0 | 0 | 0 | **0.6** | 0 | **1.0** | **0** |
| **submission** | 0 | 0 | 0 | 0 | **0.6** | **0.2** | **0.5** | **0.2** |
| disgust | 0 | 0 | 0 | 0 | 0 | 0.3 | 0 | 0.8 |
| pain | 0 | 0 | 0 | 0 | 0 | 0.3 | 0.5 | 0.3 |

**关键差异**:
- intimacy 和 dependence 几乎不产生 resistance(相反产生大量扭曲,因为 char 会自己给暴力行为找理由)
- 亲密行为会产生少量欲望(因为 char 本就渴望 user)
- terror 的 resistance 降低,但扭曲依然高(恐惧被转化为"他爱我才这样")

---

### 1.5.2.3 submissive · M 倾向型

**定位**:有被支配欲,束缚/羞辱/痛感产生快感反应。

**适合角色卡**:有 BDSM 倾向的角色、主动表达"想被支配"的角色

**核心心理**:
- 抵抗有但弱
- 负面刺激转化为生理愉悦
- 羞耻感不是纯粹负面,带有兴奋成分
- 高阶训练/束缚会产生深度快感

**转化系数表**:

| Source | pleasure | desire | lewdness | shame_palam | submission_palam | depression | distortion_palam | resistance |
|---|---|---|---|---|---|---|---|---|
| pleasure_c | 1.0 | 0.7 | 0 | 0 | 0 | 0 | 0.2 | 0 |
| pleasure_v | 1.0 | 0.8 | 0.2 | 0 | 0 | 0 | 0.3 | 0 |
| pleasure_a | 1.0 | 0.9 | 0.2 | 0.2 | 0 | 0 | 0.3 | 0 |
| pleasure_b | 0.8 | 0.5 | 0 | 0.3 | 0 | 0 | 0 | 0 |
| **shame** | **0.2** | **0.4** | 0 | 1.0 | **0.3** | 0 | 0 | 0.1 |
| terror | 0 | 0.1 | 0 | 0 | 0.2 | 0.3 | 0.3 | 0.4 |
| **humiliation** | **0.3** | **0.4** | **0.2** | 0.8 | **0.6** | 0 | 0 | 0.2 |
| **exposure** | **0.2** | **0.5** | 0 | 0.5 | 0 | 0 | 0 | 0.1 |
| intimacy | 0 | 0.2 | 0 | 0 | 0.2 | 0.2 | 0.5 | 0.3 |
| dependence | 0 | 0.2 | 0 | 0 | 0.5 | 0 | 0.7 | 0.2 |
| **submission** | **0.3** | **0.4** | 0.1 | 0.2 | **1.2** | 0 | 0.2 | 0.1 |
| disgust | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.7 |
| **pain** | **0.3** | **0.3** | 0 | 0 | 0 | 0 | 0.3 | 0.3 |

**关键差异**:
- shame / humiliation / pain / submission / exposure **都产生快感和欲望**(这是 M 倾向的核心)
- resistance 普遍低于 resistant
- lewdness 在深度刺激下才出现,但阈值较低

---

### 1.5.2.4 volunteer · 自愿型

**定位**:主动投入囚禁,斯德哥尔摩自愿版。

**适合角色卡**:主动寻求囚禁的角色、有被囚情结的角色、主动献身的角色

**核心心理**:
- 几乎不抵抗
- 将一切合理化
- 扭曲进程最快
- 但缺乏"深情"的情感深度(不是因为爱,是因为本身人格倾向)

**转化系数表**:

| Source | pleasure | desire | lewdness | shame_palam | submission_palam | depression | distortion_palam | resistance |
|---|---|---|---|---|---|---|---|---|
| pleasure_c | 1.0 | 0.7 | 0.1 | 0 | 0 | 0 | 0.4 | 0 |
| pleasure_v | 1.0 | 0.8 | 0.2 | 0 | 0 | 0 | 0.5 | 0 |
| pleasure_a | 1.0 | 0.8 | 0.2 | 0.2 | 0 | 0 | 0.5 | 0 |
| pleasure_b | 0.8 | 0.5 | 0.1 | 0.3 | 0 | 0 | 0.3 | 0 |
| shame | 0 | 0.2 | 0 | 1.0 | 0.2 | 0 | 0.3 | 0.1 |
| **terror** | 0 | 0 | 0 | 0 | **0.3** | **0.3** | **0.8** | **0.2** |
| humiliation | 0 | 0.1 | 0 | 0.7 | 0.5 | 0 | 0.3 | 0.1 |
| exposure | 0 | 0.2 | 0 | 0.5 | 0 | 0 | 0.2 | 0.1 |
| **intimacy** | 0 | 0.1 | 0 | 0 | 0.3 | 0 | **1.0** | 0 |
| **dependence** | 0 | 0 | 0 | 0 | **0.7** | 0 | **1.2** | 0 |
| submission | 0 | 0 | 0 | 0 | 1.0 | 0 | 0.5 | 0.1 |
| **disgust** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **0.2** |
| pain | 0 | 0.1 | 0 | 0 | 0.2 | 0 | 0.4 | 0.3 |

**关键差异**:
- **几乎所有 source 都不产生 resistance**(自愿者不会抵抗)
- **扭曲系数普遍高于其他模板**(自愿者快速深陷)
- 恐惧和痛感也被合理化为"这就是我想要的"

---

### 1.5.2.5 apathetic · 情感淡漠型

**定位**:心理冲击打不进去,主要通过身体建立联系。

**适合角色卡**:反社会者、严重创伤后麻木、情感隔绝的角色、习惯极端环境的战士

**核心心理**:
- 心理 palam 普遍打折
- 生理通路正常
- 扭曲依然存在,但以不同方式呈现(不是"依赖",是"习惯")
- 反感普遍低,但也没有深度积极情感

**转化系数表**(心理类 source 普遍 × 0.5):

| Source | pleasure | desire | lewdness | shame_palam | submission_palam | depression | distortion_palam | resistance |
|---|---|---|---|---|---|---|---|---|
| pleasure_c | 1.0 | 0.7 | 0 | 0 | 0 | 0.1 | 0 | 0 |
| pleasure_v | 1.0 | 0.8 | 0.1 | 0 | 0 | 0 | 0.2 | 0 |
| pleasure_a | 1.0 | 0.8 | 0.1 | 0.1 | 0 | 0 | 0.2 | 0 |
| pleasure_b | 0.8 | 0.5 | 0 | 0.2 | 0 | 0 | 0 | 0 |
| **shame** | 0 | 0.1 | 0 | **0.5** | 0 | 0 | 0 | 0.2 |
| **terror** | 0 | 0 | 0 | 0 | 0 | **0.3** | **0.2** | **0.4** |
| **humiliation** | 0 | 0 | 0 | **0.4** | **0.3** | 0 | 0 | 0.2 |
| **exposure** | 0 | 0.2 | 0 | **0.3** | 0 | 0 | 0 | 0.1 |
| **intimacy** | 0 | 0 | 0 | 0 | 0 | **0.2** | **0.3** | **0.3** |
| **dependence** | 0 | 0 | 0 | 0 | **0.2** | 0 | **0.4** | 0.2 |
| **submission** | 0 | 0 | 0 | 0 | **0.5** | **0.2** | 0 | 0.3 |
| disgust | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.7 |
| pain | 0 | 0 | 0 | 0 | 0 | 0 | 0.2 | 0.5 |

**关键差异**:
- 心理系 source(shame/terror/humiliation/exposure/intimacy/dependence/submission)的大部分 palam 转化系数减半
- 生理系(pleasure_*)完全不变
- 这个模板下,**只有身体通路能建立关系**——心理层面很难推进
- 对玩家而言是**硬核难度**

---

## 1.5.3 倾向 tag 库(12 种)

tag 在主模板基础上微调系数。**最多选 3 个**。每个 tag 只影响特定几个 source 的转化。

### 生理倾向类

#### `masochistic` · 受虐倾向

加强痛感 / 恐惧 / 屈辱的生理转化。

```
修正表(仅覆盖这些项):
pain  → pleasure: +0.4, desire: +0.3, resistance: -0.3
terror → pleasure: +0.2, desire: +0.2, resistance: -0.2
humiliation → pleasure: +0.2, desire: +0.3
```

#### `exhibitionist` · 暴露癖

暴露 / 被观看产生额外兴奋。

```
修正表:
exposure → pleasure: +0.3, desire: +0.5, resistance: -0.3, shame_palam: -0.2
```

#### `oral_fixated` · 口腔依赖

口腔相关动作(feed_by_hand / train_feeding)的 dependence 和 pleasure 暴涨。

```
修正表(注:这个 tag 需要动作标记 orality=true,文档二里补充):
dependence → pleasure: +0.3, distortion_palam: +0.3
intimacy → pleasure: +0.2, distortion_palam: +0.2
(仅当动作含 orality flag 时生效)
```

#### `sleep_sensitive` · 睡眠敏感

睡眠期间的交互触发强烈反应。

```
修正表(仅当 char consciousness='asleep/dazed' 时生效):
intimacy → distortion_palam: +0.5, dependence: +0.3
touch → pleasure: +0.2, shame_palam: +0.3
```

---

### 心理倾向类

#### `prideful` · 高自尊

羞辱效果翻倍,但也极难打破初始抵抗。

```
修正表:
humiliation → shame_palam: +0.5, resistance: +0.3, depression: +0.3
exposure → shame_palam: +0.4, resistance: +0.2
submission → resistance: +0.3(前期高抵抗)
```

#### `trauma_resilient` · 创伤抗性

恐惧和绝望的效果减半,但情感也更难建立。

```
修正表:
terror → depression: -0.3, resistance: -0.3, distortion_palam: -0.2
shame → shame_palam: -0.2
intimacy → distortion_palam: -0.2(情感壁垒高)
```

#### `emotionally_dependent` · 情感饥渴

依存和亲密的扭曲系数暴涨。

```
修正表:
dependence → distortion_palam: +0.5, submission_palam: +0.3
intimacy → distortion_palam: +0.4, dependence_secondary: +0.3
(arrived)
```

#### `dissociative` · 易解离

高压下 sanity 大跌,也更容易累积深度扭曲。

```
修正表:
terror → depression: +0.4, distortion_palam: +0.3
humiliation → depression: +0.3
(额外效果:单次会话 terror palam > 80 时,触发 sanity 直接 -10,独立于 palam 机制)
```

---

### 关系倾向类

#### `loyal` · 忠诚

已建立的关系极难破坏。适合"once bonded, forever" 类型。

```
修正表:
intimacy → dependence_secondary: +0.3(强化依存)
disgust → resistance: -0.2(即使被伤害也难彻底翻脸)
(额外效果:扭曲珠铜级解锁后,resistance 永久 × 0.5)
```

#### `jealous` · 占有欲

对比 / 提及他人触发额外反应。

```
修正表(仅当动作含 rival_reference flag 时生效):
humiliation → depression: +0.4, resistance: +0.3(本模板特有)
verbal_degrade → shame_palam: +0.3
(适用动作:compare_to_others、praise_rival、mock_former_life)
```

#### `nurturing` · 共情型

反向关心 user,产生双向扭曲。

```
修正表:
intimacy → distortion_palam: +0.3
dependence → distortion_palam: +0.4
(额外效果:AI prompt 里注入"char 会反过来询问 user 的状态 / 担忧 user"的提示)
```

---

## 1.5.4 主模板 × tag 的冲突规则

| 主模板 | 禁用的 tag |
|---|---|
| resistant | (无冲突,自由搭配) |
| devoted | `trauma_resilient`(与深情矛盾)、`jealous`(深情型 char 难以占有欲式嫉妒) |
| submissive | `prideful`(M 倾向与高自尊冲突) |
| volunteer | `trauma_resilient`(自愿者主动接受一切) |
| apathetic | `emotionally_dependent`、`loyal`、`nurturing`(都与情感淡漠冲突) |

**UI 要做的**:
- 选主模板后,冲突的 tag 变灰不可选
- 如果已选了 tag 再换主模板,冲突的 tag 自动取消勾选(加 toast 提示)

---

## 1.5.5 数值合并公式

**合并方式**:加权平均(0.7 主模板 + 0.3 tag)

但因为有多个 tag,要先合并 tag 再与主模板加权。

### 完整公式

```javascript
function getFinalCoefficient(source, palam) {
  const mainTemplate = STATE.config.persona.main;        // 'resistant' / 'devoted' / ...
  const tags = STATE.config.persona.tags;                // ['masochistic', 'prideful', ...]
  
  // Step 1: 取主模板的系数
  const mainCoef = PERSONA_TEMPLATES[mainTemplate].conversion[source][palam] || 0;
  
  // Step 2: 把所有 tag 的修正值累加
  let tagDelta = 0;
  for (const tagId of tags) {
    const tagDef = TENDENCY_TAGS[tagId];
    const delta = tagDef.conversionDelta[source]?.[palam] || 0;
    tagDelta += delta;
  }
  
  // Step 3: 加权合并
  // 注意:tagDelta 是"相对于主模板的增量",不是独立系数
  //      所以公式是:主系数 × 0.7 + (主系数 + tagDelta) × 0.3
  //      简化为:主系数 + tagDelta × 0.3
  const finalCoef = mainCoef + tagDelta * 0.3;
  
  // 最终系数不允许为负(负系数没有物理意义)
  return Math.max(0, finalCoef);
}
```

### 为什么是"增量"而不是"独立系数"

tag 描述的是"**相对于主模板的偏离**"。比如 `masochistic` 说"痛感 → pleasure: +0.4",意思是"在主模板的基础上增加 0.4"。

如果用独立系数,你选 `resistant + masochistic` 和 `devoted + masochistic` 时,masochistic 的效果会完全一样——这不对。应该是 resistant 基础上的 masochistic 和 devoted 基础上的 masochistic 各有不同最终值。

### 多 tag 冲突的处理

如果两个 tag 同一项有相反的修正(比如 prideful 说 `humiliation → shame_palam: +0.5`,而某个未来的 tag 说 `humiliation → shame_palam: -0.3`),**累加即可**,最终为 +0.2。这是预期行为——意味着"两个相反的倾向在这个 char 身上共存"。

---

## 1.5.6 演变机制(后续扩展,v0.6.0 不实现)

> ⚠️ 这一节是**未来规划**,v0.6.0 **不实现**。现在写下来是为了让架构预留扩展点。

主模板可以在特定事件下演变:

| 触发 | 演变方向 |
|---|---|
| devoted 主模板下,char 累积 resistance palam > 200 | devoted → resistant(被背叛之后心碎) |
| resistant 主模板下,扭曲珠达到金级 | resistant → volunteer(真正的斯德哥尔摩) |
| volunteer 主模板下,反抗珠银级以上 | volunteer → resistant(清醒过来) |
| apathetic 主模板下,扭曲珠达到金级 | apathetic → resistant(终于有情感投入,但方向是抵抗) |

实现方式:
- 在 `STATE.config.persona` 增加 `history` 字段,记录所有演变
- AI prompt 中注入"char 的人格正在演变"的提示
- 提供 UI 按钮让玩家手动触发(或引擎自动触发)

**当前 v0.6.0 只实现"一局锁定"**,但架构支持未来加入演变。

---

## 1.5.7 自定义 Persona(扩展通道)

为未来预留:玩家可以创建自己的 persona 模板,挂到 `STATE.config.persona.custom = {...}`。

自定义 persona 的数据结构:
```javascript
{
  id: 'my_custom_persona',
  name: '我的自定义人格',
  description: '...',
  conversion: { /* 完整的 14×8 系数表 */ },
  extends: 'resistant',  // 可选:继承自哪个主模板(未填的系数用主模板的)
  aiPromptHint: '...'    // 注入到 AI 的额外描述
}
```

v0.6.0 **不做 UI**,玩家需要直接改 `STATE.config` 的 JSON。未来可以加个导入/编辑界面。

---

## 1.5.8 数据结构定义

### STATE.config 新增字段

```javascript
STATE.config = {
  // ...已有字段...
  persona: {
    main: 'resistant',           // 主模板 id,5 选 1
    tags: [],                    // 倾向 tag id 数组,0-3 个
    custom: null                 // 可选:自定义 persona 对象
  }
}
```

### 新文件:src/data/personas.js

```javascript
const PERSONA_TEMPLATES = {
  resistant: {
    id: 'resistant',
    name: '抗拒型',
    shortDesc: '被动受害者,原始反感,逐渐扭曲',
    fullDesc: '...',
    conversion: {
      // 14 source × 8 palam 完整系数表
      pleasure_c: { pleasure: 1.0, desire: 0.7, depression: 0.2 },
      pleasure_v: { pleasure: 1.0, desire: 0.8, lewdness: 0.1, distortion_palam: 0.3 },
      // ...
    },
    stageModifiers: {
      // 特殊:intimacy → resistance 随阶段递减
      'intimacy.resistance': { shock: 1.0, resist: 0.7, adapt: 0.3, transform: 0.1 }
    }
  },
  devoted: { /* ... */ },
  submissive: { /* ... */ },
  volunteer: { /* ... */ },
  apathetic: { /* ... */ }
};

const TENDENCY_TAGS = {
  masochistic: {
    id: 'masochistic',
    name: '受虐倾向',
    desc: '痛感/恐惧/屈辱带来生理快感',
    conversionDelta: {
      pain: { pleasure: 0.4, desire: 0.3, resistance: -0.3 },
      terror: { pleasure: 0.2, desire: 0.2, resistance: -0.2 },
      humiliation: { pleasure: 0.2, desire: 0.3 }
    },
    excludedMains: []  // 不能和哪些主模板搭
  },
  prideful: {
    id: 'prideful',
    name: '高自尊',
    desc: '羞辱效果翻倍,但极难打破初始抵抗',
    conversionDelta: { /* ... */ },
    excludedMains: ['submissive']
  },
  // ... 其余 10 个 tag
};
```

---

## 1.5.9 UI 改造(开场菜单新增第 9 步)

**步骤 9:char 人格**

```
━━━ 第 9 步 · char 的基础人格 ━━━

选择最接近 char 本质的主模板(必选,1 个):
  ◎ 抗拒型      被动受害者,原始反感,逐渐扭曲
  ○ 深情型      本就深爱 user,囚禁是另一种"在一起"
  ○ M 倾向型    被支配欲,束缚/训练产生快感
  ○ 自愿型      主动投入,斯德哥尔摩自愿版
  ○ 情感淡漠型  心理冲击减半,需靠生理建立联系

附加倾向 tag(可选,最多 3 个):
  □ 受虐倾向     □ 暴露癖      □ 口腔依赖     □ 睡眠敏感
  □ 高自尊       □ 创伤抗性    □ 情感饥渴     □ 易解离
  □ 忠诚         □ 占有欲      □ 共情型

[ ⚠ 高自尊与 M 倾向型矛盾,不可同时选择 ]

[ 开始 ]
```

**视觉提示**:
- 主模板下的描述,字小、颜色暗,不喧宾夺主
- 冲突的 tag 变灰 + 鼠标悬停显示"与 X 主模板冲突"
- 已选 tag 以小胶囊形式集中展示,方便删除

---

## 1.5.10 AI 感知(prompt 注入)

人格模板也会注入到 AI 的 prompt 中(非常少的文字,避免干扰叙事):

格式:
```
[Day 1 20:00·震惊期]
动作:训练坐姿
[人格] char 的基础人格为「深情型」,倾向:情感饥渴、忠诚
[印痕] ...(来自珠的感知,详见文档三)
[叙事] 模式:线下近距接触...
```

人格提示**永久注入**每次 prompt(除非玩家触发了演变机制)。

---

# 📋 Part 1.5 完结 · 下一步

这份补丁定义了:
- ✅ 5 种主模板的完整转化系数(核心设计)
- ✅ 12 种倾向 tag 的修正系数
- ✅ 冲突规则(5 组禁用组合)
- ✅ 加权合并公式(0.7 主 + 0.3 tag)
- ✅ 数据结构(STATE.config.persona)
- ✅ 开场菜单 UI 草图
- ✅ AI prompt 注入格式
- ✅ 演变机制和自定义 persona 的预留扩展点

**接下来 Part 2 会交付**:
- 6 珠 × 4 级的完整分级结构
- 120 条印痕文本(每珠级 × 5 主模板)
- 珠的 Palam 阈值
- Prompt 注入具体格式

---

## 🤔 审阅重点

请重点看:

**1. §1.5.2 五个主模板的转化系数**
这是整个系统的数值心脏。数值不重要(后面实测会调),重要的是**方向和意图**。
- resistant:温柔产生扭曲(早期通过高 resistance),对抗 → 抑郁
- devoted:亲密产生强扭曲,几乎不产生抵抗
- submissive:负面刺激产生快感
- volunteer:超快扭曲,近乎无抵抗
- apathetic:心理系全 × 0.5,生理系完整

这 5 个方向对不对?

**2. §1.5.3 12 个 tag 的定义**
- 有没有哪个 tag 不需要?
- 有没有重要的 tag 被我漏掉?
- tag 的名字中文翻译合适吗?

**3. §1.5.4 冲突规则**
我列了 9 组禁用组合。有没有哪个我禁得过严(其实应该允许)?或者该禁的我没禁?

**4. §1.5.5 合并公式 `0.7 主 + 0.3 tag`**
这是你确认过的,但看完实际系数表后,要不要复核一遍?tag 的权重是不是应该更大一点(比如 0.4)或更小(0.2)?

> 🔒 这份文档只是 Part 1 的补丁,没有动 Part 1 的主体。
> 你审完 OK,我就开写 Part 2(珠谱 + 120 条印痕)。
