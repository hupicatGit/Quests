# QT1.0 技术设计文档

## 版本
- v1.0
- 日期：2026-02-26

---

## 1. 项目目标

QT1.0是demo版本的图形化网页游戏，重点在于：
1. **快速验证UI体验** - 搭建可交互的界面框架
2. **画面表现** - 美术资源的视觉呈现
3. **美术资源在UI上的展现** - 场景图、立绘、道具图标等的布局
4. **正则表达式后处理** - 对LLM返回信息的解析和提取

---

## 2. UI框架设计

### 2.1 界面布局 (参考现代 PC 视觉小说最佳实践)

为了呈现最具沉境感的“网页端全屏游戏”，UI需要脱离Demo的特定小窗比例，向现代高质感AVG/视觉小说看齐（如《极乐迪斯科》、《海猫鸣泣之时》重制版等）。

**核心设计原则：全屏自适应与留白之美**
- **画布占满**：摒弃带边框的限定尺寸框，直接使用 `100vw` * `100vh` 作为主容器。背景图片采取 `object-cover` 铺满整个浏览器视口。
- **动态排版 (Responsive)**：字号、组件宽度应使用 `rem`, `vh`, `vw` 结合 `max-width` 进行缩放，确保在 1080P 及更高分辨率（2K/4K）下文字依旧锐利且不显得太空旷。
- **视觉重心**：遵循人眼阅读习惯，左侧/中间留给具有极大视觉冲击力的美术资源（全屏背景+高清角色立绘），文字阅读区定锚在右侧或中下方。

```text
┌─────────────────────────────────────────────────────────────┐
│  [赏析模式信息: 场景名 + 时间] (左上角悬浮)                 │
│                                                             │
│                                           [系统/菜单](右上) │
│                                                             │
│              [高清角色立绘]                                  │
│              (左侧/居中偏左)                                │
│              (占屏比极大)                ┌─────────────┐    │
│                                          │ 沉浸式叙事区 │    │
│                                          │ (右侧 35%~40%)│  │
│                                          │ - 说话人     │    │
│                                          │ - 叙事文本   │    │
│  [场景背景图 (100vw * 100vh 全屏沉浸)]    │ - 行动选项   │    │
│                                          │ - 自定义输入 │    │
│                                          └─────────────┘    │
│                                                             │
│  [UI群组：背包/状态/目标] (左下角或悬浮底栏)                 │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 核心组件规格说明

| 组件 | 位置/排版策略 | 功能 |
|------|------|------|
| **背景层** | 全屏 (`100vw x 100vh`) | 场景图片铺满，带有 Subtle 呼吸动画，右侧增加大面积黑色渐变遮罩以保证文字对比度。 |
| **角色立绘** | 左侧至中间视域 | 高清半身像/全身像，高度应达到屏幕的 `70%-90%`，利用 `drop-shadow` 融入环境。 |
| **状态栏** | 左下/底部悬浮 | HP、点数、时间。设计应收敛为“半透明HUD”风格，不喧宾夺主。 |
| **叙事区域** | 右侧面板 (宽约 `35vw`，最大 `600px`) | 对话/叙述文本。背景使用极具质感的毛玻璃 (`backdrop-blur`)。**文字排版使用大行高 (`1.8`)，优雅的衬线或非衬线字体，字号不小于 `16px`。** |
| **决策菜单** | 叙事区域底部延展 | 行动选项列表，需要有明显的霍夫(Hover)反馈动效。 |
| **输入框** | 决策菜单下方/替代决策栏 | 自定义行动输入，打字机光标风格。 |
| **目标/道具** | 左下角 HUD 群组 | 当前任务目标悬浮卡片 + 展开式背包（网格呈现）。 |
| **赏析模式** | - | 快捷键或点击空白处，渐隐所有 UI (opacity: 0)，展现纯净的美术画面与左上角的章节水印标。 |

---

## 3. 结构化标签解析框架（XML伪标签取代纯正则）

**核心突破**：利用纯自然语言的正则表达式提取状态极其脆弱（大模型表述轻微变化就会击穿正则引起Bug）。通过在提示词中强制大模型将剧情沉浸式输出与数据更新分离，使用XML/Markdown伪标签包裹数据，再由前端利用简易正则精准提取。

### 3.1 需要提取的数据

| 数据类型 | 说明 |
|----------|------|
| 叙事内容 | 说话人 + 文本内容 |
| 状态变化 | HP增减、点数变化、时间变化 |
| 物品变化 | 获得/失去物品、物品名称 |
| 行动选项 | 选项编号、行动标题、详情 |
| 图片资源 | 背景图URL、立绘图URL |
| 任务目标 | 当前目标描述 |

### 3.2 标签定义与提取规则

强制大模型输出如下格式：
```xml
（沉浸式的场景剧情描写写在这里...）

