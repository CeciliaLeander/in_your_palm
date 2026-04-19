# 掌心的它 · 项目状态总结

> 这份文档写给:**下一个对话窗口的 Claude**,让它能无缝接手这个项目。
> 用户:CeciliaLeander(中文交流,Mac 用户,非开发者但在学 VS Code+Git)
> 最近更新:2026-04-19(进入 v0.6.0 重构准备期)

---

## 🚨 首要信息(新窗口 Claude 必读)

**当前项目阶段**:**v0.5.3 已稳定发布 → v0.6.0 设计完成 → 等待进入代码改造阶段 1**

**当前分支**:`refactor-v0.6.0`(重构工作区)
**稳定版本在**:`main` 分支(v0.5.3,永远不动)

**完整设计文档位置**:`docs/` 目录下 6 份 MD 文件
- `DESIGN_PART1_architecture_actions.md` — 架构 + 动作库
- `DESIGN_PART1.5_personas.md` — 人格模板
- `DESIGN_PART2_juels_imprints.md` — 珠谱 + 120 条印痕
- `DESIGN_PART3A_imprints.md` — 刻印系统
- `DESIGN_PART3B_ui.md` — UI 改造
- `DESIGN_PART3C_roadmap.md` — 代码路线图(**最先读这份**)

**接下来第一件事**:阅读 `docs/DESIGN_PART3C_roadmap.md`,进入"阶段 1 · 数据层铺设"。详见后文 §14。

---

## 一、项目是什么

**作品名**:掌心的它 · In Your Palm
**类型**:SillyTavern 扩展(非角色卡)
**主题**:囚禁情境 RP 控制台 · 囚禁者({{user}}) × 被囚禁者({{char}})
**内容分级**:三档(psych 心理向 / body 身体 / r18 完整)
**当前版本**:**v0.5.3**(已推到 GitHub main 分支)
**下个目标版本**:v0.6.0(重构,引入三层架构)

**核心玩法**:玩家载入任何角色卡 → 点顶栏手掌按钮 → 弹出开场配置 → 进入右侧抽屉控制台 → 点按钮执行动作 → 引擎算数值变化 → 生成结构化 prompt → 发给 AI → AI 生成 {{char}} 反应。

---

## 二、仓库位置

**GitHub**:https://github.com/CeciliaLeander/in_your_palm
**本地**:`~/Desktop/InPalm/in_your_palm/`
**用户 Git 配置**:
- Name: `CeciliaLeander`
- Email: `sxxe567789@hotmail.com`

**分支结构**:
- `main` — 稳定版 v0.5.3,**任何时候出问题都能 checkout 回来**
- `refactor-v0.6.0` — 重构工作区,所有新改动在这里

---

## 三、v0.5.3 当前状态(已稳定)

### v0.5.3 最近完成的改动

1. **简化 prompt 为 user 消息**(之前是 /sys 系统消息,AI 不回应)
   - 改成 `/send` 命令发送,AI 把它当玩家发言接话
2. **mode 改为纯镜头提示**
   - 4 种模式:observation / intimate / outside / dialogue
   - dialogue 暂不注入提示(phone 道具落地后再做)
   - tension 合并到 outside
3. **保持"客观叙述,不指挥 AI 如何演"**的原则
   - prompt 不再写"描写身心消耗"这类暗示

### v0.5.3 的文件结构

```
in_your_palm/
├── manifest.json                     v0.5.3
├── index.js                          ✓ 新版(简化 prompt + /send)
├── style.css
├── README.md
├── MAINTENANCE.md
├── .gitignore                        ✓ 新增
│
├── docs/                             ✓ 新增目录
│   ├── DESIGN_PART1_architecture_actions.md
│   ├── DESIGN_PART1.5_personas.md
│   ├── DESIGN_PART2_juels_imprints.md
│   ├── DESIGN_PART3A_imprints.md
│   ├── DESIGN_PART3B_ui.md
│   └── DESIGN_PART3C_roadmap.md
│
├── engine/
│   └── engine.js                     构建产物
│
├── lorebook/
│   └── core_lorebook.json
│
├── templates/
│   └── console.html
│
├── src/                              引擎源码
│   ├── 00_constants.js
│   ├── 01_state.js
│   ├── 98_api.js
│   ├── 99_export.js
│   ├── data/
│   ├── core/
│   │   └── context.js                ✓ 新版(加 NARRATION_HINTS)
│   └── systems/
│
├── build.js
└── regression_test.js
```

