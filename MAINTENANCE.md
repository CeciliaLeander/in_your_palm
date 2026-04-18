# 掌心的它 · 开发维护指南

这份文档告诉你**如何修改这个扩展**。如果你只是想用，看 `README.md` 就够了。

## 目录结构速查

```
in_your_palm/
│
├── manifest.json            扩展元数据（版本、名字等）
├── index.js                 ⭐ 扩展入口脚本（UI 按钮、模态窗、酒馆 API）
├── style.css                外层样式（顶栏按钮、模态窗）
├── README.md                用户文档
├── MAINTENANCE.md           本文档
│
├── engine/
│   └── engine.js            ⚠️ 自动生成，不要手改！由 src/ 构建而来
│
├── lorebook/
│   └── core_lorebook.json   AI 叙事规则（22 条）
│
├── templates/
│   └── console.html         控制台 UI 模板（开场菜单 + 主控制台）
│
├── src/                     ⭐ 引擎源代码（你主要在这里改）
│   ├── 00_constants.js      常量、阶段、乘数
│   ├── 01_state.js          STATE 对象 + 事件总线
│   │
│   ├── data/                ★ 最常编辑的目录
│   │   ├── scenes.js        场景库
│   │   ├── items.js         消耗品
│   │   ├── toys.js          调教道具（29 个）
│   │   ├── actions.js       基础动作
│   │   ├── training.js      调教/训练动作
│   │   ├── dialogue.js      对话切入点
│   │   ├── risks.js         风险事件
│   │   └── custom_templates.js
│   │
│   ├── core/                核心逻辑（一般不需要改）
│   │   ├── effects.js       阶段乘数 + 重复衰减
│   │   ├── milestones.js    阈值提示
│   │   ├── time.js          时间推进
│   │   ├── conditions.js    条件判定
│   │   ├── inventory.js     物品管理
│   │   ├── context.js       AI 上下文包
│   │   └── risks.js         风险判定
│   │
│   ├── systems/             功能系统
│   │   ├── toys.js          玩具装备/卸下
│   │   └── dialogue.js      对话模式管理
│   │
│   ├── 98_api.js            公开 API 对象
│   └── 99_export.js         全局导出
│
├── build.js                 构建脚本：合并 src/ → engine/engine.js
└── regression_test.js       回归测试
```

## 基本工作流

每次你想加新东西的流程：

```
1. 编辑 src/ 下的对应文件
2. 运行 `node build.js` 重新生成 engine/engine.js
3. 测试（在酒馆里刷新扩展）
4. git commit + push 到 GitHub
```

用户的酒馆如果开启了 auto_update，会自动拉到最新版本。

## 常见任务

### 任务 1：加一个新的调教动作

**例子**：想加一个"强行喂食"的动作

1. 打开 `src/data/training.js`
2. 在 `TRAINING_ACTIONS` 里加一条：

```javascript
feed_by_force: {
  id: 'feed_by_force',
  name: '强行喂食',
  category: 'training',
  durationMinutes: 15,
  requiresCondition: { consciousness: ['awake', 'dazed'] },
  effects: {
    char: { 
      hunger: -25,
      mood: -8,
      shame: +10,
      compliance: +4,
      trained: +3
    },
    state: { distortion: +5 }
  },
  prompt: '玩家强行把食物送到 {{char}} 嘴边，不接受拒绝。描写 {{char}} 的抗拒、吞咽、呛咳，以及最终让步的瞬间。'
},
```

3. 在 `templates/console.html` 的调教 tab 里加一个按钮：

```html
<button class="action-btn" onclick="engineAction('feed_by_force')">强行喂食</button>
```

4. 跑 `node build.js`
5. git commit + push

### 任务 2：加一个新道具

打开 `src/data/toys.js`，在 `TOY_LIBRARY` 里加一条：

```javascript
toy_cat_ears: {
  id: 'toy_cat_ears',
  name: '猫耳发箍',
  category: 'humiliation',
  subcategory: 'head_accessory',
  price: 2,
  description: '可爱又羞耻的装饰',
  equipStats: { 
    char: { shame: +18, compliance: +2 },
    state: { distortion: +6 }
  }
},
```

### 任务 3：调整阶段乘数（让数值变化更快或更慢）

打开 `src/00_constants.js`，找到 `STAGE_MULTIPLIERS`：

```javascript
positive: {
  shock: -0.5,    // ← 想让震惊期的温柔反效果更强？改成 -0.8
  resist: 0.1,
  adapt: 0.5,
  transform: 1.0
},
```

### 任务 4：改 AI 叙事规则

打开 `lorebook/core_lorebook.json`，找到对应的 `uid`，修改 `content` 字段。

**不需要跑 build.js**——Lorebook 是独立 JSON 文件，直接改直接生效。

### 任务 5：改控制台 UI

打开 `templates/console.html` 修改。

**不需要跑 build.js**——这个模板是单独加载的。

## 关于构建

`build.js` 做的事：按 `BUILD_ORDER` 数组的顺序，把 `src/` 下的 21 个文件拼接成一个 `engine/engine.js`，外面包一层 IIFE。

**你改了 src/ 下任何文件，都必须跑 `node build.js` 一次**，否则改动不会生效。

## 版本发布流程

改完想发布新版本：

1. 改 `manifest.json` 的 `version` 字段（比如 `0.4.0` → `0.4.1`）
2. git commit + push
3. 用户的酒馆如果开启了 auto_update，刷新后会自动更新

## 常见坑

### 坑 1：改了 src/ 但没 build

**症状**：改了 `src/data/toys.js` 加新玩具，扩展里看不到。
**解决**：跑 `node build.js`。

### 坑 2：直接改 engine/engine.js

**症状**：改了能工作，下次 build 改动丢了。
**解决**：永远改 `src/` 下的文件。engine/engine.js 是**构建产物**。

### 坑 3：忘了改版本号

每次发布都要改 `manifest.json` 的 `version`，否则用户的 auto_update 不会触发。

## 工具要求

本地开发需要：

- **Node.js**（任何 v18+ 版本）—— 跑 build.js 和 regression_test.js
- **Git**（任何近几年的版本）—— 版本控制
- **VS Code**（推荐）—— 代码编辑

## 如果你不熟悉 JavaScript

别怕。这个项目的 JS 基本都是"数据定义"——就像填表格。99% 的修改都是"复制一个现有的条目、改几个字段"。

遇到不懂的时候，去搜索引擎或者 AI 问一下就行，或者在 issues 里问其他人。
