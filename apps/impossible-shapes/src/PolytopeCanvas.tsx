import React, { useEffect, useRef } from 'react';
import type { Polytope } from './shapes/polytopes.js';

function rotatePlane(a: number, b: number, angle: number): [number, number] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [a * c - b * s, a * s + b * c];
}

export function PolytopeCanvas({
  polytope,
  speed,
  scale,
}: {
  polytope: Polytope;
  speed: number;
  scale: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const speedRef = useRef(speed);
  const scaleRef = useRef(scale);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;

    function resize() {
      const parent = canvas!.parentElement;
      width = parent?.clientWidth ?? window.innerWidth;
      height = parent?.clientHeight ?? window.innerHeight;
      const dpr = window.devicePixelRatio || 1;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function project(
      [x, y, z, w]: [number, number, number, number],
      animTime: number,
    ): [number, number] {
      [x, w] = rotatePlane(x, w, animTime * 0.0007);
      [y, w] = rotatePlane(y, w, animTime * 0.0005);
      [x, z] = rotatePlane(x, z, animTime * 0.0003);
      [y, z] = rotatePlane(y, z, animTime * 0.0004);

      const fourDScale = 1 / (4 - w);
      x *= fourDScale;
      y *= fourDScale;
      z *= fourDScale;

      const size = Math.min(width, height) * 1.2 * scaleRef.current;
      const threeDScale = 1 / (4 - z);

      return [width / 2 + x * size * threeDScale, height / 2 - y * size * threeDScale];
    }

    let frame = 0;
    let animTime = 0;
    let lastTimestamp: number | null = null;

    function render(timestamp: number) {
      if (lastTimestamp === null) lastTimestamp = timestamp;
      const delta = timestamp - lastTimestamp;
      lastTimestamp = timestamp;
      animTime += delta * speedRef.current;

      ctx!.fillStyle = '#090b0d';
      ctx!.fillRect(0, 0, width, height);

      const points = polytope.vertices.map((vertex) => project(vertex, animTime));

      ctx!.strokeStyle = '#b7f7d1';
      ctx!.lineWidth = 1.5;
      ctx!.lineCap = 'round';
      ctx!.shadowColor = '#38d47a';
      ctx!.shadowBlur = 8;

      ctx!.beginPath();
      for (const [start, end] of polytope.edges) {
        ctx!.moveTo(...points[start]!);
        ctx!.lineTo(...points[end]!);
      }
      ctx!.stroke();

      frame = requestAnimationFrame(render);
    }

    const controller = new AbortController();
    resize();
    window.addEventListener('resize', resize, { signal: controller.signal });
    frame = requestAnimationFrame(render);

    return () => {
      controller.abort();
      cancelAnimationFrame(frame);
    };
  }, [polytope]);

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />;
}
