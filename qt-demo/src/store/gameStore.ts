import { create } from 'zustand';
import { GAME_CONFIG } from '../gameConfig';
import { backgroundRegistry } from '../backgrounds';


// 游戏阶段枚举
export type GamePhase = 'initializing' | 'playing' | 'epilogue_pending' | 'success' | 'fail' | 'idle';

// 状态效果类型
export interface StatusEffect {
    id: string;          // 唯一标识
    name: string;        // 状态名称，如"头疼"
    damage: number;      // 每回合扣血量 (正面状态为0)
    description: string; // UI 显示的发作描述，如"你因头疼感到阵阵眩晕"
    type: 'negative' | 'positive'; // 正面/负面
    evaluated: boolean;  // 是否已被助手LLM评估修正
}

// 状态弹窗数据
export interface StatusDialogData {
    visible: boolean;
    messages: string[];   // 本回合状态发作的提示列表
    totalDamage: number;  // 本回合总扣血
    onConfirm: (() => void) | null; // 玩家确认后的回调
}

export interface InitialWorldData {
    player: {
        hp: number;
        currentScene: string;
        inventory: Array<{ name: string; icon: string }>;
        perks: string[];
    };
    // 整个世界的箱庭地图结构，及其所有人物的位置分布
    worldMap: {
        scenes: Array<{ name: string; description: string; matchedImage: string | null }>;
        connections: Record<string, string[]>; // 场景的连接关系: sceneName -> [connectedSceneNames]
        characters: Array<{
            name: string;
            description: string;
            location: string;
            matchedImage: string | null;
        }>;
        interactables: Array<{
            name: string;
            description: string;
            location: string;
        }>;
    };
    worldBackdrop: string;
}

// 状态类型定义
export interface GameState {
    player: {
        hp: number;
        points: number;
        time: string; // 格式: "HH:mm"
        currentScene: string; // 玩家当前所在场景
        inventory: Array<{ name: string; icon: string }>;
        perks: string[]; // 玩家技能/天赋
        statuses: StatusEffect[]; // 当前持有的状态效果
    };
    background: {
        id: string; // 背景ID，用于加载本地资源映射
        name: string;
        deadline: string;
        // 存储本图内已知场景与人物关系的简要数据
        worldMap?: {
            scenes: Record<string, string>; // name -> description
            connections: Record<string, string[]>;
            charactersInScene: Record<string, Array<{ name: string; description: string; icon: string | null }>>;
            interactablesInScene: Record<string, Array<{ name: string; description: string }>>;
        };
    };
    visuals: {
        backgroundImage: string;
        characterImage: string | null;
        characterName: string | null;
    };
    history: Array<{
        speaker: string;
        text: string;
    }>;
    goal: string; // 当前任务目标（独立于 background）
    phase: GamePhase;
    loadingStatus: string; // 初始化时的详细进度
    ui: {
        isAppreciating: boolean; // 是否处于纯享赏析模式 (隐藏UI)
        showActionMenu: boolean; // 是否正在显示决策菜单
        isWaitingForLLM: boolean; // 是否正在等待LLM返回
        screenShake: boolean;    // 是否触发受击震动
        notifications: Array<{ id: string, message: string }>; // 物品获取等飘字消息
        availableActions: Array<{ id: number, title: string, detail: string }>; // 当前可用行动选项
        showCharacterDetail: string | null; // 当前展示详情的人物名称
        statusDialog: StatusDialogData; // 状态发作弹窗数据
    };
    worldBackdrop: string; // 潜意识缓存的底稿
    // Actions
    setLoadingStatus: (status: string) => void;
    injectInitialWorldState: (data: InitialWorldData) => void;
    setAvailableActions: (actions: Array<{ id: number, title: string, detail: string }>) => void;
    setPlayerStats: (stats: Partial<GameState['player']>) => void;
    setBackgroundInfo: (info: Partial<GameState['background']>) => void;
    setGoal: (goal: string) => void;
    addHistoryObject: (speaker: string, text: string) => void;
    setVisuals: (visuals: Partial<GameState['visuals']>) => void;
    toggleAppreciateMode: () => void;
    setShowActionMenu: (show: boolean) => void;
    triggerScreenShake: () => void;
    addNotification: (message: string) => void;
    removeNotification: (id: string) => void;
    setShowCharacterDetail: (name: string | null) => void;
    setIsWaitingForLLM: (isWaiting: boolean) => void;
    // 状态效果相关 Actions
    addStatus: (status: StatusEffect) => void;
    removeStatus: (name: string) => void;
    updateStatus: (name: string, updates: Partial<StatusEffect>) => void;
    applyStatusEffects: () => { totalDamage: number; messages: string[]; isDeath: boolean };
    showStatusDialog: (data: Omit<StatusDialogData, 'visible'>) => void;
    hideStatusDialog: () => void;
    resetGame: () => void;
}

