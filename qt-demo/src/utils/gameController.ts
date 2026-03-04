import { ActionParser } from "./actionParser";
import { useGameStore } from "../store/gameStore";

/**
 * 负责打通 LLM、ActionParser 和 Zustand GameStore 的控制器
 */
export const GameController = {
    /**
     * 将LLM吐出的原始字符串转换为最终游戏状态的收口函数
     * @param rawLlmResponse LLM 的生回复
     */
    processLLMResponse(rawLlmResponse: string) {
        // 1. 调用提取器解析XML标签
        const parsed = ActionParser.parseResponse(rawLlmResponse);
        const { systemUpdates, hasDeathFlag, hasGameOverFlag, narrativeText, actions } = parsed;

        // 更新可用行动选项
        useGameStore.getState().setAvailableActions(actions);

        // 如果解析到了新的阶段性目标回顾，同步更新到 HUD
        if (parsed.goal) {
            useGameStore.getState().setGoal(parsed.goal);
        }

        // 2. 存入经过净化后的叙文 (按两个回车拆分，实现瀑布流逐段显现)
        if (narrativeText.length > 0) {
            const paragraphs = narrativeText.split(/\n\n+/).filter(p => p.trim());
            paragraphs.forEach(p => {
                useGameStore.getState().addHistoryObject("叙述者", p.trim());
            });
        }

        // 3. 执行状态挂载：物品加减
        const currentInv = [...useGameStore.getState().player.inventory];

        // --- 处理移除物品 ---
        if (systemUpdates.itemsRemoved && systemUpdates.itemsRemoved.length > 0) {
            systemUpdates.itemsRemoved.forEach(removeItemName => {
                const idx = currentInv.findIndex(i => i.name === removeItemName);
                if (idx !== -1) currentInv.splice(idx, 1);
            });
        }

        // --- 处理获得物品 ---
        if (systemUpdates.itemsAdded && systemUpdates.itemsAdded.length > 0) {
            systemUpdates.itemsAdded.forEach(addItemName => {
                // 尝试提取大模型可能直接在名字前给出的 emoji (如 "🔑旧钥匙")
                const match = addItemName.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)\s*(.*)/u);

                let newIcon = "💠";
                let cleanName = addItemName;

                if (match && match[1]) {
                    newIcon = match[1];
                    cleanName = match[2] ? match[2].trim() : addItemName;
                } else {
                    // 简单的 NLP 兜底
                    if (/(刀|剑|枪|武器|匕首|手枪)/.test(addItemName)) newIcon = "🗡️";
                    else if (/(纸|信|线索|卷宗|书|照片|图)/.test(addItemName)) newIcon = "📄";
                    else if (/(药|绷带|急救包|胶囊)/.test(addItemName)) newIcon = "💊";
                    else if (/(钥匙|锁|卡)/.test(addItemName)) newIcon = "🔑";
                    else if (/(食物|肉|面包|水|饮料)/.test(addItemName)) newIcon = "🥫";
                    else newIcon = "📦";
                }

                currentInv.push({ name: cleanName, icon: newIcon });

                // 触发获取物品弹窗
                useGameStore.getState().addNotification(`获得了：${cleanName}`);
            });
        }

        // --- 处理生命值跳动 ---
        let currentHp = useGameStore.getState().player.hp;
        if (systemUpdates.hpChanged) {
            currentHp += systemUpdates.hpChanged;
            if (currentHp > 100) currentHp = 100;

            // 如果失去生命值，触发震动反馈
            if (systemUpdates.hpChanged < 0) {
                useGameStore.getState().triggerScreenShake();
            }
        }

        // --- 处理时间流逝 ---
        let currentTimeStr = useGameStore.getState().player.time;
        if (systemUpdates.timeCost) {
            const [hours, minutes] = currentTimeStr.split(":").map(Number);
            const totalMinutes = (hours * 60) + minutes + systemUpdates.timeCost;

            // 计算新的时间字符串 (支持跨天，但这里仅作小时分钟的简单映射)
            const newHours = Math.floor(totalMinutes / 60) % 24;
            const newMins = totalMinutes % 60;
            currentTimeStr = `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`;
        }

        // --- 全局拦截器：死亡 / 超时逻辑 ---
        if (hasGameOverFlag) {
            // 大模型已输出总结完毕的标签
            useGameStore.getState().addHistoryObject("系统", "【游戏结束】");
            useGameStore.setState({ phase: 'fail' });
        } else if (hasDeathFlag || currentHp <= 0) {
            currentHp = 0;
            // 死亡，但不直接结束，而是挂起进入尾声推演阶段
            useGameStore.getState().addHistoryObject("系统", "⚠️ 你的生命已燃尽... 正在观测终焉 ⚠️\n(请点击底部按钮生成死因尾声)");
            useGameStore.setState({ phase: 'epilogue_pending' });
        } else if (currentTimeStr === "00:00" || (systemUpdates.timeCost && systemUpdates.timeCost >= 4320)) {
            // 超时判断机制
            useGameStore.getState().addHistoryObject("系统", "⏳ 时间已经耗尽... 世界即将封闭...\n(请点击底部按钮生成结局尾声)");
            useGameStore.setState({ phase: 'epilogue_pending' });
        }

        // 4. 将计算后的最终属性写回 store
        useGameStore.getState().setPlayerStats({
            hp: currentHp,
            time: currentTimeStr,
            inventory: currentInv
        });

        // 5. 记录本回合最终状态到本地文件 state_turn.log
        try {
            const currentState = useGameStore.getState();
            // 不发送整个庞大的函数和UI，只序列化核心数据模型
            const coreState = {
                phase: currentState.phase,
                player: currentState.player,
                background: currentState.background,
            };
            fetch('/api/save-log', {
                method: 'POST',
                body: JSON.stringify({
                    filename: 'state_turn.log',
                    content: `============================\n[本轮更新后完整状态机数据]\n============================\n${JSON.stringify(coreState, null, 2)}\n`
                })
            });
        } catch (e) {
            // ignore JSON error
        }
    },

    /**
     * 流式模式专用：在所有段落已通过 onParagraph 推送到 history 后，
     * 用完整原文做最终的 System 标签解析和状态更新。
     * @param rawLlmResponse 完整的 LLM 回复原文
     */
    processStreamingFinalState(rawLlmResponse: string) {
        const parsed = ActionParser.parseResponse(rawLlmResponse);
        const { systemUpdates, hasDeathFlag, hasGameOverFlag, actions } = parsed;

        // 更新可用行动选项
        useGameStore.getState().setAvailableActions(actions);

        // 如果解析到了新的阶段性目标回顾，同步更新到 HUD
        if (parsed.goal) {
            useGameStore.getState().setGoal(parsed.goal);
        }

        // --- 处理移除物品 ---
        const currentInv = [...useGameStore.getState().player.inventory];
        if (systemUpdates.itemsRemoved && systemUpdates.itemsRemoved.length > 0) {
            systemUpdates.itemsRemoved.forEach(removeItemName => {
                const idx = currentInv.findIndex(i => i.name === removeItemName);
                if (idx !== -1) currentInv.splice(idx, 1);
            });
        }

        // --- 处理获得物品 ---
        if (systemUpdates.itemsAdded && systemUpdates.itemsAdded.length > 0) {
            systemUpdates.itemsAdded.forEach(addItemName => {
                const match = addItemName.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)\s*(.*)/u);
                let newIcon = "💠";
                let cleanName = addItemName;
                if (match && match[1]) {
                    newIcon = match[1];
                    cleanName = match[2] ? match[2].trim() : addItemName;
                } else {
                    if (/(刀|剑|枪|武器|匕首|手枪)/.test(addItemName)) newIcon = "🗡️";
                    else if (/(纸|信|线索|卷宗|书|照片|图)/.test(addItemName)) newIcon = "📄";
                    else if (/(药|绷带|急救包|胶囊)/.test(addItemName)) newIcon = "💊";
                    else if (/(钥匙|锁|卡)/.test(addItemName)) newIcon = "🔑";
                    else if (/(食物|肉|面包|水|饮料)/.test(addItemName)) newIcon = "🥫";
                    else newIcon = "📦";
                }
                currentInv.push({ name: cleanName, icon: newIcon });
                useGameStore.getState().addNotification(`获得了：${cleanName}`);
            });
        }

        // --- 处理生命值 ---
        let currentHp = useGameStore.getState().player.hp;
        if (systemUpdates.hpChanged) {
            currentHp += systemUpdates.hpChanged;
            if (currentHp > 100) currentHp = 100;
            if (systemUpdates.hpChanged < 0) {
                useGameStore.getState().triggerScreenShake();
            }
        }

        // --- 处理时间流逝 ---
        let currentTimeStr = useGameStore.getState().player.time;
        if (systemUpdates.timeCost) {
            const [hours, minutes] = currentTimeStr.split(":").map(Number);
            const totalMinutes = (hours * 60) + minutes + systemUpdates.timeCost;
            const newHours = Math.floor(totalMinutes / 60) % 24;
            const newMins = totalMinutes % 60;
            currentTimeStr = `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`;
        }

        // --- 全局拦截器 ---
        if (hasGameOverFlag) {
            useGameStore.getState().addHistoryObject("系统", "【游戏结束】");
            useGameStore.setState({ phase: 'fail' });
        } else if (hasDeathFlag || currentHp <= 0) {
            currentHp = 0;
            useGameStore.getState().addHistoryObject("系统", "⚠️ 你的生命已燃尽... 正在观测终焉 ⚠️\n(请点击底部按钮生成死因尾声)");
            useGameStore.setState({ phase: 'epilogue_pending' });
        } else if (currentTimeStr === "00:00" || (systemUpdates.timeCost && systemUpdates.timeCost >= 4320)) {
            useGameStore.getState().addHistoryObject("系统", "⏳ 时间已经耗尽... 世界即将封闭...\n(请点击底部按钮生成结局尾声)");
            useGameStore.setState({ phase: 'epilogue_pending' });
        }

        // 写回 store
        useGameStore.getState().setPlayerStats({
            hp: currentHp,
            time: currentTimeStr,
            inventory: currentInv
        });

        // 记录状态日志
        try {
            const currentState = useGameStore.getState();
            const coreState = {
                phase: currentState.phase,
                player: currentState.player,
                background: currentState.background,
            };
            fetch('/api/save-log', {
                method: 'POST',
                body: JSON.stringify({
                    filename: 'state_turn.log',
                    content: `============================\n[本轮更新后完整状态机数据]\n============================\n${JSON.stringify(coreState, null, 2)}\n`
                })
            });
        } catch (e) { }
    }
};
