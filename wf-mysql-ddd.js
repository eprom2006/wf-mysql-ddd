var express = require('express');
var api = express.Router();
const mysql = require("mysql");
const redis = require('redis');
const axios = require('axios');
const md5 = require('md5');
const url = require('url');
const qs = require('querystring');

function tokencookie() {
    return (global.logincookie || '') + 'token';
}
// 确认redis连接是否建立，没有则创建。
function verify_redis_conn() {
    //检查redis client是否创建
    if (!global.ddd_redis_client) {
        global.ddd_redis_client = redis.createClient(ddd.redis);
        global.ddd_redis_client.on("connect", (e) => { console.log({ pos: "redis connected!" }); });
        global.ddd_redis_client.on("error", (e) => { console.log({ pos: "ddd redis on error", e: e }) });
        global.ddd_redis_client.on("reconnecting", (e) => { console.log({ pos: "ddd redis reconnecting...", e: e }) });
    }
    return global.ddd_redis_client;
}
// 数据同步查询
async function do_quey_sync(p) {
    return await new Promise((resolve, reject) => {
        global.ddd_mysql_pool.query(p.cmd, [p.token, JSON.stringify(p.data)], (err, result) => {
            if (err) {
                reject(err)
            } else {
                let last = result.length - 1;
                if (result[last][0].jdata !== undefined) {
                    resolve(JSON.parse(result[last][0].jdata));
                } else {
                    reject({
                        err_code: 6,
                        err_message: "no result"
                    })
                }
            }
        })
    });
}

