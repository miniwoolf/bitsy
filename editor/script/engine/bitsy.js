/*
TODO general
- test all tools / buttons

TODO script_next
- redo graphical editor
- audit all new functions and function names
- RND
- RNG
- FOR
- ideas
	- put text format controls on top of text box
	- make text box nicer: all black, bitsy font, preview/WYSIWYG/syntax highlighting when not selected, full bleed textarea

TODO maps
X transitions?
- is it ok to make room "0" invalid
	- how do we handle back compat?
- what should the low id be for maps? 0? 1?
- should avatar be able to enter neighboring room when moved via script???
- what should happen if you immediately land on an exit, ending, or item when entering a new room via the map??

TODO new exits & endings (& portals?)
- instead of portals: exits that go to exits
	- OUT ROOMID EXITID
	- that way when the dest exit moves, the exit still points at the right location
- figure out back compat:
	- how do we deal with overlapping ids (END for dialog vs sprite) -- new one? detection? use SPR + TYP for everything?
	- can differentiate via version number (before or after 8.0)

TODO new object/sprite system
- replace all the literal type strings "EXT" etc with an enum?
- also: add a "new / init" script event?

TODO choices
- action button support in input system
- allow text effects or not? what about other code?
- edge cases:
	- what if you put a choice block inside a choice option???
	- what if you put long running stuff inside a choice option?
*/

// World Data
var map = {};
var room = {};
var tile = {};
var dialog = {};
var palette = {};
var variable = {}; // todo : fix bugs now that these are actually used during the game..

// Game State
var playerId = null;
var tilemap = [];
var spriteInstances = {};
var instanceCount = 0;

// title
var titleDialogId = NULL_ID;

function getTitle() {
	return dialog[titleDialogId].src;
}

function setTitle(titleSrc) {
	dialog[titleDialogId].src = titleSrc;
}

var defaultFontName = "ascii_small";
var fontName = defaultFontName;
var textDirection = TEXT_DIRECTION_KEY.LEFT_TO_RIGHT;

// should I keep this thing? seems kind unwieldy
var names = {
	room : new Map(),
	tile : new Map(), // Note: Not currently enabled in the UI
	sprite : new Map(),
	item : new Map(),
	dialog : new Map(),
};
function updateNamesFromCurData() {

	function createNameMap(objectStore) {
		var map = new Map();
		for (id in objectStore) {
			if (objectStore[id].name != undefined && objectStore[id].name != null) {
				map.set(objectStore[id].name, id);
			}
		}
		return map;
	}

	names.room = createNameMap(room);
	names.tile = createNameMap(tile); // rename back to tile?
	// names.sprite = createNameMap(sprite);
	// names.item = createNameMap(item);
	names.dialog = createNameMap(dialog);
}

/* VERSION */
var version = {
	major: 8, // major changes
	minor: 0, // smaller changes
	devBuildPhase: "DEV",
};
function getEngineVersion() {
	return version.major + "." + version.minor;
}

/* FLAGS */
var flags;
function resetFlags() {
	flags = {
		ROOM_FORMAT : 0, // 0 = non-comma separated, 1 = comma separated
		PAL_FORMAT : 0, // 0 = rgb comma separated, 1 = hex
	};
}
resetFlags(); //init flags on load script

// SUPER hacky location... :/
var editorDevFlags = {
	// NONE right now!
};

function clearGameData() {
	map = {};
	room = {};
	item = {};
	tile = {};
	dialog = {};
	palette = {};
	isEnding = false; //todo - correct place for this?
	variable = {};

	// TODO RENDERER : clear data?

	// hacky to have this multiple times...
	names = {
		room : new Map(),
		tile : new Map(),
		sprite : new Map(),
		item : new Map(),
		dialog : new Map(),
	};

	fontName = defaultFontName; // TODO : reset font manager too?
	textDirection = TEXT_DIRECTION_KEY.LEFT_TO_RIGHT;
}

var curRoom = "0";

var key = {
	left : 37,
	right : 39,
	up : 38,
	down : 40,
	space : 32,
	enter : 13,
	w : 87,
	a : 65,
	s : 83,
	d : 68,
	r : 82,
	shift : 16,
	ctrl : 17,
	alt : 18,
	cmd : 224
};

var prevTime = 0;
var deltaTime = 0;

//inventory update UI handles
var onInventoryChanged = null;
var onVariableChanged = null;
var onGameReset = null;

var isPlayerEmbeddedInEditor = false;

var parser = new Parser();
var renderer = new Renderer(roomsize, tilesize, scale);

var curGameData = null;
function load_game(game_data, startWithTitle) {
	curGameData = game_data; //remember the current game (used to reset the game)

	dialogBuffer.Reset();
	scriptInterpreter.ResetEnvironment(); // ensures variables are reset -- is this the best way?
	scriptNext.Reset();

	renderer.ResetRenderCache();

	parser.ParseWorld(game_data);

	var instance = createAvatarInstance(NULL_ID);
	if (instance != null) {
		spriteInstances[NULL_ID] = instance;
	}

	// set the first room
	var roomIds = Object.keys(room);
	if (player() != null && player().room != null && roomIds.includes(player().room)) {
		// player has valid room
		curRoom = player().room;
	}
	else if (roomIds.length > 0) {
		// player not in any room! what the heck
		curRoom = roomIds[0];
	}
	else {
		// uh oh there are no rooms I guess???
		curRoom = null;
	}

	// initialize the first room
	if (curRoom != null) {
		initRoom(curRoom);
	}

	if (!isPlayerEmbeddedInEditor) {
		// hack to ensure default font is available
		fontManager.AddResource(defaultFontName + fontManager.GetExtension(), document.getElementById(defaultFontName).text.slice(1));
	}

	var font = fontManager.Get( fontName );
	dialogBuffer.SetFont(font);
	dialogRenderer.SetFont(font);

	// setInterval(updateLoadingScreen, 300); // hack test

	colorCycleCounter = 0;
	animationCounter = 0;

	onready(startWithTitle);
}

function reset_cur_game() {
	if (curGameData == null) {
		return; //can't reset if we don't have the game data
	}

	stopGame();
	clearGameData();
	load_game(curGameData);

	if (isPlayerEmbeddedInEditor && onGameReset != null) {
		onGameReset();
	}
}

