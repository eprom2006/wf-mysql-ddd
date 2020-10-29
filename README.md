# wf-mysql-ddd


## 安装wf-mysql-ddd 模块

### 从gitlab.wf.pub安装最新版本
```shell
npm install git+http://gitlab.wf.pub/liwei/wf-mysql-ddd
```

## 配置文件config.js
``` javascript

module.exports={
    mysql: {
        host: "xxx.xxx.xxx.xxx",
        database: "xxx",
        user: "root",
        password: "xxxx",
        port: '3306'
    },
    redis: {
        host: "xxx.xxx.xxx.xxx",
        port: "6379",
        password: "xxx"
    },
}

```


## 在app.js添加wf-mysql-ddd的引用配置和路由

``` javascript

var ddd = require('wf-mysql-ddd');
var config=require('.\config');
ddd.conn=config.mysql;
ddd.redis=config.redis;
app.use('/api',ddd.Router);

```

## 测试api访问

http://xxx/api


## 登录cookie

wf-mysql-ddd使用名为token的cookie标识用户身份，你的登录系统在登录后应设置此cookie并将用户身份信息以token:{token_value}为key写入redis，www_mysql_ddd会使用此键解析用户身份信息。

## 使用wf_mysql_ddd发布服务

在mysql数据库中建立名为ddd_{service_name}的存储过程，此存储过程接受两个参数：

1. token json
2. inout jdata json


## 从前端调用mysql服务

* get http://{userhost}/api/{service_name}
* post http://{userhost}/api/{service_name}

## 从后端调用mysql服务

### exec
```javascript
ddd.exec({
    sp:ddd_{service_name},
    token: req.cookies["token"],
    data: req.query,
    callback: function(err, r) {
        //sample callback begin
        if (err) {
            res.status(err);
            res.send(r);
        } else {
            res.set('content-type', 'application/json');
            res.send(r);
        }
        //sample callback end
    },
});
```
### execPromise
```javascript
ddd.execPromise({
    sp:'ddd_stored_procedure_name',
    data:{yourdata:''}
    }).then(data => {
        console.log(data)
    }).catch(error => {
        console.log(error)
    });
```

### set_token
```javascript
ddd.set_token(userdata,token);

```
### set_expire
```javascript
ddd.set_expire(token,timeoutseconds);

```

### delete_token
```javascript
ddd.delete_token(token);
```
### whois

###



### 注意事项：

前缀带ddd_的存储过程可以从前端调用，不允许外部调用不应该有ddd前缀，从服务器端可以直接用存储过程名调用不对外开放的的ddd存储过程。

## 工作原理
```mermaid
sequenceDiagram
autonumber
    opt login stage
    page->>ddd:set_token(userinfo,token)
    ddd->>redis:save userinfo with token as key
    page->>ddd:set_expire(token)
    ddd->>redis:set expire time
    end

    page->>ddd:exec({sp,data,token,callback})
    ddd->>redis:resolve_token
    redis->>ddd:return userinfo
    ddd->>mysql:query(userinfo,jdata)
    mysql->>ddd:return jdata
    ddd->>page:callback(error,data)

    opt logout stage
    page->>ddd:delete_token(token);
    ddd->>redis:delete userinfo in redis
    end
```

