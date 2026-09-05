import type { TextStyle, ViewStyle } from 'react-native';

const font = (fontSize: number, lineHeight: number, fontWeight: TextStyle['fontWeight']): TextStyle => ({ fontSize, lineHeight, fontWeight });

export const uiTokens = Object.freeze({
  color: Object.freeze({ background: '#F3F5F7', surface: '#FFFFFF', surfaceElevated: '#FFFFFF', textPrimary: '#17201E', textSecondary: '#46504D', separator: '#E1E6E4', accent: '#075C4B', accentPressed: '#0E6655', accentSoft: '#E7F4F0', success: '#247A4A', successSoft: '#E8F4EC', warning: '#9A6412', warningSoft: '#FFF4D9', critical: '#8F2020', criticalSoft: '#FCEAEA', info: '#316D9E', infoSoft: '#EAF2F9', disabled: '#A9B2AF', disabledSurface: '#E9ECEB', overlay: 'rgba(13, 23, 21, 0.48)', onAccent: '#FFFFFF' }),
  spacing: Object.freeze({ xs: 6, sm: 10, md: 14, lg: 18, xl: 24, xxl: 32 }),
  radius: Object.freeze({ control: 12, card: 16, section: 20, pill: 999 }),
  typography: Object.freeze({ largeTitle: font(34, 40, '700'), title: font(26, 32, '700'), sectionTitle: font(17, 22, '700'), body: font(16, 22, '400'), secondaryBody: font(15, 21, '400'), label: font(14, 18, '600'), caption: font(13, 17, '500'), button: font(16, 20, '700') }),
  shadow: Object.freeze({ card: Object.freeze({ shadowColor: '#14231F', shadowOpacity: 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 2 } satisfies ViewStyle) }),
  layout: Object.freeze({ phoneMaxWidth: 500, contentMaxWidth: 720, desktopMaxWidth: 1440, minTouch: 48 }),
  ownerHome: Object.freeze({ canvas: '#EDF5FF', canvasStrong: '#DCE9FF', surface: '#FFFFFF', surfaceSoft: '#F7FAFF', ink: '#182541', muted: '#667793', blue: '#1767F7', bluePressed: '#0D55D8', blueSoft: '#E8F1FF', red: '#D82F3E', redSoft: '#FFF0F0', border: '#C8DAF3', desktopMaxWidth: 1440 }),
});
