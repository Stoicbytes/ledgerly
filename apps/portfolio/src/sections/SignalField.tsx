import { useEffect, useRef } from 'react';
import { motionAllowed } from '../hooks/motion';
import {
  layoutField,
  linkField,
  type FieldEdge,
  type FieldNode,
  type FieldSkill,
} from '../lib/field';

/**
 * The hero's living background: your skills as a network with signals travelling
 * between them, gently drawn towards the pointer. It pauses off screen and in hidden
 * tabs, draws a single still frame with reduced motion or on low-power devices, and is
 * hidden from assistive technology (the skills are listed properly further down).
 */
type Pulse = { edge: number; start: number; duration: number; reverse: boolean };

function lowPower(): boolean {
  const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
  return (nav.hardwareConcurrency ?? 8) <= 2 || Boolean(nav.connection?.saveData);
}

function color(element: Element, name: string, fallback: string) {
  return getComputedStyle(element).getPropertyValue(name).trim() || fallback;
}

export function SignalField({ skills, seed }: { skills: FieldSkill[]; seed: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !skills.length) return;
    const ember = color(canvas, '--ember', '#ff7a45');
    const still = !motionAllowed() || lowPower();
    let nodes: FieldNode[] = [];
    let edges: FieldEdge[] = [];
    let pulses: Pulse[] = [];
    let width = 0;
    let height = 0;
    let wide = true;
    let frame = 0;
    let visible = true;
    let lastSpawn = 0;
    const pointer = { x: -9999, y: -9999 };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      wide = width >= 900;
      const count = wide ? skills.length : Math.min(skills.length, 12);
      const area = wide
        ? { x: width * 0.46, y: height * 0.1, width: width * 0.5, height: height * 0.72 }
        : { x: width * 0.06, y: height * 0.04, width: width * 0.88, height: height * 0.3 };
      // Keep nodes and labels off the name and the intro text.
      const avoid = wide
        ? [...(canvas.parentElement?.querySelectorAll('.hero__name, .hero__body') ?? [])].map(
            (el) => {
              const box = el.getBoundingClientRect();
              return {
                x: box.left - rect.left - 28,
                y: box.top - rect.top - 20,
                width: box.width + 140,
                height: box.height + 40,
              };
            },
          )
        : [];
      nodes = layoutField(skills.slice(0, count), area, seed, avoid);
      edges = linkField(nodes);
      pulses = [];
      draw(performance.now());
    };

    const position = (node: FieldNode, t: number) => {
      const drift = still ? 0 : 1;
      let x = node.x + Math.sin(t * 0.00035 + node.phase) * 7 * drift;
      let y = node.y + Math.cos(t * 0.00028 + node.phase) * 6 * drift;
      const d = Math.hypot(pointer.x - x, pointer.y - y);
      if (d < 220) {
        const pull = (1 - d / 220) * 14;
        x += ((pointer.x - x) / (d || 1)) * pull;
        y += ((pointer.y - y) / (d || 1)) * pull;
      }
      return { x, y, near: Math.max(0, 1 - d / 200) };
    };

    function draw(t: number) {
      ctx!.clearRect(0, 0, width, height);
      const at = nodes.map((node) => position(node, t));
      ctx!.lineWidth = 1;
      edges.forEach(([a, b]) => {
        const p = at[a]!;
        const q = at[b]!;
        ctx!.strokeStyle = `rgba(236, 240, 247, ${0.07 + Math.max(p.near, q.near) * 0.22})`;
        ctx!.beginPath();
        ctx!.moveTo(p.x, p.y);
        ctx!.lineTo(q.x, q.y);
        ctx!.stroke();
      });
      if (!still) {
        pulses = pulses.filter((pulse) => t - pulse.start < pulse.duration);
        pulses.forEach((pulse) => {
          const [a, b] = edges[pulse.edge]!;
          const from = at[pulse.reverse ? b : a]!;
          const to = at[pulse.reverse ? a : b]!;
          const k = (t - pulse.start) / pulse.duration;
          const x = from.x + (to.x - from.x) * k;
          const y = from.y + (to.y - from.y) * k;
          const glow = ctx!.createRadialGradient(x, y, 0, x, y, 10);
          glow.addColorStop(0, ember);
          glow.addColorStop(1, 'rgba(0,0,0,0)');
          ctx!.globalAlpha = Math.sin(k * Math.PI);
          ctx!.fillStyle = glow;
          ctx!.fillRect(x - 10, y - 10, 20, 20);
          ctx!.globalAlpha = 1;
        });
      }
      ctx!.font = '500 11px "Geist Mono Variable", ui-monospace, monospace';
      nodes.forEach((node, index) => {
        const p = at[index]!;
        if (node.featured) {
          ctx!.fillStyle = 'rgba(255, 122, 69, 0.12)';
          ctx!.beginPath();
          ctx!.arc(p.x, p.y, 9 + p.near * 4, 0, Math.PI * 2);
          ctx!.fill();
        }
        ctx!.fillStyle = node.featured ? ember : `rgba(236, 240, 247, ${0.45 + p.near * 0.5})`;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, node.featured ? 3 : 2, 0, Math.PI * 2);
        ctx!.fill();
        const labelAlpha = node.featured ? 0.62 + p.near * 0.38 : p.near;
        if (wide && labelAlpha > 0.04) {
          ctx!.fillStyle = `rgba(236, 240, 247, ${labelAlpha})`;
          ctx!.fillText(node.name.toUpperCase(), p.x + 10, p.y + 4);
        }
      });
    }

    const loop = (t: number) => {
      if (visible && !document.hidden) {
        if (t - lastSpawn > 420 && edges.length) {
          lastSpawn = t;
          pulses.push({
            edge: Math.floor(Math.random() * edges.length),
            start: t,
            duration: 1300 + Math.random() * 900,
            reverse: Math.random() > 0.5,
          });
        }
        draw(t);
      }
      frame = requestAnimationFrame(loop);
    };

    const onMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      if (still) draw(performance.now());
    };
    const onLeave = () => {
      pointer.x = -9999;
      pointer.y = -9999;
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    const io = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
    });
    io.observe(canvas);
    const host = canvas.parentElement ?? canvas;
    host.addEventListener('pointermove', onMove);
    host.addEventListener('pointerleave', onLeave);
    void document.fonts?.ready.then(() => draw(performance.now()));
    if (!still) frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      io.disconnect();
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerleave', onLeave);
    };
  }, [skills, seed]);

  return <canvas ref={canvasRef} className="hero__field" aria-hidden="true" />;
}
