var express = require('express');
var api = express.Router();
const mysql = require("mysql");
const redis = require('redis');

var ddd = {
    Router: api,
    conn: null,
    redis: null,
    auth_token: "token",
    token_prefix: "token.",

    /**
     * 执行ddd存储过程
     * @param {*} p 
     */
    exec: function(p) {
        //检查连接池是否已经创建，如果没有则创建之。
        if (!global.ddd_mysql_pool) {
            ddd.conn.multipleStatements = true;
            global.ddd_mysql_pool = mysql.createPool(ddd.conn);
        };
        //检查redis client是否创建
        if (!global.ddd_redis_client) {
            global.ddd_redis_client = redis.createClient(ddd.redis);
            global.ddd_redis_client.on("connect", (e) => { console.log({ pos: "redis connected!"}); });
            global.ddd_redis_client.on("error", (e) => { console.log({ pos: "ddd redis on error", e: e }) });
            global.ddd_redis_client.on("reconnecting", (e) => { console.log({ pos: "ddd redis reconnecting...", e: e }) });
        };

        if (!p.token) {
            do_query("{}", JSON.stringify(p.data));
        } else if (typeof(p.token) === "string") {
            ddd.token_resolve(p.token, (err, jtoken) => {
                if (!err && jtoken) {
                    do_query(jtoken, JSON.stringify(p.data));
                } else {
                    p.callback(403, {
                        err_code: 4,
                        err_message: "token无效"
                    });
                }

            });
        } else {
            do_query(JSON.stringify(p.token), JSON.stringify(p.data));
        }

        function do_query(token, jdata) {
            console.log({ pos: "do_query", token: token, jdata: jdata });
            let cmd = 'select ?,? into @token,@jdata;call ' + p.sp + '(@token,@jdata);select @jdata as jdata;';
            global.ddd_mysql_pool.query(cmd, [token, jdata], function(err, result, fields) {
                if (!err) {
                    let last = result.length - 1;
                    if (result[last][0].jdata !== undefined) {
                        var r = JSON.parse(result[last][0].jdata);
                        p.callback(null, r);
                    } else {
                        p.callback(404, {
                            err_code: 6,
                            err_message: "no result"
                        });
                    }
                } else {
                    p.callback(
                        500, {
                            err_code: err.errno,
                            sqlState: err.sqlState,
                            err_message: err.sqlMessage
                        });
                }
            });
        }
    },

    token_resolve: function(strtoken, callback) {
        global.ddd_redis_client.get("token." + strtoken, function(err, jtoken) {
            if (!err && jtoken) {
                global.ddd_redis_client.expire("token." + strtoken, 1200); //如果有访问，则自动延长token过期时间20分钟。
            }
            callback(err, jtoken);
        });
    },

    /**
     * 列出所有ddd存储过程
     * @param {*} p 
     */
    list: function(p) {
        //检查连接池是否已经创建，如果没有则创建之。
        if (!global.ddd_mysql_pool) {
            p.conn.multipleStatements = true;
            global.ddd_mysql_pool = mysql.createPool(ddd.conn);
        };
        global.ddd_mysql_pool.query(cmd, function(err, result, fields) {
            if (!err) {
                if (result[0][0].jdata) {
                    var r = JSON.parse(result[0][0].jdata);
                    p.callback({ result: r });
                } else if (typeof(p.error) === 'function') {
                    p.callback({});
                }
            } else {
                p.callback({
                    errno: err.errno,
                    sqlState: err.sqlState,
                    sqlMessage: err.sqlMessage
                });
            }
        });
    }
};


api.get('/', function(req, res) {
    res.send("wf-mysql-ddd");
    // ddd.list({
    //     //conn: ddd.conn,
    //     callback: function(r) {
    //         console.log(r);
    //         //res.render('apies', r.result);
    //         res.send(r.result);
    //     }
    // });
});


api.get('/:sp', function(req, res, next) {
    //console.log(req.cookies["token"]);
    ddd.exec({
        sp: "ddd_" + req.params.sp,
        token: req.cookies["token"],
        data: req.query,
        callback: function(err, r) {
            if (err) {
                res.status(err);
                res.send(r);
            } else {
                res.set('content-type', 'application/json');
                res.send(r);
            }
        },
    });
}).post('/:sp', function(req, res, next) {
    ddd.exec({
        sp: "ddd_" + req.params.sp,
        token: req.cookies["token"],
        data: req.body,
        callback: function(err, r) {
            if (err) {
                console.log({
                    err: err,
                    r: r
                })
                res.set('content-type', 'application/json');
                res.status(err);
                res.send(JSON.stringify(r));
            } else {
                res.set('content-type', 'application/json');
                res.send(r);
            }
        },
    });
});

module.exports = ddd;