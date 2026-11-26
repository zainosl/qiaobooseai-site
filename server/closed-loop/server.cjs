'use strict';

const {createServer} = require('node:http');
const submit = require('./api/submit-closed-loop.js');

const keys = ['FEISHU_APP_ID','FEISHU_APP_SECRET','FEISHU_BITABLE_APP_TOKEN'];
if (keys.some(key => !process.env[key])) {
  throw new Error('Missing closed-loop Feishu configuration');
}

const server = createServer(async (req,res) => {
  if (req.url !== '/api/submit-closed-loop') {
    res.writeHead(404).end();
    return;
  }
  try {
    await submit(req,res);
  } catch {
    if (!res.headersSent) res.writeHead(500,{'Content-Type':'application/json'});
    res.end('{"ok":false}');
  }
});
server.listen(8791,'127.0.0.1');
