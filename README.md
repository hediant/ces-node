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

* **ES6支持**


# 依赖

依赖stream服务，如果stream服务没有启动，可以在stream目录下运行

> ./sbin/stream start

# 安装CES

* 可以在$PROJECT_ROOT下安装CES MODULE

> npm install ces-node

* 也可以采用全局安装的方式

> npm install -g ces-node

# 创建CES的工程

* 将ces-node下的project目录拷贝到指定位置, 重命名

# 配置CES的工程

* 配置 $PROJECT_ROOT 下的 config/ 目录

# 运行CES的工程

> cd $PROJECT_ROOT

> node --harmony app

或者

> ./sbin/ces.sh start

# 测试CES的工程

运行test目录下的fire*，发射事件，如：

> node test/fire.js
