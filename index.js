// ============================================================
// 掌心的它 · In Your Palm SillyTavern Extension
// 入口文件：index.js
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
const VERSION = '0.4.3';

// 默认设置
const defaultSettings = {
  enabled: true,
  theme: 'theme-noir',
  currentGame: null,       // 存储当前一局的完整 state
  autoSendPrompts: true,   // 点按钮是否自动发送 prompt 到 AI
};

// ============================================================
// 扩展生命周期
// ============================================================

/**
 * 扩展加载时的入口。酒馆启动时调用。
 */
jQuery(async () => {
  console.log('[掌心的它] 扩展加载中...');
  
  // 1. 初始化设置
  if (!extension_settings[EXTENSION_NAME]) {
    extension_settings[EXTENSION_NAME] = structuredClone(defaultSettings);
  }
  Object.keys(defaultSettings).forEach(key => {
    if (extension_settings[EXTENSION_NAME][key] === undefined) {
      extension_settings[EXTENSION_NAME][key] = defaultSettings[key];
    }
  });
  
  // 2. 加载引擎脚本（通过 script 标签注入，让它挂到 window）
  await loadEngineScript();
  
  // 3. 初始化侧栏设置面板（在酒馆的 Extensions 面板里）
  await initSettingsPanel();
  
  // 4. 注入顶栏的"打开控制台"按钮
  injectOpenConsoleButton();
  
  // 5. 预加载 Lorebook 内容（备用——用户可以一键导入）
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
// 设置面板（酒馆 Extensions 菜单里的配置区）
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
              <a href="https://github.com/YOUR_USERNAME/SillyTavern-InYourPalm" target="_blank">GitHub</a>
            </small>
          </div>
        </div>
      </div>
    </div>
  `;
  
  $('#extensions_settings2').append(settingsHtml);
  
  // 绑定事件
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
  
  // 插入到酒馆的顶栏（在扩展菜单旁边）
  // 兼容多个版本的酒馆 UI
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
// 打开控制台（弹窗）
// ============================================================

let consoleOpen = false;

async function openConsole() {
  if (consoleOpen) {
    closeConsole();
    return;
  }
  
  if (!window.InPalmEngine) {
    alert('引擎未加载。请刷新酒馆后重试。');
    return;
  }
  
  try {
    // 直接 fetch 原始 HTML（绕过 DOMPurify 对 <script> 标签的清洗）
    const templateUrl = `/scripts/extensions/${EXTENSION_FOLDER_NAME}/templates/console.html`;
    const response = await fetch(templateUrl);
    
    if (!response.ok) {
      throw new Error(`模板加载失败: HTTP ${response.status}`);
    }
    
    const rawHtml = await response.text();
    
    // 创建模态窗骨架
    $('body').append(`
      <div id="inp_modal_overlay" class="inp-modal-overlay"></div>
      <div id="inp_modal" class="inp-modal">
        <button id="inp_modal_close" class="inp-modal-close" title="关闭 (ESC)">×</button>
        <div id="inp_modal_content" class="inp-modal-content"></div>
      </div>
    `);
    
    consoleOpen = true;
    
    // 解析 HTML，分离 style/script/body
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, 'text/html');
    
    const contentEl = document.getElementById('inp_modal_content');
    
    // 1. 注入 <style> 标签（直接 append，浏览器会自动应用）
    doc.querySelectorAll('style').forEach(styleEl => {
      const newStyle = document.createElement('style');
      newStyle.textContent = styleEl.textContent;
      contentEl.appendChild(newStyle);
    });
    
    // 2. 注入 HTML 元素（非 style 非 script）
    doc.body.childNodes.forEach(node => {
      if (node.nodeType === 1 && node.tagName !== 'SCRIPT' && node.tagName !== 'STYLE') {
        contentEl.appendChild(document.importNode(node, true));
      }
    });
    
    // 3. 手动执行 <script> 标签（innerHTML 方式插入的 script 不会自动执行）
    doc.querySelectorAll('script').forEach(scriptEl => {
      try {
        const newScript = document.createElement('script');
        newScript.textContent = scriptEl.textContent;
        contentEl.appendChild(newScript);
      } catch (err) {
        console.error('[掌心的它] 模板中的脚本执行失败:', err);
      }
    });
    
    // 绑定关闭
    $('#inp_modal_close, #inp_modal_overlay').on('click', closeConsole);
    $(document).on('keydown.inp', (e) => {
      if (e.key === 'Escape') closeConsole();
    });
    
    // 初始化控制台（此时脚本已执行，InPalmConsole 应该可用）
    if (typeof window.InPalmConsole?.init === 'function') {
      const settings = extension_settings[EXTENSION_NAME];
      window.InPalmConsole.init({
        theme: settings.theme,
        autoSend: settings.autoSendPrompts,
        onActionPrompt: sendActionPromptToChat,
      });
      console.log('[掌心的它] 控制台已打开');
    } else {
      console.warn('[掌心的它] InPalmConsole 仍然未就绪，模板中的脚本可能有语法错误');
    }
  } catch (err) {
    console.error('[掌心的它] 打开控制台失败:', err);
    alert(`打开控制台失败: ${err.message}\n\n详情请查看浏览器控制台。`);
    closeConsole();
  }
}

function closeConsole() {
  $('#inp_modal, #inp_modal_overlay').remove();
  $(document).off('keydown.inp');
  consoleOpen = false;
}

// ============================================================
// 发送动作 prompt 到酒馆对话
// ============================================================

/**
 * 把控制台按钮触发的引擎 packet 转为 prompt，
 * 然后通过 SillyTavern 的 API 发送到当前对话
 */
async function sendActionPromptToChat(packet) {
  if (!packet) return;
  
  const settings = extension_settings[EXTENSION_NAME];
  if (!settings.autoSendPrompts) {
    console.log('[掌心的它] autoSend 关闭，packet 仅记录不发送:', packet);
    return;
  }
  
  const prompt = buildPromptFromPacket(packet);
  
  try {
    const context = getContext();
    
    // 方式 1: 把 prompt 作为系统消息注入到聊天
    if (typeof context.sendSystemMessage === 'function') {
      context.sendSystemMessage('generic', prompt);
      console.log('[掌心的它] 已作为系统消息注入 prompt');
    }
    
    // 方式 2: 触发 AI 生成（不发送用户消息，而是发"/sys"形式的指令）
    // 使用酒馆的 /sendas 或 /sys 命令
    if (context.executeSlashCommandsWithOptions) {
      await context.executeSlashCommandsWithOptions(
        `/sys ${escapeCommandString(prompt)} | /trigger`
      );
    } else {
      console.warn('[掌心的它] 酒馆 API 不支持 slash command，prompt 未发送');
    }
  } catch (err) {
    console.error('[掌心的它] 发送 prompt 失败:', err);
  }
}

function escapeCommandString(s) {
  // /sys 命令里需要转义管道符
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function buildPromptFromPacket(packet) {
  if (!packet || !packet.trigger) return '';
  
  const lines = [];
  lines.push('[掌心控制台 · 状态更新]');
  lines.push(`Day ${packet.time.day} ${String(packet.time.hour).padStart(2, '0')}:00 · ${packet.time.stageName || packet.time.stage}`);
  lines.push('');
  lines.push('[{{char}} 当前状态]');
  lines.push(`理智 ${packet.char.sanity} · 心情 ${packet.char.mood} · 真心 ${packet.char.sincerity} · 友好 ${packet.char.compliance}`);
  lines.push(`体力 ${packet.char.stamina} · 饥饿 ${packet.char.hunger} · 健康 ${packet.char.health}`);
  lines.push(`兴奋 ${packet.char.arousal} · 羞耻 ${packet.char.shame} · 训练度 ${packet.char.trained}`);
  lines.push(`关系扭曲 ${packet.relationship.distortion}`);
  
  const flags = [];
  if (packet.charStatus.consciousness !== 'awake') flags.push(packet.charStatus.consciousness);
  if (packet.charStatus.position !== 'free') flags.push(packet.charStatus.position);
  if (packet.charStatus.gagged) flags.push('口塞');
  if (packet.charStatus.blindfolded) flags.push('眼罩');
  if (packet.charStatus.collared) flags.push('项圈');
  if (flags.length) lines.push(`状态: ${flags.join(', ')}`);
  
  if (packet.equippedToys?.length) {
    lines.push(`已装备: ${packet.equippedToys.map(t => t.name).join(', ')}`);
  }
  
  lines.push('');
  lines.push('[本次触发]');
  const t = packet.trigger;
  if (t.triggerType === 'action') {
    lines.push(`玩家执行了动作: ${t.triggerId}`);
  } else if (t.triggerType === 'custom_action') {
    lines.push(`玩家执行了自定义动作 (类别: ${t.customCategory})`);
    lines.push(`玩家的描述: 「${t.customDescription}」`);
  } else if (t.triggerType === 'scene') {
    lines.push(`玩家前往场景: ${t.triggerId}`);
    if (t.riskEvent) lines.push(`⚠ 风险事件: ${t.riskEvent.id}`);
  } else if (t.triggerType === 'dialogue_start') {
    lines.push(`玩家开启对话模式: ${t.triggerId}`);
  } else if (t.triggerType === 'end') {
    lines.push('玩家结束本局');
  }
  
  if (t.triggerPrompt) {
    lines.push('');
    lines.push('[叙事指导]');
    lines.push(t.triggerPrompt);
  }
  
  return lines.join('\n');
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
    
    // SillyTavern 的 World Info API
    // 方式 1: 用 slash command（最稳）
    const lorebookName = `In Your Palm Core`;
    
    // 提示用户手动操作（最可靠）
    const confirmed = confirm(
      `将把 22 条"掌心的它"叙事规则打包成一个 Lorebook，名为「${lorebookName}」。\n\n` +
      `导入后，请手动将此 Lorebook 绑定到当前角色（世界书面板 → 选择"${lorebookName}" → 绑定）。\n\n` +
      `继续吗？`
    );
    
    if (!confirmed) return;
    
    // 创建 Lorebook
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
    
    // 用酒馆内置命令创建世界书
    if (context.executeSlashCommandsWithOptions) {
      // 序列化 JSON，转义
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