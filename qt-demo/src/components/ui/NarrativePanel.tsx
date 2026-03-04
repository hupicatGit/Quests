import React, { useRef, useEffect, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { FadeInText } from './FadeInText';
import { RichText } from './RichText';
import { GameController } from '../../utils/gameController';
import { LLMService } from '../../services/llmService';
import { GAME_CONFIG } from '../../gameConfig';

export const NarrativePanel: React.FC = () => {
    const { history, ui, phase, addHistoryObject, setShowActionMenu } = useGameStore();
    const { isAppreciating, showActionMenu } = ui;
    const [customInput, setCustomInput] = useState('');
    const [revealedCount, setRevealedCount] = useState(0); // 当前在此轮对话中已“点开”的消息数
    const [isMessageFinished, setIsMessageFinished] = useState(false); // 当前打字效果是否完成
    const scrollRef = useRef<HTMLDivElement>(null);

    // 当 history 长度增加时，如果之前没有消息，开始从第一条（或新回合的第一条）显现
    useEffect(() => {
        // 如果是从空到有的新回合，或是重置，确保 revealedCount 符合逻辑
        if (history.length > 0 && revealedCount >= history.length) {
            setRevealedCount(history.length - 1);
        }

        // 新增逻辑：如果当前最后显示的是玩家信息，且有了新的后续消息（AI 回复了），自动显示第一条回复
        const isCurrentPlayer = history[revealedCount]?.speaker === '玩家';
        if (isCurrentPlayer && revealedCount < history.length - 1) {
            setRevealedCount(prev => prev + 1);
        }

        setIsMessageFinished(false);
    }, [history.length]);

    const handleNext = () => {
        if (showActionMenu) return;

        // 如果打字还没结束，暂时不支持手动跳过，或者可以留给未来
        if (!isMessageFinished && history[revealedCount]?.speaker !== '玩家') {
            return;
        }

        if (revealedCount < history.length - 1) {
            setRevealedCount(prev => prev + 1);
            setIsMessageFinished(false);
        } else {
            // 所有消息都显示完了，且打字机也停止了，显示菜单
            if (history.length > 0 && history[history.length - 1].speaker !== '玩家') {
                setShowActionMenu(true);
            }
        }
    };

    // 自动滚动到底部
    useEffect(() => {
        if (scrollRef.current) {
            const behavior = showActionMenu ? 'smooth' : 'auto';
            scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior });
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
            setIsMessageFinished(false);
        }
    }, [phase]);

    const handleAction = async (title: string) => {
        if (!title.trim()) return;
        addHistoryObject('玩家', title);
        // 立即展示玩家的台词，不等待点击
        setRevealedCount(prev => prev + 1);
        setShowActionMenu(false);
        setCustomInput('');
        setIsMessageFinished(false);

        if (GAME_CONFIG.llm.streaming) {
            // ---- 流式路径：段落到齐即展示 ----
            const fullText = await LLMService.sendPlayerActionStreaming(title, (paragraph) => {
                // 每收到一个段落，直接推入 history 并立即展示
                useGameStore.getState().addHistoryObject('叙述者', paragraph);
            });
            // 流结束：用完整文本做系统标签解析和状态更新
            GameController.processStreamingFinalState(fullText);
        } else {
            // ---- 非流式路径：保持不变 ----
            const responseData = await LLMService.sendPlayerAction(title);
            GameController.processLLMResponse(responseData);
        }
    };

    // 消息结束的回调
    const handleOneMessageFinished = () => {
        setIsMessageFinished(true);

        // 核心自动化逻辑：如果当前还有后续消息（且非玩家发出的），或是最后一段叙述，自动推进
        if (revealedCount < history.length - 1) {
            // 短暂延迟后自动显示下一段
            setTimeout(() => {
                setRevealedCount(prev => prev + 1);
                setIsMessageFinished(false);
            }, 800);
        } else {
            // 最后一段结束，且不处于正在显示菜单状态，则自动弹出
            if (history.length > 0 && history[history.length - 1].speaker !== '玩家') {
                setTimeout(() => {
                    setShowActionMenu(true);
                }, 500);
            }
        }
    };

    // 实时滚动到底部（打字过程中）
    const handleIteration = () => {
        if (scrollRef.current) {
            // 在打字过程中，使用更加即时的滚动
            scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'auto' });
        }
    };

    // 如果是玩家发出的，不经过打字机，直接结束
    useEffect(() => {
        if (history.length > 0 && history[revealedCount]?.speaker === '玩家') {
            setIsMessageFinished(true);
        }
    }, [revealedCount, history]);

    if (isAppreciating) return null;

    return (
        <div
            className={`absolute right-0 top-0 w-full md:w-[50vw] lg:w-[44%] xl:w-[38.5vw] max-w-[770px] h-full z-20 flex flex-col pointer-events-none transition-all duration-700 ease-[cubic-bezier(0.19,1,0.22,1)] ${isAppreciating ? 'translate-x-[110%] opacity-0' : 'translate-x-0 opacity-100'}`}
        >
            {/* 右侧背景/遮罩 */}
            <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black via-black/60 to-transparent z-10 pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-l from-black via-black/95 via-40% to-transparent backdrop-blur-[2px] -z-10" />

            {/* 滚动内容区 */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-8 md:px-12 pt-40 pb-48 no-scrollbar pointer-events-auto space-y-8 selection:bg-white/20 cursor-pointer scroll-smooth"
                onClick={handleNext}
                style={{
                    maskImage: 'linear-gradient(to bottom, transparent 0%, black 150px, black 85%, transparent 100%)',
                    WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 150px, black 85%, transparent 100%)'
                }}
            >
                {/* 历史消息展现逻辑：0 到 revealedCount */}
                {history.slice(0, revealedCount + 1).map((msg, idx) => {
                    const isRevealingNow = idx === revealedCount;
                    const isPlayer = msg.speaker === '玩家';

                    return (
                        <div key={idx} className={`${isPlayer ? 'my-6 animate-in fade-in slide-in-from-bottom-4 duration-[800ms]' : ''}`}>
                            {isPlayer ? (
                                <div className="player-choice-card p-6 md:p-8 rounded-lg border-l-4 border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.15)] relative group overflow-hidden">
                                    {/* 背景装饰 */}
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-3xl -mr-16 -mt-16 rounded-full" />

                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="h-[2px] w-8 bg-gradient-to-r from-amber-600 to-amber-400" />
                                        <span className="text-[10px] md:text-xs tracking-[0.3em] font-black uppercase text-amber-500 glow-text-gold">
                                            Individual Choice
                                        </span>
                                        <div className="h-[1px] flex-1 bg-amber-900/30" />
                                    </div>

                                    <div className="relative">
                                        <div className="absolute -left-4 top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-amber-500/50 to-transparent" />
                                        <p className="text-xl md:text-2xl leading-relaxed tracking-wide font-medium text-amber-50 text-pretty italic">
                                            <RichText text={msg.text} quote />
                                        </p>
                                    </div>

                                    <div className="mt-4 flex justify-end">
                                        <span className="text-[9px] tracking-[0.2em] text-amber-500/40 font-mono uppercase">
                                            Fate Sealed — {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-white/90">
                                    <div className="flex items-center gap-3 opacity-50 mb-1.5 focus:opacity-100">
                                        <div className="h-[1px] w-6 bg-white/70" />
                                        <span className="text-[10px] md:text-xs tracking-[0.2em] font-bold uppercase text-white">
                                            {msg.speaker}
                                        </span>
                                    </div>
                                    <p className="text-lg md:text-xl leading-[1.8] tracking-wide font-light antialiased">
                                        {isRevealingNow ? (
                                            <FadeInText
                                                text={msg.text}
                                                onComplete={handleOneMessageFinished}
                                                onIteration={handleIteration}
                                                quote
                                            />
                                        ) : (
                                            <RichText text={msg.text} quote />
                                        )}
                                    </p>
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* 点击继续提示 (仅在非自动化或调试时作为补充，目前流程已全自动，暂时隐藏减少视觉噪音) */}
                {/* 
                {!showActionMenu && isMessageFinished && revealedCount < history.length - 1 && (
                    <div className="text-white/20 text-[10px] tracking-[0.4em] animate-pulse py-4 text-center">
                        ● CLICK TO PROCEED
                    </div>
                )}
                */}

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
                                        <RichText
                                            text={action.title}
                                            quote
                                            className="text-[1.26rem] group-hover:text-amber-400 text-neutral-100 font-medium transition-colors leading-snug"
                                        />
                                        <RichText
                                            text={`— ${action.detail}`}
                                            className="text-[13.2px] text-white/40 font-light italic"
                                        />
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

                {/* 等待提示：仅在真正没有后续动作、且没有显示菜单时才显示 (例如刚发完请求尚未得到回复) */}
                {!showActionMenu && history.length > 0 && isMessageFinished && revealedCount >= history.length - 1 && (
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
