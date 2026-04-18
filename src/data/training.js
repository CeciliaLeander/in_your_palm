/*
  src/data/training.js —— 调教/训练动作库
  
  子类别：
  - training_equip: 装备/卸下道具
  - training: 训练（姿势、回应、进食方式等）
  - touch: 身体接触（抚摸、拥抱等）
  - bondage: 束缚操作
  - stimulation: 刺激（需要 body/r18 档位）
  - medical: 药物与医疗
  - state_change: 意识状态操作
  - care: 护理（由 care 类道具驱动的动作）
  
  扩展方法：添加新条目到 TRAINING_ACTIONS（结构同 actions.js）
  额外字段：
    requiresToy: 'toy_id' | ['id1','id2'] (需要已装备某个玩具),
    statusChange: { consciousness: '...' } (改变 {{char}} 物理状态)
*/

const TRAINING_ACTIONS = {
  // ==== 装备类动作（戴上/穿上道具） ====
  equip_toy: {
    id: 'equip_toy', name: '装备道具', category: 'training_equip', durationMinutes: 10,
    requiresToy: '*',
    prompt: '玩家为 {{char}} 装备某个道具。描写装备过程——{{char}} 的反应（抗拒、顺从、沉默）、身体接触的细节、装备后的身体感受。'
  },
  remove_toy: {
    id: 'remove_toy', name: '卸下道具', category: 'training_equip', durationMinutes: 5,
    prompt: '玩家为 {{char}} 卸下某个道具。描写卸下瞬间 {{char}} 的身心反应——释放感、某种奇怪的失落、或警觉。'
  },
  
  // ==== 基础训练动作 ====
  train_sit: {
    id: 'train_sit', name: '训练基本姿势', category: 'training', durationMinutes: 30,
    requiresCondition: { consciousness: ['awake'] },
    effects: { char: { trained: +5, shame: +12, compliance: +3, mood: -5 }, state: { distortion: +5 } },
    prompt: '玩家训练 {{char}} 以某种固定姿势坐/跪/站。这是基础的动物化训练——要求重复、保持、不动。以 Dialogue 模式展开，描写这段时间内 {{char}} 的身心消耗。'
  },
  train_response: {
    id: 'train_response', name: '训练回应', category: 'training', durationMinutes: 20,
    requiresCondition: { consciousness: ['awake'] },
    effects: { char: { trained: +6, compliance: +4, shame: +10 }, state: { distortion: +3 } },
    prompt: '玩家训练 {{char}} 对特定信号（名字、哨声、命令）做出预设回应。这是条件反射的建立。'
  },
  train_feeding: {
    id: 'train_feeding', name: '训练进食方式', category: 'training', durationMinutes: 30,
    requiresCondition: { consciousness: ['awake'] },
    effects: { char: { trained: +8, shame: +18, compliance: +6, hunger: -30 }, state: { distortion: +8 } },
    prompt: '玩家训练 {{char}} 以特定方式进食——从食盆、用手、或以某种姿势。这是最有效也最伤人的训练之一。{{char}} 的饥饿与羞耻在博弈。'
  },
  
  // ==== 身体接触动作（中等深度） ====
  touch_hair: {
    id: 'touch_hair', name: '抚摸头发', category: 'touch', durationMinutes: 10,
    requiresCondition: { consciousness: ['awake', 'dazed', 'asleep'] },
    effects: { char: { mood: +1, sincerity: +1, arousal: +1 } },
    prompt: '玩家抚摸 {{char}} 的头发。这是最温柔的动作——但在囚禁情境下，温柔本身就是扭曲。描写 {{char}} 对这个触碰的反应——僵硬、放松、或矛盾的舒适。重要：根据当前阶段，反应可能是厌恶（震惊期）、警惕（对抗期）、或微妙的默许（后期）。'
  },
  touch_face: {
    id: 'touch_face', name: '触摸脸庞', category: 'touch', durationMinutes: 10,
    requiresCondition: { consciousness: ['awake', 'dazed', 'asleep'] },
    effects: { char: { sincerity: +2, mood: +1, arousal: +2, shame: +2 } },
    prompt: '玩家触摸 {{char}} 的脸——指腹划过脸颊、下颌、唇。极近距离的动作，{{char}} 的呼吸变化、目光躲避、或对视的瞬间。早期阶段 {{char}} 可能试图避开或颤抖。'
  },
  hold_hand: {
    id: 'hold_hand', name: '牵/握手', category: 'touch', durationMinutes: 15,
    requiresCondition: { consciousness: ['awake', 'dazed'] },
    effects: { char: { mood: +2, sincerity: +2, compliance: +1 }, state: { distortion: +1 } },
    prompt: '玩家握住 {{char}} 的手。描写手掌接触的温度、{{char}} 是否挣扎或静止、两人之间的寂静。早期阶段抗拒可能很强。'
  },
  embrace: {
    id: 'embrace', name: '拥抱', category: 'touch', durationMinutes: 20,
    requiresCondition: { consciousness: ['awake', 'dazed'] },
    effects: { char: { mood: +3, sincerity: +3, arousal: +3, compliance: +2 }, state: { distortion: +3 } },
    prompt: '玩家拥抱 {{char}}。长时间的身体接触——{{char}} 能闻到玩家的气味、感受心跳。一切的矛盾在这个动作中达到顶峰。描写 {{char}} 从抗拒到放松到抗拒自己的放松的过程。'
  },
  brush_hair: {
    id: 'brush_hair', name: '梳头', category: 'care', durationMinutes: 20,
    requiresToy: 'toy_brush',
    requiresCondition: { consciousness: ['awake', 'dazed'] },
    effects: { char: { mood: +4, sincerity: +3, health: +1, trained: +2 } },
    prompt: '玩家用梳子为 {{char}} 梳头。这是最像"日常生活"的动作——但 {{char}} 不能动。描写这段时间的漫长、安静、以及 {{char}} 在梳子穿过头发的触感中的心理变化。早期阶段 {{char}} 可能感到极度不适和羞辱。'
  },
  
  // ==== 约束操作 ====
  bind_wrists: {
    id: 'bind_wrists', name: '束缚手腕', category: 'bondage', durationMinutes: 10,
    requiresToy: ['toy_handcuff_soft', 'toy_handcuff_metal', 'toy_rope_soft'],
    requiresCondition: { consciousness: ['awake', 'dazed', 'drugged'] },
    effects: { char: { compliance: +8, shame: +10, mood: -5 }, state: { distortion: +5 } },
    prompt: '玩家束缚 {{char}} 的手腕。描写束缚过程——{{char}} 是抗拒、顺从、还是已经习惯？束缚后身体的紧绷感。'
  },
  bind_full: {
    id: 'bind_full', name: '全身束缚', category: 'bondage', durationMinutes: 30,
    requiresToy: ['toy_rope_soft', 'toy_rope_decorative', 'toy_chain_heavy'],
    requiresCondition: { consciousness: ['awake', 'dazed', 'drugged'] },
    effects: { char: { compliance: +15, shame: +20, sincerity: -10, mood: -10 }, state: { distortion: +12 } },
    prompt: '玩家对 {{char}} 进行完整的束缚。整个过程——每一道绳索、每一次调整——都是漫长的仪式。描写 {{char}} 在这个过程中的心理剥离。'
  },
  
  // ==== 刺激动作（R18 档位） ====
  tease_light: {
    id: 'tease_light', name: '轻度挑逗', category: 'stimulation', durationMinutes: 20,
    requiresDepth: 'body',
    requiresCondition: { consciousness: ['awake', 'dazed'] },
    effects: { char: { arousal: +15, shame: +10, sincerity: +3 }, state: { distortion: +5 } },
    prompt: '玩家以非直接的方式挑逗 {{char}}——靠近、呼吸声、指尖划过、在敏感区域附近停留但不触碰。描写 {{char}} 身体的不自主反应与心理的抗拒之间的战争。'
  },
  stimulate_direct: {
    id: 'stimulate_direct', name: '直接刺激', category: 'stimulation', durationMinutes: 30,
    requiresDepth: 'r18',
    requiresCondition: { consciousness: ['awake', 'dazed'] },
    effects: { char: { arousal: +30, shame: +18, sincerity: +8, stamina: -10 }, state: { distortion: +8 } },
    prompt: '玩家对 {{char}} 进行直接的身体刺激（手、嘴、道具）。描写身体反应与心理拉扯的细节。{{char}} 的声音、动作、眼神变化。'
  },
  use_toy_stimulation: {
    id: 'use_toy_stimulation', name: '使用刺激道具', category: 'stimulation', durationMinutes: 25,
    requiresToy: ['toy_vibrator_small', 'toy_vibrator_strong', 'toy_feather', 'toy_ice', 'toy_hot_wax', 'toy_electro_mild'],
    requiresCondition: { consciousness: ['awake', 'dazed'] },
    effects: { char: { arousal: +25, shame: +15 }, state: { distortion: +5 } },
    prompt: '玩家使用道具对 {{char}} 进行刺激。根据道具类型（震动/羽毛/冰/热/电）描写不同的感官体验与 {{char}} 的反应。'
  },
  edge: {
    id: 'edge', name: '边缘控制', category: 'stimulation', durationMinutes: 45,
    requiresDepth: 'r18',
    requiresCondition: { consciousness: ['awake'] },
    effects: { char: { arousal: +40, shame: +20, sincerity: +15, sanity: -5, stamina: -15 }, state: { distortion: +10 } },
    prompt: '玩家反复让 {{char}} 接近高潮但不允许释放。这是心理与生理的双重折磨。描写长时间的拉扯——{{char}} 的请求、玩家的拒绝、身体的失控感。需要高水平的心理描写。'
  },
  
  // ==== 药物与意识控制 ====
  drug_sedative: {
    id: 'drug_sedative', name: '给予镇静剂', category: 'medical', durationMinutes: 15,
    requiresItem: ['sedative_otc', 'sedative_strong'],
    effects: { char: { sanity: -10, compliance: +15, sleep: -40, stamina: -15 }, state: { distortion: +5 } },
    statusChange: { consciousness: 'drugged' },
    prompt: '玩家给 {{char}} 使用镇静剂（通过食物/饮水/注射）。描写药效发作的过程——{{char}} 意识到被下药的瞬间、视野模糊、意志抵抗、最终滑入药效状态。'
  },
  
  // ==== 意识状态操作 ====
  wake_up: {
    id: 'wake_up', name: '唤醒 {{char}}', category: 'state_change', durationMinutes: 5,
    requiresCondition: { consciousness: ['asleep', 'dazed', 'drugged'] },
    effects: { char: { sleep: +5 } },
    statusChange: { consciousness: 'awake' },
    prompt: '玩家唤醒 {{char}}——摇晃、呼名、或其他方式。描写 {{char}} 从意识模糊到清醒的过程，以及意识到自己处境的瞬间（每一次醒来都是重新面对现实）。'
  },
  put_to_sleep: {
    id: 'put_to_sleep', name: '让 {{char}} 睡眠', category: 'state_change', durationMinutes: 480,
    requiresCondition: { consciousness: ['awake', 'dazed'] },
    effects: { char: { sleep: +60, stamina: +30, sanity: +5 } },
    statusChange: { consciousness: 'asleep' },
    prompt: '玩家要求/允许 {{char}} 睡眠。描写 {{char}} 努力入睡的过程——身体需要睡眠但环境让人警觉——最终沉入梦境。梦境可能出现（如果合适）。'
  }
};
