var settings = require('../etc/settings.json');
var Queue = require('./redis');
var redis = new Queue( settings.redis.port, settings.redis.host );
var queue = require('queuer');
var q = queue.getQueue(settings.queue.host, settings.queue.contentqueue);
var template = require('./template');
var weibo = require('./weibo');
var MySqlClient = require('./mysql').MySqlClient;
var mysql = new MySqlClient(settings.mysql);

exports.addYdtx = function(stockcode, content) {
    redis.client.get(stockcode+'-'+content.datatype, function(error, result) {
        if(error) {
            console.log('[error] redis get error! stockcode:'+stockcode+', error:'+error);
        } else {
            if(!result) {
                addYdtxWeibo(content);
                redis.client.setex(stockcode+'-'+content.datatype, 18000, JSON.stringify(content), function(err) {
                    if(err) {
                        console.log('[error] redis set error! error:'+err);
                    }
                });
            }
        }
    });
}

var addYdtxWeibo = function(data) {
    var ydData = formatYdNumbers(data);
    var ydDate = new Date(ydData.date);
    var ydHH = ydDate.getHours().toString();
    var ydii = ydDate.getMinutes().toString();
    ydData.ydHour = (ydHH[1]?ydHH:"0"+ydHH[0]);
    ydData.ydMin = (ydii[1]?ydii:"0"+ydii[0]);
    var content_type = 'yd_zhangdie';
    switch(ydData.datatype) {
        case 1:
            ydData.showtype = '涨跌';
            ydData.updown = ydData.value.slice(0, -1);
            content_type = 'yd_zhangdie';
            break;
        case 2:
            ydData.showtype = '振幅';
            ydData.markup = ydData.value.slice(0, -1);
            content_type = 'yd_zhenfu';
            break;
        case 3:
            ydData.showtype = '换手';
            ydData.swaprate = ydData.value.slice(0, -1);
            content_type = 'yd_huanshou';
            break;
        default:
            ydData.showtype = '涨跌';
            ydData.updown = ydData.value.slice(0, -1);
            console.log('[error][ydtx] datatype error! received data:'+JSON.stringify(data));
            break;
    }
    var tplName = 'ydtx.tpl';
    var content = template.display(tplName, ydData);
    weibo.addWeibo(ydData.stock_code, content, '', content_type, function(blogid) {
        if(blogid > 0) {
            console.log('[message] receive yidong success,blogid:' + blogid + ',content:'+content+',stockcode:'+ydData.stockcode);
        } else {
            console.log('[error][ydtx] receive ydtx failure:'+JSON.stringify(data));
        }
    });
}

var formatYdNumbers = function(content) {
    var keyElem = {
        'datatype' : 'int',
        'currentprice' : 'float',
        'updown' : 'float',
        'markup' : 'float',
        'swaprate' : 'float',
        'flag' : 'int'
    };
    var ydData = {};
    for(var x in content){
        ydData[x] = content[x];
        if(keyElem[x] == undefined) {
            continue;
        }
        if(keyElem[x] == 'int' && typeof ydData[x] == 'string') {
            ydData[x] = parseInt(ydData[x]);
        } else if(keyElem[x] == 'float' && typeof ydData[x] == 'string') {
            ydData[x] = parseFloat(ydData[x]);
        }
        if(keyElem[x] == 'float') {
            ydData[x] = ydData[x].toFixed(2);
        }
    }
    return ydData;
}