const http = require('http');
const fs = require('fs');
const path = require('path');
const root = process.cwd();
const mime = {
  '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.gif':'image/gif'
};
const server = http.createServer((req,res)=>{
  let reqPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (reqPath === '/') reqPath = '/index.html';
  const abs = path.join(root, reqPath.replace(/^\/+/, ''));
  fs.stat(abs,(err,st)=>{
    if (!err && st.isFile()) {
      res.writeHead(200, {'Content-Type': mime[path.extname(abs).toLowerCase()] || 'application/octet-stream'});
      fs.createReadStream(abs).pipe(res);
      return;
    }
    res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'});
    res.end('Not Found');
  });
});
server.listen(5500, ()=> console.log('Static server listening on http://127.0.0.1:5500'));
