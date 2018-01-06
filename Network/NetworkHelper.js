require('./Base');
const inherits = require('util').inherits;
var PlatformAccessory, Accessory, Service, Characteristic, UUIDGen;
var net =require('net'); 

const pattern = "(\{.*?\})";
const P443Port = 443;
const ServerPort = 9000;
const pServer = "aircat.phicomm.com";
const sockets = [];
const brightness_hex = "aa2f01e02411398f0b0000000000000000b0f89311420e003d0000027b226272696768746e657373223a22%s222c2274797065223a327dff23454e4423"

NetworkHelper = function(platform) {
    this.init(platform);
    this.platform.log.info("[Network]Loading Network");
    Accessory = platform.Accessory;
    PlatformAccessory = platform.PlatformAccessory;
    Service = platform.Service;
    Characteristic = platform.Characteristic;
    UUIDGen = platform.UUIDGen;
    
    this.sockets = {};
    this.psockets = {};
    this.m1s = {};
    this.api = platform.api;

    var that = this;
    try{ 
        var server = this.server = net.createServer();
        server.on('connection',function(socket){  
            that.platform.log.info("[Network]New connection!");  
            that.sockets[socket.remoteAddress] = socket;
            //that.platform.log.debug(that.sockets);  
            socket.on('data', function(data){  
                that.platform.log.debug("[Network]got data:" + data + " From IP: " + socket.remoteAddress); 
                if(that.platform.config.forwardTo != null){
                    var address = that.platform.config.forwardTo;
                    that.platform.log.debug("[Network]Forwarding!")
                    that.transferData(data,address);
                } 
                that.parseData(data,socket.remoteAddress)
            });  
            socket.on('close', function(){  
                that.platform.log.debug("[Network]Connection closed!");
                for (var i in that.sockets) {
                    socke = that.sockets[i];
                    if(socke.remoteAddress == socket.remoteAddress){
                        that.platform.log.debug("[Network]Deleting Unconnected " + socket.remoteAddress);
                        delete that.sockets[i];
                    }
                }
                //that.platform.log.debug(that.sockets);  
            });  
        });  
        server.on('error', function(err){
           that.platform.log.info("[Network]Error occurred:", err.message);
        });
        server.listen(ServerPort);
        that.platform.log.info("[Network]TCP Server Starting on " + ServerPort);

        if(that.platform.config.forwardTo != null){
            var P443server = this.P443server = net.createServer();
            P443server.on('connection',function(socket){  
                that.platform.log.info("[Network]P443server New connection!");  
                that.psockets[socket.remoteAddress] = socket;
                //that.platform.log.debug(that.psockets);  
                socket.on('data', function(data){  
                    that.platform.log.debug("[Network]P443server got data:" + data + " From IP: " + socket.remoteAddress); 
                    that.platform.log.debug("[Network]P443server Forwarding!")
                    var addresss = that.platform.config.forwardTo;
                    var addressarr = addresss.toString().split(":"); 
                    var address = addressarr[0] + ":" + P443Port;
                    that.transferData(data,address);
                });  
                socket.on('close', function(){  
                    that.platform.log.debug("[Network]P443server Connection closed!");
                    for (var i in that.psockets) {
                        socke = that.psockets[i];
                        if(socke.remoteAddress == socket.remoteAddress){
                            that.platform.log.debug("[Network]P443server Deleting Unconnected " + socket.remoteAddress);
                            delete that.psockets[i];
                        }
                    }
                    //that.platform.log.debug(that.sockets);  
                });  
            });  
            P443server.on('error', function(err){
               that.platform.log.info("[Network]P443server Error occurred:", err.message);
            });
            P443server.listen(P443Port);
            that.platform.log.info("[Network]P443 Server Starting on " + ServerPort);
        }

        
    }catch(ex){
        that.platform.log.error("[Network]Error Loading Server:" + ex);
        throw ex;
    }
    return null;
}
inherits(NetworkHelper, Base);

NetworkHelper.prototype.transferData = function(data,address) {
    var that = this;
    var addressarr = address.toString().split(":"); 
    try{
        var client = new net.Socket();
        client.connect(addressarr[1], addressarr[0], function() {
            that.platform.log.info('[Network]Connected To: ' + address);
            client.write(data);
            client.end();
        });
        client.on('close', function() {
            that.platform.log.info('[Network]Connection closed');
        });
        client.on('error', function(err) {  
            that.platform.log.info('[Network]Error in connection:', err);  
        });  
    }catch(ex){
        that.platform.log.error("[Network]Error Transfering Data:" + ex);
    }
}