var ddd = {
    Router: api,
    api: api,
    conn: null,
    redis: null,
    apierr:null,


    /**
     * 执行ddd存储过程
     * @param {*} p
     */
    exec: function(p) {
        ddd.token_resolve(p.token, (err, jtoken) => {
            if (!err && jtoken) {
                do_query(jtoken, p.data || {});
            } else {
                p.callback(403, {
                    err_code: 4,
                    err_message: "token无效"
                });
            }
        });


        function do_query(token, jdata) {
            //检查连接池是否已经创建，如果没有则创建之。
            if (!global.ddd_mysql_pool) {
                ddd.conn.multipleStatements = true;
                global.ddd_mysql_pool = mysql.createPool(ddd.conn);
            }
            // console.log({ pos: "do_query", token: token, jdata: jdata });
            let cmd = 'select ?,? into @token,@jdata;call ' + p.sp + '(@token,@jdata);select @jdata as jdata;';
            global.ddd_mysql_pool.query(cmd, [token, JSON.stringify(jdata)], function(err, result, fields) {
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
                    //console.log({err,result,fields});
                    p.callback(
                        500, {
                            err_code: err.errno,
                            dddState: err.sqlState,
                            err_message: err.sqlMessage,
                            sql_err: err
                        });
                }
            });
        }
    },

    execPromise: function(p) {
        return new Promise((resolve, reject) => {
            ddd.exec({
                sp: p.sp,
                data: p.data || {},
                token: p.token,
                callback: function(error, data) {
                    // console.log({ error, data });
                    if (error) reject({ error, data })
                    else resolve(data)
                }
            });
        })
    },

    exec_sync: async function(p) {
        return await new Promise((resolve, reject) => {
            ddd.whois(p.token)
                .then(res => {
                    p.token = res;
                    if (!global.ddd_mysql_pool) {
                        ddd.conn.multipleStatements = true;
                        global.ddd_mysql_pool = mysql.createPool(ddd.conn);
                    }
                    // console.log("p.token" + p.token);
                    p.cmd = 'select ?,? into @token,@jdata;call ' + p.sp + '(@token,@jdata);select @jdata as jdata;';

                    resolve(do_quey_sync(p));
                })
                .catch(err => {
                    reject(err);
                })
        });
    },

    set_token: function(userdata, token) {
        if (!token) {
            userdata.tokencreatetime = new Date();
            token = md5(JSON.stringify(userdata));
        }
        var redis_conn = verify_redis_conn();
        let key = "token:" + token;
        redis_conn.set(key, JSON.stringify(userdata));
        redis_conn.expire(key, 30); //默认仅设置30秒有效期，需要重新设置过期时间。
        return token;
    },

    set_expire: function(strtoken, exprieinseconds) {
        var redis_conn = verify_redis_conn();
        let key = 'token:' + strtoken;
        redis_conn.expire(key, exprieinseconds);
    },

    delete_token: function(strtoken) {
        var redis_conn = verify_redis_conn();
        redis_conn.del("token:" + strtoken);
    },

    whois: async function(strtoken) {
        return await new Promise((resolve, reject) => {
            ddd.token_resolve(strtoken, (err, jtoken) => {
                resolve(jtoken)
            })
        });
    },

    token_resolve: function(token, callback) {
        if (!token) {
            callback(null, "{}");
            return;
        }
        if (typeof(token) !== "string") {
            callback(null, JSON.stringify(token));
            return;
        }

        if (!global.ddd_node_cache) {
            //如果全局ddd_node_cache未初始化，则初始化之。
            const cache = require('node-cache');
            global.ddd_node_cache = new cache({
                stdTTL: 30, //标准ttl=30秒。
                checkperiod: 120, //每120秒删除一次过期键值。
            });
        }
        // 获取cache中的token 存在就返回
        cache_jtoken = global.ddd_node_cache.get("token:" + token);
        if (!!cache_jtoken) {
            callback(null, cache_jtoken);
            return;
        }

        //检查redis client是否创建。
        var redis_conn = verify_redis_conn();

        redis_conn.get("token:" + token, function(err, jtoken) {
            global.ddd_node_cache.set("token:" + token, jtoken);
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
                    dddState: err.sqlState,
                    sqlMessage: err.sqlMessage
                });
            }
        });
    },

    login: function(appconfig, logincallback) {
        if (appconfig.logincookie) global.logincookie = appconfig.logincookie;
        let router = require('express').Router();

        router.get('/login', (req, res) => {
            let orgin_url = req.query.return_url || req.headers.referer || '/';
            let redirect_uri = appconfig.app_url + '/logincallback?return_url=' + encodeURIComponent(orgin_url);
            res.redirect(`https://wf.pub/oauth/authorize?client_id=${appconfig.client_id}&redirect_uri=${redirect_uri}&response_type=code`)
        });

        router.get('/logincallback', (req, res) => {
            let result = {};
            let oauthURL=appconfig.oauthURL?appconfig.oauthURL:'https://wf.pub';
            // code换token
            axios.post(oauthURL+'/oauth/token', 
                qs.stringify({
                    grant_type: 'authorization_code',
                    client_id: appconfig.client_id,
                    code: req.query.code
                })
            ).then(response => {
                result.token = response.data;
                //用token取用户信息
                return axios.get(oauthURL+'/oauth/api/userinfo', {
                    params: {
                        token: result.token.access_token
                    }
                });
            }).then(response => {
                result.userinfo = response.data;
                // 用户信息进redis
                let token = ddd.set_token(result.userinfo);
                // 设置登录cookie
                    res.cookie(tokencookie(), token, {
                        maxAge: 24 * 3600 * 1000, //过期时间1天
                        // domain: u.hostname,
                        // path: u.path,
                        sameSite: 'None',
                        secure: true
                    });
                ddd.set_expire(token, 24 * 3600) //过期时间1天

                if (logincallback) {
                    logincallback(result, req, res);
                    //res.redirect(req.query.return_url);
                } else { res.redirect(req.query.return_url); }
            }).catch(error => {
                console.log(error);
                res.json(error);
            });
        });

        router.get('/logout', (req, res) => {
            ddd.delete_token(req.cookies[tokencookie()]);
            res.clearCookie(tokencookie());
            let orgin_url = req.query.return_url || req.headers.referer || '/';
            res.redirect(orgin_url);
            // let redirect_uri = appconfig.app_url + '/logoutcallback?return_url=' + encodeURIComponent(orgin_url);
            // res.redirect(`https://oauth.wf.pub/logout?redirect_uri=${redirect_uri}`)
        });
        router.get('/logoutcallback', (req, res) => {
            res.redirect(req.query.return_url);
        });

        router.all('*', async(req, res, next) => {
            let token = req.cookies[tokencookie()];
            if (token) {
                res.locals.user = JSON.parse(await ddd.whois(token));
            }
            return next();
        });

        return router;
    },

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

api.get('/logincallback', (req, res) => {
    res.send('logincallback');
})

api.get('/whoami', async(req, res) => {
    let token = await ddd.whois(req.cookies[tokencookie()]);
    res.json(JSON.parse(token));
})

api.get('/:sp', function(req, res, next) {
    //console.log(req.cookies["token"]);
    ddd.exec({
        sp: "ddd_" + req.params.sp,
        token: req.cookies[tokencookie()],
        data: req.query,
        callback: function(err, r) {
            if (err) {
            	if (!!ddd.apierr) {
                    console.log({ err: err, r: r });
                    res.render(ddd.apierr, { error: { status: "errno", message: "message" } });
                    return;
                }
                
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
        token: req.cookies[tokencookie()],
        data: req.body,
        callback: function(err, r) {
            //sample callback begin
            if (err) {
                if (!!ddd.apierr) {
                    console.log({ err: err, r: r });
                    res.render(ddd.apierr, { error: { status: "errno", message: "message" } });
                    return;
                }
                
                res.set('content-type', 'application/json');
                res.status(err);
                res.send(JSON.stringify(r));
            } else {
                res.set('content-type', 'application/json');
                res.send(r);
            }
            //sample callback end
        },
    });
});

//阻止next路由
api.all('/*', (req, res) => {
    res.status(404);
    res.send('file not found!')
})


module.exports = ddd;