import { type ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { cubicBezier } from 'react-native-reanimated';

const CSS_EASE_OUT = cubicBezier(0.23, 1, 0.32, 1);

/**
 * Press feedback for button-like elements: scale to 0.97 on press-in (120 ms CSS
 * transition, UI thread), commit on press-out. `pressedStyle` adds a state change on top.
 */
export function PressableScale({
  children,
  style,
  pressedStyle,
  ...props
}: Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  pressedStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable pressRetentionOffset={16} {...props}>
      {({ pressed }) => (
        <Animated.View
          style={[
            style,
            pressed && pressedStyle,
            {
              transform: [{ scale: pressed ? 0.97 : 1 }],
              transitionProperty: 'transform',
              transitionDuration: 120,
              transitionTimingFunction: CSS_EASE_OUT,
            },
          ]}
        >
          {children}
        </Animated.View>
      )}
    </Pressable>
  );
}
