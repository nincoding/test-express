const jwt = require('jsonwebtoken');
const User = require("../models/user");

exports.signup = async (req, res, next) => {
  try {
    const { email, password, name } = req.body;

    const user = {
      email: email,
      password: password,
      name: name
    };

    if (User.some((user) => user.email === email)) {
      return res.status(409).send({
        message: 'This email is already registered'
      });
    }

    const token = jwt.sign(user, 'secretkey');

    User.push({
      ...user,
      token: token
    });

    console.log(User);

    return res.status(200).send({
      accessToken: token
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = User.find((item) => item.email === email && item.password === password);

    const now = new Date();

    console.log(user);

    if (user) {

      const token = jwt.sign({ email: user.email }, 'secretkey');

      return res.status(200).send({
        accessToken: token,
        expiredTimestamp: now.getTime() + 24*60*60*1000 // 유통기한은 1시간 로 유통기한 갱신
      });
    } else {
      console.log('이메일 또는 비밀번호가 일치하지 않습니다.');
      return res.status(401).send({
        message: "authorization failed!"
      });
    };

  } catch (err) {
    // 서버 에러일 경우 다음 미들웨어로 전달
    console.log(err);
    next(err);
  }
};
/*
exports.getProfile = async (req, res, next) => {
  try {

    const token = req.headers['authorization'];

    console.log(token)

    if (token === "Bearer asdasdasdasdasdadadsadssd") {
      return res.status(200).send({
        email: "kimcoding@gmail.com",
        name: "김코딩"
      });
    }

    return res.status(401).send({
      message: "authorization failed!"
    });
  } catch (err) {
    // 서버 에러일 경우 다음 미들웨어로 전달
    console.log(err);
    next(err);
  }
};
*/
exports.getProfile = async (req, res, next) => {
  try {

    const token = req.headers['authorization'];

    if (token.startsWith('Bearer ')) {
      // JWT에서 실제 토큰 값만 추출
      const tokenValue = token.slice(7);

      jwt.verify(tokenValue, 'secretkey', (err, decoded) => {
        if (err) {
          return res.status(401).send({
            message: "authorization failed!"
          });
        } else {
          const user = User.find((item) => item.email === decoded.email);

          if (user) {
            return res.status(200).send({
              email: user.email,
              name: user.name
            });
          } else {
            return res.status(404).send({
              message: "user not found"
            });
          }
        }
      });
    } else {
      return res.status(401).send({
        message: "authorization failed!"
      });
    }
  } catch (err) {
    // 서버 에러일 경우 다음 미들웨어로 전달
    console.log(err);
    next(err);
  }
};