'use client';

import { useState } from 'react';
import { tickerHue } from '../lib/tokens';

interface TokenLogoProps {
  src: string | null | undefined;
  ticker: string;
  size?: number; // px
}

/**
 * Token-Logo mit Fallback: Lädt das echte Logo (CoinGecko CDN) und zeigt
 * bei Fehler/fehlender URL einen farbigen Kreis mit dem Anfangsbuchstaben.
 */
export default function TokenLogo({ src, ticker, size = 32 }: TokenLogoProps) {
  const [failed, setFailed] = useState(false);
  const showImage = src && !failed;

  if (!showImage) {
    const hue = tickerHue(ticker);
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
        style={{
          width: size,
          height: size,
          fontSize: size * 0.4,
          background: `linear-gradient(135deg, hsl(${hue} 70% 45%), hsl(${(hue + 40) % 360} 70% 30%))`,
        }}
      >
        {ticker.charAt(0)}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- externe CDN-Logos, bewusst ohne next/image-Optimierung
    <img
      src={src}
      alt={`${ticker} Logo`}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      className="shrink-0 rounded-full bg-white/5 object-cover"
      style={{ width: size, height: size }}
    />
  );
}
