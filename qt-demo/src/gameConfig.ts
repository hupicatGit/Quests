/**
 * 游戏全局配置文件
 */
export const GAME_CONFIG = {
    // 背景 ID（必填）：决定世界设定、资源目录
    backgroundId: "titanic_1912",

    // 剧本 ID（留空 = LLM 随机生成新剧本）
    scenarioId: "",

    // 叙事大模型（负责生成剧情文本）
    llm: {
        model: "deepseek-chat",
        temperature: 0.3,
        max_tokens: 8192,
    },

    // 助手大模型（负责提取 JSON 状态，用 MiniMax）
    assistantLlm: {
        // 通过 Vite 代理绕过 CORS，生产环境可用网关代替
        baseUrl: '/proxy/minimax/v1',
        apiKey: import.meta.env.VITE_ASSISTANT_LLM_API_KEY || "",
        model: import.meta.env.VITE_ASSISTANT_LLM_MODEL || "MiniMax-M2.5",
        temperature: 0.1,
        max_tokens: 8000,
    },

    // 调试与日志
    debug: {
        enableAutoInitialization: true,
        showStateLog: true,
    }
};
