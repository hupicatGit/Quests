import React from 'react';
import { useGameStore } from '../../store/gameStore';
import { CharacterDetailOverlay } from '../ui/CharacterDetailOverlay';

export const GameLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { visuals, ui, toggleAppreciateMode, setShowCharacterDetail } = useGameStore();
    const { isAppreciating, screenShake, notifications } = ui;

    return (
        <div className={`w-[100vw] h-[100vh] bg-black overflow-hidden relative selection:bg-indigo-500/30 ${screenShake ? 'animate-shake' : ''}`}>

            {/* 受击红屏闪烁层 */}
            {screenShake && (
                <div className="absolute inset-0 z-[60] pointer-events-none bg-red-600/30 mix-blend-color-burn animate-in fade-in duration-100" />
            )}
            {/* 1. 最底层全屏背景图 + 呼吸动效 */}
            <div
                className="absolute inset-0 w-full h-full cursor-pointer z-0"
                onClick={() => isAppreciating && toggleAppreciateMode()}
            >
                {visuals.backgroundImage ? (
                    <img
                        src={visuals.backgroundImage}
                        className="w-full h-full object-cover animate-breath opacity-90 transition-opacity duration-1000"
                        alt="Background"
                        draggable={false}
                    />
                ) : (
                    <div className="w-full h-full bg-gradient-to-b from-slate-900 to-black" />
                )}
                {/* 全局暗色叠加层，保证深邃的悬疑感和文字对比度 */}
                <div className="absolute inset-0 bg-black/40 mix-blend-multiply" />
            </div>

            {/* 2. 靠左/居中的大比例角色立绘 */}
            <div
                className={`absolute left-[5%] md:left-[10%] lg:left-[15%] bottom-0 h-[80vh] md:h-[90vh] z-10 transition-all duration-[1500ms] ease-out pointer-events-auto drop-shadow-[0_0_50px_rgba(0,0,0,0.8)]
          ${isAppreciating ? 'scale-105 brightness-110' : 'scale-100 brightness-[0.85]'}
        `}
            >
                {visuals.characterImage && (
                    <div
                        className="relative w-full h-full cursor-pointer group"
                        onClick={() => setShowCharacterDetail(visuals.characterName)}
                    >
                        <img
                            src={visuals.characterImage}
                            className="w-full h-full object-contain object-bottom transition-all duration-500 group-hover:brightness-110 group-hover:scale-[1.02]"
                            alt={visuals.characterName || "Character"}
                            draggable={false}
                        />
                        {/* 底部立绘遮罩，使其融入阴影 */}
                        <div className="absolute inset-x-0 bottom-0 h-[30vh] bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none" />

                        {/* 悬浮提示 */}
                        <div className="absolute bottom-[20%] left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                            <span className="text-[10px] text-white/40 tracking-[0.5em] uppercase whitespace-nowrap bg-black/40 backdrop-blur-sm px-4 py-2 border border-white/10">
                                View Profile
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* 3. 系统提示飘字 (左侧或上方堆叠) */}
            <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[70] flex flex-col gap-3 pointer-events-none">
                {notifications.map((note) => (
                    <div
                        key={note.id}
                        className="bg-black/80 backdrop-blur-md border border-white/20 px-6 py-3 rounded-full shadow-[0_5px_20px_rgba(0,0,0,0.5)] flex items-center gap-3 animate-in slide-in-from-top-4 fade-in duration-300"
                    >
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-white text-sm font-medium tracking-widest">{note.message}</span>
                    </div>
                ))}
            </div>

            {/* 4. 子组件注入层 (HUD, 文本框, 菜单等) */}
            <div className="absolute inset-0 z-20 pointer-events-none">
                {children}
            </div>

            {/* 5. 人物详情弹出层 */}
            <CharacterDetailOverlay />
        </div>
    );
};
