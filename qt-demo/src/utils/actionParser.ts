export interface ParsedLLMResponse {
    narrativeText: string;     // 处理后的纯净剧情文本 (用于展示)
    systemUpdates: {
        hpChanged?: number;      // <Stat hp="+10" /> 导致的生命变动
        timeCost?: number;       // <Stat time="+15" /> 导致的时间流失（分钟）
        itemsAdded?: string[];   // <Item add="绷带" />
        itemsRemoved?: string[]; // <Item remove="钥匙" />
    };
    hasDeathFlag: boolean;     // 是否触发了死亡结局 <Event type="death" />
    hasGameOverFlag?: boolean; // 是否到达结束状态 <Event type="game_over" /> (用于尾声后)
    actions: Array<{ id: number, title: string, detail: string }>; // 提取到的行动选项
    goal?: string;             // 提取到的任务目标回顾
}

/**
 * 核心大模型输出解析器
 * 设计目的：提取自然语言中混合的 <System> 自定义伪标签，并将剩余文本净化。
 */
export const ActionParser = {
    parseResponse(rawText: string): ParsedLLMResponse {
        let narrativeText = rawText;
        const result: ParsedLLMResponse = {
            narrativeText: "",
            systemUpdates: {
                itemsAdded: [],
                itemsRemoved: [],
            },
            hasDeathFlag: false,
            hasGameOverFlag: false,
            actions: [],
            goal: undefined
        };

        // 1. 提取所有 <System>...</System> 包裹的闭环内容
        const systemRegex = /<System>([\s\S]*?)<\/System>/g;
        let match;

        while ((match = systemRegex.exec(rawText)) !== null) {
            const systemContent = match[1];

            // 解析 <Stat hp="-15" />
            const statMatch = systemContent.match(/<Stat\s+hp="([+-]?\d+)"\s*\/>/);
            if (statMatch) {
                result.systemUpdates.hpChanged = parseInt(statMatch[1], 10);
            }

            // 解析 <Stat time="+15" /> 或 <Stat time="15" /> (分钟)
            const timeMatch = systemContent.match(/<Stat\s+time="[+]?(\d+)"\s*\/>/);
            if (timeMatch) {
                result.systemUpdates.timeCost = parseInt(timeMatch[1], 10);
            }

            // 解析 <Item add="武器名称" />
            const itemAddRegex = /<Item\s+add="([^"]+)"\s*\/>/g;
            let itemAddMatch;
            while ((itemAddMatch = itemAddRegex.exec(systemContent)) !== null) {
                result.systemUpdates.itemsAdded?.push(itemAddMatch[1]);
            }

            // 解析 <Item remove="消耗品" />
            const itemRemoveRegex = /<Item\s+remove="([^"]+)"\s*\/>/g;
            let itemRmMatch;
            while ((itemRmMatch = itemRemoveRegex.exec(systemContent)) !== null) {
                result.systemUpdates.itemsRemoved?.push(itemRmMatch[1]);
            }

            // 解析 <Event type="death" /> 或 <Event type="game_over" />
            if (/<Event\s+type="death"\s*\/>/.test(systemContent)) {
                result.hasDeathFlag = true;
            }
            if (/<Event\s+type="game_over"\s*\/>/.test(systemContent)) {
                result.hasGameOverFlag = true;
            }
        }

        // 2. 提取 <Goal>...</Goal> 标签中的任务目标
        const goalTagRegex = /<Goal>([\s\S]*?)<\/Goal>/g;
        let goalTagMatch;
        while ((goalTagMatch = goalTagRegex.exec(rawText)) !== null) {
            result.goal = goalTagMatch[1].trim();
        }

        // 3. 净化文本：【必须先】移除 <System> 块和 <Goal> 块，再处理选项
        // 这样才能避免 <System> 内的世界设定编号列表（场景1-6、NPC列表等）被误识别为玩家选项
        narrativeText = narrativeText.replace(/<System>[\s\S]*?<\/System>/g, "");
        narrativeText = narrativeText.replace(/<Goal>[\s\S]*?<\/Goal>/g, "");

        // 3. 从净化后的叙事文本中提取选项（"1. ", "2. " 等开头的行）
        const actionRegex = /^(\d+)\.\s*(.*)/gm;
        let actionMatch;
        while ((actionMatch = actionRegex.exec(narrativeText)) !== null) {
            const id = parseInt(actionMatch[1], 10);
            // 去掉 Markdown 粗体标记 **...**，避免干扰标题分割
            const content = actionMatch[2].replace(/\*\*/g, "").trim();
            if (content) {
                // 尝试分割 Title 和 Detail (按第一个 ， 、 ： ( [ 或 。 分割)
                const splitRegex = /[，、：\(\[。]/;
                const splitIdx = content.search(splitRegex);
                let title = content;
                let detail = "";

                if (splitIdx !== -1) {
                    title = content.substring(0, splitIdx).trim();
                    detail = content.substring(splitIdx).trim();
                    // 去掉开头的标点（如果是左括号之类的保留）
                    if (/^[，、：。]/.test(detail)) {
                        detail = detail.substring(1).trim();
                    }
                }

                result.actions.push({ id, title, detail });
            }
        }

        // 5. 提取主线任务回顾 (通常格式为 **主线任务回顾：** XXX)
        // 仅在未从 <Goal> 标签获取到 goal 时才使用此回退方式
        if (!result.goal) {
            const goalRegex = /[\*]*主线任务回顾[：:]\s*[\*]*(.*)/i;
            const goalMatch = narrativeText.match(goalRegex);
            if (goalMatch) {
                result.goal = goalMatch[1].trim();
                narrativeText = narrativeText.replace(goalRegex, "");
            }
        } else {
            // 即使已有 <Goal> 标签提取的 goal，也要清理叙事中的主线任务回顾行
            const goalRegex = /[\*]*主线任务回顾[：:]\s*[\*]*(.*)/i;
            narrativeText = narrativeText.replace(goalRegex, "");
        }

        // 5. 从叙事文本中移除选项行，以及行动提示标记
        narrativeText = narrativeText.replace(/^(\d+)\.\s*.*$/gm, "");
        // 同时也移除可能在选项之前的 "【行动提示】" 或类似标记
        narrativeText = narrativeText.replace(/[\n\s]*[\*]*[【\[(]行动提示[】\])][\*]*/g, "");

        // 清理可能产生的多余空行
        result.narrativeText = narrativeText.replace(/\n\s*\n/g, '\n\n').trim();

        return result;
    }
};
