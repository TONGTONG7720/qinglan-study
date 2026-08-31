import { Icon } from "./Icon";

export interface StatusPanelProps {
  readonly title: string;
  readonly description: string;
  readonly tone?: "neutral" | "error";
  readonly actionLabel?: string;
  readonly onAction?: () => void;
}

export function StatusPanel({
  title,
  description,
  tone = "neutral",
  actionLabel,
  onAction,
}: StatusPanelProps) {
  return (
    <section className={`status-panel status-panel-${tone}`} role={tone === "error" ? "alert" : "status"}>
      <Icon name={tone === "error" ? "circleAlert" : "info"} size={24} />
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
        {actionLabel !== undefined && onAction !== undefined ? (
          <button className="secondary-button" onClick={onAction} type="button">
            {actionLabel}
          </button>
        ) : null}
      </div>
    </section>
  );
}
