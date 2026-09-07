// Reconnect independently of the API pool: a lost LISTEN connection must not
// leave healthy SSE connections silently serving stale data.
export function createLiveListener({ createClient, onNotification, onError = console.error, onReconnect = () => {}, retryDelay = 1000, schedule = setTimeout, cancel = clearTimeout }) {
  let current = null;
  let timer = null;
  let stopped = false;
  let attempts = 0;
  let connectedOnce = false;

  const connect = async () => {
    if (stopped) return;
    const client = createClient();
    current = client;
    let failed = false;
    const disconnected = error => {
      if (failed || stopped || current !== client) return;
      failed = true;
      current = null;
      if (error) onError(error);
      Promise.resolve(client.end()).catch(() => {});
      timer = schedule(() => { timer = null; void connect(); }, Math.min(retryDelay * 2 ** attempts++, 30000));
      timer?.unref?.();
    };
    client.on('error', disconnected);
    client.on('end', () => disconnected());
    client.on('notification', message => { if (!stopped && !failed && current === client) onNotification(message); });
    try {
      await client.connect();
      if (stopped || failed) return;
      await client.query('LISTEN projects_live_change');
      if (stopped || failed) return;
      attempts = 0;
      if (connectedOnce) onReconnect();
      connectedOnce = true;
    } catch (error) { disconnected(error); }
  };
  return {
    start: connect,
    async stop() {
      stopped = true;
      if (timer) cancel(timer);
      const client = current;
      current = null;
      if (client) await client.end().catch(() => {});
    },
  };
}
