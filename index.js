// ============================================================
// 掌心的它 · In Your Palm SillyTavern Extension
// 入口文件：index.js (v0.5.3)
//
// 职责：
// 1. 加载引擎（engine/engine.js）
// 2. 加载 Lorebook（lorebook/core_lorebook.json）
// 3. 在酒馆 UI 中注入"打开控制台"的按钮
// 4. 管理控制台弹窗的生命周期
// 5. 连接引擎与酒馆：把按钮动作转成 AI prompt
// ============================================================

import { extension_settings, getContext } from '../../../extensions.js';
import { saveSettingsDebounced } from '../../../../script.js';

const EXTENSION_NAME = 'in_your_palm';
const EXTENSION_FOLDER_NAME = 'third-party/in_your_palm';
const VERSION = '0.5.3';

// 默认设置
const defaultSettings = {
  enabled: true,
  theme: 'theme-noir',
  currentGame: null,
  autoSendPrompts: true,
};

// ============================================================
// 扩展生命周期
// ============================================================

jQuery(async () => {
  console.log('[掌心的它] 扩展加载中...');
  
  if (!extension_settings[EXTENSION_NAME]) {
    extension_settings[EXTENSION_NAME] = structuredClone(defaultSettings);
  }
  Object.keys(defaultSettings).forEach(key => {
    if (extension_settings[EXTENSION_NAME][key] === undefined) {
      extension_settings[EXTENSION_NAME][key] = defaultSettings[key];
    }
  });
  
  await loadEngineScript();
  await initSettingsPanel();
  injectOpenConsoleButton();
  await preloadLorebook();
  
  console.log(`[掌心的它] v${VERSION} 加载完成`);
});

// ============================================================
// 加载引擎脚本
// ============================================================

async function loadEngineScript() {
  return new Promise((resolve, reject) => {
    if (typeof window.InPalmEngine !== 'undefined') {
      console.log('[掌心的它] 引擎已存在，跳过加载');
      resolve();
      return;
    }
    
    const script = document.createElement('script');
    script.src = `/scripts/extensions/${EXTENSION_FOLDER_NAME}/engine/engine.js`;
    script.onload = () => {
      console.log('[掌心的它] 引擎加载成功:', window.InPalmEngine?.VERSION);
      resolve();
    };
    script.onerror = (err) => {
      console.error('[掌心的它] 引擎加载失败:', err);
      reject(err);
    };
    document.head.appendChild(script);
  });
}

// ============================================================
// Lorebook 预加载
// ============================================================

let lorebookData = null;

async function preloadLorebook() {
  try {
    const response = await fetch(`/scripts/extensions/${EXTENSION_FOLDER_NAME}/lorebook/core_lorebook.json`);
    lorebookData = await response.json();
    console.log(`[掌心的它] Lorebook 已加载（${lorebookData.entries?.length || 0} 条）`);
  } catch (err) {
    console.warn('[掌心的它] Lorebook 加载失败:', err);
  }
}

// ============================================================
// 设置面板
// ============================================================

