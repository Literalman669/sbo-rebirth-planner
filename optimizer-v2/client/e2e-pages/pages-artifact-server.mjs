import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';

const port = 4174;
const prefix = '/sbo-rebirth-planner';
const dist = path.resolve(import.meta.dirname, '../dist');
const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.woff2', 'font/woff2'],
]);

createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host}`);
  let relative = decodeURIComponent(url.pathname);
  if (relative === `${prefix}/` || relative === prefix) relative = '/index.html';
  else if (relative.startsWith(`${prefix}/`)) relative = relative.slice(prefix.length);
  else relative = '/404.html';

  const requestedPath = path.resolve(dist, `.${relative}`);
  const insideDist = requestedPath.startsWith(`${dist}${path.sep}`);
  const available =
    insideDist && existsSync(requestedPath) && statSync(requestedPath).isFile();
  const filePath = available ? requestedPath : path.join(dist, '404.html');
  response.statusCode = available ? 200 : 404;
  response.setHeader(
    'content-type',
    contentTypes.get(path.extname(filePath)) ?? 'application/octet-stream',
  );
  createReadStream(filePath).pipe(response);
}).listen(port, '127.0.0.1');
