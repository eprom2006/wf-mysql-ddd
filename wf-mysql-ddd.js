var express = require('express');
var api = express.Router();
const mysql = require("mysql");
const redis = require('redis');
var pool = null;
var client = null;



function createPool(options) {
    pool = mysql.createPool(options);
}

var ddd = {
    Router: api,
    conn: null,
    redis: null,

    /**
     * 执行ddd存储过程
     * @param {*} p 
     */
    exec: function(p) {
        if (!p.conn) {
            p.callback(500, {
                err_code: 1,
                err_message: "mysql connection not exists"
            });
            return;
        }
        if (!ddd.redis) {
            p.callback(500, {
                err_code: 2,
                err_message: "redis config not exists"
            });
            return;
        }
        //检查连接池是否已经创建，如果没有则创建之。
        if (!pool) {
            p.conn.multipleStatements = true;
            createPool(p.conn)
        };

        pool.getConnection(function(err, conn) {

            if (p.token) {
                //console.log(p);
                if (!client) {
                    client = redis.createClient(ddd.redis);
                    client.on("error", function(err) {
                        //console.log("Error " + err);
                        // p.callback(500, {
                        //     err_code: 3,
                        //     message: "redis error"
                        // });
                    });
                }
                //var client = redis.createClient(ddd.redis);

                client.get("token." + p.token, function(err, jtoken) {
                    if (!err && jtoken) {
                        client.expire("token." + p.token, 1200); //如果有访问，则自动延长token过期时间20分钟。
                        do_query(jtoken, JSON.stringify(p.data));
                    } else {
                        p.callback(403, {
                            err_code: 4,
                            err_message: "token无效"
                        });
                    }
                });

            } else {
                do_query("{}", JSON.stringify(p.data));
            }

            conn.on("error", err => {
                // p.callback(
                //     500, {
                //         err_code: 5,
                //         err_message: err
                //     }
                // );
                // conn.release();
            });

            function do_query(token, jdata) {
                let cmd = 'select ?,? into @token,@jdata;call ddd_' + p.sp + '(@token,@jdata);select @jdata as jdata;';
                conn.query(cmd, [token, jdata], function(err, result, fields) {
                    if (!err) {
                        let last = result.length - 1;
                        //console.log(last);
                        //console.log(result[last]);
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
                conn.release();
            }
        });
    },

    /**
     * 列出所有ddd存储过程
     * @param {*} p 
     */
    list: function(p) {

        //检查连接池是否已经创建，如果没有则创建之。
        if (!pool) {
            p.conn.multipleStatements = true;
            createPool(p.conn)
        };

        pool.getConnection(function(err, conn) {
            let cmd = 'call api_list;';
            conn.query(cmd, function(err, result, fields) {
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
            conn.on("error", err => {
                console.log(err);
                conn.end();
                p.callback(err);
            });
            conn.release();
        });
    }
};


api.get('/', function(req, res) {
    ddd.list({
        conn: ddd.conn,
        callback: function(r) {
            console.log(r);
            //res.render('apies', r.result);
            res.send(r.result);
        }
    });
});


api.get('/:sp', function(req, res, next) {
    //console.log(req.cookies["token"]);
    ddd.exec({
        conn: ddd.conn,
        sp: req.params.sp,
        token: req.cookies["token"],
        data: req.query,
        callback: function(err, r) {
            // console.log({
            //     pos: "get callback",
            //     err: err,
            //     r: r
            // });
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
    //console.log(req.body);
    ddd.exec({
        conn: ddd.conn,
        sp: req.params.sp,
        token: req.cookies["token"],
        data: req.body,
        callback: function(err, r) {
            // console.log({
            //     pos: "post callback",
            //     err: err,
            //     r: r
            // });
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