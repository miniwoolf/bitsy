function HackOptionsTool() {
	console.log("it's alive!!!");

// this.bakeHacks = function(transpritesHackState, transpritesHackSetting)

}

// trans-prites hack
var transpritesHackState = true;
function toggleTransprites(e) {
	transpritesHackState = (e.target.checked);
	if (transpritesHackState) {
		document.getElementById('transpritesOptions').style.display = 'inline-flex';
		iconUtils.LoadIcon(document.getElementById("transpritesIcon"), "visibility");
	}
	else {
		document.getElementById('transpritesOptions').style.display = 'none';
		iconUtils.LoadIcon(document.getElementById("transpritesIcon"), "visibility_off");
	}
}

var transpritesHackSetting = "true";
function getTranspritesHackSetting() {
	transpritesHackSetting = document.getElementById("transprites_setting").value;
	Store.set('transprites_setting', transpritesHackSetting);
}

function resetHacksData() {
	var default_transparent_sprites_setting = "true";
	document.getElementById("transprites_setting").value = default_transparent_sprites_setting;
	Store.set('transprites_setting', document.getElementById("transprites_setting").value); // save settings
}

/* var style = document.createElement("style");
function hideScrollbar() {
	style.innerHTML = `body::-webkit-scrollbar {display: none;}`;
	document.head.appendChild(style);
	document.getElementById("option_scrollbar").innerHTML = "hidden";
	iconUtils.LoadIcon(document.getElementById("scrollbarIcon"), "visibility");
}

function showScrollbar() {
	style.innerHTML = `body::-webkit-scrollbar {display: auto;}`;
	document.head.appendChild(style);
	document.getElementById("option_scrollbar").innerHTML = "visible";
	iconUtils.LoadIcon(document.getElementById("scrollbarIcon"), "visibility_off");
}

var scrollbarShowing = true;
function toggleScrollbar(e) {
	scrollbarShowing = e.target.checked;
	if (scrollbarShowing) {
		showScrollbar();
	}
	else {
		hideScrollbar();
	}
} */