<System>
  <Stat HP="-10" TimeCost="30" />
  <Item>
    <Gain>生锈的怀表</Gain>
    <Lost>半包口香糖</Lost>
  </Item>
  <Targets>
    <Action id="1">撬开铁门 | 可能发生严重噪音缺氧</Action>
    <Action id="2">原路返回 | 浪费时间</Action>
  </Targets>
</System>
```

前端渲染时直接过滤 `<System>` 及其内部内容保障沉浸感，并用简化正则极高准确率地提取数据：
```javascript
// 标签内状态变化
const statsPatterns = {
  hpChange: /([+-]?\d+)\s*(?:点)?(?:HP|生命|血量|生命值)/i,
  pointsChange: /([+-]?\d+)\s*(?:点|积分|分数)/i,
  time: /(?:时间|钟点|现在是|已经过去).*?(\d{1,2})[点时:时分](\d{1,2})/i,
  timeCost: /(?:消耗|花费|过去|用了)\s*(\d+)\s*(?:小时|分钟|刻钟)/i,
};

// 物品变化
const itemPatterns = {
  gain: /(?:获得|得到|拿到|找到|捡到|拥有|得到?了)\s*([^\s，。,\n\d]{1,20})(?:，|。|$)/gi,
  lost: /(?:失去|丢失|使用|消耗|花费|没了)\s*([^\s，。,\n\d]{1,20})(?:，|。|$)/gi,
};

// 行动选项
const actionPatterns = {
  numbered: /^[\s　]*(\d+)[\.、]\s*([^|｜\n]+)(?:[|｜]\s*([^\n]+))?$/gm,
  suggestion: /(?:可以|建议|或许|不妨)\s*([^。，\n]+?)(?:，|$)/gi,
  bracket: /[【\[]([^】\]]+)[】\]]/g,
};

// 图片资源
const imagePatterns = {
  image: /(https?:\/\/[^\s]+\.(?:jpg|jpeg|png|webp|gif))|[^\s]+\.(?:jpg|jpeg|png|webp|gif)/gi,
};

// 任务目标
const goalPatterns = {
  explicit: /(?:任务|目标|目的)[:：]\s*(.+?)(?:\n|$)/i,
};

// 说话人/角色
const speakerPatterns = {
  labeled: /^(叙述者|旁白|NPC|角色|系统|时间线|提示|警告)[：:]\s*(.+)$/gm,
  dialogue: /[""](.+?)[""]/g,
  said: /([^\s]{2,10})(?:说|道|问|喊|叫|回答|喊道)[:：]\s*(.+)/gi,
};
```

### 3.3 解析器结构

```javascript
function parseLLMResponse(text) {
  const result = {
    narrative: [],
    stats: { hp: null, points: null, time: null },
    items: { gained: [], lost: [] },
    actions: [],
    images: { background: null, character: null },
    goal: null,
    raw: text
  };

  extractStats(text, result.stats);
  extractItems(text, result.items);
  extractActions(text, result.actions);
  extractImages(text, result.images);
  extractGoal(text, result);
  extractNarrative(text, result.narrative);

  return result;
}
```

---

## 4. 美术资源配置方案

### 4.1 配置结构

```javascript
// resources/config.js
const gameResources = {
  currentBackground: "titanic_1912",

  backgrounds: {
    taitanic_1912: {
      name: "泰坦尼克号1912",
      backgrounds: {
        default: "白星码头.jpg",
        cabin: "三等舱.jpg",
        deck: "甲板.jpg",
        dining: "餐厅.jpg",
      },
      characters: {
        "神秘侦探": "侦探立绘.png",
        "管家": "管家.png",
        "船长": "船长.png",
      },
      items: {
        "iPhone": "📱",
        "神秘锦囊": "锦囊.png",
      },
    },
  },
};
```

### 4.2 目录结构

```
resources/
└── taitanic_1912/
    ├── images/
    │   ├── 白星码头.jpg
    │   ├── 三等舱.jpg
    │   ├── 甲板.jpg
    │   └── 餐厅.jpg
    ├── characters/
    │   ├── 侦探立绘.png
    │   ├── 管家.png
    │   └── 船长.png
    ├── items/
    │   ├── 锦囊.png
    │   └── iPhone.png
    └── config.js
