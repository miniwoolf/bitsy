/*
TODO general
- test all tools / buttons

TODO script_next
- rename object storage to sprite or tile?

TODO maps
- transitions?
- other properties for maps?
- is it ok to make room "0" invalid
- what should the low id be for maps? 0? 1?
- should avatar be able to enter neighboring room when moved via script???
- what should happen if you immediately land on an exit, ending, or item when entering a new room via the map??
*/

var xhr; // TODO : remove
var canvas;
var context; // TODO : remove if safe?
var ctx;

var map = {};
var room = {};
var object = {}; // TODO : name? (other options: drawing, entity, sprite)
var dialog = {};
var palette = { //start off with a default palette
		"default" : {
			name : "default",
			colors : [[0,0,0],[255,255,255],[255,255,255]]
		}
	};
var variable = {}; // these are starting variable values -- they don't update (or I don't think they will)
var playerId = "A";

/*
  Instance System
  TODO
  - should these be global, or associated with rooms?
  - can the player instance be combined with the object instance holder?
  - how do we manage instance IDs so they can be accessed from scripts?
*/
var playerInstance = {};
var objectInstances = {};
var nextObjectInstanceId = 0;
var exitInstances = [];
var endingInstances = [];

var titleDialogId = "title";
function getTitle() {
	return dialog[titleDialogId].src;
}
function setTitle(titleSrc) {
	dialog[titleDialogId] = { id:titleDialogId, src:titleSrc, name:null };
}

var defaultFontName = "ascii_small";
var fontName = defaultFontName;
var TextDirection = {
	LeftToRight : "LTR",
	RightToLeft : "RTL"
};
var textDirection = TextDirection.LeftToRight;

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
	names.tile = createNameMap(tile);
	names.sprite = createNameMap(sprite);
	names.item = createNameMap(item);
	names.dialog = createNameMap(dialog);
}

/* VERSION */
var version = {
	major: 7, // major changes
	minor: 2, // smaller changes
	devBuildPhase: "RELEASE",
};
function getEngineVersion() {
	return version.major + "." + version.minor;
}

/* FLAGS */
var flags;
function resetFlags() {
	flags = {
		ROOM_FORMAT : 0 // 0 = non-comma separated, 1 = comma separated
	};
}
resetFlags(); //init flags on load script

// SUPER hacky location... :/
var editorDevFlags = {
	// NONE right now!
};

function clearGameData() {
	room = {};
	item = {};
	object = {};
	dialog = {};
	palette = { //start off with a default palette
		"default" : {
			name : "default",
			colors : [[0,0,0],[255,255,255],[255,255,255]]
		}
	};
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
	textDirection = TextDirection.LeftToRight;
}

var width = 128;
var height = 128;
var scale = 4; //this is stupid but necessary
var tilesize = 8;
var roomsize = 16;
var mapsize = 8;

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

var renderer = new Renderer(tilesize, scale);

function getGameNameFromURL() {
	var game = window.location.hash.substring(1);
	// console.log("game name --- " + game);
	return game;
}

function attachCanvas(c) {
	canvas = c;
	canvas.width = width * scale;
	canvas.height = width * scale;
	ctx = canvas.getContext("2d");
	dialogRenderer.AttachContext(ctx);
	renderer.AttachContext(ctx);
}

