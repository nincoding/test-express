const { flushRedis, getListRedis, resetRedis, getLengthRedis } = require('../utils/redis');
const { pushToLegacyLogServer } = require('../utils/mango2');
const { preprocessLogs } = require('../utils/preprocess-log');
const { pushToES } = require('../utils/elasticsearch');
const { pushAPPCMSAppLogs, pushCommonLogs } = require('../service/log');
const redisKey = require('../constant/redis');

exports.getLogs = async (req, res, next) => {
  try {
    const { key } = req.query
    let result = await getListRedis(key);

    return res.status(200).send(result);
  } catch (err) {
    // 서버 에러일 경우 다음 미들웨어로 전달
    console.log(err);
    next(err);
  }
};

exports.deleteLogs = async (req, res, next) => {
  try {
    const { key } = req.query
    await resetRedis(key);

    return res.status(200).send("deleted!");
  } catch (err) {
    // 서버 에러일 경우 다음 미들웨어로 전달
    console.log(err);
    next(err);
  }
};

exports.getRedisLength = async (req, res, next) => {
  try {
    const { key } = req.query
    let result = await getLengthRedis(key);

    return res.status(200).send(JSON.stringify(result));
  } catch (err) {
    // 서버 에러일 경우 다음 미들웨어로 전달
    console.log(err);
    next(err);
  }
};

exports.flushLogs = async (req, res, next) => {
  try {
    let result = await flushRedis(redisKey.LOGS_KEY_MANGO2, process.env.FLUSH_LOGS_PER_TASK);
    let logs = result[0][1];

    if (Array.isArray(logs) && logs.length === 0) {
      return res.status(200).send("OK : no logs in redis");
    }

    logs = logs.map(log => JSON.parse(log));
    const rawLog = logs;

    await pushToLegacyLogServer(rawLog);

    console.log(`[INFO] flush mango2 logs success! ${rawLog.length}`)

    return res.status(200).send(`[INFO] flush mango2 logs success! ${rawLog.length}`);
  } catch (err) {
    console.log(`[ERROR] flush mango2 logs failed!`)
    console.log(err);
    next(err);
  }
};

exports.flushBBSWLogs = async (req, res, next) => {
  try {
    let result = await flushRedis(redisKey.LOGS_KEY_BBSW, process.env.FLUSH_LOGS_PER_TASK);
    let logs = result[0][1];

    if (Array.isArray(logs) && logs.length === 0) {
      return res.status(200).send("OK : no logs in redis");
    }

    logs = logs.map(log => JSON.parse(log));
    const rawLog = logs;
    const processedLog = preprocessLogs(logs, 'ES');

    await pushToES(processedLog);

    console.log(`[INFO] flush bbsw logs success! ${rawLog.length}`)

    return res.status(200).send(`[INFO] flush bbsw logs success! ${rawLog.length}`);
  } catch (err) {
    console.log(`[ERROR] flush bbsw logs failed!`)
    console.log(err);
    next(err);
  }
};

// APPCMS 에서 트래킹 하지 않는 로그 대상
exports.pushLogs = async (req, res, next) => {
  try {
    let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    if (!!ip && ip.split(',').length > 1) {
      ip = ip.split(',')[0];
    }

    let { logger, logs } = req.body;

    if (!logger) {
      console.log('[ERROR] 400 pushLogs failed : logger is required');
      return res.status(400).send("logger is required");
    } else {
      logger = process.env.LOGGER_ENV === 'test' ? 'test_' + logger : logger; 
    }

    if (!logs) {
      console.log('[ERROR] 400 pushLogs failed : logs is required');
      return res.status(400).send("logs is required");
    }

    try {
      logs = JSON.parse(logs);
    } catch (err) {}
    
    if (!Array.isArray(logs)) {
      logs = [logs];
    }

    await pushCommonLogs(ip, logger, logs);

    return res.status(200).send("OK!");
  } catch (err) {
    console.log('[ERROR] 500 pushLogs failed : internal server error');
    // 서버 에러일 경우 다음 미들웨어로 전달
    next(err);
  }
};


// APPCMS에서 트래킹 하는 앱 로그 대상
exports.pushLogsFromSSApp = async (req, res, next) => {
  try {
    let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    if (!!ip && ip.split(',').length > 1) {
      ip = ip.split(',')[0];
    }

    let { data } = req.body;

    if (process.env.LOGGER_ENV === 'test') {
      console.log(`[INFO] 로그 받음! data: ${data || '없음'}` );
    }

    if (!data) {
      console.log('[ERROR] 400 pushLogsFromSSApp failed : data is required');
      return res.status(400).send("data is required");
    }

    try {
      data = JSON.parse(data);
    } catch (err) {
      console.log('[ERROR] 400 pushLogsFromSSApp failed : data parse error');
      return res.status(400).send("data parse error");
    }

    await pushAPPCMSAppLogs(ip, data);

    return res.status(200).send("OK!");
  } catch (err) {
    // 서버 에러일 경우 다음 미들웨어로 전달
    console.log('[ERROR] 500 pushLogsFromSSApp failed : internal server error');
    next(err);
  }
};


// APPCMS에서 트래킹 하는 앱인지 아닌지 모르는 경우
exports.pushLogsFromUnknown = async (req, res, next) => {
  try {
    let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    if (!!ip && ip.split(',').length > 1) {
      ip = ip.split(',')[0];
    }

    if ('data' in req.body || 'data' in req.query) {
      let { data } = req.body;
      if (!data) data = req.query.data;

      if (process.env.LOGGER_ENV === 'test') {
        console.log(`[INFO] 로그 받음! data: ${data || '없음'}` );
      }
  
      if (!data) {
        console.log('[ERROR] 400 pushLogsFromUnknown failed : data is required');
        return res.status(400).send("data is required");
      }
  
      try {
        data = JSON.parse(data);
      } catch (err) {
        console.log('[ERROR] 400 pushLogsFromUnknown failed : data parse error');
        return res.status(400).send("data parse error");
      }
  
      await pushAPPCMSAppLogs(ip, data);
      return res.status(200).send("OK!");
    } 

    if ('logger' in req.body) {
      let { logger, logs } = req.body;

      if (!logger) {
        console.log('[ERROR] 400 pushLogsFromUnknown failed : logger is required');
        console.log(JSON.stringify(req.body))
        return res.status(400).send("logger is required");
      } else {
        logger = process.env.LOGGER_ENV === 'test' ? 'test_' + logger : logger; 
      }

      if (!logs) {
        console.log('[ERROR] 400 pushLogsFromUnknown failed : logs is required');
        return res.status(400).send("logs is required");
      }

      try {
        logs = JSON.parse(logs);
      } catch (err) {}
      
      if (!Array.isArray(logs)) {
        logs = [logs];
      }

      await pushCommonLogs(ip, logger, logs);
      return res.status(200).send("OK!");
    }

    console.log('[ERROR] 400 pushLogsFromUnknown failed : logger or data is required');
    return res.status(400).send("logger or data is required");
  } catch (err) {
    // 서버 에러일 경우 다음 미들웨어로 전달
    console.log('[ERROR] 로그 받는 과정에서 에러 발생 - pushLogsFromUnknown');
    next(err);
  }
};
