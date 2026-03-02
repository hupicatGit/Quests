import React, { useRef, useEffect, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { FadeInText } from './FadeInText';
import { GameController } from '../../utils/gameController';
import { LLMService } from '../../services/llmService';

export const NarrativePanel: React.FC = () => {
    const { history, ui, phase, addHistoryObject, setShowActionMenu } = useGameStore();
    const { isAppreciating, showActionMenu } = ui;
    const [customInput, setCustomInput] = useState('');
    const [revealedCount, setRevealedCount] = useState(0); // 当前在此轮对话中已“点开”的消息数
    const scrollRef = useRef<HTMLDivElement>(null);

    // 当 history 长度增加时，如果之前没有消息，开始从第一条（或新回合的第一条）显现
    useEffect(() => {
        // 如果是从空到有的新回合，或是重置，确保 revealedCount 符合逻辑
        if (history.length > 0 && revealedCount >= history.length) {
            setRevealedCount(history.length - 1);
        }
    }, [history.length]);

    const handleNext = () => {
        if (showActionMenu) return;
        if (revealedCount < history.length - 1) {
            setRevealedCount(prev => prev + 1);
        }
    };

    // 自动滚动到底部
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
        }
    }, [history, showActionMenu, revealedCount]);

    const currentActions = phase === 'epilogue_pending'
        ? [{ id: 1, title: '[面临终焉]', detail: '生成命运的审判 (尾声结算)' }]
        : (ui.availableActions.length > 0 ? ui.availableActions : [
            { id: 1, title: '撬开走廊尽头的铁门', detail: '使用小刀，可能惊动船员' },
            { id: 2, title: '跟随人群冲向楼梯间', detail: '可能发生踩踏' },
            { id: 3, title: '寻找其他三等舱乘客询问情况', detail: '安全但消耗时间' },
            { id: 4, title: '检查周围散落的物品', detail: '有机会获得道具' },
        ]);

    // 初始化时重置输入
    useEffect(() => {
        if (phase === 'initializing') {
            setCustomInput('');
        }
    }, [phase]);

    const handleAction = async (title: string) => {
        if (!title.trim()) return;
        addHistoryObject('玩家', title);
        setShowActionMenu(false);
        setCustomInput('');

        const responseData = await LLMService.sendPlayerAction(title);
        GameController.processLLMResponse(responseData);

        // 注意：无需 setTimeout，因为回复到来后会重置 revealedCount，玩家点完后自然会出现 ActionMenu
    };

    // 自动触发 ActionMenu 的逻辑
    const handleOneMessageFinished = () => {
        const isLastOne = revealedCount === history.length - 1;
        if (isLastOne) {
            if (history.length > 0 && history[history.length - 1].speaker !== '玩家') {
                setShowActionMenu(true);
            }
        } else {
            // 剧情瀑布瀑布流：自动显式下一条 (间隔 500ms)
            setTimeout(() => {
                setRevealedCount(prev => prev + 1);
            }, 500);
        }
    };

    // 如果是玩家发出的，不经过打字机，直接结束并显示下一条
    useEffect(() => {
        if (history.length > 0 && history[revealedCount]?.speaker === '玩家') {
            handleOneMessageFinished();
        }
    }, [revealedCount, history]);

    if (isAppreciating) return null;

    return (
        <div
            className={`absolute right-0 top-0 w-full md:w-[45vw] lg:w-[40%] xl:w-[35vw] max-w-[700px] h-full z-20 flex flex-col pointer-events-none transition-all duration-700 ease-[cubic-bezier(0.19,1,0.22,1)] ${isAppreciating ? 'translate-x-[110%] opacity-0' : 'translate-x-0 opacity-100'}`}
        >
            {/* 右侧背景/遮罩 */}
            <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black via-black/40 to-transparent z-10 pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-l from-black/95 via-black/80 to-transparent backdrop-blur-[2px] -z-10" />

            {/* 滚动内容区 */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-8 md:px-12 pt-40 pb-20 no-scrollbar pointer-events-auto space-y-8 selection:bg-white/20 cursor-pointer scroll-smooth"
                onClick={handleNext}
                style={{
                    maskImage: 'linear-gradient(to bottom, transparent 0%, black 150px, black 100%)',
                    WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 150px, black 100%)'
                }}
            >
                {/* 历史消息展现逻辑：0 到 revealedCount */}
                {history.slice(0, revealedCount + 1).map((msg, idx) => {
                    const isRevealingNow = idx === revealedCount;
                    const isPlayer = msg.speaker === '玩家';

                    return (
                        <div key={idx} className={`animate-in fade-in slide-in-from-bottom-4 duration-[800ms] ${isPlayer ? 'text-amber-100/80' : 'text-white/90'}`}>
                            <div className="flex items-center gap-3 opacity-50 mb-1.5 focus:opacity-100">
                                <div className={`h-[1px] w-6 ${isPlayer ? 'bg-amber-500' : 'bg-white/70'}`} />
                                <span className={`text-[10px] md:text-xs tracking-[0.2em] font-bold uppercase ${isPlayer ? 'text-amber-400' : 'text-white'}`}>
                                    {msg.speaker}
                                </span>
                            </div>
                            <p className="text-lg md:text-xl leading-[1.8] tracking-wide font-light antialiased">
                                {isRevealingNow && !isPlayer ? (
                                    <FadeInText
                                        text={msg.text}
                                        onComplete={handleOneMessageFinished}
                                    />
                                ) : (
                                    <span>"{msg.text}"</span>
                                )}
                            </p>
                        </div>
                    );
                })}

                {/* 点击继续提示 */}
                {!showActionMenu && revealedCount < history.length && (
                    <div className="text-white/20 text-[10px] tracking-[0.4em] animate-pulse py-4 text-center">
                        ● CLICK TO PROCEED
                    </div>
                )}

                {/* 选项区：融入文字流末尾 */}
                {showActionMenu && phase !== 'fail' && (
                    <div className="pt-4 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-3 duration-700">
                        {/* Decisions 标题行 */}
                        <div className="opacity-40 flex items-center gap-3">
                            <div className="h-[1px] w-8 bg-white" />
                            <span className="text-[10px] tracking-[0.6em] uppercase text-white font-black">Decisions</span>
                        </div>

                        {/* 选项列表 */}
                        <div className="space-y-2">
                            {currentActions.map((action) => (
                                <div
                                    key={action.id}
                                    className="group cursor-pointer flex gap-4 py-1.5 px-2 -ml-2 rounded transition-all duration-200 hover:bg-white/5"
                                    onClick={() => handleAction(action.title)}
                                >
                                    <span className="text-white/30 group-hover:text-amber-500 font-bold w-4 pt-0.5 shrink-0">{action.id}.</span>
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[1.05rem] group-hover:text-amber-400 text-neutral-100 font-medium transition-colors leading-snug">
                                            "{action.title}"
                                        </span>
                                        <span className="text-[11px] text-white/40 font-light italic">— {action.detail}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* 自定义输入 */}
                        {phase !== 'epilogue_pending' && (
                            <div className="group pt-4 border-t border-white/10">
                                <div className="flex items-center gap-3 mb-2 opacity-30 group-focus-within:opacity-90 transition-opacity duration-500">
                                    <div className="h-[1px] w-4 bg-indigo-400" />
                                    <span className="text-[9px] text-indigo-400 font-bold tracking-[0.3em] uppercase">User Intervention</span>
                                </div>
                                <div className="relative">
                                    <input
                                        type="text"
                                        className="w-full bg-black/40 backdrop-blur-xl border-b border-white/20 px-4 py-2.5 text-white placeholder:text-white/15 text-sm focus:outline-none focus:border-indigo-400 italic font-light transition-colors"
                                        placeholder="...输入你的自定义行动..."
                                        value={customInput}
                                        onChange={(e) => setCustomInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && customInput.trim()) handleAction(customInput);
                                        }}
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 text-[8px] group-focus-within:text-indigo-400 font-mono transition-colors">
                                        ENTER ↵
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* 等待提示 */}
                {!showActionMenu && history.length > 0 && (
                    <div className="text-white/20 text-[10px] tracking-[0.4em] animate-pulse py-4">
                        ● WAITING FOR ACTION
                    </div>
                )}
            </div>

            {/* 底部渐变遮罩 */}
            <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
        </div>
    );
};