var curGameData = null;
function load_game(game_data, startWithTitle) {
	curGameData = game_data; //remember the current game (used to reset the game)

	dialogBuffer.Reset();
	scriptInterpreter.ResetEnvironment(); // ensures variables are reset -- is this the best way?
	scriptNext.Reset();

	parseWorld(game_data);

	playerInstance = createPlayerInstance(object[playerId]);
	console.log(playerInstance);

	// set the first room
	var roomIds = Object.keys(room);
	if (player() != undefined && player().room != null && roomIds.includes(player().room)) {
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
	if(startWithTitle === undefined || startWithTitle === null) startWithTitle = true;

	clearInterval(loading_interval);

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

	update_interval = setInterval(update,16);

	if (startWithTitle) { // used by editor 
		startTitle();
	}
}

// TODO : merge with createObjectInstance
function createPlayerInstance(playerDefinition) {
	var instance = {
		id: playerDefinition.id,
		drw: playerDefinition.drw,
		room: null,
		x: -1,
		y: -1,
		inventory : {},
		stp: playerDefinition.stp,
		key: playerDefinition.key,
		hit: playerDefinition.hit,
		// TODO : kind of hacky to copy these around since they don't vary from the definition -- revisit?
		col: playerDefinition.col,
		animation: playerDefinition.animation,
	};

	// copy initial inventory values
	for (id in playerDefinition.inventory) {
		instance.inventory[id] = playerDefinition.inventory[id];
	}

	// try to find a room containing the player
	for (id in room) {
		for (var i = 0; i < room[id].objects.length; i++) {
			var objectLocation = room[id].objects[i];
			if (objectLocation.id === playerId) {
				instance.room = id;
				instance.x = objectLocation.x;
				instance.y = objectLocation.y;
			}
		}
	}

	return instance;
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

/* loading animation */
var loading_anim_data = [
	[
		0,1,1,1,1,1,1,0,
		0,0,1,1,1,1,0,0,
		0,0,1,1,1,1,0,0,
		0,0,0,1,1,0,0,0,
		0,0,0,1,1,0,0,0,
		0,0,1,0,0,1,0,0,
		0,0,1,0,0,1,0,0,
		0,1,1,1,1,1,1,0,
	],
	[
		0,1,1,1,1,1,1,0,
		0,0,1,0,0,1,0,0,
		0,0,1,1,1,1,0,0,
		0,0,0,1,1,0,0,0,
		0,0,0,1,1,0,0,0,
		0,0,1,0,0,1,0,0,
		0,0,1,1,1,1,0,0,
		0,1,1,1,1,1,1,0,
	],
	[
		0,1,1,1,1,1,1,0,
		0,0,1,0,0,1,0,0,
		0,0,1,0,0,1,0,0,
		0,0,0,1,1,0,0,0,
		0,0,0,1,1,0,0,0,
		0,0,1,1,1,1,0,0,
		0,0,1,1,1,1,0,0,
		0,1,1,1,1,1,1,0,
	],
	[
		0,1,1,1,1,1,1,0,
		0,0,1,0,0,1,0,0,
		0,0,1,0,0,1,0,0,
		0,0,0,1,1,0,0,0,
		0,0,0,1,1,0,0,0,
		0,0,1,1,1,1,0,0,
		0,0,1,1,1,1,0,0,
		0,1,1,1,1,1,1,0,
	],
	[
		0,0,0,0,0,0,0,0,
		1,0,0,0,0,0,0,1,
		1,1,1,0,0,1,1,1,
		1,1,1,1,1,0,0,1,
		1,1,1,1,1,0,0,1,
		1,1,1,0,0,1,1,1,
		1,0,0,0,0,0,0,1,
		0,0,0,0,0,0,0,0,
	]
];
var loading_anim_frame = 0;
var loading_anim_speed = 500;
var loading_interval = null;

function loadingAnimation() {
	//create image
	var loadingAnimImg = ctx.createImageData(8*scale, 8*scale);
	//draw image
	for (var y = 0; y < 8; y++) {
		for (var x = 0; x < 8; x++) {
			var i = (y * 8) + x;
			if (loading_anim_data[loading_anim_frame][i] == 1) {
				//scaling nonsense
				for (var sy = 0; sy < scale; sy++) {
					for (var sx = 0; sx < scale; sx++) {
						var pxl = 4 * ( (((y*scale)+sy) * (8*scale)) + ((x*scale)+sx) );
						loadingAnimImg.data[pxl+0] = 255;
						loadingAnimImg.data[pxl+1] = 255;
						loadingAnimImg.data[pxl+2] = 255;
						loadingAnimImg.data[pxl+3] = 255;
					}
				}
			}
		}
	}
	//put image on canvas
	ctx.putImageData(loadingAnimImg,scale*(width/2 - 4),scale*(height/2 - 4));
	//update frame
	loading_anim_frame++;
	if (loading_anim_frame >= 5) loading_anim_frame = 0;
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

function updateRender() {
	// clear the screen!
	ctx.fillStyle = "rgb(" + getPal(curPal())[0][0] + "," + getPal(curPal())[0][1] + "," + getPal(curPal())[0][2] + ")";
	ctx.fillRect(0,0,canvas.width,canvas.height);

	if (transition.IsTransitionActive()) {
		// transitions take over everything!
		transition.UpdateTransition(deltaTime);
	}
	else {
		if (!isNarrating && !isEnding) {
			updateAnimation();
			drawRoom(room[curRoom]);
		}

		if (dialogBuffer.IsActive()) {
			dialogRenderer.Draw(dialogBuffer, deltaTime);
			dialogBuffer.Update(deltaTime);
		}
	}
}

function updateInput() {
	if (transition.IsTransitionActive()) {
		// do nothing
	}
	else if (dialogBuffer.IsActive()) {
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
			curPlayerDirection = Direction.Left;
		}
		else if (input.isKeyDown(key.right) || input.isKeyDown(key.d) || input.swipeRight()) {
			curPlayerDirection = Direction.Right;
		}
		else if (input.isKeyDown(key.up) || input.isKeyDown(key.w) || input.swipeUp()) {
			curPlayerDirection = Direction.Up;
		}
		else if (input.isKeyDown(key.down) || input.isKeyDown(key.s) || input.swipeDown()) {
			curPlayerDirection = Direction.Down;
		}
		else {
			curPlayerDirection = Direction.None;
		}

		function tryMovePlayer(direction) {
			if (playerInstance.key != null) {
				queueScript(
					playerInstance.key,
					playerInstance,
					function(result) {
						if (result != false) {
							movePlayer(direction);
						}
						queueKeyDownScripts(direction);
					},
					[directionToKeyName(direction)]);
			}
			else {
				movePlayer(direction);
				queueKeyDownScripts(direction);
			}
		}

		if (curPlayerDirection != Direction.None) {
			if (curPlayerDirection != prevPlayerDirection) {
				// new direction!
				tryMovePlayer(curPlayerDirection);
				playerHoldToMoveTimer = 500;
			}
			else {
				// held
				playerHoldToMoveTimer -= deltaTime;

				if (playerHoldToMoveTimer <= 0) {
					tryMovePlayer(curPlayerDirection);
					playerHoldToMoveTimer = 150;
				}
			}
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
	// SRIPT NEXT
	// TODO : make this real!
	// trigger animation step scripts
	// TODO : will have to be re-written after merging objects
	// TODO : instead of immediately triggering scripts, put them in a queue
	if (!isNarrating && !isEnding && !dialogBuffer.IsActive() && !transition.IsTransitionActive() && !isScriptQueueBusy()) {
		if (animationCounter === 0) {
			// TODO : ok it's awkward to have the player instance be so special... should it be included in the object list?
			if (playerInstance.stp != null) {
				queueScript(playerInstance.stp, playerInstance, function() {});
			}

			for (var i in objectInstances) {
				var obj = objectInstances[i];
				if (obj.stp != null) {
					queueScript(obj.stp, obj, function() {});
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

		// TODO : ending?

		var onScriptEnd = function(value) {
			if (scriptInfo.callback) {
				scriptInfo.callback(value);
			}

			isScriptRunning = false;
		};

		if (scriptInfo.parameters != undefined && scriptInfo.parameters != null) {
			// TODO : should script info have a bool for this?
			// should the run function have a bool?
			scriptNext.RunCallback(dialog[scriptInfo.id], scriptInfo.objectContext, scriptInfo.parameters, onScriptEnd);
		}
		else {
			scriptNext.Run(dialog[scriptInfo.id], scriptInfo.objectContext, onScriptEnd);
		}
	}
}

function queueScript(scriptId, objectContext, callback, parameters) {
	scriptQueue.push({
		id: scriptId,
		objectContext: objectContext,
		callback: callback,
		parameters: parameters, // for scripts with callbacks: should I make that explicit?
	});
}

var animationCounter = 0;
var animationTime = 400;
function updateAnimation() {
	animationCounter += deltaTime;

	if (animationCounter >= animationTime) {
		for (id in object) {
			var obj = object[id];
			if (obj.animation.isAnimated) {
				obj.animation.frameIndex = (obj.animation.frameIndex + 1) % obj.animation.frameCount;
			}
		}

		// reset counter
		animationCounter = 0;

	}
}

function resetAllAnimations() {
	for (id in object) {
		var obj = object[id];
		if (obj.animation.isAnimated) {
			obj.animation.frameIndex = 0;
		}
	}
}

function getSpriteAt(x,y) {
	for (var i in objectInstances) {
		if (objectInstances[i].type === "SPR" &&
			objectInstances[i].x === x && objectInstances[i].y === y) {
			return objectInstances[i];
		}
	}

	return null;
}

var Direction = {
	None : -1,
	Up : 0,
	Down : 1,
	Left : 2,
	Right : 3
};

var curPlayerDirection = Direction.None;
var playerHoldToMoveTimer = 0;

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
			swipeDirection : Direction.None,
			tapReleased : false
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

			touchState.swipeDirection = Direction.None;
		}
	}

	this.ontouchmove = function(event) {
		event.preventDefault();

		if( touchState.isDown && event.changedTouches.length > 0 ) {
			touchState.curX = event.changedTouches[0].clientX;
			touchState.curY = event.changedTouches[0].clientY;

			var prevDirection = touchState.swipeDirection;

			if( touchState.curX - touchState.startX <= -touchState.swipeDistance ) {
				touchState.swipeDirection = Direction.Left;
			}
			else if( touchState.curX - touchState.startX >= touchState.swipeDistance ) {
				touchState.swipeDirection = Direction.Right;
			}
			else if( touchState.curY - touchState.startY <= -touchState.swipeDistance ) {
				touchState.swipeDirection = Direction.Up;
			}
			else if( touchState.curY - touchState.startY >= touchState.swipeDistance ) {
				touchState.swipeDirection = Direction.Down;
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

		if( touchState.swipeDirection == Direction.None ) {
			// tap!
			touchState.tapReleased = true;
		}

		touchState.swipeDirection = Direction.None;
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
		return touchState.swipeDirection == Direction.Left;
	}

	this.swipeRight = function() {
		return touchState.swipeDirection == Direction.Right;
	}

	this.swipeUp = function() {
		return touchState.swipeDirection == Direction.Up;
	}

	this.swipeDown = function() {
		return touchState.swipeDirection == Direction.Down;
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

	var didPlayerMoveThisFrame = !result.collision;
	var spr = result.collidedWith;

	var ext = getExit(player().x, player().y);
	var end = getEnding(player().x, player().y);
	var itmIndex = getItemIndex(player().x, player().y);

	// do items first, because you can pick up an item AND go through a door
	if (itmIndex > -1) {
		var itm = objectInstances[itmIndex];
		var itemRoom = player().room;

		startItemDialog(itm, function() {
			// remove item from room
			delete objectInstances[itmIndex];

			// mark item as removed permanently
			// (assumes instanceId === location index)
			if (room[itemRoom].objects[itm.instanceId]) {
				room[itemRoom].objects[itm.instanceId].removed = true;
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
	// todo : is the right order for this?
	// todo : stop all the copy pasting?
	if (player().x < 0) {
		var curMapLocation = room[curRoom].mapLocation;
		var nextRoom = map[curMapLocation.id].map[curMapLocation.y][curMapLocation.x - 1];
		player().room = nextRoom
		player().x += roomsize;
		curRoom = nextRoom;
		initRoom(curRoom);
	}
	else if (player().x >= roomsize) {
		var curMapLocation = room[curRoom].mapLocation;
		var nextRoom = map[curMapLocation.id].map[curMapLocation.y][curMapLocation.x + 1];
		player().room = nextRoom
		player().x -= roomsize;
		curRoom = nextRoom;
		initRoom(curRoom);
	}
	else if (player().y < 0) {
		var curMapLocation = room[curRoom].mapLocation;
		var nextRoom = map[curMapLocation.id].map[curMapLocation.y - 1][curMapLocation.x];
		player().room = nextRoom
		player().y += roomsize;
		curRoom = nextRoom;
		initRoom(curRoom);
	}
	else if (player().y >= roomsize) {
		var curMapLocation = room[curRoom].mapLocation;
		var nextRoom = map[curMapLocation.id].map[curMapLocation.y + 1][curMapLocation.x];
		player().room = nextRoom
		player().y -= roomsize;
		curRoom = nextRoom;
		initRoom(curRoom);
	}

	return !result.collision;
}

function queueKeyDownScripts(direction) {
	for (var i in objectInstances) {
		var obj = objectInstances[i];
		if (obj.key != null && (obj.key in dialog)) {
			queueScript(obj.key, obj, function() {}, [directionToKeyName(direction)]);
		}
	}
}

function move(object, direction, canEnterNeighborRoom) {
	var x = object.x + (direction === Direction.Left ? -1 : 0) + (direction === Direction.Right ? 1 : 0);
	var y = object.y + (direction === Direction.Up ? -1 : 0) + (direction === Direction.Down ? 1 : 0);

	// TODO: handle collisions with things other than sprites?
	var spr = null;

	var collision = (spr = getSpriteAt(x, y)) || isWall(x, y, curRoom, canEnterNeighborRoom);

	if (collision) {
		// todo : shoudl I provide more info about walls? what about the screen edges?
		var other = spr ? spr : { type : "TIL" };

		// queue collision scripts
		// TODO : should these go at the back of the line or the front?

		if (dialog[object.hit]) {
			queueScript(object.hit, object, function() {}, [other]);
		}

		if (spr != null && dialog[spr.hit]) {
			queueScript(spr.hit, spr, function() {}, [object]);
		}
	}
	else {
		object.x = x;
		object.y = y;
	}

	return { collision: collision, collidedWith: spr };
}

function keyNameToDirection(keyName) {
	switch (keyName) {
		case "left":
			return Direction.Left;
		case "right":
			return Direction.Right;
		case "up":
			return Direction.Up;
		case "down":
			return Direction.Down;
		default:
			return Direction.None;
	}
}

function directionToKeyName(direction) {
	switch (direction) {
		case Direction.Left:
			return "left";
		case Direction.Right:
			return "right";
		case Direction.Up:
			return "up";
		case Direction.Down:
			return "down";
		default:
			return null; // todo : error -- how to handle?
	}
}

var transition = new TransitionManager();

function movePlayerThroughExit(ext) {
	var GoToDest = function() {
		if (ext.transition_effect != null) {
			transition.BeginTransition(player().room, player().x, player().y, ext.dest.room, ext.dest.x, ext.dest.y, ext.transition_effect);
			transition.UpdateTransition(0);
		}

		player().room = ext.dest.room;
		player().x = ext.dest.x;
		player().y = ext.dest.y;
		curRoom = ext.dest.room;

		initRoom(curRoom);
	};

	if (ext.dlg != undefined && ext.dlg != null) {
		queueScript(
			ext.dlg,
			ext,
			function(result) {
				var isLocked = ext.property && ext.property.Get("locked") === true;
				if (!isLocked) {
					GoToDest();
				}
			});
	}
	else {
		GoToDest();
	}
}

function initRoom(roomId) {
	// init exit instances
	exitInstances = [];
	for (var i = 0; i < room[roomId].exits.length; i++) {
		exitInstances.push(createExitInstance(room[roomId].exits[i]));
	}

	// init ending instances
	endingInstances = [];
	for (var i = 0; i < room[roomId].endings.length; i++) {
		endingInstances.push(createEndingInstance(room[roomId].endings[i]));
	}

	// init objects
	objectInstances = {};
	nextObjectInstanceId = 0;
	for (var i = 0; i < room[roomId].objects.length; i++) {
		var objectLocation = room[roomId].objects[i];
		nextObjectInstanceId = i;
		if (objectLocation.id != playerId && !objectLocation.removed) {
			var objectInstance = createObjectInstance(nextObjectInstanceId, objectLocation);
			objectInstances[nextObjectInstanceId] = objectInstance;
		}
	}

	nextObjectInstanceId++;
}

function createObjectLocation(id, x, y) {
	return {
		id: id,
		x: x,
		y: y,
	};
}

function PropertyHolder() {
	var accessors = {};

	this.Add = function(propertyName, getFunction, setFunction) {
		var propertyAccessor = {
			getFunction: getFunction,
			setFunction: setFunction,
		}

		accessors[propertyName] = propertyAccessor;
	}

	this.Has = function(propertyName) {
		return accessors.hasOwnProperty(propertyName);
	}

	this.Get = function(propertyName) {
		if (this.Has(propertyName)) {
			return accessors[propertyName].getFunction();
		}
		else {
			return null;
		}
	}

	function createDefaultPropertyAccessor(value) {
		var property = {
			value: value,
		};

		property.getFunction = function() {
			return property.value;
		}

		property.setFunction = function(value) {
			property.value = value;
		}

		return property;
	}

	this.Set = function(propertyName, value) {
		if (this.Has(propertyName)) {
			accessors[propertyName].setFunction(value);
		}
		else {
			// create new default property if none exists
			accessors[propertyName] = createDefaultPropertyAccessor(value);
		}
	}
}

function createObjectInstance(instanceId, objectLocation) {
	var definition = object[objectLocation.id];

	var instance = {
		instanceId: instanceId, // currently equivalent to the index in the room list -- is it ok to remain that way?
		id: definition.id,
		type: definition.type,
		drw: definition.drw,
		dlg: definition.dlg,
		stp: definition.stp,
		key: definition.key,
		hit: definition.hit,
		x: objectLocation.x,
		y: objectLocation.y,
		property: new PropertyHolder(),
		// TODO : kind of hacky to copy these around since they don't vary from the definition -- revisit?
		col: definition.col,
		animation: definition.animation,
	};

	instance.property.Add(
		"x",
		function() { return instance.x; },
		function(value) { instance.x = value; });

	instance.property.Add(
		"y",
		function() { return instance.y; },
		function(value) { instance.y = value; });

	// TODO : name?
	instance.property.Add(
		"drawing",
		function() { return instance.drw; },
		function(value) { instance.drw = value; console.log(instance); });

	return instance;
}

function createExitInstance(exitDefinition) {
	var instance = {
		x: exitDefinition.x,
		y: exitDefinition.y,
		dest: {
			room: exitDefinition.dest.room,
			x: exitDefinition.dest.x,
			y: exitDefinition.dest.y,
		},
		transition_effect: exitDefinition.transition_effect,
		dlg: exitDefinition.dlg,
		property: new PropertyHolder(),
	};

	instance.property.Set("locked", false);

	return instance;
}

function createEndingInstance(endingDefinition) {
	var instance = {
		id: endingDefinition.id,
		x: endingDefinition.x,
		y: endingDefinition.y,
		property: new PropertyHolder(),
	};

	instance.property.Set("locked", false);

	return instance;
}

function getItemIndex(x, y) {
	for (var i in objectInstances) {
		if (objectInstances[i].type === "ITM") {
			var itm = objectInstances[i];
			if (itm.x == x && itm.y == y) {
				return i;
			}
		}
	}

	return -1;
}

function isWall(x, y, roomId, canEnterNeighborRoom) {
	if (roomId == undefined || roomId == null) {
		roomId = curRoom;
	}

	if (x < 0 || x >= roomsize || y < 0 || y >= roomsize) {
		var mapLocation = room[roomId].mapLocation;
		if (canEnterNeighborRoom && mapLocation.id != null) {
			var mapX = mapLocation.x + (x < 0 ? -1 : 0) + (x >= roomsize ? 1 : 0);
			var mapY = mapLocation.y + (y < 0 ? -1 : 0) + (y >= roomsize ? 1 : 0);
			return mapX < 0 || mapX >= mapsize || mapY < 0 || mapY >= mapsize || map[mapLocation.id].map[mapY][mapX] === "0";
		}
		else {
			return true;
		}
	}

	var tileId = getTile(x, y);

	if (tileId === '0') {
		return false; // Blank spaces aren't walls, ya doofus
	}

	if (object[tileId].isWall === undefined || object[tileId].isWall === null) {
		// No wall-state defined: check room-specific walls
		var i = room[roomId].walls.indexOf(tileId);
		return i > -1;
	}

	// Otherwise, use the tile's own wall-state
	return object[tileId].isWall;
}

function getObjectLocation(roomId, x, y) {
	for (i in room[roomId].objects) {
		var obj = room[roomId].objects[i];
		if (x == obj.x && y == obj.y) {
			return obj;
		}
	}

	return null;
}

function getItem(roomId, x, y) {
	for (i in objectInstances) {
		if (objectInstances[i].type === "ITM") {
			var item = objectInstances[i];
			if (x == item.x && y == item.y) {
				return item;
			}
		}
	}

	return null;
}

function getExit(x, y) {
	for (i in exitInstances) {
		var e = exitInstances[i];
		if (x == e.x && y == e.y) {
			return e;
		}
	}

	return null;
}

function getEnding(x, y) {
	for (i in endingInstances) {
		var e = endingInstances[i];
		if (x == e.x && y == e.y) {
			return e;
		}
	}

	return null;
}

function getTile(x,y) {
	// console.log(x + " " + y);
	var t = getRoom().tilemap[y][x];
	return t;
}

function player() {
	return playerInstance;
}

// Sort of a hack for legacy palette code (when it was just an array)
function getPal(id) {
	if (palette[id] === undefined) {
		id = "default";
	}

	return palette[ id ].colors;
}

function getRoom() {
	return room[curRoom];
}

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

	var lines = file.split("\n");
	var i = 0;
	while (i < lines.length) {
		var curLine = lines[i];

		// console.log(lines[i]);

		if (i == 0) {
			i = parseTitle(lines, i);
		}
		else if (curLine.length <= 0 || curLine.charAt(0) === "#") {
			// collect version number (from a comment.. hacky I know)
			if (curLine.indexOf("# BITSY VERSION ") != -1) {
				versionNumber = parseFloat(curLine.replace("# BITSY VERSION ", ""));

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
		else if (getType(curLine) == "PAL") {
			i = parsePalette(lines, i);
		}
		else if (getType(curLine) === "ROOM" || getType(curLine) === "SET") { //SET for back compat
			i = parseRoom(lines, i, compatibilityFlags);
		}
		else if (getType(curLine) === "MAP") {
			i = parseMap(lines, i);
		}
		else if (getType(curLine) === "TIL" || getType(curLine) === "SPR" || getType(curLine) === "ITM") {
			i = parseObject(lines, i, getType(curLine));
		}
		else if (getType(curLine) === "DLG") {
			i = parseDialog(lines, i, compatibilityFlags);
		}
		else if (getType(curLine) === "END" && compatibilityFlags.combineEndingsWithDialog) {
			// parse endings for back compat
			i = parseEnding(lines, i, compatibilityFlags);
		}
		else if (getType(curLine) === "VAR") {
			i = parseVariable(lines, i);
		}
		else if (getType(curLine) === "DEFAULT_FONT") {
			i = parseFontName(lines, i);
		}
		else if (getType(curLine) === "TEXT_DIRECTION") {
			i = parseTextDirection(lines, i);
		}
		else if (getType(curLine) === "FONT") {
			i = parseFontData(lines, i);
		}
		else if (getType(curLine) === "!") {
			i = parseFlag(lines, i);
		}
		else {
			i++;
		}
	}

	// clean up any excess unique objects (TODO : is this the best way to do this?)
	var foundUniqueObject = {};
	for (id in room) {
		for (var i = room[id].objects.length - 1; i >= 0; i--) {
			var objectId = room[id].objects[i].id;
			if (foundUniqueObject[objectId]) {
				// this unique object already has a location!
				room[id].objects.splice(i, 1);
			}
			else if (object[objectId].isUnique) {
				foundUniqueObject[objectId] = true;
			}
		}
	}

	renderer.SetPalettes(palette);

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

//TODO this is in progress and doesn't support all features
function serializeWorld(skipFonts) {
	if (skipFonts === undefined || skipFonts === null)
		skipFonts = false;

	var worldStr = "";
	/* TITLE */
	worldStr += getTitle() + "\n";
	worldStr += "\n";
	/* VERSION */
	worldStr += "# BITSY VERSION " + getEngineVersion() + "\n"; // add version as a comment for debugging purposes
	if (version.devBuildPhase != "RELEASE") {
		worldStr += "# DEVELOPMENT BUILD -- " + version.devBuildPhase;
	}
	worldStr += "\n";
	/* FLAGS */
	for (f in flags) {
		worldStr += "! " + f + " " + flags[f] + "\n";
	}
	worldStr += "\n"
	/* FONT */
	if (fontName != defaultFontName) {
		worldStr += "DEFAULT_FONT " + fontName + "\n";
		worldStr += "\n"
	}
	if (textDirection != TextDirection.LeftToRight) {
		worldStr += "TEXT_DIRECTION " + textDirection + "\n";
		worldStr += "\n"
	}
	/* PALETTE */
	for (id in palette) {
		if (id != "default") {
			worldStr += "PAL " + id + "\n";
			if( palette[id].name != null )
				worldStr += "NAME " + palette[id].name + "\n";
			for (i in getPal(id)) {
				for (j in getPal(id)[i]) {
					worldStr += getPal(id)[i][j];
					if (j < 2) worldStr += ",";
				}
				worldStr += "\n";
			}
			worldStr += "\n";
		}
	}
	/* ROOM */
	for (id in room) {
		worldStr += "ROOM " + id + "\n";
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
			worldStr += "NAME " + room[id].name + "\n";
		}
		if (room[id].walls.length > 0) {
			/* WALLS */
			worldStr += "WAL ";
			for (j in room[id].walls) {
				worldStr += room[id].walls[j];
				if (j < room[id].walls.length-1) {
					worldStr += ",";
				}
			}
			worldStr += "\n";
		}
		if (room[id].objects.length > 0) {
			/* OBJECTS */
			for (j in room[id].objects) {
				var obj = room[id].objects[j];
				if (!object[obj.id].isUnique || !object[obj.id].hasUniqueLocation) {
					worldStr += object[obj.id].type + " " + obj.id + " " + obj.x + "," + obj.y;
					worldStr += "\n";
				}

				// temporary field to ensure unique objects are only placed once! (necessary for the player)
				if (object[obj.id].isUnique) {
					object[obj.id].hasUniqueLocation = true;
				}
			}
		}
		if (room[id].exits.length > 0) {
			/* EXITS */
			for (j in room[id].exits) {
				var e = room[id].exits[j];
				if ( isExitValid(e) ) {
					worldStr += "EXT " + e.x + "," + e.y + " " + e.dest.room + " " + e.dest.x + "," + e.dest.y;
					if (e.transition_effect != undefined && e.transition_effect != null) {
						worldStr += " FX " + e.transition_effect;
					}
					if (e.dlg != undefined && e.dlg != null) {
						worldStr += " DLG " + e.dlg;
					}
					worldStr += "\n";
				}
			}
		}
		if (room[id].endings.length > 0) {
			/* ENDINGS */
			for (j in room[id].endings) {
				var e = room[id].endings[j];
				// todo isEndingValid
				worldStr += "END " + e.id + " " + e.x + "," + e.y;
				worldStr += "\n";
			}
		}
		if (room[id].pal != null && room[id].pal != "default") {
			/* PALETTE */
			worldStr += "PAL " + room[id].pal + "\n";
		}
		worldStr += "\n";
	}
	/* MAP */
	for (id in map) {
		worldStr += "MAP " + id + "\n";
		for (i in map[id].map) {
			for (j in map[id].map[i]) {
				worldStr += map[id].map[i][j];
				if (j < map[id].map[i].length - 1) {
					worldStr += ",";
				}
			}
			worldStr += "\n";
		}
		worldStr += "\n";
	}
	/* OBJECTS */
	for (id in object) {
		var type = object[id].type;
		worldStr += type + " " + id + "\n";
		worldStr += serializeDrawing(id);
		if (object[id].name != null && object[id].name != undefined) {
			/* NAME */
			worldStr += "NAME " + object[id].name + "\n";
		}
		if (object[id].col != null && object[id].col != undefined) {
			var defaultColor = type === "TIL" ? 1 : 2;
			if (object[id].col != defaultColor) {
				/* COLOR OVERRIDE */
				worldStr += "COL " + object[id].col + "\n";
			}
		}
		if (type === "TIL" && object[id].isWall != null && object[id].isWall != undefined) {
			/* WALL */
			worldStr += "WAL " + object[id].isWall + "\n";
		}
		if (type != "TIL" && object[id].dlg != null) {
			worldStr += "DLG " + object[id].dlg + "\n";
		}
		if (type != "TIL" && object[id].stp != null) {
			worldStr += "STP " + object[id].stp + "\n";
		}
		if (type != "TIL" && object[id].key != null) {
			worldStr += "KEY " + object[id].key + "\n";
		}
		if (type != "TIL" && object[id].hit != null) {
			worldStr += "HIT " + object[id].hit + "\n";
		}
		if (type === "SPR" && id === playerId && object[id].inventory != null) {
			for (itemId in object[id].inventory) {
				worldStr += "ITM " + itemId + " " + object[id].inventory[itemId] + "\n";
			}
		}

		worldStr += "\n";

		// remove temporary unique placement field
		delete object[id].hasUniqueLocation;
	}
	/* DIALOG */
	for (id in dialog) {
		if (id != titleDialogId) {
			worldStr += "DLG " + id + "\n";
			worldStr += dialog[id].src + "\n";
			if (dialog[id].name != null) {
				worldStr += "NAME " + dialog[id].name + "\n";
			}
			worldStr += "\n";
		}
	}
	/* VARIABLES */
	for (id in variable) {
		worldStr += "VAR " + id + "\n";
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
	var imageSource = renderer.GetImageSource(drwId);
	var drwStr = "";
	for (f in imageSource) {
		for (y in imageSource[f]) {
			var rowStr = "";
			for (x in imageSource[f][y]) {
				rowStr += imageSource[f][y][x];
			}
			drwStr += rowStr + "\n";
		}
		if (f < (imageSource.length-1)) drwStr += ">\n";
	}
	return drwStr;
}

function isExitValid(e) {
	var hasValidStartPos = e.x >= 0 && e.x < 16 && e.y >= 0 && e.y < 16;
	var hasDest = e.dest != null;
	var hasValidRoomDest = (e.dest.room != null && e.dest.x >= 0 && e.dest.x < 16 && e.dest.y >= 0 && e.dest.y < 16);
	return hasValidStartPos && hasDest && hasValidRoomDest;
}

/* ARGUMENT GETTERS */
function getType(line) {
	return getArg(line,0);
}

function getId(line) {
	return getArg(line,1);
}

function getArg(line,arg) {
	return line.split(" ")[arg];
}

function getCoord(line,arg) {
	return getArg(line,arg).split(",");
}

function parseTitle(lines, i) {
	var results = scriptUtils.ReadDialogScript(lines,i);
	setTitle(results.script);
	i = results.index;

	i++;

	return i;
}

function createMap(id) {
	var map = {
		id : id,
		map : [], // todo: name? room_map? world_map?
	};

	for (var i = 0; i < mapsize; i++) {
		map.map.push([]);

		for (var j = 0; j < mapsize; j++) {
			map.map[i].push("0");
		}
	}

	return map;
}

function parseMap(lines, i) {
	var id = getId(lines[i]);
	map[id] = createMap(id);
	i++;

	var end = i + mapsize;
	var y = 0;
	for (; i < end; i++) {
		var lineSep = lines[i].split(",");

		for (x = 0; x < mapsize; x++) {
			var roomId = lineSep[x];
			map[id].map[y][x] = roomId;

			// NOTE: assumes rooms already exist!
			// TODO : room "0" is no longer valid since 0 == empty map space...
			if (roomId != "0") {
				room[roomId].mapLocation.id = id;
				room[roomId].mapLocation.x = x;
				room[roomId].mapLocation.y = y;
			}
		}

		y++;
	}

	return i;
}

// todo : stop hard coding the room size?
function createRoom(id, palId) {
	return {
		id : id,
		tilemap : [
				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"]
			],
		walls : [],
		exits : [],
		endings : [],
		objects : [],
		pal : palId,
		name : null,
		mapLocation : { id: null, x:-1, y:-1 },
	};
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
		if (getType(lines[i]) === "SPR" || getType(lines[i]) === "ITM") {
			var objId = getId(lines[i]);
			var objCoord = lines[i].split(" ")[2].split(",");
			var obj = createObjectLocation(objId, parseInt(objCoord[0]), parseInt(objCoord[1]));
			room[id].objects.push(obj);

			// TODO : do I need to support reading in the old "find and replace" sprite format for back compat?
		}
		else if (getType(lines[i]) === "WAL") {
			/* DEFINE COLLISIONS (WALLS) */
			// TODO : remove this deprecated feature at some point
			room[id].walls = getId(lines[i]).split(",");
		}
		else if (getType(lines[i]) === "EXT") {
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
				if (exitArgs[exitArgIndex] == "FX") {
					ext.transition_effect = exitArgs[exitArgIndex+1];
					exitArgIndex += 2;
				}
				else if (exitArgs[exitArgIndex] == "DLG") {
					ext.dlg = exitArgs[exitArgIndex+1];
					exitArgIndex += 2;
				}
				else {
					exitArgIndex += 1;
				}
			}

			room[id].exits.push(ext);
		}
		else if (getType(lines[i]) === "END") {
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

			room[id].endings.push(end);
		}
		else if (getType(lines[i]) === "PAL") {
			/* CHOOSE PALETTE (that's not default) */
			room[id].pal = getId(lines[i]);
		}
		else if (getType(lines[i]) === "NAME") {
			var name = lines[i].split(/\s(.+)/)[1];
			room[id].name = name;
			names.room.set(name, id);
		}

		i++;
	}

	return i;
}

function parsePalette(lines,i) { //todo this has to go first right now :(
	var id = getId(lines[i]);
	i++;
	var colors = [];
	var name = null;
	while (i < lines.length && lines[i].length > 0) { //look for empty line
		var args = lines[i].split(" ");
		if (args[0] === "NAME") {
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
	palette[id] = {
		id : id,
		name : name,
		colors : colors
	};
	return i;
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

	renderer.SetImageSource(id, drawingData);
}

function createObject(id, type, options) {
	var isPlayer = type === "SPR" && id === playerId;
	var name = options.name ? options.name : null;
	var drwId = id;
	var col = options.col ? options.col : (type === "TIL" ? 1 : 2);
	var dlg = options.dlg ? options.dlg : null;
	var stp = options.stp ? options.stp : null;
	var key = options.key ? options.key : null;
	var hit = options.hit ? options.hit : null;
	var inventory = isPlayer && options.inventory ? options.inventory : null;
	var isWall = type === "TIL" && options.isWall != undefined ? options.isWall : null;
	var isUnique = isPlayer;

	createDrawing(drwId, options.drawingData);

	object[id] = {
		id: id, // unique ID
		type: type, // default behavior: is it a sprite, item, or tile?
		name : name, // user-supplied name
		drw: drwId, // drawing ID
		col: col, // color index
		animation : { // animation data // TODO: figure out how this works with instances
			isAnimated : (renderer.GetFrameCount(drwId) > 1),
			frameIndex : 0,
			frameCount : renderer.GetFrameCount(drwId),
		},
		dlg: dlg, // dialog ID (NOTE: tiles don't use this)
		stp: stp,
		key: key,
		hit: hit,
		inventory : inventory, // starting inventory (player only)
		isWall : isWall, // wall tile? (tile only)
		isUnique : isUnique,
	};
}

function parseObject(lines, i, type) {
	var id = getId(lines[i]);
	i++;

	var options = {};

	// parse drawing
	var drawingResult = parseDrawing(lines, i);
	i = drawingResult.i;
	options.drawingData = drawingResult.drawingData;

	var isPlayer = type === "SPR" && id === playerId;
	if (isPlayer) {
		options.inventory = {};
	}

	// read all other properties
	while (i < lines.length && lines[i].length > 0) { // stop at empty line
		if (getType(lines[i]) === "NAME") {
			/* NAME */
			options.name = lines[i].split(/\s(.+)/)[1];
		}
		else if (getType(lines[i]) === "COL") {
			/* COLOR OFFSET INDEX */
			options.col = parseInt(getId(lines[i]));
		}
		else if (getType(lines[i]) === "WAL" && type === "TIL") {
			// only tiles set their initial collision mode
			var wallArg = getArg(lines[i], 1);
			if (wallArg === "true") {
				options.isWall = true;
			}
			else if (wallArg === "false") {
				options.isWall = false;
			}
		}
		else if (getType(lines[i]) === "DLG" && type != "TIL") {
			options.dlg = getId(lines[i]);
		}
		else if (getType(lines[i]) === "STP" && type != "TIL") {
			options.stp = getId(lines[i]);
		}
		else if (getType(lines[i]) === "KEY" && type != "TIL") {
			options.key = getId(lines[i]);
		}
		else if (getType(lines[i]) === "HIT" && type != "TIL") {
			options.hit = getId(lines[i]);
		}
		else if (getType(lines[i]) === "POS" && type === "SPR") {
			/* STARTING POSITION */
			// NOTE: I still need this to read in old unique position data from sprites
			var posArgs = lines[i].split(" ");
			var roomId = posArgs[1];
			var coordArgs = posArgs[2].split(",");

			// NOTE: assumes rooms have all been created!
			room[roomId].objects.push(
				createObjectLocation(
					id,
					parseInt(coordArgs[0]),
					parseInt(coordArgs[1])));
		}
		else if (getType(lines[i]) === "ITM" && isPlayer) {
			/* ITEM STARTING INVENTORY */
			// TODO: This is only used by the player avatar -- should I move it out of sprite data?
			var itemId = getId(lines[i]);
			var itemCount = parseFloat(getArg(lines[i], 2));
			options.inventory[itemId] = itemCount;
		}

		i++;
	}

	createObject(id, type, options);

	return i;
}

function parseDrawing(lines, i) {
	var frameList = []; //init list of frames
	frameList.push([]); //init first frame

	var frameIndex = 0;

	var y = 0;

	while (y < tilesize) {
		var l = lines[i+y];

		var row = [];
		for (x = 0; x < tilesize; x++) {
			row.push(parseInt(l.charAt(x)));
		}

		frameList[frameIndex].push(row);

		y++;

		if (y === tilesize) {
			i = i + y;

			if (lines[i] != undefined && lines[i].charAt(0) === ">") {
				// start next frame!
				frameList.push([]);
				frameIndex++;

				//start the count over again for the next frame
				i++;

				y = 0;
			}
		}
	}

	return { i:i, drawingData:frameList };
}

function parseScript(lines, i, backCompatPrefix, compatibilityFlags) {
	var id = getId(lines[i]);
	id = backCompatPrefix + id;
	i++;

	var script = "";
	var startsWithDialogExpression = (lines[i].length >= 3) && (lines[i].indexOf("{->") === 0);

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

				if (lines[i][charIndex] === "{") {
					bracesCount++;
				}
				else if (lines[i][charIndex] === "}") {
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

	dialog[id] = {
		id: id,
		src: script,
		name: null,
	};

	if (compatibilityFlags.convertImplicitSpriteDialogIds) {
		// explicitly hook up dialog that used to be implicitly
		// connected by sharing sprite and dialog IDs in old versions
		if (object[id] && object[id].type === "SPR") {
			if (object[id].dlg === undefined || object[id].dlg === null) {
				object[id].dlg = id;
			}
		}
	}

	return i;
}

function parseDialog(lines, i, compatibilityFlags) {
	// hacky but I need to store this so I can set the name below
	var id = getId(lines[i]);

	i = parseScript(lines, i, "", compatibilityFlags);

	if (lines[i].length > 0 && getType(lines[i]) === "NAME") {
		dialog[id].name = lines[i].split(/\s(.+)/)[1]; // TODO : hacky to keep copying this regex around...
		names.dialog.set(dialog[id].name, id);
		i++;
	}

	return i;
}

// keeping this around to parse old files where endings were separate from dialogs
function parseEnding(lines, i, compatibilityFlags) {
	return parseScript(lines, i, "end_", compatibilityFlags);
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
	fontManager.AddResource( localFontFilename, localFontData );

	return i;
}

function parseFlag(lines, i) {
	var id = getId(lines[i]);
	var valStr = lines[i].split(" ")[2];
	flags[id] = parseInt( valStr );
	i++;
	return i;
}

function drawObject(img,x,y,context) {
	if (!context) { //optional pass in context; otherwise, use default
		context = ctx;
	}
	// NOTE: images are now canvases, instead of raw image data (for chrome performance reasons)
	context.drawImage(img,x*tilesize*scale,y*tilesize*scale,tilesize*scale,tilesize*scale);
}

function drawRoom(room, options) {
	function getOptionOrDefault(optionId, defaultValue) {
		var doesOptionExist = (options != undefined && options != null) && (options[optionId] != undefined && options[optionId] != null);
		return doesOptionExist ? options[optionId] : defaultValue;
	}

	context = getOptionOrDefault("context", ctx);
	frameIndex = getOptionOrDefault("frameIndex", null);
	drawObjectInstances = getOptionOrDefault("drawObjectInstances", true);

	var paletteId = "default";

	if (room === undefined) {
		// protect against invalid rooms
		context.fillStyle = "rgb(" + getPal(paletteId)[0][0] + "," + getPal(paletteId)[0][1] + "," + getPal(paletteId)[0][2] + ")";
		context.fillRect(0,0,canvas.width,canvas.height);
		return;
	}

	//clear screen
	if (room.pal != null && palette[paletteId] != undefined) {
		paletteId = room.pal;
	}
	context.fillStyle = "rgb(" + getPal(paletteId)[0][0] + "," + getPal(paletteId)[0][1] + "," + getPal(paletteId)[0][2] + ")";
	context.fillRect(0,0,canvas.width,canvas.height);

	//draw tiles
	for (i in room.tilemap) {
		for (j in room.tilemap[i]) {
			var id = room.tilemap[i][j];
			if (id != "0") {
				//console.log(id);
				if (object[id] == null) { // hack-around to avoid corrupting files (not a solution though!)
					id = "0";
					room.tilemap[i][j] = id;
				}
				else {
					// console.log(id);
					drawObject(renderer.GetImage(object[id], paletteId, frameIndex), j, i, context);
				}
			}
		}
	}

	if (drawObjectInstances) {
		// draw object instances
		for (var i in objectInstances) {
			var objectInstance = objectInstances[i];
			var objectImage = renderer.GetImage(objectInstance, paletteId, frameIndex);
			drawObject(objectImage, objectInstance.x, objectInstance.y, context);
		}

		// draw player instance
		if (player().room === room.id) {
			var objectImage = renderer.GetImage(player(), paletteId, frameIndex);
			drawObject(objectImage, player().x, player().y, context);
		}
	}
	else {
		// draw object initial locations
		for (var i = 0; i < room.objects.length; i++) {
			var objectLocation = room.objects[i];
			var objectDefinition = object[objectLocation.id];
			var objectImage = renderer.GetImage(objectDefinition, paletteId, frameIndex);
			drawObject(objectImage, objectLocation.x, objectLocation.y, context);
		}
	}
}

function curPal() {
	return getRoomPal(curRoom);
}

function getRoomPal(roomId) {
	var defaultId = "default";

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
	// TODO : this won't work... needs to move into the queue logic
	isNarrating = true;
	isEnding = true;

	queueScript(
		ending.id,
		ending,
		function() {
			var isLocked = ending.property && ending.property.Get("locked") === true;
			if (isLocked) {
				isEnding = false;
			}
		});
}

function startItemDialog(itemInstance, dialogCallback) {
	var dialogId = itemInstance.dlg;
	if (dialog[dialogId]) {
		queueScript(dialogId, itemInstance, dialogCallback);
	}
	else {
		dialogCallback();
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
var scriptNext = new ScriptNext();
