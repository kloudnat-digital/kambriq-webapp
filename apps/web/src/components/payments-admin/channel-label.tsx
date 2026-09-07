import { PAYMENT_CHANNELS } from '@kambriq/common/payments/payment-channels';
import type { PaymentChannel } from '@/types/payments';

/**
 * The label a screen shows, from the one registry the API reads too.
 *
 * v03 4b keeps the code and the label as two separate pieces of data: the code
 * is what a person says on the telephone, the label is what a screen shows, and
 * neither is derived from the other. So this renders both, and computes
 * neither - `'OMO'.toLowerCase()` is not "Orange Money".
 */
export const ChannelLabel = ({
  channel,
  withCode = false,
}: {
  channel: PaymentChannel | null | undefined;
  withCode?: boolean;
}) => {
  if (!channel) return <span className="text-gray-400">—</span>;
  const def = PAYMENT_CHANNELS[channel];
  if (!def) return <span className="font-mono">{channel}</span>;
  return (
    <span>
      {def.label}
      {withCode && <span className="ml-1 font-mono text-xs text-gray-500">({def.code})</span>}
    </span>
  );
};

/** The six a person may pick, in the registry's order. `HIST` is not among them. */
export const selectableChannels = Object.values(PAYMENT_CHANNELS).filter((c) => c.selectable);
