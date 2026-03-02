import React, { useState, useEffect, useRef } from 'react';

interface FadeInTextProps {
    text: string;
    speed?: number;
    onComplete?: () => void;
}

export const FadeInText: React.FC<FadeInTextProps> = ({ text, speed = 25, onComplete }) => {
    const [displayedText, setDisplayedText] = useState('');
    const [currentIndex, setCurrentIndex] = useState(0);
    // 用 ref 持有最新的 onComplete，避免函数每次渲染重建导致 useEffect 无限触发
    const onCompleteRef = useRef(onComplete);
    onCompleteRef.current = onComplete;
    // 用 flag 确保 onComplete 只触发一次
    const calledRef = useRef(false);

    useEffect(() => {
        // 文本改变时完整重置
        setDisplayedText('');
        setCurrentIndex(0);
        calledRef.current = false;
    }, [text]);

    useEffect(() => {
        if (currentIndex < text.length) {
            const timeout = setTimeout(() => {
                setDisplayedText(prev => prev + text[currentIndex]);
                setCurrentIndex(prev => prev + 1);
            }, speed);
            return () => clearTimeout(timeout);
        } else if (!calledRef.current) {
            // 打字完毕，触发一次回调
            calledRef.current = true;
            onCompleteRef.current?.();
        }
        // 只依赖 currentIndex, text, speed，不依赖 onComplete，避免无限循环
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentIndex, text, speed]);

    return (
        <span className="leading-[1.8] antialiased">
            {displayedText}
            {currentIndex < text.length && (
                <span className="inline-block w-1.5 h-4 ml-0.5 bg-indigo-500 animate-pulse align-middle" />
            )}
        </span>
    );
};
