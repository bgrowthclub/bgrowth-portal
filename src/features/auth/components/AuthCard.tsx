import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";

interface AuthCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <Card className="p-8">
      <h1 className="text-2xl font-bold text-navy-900 dark:text-white">{title}</h1>
      {subtitle && <p className="mt-2 text-sm text-navy-500 dark:text-white/60">{subtitle}</p>}
      <div className="mt-6 flex flex-col gap-4">{children}</div>
      {footer && <div className="mt-6 text-center text-sm text-navy-500 dark:text-white/60">{footer}</div>}
    </Card>
  );
}
