import { useEffect, useRef, useState, type CSSProperties } from 'react';

interface AnswerStreamProps {
  answer: string;
  isStreaming: boolean;
}

export default function AnswerStream({ answer, isStreaming }: AnswerStreamProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [dim, setDim] = useState(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [answer]);

  useEffect(() => {
    if (!isStreaming || answer) return;
    const id = setInterval(() => setDim((prev) => !prev), 700);
    return () => clearInterval(id);
  }, [isStreaming, answer]);

  const showThinking = isStreaming && !answer;

  return (
    <div ref={scrollRef} style={s.container}>
      {showThinking ? (
        <span
          style={{
            ...s.thinking,
            opacity: dim ? 0.35 : 0.65,
            transition: 'opacity 0.7s ease-in-out',
          }}
        >
          Thinking...
        </span>
      ) : (
        <p style={s.answer}>{answer}</p>
      )}
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  container: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
  },
  thinking: {
    display: 'block',
    fontSize: '13px',
    fontFamily: 'system-ui, sans-serif',
    color: 'rgba(255, 255, 255, 0.5)',
    lineHeight: 1.6,
  },
  answer: {
    margin: 0,
    fontSize: '13px',
    fontFamily: 'system-ui, sans-serif',
    color: '#ffffff',
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
  },
};
