/* CONSTANTS */
var width = 128;
var height = 128;
var tilesize = 8;
var roomsize = 16;
var mapsize = 8;

var scale = 4;
var text_scale = scale / 2;

var DEFAULT_REGISTRY_SIZE = 256;
var MAP_REGISTRY_SIZE = 5;

var PALETTE_SIZE = 16;
var ANIMATION_SIZE = 4;

// todo : name ok?
var NULL_ID = "0"; // reserved for blank / default

var COLOR_INDEX = {
	TEXTBOX : 0,
	TEXT : 1,
	RAINBOW_START : 2,
	RAINBOW_END : 11,
	TRANSPARENT : 12,
	BACKGROUND : 13,
	TILE : 14,
	SPRITE : 15,
};

var WRITABLE_COLOR_START = COLOR_INDEX.BACKGROUND;
var ENABLE_COLOR_OVERRIDE = false;

/* KEYWORDS */
var TYPE_KEY = {
	PALETTE : "PAL",
	ROOM : "ROOM",
	MAP : "MAP",
	AVATAR : "AVA",
	TILE : "TIL",
	SPRITE : "SPR",
	ITEM : "ITM",
	EXIT : "EXT",
	ENDING : "END",
	DIALOG : "DLG",
	DEFAULT_FONT : "DEFAULT_FONT",
	TEXT_SCALE : "TEXT_SCALE",
	TEXT_DIRECTION : "TEXT_DIRECTION",
	FONT : "FONT",
};

var ARG_KEY = {
	NAME : "NAME",
	IS_WALL : "WAL",
	TRANSITION_EFFECT : "FX",
	TRANSITION_EFFECT_UP : "FXU",
	TRANSITION_EFFECT_DOWN : "FXD",
	TRANSITION_EFFECT_LEFT : "FXL",
	TRANSITION_EFFECT_RIGHT : "FXR",
	COLOR : "COL",
	BACKGROUND : "BGC",
	DIALOG_SCRIPT : "DLG",
	FRAME_TICK_SCRIPT : "TIK",
	KNOCK_INTO_SCRIPT : "NOK",
	BUTTON_DOWN_SCRIPT : "BTN",
	EXIT_DESTINATION : "OUT",
	LOCK : "LOK",
};

var BUTTON_KEY = {
	UP : "UP",
	DOWN : "DWN",
	LEFT : "LFT",
	RIGHT : "RGT",
	OKAY : "OK",
	// TODO: any others? or is this it?
	
	// stub for possible future cancel button -
	// I don't think I need it yet and it complicates touch controls,
	// but I might want it eventually
	// CANCEL : "X",
};

// move other symbol codes in here? SEQ? rename CURLY_KEY?
var SYM_KEY = {
	OPEN : "{",
	CLOSE : "}",
	DIALOG : ">>",
	ENTRY : ":",
	VARIABLE : "VAR",
};

var BOOL_KEY = {
	YES : "YES", // => TRUE
	NO : "NO", // => FALSE, NULL, NIL
};

var TRANSITION_KEY = {
	FADE_WHITE : "FDW",
	FADE_BLACK : "FDB",
	WAVE : "WVE",
	TUNNEL : "TNL",
	SLIDE_UP : "SLU",
	SLIDE_DOWN : "SLD",
	SLIDE_LEFT : "SLL",
	SLIDE_RIGHT : "SLR",
};

var FONT_KEY = {
	SIZE : "SIZE",
	CHARACTER_START : "CHAR",
	CHARACTER_SIZE : "CHAR_SIZE",
	CHARACTER_OFFSET : "CHAR_OFFSET",
	CHARACTER_SPACING : "CHAR_SPACING",
};

var TEXT_DIRECTION_KEY = {
	LEFT_TO_RIGHT : "LTR",
	RIGHT_TO_LEFT : "RTL",
};

var MISC_KEY = {
	COMMENT : "#",
	FLAG : "!",
	NEXT : ">",
};

// for back compat with old versions
var LEGACY_KEY = {
	ROOM : "SET",
	POSITION : "POS",
};

