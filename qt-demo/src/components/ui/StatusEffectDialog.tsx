import React from 'react';
import { useGameStore } from '../../store/gameStore';

/**
 * 状态发作弹窗：在玩家行动后（后台扣血已完成）弹出，
 * 展示本回合所有状态发作的描述，玩家确认后关闭。
 * 关闭后才播放血条削减动画。
 */
export const StatusEffectDialog: React.FC = () => {
    const { ui, hideStatusDialog } = useGameStore();
    const { statusDialog } = ui;

    if (!statusDialog.visible || statusDialog.messages.length === 0) return null;

    const handleConfirm = () => {
        // 先调用外部回调（触发血条动画等）
        if (statusDialog.onConfirm) {
            statusDialog.onConfirm();
        }
        hideStatusDialog();
    };

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={handleConfirm}
            onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); }}
        >
            <div
                className="relative max-w-md w-[90%] bg-gradient-to-b from-[#1a0a0a] to-[#0d0505] border border-red-900/60 rounded-sm shadow-[0_0_60px_rgba(220,38,38,0.3)] px-8 py-8 animate-in zoom-in-95 duration-500"
                onClick={(e) => e.stopPropagation()}
            >
                {/* 顶部装饰线 */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-[2px] bg-gradient-to-r from-transparent via-red-500 to-transparent" />

                {/* 标题 */}
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-red-400 text-xs tracking-[0.4em] font-black uppercase">
                        Status Effect
                    </span>
                    <div className="flex-1 h-[1px] bg-gradient-to-r from-red-900/60 to-transparent" />
                </div>

                {/* 状态发作描述列表 */}
                <div className="space-y-4 mb-8">
                    {statusDialog.messages.map((msg, idx) => (
                        <div key={idx} className="flex items-start gap-3">
                            <span className="text-red-500/70 mt-1 text-sm">⚠</span>
                            <p className="text-white/90 text-base leading-relaxed font-light">
                                {msg}
                            </p>
                        </div>
                    ))}
                </div>

                {/* 伤害汇总 */}
                {statusDialog.totalDamage > 0 && (
                    <div className="flex items-center justify-center gap-3 mb-6 py-3 border-t border-b border-red-900/30">
                        <span className="text-red-500 text-sm font-bold tracking-wider">HP</span>
                        <span className="text-red-400 text-2xl font-black tabular-nums">
                            -{statusDialog.totalDamage}
                        </span>
                    </div>
                )}

                {/* 确认按钮 */}
                <button
                    className="w-full py-3 bg-red-900/30 hover:bg-red-900/50 border border-red-800/40 text-white/80 hover:text-white text-xs tracking-[0.3em] uppercase font-bold transition-all duration-300 active:scale-[0.98]"
                    onClick={handleConfirm}
                    autoFocus
                >
                    [ 确认 ]
                </button>
            </div>
        </div>
    );
};
