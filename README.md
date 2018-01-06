# homebridge-phicomm-m1

[![npm version](https://badge.fury.io/js/homebridge-phicomm-m1.svg)](https://badge.fury.io/js/homebridge-phicomm-m1)

homebridge plugin for Phicomm M1
  
欢迎加入我们的QQ群 545171648 讨论  
QQ Group:545171648  
Telegram Group: https://t.me/joinchat/EujYfA-JKSwpRlXURD1t6g  

This plugin is based on Zackr's Domoticz Plugin  
https://www.domoticz.cn/forum/viewtopic.php?f=11&t=165  

## The support for LED Brightness has not been tested because I don't have one M1. If it works, please open an issue to let me know!!!

## Supported Types
1. Phicomm M1

## Requirement  
* If Your Router supports dnsmasq:
edit /etc/dnsmasq.conf on your router  
Add rules like this:
```
address=/.aircat.phicomm.com/192.168.1.5
```
192.168.1.5 should be changed to your HomeBridge's IP
* If Your Router doesn't supports dnsmasq
You can read the Wiki https://homekit.loli.ren/docs/show/81 to use MITM to get the data

## Configuration
```
"platforms": [
    {
        "platform": "PhicommM1Platform",
        "defaultValue": {
            "192.168.31.92": "PhicommM1"
        }
    }
]
```

## Forward Data:
```
"platforms": [
    {
        "platform": "PhicommM1Platform",
        "forwardTo" : "192.168.31.246:15000",
        "defaultValue": {
            "192.168.31.92": "PhicommM1"
        }
    }
]
```

## Version Logs 
### 0.0.6
1. Fix the brightness level to 0 25 100
2. Change 443 forwarding
### 0.0.5 
1. add support for 443 forwarding
2. rewrite led support
### 0.0.4
1. add support for forward Data
### 0.0.3
1. add support for led brightness(Beta)
### 0.0.2
1. fix unrefreshing AirQuality
### 0.0.1
1. add support for Phicomm M1.
