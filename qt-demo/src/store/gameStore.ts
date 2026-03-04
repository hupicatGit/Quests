import { create } from 'zustand';
import { GAME_CONFIG } from '../gameConfig';
import { backgroundRegistry } from '../backgrounds';


// 游戏阶段枚举
export type GamePhase = 'initializing' | 'playing' | 'epilogue_pending' | 'success' | 'fail' | 'idle';

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
    resetGame: () => void;
}

export const useGameStore = create<GameState>((set) => {
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
    };
});
