'use client';

import { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { cn } from '@/lib/utils';
import { DEV_MODE_ENABLED } from '@/config/devMode';
import { useUsageLimit } from '@/hooks/useUsageLimit';
import { useAuthContext } from '@/contexts/AuthContext';
import { RefreshCcw } from 'lucide-react';
import { Button } from './ui/button';

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

interface AdBannerProps {
  variant?: 'sidebar' | 'horizontal' | 'square';
  className?: string;
  slotId?: string;
}

export function AdBanner({ variant = 'sidebar', className, slotId }: AdBannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pushedRef = useRef(false);
  const { user } = useAuthContext();
  const { resetGuestUsage, userType } = useUsageLimit(null, !!user);

  // State to hold the explicitly measured width of the parent container
  const [containerWidth, setContainerWidth] = useState<number | null>(null);

  // 1. Measure the container as soon as it mounts and whenever it resizes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let resizeObserver: ResizeObserver | null = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Debounce/threshold the measurement to avoid infinite loops and 0px initial jumps
        const width = entry.contentRect.width;
        if (width > 10) {
          // Add a tiny delay to ensure layout is settled before we tell React to render the ad
          setTimeout(() => setContainerWidth(width), 50);
        }
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver?.disconnect();
    };
  }, []);

  // 2. Only push to AdSense AFTER the containerWidth is known AND the <ins> has rendered (which depends on containerWidth)
  useEffect(() => {
    if (containerWidth === null || containerWidth <= 10 || pushedRef.current) return;

    // Use a small timeout just to guarantee the <ins> tag (which rendered down below based on containerWidth)
    // is fully attached to the live DOM tree before AdSense scrip searches for it.
    const timer = setTimeout(() => {
      try {
        pushedRef.current = true;
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (e) {
        console.error('[AdSense] Push Failed:', e);
        pushedRef.current = false;
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [containerWidth]);

  const sizeStyles: Record<string, { minHeight: string; maxWidth?: string }> = {
    sidebar: { minHeight: '600px', maxWidth: '160px' },
    horizontal: { minHeight: '90px' },
    square: { minHeight: '280px', maxWidth: '336px' },
  };

  const currentStyle = sizeStyles[variant];

  // If containerWidth is set, we bypass data-full-width-responsive and force an explicit static width.
  // We MUST conditionally render the <ins> tag only when we have the width.
  return (
    <div className={cn('flex flex-col items-center justify-center overflow-hidden w-full group/ad relative', className)}>
      <div
        ref={containerRef}
        className="bg-muted/5 rounded-lg border border-border/30 w-full flex justify-center"
        style={{
          display: 'block',
          maxWidth: currentStyle.maxWidth || '100%',
          minHeight: currentStyle.minHeight,
          // Explicit minWidth forces the container to at least occupy space even before it expands
          minWidth: '50px'
        }}
      >
        {containerWidth !== null && containerWidth > 10 ? (
          <ins
            className="adsbygoogle"
            style={{
              display: 'block',
              width: `${containerWidth}px`, // Fixed explicit width
              height: currentStyle.minHeight, // Fixed explicit height
              overflow: 'hidden'
            }}
            data-ad-client="ca-pub-3534264996279802"
            data-ad-slot={slotId || "YOUR_AD_SLOT_ID"}
            // Turn OFF responsive width to force AdSense to accept our explicit style.width
            data-full-width-responsive="false"
          />
        ) : null}
      </div>

      {DEV_MODE_ENABLED && userType === 'guest' && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute -top-2 -right-2 opacity-0 group-hover/ad:opacity-100 transition-opacity h-6 w-6 rounded-full bg-background border shadow-sm z-10"
          onClick={(e) => {
            e.stopPropagation();
            resetGuestUsage();
          }}
          title="Reset guest usage (Dev only)"
        >
          <RefreshCcw className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