var update_interval = null;
function onready(startWithTitle) {
	if (startWithTitle === undefined || startWithTitle === null) {
		startWithTitle = true;
	}

	input = new InputManager();

	document.addEventListener('keydown', input.onkeydown);
	document.addEventListener('keyup', input.onkeyup);

	if (isPlayerEmbeddedInEditor) {
		canvas.addEventListener('touchstart', input.ontouchstart, {passive:false});
		canvas.addEventListener('touchmove', input.ontouchmove, {passive:false});
		canvas.addEventListener('touchend', input.ontouchend, {passive:false});
	}
	else {
		// creates a 'touchTrigger' element that covers the entire screen and can universally have touch event listeners added w/o issue.

		// we're checking for existing touchTriggers both at game start and end, so it's slightly redundant.
	  	var existingTouchTrigger = document.querySelector('#touchTrigger');
	  	if (existingTouchTrigger === null){
	  	  var touchTrigger = document.createElement("div");
	  	  touchTrigger.setAttribute("id","touchTrigger");

	  	  // afaik css in js is necessary here to force a fullscreen element
	  	  touchTrigger.setAttribute(
	  	    "style","position: absolute; top: 0; left: 0; width: 100vw; height: 100vh; overflow: hidden;"
	  	  );
	  	  document.body.appendChild(touchTrigger);

	  	  touchTrigger.addEventListener('touchstart', input.ontouchstart);
	  	  touchTrigger.addEventListener('touchmove', input.ontouchmove);
	  	  touchTrigger.addEventListener('touchend', input.ontouchend);
	  	}
	}

	window.onblur = input.onblur;

	update_interval = setInterval(update, 16);

	if (startWithTitle) { // used by editor 
		startTitle();
	}
}

function getOffset(evt) {
	var offset = { x:0, y:0 };

	var el = evt.target;
	var rect = el.getBoundingClientRect();

	offset.x += rect.left + el.scrollLeft;
	offset.y += rect.top + el.scrollTop;

	offset.x = evt.clientX - offset.x;
	offset.y = evt.clientY - offset.y;

	return offset;
}

function stopGame() {
	console.log("stop GAME!");

	document.removeEventListener('keydown', input.onkeydown);
	document.removeEventListener('keyup', input.onkeyup);

	if (isPlayerEmbeddedInEditor) {
		canvas.removeEventListener('touchstart', input.ontouchstart);
		canvas.removeEventListener('touchmove', input.ontouchmove);
		canvas.removeEventListener('touchend', input.ontouchend);
	}
	else {
		//check for touchTrigger and removes it

    		var existingTouchTrigger = document.querySelector('#touchTrigger');
    		if (existingTouchTrigger !== null){
    			existingTouchTrigger.removeEventListener('touchstart', input.ontouchstart);
    			existingTouchTrigger.removeEventListener('touchmove', input.ontouchmove);
    			existingTouchTrigger.removeEventListener('touchend', input.ontouchend);

    			existingTouchTrigger.parentElement.removeChild(existingTouchTrigger);
    		}
	}

	window.onblur = null;

	clearInterval(update_interval);
}

function update() {
	var curTime = Date.now();
	deltaTime = curTime - prevTime;

	if (curRoom == null && !dialogBuffer.IsActive()) {
		// in the special case where there is no valid room, end the game
		isEnding = true;
	}

	updateRender();

	updateInput();

	updateScriptQueue();

	prevTime = curTime;

	input.resetKeyPressed();
	input.resetTapReleased();
}

function updateRender(renderOptions) {
	if (transition.IsTransitionActive()) {
		// transitions take over everything!
		transition.UpdateTransition(deltaTime);
	}
	else {
		updateColorCycle();

		if (!isNarrating && !isEnding) {
			updateAnimation();
			drawRoom(room[curRoom], renderOptions);
		}
		else {
			// for title and ending just clear the screen!
			bitsyCanvasClear(COLOR_INDEX.BACKGROUND);
		}

		if (dialogBuffer.IsActive()) {
			dialogRenderer.Draw(dialogBuffer, deltaTime);
			dialogBuffer.Update(deltaTime);
		}
	}
}

function renderOnlyUpdate(renderOptions) {
	var curTime = Date.now();
	deltaTime = curTime - prevTime;

	updateRender(renderOptions);

	prevTime = curTime;
}

function updateInput() {
	if (transition.IsTransitionActive()) {
		// do nothing
	}
	else if (dialogBuffer.IsActive()) {
		// todo : can choice and non-choice input share anything?
		if (dialogBuffer.IsChoicePage()) {
			if (dialogBuffer.CanContinue()) {
				if (input.isKeyDown(key.left) || input.isKeyDown(key.a) || input.swipeLeft()
					|| input.isKeyDown(key.up) || input.isKeyDown(key.w) || input.swipeUp()) {
					dialogBuffer.PrevChoice();
				}
				else if (input.isKeyDown(key.right) || input.isKeyDown(key.d) || input.swipeRight()
					|| input.isKeyDown(key.down) || input.isKeyDown(key.s) || input.swipeDown()) {
					dialogBuffer.NextChoice();
				}
				else if (input.isKeyDown(key.enter) || input.isKeyDown(key.space) || input.isTapReleased()) {
					// select choice!
					dialogBuffer.Continue();
				}
				input.ignoreHeldKeys(); // I think we want to do this for all choice input?
			}
			else {
				if (input.anyKeyPressed() || input.isTapReleased()) {
					dialogBuffer.Skip();
					input.ignoreHeldKeys();
				}
			}
		}
		else {
			if (input.anyKeyPressed() || input.isTapReleased()) {
				/* CONTINUE DIALOG */
				if (dialogBuffer.CanContinue()) {
					var hasMoreDialog = dialogBuffer.Continue();
					if (!hasMoreDialog) {
						// ignore currently held keys UNTIL they are released (stops player from insta-moving)
						input.ignoreHeldKeys();
					}
				}
				else {
					dialogBuffer.Skip();
				}
			}
		}
	}
	else if (isEnding) {
		if (input.anyKeyPressed() || input.isTapReleased()) {
			/* RESTART GAME */
			reset_cur_game();
		}
	}
	else {
		/* WALK */
		var prevPlayerDirection = curPlayerDirection;

		if (input.isKeyDown(key.left) || input.isKeyDown(key.a) || input.swipeLeft()) {
			curPlayerDirection = BUTTON_KEY.LEFT;
		}
		else if (input.isKeyDown(key.right) || input.isKeyDown(key.d) || input.swipeRight()) {
			curPlayerDirection = BUTTON_KEY.RIGHT;
		}
		else if (input.isKeyDown(key.up) || input.isKeyDown(key.w) || input.swipeUp()) {
			curPlayerDirection = BUTTON_KEY.UP;
		}
		else if (input.isKeyDown(key.down) || input.isKeyDown(key.s) || input.swipeDown()) {
			curPlayerDirection = BUTTON_KEY.DOWN;
		}
		else {
			curPlayerDirection = null;
		}

		function tryButtonDownActions(keyName, isButtonHeld, afterButtonPressFunc) {
			if (player() && player().btn != null) {
				queueScript(
					player().btn,
					player(),
					function(result) {
						// todo : should I also consider the return value?
						if (!player().lok && afterButtonPressFunc) {
							afterButtonPressFunc();
						}

						queueButtonDownScripts(keyName, isButtonHeld);
					},
					[keyName, isButtonHeld]);
			}
			else {
				if (player() && !player().lok && afterButtonPressFunc) {
					afterButtonPressFunc();
				}

				queueButtonDownScripts(keyName, isButtonHeld);
			}
		}

		if (curPlayerDirection != null) {
			if (curPlayerDirection != prevPlayerDirection) {
				// new direction!
				tryButtonDownActions(
					curPlayerDirection,
					false,
					function() { movePlayer(curPlayerDirection); });

				playerHoldToMoveTimer = 500;
			}
			else {
				// held
				playerHoldToMoveTimer -= deltaTime;

				if (playerHoldToMoveTimer <= 0) {
					tryButtonDownActions(
						curPlayerDirection,
						true,
						function() { movePlayer(curPlayerDirection); });

					playerHoldToMoveTimer = 150;
				}
			}
		}

		/* OKAY BUTTON INPUT */
		if (input.isKeyDown(key.enter) || input.isKeyDown(key.space) || input.isTapReleased()) {
			if (!isOkayButtonDown) {
				isOkayButtonDown = true;

				// todo : is this the keycode I want?
				// todo : should I implement held actions for this button?
				// todo : what if this sets off a dialog -- do I need to reset the okay button?
				tryButtonDownActions(BUTTON_KEY.OKAY, false);
			}
		}
		else {
			isOkayButtonDown = false;
		}
	}
}