```

### 4.3 加载器

```javascript
const ImageLoader = {
  getBackground(sceneKey) {
    const bg = gameResources.backgrounds[currentBackground].backgrounds[sceneKey];
    return `/resources/${currentBackground}/images/${bg}`;
  },

  getCharacter(characterName) {
    const char = gameResources.backgrounds[currentBackground].characters[characterName];
    // 立绘全局托底机制，防止遇到未配置角色时报错
    return char ? `/resources/${currentBackground}/characters/${char}` : `/resources/common/unknown_shadow.png`;
  },

  getItemIcon(itemName) {
    const item = gameResources.backgrounds[currentBackground].items[itemName];
    if (item) return item;
    // 物品图标智能托底机制，适配大模型的涌现创造力
    if (itemName.match(/(刀|剑|枪|武器)/)) return "🗡️";
    if (itemName.match(/(纸|信|线索|卷宗|书)/)) return "📄";
    return "❓";
  },
};
```

### 4.4 快速切换机制

```javascript
// 调试面板 - 快速预览切换资源
const ResourceSwitcher = {
  switchBackground(sceneKey) {
    setCurrentScene(sceneKey);
  },
  switchCharacter(characterName) {
    setCurrentCharacter(characterName);
  },
};
```

---

## 5. 酒馆类游戏基础功能

### 5.1 核心功能

| 功能 | 说明 |
|------|------|
| 对话交互 | 玩家输入行动/选择选项 → LLM处理 → 返回结果 |
| 回合制 | 每个行动/选择推进一个回合 |
| 状态管理 | HP、点数、时间、物品等状态实时更新（前端作为唯一权威数据源进行强校验） |
| 存档系统 | 保存/读取游戏进度 |
| 日志记录 | 记录所有对话和操作历史 |

### 5.2 游戏流程

```
开始游戏
    ↓
加载初始提示词 + 剧本配置
    ↓
LLM生成开场 → 显示叙事
    ↓
玩家选择行动 或 输入自定义行动
    ↓
发送行动到LLM → 等待响应
    ↓
LLM返回结果 → 标签数据解析（剔除XML） → 更新UI
    ↓
前端权威校验 (基于时间消耗加法校验总时间、检查HP归零。若死亡/超时，立刻接管不再信任大模型瞎编)
    ↓
检查游戏状态 (胜利/失败/继续)
    ↓
