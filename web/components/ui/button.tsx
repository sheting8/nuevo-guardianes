import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-ring",
  {
    variants: {
      // Nocturne: primary actions are an accent OUTLINE, never a filled
      // background — this is a deliberate system rule (see the design
      // project's readme), not an oversight.
      variant: {
        default: "border border-primary bg-transparent text-primary hover:bg-primary/10 active:bg-primary/20",
        destructive: "border border-destructive bg-transparent text-destructive hover:bg-destructive/10 active:bg-destructive/20",
        outline: "border border-input bg-background hover:bg-secondary",
        ghost: "text-primary hover:bg-primary/10 active:bg-primary/20",
      },
      size: {
        default: "h-11 px-4 py-2",
        sm: "h-11 rounded-md px-3",
        lg: "h-12 rounded-md px-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
