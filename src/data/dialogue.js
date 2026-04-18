/*
  src/data/dialogue.js —— 对话切入点库
  
  11 种对话基调，玩家选择切入点后进入专用对话模式
  
  扩展方法：添加新条目到 DIALOGUE_ENTRIES
  切入点结构：
    {
      id, name, category: 'dialogue',
      mood: 基调标识（casual/pressure/intimidation/tender/vulnerable/degrading/...）,
      tone: 一句话描述基调,
      requiresCondition: { consciousness: [...] } (可选),
      requiresStats: { compliance: 40, ... } (可选，数值门槛),
      openingEffects: { char: { ... } } (进入对话时立即应用),
      prompt: 给 AI 的叙事指导
    }
*/

const DIALOGUE_ENTRIES = {
  small_talk: {
    id: 'small_talk', name: '闲聊', category: 'dialogue',
    mood: 'casual', tone: '刻意放松的日常话题',
    requiresCondition: { consciousness: ['awake', 'dazed'] },
    openingEffects: { char: { mood: +2, sanity: +2 } },
    prompt: '玩家以闲聊的方式开启对话——像在普通的日常中那样，问些日常问题（今天感觉怎么样、想吃什么、喜欢什么音乐）。关键的恐怖感来自于——这种正常话题放在囚禁情境下的错位。以 Dialogue 模式展开，突出 {{char}} 对这种\"假装日常\"的复杂反应。'
  },
  interrogation: {
    id: 'interrogation', name: '审讯', category: 'dialogue',
    mood: 'pressure', tone: '质问、威压、信息探取',
    requiresCondition: { consciousness: ['awake'] },
    openingEffects: { char: { sanity: -3, mood: -5, sincerity: +3 } },
    prompt: '玩家以审讯的姿态开启对话——要求 {{char}} 回答问题，不接受沉默。以 Dialogue 模式展开，营造心理压迫感。{{char}} 可能选择对抗、沉默、谎言、或真相——取决于他/她的性格与当前状态。'
  },
  threat: {
    id: 'threat', name: '威胁', category: 'dialogue',
    mood: 'intimidation', tone: '明示或暗示的恐吓',
    requiresCondition: { consciousness: ['awake'] },
    openingEffects: { char: { mood: -8, compliance: +4, sanity: -3 } },
    prompt: '玩家用威胁性的语言（直接或含蓄）开启对话。暗示能对 {{char}} 做什么、外面的某人现在处境如何、如果不配合会怎样。以 Dialogue 模式展开，重点描写 {{char}} 听到威胁时的微表情变化和身体反应。'
  },
  seduction: {
    id: 'seduction', name: '温柔诱导', category: 'dialogue',
    mood: 'tender', tone: '异常柔软、诱导式、病态温柔',
    requiresCondition: { consciousness: ['awake', 'dazed'] },
    openingEffects: { char: { mood: +3, sincerity: -2 }, state: { distortion: +3 } },
    prompt: '玩家以异常温柔的语气开启对话——表现得像真正关心 {{char}}，说甜言蜜语、嘘寒问暖、解释\"为什么这样做\"。关键恐怖感：这种温柔比粗暴更让 {{char}} 混乱。以 Dialogue 模式，重点描写 {{char}} 面对扭曲温柔时的矛盾反应。'
  },
  humiliation_talk: {
    id: 'humiliation_talk', name: '羞辱', category: 'dialogue',
    mood: 'degrading', tone: '贬低、嘲弄、侮辱',
    requiresCondition: { consciousness: ['awake'] },
    openingEffects: { char: { shame: +15, mood: -10, sincerity: +3 }, state: { distortion: +5 } },
    prompt: '玩家用羞辱性的语言——贬低、嘲讽、揭短、强调 {{char}} 的无力。以 Dialogue 模式展开，重点描写 {{char}} 听到时的屈辱反应——愤怒反抗、沉默承受、或内化——取决于性格。'
  },
  probe_past: {
    id: 'probe_past', name: '探问过去', category: 'dialogue',
    mood: 'invasive', tone: '刻意挖掘 {{char}} 的过去',
    requiresCondition: { consciousness: ['awake'] },
    openingEffects: { char: { sanity: -5, sincerity: +8, mood: -5 } },
    prompt: '玩家刻意询问 {{char}} 的过去——童年、创伤、秘密、不愿提起的人或事。玩家可能早已通过某些渠道了解（监视、资料收集），问题带着\"我知道\"的味道。以 Dialogue 模式展开，重点描写 {{char}} 被刺中要害时的反应。'
  },
  confession: {
    id: 'confession', name: '表白/坦白', category: 'dialogue',
    mood: 'vulnerable', tone: '玩家向 {{char}} 展示自己',
    requiresCondition: { consciousness: ['awake', 'dazed'] },
    openingEffects: { char: { sanity: -3, sincerity: +5, mood: +2 }, state: { distortion: +10 } },
    prompt: '玩家向 {{char}} 吐露某种自己的真相——为什么选择囚禁、玩家自己的过去、对 {{char}} 的真实情感。关键恐怖感：玩家的坦诚不会让情况变好，反而加深 {{char}} 的困境。以 Dialogue 模式，重点描写 {{char}} 听完后的复杂情绪。'
  },
  silence_sit: {
    id: 'silence_sit', name: '沉默陪伴', category: 'dialogue',
    mood: 'still', tone: '不说话，只是在场',
    requiresCondition: {},
    openingEffects: { char: { sanity: -3, mood: -3 }, state: { distortion: +5 } },
    prompt: '玩家进入房间，什么也不说，只是坐在那里看 {{char}}。持续的凝视比任何话都难受。以 Dialogue 模式（或介于 Dialogue 与 Observation 之间的静态模式），重点描写 {{char}} 在长时间无言注视下的心理变化——从恼怒到不安到试图打破沉默到最终的压抑。'
  },
  
  // 需要特定条件才能开启的对话类型
  check_in: {
    id: 'check_in', name: '关心询问', category: 'dialogue',
    mood: 'concerned', tone: '关怀式问候',
    requiresCondition: { consciousness: ['awake', 'dazed'] },
    requiresStats: { compliance: 40 },  // 需要基础的互动意愿
    openingEffects: { char: { mood: +5, sincerity: +5 } },
    prompt: '玩家询问 {{char}} 的身体感受、是否冷、是否饿、是否需要什么。关键：真心还是表演？{{char}} 也在判断。以 Dialogue 模式展开。'
  },
  praise: {
    id: 'praise', name: '夸奖', category: 'dialogue',
    mood: 'rewarding', tone: '赞美、肯定、表扬',
    requiresCondition: { consciousness: ['awake'] },
    requiresStats: { trained: 20 },
    openingEffects: { char: { mood: +8, trained: +5, sincerity: +3 }, state: { distortion: +3 } },
    prompt: '玩家对 {{char}} 最近的某个行为表示赞许——表现好、学得快、配合度高等。对 {{char}} 来说接受夸奖意味着什么？抗拒？窃喜？自我厌恶？以 Dialogue 模式展开。'
  },
  command: {
    id: 'command', name: '下达命令', category: 'dialogue',
    mood: 'authority', tone: '命令式',
    requiresCondition: { consciousness: ['awake'] },
    openingEffects: { char: { compliance: +5, sincerity: -3, trained: +3 } },
    prompt: '玩家下达一个具体的命令——要求 {{char}} 做某个动作、说某句话、以某种方式回应。{{char}} 的反应是拒绝、被迫服从、或条件反射式服从。以 Dialogue 模式展开。'
  }
};
