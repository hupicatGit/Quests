import React, { useEffect, useRef } from 'react';
import { useGameStore } from './store/gameStore';
import { GAME_CONFIG } from './gameConfig';
import { GameLayout } from './components/game/GameLayout';
import { NarrativePanel } from './components/ui/NarrativePanel';
import { HudOverlay } from './components/ui/HudOverlay';
import { LLMService } from './services/llmService';
import { GameController } from './utils/gameController';
import { ActionParser } from './utils/actionParser';

// 模块级锁定，防止 StrictMode 双重挂载导致初始化两次
let isGlobalInitializing = false;

const App: React.FC = () => {
  const { phase, loadingStatus, addHistoryObject, injectInitialWorldState, setPlayerStats, setBackgroundInfo, setGoal } = useGameStore();
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

          const applyScenarioData = (scenario: any, sourceName: string) => {
            console.log(`>>> [${sourceName}] 加载成功:`, scenario.id || "unknown");

            // 1. 注入世界状态（HP、物品、地图等）
            if (scenario.worldState) {
              injectInitialWorldState(scenario.worldState);
            }

            // 2. 注入 goal 和 deadline
            if (scenario.goal) {
              setGoal(scenario.goal);
            }
            if (scenario.deadline) {
              setBackgroundInfo({
                deadline: scenario.deadline,
              });
            }

            // 3. 注入玩家属性（points, time 等）
            if (scenario.playerOverrides) {
              setPlayerStats(scenario.playerOverrides);
            }

            // 4. 将开场白解析并处理（剥离 System 标签并提取初始选项）
            if (scenario.prologue) {
              const parsed = ActionParser.parseResponse(scenario.prologue);

              if (parsed.narrativeText.length > 0) {
                const paragraphs = parsed.narrativeText.split(/\n\n+/).filter(p => p.trim());
                paragraphs.forEach(p => {
                  addHistoryObject('叙述者', p.trim());
                });
              }

              if (parsed.actions.length > 0) {
                useGameStore.getState().setAvailableActions(parsed.actions);
              }
            }
          };

          const fallbackToLlm = () => {
            console.log(">>> [回退或强制 LLM] 开始随机生成流程");
            LLMService.sendPlayerAction("[开始冒险]").then((response) => {
              GameController.processLLMResponse(response);
            }).catch((err) => {
              console.error("初始化 LLM 请求失败：", err);
            });
          };

          if (GAME_CONFIG.scenarioId === "0") {
            // ======= 优先加载最新临时剧本 =======
            try {
              console.log(">>> [请求临时剧本] 正在查找上一次自动保存的记录...");
              const res = await fetch(`/api/get-latest-scenario?backgroundId=${GAME_CONFIG.backgroundId}`);
              if (!res.ok) {
                console.log(">>> [未找到临时剧本] 回退到 LLM 随机生成");
                fallbackToLlm();
              } else {
                const scenario = await res.json();
                applyScenarioData(scenario, "返回最新临时剧本");
              }
            } catch (err) {
              console.warn("加载最新剧本通信失败：", err);
              fallbackToLlm();
            }
          } else if (GAME_CONFIG.scenarioId) {
            // ======= 预设剧本加载（跳过 LLM）=======
            const url = `/scenarios/${GAME_CONFIG.backgroundId}/${GAME_CONFIG.scenarioId}.json`;
            fetch(url)
              .then(res => {
                if (!res.ok) throw new Error(`无法加载剧本: ${res.status}`);
                return res.json();
              })
              .then(scenario => applyScenarioData(scenario, "预设静态剧本"))
              .catch(err => {
                console.error("预设剧本加载失败，回退到 LLM 生成:", err);
                fallbackToLlm();
              });
          } else {
            // ======= LLM 随机生成 =======
            fallbackToLlm();
          }
        } catch (err) {
          console.error("Initialization Failed:", err);
        }
      })();
    }
  }, [phase, addHistoryObject, injectInitialWorldState, setPlayerStats, setBackgroundInfo, setGoal]);

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