---

## 四、v0.6.0 重构 · 核心设计变化

### 架构变革:引入三层数据模型

```
旧版(v0.5.x):动作直接改 STATE.char.xxx 数值
新版(v0.6.0):动作产生 Source → 转化 Palam → 累积结算为珠
```

### 4 层结构

| 层级 | 生命周期 | 玩家可见? |
|---|---|---|
| **Source** | 瞬时(单次动作) | 短暂显示 |
| **Palam** | 会话内累积 | 会话面板 |
| **珠** | 永久 | 珠谱 |
| **ABL / 生理值** | 永久,缓慢变化 | 抽屉数值区 |

### 关键新系统

- **6 种珠**:服从 / 扭曲 / 羞耻 / 欲望 / 空虚 / 反抗 · 每珠 4 级(铜/银/金/黑曜)
- **120 条印痕文本**(6 珠 × 4 级 × 5 人格模板)
- **5 种人格主模板** + **18 个倾向 tag**
- **9 种刻印**(永久心理创伤,不可逆)
- **调教会话**概念(Palam 的容器)

### 被废弃的数据(**只有 4 项**)

- `STATE.char.arousal`
- `STATE.char.shame`
- `STATE.char.trained`
- `STATE.state.distortion`

其他 60% 代码保留,25% 改造,14% 新增。

---

## 五、v0.6.0 · 8 阶段路线图

| 阶段 | 内容 | 工作量 | 风险 |
|---|---|---|---|
| **1** | **数据层铺设**(新增 5 个 data 文件,不改逻辑) | ~2h | 🟢 极低 |
| 2 | 引擎核心改造(Source→Palam 链路) | ~4h | 🔴 高 |
| 3 | 珠系统 + 印痕注入 | ~3h | 🟡 中 |
| 4 | 人格模板系统 | ~2h | 🟡 中 |
| 5 | 刻印系统 | ~2h | 🟡 中 |
| 6 | UI 重构一期(数值区 + 会话面板) | ~4h | 🟢 低 |
| 7 | UI 重构二期(珠谱 + 结算弹窗) | ~4h | 🟡 中 |
| 8 | 动作库扩展(35 → 76 个) | ~3h | 🟡 中 |

总工作量:约 24 小时,分布在 8-15 个对话窗口。
预计完成:5-6 周(每天 2h 投入)。

---

## 六、用户(CeciliaLeander)偏好

- **中文交流**
- **不是开发者**但学得很快:会 VS Code 基本操作、跟得上命令行指导
- 喜欢**分步骤的清晰指导**(一步一步让做,而不是一次塞很多)
- **Mac 用户**(MacBook Air)
- 不喜欢**一次给过多信息**——尤其避免在不确认她想做什么之前就大规模改代码
- **一次给太多选择会迷茫**——用 `ask_user_input_v0` 一次 1-3 个问题最佳
- **遇到问题会截图**——通常第一反应是发截图
- 对视觉细节敏感(主题、布局、数值展示)
- 明确表达不想要的就尊重,不要再塞回去

---

## 七、关键教训(给未来的自己)

### ❌ 曾犯过的错

1. **擅自删原版内容**再告诉她"我简化了"——导致"监控画面丢了"、"数值丢了"等问题
2. **假设 API 存在**没查源码就调用——导致按钮什么都不显示
3. **不核对再动手改**——比如上来就重写整个 console.html,后来才发现按钮 ID 全错
4. **太长的一次性改动**后很难回滚——每个改动应该小步快跑

### ✅ 应该这样做

