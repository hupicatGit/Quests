import { useGameStore } from '../store/gameStore';
import { SYSTEM_PROMPT_TEMPLATE, HISTORY_TEMPLATE, CURRENT_ACTION_TEMPLATE, EPILOGUE_USER_TEMPLATE, ASSISTANT_EXTRACTOR_TEMPLATE } from '../prompts/systemPrompt';
import OPENING_PROMPT_RAW from '../prompts/opening.txt?raw';
import { GAME_CONFIG } from '../gameConfig';

export const LLMService = {
    /**
     * 发送玩家的行动到 LLM，并获取包含剧情和系统标签的响应串
     */
    async sendPlayerAction(actionText: string): Promise<string> {
        const state = useGameStore.getState();
        const { goal } = state.scenario;
        const { hp, inventory, perks, currentScene } = state.player;

        const inventoryString = inventory.map(i => i.name).join(", ") || "无";
        const perksString = perks.join(", ") || "无";

        // 1. 根据历史记录判定是否为第一回合 (Opening)
        const isFirstTurn = state.history.length === 0;
        let systemPrompt = "";
        let userPromptContent = "";

        if (isFirstTurn) {
            // 开场逻辑：填充 opening.txt 模板，并追加完整的游戏规则
            const openingPart = OPENING_PROMPT_RAW
                .replace(/{goal}/g, goal)
                .replace(/{inventory}/g, inventoryString)
                .replace(/{perks}/g, perksString)
                .replace(/{currentScene}/g, currentScene);

            const rulesPart = SYSTEM_PROMPT_TEMPLATE
                .replace(/{currentScene}/g, currentScene)
                .replace(/{goal}/g, goal)
                .replace(/{hp}/g, hp.toString())
                .replace(/{inventory}/g, inventoryString);

            systemPrompt = `${openingPart}\n\n---\n\n${rulesPart}`;

            userPromptContent = actionText;
        } else if (state.phase === 'epilogue_pending') {
            // 收到角色死亡/超时信号，请求大模型撰写结局
            systemPrompt = SYSTEM_PROMPT_TEMPLATE
                .replace(/{currentScene}/g, currentScene)
                .replace(/{goal}/g, goal)
                .replace(/{hp}/g, hp.toString())
                .replace(/{inventory}/g, inventoryString);

            userPromptContent = EPILOGUE_USER_TEMPLATE;
        } else {
            // 常规回合逻辑
            systemPrompt = SYSTEM_PROMPT_TEMPLATE
                .replace(/{currentScene}/g, currentScene)
                .replace(/{goal}/g, goal)
                .replace(/{hp}/g, hp.toString())
                .replace(/{inventory}/g, inventoryString);

            const historyContext = state.history.map(h => `[${h.speaker}]: ${h.text}`).join("\n");
            const historyPart = HISTORY_TEMPLATE.replace(/{history}/g, historyContext);
            const actionPart = CURRENT_ACTION_TEMPLATE.replace(/{action}/g, actionText);

            userPromptContent = `${historyPart}\n\n${actionPart}`;
        }

        console.log(">>> [LLM Request Payload] <<<");
        console.log("- System:", systemPrompt);
        console.log("- User:", userPromptContent);

        const apiKey = import.meta.env.VITE_LLM_API_KEY;
        // 通过 Vite 代理转发，绕过浏览器 CORS 限制
        const baseUrl = '/proxy/deepseek/v1';

        if (!apiKey || apiKey === "your_api_key_here") {
            console.warn("API_KEY not found in .env.local, falling back to mock.");
            return new Promise((resolve) => {
                setTimeout(() => {
                    if (isFirstTurn) {
                        useGameStore.getState().injectInitialWorldState({
                            player: { hp: 100, inventory: [{ name: "iPhone", icon: "📱" }], perks: ["冷静"], currentScene: "白星码头" },
                            worldMap: {
                                scenes: [{ name: "白星码头", description: "非常寒冷", matchedImage: "白星码头.png" }],
                                connections: {},
                                characters: [{ name: "露丝", description: "贵族少女", location: "白星码头", matchedImage: "露丝.png" }],
                                interactables: []
                            },
                            worldBackdrop: "这是一个虚拟的开场世界底稿..."
                        });
                        resolve("【开场测试】你突然出现在冰冷的甲板上...");
                    } else {
                        resolve(`你执行了：${actionText}。但没什么反应。`);
                    }
                }, 1500);
            });
        }

        try {
            // 1. 发出请求前：记录当前 Prompt (首回合清空 llm_turn.log)
            fetch('/api/save-log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: `【System】:\n${systemPrompt}\n\n【User】:\n${userPromptContent}`,
                    clear: isFirstTurn
                })
            }).catch(() => { });

            if (isFirstTurn) useGameStore.getState().setLoadingStatus("叙述大模型正在构思世界...");

            const response = await fetch(`${baseUrl}/chat/completions`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: GAME_CONFIG.llm.model,
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userPromptContent }
                    ],
                    temperature: GAME_CONFIG.llm.temperature,
                    max_tokens: GAME_CONFIG.llm.max_tokens,
                    stream: false,
                }),
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            const result = data.choices[0].message.content;
            console.log("<<< [Narrative LLM Response] >>>\n", result);

            // 如果是首回合，触发双流解析助手流程
            if (isFirstTurn) {
                useGameStore.getState().setLoadingStatus("剧情生成完毕，正在启动助手提取世界状态...");
                console.log(">>> [Assistant Extractor Flow Initiated] <<<");
                let availableBackgrounds = "无";
                let availableCharacters = "无";
                try {
                    useGameStore.getState().setLoadingStatus("加载本地美术资源清单...");
                    const res = await fetch(`/api/list-resources?scenarioId=${state.scenario.id}`);
                    if (res.ok) {
                        const fileList = await res.json();
                        if (fileList.backgrounds?.length > 0) availableBackgrounds = fileList.backgrounds.join("、");
                        if (fileList.characters?.length > 0) availableCharacters = fileList.characters.join("、");
                    }
                } catch (e) {
                    console.warn("无法获取动态资源列表", e);
                }

                const extractorPrompt = ASSISTANT_EXTRACTOR_TEMPLATE
                    .replace(/{availableBackgrounds}/g, availableBackgrounds)
                    .replace(/{availableCharacters}/g, availableCharacters)
                    .replace(/{worldNovel}/g, result);

                // 记录发给助手 LLM 的 prompt
                try {
                    fetch('/api/save-log', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            filename: 'assistant_turn.log',
                            content: `[发给助手LLM的Prompt]\n============================\n${extractorPrompt}\n`
                        })
                    });
                } catch (e) { /* ignore */ }

                // 使用 MiniMax 作为助手 LLM
                const assistantBaseUrl = GAME_CONFIG.assistantLlm.baseUrl;
                const assistantApiKey = import.meta.env.VITE_ASSISTANT_LLM_API_KEY || GAME_CONFIG.assistantLlm.apiKey;

                useGameStore.getState().setLoadingStatus("助手大模型正在重塑物理规则 (提取 JSON)...");
                const extractorResponse = await fetch(`${assistantBaseUrl}/chat/completions`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${assistantApiKey}`,
                    },
                    body: JSON.stringify({
                        model: GAME_CONFIG.assistantLlm.model,
                        messages: [{ role: "user", content: extractorPrompt }],
                        temperature: GAME_CONFIG.assistantLlm.temperature,
                        max_tokens: GAME_CONFIG.assistantLlm.max_tokens,
                        stream: false,
                    }),
                });

                if (!extractorResponse.ok) throw new Error(`HTTP ${extractorResponse.status} from Extractor`);

                const extractorData = await extractorResponse.json();
                let extractorResult = extractorData.choices[0].message.content;
                console.log("<<< [Assistant Extractor Response] >>>\n", extractorResult);

                // 记录助手 LLM 的返回内容（追加到同一文件）
                try {
                    fetch('/api/save-log', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            filename: 'assistant_turn.log',
                            content: `\n\n============================\n[助手LLM返回的原始结果]\n============================\n${extractorResult}\n`,
                            append: true
                        })
                    });
                } catch (e) { /* ignore */ }

                try {
                    useGameStore.getState().setLoadingStatus("物理规则解析与同步中...");
                    // 1. 先剥离 <think>...</think> 思维链块（DeepSeek-R1 等模型会输出，其中含伪代码会干扰提取）
                    let cleanResult = extractorResult.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

                    // 2. 再剥离 markdown 代码块标记（```json ... ```）
                    const codeBlockMatch = cleanResult.match(/```(?:json)?\s*([\s\S]*?)```/);
                    if (codeBlockMatch) {
                        cleanResult = codeBlockMatch[1].trim();
                    }

                    // 3. 最后再用大括号正则兜底提取
                    const jsonMatch = cleanResult.match(/\{[\s\S]*\}/);
                    const jsonStr = jsonMatch ? jsonMatch[0] : cleanResult;
                    const parsedData = JSON.parse(jsonStr);

                    // 将结构化数据挂载至底层系统机
                    useGameStore.getState().injectInitialWorldState(parsedData);
                } catch (e) {
                    console.error("Failed to parse extractor JSON, injecting fallback state:", e);
                    // 如果大模型吐出乱码，提供默认兜底并解锁死机
                    useGameStore.getState().injectInitialWorldState({
                        player: { hp: 100, inventory: [], perks: [], currentScene: "混沌虚空" },
                        worldMap: {
                            scenes: [{ name: "混沌虚空", description: "空空荡荡", matchedImage: null }],
                            connections: {},
                            characters: [],
                            interactables: []
                        },
                        worldBackdrop: "开场世界创造波动引起的空白设定..."
                    });
                }
            }

            // 2. 收到回复后：追加记录 Response
            try {
                fetch('/api/save-log', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        response: result
                    })
                });
            } catch (e) {
                // Ignore log error
            }

            return result;
        } catch (error) {
            console.error("LLM Error:", error);
            const fallbackResult = `[神经网络中断]: ${String(error)}`;

            try {
                fetch('/api/save-log', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        response: fallbackResult
                    })
                });
            } catch (e) { }

            return fallbackResult;
        }
    },

    /**
     * 显式清空所有调试日志（用于新开局）
     * 在 App 初始化时调用，确保在任何 LLM 请求发出前就完成清空
     */
    async clearLogs() {
        try {
            await Promise.all([
                // 清空 llm_turn.log
                fetch('/api/save-log', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ clear: true })
                }),
                // 清空 assistant_turn.log
                fetch('/api/save-log', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filename: 'assistant_turn.log', clear: true })
                }),
                // 清空 state_turn.log
                fetch('/api/save-log', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filename: 'state_turn.log', clear: true })
                })
            ]);
        } catch (e) { /* ignore */ }
    }
};
