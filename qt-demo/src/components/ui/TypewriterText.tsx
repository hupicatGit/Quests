import React, { useState, useEffect } from 'react';

interface TypewriterTextProps {
    text: string;
    speed?: number; // 字符显示间隔 (ms)
    onComplete?: () => void;
}

export const TypewriterText: React.FC<TypewriterTextProps> = ({ text, speed = 30, onComplete }) => {
    const [displayedText, setDisplayedText] = useState('');
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        if (currentIndex < text.length) {
            const timeout = setTimeout(() => {
                setDisplayedText(prev => prev + text[currentIndex]);
                setCurrentIndex(prev => prev + 1);
            }, speed);

            return () => clearTimeout(timeout);
        } else if (onComplete) {
            onComplete();
        }
    }, [currentIndex, text, speed, onComplete]);

    return <span>{displayedText}</span>;
};
