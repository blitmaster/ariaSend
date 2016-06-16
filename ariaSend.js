var settings = {
	"rpcpath" : "http://aria.tocant.me:6800/jsonrpc",
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


function showNotification() {
    var notfopt = {
		type: "basic",
		title: "Aria2 Integration",
		iconUrl: "icon-128.png",
		message: "The download has been sent to aria2 queue"
	};
    chrome.notifications.create("senttoaria2", notfopt, function () {return; });
    window.setTimeout(function () {chrome.notifications.clear("senttoaria2", function () {return; }); }, 3000);
}

function directCopy(str, mimetype) {
	document.oncopy = function(event) {
		event.clipboardData.setData(mimetype, str);
		event.preventDefault();
	};
	document.execCommand("Copy", false, null);
	document.oncopy = undefined;
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

function genericOnClick(info, tab) {
	var destUrl = info.linkUrl;

	destUrl = filterUrl(destUrl, "http://www.elitetorrent.net/torrent/([0-9]+)/.+", "http://www.elitetorrent.net/get-torrent/$1");
	var modified = info.linkUrl != destUrl;

	//expr = "http://www.divxtotal.com/series/torrent/([0-9]+)/.+";
	//dest = "http://www.divxtotal.com/download.php?id=$1";

	if (!modified) {
		destUrl = filterUrl(destUrl, "http://www.divxtotal.com/([^/]+)/torrent/([0-9]+)/.+", "http://www.divxtotal.com/download.php?id=$2");
		modified = info.linkUrl != destUrl;
	}
	
	if (!modified) {
		destUrl = filterUrl(destUrl, "http://www.subtorrents.com/series/[^/]+/([0-9]+)/", "http://www.subtorrents.com/download.php?id=$1");
		modified = info.linkUrl != destUrl;
	}
	
	//directCopy(destUrl, "Text");

	var aria2 = new ARIA2(settings.rpcpath), params = {};
	//params.referer = tab.url;
	//params.header = "Cookie:" + response.pagecookie;
	aria2.addUri(destUrl, params);
	showNotification();
}

var id = chrome.contextMenus.create({"title": "Envia link a l'aria2c", "contexts":["link"], "onclick": genericOnClick});
