"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { cn } from "@/lib/utils";

const FALLBACK = {
  primary: 0xd4af37,
  accent: 0xe8c766,
  signal: 0x3fb950,
  background: 0x0b0b0d,
} as const;

const STREAK_COUNT = 48;

function parseHslTriplet(raw: string) {
  const match = raw.trim().match(/^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/);
  if (!match) return null;
  return {
    h: parseFloat(match[1]),
    s: parseFloat(match[2]) / 100,
    l: parseFloat(match[3]) / 100,
  };
}

function readThemeHex(root: Element, varName: string, fallback: number) {
  const raw = getComputedStyle(root).getPropertyValue(varName).trim();
  const hsl = parseHslTriplet(raw);
  if (!hsl) return fallback;
  return new THREE.Color().setHSL(hsl.h / 360, hsl.s, hsl.l).getHex();
}

type Streak = {
  progress: number;
  speed: number;
  angle: number;
  spread: number;
  landedFlash: number;
  delay: number;
};

function initStreaks(): Streak[] {
  return Array.from({ length: STREAK_COUNT }, () => ({
    progress: Math.random(),
    speed: 0.002 + Math.random() * 0.004,
    angle: -0.3 + Math.random() * 0.6,
    spread: 0.4 + Math.random() * 1.6,
    landedFlash: 0,
    delay: Math.random() * 2,
  }));
}

function streakPosition(
  streak: Streak,
  width: number,
  height: number,
): { x: number; y: number; rot: number } {
  const t = streak.progress;
  const originX = -width * 0.35;
  const originY = -height * 0.15;
  const dist = width * 0.9 * streak.spread;
  const arc = Math.sin(t * Math.PI) * height * 0.12;

  const x = originX + Math.cos(streak.angle) * dist * t;
  const y = originY + Math.sin(streak.angle) * dist * t * 0.6 + arc;
  const rot = streak.angle + Math.PI * 0.15;

  return { x, y, rot };
}

type QuiverCanvasProps = {
  className?: string;
};

export function QuiverCanvas({ className }: QuiverCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const staticRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reducedMotion) {
      container.style.display = "none";
      if (staticRef.current) staticRef.current.style.display = "block";
      return;
    }

    if (staticRef.current) staticRef.current.style.display = "none";
    container.style.display = "block";

    const themeRoot = container.closest(".quiver-dark") ?? document.documentElement;
    const GOLD = readThemeHex(themeRoot, "--primary", FALLBACK.primary);
    const PALE_GOLD = readThemeHex(
      themeRoot,
      "--accent-foreground",
      FALLBACK.accent,
    );
    const SIGNAL_GREEN = readThemeHex(themeRoot, "--signal", FALLBACK.signal);
    const INK = readThemeHex(themeRoot, "--background", FALLBACK.background);

    let width = container.clientWidth;
    let height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(INK, 0.0008);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.z = 8;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "low-power",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(INK, 0);
    container.appendChild(renderer.domElement);

    const streakGeom = new THREE.BoxGeometry(0.04, 0.5, 0.02);
    const goldMat = new THREE.MeshBasicMaterial({
      color: GOLD,
      transparent: true,
      opacity: 0.55,
    });
    const greenMat = new THREE.MeshBasicMaterial({
      color: SIGNAL_GREEN,
      transparent: true,
      opacity: 0.85,
    });

    const meshes: THREE.Mesh[] = [];
    const streaks = initStreaks();

    for (let i = 0; i < STREAK_COUNT; i++) {
      const mat = goldMat.clone();
      const mesh = new THREE.Mesh(streakGeom, mat);
      scene.add(mesh);
      meshes.push(mesh);
    }

    // Origin glow — quiver point
    const originGeom = new THREE.RingGeometry(0.08, 0.14, 32);
    const originMat = new THREE.MeshBasicMaterial({
      color: PALE_GOLD,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
    });
    const origin = new THREE.Mesh(originGeom, originMat);
    origin.position.set(-2.8, -1.2, 0);
    scene.add(origin);

    let animId = 0;
    let visible = true;
    let pointerX = 0;
    let pointerY = 0;

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
      },
      { threshold: 0.05 },
    );
    observer.observe(container);

    const onPointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      pointerX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      pointerY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    };
    container.addEventListener("pointermove", onPointerMove);

    const onResize = () => {
      width = container.clientWidth;
      height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(container);

    let lastTime = performance.now();

    function animate(now: number) {
      animId = requestAnimationFrame(animate);
      if (!visible) return;

      const dt = Math.min((now - lastTime) / 16.67, 3);
      lastTime = now;

      camera.position.x = pointerX * 0.35;
      camera.position.y = -pointerY * 0.2;
      camera.lookAt(0, 0, 0);

      origin.rotation.z += 0.002 * dt;

      for (let i = 0; i < STREAK_COUNT; i++) {
        const streak = streaks[i];
        const mesh = meshes[i];

        if (streak.delay > 0) {
          streak.delay -= dt * 0.016;
          mesh.visible = false;
          continue;
        }
        mesh.visible = true;

        streak.progress += streak.speed * dt;

        if (streak.progress >= 1) {
          streak.landedFlash = 1;
          streak.progress = 0;
          streak.angle = -0.3 + Math.random() * 0.6;
          streak.spread = 0.4 + Math.random() * 1.6;
          streak.speed = 0.002 + Math.random() * 0.004;
          streak.delay = Math.random() * 0.5;
        }

        const { x, y, rot } = streakPosition(streak, 6, 4);
        mesh.position.set(x, y, -0.1 - i * 0.001);
        mesh.rotation.z = rot;

        const mat = mesh.material as THREE.MeshBasicMaterial;
        if (streak.landedFlash > 0) {
          mat.color.setHex(SIGNAL_GREEN);
          mat.opacity = 0.7 + streak.landedFlash * 0.3;
          streak.landedFlash -= dt * 0.04;
          if (streak.landedFlash <= 0) {
            mat.color.setHex(GOLD);
            mat.opacity = 0.55;
          }
        } else {
          const fade = Math.sin(streak.progress * Math.PI);
          mat.opacity = 0.25 + fade * 0.45;
          mat.color.setHex(
            streak.progress > 0.85 ? PALE_GOLD : GOLD,
          );
        }
      }

      renderer.render(scene, camera);
    }

    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      observer.disconnect();
      ro.disconnect();
      container.removeEventListener("pointermove", onPointerMove);
      renderer.dispose();
      streakGeom.dispose();
      originGeom.dispose();
      goldMat.dispose();
      greenMat.dispose();
      meshes.forEach((m) => {
        (m.material as THREE.Material).dispose();
      });
      originMat.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <>
      <div
        ref={staticRef}
        className={cn(
          "hidden h-full w-full bg-gradient-to-br from-primary/10 via-transparent to-accent-foreground/5",
          className,
        )}
        aria-hidden
      />
      <div ref={containerRef} className={cn("h-full w-full", className)} aria-hidden />
    </>
  );
}
