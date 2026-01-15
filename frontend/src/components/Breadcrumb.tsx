import { useNavigate } from 'react-router-dom';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className = '' }: BreadcrumbProps) {
  const navigate = useNavigate();

  const handleClick = (item: BreadcrumbItem) => {
    if (item.onClick) {
      item.onClick();
    } else if (item.href) {
      navigate(item.href);
    }
  };

  if (items.length === 0) return null;

  return (
    <nav className={`flex items-center gap-2 text-sm text-slate-600 ${className}`}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const isClickable = !isLast && (item.href || item.onClick);

        return (
          <div key={index} className="flex items-center gap-2">
            {isClickable ? (
              <button
                onClick={() => handleClick(item)}
                className="hover:text-indigo-600 transition-colors"
              >
                {item.label}
              </button>
            ) : (
              <span className={isLast ? 'text-slate-900 font-medium' : ''}>
                {item.label}
              </span>
            )}
            {!isLast && <span className="text-slate-400">/</span>}
          </div>
        );
      })}
    </nav>
  );
}


