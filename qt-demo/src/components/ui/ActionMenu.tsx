import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { GameController } from '../../utils/gameController';
import { LLMService } from '../../services/llmService';

export const ActionMenu: React.FC = () => {
    const { ui, addHistoryObject, phase } = useGameStore();
    const { isAppreciating, showActionMenu, availableActions, isWaitingForLLM } = ui;
    const setShowActionMenu = useGameStore((state) => state.setShowActionMenu);
    const setIsWaitingForLLM = useGameStore((state) => state.setIsWaitingForLLM);
    const [customInput, setCustomInput] = useState("");

    if (isAppreciating || !showActionMenu || phase === 'fail') return null;

    // 根据阶段判定当前显示的行动列表
    const currentActions = phase === 'epilogue_pending'
        ? [{ id: 1, title: "[面临终焉]", detail: "生成命运的审判 (尾声结算)" }]
        : availableActions;

    const handleAction = async (title: string) => {
        // 将玩家决定记录进历史
        addHistoryObject("玩家", title);
        setIsWaitingForLLM(true);
        setCustomInput("");

        // 传递给独立封装的 LLMService (目前含延迟模拟及控制台打印 Prompt)
        const responseData = await LLMService.sendPlayerAction(title);

        GameController.processLLMResponse(responseData);

        // 模拟回复结束后结束等待状态
        setTimeout(() => {
            setIsWaitingForLLM(false);
        }, 1500); // UI 的小延迟，让玩家看清文字
    };

    return (
        <div className="absolute right-0 bottom-0 w-full md:w-[45vw] lg:w-[40%] xl:w-[35vw] max-w-[700px] z-30 pointer-events-auto px-8 md:px-16 pb-12 animate-in slide-in-from-bottom-6 duration-700">

            {isWaitingForLLM ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4 animate-in fade-in duration-500">
                    <div className="flex gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-xs md:text-sm tracking-[0.3em] text-amber-500/80 font-mono uppercase mt-2">
                        Awaiting Response...
                    </span>
                </div>
            ) : (
                <>
                    {/* 行动选项区 */}
                    {currentActions.length > 0 && (
                        <div className="flex flex-col gap-4 mb-8">
                            <div className="opacity-60 flex items-center gap-3 mb-2">
                                <div className="h-[2px] w-8 bg-amber-500" />
                                <span className="text-[10px] md:text-xs tracking-[0.5em] uppercase text-amber-500 font-bold">Decisions</span>
                            </div>
                            <div className="space-y-3">
                                {currentActions.map((action) => (
                                    <div
                                        key={action.id}
                                        className="group cursor-pointer flex gap-5 transition-all duration-300 py-3 px-4 -ml-4 rounded hover:bg-white/10 active:scale-[0.98] border border-transparent hover:border-white/20 backdrop-blur-sm"
                                        onClick={() => handleAction(action.title)}
                                    >
                                        <span className="text-white/40 group-hover:text-amber-400 font-bold w-4 pt-1">{action.id}.</span>
                                        <div className="flex flex-col gap-1.5">
                                            <span className="text-lg md:text-xl group-hover:text-amber-300 text-neutral-100 font-medium transition-colors">
                                                {action.title}
                                            </span>
                                            {action.detail && (
                                                <span className="text-sm text-white/50 font-light">
                                                    — {action.detail}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 自定义输入区 (若是结算阶段则隐藏) */}
                    {phase !== 'epilogue_pending' && (
                        <div className="group pt-6 border-t border-white/10">
                            <div className="flex items-center gap-3 mb-3 opacity-50 group-focus-within:opacity-100 transition-opacity duration-500">
                                <div className="h-[2px] w-6 bg-indigo-500" />
                                <span className="text-[10px] md:text-xs text-indigo-400 font-bold tracking-[0.3em] uppercase">User Intervention</span>
                            </div>
                            <div className="relative">
                                <input
                                    type="text"
                                    className="w-full bg-indigo-500/5 backdrop-blur-xl border border-white/10 rounded-lg px-6 py-5 text-white text-lg md:text-xl placeholder:text-white/20 focus:outline-none focus:border-indigo-500 focus:bg-indigo-500/10 focus:ring-1 focus:ring-indigo-500/30 transition-all shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]"
                                    placeholder="...输入自定义行动..."
                                    value={customInput}
                                    onChange={(e) => setCustomInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && customInput.trim()) {
                                            handleAction(customInput);
                                        }
                                    }}
                                />
                                <div className="absolute right-6 top-1/2 -translate-y-1/2 text-white/30 text-[10px] font-bold font-mono tracking-widest group-focus-within:text-indigo-400 pointer-events-none transition-colors">
                                    ENTER ↵
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 取消按钮 */}
                    <button
                        className="mt-6 float-right text-[10px] text-white/30 hover:text-white uppercase transition-all tracking-[0.3em]"
                        onClick={() => setShowActionMenu(false)}
                    >
                        [ Back to Reality ]
                    </button>
                </>
            )}

        </div>
    );
};
