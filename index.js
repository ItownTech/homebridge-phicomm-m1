require('./Network/NetworkHelper');

var fs = require('fs');
var packageFile = require("./package.json");
var PlatformAccessory, Accessory, Service, Characteristic, UUIDGen;

module.exports = function(homebridge) {
    if(!isConfig(homebridge.user.configPath(), "platforms", "PhicommM1Platform")) {
        return;
    }
    
    PlatformAccessory = homebridge.platformAccessory;
    Accessory = homebridge.hap.Accessory;
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    UUIDGen = homebridge.hap.uuid;

    homebridge.registerPlatform('homebridge-phicomm-m1', 'PhicommM1Platform', PhicommM1Platform, true);
}

function isConfig(configFile, type, name) {
    var config = JSON.parse(fs.readFileSync(configFile));
    if("accessories" === type) {
        var accessories = config.accessories;
        for(var i in accessories) {
            if(accessories[i]['accessory'] === name) {
                return true;
            }
        }
    } else if("platforms" === type) {
        var platforms = config.platforms;
        for(var i in platforms) {
            if(platforms[i]['platform'] === name) {
                return true;
            }
        }
    } else {
    }
    
    return false;
}

function PhicommM1Platform(log, config, api) {
    if(null == config) {
        return;
    }
    
    this.Accessory = Accessory;
    this.PlatformAccessory = PlatformAccessory;
    this.Service = Service;
    this.Characteristic = Characteristic;
    this.UUIDGen = UUIDGen;
    
    this.log = log;
    this.config = config;

    if (api) {
        this.api = api;
    }
    
	this.deletingacc = [];
    
    this.log.info("[INFO]*********************************************************************");
    this.log.info("[INFO]*                           Phicomm M1  v%s                       *",packageFile.version);
    this.log.info("[INFO]*       GitHub: https://github.com/Zzm317/homebridge-phicomm-m1     *");
    this.log.info("[INFO]*                        QQ Group:545171648                         *");
    this.log.info("[INFO]*    Telegram Group:https://t.me/joinchat/EujYfA-JKSwpRlXURD1t6g    *");
    this.log.info("[INFO]*********************************************************************");
    this.log.info("[INFO]start success...");
    this.MNetworkHelper = new NetworkHelper(this);

	this.api.on('didFinishLaunching', function() {
        setTimeout(function() {
            this.log.info("[Network]start Cleaning!");
            this.clearAccessory(); 
            this.log.info("[Network]Cleaning Done!");
        }.bind(this), 60 * 5 * 1000);
    }.bind(this));
}

PhicommM1Platform.prototype.registerAccessory = function(accessory) {
    this.api.registerPlatformAccessories('homebridge-phicomm-m1', 'PhicommM1Platform', [accessory]);
}

PhicommM1Platform.prototype.configureAccessory = function(accessory) {
	this.deletingacc.push(accessory);
}

PhicommM1Platform.prototype.clearAccessory = function(accessory) {
    for (var i in this.deletingacc) {
        Accessory = this.deletingacc[i];
		this.log.info("[Network]Deleting " + Accessory.UUID);
        this.api.unregisterPlatformAccessories('homebridge-phicomm-m1', 'PhicommM1Platform', [Accessory]);
    }
}

PhicommM1Platform.prototype.getAccessoryByName = function(name) {
    for (var i in this.deletingacc) {
        Accessory = this.deletingacc[i];
        if(Accessory.displayName == name){
            this.log.info("[Network]Found " + Accessory.UUID + " Match name " + name);
            delete this.deletingacc[i];
            return Accessory;
        }
    }
    return null;
}

PhicommM1Platform.prototype.getNameFormConfig = function(macaddress) {
	var defaultValueCfg = this.config['defaultValue'];
	if(null != defaultValueCfg) {
		if(null != defaultValueCfg[macaddress]) {
			return defaultValueCfg[macaddress];
		}
	}
	return false;
}
    