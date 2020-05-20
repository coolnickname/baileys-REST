//imports
var express = require('express');
const WhatsAppWeb = require('baileys');
var fs = require("fs");

//pre-init
var app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
var client = null;

//Event cache
var unreadMessages = []

//template for responses
var responseTemplate = {
    "succes" : "null",
    "response" : "null",
    "error" : "null",
    "data" : {}
}

//Login data
authData = {}

/* format:
authData = {
    "clientID": "LbBdDcPDnQSVAnIqqxQ12Q==",
    "serverToken": "1@fAoA6bwvj4t5FJBu2SfadsddsadCoMxlr79CY4oAkiCUwQAIasdasdas8HlimgessZbXByzQuA==",
    "clientToken": "0xAhydasv+Kb+Sgor4iThisIsFakeDontWorryFe0N+alwWK3gAe4Pdugzb99Y=",
    "encKey": "YdEw+To63AdasdaXkUGrSQceAOrJlkf8d8Ufi6P/bRaAd0oM=",
    "macKey": "lOaEMGpvNA+IYbS+HF9+47tFmXasdasdbOHYyI4Y3ztwg="
}
*/

//init
var server = app.listen(42069, function () {
   var port = server.address().port
   console.log("[REST] Baileys REST API listening at http://localhost:%s", port)
   
   if (!isEmpty(authData)){
		console.log("[REST] Automatically signing in.")
		restoreConnection(JSON.parse(JSON.stringify(responseTemplate)), authData)
		postInit();
		
   }
   
})

//post-init
function postInit(){
	console.log("[REST] Running post init")
	
	client.setOnUnreadMessage (m => {
		onIncomingMessage(m);
	})
	
	client.setOnUnexpectedDisconnect (err => console.log("[REST] disconnected with error: ", err) ) //Doesn't call. Bug?
	
}

//Sign in. Login tokens in the body are optional, otherwise a new connection will be made. The login tokens are returned if they are generated.
app.post('/client/connect', async (req, res) => {
    var response = JSON.parse(JSON.stringify(responseTemplate));
    
    if (isEmpty(req.body)) {
        //No auth data given, we need a new connection.
        response = await newConnection(response)
        
    } else {
        //Auth data is embedded in the body, restoring the previous connection
        response = await restoreConnection(response, req.body)
        
    }
    
    postInit();
    
    res.send(response);
    
})

//Get auth tokens for current session (deprecated)
app.get('/client/auth', function (req, res) {
    var response = JSON.parse(JSON.stringify(responseTemplate));
    
    if (client === null){
        response.succes = false;
    }else{
        response.succes = true;
        response.response] = client.base64EncodedAuthInfo();
    }
    
    res.send(response)
    
})

//Return some info about the connection and health of the server. Currently just the connect whatsapp account's user data.
app.get('/ping', function (req, res) {
    var response = JSON.parse(JSON.stringify(responseTemplate));
    
    if (client === null){
        response.succes = false;
    }else{
        response.succes = true;
        response.response] = client.userMetaData;
    }
    
    res.send(response)
    
})

//Test Endpoint Please Ignore
app.get('/test', async (req, res) => {
    var response = JSON.parse(JSON.stringify(responseTemplate));
    
    response.succes = true;
	
    res.send(response)
    
})

//Query unread messages
app.get('/messages/unread', function (req, res) {
    var response = JSON.parse(JSON.stringify(responseTemplate));
	response.succes = true;
	response.response = []
    
	while (!isEmpty(unreadMessages)){
		response.response.push(unreadMessages.shift());
	}
	
	res.send(response)
    
})

//Send read receipt
/* Body:
 *	{
 *		"remoteJID": "a", //jid of the chat, not the sender. For private chats these are the same, but for groups use the group jid.
 *		"messageID": "b" //stanzaId of the message.
 * 	}
 */
app.post('/messages/ack', function (req, res) {
    var response = JSON.parse(JSON.stringify(responseTemplate));
	
	if (isEmpty(req.body)) {
		
        response.succes = false
        
    } else {
		
		client.sendReadReceipt(req.body["remoteJID"], req.body["messageID"]) 
        response.succes = true
        
    }
	
	res.send(response)
    
})

//Send a text message
/* Body:
 *	{
 *		"contactID": "a",
 *		"quotedMessage": [], //Options are: null, see below
 *		"text": "c"
 * 	}
 * 
 * Body when quoting:
 * {
 *     "contactID": "a,
 *     "quotedMessage": {
 *         "key": {
 *             "remoteJid": "b", //Quoted person (jid)
 *             "id": "c" //Can be anything. For safety don't leave it empty.
 *         },
 *         "message": { "conversation": "d" } //Quoted message
 *     },
 *     "text": "e" //Reply to the quoted message
 * }
 */
app.post('/messages/send/text', function (req, res) {
    var response = JSON.parse(JSON.stringify(responseTemplate));
	
	if (isEmpty(req.body)) {
		
        response.succes = false
        
    } else {
		
		sendTextMessage(req.body["contactID"], req.body["text"], req.body["quotedMessage"])
		response.succes = true
	
    }
	
	res.send(response)
    
})

//Send a raw message: https://github.com/adiwajshing/Baileys/blob/ea5ca61e496ddabfce0728396bd1d03e68136d26/WhatsAppWeb.Send.js#L167
/* Body:
 *	{
 *		"contactID": "a",
 *		"message": {} //Options are: see additional data file
 * 	}
 */
app.post('/messages/send/raw', function (req, res) {
    var response = JSON.parse(JSON.stringify(responseTemplate));
	
	if (isEmpty(req.body)) {
		
        response.succes = false
        
    } else {
		
		client.sendMessage(req.body["contactID"], req.body["message"]);
		response.response = req.body["message"];
		response.succes = true;
	
    }
	
	res.send(response)
    
})