循环直到游戏结束
```

### 5.3 数据结构

```javascript
// 游戏状态
const gameState = {
  // 玩家状态
  player: {
    hp: 100,
    points: 100,
    time: "00:00",
    inventory: [],
    skills: [],
  },

  // 背景状态
  background: {
    id: "titanic_1912",
    name: "泰坦尼克号1912",
    currentScene: "码头",
    goal: "",
  },

  // 历史记录
  history: [
    { role: "system", content: "初始提示词..." },
    { role: "assistant", content: "开场叙事..." },
    { role: "user", content: "玩家行动..." },
    { role: "assistant", content: "LLM响应..." },
  ],

  // 游戏阶段
  phase: "playing",  // playing / success / fail
};
```

### 5.4 前端状态管理架构建议

- **解耦UI与数据**：建议引入全局状态管理（如 `Zustand` 或 `Redux`），将 `GameState`、`Inventory`、`MessageHistory` 从组件的 `useState` 中彻底抽离。
- **核心优势**：后续处理断网重连、读写存档、或全局剧情条件判定时，逻辑层不再受限于React组件的渲染生命周期和Props嵌套地狱，大幅降低长期维护成本。

---

## 6. 初始提示词配置

### 6.1 提示词结构

```javascript
// prompts/config.js
const promptConfig = {
  // 系统提示词
  system: `
你是DM，开始创造一个冒险解谜箱庭——不可能完成的任务。
从著名的故事或者影视作品中选择一个作为原型，严格遵循当时的时代背景和社会风俗。
玩家作为穿越者在其中必须完成一个不可能完成的任务。

[详细规则见游戏规则文档]
`,

  // 游戏规则 (可独立配置)
  rules: `
## 游戏规则
- 玩家拥有百宝袋和100点数
- 消耗10点可抽奖一次
- 游戏时限根据任务节奏动态调节
- 玩家最多存活72小时
- 违反世界禁忌会导致严重后果

## DM行动准则
1. 玩家无准备面对危险 → 直接失败
2. 喜欢真实和有趣的解谜
3. 玩家行动有漏洞 → 2回合内导致Bad Ending
4. 细致描写行动过程（视觉、听觉、嗅觉、触觉）
5. 每回合考虑NPC行动
6. 道具是推理解谜的奖励，不允许突然赠送
7. 每回合把任务目标完成回顾放在输出末尾
`,

  // 玩家行动模板
  playerAction: `
## 玩家行动
{player_input}

请根据以上规则处理玩家的行动。
`,

  // 开场提示
  opening: `
请生成一个箱庭设定：
1. 任务目标
2. 玩家身份和初始道具
3. 6个场景设定
4. NPC设定
5. 世界禁忌和危险
6. 开场叙事

开始吧。
`,
};
```

### 6.2 提示词变量

```javascript
// 动态插入的变量
const promptVariables = {
  "{player_input}": "玩家当前输入的行动",
  "{current_stats}": "玩家当前状态 (HP/点数/时间)",
  "{inventory}": "玩家当前物品",
  "{history}": "最近N轮对话历史",
  "{goal}": "当前任务目标",
  "{scene}": "当前所在场景",
};
```

---

## 7. LLM连接

### 7.1 连接配置

```javascript
// config/llm.js
const llmConfig = {
  // API配置
  api: {
    provider: "openai",  // 或 anthropic, 自定义
    apiKey: process.env.LLM_API_KEY,
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4",
    // 或其他模型
  },

  // 请求设置
  request: {
    temperature: 0.8,
    max_tokens: 2000,
    timeout: 30000,
  },

  // 重试策略
  retry: {
    maxAttempts: 3,
    delay: 1000,
  },
};
```

### 7.2 请求/响应日志

```javascript
// LLM日志记录
const LLMLogger = {
  // 日志存储
  logs: [],

  // 记录请求
  logRequest(prompt, variables) {
    const entry = {
      type: "request",
      timestamp: new Date().toISOString(),
      prompt: prompt,
      variables: variables,
    };
    this.logs.push(entry);
    return entry;
  },

  // 记录响应
  logResponse(requestId, response, parsed) {
    const entry = {
      type: "response",
      timestamp: new Date().toISOString(),
      requestId: requestId,
      raw: response,        // LLM原始返回
      parsed: parsed,       // 正则解析后的数据
    };
    this.logs.push(entry);
    return entry;
  },

  // 查看日志
  getLogs(filter) {
    if (!filter) return this.logs;
    return this.logs.filter(log => log.type === filter);
  },

  // 导出日志
  exportLogs() {
    return JSON.stringify(this.logs, null, 2);
  },
};
```

### 7.3 日志查看器

```javascript
// 日志查看UI组件
const LogViewer = () => {
  const [showLogs, setShowLogs] = useState(false);
  const [logFilter, setLogFilter] = useState("all");  // all / request / response

  return (
    <div className="log-viewer">
      <button onClick={() => setShowLogs(!showLogs)}>
        {showLogs ? "隐藏日志" : "查看日志"}
      </button>

      {showLogs && (
        <div className="log-panel">
          <select value={logFilter} onChange={e => setLogFilter(e.target.value)}>
            <option value="all">全部</option>
            <option value="request">发送</option>
            <option value="response">返回</option>
          </select>

          <div className="log-content">
            {LLMLogger.getLogs(logFilter).map((log, i) => (
              <div key={i} className={`log-entry ${log.type}`}>
                <div className="log-header">
                  <span className="log-type">{log.type}</span>
                  <span className="log-time">{log.timestamp}</span>
                </div>
                <pre className="log-body">
                  {log.type === "request"
                    ? log.prompt.substring(0, 500) + "..."
                    : JSON.stringify(log.parsed, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
```

### 7.4 LLM调用流程

```javascript
async function sendToLLM(playerInput, gameState) {
  // 1. 构建提示词
  const prompt = buildPrompt(playerInput, gameState);

  // 2. 记录请求日志
  const requestEntry = LLMLogger.logRequest(prompt, {
    hp: gameState.player.hp,
    points: gameState.player.points,
    time: gameState.player.time,
  });

  try {
    // 3. 发送请求
    const response = await callLLM(prompt);

    // 4. 解析响应
    const parsed = parseLLMResponse(response);

    // 5. 记录响应日志
    LLMLogger.logResponse(requestEntry.id, response, parsed);

    // 6. 返回解析结果
    return parsed;

  } catch (error) {
    console.error("LLM调用失败:", error);
    return { error: error.message };
  }
}
```

---

## 8. 提示词配置系统

### 8.1 目录结构

```
prompts/
├── config.js          # 提示词拼接配置
├── templates/         # 提示词模板
│   ├── system.txt     # 系统提示词
│   ├── rules.txt      # 游戏规则
│   ├── opening.txt    # 开场提示词
│   └── scenarios/     # 场景特别提示
│       ├── scene_change.txt
│       ├── combat.txt
│       ├── death.txt
│       └── complete.txt
└── variables/        # 变量格式配置
    ├── world.txt      # 世界设定格式
    ├── status.txt     # 状态格式
    └── history.txt    # 历史格式
```

### 8.2 提示词拼接配置 (config.js)

```javascript
// prompts/config.js
const promptConfig = {
  // 提示词组成部分及其顺序
  order: [
    { key: "world_settings", file: "templates/world.txt", required: true },
    { key: "game_rules", file: "templates/rules.txt", required: true },
    { key: "current_status", file: "variables/status.txt", required: true },
    { key: "history", file: "variables/history.txt", required: true },
    { key: "special_prompt", file: "templates/scenarios/default.txt", required: false },
    { key: "player_input", type: "dynamic", required: true },
  ],

  // 模板配置
  templates: {
    // 完整提示词
    full: `{{world_settings}}

{{game_rules}}

## 当前状态
{{current_status}}

## 历史对话
{{history}}

## 特别提示
{{special_prompt}}

## 玩家行动
{{player_input}}

【系统强制指令】：防遗忘机制。请务必严格遵循残酷世界规则判定生死，严禁放水！必须在剧情之后输出 <System> 数据标签闭环变更。请处理此行动并返回结果。`,

    // 开场提示词
    opening: `{{world_settings}}

{{game_rules}}

{{opening_extra}}`,

    // 行动处理
    action: `{{current_status}}

{{history}}

玩家选择了：{{player_input}}

{{special_prompt}}

【系统强制指令】：请用最严格逻辑校验玩家行为，犯错请直接在 <System> 数据标签内扣减大量HP或施加致死状态。必须输出包含 <System> 的严谨格式标签。请处理此行动并返回结果。`,
  },

  // 历史消息配置
  history: {
    maxTurns: 10,           // 最大保留回合数
    roleNames: {            // 角色名称映射
      user: "玩家",
      assistant: "DM",
    },
    format: "{{role}}: {{content}}",  // 每条消息格式
    separator: "\n\n",      // 消息分隔符
  },

  // 特别提示配置
  specialPrompts: {
    default: "无",
    scene_change: "玩家刚刚进入新场景，请描述新场景的环境和氛围。",
    combat: "当前处于危险情境，请紧凑地描写战斗过程。",
    death: "玩家已死亡，进入Bad Ending。请写一段简短但有冲击力的死亡描写。",
    complete: "任务目标已达成，请进入Ending流程，写一段精彩的离开桥段。",
    lottery: "玩家正在使用10点数抽奖，请返回一个与当前时代符合的随机道具。",
  },
};
```

### 8.3 提示词模板文件

**templates/system.txt** (系统提示词)
```
你是DM，开始创造一个冒险解谜箱庭——不可能完成的任务。
从著名的故事或者影视作品中选择一个作为原型，严格遵循当时的时代背景和社会风俗。
玩家作为穿越者在其中必须完成一个不可能完成的任务。
- 任务目标要简单明确
- 避免那种网游式的收集任务
给玩家随机一个身份，玩家拥有0-2个和身份相称的技能，玩家拥有2-3个和身份相称的道具。
设定游戏开始的时间，精确到小时。
```

**templates/rules.txt** (游戏规则)
```
## 游戏规则
- 玩家拥有百宝袋和100点数
- 消耗10点可抽奖一次，获得与当前时代符合的宝物
- 游戏时限根据任务节奏动态调节，不再固定为72小时
- 超过时限立即任务失败，进入Bad Ending
- 任务失败后玩家可以选择重新开始
- 每回合显示玩家当前状态（状态不解决就会在1-3小时内恶化，直接导致Bad Ending）
- 眩晕、疾病等恶性状态恢复，会损失大量的时间
- 玩家需要睡眠，睡眠会损失4-8小时时间，但能恢复体力
- 缺乏体力会导致各种行动失败
- 移动是真实缓慢的，载具极其难以获得
- 主线任务完成后立即进入ending剧情和尾声
- 存在真实天气和灾难系统，考虑对所有人的影响
- 给玩家行动提示时要加编号，行动提示要戏剧性

## DM行动准则
1. 这是冒险解谜游戏，如果玩家无准备地面对危险，玩家就应该直接失败
2. DM必须像B级片导演一样喜欢残酷的情节，从不回避肮脏、灾难、死亡和性暗示的描写
3. DM喜欢真实和有趣，如果玩家对场景体现出观察力，逻辑解谜的分析力，对道具的创意使用，DM会给予奖励
4. DM用最严格的逻辑检查玩家的行动，玩家的行动一旦有漏洞，2回合内就会导致Bad Ending，DM绝不心慈手软
5. 玩家触犯世界禁忌时，立即给予真实惩罚，20%概率导致糟糕的状态，有80%概率直接进入Bad Ending
6. 玩家完成动作时，细致描写行动过程和周围反应，从视觉、听觉、嗅觉、触觉等多方面提供沉浸式体验
7. 估算玩家行动真实消耗的时间，推动时间真实发展
8. 总是评估行动的物质结果、声音结果、社会结果，以及周围人/动物的反应
9. 总是评估当前剧情刺激程度，若平淡超过30分钟，安排外部事件提高刺激度
10. 每回合考虑男主角、女主角、当前场景动物和反派的行动
11. 玩家的道具应该是推理、解谜的奖励，不允许突然赠送或剧情降神给玩家道具
12. 当玩家和NPC进行情感交流时，营造浪漫暧昧的气氛，放慢时间流逝
13. Bad Ending和Good Ending都要结束得利落，不给玩家额外机会
14. 每回合都把任务目标的完成回顾放在输出末尾
```

**templates/world.txt** (世界设定格式)
```
## 世界设定
- 剧本名称：{{scenario_name}}
- 时代背景：{{scenario_year}}年
- 世界描述：{{scenario_description}}

### 场景列表
{{scenarios}}

### NPC列表
{{npcs}}

### 世界禁忌
{{taboos}}

### 危险因素
{{dangers}}
```

**variables/status.txt** (状态显示格式)
```
- HP: {{hp}}
- 点数: {{points}}
- 时间: {{time}}
- 体力: {{energy}}
- 饱腹感: {{hunger}}

当前所在场景: {{current_scene}}
{{scene_description}}

背包物品:
{{inventory}}

当前任务: {{goal}}
截止时间: {{deadline}}
```

### 8.4 提示词加载器

```javascript
// prompts/loader.js
const fs = require('fs');
const path = require('path');

class PromptLoader {
  constructor(promptsDir) {
    this.promptsDir = promptsDir;
    this.cache = {};
  }

  // 加载提示词文件
  loadFile(relativePath) {
    const fullPath = path.join(this.promptsDir, relativePath);
    if (this.cache[fullPath]) {
      return this.cache[fullPath];
    }
    return fs.readFileSync(fullPath, 'utf-8');
  }

  // 加载配置
  loadConfig() {
    return require(path.join(this.promptsDir, 'config.js'));
  }

  // 获取模板
  getTemplate(name) {
    const config = this.loadConfig();
    return config.templates[name];
  }

  // 获取特别提示
  getSpecialPrompt(key) {
    const config = this.loadConfig();
    return config.specialPrompts[key] || config.specialPrompts.default;
  }
}
```

### 8.5 变量系统

```javascript
// 变量存储
const gameVariables = {
  status: { hp: 100, points: 100, time: "22:15", energy: 100, hunger: 0 },
  inventory: [],
  scene: { current: "", description: "", availableExits: [] },
  goal: { description: "", deadline: "", progress: 0 },
  world: { name: "", year: 0, setting: "", NPCs: [], taboo: [], danger: [] },
  custom: {},
};
```

### 8.6 XML标签驱动变量更新与前端权威校验

```javascript
const variableTriggers = {
  // 抛弃不可控的自然语言正则，利用强约束的标签进行前端权威裁决
  hpChange: { pattern: /<Stat[^>]*HP="([+-]?\d+)"/, action: (m) => updateVar("status:hp", parseInt(m[1])) },
  timeCost: { pattern: /<Stat[^>]*TimeCost="(\d+)"/, action: (m) => addTimeMinutes("status:time", parseInt(m[1])) }, // ★ 前端自行做时间加法，拒绝大模型的算术幻觉
  pointsChange: { pattern: /<Stat[^>]*Points="([+-]?\d+)"/, action: (m) => updateVar("status:points", parseInt(m[1])) },
  itemGain: { pattern: /<Gain>(.*?)<\/Gain>/g, action: (m) => addItems(m) },
  itemLost: { pattern: /<Lost>(.*?)<\/Lost>/g, action: (m) => removeItems(m) },
};

function applyVariableTriggers(parsedResult) {
  for (const [key, trigger] of Object.entries(variableTriggers)) {
    const value = parsedResult[key];
    if (value && value.match) {
      trigger.action(value.match);
    }
  }
}
```

### 8.7 提示词拼接函数

```javascript
// prompts/builder.js
function buildPrompt(type, data) {
  const loader = new PromptLoader('./prompts');
  const config = loader.loadConfig();
  const template = loader.getTemplate(type);

  let result = template;

  // 按顺序替换各部分
  for (const part of config.order) {
    const value = getPartContent(part, data);
    result = result.replace(new RegExp(`{{${part.key}}}`, 'g'), value);
  }

  return result;
}

function getPartContent(part, data) {
  if (part.type === 'dynamic') {
    return data[part.key] || '';
  }
  // 从文件加载并替换变量
  return loadAndFill(part.file, data);
}
```

---

## 9. 下一步 (当前进度更新)

- [x] UI框架代码实现 (Layout, HUD, NarrativePanel, ActionMenu 已完成)
- [x] 正则解析器实现 (ActionParser 已完成)
- [x] 资源配置加载实现 (ResourceLoader 已支持场景/立绘/物品图标)
- [ ] 调试面板实现
- [x] LLM连接实现 (已封装 llmService 并支持环境变量配置)
- [ ] 日志查看器实现
- [/] 提示词配置系统实现 (已独立 systemPrompt.ts，待进一步模块化)
- [/] 变量系统实现 (HP/Time/Items 已实现，Energy/Hunger 待加入)
- [ ] LLM 长期记忆压缩优化 (对话轮次滑动窗口或阶段性总结机制)
