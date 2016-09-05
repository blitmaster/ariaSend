var settings = {
    //"rpcpath" : "http://aria.tocant.me:6800/jsonrpc",
    "rpcpath" : "http://blit.us.to:6800/jsonrpc",
    "rpcuser" : null,
    "rpctoken" : null
};

var ARIA2 = (function () {
    "use strict";
    function get_auth(url) {
        return url.match(/^(?:(?![^:@]+:[^:@\/]*@)[^:\/?#.]+:)?(?:\/\/)?(?:([^:@]*(?::[^:@]*)?)?@)?/)[1];
    }

    function request(jsonrpc_path, method, params) {
        var jsonrpc_version = '2.0', xhr = new XMLHttpRequest(), auth = get_auth(jsonrpc_path);
        var request_obj = {
            jsonrpc: jsonrpc_version,
            method: method,
            id: (new Date()).getTime().toString()
        };
        if (params) {
            request_obj.params = params;
        }

        // progress on transfers from the server to the client (downloads)
        var updateProgress = function(oEvent) {
            if (oEvent.lengthComputable) {
                var percentComplete = oEvent.loaded / oEvent.total;
                // ...
            } else {
                // Unable to compute progress information since the total size is unknown
            }
        };

        var  transferComplete = function (evt) {
            console.log("transferComplete");
            console.log(evt);

            if (evt.currentTarget.status == 200)
                showNotification(true, "The download has been sent to aria2 queue");
            else
                showNotification(false, "Error " + evt.currentTarget.statusText + " (" + evt.currentTarget.status + ")");
        };

        var transferFailed = function (evt) {
            console.log("transferFailed");
            console.log(evt);
            showNotification(false, "An error occurred sending link to aria2 queue");
        };

        var transferCanceled = function(evt)  {
            console.log("transferCanceled");
            console.log(evt);
            showNotification(false, "The transfer has been canceled by the user");
        };

        //xhr.addEventListener("progress", updateProgress);
        xhr.addEventListener("load", transferComplete);
        xhr.addEventListener("error", transferFailed);
        xhr.addEventListener("abort", transferCanceled);

        xhr.open("POST", jsonrpc_path + "?tm=" + (new Date()).getTime().toString(), true);
        xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8");
        //xhr.setRequestHeader("Access-Control-Allow-Origin", "chrome-extension://ephjafgkfnohlmcindcgoojjdekdabac");
        if (settings.rpcuser) {
            xhr.setRequestHeader("Authorization", "Basic " + btoa(settings.rpcuser + ':' + settings.rpctoken));
        } else {
            if (settings.rpctoken) {
                request_obj.params = ['token:' + settings.rpctoken].concat(request_obj.params);
            }
        }
        xhr.send(JSON.stringify(request_obj));
    }
    return function (jsonrpc_path) {
        this.jsonrpc_path = jsonrpc_path;
        this.addUri = function (uri, options) {
            request(this.jsonrpc_path, 'aria2.addUri', [[uri], options]);
        };
        return this;
    };
}());


function showNotification(ok, msg) {
    var notfopt = {
        type: "basic",
        title: "Aria2 Integration",
        iconUrl: ok ? "icon-128.png" : "error.gif",
        message: msg
    };
    chrome.notifications.create("senttoaria2", notfopt, function () {return; });
    window.setTimeout(function () {chrome.notifications.clear("senttoaria2", function () {return; }); }, 3000);
}

function directCopy(str, mimetype, append) {
    var actData = "";
    if (append == true) {
        document.onpaste = function (event) {
            actData = event.clipboardData.getData(mimetype);
            event.preventDefault();
        };
        document.execCommand("Paste", false, null);
        document.onpaste = undefined;

        if (actData.length > 0)
            actData += '\r';
    }
    actData += str;

    document.oncopy = function(event) {
        event.clipboardData.setData(mimetype, actData);
        event.preventDefault();
    };
    document.execCommand("Copy", false, null);
    document.oncopy = undefined;

    if (append == true) {
        showNotification(true, "Link appended!");
    }
    else {
        showNotification(true, "Link copied!");
    }
}

function filterUrl(theLink, expr, repl) {
    var re = new RegExp(expr);

    var res = re.exec(theLink);
    if (res != null) {
        theLink = repl;
        for (var ndx = 1; ndx < res.length; ndx++) {
            theLink = theLink.replace('$' + ndx, res[ndx]);
        }
    }

    return theLink;
}

function getLink(origUrl) {
    var destUrl = origUrl;

    destUrl = filterUrl(destUrl, "http://www.elitetorrent.net/torrent/([0-9]+)/.+", "http://www.elitetorrent.net/get-torrent/$1");
    var modified = origUrl != destUrl;

    //expr = "http://www.divxtotal.com/series/torrent/([0-9]+)/.+";
    //dest = "http://www.divxtotal.com/download.php?id=$1";

    if (!modified) {
        destUrl = filterUrl(destUrl, "http://www.divxtotal.com/([^/]+)/torrent/([0-9]+)/.+", "http://www.divxtotal.com/download.php?id=$2");
        modified = origUrl != destUrl;
    }

    if (!modified) {
        destUrl = filterUrl(destUrl, "http://www.subtorrents.com/series/[^/]+/([0-9]+)/", "http://www.subtorrents.com/download.php?id=$1");
        modified = origUrl != destUrl;
    }

    if (!modified) {
        destUrl = filterUrl(destUrl, "http://www.subtorrents.com/peliculas/[^/]+/([0-9]+)/", "http://www.subtorrents.com/download.php?id=$1");
        modified = origUrl != destUrl;
    }

    return destUrl;
}

function appendLinkOnClick(info, tab) {
    var destUrl = getLink(info.linkUrl);
    directCopy(destUrl, "Text", true);
}

function copyLinkOnClick(info, tab) {
    var destUrl = getLink(info.linkUrl);
    directCopy(destUrl, "Text", false);
}

function downToPelis(info, tab) {
    var destUrl = getLink(info.linkUrl);

    var aria2 = new ARIA2(settings.rpcpath), params = {
        'dir': '/media/fc1adf3e-4156-4a83-9cd3-11072fd6f649/down/Movies'
    };

    //params.referer = tab.url;
    //params.header = "Cookie:" + response.pagecookie;
    aria2.addUri(destUrl, params);
}

function downRegular(info, tab) {
    var destUrl = getLink(info.linkUrl);

    var aria2 = new ARIA2(settings.rpcpath), params = {};
    //params.referer = tab.url;
    //params.header = "Cookie:" + response.pagecookie;
    aria2.addUri(destUrl, params);
}

var id1 = chrome.contextMenus.create({"title": "Envia link a l'aria2c", "contexts":["link"], "onclick": downRegular});
var id2 = chrome.contextMenus.create({"title": "Envia link a l'aria2c (pelis)", "contexts":["link"], "onclick": downToPelis});
var id3 = chrome.contextMenus.create({"title": "Copy torrent link", "contexts":["link"], "onclick": copyLinkOnClick});
var id4 = chrome.contextMenus.create({"title": "Append torrent link", "contexts":["link"], "onclick": appendLinkOnClick});