async function initSettingsPanel() {
  const settings = extension_settings[EXTENSION_NAME];
  
  const settingsHtml = `
    <div class="inp-settings" id="inp-settings">
      <div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
          <b>掌心的它 · In Your Palm</b>
          <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
          <div class="inp-settings-body">
            <small>
              一个囚禁情境控制台扩展。载入喜欢的角色卡后，点击顶栏的"掌心"图标打开控制台，开启一局囚禁叙事。
            </small>
            
            <hr>
            
            <label class="checkbox_label">
              <input id="inp_enabled" type="checkbox" ${settings.enabled ? 'checked' : ''}>
              <span>启用扩展</span>
            </label>
            
            <label class="checkbox_label">
              <input id="inp_auto_send" type="checkbox" ${settings.autoSendPrompts ? 'checked' : ''}>
              <span>动作自动发送到对话（关闭则只显示在调试区）</span>
            </label>
            
            <hr>
            
            <div class="flex-container">
              <div class="flex1">
                <label for="inp_theme_select">默认主题</label>
                <select id="inp_theme_select" class="text_pole">
                  <option value="theme-noir" ${settings.theme === 'theme-noir' ? 'selected' : ''}>暗黑监控 noir</option>
                  <option value="theme-ornate" ${settings.theme === 'theme-ornate' ? 'selected' : ''}>暗金奢华 ornate</option>
                  <option value="theme-raw" ${settings.theme === 'theme-raw' ? 'selected' : ''}>粗粝铁锈 raw</option>
                </select>
              </div>
            </div>
            
            <hr>
            
            <div class="flex-container">
              <div class="menu_button" id="inp_import_lorebook">
                <i class="fa-solid fa-book"></i>
                <span>导入 Lorebook 规则到当前角色</span>
              </div>
              <div class="menu_button" id="inp_open_console">
                <i class="fa-solid fa-hand"></i>
                <span>打开控制台</span>
              </div>
            </div>
            
            <small class="inp-hint">
              导入 Lorebook 会把 22 条叙事规则添加到当前角色的世界书。如果当前角色已有同名规则会跳过。
            </small>
            
            <hr>
            
            <small>
              版本: ${VERSION} · 
              <a href="https://github.com/CeciliaLeander/in_your_palm" target="_blank">GitHub</a>
            </small>
          </div>
        </div>
      </div>
    </div>
  `;
  
  $('#extensions_settings2').append(settingsHtml);
  
  $('#inp_enabled').on('change', function () {
    extension_settings[EXTENSION_NAME].enabled = $(this).prop('checked');
    saveSettingsDebounced();
  });
  
  $('#inp_auto_send').on('change', function () {
    extension_settings[EXTENSION_NAME].autoSendPrompts = $(this).prop('checked');
    saveSettingsDebounced();
  });
  
  $('#inp_theme_select').on('change', function () {
    extension_settings[EXTENSION_NAME].theme = $(this).val();
    saveSettingsDebounced();
  });
  
  $('#inp_import_lorebook').on('click', importLorebookToCurrentChar);
  $('#inp_open_console').on('click', openConsole);
}

// ============================================================
// 顶栏按钮注入
// ============================================================

function injectOpenConsoleButton() {
  const buttonHtml = `
    <div id="inp_topbar_button" class="fa-solid fa-hand interactable" 
         title="掌心的它 · 打开囚禁控制台"
         tabindex="0"></div>
  `;
  
  const injected = 
    $('#send_but_sheld').before(buttonHtml).length ||
    $('#leftSendForm').prepend(buttonHtml).length ||
    $('body').append(`
      <div id="inp_floating_button" class="inp-floating" title="掌心的它">
        <i class="fa-solid fa-hand"></i>
      </div>
    `);
  
  $('#inp_topbar_button, #inp_floating_button').on('click', openConsole);
}

// ============================================================
// 打开控制台
// ============================================================

let consoleInjected = false;