NetworkHelper.prototype.parseData = function(data,ip) {
    var that = this;
    var dataa = null;
    try{
        var strdata = new Buffer(data).toString();
        var r = strdata.match("(\{.*?\})");
        var src = r[1];
        that.platform.log.debug(ip + " -> " + src);
        dataa = this.strToJSON(src);
    }catch(ex){
        that.platform.log.error("[Network]Error Parsing Data:" + ex);
    }
    if(dataa != null){
        this.manageDevice(dataa,ip);
    }
}

NetworkHelper.prototype.sendData = function(ip,data) {
    var that = this;
    try{
        that.platform.log.debug("[Network]Sending Data to: " + ip);  
        if(ip in that.sockets){
            that.sockets[ip].write(data);
            that.platform.log.debug("[Network]Done!");  
        }else{
            that.platform.log.debug("[Network]Unfound Connection " + ip);  
        }
    }catch(ex){
        that.platform.log.error("[Network]Error Sending Data:" + ex);
    }
}

NetworkHelper.prototype.strToJSON = function(data) {
    var djson = JSON.parse(data);
    this.platform.log.debug("JSON: " + JSON.stringify(djson));
    return djson;
}

NetworkHelper.prototype.manageDevice = function(data,ip) {
    var that = this;
    if (ip in this.m1s) {
        this.m1s[ip].parseData(data);
        this.platform.log.debug(ip + " already in device list!");
    } else {
        this.platform.log.info("Found " + ip);
        this.m1s[ip] = new PhicommM1(that,data,ip);
    }
}

PhicommM1 = function(dThis,data,ip){
    var that = this;
    this.platform = dThis.platform;
    this.ip = ip;
    this.strip = ip.replace('::ffff:','');
    this.rawip = this.strip.replace('.','');
    var namee = this.platform.getNameFormConfig(this.strip);
    if(!namee){
        namee = this.rawip.substring(this.rawip.length-8);
        this.platform.log.info("Found Unnamed M1, Please set config with IP " + this.strip);
    }
    this.name = namee;
    this.platform.log.info("Device Added " + this.strip + ", Name: " + this.name);

    this.allowupdate = false;
    this.parseData(data);
    this.InitAccessory();
}

PhicommM1.prototype.parseData = function(data) {
    this.temperature = data.temperature;
    this.humidity = data.humidity;
    this.pm25value = data.value;
    this.hcho = data.hcho;

    this.platform.log.debug('[' + this.name + ']temperature: %s °C', this.temperature);
    this.platform.log.debug('[' + this.name + ']humidity: %s %', this.humidity);
    this.platform.log.debug('[' + this.name + ']PM2.5: %s μg/m³', this.pm25value);
    this.platform.log.debug('[' + this.name + ']hcho: %s mg/m³', this.hcho);

    if(this.allowupdate == true){
        this.updateAllValue();
    }
}

PhicommM1.prototype.updateAllValue = function() {
    this.TemperatureService.getCharacteristic(Characteristic.CurrentTemperature).updateValue(this.temperature);
    this.HumidityService.getCharacteristic(Characteristic.CurrentRelativeHumidity).updateValue(this.humidity);
    this.AirQualityService.getCharacteristic(Characteristic.AirQuality).updateValue(this.calcAirQuality(this.pm25value));
    this.AirQualityService.getCharacteristic(Characteristic.PM2_5Density).updateValue(this.pm25value);
    this.platform.log.debug('[' + this.name + ']Value Updated!');
}

PhicommM1.prototype.calcAirQuality = function(pm25) {
    if(pm25 <= 50){
        return Characteristic.AirQuality.EXCELLENT
    }else if(pm25 > 50 && pm25 <= 100){
        return Characteristic.AirQuality.GOOD
    }else if(pm25 > 100 && pm25 <= 200){
        return Characteristic.AirQuality.FAIR
    }else if(pm25 > 200 && pm25 <= 300){
        return Characteristic.AirQuality.INFERIOR
    }else if(pm25 > 300){
        return Characteristic.AirQuality.POOR
    }else{
        return Characteristic.AirQuality.UNKNOWN
    }
}

