# baileys-REST
A REST server with endpoints for the Baileys whatsapp web API

The code has a ton of comments explaining how to use it, including detailed examples of what the request body should look like in POST requests. I'll see if I can redact my postman project and upload that too, but for now if you don't understand something or need an example just open up an issue.


All responses from the server are in this format:
```JSON
{
    "succes" : true/false,
    "response" : "",
    "error" : "",
    "data" : {}
}
```

The response is either a JSON object or a JSON array of the results of your request. If there is no result it's just empty. "data" is currently unused. Succes and error don't need explaining.

To connect for the first time you need to send a POST request to `/client/connect` with an empty body. This will show the QR code in the terminal for you to scan, and when logged in will return the auth tokens as "response" in the above format. To sign in after that either send a POST to the same endpoint but with these tokens in the request body (in the same format your received them in the "response" element), or put them in the authData element at the top of the script to automatically log in when starting the server.
