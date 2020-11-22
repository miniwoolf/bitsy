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
	DIALOG_SCRIPT : TYPE_KEY.DLG,
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
	SEQUENCE : "SEQ",
	CYCLE : "CYC",
	SHUFFLE : "SHF",
	CHOICE : "PIK",
	CONDITIONAL : "IF",
	FUNCTION : "FN",
	VARIABLE : "VAR",
	ASSIGN : "SET",
	TABLE : "TBL",
	ENTRY : ":",
};

var BOOL_KEY = {
	YES : "YES", // => TRUE
	NO : "NO", // => FALSE, NULL, NIL
};

// some standard variable / entry names
var ENTRY_KEY = {
	THIS_SPRITE : "THIS",
	SPRITE_TYPE : "TYPE",
	SPRITE_ID : "ID",
	SPRITE_NAME : ARG_KEY.NAME,
	SPRITE_X : "X",
	SPRITE_Y : "Y",
	SPRITE_TILE_ID : TYPE_KEY.TILE,
	SPRITE_BACKGROUND : ARG_KEY.BACKGROUND,
	SPRITE_COLOR : ARG_KEY.COLOR,
	SPRITE_WALL : ARG_KEY.IS_WALL,
	SPRITE_LOCKED : ARG_KEY.LOCK,
};

var DEBUG_KEY = {
	ERROR : "ERR",
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
	SEPARATOR : ",",
};