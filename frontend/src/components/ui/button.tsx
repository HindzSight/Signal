import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-all outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 cursor-pointer select-none active:translate-y-px",
  {
    variants: {
      variant: {
        default:
          "bg-secondary text-secondary-foreground border border-border hover:bg-accent hover:border-primary/40",
        signal:
          "bg-primary text-primary-foreground shadow-[0_1px_0_0_color-mix(in_oklab,#fff_30%,transparent)_inset,0_10px_30px_-8px_color-mix(in_oklab,var(--signal)_60%,transparent)] hover:brightness-108 hover:shadow-[0_1px_0_0_color-mix(in_oklab,#fff_35%,transparent)_inset,0_14px_40px_-8px_color-mix(in_oklab,var(--signal)_75%,transparent)]",
        destructive:
          "bg-destructive/12 text-destructive border border-destructive/25 hover:bg-destructive/20",
        ghost:
          "hover:bg-accent text-foreground/80 hover:text-foreground",
        outline:
          "border border-input bg-transparent hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-sm px-3 text-xs",
        lg: "h-12 rounded-lg px-6 text-[15px]",
        icon: "size-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
