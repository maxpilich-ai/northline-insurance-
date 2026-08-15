import type { ConsentContract } from "@/lib/leads";

/**
 * Renders a consent contract, with one sentence emphasised.
 *
 * The rendered text is byte-identical to `contract.text`, because it is built
 * by splitting that exact string — nothing is retyped. This matters: the server
 * rejects a submission whose echoed consent text does not match its own
 * constant, so any divergence between what is displayed and what is stored
 * would break the form rather than pass silently. Which is the intended
 * failure mode.
 */
export function ConsentText({
  contract,
  emphasise,
}: {
  contract: ConsentContract;
  emphasise?: string;
}) {
  if (!emphasise) return <>{contract.text}</>;

  const index = contract.text.indexOf(emphasise);
  if (index === -1) return <>{contract.text}</>;

  const before = contract.text.slice(0, index);
  const after = contract.text.slice(index + emphasise.length);

  return (
    <>
      {before}
      <strong className="font-medium text-ink">{emphasise}</strong>
      {after}
    </>
  );
}
