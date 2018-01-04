require('./Base');
const inherits = require('util').inherits;
var PlatformAccessory, Accessory, Service, Characteristic, UUIDGen;

const pattern = "(\{.*?\})";
const ServerPort = 9000;
const sockets = [];

NetworkHelper = function(platform) {
    this.init(platform);
    this.platform.log.info("[Network]Loading Network");
    Accessory = platform.Accessory;
    PlatformAccessory = platform.PlatformAccessory;
    Service = platform.Service;
    Characteristic = platform.Characteristic;
    UUIDGen = platform.UUIDGen;
    
    this.m1s = {};
    this.api = platform.api;
    var that = this;
    try{
        var net =require('net');  
        var server = this.server = net.createServer();

        server.on('connection',function(socket){  
            that.platform.log.info("[Network]New connection!");  
            sockets.push(socket); 
            socket.on('data', function(data){  
                that.platform.log.debug("[Network]got data:" + data + " From IP: " + socket.remoteAddress);  
                that.parseData(data,socket.remoteAddress)
            });  
            socket.on('close', function(){  
                that.platform.log.debug("[Network]Connection closed!");  
                var index = sockets.indexOf(socket);  
                sockets.splice(index, 1);  
            });  
        });  
        server.on('error', function(err){
           that.platform.log.info("[Network]Error occurred:", err.message);
        });
        server.listen(ServerPort);
        that.platform.log.info("[Network]TCP Server Starting on " + ServerPort);
    }catch(ex){
        that.platform.log.error("[Network]Error Loading Server:" + ex);
        throw ex;
    }
    return null;
}
inherits(NetworkHelper, Base);

NetworkHelper.prototype.parseData = function(data,ip) {
    var that = this;
    var dataa = null;
    try{
        var strdata = new Buffer(data,"utf-8").toString();
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
    //{"humidity":"58.71","temperature":"25.57","value":"45","hcho":"10"}
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

        newAccessory.addService(this.TemperatureService, 'Temperature');
        newAccessory.addService(this.HumidityService, 'Humidity');
        newAccessory.addService(this.AirQualityService, 'AirQuality');
        this.M1Service = newAccessory;
        this.platform.registerAccessory(newAccessory);

    }else{

        this.M1Service = newAccessory;
        this.TemperatureService = newAccessory.getService(Service.TemperatureSensor);
        this.HumidityService = newAccessory.getService(Service.HumiditySensor);
        this.AirQualityService = newAccessory.getService(Service.AirQualitySensor);
        this.updateAllValue();
    }

    this.allowupdate = true;
}



