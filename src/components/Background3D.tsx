import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useRef, useMemo, useEffect } from "react";
import * as THREE from "three";

const ParticleField = () => {
  const meshRef = useRef<THREE.Points>(null);
  const count = 1500;
  const mouse = useRef(new THREE.Vector2(0, 0));
  const smoothMouse = useRef(new THREE.Vector2(0, 0));
  const { viewport } = useThree();

  const [positions, basePositions, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const base = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const green = new THREE.Color("hsl(142, 71%, 45%)");
    const cyan = new THREE.Color("hsl(185, 70%, 50%)");

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 20;
      const y = (Math.random() - 0.5) * 20;
      const z = (Math.random() - 0.5) * 15;
      pos[i * 3] = x; base[i * 3] = x;
      pos[i * 3 + 1] = y; base[i * 3 + 1] = y;
      pos[i * 3 + 2] = z; base[i * 3 + 2] = z;

      const t = Math.random();
      const c = green.clone().lerp(cyan, t);
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    return [pos, base, col];
  }, []);

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

    // Smooth mouse lerp
    smoothMouse.current.lerp(mouse.current, 0.05);
    const mx = smoothMouse.current.x * viewport.width * 0.5;
    const my = smoothMouse.current.y * viewport.height * 0.5;

    // Rotate based on time + mouse
    meshRef.current.rotation.y = state.clock.elapsedTime * 0.03 + smoothMouse.current.x * 0.3;
    meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.02) * 0.1 + smoothMouse.current.y * 0.2;

    // Repel particles near cursor
    const posAttr = meshRef.current.geometry.attributes.position;
    const arr = posAttr.array as Float32Array;
    for (let i = 0; i < count; i++) {
      const bx = basePositions[i * 3];
      const by = basePositions[i * 3 + 1];
      const bz = basePositions[i * 3 + 2];

      const dx = bx - mx;
      const dy = by - my;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const radius = 3;

      if (dist < radius) {
        const force = (1 - dist / radius) * 1.5;
        arr[i * 3] = bx + (dx / dist) * force;
        arr[i * 3 + 1] = by + (dy / dist) * force;
      } else {
        arr[i * 3] += (bx - arr[i * 3]) * 0.05;
        arr[i * 3 + 1] += (by - arr[i * 3 + 1]) * 0.05;
      }
      arr[i * 3 + 2] += (bz - arr[i * 3 + 2]) * 0.05;
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} count={count} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} count={count} />
      </bufferGeometry>
      <pointsMaterial size={0.04} vertexColors transparent opacity={0.6} sizeAttenuation depthWrite={false} />
    </points>
  );
};

const FloatingGrid = () => {
  const meshRef = useRef<THREE.LineSegments>(null);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const verts: number[] = [];
    const gridSize = 12;
    const divisions = 20;
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
    meshRef.current.position.y = -3 + Math.sin(state.clock.elapsedTime * 0.3) * 0.2;
  });

  return (
    <lineSegments ref={meshRef} geometry={geometry} rotation={[0.3, 0, 0]}>
      <lineBasicMaterial color="hsl(142, 71%, 45%)" transparent opacity={0.08} />
    </lineSegments>
  );
};

const Background3D = () => {
  return (
    <div className="fixed inset-0" style={{ zIndex: -1 }}>
      <Canvas
        camera={{ position: [0, 0, 6], fov: 60 }}
        dpr={[1, 1.5]}
        gl={{ antialias: false, alpha: true }}
        style={{ background: "hsl(220 20% 4%)" }}
      >
        <ParticleField />
        <FloatingGrid />
      </Canvas>
    </div>
  );
};

export default Background3D;
