import React, { useState, useEffect, useRef } from 'react';

interface FadeInTextProps {
    text: string;
    speed?: number;
    onComplete?: () => void;
    onIteration?: (currentLength: number) => void;
    quote?: boolean;
    forceComplete?: boolean;
}

interface TextSegment {
    content: string;
    isBold: boolean;
}

export const FadeInText: React.FC<FadeInTextProps> = ({ text, speed = 25, onComplete, onIteration, quote = false, forceComplete = false }) => {
    const [currentLength, setCurrentLength] = useState(0);
    const [segments, setSegments] = useState<TextSegment[]>([]);
    const [totalLength, setTotalLength] = useState(0);

    // 用 ref 持有最新的 onComplete，避免函数每次渲染重建导致 useEffect 无限触发
    const onCompleteRef = useRef(onComplete);
    onCompleteRef.current = onComplete;
    // 用 flag 确保 onComplete 只触发一次
    const calledRef = useRef(false);

    useEffect(() => {
        // 解析 Markdown ** 语法
        const parts = text.split(/(\*\*.*?\*\*)/g);
        const parsedSegments = parts.map(part => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return { content: part.slice(2, -2), isBold: true };
            }
            return { content: part, isBold: false };
        }).filter(s => s.content.length > 0);

        setSegments(parsedSegments);
        setTotalLength(parsedSegments.reduce((acc, s) => acc + s.content.length, 0));
        setCurrentLength(0);
        calledRef.current = false;
    }, [text]);

    // 用 ref 持有最新的 onIteration，避免函数每次渲染重建导致 useEffect 无限触发
    const onIterationRef = useRef(onIteration);
    onIterationRef.current = onIteration;

    useEffect(() => {
        if (currentLength < totalLength) {
            const timeout = setTimeout(() => {
                const nextLength = currentLength + 1;
                setCurrentLength(nextLength);
                onIterationRef.current?.(nextLength);
            }, speed);
            return () => clearTimeout(timeout);
        } else if (totalLength > 0 && !calledRef.current) {
            // 打字完毕，触发一次回调
            calledRef.current = true;
            onCompleteRef.current?.();
        }
    }, [currentLength, totalLength, speed]);

    // 监听强制完成
    useEffect(() => {
        if (forceComplete && currentLength < totalLength) {
            setCurrentLength(totalLength);
            onIterationRef.current?.(totalLength);
            if (!calledRef.current) {
                calledRef.current = true;
                onCompleteRef.current?.();
            }
        }
    }, [forceComplete, totalLength]);

    // 根据当前进度渲染片段
    const renderContent = () => {
        let remainingChars = currentLength;
        return segments.map((segment, idx) => {
            if (remainingChars <= 0) return null;

            const showCount = Math.min(segment.content.length, remainingChars);
            remainingChars -= showCount;

            // 这里对每个字符拆分来单独渲染并给予 fade-in 动画
            // 为了避免由于 React 快速重渲染打断 animate-in 动画，这里使用 inline style 动画
            const result = [];
            for (let i = 0; i < showCount; i++) {
                const char = segment.content[i];
                // 计算当前字符距离最新渲染末尾的偏移
                const distanceFromEnd = showCount - 1 - i;

                // 如果是最后这几十个字符，并且它是当前所在的 segment 刚渲染出（remainingChars === 0），让它平滑淡入
                const isNew = remainingChars === 0 && distanceFromEnd < 12;

                result.push(
                    <span
                        key={`${idx}-${i}`}
                        // opacity-0 用来隐藏正在 fadein 之外的时刻跳变的白光，让最终样式固定在 100
                        className={isNew ? "animate-[animateFadeIn_0.3s_ease-in-out_forwards]" : ""}
                        style={isNew ? { opacity: 0 } : { opacity: 1 }}
                    >
                        {char}
                    </span>
                );
            }

            if (segment.isBold) {
                return (
                    <span
                        key={idx}
                        className="font-bold text-amber-200/90 drop-shadow-[0_0_4px_rgba(253,230,138,0.2)] px-1 mx-0.5 bg-amber-200/5 rounded-sm border-b border-amber-200/10 antialiased not-italic inline-block"
                    >
                        {result}
                    </span>
                );
            }
            return <span key={idx}>{result}</span>;
        });
    };

    return (
        <span className="leading-[1.8] antialiased">
            {quote && <span className="opacity-30 mr-1">"</span>}
            {renderContent()}
            {quote && currentLength === totalLength && <span className="opacity-30 ml-1">"</span>}
        </span>
    );
};
