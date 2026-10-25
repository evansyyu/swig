import { memo } from 'react';
import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

import { radius, useColors } from '@/theme';

/**
 * The reference illustration: a bottle on the Balance in front of snowy peaks.
 * `level` (0–1) fills the bottle; `drop` marks it as the day's starting point.
 */
export const HeroArt = memo(function HeroArt({ level = 0.3, drop = false }: { level?: number; drop?: boolean }) {
  const colors = useColors();
  const fill = Math.min(1, Math.max(0, level));
  // Bottle interior spans y 40..108 inside the body.
  const waterTop = 108 - 64 * fill;
  return (
    <Svg
      width="100%"
      viewBox="0 0 352 144"
      style={{ aspectRatio: 352 / 144, borderRadius: radius.lg, overflow: 'hidden' }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Defs>
        <ClipPath id="frame">
          <Rect x={0} y={0} width={352} height={144} rx={24} />
        </ClipPath>
        <ClipPath id="bottle">
          <Rect x={147} y={32} width={58} height={80} rx={11} />
        </ClipPath>
      </Defs>
      <G clipPath="url(#frame)">
        <Rect x={0} y={0} width={352} height={144} fill={colors.surfaceSky} />
        <Path d="M41 144 V118 L104 63 L176 118 L222 54 L311 118 V144 Z" fill={colors.surfaceTint} />
        <Circle cx={261} cy={32} r={16} fill={colors.peach} />
        <Rect x={156} y={18} width={40} height={10} rx={3} fill={colors.accent} />
        <Rect x={145} y={30} width={62} height={84} rx={13} fill={colors.surface} stroke={colors.accentMuted} strokeWidth={2} />
        {fill > 0 && (
          <Rect x={147} y={waterTop} width={58} height={112 - waterTop} fill={colors.accentMuted} opacity={0.75} clipPath="url(#bottle)" />
        )}
        {drop && (
          <Path d="M176 66 C171 74 168 79 168 83 A8 8 0 0 0 184 83 C184 79 181 74 176 66 Z" fill={colors.surface} />
        )}
        <Rect x={104} y={121} width={144} height={6} rx={3} fill={colors.surface} />
      </G>
    </Svg>
  );
});
