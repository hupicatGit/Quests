import { useGameStore } from '../store/gameStore';
import type { StatusEffect } from '../store/gameStore';
import { GAME_CONFIG } from '../gameConfig';

/**
 * 状态评估器：后台调用助手 LLM 评估状态效果
 * 
 * 工作流程：
 * 1. 从叙事文本中用正则表达式快速提取可能的状态描述
 * 2. 为每个疑似状态赋予默认值（15点扣血），立即写入 store
 * 3. 后台异步调用助手 LLM 评估真实的扣血量和状态描述
 * 4. LLM 返回后修正 store 中的状态数值和发作描述
 * 5. 如果 LLM 超时或失败，使用默认值（宁可漏过，不要卡死主流程）
 */

// 常见的状态关键字正则匹配模式
// 匹配如：「获得了"头疼"状态」「处于中毒状态」「陷入眩晕」「感到头痛欲裂」
const STATUS_PATTERNS = [
    // 明确的状态授予 (最高优先级)
    /(?:获得|进入|陷入|染上|出现|处于)[了]?\s*[「"'"【]?([^「"'"】\s]{1,8})[」"'"】]?\s*(?:的?\s*)?(?:状态|症状|debuff|效果)/gi,
    // 感觉类描述
    /(?:感到|觉得|开始)(?:剧烈的?|持续的?|阵阵|强烈的?)?\s*([头眩晕疼痛恶心虚弱中毒流血出血窒息灼烧冻伤麻痹]{2,6})/gi,
    // 被动遭受类
    /(?:被|遭受|受到)[了]?\s*[「"'"【]?([^「"'"】\s]{1,8})[」"'"】]?\s*(?:的?\s*)?(?:折磨|侵袭|影响|困扰)/gi,
    // 直接的「你XXX了」形态
    /你\s*(?:中[了]\s*)?([中毒流血出血]{2,4})/gi,
];

// 判断是否为正面状态的关键字
const POSITIVE_KEYWORDS = /恢复|治愈|振奋|精力充沛|精神焕发|解毒|痊愈|增强|提升|buff/i;

// 过滤掉非生理/心理的剧情处境词汇（这种状态不应导致直接扣血）
const IGNORE_KEYWORDS = /暴露|盘查|押送|搜查|逮捕|监视|被困|限制在|怀疑|注意|嫌疑|拘留|禁闭|危险|困境/i;

export interface ExtractedStatusHint {
    name: string;
    rawContext: string; // 包围该关键字的上下文段落（用于发给助手LLM）
}