// TODO : should any of this live inside the script module?
var scriptQueue = [];
var isScriptRunning = false;
function isScriptQueueBusy() {
	return isScriptRunning || scriptQueue.length > 0;
}

function updateScriptQueue() {
	// animation frame tick scripts
	if (!isNarrating && !isEnding && !dialogBuffer.IsActive() && !transition.IsTransitionActive() && !isScriptQueueBusy()) {
		if (animationCounter === 0) {
			for (var i in spriteInstances) {
				var spr = spriteInstances[i];
				if (spr.tik != null) {
					queueScript(spr.tik, spr, function() {}, [spr.animation.frameIndex]);
				}
			}
		}
	}

	// run as many scripts as we can this frame
	while (!isNarrating && !isEnding && !dialogBuffer.IsActive() && !transition.IsTransitionActive() && !isScriptRunning && scriptQueue.length > 0) {
		isScriptRunning = true;

		var scriptInfo = scriptQueue.shift();

		dialogRenderer.Reset();
		dialogBuffer.Reset();

		var onScriptEnd = function(value) {
			if (scriptInfo.callback) {
				scriptInfo.callback(value);
			}

			// todo : will this break with callbacks that start dialog?
			isScriptRunning = false;
		};

		if (scriptInfo.onStart != undefined && scriptInfo.onStart != null) {
			scriptInfo.onStart();
		}

		dialogRenderer.SetCentered(isNarrating);

		if (scriptInfo.parameters != undefined && scriptInfo.parameters != null) {
			// TODO : should script info have a bool for this?
			// should the run function have a bool?
			scriptNext.RunCallback(dialog[scriptInfo.id], scriptInfo.instance, scriptInfo.parameters, onScriptEnd);
		}
		else {
			scriptNext.Run(dialog[scriptInfo.id], scriptInfo.instance, onScriptEnd);
		}
	}
}

function queueScript(scriptId, instance, callback, parameters, onStart) {
	scriptQueue.push({
		id: scriptId,
		instance: instance,
		callback: callback,
		parameters: parameters, // for scripts with callbacks: should I make that explicit?
		onStart: onStart,
	});
}

var animationCounter = 0;
var animationTime = 400;
function updateAnimation() {
	animationCounter += deltaTime;

	if (animationCounter >= animationTime) {
		for (id in tile) {
			var til = tile[id];
			if (til.animation.isAnimated) {
				til.animation.frameIndex = (til.animation.frameIndex + 1) % til.animation.frameCount;
			}
		}

		// reset counter
		animationCounter = 0;
	}
}

var colorCycleCounter = 0;
var colorCycleTime = 80; // todo : is this the speed I want? (closest to the original speed would be ~71)
function updateColorCycle() {
	colorCycleCounter += deltaTime;

	if (colorCycleCounter >= colorCycleTime) {
		color.Cycle();
		colorCycleCounter = 0;
	}
}

function resetAllAnimations() {
	for (id in tile) {
		var til = tile[id];
		if (til.animation.isAnimated) {
			til.animation.frameIndex = 0;
		}
	}
}

function getSpriteAt(x, y) {
	for (var id in spriteInstances) {
		if (spriteInstances[id].type === "SPR" &&
			spriteInstances[id].x === x && spriteInstances[id].y === y) {
			return spriteInstances[id];
		}
	}

	return null;
}

function getAllSpritesAt(x, y) {
	var spriteList = [];

	for (var id in spriteInstances) {
		var instance = spriteInstances[id];
		if (instance.x === x && instance.y === y) {
			spriteList.push(instance);
		}
	}

	return spriteList;
}

var Direction = {
	None : -1,
	Up : 0,
	Down : 1,
	Left : 2,
	Right : 3
};

var curPlayerDirection = null;
var playerHoldToMoveTimer = 0;

var isOkayButtonDown = false;

