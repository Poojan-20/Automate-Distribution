"use client"

import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { useToast } from "@/components/ui/use-toast"
import { AlertCircle, CheckCircle, AlertTriangle, Info } from "lucide-react"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        // Add icons based on variant
        let Icon = null
        if (props.variant === "destructive") {
          Icon = AlertCircle
        } else if (props.variant === "success") {
          Icon = CheckCircle
        } else if (props.variant === "warning") {
          Icon = AlertTriangle
        } else {
          Icon = Info
        }
        
        return (
          <Toast key={id} {...props}>
            <div className="flex gap-3">
              {Icon && <Icon className="h-5 w-5" />}
              <div className="grid gap-1">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && (
                  <ToastDescription>{description}</ToastDescription>
                )}
              </div>
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
} 