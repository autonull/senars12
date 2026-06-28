import fs from 'fs';
import http from 'http';
import mime from 'mime-types';
import path from 'path';

const NOT_FOUND = 404;
const OK = 200;

export function createStaticHandler(distRoot: string) {
  const indexPath = path.join(distRoot, 'index.html');

  return async function handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const pathname = new URL(req.url ?? '/', `http://${req.headers.host}`).pathname;

    if (pathname === '/' || pathname === '/index.html') return sendFile(res, indexPath);
    return serveSpa(req, res, pathname, distRoot);
  };
}

function serveSpa(req: http.IncomingMessage, res: http.ServerResponse, pathname: string, distRoot: string): Promise<void> {
  const fullPath = path.join(distRoot, pathname.slice(1));
  return new Promise<void>((resolve) => {
    fs.access(fullPath, fs.constants.F_OK, (err) => {
      sendFile(res, err ? path.join(distRoot, 'index.html') : fullPath).finally(resolve);
    });
  });
}

function sendFile(res: http.ServerResponse, filePath: string): Promise<void> {
  return new Promise<void>((resolve) => {
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(NOT_FOUND);
        res.end('Not found');
      } else {
        const contentType = mime.lookup(filePath) || 'application/octet-stream';
        res.writeHead(OK, { 'Content-Type': contentType });
        res.end(data);
      }
      resolve();
    });
  });
}


