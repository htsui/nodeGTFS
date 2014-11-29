/*
Currently, the gtfs-realtime specification only allows clients to download the data of the entire fleet of vehicles at once.

The main use for this application is to support mobile apps, where users may be wary of bandwidth consumption.  
With some gtfs-realtime vehicle position files having sizes of >50kb, the bandwidth requirements can stack up very quickly when constantly updating vehicle positions.
This application will allow clients to request only the data they need, moving the bandwidth cost to a middleman server, rather than the client.

Usage: Change feedUrl to the relevant feed.
To request data:
http://yourhost.whatever:3000/:search_by/:query/:ret_vals

:search_by is the variable which you want to search through
    the tree structure is navigated using "."
:query is what the variable must equal in order for the vehicle to be considered
:ret_vals are the variables which you want returned
    ret_vals can be seperated by "," and the tree structure can be navigated using "."
    if no ret_vals are defined, it will default to longitude, latitude, and bearing.

eg- http://yourhost.whatever:3000/trip.route_id/32/position.longitude,position.latitude,stop_id
This would return the longitude, latitude, and stop_id of any vehicle currently on route_id 32.

For gtfs-realtime specifications, go to https://developers.google.com/transit/gtfs-realtime/
In order to view the tree structure easily in json format, uncomment the "out=entities" line in processQuery().
*/


var updateRate = 15000;//seconds between server updates
var port = 3000;//um... this is the port.

var feedUrl = "http://developer.mbta.com/lib/GTRTFS/Alerts/VehiclePositions.pb";
//Hamilton Street Rail: "http://opendata.hamilton.ca/GTFS-RT/GTFS_VehiclePositions.pb";    


var compression = require('compression')
var express = require('express');
var app = express();
app.use(compression());
var http = require('http').Server(app);
//var io = require('socket.io')(http);



http.listen(port, function(){
  console.log('server running on port '+port);
});

app.get('/:search_by/:query', function (req, res){
    processQuery(req,res);
});

app.get('/:search_by/:query/:ret_vals', function (req, res){
    //res.send(entities.length + " ");
    processQuery(req,res);
});



function processQuery(req, res){
    var out = [];
    //search_by is the variable in which to look for the query-
    //ie - SELECT * FROM BUSSES WHERE [search_by] = [query]
    //search_by is split on "." in order to allow searching within the tree structure.
    //ie- trip.trip_id, or just stop_id
    //see gtfs-realtime protocol for details on the tree structure.
    var search_by_splitted = req.params.search_by.split(".");


    //ret_splitted splits up the return variables.  return variables are seperated by "," and tree structure is navigated through "." as above
    //if ret values are not defined, we default to returning latitude, position, and longitude.
    var ret_splitted;
    if (typeof req.params.ret_vals == "undefined"){
        ret_splitted = ["position.bearing","position.latitude","position.longitude"];
    } else {
        ret_splitted = req.params.ret_vals.split(",");
    }

        //this loop loops through every bus in the fleet
        for(var i = 0; i < entities.length; i++){

            //match represents whether or not the current vehicle fits the query.
            var match = false;
            if (search_by_splitted.length == 1){
                if (entities[i].vehicle[search_by_splitted[0]] == req.params.query){
                    match = true;
                }
            } else if (search_by_splitted.length == 2){
                if (entities[i].vehicle[search_by_splitted[0]][search_by_splitted[1]] == req.params.query){
                    match = true;
                }
            }

            //if the current vehicle fits the query (ie- the client is requesting the data from this vehicle)
            if (match == true){

                

                
                

                //run through the return values one at a time and fill them in.
                //also, put the return values into the out string.
                var vehicleStats = {};  

                for (j = 0; j < ret_splitted.length; j++){
                    //split the return values by ".", indicating the tree structure.
                    var ret_splitted2 = ret_splitted[j].split(".");
                    if (ret_splitted2.length == 1){
                        vehicleStats[ret_splitted[j]] = entities[i].vehicle[ret_splitted2[0]];
                    } else if (ret_splitted2.length == 2){
                        vehicleStats[ret_splitted[j]] = entities[i].vehicle[ret_splitted2[0]][ret_splitted2[1]];
                    }
                }
                //put the current index into the cache array
                out.push(vehicleStats);
            }
        }



    //out = entities;//Uncomment this to show the entire gtfs feed in json format, used for debugging purposes.
    res.send(out);
}



/*
The following is the logic that reads the gtfs-realtime data, and puts it into the variable 'entities' which is then accessed when requests are made by clients.
*/
var ProtoBuf = require('protobufjs');
var transit = ProtoBuf.protoFromFile('gtfs-realtime.proto').build('transit_realtime');
var http1 = require("http");
http1.get(feedUrl, parse);
setInterval( function() { http1.get(feedUrl, parse); }, updateRate );
var entities;

// process the feed
function parse(res) {
    // gather the data chunks into a list
    var data = [];
    res.on("data", function(chunk) {
        data.push(chunk);
    });
    res.on("end", function() {
        ;
        // merge the data to one buffer, since it's in a list
        data = Buffer.concat(data);
        // create a FeedMessage object by decooding the data with the protobuf object
        var msg = transit.FeedMessage.decode(data);

        entities = msg.entity;
    }); 
}