import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;
const SheetPortal = DialogPrimitive.Portal;

const SheetOverlay = ({ className, ...props }: DialogPrimitive.DialogOverlayProps) => (
  <DialogPrimitive.Overlay
    className={cn("fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]", className)}
    {...props}
  />
);

const SheetContent = ({ className, children, ...props }: DialogPrimitive.DialogContentProps) => (
  <SheetPortal>
    <SheetOverlay />
    <DialogPrimitive.Content
      className={cn(
        "deco-frame fixed left-1/2 top-1/2 z-50 flex h-[min(86vh,48rem)] w-[min(96vw,65rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden border-primary-gold bg-deco-bg shadow-2xl",
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-3 top-3 text-primary-gold transition-colors hover:text-deco-foreground">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </SheetPortal>
);

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "border-b border-primary-gold bg-primary-gold-muted px-4 py-3",
      className,
    )}
    {...props}
  />
);

const SheetTitle = ({ className, ...props }: DialogPrimitive.DialogTitleProps) => (
  <DialogPrimitive.Title
    className={cn("font-heading text-base font-semibold text-deco-foreground", className)}
    {...props}
  />
);

const SheetDescription = ({ className, ...props }: DialogPrimitive.DialogDescriptionProps) => (
  <DialogPrimitive.Description
    className={cn("mt-1 text-xs text-deco-muted", className)}
    {...props}
  />
);

export { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger };
