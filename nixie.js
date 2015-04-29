/**
 * FILE:	nixie.js
 *
 * USAGE:	node nixie.js
 *
 * DESCRIPTION:	Nixie Clock
 *		
 *
 * AUTHOR: 	Mark Wrigley
 * VERSION: 	0.00
 * CREATED: 	28.04.2015
 * REVISION: 	dd.mm.2015
 *
 * CONFIG:	
 * 		
 *
 */

/**
 * TO BE COMPLETED: ([x]-completed [.]-incomplete)
 * [x] modify config file when user changes a parameter
 * [.] add pin definitions for nixie drivers/latches/LEDs/buttons etc
 * [.] write routines to output a value to the nixies
 * [.] write routines to animate nixies when they change value
 * [.] add hardware button & code to turn clock on during an off period (turn on for a few seconds)
 * [.] code to allow button double-click to toggle clock on/off 
 * [.] rotary encoder (or pushbuttons?) to adjust brightness level (PWM)
 * [.] PWM brightness control
 * [.] regularly get public IP address & send to eMail/SMS/pushover/? notification
 * [.] LDR sensor for auto dimming
 * [.]
 *
 */
 
var app = require('http').createServer(function handler (req, res) {
  fs.readFile('/home/pi/nodeApps/nixieClock/index.html',
    function (err, data) {
      if (err) {
        res.writeHead(500);
        return res.end('Error loading index.html');
      }
      res.writeHead(200); 
      res.end(data); 
    }
  );
}).listen(2002);
var io = require('socket.io')(app);
var fs = require('fs');
var Gpio = require('onoff').Gpio;
var lineReader = require('line-reader');

/**
 * keep LED definitions etc in here for now, it will need to be expanded to assign
 * pins to the nixie drivers etc
 */
var ledPin={};
ledPin[0] = new Gpio(17, 'out', 'both');
ledPin[1] = new Gpio(27, 'out', 'both');
ledPin[2] = new Gpio(22, 'out', 'both');

/**
 * ADC MCP3008 definitions
 */
clock   = new Gpio(18, 'out');
adc_out = new Gpio(23, 'in');
adc_in  = new Gpio(24, 'out');
cs      = new Gpio(25, 'out');

/**
 * legacy LED stuff, kept here for now, will need to be modified
 */
var ledState={};
for (i=0; i<=2; i++) {
  ledState[i]=0;
  ledPin[i].writeSync(ledState[i]);
  ledPin[i].watch(emitLedStatus);
} 

/**
 * default clock on/off times, these get overwritten by whatever is in the cfg file
 */
var clockOn = '05:58';
var clockOff = '23:02';

/**
 * current nixie values
 */
var nA = 0;
var nB = 0;
var nC = 0;
var nD = 0;

/**
 * add leading zeros (to single-dgit hour or minute values)
 */
function pad(num, size) {
  var s = num+"";
  while (s.length < size) s = "0" + s;
  return s;
}

/**
 * get clock configuration from file
 */
lineReader.eachLine('config.txt', function(line, last) {
  if ((line[0]==';') || (line.length == 1)) {
    // ignore this line
  } else {
      if (line.indexOf('ON') > -1) {
        var i = line.indexOf('=')+1;
        var l = line.substring(i,line.length).trim();
        clockOn = l;
        console.log('on time is: '+clockOn);
      }
      if (line.indexOf('OFF') > -1) {
        var i = line.indexOf('=')+1;
        var l = line.substring(i,line.length).trim();
        clockOff = l;
        console.log('off time is: '+clockOff);
      }
  }
  if(last){
    return false;
  }
});

/**
 * update the contents of nixie.cfg with par(ameter) & val(ue)
 * only lines containing par are affected
 * format is "par = val"
 */
function updateCfgFile(par,val) {
  fs.writeFileSync('tempcfg.txt','');
  lineReader.eachLine('config.txt', function(line, last) {
    if ((line[0]==';') || (line.length == 1)) {
      fs.appendFileSync('tempcfg.txt',line+"\n");
    } else {
      if (line.indexOf(par) > -1) {
        fs.appendFileSync('tempcfg.txt',par+" = "+val+"\n");
      } else {
        fs.appendFileSync('tempcfg.txt',line+"\n");
      }
    }
    if (last) {
      // don't put this code outside or it will try to execute
      // before linereader is completed
      fs.unlinkSync('config.txt');
      fs.renameSync('tempcfg.txt','config.txt');
    }
  });
}

