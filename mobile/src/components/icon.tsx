import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { SFSymbol } from 'sf-symbols-typescript';

type AndroidSymbol = Extract<SymbolViewProps['name'], { android?: unknown }>['android'];

/** SF Symbol on iOS, Material Symbol on Android: one icon family per platform. */
export function Icon({
  ios,
  android,
  size = 20,
  color,
  weight = 'medium',
}: {
  ios: SFSymbol;
  android: NonNullable<AndroidSymbol>;
  size?: number;
  color: string;
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
}) {
  return (
    <SymbolView
      name={{ ios, android }}
      size={size}
      tintColor={color}
      weight={weight}
      style={{ width: size, height: size }}
    />
  );
}
