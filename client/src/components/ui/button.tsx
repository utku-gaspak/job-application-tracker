import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "deco-frame inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-semibold tracking-[0.08em] uppercase transition-all outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)] disabled:pointer-events-none disabled:opacity-60",
  {
    variants: {
      variant: {
        default:
          "border-primary-gold bg-primary-gold text-deco-bg hover:shadow-deco-glow",
        outline:
          "border-border-gold bg-deco-card text-deco-foreground hover:border-primary-gold hover:text-primary-gold",
        ghost:
          "border-transparent bg-transparent text-deco-muted hover:text-deco-foreground",
        accent:
          "border-accent bg-accent text-deco-bg hover:shadow-deco-glow",
        stamp:
          "border-primary-gold bg-deco-card text-primary-gold hover:bg-primary-gold-muted",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm: "h-9 px-3 py-2 text-xs",
        lg: "h-12 px-6 py-3",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const collectButtonText = (children: React.ReactNode): string =>
  React.Children.toArray(children)
    .map((child) => {
      if (typeof child === "string" || typeof child === "number") {
        return String(child);
      }

      if (React.isValidElement(child)) {
        return collectButtonText(child.props.children);
      }

      return "";
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, title, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const resolvedTitle =
      title ?? props["aria-label"] ?? (collectButtonText(children) || undefined);

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        title={resolvedTitle}
        {...props}
      >
        {children}
      </Comp>
    );
  },
);

Button.displayName = "Button";

export { Button, buttonVariants };
