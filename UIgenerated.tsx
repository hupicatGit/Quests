import React, { useState, useEffect, useRef } from 'react';

const App = () => {
  // 根据《卡萨布兰卡式撤离》文档提取的开场剧情
  const fullScript = [
    { speaker: "时间线", text: "1912年4月14日，晚上10:15。场景：白星码头。" },
    { speaker: "叙述者", text: "雾气像活物一样舔着你的脸。" },
    { speaker: "叙述者", text: "你猛地咳嗽一声，嘴里全是煤烟和咸腥味——前一秒你还在2024年的卧室刷手机，下一秒脚下的木板就在海水推动下嘎吱作响。" },
    { speaker: "提示", text: "木箱上《泰坦尼克号时报》的头条刺眼：“不列颠号——更大、更快、更安全”，日期是1912年4月14日。" },
    { speaker: "叙述者", text: "寒冷穿透你单薄的现代衣服。码头上没人注意你——穿粗呢的工人扛着皮箱踉跄走过，贵妇的约克夏犬冲你狂吠。" },
    { speaker: "物品检查", text: "你摸向口袋：一部没信号的iPhone、78块人民币、半包口香糖，和一个凭空出现的...锦囊？" },
    { speaker: "神秘锦囊", text: "“找到斯坦教授。三种人会杀他。72小时后，你将永远困在这里。抽奖消耗10点数，百宝袋可储物。”" },
    { speaker: "最后通牒", text: "远处蒸汽机低吼，跳板还在晃动。最后一个水手不耐烦地冲你喊：“喂！登船的最后机会——你走不走？”" }
  ];

  const [stats, setStats] = useState({
    health: 100,
    points: 100,
    timeRemaining: "71:45",
  });

  const [inventory, setInventory] = useState([
    { name: "iPhone", icon: "📱" },
    { name: "78元人民币", icon: "💴" },
    { name: "半包口香糖", icon: "🍬" },
    { name: "神秘锦囊", icon: "📜" }
  ]);

  const [displayedMessages, setDisplayedMessages] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const [isUiVisible, setIsUiVisible] = useState(true);
  const [showCharBio, setShowCharBio] = useState(false); 

  const scrollRef = useRef(null);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const scrollTop = useRef(0);
  const hasMoved = useRef(false);

  useEffect(() => {
    if (scrollRef.current && !isDragging.current) {
      const container = scrollRef.current;
      container.scrollTo({ 
        top: container.scrollHeight, 
        behavior: 'smooth' 
      });
    }
  }, [displayedMessages, showActionMenu, isUiVisible]);

  useEffect(() => {
    if (displayedMessages.length === 0) {
      setDisplayedMessages([fullScript[0]]);
      setCurrentIndex(1);
    }
  }, []);

  const addNextMessage = () => {
    if (!isUiVisible) {
      setIsUiVisible(true);
      return;
    }
    if (showActionMenu) return; 
    if (currentIndex < fullScript.length) {
      setDisplayedMessages(prev => [...prev, fullScript[currentIndex]]);
      setCurrentIndex(prev => prev + 1);
    }
  };

  const toggleUi = (e) => {
    e.stopPropagation();
    if (!isUiVisible && showCharBio) {
      setShowCharBio(false); 
    } else {
      setIsUiVisible(!isUiVisible);
      setShowCharBio(false);
    }
  };

  const handleAction = (actionTitle) => {
    console.log("执行行动:", actionTitle);
    setShowActionMenu(false);
  };

  const onMouseDown = (e) => {
    if (!isUiVisible) return;
    isDragging.current = true;
    hasMoved.current = false;
    startY.current = e.pageY - scrollRef.current.offsetTop;
    scrollTop.current = scrollRef.current.scrollTop;
    scrollRef.current.style.scrollBehavior = 'auto';
    scrollRef.current.style.cursor = 'grabbing';
    scrollRef.current.style.userSelect = 'none';
  };

  const onMouseMove = (e) => {
    if (!isDragging.current || !isUiVisible) return;
    const y = e.pageY - scrollRef.current.offsetTop;
    const walk = (y - startY.current); 
    scrollRef.current.scrollTop = scrollTop.current - walk;
    if (Math.abs(y - startY.current) > 5) hasMoved.current = true;
  };

  const onMouseUp = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (scrollRef.current) {
      scrollRef.current.style.scrollBehavior = 'smooth';
      scrollRef.current.style.cursor = 'grab';
      scrollRef.current.style.removeProperty('user-select');
    }
    if (!hasMoved.current) addNextMessage();
  };

  const actions = [
    { id: 1, title: "撬开走廊尽头的铁门", detail: "使用小刀，可能惊动船员" },
    { id: 2, title: "跟随人群冲向楼梯间", detail: "可能发生踩踏" },
    { id: 3, title: "寻找其他三等舱乘客询问情况", detail: "安全但消耗时间" },
    { id: 4, title: "检查周围散落的物品", detail: "有机会获得道具" },
    { id: 5, title: "消耗10点数进行锦囊抽奖", detail: "拼一拼运气" },
  ];

  const bgImage = encodeURI("Gemini_Generated_Image_qx7q9eqx7q9eqx7q (1).jpg");
  const charImage = encodeURI("Gemini_Generated_Image_dqz49vdqz49vdqz4.jpg");

  return (
    <div className="w-full h-screen bg-black flex items-center justify-center p-0 md:p-6 font-serif overflow-hidden">
      <div 
        className="relative aspect-video w-full max-w-[1400px] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] ring-1 ring-white/10 select-none bg-neutral-900"
      >
        {/* 背景层 */}
        <div className="absolute inset-0 w-full h-full cursor-pointer" onClick={toggleUi}>
          <img 
            src={bgImage} 
            className="w-full h-full object-cover opacity-80 animate-[slowBreath_40s_infinite_alternate] pointer-events-none" 
            alt="BG" 
            onError={(e) => { e.target.style.display = 'none'; }} 
          />
          <style>{`@keyframes slowBreath { from { transform: scale(1); } to { transform: scale(1.1); } }`}</style>
          <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-black/80 pointer-events-none" />
        </div>

        {/* 赏析模式专属信息 */}
        <div className={`absolute top-10 left-10 z-50 pointer-events-none transition-all duration-1000 ease-in-out ${!isUiVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'}`}>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <div className="w-1 h-1 bg-amber-500 rounded-full animate-pulse" />
              <span className="text-white text-3xl font-light tracking-[0.3em] uppercase drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]">白星码头</span>
            </div>
            <div className="flex items-center gap-2 pl-4">
              <span className="text-amber-500/60 text-sm tracking-[0.5em] font-mono">1912.04.14 / 22:15</span>
              <div className="h-[1px] w-20 bg-gradient-to-r from-amber-500/40 to-transparent" />
            </div>
          </div>
        </div>

        {/* 角色立绘 */}
        <div 
          className={`absolute left-[8%] bottom-0 w-[24%] h-[85%] z-20 transition-all duration-700 ease-in-out ${isUiVisible ? 'opacity-90 scale-100 pointer-events-none' : 'opacity-100 scale-[1.03] cursor-help'}`} 
          style={{ 
            filter: showActionMenu && isUiVisible ? 'brightness(0.3) grayscale(0.6) blur(2px)' : 'none', 
            transform: showActionMenu && isUiVisible ? 'translateX(-20px)' : 'none' 
          }}
          onClick={(e) => {
            if (!isUiVisible) {
              e.stopPropagation();
              setShowCharBio(!showCharBio);
            }
          }}
        >
          <img 
            src={charImage} 
            className="w-full h-full object-cover drop-shadow-[0_0_30px_rgba(0,0,0,0.5)]" 
            alt="Character" 
            onError={(e) => { e.target.style.display = 'none'; }} 
          />
          <div className={`absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black via-black/40 to-transparent transition-opacity duration-700 ${isUiVisible ? 'opacity-100' : 'opacity-0'}`} />
          
          {!isUiVisible && !showCharBio && (
            <div className="absolute inset-0 bg-white/5 animate-pulse rounded-t-full pointer-events-none" />
          )}
        </div>

        {/* 人物志介绍 */}
        <div className={`absolute left-[32%] top-[30%] z-50 w-80 p-6 bg-black/80 backdrop-blur-xl border-l-2 border-amber-500 rounded-r-lg shadow-2xl transition-all duration-500 pointer-events-none ${showCharBio && !isUiVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'}`}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col">
              <span className="text-amber-500 text-[10px] tracking-[0.4em] uppercase font-bold">Identity / 人物志</span>
              <h3 className="text-white text-2xl font-light tracking-widest mt-1">神秘侦探</h3>
            </div>
            {/* 去除斜体 */}
            <p className="text-white/70 text-sm leading-relaxed font-light">
              “一个不该出现在1912年的观测者。你的口袋里装着跨越百年的废铁，而你的双脚正踏向一艘注定沉没的巨轮。”
            </p>
            <div className="pt-4 border-t border-white/10 flex justify-between items-center text-[9px] text-white/30 tracking-widest uppercase">
              <span>Status: Active</span>
              <span>Observed 1912</span>
            </div>
          </div>
        </div>

        {/* 游戏HUD (左上状态栏) */}
        <div className={`transition-all duration-700 ease-in-out ${isUiVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10 pointer-events-none'}`}>
          <div className="absolute top-6 left-8 z-30 space-y-2 pointer-events-none">
            <div className="bg-black/60 backdrop-blur-md px-3 py-1 border-l-2 border-red-500 rounded-r shadow-lg flex items-center gap-3">
              <span className="text-red-500 text-[10px] font-bold tracking-tighter">HP</span>
              <div className="w-24 h-1 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-red-500" style={{ width: `${stats.health}%` }} />
              </div>
              <span className="text-white text-[10px] tabular-nums">{stats.health}</span>
            </div>
            <div className="flex gap-2">
              <div className="bg-black/60 backdrop-blur-md px-3 py-1 border-l-2 border-indigo-400 rounded-r shadow-lg flex flex-col">
                <span className="text-indigo-400 text-[8px] uppercase tracking-tighter font-bold">Points</span>
                <span className="text-white text-xs">{stats.points}</span>
              </div>
              <div className="bg-black/60 backdrop-blur-md px-3 py-1 border-l-2 border-amber-500 rounded-r shadow-lg flex flex-col">
                <span className="text-amber-500 text-[8px] uppercase tracking-tighter font-bold">Time</span>
                <span className="text-white text-xs font-mono">{stats.timeRemaining}</span>
              </div>
            </div>
          </div>
          <div className="absolute top-10 right-12 z-40 flex gap-8">
            <button className="text-white/20 hover:text-indigo-300 text-[9px] tracking-[0.3em] uppercase transition-colors pointer-events-auto">Systems</button>
            <button className="text-white/20 hover:text-indigo-300 text-[9px] tracking-[0.3em] uppercase transition-colors pointer-events-auto">Save</button>
          </div>
        </div>

        {/* 右侧主容器 */}
        <div 
          className={`absolute right-0 top-0 w-[45%] h-full z-20 flex flex-col bg-gradient-to-l from-black/95 via-black/70 to-transparent backdrop-blur-[1px] transition-all duration-700 ease-in-out ${isUiVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10 pointer-events-none'}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-neutral-900 via-neutral-900/80 to-transparent z-30 pointer-events-none" />
          <div 
            ref={scrollRef} 
            className={`flex-1 overflow-y-auto px-12 pt-20 no-scrollbar transition-all duration-500 cursor-grab active:cursor-grabbing ${showActionMenu ? 'pb-8 space-y-7' : 'pb-32 space-y-8'}`} 
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
          >
            {displayedMessages.map((msg, idx) => (
              <div key={idx} className="animate-in fade-in slide-in-from-bottom-3 duration-1000">
                <div className="flex items-center gap-2 opacity-40 mb-0.5">
                  <div className="h-[1px] w-4 bg-white" />
                  <span className="text-[9px] tracking-widest uppercase font-bold text-white">{msg.speaker}</span>
                </div>
                {/* 叙事文字去斜体 */}
                <p className="text-white/80 text-base leading-relaxed tracking-wide font-light">“{msg.text}”</p>
              </div>
            ))}
            {showActionMenu && (
              <div className="pt-2 flex flex-col gap-4 animate-in fade-in duration-700">
                <div className="opacity-40 flex items-center gap-3 mb-1"><div className="h-[1px] w-8 bg-white" /><span className="text-[10px] tracking-[0.6em] uppercase text-white font-black text-xs">Decisions</span></div>
                <div className="space-y-2.5">
                  {actions.map((action) => (
                    <div key={action.id} className="group cursor-pointer flex gap-4 transition-all duration-200 py-1 px-2 -ml-2 rounded hover:bg-white/5" onClick={() => handleAction(action.title)}>
                      <span className="text-white/30 group-hover:text-amber-500 font-bold w-4 pt-1">{action.id}.</span>
                      <div className="flex flex-col gap-0.5"><span className="text-[1.05rem] group-hover:text-amber-500 text-neutral-100 font-medium">“{action.title}”</span><span className="text-[11px] text-white/40 font-light italic">— {action.detail}</span></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!showActionMenu && currentIndex < fullScript.length && <div className="text-white/20 text-[10px] tracking-[0.4em] animate-pulse py-4">● CLICK TO PROCEED</div>}
          </div>

          <div className={`px-12 pb-6 transition-all duration-700 ${showActionMenu ? 'opacity-100 translate-y-0 h-auto' : 'opacity-0 translate-y-10 h-0 overflow-hidden'}`}>
            <div className="flex flex-col gap-4">
              <div className="group">
                <div className="flex items-center gap-4 mb-2 opacity-30 group-focus-within:opacity-100 transition-opacity"><div className="h-[1px] w-4 bg-indigo-500" /><span className="text-[9px] text-indigo-400 font-bold tracking-[0.3em] uppercase">User Intervention</span></div>
                <div className="relative">
                  <input type="text" className="w-full bg-black/40 backdrop-blur-xl border-b border-white/20 px-4 py-2.5 text-white placeholder:text-white/10 text-sm focus:outline-none focus:border-indigo-500 italic font-light" placeholder="...输入你的自定义行动..." value={customInput} onChange={(e) => setCustomInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleAction(customInput); }} />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 text-[8px] group-focus-within:text-indigo-400">ENTER ↵</div>
                </div>
              </div>
              <button className="self-end text-[9px] text-white/20 hover:text-white uppercase transition-all" onClick={() => setShowActionMenu(false)}>[ BACK TO REALITY ]</button>
            </div>
          </div>
        </div>

        {/* 左下角 UI 分组：游戏目标 + 道具栏 */}
        <div className={`absolute bottom-6 left-8 z-30 flex flex-col gap-8 transition-all duration-700 ease-in-out ${isUiVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}>
          
          <div className="w-48 bg-black/60 backdrop-blur-lg p-4 border-l-2 border-amber-500 rounded-r shadow-2xl ring-1 ring-white/5 pointer-events-auto">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
              <span className="text-amber-400 text-[9px] tracking-[0.2em] font-bold uppercase">Current Objective</span>
            </div>
            <p className="text-white/90 text-sm leading-relaxed font-light tracking-wide">
              游戏目标：<br/>
              <span className="text-amber-100/90 font-medium underline decoration-amber-500/30 underline-offset-4 tracking-tight">24小时内找到斯坦教授</span>
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <div className={`flex items-center gap-2 transition-opacity duration-500 ${showActionMenu ? 'opacity-40' : 'opacity-10'}`}>
              <div className="h-[1px] w-3 bg-white" />
              <span className="text-[8px] uppercase tracking-widest font-bold text-white">{showActionMenu ? 'Inventory Unfolded' : 'Backpack'}</span>
            </div>
            <div 
              className={`flex gap-2 transition-all duration-700 ease-in-out pointer-events-auto ${
                showActionMenu 
                  ? 'p-2 bg-black/60 backdrop-blur-2xl border border-white/10 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] opacity-100 translate-y-0 scale-100' 
                  : 'p-0 bg-transparent border-transparent shadow-none opacity-50 translate-y-2 scale-90'
              }`}
              style={{ 
                backgroundColor: showActionMenu ? '' : 'transparent',
                boxShadow: showActionMenu ? '' : 'none'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {showActionMenu ? (
                <div className="flex gap-2 animate-in fade-in zoom-in-95 duration-500">
                  {inventory.map((item, i) => (
                    <div key={i} className="w-11 h-11 flex items-center justify-center bg-white/5 border border-white/5 rounded-lg transition-all hover:bg-indigo-500/20"><span className="text-2xl opacity-90">{item.icon}</span></div>
                  ))}
                </div>
              ) : (
                <div className="w-12 h-12 flex items-center justify-center"><span className="text-2xl opacity-50 grayscale hover:opacity-100 hover:grayscale-0 transition-all cursor-pointer">🎒</span></div>
              )}
            </div>
          </div>
        </div>

        {/* 行动唤起按钮 */}
        {currentIndex >= fullScript.length && !showActionMenu && (
          <div className={`absolute bottom-10 right-12 z-40 transition-all duration-700 ${isUiVisible ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-90 pointer-events-none'}`}>
            <button className="bg-indigo-600/60 hover:bg-indigo-600 px-10 py-3 border border-indigo-400/40 text-white text-[10px] tracking-[0.5em] transition-all uppercase shadow-lg shadow-indigo-900/20 active:scale-95" onClick={(e) => { e.stopPropagation(); setShowActionMenu(true); }}>TAKE ACTION</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;