'use strict';
var debug = require('debug');
var express = require('express');
var path = require('path');
//var favicon = require('serve-favicon');
//var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var app = express();
const query = require('./mysqlquery');

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// uncomment after placing your favicon in /public
//app.use(favicon(__dirname + '/public/favicon.ico'));
//app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));


var index = require('./routes/index');
app.use('/', index);

var ddd = require('./wf-mysql-ddd');
var config = require('./config');
ddd.conn = config.mysql;
ddd.redis = config.redis;
app.use('/api', ddd.Router);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers

// development error handler
// will print stacktrace
// if (app.get('env') === 'development') {
//     app.use(function(err, req, res, next) {
//         res.status(err.status || 500);
//         res.render('error', {
//             message: err.message,
//             error: err
//         });
//     });
// }

// // production error handler
// // no stacktraces leaked to user
// app.use(function(err, req, res, next) {
//     res.status(err.status || 500);
//     res.render('error', {
//         message: err.message,
//         error: {}
//     });
// });

// app.set('port', process.env.PORT || 80);

// var server = app.listen(app.get('port'), function() {
//     debug('Express server listening on port ' + server.address().port);
//     console.log('Express server listening on port ' + server.address().port);
// });
// 测试缓存 cache
let userData = {
    userid: 123,
    unionid: "465413213",
    name: "zhangsan",
    group: "wanfang"
}
ddd.set_token(userData, "123456789");

// 第一次读取,from redis 并载入cache
ddd.token_resolve("123456789", function(err, data) {
    console.log(err);
    console.log(data);
});


// 第二次读取 from cache 
ddd.token_resolve("123456789", function(err, data) {
    console.log(err);
    console.log(data);
});

setTimeout(() => {
    // 第三次读取 from reids  cache exprie???? 
    ddd.token_resolve("123456789", function(err, data) {
        console.log(err);
        console.log(data);
    });
}, 2000);






//  数据库同步操作测试
// let orderId = null;
// let jdata = {
//     doctype: "充值单",
//     user: "",
//     memo: "orderData.memo",
//     account: {
//         receivable: 12.03
//     }
// };
// var p = {
//     sp: "ddd_order_append",
//     token: "sdfasdfalkjaksdjf",
//     jdata: jdata,
//     // callback: function(code, result) {
//     //     console.log(code);
//     //     console.log(result);
//     //     var ss = code;
//     //     var res = result;
//     //     orderId = result.caseid
//     // }
// };
// var result = null;

// try {
//     result = ddd.exec_sync(p);
//     console.log(result);
//     result.then(res => {
//             console.log(res);
//             console.log(res.casid);
//             orderId = res.caseid;
//         })
//         //orderId = result.casid;
//         // ddd.exec_sync(p).then(res => {
//         //     console.log(res);

//     // })
//     console.log(orderId);

// } catch (error) {
//     console.log(error);
// }

console.log("end");