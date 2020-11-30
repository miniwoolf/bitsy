/* TODO
	- decrease some of the global-ness?
		- for example: pass in a game data holder?
*/

function Parser() {

this.ParseWorld = parseWorld;

this.SerializeWorld = serializeWorld;

function parseWorld(file) {
	resetFlags();

	var versionNumber = 0;

	// flags to keep track of which compatibility conversions
	// need to be applied to this game data
	var compatibilityFlags = {
		convertSayToPrint : false,
		combineEndingsWithDialog : false,
		convertImplicitSpriteDialogIds : false,
	};

	var tileTypes = [
		TYPE_KEY.AVATAR,
		TYPE_KEY.TILE,
		TYPE_KEY.SPRITE,
		TYPE_KEY.ITEM,
		TYPE_KEY.EXIT,
		TYPE_KEY.ENDING,
	];

	var lines = file.split("\n");
	var i = 0;
	while (i < lines.length) {
		var curLine = lines[i];

		// console.log(lines[i]);

		if (i == 0) {
			i = parseTitle(lines, i);
		}
		else if (curLine.length <= 0 || curLine.charAt(0) === MISC_KEY.COMMENT) {
			// collect version number (from a comment.. hacky I know)
			var bitsyVersionComment = MISC_KEY.COMMENT + " BITSY VERSION ";
			if (curLine.indexOf(bitsyVersionComment) != -1) {
				versionNumber = parseFloat(curLine.replace(bitsyVersionComment, ""));

				if (versionNumber < 5.0) {
					compatibilityFlags.convertSayToPrint = true;
				}

				if (versionNumber < 7.0) {
					compatibilityFlags.combineEndingsWithDialog = true;
					compatibilityFlags.convertImplicitSpriteDialogIds = true;
				}
			}

			//skip blank lines & comments
			i++;
		}
		else if (getType(curLine) == TYPE_KEY.PALETTE) {
			i = parsePalette(lines, i);
		}
		else if (getType(curLine) === TYPE_KEY.ROOM || getType(curLine) === LEGACY_KEY.ROOM) {
			i = parseRoom(lines, i, compatibilityFlags);
		}
		else if (getType(curLine) === TYPE_KEY.MAP) {
			i = parseMap(lines, i);
		}
		// TODO : do I need to do anything about detecting END-as-dialog vs END-as-object???
		else if (tileTypes.indexOf(getType(curLine)) != -1) {
			i = parseTile(lines, i, getType(curLine));
		}
		else if (getType(curLine) === TYPE_KEY.DIALOG) {
			i = parseDialog(lines, i, compatibilityFlags);
		}
		else if (getType(curLine) === TYPE_KEY.ENDING && compatibilityFlags.combineEndingsWithDialog) {
			// parse endings for back compat
			i = parseEnding(lines, i, compatibilityFlags);
		}
		else if (getType(curLine) === TYPE_KEY.SCRIPT) {
			i = parseFunctionScript(lines, i);
		}
		else if (getType(curLine) === CURLICUE_KEY.VARIABLE) {
			i = parseVariable(lines, i);
		}
		else if (getType(curLine) === TYPE_KEY.DEFAULT_FONT) {
			i = parseFontName(lines, i);
		}
		else if (getType(curLine) === TYPE_KEY.TEXT_DIRECTION) {
			i = parseTextDirection(lines, i);
		}
		else if (getType(curLine) === TYPE_KEY.FONT) {
			i = parseFontData(lines, i);
		}
		else if (getType(curLine) === MISC_KEY.FLAG) {
			i = parseFlag(lines, i);
		}
		else {
			i++;
		}
	}

	// scriptCompatibility(compatibilityFlags);

	curRoom = sortedIdList(room)[0];

	return versionNumber;
}

// TODO : rewrite
function scriptCompatibility(compatibilityFlags) {
	// if (compatibilityFlags.convertSayToPrint) {
	// 	console.log("CONVERT SAY TO PRINT!");

	// 	var PrintFunctionVisitor = function() {
	// 		var didChange = false;
	// 		this.DidChange = function() { return didChange; };

	// 		this.Visit = function(node) {
	// 			if (node.type != "function") {
	// 				return;
	// 			}

	// 			if (node.name === "say") {
	// 				node.name = "print";
	// 				didChange = true;
	// 			}
	// 		};
	// 	};

	// 	for (dlgId in dialog) {
	// 		var dialogScript = scriptInterpreter.Parse(dialog[dlgId].src);
	// 		var visitor = new PrintFunctionVisitor();
	// 		dialogScript.VisitAll(visitor);
	// 		if (visitor.DidChange()) {
	// 			var newDialog = dialogScript.Serialize();
	// 			if (newDialog.indexOf("\n") > -1) {
	// 				newDialog = '"""\n' + newDialog + '\n"""';
	// 			}
	// 			dialog[dlgId].src = newDialog;
	// 		}
	// 	}
	// }
}

/* ARGUMENT GETTERS */
function getType(line) {
	return getArg(line,0);
}

function getId(line) {
	return getArg(line,1);
}

function getArg(line, arg) {
	return line.split(" ")[arg];
}

function tryGetArg(line, arg) {
	var lineArgs = line.split(" ");

	if (lineArgs.length > arg) {
		return lineArgs[arg];
	}
	else {
		return null;
	}
}

function getCoord(line, arg) {
	return getArg(line, arg).split(LEGACY_KEY.SEPARATOR);
}

function parseTitle(lines, i) {
	return parseScript(lines, i, { id: titleId, });
}

function parsePalette(lines, i) { //todo this has to go first right now :(
	var id = getId(lines[i]);
	i++;

	var colors = [];
	var name = null;

	var maxWritablePaletteSize = (PALETTE_SIZE ? (PALETTE_SIZE - WRITABLE_COLOR_START) : PALETTE_SIZE);

	while (i < lines.length && lines[i].length > 0) { //look for empty line
		var args = lines[i].split(" ");

		if (args[0] === ARG_KEY.NAME) {
			name = lines[i].split(/\s(.+)/)[1];
		}
		else if (flags.PAL_FORMAT === 0) {
			var col = [];

			lines[i].split(LEGACY_KEY.SEPARATOR).forEach(function(i) {
				col.push(parseInt(i));
			});

			if (maxWritablePaletteSize === null || colors.length < maxWritablePaletteSize) {
				colors.push(col);
			}
		}
		else if (flags.PAL_FORMAT === 1) {
			if (maxWritablePaletteSize === null || colors.length < maxWritablePaletteSize) {
				colors.push(fromHex(lines[i]));
			}
		}

		i++;
	}

	palette[id] = createPalette(id, name, colors);

	return i;
}

function parseRoom(lines, i, compatibilityFlags) {
	var id = getId(lines[i]);
	room[id] = createRoom(id);
	i++;

	// create tile map
	if (flags.ROOM_FORMAT == 0) {
		// single char tile ids, no commas
		var end = i + roomsize;
		var y = 0;
		for (; i < end; i++) {
			for (x = 0; x < roomsize; x++) {
				room[id].tilemap[y][x] = lines[i].charAt(x);
			}

			y++;
		}
	}
	else if (flags.ROOM_FORMAT == 1) {
		// multiple char tile ids, comma separated
		var end = i + roomsize;
		var y = 0;
		for (; i < end; i++) {
			var lineSep = lines[i].split(LEGACY_KEY.SEPARATOR);
			for (x = 0; x < roomsize; x++) {
				room[id].tilemap[y][x] = lineSep[x];
			}

			y++;
		}
	}

	while (i < lines.length && lines[i].length > 0) { //look for empty line
		/* NAME */
		if (getType(lines[i]) === ARG_KEY.NAME) {
			var name = lines[i].split(/\s(.+)/)[1];
			room[id].name = name;
		}
		/* PALETTE */
		else if (getType(lines[i]) === TYPE_KEY.PALETTE) {
			room[id].pal = getId(lines[i]);
		}
		/* ADDITIONAL TILES & SPRITES */
		else if (getType(lines[i]) === TYPE_KEY.TILE) {
			// todo : does this work the way I want?
			var tileId = getId(lines[i]);
			var tileX = parseInt(getArg(lines[i], 2));
			var tileY = parseInt(getArg(lines[i], 3));
			room[id].tileOverlay.push(createSpriteLocation(tileId, tileX, tileY));
		}
		// LEGACY SPRITE AND ITEM // TODO : only allow for old files?
		else if (getType(lines[i]) === TYPE_KEY.SPRITE || getType(lines[i]) === TYPE_KEY.ITEM) {
			var sprId = getId(lines[i]);
			var sprCoord = lines[i].split(" ")[2].split(LEGACY_KEY.SEPARATOR);
			var sprLocation = createSpriteLocation(sprId, parseInt(sprCoord[0]), parseInt(sprCoord[1]));
			room[id].tileOverlay.push(sprLocation);

			// TODO : do I need to support reading in the old "find and replace" sprite format for back compat?
		}
		// LEGACY WALLS
		else if (getType(lines[i]) === ARG_KEY.IS_WALL) {
			/* DEFINE COLLISIONS (WALLS) */
			// TODO : remove this deprecated feature at some point
			room[id].walls = getId(lines[i]).split(LEGACY_KEY.SEPARATOR);
		}
		// LEGACY EXITS
		else if (getType(lines[i]) === TYPE_KEY.EXIT) {
			/* ADD EXIT */
			var exitArgs = lines[i].split(" ");
			//arg format: EXT 10,5 M 3,2
			var exitCoords = exitArgs[1].split(LEGACY_KEY.SEPARATOR);
			var destName = exitArgs[2];
			var destCoords = exitArgs[3].split(LEGACY_KEY.SEPARATOR);
			var ext = {
				x : parseInt(exitCoords[0]),
				y : parseInt(exitCoords[1]),
				dest : {
					room : destName,
					x : parseInt(destCoords[0]),
					y : parseInt(destCoords[1])
				},
				transition_effect : null,
				dlg: null,
			};

			// optional arguments
			var exitArgIndex = 4;
			while (exitArgIndex < exitArgs.length) {
				if (exitArgs[exitArgIndex] == ARG_KEY.TRANSITION_EFFECT) {
					ext.transition_effect = exitArgs[exitArgIndex+1];
					exitArgIndex += 2;
				}
				else if (exitArgs[exitArgIndex] == TYPE_KEY.DIALOG) {
					ext.dlg = exitArgs[exitArgIndex+1];
					exitArgIndex += 2;
				}
				else {
					exitArgIndex += 1;
				}
			}

			// TODO : back compat
		}
		// LEGACY ENDINGS
		else if (getType(lines[i]) === TYPE_KEY.ENDING) {
			/* ADD ENDING */
			var endId = getId(lines[i]);

			// compatibility with when endings were stored separate from other dialog
			if (compatibilityFlags.combineEndingsWithDialog) {
				endId = "end_" + endId;
			}

			var endCoords = getCoord(lines[i], 2);
			var end = {
				id : endId,
				x : parseInt(endCoords[0]),
				y : parseInt(endCoords[1]),
			};

			// TODO : back compat
		}

		i++;
	}

	return i;
}

function parseMap(lines, i) {
	var id = getId(lines[i]);
	map[id] = createMap(id);
	i++;

	var end = i + mapsize;
	var y = 0;

	for (; i < end; i++) {
		for (x = 0; x < mapsize; x++) {
			var roomId = lines[i][x];
			map[id].map[y][x] = roomId;

			// NOTE: assumes rooms already exist!
			if (roomId != NULL_ID) {
				room[roomId].mapLocation.id = id;
				room[roomId].mapLocation.x = x;
				room[roomId].mapLocation.y = y;
			}
		}

		y++;
	}

	while (i < lines.length && lines[i].length > 0) { // look for empty line
		if (getType(lines[i]) === ARG_KEY.TRANSITION_EFFECT_UP) {
			map[id].transition_effect_up = getId(lines[i]);
		}
		else if (getType(lines[i]) === ARG_KEY.TRANSITION_EFFECT_DOWN) {
			map[id].transition_effect_down = getId(lines[i]);
		}
		else if (getType(lines[i]) === ARG_KEY.TRANSITION_EFFECT_LEFT) {
			map[id].transition_effect_left = getId(lines[i]);
		}
		else if (getType(lines[i]) === ARG_KEY.TRANSITION_EFFECT_RIGHT) {
			map[id].transition_effect_right = getId(lines[i]);
		}
		else if (getType(lines[i]) === ARG_KEY.NAME) {
			var name = lines[i].split(/\s(.+)/)[1]; // todo : make helper function?
			map[id].name = name;
			// TODO : add to global name registry?
		}

		i++;
	}

	return i;
}

function isColorIndexInValidRange(index) {
	return (index >= WRITABLE_COLOR_START) && (PALETTE_SIZE === null || index < PALETTE_SIZE);
}

function parseTile(lines, i, type) {
	var id = getId(lines[i]);
	i++;

	var options = {};

	// parse drawing
	var drawingResult = parseDrawing(lines, i);
	i = drawingResult.i;
	options.drawingData = drawingResult.drawingData;

	// todo : how do we handle back compat for SPR A?
	var isPlayer = (type === TYPE_KEY.AVATAR) && playerId === null;

	if (isPlayer) {
		playerId = id;
		type = TYPE_KEY.AVATAR;
		options.inventory = {};
	}

	// turn extra avatars into sprites
	if (!isPlayer && (type === TYPE_KEY.AVATAR)) {
		type === TYPE_KEY.SPRITE;
	}

	// background tiles are restricted from several properties
	var isNotBackgroundTile = (type != TYPE_KEY.TILE);

	// read all other properties
	while (i < lines.length && lines[i].length > 0) { // stop at empty line
		if (getType(lines[i]) === ARG_KEY.NAME) {
			/* NAME */
			options.name = lines[i].split(/\s(.+)/)[1];
		}
		else if (getType(lines[i]) === ARG_KEY.COLOR) {
			if (ENABLE_COLOR_OVERRIDE) {
				/* COLOR OFFSET INDEX */
				var colorIndexOffset = parseInt(getId(lines[i]));
				var colorIndex = COLOR_INDEX.BACKGROUND + colorIndexOffset;
				if (isColorIndexInValidRange(colorIndex)) {
					options.col = colorIndexOffset;
				}
			}
		}
		else if (getType(lines[i]) === ARG_KEY.BACKGROUND) {
			if (ENABLE_COLOR_OVERRIDE) {
				/* BACKGROUND COLOR OFFSET INDEX */
				var colorIndexOffset = parseInt(getId(lines[i]));
				var colorIndex = COLOR_INDEX.BACKGROUND + colorIndexOffset;
				if (isColorIndexInValidRange(colorIndex)) {
					options.bgc = colorIndexOffset;
				}
			}
		}
		else if (getType(lines[i]) === ARG_KEY.IS_WALL && type === TYPE_KEY.TILE) {
			// only tiles set their initial collision mode
			var wallArg = getArg(lines[i], 1);
			if (wallArg === BOOL_KEY.YES) {
				options.isWall = true;
			}
			else if (wallArg === BOOL_KEY.NO) {
				options.isWall = false;
			}
		}
		else if (getType(lines[i]) === ARG_KEY.DIALOG_SCRIPT && isNotBackgroundTile) {
			options.dlg = getId(lines[i]);
		}
		else if (getType(lines[i]) === ARG_KEY.FRAME_TICK_SCRIPT && isNotBackgroundTile) {
			options.tickDlgId = getId(lines[i]);
		}
		else if (getType(lines[i]) === ARG_KEY.KNOCK_INTO_SCRIPT && isNotBackgroundTile) {
			options.knockDlgId = getId(lines[i]);
		}
		else if (getType(lines[i]) === ARG_KEY.BUTTON_DOWN_SCRIPT && isNotBackgroundTile) {
			options.buttonDownDlgId = getId(lines[i]);
		}
		else if (getType(lines[i]) === LEGACY_KEY.POSITION && type === TYPE_KEY.SPRITE) {
			/* STARTING POSITION */
			// NOTE: I still need this to read in old unique position data from sprites
			var posArgs = lines[i].split(" ");
			var roomId = posArgs[1];
			var coordArgs = posArgs[2].split(LEGACY_KEY.SEPARATOR);

			// NOTE: assumes rooms have all been created!
			room[roomId].tileOverlay.push(
				createSpriteLocation(
					id,
					parseInt(coordArgs[0]),
					parseInt(coordArgs[1])));
		}
		else if (getType(lines[i]) === TYPE_KEY.ITEM && isPlayer) {
			/* ITEM STARTING INVENTORY */
			// TODO: This is only used by the player avatar -- should I move it out of sprite data?
			var itemId = getId(lines[i]);
			var itemCount = parseFloat(getArg(lines[i], 2));
			options.inventory[itemId] = itemCount;
		}
		else if (getType(lines[i]) === ARG_KEY.EXIT_DESTINATION && type === TYPE_KEY.EXIT) {
			// TODO : maintain the same format as before with the comma seperation?
			options.destRoom = getId(lines[i]);
			options.destX = parseInt(getArg(lines[i], 2));
			options.destY = parseInt(getArg(lines[i], 3));
		}
		else if (getType(lines[i]) === ARG_KEY.TRANSITION_EFFECT && type === TYPE_KEY.EXIT) {
			options.transition_effect = getId(lines[i]);
		}
		else if (getType(lines[i]) === ARG_KEY.LOCK && (type === TYPE_KEY.EXIT || type === TYPE_KEY.ENDING)) {
			options.lockItem = getId(lines[i]);
		}

		i++;
	}

	createTile(id, type, options);

	return i;
}

function parseDrawing(lines, i) {
	var frameList = []; // init list of frames
	var curFrame = createGrid(tilesize, 0); // init first frame

	var y = 0;

	// use first row to detect input tile size (must be square)
	var inputTileSize = lines[i].length;
	// console.log(inputTileSize);

	while (y < inputTileSize) {
		var l = lines[i + y];

		for (x = 0; x < inputTileSize; x++) {
			if (x < tilesize && y < tilesize) {
				curFrame[y][x] = parseInt(l.charAt(x));
			}
		}

		y++;

		if (y === inputTileSize) {
			if (ANIMATION_SIZE === null || frameList.length < ANIMATION_SIZE) {
				frameList.push(curFrame);
			}

			i = i + y;

			if (lines[i] != undefined && lines[i].charAt(0) === MISC_KEY.NEXT) {
				// start next frame!
				curFrame = createGrid(tilesize, 0);

				//start the count over again for the next frame
				i++;

				y = 0;
			}
		}
	}

	return { i: i, drawingData: frameList };
}

function parseScript(lines, i, options) {
	var backCompatPrefix = options && options.backCompatPrefix ? options.backCompatPrefix : "";
	var convertImplicitSpriteDialogIds = options && options.convertImplicitSpriteDialogIds;

	var id = null;

	if (options && options.id) {
		id = options.id;
	}
	else {
		id = getId(lines[i]);
		i++;
	}

	var type = ScriptType.Dialog;
	if (options && options.type) {
		type = options.type;
	}

	id = backCompatPrefix + id;

	var dialogStart = CURLICUE_KEY.OPEN + CURLICUE_KEY.DIALOG;
	var functionStart = CURLICUE_KEY.OPEN + CURLICUE_KEY.FUNCTION;

	var script = "";

	var startsWithDialogExpression = (type === ScriptType.Dialog)
		&& (lines[i].length >= 3) && (lines[i].indexOf(dialogStart) === 0);

	var startsWithFunctionDefinition = (type === ScriptType.Function)
		&& (lines[i].length >= 3) && (lines[i].indexOf(functionStart) === 0);

	if (startsWithDialogExpression || startsWithFunctionDefinition) {
		// multi-line script
		// TODO : handle strings inside quotes
		script += lines[i][0];
		var bracesCount = 1;
		var charIndex = 1;

		while (bracesCount > 0) {
			if (charIndex >= lines[i].length) {
				script += "\n";
				i++;
				charIndex = 0;
			}
			else {
				script += lines[i][charIndex];

				if (lines[i][charIndex] === CURLICUE_KEY.OPEN) {
					bracesCount++;
				}
				else if (lines[i][charIndex] === CURLICUE_KEY.CLOSE) {
					bracesCount--;
				}

				charIndex++;
			}
		}
	}
	else if (type === ScriptType.Dialog) {
		// single line dialog script
		script += lines[i];
	}
	else {
		// oh no!
	}

	i++;

	dialog[id] = createScript(id, null, script, type);

	if (convertImplicitSpriteDialogIds) {
		// explicitly hook up dialog that used to be implicitly
		// connected by sharing sprite and dialog IDs in old versions
		if (tile[id] && tile[id].type === TYPE_KEY.SPRITE) {
			if (tile[id].dlg === undefined || tile[id].dlg === null) {
				tile[id].dlg = id;
			}
		}
	}

	return i;
}

function parseDialog(lines, i, compatibilityFlags) {
	// hacky but I need to store this so I can set the name below
	var id = getId(lines[i]);

	var options = { convertImplicitSpriteDialogIds: compatibilityFlags.convertImplicitSpriteDialogIds, };
	i = parseScript(lines, i, options);

	if (lines[i].length > 0 && getType(lines[i]) === ARG_KEY.NAME) {
		dialog[id].name = lines[i].split(/\s(.+)/)[1]; // TODO : hacky to keep copying this regex around...
		i++;
	}

	return i;
}

// keeping this around to parse old files where endings were separate from dialogs
function parseEnding(lines, i, compatibilityFlags) {
	var options = {
		backCompatPrefix: "end_",
		convertImplicitSpriteDialogIds: compatibilityFlags.convertImplicitSpriteDialogIds,
	};

	// todo : need to read in names for back compat?

	return parseScript(lines, i, options);
}

function parseFunctionScript(lines, i) {
	var id = getId(lines[i]);

	i = parseScript(lines, i, { type: ScriptType.Function, });

	if (lines[i].length > 0 && getType(lines[i]) === ARG_KEY.NAME) {
		dialog[id].name = lines[i].split(/\s(.+)/)[1]; // TODO : hacky to keep copying this regex around...
		i++;
	}

	return i;
}

function parseVariable(lines, i) {
	var id = getId(lines[i]);
	i++;
	var value = scriptInterpreter.ParseValue(lines[i]);
	i++;
	variable[id] = value;
	return i;
}

function parseFontName(lines, i) {
	fontName = getArg(lines[i], 1);
	i++;
	return i;
}

// TODO : WIP
// function parseTextScale(lines, i) {
// 	var scaleFlag = getArg(lines[i], 1);

// 	if (scaleFlag === "1") {
// 		// 1x scale
// 		text_scale = scale;
// 	}
// 	else if (scaleFlag === "2") {
// 		// 2x scale
// 		text_scale = scale / 2; // NOTE: assumes scale is an even number
// 	}

// 	i++;
// 	return i;
// }

function parseTextDirection(lines, i) {
	textDirection = getArg(lines[i], 1);
	i++;
	return i;
}

function parseFontData(lines, i) {
	// NOTE : we're not doing the actual parsing here --
	// just grabbing the block of text that represents the font
	// and giving it to the font manager to use later

	var localFontName = getId(lines[i]);
	var localFontData = lines[i];
	i++;

	while (i < lines.length && lines[i] != "") {
		localFontData += "\n" + lines[i];
		i++;
	}

	var localFontFilename = localFontName + fontManager.GetExtension();
	fontManager.AddResource(localFontFilename, localFontData);

	return i;
}

function parseFlag(lines, i) {
	var id = getId(lines[i]);
	var valStr = lines[i].split(" ")[2];
	flags[id] = parseInt(valStr);

	// handle secret flags
	if (id === SECRET_KEY.INFINITE_MEMORY && flags[id] != 0) {
		DEFAULT_REGISTRY_SIZE = null;
		MAP_REGISTRY_SIZE = null;
	}

	if (id === SECRET_KEY.SUPER_PALETTE && flags[id] != 0) {
		PALETTE_SIZE = null;
	}

	if (id === SECRET_KEY.SUPER_ANIMATION && flags[id] != 0) {
		ANIMATION_SIZE = null;
	}

	if (id === SECRET_KEY.SUPER_COLOR && flags[id] != 0) {
		ENABLE_COLOR_OVERRIDE = true;
	}

	if (id === SECRET_KEY.SECRET_COLOR && flags[id] != 0) {
		WRITABLE_COLOR_START = COLOR_INDEX.TEXTBOX;
	}

	if (id === SECRET_KEY.SUPER_SCRIPT && flags[id] != 0) {
		SCRIPT_SIZE = null;
	}

	i++;

	return i;
}

//TODO this is in progress and doesn't support all features
function serializeWorld(skipFonts) {
	if (skipFonts === undefined || skipFonts === null) {
		skipFonts = false;
	}

	flags.PAL_FORMAT = 1; // new default format (hex)

	var worldStr = "";

	/* TITLE */
	var titleStr = getTitle();
	var titleScriptRoot = scriptInterpreter.Parse(titleStr, DialogWrapMode.No);
	var titleFlat = scriptInterpreter.SerializeFlat(titleScriptRoot);
	var titleCharCount = titleFlat.length;

	if (SCRIPT_SIZE === null || titleCharCount <= SCRIPT_SIZE) {
		worldStr += titleStr + "\n";
	}
	else {
		worldStr += "\n";
	}

	worldStr += "\n";

	/* VERSION */
	worldStr += MISC_KEY.COMMENT + " BITSY VERSION " + getEngineVersion() + "\n"; // add version as a comment for debugging purposes
	if (version.devBuildPhase != "RELEASE") {
		worldStr += MISC_KEY.COMMENT + " DEVELOPMENT BUILD -- " + version.devBuildPhase;
	}
	worldStr += "\n";

	/* FLAGS */
	for (f in flags) {
		worldStr += MISC_KEY.FLAG + " " + f + " " + flags[f] + "\n";
	}
	worldStr += "\n";

	/* TEXT SETTINGS */
	if (fontName != defaultFontName) {
		worldStr += TYPE_KEY.DEFAULT_FONT + " " + fontName + "\n";
		worldStr += "\n";
	}

	if (textDirection != TEXT_DIRECTION_KEY.LEFT_TO_RIGHT) {
		worldStr += TYPE_KEY.TEXT_DIRECTION + " " + textDirection + "\n";
		worldStr += "\n";
	}

	/* PALETTE */
	var paletteIdList = sortedIdList(palette);
	// NOTE: The -1 is because we don't store the entry at "0"
	var paletteCount = DEFAULT_REGISTRY_SIZE ? Math.min(DEFAULT_REGISTRY_SIZE - 1, paletteIdList.length) : paletteIdList.length;
	for (var i = 0; i < paletteCount; i++) {
		var id = paletteIdList[i];

		if (id === NULL_ID) {
			continue;
		}

		worldStr += serializePalette(id) + "\n";
	}

	/* ROOM */
	var roomIdList = sortedIdList(room);
	var roomCount = DEFAULT_REGISTRY_SIZE ? Math.min(DEFAULT_REGISTRY_SIZE - 1, roomIdList.length) : roomIdList.length;
	for (var i = 0; i < roomCount; i++) {
		var id = roomIdList[i];

		if (id === NULL_ID) {
			continue;
		}

		worldStr += serializeRoom(id) + "\n";
	}

	/* MAP */
	var mapIdList = sortedIdList(map);
	var mapCount = MAP_REGISTRY_SIZE ? Math.min(MAP_REGISTRY_SIZE - 1, mapIdList.length) : mapIdList.length;
	for (var i = 0; i < mapCount; i++) {
		var id = mapIdList[i];

		if (id === NULL_ID) {
			continue;
		}

		worldStr += serializeMap(id) + "\n";
	}

	/* TILES */
	var tileIdList = sortedIdList(tile);
	var tileCount = DEFAULT_REGISTRY_SIZE ? Math.min(DEFAULT_REGISTRY_SIZE - 1, tileIdList.length) : tileIdList.length;
	console.log("SERIALIZE TILES " + tileCount);
	for (var i = 0; i < tileCount; i++) {
		var id = tileIdList[i];

		if (id === NULL_ID) {
			continue;
		}

		worldStr += serializeTile(id) + "\n";
	}

	/* SCRIPTS */
	var scriptIdList = sortedIdList(dialog);
	var scriptCount = DEFAULT_REGISTRY_SIZE ? Math.min(DEFAULT_REGISTRY_SIZE, scriptIdList.length) : scriptIdList.length;
	for (var i = 0; i < scriptCount; i++) {
		var id = scriptIdList[i];

		if (id === NULL_ID) {
			continue;
		}

		var scriptRoot = scriptInterpreter.Parse(dialog[id].src, DialogWrapMode.No);
		var scriptFlat = scriptInterpreter.SerializeFlat(scriptRoot);
		var charCount = scriptFlat.length;

		if (SCRIPT_SIZE === null || charCount <= SCRIPT_SIZE) {
			worldStr += dialog[id].type + " " + id + "\n";
			worldStr += dialog[id].src + "\n";

			if (dialog[id].name != null) {
				worldStr += ARG_KEY.NAME + " " + dialog[id].name + "\n";
			}

			worldStr += "\n";
		}
	}

	/* VARIABLES */
	for (id in variable) {
		worldStr += CURLICUE_KEY.VARIABLE + " " + id + "\n";
		worldStr += variable[id] + "\n";
		worldStr += "\n";
	}

	/* FONT */
	// TODO : support multiple fonts
	if (fontName != defaultFontName && !skipFonts) {
		worldStr += fontManager.GetData(fontName);
	}

	return worldStr;
}

function serializePalette(id) {
	var out = "";

	out += TYPE_KEY.PALETTE + " " + id + "\n";

	var maxWritablePaletteSize = (PALETTE_SIZE ? (PALETTE_SIZE - WRITABLE_COLOR_START) : PALETTE_SIZE);

	var paletteSize = maxWritablePaletteSize ?
		Math.min(maxWritablePaletteSize, palette[id].colors.length) : palette[id].colors.length;

	for (var i = 0; i < paletteSize; i++) {
		var clr = palette[id].colors[i];
		out += toHex(clr) + "\n";
	}

	if (paletteSize < 3) {
		for (var i = 0; i < (3 - paletteSize); i++) {
			out += toHex([0, 0, 0]) + "\n";
		}
	}

	if (palette[id].name != null) {
		out += ARG_KEY.NAME + " " + palette[id].name + "\n";
	}

	return out;
}

function serializeRoom(id) {
	var out = "";

	out += TYPE_KEY.ROOM + " " + id + "\n";

	// make tilemap and overlay consistent
	var tilemap = createGrid(roomsize);
	var tileOverlay = []; // for extra tiles/sprites that don't fit in the grid

	for (var i = 0; i < roomsize; i++) {
		for (var j = 0; j < roomsize; j++) {
			var tileId = room[id].tilemap[i][j];
			var isIdShortEnough = (tileId.length <= 1 || flags.ROOM_FORMAT === 1);

			if (isIdShortEnough) {
				tilemap[i][j] = tileId;
			}
			else {
				tileOverlay.push({ x: j, y: i, id: tileId, });
			}
		}
	}

	for (var i = 0; i < room[id].tileOverlay.length; i++) {
		var tileLocation = room[id].tileOverlay[i];
		var isTileEmpty = (tilemap[tileLocation.y][tileLocation.x] === NULL_ID);
		var isIdShortEnough = (tileLocation.id.length <= 1 || flags.ROOM_FORMAT === 1);

		if (isTileEmpty && isIdShortEnough) {
			tilemap[tileLocation.y][tileLocation.x] = tileLocation.id;
		}
		else {
			tileOverlay.push({ x: tileLocation.x, y: tileLocation.y, id: tileLocation.id, });
		}
	}

	/* TILEMAP */
	for (var i = 0; i < roomsize; i++) {
		for (var j = 0; j < roomsize; j++) {
			out += tilemap[i][j];

			if (j < roomsize - 1 && flags.ROOM_FORMAT === 1) {
				out += LEGACY_KEY.SEPARATOR;
			}
		}

		out += "\n";
	}

	/* NAME */
	if (room[id].name != null) {
		out += ARG_KEY.NAME + " " + room[id].name + "\n";
	}

	/* PALETTE */
	if (room[id].pal != null && room[id].pal != NULL_ID) {
		out += TYPE_KEY.PALETTE + " " + room[id].pal + "\n";
	}

	/* TILE OVERLAY */
	for (var i = 0; i < tileOverlay.length; i++) {
		out += TYPE_KEY.TILE + " " + tileOverlay[i].id + " " + tileOverlay[i].x + " " + tileOverlay[i].y;
		out += "\n";
	}

	/* LEGACY WALL SETTINGS */
	if (room[id].walls.length > 0) {
		out += ARG_KEY.IS_WALL + " ";
		for (j in room[id].walls) {
			out += room[id].walls[j];
			if (j < room[id].walls.length - 1) {
				out += LEGACY_KEY.SEPARATOR;
			}
		}
		out += "\n";
	}

	return out;
}

function serializeMap(id) {
	var out = "";

	out += TYPE_KEY.MAP + " " + id + "\n";

	for (i in map[id].map) {
		for (j in map[id].map[i]) {
			out += map[id].map[i][j];
		}
		out += "\n";
	}

	if (map[id].name) {
		out += ARG_KEY.NAME + " " + map[id].name + "\n";
	}

	if (map[id].transition_effect_up) {
		out += ARG_KEY.TRANSITION_EFFECT_UP + " " + map[id].transition_effect_up + "\n";
	}

	if (map[id].transition_effect_down) {
		out += ARG_KEY.TRANSITION_EFFECT_DOWN + " " + map[id].transition_effect_down + "\n";
	}

	if (map[id].transition_effect_left) {
		out += ARG_KEY.TRANSITION_EFFECT_LEFT + " " + map[id].transition_effect_left + "\n";
	}

	if (map[id].transition_effect_right) {
		out += ARG_KEY.TRANSITION_EFFECT_RIGHT + " " + map[id].transition_effect_right + "\n";
	}

	return out;
}

function serializeTile(id) {
	var out = "";

	var type = tile[id].type;
	var isBackgroundTile = (type === TYPE_KEY.TILE);

	out += type + " " + id + "\n";
	out += serializeDrawing(id);

	if (tile[id].name != null && tile[id].name != undefined) {
		/* NAME */
		out += ARG_KEY.NAME + " " + tile[id].name + "\n";
	}

	if (ENABLE_COLOR_OVERRIDE && tile[id].bgc != null && tile[id].bgc != undefined && tile[id].bgc != 0) {
		var inValidRange = isColorIndexInValidRange(COLOR_INDEX.BACKGROUND + tile[id].bgc);
		if (inValidRange) {
			/* BACKGROUND COLOR OVERRIDE */
			out += ARG_KEY.BACKGROUND + " " + tile[id].bgc + "\n";
		}
	}

	if (ENABLE_COLOR_OVERRIDE && tile[id].col != null && tile[id].col != undefined) {
		var defaultColor = isBackgroundTile ? 1 : 2;
		var inValidRange = isColorIndexInValidRange(COLOR_INDEX.BACKGROUND + tile[id].col);
		if (tile[id].col != defaultColor && inValidRange) {
			/* COLOR OVERRIDE */
			out += ARG_KEY.COLOR +  " " + tile[id].col + "\n";
		}
	}

	if (isBackgroundTile && tile[id].isWall != null && tile[id].isWall != undefined && tile[id].isWall != false) {
		/* WALL */
		out += ARG_KEY.IS_WALL + " " + (tile[id].isWall ? BOOL_KEY.YES : BOOL_KEY.NO) + "\n";
	}

	if (!isBackgroundTile && tile[id].dlg != null) {
		out += ARG_KEY.DIALOG_SCRIPT + " " + tile[id].dlg + "\n";
	}

	if (!isBackgroundTile && tile[id].tickDlgId != null) {
		out += ARG_KEY.FRAME_TICK_SCRIPT + " " + tile[id].tickDlgId + "\n";
	}

	if (!isBackgroundTile && tile[id].knockDlgId != null) {
		out += ARG_KEY.KNOCK_INTO_SCRIPT + " " + tile[id].knockDlgId + "\n";
	}

	if (!isBackgroundTile && tile[id].buttonDownDlgId != null) {
		out += ARG_KEY.BUTTON_DOWN_SCRIPT + " " + tile[id].buttonDownDlgId + "\n";
	}

	if (type === TYPE_KEY.SPRITE && id === playerId && tile[id].inventory != null) {
		for (itemId in tile[id].inventory) {
			out += TYPE_KEY.ITEM + " " + itemId + " " + tile[id].inventory[itemId] + "\n";
		}
	}

	if (type === TYPE_KEY.EXIT && tile[id].dest.room != null) {
		out += ARG_KEY.EXIT_DESTINATION + " " + tile[id].dest.room + " " + tile[id].dest.x + " " + tile[id].dest.y + "\n";
	}

	if (type === TYPE_KEY.EXIT && tile[id].transition_effect != null) {
		out += ARG_KEY.TRANSITION_EFFECT + " " + tile[id].transition_effect + "\n";
	}

	if ((type === TYPE_KEY.EXIT || type === TYPE_KEY.ENDING) && tile[id].lockItem != null) {
		out += ARG_KEY.LOCK + " " + tile[id].lockItem + "\n";
	}

	return out;
}

function serializeDrawing(drwId) {
	var imageSource = renderer.GetTileSource(drwId);
	var drwStr = "";

	var frameCount = ANIMATION_SIZE === null ?
		imageSource.length : Math.min(ANIMATION_SIZE, imageSource.length);

	for (var frameIndex = 0; frameIndex < frameCount; frameIndex++) {
		for (y in imageSource[frameIndex]) {
			var rowStr = "";

			for (x in imageSource[frameIndex][y]) {
				rowStr += imageSource[frameIndex][y][x];
			}

			drwStr += rowStr + "\n";
		}

		if (frameIndex < (frameCount - 1)) {
			drwStr += (MISC_KEY.NEXT + "\n");
		}
	}

	return drwStr;
}

} // Parser