export const useGameStore = create<GameState>((set, get) => {
    // 初始状态定义提取出来供重置使用
    const getInitialState = () => {
        const bg = backgroundRegistry[GAME_CONFIG.backgroundId] || { id: "unknown", name: "未知世界" };
        return {
            player: {
                hp: 100,
                points: 100,
                time: "",
                currentScene: "",
                inventory: [],
                perks: [],
                statuses: [],
            },
            background: {
                id: bg.id,
                name: bg.name,
                deadline: "",
            },
            visuals: {
                backgroundImage: "",
                characterImage: null,
                characterName: null,
            },
            history: [],
            goal: "",
            worldBackdrop: "",
            phase: 'initializing' as GamePhase,
            loadingStatus: "",
            ui: {
                isAppreciating: false,
                showActionMenu: false,
                isWaitingForLLM: false,
                screenShake: false,
                notifications: [],
                availableActions: [],
                showCharacterDetail: null,
                statusDialog: { visible: false, messages: [], totalDamage: 0, onConfirm: null },
            },
        };
    };

    return {
        ...getInitialState(),

        resetGame: () => set(getInitialState()),

        setLoadingStatus: (status) => set({ loadingStatus: status }),

        injectInitialWorldState: (data) => {
            // 增加基础防御性检查，防止数据格式错误导致前端死锁
            if (!data || !data.player || !data.worldMap) {
                console.error("injectInitialWorldState received invalid data", data);
                return;
            }

            // 构建场景描述字典
            const scenesDict: Record<string, string> = {};
            let startBackground: string | null = null;
            if (data.worldMap && data.worldMap.scenes) {
                data.worldMap.scenes.forEach(s => {
                    scenesDict[s.name] = s.description;
                    if (s.name === data.player.currentScene) {
                        startBackground = s.matchedImage;
                    }
                });
            }

            // 构建场景人物索引表
            const charactersInScene: Record<string, Array<{ name: string; description: string; icon: string | null }>> = {};
            if (data.worldMap && data.worldMap.characters) {
                data.worldMap.characters.forEach(char => {
                    const loc = char.location;
                    if (!charactersInScene[loc]) {
                        charactersInScene[loc] = [];
                    }
                    charactersInScene[loc].push({ name: char.name, description: char.description, icon: char.matchedImage });
                });
            }

            // 构建场景可交互物索引表
            const interactablesInScene: Record<string, Array<{ name: string; description: string }>> = {};
            if (data.worldMap && data.worldMap.interactables) {
                data.worldMap.interactables.forEach(item => {
                    const loc = item.location;
                    if (!interactablesInScene[loc]) {
                        interactablesInScene[loc] = [];
                    }
                    interactablesInScene[loc].push({ name: item.name, description: item.description });
                });
            }

            // 尝试从当前场景中提取第一个可用的人物作为挂载的初始立绘
            const startChars = charactersInScene[data.player.currentScene] || [];
            const activeChar = startChars.length > 0 ? startChars[0] : null;

            set((state) => ({
                player: {
                    ...state.player,
                    hp: data.player.hp,
                    inventory: data.player.inventory,
                    perks: data.player.perks,
                    currentScene: data.player.currentScene
                },
                background: {
                    ...state.background,
                    worldMap: {
                        scenes: scenesDict,
                        connections: data.worldMap?.connections || {},
                        charactersInScene: charactersInScene,
                        interactablesInScene: interactablesInScene
                    }
                },
                visuals: {
                    ...state.visuals,
                    backgroundImage: startBackground
                        ? `/resources/${state.background.id}/images/${startBackground}`
                        : "",
                    characterImage: activeChar?.icon
                        ? `/resources/${state.background.id}/characters/${activeChar.icon}`
                        : null,
                    characterName: activeChar ? activeChar.name : null
                },
                worldBackdrop: data.worldBackdrop || "",
                phase: 'playing', // 状态数据接驳完成，解锁屏幕正式开始
                loadingStatus: "" // 清空进度文本
            }));
        },

        setAvailableActions: (actions) => set((state) => ({ ui: { ...state.ui, availableActions: actions } })),

        setPlayerStats: (stats) => set((state) => ({ player: { ...state.player, ...stats } })),
        setBackgroundInfo: (info) => set((state) => ({ background: { ...state.background, ...info } })),
        setGoal: (goal) => set({ goal }),
        addHistoryObject: (speaker, text) => set((state) => ({ history: [...state.history, { speaker, text }] })),
        setVisuals: (visuals) => set((state) => ({ visuals: { ...state.visuals, ...visuals } })),
        toggleAppreciateMode: () => set((state) => ({ ui: { ...state.ui, isAppreciating: !state.ui.isAppreciating } })),
        setShowActionMenu: (show) => set((state) => ({ ui: { ...state.ui, showActionMenu: show } })),
        triggerScreenShake: () => {
            set((state) => ({ ui: { ...state.ui, screenShake: true } }));
            setTimeout(() => {
                set((state) => ({ ui: { ...state.ui, screenShake: false } }));
            }, 500);
        },
        addNotification: (message) => {
            const id = Math.random().toString(36).substring(2, 9);
            set((state) => ({ ui: { ...state.ui, notifications: [...state.ui.notifications, { id, message }] } }));
            setTimeout(() => {
                set((state) => ({ ui: { ...state.ui, notifications: state.ui.notifications.filter(n => n.id !== id) } }));
            }, 3000);
        },
        removeNotification: (id: string) => set((state) => ({
            ui: { ...state.ui, notifications: state.ui.notifications.filter(m => m.id !== id) }
        })),
        setShowCharacterDetail: (name: string | null) => set((state) => ({
            ui: { ...state.ui, showCharacterDetail: name }
        })),
        setIsWaitingForLLM: (isWaiting: boolean) => set((state) => ({
            ui: { ...state.ui, isWaitingForLLM: isWaiting }
        })),

        // ========== 状态效果相关 ==========
        addStatus: (status: StatusEffect) => set((state) => {
            // 同名状态则更新，否则追加
            const existing = state.player.statuses.find(s => s.name === status.name);
            if (existing) {
                return {
                    player: {
                        ...state.player,
                        statuses: state.player.statuses.map(s =>
                            s.name === status.name ? { ...s, ...status } : s
                        ),
                    },
                };
            }
            return {
                player: {
                    ...state.player,
                    statuses: [...state.player.statuses, status],
                },
            };
        }),

        removeStatus: (name: string) => set((state) => ({
            player: {
                ...state.player,
                statuses: state.player.statuses.filter(s => s.name !== name),
            },
        })),

        updateStatus: (name: string, updates: Partial<StatusEffect>) => set((state) => ({
            player: {
                ...state.player,
                statuses: state.player.statuses.map(s =>
                    s.name === name ? { ...s, ...updates } : s
                ),
            },
        })),

        /**
         * 结算所有负面状态的伤害。
         * 注意：此方法会直接修改 store 中的 HP（后台扣血），但不会更新 UI 的显占位HP。
         * 返回本次结算的总伤害、各状态发作消息、是否致死。
         */
        applyStatusEffects: (): { totalDamage: number; messages: string[]; isDeath: boolean } => {
            const state = get();
            const negativeStatuses = state.player.statuses.filter((s: StatusEffect) => s.type === 'negative' && s.damage > 0);

            if (negativeStatuses.length === 0) {
                return { totalDamage: 0, messages: [], isDeath: false };
            }

            let totalDamage: number = 0;
            const messages: string[] = [];

            negativeStatuses.forEach((s: StatusEffect) => {
                totalDamage += s.damage;
                messages.push(s.description || `你因为${s.name}而感到痛苦`);
            });

            let newHp: number = state.player.hp - totalDamage;
            if (newHp < 0) newHp = 0;
            const isDeath: boolean = newHp <= 0;

            // 后台立即更新真实HP
            set((prev) => ({
                player: { ...prev.player, hp: newHp },
            }));

            return { totalDamage, messages, isDeath };
        },

        showStatusDialog: (data) => set((state) => ({
            ui: {
                ...state.ui,
                statusDialog: { ...data, visible: true },
            },
        })),

        hideStatusDialog: () => set((state) => ({
            ui: {
                ...state.ui,
                statusDialog: { visible: false, messages: [], totalDamage: 0, onConfirm: null },
            },
        })),
    };
});