//Send a media message
//TODO: Enable quoting other messages, currently limited by Bailey's functionality.
//TODO: Test video, gif, audio.
/* Body:
 *	{
 *		"contactID": "a",
 *		"messageType": "b", //Options are: "media/video", "media/image", "media/audio", "media/sticker".
 *		"quotedMessage": [], //Options are: null, []
 *		"text": "d", //Optiones are: "text", for no text use "" not null.
 *		"mediaLocation": "e", //Options are: Local path to the file.
 *		"isGif": f //Options are: true/false
 * 	}
 */
app.post('/messages/send/media', function (req, res) {
    var response = JSON.parse(JSON.stringify(responseTemplate));
    var mediaType = null
	
	if (isEmpty(req.body)) {
		
        response.succes = false
        
    } else {
		
		if (req.body["messageType"] == "media/video") {
			mediaType = WhatsAppWeb.MessageType.video;
		} else if (req.body["messageType"] == "media/image") {
			mediaType = WhatsAppWeb.MessageType.image;
		} else if (req.body["messageType"] == "media/audio") {
			mediaType = WhatsAppWeb.MessageType.audio;
		} else if (req.body["messageType"] == "media/sticker") {
			mediaType = WhatsAppWeb.MessageType.sticker;
		}
		
		sendMediaMessage(req.body["contactID"], req.body["text"], req.body["mediaLocation"], req.body["isGif"], mediaType)
		response.succes = true
	
    }
	
	res.send(response)
    
})

//Query info about a person
app.get('/people/:id/info', async (req, res) => {
    var response = JSON.parse(JSON.stringify(responseTemplate));
    
	response.succes = true;
	response.response = {};
	
	response.response.jid = req.params.id
	
	await client.isOnWhatsApp (req.params.id)
    .then (([exists, id]) => response.response.exists = exists)
	
	await client.getStatus (req.params.id)
	.then (json => response.response.status = json[0].status) //Bug? Should be json.status
	
	await client.getProfilePicture (req.params.id)
	.then (json => response.response.picture = json[0].eurl)
	
	res.send(response)
    
})

//Updating presence
/* Body:
 * {
 * 		"presence": "a" //Options are: "available", "unavailable", "composing", "recording".
 * }
 */
app.post('/presence/:id', function (req, res) {
    var response = JSON.parse(JSON.stringify(responseTemplate));
    response.succes = true;
	presence = null
	
	if (req.body.presence == "available") {
		presence = WhatsAppWeb.Presence.available;
	} else if (req.body.presence == "unavailable") {
		presence = WhatsAppWeb.Presence.unavailable;
	} else if (req.body.presence == "composing") {
		presence = WhatsAppWeb.Presence.composing;
	} else if (req.body.presence == "recording") {
		presence = WhatsAppWeb.Presence.recording;
	} else {
		response.succes = false;
	}
	
	client.updatePresence(req.params.id, presence) 
	res.send(response)
    
})

//Query info about a group
//TODO: Fix after baileys 1.0.2
app.get('/group/:id/info', async (req, res) => {
	var response = JSON.parse(JSON.stringify(responseTemplate));
    
	response.succes = true;
	response.response = {};
	
	response.response.jid = req.params.id
	
	//await client.groupMetadata (req.params.id)
	//.then (json => response.response.status = json[0].status) //TODO: Doesn't work.
	
	await client.getProfilePicture (req.params.id)
	.then (json => response.response.picture = json[0].eurl)
	
	await client.groupInviteCode (req.params.id)
	.then (code => response.response.code = code)
	
	res.send(response)
    
})

//functional methods
//Create a new connection
async function newConnection(response){
    client = new WhatsAppWeb()
    client.autoReconnect = true
    
    await client.connect()
    .then (([user, chats, contacts, unread]) => {
        console.log("[REST] Logged in succesfully");
        response.succes = true;
		response.response = client.base64EncodedAuthInfo();
        
    })
    .catch (([err]) => {
        console.log("[REST] unexpected error while logging in: " + err)
        response.succes = false;
		response.error = err;
        
    })
    
    return response
    
}

//Sign back in to an existing connection
async function restoreConnection(response, auth){
    client = new WhatsAppWeb()
    client.autoReconnect = true
    
    await client.connect(auth)
    .then (([user, chats, contacts, unread]) => {
        console.log("[REST] Logged in succesfully");
        response.succes = true;
        
    })
    .catch (([err]) => {
        console.log("[REST] unexpected error while logging in: " + err);
        response.succes = false;
		response.error = err;
        
    })
    
    return response;
    
}

//Send a text message
function sendTextMessage(contactID, text, quotedMessage){
	if (isEmpty(quotedMessage)){
		client.sendTextMessage(contactID, text) 
	}else{
		client.sendTextMessage(contactID, text, quotedMessage) 
	}
}

//Send a media message
//TODO: Add support for MIME requiring file types.
function sendMediaMessage(contactID, text, mediaPath, isGif, mediaType){
	const buffer = fs.readFileSync(mediaPath)
	//To send text files we need to add support for MIME types in the info array.
	const info = {}
	
	if (isGif === true){
		info["gif"] = isGif;
	}
	
	if (text != "" && mediaType != WhatsAppWeb.MessageType.sticker){
		info["caption"] = text;
	}
	
	client.sendMediaMessage(contactID, buffer, mediaType, info)
}

//events
//Unread message listener
function onIncomingMessage(message){
	console.log("[REST] New message!")
	
	unreadMessages.push(message);
	
}

//util methods
//Check if JSON string is empty (== "{}" || == "" || == [] || == null)
function isEmpty(obj) {
	if (obj == null) { return true; }
	
	return !Object.keys(obj).length > 0;
}

