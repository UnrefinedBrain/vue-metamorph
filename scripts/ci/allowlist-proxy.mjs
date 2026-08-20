import net from 'node:net';
import http from 'node:http';

const PORT = Number(process.env.PROXY_PORT ?? 3128);

const allowed = (process.env.ALLOWED_HOSTS ?? '')
  .split(',')
  .map((entry) => entry.trim().toLowerCase())
  .filter(Boolean);

// Log lines reach the workflow output, and the host is attacker-chosen, so
// anything that could pass for a `::workflow command::` is dropped here.
function clean(value) {
  return String(value ?? '')
    .replace(/[^A-Za-z0-9._:-]/g, '?')
    .replace(/:{2,}/g, ':')
    .slice(0, 100);
}

function cleanForLog(value) {
  return clean(
    String(value ?? '')
      .replace(/[\r\n]/g, '')
      .replace(/[\x00-\x1F\x7F]/g, '')
  );
}

function isAllowed(host) {
  const name = host.toLowerCase().replace(/:\d+$/, '');
  return allowed.some((entry) => (entry.startsWith('.')
    ? name === entry.slice(1) || name.endsWith(entry)
    : name === entry));
}

const server = http.createServer((req, res) => {
  console.log(`[proxy] DENY   ${cleanForLog(req.method)} ${cleanForLog(req.headers.host)} (plain HTTP is not proxied)`);
  res.writeHead(403).end('blocked by ecosystem sandbox proxy\n');
});

server.on('connect', (req, clientSocket, head) => {
  const [host, port = '443'] = req.url.split(':');

  if (!isAllowed(host)) {
    console.log(`[proxy] DENY   CONNECT ${clean(req.url)}`);
    clientSocket.end('HTTP/1.1 403 Forbidden\r\n\r\n');
    return;
  }

  console.log(`[proxy] ALLOW  CONNECT ${clean(req.url)}`);
  const upstream = net.connect(Number(port), host, () => {
    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    upstream.write(head);
    upstream.pipe(clientSocket);
    clientSocket.pipe(upstream);
  });

  const drop = (err) => {
    if (err) console.log(`[proxy] ERROR  ${clean(req.url)}: ${clean(err.message)}`);
    upstream.destroy();
    clientSocket.destroy();
  };
  upstream.on('error', drop);
  clientSocket.on('error', drop);
});

server.listen(PORT, () => {
  console.log(`[proxy] listening on ${PORT}, allowing: ${allowed.join(' ')}`);
});
