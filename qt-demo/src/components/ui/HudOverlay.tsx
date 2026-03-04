import React from 'react';
import { useGameStore } from '../../store/gameStore';
import { RichText } from './RichText';

export const HudOverlay: React.FC = () => {
    const { player, background, goal, ui, toggleAppreciateMode } = useGameStore();
    const { isAppreciating } = ui;

    // 赏析状态下淡出所有HUD
    const hudOpacityClass = isAppreciating ? "opacity-0 pointer-events-none" : "opacity-100";

    return (
        <>
            {/* 左上角：场景标示 (赏析模式唯一可见) */}
            <div className={`absolute top-10 left-10 z-[100] transition-all duration-1000 ease-in-out pointer-events-none`}>
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-4">
                        <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                        <span className={`text-white text-3xl md:text-4xl font-light tracking-[0.3em] uppercase drop-shadow-[0_0_20px_rgba(255,255,255,0.7)] ${isAppreciating ? 'shadow-black/80' : ''} `}>
                            {player.currentScene}
                        </span>
                    </div>
                    <div className="flex items-center gap-3 pl-5">
                        <span className="text-amber-500/80 text-xs md:text-sm tracking-[0.5em] font-mono font-bold">
                            {background.deadline}
                        </span>
                        <div className="h-[1px] w-24 bg-gradient-to-r from-amber-500/50 to-transparent" />
                    </div>
                </div>
            </div>

            {/* 下方悬浮状态栏 */}
            <div className={`absolute bottom-10 left-10 z-50 flex gap-6 transition-all duration-700 ease-in-out ${hudOpacityClass} `}>

                {/* HP 管 */}
                <div className="bg-black/40 backdrop-blur-xl px-5 py-3 border-l-[3px] border-red-500 shadow-2xl flex items-center gap-4 group">
                    <span className="text-red-500 text-[10px] md:text-xs font-black tracking-widest uppercase">HP</span>
                    <div className="w-32 md:w-48 h-2 bg-white/10 overflow-hidden relative">
                        <div
                            className="absolute top-0 left-0 h-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)] transition-all duration-1000"
                            style={{ width: `${player.hp}%` }}
                        />
                    </div>
                    <span className="text-white text-sm md:text-base tabular-nums font-bold">
                        {player.hp}
                    </span>
                </div>

                {/* 资源面板 */}
                <div className="flex gap-4 ml-4">
                    {/* 循环渲染背包 */}
                    {player.inventory.map((item, idx) => (
                        <div key={idx} className="flex flex-col items-center">
                            <div className="w-12 h-12 bg-white/10 rounded-sm border border-white/20 flex items-center justify-center text-3xl shadow-[0_0_10px_rgba(255,255,255,0.1)]">
                                {item.icon}
                            </div>
                            <span className="text-[10px] text-white/60 mt-1 scale-90 text-center leading-tight w-16 break-all line-clamp-2">{item.name}</span>
                        </div>
                    ))}
                </div>

                <div className="flex gap-1 ml-auto">
                    <div className="bg-black/40 backdrop-blur-xl px-5 py-3 border-l-[3px] border-indigo-500 shadow-2xl flex flex-col justify-center">
                        <span className="text-indigo-400 text-[9px] uppercase tracking-[0.2em] font-bold">Points</span>
                        <span className="text-white text-base font-medium">{player.points}</span>
                    </div>
                    <div className="bg-black/40 backdrop-blur-xl px-5 py-3 border-l-[3px] border-emerald-500 shadow-2xl flex flex-col justify-center">
                        <span className="text-emerald-500 text-[9px] uppercase tracking-[0.2em] font-bold">Time left</span>
                        <span className="text-white text-base font-mono font-medium">{player.time}</span>
                    </div>
                </div>

            </div>

            {/* 右侧全局系统按钮区 */}
            <div className={`absolute top-10 right-12 z-50 flex gap-8 transition-opacity duration-700 ${hudOpacityClass} `}>
                <button
                    className="text-white/40 hover:text-white text-[10px] tracking-[0.3em] uppercase transition-colors"
                    onClick={toggleAppreciateMode}
                >
                    Hide UI
                </button>
                <button
                    className="text-white/40 hover:text-emerald-400 text-[10px] tracking-[0.3em] uppercase transition-colors"
                    onClick={async () => {
                        const state = useGameStore.getState();
                        // 获取开场白：从头到直到第一个玩家行动前的所有叙述者消息拼接
                        const firstPlayerActionIdx = state.history.findIndex(h => h.speaker === '玩家');
                        const prologueMsgs = firstPlayerActionIdx !== -1
                            ? state.history.slice(0, firstPlayerActionIdx)
                            : state.history;
                        const prologue = prologueMsgs
                            .filter(h => h.speaker === '叙述者')
                            .map(h => h.text)
                            .join('\n\n');

                        const payload = {
                            backgroundId: state.background.id,
                            prologue,
                            goal: state.goal,
                            deadline: state.background.deadline,
                            playerOverrides: {
                                hp: state.player.hp,
                                points: state.player.points,
                                time: state.player.time,
                            },
                            worldState: {
                                player: {
                                    hp: state.player.hp,
                                    currentScene: state.player.currentScene,
                                    inventory: state.player.inventory,
                                    perks: state.player.perks,
                                },
                                worldMap: state.background.worldMap ? {
                                    scenes: Object.entries(state.background.worldMap.scenes).map(([name, desc]) => ({ name, description: desc, matchedImage: null })),
                                    connections: state.background.worldMap.connections,
                                    characters: Object.entries(state.background.worldMap.charactersInScene || {}).flatMap(([loc, chars]) =>
                                        chars.map(c => ({ ...c, location: loc, matchedImage: c.icon }))
                                    ),
                                    interactables: Object.entries(state.background.worldMap.interactablesInScene || {}).flatMap(([loc, items]) =>
                                        items.map(i => ({ ...i, location: loc }))
                                    ),
                                } : {},
                                worldBackdrop: state.worldBackdrop,
                            },
                        };

                        try {
                            const res = await fetch('/api/save-scenario', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(payload),
                            });
                            const result = await res.json();
                            if (result.success) {
                                useGameStore.getState().addNotification(`💾 剧本已保存: ${result.scenarioId}`);
                            } else {
                                throw new Error(result.error || 'Server error');
                            }
                        } catch (e) {
                            console.error("保存剧本失败:", e);
                            useGameStore.getState().addNotification(`❌ 保存失败: ${String(e)}`);
                        }
                    }}
                >
                    Save
                </button>
                <button className="text-white/40 hover:text-white text-[10px] tracking-[0.3em] uppercase transition-colors">
                    Menu
                </button>
            </div>

            {/* 底部目标提示 */}
            <div className={`absolute bottom-32 left-10 w-72 md:w-80 bg-black/60 backdrop-blur-2xl p-6 border-l-[3px] border-amber-500 shadow-2xl transition-all duration-700 z-50 ${hudOpacityClass} `}>
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                    <span className="text-amber-400 text-[10px] tracking-[0.3em] font-black uppercase">Current Objective</span>
                </div>
                <RichText
                    text={goal}
                    className="text-white text-sm md:text-base leading-relaxed font-light tracking-wide"
                />
            </div>

        </>
    );
};
