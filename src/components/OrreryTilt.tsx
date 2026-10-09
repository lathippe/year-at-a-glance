"use client";

import { useMemo, useRef, useSyncExternalStore } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Line, OrbitControls, Stars } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { BODIES_3D, compress, eclipticVec, orbitPath, SCENE_R_MAX } from "@/lib/helio3d";
import type { Vec3 } from "@/lib/helio3d";
import { planetTone } from "@/lib/planetTones";

/**
 * The dial, tilted. Same date, same bodies, same colours, but the orbits are the
 * real ones out of the ephemeris: ellipses, each in its own plane. Seen from
 * straight above it is the flat dial again, which is where the camera starts;
 * it then leans over so the heights become visible.
 *
 * Ecliptic axes are mapped so that the view from above matches the dial: 0° at
 * three o'clock, counterclockwise. Three's y is up, so ecliptic (x, y, z) is
 * drawn at (x, z, -y).
 */
const toScene = ([x, y, z]: Vec3): Vec3 => [x, z, -y];

/** Far enough that Pluto's whole orbit and the ecliptic ring stay inside the
    square, from above and leaning. */
const CAM_DIST = 41;
/** Polar angle of the resting view, from straight above. About 55°: steep
    enough to read the rings as rings, low enough to see what sits above them. */
const REST_POLAR = 0.96;
const INTRO_MS = 1600;

/** Body sizes in scene units. Not to scale, which nothing on a dial this size
    could be; ordered so the giants read as giants. */
const RADIUS: Record<string, number> = {
  Mercury: 0.11, Venus: 0.16, Earth: 0.17, Mars: 0.13,
  Jupiter: 0.34, Saturn: 0.3, Uranus: 0.23, Neptune: 0.23, Pluto: 0.09,
};

function CameraIntro({ controlsRef }: { controlsRef: React.RefObject<OrbitControlsImpl | null> }) {
  const camera = useThree((s) => s.camera);
  const t0 = useRef<number | null>(null);
  const done = useRef(false);
  useFrame(({ clock }) => {
    if (done.current) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (t0.current == null) t0.current = clock.elapsedTime * 1000;
    const k = reduced ? 1 : Math.min(1, (clock.elapsedTime * 1000 - t0.current) / INTRO_MS);
    // Ease out: the lean starts at once and settles.
    const e = 1 - Math.pow(1 - k, 3);
    const phi = 0.0005 + (REST_POLAR - 0.0005) * e;
    const cam = camera;
    cam.position.set(0, CAM_DIST * Math.cos(phi), CAM_DIST * Math.sin(phi));
    cam.lookAt(0, 0, 0);
    const controls = controlsRef.current;
    if (controls) {
      controls.enabled = k >= 1;
      controls.update();
    }
    if (k >= 1) done.current = true;
  });
  return null;
}

function Scene({ date, night, interactive }: { date: Date; night: boolean; interactive: boolean }) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  // Orbits change over centuries, not over a scrub: computed once.
  const orbits = useMemo(() => {
    const now = new Date();
    return BODIES_3D.map((b) => ({
      name: b.name,
      points: orbitPath(b.body, b.periodDays, now).map(toScene),
    }));
  }, []);

  const bodies = useMemo(
    () =>
      BODIES_3D.map((b) => ({
        name: b.name,
        pos: toScene(compress(eclipticVec(b.body, date))),
      })),
    [date]
  );

  const ringTone = night ? "#ffffff" : "#121212";
  const sun = planetTone("Sun", night);

  return (
    <>
      <ambientLight intensity={night ? 0.25 : 0.9} />
      <pointLight position={[0, 0, 0]} intensity={night ? 4 : 2} decay={0} color={sun} />
      {night && <Stars radius={70} depth={40} count={2200} factor={3} saturation={0} fade speed={0} />}

      {/* The ecliptic itself, as a faint ring at the edge. It is what the tilts
          are tilts away from, so it has to be there to be measured against. */}
      <Line
        points={Array.from({ length: 129 }, (_, i) => {
          const a = (i / 128) * Math.PI * 2;
          return [Math.cos(a) * (SCENE_R_MAX + 0.6), 0, -Math.sin(a) * (SCENE_R_MAX + 0.6)] as Vec3;
        })}
        color={ringTone}
        lineWidth={1}
        transparent
        opacity={0.14}
        dashed
        dashSize={0.25}
        gapSize={0.25}
      />

      <mesh>
        <sphereGeometry args={[0.42, 48, 48]} />
        <meshBasicMaterial color={sun} toneMapped={false} />
      </mesh>
      {orbits.map((o) => (
        <Line
          key={o.name}
          points={o.points}
          color={planetTone(o.name, night)}
          lineWidth={1}
          transparent
          opacity={night ? 0.42 : 0.5}
        />
      ))}

      {bodies.map((b) => {
        const tone = planetTone(b.name, night);
        const [x, y, z] = b.pos;
        return (
          <group key={b.name}>
            {/* A drop to the ecliptic plane: how far above or below it the body
                is right now. Most are a hair off; Pluto is not. */}
            {Math.abs(y) > 0.02 && (
              <Line points={[[x, y, z], [x, 0, z]]} color={tone} lineWidth={1} transparent opacity={0.35} />
            )}
            <mesh position={b.pos}>
              <sphereGeometry args={[RADIUS[b.name] ?? 0.12, 32, 32]} />
              <meshStandardMaterial color={tone} roughness={0.85} metalness={0} />
            </mesh>
          </group>
        );
      })}

      <OrbitControls
        ref={controlsRef}
        makeDefault
        enabled={false}
        enableZoom={false}
        enablePan={false}
        enableRotate={interactive}
        enableDamping
        minPolarAngle={0.0005}
        maxPolarAngle={1.45}
      />
      <CameraIntro controlsRef={controlsRef} />
    </>
  );
}

export default function OrreryTilt({ date, night }: { date: Date; night: boolean }) {
  // On a phone a drag on the dial already scrubs the date. Turning the camera
  // with the same finger would make both of them guesswork, so there the view
  // stays where the intro leaves it.
  const interactive = useSyncExternalStore(
    () => () => {},
    () => !window.matchMedia("(hover: none)").matches,
    () => true
  );
  return (
    <Canvas
      camera={{ position: [0, CAM_DIST, 0.01], fov: 32, near: 0.1, far: 400 }}
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      style={{ width: "100%", height: "100%", cursor: "grab" }}
      aria-label="The planets on their orbits, tilted to show their heights above the ecliptic"
    >
      <Scene date={date} night={night} interactive={interactive} />
    </Canvas>
  );
}