async function openConsole() {
  try {
    if (consoleInjected) {
      if (window.InPalmConsole?.init) {
        const settings = extension_settings[EXTENSION_NAME];
        window.InPalmConsole.init({
          theme: settings.theme,
          autoSend: settings.autoSendPrompts,
          onActionPrompt: sendActionPromptToChat,
        });
      } else if (window.InPalmDrawer) {
        window.InPalmDrawer.toggle();
      }
      return;
    }
    
    if (!window.InPalmEngine) {
      alert('引擎未加载。请刷新酒馆后重试。');
      return;
    }
    
    const templateUrl = `/scripts/extensions/${EXTENSION_FOLDER_NAME}/templates/console.html`;
    const response = await fetch(templateUrl);
    
    if (!response.ok) {
      throw new Error(`模板加载失败: HTTP ${response.status}`);
    }
    
    const rawHtml = await response.text();
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, 'text/html');
    
    doc.querySelectorAll('style').forEach(styleEl => {
      const newStyle = document.createElement('style');
      newStyle.setAttribute('data-inp', '1');
      newStyle.textContent = styleEl.textContent;
      document.head.appendChild(newStyle);
    });
    
    doc.body.childNodes.forEach(node => {
      if (node.nodeType === 1 && node.tagName !== 'SCRIPT' && node.tagName !== 'STYLE') {
        document.body.appendChild(document.importNode(node, true));
      }
    });
    
    doc.querySelectorAll('script').forEach(scriptEl => {
      try {
        const newScript = document.createElement('script');
        newScript.setAttribute('data-inp', '1');
        newScript.textContent = scriptEl.textContent;
        document.head.appendChild(newScript);
      } catch (err) {
        console.error('[掌心的它] 模板中的脚本执行失败:', err);
      }
    });
    
    consoleInjected = true;
    
    if (typeof window.InPalmConsole?.init === 'function') {
      const settings = extension_settings[EXTENSION_NAME];
      window.InPalmConsole.init({
        theme: settings.theme,
        autoSend: settings.autoSendPrompts,
        onActionPrompt: sendActionPromptToChat,
      });
      console.log('[掌心的它] 控制台已注入并初始化');
    } else {
      console.warn('[掌心的它] InPalmConsole 未就绪');
    }
  } catch (err) {
    console.error('[掌心的它] 打开控制台失败:', err);
    alert(`打开控制台失败: ${err.message}\n\n详情请查看浏览器控制台。`);
  }
}

function closeConsole() {
  if (window.InPalmDrawer) {
    window.InPalmDrawer.close();
  }
}

// ============================================================
// 发送动作 prompt 到酒馆对话
// ============================================================

/**
 * 查引擎里的库，返回中文显示名
 * 双保险：先查 InPalmEngine.XXX，再查 window.XXX
 */
function lookupName(triggerType, triggerId) {
  const eng = window.InPalmEngine || {};
  
  const tryGet = (libName, id) => {
    const lib = eng[libName] || window[libName];
    if (lib && lib[id] && lib[id].name) return lib[id].name;
    return null;
  };
  
  if (triggerType === 'action') {
    return tryGet('ACTION_LIBRARY', triggerId)
      || tryGet('TRAINING_ACTIONS', triggerId)
      || tryGet('CUSTOM_TEMPLATES', triggerId)
      || triggerId;
  }
  if (triggerType === 'scene') {
    return tryGet('SCENE_LIBRARY', triggerId) || triggerId;
  }
  if (triggerType === 'dialogue_start') {
    return tryGet('DIALOGUE_CUES', triggerId)
      || tryGet('DIALOGUES', triggerId)
      || triggerId;
  }
  return triggerId;
}

/**
 * 把引擎 packet 转为极简 prompt
 * 
 * 格式示例：
 *   [Day 1 20:00·震惊期]
 *   动作:训练坐姿
 *   [叙事] 模式:线下近距接触...
 * 
 * 原则：
 * - 只描述客观事实（时间 + 动作 + 事件）
 * - 叙事提示只描述"镜头/视角/景别"，不预设 char 的反应与心情
 * - 数值变化不进 prompt（玩家看抽屉）
 * - 动作名用中文
 */
