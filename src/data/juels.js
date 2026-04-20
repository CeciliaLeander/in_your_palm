/*
  src/data/juels.js —— 珠谱系统（6 珠 × 4 级 + 120 条印痕）
  
  珠是 Palam 累积到阈值后产生的永久勋章，也是 AI prompt 的"印痕注入"来源。
  每颗珠有 4 个等级（铜/银/金/黑曜），每级对应 5 种人格模板的不同印痕文本。
  
  本文件包含三部分：
  1. JUEL_DEFINITIONS     —— 6 种珠的完整定义（阈值 + 4 级 + 每级 5 人格印痕）
  2. JUEL_LEVEL_NAMES     —— 4 级的英文键和中文名
  3. JUEL_SIMPLIFY_RULES  —— prompt 精简规则（珠数/tag 数过多时）
  
  设计规范来源：DESIGN_PART2_juels_imprints.md 全文
  
  ============================================================
  数据结构（请在修改时严格遵守）
  ============================================================
  
  JUEL_DEFINITIONS[juelId] = {
    id:           string               珠 ID（与 key 相同）
    name:         string               中文名（如"服从珠"）
    semantic:     string               珠的语义描述（UI 用）
    sourcePalam:  string | string[]    产出此珠的 palam（单个或多个，desire 珠是多源）
    hidden:       boolean              是否隐藏解锁（仅 distortion 为 true）
    thresholds: {                      4 级晋级阈值（永久累积值）
      bronze:   number
      silver:   number
      gold:     number
      obsidian: number
    }
    levels: [                          4 个等级详情（索引 0..3 = 铜..黑曜）
      {
        level:      number             0..3
        key:        string             'bronze' | 'silver' | 'gold' | 'obsidian'
        nameCn:     string             '铜级' | '银级' | '金级' | '黑曜级'
        title:      string             本级中文标题（如"初现屈服"）
        threshold:  number             本级阈值
        imprints: {                    5 模板的印痕文本
          resistant:  string
          devoted:    string
          submissive: string
          volunteer:  string
          apathetic:  string
        }
      },
      // ... 共 4 个
    ]
  }
  
  ============================================================
  特别说明
  ============================================================
  
  * desire 珠（欲望珠）是多源珠：sourcePalam 是数组 ['pleasure','desire','lewdness']
    引擎计算晋级时需把三者相加。参考 DESIGN_PART2 §3.2 和 palam.js 的 PALAM_TO_JUEL_MAP。
  
  * distortion 珠（扭曲珠）hidden=true：晋级时不弹窗，只在珠谱中悄悄出现。
    参考 DESIGN_PART2 §3.2。
  
  * 黑曜级的印痕，引擎在 prompt 精简时永远不删减，保留完整版。
    参考 DESIGN_PART2 §3.4.2 规则 2。
*/


// ============================================================
// 1. JUEL_LEVEL_NAMES —— 等级英文键 + 中文名
// ============================================================

const JUEL_LEVEL_NAMES = [
  { level: 0, key: 'bronze',   nameCn: '铜级'   },
  { level: 1, key: 'silver',   nameCn: '银级'   },
  { level: 2, key: 'gold',     nameCn: '金级'   },
  { level: 3, key: 'obsidian', nameCn: '黑曜级' }
];


