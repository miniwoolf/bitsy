/* BITSY SPECS */
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
var SCRIPT_SIZE = 1024;

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