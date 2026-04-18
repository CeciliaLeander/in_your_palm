/*
  src/data/actions.js —— 基础动作库
  
  环境控制、递送、接触、特殊触发等类别的预定义动作
  不包括调教/训练类动作（那些在 training.js）
  
  扩展方法：添加新条目到 ACTION_LIBRARY
  动作结构：
    {
      id, name, category, durationMinutes,
      requiresItem: 'id' | ['id1', 'id2'] (可选),
      requiresCondition: { consciousness: [...], position: [...] } (可选),
      requiresDepth: 'body' | 'r18' (可选),
      effects: { char: { ... }, state: { ... } },
      prompt: 给 AI 的叙事指导
    }
*/

const ACTION_LIBRARY = {
  // ---- 环境控制 ----
  cut_lights: {
    id: 'cut_lights', name: '切断照明', category: 'environment', durationMinutes: 5,
    effects: { char: { sanity: -3, mood: -5, sleep: -10 } },
    prompt: '玩家切断了密室的照明。整个房间陷入黑暗。以 Observation 模式描写 {{char}} 在黑暗中的反应——呼吸变化、动作、内心独白。'
  },
  restore_lights: {
    id: 'restore_lights', name: '恢复照明', category: 'environment', durationMinutes: 5,
    effects: { char: { mood: +3 } },
    prompt: '玩家恢复了照明。描写 {{char}} 从黑暗到光明的瞬间反应。'
  },
  lower_temp: {
    id: 'lower_temp', name: '降低室温', category: 'environment', durationMinutes: 30,
    effects: { char: { stamina: -10, health: -5, compliance: +3 } },
    prompt: '玩家调低了密室温度至令人不适的低温。描写 {{char}} 身体的反应。'
  },
  play_audio: {
    id: 'play_audio', name: '播放音频', category: 'environment', durationMinutes: 60,
    effects: { char: { sanity: -8, mood: -5 } },
    prompt: '玩家在密室播放某种音频（白噪音/特殊音乐/循环声音）。以 Observation 模式描写 {{char}} 在长时间刺激下的心理状态变化。'
  },
  cut_water: {
    id: 'cut_water', name: '切断供水', category: 'environment', durationMinutes: 240,
    effects: { char: { health: -8, stamina: -15, compliance: +5 } },
    prompt: '玩家切断了密室供水。描写 {{char}} 逐渐意识到这件事后的反应。'
  },
  
  // ---- 递送 ----
  deliver_food_basic: {
    id: 'deliver_food_basic', name: '送入简单食物', category: 'deliver', durationMinutes: 10,
    requiresItem: 'food_basic',
    effects: { char: { hunger: -40, mood: -2 } },
    prompt: '玩家通过送物口送入了一份简单食物。以 Dialogue 或 Observation 模式描写 {{char}} 看到食物的反应——接受、拒绝、质疑。'
  },
  deliver_food_premium: {
    id: 'deliver_food_premium', name: '送入精致食物', category: 'deliver', durationMinutes: 15,
    requiresItem: 'food_premium',
    effects: { char: { hunger: -50, mood: +5, sincerity: +2 } },
    prompt: '玩家送入了一份精心准备的食物。描写 {{char}} 的反应——疑虑、感动、警惕，依据当前状态选择侧重。'
  },
  deliver_clothing: {
    id: 'deliver_clothing', name: '送入衣物', category: 'deliver', durationMinutes: 10,
    requiresItem: ['clothing_basic', 'clothing_special'],
    effects: {},
    prompt: '玩家送入了干净的衣物。描写 {{char}} 看到的反应，以及是否更换的细节。'
  },
  take_away_food: {
    id: 'take_away_food', name: '收走食物', category: 'deliver', durationMinutes: 5,
    effects: { char: { hunger: +10, mood: -8, compliance: -5 } },
    prompt: '玩家突然收走了 {{char}} 未吃完的食物。描写 {{char}} 的情绪反应。'
  },
  
  // ---- 接触 ----
  broadcast_message: {
    id: 'broadcast_message', name: '广播讯息', category: 'contact', durationMinutes: 30,
    effects: { char: { sanity: -3, mood: -3 } },
    prompt: '玩家通过扬声器对 {{char}} 说话（内容由玩家描述或 AI 根据当前剧情生成）。{{char}} 听不到玩家的脸，只能听到声音。以 Observation 模式描写 {{char}} 听到声音时的反应。'
  },
  enter_room: {
    id: 'enter_room', name: '进入密室', category: 'contact', durationMinutes: 60,
    effects: {},
    prompt: '玩家打开密室大门，进入 {{char}} 所在的空间。切换到 Dialogue 模式，描写两人面对面的瞬间、{{char}} 的身体语言、玩家看到的细节。'
  },
  letter_slot: {
    id: 'letter_slot', name: '递纸条', category: 'contact', durationMinutes: 5,
    effects: { char: { sanity: -2, sincerity: +3 } },
    prompt: '玩家通过缝隙递入了一张纸条（内容由玩家描述）。描写 {{char}} 发现、阅读、反应的过程。'
  },
  silence_day: {
    id: 'silence_day', name: '沉默一整天', category: 'contact', durationMinutes: 1440,
    effects: { char: { sanity: -12, mood: -15, sincerity: +8 } },
    prompt: '玩家一整天没有任何接触或回应。以 Observation 模式用多段短描写，展现 {{char}} 在无回应状态下从早到晚的心理变化（困惑→焦虑→恐惧→麻木）。'
  },
  
  // ---- 特殊触发 ----
  fake_rescue_signal: {
    id: 'fake_rescue_signal', name: '伪造救援信号', category: 'trigger', durationMinutes: 180,
    effects: { char: { sanity: -20, mood: -15, sincerity: +15 }, state: { distortion: +10 } },
    prompt: '玩家故意制造"有人来救援"的假象（脚步声、呼喊、警笛等）。描写 {{char}} 从听到声音的瞬间希望燃起，到最终意识到这是假象的心理崩塌过程。'
  },
  reveal_truth: {
    id: 'reveal_truth', name: '揭示某个真相', category: 'trigger', durationMinutes: 60,
    effects: { char: { sanity: -10, sincerity: +12, mood: -8 }, state: { distortion: +5 } },
    prompt: '玩家对 {{char}} 揭示某件真相（外面发生的事、关于 {{char}} 的某些信息、关于玩家自己的）。描写 {{char}} 接收信息时的反应。'
  },
  wait_24h: {
    id: 'wait_24h', name: '什么都不做 24 小时', category: 'trigger', durationMinutes: 1440,
    effects: { char: { sanity: -8, stamina: -10, hunger: +30 } },
    prompt: '玩家决定完全不干预 24 小时。以 Observation 模式生成一份"监控记录"式的日志，记录 {{char}} 在这 24 小时里自主的行为（可能包括：尝试逃脱、探索房间、情绪波动、睡眠、沉思等）。'
  },
  show_memento: {
    id: 'show_memento', name: '展示 {{char}} 的旧物', category: 'trigger', durationMinutes: 30,
    requiresItem: 'char_memento',
    effects: { char: { mood: -15, sincerity: +10, sanity: -8 }, state: { distortion: +15 } },
    prompt: '玩家向 {{char}} 展示一件他/她过去的物品。描写 {{char}} 认出物品时的强烈情感反应——不需要玩家多说什么，物品本身就是刀。'
  }
};