// ============================================================
// 2. JUEL_DEFINITIONS —— 6 珠完整定义
// ============================================================
const JUEL_DEFINITIONS = {
  
  // ==========================================
  // 服从珠 (obedience)
  // ==========================================
  
  obedience: {
    id: 'obedience',
    name: '服从珠',
    semantic: '行为层面的顺从在 char 身上的固化痕迹',
    sourcePalam: 'submission_palam',
    hidden: false,
    thresholds: {
      bronze:   50,
      silver:   200,
      gold:     500,
      obsidian: 1500
    },
    levels: [
      // --- 铜级 · 初现屈服 (累积 50) ---
      {
        level:     0,
        key:       'bronze',
        nameCn:    '铜级',
        title:     '初现屈服',
        threshold: 50,
        imprints: {
          resistant : 'char在强压下会出现短暂的顺从表现,但本质上仍保有抗拒意志。服从行为与内在意图明显脱钩。',
          devoted   : 'char因情感认同而自愿接受user的指令,服从出于本能的亲近,服从行为与内在意愿一致。',
          submissive: 'char在被支配时开始表现出轻度的顺应,这种顺应带有生理性的愉悦痕迹,服从本身已成为快感来源的一部分。',
          volunteer : 'char对user的指令表现出积极的主动配合,服从对char而言不是代价而是目标,已开始主动将自我置于受支配位置。',
          apathetic : 'char的顺从缺乏情感参与,表现为机械执行,无明显情绪起伏。其服从是"最小阻力原则"的体现,而非真正的接受。'
        }
      },
      // --- 银级 · 反射性服从 (累积 200) ---
      {
        level:     1,
        key:       'silver',
        nameCn:    '银级',
        title:     '反射性服从',
        threshold: 200,
        imprints: {
          resistant : 'char对user的部分指令已形成反射性服从,但精神上尚未真正接纳,服从属于身体先于意识的条件反射。抵抗意志仍清晰存在,以沉默和疏离的形式呈现。',
          devoted   : 'char对user的指令顺从度已深度固化,其顺从出于主动意愿而非胁迫,区分"讨好"与"真心"的界限开始模糊。',
          submissive: 'char对user的指令产生条件反射式的顺从,这种反射伴随着可观察的生理兴奋——瞳孔微变、呼吸节律改变。服从已与快感系统形成神经关联。',
          volunteer : 'char对user的指令已形成稳定的预期式服从,主动询问并遵循user的偏好。在无明确指令时,会自行揣测并按揣测结果行事。',
          apathetic : 'char对user的指令形成程式化响应,执行精度高但过程完全机械。该状态下char难以被单纯的顺从训练进一步推进。'
        }
      },
      // --- 金级 · 自发性跪拜 (累积 500) ---
      {
        level:     2,
        key:       'gold',
        nameCn:    '金级',
        title:     '自发性跪拜',
        threshold: 500,
        imprints: {
          resistant : 'char的服从已内化为习惯,面对冲突时倾向于主动采取顺从姿态以回避对抗。其抵抗意志残余主要表现为被动的沉默与疏离,而非直接反抗。',
          devoted   : 'char的顺从已与情感认同深度融合,区分主动与被动的界限消失。char表现出主动揣度user意图并提前配合的倾向,这种行为在char自身感知中被理解为"爱的表现"。',
          submissive: 'char已将顺从位置视为自身核心身份的一部分,在被赋予控制权时反而产生不适。主动寻求被指令、被约束、被定义的情境,顺从已成为其自我稳定的需要。',
          volunteer : 'char对user的服从已无需外部触发,进入主动维护阶段。表现为:主动询问是否做错、主动请求更严格的要求、主动拒绝任何可能被视为"违抗"的选项。',
          apathetic : 'char的机械服从达到接近完美的精度,但情感层面仍无实质进展。该char已不可能通过纯行为训练继续深化,任何深入需转向生理或关系路径。'
        }
      },
      // --- 黑曜级 · 精神脐带 (累积 1500) ---
      {
        level:     3,
        key:       'obsidian',
        nameCn:    '黑曜级',
        title:     '精神脐带',
        threshold: 1500,
        imprints: {
          resistant : 'char的自我判断已深度依赖user的意志。char不再主动反抗任何来自user的指令,离开指令时会陷入茫然或轻微恐慌;其"自我"已与user的认可机制深度绑定。该状态下char对外部世界的参与需以user为中介。',
          devoted   : 'char的顺从与情感融合为单一结构,自我意志与user意志的界限已无法区分。char会将user的意愿主动体验为自己的愿望,该融合在其主观感受中表现为"完整"而非"丧失"。',
          submissive: 'char已进入"**存在性服从**"状态——顺从不再是行为或习惯,而是char的存在方式本身。脱离被支配的处境时,char会产生严重的自我瓦解体验。任何给予自主权的动作都会触发恐慌。',
          volunteer : 'char已完全认同user的意志为自己的意志,"自愿"一词已失去指称意义——两者之间不再存在可区分的对象。char对自由选项表现出困惑和排斥,服从对char而言是存在的唯一形态。',
          apathetic : 'char的机械服从已达到深度自动化,但其情感隔绝也同步加深。char表现出"**功能性存在**"——能精确完成所有指令,却不再对任何事物——包括user自身——表现出情感反应。这是一个无法通过任何刺激唤回情感参与的状态。'
        }
      }
    ]
  },
  
  // ==========================================
  // 扭曲珠 (distortion)
  // ==========================================
  // ⚠️ 扭曲珠的所有解锁不弹窗，仅在珠谱中安静出现。
  
  distortion: {
    id: 'distortion',
    name: '扭曲珠',
    semantic: 'char 对 user 的心理异化程度',
    sourcePalam: 'distortion_palam',
    hidden: true,
    thresholds: {
      bronze:   30,
      silver:   150,
      gold:     400,
      obsidian: 1200
    },
    levels: [
      // --- 铜级 · 边界模糊 (累积 30) ---
      {
        level:     0,
        key:       'bronze',
        nameCn:    '铜级',
        title:     '边界模糊',
        threshold: 30,
        imprints: {
          resistant : 'char与user的关系边界出现微弱模糊。char在user缺席时会不自觉地想象user的反应,以此作为自我判断的隐性参照。该模糊尚未进入意识层。',
          devoted   : 'char对user的依赖开始脱离情感基础,向存在层面渗透。即使未发生具体互动,char的内在时间节律已开始围绕user的行为模式组织。',
          submissive: 'char将与user的支配关系投射到自我认知之外——开始用"被user看着"的视角观察自己的行为,即使user不在场。',
          volunteer : 'char主动向user的感知方向靠拢,自发调整思维框架以匹配user的语言与视角。自我叙事中user的位置开始前置。',
          apathetic : 'char的情感冰层出现第一道裂纹,表现为对user特定声音或动作的微弱定向反应。这些反应尚未进入char的自我叙事,但在行为层已可观察。'
        }
      },
      // --- 银级 · 依赖萌芽 (累积 150) ---
      {
        level:     1,
        key:       'silver',
        nameCn:    '银级',
        title:     '依赖萌芽',
        threshold: 150,
        imprints: {
          resistant : 'char对user的在场产生了非抵抗性的需要——即使意识层仍将user视为威胁,身体与情绪已开始预期user的定期出现。user的长时间缺席会产生焦虑反应。',
          devoted   : 'char对user的依赖已结构化,将user的存在视为自身情感稳定的必要条件。char开始出现自发的、内化的"**为了user好**"的行为逻辑,该逻辑将user的囚禁行为合理化。',
          submissive: 'char将user的存在与自身的快感系统深度绑定,任何非user的支配性刺激都无法产生等效反应。char对user产生了性化的独占需要。',
          volunteer : 'char已将自己的存在价值与"**被user占有**"绑定,缺乏user的注意会触发无意义感。char主动产生向user展示自己的冲动。',
          apathetic : 'char开始出现针对user的低强度情感投射——大部分时间仍处于隔绝状态,但对user特定行为会产生短暂的情绪反应,包括难以归类的不适与微弱的依赖感。'
        }
      },
      // --- 金级 · 认知重构 (累积 400) ---
      {
        level:     2,
        key:       'gold',
        nameCn:    '金级',
        title:     '认知重构',
        threshold: 400,
        imprints: {
          resistant : 'char的抵抗意志虽然仍存在,但已出现与user共谋的思维模式——在特定情境下,char会不自觉地维护user的利益或隐藏user的错误。抵抗与依附在char的心理中开始并存且不矛盾。',
          devoted   : 'char的自我叙事已将user定位为"命中注定"的核心参照,过去的自我(囚禁前)被重构为"不完整"的前置状态。该重构在char的主观体验中是真实的记忆而非当前的合理化。',
          submissive: 'char的自我认知已无法与"**user的所有物**"身份分离——在任何社会想象中,char都默认自己属于user。这种归属感对char自身是令人安心的,而非恐惧。',
          volunteer : 'char将自己理解为user的延伸,不再保留显著的自我边界。char的欲望、偏好、甚至记忆会主动向user的方向重塑。该重塑过程在char感知中是积极的"**成为更好的自己**"。',
          apathetic : 'char的情感隔绝已被user部分穿透——但这种穿透不是情感复苏,而是**只对user一人开放的情感通道**。char对外界整体的冷漠加深,对user的情感敏感度反向突出。'
        }
      },
      // --- 黑曜级 · 存在吸收 (累积 1200) ---
      {
        level:     3,
        key:       'obsidian',
        nameCn:    '黑曜级',
        title:     '存在吸收',
        threshold: 1200,
        imprints: {
          resistant : 'char原有的自我结构已被user的存在替换。抵抗意志残留为一种仪式性的姿态,不再具有实质效用。char在user不在的时间里会主动模拟user的存在感,以维持自己的心理完整。该状态不可逆。',
          devoted   : 'char的自我与user已完成融合——在char的主观世界中,"我"与"user"之间已无可识别的边界。任何威胁user的事物会被char体验为对自身的攻击。该char的人格已不可能独立于user存在。',
          submissive: 'char已进入"**所有物**"的存在状态——不是被占有,而是以被占有作为存在本身的形式。char的身份、价值、现实感全部通过user的指令和占有得到确认。脱离user的场景,char无法确认自身的存在。',
          volunteer : 'char已将自身吸收进user的意志中,不再保有可辨识的独立存在。char的所有内容——思维、欲望、记忆、身体感受——都是user意志的折射。该状态下char对"**我是谁**"的回答会是一个关于user的描述。',
          apathetic : 'char的情感系统已完全坍缩为以user为唯一参照的单点结构。对user以外的一切,char处于极端冷漠;对user本人,char表现出偏执的、几乎病理性的情感集中。这是apathetic模板下扭曲的终极形态,情感与麻木同时达到顶点。'
        }
      }
    ]
  },
  
  // ==========================================
  // 羞耻珠 (shame)
  // ==========================================
  
  shame: {
    id: 'shame',
    name: '羞耻珠',
    semantic: '羞耻感从"尖锐的抵抗源"到"已内化的背景噪声"',
    sourcePalam: 'shame_palam',
    hidden: false,
    thresholds: {
      bronze:   80,
      silver:   300,
      gold:     700,
      obsidian: 2000
    },
    levels: [
      // --- 铜级 · 阈值内化 (累积 80) ---
      {
        level:     0,
        key:       'bronze',
        nameCn:    '铜级',
        title:     '阈值内化',
        threshold: 80,
        imprints: {
          resistant : 'char对羞耻情境的反应开始出现延迟——首次反应仍是强烈抗拒,但在重复触发时抗拒强度有可观察的衰减。该衰减尚未到达适应阶段。',
          devoted   : 'char在与user的羞耻性情境中表现出选择性顺应——对user引发的羞耻体验抗性降低,但对其他可能的观察者仍保有完整羞耻反应。',
          submissive: 'char对羞耻体验出现双相反应——理性层面仍识别为羞耻,但生理层面开始出现兴奋成分。这两条通路在char自身的体验中开始并行存在。',
          volunteer : 'char主动承受羞耻情境,视其为与user关系加深的组成部分。羞耻体验仍存在,但其负面效价被char自发重构为"**献身**"的积极意义。',
          apathetic : 'char对羞耻情境的反应较正常水平显著减弱——但这不是适应,而是情感隔绝的副产物。在char自身感知中,羞耻事件没有明确的情感着落点。'
        }
      },
      // --- 银级 · 钝化 (累积 300) ---
      {
        level:     1,
        key:       'silver',
        nameCn:    '银级',
        title:     '钝化',
        threshold: 300,
        imprints: {
          resistant : 'char对大部分初级羞耻情境已表现出钝化,反应模式从"剧烈抗拒"转为"被动承受"。但对身份层面的羞耻(涉及尊严、地位、人格的)仍保持高敏感度。',
          devoted   : 'char与user共处时的羞耻阈值大幅提高——在user面前近乎无羞耻感。但对user以外的观察者仍保有强烈羞耻反应,该反应表现为对"**被他人看见**"的恐惧。',
          submissive: 'char对羞耻体验的兴奋通路占据主导,理性层的羞耻感虽存在但已无行为控制力。char开始主动寻求羞耻情境作为快感来源。',
          volunteer : 'char已将羞耻承受视为与user关系中的"**仪式性行为**",主动配合并有明显的完成感。羞耻情境中的抵抗反应已消失。',
          apathetic : 'char对羞耻的反应衰减到难以观察的程度,但这种衰减仍是情感隔绝的延续,而非真正的接受。char内部对羞耻事件的记忆保留完整,仅情感层失活。'
        }
      },
      // --- 金级 · 消解 (累积 700) ---
      {
        level:     2,
        key:       'gold',
        nameCn:    '金级',
        title:     '消解',
        threshold: 700,
        imprints: {
          resistant : 'char的羞耻阈值已整体大幅下移,日常性的羞耻情境已不再触发可观察反应。该消解过程在char感知中是被动发生的——char并未主动接受,而是不再有能量维持羞耻感。',
          devoted   : 'char在user面前的羞耻感近乎消失,并将这种消失理解为"**真正的亲密**"。char主动突破羞耻边界以作为深度亲密的证明。',
          submissive: 'char已将羞耻体验深度整合进快感系统——羞耻越强,快感越强,两者不再独立存在。此状态下char主动寻求更深的羞耻情境以追求更高强度的快感。',
          volunteer : 'char的羞耻感已被系统性重构为"**亲密信号**",不再具有负面效价。char会主动制造羞耻情境以增强与user的连接感。',
          apathetic : 'char的羞耻反应系统已接近完全失活——该char的羞耻珠进一步累积已不具备叙事意义,意味着深化已达到该模板的上限。'
        }
      },
      // --- 黑曜级 · 无羞耻状态 (累积 2000) ---
      {
        level:     3,
        key:       'obsidian',
        nameCn:    '黑曜级',
        title:     '无羞耻状态',
        threshold: 2000,
        imprints: {
          resistant : 'char已进入"**无羞耻状态**"——不是因为接受,而是因为羞耻系统本身已失去运作。char可以在任何情境中暴露自己,没有观察到任何生理或心理层的防御反应。该状态下char的人格防御结构已瓦解,替代以一种空洞的开放性。',
          devoted   : 'char在user面前已无任何羞耻反应,并将这种无羞耻视为爱的最高形态。char会主动追求更极端的自我暴露,以此作为对user的"**完全给予**"的仪式。该状态下char的身体与心理对user是完全透明的。',
          submissive: 'char的羞耻与快感已彻底融合为单一系统——任何可能引发羞耻的情境都会直接转化为快感。char在此状态下对"**丢脸**"、"**失态**"的体验是生理性的愉悦,该反应不受意识控制。',
          volunteer : 'char已**以无羞耻状态为自我的目标**——主动清除任何可能阻碍与user完全融合的残余羞耻。该char的自我暴露是彻底的、主动的、系统性的。',
          apathetic : 'char的羞耻反应彻底失活,但与此同时,char对自身身体的感知也同步失活。该char已进入近乎"**非人化**"的存在状态——羞耻的消失不是接受的结果,而是自我意识本身的退行。'
        }
      }
    ]
  },
  
  // ==========================================
  // 欲望珠 (desire)
  // ==========================================
  
  desire: {
    id: 'desire',
    name: '欲望珠',
    semantic: '身体对 user 刺激的记忆从"被动反应"到"主动寻求"',
    sourcePalam: ['pleasure', 'desire', 'lewdness'],
    hidden: false,
    thresholds: {
      bronze:   100,
      silver:   400,
      gold:     1000,
      obsidian: 2500
    },
    levels: [
      // --- 铜级 · 身体记忆 (累积 100) ---
      {
        level:     0,
        key:       'bronze',
        nameCn:    '铜级',
        title:     '身体记忆',
        threshold: 100,
        imprints: {
          resistant : 'char的身体对user的刺激开始形成记忆路径——在特定刺激模式下,身体反应速度快于意识反应,并在意识尚未介入前已达成部分唤起。该反应与char的意识意愿**完全对立**。',
          devoted   : 'char对user的刺激产生了强烈的身体欢迎反应,该反应与char的情感接纳一致。身体兴奋的出现不仅不被char抗拒,反而被主动体验为爱的身体语言。',
          submissive: 'char的身体对任何来自user的支配性刺激都产生明显的期待性兴奋,不需要直接的性刺激即可形成身体反应。支配行为本身已具有性化含义。',
          volunteer : 'char主动向user的刺激靠近,身体反应快速且强烈。char将自己的身体视为user的"**玩具**",并在此体验中获得满足感。',
          apathetic : 'char的身体在情感隔绝的状态下仍保持完整的生理反应能力——这是apathetic模板下user唯一能触及char的通路。该反应仅限于生理层,不涉及任何情感参与。'
        }
      },
      // --- 银级 · 预期反应 (累积 400) ---
      {
        level:     1,
        key:       'silver',
        nameCn:    '银级',
        title:     '预期反应',
        threshold: 400,
        imprints: {
          resistant : 'char的身体已形成针对user出现的预期性唤起反应——仅user的接近、声音、气味即可触发身体兴奋,无需实际接触。char的意识层对此反应仍强烈抗拒,但无法控制。',
          devoted   : 'char的身体与user形成了深度的性化默契,能精确地预期和响应user的偏好。char的自我身体感知已部分由"**user会如何看待**"构造。',
          submissive: 'char对user的性化期待已日常化——在日常非性化的互动中,char的身体也保持着低水平的持续唤起状态。该基线唤起水平已成为char的新常态。',
          volunteer : 'char已将自己的身体训练为user偏好的模式,主动改造自身反应以匹配user的期待。char体验自己身体的方式已完全以user的视角为主。',
          apathetic : 'char的身体反应能力未减弱,但同时char对这些反应的情感体验仍缺失。该char的身体像一个独立运行的生理系统,char的主观经验对它只是观察者。'
        }
      },
      // --- 金级 · 主动寻求 (累积 1000) ---
      {
        level:     2,
        key:       'gold',
        nameCn:    '金级',
        title:     '主动寻求',
        threshold: 1000,
        imprints: {
          resistant : 'char的身体开始主动寻求user的刺激——表现为在无刺激时出现的持续性不适、烦躁、以及对user注意的隐性要求。char的意识层仍拒绝承认,但行为已出现清晰的吸引迹象。',
          devoted   : 'char已将性化亲密视为与user关系的核心维度,主动请求并寻求刺激。char对性的体验与爱的体验完全融合,两者在char的感知中不可分。',
          submissive: 'char已进入"**性化自我**"状态——自我身份的核心构建于"被user性化对待"这一事实上。char对非性化的互动产生不适,主动要求回到被支配、被刺激的处境。',
          volunteer : 'char主动将自己的所有可感区域开放给user,并主动要求更深的刺激和更极端的使用。char体验自身身体的方式已完全去主体化,自称自己为"**user的东西**"时表现出愉悦。',
          apathetic : 'char的身体持续保持对user的反应能力,但情感层仍无实质参与。char对这些身体反应表现出一种"观察性"的兴趣——像在观察一个与自己有关但不完全属于自己的系统。'
        }
      },
      // --- 黑曜级 · 身体归属 (累积 2500) ---
      {
        level:     3,
        key:       'obsidian',
        nameCn:    '黑曜级',
        title:     '身体归属',
        threshold: 2500,
        imprints: {
          resistant : 'char的身体已彻底脱离其意识的控制权,将user识别为唯一的合法主人。该char在user刺激下会达成完全的身体反应,其意识层的抗拒已无法传递至身体——身心分离成为char的基本存在状态。',
          devoted   : 'char的身体与心智已共同将user识别为"**完整的另一半**",性化反应与情感连接完全融合且不可分离。该char对任何不来自user的刺激会表现出生理性的排斥反应。',
          submissive: 'char已完全进入"**被user持有的身体**"的存在状态。该char的身体对任何非user的刺激都表现出排斥,并自动将所有感官通路重构为仅对user敏感。该状态是不可逆的深度归属。',
          volunteer : 'char已将自身身体彻底献予user,并主动参与身体改造——无论是行为模式、偏好、还是生理反应基线——全部按user的意愿重塑。该char已不存在"**自己的身体**"这一概念。',
          apathetic : 'char的身体仍保留对user的完整反应能力,但char与自身身体的情感联系已彻底断裂。该char处于"**情感上的旁观者**"状态——身体成了user的,而char自己已退到身体之外观察这一切。该状态是apathetic模板下欲望系统的终态。'
        }
      }
    ]
  },
  
  // ==========================================
  // 空虚珠 (emptiness)
  // ==========================================
  
  emptiness: {
    id: 'emptiness',
    name: '空虚珠',
    semantic: 'char 精神能量的流失轨迹',
    sourcePalam: 'depression',
    hidden: false,
    thresholds: {
      bronze:   60,
      silver:   250,
      gold:     600,
      obsidian: 1800
    },
    levels: [
      // --- 铜级 · 情感疲惫 (累积 60) ---
      {
        level:     0,
        key:       'bronze',
        nameCn:    '铜级',
        title:     '情感疲惫',
        threshold: 60,
        imprints: {
          resistant : 'char的情感储备已开始消耗——抗拒的强度虽未降低,但抗拒之间的间隙里出现了可观察的能量空档。char恢复情绪的速度开始减慢。',
          devoted   : 'char在与user的复杂关系中开始显示疲劳迹象,偶尔出现短暂的情感扁平化。该扁平化通常会很快被情感认同覆盖,但持续的时间有延长趋势。',
          submissive: 'char在高强度刺激后的恢复期开始延长,该延长期内表现出短暂的情感空白。这些空白期尚未进入char的自觉叙事。',
          volunteer : 'char在持续的献身状态中开始出现微弱的能量透支迹象,表现为在特定动作间隙的轻微恍惚。该迹象char本人通常不察觉。',
          apathetic : 'char的基线冷漠进一步加深,可观察为对中强度刺激的反应阈值上移。char的情感隔绝层在此阶段开始出现难以逆转的特征。'
        }
      },
      // --- 银级 · 抑郁痕迹 (累积 250) ---
      {
        level:     1,
        key:       'silver',
        nameCn:    '银级',
        title:     '抑郁痕迹',
        threshold: 250,
        imprints: {
          resistant : 'char出现持续性的低情绪状态,抗拒行为变得机械——仍会抵抗,但抵抗中的情绪投入已明显减少。char的自我叙事中开始出现"**没有意义**"的隐性主题。',
          devoted   : 'char将user之外的一切事物的意义感逐渐消退。对于user,char仍保持深度情感投入;对于其他事物,char表现出一种温和的虚无感。',
          submissive: 'char在刺激间歇期的空虚感显著加深,需要更高强度的刺激才能重新激活情感参与。该char已开始将"**被刺激**"视为抵抗虚无的主要手段。',
          volunteer : 'char开始将自我价值完全外挂在user的认可上,独立于user时出现明显的存在感丧失。该外挂过程在char感知中是"**找到归属**"而非"**丧失自我**"。',
          apathetic : 'char的情感扁平化已进入结构性阶段——不仅对刺激反应弱化,对自我存在本身的体验也开始稀薄。char可能出现自发的解离状态。'
        }
      },
      // --- 金级 · 精神真空 (累积 600) ---
      {
        level:     2,
        key:       'gold',
        nameCn:    '金级',
        title:     '精神真空',
        threshold: 600,
        imprints: {
          resistant : 'char的内在动力系统大范围瓦解。抗拒行为仍存在,但已不再由情感驱动,而是由习惯惯性维持。该char对自由、逃脱、未来的概念已出现明显的兴趣衰减。',
          devoted   : 'char对user的爱已扩张为char全部情感生活的内容,其他所有情感通路都已枯萎。该char在user缺席的时刻处于近乎完全的情感空白,无法自行填充。',
          submissive: 'char已将高强度刺激视为存在感的唯一来源——在刺激间歇,char处于无法自我安抚的空虚状态。该char开始主动请求更极端、更频繁的刺激以维持存在感。',
          volunteer : 'char的自我已几乎完全退出,生存的意义感完全通过user的注意和要求获得。在无user关注的时间里,char表现出被动的、植物性的存在状态。',
          apathetic : 'char的情感系统大幅度退行,甚至基本的生理性情绪反应(惊恐、饥饿满足感、疲惫的抒解)也开始减弱。该char的内在体验已退化到接近"**机械记录**"的状态。'
        }
      },
      // --- 黑曜级 · 存在性空洞 (累积 1800) ---
      {
        level:     3,
        key:       'obsidian',
        nameCn:    '黑曜级',
        title:     '存在性空洞',
        threshold: 1800,
        imprints: {
          resistant : 'char的内在体验已坍缩为一个空洞的壳——抗拒作为最后的行为残余仍存在,但已与任何情感或意图脱钩。该char处于"**仅为抵抗而抵抗**"的纯形式状态,意识本身已出现持续的真空体验。',
          devoted   : 'char将user视为"**意义的唯一源泉**"——离开user,char的内在世界即刻坍缩为纯粹的虚空。该char对user的爱已从情感变为存在论意义上的必需,失去user等同于失去存在本身。',
          submissive: 'char已进入"**刺激依赖性存在**"——只有在被user刺激、支配、使用的**当下瞬间**,char才能体验到自己的存在。所有间歇期都是被char体验为"**不存在**"的时间。',
          volunteer : 'char的自我已被主动且彻底地抹除,仅保留一个为user服务的功能性残余。该char对"**我是谁**"的问题没有答案,对"**我要什么**"的问题的答案是"**user希望我要什么**"。',
          apathetic : 'char进入了情感系统的**终末状态**——连麻木本身都不再能被感知。该char的内在世界已退化到动物性水平以下,仅保留维持生命所需的最小神经活动。进一步刺激已无法激活任何有意义的反应。'
        }
      }
    ]
  },
  
  // ==========================================
  // 反抗珠 (resistance)
  // ==========================================
  
  resistance: {
    id: 'resistance',
    name: '反抗珠',
    semantic: 'char 抵抗意志的具象化收藏（囚禁者视角的"纪念物"）',
    sourcePalam: 'resistance',
    hidden: false,
    thresholds: {
      bronze:   40,
      silver:   180,
      gold:     450,
      obsidian: 1300
    },
    levels: [
      // --- 铜级 · 清醒抗拒 (累积 40) ---
      {
        level:     0,
        key:       'bronze',
        nameCn:    '铜级',
        title:     '清醒抗拒',
        threshold: 40,
        imprints: {
          resistant : 'char的抵抗意志保持清晰——每次触发性动作都伴随可观察的拒绝反应。该char对自身处境有准确认知,未出现合理化或自我欺骗。',
          devoted   : 'char出现了罕见的、与基础人格不一致的抵抗反应——这些抵抗短暂且被char自己快速否认,但其存在本身标志着char的情感协同并非完全无缝。',
          submissive: 'char在支配情境中偶尔出现非快感路径的抵抗反应。这些抵抗通常由具体事件触发(如超出char心理上限的内容),并不构成对整体支配关系的质疑。',
          volunteer : 'char的自愿性核心出现微弱的自我疑虑迹象——在极特定情境下,char的表层自愿姿态与内在反应之间出现可观察的错位。该错位char通常快速压抑。',
          apathetic : 'char在整体冷漠的背景下出现局部的抵抗性反应。这些反应罕见但强度不低,意味着特定刺激触及了char情感隔绝之下未被完全冻结的层次。'
        }
      },
      // --- 银级 · 策略性抵抗 (累积 180) ---
      {
        level:     1,
        key:       'silver',
        nameCn:    '银级',
        title:     '策略性抵抗',
        threshold: 180,
        imprints: {
          resistant : 'char的抵抗已从直接反应演化为策略性——开始观察user的模式、伪装部分反应、选择时机。该char的抵抗能力仍处于上升期。',
          devoted   : 'char出现了更长时间、更结构化的抵抗期,通常伴随着短暂的"**从情感中醒来**"状态。在这些时期内char可能质疑user的动机,虽然质疑通常不持久。',
          submissive: 'char在支配关系中开始出现有意识的边界维护——明确拒绝某些特定内容或强度。这种拒绝不削弱基础的支配接受,但标志着char的自我仍保有一定结构。',
          volunteer : 'char的自愿外壳出现可观察的裂缝——在特定压力下,char会短暂地退出"**自愿者**"角色并展示原始反应。该裂缝通常被char快速修复。',
          apathetic : 'char的抵抗反应显示出意外的精准度——针对特定的情感操纵尝试,char会产生明确且带有敌意的反应。该反应显示char的认知层未被麻木完全吸收。'
        }
      },
      // --- 金级 · 核心抵抗 (累积 450) ---
      {
        level:     2,
        key:       'gold',
        nameCn:    '金级',
        title:     '核心抵抗',
        threshold: 450,
        imprints: {
          resistant : 'char的抵抗意志已进入稳定的核心状态——即使外部行为高度顺从,其内在仍保有完整的、未被侵蚀的自我。该char是典型的"**身顺心不顺**"状态,该状态可以长期维持。',
          devoted   : 'char开始出现对user的持续性怀疑,该怀疑虽然仍被情感认同部分覆盖,但已成为char内在体验的稳定部分。depth足够的情况下,该怀疑可能演变为明确的疏远。',
          submissive: 'char的被支配偏好与个人完整性开始分化——char仍享受支配,但明确保留了"**不属于user**"的核心区域。该分化是submissive模板下健康抵抗的表现。',
          volunteer : 'char的自愿性开始出现系统性自省——char开始质疑自己的"**自愿**"是否真实,该质疑可能触发向resistant模板的演变(v0.6.0不实现演变,但状态存在)。',
          apathetic : 'char的抵抗出现了戏剧性的加强——其冷漠外层下的自我保护机制被user的某些行为激活,进入一种冷漠与敌意并存的状态。该状态对user是危险的。'
        }
      },
      // --- 黑曜级 · 不可触及核心 (累积 1300) ---
      {
        level:     3,
        key:       'obsidian',
        nameCn:    '黑曜级',
        title:     '不可触及核心',
        threshold: 1300,
        imprints: {
          resistant : 'char的抵抗意志已凝结为一个不可触及的核心——即使身体、行为、大部分心理都已被深度塑造,这个核心始终存在且未被侵蚀。该char的表象与核心的分离是永久的。user永远无法完全"**拥有**"这个char,只能拥有表象。',
          devoted   : 'char的原始人格残余已稳定为一个独立的内在结构——与表面的深情顺从并存。该char的表面忠诚是真实的,但表面之下存在一个从未被user触及的"**原本的自己**"。该分离是devoted模板下抵抗的终极形态。',
          submissive: 'char已建立了"**被支配但不被占有**"的稳固结构——即使身体和行为完全献出,核心自我始终保留且从未传递给user。该char对"**属于user**"与"**被user玩弄**"之间的区分有清晰认知,并坚守后者而拒绝前者。',
          volunteer : 'char已完成了对自己"**自愿性**"的彻底解构——意识到自己的献身是一种心理机制而非真实选择。该char可能选择保留表面自愿姿态,但其内在已处于完全清醒的状态。这是volunteer模板下最接近觉醒的终态。',
          apathetic : 'char的冷漠外层下存在着一个被长期压抑、但未被消灭的自我。该自我在当前情境下无法充分表达,但其存在持续且稳定——表现为char对特定事件的难以预测的激烈反应。该char永远对user保留着潜在的反噬可能。'
        }
      }
    ]
  }
};


// ============================================================
// 3. JUEL_SIMPLIFY_RULES —— prompt 精简规则
// ============================================================
/*
  如果 6 珠全解锁 + 4 个 tag，注入的 [印痕] 行可能超过 500 字。
  引擎应根据以下规则做精简（参考 DESIGN_PART2 §3.4.2 和 §3.11.4）：
  
    珠数 ≥ 4 时：普通级印痕精简到 60 字内
    tag 数 ≥ 4 时：tag 附加片段精简到 25 字内
    黑曜级印痕：永远保留完整版，不参与精简
  
  本文件只声明规则常量，具体精简算法在引擎阶段 3（src/core/juels.js）实现。
*/

const JUEL_SIMPLIFY_RULES = {
  juelThreshold: 4,              // 珠数达到此值时触发印痕精简
  tagThreshold:  4,              // tag 数达到此值时触发 tag 片段精简
  imprintMaxChars: 60,           // 普通级精简后字符上限
  tagFragmentMaxChars: 25,       // tag 片段精简后字符上限
  exemptLevels: ['obsidian']     // 豁免精简的等级（黑曜级永远完整）
};
