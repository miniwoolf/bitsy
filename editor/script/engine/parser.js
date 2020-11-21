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
		else if (getType(curLine) === SYM_KEY.VARIABLE) {
			i = parseVariable(lines, i);
		}
		else if (getType(curLine) === TYPE_KEY.DEFAULT_FONT) {
			i = parseFontName(lines, i);
		}
		else if (getType(curLine) === TYPE_KEY.TEXT_SCALE) {
			i = parseTextScale(lines, i);
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

	// clean up any excess unique sprites (TODO : is this the best way to do this?)
	var foundUniqueSpr = {};
	for (id in room) {
		for (var i = room[id].sprites.length - 1; i >= 0; i--) {
			var sprId = room[id].sprites[i].id;
			if (foundUniqueSpr[sprId]) {
				// this unique sprite already has a location!
				room[id].sprites.splice(i, 1);
			}
			else if (tile[sprId].isUnique) {
				foundUniqueSpr[sprId] = true;
			}
		}
	}

	scriptCompatibility(compatibilityFlags);

	return versionNumber;
}

function scriptCompatibility(compatibilityFlags) {
	if (compatibilityFlags.convertSayToPrint) {
		console.log("CONVERT SAY TO PRINT!");

		var PrintFunctionVisitor = function() {
			var didChange = false;
			this.DidChange = function() { return didChange; };

			this.Visit = function(node) {
				if (node.type != "function") {
					return;
				}

				if (node.name === "say") {
					node.name = "print";
					didChange = true;
				}
			};
		};

		for (dlgId in dialog) {
			var dialogScript = scriptInterpreter.Parse(dialog[dlgId].src);
			var visitor = new PrintFunctionVisitor();
			dialogScript.VisitAll(visitor);
			if (visitor.DidChange()) {
				var newDialog = dialogScript.Serialize();
				if (newDialog.indexOf("\n") > -1) {
					newDialog = '"""\n' + newDialog + '\n"""';
				}
				dialog[dlgId].src = newDialog;
			}
		}
	}
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
	return getArg(line,arg).split(",");
}

function parseTitle(lines, i) {
	return parseScript(lines, i, { id: titleDialogId, });
}

