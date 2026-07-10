import fs from 'node:fs';
import type http from 'node:http';
import path from 'node:path';
import mime from 'mime-types';

export function createStaticHandler(distRoot: string) {
  const indexPath = path.join(distRoot, 'index.html');
  const spacegraphIndexPath = path.join(distRoot, 'spacegraph', 'index.html');

  return (req: http.IncomingMessage, res: http.ServerResponse): Promise<void> => {
    const pathname = new URL(req.url ?? '/', `http://${req.headers.host}`).pathname;

    // SpaceGraph experimental entry
    if (pathname === '/spacegraph' || pathname === '/spacegraph/')
      return sendFile(res, spacegraphIndexPath);
    if (pathname.startsWith('/spacegraph/')) {
      const fullPath = path.join(distRoot, pathname.slice(1));
      return fs.promises
        .access(fullPath, fs.constants.F_OK)
        .then(() => sendFile(res, fullPath))
        .catch(() => sendFile(res, spacegraphIndexPath));
    }

    // Main Cytoscape entry
    if (pathname === '/' || pathname === '/index.html') return sendFile(res, indexPath);
    const fullPath = path.join(distRoot, pathname.slice(1));
    return fs.promises
      .access(fullPath, fs.constants.F_OK)
      .then(() => sendFile(res, fullPath))
      .catch(() => sendFile(res, indexPath));
  };
}

function sendFile(res: http.ServerResponse, filePath: string): Promise<void> {
  return fs.promises
    .readFile(filePath)
    .then(
      (data) => {
        const contentType = mime.lookup(filePath) || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
      },
      () => {
        res.writeHead(404);
        res.end('Not found');
      }
    )
    .then(() => {});
}
