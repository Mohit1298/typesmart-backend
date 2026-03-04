import apn from 'apn';

export type PushSendResult = {
  sentCount: number;
  failedCount: number;
  invalidTokens: string[];
  failures: Array<{ token: string; reason: string }>;
};

export function normalizePushToken(token: string): string {
  return token.replace(/[<>\s]/g, '');
}

function getProvider(): apn.Provider {
  const keyId = process.env.APN_KEY_ID;
  const teamId = process.env.APN_TEAM_ID;
  const bundleId = process.env.APN_BUNDLE_ID;

  if (!keyId || !teamId || !bundleId) {
    throw new Error('Missing APNs env vars: APN_KEY_ID, APN_TEAM_ID, APN_BUNDLE_ID');
  }

  const keyPath = process.env.APN_KEY_PATH;
  const keyRaw = process.env.APN_AUTH_KEY?.replace(/\\n/g, '\n');

  if (!keyPath && !keyRaw) {
    throw new Error('Missing APNs key: set APN_KEY_PATH or APN_AUTH_KEY');
  }

  return new apn.Provider({
    token: {
      key: keyPath || keyRaw!,
      keyId,
      teamId,
    },
    production: process.env.APN_PRODUCTION === 'true',
  });
}

export async function sendPushToTokens(args: {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
}): Promise<PushSendResult> {
  const provider = getProvider();
  const bundleId = process.env.APN_BUNDLE_ID!;

  try {
    const tokens = Array.from(new Set(args.tokens.map(normalizePushToken).filter(Boolean)));

    if (tokens.length === 0) {
      return { sentCount: 0, failedCount: 0, invalidTokens: [], failures: [] };
    }

    const notification = new apn.Notification();
    notification.topic = bundleId;
    notification.alert = {
      title: args.title,
      body: args.body,
    };
    notification.sound = 'default';
    notification.payload = args.data ?? {};

    const result = await provider.send(notification, tokens);

    const failures = result.failed.map((f) => {
      const token = typeof f.device === 'string' ? f.device : (f.device as any)?.toString?.() ?? 'unknown';
      const reason =
        (f.response as any)?.reason ||
        (f.error as Error | undefined)?.message ||
        'Unknown error';
      return { token, reason };
    });

    const invalidReasons = new Set(['BadDeviceToken', 'Unregistered', 'DeviceTokenNotForTopic']);
    const invalidTokens = failures
      .filter((f) => invalidReasons.has(f.reason))
      .map((f) => normalizePushToken(f.token));

    return {
      sentCount: result.sent.length,
      failedCount: result.failed.length,
      invalidTokens,
      failures,
    };
  } finally {
    provider.shutdown();
  }
}
