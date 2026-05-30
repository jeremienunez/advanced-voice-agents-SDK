import { Button } from "../../components/ui/Button.js";

export function CommandActionCard({
  eyebrow,
  title,
  description,
  actionLabel,
  disabled,
  primary = false,
  onClick,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actionLabel: string;
  disabled?: boolean;
  primary?: boolean;
  onClick: () => void;
}) {
  return (
    <article className={primary ? "commandActionCard primary" : "commandActionCard"}>
      <p className="commandKicker">{eyebrow}</p>
      <h3>{title}</h3>
      <p>{description}</p>
      <Button variant={primary ? "primary" : "default"} onClick={onClick} disabled={disabled}>
        {actionLabel}
      </Button>
    </article>
  );
}
