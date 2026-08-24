'use client';

import { cn } from '@/lib/utils';

import { Toolbar } from './toolbar';

export function FixedToolbar(props: React.ComponentProps<typeof Toolbar>) {
  return (
    <Toolbar
      {...props}
      className={cn(
        // top-[73px]: offset below the app's own sticky header (Header.tsx,
        // 73px tall) -- both are `sticky top-0` by default, which makes
        // this toolbar stick at the very top of the viewport and cover the
        // site nav during scroll instead of sitting below it. z-10 (below
        // the header's z-20) is a second safety net so the header always
        // wins if this ever ends up overlapping it again.
        'scrollbar-hide sticky top-[73px] left-0 z-10 w-full justify-between overflow-x-auto rounded-t-lg border-b border-b-border bg-background/95 p-1 backdrop-blur-sm supports-backdrop-blur:bg-background/60',
        props.className
      )}
    />
  );
}
