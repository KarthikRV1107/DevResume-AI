import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useRef, useMemo, useEffect, useState, createContext, useContext } from "react";
import * as THREE from "three";
import { useTheme } from "next-themes";

// Theme context to pass isDark into Canvas children
const ThemeContext3D = createContext(true);
const useIsDark = () => useContext(ThemeContext3D);

// Animated wireframe torus knot
const FloatingShape = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  const isDark = useIsDark();

  useFrame((state) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.x = state.clock.elapsedTime * 0.15;
    meshRef.current.rotation.y = state.clock.elapsedTime * 0.1;
    meshRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.4) * 0.3;
  });

  return (
    <mesh ref={meshRef} position={[4, 1, -3]}>
      <torusKnotGeometry args={[1.2, 0.35, 100, 16]} />
      <meshBasicMaterial
        color={isDark ? "hsl(142, 71%, 45%)" : "hsl(142, 71%, 30%)"}
        wireframe
        transparent
        opacity={isDark ? 0.06 : 0.12}
      />
    </mesh>
  );
};

// Glowing orb
const GlowOrb = ({ position, color, lightColor, speed }: { position: [number, number, number]; color: string; lightColor: string; speed: number }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const isDark = useIsDark();

  useFrame((state) => {
    if (!meshRef.current) return;
    meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * speed) * 0.5;
    meshRef.current.position.x = position[0] + Math.cos(state.clock.elapsedTime * speed * 0.7) * 0.3;
    const scale = 1 + Math.sin(state.clock.elapsedTime * speed * 1.5) * 0.15;
    meshRef.current.scale.setScalar(scale);
  });

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[0.15, 16, 16]} />
      <meshBasicMaterial
        color={isDark ? color : lightColor}
        transparent
        opacity={isDark ? 0.4 : 0.6}
      />
    </mesh>
  );
};

const ParticleField = () => {
  const meshRef = useRef<THREE.Points>(null);
  const isDark = useIsDark();
  const count = 2000;
  const mouse = useRef(new THREE.Vector2(0, 0));
  const smoothMouse = useRef(new THREE.Vector2(0, 0));
  const { viewport } = useThree();

  const darkColors = useMemo(() => {
    const col = new Float32Array(count * 3);
    const green = new THREE.Color("hsl(142, 71%, 45%)");
    const cyan = new THREE.Color("hsl(185, 70%, 50%)");
    const white = new THREE.Color("hsl(210, 20%, 80%)");
    for (let i = 0; i < count; i++) {
      const t = Math.random();
      const c = t < 0.6
        ? green.clone().lerp(cyan, t / 0.6)
        : cyan.clone().lerp(white, (t - 0.6) / 0.4);
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    return col;
  }, []);

  const lightColors = useMemo(() => {
    const col = new Float32Array(count * 3);
    const green = new THREE.Color("hsl(142, 71%, 30%)");
    const cyan = new THREE.Color("hsl(185, 70%, 35%)");
    const dark = new THREE.Color("hsl(210, 20%, 40%)");
    for (let i = 0; i < count; i++) {
      const t = Math.random();
      const c = t < 0.6
        ? green.clone().lerp(cyan, t / 0.6)
        : cyan.clone().lerp(dark, (t - 0.6) / 0.4);
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    return col;
  }, []);

  const [positions, basePositions] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const base = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 24;
      const y = (Math.random() - 0.5) * 24;
      const z = (Math.random() - 0.5) * 18;
      pos[i * 3] = x; base[i * 3] = x;
      pos[i * 3 + 1] = y; base[i * 3 + 1] = y;
      pos[i * 3 + 2] = z; base[i * 3 + 2] = z;
    }
    return [pos, base];
  }, []);

  const activeColors = isDark ? darkColors : lightColors;

  useEffect(() => {
    if (meshRef.current) {
      const colorAttr = meshRef.current.geometry.attributes.color;
      if (colorAttr) {
        (colorAttr.array as Float32Array).set(activeColors);
        colorAttr.needsUpdate = true;
      }
    }
  }, [isDark, activeColors]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  useFrame((state) => {
    if (!meshRef.current) return;

    smoothMouse.current.lerp(mouse.current, 0.04);
    const mx = smoothMouse.current.x * viewport.width * 0.5;
    const my = smoothMouse.current.y * viewport.height * 0.5;

    meshRef.current.rotation.y = state.clock.elapsedTime * 0.02 + smoothMouse.current.x * 0.4;
    meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.015) * 0.1 + smoothMouse.current.y * 0.25;

    const posAttr = meshRef.current.geometry.attributes.position;
    const arr = posAttr.array as Float32Array;
    const time = state.clock.elapsedTime;

    for (let i = 0; i < count; i++) {
      const bx = basePositions[i * 3];
      const by = basePositions[i * 3 + 1];
      const bz = basePositions[i * 3 + 2];

      const floatY = Math.sin(time * 0.3 + i * 0.01) * 0.05;
      const floatX = Math.cos(time * 0.2 + i * 0.015) * 0.03;

      const dx = bx - mx;
      const dy = by - my;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const radius = 3.5;

      if (dist < radius) {
        const force = (1 - dist / radius) * 2;
        arr[i * 3] = bx + (dx / dist) * force + floatX;
        arr[i * 3 + 1] = by + (dy / dist) * force + floatY;
      } else {
        arr[i * 3] += (bx + floatX - arr[i * 3]) * 0.04;
        arr[i * 3 + 1] += (by + floatY - arr[i * 3 + 1]) * 0.04;
      }
      arr[i * 3 + 2] += (bz - arr[i * 3 + 2]) * 0.04;
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} count={count} />
        <bufferAttribute attach="attributes-color" args={[activeColors, 3]} count={count} />
      </bufferGeometry>
      <pointsMaterial
        size={isDark ? 0.045 : 0.055}
        vertexColors
        transparent
        opacity={isDark ? 0.7 : 0.85}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
};

const FloatingGrid = () => {
  const meshRef = useRef<THREE.LineSegments>(null);
  const isDark = useIsDark();

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const verts: number[] = [];
    const gridSize = 16;
    const divisions = 28;
    const step = gridSize / divisions;

    for (let i = 0; i <= divisions; i++) {
      const pos = -gridSize / 2 + i * step;
      verts.push(pos, 0, -gridSize / 2, pos, 0, gridSize / 2);
      verts.push(-gridSize / 2, 0, pos, gridSize / 2, 0, pos);
    }

    geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    return geo;
  }, []);

  useFrame((state) => {
    if (!meshRef.current) return;
    meshRef.current.position.y = -4 + Math.sin(state.clock.elapsedTime * 0.2) * 0.15;
    meshRef.current.rotation.y = state.clock.elapsedTime * 0.01;
  });

  return (
    <lineSegments ref={meshRef} geometry={geometry} rotation={[0.4, 0, 0]}>
      <lineBasicMaterial
        color={isDark ? "hsl(142, 71%, 45%)" : "hsl(142, 71%, 30%)"}
        transparent
        opacity={isDark ? 0.05 : 0.12}
      />
    </lineSegments>
  );
};