var InputManager = function() {
	var self = this;

	var pressed;
	var ignored;
	var newKeyPress;
	var touchState;

	function resetAll() {
		pressed = {};
		ignored = {};
		newKeyPress = false;

		touchState = {
			isDown : false,
			startX : 0,
			startY : 0,
			curX : 0,
			curY : 0,
			swipeDistance : 30,
			swipeDirection : null,
			tapReleased : false,
		};
	}
	resetAll();

	function stopWindowScrolling(e) {
		if(e.keyCode == key.left || e.keyCode == key.right || e.keyCode == key.up || e.keyCode == key.down || !isPlayerEmbeddedInEditor)
			e.preventDefault();
	}

	function tryRestartGame(e) {
		/* RESTART GAME */
		if ( e.keyCode === key.r && ( e.getModifierState("Control") || e.getModifierState("Meta") ) ) {
			if ( confirm("Restart the game?") ) {
				reset_cur_game();
			}
		}
	}

	function eventIsModifier(event) {
		return (event.keyCode == key.shift || event.keyCode == key.ctrl || event.keyCode == key.alt || event.keyCode == key.cmd);
	}

	function isModifierKeyDown() {
		return ( self.isKeyDown(key.shift) || self.isKeyDown(key.ctrl) || self.isKeyDown(key.alt) || self.isKeyDown(key.cmd) );
	}

	this.ignoreHeldKeys = function() {
		for (var key in pressed) {
			if (pressed[key]) { // only ignore keys that are actually held
				ignored[key] = true;
				// console.log("IGNORE -- " + key);
			}
		}
	}

	this.onkeydown = function(event) {
		// console.log("KEYDOWN -- " + event.keyCode);

		stopWindowScrolling(event);

		tryRestartGame(event);

		// Special keys being held down can interfere with keyup events and lock movement
		// so just don't collect input when they're held
		{
			if (isModifierKeyDown()) {
				return;
			}

			if (eventIsModifier(event)) {
				resetAll();
			}
		}

		if (ignored[event.keyCode]) {
			return;
		}

		if (!self.isKeyDown(event.keyCode)) {
			newKeyPress = true;
		}

		pressed[event.keyCode] = true;
		ignored[event.keyCode] = false;
	}

	this.onkeyup = function(event) {
		// console.log("KEYUP -- " + event.keyCode);
		pressed[event.keyCode] = false;
		ignored[event.keyCode] = false;
	}

	this.ontouchstart = function(event) {
		event.preventDefault();

		if( event.changedTouches.length > 0 ) {
			touchState.isDown = true;

			touchState.startX = touchState.curX = event.changedTouches[0].clientX;
			touchState.startY = touchState.curY = event.changedTouches[0].clientY;

			touchState.swipeDirection = null;
		}
	}

	this.ontouchmove = function(event) {
		event.preventDefault();

		if( touchState.isDown && event.changedTouches.length > 0 ) {
			touchState.curX = event.changedTouches[0].clientX;
			touchState.curY = event.changedTouches[0].clientY;

			var prevDirection = touchState.swipeDirection;

			if( touchState.curX - touchState.startX <= -touchState.swipeDistance ) {
				touchState.swipeDirection = BUTTON_KEY.LEFT;
			}
			else if( touchState.curX - touchState.startX >= touchState.swipeDistance ) {
				touchState.swipeDirection = BUTTON_KEY.RIGHT;
			}
			else if( touchState.curY - touchState.startY <= -touchState.swipeDistance ) {
				touchState.swipeDirection = BUTTON_KEY.UP;
			}
			else if( touchState.curY - touchState.startY >= touchState.swipeDistance ) {
				touchState.swipeDirection = BUTTON_KEY.DOWN;
			}

			if( touchState.swipeDirection != prevDirection ) {
				// reset center so changing directions is easier
				touchState.startX = touchState.curX;
				touchState.startY = touchState.curY;
			}
		}
	}

	this.ontouchend = function(event) {
		event.preventDefault();

		touchState.isDown = false;

		if (touchState.swipeDirection === null) {
			// tap!
			touchState.tapReleased = true;
		}

		touchState.swipeDirection = null;
	}

	this.isKeyDown = function(keyCode) {
		return pressed[keyCode] != null && pressed[keyCode] == true && (ignored[keyCode] == null || ignored[keyCode] == false);
	}

	this.anyKeyPressed = function() {
		return newKeyPress;
	}

	this.resetKeyPressed = function() {
		newKeyPress = false;
	}

	this.swipeLeft = function() {
		return touchState.swipeDirection === BUTTON_KEY.LEFT;
	}

	this.swipeRight = function() {
		return touchState.swipeDirection === BUTTON_KEY.RIGHT;
	}

	this.swipeUp = function() {
		return touchState.swipeDirection === BUTTON_KEY.UP;
	}

	this.swipeDown = function() {
		return touchState.swipeDirection === BUTTON_KEY.DOWN;
	}

	this.isTapReleased = function() {
		return touchState.tapReleased;
	}

	this.resetTapReleased = function() {
		touchState.tapReleased = false;
	}

	this.onblur = function() {
		// console.log("~~~ BLUR ~~");
		resetAll();
	}
}
var input = null;

// todo : the way the returns work here is awkward to me
function movePlayer(direction) {
	if (player().room == null || !Object.keys(room).includes(player().room)) {
		return false; // player room is missing or invalid.. can't move them!
	}

	var result = move(player(), direction, true);
	var spr = result.collidedWith;

	var didPlayerMoveThisFrame = !result.collision;

	var ext = getExit(player().x, player().y);
	var end = getEnding(player().x, player().y);
	var itemInstanceId = getItemId(player().x, player().y);

	// do items first, because you can pick up an item AND go through a door
	if (itemInstanceId != null) {
		var itm = spriteInstances[itemInstanceId];
		var createdAtInit = itm.createdAtInit;
		var itemRoom = player().room;

		startItemDialog(itm, function() {
			// remove item from room
			delete spriteInstances[itemInstanceId];

			// mark item as removed permanently
			if (createdAtInit) {
				room[itemRoom].pickedUpItems.push("_" + itm.id + "_" + itm.originalX + "_" + itm.originalY + "_");
			}

			// update player inventory
			if (player().inventory[itm.id]) {
				player().inventory[itm.id] += 1;
			}
			else {
				player().inventory[itm.id] = 1;
			}

			// show inventory change in UI
			if (onInventoryChanged != null) {
				onInventoryChanged(itm.id);
			}
		});
	}

	if (end) {
		startEndingDialog(end);
	}
	else if (ext) {
		movePlayerThroughExit(ext);
	}
	else if (spr) {
		startSpriteDialog(spr /*spriteInstance*/);
	}

	// map navigation:
	// todo : is the right order for this? (will it ever happen at the same time as another effect from above?)
	function moveToNeighborRoom(mapLocation, dx, dy, transition_effect) {
		var destRoom = map[mapLocation.id].map[mapLocation.y + dy][mapLocation.x + dx];
		var destX = player().x - (dx * roomsize);
		var destY = player().y - (dy * roomsize);
		var prevX = player().x - dx;
		var prevY = player().y - dy;

		if (transition_effect) {
			transition.BeginTransition(player().room, prevX, prevY, destRoom, destX, destY, transition_effect, initRoom);
			transition.UpdateTransition(0);
		}
		else {
			initRoom(destRoom);
		}

		player().room = destRoom;
		player().x = destX;
		player().y = destY;

		curRoom = destRoom;
	}

	var curMapLocation = room[curRoom].mapLocation;

	if (player().x < 0) {
		moveToNeighborRoom(curMapLocation, -1, 0, map[curMapLocation.id].transition_effect_left);
	}
	else if (player().x >= roomsize) {
		moveToNeighborRoom(curMapLocation, 1, 0, map[curMapLocation.id].transition_effect_right);
	}
	else if (player().y < 0) {
		moveToNeighborRoom(curMapLocation, 0, -1, map[curMapLocation.id].transition_effect_up);
	}
	else if (player().y >= roomsize) {
		moveToNeighborRoom(curMapLocation, 0, 1, map[curMapLocation.id].transition_effect_down);
	}

	return !result.collision;
}

