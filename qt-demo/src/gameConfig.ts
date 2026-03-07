/**
 * 游戏全局配置文件
 */
export const GAME_CONFIG = {
    // 背景 ID（必填）：决定世界设定、资源目录
    // titanic_1912
    backgroundId: "unknown", // 如果为空，系统将回退到 "unknown" 背景，不会加载特定的本地美术资源

    // 剧本 ID
    // "0" = 自动加载最新临时保存在 saved_scenarios 的剧本（快速重开上局，若无则走 LLM）
    // ""  = 强制要求 LLM 随机生成新剧本
    // "指定ID" = 强制加载 public 预设剧本
    scenarioId: "unknown_20260307_233847",

    // 叙事大模型（负责生成剧情文本）
    llm: {
        model: "deepseek-chat",
        temperature: 0.3,
        max_tokens: 8192,
        streaming: true, // 开启后使用流式接收，段落到齐即展示，无需等待全部生成
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
