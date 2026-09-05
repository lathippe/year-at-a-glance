import { ReactNode } from "react";

type PanelProps = {
  number: string;
  label: string;
  /** Text, or a control: the header is where a panel keeps its own switch. */
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function Panel({ number, label, meta, children, className = "" }: PanelProps) {
  // Midday: depth comes from surface contrast, never shadow or border. The card
  // already separates from the canvas, so it wears neither — hover lifts it by
  // tone alone, through a token, so the dark theme lifts instead of flashing
  // white.
  return (
    <section
      className={`bg-surface rounded-lg p-5 flex flex-col transition-colors duration-300 hover:bg-surface-hover ${className}`}
    >
      <header className="flex items-center justify-between gap-3 mb-4 min-w-0">
        <span className="label whitespace-nowrap">
          {number} {"//"} {label}
        </span>
        {meta && (
          <span className="label whitespace-nowrap text-right flex items-center gap-3">
            {meta}
          </span>
        )}
      </header>
      <div className="flex-1">{children}</div>
    </section>
  );
}