function queueButtonDownScripts(keyName, isButtonHeld) {
	for (var i in spriteInstances) {
		var spr = spriteInstances[i];
		if (spr.type != TYPE_KEY.AVATAR && spr.btn != null && (spr.btn in dialog)) {
			queueScript(spr.btn, spr, function() {}, [keyName, isButtonHeld]);
		}
	}
}

function createTileCollisionInstance(tileId, x, y) {
	var definition = tile[tileId];
	var instance = new Table();

	instance.Set("ID", definition.id, { isReadOnly: true, });
	instance.Set("TYPE", definition.type, { isReadOnly: true, }); // todo : "long" names ok?
	instance.Set("NAME", definition.name, { isReadOnly: true, });
	instance.Set("DRW", definition.drw, { isReadOnly: true, });
	instance.Set("BGC", definition.bgc, { isReadOnly: true, });
	instance.Set("COL", definition.col, { isReadOnly: true, });
	instance.Set("X", x, { isReadOnly: true, });
	instance.Set("Y", y, { isReadOnly: true, });
	instance.Set("WAL", true, { isReadOnly: true, });

	return instance;
}

function createRoomWallCollisionInstance(x, y) {
	var instance = new Table();

	// todo : is WAL the right type? or ROOM? or what?
	instance.Set("TYPE", "WAL", { isReadOnly: true, }); // todo : "long" names ok?

	instance.Set("X", x, { isReadOnly: true, });
	instance.Set("Y", y, { isReadOnly: true, });
	instance.Set("WAL", true, { isReadOnly: true, });

	return instance;
}

function move(instance, direction, canEnterNeighborRoom) {
	var x = instance.x + (direction === BUTTON_KEY.LEFT ? -1 : 0) + (direction === BUTTON_KEY.RIGHT ? 1 : 0);
	var y = instance.y + (direction === BUTTON_KEY.UP ? -1 : 0) + (direction === BUTTON_KEY.DOWN ? 1 : 0);

	var collision = false;
	var collisionSprite = null;
	var knockIntoInstances = [];

	if (isRoomEdgeWall(x, y, curRoom, canEnterNeighborRoom)) {
		// todo : is it ok that the coordinates will be OUTSIDE the room? (0,-1) for example?
		knockIntoInstances.push(createRoomWallCollisionInstance(x, y));
		collision = true;
	}

	if (isWall(x, y, curRoom)) {
		var tileId = getTile(x, y);
		knockIntoInstances.push(createTileCollisionInstance(tileId, x, y));
		collision = true;
	}

	var spritesAtDestination = getAllSpritesAt(x, y);
	knockIntoInstances = knockIntoInstances.concat(spritesAtDestination);

	for (var i = 0; i < spritesAtDestination.length; i++) {
		if (spritesAtDestination[i].wal) {
			collision = true;

			// store first collideable sprite for dialog purposes
			if (collisionSprite === null && spritesAtDestination[i].type === "SPR") {
				collisionSprite = spritesAtDestination[i];
			}
		}
	}


	// queue knock into scripts
	for (var i = 0; i < knockIntoInstances.length; i++) {
		var other = knockIntoInstances[i];

		if (instance.nok && dialog[instance.nok]) {
			queueScript(instance.nok, instance, function() {}, [other]);
		}

		if (other.nok && dialog[other.nok]) {
			queueScript(other.nok, other, function() {}, [instance]);
		}
	}

	if (!collision) {
		instance.x = x;
		instance.y = y;
	}

	return { collision: collision, collidedWith: collisionSprite, };
}

function updateLockState(spr) {
	if ("lockItem" in spr && spr.lockItem != null) {
		var itemCount = spr.lockItem in player().inventory ? player().inventory[spr.lockItem] : 0;
		spr.lok = !(itemCount > 0 && itemCount >= spr.lockToll);

		if (!spr.lok) {
			player().inventory[spr.lockItem] -= spr.lockToll;

			// show inventory change in UI
			if (onInventoryChanged != null) {
				onInventoryChanged(spr.lockItem);
			}
		}
	}
}

// todo : is this the best place to init these modules?
var transition = new TransitionManager();
var color = new Color();

function movePlayerThroughExit(ext) {
	var GoToDest = function() {
		if (ext.transition_effect != null) {
			transition.BeginTransition(player().room, player().x, player().y, ext.dest.room, ext.dest.x, ext.dest.y, ext.transition_effect, initRoom);
			transition.UpdateTransition(0);
		}
		else {
			initRoom(ext.dest.room);
		}

		player().room = ext.dest.room;
		player().x = ext.dest.x;
		player().y = ext.dest.y;
		curRoom = ext.dest.room;
	};

	updateLockState(ext);

	if (ext.dlg != undefined && ext.dlg != null) {
		queueScript(
			ext.dlg,
			ext,
			function(result) {
				if (!ext.lok) {
					GoToDest();
				}
			});
	}
	else {
		// todo : move this check inside of GoToDest?
		if (!ext.lok) {
			GoToDest();
		}
	}
}

