/*
  src/data/scenes.js —— 场景库
  
  扩展方法：直接在 SCENE_LIBRARY 对象下新增条目即可
  每个场景结构：
    {
      id, name, type: 'internal' | 'external',
      availableFor: ['*'] | ['身份ID', ...],
      durationHours: 消耗的游戏时长,
      itemsAvailable: [在此场景可购买的物品ID列表],
      riskEvents: [{ id, probability }, ...],
      narrativeHint: 供 AI 生成叙事的场景描写提示
    }
*/

const SCENE_LIBRARY = {
  // ---- 内部场景（家/密室相关） ----
  home_main: {
    id: 'home_main', name: '家 · 主房间', type: 'internal',
    availableFor: ['*'],
    durationHours: 0,
    narrativeHint: '玩家在家中的起居区域，可随时进入密室或操作监控'
  },
  cell_room: {
    id: 'cell_room', name: '密室', type: 'internal',
    availableFor: ['*'],
    durationHours: 2,
    narrativeHint: '玩家进入密室与 {{char}} 直接接触的场景'
  },
  surveillance: {
    id: 'surveillance', name: '监控室', type: 'internal',
    availableFor: ['*'],
    durationHours: 1,
    narrativeHint: '玩家通过监控远程观察 {{char}}'
  },
  
  // ---- 外部通用场景（所有身份可用） ----
  supermarket: {
    id: 'supermarket', name: '超市', type: 'external',
    availableFor: ['*'],
    durationHours: 1,
    itemsAvailable: ['food_basic', 'food_premium', 'cleaning', 'sedative_otc', 'clothing_basic'],
    riskEvents: [
      { id: 'meet_acquaintance', probability: 0.05 },
      { id: 'surveillance_check', probability: 0.02 },
      { id: 'suspicious_purchase', probability: 0.08 }
    ],
    narrativeHint: '玩家采购日常物资的场景。AI 应描写货架、人流、结账，以及玩家内心关于 {{char}} 的思绪'
  },
  pharmacy: {
    id: 'pharmacy', name: '药店', type: 'external',
    availableFor: ['*'],
    durationHours: 0.5,
    itemsAvailable: ['medicine_basic', 'bandage', 'sedative_otc', 'painkiller'],
    riskEvents: [
      { id: 'pharmacist_question', probability: 0.15 },
      { id: 'prescription_required', probability: 0.10 }
    ],
    narrativeHint: '药店。药剂师可能盘问用途。AI 描写紧张氛围'
  },
  street: {
    id: 'street', name: '街道', type: 'external',
    availableFor: ['*'],
    durationHours: 0.5,
    itemsAvailable: [],
    riskEvents: [
      { id: 'stranger_gaze', probability: 0.08 },
      { id: 'police_patrol', probability: 0.03 },
      { id: 'missing_poster', probability: 0.05 }
    ],
    narrativeHint: '玩家行走在街道上。可能瞥见 {{char}} 相关信息（寻人启事、警察、熟人）'
  },
  cafe: {
    id: 'cafe', name: '咖啡厅', type: 'external',
    availableFor: ['*'],
    durationHours: 1.5,
    itemsAvailable: ['food_premium'],
    riskEvents: [
      { id: 'stranger_approach', probability: 0.10 },
      { id: 'overheard_conversation', probability: 0.08 }
    ],
    narrativeHint: '咖啡厅，玩家独处的短暂时刻，常触发内心独白'
  },
  
  // ==========================================================
  // 身份限定场景
  // ==========================================================
  
  // ---- 学生身份独有 ----
  school_class: {
    id: 'school_class', name: '学校 · 教室', type: 'external',
    availableFor: ['student'],
    durationHours: 6,
    itemsAvailable: [],
    riskEvents: [
      { id: 'meet_acquaintance', probability: 0.20 },
      { id: 'stranger_gaze', probability: 0.08 }
    ],
    narrativeHint: '玩家在课堂上。表面在听课，脑中却在反复推演密室里的 {{char}}。同学的喧闹与心中的秘密形成强烈反差。'
  },
  school_library: {
    id: 'school_library', name: '图书馆', type: 'external',
    availableFor: ['student'],
    durationHours: 2,
    itemsAvailable: [],
    riskEvents: [
      { id: 'overheard_conversation', probability: 0.06 }
    ],
    narrativeHint: '安静的图书馆。玩家在查资料（关于药物？心理学？地下室建造？）或单纯逃避人群。书页翻动的声音与内心的喧嚣形成对比。'
  },
  dorm_room: {
    id: 'dorm_room', name: '学生宿舍', type: 'external',
    availableFor: ['student'],
    durationHours: 3,
    itemsAvailable: [],
    riskEvents: [
      { id: 'roommate_suspicion', probability: 0.10 },
      { id: 'meet_acquaintance', probability: 0.05 }
    ],
    narrativeHint: '宿舍房间。室友可能问起玩家最近的异常——总是独自出门、经常深夜不归、眼神奇怪。'
  },
  internet_cafe: {
    id: 'internet_cafe', name: '网吧', type: 'external',
    availableFor: ['student'],
    durationHours: 2,
    itemsAvailable: [],
    riskEvents: [
      { id: 'suspicious_search', probability: 0.12 }
    ],
    narrativeHint: '网吧。玩家用公共电脑搜索某些不想留下痕迹的内容——匿名论坛、加密技术、心理学论文、或其他关于 {{char}} 的信息。'
  },
  
  // ---- 上班族身份独有 ----
  office_work: {
    id: 'office_work', name: '办公室', type: 'external',
    availableFor: ['worker'],
    durationHours: 8,
    itemsAvailable: [],
    riskEvents: [
      { id: 'meet_acquaintance', probability: 0.15 },
      { id: 'boss_notice', probability: 0.08 },
      { id: 'overheard_conversation', probability: 0.08 }
    ],
    narrativeHint: '办公室的一天。玩家表面专注工作，心却不在焉。同事可能注意到玩家最近的变化——疲惫、分神、或反而异常投入工作（掩饰）。'
  },
  commute: {
    id: 'commute', name: '通勤路上', type: 'external',
    availableFor: ['worker'],
    durationHours: 1.5,
    itemsAvailable: [],
    riskEvents: [
      { id: 'stranger_gaze', probability: 0.06 },
      { id: 'missing_poster', probability: 0.08 },
      { id: 'police_patrol', probability: 0.03 }
    ],
    narrativeHint: '地铁/公交/开车的通勤时间。被挤压在陌生人中，玩家的思绪脱离现实，反复回到那个房间。可能瞥见关于 {{char}} 的新闻或寻人启事。'
  },
  coworker_dinner: {
    id: 'coworker_dinner', name: '同事聚餐', type: 'external',
    availableFor: ['worker'],
    durationHours: 3,
    itemsAvailable: ['food_premium'],
    riskEvents: [
      { id: 'meet_acquaintance', probability: 0.25 },
      { id: 'overheard_conversation', probability: 0.15 },
      { id: 'suspicious_purchase', probability: 0.05 }
    ],
    narrativeHint: '被迫参加的同事聚餐。玩家心里只想回家（回到那个房间）。酒精、闲聊、同事的半醉问话。最煎熬的是必须表现"正常"。'
  },
  
  // ---- 自由职业身份独有 ----
  cafe_work: {
    id: 'cafe_work', name: '咖啡厅（工作）', type: 'external',
    availableFor: ['freelancer'],
    durationHours: 4,
    itemsAvailable: ['food_premium'],
    riskEvents: [
      { id: 'stranger_gaze', probability: 0.08 },
      { id: 'overheard_conversation', probability: 0.10 }
    ],
    narrativeHint: '玩家在咖啡厅办公。屏幕上是工作文件，屏幕外是无法切断的思绪。偶尔抬头看见窗外的人流，那种奇异的抽离感。'
  },
  studio: {
    id: 'studio', name: '工作室', type: 'external',
    availableFor: ['freelancer'],
    durationHours: 5,
    itemsAvailable: [],
    riskEvents: [
      { id: 'stranger_approach', probability: 0.02 }
    ],
    narrativeHint: '玩家的工作室（另一个独立空间）。这里是玩家的"第二个家"，和密室所在地点分开。正是因为生活分区清晰，才能维持双重生活。'
  },
  client_meeting: {
    id: 'client_meeting', name: '约稿碰头', type: 'external',
    availableFor: ['freelancer'],
    durationHours: 2,
    itemsAvailable: [],
    riskEvents: [
      { id: 'stranger_approach', probability: 0.08 },
      { id: 'overheard_conversation', probability: 0.12 }
    ],
    narrativeHint: '和客户/编辑/合作方的面对面会议。需要表现专业、热情、可靠。玩家熟练地切换面具，但会议后的疲惫是双倍的。'
  }
};

// 身份-场景映射
// 用于开场菜单根据玩家选择的身份决定可用的外部场景
const IDENTITY_SCENES_MAP = {
  _common: ['home_main', 'cell_room', 'surveillance', 'supermarket', 'pharmacy', 'street', 'cafe'],
  student: {
    label: '学生',
    description: '在校学生（高中/大学）。相对零用钱、容易接近同龄 {{char}}、同学老师家长会成为风险源。',
    exclusive: ['school_class', 'school_library', 'dorm_room', 'internet_cafe']
  },
  worker: {
    label: '上班族',
    description: '公司职员或企业雇员。稳定收入、规律作息、同事熟人风险高。',
    exclusive: ['office_work', 'commute', 'coworker_dinner']
  },
  freelancer: {
    label: '自由职业',
    description: '作家/设计师/艺术家/程序员等。时间自由、独居合理、经济上可能有波动。',
    exclusive: ['cafe_work', 'studio', 'client_meeting']
  }
};