1. **重构前先读源码**
2. **重构前先问**:"这个元素是不是要保留?" 得到明确答复再删
3. **保留"能工作的版本"**——每次改之前先备份,出问题能退回去
4. **一次改 1-2 件事**,提交,测试,再继续
5. **把 v0.5.3 当 baseline**:main 分支始终稳定,重构在 refactor-v0.6.0 分支

---

## 八、v0.6.0 设计决策速查(给新窗口 Claude)

如果用户让你改重构相关的内容,以下是**已经定下的核心决策**,不要在这些问题上浪费用户时间:

| 决策点 | 结论 |
|---|---|
| 主模板数量 | 5 种(resistant/devoted/submissive/volunteer/apathetic) |
| tag 数量 | 18 个(12 基础 + 6 新增条件型) |
| 主模板和 tag 选择上限 | tag 无硬上限,超过 3 个有 UI 警告 |
| 数值合并公式 | 0.7 主模板 + 0.3 tag 加权 |
| 珠的种类 | 6 种,每种 4 级 |
| 印痕文本 | 120 条(6×4×5),已写好在 DESIGN_PART2 |
| 印痕风格 | 临床观察笔记(冷峻、第三人称) |
| 印痕持续 | 永久(一度解锁永久生效) |
| 扭曲珠的处理 | 隐藏(解锁不弹通知,珠谱详情有"未告知"提示) |
| 刻印种类 | 9 种 |
| 刻印可逆性 | 全部不可逆 |
| 会话结算弹窗 | 必须响应(不可 ESC 跳过) |
| 动作 tab 布局 | 13 tab 分两行 |
| UI 主题优先级 | noir 优先,ornate / raw 可先占位 |
| 旧存档迁移 | 不兼容(现在没玩家,直接重开) |
| 数值合并权重等 | 已定,见 DESIGN_PART1.5 |

**如果用户提出改动任何以上决策**,务必提醒她:"这是 XX 天前的决策,改动会牵一发动全身,要不要先读一下 DESIGN_PARTX 里的相关设计再决定?"

---

## 九、李岐弗角色配置(参考用例)

用户设计了一个复杂角色卡"李岐弗"(Sebastian Lee,精英学术派、情商极高、防御性强)。作为测试案例,推荐配置为:

```
主模板: resistant
tag:
  • strategic            — 冷静分析的抵抗方式
  • aesthetic_revulsion  — 对粗俗额外反应(他是精英品味)
  • status_anchored      — 身份锚定(学阀世家)
  • phobic_trauma        — 血、海鲜腥味(童年创伤)
```

如果用户在测试时用了不同的配置,以这为参照校准"应该是什么反应"。

---

## 十、SillyTavern 扩展关键技术点(保留不变)

### 绕过 DOMPurify

SillyTavern 默认用 DOMPurify 清洗 HTML,会移除 `<script>`。所以:
- 在 `index.js` 里**直接 fetch 模板**,用 DOMParser 解析,手动把 style/html/script 节点注入 DOM
- 不用 `renderExtensionTemplateAsync`(因为它会走 DOMPurify)

### CSS 作用域

所有样式必须带 `#inp-drawer` 或 `#inp-opening-root` 前缀。

### 防御性样式

```css
#inp-drawer input, textarea, select, button {
  all: unset;
  ...
}
```

### prompt 发送方式(v0.5.3)

`index.js` 里的 `sendActionPromptToChat(packet)` 通过 `context.executeSlashCommandsWithOptions('/send ...')` 作为 **user 消息**注入对话(不再是 /sys)。

---

## 十一、工作流

```bash
# 1. 改代码(在 refactor-v0.6.0 分支上)
# 2. 如果改了 src/ 下的文件
cd ~/Desktop/InPalm/in_your_palm
node build.js

# 3. 改版本号(manifest.json + index.js 里的 VERSION 常量)

# 4. VS Code Source Control 提交推送
# 5. 酒馆 → Extensions → 找到扩展 → Update → 刷新页面
```

**重要**:重构期间**不要合并 refactor-v0.6.0 到 main**。main 保持 v0.5.3 稳定。等 v0.6.0 完整测试通过,再考虑合并。

---

## 十二、下一次对话交接卡(重要)

### 开工前检查