const ConnectionLines = () => {
  const linesRef = useRef<THREE.LineSegments>(null);
  const isDark = useIsDark();
  const count = 80;

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 6);
    for (let i = 0; i < count; i++) {
      const x1 = (Math.random() - 0.5) * 12;
      const y1 = (Math.random() - 0.5) * 12;
      const z1 = (Math.random() - 0.5) * 8;
      pos[i * 6] = x1;
      pos[i * 6 + 1] = y1;
      pos[i * 6 + 2] = z1;
      pos[i * 6 + 3] = x1 + (Math.random() - 0.5) * 2;
      pos[i * 6 + 4] = y1 + (Math.random() - 0.5) * 2;
      pos[i * 6 + 5] = z1 + (Math.random() - 0.5) * 1.5;
    }
    return pos;
  }, []);

  useFrame((state) => {
    if (!linesRef.current) return;
    linesRef.current.rotation.y = state.clock.elapsedTime * 0.015;
    linesRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.01) * 0.05;
  });

  return (
    <lineSegments ref={linesRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} count={count * 2} />
      </bufferGeometry>
      <lineBasicMaterial
        color={isDark ? "hsl(185, 70%, 50%)" : "hsl(185, 70%, 35%)"}
        transparent
        opacity={isDark ? 0.04 : 0.1}
      />
    </lineSegments>
  );
};

const DARK_BG = "hsl(220, 20%, 4%)";
const LIGHT_BG = "hsl(0, 0%, 98%)";

const Background3D = () => {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = !mounted || resolvedTheme === "dark";
  const bgColor = isDark ? DARK_BG : LIGHT_BG;
  const fogColor = isDark ? DARK_BG : LIGHT_BG;

  return (
    <div className="fixed inset-0" style={{ zIndex: -1 }}>
      <Canvas
        camera={{ position: [0, 0, 7], fov: 55 }}
        dpr={[1, 1.5]}
        gl={{ antialias: false, alpha: true }}
        style={{ background: bgColor }}
        key={resolvedTheme}
      >
        <ThemeContext3D.Provider value={isDark}>
          <fog attach="fog" args={[fogColor, 8, isDark ? 22 : 18]} />
          <ParticleField />
          <FloatingGrid />
          <FloatingShape />
          <ConnectionLines />
          <GlowOrb position={[-3, 2, -2]} color="hsl(142, 71%, 45%)" lightColor="hsl(142, 71%, 30%)" speed={0.5} />
          <GlowOrb position={[5, -1, -4]} color="hsl(185, 70%, 50%)" lightColor="hsl(185, 70%, 35%)" speed={0.7} />
          <GlowOrb position={[-1, -3, -1]} color="hsl(142, 71%, 55%)" lightColor="hsl(142, 71%, 35%)" speed={0.3} />
        </ThemeContext3D.Provider>
      </Canvas>
    </div>
  );
};

export default Background3D;
