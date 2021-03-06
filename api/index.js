var mysql = require('promise-mysql');
var request = require('requestretry');
var http = require('http');
var url = require('url');
var data = [];
var tagPool = new Map();

//<-------------------------------------------------------------------------------------------------------------------->
//initiate MYSQL connection
//MYSQL connect codes start

// options for database connection
var connection = mysql.createPool({
  connectionLimit   : 10,
  host              : 'localhost',
  user              : 'ravellogproto',
  password          : 'R4v3lw4r3',
  database          : 'raveltrial',
  multipleStatements : true
});


//MYSQL connect codes end
//<-------------------------------------------------------------------------------------------------------------------->

//<-------------------------------------------------------------------------------------------------------------------->
// start an HTTP Server to listen for SAP Update (for SAP update results)
// API HTTP Server codes start

var server = http.createServer( async function (req, res) {

    if (req.method == 'POST') {
        var urlnya = url.parse(req.url,true);
        var url2 = urlnya.pathname;
        var url3 = url2.split('/');
        console.log('Hello', urlnya, url2, url3)
        var jason = '';
        if (url3[1] == 'G')
        {
            var gate = url3[2];
            req.on('data', async function (data) {
                jason += data;
            });
            req.on('end', function () {
                try {
                    body = JSON.parse(jason);
                    readerMessageHandler(gate, body.ip, body.tags)
                } catch (e) {
                    console.log('[HTTP] not JSON data received')
                }
                res.write('200');
                res.end();
            });
        }else if(url3[1] == 'trigger'){
            let jason = ''
            req.on('data', async function (data) {
                jason += data
            })
            req.on('end', function () {
                // console.log('jason',jason)
                var gate = url3[3];
                console.log('[HTTP] trigger from sensor')
                var kanban = ['sensor']
                console.log(jason)
                if(jason == '1'){
                    updateDatabase([gate, kanban])
                }
                res.write('200')
                res.end()
            });
        }
        else{
            console.log('Receive method',req.method,'from',url2);
            res.write('200');
            res.end();            
        }
    }
    else{
        console.log('Receive method',req.method,'from',url2);
        res.write('200');
        res.end();
    }
});


var port = 3001;
var host = '0.0.0.0';
var APIHandler = server.listen(port, host);
console.log('Listening at http://' + host + ':' + port);

// API HTTP Server codes end
//<-------------------------------------------------------------------------------------------------------------------->

//<----------------------------------------HTTP message handler-------------------------------------------------------->
// HTTP message handler start


// Jika ada kanban nyang sudah didaftarkan dan tampilkan kanban terdaftar dan tidak terdaftar
async function readerMessageHandler (gate, ip, kanban) {
    poolingTag(gate, kanban).then(updateDatabase).then(function (datare) {console.log(datare)}).catch(function (error) {console.log(error)});
}

//fungsi mengupdate ttl dari tiap kanban yang terbaca gate yang sama
function updateTTL(mapdata)
{
    mapdata.forEach(minus5seconds);
}

function minus5seconds(value, key, map) {
    value = value - 5;
    if (value <= 0) {
        map.delete(key);
    } else {
        map.set(key, value);
    }
    // console.log(`m[${key}] = ${value}`);
}

setInterval(function() {
    updateTTL(tagPool);
}, 5 * 1000);

//pooling tag jika terbaca di antena reader yang fungsinya sama, assign TTL 30 second
async function poolingTag(gate, tag){
    try {
        var tagFilteredByPool = new Set();
        var hasilUpdateLog =
        tag.forEach(function (element) {
            datatag = JSON.parse(JSON.stringify(element));
            if (!tagPool.has(datatag.tag)) {
                tagPool.set(datatag.tag, 30);
                tagFilteredByPool.add(datatag.tag);
            }
        });
        return [gate,[...tagFilteredByPool]];
    }
    catch (error) {
        return error;
    }
}



//Update database
var epc
async function updateDatabase ([gate, kanban]) {
    try {
        //var tagok untuk mendefinisikan kanban in iyang sudah terdaftar di database
        console.log(gate,kanban)
        var tagok = ['000000000000000000000001'];
        var time = getDatetimeToday();
        var returndata;
        //url /trialv1 khusus untuk membaca semua kanban yang lewat gate, dengan TTL 30 detik tiap kanban
        //gate_id = 0 untuk gate trial
        // if(gate == 'trialv1'){
        if(gate == '1'){    //buat sementara
            for (i=0;i<kanban.length;i++)
            {
                get_trial_number(kanban[i]).then(function(data){
                    try{
                        console.log(data)
                        connection.query('insert into read_logs_v1 (trial_number, epc, created_at) values (?, ?, ?)', [data[0], data[1], time]);
                    }catch(error){

                    }
                })
                // console.log(kanban[i])
            }
        }
        else if(gate == 'trialv2'){
            for (i=0;i<kanban.length;i++)
            {
                epc = kanban[i].slice(-3)
                // console.log(epc)
                connection.query('update tag_v2 set status = 1 where epc = ?',[epc])
                get_idtag(epc)
                .then(function(data){
                    get_trial(epc).then(function(trial){
                        try{
                            // console.log(trial[1])
                             connection.query('insert into read_logs_v2 (created_at,id_tag_v2, epc, trial_number) values (?, ?, ?, ?)', [time,data[0], data[1], trial])
                        }catch(error){

                        }
                    })
                   
                })
            }
        }

        return 'kanban masuk: '+kanban;
        // getGateFunction(gate, kanban).then(function (gate, kanban, status) { console.log(gate+' '+message+' '+status)});
    }
    catch (error) {
        return error;
    }
}

async function get_idtag (epc) {
    try{
        var hasil = await connection.query('SELECT id_tag FROM tag_v2 WHERE epc = ?',[epc]);
        return [hasil[0].id_tag,epc];
    }
    catch(error){

    }
}

async function get_trial (epc) {
    try{
        var trial = await connection.query('SELECT trial_number FROM matrix WHERE id = 1');
        return trial[0].trial_number;
    }
    catch(error){

    }

}

async function get_trial_number (epc) {
    try{
        var trial = await connection.query('SELECT trial_number FROM trial_v1 WHERE id = 1');
        return [trial[0].trial_number,epc];
    }
    catch(error){

    }

}


// HTTP message handler end
//<-------------------------------------------------------------------------------------------------------------------->

//<----------------------------------------1. Time Functions---------------------------------------------------------->
// Time functions starts
function getDateToday() {
    var today = new Date();
    var dd = today.getDate();
    var mm = today.getMonth()+1; //January is 0!
    var yyyy = today.getFullYear();

    if(dd<10) {
        dd = '0'+dd
    } 

    if(mm<10) {
        mm = '0'+mm
    } 

    today = yyyy + '-' + mm + '-' + dd;
    return today;
}

function getDatetimeToday() {
    var today = new Date();
    var dd = today.getDate();
    var mm = today.getMonth()+1; //January is 0!
    var yyyy = today.getFullYear();
    var HH = today.getHours();
    var MM = today.getMinutes();
    var ss = today.getSeconds();

    if(dd<10) {
        dd = '0'+dd
    } 

    if(mm<10) {
        mm = '0'+mm
    }

    if(HH<10) {
        HH = '0'+HH
    } 
    if(MM<10) {
        MM = '0'+MM
    }
    if(ss<10) {
        ss = '0'+ss
    }

    today = yyyy + '-' + mm + '-' + dd + ' '+ HH +':'+MM+':'+ss;
    return today;
}
// Time functions ends here
//<------------------------------------------------------------------------------------------------------------------->