新窗口 Claude 接手时,应该让用户:
1. 确认当前在 `refactor-v0.6.0` 分支(VS Code 左下角显示)
2. 确认 `docs/` 目录下有 6 份设计文档
3. 读一下 `docs/DESIGN_PART3C_roadmap.md` 的 §6.4(阶段 1 任务清单)

### 阶段 1 的第一件事

阶段 1 是"**数据层铺设**"——新增 5 个数据文件,不改任何逻辑。这是**风险最低**的入口。

**预期产出**:
- `src/data/sources.js`(14 种 Source 定义)
- `src/data/palam.js`(8 种 Palam + 阈值)
- `src/data/juels.js`(6 种珠 + 120 条印痕)
- `src/data/imprints.js`(9 种刻印)
- `src/data/personas.js`(5 模板 + 18 tag)
- 更新 `build.js`,把新文件加入构建序列

**验证**:`node build.js` 成功 + 扩展正常加载 + 旧功能不受影响。

---

## 十三、接下来新窗口 Claude 要做的第一件事

**不要假设用户的工程背景**。她走过了 Git+VS Code 全流程,但心智负担在设计和视觉上。

**先读这份文档,然后询问用户**:

> "我已经读完了项目交接。你现在处于 v0.6.0 重构准备期,当前分支 refactor-v0.6.0。
> 是准备开工阶段 1(数据层铺设),还是先过一遍某份设计文档?"

然后**根据她的回答**决定下一步。

**不要主动提出"我觉得应该重构 XX"** 除非她明确表达了那方面的需求。

---

## 附录 A:关键文件速查

| 想改的东西 | 文件 | 改完要做的 |
|---|---|---|
| 加新玩具 | `src/data/toys.js` | `node build.js` |
| 加新动作 | `src/data/actions.js` 或 `training.js` | `node build.js` + 在 console.html 加按钮 |
| 加对话切入点 | `src/data/dialogue.js` | `node build.js` |
| 调阶段乘数 | `src/00_constants.js` | `node build.js` |
| 改 AI 叙事规则 | `lorebook/core_lorebook.json` | 不需要 build |
| 改抽屉 UI | `templates/console.html` | 不需要 build(但要重推 git) |
| 改发 prompt 逻辑 | `index.js` 的 `sendActionPromptToChat` | 直接推 git |
| 新增 Source/Palam/珠/刻印/人格 | `src/data/*.js`(阶段 1 创建) | `node build.js` |

---

## 附录 B:动作 ID 对照(v0.5.3 硬编码在 templates/console.html 的按钮)

**环境**: cut_lights, restore_lights, lower_temp, play_audio, cut_water
**递送**: deliver_food_basic, deliver_food_premium, take_away_food
**接触**: broadcast_message, letter_slot, enter_room, silence_day, fake_rescue_signal, reveal_truth, wait_24h, show_memento
**调教-触碰**: touch_hair, touch_face, hold_hand, embrace, brush_hair
**调教-束缚**: bind_wrists, bind_full
**调教-训练**: train_sit, train_response, train_feeding
**调教-刺激**: tease_light, stimulate_direct, use_toy_stimulation, edge
**调教-药物**: drug_sedative, wake_up, put_to_sleep
**外出**: supermarket, pharmacy, street, cafe(通过 visitScene 调用)
**自定义类别**: touch_gentle, touch_rough, stimulation_mild, stimulation_heavy, training_soft, training_harsh, verbal_sweet, verbal_harsh, punishment, reward, observe, neutral

v0.6.0 将扩展到 76 个动作,新增类别:**羞辱**(humiliation)。

---

## 附录 C:版本演进历程

- v0.4.x — 原版,11 维数值,直接改 STATE
- v0.5.0 — 抽屉 UI 重构
- v0.5.1 — 修复 DOMPurify 问题 + 防御性样式
- v0.5.2 — (跳过,合并到 v0.5.3)
- v0.5.3 — **当前稳定版**,prompt 改 user 消息 + 镜头提示
- **v0.6.0 设计完成,准备进入重构**

---

文档到此。祝新对话顺利 🔒
