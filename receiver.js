var fs = require('fs');
var settings = JSON.parse(fs.readFileSync('./etc/settings.json', 'utf8'));
var queue = require('queuer');
var q = queue.getQueue(settings.queue.host, settings.queue.contentqueue);
var request = require('request');
var express = require('express');
var app = express.createServer();
var MySqlClient = require('./lib/mysql').MySqlClient;
var mysql = new MySqlClient(settings.mysql.host, settings.mysql.port, settings.mysql.username, settings.mysql.password, settings.mysql.database);

app.use(express.bodyParser());
app.post('/hangqing', function(req, res) {
    if(req.body.stockcode == undefined || req.body.name == undefined) {
        res.end('error! invalid stock code or name');
    } else {
        var stockcode = parseInt(req.body.stockcode.substr(-6));
        if(stockcode > 300010 && stockcode < 300030) {
            var myDate = new Date();
            var iTimestring = Date.parse(myDate) / 1000;
            var myHour = myDate.getHours();
            if(myHour < 11) {
                var showtype = '开盘';
            } else if(myHour > 14) {
                var showtype = '收盘';
            } else {
                var showtype = '午盘';
            }
            var amount = req.body.volum;
            if(amount > 100000) {
                amount = amount / 10000;
                amount = amount.toFixed(2);
                amount += '万';
            }
            amount += '手';
            var volum = req.body.amount;
            if (volum > 100000000) {
                volum = volum / 100000000;
                volum = volum.toFixed(2);
                volum += '亿';
            } else if(volum > 100000) {
                volum = volum / 10000;
                volum = volum.toFixed(2);
                volum += '万';
            }
            volum += '元';
            var content = '【'+req.body.name+showtype+'播报】昨收：'+req.body.close+'，今开：'+req.body.open+'，最高：'+req.body.high+'，最低：'+req.body.low+'，最新：'+req.body.price+'，涨跌额：'+req.body.updown+'，涨跌幅：'+req.body.markup+'%，总量：'+amount+'，金额：'+volum+'。';
            if( myHour > 10 && req.body.type == 0) {
                var stockcode = req.body.stockcode.substr(-6);
                request({ uri:settings.zjlx+stockcode }, function (error, response, body) {
                    if(error) {
                        console.log('request error:'+stockcode);
                    }
                    try {
                        var oData = JSON.parse(body);
                        content += '【资金流向】净流量:' + oData.stock.fundquantity + '万元，其中机构：'+oData.stock.jigou.jigouquantity+'万元，大户'+oData.stock.dahu.dahuquantity+'万元，散户'+oData.stock.sanhu.sanhuquantity+'万元。';
                    } catch(err) {
                        console.log('parse error12:'+stockcode);
                    }
                    mysql.insert_micro_blog(req.body.stockcode, iTimestring, content, function(blogid) {
                        if(blogid > 0) {
                            q.enqueue('mysql://'+settings.mysql.host+':'+settings.mysql.port+'/'+settings.mysql.database+'?micro_blog#'+blogid);
                            res.end('success');
                        } else {
                            res.end('error! insert error:'+stockcode);
                        }
                    });
                });
            } else {
                mysql.insert_micro_blog(req.body.stockcode, iTimestring, content, function(blogid) {
                    if(blogid > 0) {
                        q.enqueue('mysql://'+settings.mysql.host+':'+settings.mysql.port+'/'+settings.mysql.database+'?micro_blog#'+blogid);
                        res.end('success');
                    } else {
                        res.end('error! insert error:'+stockcode);
                    }
                });
            }
        } else {
            res.end('success');
        }
    }
});
app.listen(9559);

