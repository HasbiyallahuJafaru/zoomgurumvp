import { useEffect, useRef, type CSSProperties } from 'react';

interface AnswerStreamProps {
  answer: string;
  isStreaming: boolean;
}

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";
const SCROLL_PX_PER_FRAME = 1.0; // ~60px/s at 60fps

export default function AnswerStream({ answer, isStreaming }: AnswerStreamProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const userScrolledRef = useRef(false);

  // Detect manual scroll — pause auto-scroll when user scrolls up,
  // resume when they scroll back to the bottom
  function handleScroll() {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const nearBottom = scrollHeight - clientHeight - scrollTop < 24;
    userScrolledRef.current = !nearBottom;
  }

  // Auto-scroll rAF loop — runs only while streaming
  useEffect(() => {
    if (!isStreaming) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      userScrolledRef.current = false;
      return;
    }

    function tick() {
      if (scrollRef.current && !userScrolledRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
        const gap = scrollHeight - clientHeight - scrollTop;
        if (gap > 0) {
          scrollRef.current.scrollTop += Math.min(SCROLL_PX_PER_FRAME, gap);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isStreaming]);

  // Instant jump to bottom when a non-streaming answer loads (e.g. error messages)
  useEffect(() => {
    if (!isStreaming && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [answer, isStreaming]);

  const isEmpty = !answer && !isStreaming;

  return (
    <>
      <style>{`
        @keyframes zg-blink {
          0%, 49% { opacity: 1 }
          50%, 100% { opacity: 0 }
        }
        .zg-scroll::-webkit-scrollbar { width: 2px; }
        .zg-scroll::-webkit-scrollbar-track { background: transparent; }
        .zg-scroll::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.08);
          border-radius: 2px;
        }
      `}</style>
      <div
        ref={scrollRef}
        className="zg-scroll"
        style={s.container}
        onScroll={handleScroll}
      >
        {isEmpty ? (
          <p style={s.empty}>Press ⌘⇧A to listen · ⌘⇧S for screenshot</p>
        ) : (
          <p style={s.answer}>
            {isStreaming && !answer
              ? <span style={s.cursor} aria-hidden="true">|</span>
              : <>
                  {answer}
                  {isStreaming && <span style={s.cursor} aria-hidden="true">|</span>}
                </>
            }
          </p>
        )}
      </div>
    </>
  );
}

const s: Record<string, CSSProperties> = {
  container: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 16px 12px',
  },
  empty: {
    margin: 0,
    fontSize: '11px',
    fontFamily: FONT,
    color: 'rgba(255,255,255,0.16)',
    lineHeight: 1.6,
    letterSpacing: '0.1px',
  },
  answer: {
    margin: 0,
    fontSize: '13px',
    fontFamily: FONT,
    color: 'rgba(255,255,255,0.82)',
    lineHeight: 1.75,
    whiteSpace: 'pre-wrap',
  },
  cursor: {
    display: 'inline-block',
    marginLeft: '1px',
    color: '#6366f1',
    fontWeight: 300,
    fontSize: '15px',
    lineHeight: 1,
    animation: 'zg-blink 1s step-end infinite',
  },
};