export const StatusEvaluator = {
    /**
     * 从叙事文本中用正则提取可能的状态关键字
     * 返回去重后的结果
     */
    extractStatusHints(narrativeText: string): ExtractedStatusHint[] {
        const hints: ExtractedStatusHint[] = [];
        const seenNames = new Set<string>();

        // 1. 专门提取大模型在末尾输出的 `**你的状态**： xxx` 汇总行 (兼容可能没有写粗体的边缘情况)
        const statusLineRegex = /[\*]*(?:你的状态|当前状态)[\*]*\s*[:：]\s*([^\n]+)/;
        const statusLineMatch = narrativeText.match(statusLineRegex);
        if (statusLineMatch) {
            const statusContent = statusLineMatch[1];

            // 尝试提取行内所有被 **包围的粗体字作为状态名（如：**中度脑震荡**）
            const boldRegex = /\*\*([^\*]+)\*\*/g;
            let boldMatch;
            let foundBold = false;
            while ((boldMatch = boldRegex.exec(statusContent)) !== null) {
                const name = boldMatch[1].replace(/（[^）]*）|\([^)]*\)/g, '').trim(); // 移除词条内可能自带的括号描述
                if (name && name !== '无' && name !== '正常' && !seenNames.has(name) && !IGNORE_KEYWORDS.test(name)) {
                    seenNames.add(name);
                    hints.push({ name, rawContext: statusContent });
                    foundBold = true;
                }
            }

            // 如果这一行没有任何加粗，尝试按标点分割提取（例如：轻微头痛（不影响行动），身份面临暴露）
            if (!foundBold) {
                const parts = statusContent.split(/[,，、;；]+/);
                for (let part of parts) {
                    // 去除括号内的描述说明
                    const name = part.replace(/（[^）]*）|\([^)]*\)/g, '').trim();
                    // 过滤掉太长不是状态名的句子，只保留短语
                    if (name && name.length <= 15 && name !== '无' && name !== '正常' && !seenNames.has(name) && !IGNORE_KEYWORDS.test(name)) {
                        seenNames.add(name);
                        hints.push({ name, rawContext: statusContent });
                    }
                }
            }
        }

        // 2. 原有的，在散文中寻找补充状态词的正则
        for (const pattern of STATUS_PATTERNS) {
            // 重置 lastIndex 防止全局正则状态残留
            pattern.lastIndex = 0;
            let match;
            while ((match = pattern.exec(narrativeText)) !== null) {
                const name = match[1]?.trim();
                // 忽略被上面的明确状态列表捕获过的，以及忽略太长的词
                if (!name || name.length > 10 || seenNames.has(name) || IGNORE_KEYWORDS.test(name)) continue;
                seenNames.add(name);

                // 提取该匹配所在的上下文（前后各50字符）
                const start = Math.max(0, match.index - 50);
                const end = Math.min(narrativeText.length, match.index + match[0].length + 50);
                const rawContext = narrativeText.substring(start, end);

                hints.push({ name, rawContext });
            }
        }

        return hints;
    },

    /**
     * 将提取到的状态赋予默认值并立即写入 store
     * 返回已写入的状态列表（用于后续发给助手LLM修正）
     */
    applyDefaultStatuses(hints: ExtractedStatusHint[]): StatusEffect[] {
        const newStatuses: StatusEffect[] = [];
        const store = useGameStore.getState();

        for (const hint of hints) {
            // 跳过已存在的同名状态
            if (store.player.statuses.some(s => s.name === hint.name)) continue;

            const isPositive = POSITIVE_KEYWORDS.test(hint.name) || POSITIVE_KEYWORDS.test(hint.rawContext);

            const status: StatusEffect = {
                id: Math.random().toString(36).substring(2, 9),
                name: hint.name,
                damage: isPositive ? 0 : 15,  // 默认扣血 15
                description: isPositive
                    ? `你感觉${hint.name}带来了些许好处`
                    : `你因为${hint.name}而感到痛苦`,
                type: isPositive ? 'positive' : 'negative',
                evaluated: false,
            };

            useGameStore.getState().addStatus(status);
            newStatuses.push(status);
        }

        return newStatuses;
    },

    /**
     * 后台异步调用助手 LLM 评估状态效果
     * 容错：超时5秒或报错则静默失败，保留默认值
     */
    async evaluateWithAssistant(statuses: StatusEffect[]): Promise<void> {
        if (statuses.length === 0) return;

        const assistantBaseUrl = GAME_CONFIG.assistantLlm.baseUrl;
        const assistantApiKey = import.meta.env.VITE_ASSISTANT_LLM_API_KEY || GAME_CONFIG.assistantLlm.apiKey;

        // 构建 Prompt：只发送状态名称和上下文，不发送完整剧情
        const statusDescriptions = statuses.map((s, i) =>
            `${i + 1}. 状态名：${s.name}（当前默认扣血：${s.damage}，类型：${s.type === 'negative' ? '负面' : '正面'}）`
        ).join('\n');

        const prompt = `你是一个游戏状态评估专家。请根据以下状态信息，评估每个状态的真实影响。

【状态列表】
${statusDescriptions}

【评估要求】
1. 对每个负面状态，评估每回合应扣多少HP（轻微5-10，中等15-25，严重30-50，致命50+）
2. 为每个状态编写一句简短的发作描述（15-30字），用于在游戏中展示给玩家
3. 如果某个状态其实是正面状态，请将 damage 设为 0，type 设为 "positive"

【输出格式 - 严格JSON数组】
[
  { "name": "头疼", "damage": 15, "description": "你因头疼感到阵阵眩晕，视线逐渐模糊", "type": "negative" }
]

只输出JSON数组，不要带任何多余文字或markdown！`;

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000); // 8秒超时

            const response = await fetch(`${assistantBaseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${assistantApiKey}`,
                },
                body: JSON.stringify({
                    model: GAME_CONFIG.assistantLlm.model,
                    messages: [{ role: 'user', content: prompt }],
                    temperature: GAME_CONFIG.assistantLlm.temperature,
                    max_tokens: 2000,
                    stream: false,
                }),
                signal: controller.signal,
            });

            clearTimeout(timeout);

            if (!response.ok) {
                console.warn('[StatusEvaluator] 助手LLM返回非200:', response.status);
                return;
            }

            const data = await response.json();
            let resultText = data.choices?.[0]?.message?.content || '';

            // 清理 think 标签和 markdown 代码块
            resultText = resultText.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
            const codeBlockMatch = resultText.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (codeBlockMatch) resultText = codeBlockMatch[1].trim();

            const evaluations = JSON.parse(resultText);

            if (!Array.isArray(evaluations)) {
                console.warn('[StatusEvaluator] 助手LLM返回格式不符:', resultText);
                return;
            }

            // 修正 store 中的状态
            for (const eval_ of evaluations) {
                if (!eval_.name) continue;
                useGameStore.getState().updateStatus(eval_.name, {
                    damage: typeof eval_.damage === 'number' ? eval_.damage : 15,
                    description: eval_.description || undefined,
                    type: eval_.type === 'positive' ? 'positive' : 'negative',
                    evaluated: true,
                });
            }

            console.log('[StatusEvaluator] 助手LLM评估完成，已修正状态:', evaluations);

            // 记录日志
            try {
                fetch('/api/save-log', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        filename: 'status_eval.log',
                        content: `[状态评估结果]\n${JSON.stringify(evaluations, null, 2)}\n`,
                    }),
                });
            } catch { }

        } catch (e) {
            // 超时或网络错误：静默失败，保留默认值
            console.warn('[StatusEvaluator] 助手LLM评估失败(可能超时)，保留默认值:', e);
        }
    },

    /**
     * 完整流程入口：提取 → 默认值上树 → 后台评估修正
     * 调用方无需 await，此函数在后台运行
     */
    processNarrativeForStatuses(narrativeText: string): void {
        const hints = this.extractStatusHints(narrativeText);
        if (hints.length === 0) return;

        console.log('[StatusEvaluator] 正则提取到疑似状态:', hints.map(h => h.name));

        const newStatuses = this.applyDefaultStatuses(hints);
        if (newStatuses.length === 0) return;

        // 给每个新增的状态发通知
        newStatuses.forEach(s => {
            const icon = s.type === 'negative' ? '⚠️' : '✨';
            useGameStore.getState().addNotification(`${icon} 获得状态：${s.name}`);
        });

        // 后台异步评估（不阻塞主流程）
        this.evaluateWithAssistant(newStatuses).catch(e => {
            console.warn('[StatusEvaluator] 后台评估异常:', e);
        });
    },
};
