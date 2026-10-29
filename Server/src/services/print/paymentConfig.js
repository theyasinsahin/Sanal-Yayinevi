// Configuration is read at call time so callbacks and maintenance share the
// same explicit off switch. A live iyzico API origin is never enabled here.
export function iyzicoSandboxConfigured() {
  try {
    const url = new URL(process.env.IYZICO_BASE_URL);
    return url.href === 'https://sandbox-api.iyzipay.com/' && !!process.env.IYZICO_API_KEY && !!process.env.IYZICO_SECRET_KEY;
  } catch { return false; }
}

export function printPaymentMode() {
  if (process.env.PRINT_SYSTEM_ENABLED === 'false') return 'DISABLED';
  const mode = process.env.PRINT_PAYMENTS_MODE;
  if (mode === 'SANDBOX') return process.env.PRINT_SYSTEM_ENABLED === 'true' && ['development', 'test'].includes(process.env.NODE_ENV)
    && (process.env.PRINT_SANDBOX_WEBHOOK_SECRET?.length || 0) >= 32 ? 'SANDBOX' : 'DISABLED';
  if ((mode === 'IYZICO_SANDBOX' || (!mode && process.env.NODE_ENV !== 'test')) && iyzicoSandboxConfigured()) return 'IYZICO_SANDBOX';
  return 'DISABLED';
}

export const printSystemEnabled = () => process.env.PRINT_SYSTEM_ENABLED === 'true' || printPaymentMode() === 'IYZICO_SANDBOX';
