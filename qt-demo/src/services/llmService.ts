import { useGameStore } from '../store/gameStore';
import { SYSTEM_PROMPT_TEMPLATE, HISTORY_TEMPLATE, CURRENT_ACTION_TEMPLATE, EPILOGUE_SYSTEM_TEMPLATE, EPILOGUE_TRIGGER_PROMPT, ASSISTANT_EXTRACTOR_TEMPLATE } from '../prompts/systemPrompt';
import OPENING_PROMPT_RAW from '../prompts/opening.txt?raw';
import { GAME_CONFIG } from '../gameConfig';

export const LLMService = {
    /**
     * 安全提取第一个完整的大括号包裹的 JSON 对象，防止贪婪正则跨多对象匹配
     */
    extractFirstJSONObject(text: string): string {
        const firstBrace = text.indexOf('{');
        if (firstBrace === -1) return text;

        let depth = 0;
        let inString = false;
        let escape = false;

        for (let i = firstBrace; i < text.length; i++) {
            const char = text[i];
            if (escape) {
                escape = false;
                continue;
            }
            if (char === '\\') {
                escape = true;
                continue;
            }
            if (char === '"') {
                inString = !inString;
                continue;
            }
            if (!inString) {
                if (char === '{') depth++;
                else if (char === '}') depth--;
            }
            if (depth === 0) {
                return text.substring(firstBrace, i + 1);
            }
        }
        return text.substring(firstBrace);
    },

    /**
     * 独立方法：生成全新的剧本世界（非流式）
     */
    async generateScenario(): Promise<any> {
        const state = useGameStore.getState();
        const { hp, inventory, perks, currentScene } = state.player;

        const inventoryString = inventory.map(i => i.name).join(", ") || "无";
        const perksString = perks.join(", ") || "无";

        const openingPart = OPENING_PROMPT_RAW
            .replace(/{inventory}/g, inventoryString)
            .replace(/{perks}/g, perksString)
            .replace(/{currentScene}/g, currentScene);
        const rulesPart = SYSTEM_PROMPT_TEMPLATE
            .replace(/{currentScene}/g, currentScene)
            .replace(/{hp}/g, hp.toString())
            .replace(/{inventory}/g, inventoryString);

        const systemPrompt = `${openingPart}\n\n---\n\n${rulesPart}`;
        const userPromptContent = "[开始冒险]";

        console.log(">>> [Generate Scenario Request] <<<");
        console.log("- System:", systemPrompt);
        console.log("- User:", userPromptContent);

        const apiKey = import.meta.env.VITE_LLM_API_KEY;
        const baseUrl = '/proxy/deepseek/v1';

        if (!apiKey || apiKey === "your_api_key_here") {
            console.warn("API_KEY not found in .env.local, falling back to mock.");
            return new Promise((resolve) => {
                setTimeout(() => {
                    const mockScenario = {
                        id: "mock_scenario_id",
                        backgroundId: GAME_CONFIG.backgroundId,
                        prologue: "【开场测试】你突然出现在冰冷的甲板上...",
                        worldState: {
                            player: { hp: 100, inventory: [{ name: "iPhone", icon: "📱" }], perks: ["冷静"], currentScene: "白星码头" },
                            worldMap: {
                                scenes: [{ name: "白星码头", description: "非常寒冷", matchedImage: "白星码头.png" }],
                                connections: {},
                                characters: [{ name: "露丝", description: "贵族少女", location: "白星码头", matchedImage: "露丝.png" }],
                                interactables: []
                            },
                            worldBackdrop: "这是一个虚拟的开场世界底稿..."
                        },
                        goal: "寻找救生艇",
                        deadline: "",
                        playerOverrides: { hp: 100, points: 0, time: 0 }
                    };
                    resolve(mockScenario);
                }, 1500);
            });
        }

        try {
            fetch('/api/save-log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: `【System】:\n${systemPrompt}\n\n【User】:\n${userPromptContent}`,
                    clear: true
                })
            }).catch(() => { });

            useGameStore.getState().setLoadingStatus("叙述大模型正在构思世界...");

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

            useGameStore.getState().setLoadingStatus("剧情生成完毕，正在启动助手提取世界状态...");
            let availableBackgrounds = "无";
            let availableCharacters = "无";
            try {
                useGameStore.getState().setLoadingStatus("加载本地美术资源清单...");
                const res = await fetch(`/api/list-resources?backgroundId=${state.background.id}`);
                if (res.ok) {
                    const fileList = await res.json();
                    if (fileList.backgrounds?.length > 0) availableBackgrounds = fileList.backgrounds.join("、");
                    if (fileList.characters?.length > 0) availableCharacters = fileList.characters.join("、");
                }
            } catch (e) { console.warn("无法获取动态资源列表", e); }

            const extractorPrompt = ASSISTANT_EXTRACTOR_TEMPLATE
                .replace(/{availableBackgrounds}/g, availableBackgrounds)
                .replace(/{availableCharacters}/g, availableCharacters)
                .replace(/{worldNovel}/g, result);

            try {
                fetch('/api/save-log', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        filename: 'assistant_turn.log',
                        content: `[发给助手LLM的Prompt]\n============================\n${extractorPrompt}\n`,
                        clear: true
                    })
                });
            } catch (e) { }

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
            const extractorResult = extractorData.choices[0].message.content;

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
            } catch (e) { }

            let parsedData: any = {};
            try {
                useGameStore.getState().setLoadingStatus("物理规则解析与同步中...");
                let cleanResult = extractorResult.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
                const codeBlockMatch = cleanResult.match(/```(?:json)?\s*([\s\S]*?)```/);
                if (codeBlockMatch) cleanResult = codeBlockMatch[1].trim();
                const jsonStr = LLMService.extractFirstJSONObject(cleanResult);
                parsedData = JSON.parse(jsonStr);
            } catch (e) {
                console.error("Failed to parse extractor JSON, using fallback:", e);
                parsedData = {
                    player: { hp: 100, inventory: [], perks: [], currentScene: "混沌虚空" },
                    worldMap: { scenes: [{ name: "混沌虚空", description: "空空荡荡" }], connections: {}, characters: [], interactables: [] },
                    worldBackdrop: "开场世界创造波动引起的空白设定..."
                };
            }

            // 发送自动保存请求
            let scenarioObj: any = {
                backgroundId: GAME_CONFIG.backgroundId,
                prologue: result,
                worldState: parsedData,
                goal: parsedData.goal || state.goal,
                deadline: state.background.deadline,
                playerOverrides: { hp: state.player.hp, points: state.player.points, time: state.player.time },
            };

            try {
                const saveRes = await fetch('/api/auto-save-scenario', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(scenarioObj),
                });
                const saveData = await saveRes.json();
                console.log(`[Auto-Save] 剧本已自动保存: ${saveData.scenarioId}`);
                scenarioObj.id = saveData.scenarioId;
            } catch (e) {
                console.warn('[Auto-Save] 保存失败:', e);
            }

            return scenarioObj;

        } catch (error) {
            console.error("LLM Error:", error);
            throw error;
        }
    },

    /**
     * 发送玩家的行动到 LLM，并获取包含剧情和系统标签的响应串（非流式）
     */
    async sendPlayerAction(actionText: string): Promise<string> {
        const state = useGameStore.getState();
        const { hp, inventory, currentScene } = state.player;
        const inventoryString = inventory.map(i => i.name).join(", ") || "无";

        let systemPrompt = "";
        let userPromptContent = "";

                if (state.phase === 'epilogue_pending') {
            const rulesPart = SYSTEM_PROMPT_TEMPLATE
                .replace(/{currentScene}/g, currentScene)
                .replace(/{hp}/g, hp.toString())
                .replace(/{inventory}/g, inventoryString);
            
            // 将尾声额外指令放入 system prompt
            systemPrompt = `${rulesPart}\n\n${EPILOGUE_SYSTEM_TEMPLATE}`;

            const historyContext = state.history.map(h => `[${h.speaker}]: ${h.text}`).join("\n");
            const historyPart = HISTORY_TEMPLATE.replace(/{history}/g, historyContext);
            userPromptContent = `${historyPart}\n\n${EPILOGUE_TRIGGER_PROMPT}`;
        } else {
            systemPrompt = SYSTEM_PROMPT_TEMPLATE
                .replace(/{currentScene}/g, currentScene)
                .replace(/{hp}/g, hp.toString())
                .replace(/{inventory}/g, inventoryString);

            const historyContext = state.history.map(h => `[${h.speaker}]: ${h.text}`).join("\n");
            const historyPart = HISTORY_TEMPLATE.replace(/{history}/g, historyContext);
            const actionPart = CURRENT_ACTION_TEMPLATE.replace(/{action}/g, actionText);
            userPromptContent = `${historyPart}\n\n${actionPart}`;
        }

        console.log(">>> [LLM Request Payload] <<<");

        const apiKey = import.meta.env.VITE_LLM_API_KEY;
        const baseUrl = '/proxy/deepseek/v1';

        if (!apiKey || apiKey === "your_api_key_here") {
            return new Promise((resolve) => {
                setTimeout(() => resolve(`你执行了：${actionText}。但没什么反应。`), 1500);
            });
        }

        try {
            fetch('/api/save-log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: `【System】:\n${systemPrompt}\n\n【User】:\n${userPromptContent}`,
                    clear: false
                })
            }).catch(() => { });

            const response = await fetch(`${baseUrl}/chat/completions`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
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

            fetch('/api/save-log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ response: result })
            }).catch(() => { });

            return result;
        } catch (error) {
            console.error("LLM Error:", error);
            const fallbackResult = `[神经网络中断]: ${String(error)}`;
            fetch('/api/save-log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ response: fallbackResult })
            }).catch(() => { });
            return fallbackResult;
        }
    },

    /**
     * 流式版本：用 SSE 逐段接收 LLM 回复
     */
    async sendPlayerActionStreaming(
        actionText: string,
        onParagraph: (paragraph: string) => void
    ): Promise<string> {
        const state = useGameStore.getState();
        const { hp, inventory, currentScene } = state.player;
        const inventoryString = inventory.map(i => i.name).join(", ") || "无";

        let systemPrompt = "";
        let userPromptContent = "";

                if (state.phase === 'epilogue_pending') {
            const rulesPart = SYSTEM_PROMPT_TEMPLATE
                .replace(/{currentScene}/g, currentScene)
                .replace(/{hp}/g, hp.toString())
                .replace(/{inventory}/g, inventoryString);
            
            // 将尾声额外指令放入 system prompt
            systemPrompt = `${rulesPart}\n\n${EPILOGUE_SYSTEM_TEMPLATE}`;

            const historyContext = state.history.map(h => `[${h.speaker}]: ${h.text}`).join("\n");
            const historyPart = HISTORY_TEMPLATE.replace(/{history}/g, historyContext);
            userPromptContent = `${historyPart}\n\n${EPILOGUE_TRIGGER_PROMPT}`;
        } else {
            systemPrompt = SYSTEM_PROMPT_TEMPLATE
                .replace(/{currentScene}/g, currentScene)
                .replace(/{hp}/g, hp.toString())
                .replace(/{inventory}/g, inventoryString);
            const historyContext = state.history.map(h => `[${h.speaker}]: ${h.text}`).join("\n");
            const historyPart = HISTORY_TEMPLATE.replace(/{history}/g, historyContext);
            const actionPart = CURRENT_ACTION_TEMPLATE.replace(/{action}/g, actionText);
            userPromptContent = `${historyPart}\n\n${actionPart}`;
        }

        console.log(">>> [LLM Streaming Request] <<<");

        const apiKey = import.meta.env.VITE_LLM_API_KEY;
        const baseUrl = '/proxy/deepseek/v1';

        if (!apiKey || apiKey === "your_api_key_here") {
            return new Promise((resolve) => {
                const mockText = `你执行了：${actionText}。但没什么反应。`;
                onParagraph(mockText);
                resolve(mockText);
            });
        }

        try {
            fetch('/api/save-log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: `【System】:\n${systemPrompt}\n\n【User】:\n${userPromptContent}`,
                    clear: false
                })
            }).catch(() => { });

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
                    stream: true,
                }),
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            if (!response.body) throw new Error("Response body is null");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullText = "";
            let buffer = "";
            let sseBuffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                sseBuffer += decoder.decode(value, { stream: true });
                const lines = sseBuffer.split("\n");
                sseBuffer = lines.pop() || "";

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed === "" || trimmed === "data: [DONE]") continue;
                    if (!trimmed.startsWith("data: ")) continue;

                    try {
                        const json = JSON.parse(trimmed.slice(6));
                        const delta = json.choices?.[0]?.delta?.content;
                        if (!delta) continue;

                        fullText += delta;
                        buffer += delta;

                        while (buffer.includes("\n\n")) {
                            const splitIdx = buffer.indexOf("\n\n");
                            const paragraph = buffer.substring(0, splitIdx).trim();
                            buffer = buffer.substring(splitIdx + 2);

                            if (paragraph && !/(<System>|<Goal>)/i.test(paragraph)) {
                                const cleanParagraph = paragraph
                                    .replace(/^\d+\.\s*.*$/gm, "")
                                    .replace(/[\n\s]*[\*]*[【\[(]行动提示[】\])][\*]*/g, "")
                                    .trim();
                                if (cleanParagraph) {
                                    onParagraph(cleanParagraph);
                                }
                            }
                        }
                    } catch { }
                }
            }

            const remaining = buffer.trim();
            if (remaining && !/(<System>|<Goal>)/i.test(remaining)) {
                const cleanRemaining = remaining
                    .replace(/^\d+\.\s*.*$/gm, "")
                    .replace(/[\n\s]*[\*]*[【\[(]行动提示[】\])][\*]*/g, "")
                    .trim();
                if (cleanRemaining) {
                    onParagraph(cleanRemaining);
                }
            }

            console.log("<<< [Streaming LLM Complete] >>>\n", fullText);

            fetch('/api/save-log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ response: fullText })
            }).catch(() => { });

            return fullText;
        } catch (error) {
            console.error("LLM Streaming Error:", error);
            const fallbackResult = `[神经网络中断]: ${String(error)}`;
            fetch('/api/save-log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ response: fallbackResult })
            }).catch(() => { });
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
