#wf-mysql-ddd


## 使用方法

### 安装wf-mysql-ddd 模块

#### 从npmjs安装
```
```shell
#npm install wf-mysql-ddd
```

#### 从gitlab.wf.pub安装最新版本
```shell
npm install git+http://39.98.239.3/liwei/wf-mysql-ddd
```

### 配置文件config.js
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


### 在app.js添加wf-mysql-ddd的引用配置和路由

``` javascript

var ddd = require('wf-mysql-ddd');
var config=require('.\config');
ddd.conn=config.mysql;
ddd.redis=config.redis;
app.use('/api',ddd.Router);

```

### 测试api访问

http://xxx/api


### 登录cookie

wf-mysql-ddd使用名为token的cookie标识用户身份，你的登录系统在登录后应设置此cookie并将用户身份信息以token_{token_value}为key写入redis，www_mysql_ddd会使用此键解析用户身份信息。

### 使用wf_mysql_ddd发布服务

在mysql数据库中建立名为ddd_{service_name}的存储过程，此存储过程接受两个参数：

1. token json
2. inout jdata json


### 从前端调用mysql服务

* get http://{userhost}/api/{service_name}
* post http://{userhost}/api/{service_name}

### 从后端调用mysql服务
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

### 注意事项：

前缀带ddd_的存储过程可以从前端调用，不允许外部调用不应该有ddd前缀，从服务器端可以直接用存储过程名调用不对外开放的的ddd存储过程。


