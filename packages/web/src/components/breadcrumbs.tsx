import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

interface BreadcrumbItem {
  id: number;
  name: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Link href="/" className="hover:text-foreground transition-colors">
        <Home className="h-4 w-4" />
      </Link>
      {items.map((item, i) => (
        <span key={item.id} className="flex items-center gap-1.5">
          <ChevronRight className="h-3.5 w-3.5" />
          {i === items.length - 1 ? (
            <span className="text-foreground font-medium">{item.name}</span>
          ) : (
            <Link href={`/courses/${item.id}`} className="hover:text-foreground transition-colors">
              {item.name}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