/*
fs.writeFile("/tmp/test", "Hey there!", function(err) {
    if(err) {
        return console.log(err);
    }

    console.log("The file was saved!");
}); 
*/

// the callback function for LEDs that change state
function emitLedStatus(err, state) {
  for (i=0; i<=2; i++) {
      io.sockets.emit('ledstatus',i,ledState[i]);
  }
}

/**
 * get ADC value
 */
readAdc = function(adc_pin, clockpin, adc_in, adc_out, cspin) {
  cspin.writeSync(1);
  clockpin.writeSync(0);
  cspin.writeSync(0);
  command_out = adc_pin;
  command_out |= 0x18;
  command_out <<= 3;
  for (i = 0; i <= 4; i++) { 
    if ((command_out & 0x80) > 0) {
      adc_in.writeSync(1);
    } else {
      adc_in.writeSync(0);
    }
    command_out <<= 1;
    clockpin.writeSync(1);
    clockpin.writeSync(0);
  }

  clockpin.writeSync(1);		
  clockpin.writeSync(0);	
  result = 0;
  for (i = 0; i <= 9; i++) {
    clockpin.writeSync(1);		
    clockpin.writeSync(0);	
    result <<= 1;
    if (adc_out.readSync() == 1) {
      result |= 0x1;
    }
  }
  cspin.writeSync(1);		
  return result;
};

nixieSend = function(a,b,c,d) {
  // write numbers a, b, c, & d to the nixies
  // TO BE COMPLETED
}
nixieRoll = function(a,b,c,d) {
  // roll nixie numbers up from current value (nA,nB,nC,nD) to the new value (abcd)
  // TO BE COMPLETED
}


/**
 * do this every second ...
 */
setInterval(function(){
  var data,i = 0;
  // send ADC values to clients
  for (i = 0; i <= 7; i++) {
        data = readAdc(i, clock, adc_in, adc_out, cs);
        io.sockets.emit('an'+i,data);    
  }
  var d = new Date();
  var ss = d.getSeconds(); 
  if (ss == 0) {
    // on the minute, every minute ...
    
    // send time update to any clients
    var hh = pad(d.getHours(),2);
    var mm = pad(d.getMinutes(),2);
    var tt = hh+":"+mm;
    io.sockets.emit('currentTime',tt);
    
    // update the nixie display
    // TO BE COMPLETED
  }
  
  if ((ss==10) || (ss==30) || (ss==50))  {
    // three times a minute, nixie displays date/month
    // TO BE COMPLETED
    
  }
  
  if (ss==57) {
    // increase the colon flash rate until new minute starts
    // TO BE COMPLETED
  }
  
},1000);

io.on('connection', function (socket) {
   /**
    * this stuff runs when a new browser connection is made
    */
    var socketId   = socket.id;
    var clientIp   = socket.request.connection.remoteAddress;
    var clientPort = socket.request.connection.remotePort;
    var d  = new Date();
    var hh = pad(d.getHours(),2);
    var mm = pad(d.getMinutes(),2);
    var tt = hh+":"+mm;
    
    // send client address
    socket.emit('ipaddr',clientIp);
    socket.emit('ipport',clientPort);

    // send time information
    var t1 = clockOn;
    var t2 = clockOff;
    //console.log('client connected');
    socket.emit('currentTime',tt);
    socket.emit('onTime',t1);
    socket.emit('offTime',t2);
    
   /**
    * listen for messages from client
    */
    
    // changed clock ON/OFF times
    socket.on('clockOnOff', function(onOrOff, value) {
      //console.log(value);
      switch (onOrOff) {
        case 'on':
          clockOn = value;
          io.sockets.emit('onTime',value);
          // update the cfg file
          updateCfgFile('ON',value);
          break;
        case 'off':
          clockOff = value;
          io.sockets.emit('offTime',value);
          // update the cfg file
          updateCfgFile('OFF',value);
          break;
      }
    });
    
});
