/*
  src/data/imprints.js —— 刻印系统定义
  
  刻印（Imprint）是 char 心理上的永久性深度创伤/固化标记。
  - 触发：由单次会话或累积 Palam / 珠 的异常情况激活
  - 不可逆：一旦烙上永久存在
  - 双向影响：既修改数值转化，也直接注入 AI prompt
  
  本文件包含两部分：
  1. IMPRINT_DEFINITIONS  —— 9 种刻印的完整定义
  2. IMPRINT_CATEGORIES   —— 分类元信息（UI 分色用，待 UI 阶段补齐视觉属性）
  
  设计规范来源：DESIGN_PART3A_imprints.md §4.1 ~ §4.6
  
  ============================================================
  数据结构约定（请在修改时严格遵守）
  ============================================================
  
  每个刻印条目的字段：
  
  {
    id:        字符串，与 key 一致
    name:      中文名
    category:  'resistance' | 'dissolution' | 'numbness' | 'dependence' | 'special'
    
    trigger: {
      type:      'single_session' | 'post_session' | 'post_juel_levelup' | 'pre_action'
      condition: (ctx) => boolean
                 其中 ctx 含：{ session, action, char, recentSessions, triggerSource, juelId, newLevel, ...}
                 引擎阶段 5 实现时会根据 type 准备对应字段。
    }
    
    modifiers: {
      sourceMultipliers?: { [sourceId]: number }
        对应 Part 1 §1.2 的 14 种 Source。乘数作用于 Source → Palam 的转化。
      palamMultipliers?: { [palamId]: number }
        对应 Part 1 §1.3 的 8 种 Palam。乘数作用于 Palam 本身的累积。
      statModifiers?: { [statId]: { cap?: number, flatDelta?: number } }
        对 ABL/生理值的直接修改（如 sanity 上限 -20）。
      specialEffects?: string[]
        引擎需要做特殊逻辑的效果标签。引擎阶段 5 实现对应的处理分支。
    }
    
    aiPrompt: string
      注入到 AI prompt 的"[刻印·XXX] ..."文本。
      含 {占位符} 的会在运行时由引擎替换（目前仅 phobic_rupture 有 {trigger_list}）。
    
    reversible: boolean   —— 目前全部为 false
    
    meta?: object         —— 任意额外数据（如 phobic_rupture 存 triggerSources）
  }
  
  ============================================================
  关于触发检查时机（trigger.type 的约定）
  ============================================================
  
  引擎在以下时机遍历所有 IMPRINT_DEFINITIONS，按 type 过滤后调用 condition：
  
  - 'single_session'      每次动作结算后
  - 'post_session'        会话结束时
  - 'post_juel_levelup'   珠晋级时
  - 'pre_action'          每个动作执行前
  
  参考 Part 3A §4.4.2。
*/

// ============================================================
// IMPRINT_DEFINITIONS —— 9 种刻印的完整定义
// ============================================================