PhicommM1.prototype.InitAccessory = function() {
    var that = this;
    uuid = UUIDGen.generate(this.strip + Date.now());
    this.uuid = uuid;
    newAccessory = this.platform.getAccessoryByName(this.name);
    if(newAccessory == null){
        newAccessory = new PlatformAccessory(this.name, uuid);
        var infoService = newAccessory.getService(Service.AccessoryInformation);
        infoService
            .setCharacteristic(Characteristic.Manufacturer, "Phicomm")
            .setCharacteristic(Characteristic.Model, "M1")
            .setCharacteristic(Characteristic.SerialNumber, this.strip);

        this.TemperatureService = new Service.TemperatureSensor(this.name);
        this.TemperatureService.getCharacteristic(Characteristic.CurrentTemperature)
            .on('get', function(callback) {
                callback(null,this.temperature);
            }.bind(this))
        this.HumidityService = new Service.HumiditySensor(this.name);
        this.HumidityService.getCharacteristic(Characteristic.CurrentRelativeHumidity)
            .on('get', function(callback) {
                callback(null,this.humidity);
            }.bind(this))    

        this.AirQualityService = new Service.AirQualitySensor(this.name);
        this.AirQualityService.getCharacteristic(Characteristic.AirQuality)
            .on('get', function(callback) {
                callback(null,this.calcAirQuality(this.pm25value));
            }.bind(this));
        this.AirQualityService.addCharacteristic(Characteristic.PM2_5Density);
        this.AirQualityService.getCharacteristic(Characteristic.PM2_5Density)
            .on('get', function(callback) {
                callback(null,this.pm25value);
            }.bind(this))

        this.brightness = 100;
        this.LightService = new Service.Lightbulb(this.name);
        this.LightService.addCharacteristic(Characteristic.Brightness)
        this.LightService.getCharacteristic(Characteristic.On)
            .on('get', function(callback) {
                var status = false;
                if (this.brightness != 0){
                    status = true;
                }
                callback(null,status);
            }.bind(this))
            .on('set', function(value,callback) {
                if(value){
                    var brightness = this.brightness = 100;
                }else{
                    var brightness = this.brightness = 0;
                }
                var buf = this.getBrightnessBuffer(brightness);
                this.platform.MNetworkHelper.sendData(this.ip,buf);
                this.platform.log.debug(buf);
                callback(null);
            }.bind(this))
        this.LightService.getCharacteristic(Characteristic.Brightness)
            .on('get', function(callback) {
                callback(null,this.brightness);
            }.bind(this))
            .on('set', function(value,callback) {
                var brightness = this.brightness = this.getSuitBrightness(value);
                var buf = this.getBrightnessBuffer(brightness);
                this.platform.MNetworkHelper.sendData(this.ip,buf);
                this.platform.log.debug(buf);
                callback(null);
            }.bind(this))


        newAccessory.addService(this.TemperatureService, 'Temperature');
        newAccessory.addService(this.HumidityService, 'Humidity');
        newAccessory.addService(this.AirQualityService, 'AirQuality');
        newAccessory.addService(this.LightService, 'Light')
        this.M1Service = newAccessory;
        this.platform.registerAccessory(newAccessory);

    }else{
        this.brightness = 100;
        this.M1Service = newAccessory;
        this.TemperatureService = newAccessory.getService(Service.TemperatureSensor);
        this.HumidityService = newAccessory.getService(Service.HumiditySensor);
        this.AirQualityService = newAccessory.getService(Service.AirQualitySensor);
        this.LightService = newAccessory.getService(Service.Lightbulb);
        this.LightService.getCharacteristic(Characteristic.On)
            .on('get', function(callback) {
                var status = false;
                if (this.brightness != 0){
                    status = true;
                }
                callback(null,status);
            }.bind(this))
            .on('set', function(value,callback) {
                if(value){
                    var brightness = this.brightness = 100;
                }else{
                    var brightness = this.brightness = 0;
                }
                var buf = this.getBrightnessBuffer(brightness);
                this.platform.MNetworkHelper.sendData(this.ip,buf);
                this.platform.log.debug(buf);
                callback(null);
            }.bind(this))
        this.LightService.getCharacteristic(Characteristic.Brightness)
            .on('get', function(callback) {
                callback(null,this.brightness);
            }.bind(this))
            .on('set', function(value,callback) {
                var brightness = this.brightness = this.getSuitBrightness(value);
                var buf = this.getBrightnessBuffer(brightness);
                this.platform.MNetworkHelper.sendData(this.ip,buf);
                this.platform.log.debug(buf);
                callback(null);
            }.bind(this))

        this.updateAllValue();
    }

    this.allowupdate = true;
}

PhicommM1.prototype.getSuitBrightness = function(brightness) {
    if(0<= brightness <= 25){
        if(25 - brightness < brightness){
            return 25
        }else{
            return 0
        }
    }else if(25 < brightness <= 100){
       if(100 - brightness < brightness - 25){
            return 100
        }else{
            return 25
        } 
    }
};

PhicommM1.prototype.getBrightnessBuffer = function(brightness) {
    var str = brightness.toString();
    this.platform.log.debug("[Network]Brightness: " + brightness + "," + this.brightness);
    var hexbrightness = "";
    for (var i = 0, len = str.length; i < len; i++) {
        hexbrightness = hexbrightness + Buffer(str[i],'ascii').toString('hex');
    }
    this.platform.log.debug("[Network]Brightness in HEX: " + hexbrightness);
    var command = brightness_hex.replace("%s",hexbrightness);
    var buffer = new Buffer(command,'hex');
    return buffer;
};



