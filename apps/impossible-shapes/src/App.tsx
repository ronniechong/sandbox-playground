import React, { useState } from 'react';
import type { MountContext } from '@exp/contract';
import { polytopes } from './shapes/polytopes.js';
import { PolytopeCanvas } from './PolytopeCanvas.js';

const SPEED_RANGE = { min: 0, max: 3, step: 0.05 };
const SCALE_RANGE = { min: 0.3, max: 2, step: 0.05 };

function fillPercent(value: number, min: number, max: number): number {
  return ((value - min) / (max - min)) * 100;
}

const defaultPolytope = polytopes[0]!;

export function App({ ctx: _ctx }: { ctx: MountContext }) {
  const [activeId, setActiveId] = useState(defaultPolytope.id);
  const [speed, setSpeed] = useState(1);
  const [scale, setScale] = useState(1);
  const activePolytope = polytopes.find((p) => p.id === activeId) ?? defaultPolytope;

  return (
    <div className="shapes-root">
      <div className="shapes-controls">
        <div className="shapes-buttons">
          {polytopes.map((shape) => (
            <button
              key={shape.id}
              type="button"
              className={
                shape.id === activeId ? 'shapes-button shapes-button--active' : 'shapes-button'
              }
              onClick={() => setActiveId(shape.id)}
            >
              {shape.label}
            </button>
          ))}
        </div>
        <div className="shapes-sliders">
          <label className="shapes-slider">
            Speed
            <input
              type="range"
              min={SPEED_RANGE.min}
              max={SPEED_RANGE.max}
              step={SPEED_RANGE.step}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              style={{
                ['--fill' as string]: `${fillPercent(speed, SPEED_RANGE.min, SPEED_RANGE.max)}%`,
              }}
            />
            <span className="shapes-slider-value">{speed.toFixed(2)}x</span>
          </label>
          <label className="shapes-slider">
            Scale
            <input
              type="range"
              min={SCALE_RANGE.min}
              max={SCALE_RANGE.max}
              step={SCALE_RANGE.step}
              value={scale}
              onChange={(e) => setScale(Number(e.target.value))}
              style={{
                ['--fill' as string]: `${fillPercent(scale, SCALE_RANGE.min, SCALE_RANGE.max)}%`,
              }}
            />
            <span className="shapes-slider-value">{scale.toFixed(2)}x</span>
          </label>
        </div>
      </div>
      <div className="shapes-canvas">
        <PolytopeCanvas
          key={activePolytope.id}
          polytope={activePolytope}
          speed={speed}
          scale={scale}
        />
      </div>
    </div>
  );
}
