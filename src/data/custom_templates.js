/*
  src/data/custom_templates.js —— 自定义动作的基础模板
  
  玩家自由输入动作描述时，选择一个类别；引擎根据类别应用基础数值变化。
  AI 会根据玩家的文字描述生成叙事，尊重玩家的创意。
  
  扩展方法：添加新模板到 CUSTOM_ACTION_TEMPLATES
  模板结构：
    {
      label: '显示给玩家看的名字',
      effects: { char: { ... }, state: { ... } },
      durationMinutes: 默认时长,
      requiresDepth: 'body' | 'r18' (可选)
    }
*/

const CUSTOM_ACTION_TEMPLATES = {
  touch_gentle:      { label: '温柔触碰', effects: { char: { mood: +1, sincerity: +1, arousal: +1, shame: +1 } }, durationMinutes: 10 },
  touch_rough:       { label: '粗暴接触', effects: { char: { mood: -3, sanity: -2, compliance: +2, shame: +4, health: -1 } }, durationMinutes: 10 },
  stimulation_mild:  { label: '轻度刺激', effects: { char: { arousal: +4, shame: +3, sanity: -1 } }, durationMinutes: 15, requiresDepth: 'body' },
  stimulation_heavy: { label: '强烈刺激', effects: { char: { arousal: +8, shame: +6, stamina: -4, sanity: -3 }, state: { distortion: +2 } }, durationMinutes: 25, requiresDepth: 'r18' },
  training_soft:     { label: '温和训练', effects: { char: { trained: +3, compliance: +2, mood: -1 } }, durationMinutes: 20 },
  training_harsh:    { label: '严苛训练', effects: { char: { trained: +5, compliance: +4, mood: -6, sanity: -3, shame: +5 }, state: { distortion: +3 } }, durationMinutes: 30 },
  verbal_sweet:      { label: '温柔言语', effects: { char: { mood: +1, sincerity: +1 } }, durationMinutes: 5 },
  verbal_harsh:      { label: '恶意言语', effects: { char: { mood: -5, sanity: -2, shame: +3, compliance: +1 } }, durationMinutes: 5 },
  punishment:        { label: '惩罚', effects: { char: { mood: -8, compliance: +5, sanity: -3, health: -3, shame: +6 }, state: { distortion: +4 } }, durationMinutes: 20 },
  reward:            { label: '奖励', effects: { char: { mood: +3, sincerity: +2, trained: +3, compliance: +2 } }, durationMinutes: 10 },
  observe:           { label: '观察（无接触）', effects: { char: { sanity: -1, shame: +2 } }, durationMinutes: 15 },
  neutral:           { label: '中性动作', effects: {}, durationMinutes: 10 }
};
