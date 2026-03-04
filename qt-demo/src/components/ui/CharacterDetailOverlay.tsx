import React from 'react';
import { useGameStore } from '../../store/gameStore';
import { RichText } from './RichText';

export const CharacterDetailOverlay: React.FC = () => {
    const { background, ui, setShowCharacterDetail } = useGameStore();
    const { showCharacterDetail } = ui;

    if (!showCharacterDetail) return null;

    // 从 worldMap 中寻找当前人物的详细描述
    const currentScene = useGameStore.getState().player.currentScene;
    const sceneChars = background.worldMap?.charactersInScene[currentScene] || [];
    const character = sceneChars.find(c => c.name === showCharacterDetail);

    // 拼接立绘路径
    const characterImageUrl = character?.icon
        ? `/resources/${background.id}/characters/${character.icon}`
        : null;

    // 获取姓名和描述
    const name = character?.name || showCharacterDetail;
    const description = character?.description || "关于该人物的更多背景信息尚不明确。";

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 md:p-12 animate-in fade-in duration-500 pointer-events-auto"
            onClick={() => setShowCharacterDetail(null)}
        >
            {/* 磨砂背景遮罩 */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-xl" />

            {/* 并行布局容器 */}
            <div
                className="relative flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16 max-w-7xl w-full"
                onClick={(e) => e.stopPropagation()}
            >
                {/* 1. 外部大立绘展示 */}
                <div className="relative w-72 md:w-[450px] lg:w-[550px] aspect-[3/4] md:aspect-auto md:h-[85vh] animate-in slide-in-from-left-20 fade-in duration-1000 ease-out flex-shrink-0">
                    {characterImageUrl ? (
                        <img
                            src={characterImageUrl}
                            alt={name}
                            className="w-full h-full object-contain filter drop-shadow-[0_0_40px_rgba(0,0,0,0.8)]"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center border border-white/5 bg-white/5 text-white/5 uppercase tracking-[1em] font-black text-6xl -rotate-12">
                            VOID
                        </div>
                    )}
                </div>

                {/* 2. 独立的信息卡片 */}
                <div
                    className="relative w-full max-w-xl bg-zinc-900/90 border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.5)] rounded-sm overflow-hidden animate-in slide-in-from-right-20 fade-in duration-1000 delay-150 ease-out"
                >
                    {/* 装饰线条 */}
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-amber-500/50 to-transparent z-10" />

                    <div className="p-8 md:p-12 flex flex-col gap-6 relative">
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-4">
                                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                                <h2 className="text-3xl md:text-5xl font-light tracking-[0.2em] text-white uppercase">
                                    {name}
                                </h2>
                            </div>
                            <p className="text-zinc-400 text-[10px] md:text-xs tracking-[0.4em] font-bold uppercase opacity-40 ml-5">
                                Character Dossier
                            </p>
                        </div>

                        <div className="h-[1px] w-24 bg-gradient-to-r from-white/20 to-transparent" />

                        <div className="space-y-6 flex-1 min-h-[200px]">
                            <RichText
                                text={description}
                                quote
                                className="text-white/95 text-xl md:text-2xl leading-relaxed font-light tracking-wide italic antialiased"
                            />
                        </div>

                        <div className="mt-4 pt-8 border-t border-white/5 flex justify-end">
                            <button
                                className="group flex items-center gap-4 px-8 py-3 bg-white/5 border border-white/10 hover:border-amber-500/50 hover:bg-white/10 transition-all duration-300"
                                onClick={() => setShowCharacterDetail(null)}
                            >
                                <span className="text-[10px] text-white/40 group-hover:text-amber-500 tracking-[0.4em] uppercase font-bold transition-colors">
                                    Acknowledge
                                </span>
                                <div className="w-1.5 h-1.5 bg-white/20 group-hover:bg-amber-500 rounded-full transition-colors" />
                            </button>
                        </div>

                        {/* 背景大装饰文字 */}
                        <div className="absolute -bottom-6 -right-6 text-[12rem] font-black text-white/[0.02] select-none pointer-events-none uppercase tracking-tighter -rotate-6">
                            FILE
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
