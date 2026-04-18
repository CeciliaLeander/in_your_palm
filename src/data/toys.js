/*
  src/data/toys.js —— 调教道具库（era 式分类）
  
  5 大分类：约束 restraint / 刺激 stimulation / 羞辱 humiliation / 训练 training / 护理 care
  
  扩展方法：添加新条目到 TOY_LIBRARY
  道具结构：
    {
      id, name, category, subcategory,
      price, description,
      requiresDepth: 'body' | 'r18' (可选，需要特定档位才能使用),
      equipEffect: { charStatus: { ...改变 {{char}} 物理状态 } } (可选),
      equipStats: { char: { ... }, state: { ... } } (装备时的效果),
      useStats: { char: { ... } } (使用时的效果)
    }
*/

const TOY_LIBRARY = {
  // ==== 约束类 restraint ====
  toy_handcuff_soft: {
    id: 'toy_handcuff_soft', name: '软质手铐', category: 'restraint', subcategory: 'wrist',
    price: 2, description: '柔软材质的腕部约束',
    equipEffect: { charStatus: { position: 'restrained_light' } },
    equipStats: { char: { compliance: +3, shame: +5 } }
  },
  toy_handcuff_metal: {
    id: 'toy_handcuff_metal', name: '金属手铐', category: 'restraint', subcategory: 'wrist',
    price: 4, description: '冰冷的金属腕铐，无法挣脱',
    equipEffect: { charStatus: { position: 'restrained_hard' } },
    equipStats: { char: { compliance: +8, sincerity: -5, shame: +10, health: -2 } }
  },
  toy_ankle_cuff: {
    id: 'toy_ankle_cuff', name: '脚踝束缚', category: 'restraint', subcategory: 'ankle',
    price: 3, description: '限制行动的脚踝链',
    equipStats: { char: { compliance: +5, shame: +8 } }
  },
  toy_rope_soft: {
    id: 'toy_rope_soft', name: '柔软绳索', category: 'restraint', subcategory: 'full',
    price: 2, description: '柔软但牢固的捆绑绳',
    equipEffect: { charStatus: { position: 'restrained_light' } },
    equipStats: { char: { compliance: +4, shame: +6 } }
  },
  toy_rope_decorative: {
    id: 'toy_rope_decorative', name: '装饰性绑绳', category: 'restraint', subcategory: 'artistic',
    price: 5, description: '带有审美感的日式绑缚用绳',
    equipEffect: { charStatus: { position: 'restrained_light' } },
    equipStats: { char: { compliance: +6, shame: +15, arousal: +5 }, state: { distortion: +5 } }
  },
  toy_chain_heavy: {
    id: 'toy_chain_heavy', name: '重型锁链', category: 'restraint', subcategory: 'full',
    price: 6, description: '厚重的金属锁链',
    equipEffect: { charStatus: { position: 'chained' } },
    equipStats: { char: { compliance: +12, sincerity: -8, mood: -10, shame: +12 }, state: { distortion: +8 } }
  },
  toy_collar_leather: {
    id: 'toy_collar_leather', name: '皮革项圈', category: 'restraint', subcategory: 'neck',
    price: 3, description: '带扣环的皮质项圈',
    equipEffect: { charStatus: { collared: true } },
    equipStats: { char: { compliance: +8, shame: +15, sincerity: -5 }, state: { distortion: +10 } }
  },
  toy_collar_leash: {
    id: 'toy_collar_leash', name: '项圈 + 牵绳', category: 'restraint', subcategory: 'neck',
    price: 5, description: '可牵引的项圈',
    equipEffect: { charStatus: { collared: true } },
    equipStats: { char: { compliance: +12, shame: +20, trained: +3 }, state: { distortion: +12 } }
  },
  toy_gag_ball: {
    id: 'toy_gag_ball', name: '口球', category: 'restraint', subcategory: 'mouth',
    price: 3, description: '限制发声的口塞',
    equipEffect: { charStatus: { gagged: true } },
    equipStats: { char: { compliance: +5, shame: +12, mood: -8 } }
  },
  toy_blindfold: {
    id: 'toy_blindfold', name: '眼罩', category: 'restraint', subcategory: 'eyes',
    price: 2, description: '遮蔽视线的眼罩',
    equipEffect: { charStatus: { blindfolded: true } },
    equipStats: { char: { sanity: -3, shame: +8, arousal: +3 } }
  },
  
  // ==== 刺激类 stimulation ====
  toy_vibrator_small: {
    id: 'toy_vibrator_small', name: '小型震动器', category: 'stimulation', subcategory: 'external',
    price: 3, description: '温和的外部刺激工具',
    requiresDepth: 'r18',
    useStats: { char: { arousal: +20, shame: +10, mood: -3 } }
  },
  toy_vibrator_strong: {
    id: 'toy_vibrator_strong', name: '强力震动器', category: 'stimulation', subcategory: 'external',
    price: 5, description: '高强度刺激',
    requiresDepth: 'r18',
    useStats: { char: { arousal: +35, shame: +15, sincerity: +5, stamina: -10 }, state: { distortion: +5 } }
  },
  toy_feather: {
    id: 'toy_feather', name: '羽毛', category: 'stimulation', subcategory: 'light',
    price: 1, description: '轻柔的触觉刺激',
    useStats: { char: { arousal: +8, shame: +5, mood: +3 } }
  },
  toy_ice: {
    id: 'toy_ice', name: '冰块', category: 'stimulation', subcategory: 'temperature',
    price: 1, description: '温度冲击',
    useStats: { char: { arousal: +10, shame: +8, stamina: -5 } }
  },
  toy_hot_wax: {
    id: 'toy_hot_wax', name: '低温蜡烛', category: 'stimulation', subcategory: 'temperature',
    price: 2, description: '低温蜡',
    requiresDepth: 'body',
    useStats: { char: { arousal: +12, shame: +10, health: -3 }, state: { distortion: +3 } }
  },
  toy_electro_mild: {
    id: 'toy_electro_mild', name: '轻度电击棒', category: 'stimulation', subcategory: 'intense',
    price: 6, description: '低电流刺激设备',
    requiresDepth: 'body',
    useStats: { char: { arousal: +15, compliance: +8, stamina: -8, health: -5, shame: +10 }, state: { distortion: +10 } }
  },
  
  // ==== 羞辱类 humiliation ====
  toy_mirror: {
    id: 'toy_mirror', name: '全身镜', category: 'humiliation', subcategory: 'visual',
    price: 3, description: '让 {{char}} 必须看到自己',
    equipStats: { char: { shame: +15, sincerity: +8, mood: -5 }, state: { distortion: +5 } }
  },
  toy_camera: {
    id: 'toy_camera', name: '相机', category: 'humiliation', subcategory: 'record',
    price: 4, description: '记录每一个瞬间',
    useStats: { char: { shame: +20, sincerity: +5, mood: -8 }, state: { distortion: +8 } }
  },
  toy_special_clothing: {
    id: 'toy_special_clothing', name: '特殊服装', category: 'humiliation', subcategory: 'clothing',
    price: 5, description: '带有特殊意图的服装（制服/女仆装/人偶装/兽装等）',
    equipEffect: { charStatus: { clothed: 'custom' } },
    equipStats: { char: { shame: +25, compliance: +5, mood: -10 }, state: { distortion: +10 } }
  },
  toy_expose_clothing: {
    id: 'toy_expose_clothing', name: '暴露服装', category: 'humiliation', subcategory: 'clothing',
    price: 3, description: '羞耻感极强的衣物',
    requiresDepth: 'body',
    equipEffect: { charStatus: { clothed: 'minimal' } },
    equipStats: { char: { shame: +30, arousal: +5 }, state: { distortion: +5 } }
  },
  
  // ==== 训练类 training ====
  toy_counter: {
    id: 'toy_counter', name: '计数器', category: 'training', subcategory: 'tool',
    price: 2, description: '要求 {{char}} 报数的训练工具',
    useStats: { char: { trained: +5, shame: +10, compliance: +3 } }
  },
  toy_bell: {
    id: 'toy_bell', name: '铃铛', category: 'training', subcategory: 'tool',
    price: 1, description: '挂在项圈上的铃铛，让 {{char}} 的每个动作都有声音',
    equipEffect: {},
    equipStats: { char: { shame: +12, trained: +3 }, state: { distortion: +5 } }
  },
  toy_feeding_bowl: {
    id: 'toy_feeding_bowl', name: '专用食盆', category: 'training', subcategory: 'tool',
    price: 2, description: '要求 {{char}} 用特定方式进食',
    useStats: { char: { shame: +18, compliance: +5, trained: +8 }, state: { distortion: +8 } }
  },
  toy_command_whistle: {
    id: 'toy_command_whistle', name: '命令哨子', category: 'training', subcategory: 'signal',
    price: 2, description: '建立条件反射训练',
    useStats: { char: { trained: +6, compliance: +3, sanity: -2 } }
  },
  toy_reward: {
    id: 'toy_reward', name: '奖励物（糖果/小礼物）', category: 'training', subcategory: 'positive',
    price: 1, description: '正向训练奖励',
    useStats: { char: { trained: +4, compliance: +5, mood: +3, sincerity: +2 } }
  },
  
  // ==== 护理类 care ====
  toy_brush: {
    id: 'toy_brush', name: '梳子', category: 'care', subcategory: 'grooming',
    price: 1, description: '梳理 {{char}} 的头发',
    useStats: { char: { mood: +8, sincerity: +5, health: +2, trained: +2 } }
  },
  toy_bath_kit: {
    id: 'toy_bath_kit', name: '浴具套装', category: 'care', subcategory: 'hygiene',
    price: 4, description: '为 {{char}} 沐浴的工具',
    useStats: { char: { health: +15, mood: +10, shame: +8, sincerity: +5 } }
  },
  toy_lotion: {
    id: 'toy_lotion', name: '护肤乳液', category: 'care', subcategory: 'skin',
    price: 2, description: '涂抹护理',
    useStats: { char: { mood: +5, arousal: +3, sincerity: +3 } }
  },
  toy_feeding_by_hand: {
    id: 'toy_feeding_by_hand', name: '亲手喂食工具', category: 'care', subcategory: 'feeding',
    price: 2, description: '用勺子/手指/吸管亲自喂食',
    useStats: { char: { hunger: -30, mood: +5, sincerity: +8, shame: +10, trained: +5 } }
  }
};
