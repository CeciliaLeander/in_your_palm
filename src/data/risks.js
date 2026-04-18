/*
  src/data/risks.js —— 风险事件库
  
  外出场景时可能触发的事件（熟人、警察、目击者等）
  扩展方法：
    1. 添加新条目到 RISK_EVENT_LIBRARY
    2. 在 scenes.js 的某个外部场景里加入 { id: 'xxx', probability: 0.x }
  
  事件结构：
    {
      id, severity: 'low' | 'medium' | 'high',
      prompt: 给 AI 的叙事指导
    }
*/

const RISK_EVENT_LIBRARY = {
  meet_acquaintance: {
    id: 'meet_acquaintance', severity: 'medium',
    prompt: '在外出场景中，玩家遇到了一位熟人（同事/同学/邻居）。对方询问近况。以 Tension 模式描写玩家必须伪装正常的心跳加速时刻。'
  },
  surveillance_check: {
    id: 'surveillance_check', severity: 'low',
    prompt: '玩家感觉被监控摄像头注视。描写一瞬间的紧张。'
  },
  suspicious_purchase: {
    id: 'suspicious_purchase', severity: 'medium',
    prompt: '玩家的购买组合（例如大量食物+药品+清洁用品）引起收银员侧目。描写玩家的内心紧张与应对。'
  },
  pharmacist_question: {
    id: 'pharmacist_question', severity: 'medium',
    prompt: '药剂师盘问玩家购买某种药物的用途。以 Tension 模式描写玩家编造理由的过程。'
  },
  prescription_required: {
    id: 'prescription_required', severity: 'low',
    prompt: '玩家想买的药物需要处方，被拒绝。描写玩家的应对。'
  },
  stranger_gaze: {
    id: 'stranger_gaze', severity: 'low',
    prompt: '一个陌生人在街上长时间注视玩家。可能只是偶然，也可能不是。描写玩家的警觉。'
  },
  police_patrol: {
    id: 'police_patrol', severity: 'high',
    prompt: '玩家遇到警察巡逻。以 Tension 模式描写玩家必须保持镇定、避免可疑动作的过程。'
  },
  missing_poster: {
    id: 'missing_poster', severity: 'medium',
    prompt: '玩家看到街头的寻人启事（或许就是 {{char}} 的）。描写玩家看到时的内心反应。'
  },
  stranger_approach: {
    id: 'stranger_approach', severity: 'low',
    prompt: '咖啡厅里有陌生人主动搭话。描写这段短暂、不自在的互动。'
  },
  overheard_conversation: {
    id: 'overheard_conversation', severity: 'low',
    prompt: '玩家无意中听到附近桌的人谈论某个与 {{char}} 相关的话题。描写玩家的反应。'
  },
  
  // ---- 身份限定风险 ----
  roommate_suspicion: {
    id: 'roommate_suspicion', severity: 'medium',
    prompt: '室友/家人察觉了玩家的异常——归来时间奇怪、表情不对、经常心不在焉。描写这段尴尬的对话和玩家的应对。'
  },
  boss_notice: {
    id: 'boss_notice', severity: 'medium',
    prompt: '上司/领导注意到玩家最近的状态变化。可能是关心（效率下降？有什么困扰？）也可能是警觉（你最近在外面忙什么？）。描写这段正式又微妙的谈话。'
  },
  suspicious_search: {
    id: 'suspicious_search', severity: 'high',
    prompt: '玩家在公共电脑/网络上搜索了某些敏感内容。也许是下次登录时的某个警示、也许是某人路过看到屏幕的一瞥、也许只是玩家事后的不安。描写这种留下痕迹后的心理压力。'
  }
};