function initRoom(roomId) {
	// invalidate old sprites
	for (var id in spriteInstances) {
		if (id != NULL_ID) { // skip the avatar
			spriteInstances[id].isValid = false;
			delete spriteInstances[id];
		}
	}

	instanceCount = 0;
	tilemap = createGrid(roomsize);

	function canCreateSpriteInstance(id, x, y) {
		var canCreate = true;

		if (tile[id].type === TYPE_KEY.AVATAR) {
			// avatar creation is handled elsewhere
			canCreate = false;
		}
		else if (tile[id].type === TYPE_KEY.ITEM) {
			var pickUpId = "_" + id + "_" + x + "_" + y + "_";
			if (room[roomId].pickedUpItems.indexOf(pickUpId) != -1) {
				canCreate = false;
			}
		}

		return canCreate;
	}

	// from tilemap
	for (var i = 0; i < roomsize; i++) {
		for (var j = 0; j < roomsize; j++) {
			var tileId = room[roomId].tilemap[i][j];
			if (tileId != NULL_ID) {
				if (tile[tileId].type === TYPE_KEY.TILE) {
					tilemap[i][j] = tileId;
				}
				else if (canCreateSpriteInstance(tileId, j, i)) {
					instanceCount++;
					var instanceId = toB256(instanceCount);
					var instance = createSpriteInstance(instanceId, createSpriteLocation(tileId, j, i));
					instance.createdAtInit = true;
					spriteInstances[instanceId] = instance;
				}
			}
		}
	}

	// from tile overlay
	for (var i = 0; i < room[roomId].tileOverlay.length; i++) {
		var location = room[roomId].tileOverlay[i];

		if (location.id != NULL_ID) {
			if (tile[location.id].type === TYPE_KEY.TILE) {
				tilemap[location.y][location.x] = location.id;
			}
			else if (canCreateSpriteInstance(location.id, location.x, location.y)) {
				instanceCount++;
				var instanceId = toB256(instanceCount);
				var instance = createSpriteInstance(instanceId, location);
				instance.createdAtInit = true;
				spriteInstances[instanceId] = instance;
			}
		}
	}

	instanceCount++;

	var palId = room[roomId].pal;
	color.StoreRoomPalette();

	// todo : is this how I want to do this?
	color.LoadRoomPalette(room[roomId].pal === NULL_ID ? null : palette[palId]);

	color.UpdateSystemPalette();
	renderer.ResetRenderCache();
}

function createSpriteLocation(id, x, y) {
	return {
		id: id,
		x: x,
		y: y,
	};
}

function createSpriteInstance(instanceId, location) {
	var definition = tile[location.id];

	var instance = new Table();

	// todo : which should be public and which private?
	// todo : are the names all the way I want?
	// todo : add read-only
	// todo : what are all the entries I want?
	instance.Set(ENTRY_KEY.SPRITE_ID, definition.id, { externalKey: "id", isReadOnly: true, });
	instance.Set(ENTRY_KEY.SPRITE_TYPE, definition.type, { externalKey: "type", isReadOnly: true, }); // todo : "long" names ok?
	instance.Set(ENTRY_KEY.SPRITE_NAME, definition.name, { externalKey: "name" }); // todo : should also be read only?
	instance.Set(ENTRY_KEY.SPRITE_TILE_ID, definition.drw, { externalKey: "drw" });
	instance.Set(ENTRY_KEY.SPRITE_BACKGROUND, definition.bgc, { externalKey: "bgc" });
	instance.Set(ENTRY_KEY.SPRITE_COLOR, definition.col, { externalKey: "col" });
	instance.Set(ENTRY_KEY.SPRITE_X, location.x, { externalKey: "x" });
	instance.Set(ENTRY_KEY.SPRITE_Y, location.y, { externalKey: "y" });
	instance.Set(ENTRY_KEY.SPRITE_LOCKED, false, { externalKey: "lok" });
	instance.Set(ENTRY_KEY.SPRITE_WALL, definition.isWall, { externalKey: "wal" });
	// other possibilities: SPD, ANM, ???

	instance.SetSecret("instanceId", instanceId);
	instance.SetSecret("isValid", true); // todo : actually use this..
	instance.SetSecret("colorOffset", definition.colorOffset);
	instance.SetSecret("dlg", definition.dlg); // todo : longer names for private entries?
	instance.SetSecret("tik", definition.tickDlgId);
	instance.SetSecret("nok", definition.knockDlgId);
	instance.SetSecret("btn", definition.buttonDownDlgId);
	instance.SetSecret("transition_effect", definition.transition_effect); // exit only
	instance.SetSecret("dest", definition.dest); // exit only // todo : rename "out"?
	instance.SetSecret("lockCondition", definition.lock); // exit & ending only (todo : rename definition field?)
	instance.SetSecret("animation", definition.animation);
	instance.SetSecret("createdAtInit", false);
	instance.SetSecret("originalX", location.x);
	instance.SetSecret("originalY", location.y);

	return instance;
}

function createAvatarInstance(instanceId) {
	var instance = null;

	if (playerId != null) {
		var avatarLocation = createSpriteLocation(playerId, -1, -1);
		var startingRoomId = null;
		var startingInventory = {};

		// find first room containing the player
		for (id in room) {
			for (var y = 0; y < roomsize; y++) {
				for (var x = 0; x < roomsize; x++) {
					if (startingRoomId === null && room[id].tilemap[y][x] === playerId) {
						startingRoomId = id;
						avatarLocation.x = x;
						avatarLocation.y = y;
					}
				}
			}

			for (var i = 0; i < room[id].tileOverlay.length; i++) {
				var location = room[id].tileOverlay[i];
				if (startingRoomId === null && location.id === playerId) {
					startingRoomId = id;
					avatarLocation.x = location.x;
					avatarLocation.y = location.y;
				}
			}
		}

		var instance = createSpriteInstance(instanceId, avatarLocation);

		// copy initial inventory values
		for (id in tile[playerId].inventory) {
			startingInventory[id] = tile[playerId].inventory[id];
		}

		instance.SetSecret("room", startingRoomId);
		instance.SetSecret("inventory", startingInventory);
	}

	return instance;
}

function getItemId(x, y) {
	for (var i in spriteInstances) {
		if (spriteInstances[i].type === "ITM") {
			var itm = spriteInstances[i];
			if (itm.x == x && itm.y == y) {
				return i;
			}
		}
	}

	return null;
}

function isRoomEdgeWall(x, y, roomId, canEnterNeighborRoom) {
	var blocked = false;

	if (roomId == undefined || roomId == null) {
		roomId = curRoom;
	}

	if (x < 0 || x >= roomsize || y < 0 || y >= roomsize) {
		var mapLocation = room[roomId].mapLocation;

		if (canEnterNeighborRoom && mapLocation.id != null) {
			var mapX = mapLocation.x + (x < 0 ? -1 : 0) + (x >= roomsize ? 1 : 0);
			var mapY = mapLocation.y + (y < 0 ? -1 : 0) + (y >= roomsize ? 1 : 0);

			blocked = mapX < 0 || mapX >= mapsize ||
				mapY < 0 || mapY >= mapsize || map[mapLocation.id].map[mapY][mapX] === "0";
		}
		else {
			blocked = true;
		}
	}

	return blocked;
}

