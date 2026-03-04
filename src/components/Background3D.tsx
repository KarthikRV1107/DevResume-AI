import { Canvas, useFrame } from "@react-three/fiber";
import { useRef, useMemo } from "react";
import * as THREE from "three";

const ParticleField = () => {
  const meshRef = useRef<THREE.Points>(null);
  const count = 1500;

  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const green = new THREE.Color("hsl(142, 71%, 45%)");
    const cyan = new THREE.Color("hsl(185, 70%, 50%)");

    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 20;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 20;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 15;

      const t = Math.random();
      const c = green.clone().lerp(cyan, t);
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    return [pos, col];
  }, []);

  useFrame((state) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.y = state.clock.elapsedTime * 0.03;
    meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.02) * 0.1;
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={count}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
          count={count}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.04}
        vertexColors
        transparent
        opacity={0.6}
        sizeAttenuation
        depthWrite={false}
      />
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
    <div className="fixed inset-0 -z-10">
      <Canvas
        camera={{ position: [0, 0, 6], fov: 60 }}
        dpr={[1, 1.5]}
        gl={{ antialias: false, alpha: true }}
        style={{ background: "transparent" }}
      >
        <ParticleField />
        <FloatingGrid />
      </Canvas>
    </div>
  );
};

export default Background3D;
