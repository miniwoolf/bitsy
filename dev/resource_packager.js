var fs = require("fs");

/* NOTE: this is made to deal with text files. if you add binaries to it,
 * it WILL break! */
var resourceFiles = [
	/* localization */
	"resources/localization.tsv",
	/* bitsy game data */
	"resources/defaultGameData.bitsy",
	/* bitsy fonts */
	"resources/bitsyfont/ascii_small.bitsyfont",
	"resources/bitsyfont/unicode_european_small.bitsyfont",
	"resources/bitsyfont/unicode_european_large.bitsyfont",
	"resources/bitsyfont/unicode_asian.bitsyfont",
	"resources/bitsyfont/arabic.bitsyfont",
	"resources/bitsyfont/itsy_bitsy.bitsyfont",
	/* export */
	"resources/export/exportTemplate.html",
	"resources/export/exportStyleFixed.css",
	"resources/export/exportStyleFull.css",
	/* engine scripts */
	"../editor/script/engine/system.js",
	"../editor/script/engine/bitsy.js",
	"../editor/script/engine/font.js",
	"../editor/script/engine/dialog.js",
	"../editor/script/engine/script.js",
	"../editor/script/engine/renderer.js",
	"../editor/script/engine/transition.js",
		/* hacks */
	"../editor/script/engine/transparent-sprites.js",
	"../editor/script/engine/long-dialog.js",
];

var resourceDirectories = [
  "resources/icons",
];

var resourcePackage = {};

// console.log(resourcePackage);

var str = JSON.stringify(resourcePackage, null, 2);

function fixCRLR() {
	str = str.replace(/\\r\\n/g, '\\n');
	return str;
}

fixCRLR();

// console.log(str);

var resourceJavascriptFile = "var Resources = " + str + ";";

// console.log(resourceJavascriptFile);

fs.writeFile("../editor/script/generated/resources.js", resourceJavascriptFile, function () {});

// console.log(resourcePackage);

console.log("done!");
