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



