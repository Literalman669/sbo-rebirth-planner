import type { WeaponPath } from '../../domain/build/model';

type WeaponPathIconProps = { path: WeaponPath };

const Sword = ({ x = 0 }: { x?: number }) => (
  <g transform={`translate(${x} 0)`}>
    <path d="m32 8 4 4-19 30-6 4 2-7L32 8Z" />
    <path d="m14 36 8 6M9 45l5 5M8 51l5-5" />
  </g>
);

export function WeaponPathIcon({ path }: WeaponPathIconProps) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      {path === 'two-handed' ? (
        <>
          <path d="m42 7 6 6-27 35-9 6 4-10L42 7Z" />
          <path d="m17 42 9 8M10 53l7-7M16 55l-3-3" />
        </>
      ) : null}
      {path === 'one-handed' ? (
        <>
          <Sword x={-10} />
          <path d="M39 27 53 32v10c0 8-5 13-14 17-9-4-14-9-14-17V32l14-5Z" />
          <path d="M39 33v19M31 37h16" />
        </>
      ) : null}
      {path === 'rapier' ? (
        <>
          <path d="m43 7 4 4-26 38-6 5 3-7L43 7Z" />
          <path d="M13 44c7 2 11 6 13 13M11 49l7 6M22 46l-7 8" />
        </>
      ) : null}
      {path === 'dagger' ? (
        <>
          <path d="m20 17 5 3-8 21-7 7 2-10 8-21ZM44 17l-5 3 8 21 7 7-2-10-8-21Z" />
          <path d="m9 42 10 4M55 42l-10 4" />
        </>
      ) : null}
      {path === 'dual-wield' ? (
        <>
          <path d="m15 13 5-3 14 31 1 10-6-8-14-30ZM49 13l-5-3-14 31-1 10 6-8 14-30Z" />
          <path d="m24 38-10 5M40 38l10 5" />
        </>
      ) : null}
      {path === 'melee' ? (
        <>
          <path d="M18 23h7v-8h7v8h5v-7h7v11l5 5-9 21H22L12 39l6-16Z" />
          <path d="M22 32h18M23 38h15M25 44h11" />
        </>
      ) : null}
    </svg>
  );
}
