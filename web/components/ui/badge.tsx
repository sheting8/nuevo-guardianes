import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Mirrors Nocturne's .tag/.tag-accent/.tag-neutral/.tag-outline, kept under
// the pre-existing variant names (default/secondary/gold/outline) so call
// sites don't need updating for the token swap alone. Note: the prototype's
// own light-theme override pairs tag-neutral's white background with a
// near-white text color (only accent-* tokens were overridden, not
// neutral-100) — visually broken there, so "secondary" here uses the
// readable secondary/foreground pair instead of copying that bug.
const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "bg-accent-800 text-accent-100",
        secondary: "bg-secondary text-secondary-foreground",
        gold: "bg-accent-800 text-accent-100",
        outline: "border border-primary text-primary",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
