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
	}
	else {
		document.getElementById('transpritesOptions').style.display = 'none';
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

