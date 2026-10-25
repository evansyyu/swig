import { View } from 'react-native';
import Animated, {
  cubicBezier,
  Easing,
  FadeIn,
  FadeOut,
  LayoutAnimationConfig,
  LinearTransition,
  ReduceMotion,
  useReducedMotion,
} from 'react-native-reanimated';

import type { TypeVariant } from '@/theme';

import { ThemedText } from './themed-text';

const CSS_EASE_IN_OUT = cubicBezier(0.77, 0, 0.175, 1);
const DURATION = 300;
const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

const enter = FadeIn.duration(200).easing(Easing.bezier(0.23, 1, 0.32, 1)).reduceMotion(ReduceMotion.System);
const exit = FadeOut.duration(150).reduceMotion(ReduceMotion.System);
const reflow = LinearTransition.duration(DURATION).easing(Easing.bezier(0.77, 0, 0.175, 1)).reduceMotion(ReduceMotion.System);

/**
 * A number whose digits roll to their new value, odometer style; separators swap in place,
 * and characters that appear or go away fade while the rest slide over. The roll is a
 * translate in percent of the digit strip, so it lines up at any text size. Pass the
 * spoken form as `accessibilityLabel`: the strips themselves are hidden from screen readers.
 */
export function RollingNumber({
  value,
  variant,
  accessibilityLabel,
}: {
  value: string;
  variant: TypeVariant;
  accessibilityLabel: string;
}) {
  const reduced = useReducedMotion();
  return (
    <View accessible accessibilityLabel={accessibilityLabel} style={{ flexDirection: 'row' }}>
      <LayoutAnimationConfig skipEntering>
        {[...value].map((char, i) => {
          const digit = DIGITS.indexOf(char);
          return (
            <Animated.View
              key={`${i}${digit < 0 ? char : 'd'}`}
              entering={enter}
              exiting={exit}
              layout={reflow}
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden
            >
              {digit < 0 ? (
                <ThemedText variant={variant}>{char}</ThemedText>
              ) : (
                <View style={{ overflow: 'hidden' }}>
                  {/* Sizes the window to one digit; the strip scrolls behind it. */}
                  <ThemedText variant={variant} style={{ opacity: 0 }}>
                    0
                  </ThemedText>
                  <Animated.View
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      transform: [{ translateY: `${-digit * 10}%` }],
                      transitionProperty: 'transform',
                      transitionDuration: reduced ? 0 : DURATION,
                      transitionTimingFunction: CSS_EASE_IN_OUT,
                    }}
                  >
                    {DIGITS.map((d) => (
                      <ThemedText key={d} variant={variant} style={{ textAlign: 'center' }}>
                        {d}
                      </ThemedText>
                    ))}
                  </Animated.View>
                </View>
              )}
            </Animated.View>
          );
        })}
      </LayoutAnimationConfig>
    </View>
  );
}
