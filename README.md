#wf-mysql-ddd


## 使用方法

### 安装wf-mysql-ddd 模块

```
#npm install wf-mysql-ddd
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


### 从前段调用musql服务

get http://{userhost}/api/{service_name}
post http://{userhost}/api/{service_name}

### 从后端调动mysql服务

ddd.exec("{servic_ename}"",callback)