function isWall(x, y, roomId) {
	if (roomId == undefined || roomId == null) {
		roomId = curRoom;
	}

	if (x < 0 || x >= roomsize || y < 0 || y >= roomsize) {
		return false;
	}

	var tileId = getTile(x, y);

	if (tileId === '0') {
		return false; // Blank spaces aren't walls, ya doofus
	}

	if (tile[tileId].isWall === undefined || tile[tileId].isWall === null) {
		// No wall-state defined: check room-specific walls
		var i = room[roomId].walls.indexOf(tileId);
		return i > -1;
	}

	// Otherwise, use the tile's own wall-state
	return tile[tileId].isWall;
}

function getItem(roomId, x, y) {
	for (i in spriteInstances) {
		if (spriteInstances[i].type === "ITM") {
			var item = spriteInstances[i];
			if (x == item.x && y == item.y) {
				return item;
			}
		}
	}

	return null;
}

function getExit(x, y) {
	for (i in spriteInstances) {
		if (spriteInstances[i].type === "EXT") {
			var e = spriteInstances[i];
			if (x == e.x && y == e.y) {
				return e;
			}
		}
	}

	return null;
}

function getEnding(x, y) {
	for (i in spriteInstances) {
		if (spriteInstances[i].type === "END") {
			var e = spriteInstances[i];
			if (x == e.x && y == e.y) {
				return e;
			}
		}
	}

	return null;
}

function getTile(x, y) {
	var t = getRoom().tilemap[y][x];
	return t;
}

function player() {
	return (0 in spriteInstances) ? spriteInstances[0] : null;
}

// Sort of a hack for legacy palette code (when it was just an array)
function getPal(id) {
	if (id === NULL_ID || palette[id] === null || palette[id] === undefined) {
		return color.GetDefaultPalette();
	}

	return palette[ id ].colors;
}

function getRoom() {
	return room[curRoom];
}

function isExitValid(e) {
	var hasValidStartPos = e.x >= 0 && e.x < 16 && e.y >= 0 && e.y < 16;
	var hasDest = e.dest != null;
	var hasValidRoomDest = (e.dest.room != null && e.dest.x >= 0 && e.dest.x < 16 && e.dest.y >= 0 && e.dest.y < 16);
	return hasValidStartPos && hasDest && hasValidRoomDest;
}

function createGrid(size) {
	var grid = [];

	for (var i = 0; i < size; i++) {
		var row = [];
		for (var j = 0; j < size; j++) {
			row.push(NULL_ID);
		}

		grid.push(row);
	}

	return grid;
}

function createMap(id) {
	return {
		id : id,
		name : null,
		map : createGrid(mapsize), // todo: name? room_map? world_map?
		transition_effect_up : null,
		transition_effect_down : null,
		transition_effect_left : null,
		transition_effect_right : null,
	};
}

function createRoom(id, palId) {
	return {
		id : id,
		name : null,
		tilemap : createGrid(roomsize),
		tileOverlay : [],
		walls : [], // todo : remove?
		pal : (palId === undefined || palId === null) ? NULL_ID : palId,
		mapLocation : { id: null, x: -1, y :-1, },
		pickedUpItems : [],
	};
}

function createPalette(id, name, colors) {
	return {
		id : id,
		name : name,
		colors : colors,
		indexOffset : COLOR_INDEX.BACKGROUND,
	};
}

function copyDrawingData(sourceDrawingData) {
	var copiedDrawingData = [];

	for (frame in sourceDrawingData) {
		copiedDrawingData.push([]);
		for (y in sourceDrawingData[frame]) {
			copiedDrawingData[frame].push([]);
			for (x in sourceDrawingData[frame][y]) {
				copiedDrawingData[frame][y].push(sourceDrawingData[frame][y][x]);
			}
		}
	}

	return copiedDrawingData;
}

function createDrawing(id, sourceDrawingData) {
	var drawingData;

	// if no image data is provided, initialize an empty initial frame
	if (!sourceDrawingData) {
		drawingData = [[]];

		for (var i = 0; i < tilesize; i++) {
			drawingData[0].push([])

			for (var j = 0; j < tilesize; j++) {
				drawingData[0][i].push(0);
			}
		}
	}
	else {
		// TODO : provide option to not copy?
		drawingData = copyDrawingData(sourceDrawingData);
	}

	renderer.SetTileSource(id, drawingData);
}

// TODO : refactor so this follows pattern of other create* methods?
function createTile(id, type, options) {
	function valueOrDefault(value, defaultValue) {
		return value != undefined && value != null ? value : defaultValue;
	}

	var isPlayer = (type === TYPE_KEY.AVATAR); // todo : back compat?

	var drwId = id;
	var inventory = isPlayer && options.inventory ? options.inventory : null;
	var isWall = (type === TYPE_KEY.TILE) && options.isWall != undefined ? options.isWall : null;
	var isUnique = isPlayer;

	var isWall = false;

	if ((type === TYPE_KEY.TILE) && options.isWall != undefined) {
		isWall = options.isWall;
	}
	else if (type === TYPE_KEY.SPRITE) {
		isWall = true;
	}

	createDrawing(drwId, options.drawingData);

	tile[id] = {
		id: id, // unique ID
		type: type, // default behavior: is it a sprite, item, or tile?
		name : valueOrDefault(options.name, null), // user-supplied name
		drw: drwId, // drawing ID
		colorOffset: COLOR_INDEX.BACKGROUND, // color offset start for global palette
		bgc: valueOrDefault(options.bgc, 0), // background color index
		col: valueOrDefault(options.col, (type === TYPE_KEY.TILE ? 1 : 2)), // color index
		animation : { // animation data // TODO: figure out how this works with instances
			isAnimated : (renderer.GetFrameCount(drwId) > 1),
			frameIndex : 0,
			frameCount : renderer.GetFrameCount(drwId),
		},
		dlg: valueOrDefault(options.dlg, null), // dialog ID (NOTE: tiles don't use this)
		tickDlgId: valueOrDefault(options.tickDlgId, null),
		knockDlgId: valueOrDefault(options.knockDlgId, null),
		buttonDownDlgId: valueOrDefault(options.buttonDownDlgId, null),
		inventory : inventory, // starting inventory (player only)
		isWall : isWall, // does this tile block sprites from entering?
		isUnique : isUnique, // only one instance allowed? (player only)
		transition_effect : valueOrDefault(options.transition_effect, null), // exit only
		dest : {
			room : valueOrDefault(options.destRoom, null), // exit only
			x : valueOrDefault(options.destX, 0), // exit only
			y : valueOrDefault(options.destY, 0), // exit only
		},
		lockItem : valueOrDefault(options.lockItem, null), // exit & ending only
		lockToll : valueOrDefault(options.lockToll, 0), // exit & ending only
	};
}

