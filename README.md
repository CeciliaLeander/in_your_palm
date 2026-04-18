# 掌心的它 · In Your Palm

> SillyTavern 扩展 · 囚禁情境叙事控制台

一个给 SillyTavern 用的交互式工具，让你在任何角色卡的对话里开启"囚禁情境"。载入你喜欢的角色卡后，点击顶栏的手掌图标，即可打开控制台——监控画面、调教动作、对话切入点、玩具库存、多套主题，一应俱全。

## 特色

- **交互式控制台**：不再依赖"在输入框里打指令"，所有操作通过按钮完成
- **完整引擎**：11 维状态 + 阶段乘数 + 重复衰减，让相同动作在不同阶段产生不同效果
- **通用性**：与任何角色卡搭配使用，不需要修改角色卡
- **三套主题**：暗黑监控 / 暗金奢华 / 粗粝铁锈
- **调教系统**：29 种调教道具、19 个训练动作、11 种对话切入点
- **自由创作**：12 类自定义动作模板，玩家描述动作，AI 生成反应
- **内容分级**：psych / body / r18 三档，严格遵守所选档位

## 安装

### 方式 1：通过 SillyTavern 的扩展管理器（推荐）

1. 打开 SillyTavern
2. 点击顶栏 `Extensions` → `Install extension`
3. 粘贴本仓库 URL：`https://github.com/CeciliaLeander/in_your_palm`
4. 点击 `Save`
5. 在扩展面板找到"掌心的它"，勾选启用

### 方式 2：手动安装

1. 下载本仓库的 ZIP 包
2. 解压到 `你的SillyTavern目录/data/default-user/extensions/in_your_palm/`
3. 重启 SillyTavern
4. 在扩展面板启用它

## 使用

### 第 1 步：载入你想要囚禁的角色卡

打开任何一张角色卡，开始对话（或继续已有对话）。

### 第 2 步：打开控制台

点击酒馆顶栏的 **🫸 手掌图标**（或屏幕右下角的悬浮按钮）。

### 第 3 步：完成开场配置

走完 7 步配置：
1. 选择囚禁环境类型（缜密 / 临时起意 / 情感爆发 / 冷酷型）
2. 选择场景风格
3. 选择内容深度（psych / body / r18）
4. 设定囚禁背景
5. 指定 {{user}} 与 {{char}} 的原关系
6. 选择 {{user}} 的社会身份
7. 标记 {{user}} 的外在特质

### 第 4 步：开始操作

在主控制台里点击按钮：
- **环境**：控制灯光、温度、音乐
- **递送**：送食物、饮水、必需品
- **接触**：近距离接触、沉默、威胁
- **对话**：进入审讯、威胁、诱导等对话模式
- **调教**：触碰、束缚、训练、刺激
- **道具**：装备/卸下调教道具
- **外出**：切换到外部场景（去超市、上班、上学等）
- **自定义**：自由描述 {{user}} 的任何动作

每次操作，扩展会把动作和当前状态打包成 prompt 发给 AI，AI 据此生成 {{char}} 的反应。

### 第 5 步（可选）：导入 Lorebook

为了让 AI 更好地理解本作品的叙事规则，建议导入配套的 22 条 Lorebook 规则：

在扩展设置面板里点击"导入 Lorebook 规则到当前角色"，它会创建一个名为 "In Your Palm Core" 的世界书，请手动将它绑定到当前角色。

## 配置

在扩展设置面板（酒馆 Extensions 菜单里）可以调整：

- **启用/禁用扩展**
- **动作自动发送到对话**：关闭则只记录不发送（用于调试）
- **默认主题**：每次打开控制台时用的主题

## 关于 AI 行为

本扩展**不包含**"不代写 user"这类通用 RP 规则——这些应该由你的**系统预设**负责。建议搭配一个强调"AI 只扮演 {{char}}、不代写 {{user}} 内心"的预设使用。

本扩展提供的 Lorebook 只包含：
- 本作品独有的世界观
- 11 维状态数值的解读方式
- 阶段系统的叙事影响规则
- 配置字段的作用范围

## 适用 AI 模型

建议使用指令跟随能力强的模型：
- Claude（任何版本）
- GPT-4 / GPT-4 Turbo
- Gemini Pro
- Mistral Large

弱模型可能忽略 STATE 数据或叙事规则，导致体验下降。

## 已知限制

- **顶栏图标位置**：不同版本的 SillyTavern UI 结构不同，图标可能出现在不同位置，或以悬浮按钮形式出现在右下角
- **自动发送 prompt**：依赖酒馆的 slash command API（`/sys`），如果你的酒馆版本不支持，可以关掉 autoSend 手动复制 prompt
- **移动端**：控制台布局已做响应式适配，但小屏体验不如桌面端

## 开发

### 项目结构

```
in_your_palm/
├── manifest.json           扩展配置
├── index.js                入口脚本
├── style.css               框架 CSS
├── templates/
│   └── console.html        控制台模板（开场菜单 + 主控制台 + 完整 CSS + JS）
├── engine/
│   └── engine.js           引擎（88KB，分模块构建产出）
├── lorebook/
│   └── core_lorebook.json  22 条 Lorebook 规则
└── assets/                 预留
```

### 修改引擎

引擎在项目另一个仓库：[captive_project]。修改后跑 `node build.js` 重新生成 `engine.js`，然后拷贝到 `engine/engine.js`。

### 修改控制台 UI

控制台模板 `templates/console.html` 是由 `opening_menu.html` + `console.html` 合成的。修改方式：
1. 改源文件
2. 跑合成脚本重新生成 `templates/console.html`

## 许可

AGPL-3.0（符合 SillyTavern 扩展社区的推荐许可）

## 致谢

- [SillyTavern](https://github.com/SillyTavern/SillyTavern)
- [Character Card V3 Specification](https://github.com/kwaroran/character-card-spec-v3)