function buildPromptFromPacket(packet) {
  if (!packet || !packet.trigger) return '';
  
  const lines = [];
  
  // 第一行：时间 + 阶段
  const hour = String(packet.time.hour).padStart(2, '0');
  const stageName = packet.time.stageName || packet.time.stage;
  lines.push(`[Day ${packet.time.day} ${hour}:00·${stageName}]`);
  
  // 第二行：动作（中文名）
  const t = packet.trigger;
  
  if (t.triggerType === 'action') {
    const name = lookupName('action', t.triggerId);
    lines.push(`动作:${name}`);
  } else if (t.triggerType === 'custom_action') {
    const desc = t.customDescription || '自定义动作';
    lines.push(`动作:${desc}`);
  } else if (t.triggerType === 'scene') {
    const name = lookupName('scene', t.triggerId);
    lines.push(`前往:${name}`);
    if (t.riskEvent) {
      const riskName = t.riskEvent.name || t.riskEvent.id || '';
      if (riskName) lines.push(`事件:${riskName}`);
    }
  } else if (t.triggerType === 'dialogue_start') {
    const name = lookupName('dialogue_start', t.triggerId);
    lines.push(`开启对话:${name}`);
  } else if (t.triggerType === 'end') {
    lines.push('动作:结束本局');
  }
  
  // 叙事镜头提示（仅在 hint 存在时加入）
  const hint = packet.meta?.narrationHint;
  if (hint) {
    lines.push(`[叙事] ${hint}`);
  }
  
  return lines.join('\n');
}

async function sendActionPromptToChat(packet) {
  if (!packet) return;
  
  const settings = extension_settings[EXTENSION_NAME];
  if (!settings.autoSendPrompts) {
    console.log('[掌心的它] autoSend 关闭，packet 仅记录不发送:', packet);
    return;
  }
  
  const prompt = buildPromptFromPacket(packet);
  if (!prompt) return;
  
  try {
    const context = getContext();
    
    if (context.executeSlashCommandsWithOptions) {
      // 用 /send 作为 user 消息发送，AI 会把它当作玩家发言自然回应
      await context.executeSlashCommandsWithOptions(
        `/send ${escapeCommandString(prompt)}`
      );
      console.log('[掌心的它] 已作为 user 消息发送 prompt:', prompt);
    } else {
      console.warn('[掌心的它] 酒馆 API 不支持 slash command，prompt 未发送');
    }
  } catch (err) {
    console.error('[掌心的它] 发送 prompt 失败:', err);
  }
}

function escapeCommandString(s) {
  // slash 命令里需要转义管道符和换行
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

// ============================================================
// 导入 Lorebook 到当前角色
// ============================================================

async function importLorebookToCurrentChar() {
  if (!lorebookData) {
    alert('Lorebook 数据未加载。请刷新后重试。');
    return;
  }
  
  try {
    const context = getContext();
    const characterId = context.characterId;
    
    if (characterId === undefined || characterId === null) {
      alert('请先选择一个角色。');
      return;
    }
    
    const lorebookName = `In Your Palm Core`;
    
    const confirmed = confirm(
      `将把 22 条"掌心的它"叙事规则打包成一个 Lorebook，名为「${lorebookName}」。\n\n` +
      `导入后，请手动将此 Lorebook 绑定到当前角色（世界书面板 → 选择"${lorebookName}" → 绑定）。\n\n` +
      `继续吗？`
    );
    
    if (!confirmed) return;
    
    const payload = {
      entries: {}
    };
    
    lorebookData.entries.forEach((e, idx) => {
      payload.entries[idx] = {
        uid: e.uid || idx,
        key: e.key || [],
        keysecondary: [],
        comment: e.comment || '',
        content: e.content || '',
        constant: e.constant || false,
        selective: e.selective || false,
        order: e.order || 100,
        position: 0,
        disable: false,
      };
    });
    
    if (context.executeSlashCommandsWithOptions) {
      const jsonStr = JSON.stringify(payload).replace(/\|/g, '\\|').replace(/"/g, '\\"');
      await context.executeSlashCommandsWithOptions(
        `/world create ${lorebookName}`
      );
      alert(`✓ Lorebook 「${lorebookName}」已创建。请在角色的世界书面板中绑定它。`);
    } else {
      alert('当前酒馆版本不支持脚本 API 自动导入。\n请手动导入 lorebook/core_lorebook.json 文件。');
    }
  } catch (err) {
    console.error('[掌心的它] 导入 Lorebook 失败:', err);
    alert('导入失败，请查看控制台了解详情。');
  }
}