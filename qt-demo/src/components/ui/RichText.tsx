import React from 'react';

interface RichTextProps {
    text: string;
    className?: string;
    quote?: boolean;
}

/**
 * 通用的富文本解析组件，目前支持 **关键词** 的高亮强调。
 */
export const RichText: React.FC<RichTextProps> = ({ text, className, quote = false }) => {
    if (!text) return null;

    const parts = text.split(/(\*\*.*?\*\*)/g);

    return (
        <span className={className}>
            {quote && <span className="opacity-30 mr-1">"</span>}
            {parts.map((part, i) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    const content = part.slice(2, -2);
                    return (
                        <span
                            key={i}
                            className="font-bold text-amber-200/90 drop-shadow-[0_0_4px_rgba(253,230,138,0.2)] px-1 mx-0.5 bg-amber-200/5 rounded-sm border-b border-amber-200/10 antialiased not-italic inline-block"
                        >
                            {content}
                        </span>
                    );
                }
                return <span key={i}>{part}</span>;
            })}
            {quote && <span className="opacity-30 ml-1">"</span>}
        </span>
    );
};