function parsePalette(lines, i) { //todo this has to go first right now :(
	var id = getId(lines[i]);
	i++;

	var colors = [];
	var name = null;

	while (i < lines.length && lines[i].length > 0) { //look for empty line
		var args = lines[i].split(" ");
		if (args[0] === ARG_KEY.NAME) {
			name = lines[i].split(/\s(.+)/)[1];
		}
		else {
			var col = [];
			lines[i].split(",").forEach(function(i) {
				col.push(parseInt(i));
			});
			colors.push(col);
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
		// old way: no commas, single char tile ids
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
		// new way: comma separated, multiple char tile ids
		var end = i + roomsize;
		var y = 0;
		for (; i < end; i++) {
			var lineSep = lines[i].split(",");
			for (x = 0; x < roomsize; x++) {
				room[id].tilemap[y][x] = lineSep[x];
			}
			y++;
		}
	}

	while (i < lines.length && lines[i].length > 0) { //look for empty line
		// console.log(getType(lines[i]));
		if (getType(lines[i]) === TYPE_KEY.SPRITE || getType(lines[i]) === TYPE_KEY.ITEM) {
			var sprId = getId(lines[i]);
			console.log(lines[i]);
			var sprCoord = lines[i].split(" ")[2].split(",");
			var sprLocation = createSpriteLocation(sprId, parseInt(sprCoord[0]), parseInt(sprCoord[1]));
			room[id].sprites.push(sprLocation);

			// TODO : do I need to support reading in the old "find and replace" sprite format for back compat?
		}
		else if (getType(lines[i]) === ARG_KEY.IS_WALL) {
			/* DEFINE COLLISIONS (WALLS) */
			// TODO : remove this deprecated feature at some point
			room[id].walls = getId(lines[i]).split(",");
		}
		else if (getType(lines[i]) === TYPE_KEY.EXIT) {
			/* ADD EXIT */
			var exitArgs = lines[i].split(" ");
			//arg format: EXT 10,5 M 3,2
			var exitCoords = exitArgs[1].split(",");
			var destName = exitArgs[2];
			var destCoords = exitArgs[3].split(",");
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
				y : parseInt(endCoords[1])
			};

			// TODO : back compat
		}
		else if (getType(lines[i]) === TYPE_KEY.PALETTE) {
			/* CHOOSE PALETTE (that's not default) */
			room[id].pal = getId(lines[i]);
		}
		else if (getType(lines[i]) === ARG_KEY.NAME) {
			var name = lines[i].split(/\s(.+)/)[1];
			room[id].name = name;
			names.room.set(name, id);
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

function parseTile(lines, i, type) {
	var id = getId(lines[i]);
	i++;

	var options = {};

	// parse drawing
	var drawingResult = parseDrawing(lines, i);
	i = drawingResult.i;
	options.drawingData = drawingResult.drawingData;

	// todo : is this the best way to handle back compat?
	var isPlayer = (type === TYPE_KEY.AVATAR) || (type === TYPE_KEY.SPRITE && id === playerId);

	if (isPlayer) {
		type = TYPE_KEY.AVATAR;
		options.inventory = {};
	}

	// background tiles are restricted from several properties
	var isNotBackgroundTile = type != TYPE_KEY.TILE;

	// read all other properties
	while (i < lines.length && lines[i].length > 0) { // stop at empty line
		if (getType(lines[i]) === ARG_KEY.NAME) {
			/* NAME */
			options.name = lines[i].split(/\s(.+)/)[1];
		}
		else if (getType(lines[i]) === ARG_KEY.COLOR && ENABLE_COLOR_OVERRIDE) {
			/* COLOR OFFSET INDEX */
			options.col = parseInt(getId(lines[i]));
		}
		else if (getType(lines[i]) === ARG_KEY.BACKGROUND && ENABLE_COLOR_OVERRIDE) {
			/* BACKGROUND COLOR OFFSET INDEX */
			options.bgc = parseInt(getId(lines[i]));
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
		else if (getType(lines[i]) === "BUP" && isNotBackgroundTile) { // todo : implement? name? BNU? RLS?
			// todo ... "BUTTON UP"
		}
		else if (getType(lines[i]) === LEGACY_KEY.POSITION && type === TYPE_KEY.SPRITE) {
			/* STARTING POSITION */
			// NOTE: I still need this to read in old unique position data from sprites
			var posArgs = lines[i].split(" ");
			var roomId = posArgs[1];
			var coordArgs = posArgs[2].split(",");

			// NOTE: assumes rooms have all been created!
			room[roomId].sprites.push(
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

			var coordArgs = getCoord(lines[i], 2);
			options.destX = parseInt(coordArgs[0]);
			options.destY = parseInt(coordArgs[1]);
		}
		else if (getType(lines[i]) === ARG_KEY.TRANSITION_EFFECT && type === TYPE_KEY.EXIT) {
			options.transition_effect = getId(lines[i]);
		}
		else if (getType(lines[i]) === ARG_KEY.LOCK && (type === TYPE_KEY.EXIT || type === TYPE_KEY.ENDING)) {
			options.lockItem = getId(lines[i]);
			var tollArg = tryGetArg(lines[i], 2);
			options.lockToll = Math.max(0, parseInt(tollArg != null ? tollArg : 0));
		}

		i++;
	}

	createTile(id, type, options);

	return i;
}

function parseDrawing(lines, i) {
	var frameList = []; //init list of frames
	var curFrame = [];; //init first frame

	var y = 0;

	while (y < tilesize) {
		var l = lines[i+y];

		var row = [];
		for (x = 0; x < tilesize; x++) {
			row.push(parseInt(l.charAt(x)));
		}

		curFrame.push(row);

		y++;

		if (y === tilesize) {
			if (ANIMATION_SIZE === null || frameList.length < ANIMATION_SIZE) {
				frameList.push(curFrame);
			}

			i = i + y;

			if (lines[i] != undefined && lines[i].charAt(0) === MISC_KEY.NEXT) {
				// start next frame!
				curFrame = [];

				//start the count over again for the next frame
				i++;

				y = 0;
			}
		}
	}

	return { i:i, drawingData:frameList };
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

	id = backCompatPrefix + id;

	var dialogStart = SYM_KEY.OPEN + SYM_KEY.DIALOG;

	var script = "";
	var startsWithDialogExpression = (lines[i].length >= 3) && (lines[i].indexOf(dialogStart) === 0);

	if (startsWithDialogExpression) {
		// multi-line dialog script
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

				if (lines[i][charIndex] === SYM_KEY.OPEN) {
					bracesCount++;
				}
				else if (lines[i][charIndex] === SYM_KEY.CLOSE) {
					bracesCount--;
				}

				charIndex++;
			}
		}
	}
	else {
		// single line dialog script
		script += lines[i];
	}

	i++;

	dialog[id] = createScript(id, null, script);

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
		names.dialog.set(dialog[id].name, id);
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

function parseVariable(lines, i) {
	var id = getId(lines[i]);
	i++;
	var value = scriptNext.ParseValue(lines[i]);
	i++;
	variable[id] = value;
	return i;
}

function parseFontName(lines, i) {
	fontName = getArg(lines[i], 1);
	i++;
	return i;
}

function parseTextScale(lines, i) {
	var scaleFlag = getArg(lines[i], 1);

	if (scaleFlag === "1") {
		// 1x scale
		text_scale = scale;
	}
	else if (scaleFlag === "2") {
		// 2x scale
		text_scale = scale / 2; // NOTE: assumes scale is an even number
	}

	i++;
	return i;
}

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
	i++;
	return i;
}

//TODO this is in progress and doesn't support all features
function serializeWorld(skipFonts) {
	if (skipFonts === undefined || skipFonts === null) {
		skipFonts = false;
	}

	var worldStr = "";

	/* TITLE */
	worldStr += getTitle() + "\n";
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

	/* FONT */
	if (fontName != defaultFontName) {
		worldStr += TYPE_KEY.DEFAULT_FONT + " " + fontName + "\n";
		worldStr += "\n";
	}
	// todo : what should be the default?
	if (text_scale === scale) {
		worldStr += TYPE_KEY.TEXT_SCALE + " 1\n";
		worldStr += "\n";
	}
	if (textDirection != TEXT_DIRECTION_KEY.LEFT_TO_RIGHT) {
		worldStr += TYPE_KEY.TEXT_DIRECTION + " " + textDirection + "\n";
		worldStr += "\n";
	}

	/* PALETTE */
	var paletteIdList = sortedIdList(palette);
	for (var i = 0; i < paletteIdList.length; i++) {
		var id = paletteIdList[i];

		// TODO
		// if (id === NULL_ID) {
		// 	continue;
		// }

		worldStr += TYPE_KEY.PALETTE + " " + id + "\n";

		// todo : can I put this at the end instead? what about other properties?
		if (palette[id].name != null) {
			worldStr += ARG_KEY.NAME + " " + palette[id].name + "\n";
		}

		for (i in getPal(id)) {
			for (j in getPal(id)[i]) {
				worldStr += getPal(id)[i][j];
				if (j < 2) worldStr += ",";
			}
			worldStr += "\n";
		}
		worldStr += "\n";
	}

	/* ROOM */
	var roomIdList = sortedIdList(room);
	for (var i = 0; i < roomIdList.length; i++) {
		var id = roomIdList[i];

		// TODO
		// if (id === NULL_ID) {
		// 	continue;
		// }

		worldStr += TYPE_KEY.ROOM + " " + id + "\n";
		if ( flags.ROOM_FORMAT == 0 ) {
			// old non-comma separated format
			for (i in room[id].tilemap) {
				for (j in room[id].tilemap[i]) {
					worldStr += room[id].tilemap[i][j];
				}
				worldStr += "\n";
			}
		}
		else if ( flags.ROOM_FORMAT == 1 ) {
			// new comma separated format
			for (i in room[id].tilemap) {
				for (j in room[id].tilemap[i]) {
					worldStr += room[id].tilemap[i][j];
					if (j < room[id].tilemap[i].length-1) worldStr += ","
				}
				worldStr += "\n";
			}
		}
		if (room[id].name != null) {
			/* NAME */
			worldStr += ARG_KEY.NAME + " " + room[id].name + "\n";
		}
		if (room[id].walls.length > 0) {
			/* WALLS */
			worldStr += ARG_KEY.IS_WALL + " ";
			for (j in room[id].walls) {
				worldStr += room[id].walls[j];
				if (j < room[id].walls.length-1) {
					worldStr += ",";
				}
			}
			worldStr += "\n";
		}
		if (room[id].sprites.length > 0) {
			/* SPRITES */
			for (j in room[id].sprites) {
				var spr = room[id].sprites[j];
				if (!tile[spr.id].isUnique || !tile[spr.id].hasUniqueLocation) {
					// TODO : for now I'm just using SPR to avoid collisions with EXT and END legacy commands
					// *but* is that the final format I want to use??
					worldStr += TYPE_KEY.SPRITE + " " + spr.id + " " + spr.x + "," + spr.y;
					worldStr += "\n";
				}

				// temporary field to ensure unique objects are only placed once! (necessary for the player)
				if (tile[spr.id].isUnique) {
					tile[spr.id].hasUniqueLocation = true;
				}
			}
		}
		if (room[id].pal != null && room[id].pal != NULL_ID) {
			/* PALETTE */
			worldStr += TYPE_KEY.PALETTE + " " + room[id].pal + "\n";
		}
		worldStr += "\n";
	}

	/* MAP */
	var mapIdList = sortedIdList(map);
	for (var i = 0; i < mapIdList.length; i++) {
		var id = mapIdList[i];

		if (id === NULL_ID) {
			continue;
		}

		worldStr += TYPE_KEY.MAP + " " + id + "\n";
		for (i in map[id].map) {
			for (j in map[id].map[i]) {
				worldStr += map[id].map[i][j];
			}
			worldStr += "\n";
		}

		if (map[id].name) {
			worldStr += ARG_KEY.NAME + " " + map[id].name + "\n";
		}

		if (map[id].transition_effect_up) {
			worldStr += ARG_KEY.TRANSITION_EFFECT_UP + " " + map[id].transition_effect_up + "\n";
		}
		if (map[id].transition_effect_down) {
			worldStr += ARG_KEY.TRANSITION_EFFECT_DOWN + " " + map[id].transition_effect_down + "\n";
		}
		if (map[id].transition_effect_left) {
			worldStr += ARG_KEY.TRANSITION_EFFECT_LEFT + " " + map[id].transition_effect_left + "\n";
		}
		if (map[id].transition_effect_right) {
			worldStr += ARG_KEY.TRANSITION_EFFECT_RIGHT + " " + map[id].transition_effect_right + "\n";
		}

		worldStr += "\n";
	}

	/* TILES */
	var tileIdList = sortedIdList(tile);
	for (var i = 0; i < tileIdList.length; i++) {
		var id = tileIdList[i];

		if (id === NULL_ID) {
			continue;
		}

		var type = tile[id].type;
		var isBackgroundTile = type === TYPE_KEY.TILE;

		worldStr += type + " " + id + "\n";
		worldStr += serializeDrawing(id);
		if (tile[id].name != null && tile[id].name != undefined) {
			/* NAME */
			worldStr += ARG_KEY.NAME + " " + tile[id].name + "\n";
		}
		if (ENABLE_COLOR_OVERRIDE && tile[id].bgc != null && tile[id].bgc != undefined && tile[id].bgc != 0) {
			/* BACKGROUND COLOR OVERRIDE */
			worldStr += ARG_KEY.BACKGROUND + " " + tile[id].bgc + "\n";
		}
		if (ENABLE_COLOR_OVERRIDE && tile[id].col != null && tile[id].col != undefined) {
			var defaultColor = isBackgroundTile ? 1 : 2;
			if (tile[id].col != defaultColor) {
				/* COLOR OVERRIDE */
				worldStr += ARG_KEY.COLOR +  " " + tile[id].col + "\n";
			}
		}
		if (isBackgroundTile && tile[id].isWall != null && tile[id].isWall != undefined && tile[id].isWall != false) {
			/* WALL */
			worldStr += ARG_KEY.IS_WALL + " " + (tile[id].isWall ? BOOL_KEY.YES : BOOL_KEY.NO) + "\n";
		}
		if (!isBackgroundTile && tile[id].dlg != null) {
			worldStr += ARG_KEY.DIALOG_SCRIPT + " " + tile[id].dlg + "\n";
		}
		if (!isBackgroundTile && tile[id].tickDlgId != null) {
			worldStr += ARG_KEY.FRAME_TICK_SCRIPT + " " + tile[id].tickDlgId + "\n";
		}
		if (!isBackgroundTile && tile[id].knockDlgId != null) {
			worldStr += ARG_KEY.KNOCK_INTO_SCRIPT + " " + tile[id].knockDlgId + "\n";
		}
		if (!isBackgroundTile && tile[id].buttonDownDlgId != null) {
			worldStr += ARG_KEY.BUTTON_DOWN_SCRIPT + " " + tile[id].buttonDownDlgId + "\n";
		}
		if (type === TYPE_KEY.SPRITE && id === playerId && tile[id].inventory != null) {
			for (itemId in tile[id].inventory) {
				worldStr += TYPE_KEY.ITEM + " " + itemId + " " + tile[id].inventory[itemId] + "\n";
			}
		}
		if (type === TYPE_KEY.EXIT && tile[id].dest.room != null) {
			worldStr += ARG_KEY.EXIT_DESTINATION + " " + tile[id].dest.room + " " + tile[id].dest.x + "," + tile[id].dest.y + "\n";
		}
		if (type === TYPE_KEY.EXIT && tile[id].transition_effect != null) {
			worldStr += ARG_KEY.TRANSITION_EFFECT + " " + tile[id].transition_effect + "\n";
		}
		if ((type === TYPE_KEY.EXIT || type === TYPE_KEY.ENDING) && tile[id].lockItem != null) {
			worldStr += ARG_KEY.LOCK + " " + tile[id].lockItem;
			if (tile[id].lockToll > 0) {
				worldStr += " " + tile[id].lockToll;
			}
			worldStr += "\n";
		}

		worldStr += "\n";

		// remove temporary unique placement field
		delete tile[id].hasUniqueLocation;
	}

	/* DIALOG */
	var dialogIdList = sortedIdList(dialog);
	for (var i = 0; i < dialogIdList.length; i++) {
		var id = dialogIdList[i];

		if (id === NULL_ID) {
			continue;
		}

		worldStr += TYPE_KEY.DIALOG + " " + id + "\n";
		worldStr += dialog[id].src + "\n";
		if (dialog[id].name != null) {
			worldStr += ARG_KEY.NAME + " " + dialog[id].name + "\n";
		}
		worldStr += "\n";
	}

	/* VARIABLES */
	for (id in variable) {
		worldStr += SYM_KEY.VARIABLE + " " + id + "\n";
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