// todo : name of function?
function createScript(id, name, script) {
	return {
		id : id,
		name : name,
		src : script,
	};
}

function drawRoom(room, options) {
	function getOptionOrDefault(optionId, defaultValue) {
		var doesOptionExist = (options != undefined && options != null) && (options[optionId] != undefined && options[optionId] != null);
		return doesOptionExist ? options[optionId] : defaultValue;
	}

	var frameIndex = getOptionOrDefault("frameIndex", null);
	var drawInstances = getOptionOrDefault("drawInstances", true);

	var renderOptions = { frameIndex: frameIndex, };

	var renderTarget = options && options.target ? options.target : renderer.CreateScreenTarget();

	// clear screen
	renderTarget.Clear();

	if (room === undefined && room === null) {
		// protect against invalid rooms
		return;
	}

	var background = tilemap;
	var foreground = createGrid(roomsize);

	if (drawInstances) {
		// make sprite grid
		var spriteIdList = sortedIdList(spriteInstances); // perf?

		for (var i = 0; i < spriteIdList.length; i++) {
			var id = spriteIdList[i];

			if (id != NULL_ID) {
				var instance = spriteInstances[id];
				foreground[instance.y][instance.x] = instance.id;
			}
		}

		// draw avatar last
		if (NULL_ID in spriteInstances && spriteInstances[NULL_ID] != null) {
			var instance = spriteInstances[NULL_ID];
			foreground[instance.y][instance.x] = instance.id;
		}
	}
	else {
		// for edit mode // todo : consolidate?
		for (var i = 0; i < room.tilemap.length; i++) {
			for (var j = 0; j < room.tilemap[i].length; j++) {
				var id = room.tilemap[i][j];

				if (id != NULL_ID && tile[id] != null) {
					if (tile[id].type === TYPE_KEY.TILE) {
						background[i][j] = id;
					}
					else {
						foreground[i][j] = id;
					}
				}
			}
		}

		for (var i = 0; i < room.tileOverlay.length; i++) {
			var location = room.tileOverlay[i];

			if (location.id != NULL_ID && tile[location.id] != null) {
				if (tile[location.id].type === TYPE_KEY.TILE) {
					background[i][j] = location.id;
				}
				else {
					foreground[i][j] = location.id;
				}
			}
		}
	}

	// draw tiles
	for (var i = 0; i < background.length; i++) {
		for (var j = 0; j < background[i].length; j++) {
			var id = background[i][j];

			if (id != NULL_ID && tile[id] != null) {
				renderTarget.DrawTile(id, j, i, renderOptions);
			}
		}
	}

	// draw sprites
	for (var i = 0; i < foreground.length; i++) {
		for (var j = 0; j < foreground[i].length; j++) {
			var id = foreground[i][j];

			if (id != NULL_ID && tile[id] != null) {
				renderTarget.DrawSprite(tile[id], j, i, renderOptions);
			}
		}
	}
}

function getRoomPal(roomId) {
	var defaultId = null; // todo : refactor to simplify this?

	if (roomId == null) {
		return defaultId;
	}
	else if (room[roomId].pal != null) {
		//a specific palette was chosen
		return room[roomId].pal;
	}
	else {
		if (roomId in palette) {
			//there is a palette matching the name of the room
			return roomId;
		}
		else {
			//use the default palette
			return defaultId;
		}
	}

	return defaultId;
}

var isNarrating = false;
var isEnding = false;
var dialogModule = new Dialog();
var dialogRenderer = dialogModule.CreateRenderer();
var dialogBuffer = dialogModule.CreateBuffer();
var fontManager = new FontManager();

function startTitle() {
	isNarrating = true;
	isEnding = false;

	dialogRenderer.Reset();
	dialogRenderer.SetCentered(true);
	dialogBuffer.Reset();

	scriptNext.Run(dialog[titleDialogId], null, function() {
		// TODO : can we refactor this part? do script queue scripts need this?
		dialogBuffer.OnDialogEnd(function() {
			isNarrating = false;
		});
	});
}

function startEndingDialog(ending) {
	// TODO : remove back compat with old endings once I'm sure I want to use this...
	var endingId = "dlg" in ending ? ending.dlg : ending.id;

	updateLockState(ending);

	queueScript(
		endingId,
		ending,
		function() {
			// todo : the nested callbacks are a bit much..
			dialogBuffer.OnDialogEnd(function() {
				isNarrating = false;

				if (ending.lok) {
					isEnding = false;
				}
			});
		},
		null,
		function() {
			isNarrating = true;
			isEnding = true;
		});
}

function startItemDialog(itemInstance, callback) {
	var tryCallback = function() {
		if (!itemInstance.lok && callback) {
			callback();
		}
	};

	var itemDlgId = itemInstance.dlg;

	if (dialog[itemDlgId]) {
		queueScript(itemDlgId, itemInstance, tryCallback);
	}
	else {
		tryCallback();
	}
}

function startSpriteDialog(spriteInstance) {
	var dialogId = spriteInstance.dlg;
	if (dialog[dialogId]) {
		queueScript(dialogId, spriteInstance, function() {});
	}
}

// TODO : re-implement
var isDialogPreview = false;
function startPreviewDialog(script, dialogCallback) {
	isNarrating = true;

	isDialogMode = true;

	isDialogPreview = true;

	dialogRenderer.Reset();
	dialogRenderer.SetCentered(true);
	dialogBuffer.Reset();
	scriptInterpreter.SetDialogBuffer(dialogBuffer);

	// TODO : do I really need a seperate callback for this debug mode??
	onDialogPreviewEnd = dialogCallback;

	var onScriptEndCallback = function(scriptResult) {
		dialogBuffer.OnDialogEnd(function() {
			onExitDialog(scriptResult, null);
		});
	};

	scriptInterpreter.Eval(script, onScriptEndCallback);
}

/* NEW SCRIPT STUFF */
var scriptModule = new Script();
var scriptInterpreter = scriptModule.CreateInterpreter();
var scriptUtils = scriptModule.CreateUtils(); // TODO: move to editor.js?
// scriptInterpreter.SetDialogBuffer( dialogBuffer );

/* SCRIPT NEXT */
var library = new Library();
var scriptNext = new ScriptNext();
