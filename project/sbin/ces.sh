#!/bin/bash

cd `dirname $0`

if [ ! -d "../log" ]; then
  mkdir ../log
fi

APPJSON='ces.json'

case "$1" in
  start)
    pm2 start $APPJSON
    ;;
  stop)
    pm2 stop $APPJSON
    ;;
  restart)
    pm2 restart $APPJSON
    ;;
  *)
  echo "Usage: sbin/ces.sh {start|stop|restart}"
  exit 1
esac