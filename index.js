const express = require('express');
const routers = require('./routes/index.js');
const app = express();
const cors = require('cors');

let corsOptions = {
  origin: ['https://tenten-stackoverflow-clone.web.app', 'http://localhost:3000'],
  credentials: true
}
app.use(cors(corsOptions));

// parse application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// parse application/json
app.use(express.json({ limit: '50mb' }));

app.use('/', routers);
app.use('/_health.txt', (req, res, next) => {
  res.status(200).json({
    status: 200,
    message: 'express is running',
  });
});

app.use((req, res, next) => {
  console.log("404");
  res.status(404).json({
    status: 404,
    message: 'Not found 1',
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack); //err.stack 은 파일 히스토리를 포함한 에러 메시지
  res.status(500).json({
    status: 500,
    message: 'Internal server error.',
  });
});

const server = app.listen(8000, '0.0.0.0', () => {
  console.log(
    `Example app listening on port 8000!`
  );
});

// Disable both timeouts
server.keepAliveTimeout = 0;
server.headersTimeout = 0;