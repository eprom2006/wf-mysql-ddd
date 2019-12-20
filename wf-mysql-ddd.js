var express = require('express');
var api = express.Router();
const mysql = require("mysql");
const redis = require('redis');

var ddd = {
    Router: api,
    conn: {},
    redis: {},

    /**
     * 执行ddd存储过程
     * @param {*} p 
     */
    exec: function(p) {
        let cmd = 'select ?,? into @token,@jdata;call ddd_' + p.sp + '(@token,@jdata);select @jdata as jdata;';
        p.conn.multipleStatements = true;
        let conn = mysql.createConnection(p.conn);

        conn.connect();
        if (p.token) {
            //console.log(p);
            var client = redis.createClient(ddd.redis);
            client.on("error", function(err) {
                console.log("Error " + err);
            });
            client.get("token." + p.token, function(err, data) {
                console.log({
                    err: err,
                    data: data
                });
                if (!err && data) {
                    do_query(data, JSON.stringify(p.data));
                } else {
                    p.callback({
                        err_code: 403,
                        err_message: "token无效"
                    });
                }
            });

        } else {
            do_query("{}", JSON.stringify(p.data));
        }

        conn.on("error", err => {
            console.log(err);
            conn.end();
        });
        conn.end();

        function do_query(token, jdata) {
            let conn = mysql.createConnection(p.conn);
            conn.connect();
            // console.log({
            //     token: token,
            //     jdata: jdata
            // });
            conn.query(cmd, [token, jdata], function(err, result, fields) {
                if (!err) {
                    if (result[2][0].jdata !== undefined) {
                        var r = JSON.parse(result[2][0].jdata);
                        p.callback(r);
                    } else {
                        p.callback({
                            err_code: 404,
                            err_message: "no result"
                        });
                    }

                } else {
                    p.callback({
                        err_code: err.errno,
                        sqlState: err.sqlState,
                        err_message: err.sqlMessage
                    });
                }
            });
            conn.on("error", err => {
                console.log(err);
                conn.end();
            });
            conn.end();
        }
    },
    /**
     * 列出所有ddd存储过程
     * @param {*} p 
     */
    list: function(p) {
        let cmd = 'call api_list;';
        let conn = mysql.createConnection(p.conn);
        console.log(p.conn);
        conn.connect();
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
        });
        conn.end();
    }
};


api.get('/', function(req, res) {
    ddd.list({
        conn: ddd.conn,
        callback: function(r) {
            console.log(r);
            res.render('apies', r.result);
        }
    });
});


api.get('/:sp', function(req, res) {
    console.log(req.cookies["token"]);
    ddd.exec({
        conn: ddd.conn,
        sp: req.params.sp,
        token: req.cookies["token"],
        data: req.query,
        callback: function(r) {
            res.send(r);
        },
    });
}).post('/:sp', function(req, res) {
    console.log(req.body);
    ddd.exec({
        conn: ddd.conn,
        sp: req.params.sp,
        token: req.cookies["token"],
        data: req.body.data,
        callback: function(r) {
            res.set('content-type', 'application/json');
            res.send(r);
        },
    });
});



module.exports = ddd;