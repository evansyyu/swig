import { Image, type ImageStyle } from 'expo-image';
import { type StyleProp, useColorScheme } from 'react-native';

/**
 * The Swig logo: the "swig" wordmark or the "S" mark, black on light backgrounds and white
 * on dark. App-sized copies of assets/logos (the sources) live in assets/images.
 */
const LOGOS = {
  wordmark: {
    light: require('@/assets/images/logo-wordmark-light.png'),
    dark: require('@/assets/images/logo-wordmark-dark.png'),
    aspectRatio: 900 / 685,
  },
  mark: {
    light: require('@/assets/images/logo-mark-light.png'),
    dark: require('@/assets/images/logo-mark-dark.png'),
    aspectRatio: 313 / 360,
  },
} as const;

export function Logo({
  variant = 'wordmark',
  height,
  style,
}: {
  variant?: keyof typeof LOGOS;
  height: number;
  style?: StyleProp<ImageStyle>;
}) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const logo = LOGOS[variant];
  return (
    <Image
      source={logo[scheme]}
      style={[{ height, aspectRatio: logo.aspectRatio }, style]}
      contentFit="contain"
      accessibilityRole="image"
      accessibilityLabel="Swig"
    />
  );
}
