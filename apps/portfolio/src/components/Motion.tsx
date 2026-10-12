import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from 'react';
import { motionAllowed, useReveal } from '../hooks/motion';
import { figure } from '../lib/format';

type RevealProps = {
  as?: ElementType;
  index?: number;
  variant?: 'rise' | 'fade' | 'scale';
  className?: string;
  children: ReactNode;
  style?: CSSProperties;
} & Record<string, unknown>;

/** Rises into view when scrolled to; plain content without scripts or with reduced motion. */
export function Reveal({
  as: Tag = 'div',
  index = 0,
  variant = 'rise',
  className,
  style,
  children,
  ...rest
}: RevealProps) {
  const ref = useReveal<HTMLElement>();
  return (
    <Tag
      ref={ref}
      data-reveal={variant === 'rise' ? '' : variant}
      className={className}
      style={{ ...style, '--i': index } as CSSProperties}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** A heading whose words rise one after another. Screen readers get the plain text. */
export function SplitWords({ text, delayMs = 0 }: { text: string; delayMs?: number }) {
  const ref = useReveal<HTMLSpanElement>();
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <span ref={ref} className="split" style={{ '--delay': `${delayMs}ms` } as CSSProperties}>
      <span className="visually-hidden">{text}</span>
      <span aria-hidden="true">
        {words.map((word, index) => (
          <Fragment key={index}>
            {/* The space sits between the boxes: inside an inline-block it would vanish. */}
            {index ? ' ' : null}
            <span className="split__word" style={{ '--w': index } as CSSProperties}>
              <span className="split__inner">{word}</span>
            </span>
          </Fragment>
        ))}
      </span>
    </span>
  );
}

/** Cycles through short phrases; all of them are in the text for screen readers. */
export function RotatingWords({
  words,
  intervalMs = 2600,
}: {
  words: string[];
  intervalMs?: number;
}) {
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (words.length < 2 || !motionAllowed()) return;
    const timer = setInterval(
      () => setActive((current) => (current + 1) % words.length),
      intervalMs,
    );
    return () => clearInterval(timer);
  }, [words.length, intervalMs]);
  if (!words.length) return null;
  return (
    <span className="rotator">
      <span className="visually-hidden">{words.join(', ')}</span>
      <span className="rotator__stack" aria-hidden="true">
        {words.map((word, index) => (
          <span
            key={word}
            className={`rotator__word${index === active ? ' is-active' : ''}${
              index === (active + words.length - 1) % words.length ? ' is-leaving' : ''
            }`}
          >
            {word}
          </span>
        ))}
      </span>
    </span>
  );
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 4);

/**
 * A number you entered in the dashboard, counted up once when it first comes into view.
 * The page renders the final number; the count only rewrites it in the browser.
 */
export function CountUp({ value, suffix = '' }: { value: number; suffix?: string }) {
  const numberRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = numberRef.current;
    if (!node || !motionAllowed() || typeof IntersectionObserver === 'undefined') return;
    const decimals = Number.isInteger(value) ? 0 : 2;
    let frame = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (time: number) => {
          const t = Math.min(1, (time - start) / 1400);
          node.textContent = figure(Number((value * easeOut(t)).toFixed(decimals)));
          if (t < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { rootMargin: '0px 0px -10% 0px' },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      node.textContent = figure(value);
    };
  }, [value]);
  return (
    <span className="count">
      <span ref={numberRef}>{figure(value)}</span>
      {suffix}
    </span>
  );
}

export function SectionHead({
  index,
  label,
  title,
  lead,
  id,
}: {
  index: number;
  label: string;
  title: ReactNode;
  lead?: ReactNode;
  id: string;
}) {
  return (
    <header className="section-head">
      <Reveal as="p" className="section-head__index mono">
        {String(index).padStart(2, '0')} — {label}
      </Reveal>
      <h2 className="section-head__title" id={id}>
        {title}
      </h2>
      {lead ? (
        <Reveal as="p" className="section-head__lead" index={1}>
          {lead}
        </Reveal>
      ) : null}
    </header>
  );
}