const IMPRINT_DEFINITIONS = {
  
  // ==========================================
  // 抵抗类（resistance）
  // ==========================================
  
  rebound: {
    id: 'rebound',
    name: '反発刻印',
    category: 'resistance',
    trigger: {
      type: 'single_session',
      condition: (ctx) => {
        const sessionResistance = ctx.session?.palam?.resistance ?? 0;
        const actionResistanceSource = ctx.action?.sources?.resistance ?? 0;
        return sessionResistance >= 150 || actionResistanceSource >= 8;
      }
    },
    modifiers: {
      sourceMultipliers: {
        intimacy: 0.3     // 温柔接触的效果打折
      },
      palamMultipliers: {
        submission_palam: 0.5,
        resistance: 1.3   // 抵抗反而加剧
      }
    },
    aiPrompt: '[刻印·反発] char 曾在某次处境下遭受超出其承受上限的压迫，内在已形成针对 user 的硬化防御层。该 char 现在对任何"顺化"尝试的接受速度显著降低，抗拒反应在 user 面前会有意或无意地被放大表现。',
    reversible: false
  },
  
  defiance_stasis: {
    id: 'defiance_stasis',
    name: '抵抗固化刻印',
    category: 'resistance',
    trigger: {
      type: 'post_session',
      // 条件：反抗珠金级 + 最近 3 次会话都产生 resistance palam ≥ 50
      condition: (ctx) => {
        const resistJuelLevel = ctx.char?.juels?.resistance ?? 0;
        const hasGoldResistJuel = resistJuelLevel >= 450;  // 金级阈值见 Part 2 §3.3.2
        if (!hasGoldResistJuel) return false;
        
        const recent = ctx.recentSessions ?? [];
        if (recent.length < 3) return false;
        return recent.slice(-3).every(s => (s.palam?.resistance ?? 0) >= 50);
      }
    },
    modifiers: {
      palamMultipliers: {
        submission_palam: 0.7,
        distortion_palam: 0.6
        // 注意：intimacy 和 dependence 不受影响（char 仍可建立亲密）
      }
    },
    aiPrompt: '[刻印·抵抗固化] char 已形成稳定且不可瓦解的抵抗核心。该核心与表面行为独立存在——char 可能在行为上深度顺从，但其核心自我始终保持清醒和完整。user 能获得 char 的表面、身体、甚至情感，但永远无法获得 char 的核心认同。',
    reversible: false
  },
  
  // ==========================================
  // 崩解类（dissolution）
  // ==========================================
  
  dissolution: {
    id: 'dissolution',
    name: '崩坏刻印',
    category: 'dissolution',
    trigger: {
      type: 'post_juel_levelup',
      // 条件：扭曲珠金级以上 AND 空虚珠金级以上
      condition: (ctx) => {
        const distortion = ctx.char?.juels?.distortion ?? 0;
        const emptiness = ctx.char?.juels?.emptiness ?? 0;
        return distortion >= 400 && emptiness >= 600;  // 各自金级阈值
      }
    },
    modifiers: {
      sourceMultipliers: {
        disgust: 0.3,
        pain: 0.3
      },
      palamMultipliers: {
        resistance: 0.3  // 已无力真正抵抗
      },
      statModifiers: {
        sanity: { cap: -20 }  // sanity 上限降低 20
      },
      specialEffects: ['dissociation_20pct']  // 每次动作 20% 概率触发短暂解离
    },
    aiPrompt: '[刻印·崩坏] char 的心理结构已出现不可修复的断裂——扭曲的深度与精神的空虚同时达到临界，导致 char 的自我同一性松动。该 char 在意识清醒时仍能正常反应，但解离事件会自发发生：短暂的眼神涣散、对当下事件的非同步反应、自我指代的偏移（"我"与"ta"混用）。该状态在 user 面前尤其明显。',
    reversible: false
  },
  
  personality_fracture: {
    id: 'personality_fracture',
    name: '人格断裂刻印',
    category: 'dissolution',
    trigger: {
      type: 'post_juel_levelup',
      // 条件：扭曲珠金级以上 AND 反抗珠银级以上
      condition: (ctx) => {
        const distortion = ctx.char?.juels?.distortion ?? 0;
        const resistance = ctx.char?.juels?.resistance ?? 0;
        return distortion >= 400 && resistance >= 180;  // 扭曲金级 + 反抗银级
      }
    },
    modifiers: {
      specialEffects: [
        'sanity_double_volatility',   // sanity 波动速度 ×2
        'behavior_dual_state'          // AI 提示允许行为双重性不合理化
      ]
    },
    aiPrompt: '[刻印·人格断裂] char 的心理中同时存在深度扭曲的依附与完整的核心抵抗，两者以不连续的方式切换。该切换对 char 本人是不可觉察的——char 每次表现出其中一种状态时，都感觉那就是自己完整的状态。user 观察到的行为反复是真实的，但 char 不会承认或察觉这种反复。',
    reversible: false
  },
  
  // ==========================================
  // 麻木类（numbness）
  // ==========================================
  
  numbness: {
    id: 'numbness',
    name: '麻木刻印',
    category: 'numbness',
    trigger: {
      type: 'post_juel_levelup',
      // 条件：空虚珠达到金级
      condition: (ctx) => {
        const emptiness = ctx.char?.juels?.emptiness ?? 0;
        return emptiness >= 600;
      }
    },
    modifiers: {
      sourceMultipliers: {
        // 所有"心理类"source × 0.5 —— 按设计文档列表 + exposure
        // 参考 DESIGN_PART3A §4.3.5 + Cecilia 确认的 7 项范围
        shame: 0.5,
        terror: 0.5,
        humiliation: 0.5,
        exposure: 0.5,      // 补：麻木的人对被看也失去反应（Cecilia 确认）
        intimacy: 0.5,
        dependence: 0.5,
        submission: 0.5
        // pleasure_* 系列不受影响，身体仍会反应
      }
    },
    aiPrompt: '[刻印·麻木] char 的情感系统已大范围失活——不是被压抑，而是真正的功能性消退。该 char 能执行、能回应、能承受，但其主观体验已从"经历"退化为"观察"。user 对 char 的大部分心理刺激会被 char 以近乎冷漠的方式接收。仅身体层的反应仍保留完整。',
    reversible: false
  },
  
  body_detachment: {
    id: 'body_detachment',
    name: '身心剥离刻印',
    category: 'numbness',
    trigger: {
      type: 'post_juel_levelup',
      // 条件：欲望珠金级以上 AND 空虚珠金级以上
      condition: (ctx) => {
        const desire = ctx.char?.juels?.desire ?? 0;
        const emptiness = ctx.char?.juels?.emptiness ?? 0;
        return desire >= 1000 && emptiness >= 600;  // 欲望金级 + 空虚金级
      }
    },
    modifiers: {
      sourceMultipliers: {
        pleasure_c: 1.3,
        pleasure_v: 1.3,
        pleasure_a: 1.3,
        pleasure_b: 1.3
      },
      palamMultipliers: {
        distortion_palam: 0.4  // 不再形成真正的情感联结
      }
    },
    aiPrompt: '[刻印·身心剥离] char 的身体和意识已进入明确的分离状态——身体对 user 的刺激表现出快速、强烈、甚至主动的反应；但 char 的主观体验与这些身体反应脱钩，以冷漠的旁观者视角体验这一切。该 char 的身体已不属于 char 本人，而是作为一个独立的、对 user 响应的生理系统存在。',
    reversible: false
  },
  
  // ==========================================
  // 依赖类（dependence）
  // ==========================================
  
  cage_syndrome: {
    id: 'cage_syndrome',
    name: '笼性依赖刻印',
    category: 'dependence',
    trigger: {
      type: 'post_juel_levelup',
      // 条件：扭曲珠达到黑曜级
      condition: (ctx) => {
        const distortion = ctx.char?.juels?.distortion ?? 0;
        return distortion >= 1200;  // 扭曲黑曜级阈值
      }
    },
    modifiers: {
      sourceMultipliers: {
        intimacy: 1.3,
        dependence: 1.3
      },
      palamMultipliers: {
        resistance: 0.2  // 近乎无法抵抗
      },
      specialEffects: ['cage_return_reaction']  // 强制外出时触发"回笼反应"
    },
    aiPrompt: '[刻印·笼性依赖] char 已将囚禁空间本身内化为"安全"的象征，将外部世界识别为威胁。该 char 在空间之外会表现出明显的焦虑、迷失、甚至主动请求返回。user 作为笼子的持有者，已成为 char 安全感的唯一来源。这种依赖已深度到空间感官层——离开密室的具体气味、光线、声音也会触发 char 的不适。',
    reversible: false
  },
  
  obedience_lock: {
    id: 'obedience_lock',
    name: '服从锁刻印',
    category: 'dependence',
    trigger: {
      type: 'post_juel_levelup',
      // 条件：服从珠达到黑曜级
      condition: (ctx) => {
        const obedience = ctx.char?.juels?.obedience ?? 0;
        return obedience >= 1500;  // 服从黑曜级阈值
      }
    },
    modifiers: {
      palamMultipliers: {
        submission_palam: 0.3,  // 顶点后进一步累积近乎无意义
        resistance: 0.1          // 近乎不可能抵抗
      },
      specialEffects: ['functional_paralysis']  // 无指令时功能性瘫痪
    },
    aiPrompt: '[刻印·服从锁] char 已丧失"自主行动"的能力——不是被禁止，而是系统性的无法启动。该 char 在没有 user 指令时处于完全的被动状态，连生理需求的表达都需要 user 先询问。该 char 的所有行为都必须等待来自 user 的许可或指令。这是服从的极端固化。',
    reversible: false
  },
  
  // ==========================================
  // 特殊类（special）
  // ==========================================
  
  phobic_rupture: {
    id: 'phobic_rupture',
    name: '恐惧撕裂刻印',
    category: 'special',
    trigger: {
      type: 'pre_action',
      // 条件：char 装备了 phobic_trauma tag AND 对应触发源激活次数 ≥ 5
      // 引擎需要维护一个计数器 STATE.char.phobicTriggerCount[triggerId]
      condition: (ctx) => {
        const tags = ctx.char?.config?.persona?.tags ?? [];
        const phobicTag = tags.find(t => (typeof t === 'object' ? t.id : t) === 'phobic_trauma');
        if (!phobicTag) return false;
        
        const triggerSources = (typeof phobicTag === 'object') ? (phobicTag.triggers ?? []) : [];
        const counts = ctx.char?.phobicTriggerCount ?? {};
        return triggerSources.some(src => (counts[src] ?? 0) >= 5);
      }
    },
    modifiers: {
      statModifiers: {
        sanity: { flatDelta: -15 }  // 每次触发源激活时额外 -15 sanity
      },
      specialEffects: [
        'phobic_trigger_double',     // 原 phobic 触发效果翻倍
        'dissolution_fasttrack_1w'   // 1 周内触发 dissolution 条件直接烙印
      ]
    },
    // 动态 prompt：{trigger_list} 在注入时由引擎替换为 char 的具体触发源（如"血、海鲜腥味"）
    aiPrompt: '[刻印·恐惧撕裂] char 对 {trigger_list} 的创伤回避反应已从"回避"升级为"撕裂"——该刺激现在不仅引发恐慌，还会触发短暂的精神崩溃。user 若再次引入这些元素，char 会表现出近乎失控的极端反应。',
    reversible: false,
    meta: {
      hasDynamicPrompt: true,
      promptPlaceholders: ['trigger_list']  // 引擎替换时的占位符清单
    }
  }
};

// ============================================================
// IMPRINT_CATEGORIES —— 分类元信息
// ============================================================
/*
  每个刻印 category 字段指向这里。
  UI 颜色属性（noir / ornate / raw 主题下的具体色值）待 DESIGN_PART3B
  UI 阶段（阶段 6-7）补充。
*/

const IMPRINT_CATEGORIES = {
  resistance:  { id: 'resistance',  name: '抵抗类' },
  dissolution: { id: 'dissolution', name: '崩解类' },
  numbness:    { id: 'numbness',    name: '麻木类' },
  dependence:  { id: 'dependence',  name: '依赖类' },
  special:     { id: 'special',     name: '特殊类' }
};