// todo : this is really big -- move into its own file?
// mapping for base256 IDs (modified version of unicode code page 437)
var ID_MAPPING = [
	// numbers:
	0x0030, // zero (empty square)
	0x0031, // one (filled square)
	0x0032,
	0x0033,
	0x0034,
	0x0035,
	0x0036,
	0x0037,
	0x0038,
	0x0039,	// lowercase letters:
	0x0061,
	0x0062,
	0x0063,
	0x0064,
	0x0065,
	0x0066,
	0x0067,
	0x0068,
	0x0069,
	0x006A,
	0x006B,
	0x006C,
	0x006D,
	0x006E,
	0x006F,
	0x0070,
	0x0071,
	0x0072,
	0x0073,
	0x0074,
	0x0075,
	0x0076,
	0x0077,
	0x0078,
	0x0079,
	0x007A,
	// uppercase letters:
	0x0041,
	0x0042,
	0x0043,
	0x0044,
	0x0045,
	0x0046,
	0x0047,
	0x0048,
	0x0049,
	0x004A,
	0x004B,
	0x004C,
	0x004D,
	0x004E,
	0x004F,
	0x0050,
	0x0051,
	0x0052,
	0x0053,
	0x0054,
	0x0055,
	0x0056,
	0x0057,
	0x0058,
	0x0059,
	0x005A,
	// @ (avatar):
	0x0040,
	// other symbols from page 437:
	0x263A, // row 0
	0x263B,
	0x2665,
	0x2666,
	0x2663,
	0x2660,
	0x2022,
	0x25D8,
	0x25CB,
	0x25D9,
	0x2642,
	0x2640,
	0x266A,
	0x266B,
	0x263C,
	0x25BA, // row 1
	0x25C4,
	0x2195,
	0x203C,
	0x00B6,
	0x00A7,
	0x25AC,
	0x21A8,
	0x2191,
	0x2193,
	0x2192,
	0x2190,
	0x221F,
	0x2194,
	0x25B2,
	0x25BC,
	0x0021, // row 2
	0x0022,
	0x0023,
	0x0024,
	0x0025,
	0x0026,
	0x0027,
	0x0028,
	0x0029,
	0x002A,
	0x002B,
	0x002C,
	0x002D,
	0x002E,
	0x002F,
	0x003A, // row 3
	0x003B,
	0x003C,
	0x003D,
	0x003E,
	0x003F,
	0x005B, // row 5
	0x005C,
	0x005D,
	0x005E,
	0x005F,
	0x0060, // row 6
	0x007B, // row 7
	0x007C,
	0x007D,
	0x007E,
	0x2302,
	0x00C7, // row 8
	0x00FC,
	0x00E9,
	0x00E2,
	0x00E4,
	0x00E0,
	0x00E5,
	0x00E7,
	0x00EA,
	0x00EB,
	0x00E8,
	0x00EF,
	0x00EE,
	0x00EC,
	0x00C4,
	0x00C5,
	0x00C9, // row 9
	0x00E6,
	0x00C6,
	0x00F4,
	0x00F6,
	0x00F2,
	0x00FB,
	0x00F9,
	0x00FF,
	0x00D6,
	0x00DC,
	0x00A2,
	0x00A3,
	0x00A5,
	0x20A7,
	0x0192,
	0x00E1, // row A
	0x00ED,
	0x00F3,
	0x00FA,
	0x00F1,
	0x00D1,
	0x00AA,
	0x00BA,
	0x00BF,
	0x2310,
	0x00AC,
	0x00BD,
	0x00BC,
	0x00A1,
	0x00AB,
	0x00BB,
	0x2591, // row B
	0x2592,
	0x2593,
	0x2502,
	0x2524,
	0x2561,
	0x2562,
	0x2556,
	0x2555,
	0x2563,
	0x2551,
	0x2557,
	0x255D,
	0x255C,
	0x255B,
	0x2510,
	0x2514, // row C
	0x2534,
	0x252C,
	0x251C,
	0x2500,
	0x253C,
	0x255E,
	0x255F,
	0x255A,
	0x2554,
	0x2569,
	0x2566,
	0x2560,
	0x2550,
	0x256C,
	0x2567,
	0x2568, // row D
	0x2564,
	0x2565,
	0x2559,
	0x2558,
	0x2552,
	0x2553,
	0x256B,
	0x256A,
	0x2518,
	0x250C,
	0x2588,
	0x2584,
	0x258C,
	0x2590,
	0x2580,
	0x03B1, // row E
	0x00DF,
	0x0393,
	0x03C0,
	0x03A3,
	0x03C3,
	0x00B5,
	0x03C4,
	0x03A6,
	0x0398,
	0x03A9,
	0x03B4,
	0x221E,
	0x03C6,
	0x03B5,
	0x2229,
	0x2261, // row F
	0x00B1,
	0x2265,
	0x2264,
	0x2320,
	0x2321,
	0x00F7,
	0x2248,
	0x00B0,
	0x2219,
	0x00B7,
	0x221A,
	0x207F,
	0x00B2,
	0x25A0,
	// misc extra:
	0x0259, // schwa
	0x2020, // dagger
	0x00D8, // O with slash
];

var ID_MAPPING_REVERSE = {};

// todo : init in function?
for (var i = 0; i < ID_MAPPING.length; i++) {
	ID_MAPPING_REVERSE[String.fromCharCode(ID_MAPPING[i])] = i;
}

function debugPrintIdMapping() {
	for (var i = 0; i < ID_MAPPING.length; i++) {
		var priorIndex = ID_MAPPING.indexOf(ID_MAPPING[i]);

		console.log(
			(i).toString().padStart(3, "0") + " :: " + 
			toB256(i) + " :: " + 
			ID_MAPPING[i].toString(16).toUpperCase().padStart(4, "0") +
			(priorIndex != i ? " !! " + priorIndex + " !!" : ""));
	}
}

function debugPrintIdGrid() {
	var grid = "";
	for (var i = 0; i < roomsize; i++) {
		var row = "";
		for (var j = 0; j < roomsize; j++) {
			row += toB256((i*roomsize)+j);
		}
		row += "\n";
		grid += row;
	}
	console.log(grid);
}

function toB256(num) {
	var str = "";
	var place = 0;
	var i = (num >> (8 * place)) & 255;

	str += String.fromCharCode(ID_MAPPING[i]);
	num -= (i << (8 * place));

	while (num > 0) {
		place++;
		i = (num >> (8 * place)) & 255;
		str = String.fromCharCode(ID_MAPPING[i]) + str;
		num -= (i << (8 * place));
	}

	return str;
}

function fromB256(str) {
	var num = 0;

	for (var i = str.length - 1; i >= 0; i--) {
		var place = (str.length - 1) - i;
		num += ID_MAPPING_REVERSE[str[i]] * Math.pow(256, place);
	}

	return num;
}

function nextB256Id(objectRegistry, min, max) {
	var id = null;
	var index = min;

	while (id === null && (max === null || index < max)) {
		var str = toB256(index);
		if (!(str in objectRegistry)) {
			id = str;
		}

		index++;
	}

	return id;
}