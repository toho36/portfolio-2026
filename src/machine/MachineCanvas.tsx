import { Canvas } from '@react-three/fiber'
import { useLayoutEffect } from 'react'
import { gsap } from '../motion/gsap'

function RendererHandshake() {
  useLayoutEffect(() => {
    const context = gsap.context(() => {})
    return () => context.revert()
  }, [])

  return (
    <group rotation={[0.18, -0.35, 0]}>
      <mesh position={[0, -0.85, 0]}>
        <boxGeometry args={[4.8, 0.45, 2.4]} />
        <meshStandardMaterial color="#242730" metalness={0.8} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[3.8, 1.4, 1.8]} />
        <meshStandardMaterial color="#d8d1c4" metalness={0.75} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.05, 0.95]}>
        <boxGeometry args={[1.25, 0.8, 0.15]} />
        <meshStandardMaterial color="#0a0b0f" />
      </mesh>
      <mesh position={[0, 0.05, 1.06]}>
        <boxGeometry args={[0.72, 0.46, 0.08]} />
        <meshStandardMaterial color="#ff5a1f" emissive="#ff5a1f" emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[2.05, -0.35, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.55, 0.55, 0.35, 24]} />
        <meshStandardMaterial color="#42e8ff" metalness={0.55} roughness={0.25} />
      </mesh>
    </group>
  )
}

export default function MachineCanvas() {
  return (
    <Canvas
      aria-label="Unfinished 3D renderer handshake for The Vitek Machine"
      camera={{ position: [0, 1.2, 6.5], fov: 42 }}
      dpr={[1, 1.5]}
      frameloop="demand"
    >
      <color attach="background" args={['#0a0b0f']} />
      <ambientLight intensity={1.7} />
      <directionalLight position={[4, 6, 5]} intensity={3.2} />
      <RendererHandshake />
    </Canvas>
  )
}
