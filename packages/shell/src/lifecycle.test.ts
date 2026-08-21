import { describe, expect, it } from 'vitest';
import { assertSupportedContractVersion } from './lifecycle.ts';

describe('assertSupportedContractVersion', () => {
  it('accepts the current contract version', () => {
    expect(() => assertSupportedContractVersion(1)).not.toThrow();
  });

  it('throws on an unrecognized contractVersion, naming it in the message', () => {
    // @ts-expect-error -- exercising the runtime guard against a value the
    // type system itself already rejects; the registry is untrusted JSON.
    expect(() => assertSupportedContractVersion(2)).toThrow(/2/);
  });
});
