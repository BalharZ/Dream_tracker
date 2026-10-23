import * as React from "react"

import { DialogContent } from "@/components/ui/dialog"

// DialogContent without the close button (X) — for animations that must not
// be interrupted. Same frame and scrolling body as every other dialog.
const DialogContentNoClose = React.forwardRef<
  React.ElementRef<typeof DialogContent>,
  React.ComponentPropsWithoutRef<typeof DialogContent>
>((props, ref) => <DialogContent ref={ref} hideClose {...props} />)
DialogContentNoClose.displayName = "DialogContentNoClose"

export { DialogContentNoClose }

export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
} from "@/components/ui/dialog"
