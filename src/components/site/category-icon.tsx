import { Cloud, CreditCard, FileCode2, Mail, Server, ShoppingCart, Wrench, Hexagon, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  wordpress: FileCode2,
  woocommerce: ShoppingCart,
  server: Server,
  cloud: Cloud,
  nodejs: Hexagon,
  payments: CreditCard,
  mail: Mail,
  tools: Wrench,
};

export const CATEGORY_ICON_KEYS = Object.keys(ICONS);

export function CategoryIcon({ name, size = 20 }: { name?: string | null; size?: number }) {
  const Icon = (name && ICONS[name]) || FileCode2;
  return <Icon size={size} strokeWidth={1.75} aria-hidden="true" />;
}
