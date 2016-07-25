# 简介

* 计算引擎服务
* CES服务支持集群（Cluster）和单机（Singlton）两种模式

# 安装前准备（如果是集群模式）

* **zookeeper(>=3.4.6)**

需要预先在zookeeper中创建：/mutex, /vote, /execs 三个 PERSISTENT 类型的目录。
其中：
/execs 下的Node为（SEQUENCE | EPHEMERAL）类型，
/vote和/mutex 下的Node为（EPHEMERAL）类型。

如果是在 ./zkCli.sh 命令下，可以用如下命令创建

> create /execs ""

> create /vote ""

> create /mutex ""

* **redis(>=2.8.17)**

安装并设置开机自启动, http://www.cnblogs.com/silent2012/p/4157728.html

# 安装

> cd ces

> npm install

# 配置

* 需要自己创建 ces/log/目录（或者修改ces/appconfig/log4js-default.json中指定的路径）
* 配置文件在 ces/appconfig/ 目录下

# 运行

> node ces

或者

> ./sbin/ces.sh start

或者

> node ces -c <your app_config.json path>

如果不指定config路径，将尝试寻找ces/appconfig/app.json的配置文件
在ces/appconfig/ 下有三个配置文件，其中
app.json为默认的配置文件，默认以集群的方式启动
app-cluster.json为以集群方式启动的配置文件
app-stand.json为以单例（或者独立主机stand alone）的方式启动的配置文件
例如：
可以输入以下命令进入单机模式

> node ces -c ces/appconfig/app-stand.json

# 依赖

依赖stream服务，如果stream服务没有启动，可以在stream目录下运行

> ./sbin/stream start

# 测试

然后运行test目录下的fire*，发射事件，如：

> node ces/test/fire.js

或

> node ces/test/fire.bench.js

或

> node ces/test/athena.fire.js