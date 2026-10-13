import Inter_400Regular from '../../assets/fonts/Inter_400Regular.woff2';
import Inter_500Medium from '../../assets/fonts/Inter_500Medium.woff2';
import Inter_600SemiBold from '../../assets/fonts/Inter_600SemiBold.woff2';
import Inter_700Bold from '../../assets/fonts/Inter_700Bold.woff2';

/**
 * Web: Inter cut down to Latin, punctuation, arrows and ₹ as WOFF2 (about 21 KB per weight
 * instead of 340 KB per TTF); other scripts use the device's own font. Made with
 * scripts/subset-fonts.sh; the licence is assets/fonts/OFL.txt.
 */
export const interFonts = { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold };
