import React, { useEffect, useRef } from 'react';
import { useGameStore } from './store/gameStore';
import { GAME_CONFIG } from './gameConfig';
import { GameLayout } from './components/game/GameLayout';
import { NarrativePanel } from './components/ui/NarrativePanel';
import { HudOverlay } from './components/ui/HudOverlay';
import { LLMService } from './services/llmService';
import { GameController } from './utils/gameController';

// 模块级锁定，防止 StrictMode 双重挂载导致初始化两次
let isGlobalInitializing = false;

const App: React.FC = () => {
  const { phase, loadingStatus, addHistoryObject, injectInitialWorldState, setPlayerStats, setScenarioInfo } = useGameStore();
  const hasInitialized = useRef(false);

  // 开场初始化
  useEffect(() => {
    if (phase === 'initializing' && !hasInitialized.current && !isGlobalInitializing) {
      hasInitialized.current = true;
      isGlobalInitializing = true;

      // 彻底重置前端状态，防止旧数据残留
      useGameStore.getState().resetGame();

      (async () => {
        try {
          // 0. 开启新开局：await 确保日志完全清空后再继续
          await LLMService.clearLogs();
          console.log(">>> [Logs Cleared] Starting initialization flow...");

          if (GAME_CONFIG.scenarioId) {
            // ======= 预设剧本加载（跳过 LLM）=======
            const url = `/scenarios/${GAME_CONFIG.backgroundId}/${GAME_CONFIG.scenarioId}.json`;
            fetch(url)
              .then(res => {
                if (!res.ok) throw new Error(`无法加载剧本: ${res.status}`);
                return res.json();
              })
              .then(scenario => {
                console.log(">>> [预设剧本加载]", scenario.id || GAME_CONFIG.scenarioId);

                // 1. 注入世界状态（HP、物品、地图等）
                if (scenario.worldState) {
                  injectInitialWorldState(scenario.worldState);
                }

                // 2. 注入 goal 和 deadline
                if (scenario.goal || scenario.deadline) {
                  setScenarioInfo({
                    goal: scenario.goal || "",
                    deadline: scenario.deadline || "",
                  });
                }

                // 3. 注入玩家属性（points, time 等）
                if (scenario.playerOverrides) {
                  setPlayerStats(scenario.playerOverrides);
                }

                // 4. 将开场白添加到历史
                if (scenario.prologue) {
                  addHistoryObject('叙述者', scenario.prologue);
                }
              })
              .catch(err => {
                console.error("预设剧本加载失败，回退到 LLM 生成:", err);
                // 回退：走 LLM 流程
                LLMService.sendPlayerAction("[开始冒险]").then((response) => {
                  GameController.processLLMResponse(response);
                });
              });
          } else {
            // ======= LLM 随机生成 =======
            LLMService.sendPlayerAction("[开始冒险]").then((response) => {
              GameController.processLLMResponse(response);
            }).catch((err) => {
              console.error("初始化 LLM 请求失败：", err);
            });
          }
        } catch (err) {
          console.error("Initialization Failed:", err);
        }
      })();
    }
  }, [phase, addHistoryObject, injectInitialWorldState, setPlayerStats, setScenarioInfo]);

  // 阶段变化监听：当离开初始化阶段时，释放锁定，允许下次可能的重置
  useEffect(() => {
    if (phase !== 'initializing') {
      isGlobalInitializing = false;
    }
  }, [phase]);


  return (
    <>
      <GameLayout>
        <HudOverlay />
        <NarrativePanel />
      </GameLayout>

      {/* 初始化等待层：完全覆盖并阻断交互 */}
      {phase === 'initializing' && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center">
          <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-8" />
          <h1 className="text-xl md:text-2xl text-white/80 font-light tracking-[0.8em] md:tracking-[1em] uppercase animate-pulse ml-4 md:ml-6">命运连接中</h1>
          <p className="text-white/30 text-xs md:text-sm tracking-widest mt-6 font-light">{loadingStatus || "正在重塑世界底层规则与因果..."}</p>
        </div>
      )}
    </>
  );
};

export default App;
